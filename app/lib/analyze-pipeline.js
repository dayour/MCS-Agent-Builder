/**
 * Analyze Pipeline — CLI-Backed Full Research Pipeline
 *
 * Orchestrates 7 sequential steps, each spawning Claude Code CLI with full
 * tool access (MCP servers, web search, file I/O, skills). Used for the
 * "Analyze" action in the web app when users upload documents and want
 * the full research + spec generation pipeline.
 *
 * Architecture:
 *   User uploads docs → clicks Analyze → POST /api/skill/start { skillType: "analyze" }
 *   → This pipeline spawns sequential CLI processes, each with a focused prompt
 *   → Progress streamed via SSE to the frontend (ChainOfThought UI)
 *
 * Each step gets the full power of Claude Code: all tools, MCP servers,
 * web search, file system access, etc. Steps run sequentially because
 * each builds on the previous step's output (written to agentspec.json).
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const dev = require("./dev-logger");

// ---------------------------------------------------------------------------
// CLI Configuration
// ---------------------------------------------------------------------------

/** Per-step timeout (5 min default). */
const CLI_TIMEOUT = 300_000;
/** Max agentic turns per step. */
const CLI_MAX_TURNS = 30;
/** USD budget cap per step. */
const CLI_MAX_BUDGET = 3.00;
/**
 * Cap on simultaneously-running CLI subprocess jobs (this module + the
 * hybrid orchestrator together). Each job spawns a Claude Code session +
 * child processes for 20-30 min, so unbounded concurrency exhausts
 * memory and Claude Code sessions fast. Override via env in dev:
 * MCS_ANALYZE_MAX_CONCURRENCY=4 npm start.
 *
 * Concurrency is owned by `cli-session-budget.js` so analyze + hybrid
 * jobs count against the SAME ceiling. Earlier versions had separate
 * counters and the effective ceiling was 2× the intended cap.
 */
const cliBudget = require('./cli-session-budget');

/**
 * Process-tree kill. On POSIX, spawn with `detached: true` makes the
 * child its own process group leader; we then signal -pid to kill the
 * whole group (claude -p + every tool subprocess + every MCP server it
 * launched). On Windows we invoke taskkill /T /F because the spawn uses
 * `shell: true` and the immediate child is cmd.exe, not claude.
 */
function killProcessTree(child, signal = 'SIGTERM') {
  if (!child || typeof child.pid !== 'number') return;
  if (process.platform === 'win32') {
    try {
      const { execSync } = require('child_process');
      // /T = tree, /F = force; window suppressed via stdio:'ignore'.
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore', timeout: 5000 });
    } catch { /* already exited or missing — that's fine */ }
    return;
  }
  // POSIX: kill the process group. Negative pid = group.
  try { process.kill(-child.pid, signal); }
  catch (err) {
    // ESRCH = group already gone. Anything else: fall back to per-pid.
    try { child.kill(signal); } catch { /* */ }
  }
}

// ---------------------------------------------------------------------------
// Pipeline Steps Definition
// ---------------------------------------------------------------------------

const ANALYZE_STEPS = [
  { id: "process",   label: "Processing documents" },
  { id: "classify",  label: "Classifying content" },
  { id: "research",  label: "Researching MCS components" },
  { id: "score",     label: "Scoring architecture" },
  { id: "generate",  label: "Generating agent spec" },
  { id: "evals",     label: "Creating eval sets" },
  { id: "finalize",  label: "Finalizing" },
];

// ---------------------------------------------------------------------------
// Job Management (same pattern as research-pipeline.js)
// ---------------------------------------------------------------------------

const _jobs = new Map();

function createJob(projectId, agentId) {
  const id = `analyze-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const job = {
    id,
    skillType: "analyze",
    command: `CLI analyze ${projectId}${agentId ? "/" + agentId : ""}`,
    projectId,
    agentId: agentId || "",
    status: "running",
    steps: ANALYZE_STEPS.map((s) => ({ ...s, status: "pending", detail: null })),
    errors: [],
    rawLog: "",
    listeners: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
    _childProcess: null, // track current CLI process for cancellation
  };
  _jobs.set(id, job);
  return job;
}

function notifyListeners(job, event) {
  const dead = [];
  for (let i = 0; i < job.listeners.length; i++) {
    try { job.listeners[i](event); } catch { dead.push(i); }
  }
  for (let i = dead.length - 1; i >= 0; i--) job.listeners.splice(dead[i], 1);
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

function completeJob(job, success, summary) {
  if (job.status === "completed" || job.status === "failed") return;
  job.status = success ? "completed" : "failed";
  job.completedAt = new Date().toISOString();
  job._childProcess = null;
  for (const step of job.steps) {
    if (step.status === "running") step.status = success ? "completed" : "failed";
    else if (step.status === "pending") step.status = success ? "skipped" : "pending";
  }
  notifyListeners(job, {
    type: "done",
    status: job.status,
    summary: summary || null,
    errors: job.errors,
    steps: job.steps,
  });
  log(job, `Job ${job.id} ${job.status}: ${summary || "(no summary)"}`);
}

function log(job, msg) {
  // Append to job.rawLog (consumed by SSE listeners + getJobLog) and emit a
  // structured dev-logger event so the test loop can pick it up by category.
  job.rawLog += `[analyze] ${msg}\n`;
  dev.info("analyze", msg);
}

// ---------------------------------------------------------------------------
// CLI Spawn Helper
// ---------------------------------------------------------------------------

/**
 * Spawn Claude Code CLI with a prompt. Returns the text result.
 * Reuses the proven pattern from research-pipeline.js callClaudeCli().
 */
function callClaudeCli(prompt, options = {}) {
  const cwd = options.cwd || path.resolve(__dirname, "../..");
  const timeout = options.timeout || CLI_TIMEOUT;
  const maxTurns = options.maxTurns || CLI_MAX_TURNS;
  const maxBudget = options.maxBudget || CLI_MAX_BUDGET;

  const args = [
    "-p", prompt,
    "--output-format", "json",
    "--no-session-persistence",
    "--dangerously-skip-permissions",
    "--max-turns", String(maxTurns),
    "--max-budget-usd", String(maxBudget),
    "--model", "opus",
  ];

  if (options.appendSystemPrompt) {
    args.push("--append-system-prompt", options.appendSystemPrompt);
  }

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let killed = false;

    const isWin = process.platform === "win32";
    const child = spawn("claude", args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
      shell: isWin,
      windowsHide: true,
      // On POSIX, `detached: true` makes the child its own process-group
      // leader so we can kill the entire tree (claude + tools + MCP
      // servers) via `process.kill(-pid)`. On Windows we use taskkill /T
      // to walk the tree, so detached has no effect there.
      detached: !isWin,
    });

    // Expose child for cancellation
    if (options.onChild) options.onChild(child);

    child.stdin.end();
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      killed = true;
      // SIGTERM first to the whole process group; escalate to SIGKILL
      // after 5s if claude or one of its MCP subprocesses ignores the
      // first signal. Without the tree-kill, MCP servers continue
      // mutating Dataverse / PAC after the parent has been signaled.
      killProcessTree(child, "SIGTERM");
      setTimeout(() => { killProcessTree(child, "SIGKILL"); }, 5000);
    }, timeout);

    child.on("close", (code) => {
      clearTimeout(timer);

      if (killed) {
        return reject(new Error(`Claude CLI timed out after ${Math.round(timeout / 1000)}s`));
      }

      let envelope;
      try {
        envelope = JSON.parse(stdout);
      } catch {
        const jsonMatch = stdout.match(/\{[\s\S]*"type"\s*:\s*"result"[\s\S]*\}/);
        if (jsonMatch) {
          try { envelope = JSON.parse(jsonMatch[0]); } catch { /* */ }
        }
        if (!envelope) {
          const errMsg = stderr ? stderr.substring(0, 500) : `exit code ${code}, no parseable JSON`;
          return reject(new Error(`CLI failed: ${errMsg}`));
        }
      }

      if (envelope.is_error) {
        return reject(new Error(`CLI error: ${envelope.result || "unknown"}`));
      }

      resolve({
        content: envelope.result || "",
        cost: envelope.cost_usd || 0,
        turns: envelope.num_turns || 0,
        sessionId: envelope.session_id || null,
      });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`CLI spawn error: ${err.message}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Step Prompts — Each step gets a focused prompt with full CLI tool access
// ---------------------------------------------------------------------------

function buildStepPrompts(projectDir, agentDir) {
  const docsDir = path.join(projectDir, "docs");
  const specPath = path.join(agentDir, "agentspec.json");

  return {
    process: `You are analyzing documents for an MCS agent project.

Read ALL files in "${docsDir.replace(/\\/g, "/")}/" using the Read tool. For each document:
1. Extract the key content (requirements, workflows, user stories, system descriptions)
2. Identify what type of document it is (SDR, transcript, requirements doc, process doc, etc.)
3. Note any explicit mentions of: systems to integrate with, user roles, data sources, workflows

Write a JSON summary to "${agentDir.replace(/\\/g, "/")}/doc-analysis.json" with this structure:
{
  "documents": [
    { "filename": "...", "type": "...", "summary": "...", "systems": [], "roles": [], "workflows": [] }
  ],
  "totalDocuments": N,
  "keyThemes": ["..."]
}

Be thorough — read every file completely. This analysis drives the entire agent design.`,

    classify: `You are classifying analyzed documents into agent capabilities.

Read "${agentDir.replace(/\\/g, "/")}/doc-analysis.json" for the document analysis.
Read "${specPath.replace(/\\/g, "/")}" if it exists for current agent state.

Based on the documents:
1. Determine if this should be a single agent or multi-agent architecture
2. For each agent, identify which documents are most relevant
3. Tag each document with the capabilities it supports (e.g., "customer lookup", "ticket creation")
4. Identify gaps — capabilities mentioned but not well-documented

Update "${specPath.replace(/\\/g, "/")}" with:
- business.name, business.industry, business.description (from docs)
- capabilities[] array with name, description, source documents
- boundaries[] from any constraints/limitations found in docs

If agentspec.json doesn't exist, create it from the template at templates/agentspec.json.`,

    research: `You are an MCS component researcher with access to the full knowledge base.

Read "${specPath.replace(/\\/g, "/")}" for the current agent spec.
Read the MCS knowledge cache files in "knowledge/cache/" — especially connectors.md, mcp-servers.md, knowledge-sources.md, triggers.md, channels.md, and models.md.

For each capability in the spec:
1. Find the best MCS components (connectors, MCP servers, knowledge sources, triggers)
2. Check if a first-party agent already handles this (read knowledge/cache/first-party-agents.md)
3. Note any gaps where custom development or Power Automate flows are needed
4. Reference the component selection framework in knowledge/frameworks/component-selection.md

Update "${specPath.replace(/\\/g, "/")}" integrations[] with researched components. Each integration should have:
- system, type (connector|mcp|knowledge|trigger|channel), priority, status, details

Also update decisions[] with any architectural choices and their rationale.`,

    score: `You are scoring the agent architecture.

Read "${specPath.replace(/\\/g, "/")}" for the current spec.
Read "knowledge/frameworks/architecture-scoring.md" for the scoring framework.
Read "knowledge/frameworks/solution-type-scoring.md" for solution type assessment.

Score the architecture:
1. Run the 6-factor multi-agent scoring (3+ = multi-agent justified)
2. Run the solution type scoring (is this better as an agent, a flow, or a declarative agent?)
3. Assess the AI model needs (which model tier fits the complexity?)

Update "${specPath.replace(/\\/g, "/")}" with:
- architectureScore (the 6-factor assessment)
- solutionType recommendation and rationale
- modelConfig with recommended model and reasoning effort`,

    generate: `You are generating the full agent specification.

Read "${specPath.replace(/\\/g, "/")}" for the current spec with all research.
Read "${agentDir.replace(/\\/g, "/")}/doc-analysis.json" for document context.

Generate complete agent instructions:
1. Write clear, capability-first instructions (2-3K chars, no verbose examples)
2. Define boundaries — what the agent should refuse or redirect
3. Set up the knowledge source configuration
4. Define the trigger and channel configuration
5. Add suggested conversation starters

Update "${specPath.replace(/\\/g, "/")}" with:
- instructions (the full agent instructions text)
- boundaries[] with rule, action (refuse/redirect/escalate), reason
- knowledgeSources[] configuration
- triggers[] and channels[] configuration
- conversationStarters[]

Follow the instruction best practices: capability-first structure, correct metrics, minimal boundaries.`,

    evals: `You are generating evaluation test sets for the agent.

Read "${specPath.replace(/\\/g, "/")}" for the complete spec.

Generate eval test cases across 3 buckets:
1. **Boundaries** (safety >= 95%): Out-of-scope requests, prompt injection attempts, PII handling
2. **Quality** (core >= 90%): Happy-path questions for each capability, multi-turn conversations
3. **Edge cases** (>= 70%): Ambiguous queries, typos, multi-language, context switching

For each test, include:
- question (the user's input)
- expected (the expected response pattern)
- bucket (boundaries|quality|edge-cases)
- capability (which capability it tests)

Write the eval sets into "${specPath.replace(/\\/g, "/")}" under evalSets[].tests[].
Each test must have: question, expected, methods: ["text-similarity"], lastResult: null.

Aim for 15-25 total tests distributed across buckets.`,

    finalize: `You are finalizing the agent specification.

Read "${specPath.replace(/\\/g, "/")}" for the complete spec.

Final quality pass:
1. Verify all capabilities have at least one integration mapped
2. Verify instructions reference all configured tools/knowledge/triggers
3. Check for orphaned components (referenced but not configured)
4. Ensure evalSets cover all capabilities
5. Set status.phase to "researched" and status.readiness to a percentage
6. Add a recommendations[] array with next steps

Update "${specPath.replace(/\\/g, "/")}" with the finalized state.

Write a brief summary (3-5 sentences) to stdout describing what was built and key recommendations.`,
  };
}

// ---------------------------------------------------------------------------
// Pipeline Runner
// ---------------------------------------------------------------------------

async function runPipeline(job, projectDir, agentId) {
  // Resolve agent directory
  const agentDir = agentId
    ? path.join(projectDir, "agents", agentId)
    : resolveDefaultAgentDir(projectDir);

  if (!fs.existsSync(agentDir)) {
    fs.mkdirSync(agentDir, { recursive: true });
  }

  const prompts = buildStepPrompts(projectDir, agentDir);
  const stepIds = ANALYZE_STEPS.map((s) => s.id);

  log(job, `Starting analyze pipeline for ${job.projectId} → ${agentDir}`);

  for (const stepId of stepIds) {
    if (job.status !== "running") break; // cancelled

    const prompt = prompts[stepId];
    if (!prompt) {
      updateStep(job, stepId, "completed", "Skipped — no prompt defined");
      continue;
    }

    updateStep(job, stepId, "running", null);
    log(job, `Step ${stepId}: starting CLI...`);
    const stepStart = Date.now();

    try {
      const result = await callClaudeCli(prompt, {
        cwd: path.resolve(__dirname, "../.."),
        onChild: (child) => { job._childProcess = child; },
      });

      const elapsed = Math.round((Date.now() - stepStart) / 1000);
      const detail = `Done in ${elapsed}s (${result.turns} turns, $${result.cost.toFixed(2)})`;
      updateStep(job, stepId, "completed", detail);
      log(job, `Step ${stepId}: ${detail}`);

      // Extract summary from finalize step
      if (stepId === "finalize" && result.content) {
        job.summary = result.content.substring(0, 500);
      }
    } catch (err) {
      const elapsed = Math.round((Date.now() - stepStart) / 1000);
      const detail = `Failed after ${elapsed}s: ${err.message}`;
      updateStep(job, stepId, "failed", detail);
      job.errors.push({ step: stepId, error: err.message });
      log(job, `Step ${stepId}: ${detail}`);

      // Continue to next step on non-fatal errors (spec may still be usable)
      // Only abort on CLI spawn/timeout errors
      if (err.message.includes("spawn error") || err.message.includes("timed out")) {
        completeJob(job, false, `Aborted at ${stepId}: ${err.message}`);
        return;
      }
    }
  }

  const failedSteps = job.steps.filter((s) => s.status === "failed");
  if (failedSteps.length > 0) {
    completeJob(job, true, `Completed with ${failedSteps.length} failed step(s): ${failedSteps.map((s) => s.id).join(", ")}`);
  } else {
    completeJob(job, true, job.summary || "Analysis complete");
  }
}

/**
 * Find the default agent directory. If agents/ has exactly one subdirectory, use it.
 * Otherwise create a default agent directory.
 */
function resolveDefaultAgentDir(projectDir) {
  const agentsDir = path.join(projectDir, "agents");
  if (fs.existsSync(agentsDir)) {
    const dirs = fs.readdirSync(agentsDir).filter((f) => {
      try { return fs.statSync(path.join(agentsDir, f)).isDirectory(); } catch { return false; }
    });
    if (dirs.length === 1) return path.join(agentsDir, dirs[0]);
  }
  // Default: create agents/default/
  const defaultDir = path.join(agentsDir, "default");
  if (!fs.existsSync(defaultDir)) fs.mkdirSync(defaultDir, { recursive: true });
  return defaultDir;
}

// ---------------------------------------------------------------------------
// Entry Points
// ---------------------------------------------------------------------------

/**
 * Pure lookup: find a running job matching (projectId, agentId) in any
 * iterable of job records. Exposed separately for unit tests.
 */
function findRunningJobIn(jobsIterable, projectId, agentId) {
  const targetAgent = agentId || "";
  for (const job of jobsIterable) {
    if (
      job.status === "running" &&
      job.projectId === projectId &&
      job.agentId === targetAgent
    ) {
      return job;
    }
  }
  return null;
}

/**
 * Find an in-flight analyze job that targets the same (projectId, agentId).
 * Used for idempotency: double-click, multi-tab, and refresh races should all
 * adopt the existing job instead of spawning duplicates.
 */
function findRunningJob(projectId, agentId) {
  return findRunningJobIn(_jobs.values(), projectId, agentId);
}

function startAnalyzePipeline(projectId, agentId, baseDir) {
  const projectDir = path.join(baseDir, "Build-Guides", projectId);
  if (!fs.existsSync(projectDir)) {
    throw new Error(`Project directory not found: ${projectDir}`);
  }

  const docsDir = path.join(projectDir, "docs");
  if (!fs.existsSync(docsDir) || fs.readdirSync(docsDir).filter((f) => !f.startsWith(".")).length === 0) {
    throw new Error("No documents found in docs/ — upload files first");
  }

  // Single-flight with coalescing: if an analyze is already running for this
  // project, don't spawn a duplicate. Instead stamp the running job with the
  // current docs-dir mtime as a "dirty" watermark. On completion, the pipeline
  // checks the watermark and auto-launches ONE follow-up analyze if the docs
  // directory has changed since this run started.
  const existing = findRunningJob(projectId, agentId);
  if (existing) {
    existing._rerunWatermark = docsDirWatermark(docsDir);
    log(existing, `Re-run queued (watermark=${existing._rerunWatermark}) — analyze already running`);
    return existing;
  }

  // Cross-module concurrency cap. The cli-session-budget module sums
  // analyze + hybrid running counts against ONE ceiling (the env var
  // MCS_ANALYZE_MAX_CONCURRENCY, default 2). Earlier per-module counters
  // let users hit 2× the intended cap; this is the fix.
  if (cliBudget.atCapacity()) {
    const err = cliBudget.capacityError();
    // Preserve the legacy error code path for /api/skill/start so its
    // existing 429 branch still matches.
    err.code = 'analyze_capacity_exceeded';
    throw err;
  }

  const job = createJob(projectId, agentId || "");
  job._startWatermark = docsDirWatermark(docsDir);
  log(job, `Starting job ${job.id} for ${projectId} (watermark=${job._startWatermark})`);

  // Fire and forget — pipeline runs async, progress via SSE
  runPipeline(job, projectDir, agentId).then(() => {
    // After the current run finishes, check if docs changed mid-flight; if so,
    // auto-launch a second pass over the expanded corpus. Watermark compares
    // content-hash-ish mtimes; any change (added/edited/removed doc) triggers.
    const finalWatermark = docsDirWatermark(docsDir);
    if (job._rerunWatermark && finalWatermark !== job._startWatermark) {
      log(job, `Docs changed (start=${job._startWatermark} final=${finalWatermark}); auto-launching rerun`);
      try { startAnalyzePipeline(projectId, agentId, baseDir); }
      catch (err) { dev.error("analyze", `rerun failed: ${err.message}`); }
    }
  }).catch((err) => {
    dev.error("analyze", `Fatal: ${err.message}`);
    completeJob(job, false, err.message);
  });

  return job;
}

// Cheap dirty-watermark for the docs folder: a hash of (filename,size,mtime)
// over all non-dotfiles. Changes on add/edit/remove. Not cryptographic —
// just good enough to detect mid-run changes.
function docsDirWatermark(docsDir) {
  if (!fs.existsSync(docsDir)) return "empty";
  const parts = [];
  for (const name of fs.readdirSync(docsDir)) {
    if (name.startsWith(".")) continue;
    try {
      const s = fs.statSync(path.join(docsDir, name));
      parts.push(`${name}:${s.size}:${Math.floor(s.mtimeMs)}`);
    } catch { /* skip unreadable */ }
  }
  parts.sort();
  return crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
}

function cancelJob(jobId) {
  const job = _jobs.get(jobId);
  if (!job || job.status !== "running") return false;
  if (job._childProcess) {
    // Process-tree kill so MCP servers and tool subprocesses spawned by
    // claude don't keep mutating Dataverse / PAC state after cancel.
    killProcessTree(job._childProcess, "SIGTERM");
    setTimeout(() => { killProcessTree(job._childProcess, "SIGKILL"); }, 5000);
  }
  completeJob(job, false, "Cancelled by user");
  return true;
}

/**
 * Count of currently-running analyze jobs. Public so /api/skill/start
 * (and tests) can probe before kicking a new one and surface a precise
 * 429 instead of the user discovering the cap at startAnalyzePipeline().
 */
function runningJobCount() {
  let n = 0;
  for (const j of _jobs.values()) if (j.status === "running") n++;
  return n;
}

// Register this module's running count with the shared budget so hybrid
// pipelines see analyze jobs and vice versa.
cliBudget.registerSource("analyze", runningJobCount);

/** Public concurrency cap (read-only). Reads from the shared budget. */
function getMaxConcurrency() {
  return cliBudget.getMaxConcurrency();
}

function getJob(jobId) {
  return _jobs.get(jobId) || null;
}

function getJobLog(jobId) {
  const job = _jobs.get(jobId);
  return job ? job.rawLog : null;
}

module.exports = {
  startAnalyzePipeline,
  cancelJob,
  getJob,
  getJobLog,
  findRunningJob,
  findRunningJobIn,    // exported for unit testing
  runningJobCount,     // exported for /api/skill/start preflight
  getMaxConcurrency,   // exported for /api/skill/start preflight + tests
};
