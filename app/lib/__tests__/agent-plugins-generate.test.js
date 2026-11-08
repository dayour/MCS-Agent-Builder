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
  assert.equal(plugin.license, undefined);
  assert.equal(plugin.author, undefined);
  assert.equal(plugin.repository, undefined);
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

test("plugin identity comes from agentPlugin and an untyped url is not an MCP server", () => {
  const spec = sampleSpec();
  spec.agentPlugin = {
    license: "Apache-2.0",
    repository: "https://example.com/order-status",
    author: { name: "Retail Team", email: "team@example.com" },
  };
  spec.integrations = [
    { name: "Untyped", purpose: "Skip", url: "https://untyped.example.com/mcp" },
    { name: "Orders API", type: "mcp", purpose: "Read orders", url: "https://orders.example.com/mcp" },
  ];
  const built = require("../agent-plugins/generate").buildPackage(spec);
  const plugin = JSON.parse(built.files["plugin.json"]);
  const mcp = JSON.parse(built.files["mcp.json"]);
  assert.equal(plugin.license, "Apache-2.0");
  assert.equal(plugin.repository, "https://example.com/order-status");
  assert.deepEqual(plugin.author, { name: "Retail Team", email: "team@example.com" });
  assert.equal(mcp.mcpServers["untyped"], undefined);
  assert.equal(mcp.mcpServers["orders-api"].url, "https://orders.example.com/mcp");
  assert.ok(built.omitted.some((item) => item.name === "Untyped" && /no type/.test(item.reason)));
  assert.match(built.files["specs/ORDER_STATUS.md"], /Untyped/);
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

test("repository and author credential URLs are rejected at emit", () => {
  const spec = sampleSpec();
  spec.agentPlugin = {
    repository: "https://user:secret@github.com/example/order-status",
    author: { name: "Retail", url: "https://example.com/author?token=abcdef" },
  };
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-identity-"));
  assert.throws(() => emitPlugin(spec, path.join(parent, "order-status")), (err) => {
    return err.code === "MANIFEST_INVALID" && /identity-secret/.test(err.message);
  });
});

test("import --force does not copy credential headers into the agentspec", () => {
  const repo = path.join(__dirname, "..", "..", "..");
  const cli = path.join(repo, "bin", "cli.js");
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-headers-"));
  const outSpec = path.join(parent, "forced.json");
  const forced = spawnSync(process.execPath, [
    cli, "manifest", "import",
    "--dir", path.join(repo, "schema", "fixtures", "invalid", "credential-header"),
    "--out", outSpec,
    "--force",
  ], { encoding: "utf8" });
  assert.equal(forced.status, 0, forced.stderr);
  const packed = fs.readFileSync(outSpec, "utf8");
  assert.equal(packed.includes("Authorization"), false);
  assert.equal(packed.includes("Bearer"), false);
  assert.equal(packed.includes("abcdefghijklmnop"), false);
});

test("import --force strips secret env values, credential query keys, and secret header values", () => {
  const repo = path.join(__dirname, "..", "..", "..");
  const cli = path.join(repo, "bin", "cli.js");
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-secret-import-"));
  const plugin = path.join(parent, "credential-header");
  fs.cpSync(path.join(repo, "schema", "fixtures", "invalid", "credential-header"), plugin, { recursive: true });
  const token = `ghp_${"a".repeat(24)}`;
  fs.writeFileSync(path.join(plugin, "mcp.json"), JSON.stringify({
    $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
    mcpServers: {
      remote: {
        type: "streamable-http",
        url: "https://example.com/mcp?code=supersecret&tenant=public",
        headers: {
          Authorization: "Bearer abcdefghijklmnop",
          "X-Request-Id": token,
          "X-Tenant": "retail",
        },
        env: {
          REGION: "us",
          API_TOKEN: "not-a-real-value",
          PUBLIC: token,
        },
      },
    },
  }, null, 2));
  const outSpec = path.join(parent, "forced.json");
  const forced = spawnSync(process.execPath, [
    cli, "manifest", "import",
    "--dir", plugin,
    "--out", outSpec,
    "--force",
  ], { encoding: "utf8" });
  assert.equal(forced.status, 0, forced.stderr);
  const packed = fs.readFileSync(outSpec, "utf8");
  // Before: the agentspec kept the env secret, the code query, and the secret header value.
  assert.equal(packed.includes("Authorization"), false);
  assert.equal(packed.includes("Bearer"), false);
  assert.equal(packed.includes("abcdefghijklmnop"), false);
  assert.equal(packed.includes("ghp_"), false);
  assert.equal(packed.includes("code="), false);
  assert.equal(packed.includes("API_TOKEN"), false);
  assert.equal(packed.includes("supersecret"), false);
  // After: the public query key, header, and env value remain.
  assert.match(packed, /tenant=public/);
  assert.match(packed, /X-Tenant/);
  assert.match(packed, /retail/);
  assert.match(packed, /REGION/);
  assert.match(packed, /"us"/);
});

test("emit rejects plugin.json URL fields that embed userinfo", () => {
  const spec = sampleSpec();
  spec.agentPlugin = {
    repository: "https://deploy:p4ssw0rd@git.example.com/x",
    author: { name: "Retail", url: "https://deploy:p4ssw0rd@git.example.com/x" },
  };
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-identity-emit-"));
  const dest = path.join(parent, "order-status");
  assert.throws(() => emitPlugin(spec, dest), (err) => {
    assert.equal(err.code, "MANIFEST_INVALID");
    assert.match(err.message, /identity-secret/);
    assert.match(err.message, /\/repository/);
    assert.match(err.message, /\/author\/url/);
    return true;
  });
  assert.equal(fs.existsSync(path.join(dest, "plugin.json")), false);
  const leftover = fs.readdirSync(parent).join("\n");
  assert.equal(leftover.includes("p4ssw0rd"), false, leftover);
  assert.equal(leftover.includes(".plugin-stage-"), false, leftover);
});

test("import --force strips credentials from repository, homepage, and author.url", () => {
  const repo = path.join(__dirname, "..", "..", "..");
  const cli = path.join(repo, "bin", "cli.js");
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-identity-url-"));
  const plugin = path.join(parent, "order-status");
  fs.cpSync(path.join(repo, "schema", "fixtures", "valid", "order-status"), plugin, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(plugin, "plugin.json"), "utf8"));
  manifest.repository = "https://x-access-token:s3cr3t@github.com/o/r?token=abc123";
  manifest.homepage = "https://user:hunter2pass@example.com/?access_token=abc123";
  manifest.author = { name: "Retail", url: "https://author.example/me?token=abc123" };
  fs.writeFileSync(path.join(plugin, "plugin.json"), JSON.stringify(manifest, null, 2));
  const outSpec = path.join(parent, "forced.json");
  const forced = spawnSync(process.execPath, [
    cli, "manifest", "import",
    "--dir", plugin,
    "--out", outSpec,
    "--force",
  ], { encoding: "utf8" });
  assert.equal(forced.status, 0, forced.stderr);
  const spec = JSON.parse(fs.readFileSync(outSpec, "utf8"));
  const repository = new URL(spec.agentPlugin.repository);
  assert.equal(repository.username, "");
  assert.equal(repository.password, "");
  assert.equal(repository.searchParams.has("token"), false);
  assert.equal(spec.agentPlugin.repository.includes("token="), false);
  assert.equal(spec.agentPlugin.repository.includes("x-access-token"), false);
  const homepage = new URL(spec.agentPlugin.homepage);
  assert.equal(homepage.username, "");
  assert.equal(homepage.password, "");
  assert.equal(homepage.searchParams.has("access_token"), false);
  const author = new URL(spec.agentPlugin.author.url);
  assert.equal(author.searchParams.has("token"), false);
  assert.match(forced.stderr, /identity-secret/);
});

test("importing order-status leaves no ghp_ token and redacts nested model secrets", () => {
  const repo = path.join(__dirname, "..", "..", "..");
  const fixture = path.join(repo, "schema", "fixtures", "valid", "order-status");
  const clean = importPlugin(fixture);
  assert.equal(clean.validation.ok, true, JSON.stringify(clean.validation.errors));
  assert.equal(JSON.stringify(clean.spec).includes("ghp_"), false);
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-model-secret-"));
  const plugin = path.join(parent, "order-status");
  fs.cpSync(fixture, plugin, { recursive: true });
  const token = `ghp_${"c".repeat(24)}`;
  const model = JSON.parse(fs.readFileSync(path.join(plugin, "agent-model.json"), "utf8"));
  model.integrations[0].apiToken = token;
  model.integrations[0].nested = { note: token, API_TOKEN: "kept-looking-key" };
  model.integrations[0].purpose = "Read orders";
  fs.writeFileSync(path.join(plugin, "agent-model.json"), JSON.stringify(model, null, 2));
  const imported = importPlugin(plugin);
  const packed = JSON.stringify(imported.spec);
  assert.equal(packed.includes("ghp_"), false);
  assert.equal(imported.spec.integrations[0].apiToken, "");
  assert.equal(imported.spec.integrations[0].nested.note, "");
  assert.equal(imported.spec.integrations[0].nested.API_TOKEN, undefined);
  assert.equal(imported.spec.integrations[0].purpose, "Read orders");
  assert.equal(imported.validation.ok, false);
  assert.equal(imported.validation.errors.some((item) => item.rule === "manifest-secret"), true);
});

test("--force help says it deletes the existing directory", () => {
  const cli = path.join(__dirname, "..", "..", "..", "bin", "cli.js");
  const help = spawnSync(process.execPath, [cli, "-h"], { encoding: "utf8" });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /--force deletes the existing output directory/);
  const usage = spawnSync(process.execPath, [cli, "manifest", "emit"], { encoding: "utf8" });
  assert.notEqual(usage.status, 0);
  assert.match(usage.stderr, /--force deletes the existing output directory/);
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
  assert.equal(loose.errors.length, 1);
  const strict = job();
  await assert.rejects(() => stepManifest(strict, { agent: {}, agentPlugin: { strict: true } }, agentDir));
  assert.equal(strict.steps[0].status, "failed");
  assert.deepEqual(strict.errors, []);
  const ok = job();
  await stepManifest(ok, sampleSpec(), agentDir);
  assert.equal(ok.steps[0].status, "completed");
  assert.equal(fs.existsSync(path.join(agentDir, "plugin", "order-status", "plugin.json")), true);
});

test("manifest step keeps agentPlugin version and strict across rebuilds", async () => {
  const { stepManifest } = require("../build-pipeline")._testables;
  const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-merge-"));
  const brief = sampleSpec();
  brief.agentPlugin = {
    version: "1.2.0",
    strict: true,
    extension: { kind: "channel" },
    mcpServers: { keep: true },
    note: "user",
  };
  const makeJob = () => ({
    steps: [{ id: "manifest", status: "pending", detail: null }],
    errors: [],
    rawLog: "",
    listeners: [],
  });
  await stepManifest(makeJob(), brief, agentDir);
  await stepManifest(makeJob(), brief, agentDir);
  const pluginPath = path.join(agentDir, "plugin", "order-status", "plugin.json");
  const plugin = JSON.parse(fs.readFileSync(pluginPath, "utf8"));
  assert.equal(plugin.version, "1.2.0");
  assert.equal(brief.agentPlugin.version, "1.2.0");
  assert.equal(brief.agentPlugin.strict, true);
  assert.deepEqual(brief.agentPlugin.extension, { kind: "channel" });
  assert.deepEqual(brief.agentPlugin.mcpServers, { keep: true });
  assert.equal(brief.agentPlugin.note, "user");
  assert.equal(brief.agentPlugin.name, "order-status");
  assert.equal(brief.agentPlugin.directory, "plugin/order-status");
  assert.ok(brief.agentPlugin.schema);
  assert.ok(brief.agentPlugin.validatedAt);
  assert.ok(Array.isArray(brief.agentPlugin.omitted));
});

test("manifest rebuild does not carry secret env values, query keys, or header values", async () => {
  const { stepManifest } = require("../build-pipeline")._testables;
  const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-carry-"));
  const token = `ghp_${"b".repeat(24)}`;
  const brief = sampleSpec();
  brief.agentPlugin = {
    version: "1.2.0",
    strict: true,
    note: "user",
    mcpServers: {
      keep: true,
      remote: {
        type: "streamable-http",
        url: "https://example.com/mcp?code=supersecret&tenant=public",
        headers: {
          Authorization: "Bearer abcdefghijklmnop",
          "X-Request-Id": token,
          "X-Tenant": "retail",
        },
        env: {
          REGION: "us",
          API_TOKEN: "not-a-real-value",
          PUBLIC: token,
        },
      },
    },
  };
  const job = {
    steps: [{ id: "manifest", status: "pending", detail: null }],
    errors: [],
    rawLog: "",
    listeners: [],
  };
  await stepManifest(job, brief, agentDir);
  await stepManifest(job, brief, agentDir);
  const packed = JSON.stringify(brief.agentPlugin);
  assert.equal(brief.agentPlugin.version, "1.2.0");
  assert.equal(brief.agentPlugin.strict, true);
  assert.equal(brief.agentPlugin.note, "user");
  assert.equal(brief.agentPlugin.mcpServers.keep, true);
  assert.equal(packed.includes("Authorization"), false);
  assert.equal(packed.includes("Bearer"), false);
  assert.equal(packed.includes("ghp_"), false);
  assert.equal(packed.includes("code="), false);
  assert.equal(packed.includes("API_TOKEN"), false);
  assert.equal(packed.includes("supersecret"), false);
  assert.match(brief.agentPlugin.mcpServers.remote.url, /tenant=public/);
  assert.equal(brief.agentPlugin.mcpServers.remote.headers["X-Tenant"], "retail");
  assert.equal(brief.agentPlugin.mcpServers.remote.headers["X-Request-Id"], undefined);
  assert.equal(brief.agentPlugin.mcpServers.remote.env.REGION, "us");
  assert.equal(brief.agentPlugin.mcpServers.remote.env.API_TOKEN, undefined);
  assert.equal(brief.agentPlugin.mcpServers.remote.env.PUBLIC, undefined);
});

test("import --force of secret-env, query-key, and a secret-valued allowed header writes no secrets, and a rebuild does not keep them", async () => {
  const { stepManifest } = require("../build-pipeline")._testables;
  const repo = path.join(__dirname, "..", "..", "..");
  const cli = path.join(repo, "bin", "cli.js");
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-fixture-secrets-"));
  const bearer = "Bearer abcdefghijklmnop";

  function forceImport(dir) {
    const outSpec = path.join(parent, `${path.basename(dir)}.agentspec.json`);
    const forced = spawnSync(process.execPath, [
      cli, "manifest", "import",
      "--dir", dir,
      "--out", outSpec,
      "--force",
    ], { encoding: "utf8" });
    assert.equal(forced.status, 0, forced.stderr);
    return JSON.parse(fs.readFileSync(outSpec, "utf8"));
  }

  const secretEnv = forceImport(path.join(repo, "schema", "fixtures", "invalid", "secret-env"));
  const secretPacked = JSON.stringify(secretEnv);
  assert.equal(secretPacked.includes("API_TOKEN"), false);
  assert.equal(secretPacked.includes("not-a-real-value"), false);

  const queryKey = forceImport(path.join(repo, "schema", "fixtures", "invalid", "query-key"));
  const queryPacked = JSON.stringify(queryKey);
  assert.equal(queryPacked.includes("code="), false);
  assert.equal(queryPacked.includes("?code"), false);
  assert.equal(queryKey.integrations[0].url, "https://example.com/mcp");

  const headerDir = path.join(parent, "query-key");
  fs.cpSync(path.join(repo, "schema", "fixtures", "invalid", "query-key"), headerDir, { recursive: true });
  const mcp = JSON.parse(fs.readFileSync(path.join(headerDir, "mcp.json"), "utf8"));
  mcp.mcpServers.remote.headers = { "X-Tenant": bearer };
  fs.writeFileSync(path.join(headerDir, "mcp.json"), JSON.stringify(mcp, null, 2));
  const headerSpec = forceImport(headerDir);
  const headerPacked = JSON.stringify(headerSpec);
  assert.equal(headerPacked.includes("Bearer"), false);
  assert.equal(headerPacked.includes("abcdefghijklmnop"), false);
  assert.equal(headerPacked.includes("code="), false);
  assert.equal(headerSpec.agentPlugin.mcpServers.remote.headers, undefined);

  async function rebuild(spec) {
    const agentDir = fs.mkdtempSync(path.join(parent, "build-"));
    const job = {
      steps: [{ id: "manifest", status: "pending", detail: null }],
      errors: [],
      rawLog: "",
      listeners: [],
    };
    await stepManifest(job, spec, agentDir);
    assert.equal(job.steps[0].status, "completed", job.rawLog);
    const carried = JSON.stringify(spec);
    const emitted = fs.readFileSync(path.join(agentDir, "plugin", spec.agentPlugin.name, "mcp.json"), "utf8");
    const model = fs.readFileSync(path.join(agentDir, "plugin", spec.agentPlugin.name, "agent-model.json"), "utf8");
    const built = `${carried}\n${emitted}\n${model}`;
    assert.equal(built.includes("API_TOKEN"), false, spec.agent.name);
    assert.equal(built.includes("not-a-real-value"), false, spec.agent.name);
    assert.equal(built.includes("code="), false, spec.agent.name);
    assert.equal(built.includes("Bearer"), false, spec.agent.name);
    assert.equal(built.includes("abcdefghijklmnop"), false, spec.agent.name);
  }

  await rebuild(secretEnv);
  await rebuild(queryKey);
  await rebuild(headerSpec);
});
