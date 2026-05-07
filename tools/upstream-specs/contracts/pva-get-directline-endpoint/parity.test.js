const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8"));

test("contract: request body is exactly {}", () => {
  assert.deepEqual(fixture.request.body, {});
});

test("contract: URL uses bound-action format", () => {
  assert.match(fixture.request.url, /\/bots\([^)]+\)\/Microsoft\.Dynamics\.CRM\.PvaGetDirectLineEndpoint/);
});

test("contract: response has Endpoint field (PascalCase is contractual)", () => {
  assert.equal(fixture.response.status, 200);
  assert.ok("Endpoint" in fixture.response.body, "field MUST be 'Endpoint' (PascalCase); consumers of 'endpoint' will silently fail");
  assert.ok(typeof fixture.response.body.Endpoint === "string");
});

test("contract: fixture is sanitized", () => {
  const raw = fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8");
  assert.equal(/Bearer\s+[A-Za-z0-9\-_.]{20,}/.test(raw), false);
  assert.equal(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(raw), false);
});
