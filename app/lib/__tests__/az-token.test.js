"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { assertHttpsResource } = require("../az-token");

test("assertHttpsResource accepts an https URL", () => {
  assert.equal(
    assertHttpsResource("https://org.crm.dynamics.com", "Dataverse URL"),
    "https://org.crm.dynamics.com",
  );
});

test("assertHttpsResource accepts an Azure application id", () => {
  assert.equal(
    assertHttpsResource("96ff4394-9197-43aa-b393-6a41652e21f8", "PVA resource"),
    "96ff4394-9197-43aa-b393-6a41652e21f8",
  );
});

test("assertHttpsResource rejects shell metacharacters and non-https values", () => {
  assert.throws(() => assertHttpsResource('https://org.crm.dynamics.com" --debug', "Dataverse URL"), /not a URL/);
  assert.throws(() => assertHttpsResource("http://org.crm.dynamics.com", "Dataverse URL"), /https/);
  assert.throws(() => assertHttpsResource("https://user:secret@org.crm.dynamics.com", "Dataverse URL"), /credentials/);
});
