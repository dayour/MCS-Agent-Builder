/**
 * Integration tests for app/lib/flow-build-runner.js — orchestration with
 * mocked deps. Verifies happy path, idempotency, drift, failure isolation,
 * cross-ref resolution, dependency-order execution.
 *
 * Run: node --test app/lib/__tests__/flow-build-runner.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { runFlowsBuild, planFlow } = require("../flow-build-runner");
const composer = require("../../../tools/lib/flow-composer");

// --- Test deps factory: in-memory flowManager that records calls ---

function makeMockFlowManager() {
    const calls = [];
    let nextId = 1000;
    return {
        calls,
        async createFlow(orgUrl, token, params) {
            calls.push({ op: "createFlow", params });
            return { workflowid: `agent-flow-id-${nextId++}` };
        },
        async createAIFlow(orgUrl, token, params) {
            calls.push({ op: "createAIFlow", params });
            return { workflowid: `ai-flow-id-${nextId++}` };
        },
        async publishFlow(orgUrl, token, flowId, options) {
            calls.push({ op: "publishFlow", flowId, options });
            return undefined;
        },
        async saveFlow(orgUrl, token, flowId, clientdata, options) {
            calls.push({ op: "saveFlow", flowId, clientdata, options });
            return undefined;
        },
        async verifyPlan(envUrl, pvaToken, flowId) {
            calls.push({ op: "verifyPlan", envUrl, pvaToken, flowId });
            return {};
        },
        async derivePowerPlatformUrl() { return "https://test-env.environment.api.powerplatform.com"; },
        async deriveEnvironmentId() { return "test-env-guid"; },
        wrapAgentFlowClientdata(definition, opts = {}) {
            return { properties: { ...definition }, schemaVersion: "1.0.0.0", _opts: opts };
        },
        async getFlow() { throw new Error("getFlow not used by Phase 4 MVP"); },
    };
}

// Default deps for runFlowsBuild — all our tests need pvaToken + ppUrl now
// since AI flows require verifyPlan.
function defaultDeps(flowManager) {
    return {
        flowManager, composer,
        orgUrl: "x",
        token: "t",
        pvaToken: "pt",
        ppUrl: "https://test-env.environment.api.powerplatform.com",
    };
}

function aiToolFlowSpec(name = "work-iq-tool", overrides = {}) {
    return {
        name,
        displayName: "Work IQ",
        kind: "ai-tool",
        phase: "mvp",
        status: "draft",
        id: null,
        description: "MCP wrapper",
        implements: [],
        connectionRefs: { shared_a365copilotchatmcp: "ref_abc" },
        aiToolSpec: {
            plan: "",
            connectors: [{ apiName: "shared_a365copilotchatmcp", operationId: "mcp_m365copilot", displayName: "Work IQ" }],
            outputSchema: { type: "object", properties: { response: { type: "string" } } },
        },
        lastSyncedAt: null,
        lastBuildError: null,
        ...overrides,
    };
}

function agentFlowSpec(name = "research-agent-flow", overrides = {}) {
    return {
        name,
        displayName: "Research Flow",
        kind: "agent-flow",
        phase: "mvp",
        status: "draft",
        id: null,
        description: "Calls AI tool then agent",
        implements: [],
        connectionRefs: { shared_aisteps: "ref_a", shared_agentnode: "ref_b" },
        agentFlowSpec: {
            trigger: { type: "manual" },
            actions: [
                { type: "runAIFlow", name: "Tool_Call", aiFlowRef: "work-iq-tool" },
                { type: "runAnAgent", name: "Run_Agent", agentLogicalName: "new_bot_abc", prompt: "@{outputs('Tool_Call')}" },
            ],
        },
        lastSyncedAt: null,
        lastBuildError: null,
        ...overrides,
    };
}

// --- Happy path ---

test("runFlowsBuild: happy path — ai-tool then agent-flow, both created and published", async () => {
    const flowManager = makeMockFlowManager();
    const spec = { flows: [agentFlowSpec(), aiToolFlowSpec()] };  // intentionally out of order
    const { results, modifiedSpec } = await runFlowsBuild(spec, {
        flowManager, composer, orgUrl: "https://x", token: "t", pvaToken: "pt", ppUrl: "https://test-env.environment.api.powerplatform.com",
    });

    // Topo order: ai-tool first
    assert.equal(results[0].name, "work-iq-tool");
    assert.equal(results[1].name, "research-agent-flow");
    assert.equal(results[0].status, "published");
    assert.equal(results[1].status, "published");

    // ai-flow: create → verifyPlan → publish; then agent-flow: create → publish
    const opOrder = flowManager.calls.map((c) => c.op);
    assert.deepEqual(opOrder, ["createAIFlow", "verifyPlan", "publishFlow", "createFlow", "publishFlow"]);

    // Agent flow's runAIFlow action should have aiFlowId resolved to the ai-tool's id
    const createFlowCall = flowManager.calls.find((c) => c.op === "createFlow");
    const composed = createFlowCall.params.definition;
    const toolAction = composed.definition.actions.Tool_Call;
    assert.equal(toolAction.inputs.parameters.flowId, "ai-flow-id-1000",
        "aiFlowRef was resolved to the ai-tool's workflowid");

    // Spec was updated with ids and status
    assert.equal(modifiedSpec.flows.find(f => f.name === "work-iq-tool").id, "ai-flow-id-1000");
    assert.equal(modifiedSpec.flows.find(f => f.name === "research-agent-flow").id, "agent-flow-id-1001");
    assert.equal(modifiedSpec.flows.find(f => f.name === "work-iq-tool").status, "published");
    assert.ok(modifiedSpec.flows.find(f => f.name === "work-iq-tool").lastSyncedAt);
});

test("runFlowsBuild: input spec is not mutated (deep clone)", async () => {
    const spec = { flows: [aiToolFlowSpec()] };
    const before = JSON.stringify(spec);
    const fm = makeMockFlowManager();
    await runFlowsBuild(spec, { flowManager: fm, composer, orgUrl: "x", token: "t", pvaToken: "pt", ppUrl: "https://test-env.environment.api.powerplatform.com" });
    assert.equal(JSON.stringify(spec), before, "input spec untouched");
});

// --- Idempotency ---

test("runFlowsBuild: skips already-published flows when hash matches (no Dataverse calls)", async () => {
    const fm = makeMockFlowManager();
    const { computeFlowSpecHash } = require("../flow-spec");
    const flow = aiToolFlowSpec("tool-a", { id: "existing-ai-id", status: "published" });
    flow.lastSyncedSpecHash = computeFlowSpecHash(flow); // pretend a previous build stamped this
    const spec = { flows: [flow] };
    const { results } = await runFlowsBuild(spec, { flowManager: fm, composer, orgUrl: "x", token: "t", pvaToken: "pt", ppUrl: "https://test-env.environment.api.powerplatform.com" });
    assert.equal(fm.calls.length, 0, "no API calls when no drift");
    assert.equal(results[0].status, "published");
});

test("runFlowsBuild: drift detected — re-saves and re-publishes when spec changed", async () => {
    const fm = makeMockFlowManager();
    const { computeFlowSpecHash } = require("../flow-spec");
    const original = aiToolFlowSpec("tool-a", { id: "existing-id", status: "published" });
    original.lastSyncedSpecHash = computeFlowSpecHash(original);
    // Now mutate the spec — change the connector
    original.aiToolSpec.connectors[0].displayName = "Renamed Connector";
    // hash no longer matches → should trigger save+publish
    const { results, modifiedSpec } = await runFlowsBuild({ flows: [original] }, {
        flowManager: fm, composer, orgUrl: "x", token: "t", pvaToken: "pt", ppUrl: "https://test-env.environment.api.powerplatform.com",
    });
    const ops = fm.calls.map((c) => c.op);
    assert.deepEqual(ops, ["saveFlow", "verifyPlan", "publishFlow"], "drift triggered save, verifyPlan, then publish");
    assert.equal(fm.calls[0].flowId, "existing-id", "saveFlow targeted the existing id");
    assert.equal(modifiedSpec.flows[0].lastSyncedSpecHash, computeFlowSpecHash(modifiedSpec.flows[0]),
        "lastSyncedSpecHash re-stamped after sync");
    assert.equal(results[0].status, "published");
});

test("runFlowsBuild: legacy spec without lastSyncedSpecHash is re-synced once (data integrity)", async () => {
    const fm = makeMockFlowManager();
    // Existing published flow but never had its hash stamped (pre-Phase-5 data)
    const flow = aiToolFlowSpec("tool-a", { id: "legacy-id", status: "published" });
    delete flow.lastSyncedSpecHash;
    const { results, modifiedSpec } = await runFlowsBuild({ flows: [flow] }, {
        flowManager: fm, composer, orgUrl: "x", token: "t", pvaToken: "pt", ppUrl: "https://test-env.environment.api.powerplatform.com",
    });
    // Should re-save (idempotent), verify plan (AI flow), then re-publish to establish hash baseline
    const ops = fm.calls.map((c) => c.op);
    assert.deepEqual(ops, ["saveFlow", "verifyPlan", "publishFlow"]);
    assert.ok(modifiedSpec.flows[0].lastSyncedSpecHash, "hash now stamped");
});

test("runFlowsBuild: re-saves and re-publishes flows with id but status≠published", async () => {
    const fm = makeMockFlowManager();
    const spec = {
        flows: [
            aiToolFlowSpec("tool-a", { id: "existing-id", status: "created" }),
        ],
    };
    await runFlowsBuild(spec, { flowManager: fm, composer, orgUrl: "x", token: "t", pvaToken: "pt", ppUrl: "https://test-env.environment.api.powerplatform.com" });
    // Should save (idempotent re-write of clientdata), verify plan (AI flow), then publish
    const ops = fm.calls.map((c) => c.op);
    assert.deepEqual(ops, ["saveFlow", "verifyPlan", "publishFlow"]);
    assert.equal(fm.calls[0].flowId, "existing-id");
});

// --- Failure isolation ---

test("runFlowsBuild: one flow's failure does not block other independent flows", async () => {
    const fm = {
        calls: [],
        createAIFlow: async function(orgUrl, token, params) {
            this.calls.push({ op: "createAIFlow", params });
            if (params.name === "Bad") throw new Error("simulated server 500");
            return { workflowid: "ok-id" };
        },
        publishFlow: async function(orgUrl, token, flowId) {
            this.calls.push({ op: "publishFlow", flowId });
        },
        createFlow: async function(orgUrl, token, params) {
            this.calls.push({ op: "createFlow", params });
            return { workflowid: "agent-id" };
        },
        verifyPlan: async function() { this.calls.push({ op: "verifyPlan" }); },
    };
    const spec = {
        flows: [
            aiToolFlowSpec("bad-tool", { displayName: "Bad" }),
            aiToolFlowSpec("good-tool", { displayName: "Good" }),
        ],
    };
    const { results, modifiedSpec } = await runFlowsBuild(spec, {
        flowManager: fm, composer, orgUrl: "x", token: "t", pvaToken: "pt", ppUrl: "https://test-env.environment.api.powerplatform.com",
    });
    const failed = results.find((r) => r.name === "bad-tool");
    const ok = results.find((r) => r.name === "good-tool");
    assert.equal(failed.status, "failed");
    assert.match(failed.error, /server 500/);
    assert.equal(ok.status, "published");
    // Spec records the error on the failing flow
    const badInSpec = modifiedSpec.flows.find((f) => f.name === "bad-tool");
    assert.equal(badInSpec.status, "failed");
    assert.match(badInSpec.lastBuildError, /server 500/);
});

// --- Cross-ref resolution failure ---

test("runFlowsBuild: agent-flow with dangling aiFlowRef fails validation", async () => {
    const fm = makeMockFlowManager();
    const spec = {
        flows: [
            agentFlowSpec(), // refs work-iq-tool but it's not in flows[]
        ],
    };
    const { results } = await runFlowsBuild(spec, { flowManager: fm, composer, orgUrl: "x", token: "t", pvaToken: "pt", ppUrl: "https://test-env.environment.api.powerplatform.com" });
    assert.equal(results[0].name, "_validation");
    assert.equal(results[0].status, "failed");
    assert.match(results[0].error, /aiFlowRef='work-iq-tool' does not match/);
    assert.equal(fm.calls.length, 0, "no API calls when validation fails");
});

test("runFlowsBuild: aiFlowRef points to ai-tool that itself failed → caught at runtime", async () => {
    // The ai-tool fails to create → no id → agent-flow can't resolve ref
    const fm = {
        calls: [],
        createAIFlow: async function() {
            this.calls.push({ op: "createAIFlow" });
            throw new Error("boom");
        },
        createFlow: async function() {
            this.calls.push({ op: "createFlow" });
            return { workflowid: "agent-id" };
        },
        publishFlow: async function() { this.calls.push({ op: "publishFlow" }); },
    };
    const spec = { flows: [aiToolFlowSpec(), agentFlowSpec()] };
    const { results } = await runFlowsBuild(spec, { flowManager: fm, composer, orgUrl: "x", token: "t", pvaToken: "pt", ppUrl: "https://test-env.environment.api.powerplatform.com" });
    const tool = results.find((r) => r.name === "work-iq-tool");
    const agent = results.find((r) => r.name === "research-agent-flow");
    assert.equal(tool.status, "failed");
    assert.equal(agent.status, "failed");
    assert.match(agent.error, /aiFlowRef.*has no id/);
});

// --- only filter ---

test("runFlowsBuild: --only filter executes one flow, marks others skipped", async () => {
    const fm = makeMockFlowManager();
    const spec = { flows: [aiToolFlowSpec("tool-a"), aiToolFlowSpec("tool-b")] };
    const { results } = await runFlowsBuild(spec, {
        flowManager: fm, composer, orgUrl: "x", token: "t", pvaToken: "pt", ppUrl: "https://test-env.environment.api.powerplatform.com", only: "tool-b",
    });
    const a = results.find((r) => r.name === "tool-a");
    const b = results.find((r) => r.name === "tool-b");
    assert.equal(a.skipped, "filter");
    assert.equal(b.status, "published");
    assert.equal(fm.calls.length, 3, "only tool-b made API calls (create + verifyPlan + publish for AI flow)");
});

// --- dryRun ---

test("runFlowsBuild: --dry-run produces a plan with no API calls", async () => {
    const fm = makeMockFlowManager();
    const spec = { flows: [aiToolFlowSpec(), agentFlowSpec()] };
    const { results } = await runFlowsBuild(spec, {
        flowManager: fm, composer, orgUrl: "x", token: "t", pvaToken: "pt", ppUrl: "https://test-env.environment.api.powerplatform.com", dryRun: true,
    });
    assert.equal(fm.calls.length, 0, "no API calls in dry-run");
    assert.equal(results[0].status, "planned");
    assert.equal(results[0].plan.action, "create+publish");
    assert.equal(results[1].plan.action, "blocked",
        "agent-flow blocked because the ai-tool wasn't actually built");
});

// --- planFlow standalone ---

test("planFlow: action varies by id+status+hash combination", () => {
    const flows = new Map();
    const { computeFlowSpecHash } = require("../flow-spec");

    // No id → create+publish
    assert.equal(planFlow({ kind: "ai-tool", aiToolSpec: { connectors: [] } }, flows).action, "create+publish");

    // id present, status=created → save+publish (drift path covers status≠published)
    assert.equal(planFlow({ id: "x", status: "created", kind: "ai-tool" }, flows).action, "save+publish");

    // id+published+matching hash → skip
    const skipFlow = { id: "x", status: "published", kind: "ai-tool", aiToolSpec: { connectors: [] } };
    skipFlow.lastSyncedSpecHash = computeFlowSpecHash(skipFlow);
    assert.equal(planFlow(skipFlow, flows).action, "skip");

    // id+published+stale hash → save+publish (drift)
    const driftFlow = { ...skipFlow, lastSyncedSpecHash: "old-stale-hash" };
    assert.equal(planFlow(driftFlow, flows).action, "save+publish");
});

// --- Empty / missing flows[] ---

test("runFlowsBuild: missing flows[] is a no-op (success, empty results)", async () => {
    const fm = makeMockFlowManager();
    const { results } = await runFlowsBuild({}, { flowManager: fm, composer, orgUrl: "x", token: "t", pvaToken: "pt", ppUrl: "https://test-env.environment.api.powerplatform.com" });
    assert.deepEqual(results, []);
});

// --- generatedActions (Phase 6.1: InvokeFlowTaskAction auto-registration) ---

test("runFlowsBuild: agent-flow with manual trigger produces action YAML in generatedActions[]", async () => {
    const fm = makeMockFlowManager();
    const spec = { flows: [aiToolFlowSpec(), agentFlowSpec()] };
    const { generatedActions } = await runFlowsBuild(spec, {
        flowManager: fm, composer, orgUrl: "x", token: "t", pvaToken: "pt", ppUrl: "https://test-env.environment.api.powerplatform.com",
    });
    // ai-tool produces nothing; agent-flow with manual trigger produces one
    assert.equal(generatedActions.length, 1);
    assert.equal(generatedActions[0].flowName, "research-agent-flow");
    assert.match(generatedActions[0].content, /kind: TaskDialog/);
    assert.match(generatedActions[0].content, /kind: InvokeFlowTaskAction/);
});

test("runFlowsBuild: skipped (no-drift) flows do NOT regenerate action YAML", async () => {
    const fm = makeMockFlowManager();
    const { computeFlowSpecHash } = require("../flow-spec");
    const flow = agentFlowSpec("a", { id: "x", status: "published" });
    flow.lastSyncedSpecHash = computeFlowSpecHash(flow);
    const aiTool = aiToolFlowSpec("work-iq-tool", { id: "y", status: "published" });
    aiTool.lastSyncedSpecHash = computeFlowSpecHash(aiTool);
    const { generatedActions } = await runFlowsBuild({ flows: [aiTool, flow] }, {
        flowManager: fm, composer, orgUrl: "x", token: "t", pvaToken: "pt", ppUrl: "https://test-env.environment.api.powerplatform.com",
    });
    // Both skipped → 0 generated YAMLs (no need to write something already in place)
    assert.equal(generatedActions.length, 0,
        "skip path doesn't regenerate YAML — let the existing file stay as-is");
});

test("runFlowsBuild: empty flows[] is a no-op", async () => {
    const fm = makeMockFlowManager();
    const { results } = await runFlowsBuild({ flows: [] }, { flowManager: fm, composer, orgUrl: "x", token: "t", pvaToken: "pt", ppUrl: "https://test-env.environment.api.powerplatform.com" });
    assert.deepEqual(results, []);
});
