# Deep Research — CLI is now the canonical path (2026-05-05)

## Decision

**Chat-issued and CTA-issued deep research both run through `analyze-pipeline.js` (CLI subprocess via `claude -p`).** The API-direct `research-pipeline.js` is no longer reachable from any public entry point. The file is preserved for emergency rollback (revert `tools.js execStartDeepResearch` and the `/api/skill/start` skillType branch).

Build, eval, and fix remain API-direct and have NOT been converted to hybrid yet. That work is deferred — see "Deferred work" below.

## Rationale

The CLI path has access to the contracts we built specifically to take guesswork out of agentic runs:

- **Skills** — `/mcs-research`, `/mcs-build`, `/mcs-eval`, `/mcs-fix` and the cross-cutting `superpowers` skills (systematic-debugging, brainstorming, TDD).
- **MCP servers** — PAC CLI, Dataverse, WorkIQ, Microsoft Learn, Figma. Live API access for grounded decisions.
- **Knowledge cache** — 24 cheat sheets + connector schemas + first-party-agents inventory.
- **Frameworks** — component-selection, architecture-scoring, solution-type-scoring, eval-scenario library mapping, auto-merge denylist.
- **Sub-agents** — flow-designer, prompt-engineer, qa-challenger, repo-auditor, research-analyst, topic-engineer, dispatched in parallel via the Agent tool.

The API-direct `research-pipeline.js` re-implemented a slice of this orchestration in-process. It was faster (3-8 min vs 20-30 min) but bounded by what we explicitly coded. Quality preference: pay the latency for the agentic path that uses every contract.

## Routing

```
┌─────────────────────────────┬───────────────────────────────────────┐
│ Entry point                  │ Pipeline                              │
├─────────────────────────────┼───────────────────────────────────────┤
│ chat tool start_deep_research│ analyze-pipeline (CLI)  ← swapped     │
│ /api/skill/start research    │ analyze-pipeline (CLI)  ← aliased     │
│ /api/skill/start analyze     │ analyze-pipeline (CLI)                │
│ DeepResearchCta button       │ /api/skill/start analyze → CLI        │
│ /api/skill/start build       │ build-pipeline (API-direct)           │
│ /api/skill/start eval        │ eval-pipeline (API-direct)            │
│ /api/skill/start fix         │ fix-pipeline (API-direct)             │
└─────────────────────────────┴───────────────────────────────────────┘
```

## Frontend wiring

The chat router now emits `{ kind: 'analyze' }` on `job_started`. PipelineActivityContext stores `skillType: 'analyze'`. SpecCanvasDocument's running-job filter accepts `analyze | research | preview` so any in-flight jobs from before the swap also light up "Writing…" pills correctly. `STEP_TO_SECTIONS` now covers BOTH analyze step IDs (`process`, `classify`, `research`, `score`, `generate`, `evals`, `finalize`) and the legacy research IDs (`agents`, `components`, `architecture`, `instructions`, `topics`, `reconcile`).

JobProgressCard renders "Deep Research" for either kind so the user sees a stable label regardless of internal pipeline name.

## Deferred work — GPT challenge flagged these as still open

GPT verdict on the migration plan was **block** with the top risk: *"unproven agentic quality gains justify replacing a fast, deterministic, observable production path with a 20-30 minute opaque subprocess path whose latency, capacity, security, cancellation, and contract-drift failures will directly hit the core user experience."* We accepted the trade-off but the following concerns remain real and should be addressed before scaling:

| Area | Concern | Mitigation idea |
|------|---------|-----------------|
| **Concurrency** | Each CLI job spawns a Claude Code session + child processes. No queue, no per-tenant quotas, no concurrency limit. | Add a job queue with bounded concurrency, per-tenant quotas, leases + heartbeats. |
| **Cancellation** | `child_process.kill()` sends SIGTERM to the parent only. Tool subprocesses spawned by the CLI may continue mutating Dataverse / PAC state. | Use process-group kill (`detached: true` + `process.kill(-pid)`), verify no orphans remain. |
| **Output reliability** | CLI emits human-readable text. Step parsing is regex-based and brittle if Claude Code changes log format. | Versioned event contract; produce structured JSON at every step boundary. |
| **Security — prompt injection** | User docs, knowledge cache contents, Dataverse records, MCP results all flow into the CLI prompt. Any of them could instruct the CLI to exfiltrate secrets or perform unauthorized writes. | Sandbox per-job working directory, restricted env vars, MCP scope per tenant, allowlisted tool calls, audit trail. |
| **Security — shell args** | If user-controlled values (filenames, project IDs, tenant IDs) are interpolated into the `claude -p` invocation, classic injection surface. | Argument-array spawn (no shell), validate every interpolated value. |
| **Observability** | Minimal step-level instrumentation. No token/tool usage metrics, no replay artifacts. | Structured events; emit token usage, tool-call audit, exit code, cancellation reason. |
| **Reconnect / disconnect** | If user closes the chat 5 min into a 25-min job, the job continues but no one is watching. | Owner/retention policy: if no SSE listener for N minutes, optionally pause/cancel. |
| **Build/eval/fix hybrid** | User intent: CLI for agentic decisions (component selection, instruction generation) + API-direct for HTTP push. Currently 100% API-direct. | Separate work — design hybrid contract, define which steps are agentic vs deterministic, implement. |

## Rollback

If the CLI path causes a production incident:

```js
// In app/lib/chat/tools.js execStartDeepResearch:
//  - revert lazyAnalyzePipeline → lazyResearchPipeline
//  - revert pipeline.startAnalyzePipeline(...) → pipeline.startResearchPipeline('research', projectId, agentId, baseDir)
//  - revert kind: 'analyze' → 'research'

// In app/server.js /api/skill/start:
//  - split the 'research' case back out to call researchPipeline.startResearchPipeline
//  - keep the 'analyze' case unchanged
```

`research-pipeline.js` itself is unchanged on disk; reverting the call sites restores prior behavior.
