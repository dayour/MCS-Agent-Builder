/**
 * Dev Logger — Backend middleware + frontend event collector
 *
 * Provides:
 *   1. Express middleware that logs all API requests with timing
 *   2. POST /api/__dev/log endpoint to receive batched frontend events
 *   3. JSONL file writer at tools/session-log.jsonl for agentic test loop
 *   4. Color-coded terminal output with category filtering
 *
 * Active only when DEV_LOGGER=1 or NODE_ENV is not "production".
 */

const fs = require("fs");
const path = require("path");

// ── Production guard ────────────────────────────────────────────────────────

const IS_DEV = process.env.NODE_ENV !== "production" || process.env.DEV_LOGGER === "1";

// Correlation ID safety: only accept X-Test-Run-Id headers in dev, with strict format.
// Prevents test-ID spoofing from polluting shared telemetry.
const TEST_RUN_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function extractTestRunId(req) {
  if (!IS_DEV) return undefined;
  const h = req.headers?.["x-test-run-id"];
  if (typeof h === "string" && TEST_RUN_ID_RE.test(h)) return h;
  return undefined;
}

// ── Configuration ───────────────────────────────────────────────────────────

const LOG_FILE = path.join(__dirname, "..", "..", "tools", "session-log.jsonl");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB — rotate at this size
const TERMINAL_ENABLED = process.env.DEV_LOGGER_TERMINAL !== "0";
const FILE_ENABLED = process.env.DEV_LOGGER_FILE !== "0";

// ── Colors for terminal output ──────────────────────────────────────────────

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  // Categories
  ui: "\x1b[36m",       // cyan
  net: "\x1b[33m",      // yellow
  error: "\x1b[31m",    // red
  console: "\x1b[37m",  // white
  nav: "\x1b[35m",      // magenta
  perf: "\x1b[34m",     // blue
  state: "\x1b[32m",    // green
  req: "\x1b[33m",      // yellow (backend requests)
};

const CAT_LABELS = {
  ui: "UI",
  net: "NET",
  error: "ERR",
  console: "CON",
  nav: "NAV",
  perf: "PERF",
  state: "STATE",
  req: "REQ",
};

// ── File writer ─────────────────────────────────────────────────────────────

let logStream = null;

function ensureLogStream() {
  if (logStream) return;
  if (!FILE_ENABLED) return;

  // Rotate if file is too large
  try {
    if (fs.existsSync(LOG_FILE)) {
      const stat = fs.statSync(LOG_FILE);
      if (stat.size > MAX_FILE_SIZE) {
        const rotated = LOG_FILE.replace(".jsonl", `.${Date.now()}.jsonl`);
        fs.renameSync(LOG_FILE, rotated);
      }
    }
  } catch { /* ignore rotation errors */ }

  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
  logStream.on("error", () => {
    logStream = null; // Will retry on next write
  });
}

function writeToFile(event) {
  if (!FILE_ENABLED) return;
  ensureLogStream();
  if (logStream) {
    logStream.write(JSON.stringify(event) + "\n");
  }
}

// ── Terminal formatter ──────────────────────────────────────────────────────

function formatTime(isoString) {
  const d = isoString ? new Date(isoString) : new Date();
  return d.toTimeString().slice(0, 8);
}

function printToTerminal(event) {
  if (!TERMINAL_ENABLED) return;

  const cat = event.cat || "req";
  const color = COLORS[cat] || COLORS.reset;
  const label = CAT_LABELS[cat] || cat.toUpperCase();
  const time = formatTime(event.ts);
  const route = event.route ? ` ${COLORS.dim}${event.route}${COLORS.reset}` : "";

  let msg = "";

  switch (cat) {
    case "ui":
      msg = formatUIEvent(event);
      break;
    case "net":
      msg = formatNetEvent(event);
      break;
    case "error":
      msg = formatErrorEvent(event);
      break;
    case "console":
      msg = formatConsoleEvent(event);
      break;
    case "nav":
      msg = formatNavEvent(event);
      break;
    case "perf":
      msg = formatPerfEvent(event);
      break;
    case "state":
      msg = formatStateEvent(event);
      break;
    case "req":
      msg = formatReqEvent(event);
      break;
    default:
      msg = JSON.stringify(event.data || {}).slice(0, 120);
  }

  process.stdout.write(
    `${COLORS.dim}${time}${COLORS.reset} ${color}[${label}]${COLORS.reset}${route} ${msg}\n`
  );
}

function formatUIEvent(e) {
  const d = e.data || {};
  switch (e.type) {
    case "click":
      return `click ${d.element || "unknown"}`;
    case "input":
      return `input ${d.field || "unnamed"}${d.sensitive ? " [REDACTED]" : ` (${d.length} chars)`}`;
    case "submit":
      return `submit ${d.element || "form"} → ${d.action || "?"}`;
    case "focus":
      return `focus ${d.field || d.element || "unnamed"}`;
    case "shortcut":
      return `key ${[d.ctrl && "Ctrl", d.meta && "Cmd", d.alt && "Alt", d.shift && "Shift", d.key].filter(Boolean).join("+")}`;
    default:
      return `${e.type} ${JSON.stringify(d).slice(0, 80)}`;
  }
}

function formatNetEvent(e) {
  const d = e.data || {};
  const status = d.status ? ` → ${d.status}` : "";
  const duration = d.duration != null ? ` (${d.duration}ms)` : "";
  const error = d.error ? ` ERR: ${d.error}` : "";
  switch (e.type) {
    case "fetch:start":
      return `${COLORS.dim}→${COLORS.reset} ${d.method} ${d.url}`;
    case "fetch:done": {
      const statusColor = d.ok ? "\x1b[32m" : "\x1b[31m";
      return `${statusColor}←${COLORS.reset} ${d.method} ${d.url}${status}${duration}`;
    }
    case "fetch:error":
      return `${COLORS.error}✗${COLORS.reset} ${d.method} ${d.url}${error}${duration}`;
    default:
      return `${e.type} ${d.method || ""} ${d.url || ""}${status}${duration}`;
  }
}

function formatErrorEvent(e) {
  const d = e.data || {};
  return `${COLORS.bold}${d.message || "Unknown error"}${COLORS.reset}${d.filename ? ` at ${d.filename}:${d.lineno}` : ""}`;
}

function formatConsoleEvent(e) {
  const d = e.data || {};
  const level = e.type || "log";
  const levelColor = level === "error" ? COLORS.error : level === "warn" ? "\x1b[33m" : COLORS.dim;
  // Server-emitted events use {tag, msg} shape; frontend collector uses {args[]}.
  // Render both: prefer the explicit tag/msg shape so [scheduler] etc. survives.
  if (typeof d.tag === "string" && d.tag.length > 0) {
    const extras = d.extras !== undefined
      ? " " + (typeof d.extras === "string" ? d.extras : JSON.stringify(d.extras)).slice(0, 240)
      : "";
    return `${levelColor}${level}${COLORS.reset} [${d.tag}] ${d.msg ?? ""}${extras}`;
  }
  const args = (d.args || []).map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
  return `${levelColor}${level}${COLORS.reset} ${args.slice(0, 200)}`;
}

function formatNavEvent(e) {
  const d = e.data || {};
  switch (e.type) {
    case "initial":
      return `loaded ${d.route}`;
    case "navigate":
      return `${d.from} → ${d.to}${d.dwellTime ? ` (dwelt ${d.dwellTime}ms)` : ""}`;
    case "popstate":
      return `back/forward ${d.from} → ${d.to}`;
    default:
      return `${e.type} ${JSON.stringify(d).slice(0, 80)}`;
  }
}

function formatPerfEvent(e) {
  const d = e.data || {};
  switch (e.type) {
    case "long-task":
      return `long task ${d.duration}ms`;
    case "lcp":
      return `LCP ${d.renderTime || d.loadTime}ms${d.element ? ` (${d.element})` : ""}`;
    case "page-load":
      return `load: TTFB ${d.ttfb}ms, DOM ${d.domReady}ms, full ${d.load}ms`;
    default:
      return `${e.type} ${JSON.stringify(d).slice(0, 80)}`;
  }
}

function formatStateEvent(e) {
  const d = e.data || {};
  const diffKeys = d.diff ? Object.keys(d.diff).join(", ") : "";
  return `${d.store || "?"}.${d.action || "?"}${diffKeys ? ` [${diffKeys}]` : ""}`;
}

function formatReqEvent(e) {
  const d = e.data || {};
  const statusColor = d.status < 400 ? "\x1b[32m" : "\x1b[31m";
  return `${statusColor}${d.status}${COLORS.reset} ${d.method} ${d.url} (${d.duration}ms)`;
}

// ── Express middleware: request logger ───────────────────────────────────────

function requestLogger(req, res, next) {
  // Skip our own log endpoints (including subpaths and query strings) and health checks
  if (req.path?.startsWith("/api/__dev/log") || req.path === "/health" || req.path === "/api/health") {
    return next();
  }

  const startTime = process.hrtime.bigint();
  const testRunId = extractTestRunId(req);

  // Use res events instead of monkey-patching res.end — safer with streaming and middleware chains
  res.once("finish", () => {
    const duration = Number(process.hrtime.bigint() - startTime) / 1e6;

    const event = {
      ts: new Date().toISOString(),
      seq: 0,
      sid: "server",
      cat: "req",
      type: "request",
      route: req.url,
      data: {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: Math.round(duration),
        contentLength: res.getHeader("content-length") || undefined,
        userAgent: req.headers["user-agent"]?.split(" ")[0] || undefined,
      },
    };
    if (testRunId) event.testRunId = testRunId;

    writeToFile(event);
    printToTerminal(event);
  });

  next();
}

// ── Express route: receive frontend events ──────────────────────────────────

function logCollector(req, res) {
  const { events } = req.body || {};

  if (!Array.isArray(events)) {
    return res.status(400).json({ error: "events array required" });
  }

  // Rate limit: max 200 events per batch
  const batch = events.slice(0, 200);
  let accepted = 0;

  for (const event of batch) {
    // Basic validation: must have cat and type as strings
    if (!event || typeof event.cat !== "string" || typeof event.type !== "string") continue;
    // Suppress Vite HMR internal errors — transient WebSocket reconnection noise
    if (event.cat === "error" && event.data?.stack?.includes("@vite/client")) continue;
    // Validate testRunId format — reject malformed IDs to prevent log injection
    if (event.testRunId !== undefined) {
      if (typeof event.testRunId !== "string" || !TEST_RUN_ID_RE.test(event.testRunId)) {
        delete event.testRunId;
      }
    }
    try {
      writeToFile(event);
      printToTerminal(event);
      accepted++;
    } catch {
      // Skip malformed events — never crash the collector
    }
  }

  res.json({ accepted });
}

// ── Shared log file reader ───────────────────────────────────────────────────

function readLogEvents() {
  if (!fs.existsSync(LOG_FILE)) return [];
  const lines = fs.readFileSync(LOG_FILE, "utf-8").trim().split("\n").filter(Boolean);
  return lines.map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

// ── Express route: read logs (for agentic test loop) ────────────────────────

function logReader(req, res) {
  const { since, category, route, limit = 200 } = req.query;

  let events = readLogEvents();
  if (events.length === 0) {
    return res.json({ events: [], count: 0 });
  }

  try {

    // Apply filters
    if (since) {
      const sinceDate = new Date(since);
      events = events.filter(e => new Date(e.ts) >= sinceDate);
    }
    if (category) {
      const cats = category.split(",");
      events = events.filter(e => cats.includes(e.cat));
    }
    if (route) {
      events = events.filter(e => e.route === route || e.route?.startsWith(route));
    }

    // Take last N events
    const total = events.length;
    events = events.slice(-parseInt(limit, 10));

    res.json({ events, count: events.length, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── Express route: clear logs ───────────────────────────────────────────────

function logClear(req, res) {
  try {
    if (logStream) {
      logStream.end();
      logStream = null;
    }
    if (fs.existsSync(LOG_FILE)) {
      fs.writeFileSync(LOG_FILE, "");
    }
    res.json({ cleared: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── Express route: log summary / stats ──────────────────────────────────────

function logStats(req, res) {
  try {
    const events = readLogEvents();
    if (events.length === 0) {
      return res.json({ totalEvents: 0, categories: {}, sessions: [], routes: {} });
    }

    const categories = {};
    const sessions = new Set();
    const routes = {};
    const errors = [];

    for (const e of events) {
      categories[e.cat] = (categories[e.cat] || 0) + 1;
      if (e.sid) sessions.add(e.sid);
      if (e.route) routes[e.route] = (routes[e.route] || 0) + 1;
      if (e.cat === "error") errors.push({ type: e.type, message: e.data?.message, route: e.route, ts: e.ts });
    }

    res.json({
      totalEvents: events.length,
      categories,
      sessions: Array.from(sessions),
      routes,
      errors: errors.slice(-20),
      timeRange: { first: events[0]?.ts, last: events[events.length - 1]?.ts },
      fileSize: fs.existsSync(LOG_FILE) ? fs.statSync(LOG_FILE).size : 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── Setup function: wire into Express app ───────────────────────────────────

function setup(app) {
  if (!IS_DEV) {
    // Production: no logging, no endpoints
    return;
  }

  // Middleware for all routes
  app.use(requestLogger);

  // Dev log endpoints (localhost only in dev)
  app.post("/api/__dev/log", logCollector);
  app.get("/api/__dev/log", logReader);
  app.delete("/api/__dev/log", logClear);
  app.get("/api/__dev/log/stats", logStats);

  // Print startup banner
  console.log(
    `\x1b[36m[dev-logger]\x1b[0m Session logging active → ${path.relative(process.cwd(), LOG_FILE)}`
  );
  console.log(
    `\x1b[36m[dev-logger]\x1b[0m Terminal: ${TERMINAL_ENABLED ? "on" : "off"} | File: ${FILE_ENABLED ? "on" : "off"}`
  );
}

// ── Module-tag log API ──────────────────────────────────────────────────────
//
// Server-side replacement for `console.log("[module] ...")` patterns. Emits a
// structured event the test loop can read (`tools/agentic-test-loop.js logs
// --cat console`) AND prints to stdout in the existing `[CON] info [scheduler]
// msg` format so existing greps keep working.
//
// Tag format: short kebab-case identifier, max 32 chars. Anything outside
// [a-zA-Z0-9._:-] is normalized so log consumers can rely on it.
//
// Usage:
//   const dev = require("./dev-logger");
//   dev.info("scheduler", "tier1 refresh complete", { duration: 480 });
//   dev.warn("build-pipeline", "fallback path hit", { reason: "..." });
//   dev.error("chat-router", "spec write failed", { err: err.message });

const TAG_RE = /^[a-zA-Z0-9._:-]{1,32}$/;

function normalizeTag(tag) {
  if (typeof tag !== "string") return "log";
  const cleaned = tag.replace(/[^a-zA-Z0-9._:-]/g, "-").slice(0, 32);
  return TAG_RE.test(cleaned) ? cleaned : "log";
}

function logModule(level, tag, msg, extras) {
  const event = {
    ts: new Date().toISOString(),
    seq: 0,
    sid: "server",
    cat: "console",
    type: level,
    data: {
      tag: normalizeTag(tag),
      msg: typeof msg === "string" ? msg : JSON.stringify(msg),
    },
  };
  if (extras !== undefined) event.data.extras = extras;
  writeToFile(event);
  printToTerminal(event);
}

function info(tag, msg, extras)  { logModule("log",   tag, msg, extras); }
function warn(tag, msg, extras)  { logModule("warn",  tag, msg, extras); }
function error(tag, msg, extras) { logModule("error", tag, msg, extras); }

// ── Cleanup ─────────────────────────────────────────────────────────────────

function close() {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
}

module.exports = {
  setup,
  close,
  requestLogger,
  LOG_FILE,
  info,
  warn,
  error,
  // Exposed for tests + advanced callers
  _logModule: logModule,
  _normalizeTag: normalizeTag,
};
