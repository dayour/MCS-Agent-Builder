/**
 * build-runner.js — Headless PTY build orchestrator with progress parsing + SSE.
 *
 * Spawns Claude Code in a headless PTY, sends `/mcs-build {projectId} {agentId}`,
 * and parses terminal output for structured progress markers:
 *   ##PROGRESS## {"step":"auth","label":"Verifying credentials","status":"running"}
 *   ##AUTH_REQUIRED## {"system":"SharePoint","instructions":"..."}
 *   ##BUILD_COMPLETE## {"success":true,"summary":"..."}
 *
 * Follows the enrichment.js job pattern (registry, listeners, SSE events)
 * and the terminal.js PTY pattern (resolveClaude, ready detection, stripAnsi).
 */

const pty = require("@homebridge/node-pty-prebuilt-multiarch");
const path = require("path");
const fs = require("fs");
const { resolveClaude } = require("./terminal");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLAUDE = resolveClaude();

/** Max build time before we kill the PTY (30 min). */
const BUILD_TIMEOUT_MS = 30 * 60 * 1000;

/** How long to wait for Claude Code to show the ❯ prompt. */
const READY_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// ANSI stripping (same as terminal.js)
// ---------------------------------------------------------------------------

function stripAnsi(str) {
  return str.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~]/g,
    ""
  );
}

// ---------------------------------------------------------------------------
// Job State Management (follows enrichment.js pattern)
// ---------------------------------------------------------------------------

/** In-memory job registry. */
const _jobs = new Map();

/**
 * @typedef {Object} BuildJob
 * @property {string} id
 * @property {string} projectId
 * @property {string} agentId
 * @property {string} status - "starting" | "running" | "paused_auth" | "completed" | "failed"
 * @property {Object[]} steps - Ordered step list [{id, label, status, detail}]
 * @property {string[]} errors
 * @property {string} rawLog - Full terminal output for debug console
 * @property {Function[]} listeners - SSE listeners
 * @property {string} startedAt
 * @property {string|null} completedAt
 * @property {Object|null} authPrompt - Auth requirement details when paused
 * @property {Object|null} ptyProc - Live PTY handle (null after exit)
 * @property {NodeJS.Timeout|null} timeoutTimer
 */

function createJob(projectId, agentId) {
  const id = `build-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const job = {
    id,
    projectId,
    agentId,
    status: "starting",
    steps: [
      { id: "auth", label: "Verifying credentials", status: "pending", detail: null },
      { id: "context", label: "Loading build context", status: "pending", detail: null },
      { id: "create", label: "Creating agent", status: "pending", detail: null },
      { id: "instructions", label: "Configuring instructions", status: "pending", detail: null },
      { id: "knowledge", label: "Adding knowledge", status: "pending", detail: null },
      { id: "tools", label: "Configuring tools", status: "pending", detail: null },
      { id: "model", label: "Setting model", status: "pending", detail: null },
      { id: "topics", label: "Authoring topics", status: "pending", detail: null },
      { id: "publish", label: "Publishing", status: "pending", detail: null },
      { id: "validate", label: "Validating build", status: "pending", detail: null },
    ],
    errors: [],
    rawLog: "",
    listeners: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
    authPrompt: null,
    ptyProc: null,
    timeoutTimer: null,
  };
  _jobs.set(id, job);
  return job;
}

function notifyListeners(job, event) {
  const dead = [];
  for (let i = 0; i < job.listeners.length; i++) {
    try { job.listeners[i](event); } catch { dead.push(i); }
  }
  for (let i = dead.length - 1; i >= 0; i--) {
    job.listeners.splice(dead[i], 1);
  }
}

function updateStep(job, stepId, status, detail) {
  const step = job.steps.find((s) => s.id === stepId);
  if (step) {
    step.status = status;
    if (detail !== undefined) step.detail = detail;
  }
  notifyListeners(job, {
    type: "step",
    step: stepId,
    status,
    detail: detail || null,
    steps: job.steps,
  });
}

// ---------------------------------------------------------------------------
// Progress Marker Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a line for structured progress markers.
 * Returns { type, data } or null if not a marker.
 */
function parseMarker(line) {
  const clean = line.trim();

  if (clean.startsWith("##PROGRESS##")) {
    try {
      return { type: "progress", data: JSON.parse(clean.slice(12).trim()) };
    } catch { return null; }
  }

  if (clean.startsWith("##AUTH_REQUIRED##")) {
    try {
      return { type: "auth_required", data: JSON.parse(clean.slice(16).trim()) };
    } catch { return null; }
  }

  if (clean.startsWith("##BUILD_COMPLETE##")) {
    try {
      return { type: "build_complete", data: JSON.parse(clean.slice(18).trim()) };
    } catch { return null; }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Build Orchestrator
// ---------------------------------------------------------------------------

/**
 * Start a headless build.
 * Spawns Claude Code PTY, waits for ready, sends /mcs-build command,
 * parses progress markers from output.
 *
 * @param {string} projectId
 * @param {string} agentId
 * @param {string} baseDir - Repo root (cwd for the PTY)
 * @returns {BuildJob}
 */
function startBuild(projectId, agentId, baseDir) {
  // Defense-in-depth: validate inputs are safe path/command segments
  const SAFE_ID = /^[\w-]+$/;
  if (!SAFE_ID.test(projectId) || !SAFE_ID.test(agentId)) {
    throw new Error("Invalid projectId or agentId — must be alphanumeric/hyphens/underscores");
  }

  const job = createJob(projectId, agentId);

  console.log(`[build-runner] Starting job ${job.id}: /mcs-build ${projectId} ${agentId}`);

  // Validate brief exists
  const briefPath = path.join(baseDir, "Build-Guides", projectId, "agents", agentId, "brief.json");
  if (!fs.existsSync(briefPath)) {
    job.status = "failed";
    job.errors.push("brief.json not found");
    job.completedAt = new Date().toISOString();
    notifyListeners(job, { type: "done", status: "failed", errors: job.errors });
    return job;
  }

  // Spawn Claude Code PTY
  let ptyProc;
  try {
    ptyProc = pty.spawn(CLAUDE.exe, CLAUDE.args, {
      name: "xterm-256color",
      cols: 200,
      rows: 50,
      cwd: baseDir,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
      },
    });
  } catch (err) {
    job.status = "failed";
    job.errors.push(`Failed to spawn Claude Code: ${err.message}`);
    job.completedAt = new Date().toISOString();
    notifyListeners(job, { type: "done", status: "failed", errors: job.errors });
    return job;
  }

  job.ptyProc = ptyProc;
  job.status = "running";

  let ready = false;
  let readyTimer = null;
  let lineBuffer = "";

  // Build timeout
  job.timeoutTimer = setTimeout(() => {
    if (job.status === "running" || job.status === "paused_auth") {
      console.log(`[build-runner] Job ${job.id} timed out after ${BUILD_TIMEOUT_MS / 60000} min`);
      job.errors.push("Build timed out");
      completeJob(job, false, "Build timed out");
      killPty(job);
    }
  }, BUILD_TIMEOUT_MS);

  // Listen for PTY output
  ptyProc.onData((data) => {
    // Accumulate raw log
    job.rawLog += data;

    // Notify listeners with raw output for debug console
    notifyListeners(job, { type: "output", data });

    // Parse lines for markers
    const clean = stripAnsi(data);
    lineBuffer += clean;

    // Detect readiness (❯ prompt)
    if (!ready && lineBuffer.includes("\u276f")) {
      ready = true;
      if (readyTimer) { clearTimeout(readyTimer); readyTimer = null; }

      // Send the build command
      const command = `/mcs-build ${projectId} ${agentId}`;
      console.log(`[build-runner] Job ${job.id} ready — sending: ${command}`);
      ptyProc.write(command + "\r");
      notifyListeners(job, { type: "command_sent", command });
    }

    // Process complete lines for markers
    const lines = lineBuffer.split("\n");
    lineBuffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      const marker = parseMarker(line);
      if (!marker) continue;

      switch (marker.type) {
        case "progress": {
          const { step, label, status, detail } = marker.data;
          if (step) {
            // Update existing step or add dynamic one
            const existing = job.steps.find((s) => s.id === step);
            if (existing) {
              updateStep(job, step, status || "running", detail || label);
            } else {
              // Dynamic step from the skill
              job.steps.push({ id: step, label: label || step, status: status || "running", detail: detail || null });
              notifyListeners(job, { type: "step", step, status: status || "running", detail, steps: job.steps });
            }
          }
          break;
        }

        case "auth_required": {
          job.status = "paused_auth";
          job.authPrompt = marker.data;
          notifyListeners(job, { type: "auth_required", ...marker.data });
          console.log(`[build-runner] Job ${job.id} paused for auth: ${marker.data.system || "unknown"}`);
          break;
        }

        case "build_complete": {
          const { success, summary } = marker.data;
          completeJob(job, success !== false, summary);
          break;
        }
      }
    }
  });

  // PTY exit
  ptyProc.onExit(({ exitCode }) => {
    console.log(`[build-runner] Job ${job.id} PTY exited with code ${exitCode}`);
    job.ptyProc = null;

    // If job wasn't already completed by a ##BUILD_COMPLETE## marker
    if (job.status !== "completed" && job.status !== "failed") {
      if (exitCode === 0) {
        completeJob(job, true, "Build process exited normally");
      } else {
        job.errors.push(`Claude Code exited with code ${exitCode}`);
        completeJob(job, false, `Process exited with code ${exitCode}`);
      }
    }
  });

  // Ready fallback — if prompt detection misses, mark ready after timeout
  readyTimer = setTimeout(() => {
    readyTimer = null;
    if (!ready) {
      console.log(`[build-runner] Job ${job.id} ready detection timed out — sending command anyway`);
      ready = true;
      const command = `/mcs-build ${projectId} ${agentId}`;
      ptyProc.write(command + "\r");
      notifyListeners(job, { type: "command_sent", command });
    }
  }, READY_TIMEOUT_MS);

  return job;
}

/**
 * Resume a paused build after auth is completed.
 * Sends a newline to the PTY to continue.
 */
function resumeAfterAuth(jobId) {
  const job = _jobs.get(jobId);
  if (!job) return { error: "Job not found" };
  if (job.status !== "paused_auth") return { error: "Job not paused for auth" };
  if (!job.ptyProc) return { error: "PTY not running" };

  job.status = "running";
  job.authPrompt = null;

  // Send "done" + Enter to continue the build (skill waits for user confirmation)
  job.ptyProc.write("done\r");

  notifyListeners(job, { type: "auth_completed" });
  console.log(`[build-runner] Job ${job.id} resumed after auth`);

  return { resumed: true };
}

/**
 * Mark a job as completed.
 */
function completeJob(job, success, summary) {
  if (job.status === "completed" || job.status === "failed") return; // Already done

  job.status = success ? "completed" : "failed";
  job.completedAt = new Date().toISOString();

  if (job.timeoutTimer) {
    clearTimeout(job.timeoutTimer);
    job.timeoutTimer = null;
  }

  // Mark any remaining non-terminal steps
  for (const step of job.steps) {
    if (step.status === "running") {
      step.status = success ? "completed" : "failed";
    } else if (step.status === "pending") {
      step.status = success ? "skipped" : "pending";
    }
  }

  notifyListeners(job, {
    type: "done",
    status: job.status,
    summary: summary || null,
    errors: job.errors,
    steps: job.steps,
  });

  console.log(`[build-runner] Job ${job.id} ${job.status}: ${summary || "(no summary)"}`);
}

/**
 * Kill the PTY process for a job.
 */
function killPty(job) {
  if (job.ptyProc) {
    try { job.ptyProc.kill(); } catch { /* already gone */ }
    job.ptyProc = null;
  }
}

// ---------------------------------------------------------------------------
// Job Queries
// ---------------------------------------------------------------------------

function getJob(jobId) {
  return _jobs.get(jobId) || null;
}

function getAllJobs() {
  return Array.from(_jobs.values()).map((j) => ({
    id: j.id,
    projectId: j.projectId,
    agentId: j.agentId,
    status: j.status,
    startedAt: j.startedAt,
    completedAt: j.completedAt,
    errors: j.errors,
  }));
}

function getJobLog(jobId) {
  const job = _jobs.get(jobId);
  return job ? job.rawLog : null;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  startBuild,
  resumeAfterAuth,
  getJob,
  getAllJobs,
  getJobLog,
};
