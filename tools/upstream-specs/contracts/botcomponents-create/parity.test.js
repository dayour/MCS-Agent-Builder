const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8"));

test("contract: required body fields present", () => {
  const b = fixture.request.body;
  assert.ok(b.name);
  assert.ok(b.schemaname);
  assert.ok(typeof b.componenttype === "number");
  assert.ok(b["parentbotid@odata.bind"], "parentbotid@odata.bind is required");
});

test("contract: componenttype uses numeric enum (9, 15, 19, ...)", () => {
  assert.equal(fixture.request.body.componenttype, 9, "fixture shows componenttype=9 (custom topic). Other values: 15=GptComponent, 19=testcomponent");
});

test("contract: parentbotid@odata.bind uses leading-slash /bots(...) form", () => {
  const bind = fixture.request.body["parentbotid@odata.bind"];
  assert.match(bind, /^\/bots\([^)]+\)$/);
});

test("contract: success response 201 + botcomponentid", () => {
  assert.equal(fixture.response.status, 201);
  assert.ok(typeof fixture.response.body.botcomponentid === "string");
});

test("contract: duplicate schemaname returns 412 (not 409)", () => {
  assert.equal(fixture.errorCase.response.status, 412);
});

test("contract: fixture is sanitized", () => {
  const raw = fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8");
  assert.equal(/Bearer\s+[A-Za-z0-9\-_.]{20,}/.test(raw), false);
  assert.equal(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(raw), false);
});
