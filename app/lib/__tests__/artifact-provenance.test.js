/**
 * Unit tests for artifact-provenance.
 * Run: node --test app/lib/__tests__/artifact-provenance.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { captureProvenance, diffProvenance, _internal } = require("../artifact-provenance");

test("captureProvenance returns all expected fields", () => {
  const brief = {
    agent: { name: "Test", model: "opus-4.6" },
    integrations: [{ name: "SharePoint", type: "connector" }],
    knowledge: [{ name: "Policy Docs", type: "SharePoint" }],
    evalSets: [{ name: "boundaries", tests: [{ question: "Q1", expected: "A1" }] }],
  };
  const p = captureProvenance(brief, "/tmp/agent");
  assert.ok(p.capturedAt);
  assert.ok("buildSha" in p);
  assert.ok("buildDirty" in p);
  assert.equal(p.specHash.length, 64, "specHash is SHA-256");
  assert.equal(p.toolSetHash.length, 64);
  assert.equal(p.evalSetHash.length, 64);
  assert.equal(p.model.agentModel, "opus-4.6");
  assert.equal(p.agentDir, "agent");
});

test("same brief produces same toolSetHash regardless of array order", () => {
  const a = { integrations: [{ name: "A" }, { name: "B" }], knowledge: [] };
  const b = { integrations: [{ name: "B" }, { name: "A" }], knowledge: [] };
  assert.equal(_internal.toolSetHash(a), _internal.toolSetHash(b));
});

test("toolSetHash changes when integration added", () => {
  const a = { integrations: [{ name: "A" }], knowledge: [] };
  const b = { integrations: [{ name: "A" }, { name: "B" }], knowledge: [] };
  assert.notEqual(_internal.toolSetHash(a), _internal.toolSetHash(b));
});

test("evalSetHash ignores lastResult (captures test DEFINITIONS, not measurements)", () => {
  const a = { evalSets: [{ name: "b", tests: [{ question: "Q", expected: "A" }] }] };
  const b = { evalSets: [{ name: "b", tests: [{ question: "Q", expected: "A", lastResult: { pass: true } }] }] };
  assert.equal(_internal.evalSetHash(a), _internal.evalSetHash(b));
});

test("evalSetHash changes when test question changes", () => {
  const a = { evalSets: [{ name: "b", tests: [{ question: "Q1", expected: "A" }] }] };
  const b = { evalSets: [{ name: "b", tests: [{ question: "Q2", expected: "A" }] }] };
  assert.notEqual(_internal.evalSetHash(a), _internal.evalSetHash(b));
});

test("diffProvenance returns empty for identical records", () => {
  const brief = { agent: { model: "opus-4.6" }, integrations: [{ name: "X" }], knowledge: [] };
  const a = captureProvenance(brief);
  const b = captureProvenance(brief);
  // capturedAt differs so filter it out
  const diffs = diffProvenance(a, b);
  assert.deepEqual(diffs, [], "identical brief yields no diffs (capturedAt is excluded)");
});

test("diffProvenance detects toolSet change between snapshots", () => {
  const p1 = { specHash: "abc", toolSetHash: "111", evalSetHash: "xyz" };
  const p2 = { specHash: "abc", toolSetHash: "222", evalSetHash: "xyz" };
  const diffs = diffProvenance(p1, p2);
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].field, "toolSetHash");
});

test("buildSha resolves (or returns null gracefully)", () => {
  const sha = _internal.tryGitSha();
  assert.ok(sha === null || (typeof sha === "string" && sha.length >= 7));
});
