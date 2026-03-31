/**
 * Shared Claude Client — Unified Claude Access (Direct API + GitHub Copilot)
 *
 * Provides Claude chat completion with streaming support.
 * Routes intelligently:
 *   - Direct Anthropic API for models the key can access (typically Haiku)
 *   - GitHub Copilot Chat Completions API for higher-tier models (Sonnet/Opus)
 *     when the direct API key lacks access
 *
 * Zero npm dependencies — uses shared HTTP helpers from ./http.js.
 *
 * Auth:
 *   Direct: ANTHROPIC_API_KEY env → ~/.claude/config.json primaryApiKey
 *   Copilot: gh auth token with copilot scope (auto-detected)
 *
 * Exports:
 *   isConfigured()                    Check if Claude API is available
 *   chatCompletion(messages, options) Send chat completion (non-streaming)
 *   streamCompletion(messages, options) Send streaming chat completion (async generator)
 *   estimateTokens(text)             Rough token count (chars/4)
 *   estimateCost(usage, model)       USD cost estimate
 *   getUsageSummary()                Cumulative session stats
 *   resetUsage()                     Reset counters
 *   getActiveMethod()                Returns 'anthropic-api', 'copilot-claude', or null
 *   MODELS                           Available model configurations
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { URL } = require('url');
const { httpRequestWithRetry } = require('./http');

// --- API constants ---
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';

// --- GitHub Copilot passthrough (for Sonnet/Opus when direct API key lacks access) ---
const COPILOT_CHAT_URL = 'https://api.githubcopilot.com/chat/completions';
const COPILOT_HEADERS = {
  'Copilot-Integration-Id': 'vscode-chat',
  'Editor-Version': 'vscode/1.96.0'
};
// Copilot uses different model IDs (dots instead of dashes for version)
const COPILOT_MODEL_MAP = {
  haiku: 'claude-haiku-4.5',
  sonnet: 'claude-sonnet-4.6',
  opus: 'claude-opus-4.6'
};

// --- Available models ---
const MODELS = {
  haiku: { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5', inputPer1M: 1.00, outputPer1M: 5.00, cachePer1M: 0.10 },
  sonnet: { id: 'claude-sonnet-4-6', name: 'Sonnet 4.6', inputPer1M: 3.00, outputPer1M: 15.00, cachePer1M: 0.30 },
  opus: { id: 'claude-opus-4-6', name: 'Opus 4.6', inputPer1M: 5.00, outputPer1M: 25.00, cachePer1M: 0.50 }
};

const DEFAULT_MODEL = 'opus';
const FALLBACK_CHAIN = ['opus', 'sonnet', 'haiku']; // Try best → fast

// --- API Key Cache ---
let _apiKey = null;
let _apiKeyChecked = false;

// --- GitHub Copilot Token Cache ---
let _copilotToken = null;
let _copilotTokenChecked = false;

// --- Model Access Cache ---
let _modelAccess = {}; // { modelKey: true/false }
let _accessProbed = false;
let _probePromise = null; // Prevents concurrent probes
let _effectiveDefault = null; // Best model this key can access

/**
 * Get Anthropic API key. Checks env var first, then ~/.claude/config.json.
 * Cached after first call.
 * @returns {string|null}
 */
function getApiKey() {
  if (_apiKeyChecked) return _apiKey;
  _apiKeyChecked = true;

  // Check env var first
  if (process.env.ANTHROPIC_API_KEY) {
    _apiKey = process.env.ANTHROPIC_API_KEY;
    return _apiKey;
  }

  // Fallback: read from Claude Code config (same pattern as wizard.js lines 38-46)
  try {
    const configPath = path.join(os.homedir(), '.claude', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.primaryApiKey) {
      _apiKey = config.primaryApiKey;
    }
  } catch { /* ignore — no config file */ }

  return _apiKey;
}

/**
 * Get GitHub token for Copilot API passthrough. Cached.
 * @returns {string|null}
 */
function getCopilotToken() {
  if (_copilotTokenChecked) return _copilotToken;
  _copilotTokenChecked = true;
  try {
    const { execSync } = require('child_process');
    const token = execSync('gh auth token', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    if (token && token.length > 10) _copilotToken = token;
  } catch { /* gh CLI not available */ }
  return _copilotToken;
}

/**
 * Check if GitHub Copilot can serve Claude models.
 * @returns {boolean}
 */
function hasCopilotAccess() {
  return getCopilotToken() !== null;
}

// --- Session Usage Tracking ---
let _usage = { calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0 };

/**
 * Returns the active method for Claude access.
 * @returns {'anthropic-api'|'copilot-claude'|null}
 */
function getActiveMethod() {
  if (getApiKey()) return 'anthropic-api';
  if (hasCopilotAccess()) return 'copilot-claude';
  return null;
}

/**
 * Check if Claude API is available (direct or via Copilot).
 * @returns {boolean}
 */
function isConfigured() {
  return getActiveMethod() !== null;
}

/**
 * Rough token estimate (chars / 4).
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

/**
 * Resolve model shorthand to full model ID.
 * @param {string} model - shorthand ('haiku', 'sonnet', 'opus') or full ID
 * @returns {string} Full model ID
 */
function resolveModel(model) {
  if (!model) return MODELS[DEFAULT_MODEL].id;
  if (MODELS[model]) return MODELS[model].id;
  return model; // assume it's already a full ID
}

/**
 * Get pricing for a model.
 * @param {string} model - shorthand or full ID
 * @returns {object} { inputPer1M, outputPer1M, cachePer1M }
 */
function getModelPricing(model) {
  if (MODELS[model]) return MODELS[model];
  // Try matching by ID
  for (const m of Object.values(MODELS)) {
    if (m.id === model) return m;
  }
  return MODELS[DEFAULT_MODEL]; // fallback
}

/**
 * Estimate USD cost from usage object.
 * @param {object} usage - { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens }
 * @param {string} [model] - Model shorthand or ID
 * @returns {number} USD cost
 */
function estimateCost(usage, model) {
  const pricing = getModelPricing(model || DEFAULT_MODEL);
  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;
  const cacheReadTokens = usage.cache_read_input_tokens || 0;
  const cacheWriteTokens = usage.cache_creation_input_tokens || 0;
  // Cache reads are 10% of input price, cache writes are 125% of input price
  const regularInput = inputTokens - cacheReadTokens - cacheWriteTokens;
  return (
    (Math.max(0, regularInput) / 1_000_000 * pricing.inputPer1M) +
    (outputTokens / 1_000_000 * pricing.outputPer1M) +
    (cacheReadTokens / 1_000_000 * pricing.cachePer1M) +
    (cacheWriteTokens / 1_000_000 * pricing.inputPer1M * 1.25)
  );
}

function getUsageSummary() {
  return { ..._usage };
}

function resetUsage() {
  _usage = { calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0 };
}

/**
 * Probe which models the current API key can access.
 * Sends a minimal request to each model. Caches results.
 * @returns {Promise<{[key: string]: boolean}>} Model access map
 */
async function probeModelAccess() {
  if (_accessProbed) return { ..._modelAccess };
  if (!isConfigured()) return {};

  // Prevent concurrent probes — reuse in-flight promise
  if (_probePromise) return _probePromise;

  _probePromise = (async () => {
    // Only probe direct API if we have an API key
    if (getApiKey()) {
      await Promise.allSettled(
        Object.keys(MODELS).map(async (key) => {
          try {
            const res = await httpRequestWithRetry('POST', ANTHROPIC_API_URL, buildHeaders(), {
              model: MODELS[key].id,
              max_tokens: 5,
              messages: [{ role: 'user', content: 'Hi' }]
            }, 0, 10000);
            _modelAccess[key] = res.status === 200;
          } catch {
            _modelAccess[key] = false;
          }
        })
      );
    }

    // Set effective default — if Copilot available, all models are accessible via that route
    const copilotAvail = hasCopilotAccess();
    if (copilotAvail) {
      _effectiveDefault = DEFAULT_MODEL;
    } else {
      _effectiveDefault = FALLBACK_CHAIN.find(k => _modelAccess[k]) || 'haiku';
    }
    _accessProbed = true;
    _probePromise = null;

    return { ..._modelAccess, _copilotAvailable: copilotAvail };
  })();

  return _probePromise;
}

/**
 * Get the best model this API key can access.
 * Must call probeModelAccess() first, or returns DEFAULT_MODEL.
 * @returns {string} Model shorthand
 */
function getEffectiveDefault() {
  return _effectiveDefault || DEFAULT_MODEL;
}

/**
 * Get the accessible model closest to the requested one.
 * Falls back down the chain: opus → sonnet → haiku.
 * If no probe done yet, returns the requested model (optimistic).
 * @param {string} requested - Model shorthand
 * @returns {string} Accessible model shorthand
 */
function resolveAccessibleModel(requested) {
  if (!_accessProbed) return requested || DEFAULT_MODEL;
  if (_modelAccess[requested]) return requested;

  // Fall down the chain from requested position
  const idx = FALLBACK_CHAIN.indexOf(requested);
  if (idx >= 0) {
    for (let i = idx; i < FALLBACK_CHAIN.length; i++) {
      if (_modelAccess[FALLBACK_CHAIN[i]]) return FALLBACK_CHAIN[i];
    }
  }
  return _effectiveDefault || 'haiku';
}

/**
 * Get model access status (after probing).
 * @returns {{probed: boolean, access: object, effectiveDefault: string}}
 */
function getModelAccessInfo() {
  return {
    probed: _accessProbed,
    access: { ..._modelAccess },
    copilotAvailable: hasCopilotAccess(),
    effectiveDefault: _effectiveDefault || DEFAULT_MODEL,
    requestedDefault: DEFAULT_MODEL
  };
}

/**
 * Check if an API error response indicates model access denial.
 * Distinguishes access/permission errors from malformed request errors.
 * @param {object} responseData - Parsed response body
 * @returns {boolean}
 */
function isModelAccessError(responseData) {
  const msg = responseData?.error?.message || '';
  const type = responseData?.error?.type || '';
  // Generic "Error" with no detail is the access denial pattern we've observed
  // Also match explicit permission/access messages
  if (type === 'invalid_request_error' && (msg === 'Error' || /model.*not.*access|permission|not.*available/i.test(msg))) {
    return true;
  }
  return false;
}

/**
 * Build the request body for the Anthropic Messages API.
 * Separates system messages from user/assistant messages.
 * Supports prompt caching via cache_control on system blocks.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} options
 * @returns {object} Request body
 */
function buildRequestBody(messages, options = {}) {
  const maxTokens = options.maxTokens ?? 4096;
  const modelId = resolveModel(options.model);

  // Separate system messages from conversation
  const systemMessages = messages.filter(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  // Build system prompt with optional cache_control
  let system;
  if (systemMessages.length > 0) {
    const systemText = systemMessages.map(m => m.content).join('\n\n');
    if (options.cacheSystem !== false) {
      // Enable prompt caching on system prompt
      system = [{
        type: 'text',
        text: systemText,
        cache_control: { type: 'ephemeral' }
      }];
    } else {
      system = systemText;
    }
  }

  const body = {
    model: modelId,
    max_tokens: maxTokens,
    messages: conversationMessages.map(m => ({
      role: m.role,
      content: m.content
    }))
  };

  if (system) body.system = system;

  return body;
}

/**
 * Build request headers for the Anthropic API.
 * @returns {object}
 */
function buildHeaders() {
  return {
    'x-api-key': getApiKey(),
    'anthropic-version': ANTHROPIC_API_VERSION,
    'Content-Type': 'application/json'
  };
}

/**
 * Track usage from API response.
 * @param {object} usage - API usage object
 * @param {string} model - Model shorthand
 */
function trackUsage(usage, model) {
  if (!usage) return;
  _usage.calls++;
  _usage.inputTokens += usage.input_tokens || 0;
  _usage.outputTokens += usage.output_tokens || 0;
  _usage.cacheReadTokens += usage.cache_read_input_tokens || 0;
  _usage.cacheWriteTokens += usage.cache_creation_input_tokens || 0;
  _usage.cost += estimateCost(usage, model);
}

// ---------------------------------------------------------------------------
// GitHub Copilot passthrough — routes Claude Sonnet/Opus via Copilot when
// the direct Anthropic API key lacks access to higher-tier models.
// Uses the Chat Completions API (OpenAI-compatible SSE streaming).
// ---------------------------------------------------------------------------

/**
 * Convert messages to Copilot Chat Completions format.
 * Passes through as-is — system/user/assistant roles are all valid.
 */
function toCopilotMessages(messages) {
  return messages.map(m => ({ role: m.role, content: m.content }));
}

/**
 * Resolve model shorthand to Copilot model ID.
 */
function copilotModelId(model) {
  return COPILOT_MODEL_MAP[model] || COPILOT_MODEL_MAP[DEFAULT_MODEL];
}

/**
 * Non-streaming chat completion via GitHub Copilot.
 */
async function copilotChatCompletion(messages, options = {}) {
  const maxTokens = options.maxTokens ?? 4096;
  const timeout = options.timeout ?? 60000;
  const modelKey = options.model || DEFAULT_MODEL;

  const res = await httpRequestWithRetry('POST', COPILOT_CHAT_URL, {
    'Authorization': `Bearer ${getCopilotToken()}`,
    'Content-Type': 'application/json',
    ...COPILOT_HEADERS
  }, {
    model: copilotModelId(modelKey),
    messages: toCopilotMessages(messages),
    max_tokens: maxTokens
  }, 2, timeout);

  if (res.status !== 200) {
    const raw = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data);
    throw new Error(`Copilot Claude API returned ${res.status}: ${raw.substring(0, 300)}`);
  }

  const content = res.data.choices?.[0]?.message?.content || '';
  const rawUsage = res.data.usage || {};
  // Normalize to Anthropic usage format for consistent tracking
  const usage = {
    input_tokens: rawUsage.prompt_tokens || 0,
    output_tokens: rawUsage.completion_tokens || 0
  };
  const cost = estimateCost(usage, modelKey);
  trackUsage(usage, modelKey);

  return { content, usage, cost, model: res.data.model || copilotModelId(modelKey), route: 'copilot' };
}

/**
 * Streaming chat completion via GitHub Copilot (SSE, OpenAI format).
 * Async generator yielding same event types as the direct API streamer.
 */
async function* copilotStreamCompletion(messages, options = {}) {
  const maxTokens = options.maxTokens ?? 4096;
  const timeout = options.timeout ?? 120000;
  const modelKey = options.model || DEFAULT_MODEL;

  const body = JSON.stringify({
    model: copilotModelId(modelKey),
    messages: toCopilotMessages(messages),
    max_tokens: maxTokens,
    stream: true
  });

  const parsed = new URL(COPILOT_CHAT_URL);

  const response = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getCopilotToken()}`,
        'Content-Type': 'application/json',
        ...COPILOT_HEADERS,
        'Content-Length': Buffer.byteLength(body)
      }
    }, resolve);
    req.on('error', reject);
    req.setTimeout(timeout, () => { req.destroy(new Error('Copilot streaming timeout')); });
    req.write(body);
    req.end();
  });

  if (response.statusCode !== 200) {
    let errorData = '';
    for await (const chunk of response) errorData += chunk;
    throw new Error(`Copilot Claude API returned ${response.statusCode}: ${errorData.substring(0, 300)}`);
  }

  yield { type: 'route', route: 'copilot', model: copilotModelId(modelKey) };

  let buffer = '';
  let fullText = '';
  let finalUsage = null;

  for await (const chunk of response) {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') {
        // Stream complete — emit done event
        if (finalUsage) {
          const usage = { input_tokens: finalUsage.prompt_tokens || 0, output_tokens: finalUsage.completion_tokens || 0 };
          const cost = estimateCost(usage, modelKey);
          trackUsage(usage, modelKey);
          yield { type: 'done', text: fullText, usage, cost };
        } else {
          yield { type: 'done', text: fullText };
        }
        return;
      }

      let event;
      try { event = JSON.parse(data); } catch { continue; }

      // Extract text delta from OpenAI Chat Completions SSE format
      const delta = event.choices?.[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        yield { type: 'text', text: delta };
      }

      // Capture usage from final chunk (some providers include it)
      if (event.usage) finalUsage = event.usage;
    }
  }

  // If we exit the loop without [DONE], emit what we have
  if (fullText) {
    yield { type: 'done', text: fullText };
  }
}

/**
 * Send a non-streaming chat completion to the Anthropic Messages API.
 * Auto-falls back to an accessible model if the requested one returns 400.
 *
 * @param {Array<{role: string, content: string}>} messages - Chat messages (system/user/assistant)
 * @param {object} [options]
 * @param {number} [options.maxTokens=4096] - Max output tokens
 * @param {number} [options.timeout=60000] - Request timeout in ms
 * @param {string} [options.model='opus'] - Model shorthand or full ID
 * @param {boolean} [options.cacheSystem=true] - Enable prompt caching on system prompt
 * @returns {Promise<{content: string, usage: object, cost: number, model: string, fallback?: string}>}
 */
async function chatCompletion(messages, options = {}) {
  if (!isConfigured()) {
    const err = new Error(
      'Claude not configured. Ensure Claude Code is logged in,\n' +
      'set ANTHROPIC_API_KEY, or configure gh auth with copilot scope.'
    );
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('chatCompletion: messages must be a non-empty array');
  }

  const requestedModel = options.model || DEFAULT_MODEL;

  // If direct API can't access this model and Copilot is available, route through Copilot
  if (_accessProbed && !_modelAccess[requestedModel] && hasCopilotAccess() && COPILOT_MODEL_MAP[requestedModel]) {
    const result = await copilotChatCompletion(messages, options);
    return { ...result, fallback: `direct→copilot` };
  }

  // No direct API key at all — use Copilot if available
  if (!getApiKey() && hasCopilotAccess()) {
    return copilotChatCompletion(messages, options);
  }

  const timeout = options.timeout ?? 60000;
  const effectiveModel = resolveAccessibleModel(requestedModel);
  const effectiveOptions = effectiveModel !== requestedModel ? { ...options, model: effectiveModel } : options;

  const body = buildRequestBody(messages, effectiveOptions);
  const res = await httpRequestWithRetry('POST', ANTHROPIC_API_URL, buildHeaders(), body, 2, timeout);

  // If 400 and looks like model access denial, try Copilot first, then Haiku fallback
  if (res.status === 400 && isModelAccessError(res.data) && MODELS[requestedModel] && requestedModel !== 'haiku') {
    _modelAccess[requestedModel] = false;
    _effectiveDefault = FALLBACK_CHAIN.find(k => _modelAccess[k]) || 'haiku';

    // Try GitHub Copilot for the requested model (keeps quality)
    if (hasCopilotAccess() && COPILOT_MODEL_MAP[requestedModel]) {
      const result = await copilotChatCompletion(messages, options);
      return { ...result, fallback: `direct→copilot` };
    }

    // Last resort: fall back to a model the direct API can access
    const fallback = FALLBACK_CHAIN.find(k => k !== requestedModel && _modelAccess[k] !== false);
    if (fallback) {
      const fbBody = buildRequestBody(messages, { ...options, model: fallback });
      const fbRes = await httpRequestWithRetry('POST', ANTHROPIC_API_URL, buildHeaders(), fbBody, 2, timeout);
      if (fbRes.status === 200) {
        _modelAccess[fallback] = true;
        const content = (fbRes.data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
        const usage = fbRes.data.usage || {};
        const cost = estimateCost(usage, fallback);
        trackUsage(usage, fallback);
        return { content, usage, cost, model: fbRes.data.model, fallback: `${requestedModel}→${fallback}` };
      }
    }
  }

  if (res.status !== 200) {
    const raw = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data);
    throw new Error(`Anthropic API returned ${res.status}: ${raw.substring(0, 300)}`);
  }

  if (MODELS[effectiveModel]) _modelAccess[effectiveModel] = true;

  const content = (res.data.content || [])
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('');

  const usage = res.data.usage || {};
  const cost = estimateCost(usage, effectiveModel);
  trackUsage(usage, effectiveModel);

  const result = { content, usage, cost, model: res.data.model };
  if (effectiveModel !== requestedModel) result.fallback = `${requestedModel}→${effectiveModel}`;
  return result;
}

/**
 * Send a streaming chat completion to the Anthropic Messages API.
 * Returns an async generator that yields text deltas.
 *
 * @param {Array<{role: string, content: string}>} messages - Chat messages
 * @param {object} [options]
 * @param {number} [options.maxTokens=4096] - Max output tokens
 * @param {number} [options.timeout=120000] - Request timeout in ms (longer for streaming)
 * @param {string} [options.model='haiku'] - Model shorthand or full ID
 * @param {boolean} [options.cacheSystem=true] - Enable prompt caching on system prompt
 * @returns {AsyncGenerator<{type: string, text?: string, usage?: object, cost?: number}>}
 */
async function* streamCompletion(messages, options = {}) {
  if (!isConfigured()) {
    const err = new Error(
      'Claude not configured. Ensure Claude Code is logged in,\n' +
      'set ANTHROPIC_API_KEY, or configure gh auth with copilot scope.'
    );
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('streamCompletion: messages must be a non-empty array');
  }

  const requestedModel = options.model || DEFAULT_MODEL;

  // If direct API can't access this model and Copilot is available, route through Copilot
  if (_accessProbed && !_modelAccess[requestedModel] && hasCopilotAccess() && COPILOT_MODEL_MAP[requestedModel]) {
    yield { type: 'fallback', from: requestedModel, to: requestedModel, message: `direct→copilot` };
    yield* copilotStreamCompletion(messages, options);
    return;
  }

  // No direct API key at all — use Copilot if available
  if (!getApiKey() && hasCopilotAccess()) {
    yield* copilotStreamCompletion(messages, options);
    return;
  }

  // Resolve model with access fallback
  const effectiveModel = resolveAccessibleModel(requestedModel);
  const effectiveOptions = effectiveModel !== requestedModel ? { ...options, model: effectiveModel } : options;
  let usedFallback = effectiveModel !== requestedModel ? `${requestedModel}→${effectiveModel}` : null;

  const timeout = effectiveOptions.timeout ?? 120000;
  const body = { ...buildRequestBody(messages, effectiveOptions), stream: true };
  const headers = buildHeaders();

  // Use raw https for streaming (httpRequestWithRetry buffers the full response)
  const parsed = new URL(ANTHROPIC_API_URL);
  let bodyStr = JSON.stringify(body);

  let response = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, resolve);

    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy(new Error('Streaming request timeout'));
    });
    req.write(bodyStr);
    req.end();
  });

  // If 400 and looks like model access denial, try fallback
  if (response.statusCode === 400 && MODELS[requestedModel] && requestedModel !== 'haiku') {
    // Read error body to check if it's an access error
    let errorBody = '';
    for await (const chunk of response) errorBody += chunk;
    let errorData;
    try { errorData = JSON.parse(errorBody); } catch { errorData = {}; }
    if (!isModelAccessError(errorData)) {
      throw new Error(`Anthropic API returned 400: ${errorBody.substring(0, 300)}`);
    }
    _modelAccess[requestedModel] = false;
    _effectiveDefault = FALLBACK_CHAIN.find(k => _modelAccess[k]) || 'haiku';

    // Try GitHub Copilot for the requested model (keeps quality)
    if (hasCopilotAccess() && COPILOT_MODEL_MAP[requestedModel]) {
      yield { type: 'fallback', from: requestedModel, to: requestedModel, message: `direct→copilot` };
      yield* copilotStreamCompletion(messages, options);
      return;
    }

    // Last resort: fall back to a model the direct API can access
    const fallback = FALLBACK_CHAIN.find(k => k !== requestedModel && _modelAccess[k] !== false);
    if (fallback) {
      usedFallback = `${requestedModel}→${fallback}`;
      const fbBody = { ...buildRequestBody(messages, { ...options, model: fallback }), stream: true };
      bodyStr = JSON.stringify(fbBody);
      response = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: parsed.hostname,
          port: 443,
          path: parsed.pathname,
          method: 'POST',
          headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr) }
        }, resolve);
        req.on('error', reject);
        req.setTimeout(timeout, () => { req.destroy(new Error('Streaming request timeout')); });
        req.write(bodyStr);
        req.end();
      });
    }
  }

  if (response.statusCode !== 200) {
    let errorData = '';
    for await (const chunk of response) errorData += chunk;
    throw new Error(`Anthropic API returned ${response.statusCode}: ${errorData.substring(0, 300)}`);
  }

  // Emit fallback info if model was downgraded
  if (usedFallback) {
    yield { type: 'fallback', from: requestedModel, to: usedFallback.split('→')[1], message: usedFallback };
  }

  // Parse SSE stream
  let buffer = '';
  let fullText = '';
  let finalUsage = null;

  for await (const chunk of response) {
    buffer += chunk.toString();

    // Process complete SSE events
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      let event;
      try {
        event = JSON.parse(data);
      } catch {
        continue;
      }

      switch (event.type) {
        case 'content_block_delta':
          if (event.delta?.type === 'text_delta' && event.delta.text) {
            fullText += event.delta.text;
            yield { type: 'text', text: event.delta.text };
          }
          break;

        case 'message_start':
          if (event.message?.usage) {
            finalUsage = { ...event.message.usage };
          }
          yield { type: 'start', model: event.message?.model };
          break;

        case 'message_delta':
          if (event.usage) {
            finalUsage = { ...finalUsage, ...event.usage };
          }
          break;

        case 'message_stop': {
          // Finalize usage tracking — use actual model (after fallback) for correct pricing
          const actualModel = usedFallback ? usedFallback.split('→')[1] : (effectiveOptions.model || DEFAULT_MODEL);
          if (finalUsage) {
            const cost = estimateCost(finalUsage, actualModel);
            trackUsage(finalUsage, actualModel);
            yield { type: 'done', text: fullText, usage: finalUsage, cost };
          } else {
            yield { type: 'done', text: fullText };
          }
          break;
        }

        case 'ping':
        case 'content_block_start':
        case 'content_block_stop':
          break; // Acknowledged, no action needed for text-only streaming

        case 'error':
          throw new Error(`Anthropic streaming error: ${JSON.stringify(event.error)}`);
      }
    }
  }
}

/**
 * Convenience: stream a completion and collect the full text.
 * Calls onDelta for each text chunk (for real-time UI updates).
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [options] - Same as streamCompletion options
 * @param {function} [options.onDelta] - Callback for each text delta: (text) => void
 * @returns {Promise<{content: string, usage: object, cost: number}>}
 */
async function streamToCompletion(messages, options = {}) {
  const { onDelta, ...streamOptions } = options;
  let result = { content: '', usage: {}, cost: 0 };

  for await (const event of streamCompletion(messages, streamOptions)) {
    if (event.type === 'text' && onDelta) {
      try { onDelta(event.text); } catch { /* don't let callback errors abort streaming */ }
    }
    if (event.type === 'done') {
      result = { content: event.text || '', usage: event.usage || {}, cost: event.cost || 0 };
    }
  }

  return result;
}

module.exports = {
  isConfigured,
  chatCompletion,
  streamCompletion,
  estimateTokens,
  estimateCost,
  getUsageSummary,
  resetUsage,
  getActiveMethod,
  probeModelAccess,
  getModelAccessInfo,
  MODELS,
  DEFAULT_MODEL
};
