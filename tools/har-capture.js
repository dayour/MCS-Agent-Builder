#!/usr/bin/env node
/**
 * har-capture.js — interactive HAR capture tool for MCS API surfaces.
 *
 * Launches Playwright against the MCS portal (or any URL), records every
 * network request to a HAR file, and can immediately sanitize + extract a
 * targeted surface into the contract registry.
 *
 * This replaces "open DevTools, File > Save all as HAR with content" — the
 * manual step the user shouldn't have to do.
 *
 * Prerequisites:
 *   - Playwright installed (ships with app/frontend — reuses that install)
 *   - A real browser (chromium auto-downloaded by Playwright on first run)
 *
 * Usage:
 *   # 1. One-time auth bootstrap — sign in once, persist storageState
 *   node tools/har-capture.js auth [--channel msedge]
 *
 *   # 2. Capture a named scenario (auto-uses persisted auth if present)
 *   node tools/har-capture.js capture --scenario agent-flow-publish [--channel msedge]
 *
 *   # 3. Generic interactive session — open portal, do the action, close browser when done
 *   node tools/har-capture.js capture --url https://copilotstudio.preview.microsoft.com
 *
 *   # 4. Filter + sanitize a previously captured HAR → contract fixture
 *   node tools/har-capture.js extract <har-path> --surface <surfaceId> [--match <url-substring>]
 *
 *   # 5. Diff two HARs — endpoint catalog deltas + body shape changes
 *   node tools/har-capture.js diff <har-a> <har-b> [--filter <substring>]
 *
 *   # 6. Quick sanitize only (no registry write)
 *   node tools/har-capture.js sanitize <har-path> --out sanitized.json
 *
 *   # 7. List known match patterns for each surface (helpful reference)
 *   node tools/har-capture.js surfaces
 *
 * Persistent auth: tools/auth/copilotstudio-storage.json (gitignored).
 * Capture output: tools/har-captures/ (gitignored).
 * Flow scenario reference: knowledge/patterns/flow-capture-scenarios.md
 */

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const CONTRACTS_DIR = path.join(REPO_ROOT, "tools", "upstream-specs", "contracts");
const DEFAULT_HAR_DIR = path.join(REPO_ROOT, "tools", "har-captures");
const AUTH_DIR = path.join(REPO_ROOT, "tools", "auth");
const DEFAULT_AUTH_STATE = path.join(AUTH_DIR, "copilotstudio-storage.json");
const DEFAULT_PORTAL_URL = "https://copilotstudio.preview.microsoft.com";

// Playwright is installed under app/frontend. Resolve it explicitly so this
// script works without a repo-root dependency duplication.
function requirePlaywright() {
  const candidates = [
    path.join(REPO_ROOT, "app", "frontend", "node_modules", "playwright"),
    path.join(REPO_ROOT, "app", "frontend", "node_modules", "@playwright", "test"),
    "playwright",
  ];
  for (const c of candidates) {
    try { return require(c); } catch {}
  }
  console.error("Playwright not found. Run: npm --prefix app/frontend install");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Known surfaces — URL substring patterns for extract mode
// ---------------------------------------------------------------------------

const SURFACE_MATCHERS = {
  // Bot / agent surfaces (existing)
  "maker-eval-testcomponent": "/makerevaluations/testcomponent",
  "dialogs-list":             "/api/botauthoring/v1/environments/",
  "bot-create":               "/api/data/v9.2/bots?",
  "pva-publish":              "Microsoft.Dynamics.CRM.PvaPublish",
  "component-sync":           "/content/botcomponents",
  "direct-line-enable":       "/api/data/v9.2/bots(", // channel-enable hits bot entity — needs further filter in extract
  "direct-line-token":        "directLine",

  // Power Automate / agent flow surfaces (added 2026-04-28 for flow-generation work)
  "agent-flow-create":        "/api/data/v9.2/workflows", // POST creates a flow row; extract picks the POST entry
  "agent-flow-save":          "/api/data/v9.2/$batch",    // PATCH-via-batch — multipart save
  "agent-flow-publish":       "PublishComponent",         // bound action — publishes + activates
  "agent-flow-open":          "/api/data/v9.2/workflows(", // GET single flow row
  "ai-flow-create":           "/api/data/v9.2/workflows", // same endpoint as agent-flow-create — extract by category=7 in body
  "checkflow-errors":         "/powerautomate/flows/new/checkFlowErrors",
  "checkflow-warnings":       "/powerautomate/flows/new/checkFlowWarnings",
  "verify-plan":              "/copilotflows/flows/",     // POST .../verifyPlan
  "mcp-tools-discovery":      "/copilotflows/mcpconnectors/",
  "operations-catalog":       "/powerautomate/operations",
  "connector-create":         "/connectivity/connectors/", // PUT creates connection + reference
  "connection-list":          "/connectivity/connections",
  "operation-schema":         "/powerautomate/apis/",     // /apiOperations/{opId}, /listDynamicProperties, /listEnum
  "consent-link":             "/getConsentLink",
};

// Same sanitizer as contract-parity.js (shared logic — maybe extract later)
const SECRET_HEADERS = new Set([
  "authorization", "cookie", "set-cookie", "x-ms-correlation-id", "x-ms-client-session-id",
  "x-ms-client-request-id", "x-ms-routing-request-id", "x-anchormailbox", "x-pva-token",
  "x-ms-aad-token", "ocp-apim-subscription-key",
]);

function sanitizeString(s) {
  if (typeof s !== "string") return s;
  s = s.replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, "<guid>");
  s = s.replace(/eyJ[A-Za-z0-9\-_]{10,}\.eyJ[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_.+/=]{10,}/g, "<jwt>");
  s = s.replace(/Bearer\s+[A-Za-z0-9\-_.~+/=]{20,}/gi, "Bearer <token>");
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "<email>");
  s = s.replace(/[A-Za-z0-9+/=]{120,}/g, "<base64-blob>");
  return s;
}
function sanitizeObject(obj) {
  if (obj == null) return obj;
  if (typeof obj === "string") return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj === "object") {
    const out = {};
    for (const k of Object.keys(obj)) {
      out[k] = SECRET_HEADERS.has(k.toLowerCase()) ? "<redacted>" : sanitizeObject(obj[k]);
    }
    return out;
  }
  return obj;
}
function safeParseJSON(s) { try { return JSON.parse(s); } catch { return s; } }

// ---------------------------------------------------------------------------
// Capture mode — launch browser, record HAR
// ---------------------------------------------------------------------------

async function launchBrowser(pw, channel) {
  // channel: 'msedge' uses installed Edge (better MS WAM auth integration on Windows).
  // Fallback to chromium if Edge channel launch fails.
  if (channel === "msedge") {
    try {
      return await pw.chromium.launch({ headless: false, channel: "msedge" });
    } catch (e) {
      console.warn(`[har-capture] msedge channel launch failed (${e.message}); falling back to chromium`);
    }
  }
  return await pw.chromium.launch({ headless: false });
}

async function capture(opts) {
  const pw = requirePlaywright();
  const url = opts.url || DEFAULT_PORTAL_URL;
  // Default to canonical auth state if it exists and caller didn't specify one
  let authState = opts.authState;
  if (!authState && fs.existsSync(DEFAULT_AUTH_STATE)) {
    authState = DEFAULT_AUTH_STATE;
  }
  const outDir = opts.outDir || DEFAULT_HAR_DIR;
  const timestamp = new Date().toISOString().replace(/[T:.]/g, "-").replace(/Z$/, "");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const scenarioTag = opts.scenario ? `-${opts.scenario}` : "";
  const harPath = path.join(outDir, `mcs-capture${scenarioTag}-${timestamp}.har`);
  const fallbackAuthPath = path.join(outDir, `auth-state-${timestamp}.json`);

  console.log(`[har-capture] Launching browser (channel: ${opts.channel || "chromium"})...`);
  console.log(`[har-capture] HAR will be saved to: ${harPath}`);

  const browser = await launchBrowser(pw, opts.channel);
  // Default: omit response bodies (keeps request bodies, status codes, headers).
  // 4 clicks at copilotstudio.preview produces ~230 MB with embedded bodies; ~5 MB without.
  // Pass --full-bodies if you need response payloads (e.g. capturing checkFlowErrors response).
  const harContent = opts.fullBodies ? "embed" : "omit";
  const contextOpts = {
    recordHar: { path: harPath, mode: "full", content: harContent },
    viewport: { width: 1400, height: 900 },
  };
  if (authState && fs.existsSync(authState)) {
    contextOpts.storageState = authState;
    console.log(`[har-capture] Reusing auth state from ${authState}`);
  } else {
    console.log(`[har-capture] No prior auth state — you'll need to sign in. Tip: run 'auth' subcommand once to persist login.`);
  }

  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();
  await page.goto(url);

  console.log(`\n[har-capture] Browser is open at: ${url}`);
  if (opts.scenario) {
    console.log(`[har-capture] Scenario: ${opts.scenario}`);
  }
  console.log(`[har-capture] Perform the action you want to capture.`);
  console.log(`[har-capture] CLOSE the browser window when done — the HAR will save automatically.\n`);

  await browser
    .contexts()[0]
    .pages()[0]
    .waitForEvent("close", { timeout: 0 })
    .catch(() => {});
  // When the user closes the window, save auth state to BOTH paths:
  //   1. Canonical (overwrites prior) — so future captures pick it up automatically
  //   2. Timestamped fallback in outDir — so we never lose a working auth state if the canonical gets corrupted
  try {
    if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
    await context.storageState({ path: DEFAULT_AUTH_STATE });
    console.log(`[har-capture] Auth state saved (canonical): ${DEFAULT_AUTH_STATE}`);
    fs.copyFileSync(DEFAULT_AUTH_STATE, fallbackAuthPath);
  } catch (e) {
    console.warn(`[har-capture] Could not save auth state: ${e.message}`);
  }
  await context.close();
  await browser.close();

  console.log(`[har-capture] HAR saved: ${harPath}`);
  console.log(`\nNext: node tools/har-capture.js extract ${harPath} --surface <surfaceId>`);
  console.log(`   or: node tools/har-capture.js diff <har-a> <har-b>`);
  return harPath;
}

// ---------------------------------------------------------------------------
// Auth mode — one-time login, persists storageState to canonical path
// ---------------------------------------------------------------------------

async function auth(opts) {
  const pw = requirePlaywright();
  const url = opts.url || DEFAULT_PORTAL_URL;

  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

  console.log(`[auth] Launching browser (channel: ${opts.channel || "chromium"}) at ${url}`);
  console.log(`[auth] Sign in with the account you want to capture as.`);
  console.log(`[auth] After login lands on the portal home, CLOSE the browser window.`);
  console.log(`[auth] Auth state will be saved to: ${DEFAULT_AUTH_STATE}\n`);

  const browser = await launchBrowser(pw, opts.channel);
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  await page.goto(url);

  await browser
    .contexts()[0]
    .pages()[0]
    .waitForEvent("close", { timeout: 0 })
    .catch(() => {});

  try {
    await context.storageState({ path: DEFAULT_AUTH_STATE });
    const stat = fs.statSync(DEFAULT_AUTH_STATE);
    console.log(`[auth] Saved (${stat.size} bytes): ${DEFAULT_AUTH_STATE}`);
    console.log(`[auth] Subsequent 'capture' runs will pick this up automatically.`);
  } catch (e) {
    console.error(`[auth] Failed to save auth state: ${e.message}`);
    process.exit(1);
  }
  await context.close();
  await browser.close();
}

// ---------------------------------------------------------------------------
// Extract mode — filter HAR to target surface, sanitize, write fixture
// ---------------------------------------------------------------------------

function extract(harPath, opts) {
  if (!fs.existsSync(harPath)) { console.error(`HAR not found: ${harPath}`); process.exit(1); }
  const har = JSON.parse(fs.readFileSync(harPath, "utf8"));
  const entries = har.log?.entries || [];
  const match = opts.match || SURFACE_MATCHERS[opts.surface];
  if (!match) {
    console.error(`No match pattern for surface '${opts.surface}'. Known surfaces:`);
    Object.entries(SURFACE_MATCHERS).forEach(([k, v]) => console.error(`  ${k.padEnd(30)} → ${v}`));
    process.exit(1);
  }

  const filtered = entries.filter((e) => (e.request?.url || "").includes(match));
  console.log(`[har-capture] ${entries.length} total entries, ${filtered.length} match '${match}'`);
  if (filtered.length === 0) {
    console.error("No matching entries. Adjust --match or re-capture.");
    process.exit(1);
  }

  // Take the FIRST successful entry (2xx) as the fixture. Print all entries
  // for transparency — operator can pick a different one if needed.
  const successes = filtered.filter((e) => (e.response?.status || 0) < 400);
  console.log(`[har-capture] Entries:`);
  filtered.forEach((e, i) => {
    console.log(`  [${i}] ${e.request.method} ${e.response?.status || "?"} ${(e.request.url || "").slice(0, 100)}`);
  });

  const chosen = successes[0] || filtered[0];
  console.log(`[har-capture] Using entry 0 (${chosen.request.method} ${chosen.response?.status})`);

  const reqBody = chosen.request.postData?.text;
  const resBody = chosen.response?.content?.text;
  const fixture = {
    _description: `Auto-captured fixture for ${opts.surface} — sanitized by har-capture.js. Review before commit.`,
    _capturedAt: new Date().toISOString(),
    _source: path.basename(harPath),
    request: {
      method: chosen.request.method,
      url: sanitizeString(chosen.request.url),
      headers: Object.fromEntries((chosen.request.headers || []).map((h) => [h.name, SECRET_HEADERS.has(h.name.toLowerCase()) ? "<redacted>" : sanitizeString(h.value)])),
      body: reqBody ? sanitizeObject(safeParseJSON(reqBody)) : null,
    },
    response: {
      status: chosen.response.status,
      statusText: chosen.response.statusText,
      headers: Object.fromEntries((chosen.response.headers || []).map((h) => [h.name, sanitizeString(h.value)])),
      body: resBody ? sanitizeObject(safeParseJSON(resBody)) : null,
    },
  };

  const outPath = opts.out
    || (opts.surface ? path.join(CONTRACTS_DIR, opts.surface, "shape-fixture.auto.json") : null)
    || path.join(path.dirname(harPath), `${opts.surface || "extract"}-fixture.json`);

  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(fixture, null, 2));
  console.log(`[har-capture] Fixture saved: ${outPath}`);
  console.log(`\nReview the fixture, then:`);
  console.log(`  1. Hand-edit any non-contractual fields out`);
  console.log(`  2. Rename to shape-fixture.json (drop .auto) when ready to commit`);
  console.log(`  3. Write contract.json describing discriminators + requiredFields`);
  console.log(`  4. Write parity.test.js using existing contracts as template`);
  console.log(`  5. Add entry to tools/upstream-specs/contracts/index.json`);
  console.log(`  6. Run: node tools/contract-parity.js`);

  return outPath;
}

// ---------------------------------------------------------------------------
// Diff mode — compare two HARs by endpoint catalog and body shape
// ---------------------------------------------------------------------------

function endpointKey(entry) {
  // Group requests by host + method + path-template (GUIDs collapsed) so we
  // can compare two captures even when GUIDs differ between sessions.
  const url = entry.request?.url || "";
  let u;
  try { u = new URL(url); } catch { return `??? ${entry.request?.method || "?"} ${url}`; }
  const path = u.pathname
    .replace(/\([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\)/gi, "(<guid>)")
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/<guid>");
  return `${u.host} ${entry.request?.method || "?"} ${path}`;
}

function loadHarEntries(harPath) {
  const har = JSON.parse(fs.readFileSync(harPath, "utf8"));
  return har.log?.entries || [];
}

function summarizeBody(entry) {
  const body = entry.request?.postData?.text;
  if (!body) return null;
  const parsed = safeParseJSON(body);
  if (typeof parsed === "string") {
    // Multipart batch or raw text — summarize the shape, not contents
    if (parsed.startsWith("--batch")) {
      const inner = parsed.match(/^(GET|POST|PATCH|DELETE|PUT)\s+(\S+)/gm) || [];
      return { _kind: "batch-multipart", innerOps: inner };
    }
    return { _kind: "text", length: parsed.length };
  }
  return Object.keys(parsed || {}).sort();
}

function diff(harA, harB, opts = {}) {
  if (!fs.existsSync(harA)) { console.error(`Not found: ${harA}`); process.exit(1); }
  if (!fs.existsSync(harB)) { console.error(`Not found: ${harB}`); process.exit(1); }

  const entriesA = loadHarEntries(harA);
  const entriesB = loadHarEntries(harB);

  const filter = opts.filter || null;
  const matchFilter = (e) => !filter || (e.request?.url || "").includes(filter);

  const groupBy = (entries) => {
    const m = new Map();
    for (const e of entries) {
      if (!matchFilter(e)) continue;
      const k = endpointKey(e);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(e);
    }
    return m;
  };

  const A = groupBy(entriesA);
  const B = groupBy(entriesB);

  const allKeys = new Set([...A.keys(), ...B.keys()]);
  const onlyA = [], onlyB = [], both = [];
  for (const k of allKeys) {
    if (A.has(k) && !B.has(k)) onlyA.push(k);
    else if (!A.has(k) && B.has(k)) onlyB.push(k);
    else both.push(k);
  }

  console.log(`\n=== HAR diff ===`);
  console.log(`A: ${path.basename(harA)} (${entriesA.length} entries)`);
  console.log(`B: ${path.basename(harB)} (${entriesB.length} entries)`);
  if (filter) console.log(`Filter: includes "${filter}"`);

  console.log(`\n--- Endpoints only in A (${onlyA.length}) ---`);
  onlyA.sort().forEach((k) => console.log(`  - ${k}  ×${A.get(k).length}`));

  console.log(`\n+++ Endpoints only in B (${onlyB.length}) +++`);
  onlyB.sort().forEach((k) => console.log(`  + ${k}  ×${B.get(k).length}`));

  console.log(`\n=== Endpoints in both (${both.length}) — body-shape deltas ===`);
  for (const k of both.sort()) {
    const sa = (A.get(k) || []).map(summarizeBody).filter(Boolean);
    const sb = (B.get(k) || []).map(summarizeBody).filter(Boolean);
    const ja = JSON.stringify(sa);
    const jb = JSON.stringify(sb);
    if (ja !== jb) {
      console.log(`  Δ ${k}`);
      console.log(`    A: ${ja.slice(0, 300)}`);
      console.log(`    B: ${jb.slice(0, 300)}`);
    }
  }

  console.log(`\nDone.`);
  return { onlyA, onlyB, both };
}

// ---------------------------------------------------------------------------
// Sanitize mode — just sanitize a HAR without extracting
// ---------------------------------------------------------------------------

function sanitize(harPath, opts) {
  const har = JSON.parse(fs.readFileSync(harPath, "utf8"));
  const entries = (har.log?.entries || []).map((e) => {
    const reqBody = e.request?.postData?.text;
    const resBody = e.response?.content?.text;
    return {
      method: e.request?.method,
      url: sanitizeString(e.request?.url || ""),
      status: e.response?.status,
      requestHeaders: Object.fromEntries((e.request?.headers || []).map((h) => [h.name, SECRET_HEADERS.has(h.name.toLowerCase()) ? "<redacted>" : sanitizeString(h.value)])),
      requestBody: reqBody ? sanitizeObject(safeParseJSON(reqBody)) : null,
      responseBody: resBody ? sanitizeObject(safeParseJSON(resBody)) : null,
    };
  });
  if (opts.out) {
    fs.writeFileSync(opts.out, JSON.stringify(entries, null, 2));
    console.log(`[har-capture] ${entries.length} sanitized entries → ${opts.out}`);
  } else {
    console.log(JSON.stringify(entries, null, 2));
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function argVal(args, name, def) { const i = args.indexOf(name); return i > -1 ? args[i + 1] : def; }

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === "--help" || cmd === "-h" || args.includes("--help") || args.includes("-h")) {
    // Read everything between the leading /** and */
    const src = fs.readFileSync(__filename, "utf8").split("\n");
    const end = src.findIndex((l) => l.trim() === "*/");
    const body = src.slice(1, end >= 0 ? end : 27).join("\n").replace(/^ \* ?/gm, "");
    console.log(body);
    return;
  }

  if (cmd === "surfaces") {
    console.log("Known surface matchers:");
    for (const [k, v] of Object.entries(SURFACE_MATCHERS)) {
      console.log(`  ${k.padEnd(30)} ${v}`);
    }
    return;
  }

  if (cmd === "capture") {
    await capture({
      url: argVal(args, "--url"),
      authState: argVal(args, "--auth-state"),
      outDir: argVal(args, "--out-dir"),
      scenario: argVal(args, "--scenario"),
      channel: argVal(args, "--channel"),
      fullBodies: args.includes("--full-bodies"),
    });
    return;
  }

  if (cmd === "auth") {
    await auth({
      url: argVal(args, "--url"),
      channel: argVal(args, "--channel"),
    });
    return;
  }

  if (cmd === "diff") {
    const a = args[1];
    const b = args[2];
    if (!a || !b) { console.error("Usage: diff <har-a> <har-b> [--filter <substring>]"); process.exit(2); }
    diff(a, b, { filter: argVal(args, "--filter") });
    return;
  }

  if (cmd === "extract") {
    const harPath = args[1];
    if (!harPath) { console.error("Usage: extract <har-path> --surface <id> [--match <pattern>] [--out <path>]"); process.exit(2); }
    extract(harPath, {
      surface: argVal(args, "--surface"),
      match: argVal(args, "--match"),
      out: argVal(args, "--out"),
    });
    return;
  }

  if (cmd === "sanitize") {
    const harPath = args[1];
    if (!harPath) { console.error("Usage: sanitize <har-path> [--out <path>]"); process.exit(2); }
    sanitize(harPath, { out: argVal(args, "--out") });
    return;
  }

  console.error(`Unknown command: ${cmd}`);
  console.error(`Try: node tools/har-capture.js --help`);
  process.exit(2);
}

main().catch((err) => { console.error(err); process.exit(1); });
