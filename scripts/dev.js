#!/usr/bin/env node
/**
 * MCS Agent Builder — Dev Mode (npm start)
 *
 * Starts both servers in parallel:
 *   - Express backend on :8000  (API + WebSocket)
 *   - Vite frontend on :8080    (HMR, instant updates)
 *   - /api/* proxied from :8080 → :8000
 *
 * Opens browser to http://localhost:8080 when ready.
 * Auto-installs frontend deps if node_modules is missing.
 * Clears Vite dep cache on start for reliable HMR.
 *
 * Backend logs go to app/.dev-server.log (not the terminal).
 * Only startup messages and errors appear in the terminal.
 *
 * For end users (production): mcs start
 *   → builds frontend, serves pre-built SPA from app/dist/ on single port
 */

const { spawn, execSync } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");
const os = require("os");

const ROOT = path.resolve(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT, "app", "frontend");
const SERVER_SCRIPT = path.join(ROOT, "app", "server.js");
const BACKEND_LOG = path.join(ROOT, "app", ".dev-server.log");
const VITE_CACHE = path.join(FRONTEND_DIR, "node_modules", ".vite");

const isWin = os.platform() === "win32";
const npmCmd = isWin ? "npm.cmd" : "npm";

const DEV_URL = "http://localhost:8080";

console.log("\n\x1b[36m  MCS Agent Builder — Dev Mode\x1b[0m");
console.log("\x1b[90m  Backend :8000 (logs → app/.dev-server.log)\x1b[0m");
console.log("\x1b[90m  Frontend :8080 (Vite HMR)\x1b[0m\n");

// ── Clear stale Vite dep cache ───────────────────────────────────────────
// Prevents stale transforms / interrupted pre-bundles from causing invisible
// HMR failures where edits don't show up even after hard refresh.
if (fs.existsSync(VITE_CACHE)) {
  try {
    fs.rmSync(VITE_CACHE, { recursive: true, force: true });
    console.log("\x1b[90m  Cleared Vite cache\x1b[0m");
  } catch { /* non-critical */ }
}

// ── Kill stale processes on dev ports ────────────────────────────────────
// Previous dev sessions (or Claude's verification) may leave servers running.
// Kill them so the fresh spawn doesn't hit EADDRINUSE.
function freePort(port) {
  try {
    if (isWin) {
      const out = execSync(`netstat -ano | findstr ":${port}.*LISTEN"`, { encoding: "utf-8", windowsHide: true }).trim();
      const pids = [...new Set(out.split("\n").map(l => l.trim().split(/\s+/).pop()).filter(Boolean))];
      for (const pid of pids) {
        if (pid === "0" || pid === String(process.pid)) continue;
        try {
          execSync(`taskkill /F /PID ${pid}`, { windowsHide: true, stdio: "pipe" });
          console.log(`\x1b[33m[cleanup]\x1b[0m Killed stale process on :${port} (PID ${pid})\x1b[0m`);
        } catch { /* already dead */ }
      }
    } else {
      const out = execSync(`lsof -ti :${port}`, { encoding: "utf-8" }).trim();
      const pids = [...new Set(out.split("\n").filter(Boolean))];
      for (const pid of pids) {
        if (pid === String(process.pid)) continue;
        try {
          process.kill(Number(pid), "SIGTERM");
          console.log(`\x1b[33m[cleanup]\x1b[0m Killed stale process on :${port} (PID ${pid})\x1b[0m`);
        } catch { /* already dead */ }
      }
    }
  } catch { /* no process on port — nothing to kill */ }
}

freePort(8000);
freePort(8080);

// ── Auto-install frontend deps if needed ─────────────────────────────────
if (!fs.existsSync(path.join(FRONTEND_DIR, "node_modules"))) {
  console.log("\x1b[33m[setup]\x1b[0m Installing frontend dependencies...");
  try {
    execSync(`${npmCmd} install --legacy-peer-deps`, {
      cwd: FRONTEND_DIR,
      stdio: "inherit",
      shell: true,
    });
    console.log("\x1b[32m[setup]\x1b[0m Frontend dependencies installed.\n");
  } catch (e) {
    console.error("\x1b[31m[setup]\x1b[0m Failed to install frontend dependencies:", e.message);
    process.exit(1);
  }
}

// ── Start Express backend (logs to file, errors to terminal) ─────────────
const logStream = fs.createWriteStream(BACKEND_LOG, { flags: "w" });
logStream.write(`--- Dev server started ${new Date().toISOString()} ---\n`);

const backend = spawn(process.execPath, [SERVER_SCRIPT], {
  cwd: ROOT,
  stdio: ["inherit", "pipe", "pipe"],
  env: { ...process.env, PORT: "8000", MCS_DEV_MODE: "1", VITE_DEV_URL: DEV_URL },
});

// Stdout → log file only (not the terminal)
backend.stdout.pipe(logStream);

// Stderr → both log file AND terminal (errors should be visible)
backend.stderr.on("data", (chunk) => {
  logStream.write(chunk);
  const text = chunk.toString();
  // Filter out noise — only show actual errors
  if (text.includes("[server]") || text.includes("Error") || text.includes("error")) {
    process.stderr.write(`\x1b[31m[backend]\x1b[0m ${text}`);
  }
});

backend.on("error", (e) => {
  console.error(`\x1b[31m[backend]\x1b[0m Failed to start: ${e.message}`);
  process.exit(1);
});

// ── Start Vite frontend (show output — it's minimal and useful) ──────────
// Avoid shell:true to prevent Node v24 DEP0190 deprecation warning.
// On Windows, run npm via cmd.exe /c directly; on Unix, call npm directly.
const frontend = isWin
  ? spawn("cmd.exe", ["/c", "npm run dev -- --host localhost --port 8080"], {
      cwd: FRONTEND_DIR,
      stdio: ["inherit", "pipe", "pipe"],
    })
  : spawn("npm", ["run", "dev", "--", "--host", "localhost", "--port", "8080"], {
      cwd: FRONTEND_DIR,
      stdio: ["inherit", "pipe", "pipe"],
    });

// Vite stdout — only show the "ready" line + HMR updates, skip noise
frontend.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  // Show: ready URL, HMR updates, build times. Skip: dep optimization, file lists.
  if (
    text.includes("Local:") ||
    text.includes("ready in") ||
    text.includes("hmr update") ||
    text.includes("page reload")
  ) {
    process.stdout.write(`\x1b[35m[vite]\x1b[0m ${text}`);
  }
});

// Vite stderr — show warnings and errors, skip advisory noise
frontend.stderr.on("data", (chunk) => {
  const text = chunk.toString();
  if (
    text.includes("Forced re-optimization") ||
    text.includes("new dependencies optimized") ||
    text.includes("recommend switching to") ||
    text.includes("More information at https://vite.dev")
  ) {
    return;
  }
  process.stderr.write(`\x1b[35m[vite]\x1b[0m ${text}`);
});

frontend.on("error", (e) => {
  console.error(`\x1b[31m[frontend]\x1b[0m Failed to start: ${e.message}`);
  backend.kill("SIGTERM");
  process.exit(1);
});

// ── Open browser when frontend is ready ──────────────────────────────────
function waitAndOpen() {
  let attempts = 0;
  let opened = false;
  const maxAttempts = 30; // 30s max
  const interval = setInterval(() => {
    if (opened) return;
    attempts++;
    if (attempts > maxAttempts) {
      clearInterval(interval);
      console.log(`\x1b[33m[dev]\x1b[0m Timeout waiting for frontend. Open manually: ${DEV_URL}`);
      return;
    }
    http.get(DEV_URL, (res) => {
      if (!opened && res.statusCode && res.statusCode < 500) {
        opened = true;
        clearInterval(interval);
        console.log(`\n\x1b[32m  ✓ Ready at ${DEV_URL}\x1b[0m`);
        console.log(`\x1b[90m  Backend log: app/.dev-server.log\x1b[0m`);
        console.log("\x1b[90m  Press Ctrl+C to stop\x1b[0m\n");
        openBrowser(DEV_URL);
      }
      res.resume();
    }).on("error", () => { /* not ready yet */ });
  }, 1000);
}

function openBrowser(url) {
  try {
    if (isWin) {
      // Windows: `start` is a cmd.exe builtin — call cmd directly to avoid DEP0190
      spawn("cmd.exe", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    } else if (os.platform() === "darwin") {
      spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
    }
  } catch { /* ignore */ }
}

waitAndOpen();

// ── If either exits, kill the other ──────────────────────────────────────
backend.on("exit", (code) => {
  if (code !== 0 && code !== null) {
    console.log(`\x1b[31m[backend]\x1b[0m Crashed (exit ${code}) — check app/.dev-server.log`);
  }
  frontend.kill("SIGTERM");
  logStream.end();
  process.exit(code || 0);
});

frontend.on("exit", (code) => {
  if (code !== 0 && code !== null) {
    console.log(`\x1b[31m[frontend]\x1b[0m Exited with code ${code}`);
  }
  backend.kill("SIGTERM");
  logStream.end();
  process.exit(code || 0);
});

// ── Graceful shutdown ────────────────────────────────────────────────────
let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\n\x1b[90m  Shutting down...\x1b[0m");
  backend.kill("SIGTERM");
  frontend.kill("SIGTERM");
  logStream.end();
  setTimeout(() => {
    try { backend.kill("SIGKILL"); } catch { /* already dead */ }
    try { frontend.kill("SIGKILL"); } catch { /* already dead */ }
    process.exit(0);
  }, 3000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
