#!/usr/bin/env node
/**
 * MCS Agent Builder — Launcher
 *
 * Starts both servers, opens the dashboard in the browser,
 * and shuts everything down cleanly on exit.
 *
 * Usage: npm start
 */

const { spawn, execSync } = require("child_process");
const http = require("http");
const path = require("path");
const os = require("os");

const PORT_APP = 8000;
const PORT_TERMINAL = 8001;
const URL = `http://localhost:${PORT_APP}`;

// ---------------------------------------------------------------------------
// Preflight checks
// ---------------------------------------------------------------------------

function check(cmd, name, hint) {
  try {
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    console.error(`\x1b[31m✗ ${name} not found.\x1b[0m ${hint}`);
    return false;
  }
}

console.log("\x1b[36mMCS Agent Builder\x1b[0m — starting...\n");

const checks = [
  check("node --version", "Node.js", "Install from https://nodejs.org"),
  check("python --version", "Python", "Install from https://python.org"),
];

// Check if node_modules exists
const fs = require("fs");
if (!fs.existsSync(path.join(__dirname, "node_modules"))) {
  console.log("\x1b[33m⚠ node_modules not found. Running npm install...\x1b[0m\n");
  try {
    execSync("npm install", { stdio: "inherit", cwd: __dirname });
  } catch {
    console.error("\x1b[31m✗ npm install failed.\x1b[0m");
    process.exit(1);
  }
}

if (!checks.every(Boolean)) {
  console.error("\nFix the above issues and try again.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Start servers
// ---------------------------------------------------------------------------

const procs = [];

function startProc(label, cmd, args, color) {
  const p = spawn(cmd, args, {
    cwd: __dirname,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(PORT_APP) },
  });

  p.stdout.on("data", (d) => {
    d.toString().split("\n").filter(Boolean).forEach((line) => {
      console.log(`${color}[${label}]\x1b[0m ${line}`);
    });
  });
  p.stderr.on("data", (d) => {
    d.toString().split("\n").filter(Boolean).forEach((line) => {
      console.log(`${color}[${label}]\x1b[0m ${line}`);
    });
  });
  p.on("exit", (code) => {
    console.log(`${color}[${label}]\x1b[0m exited (${code})`);
  });

  procs.push(p);
  return p;
}

const app = startProc("dashboard", "python", ["app/server.py"], "\x1b[36m");
const terminal = startProc("terminal", "node", ["app/terminal-server.js"], "\x1b[35m");

// ---------------------------------------------------------------------------
// Wait for dashboard to be ready, then open browser
// ---------------------------------------------------------------------------

function waitForReady(url, timeout = 15000) {
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
  const platform = os.platform();
  try {
    if (platform === "win32") execSync(`start "" "${url}"`, { stdio: "ignore" });
    else if (platform === "darwin") execSync(`open "${url}"`, { stdio: "ignore" });
    else execSync(`xdg-open "${url}"`, { stdio: "ignore" });
  } catch {
    console.log(`\n\x1b[33mOpen in your browser:\x1b[0m ${url}\n`);
  }
}

waitForReady(URL)
  .then(() => {
    console.log(`\n\x1b[32m✓ Dashboard ready at ${URL}\x1b[0m`);
    console.log("\x1b[90mPress Ctrl+C to stop\x1b[0m\n");
    openBrowser(URL);
  })
  .catch(() => {
    console.log(`\n\x1b[33m⚠ Dashboard may still be starting. Open manually: ${URL}\x1b[0m\n`);
  });

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function shutdown() {
  console.log("\n\x1b[90mShutting down...\x1b[0m");
  procs.forEach((p) => {
    try { p.kill(); } catch {}
  });
  setTimeout(() => process.exit(0), 1000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// If either server dies, shut down both
app.on("exit", () => { terminal.kill(); setTimeout(() => process.exit(1), 500); });
terminal.on("exit", () => { app.kill(); setTimeout(() => process.exit(1), 500); });
