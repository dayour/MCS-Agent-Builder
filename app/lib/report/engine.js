/**
 * Nunjucks template engine for HTML report generation.
 * Autoescaping is ON by default — all {{ var }} output is HTML-escaped.
 */
const nunjucks = require("nunjucks");
const path = require("path");

const TEMPLATES_DIR = path.join(__dirname, "templates");

const env = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(TEMPLATES_DIR),
  { autoescape: true, throwOnUndefined: false, trimBlocks: true, lstripBlocks: true }
);

// ── Custom Filters ──────────────────────────────────────────────

env.addFilter("date", (val) => {
  if (val == null || val === "") return "\u2014";
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
});

env.addFilter("number", (val) => {
  if (val == null || val === "") return "\u2014";
  const n = Number(val);
  if (!Number.isFinite(n)) return "\u2014";
  return n.toLocaleString("en-US");
});

env.addFilter("percent", (val) => {
  if (val == null || val === "") return "\u2014";
  const n = Number(val);
  if (!Number.isFinite(n)) return "\u2014";
  return `${Math.round(n)}%`;
});

env.addFilter("truncate_text", (val, len = 120) => {
  if (!val || typeof val !== "string") return "";
  return val.length > len ? val.slice(0, len) + "\u2026" : val;
});

env.addFilter("phase_class", (phase) => {
  if (!phase) return "";
  const p = String(phase).toLowerCase();
  if (p === "mvp") return "status-mvp";
  if (p === "future") return "status-future";
  return "";
});

env.addFilter("status_class", (status) => {
  if (!status) return "";
  const s = String(status).toLowerCase();
  const map = {
    pending: "status-pending", confirmed: "status-confirmed", overridden: "status-overridden",
    resolved: "status-confirmed", open: "status-pending",
    available: "status-confirmed", passing: "status-confirmed", failing: "status-failing",
    mvp: "status-mvp", future: "status-future",
    draft: "status-draft", researched: "status-pending", ready: "status-mvp", built: "status-confirmed",
  };
  return map[s] || "";
});

env.addFilter("safe_val", (val) => {
  if (val == null || val === "") return "\u2014";
  return String(val);
});

// Convert array of objects to array of arrays (for data_table macro)
env.addFilter("map_rows", (arr, keys) => {
  if (!Array.isArray(arr) || !Array.isArray(keys)) return [];
  return arr.map(item => keys.map(k =>
    (item && typeof item === "object" && item[k] != null) ? String(item[k]) : ""
  ));
});

// Sum a numeric field across an array of objects
env.addFilter("sum_field", (arr, field) => {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((sum, item) =>
    sum + (item && typeof item === "object" ? (Number(item[field]) || 0) : 0), 0);
});

// Jargon replacement for customer reports
const JARGON_MAP = {
  "PAC CLI": "", "Dataverse": "data storage", "LSP": "", "YAML": "configuration",
  "PowerFx": "formula", "MCP": "service connection", "JSON": "", "API": "service",
  "OAuth": "secure sign-in", "Service Principal": "automated access",
  "Connector": "connection", "Knowledge source": "data source",
  "Declarative agent": "configuration-based agent", "Custom agent": "custom-built agent",
  "First-party agent": "Microsoft's built-in agent", "Frontier agent": "Microsoft's advanced built-in agent",
  "Topic": "conversation flow",
};

env.addFilter("jargon", (text) => {
  if (!text || typeof text !== "string") return text || "";
  let result = text;
  for (const [term, replacement] of Object.entries(JARGON_MAP)) {
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    result = replacement ? result.replace(regex, replacement) : result.replace(regex, "").replace(/\s{2,}/g, " ").trim();
  }
  return result;
});

// ── Microsoft Logo SVG (inline) ─────────────────────────────────

const MS_LOGO_SVG = `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="7" height="7" fill="#F35325"/>
  <rect x="9" y="0" width="7" height="7" fill="#81BC06"/>
  <rect x="0" y="9" width="7" height="7" fill="#05A6F0"/>
  <rect x="9" y="9" width="7" height="7" fill="#FFBA08"/>
</svg>`;

env.addGlobal("ms_logo_svg", new nunjucks.runtime.SafeString(MS_LOGO_SVG));
env.addGlobal("current_year", new Date().getFullYear());

module.exports = { env };
