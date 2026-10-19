"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const { emitPlugin } = require("../agent-plugins/generate");
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
  assert.equal(emitted.omitted.length, 1);
  assert.equal(emitted.omitted[0].name, "Insecure");
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
