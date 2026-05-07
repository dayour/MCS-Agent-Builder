const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8"));

test("contract: body has testSetId", () => {
  assert.ok(fixture.request.body.testSetId);
});

test("contract: URL uses v2 makerevaluations with ApplyV2Migration=true (PascalCase)", () => {
  assert.match(fixture.request.url, /\/api\/botmanagement\/v2\/environments\/.+\/bots\/.+\/makerevaluations\?ApplyV2Migration=true$/);
});

test("contract: response has runId + status", () => {
  assert.equal(fixture.response.status, 200);
  assert.ok(fixture.response.body.runId);
  assert.ok(["queued", "running", "completed", "failed"].includes(fixture.response.body.status));
});

test("contract: fixture is sanitized", () => {
  const raw = fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8");
  assert.equal(/Bearer\s+[A-Za-z0-9\-_.]{20,}/.test(raw), false);
  assert.equal(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(raw), false);
});
