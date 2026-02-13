/**
 * Direct Line API Test Runner for Copilot Studio Agents
 *
 * Sends test messages to an MCS agent via Direct Line API and compares
 * responses against expected results from evals.csv.
 *
 * Usage:
 *   node tools/direct-line-test.js --token <DL_TOKEN> --csv <path/to/evals.csv>
 *   node tools/direct-line-test.js --token <DL_TOKEN> --csv <path/to/evals.csv> --endpoint <DL_ENDPOINT>
 *
 * The token can be obtained from:
 *   - Copilot Studio → Settings → Security → Web channel security → Copy token
 *   - Dataverse API: PvaGetDirectLineEndpoint bound action on the bot entity
 *   - PAC CLI output (if available)
 *
 * CSV format (same as MCS native eval):
 *   "question","expectedResponse","testMethodType","passingScore"
 */

const fs = require('fs');
const https = require('https');
const { URL } = require('url');

// --- Configuration ---
const DEFAULT_ENDPOINT = 'https://directline.botframework.com/v3/directline';
const RESPONSE_TIMEOUT_MS = 30000; // 30 seconds max wait per message
const POLL_INTERVAL_MS = 1000;     // Poll every 1 second

// --- Parse CLI Args ---
function parseArgs() {
    const args = process.argv.slice(2);
    const config = { endpoint: DEFAULT_ENDPOINT };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--token': config.token = args[++i]; break;
            case '--csv': config.csvPath = args[++i]; break;
            case '--endpoint': config.endpoint = args[++i]; break;
            case '--verbose': config.verbose = true; break;
            case '--help':
                console.log('Usage: node direct-line-test.js --token <TOKEN> --csv <path/to/evals.csv> [--endpoint <URL>] [--verbose]');
                process.exit(0);
        }
    }

    if (!config.token) { console.error('Error: --token is required'); process.exit(1); }
    if (!config.csvPath) { console.error('Error: --csv is required'); process.exit(1); }

    return config;
}

// --- CSV Parser (simple, handles quoted fields) ---
function parseCSV(content) {
    const lines = content.trim().split('\n');
    const rows = [];

    for (const line of lines) {
        const fields = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === ',' && !inQuotes) {
                fields.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        fields.push(current.trim());
        rows.push(fields);
    }

    // Skip header row
    const header = rows[0];
    return rows.slice(1).map(row => ({
        question: row[0] || '',
        expectedResponse: row[1] || '',
        testMethodType: row[2] || 'GeneralQuality',
        passingScore: parseInt(row[3]) || 70
    }));
}

// --- HTTP Helper ---
function httpRequest(method, url, headers, body) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const options = {
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            method,
            headers: { ...headers, 'Content-Type': 'application/json' }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data || '{}') });
                } catch {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// --- Direct Line Client ---
class DirectLineClient {
    constructor(token, endpoint) {
        this.token = token;
        this.endpoint = endpoint;
        this.conversationId = null;
        this.watermark = null;
    }

    async startConversation() {
        const res = await httpRequest('POST', `${this.endpoint}/conversations`, {
            Authorization: `Bearer ${this.token}`
        });

        if (res.status !== 201 && res.status !== 200) {
            throw new Error(`Failed to start conversation: ${res.status} ${JSON.stringify(res.data)}`);
        }

        this.conversationId = res.data.conversationId;
        // Update token if refreshed
        if (res.data.token) this.token = res.data.token;
        return this.conversationId;
    }

    async sendMessage(text) {
        const res = await httpRequest('POST',
            `${this.endpoint}/conversations/${this.conversationId}/activities`,
            { Authorization: `Bearer ${this.token}` },
            { type: 'message', from: { id: 'test-user' }, text }
        );

        if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Failed to send message: ${res.status} ${JSON.stringify(res.data)}`);
        }

        return res.data.id;
    }

    async getResponse(timeoutMs = RESPONSE_TIMEOUT_MS) {
        const start = Date.now();

        while (Date.now() - start < timeoutMs) {
            const wmParam = this.watermark ? `?watermark=${this.watermark}` : '';
            const res = await httpRequest('GET',
                `${this.endpoint}/conversations/${this.conversationId}/activities${wmParam}`,
                { Authorization: `Bearer ${this.token}` }
            );

            if (res.status === 200 && res.data.activities) {
                // Filter to bot responses only (not our own messages)
                const botMessages = res.data.activities.filter(a =>
                    a.type === 'message' && a.from && a.from.id !== 'test-user'
                );

                if (botMessages.length > 0) {
                    this.watermark = res.data.watermark;
                    // Return the last bot message (most complete response)
                    const lastMsg = botMessages[botMessages.length - 1];
                    return lastMsg.text || '[No text - check attachments]';
                }
            }

            // Wait before polling again
            await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        }

        return '[TIMEOUT - No response within ' + (timeoutMs / 1000) + 's]';
    }
}

// --- Test Method Evaluators ---
function evaluateResult(actual, expected, method, passingScore) {
    switch (method) {
        case 'ExactMatch':
            return { pass: actual.trim() === expected.trim(), score: actual.trim() === expected.trim() ? 100 : 0 };

        case 'PartialMatch':
            const contains = actual.toLowerCase().includes(expected.toLowerCase());
            return { pass: contains, score: contains ? 100 : 0 };

        case 'TextSimilarity': {
            const score = textSimilarity(actual, expected);
            return { pass: score >= passingScore, score };
        }

        case 'CompareMeaning': {
            // Simplified semantic comparison using keyword overlap
            // In production, use an LLM or embedding model for true semantic comparison
            const score = semanticSimilarity(actual, expected);
            return { pass: score >= passingScore, score };
        }

        case 'GeneralQuality': {
            // Basic quality heuristics - in production, use an LLM judge
            const score = qualityScore(actual, expected);
            return { pass: score >= 50, score };
        }

        default:
            return { pass: false, score: 0, error: `Unknown test method: ${method}` };
    }
}

// Simple text similarity (Jaccard on word tokens)
function textSimilarity(a, b) {
    const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;
    return union === 0 ? 0 : Math.round((intersection / union) * 100);
}

// Simplified semantic similarity (keyword overlap + length ratio)
function semanticSimilarity(actual, expected) {
    const keywordsExpected = expected.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (keywordsExpected.length === 0) return actual.length > 0 ? 70 : 0;

    const actualLower = actual.toLowerCase();
    const hits = keywordsExpected.filter(kw => actualLower.includes(kw)).length;
    const keywordScore = (hits / keywordsExpected.length) * 100;

    // Bonus for reasonable length (not too short, not way too long)
    const lengthRatio = actual.length / Math.max(expected.length, 1);
    const lengthBonus = (lengthRatio >= 0.3 && lengthRatio <= 5) ? 10 : 0;

    return Math.min(100, Math.round(keywordScore + lengthBonus));
}

// Basic quality heuristics
function qualityScore(actual, expected) {
    let score = 0;

    // Not empty
    if (actual.length > 10) score += 20;

    // Contains some expected keywords
    const keywords = expected.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const actualLower = actual.toLowerCase();
    const keywordHits = keywords.filter(kw => actualLower.includes(kw)).length;
    if (keywords.length > 0) score += (keywordHits / keywords.length) * 50;

    // Reasonable length
    if (actual.length > 20 && actual.length < 5000) score += 15;

    // No error indicators
    if (!actualLower.includes('error') && !actualLower.includes('sorry, i can\'t')) score += 15;

    return Math.round(score);
}

// --- Main Runner ---
async function runTests() {
    const config = parseArgs();

    // Read and parse CSV
    const csvContent = fs.readFileSync(config.csvPath, 'utf8');
    const testCases = parseCSV(csvContent);

    console.log(`\n=== Direct Line Test Runner ===`);
    console.log(`Test cases: ${testCases.length}`);
    console.log(`Endpoint: ${config.endpoint}`);
    console.log(`CSV: ${config.csvPath}\n`);

    const client = new DirectLineClient(config.token, config.endpoint);
    const results = [];

    // Start a fresh conversation for each test to avoid context bleed
    for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        console.log(`[${i + 1}/${testCases.length}] Testing: "${tc.question.substring(0, 60)}..."`);

        try {
            // New conversation per test
            await client.startConversation();

            // Send message
            await client.sendMessage(tc.question);

            // Wait for response
            const response = await client.getResponse();

            // Evaluate
            const result = evaluateResult(response, tc.expectedResponse, tc.testMethodType, tc.passingScore);

            results.push({
                ...tc,
                actualResponse: response,
                pass: result.pass,
                score: result.score,
                error: result.error
            });

            const status = result.pass ? 'PASS' : 'FAIL';
            console.log(`  ${status} (score: ${result.score}, method: ${tc.testMethodType})`);

            if (config.verbose && !result.pass) {
                console.log(`  Expected: ${tc.expectedResponse.substring(0, 100)}`);
                console.log(`  Actual:   ${response.substring(0, 100)}`);
            }

        } catch (err) {
            results.push({
                ...tc,
                actualResponse: '',
                pass: false,
                score: 0,
                error: err.message
            });
            console.log(`  ERROR: ${err.message}`);
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
        results.filter(r => !r.pass).forEach((r, i) => {
            console.log(`\n  ${i + 1}. [${r.testMethodType}] "${r.question}"`);
            console.log(`     Expected: ${r.expectedResponse.substring(0, 150)}`);
            console.log(`     Actual:   ${(r.actualResponse || r.error || 'N/A').substring(0, 150)}`);
            console.log(`     Score: ${r.score}${r.passingScore ? ` (needed: ${r.passingScore})` : ''}`);
        });
    }

    // Write detailed results to JSON
    const resultsPath = config.csvPath.replace('.csv', '-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify({
        summary: { total: results.length, passed, failed, passRate: `${Math.round(passed / results.length * 100)}%` },
        timestamp: new Date().toISOString(),
        results
    }, null, 2));
    console.log(`\nDetailed results saved to: ${resultsPath}`);

    // Exit with failure code if any tests failed
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
