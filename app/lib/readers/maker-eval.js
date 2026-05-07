/**
 * MakerEvaluation reader — bridges the Phase 3 typed adapters into app/lib/.
 *
 * Unlike the dialogs reader, there is no legacy reverse-engineered baseline
 * for these three endpoints in our Node tools (eval-pipeline.js currently
 * bypasses these routes entirely and talks to a different /makerevaluations
 * endpoint for test-component upload). So there's no shadow mode to
 * configure — we just wrap the typed call with a stable return shape.
 *
 * Endpoints wrapped:
 *   isEnabled()              -> boolean
 *   supportedKnowledgeSources() -> MakerEvalSupportedKnowledgeFile[]
 *   listTestSets()           -> MakerEvalTestSet[]
 */

const island = require("../../../tools/island-client");

async function isEnabled(gatewayUrl, envId, botId, headers) {
    return island.makerEvalIsEnabled(gatewayUrl, envId, botId, headers);
}

async function supportedKnowledgeSources(gatewayUrl, envId, botId, headers) {
    const items = await island.makerEvalGetSupportedKnowledgeSources(gatewayUrl, envId, botId, headers);
    // Normalize: ensure each entry has an `id` field even if upstream only provided displayName
    return items.map((f) => ({
        id: f.id || f.displayName || "",
        displayName: f.displayName || f.id || "",
        maxSizeInBytes: typeof f.maxSizeInBytes === "number" ? f.maxSizeInBytes : null,
        ...f,
    }));
}

async function listTestSets(gatewayUrl, envId, botId, headers, opts = {}) {
    const sets = await island.makerEvalListTestSets(gatewayUrl, envId, botId, headers, opts);
    return sets.map((ts) => ({
        testSetId: ts.testSetId || ts.id || "",
        displayName: ts.displayName || ts.name || "",
        testCaseCount: typeof ts.testCaseCount === "number" ? ts.testCaseCount : null,
        ...ts,
    }));
}

module.exports = {
    isEnabled,
    supportedKnowledgeSources,
    listTestSets,
};
