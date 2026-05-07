/**
 * Static parity test for pva-publish contract.
 *
 * Strategy: bound action with no payload. Assertions:
 *   - request body is exactly {} (not null, not missing)
 *   - URL pattern matches Dataverse bound action format
 *   - success response is HTTP 204
 *   - error response is OData error envelope
 *
 * Run: node --test tools/upstream-specs/contracts/pva-publish/parity.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8"));

test("contract: request body is exactly {}", () => {
  assert.deepEqual(fixture.request.body, {}, "PvaPublish body MUST be {} — not null, not missing, not populated");
});

test("contract: URL uses bound-action format", () => {
  assert.match(fixture.request.url, /\/bots\([^)]+\)\/Microsoft\.Dynamics\.CRM\.PvaPublish/);
});

test("contract: success response is HTTP 204", () => {
  assert.equal(fixture.response.status, 204);
  assert.equal(fixture.response.body, null);
});

test("contract: error response has OData error envelope", () => {
  const err = fixture.errorCase.response;
  assert.ok(err.status >= 400);
  assert.ok(err.body.error);
  assert.ok(typeof err.body.error.code === "string");
  assert.ok(typeof err.body.error.message === "string");
});

test("contract: fixture is sanitized", () => {
  const raw = fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8");
  assert.equal(/Bearer\s+[A-Za-z0-9\-_.]{20,}/.test(raw), false);
  assert.equal(/eyJ[A-Za-z0-9\-_]{10,}\.eyJ[A-Za-z0-9\-_]{10,}\./.test(raw), false);
  assert.equal(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(raw), false);
});
