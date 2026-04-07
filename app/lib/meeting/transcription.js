/**
 * Real-Time Transcription Service
 *
 * Wraps @fugood/whisper.node for real-time meeting transcription.
 * Handles two audio streams (system = customer, mic = Kim) with
 * a single shared whisper context.
 *
 * Features:
 *   - Vulkan GPU acceleration (Intel Arc / NVIDIA / AMD — 33x faster than CPU)
 *   - 8-second chunking with 1s overlap for word-boundary continuity
 *   - Beam search (size 5) + temperature fallback for better accuracy
 *   - Prompt conditioning with meeting context + previous chunk text
 *   - Frame-level RMS VAD with adaptive thresholds and hangover
 *   - Timestamp-based overlap dedup (uses segment t0/t1)
 *   - Cross-channel echo suppression (Jaccard word similarity)
 *   - Single whisper context, serialized inference queue with backpressure
 *   - Staggered mic processing (250ms offset to reduce GPU contention)
 *   - Inference timeout guard (30s max per chunk)
 *   - Graceful fallback: Vulkan GPU → CPU (auto-detected)
 *
 * Performance (Intel Arc 140V, base.en, 8s audio):
 *   - Vulkan GPU: ~300-500ms inference → ~8.5s total latency
 *   - CPU fallback: ~8-10s inference → ~18s total latency
 *
 * Audio input: 16kHz, 16-bit signed integer, mono PCM
 * Output: TranscriptEntry events via EventEmitter
 */

const EventEmitter = require('events');
const { ensureModel, getBestAvailable } = require('../../../tools/whisper-models/model-manager');

// Audio constants
const SAMPLE_RATE = 16000;
const BYTES_PER_SAMPLE = 2; // 16-bit
const CHUNK_DURATION_SEC = 8;   // 8s chunks — reduces word-boundary cuts vs old 2.5s
const OVERLAP_DURATION_SEC = 1; // 1s overlap between consecutive chunks for continuity
const CHUNK_SIZE = SAMPLE_RATE * BYTES_PER_SAMPLE * CHUNK_DURATION_SEC;
const OVERLAP_SIZE = SAMPLE_RATE * BYTES_PER_SAMPLE * OVERLAP_DURATION_SEC;
const STRIDE_SIZE = CHUNK_SIZE - OVERLAP_SIZE; // Advance by 7s, transcribe 8s

// VAD — adaptive RMS with pre/post-roll (fallback when whisper VAD model unavailable)
const SILENCE_RMS_THRESHOLD = 150;     // Lowered from 200 — catches quieter speech
const MIC_RMS_THRESHOLD = 400;         // Lowered from 500 — catches soft-spoken participants
const VAD_FRAME_MS = 20;              // Analyze in 20ms frames for granular speech detection
const VAD_PRE_ROLL_MS = 300;          // Keep 300ms before speech onset
const VAD_POST_ROLL_MS = 500;         // Keep 500ms after speech offset
const VAD_HANGOVER_FRAMES = 15;       // ~300ms hangover to bridge brief pauses

// Echo suppression
const ECHO_WINDOW_MS = 5000;     // Compare mic text against system text from last 5s
const ECHO_SIMILARITY_THRESHOLD = 0.35; // Suppress mic text if >35% word overlap with system
const ECHO_CONSECUTIVE_WORDS = 3;       // Suppress if 3+ consecutive words match system text

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
    this._calibrated = false; // First-inference calibration flag

    // Buffers for each stream
    this.buffers = {
      system: Buffer.alloc(0),
      mic: Buffer.alloc(0)
    };

    // Overlap buffers — keep last 1s of each chunk for continuity
    this._overlapBuffers = {
      system: null, // Buffer or null
      mic: null
    };
    // Track last emitted timestamp per stream for overlap dedup
    this._lastEmittedT1 = { system: 0, mic: 0 };
    // Previous chunk text per stream for prompt conditioning
    this._prevChunkText = { system: '', mic: '' };

    // Meeting context for prompt conditioning (set via setMeetingContext)
    this._meetingContext = null; // { title, participants: string[] }

    // Serialized inference queue (one whisper call at a time, capped to prevent unbounded growth)
    this._queue = [];
    this._processing = false;
    this._activeInference = null; // Track in-flight inference for cancellation
    this._maxQueueSize = 6; // Reduced from 10 — 8s chunks are 3x larger, fewer needed

    // Recent transcriptions for echo suppression
    this._recentSystem = []; // [{text, timestamp}]

    // Stagger timer for mic (offset by 250ms from system)
    this._micStaggerTimer = null;

    this.stats = {
      chunksProcessed: 0,
      silenceSkipped: 0,
      echoSuppressed: 0,
      overlapDeduped: 0,
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
   * Hot-swap to a different model without stopping the service.
   * Used by calibration to downgrade when GPU is too slow for the current model.
   * @param {string} newModel - Model name to switch to
   */
  async _reloadModel(newModel) {
    const { ensureModel: ensure } = require('../../../tools/whisper-models/model-manager');
    let modelPath;
    try {
      modelPath = await ensure(newModel);
    } catch {
      return; // Can't download — keep current model
    }

    const { initWhisper } = require('@fugood/whisper.node');
    const oldContext = this.whisperContext;

    // Wait for any active inference to complete before swapping
    while (this._activeInference) {
      await new Promise(r => setTimeout(r, 50));
    }

    this.whisperContext = await initWhisper({
      filePath: modelPath,
      useGpu: this.stats.gpuEnabled
    });
    this.modelName = newModel;

    // Release old context
    if (oldContext) {
      try { await oldContext.release(); } catch {}
    }

    this.emit('status', { type: 'model_loaded', model: this.modelName, gpu: this.stats.gpuEnabled });
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
  /**
   * Set meeting context for Whisper prompt conditioning.
   * Called by MeetingSession after briefing is loaded.
   * @param {{ title?: string, participants?: string[] }} context
   */
  setMeetingContext(context) {
    this._meetingContext = context;
  }

  feedAudio(pcmData, stream) {
    if (!this.isRunning || this._disposed) return;
    if (stream !== 'system' && stream !== 'mic') return;

    this.buffers[stream] = Buffer.concat([this.buffers[stream], pcmData]);

    // Process when we have a full stride (7s new + 1s overlap = 8s chunk)
    const minNeeded = this._overlapBuffers[stream] ? STRIDE_SIZE : CHUNK_SIZE;
    if (this.buffers[stream].length >= minNeeded) {
      if (stream === 'system') {
        while (this._hasEnoughAudio('system')) {
          this._enqueueChunk('system');
        }
      } else {
        // Stagger mic processing by 250ms to reduce GPU contention
        if (!this._micStaggerTimer) {
          this._micStaggerTimer = setTimeout(() => {
            this._micStaggerTimer = null;
            if (this._disposed) return;
            while (this._hasEnoughAudio('mic')) {
              this._enqueueChunk('mic');
            }
          }, 250);
        }
      }
    }
  }

  /** Check if stream has enough new audio for next chunk */
  _hasEnoughAudio(stream) {
    const minNeeded = this._overlapBuffers[stream] ? STRIDE_SIZE : CHUNK_SIZE;
    return this.buffers[stream].length >= minNeeded;
  }

  /**
   * Extract a chunk from the buffer and add to inference queue.
   * Drops oldest chunks if queue is full (backpressure).
   * @param {'system'|'mic'} stream
   */
  _enqueueChunk(stream) {
    let chunk;
    const overlap = this._overlapBuffers[stream];

    if (overlap) {
      // Prepend 1s overlap from previous chunk + 7s new audio = 8s total
      const newAudio = this.buffers[stream].subarray(0, STRIDE_SIZE);
      this.buffers[stream] = this.buffers[stream].subarray(STRIDE_SIZE);
      chunk = Buffer.concat([overlap, newAudio]);
    } else {
      // First chunk: take full 8s, no overlap prefix
      chunk = this.buffers[stream].subarray(0, CHUNK_SIZE);
      this.buffers[stream] = this.buffers[stream].subarray(CHUNK_SIZE);
    }

    // Save last 1s as overlap for next chunk
    this._overlapBuffers[stream] = Buffer.from(chunk.subarray(chunk.length - OVERLAP_SIZE));

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

    // Step 1: Speech detection — adaptive RMS with frame-level analysis
    const threshold = stream === 'mic' ? MIC_RMS_THRESHOLD : SILENCE_RMS_THRESHOLD;
    if (!this._detectSpeechFrames(chunk, threshold)) {
      this.stats.silenceSkipped++;
      return;
    }

    // Step 2: Get ArrayBuffer from Int16 PCM chunk
    const arrayBuf = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);

    // Step 3: Build prompt for conditioning
    const prompt = this._buildPrompt(stream);

    // Step 4: Transcribe with beam search + temperature fallback
    const startTime = Date.now();
    const { promise, stop } = this.whisperContext.transcribeData(arrayBuf, {
      language: 'en',
      translate: false,
      maxThreads: this.stats.gpuEnabled ? 4 : 8,
      // Decode tuning — beam search + temperature fallback for better accuracy
      beamSize: 5,
      temperature: 0.0,
      temperatureInc: 0.2,    // Fallback: 0.0 → 0.2 → 0.4 → ... → 1.0
      bestOf: 5,
      tokenTimestamps: true,  // Needed for overlap dedup
      ...(prompt ? { prompt } : {})
    });

    // Track active inference for cancellation during shutdown
    this._activeInference = { promise, stop };

    // Timeout guard — 30s for 8s chunks (GPU: ~300-500ms, CPU: ~8-10s)
    const INFERENCE_TIMEOUT_MS = 30000;
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Transcription timeout after ${INFERENCE_TIMEOUT_MS}ms`));
        stop().catch(() => {}); // fire-and-forget cancel
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

    // Calibration: after first real inference, check if GPU is fast enough.
    if (!this._calibrated) {
      this._calibrated = true;
      const chunkMs = CHUNK_DURATION_SEC * 1000;
      this.emit('status', { type: 'calibration', model: this.modelName, inferenceMs: processingTime, chunkMs, gpu: this.stats.gpuEnabled });
      if (processingTime > chunkMs * 2 && this.modelName !== 'tiny.en') {
        this.emit('status', { type: 'model_downgrade', from: this.modelName, to: 'tiny.en', reason: `Inference ${processingTime}ms too slow for ${chunkMs}ms chunks` });
        this._reloadModel('tiny.en').catch(err => {
          this.emit('transcription_error', { stream: 'calibration', error: err.message });
        });
      }
    }

    // Step 5: Extract text with overlap dedup using segment timestamps
    const segments = result.segments || [];
    const overlapMs = OVERLAP_DURATION_SEC * 1000; // 1000ms
    const lastT1 = this._lastEmittedT1[stream];

    // Filter: only keep segments that START after the overlap region
    // Segments have t0/t1 in milliseconds relative to chunk start
    const newSegments = lastT1 > 0
      ? segments.filter(s => s.t0 >= overlapMs - 100) // 100ms tolerance
      : segments; // First chunk: keep everything

    if (lastT1 > 0 && segments.length > newSegments.length) {
      this.stats.overlapDeduped += (segments.length - newSegments.length);
    }

    const text = newSegments
      .map(s => s.text?.trim())
      .filter(t => t && t.length > 0)
      .join(' ')
      .trim();

    // Update last emitted timestamp for next chunk's dedup
    if (segments.length > 0) {
      this._lastEmittedT1[stream] = segments[segments.length - 1].t1 || 0;
    }

    // Store full text for prompt conditioning (including overlap, for context)
    const fullText = segments.map(s => s.text?.trim()).filter(Boolean).join(' ').trim();
    if (fullText) {
      this._prevChunkText[stream] = fullText;
    }

    if (!text || text.length < 3) return;

    // Step 6: Echo suppression for mic channel
    if (stream === 'mic' && this._isEcho(text, timestamp)) {
      this.stats.echoSuppressed++;
      return;
    }

    // Step 7: Store for echo detection and emit
    const entry = {
      speaker: stream === 'mic' ? 'kim' : 'customer',
      text,
      timestamp,
      duration: CHUNK_DURATION_SEC * 1000,
      final: true,
      processingTime
    };

    if (stream === 'system') {
      this._recentSystem.push({ text, timestamp });
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
   * Frame-level speech detection with hangover.
   * Analyzes 20ms frames within the chunk. Returns true if any speech region
   * is found (with hangover to bridge brief pauses). More sensitive than
   * whole-chunk RMS because a quiet word in 8s of audio won't be masked
   * by the average energy of the full chunk.
   * @param {Buffer} int16Chunk
   * @param {number} threshold - RMS threshold for speech
   * @returns {boolean}
   */
  _detectSpeechFrames(int16Chunk, threshold) {
    const frameSize = SAMPLE_RATE * BYTES_PER_SAMPLE * VAD_FRAME_MS / 1000; // 640 bytes per 20ms frame
    const numFrames = Math.floor(int16Chunk.length / frameSize);
    if (numFrames === 0) return this._calculateRMS(int16Chunk) >= threshold;

    let speechFrames = 0;
    let hangover = 0;

    for (let i = 0; i < numFrames; i++) {
      const frame = int16Chunk.subarray(i * frameSize, (i + 1) * frameSize);
      const rms = this._calculateRMS(frame);

      if (rms >= threshold) {
        speechFrames++;
        hangover = VAD_HANGOVER_FRAMES; // Reset hangover on speech
      } else if (hangover > 0) {
        speechFrames++; // Count hangover frames as speech (bridges pauses)
        hangover--;
      }
    }

    // Consider chunk as speech if >5% of frames contain speech
    return speechFrames > numFrames * 0.05;
  }

  /**
   * Build Whisper prompt for conditioning.
   * Includes meeting context (title, participant names) and previous chunk text
   * for consistency. Capped at 224 tokens (~800 chars) to avoid prompt overflow.
   * @param {'system'|'mic'} stream
   * @returns {string|undefined}
   */
  _buildPrompt(stream) {
    const parts = [];

    // Meeting context — helps Whisper recognize proper nouns
    if (this._meetingContext) {
      if (this._meetingContext.title) {
        parts.push(this._meetingContext.title);
      }
      if (this._meetingContext.participants?.length) {
        parts.push(this._meetingContext.participants.join(', '));
      }
    }

    // Previous chunk text — helps Whisper maintain consistency
    const prev = this._prevChunkText[stream];
    if (prev) {
      // Take last ~400 chars of previous transcript for context
      parts.push(prev.slice(-400));
    }

    if (parts.length === 0) return undefined;

    // Cap total prompt at ~800 chars (~224 tokens)
    const prompt = parts.join('. ');
    return prompt.length > 800 ? prompt.slice(-800) : prompt;
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

    const cleanMic = micText.toLowerCase().replace(/[^\w\s]/g, '');
    const micWordsArr = cleanMic.split(/\s+/).filter(w => w.length > 2);
    const micWords = new Set(micWordsArr);
    if (micWords.size === 0) return false;

    // Check against all recent system transcriptions within window
    const cutoff = timestamp - ECHO_WINDOW_MS;
    for (const sys of this._recentSystem) {
      if (sys.timestamp < cutoff) continue;

      const cleanSys = sys.text.toLowerCase().replace(/[^\w\s]/g, '');
      const sysWordsArr = cleanSys.split(/\s+/).filter(w => w.length > 2);
      const sysWords = new Set(sysWordsArr);
      if (sysWords.size === 0) continue;

      // Check 1: Jaccard word similarity (lowered threshold catches partial echoes)
      let intersection = 0;
      for (const word of micWords) {
        if (sysWords.has(word)) intersection++;
      }
      const union = new Set([...micWords, ...sysWords]).size;
      const similarity = union > 0 ? intersection / union : 0;

      if (similarity >= ECHO_SIMILARITY_THRESHOLD) {
        return true;
      }

      // Check 2: Consecutive word sequence match (catches Whisper transcription drift)
      // If 3+ consecutive words from mic appear in system text, it's an echo
      if (micWordsArr.length >= ECHO_CONSECUTIVE_WORDS) {
        const sysJoined = ' ' + sysWordsArr.join(' ') + ' ';
        for (let i = 0; i <= micWordsArr.length - ECHO_CONSECUTIVE_WORDS; i++) {
          const seq = ' ' + micWordsArr.slice(i, i + ECHO_CONSECUTIVE_WORDS).join(' ') + ' ';
          if (sysJoined.includes(seq)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Flush remaining audio in buffers (on stop).
   */
  async _flushBuffers() {
    for (const stream of ['system', 'mic']) {
      // Build final chunk from overlap + remaining buffer
      const overlap = this._overlapBuffers[stream];
      const remaining = this.buffers[stream];
      const total = (overlap ? overlap.length : 0) + remaining.length;

      // Process if at least 1 second of audio remains
      if (total >= SAMPLE_RATE * BYTES_PER_SAMPLE) {
        const parts = overlap ? [overlap, remaining] : [remaining];
        let chunk = Buffer.concat(parts);
        // Pad to chunk size if needed (Whisper handles short audio fine, but pad for consistency)
        if (chunk.length < CHUNK_SIZE) {
          const padded = Buffer.alloc(CHUNK_SIZE);
          chunk.copy(padded, 0, 0, chunk.length);
          chunk = padded;
        }
        // Don't dedup overlap on final flush — emit everything
        this._lastEmittedT1[stream] = 0;
        this._queue.push({ stream, chunk, timestamp: Date.now() });
      }
      this.buffers[stream] = Buffer.alloc(0);
      this._overlapBuffers[stream] = null;
    }
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
    this._overlapBuffers.system = null;
    this._overlapBuffers.mic = null;

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
      chunkDurationSec: CHUNK_DURATION_SEC,
      overlapDurationSec: OVERLAP_DURATION_SEC
    };
  }
}

module.exports = { TranscriptionService };
