/**
 * Unit tests for eval-gate-flags (feature-flag rollout + viewer visibility).
 * Run: node --test app/lib/__tests__/eval-gate-flags.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Redirect flag file to tmp for test isolation
const TMP_FLAGS = path.join(os.tmpdir(), `eval-gate-flags-test-${Date.now()}.json`);
process.env.EVAL_GATE_FLAGS = TMP_FLAGS;

const { shouldEnforce, filterEvalGateForViewer, loadFlags, DEFAULT_FLAGS } = require("../eval-gate-flags");

function setFlags(obj) { fs.writeFileSync(TMP_FLAGS, JSON.stringify(obj)); }
function clearFlags() { try { fs.unlinkSync(TMP_FLAGS); } catch {} }

test("no flag file → enforce=true by default", () => {
  clearFlags();
  const r = shouldEnforce({});
  assert.equal(r.enforce, true);
  assert.match(r.reason, /default enforce/);
});

test("master kill switch: enabled=false → enforce=false", () => {
  setFlags({ enabled: false });
  const r = shouldEnforce({ tenantId: "t1", envId: "e1" });
  assert.equal(r.enforce, false);
  assert.match(r.reason, /global kill switch/);
  clearFlags();
});

test("tenant override wins over default", () => {
  setFlags({ enabled: true, tenants: { "tenant-A": false, "tenant-B": true } });
  assert.equal(shouldEnforce({ tenantId: "tenant-A" }).enforce, false);
  assert.equal(shouldEnforce({ tenantId: "tenant-B" }).enforce, true);
  assert.equal(shouldEnforce({ tenantId: "tenant-unknown" }).enforce, true);  // default enforce
  clearFlags();
});

test("environment override wins over risk tier", () => {
  setFlags({ enabled: true, environments: { "env-demo": false }, riskTiers: { demo: true, internal: true, production: true } });
  const r = shouldEnforce({ envId: "env-demo", riskTier: "demo" });
  assert.equal(r.enforce, false);
  assert.match(r.reason, /environment/);
  clearFlags();
});

test("riskTier=demo can be disabled while internal/production stay on", () => {
  setFlags({ enabled: true, riskTiers: { demo: false, internal: true, production: true } });
  assert.equal(shouldEnforce({ riskTier: "demo" }).enforce, false);
  assert.equal(shouldEnforce({ riskTier: "internal" }).enforce, true);
  assert.equal(shouldEnforce({ riskTier: "production" }).enforce, true);
  clearFlags();
});

test("filterEvalGateForViewer: 'all' visibility returns full record", () => {
  setFlags({ visibility: "all" });
  const gate = { verdict: "SHIP", overrideApprovedBy: "Jane", overrideTicketRef: "T1" };
  const filtered = filterEvalGateForViewer(gate, "anonymous");
  assert.equal(filtered.overrideApprovedBy, "Jane");
  clearFlags();
});

test("filterEvalGateForViewer: 'maker' hides override details from anonymous", () => {
  setFlags({ visibility: "maker" });
  const gate = { verdict: "SHIP", overrideApprovedBy: "Jane", overrideReason: "demo", overrideTicketRef: "T1" };
  const filtered = filterEvalGateForViewer(gate, "anonymous");
  assert.equal(filtered.overrideApprovedBy, undefined);
  assert.equal(filtered.overrideReason, undefined);
  assert.equal(filtered.verdict, "SHIP");  // non-sensitive fields preserved
  clearFlags();
});

test("filterEvalGateForViewer: 'maker' keeps full detail for maker role", () => {
  setFlags({ visibility: "maker" });
  const gate = { verdict: "SHIP", overrideApprovedBy: "Jane" };
  const filtered = filterEvalGateForViewer(gate, "maker");
  assert.equal(filtered.overrideApprovedBy, "Jane");
  clearFlags();
});

test("filterEvalGateForViewer: 'admin' hides override from maker, shows to admin", () => {
  setFlags({ visibility: "admin" });
  const gate = { verdict: "SHIP", overrideApprovedBy: "Jane", provenance: { buildSha: "abc" } };
  const maker = filterEvalGateForViewer(gate, "maker");
  assert.equal(maker.overrideApprovedBy, undefined);
  assert.equal(maker.provenance, undefined);
  const admin = filterEvalGateForViewer(gate, "admin");
  assert.equal(admin.overrideApprovedBy, "Jane");
  assert.ok(admin.provenance);
  clearFlags();
});

test("filterEvalGateForViewer handles null gate gracefully", () => {
  assert.equal(filterEvalGateForViewer(null, "maker"), null);
  assert.equal(filterEvalGateForViewer(undefined, "maker"), undefined);
});
