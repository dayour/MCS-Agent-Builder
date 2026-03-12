#!/usr/bin/env node
/**
 * MCS Agent Builder — Launcher
 *
 * Starts the Express server (HTTP + WebSocket terminal in one process),
 * opens the browser, and shuts everything down cleanly on exit.
 *
 * Handles:
 *   - Auto-updating from the remote repo (git pull) if in a git repo
 *   - Killing stale processes on the dashboard port
 *   - Auto-installing npm dependencies if missing
 *   - Building the frontend if app/dist/ is missing
 *   - Opening the browser once the dashboard responds
 *   - Graceful shutdown on Ctrl+C
 *
 * Usage: npm start  |  mcs start
 */

const { spawn, execSync } = require("child_process");
const crypto = require("crypto");
const http = require("http");
const net = require("net");
const path = require("path");
const os = require("os");
const fs = require("fs");

const PORT_START = 8000;
const PORT_MAX = 8020;
const LOCKFILE = process.env.MCS_LOCKFILE || path.join(os.homedir(), ".mcs-agent-builder.lock");

const MIN_NODE = 18;

// Flags set by autoUpdate when pulled commits change dependency files
let depsChanged = { npm: false, frontend: false };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  console.log(`\x1b[36m[launcher]\x1b[0m ${msg}`);
}

function warn(msg) {
  console.log(`\x1b[33m[launcher]\x1b[0m ${msg}`);
}

function err(msg) {
  console.error(`\x1b[31m[launcher]\x1b[0m ${msg}`);
}

// ---------------------------------------------------------------------------
// Single-instance lockfile
// ---------------------------------------------------------------------------

function checkSingleInstance() {
  if (fs.existsSync(LOCKFILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(LOCKFILE, "utf8"));
      try {
        process.kill(data.pid, 0);
        err(`MCS Agent Builder is already running (pid ${data.pid}, port ${data.port}).`);
        err(`Open http://localhost:${data.port} or stop it first.`);
        process.exit(1);
      } catch {
        log("Cleaning up stale lockfile...");
        fs.unlinkSync(LOCKFILE);
      }
    } catch {
      try { fs.unlinkSync(LOCKFILE); } catch {}
    }
  }
}

function writeLockfile(port) {
  fs.writeFileSync(LOCKFILE, JSON.stringify({ pid: process.pid, port }, null, 2));
}

function removeLockfile() {
  try { fs.unlinkSync(LOCKFILE); } catch {}
}

// ---------------------------------------------------------------------------
// Port probing — find a single available port (no longer need a pair)
// ---------------------------------------------------------------------------

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => { srv.close(); resolve(true); });
    srv.listen(port, "127.0.0.1");
  });
}

async function findPort() {
  for (let p = PORT_START; p <= PORT_MAX; p++) {
    if (await isPortAvailable(p)) return p;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Kill stale processes on a port (Windows + Unix)
// ---------------------------------------------------------------------------

function killPort(port) {
  try {
    if (os.platform() === "win32") {
      const result = execSync(`netstat -ano -p TCP`, {
        encoding: "utf8",
        timeout: 5000,
      });
      const killed = new Set();
      for (const line of result.split("\n")) {
        if (line.match(new RegExp(`[:.:]${port}\\s`))) {
          const pid = line.trim().split(/\s+/).pop();
          if (pid && /^\d+$/.test(pid) && pid !== "0" && !killed.has(pid)) {
            try {
              execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore", timeout: 5000 });
              log(`Killed process on port ${port} (pid ${pid})`);
              killed.add(pid);
            } catch {}
          }
        }
      }
    } else {
      try {
        const pid = execSync(`lsof -ti:${port}`, { encoding: "utf8", timeout: 5000 }).trim();
        if (pid) {
          execSync(`kill -9 ${pid}`, { stdio: "ignore", timeout: 5000 });
          log(`Killed stale process on port ${port} (pid ${pid})`);
        }
      } catch {}
    }
  } catch {}
}

// ---------------------------------------------------------------------------
// Auto-update: pull latest from remote if in a git repo
// ---------------------------------------------------------------------------

function autoUpdate() {
  if (!fs.existsSync(path.join(__dirname, ".git"))) return false;

  try { execSync("git --version", { stdio: "ignore", timeout: 5000 }); } catch { return false; }

  try {
    log("Checking for updates...");
    execSync("git fetch --quiet", { cwd: __dirname, stdio: "ignore", timeout: 30000 });
  } catch {
    warn("Could not reach remote — starting with current version.");
    return false;
  }

  try {
    const behind = execSync("git rev-list --count HEAD..@{upstream}", {
      encoding: "utf8", cwd: __dirname, timeout: 5000,
    }).trim();

    if (behind === "0") { log("Already up to date."); return false; }

    const headBefore = execSync("git rev-parse HEAD", {
      encoding: "utf8", cwd: __dirname, timeout: 5000,
    }).trim();

    let stashed = false;
    const status = execSync("git status --porcelain", {
      encoding: "utf8", cwd: __dirname, timeout: 10000,
    }).trim();
    if (status) {
      try {
        execSync('git stash push --quiet -m "auto-stash before update"', {
          cwd: __dirname, stdio: "ignore", timeout: 10000,
        });
        stashed = true;
        log("Stashed local changes.");
      } catch {
        warn("Could not stash local changes — skipping update.");
        return false;
      }
    }

    log(`${behind} new commit(s) available — updating...`);
    execSync("git pull --ff-only", { cwd: __dirname, stdio: "inherit", timeout: 60000 });
    log("Updated to latest version.");

    if (stashed) {
      try {
        execSync("git stash pop --quiet", { cwd: __dirname, stdio: "ignore", timeout: 10000 });
        log("Restored local changes.");
      } catch {
        warn("Could not restore local changes — run 'git stash pop' manually.");
      }
    }

    try {
      const changed = execSync(`git diff --name-only ${headBefore} HEAD`, {
        encoding: "utf8", cwd: __dirname, timeout: 5000,
      });
      if (/^package\.json$/m.test(changed) || /^package-lock\.json$/m.test(changed)) {
        depsChanged.npm = true;
        log("Dependencies changed — will reinstall.");
      }
      if (changed.includes("app/frontend/package.json") || changed.includes("app/frontend/package-lock.json")) {
        depsChanged.frontend = true;
      }
      if (changed.includes("app/frontend/")) {
        log("Frontend changes detected — will rebuild.");
        const distIdx = path.join(__dirname, "app", "dist", "index.html");
        if (fs.existsSync(distIdx)) fs.unlinkSync(distIdx);
      }
    } catch {}

    return true;
  } catch {
    warn("Auto-update failed (merge conflict?) — starting with current version.");
    return false;
  }
}

// ---------------------------------------------------------------------------
// Preflight checks
// ---------------------------------------------------------------------------

function checkClaudeCode() {
  const nativeDir = path.join(os.homedir(), ".claude-cli");
  if (fs.existsSync(nativeDir)) {
    try {
      const versions = fs.readdirSync(nativeDir)
        .filter(d => fs.statSync(path.join(nativeDir, d)).isDirectory())
        .sort();
      if (versions.length > 0) {
        const latest = versions[versions.length - 1];
        if (fs.existsSync(path.join(nativeDir, latest, "claude.exe"))) return true;
      }
    } catch {}
  }
  const npmCli = path.join(os.homedir(), "AppData", "Roaming", "npm",
    "node_modules", "@anthropic-ai", "claude-code", "cli.js");
  if (fs.existsSync(npmCli)) return true;
  try {
    execSync(os.platform() === "win32" ? "where claude" : "which claude", {
      stdio: "ignore", timeout: 5000,
    });
    return true;
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// Hash-based dependency staleness detection
// ---------------------------------------------------------------------------

function depsStale(dir) {
  if (!fs.existsSync(path.join(dir, "node_modules"))) return true;

  const pkgFile = path.join(dir, "package.json");
  const lockFile = path.join(dir, "package-lock.json");
  const hashFile = path.join(dir, "node_modules", ".deps-hash");

  let content = "";
  try { content += fs.readFileSync(pkgFile, "utf8"); } catch { return true; }
  try { content += fs.readFileSync(lockFile, "utf8"); } catch {}
  const currentHash = crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);

  try { return fs.readFileSync(hashFile, "utf8").trim() !== currentHash; } catch { return true; }
}

function writeDepsHash(dir) {
  const pkgFile = path.join(dir, "package.json");
  const lockFile = path.join(dir, "package-lock.json");
  const hashFile = path.join(dir, "node_modules", ".deps-hash");

  let content = "";
  try { content += fs.readFileSync(pkgFile, "utf8"); } catch {}
  try { content += fs.readFileSync(lockFile, "utf8"); } catch {}
  const hash = crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
  fs.writeFileSync(hashFile, hash, "utf8");
}

function ensureNodeModules() {
  if (depsStale(__dirname)) {
    log("Dependencies out of date — running npm install...");
    try {
      execSync("npm install", { stdio: "inherit", cwd: __dirname, timeout: 120000 });
      writeDepsHash(__dirname);
      log("npm install complete");
    } catch {
      err("npm install failed");
      process.exit(1);
    }
  }
}

// ---------------------------------------------------------------------------
// Git hooks
// ---------------------------------------------------------------------------

function ensureGitHooks() {
  const hooksDir = path.join(__dirname, ".git", "hooks");
  if (!fs.existsSync(path.join(__dirname, ".git"))) return;
  const hooks = ["pre-commit", "pre-push"];
  let installed = false;
  for (const hook of hooks) {
    const src = path.join(__dirname, "tools", "git-hooks", hook);
    const dst = path.join(hooksDir, hook);
    if (!fs.existsSync(src)) continue;
    try {
      const srcContent = fs.readFileSync(src, "utf8");
      const dstExists = fs.existsSync(dst);
      if (!dstExists || fs.readFileSync(dst, "utf8") !== srcContent) {
        fs.mkdirSync(hooksDir, { recursive: true });
        fs.writeFileSync(dst, srcContent, { mode: 0o755 });
        installed = true;
      }
    } catch {}
  }
  if (installed) log("Git hooks installed");
}

// ---------------------------------------------------------------------------
// Wait for server + open browser
// ---------------------------------------------------------------------------

function waitForReady(url, timeout = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (Date.now() - start > timeout) return reject(new Error("timeout"));
      http
        .get(url, (res) => {
          if (res.statusCode === 200) resolve();
          else setTimeout(poll, 500);
          res.resume();
        })
        .on("error", () => setTimeout(poll, 500));
    };
    poll();
  });
}

function openBrowser(url) {
  try {
    if (os.platform() === "win32") execSync(`start "" "${url}"`, { stdio: "ignore" });
    else if (os.platform() === "darwin") execSync(`open "${url}"`, { stdio: "ignore" });
    else execSync(`xdg-open "${url}"`, { stdio: "ignore" });
  } catch {
    log(`Open in your browser: ${url}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log("\n\x1b[36m  MCS Agent Builder\x1b[0m\n");

const isGitRepo = fs.existsSync(path.join(__dirname, ".git"));
const distIndex = path.join(__dirname, "app", "dist", "index.html");
const frontendDir = path.join(__dirname, "app", "frontend");

// 1. Check Node.js version
const nodeMajor = parseInt(process.versions.node.split(".")[0], 10);
if (nodeMajor < MIN_NODE) {
  err(`Node.js ${process.versions.node} is too old — ${MIN_NODE}+ required.`);
  process.exit(1);
}

// 2. Check Claude Code (non-blocking)
if (!checkClaudeCode()) {
  warn("Claude Code not found — terminal won't work until installed.");
  warn("Install: npm install -g @anthropic-ai/claude-code");
}

// 3-5: Git repo only — auto-update, deps, hooks
if (isGitRepo) {
  autoUpdate();
  ensureNodeModules();
  ensureGitHooks();

  // Frontend deps + rebuild only needed in dev (git repo)
  if (fs.existsSync(path.join(frontendDir, "package.json")) && depsStale(frontendDir)) {
    log("Frontend deps out of date — reinstalling...");
    try {
      execSync("npm install", { stdio: "inherit", cwd: frontendDir, timeout: 120000 });
      writeDepsHash(frontendDir);
    } catch {
      warn("npm install failed in app/frontend — frontend may not work");
    }
    if (fs.existsSync(distIndex)) fs.unlinkSync(distIndex);
  }

  if (fs.existsSync(path.join(frontendDir, "package.json")) && !fs.existsSync(distIndex)) {
    log("Frontend not built — building...");
    try {
      execSync("npm run build", { stdio: "inherit", cwd: frontendDir, timeout: 120000 });
      log("Frontend build complete");
    } catch {
      warn("Frontend build failed — dashboard may show placeholder page");
    }
  }
} else {
  // Global npm install — frontend is pre-built, deps already installed
  if (!fs.existsSync(distIndex)) {
    warn("Frontend not found — try reinstalling: npm install -g mcs-agent-builder");
  }
}

// 6. Single-instance check + find port + launch
checkSingleInstance();

(async () => {
  log("Finding available port...");
  const PORT = await findPort();
  if (!PORT) {
    err(`No available port found in range ${PORT_START}-${PORT_MAX}. Close some apps and retry.`);
    process.exit(1);
  }

  if (PORT !== PORT_START) {
    log(`Default port ${PORT_START} busy — using ${PORT}`);
  }

  writeLockfile(PORT);

  const URL = `http://localhost:${PORT}`;

  // Launch the Node.js Express server (HTTP + WebSocket in one process)
  const serverScript = path.join(__dirname, "app", "server.js");
  const server = spawn(process.execPath, [serverScript], {
    cwd: __dirname,
    stdio: "inherit",
    env: { ...process.env, PORT: String(PORT) },
  });

  server.on("error", (e) => {
    removeLockfile();
    err(`Failed to start server: ${e.message}`);
    process.exit(1);
  });

  server.on("exit", (code) => {
    removeLockfile();
    if (code !== null && code !== 0) {
      err(`Server exited with code ${code}`);
    }
    process.exit(code || 0);
  });

  // Wait for dashboard to respond, then open browser
  waitForReady(URL)
    .then(() => {
      console.log(`\n\x1b[32m  \u2713 Dashboard ready at ${URL}\x1b[0m`);
      console.log("\x1b[90m  Press Ctrl+C to stop\x1b[0m\n");
      openBrowser(URL);
    })
    .catch(() => {
      warn(`Dashboard may still be starting. Open manually: ${URL}`);
    });

  // Graceful shutdown
  function shutdown() {
    console.log("\n\x1b[90m  Shutting down...\x1b[0m");
    removeLockfile();
    try { server.kill(); } catch {}
    setTimeout(() => process.exit(0), 2000);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})();
