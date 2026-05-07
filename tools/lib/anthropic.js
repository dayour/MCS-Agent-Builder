/**
 * Shared Claude Client — Unified Claude Access (GitHub Copilot + Direct API)
 *
 * Provides Claude chat completion with streaming support.
 * Routes intelligently:
 *   - GitHub Copilot Chat Completions API as PRIMARY (all models via gh auth token)
 *   - Direct Anthropic API as FALLBACK for models the key can access (e.g. Haiku)
 *     when Copilot is unavailable
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

// --- Known-latest model IDs ---
// Bump these when a new family version is confirmed stable. Auto-discovery
// probes FORWARD_CANDIDATES on top of this floor to pick up newer releases
// automatically.
// Copilot uses dots for minor version (claude-opus-4.7); direct Anthropic
// API uses dashes (claude-opus-4-7).
const KNOWN_LATEST_COPILOT = {
  haiku: process.env.CLAUDE_HAIKU_ID || 'claude-haiku-4.5',
  sonnet: process.env.CLAUDE_SONNET_ID || 'claude-sonnet-4.6',
  opus: process.env.CLAUDE_OPUS_ID || 'claude-opus-4.7'
};

// --- Forward-probe candidates (newest-first) ---
// Probed lazily on first use. If the API accepts a newer version than
// KNOWN_LATEST, the resolver caches it for the session and all subsequent
// calls use the discovered newer ID. Falls back to KNOWN_LATEST if nothing
// newer is accepted.
// Generated from KNOWN_LATEST: probes next major (.0, .1) and current major
// forward 3 minors. When 4.8 ships, it's picked up without code changes.
function buildForwardCandidates(knownLatestId) {
  // Parse "claude-opus-4.7" → base="claude-opus", major=4, minor=7
  const m = knownLatestId.match(/^(claude-[a-z]+)-(\d+)\.(\d+)$/);
  if (!m) return [];
  const [, base, majorStr, minorStr] = m;
  const major = parseInt(majorStr, 10);
  const minor = parseInt(minorStr, 10);
  const out = [];
  // Next major: 5.0, 5.1 (conservative — 2 forward minors)
  for (let n = 0; n <= 1; n++) out.push(`${base}-${major + 1}.${n}`);
  // Current major: probe minor+3 down to minor+1 (not including known-latest)
  for (let n = 3; n >= 1; n--) out.push(`${base}-${major}.${minor + n}`);
  return out;
}

// --- Probe gate ---
// Set CLAUDE_SKIP_DISCOVERY=1 to disable forward-probing (use KNOWN_LATEST
// directly). Useful for offline/CI or when probes are slow. Env overrides
// (CLAUDE_OPUS_ID, etc.) implicitly skip probing for that family.
const SKIP_DISCOVERY = process.env.CLAUDE_SKIP_DISCOVERY === '1';
const PROBE_TIMEOUT_MS = parseInt(process.env.CLAUDE_PROBE_TIMEOUT_MS || '5000', 10);

// --- Resolved ID cache (session-scoped, per-family) ---
let _resolvedCopilotIds = {};      // { opus: 'claude-opus-4.8', ... } once discovered
let _resolvingPromises = {};       // in-flight probe dedup

// --- Direct Anthropic API model IDs (dashes) ---
// Pricing lives here. Bump the id strings when a new family ships.
const MODELS = {
  haiku: { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5', inputPer1M: 1.00, outputPer1M: 5.00, cachePer1M: 0.10 },
  sonnet: { id: 'claude-sonnet-4-6', name: 'Sonnet 4.6', inputPer1M: 3.00, outputPer1M: 15.00, cachePer1M: 0.30 },
  opus: { id: 'claude-opus-4-7', name: 'Opus 4.7', inputPer1M: 5.00, outputPer1M: 25.00, cachePer1M: 0.50 }
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
 * Copilot is primary (all models), direct API is fallback (limited models).
 * @returns {'copilot-claude'|'anthropic-api'|null}
 */
function getActiveMethod() {
  if (hasCopilotAccess()) return 'copilot-claude';
  if (getApiKey()) return 'anthropic-api';
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
    const copilotAvail = hasCopilotAccess();

    // If Copilot is available, all models are accessible — mark them all true
    if (copilotAvail) {
      for (const key of Object.keys(MODELS)) _modelAccess[key] = true;
      _effectiveDefault = DEFAULT_MODEL;
    } else if (getApiKey()) {
      // Copilot unavailable — probe direct API to find what this key can access
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
      _effectiveDefault = FALLBACK_CHAIN.find(k => _modelAccess[k]) || 'opus';
    }

    _accessProbed = true;
    _probePromise = null;

    return { ..._modelAccess, _copilotAvailable: copilotAvail, _primaryRoute: copilotAvail ? 'copilot' : 'direct' };
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
  return _effectiveDefault || 'opus';
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
    requestedDefault: DEFAULT_MODEL,
    knownLatestCopilot: { ...KNOWN_LATEST_COPILOT },
    resolvedCopilotIds: { ..._resolvedCopilotIds },
    skipDiscovery: SKIP_DISCOVERY
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
 * Probe a specific Copilot model ID to see if the API accepts it.
 * Sends a minimal 1-token request with a short timeout.
 *
 * Returns a verdict string so the resolver can distinguish:
 *   'accepted'   — 200, the candidate works
 *   'rejected'   — 400/404, the candidate is definitively unavailable
 *                  (wrong name or not entitled); move to next candidate
 *   'transient'  — 429/5xx/timeout/network error; do NOT cache a negative
 *                  result from this probe — caller should return the
 *                  KNOWN_LATEST floor uncached and re-probe next call
 */
async function probeCopilotModelId(modelId) {
  const token = getCopilotToken();
  if (!token) return 'transient';
  try {
    const res = await httpRequestWithRetry('POST', COPILOT_CHAT_URL, {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...COPILOT_HEADERS
    }, {
      model: modelId,
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 1
    }, 0, PROBE_TIMEOUT_MS);
    if (res.status === 200) return 'accepted';
    // 400/404 and the text looks model-related → definitive rejection
    if (res.status === 400 || res.status === 404) {
      const raw = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data || '');
      if (/model|unknown|not.?found|unsupported/i.test(raw)) return 'rejected';
      // 400 for some other reason (malformed body, etc.) — treat as transient
      return 'transient';
    }
    // 403 entitlement could be partial-rollout; treat as transient so next
    // session re-probes. Same for 429/5xx.
    return 'transient';
  } catch {
    return 'transient';
  }
}

/**
 * Resolve the best Copilot model ID for this family, probing forward
 * candidates (e.g. 4.8, 4.9, 5.0) if auto-discovery is enabled. Caches the
 * result per-family for the session.
 *
 * Priority order:
 *   1. Env override (CLAUDE_<FAMILY>_ID) — skips probing
 *   2. Cached resolved ID from a prior call
 *   3. Forward probe (unless CLAUDE_SKIP_DISCOVERY=1)
 *   4. KNOWN_LATEST_COPILOT floor
 *
 * Concurrent callers share a single in-flight probe via promise dedup.
 *
 * @param {string} family - 'opus' | 'sonnet' | 'haiku'
 * @returns {Promise<string>} Resolved Copilot model ID (e.g. 'claude-opus-4.8')
 */
async function resolveCopilotModelId(family) {
  family = family || DEFAULT_MODEL;

  // Env override — highest priority, no probe.
  const envVar = `CLAUDE_${family.toUpperCase()}_ID`;
  if (process.env[envVar]) {
    _resolvedCopilotIds[family] = process.env[envVar];
    return process.env[envVar];
  }

  // Session cache hit.
  if (_resolvedCopilotIds[family]) return _resolvedCopilotIds[family];

  // Skip discovery — use known-latest directly.
  if (SKIP_DISCOVERY || !hasCopilotAccess()) {
    _resolvedCopilotIds[family] = KNOWN_LATEST_COPILOT[family];
    return _resolvedCopilotIds[family];
  }

  // Probe dedup — multiple concurrent first-calls share one probe.
  if (_resolvingPromises[family]) return _resolvingPromises[family];

  _resolvingPromises[family] = (async () => {
    const known = KNOWN_LATEST_COPILOT[family];
    const forwards = buildForwardCandidates(known);
    let sawTransient = false;

    for (const candidateId of forwards) {
      const verdict = await probeCopilotModelId(candidateId);
      if (verdict === 'accepted') {
        _resolvedCopilotIds[family] = candidateId;
        console.error(`  [anthropic] Auto-discovered newer model: ${candidateId} (floor was ${known})`);
        return candidateId;
      }
      if (verdict === 'transient') {
        // Network blip, rate limit, 5xx, or partial-rollout 403.
        // Bail out of the probe chain — we cannot trust that later rejections
        // mean the model doesn't exist. Use KNOWN_LATEST without caching so
        // the next call re-probes.
        sawTransient = true;
        break;
      }
      // 'rejected' — this specific ID is definitively unavailable; try next.
    }

    const floor = known;
    if (sawTransient) {
      // Do not poison the cache — next call re-probes.
      return floor;
    }
    // All candidates definitively rejected → safe to cache the floor.
    _resolvedCopilotIds[family] = floor;
    return floor;
  })();

  try {
    return await _resolvingPromises[family];
  } finally {
    delete _resolvingPromises[family];
  }
}

/**
 * Get the current resolved Copilot model IDs (post-discovery).
 * Returns the cache snapshot — families not yet probed appear only if
 * overridden via env.
 */
function getResolvedCopilotIds() {
  return { ..._resolvedCopilotIds };
}

/**
 * Pre-warm model resolution off the user-request hot path. Fires forward-
 * probes for all three families in parallel and caches the results. Call
 * this at server/CLI boot to avoid paying the 2-3s probe cost on the first
 * chat request. Safe to call when Copilot is unavailable (no-op).
 *
 * @param {string[]} [families] - Which families to warm. Defaults to all.
 * @returns {Promise<object>} Resolved IDs per family.
 */
async function warmModelResolution(families) {
  if (!hasCopilotAccess()) return {};
  const fams = families || Object.keys(KNOWN_LATEST_COPILOT);
  await Promise.all(fams.map(f => resolveCopilotModelId(f).catch(() => {})));
  return getResolvedCopilotIds();
}

/**
 * Reset the resolution cache. Next call to resolveCopilotModelId() will
 * re-probe. Useful for tests or when you want to pick up a new version
 * without restarting the process.
 */
function resetModelResolution() {
  _resolvedCopilotIds = {};
  _resolvingPromises = {};
}

/**
 * Non-streaming chat completion via GitHub Copilot.
 */
async function copilotChatCompletion(messages, options = {}) {
  const maxTokens = options.maxTokens ?? 4096;
  const timeout = options.timeout ?? 60000;
  const modelKey = options.model || DEFAULT_MODEL;
  const resolvedId = await resolveCopilotModelId(modelKey);

  const res = await httpRequestWithRetry('POST', COPILOT_CHAT_URL, {
    'Authorization': `Bearer ${getCopilotToken()}`,
    'Content-Type': 'application/json',
    ...COPILOT_HEADERS
  }, {
    model: resolvedId,
    messages: toCopilotMessages(messages),
    max_tokens: maxTokens
  }, 2, timeout);

  if (res.status !== 200) {
    const raw = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data);
    throw new Error(`Copilot Claude API returned ${res.status}: ${raw.substring(0, 300)}`);
  }

  const content = res.data.choices?.[0]?.message?.content || '';
  const finishReason = res.data.choices?.[0]?.finish_reason || 'stop';
  const truncated = finishReason === 'length';
  const rawUsage = res.data.usage || {};
  // Normalize to Anthropic usage format for consistent tracking
  const usage = {
    input_tokens: rawUsage.prompt_tokens || 0,
    output_tokens: rawUsage.completion_tokens || 0
  };
  const cost = estimateCost(usage, modelKey);
  trackUsage(usage, modelKey);

  if (truncated) {
    console.error(`  [anthropic] Response truncated (finish_reason=length, ${usage.output_tokens} output tokens). Consider increasing maxTokens.`);
  }

  return { content, usage, cost, model: res.data.model || resolvedId, route: 'copilot', truncated };
}

/**
 * Streaming chat completion via GitHub Copilot (SSE, OpenAI format).
 * Async generator yielding same event types as the direct API streamer.
 */
async function* copilotStreamCompletion(messages, options = {}) {
  const maxTokens = options.maxTokens ?? 4096;
  const timeout = options.timeout ?? 120000;
  const modelKey = options.model || DEFAULT_MODEL;
  const resolvedId = await resolveCopilotModelId(modelKey);

  const body = JSON.stringify({
    model: resolvedId,
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

  yield { type: 'route', route: 'copilot', model: resolvedId };

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

  // Honor caller-supplied AbortSignal. We can't cleanly cancel a request
  // already in flight without modifying the shared http.js wrapper, but we
  // CAN refuse to start a new one and skip the Copilot→direct fallback when
  // the caller has already given up.
  const signal = options.signal;
  const checkAborted = () => {
    if (signal?.aborted) {
      const err = new Error('aborted');
      err.name = 'AbortError';
      err.code = 'ABORTED';
      throw err;
    }
  };
  checkAborted();

  const requestedModel = options.model || DEFAULT_MODEL;

  // PRIMARY: GitHub Copilot — all models available
  if (hasCopilotAccess() && KNOWN_LATEST_COPILOT[requestedModel]) {
    try {
      return await copilotChatCompletion(messages, options);
    } catch (copilotErr) {
      // Copilot failed — fall through to direct API. But if the abort fired
      // while the Copilot call was in flight, surface it as a clean abort
      // instead of attempting another network round-trip.
      checkAborted();
      if (!getApiKey()) throw copilotErr; // No fallback available
    }
  }
  checkAborted();

  // FALLBACK: Direct Anthropic API
  const timeout = options.timeout ?? 60000;
  const effectiveModel = resolveAccessibleModel(requestedModel);
  const effectiveOptions = effectiveModel !== requestedModel ? { ...options, model: effectiveModel } : options;

  const body = buildRequestBody(messages, effectiveOptions);
  const res = await httpRequestWithRetry('POST', ANTHROPIC_API_URL, buildHeaders(), body, 2, timeout);

  // If 400 and model access denial, fall down the chain
  if (res.status === 400 && isModelAccessError(res.data) && MODELS[requestedModel] && requestedModel !== 'haiku') {
    _modelAccess[requestedModel] = false;
    _effectiveDefault = FALLBACK_CHAIN.find(k => _modelAccess[k]) || 'opus';

    const fallback = FALLBACK_CHAIN.find(k => k !== requestedModel && _modelAccess[k] !== false);
    if (fallback) {
      checkAborted();
      const fbBody = buildRequestBody(messages, { ...options, model: fallback });
      const fbRes = await httpRequestWithRetry('POST', ANTHROPIC_API_URL, buildHeaders(), fbBody, 2, timeout);
      if (fbRes.status === 200) {
        _modelAccess[fallback] = true;
        const content = (fbRes.data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
        const usage = fbRes.data.usage || {};
        const cost = estimateCost(usage, fallback);
        trackUsage(usage, fallback);
        return { content, usage, cost, model: fbRes.data.model, fallback: `copilot-failed→${fallback}` };
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

  const stopReason = res.data.stop_reason || 'end_turn';
  const truncated = stopReason === 'max_tokens';

  const usage = res.data.usage || {};
  const cost = estimateCost(usage, effectiveModel);
  trackUsage(usage, effectiveModel);

  if (truncated) {
    console.error(`  [anthropic] Response truncated (stop_reason=max_tokens, ${usage.output_tokens || 0} output tokens). Consider increasing maxTokens.`);
  }

  const result = { content, usage, cost, model: res.data.model, truncated };
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
 * @param {string} [options.model='opus'] - Model shorthand or full ID. Default is DEFAULT_MODEL ('opus' family sentinel — auto-resolves to the latest Opus snapshot).
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

  // PRIMARY: GitHub Copilot — all models available
  if (hasCopilotAccess() && KNOWN_LATEST_COPILOT[requestedModel]) {
    yield* copilotStreamCompletion(messages, options);
    return;
  }

  // FALLBACK: Direct Anthropic API (Copilot unavailable)
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

  // If 400 and model access denial, fall down the chain
  if (response.statusCode === 400 && MODELS[requestedModel] && requestedModel !== 'haiku') {
    let errorBody = '';
    for await (const chunk of response) errorBody += chunk;
    let errorData;
    try { errorData = JSON.parse(errorBody); } catch { errorData = {}; }
    if (!isModelAccessError(errorData)) {
      throw new Error(`Anthropic API returned 400: ${errorBody.substring(0, 300)}`);
    }
    _modelAccess[requestedModel] = false;
    _effectiveDefault = FALLBACK_CHAIN.find(k => _modelAccess[k]) || 'opus';

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
  resolveCopilotModelId,
  getResolvedCopilotIds,
  resetModelResolution,
  warmModelResolution,
  MODELS,
  DEFAULT_MODEL,
  KNOWN_LATEST_COPILOT
};
