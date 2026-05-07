const test = require("node:test");
const assert = require("node:assert/strict");

const { SOURCES } = require("../provenance");
const { generateEvalStubs, buildStubSets } = require("../generators/evals");

function makeBrief(overrides = {}) {
  return {
    agent: { name: "HR Policy Assistant" },
    capabilities: [
      { name: "Answer policy questions", description: "Look up", phase: "mvp" },
      { name: "Escalate cases",          description: "Route",   phase: "mvp" },
    ],
    ...overrides,
  };
}

test("buildStubSets produces the three canonical sets", () => {
  const sets = buildStubSets(makeBrief());
  assert.deepEqual(sets.map((s) => s.name), ["boundaries", "quality", "edge-cases"]);
});

test("buildStubSets thresholds match the published contract", () => {
  const sets = buildStubSets(makeBrief());
  const byName = Object.fromEntries(sets.map((s) => [s.name, s]));
  assert.equal(byName.boundaries.passThreshold, 95);
  assert.equal(byName.quality.passThreshold,    85);
  assert.equal(byName["edge-cases"].passThreshold, 70);
});

test("buildStubSets derives quality tests from first 5 capabilities", () => {
  const caps = Array.from({ length: 8 }, (_, i) => ({ name: `Cap ${i}`, phase: "mvp" }));
  const sets = buildStubSets(makeBrief({ capabilities: caps }));
  const quality = sets.find((s) => s.name === "quality");
  assert.equal(quality.tests.length, 5);
  assert.ok(quality.tests[0].question.includes("cap 0"));
});

test("buildStubSets tolerates malformed capabilities", () => {
  const sets = buildStubSets(makeBrief({ capabilities: [null, "string", { phase: "mvp" }, { name: "Good", phase: "mvp" }] }));
  const quality = sets.find((s) => s.name === "quality");
  assert.equal(quality.tests.length, 1);
  assert.equal(quality.tests[0].capability, "Good");
});

test("generateEvalStubs returns evalSets + meta + provenance", async () => {
  const r = await generateEvalStubs({
    brief: makeBrief(),
    setBy: SOURCES.ENRICHMENT,
    sourceFiles: ["sdr.md"],
  });
  assert.equal(r.evalSets.length, 3);
  assert.equal(r.meta.setCount, 3);
  assert.ok(r.meta.totalTests > 0);
  assert.equal(r.provenance.lastSetBy, "enrichment");
  assert.deepEqual(r.provenance.sourceFiles, ["sdr.md"]);
});

test("generateEvalStubs rejects invalid inputs", async () => {
  await assert.rejects(generateEvalStubs({ setBy: SOURCES.ENRICHMENT }), /brief must be an object/);
  await assert.rejects(generateEvalStubs({ brief: makeBrief(), setBy: "bogus" }), /unknown setBy/);
});

test("parity: enrichment + research paths produce identical evalSets from the same brief", async () => {
  const brief = makeBrief();
  const a = await generateEvalStubs({ brief, setBy: SOURCES.ENRICHMENT });
  const b = await generateEvalStubs({ brief, setBy: SOURCES.RESEARCH });
  assert.deepEqual(a.evalSets, b.evalSets);
  assert.notEqual(a.provenance.lastSetBy, b.provenance.lastSetBy);
});
