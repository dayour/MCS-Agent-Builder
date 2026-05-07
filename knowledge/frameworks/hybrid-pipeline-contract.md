# Hybrid Pipeline Contract — CLI for agentic decisions, API for deterministic execution

> **Status (2026-05-05, Phase B finalized):**
> - Scaffold: `app/lib/hybrid-orchestrator.js` (job lifecycle, process-tree spawn/kill, plan parser, capacity cap, legacy-job bridge).
> - **All three pipelines wired:** `build-pipeline-hybrid.js`, `eval-pipeline-hybrid.js`, `fix-pipeline-hybrid.js`.
> - **Skill-invocation prompts:** build → `/mcs-build`, eval → `/eval-suite-planner` + `/eval-generator`, fix → `/eval-triage-and-improvement`.
> - **Phase B execution:** fix is fully plan-driven (patches applied via `specStore` under the spec mutex; eval re-run dispatched via eval-hybrid). Build + eval bridge their legacy step functions through `bridgeLegacyJobToHybrid()` so `/api/skill/status/:jobId` streams fine-grained step events.
> - **Routes:** `/api/skill/start` accepts `build-hybrid | eval-hybrid | fix-hybrid` plus the `MCS_*_HYBRID=1` env vars that flip the plain types. Chat tool `start_mcs_build` calls the hybrid build directly.

## Why hybrid

Pure-API pipelines (today's build/eval/fix) are fast and observable but reimplement decision-making in code. Pure-CLI pipelines (today's analyze) get full agentic mode (skills, MCPs, knowledge cache) but are 4-10× slower and opaque.

Hybrid splits the responsibility:

| Layer | Owns | Example responsibilities |
|-------|------|--------------------------|
| **CLI (agentic)** | Decisions that benefit from full Claude Code context | Pick the right component when 3 candidates fit. Re-rank topics. Generate instructions tuned to a persona. Triage 12 eval failures into 3 root causes. |
| **API (deterministic)** | Mutations against external systems | Dataverse writes. LSP push. PVA materialization. Direct Line eval runs. Spec-store atomic writes. |

The CLI step produces a **plan** — a structured JSON document. The API step reads that plan, validates it against a schema, and executes the mutations. There is no agentic decision-making during the API step; if the plan is invalid the run halts before any external side effect.

## Contract shape

Every hybrid pipeline emits the same job event sequence:

```
job_started
  step: plan        (running) ← CLI subprocess emits intermediate progress
  step: plan        (completed) ← plan JSON parsed + schema-valid
  step: execute     (running)   ← API mutations begin
  step: execute     (completed) ← all mutations applied
  step: verify      (running)   ← read-back checks
  step: verify      (completed) ← verified
job_completed
```

If any step fails, the job ends with `status: failed` and the failing step's `errors[]` populated. No partial commits to external state — the API executor either succeeds end-to-end or aborts.

## Plan envelope (per pipeline)

All plans carry a common envelope plus a pipeline-specific `payload`:

```jsonc
{
  "version": "1",          // bump when payload schema changes incompatibly
  "kind": "build" | "eval" | "fix",
  "projectId": "<slug>",
  "agentId": "<slug>",
  "generatedAt": "ISO-8601",
  "skillRunId": "<claude session id>",  // for replay
  "payload": { /* see per-kind sections below */ }
}
```

### BuildPlan payload (v1)

```jsonc
{
  "agentName": "<string>",
  "components": [
    {
      "componentType": "topic" | "knowledge" | "tool" | "flow" | "instruction",
      "name": "<string>",
      "spec": { /* component-specific shape — must satisfy om-cli schema */ },
      "rationale": "<why this component, cited from spec or knowledge cache>"
    }
  ],
  "publishMode": "internal" | "uat",
  "evalGate": {
    "skipGate": false,
    "approvedBy": "<string>?",
    "reason": "<string>?"
  }
}
```

The API executor (`build-pipeline.js`) replaces its current "decide which component to use" code paths with `plan.payload.components` reads. Component validation is already covered by `om-cli`; we just delegate the decision upstream.

### EvalPlan payload (v1)

```jsonc
{
  "testSets": [
    {
      "name": "boundaries" | "quality" | "edge-cases",
      "tests": [
        {
          "id": "<string>",
          "question": "<string>",
          "expected": "<string>",
          "methods": ["compare-meaning" | "tool-usage" | ...],
          "scenarioId": "<eval-guide library id>"
        }
      ]
    }
  ],
  "thresholds": {
    "boundaries": 95,
    "quality": 90,
    "edgeCases": 70
  },
  "transport": "direct-line" | "mcs-native"
}
```

### FixPlan payload (v1)

```jsonc
{
  "rootCauses": [
    {
      "category": "instruction-gap" | "boundary-violation" | "routing-failure" |
                  "knowledge-gap" | "scoring-issue" | "decision-mismatch",
      "evidence": ["<failing-test-id>", ...],
      "summary": "<string>"
    }
  ],
  "patches": [
    {
      "section": "agent" | "capabilities" | "boundaries" | "conversations" | ...,
      "patch": { /* spec_patch shape — applied via specStore.applyPatch */ },
      "summary": "<one-line changelog entry>"
    }
  ],
  "rerunEvalSets": ["boundaries", "quality"]
}
```

## Validation

Every plan is validated before the API step runs. Validation enforces:

1. **Envelope integrity** — version, kind matches expected, projectId/agentId match the job's scope.
2. **Schema compliance** — payload matches the JSON Schema for its kind.
3. **Cross-field invariants** — e.g. BuildPlan's `evalGate.skipGate=true` requires `approvedBy` AND `reason`.
4. **Authorization scope** — patches in a FixPlan can only modify agentspec sections the user is allowed to edit (no business-licensing flips, no auditedAt timestamp manipulation).

If any check fails the job is marked `failed` at the `plan` step. Logs include the failing path so the next CLI run (or a human) can correct it.

## Why a plan and not just "run the skill"

- **Auditability** — the plan is persisted alongside the job. Reviewable, replayable, diffable across runs.
- **Authorization** — server can enforce limits (eval-gate overrides, premium connector bans) on the plan before any side effect.
- **Idempotency** — re-running with the same plan produces the same external state; re-running the skill might not.
- **Observability** — the API step's progress events map cleanly to plan items, not opaque CLI text.

## Cancellation + concurrency

Inherited from `app/lib/analyze-pipeline.js` (the reference implementation):

- **Process-tree kill** — POSIX uses `detached:true` + `process.kill(-pid)`; Windows uses `taskkill /T /F`.
- **Capacity cap** — server-wide max-concurrent count (env `MCS_ANALYZE_MAX_CONCURRENCY`, default 2). Hybrid pipelines that spawn CLI count against the same cap.
- **Mid-execute cancel** — once the API step has begun, cancellation is best-effort: pending mutations finish but no new ones start. The verify step still runs to record what landed.

## Scaffold module

`app/lib/hybrid-orchestrator.js` is the reusable kernel. It owns:

- Job lifecycle (createJob, notifyListeners, updateStep, completeJob — same shape as the existing pipelines so `findJob()` keeps working)
- Process-tree spawn with shared timeout + budget caps
- Plan-envelope parse + schema validation
- Step→stage mapping (plan / execute / verify) with intermediate progress events

Pipelines wire in three things:

1. `cliPromptBuilder(projectDir, agentDir)` — produces the focused skill prompt for the CLI step
2. `planSchema` — JSON Schema for the payload
3. `apiExecutor(plan, ctx)` — the deterministic mutation function

This way adding a new hybrid pipeline is `~150 lines` of pipeline-specific code instead of the `~500 lines` of orchestration boilerplate that exists today across `analyze-pipeline.js` / `build-pipeline.js` / `eval-pipeline.js` / `fix-pipeline.js`.

## Migration plan (sketch)

1. **build-pipeline.js** — extract the existing API mutations into `apiExecutor(plan)`. Replace decision points (component picks, instruction-from-spec generation) with plan reads. Skill: `/mcs-build` Phase 1 emits `BuildPlan` JSON.
2. **eval-pipeline.js** — current code already runs deterministic Direct Line probes. Wrap eval-set generation (today the `eval-guide` plugin) into the CLI step. Skill: `/eval-suite-planner` + `/eval-generator` emit `EvalPlan`.
3. **fix-pipeline.js** — root-cause classification is the agentic part. Skill: `/eval-triage-and-improvement` emits `FixPlan`. API executor applies the patches and triggers a re-run via the eval pipeline.

Each migration is independent and reversible: until a pipeline opts in, it keeps its current orchestration. The hybrid scaffold lives next to the existing pipeline files; cutover is the call-site swap in `/api/skill/start`.

## Open questions deferred

- **Plan caching** — should we cache plans keyed on (spec hash + skill version) so a re-run with no spec changes skips the CLI step? Worth doing once we have replay artifacts.
- **Versioning** — when the BuildPlan v1 schema needs a breaking change, support v1 plans in flight while v2 rolls out (parallel validators).
- **Partial plans** — a CLI step may return a plan covering only some components (the rest deferred). API executor needs to know which subset is committed vs pending.
