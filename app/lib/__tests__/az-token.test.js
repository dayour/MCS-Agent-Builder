"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { assertHttpsResource, azAccessToken, azTenantId } = require("../az-token");

const RESOURCE = "https://org.crm.dynamics.com";
const TOKEN = "x".repeat(24);
const TOKEN_ARGS = ["account", "get-access-token", "--resource", RESOURCE, "--query", "accessToken", "-o", "tsv"];

function stubSpawn(capture) {
  return (command, args, options) => {
    capture.calls.push({ command, args, options });
    return { status: 0, stdout: `${TOKEN}\n`, stderr: "" };
  };
}

test("assertHttpsResource accepts an https URL with an empty path", () => {
  assert.equal(assertHttpsResource(RESOURCE, "Dataverse URL"), RESOURCE);
  assert.equal(assertHttpsResource(`${RESOURCE}/`, "Dataverse URL"), `${RESOURCE}/`);
});

test("assertHttpsResource rejects query, fragment, percent, and ampersand", () => {
  assert.throws(() => assertHttpsResource(`${RESOURCE}/?x=1`, "Dataverse URL"), /query|fragment|encoded/);
  assert.throws(() => assertHttpsResource(`${RESOURCE}/#frag`, "Dataverse URL"), /query|fragment|encoded/);
  assert.throws(() => assertHttpsResource(`${RESOURCE}/%2e`, "Dataverse URL"), /query|fragment|encoded/);
  assert.throws(() => assertHttpsResource(`${RESOURCE}/?a=1&b=2`, "Dataverse URL"), /query|fragment|encoded/);
});

test("assertHttpsResource rejects userinfo, a path, and non-https values", () => {
  assert.throws(() => assertHttpsResource("http://org.crm.dynamics.com", "Dataverse URL"), /https/);
  assert.throws(() => assertHttpsResource("https://user:secret@org.crm.dynamics.com", "Dataverse URL"), /credentials/);
  assert.throws(() => assertHttpsResource("https://org.crm.dynamics.com/api/data", "Dataverse URL"), /path/);
  assert.throws(() => assertHttpsResource("96ff4394-9197-43aa-b393-6a41652e21f8", "PVA resource"), /not a URL/);
});

test("linux azAccessToken spawns az with an argument array", () => {
  const capture = { calls: [] };
  const token = azAccessToken(RESOURCE, { platform: "linux", spawnSync: stubSpawn(capture) });
  assert.equal(token, TOKEN);
  assert.equal(capture.calls.length, 1);
  assert.equal(capture.calls[0].command, "az");
  assert.deepEqual(capture.calls[0].args, TOKEN_ARGS);
  assert.equal(capture.calls[0].options.shell, false);
  assert.equal(capture.calls[0].options.windowsVerbatimArguments, false);
});

test("win32 azAccessToken spawns az.cmd through cmd.exe", () => {
  const capture = { calls: [] };
  const token = azAccessToken(RESOURCE, {
    platform: "win32",
    tenant: "96ff4394-9197-43aa-b393-6a41652e21f8",
    spawnSync: stubSpawn(capture),
  });
  assert.equal(token, TOKEN);
  assert.equal(capture.calls[0].command, "cmd.exe");
  assert.deepEqual(capture.calls[0].args, [
    "/d", "/s", "/c", "az.cmd",
    ...TOKEN_ARGS,
    "--tenant", "96ff4394-9197-43aa-b393-6a41652e21f8",
  ]);
  assert.equal(capture.calls[0].options.shell, false);
  assert.equal(capture.calls[0].options.windowsVerbatimArguments, true);
});

test("an application id is passed as --resource without a shell", () => {
  const capture = { calls: [] };
  azAccessToken("96ff4394-9197-43aa-b393-6a41652e21f8", { platform: "linux", spawnSync: stubSpawn(capture) });
  assert.equal(capture.calls[0].command, "az");
  assert.equal(capture.calls[0].args[3], "96ff4394-9197-43aa-b393-6a41652e21f8");
});

test("metacharacters are rejected before spawn", () => {
  const samples = [
    `${RESOURCE}/?x=1`,
    `${RESOURCE}/#frag`,
    `${RESOURCE}/%2e`,
    `${RESOURCE}/?a=1&b=2`,
    `${RESOURCE}" --debug`,
    "https://evil.example/ a",
  ];
  for (const sample of samples) {
    let spawned = false;
    assert.throws(() => azAccessToken(sample, {
      platform: "win32",
      spawnSync() {
        spawned = true;
        return { status: 0, stdout: TOKEN };
      },
    }), sample);
    assert.equal(spawned, false, sample);
  }
  let spawned = false;
  assert.throws(() => azAccessToken(RESOURCE, {
    platform: "linux",
    tenant: "contoso.onmicrosoft.com & calc",
    spawnSync() {
      spawned = true;
      return { status: 0, stdout: TOKEN };
    },
  }));
  assert.equal(spawned, false);
});

test("azTenantId uses the same allowlisted spawn", () => {
  const capture = { calls: [] };
  const spawn = (command, args, options) => {
    capture.calls.push({ command, args, options });
    return { status: 0, stdout: "96ff4394-9197-43aa-b393-6a41652e21f8\n", stderr: "" };
  };
  const id = azTenantId({ platform: "win32", spawnSync: spawn });
  assert.equal(id, "96ff4394-9197-43aa-b393-6a41652e21f8");
  assert.equal(capture.calls[0].command, "cmd.exe");
  assert.deepEqual(capture.calls[0].args, ["/d", "/s", "/c", "az.cmd", "account", "show", "--query", "tenantId", "-o", "tsv"]);
});
