"use strict";

const fs = require("fs");
const path = require("path");
const { validatePluginDir, parseFrontmatter } = require("./validate");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function skillRecords(pluginRoot) {
  const skillsDir = path.join(pluginRoot, "skills");
  if (!fs.existsSync(skillsDir)) return [];
  const records = [];
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillFile)) continue;
    const text = fs.readFileSync(skillFile, "utf8");
    const parsed = parseFrontmatter(text);
    const body = text.replace(/^---[\s\S]*?\n---\s*/, "");
    records.push({
      name: parsed.data && parsed.data.name ? parsed.data.name : entry.name,
      description: parsed.data && parsed.data.description ? parsed.data.description : "",
      body: body.trim(),
    });
  }
  return records;
}

function importPlugin(dir) {
  const pluginRoot = path.resolve(dir);
  const validation = validatePluginDir(pluginRoot);
  const pluginPath = path.join(pluginRoot, "plugin.json");
  const mcpPath = path.join(pluginRoot, "mcp.json");
  if (!fs.existsSync(pluginPath)) {
    const error = new Error("plugin.json is missing");
    error.code = "PLUGIN_MISSING";
    error.validation = validation;
    throw error;
  }
  const plugin = readJson(pluginPath);
  const mcp = fs.existsSync(mcpPath) ? readJson(mcpPath) : { mcpServers: {} };
  const skills = skillRecords(pluginRoot);
  let model = null;
  const modelPath = path.join(pluginRoot, "agent-model.json");
  if (fs.existsSync(modelPath)) {
    const parsed = readJson(modelPath);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) model = parsed;
  }
  const extension = plugin.extensions && plugin.extensions["com.grokbot"] ? plugin.extensions["com.grokbot"] : null;
  const agentName = model && model.agent && model.agent.name ? model.agent.name : plugin.name;
  const agentDescription = model && model.agent && model.agent.description
    ? model.agent.description
    : (plugin.description || "");
  const integrations = model && Array.isArray(model.integrations) ? model.integrations.slice() : [];
  const knownUrls = new Set(integrations.map((item) => item && (item.url || item.endpoint)).filter(Boolean));
  const servers = mcp.mcpServers && typeof mcp.mcpServers === "object" ? mcp.mcpServers : {};
  for (const [serverName, server] of Object.entries(servers)) {
    if (!server || (server.type !== "streamable-http" && server.type !== "sse")) continue;
    if (!server.url || knownUrls.has(server.url)) continue;
    integrations.push({
      name: serverName,
      type: "mcp",
      purpose: `MCP server ${serverName} from mcp.json`,
      url: server.url,
      phase: "mvp",
    });
  }
  const capabilities = model && Array.isArray(model.capabilities) && model.capabilities.length
    ? model.capabilities
    : (extension && Array.isArray(extension.capabilities) ? extension.capabilities : []).map((name) => ({
      name,
      description: `Declared com.grokbot capability ${name}.`,
      phase: "mvp",
    }));
  const spec = {
    _schema: "2.0",
    agent: {
      name: agentName,
      description: agentDescription,
      persona: model && model.agent && model.agent.persona ? model.agent.persona : "",
    },
    instructions: model && typeof model.instructions === "string"
      ? model.instructions
      : (skills[0] ? skills[0].body : ""),
    capabilities,
    conversations: model && model.conversations ? model.conversations : { topics: [] },
    boundaries: model && model.boundaries ? model.boundaries : { handle: [], decline: [], refuse: [] },
    integrations,
    knowledge: model && Array.isArray(model.knowledge) ? model.knowledge : [],
    architecture: model && model.architecture ? model.architecture : { channels: [], children: [] },
    agentPlugin: {
      directory: path.basename(pluginRoot),
      name: plugin.name,
      version: plugin.version || "",
      description: plugin.description || "",
      license: plugin.license || "",
      repository: plugin.repository || "",
      homepage: plugin.homepage || "",
      keywords: Array.isArray(plugin.keywords) ? plugin.keywords : [],
      schema: plugin.$schema,
      extension,
      mcpServers: servers,
      skills: skills.map((skill) => ({ name: skill.name, description: skill.description })),
    },
  };
  return { spec, validation };
}

module.exports = { importPlugin };
