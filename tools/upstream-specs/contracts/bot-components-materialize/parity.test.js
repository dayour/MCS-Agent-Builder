const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8"));

test("contract: request body has Kind array", () => {
  assert.ok(Array.isArray(fixture.request.body.Kind));
  assert.ok(fixture.request.body.Kind.includes("BotEntity"));
});

test("contract: URL includes api-version=2022-03-01-preview", () => {
  assert.match(fixture.request.url, /api-version=2022-03-01-preview/);
});

test("contract: URL uses PVA base path", () => {
  assert.match(fixture.request.url, /\/powervirtualagents\/bots\//);
});

test("contract: success response is 200", () => {
  assert.equal(fixture.response.status, 200);
});

test("contract: fixture is sanitized", () => {
  const raw = fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8");
  assert.equal(/Bearer\s+[A-Za-z0-9\-_.]{20,}/.test(raw), false);
  assert.equal(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(raw), false);
});
