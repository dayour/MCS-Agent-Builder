/**
 * Phase 5 tests:
 *   - saveFlow PATCH shape (+ AsUnpublished header)
 *   - computeFlowSpecHash determinism and sensitivity
 *   - unpackToFlowsEntry round-trip from HAR-shaped record
 *   - cmdVerify verdict logic
 *
 * Run: node --test app/lib/__tests__/flow-phase5.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const HTTP_MODULE = path.join(REPO_ROOT, "tools", "lib", "http.js");
const FM_MODULE = path.join(REPO_ROOT, "tools", "flow-manager.js");

const { computeFlowSpecHash } = require("../flow-spec");
const { unpackToFlowsEntry, extractTriggerFromWdl, extractActionsFromWdl } = require("../../../tools/flow-build");

// --- saveFlow ---

function loadFmRecorder() {
    delete require.cache[FM_MODULE];
    delete require.cache[HTTP_MODULE];
    const calls = [];
    require.cache[HTTP_MODULE] = {
        id: HTTP_MODULE, filename: HTTP_MODULE, loaded: true,
        exports: {
            httpRequest: async () => ({ status: 200, data: {} }),
            httpRequestWithRetry: async (method, url, headers, body) => {
                calls.push({ method, url, headers, body });
                return { status: 204, data: {} };
            },
            getToken: async () => "tok",
        },
    };
    return { fm: require(FM_MODULE), calls };
}

test("saveFlow: PATCH /workflows({id}) with AsUnpublished + If-Match", async () => {
    const { fm, calls } = loadFmRecorder();
    await fm.saveFlow("https://o.crm.dynamics.com", "tok", "abc-id",
        { properties: { x: 1 }, schemaVersion: "1.0.0.0" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "PATCH");
    assert.match(calls[0].url, /workflows\(abc-id\)$/);
    assert.equal(calls[0].headers["mscrm.AsUnpublished"], "true");
    assert.equal(calls[0].headers["If-Match"], "*");
    // Body has stringified clientdata
    assert.equal(typeof calls[0].body.clientdata, "string");
    assert.deepEqual(JSON.parse(calls[0].body.clientdata), { properties: { x: 1 }, schemaVersion: "1.0.0.0" });
});

test("saveFlow: optional outputs/name/description fields are sent when provided", async () => {
    const { fm, calls } = loadFmRecorder();
    await fm.saveFlow("https://o.crm.dynamics.com", "tok", "abc",
        { properties: {} },
        { outputs: { schema: { type: "object" } }, name: "X", description: "d" });
    const body = calls[0].body;
    assert.equal(body.name, "X");
    assert.equal(body.description, "d");
    assert.equal(typeof body.outputs, "string", "outputs stringified");
    assert.deepEqual(JSON.parse(body.outputs), { schema: { type: "object" } });
});

test("wrapAgentFlowClientdata: handles three input shapes deterministically", () => {
    const { fm } = loadFmRecorder();
    // Raw WDL
    const w1 = fm.wrapAgentFlowClientdata({
        $schema: "x", contentVersion: "1.0.0.0", triggers: { manual: {} }, actions: {},
    }, { envGuid: "env-x", displayName: "D" });
    assert.ok(w1.properties.definition.triggers, "raw WDL nested under properties.definition");
    assert.equal(w1.properties.environment.name, "env-x");
    assert.equal(w1.properties.displayName, "D");
    // Composer output
    const w2 = fm.wrapAgentFlowClientdata({
        connectionReferences: { x: 1 },
        definition: { $schema: "x" },
        templateName: "",
    }, { envGuid: "env-x" });
    assert.deepEqual(w2.properties.connectionReferences, { x: 1 });
    // Full envelope (idempotent — unwrap once)
    const w3 = fm.wrapAgentFlowClientdata({
        properties: { connectionReferences: {}, definition: { $schema: "x" } },
        schemaVersion: "1.0.0.0",
    }, { envGuid: "env-x" });
    assert.equal(w3.properties.environment.name, "env-x");
    assert.ok(w3.properties.definition);
});

// --- computeFlowSpecHash ---

test("computeFlowSpecHash: deterministic across key-ordering", () => {
    const flow1 = { name: "x", kind: "ai-tool", aiToolSpec: { plan: "", connectors: [{ apiName: "a", operationId: "o" }] }, connectionRefs: {} };
    const flow2 = { aiToolSpec: { connectors: [{ operationId: "o", apiName: "a" }], plan: "" }, connectionRefs: {}, name: "x", kind: "ai-tool" };
    assert.equal(computeFlowSpecHash(flow1), computeFlowSpecHash(flow2),
        "same content, different key order → same hash");
});

test("computeFlowSpecHash: ignores build state (id, status, lastSyncedAt, etc.)", () => {
    const base = { name: "x", kind: "ai-tool", aiToolSpec: { plan: "", connectors: [] } };
    const h1 = computeFlowSpecHash(base);
    const h2 = computeFlowSpecHash({ ...base, id: "abc", status: "published", lastSyncedAt: "2026-04-29", lastBuildError: null });
    assert.equal(h1, h2, "build state is excluded from hash");
});

test("computeFlowSpecHash: changes when content changes", () => {
    const base = { name: "x", kind: "ai-tool", aiToolSpec: { plan: "p1", connectors: [] } };
    const h1 = computeFlowSpecHash(base);
    const h2 = computeFlowSpecHash({ ...base, aiToolSpec: { plan: "p2", connectors: [] } });
    assert.notEqual(h1, h2);
    // displayName / description matter
    const h3 = computeFlowSpecHash({ ...base, displayName: "Y" });
    assert.notEqual(h1, h3);
});

// --- unpackToFlowsEntry ---

test("unpackToFlowsEntry: agent-flow record (HAR shape) → flows[] entry", () => {
    // Simulated HAR har-open-flow.json: agent flow with shared_aisteps + shared_agentnode
    const record = {
        workflowid: "aba6a880-8b43-f111-bec6-7ced8d706c4b",
        name: "Untitled",
        category: 5,
        modernflowtype: 1,
        primaryentity: "none",
        type: 1,
        componentstate: 0,
        statecode: 1,
        statuscode: 2,
        ismanaged: false,
        description: null,
    };
    const definition = {
        properties: {
            connectionReferences: {
                shared_aisteps: { api: { name: "shared_aisteps" }, connection: { connectionReferenceLogicalName: "new_sharedaisteps_1756a" }, runtimeSource: "invoker" },
                shared_agentnode: { api: { name: "shared_agentnode" }, connection: { connectionReferenceLogicalName: "new_sharedagentnode_b11dc" }, runtimeSource: "invoker" },
            },
            definition: {
                triggers: { manual: { type: "Request", kind: "Button", inputs: { schema: { type: "object" } } } },
                actions: {
                    "Work_IQ_Copilot_(Preview)": {
                        type: "OpenApiConnection",
                        inputs: { parameters: { flowId: "4fca294c-..." }, host: { connectionName: "shared_aisteps", operationId: "RunAIFlow" } },
                    },
                    "Run_an_agent": {
                        type: "OpenApiConnection",
                        inputs: { parameters: { "body/agentId": "new_bot_8abe...", "body/prompt": "test" }, host: { connectionName: "shared_agentnode", operationId: "InvokeAgent" } },
                    },
                },
            },
        },
    };
    const entry = unpackToFlowsEntry(record, definition);
    assert.equal(entry.kind, "agent-flow");
    assert.equal(entry.id, record.workflowid);
    assert.equal(entry.status, "published");  // componentstate=0
    assert.equal(entry.agentFlowSpec.trigger.type, "manual");
    const acts = entry.agentFlowSpec.actions;
    assert.equal(acts.length, 2);
    assert.equal(acts[0].type, "runAIFlow");
    assert.equal(acts[0].aiFlowId, "4fca294c-...");
    assert.equal(acts[1].type, "runAnAgent");
    assert.equal(acts[1].agentLogicalName, "new_bot_8abe...");
    assert.equal(acts[1].prompt, "test");
});

test("unpackToFlowsEntry: ai-tool record (category=7) → flows[] entry with aiToolSpec", () => {
    const record = {
        workflowid: "ai-flow-id",
        name: "Work IQ Copilot (Preview)",
        category: 7,
        primaryentity: "workflow",
        type: 1,
        componentstate: 0,
        statecode: 1,
        outputs: JSON.stringify({ schema: { type: "object", properties: { response: { type: "string" } } } }),
    };
    const definition = {
        definition: {
            plan: "",
            actions: {
                connectors: [{
                    api: { name: "shared_a365copilotchatmcp" },
                    operationsList: [{ operationId: "mcp_m365copilot", displayName: "Work IQ Copilot (Preview)", "x-ms-isSuggested": false }],
                    connectionReference: "shared_a365copilotchatmcp",
                }],
            },
        },
        connectionReferences: {
            shared_a365copilotchatmcp: { runtimeSource: "embedded", connection: { connectionReferenceLogicalName: "auto_x" }, api: { name: "shared_a365copilotchatmcp" } },
        },
    };
    const entry = unpackToFlowsEntry(record, definition);
    assert.equal(entry.kind, "ai-tool");
    assert.equal(entry.id, "ai-flow-id");
    const c = entry.aiToolSpec.connectors[0];
    assert.equal(c.apiName, "shared_a365copilotchatmcp");
    assert.equal(c.operationId, "mcp_m365copilot");
    assert.equal(c.connectionReference, "shared_a365copilotchatmcp");
    assert.deepEqual(entry.aiToolSpec.outputSchema, { type: "object", properties: { response: { type: "string" } } });
    assert.ok(entry.connectionRefs.shared_a365copilotchatmcp);
});

test("unpackToFlowsEntry: unpublished flow gets status='draft'", () => {
    const record = { workflowid: "x", name: "X", category: 5, componentstate: 1, statecode: 0 };
    const entry = unpackToFlowsEntry(record, { properties: { definition: { triggers: {}, actions: {} } } });
    assert.equal(entry.status, "draft");
});

// --- extractTriggerFromWdl ---

test("extractTriggerFromWdl: handles all trigger kinds we emit", () => {
    assert.equal(extractTriggerFromWdl({ triggers: { Recurrence: { type: "Recurrence", recurrence: { frequency: "Day" } } } }).type, "recurrence");
    assert.equal(extractTriggerFromWdl({ triggers: { manual: { type: "Request", kind: "Button" } } }).type, "manual");
    assert.equal(extractTriggerFromWdl({ triggers: { manual: { type: "Request", kind: "Skills" } } }).type, "skills");
    assert.equal(extractTriggerFromWdl({ triggers: { manual: { type: "Request", kind: "Http" } } }).type, "http");
    assert.equal(extractTriggerFromWdl({ triggers: {} }).type, "unknown");
});
