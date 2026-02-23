/**
 * MCS Language Server Wrapper
 *
 * Wraps the Copilot Studio VS Code extension's LanguageServerHost.exe to provide
 * headless push/pull/preview of MCS agent components (topics, instructions, etc.)
 * via JSON-RPC over stdio.
 *
 * The LSP uses YamlPassThroughSerializationContext — it accepts .mcs.yml files
 * directly, matching the exact code path of the official GA extension.
 *
 * Zero external dependencies — uses native Node.js child_process, fs, path.
 *
 * Auth: az account get-access-token (Dataverse + Power Platform tokens)
 *
 * Usage:
 *   node tools/mcs-lsp.js push --workspace "C:\Copilot 2\Clone\Daily Briefing"
 *   node tools/mcs-lsp.js pull --workspace "C:\Copilot 2\Clone\Daily Briefing"
 *   node tools/mcs-lsp.js preview --workspace "C:\Copilot 2\Clone\Daily Briefing"
 *   node tools/mcs-lsp.js info --workspace "C:\Copilot 2\Clone\Daily Briefing"
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// --- Configuration ---
const LSP_STARTUP_TIMEOUT_MS = 15000;
const LSP_REQUEST_TIMEOUT_MS = 60000;
const VERBOSE = process.env.MCS_LSP_VERBOSE === '1';

// --- LSP Binary Discovery ---

/**
 * Find the LanguageServerHost.exe from the VS Code Copilot Studio extension.
 * Scans ~/.vscode/extensions/ for ms-copilotstudio.vscode-copilotstudio-{version}-win32-x64
 * and picks the latest version.
 */
function findLspBinary() {
    const extensionsDir = path.join(os.homedir(), '.vscode', 'extensions');
    if (!fs.existsSync(extensionsDir)) {
        throw new Error(
            'VS Code extensions directory not found.\n' +
            'Install the Copilot Studio extension: ms-copilotstudio.vscode-copilotstudio'
        );
    }

    const entries = fs.readdirSync(extensionsDir)
        .filter(d => d.startsWith('ms-copilotstudio.vscode-copilotstudio-') && d.includes('win32-x64'))
        .sort()
        .reverse(); // Latest version first

    if (entries.length === 0) {
        throw new Error(
            'Copilot Studio VS Code extension not found.\n' +
            'Install it: code --install-extension ms-copilotstudio.vscode-copilotstudio'
        );
    }

    const lspPath = path.join(extensionsDir, entries[0], 'lspOut', 'LanguageServerHost.exe');
    if (!fs.existsSync(lspPath)) {
        throw new Error(
            `LanguageServerHost.exe not found at: ${lspPath}\n` +
            `Extension found: ${entries[0]} but lspOut directory is missing.`
        );
    }

    if (VERBOSE) console.error(`[mcs-lsp] Using LSP binary: ${lspPath}`);
    return lspPath;
}

// --- LSP Transport (JSON-RPC over stdio with Content-Length framing) ---

class LspClient {
    constructor(lspPath) {
        this._lspPath = lspPath;
        this._process = null;
        this._nextId = 1;
        this._pending = new Map(); // id → { resolve, reject, timer }
        this._buffer = Buffer.alloc(0);
        this._started = false;
    }

    /**
     * Spawn the LSP process and begin listening for messages.
     */
    start() {
        this._process = spawn(this._lspPath, ['--stdio'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
            env: {
                ...process.env,
                // Suppress .NET console logging that pollutes stdout alongside JSON-RPC messages
                Logging__LogLevel__Default: 'None',
                Logging__Console__LogLevel__Default: 'None'
            }
        });

        this._process.stdout.on('data', (chunk) => this._onData(chunk));

        this._process.stderr.on('data', (chunk) => {
            const text = chunk.toString();
            if (VERBOSE) console.error(`[mcs-lsp stderr] ${text.trimEnd()}`);
        });

        this._process.on('error', (err) => {
            console.error(`[mcs-lsp] Process error: ${err.message}`);
            this._rejectAll(err);
        });

        this._process.on('exit', (code, signal) => {
            if (VERBOSE) console.error(`[mcs-lsp] Process exited: code=${code} signal=${signal}`);
            this._rejectAll(new Error(`LSP process exited unexpectedly (code=${code})`));
        });

        this._started = true;
    }

    /**
     * Send a JSON-RPC request and wait for the response.
     */
    send(method, params) {
        if (!this._started) throw new Error('LSP client not started');

        const id = this._nextId++;
        const message = {
            jsonrpc: '2.0',
            id,
            method,
            params: params || {}
        };

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this._pending.delete(id);
                reject(new Error(`LSP request timeout (${LSP_REQUEST_TIMEOUT_MS}ms): ${method}`));
            }, LSP_REQUEST_TIMEOUT_MS);

            this._pending.set(id, { resolve, reject, timer });
            this._write(message);
        });
    }

    /**
     * Send a JSON-RPC notification (no response expected).
     */
    notify(method, params) {
        if (!this._started) throw new Error('LSP client not started');

        const message = {
            jsonrpc: '2.0',
            method,
            params: params || {}
        };

        this._write(message);
    }

    /**
     * Gracefully shut down the LSP process.
     */
    async shutdown() {
        if (!this._started || !this._process || this._process.exitCode !== null) return;

        try {
            await this.send('shutdown', null);
            this.notify('exit', null);
        } catch {
            // Process may have already exited
        }

        // Give it a moment to exit cleanly
        await new Promise((resolve) => {
            const timer = setTimeout(() => {
                if (this._process && this._process.exitCode === null) {
                    this._process.kill('SIGTERM');
                }
                resolve();
            }, 3000);

            if (this._process) {
                this._process.once('exit', () => {
                    clearTimeout(timer);
                    resolve();
                });
            } else {
                clearTimeout(timer);
                resolve();
            }
        });
    }

    /**
     * Write a JSON-RPC message with Content-Length header.
     */
    _write(message) {
        const body = JSON.stringify(message);
        const header = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;
        if (VERBOSE) console.error(`[mcs-lsp →] ${message.method} (id=${message.id || 'notification'})`);
        this._process.stdin.write(header + body);
    }

    /**
     * Handle incoming data from stdout. Parse Content-Length framed messages.
     * The LSP may emit non-framed log lines (e.g., "info: Microsoft...") on stdout
     * before sending proper Content-Length framed JSON-RPC messages.
     * We skip all data until we find a Content-Length header.
     */
    _onData(chunk) {
        this._buffer = Buffer.concat([this._buffer, chunk]);

        while (this._buffer.length > 0) {
            // Find where "Content-Length:" starts in the buffer
            const bufStr = this._buffer.toString('utf8');
            const clIndex = bufStr.indexOf('Content-Length:');

            if (clIndex === -1) {
                // No Content-Length found — this is all non-framed log output.
                // Keep it in the buffer in case it's a partial "Content-Leng" at the end.
                if (this._buffer.length > 20) {
                    // Discard everything except the last 20 bytes (could be partial header)
                    const keep = this._buffer.slice(-20);
                    if (VERBOSE && this._buffer.length > 20) {
                        const discarded = this._buffer.slice(0, -20).toString('utf8').trim();
                        if (discarded) console.error(`[mcs-lsp skip] ${discarded.substring(0, 200)}`);
                    }
                    this._buffer = keep;
                }
                break;
            }

            // Discard anything before the Content-Length header (non-framed log lines)
            if (clIndex > 0) {
                if (VERBOSE) {
                    const skipped = bufStr.substring(0, clIndex).trim();
                    if (skipped) console.error(`[mcs-lsp skip] ${skipped.substring(0, 200)}`);
                }
                this._buffer = this._buffer.slice(clIndex);
            }

            // Look for the header-body separator
            const headerEnd = this._buffer.indexOf('\r\n\r\n');
            if (headerEnd === -1) break; // Incomplete header, wait for more data

            const headerStr = this._buffer.slice(0, headerEnd).toString('utf8');
            const match = headerStr.match(/Content-Length:\s*(\d+)/i);
            if (!match) {
                // Malformed header — skip past the separator and try again
                this._buffer = this._buffer.slice(headerEnd + 4);
                continue;
            }

            const contentLength = parseInt(match[1], 10);
            const messageStart = headerEnd + 4; // past \r\n\r\n
            const messageEnd = messageStart + contentLength;

            if (this._buffer.length < messageEnd) break; // Wait for more data

            const body = this._buffer.slice(messageStart, messageEnd).toString('utf8');
            this._buffer = this._buffer.slice(messageEnd);

            try {
                const msg = JSON.parse(body);
                this._onMessage(msg);
            } catch (err) {
                if (VERBOSE) console.error(`[mcs-lsp] Failed to parse JSON-RPC message: ${err.message}`);
            }
        }
    }

    /**
     * Handle a parsed JSON-RPC message.
     */
    _onMessage(msg) {
        // Response to a request we sent
        if (msg.id !== undefined && this._pending.has(msg.id)) {
            const { resolve, reject, timer } = this._pending.get(msg.id);
            this._pending.delete(msg.id);
            clearTimeout(timer);

            if (msg.error) {
                reject(new Error(`LSP error ${msg.error.code}: ${msg.error.message}`));
            } else {
                resolve(msg.result);
            }
            return;
        }

        // Server-initiated notification or request
        if (msg.method) {
            if (VERBOSE) console.error(`[mcs-lsp ←] notification: ${msg.method}`);

            // Handle server-to-client requests that need a response
            if (msg.id !== undefined) {
                // Respond with empty result to avoid blocking the server
                this._write({ jsonrpc: '2.0', id: msg.id, result: null });
            }
        }
    }

    /**
     * Reject all pending requests (on process exit/error).
     */
    _rejectAll(err) {
        for (const [id, { reject, timer }] of this._pending) {
            clearTimeout(timer);
            reject(err);
        }
        this._pending.clear();
    }
}

// --- Connection Info ---

/**
 * Read conn.json from a workspace's .mcs directory.
 */
function readConnJson(workspacePath) {
    const connPath = path.join(workspacePath, '.mcs', 'conn.json');
    if (!fs.existsSync(connPath)) {
        throw new Error(
            `No .mcs/conn.json found in workspace: ${workspacePath}\n` +
            'This workspace was not cloned via the Copilot Studio VS Code extension.\n' +
            'Clone an agent first using the extension, then use this tool to push/pull.'
        );
    }
    return JSON.parse(fs.readFileSync(connPath, 'utf8'));
}

/**
 * Get Dataverse and Power Platform access tokens via az CLI.
 */
function getTokens(connJson) {
    const dvUrl = connJson.DataverseEndpoint.replace(/\/$/, '');

    const dataverseToken = getAzToken(dvUrl);
    const copilotStudioToken = getAzToken('https://api.powerplatform.com');

    return { dataverseToken, copilotStudioToken };
}

/**
 * Get a single token via az CLI (same pattern as island-client.js).
 */
function getAzToken(resource) {
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

/**
 * Build the SyncAgentRequest from conn.json + tokens.
 * This matches the shape from DataverseRequest.cs, EnvironmentInfo.cs, CloneAgentRequest.cs.
 */
function buildSyncRequest(workspacePath, connJson, tokens) {
    // Convert workspace path to file URI
    const fileUri = 'file:///' + workspacePath.replace(/\\/g, '/').replace(/^\//, '');

    return {
        workspaceUri: fileUri,
        environmentInfo: {
            environmentId: connJson.EnvironmentId,
            dataverseUrl: connJson.DataverseEndpoint,
            displayName: '',
            agentManagementUrl: connJson.AgentManagementEndpoint
        },
        solutionVersions: connJson.SolutionVersions || {
            solutionVersions: {},
            copilotStudioSolutionVersion: ''
        },
        accountInfo: connJson.AccountInfo || {},
        dataverseAccessToken: tokens.dataverseToken,
        copilotStudioAccessToken: tokens.copilotStudioToken
    };
}

// --- LSP Lifecycle ---

/**
 * Send the LSP initialize request + initialized notification.
 */
async function initializeLsp(client, workspacePath) {
    const fileUri = 'file:///' + workspacePath.replace(/\\/g, '/').replace(/^\//, '');

    const initResult = await client.send('initialize', {
        processId: process.pid,
        capabilities: {
            textDocument: {
                synchronization: { dynamicRegistration: false, willSave: false, didSave: false },
                completion: { dynamicRegistration: false }
            },
            workspace: {
                workspaceFolders: true
            }
        },
        rootUri: fileUri,
        workspaceFolders: [{ uri: fileUri, name: path.basename(workspacePath) }]
    });

    if (VERBOSE) console.error('[mcs-lsp] Initialize response received');

    // Send initialized notification
    client.notify('initialized', {});

    // Small delay for server to finish startup processing
    await sleep(500);

    return initResult;
}

/**
 * Open all .mcs.yml files in the workspace via textDocument/didOpen notifications.
 * The LSP needs to know about files before it can push them.
 */
async function openWorkspaceFiles(client, workspacePath) {
    const files = findMcsYmlFiles(workspacePath);
    if (VERBOSE) console.error(`[mcs-lsp] Opening ${files.length} .mcs.yml files`);

    for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileUri = 'file:///' + filePath.replace(/\\/g, '/').replace(/^\//, '');

        client.notify('textDocument/didOpen', {
            textDocument: {
                uri: fileUri,
                languageId: 'yaml',
                version: 1,
                text: content
            }
        });
    }

    // Give the LSP a moment to process all didOpen notifications
    if (files.length > 0) await sleep(300);

    return files;
}

/**
 * Find all .mcs.yml files in a workspace directory (recursive).
 */
function findMcsYmlFiles(dir) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== '.mcs' && entry.name !== 'node_modules') {
            results.push(...findMcsYmlFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.mcs.yml')) {
            results.push(fullPath);
        }
    }

    return results;
}

// --- Commands ---

/**
 * Push local changes to MCS (local → remote).
 */
async function push(workspacePath, options = {}) {
    const connJson = readConnJson(workspacePath);
    const tokens = getTokens(connJson);
    const syncRequest = buildSyncRequest(workspacePath, connJson, tokens);

    const lspPath = options.lspPath || findLspBinary();
    const client = new LspClient(lspPath);

    try {
        client.start();
        await initializeLsp(client, workspacePath);
        await openWorkspaceFiles(client, workspacePath);

        console.error('[mcs-lsp] Pushing local changes to MCS...');
        const result = await client.send('powerplatformls/syncPush', syncRequest);

        if (result && result.code && result.code !== 0) {
            throw new Error(`Push failed: ${result.message || JSON.stringify(result)}`);
        }

        console.error('[mcs-lsp] Push completed successfully.');
        return result;
    } finally {
        await client.shutdown();
    }
}

/**
 * Pull remote changes from MCS (remote → local).
 */
async function pull(workspacePath, options = {}) {
    const connJson = readConnJson(workspacePath);
    const tokens = getTokens(connJson);
    const syncRequest = buildSyncRequest(workspacePath, connJson, tokens);

    const lspPath = options.lspPath || findLspBinary();
    const client = new LspClient(lspPath);

    try {
        client.start();
        await initializeLsp(client, workspacePath);
        await openWorkspaceFiles(client, workspacePath);

        console.error('[mcs-lsp] Pulling remote changes from MCS...');
        const result = await client.send('powerplatformls/syncPull', syncRequest);

        if (result && result.code && result.code !== 0) {
            throw new Error(`Pull failed: ${result.message || JSON.stringify(result)}`);
        }

        console.error('[mcs-lsp] Pull completed successfully.');
        return result;
    } finally {
        await client.shutdown();
    }
}

/**
 * Preview remote changes without applying them.
 */
async function preview(workspacePath, options = {}) {
    const connJson = readConnJson(workspacePath);
    const tokens = getTokens(connJson);
    const syncRequest = buildSyncRequest(workspacePath, connJson, tokens);

    const lspPath = options.lspPath || findLspBinary();
    const client = new LspClient(lspPath);

    try {
        client.start();
        await initializeLsp(client, workspacePath);
        await openWorkspaceFiles(client, workspacePath);

        console.error('[mcs-lsp] Checking for remote changes...');
        const result = await client.send('powerplatformls/getRemoteChanges', syncRequest);

        return result;
    } finally {
        await client.shutdown();
    }
}

/**
 * Get workspace/agent details from the LSP.
 */
async function info(workspacePath, options = {}) {
    const connJson = readConnJson(workspacePath);
    const fileUri = 'file:///' + workspacePath.replace(/\\/g, '/').replace(/^\//, '');

    const lspPath = options.lspPath || findLspBinary();
    const client = new LspClient(lspPath);

    try {
        client.start();
        await initializeLsp(client, workspacePath);

        console.error('[mcs-lsp] Getting workspace details...');
        const result = await client.send('powerplatformls/getWorkspaceDetails', {
            workspaceUri: fileUri
        });

        return { connJson, workspaceDetails: result };
    } finally {
        await client.shutdown();
    }
}

// --- Utility ---

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
            case '--workspace': config.workspace = args[++i]; break;
            case '--lsp-path': config.lspPath = args[++i]; break;
            case '--json': config.json = true; break;
            case '--help': printUsage(); process.exit(0);
        }
    }

    return config;
}

function printUsage() {
    console.log(`MCS Language Server Wrapper — headless push/pull for Copilot Studio agents

Usage: node mcs-lsp.js <command> --workspace <path> [options]

Commands:
  push       Push local .mcs.yml files to MCS (local → remote)
  pull       Pull remote agent state to local .mcs.yml files (remote → local)
  preview    Preview remote changes without applying them
  info       Show workspace and agent connection details

Required:
  --workspace <path>   Path to cloned agent workspace (contains .mcs/ directory)

Optional:
  --lsp-path <path>    Override path to LanguageServerHost.exe
  --json               Output raw JSON results
  --help               Show this help

Environment:
  MCS_LSP_VERBOSE=1    Enable verbose LSP protocol logging to stderr

Prerequisites:
  1. Copilot Studio VS Code extension installed (ms-copilotstudio.vscode-copilotstudio)
  2. Agent cloned via the extension (creates .mcs/conn.json)
  3. az CLI logged in (az login) for token acquisition

Examples:
  node tools/mcs-lsp.js info --workspace "C:\\Copilot 2\\Clone\\Daily Briefing"
  node tools/mcs-lsp.js preview --workspace "C:\\Copilot 2\\Clone\\Daily Briefing"
  node tools/mcs-lsp.js push --workspace "C:\\Copilot 2\\Clone\\Daily Briefing"
  node tools/mcs-lsp.js pull --workspace "C:\\Copilot 2\\Clone\\Daily Briefing"`);
}

async function main() {
    const config = parseArgs();

    if (!config.workspace) {
        console.error('Error: --workspace is required. Provide the path to a cloned agent workspace.');
        process.exit(2);
    }

    // Resolve workspace path
    const workspace = path.resolve(config.workspace);
    if (!fs.existsSync(workspace)) {
        console.error(`Error: Workspace not found: ${workspace}`);
        process.exit(2);
    }

    const options = {};
    if (config.lspPath) options.lspPath = config.lspPath;

    try {
        switch (config.command) {
            case 'push': {
                const result = await push(workspace, options);
                if (config.json) {
                    console.log(JSON.stringify(result, null, 2));
                } else {
                    if (result && result.localChanges) {
                        console.log(`Push result: ${result.localChanges.length} local changes synced`);
                    } else {
                        console.log('Push completed.');
                    }
                }
                break;
            }

            case 'pull': {
                const result = await pull(workspace, options);
                if (config.json) {
                    console.log(JSON.stringify(result, null, 2));
                } else {
                    console.log('Pull completed. Local files updated from remote.');
                }
                break;
            }

            case 'preview': {
                const result = await preview(workspace, options);
                if (config.json) {
                    console.log(JSON.stringify(result, null, 2));
                } else {
                    if (result && result.localChanges && result.localChanges.length > 0) {
                        console.log(`Remote changes detected: ${result.localChanges.length} file(s)`);
                        for (const change of result.localChanges) {
                            console.log(`  ${change.changeType || 'modified'}: ${change.path || change.uri || JSON.stringify(change)}`);
                        }
                    } else {
                        console.log('No remote changes detected. Local workspace is up to date.');
                    }
                }
                break;
            }

            case 'info': {
                const result = await info(workspace, options);
                if (config.json) {
                    console.log(JSON.stringify(result, null, 2));
                } else {
                    const conn = result.connJson;
                    console.log('Workspace Info:');
                    console.log(`  Agent ID:       ${conn.AgentId}`);
                    console.log(`  Environment:    ${conn.EnvironmentId}`);
                    console.log(`  Dataverse:      ${conn.DataverseEndpoint}`);
                    console.log(`  Gateway:        ${conn.AgentManagementEndpoint}`);
                    console.log(`  Account:        ${conn.AccountInfo?.AccountEmail || 'unknown'}`);
                    console.log(`  Tenant:         ${conn.AccountInfo?.TenantId || 'unknown'}`);
                    console.log(`  MCS Version:    ${conn.SolutionVersions?.CopilotStudioSolutionVersion || 'unknown'}`);
                    const files = findMcsYmlFiles(workspace);
                    console.log(`  Local files:    ${files.length} .mcs.yml files`);
                    if (result.workspaceDetails) {
                        console.log(`\nLSP Workspace Details:`);
                        console.log(JSON.stringify(result.workspaceDetails, null, 2));
                    }
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
        if (VERBOSE && err.stack) console.error(err.stack);
        process.exit(1);
    }
}

// --- Module Exports (for programmatic use) ---
module.exports = {
    LspClient,
    findLspBinary,
    readConnJson,
    getTokens,
    buildSyncRequest,
    push,
    pull,
    preview,
    info,
    findMcsYmlFiles
};

// Run CLI if invoked directly
if (require.main === module) {
    main().catch(err => {
        console.error('Fatal:', err.message);
        process.exit(2);
    });
}
