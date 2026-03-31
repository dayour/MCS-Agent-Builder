/**
 * Answer Engine — MCS Solutioning AI for Real-Time Meeting Support
 *
 * When a question or requirement is detected, generates a contextual answer
 * grounded in the pre-meeting briefing (customer context + MCS capabilities).
 *
 * Streams responses token-by-token for real-time UI updates.
 *
 * Model routing:
 *   - GPT-5.4 (default) — all real-time meeting answers via streaming
 *   - Claude (haiku/sonnet/opus) — fallback only if GPT unavailable
 */

const EventEmitter = require('events');
const gptApi = require('../../../tools/lib/openai');
const anthropicApi = require('../../../tools/lib/anthropic');

const DEFAULT_MODEL = 'gpt-5.4';
const MAX_CONTEXT_TURNS = 5;
const MAX_ANSWER_TOKENS = 600;

// System prompt template — briefing is injected at meeting start
const SYSTEM_PROMPT_TEMPLATE = `You are an expert Microsoft Copilot Studio (MCS) solutioning consultant assisting Kim during a live customer meeting. You have deep knowledge of MCS capabilities, connectors, topics, knowledge sources, MCP servers, and agent architecture patterns.

## Your Role
- Answer customer questions about MCS capabilities accurately and confidently
- Map customer requirements to specific MCS components (connectors, MCPs, topics, knowledge sources)
- Suggest agent architecture approaches when the customer describes their needs
- Flag technical limitations honestly — never oversell what MCS can do
- Cite specific capabilities from the knowledge base when relevant
- Keep answers concise (2-4 sentences) — Kim needs to process these while talking

## Response Format
For QUESTIONS: Give a direct, confident answer. Include specific MCS component names.
For REQUIREMENTS: Map to MCS components. Note if something needs a custom connector or Power Automate flow.
For FEASIBILITY: Be honest — "Yes, MCS can do this via [component]" or "This would need [workaround/limitation]"

## Context
{BRIEFING}`;

/**
 * Returns true if the model is a GPT model.
 */
function isGPTModel(model) {
  return typeof model === 'string' && model.startsWith('gpt-');
}

class AnswerEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.model = options.model || DEFAULT_MODEL;
    this.briefing = null;
    this.systemPrompt = null;
    this.isReady = false;
    this.briefingTokens = 0;
    this._abortController = null; // Tracks in-flight generation for cancellation
    this.history = []; // All generated answers
    this.stats = {
      answers: 0,
      totalTokens: 0,
      totalCost: 0,
      avgResponseMs: 0,
      avgTTFT: 0,
      cancelled: 0
    };
  }

  /**
   * Load the meeting briefing as the system prompt.
   * @param {string} briefing - Pre-generated meeting briefing text
   */
  loadBriefing(briefing) {
    this.briefing = briefing;
    this.systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace('{BRIEFING}', briefing);
    this.isReady = true;
    this.briefingTokens = Math.ceil(this.systemPrompt.length / 4);
    this.emit('status', {
      type: 'briefing_loaded',
      tokens: this.briefingTokens
    });
  }

  /**
   * Set the answer model at runtime.
   * @param {string} model - 'gpt-5.4', 'haiku', 'sonnet', 'opus', etc.
   */
  setModel(model) {
    this.model = model;
    this.emit('status', { type: 'model_changed', model });
  }

  /**
   * Generate an answer for a detected question/requirement.
   * Streams the response token-by-token.
   *
   * @param {object} detection - From QuestionDetector
   * @returns {Promise<{id: string, text: string, usage: object, cost: number, ttft: number, totalMs: number}>}
   */
  async generateAnswer(detection) {
    if (!this.isReady) {
      throw new Error('AnswerEngine not ready. Call loadBriefing() first.');
    }

    // Abort any in-flight answer — newer question supersedes
    if (this._abortController) {
      this._abortController.abort();
      this.stats.cancelled++;
      this.emit('answer_cancelled', { reason: 'superseded' });
    }
    const ac = new AbortController();
    this._abortController = ac;

    const answerId = `ans_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();
    let ttft = null;

    // Build conversation context
    const contextLines = (detection.context || [])
      .slice(-MAX_CONTEXT_TURNS)
      .map(e => `${e.speaker === 'kim' ? 'Kim' : 'Customer'}: ${e.text}`)
      .join('\n');

    const userMessage = detection.type === 'requirement'
      ? `[REQUIREMENT DETECTED]\nRecent conversation:\n${contextLines}\n\nCustomer stated: "${detection.text}"\n\nMap this requirement to MCS capabilities and suggest how to implement it.`
      : `[QUESTION DETECTED]\nRecent conversation:\n${contextLines}\n\nCustomer asked: "${detection.text}"\n\nProvide a concise, accurate answer.`;

    const messages = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: userMessage }
    ];

    this.emit('answer_start', { id: answerId, detection });

    try {
      let fullText = '';
      let usage = {};
      let cost = 0;

      if (isGPTModel(this.model)) {
        await this._streamGPT(answerId, messages, startTime, ac.signal, (result) => {
          fullText = result.text;
          usage = result.usage;
          cost = result.cost;
          ttft = result.ttft;
        });
      } else {
        await this._streamClaude(answerId, messages, startTime, ac.signal, (result) => {
          fullText = result.text;
          usage = result.usage;
          cost = result.cost;
          ttft = result.ttft;
        });
      }

      // If aborted mid-stream, don't record as a completed answer
      if (ac.signal.aborted) return null;

      const totalMs = Date.now() - startTime;

      const answer = {
        id: answerId,
        text: fullText,
        detection: {
          text: detection.text,
          type: detection.type,
          confidence: detection.confidence
        },
        model: this.model,
        usage,
        cost,
        ttft,
        totalMs,
        timestamp: Date.now()
      };

      this.stats.answers++;
      this.stats.totalTokens += (usage.completion_tokens || usage.output_tokens || 0);
      this.stats.totalCost += cost;
      this.stats.avgResponseMs = ((this.stats.avgResponseMs * (this.stats.answers - 1)) + totalMs) / this.stats.answers;
      this.stats.avgTTFT = ((this.stats.avgTTFT * (this.stats.answers - 1)) + (ttft || 0)) / this.stats.answers;

      this.history.push(answer);
      this.emit('answer_complete', answer);
      return answer;
    } catch (err) {
      this.emit('answer_error', { id: answerId, error: err.message });
      throw err;
    } finally {
      // Always clean up controller (handles both success and error paths)
      if (this._abortController === ac) this._abortController = null;
    }
  }

  /**
   * Stream answer via GPT-5.4. Falls back to Claude Haiku if GPT unavailable.
   */
  async _streamGPT(answerId, messages, startTime, signal, onResult) {
    if (!gptApi.isConfigured()) {
      this.emit('status', { type: 'gpt_unavailable', fallback: 'haiku' });
      return this._streamClaude(answerId, messages, startTime, signal, onResult);
    }

    let fullText = '';
    let ttft = null;
    let usage = {};
    let cost = 0;

    for await (const event of gptApi.streamCompletion(messages, {
      maxTokens: MAX_ANSWER_TOKENS,
      timeout: 15000,
      signal
    })) {
      if (signal.aborted || event.type === 'aborted') break;
      if (event.type === 'text') {
        if (ttft === null) {
          ttft = Date.now() - startTime;
          this.emit('answer_ttft', { id: answerId, ttft });
        }
        fullText += event.text;
        this.emit('answer_delta', { id: answerId, text: event.text });
      }
      if (event.type === 'done') {
        usage = event.usage || {};
        cost = event.cost || 0;
      }
    }

    onResult({ text: fullText, usage, cost, ttft });
  }

  /**
   * Stream answer via Claude (Anthropic API with auto-routing).
   */
  async _streamClaude(answerId, messages, startTime, signal, onResult) {
    let fullText = '';
    let ttft = null;
    let usage = {};
    let cost = 0;

    for await (const event of anthropicApi.streamCompletion(messages, {
      model: isGPTModel(this.model) ? 'haiku' : this.model,
      maxTokens: MAX_ANSWER_TOKENS,
      cacheSystem: true
    })) {
      if (signal.aborted) break;
      if (event.type === 'fallback') {
        this.emit('status', { type: 'model_fallback', message: event.message });
      }
      if (event.type === 'text') {
        if (ttft === null) {
          ttft = Date.now() - startTime;
          this.emit('answer_ttft', { id: answerId, ttft });
        }
        fullText += event.text;
        this.emit('answer_delta', { id: answerId, text: event.text });
      }
      if (event.type === 'done') {
        usage = event.usage || {};
        cost = event.cost || 0;
      }
    }

    onResult({ text: fullText, usage, cost, ttft });
  }

  /**
   * Cancel the current streaming answer.
   */
  cancelAnswer() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
      this.stats.cancelled++;
      this.emit('answer_cancelled', { reason: 'manual' });
    }
  }

  /**
   * Get all generated answers.
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Get answer engine stats.
   */
  getStats() {
    return { ...this.stats };
  }
}

module.exports = { AnswerEngine, SYSTEM_PROMPT_TEMPLATE };
