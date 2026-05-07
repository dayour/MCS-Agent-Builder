/**
 * Chat Engine — Fast-Response MCS Expert for Live Meeting Support
 *
 * Pre-loaded with project context + MCS knowledge. User types questions
 * directly, gets streamed answers grounded in the loaded context.
 *
 * Model routing:
 *   - Latest GPT-5.x (default) — fast TTFT for live meeting use; the actual
 *     id (gpt-5.5, gpt-5.6, ...) is resolved at send time by openai.js.
 *   - Claude Opus — fallback if GPT unavailable
 */

const EventEmitter = require('events');
const gptApi = require('../../../tools/lib/openai');
const anthropicApi = require('../../../tools/lib/anthropic');

// Family sentinel; openai.js resolves the actual id (e.g. gpt-5.5) at send time.
const DEFAULT_MODEL = 'gpt';
const MAX_HISTORY_MESSAGES = 20; // 10 turns (user + assistant)
const MAX_ANSWER_TOKENS = 4096;

const SYSTEM_PROMPT_TEMPLATE = `You are an expert Microsoft Copilot Studio (MCS) consultant helping Kim answer questions during a live meeting. You have full project context and MCS knowledge loaded below.

## Guidelines
- Answer questions directly and concisely — Kim is in a live call
- Reference specific MCS components by name (connectors, MCPs, topics, knowledge sources, triggers, channels)
- For architecture questions, reference the scoring framework and component selection patterns
- Flag technical limitations honestly — never oversell what MCS can do
- If something needs Power Automate, a custom connector, or has known gaps, say so
- You may give longer answers when the question requires detailed explanation
- When citing specific docs or cache files, mention the source

## Context
{CONTEXT}`;

/**
 * Returns true if the model is a GPT model. Accepts both the family sentinel
 * 'gpt' and concrete ids like 'gpt-5.5'.
 */
function isGPTModel(model) {
  return typeof model === 'string' && (model === 'gpt' || model.startsWith('gpt-'));
}

class ChatEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.model = options.model || DEFAULT_MODEL;
    this.context = null;
    this.systemPrompt = null;
    this.isReady = false;
    this.contextTokens = 0;
    this._abortController = null;
    this.conversationHistory = []; // {role, content} pairs
    this.stats = {
      messages: 0,
      totalTokens: 0,
      totalCost: 0,
      avgResponseMs: 0,
      avgTTFT: 0,
      cancelled: 0
    };
  }

  /**
   * Load the context as the system prompt.
   * @param {string} context - Pre-generated context text from context-loader
   */
  loadContext(context) {
    if (!context || typeof context !== 'string') {
      throw new Error('loadContext requires a non-empty string');
    }
    this.context = context;
    this.systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace('{CONTEXT}', context);
    this.isReady = true;
    this.contextTokens = Math.ceil(this.systemPrompt.length / 4);
    this.emit('status', { type: 'context_loaded', tokens: this.contextTokens });
  }

  /**
   * Set the model at runtime.
   */
  setModel(model) {
    this.model = model;
    this.emit('status', { type: 'model_changed', model });
  }

  /**
   * Send a message and stream the response.
   * @param {string} userMessage - The user's question
   * @returns {Promise<{id: string, text: string, usage: object, cost: number, ttft: number, totalMs: number} | null>}
   */
  async sendMessage(userMessage) {
    if (!this.isReady) {
      throw new Error('ChatEngine not ready. Call loadContext() first.');
    }

    // Abort any in-flight response
    if (this._abortController) {
      this._abortController.abort();
      this.stats.cancelled++;
      this.emit('message_cancelled', { reason: 'superseded' });
    }
    const ac = new AbortController();
    this._abortController = ac;

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();
    let ttft = null;

    // Stage user message (not committed to history until success)
    const stagedUserMsg = { role: 'user', content: userMessage };

    // Build messages: system + existing history + new user message
    const messages = [
      { role: 'system', content: this.systemPrompt },
      ...this.conversationHistory,
      stagedUserMsg
    ];

    this.emit('message_start', { id: messageId, userMessage });

    try {
      let fullText = '';
      let usage = {};
      let cost = 0;

      if (isGPTModel(this.model)) {
        await this._streamGPT(messageId, messages, startTime, ac.signal, (result) => {
          fullText = result.text;
          usage = result.usage;
          cost = result.cost;
          ttft = result.ttft;
        });
      } else {
        await this._streamClaude(messageId, messages, startTime, ac.signal, (result) => {
          fullText = result.text;
          usage = result.usage;
          cost = result.cost;
          ttft = result.ttft;
        });
      }

      if (ac.signal.aborted) return null;

      const totalMs = Date.now() - startTime;

      // Commit both user + assistant messages as a complete turn
      this.conversationHistory.push(stagedUserMsg);
      this.conversationHistory.push({ role: 'assistant', content: fullText });
      // Trim by pairs to keep complete turns
      while (this.conversationHistory.length > MAX_HISTORY_MESSAGES) {
        // Remove oldest pair (user + assistant)
        this.conversationHistory.splice(0, 2);
      }

      const result = {
        id: messageId,
        text: fullText,
        model: this.model,
        usage,
        cost,
        ttft,
        totalMs,
        timestamp: Date.now()
      };

      this.stats.messages++;
      this.stats.totalTokens += (usage.completion_tokens || usage.output_tokens || 0);
      this.stats.totalCost += cost;
      this.stats.avgResponseMs = ((this.stats.avgResponseMs * (this.stats.messages - 1)) + totalMs) / this.stats.messages;
      if (ttft !== null) {
        const prevCount = this.stats.messages - 1;
        this.stats.avgTTFT = prevCount > 0
          ? ((this.stats.avgTTFT * prevCount) + ttft) / this.stats.messages
          : ttft;
      }

      this.emit('message_complete', result);
      return result;
    } catch (err) {
      // Treat abort errors as normal cancellation, not failures
      if (ac.signal.aborted || err.name === 'AbortError') {
        this.emit('message_cancelled', { id: messageId, reason: 'aborted' });
        return null;
      }
      this.emit('message_error', { id: messageId, error: err.message });
      throw err;
    } finally {
      if (this._abortController === ac) this._abortController = null;
    }
  }

  /**
   * Stream via GPT-5.5. Falls back to Claude if GPT unavailable or fails at runtime.
   */
  async _streamGPT(messageId, messages, startTime, signal, onResult) {
    if (!gptApi.isConfigured()) {
      this.emit('status', { type: 'gpt_unavailable', fallback: 'opus' });
      return this._streamClaude(messageId, messages, startTime, signal, onResult);
    }

    let fullText = '';
    let ttft = null;
    let usage = {};
    let cost = 0;

    try {
      for await (const event of gptApi.streamCompletion(messages, {
        maxTokens: MAX_ANSWER_TOKENS,
        timeout: 15000,
        reasoningEffort: 'medium',
        signal
      })) {
        if (signal.aborted || event.type === 'aborted') break;
        if (event.type === 'text') {
          if (ttft === null) {
            ttft = Date.now() - startTime;
            this.emit('message_ttft', { id: messageId, ttft });
          }
          fullText += event.text;
          this.emit('message_delta', { id: messageId, text: event.text });
        }
        if (event.type === 'done') {
          usage = event.usage || {};
          cost = event.cost || 0;
        }
      }
    } catch (err) {
      // On GPT runtime failure, fall back to Claude (unless aborted)
      if (signal.aborted || err.name === 'AbortError') throw err;
      this.emit('status', { type: 'gpt_runtime_error', error: err.message, fallback: 'opus' });
      return this._streamClaude(messageId, messages, startTime, signal, onResult);
    }

    onResult({ text: fullText, usage, cost, ttft });
  }

  /**
   * Stream via Claude (Anthropic API with auto-routing).
   */
  async _streamClaude(messageId, messages, startTime, signal, onResult) {
    let fullText = '';
    let ttft = null;
    let usage = {};
    let cost = 0;

    for await (const event of anthropicApi.streamCompletion(messages, {
      model: isGPTModel(this.model) ? 'opus' : this.model,
      maxTokens: MAX_ANSWER_TOKENS,
      cacheSystem: true,
      signal
    })) {
      if (signal.aborted) break;
      if (event.type === 'fallback') {
        this.emit('status', { type: 'model_fallback', message: event.message });
      }
      if (event.type === 'text') {
        if (ttft === null) {
          ttft = Date.now() - startTime;
          this.emit('message_ttft', { id: messageId, ttft });
        }
        fullText += event.text;
        this.emit('message_delta', { id: messageId, text: event.text });
      }
      if (event.type === 'done') {
        usage = event.usage || {};
        cost = event.cost || 0;
      }
    }

    onResult({ text: fullText, usage, cost, ttft });
  }

  /**
   * Cancel the current streaming response.
   */
  cancelMessage() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
      this.stats.cancelled++;
      this.emit('message_cancelled', { reason: 'manual' });
    }
  }

  /**
   * Clear conversation history (keeps context loaded).
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  getStats() {
    return { ...this.stats };
  }
}

module.exports = { ChatEngine };
