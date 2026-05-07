const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8"));

test("contract: response has OData collection envelope", () => {
  assert.equal(fixture.response.status, 200);
  assert.ok(Array.isArray(fixture.response.body.value));
});

test("contract: empty result is NOT an error (value: [], still 200)", () => {
  assert.equal(fixture.emptyCase.response.status, 200);
  assert.deepEqual(fixture.emptyCase.response.body.value, []);
});

test("contract: URL uses $filter + $select parameters", () => {
  assert.match(fixture.request.url, /\$filter=/);
  assert.match(fixture.request.url, /\$select=botid/);
});

test("contract: fixture is sanitized", () => {
  const raw = fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8");
  assert.equal(/Bearer\s+[A-Za-z0-9\-_.]{20,}/.test(raw), false);
  assert.equal(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(raw), false);
});
