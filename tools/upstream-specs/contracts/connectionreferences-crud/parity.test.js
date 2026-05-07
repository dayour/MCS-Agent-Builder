const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8"));

test("contract: GET returns OData collection", () => {
  assert.equal(fixture.getResponse.status, 200);
  assert.ok(Array.isArray(fixture.getResponse.body.value));
});

test("contract: POST requires connectionreferencelogicalname + connectorid", () => {
  const b = fixture.createRequest.body;
  assert.ok(b.connectionreferencelogicalname);
  assert.ok(b.connectorid);
});

test("contract: POST returns 201 + connectionreferenceid", () => {
  assert.equal(fixture.createResponse.status, 201);
  assert.ok(typeof fixture.createResponse.body.connectionreferenceid === "string");
});

test("contract: fixture is sanitized", () => {
  const raw = fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8");
  assert.equal(/Bearer\s+[A-Za-z0-9\-_.]{20,}/.test(raw), false);
  assert.equal(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(raw), false);
});
