/**
 * skill-runner.js — Generalized headless PTY runner for any Claude Code skill.
 *
 * Spawns Claude Code in a headless PTY, sends a skill command (e.g. /mcs-research,
 * /mcs-eval, /mcs-fix), and parses terminal output for structured progress markers:
 *   ##PROGRESS## {"step":"auth","label":"Verifying credentials","status":"running"}
 *   ##AUTH_REQUIRED## {"system":"SharePoint","instructions":"..."}
 *   ##SKILL_COMPLETE## {"success":true,"summary":"..."}
 *
 * Generalizes build-runner.js to work with any skill command.
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

/** Max skill execution time before we kill the PTY (45 min). */
const SKILL_TIMEOUT_MS = 45 * 60 * 1000;

/** How long to wait for Claude Code to show the ❯ prompt. */
const READY_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Default step definitions per skill type
// ---------------------------------------------------------------------------

const DEFAULT_STEPS = {
  research: [
    { id: "routing", label: "Smart routing", status: "pending", detail: null },
    { id: "docs", label: "Reading documents", status: "pending", detail: null },
    { id: "agents", label: "Identifying agents", status: "pending", detail: null },
    { id: "components", label: "Researching components", status: "pending", detail: null },
    { id: "architecture", label: "Designing architecture", status: "pending", detail: null },
    { id: "instructions", label: "Generating instructions", status: "pending", detail: null },
    { id: "evals", label: "Generating eval sets", status: "pending", detail: null },
    { id: "topics", label: "Designing topics", status: "pending", detail: null },
    { id: "reconcile", label: "Reconciliation", status: "pending", detail: null },
  ],
  eval: [
    { id: "load", label: "Loading eval sets", status: "pending", detail: null },
    { id: "detect", label: "Auto-detecting mode", status: "pending", detail: null },
    { id: "token", label: "Acquiring test token", status: "pending", detail: null },
    { id: "run", label: "Running tests", status: "pending", detail: null },
    { id: "score", label: "Scoring results", status: "pending", detail: null },
    { id: "write", label: "Writing results", status: "pending", detail: null },
    { id: "report", label: "Generating report", status: "pending", detail: null },
  ],
  fix: [
    { id: "read", label: "Reading eval results", status: "pending", detail: null },
    { id: "classify", label: "Classifying failures", status: "pending", detail: null },
    { id: "generate", label: "Generating fixes", status: "pending", detail: null },
    { id: "apply", label: "Applying fixes", status: "pending", detail: null },
    { id: "reeval", label: "Re-evaluating", status: "pending", detail: null },
  ],
  build: [
    { id: "auth", label: "Verifying credentials", status: "pending", detail: null },
    { id: "create", label: "Creating agent", status: "pending", detail: null },
    { id: "instructions", label: "Pushing instructions", status: "pending", detail: null },
    { id: "knowledge", label: "Configuring knowledge", status: "pending", detail: null },
    { id: "tools", label: "Adding tools", status: "pending", detail: null },
    { id: "topics", label: "Creating topics", status: "pending", detail: null },
    { id: "publish", label: "Publishing", status: "pending", detail: null },
    { id: "verify", label: "Verifying build", status: "pending", detail: null },
  ],
  // Generic fallback — no predefined steps, all dynamic
  generic: [],
};

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
// Job State Management
// ---------------------------------------------------------------------------

/** In-memory job registry. */
const _jobs = new Map();

function createJob(skillType, command, projectId, agentId) {
  const id = `skill-${skillType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const steps = (DEFAULT_STEPS[skillType] || DEFAULT_STEPS.generic).map((s) => ({ ...s }));
  const job = {
    id,
    skillType,
    command,
    projectId,
    agentId,
    status: "starting",
    steps,
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
    try { job.listeners[i](event); } catch (err) { console.warn(`[skill-runner] Listener ${i} failed for job ${job.id}:`, err.message); dead.push(i); }
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
    detail: detail ?? null,
    steps: job.steps,
  });
}

// ---------------------------------------------------------------------------
// Progress Marker Parsing
// ---------------------------------------------------------------------------

const MARKER_PROGRESS = "##PROGRESS##";
const MARKER_AUTH = "##AUTH_REQUIRED##";
const MARKER_SKILL_COMPLETE = "##SKILL_COMPLETE##";
const MARKER_BUILD_COMPLETE = "##BUILD_COMPLETE##";

function parseMarker(line) {
  const clean = line.trim();

  if (clean.startsWith(MARKER_PROGRESS)) {
    try {
      return { type: "progress", data: JSON.parse(clean.slice(MARKER_PROGRESS.length).trim()) };
    } catch { return null; }
  }

  if (clean.startsWith(MARKER_AUTH)) {
    try {
      return { type: "auth_required", data: JSON.parse(clean.slice(MARKER_AUTH.length).trim()) };
    } catch { return null; }
  }

  // Accept both ##BUILD_COMPLETE## (build-runner compat) and ##SKILL_COMPLETE##
  if (clean.startsWith(MARKER_SKILL_COMPLETE)) {
    try {
      return { type: "skill_complete", data: JSON.parse(clean.slice(MARKER_SKILL_COMPLETE.length).trim()) };
    } catch { return null; }
  }

  if (clean.startsWith(MARKER_BUILD_COMPLETE)) {
    try {
      return { type: "skill_complete", data: JSON.parse(clean.slice(MARKER_BUILD_COMPLETE.length).trim()) };
    } catch { return null; }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Skill Runner
// ---------------------------------------------------------------------------

/**
 * Start a headless skill execution.
 *
 * @param {string} skillType - "research" | "eval" | "fix" | "build" | "generic"
 * @param {string} command - Full slash command, e.g. "/mcs-research proj1 agent1"
 * @param {string} projectId
 * @param {string} agentId - Can be empty for project-level commands
 * @param {string} baseDir - Repo root (cwd for the PTY)
 * @returns {Object} job
 */
function startSkill(skillType, command, projectId, agentId, baseDir) {
  // Defense-in-depth: validate inputs
  const SAFE_ID = /^[\w-]*$/;
  if (!SAFE_ID.test(projectId) || !SAFE_ID.test(agentId || "")) {
    throw new Error("Invalid projectId or agentId — must be alphanumeric/hyphens/underscores");
  }

  // Reject control characters in command to prevent PTY injection
  if (/[\r\n\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(command)) {
    throw new Error("Command contains invalid control characters");
  }

  const job = createJob(skillType, command, projectId, agentId || "");

  console.log(`[skill-runner] Starting job ${job.id}: ${command}`);

  // Validate project exists (brief.json for agent-level, or project dir for project-level)
  if (agentId) {
    const briefPath = path.join(baseDir, "Build-Guides", projectId, "agents", agentId, "brief.json");
    if (!fs.existsSync(briefPath)) {
      job.status = "failed";
      job.errors.push("brief.json not found");
      job.completedAt = new Date().toISOString();
      notifyListeners(job, { type: "done", status: "failed", errors: job.errors });
      return job;
    }
  } else {
    const projectDir = path.join(baseDir, "Build-Guides", projectId);
    if (!fs.existsSync(projectDir)) {
      job.status = "failed";
      job.errors.push("Project directory not found");
      job.completedAt = new Date().toISOString();
      notifyListeners(job, { type: "done", status: "failed", errors: job.errors });
      return job;
    }
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

  // Skill timeout
  job.timeoutTimer = setTimeout(() => {
    if (job.status === "running" || job.status === "paused_auth") {
      console.log(`[skill-runner] Job ${job.id} timed out after ${SKILL_TIMEOUT_MS / 60000} min`);
      job.errors.push("Skill execution timed out");
      completeJob(job, false, "Execution timed out");
      killPty(job);
    }
  }, SKILL_TIMEOUT_MS);

  // Listen for PTY output
  ptyProc.onData((data) => {
    job.rawLog += data;
    notifyListeners(job, { type: "output", data });

    const clean = stripAnsi(data);
    lineBuffer += clean;

    // Detect readiness (❯ prompt)
    if (!ready && lineBuffer.includes("\u276f")) {
      ready = true;
      if (readyTimer) { clearTimeout(readyTimer); readyTimer = null; }

      console.log(`[skill-runner] Job ${job.id} ready — sending: ${command}`);
      ptyProc.write(command + "\r");
      notifyListeners(job, { type: "command_sent", command });
    }

    // Process complete lines for markers
    const lines = lineBuffer.split("\n");
    lineBuffer = lines.pop() || "";

    for (const line of lines) {
      const marker = parseMarker(line);
      if (!marker) continue;

      switch (marker.type) {
        case "progress": {
          const { step, label, status, detail } = marker.data;
          if (step) {
            const existing = job.steps.find((s) => s.id === step);
            if (existing) {
              updateStep(job, step, status || "running", detail || label);
            } else {
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
          console.log(`[skill-runner] Job ${job.id} paused for auth: ${marker.data.system || "unknown"}`);
          break;
        }

        case "skill_complete": {
          const { success, summary } = marker.data;
          completeJob(job, success !== false, summary);
          break;
        }
      }
    }
  });

  // PTY exit
  ptyProc.onExit(({ exitCode }) => {
    console.log(`[skill-runner] Job ${job.id} PTY exited with code ${exitCode}`);
    job.ptyProc = null;

    if (job.status !== "completed" && job.status !== "failed") {
      if (job.status === "paused_auth") {
        // Process exited while waiting for authentication — always a failure
        job.errors.push("Process exited while awaiting authentication");
        completeJob(job, false, "Process exited while awaiting authentication");
      } else if (exitCode === 0) {
        completeJob(job, true, "Process exited normally");
      } else {
        job.errors.push(`Claude Code exited with code ${exitCode}`);
        completeJob(job, false, `Process exited with code ${exitCode}`);
      }
    }
  });

  // Ready fallback
  readyTimer = setTimeout(() => {
    readyTimer = null;
    if (!ready) {
      console.log(`[skill-runner] Job ${job.id} ready detection timed out — sending command anyway`);
      ready = true;
      ptyProc.write(command + "\r");
      notifyListeners(job, { type: "command_sent", command });
    }
  }, READY_TIMEOUT_MS);

  return job;
}

/**
 * Resume a paused job after auth is completed.
 */
function resumeAfterAuth(jobId) {
  const job = _jobs.get(jobId);
  if (!job) return { error: "Job not found" };
  if (job.status !== "paused_auth") return { error: "Job not paused for auth" };
  if (!job.ptyProc) return { error: "PTY not running" };

  job.status = "running";
  job.authPrompt = null;
  job.ptyProc.write("done\r");

  notifyListeners(job, { type: "auth_completed" });
  console.log(`[skill-runner] Job ${job.id} resumed after auth`);

  return { resumed: true };
}

function completeJob(job, success, summary) {
  if (job.status === "completed" || job.status === "failed") return;

  job.status = success ? "completed" : "failed";
  job.completedAt = new Date().toISOString();

  if (job.timeoutTimer) {
    clearTimeout(job.timeoutTimer);
    job.timeoutTimer = null;
  }

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

  console.log(`[skill-runner] Job ${job.id} ${job.status}: ${summary || "(no summary)"}`);
}

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

function getAllJobs(skillType) {
  return Array.from(_jobs.values())
    .filter((j) => !skillType || j.skillType === skillType)
    .map((j) => ({
      id: j.id,
      skillType: j.skillType,
      command: j.command,
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
  startSkill,
  resumeAfterAuth,
  getJob,
  getAllJobs,
  getJobLog,
};
