/**
 * Direct Line API Test Runner for Copilot Studio Agents
 *
 * Sends test messages to an MCS agent via Direct Line API and compares
 * responses against expected results from evals.csv or brief.json evalSets.
 *
 * Usage:
 *   node tools/direct-line-test.js --token-endpoint <URL> --csv <path/to/evals.csv>
 *   node tools/direct-line-test.js --token-endpoint <URL> --brief <path/to/brief.json> [--set safety,functional]
 *   node tools/direct-line-test.js --token <DL_TOKEN> --csv <path/to/evals.csv>
 *
 * Token acquisition (in priority order):
 *   1. --token-endpoint <URL> — MCS Token Endpoint (GET, no secret needed)
 *      Found in: Copilot Studio → Channels → Mobile app → Token Endpoint
 *      Returns: { Token, Expires_in, ConversationId }
 *   2. --token <TOKEN> — Direct Line token (manually copied)
 *      Found in: Copilot Studio → Settings → Security → Web channel security
 *   3. Dataverse API: PvaGetDirectLineEndpoint bound action on the bot entity
 *
 * Input formats:
 *   --csv <path>   CSV format: "Question","Expected response","Testing method","Keywords"
 *   --brief <path> brief.json evalSets (supports multi-turn tests + plan validation)
 *
 * Exit codes:
 *   0 = all tests passed
 *   1 = some tests failed
 *   2 = fatal error (token acquisition, connection failure)
 */

const fs = require('fs');
const { httpRequest, httpRequestWithRetry } = require('./lib/http');
const { evaluateResult, evaluateResultAsync, evaluateAllMethods, evaluateAllMethodsAsync, evaluateMultiTurn, parseCSV, parseEvalSets } = require('./eval-scoring');

// --- Configuration ---
const DEFAULT_ENDPOINT = 'https://directline.botframework.com/v3/directline';
const DEFAULT_TIMEOUT_MS = 60000; // 60 seconds max wait per message
const POLL_INTERVAL_MS = 1000;    // Poll every 1 second
const TOKEN_REFRESH_THRESHOLD = 0.8; // Refresh when 80% of TTL elapsed
const MAX_RETRIES = 3;

// --- Parse CLI Args ---
function parseArgs() {
    const args = process.argv.slice(2);
    const config = { endpoint: DEFAULT_ENDPOINT, timeout: DEFAULT_TIMEOUT_MS };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--token': config.token = args[++i]; break;
            case '--token-endpoint': config.tokenEndpoint = args[++i]; break;
            case '--csv': config.csvPath = args[++i]; break;
            case '--brief': config.briefPath = args[++i]; break;
            case '--set': config.filterSets = args[++i].split(',').map(s => s.trim()); break;
            case '--endpoint': config.endpoint = args[++i]; break;
            case '--timeout': config.timeout = parseInt(args[++i]) || DEFAULT_TIMEOUT_MS; break;
            case '--gpt': config.gpt = true; break;
            case '--verbose': config.verbose = true; break;
            case '--help':
                console.log(`Usage: node direct-line-test.js [options]

Token (one required):
  --token <TOKEN>            Direct Line token (manually copied from MCS UI)
  --token-endpoint <URL>     MCS Token Endpoint URL (auto-acquires token, no secret needed)
                             Found in: Copilot Studio → Channels → Mobile app

Test input (one required):
  --csv <path>               Path to evals.csv file
  --brief <path>             Path to brief.json (supports multi-turn + plan validation)
  --set <names>              Comma-separated eval set filter (with --brief only)

Options:
  --endpoint <URL>           Direct Line endpoint (default: botframework.com)
  --timeout <ms>             Response timeout in ms (default: 60000)
  --gpt                      Use GPT-enhanced scoring (CompareMeaning + GeneralQuality)
  --verbose                  Show detailed output for failed tests

Examples:
  node direct-line-test.js --token-endpoint "https://..." --csv evals.csv
  node direct-line-test.js --token-endpoint "https://..." --brief brief.json --set safety,functional
  node direct-line-test.js --token "abc123" --brief brief.json --verbose`);
                process.exit(0);
        }
    }

    if (!config.token && !config.tokenEndpoint) {
        console.error('Error: --token or --token-endpoint is required');
        process.exit(2);
    }
    if (!config.csvPath && !config.briefPath) {
        console.error('Error: --csv or --brief is required');
        process.exit(2);
    }

    return config;
}

// CSV parsing and scoring now use shared module: ./eval-scoring.js
// HTTP request functions now use shared module: ./lib/http.js

// --- Token Manager ---
class TokenManager {
    constructor(tokenEndpoint, initialToken) {
        this.tokenEndpoint = tokenEndpoint;
        this.token = initialToken || null;
        this.expiresAt = null; // Date.now() + expires_in * 1000
    }

    async acquireToken() {
        if (!this.tokenEndpoint) {
            if (!this.token) throw new Error('No token and no token endpoint configured');
            return this.token;
        }

        console.log('Acquiring token from Token Endpoint...');
        const res = await httpRequestWithRetry('GET', this.tokenEndpoint, {}, null, 2);

        if (res.status !== 200) {
            throw new Error(`Token Endpoint returned ${res.status}: ${JSON.stringify(res.data)}`);
        }

        // MCS Token Endpoint returns { Token, Expires_in, ConversationId }
        // or possibly { token, expires_in } — handle both casings
        const token = res.data.Token || res.data.token;
        const expiresIn = res.data.Expires_in || res.data.expires_in || 3600;

        if (!token) {
            throw new Error(`Token Endpoint response missing token: ${JSON.stringify(res.data)}`);
        }

        this.token = token;
        this.expiresAt = Date.now() + (expiresIn * 1000);
        console.log(`Token acquired (expires in ${expiresIn}s)`);
        return this.token;
    }

    async getToken() {
        // If no token yet, acquire one
        if (!this.token) {
            return await this.acquireToken();
        }

        // If we have an expiry time and we're past the refresh threshold, refresh
        if (this.tokenEndpoint && this.expiresAt) {
            const now = Date.now();
            const totalTTL = this.expiresAt - (this.expiresAt - (this.expiresAt - now));
            // Simpler: check if remaining time is less than 20% of original TTL
            const remaining = this.expiresAt - now;
            if (remaining < 60000) { // Less than 60 seconds remaining
                console.log('Token expiring soon, refreshing...');
                return await this.acquireToken();
            }
        }

        return this.token;
    }

    needsRefresh() {
        if (!this.tokenEndpoint || !this.expiresAt) return false;
        const remaining = this.expiresAt - Date.now();
        return remaining < 120000; // Refresh when < 2 minutes remaining
    }

    async refreshIfNeeded() {
        if (this.needsRefresh()) {
            await this.acquireToken();
        }
    }
}

// --- Sign-in Card Detection ---

/**
 * Detect sign-in / OAuth cards in bot activities.
 * MCS agents requiring authentication send OAuthCard or SigninCard attachments.
 * Without detection, these cause silent timeouts — the bot never sends a text reply.
 *
 * @param {Array} activities - All activities from Direct Line
 * @returns {{detected: boolean, cardType: string, signInUrl: string|null}}
 */
function detectSignInCard(activities) {
    for (const a of activities) {
        // Check attachments on message activities
        if (a.attachments && Array.isArray(a.attachments)) {
            for (const att of a.attachments) {
                const contentType = (att.contentType || '').toLowerCase();

                // OAuthCard — MCS standard auth flow
                if (contentType.includes('oauthcard') || contentType === 'application/vnd.microsoft.card.oauth') {
                    const content = att.content || {};
                    return {
                        detected: true,
                        cardType: 'OAuthCard',
                        connectionName: content.connectionName || null,
                        signInUrl: content.buttons?.[0]?.value || content.tokenExchangeResource?.uri || null,
                        text: content.text || 'Sign in required'
                    };
                }

                // SigninCard — legacy auth flow
                if (contentType.includes('signincard') || contentType === 'application/vnd.microsoft.card.signin') {
                    const content = att.content || {};
                    return {
                        detected: true,
                        cardType: 'SigninCard',
                        connectionName: null,
                        signInUrl: content.buttons?.[0]?.value || null,
                        text: content.text || 'Sign in required'
                    };
                }
            }
        }

        // Check for invoke activities with signin type
        if (a.type === 'invoke' && a.name === 'signin/tokenExchange') {
            return {
                detected: true,
                cardType: 'TokenExchange',
                connectionName: a.value?.connectionName || null,
                signInUrl: null,
                text: 'Token exchange requested'
            };
        }
    }

    return { detected: false, cardType: null, signInUrl: null, text: null };
}

// --- Tool Invocation Extraction ---

/**
 * Recursively extract tool/action names from a trace or event value object.
 */
function extractToolsFromValue(value, toolsSet) {
    if (!value || typeof value !== 'object') return;

    // Direct tool name fields
    for (const key of ['toolName', 'actionName', 'operationId', 'name']) {
        if (typeof value[key] === 'string' && value[key].length > 0 && value[key].length < 200) {
            toolsSet.add(value[key]);
        }
    }

    // Plan actions array (e.g., channelData.plan.actions[])
    if (Array.isArray(value.actions)) {
        for (const action of value.actions) {
            if (typeof action === 'string') toolsSet.add(action);
            else if (action && typeof action.name === 'string') toolsSet.add(action.name);
            else if (action && typeof action === 'object') extractToolsFromValue(action, toolsSet);
        }
    }

    // Recurse into nested objects (1 level deep to avoid infinite recursion)
    for (const key of Object.keys(value)) {
        if (typeof value[key] === 'object' && value[key] !== null && !Array.isArray(value[key]) && key !== 'from') {
            extractToolsFromValue(value[key], toolsSet);
        }
    }
}

/**
 * Extract tool/action names from all Direct Line activities.
 * Deliberately broad — logs all captures in verbose mode.
 *
 * @param {Array} activities - All activities from Direct Line
 * @param {boolean} [verbose=false] - Log captured activities for debugging
 * @returns {string[]} - Deduplicated tool names
 */
function extractToolInvocations(activities, verbose) {
    const tools = new Set();

    for (const a of activities) {
        // Trace activities — primary source of tool invocation info
        if (a.type === 'trace') {
            if (verbose) console.log(`    [trace] name=${a.name}, valueType=${typeof a.value}`);
            if (a.name) tools.add(a.name);
            if (a.value) extractToolsFromValue(a.value, tools);
        }

        // Event activities
        if (a.type === 'event') {
            if (verbose) console.log(`    [event] name=${a.name}, valueType=${typeof a.value}`);
            if (a.name) tools.add(a.name);
            if (a.value) extractToolsFromValue(a.value, tools);
        }

        // Channel data on any activity type
        if (a.channelData) {
            extractToolsFromValue(a.channelData, tools);
        }
    }

    // Filter out generic/noise names
    const noise = new Set(['message', 'typing', 'conversationUpdate', 'endOfConversation', 'test-user']);
    return [...tools].filter(t => !noise.has(t));
}

// --- Direct Line Client ---
class DirectLineClient {
    constructor(tokenManager, endpoint) {
        this.tokenManager = tokenManager;
        this.endpoint = endpoint;
        this.conversationId = null;
        this.watermark = null;
    }

    async startConversation() {
        const token = await this.tokenManager.getToken();
        const res = await httpRequestWithRetry('POST', `${this.endpoint}/conversations`, {
            Authorization: `Bearer ${token}`
        });

        if (res.status === 401 || res.status === 403) {
            // Token may have expired — try refresh and retry once
            if (this.tokenManager.tokenEndpoint) {
                console.log('  Auth failed, refreshing token...');
                const newToken = await this.tokenManager.acquireToken();
                const retryRes = await httpRequest('POST', `${this.endpoint}/conversations`, {
                    Authorization: `Bearer ${newToken}`
                });
                if (retryRes.status !== 201 && retryRes.status !== 200) {
                    throw new Error(`Failed to start conversation after token refresh: ${retryRes.status} ${JSON.stringify(retryRes.data)}`);
                }
                this.conversationId = retryRes.data.conversationId;
                if (retryRes.data.token) this.tokenManager.token = retryRes.data.token;
                return this.conversationId;
            }
            throw new Error(`Auth failed (${res.status}). Token may be expired.`);
        }

        if (res.status !== 201 && res.status !== 200) {
            throw new Error(`Failed to start conversation: ${res.status} ${JSON.stringify(res.data)}`);
        }

        this.conversationId = res.data.conversationId;
        // Update token if refreshed by Direct Line
        if (res.data.token) this.tokenManager.token = res.data.token;
        return this.conversationId;
    }

    async sendMessage(text) {
        const token = await this.tokenManager.getToken();
        const res = await httpRequestWithRetry('POST',
            `${this.endpoint}/conversations/${this.conversationId}/activities`,
            { Authorization: `Bearer ${token}` },
            { type: 'message', from: { id: 'test-user' }, text }
        );

        if (res.status === 401 && this.tokenManager.tokenEndpoint) {
            console.log('  Auth failed on send, refreshing token...');
            const newToken = await this.tokenManager.acquireToken();
            const retryRes = await httpRequest('POST',
                `${this.endpoint}/conversations/${this.conversationId}/activities`,
                { Authorization: `Bearer ${newToken}` },
                { type: 'message', from: { id: 'test-user' }, text }
            );
            if (retryRes.status !== 200 && retryRes.status !== 201) {
                throw new Error(`Failed to send message after token refresh: ${retryRes.status}`);
            }
            return retryRes.data.id;
        }

        if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Failed to send message: ${res.status} ${JSON.stringify(res.data)}`);
        }

        return res.data.id;
    }

    /**
     * Poll for the agent's response.
     *
     * @param {number} timeoutMs - Max wait time
     * @param {boolean} [enhancedCapture=false] - When true, returns structured object with all activities
     * @returns {string | {text: string, allActivities: Array, toolInvocations: string[]}}
     */
    async getResponse(timeoutMs, enhancedCapture) {
        const start = Date.now();
        const allActivities = enhancedCapture ? new Map() : null; // keyed by activity id

        while (Date.now() - start < timeoutMs) {
            const token = await this.tokenManager.getToken();
            const wmParam = this.watermark ? `?watermark=${this.watermark}` : '';
            const res = await httpRequest('GET',
                `${this.endpoint}/conversations/${this.conversationId}/activities${wmParam}`,
                { Authorization: `Bearer ${token}` }
            );

            if (res.status === 401 && this.tokenManager.tokenEndpoint) {
                console.log('  Auth failed on poll, refreshing token...');
                await this.tokenManager.acquireToken();
                await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
                continue;
            }

            if (res.status === 200 && res.data.activities) {
                // Collect all activities for enhanced capture (dedup by id)
                if (allActivities) {
                    for (const a of res.data.activities) {
                        if (a.id) allActivities.set(a.id, a);
                    }
                }

                // Detect sign-in cards — agent requires authentication
                const signIn = detectSignInCard(res.data.activities);
                if (signIn.detected) {
                    this.watermark = res.data.watermark;
                    const signInText = `[SIGN_IN_REQUIRED] ${signIn.cardType}: ${signIn.text}` +
                        (signIn.connectionName ? ` (connection: ${signIn.connectionName})` : '');

                    if (enhancedCapture) {
                        const activitiesArr = allActivities ? [...allActivities.values()] : res.data.activities;
                        return {
                            text: signInText,
                            allActivities: activitiesArr,
                            toolInvocations: extractToolInvocations(activitiesArr, false),
                            signIn
                        };
                    }
                    return signInText;
                }

                // Filter to bot responses only (not our own messages)
                const botMessages = res.data.activities.filter(a =>
                    a.type === 'message' && a.from && a.from.id !== 'test-user'
                );

                if (botMessages.length > 0) {
                    this.watermark = res.data.watermark;
                    const lastMsg = botMessages[botMessages.length - 1];
                    const text = lastMsg.text || '[No text - check attachments]';

                    if (enhancedCapture) {
                        const activitiesArr = [...allActivities.values()];
                        return {
                            text,
                            allActivities: activitiesArr,
                            toolInvocations: extractToolInvocations(activitiesArr, false)
                        };
                    }
                    return text;
                }
            }

            // Wait before polling again
            await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        }

        const timeoutText = '[TIMEOUT - No response within ' + (timeoutMs / 1000) + 's]';
        if (enhancedCapture) {
            const activitiesArr = allActivities ? [...allActivities.values()] : [];
            return {
                text: timeoutText,
                allActivities: activitiesArr,
                toolInvocations: extractToolInvocations(activitiesArr, false)
            };
        }
        return timeoutText;
    }
}

// Scoring functions now imported from shared module (./eval-scoring.js)
// evaluateResult() handles all 7 methods (6 MCS native + PlanValidation)
// including display-name aliases and legacy PartialMatch → KeywordMatch mapping

// --- Write partial results (for failover support) ---
function writeResults(config, results, testCases, status, failedAtIndex) {
    const passed = results.filter(r => r.pass).length;
    const total = testCases.length;

    const output = {
        status, // "complete", "partial", "error"
        summary: {
            total,
            executed: results.length,
            passed,
            failed: results.length - passed,
            remaining: total - results.length,
            passRate: results.length > 0 ? `${Math.round(passed / results.length * 100)}%` : '0%'
        },
        timestamp: new Date().toISOString(),
        method: 'DirectLine',
        ...(failedAtIndex !== undefined && { failedAt: failedAtIndex }),
        results: results.map(r => ({
            ...r,
            ...(r.turnResults ? { turnResults: r.turnResults } : {}),
            ...(r.toolInvocations ? { toolInvocations: r.toolInvocations } : {})
        }))
    };

    const basePath = config.briefPath || config.csvPath;
    const resultsPath = basePath.replace(/\.(csv|json)$/, '-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(output, null, 2));
    return resultsPath;
}

// --- Main Runner ---
async function runTests() {
    const config = parseArgs();

    // Load test cases from CSV or brief.json
    let testCases;
    let inputSource;

    if (config.briefPath) {
        const { tests, agentName } = parseEvalSets(config.briefPath, config.filterSets);
        testCases = tests.map(t => ({
            ...t,
            expectedResponse: t.expected || '',
            testMethodType: t.methods && t.methods[0] ? t.methods[0].type : 'GeneralQuality',
            passingScore: t.methods && t.methods[0] && t.methods[0].score ? t.methods[0].score : 70
        }));
        inputSource = `brief.json (${agentName})`;
        if (config.filterSets) inputSource += ` [sets: ${config.filterSets.join(', ')}]`;
    } else {
        const csvContent = fs.readFileSync(config.csvPath, 'utf8');
        testCases = parseCSV(csvContent);
        inputSource = `CSV: ${config.csvPath}`;
    }

    const multiTurnCount = testCases.filter(tc => tc.turns && tc.turns.length > 0).length;
    const planValidationCount = testCases.filter(tc => tc.expectedTools).length;

    // GPT-enhanced scoring check
    if (config.gpt) {
        try {
            const { isConfigured, getActiveMethod } = require('./lib/openai');
            if (!isConfigured()) {
                console.log('Warning: --gpt flag set but GPT not configured. Falling back to heuristic scoring.');
                console.log('  Run: gh auth login && gh auth refresh --scopes copilot');
                config.gpt = false;
            } else {
                config._gptMethod = getActiveMethod();
            }
        } catch {
            console.log('Warning: --gpt flag set but openai.js not available. Falling back to heuristic scoring.');
            config.gpt = false;
        }
    }

    console.log(`\n=== Direct Line Test Runner ===`);
    console.log(`Test cases: ${testCases.length}`);
    if (multiTurnCount > 0) console.log(`  Multi-turn: ${multiTurnCount} (${testCases.filter(tc => tc.turns).reduce((s, tc) => s + tc.turns.length, 0)} total turns)`);
    if (planValidationCount > 0) console.log(`  Plan validation: ${planValidationCount}`);
    console.log(`Endpoint: ${config.endpoint}`);
    console.log(`Timeout: ${config.timeout}ms`);
    if (config.gpt) console.log(`Scoring: GPT-enhanced via ${config._gptMethod || 'unknown'} (CompareMeaning + GeneralQuality)`);
    console.log(`Token source: ${config.tokenEndpoint ? 'Token Endpoint (auto)' : 'Manual token'}`);
    console.log(`Input: ${inputSource}\n`);

    // Initialize token manager
    const tokenManager = new TokenManager(config.tokenEndpoint || null, config.token || null);

    // Acquire initial token if using token endpoint
    if (config.tokenEndpoint) {
        try {
            await tokenManager.acquireToken();
        } catch (err) {
            console.error(`Fatal: Failed to acquire token: ${err.message}`);
            writeResults(config, [], testCases, 'error');
            process.exit(2);
        }
    }

    const client = new DirectLineClient(tokenManager, config.endpoint);
    const results = [];

    for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        const questionPreview = tc.question.length > 60 ? tc.question.substring(0, 57) + '...' : tc.question;
        const isMultiTurn = tc.turns && tc.turns.length > 0;
        const hasPlanValidation = !!tc.expectedTools;
        const label = isMultiTurn ? `[multi-turn, ${tc.turns.length} turns]` : hasPlanValidation ? '[plan-validation]' : '';
        console.log(`[${i + 1}/${testCases.length}] Testing: "${questionPreview}" ${label}`);

        // Refresh token proactively between tests if needed
        try {
            await tokenManager.refreshIfNeeded();
        } catch (err) {
            console.log(`  Warning: Token refresh failed: ${err.message}`);
        }

        try {
            if (isMultiTurn) {
                // --- Multi-turn path ---
                await client.startConversation();

                const turnResults = [];
                let aborted = false;

                for (let t = 0; t < tc.turns.length; t++) {
                    const turn = tc.turns[t];
                    const turnPreview = turn.question.length > 50 ? turn.question.substring(0, 47) + '...' : turn.question;
                    console.log(`  Turn ${t + 1}/${tc.turns.length}: "${turnPreview}"${turn.critical ? ' [critical]' : ''}`);

                    await client.sendMessage(turn.question);
                    const resp = await client.getResponse(config.timeout, true);
                    const text = typeof resp === 'string' ? resp : resp.text;
                    const toolInvocations = typeof resp === 'object' ? resp.toolInvocations : [];

                    if (config.verbose) {
                        console.log(`    Response: ${text.substring(0, 80)}`);
                        if (toolInvocations.length > 0) console.log(`    Tools: ${toolInvocations.join(', ')}`);
                    }

                    turnResults.push({
                        turnIndex: t,
                        question: turn.question,
                        expected: turn.expected || null,
                        critical: !!turn.critical,
                        actual: text,
                        toolInvocations
                    });

                    // Small delay between turns
                    await new Promise(r => setTimeout(r, 300));
                }

                // Score the multi-turn sequence
                const methods = tc.methods || [];
                const evaluation = evaluateMultiTurn(turnResults, methods, tc.expectedTools || null);

                results.push({
                    ...tc,
                    actualResponse: turnResults[turnResults.length - 1]?.actual || '',
                    actual: turnResults[turnResults.length - 1]?.actual || '',
                    pass: evaluation.pass,
                    score: evaluation.score,
                    methodResults: evaluation.methodResults,
                    turnResults: evaluation.turnResults,
                    toolInvocations: turnResults.flatMap(t => t.toolInvocations || [])
                });

                const status = evaluation.pass ? 'PASS' : 'FAIL';
                console.log(`  ${status} (score: ${evaluation.score}, ${evaluation.turnResults.filter(t => t.critical && t.pass !== null).length} critical turns)`);

            } else if (hasPlanValidation) {
                // --- Single-turn with plan validation ---
                await client.startConversation();
                await client.sendMessage(tc.question);

                // Enhanced capture to get tool invocations
                const resp = await client.getResponse(config.timeout, true);
                const text = typeof resp === 'string' ? resp : resp.text;
                const toolInvocations = typeof resp === 'object' ? resp.toolInvocations : [];

                if (config.verbose) {
                    console.log(`  Tools captured: ${toolInvocations.length > 0 ? toolInvocations.join(', ') : '(none)'}`);
                    if (typeof resp === 'object' && resp.allActivities) {
                        console.log(`  Activities: ${resp.allActivities.length} total (${resp.allActivities.filter(a => a.type === 'trace').length} traces, ${resp.allActivities.filter(a => a.type === 'event').length} events)`);
                    }
                }

                // Evaluate with tool invocations
                const methods = tc.methods || [];
                const evaluation = config.gpt
                    ? await evaluateAllMethodsAsync(text, tc.expectedResponse, methods, toolInvocations, tc.keywords)
                    : evaluateAllMethods(text, tc.expectedResponse, methods, toolInvocations, tc.keywords);

                results.push({
                    ...tc,
                    actualResponse: text,
                    actual: text,
                    pass: evaluation.pass,
                    score: evaluation.score,
                    methodResults: evaluation.methodResults,
                    toolInvocations
                });

                const status = evaluation.pass ? 'PASS' : 'FAIL';
                console.log(`  ${status} (score: ${evaluation.score}, tools: [${toolInvocations.join(', ')}])`);

            } else {
                // --- Standard single-turn path (unchanged behavior) ---
                await client.startConversation();
                await client.sendMessage(tc.question);

                const response = await client.getResponse(config.timeout);

                // Detect sign-in card in standard path — abort early
                if (typeof response === 'string' && response.startsWith('[SIGN_IN_REQUIRED]')) {
                    results.push({
                        ...tc,
                        actualResponse: response,
                        actual: response,
                        pass: false,
                        score: 0,
                        error: response
                    });
                    console.log(`  SIGN_IN: ${response}`);
                    console.log('\n  Agent requires authentication. Configure user auth or use a token with auth context.');
                    console.log('  Stopping test run — all subsequent tests will fail for the same reason.');
                    const resultsPath = writeResults(config, results, testCases, 'partial', i);
                    console.log(`  Partial results saved to: ${resultsPath}`);
                    process.exit(2);
                }

                const result = config.gpt
                    ? await evaluateResultAsync(response, tc.expectedResponse, tc.testMethodType, tc.passingScore, undefined, tc.keywords)
                    : evaluateResult(response, tc.expectedResponse, tc.testMethodType, tc.passingScore, undefined, tc.keywords);

                results.push({
                    ...tc,
                    actualResponse: response,
                    actual: response,
                    pass: result.pass,
                    score: result.score,
                    error: result.error,
                    ...(result.reasoning ? { reasoning: result.reasoning } : {}),
                    ...(result.source ? { scoringSource: result.source } : {})
                });

                const status = result.pass ? 'PASS' : 'FAIL';
                const srcLabel = result.source ? ` [${result.source}]` : '';
                console.log(`  ${status} (score: ${result.score}, method: ${tc.testMethodType}${srcLabel})`);

                if (config.verbose && !result.pass) {
                    console.log(`  Expected: ${tc.expectedResponse.substring(0, 100)}`);
                    console.log(`  Actual:   ${response.substring(0, 100)}`);
                }
            }

        } catch (err) {
            results.push({
                ...tc,
                actualResponse: '',
                actual: '',
                pass: false,
                score: 0,
                error: err.message
            });
            console.log(`  ERROR: ${err.message}`);

            // Check if this is a fatal error that should stop the run
            const isFatal = err.message.includes('Auth failed') ||
                            err.message.includes('token') ||
                            err.message.includes('ECONNREFUSED') ||
                            err.message.includes('ENOTFOUND') ||
                            err.message.includes('SIGN_IN_REQUIRED');

            if (isFatal && i < testCases.length - 1) {
                console.log(`\n  Fatal error detected — writing partial results and stopping.`);
                const resultsPath = writeResults(config, results, testCases, 'partial', i);
                console.log(`  Partial results (${results.length}/${testCases.length}) saved to: ${resultsPath}`);
                process.exit(2);
            }
        }

        // Small delay between tests to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
    }

    // --- Report ---
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`RESULTS: ${passed}/${results.length} passed (${Math.round(passed / results.length * 100)}%)`);
    console.log(`${'='.repeat(60)}`);

    if (failed > 0) {
        console.log(`\nFailed tests:`);
        results.filter(r => !r.pass).forEach((r, idx) => {
            const method = r.testMethodType || (r.methods && r.methods[0] ? r.methods[0].type : 'N/A');
            console.log(`\n  ${idx + 1}. [${method}] "${r.question}"`);
            if (r.turnResults) {
                console.log(`     Multi-turn: ${r.turnResults.length} turns, ${r.turnResults.filter(t => t.critical).length} critical`);
                r.turnResults.filter(t => t.critical && t.pass === false).forEach(t => {
                    console.log(`     Turn ${t.turnIndex + 1} FAIL: "${t.question.substring(0, 60)}" → "${(t.actual || '').substring(0, 60)}"`);
                });
            } else {
                console.log(`     Expected: ${(r.expectedResponse || '').substring(0, 150)}`);
                console.log(`     Actual:   ${(r.actualResponse || r.error || 'N/A').substring(0, 150)}`);
            }
            if (r.toolInvocations && r.toolInvocations.length > 0) {
                console.log(`     Tools: [${r.toolInvocations.join(', ')}]`);
            }
            console.log(`     Score: ${r.score}${r.passingScore ? ` (needed: ${r.passingScore})` : ''}`);
        });
    }

    // GPT usage summary
    if (config.gpt) {
        try {
            const { getUsageSummary } = require('./lib/openai');
            const usage = getUsageSummary();
            if (usage.calls > 0) {
                console.log(`\nGPT scoring: ${usage.calls} calls, ${usage.inputTokens + usage.outputTokens} tokens, ~$${usage.cost.toFixed(4)}`);
            }
        } catch { /* ignore */ }
    }

    // Write complete results
    const resultsPath = writeResults(config, results, testCases, 'complete');
    console.log(`\nDetailed results saved to: ${resultsPath}`);

    // Exit with failure code if any tests failed
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(2);
});
