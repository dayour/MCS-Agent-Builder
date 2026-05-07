/**
 * Static parity test for bot-create contract.
 *
 * Strategy: targeted-fixture-coverage (NOT exact-parity). We verify:
 *   - all kindDiscriminators are present at their declared paths
 *   - all requiredFields constraints are satisfied on the success fixture
 *   - response is HTTP 201 with { botid: string }
 *   - fixture is sanitized (no real GUIDs, tokens, emails)
 *
 * We deliberately do NOT assert whole-payload byte equality because the
 * full BotConfiguration includes tenant-specific categories/channels and
 * iconbase64 that are non-contractual (see contract.json).
 *
 * Run: node --test tools/upstream-specs/contracts/bot-create/parity.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8"));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, "contract.json"), "utf8"));

function resolveJsonPath(root, jsonPath) {
  // JSONPath-lite: $, ., [*], ['key']. Keys may start with $ (e.g. $kind).
  const segments = jsonPath.replace(/^\$\.?/, "").match(/\$[\w-]*|[a-zA-Z_][\w-]*|\['[^']+'\]|\[\*\]/g) || [];
  let nodes = [root];
  for (const seg of segments) {
    const next = [];
    if (seg === "[*]") {
      for (const n of nodes) {
        if (Array.isArray(n)) next.push(...n);
      }
    } else if (seg.startsWith("['") && seg.endsWith("']")) {
      const key = seg.slice(2, -2);
      for (const n of nodes) if (n && typeof n === "object") next.push(n[key]);
    } else {
      for (const n of nodes) if (n && typeof n === "object") next.push(n[seg]);
    }
    nodes = next;
  }
  return nodes;
}

test("contract: response is HTTP 201 with botid guid", () => {
  assert.equal(fixture.response.status, 201);
  assert.ok(typeof fixture.response.body.botid === "string");
});

test("contract: every kindDiscriminator path resolves to its declared value", () => {
  for (const d of contract.kindDiscriminators) {
    const nodes = resolveJsonPath(fixture.request.body, d.path);
    assert.ok(nodes.length > 0, `path ${d.path} resolved to nothing`);
    for (const v of nodes) {
      assert.equal(v, d.value, `${d.path}: expected '${d.value}', got '${v}'`);
    }
  }
});

test("contract: all requiredFields present", () => {
  for (const f of contract.requiredFields) {
    const nodes = resolveJsonPath(fixture.request.body, f.path);
    assert.ok(nodes.length > 0 && nodes[0] !== undefined, `required ${f.path} missing — ${f.constraint}`);
  }
});

test("contract: settings.default-2.1.0.content has populated displayName + capabilities (catches the 2026-04-15 bug)", () => {
  const content = fixture.request.body.configuration.settings["default-2.1.0"].content;
  assert.ok(content.displayName && content.displayName.length > 0, "displayName required — missing it creates bot without GptComponent");
  assert.equal(content.capabilities.$kind, "GptCapabilities", "capabilities discriminator required");
});

test("contract: shape-fixture.json was sanitized (no obvious secrets/PII)", () => {
  const raw = fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8");
  assert.equal(/Bearer\s+[A-Za-z0-9\-_.]{20,}/.test(raw), false, "fixture contains Bearer token");
  assert.equal(/eyJ[A-Za-z0-9\-_]{10,}\.eyJ[A-Za-z0-9\-_]{10,}\./.test(raw), false, "fixture contains JWT");
  assert.equal(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(raw), false, "fixture contains unredacted GUID — replace with <placeholder>");
  assert.equal(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(raw), false, "fixture contains email-shaped string");
});

test("contract: documents non-contractual fields to prevent over-fitting", () => {
  assert.ok(Array.isArray(contract.nonContractualFields) && contract.nonContractualFields.length > 0,
    "contract MUST list non-contractual fields — prevents future parity tests from asserting on unstable values");
});

test("contract: documents at least one error case", () => {
  assert.ok(Array.isArray(contract.errorCases) && contract.errorCases.length >= 1);
});
