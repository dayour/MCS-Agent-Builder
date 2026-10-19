"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertCliArg,
  assertHttpsResource,
  azAccessToken,
  azAccessTokenJson,
  azTenantId,
  buildAzInvocation,
  wrapAzAuthError,
} = require("../az-token");
const { getToken } = require("../../../tools/lib/http");

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

function formatAzExpiresOn(date) {
  const pad = (n, width = 2) => String(n).padStart(width, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}000`;
}

function jsonSpawn(capture, expiresOn) {
  return (command, args, options) => {
    capture.calls.push({ command, args, options });
    return {
      status: 0,
      stdout: `${JSON.stringify({ accessToken: TOKEN, expiresOn, tokenType: "Bearer" })}\n`,
      stderr: "",
    };
  };
}

test("cli arguments use a positive allowlist", () => {
  const allowed = [
    "account",
    "get-access-token",
    "show",
    "--resource",
    "--query",
    "--tenant",
    "accessToken",
    "tenantId",
    "-o",
    "tsv",
    "json",
    "https://org.crm.dynamics.com",
    "https://org.crm.dynamics.com/",
    "https://graph.microsoft.com",
    "https://service.powerapps.com/",
    "https://management.azure.com",
    "https://api.bap.microsoft.com/",
    "https://api.powerplatform.com",
    "96ff4394-9197-43aa-b393-6a41652e21f8",
    "contoso.onmicrosoft.com",
    "my-tenant.onmicrosoft.com",
  ];
  for (const value of allowed) assert.equal(assertCliArg(value), value);

  const invocation = buildAzInvocation([
    "account", "get-access-token", "--resource", "https://graph.microsoft.com",
    "--query", "accessToken", "-o", "tsv", "--tenant", "contoso.onmicrosoft.com",
  ], "win32");
  assert.equal(invocation.command, "cmd.exe");
  assert.deepEqual(invocation.args.slice(0, 4), ["/d", "/s", "/c", "az.cmd"]);

  for (const value of ["(", ")", ",", ";", "=", "a=b", "calc(1)", "a;b", "a,b", "a b"]) {
    assert.throws(() => assertCliArg(value), (err) => err.code === "AZ_ARG");
    assert.throws(() => buildAzInvocation(["account", value], "win32"), (err) => err.code === "AZ_ARG");
  }
});

test("azAccessTokenJson returns expiresOn from -o json without a shell", () => {
  const expiresOn = formatAzExpiresOn(new Date(Date.now() + 60_000));
  const capture = { calls: [] };
  const details = azAccessTokenJson(RESOURCE, {
    platform: "linux",
    spawnSync: jsonSpawn(capture, expiresOn),
  });
  assert.equal(details.accessToken, TOKEN);
  assert.equal(details.expiresOn, expiresOn);
  assert.equal(capture.calls[0].command, "az");
  assert.deepEqual(capture.calls[0].args, [
    "account", "get-access-token", "--resource", RESOURCE, "-o", "json",
  ]);
  assert.equal(capture.calls[0].options.shell, false);
  assert.equal(capture.calls[0].options.windowsVerbatimArguments, false);

  const win = { calls: [] };
  azAccessTokenJson(RESOURCE, {
    platform: "win32",
    tenant: "96ff4394-9197-43aa-b393-6a41652e21f8",
    spawnSync: jsonSpawn(win, expiresOn),
  });
  assert.equal(win.calls[0].command, "cmd.exe");
  assert.deepEqual(win.calls[0].args, [
    "/d", "/s", "/c", "az.cmd",
    "account", "get-access-token", "--resource", RESOURCE, "-o", "json",
    "--tenant", "96ff4394-9197-43aa-b393-6a41652e21f8",
  ]);
  assert.equal(win.calls[0].options.shell, false);
  assert.equal(win.calls[0].options.windowsVerbatimArguments, true);
});

test("a near-expiry token is not reused as if it lasted 50 minutes", () => {
  const resource = "https://near-expiry.crm.dynamics.com";
  const expiresOn = formatAzExpiresOn(new Date(Date.now() + 60_000));
  const capture = { calls: [] };
  const runtime = { platform: "linux", spawnSync: jsonSpawn(capture, expiresOn) };
  assert.equal(getToken(resource, undefined, runtime), TOKEN);
  assert.equal(getToken(resource, undefined, runtime), TOKEN);
  assert.equal(capture.calls.length, 2);
  assert.deepEqual(capture.calls[0].args, [
    "account", "get-access-token", "--resource", resource, "-o", "json",
  ]);
  assert.equal(capture.calls[0].options.shell, false);
});

test("a token whose expiresOn is past the refresh buffer is cached", () => {
  const resource = "https://fresh-token.crm.dynamics.com";
  const expiresOn = formatAzExpiresOn(new Date(Date.now() + 10 * 60 * 1000));
  const capture = { calls: [] };
  const runtime = { platform: "linux", spawnSync: jsonSpawn(capture, expiresOn) };
  assert.equal(getToken(resource, "contoso.onmicrosoft.com", runtime), TOKEN);
  assert.equal(getToken(resource, "contoso.onmicrosoft.com", runtime), TOKEN);
  assert.equal(capture.calls.length, 1);
  assert.deepEqual(capture.calls[0].args.slice(-2), ["--tenant", "contoso.onmicrosoft.com"]);
});

test("auth failures carry AZ_AUTH and are not double-wrapped", () => {
  let caught;
  try {
    azAccessToken(RESOURCE, {
      platform: "linux",
      spawnSync() {
        return { status: 2, stdout: "", stderr: "not logged in" };
      },
    });
  } catch (err) {
    caught = err;
  }
  assert.equal(caught.code, "AZ_AUTH");
  assert.equal(caught.message, "Azure CLI auth failed: not logged in. Run: az login");
  assert.equal(wrapAzAuthError(caught), caught);

  const validation = new Error("Azure CLI argument contains a forbidden character");
  validation.code = "AZ_ARG";
  const wrapped = wrapAzAuthError(validation);
  assert.notEqual(wrapped, validation);
  assert.equal(wrapped.code, "AZ_AUTH");
  assert.equal(wrapped.message, "Azure CLI auth failed: Azure CLI argument contains a forbidden character. Run: az login");

  const spawnFailure = new Error("spawn az ENOENT");
  spawnFailure.code = "ENOENT";
  let fromSpawn;
  try {
    azAccessToken(RESOURCE, {
      platform: "linux",
      spawnSync() {
        return { error: spawnFailure, status: null, stdout: "", stderr: "" };
      },
    });
  } catch (err) {
    fromSpawn = err;
  }
  assert.equal(fromSpawn.code, "AZ_AUTH");
  assert.equal(fromSpawn.spawnCode, "ENOENT");
  assert.equal(wrapAzAuthError(fromSpawn), fromSpawn);
  assert.match(fromSpawn.message, /^Azure CLI auth failed: spawn az ENOENT\. Run: az login$/);
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
