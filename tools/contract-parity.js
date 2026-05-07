#!/usr/bin/env node
/**
 * contract-parity.js — Runner for the MCS API contract registry.
 *
 * Discovers all contracts in tools/upstream-specs/contracts/, runs their
 * parity.test.js (static — no network), and reports pass/fail. Wired into
 * the pre-push hook and the npm `contracts:check` script.
 *
 * Usage:
 *   node tools/contract-parity.js                   # run all parity tests
 *   node tools/contract-parity.js <surfaceId>       # run one
 *   node tools/contract-parity.js --list            # list registered contracts
 *   node tools/contract-parity.js --check-coverage  # verify registry consistency
 *   node tools/contract-parity.js sanitize <raw.har> [--out <path>]
 *                                                   # sanitize a HAR for commit
 *
 * Live mode (set CONTRACT_PARITY_LIVE=1) is honored by individual parity
 * tests — this runner does not require auth and does not call MCS APIs.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const REGISTRY_DIR = path.join(__dirname, "upstream-specs", "contracts");
const INDEX_PATH = path.join(REGISTRY_DIR, "index.json");

// ---------------------------------------------------------------------------
// Registry helpers
// ---------------------------------------------------------------------------

function loadIndex() {
  if (!fs.existsSync(INDEX_PATH)) {
    throw new Error(`Registry index not found at ${INDEX_PATH}`);
  }
  return JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
}

function listContractFolders() {
  if (!fs.existsSync(REGISTRY_DIR)) return [];
  return fs.readdirSync(REGISTRY_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

function checkCoverage() {
  const idx = loadIndex();
  const declared = new Set(idx.contracts.map((c) => c.surfaceId));
  const found = new Set(listContractFolders());

  const missingFiles = [];
  const orphanFolders = [];
  const undeclaredFolders = [];

  for (const surfaceId of declared) {
    const dir = path.join(REGISTRY_DIR, surfaceId);
    if (!fs.existsSync(dir)) {
      orphanFolders.push(surfaceId);
      continue;
    }
    for (const f of ["contract.json", "shape-fixture.json", "parity.test.js"]) {
      if (!fs.existsSync(path.join(dir, f))) {
        missingFiles.push(`${surfaceId}/${f}`);
      }
    }
  }
  for (const folder of found) {
    if (!declared.has(folder)) undeclaredFolders.push(folder);
  }

  const issues = { missingFiles, orphanFolders, undeclaredFolders };
  const ok = missingFiles.length === 0 && orphanFolders.length === 0 && undeclaredFolders.length === 0;
  return { ok, ...issues, declared: [...declared], found: [...found] };
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

function runParityForSurface(surfaceId) {
  const testFile = path.join(REGISTRY_DIR, surfaceId, "parity.test.js");
  if (!fs.existsSync(testFile)) {
    return { surfaceId, ok: false, error: `parity.test.js missing at ${testFile}`, output: "" };
  }
  const result = spawnSync(process.execPath, ["--test", testFile], {
    encoding: "utf8",
    cwd: path.resolve(__dirname, ".."),
  });
  const output = (result.stdout || "") + (result.stderr || "");
  // node --test exits 0 on pass, non-zero on any fail
  return { surfaceId, ok: result.status === 0, exitCode: result.status, output };
}

function runAll() {
  const idx = loadIndex();
  const surfaces = idx.contracts.map((c) => c.surfaceId);
  if (surfaces.length === 0) {
    console.log("[contract-parity] No contracts registered.");
    return 0;
  }
  console.log(`[contract-parity] Running ${surfaces.length} parity check(s)...\n`);
  const results = surfaces.map((s) => {
    process.stdout.write(`  ${s.padEnd(40)} `);
    const r = runParityForSurface(s);
    process.stdout.write(r.ok ? "PASS\n" : "FAIL\n");
    return r;
  });
  const failed = results.filter((r) => !r.ok);
  console.log("");
  console.log(`[contract-parity] ${results.length - failed.length}/${results.length} contracts pass static parity.`);
  if (failed.length > 0) {
    console.log("\nFailed contracts:");
    for (const f of failed) {
      console.log(`\n--- ${f.surfaceId} (exit ${f.exitCode}) ---`);
      console.log(f.output.split("\n").filter((l) => l.includes("✖") || l.includes("Error") || l.includes("AssertionError")).slice(0, 10).join("\n"));
    }
  }
  return failed.length === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------
// HAR sanitizer — strip auth/PII for commit
// ---------------------------------------------------------------------------

const SECRET_HEADERS = new Set([
  "authorization", "cookie", "set-cookie", "x-ms-correlation-id", "x-ms-client-session-id",
  "x-ms-client-request-id", "x-ms-routing-request-id", "x-anchormailbox", "x-pva-token",
]);

function sanitizeString(s) {
  if (typeof s !== "string") return s;
  // GUIDs → placeholder
  s = s.replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, "<guid>");
  // JWTs → placeholder
  s = s.replace(/eyJ[A-Za-z0-9\-_]{10,}\.eyJ[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_.+/=]{10,}/g, "<jwt>");
  // Bearer tokens
  s = s.replace(/Bearer\s+[A-Za-z0-9\-_.~+/=]{20,}/gi, "Bearer <token>");
  // Email addresses → placeholder
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "<email>");
  // Long base64-looking blobs (likely tokens)
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
      if (SECRET_HEADERS.has(k.toLowerCase())) {
        out[k] = "<redacted>";
      } else {
        out[k] = sanitizeObject(obj[k]);
      }
    }
    return out;
  }
  return obj;
}

function sanitizeHar(harPath) {
  if (!fs.existsSync(harPath)) throw new Error(`HAR not found: ${harPath}`);
  const har = JSON.parse(fs.readFileSync(harPath, "utf8"));
  const entries = har.log?.entries || [];
  const sanitized = entries.map((e) => {
    const req = e.request || {};
    const res = e.response || {};
    const reqBody = req.postData?.text;
    const resBody = res.content?.text;
    return {
      request: {
        method: req.method,
        url: sanitizeString(req.url || ""),
        headers: Object.fromEntries((req.headers || []).map((h) => [h.name, SECRET_HEADERS.has(h.name.toLowerCase()) ? "<redacted>" : sanitizeString(h.value)])),
        body: reqBody ? sanitizeObject(safeParseJSON(reqBody)) : null,
      },
      response: {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries((res.headers || []).map((h) => [h.name, sanitizeString(h.value)])),
        body: resBody ? sanitizeObject(safeParseJSON(resBody)) : null,
      },
    };
  });
  return sanitized;
}

function safeParseJSON(s) {
  try { return JSON.parse(s); } catch { return s; }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    process.exit(runAll());
  }

  const cmd = args[0];

  if (cmd === "--list") {
    const idx = loadIndex();
    console.log(`[contract-parity] ${idx.contracts.length} registered contract(s):\n`);
    for (const c of idx.contracts) {
      console.log(`  ${c.surfaceId.padEnd(40)} ${c.method.padEnd(6)} ${c.path}`);
      console.log(`  ${" ".repeat(40)} criticality=${c.criticality}, lastVerified=${c.lastVerified}`);
    }
    return;
  }

  if (cmd === "--check-coverage") {
    const cov = checkCoverage();
    console.log("[contract-parity] Coverage check:\n");
    console.log(`  Declared in index.json: ${cov.declared.length}`);
    console.log(`  Found on disk:          ${cov.found.length}`);
    if (cov.missingFiles.length > 0) {
      console.log("\n  MISSING FILES:");
      cov.missingFiles.forEach((f) => console.log(`    - ${f}`));
    }
    if (cov.orphanFolders.length > 0) {
      console.log("\n  DECLARED BUT FOLDER MISSING:");
      cov.orphanFolders.forEach((f) => console.log(`    - ${f}`));
    }
    if (cov.undeclaredFolders.length > 0) {
      console.log("\n  FOLDER PRESENT BUT NOT IN INDEX.JSON:");
      cov.undeclaredFolders.forEach((f) => console.log(`    - ${f}`));
    }
    if (cov.ok) console.log("\n  OK — registry is consistent.");
    process.exit(cov.ok ? 0 : 1);
  }

  if (cmd === "sanitize") {
    const harPath = args[1];
    if (!harPath) {
      console.error("Usage: node tools/contract-parity.js sanitize <path/to/raw.har> [--out <path>]");
      process.exit(2);
    }
    const sanitized = sanitizeHar(harPath);
    const outIdx = args.indexOf("--out");
    if (outIdx > 0 && args[outIdx + 1]) {
      fs.writeFileSync(args[outIdx + 1], JSON.stringify(sanitized, null, 2));
      console.log(`[contract-parity] Sanitized ${sanitized.length} entries → ${args[outIdx + 1]}`);
    } else {
      console.log(JSON.stringify(sanitized, null, 2));
    }
    return;
  }

  // Otherwise: treat first arg as surfaceId
  const r = runParityForSurface(cmd);
  console.log(r.output);
  process.exit(r.ok ? 0 : 1);
}

main();
