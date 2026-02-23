/**
 * Headless Tool Addition for MCS Agents
 *
 * Adds connector actions and MCP servers to agents without Playwright.
 * Uses Island Gateway API for connector discovery and LSP push for adding.
 *
 * Auth: az account get-access-token (PVA app + Dataverse tokens)
 *
 * Usage:
 *   node tools/add-tool.js list-connectors --env <envId> --bot <botId> --gateway <url>
 *   node tools/add-tool.js add --workspace <path> --connector shared_todo --action ListToDosByFolderV2 --connection <connRef>
 */

const { execSync } = require('child_process');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// --- Token Helpers ---

function getToken(resource) {
    try {
        return execSync(
            `az account get-access-token --resource ${resource} --query accessToken -o tsv`,
            { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        ).trim();
    } catch (err) {
        throw new Error(`Failed to get token for ${resource}: ${err.stderr || err.message}`);
    }
}

// --- HTTP Helper ---

function httpRequest(method, url, headers, body) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const bodyStr = body ? JSON.stringify(body) : null;
        const options = {
            hostname: parsed.hostname,
            port: parsed.port || 443,
            path: parsed.pathname + parsed.search,
            method,
            headers: {
                ...headers,
                'Content-Type': 'application/json',
                ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data || '{}') });
                } catch {
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(30000, () => req.destroy(new Error('Request timeout')));
        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

// --- Island Gateway Helpers ---

function buildHeaders(token, tenantId, envId, botId) {
    return {
        'Authorization': `Bearer ${token}`,
        'x-ms-client-tenant-id': tenantId,
        'x-cci-tenantid': tenantId,
        'x-cci-bapenvironmentid': envId,
        ...(botId ? { 'x-cci-cdsbotid': botId } : {})
    };
}

/**
 * Read all bot components from Island Gateway.
 * Returns the full component list including actions/skills.
 */
async function readComponents(gatewayUrl, envId, botId, headers) {
    const url = `${gatewayUrl}/api/botmanagement/v1/environments/${envId}/bots/${botId}/content/botcomponents`;
    const res = await httpRequest('POST', url, headers, {});
    if (res.status !== 200) {
        throw new Error(`readComponents failed: HTTP ${res.status} — ${JSON.stringify(res.data).substring(0, 300)}`);
    }
    return res.data;
}

/**
 * List connectors available in the environment via Island Gateway.
 */
async function listConnectors(gatewayUrl, envId, headers) {
    const url = `${gatewayUrl}/api/botmanagement/v1/environments/${envId}/connectors`;
    const res = await httpRequest('POST', url, headers, {});
    if (res.status !== 200) {
        throw new Error(`listConnectors failed: HTTP ${res.status} — ${JSON.stringify(res.data).substring(0, 300)}`);
    }
    return res.data;
}

// --- Tool Addition via LSP Workspace ---

/**
 * Add a connector action to an agent by creating the YAML file and pushing via LSP.
 *
 * @param {string} workspacePath - Path to cloned workspace (the agent subfolder with .mcs/)
 * @param {object} actionDef - { connectorId, operationId, displayName, description, connectionRef, kind }
 */
function createActionYaml(workspacePath, actionDef) {
    const actionsDir = path.join(workspacePath, 'actions');
    fs.mkdirSync(actionsDir, { recursive: true });

    // Clean filename: only alphanumeric, underscores, hyphens
    const safeName = `${actionDef.connectorId}_${actionDef.operationId}`.replace(/[^a-zA-Z0-9_]/g, '');
    const fileName = `${safeName}.mcs.yml`;
    const filePath = path.join(actionsDir, fileName);

    let yaml;
    if (actionDef.kind === 'mcp') {
        yaml = `# Name: ${actionDef.displayName}
kind: TaskDialog
modelDisplayName: ${actionDef.displayName}
modelDescription: "${(actionDef.description || '').replace(/"/g, '\\"')}"
action:
  kind: InvokeExternalAgentTaskAction
  connectionReference: ${actionDef.connectionRef}
  connectionProperties:
    mode: Invoker

  operationDetails:
    kind: ModelContextProtocolMetadata
    operationId: ${actionDef.operationId}
`;
    } else {
        yaml = `# Name: ${actionDef.displayName}
kind: TaskDialog
modelDisplayName: ${actionDef.displayName}
modelDescription: "${(actionDef.description || '').replace(/"/g, '\\"')}"
outputs:
  - propertyName: value

action:
  kind: InvokeConnectorTaskAction
  connectionReference: ${actionDef.connectionRef}
  connectionProperties:
    mode: Invoker

  operationId: ${actionDef.operationId}

outputMode: All
`;
    }

    fs.writeFileSync(filePath, yaml, 'utf8');
    console.error(`[add-tool] Created action file: ${fileName}`);
    return filePath;
}

/**
 * Update connectionreferences.mcs.yml to include a connection reference if not already present.
 */
function ensureConnectionReference(workspacePath, connectorId, connectionRef) {
    const connRefPath = path.join(workspacePath, 'connectionreferences.mcs.yml');
    let content = '';
    if (fs.existsSync(connRefPath)) {
        content = fs.readFileSync(connRefPath, 'utf8');
    }

    // Check if this connection reference is already listed
    if (content.includes(connectionRef)) {
        console.error(`[add-tool] Connection reference already in connectionreferences.mcs.yml`);
        return;
    }

    // Append the new connection reference
    const entry = `  - connectionReferenceLogicalName: ${connectionRef}
    connectorId: /providers/Microsoft.PowerApps/apis/${connectorId}
`;

    if (!content.includes('connectionReferences:')) {
        content = `connectionReferences:\n${entry}`;
    } else {
        content = content.trimEnd() + '\n' + entry;
    }

    fs.writeFileSync(connRefPath, content, 'utf8');
    console.error(`[add-tool] Updated connectionreferences.mcs.yml`);
}

// --- CLI ---

function parseArgs() {
    const args = process.argv.slice(2);
    const config = {};
    if (args.length === 0 || args[0] === '--help') { printUsage(); process.exit(0); }
    config.command = args[0];
    for (let i = 1; i < args.length; i++) {
        switch (args[i]) {
            case '--env': config.envId = args[++i]; break;
            case '--bot': config.botId = args[++i]; break;
            case '--gateway': config.gatewayUrl = args[++i]; break;
            case '--workspace': config.workspace = args[++i]; break;
            case '--connector': config.connectorId = args[++i]; break;
            case '--action': config.operationId = args[++i]; break;
            case '--connection': config.connectionRef = args[++i]; break;
            case '--name': config.displayName = args[++i]; break;
            case '--description': config.description = args[++i]; break;
            case '--kind': config.kind = args[++i]; break;
            case '--json': config.json = true; break;
        }
    }
    return config;
}

function printUsage() {
    console.log(`Headless Tool Addition for MCS Agents

Usage: node add-tool.js <command> [options]

Commands:
  list-tools       List existing tools on an agent (via Island API component read)
  list-connectors  List connectors in the environment (via Island API)
  add              Add a connector action to an agent (via workspace YAML + LSP push)

list-tools / list-connectors options:
  --env <envId>       Environment ID
  --bot <botId>       Agent/bot CDS ID (for list-tools)
  --gateway <url>     Island gateway URL

add options:
  --workspace <path>  Path to cloned agent workspace (with .mcs/ directory)
  --connector <id>    Connector ID (e.g., shared_todo, shared_planner)
  --action <id>       Operation ID (e.g., ListMyTasks_V2, ListToDosByFolderV2)
  --connection <ref>  Connection reference logical name (from connectionreferences.mcs.yml)
  --name <name>       Display name for the tool
  --description <desc> Description
  --kind <type>       "connector" (default) or "mcp"
  --json              Output raw JSON

Examples:
  # List existing tools
  node tools/add-tool.js list-tools --env f9a0cae4-... --bot 2ae13d0e-... --gateway https://powervamg.us-il301...

  # Add a connector action (reuses existing connection)
  node tools/add-tool.js add --workspace "./Clone/Agent Name" \\
    --connector shared_todo --action ListToDosByFolderV2 \\
    --connection "auto_agent_3aiWd.shared_todo.5075650bc3ec433ba1144a3d6563a05d" \\
    --name "List to-dos by folder (V2)" --description "Retrieve all to-dos from a specific list"

  # Then push: node tools/mcs-lsp.js push --workspace "./Clone/Agent Name"`);
}

async function main() {
    const config = parseArgs();

    try {
        switch (config.command) {
            case 'list-tools': {
                if (!config.envId || !config.botId || !config.gatewayUrl) {
                    console.error('Error: --env, --bot, and --gateway required');
                    process.exit(2);
                }
                const token = getToken('96ff4394-9197-43aa-b393-6a41652e21f8');
                const tenantId = execSync('az account show --query tenantId -o tsv',
                    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
                const headers = buildHeaders(token, tenantId, config.envId, config.botId);
                const gw = config.gatewayUrl.replace(/\/$/, '');

                const result = await readComponents(gw, config.envId, config.botId, headers);
                const components = result.botComponentChanges || [];
                const actions = components.filter(c => {
                    const comp = c.component;
                    return comp && (comp['$kind'] === 'SkillComponent' || comp['$kind'] === 'DialogComponent') &&
                        comp.dialog?.beginDialog?.['$kind'] === 'OnInvokeAction';
                });
                // Also find TaskDialog-style actions in the GptComponent metadata
                const gpt = components.find(c => c.component?.['$kind'] === 'GptComponent');
                const tools = gpt?.component?.metadata?.tools || [];

                if (config.json) {
                    console.log(JSON.stringify({ actions: actions.length, tools, components: components.length }, null, 2));
                } else {
                    console.log(`Agent tools (${tools.length} from GptComponent):\n`);
                    for (const tool of tools) {
                        console.log(`  ${tool.displayName || tool.schemaName || 'unnamed'}`);
                        if (tool.description) console.log(`    ${tool.description.substring(0, 80)}`);
                    }
                    console.log(`\nTotal components: ${components.length}`);
                }
                break;
            }

            case 'list-connectors': {
                if (!config.envId || !config.gatewayUrl) {
                    console.error('Error: --env and --gateway required');
                    process.exit(2);
                }
                const token = getToken('96ff4394-9197-43aa-b393-6a41652e21f8');
                const tenantId = execSync('az account show --query tenantId -o tsv',
                    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
                const headers = buildHeaders(token, tenantId, config.envId);
                const gw = config.gatewayUrl.replace(/\/$/, '');

                const result = await listConnectors(gw, config.envId, headers);
                if (config.json) {
                    console.log(JSON.stringify(result, null, 2));
                } else {
                    const connectors = Array.isArray(result) ? result : (result.value || []);
                    console.log(`Connectors (${connectors.length}):\n`);
                    for (const c of connectors) {
                        const name = c.displayName || c.name || c.id;
                        console.log(`  ${name}`);
                    }
                }
                break;
            }

            case 'add': {
                if (!config.workspace || !config.connectorId || !config.operationId || !config.connectionRef) {
                    console.error('Error: --workspace, --connector, --action, and --connection required');
                    process.exit(2);
                }
                const ws = path.resolve(config.workspace);
                if (!fs.existsSync(path.join(ws, '.mcs', 'conn.json'))) {
                    console.error('Error: Not a valid workspace (missing .mcs/conn.json). Clone first.');
                    process.exit(2);
                }

                const actionDef = {
                    connectorId: config.connectorId,
                    operationId: config.operationId,
                    displayName: config.displayName || `${config.connectorId} - ${config.operationId}`,
                    description: config.description || '',
                    connectionRef: config.connectionRef,
                    kind: config.kind || 'connector'
                };

                // Create action YAML
                const actionPath = createActionYaml(ws, actionDef);

                // Ensure connection reference exists
                ensureConnectionReference(ws, config.connectorId, config.connectionRef);

                console.log(`Action file created: ${path.basename(actionPath)}`);
                console.log(`\nNow push to MCS:`);
                console.log(`  node tools/mcs-lsp.js push --workspace "${ws}"`);
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

module.exports = { createActionYaml, ensureConnectionReference };

if (require.main === module) {
    main().catch(err => { console.error('Fatal:', err.message); process.exit(2); });
}
