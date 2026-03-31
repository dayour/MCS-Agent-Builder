/**
 * Audio Bridge — Native WASAPI capture for meeting co-pilot
 *
 * Uses native-audio-node for dual-stream audio capture:
 *   - SystemAudioRecorder: captures Teams.exe audio (customer voice)
 *   - MicrophoneRecorder: captures microphone (Kim's voice)
 *
 * Both output 16kHz, 16-bit mono PCM — ready for Whisper.
 *
 * Features:
 *   - Teams.exe process filtering (captures only Teams audio, not notifications)
 *   - Automatic device enumeration
 *   - Device change detection
 *   - Configurable chunk duration for latency tuning
 */

const EventEmitter = require('events');
const { execSync } = require('child_process');

// Lazy-load native-audio-node (has native bindings)
let nativeAudio = null;
function loadNativeAudio() {
  if (!nativeAudio) {
    nativeAudio = require('native-audio-node');
  }
  return nativeAudio;
}

const SAMPLE_RATE = 16000;
const CHUNK_DURATION_MS = 100; // 100ms chunks for low latency

class AudioBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    this.sampleRate = options.sampleRate || SAMPLE_RATE;
    this.chunkDurationMs = options.chunkDurationMs || CHUNK_DURATION_MS;
    this.deviceId = options.micDeviceId || null; // Specific mic device
    this.teamsPid = options.teamsPid || null;    // Teams.exe PID for process filtering
    this.autoFindTeams = options.autoFindTeams !== false;

    this._systemRecorder = null;
    this._micRecorder = null;
    this.isRunning = false;
    this._metadata = { system: null, mic: null };

    this.stats = {
      systemBytes: 0,
      micBytes: 0,
      systemChunks: 0,
      micChunks: 0,
      teamsPid: null,
      startedAt: null
    };
  }

  /**
   * Find the Teams.exe process ID.
   * @returns {number|null}
   */
  static findTeamsPid() {
    try {
      // Try ms-teams.exe first (new Teams), then Teams.exe (classic)
      const output = execSync(
        'tasklist /FI "IMAGENAME eq ms-teams.exe" /FO CSV /NH',
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      const match = output.match(/"ms-teams\.exe","(\d+)"/i);
      if (match) return parseInt(match[1], 10);

      // Fallback to classic Teams
      const output2 = execSync(
        'tasklist /FI "IMAGENAME eq Teams.exe" /FO CSV /NH',
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      const match2 = output2.match(/"Teams\.exe","(\d+)"/i);
      if (match2) return parseInt(match2[1], 10);
    } catch {
      // tasklist not available or failed
    }
    return null;
  }

  /**
   * List available audio devices.
   * @returns {Array<{id: string, name: string, isInput: boolean, isOutput: boolean}>}
   */
  static listDevices() {
    const { listAudioDevices } = loadNativeAudio();
    return listAudioDevices();
  }

  /**
   * Start audio capture on both streams.
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRunning) return;

    const audio = loadNativeAudio();

    // Find Teams PID for process filtering
    if (!this.teamsPid && this.autoFindTeams) {
      this.teamsPid = AudioBridge.findTeamsPid();
      if (this.teamsPid) {
        this.emit('status', { type: 'teams_found', pid: this.teamsPid });
      } else {
        this.emit('status', { type: 'teams_not_found', message: 'Capturing all system audio' });
      }
    }
    this.stats.teamsPid = this.teamsPid;

    // Create system audio recorder
    const systemOpts = {
      sampleRate: this.sampleRate,
      chunkDurationMs: this.chunkDurationMs,
      stereo: false,
      emitSilence: true // Continuous stream even during silence
    };

    // Filter to Teams.exe if found (Windows: single PID only)
    if (this.teamsPid) {
      systemOpts.includeProcesses = [this.teamsPid];
    }

    this._systemRecorder = new audio.SystemAudioRecorder(systemOpts);

    // Create microphone recorder
    const micOpts = {
      sampleRate: this.sampleRate,
      chunkDurationMs: this.chunkDurationMs,
      stereo: false,
      emitSilence: true,
      gain: 1.0
    };
    if (this.deviceId) {
      micOpts.deviceId = this.deviceId;
    }

    this._micRecorder = new audio.MicrophoneRecorder(micOpts);

    // Wire up data events (guard with isRunning to prevent post-stop emissions)
    this._systemRecorder.on('data', (chunk) => {
      if (!this.isRunning) return;
      const pcm = this._normalizePcm(chunk.data, 'system');
      this.stats.systemBytes += pcm.length;
      this.stats.systemChunks++;
      this.emit('audio', { stream: 'system', data: pcm });
    });

    this._micRecorder.on('data', (chunk) => {
      if (!this.isRunning) return;
      const pcm = this._normalizePcm(chunk.data, 'mic');
      this.stats.micBytes += pcm.length;
      this.stats.micChunks++;
      this.emit('audio', { stream: 'mic', data: pcm });
    });

    // Wire metadata events (format info — arrive before first data)
    this._systemRecorder.on('metadata', (meta) => {
      this._metadata.system = meta;
      this.emit('status', { type: 'system_format', ...meta });
    });

    this._micRecorder.on('metadata', (meta) => {
      this._metadata.mic = meta;
      this.emit('status', { type: 'mic_format', ...meta });
    });

    // Wire error events
    this._systemRecorder.on('error', (err) => {
      this.emit('error', { stream: 'system', message: err.message || String(err) });
    });
    this._micRecorder.on('error', (err) => {
      this.emit('error', { stream: 'mic', message: err.message || String(err) });
    });

    // Mark as running before starting — prevents early audio chunks from being dropped
    this.isRunning = true;
    this.stats.startedAt = Date.now();

    // Start both recorders — track which succeeded
    let systemStarted = false;
    let micStarted = false;
    const errors = [];

    try { await this._systemRecorder.start(); systemStarted = true; }
    catch (err) {
      errors.push(`system: ${err.message}`);
      // If process filtering failed, retry without PID filter
      if (this.teamsPid) {
        this.emit('status', { type: 'pid_filter_failed', pid: this.teamsPid, message: 'Falling back to all system audio' });
        this._systemRecorder.removeAllListeners();
        const fallbackOpts = { sampleRate: this.sampleRate, chunkDurationMs: this.chunkDurationMs, stereo: false, emitSilence: true };
        this._systemRecorder = new audio.SystemAudioRecorder(fallbackOpts);
        this._systemRecorder.on('data', (chunk) => {
          if (!this.isRunning) return;
          const pcm = this._normalizePcm(chunk.data, 'system');
          this.stats.systemBytes += pcm.length;
          this.stats.systemChunks++;
          this.emit('audio', { stream: 'system', data: pcm });
        });
        this._systemRecorder.on('metadata', (meta) => {
          this._metadata.system = meta;
          this.emit('status', { type: 'system_format', ...meta });
        });
        this._systemRecorder.on('error', (e) => { this.emit('error', { stream: 'system', message: e.message || String(e) }); });
        try { await this._systemRecorder.start(); systemStarted = true; errors.pop(); }
        catch (retryErr) { errors.push(`system fallback: ${retryErr.message}`); }
      }
    }

    try { await this._micRecorder.start(); micStarted = true; }
    catch (err) { errors.push(`mic: ${err.message}`); }

    if (!systemStarted && !micStarted) {
      this.isRunning = false;
      throw new Error(`Audio capture failed: ${errors.join('; ')}`);
    }

    if (errors.length > 0) {
      this.emit('error', { message: `Partial start: ${errors.join('; ')}` });
    }

    this.emit('connected', { system: systemStarted, mic: micStarted });
  }

  /**
   * Normalize PCM data to Int16 format expected by Whisper.
   * native-audio-node may output Float32 or Int16 depending on platform.
   * Detects format from metadata; if no metadata yet, auto-detects from
   * buffer size relative to expected sample count.
   *
   * @param {Buffer} data - Raw PCM data from native-audio-node
   * @param {'system'|'mic'} stream
   * @returns {Buffer} Int16 PCM buffer
   */
  _normalizePcm(data, stream) {
    const meta = this._metadata[stream];

    // Determine if data is Float32
    let isFloat32 = false;
    if (meta) {
      isFloat32 = meta.bitsPerChannel === 32;
    } else {
      // No metadata yet — heuristic: Float32 buffers are exactly 2x the size
      // of the expected Int16 buffer for the same sample count.
      // At 16kHz mono, 100ms = 1600 samples = 3200 bytes (Int16) or 6400 bytes (Float32)
      const expectedInt16 = Math.round(this.sampleRate * this.chunkDurationMs / 1000) * 2;
      const expectedFloat32 = expectedInt16 * 2;
      if (data.length === expectedFloat32 && data.length !== expectedInt16) {
        isFloat32 = true;
      }
    }

    if (isFloat32 && data.length >= 4 && data.length % 4 === 0) {
      return this._float32ToInt16(data);
    }
    return data;
  }

  /**
   * Convert Float32 PCM buffer to Int16 PCM buffer.
   * @param {Buffer} float32Buf
   * @returns {Buffer}
   */
  _float32ToInt16(float32Buf) {
    const numSamples = float32Buf.length / 4;
    const int16Buf = Buffer.alloc(numSamples * 2);
    for (let i = 0; i < numSamples; i++) {
      const sample = float32Buf.readFloatLE(i * 4);
      const clamped = Math.max(-1, Math.min(1, sample));
      int16Buf.writeInt16LE(Math.round(clamped * 32767), i * 2);
    }
    return int16Buf;
  }

  /**
   * Stop audio capture and release resources.
   */
  async stop() {
    this.isRunning = false;

    const stops = [];
    if (this._systemRecorder) {
      this._systemRecorder.removeAllListeners();
      stops.push(this._systemRecorder.stop().catch(() => {}));
      this._systemRecorder = null;
    }
    if (this._micRecorder) {
      this._micRecorder.removeAllListeners();
      stops.push(this._micRecorder.stop().catch(() => {}));
      this._micRecorder = null;
    }
    await Promise.all(stops);

    this._metadata = { system: null, mic: null };
    this.emit('stopped');
  }

  /**
   * Check if capture is active.
   * @returns {boolean}
   */
  get connected() {
    return this.isRunning;
  }

  /**
   * Get capture stats.
   */
  getStats() {
    return {
      ...this.stats,
      durationMs: this.stats.startedAt ? Date.now() - this.stats.startedAt : 0
    };
  }
}

module.exports = { AudioBridge };
