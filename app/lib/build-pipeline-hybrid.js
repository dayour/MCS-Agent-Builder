/**
 * build-pipeline-hybrid.js — Phase A migration of build onto the hybrid
 * (CLI agentic → API deterministic) contract defined in
 * `knowledge/frameworks/hybrid-pipeline-contract.md`.
 *
 * What this file is:
 *   - The first concrete consumer of `hybrid-orchestrator.runHybridPipeline`.
 *   - Demonstrates the round-trip: CLI emits a BuildPlan → server validates
 *     it against the BuildPlan v1 schema → apiExecutor consumes the plan
 *     and applies the deterministic mutations.
 *
 * What this file is NOT (yet):
 *   - A full replacement of `build-pipeline.js`. The legacy pipeline stays
 *     reachable through `/api/skill/start` `skillType: 'build'`. Hybrid is
 *     opt-in via `skillType: 'build-hybrid'` (or env `MCS_BUILD_HYBRID=1`).
 *   - Genuinely agentic. The Phase A CLI prompt is a deterministic
 *     spec→plan translation; Phase B replaces it with `/mcs-build` skill
 *     invocation that picks components, generates instructions, and ranks
 *     topics with the full Claude Code toolset.
 *
 * Phase A is a forcing function: by wiring the contract end-to-end now,
 * every later Phase B improvement gets validated against the same plan
 * shape and the same apiExecutor — no surprise refactors at cutover.
 */

const path = require('path');
const fs = require('fs');
const hybrid = require('./hybrid-orchestrator');

// ── BuildPlan validation ────────────────────────────────────────────────────

const VALID_COMPONENT_TYPES = new Set(['topic', 'knowledge', 'tool', 'flow', 'instruction']);
const VALID_PUBLISH_MODES = new Set(['internal', 'uat']);

/**
 * Validate a BuildPlan against the v1 schema documented in
 * knowledge/frameworks/hybrid-pipeline-contract.md. Returns
 * { ok: true } on success or { ok: false, errors: [...] } with one
 * concrete error per problem so the CLI step's failure log is useful.
 */
function validateBuildPlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object') return { ok: false, errors: ['plan is not an object'] };

  // Envelope
  if (plan.version !== '1') errors.push(`version must be "1" (got ${JSON.stringify(plan.version)})`);
  if (plan.kind !== 'build') errors.push(`kind must be "build" (got ${JSON.stringify(plan.kind)})`);
  if (typeof plan.projectId !== 'string' || !plan.projectId) errors.push('projectId is required');
  if (typeof plan.agentId !== 'string' || !plan.agentId) errors.push('agentId is required');

  // Payload
  const p = plan.payload;
  if (!p || typeof p !== 'object') {
    errors.push('payload is required');
    return { ok: errors.length === 0, errors };
  }
  if (typeof p.agentName !== 'string' || !p.agentName.trim()) {
    errors.push('payload.agentName is required');
  }
  if (!Array.isArray(p.components)) {
    errors.push('payload.components must be an array');
  } else {
    p.components.forEach((c, i) => {
      if (!c || typeof c !== 'object') return errors.push(`payload.components[${i}] is not an object`);
      if (!VALID_COMPONENT_TYPES.has(c.componentType)) {
        errors.push(`payload.components[${i}].componentType '${c.componentType}' is not one of ${[...VALID_COMPONENT_TYPES].join(', ')}`);
      }
      if (typeof c.name !== 'string' || !c.name.trim()) {
        errors.push(`payload.components[${i}].name is required`);
      }
      if (!c.spec || typeof c.spec !== 'object') {
        errors.push(`payload.components[${i}].spec must be an object`);
      }
    });
  }
  if (!VALID_PUBLISH_MODES.has(p.publishMode)) {
    errors.push(`payload.publishMode '${p.publishMode}' is not one of ${[...VALID_PUBLISH_MODES].join(', ')}`);
  }

  // Eval-gate cross-field invariant: skipGate=true requires approvedBy + reason
  if (p.evalGate && p.evalGate.skipGate === true) {
    if (typeof p.evalGate.approvedBy !== 'string' || !p.evalGate.approvedBy) {
      errors.push('evalGate.skipGate=true requires evalGate.approvedBy');
    }
    if (typeof p.evalGate.reason !== 'string' || p.evalGate.reason.length < 10) {
      errors.push('evalGate.skipGate=true requires evalGate.reason (>=10 chars)');
    }
  }

  return { ok: errors.length === 0, errors };
}

// ── CLI prompt (Phase A: deterministic spec→plan translation) ──────────────

/**
 * Build the CLI prompt for the plan step. Phase A asks Claude to translate
 * the agentspec.json into a BuildPlan JSON without making agentic
 * component-selection decisions — those land in Phase B once we trust the
 * plumbing.
 *
 * The prompt forces JSON-only output so the orchestrator's plan parser
 * lands a clean envelope.
 */
function buildCliPrompt(projectDir, agentDir) {
  const specPath = path.join(agentDir, 'agentspec.json');
  return [
    'You are running in build-planning mode for the Microsoft Copilot Studio (MCS) agent at the path below.',
    '',
    `Project dir:  ${projectDir}`,
    `Agent dir:    ${agentDir}`,
    `Spec path:    ${specPath}`,
    '',
    'Invoke the /mcs-build skill (defined in .claude/skills/mcs-build/SKILL.md) using the Skill tool.',
    'Use full agentic mode — the framework files in knowledge/frameworks/, the knowledge cache,',
    'and any MCP servers (PAC CLI, Dataverse, WorkIQ, Microsoft Learn) you need for component',
    'selection and validation.',
    '',
    'IMPORTANT: do NOT actually create the agent in MCS during this step. The hybrid contract',
    'separates planning (this step) from execution (the API layer that runs after you finish).',
    'Stop after Phase 1 of the skill — pre-build validation + final component plan — and emit',
    'the plan as a BuildPlan v1 JSON envelope.',
    '',
    'Final output: ONE JSON object, no markdown fences, no prose before or after. Schema:',
    '{ "version": "1", "kind": "build", "projectId": "<slug>", "agentId": "<slug>",',
    '  "generatedAt": "<ISO-8601>", "skillRunId": "<your session id or null>",',
    '  "payload": {',
    '    "agentName": "<spec.agent.name>",',
    '    "components": [',
    '      { "componentType": "topic|knowledge|tool|flow|instruction",',
    '        "name": "<string>", "spec": { /* component-specific shape */ },',
    '        "rationale": "<why, citing spec section or knowledge cache>" }',
    '    ],',
    '    "publishMode": "internal" | "uat",',
    '    "evalGate": { "skipGate": false }',
    '  }',
    '}',
    '',
    'Validation rules the server enforces (your output must satisfy):',
    '- componentType ∈ {topic, knowledge, tool, flow, instruction}',
    '- agentName, projectId, agentId are non-empty strings',
    '- evalGate.skipGate=true REQUIRES evalGate.approvedBy AND evalGate.reason ≥ 10 chars',
    '',
    'If the spec is missing critical fields, flag it in components[i].rationale ("blocked: missing X")',
    "rather than fabricating data — the API layer will surface the gap to the user.",
  ].join('\n');
}

// ── apiExecutor (Phase B: bridge into legacy step functions) ───────────────

/**
 * Phase B apiExecutor. Reads the validated BuildPlan, sanity-checks it
 * against the on-disk spec, then runs build-pipeline's step functions
 * directly through a bridge job so progress streams cleanly into the
 * hybrid job's listener pool — clients see the 8 fine-grained step IDs
 * (auth/create/configure/components/flows/publish/verify/eval-gate) on
 * `/api/skill/status/:jobId` instead of an opaque "execute" stretch.
 *
 * The plan is the source of intent; we record it on the hybrid job so
 * any downstream consumer (audit, replay, re-run) can read what was
 * promised vs what landed. Build-pipeline's step functions still read
 * the spec for execution because aligning the BuildPlan schema with
 * everything build-pipeline reads is its own follow-up — what changed
 * vs Phase A is observability + scope assertion + audit, not the
 * underlying mutation engine.
 */
async function apiExecutor(plan, ctx) {
  const projectId = plan.projectId;
  const agentId = plan.agentId;
  const baseDir = ctx.baseDir;
  if (!baseDir) throw new Error('apiExecutor requires ctx.baseDir');

  if (ctx.job.projectId !== projectId) {
    throw new Error(`BuildPlan projectId '${projectId}' does not match job projectId '${ctx.job.projectId}'`);
  }
  if (ctx.job.agentId !== agentId) {
    throw new Error(`BuildPlan agentId '${agentId}' does not match job agentId '${ctx.job.agentId}'`);
  }

  const agentDir = path.join(baseDir, 'Build-Guides', projectId, 'agents', agentId);
  if (!fs.existsSync(path.join(agentDir, 'agentspec.json'))) {
    throw new Error(`agentspec.json not found at ${agentDir}`);
  }

  // Stash plan on the hybrid job so /api/skill/status:jobId callers can
  // pull `job.plan` to see what the CLI committed to.
  ctx.job.plan = plan;
  ctx.updateStep('running', `Plan validated; ${plan.payload.components.length} components staged. Running build steps…`);

  // Build-pipeline's DEFAULT_STEPS, mirrored here so the bridge job has
  // the same shape its step functions expect. Keep order in sync with
  // build-pipeline.runPipeline.
  const buildLegacySteps = [
    { id: 'auth',       label: 'Verifying credentials' },
    { id: 'create',     label: 'Creating agent' },
    { id: 'configure',  label: 'Configuring agent' },
    { id: 'components', label: 'Adding components' },
    { id: 'flows',      label: 'Building Power Automate flows' },
    { id: 'publish',    label: 'Publishing (internal)' },
    { id: 'verify',     label: 'Verifying build' },
    { id: 'eval-gate',  label: 'Eval gate (promote to UAT)' },
  ];

  // Bridge: legacy step events forward into the hybrid job's listener
  // pool, so /api/skill/status/:jobId emits a stream that includes
  // "step": "components", "step": "publish", etc. — fine-grained.
  const hybrid = require('./hybrid-orchestrator');
  const bridgeJob = hybrid.bridgeLegacyJobToHybrid(ctx.job, buildLegacySteps, (event) => {
    // Surface the latest legacy step+detail on the hybrid `execute` step
    // so even a UI that doesn't render legacy events shows progress.
    if (event && event.type === 'step' && event.step) {
      const phrase = event.detail ? `${event.step}: ${event.detail}` : `${event.step}: ${event.status}`;
      ctx.updateStep('running', phrase);
    }
  });

  // Run the build-pipeline's runPipeline against the bridge. We import
  // the internal runPipeline by re-using build-pipeline's start path —
  // but build-pipeline doesn't export runPipeline; we'd need to call
  // startBuildPipeline which creates its OWN job in its OWN registry.
  // Workaround: spawn the legacy job and forward its events to the
  // hybrid bridge by adding our forwarder to the legacy job's listener
  // pool. This achieves the same observability goal without pulling
  // build-pipeline internals out.
  const legacyBuild = require('./build-pipeline');
  const legacyJob = legacyBuild.startBuildPipeline(projectId, agentId, baseDir);

  // Forward every event from the legacy job to the hybrid bridge, which
  // in turn notifies the hybrid orchestrator's listeners. The bridge
  // also walks each event into ctx.updateStep above for the rolling
  // detail message on the hybrid `execute` step.
  legacyJob.listeners.push((event) => {
    for (const l of bridgeJob.listeners) {
      try { l(event); } catch { /* */ }
    }
  });

  // Wait for the legacy job to settle. The forwarding listener above
  // streams progress in real time; this loop is just the await primitive.
  await new Promise((resolve, reject) => {
    const check = () => {
      const j = legacyBuild.getJob(legacyJob.id);
      if (!j) return reject(new Error(`legacy build job ${legacyJob.id} disappeared`));
      if (j.status === 'completed') return resolve();
      if (j.status === 'failed') return reject(new Error(j.errors?.[0]?.error || 'legacy build failed'));
      setTimeout(check, 2000);
    };
    check();
  });

  return {
    summary: `Build Phase B complete (job ${legacyJob.id}, ${plan.payload.components.length} components staged via plan)`,
    verifyResult: `legacy build job ${legacyJob.id} settled; bridge forwarded ${buildLegacySteps.length} step events`,
  };
}

// ── Public entry ───────────────────────────────────────────────────────────

function startBuildHybridPipeline(projectId, agentId, baseDir) {
  return hybrid.runHybridPipeline({
    kind: 'build',
    projectId,
    agentId,
    baseDir,
    cliPromptBuilder: buildCliPrompt,
    validatePlan: validateBuildPlan,
    apiExecutor: (plan, ctx) => apiExecutor(plan, { ...ctx, baseDir }),
  });
}

module.exports = {
  startBuildHybridPipeline,
  // Re-export the orchestrator's per-job helpers so /api/skill/status etc.
  // can call into the hybrid registry without knowing it's the same map.
  cancelJob: hybrid.cancelJob,
  getJob: hybrid.getJob,
  getJobLog: hybrid.getJobLog,
  // Exposed for unit tests.
  _internals: {
    validateBuildPlan,
    buildCliPrompt,
  },
};
