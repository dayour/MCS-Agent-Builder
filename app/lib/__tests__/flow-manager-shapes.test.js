/**
 * Request-shape parity tests for tools/flow-manager.js
 *
 * Validates that flow-manager produces wire-level requests matching the HAR
 * captures of the live MCS portal. Mocks the HTTP layer to record every
 * request and asserts shape, headers, and body keys match expected.
 *
 * Run: node --test app/lib/__tests__/flow-manager-shapes.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const HTTP_MODULE = path.join(REPO_ROOT, "tools", "lib", "http.js");
const FM_MODULE = path.join(REPO_ROOT, "tools", "flow-manager.js");

// Replace tools/lib/http.js exports with a recorder before flow-manager loads.
function loadFlowManagerWithRecorder(envIdResponse = "f9a0cae4-a7e5-e91a-b358-9b848e12071c") {
  // Purge any cached require so each test gets a fresh recorder
  delete require.cache[FM_MODULE];
  delete require.cache[HTTP_MODULE];

  const calls = [];
  const recorder = {
    httpRequest: async (method, url, headers, body) => {
      calls.push({ method, url, headers, body });
      // Stub responses based on URL pattern
      if (url.includes("/organizations")) {
        return { status: 200, data: { value: [{ environmentid: envIdResponse }] } };
      }
      return { status: 200, data: {} };
    },
    httpRequestWithRetry: async (method, url, headers, body) => {
      calls.push({ method, url, headers, body });
      if (url.includes("/workflows") && method === "POST" && !url.includes("PublishComponent")) {
        return { status: 201, data: { workflowid: "11111111-2222-3333-4444-555555555555" } };
      }
      return { status: 204, data: {} };
    },
    getToken: async () => "fake-token",
  };
  require.cache[HTTP_MODULE] = {
    id: HTTP_MODULE,
    filename: HTTP_MODULE,
    loaded: true,
    exports: recorder,
  };

  const fm = require(FM_MODULE);
  return { fm, calls };
}

test("publishFlow uses PublishComponent bound action with ActivateFlowOnPublish=true", async () => {
  const { fm, calls } = loadFlowManagerWithRecorder();
  await fm.publishFlow("https://orgxyz.crm.dynamics.com", "tok", "abc-flow-id");
  assert.equal(calls.length, 1, "exactly one HTTP call");
  const c = calls[0];
  assert.equal(c.method, "POST");
  assert.match(c.url, /\/PublishComponent\?ActivateFlowOnPublish=true$/);
  assert.deepEqual(c.body, { Target: "/workflows(abc-flow-id)" });
  assert.equal(c.headers["Prefer"], 'odata.include-annotations="*"');
  assert.match(c.headers["Authorization"], /^Bearer /);
});

test("publishFlow with activate=false sends ActivateFlowOnPublish=false", async () => {
  const { fm, calls } = loadFlowManagerWithRecorder();
  await fm.publishFlow("https://orgxyz.crm.dynamics.com", "tok", "abc", { activate: false });
  assert.match(calls[0].url, /ActivateFlowOnPublish=false/);
});

test("activateFlow routes through publishFlow (backwards-compat shim)", async () => {
  const { fm, calls } = loadFlowManagerWithRecorder();
  await fm.activateFlow("https://orgxyz.crm.dynamics.com", "tok", "abc");
  assert.equal(calls[0].method, "POST");
  assert.match(calls[0].url, /PublishComponent/);
  // Should NOT be the legacy PATCH {statecode:1}
  assert.notEqual(calls[0].method, "PATCH");
});

test("deactivateFlow keeps legacy PATCH {statecode:0} (runtime-off, not unpublish)", async () => {
  const { fm, calls } = loadFlowManagerWithRecorder();
  await fm.deactivateFlow("https://orgxyz.crm.dynamics.com", "tok", "abc");
  assert.equal(calls[0].method, "PATCH");
  assert.deepEqual(calls[0].body, { statecode: 0 });
  assert.equal(calls[0].headers["mscrm.AsUnpublished"], undefined,
    "deactivate should NOT set AsUnpublished — that would unpublish the component");
});

test("buildRecurrenceClientdata injects environment.name and displayName when provided", () => {
  const { fm } = loadFlowManagerWithRecorder();
  const out = fm.buildRecurrenceClientdata(
    { frequency: "Day", interval: 1 },
    "copilots_x",
    "connref_y",
    "msg",
    { envGuid: "env-guid-here", displayName: "MyFlow" }
  );
  const parsed = JSON.parse(out);
  assert.equal(parsed.properties.environment.name, "env-guid-here");
  assert.equal(parsed.properties.displayName, "MyFlow");
  assert.equal(parsed.schemaVersion, "1.0.0.0");
  assert.ok(parsed.properties.definition.triggers.Recurrence, "trigger present");
});

test("buildRecurrenceClientdata omits environment/displayName when not provided", () => {
  const { fm } = loadFlowManagerWithRecorder();
  const out = fm.buildRecurrenceClientdata(
    { frequency: "Day", interval: 1 },
    "copilots_x", "connref_y", "msg"
  );
  const parsed = JSON.parse(out);
  assert.equal(parsed.properties.environment, undefined);
  assert.equal(parsed.properties.displayName, undefined);
});

test("createTriggerFlow derives envGuid and includes modernflowtype=1", async () => {
  const { fm, calls } = loadFlowManagerWithRecorder();
  await fm.createTriggerFlow("https://orgxyz.crm.dynamics.com", "tok", {
    schedule: { frequency: "Day", interval: 1 },
    copilotParam: "copilots_x",
    connRefLogicalName: "connref_y",
    message: "hi",
  });
  // Expect: GET organizations (env discovery), then POST /workflows
  const post = calls.find((c) => c.method === "POST" && c.url.includes("/workflows"));
  assert.ok(post, "POST /workflows fired");
  assert.equal(post.body.category, 5);
  assert.equal(post.body.modernflowtype, 1);
  assert.equal(post.body.primaryentity, "none");
  assert.equal(post.body.type, 1);
  // clientdata is stringified JSON; parse and check env injection
  const inner = JSON.parse(post.body.clientdata);
  assert.equal(inner.properties.environment.name, "f9a0cae4-a7e5-e91a-b358-9b848e12071c");
});

test("updateSchedule and updateMessage send mscrm.AsUnpublished:true", async () => {
  // updateSchedule fetches the flow first via getFlow → need to stub the GET response
  // Use a custom recorder that returns a parseable clientdata for getFlow
  delete require.cache[FM_MODULE];
  delete require.cache[HTTP_MODULE];
  const calls = [];
  const stubFlow = {
    workflowid: "abc",
    clientdata: JSON.stringify({
      properties: {
        definition: {
          triggers: { Recurrence: { recurrence: { frequency: "Day", interval: 1 } } },
          actions: { Send: { inputs: { host: { operationId: "ExecuteCopilot" }, parameters: { "body/message": "old" } } } },
        },
      },
    }),
  };
  require.cache[HTTP_MODULE] = {
    id: HTTP_MODULE, filename: HTTP_MODULE, loaded: true,
    exports: {
      httpRequest: async (m, u) => ({ status: 200, data: {} }),
      httpRequestWithRetry: async (method, url, headers, body) => {
        calls.push({ method, url, headers, body });
        if (method === "GET" && url.includes("/workflows(")) {
          return { status: 200, data: stubFlow };
        }
        return { status: 204, data: {} };
      },
      getToken: async () => "tok",
    },
  };
  const fm = require(FM_MODULE);

  await fm.updateSchedule("https://orgxyz.crm.dynamics.com", "tok", "abc", {
    frequency: "Hour", interval: 2,
  });
  const patch1 = calls.find((c) => c.method === "PATCH");
  assert.ok(patch1, "PATCH issued");
  assert.equal(patch1.headers["mscrm.AsUnpublished"], "true",
    "updateSchedule must send AsUnpublished:true to preserve draft semantics");

  // Reset and try updateMessage
  calls.length = 0;
  await fm.updateMessage("https://orgxyz.crm.dynamics.com", "tok", "abc", "new message");
  const patch2 = calls.find((c) => c.method === "PATCH");
  assert.ok(patch2);
  assert.equal(patch2.headers["mscrm.AsUnpublished"], "true",
    "updateMessage must send AsUnpublished:true");
});

test("createFlow with raw WDL wraps it under properties.definition + injects env", async () => {
  const { fm, calls } = loadFlowManagerWithRecorder();
  await fm.createFlow("https://orgxyz.crm.dynamics.com", "tok", {
    name: "T",
    definition: {
      $schema: "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
      contentVersion: "1.0.0.0",
      triggers: { manual: { type: "Request", kind: "Button" } },
      actions: {},
    },
  });
  const post = calls.find((c) => c.method === "POST" && c.url.includes("/workflows"));
  const inner = JSON.parse(post.body.clientdata);
  assert.equal(inner.properties.environment.name, "f9a0cae4-a7e5-e91a-b358-9b848e12071c");
  assert.ok(inner.properties.definition, "raw WDL was nested under properties.definition");
  assert.ok(inner.properties.definition.triggers.manual, "trigger preserved");
});

test("createFlow with composer-output (connectionReferences + definition) shape", async () => {
  const { fm, calls } = loadFlowManagerWithRecorder();
  // This is what tools/lib/flow-composer.js composeFlow() returns
  const composed = {
    connectionReferences: { shared_x: { api: { name: "shared_x" } } },
    definition: {
      $schema: "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
      contentVersion: "1.0.0.0",
      triggers: { Recurrence: { type: "Recurrence" } },
      actions: {},
    },
    templateName: "",
  };
  await fm.createFlow("https://orgxyz.crm.dynamics.com", "tok", { name: "T", definition: composed });
  const post = calls.find((c) => c.method === "POST" && c.url.includes("/workflows"));
  const inner = JSON.parse(post.body.clientdata);
  assert.equal(inner.properties.environment.name, "f9a0cae4-a7e5-e91a-b358-9b848e12071c");
  assert.deepEqual(inner.properties.connectionReferences, composed.connectionReferences,
    "composer's connectionReferences carried through");
  assert.ok(inner.properties.definition.triggers.Recurrence);
});

test("createFlow with full envelope unwraps once and re-wraps cleanly", async () => {
  const { fm, calls } = loadFlowManagerWithRecorder();
  const envelope = {
    properties: {
      connectionReferences: {},
      definition: {
        $schema: "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
        contentVersion: "1.0.0.0",
        triggers: { manual: { type: "Request" } },
        actions: {},
      },
      templateName: "",
    },
    schemaVersion: "1.0.0.0",
  };
  await fm.createFlow("https://orgxyz.crm.dynamics.com", "tok", { name: "T", definition: envelope });
  const post = calls.find((c) => c.method === "POST" && c.url.includes("/workflows"));
  const inner = JSON.parse(post.body.clientdata);
  assert.ok(inner.properties.definition.triggers.manual, "no double-wrap");
  assert.equal(inner.properties.environment.name, "f9a0cae4-a7e5-e91a-b358-9b848e12071c");
});
