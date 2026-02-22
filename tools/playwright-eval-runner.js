/**
 * Playwright Eval Runner — Test Plan Generator & Scorer
 *
 * Works with the mcs-eval skill to run evals via Playwright Test Chat.
 * This runner does NOT drive Playwright directly — it generates a structured
 * test plan that Claude's eval skill executes step-by-step, then scores results.
 *
 * Usage:
 *   node tools/playwright-eval-runner.js --brief <path> --action plan [--set critical,functional]
 *   node tools/playwright-eval-runner.js --brief <path> --action score --results <path>
 *   node tools/playwright-eval-runner.js --brief <path> --action detect-tier
 *
 * Actions:
 *   plan        → Output ordered test plan JSON (boundary tests first, tool tests after)
 *   score       → Read results JSON, score each test, write to brief.json
 *   detect-tier → Check brief.json integrations for MCP tools, recommend tier
 *
 * The test plan groups tests by reset need:
 *   - Boundary/decline tests: fast (~5s), no session reset needed between them
 *   - Tool-calling tests: slow (~60-90s), need fresh session per test
 */

const fs = require('fs');
const path = require('path');
const {
    evaluateAllMethods,
    parseEvalSets,
    writeResultsToBrief,
    writeOneResultToBrief
} = require('./eval-scoring');

// --- Configuration ---
const BOUNDARY_SETS = ['critical'];  // Sets whose tests are typically fast boundary checks
const BOUNDARY_KEYWORDS = [
    'can\'t', 'cannot', 'don\'t', 'do not', 'unable', 'outside',
    'scope', 'boundary', 'refuse', 'decline', 'inappropriate',
    'not able', 'not designed', 'specialize', 'only help with'
];
const FAST_TEST_TIME_S = 5;
const SLOW_TEST_TIME_S = 90;
const SESSION_RESET_TIME_S = 10;

// --- CLI Args ---
function parseArgs() {
    const args = process.argv.slice(2);
    const config = {};

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--brief': config.briefPath = args[++i]; break;
            case '--action': config.action = args[++i]; break;
            case '--results': config.resultsPath = args[++i]; break;
            case '--set': config.filterSets = args[++i].split(',').map(s => s.trim()); break;
            case '--help':
                console.log(`Playwright Eval Runner — Test Plan Generator & Scorer

Usage:
  node playwright-eval-runner.js --brief <path> --action plan [--set critical,functional]
  node playwright-eval-runner.js --brief <path> --action score --results <path>
  node playwright-eval-runner.js --brief <path> --action detect-tier

Actions:
  plan        Generate ordered test plan JSON for Playwright execution
  score       Score results and write to brief.json
  detect-tier Check if agent needs Playwright (MCP tools) or can use Direct Line

Options:
  --brief <path>    Path to brief.json (required)
  --results <path>  Path to results JSON (required for score action)
  --set <names>     Comma-separated set names to include (default: all)`);
                process.exit(0);
        }
    }

    if (!config.briefPath) {
        console.error('Error: --brief is required');
        process.exit(2);
    }
    if (!config.action) {
        console.error('Error: --action is required (plan|score|detect-tier)');
        process.exit(2);
    }
    if (config.action === 'score' && !config.resultsPath) {
        console.error('Error: --results is required for score action');
        process.exit(2);
    }

    return config;
}

// --- Test Classification ---

/**
 * Classify a test as "boundary" (fast, no reset needed) or "tool" (slow, needs reset).
 * Boundary tests typically expect decline/refusal responses.
 */
function classifyTest(test) {
    // Critical set tests are almost always boundary tests
    if (BOUNDARY_SETS.includes(test.setName)) {
        return 'boundary';
    }

    // Check if expected response contains boundary/decline keywords
    const expectedLower = (test.expected || '').toLowerCase();
    const hasBoundaryKeywords = BOUNDARY_KEYWORDS.some(kw => expectedLower.includes(kw));
    if (hasBoundaryKeywords) {
        return 'boundary';
    }

    // Check methods — ExactMatch and KeywordMatch on short expected = likely boundary
    const hasExactMatch = test.methods.some(m =>
        (m.type || '').toLowerCase().includes('exact'));
    if (hasExactMatch && (test.expected || '').length < 100) {
        return 'boundary';
    }

    // Default: tool-calling test (needs reset, slow)
    return 'tool';
}

// --- Plan Action ---

function generatePlan(config) {
    const { tests, evalConfig, agentName } = parseEvalSets(config.briefPath, config.filterSets);

    if (tests.length === 0) {
        console.log(JSON.stringify({
            error: 'No tests found in eval sets',
            agentName,
            tests: [],
            summary: { total: 0, fast: 0, slow: 0, estimatedMinutes: 0 }
        }, null, 2));
        return;
    }

    // Classify each test
    const classified = tests.map(t => ({
        ...t,
        type: classifyTest(t),
        estimatedTime: classifyTest(t) === 'boundary' ? `${FAST_TEST_TIME_S}s` : `${SLOW_TEST_TIME_S}s`
    }));

    // Sort: boundary tests first (fast feedback), then tool tests
    // Within each group, preserve original order (set order, then test order within set)
    const boundaryTests = classified.filter(t => t.type === 'boundary');
    const toolTests = classified.filter(t => t.type === 'tool');

    const ordered = [...boundaryTests, ...toolTests];

    // Assign needsReset: first test always needs reset, boundary-to-boundary = no reset,
    // any tool test = needs reset, transition from boundary to tool = needs reset
    for (let i = 0; i < ordered.length; i++) {
        if (i === 0) {
            ordered[i].needsReset = true;
        } else if (ordered[i].type === 'tool') {
            ordered[i].needsReset = true;
        } else if (ordered[i].type === 'boundary' && ordered[i - 1].type === 'boundary') {
            ordered[i].needsReset = false;
        } else {
            ordered[i].needsReset = true;
        }
    }

    // Compute estimates
    const fastCount = boundaryTests.length;
    const slowCount = toolTests.length;
    const resetCount = ordered.filter(t => t.needsReset).length;
    const estimatedSeconds = (fastCount * FAST_TEST_TIME_S) + (slowCount * SLOW_TEST_TIME_S)
        + (resetCount * SESSION_RESET_TIME_S);
    const estimatedMinutes = Math.ceil(estimatedSeconds / 60);

    // Build output plan (strip internal fields, keep what the eval skill needs)
    const planTests = ordered.map((t, idx) => ({
        id: t.id,
        order: idx,
        set: t.setName,
        setIndex: t.setIndex,
        testIndex: t.testIndex,
        question: t.question,
        expected: t.expected,
        capability: t.capability,
        methods: t.methods,
        type: t.type,
        needsReset: t.needsReset,
        estimatedTime: t.estimatedTime
    }));

    const plan = {
        agentName,
        evalConfig,
        tests: planTests,
        summary: {
            total: ordered.length,
            fast: fastCount,
            slow: slowCount,
            resetCount,
            estimatedMinutes,
            setBreakdown: {}
        }
    };

    // Set breakdown
    const setNames = [...new Set(ordered.map(t => t.setName))];
    for (const name of setNames) {
        const setTests = ordered.filter(t => t.setName === name);
        plan.summary.setBreakdown[name] = {
            total: setTests.length,
            fast: setTests.filter(t => t.type === 'boundary').length,
            slow: setTests.filter(t => t.type === 'tool').length
        };
    }

    console.log(JSON.stringify(plan, null, 2));
}

// --- Score Action ---

function scoreResults(config) {
    const resultsData = JSON.parse(fs.readFileSync(config.resultsPath, 'utf8'));
    const results = resultsData.results || resultsData;

    if (!Array.isArray(results) || results.length === 0) {
        console.error('Error: results file contains no results array');
        process.exit(2);
    }

    const { tests: allTests, agentName } = parseEvalSets(config.briefPath, config.filterSets);

    // Build lookup by ID
    const testLookup = {};
    for (const t of allTests) {
        testLookup[t.id] = t;
    }

    const scored = [];
    let passed = 0;
    let failed = 0;

    for (const r of results) {
        const testInfo = testLookup[r.id];
        if (!testInfo) {
            console.error(`Warning: result ID ${r.id} not found in eval sets — skipping`);
            continue;
        }

        const actual = r.actual || '';
        const expected = testInfo.expected || '';
        const methods = testInfo.methods || [];

        const evaluation = evaluateAllMethods(actual, expected, methods);

        const scoredResult = {
            id: r.id,
            setName: testInfo.setName,
            setIndex: testInfo.setIndex,
            testIndex: testInfo.testIndex,
            question: testInfo.question,
            expected,
            actual,
            pass: evaluation.pass,
            score: evaluation.score,
            methodResults: evaluation.methodResults
        };

        scored.push(scoredResult);

        if (evaluation.pass) passed++;
        else failed++;
    }

    // Write results to brief.json
    writeResultsToBrief(config.briefPath, scored);

    // Build per-set summary
    const setNames = [...new Set(scored.map(s => s.setName))];
    const perSet = {};
    for (const name of setNames) {
        const setResults = scored.filter(s => s.setName === name);
        const setPassed = setResults.filter(s => s.pass).length;
        perSet[name] = {
            total: setResults.length,
            passed: setPassed,
            failed: setResults.length - setPassed,
            passRate: `${Math.round((setPassed / setResults.length) * 100)}%`
        };
    }

    // Write detailed results file
    const detailedOutput = {
        status: 'complete',
        method: 'PlaywrightTestChat',
        agentName,
        timestamp: new Date().toISOString(),
        summary: {
            total: scored.length,
            executed: scored.length,
            passed,
            failed,
            remaining: 0,
            passRate: `${Math.round((passed / scored.length) * 100)}%`
        },
        perSet,
        results: scored
    };

    const detailedPath = config.briefPath.replace('brief.json', 'evals-results.json');
    fs.writeFileSync(detailedPath, JSON.stringify(detailedOutput, null, 2));

    // Output summary to stdout
    const output = {
        agentName,
        summary: detailedOutput.summary,
        perSet,
        briefUpdated: true,
        resultsFile: detailedPath,
        failedTests: scored.filter(s => !s.pass).map(s => ({
            set: s.setName,
            question: s.question.substring(0, 80),
            expected: s.expected.substring(0, 80),
            actual: s.actual.substring(0, 80),
            score: s.score
        }))
    };

    console.log(JSON.stringify(output, null, 2));
}

// --- Detect Tier Action ---

function detectTier(config) {
    const brief = JSON.parse(fs.readFileSync(config.briefPath, 'utf8'));
    const integrations = brief.integrations || [];
    const tools = brief.tools || [];

    // Check if any integration uses MCP (requires user-delegated auth)
    const mcpIntegrations = integrations.filter(i =>
        (i.type || '').toLowerCase() === 'mcp' ||
        (i.connectionType || '').toLowerCase() === 'mcp'
    );

    // Check if tools reference MCP-based connectors
    const mcpTools = tools.filter(t =>
        (t.type || '').toLowerCase() === 'mcp' ||
        (t.source || '').toLowerCase() === 'mcp'
    );

    // Check for specific known MCP tools that need user delegation
    const userDelegatedTools = tools.filter(t => {
        const name = (t.name || '').toLowerCase();
        return name.includes('outlook') ||
            name.includes('calendar') ||
            name.includes('teams') ||
            name.includes('user profile') ||
            name.includes('onedrive') ||
            name.includes('sharepoint') ||
            name.includes('planner');
    });

    const hasMCP = mcpIntegrations.length > 0 || mcpTools.length > 0;
    const hasUserDelegated = userDelegatedTools.length > 0;
    const needsPlaywright = hasMCP || hasUserDelegated;

    const result = {
        recommendedTier: needsPlaywright ? 2 : 1,
        reason: needsPlaywright
            ? `Agent uses ${hasMCP ? 'MCP tools' : 'user-delegated tools'} — Direct Line cannot authenticate users for these. Use Playwright Test Chat.`
            : 'No MCP or user-delegated tools detected. Direct Line API is preferred (faster, more reliable).',
        mcpIntegrations: mcpIntegrations.map(i => i.name || i.type),
        userDelegatedTools: userDelegatedTools.map(t => t.name),
        mcpToolCount: mcpTools.length,
        details: {
            tier1: 'Direct Line API — ~2s/test, auto-token, retry with backoff',
            tier2: 'Playwright Test Chat — ~5-90s/test depending on tools, no token needed'
        }
    };

    console.log(JSON.stringify(result, null, 2));
}

// --- Main ---

function main() {
    const config = parseArgs();

    // Verify brief.json exists
    if (!fs.existsSync(config.briefPath)) {
        console.error(`Error: brief.json not found at ${config.briefPath}`);
        process.exit(2);
    }

    switch (config.action) {
        case 'plan':
            generatePlan(config);
            break;
        case 'score':
            scoreResults(config);
            break;
        case 'detect-tier':
            detectTier(config);
            break;
        default:
            console.error(`Error: Unknown action '${config.action}'. Use: plan, score, detect-tier`);
            process.exit(2);
    }
}

main();
