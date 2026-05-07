/**
 * Shape-parity tests for the modern (agent-flow / AI-flow) builders in
 * tools/lib/flow-composer.js and the createAIFlow path in tools/flow-manager.js.
 *
 * Ground truth: HAR captures of the live MCS portal (tmp/har-*.json).
 *
 * Run: node --test app/lib/__tests__/flow-composer-modern.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const HTTP_MODULE = path.join(REPO_ROOT, "tools", "lib", "http.js");
const FM_MODULE = path.join(REPO_ROOT, "tools", "flow-manager.js");
const COMPOSER = require(path.join(REPO_ROOT, "tools", "lib", "flow-composer.js"));

// ---------------------------------------------------------------------------
// buildRunAnAgentAction
// ---------------------------------------------------------------------------

test("buildRunAnAgentAction matches HAR shape (har-create-agent-flow.json)", () => {
  const action = COMPOSER.buildRunAnAgentAction(
    "Run_an_agent",
    "new_bot_8abe32366828f11188b400224805f27c",
    "test"
  );
  const inner = action.Run_an_agent;
  assert.equal(inner.type, "OpenApiConnection");
  assert.equal(inner.inputs.host.apiId, "/providers/Microsoft.PowerApps/apis/shared_agentnode");
  assert.equal(inner.inputs.host.operationId, "InvokeAgent");
  assert.equal(inner.inputs.host.connectionName, "shared_agentnode");
  assert.equal(inner.inputs.parameters["body/agentId"], "new_bot_8abe32366828f11188b400224805f27c");
  assert.equal(inner.inputs.parameters["body/prompt"], "test");
  assert.equal(inner.inputs.parameters["body/isHitlEscalationEnabled"], true);
  assert.deepEqual(inner.inputs.parameters["body/outputSchema"], {
    type: "object",
    properties: {},
    additionalProperties: false,
  });
  // HAR shape: no authentication parameter, no operationMetadataId
  assert.equal(inner.inputs.authentication, undefined);
  assert.equal(inner.metadata, undefined);
  assert.deepEqual(inner.runAfter, {});
});

test("buildRunAnAgentAction respects custom outputSchema and runAfter", () => {
  const customSchema = { type: "object", properties: { result: { type: "string" } }, required: ["result"] };
  const action = COMPOSER.buildRunAnAgentAction("X", "new_bot_abc", "p", {
    outputSchema: customSchema,
    isHitlEscalationEnabled: false,
    runAfter: { Prev_Action: ["SUCCEEDED"] },
    extraParams: { "body/extra": "value" },
  });
  assert.deepEqual(action.X.inputs.parameters["body/outputSchema"], customSchema);
  assert.equal(action.X.inputs.parameters["body/isHitlEscalationEnabled"], false);
  assert.equal(action.X.inputs.parameters["body/extra"], "value");
  assert.deepEqual(action.X.runAfter, { Prev_Action: ["SUCCEEDED"] });
});

// ---------------------------------------------------------------------------
// buildRunAIFlowAction
// ---------------------------------------------------------------------------

test("buildRunAIFlowAction without metadata override (plain RunAIFlow)", () => {
  const aiFlowId = "4fca294c-8b43-f111-bec6-7ced8d706c4b";
  const action = COMPOSER.buildRunAIFlowAction("My_Tool", aiFlowId);
  const inner = action.My_Tool;
  assert.equal(inner.type, "OpenApiConnection");
  assert.equal(inner.inputs.host.apiId, "/providers/Microsoft.PowerApps/apis/shared_aisteps");
  assert.equal(inner.inputs.host.operationId, "RunAIFlow");
  assert.equal(inner.inputs.host.connectionName, "shared_aisteps");
  assert.equal(inner.inputs.parameters.flowId, aiFlowId);
  assert.equal(inner.metadata, undefined);
});

test("buildRunAIFlowAction with metadataOverride matches HAR (MCP wrapper)", () => {
  // From har-create-agent-flow.json — MCP-tool wrap
  const action = COMPOSER.buildRunAIFlowAction("Work_IQ_Copilot_(Preview)", "4fca294c-8b43-f111-bec6-7ced8d706c4b", {
    metadataOverride: {
      connectorId: "/providers/Microsoft.PowerApps/apis/shared_a365copilotchatmcp",
      operationId: "mcp_m365copilot",
      type: "OpenApiConnection",
      tags: ["Action", "Premium", "WorkIQTool", "Agentic", "Api"],
    },
  });
  const inner = action["Work_IQ_Copilot_(Preview)"];
  assert.deepEqual(inner.metadata.operationInfoForMetadataOverride, {
    connectorId: "/providers/Microsoft.PowerApps/apis/shared_a365copilotchatmcp",
    operationId: "mcp_m365copilot",
    type: "OpenApiConnection",
    tags: ["Action", "Premium", "WorkIQTool", "Agentic", "Api"],
  });
});

// ---------------------------------------------------------------------------
// buildAgentFlowConnectionRefs
// ---------------------------------------------------------------------------

test("buildAgentFlowConnectionRefs uses runtimeSource: 'invoker'", () => {
  const refs = COMPOSER.buildAgentFlowConnectionRefs({
    aisteps: "new_sharedaisteps_1756a",
    agentnode: "new_sharedagentnode_b11dc",
  });
  assert.equal(refs.shared_aisteps.runtimeSource, "invoker");
  assert.equal(refs.shared_agentnode.runtimeSource, "invoker");
  assert.equal(refs.shared_aisteps.connection.connectionReferenceLogicalName, "new_sharedaisteps_1756a");
  assert.equal(refs.shared_agentnode.connection.connectionReferenceLogicalName, "new_sharedagentnode_b11dc");
  assert.equal(refs.shared_aisteps.api.name, "shared_aisteps");
});

test("buildAgentFlowConnectionRefs returns only the keys provided", () => {
  const refs = COMPOSER.buildAgentFlowConnectionRefs({ aisteps: "x" });
  assert.ok(refs.shared_aisteps);
  assert.equal(refs.shared_agentnode, undefined);
});

test("buildConnectionRef respects optional runtimeSource", () => {
  const r1 = COMPOSER.buildConnectionRef("shared_x", "abc");
  assert.equal(r1.shared_x.runtimeSource, "embedded", "default unchanged");
  const r2 = COMPOSER.buildConnectionRef("shared_x", "abc", "invoker");
  assert.equal(r2.shared_x.runtimeSource, "invoker");
});

// ---------------------------------------------------------------------------
// composeAIFlow
// ---------------------------------------------------------------------------

test("composeAIFlow matches HAR (har-create-ai-flow.json)", () => {
  const out = COMPOSER.composeAIFlow({
    connectors: [{
      apiName: "shared_a365copilotchatmcp",
      operationId: "mcp_m365copilot",
      displayName: "Work IQ Copilot (Preview)",
    }],
  });
  // HAR har-create-ai-flow.json shape:
  //   { definition: { plan: "", actions: { connectors: [{ api, operationsList }] } } }
  assert.equal(out.definition.plan, "");
  assert.equal(out.definition.actions.connectors.length, 1);
  const conn = out.definition.actions.connectors[0];
  assert.equal(conn.api.name, "shared_a365copilotchatmcp");
  assert.equal(conn.operationsList[0].operationId, "mcp_m365copilot");
  assert.equal(conn.operationsList[0].displayName, "Work IQ Copilot (Preview)");
  // No connectionReferences key when none provided
  assert.equal(out.connectionReferences, undefined);
});

test("composeAIFlow with connectionReferences and isSuggested + plan (save-flow shape)", () => {
  const out = COMPOSER.composeAIFlow({
    plan: "test",
    connectors: [{
      apiName: "shared_a365copilotchatmcp",
      operationId: "mcp_m365copilot",
      displayName: "Work IQ Copilot (Preview)",
      isSuggested: false,
      connectionReference: "shared_a365copilotchatmcp",
    }],
    connectionReferences: {
      shared_a365copilotchatmcp: {
        runtimeSource: "embedded",
        connection: { connectionReferenceLogicalName: "auto_agent_FGDnE.shared_a365copilotchatmcp.shared-a365copilotch-XXX" },
        api: { name: "shared_a365copilotchatmcp" },
      },
    },
  });
  assert.equal(out.definition.plan, "test");
  assert.equal(out.definition.actions.connectors[0].connectionReference, "shared_a365copilotchatmcp");
  assert.equal(out.definition.actions.connectors[0].operationsList[0]["x-ms-isSuggested"], false);
  assert.ok(out.connectionReferences.shared_a365copilotchatmcp);
});

// ---------------------------------------------------------------------------
// composeFlow with new spec types (runAnAgent, runAIFlow)
// ---------------------------------------------------------------------------

test("composeFlow handles runAnAgent and runAIFlow action specs (chained)", () => {
  const composed = COMPOSER.composeFlow({
    trigger: { type: "http", method: "POST", schema: { type: "object", properties: {} } },
    actions: [
      {
        type: "runAIFlow",
        name: "Tool_Call",
        aiFlowId: "ai-flow-guid-here",
        metadataOverride: {
          connectorId: "/providers/Microsoft.PowerApps/apis/shared_x",
          operationId: "op_x",
          type: "OpenApiConnection",
          tags: ["Action"],
        },
      },
      {
        type: "runAnAgent",
        name: "Run_an_agent",
        agentLogicalName: "new_bot_abc",
        prompt: "@{outputs('Tool_Call')}",
      },
    ],
  });
  // composer output: { connectionReferences, definition: <WDL>, templateName }
  const actions = composed.definition.actions;
  assert.ok(actions.Tool_Call, "first action present");
  assert.ok(actions.Run_an_agent, "second action present");
  assert.equal(actions.Tool_Call.inputs.host.operationId, "RunAIFlow");
  assert.equal(actions.Run_an_agent.inputs.host.operationId, "InvokeAgent");
  // chainActions wires runAfter so second waits on first
  assert.deepEqual(actions.Run_an_agent.runAfter, { Tool_Call: ["Succeeded"] });
});

// ---------------------------------------------------------------------------
// createAIFlow (Dataverse POST shape)
// ---------------------------------------------------------------------------

function loadFmRecorder(envIdResponse = "f9a0cae4-a7e5-e91a-b358-9b848e12071c") {
  delete require.cache[FM_MODULE];
  delete require.cache[HTTP_MODULE];
  const calls = [];
  require.cache[HTTP_MODULE] = {
    id: HTTP_MODULE, filename: HTTP_MODULE, loaded: true,
    exports: {
      httpRequest: async (m, u) => {
        if (u.includes("/organizations")) {
          return { status: 200, data: { value: [{ environmentid: envIdResponse }] } };
        }
        return { status: 200, data: {} };
      },
      httpRequestWithRetry: async (method, url, headers, body) => {
        calls.push({ method, url, headers, body });
        if (url.includes("/workflows") && method === "POST" && !url.includes("PublishComponent")) {
          return { status: 201, data: { workflowid: "ai-flow-id-001" } };
        }
        return { status: 204, data: {} };
      },
      getToken: async () => "tok",
    },
  };
  return { fm: require(FM_MODULE), calls };
}

test("createAIFlow posts category=7 / primaryentity=workflow (NOT modernflowtype=1)", async () => {
  const { fm, calls } = loadFmRecorder();
  await fm.createAIFlow("https://orgxyz.crm.dynamics.com", "tok", {
    name: "Work IQ Copilot (Preview)",
    connectors: [{ apiName: "shared_a365copilotchatmcp", operationId: "mcp_m365copilot", displayName: "Work IQ Copilot (Preview)" }],
  });
  const post = calls.find((c) => c.method === "POST" && c.url.includes("/workflows"));
  assert.ok(post, "POST /workflows fired");
  assert.equal(post.body.category, 7, "AI flow category");
  assert.equal(post.body.primaryentity, "workflow", "AI flow primaryentity");
  assert.equal(post.body.type, 1);
  assert.equal(post.body.modernflowtype, undefined, "no modernflowtype on AI flows");
  // clientdata is the AI flow shape, NOT Logic Apps WDL
  const inner = JSON.parse(post.body.clientdata);
  assert.ok(inner.definition.actions.connectors, "connectors-list shape");
  assert.equal(inner.definition.actions.connectors[0].api.name, "shared_a365copilotchatmcp");
});

test("createAIFlow includes outputs schema column when outputSchema provided", async () => {
  const { fm, calls } = loadFmRecorder();
  await fm.createAIFlow("https://orgxyz.crm.dynamics.com", "tok", {
    name: "X",
    connectors: [{ apiName: "shared_x", operationId: "op_x" }],
    outputSchema: { type: "object", properties: { response: { title: "Response", type: "string" } } },
  });
  const post = calls.find((c) => c.method === "POST" && c.url.includes("/workflows"));
  assert.ok(post.body.outputs, "outputs column set");
  const parsedOutputs = JSON.parse(post.body.outputs);
  assert.equal(parsedOutputs.schema.properties.response.title, "Response",
    "outputs is { schema: <JSONSchema> } stringified");
});

test("createAIFlow with publish=true triggers PublishComponent after create", async () => {
  const { fm, calls } = loadFmRecorder();
  await fm.createAIFlow("https://orgxyz.crm.dynamics.com", "tok", {
    name: "X",
    connectors: [{ apiName: "shared_x", operationId: "op_x" }],
    publish: true,
  });
  const publishCall = calls.find((c) => c.url.includes("PublishComponent"));
  assert.ok(publishCall, "publish chained after create");
  assert.equal(publishCall.body.Target, "/workflows(ai-flow-id-001)");
});
