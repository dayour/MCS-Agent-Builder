/**
 * Static parity test for component-sync contract.
 *
 * Strategy: delta-envelope shape. Component content is intentionally opaque
 * in the fixture; we assert the envelope shape only.
 *
 * Run: node --test tools/upstream-specs/contracts/component-sync/parity.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8"));

test("contract: request envelope has componentDelta + componentDeltaToken", () => {
  const body = fixture.request.body;
  assert.ok("componentDelta" in body, "componentDelta key required");
  assert.ok("componentDeltaToken" in body, "componentDeltaToken key required (null for initial sync)");
});

test("contract: componentDelta is keyed by componentGuid and each entry has componentKind", () => {
  const delta = fixture.request.body.componentDelta;
  for (const [guid, comp] of Object.entries(delta)) {
    assert.ok(guid.length > 0);
    assert.ok(typeof comp.componentKind === "string", `componentDelta[${guid}].componentKind required`);
  }
});

test("contract: success response returns new deltaToken + components array", () => {
  assert.equal(fixture.response.status, 200);
  assert.ok(typeof fixture.response.body.componentDeltaToken === "string");
  assert.ok(Array.isArray(fixture.response.body.components));
});

test("contract: 409 error includes ConcurrencyVersionMismatch code", () => {
  const err = fixture.errorCase.response;
  assert.equal(err.status, 409);
  assert.equal(err.body.error.code, "ConcurrencyVersionMismatch");
});

test("contract: URL uses Island Gateway botmanagement path", () => {
  assert.match(fixture.request.url, /\/api\/botmanagement\/v1\/environments\/[^/]+\/bots\/[^/]+\/content\/botcomponents/);
});

test("contract: fixture is sanitized", () => {
  const raw = fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8");
  assert.equal(/Bearer\s+[A-Za-z0-9\-_.]{20,}/.test(raw), false);
  assert.equal(/eyJ[A-Za-z0-9\-_]{10,}\.eyJ[A-Za-z0-9\-_]{10,}\./.test(raw), false);
  assert.equal(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(raw), false);
});
