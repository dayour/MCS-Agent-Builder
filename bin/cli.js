#!/usr/bin/env node
/**
 * mcs-agent-builder CLI
 *
 * Commands:
 *   mcs-agent-builder start     Start the dashboard
 *   mcs-agent-builder stop      Stop a running instance
 *   mcs-agent-builder restart   Restart the dashboard
 *   mcs-agent-builder health    Check if the dashboard is running
 *   mcs-agent-builder doctor    Check all prerequisites
 *
 * Flags --start, --stop, --restart, --health, --doctor also accepted.
 */

const { spawn, execSync } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");
const os = require("os");

const PKG_DIR = path.resolve(__dirname, "..");
const LOCKFILE = path.join(os.homedir(), ".mcs-agent-builder.lock");
const VERSION = require(path.join(PKG_DIR, "package.json")).version;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  console.log(`\x1b[36m[mcs-agent-builder]\x1b[0m ${msg}`);
}

function err(msg) {
  console.error(`\x1b[31m[mcs-agent-builder]\x1b[0m ${msg}`);
}

function readLock() {
  try {
    return JSON.parse(fs.readFileSync(LOCKFILE, "utf8"));
  } catch {
    return null;
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function httpGet(url, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout }, (res) => {
      resolve(res.statusCode);
      res.resume();
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

// ---------------------------------------------------------------------------
// Auto-update — check every 4h, install before starting
// ---------------------------------------------------------------------------

const UPDATE_CHECK_FILE = path.join(os.homedir(), ".mcs-agent-builder", "update-check.json");

/**
 * Check npm registry for a newer version. Returns the version string or null.
 * Cached for 4 hours to avoid slowing down every start.
 */
async function getLatestVersion() {
  // Check cache first
  try {
    if (fs.existsSync(UPDATE_CHECK_FILE)) {
      const data = JSON.parse(fs.readFileSync(UPDATE_CHECK_FILE, "utf8"));
      if (Date.now() - data.lastCheck < 4 * 60 * 60 * 1000) {
        return data.latestVersion || null;
      }
    }
  } catch {}

  // Fetch from npm registry (fast timeout — don't block startup if offline)
  try {
    const latest = await new Promise((resolve, reject) => {
      const req = require("https").get(
        "https://registry.npmjs.org/mcs-agent-builder/latest",
        { timeout: 3000 },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            try { resolve(JSON.parse(data).version); } catch { reject(); }
          });
        }
      );
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(); });
    });

    // Cache the result
    const dir = path.dirname(UPDATE_CHECK_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(UPDATE_CHECK_FILE, JSON.stringify({ lastCheck: Date.now(), latestVersion: latest }));

    return latest;
  } catch {
    return null; // Offline or error — continue with current version
  }
}

/**
 * Auto-update before starting. If update fails, continue with current version.
 */
async function autoUpdate() {
  const latest = await getLatestVersion();
  if (!latest || latest === VERSION) return;

  log(`Updating ${VERSION} \u2192 ${latest}...`);
  try {
    execSync("npm install -g mcs-agent-builder@latest", { stdio: "inherit", timeout: 120000 });
    log(`Updated to ${latest}`);
    // Clear cache so next check is fresh
    try { fs.unlinkSync(UPDATE_CHECK_FILE); } catch {}
  } catch {
    log(`Update failed — starting with current version ${VERSION}`);
  }
}

function updatePackage() {
  log(`Updating mcs-agent-builder...`);
  try {
    execSync("npm install -g mcs-agent-builder@latest", { stdio: "inherit", timeout: 120000 });
    // Clear cache so next start sees fresh version
    try { fs.unlinkSync(UPDATE_CHECK_FILE); } catch {}
  } catch (e) {
    err(`Update failed: ${e.message}`);
    err("Try manually: npm install -g mcs-agent-builder@latest");
    process.exit(1);
  }

  // Auto-restart if a running instance is detected
  const lock = readLock();
  if (lock && isProcessAlive(lock.pid)) {
    log("Restarting dashboard with new version...");
    try { process.kill(lock.pid, "SIGTERM"); } catch {}
    const start = Date.now();
    const wait = setInterval(() => {
      if (!isProcessAlive(lock.pid) || Date.now() - start > 5000) {
        clearInterval(wait);
        try { fs.unlinkSync(LOCKFILE); } catch {}
        startServer();
      }
    }, 200);
  } else {
    log("Update complete. Run: mcs start");
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function startServer() {
  const lock = readLock();
  if (lock && isProcessAlive(lock.pid)) {
    log(`Already running (pid ${lock.pid}, port ${lock.port}).`);
    log(`Open http://localhost:${lock.port}`);
    return;
  }

  // Clean stale lockfile
  if (lock) {
    try { fs.unlinkSync(LOCKFILE); } catch {}
  }

  // Auto-update before starting (skips if offline or up-to-date)
  await autoUpdate();

  log(`Starting MCS Agent Builder v${VERSION}...`);

  // Spawn start.js as a detached child so the CLI can exit
  const startJs = path.join(PKG_DIR, "start.js");
  const child = spawn(process.execPath, [startJs], {
    cwd: PKG_DIR,
    stdio: "inherit",
    env: { ...process.env, MCS_LOCKFILE: LOCKFILE },
  });

  child.on("error", (e) => {
    err(`Failed to start: ${e.message}`);
    process.exit(1);
  });

  // Forward signals for graceful shutdown
  const relay = (sig) => { try { child.kill(sig); } catch {} };
  process.on("SIGINT", () => relay("SIGINT"));
  process.on("SIGTERM", () => relay("SIGTERM"));

  child.on("exit", (code) => process.exit(code || 0));
}

function stopServer() {
  const lock = readLock();
  if (!lock) {
    log("No running instance found.");
    return;
  }

  if (!isProcessAlive(lock.pid)) {
    log("Instance already stopped (cleaning lockfile).");
    try { fs.unlinkSync(LOCKFILE); } catch {}
    return;
  }

  log(`Stopping instance (pid ${lock.pid}, port ${lock.port})...`);

  try {
    // Send SIGTERM first for graceful shutdown
    process.kill(lock.pid, "SIGTERM");
  } catch {
    // Already gone
  }

  // Wait up to 5s for process to die, then force kill
  const start = Date.now();
  const poll = setInterval(() => {
    if (!isProcessAlive(lock.pid)) {
      clearInterval(poll);
      try { fs.unlinkSync(LOCKFILE); } catch {}
      log("Stopped.");
      return;
    }
    if (Date.now() - start > 5000) {
      clearInterval(poll);
      try { process.kill(lock.pid, "SIGKILL"); } catch {}
      try { fs.unlinkSync(LOCKFILE); } catch {}
      log("Force-killed.");
    }
  }, 200);
}

async function healthCheck() {
  const lock = readLock();
  if (!lock) {
    console.log("Status: \x1b[31mNot running\x1b[0m");
    console.log("Run: mcs-agent-builder start");
    process.exit(1);
    return;
  }

  if (!isProcessAlive(lock.pid)) {
    console.log("Status: \x1b[31mDead\x1b[0m (stale lockfile)");
    try { fs.unlinkSync(LOCKFILE); } catch {}
    process.exit(1);
    return;
  }

  const url = `http://localhost:${lock.port}`;
  try {
    const status = await httpGet(`${url}/api/health`).catch(() => httpGet(url));
    if (status === 200) {
      console.log(`Status: \x1b[32mHealthy\x1b[0m`);
      console.log(`  PID:  ${lock.pid}`);
      console.log(`  Port: ${lock.port}`);
      console.log(`  URL:  ${url}`);
    } else {
      console.log(`Status: \x1b[33mDegraded\x1b[0m (HTTP ${status})`);
      console.log(`  PID:  ${lock.pid}`);
      console.log(`  Port: ${lock.port}`);
      process.exit(1);
    }
  } catch {
    console.log(`Status: \x1b[33mUnresponsive\x1b[0m (pid ${lock.pid} alive, HTTP failed)`);
    console.log(`  PID:  ${lock.pid}`);
    console.log(`  Port: ${lock.port}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Doctor — check all prerequisites
// ---------------------------------------------------------------------------

function doctor() {
  console.log(`\n  \x1b[36mMCS Agent Builder\x1b[0m v${VERSION} — Environment Check\n`);

  const checks = [];
  let failures = 0;

  function check(name, fn) {
    try {
      const result = fn();
      if (result.ok) {
        checks.push({ name, status: "pass", detail: result.detail });
      } else {
        checks.push({ name, status: "fail", detail: result.detail, fix: result.fix });
        failures++;
      }
    } catch (e) {
      checks.push({ name, status: "fail", detail: e.message, fix: "" });
      failures++;
    }
  }

  function run(cmd) {
    return execSync(cmd, { encoding: "utf8", timeout: 15000, stdio: "pipe" }).trim();
  }

  function cmdExists(cmd) {
    try {
      const which = os.platform() === "win32" ? "where" : "which";
      run(`${which} ${cmd}`);
      return true;
    } catch { return false; }
  }

  // 1. Node.js
  check("Node.js (18+)", () => {
    const ver = process.versions.node;
    const major = parseInt(ver.split(".")[0], 10);
    if (major >= 18) return { ok: true, detail: `v${ver}` };
    return { ok: false, detail: `v${ver} (too old)`, fix: "Run start.cmd or: winget install OpenJS.NodeJS.LTS" };
  });

  // 2. Python
  check("Python (3.10+)", () => {
    for (const cmd of ["python", "python3"]) {
      if (!cmdExists(cmd)) continue;
      try {
        const ver = run(`${cmd} -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"`);
        const [maj, min] = ver.split(".").map(Number);
        if (maj >= 3 && min >= 10) return { ok: true, detail: `v${ver} (${cmd})` };
        return { ok: false, detail: `v${ver} (too old)`, fix: "Run start.cmd or: winget install Python.Python.3.12" };
      } catch {}
    }
    return { ok: false, detail: "not found", fix: "Run start.cmd or: winget install Python.Python.3.12" };
  });

  // 3. Git
  check("Git", () => {
    if (!cmdExists("git")) return { ok: false, detail: "not found", fix: "Run start.cmd or: winget install Git.Git" };
    const ver = run("git --version").replace("git version ", "");
    return { ok: true, detail: `v${ver}` };
  });

  // 4. Claude Code
  check("Claude Code", () => {
    // Native install
    const nativeDir = path.join(os.homedir(), ".claude-cli");
    if (fs.existsSync(nativeDir)) {
      try {
        const versions = fs.readdirSync(nativeDir)
          .filter(d => fs.statSync(path.join(nativeDir, d)).isDirectory())
          .sort();
        if (versions.length > 0) {
          const latest = versions[versions.length - 1];
          if (fs.existsSync(path.join(nativeDir, latest, "claude.exe"))) {
            return { ok: true, detail: `native (${latest})` };
          }
        }
      } catch {}
    }
    // npm global
    const npmCli = path.join(os.homedir(), "AppData", "Roaming", "npm", "node_modules", "@anthropic-ai", "claude-code", "cli.js");
    if (fs.existsSync(npmCli)) return { ok: true, detail: "npm global" };
    // PATH
    if (cmdExists("claude")) return { ok: true, detail: "PATH" };
    return { ok: false, detail: "not found", fix: "npm install -g @anthropic-ai/claude-code" };
  });

  // 5. Document conversion (mammoth, xlsx, turndown)
  check("Document conversion", () => {
    try {
      require("mammoth");
      require("turndown");
      require("xlsx");
      return { ok: true, detail: "mammoth, turndown, xlsx" };
    } catch (e) {
      return { ok: false, detail: `missing: ${e.message.split("'")[1] || "module"}`, fix: "npm install" };
    }
  });

  // 6. Azure CLI (optional)
  check("Azure CLI (optional)", () => {
    if (!cmdExists("az")) return { ok: false, detail: "not found", fix: "winget install Microsoft.AzureCLI" };
    try {
      const ver = run('az version --output tsv --query "\\"azure-cli\\""');
      return { ok: true, detail: `v${ver}` };
    } catch {
      return { ok: true, detail: "installed (version check failed)" };
    }
  });

  // 7. .NET 10 runtime (optional — for om-cli)
  check(".NET 10 runtime (optional)", () => {
    try {
      const runtimes = run("dotnet --list-runtimes");
      if (runtimes.includes("Microsoft.NETCore.App 10.")) {
        const match = runtimes.match(/Microsoft\.NETCore\.App (10\.\d+\.\d+)/);
        return { ok: true, detail: match ? `v${match[1]}` : "v10.x" };
      }
      return { ok: false, detail: "not found", fix: "winget install Microsoft.DotNet.SDK.10" };
    } catch {
      return { ok: false, detail: "dotnet not found", fix: "winget install Microsoft.DotNet.SDK.10" };
    }
  });

  // 8. PAC CLI (optional)
  check("PAC CLI (optional)", () => {
    if (!cmdExists("pac")) return { ok: false, detail: "not found", fix: "dotnet tool install --global Microsoft.PowerApps.CLI.Tool" };
    try {
      const ver = run("pac --version");
      return { ok: true, detail: `v${ver}` };
    } catch {
      return { ok: true, detail: "installed" };
    }
  });

  // 9. Frontend built
  check("Frontend (app/dist)", () => {
    const distIndex = path.join(PKG_DIR, "app", "dist", "index.html");
    if (fs.existsSync(distIndex)) return { ok: true, detail: "built" };
    return { ok: false, detail: "not built", fix: "npm run frontend:build" };
  });

  // 10. node-pty prebuilt
  check("Terminal (node-pty)", () => {
    try {
      const pty = require("@homebridge/node-pty-prebuilt-multiarch");
      if (typeof pty.spawn === "function") return { ok: true, detail: "prebuilt binaries loaded" };
      return { ok: false, detail: "module loaded but spawn missing", fix: "npm install" };
    } catch (e) {
      return { ok: false, detail: e.message.split("\n")[0], fix: "npm install" };
    }
  });

  // 11. GPT-5.4 review (optional — needs gh CLI + copilot scope)
  check("GPT-5.4 review (optional)", () => {
    if (!cmdExists("gh")) return { ok: false, detail: "gh CLI not found", fix: "winget install GitHub.cli" };
    try {
      const status = run("gh auth status 2>&1");
      if (!status.includes("Logged in")) return { ok: false, detail: "gh not logged in", fix: "gh auth login" };
      if (!status.includes("'copilot'") && !status.includes('"copilot"')) {
        return { ok: false, detail: "missing copilot scope", fix: "gh auth refresh --scopes copilot" };
      }
      return { ok: true, detail: "gh + copilot scope" };
    } catch (e) {
      const output = (e.stdout || "") + (e.stderr || "");
      if (output.includes("Logged in") && (output.includes("'copilot'") || output.includes('"copilot"'))) {
        return { ok: true, detail: "gh + copilot scope" };
      }
      if (output.includes("Logged in")) {
        return { ok: false, detail: "missing copilot scope", fix: "gh auth refresh --scopes copilot" };
      }
      return { ok: false, detail: "gh not logged in", fix: "gh auth login && gh auth refresh --scopes copilot" };
    }
  });

  // Print results
  const PASS = "\x1b[32mPASS\x1b[0m";
  const FAIL = "\x1b[31mFAIL\x1b[0m";
  const WARN = "\x1b[33mFAIL\x1b[0m";

  for (const c of checks) {
    const isOptional = c.name.includes("optional");
    const icon = c.status === "pass" ? PASS : (isOptional ? WARN : FAIL);
    console.log(`  ${icon}  ${c.name.padEnd(30)} ${c.detail}`);
    if (c.status === "fail" && c.fix) {
      console.log(`         ${"".padEnd(30)} \x1b[90mFix: ${c.fix}\x1b[0m`);
    }
  }

  const required = checks.filter(c => !c.name.includes("optional"));
  const requiredFails = required.filter(c => c.status === "fail").length;

  console.log("");
  if (requiredFails === 0) {
    console.log("  \x1b[32mAll required checks passed.\x1b[0m Ready to run: mcs-agent-builder start");
  } else {
    console.log(`  \x1b[31m${requiredFails} required check(s) failed.\x1b[0m Fix the issues above, or run start.cmd for auto-install.`);
  }
  console.log("");

  process.exit(requiredFails > 0 ? 1 : 0);
}

function showHelp() {
  console.log(`
  \x1b[36mMCS Agent Builder\x1b[0m v${VERSION}

  Microsoft Copilot Studio agent build automation with Claude Code.

  \x1b[1mUsage:\x1b[0m
    mcs <command>

  \x1b[1mCommands:\x1b[0m
    start       Start the dashboard server
    stop        Stop a running instance
    restart     Stop then start
    health      Check if the dashboard is running
    doctor      Check all prerequisites
    update      Update to the latest version
    -v          Show version
    -h          Show this help

  \x1b[1mAliases:\x1b[0m  mcs, mcsab, mcs-agent-builder
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const raw = process.argv[2] || "help";
const command = raw.replace(/^-+/, "");

switch (command) {
  case "start":
    startServer();
    break;
  case "stop":
    stopServer();
    break;
  case "restart":
    stopServer();
    setTimeout(() => startServer(), 1500);
    break;
  case "health":
    healthCheck();
    break;
  case "doctor":
  case "doc":
    doctor();
    break;
  case "update":
  case "upgrade":
    updatePackage();
    break;
  case "version":
  case "v":
    console.log(`mcs-agent-builder v${VERSION}`);
    break;
  case "help":
  case "h":
  default:
    showHelp();
    break;
}
