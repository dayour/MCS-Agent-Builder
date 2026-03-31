/**
 * Meeting Session — Orchestrates the full meeting co-pilot pipeline
 *
 * Lifecycle: idle → preparing → ready → capturing → active → stopped
 *
 * Coordinates:
 * - AudioBridge (native-audio-node WASAPI capture)
 * - TranscriptionService (whisper.node with VAD + echo suppression)
 * - QuestionDetector (heuristic + GPT-5.4 LLM)
 * - AnswerEngine (GPT-5.4 streaming with abort)
 */

const EventEmitter = require('events');
const { AudioBridge } = require('./audio-bridge');
const { TranscriptionService } = require('./transcription');
const { QuestionDetector } = require('./question-detector');
const { AnswerEngine } = require('./answer-engine');
const { generateBriefing, estimateTokenCount } = require('./briefing-generator');

const STATES = ['idle', 'preparing', 'ready', 'capturing', 'active', 'stopped'];

class MeetingSession extends EventEmitter {
  constructor(options = {}) {
    super();
    this.id = `meeting_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.projectId = options.projectId || null;
    this.projectDir = options.projectDir || null;
    this.agentName = options.agentName || null;
    this.state = 'idle';
    this.startedAt = null;
    this.stoppedAt = null;

    // Pipeline components
    this.audioBridge = new AudioBridge();
    this.transcription = new TranscriptionService({ model: options.transcriptionModel || 'tiny.en' });
    this.questionDetector = new QuestionDetector({ useLLM: options.useLLM !== false });
    this.answerEngine = new AnswerEngine({ model: options.answerModel || 'gpt-5.4' });

    // Data stores
    this.transcript = [];
    this.suggestions = [];

    // Wire up events
    this._wireEvents();
  }

  _wireEvents() {
    // Audio → Transcription
    this.audioBridge.on('audio', ({ stream, data }) => {
      this.transcription.feedAudio(data, stream);
    });

    this.audioBridge.on('connected', () => {
      this._emitEvent('audio_connected');
    });

    this.audioBridge.on('stopped', () => {
      this._emitEvent('audio_disconnected');
    });

    this.audioBridge.on('status', (status) => {
      this._emitEvent('audio_status', status);
    });

    this.audioBridge.on('error', (err) => {
      this._emitEvent('audio_error', err);
    });

    // Transcription → Question Detector + Transcript Store
    this.transcription.on('transcript', (entry) => {
      this.transcript.push(entry);
      this._emitEvent('transcript', entry);
      this.questionDetector.process(entry);
    });

    this.transcription.on('status', (status) => {
      this._emitEvent('transcription_status', status);
    });

    this.transcription.on('transcription_error', (err) => {
      console.warn('[meeting] Transcription chunk error:', err.stream, err.error);
      this._emitEvent('transcription_error', err);
    });

    // Safety net — prevent unhandled 'error' events from crashing Node.js
    this.transcription.on('error', (err) => {
      console.error('[meeting] Transcription error:', err);
      this._emitEvent('transcription_error', { stream: 'unknown', error: String(err) });
    });

    this.questionDetector.on('detection_error', (err) => {
      console.warn('[meeting] Question detection error:', err?.message || err);
      this._emitEvent('detection_error', { error: String(err?.message || err) });
    });

    // Safety net for question detector
    this.questionDetector.on('error', (err) => {
      console.error('[meeting] Question detector error:', err);
      this._emitEvent('detection_error', { error: String(err?.message || err) });
    });

    // Question Detector → Answer Engine
    this.questionDetector.on('detected', async (detection) => {
      this._emitEvent('question_detected', detection);
      try {
        const answer = await this.answerEngine.generateAnswer(detection);
        if (answer) this.suggestions.push(answer); // null if cancelled/aborted
      } catch (err) {
        this._emitEvent('answer_error', { error: String(err?.message || err) });
      }
    });

    // Answer Engine → Events
    this.answerEngine.on('answer_start', (data) => this._emitEvent('answer_start', data));
    this.answerEngine.on('answer_ttft', (data) => this._emitEvent('answer_ttft', data));
    this.answerEngine.on('answer_delta', (data) => this._emitEvent('answer_delta', data));
    this.answerEngine.on('answer_complete', (data) => this._emitEvent('answer_complete', data));
    this.answerEngine.on('answer_error', (data) => this._emitEvent('answer_error', data));
    this.answerEngine.on('status', (data) => this._emitEvent('engine_status', data));

    // Safety net for answer engine
    this.answerEngine.on('error', (err) => {
      console.error('[meeting] Answer engine error:', err);
      this._emitEvent('answer_error', { error: String(err?.message || err) });
    });
  }

  /**
   * Prepare for a meeting — generate or load the briefing.
   * @param {object} [options]
   * @param {function} [options.onProgress] - Progress callback
   * @returns {Promise<{briefing: string, tokens: number}>}
   */
  async prepare(options = {}) {
    this._setState('preparing');

    try {
      let briefing;
      let tokens;
      let cached = false;

      if (this.projectDir) {
        // Fast context loader — reads files, caches to disk, no LLM call
        const result = await generateBriefing({
          projectDir: this.projectDir,
          agentName: this.agentName,
          onProgress: (p) => {
            this._emitEvent('prepare_progress', p);
            if (options.onProgress) options.onProgress(p);
          }
        });
        briefing = result.briefing;
        tokens = result.tokens;
        cached = result.cached;
      }

      if (!briefing) {
        // No project context — use a generic MCS consultant briefing
        briefing = 'You are an MCS solutioning consultant. Answer questions about Microsoft Copilot Studio capabilities, connectors, topics, knowledge sources, and agent architecture patterns.';
        tokens = estimateTokenCount(briefing);
      }

      // Load context into answer engine
      this.answerEngine.loadBriefing(briefing);

      // Initialize whisper
      await this.transcription.initialize((p) => {
        this._emitEvent('model_download', p);
      });

      this._setState('ready');
      return { briefing, tokens, cached };
    } catch (err) {
      this._setState('idle');
      throw err;
    }
  }

  /**
   * Start the meeting — begin audio capture and transcription.
   * @returns {Promise<void>}
   */
  async start() {
    if (this.state !== 'ready') {
      throw new Error(`Cannot start meeting in state: ${this.state}. Call prepare() first.`);
    }

    this._setState('capturing');
    this.startedAt = Date.now();

    try {
      // Start transcription processing first
      this.transcription.start();

      // Start audio capture (native-audio-node WASAPI)
      await this.audioBridge.start();
      this._setState('active');

      this._emitEvent('started', { id: this.id, startedAt: this.startedAt });
    } catch (err) {
      // Clean up transcription if audio failed to start
      try { await this.transcription.stop(); } catch {}
      this._setState('ready'); // Allow retry
      throw err;
    }
  }

  /**
   * Stop the meeting — disconnect audio, finalize transcript.
   * @returns {object} Meeting summary data
   */
  async stop() {
    // Guard: only stop from active/capturing states — preparing/ready have nothing to tear down
    if (this.state === 'stopped' || this.state === 'idle') return this._buildSummary();
    if (this.state === 'preparing' || this.state === 'ready') {
      this._setState('idle');
      return this._buildSummary();
    }

    this.stoppedAt = Date.now();
    this._setState('stopped');

    // Stop audio first (prevents new data flowing to transcription)
    try { await this.audioBridge.stop(); } catch (err) {
      console.error('[meeting] Audio stop error:', err.message);
    }

    // Then stop transcription (waits for in-flight inference)
    try { await this.transcription.stop(); } catch (err) {
      console.error('[meeting] Transcription stop error:', err.message);
    }

    // Cancel any in-flight answer generation and clean up question detector timers
    try { this.answerEngine.cancelAnswer(); } catch {}
    try { this.questionDetector.destroy(); } catch {}

    const summary = this._buildSummary();
    this._emitEvent('stopped', summary);
    return summary;
  }

  _buildSummary() {
    return {
      id: this.id,
      projectId: this.projectId,
      startedAt: this.startedAt,
      stoppedAt: this.stoppedAt,
      durationMs: this.startedAt ? (this.stoppedAt || Date.now()) - this.startedAt : 0,
      transcript: this.transcript,
      suggestions: this.suggestions,
      stats: this.getStats()
    };
  }

  /**
   * Update answer model at runtime.
   * @param {string} model - Model name (e.g. 'gpt-5.4', 'haiku', 'sonnet', 'opus')
   */
  setAnswerModel(model) {
    this.answerEngine.setModel(model);
  }

  /**
   * Get the full transcript so far.
   */
  getTranscript() {
    return [...this.transcript];
  }

  /**
   * Get all answer suggestions so far.
   */
  getSuggestions() {
    return [...this.suggestions];
  }

  /**
   * Get comprehensive stats.
   */
  getStats() {
    return {
      session: {
        id: this.id,
        state: this.state,
        durationMs: this.startedAt ? (this.stoppedAt || Date.now()) - this.startedAt : 0
      },
      audio: this.audioBridge.getStats(),
      transcription: this.transcription.getStats(),
      questions: this.questionDetector.getStats(),
      answers: this.answerEngine.getStats()
    };
  }

  _setState(newState) {
    const oldState = this.state;
    this.state = newState;
    this._emitEvent('state_change', { from: oldState, to: newState });
  }

  _emitEvent(type, data = {}) {
    this.emit('event', { type, timestamp: Date.now(), ...data });
    this.emit(type, data);
  }
}

module.exports = { MeetingSession };
