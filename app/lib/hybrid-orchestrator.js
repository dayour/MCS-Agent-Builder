/**
 * hybrid-orchestrator.js — Reusable kernel for build/eval/fix pipelines
 * that follow the hybrid (CLI agentic → API deterministic) pattern.
 *
 * Pipelines plug in three things:
 *   1. cliPromptBuilder(projectDir, agentDir) → string
 *      Returns the focused prompt the CLI step runs against.
 *   2. validatePlan(plan) → { ok: true } | { ok: false, errors: [...] }
 *      Schema check on the JSON the CLI emitted. No external mutations
 *      run unless this passes.
 *   3. apiExecutor(plan, ctx) → Promise<{ summary, verifyResult }>
 *      Deterministic mutation function. Free to call Dataverse, LSP,
 *      Direct Line, etc. Should be idempotent so retries are safe.
 *
 * Contract: see knowledge/frameworks/hybrid-pipeline-contract.md.
 *
 * Owned by this module:
 *   - Job lifecycle (createJob, listeners, updateStep, completeJob) —
 *     same shape as analyze-pipeline.js so server.js findJob() still works.
 *   - Process-tree spawn (detached on POSIX, shell on Windows).
 *   - Process-tree kill (kill -pgid on POSIX, taskkill /T /F on Windows).
 *   - Server-wide concurrency cap (shared with analyze-pipeline via env).
 *   - Plan-envelope parse from CLI stdout.
 *
 * NOT owned by this module:
 *   - Pipeline-specific schemas. Those live next to their pipeline.
 *   - apiExecutor logic. Each pipeline implements its own.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const dev = require('./dev-logger');

// ── Config ──────────────────────────────────────────────────────────────────

// Phase B (skill-invocation) bumped these because real agentic skills need
// more headroom than a deterministic spec→plan translation. /mcs-build can
// take 30+ turns for component scoring + topic generation; eval-guide and
// triage skills are similar. Override via env for canary tuning.
const CLI_PLAN_TIMEOUT = parseInt(process.env.MCS_HYBRID_PLAN_TIMEOUT_MS || '', 10) || 1_800_000; // 30 min
const CLI_MAX_TURNS    = parseInt(process.env.MCS_HYBRID_MAX_TURNS || '', 10) || 60;
const CLI_MAX_BUDGET   = parseFloat(process.env.MCS_HYBRID_MAX_BUDGET || '') || 10.00;

// Concurrency cap is owned by cli-session-budget so analyze + hybrid
// share the SAME ceiling. Earlier versions read the env var directly in
// each module — those separate counters let users hit 2× the cap.
const cliBudget = require('./cli-session-budget');

// ── Job state (per-orchestrator, per-process) ───────────────────────────────

const _jobs = new Map();

function createJob({ kind, projectId, agentId }) {
  const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const job = {
    id,
    skillType: kind,
    projectId,
    agentId: agentId || '',
    status: 'running',
    steps: [
      { id: 'plan',    label: 'Planning (CLI agentic)',  status: 'pending', detail: null },
      { id: 'execute', label: 'Executing (API write)',   status: 'pending', detail: null },
      { id: 'verify',  label: 'Verifying',               status: 'pending', detail: null },
    ],
    errors: [],
    rawLog: '',
    listeners: [],
    plan: null,                 // populated after CLI step
    startedAt: new Date().toISOString(),
    completedAt: null,
    _childProcess: null,
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
  notifyListeners(job, { type: 'step', step: stepId, status, detail: detail ?? null, steps: job.steps });
}

function completeJob(job, success, summary) {
  if (job.status === 'completed' || job.status === 'failed') return;
  job.status = success ? 'completed' : 'failed';
  job.completedAt = new Date().toISOString();
  for (const step of job.steps) {
    if (step.status === 'running') step.status = success ? 'completed' : 'failed';
    else if (step.status === 'pending') step.status = success ? 'skipped' : 'pending';
  }
  notifyListeners(job, { type: 'done', status: job.status, summary: summary || null, errors: job.errors, steps: job.steps });
}

function logLine(job, msg) {
  job.rawLog += `[hybrid:${job.skillType}] ${msg}\n`;
  dev.info(`hybrid-${job.skillType}`, msg);
}

// ── Process-tree spawn + kill (mirrors analyze-pipeline) ────────────────────

function killProcessTree(child, signal = 'SIGTERM') {
  if (!child || typeof child.pid !== 'number') return;
  if (process.platform === 'win32') {
    try {
      const { execSync } = require('child_process');
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore', timeout: 5000 });
    } catch { /* already exited */ }
    return;
  }
  try { process.kill(-child.pid, signal); }
  catch {
    try { child.kill(signal); } catch { /* */ }
  }
}

function runClaudeCli({ cwd, prompt, timeout, onChild }) {
  const isWin = process.platform === 'win32';
  const args = [
    '-p', prompt,
    '--output-format', 'json',
    '--max-turns', String(CLI_MAX_TURNS),
  ];
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let killed = false;

    const child = spawn('claude', args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
      shell: isWin,
      windowsHide: true,
      detached: !isWin,
    });

    if (onChild) onChild(child);
    child.stdin.end();
    child.stdout.on('data', (c) => { stdout += c.toString(); });
    child.stderr.on('data', (c) => { stderr += c.toString(); });

    const timer = setTimeout(() => {
      killed = true;
      killProcessTree(child, 'SIGTERM');
      setTimeout(() => killProcessTree(child, 'SIGKILL'), 5000);
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) return reject(new Error(`Claude CLI timed out after ${Math.round(timeout / 1000)}s`));
      let envelope;
      try { envelope = JSON.parse(stdout); }
      catch {
        const m = stdout.match(/\{[\s\S]*"type"\s*:\s*"result"[\s\S]*\}/);
        if (m) { try { envelope = JSON.parse(m[0]); } catch { /* */ } }
      }
      if (!envelope) {
        const errMsg = stderr ? stderr.substring(0, 500) : `exit ${code}, no parseable JSON`;
        return reject(new Error(`CLI failed: ${errMsg}`));
      }
      if (envelope.is_error) return reject(new Error(`CLI error: ${envelope.result || 'unknown'}`));
      resolve({
        content: envelope.result || '',
        cost: envelope.cost_usd || 0,
        turns: envelope.num_turns || 0,
        sessionId: envelope.session_id || null,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`CLI spawn error: ${err.message}`));
    });
  });
}

// ── Plan parsing ────────────────────────────────────────────────────────────

/**
 * Extract a JSON plan envelope from CLI stdout. Skills are instructed to
 * emit ONE plan JSON at the end; we tolerate prose before it but require
 * the envelope shape ({ version, kind, payload, ... }).
 */
function parsePlanFromCliOutput(content, expectedKind) {
  if (!content) throw new Error('CLI returned empty content');
  let plan;
  try { plan = JSON.parse(content.trim()); }
  catch {
    // Fallback: find the last balanced { ... } in the output
    const lastOpen = content.lastIndexOf('{');
    if (lastOpen < 0) throw new Error('CLI output contains no JSON object');
    let depth = 0, end = -1;
    for (let i = lastOpen; i < content.length; i++) {
      if (content[i] === '{') depth++;
      else if (content[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) throw new Error('CLI output JSON object never closes');
    try { plan = JSON.parse(content.slice(lastOpen, end + 1)); }
    catch (err) { throw new Error(`failed to parse plan JSON: ${err.message}`); }
  }
  if (!plan || typeof plan !== 'object') throw new Error('plan is not an object');
  if (plan.kind !== expectedKind) throw new Error(`plan.kind '${plan.kind}' !== expected '${expectedKind}'`);
  if (!plan.payload || typeof plan.payload !== 'object') throw new Error('plan.payload missing');
  return plan;
}

// ── Concurrency probe ──────────────────────────────────────────────────────

function runningJobCount() {
  let n = 0;
  for (const j of _jobs.values()) if (j.status === 'running') n++;
  return n;
}

// Register with the shared CLI session budget so analyze-pipeline's
// capacity check sees hybrid jobs in its running total.
cliBudget.registerSource('hybrid', runningJobCount);

/**
 * Construct a "bridge job" compatible with the legacy pipeline step
 * functions (build-pipeline.stepCreate, eval-pipeline.runPipeline, etc.).
 * Mutations the legacy code makes flow through to the supplied hybrid job
 * via the listener forwarding, so /api/skill/status/:jobId clients see
 * fine-grained step events instead of just plan/execute/verify.
 *
 * @param {object} hybridJob          Hybrid orchestrator's job (the one
 *                                    in our _jobs map).
 * @param {Array<{id, label}>} legacySteps  Step list expected by the legacy
 *                                    pipeline (its DEFAULT_STEPS).
 * @param {function} onLegacyEvent    Optional callback fired for every
 *                                    event the legacy pipeline emits.
 *                                    Use to push detail into hybrid's
 *                                    `execute` step's detail string.
 * @returns {object}                  Job-shaped object compatible with
 *                                    legacy step functions.
 */
function bridgeLegacyJobToHybrid(hybridJob, legacySteps, onLegacyEvent) {
  const bridge = {
    id: hybridJob.id,
    skillType: hybridJob.skillType,
    projectId: hybridJob.projectId,
    agentId: hybridJob.agentId,
    status: 'running',
    steps: legacySteps.map(s => ({ ...s, status: 'pending', detail: null })),
    errors: hybridJob.errors,           // shared array — legacy pushes flow through
    rawLog: '',
    listeners: [
      // Forward every legacy event into the hybrid job's listener pool so
      // SSE subscribers see them, AND fire the optional callback for any
      // pipeline-specific glue (e.g. surfacing the latest step detail on
      // hybrid's `execute` step).
      (event) => {
        try { notifyListeners(hybridJob, event); } catch { /* */ }
        if (typeof onLegacyEvent === 'function') {
          try { onLegacyEvent(event); } catch { /* */ }
        }
      },
    ],
    startedAt: hybridJob.startedAt,
    completedAt: null,
    _childProcess: null,
  };
  return bridge;
}

// ── Entry point ─────────────────────────────────────────────────────────────

/**
 * Run a hybrid pipeline.
 *
 * @param {object} args
 * @param {'build'|'eval'|'fix'} args.kind
 * @param {string} args.projectId
 * @param {string} args.agentId
 * @param {string} args.baseDir                    repo root
 * @param {(projectDir: string, agentDir: string) => string} args.cliPromptBuilder
 * @param {(plan: object) => { ok: true } | { ok: false, errors: string[] }} args.validatePlan
 * @param {(plan: object, ctx: object) => Promise<{ summary?: string, verifyResult?: any }>} args.apiExecutor
 * @returns {{ id: string, status: string, ... }}  the job (fire-and-forget; subscribe via getJob)
 */
function runHybridPipeline({ kind, projectId, agentId, baseDir, cliPromptBuilder, validatePlan, apiExecutor }) {
  if (!['build', 'eval', 'fix'].includes(kind)) {
    throw new Error(`Invalid hybrid kind: ${kind}`);
  }

  // Capacity cap is shared with analyze-pipeline via cli-session-budget,
  // so the total of (analyze + hybrid) running CLI subprocesses cannot
  // exceed MCS_ANALYZE_MAX_CONCURRENCY. The error code keeps the legacy
  // 'hybrid_capacity_exceeded' identity for callers that branch on it.
  if (cliBudget.atCapacity()) {
    const err = cliBudget.capacityError();
    err.code = 'hybrid_capacity_exceeded';
    throw err;
  }

  const projectDir = path.join(baseDir, 'Build-Guides', projectId);
  if (!fs.existsSync(projectDir)) {
    throw new Error(`Project directory not found: ${projectDir}`);
  }
  const agentDir = path.join(projectDir, 'agents', agentId);

  const job = createJob({ kind, projectId, agentId });
  logLine(job, `starting hybrid ${kind} for ${projectId}/${agentId}`);

  // Fire-and-forget: pipeline runs async, progress via SSE listeners.
  (async () => {
    try {
      // ── Step: plan (CLI) ──
      updateStep(job, 'plan', 'running', 'Spawning CLI for agentic plan');
      const prompt = cliPromptBuilder(projectDir, agentDir);
      const cliResult = await runClaudeCli({
        cwd: baseDir,
        prompt,
        timeout: CLI_PLAN_TIMEOUT,
        onChild: (child) => { job._childProcess = child; },
      });
      job._childProcess = null;

      const plan = parsePlanFromCliOutput(cliResult.content, kind);
      const validation = validatePlan(plan);
      if (!validation || validation.ok !== true) {
        const errs = validation?.errors?.join('; ') || 'unknown';
        throw new Error(`plan failed validation: ${errs}`);
      }
      job.plan = plan;
      updateStep(job, 'plan', 'completed', `${cliResult.turns} turns, $${cliResult.cost.toFixed(2)}`);

      // ── Step: execute (API) ──
      updateStep(job, 'execute', 'running', 'Applying plan via API');
      const apiResult = await apiExecutor(plan, {
        job,
        updateStep: (status, detail) => updateStep(job, 'execute', 'running', detail || status),
      });
      updateStep(job, 'execute', 'completed', apiResult?.summary || 'applied');

      // ── Step: verify ──
      updateStep(job, 'verify', 'running', 'Reading back state');
      // The apiExecutor may have already verified; if so, copy through.
      const verifySummary =
        (apiResult && typeof apiResult.verifyResult === 'string')
          ? apiResult.verifyResult
          : 'verified';
      updateStep(job, 'verify', 'completed', verifySummary);

      completeJob(job, true, apiResult?.summary || 'hybrid pipeline complete');
    } catch (err) {
      const failedStep = job.steps.find((s) => s.status === 'running');
      if (failedStep) updateStep(job, failedStep.id, 'failed', err.message);
      job.errors.push({ step: failedStep?.id || 'unknown', error: err.message });
      logLine(job, `Fatal: ${err.message}`);
      completeJob(job, false, err.message);
    }
  })().catch(() => { /* errors already captured via completeJob */ });

  return job;
}

function cancelJob(jobId) {
  const job = _jobs.get(jobId);
  if (!job || job.status !== 'running') return false;
  if (job._childProcess) {
    killProcessTree(job._childProcess, 'SIGTERM');
    setTimeout(() => killProcessTree(job._childProcess, 'SIGKILL'), 5000);
  }
  completeJob(job, false, 'Cancelled by user');
  return true;
}

function getJob(jobId) { return _jobs.get(jobId) || null; }
function getJobLog(jobId) {
  const job = _jobs.get(jobId);
  return job ? job.rawLog : null;
}
function getMaxConcurrency() { return cliBudget.getMaxConcurrency(); }

module.exports = {
  runHybridPipeline,
  cancelJob,
  getJob,
  getJobLog,
  runningJobCount,
  getMaxConcurrency,
  bridgeLegacyJobToHybrid,    // exposed for build/eval/fix hybrid pipelines
  // exposed for unit tests
  _internals: { parsePlanFromCliOutput, killProcessTree },
};
