"use strict";

const fs = require("fs");
const path = require("path");
const { loadAjv2020 } = require("./load-ajv");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const SCHEMA_DIR = path.join(REPO_ROOT, "schema");
const PLUGIN_SCHEMA_PATH = path.join(SCHEMA_DIR, "vendor", "plugin.schema.json");
const MCP_SCHEMA_PATH = path.join(SCHEMA_DIR, "vendor", "mcp.schema.json");
const EXTENSION_SCHEMA_PATH = path.join(SCHEMA_DIR, "grokbot-extension.schema.json");

const PLUGIN_SCHEMA_ID = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
const MCP_SCHEMA_ID = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";
const EXTENSION_NAMESPACE = "com.grokbot";

const SECRET_KEY = /(?:^|[^a-z])(?:secret|password|passwd|token|api[-_]?key|credential|private[-_]?key|client[-_]?secret|connectionstring|connstring)(?:[^a-z]|$)/i;
const SECRET_VALUE = /(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|Bearer\s+\S{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;
const CREDENTIAL_HEADERS = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "api-key",
  "x-auth-token",
  "x-access-token",
]);
const SKILL_NAME = /^(?!.*--)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

let compiled;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getValidators() {
  if (compiled) return compiled;
  const Ajv2020 = loadAjv2020();
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateSchema: false });
  compiled = {
    plugin: ajv.compile(readJson(PLUGIN_SCHEMA_PATH)),
    mcp: ajv.compile(readJson(MCP_SCHEMA_PATH)),
    extension: ajv.compile(readJson(EXTENSION_SCHEMA_PATH)),
  };
  return compiled;
}

function violation(file, pointer, message, rule) {
  return { file, pointer: pointer || "/", message, rule };
}

function pointerOf(err) {
  let pointer = err.instancePath || "";
  if (err.params && err.params.missingProperty) pointer += `/${err.params.missingProperty}`;
  if (err.params && err.params.additionalProperty) pointer += `/${err.params.additionalProperty}`;
  return pointer || "/";
}

function schemaViolations(file, validate, data, rule, prefix) {
  if (validate(data)) return [];
  return (validate.errors || []).map((err) => violation(
    file,
    `${prefix || ""}${pointerOf(err)}`,
    err.message || "schema violation",
    rule,
  ));
}

function jsonPointerSegment(key) {
  return String(key).replace(/~/g, "~0").replace(/\//g, "~1");
}

function walkStrings(value, pointer, visit) {
  if (typeof value === "string") {
    visit(pointer, value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkStrings(entry, `${pointer}/${index}`, visit));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      walkStrings(child, `${pointer}/${jsonPointerSegment(key)}`, visit);
    }
  }
}

function schemaVersion(schemaId) {
  const match = String(schemaId || "").match(/\/schemas\/(\d+\.\d+\.\d+)\//);
  return match ? match[1] : null;
}

function isSingleTokenCommand(command) {
  if (typeof command !== "string" || !command) return false;
  if (command.includes("${") || /\s/.test(command)) return false;
  if (/[;&|`$<>\\\n\r]/.test(command) || command.includes("..")) return false;
  if (/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(command)) return true;
  return /^\.\/[A-Za-z0-9._+/-]+$/.test(command) && !command.includes("//");
}

function cwdEscapes(cwd) {
  if (typeof cwd !== "string") return true;
  const normalized = cwd.replace(/\\/g, "/");
  if (!/^(?:\.\/|\$\{PLUGIN_ROOT\}(?:\/|$)|\$\{PLUGIN_DATA\}(?:\/|$))/.test(normalized)) return true;
  const rest = normalized.startsWith("./") ? normalized.slice(2) : normalized.slice(normalized.indexOf("}") + 1);
  return rest.split("/").some((part) => part === "..");
}

function resolvePackagePath(pluginRoot, ref) {
  if (typeof ref !== "string") return null;
  let relative = null;
  if (ref.startsWith("${PLUGIN_ROOT}/")) relative = ref.slice("${PLUGIN_ROOT}/".length);
  else if (ref.startsWith("./")) relative = ref.slice(2);
  else return null;
  if (relative.includes("${") || relative.split("/").includes("..")) {
    return { error: "path escapes the plugin root" };
  }
  const root = path.resolve(pluginRoot);
  const abs = path.resolve(root, relative);
  if (abs !== root && !abs.startsWith(root + path.sep)) return { error: "path escapes the plugin root" };
  return { abs };
}

function isLoopback(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1") return true;
  const parts = host.split(".").map((part) => Number(part));
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) && parts[0] === 127;
}

function checkRemoteUrl(file, pointer, raw) {
  const found = [];
  let url;
  try {
    url = new URL(raw);
  } catch {
    found.push(violation(file, pointer, "remote url is not an absolute URL", "remote-url"));
    return found;
  }
  if (url.username || url.password) {
    found.push(violation(file, pointer, "remote url must not contain user info", "remote-url"));
  }
  if (url.hash) found.push(violation(file, pointer, "remote url must not contain a fragment", "remote-url"));
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    found.push(violation(file, pointer, "remote url must be http or https", "remote-url"));
  } else if (url.protocol === "http:" && !isLoopback(url.hostname)) {
    found.push(violation(file, pointer, "non-loopback remote url must use https", "remote-url"));
  }
  return found;
}

function checkHeaders(file, pointer, headers) {
  const found = [];
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) return found;
  const seen = new Map();
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (seen.has(lower)) {
      found.push(violation(file, `${pointer}/${jsonPointerSegment(name)}`, `duplicate header ${lower}`, "header-secret"));
    }
    seen.set(lower, name);
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) {
      found.push(violation(file, `${pointer}/${jsonPointerSegment(name)}`, "invalid HTTP header name", "header-secret"));
    }
    if (typeof value !== "string" || /[\r\n]/.test(value)) {
      found.push(violation(file, `${pointer}/${jsonPointerSegment(name)}`, "invalid HTTP header value", "header-secret"));
      continue;
    }
    if (CREDENTIAL_HEADERS.has(lower) || SECRET_KEY.test(name) || SECRET_VALUE.test(value)) {
      found.push(violation(file, `${pointer}/${jsonPointerSegment(name)}`, "header carries a credential", "header-secret"));
    }
  }
  return found;
}

function parseFrontmatter(text) {
  const source = String(text || "").replace(/^\uFEFF/, "");
  if (!source.startsWith("---\n") && !source.startsWith("---\r\n")) {
    return { error: "SKILL.md is missing opening frontmatter" };
  }
  const newline = source.indexOf("\n");
  const end = source.indexOf("\n---", newline + 1);
  if (end < 0) return { error: "SKILL.md frontmatter is unterminated" };
  const block = source.slice(newline + 1, end).replace(/\r/g, "");
  const lines = block.split("\n");
  const data = {};
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!match) return { error: `SKILL.md frontmatter could not be parsed at ${JSON.stringify(line)}` };
    const key = match[1];
    let value = match[2];
    if (value === ">-" || value === ">" || value === "|" || value === "|-") {
      const folded = value.startsWith(">");
      const collected = [];
      index += 1;
      while (index < lines.length && (lines[index].startsWith(" ") || lines[index].startsWith("\t") || !lines[index].trim())) {
        collected.push(lines[index].trim());
        index += 1;
      }
      index -= 1;
      value = folded ? collected.filter(Boolean).join(" ") : collected.join("\n");
    } else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return { data };
}

function checkSkills(pluginRoot) {
  const found = [];
  const skillsDir = path.join(pluginRoot, "skills");
  if (!fs.existsSync(skillsDir) || !fs.statSync(skillsDir).isDirectory()) {
    found.push(violation("skills", "/", "plugin has no skills directory", "skill-missing"));
    return found;
  }
  const children = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const skillDirs = children.filter((entry) => fs.existsSync(path.join(skillsDir, entry.name, "SKILL.md")));
  if (skillDirs.length === 0) {
    found.push(violation("skills", "/", "plugin has no skills/<name>/SKILL.md", "skill-missing"));
    return found;
  }
  for (const entry of skillDirs) {
    const relative = path.join("skills", entry.name, "SKILL.md");
    let text;
    try {
      text = fs.readFileSync(path.join(skillsDir, entry.name, "SKILL.md"), "utf8");
    } catch (err) {
      found.push(violation(relative, "/", err.message, "skill-frontmatter"));
      continue;
    }
    const parsed = parseFrontmatter(text);
    if (parsed.error) {
      found.push(violation(relative, "/", parsed.error, "skill-frontmatter"));
      continue;
    }
    const name = parsed.data.name;
    const description = parsed.data.description;
    if (typeof name !== "string" || !SKILL_NAME.test(name) || name.length < 1 || name.length > 64) {
      found.push(violation(relative, "/name", "skill name must be kebab-case, 1-64 characters", "skill-frontmatter"));
    } else if (name !== entry.name) {
      found.push(violation(relative, "/name", `skill name ${name} does not equal folder ${entry.name}`, "skill-frontmatter"));
    }
    if (typeof description !== "string" || description.length < 1 || description.length > 1024) {
      found.push(violation(relative, "/description", "skill description must be 1-1024 characters", "skill-frontmatter"));
    }
  }
  return found;
}

function checkLevel(pluginRoot, extension) {
  const level = extension && extension.level;
  if (typeof level !== "number" || level <= 0) return [];
  const evidenceNames = ["CONFORMANCE.md", "ROADMAP.md"];
  for (const name of evidenceNames) {
    const full = path.join(pluginRoot, name);
    if (!fs.existsSync(full)) continue;
    const text = fs.readFileSync(full, "utf8");
    const pattern = new RegExp(`(?:level\\s*[:=]?\\s*${level}|L${level})[\\s\\S]{0,240}pass`, "i");
    if (pattern.test(text)) return [];
  }
  return [violation(
    "plugin.json",
    "/extensions/com.grokbot/level",
    `level ${level} has no recorded validation-round pass in CONFORMANCE.md or ROADMAP.md`,
    "level-inflated",
  )];
}

function checkInside(pluginRoot, relativePath) {
  const root = path.resolve(pluginRoot);
  const abs = path.resolve(root, relativePath);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return abs;
}

function validatePluginDir(dir) {
  const violations = [];
  const pluginRoot = path.resolve(dir);
  const folderName = path.basename(pluginRoot);
  const pluginFile = path.join(pluginRoot, "plugin.json");
  const mcpFile = path.join(pluginRoot, "mcp.json");
  if (!fs.existsSync(pluginFile)) {
    return { ok: false, violations: [violation("plugin.json", "/", "plugin.json is missing", "plugin-schema")] };
  }
  let plugin;
  let mcp;
  try {
    plugin = readJson(pluginFile);
  } catch (err) {
    return { ok: false, violations: [violation("plugin.json", "/", `plugin.json is not valid JSON (${err.message})`, "plugin-schema")] };
  }
  const validators = getValidators();
  violations.push(...schemaViolations("plugin.json", validators.plugin, plugin, "plugin-schema"));
  if (!plugin || typeof plugin !== "object" || Array.isArray(plugin)) {
    return { ok: false, violations };
  }
  if (plugin.name !== folderName) {
    violations.push(violation("plugin.json", "/name", `name ${JSON.stringify(plugin.name)} does not equal folder ${folderName}`, "name-folder"));
  }
  walkStrings(plugin, "", (pointer, value) => {
    if (SECRET_VALUE.test(value)) {
      violations.push(violation("plugin.json", pointer || "/", "string contains a secret", "manifest-secret"));
    }
  });

  const extensions = plugin.extensions;
  const grokbot = extensions && typeof extensions === "object" ? extensions[EXTENSION_NAMESPACE] : undefined;
  if (!grokbot || typeof grokbot !== "object" || Array.isArray(grokbot)) {
    violations.push(violation("plugin.json", "/extensions/com.grokbot", "extensions[\"com.grokbot\"] is required", "extension-missing"));
  } else {
    violations.push(...schemaViolations("plugin.json", validators.extension, grokbot, "extension-schema", "/extensions/com.grokbot"));
    if (typeof grokbot.spec === "string") {
      const specAbs = checkInside(pluginRoot, grokbot.spec);
      if (!specAbs || !fs.existsSync(specAbs) || !fs.statSync(specAbs).isFile()) {
        violations.push(violation("plugin.json", "/extensions/com.grokbot/spec", `spec file ${grokbot.spec} does not exist`, "spec-file"));
      } else {
        const specText = fs.readFileSync(specAbs, "utf8");
        for (const capability of Array.isArray(grokbot.capabilities) ? grokbot.capabilities : []) {
          if (!specText.includes(capability)) {
            violations.push(violation(
              grokbot.spec,
              "/capabilities",
              `capability ${capability} is not named by the spec file`,
              "capability-spec",
            ));
          }
        }
      }
    }
    if (grokbot.kind === "secret-sync" && (!grokbot.secretsPolicy || grokbot.secretsPolicy.direction !== "write-only")) {
      violations.push(violation(
        "plugin.json",
        "/extensions/com.grokbot/secretsPolicy/direction",
        "secret-sync plugins must set secretsPolicy.direction to write-only",
        "secret-sync-direction",
      ));
    }
    if (grokbot.bindings && typeof grokbot.bindings === "object") {
      for (const [runtime, bindingPath] of Object.entries(grokbot.bindings)) {
        if (typeof bindingPath !== "string") continue;
        const abs = checkInside(pluginRoot, bindingPath);
        if (!abs || bindingPath.startsWith("/") || bindingPath.split(/[\\/]/).includes("..") || !fs.existsSync(abs)) {
          violations.push(violation(
            "plugin.json",
            `/extensions/com.grokbot/bindings/${runtime}`,
            `binding path ${bindingPath} does not exist inside the plugin`,
            "binding-path",
          ));
        }
      }
    }
    violations.push(...checkLevel(pluginRoot, grokbot));
  }

  if (!fs.existsSync(mcpFile)) {
    violations.push(violation("mcp.json", "/", "mcp.json is missing", "mcp-schema"));
  } else {
    try {
      mcp = readJson(mcpFile);
    } catch (err) {
      violations.push(violation("mcp.json", "/", `mcp.json is not valid JSON (${err.message})`, "mcp-schema"));
    }
  }
  if (mcp && typeof mcp === "object" && !Array.isArray(mcp)) {
    violations.push(...schemaViolations("mcp.json", validators.mcp, mcp, "mcp-schema"));
    if (schemaVersion(plugin.$schema) && schemaVersion(mcp.$schema) && schemaVersion(plugin.$schema) !== schemaVersion(mcp.$schema)) {
      violations.push(violation("mcp.json", "/$schema", "mcp.json schema version does not match plugin.json", "schema-version"));
    }
    if (plugin.$schema === PLUGIN_SCHEMA_ID && mcp.$schema && mcp.$schema !== MCP_SCHEMA_ID) {
      violations.push(violation("mcp.json", "/$schema", "mcp.json $schema does not match plugin.json Agent Plugins version", "schema-version"));
    }
    walkStrings(mcp, "", (pointer, value) => {
      if (SECRET_VALUE.test(value)) violations.push(violation("mcp.json", pointer || "/", "string contains a secret", "manifest-secret"));
    });
    const servers = mcp.mcpServers && typeof mcp.mcpServers === "object" ? mcp.mcpServers : {};
    for (const [serverName, server] of Object.entries(servers)) {
      if (!server || typeof server !== "object") continue;
      const base = `/mcpServers/${jsonPointerSegment(serverName)}`;
      if (server.type === "stdio") {
        if (!isSingleTokenCommand(server.command)) {
          violations.push(violation("mcp.json", `${base}/command`, "stdio command must be one executable token", "command-token"));
        } else if (String(server.command).startsWith("./")) {
          const resolved = resolvePackagePath(pluginRoot, server.command);
          if (!resolved || resolved.error || !fs.existsSync(resolved.abs)) {
            violations.push(violation("mcp.json", `${base}/command`, "relative command does not exist in the plugin", "core-path"));
          }
        }
        if (server.cwd !== undefined && cwdEscapes(server.cwd)) {
          violations.push(violation("mcp.json", `${base}/cwd`, "cwd must stay under ./, ${PLUGIN_ROOT}, or ${PLUGIN_DATA}", "cwd-containment"));
        }
        if (server.env && typeof server.env === "object") {
          for (const [key, value] of Object.entries(server.env)) {
            if (key === "PLUGIN_ROOT" || key === "PLUGIN_DATA" || SECRET_KEY.test(key) || (typeof value === "string" && SECRET_VALUE.test(value))) {
              violations.push(violation("mcp.json", `${base}/env/${jsonPointerSegment(key)}`, "env entry is reserved or secret", "env-secret"));
            }
          }
        }
        const args = Array.isArray(server.args) ? server.args : [];
        let pointedAtCore = String(server.command).startsWith("./");
        for (const [index, arg] of args.entries()) {
          if (typeof arg !== "string") continue;
          if (!arg.startsWith("./") && !arg.startsWith("${PLUGIN_ROOT}/")) continue;
          pointedAtCore = true;
          const resolved = resolvePackagePath(pluginRoot, arg);
          if (!resolved || resolved.error || !fs.existsSync(resolved.abs) || !fs.statSync(resolved.abs).isFile()) {
            violations.push(violation("mcp.json", `${base}/args/${index}`, "arg path does not exist inside the plugin", "core-path"));
          }
        }
        if (server.command === "node" && !pointedAtCore) {
          violations.push(violation("mcp.json", `${base}/args`, "node stdio server args must point at a file in the plugin", "core-path"));
        }
      }
      if (server.type === "streamable-http" || server.type === "sse") {
        violations.push(...checkRemoteUrl("mcp.json", `${base}/url`, server.url));
        violations.push(...checkHeaders("mcp.json", `${base}/headers`, server.headers));
      }
    }
  }

  violations.push(...checkSkills(pluginRoot));
  return { ok: violations.length === 0, violations };
}

function formatViolation(item) {
  return `${item.file} ${item.pointer}: ${item.message} [${item.rule}]`;
}

module.exports = {
  REPO_ROOT,
  SCHEMA_DIR,
  PLUGIN_SCHEMA_PATH,
  MCP_SCHEMA_PATH,
  EXTENSION_SCHEMA_PATH,
  PLUGIN_SCHEMA_ID,
  MCP_SCHEMA_ID,
  validatePluginDir,
  formatViolation,
  parseFrontmatter,
  isSingleTokenCommand,
  schemaVersion,
};
