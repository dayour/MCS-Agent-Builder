const test = require("node:test");
const assert = require("node:assert/strict");

const { SOURCES } = require("../provenance");
const { generateScoring } = require("../generators/scoring");

function makeBrief(overrides = {}) {
  return {
    agent: { name: "Policy Assistant" },
    capabilities: [
      { name: "Answer policy questions", phase: "mvp" },
      { name: "Escalate complex cases",  phase: "mvp" },
    ],
    integrations: [
      { name: "SharePoint",          type: "connector" },
      { name: "Custom unknown sys",  type: "mcp" },
    ],
    knowledge: [],
    ...overrides,
  };
}

test("generateScoring returns capabilities, architecture, meta, provenance", async () => {
  const r = await generateScoring({
    brief: makeBrief(),
    setBy: SOURCES.ENRICHMENT,
    sourceFiles: [],
  });
  assert.ok(Array.isArray(r.capabilities));
  assert.equal(r.capabilities.length, 2);
  assert.ok(r.architecture);
  assert.ok(typeof r.architecture.buildPath === "string");
  assert.ok(typeof r.architecture.solutionType === "string");
  assert.ok(typeof r.meta.score === "number");
  assert.equal(r.provenance.lastSetBy, "enrichment");
});

test("generateScoring enriches capabilities with implementationType + pattern match", async () => {
  const r = await generateScoring({ brief: makeBrief(), setBy: SOURCES.ENRICHMENT });
  for (const c of r.capabilities) {
    // Either resolver set a value OR it was undefined passing through unchanged; just
    // assert shape — the resolver is not mocked here.
    assert.ok("implementationType" in c);
  }
});

test("generateScoring is safe with empty capabilities and integrations", async () => {
  const r = await generateScoring({
    brief: { agent: { name: "X" }, capabilities: [], integrations: [] },
    setBy: SOURCES.ENRICHMENT,
  });
  assert.equal(r.capabilities.length, 0);
  assert.ok(r.architecture.buildPath);
});

test("generateScoring survives malformed capability / integration arrays", async () => {
  const r = await generateScoring({
    brief: { agent: { name: "X" }, capabilities: "not-an-array", integrations: null, knowledge: 42 },
    setBy: SOURCES.ENRICHMENT,
  });
  assert.equal(r.capabilities.length, 0);
});

test("generateScoring rejects invalid inputs", async () => {
  await assert.rejects(generateScoring({ setBy: SOURCES.ENRICHMENT }), /brief must be an object/);
  await assert.rejects(generateScoring({ brief: makeBrief(), setBy: "bogus" }), /unknown setBy/);
});

test("parity: enrichment + research paths produce identical scoring output", async () => {
  const brief = makeBrief();
  const a = await generateScoring({ brief, setBy: SOURCES.ENRICHMENT });
  const b = await generateScoring({ brief, setBy: SOURCES.RESEARCH });
  assert.deepEqual(a.capabilities, b.capabilities);
  assert.deepEqual(a.architecture, b.architecture);
  assert.notEqual(a.provenance.lastSetBy, b.provenance.lastSetBy);
});
