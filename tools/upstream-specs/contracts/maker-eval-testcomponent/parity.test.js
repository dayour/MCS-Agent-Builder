/**
 * Static parity test for maker-eval-testcomponent contract.
 *
 * Loads the sanitized fixture and asserts:
 *   - response body shape matches the typed adapter's validator
 *   - request body has all $kind discriminators required by the contract
 *
 * NO network calls in static mode. For live verification, set
 * CONTRACT_PARITY_LIVE=1 (live mode is hand-rolled — see runbook for the
 * full Add/Get/Delete cycle against a throwaway bot).
 *
 * Run: node --test tools/upstream-specs/contracts/maker-eval-testcomponent/parity.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8"));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, "contract.json"), "utf8"));
const { _internal } = require("../../../island-client.js");

test("contract: response body matches typed adapter validator", () => {
  const ok = _internal.isUpdateTestComponentsResponseShape(fixture.response.body);
  assert.equal(ok, true, "captured response shape does not match isUpdateTestComponentsResponseShape — typed adapter is out of sync with HAR");
});

test("contract: response is HTTP 200", () => {
  assert.equal(fixture.response.status, 200);
});

test("contract: every kindDiscriminator path resolves to its declared value", () => {
  for (const d of contract.kindDiscriminators) {
    // Walk JSONPath-lite: $.testComponents[*].$kind  -> for each item, check $kind
    const segs = d.path.replace(/^\$\./, "").split(".");
    let nodes = [fixture.request.body];
    for (const seg of segs) {
      const m = seg.match(/^([^\[]+)(\[\*\])?$/);
      if (!m) throw new Error(`Bad path segment: ${seg}`);
      const key = m[1];
      const isArr = !!m[2];
      const next = [];
      for (const n of nodes) {
        if (n == null) continue;
        const v = n[key];
        if (isArr && Array.isArray(v)) next.push(...v);
        else if (!isArr) next.push(v);
      }
      nodes = next;
    }
    assert.ok(nodes.length > 0, `path ${d.path} resolved to nothing in fixture`);
    for (const v of nodes) {
      assert.equal(v, d.value, `kindDiscriminator at ${d.path} expected '${d.value}', got '${v}'`);
    }
  }
});

test("contract: required fields present and valid", () => {
  const tc = fixture.request.body.testComponents[0];
  assert.ok(["Add", "Update", "Delete"].includes(tc.operationType), "operationType must be Add|Update|Delete");
  assert.equal(tc.component.category, "Testing", "component.category must be 'Testing'");
  assert.equal(tc.component.state, "Active", "component.state must be 'Active'");
  assert.ok(Array.isArray(tc.component.definition.graders) && tc.component.definition.graders.length > 0,
    "graders must be non-empty array");
});

test("contract: shape-fixture.json was sanitized (no obvious secrets/PII)", () => {
  const raw = fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8");
  // Reject Bearer tokens, JWTs, real GUIDs (no <placeholder>), email-shaped strings
  assert.equal(/Bearer\s+[A-Za-z0-9\-_.]{20,}/.test(raw), false, "fixture contains Bearer token");
  assert.equal(/eyJ[A-Za-z0-9\-_]{10,}\.eyJ[A-Za-z0-9\-_]{10,}\./.test(raw), false, "fixture contains JWT");
  assert.equal(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(raw), false, "fixture contains unredacted GUID — replace with <placeholder>");
  assert.equal(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(raw), false, "fixture contains email-shaped string");
});

test("live POST round-trip", { skip: !process.env.CONTRACT_PARITY_LIVE }, async () => {
  // Live mode requires: az login, target bot ID + envId in env vars,
  // running maker-eval enabled bot. Manual gate — see runbook.
  // (Implementation deliberately omitted in static parity scaffold.)
  assert.fail("live mode requires hand-implementation against throwaway bot — see tools/upstream-specs/maker-eval-write.md");
});
