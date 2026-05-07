/**
 * dialogs-reader tests — mode selection, normalization, shadow diff (no network).
 *
 * Exercises the reader with stubbed island-client responses so we don't need
 * a live Gateway. Real-network flow is verified separately via the CLI smoke.
 *
 * Run: node --test app/lib/__tests__/readers-dialogs.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

// The reader resolves '../../../tools/island-client' from app/lib/readers/ to repo-root/tools.
const ISLAND_ID = path.resolve(__dirname, "..", "..", "..", "tools", "island-client.js");
// same directory targeted by the reader; keeping a single var

// Install a stub for tools/island-client.js before requiring the reader.
const originalLoad = Module._load;
const stub = {
    listDialogsImpl: async () => ({ items: [] }),
    getSystemDialogsImpl: async () => [],
    readComponentsImpl: async () => ({ botComponentChanges: [] }),
};
Module._load = function (request, parent, isMain) {
    const resolved = (() => { try { return Module._resolveFilename(request, parent); } catch { return null; } })();
    if (resolved === ISLAND_ID) {
        return {
            listDialogs: (...args) => stub.listDialogsImpl(...args),
            getSystemDialogs: (...args) => stub.getSystemDialogsImpl(...args),
            readComponents: (...args) => stub.readComponentsImpl(...args),
        };
    }
    return originalLoad.call(this, request, parent, isMain);
};

const reader = require("../readers/dialogs");

function resetStub() {
    stub.listDialogsImpl = async () => ({ items: [] });
    stub.getSystemDialogsImpl = async () => [];
    stub.readComponentsImpl = async () => ({ botComponentChanges: [] });
}

test("typed mode returns normalized typed results (default)", async () => {
    resetStub();
    delete process.env.MCS_DIALOGS_MODE;
    stub.listDialogsImpl = async () => ({
        items: [
            { id: "dlg-1", schemaName: "greeting", displayName: "Greeting", type: "DialogComponent" },
            { id: "dlg-2", schemaName: "escalate", displayName: "Escalate" },
        ],
    });
    const out = await reader.listDialogs("https://gw.gateway.prod.island.powerapps.com", "env", "bot", {});
    assert.equal(out.length, 2);
    assert.equal(out[0].id, "dlg-1");
    assert.equal(out[0].schemaName, "greeting");
    assert.equal(out[0].$kind, "DialogComponent");
});

test("typed mode accepts { value: [...] } OData-style payload", async () => {
    resetStub();
    stub.listDialogsImpl = async () => ({ value: [{ id: "x", displayName: "X" }] });
    const out = await reader.listDialogs("https://gw.gateway.prod.island.powerapps.com", "env", "bot", {}, { mode: "typed" });
    assert.equal(out.length, 1);
    assert.equal(out[0].id, "x");
});

test("legacy mode filters readComponents for DialogComponent", async () => {
    resetStub();
    stub.readComponentsImpl = async () => ({
        botComponentChanges: [
            { component: { $kind: "DialogComponent", id: "d1", schemaName: "hello", displayName: "Hello", dialog: { beginDialog: { $kind: "OnIntent" } } } },
            { component: { $kind: "GptComponent", id: "g1" } },
            { component: { $kind: "DialogComponent", id: "d2", schemaName: "escalate" } },
        ],
    });
    const out = await reader.listDialogs("https://gw.gateway.prod.island.powerapps.com", "env", "bot", {}, { mode: "legacy" });
    assert.equal(out.length, 2);
    assert.equal(out[0].id, "d1");
    assert.equal(out[0].triggerKind, "OnIntent");
    assert.equal(out[1].id, "d2");
});

test("legacy mode is selected when MCS_DIALOGS_MODE=legacy is set", async () => {
    resetStub();
    process.env.MCS_DIALOGS_MODE = "legacy";
    stub.listDialogsImpl = async () => { throw new Error("typed should NOT be called"); };
    stub.readComponentsImpl = async () => ({ botComponentChanges: [{ component: { $kind: "DialogComponent", id: "d1" } }] });
    const out = await reader.listDialogs("https://gw.gateway.prod.island.powerapps.com", "env", "bot", {});
    assert.equal(out.length, 1);
    delete process.env.MCS_DIALOGS_MODE;
});

test("invalid MCS_DIALOGS_MODE silently falls back to typed", async () => {
    resetStub();
    process.env.MCS_DIALOGS_MODE = "totally-invalid";
    let legacyCalled = false;
    stub.readComponentsImpl = async () => { legacyCalled = true; return { botComponentChanges: [] }; };
    stub.listDialogsImpl = async () => ({ items: [] });
    await reader.listDialogs("https://gw.gateway.prod.island.powerapps.com", "env", "bot", {});
    assert.equal(legacyCalled, false);
    delete process.env.MCS_DIALOGS_MODE;
});

test("shadow mode invokes both paths and reports diff via callback", async () => {
    resetStub();
    stub.listDialogsImpl = async () => ({ items: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    stub.readComponentsImpl = async () => ({
        botComponentChanges: [
            { component: { $kind: "DialogComponent", id: "a" } },
            { component: { $kind: "DialogComponent", id: "b" } },
        ],
    });
    let diffSeen = null;
    const out = await reader.listDialogs("https://gw.gateway.prod.island.powerapps.com", "env", "bot", {}, {
        mode: "shadow",
        onShadowDiff: (d) => { diffSeen = d; },
    });
    assert.equal(out.length, 3, "returns typed result (the new canonical path)");
    assert.ok(diffSeen);
    assert.equal(diffSeen.typedCount, 3);
    assert.equal(diffSeen.legacyCount, 2);
    assert.deepEqual(diffSeen.onlyInTyped, ["c"]);
    assert.deepEqual(diffSeen.onlyInLegacy, []);
    assert.equal(diffSeen.equalIds, false);
});

test("shadow mode with identical data reports equalIds=true", async () => {
    resetStub();
    stub.listDialogsImpl = async () => ({ items: [{ id: "a" }, { id: "b" }] });
    stub.readComponentsImpl = async () => ({
        botComponentChanges: [
            { component: { $kind: "DialogComponent", id: "a" } },
            { component: { $kind: "DialogComponent", id: "b" } },
        ],
    });
    let diffSeen = null;
    await reader.listDialogs("https://gw.gateway.prod.island.powerapps.com", "env", "bot", {}, {
        mode: "shadow",
        onShadowDiff: (d) => { diffSeen = d; },
    });
    assert.equal(diffSeen.equalIds, true);
    assert.equal(diffSeen.equalCount, true);
});

test("listSystemDialogs normalizes a bare Dialog2[] array", async () => {
    resetStub();
    stub.getSystemDialogsImpl = async () => [
        { id: "sys-greeting", displayName: "Greeting" },
        { id: "sys-escalate", displayName: "Escalate" },
    ];
    const out = await reader.listSystemDialogs("https://gw.gateway.prod.island.powerapps.com", "env", "bot", {});
    assert.equal(out.length, 2);
    assert.equal(out[0].$kind, "DialogComponent");
    assert.equal(out[0].displayName, "Greeting");
});

test("diff helper catches bidirectional mismatch", () => {
    const d = reader._internal.diffDialogLists(
        [{ id: "a" }, { id: "c" }],
        [{ id: "a" }, { id: "b" }]
    );
    assert.deepEqual(d.onlyInTyped, ["c"]);
    assert.deepEqual(d.onlyInLegacy, ["b"]);
    assert.equal(d.equalIds, false);
    assert.equal(d.equalCount, true, "count matches even though ids differ");
});
