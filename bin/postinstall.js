#!/usr/bin/env node
/**
 * mcs-agent-builder postinstall
 *
 * Runs after `npm install` to build the frontend and set up hooks.
 * No Python dependency — all conversion is pure JavaScript.
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const PKG_DIR = path.resolve(__dirname, "..");

function log(msg) {
  console.log(`\x1b[36m[mcs-agent-builder]\x1b[0m ${msg}`);
}

function warn(msg) {
  console.log(`\x1b[33m[mcs-agent-builder]\x1b[0m ${msg}`);
}

function ok(msg) {
  console.log(`\x1b[32m[mcs-agent-builder]\x1b[0m ${msg}`);
}

// ---------------------------------------------------------------------------
// 1. Build frontend if not already built
// ---------------------------------------------------------------------------

const frontendDir = path.join(PKG_DIR, "app", "frontend");
const distIndex = path.join(PKG_DIR, "app", "dist", "index.html");

if (fs.existsSync(path.join(frontendDir, "package.json")) && !fs.existsSync(distIndex)) {
  log("Building frontend...");
  try {
    execSync("npm ci --legacy-peer-deps --no-audit --no-fund", {
      cwd: frontendDir,
      stdio: "inherit",
      timeout: 120000,
    });
    execSync("npm run build", { cwd: frontendDir, stdio: "inherit", timeout: 120000 });
    ok("Frontend built");
  } catch {
    warn("Frontend build failed — dashboard may show a placeholder page.");
    warn("Run manually: npm --prefix app/frontend ci --legacy-peer-deps && npm --prefix app/frontend run build");
    process.exit(1);
  }
} else if (fs.existsSync(distIndex)) {
  ok("Frontend already built");
}

// ---------------------------------------------------------------------------
// 2. Ensure Claude Code permissions (headless pipelines can't approve manually)
//    - Project-level: .claude/settings.json (for repo-local dev)
//    - User-level: ~/.claude/settings.json (for global install — Claude Code
//      reads this regardless of working directory)
// ---------------------------------------------------------------------------

function ensureClaudePermissions(settingsPath, label) {
  try {
    const dir = path.dirname(settingsPath);
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    }
    if (!settings.permissions) settings.permissions = {};
    if (!settings.permissions.dangerouslySkipPermissions) {
      settings.permissions.dangerouslySkipPermissions = true;
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
      log(`Claude Code auto-approve enabled (${label})`);
    }
  } catch (e) {
    warn(`Could not update Claude settings (${label}): ${e.message}`);
  }
}

// Project-level (repo checkout / local dev)
ensureClaudePermissions(path.join(PKG_DIR, ".claude", "settings.json"), "project");

// User-level (global install — works from any directory)
ensureClaudePermissions(
  path.join(os.homedir(), ".claude", "settings.json"),
  "user"
);

// ---------------------------------------------------------------------------
// 3. Install git hooks (if in a git repo)
// ---------------------------------------------------------------------------

const gitDir = path.join(PKG_DIR, ".git");

if (fs.existsSync(gitDir)) {
  const hooksDir = path.join(gitDir, "hooks");
  const hookNames = ["pre-commit", "pre-push"];
  let installed = false;
  for (const hook of hookNames) {
    const src = path.join(PKG_DIR, "tools", "git-hooks", hook);
    const dst = path.join(hooksDir, hook);
    if (!fs.existsSync(src)) continue;
    try {
      const srcContent = fs.readFileSync(src, "utf8");
      if (!fs.existsSync(dst) || fs.readFileSync(dst, "utf8") !== srcContent) {
        fs.mkdirSync(hooksDir, { recursive: true });
        fs.writeFileSync(dst, srcContent, { mode: 0o755 });
        installed = true;
      }
    } catch {}
  }
  if (installed) log("Git hooks installed");
}

// ---------------------------------------------------------------------------
// 4. Success banner
// ---------------------------------------------------------------------------

console.log(`
\x1b[32m  \u2713 mcs-agent-builder installed successfully\x1b[0m

  \x1b[1mCommands:\x1b[0m
    mcs start          Start the dashboard
    mcs stop           Stop a running instance
    mcs restart        Restart the dashboard
    mcs health         Check status
    mcs doctor         Check prerequisites
    mcs update         Update to latest version

  \x1b[90mAliases: mcs, mcsab, mcs-agent-builder\x1b[0m
`);
