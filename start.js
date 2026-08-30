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
 * Usage: mcs start  (production — single port, pre-built frontend)
 *
 * For development with hot-reload: npm start  (runs scripts/dev.js)
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

const MIN_NODE = 20;

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
        // Process is alive — kill it so we can restart cleanly
        log(`Stopping previous instance (pid ${data.pid}, port ${data.port})...`);
        killPort(data.port);
        try { process.kill(data.pid, "SIGTERM"); } catch {}
        // Give it a moment to die
        try { execSync(os.platform() === "win32"
          ? `taskkill /F /PID ${data.pid}`
          : `kill -9 ${data.pid}`, { stdio: "ignore", timeout: 5000 }); } catch {}
      } catch {
        // Process already dead
      }
      fs.unlinkSync(LOCKFILE);
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
  // Always try to reclaim the default port first
  if (!(await isPortAvailable(PORT_START))) {
    log(`Port ${PORT_START} is busy — killing existing process...`);
    killPort(PORT_START);
    // Wait briefly for port to free up
    await new Promise((r) => setTimeout(r, 1000));
    if (await isPortAvailable(PORT_START)) return PORT_START;
    // Still busy — try once more with a longer wait
    await new Promise((r) => setTimeout(r, 2000));
    if (await isPortAvailable(PORT_START)) return PORT_START;
    warn(`Port ${PORT_START} still busy after kill — trying next available...`);
  } else {
    return PORT_START;
  }
  // Fallback: scan for any available port
  for (let p = PORT_START + 1; p <= PORT_MAX; p++) {
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
        // Anchor port match to colon boundary to avoid 8000 matching 18000
        if (line.match(new RegExp(`[:.]${port}\\s`)) && line.includes(`:${port}`)) {
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
        const pids = execSync(`lsof -ti:${port}`, { encoding: "utf8", timeout: 5000 }).trim();
        if (pids) {
          for (const pid of pids.split(/\s+/).filter(p => /^\d+$/.test(p))) {
            try {
              execSync(`kill -9 ${pid}`, { stdio: "ignore", timeout: 5000 });
              log(`Killed stale process on port ${port} (pid ${pid})`);
            } catch {}
          }
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

    const status = execSync("git status --porcelain", {
      encoding: "utf8", cwd: __dirname, timeout: 10000,
    }).trim();
    if (status) {
      warn("Local changes detected — skipping automatic update to avoid merge conflicts.");
      return false;
    }

    log(`${behind} new commit(s) available — updating...`);
    execSync("git pull --ff-only", { cwd: __dirname, stdio: "inherit", timeout: 60000 });
    log("Updated to latest version.");

    try {
      const changed = execSync(`git diff --name-only ${headBefore} HEAD`, {
        encoding: "utf8", cwd: __dirname, timeout: 5000,
      });
      if (/^package\.json$/m.test(changed) || /^package-lock\.json$/m.test(changed)) {
        log("Dependencies changed — will reinstall.");
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
  // Probe whether `claude` is on PATH. Earlier versions delegated to
  // resolveClaude() from app/lib/terminal.js, but that module was removed
  // when the embedded terminal feature was retired; the where/which probe
  // covers every supported scenario.
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
  const nodeModules = path.join(dir, "node_modules");
  if (!fs.existsSync(nodeModules)) return true;

  const pkgFile = path.join(dir, "package.json");
  const lockFile = path.join(dir, "package-lock.json");
  const hashFile = path.join(nodeModules, ".deps-hash");

  let content = "";
  try {
    content += fs.readFileSync(pkgFile, "utf8");
    const pkg = JSON.parse(content);
    const directDependencies = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    for (const name of Object.keys(directDependencies)) {
      const packageDir = path.join(nodeModules, ...name.split("/"));
      if (!fs.existsSync(path.join(packageDir, "package.json"))) return true;
    }
  } catch {
    return true;
  }
  try {
    const lockContent = fs.readFileSync(lockFile, "utf8");
    content += lockContent;
    const lock = JSON.parse(lockContent);
    for (const [relativePath, metadata] of Object.entries(lock.packages || {})) {
      if (
        !relativePath ||
        metadata.link ||
        metadata.optional ||
        metadata.devOptional ||
        !relativePath.startsWith("node_modules/")
      ) {
        continue;
      }
      if (!fs.existsSync(path.join(dir, relativePath, "package.json"))) return true;
    }
  } catch {
    return true;
  }
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
    log("Dependencies out of date — running npm ci...");
    try {
      execSync("npm ci --legacy-peer-deps", {
        stdio: "inherit",
        cwd: __dirname,
        timeout: 120000,
      });
      writeDepsHash(__dirname);
      log("npm ci complete");
    } catch {
      err("npm ci failed");
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
    if (os.platform() === "win32") {
      // Windows `start` is a shell builtin — must use cmd /c, but pass URL as a separate arg
      spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true }).unref();
    } else if (os.platform() === "darwin") {
      spawn("open", [url], { stdio: "ignore", detached: true }).unref();
    } else {
      spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
    }
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

// ---------------------------------------------------------------------------
// MCP dependency auto-update (npm packages used as MCP servers)
// Shared 4h cache with cli.js — avoids double-checking on `mcs start`
// ---------------------------------------------------------------------------

const MCP_NPM_DEPS = [
  "@microsoft/workiq",
];

const MCP_CHECK_FILE = path.join(os.homedir(), ".mcs-agent-builder", "mcp-check.json");

function updateMcpDeps() {
  // Skip if checked recently (4h cache — same cadence as cli.js)
  try {
    if (fs.existsSync(MCP_CHECK_FILE)) {
      const data = JSON.parse(fs.readFileSync(MCP_CHECK_FILE, "utf8"));
      if (Date.now() - data.lastCheck < 4 * 60 * 60 * 1000) return;
    }
  } catch {}

  let updated = 0;
  for (const pkg of MCP_NPM_DEPS) {
    try {
      const out = execSync(
        `npm list -g ${pkg} --json 2>${os.platform() === "win32" ? "NUL" : "/dev/null"}`,
        { encoding: "utf8", timeout: 10000 }
      );
      const currentVer = JSON.parse(out).dependencies?.[pkg]?.version;

      const latest = execSync(
        `npm view ${pkg} version`,
        { encoding: "utf8", timeout: 10000 }
      ).trim();

      if (!latest || latest === currentVer) continue;

      log(`Updating MCP: ${pkg} ${currentVer || "?"} \u2192 ${latest}...`);
      execSync(`npm install -g ${pkg}@latest`, { stdio: "inherit", timeout: 60000 });
      log(`${pkg} updated to ${latest}`);
      updated++;
    } catch {
      // Offline or error — skip silently
    }
  }

  // Cache the check timestamp (shared with cli.js)
  try {
    const dir = path.dirname(MCP_CHECK_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MCP_CHECK_FILE, JSON.stringify({ lastCheck: Date.now(), packages: MCP_NPM_DEPS }));
  } catch {}

  if (updated > 0) log(`${updated} MCP package(s) updated`);
}

// 3-5: Git repo only — auto-update, deps, hooks, MCP deps
if (isGitRepo) {
  autoUpdate();
  ensureNodeModules();
  ensureGitHooks();
  updateMcpDeps();

  // Frontend deps + rebuild only needed in dev (git repo)
  if (fs.existsSync(path.join(frontendDir, "package.json")) && depsStale(frontendDir)) {
    log("Frontend deps out of date — reinstalling...");
    try {
      execSync("npm ci --legacy-peer-deps", { stdio: "inherit", cwd: frontendDir, timeout: 120000 });
      writeDepsHash(frontendDir);
    } catch (e) {
      err(`Frontend dependency install failed: ${e.message}`);
      process.exit(1);
    }
    if (fs.existsSync(distIndex)) fs.unlinkSync(distIndex);
  }

  if (fs.existsSync(path.join(frontendDir, "package.json"))) {
    let needsBuild = !fs.existsSync(distIndex);

    // Check if source files are newer than the built output
    if (!needsBuild) {
      try {
        const distTime = fs.statSync(distIndex).mtimeMs;
        const srcDirs = ["src", "index.html", "vite.config.ts", "tailwind.config.js", "postcss.config.js"]
          .map((f) => path.join(frontendDir, f));
        const newestSrc = (function findNewest(entries) {
          let max = 0;
          for (const entry of entries) {
            try {
              const st = fs.statSync(entry);
              if (st.isDirectory()) {
                const children = fs.readdirSync(entry).map((c) => path.join(entry, c));
                max = Math.max(max, findNewest(children));
              } else {
                max = Math.max(max, st.mtimeMs);
              }
            } catch {}
          }
          return max;
        })(srcDirs);
        if (newestSrc > distTime) {
          needsBuild = true;
          log("Frontend source changed since last build — rebuilding...");
        }
      } catch {}
    }

    if (needsBuild) {
      if (!fs.existsSync(distIndex)) log("Frontend not built — building...");
      try {
        execSync("npm run build", { stdio: "inherit", cwd: frontendDir, timeout: 120000 });
        log("Frontend build complete");
      } catch (e) {
        err(`Frontend build failed: ${e.message}`);
        process.exit(1);
      }
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

  // Graceful shutdown — kill children, wait up to 3s, then force exit
  let shuttingDown = false;
  function shutdown() {
    if (shuttingDown) return; // Prevent double-shutdown on rapid Ctrl+C
    shuttingDown = true;
    console.log("\n\x1b[90m  Shutting down...\x1b[0m");
    removeLockfile();
    try { server.kill("SIGTERM"); } catch {}
    // Wait for server to exit gracefully, force after 3s
    const forceTimer = setTimeout(() => {
      try { server.kill("SIGKILL"); } catch {}
      process.exit(0);
    }, 3000);
    forceTimer.unref(); // Don't keep process alive just for the timer
    server.once("exit", () => {
      clearTimeout(forceTimer);
      process.exit(0);
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})();
