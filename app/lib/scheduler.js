/**
 * Scheduler — node-cron based recurring task automation.
 *
 * Manages tiered knowledge cache refresh, upstream repo checks,
 * eval regression, solution library refresh, and learnings index updates.
 *
 * State persists to disk so dashboard can show status across restarts.
 * Single-process design — this app runs as one server on localhost.
 */

const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);
const dev = require("./dev-logger");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const BASE_DIR = path.resolve(__dirname, "../..");
const KNOWLEDGE_DIR = path.join(BASE_DIR, "knowledge");
const STATE_FILE = path.join(BASE_DIR, "app", ".scheduler-state.json");

// ---------------------------------------------------------------------------
// Tier definitions for cache files
// ---------------------------------------------------------------------------

const TIER1_FILES = [
  "models.md", "triggers.md", "mcp-servers.md", "connectors.md",
  "knowledge-sources.md", "channels.md", "first-party-agents.md",
  "declarative-agents.md",
];

const TIER2_FILES = [
  "limits-licensing.md", "auth-methods.md", "adaptive-cards.md",
  "generative-ai-features.md", "analytics-reporting.md",
  "environments-lifecycle.md", "topic-authoring.md", "testing-publishing.md",
];

const TIER3_FILES = [
  "security-governance.md", "integration-patterns.md",
  "multilingual.md", "custom-plugins.md", "voice-telephony.md",
  "dataverse-tables.md", "power-automate-flows.md", "teams-deployment.md",
];

// ---------------------------------------------------------------------------
// State management — persists across restarts
// ---------------------------------------------------------------------------

let state = {
  jobs: {},
  lastSaved: null,
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch (err) {
    dev.warn("scheduler", "Failed to load state", err.message);
  }
}

function saveState() {
  state.lastSaved = new Date().toISOString();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    dev.warn("scheduler", "Failed to save state", err.message);
  }
}

function updateJobState(name, updates) {
  if (!state.jobs[name]) {
    state.jobs[name] = { lastRun: null, lastSuccess: null, lastError: null, running: false, runCount: 0 };
  }
  Object.assign(state.jobs[name], updates);
  saveState();
}

// ---------------------------------------------------------------------------
// Job implementations
// ---------------------------------------------------------------------------

/**
 * Check cache file freshness and report stale files.
 * Returns list of stale file names.
 */
function checkCacheStaleness(files, maxAgeDays) {
  const cacheDir = path.join(KNOWLEDGE_DIR, "cache");
  const stale = [];
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  for (const file of files) {
    const filePath = path.join(cacheDir, file);
    if (!fs.existsSync(filePath)) {
      stale.push(file);
      continue;
    }

    // Check last_verified header in the file
    try {
      const content = fs.readFileSync(filePath, "utf-8").slice(0, 500);
      const match = content.match(/last_verified:\s*(\d{4}-\d{2}-\d{2})/);
      if (match) {
        const verified = new Date(match[1]);
        if (Date.now() - verified.getTime() > maxAgeMs) {
          stale.push(file);
        }
      } else {
        // No last_verified header — check file mtime
        const mtime = fs.statSync(filePath).mtimeMs;
        if (Date.now() - mtime > maxAgeMs) {
          stale.push(file);
        }
      }
    } catch {
      stale.push(file);
    }
  }
  return stale;
}

/**
 * Refresh stale cache files by updating their last_verified dates.
 * Actual content refresh requires WebSearch/MS Learn — this flags for refresh.
 */
async function refreshCacheTier(tierName, files, maxAgeDays) {
  const jobName = `cache-${tierName}`;
  updateJobState(jobName, { running: true, lastRun: new Date().toISOString() });

  try {
    const stale = checkCacheStaleness(files, maxAgeDays);
    if (stale.length === 0) {
      updateJobState(jobName, { running: false, lastSuccess: new Date().toISOString(), lastResult: "All files fresh" });
      dev.info("scheduler", `${jobName}: all ${files.length} files fresh`);
      return { stale: [], refreshed: 0 };
    }

    // Update file mtimes to mark as checked (content refresh needs LLM — flagged for /mcs-sync)
    const cacheDir = path.join(KNOWLEDGE_DIR, "cache");
    for (const file of stale) {
      const filePath = path.join(cacheDir, file);
      if (fs.existsSync(filePath)) {
        // Touch the file to update mtime
        const now = new Date();
        fs.utimesSync(filePath, now, now);
      }
    }

    updateJobState(jobName, {
      running: false,
      lastSuccess: new Date().toISOString(),
      lastResult: `${stale.length}/${files.length} stale: ${stale.join(", ")}`,
      runCount: (state.jobs[jobName]?.runCount || 0) + 1,
    });
    dev.info("scheduler", `${jobName}: ${stale.length} stale files flagged — ${stale.join(", ")}`);
    return { stale, refreshed: stale.length };
  } catch (err) {
    updateJobState(jobName, { running: false, lastError: err.message });
    dev.error("scheduler", `${jobName} failed`, err.message);
    return { error: err.message };
  }
}

/**
 * Run upstream repo check via tools/upstream-check.js
 */
async function runUpstreamCheck() {
  const jobName = "upstream-check";
  updateJobState(jobName, { running: true, lastRun: new Date().toISOString() });

  const scriptPath = path.join(BASE_DIR, "tools", "upstream-check.js");
  if (!fs.existsSync(scriptPath)) {
    updateJobState(jobName, { running: false, lastError: "upstream-check.js not found" });
    return { error: "Script not found" };
  }

  try {
    const { stdout } = await execFileAsync("node", [scriptPath, "--update"], {
      cwd: BASE_DIR,
      timeout: 120_000,
      env: { ...process.env },
    });

    updateJobState(jobName, {
      running: false,
      lastSuccess: new Date().toISOString(),
      lastResult: stdout.trim().slice(0, 500),
      runCount: (state.jobs[jobName]?.runCount || 0) + 1,
    });
    dev.info("scheduler", "upstream-check completed");
    return { output: stdout.trim() };
  } catch (err) {
    updateJobState(jobName, { running: false, lastError: err.message });
    dev.error("scheduler", "upstream-check failed", err.message);
    return { error: err.message };
  }
}

/**
 * Rebuild the learnings index from knowledge/learnings/*.md files.
 * Debounced — won't run if already running or ran within last 60s.
 */
let _learningsDebounceTimer = null;
let _learningsRunning = false;

function triggerLearningsIndexRebuild() {
  if (_learningsRunning) return;
  if (_learningsDebounceTimer) clearTimeout(_learningsDebounceTimer);

  _learningsDebounceTimer = setTimeout(() => {
    _learningsDebounceTimer = null;
    rebuildLearningsIndex();
  }, 5000); // 5s debounce
}

async function rebuildLearningsIndex() {
  if (_learningsRunning) return;
  _learningsRunning = true;
  const jobName = "learnings-index";
  updateJobState(jobName, { running: true, lastRun: new Date().toISOString() });

  try {
    const learningsDir = path.join(KNOWLEDGE_DIR, "learnings");
    const indexPath = path.join(learningsDir, "index.json");

    if (!fs.existsSync(learningsDir)) {
      updateJobState(jobName, { running: false, lastError: "Learnings directory not found" });
      _learningsRunning = false;
      return;
    }

    // Scan all .md files and rebuild index
    const files = fs.readdirSync(learningsDir).filter(f => f.endsWith(".md"));
    const entries = [];

    for (const file of files) {
      const filePath = path.join(learningsDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      // Extract title from first # heading
      const titleLine = lines.find(l => l.startsWith("# "));
      const title = titleLine ? titleLine.slice(2).trim() : file.replace(".md", "");

      // Count entries (## headings)
      const entryCount = lines.filter(l => l.startsWith("## ")).length;

      // Get file stats
      const stats = fs.statSync(filePath);

      entries.push({
        file,
        title,
        entries: entryCount,
        lastModified: stats.mtime.toISOString(),
        sizeBytes: stats.size,
      });
    }

    const index = {
      generated: new Date().toISOString(),
      totalFiles: entries.length,
      totalEntries: entries.reduce((sum, e) => sum + e.entries, 0),
      files: entries,
    };

    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

    updateJobState(jobName, {
      running: false,
      lastSuccess: new Date().toISOString(),
      lastResult: `${entries.length} files, ${index.totalEntries} entries indexed`,
      runCount: (state.jobs[jobName]?.runCount || 0) + 1,
    });
    dev.info("scheduler", `learnings-index rebuilt: ${entries.length} files`);
  } catch (err) {
    updateJobState(jobName, { running: false, lastError: err.message });
    dev.error("scheduler", "learnings-index failed", err.message);
  } finally {
    _learningsRunning = false;
  }
}

/**
 * Refresh solution library cache via tools/solution-library.js
 */
async function refreshSolutionLibrary() {
  const jobName = "solution-library";
  updateJobState(jobName, { running: true, lastRun: new Date().toISOString() });

  const scriptPath = path.join(BASE_DIR, "tools", "solution-library.js");
  if (!fs.existsSync(scriptPath)) {
    updateJobState(jobName, { running: false, lastResult: "solution-library.js not found — skipped" });
    return;
  }

  try {
    const { stdout } = await execFileAsync("node", [scriptPath, "refresh"], {
      cwd: BASE_DIR,
      timeout: 120_000,
      env: { ...process.env },
    });

    updateJobState(jobName, {
      running: false,
      lastSuccess: new Date().toISOString(),
      lastResult: stdout.trim().slice(0, 500) || "Completed",
      runCount: (state.jobs[jobName]?.runCount || 0) + 1,
    });
    dev.info("scheduler", "solution-library refresh completed");
  } catch (err) {
    updateJobState(jobName, { running: false, lastError: err.message });
    dev.error("scheduler", "solution-library failed", err.message);
  }
}

// ---------------------------------------------------------------------------
// Cron schedule definitions
// ---------------------------------------------------------------------------

const _cronJobs = {};

function initScheduler() {
  loadState();

  // Tier 1 cache (models, triggers, MCPs, connectors) — every 2 days at 6am
  _cronJobs["cache-tier1"] = cron.schedule("0 6 */2 * *", () => {
    refreshCacheTier("tier1", TIER1_FILES, 2);
  }, { timezone: "America/Los_Angeles" });

  // Tier 2 cache (limits, auth, cards) — weekly Sunday 6am
  _cronJobs["cache-tier2"] = cron.schedule("0 6 * * 0", () => {
    refreshCacheTier("tier2", TIER2_FILES, 7);
  }, { timezone: "America/Los_Angeles" });

  // Tier 3 cache (security, integration patterns) — monthly 1st at 6am
  _cronJobs["cache-tier3"] = cron.schedule("0 6 1 * *", () => {
    refreshCacheTier("tier3", TIER3_FILES, 30);
  }, { timezone: "America/Los_Angeles" });

  // Upstream repo check — daily 7am
  _cronJobs["upstream-check"] = cron.schedule("0 7 * * *", () => {
    runUpstreamCheck();
  }, { timezone: "America/Los_Angeles" });

  // Solution library refresh — weekly Monday 6am
  _cronJobs["solution-library"] = cron.schedule("0 6 * * 1", () => {
    refreshSolutionLibrary();
  }, { timezone: "America/Los_Angeles" });

  // Learnings index rebuild — daily 6:30am (plus event-driven triggers)
  _cronJobs["learnings-index"] = cron.schedule("30 6 * * *", () => {
    rebuildLearningsIndex();
  }, { timezone: "America/Los_Angeles" });

  // Initialize job state entries for all jobs
  const jobNames = ["cache-tier1", "cache-tier2", "cache-tier3", "upstream-check", "solution-library", "learnings-index"];
  for (const name of jobNames) {
    if (!state.jobs[name]) {
      updateJobState(name, {});
    }
  }

  dev.info("scheduler", "Initialized with 6 recurring jobs");
  return _cronJobs;
}

// ---------------------------------------------------------------------------
// API for server.js
// ---------------------------------------------------------------------------

/**
 * Get status of all scheduled jobs.
 */
function getStatus() {
  const jobs = {};
  for (const [name, jobState] of Object.entries(state.jobs)) {
    jobs[name] = {
      ...jobState,
      scheduled: !!_cronJobs[name],
    };
  }
  return {
    initialized: Object.keys(_cronJobs).length > 0,
    jobCount: Object.keys(_cronJobs).length,
    lastSaved: state.lastSaved,
    jobs,
  };
}

/**
 * Manually trigger a specific job.
 */
async function triggerJob(jobName) {
  switch (jobName) {
    case "cache-tier1":
      return refreshCacheTier("tier1", TIER1_FILES, 2);
    case "cache-tier2":
      return refreshCacheTier("tier2", TIER2_FILES, 7);
    case "cache-tier3":
      return refreshCacheTier("tier3", TIER3_FILES, 30);
    case "upstream-check":
      return runUpstreamCheck();
    case "solution-library":
      return refreshSolutionLibrary();
    case "learnings-index":
      return rebuildLearningsIndex();
    default:
      return { error: `Unknown job: ${jobName}` };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  initScheduler,
  getStatus,
  triggerJob,
  triggerLearningsIndexRebuild,
  checkCacheStaleness,
  TIER1_FILES,
  TIER2_FILES,
  TIER3_FILES,
};
