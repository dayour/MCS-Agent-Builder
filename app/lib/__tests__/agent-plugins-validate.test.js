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
  isLoopback,
  hasLevelPassRecord,
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
    "apim-key-header": "header-secret",
    "query-key": "remote-url",
    "level-bypass": "level-inflated",
    "level-not-passing": "level-inflated",
    "level-failed-next": "level-inflated",
    "level-superseded": "level-inflated",
    "level-fenced": "level-inflated",
    "level-commented": "level-inflated",
    "symlink-escape": "path-escape",
    "third-party": "extension-missing",
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
  const quoted = parseFrontmatter("---\nname: 'order-status'\ndescription: \"Read the packaged agent.\"\n---\n\n# Body\n");
  assert.equal(quoted.data.name, "order-status");
  assert.equal(quoted.data.description, "Read the packaged agent.");
  const repeated = parseFrontmatter("---\nname: order-status\nname: other\n---\n\n# Body\n");
  assert.match(repeated.error, /repeats name/);
});

test("level evidence requires a structured pass row", () => {
  assert.equal(hasLevelPassRecord("Level 3: we bypass all validation.", 3), false);
  assert.equal(hasLevelPassRecord("Level 2 is not yet passing.", 2), false);
  assert.equal(hasLevelPassRecord("L1 — failed. Next round will pass.", 1), false);
  assert.equal(hasLevelPassRecord("| L1 | pass | 2026-10-19 | abcdef0123456789 |", 1), true);
  assert.equal(hasLevelPassRecord("| L1 | passing | 2026-10-19 | abcdef0123456789 |", 1), false);
  assert.equal(hasLevelPassRecord("| L1 | pass | 2026-09-01 | abcdef0123456789 |\n| L1 | fail | 2026-10-19 | abcdef0123456789 |", 1), false);
  assert.equal(hasLevelPassRecord("| L1 | fail | 2026-09-01 | abcdef0123456789 |\n| L1 | pass | 2026-10-19 | abcdef0123456789 |", 1), true);
  assert.equal(hasLevelPassRecord("```\n| L1 | pass | 2026-10-19 | abcdef0123456789 |\n```\n", 1), false);
  assert.equal(hasLevelPassRecord("<!-- | L1 | pass | 2026-10-19 | abcdef0123456789 | -->", 1), false);
  assert.equal(hasLevelPassRecord("| L1 | pass | 2099-12-31 | abcdef0123456789 |", 1), false);
  const phrases = {
    "level-bypass": "Level 3: we bypass all validation.",
    "level-not-passing": "Level 2 is not yet passing.",
    "level-failed-next": "L1 — failed. Next round will pass.",
  };
  for (const [folder, phrase] of Object.entries(phrases)) {
    const text = fs.readFileSync(path.join(INVALID, folder, "CONFORMANCE.md"), "utf8");
    assert.equal(text.includes(phrase), true, folder);
    assert.equal(rules(path.join(INVALID, folder)).has("level-inflated"), true, folder);
  }
  const accepted = validatePluginDir(path.join(REPO_ROOT, "schema", "fixtures", "valid", "level-pass"));
  assert.equal(accepted.ok, true, JSON.stringify(accepted.violations));
});

test("symlink targets outside the plugin root are rejected", () => {
  const outside = path.join(fs.mkdtempSync(path.join(require("os").tmpdir(), "plugin-outside-")), "outside.txt");
  fs.writeFileSync(outside, "outside");
  const copy = fs.mkdtempSync(path.join(require("os").tmpdir(), "plugin-link-"));
  const plugin = path.join(copy, "order-status");
  fs.cpSync(VALID, plugin, { recursive: true });
  fs.rmSync(path.join(plugin, "specs", "ORDER_STATUS.md"));
  fs.symlinkSync(outside, path.join(plugin, "specs", "ORDER_STATUS.md"));
  fs.rmSync(path.join(plugin, "core", "dist", "index.js"));
  fs.symlinkSync(outside, path.join(plugin, "core", "dist", "index.js"));
  const pluginJson = JSON.parse(fs.readFileSync(path.join(plugin, "plugin.json"), "utf8"));
  pluginJson.extensions["com.grokbot"].bindings = { node: "bindings/node/index.js" };
  fs.writeFileSync(path.join(plugin, "plugin.json"), JSON.stringify(pluginJson, null, 2));
  fs.mkdirSync(path.join(plugin, "bindings", "node"), { recursive: true });
  fs.symlinkSync(outside, path.join(plugin, "bindings", "node", "index.js"));
  const found = rules(plugin);
  assert.equal(found.has("path-escape"), true, [...found].join(","));
  assert.equal(isLoopback("127.0.0.1"), true);
  assert.equal(isLoopback("127.evil.com"), false);
});

test("ajv loader restores Node's module path resolver", () => {
  const Module = require("module");
  const { loadAjv2020 } = require("../agent-plugins/load-ajv");
  const before = Module._nodeModulePaths;
  loadAjv2020();
  assert.equal(Module._nodeModulePaths, before);
  assert.equal(String(Module._nodeModulePaths).includes("resolveVendor"), false);
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
