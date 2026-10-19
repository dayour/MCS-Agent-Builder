"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const crypto = require("crypto");

const {
  validatePluginDir,
  PLUGIN_SCHEMA_PATH,
  MCP_SCHEMA_PATH,
  EXTENSION_SCHEMA_PATH,
  PLUGIN_SCHEMA_ID,
  MCP_SCHEMA_ID,
  REPO_ROOT,
  parseFrontmatter,
  isSingleTokenCommand,
} = require("../agent-plugins/validate");
const { handleRpc, callTool, loadModel } = require("../agent-plugins/mcp-stdio-server");

const VALID = path.join(REPO_ROOT, "schema", "fixtures", "valid", "order-status");
const INVALID = path.join(REPO_ROOT, "schema", "fixtures", "invalid");

function rules(dir) {
  return new Set(validatePluginDir(dir).violations.map((item) => item.rule));
}

test("vendored schemas match provenance hashes and canonical ids", () => {
  const provenance = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "schema", "PROVENANCE.json"), "utf8"));
  const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  assert.equal(hash(PLUGIN_SCHEMA_PATH), provenance.agentPlugins.pluginSchema.sha256);
  assert.equal(hash(MCP_SCHEMA_PATH), provenance.agentPlugins.mcpSchema.sha256);
  assert.equal(hash(EXTENSION_SCHEMA_PATH), provenance.grokbotExtension.sha256);
  assert.equal(JSON.parse(fs.readFileSync(PLUGIN_SCHEMA_PATH, "utf8")).$id, PLUGIN_SCHEMA_ID);
  assert.equal(JSON.parse(fs.readFileSync(MCP_SCHEMA_PATH, "utf8")).$id, MCP_SCHEMA_ID);
});

test("valid order-status fixture passes", () => {
  const result = validatePluginDir(VALID);
  assert.deepEqual(result.violations, []);
  assert.equal(result.ok, true);
});

test("invalid fixtures fail on the rule they target", () => {
  const expected = {
    "bad-name": "plugin-schema",
    "name-mismatch": "name-folder",
    "extra-key": "plugin-schema",
    "shell-command": "command-token",
    "secret-env": "env-secret",
    "http-remote": "remote-url",
    "credential-header": "header-secret",
    "missing-spec": "spec-file",
    "inflated-level": "level-inflated",
    "cwd-escape": "cwd-containment",
    "missing-binding": "binding-path",
    "secret-sync-direction": "secret-sync-direction",
    "bad-skill": "skill-frontmatter",
    "plugin-root-env": "env-secret",
  };
  for (const [folder, rule] of Object.entries(expected)) {
    const found = rules(path.join(INVALID, folder));
    assert.equal(found.has(rule), true, `${folder} missing ${rule}; got ${[...found].join(",")}`);
  }
});

test("stdio command token rejects shell strings", () => {
  assert.equal(isSingleTokenCommand("node"), true);
  assert.equal(isSingleTokenCommand("./core/dist/index.js"), true);
  assert.equal(isSingleTokenCommand("node server.js"), false);
  assert.equal(isSingleTokenCommand("sh"), true);
  assert.equal(isSingleTokenCommand("./../bin/server"), false);
});

test("skill frontmatter folds a multiline description", () => {
  const parsed = parseFrontmatter("---\nname: order-status\ndescription: >-\n  Read the packaged\n  agent definition.\n---\n\n# Body\n");
  assert.equal(parsed.data.name, "order-status");
  assert.equal(parsed.data.description, "Read the packaged agent definition.");
});

test("mcp server redacts secret fields and answers tools/call", () => {
  const model = loadModel(VALID);
  const listed = handleRpc(model, null, { jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.ok(listed.result.tools.some((tool) => tool.name === "get_capability"));
  const described = callTool(model, "describe_agent", {});
  assert.equal(described.isError, false);
  assert.match(described.content[0].text, /Order status/);
  const integrations = callTool(model, "list_integrations", {});
  assert.equal(integrations.content[0].text.includes("ghp_"), false);
  assert.equal(integrations.content[0].text.includes("apiToken"), false);
  const missing = callTool(model, "get_capability", { name: "nope" });
  assert.equal(missing.isError, true);
  assert.match(missing.content[0].text, /Look up order status/);
  const init = handleRpc(model, null, { jsonrpc: "2.0", id: 2, method: "initialize", params: {} });
  assert.equal(init.result.protocolVersion, "2024-11-05");
  assert.equal(init.result.serverInfo.name, "Order status");
});

test("mcp server stdio process lists tools", async () => {
  const entry = path.join(VALID, "core", "dist", "index.js");
  const child = spawn(process.execPath, [entry], {
    cwd: VALID,
    env: { ...process.env, PLUGIN_ROOT: VALID },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_capabilities", arguments: {} } })}\n`);
  child.stdin.end();
  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`timeout; stdout=${stdout}`));
    }, 5000);
    child.on("exit", (exitCode) => {
      clearTimeout(timer);
      resolve(exitCode);
    });
    child.on("error", reject);
  });
  assert.equal(code, 0);
  const messages = stdout.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const called = messages.find((message) => message.id === 2);
  assert.ok(called, stdout);
  assert.match(called.result.content[0].text, /Look up order status/);
});
