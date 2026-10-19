"use strict";

const { spawnSync } = require("child_process");

const AZ_APP_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FORBIDDEN_ARG = /["&|<>^%!\s]/;

function assertCliArg(value) {
  if (typeof value !== "string" || value.length === 0 || FORBIDDEN_ARG.test(value)) {
    const error = new Error("Azure CLI argument contains a forbidden character");
    error.code = "AZ_ARG";
    throw error;
  }
  return value;
}

function assertHttpsResource(value, label) {
  const name = label || "resource";
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} is not a URL`);
  }
  if (/[%?#&]/.test(value) || /\s/.test(value)) {
    throw new Error(`${name} must not include a query, fragment, or encoded character`);
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} is not a URL`);
  }
  if (url.protocol !== "https:") throw new Error(`${name} must use https`);
  if (url.username || url.password) throw new Error(`${name} must not include credentials`);
  if (url.search || url.hash) throw new Error(`${name} must not include a query or fragment`);
  if (url.pathname !== "/" && url.pathname !== "") throw new Error(`${name} must not include a path`);
  return value;
}

function assertTenant(value) {
  if (AZ_APP_ID.test(value)) return value;
  if (typeof value !== "string" || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(value)) {
    throw new Error("Azure tenant is not a GUID or domain");
  }
  return assertCliArg(value);
}

function resolveResource(value) {
  if (typeof value === "string" && AZ_APP_ID.test(value)) return value;
  return assertHttpsResource(value, "Azure resource");
}

function buildAzInvocation(args, platform) {
  const safeArgs = args.map(assertCliArg);
  if (platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "az.cmd", ...safeArgs],
      windowsVerbatimArguments: true,
    };
  }
  return { command: "az", args: safeArgs, windowsVerbatimArguments: false };
}

function runAz(args, options) {
  const platform = (options && options.platform) || process.platform;
  const spawn = (options && options.spawnSync) || spawnSync;
  const invocation = buildAzInvocation(args, platform);
  const result = spawn(invocation.command, invocation.args, {
    encoding: "utf8",
    timeout: 15000,
    shell: false,
    windowsVerbatimArguments: invocation.windowsVerbatimArguments,
  });
  if (result.error) {
    const error = new Error(`Azure CLI auth failed: ${result.error.message}. Run: az login`);
    error.code = result.error.code;
    throw error;
  }
  if (result.status !== 0) {
    const detail = String(result.stderr || "").trim() || `az exited ${result.status}`;
    throw new Error(`Azure CLI auth failed: ${detail}. Run: az login`);
  }
  return String(result.stdout || "");
}

function tokenArgs(resource, tenant, output) {
  const args = ["account", "get-access-token", "--resource", resolveResource(resource)];
  if (output === "tsv") args.push("--query", "accessToken");
  args.push("-o", output);
  if (tenant) args.push("--tenant", assertTenant(tenant));
  return args;
}

function azAccessToken(resource, options) {
  const tenant = options && options.tenant;
  const token = runAz(tokenArgs(resource, tenant, "tsv"), options).trim();
  if (!token || token.length < 20) throw new Error("Invalid Azure access token");
  return token;
}

function azTenantId(options) {
  const id = runAz(["account", "show", "--query", "tenantId", "-o", "tsv"], options).trim();
  if (!AZ_APP_ID.test(id)) throw new Error("Invalid tenant id");
  return id;
}

module.exports = {
  assertCliArg,
  assertHttpsResource,
  assertTenant,
  buildAzInvocation,
  azAccessToken,
  azTenantId,
};
