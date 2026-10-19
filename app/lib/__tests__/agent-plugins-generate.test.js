"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const crypto = require("crypto");
const { emitPlugin, pluginNameFromAgent, safeRemoteUrl } = require("../agent-plugins/generate");
const { importPlugin } = require("../agent-plugins/import-plugin");
const { validatePluginDir } = require("../agent-plugins/validate");

function sampleSpec() {
  return {
    _schema: "2.0",
    agent: {
      name: "Order Status",
      description: "Answers order-status questions for retail customers.",
      persona: "Direct",
    },
    instructions: "State the packaged order status and refuse payment changes.",
    capabilities: [
      { name: "Look up order status", description: "Read the packaged order state.", phase: "mvp" },
    ],
    conversations: { topics: [{ name: "Order lookup", description: "Asks for an order number." }] },
    boundaries: { handle: ["order status"], decline: [], refuse: ["payment changes"] },
    integrations: [
      { name: "Orders API", type: "mcp", purpose: "Read orders", url: "https://orders.example.com/mcp", headers: { Authorization: "Bearer abcdefghijklmnop", "X-Tenant": "public" } },
      { name: "Insecure", type: "mcp", purpose: "Skip", url: "http://orders.example.com/mcp", apiToken: "ghp_abcdefghijklmnopqrstuvwxyz0123456789" },
    ],
    knowledge: [{ name: "Policy", type: "Uploaded files", purpose: "Returns" }],
    architecture: { type: "single-agent", channels: [{ name: "Microsoft Teams", reason: "Customer channel" }], children: [] },
  };
}

test("emit writes a valid package and import round-trips the model without secrets", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-emit-"));
  const emitted = emitPlugin(sampleSpec(), path.join(parent, "order-status"));
  assert.equal(emitted.validation.ok, true);
  assert.ok(emitted.omitted.some((item) => item.name === "Insecure"));
  assert.ok(emitted.omitted.some((item) => item.name === "Orders API" && /allow-list/.test(item.reason)));
  const plugin = JSON.parse(fs.readFileSync(path.join(emitted.outDir, "plugin.json"), "utf8"));
  const mcp = JSON.parse(fs.readFileSync(path.join(emitted.outDir, "mcp.json"), "utf8"));
  assert.equal(plugin.extensions["com.grokbot"].kind, "channel");
  assert.equal(plugin.extensions["com.grokbot"].approval.required, true);
  assert.equal(plugin.extensions["com.grokbot"].secretsPolicy.plaintextToAgent, false);
  assert.equal(plugin.extensions["com.grokbot"].level, 0);
  assert.equal(mcp.mcpServers["order-status"].command, "node");
  assert.equal(mcp.mcpServers["order-status"].args[0], "${PLUGIN_ROOT}/core/dist/index.js");
  assert.equal(mcp.mcpServers["orders-api"].url, "https://orders.example.com/mcp");
  assert.equal(mcp.mcpServers["orders-api"].headers["X-Tenant"], "public");
  assert.equal(mcp.mcpServers["orders-api"].headers.Authorization, undefined);
  const packed = fs.readFileSync(path.join(emitted.outDir, "agent-model.json"), "utf8");
  assert.equal(packed.includes("ghp_"), false);
  assert.equal(packed.includes("Bearer"), false);
  const again = validatePluginDir(emitted.outDir);
  assert.equal(again.ok, true, JSON.stringify(again.violations, null, 2));
  const imported = importPlugin(emitted.outDir);
  assert.equal(imported.validation.ok, true);
  assert.equal(imported.spec.agent.name, "Order Status");
  assert.equal(imported.spec.instructions.includes("packaged order status"), true);
  assert.equal(imported.spec.capabilities[0].name, "Look up order status");
  assert.equal(imported.spec.architecture.channels[0].name, "Microsoft Teams");
  assert.equal(imported.spec.agentPlugin.extension.capabilities[0], "messaging");
  assert.equal(JSON.stringify(imported.spec).includes("ghp_"), false);
});

test("cli emit and import print a valid manifest", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-cli-"));
  const specFile = path.join(parent, "agentspec.json");
  fs.writeFileSync(specFile, JSON.stringify(sampleSpec()));
  const cli = path.join(__dirname, "..", "..", "..", "bin", "cli.js");
  const emit = spawnSync(process.execPath, [cli, "manifest", "emit", "--spec", specFile, "--out", parent], { encoding: "utf8" });
  assert.equal(emit.status, 0, emit.stderr);
  assert.match(emit.stdout, /manifest: valid/);
  const outSpec = path.join(parent, "imported.json");
  const imported = spawnSync(process.execPath, [cli, "manifest", "import", "--dir", path.join(parent, "order-status"), "--out", outSpec], { encoding: "utf8" });
  assert.equal(imported.status, 0, imported.stderr);
  assert.match(imported.stdout, /manifest: valid/);
  const spec = JSON.parse(fs.readFileSync(outSpec, "utf8"));
  assert.equal(spec.agent.name, "Order Status");
  const bad = spawnSync(process.execPath, [cli, "manifest", "validate", path.join(__dirname, "..", "..", "..", "schema", "fixtures", "invalid", "shell-command")], { encoding: "utf8" });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /command-token/);
});

test("credential headers and query strings are omitted from the package", () => {
  const spec = sampleSpec();
  spec.integrations = [{
    name: "Apim",
    type: "mcp",
    purpose: "Gateway",
    url: "https://example.com/mcp?code=supersecret",
    headers: {
      "Ocp-Apim-Subscription-Key": "abc",
      "x-functions-key": "def",
      "X-Tenant": "public",
    },
  }];
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-secret-"));
  const emitted = emitPlugin(spec, path.join(parent, "order-status"));
  assert.equal(emitted.validation.ok, true, JSON.stringify(emitted.validation.violations));
  const packed = [
    fs.readFileSync(path.join(emitted.outDir, "mcp.json"), "utf8"),
    fs.readFileSync(path.join(emitted.outDir, "agent-model.json"), "utf8"),
    fs.readFileSync(path.join(emitted.outDir, "specs", "ORDER_STATUS.md"), "utf8"),
  ].join("\n");
  assert.equal(packed.includes("Ocp-Apim-Subscription-Key"), false);
  assert.equal(packed.includes("x-functions-key"), false);
  assert.equal(packed.includes("code="), false);
  assert.equal(packed.includes("supersecret"), false);
  assert.ok(emitted.omitted.some((item) => item.name === "Apim" && /query string/.test(item.reason)));
});

test("a remote server cannot replace the stdio core", () => {
  const spec = sampleSpec();
  spec.integrations = [{ name: "Order Status", type: "mcp", purpose: "Remote", url: "https://orders.example.com/mcp" }];
  const built = require("../agent-plugins/generate").buildPackage(spec);
  const mcp = JSON.parse(built.files["mcp.json"]);
  assert.equal(mcp.mcpServers["order-status"].type, "stdio");
  assert.equal(mcp.mcpServers["order-status"].command, "node");
  assert.equal(mcp.mcpServers["order-status-2"].type, "streamable-http");
  assert.equal(mcp.mcpServers["order-status-2"].url, "https://orders.example.com/mcp");
});

test("emit refuses an unrelated directory unless --force", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-keep-"));
  const dest = path.join(parent, "order-status");
  fs.mkdirSync(dest);
  fs.writeFileSync(path.join(dest, "notes.txt"), "keep me");
  assert.throws(() => emitPlugin(sampleSpec(), dest), /refusing to replace/);
  assert.equal(fs.readFileSync(path.join(dest, "notes.txt"), "utf8"), "keep me");
  const cli = path.join(__dirname, "..", "..", "..", "bin", "cli.js");
  const specFile = path.join(parent, "agentspec.json");
  fs.writeFileSync(specFile, JSON.stringify(sampleSpec()));
  const blocked = spawnSync(process.execPath, [cli, "manifest", "emit", "--spec", specFile, "--out", parent], { encoding: "utf8" });
  assert.equal(blocked.status, 1);
  assert.equal(fs.readFileSync(path.join(dest, "notes.txt"), "utf8"), "keep me");
  const forced = spawnSync(process.execPath, [cli, "manifest", "emit", "--spec", specFile, "--out", parent, "--force"], { encoding: "utf8" });
  assert.equal(forced.status, 0, forced.stderr);
  assert.equal(fs.existsSync(path.join(dest, "plugin.json")), true);
});

test("non-latin names and non-loopback 127 hosts stay valid or omitted", () => {
  const name = "客服助手";
  const expected = `agent-${crypto.createHash("sha256").update(name, "utf8").digest("hex").slice(0, 8)}`;
  assert.equal(pluginNameFromAgent(name), expected);
  assert.equal(safeRemoteUrl("http://127.evil.com/mcp").url, null);
  assert.equal(safeRemoteUrl("http://127.0.0.1:9/mcp").url, "http://127.0.0.1:9/mcp");
  const spec = sampleSpec();
  spec.agent.name = name;
  spec.integrations = [{ name: "Evil", type: "mcp", purpose: "Skip", url: "http://127.evil.com/mcp" }];
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-cjk-"));
  const emitted = emitPlugin(spec, path.join(parent, expected));
  assert.equal(emitted.validation.ok, true, JSON.stringify(emitted.validation.violations));
  assert.equal(emitted.name, expected);
  const packed = fs.readFileSync(path.join(emitted.outDir, "mcp.json"), "utf8");
  assert.equal(packed.includes("127.evil.com"), false);
  assert.ok(emitted.omitted.some((item) => item.name === "Evil"));
});

test("spec-core import warns on third-party packages and still refuses a bad name", () => {
  const repo = path.join(__dirname, "..", "..", "..");
  const cli = path.join(repo, "bin", "cli.js");
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-import-"));
  const outSpec = path.join(parent, "imported.json");
  const third = spawnSync(process.execPath, [
    cli, "manifest", "import",
    "--dir", path.join(repo, "schema", "fixtures", "invalid", "third-party"),
    "--out", outSpec,
  ], { encoding: "utf8" });
  assert.equal(third.status, 0, third.stderr);
  assert.match(third.stderr, /warning:/);
  assert.match(third.stdout, /manifest: valid/);
  const spec = JSON.parse(fs.readFileSync(outSpec, "utf8"));
  assert.equal(spec.agentPlugin.extension, null);
  const badOut = path.join(parent, "bad.json");
  const bad = spawnSync(process.execPath, [
    cli, "manifest", "import",
    "--dir", path.join(repo, "schema", "fixtures", "invalid", "bad-name"),
    "--out", badOut,
  ], { encoding: "utf8" });
  assert.equal(bad.status, 1);
  assert.equal(fs.existsSync(badOut), false);
  assert.match(bad.stderr, /plugin-schema|name/);
  const forcedOut = path.join(parent, "forced.json");
  const forced = spawnSync(process.execPath, [
    cli, "manifest", "import",
    "--dir", path.join(repo, "schema", "fixtures", "invalid", "bad-name"),
    "--out", forcedOut,
    "--force",
  ], { encoding: "utf8" });
  assert.equal(forced.status, 0, forced.stderr);
  assert.match(forced.stderr, /plugin-schema|name-folder/);
  assert.match(forced.stdout, /manifest: invalid \(--force\)/);
  assert.equal(fs.existsSync(forcedOut), true);
});

test("invalid plugin JSON raises a coded error", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-json-"));
  fs.writeFileSync(path.join(dir, "plugin.json"), "{");
  assert.throws(() => importPlugin(dir), (err) => err.code === "PLUGIN_JSON" && err.message.includes("plugin.json"));
});

test("manifest step failure is logged and does not stop the pipeline unless strict", async () => {
  const { stepManifest } = require("../build-pipeline")._testables;
  const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-step-"));
  const job = () => ({
    steps: [{ id: "manifest", status: "pending", detail: null }],
    errors: [],
    rawLog: "",
    listeners: [],
  });
  const loose = job();
  await stepManifest(loose, { agent: {} }, agentDir);
  assert.equal(loose.steps[0].status, "failed");
  assert.match(loose.rawLog, /Manifest step failed/);
  const strict = job();
  await assert.rejects(() => stepManifest(strict, { agent: {}, agentPlugin: { strict: true } }, agentDir));
  assert.equal(strict.steps[0].status, "failed");
  const ok = job();
  await stepManifest(ok, sampleSpec(), agentDir);
  assert.equal(ok.steps[0].status, "completed");
  assert.equal(fs.existsSync(path.join(agentDir, "plugin", "order-status", "plugin.json")), true);
});
