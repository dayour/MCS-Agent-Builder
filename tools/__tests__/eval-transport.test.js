const test = require("node:test");
const assert = require("node:assert/strict");
const { activityText, toolInvocations, createCopilotStudioTransport } = require("../eval-transport");
const { getTransportName } = require("../../app/lib/eval-pipeline");

test("Agents SDK transport normalizes response text, tools, and conversation IDs", async () => {
  const calls = [];
  const client = {
    async startConversationWithResponse() { return { conversationId: "conversation-1", activities: [] }; },
    async executeWithResponse(activity, conversationId) {
      calls.push({ activity, conversationId });
      return {
        conversationId: "conversation-1",
        activities: [
          { type: "trace", name: "SearchKnowledge" },
          { type: "message", text: "The answer" },
          { type: "event", name: "SearchKnowledge" },
        ],
      };
    },
  };
  const transport = createCopilotStudioTransport(
    { environmentId: "env", schemaName: "agent", jwt: "jwt" },
    { sdk: { ConnectionSettings: class { constructor(options) { this.options = options; } } }, client }
  );

  const conversationId = await transport.startConversation();
  const result = await transport.sendAndReceive("Question", conversationId);

  assert.equal(transport.name, "agents-sdk");
  assert.equal(result.response, "The answer");
  assert.deepEqual(result.toolInvocations, ["SearchKnowledge"]);
  assert.deepEqual(calls[0], {
    activity: { type: "message", from: { id: "eval-user" }, text: "Question" },
    conversationId: "conversation-1",
  });
});

test("transport helpers handle absent messages and deduplicate tools", () => {
  assert.equal(activityText([]), "[No response within timeout]");
  assert.deepEqual(toolInvocations([{ type: "trace", name: "tool" }, { type: "event", name: "tool" }]), ["tool"]);
});

test("Agents SDK transport requires all Entra connection values", () => {
  assert.throws(() => createCopilotStudioTransport({ environmentId: "env" }), /environmentId, schemaName, and an Azure AD JWT/);
});

test("eval pipeline defaults to Direct Line and only accepts supported transports", () => {
  assert.equal(getTransportName({ evalConfig: {} }), "direct-line");
  assert.equal(getTransportName({ evalConfig: { transport: "agents-sdk" } }), "agents-sdk");
  assert.throws(() => getTransportName({ evalConfig: { transport: "unknown" } }), /Unknown eval transport/);
});
