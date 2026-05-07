/**
 * fix-pipeline-hybrid.js — Phase A migration of fix onto the hybrid
 * (CLI agentic → API deterministic) contract. The CLI step uses the
 * eval-guide / triage-and-improvement skill to classify failures; the
 * apiExecutor consumes the FixPlan and applies spec_patches plus a
 * re-run of the impacted eval sets.
 *
 * FixPlan schema lives in `knowledge/frameworks/hybrid-pipeline-contract.md`.
 */

const path = require('path');
const fs = require('fs');
const hybrid = require('./hybrid-orchestrator');

// ── FixPlan validation ─────────────────────────────────────────────────────

const VALID_ROOT_CAUSE_CATEGORIES = new Set([
  'instruction-gap',
  'boundary-violation',
  'routing-failure',
  'knowledge-gap',
  'scoring-issue',
  'decision-mismatch',
]);

const VALID_PATCH_SECTIONS = new Set([
  'business', 'agent', 'capabilities', 'integrations', 'knowledge',
  'conversations', 'boundaries', 'architecture', 'flows', 'evalSets',
  'decisions', 'workflow', 'evalConfig', 'openQuestions',
]);

function validateFixPlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object') return { ok: false, errors: ['plan is not an object'] };

  if (plan.version !== '1') errors.push(`version must be "1" (got ${JSON.stringify(plan.version)})`);
  if (plan.kind !== 'fix') errors.push(`kind must be "fix" (got ${JSON.stringify(plan.kind)})`);
  if (typeof plan.projectId !== 'string' || !plan.projectId) errors.push('projectId is required');
  if (typeof plan.agentId !== 'string' || !plan.agentId) errors.push('agentId is required');

  const p = plan.payload;
  if (!p || typeof p !== 'object') {
    errors.push('payload is required');
    return { ok: errors.length === 0, errors };
  }

  if (!Array.isArray(p.rootCauses) || p.rootCauses.length === 0) {
    errors.push('payload.rootCauses must be a non-empty array');
  } else {
    p.rootCauses.forEach((rc, i) => {
      if (!rc || typeof rc !== 'object') return errors.push(`payload.rootCauses[${i}] is not an object`);
      if (!VALID_ROOT_CAUSE_CATEGORIES.has(rc.category)) {
        errors.push(`payload.rootCauses[${i}].category '${rc.category}' must be one of ${[...VALID_ROOT_CAUSE_CATEGORIES].join(', ')}`);
      }
      if (!Array.isArray(rc.evidence) || rc.evidence.length === 0) {
        errors.push(`payload.rootCauses[${i}].evidence must be non-empty (test ids)`);
      }
      if (typeof rc.summary !== 'string' || !rc.summary.trim()) {
        errors.push(`payload.rootCauses[${i}].summary required`);
      }
    });
  }

  if (!Array.isArray(p.patches)) {
    errors.push('payload.patches must be an array (may be empty if all fixes are knowledge updates)');
  } else {
    p.patches.forEach((pp, i) => {
      if (!pp || typeof pp !== 'object') return errors.push(`payload.patches[${i}] is not an object`);
      if (!VALID_PATCH_SECTIONS.has(pp.section)) {
        errors.push(`payload.patches[${i}].section '${pp.section}' is not an allowed spec section`);
      }
      if (!pp.patch || typeof pp.patch !== 'object') {
        errors.push(`payload.patches[${i}].patch must be an object`);
      }
      if (typeof pp.summary !== 'string' || !pp.summary.trim()) {
        errors.push(`payload.patches[${i}].summary required (one-line changelog)`);
      }
    });
  }

  if (p.rerunEvalSets != null && !Array.isArray(p.rerunEvalSets)) {
    errors.push('payload.rerunEvalSets must be an array of test-set names');
  }

  return { ok: errors.length === 0, errors };
}

// ── CLI prompt (Phase A) ───────────────────────────────────────────────────

function fixCliPrompt(projectDir, agentDir) {
  const specPath = path.join(agentDir, 'agentspec.json');
  return [
    'You are running in fix-planning mode for the MCS agent at the path below.',
    '',
    `Project dir:  ${projectDir}`,
    `Agent dir:    ${agentDir}`,
    `Spec path:    ${specPath}`,
    '',
    'Invoke the eval-guide plugin via the Skill tool — specifically:',
    '  /eval-triage-and-improvement  — classify the failures recorded in',
    '                                  spec.evalSets[*].tests[*].lastResult by root cause,',
    '                                  using the eval-guide Triage & Improvement Playbook.',
    '',
    'IMPORTANT: do NOT apply patches during this step. The hybrid contract separates planning',
    '(this step) from execution (the API layer applies the patches via spec_patch and triggers',
    'an eval re-run after you finish).',
    '',
    'Final output: ONE JSON object, no markdown fences. Schema:',
    '{ "version": "1", "kind": "fix", "projectId": "<slug>", "agentId": "<slug>",',
    '  "generatedAt": "<ISO-8601>", "skillRunId": "<your session id or null>",',
    '  "payload": {',
    '    "rootCauses": [',
    '      { "category": "instruction-gap | boundary-violation | routing-failure |',
    '                     knowledge-gap | scoring-issue | decision-mismatch",',
    '        "evidence": ["<failing-test-id>", ...], "summary": "<one-line>" }',
    '    ],',
    '    "patches": [',
    '      { "section": "<spec section name>",',
    '        "patch": { /* spec_patch shape, applied via specStore.applyPatch */ },',
    '        "summary": "<one-line changelog>" }',
    '    ],',
    '    "rerunEvalSets": ["boundaries"|"quality"|"edge-cases", ...]',
    '  }',
    '}',
    '',
    'Validation rules the server enforces:',
    '- rootCauses[] non-empty; each test ID appears in exactly one rootCauses[i].evidence',
    '- category ∈ {instruction-gap, boundary-violation, routing-failure, knowledge-gap,',
    '              scoring-issue, decision-mismatch}',
    '- patches[] may be empty if every fix is a knowledge-source update outside the spec',
    '- patch section ∈ allowed top-level spec keys (agent, capabilities, ...)',
    '',
    'Prefer minimal patches: instruction edits beat topic edits beat schema edits.',
  ].join('\n');
}

// ── apiExecutor (Phase B: direct plan-consuming) ───────────────────────────

const specStore = require('./chat/spec-store');

async function fixApiExecutor(plan, ctx) {
  const projectId = plan.projectId;
  const agentId = plan.agentId;
  const baseDir = ctx.baseDir;
  if (!baseDir) throw new Error('apiExecutor requires ctx.baseDir');

  if (ctx.job.projectId !== projectId) {
    throw new Error(`FixPlan projectId '${projectId}' does not match job projectId '${ctx.job.projectId}'`);
  }
  if (ctx.job.agentId !== agentId) {
    throw new Error(`FixPlan agentId '${agentId}' does not match job agentId '${ctx.job.agentId}'`);
  }

  const sp = specStore.sessionPaths(projectId);
  const agentDir = path.join(sp.folder, 'agents', agentId);
  if (!fs.existsSync(path.join(agentDir, 'agentspec.json'))) {
    throw new Error(`agentspec.json not found at ${agentDir}`);
  }

  // ── Step 1: apply patches under the spec mutex ─────────────────────────
  // Each patch goes through specStore.validatePatch + applyPatch + changelog
  // append, the same path /api/chat spec_patch uses, so the same audit trail
  // and the same array-replace / object-merge semantics apply. Wrapping the
  // whole patch loop in withSpecLock makes the batch atomic — readers never
  // see a half-fixed spec.
  let appliedCount = 0;
  const skippedPatches = [];
  await specStore.withSpecLock(agentDir, async () => {
    for (let i = 0; i < plan.payload.patches.length; i++) {
      const p = plan.payload.patches[i];
      const problems = specStore.validatePatch(p.patch);
      if (problems.length > 0) {
        // Don't kill the whole run for one bad patch — record it and skip.
        // The user gets a partial-success summary; they can re-trigger fix
        // with the offending root cause excluded.
        skippedPatches.push({ index: i, summary: p.summary, reason: problems.join('; ') });
        continue;
      }
      const current = specStore.readSpec(agentDir) || {};
      const merged = specStore.applyPatch(current, p.patch);
      specStore.writeSpec(agentDir, merged);
      specStore.appendChangelog(sp.changelogFile, {
        source: 'fix',
        summary: (p.summary || '(no summary)').slice(0, 240),
        affectedPaths: Object.keys(p.patch || {}),
        affectedSection: p.section,
      });
      appliedCount++;
      ctx.updateStep('running', `Applied ${appliedCount}/${plan.payload.patches.length} patches (${p.section})`);
    }
  });

  // ── Step 2: optionally re-run impacted eval buckets ────────────────────
  // We don't block on the re-run completing — it's a separate hybrid job
  // that the user can watch in PipelineActivityContext. This keeps fix's
  // own job duration bounded; the re-run feeds the next triage iteration.
  let rerunJobId = null;
  if (Array.isArray(plan.payload.rerunEvalSets) && plan.payload.rerunEvalSets.length > 0) {
    try {
      const evalHybrid = require('./eval-pipeline-hybrid');
      const rerun = evalHybrid.startEvalHybridPipeline(projectId, agentId, baseDir);
      rerunJobId = rerun.id;
      ctx.updateStep('running', `Eval re-run dispatched as job ${rerunJobId} for ${plan.payload.rerunEvalSets.join(', ')}`);
    } catch (err) {
      // Non-fatal — patches already landed. Surface so the user knows to
      // re-run manually if desired.
      ctx.job.errors.push({ step: 'execute', error: `eval re-run failed to start: ${err.message}` });
    }
  }

  const skippedNote = skippedPatches.length > 0
    ? `, ${skippedPatches.length} skipped (validation): ${skippedPatches.map(s => `[${s.index}]${s.reason}`).join('; ')}`
    : '';
  const rerunNote = rerunJobId ? `; eval re-run: ${rerunJobId}` : '';

  return {
    summary: `Fix Phase B: ${appliedCount}/${plan.payload.patches.length} patches applied${skippedNote}${rerunNote}`,
    verifyResult: `${appliedCount} spec patches landed via specStore; changelog stamped`,
  };
}

function startFixHybridPipeline(projectId, agentId, baseDir) {
  return hybrid.runHybridPipeline({
    kind: 'fix',
    projectId,
    agentId,
    baseDir,
    cliPromptBuilder: fixCliPrompt,
    validatePlan: validateFixPlan,
    apiExecutor: (plan, ctx) => fixApiExecutor(plan, { ...ctx, baseDir }),
  });
}

module.exports = {
  startFixHybridPipeline,
  cancelJob: hybrid.cancelJob,
  getJob: hybrid.getJob,
  getJobLog: hybrid.getJobLog,
  _internals: { validateFixPlan, fixCliPrompt },
};
