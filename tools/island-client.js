/**
 * Island Control Plane Gateway API Client
 *
 * Communicates with the MCS backend gateway at powervamg.{region}.gateway.prod.island.powerapps.com
 * for bot component CRUD, model selection, instructions, and settings.
 *
 * This is the same API the MCS frontend and ObjectModel VS Code extension use.
 * Zero external dependencies — uses native Node.js https.
 *
 * NOTE: For topic authoring (push/pull of .mcs.yml files), prefer tools/mcs-lsp.js instead.
 * It wraps the official Copilot Studio VS Code extension's Language Server and handles
 * YAML→JSON conversion automatically. Use this client for lightweight operations:
 * model selection, model catalog, component reads, routing info, bot settings.
 *
 * Auth: az account get-access-token --resource https://api.powerplatform.com
 *
 * Usage:
 *   node tools/island-client.js read-components --env <envId> --bot <botId>
 *   node tools/island-client.js set-model --env <envId> --bot <botId> --model GPT5Chat
 *   node tools/island-client.js get-models --tenant <tenantId> --env <envId>
 *   node tools/island-client.js get-instructions --env <envId> --bot <botId>
 *   node tools/island-client.js set-instructions --env <envId> --bot <botId> --text "New instructions"
 *   node tools/island-client.js get-routing --env <envId> --bot <botId>
 *   node tools/island-client.js get-settings --env <envId> --bot <botId>
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const MAX_RETRIES = 3;
const RETRY_BACKOFF_BASE_MS = 1000;
const REQUEST_TIMEOUT_MS = 30000;

// --- HTTP Helper (same pattern as direct-line-test.js) ---

function httpRequest(method, url, headers, body) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const transport = parsed.protocol === 'http:' ? http : https;
        const bodyStr = body ? JSON.stringify(body) : null;
        const options = {
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
            path: parsed.pathname + parsed.search,
            method,
            headers: {
                ...headers,
                'Content-Type': 'application/json',
                ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
            }
        };

        const req = transport.request(options, (res) => {
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
        req.setTimeout(REQUEST_TIMEOUT_MS, () => {
            req.destroy(new Error('Request timeout'));
        });
        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

async function httpRequestWithRetry(method, url, headers, body, retries = MAX_RETRIES) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await httpRequest(method, url, headers, body);
            if ((res.status === 429 || res.status >= 500) && attempt < retries) {
                const delay = RETRY_BACKOFF_BASE_MS * Math.pow(2, attempt);
                console.error(`  [Retry ${attempt + 1}/${retries}] HTTP ${res.status}, waiting ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            return res;
        } catch (err) {
            lastError = err;
            if (attempt < retries) {
                const delay = RETRY_BACKOFF_BASE_MS * Math.pow(2, attempt);
                console.error(`  [Retry ${attempt + 1}/${retries}] ${err.message}, waiting ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
}

// --- Token Acquisition ---

function getToken(resource) {
    try {
        const result = execSync(
            `az account get-access-token --resource ${resource} --query accessToken -o tsv`,
            { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
        return result.trim();
    } catch (err) {
        throw new Error(
            `Failed to get token for ${resource}. Ensure az CLI is logged in.\n` +
            `Run: az login\n` +
            `Error: ${err.stderr || err.message}`
        );
    }
}

function getTenantId() {
    try {
        const result = execSync(
            'az account show --query tenantId -o tsv',
            { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
        return result.trim();
    } catch (err) {
        throw new Error(`Failed to get tenant ID from az CLI: ${err.stderr || err.message}`);
    }
}

// --- Build Headers ---

function buildHeaders(token, tenantId, envId, botId) {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'x-ms-client-tenant-id': tenantId,
        'x-cci-tenantid': tenantId,
        'x-cci-bapenvironmentid': envId
    };
    if (botId) {
        headers['x-cci-cdsbotid'] = botId;
    }
    return headers;
}

// --- Gateway URL Helpers ---

function buildGatewayUrl(baseUrl, ...segments) {
    const base = baseUrl.replace(/\/$/, '');
    return `${base}/${segments.join('/')}`;
}

/**
 * Load gateway URL from session-config.json if available
 */
function loadGatewayFromConfig(envId) {
    const configPaths = [
        path.join(process.cwd(), 'tools', 'session-config.json'),
        path.join(__dirname, 'session-config.json')
    ];
    for (const configPath of configPaths) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.accounts) {
                for (const account of config.accounts) {
                    for (const env of account.environments || []) {
                        if (env.gatewayUrl && (env.environmentId === envId || !envId)) {
                            return env.gatewayUrl;
                        }
                    }
                }
            }
        } catch { /* config not found or invalid */ }
    }
    return null;
}

// --- Discovery APIs ---

/**
 * Get bot routing info — maps CDS bot ID to PVA bot ID, island, schema name.
 * Also reveals the gateway URL for this environment.
 */
async function getRoutingInfo(gatewayUrl, envId, botId, headers) {
    const url = buildGatewayUrl(
        gatewayUrl,
        'api/botmanagement/v1/environments', envId,
        `botroutinginfo?cdsBotId=${botId}`
    );
    const res = await httpRequestWithRetry('GET', url, headers);
    if (res.status !== 200) {
        throw new Error(`getRoutingInfo failed: HTTP ${res.status} — ${JSON.stringify(res.data)}`);
    }
    return res.data;
}

/**
 * Get available model catalog for the environment.
 * Returns array of { modelDisplayName, modelHint, provider, publicStatus, sortOrder, tags }
 */
async function getModelSettings(gatewayUrl, tenantId, envId, headers) {
    const url = buildGatewayUrl(
        gatewayUrl,
        'chatbotmanagement/tenants', tenantId,
        'environments', envId,
        'api/featureSettings/modelSettings/v2'
    );
    const res = await httpRequestWithRetry('GET', url, headers);
    if (res.status !== 200) {
        throw new Error(`getModelSettings failed: HTTP ${res.status} — ${JSON.stringify(res.data)}`);
    }
    return res.data;
}

/**
 * Get bot-level settings (overlap detection, topic suggestions, etc.)
 */
async function getBotSettings(gatewayUrl, envId, botId, headers) {
    const url = buildGatewayUrl(
        gatewayUrl,
        'api/botmanagement/v1/environments', envId,
        'bots', botId, 'settings'
    );
    const res = await httpRequestWithRetry('GET', url, headers);
    if (res.status !== 200) {
        throw new Error(`getBotSettings failed: HTTP ${res.status} — ${JSON.stringify(res.data)}`);
    }
    return res.data;
}

// --- Publish & DLP Status ---

/**
 * Get publish status for a bot. Returns publish operation state.
 * Used after `pac copilot publish` to confirm completion.
 */
async function getPublishStatus(gatewayUrl, envId, botId, headers) {
    const url = buildGatewayUrl(
        gatewayUrl,
        'api/botmanagement/v1/environments', envId,
        'bots', botId, 'publishv2-operations'
    );
    const res = await httpRequestWithRetry('GET', url, headers);
    if (res.status !== 200) {
        throw new Error(`getPublishStatus failed: HTTP ${res.status} — ${JSON.stringify(res.data)}`);
    }
    return res.data;
}

/**
 * Check DLP (Data Loss Prevention) violations for a bot.
 * Returns blocked connectors, policy issues. Used as pre-build check.
 */
async function checkDlp(gatewayUrl, envId, botId, headers) {
    const url = buildGatewayUrl(
        gatewayUrl,
        'api/botmanagement/v1/environments', envId,
        'bots', botId, 'dlpstatus'
    );
    const res = await httpRequestWithRetry('GET', url, headers);
    if (res.status !== 200) {
        throw new Error(`checkDlp failed: HTTP ${res.status} — ${JSON.stringify(res.data)}`);
    }
    return res.data;
}

/**
 * List topics for a bot. Uses readComponents internally, filters for DialogComponent.
 * Returns a simplified topic list: [{name, schemaName, triggerKind, description}]
 */
async function listTopics(gatewayUrl, envId, botId, headers) {
    const readResult = await readComponents(gatewayUrl, envId, botId, headers);
    const changes = readResult.botComponentChanges || [];
    return changes
        .filter(c => c.component && c.component['$kind'] === 'DialogComponent')
        .map(c => {
            const comp = c.component;
            const trigger = comp.dialog?.beginDialog;
            return {
                name: comp.displayName || comp.schemaName,
                schemaName: comp.schemaName,
                triggerKind: trigger ? trigger['$kind'] : 'unknown',
                description: comp.description || '',
                state: comp.state || ''
            };
        });
}

// --- Component CRUD ---

/**
 * Read all bot components (initial sync or delta sync).
 * POST with {} for initial read, or { componentDeltaToken: "..." } for incremental.
 * Returns { botComponentChanges: [...], changeToken: "..." }
 */
async function readComponents(gatewayUrl, envId, botId, headers, changeToken) {
    const url = buildGatewayUrl(
        gatewayUrl,
        'api/botmanagement/v1/environments', envId,
        'bots', botId, 'content/botcomponents'
    );
    const body = changeToken ? { componentDeltaToken: changeToken } : {};
    const res = await httpRequestWithRetry('POST', url, headers, body);
    if (res.status !== 200) {
        throw new Error(`readComponents failed: HTTP ${res.status} — ${JSON.stringify(res.data)}`);
    }
    return res.data;
}

/**
 * Write component changes (update, insert, delete).
 * PUT with { botComponentChanges: [...], changeToken: "..." }
 * Returns updated changeset with new changeToken.
 */
async function writeComponents(gatewayUrl, envId, botId, headers, changeSet) {
    const url = buildGatewayUrl(
        gatewayUrl,
        'api/botmanagement/v1/environments', envId,
        'bots', botId, 'content/botcomponents'
    );
    const res = await httpRequestWithRetry('PUT', url, headers, changeSet);
    if (res.status !== 200) {
        throw new Error(`writeComponents failed: HTTP ${res.status} — ${JSON.stringify(res.data)}`);
    }
    return res.data;
}

// --- Convenience: Model Selection ---

/**
 * Find the GptComponent from a component read response.
 */
function findGptComponent(componentsResponse) {
    const changes = componentsResponse.botComponentChanges || [];
    for (const change of changes) {
        const comp = change.component;
        if (comp && comp['$kind'] === 'GptComponent') {
            return { change, component: comp };
        }
    }
    return null;
}

/**
 * Set the model for a bot. Reads current GptComponent, modifies modelNameHint, writes back.
 * @param {string} modelHint - e.g. "GPT41", "GPT5Chat", "sonnet4-5", "opus4-1"
 */
async function setModel(gatewayUrl, envId, botId, headers, modelHint) {
    // Read current components
    const readResult = await readComponents(gatewayUrl, envId, botId, headers);
    const gpt = findGptComponent(readResult);
    if (!gpt) {
        throw new Error('No GptComponent found — is this a valid MCS agent?');
    }

    const comp = gpt.component;
    const changeToken = readResult.changeToken;

    // Modify the model hint
    if (!comp.metadata) comp.metadata = { '$kind': 'GptComponentMetadata' };
    if (!comp.metadata.aISettings) comp.metadata.aISettings = { '$kind': 'AISettings' };
    if (!comp.metadata.aISettings.model) comp.metadata.aISettings.model = { '$kind': 'CurrentModels' };
    comp.metadata.aISettings.model.modelNameHint = modelHint;

    // Build the write changeset
    const changeSet = {
        botComponentChanges: [{
            '$kind': 'BotComponentUpdate',
            component: comp
        }],
        cloudFlowDefinitionChanges: [],
        connectorDefinitionChanges: [],
        environmentVariableChanges: [],
        connectionReferenceChanges: [],
        aIPluginOperationChanges: [],
        componentCollectionChanges: [],
        dataverseTableSearchChanges: [],
        connectedAgentDefinitionChanges: [],
        changeToken: changeToken
    };

    return await writeComponents(gatewayUrl, envId, botId, headers, changeSet);
}

// --- Convenience: Instructions ---

/**
 * Get the current instructions text from the GptComponent.
 */
async function getInstructions(gatewayUrl, envId, botId, headers) {
    const readResult = await readComponents(gatewayUrl, envId, botId, headers);
    const gpt = findGptComponent(readResult);
    if (!gpt) {
        throw new Error('No GptComponent found — is this a valid MCS agent?');
    }

    const comp = gpt.component;
    // Instructions are in metadata.instructions or metadata.displayName area
    // The GptComponent stores instructions in metadata — check common locations
    const meta = comp.metadata || {};
    return {
        instructions: meta.instructions || meta.systemMessage || null,
        displayName: comp.displayName,
        model: meta.aISettings?.model?.modelNameHint || 'unknown',
        tools: meta.tools || [],
        conversationStarters: meta.conversationStarters || [],
        changeToken: readResult.changeToken,
        component: comp
    };
}

/**
 * Set agent instructions via GptComponent update.
 */
async function setInstructions(gatewayUrl, envId, botId, headers, text) {
    const readResult = await readComponents(gatewayUrl, envId, botId, headers);
    const gpt = findGptComponent(readResult);
    if (!gpt) {
        throw new Error('No GptComponent found — is this a valid MCS agent?');
    }

    const comp = gpt.component;
    if (!comp.metadata) comp.metadata = { '$kind': 'GptComponentMetadata' };
    comp.metadata.instructions = text;

    const changeSet = {
        botComponentChanges: [{
            '$kind': 'BotComponentUpdate',
            component: comp
        }],
        cloudFlowDefinitionChanges: [],
        connectorDefinitionChanges: [],
        environmentVariableChanges: [],
        connectionReferenceChanges: [],
        aIPluginOperationChanges: [],
        componentCollectionChanges: [],
        dataverseTableSearchChanges: [],
        connectedAgentDefinitionChanges: [],
        changeToken: readResult.changeToken
    };

    return await writeComponents(gatewayUrl, envId, botId, headers, changeSet);
}

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
            case '--env': config.envId = args[++i]; break;
            case '--bot': config.botId = args[++i]; break;
            case '--tenant': config.tenantId = args[++i]; break;
            case '--model': config.model = args[++i]; break;
            case '--text': config.text = args[++i]; break;
            case '--gateway': config.gatewayUrl = args[++i]; break;
            case '--json': config.json = true; break;
            case '--help': printUsage(); process.exit(0);
        }
    }

    return config;
}

function printUsage() {
    console.log(`Island Control Plane Gateway API Client

Usage: node island-client.js <command> [options]

Commands:
  read-components    Read all bot components (ObjectModel $kind types)
  set-model          Change the agent's AI model
  get-models         List available AI models for the environment
  get-instructions   Get agent instructions from GptComponent
  set-instructions   Set agent instructions via GptComponent
  get-routing        Get bot routing info (island, schema, PVA bot ID)
  get-settings       Get bot-level settings
  get-publish-status Get publish operation status (running/completed/failed)
  check-dlp          Check DLP violations — blocked connectors and policy issues
  list-topics        List topics with trigger info (filtered from components)

Required options:
  --env <envId>      Environment ID (e.g. Default-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  --bot <botId>      Bot/agent CDS ID (GUID)

Optional:
  --tenant <tid>     Tenant ID (auto-detected from az CLI if omitted)
  --gateway <url>    Gateway URL (loaded from session-config.json if omitted)
  --model <hint>     Model hint for set-model (GPT41, GPT5Chat, sonnet4-5, etc.)
  --text <text>      Instructions text for set-instructions
  --json             Output raw JSON (default: formatted summary)

Examples:
  node island-client.js get-models --env Default-xxx
  node island-client.js read-components --env Default-xxx --bot fec3b192-xxx
  node island-client.js set-model --env Default-xxx --bot fec3b192-xxx --model GPT5Chat
  node island-client.js get-instructions --env Default-xxx --bot fec3b192-xxx
  node island-client.js get-publish-status --env Default-xxx --bot fec3b192-xxx
  node island-client.js check-dlp --env Default-xxx --bot fec3b192-xxx
  node island-client.js list-topics --env Default-xxx --bot fec3b192-xxx`);
}

async function main() {
    const config = parseArgs();

    // Resolve tenant ID
    const tenantId = config.tenantId || getTenantId();

    // Resolve gateway URL
    let gatewayUrl = config.gatewayUrl || loadGatewayFromConfig(config.envId);
    if (!gatewayUrl) {
        // Default — user must provide or we try common US gateway
        gatewayUrl = 'https://powervamg.us-il104.gateway.prod.island.powerapps.com';
        console.error(`No gateway URL configured. Using default: ${gatewayUrl}`);
        console.error(`Set via --gateway or add gatewayUrl to session-config.json\n`);
    }

    // Get auth token
    const token = getToken('https://api.powerplatform.com');
    const headers = buildHeaders(token, tenantId, config.envId, config.botId);

    try {
        switch (config.command) {
            case 'get-routing': {
                if (!config.envId || !config.botId) {
                    console.error('Error: --env and --bot are required for get-routing');
                    process.exit(2);
                }
                const result = await getRoutingInfo(gatewayUrl, config.envId, config.botId, headers);
                if (config.json) {
                    console.log(JSON.stringify(result, null, 2));
                } else {
                    console.log('Bot Routing Info:');
                    console.log(`  PVA Bot ID:    ${result.pvaBotId}`);
                    console.log(`  CDS Bot ID:    ${result.cdsBotId}`);
                    console.log(`  Island:        ${result.island}`);
                    console.log(`  Schema:        ${result.schemaName}`);
                    console.log(`  Environment:   ${result.environmentId}`);
                    console.log(`  Tenant:        ${result.tenantId}`);
                    console.log(`  Organization:  ${result.organizationId}`);
                }
                break;
            }

            case 'get-models': {
                if (!config.envId) {
                    console.error('Error: --env is required for get-models');
                    process.exit(2);
                }
                const models = await getModelSettings(gatewayUrl, tenantId, config.envId, headers);
                if (config.json) {
                    console.log(JSON.stringify(models, null, 2));
                } else {
                    console.log('Available Models:');
                    console.log('');
                    const arr = Array.isArray(models) ? models : [];
                    for (const m of arr) {
                        const def = m.isDefault ? ' (DEFAULT)' : '';
                        console.log(`  ${m.modelDisplayName}${def}`);
                        console.log(`    Hint: ${m.modelHint}  |  Provider: ${m.provider}  |  Status: ${m.publicStatus}`);
                    }
                }
                break;
            }

            case 'get-settings': {
                if (!config.envId || !config.botId) {
                    console.error('Error: --env and --bot are required for get-settings');
                    process.exit(2);
                }
                const settings = await getBotSettings(gatewayUrl, config.envId, config.botId, headers);
                console.log(JSON.stringify(settings, null, 2));
                break;
            }

            case 'read-components': {
                if (!config.envId || !config.botId) {
                    console.error('Error: --env and --bot are required for read-components');
                    process.exit(2);
                }
                const result = await readComponents(gatewayUrl, config.envId, config.botId, headers);
                if (config.json) {
                    console.log(JSON.stringify(result, null, 2));
                } else {
                    const changes = result.botComponentChanges || [];
                    console.log(`Bot Components: ${changes.length} total\n`);
                    for (const change of changes) {
                        const comp = change.component;
                        if (!comp) continue;
                        const kind = comp['$kind'] || 'Unknown';
                        const name = comp.displayName || comp.schemaName || comp.id;
                        const state = comp.state || '';
                        console.log(`  [${kind}] ${name}  (${state})`);
                    }
                    console.log(`\nChange token: ${(result.changeToken || '').substring(0, 40)}...`);
                }
                break;
            }

            case 'set-model': {
                if (!config.envId || !config.botId || !config.model) {
                    console.error('Error: --env, --bot, and --model are required for set-model');
                    process.exit(2);
                }
                console.log(`Setting model to: ${config.model}`);
                const result = await setModel(gatewayUrl, config.envId, config.botId, headers, config.model);
                console.log('Model updated successfully.');
                if (config.json) {
                    console.log(JSON.stringify(result, null, 2));
                }
                break;
            }

            case 'get-instructions': {
                if (!config.envId || !config.botId) {
                    console.error('Error: --env and --bot are required for get-instructions');
                    process.exit(2);
                }
                const info = await getInstructions(gatewayUrl, config.envId, config.botId, headers);
                if (config.json) {
                    console.log(JSON.stringify(info, null, 2));
                } else {
                    console.log(`Agent: ${info.displayName}`);
                    console.log(`Model: ${info.model}`);
                    console.log(`Tools: ${info.tools.length}`);
                    console.log(`Starters: ${info.conversationStarters.length}`);
                    console.log(`\nInstructions:`);
                    console.log(info.instructions || '(none)');
                }
                break;
            }

            case 'get-publish-status': {
                if (!config.envId || !config.botId) {
                    console.error('Error: --env and --bot are required for get-publish-status');
                    process.exit(2);
                }
                const pubStatus = await getPublishStatus(gatewayUrl, config.envId, config.botId, headers);
                if (config.json) {
                    console.log(JSON.stringify(pubStatus, null, 2));
                } else {
                    const ops = Array.isArray(pubStatus) ? pubStatus : (pubStatus.value || [pubStatus]);
                    console.log('Publish Operations:');
                    for (const op of ops) {
                        const state = op.state || op.status || 'unknown';
                        const started = op.startTime || op.createdDateTime || '';
                        const ended = op.endTime || op.completedDateTime || '';
                        console.log(`  State: ${state}`);
                        if (started) console.log(`  Started: ${started}`);
                        if (ended) console.log(`  Ended: ${ended}`);
                        if (op.error) console.log(`  Error: ${JSON.stringify(op.error)}`);
                        console.log('');
                    }
                }
                break;
            }

            case 'check-dlp': {
                if (!config.envId || !config.botId) {
                    console.error('Error: --env and --bot are required for check-dlp');
                    process.exit(2);
                }
                const dlp = await checkDlp(gatewayUrl, config.envId, config.botId, headers);
                if (config.json) {
                    console.log(JSON.stringify(dlp, null, 2));
                } else {
                    const violations = dlp.blockedConnectors || dlp.violations || [];
                    const hasViolations = Array.isArray(violations) ? violations.length > 0 : !!violations;
                    if (hasViolations) {
                        console.log('DLP Violations Found:');
                        for (const v of (Array.isArray(violations) ? violations : [violations])) {
                            console.log(`  Connector: ${v.connectorId || v.name || JSON.stringify(v)}`);
                            if (v.policyName) console.log(`  Policy: ${v.policyName}`);
                        }
                    } else {
                        console.log('No DLP violations detected.');
                    }
                    if (dlp.isBlocked !== undefined) {
                        console.log(`Blocked: ${dlp.isBlocked}`);
                    }
                }
                break;
            }

            case 'list-topics': {
                if (!config.envId || !config.botId) {
                    console.error('Error: --env and --bot are required for list-topics');
                    process.exit(2);
                }
                const topics = await listTopics(gatewayUrl, config.envId, config.botId, headers);
                if (config.json) {
                    console.log(JSON.stringify(topics, null, 2));
                } else {
                    console.log(`Topics (${topics.length}):\n`);
                    for (const t of topics) {
                        const trigger = t.triggerKind.replace('On', '').replace('Intent', '');
                        console.log(`  ${t.name}`);
                        console.log(`    Schema: ${t.schemaName}  |  Trigger: ${trigger}  |  State: ${t.state}`);
                        if (t.description) console.log(`    ${t.description.substring(0, 80)}`);
                    }
                }
                break;
            }

            case 'set-instructions': {
                if (!config.envId || !config.botId || !config.text) {
                    console.error('Error: --env, --bot, and --text are required for set-instructions');
                    process.exit(2);
                }
                console.log(`Setting instructions (${config.text.length} chars)...`);
                const result = await setInstructions(gatewayUrl, config.envId, config.botId, headers, config.text);
                console.log('Instructions updated successfully.');
                if (config.json) {
                    console.log(JSON.stringify(result, null, 2));
                }
                break;
            }

            default:
                console.error(`Unknown command: ${config.command}`);
                printUsage();
                process.exit(2);
        }
    } catch (err) {
        console.error(`\nError: ${err.message}`);
        process.exit(1);
    }
}

// --- Module Exports (for programmatic use) ---
module.exports = {
    getToken,
    getTenantId,
    buildHeaders,
    loadGatewayFromConfig,
    getRoutingInfo,
    getModelSettings,
    getBotSettings,
    getPublishStatus,
    checkDlp,
    listTopics,
    readComponents,
    writeComponents,
    findGptComponent,
    setModel,
    getInstructions,
    setInstructions
};

// Run CLI if invoked directly
if (require.main === module) {
    main().catch(err => {
        console.error('Fatal:', err.message);
        process.exit(2);
    });
}
