/**
 * Transport adapters for eval runners.
 *
 * Each adapter exposes startConversation() and sendAndReceive(question,
 * conversationId) so scoring and eval-gate policy remain transport-neutral.
 */

function activityText(activities) {
  return (activities || [])
    .filter((activity) => activity?.type === "message" && activity.text)
    .map((activity) => activity.text)
    .join("\n") || "[No response within timeout]";
}

function toolInvocations(activities) {
  const names = new Set();
  for (const activity of activities || []) {
    if ((activity?.type === "trace" || activity?.type === "event") && activity.name) names.add(activity.name);
  }
  return [...names];
}

function createCopilotStudioTransport(options, dependencies = {}) {
  const { environmentId, schemaName, jwt, cloud } = options || {};
  if (!environmentId || !schemaName || !jwt) {
    throw new Error("Agents SDK requires environmentId, schemaName, and an Azure AD JWT");
  }

  const sdk = dependencies.sdk || require("@microsoft/agents-copilotstudio-client");
  const client = dependencies.client || new sdk.CopilotStudioClient(
    new sdk.ConnectionSettings({ environmentId, schemaName, ...(cloud ? { cloud } : {}) }),
    jwt
  );

  return {
    name: "agents-sdk",
    async startConversation() {
      const response = await client.startConversationWithResponse();
      return response.conversationId;
    },
    async sendAndReceive(question, conversationId) {
      const response = await client.executeWithResponse(
        { type: "message", from: { id: "eval-user" }, text: question },
        conversationId
      );
      return {
        conversationId: response.conversationId || conversationId,
        response: activityText(response.activities),
        toolInvocations: toolInvocations(response.activities),
      };
    },
  };
}

module.exports = { activityText, toolInvocations, createCopilotStudioTransport };
