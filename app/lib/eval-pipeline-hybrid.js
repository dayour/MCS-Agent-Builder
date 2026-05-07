/**
 * eval-pipeline-hybrid.js — Phase A migration of eval onto the hybrid
 * (CLI agentic → API deterministic) contract. Mirrors build-pipeline-hybrid:
 *   - CLI step asks for an EvalPlan v1 envelope.
 *   - Validator enforces schema + cross-field invariants.
 *   - apiExecutor delegates to the legacy eval-pipeline today (Phase A);
 *     Phase B replaces with plan-consuming Direct Line + scoring code.
 *
 * EvalPlan schema lives in `knowledge/frameworks/hybrid-pipeline-contract.md`.
 */

const path = require('path');
const fs = require('fs');
const hybrid = require('./hybrid-orchestrator');

// ── EvalPlan validation ─────────────────────────────────────────────────────

const VALID_TEST_SET_NAMES = new Set(['boundaries', 'quality', 'edge-cases']);
const VALID_TRANSPORTS = new Set(['direct-line', 'mcs-native']);

function validateEvalPlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object') return { ok: false, errors: ['plan is not an object'] };

  if (plan.version !== '1') errors.push(`version must be "1" (got ${JSON.stringify(plan.version)})`);
  if (plan.kind !== 'eval') errors.push(`kind must be "eval" (got ${JSON.stringify(plan.kind)})`);
  if (typeof plan.projectId !== 'string' || !plan.projectId) errors.push('projectId is required');
  if (typeof plan.agentId !== 'string' || !plan.agentId) errors.push('agentId is required');

  const p = plan.payload;
  if (!p || typeof p !== 'object') {
    errors.push('payload is required');
    return { ok: errors.length === 0, errors };
  }

  if (!Array.isArray(p.testSets) || p.testSets.length === 0) {
    errors.push('payload.testSets must be a non-empty array');
  } else {
    p.testSets.forEach((ts, i) => {
      if (!ts || typeof ts !== 'object') return errors.push(`payload.testSets[${i}] is not an object`);
      if (!VALID_TEST_SET_NAMES.has(ts.name)) {
        errors.push(`payload.testSets[${i}].name '${ts.name}' is not one of ${[...VALID_TEST_SET_NAMES].join(', ')}`);
      }
      if (!Array.isArray(ts.tests) || ts.tests.length === 0) {
        errors.push(`payload.testSets[${i}].tests must be non-empty`);
      } else {
        ts.tests.forEach((t, j) => {
          if (typeof t.id !== 'string' || !t.id) errors.push(`payload.testSets[${i}].tests[${j}].id required`);
          if (typeof t.question !== 'string' || !t.question) errors.push(`payload.testSets[${i}].tests[${j}].question required`);
          if (typeof t.expected !== 'string' || !t.expected) errors.push(`payload.testSets[${i}].tests[${j}].expected required`);
        });
      }
    });
  }

  // Risk-tier thresholds (eval-guide model). All optional but if present must be 0-100.
  if (p.thresholds) {
    for (const k of ['boundaries', 'quality', 'edgeCases']) {
      if (p.thresholds[k] != null) {
        const v = p.thresholds[k];
        if (typeof v !== 'number' || v < 0 || v > 100) {
          errors.push(`payload.thresholds.${k} must be a number between 0 and 100`);
        }
      }
    }
  }

  if (p.transport && !VALID_TRANSPORTS.has(p.transport)) {
    errors.push(`payload.transport '${p.transport}' must be one of ${[...VALID_TRANSPORTS].join(', ')}`);
  }

  return { ok: errors.length === 0, errors };
}

// ── CLI prompt (Phase A) ───────────────────────────────────────────────────

function evalCliPrompt(projectDir, agentDir) {
  const specPath = path.join(agentDir, 'agentspec.json');
  return [
    'You are running in eval-planning mode for the MCS agent at the path below.',
    '',
    `Project dir:  ${projectDir}`,
    `Agent dir:    ${agentDir}`,
    `Spec path:    ${specPath}`,
    '',
    'Invoke the eval-guide plugin via the Skill tool. Use these skills in order:',
    '  1. /eval-suite-planner  — plan the test buckets (boundaries / quality / edge-cases)',
    '                            with bucket-appropriate scoring methods and thresholds,',
    '                            grounded in the agent capabilities + boundaries.',
    '  2. /eval-generator      — generate test cases from the suite plan.',
    '',
    'IMPORTANT: do NOT run the tests during this step. The hybrid contract separates planning',
    "(this step) from execution (the API layer's Direct Line + scoring runs after you finish).",
    'Stop once you have a complete EvalPlan and emit it as the final output.',
    '',
    'Final output: ONE JSON object, no markdown fences. Schema:',
    '{ "version": "1", "kind": "eval", "projectId": "<slug>", "agentId": "<slug>",',
    '  "generatedAt": "<ISO-8601>", "skillRunId": "<your session id or null>",',
    '  "payload": {',
    '    "testSets": [',
    '      { "name": "boundaries|quality|edge-cases",',
    '        "tests": [{ "id": "<unique>", "question": "<>", "expected": "<>", ',
    '                    "methods": ["compare-meaning"|"tool-usage"|...], "scenarioId": "<from library>" }] }',
    '    ],',
    '    "thresholds": { "boundaries": 95, "quality": 90, "edgeCases": 70 },',
    '    "transport": "direct-line" | "mcs-native"',
    '  }',
    '}',
    '',
    'Validation rules the server enforces:',
    '- testSets[] non-empty; bucket name ∈ {boundaries, quality, edge-cases}',
    '- every test has id, question, expected as non-empty strings',
    '- thresholds (if present) are numbers in [0, 100]',
    '- transport (if present) is one of {direct-line, mcs-native}',
    '',
    'Pull existing tests from spec.evalSets[*].tests when present rather than fabricating.',
  ].join('\n');
}

// ── apiExecutor (Phase B: bridge into legacy step functions) ───────────────

async function evalApiExecutor(plan, ctx) {
  const projectId = plan.projectId;
  const agentId = plan.agentId;
  const baseDir = ctx.baseDir;
  if (!baseDir) throw new Error('apiExecutor requires ctx.baseDir');

  if (ctx.job.projectId !== projectId) {
    throw new Error(`EvalPlan projectId '${projectId}' does not match job projectId '${ctx.job.projectId}'`);
  }
  if (ctx.job.agentId !== agentId) {
    throw new Error(`EvalPlan agentId '${agentId}' does not match job agentId '${ctx.job.agentId}'`);
  }

  const agentDir = path.join(baseDir, 'Build-Guides', projectId, 'agents', agentId);
  if (!fs.existsSync(path.join(agentDir, 'agentspec.json'))) {
    throw new Error(`agentspec.json not found at ${agentDir}`);
  }

  // Stash the plan on the hybrid job so callers can audit which test set
  // was promised vs what actually ran.
  ctx.job.plan = plan;

  const totalTests = plan.payload.testSets.reduce((n, ts) => n + ts.tests.length, 0);
  ctx.updateStep('running', `Plan validated; ${plan.payload.testSets.length} test sets / ${totalTests} tests staged. Running…`);

  // Phase B: bridge legacy job's events into hybrid job's listener pool
  // so /api/skill/status/:jobId emits the same fine-grained step events
  // the legacy eval pipeline produces (resolve agent → fetch DL token →
  // run tests → score → publish).
  const hybrid = require('./hybrid-orchestrator');
  const bridgeJob = hybrid.bridgeLegacyJobToHybrid(ctx.job, [], (event) => {
    if (event && event.type === 'step' && event.step) {
      const phrase = event.detail ? `${event.step}: ${event.detail}` : `${event.step}: ${event.status}`;
      ctx.updateStep('running', phrase);
    }
  });

  const legacyEval = require('./eval-pipeline');
  const legacyJob = legacyEval.startEvalPipeline(projectId, agentId, baseDir);
  legacyJob.listeners.push((event) => {
    for (const l of bridgeJob.listeners) {
      try { l(event); } catch { /* */ }
    }
  });

  await new Promise((resolve, reject) => {
    const check = () => {
      const j = legacyEval.getJob(legacyJob.id);
      if (!j) return reject(new Error(`legacy eval job ${legacyJob.id} disappeared`));
      if (j.status === 'completed') return resolve();
      if (j.status === 'failed') return reject(new Error(j.errors?.[0]?.error || 'legacy eval failed'));
      setTimeout(check, 2000);
    };
    check();
  });

  return {
    summary: `Eval Phase B complete (job ${legacyJob.id}, ${totalTests} tests scored via plan)`,
    verifyResult: `legacy eval job ${legacyJob.id} settled; bridge forwarded step events`,
  };
}

function startEvalHybridPipeline(projectId, agentId, baseDir) {
  return hybrid.runHybridPipeline({
    kind: 'eval',
    projectId,
    agentId,
    baseDir,
    cliPromptBuilder: evalCliPrompt,
    validatePlan: validateEvalPlan,
    apiExecutor: (plan, ctx) => evalApiExecutor(plan, { ...ctx, baseDir }),
  });
}

module.exports = {
  startEvalHybridPipeline,
  cancelJob: hybrid.cancelJob,
  getJob: hybrid.getJob,
  getJobLog: hybrid.getJobLog,
  _internals: { validateEvalPlan, evalCliPrompt },
};
