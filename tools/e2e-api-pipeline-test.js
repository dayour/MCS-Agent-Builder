#!/usr/bin/env node
/**
 * End-to-End API Build Pipeline Test
 *
 * Proves the full headless MCS agent build pipeline works without Playwright.
 * Creates a specialist + orchestrator pair, configures via LSP + Dataverse + Island Gateway,
 * tests connected agents, eval upload, then tears everything down.
 *
 * Target: admin@M365CPI15209943 / dktest (configurable via --account / --env-name)
 *
 * Usage:
 *   node tools/e2e-api-pipeline-test.js
 *   node tools/e2e-api-pipeline-test.js --account admin@M365CPI15209943 --env-name dktest
 *   node tools/e2e-api-pipeline-test.js --skip-teardown   # Keep agents for manual inspection
 *   node tools/e2e-api-pipeline-test.js --start-from 3    # Resume from step 3
 *
 * Prerequisites:
 *   - az login (as target account)
 *   - pac auth select (matching profile)
 *   - Copilot Studio VS Code extension installed (for LSP)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { httpRequest, getToken: getAzToken, sleep } = require('./lib/http');

// --- Configuration ---
const CONFIG = {
    dataverseUrl: 'https://org04723bf3.crm.dynamics.com',
    environmentId: 'f9a0cae4-a7e5-e91a-b358-9b848e12071c',
    gatewayUrl: 'https://powervamg.us-il104.gateway.prod.island.powerapps.com',
    tenantId: 'd75a8725-8943-4f7f-9738-a96d3d3151de',
    accountEmail: 'admin@M365CPI15209943.onmicrosoft.com',
    publisherPrefix: 'cr509',
    specialistName: 'E2E-Test-Specialist',
    orchestratorName: 'E2E-Test-Orchestrator',
    workspaceRoot: path.join(process.cwd(), 'Clone', '_e2e-test'),
};
CONFIG.specialistSchema = `${CONFIG.publisherPrefix}_e2etestspecialist`;
CONFIG.orchestratorSchema = `${CONFIG.publisherPrefix}_e2etestorchestrator`;

// --- Parse CLI args ---
const ARGS = (() => {
    const args = process.argv.slice(2);
    const opts = { skipTeardown: false, startFrom: 1, verbose: false };
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--skip-teardown': opts.skipTeardown = true; break;
            case '--start-from': opts.startFrom = parseInt(args[++i], 10); break;
            case '--verbose': opts.verbose = true; break;
            case '--help':
                console.log('Usage: node e2e-api-pipeline-test.js [--skip-teardown] [--start-from N] [--verbose]');
                process.exit(0);
        }
    }
    return opts;
})();

// --- State: passed between steps ---
const STATE = {
    specialistBotId: null,
    orchestratorBotId: null,
    specialistWorkspace: null,
    orchestratorWorkspace: null,
    dvToken: null,
    csToken: null,
};

// --- Results tracking ---
const RESULTS = [];

function logStep(stepNum, name, status, details, error) {
    const icon = status === 'PASS' ? '\x1b[32m✓\x1b[0m' :
                 status === 'FAIL' ? '\x1b[31m✗\x1b[0m' :
                 status === 'SKIP' ? '\x1b[33m-\x1b[0m' : '?';
    console.log(`\n${icon} Step ${stepNum}: ${name} — ${status}`);
    if (details) console.log(`  ${details}`);
    if (error) console.log(`  \x1b[31mError: ${error}\x1b[0m`);
    RESULTS.push({ step: stepNum, name, status, details, error });
}

// --- Token Acquisition (getAzToken imported from ./lib/http) ---

function refreshTokens() {
    STATE.dvToken = getAzToken(CONFIG.dataverseUrl);
    STATE.csToken = getAzToken('96ff4394-9197-43aa-b393-6a41652e21f8');
}

// httpRequest imported from ./lib/http (supports configurable timeout, Content-Length, http+https)

function dvHeaders(extraHeaders = {}) {
    return {
        'Authorization': `Bearer ${STATE.dvToken}`,
        'Accept': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        'Content-Type': 'application/json',
        ...extraHeaders,
    };
}

function gwHeaders() {
    return {
        'Authorization': `Bearer ${STATE.csToken}`,
        'Content-Type': 'application/json',
        'x-ms-client-tenant-id': CONFIG.tenantId,
        'x-cci-tenantid': CONFIG.tenantId,
        'x-cci-bapenvironmentid': CONFIG.environmentId,
    };
}

// --- Dataverse Helpers ---

async function dvGet(entityPath) {
    const url = `${CONFIG.dataverseUrl}/api/data/v9.2/${entityPath}`;
    return httpRequest('GET', url, dvHeaders());
}

async function dvPost(entityPath, body, extraHeaders = {}) {
    const url = `${CONFIG.dataverseUrl}/api/data/v9.2/${entityPath}`;
    return httpRequest('POST', url, dvHeaders({ Prefer: 'return=representation', ...extraHeaders }), body);
}

async function dvPatch(entityPath, body) {
    const url = `${CONFIG.dataverseUrl}/api/data/v9.2/${entityPath}`;
    return httpRequest('PATCH', url, dvHeaders({ 'If-Match': '*' }), body);
}

async function dvBoundAction(entityPath, actionName, body = {}) {
    const url = `${CONFIG.dataverseUrl}/api/data/v9.2/${entityPath}/Microsoft.Dynamics.CRM.${actionName}`;
    return httpRequest('POST', url, dvHeaders(), body);
}


// =============================================================================
// PHASE 1: Agent Creation (Dataverse POST + PvaProvision)
// =============================================================================

async function step1_createSpecialist() {
    // First check if agent already exists (for resume)
    const existing = await dvGet(
        `bots?$filter=schemaname eq '${CONFIG.specialistSchema}'&$select=botid,name,statecode,statuscode`
    );
    if (existing.data.value && existing.data.value.length > 0) {
        STATE.specialistBotId = existing.data.value[0].botid;
        return { pass: true, details: `Already exists: ${STATE.specialistBotId} (statuscode=${existing.data.value[0].statuscode})` };
    }

    // Create bot entity
    const createBody = {
        name: CONFIG.specialistName,
        schemaname: CONFIG.specialistSchema,
        language: 1033,
        runtimeprovider: 0,
        accesscontrolpolicy: 0,
        authenticationmode: 0,
        configuration: JSON.stringify({
            aISettings: {
                useModelKnowledge: true,
                model: { modelNameHint: "GPT4oMini" }
            },
            settings: {
                GenerativeActionsEnabled: true
            }
        })
    };

    const createRes = await dvPost('bots', createBody);
    if (createRes.status !== 201 && createRes.status !== 200) {
        return { pass: false, details: `POST /bots failed: HTTP ${createRes.status}`, error: JSON.stringify(createRes.data).substring(0, 300) };
    }

    const botId = createRes.data.botid;
    if (!botId) {
        return { pass: false, details: 'POST succeeded but no botid in response', error: JSON.stringify(createRes.data).substring(0, 300) };
    }
    STATE.specialistBotId = botId;

    // Call PvaProvision
    const provRes = await dvBoundAction(`bots(${botId})`, 'PvaProvision');
    if (provRes.status >= 400) {
        return { pass: false, details: `PvaProvision failed: HTTP ${provRes.status}`, error: JSON.stringify(provRes.data).substring(0, 300) };
    }

    // Poll for provisioning status (max 60s)
    for (let i = 0; i < 20; i++) {
        await sleep(3000);
        const statusRes = await dvGet(`bots(${botId})?$select=statuscode,statecode`);
        const sc = statusRes.data.statuscode;
        if (sc === 1) { // Provisioned
            return { pass: true, details: `Created & provisioned: ${botId}` };
        }
        if (sc === 4) { // ProvisionFailed
            return { pass: false, details: `PvaProvision returned ProvisionFailed`, error: `statuscode=4` };
        }
        if (ARGS.verbose) console.log(`    Polling provision status... statuscode=${sc}`);
    }

    return { pass: false, details: 'Provisioning timed out (60s)', error: `botId=${botId}` };
}

async function step2_createOrchestrator() {
    // First check if agent already exists
    const existing = await dvGet(
        `bots?$filter=schemaname eq '${CONFIG.orchestratorSchema}'&$select=botid,name,statecode,statuscode`
    );
    if (existing.data.value && existing.data.value.length > 0) {
        STATE.orchestratorBotId = existing.data.value[0].botid;
        return { pass: true, details: `Already exists: ${STATE.orchestratorBotId} (statuscode=${existing.data.value[0].statuscode})` };
    }

    // Create bot entity
    const createBody = {
        name: CONFIG.orchestratorName,
        schemaname: CONFIG.orchestratorSchema,
        language: 1033,
        runtimeprovider: 0,
        accesscontrolpolicy: 0,
        authenticationmode: 0,
        configuration: JSON.stringify({
            aISettings: {
                useModelKnowledge: true,
                model: { modelNameHint: "GPT4oMini" }
            },
            settings: {
                GenerativeActionsEnabled: true
            }
        })
    };

    const createRes = await dvPost('bots', createBody);
    if (createRes.status !== 201 && createRes.status !== 200) {
        return { pass: false, details: `POST /bots failed: HTTP ${createRes.status}`, error: JSON.stringify(createRes.data).substring(0, 300) };
    }

    const botId = createRes.data.botid;
    if (!botId) {
        return { pass: false, details: 'POST succeeded but no botid in response', error: JSON.stringify(createRes.data).substring(0, 300) };
    }
    STATE.orchestratorBotId = botId;

    // Call PvaProvision
    const provRes = await dvBoundAction(`bots(${botId})`, 'PvaProvision');
    if (provRes.status >= 400) {
        return { pass: false, details: `PvaProvision failed: HTTP ${provRes.status}`, error: JSON.stringify(provRes.data).substring(0, 300) };
    }

    // Poll
    for (let i = 0; i < 20; i++) {
        await sleep(3000);
        const statusRes = await dvGet(`bots(${botId})?$select=statuscode,statecode`);
        const sc = statusRes.data.statuscode;
        if (sc === 1) return { pass: true, details: `Created & provisioned: ${botId}` };
        if (sc === 4) return { pass: false, details: 'PvaProvision ProvisionFailed', error: 'statuscode=4' };
        if (ARGS.verbose) console.log(`    Polling provision status... statuscode=${sc}`);
    }
    return { pass: false, details: 'Provisioning timed out (60s)' };
}

async function step2b_verifyInPacList() {
    // Verify both agents appear in pac copilot list
    try {
        const output = execSync('pac copilot list 2>&1', { encoding: 'utf8' });
        const hasSpecialist = output.includes(CONFIG.specialistName);
        const hasOrchestrator = output.includes(CONFIG.orchestratorName);
        if (hasSpecialist && hasOrchestrator) {
            return { pass: true, details: 'Both agents visible in pac copilot list' };
        }
        return { pass: false, details: `Specialist: ${hasSpecialist}, Orchestrator: ${hasOrchestrator}`, error: 'One or both agents missing from pac copilot list' };
    } catch (err) {
        return { pass: false, details: 'pac copilot list failed', error: err.message.substring(0, 200) };
    }
}

// =============================================================================
// PHASE 2: Configuration via LSP (clone → edit → push)
// =============================================================================

async function step3_cloneWorkspaces() {
    const lsp = require('./mcs-lsp.js');

    // Clean up any previous test workspace
    if (fs.existsSync(CONFIG.workspaceRoot)) {
        fs.rmSync(CONFIG.workspaceRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(CONFIG.workspaceRoot, { recursive: true });

    const results = [];

    // Clone specialist
    try {
        const specClone = await lsp.clone(CONFIG.workspaceRoot, {
            agentId: STATE.specialistBotId,
            displayName: CONFIG.specialistName,
            environmentId: CONFIG.environmentId,
            dataverseUrl: CONFIG.dataverseUrl,
            gatewayUrl: CONFIG.gatewayUrl,
            accountEmail: CONFIG.accountEmail,
            tenantId: CONFIG.tenantId,
        });
        STATE.specialistWorkspace = specClone.agentPath;
        results.push(`Specialist: ${specClone.fileCount} files`);
    } catch (err) {
        return { pass: false, details: 'Specialist clone failed', error: err.message.substring(0, 300) };
    }

    // Clone orchestrator
    try {
        const orchClone = await lsp.clone(CONFIG.workspaceRoot, {
            agentId: STATE.orchestratorBotId,
            displayName: CONFIG.orchestratorName,
            environmentId: CONFIG.environmentId,
            dataverseUrl: CONFIG.dataverseUrl,
            gatewayUrl: CONFIG.gatewayUrl,
            accountEmail: CONFIG.accountEmail,
            tenantId: CONFIG.tenantId,
        });
        STATE.orchestratorWorkspace = orchClone.agentPath;
        results.push(`Orchestrator: ${orchClone.fileCount} files`);
    } catch (err) {
        return { pass: false, details: 'Orchestrator clone failed', error: err.message.substring(0, 300) };
    }

    // Verify .mcs/conn.json exists
    const specConn = path.join(STATE.specialistWorkspace, '.mcs', 'conn.json');
    const orchConn = path.join(STATE.orchestratorWorkspace, '.mcs', 'conn.json');
    if (!fs.existsSync(specConn) || !fs.existsSync(orchConn)) {
        return { pass: false, details: 'conn.json missing', error: `spec=${fs.existsSync(specConn)}, orch=${fs.existsSync(orchConn)}` };
    }

    return { pass: true, details: results.join(' | ') };
}

async function step4_setInstructions() {
    const agentYml = path.join(STATE.specialistWorkspace, 'agent.mcs.yml');
    if (!fs.existsSync(agentYml)) {
        return { pass: false, details: 'agent.mcs.yml not found', error: STATE.specialistWorkspace };
    }

    let content = fs.readFileSync(agentYml, 'utf8');

    // Add or replace instructions block
    const instructions = `You are an E2E test specialist agent. Your purpose is to validate API pipeline operations. When asked about testing, respond with "Pipeline test successful." Always be concise.`;

    if (content.includes('instructions:')) {
        // Replace existing instructions
        content = content.replace(
            /instructions:[\s\S]*?(?=\n\w|\n$|$)/,
            `instructions: |-\n  ${instructions.replace(/\n/g, '\n  ')}`
        );
    } else {
        // Add instructions after the first line
        const lines = content.split('\n');
        const insertIdx = lines.findIndex(l => l.startsWith('kind:')) + 1 || 1;
        lines.splice(insertIdx, 0, `instructions: |-\n  ${instructions.replace(/\n/g, '\n  ')}`);
        content = lines.join('\n');
    }

    fs.writeFileSync(agentYml, content, 'utf8');

    // Verify file was written
    const verify = fs.readFileSync(agentYml, 'utf8');
    if (verify.includes('Pipeline test successful')) {
        return { pass: true, details: `Instructions set (${instructions.length} chars)` };
    }
    return { pass: false, details: 'Instructions not found in file after write' };
}

async function step5_setModel() {
    const agentYml = path.join(STATE.specialistWorkspace, 'agent.mcs.yml');
    let content = fs.readFileSync(agentYml, 'utf8');

    // Set model in aISettings
    if (content.includes('modelNameHint:')) {
        content = content.replace(/modelNameHint:\s*\S+/, 'modelNameHint: GPT41');
    } else if (content.includes('aISettings:')) {
        content = content.replace(
            /aISettings:/,
            'aISettings:\n  model:\n    modelNameHint: GPT41'
        );
    } else {
        content += '\naISettings:\n  model:\n    modelNameHint: GPT41\n';
    }

    fs.writeFileSync(agentYml, content, 'utf8');

    const verify = fs.readFileSync(agentYml, 'utf8');
    if (verify.includes('modelNameHint: GPT41')) {
        return { pass: true, details: 'Model set to GPT41 in agent.mcs.yml' };
    }
    return { pass: false, details: 'modelNameHint not found in file after edit' };
}

async function step6_setSuggestedPrompts() {
    const agentYml = path.join(STATE.specialistWorkspace, 'agent.mcs.yml');
    let content = fs.readFileSync(agentYml, 'utf8');

    // Add conversation starters
    const starters = `\nconversationStarters:\n  - title: Test the pipeline\n    text: Run a pipeline test\n  - title: Check status\n    text: What is the current status?\n`;

    if (content.includes('conversationStarters:')) {
        content = content.replace(/conversationStarters:[\s\S]*?(?=\n\w|\n$)/, starters.trim());
    } else {
        content += starters;
    }

    fs.writeFileSync(agentYml, content, 'utf8');

    const verify = fs.readFileSync(agentYml, 'utf8');
    if (verify.includes('Run a pipeline test')) {
        return { pass: true, details: '2 conversation starters added' };
    }
    return { pass: false, details: 'Conversation starters not found after edit' };
}

async function step7_setWebSearchOff() {
    const agentYml = path.join(STATE.specialistWorkspace, 'agent.mcs.yml');
    let content = fs.readFileSync(agentYml, 'utf8');

    // Add gptCapabilities
    const capabilities = `\ngptCapabilities:\n  webBrowsing: false\n  codeInterpreter: false\n  generateImages: false\n`;

    if (content.includes('gptCapabilities:')) {
        content = content.replace(/gptCapabilities:[\s\S]*?(?=\n\w|\n$)/, capabilities.trim());
    } else {
        content += capabilities;
    }

    fs.writeFileSync(agentYml, content, 'utf8');

    const verify = fs.readFileSync(agentYml, 'utf8');
    if (verify.includes('webBrowsing: false')) {
        return { pass: true, details: 'webBrowsing set to false in agent.mcs.yml' };
    }
    return { pass: false, details: 'webBrowsing setting not found after edit' };
}

async function step8_addCustomTopic() {
    const topicsDir = path.join(STATE.specialistWorkspace, 'topics');
    fs.mkdirSync(topicsDir, { recursive: true });

    const topicYml = `kind: AdaptiveDialog
modelDescription: This topic handles E2E test greetings
beginDialog:
  kind: OnRecognizedIntent
  id: main
  intent:
    triggerQueries:
      - e2e pipeline test
      - run test
      - test greeting
  actions:
    - kind: SendActivity
      id: sendActivity_1
      activity: "Hello! This is the E2E test topic responding successfully."`;

    const topicPath = path.join(topicsDir, 'E2ETestTopic.mcs.yml');
    fs.writeFileSync(topicPath, topicYml, 'utf8');

    if (fs.existsSync(topicPath)) {
        return { pass: true, details: 'E2ETestTopic.mcs.yml created in topics/' };
    }
    return { pass: false, details: 'Topic file not created' };
}

async function step9_addKnowledgeSource() {
    const knowledgeDir = path.join(STATE.specialistWorkspace, 'knowledge');
    fs.mkdirSync(knowledgeDir, { recursive: true });

    // Correct format: must use KnowledgeSourceConfiguration kind + schema-based filename
    // Discovered from cloning an agent with knowledge: file is named after schemaname
    const schemaName = `${CONFIG.specialistSchema}.topic.E2ETestKnowledge`;
    const knowledgeYml = `# Name: E2E Test Knowledge
# This knowledge source searches information on the web found in learn.microsoft.com
kind: KnowledgeSourceConfiguration
source:
  kind: PublicSiteSearchSource
  site: https://learn.microsoft.com/en-us/microsoft-copilot-studio/
  includeSubPages: true`;

    const knowledgePath = path.join(knowledgeDir, `${schemaName}.mcs.yml`);
    fs.writeFileSync(knowledgePath, knowledgeYml, 'utf8');

    // Remove the old incorrectly-named file if it exists
    const oldPath = path.join(knowledgeDir, 'E2ETestKnowledge.mcs.yml');
    if (fs.existsSync(oldPath) && oldPath !== knowledgePath) {
        fs.unlinkSync(oldPath);
    }

    if (fs.existsSync(knowledgePath)) {
        return { pass: true, details: `${path.basename(knowledgePath)} created in knowledge/` };
    }
    return { pass: false, details: 'Knowledge file not created' };
}

async function step10_pushSpecialist() {
    const lsp = require('./mcs-lsp.js');

    try {
        // Refresh tokens before push (they may have expired during clone)
        refreshTokens();

        const result = await lsp.push(STATE.specialistWorkspace);
        return { pass: true, details: `Push completed. Result: ${JSON.stringify(result || 'ok').substring(0, 200)}` };
    } catch (err) {
        return { pass: false, details: 'LSP push failed', error: err.message.substring(0, 300) };
    }
}

async function step10b_verifyPushResults() {
    // Verify instructions via Dataverse read-back
    const comps = await dvGet(
        `botcomponents?$filter=_parentbotid_value eq '${STATE.specialistBotId}' and componenttype eq 15&$select=data,content`
    );
    const instrComp = comps.data.value && comps.data.value[0];
    const hasInstructions = instrComp && (
        (instrComp.data && instrComp.data.includes('Pipeline test successful')) ||
        (instrComp.content && instrComp.content.includes('Pipeline test successful'))
    );

    // Verify topics
    const topics = await dvGet(
        `botcomponents?$filter=_parentbotid_value eq '${STATE.specialistBotId}' and componenttype eq 9&$select=name,schemaname`
    );
    const topicNames = (topics.data.value || []).map(t => t.name);
    const hasTestTopic = topicNames.some(n => n && n.toLowerCase().includes('e2e'));

    // Verify knowledge
    const knowledge = await dvGet(
        `botcomponents?$filter=_parentbotid_value eq '${STATE.specialistBotId}' and componenttype eq 16&$select=name`
    );
    const hasKnowledge = (knowledge.data.value || []).length > 0;

    const results = [
        `Instructions: ${hasInstructions ? 'PASS' : 'FAIL'}`,
        `Topic: ${hasTestTopic ? 'PASS' : 'FAIL'} (${topicNames.join(', ')})`,
        `Knowledge: ${hasKnowledge ? 'PASS' : 'FAIL'} (${(knowledge.data.value || []).length} sources)`,
    ];

    const allPass = hasInstructions && hasTestTopic && hasKnowledge;
    return { pass: allPass, details: results.join(' | ') };
}

// =============================================================================
// PHASE 3: Settings via Dataverse API
// =============================================================================

async function step11_disableGeneralKnowledge() {
    // Read current configuration
    const botRes = await dvGet(`bots(${STATE.specialistBotId})?$select=configuration`);
    let config;
    try {
        config = typeof botRes.data.configuration === 'string'
            ? JSON.parse(botRes.data.configuration)
            : botRes.data.configuration || {};
    } catch {
        config = {};
    }

    // Set useModelKnowledge to false
    if (!config.aISettings) config.aISettings = {};
    config.aISettings.useModelKnowledge = false;

    const patchRes = await dvPatch(`bots(${STATE.specialistBotId})`, {
        configuration: JSON.stringify(config)
    });

    if (patchRes.status >= 400) {
        return { pass: false, details: `PATCH failed: HTTP ${patchRes.status}`, error: JSON.stringify(patchRes.data).substring(0, 200) };
    }

    // Verify
    const verifyRes = await dvGet(`bots(${STATE.specialistBotId})?$select=configuration`);
    let verifyConfig;
    try { verifyConfig = JSON.parse(verifyRes.data.configuration); } catch { verifyConfig = {}; }

    if (verifyConfig.aISettings && verifyConfig.aISettings.useModelKnowledge === false) {
        return { pass: true, details: 'useModelKnowledge set to false and verified' };
    }
    return { pass: false, details: 'useModelKnowledge not verified as false', error: JSON.stringify(verifyConfig.aISettings).substring(0, 200) };
}

async function step12_setAuthMode() {
    const patchRes = await dvPatch(`bots(${STATE.specialistBotId})`, {
        authenticationmode: 1  // Integrated
    });

    if (patchRes.status >= 400) {
        return { pass: false, details: `PATCH failed: HTTP ${patchRes.status}`, error: JSON.stringify(patchRes.data).substring(0, 200) };
    }

    // Verify
    const verifyRes = await dvGet(`bots(${STATE.specialistBotId})?$select=authenticationmode`);
    if (verifyRes.data.authenticationmode === 1) {
        return { pass: true, details: 'authenticationmode set to 1 (Integrated) and verified' };
    }
    return { pass: false, details: `authenticationmode is ${verifyRes.data.authenticationmode}, expected 1` };
}

async function step13_enableAgentConnectable() {
    // Read current configuration
    const botRes = await dvGet(`bots(${STATE.specialistBotId})?$select=configuration`);
    let config;
    try {
        config = typeof botRes.data.configuration === 'string'
            ? JSON.parse(botRes.data.configuration)
            : botRes.data.configuration || {};
    } catch {
        config = {};
    }

    // Set isAgentConnectable to true
    config.isAgentConnectable = true;

    const patchRes = await dvPatch(`bots(${STATE.specialistBotId})`, {
        configuration: JSON.stringify(config)
    });

    if (patchRes.status >= 400) {
        return { pass: false, details: `PATCH failed: HTTP ${patchRes.status}`, error: JSON.stringify(patchRes.data).substring(0, 200) };
    }

    // Verify
    const verifyRes = await dvGet(`bots(${STATE.specialistBotId})?$select=configuration`);
    let verifyConfig;
    try { verifyConfig = JSON.parse(verifyRes.data.configuration); } catch { verifyConfig = {}; }

    if (verifyConfig.isAgentConnectable === true) {
        return { pass: true, details: 'isAgentConnectable set to true and verified' };
    }
    return { pass: false, details: 'isAgentConnectable not verified', error: JSON.stringify(verifyConfig).substring(0, 200) };
}

// =============================================================================
// PHASE 4: Publish
// =============================================================================

async function step14_publishSpecialist() {
    const pubRes = await dvBoundAction(`bots(${STATE.specialistBotId})`, 'PvaPublish');
    if (pubRes.status >= 400) {
        return { pass: false, details: `PvaPublish failed: HTTP ${pubRes.status}`, error: JSON.stringify(pubRes.data).substring(0, 200) };
    }

    // Wait for publish to complete (poll publishedon)
    await sleep(5000);
    for (let i = 0; i < 12; i++) {
        const bot = await dvGet(`bots(${STATE.specialistBotId})?$select=publishedon,statecode,statuscode`);
        const pub = bot.data.publishedon;
        if (pub) {
            const pubDate = new Date(pub);
            const now = new Date();
            const diffMin = (now - pubDate) / 60000;
            if (diffMin < 5) {
                return { pass: true, details: `Published at ${pubDate.toISOString()} (${diffMin.toFixed(1)} min ago)` };
            }
        }
        if (ARGS.verbose) console.log(`    Waiting for publish... attempt ${i + 1}`);
        await sleep(5000);
    }
    return { pass: false, details: 'Publish did not complete within 60s' };
}

// =============================================================================
// PHASE 5: Connected Agent (NEEDS TESTING)
// =============================================================================

async function step15_connectSpecialistToOrchestrator() {
    // Method A: Try Island Gateway connectedAgentDefinitionChanges
    const islandClient = require('./island-client.js');

    try {
        // First, refresh tokens
        refreshTokens();

        // Read orchestrator components to get changeToken
        const headers = {
            'Authorization': `Bearer ${STATE.csToken}`,
            'Content-Type': 'application/json',
            'x-ms-client-tenant-id': CONFIG.tenantId,
            'x-cci-tenantid': CONFIG.tenantId,
            'x-cci-bapenvironmentid': CONFIG.environmentId,
            'x-cci-cdsbotid': STATE.orchestratorBotId,
        };

        const readResult = await islandClient.readComponents(
            CONFIG.gatewayUrl, CONFIG.environmentId, STATE.orchestratorBotId, headers
        );
        const changeToken = readResult.changeToken;

        // Build connected agent write payload
        const writePayload = {
            botComponentChanges: [],
            cloudFlowDefinitionChanges: [],
            connectorDefinitionChanges: [],
            environmentVariableChanges: [],
            connectionReferenceChanges: [],
            aIPluginOperationChanges: [],
            componentCollectionChanges: [],
            dataverseTableSearchChanges: [],
            connectedAgentDefinitionChanges: [
                {
                    '$kind': 'ConnectedAgentDefinitionInsert',
                    connectedAgentDefinition: {
                        '$kind': 'ConnectedAgentDefinition',
                        connectedAgentSchemaName: CONFIG.specialistSchema,
                        isAgentConnectable: true,
                    }
                }
            ],
            changeToken: changeToken
        };

        const writeResult = await islandClient.writeComponents(
            CONFIG.gatewayUrl, CONFIG.environmentId, STATE.orchestratorBotId, headers, writePayload
        );

        return { pass: true, details: `Connected agent added via Island Gateway. Result: ${JSON.stringify(writeResult).substring(0, 200)}` };
    } catch (err) {
        // Method B fallback: Try LSP push with connected agent YAML
        try {
            return await step15_fallback_lspPush(err.message);
        } catch (err2) {
            return {
                pass: false,
                details: `Both methods failed. Island Gateway: ${err.message.substring(0, 150)}`,
                error: `LSP fallback: ${err2.message.substring(0, 150)}`
            };
        }
    }
}

async function step15_fallback_lspPush(igError) {
    // Try adding connected agent YAML to orchestrator workspace and pushing
    const connDir = path.join(STATE.orchestratorWorkspace, 'connectedAgents');
    fs.mkdirSync(connDir, { recursive: true });

    const connYml = `kind: ConnectedAgentDefinition
connectedAgentSchemaName: ${CONFIG.specialistSchema}
isAgentConnectable: true`;

    fs.writeFileSync(
        path.join(connDir, `${CONFIG.specialistSchema}.mcs.yml`),
        connYml,
        'utf8'
    );

    const lsp = require('./mcs-lsp.js');
    const result = await lsp.push(STATE.orchestratorWorkspace);

    // Verify by reading components
    const headers = {
        'Authorization': `Bearer ${STATE.csToken}`,
        'Content-Type': 'application/json',
        'x-ms-client-tenant-id': CONFIG.tenantId,
        'x-cci-tenantid': CONFIG.tenantId,
        'x-cci-bapenvironmentid': CONFIG.environmentId,
        'x-cci-cdsbotid': STATE.orchestratorBotId,
    };
    const islandClient = require('./island-client.js');
    const comps = await islandClient.readComponents(
        CONFIG.gatewayUrl, CONFIG.environmentId, STATE.orchestratorBotId, headers
    );
    const changes = comps.botComponentChanges || [];
    const hasConnected = changes.some(c =>
        c.component && (
            c.component['$kind'] === 'ConnectedAgentDefinition' ||
            (c.component.connectedAgentSchemaName === CONFIG.specialistSchema)
        )
    );

    if (hasConnected) {
        return { pass: true, details: `Connected via LSP push (Island Gateway failed: ${igError.substring(0, 80)})` };
    }

    return {
        pass: false,
        details: `LSP push succeeded but connected agent not found in components`,
        error: `IG error: ${igError.substring(0, 100)}`
    };
}

// =============================================================================
// PHASE 6: Eval Upload (NEEDS TESTING)
// =============================================================================

async function step16_createEvalSet() {
    // Try creating an EvaluationSet as a botcomponent type 19
    // The content/data should contain the graders configuration

    const evalSetContent = JSON.stringify({
        name: 'E2E Test Eval Set',
        description: 'Test evaluation set for E2E pipeline',
        graders: [
            { method: 'Compare meaning', threshold: 70 },
            { method: 'Keyword match', mode: 'all' }
        ]
    });

    const createRes = await dvPost('botcomponents', {
        name: 'E2E-Test-EvalSet',
        componenttype: 19,
        content: evalSetContent,
        schemaname: `${CONFIG.publisherPrefix}_e2etestevalset_${Date.now()}`,
        'parentbotid@odata.bind': `/bots(${STATE.specialistBotId})`
    });

    if (createRes.status === 201 || createRes.status === 200) {
        const compId = createRes.data.botcomponentid;
        return { pass: true, details: `EvaluationSet component created: ${compId}` };
    }

    // If parentbotid binding fails, try without it and associate manually
    if (createRes.status >= 400) {
        // Try with _parentbotid_value directly (some environments support this)
        const retryRes = await dvPost('botcomponents', {
            name: 'E2E-Test-EvalSet',
            componenttype: 19,
            content: evalSetContent,
            schemaname: `${CONFIG.publisherPrefix}_e2etestevalset_${Date.now()}`,
        });

        if (retryRes.status === 201 || retryRes.status === 200) {
            const compId = retryRes.data.botcomponentid;
            // Try to associate via M:M relationship
            try {
                const assocRes = await dvPost(
                    `bots(${STATE.specialistBotId})/bot_botcomponent/$ref`,
                    { '@odata.id': `${CONFIG.dataverseUrl}/api/data/v9.2/botcomponents(${compId})` }
                );
                return { pass: true, details: `EvalSet created (${compId}) and associated via M:M` };
            } catch (assocErr) {
                return { pass: true, details: `EvalSet created (${compId}) but M:M association failed: ${assocErr.message}` };
            }
        }

        return {
            pass: false,
            details: `POST /botcomponents failed`,
            error: JSON.stringify(createRes.data).substring(0, 300)
        };
    }
}

async function step17_createEvalData() {
    // Create test cases as individual botcomponent records
    const testCases = [
        { query: 'Run a pipeline test', expectedResponse: 'Pipeline test successful', keywords: 'pipeline,test,successful' },
        { query: 'What is your purpose?', expectedResponse: 'I am an E2E test specialist agent', keywords: 'test,specialist,agent' },
    ];

    const results = [];
    for (const tc of testCases) {
        const content = JSON.stringify({
            testQuery: tc.query,
            expectedResponse: tc.expectedResponse,
            keywords: tc.keywords,
        });

        const res = await dvPost('botcomponents', {
            name: `E2E-TestCase-${tc.query.substring(0, 20).replace(/\s/g, '_')}`,
            componenttype: 19,
            content,
            schemaname: `${CONFIG.publisherPrefix}_e2etestcase_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            'parentbotid@odata.bind': `/bots(${STATE.specialistBotId})`
        });

        if (res.status === 201 || res.status === 200) {
            results.push(`PASS: ${tc.query.substring(0, 25)}`);
        } else {
            results.push(`FAIL: ${tc.query.substring(0, 25)} (HTTP ${res.status})`);
        }
    }

    const allPass = results.every(r => r.startsWith('PASS'));
    return { pass: allPass, details: results.join(' | ') };
}

async function step18_verifyEvalComponents() {
    // Query type 19 components for this bot
    const res = await dvGet(
        `botcomponents?$filter=_parentbotid_value eq '${STATE.specialistBotId}' and componenttype eq 19&$select=name,content,schemaname`
    );

    const comps = res.data.value || [];
    if (comps.length > 0) {
        const names = comps.map(c => c.name).join(', ');
        return { pass: true, details: `${comps.length} eval components found: ${names}` };
    }

    // If direct parent filter finds nothing, check unfiltered
    const allRes = await dvGet(
        `botcomponents?$filter=componenttype eq 19 and contains(name,'E2E')&$select=name,_parentbotid_value`
    );
    const allComps = allRes.data.value || [];
    if (allComps.length > 0) {
        return {
            pass: false,
            details: `${allComps.length} eval components exist but not linked to bot`,
            error: `Components found with names: ${allComps.map(c => c.name).join(', ')}`
        };
    }

    return { pass: false, details: 'No eval components found at all' };
}

// =============================================================================
// PHASE 7: Teardown
// =============================================================================

async function step19_deleteOrchestrator() {
    if (!STATE.orchestratorBotId) return { pass: true, details: 'No orchestrator to delete' };

    const res = await dvBoundAction(`bots(${STATE.orchestratorBotId})`, 'PvaDeleteBot');
    if (res.status >= 400) {
        // Try direct DELETE as fallback
        const delRes = await httpRequest(
            'DELETE',
            `${CONFIG.dataverseUrl}/api/data/v9.2/bots(${STATE.orchestratorBotId})`,
            dvHeaders()
        );
        if (delRes.status >= 400) {
            return { pass: false, details: `Delete failed: PvaDeleteBot HTTP ${res.status}, direct DELETE HTTP ${delRes.status}`, error: JSON.stringify(res.data).substring(0, 200) };
        }
    }

    return { pass: true, details: `Orchestrator ${STATE.orchestratorBotId} deleted` };
}

async function step20_deleteSpecialist() {
    if (!STATE.specialistBotId) return { pass: true, details: 'No specialist to delete' };

    const res = await dvBoundAction(`bots(${STATE.specialistBotId})`, 'PvaDeleteBot');
    if (res.status >= 400) {
        const delRes = await httpRequest(
            'DELETE',
            `${CONFIG.dataverseUrl}/api/data/v9.2/bots(${STATE.specialistBotId})`,
            dvHeaders()
        );
        if (delRes.status >= 400) {
            return { pass: false, details: `Delete failed: HTTP ${res.status} / ${delRes.status}`, error: JSON.stringify(res.data).substring(0, 200) };
        }
    }

    return { pass: true, details: `Specialist ${STATE.specialistBotId} deleted` };
}

async function step21_verifyDeletion() {
    await sleep(3000); // Give Dataverse a moment

    try {
        const output = execSync('pac copilot list 2>&1', { encoding: 'utf8' });
        const hasSpecialist = output.includes(CONFIG.specialistName);
        const hasOrchestrator = output.includes(CONFIG.orchestratorName);

        if (!hasSpecialist && !hasOrchestrator) {
            return { pass: true, details: 'Both agents confirmed deleted from pac copilot list' };
        }
        return { pass: false, details: `Specialist still present: ${hasSpecialist}, Orchestrator: ${hasOrchestrator}` };
    } catch (err) {
        return { pass: false, details: 'pac copilot list failed during verification', error: err.message.substring(0, 200) };
    }
}

async function step22_cleanupWorkspaces() {
    try {
        if (fs.existsSync(CONFIG.workspaceRoot)) {
            fs.rmSync(CONFIG.workspaceRoot, { recursive: true, force: true });
        }
        return { pass: true, details: `Cleaned up ${CONFIG.workspaceRoot}` };
    } catch (err) {
        return { pass: false, details: 'Cleanup failed', error: err.message };
    }
}

// =============================================================================
// Main Execution
// =============================================================================

const STEPS = [
    { num: 1,    name: 'Create specialist (POST + PvaProvision)', fn: step1_createSpecialist, phase: 'CREATION' },
    { num: 2,    name: 'Create orchestrator (POST + PvaProvision)', fn: step2_createOrchestrator, phase: 'CREATION' },
    { num: '2b', name: 'Verify both in pac copilot list', fn: step2b_verifyInPacList, phase: 'CREATION' },
    { num: 3,    name: 'Clone both workspaces (LSP)', fn: step3_cloneWorkspaces, phase: 'LSP CONFIG' },
    { num: 4,    name: 'Set instructions on specialist', fn: step4_setInstructions, phase: 'LSP CONFIG' },
    { num: 5,    name: 'Set model (GPT41)', fn: step5_setModel, phase: 'LSP CONFIG' },
    { num: 6,    name: 'Set suggested prompts', fn: step6_setSuggestedPrompts, phase: 'LSP CONFIG' },
    { num: 7,    name: 'Set web search OFF', fn: step7_setWebSearchOff, phase: 'LSP CONFIG' },
    { num: 8,    name: 'Add custom topic', fn: step8_addCustomTopic, phase: 'LSP CONFIG' },
    { num: 9,    name: 'Add knowledge source', fn: step9_addKnowledgeSource, phase: 'LSP CONFIG' },
    { num: 10,   name: 'Push specialist (LSP)', fn: step10_pushSpecialist, phase: 'LSP CONFIG' },
    { num: '10b',name: 'Verify push results (Dataverse read-back)', fn: step10b_verifyPushResults, phase: 'LSP CONFIG' },
    { num: 11,   name: 'Disable general knowledge (Dataverse)', fn: step11_disableGeneralKnowledge, phase: 'DATAVERSE' },
    { num: 12,   name: 'Set auth mode (Dataverse)', fn: step12_setAuthMode, phase: 'DATAVERSE' },
    { num: 13,   name: 'Enable agent connectable (Dataverse)', fn: step13_enableAgentConnectable, phase: 'DATAVERSE' },
    { num: 14,   name: 'Publish specialist (PvaPublish)', fn: step14_publishSpecialist, phase: 'PUBLISH' },
    { num: 15,   name: 'Connect specialist→orchestrator', fn: step15_connectSpecialistToOrchestrator, phase: 'CONNECTED' },
    { num: 16,   name: 'Create EvaluationSet (type 19)', fn: step16_createEvalSet, phase: 'EVAL' },
    { num: 17,   name: 'Create EvaluationData (type 19)', fn: step17_createEvalData, phase: 'EVAL' },
    { num: 18,   name: 'Verify eval components', fn: step18_verifyEvalComponents, phase: 'EVAL' },
    { num: 19,   name: 'Delete orchestrator (PvaDeleteBot)', fn: step19_deleteOrchestrator, phase: 'TEARDOWN' },
    { num: 20,   name: 'Delete specialist (PvaDeleteBot)', fn: step20_deleteSpecialist, phase: 'TEARDOWN' },
    { num: 21,   name: 'Verify deletion', fn: step21_verifyDeletion, phase: 'TEARDOWN' },
    { num: 22,   name: 'Clean up workspaces', fn: step22_cleanupWorkspaces, phase: 'TEARDOWN' },
];

async function main() {
    console.log('='.repeat(70));
    console.log('  E2E API Build Pipeline Test');
    console.log('='.repeat(70));
    console.log(`  Account:     ${CONFIG.accountEmail}`);
    console.log(`  Environment: dktest (${CONFIG.environmentId})`);
    console.log(`  Dataverse:   ${CONFIG.dataverseUrl}`);
    console.log(`  Gateway:     ${CONFIG.gatewayUrl}`);
    console.log(`  Publisher:   ${CONFIG.publisherPrefix}`);
    console.log(`  Specialist:  ${CONFIG.specialistSchema}`);
    console.log(`  Orchestrator: ${CONFIG.orchestratorSchema}`);
    if (ARGS.skipTeardown) console.log('  \x1b[33m⚠ Teardown skipped (--skip-teardown)\x1b[0m');
    if (ARGS.startFrom > 1) console.log(`  \x1b[33m⚠ Starting from step ${ARGS.startFrom}\x1b[0m`);
    console.log('='.repeat(70));

    // Initial token acquisition
    console.log('\nAcquiring tokens...');
    try {
        refreshTokens();
        console.log('  Dataverse token: OK');
        console.log('  Copilot Studio token: OK');
    } catch (err) {
        console.error(`\x1b[31mToken acquisition failed: ${err.message}\x1b[0m`);
        console.error('Ensure: az login --tenant d75a8725-8943-4f7f-9738-a96d3d3151de');
        process.exit(1);
    }

    // If resuming, try to recover state from existing agents
    if (ARGS.startFrom > 1) {
        console.log('\nRecovering state for resume...');
        const specRes = await dvGet(`bots?$filter=schemaname eq '${CONFIG.specialistSchema}'&$select=botid`);
        if (specRes.data.value && specRes.data.value.length > 0) {
            STATE.specialistBotId = specRes.data.value[0].botid;
            console.log(`  Specialist: ${STATE.specialistBotId}`);
        }
        const orchRes = await dvGet(`bots?$filter=schemaname eq '${CONFIG.orchestratorSchema}'&$select=botid`);
        if (orchRes.data.value && orchRes.data.value.length > 0) {
            STATE.orchestratorBotId = orchRes.data.value[0].botid;
            console.log(`  Orchestrator: ${STATE.orchestratorBotId}`);
        }
        // Check for existing workspace
        const specWs = path.join(CONFIG.workspaceRoot, CONFIG.specialistName);
        const orchWs = path.join(CONFIG.workspaceRoot, CONFIG.orchestratorName);
        if (fs.existsSync(specWs)) STATE.specialistWorkspace = specWs;
        if (fs.existsSync(orchWs)) STATE.orchestratorWorkspace = orchWs;
    }

    const startTime = Date.now();

    // Run steps
    for (const step of STEPS) {
        const stepNum = typeof step.num === 'number' ? step.num : parseFloat(step.num);

        // Skip steps before startFrom
        if (stepNum < ARGS.startFrom) {
            logStep(step.num, step.name, 'SKIP', 'Skipped (--start-from)');
            continue;
        }

        // Skip teardown if requested
        if (ARGS.skipTeardown && step.phase === 'TEARDOWN') {
            logStep(step.num, step.name, 'SKIP', 'Skipped (--skip-teardown)');
            continue;
        }

        // Skip connected agent and later if specialist or orchestrator doesn't exist
        if (step.phase === 'CONNECTED' && (!STATE.specialistBotId || !STATE.orchestratorBotId)) {
            logStep(step.num, step.name, 'SKIP', 'No bot IDs (earlier step failed)');
            continue;
        }

        try {
            // Refresh tokens every 5 steps (they expire after ~60 min)
            if (stepNum % 5 === 0) refreshTokens();

            const result = await step.fn();
            logStep(step.num, step.name, result.pass ? 'PASS' : 'FAIL', result.details, result.error);
        } catch (err) {
            logStep(step.num, step.name, 'FAIL', 'Unhandled exception', err.message.substring(0, 300));
        }
    }

    // Summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const passed = RESULTS.filter(r => r.status === 'PASS').length;
    const failed = RESULTS.filter(r => r.status === 'FAIL').length;
    const skipped = RESULTS.filter(r => r.status === 'SKIP').length;

    console.log('\n' + '='.repeat(70));
    console.log('  SUMMARY');
    console.log('='.repeat(70));
    console.log(`  Total: ${RESULTS.length}  |  \x1b[32mPassed: ${passed}\x1b[0m  |  \x1b[31mFailed: ${failed}\x1b[0m  |  \x1b[33mSkipped: ${skipped}\x1b[0m`);
    console.log(`  Time: ${elapsed}s`);
    console.log('');

    // Detailed table
    console.log('  Step  Phase        Name                                    Result');
    console.log('  ----  -----------  --------------------------------------  ------');
    for (const r of RESULTS) {
        const step = String(r.step).padEnd(4);
        const phase = (STEPS.find(s => String(s.num) === String(r.step))?.phase || '').padEnd(11);
        const name = r.name.substring(0, 38).padEnd(38);
        const icon = r.status === 'PASS' ? '\x1b[32mPASS\x1b[0m' :
                     r.status === 'FAIL' ? '\x1b[31mFAIL\x1b[0m' :
                     '\x1b[33mSKIP\x1b[0m';
        console.log(`  ${step}  ${phase}  ${name}  ${icon}`);
    }

    // Classification of failures
    const failures = RESULTS.filter(r => r.status === 'FAIL');
    if (failures.length > 0) {
        console.log('\n  FAILURE CLASSIFICATION:');
        for (const f of failures) {
            const classification =
                f.error?.includes('timeout') ? 'TIMING' :
                f.error?.includes('401') || f.error?.includes('403') ? 'AUTH' :
                f.error?.includes('404') ? 'API MISSING' :
                f.error?.includes('500') ? 'SERVER ERROR' :
                'NEEDS INVESTIGATION';
            console.log(`  Step ${f.step}: ${f.name} → ${classification}`);
            if (f.error) console.log(`    ${f.error.substring(0, 100)}`);
        }
    }

    console.log('\n' + '='.repeat(70));

    // Exit with failure code if any step failed
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error(`\n\x1b[31mFatal error: ${err.message}\x1b[0m`);
    if (err.stack) console.error(err.stack);
    process.exit(2);
});
