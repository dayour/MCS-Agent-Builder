const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8"));

test("contract: response is 200 with botid + name", () => {
  assert.equal(fixture.response.status, 200);
  assert.ok(typeof fixture.response.body.botid === "string");
  assert.ok(typeof fixture.response.body.name === "string");
});

test("contract: configuration present (string or object)", () => {
  const cfg = fixture.response.body.configuration;
  assert.ok(typeof cfg === "string" || typeof cfg === "object");
});

test("contract: URL pattern uses bot entity key parenthesis form", () => {
  assert.match(fixture.request.url, /\/bots\([^)]+\)/);
});

test("contract: fixture is sanitized", () => {
  const raw = fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8");
  assert.equal(/Bearer\s+[A-Za-z0-9\-_.]{20,}/.test(raw), false);
  assert.equal(/eyJ[A-Za-z0-9\-_]{10,}\.eyJ[A-Za-z0-9\-_]{10,}\./.test(raw), false);
  assert.equal(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(raw), false);
});
