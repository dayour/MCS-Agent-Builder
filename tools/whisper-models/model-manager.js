/**
 * Whisper Model Manager
 *
 * Downloads and manages Whisper GGML models for local transcription.
 * Models are stored in tools/whisper-models/models/ (gitignored).
 *
 * Available models:
 *   tiny.en       — 75 MiB, fastest, lowest quality
 *   base.en       — 142 MiB, fast, lower quality (WER ~5%)
 *   small.en-q5_1 — 190 MiB, best speed/quality/size balance (WER ~3.6%) [DEFAULT]
 *   small.en      — 466 MiB, best quality at small size (WER ~3.4%)
 *   medium.en     — 1530 MiB, highest quality, slower (WER ~2.8%)
 *
 * Usage:
 *   const { ensureModel, getModelPath, listModels } = require('./model-manager');
 *   const modelPath = await ensureModel('small.en', { onProgress });
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const MODELS_DIR = path.join(__dirname, 'models');
const HF_BASE = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';
const HF_VAD_BASE = 'https://huggingface.co/ggml-org/whisper-vad/resolve/main';

const AVAILABLE_MODELS = {
  'tiny.en':       { file: 'ggml-tiny.en.bin', sizeMB: 75, description: 'Tiny English — fastest, lowest quality' },
  'base.en':       { file: 'ggml-base.en.bin', sizeMB: 142, description: 'Base English — fast, lower quality' },
  'small.en-q5_1': { file: 'ggml-small.en-q5_1.bin', sizeMB: 190, description: 'Small English Q5_1 — best size/quality tradeoff [recommended]' },
  'small.en':      { file: 'ggml-small.en.bin', sizeMB: 466, description: 'Small English — best quality at small size' },
  'medium.en':     { file: 'ggml-medium.en.bin', sizeMB: 1530, description: 'Medium English — highest quality, slower' }
};

const VAD_MODELS = {
  'silero-v5': { file: 'ggml-silero-v5.1.2.bin', sizeMB: 2, description: 'Silero VAD v5.1.2 — speech activity detection' },
  'silero-v6': { file: 'ggml-silero-v6.2.0.bin', sizeMB: 2, description: 'Silero VAD v6.2.0 — latest speech detection' }
};

/**
 * Ensure models directory exists.
 */
function ensureModelsDir() {
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }
}

/**
 * Get the local path for a model.
 * @param {string} model - Model name (e.g., 'small.en')
 * @returns {string|null} Path if model exists locally, null otherwise
 */
function getModelPath(model) {
  const info = AVAILABLE_MODELS[model];
  if (!info) return null;
  const filePath = path.join(MODELS_DIR, info.file);
  return fs.existsSync(filePath) ? filePath : null;
}

/**
 * List all available models and their download status.
 * @returns {Array<{name: string, file: string, sizeMB: number, downloaded: boolean, path: string|null}>}
 */
function listModels() {
  ensureModelsDir();
  return Object.entries(AVAILABLE_MODELS).map(([name, info]) => {
    const filePath = path.join(MODELS_DIR, info.file);
    const downloaded = fs.existsSync(filePath);
    return {
      name,
      file: info.file,
      sizeMB: info.sizeMB,
      description: info.description,
      downloaded,
      path: downloaded ? filePath : null
    };
  });
}

/**
 * Download a model from HuggingFace.
 * @param {string} model - Model name (e.g., 'small.en')
 * @param {object} [options]
 * @param {function} [options.onProgress] - Progress callback: ({ downloadedMB, totalMB, percent }) => void
 * @returns {Promise<string>} Path to downloaded model
 */
async function downloadModel(model, options = {}) {
  const info = AVAILABLE_MODELS[model];
  if (!info) throw new Error(`Unknown model: ${model}. Available: ${Object.keys(AVAILABLE_MODELS).join(', ')}`);

  ensureModelsDir();
  const filePath = path.join(MODELS_DIR, info.file);
  const tempPath = filePath + '.download';

  const url = `${HF_BASE}/${info.file}`;
  console.log(`Downloading ${model} (${info.sizeMB} MiB) from HuggingFace...`);

  return new Promise((resolve, reject) => {
    const download = (downloadUrl) => {
      https.get(downloadUrl, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          download(res.headers.location);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;
        let lastProgressPct = -1;

        const file = fs.createWriteStream(tempPath);
        res.pipe(file);

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          const percent = totalBytes > 0 ? Math.floor(downloadedBytes / totalBytes * 100) : 0;
          if (percent !== lastProgressPct) {
            lastProgressPct = percent;
            const downloadedMB = (downloadedBytes / 1_048_576).toFixed(1);
            const totalMB = (totalBytes / 1_048_576).toFixed(1);
            if (options.onProgress) {
              options.onProgress({ downloadedMB: parseFloat(downloadedMB), totalMB: parseFloat(totalMB), percent });
            }
          }
        });

        file.on('finish', () => {
          file.close();
          // Rename temp → final
          fs.renameSync(tempPath, filePath);
          console.log(`Model ${model} downloaded to ${filePath}`);
          resolve(filePath);
        });

        file.on('error', (err) => {
          fs.unlink(tempPath, () => {});
          reject(err);
        });
      }).on('error', reject);
    };

    download(url);
  });
}

/**
 * Ensure a model is available locally. Downloads if needed.
 * @param {string} model - Model name (e.g., 'small.en')
 * @param {object} [options]
 * @param {function} [options.onProgress] - Progress callback
 * @returns {Promise<string>} Path to model file
 */
async function ensureModel(model, options = {}) {
  const existing = getModelPath(model);
  if (existing) return existing;
  return downloadModel(model, options);
}

/**
 * Get the best available model (prefers quantized small > full small > base > tiny).
 * @returns {{name: string, path: string}|null}
 */
function getBestAvailable() {
  const priority = ['small.en-q5_1', 'small.en', 'base.en', 'tiny.en', 'medium.en'];
  for (const name of priority) {
    const p = getModelPath(name);
    if (p) return { name, path: p };
  }
  return null;
}

/**
 * Get the local path for a VAD model.
 * @param {string} [model='silero-v5'] - VAD model name
 * @returns {string|null}
 */
function getVadModelPath(model = 'silero-v5') {
  const info = VAD_MODELS[model];
  if (!info) return null;
  const filePath = path.join(MODELS_DIR, info.file);
  return fs.existsSync(filePath) ? filePath : null;
}

/**
 * Ensure a VAD model is available locally. Downloads if needed.
 * @param {string} [model='silero-v5']
 * @param {object} [options]
 * @returns {Promise<string>} Path to VAD model file
 */
async function ensureVadModel(model = 'silero-v5', options = {}) {
  const existing = getVadModelPath(model);
  if (existing) return existing;

  const info = VAD_MODELS[model];
  if (!info) throw new Error(`Unknown VAD model: ${model}. Available: ${Object.keys(VAD_MODELS).join(', ')}`);

  ensureModelsDir();
  const filePath = path.join(MODELS_DIR, info.file);
  const tempPath = filePath + '.download';
  const url = `${HF_VAD_BASE}/${info.file}`;

  console.log(`Downloading VAD model ${model} (${info.sizeMB} MiB)...`);

  return new Promise((resolve, reject) => {
    const download = (downloadUrl) => {
      https.get(downloadUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          download(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`VAD model download failed: HTTP ${res.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(tempPath);
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          fs.renameSync(tempPath, filePath);
          console.log(`VAD model ${model} downloaded to ${filePath}`);
          resolve(filePath);
        });
        file.on('error', (err) => { fs.unlink(tempPath, () => {}); reject(err); });
      }).on('error', reject);
    };
    download(url);
  });
}

// CLI mode
if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'list') {
    console.log('\nAvailable Whisper models:');
    for (const m of listModels()) {
      const status = m.downloaded ? '[downloaded]' : '[not downloaded]';
      console.log(`  ${m.name.padEnd(12)} ${status.padEnd(18)} ${m.sizeMB} MiB — ${m.description}`);
    }
  } else if (cmd === 'download') {
    const model = process.argv[3] || 'small.en-q5_1';
    ensureModel(model, {
      onProgress: ({ downloadedMB, totalMB, percent }) => {
        process.stdout.write(`\r  Downloading: ${downloadedMB}/${totalMB} MiB (${percent}%)`);
      }
    }).then(p => {
      console.log(`\nReady: ${p}`);
    }).catch(err => {
      console.error(`\nFailed: ${err.message}`);
      process.exit(1);
    });
  } else if (cmd === 'best') {
    const best = getBestAvailable();
    if (best) {
      console.log(`Best available: ${best.name} at ${best.path}`);
    } else {
      console.log('No models downloaded. Run: node model-manager.js download small.en');
    }
  } else {
    console.log('Usage: node model-manager.js <list|download [model]|best>');
  }
}

module.exports = {
  ensureModel, getModelPath, listModels, downloadModel, getBestAvailable,
  ensureVadModel, getVadModelPath,
  AVAILABLE_MODELS, VAD_MODELS
};
