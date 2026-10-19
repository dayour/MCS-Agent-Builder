"use strict";

const { spawnSync } = require("child_process");

const AZ_APP_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertHttpsResource(value, label) {
  const name = label || "resource";
  if (AZ_APP_ID.test(value)) return value;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} is not a URL`);
  }
  if (url.protocol !== "https:") throw new Error(`${name} must use https`);
  if (url.username || url.password) throw new Error(`${name} must not include credentials`);
  return value;
}

function azAccessToken(resource) {
  const safeResource = assertHttpsResource(resource, "Azure resource");
  const result = spawnSync("az", [
    "account", "get-access-token",
    "--resource", safeResource,
    "--query", "accessToken",
    "-o", "tsv",
  ], { encoding: "utf8", timeout: 15000 });
  if (result.error) {
    const error = new Error(`Azure CLI auth failed: ${result.error.message}. Run: az login`);
    error.code = result.error.code;
    throw error;
  }
  if (result.status !== 0) {
    const detail = String(result.stderr || "").trim() || `az exited ${result.status}`;
    throw new Error(`Azure CLI auth failed: ${detail}. Run: az login`);
  }
  const token = String(result.stdout || "").trim();
  if (!token || token.length < 20) throw new Error("Invalid Azure access token");
  return token;
}

module.exports = { assertHttpsResource, azAccessToken };
