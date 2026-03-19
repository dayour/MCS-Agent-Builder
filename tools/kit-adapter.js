/**
 * Kit Adapter — Bridge between MCS Agent Builder CLI and Power-CAT Copilot Studio Kit
 *
 * Maps brief.json eval sets → Kit Dataverse entities (cat_*) and reads Kit data back.
 * This is the AUGMENT integration layer: our CLI remains primary, Kit handles governance,
 * compliance, monitoring, and stakeholder dashboards.
 *
 * Architecture:
 *   brief.json (source of truth) → Kit Adapter → Kit Dataverse (cat_* entities)
 *   Kit Dataverse (governance/analytics) → Kit Adapter → brief.json (enrichment)
 *
 * Auth: az account get-access-token --resource https://<org>.crm.dynamics.com
 *
 * Usage:
 *   node tools/kit-adapter.js status --env <url>
 *   node tools/kit-adapter.js setup-agent --env <url> --brief <path>
 *   node tools/kit-adapter.js sync-tests --env <url> --brief <path> [--config-id <id>]
 *   node tools/kit-adapter.js sync-results --env <url> --brief <path> --run-id <id>
 *   node tools/kit-adapter.js inventory --env <url>
 *   node tools/kit-adapter.js compliance --env <url>
 *
 * Exit codes:
 *   0 = success
 *   1 = partial failure
 *   2 = fatal error
 */

const fs = require('fs');
const path = require('path');
const { httpRequest, httpRequestWithRetry, getToken } = require('./lib/http');

// --- Constants ---
const API = 'api/data/v9.2';

// Kit entity set names (confirmed from dktest + FDE-DEV EntityDefinitions query, March 2026 v20260313.2)
const ENTITIES = {
    configs:     'cat_copilotconfigurations',
    testSets:    'cat_copilottestsets',
    tests:       'cat_copilottests',
    testRuns:    'cat_copilottestruns',
    testResults: 'cat_copilottestresults',
    inventory:   'cat_agentdetailses',
    compliance:  'cat_compliancecases',
    agentCompliance: 'cat_agentcompliances',
    kpis:        'cat_copilotkpis',
    rubrics:     'cat_rubrics',
    rubricExamples: 'cat_rubricexamples',
    reviews:     'cat_agentreviewses',
    cards:       'cat_copilotcards',
    logs:        'cat_copilotstudiokitlogses',
    thresholds:  'cat_thresholdconfigs',
    actions:     'cat_actionpolicies',
    transcripts: 'cat_agenttranscriptses',
    analyzers:   'cat_conversationanalyzers',
    analyzerPrompts: 'cat_conversationanalyzerprompts',
    values:      'cat_agentvalues',
    usage:       'cat_agentusagehistories',
    fileIndexer: 'cat_copilotfileindexerconfigurations',
    pipelines:   'cat_deploymentpipelineconfigurations',
    solutionComponents: 'cat_solutioncomponents',
    solutionReviews:    'cat_solutionreviews',
    patterns:    'cat_patterninstances',
    patternDetails: 'cat_patterndetailses',
    patternIdentifiers: 'cat_patternidentifiers',
    patternResults: 'cat_patternresults',
    chatbotStyles: 'cat_chatbotstyles',
    samples:     'cat_samples',
    customers:   'cat_customers',
    actionMetrics: 'cat_actionmetricses',
    dailyMetrics: 'cat_dailymetricses',
    toolMetrics: 'cat_toolmetricses',
    topicMetrics: 'cat_topicmetricses',
    transcriptMetrics: 'cat_transcriptmetricses',
    errorDetails: 'cat_errordetailses',
    factRowCounts: 'cat_agentfactrowcountses',
    insightsStaging: 'cat_agentinsightstranscriptstagings',
    reviewFre:   'cat_agentreviewfres'
};

// Kit test type mapping (our methods → Kit test types)
const TEST_TYPE_MAP = {
    'GeneralQuality':  1, // Response Match (closest approximation)
    'CompareMeaning':  1, // Response Match with 'contains' operator
    'KeywordMatch':    1, // Response Match with keyword operators
    'TextSimilarity':  1, // Response Match
    'ExactMatch':      1, // Response Match with 'equals' operator
    'ToolUse':         6, // Plan Validation
    'PlanValidation':  6  // Plan Validation
};

// Kit comparison operators
const COMPARISON_OPS = {
    'equals':           1,
    'contains':         2,
    'begins_with':      3,
    'ends_with':        4,
    'doesnt_equal':     5,
    'doesnt_contain':   6,
    'doesnt_begin':     7,
    'doesnt_end':       8,
    'ai_validation':    9
};

// --- CLI ---
function parseArgs() {
    const args = process.argv.slice(2);
    const config = {};

    if (args.length === 0 || args[0] === '--help') {
        printUsage();
        process.exit(0);
    }

    config.command = args[0];

    for (let i = 1; i < args.length; i++) {
        switch (args[i]) {
            case '--env': config.envUrl = args[++i]?.replace(/\/$/, ''); break;
            case '--brief': config.briefPath = args[++i]; break;
            case '--config-id': config.configId = args[++i]; break;
            case '--run-id': config.runId = args[++i]; break;
            case '--agent-name': config.agentName = args[++i]; break;
            case '--token-endpoint': config.tokenEndpoint = args[++i]; break;
            case '--json': config.json = true; break;
        }
    }

    return config;
}

function printUsage() {
    console.log(`Kit Adapter — Bridge between MCS Agent Builder and Power-CAT Kit

Usage: node tools/kit-adapter.js <command> [options]

Commands:
  status          Show Kit installation status and data summary
  setup-agent     Create Kit agent configuration from brief.json
  sync-tests      Push brief.json eval sets to Kit test sets
  sync-results    Pull Kit test results back to brief.json
  inventory       List agents from Kit Agent Inventory
  compliance      List compliance cases

Required:
  --env <url>     Dataverse environment URL (e.g., https://fde-dev.crm.dynamics.com)

Options:
  --brief <path>        Path to brief.json
  --config-id <id>      Kit agent configuration ID
  --run-id <id>         Kit test run ID
  --agent-name <name>   Agent display name (for setup-agent)
  --token-endpoint <url> Agent token endpoint (for setup-agent)
  --json                Output raw JSON`);
}

// --- Helpers ---
function buildHeaders(token) {
    return {
        'Authorization': `Bearer ${token}`,
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        'Accept': 'application/json',
        'Prefer': 'odata.include-annotations="*"'
    };
}

async function dvGet(envUrl, headers, entitySet, query) {
    const url = `${envUrl}/${API}/${entitySet}${query ? '?' + query : ''}`;
    const res = await httpRequestWithRetry('GET', url, headers);
    if (res.status !== 200) throw new Error(`GET ${entitySet} failed: HTTP ${res.status}`);
    return res.data.value || [];
}

async function dvPost(envUrl, headers, entitySet, body) {
    const res = await httpRequest('POST', `${envUrl}/${API}/${entitySet}`,
        { ...headers, 'Content-Type': 'application/json' },
        JSON.stringify(body)
    );
    if (res.status !== 201 && res.status !== 204) {
        throw new Error(`POST ${entitySet} failed: HTTP ${res.status} — ${JSON.stringify(res.data).substring(0, 300)}`);
    }
    // Extract ID from response or Location header
    if (res.data && typeof res.data === 'object') {
        for (const key of Object.keys(res.data)) {
            if (key.endsWith('id') && key.startsWith('cat_')) return res.data[key];
        }
    }
    if (res.headers?.location) {
        const match = res.headers.location.match(/\(([^)]+)\)/);
        if (match) return match[1];
    }
    return null;
}

async function dvCount(envUrl, headers, entitySet) {
    const res = await httpRequest('GET', `${envUrl}/${API}/${entitySet}?$top=0&$count=true`, headers);
    return res.data?.['@odata.count'] ?? (res.data?.value?.length ?? 0);
}

// --- Commands ---

/**
 * status — Show Kit installation state and data counts
 */
async function cmdStatus(envUrl, headers) {
    console.log(`Kit Status: ${envUrl}\n`);

    const checks = [
        ['Agent Configurations', ENTITIES.configs],
        ['Test Sets', ENTITIES.testSets],
        ['Test Runs', ENTITIES.testRuns],
        ['Test Results', ENTITIES.testResults],
        ['Agent Inventory', ENTITIES.inventory],
        ['Compliance Cases', ENTITIES.compliance],
        ['Rubrics', ENTITIES.rubrics],
        ['Conversation KPIs', ENTITIES.kpis],
        ['Adaptive Cards', ENTITIES.cards],
        ['Solution Reviews', ENTITIES.solutionReviews],
        ['Agent Values', ENTITIES.values],
        ['Transcripts', ENTITIES.transcripts],
        ['Pipeline Configs', ENTITIES.pipelines]
    ];

    for (const [label, entity] of checks) {
        try {
            const count = await dvCount(envUrl, headers, entity);
            console.log(`  ${label.padEnd(25)} ${count} records`);
        } catch (e) {
            console.log(`  ${label.padEnd(25)} error: ${e.message.substring(0, 60)}`);
        }
    }

    // Show agent configs detail (query without $select to avoid column name issues)
    try {
        const configs = await dvGet(envUrl, headers, ENTITIES.configs, '$orderby=createdon desc&$top=10');
        if (configs.length > 0) {
            console.log('\nAgent Configurations:');
            configs.forEach(c => {
                const hasToken = c.cat_tokenendpoint && !c.cat_tokenendpoint.startsWith('PENDING');
                console.log(`  ${c.cat_name} — token: ${hasToken ? 'configured' : 'PENDING'}, bot: ${c.cat_copilotid || 'n/a'}`);
            });
        }
    } catch (e) {
        // Ignore — counts above are sufficient
    }
}

/**
 * setup-agent — Create a Kit agent configuration from brief.json or CLI args
 */
async function cmdSetupAgent(envUrl, headers, config) {
    let agentName, tokenEndpoint, region;

    if (config.briefPath) {
        const brief = JSON.parse(fs.readFileSync(config.briefPath, 'utf8'));
        agentName = brief.agents?.[0]?.name || brief.name || 'Unnamed Agent';
        tokenEndpoint = brief.buildStatus?.tokenEndpoint || config.tokenEndpoint;
        region = brief.buildStatus?.region || 'unitedstates';
    } else {
        agentName = config.agentName || 'Unnamed Agent';
        tokenEndpoint = config.tokenEndpoint;
        region = 'unitedstates';
    }

    if (!tokenEndpoint) {
        console.error('Error: Token endpoint required. Use --token-endpoint or set in brief.json buildStatus.tokenEndpoint');
        process.exit(2);
    }

    console.log(`Creating Kit agent configuration: "${agentName}"...`);

    const body = {
        cat_name: agentName,
        cat_tokenendpoint: tokenEndpoint,
        cat_configurationtypecode: 1, // Test Automation
        cat_environmentid: config.envId || '',
        cat_tenantid: config.tenantId || '',
        cat_dataverseurl: envUrl
    };

    const configId = await dvPost(envUrl, headers, ENTITIES.configs, body);
    console.log(`Agent configuration created: ${configId}`);

    // If brief.json exists, write the config ID back
    if (config.briefPath) {
        const brief = JSON.parse(fs.readFileSync(config.briefPath, 'utf8'));
        if (!brief.kitIntegration) brief.kitIntegration = {};
        brief.kitIntegration.configId = configId;
        brief.kitIntegration.envUrl = envUrl;
        brief.kitIntegration.syncedAt = new Date().toISOString();
        fs.writeFileSync(config.briefPath, JSON.stringify(brief, null, 2));
        console.log(`Updated brief.json kitIntegration.configId`);
    }

    return configId;
}

/**
 * sync-tests — Push brief.json eval sets to Kit test sets + tests
 */
async function cmdSyncTests(envUrl, headers, config) {
    if (!config.briefPath) {
        console.error('Error: --brief <path> required');
        process.exit(2);
    }

    const brief = JSON.parse(fs.readFileSync(config.briefPath, 'utf8'));
    const evalSets = brief.evalSets || [];

    if (evalSets.length === 0) {
        console.log('No eval sets in brief.json — nothing to sync.');
        return;
    }

    // Find or require config ID
    let configId = config.configId || brief.kitIntegration?.configId;
    if (!configId) {
        console.error('Error: --config-id required, or run setup-agent first');
        process.exit(2);
    }

    console.log(`Syncing ${evalSets.length} eval sets to Kit...\n`);

    const syncResult = { sets: [], totalTests: 0 };

    for (const evalSet of evalSets) {
        const tests = evalSet.tests || [];
        if (tests.length === 0) {
            console.log(`  [${evalSet.name}] — 0 tests, skipping`);
            continue;
        }

        // Create test set
        console.log(`  [${evalSet.name}] — creating test set with ${tests.length} tests...`);
        const setId = await dvPost(envUrl, headers, ENTITIES.testSets, {
            cat_name: `${evalSet.name} (${new Date().toISOString().slice(0, 10)})`,
            cat_description: evalSet.description || '',
            'cat_CopilotConfigurationId@odata.bind': `/${ENTITIES.configs}(${configId})`
        });

        if (!setId) {
            // Query back to find it
            const found = await dvGet(envUrl, headers, ENTITIES.testSets,
                `$filter=startswith(cat_name,'${evalSet.name}')&$orderby=createdon desc&$top=1&$select=cat_copilottestsetid`);
            if (found.length === 0) {
                console.error(`    Failed to create test set for ${evalSet.name}`);
                continue;
            }
        }

        const resolvedSetId = setId || (await dvGet(envUrl, headers, ENTITIES.testSets,
            `$filter=startswith(cat_name,'${evalSet.name}')&$orderby=createdon desc&$top=1&$select=cat_copilottestsetid`))[0]?.cat_copilottestsetid;

        // Create individual tests
        let created = 0;
        for (const test of tests) {
            if (!test.question) continue;

            // Determine test type and comparison operator based on methods
            const methods = test.methods || evalSet.methods || [{ type: 'General quality' }];
            const primaryMethod = methods[0]?.type?.replace(/\s+/g, '') || 'GeneralQuality';
            const testType = TEST_TYPE_MAP[primaryMethod] || 1;

            // Determine comparison operator
            let compOp = COMPARISON_OPS.contains; // default
            if (primaryMethod === 'ExactMatch') compOp = COMPARISON_OPS.equals;
            else if (primaryMethod === 'KeywordMatch') compOp = COMPARISON_OPS.contains;

            const testBody = {
                cat_name: test.question.substring(0, 100),
                cat_testutterance: test.question,
                cat_expectedresponse: test.expected || '',
                cat_testtypecode: testType,
                cat_comparisonoperatorcode: compOp,
                'cat_CopilotTestSetId@odata.bind': `/${ENTITIES.testSets}(${resolvedSetId})`
            };

            // Add expected tools for Plan Validation tests
            if (test.expectedTools) {
                testBody.cat_expectedtools = test.expectedTools;
                testBody.cat_passthreshold = test.toolThreshold || 70;
                testBody.cat_testtypecode = 6; // Force Plan Validation
            }

            try {
                await dvPost(envUrl, headers, ENTITIES.tests, testBody);
                created++;
            } catch (e) {
                console.error(`    Failed to create test: ${test.question.substring(0, 50)}... — ${e.message.substring(0, 80)}`);
            }
        }

        console.log(`    Created ${created}/${tests.length} tests in Kit`);
        syncResult.sets.push({ name: evalSet.name, setId: resolvedSetId, tests: created });
        syncResult.totalTests += created;
    }

    // Write sync metadata back to brief.json
    const briefUpdated = JSON.parse(fs.readFileSync(config.briefPath, 'utf8'));
    if (!briefUpdated.kitIntegration) briefUpdated.kitIntegration = {};
    briefUpdated.kitIntegration.lastSync = new Date().toISOString();
    briefUpdated.kitIntegration.syncedSets = syncResult.sets;
    fs.writeFileSync(config.briefPath, JSON.stringify(briefUpdated, null, 2));

    console.log(`\nSync complete: ${syncResult.totalTests} tests across ${syncResult.sets.length} sets`);
    return syncResult;
}

/**
 * sync-results — Pull Kit test results back to brief.json
 */
async function cmdSyncResults(envUrl, headers, config) {
    if (!config.briefPath || !config.runId) {
        console.error('Error: --brief <path> and --run-id <id> required');
        process.exit(2);
    }

    const results = await dvGet(envUrl, headers, ENTITIES.testResults,
        `$filter=_cat_copilottestrunid_value eq '${config.runId}'&$select=cat_testutterance,cat_expectedresponse,cat_response,cat_latencyms,cat_resultcode,cat_testtypecode,cat_resultreason&$orderby=createdon asc`);

    console.log(`Downloaded ${results.length} results from Kit run ${config.runId}`);

    // Map results back to brief.json eval tests by matching question text
    const brief = JSON.parse(fs.readFileSync(config.briefPath, 'utf8'));
    let matched = 0;

    for (const result of results) {
        const utterance = result.cat_testutterance || '';
        // Find matching test in eval sets
        for (const evalSet of (brief.evalSets || [])) {
            for (const test of (evalSet.tests || [])) {
                if (test.question === utterance) {
                    test.lastResult = {
                        pass: result.cat_resultcode === 1,
                        score: result.cat_resultcode === 1 ? 100 : 0,
                        actual: result.cat_response || '',
                        latencyMs: result.cat_latencyms || 0,
                        reason: result.cat_resultreason || '',
                        source: 'kit',
                        kitRunId: config.runId,
                        timestamp: new Date().toISOString()
                    };
                    matched++;
                    break;
                }
            }
        }
    }

    fs.writeFileSync(config.briefPath, JSON.stringify(brief, null, 2));
    console.log(`Matched ${matched}/${results.length} results back to brief.json`);
    return { total: results.length, matched };
}

/**
 * inventory — List agents from Kit Agent Inventory
 */
async function cmdInventory(envUrl, headers, config) {
    const agents = await dvGet(envUrl, headers, ENTITIES.inventory,
        '$select=cat_name,cat_agentid,cat_environmentname,cat_orchestrationtype,cat_usesgenai,cat_published&$orderby=cat_name asc');

    if (config.json) {
        console.log(JSON.stringify(agents, null, 2));
        return agents;
    }

    console.log(`Agent Inventory: ${agents.length} agents\n`);
    agents.forEach(a => {
        const flags = [
            a.cat_usesgenai ? 'GenAI' : null,
            a.cat_published ? 'Published' : 'Draft'
        ].filter(Boolean).join(', ');
        console.log(`  ${(a.cat_name || 'unnamed').padEnd(35)} ${(a.cat_environmentname || '').padEnd(20)} ${flags}`);
    });
    return agents;
}

/**
 * compliance — List compliance cases
 */
async function cmdCompliance(envUrl, headers, config) {
    const cases = await dvGet(envUrl, headers, ENTITIES.compliance,
        '$select=cat_name,createdon,statuscode&$orderby=createdon desc&$top=20');

    if (config.json) {
        console.log(JSON.stringify(cases, null, 2));
        return cases;
    }

    console.log(`Compliance Cases: ${cases.length}\n`);
    if (cases.length === 0) {
        console.log('  No compliance cases found. Enable Compliance Hub in Kit app.');
    }
    cases.forEach(c => {
        console.log(`  ${(c.cat_name || 'unnamed').padEnd(40)} ${c.createdon} status: ${c.statuscode}`);
    });
    return cases;
}

// --- Main ---

async function main() {
    const config = parseArgs();

    if (!config.envUrl) {
        console.error('Error: --env <url> is required');
        process.exit(2);
    }

    const token = getToken(config.envUrl);
    const headers = buildHeaders(token);

    switch (config.command) {
        case 'status':
            await cmdStatus(config.envUrl, headers);
            break;
        case 'setup-agent':
            await cmdSetupAgent(config.envUrl, headers, config);
            break;
        case 'sync-tests':
            await cmdSyncTests(config.envUrl, headers, config);
            break;
        case 'sync-results':
            await cmdSyncResults(config.envUrl, headers, config);
            break;
        case 'inventory':
            await cmdInventory(config.envUrl, headers, config);
            break;
        case 'compliance':
            await cmdCompliance(config.envUrl, headers, config);
            break;
        default:
            console.error(`Unknown command: ${config.command}`);
            printUsage();
            process.exit(2);
    }
}

main().catch(err => {
    console.error(`Fatal: ${err.message}`);
    process.exit(2);
});

// --- Exports for programmatic use ---
module.exports = {
    ENTITIES,
    cmdStatus,
    cmdSetupAgent,
    cmdSyncTests,
    cmdSyncResults,
    cmdInventory,
    cmdCompliance,
    buildHeaders,
    dvGet,
    dvPost,
    dvCount
};
