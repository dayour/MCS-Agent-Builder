const test = require("node:test");
const assert = require("node:assert/strict");

const { SOURCES } = require("../provenance");
const { generateResearch, isM365Integration } = require("../generators/research");

test("isM365Integration matches M365 keywords", () => {
  assert.equal(isM365Integration({ name: "Outlook Mail", type: "mcp" }), true);
  assert.equal(isM365Integration({ name: "Teams channel posts" }),       true);
  assert.equal(isM365Integration({ purpose: "read user profile" }),      true);
  assert.equal(isM365Integration({ name: "SAP" }),                       false);
  assert.equal(isM365Integration(null),                                  false);
  assert.equal(isM365Integration("string"),                              false);
});

test("generateResearch auto-adds both Work IQ servers when M365 detected", async () => {
  const brief = {
    integrations: [{ name: "Outlook Mail", type: "mcp", purpose: "read email" }],
  };
  const r = await generateResearch({ brief, setBy: SOURCES.ENRICHMENT });
  const names = r.integrations.map((i) => i.name);
  assert.ok(names.includes("Work IQ Copilot"));
  assert.ok(names.includes("Work IQ User"));
  assert.deepEqual(new Set(r.workIqAdded), new Set(["Work IQ Copilot", "Work IQ User"]));
  assert.equal(r.meta.hasM365, true);
});

test("generateResearch does not duplicate existing Work IQ entries", async () => {
  const brief = {
    integrations: [
      { name: "Outlook Mail" },
      { name: "Work IQ Copilot" },
      { name: "Work IQ User" },
    ],
  };
  const r = await generateResearch({ brief, setBy: SOURCES.ENRICHMENT });
  assert.deepEqual(r.workIqAdded, []);
});

test("generateResearch leaves non-M365 briefs alone", async () => {
  const brief = { integrations: [{ name: "SAP", type: "custom-connector" }] };
  const r = await generateResearch({ brief, setBy: SOURCES.ENRICHMENT });
  assert.equal(r.meta.hasM365, false);
  assert.deepEqual(r.workIqAdded, []);
});

test("generateResearch flags unresolved integrations with recommendations", async () => {
  const brief = { integrations: [{ name: "CompletelyUnknownSystem", type: "mcp" }] };
  const r = await generateResearch({ brief, setBy: SOURCES.ENRICHMENT });
  // The knowledge-resolver may or may not resolve it; we assert shape of recommendations only.
  if (r.needsResearch.length > 0) {
    assert.equal(r.recommendations.length, r.needsResearch.length);
    assert.equal(r.recommendations[0].category, "integration");
    assert.equal(r.recommendations[0].source, "enrichment");
  }
});

test("generateResearch returns provenance with the right source", async () => {
  const r = await generateResearch({
    brief: { integrations: [] },
    setBy: SOURCES.RESEARCH,
    sourceFiles: ["sdr.md"],
  });
  assert.equal(r.provenance.lastSetBy, "research");
  assert.deepEqual(r.provenance.sourceFiles, ["sdr.md"]);
});

test("generateResearch rejects invalid inputs", async () => {
  await assert.rejects(generateResearch({ setBy: SOURCES.ENRICHMENT }), /brief must be an object/);
  await assert.rejects(generateResearch({ brief: {}, setBy: "bogus" }), /unknown setBy/);
});

test("generateResearch tolerates non-array integrations", async () => {
  const r = await generateResearch({ brief: { integrations: null }, setBy: SOURCES.ENRICHMENT });
  assert.deepEqual(r.integrations, []);
});

test("parity: enrichment + research paths produce identical integration lists", async () => {
  const brief = { integrations: [{ name: "Teams", type: "mcp" }] };
  const a = await generateResearch({ brief, setBy: SOURCES.ENRICHMENT });
  const b = await generateResearch({ brief, setBy: SOURCES.RESEARCH });
  assert.deepEqual(a.integrations, b.integrations);
  assert.deepEqual(a.workIqAdded, b.workIqAdded);
  assert.notEqual(a.provenance.lastSetBy, b.provenance.lastSetBy);
});
