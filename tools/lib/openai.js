/**
 * Shared GPT Client — GitHub Copilot API (GPT-5.4)
 *
 * Provides GPT chat completion via the GitHub Copilot Responses API.
 * Supports both non-streaming and streaming (SSE) modes.
 * Zero npm dependencies — uses shared HTTP helpers from ./http.js + native https for SSE.
 *
 * Auth: GitHub PAT with `copilot` scope, auto-detected via `gh auth token`.
 * Setup: `gh auth login` then `gh auth refresh --scopes copilot`
 * Works for anyone with GitHub Copilot — no Azure resources or API keys needed.
 *
 * Exports:
 *   isConfigured()            Check if GPT is available
 *   chatCompletion(messages, options)  Send chat completion (GPT-5.4)
 *   streamCompletion(messages, options) Streaming chat completion (async generator)
 *   estimateTokens(text)      Rough token count (chars/4)
 *   estimateCost(usage)       USD cost estimate
 *   getUsageSummary()         Cumulative session stats
 *   resetUsage()              Reset counters
 *   getActiveMethod()         Returns 'copilot-api' or null
 */

const https = require('https');
const { execSync } = require('child_process');
const { httpRequestWithRetry } = require('./http');

// --- Copilot API constants ---
const COPILOT_API_ENDPOINT = 'https://api.githubcopilot.com/responses';
const COPILOT_DEFAULT_MODEL = 'gpt-5.4';
const COPILOT_HEADERS = {
    'Copilot-Integration-Id': 'vscode-chat',
    'Editor-Version': 'vscode/1.96.0'
};

// Pricing per 1M tokens (GPT-5.4 class)
const PRICING = {
    input: 2.50,   // $ per 1M input tokens
    output: 10.00  // $ per 1M output tokens
};

// --- GitHub Token Cache ---
let _ghToken = null;
let _ghTokenChecked = false;
let _ghHasCopilotScope = null;

/**
 * Get GitHub token from gh CLI. Cached after first call.
 * @returns {string|null}
 */
function getGitHubToken() {
    if (_ghTokenChecked) return _ghToken;
    _ghTokenChecked = true;
    try {
        const token = execSync('gh auth token', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
        if (token && token.length > 10) {
            _ghToken = token;
        }
    } catch {
        // gh CLI not installed or not logged in
    }
    return _ghToken;
}

/**
 * Check if the GitHub token has the `copilot` scope.
 * Cached after first call.
 * @returns {boolean}
 */
function hasCopilotScope() {
    if (_ghHasCopilotScope !== null) return _ghHasCopilotScope;
    try {
        // gh auth status writes to stderr; capture both streams without shell: true
        const status = execSync('gh auth status', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
        _ghHasCopilotScope = status.includes("'copilot'") || status.includes('"copilot"');
    } catch (err) {
        // gh auth status exits non-zero when not logged in, but still outputs to stderr
        const output = (err.stdout || '') + (err.stderr || '');
        _ghHasCopilotScope = output.includes("'copilot'") || output.includes('"copilot"');
    }
    return _ghHasCopilotScope;
}

// --- Session Usage Tracking ---
let _usage = { calls: 0, inputTokens: 0, outputTokens: 0, cost: 0 };

/**
 * Returns 'copilot-api' if configured, null otherwise.
 * @returns {'copilot-api'|null}
 */
function getActiveMethod() {
    return (getGitHubToken() && hasCopilotScope()) ? 'copilot-api' : null;
}

/**
 * Check if GPT is available.
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
 * Estimate USD cost from usage object.
 * @param {object} usage
 * @returns {number} USD cost
 */
function estimateCost(usage) {
    const inputTokens = usage.prompt_tokens || usage.input_tokens || 0;
    const outputTokens = usage.completion_tokens || usage.output_tokens || 0;
    return (inputTokens / 1_000_000 * PRICING.input) + (outputTokens / 1_000_000 * PRICING.output);
}

function getUsageSummary() {
    return { ..._usage };
}

function resetUsage() {
    _usage = { calls: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
}

/**
 * Convert chat messages [{role, content}] to Responses API input format.
 * Maps 'system' → 'developer' (Responses API terminology).
 */
function toResponsesInput(messages) {
    return messages.map(m => ({
        role: m.role === 'system' ? 'developer' : m.role,
        content: m.content
    }));
}

/**
 * Extract text content from Responses API output.
 */
function extractResponsesText(data) {
    if (!data.output) return '';
    for (const item of data.output) {
        if (item.type === 'message' && item.content) {
            for (const c of item.content) {
                if (c.type === 'output_text' && c.text) return c.text;
            }
        }
    }
    return '';
}

/**
 * Normalize Responses API usage to the common {prompt_tokens, completion_tokens} format.
 */
function normalizeUsage(data) {
    const usage = data.usage || {};
    return {
        prompt_tokens: usage.input_tokens || 0,
        completion_tokens: usage.output_tokens || 0,
        total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0)
    };
}

/**
 * Send a chat completion request to GPT-5.4 via GitHub Copilot API.
 *
 * @param {Array<{role: string, content: string}>} messages - Chat messages (system/user/assistant)
 * @param {object} [options]
 * @param {number} [options.maxTokens=16384] - Max output tokens
 * @param {number} [options.timeout=60000] - Request timeout in ms
 * @param {string} [options.model] - Model override (default: gpt-5.4)
 * @param {string} [options.reasoningEffort] - Reasoning effort: 'none'|'low'|'medium'|'high'|'xhigh'. Scales timeout automatically.
 * @param {number} [options.retries=3] - Max retry attempts on 429/529/5xx
 * @returns {Promise<{content: string, usage: object, cost: number}>}
 */
async function chatCompletion(messages, options = {}) {
    if (!isConfigured()) {
        const err = new Error(
            'GPT not configured. Run:\n' +
            '  gh auth login\n' +
            '  gh auth refresh --scopes copilot'
        );
        err.code = 'NOT_CONFIGURED';
        throw err;
    }

    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('chatCompletion: messages must be a non-empty array');
    }

    const reasoningEffort = options.reasoningEffort ?? null;

    // Scale timeout based on reasoning effort — high/xhigh need more time
    const EFFORT_TIMEOUTS = { none: 30000, low: 45000, medium: 60000, high: 120000, xhigh: 300000 };
    const defaultTimeout = EFFORT_TIMEOUTS[reasoningEffort] ?? 60000;
    const maxTokens = options.maxTokens ?? 16384;
    const timeout = options.timeout ?? defaultTimeout;
    const retries = options.retries ?? 3;

    const body = {
        model: options.model || COPILOT_DEFAULT_MODEL,
        input: toResponsesInput(messages),
        ...(maxTokens ? { max_output_tokens: maxTokens } : {}),
        ...(reasoningEffort && reasoningEffort !== 'none' ? { reasoning: { effort: reasoningEffort } } : {})
    };

    const res = await httpRequestWithRetry('POST', COPILOT_API_ENDPOINT, {
        'Authorization': `Bearer ${getGitHubToken()}`,
        'Content-Type': 'application/json',
        ...COPILOT_HEADERS
    }, body, retries, timeout);

    if (res.status !== 200) {
        const raw = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data);
        throw new Error(`GPT API returned ${res.status}: ${raw.substring(0, 300)}`);
    }

    const content = extractResponsesText(res.data);
    const usage = normalizeUsage(res.data);
    const cost = estimateCost(usage);

    _usage.calls++;
    _usage.inputTokens += usage.prompt_tokens;
    _usage.outputTokens += usage.completion_tokens;
    _usage.cost += cost;

    return { content, usage, cost };
}

/**
 * Streaming chat completion via GPT-5.4 Responses API SSE.
 * Returns an async generator yielding events:
 *   { type: 'text', text: string }       — incremental text delta
 *   { type: 'done', usage: object, cost: number } — stream complete
 *   { type: 'aborted' }                  — stream cancelled via AbortSignal
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [options]
 * @param {number} [options.maxTokens=4096] - Max output tokens
 * @param {number} [options.timeout=60000] - Request timeout in ms
 * @param {string} [options.model] - Model override (default: gpt-5.4)
 * @param {string} [options.reasoningEffort='high'] - Reasoning effort: 'none'|'low'|'medium'|'high'|'xhigh'
 * @param {AbortSignal} [options.signal] - AbortSignal to cancel the stream
 * @returns {AsyncGenerator<{type: string, text?: string, usage?: object, cost?: number}>}
 */
async function* streamCompletion(messages, options = {}) {
    if (!isConfigured()) {
        const err = new Error(
            'GPT not configured. Run:\n' +
            '  gh auth login\n' +
            '  gh auth refresh --scopes copilot'
        );
        err.code = 'NOT_CONFIGURED';
        throw err;
    }

    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('streamCompletion: messages must be a non-empty array');
    }

    const reasoningEffort = options.reasoningEffort ?? null;

    // Scale timeout based on reasoning effort
    const EFFORT_TIMEOUTS = { none: 30000, low: 45000, medium: 60000, high: 120000, xhigh: 300000 };
    const defaultTimeout = EFFORT_TIMEOUTS[reasoningEffort] ?? 60000;
    const maxTokens = options.maxTokens ?? 4096;
    const timeout = options.timeout ?? defaultTimeout;
    const signal = options.signal || null;

    // Check if already aborted before starting
    if (signal?.aborted) {
        const err = new Error('Stream aborted');
        err.code = 'ABORT_ERR';
        throw err;
    }

    const body = JSON.stringify({
        model: options.model || COPILOT_DEFAULT_MODEL,
        input: toResponsesInput(messages),
        stream: true,
        ...(maxTokens ? { max_output_tokens: maxTokens } : {}),
        ...(reasoningEffort && reasoningEffort !== 'none' ? { reasoning: { effort: reasoningEffort } } : {})
    });

    const endpointUrl = new URL(COPILOT_API_ENDPOINT);
    const reqOptions = {
        hostname: endpointUrl.hostname,
        port: 443,
        path: endpointUrl.pathname,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${getGitHubToken()}`,
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            ...COPILOT_HEADERS,
            'Content-Length': Buffer.byteLength(body)
        }
    };

    // Async event queue: SSE callback pushes events, generator yields them
    const events = [];
    let waiter = null;
    let done = false;
    let streamError = null;
    let abortCleanup = null;

    function wake() { if (waiter) { waiter(); waiter = null; } }
    function pushEvent(evt) { events.push(evt); wake(); }
    function finish(err) { if (err) streamError = err; done = true; wake(); }

    function processSseLine(line) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) return;
        if (!trimmed.startsWith('data: ')) return;

        const dataStr = trimmed.slice(6);
        if (dataStr === '[DONE]') { finish(); return; }

        try {
            const payload = JSON.parse(dataStr);
            if (payload.type === 'response.output_text.delta' && payload.delta) {
                pushEvent({ type: 'text', text: payload.delta });
            } else if (payload.type === 'response.completed' && payload.response) {
                const usage = normalizeUsage(payload.response);
                const cost = estimateCost(usage);
                _usage.calls++;
                _usage.inputTokens += usage.prompt_tokens;
                _usage.outputTokens += usage.completion_tokens;
                _usage.cost += cost;
                pushEvent({ type: 'done', usage, cost });
            }
        } catch { /* skip unparseable SSE data */ }
    }

    const req = https.request(reqOptions, (res) => {
        if (res.statusCode !== 200) {
            let errorData = '';
            res.on('data', chunk => errorData += chunk);
            res.on('end', () => finish(new Error(`GPT streaming API returned ${res.statusCode}: ${errorData.substring(0, 300)}`)));
            return;
        }

        let buffer = '';
        res.on('data', (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) processSseLine(line);
        });

        res.on('end', () => {
            if (buffer.trim()) processSseLine(buffer);
            finish();
        });

        res.on('error', (err) => finish(err));
    });

    req.on('error', (err) => {
        if (signal?.aborted) {
            pushEvent({ type: 'aborted' });
            finish();
            return;
        }
        finish(err);
    });

    req.setTimeout(timeout, () => {
        req.destroy(new Error('GPT streaming request timeout'));
    });

    // Wire AbortSignal — destroy the HTTP request on abort
    if (signal) {
        const onAbort = () => {
            pushEvent({ type: 'aborted' });
            req.destroy();
            finish();
        };
        signal.addEventListener('abort', onAbort, { once: true });
        abortCleanup = () => signal.removeEventListener('abort', onAbort);
    }

    req.write(body);
    req.end();

    // Yield events as they arrive
    try {
        while (true) {
            while (events.length > 0) {
                yield events.shift();
            }
            if (done) {
                if (streamError) throw streamError;
                while (events.length > 0) {
                    yield events.shift();
                }
                return;
            }
            await new Promise(r => { waiter = r; });
        }
    } finally {
        if (abortCleanup) abortCleanup();
    }
}

module.exports = {
    isConfigured,
    chatCompletion,
    streamCompletion,
    estimateTokens,
    estimateCost,
    getUsageSummary,
    resetUsage,
    getActiveMethod
};
