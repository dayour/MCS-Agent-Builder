/**
 * Static parity test for dialogs-list contract.
 *
 * Run: node --test tools/upstream-specs/contracts/dialogs-list/parity.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8"));
const { _internal } = require("../../../island-client.js");

test("contract: response is HTTP 200", () => {
  assert.equal(fixture.response.status, 200);
});

test("contract: response body matches isPagedDialogsShape validator", () => {
  const ok = _internal.isPagedDialogsShape(fixture.response.body);
  assert.equal(ok, true, "captured response shape does not match isPagedDialogsShape — typed adapter validator is out of sync");
});

test("contract: empty value array is also valid (curated endpoint commonly returns 0)", () => {
  const ok = _internal.isPagedDialogsShape({ value: [] });
  assert.equal(ok, true);
});

test("contract: shape-fixture.json was sanitized (no obvious secrets/PII)", () => {
  const raw = fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8");
  assert.equal(/Bearer\s+[A-Za-z0-9\-_.]{20,}/.test(raw), false);
  assert.equal(/eyJ[A-Za-z0-9\-_]{10,}\.eyJ[A-Za-z0-9\-_]{10,}\./.test(raw), false);
  assert.equal(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(raw), false);
  assert.equal(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(raw), false);
});
