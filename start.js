#!/usr/bin/env node
/**
 * MCS Agent Builder — Launcher
 *
 * Starts the dashboard server (which manages the terminal sidecar),
 * opens the browser, and shuts everything down cleanly on exit.
 *
 * Handles:
 *   - Killing stale processes on ports 8000/8001
 *   - Auto-installing npm + pip dependencies if missing
 *   - Opening the browser once the dashboard responds
 *   - Graceful shutdown on Ctrl+C
 *
 * Usage: npm start
 */

const { spawn, execSync } = require("child_process");
const http = require("http");
const path = require("path");
const os = require("os");
const fs = require("fs");

const PORT_APP = 8000;
const PORT_TERMINAL = 8001;
const URL = `http://localhost:${PORT_APP}`;

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
// Kill stale processes on a port (Windows + Unix)
// ---------------------------------------------------------------------------

function killPort(port) {
  try {
    if (os.platform() === "win32") {
      const result = execSync(`netstat -ano -p TCP`, {
        encoding: "utf8",
        timeout: 5000,
      });
      for (const line of result.split("\n")) {
        if (line.includes(`:${port}`) && line.includes("LISTENING")) {
          const pid = line.trim().split(/\s+/).pop();
          if (pid && /^\d+$/.test(pid) && pid !== "0") {
            try {
              execSync(`taskkill /F /PID ${pid}`, {
                stdio: "ignore",
                timeout: 5000,
              });
              log(`Killed stale process on port ${port} (pid ${pid})`);
            } catch {
              // Process may have already exited
            }
          }
        }
      }
    } else {
      // macOS / Linux
      try {
        const pid = execSync(`lsof -ti:${port}`, {
          encoding: "utf8",
          timeout: 5000,
        }).trim();
        if (pid) {
          execSync(`kill -9 ${pid}`, { stdio: "ignore", timeout: 5000 });
          log(`Killed stale process on port ${port} (pid ${pid})`);
        }
      } catch {
        // No process on port — fine
      }
    }
  } catch {
    // netstat/lsof failed — not critical
  }
}

// ---------------------------------------------------------------------------
// Preflight: check required tools exist
// ---------------------------------------------------------------------------

function checkCommand(cmd, name, hint) {
  try {
    execSync(cmd, { stdio: "ignore", timeout: 10000 });
    return true;
  } catch {
    err(`${name} not found. ${hint}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Preflight: auto-install dependencies
// ---------------------------------------------------------------------------

function ensureNodeModules() {
  if (!fs.existsSync(path.join(__dirname, "node_modules"))) {
    warn("node_modules not found — running npm install...");
    try {
      execSync("npm install", { stdio: "inherit", cwd: __dirname });
      log("npm install complete");
    } catch {
      err("npm install failed");
      process.exit(1);
    }
  }
}

function ensurePythonDeps() {
  // Check if fastapi and uvicorn are importable
  try {
    execSync('python -c "import fastapi; import uvicorn"', {
      stdio: "ignore",
      timeout: 15000,
    });
  } catch {
    warn("Python deps missing — running pip install fastapi uvicorn...");
    try {
      execSync("pip install fastapi uvicorn python-multipart", {
        stdio: "inherit",
        timeout: 120000,
      });
      log("pip install complete");
    } catch {
      err("pip install failed. Run manually: pip install fastapi uvicorn python-multipart");
      process.exit(1);
    }
  }
}

// ---------------------------------------------------------------------------
// Preflight: ensure Azure CLI + DevOps extension (for bug/suggest skills)
// ---------------------------------------------------------------------------

function ensureAzDevOps() {
  // Check if az CLI is available
  try {
    execSync("az --version", { stdio: "ignore", timeout: 15000 });
  } catch {
    warn("Azure CLI not found — bug/suggest buttons won't work until installed.");
    warn("Install: https://aka.ms/installazurecli");
    return; // Non-blocking — the rest of the app works fine
  }

  // Check if azure-devops extension is installed
  try {
    execSync("az extension show --name azure-devops", { stdio: "ignore", timeout: 15000 });
  } catch {
    log("Installing Azure DevOps CLI extension...");
    try {
      execSync("az extension add --name azure-devops", { stdio: "inherit", timeout: 120000 });
      log("Azure DevOps extension installed");
    } catch {
      warn("Could not install azure-devops extension — run manually: az extension add --name azure-devops");
    }
  }
}

// ---------------------------------------------------------------------------
// Preflight: install git hooks for core file protection
// ---------------------------------------------------------------------------

function ensureGitHooks() {
  const src = path.join(__dirname, "tools", "git-hooks", "pre-commit");
  const dst = path.join(__dirname, ".git", "hooks", "pre-commit");
  if (!fs.existsSync(src)) return;
  try {
    const srcContent = fs.readFileSync(src, "utf8");
    const dstExists = fs.existsSync(dst);
    if (!dstExists || fs.readFileSync(dst, "utf8") !== srcContent) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, srcContent, { mode: 0o755 });
      log("Git hooks installed \u2014 core files protected");
    }
  } catch {
    warn("Could not install git hooks (non-critical)");
  }
}

// ---------------------------------------------------------------------------
// Wait for server to respond
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

// ---------------------------------------------------------------------------
// Open browser
// ---------------------------------------------------------------------------

function openBrowser(url) {
  try {
    if (os.platform() === "win32")
      execSync(`start "" "${url}"`, { stdio: "ignore" });
    else if (os.platform() === "darwin")
      execSync(`open "${url}"`, { stdio: "ignore" });
    else execSync(`xdg-open "${url}"`, { stdio: "ignore" });
  } catch {
    log(`Open in your browser: ${url}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log("\n\x1b[36m  MCS Agent Builder\x1b[0m\n");

// 1. Check required tools
const ok = [
  checkCommand("node --version", "Node.js", "https://nodejs.org"),
  checkCommand("python --version", "Python", "https://python.org"),
];
if (!ok.every(Boolean)) {
  err("Fix the above issues and try again.");
  process.exit(1);
}

// 2. Auto-install dependencies
ensureNodeModules();
ensurePythonDeps();

// 3. Install git hooks + ensure az devops
ensureGitHooks();
ensureAzDevOps();

// 3b. Auto-build frontend if dist is missing
const frontendDir = path.join(__dirname, "app", "frontend");
const distIndex = path.join(__dirname, "app", "dist", "index.html");
if (fs.existsSync(path.join(frontendDir, "package.json")) && !fs.existsSync(distIndex)) {
  log("Frontend not built — building app/frontend...");
  if (!fs.existsSync(path.join(frontendDir, "node_modules"))) {
    try {
      execSync("npm install", { stdio: "inherit", cwd: frontendDir, timeout: 120000 });
    } catch {
      warn("npm install failed in app/frontend — frontend may not work");
    }
  }
  try {
    execSync("npm run build", { stdio: "inherit", cwd: frontendDir, timeout: 120000 });
    log("Frontend build complete");
  } catch {
    warn("Frontend build failed — dashboard may show placeholder page");
  }
}

// 4. Kill anything still holding our ports from a previous run
log("Checking for stale processes...");
killPort(PORT_APP);
killPort(PORT_TERMINAL);

// Small delay to let OS release the sockets
const startTime = Date.now();
while (Date.now() - startTime < 500) {
  // busy-wait for socket release
}

// 5. Start the dashboard server (it manages terminal-server.js as a sidecar)
//    Use spawn without shell to avoid DEP0190 deprecation warning.
//    On Windows, resolve python to its full path to avoid needing shell: true.
let pythonCmd = "python";
try {
  pythonCmd = execSync(
    os.platform() === "win32" ? "where python" : "which python",
    { encoding: "utf8", timeout: 5000 }
  )
    .split("\n")[0]
    .trim();
} catch {
  // Fall back to "python" and hope it's on PATH
}

const serverScript = path.join(__dirname, "app", "server.py");
const server = spawn(pythonCmd, [serverScript], {
  cwd: __dirname,
  stdio: "inherit",
  env: { ...process.env, PORT: String(PORT_APP) },
});

server.on("error", (e) => {
  err(`Failed to start server: ${e.message}`);
  process.exit(1);
});

server.on("exit", (code) => {
  if (code !== null && code !== 0) {
    err(`Server exited with code ${code}`);
  }
  process.exit(code || 0);
});

// 6. Wait for dashboard to respond, then open browser
waitForReady(URL)
  .then(() => {
    console.log(
      `\n\x1b[32m  ✓ Dashboard ready at ${URL}\x1b[0m`
    );
    console.log("\x1b[90m  Press Ctrl+C to stop\x1b[0m\n");
    openBrowser(URL);
  })
  .catch(() => {
    warn(`Dashboard may still be starting. Open manually: ${URL}`);
  });

// 7. Graceful shutdown
function shutdown() {
  console.log("\n\x1b[90m  Shutting down...\x1b[0m");
  try {
    server.kill();
  } catch {}
  // Give server a moment to clean up its sidecar, then force exit
  setTimeout(() => process.exit(0), 2000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
