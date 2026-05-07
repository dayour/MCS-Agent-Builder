/**
 * makerEvalUpdateTestComponents tests — pure / no network.
 *
 * Covers request validation (operationType enum, non-empty testComponents)
 * and the isUpdateTestComponentsResponseShape validator. Live network test
 * is intentionally omitted — this is a WRITE endpoint; manual verification
 * happens via the parity runbook in tools/upstream-specs/maker-eval-write.md.
 *
 * Run: node --test app/lib/__tests__/island-client.updateTestComponents.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    makerEvalUpdateTestComponents,
    RoutingMisconfiguredError,
    _internal: { isUpdateTestComponentsResponseShape }
} = require("../../../tools/island-client.js");

const goodGateway = "https://powervamg.us-il104.gateway.prod.island.powerapps.com";

test("rejects missing request.testComponents", async () => {
    await assert.rejects(
        () => makerEvalUpdateTestComponents(goodGateway, "env", "bot", {}, undefined),
        (err) => err instanceof RoutingMisconfiguredError && /non-empty array/.test(err.message)
    );
});

test("rejects empty testComponents array", async () => {
    await assert.rejects(
        () => makerEvalUpdateTestComponents(goodGateway, "env", "bot", {}, { testComponents: [] }),
        (err) => err instanceof RoutingMisconfiguredError && /non-empty array/.test(err.message)
    );
});

test("rejects item without operationType", async () => {
    await assert.rejects(
        () => makerEvalUpdateTestComponents(goodGateway, "env", "bot", {}, {
            testComponents: [{ component: {} }]
        }),
        (err) => err instanceof RoutingMisconfiguredError && /invalid operationType/.test(err.message)
    );
});

test("rejects item with invalid operationType", async () => {
    await assert.rejects(
        () => makerEvalUpdateTestComponents(goodGateway, "env", "bot", {}, {
            testComponents: [{ component: {}, operationType: "Upsert" }]
        }),
        (err) => err instanceof RoutingMisconfiguredError && /Upsert/.test(err.message)
    );
});

test("accepts Add / Update / Delete operationType (passes validation, fails later on network — which we do not test here)", async () => {
    // Validation passes; actual POST is attempted and will throw (no real network), but the
    // error source will NOT be our shape validators. We only check the validation gate.
    for (const op of ["Add", "Update", "Delete"]) {
        await assert.rejects(
            () => makerEvalUpdateTestComponents(goodGateway, "env", "bot", {}, {
                testComponents: [{ component: { schemaName: "x" }, operationType: op }]
            }),
            (err) => !(err instanceof RoutingMisconfiguredError) || !/invalid operationType|non-empty array/.test(err.message),
            `operationType=${op} should pass request validation`
        );
    }
});

test("isUpdateTestComponentsResponseShape accepts empty object (Update/Delete only response)", () => {
    assert.equal(isUpdateTestComponentsResponseShape({}), true);
});

test("isUpdateTestComponentsResponseShape accepts { addedComponentsIdsBySchemaName: {...} }", () => {
    assert.equal(
        isUpdateTestComponentsResponseShape({
            addedComponentsIdsBySchemaName: { "mspva.TopicSet.X": "11111111-1111-1111-1111-111111111111" }
        }),
        true
    );
});

test("isUpdateTestComponentsResponseShape accepts empty map", () => {
    assert.equal(isUpdateTestComponentsResponseShape({ addedComponentsIdsBySchemaName: {} }), true);
});

test("isUpdateTestComponentsResponseShape accepts null addedComponentsIdsBySchemaName", () => {
    assert.equal(isUpdateTestComponentsResponseShape({ addedComponentsIdsBySchemaName: null }), true);
});

test("isUpdateTestComponentsResponseShape rejects array of components", () => {
    assert.equal(isUpdateTestComponentsResponseShape([]), false);
    assert.equal(isUpdateTestComponentsResponseShape([{ id: "x" }]), false);
});

test("isUpdateTestComponentsResponseShape rejects array-valued addedComponentsIdsBySchemaName", () => {
    assert.equal(isUpdateTestComponentsResponseShape({ addedComponentsIdsBySchemaName: [] }), false);
});

test("isUpdateTestComponentsResponseShape rejects null and primitives", () => {
    assert.equal(isUpdateTestComponentsResponseShape(null), false);
    assert.equal(isUpdateTestComponentsResponseShape("html"), false);
    assert.equal(isUpdateTestComponentsResponseShape(42), false);
});

test("rejects non-HTTPS gateway via shared allowlist (inherits from typedPostToGateway)", async () => {
    await assert.rejects(
        () => makerEvalUpdateTestComponents("http://powervamg.us-il104.gateway.prod.island.powerapps.com", "env", "bot", {}, {
            testComponents: [{ component: {}, operationType: "Add" }]
        }),
        (err) => err instanceof RoutingMisconfiguredError && /https:\/\//.test(err.message)
    );
});

// The auto-wrap behavior was discovered via HAR inspection of the MCS UI:
// the server's polymorphic JSON deserializer needs the $kind discriminator
// on each testComponents item (and its nested component) or it returns HTTP 500.
// Our adapter auto-injects these so callers can pass minimal payloads.
//
// We validate the auto-wrap by stubbing typedPostToGateway and capturing the
// body that the adapter actually sends.
test("auto-injects MakerEvaluationUpdateTestComponent $kind wrapper when missing", async () => {
    const Module = require("node:module");
    const path = require("node:path");
    const ISLAND_ID = path.resolve(__dirname, "..", "..", "..", "tools", "island-client.js");
    delete require.cache[ISLAND_ID];

    // Load island-client fresh, then monkey-patch its internal typedPostToGateway
    // by intercepting httpRequest. Because the adapter uses httpRequest for POST,
    // we swap the http helper one level down.
    const httpModule = require("../../../tools/lib/http.js");
    const originalPost = httpModule.httpRequest;
    let capturedBody = null;
    let capturedQuery = null;
    httpModule.httpRequest = async (method, url, headers, body) => {
        capturedBody = typeof body === "string" ? JSON.parse(body) : body;
        capturedQuery = url.split("?")[1] || "";
        return {
            status: 200,
            headers: { "content-type": "application/json" },
            data: { addedComponentsIdsBySchemaName: {} },
        };
    };

    try {
        const island = require(ISLAND_ID);
        await island.makerEvalUpdateTestComponents(
            "https://powervamg.us-il104.gateway.prod.island.powerapps.com",
            "env-id",
            "bot-id",
            { Authorization: "Bearer x" },
            {
                testComponents: [
                    {
                        component: { schemaName: "mspva_abc", category: "Testing", state: "Active" },
                        operationType: "Add",
                    },
                ],
            },
            { applyV2Migration: true }
        );
    } finally {
        httpModule.httpRequest = originalPost;
        delete require.cache[ISLAND_ID];
    }

    assert.ok(capturedBody, "httpRequest should have been called");
    assert.equal(capturedBody.testComponents.length, 1);
    assert.equal(capturedBody.testComponents[0].$kind, "MakerEvaluationUpdateTestComponent",
        "outer $kind wrapper auto-injected");
    assert.equal(capturedBody.testComponents[0].component.$kind, "TestCaseComponent",
        "inner component $kind auto-injected");
    assert.equal(capturedBody.testComponents[0].operationType, "Add");
    // Query param uses Pascal case to match the MCS UI (observed in HAR).
    assert.match(capturedQuery, /ApplyV2Migration=true/);
});

test("does not overwrite caller-provided $kind values", async () => {
    const Module = require("node:module");
    const path = require("node:path");
    const ISLAND_ID = path.resolve(__dirname, "..", "..", "..", "tools", "island-client.js");
    delete require.cache[ISLAND_ID];
    const httpModule = require("../../../tools/lib/http.js");
    const originalPost = httpModule.httpRequest;
    let capturedBody = null;
    httpModule.httpRequest = async (method, url, headers, body) => {
        capturedBody = typeof body === "string" ? JSON.parse(body) : body;
        return { status: 200, headers: { "content-type": "application/json" }, data: {} };
    };

    try {
        const island = require(ISLAND_ID);
        await island.makerEvalUpdateTestComponents(
            "https://powervamg.us-il104.gateway.prod.island.powerapps.com",
            "env",
            "bot",
            {},
            {
                testComponents: [
                    {
                        $kind: "CustomWrapperKind",  // caller-provided
                        component: { $kind: "CustomComponentKind", schemaName: "x" },
                        operationType: "Update",
                    },
                ],
            }
        );
    } finally {
        httpModule.httpRequest = originalPost;
        delete require.cache[ISLAND_ID];
    }

    assert.equal(capturedBody.testComponents[0].$kind, "CustomWrapperKind",
        "caller-provided outer $kind should not be overwritten");
    assert.equal(capturedBody.testComponents[0].component.$kind, "CustomComponentKind",
        "caller-provided inner $kind should not be overwritten");
});
