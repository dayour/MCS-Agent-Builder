/**
 * Real-Time Transcription Service
 *
 * Wraps @fugood/whisper.node for real-time meeting transcription.
 * Handles two audio streams (system = customer, mic = Kim) with
 * a single shared whisper context.
 *
 * Features:
 *   - Vulkan GPU acceleration (Intel Arc / NVIDIA / AMD — 33x faster than CPU)
 *   - 2.5-second chunking for low-latency real-time transcription
 *   - RMS silence detection (instant, replaces Silero VAD which was too slow on CPU)
 *   - Cross-channel echo suppression (Jaccard word similarity)
 *   - Single whisper context, serialized inference queue with backpressure
 *   - Staggered mic processing (250ms offset to reduce GPU contention)
 *   - Inference timeout guard (15s max per chunk)
 *   - Graceful fallback: Vulkan GPU → CPU (auto-detected)
 *
 * Performance (Intel Arc 140V, base.en, 2.5s audio):
 *   - Vulkan GPU: ~117ms inference → 2.6s total latency
 *   - CPU fallback: ~2.7s inference → 5.2s total latency
 *
 * Audio input: 16kHz, 16-bit signed integer, mono PCM
 * Output: TranscriptEntry events via EventEmitter
 */

const EventEmitter = require('events');
const { ensureModel, getBestAvailable } = require('../../../tools/whisper-models/model-manager');

// Audio constants
const SAMPLE_RATE = 16000;
const BYTES_PER_SAMPLE = 2; // 16-bit
const CHUNK_DURATION_SEC = 2.5; // 2.5s chunks — optimal for GPU real-time (~100ms inference)
const CHUNK_SIZE = SAMPLE_RATE * BYTES_PER_SAMPLE * CHUNK_DURATION_SEC;
const SILENCE_RMS_THRESHOLD = 200; // Fallback RMS if VAD not available

// Echo suppression
const ECHO_WINDOW_MS = 5000;     // Compare mic text against system text from last 5s
const ECHO_SIMILARITY_THRESHOLD = 0.55; // Suppress mic text if >55% word overlap with system

/**
 * @typedef {Object} TranscriptEntry
 * @property {string} speaker - 'customer' or 'kim'
 * @property {string} text - Transcribed text
 * @property {number} timestamp - Unix timestamp (ms)
 * @property {number} duration - Audio chunk duration (ms)
 * @property {boolean} final - Whether this is a finalized segment
 * @property {number} [processingTime] - Inference time in ms
 */

class TranscriptionService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.modelName = options.model || 'base.en';
    this.useGpu = options.useGpu !== false; // Default: try GPU
    this.whisperContext = null;
    this.isRunning = false;
    this._disposed = false;
    this._initPromise = null; // Concurrency guard for initialize()

    // Buffers for each stream
    this.buffers = {
      system: Buffer.alloc(0),
      mic: Buffer.alloc(0)
    };

    // Serialized inference queue (one whisper call at a time, capped to prevent unbounded growth)
    this._queue = [];
    this._processing = false;
    this._activeInference = null; // Track in-flight inference for cancellation
    this._maxQueueSize = 10; // Drop oldest if queue exceeds this

    // Recent transcriptions for echo suppression
    this._recentSystem = []; // [{text, timestamp}]

    // Stagger timer for mic (offset by 250ms from system)
    this._micStaggerTimer = null;

    this.stats = {
      chunksProcessed: 0,
      silenceSkipped: 0,
      echoSuppressed: 0,
      queueDropped: 0,
      totalDurationMs: 0,
      totalInferenceMs: 0,
      errors: 0,
      gpuEnabled: false
    };
  }

  /**
   * Initialize whisper model. Downloads if needed.
   * Concurrency-safe: multiple calls return the same promise.
   * @param {function} [onProgress] - Model download progress callback
   */
  async initialize(onProgress) {
    if (this.whisperContext) return;
    // Concurrency guard: reuse in-flight init promise
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._doInitialize(onProgress);
    try {
      await this._initPromise;
    } finally {
      this._initPromise = null;
    }
  }

  async _doInitialize(onProgress) {
    // Ensure whisper model is available
    let modelPath;
    try {
      modelPath = await ensureModel(this.modelName, { onProgress });
    } catch {
      // Fallback: try whatever is available locally
      const best = getBestAvailable();
      if (best) {
        modelPath = best.path;
        this.modelName = best.name;
        this.emit('status', { type: 'model_fallback', model: this.modelName });
      } else {
        throw new Error('No whisper model available. Run: node tools/whisper-models/model-manager.js download');
      }
    }

    this.emit('status', { type: 'model_loading', model: this.modelName, path: modelPath });

    const { initWhisper, loadWhisperModule } = require('@fugood/whisper.node');

    // Try Vulkan GPU first, fall back to CPU
    if (this.useGpu) {
      try {
        // Pre-load Vulkan module BEFORE initWhisper — the module cache is global
        // and variant-unaware, so the first loadWhisperModule() call wins.
        await loadWhisperModule('vulkan');
        this.whisperContext = await initWhisper({
          filePath: modelPath,
          useGpu: true
        });
        this.stats.gpuEnabled = true;
        this.emit('status', { type: 'gpu_enabled', backend: 'vulkan' });
      } catch (gpuErr) {
        this.emit('status', { type: 'gpu_fallback', error: gpuErr.message, message: 'Falling back to CPU' });
        this.whisperContext = await initWhisper({
          filePath: modelPath,
          useGpu: false
        });
      }
    } else {
      this.whisperContext = await initWhisper({
        filePath: modelPath,
        useGpu: false
      });
    }

    this.emit('status', { type: 'model_loaded', model: this.modelName, gpu: this.stats.gpuEnabled });
    this.emit('status', { type: 'ready' });
  }

  /**
   * Start processing audio.
   */
  start() {
    if (!this.whisperContext) {
      throw new Error('TranscriptionService not initialized. Call initialize() first.');
    }
    this.isRunning = true;
    this.emit('status', { type: 'started' });
  }

  /**
   * Stop processing audio. Flushes remaining buffers before emitting stopped.
   */
  async stop() {
    this.isRunning = false;
    if (this._micStaggerTimer) {
      clearTimeout(this._micStaggerTimer);
      this._micStaggerTimer = null;
    }

    // Flush remaining audio (transcribe partial chunks before stopping)
    try {
      await this._flushBuffers();
    } catch {
      // Best-effort flush — don't fail stop on flush errors
    }

    // Cancel any in-flight inference
    if (this._activeInference) {
      try { await this._activeInference.stop(); } catch {}
    }

    // Wait for processing to finish (max 15s to match inference timeout)
    let waitCount = 0;
    while (this._processing && waitCount < 150) {
      await new Promise(r => setTimeout(r, 100));
      waitCount++;
    }

    this._queue = [];
    this.emit('status', { type: 'stopped', stats: this.getStats() });
  }

  /**
   * Feed PCM audio data into the transcription pipeline.
   * @param {Buffer} pcmData - 16kHz, 16-bit signed, mono PCM
   * @param {'system'|'mic'} stream - Which stream this data belongs to
   */
  feedAudio(pcmData, stream) {
    if (!this.isRunning || this._disposed) return;
    if (stream !== 'system' && stream !== 'mic') return;

    this.buffers[stream] = Buffer.concat([this.buffers[stream], pcmData]);

    // Process when we have enough data
    if (this.buffers[stream].length >= CHUNK_SIZE) {
      if (stream === 'system') {
        // Drain all ready system chunks (not just one)
        while (this.buffers.system.length >= CHUNK_SIZE) {
          this._enqueueChunk('system');
        }
      } else {
        // Stagger mic processing by 250ms to reduce GPU contention
        if (!this._micStaggerTimer) {
          this._micStaggerTimer = setTimeout(() => {
            this._micStaggerTimer = null;
            if (this._disposed) return;
            // Drain all ready mic chunks
            while (this.buffers.mic.length >= CHUNK_SIZE) {
              this._enqueueChunk('mic');
            }
          }, 250);
        }
      }
    }
  }

  /**
   * Extract a chunk from the buffer and add to inference queue.
   * Drops oldest chunks if queue is full (backpressure).
   * @param {'system'|'mic'} stream
   */
  _enqueueChunk(stream) {
    const chunk = this.buffers[stream].subarray(0, CHUNK_SIZE);
    this.buffers[stream] = this.buffers[stream].subarray(CHUNK_SIZE);

    // Backpressure: if queue is full, drop oldest chunk
    if (this._queue.length >= this._maxQueueSize) {
      this._queue.shift();
      this.stats.queueDropped++;
    }

    this._queue.push({ stream, chunk: Buffer.from(chunk), timestamp: Date.now() });
    this._drainQueue();
  }

  /**
   * Process the inference queue one job at a time.
   */
  async _drainQueue() {
    if (this._processing || this._queue.length === 0 || this._disposed) return;
    this._processing = true;

    while (this._queue.length > 0 && !this._disposed) {
      const job = this._queue.shift();
      try {
        await this._processChunk(job.stream, job.chunk, job.timestamp);
      } catch (err) {
        this.stats.errors++;
        // Use 'transcription_error' (not 'error') — Node.js crashes on unhandled 'error' events
        this.emit('transcription_error', { stream: job.stream, error: err.message });
      }
    }

    this._processing = false;
  }

  /**
   * Process a single audio chunk through RMS detection + Whisper.
   * @param {'system'|'mic'} stream
   * @param {Buffer} chunk - Int16 PCM buffer
   * @param {number} timestamp
   */
  async _processChunk(stream, chunk, timestamp) {
    if (this._disposed) return;

    // Step 1: Check for speech via RMS threshold
    const hasSpeech = this._detectSpeech(chunk);
    if (!hasSpeech) {
      this.stats.silenceSkipped++;
      return;
    }

    // Step 2: Get ArrayBuffer from Int16 PCM chunk
    const arrayBuf = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);

    // Step 3: Transcribe
    const startTime = Date.now();
    const { promise, stop } = this.whisperContext.transcribeData(arrayBuf, {
      language: 'en',
      translate: false,
      maxThreads: this.stats.gpuEnabled ? 4 : 8
    });

    // Track active inference for cancellation during shutdown
    this._activeInference = { promise, stop };

    // Timeout guard — 15s is generous (GPU: ~100ms, CPU: ~3s for 2.5s audio)
    const INFERENCE_TIMEOUT_MS = 15000;
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(async () => {
        try { await stop(); } catch {}
        reject(new Error(`Transcription timeout after ${INFERENCE_TIMEOUT_MS}ms`));
      }, INFERENCE_TIMEOUT_MS);
    });

    let result;
    try {
      result = await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
      this._activeInference = null;
    }
    if (this._disposed) return;
    const processingTime = Date.now() - startTime;
    this.stats.totalInferenceMs += processingTime;
    this.stats.inferenceCount = (this.stats.inferenceCount || 0) + 1;

    // Step 4: Extract text
    const text = (result.segments || [])
      .map(s => s.text?.trim())
      .filter(t => t && t.length > 0)
      .join(' ')
      .trim();

    if (!text || text.length < 3) return;

    // Step 5: Echo suppression for mic channel
    if (stream === 'mic' && this._isEcho(text, timestamp)) {
      this.stats.echoSuppressed++;
      return;
    }

    // Step 6: Store for echo detection and emit
    const entry = {
      speaker: stream === 'mic' ? 'kim' : 'customer',
      text,
      timestamp,
      duration: CHUNK_DURATION_SEC * 1000,
      final: true,
      processingTime
    };

    // Track system transcriptions for echo suppression (mic echoes system audio)
    if (stream === 'system') {
      this._recentSystem.push({ text, timestamp });
      // Prune old entries
      const cutoff = Date.now() - ECHO_WINDOW_MS;
      while (this._recentSystem.length > 0 && this._recentSystem[0].timestamp < cutoff) {
        this._recentSystem.shift();
      }
    }

    this.emit('transcript', entry);
    this.stats.chunksProcessed++;
    this.stats.totalDurationMs += CHUNK_DURATION_SEC * 1000;
  }

  /**
   * Detect if a chunk contains speech using RMS threshold.
   * @param {Buffer} int16Chunk
   * @returns {boolean}
   */
  _detectSpeech(int16Chunk) {
    // Use fast RMS-based silence detection
    // Silero VAD is too slow on CPU (~1-12s per call, gets progressively slower)
    // RMS detection is instant and sufficient for filtering silence chunks
    return this._calculateRMS(int16Chunk) >= SILENCE_RMS_THRESHOLD;
  }

  /**
   * Check if mic text is an echo of recent system audio.
   * Uses Jaccard word similarity between mic text and recent system transcriptions.
   * @param {string} micText
   * @param {number} timestamp
   * @returns {boolean}
   */
  _isEcho(micText, timestamp) {
    if (this._recentSystem.length === 0) return false;

    const micWords = new Set(micText.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2));
    if (micWords.size === 0) return false;

    // Check against all recent system transcriptions within window
    const cutoff = timestamp - ECHO_WINDOW_MS;
    for (const sys of this._recentSystem) {
      if (sys.timestamp < cutoff) continue;

      const sysWords = new Set(sys.text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2));
      if (sysWords.size === 0) continue;

      // Jaccard similarity
      let intersection = 0;
      for (const word of micWords) {
        if (sysWords.has(word)) intersection++;
      }
      const union = new Set([...micWords, ...sysWords]).size;
      const similarity = union > 0 ? intersection / union : 0;

      if (similarity >= ECHO_SIMILARITY_THRESHOLD) {
        return true;
      }
    }

    return false;
  }

  /**
   * Flush remaining audio in buffers (on stop).
   */
  async _flushBuffers() {
    for (const stream of ['system', 'mic']) {
      // Process if at least 1 second of audio remains
      if (this.buffers[stream].length >= SAMPLE_RATE * BYTES_PER_SAMPLE) {
        const padded = Buffer.alloc(CHUNK_SIZE);
        this.buffers[stream].copy(padded, 0, 0, Math.min(this.buffers[stream].length, CHUNK_SIZE));
        this._queue.push({ stream, chunk: padded, timestamp: Date.now() });
      }
      this.buffers[stream] = Buffer.alloc(0);
    }
    // Drain remaining queue before returning
    if (this._queue.length > 0) {
      await this._drainQueue();
    }
  }

  /**
   * Calculate RMS of Int16 PCM audio.
   * @param {Buffer} pcmBuffer
   * @returns {number}
   */
  _calculateRMS(pcmBuffer) {
    if (pcmBuffer.length < 2) return 0;
    let sum = 0;
    const samples = pcmBuffer.length / 2;
    for (let i = 0; i < pcmBuffer.length; i += 2) {
      const sample = pcmBuffer.readInt16LE(i);
      sum += sample * sample;
    }
    return Math.sqrt(sum / samples);
  }

  /**
   * Release model resources. Cancels in-flight inference and cleans up timers.
   */
  async dispose() {
    this._disposed = true;
    this.isRunning = false;
    this._queue = [];

    // Clear timers
    if (this._micStaggerTimer) {
      clearTimeout(this._micStaggerTimer);
      this._micStaggerTimer = null;
    }

    // Clear buffers
    this.buffers.system = Buffer.alloc(0);
    this.buffers.mic = Buffer.alloc(0);

    // Cancel in-flight inference
    if (this._activeInference) {
      try { await this._activeInference.stop(); } catch {}
      this._activeInference = null;
    }

    // Wait for processing to finish (max 5s — inference was cancelled above)
    let waitCount = 0;
    while (this._processing && waitCount < 50) {
      await new Promise(r => setTimeout(r, 100));
      waitCount++;
    }

    if (this.whisperContext) {
      try { await this.whisperContext.release(); } catch {}
      this.whisperContext = null;
    }
  }

  /**
   * Get current stats.
   */
  getStats() {
    const inferenceCount = this.stats.inferenceCount || 0;
    return {
      ...this.stats,
      avgInferenceMs: inferenceCount > 0
        ? Math.round(this.stats.totalInferenceMs / inferenceCount)
        : 0,
      chunkDurationSec: CHUNK_DURATION_SEC
    };
  }
}

module.exports = { TranscriptionService };
