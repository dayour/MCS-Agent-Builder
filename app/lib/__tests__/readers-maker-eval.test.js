/**
 * maker-eval reader tests — no network. Stubs island-client to verify that
 * the reader passes through results correctly and applies normalization.
 *
 * Run: node --test app/lib/__tests__/readers-maker-eval.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const ISLAND_ID = path.resolve(__dirname, "..", "..", "..", "tools", "island-client.js");

const originalLoad = Module._load;
const stub = {
    isEnabledImpl: async () => false,
    supportedKnowledgeSourcesImpl: async () => [],
    listTestSetsImpl: async () => [],
};
Module._load = function (request, parent, isMain) {
    const resolved = (() => { try { return Module._resolveFilename(request, parent); } catch { return null; } })();
    if (resolved === ISLAND_ID) {
        return {
            makerEvalIsEnabled: (...args) => stub.isEnabledImpl(...args),
            makerEvalGetSupportedKnowledgeSources: (...args) => stub.supportedKnowledgeSourcesImpl(...args),
            makerEvalListTestSets: (...args) => stub.listTestSetsImpl(...args),
        };
    }
    return originalLoad.call(this, request, parent, isMain);
};

const reader = require("../readers/maker-eval");

function resetStub() {
    stub.isEnabledImpl = async () => false;
    stub.supportedKnowledgeSourcesImpl = async () => [];
    stub.listTestSetsImpl = async () => [];
}

test("isEnabled passes through true", async () => {
    resetStub();
    stub.isEnabledImpl = async () => true;
    const out = await reader.isEnabled("https://gw.gateway.prod.island.powerapps.com", "env", "bot", {});
    assert.equal(out, true);
});

test("isEnabled passes through false", async () => {
    resetStub();
    const out = await reader.isEnabled("https://gw.gateway.prod.island.powerapps.com", "env", "bot", {});
    assert.equal(out, false);
});

test("supportedKnowledgeSources normalizes entries with id/displayName defaults", async () => {
    resetStub();
    stub.supportedKnowledgeSourcesImpl = async () => [
        { id: "pdf", displayName: "PDF" },
        { displayName: "Word Document" }, // missing id
        { id: "txt" },                     // missing displayName
    ];
    const out = await reader.supportedKnowledgeSources("https://gw.gateway.prod.island.powerapps.com", "env", "bot", {});
    assert.equal(out.length, 3);
    assert.equal(out[0].id, "pdf");
    assert.equal(out[1].id, "Word Document", "falls back to displayName for id when id is missing");
    assert.equal(out[2].displayName, "txt", "falls back to id for displayName when displayName is missing");
});

test("supportedKnowledgeSources coerces missing maxSizeInBytes to null", async () => {
    resetStub();
    stub.supportedKnowledgeSourcesImpl = async () => [{ id: "pdf" }, { id: "xlsx", maxSizeInBytes: 10 * 1024 * 1024 }];
    const out = await reader.supportedKnowledgeSources("https://gw.gateway.prod.island.powerapps.com", "env", "bot", {});
    assert.equal(out[0].maxSizeInBytes, null);
    assert.equal(out[1].maxSizeInBytes, 10485760);
});

test("listTestSets normalizes id and count fields", async () => {
    resetStub();
    stub.listTestSetsImpl = async () => [
        { testSetId: "t1", displayName: "Golden Set", testCaseCount: 42 },
        { id: "t2", name: "Secondary", testCaseCount: 0 },   // older/alternate field names
        { testSetId: "t3" },                                 // no counts
    ];
    const out = await reader.listTestSets("https://gw.gateway.prod.island.powerapps.com", "env", "bot", {});
    assert.equal(out.length, 3);
    assert.equal(out[0].testSetId, "t1");
    assert.equal(out[0].testCaseCount, 42);
    assert.equal(out[1].testSetId, "t2", "falls back to id when testSetId is missing");
    assert.equal(out[1].displayName, "Secondary", "falls back to name when displayName is missing");
    assert.equal(out[2].testCaseCount, null, "missing count becomes null");
});

test("listTestSets forwards applyV2Migration opts", async () => {
    resetStub();
    let capturedOpts = null;
    stub.listTestSetsImpl = async (_gw, _env, _bot, _h, opts) => { capturedOpts = opts; return []; };
    await reader.listTestSets("https://gw.gateway.prod.island.powerapps.com", "env", "bot", {}, { applyV2Migration: false });
    assert.deepEqual(capturedOpts, { applyV2Migration: false });
});
