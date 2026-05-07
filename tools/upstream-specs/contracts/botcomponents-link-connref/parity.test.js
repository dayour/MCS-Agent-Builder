const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8"));

test("contract: body has @odata.id full URL", () => {
  const bind = fixture.request.body["@odata.id"];
  assert.ok(bind.startsWith("<dataverseUrl>") || bind.startsWith("http"), "@odata.id must be absolute URL");
  assert.match(bind, /\/connectionreferences\([^)]+\)$/);
});

test("contract: URL uses $ref suffix on M:M nav", () => {
  assert.match(fixture.request.url, /\/botcomponents\([^)]+\)\/botcomponent_connectionreference\/\$ref$/);
});

test("contract: method is PUT", () => {
  assert.equal(fixture.request.method, "PUT");
});

test("contract: success is 204 No Content", () => {
  assert.equal(fixture.response.status, 204);
  assert.equal(fixture.response.body, null);
});

test("contract: fixture is sanitized", () => {
  const raw = fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8");
  assert.equal(/Bearer\s+[A-Za-z0-9\-_.]{20,}/.test(raw), false);
  assert.equal(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(raw), false);
});
