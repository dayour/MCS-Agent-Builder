/**
 * Provenance contract tests
 *
 * Run: node --test app/lib/__tests__/provenance.test.js
 *
 * These tests define the contract every write path (wizard save, enrichment
 * workers, research pipeline, frontend edits) must satisfy. Golden fixtures
 * show the expected shape for each origin. If these pass, downstream consumers
 * can rely on the provenance invariants in Phase 1+.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  SCHEMA_VERSION,
  SOURCES,
  getProvenance,
  isUserEdited,
  canWrite,
  setProvenance,
  mergeProvenance,
  fieldsWithProvenance,
} = require("../provenance");

// ---------------------------------------------------------------------------
// Sources + schema constants
// ---------------------------------------------------------------------------

test("schema version is locked to 2.0", () => {
  assert.equal(SCHEMA_VERSION, "2.0");
});

test("SOURCES enum includes the full origin set", () => {
  assert.deepEqual(
    new Set(Object.values(SOURCES)),
    new Set(["user", "wizard", "chat", "inference", "research", "enrichment", "upload"]),
  );
});

// ---------------------------------------------------------------------------
// getProvenance + isUserEdited
// ---------------------------------------------------------------------------

test("getProvenance returns null on empty brief", () => {
  assert.equal(getProvenance({}, "instructions"), null);
  assert.equal(getProvenance({ _provenance: {} }, "instructions"), null);
});

test("isUserEdited returns false on missing or non-user provenance", () => {
  assert.equal(isUserEdited({}, "instructions"), false);
  const brief = {};
  setProvenance(brief, "instructions", SOURCES.RESEARCH);
  assert.equal(isUserEdited(brief, "instructions"), false);
});

test("isUserEdited returns true only for SOURCES.USER", () => {
  const brief = {};
  setProvenance(brief, "instructions", SOURCES.USER);
  assert.equal(isUserEdited(brief, "instructions"), true);
});

// ---------------------------------------------------------------------------
// setProvenance
// ---------------------------------------------------------------------------

test("setProvenance records required fields", () => {
  const brief = {};
  const record = setProvenance(brief, "capabilities", SOURCES.WIZARD);
  assert.equal(record.lastSetBy, "wizard");
  assert.ok(record.lastSetAt, "lastSetAt must be set");
  assert.ok(new Date(record.lastSetAt).getTime() > 0, "lastSetAt must parse as a date");
  assert.deepEqual(record.sourceFiles, []);
});

test("setProvenance records optional metadata", () => {
  const brief = {};
  setProvenance(brief, "integrations", SOURCES.RESEARCH, {
    sourceFiles: ["sdr.md", "transcript.md"],
    confidence: "high",
    reason: "Extracted from SDR Section 3",
  });
  const rec = getProvenance(brief, "integrations");
  assert.deepEqual(rec.sourceFiles, ["sdr.md", "transcript.md"]);
  assert.equal(rec.confidence, "high");
  assert.equal(rec.reason, "Extracted from SDR Section 3");
});

test("setProvenance rejects unknown sources", () => {
  assert.throws(() => setProvenance({}, "x", "bogus"), /unknown source/);
});

test("setProvenance rejects invalid brief", () => {
  assert.throws(() => setProvenance(null, "x", SOURCES.USER), /must be an object/);
});

// ---------------------------------------------------------------------------
// canWrite — the merge gate
// ---------------------------------------------------------------------------

test("canWrite allows any source on a fresh field", () => {
  const brief = {};
  for (const src of Object.values(SOURCES)) {
    assert.equal(canWrite(brief, "foo", { setBy: src }), true, `expected ${src} to write`);
  }
});

test("canWrite blocks non-user writes after a user edit", () => {
  const brief = {};
  setProvenance(brief, "instructions", SOURCES.USER);
  for (const src of ["wizard", "chat", "inference", "research", "enrichment", "upload"]) {
    assert.equal(canWrite(brief, "instructions", { setBy: src }), false,
      `expected ${src} to be blocked`);
  }
  assert.equal(canWrite(brief, "instructions", { setBy: SOURCES.USER }), true,
    "user should always be allowed");
});

test("canWrite with forceRefresh overrides user edit protection", () => {
  const brief = {};
  setProvenance(brief, "instructions", SOURCES.USER);
  assert.equal(
    canWrite(brief, "instructions", { setBy: SOURCES.RESEARCH, forceRefresh: true }),
    true,
  );
});

test("canWrite rejects unknown sources", () => {
  assert.throws(() => canWrite({}, "x", { setBy: "bogus" }), /unknown source/);
});

// ---------------------------------------------------------------------------
// mergeProvenance — used by enrichment.js mergeToBrief
// ---------------------------------------------------------------------------

test("mergeProvenance applies patch entries over non-user ones", () => {
  const brief = {};
  setProvenance(brief, "instructions", SOURCES.WIZARD);

  const patch = {
    instructions: { lastSetBy: SOURCES.RESEARCH, lastSetAt: "2026-05-01T00:00:00Z", sourceFiles: ["sdr.md"] },
    evalSets:     { lastSetBy: SOURCES.RESEARCH, lastSetAt: "2026-05-01T00:00:00Z", sourceFiles: [] },
  };
  const result = mergeProvenance(brief, patch);

  assert.deepEqual(new Set(result.applied), new Set(["instructions", "evalSets"]));
  assert.deepEqual(result.rejected, []);
  assert.equal(getProvenance(brief, "instructions").lastSetBy, "research");
  assert.equal(getProvenance(brief, "instructions").lastSetAt, "2026-05-01T00:00:00Z");
  assert.deepEqual(getProvenance(brief, "instructions").sourceFiles, ["sdr.md"]);
});

test("mergeProvenance protects user-edited fields by default", () => {
  const brief = {};
  setProvenance(brief, "instructions", SOURCES.USER);

  const patch = {
    instructions: { lastSetBy: SOURCES.RESEARCH, lastSetAt: "2026-05-01T00:00:00Z", sourceFiles: [] },
  };
  const result = mergeProvenance(brief, patch);
  assert.deepEqual(result.applied, []);
  assert.equal(result.rejected[0].field, "instructions");
  assert.equal(result.rejected[0].reason, "protected-user-edit");
  assert.equal(getProvenance(brief, "instructions").lastSetBy, "user");
});

test("mergeProvenance with forceRefresh overwrites user-edited fields", () => {
  const brief = {};
  setProvenance(brief, "instructions", SOURCES.USER);

  const patch = {
    instructions: { lastSetBy: SOURCES.RESEARCH, lastSetAt: "2026-05-01T00:00:00Z", sourceFiles: [] },
  };
  const result = mergeProvenance(brief, patch, { forceRefresh: true });
  assert.deepEqual(result.applied, ["instructions"]);
  assert.equal(getProvenance(brief, "instructions").lastSetBy, "research");
});

test("mergeProvenance reports rejected records instead of silently dropping", () => {
  const brief = {};
  const result = mergeProvenance(brief, {
    a: { lastSetBy: "bogus",         lastSetAt: "t" },
    b: { lastSetBy: SOURCES.RESEARCH                 },  // missing lastSetAt
    c: { lastSetBy: SOURCES.RESEARCH, lastSetAt: "t", confidence: "extreme" },
    d: null,
    e: { lastSetBy: SOURCES.RESEARCH, lastSetAt: "t", sourceFiles: [] },
  });
  const rejByField = Object.fromEntries(result.rejected.map(r => [r.field, r.reason]));
  assert.equal(rejByField.a, "unknown-source:bogus");
  assert.equal(rejByField.b, "missing-lastSetAt");
  assert.equal(rejByField.c, "invalid-confidence:extreme");
  assert.equal(rejByField.d, "record-not-object");
  assert.deepEqual(result.applied, ["e"]);
});

test("mergeProvenance is a no-op on null/undefined patches", () => {
  const brief = { _provenance: { x: { lastSetBy: "user", lastSetAt: "t", sourceFiles: [] } } };
  const before = JSON.stringify(brief);
  const r1 = mergeProvenance(brief, null);
  const r2 = mergeProvenance(brief, undefined);
  assert.equal(JSON.stringify(brief), before, "brief must not change on null/undefined patch");
  assert.deepEqual(r1, { applied: [], rejected: [] });
  assert.deepEqual(r2, { applied: [], rejected: [] });
});

test("mergeProvenance rejects invalid brief", () => {
  assert.throws(() => mergeProvenance(null, { a: { lastSetBy: SOURCES.USER, lastSetAt: "t" } }),
    /must be an object/);
});

test("setProvenance rejects invalid confidence values", () => {
  assert.throws(() => setProvenance({}, "x", SOURCES.USER, { confidence: "extreme" }),
    /confidence must be high\|medium\|low/);
});

test("canWrite accepts missing opts param defensively", () => {
  assert.throws(() => canWrite({}, "x", null), /unknown source/);
  assert.throws(() => canWrite({}, "x"),       /unknown source/);
});

// ---------------------------------------------------------------------------
// fieldsWithProvenance
// ---------------------------------------------------------------------------

test("fieldsWithProvenance lists all tracked fields", () => {
  const brief = {};
  setProvenance(brief, "a", SOURCES.WIZARD);
  setProvenance(brief, "b", SOURCES.RESEARCH);
  assert.deepEqual(new Set(fieldsWithProvenance(brief)), new Set(["a", "b"]));
});

// ---------------------------------------------------------------------------
// Golden fixtures — the expected shape for each origin
// ---------------------------------------------------------------------------

test("golden fixture: wizard-origin brief", () => {
  // Matches what app/lib/wizard.js handleWizardSave produces today
  const brief = {
    agent: { name: "HR Policy Agent" },
    capabilities: [{ name: "Answer policy questions" }],
    audience: "employees",
    agentType: "CA",
    type: "agent",
  };
  setProvenance(brief, "capabilities", SOURCES.WIZARD);
  setProvenance(brief, "audience", SOURCES.INFERENCE, { confidence: "high", reason: "employee-facing language" });
  setProvenance(brief, "agentType", SOURCES.INFERENCE, { confidence: "high" });
  setProvenance(brief, "type", SOURCES.INFERENCE, { confidence: "high" });

  assert.equal(getProvenance(brief, "capabilities").lastSetBy, "wizard");
  assert.equal(getProvenance(brief, "audience").lastSetBy, "inference");
  assert.equal(getProvenance(brief, "audience").confidence, "high");
  // A wizard-origin brief should NOT yet have research-tracked fields
  assert.equal(getProvenance(brief, "evalSets"), null);
  assert.equal(getProvenance(brief, "instructions"), null);
});

test("golden fixture: research-origin brief has the deep-generation fields", () => {
  const brief = {};
  setProvenance(brief, "instructions",  SOURCES.RESEARCH, { sourceFiles: ["sdr.md"] });
  setProvenance(brief, "evalSets",      SOURCES.RESEARCH, { sourceFiles: ["sdr.md"] });
  setProvenance(brief, "capabilities",  SOURCES.RESEARCH, { sourceFiles: ["sdr.md", "transcripts.md"] });
  setProvenance(brief, "integrations",  SOURCES.RESEARCH, { sourceFiles: ["sdr.md"] });
  setProvenance(brief, "architecture",  SOURCES.RESEARCH);

  const tracked = new Set(fieldsWithProvenance(brief));
  for (const expected of ["instructions", "evalSets", "capabilities", "integrations", "architecture"]) {
    assert.ok(tracked.has(expected), `expected research brief to track ${expected}`);
  }
});

test("golden fixture: mixed wizard + research brief survives merge without user-edit loss", () => {
  // Start from a wizard save
  const brief = {
    capabilities: [{ name: "A" }],
    instructions: "Be helpful.",
  };
  setProvenance(brief, "capabilities", SOURCES.WIZARD);
  setProvenance(brief, "instructions", SOURCES.USER);   // user hand-edited instructions

  // Research completes, tries to overwrite both
  const researchPatch = {
    capabilities: { lastSetBy: SOURCES.RESEARCH, lastSetAt: new Date().toISOString(), sourceFiles: ["sdr.md"] },
    instructions: { lastSetBy: SOURCES.RESEARCH, lastSetAt: new Date().toISOString(), sourceFiles: ["sdr.md"] },
  };

  // capabilities: not user-edited → research write should be allowed
  assert.equal(canWrite(brief, "capabilities", { setBy: SOURCES.RESEARCH }), true);
  // instructions: user-edited → research write should be blocked unless forceRefresh
  assert.equal(canWrite(brief, "instructions", { setBy: SOURCES.RESEARCH }), false);
  assert.equal(canWrite(brief, "instructions", { setBy: SOURCES.RESEARCH, forceRefresh: true }), true);

  // The hardened mergeProvenance handles this automatically — apply whole patch,
  // user-edited fields are rejected, non-user fields are applied.
  const result = mergeProvenance(brief, researchPatch);
  assert.deepEqual(result.applied, ["capabilities"]);
  assert.equal(result.rejected[0].field, "instructions");
  assert.equal(result.rejected[0].reason, "protected-user-edit");
  assert.equal(getProvenance(brief, "capabilities").lastSetBy, "research");
  assert.equal(getProvenance(brief, "instructions").lastSetBy, "user", "user edit must survive");
});

// ---------------------------------------------------------------------------
// Compatibility with existing enrichment.js shape
// ---------------------------------------------------------------------------

test("compat: existing enrichment.js provenance records are readable by the new API", () => {
  // This shape comes straight from enrichment.js line 128-134
  const brief = {
    _provenance: {
      instructions: {
        lastSetBy: "enrichment",
        lastSetAt: "2026-04-16T12:00:00Z",
        sourceFiles: ["sdr.md"],
      },
    },
  };
  assert.equal(getProvenance(brief, "instructions").lastSetBy, "enrichment");
  assert.equal(isUserEdited(brief, "instructions"), false);
  assert.equal(canWrite(brief, "instructions", { setBy: SOURCES.RESEARCH }), true);
});

// ---------------------------------------------------------------------------
// applyUserPatch — the /state endpoint gate
// ---------------------------------------------------------------------------

const { applyUserPatch } = require("../provenance");

test("applyUserPatch stamps user provenance on changed top-level fields", () => {
  const existing = { instructions: "old", agent: { name: "X" } };
  setProvenance(existing, "instructions", SOURCES.ENRICHMENT);

  const result = applyUserPatch(existing, { instructions: "new" });
  assert.deepEqual(result.changed, ["instructions"]);
  assert.deepEqual(result.ignored, []);
  assert.equal(existing.instructions, "new");
  assert.equal(getProvenance(existing, "instructions").lastSetBy, "user");
});

test("applyUserPatch leaves unchanged fields' provenance alone", () => {
  const existing = { instructions: "same", agent: { name: "X" } };
  setProvenance(existing, "instructions", SOURCES.ENRICHMENT);
  const stampBefore = getProvenance(existing, "instructions").lastSetAt;

  const result = applyUserPatch(existing, { instructions: "same" });
  assert.deepEqual(result.changed, []);
  assert.equal(getProvenance(existing, "instructions").lastSetAt, stampBefore);
  assert.equal(getProvenance(existing, "instructions").lastSetBy, "enrichment");
});

test("applyUserPatch detects deep changes inside objects", () => {
  const existing = { agent: { name: "Old", description: "x" } };
  const result = applyUserPatch(existing, { agent: { name: "New", description: "x" } });
  assert.deepEqual(result.changed, ["agent"]);
  assert.equal(existing.agent.name, "New");
  assert.equal(getProvenance(existing, "agent").lastSetBy, "user");
});

test("applyUserPatch detects array content changes", () => {
  const existing = { capabilities: [{ name: "A" }, { name: "B" }] };
  const result = applyUserPatch(existing, {
    capabilities: [{ name: "A" }, { name: "B-edited" }],
  });
  assert.deepEqual(result.changed, ["capabilities"]);
  assert.equal(getProvenance(existing, "capabilities").lastSetBy, "user");
});

test("applyUserPatch strips client-supplied _provenance", () => {
  const existing = { instructions: "old" };
  setProvenance(existing, "instructions", SOURCES.ENRICHMENT);

  const result = applyUserPatch(existing, {
    _provenance: {
      instructions: { lastSetBy: "research", lastSetAt: "spoofed", sourceFiles: [] },
    },
    instructions: "new",
  });
  // _provenance from the client is ignored
  assert.ok(result.ignored.includes("_provenance"));
  // The actual change is still stamped as user
  assert.equal(getProvenance(existing, "instructions").lastSetBy, "user");
});

test("applyUserPatch ignores updated_at", () => {
  const existing = { instructions: "old" };
  const result = applyUserPatch(existing, {
    updated_at: "2026-01-01T00:00:00Z",
    instructions: "new",
  });
  assert.ok(result.ignored.includes("updated_at"));
  assert.deepEqual(result.changed, ["instructions"]);
});

test("applyUserPatch handles null/undefined patch gracefully", () => {
  const existing = { x: 1 };
  assert.deepEqual(applyUserPatch(existing, null),      { changed: [], ignored: [] });
  assert.deepEqual(applyUserPatch(existing, undefined), { changed: [], ignored: [] });
  assert.deepEqual(applyUserPatch(existing, "string"),  { changed: [], ignored: [] });
  assert.equal(existing.x, 1);
});

test("applyUserPatch rejects invalid existing spec", () => {
  assert.throws(() => applyUserPatch(null, { x: 1 }), /must be an object/);
});

test("applyUserPatch deep-merges partial object patches and preserves siblings", () => {
  const existing = {
    agent: {
      name:          "Old Name",
      description:   "Old Description",
      persona:       "professional",
      responseFormat: "bullets",
    },
  };
  const result = applyUserPatch(existing, { agent: { name: "New Name" } });
  assert.deepEqual(result.changed, ["agent"]);
  assert.equal(existing.agent.name,           "New Name");
  assert.equal(existing.agent.description,    "Old Description", "siblings survive partial patch");
  assert.equal(existing.agent.persona,        "professional");
  assert.equal(existing.agent.responseFormat, "bullets");
  assert.equal(getProvenance(existing, "agent").lastSetBy, "user");
});

test("applyUserPatch deep-merge handles nested objects recursively", () => {
  const existing = {
    architecture: {
      triggers:  [{ type: "onMessage" }],
      channels:  [{ name: "teams" }],
      settings:  { timeout: 30, retries: 3 },
    },
  };
  applyUserPatch(existing, {
    architecture: { settings: { timeout: 60 } },
  });
  assert.deepEqual(existing.architecture.triggers, [{ type: "onMessage" }], "outer array preserved");
  assert.deepEqual(existing.architecture.channels, [{ name: "teams" }]);
  assert.equal(existing.architecture.settings.timeout, 60,  "nested value updated");
  assert.equal(existing.architecture.settings.retries, 3,   "nested sibling preserved");
});

test("applyUserPatch still full-replaces arrays", () => {
  const existing = { capabilities: [{ name: "A" }, { name: "B" }, { name: "C" }] };
  applyUserPatch(existing, { capabilities: [{ name: "A" }] });
  assert.deepEqual(existing.capabilities, [{ name: "A" }]);
});

test("applyUserPatch full-replaces when types differ (object → array)", () => {
  const existing = { field: { a: 1 } };
  applyUserPatch(existing, { field: [1, 2, 3] });
  assert.deepEqual(existing.field, [1, 2, 3]);
});

test("applyUserPatch full-replaces when types differ (array → object)", () => {
  const existing = { field: [1, 2] };
  applyUserPatch(existing, { field: { a: 1 } });
  assert.deepEqual(existing.field, { a: 1 });
});

test("applyUserPatch full-replaces when incoming is null (explicit clear)", () => {
  const existing = { agent: { name: "X" } };
  applyUserPatch(existing, { agent: null });
  assert.equal(existing.agent, null);
});

test("applyUserPatch rejects __proto__, constructor, prototype at top level", () => {
  const existing = { safe: 1 };
  // JSON.parse is the real attack vector — an object literal with __proto__
  // sets the prototype rather than creating an own property. A request body
  // parsed from JSON creates own properties for these names.
  const hostile = JSON.parse('{"__proto__": {"polluted": true}, "constructor": {"polluted": true}, "prototype": {"polluted": true}, "safe": 2}');
  const result = applyUserPatch(existing, hostile);
  assert.deepEqual(result.changed, ["safe"]);
  assert.ok(result.ignored.includes("__proto__"));
  assert.ok(result.ignored.includes("constructor"));
  assert.ok(result.ignored.includes("prototype"));
  // Pollution must not reach Object.prototype or the existing spec
  assert.equal(({}).polluted, undefined);
  assert.equal(existing.polluted, undefined);
});

test("applyUserPatch rejects __proto__ at nested levels", () => {
  const existing = { agent: { name: "X" } };
  const hostile = JSON.parse('{"agent": {"name": "Y", "__proto__": {"polluted": true}, "constructor": {"polluted": true}}}');
  applyUserPatch(existing, hostile);
  assert.equal(existing.agent.name, "Y");
  assert.equal(existing.agent.polluted, undefined);
  assert.equal(({}).polluted, undefined);
});

test("applyUserPatch rejects array-shaped patches at the top level", () => {
  const existing = { x: 1 };
  const result = applyUserPatch(existing, [1, 2, 3]);
  assert.deepEqual(result, { changed: [], ignored: [] });
  assert.equal(existing.x, 1);
});

test("applyUserPatch deep-merge does not bump provenance on no-op merges", () => {
  const existing = {
    agent: { name: "Same", description: "Same" },
  };
  setProvenance(existing, "agent", SOURCES.ENRICHMENT);
  const stampBefore = getProvenance(existing, "agent").lastSetAt;

  const result = applyUserPatch(existing, { agent: { name: "Same" } });
  assert.deepEqual(result.changed, []);
  assert.equal(getProvenance(existing, "agent").lastSetBy, "enrichment",
    "no-op deep-merge must not flip provenance to user");
  assert.equal(getProvenance(existing, "agent").lastSetAt, stampBefore);
});

test("applyUserPatch round-trip: enrichment write, then user edit, then enrichment retry, user survives", () => {
  // 1. Enrichment writes
  const brief = { instructions: "auto-generated text" };
  setProvenance(brief, "instructions", SOURCES.ENRICHMENT);
  assert.equal(isUserEdited(brief, "instructions"), false);

  // 2. User edits via /state endpoint
  applyUserPatch(brief, { instructions: "user-edited text" });
  assert.equal(isUserEdited(brief, "instructions"), true);

  // 3. Enrichment tries to overwrite — canWrite gate blocks it
  assert.equal(canWrite(brief, "instructions", { setBy: SOURCES.ENRICHMENT }), false);

  // 4. mergeProvenance respects the gate too
  const patch = {
    instructions: { lastSetBy: SOURCES.ENRICHMENT, lastSetAt: "t", sourceFiles: [] },
  };
  const mergeResult = mergeProvenance(brief, patch);
  assert.equal(mergeResult.rejected[0].reason, "protected-user-edit");
  assert.equal(getProvenance(brief, "instructions").lastSetBy, "user");
});

test("compat: frontend inference check pattern still works", () => {
  // Pattern from AgentContext.tsx line 1117-1119
  const brief = {};
  setProvenance(brief, "audience",  SOURCES.INFERENCE);
  setProvenance(brief, "agentType", SOURCES.INFERENCE);
  setProvenance(brief, "type",      SOURCES.INFERENCE);

  const fromInference =
    brief._provenance.audience?.lastSetBy === "inference" ||
    brief._provenance.agentType?.lastSetBy === "inference" ||
    brief._provenance.type?.lastSetBy === "inference";
  assert.equal(fromInference, true);
});
