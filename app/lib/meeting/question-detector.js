/**
 * Question Detector — Hybrid heuristic + LLM classification
 *
 * Detects when the customer asks a question or states a requirement
 * during a meeting. Uses a fast heuristic path (<10ms) with optional
 * LLM classifier for uncertain cases.
 *
 * Designed for MCS solutioning meetings — detects:
 * - Direct questions ("Can your platform do X?", "How does Y work?")
 * - Requirements ("We need X", "It must integrate with Y")
 * - Feasibility probes ("Is it possible to...", "What about...")
 * - Technical inquiries ("Does it support...", "What APIs...")
 */

const EventEmitter = require('events');
const { chatCompletion } = require('../../../tools/lib/openai');

// Heuristic patterns for fast-path detection
const QUESTION_PATTERNS = [
  /\?$/,                                    // Ends with question mark
  /^(can|could|would|should|does|do|is|are|was|were|will|how|what|when|where|why|which|who)\b/i,
  /\b(how about|what about|what if|is it possible|can we|could we|would it)\b/i,
  /\b(tell me|explain|describe|walk me through|show me)\b/i,
  /\b(does it support|can it handle|is there a way|any way to)\b/i
];

const REQUIREMENT_PATTERNS = [
  /\b(we need|we require|we must|we want|it must|it needs to|it should|it has to)\b/i,
  /\b(requirement is|our requirement|key requirement|mandatory|essential|critical)\b/i,
  /\b(integrate with|connect to|pull data from|push data to|sync with)\b/i,
  /\b(compliance|security|sla|uptime|latency|performance|scalability)\b/i,
  /\b(we currently use|our current|we're using|we already have)\b/i
];

const NOISE_PATTERNS = [
  /^(yes|no|okay|ok|sure|right|yeah|uh|um|hmm|ah|mhm|got it|thanks|thank you)\b/i,
  /^(hello|hi|hey|good morning|good afternoon)\b/i,
  /^\s*$/
];

const DEBOUNCE_MS = 2000;        // Wait 2s for speaker to finish
const STABILITY_MS = 500;        // Whisper partial must be stable for 500ms before evaluation
const CONFIDENCE_THRESHOLD = 0.6;
const MIN_TEXT_LENGTH = 10;
const DEDUP_COOLDOWN_MS = 30000; // Don't re-detect same question within 30s

class QuestionDetector extends EventEmitter {
  constructor(options = {}) {
    super();
    this.useLLM = options.useLLM !== false;
    this.debounceMs = options.debounceMs ?? DEBOUNCE_MS;
    this.stabilityMs = options.stabilityMs ?? STABILITY_MS;
    this.confidenceThreshold = options.confidenceThreshold ?? CONFIDENCE_THRESHOLD;
    this.dedupCooldownMs = options.dedupCooldownMs ?? DEDUP_COOLDOWN_MS;
    this._pendingTexts = [];
    this._debounceTimer = null;
    this._stabilityTimer = null;
    this._pendingPartial = null;        // Most recent unstable partial awaiting stability
    this._conversationContext = [];
    this._maxContext = options.maxContext ?? 10;
    this._recentFingerprints = new Map(); // fingerprint → timestamp (for dedup)
    this.stats = { questions: 0, requirements: 0, skipped: 0, llmCalls: 0, deduplicated: 0 };
  }

  /**
   * Process a new transcript entry.
   * @param {object} entry - { speaker: 'customer'|'kim', text: string, timestamp: number, final?: boolean }
   *   `final` indicates whether the transcription is finalized (not a partial/revision).
   *   If omitted, treated as final.
   */
  process(entry) {
    if (!entry || typeof entry.text !== 'string') return;

    // Track conversation context (both speakers)
    this._conversationContext.push(entry);
    if (this._conversationContext.length > this._maxContext) {
      this._conversationContext.shift();
    }

    // Only detect questions from customer (not Kim)
    if (entry.speaker !== 'customer') return;

    // Skip noise
    if (entry.text.length < MIN_TEXT_LENGTH) return;
    if (NOISE_PATTERNS.some(p => p.test(entry.text.trim()))) {
      this.stats.skipped++;
      return;
    }

    // Stability gating: if this is a partial (non-final) transcript,
    // reset the stability timer. Only add to pending when text is stable
    // (no revision within stabilityMs) or explicitly marked final.
    const isFinal = entry.final !== false;

    if (isFinal) {
      // Finalized segment — clear any pending partial for the same utterance
      if (this._stabilityTimer) { clearTimeout(this._stabilityTimer); this._stabilityTimer = null; }
      // If the stabilized partial was already pushed, replace it to avoid duplication
      if (this._pendingPartial === null && this._pendingTexts.length > 0) {
        const last = this._pendingTexts[this._pendingTexts.length - 1];
        // Replace if the final text substantially overlaps the last pending (same utterance)
        if (last.speaker === entry.speaker && entry.text.includes(last.text.substring(0, 20))) {
          this._pendingTexts[this._pendingTexts.length - 1] = entry;
        } else {
          this._pendingTexts.push(entry);
        }
      } else {
        this._pendingPartial = null;
        this._pendingTexts.push(entry);
      }
      this._resetDebounce();
    } else {
      // Partial — wait for it to stabilize (no new partial within stabilityMs)
      this._pendingPartial = entry;
      if (this._stabilityTimer) clearTimeout(this._stabilityTimer);
      this._stabilityTimer = setTimeout(() => {
        this._stabilityTimer = null;
        if (this._pendingPartial) {
          this._pendingTexts.push(this._pendingPartial);
          this._pendingPartial = null;
          this._resetDebounce();
        }
      }, this.stabilityMs);
    }
  }

  _resetDebounce() {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._evaluate().catch(err => this.emit('detection_error', err));
    }, this.debounceMs);
  }

  /**
   * Evaluate buffered text for questions/requirements.
   */
  async _evaluate() {
    if (this._pendingTexts.length === 0) return;

    // Combine pending texts into one utterance
    const combinedText = this._pendingTexts.map(e => e.text).join(' ').trim();
    const timestamp = this._pendingTexts[this._pendingTexts.length - 1].timestamp;
    this._pendingTexts = [];

    // Fast path: heuristic check
    const heuristicResult = this._heuristicCheck(combinedText);

    if (heuristicResult.confidence >= 0.8) {
      // High confidence — emit immediately
      this._emitDetection(combinedText, heuristicResult, timestamp);
      return;
    }

    if (heuristicResult.confidence <= 0.2) {
      // Clearly not a question — skip
      this.stats.skipped++;
      return;
    }

    // Uncertain — use LLM classifier if enabled
    if (this.useLLM) {
      const llmResult = await this._llmClassify(combinedText);
      if (llmResult.type !== 'none' && llmResult.confidence >= this.confidenceThreshold) {
        this._emitDetection(combinedText, llmResult, timestamp);
      } else {
        this.stats.skipped++;
      }
    } else if (heuristicResult.confidence >= this.confidenceThreshold) {
      this._emitDetection(combinedText, heuristicResult, timestamp);
    } else {
      this.stats.skipped++;
    }
  }

  /**
   * Heuristic question/requirement detection.
   * @param {string} text
   * @returns {{ type: 'question'|'requirement'|'none', confidence: number }}
   */
  _heuristicCheck(text) {
    const trimmed = text.trim();

    // Check for questions
    let questionScore = 0;
    for (const pattern of QUESTION_PATTERNS) {
      if (pattern.test(trimmed)) questionScore += 0.3;
    }
    questionScore = Math.min(questionScore, 1.0);

    // Check for requirements
    let requirementScore = 0;
    for (const pattern of REQUIREMENT_PATTERNS) {
      if (pattern.test(trimmed)) requirementScore += 0.3;
    }
    requirementScore = Math.min(requirementScore, 1.0);

    if (questionScore > requirementScore && questionScore > 0.2) {
      return { type: 'question', confidence: questionScore, method: 'heuristic' };
    }
    if (requirementScore > 0.2) {
      return { type: 'requirement', confidence: requirementScore, method: 'heuristic' };
    }
    return { type: 'none', confidence: 0, method: 'heuristic' };
  }

  /**
   * LLM-based classification for uncertain cases.
   * Uses GPT-5.4 via Copilot API (~1.3s TTFT).
   */
  async _llmClassify(text) {
    this.stats.llmCalls++;
    try {
      const recentContext = this._conversationContext
        .slice(-5)
        .map(e => `${e.speaker === 'kim' ? 'Kim' : 'Customer'}: ${e.text}`)
        .join('\n');

      const result = await chatCompletion([
        { role: 'system', content: 'You classify meeting utterances. Respond with ONLY a JSON object: {"type":"question"|"requirement"|"none","confidence":0.0-1.0,"summary":"brief restatement"}' },
        { role: 'user', content: `Recent conversation:\n${recentContext}\n\nClassify this customer utterance:\n"${text}"` }
      ], { maxTokens: 100, timeout: 5000 });

      const parsed = JSON.parse(result.content);
      return { ...parsed, method: 'llm' };
    } catch {
      // LLM failed — fall back to heuristic
      return this._heuristicCheck(text);
    }
  }

  /**
   * Compute a simple fingerprint from normalized text for dedup.
   * Strips filler words and lowercases to catch rephrased duplicates.
   */
  _fingerprint(text) {
    const fp = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\b(the|a|an|is|are|can|could|would|we|you|it|do|does|this|that|our|your)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    // If stopword stripping emptied the fingerprint, fall back to lowered original
    return fp.length >= 3 ? fp : text.toLowerCase().replace(/[^\w\s]/g, '').trim();
  }

  _emitDetection(text, result, timestamp) {
    // Dedup: skip if same fingerprint detected within cooldown window
    const fp = this._fingerprint(text);
    const now = Date.now();
    const lastSeen = this._recentFingerprints.get(fp);
    if (lastSeen && (now - lastSeen) < this.dedupCooldownMs) {
      this.stats.deduplicated++;
      return;
    }
    this._recentFingerprints.set(fp, now);

    // Prune old fingerprints (keep map from growing unbounded)
    if (this._recentFingerprints.size > 50) {
      for (const [key, ts] of this._recentFingerprints) {
        if (now - ts > this.dedupCooldownMs) this._recentFingerprints.delete(key);
      }
    }

    if (result.type === 'question') this.stats.questions++;
    if (result.type === 'requirement') this.stats.requirements++;

    this.emit('detected', {
      text,
      type: result.type,
      confidence: result.confidence,
      method: result.method,
      summary: result.summary || text,
      timestamp,
      context: this._conversationContext.slice(-5)
    });
  }

  /**
   * Get recent conversation context.
   * @returns {Array}
   */
  getContext() {
    return [...this._conversationContext];
  }

  /**
   * Clean up timers and state. Call when the meeting session ends.
   */
  destroy() {
    if (this._debounceTimer) { clearTimeout(this._debounceTimer); this._debounceTimer = null; }
    if (this._stabilityTimer) { clearTimeout(this._stabilityTimer); this._stabilityTimer = null; }
    this._pendingTexts = [];
    this._pendingPartial = null;
    this._conversationContext = [];
    this._recentFingerprints.clear();
  }

  getStats() {
    return { ...this.stats };
  }
}

module.exports = { QuestionDetector };
