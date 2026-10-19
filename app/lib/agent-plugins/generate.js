"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { redact } = require("./mcp-stdio-server");
const { validatePluginDir, formatViolation, PLUGIN_SCHEMA_ID, MCP_SCHEMA_ID, isLoopback } = require("./validate");

const SERVER_SOURCE = fs.readFileSync(path.join(__dirname, "mcp-stdio-server.js"));
const NAME_PATTERN = /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const PUBLIC_HEADER_NAMES = new Set([
  "accept",
  "accept-language",
  "content-type",
  "user-agent",
  "x-tenant",
  "x-request-id",
  "x-correlation-id",
]);
const SECRET_VALUE = /(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|Bearer\s+\S{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;

function pluginNameFromAgent(agentName) {
  const raw = String(agentName || "").trim();
  let slug = raw.toLowerCase();
  slug = slug.replace(/[^a-z0-9.-]+/g, "-").replace(/([-.])\1+/g, "$1").replace(/^[-.]+|[-.]+$/g, "");
  if (slug.length > 64) slug = slug.slice(0, 64).replace(/[-.]+$/g, "");
  if (NAME_PATTERN.test(slug)) return slug;
  const digest = crypto.createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 8);
  return `agent-${digest}`;
}

function skillNameFromPlugin(name) {
  const skill = name.replace(/\./g, "-").replace(/--+/g, "-").replace(/^-|-$/g, "");
  if (!/^(?!.*--)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(skill)) {
    const error = new Error(`plugin name ${name} does not produce a skill name`);
    error.code = "SKILL_NAME";
    throw error;
  }
  return skill;
}

function specFileName(name) {
  const base = name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!/^[A-Z0-9_]+$/.test(base)) {
    const error = new Error(`plugin name ${name} does not produce a spec file name`);
    error.code = "SPEC_NAME";
    throw error;
  }
  return `specs/${base}.md`;
}

function clip(value, max) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return text.slice(0, max).trim();
}

function descriptionFor(spec, name) {
  const raw = spec.agent && typeof spec.agent.description === "string" ? spec.agent.description : "";
  const text = clip(raw, 1024);
  if (text) return text;
  return clip(`Copilot Studio agent ${name}. Read the packaged definition, including messaging topics and boundaries, from the local plugin.`, 1024);
}

function safeRemoteUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.username || url.password) return { url: null, reason: "remote MCP url contains user info" };
    if (url.hash) return { url: null, reason: "remote MCP url contains a fragment" };
    if (url.search) return { url: null, reason: "remote MCP url contains a query string" };
    if (url.protocol === "https:") return { url: url.toString(), reason: null };
    if (url.protocol === "http:" && isLoopback(url.hostname)) return { url: url.toString(), reason: null };
    return { url: null, reason: "remote MCP url is not https (or loopback http) without credentials" };
  } catch {
    return { url: null, reason: "remote MCP url is not an absolute URL" };
  }
}

function publicHeaders(headers) {
  const dropped = [];
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) return { kept: undefined, dropped };
  const kept = {};
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    const allowed = PUBLIC_HEADER_NAMES.has(lower) && typeof value === "string" && !/[\r\n]/.test(value) && !SECRET_VALUE.test(value);
    if (!allowed) {
      dropped.push(name);
      continue;
    }
    kept[name] = value;
  }
  return { kept: Object.keys(kept).length ? kept : undefined, dropped };
}

function serverKey(name, used) {
  let key = String(name || "remote").toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "") || "remote";
  if (key.length > 64) key = key.slice(0, 64).replace(/[-.]+$/g, "");
  const base = key;
  let n = 2;
  while (used.has(key)) {
    key = `${base}-${n}`;
    n += 1;
  }
  used.add(key);
  return key;
}

function selectedIntegrations(spec, pluginName) {
  const omitted = [];
  const servers = {};
  const used = new Set(pluginName ? [pluginName] : []);
  const integrations = Array.isArray(spec.integrations) ? spec.integrations : [];
  for (const item of integrations) {
    if (!item || typeof item !== "object") continue;
    if (item.type !== "mcp") continue;
    const rawUrl = item.url || item.endpoint || item.mcpUrl;
    if (!rawUrl) continue;
    const label = item.name || "remote";
    const decision = safeRemoteUrl(rawUrl);
    if (!decision.url) {
      omitted.push({ name: label, reason: decision.reason });
      continue;
    }
    const { kept, dropped } = publicHeaders(item.headers);
    if (dropped.length) {
      omitted.push({ name: label, reason: `${dropped.length} header(s) omitted because they are not on the public allow-list` });
    }
    const key = serverKey(item.name || "remote", used);
    servers[key] = kept
      ? { type: "streamable-http", url: decision.url, headers: kept }
      : { type: "streamable-http", url: decision.url };
  }
  return { servers, omitted };
}

function allowListModel(spec, pluginVersion) {
  const topics = spec.conversations && Array.isArray(spec.conversations.topics) ? spec.conversations.topics : [];
  return redact({
    pluginVersion,
    agent: {
      name: spec.agent && spec.agent.name ? String(spec.agent.name) : "",
      description: spec.agent && spec.agent.description ? String(spec.agent.description) : "",
      persona: spec.agent && spec.agent.persona ? String(spec.agent.persona) : "",
    },
    instructions: typeof spec.instructions === "string" ? spec.instructions : "",
    capabilities: (Array.isArray(spec.capabilities) ? spec.capabilities : []).map((entry) => ({
      name: entry && entry.name ? String(entry.name) : "",
      description: entry && entry.description ? String(entry.description) : "",
      phase: entry && entry.phase ? String(entry.phase) : "",
      implementationType: entry && entry.implementationType ? String(entry.implementationType) : "",
    })).filter((entry) => entry.name),
    conversations: {
      topics: topics.map((topic) => ({
        name: topic && topic.name ? String(topic.name) : "",
        description: topic && topic.description ? String(topic.description) : "",
        triggerType: topic && topic.triggerType ? String(topic.triggerType) : "",
      })).filter((topic) => topic.name),
    },
    boundaries: {
      handle: spec.boundaries && Array.isArray(spec.boundaries.handle) ? spec.boundaries.handle : [],
      decline: spec.boundaries && Array.isArray(spec.boundaries.decline) ? spec.boundaries.decline : [],
      refuse: spec.boundaries && Array.isArray(spec.boundaries.refuse) ? spec.boundaries.refuse : [],
    },
    integrations: (Array.isArray(spec.integrations) ? spec.integrations : []).map((item) => ({
      name: item && item.name ? String(item.name) : "",
      type: item && item.type ? String(item.type) : "",
      purpose: item && item.purpose ? String(item.purpose) : "",
      authMethod: item && item.authMethod ? String(item.authMethod) : "",
      phase: item && item.phase ? String(item.phase) : "",
      url: item ? (safeRemoteUrl(String(item.url || item.endpoint || "")).url || "") : "",
    })).filter((item) => item.name),
    knowledge: (Array.isArray(spec.knowledge) ? spec.knowledge : []).map((item) => ({
      name: item && item.name ? String(item.name) : "",
      type: item && item.type ? String(item.type) : "",
      purpose: item && item.purpose ? String(item.purpose) : "",
    })).filter((item) => item.name),
    architecture: {
      type: spec.architecture && spec.architecture.type ? String(spec.architecture.type) : "",
      channels: spec.architecture && Array.isArray(spec.architecture.channels) ? spec.architecture.channels : [],
      children: spec.architecture && Array.isArray(spec.architecture.children) ? spec.architecture.children : [],
    },
  });
}

function pluginIdentity(spec) {
  const meta = spec.agentPlugin && typeof spec.agentPlugin === "object" ? spec.agentPlugin : {};
  const extra = {};
  if (meta.author && typeof meta.author === "object" && !Array.isArray(meta.author)) {
    const author = {};
    if (typeof meta.author.name === "string" && meta.author.name.trim()) author.name = meta.author.name.trim();
    if (typeof meta.author.email === "string" && meta.author.email.trim()) author.email = meta.author.email.trim();
    if (typeof meta.author.url === "string" && meta.author.url.trim()) author.url = meta.author.url.trim();
    if (author.name) extra.author = author;
  }
  if (typeof meta.license === "string" && meta.license.trim()) extra.license = meta.license.trim();
  if (typeof meta.repository === "string" && meta.repository.trim()) extra.repository = meta.repository.trim();
  return extra;
}

function buildPackage(spec) {
  if (!spec || typeof spec !== "object" || !spec.agent || !spec.agent.name) {
    const error = new Error("agentspec is missing agent.name");
    error.code = "SPEC";
    throw error;
  }
  const name = pluginNameFromAgent(spec.agent.name);
  const skill = skillNameFromPlugin(name);
  const specPath = specFileName(name);
  const version = spec.agentPlugin && typeof spec.agentPlugin.version === "string" && spec.agentPlugin.version.trim()
    ? spec.agentPlugin.version.trim()
    : "0.1.0";
  const description = descriptionFor(spec, spec.agent.name);
  const { servers, omitted } = selectedIntegrations(spec, name);
  const model = allowListModel(spec, version);
  const plugin = {
    $schema: PLUGIN_SCHEMA_ID,
    name,
    version,
    description,
    ...pluginIdentity(spec),
    keywords: ["copilot-studio", skill],
    extensions: {
      "com.grokbot": {
        kind: "channel",
        spec: specPath,
        level: 0,
        capabilities: ["messaging"],
        approval: { required: true, scope: "per-use" },
        secretsPolicy: { plaintextToAgent: false, storage: "none" },
        runtimes: { core: "node-mcp-stdio", platforms: ["linux", "macos", "windows"] },
      },
    },
  };
  const mcp = {
    $schema: MCP_SCHEMA_ID,
    mcpServers: Object.assign({}, servers, {
      [name]: {
        type: "stdio",
        command: "node",
        args: ["${PLUGIN_ROOT}/core/dist/index.js"],
        cwd: "${PLUGIN_ROOT}",
      },
    }),
  };
  const skillDoc = `---\nname: ${skill}\ndescription: ${JSON.stringify(description)}\n---\n\n# ${skill}\n\nRead the packaged Copilot Studio agent definition over the local stdio MCP server. The messaging capability is the conversational contract (channels, topics, instructions, and boundaries) stored in this plugin. This skill does not call Copilot Studio or Dataverse.\n\n## Instructions\n\n${model.instructions || "No instructions are stored in the packaged definition."}\n`;
  const specDoc = `# ${spec.agent.name}\n\nCapability: messaging.\n\nThis file is the com.grokbot spec for the packaged Copilot Studio agent. The messaging capability is the conversational contract served by the local MCP server: channels, topics, instructions, and boundaries from the agent definition.\n\n${description}\n\n${omitted.length ? `## Omitted remote MCP servers\n\n${omitted.map((item) => `- ${item.name}: ${item.reason}`).join("\n")}\n` : ""}`;
  return {
    name,
    skill,
    omitted,
    files: {
      "plugin.json": `${JSON.stringify(plugin, null, 2)}\n`,
      "mcp.json": `${JSON.stringify(mcp, null, 2)}\n`,
      "agent-model.json": `${JSON.stringify(model, null, 2)}\n`,
      [specPath]: specDoc,
      [`skills/${skill}/SKILL.md`]: skillDoc,
      "core/src/index.js": SERVER_SOURCE,
      "core/dist/index.js": SERVER_SOURCE,
    },
  };
}

function replaceablePlugin(dest, name) {
  if (!fs.existsSync(dest)) return true;
  let stat;
  try {
    stat = fs.statSync(dest);
  } catch {
    return false;
  }
  if (!stat.isDirectory()) return false;
  const pluginPath = path.join(dest, "plugin.json");
  const modelPath = path.join(dest, "agent-model.json");
  if (!fs.existsSync(pluginPath) || !fs.existsSync(modelPath)) return false;
  try {
    const plugin = JSON.parse(fs.readFileSync(pluginPath, "utf8"));
    return Boolean(plugin && plugin.name === name);
  } catch {
    return false;
  }
}

function emitPlugin(spec, outDir, options) {
  const force = Boolean(options && options.force);
  const built = buildPackage(spec);
  const dest = path.resolve(outDir);
  if (path.basename(dest) !== built.name) {
    const error = new Error(`output directory must be named ${built.name}`);
    error.code = "OUTPUT_NAME";
    throw error;
  }
  if (fs.existsSync(dest) && !replaceablePlugin(dest, built.name) && !force) {
    const error = new Error(`refusing to replace ${dest}; it is not a ${built.name} plugin with plugin.json and agent-model.json. Pass --force`);
    error.code = "OUTPUT_EXISTS";
    throw error;
  }
  const parent = path.dirname(dest);
  fs.mkdirSync(parent, { recursive: true });
  const stage = fs.mkdtempSync(path.join(parent, ".plugin-stage-"));
  const tmp = path.join(stage, built.name);
  try {
    fs.mkdirSync(tmp);
    for (const [relative, content] of Object.entries(built.files)) {
      const file = path.join(tmp, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
    const validation = validatePluginDir(tmp);
    if (!validation.ok) {
      const error = new Error(validation.violations.map(formatViolation).join("\n"));
      error.code = "MANIFEST_INVALID";
      error.violations = validation.violations;
      throw error;
    }
    const backup = path.join(parent, `.${built.name}.bak-${crypto.randomBytes(4).toString("hex")}`);
    let backedUp = false;
    if (fs.existsSync(dest)) {
      fs.renameSync(dest, backup);
      backedUp = true;
    }
    try {
      fs.renameSync(tmp, dest);
    } catch (err) {
      if (backedUp && !fs.existsSync(dest)) {
        try { fs.renameSync(backup, dest); } catch { /* leave the backup in place */ }
      }
      throw err;
    }
    if (backedUp) fs.rmSync(backup, { recursive: true, force: true });
    fs.rmSync(stage, { recursive: true, force: true });
    return { name: built.name, outDir: dest, omitted: built.omitted, validation };
  } catch (err) {
    fs.rmSync(stage, { recursive: true, force: true });
    throw err;
  }
}

module.exports = {
  pluginNameFromAgent,
  skillNameFromPlugin,
  safeRemoteUrl,
  buildPackage,
  emitPlugin,
};
