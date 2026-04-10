/**
 * pipeline.js — Pipeline orchestrator for seamless analyze-to-package flow.
 *
 * Three responsibilities:
 * 1. Settling window — debounces doc uploads per project (5s quiet → emit docs-settled)
 * 2. Auto-chain manager — chains build→eval, fix→eval after skill completion
 * 3. Package workflow — exports solution + uploads to SharePoint (in-process, no PTY)
 *
 * Imported by server.js. Does NOT import server.js (acyclic dependency graph).
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const BASE_DIR = path.resolve(__dirname, "../..");
const BUILD_GUIDES = path.join(BASE_DIR, "Build-Guides");

// ---------------------------------------------------------------------------
// Settling Window — Per-project doc upload debounce
// ---------------------------------------------------------------------------

const SETTLE_DELAY_MS = 5000;

/** @type {Map<string, { timer: NodeJS.Timeout, count: number }>} */
const _settleTimers = new Map();

/** @type {Map<string, Function[]>} */
const _settleListeners = new Map();

/** @type {Map<string, Function[]>} */
const _pipelineListeners = new Map();

/**
 * Called by server.js after every upload, paste, or M365 download-done.
 * Resets the 5-second settle timer for the project.
 */
function notifyDocChange(projectId) {
  const existing = _settleTimers.get(projectId);
  if (existing) {
    clearTimeout(existing.timer);
    existing.count++;
  }

  const entry = {
    count: existing ? existing.count : 1,
    timer: setTimeout(() => {
      _settleTimers.delete(projectId);
      emitDocsSettled(projectId, entry.count);
    }, SETTLE_DELAY_MS),
  };
  _settleTimers.set(projectId, entry);
}

function emitDocsSettled(projectId, docCount) {
  const event = { type: "docs-settled", projectId, docCount };

  // Notify one-shot listeners
  const oneShots = _settleListeners.get(projectId) || [];
  _settleListeners.delete(projectId);
  for (const cb of oneShots) {
    try { cb(event); } catch { /* listener error */ }
  }

  // Notify persistent pipeline listeners
  emitPipelineEvent(projectId, event);
}

/**
 * Register a one-shot callback for the next docs-settled event.
 */
function onDocsSettled(projectId, callback) {
  if (!_settleListeners.has(projectId)) _settleListeners.set(projectId, []);
  _settleListeners.get(projectId).push(callback);
}

// ---------------------------------------------------------------------------
// Pipeline Event Bus — SSE multiplexer
// ---------------------------------------------------------------------------

function emitPipelineEvent(projectId, event) {
  const listeners = _pipelineListeners.get(projectId) || [];
  const dead = [];
  for (let i = 0; i < listeners.length; i++) {
    try { listeners[i](event); } catch { dead.push(i); }
  }
  for (let i = dead.length - 1; i >= 0; i--) {
    listeners.splice(dead[i], 1);
  }
}

/**
 * Subscribe to all pipeline events for a project.
 * Returns an unsubscribe function.
 */
function subscribePipelineEvents(projectId, callback) {
  if (!_pipelineListeners.has(projectId)) _pipelineListeners.set(projectId, []);
  _pipelineListeners.get(projectId).push(callback);

  return () => {
    const arr = _pipelineListeners.get(projectId);
    if (arr) {
      const idx = arr.indexOf(callback);
      if (idx >= 0) arr.splice(idx, 1);
    }
  };
}

// ---------------------------------------------------------------------------
// Auto-Chain Manager
// ---------------------------------------------------------------------------

/** Lazy-loaded — skill-runner is now a stub; eval/fix pipelines will replace this. */
let _skillRunner = null;
function getSkillRunner() {
  if (!_skillRunner) _skillRunner = require("./skill-runner");
  return _skillRunner;
}

/**
 * Hook called from skill-runner's completeJob().
 * Determines whether to auto-chain to the next skill.
 */
function onSkillComplete(job) {
  if (job.status !== "completed") return;

  const { skillType, projectId, agentId } = job;

  if (skillType === "build" || skillType === "fix") {
    // Auto-chain: build/fix → eval
    autoChainToEval(projectId, agentId, skillType);
  } else if (skillType === "eval") {
    // Compute pass rates and emit event (no auto-chain to package)
    emitEvalComplete(projectId, agentId);
  }
}

/**
 * Preflight check + auto-trigger eval after build or fix.
 */
function autoChainToEval(projectId, agentId, fromSkill) {
  if (!agentId) {
    emitPipelineEvent(projectId, {
      type: "auto-chain-skipped",
      from: fromSkill,
      to: "eval",
      reason: "No agentId — cannot run eval at project level",
    });
    return;
  }

  // Preflight: check brief.json exists and has build status (for build→eval)
  if (fromSkill === "build") {
    const briefPath = path.join(BUILD_GUIDES, projectId, "agents", agentId, "brief.json");
    try {
      const brief = JSON.parse(fs.readFileSync(briefPath, "utf-8"));
      const bs = brief.buildStatus || {};
      if (!bs.status && !bs.mcsAgentId) {
        emitPipelineEvent(projectId, {
          type: "auto-chain-skipped",
          from: "build",
          to: "eval",
          reason: "Build status not found in brief.json — build may not have completed fully",
        });
        return;
      }
    } catch {
      emitPipelineEvent(projectId, {
        type: "auto-chain-skipped",
        from: "build",
        to: "eval",
        reason: "Could not read brief.json for preflight check",
      });
      return;
    }
  }

  // Launch eval
  try {
    const runner = getSkillRunner();
    const command = agentId
      ? `/mcs-eval ${projectId} ${agentId}`
      : null;

    if (!command) {
      emitPipelineEvent(projectId, {
        type: "auto-chain-skipped",
        from: fromSkill,
        to: "eval",
        reason: "Could not construct eval command",
      });
      return;
    }

    const evalJob = runner.startSkill("eval", command, projectId, agentId, BASE_DIR);

    emitPipelineEvent(projectId, {
      type: "auto-chain",
      from: fromSkill,
      to: "eval",
      agentId,
      jobId: evalJob.id,
    });

    console.log(`[pipeline] Auto-chained ${fromSkill} → eval for ${projectId}/${agentId} (job ${evalJob.id})`);
  } catch (err) {
    emitPipelineEvent(projectId, {
      type: "auto-chain-skipped",
      from: fromSkill,
      to: "eval",
      reason: `Failed to start eval: ${err.message}`,
    });
    console.error(`[pipeline] Auto-chain ${fromSkill} → eval failed:`, err.message);
  }
}

/**
 * Read eval results from brief.json and emit eval-complete event.
 */
function emitEvalComplete(projectId, agentId) {
  const THRESHOLDS = {
    boundaries: 100,
    quality: 85,
    "edge-cases": 80,
    default: 85,
  };

  let passRates = {};
  let meetsThreshold = false;

  try {
    const briefPath = path.join(BUILD_GUIDES, projectId, "agents", agentId, "brief.json");
    const brief = JSON.parse(fs.readFileSync(briefPath, "utf-8"));
    const sets = brief.evalSets?.sets || [];

    if (sets.length > 0) {
      meetsThreshold = true;
      for (const set of sets) {
        const tests = set.tests || [];
        const passed = tests.filter(t => t.lastResult?.pass === true).length;
        const total = tests.length;
        const rate = total > 0 ? Math.round((passed / total) * 100) : 0;
        passRates[set.name || set.id || "unknown"] = rate;

        const threshold = THRESHOLDS[set.name] || THRESHOLDS[(set.name || "").toLowerCase()] || THRESHOLDS.default;
        if (rate < threshold) meetsThreshold = false;
      }
    }
  } catch {
    // Can't read eval results — emit with empty rates
  }

  emitPipelineEvent(projectId, {
    type: "eval-complete",
    agentId,
    passRates,
    meetsThreshold,
  });
}

// ---------------------------------------------------------------------------
// Package Workflow — In-process (no Claude Code PTY)
// ---------------------------------------------------------------------------

/** @type {Map<string, Object>} */
const _packageJobs = new Map();

function createPackageJob(projectId, agentId) {
  const id = `pkg-${Date.now()}`;
  const job = {
    id,
    projectId,
    agentId,
    status: "running",
    steps: {
      export: { status: "pending", label: "Exporting solution" },
      upload: { status: "pending", label: "Uploading to SharePoint" },
      learnings: { status: "pending", label: "Updating learnings" },
      index: { status: "pending", label: "Updating solution index" },
    },
    errors: [],
    listeners: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
    result: null,
  };
  _packageJobs.set(id, job);
  return job;
}

function notifyPkgListeners(job, event) {
  const dead = [];
  for (let i = 0; i < job.listeners.length; i++) {
    try { job.listeners[i](event); } catch { dead.push(i); }
  }
  for (let i = dead.length - 1; i >= 0; i--) {
    job.listeners.splice(dead[i], 1);
  }
}

function updatePkgStep(job, stepName, status, detail) {
  job.steps[stepName].status = status;
  if (detail) job.steps[stepName].detail = detail;
  notifyPkgListeners(job, { type: "step", step: stepName, status, detail });
}

/**
 * Run the full package workflow: export → upload → learnings → index.
 * Returns the job immediately; work runs async.
 */
function packageAgent(projectId, agentId) {
  const job = createPackageJob(projectId, agentId);

  // Run async
  runPackage(job).catch((err) => {
    job.status = "failed";
    job.completedAt = new Date().toISOString();
    job.errors.push(err.message);
    notifyPkgListeners(job, {
      type: "done",
      status: "failed",
      errors: job.errors,
      steps: job.steps,
    });
  });

  return job;
}

async function runPackage(job) {
  const { projectId, agentId } = job;
  const agentDir = path.join(BUILD_GUIDES, projectId, "agents", agentId);
  const briefPath = path.join(agentDir, "brief.json");

  if (!fs.existsSync(briefPath)) {
    throw new Error(`No brief.json found at ${briefPath}`);
  }

  const brief = JSON.parse(fs.readFileSync(briefPath, "utf-8"));
  const solutionName = brief.buildStatus?.solutionName;
  let zipPath = null;
  let sharePointUploaded = false;

  // Step 1: Export solution
  updatePkgStep(job, "export", "running");
  if (solutionName) {
    const exportDir = path.join(agentDir, "_export");
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
    zipPath = path.join(exportDir, `${solutionName}.zip`);

    try {
      execSync(
        `pac solution export --name "${solutionName}" --path "${zipPath}" --managed --overwrite`,
        { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 120_000 },
      );
      updatePkgStep(job, "export", "completed", `Exported ${solutionName}.zip`);
    } catch (err) {
      updatePkgStep(job, "export", "completed", `Export failed: ${err.message} — continuing without zip`);
      job.errors.push(`Solution export failed: ${err.message}`);
      zipPath = null;
    }
  } else {
    updatePkgStep(job, "export", "skipped", "No solution name in brief — skipping export");
  }

  // Step 2: Upload to SharePoint
  updatePkgStep(job, "upload", "running");
  try {
    const solLib = require("../../tools/solution-library");
    const { execSync: execSyncChild } = require("child_process");

    // Get Graph token for SharePoint
    const tokenResult = execSyncChild(
      'az account get-access-token --resource "https://graph.microsoft.com" --query accessToken -o tsv',
      { encoding: "utf8", timeout: 30_000 },
    ).trim();

    if (!tokenResult || tokenResult.length < 20) {
      throw new Error("Could not get Graph API token — is az CLI logged in?");
    }

    const agentName = brief.agent?.displayName || agentId;
    const displayName = `${agentName} - ${projectId}`;
    await solLib.uploadSolution(tokenResult, projectId, agentId, displayName);
    sharePointUploaded = true;
    updatePkgStep(job, "upload", "completed", `Uploaded to SharePoint: ${displayName}`);
  } catch (err) {
    const localPath = zipPath || path.join(agentDir, "_export");
    updatePkgStep(job, "upload", "completed", `SharePoint upload failed — solution saved locally at ${localPath}`);
    job.errors.push(`SharePoint upload failed: ${err.message}`);
  }

  // Step 3: Learnings rebuild
  updatePkgStep(job, "learnings", "running");
  try {
    const { triggerLearningsIndexRebuild } = require("./scheduler");
    triggerLearningsIndexRebuild();
    updatePkgStep(job, "learnings", "completed");
  } catch {
    updatePkgStep(job, "learnings", "skipped", "Scheduler not loaded");
  }

  // Step 4: Solution index update
  updatePkgStep(job, "index", "running");
  try {
    const solLib = require("../../tools/solution-library");
    if (typeof solLib.indexSolution === "function") {
      await solLib.indexSolution(projectId, agentId);
    }
    updatePkgStep(job, "index", "completed");
  } catch {
    updatePkgStep(job, "index", "skipped", "Solution indexing not available");
  }

  // Done
  const hasErrors = job.errors.length > 0;
  job.status = hasErrors ? "completed_with_errors" : "completed";
  job.completedAt = new Date().toISOString();
  job.result = { sharePointUploaded, zipPath };

  notifyPkgListeners(job, {
    type: "done",
    status: job.status,
    errors: job.errors,
    steps: job.steps,
    result: job.result,
  });

  console.log(`[pipeline] Package ${projectId}/${agentId}: ${job.status}${sharePointUploaded ? " (uploaded to SharePoint)" : " (local only)"}`);
}

function getPackageJob(jobId) {
  return _packageJobs.get(jobId) || null;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Settling window
  notifyDocChange,
  onDocsSettled,

  // Pipeline events
  subscribePipelineEvents,
  emitPipelineEvent,

  // Auto-chain
  onSkillComplete,

  // Package
  packageAgent,
  getPackageJob,
};
