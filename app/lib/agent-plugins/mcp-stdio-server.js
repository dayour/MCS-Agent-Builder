"use strict";

/**
 * Stdio MCP server for a packaged Copilot Studio agent definition.
 *
 * The process reads agent-model.json from the plugin root and answers
 * tools/list and tools/call from that file. It does not call Copilot Studio,
 * Dataverse, or any network. Tool results are the packaged definition with
 * secret-shaped keys and values removed.
 *
 * This file is copied verbatim into plugin packages at core/dist/index.js.
 * It must not require anything outside Node's standard library.
 */

const fs = require("fs");
const path = require("path");

const PROTOCOL_VERSION = "2024-11-05";

const SECRET_KEY = /(?:secret|password|passwd|token|api[-_]?key|credential|authorization|connectionstring|connstring)/i;
const SECRET_VALUE = /(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|Bearer\s+[A-Za-z0-9._~+/-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;

const TOOLS = [
  {
    name: "describe_agent",
    description: "Return the packaged Copilot Studio agent's name, description, persona, instructions, and messaging channels.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_capabilities",
    description: "Return the capabilities stored in the packaged agent definition.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_capability",
    description: "Return one packaged capability by its exact name.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", minLength: 1 } },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "list_topics",
    description: "Return the conversational topics stored in the packaged agent definition.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_boundaries",
    description: "Return the handle, decline, and refuse boundaries stored in the packaged agent definition.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_integrations",
    description: "Return the packaged integrations with secret-shaped fields removed.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_knowledge",
    description: "Return the knowledge sources stored in the packaged agent definition.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (SECRET_KEY.test(key)) continue;
      out[key] = redact(child);
    }
    return out;
  }
  if (typeof value === "string" && SECRET_VALUE.test(value)) return "[redacted]";
  return value;
}

function textResult(value, isError) {
  const payload = typeof value === "string" ? value : JSON.stringify(redact(value));
  return {
    content: [{ type: "text", text: payload }],
    isError: Boolean(isError),
  };
}

function resolveRoot() {
  const fromEnv = process.env.PLUGIN_ROOT;
  if (typeof fromEnv === "string" && fromEnv.trim()) return path.resolve(fromEnv);
  const fromLayout = path.resolve(__dirname, "..", "..");
  if (fs.existsSync(path.join(fromLayout, "plugin.json")) || fs.existsSync(path.join(fromLayout, "agent-model.json"))) {
    return fromLayout;
  }
  return fromLayout;
}

function loadModel(root) {
  const modelPath = path.join(root, "agent-model.json");
  if (!fs.existsSync(modelPath)) {
    const error = new Error("agent-model.json is missing from the plugin root");
    error.code = "MODEL_MISSING";
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(modelPath, "utf8"));
  } catch {
    const error = new Error("agent-model.json is not valid JSON");
    error.code = "MODEL_INVALID";
    throw error;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    const error = new Error("agent-model.json must be a JSON object");
    error.code = "MODEL_INVALID";
    throw error;
  }
  return parsed;
}

function callTool(model, name, args) {
  const safeArgs = args && typeof args === "object" && !Array.isArray(args) ? args : {};
  switch (name) {
    case "describe_agent":
      return textResult({
        name: model.agent && model.agent.name ? model.agent.name : "",
        description: model.agent && model.agent.description ? model.agent.description : "",
        persona: model.agent && model.agent.persona ? model.agent.persona : "",
        instructions: typeof model.instructions === "string" ? model.instructions : "",
        channels: model.architecture && Array.isArray(model.architecture.channels) ? model.architecture.channels : [],
      });
    case "list_capabilities":
      return textResult(Array.isArray(model.capabilities) ? model.capabilities : []);
    case "get_capability": {
      if (typeof safeArgs.name !== "string" || !safeArgs.name.trim()) {
        return textResult("get_capability requires a non-empty string name", true);
      }
      const capabilities = Array.isArray(model.capabilities) ? model.capabilities : [];
      const found = capabilities.find((entry) => entry && entry.name === safeArgs.name);
      if (!found) {
        const known = capabilities.map((entry) => entry && entry.name).filter(Boolean);
        return textResult(
          `No capability named ${JSON.stringify(safeArgs.name)}. Known: ${known.join(", ") || "(none)"}`,
          true,
        );
      }
      return textResult(found);
    }
    case "list_topics": {
      const topics = model.conversations && Array.isArray(model.conversations.topics)
        ? model.conversations.topics
        : [];
      return textResult(topics);
    }
    case "list_boundaries":
      return textResult(model.boundaries && typeof model.boundaries === "object" ? model.boundaries : {
        handle: [],
        decline: [],
        refuse: [],
      });
    case "list_integrations":
      return textResult(Array.isArray(model.integrations) ? model.integrations : []);
    case "list_knowledge":
      return textResult(Array.isArray(model.knowledge) ? model.knowledge : []);
    default:
      return textResult(`Unknown tool ${JSON.stringify(name)}`, true);
  }
}

function handleRpc(model, modelError, message) {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "invalid request" } };
  }
  const id = Object.prototype.hasOwnProperty.call(message, "id") ? message.id : undefined;
  const method = message.method;
  if (typeof method !== "string") {
    return { jsonrpc: "2.0", id: id === undefined ? null : id, error: { code: -32600, message: "invalid request" } };
  }
  if (id === undefined) {
    return null;
  }
  if (method === "initialize") {
    const infoName = model && model.agent && model.agent.name ? model.agent.name : "mcs-agent-plugin";
    const infoVersion = model && typeof model.pluginVersion === "string" ? model.pluginVersion : "0.1.0";
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: infoName, version: infoVersion },
      },
    };
  }
  if (method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }
  if (modelError) {
    return { jsonrpc: "2.0", id, error: { code: -32000, message: modelError } };
  }
  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  }
  if (method === "tools/call") {
    const params = message.params && typeof message.params === "object" ? message.params : {};
    const name = params.name;
    if (typeof name !== "string" || !TOOLS.some((tool) => tool.name === name)) {
      return { jsonrpc: "2.0", id, result: textResult(`Unknown tool ${JSON.stringify(name)}`, true) };
    }
    return { jsonrpc: "2.0", id, result: callTool(model, name, params.arguments) };
  }
  return { jsonrpc: "2.0", id, error: { code: -32601, message: `method not found: ${method}` } };
}

class FrameParser {
  constructor(onMessage) {
    this.buffer = Buffer.alloc(0);
    this.onMessage = onMessage;
  }

  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
    for (;;) {
      while (this.buffer.length && (this.buffer[0] === 0x0a || this.buffer[0] === 0x0d)) {
        this.buffer = this.buffer.subarray(1);
      }
      if (!this.buffer.length) return;
      const head = this.buffer.subarray(0, Math.min(this.buffer.length, 20)).toString("utf8").toLowerCase();
      if (head.startsWith("content-length")) {
        const sep = this.buffer.indexOf("\r\n\r\n");
        if (sep < 0) return;
        const header = this.buffer.subarray(0, sep).toString("utf8");
        const match = header.match(/content-length:\s*(\d+)/i);
        if (!match) {
          this.onMessage({ error: "missing content-length" });
          this.buffer = this.buffer.subarray(sep + 4);
          continue;
        }
        const length = Number(match[1]);
        if (!Number.isSafeInteger(length) || length < 0 || length > 8 * 1024 * 1024) {
          this.onMessage({ error: "invalid content-length" });
          this.buffer = Buffer.alloc(0);
          return;
        }
        const start = sep + 4;
        if (this.buffer.length < start + length) return;
        const body = this.buffer.subarray(start, start + length).toString("utf8");
        this.buffer = this.buffer.subarray(start + length);
        this.emitJson(body);
        continue;
      }
      const newline = this.buffer.indexOf(0x0a);
      if (newline < 0) return;
      const line = this.buffer.subarray(0, newline).toString("utf8").replace(/\r$/, "");
      this.buffer = this.buffer.subarray(newline + 1);
      if (!line.trim()) continue;
      this.emitJson(line);
    }
  }

  emitJson(text) {
    try {
      this.onMessage({ message: JSON.parse(text) });
    } catch {
      this.onMessage({ error: "invalid json" });
    }
  }
}

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function main() {
  const root = resolveRoot();
  let model = null;
  let modelError = null;
  try {
    model = loadModel(root);
  } catch (err) {
    modelError = err && err.message ? err.message : "agent model could not be loaded";
  }
  const parser = new FrameParser((event) => {
    if (event.error) {
      writeMessage({ jsonrpc: "2.0", id: null, error: { code: -32700, message: event.error } });
      return;
    }
    const response = handleRpc(model, modelError, event.message);
    if (response) writeMessage(response);
  });
  process.stdin.on("data", (chunk) => parser.push(chunk));
  process.stdin.on("error", () => {
    process.exitCode = 1;
  });
  process.stdin.on("end", () => {
    process.exit(process.exitCode || 0);
  });
}

if (require.main === module) main();

module.exports = {
  PROTOCOL_VERSION,
  TOOLS,
  redact,
  resolveRoot,
  loadModel,
  callTool,
  handleRpc,
  FrameParser,
};
