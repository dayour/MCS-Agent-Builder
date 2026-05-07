const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8"));

test("contract: URL uses Island Gateway botmanagement path", () => {
  assert.match(fixture.request.url, /\/api\/botmanagement\/v1\/environments\/[^/]+\/bots\/[^/]+\/settings$/);
});

test("contract: response is 200 with object body", () => {
  assert.equal(fixture.response.status, 200);
  assert.equal(typeof fixture.response.body, "object");
});

test("contract: makerEvaluationEnabled field is boolean (when present)", () => {
  const v = fixture.response.body.makerEvaluationEnabled;
  assert.ok(v === undefined || typeof v === "boolean");
});

test("contract: fixture is sanitized", () => {
  const raw = fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8");
  assert.equal(/Bearer\s+[A-Za-z0-9\-_.]{20,}/.test(raw), false);
  assert.equal(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(raw), false);
});
