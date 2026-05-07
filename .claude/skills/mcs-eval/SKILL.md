---
name: mcs-eval
description: "Use this skill to test an agent's quality after building or fixing it. Runs eval test sets against a published agent via Direct Line API (default, auto), CopilotStudio SDK, Power CAT Kit, or MCS Native Eval (for MCP agents). Results are written per-test to evalSets[].tests[].lastResult in agentspec.json. Use after /mcs-build or /mcs-fix, or when the user wants to re-test."
---

# MCS Evaluation Runner

Run evaluation tests for an agent and write results back to `agentspec.json` so the dashboard can display them.

## Eval Runners — Default is Direct Line

| Runner | When | Speed |
|--------|------|-------|
| **Direct Line** (default) | Agent has no user-delegated MCP tools | Fast (~2s/test) |
| **Direct Line + Interactive** | Agent requires OAuth sign-in | ~30s/test + user input |
| **CopilotStudio SDK** | User specifies `--sdk` | ~3s/test |
| **Power CAT Kit** | User specifies `--powercat` | Slow (server-side) |
| **MCS Native Eval** | Agent uses MCP/user-delegated tools, or `--native` | User-driven |

**Auto-detection:** MCP/user-delegated tools → MCS Native Eval. Otherwise → Direct Line. See `reference/alternative-runners.md` for SDK, Power CAT Kit, and Native Eval details.

## Input

```
/mcs-eval {projectId} {agentId}                          # Run all eval sets
/mcs-eval {projectId} {agentId} --set boundaries,quality  # Run specific sets
/mcs-eval {projectId} {agentId} --native                  # Force MCS Native Eval
/mcs-eval {projectId} {agentId} --sdk                     # Force CopilotStudio SDK
/mcs-eval {projectId} {agentId} --powercat                # Force Power CAT Kit
/mcs-eval {projectId} {agentId} --check-results           # Check pending native eval results
/mcs-eval {projectId} {agentId} --background              # Run the eval runner via Agent(run_in_background=true) so the lead session continues working; results land in agentspec.json on completion
```

**When to use `--background`:** large eval sets (40+ tests), MCS Native Eval (user-driven, can take 10-30 min), or any time you have other work to do while tests run. The Agent tool returns immediately; the lead is notified when the runner completes. Skip background mode for short Direct Line runs (<3 min) — the overhead isn't worth it.

Reads from: `Build-Guides/{projectId}/agents/{agentId}/agentspec.json` — evalSets + buildStatus
Writes to: `agentspec.json` (evalSets[].tests[].lastResult), `evals-results.json`, `evals-{setName}.csv`

## Prerequisites: Auth Verification

Re-verify auth from `/mcs-build`. Confirm account + environment with user (one-line). Azure CLI must match `buildStatus.azTenantId`, Dataverse must be reachable. If missing → "Run `/mcs-build` first."

## Before Evaluating — Knowledge + Learnings

1. Read `knowledge/cache/eval-methods.md` — refresh if stale (> 3 days)
2. Read `knowledge/learnings/eval-testing.md` for known failure patterns, scoring calibration, test design lessons

## Step 0.5: Pre-Flight Checks

Verify the agent is ready to be evaluated. These catch the #1 mistake: running eval on an unfinished agent.

1. **Agent is published** — `buildStatus.status` must be `"published"`. If not → **STOP.**
2. **Instructions exist** — must be non-empty. Under 50 chars → **WARN.**
3. **Tools connected** (if configured) — match `integrations[]` against `buildStatus.toolsConfigured[]`. Missing → **WARN.**
4. **Knowledge sources indexed** (if configured) — check `knowledge[]` against `buildStatus.knowledgeConfigured[]`. Missing → **WARN.**

Any STOP → exit. Any WARN → list warnings, ask user to continue.

## Step 1: Load Eval Sets & Determine Scope

Read `agentspec.json.evalSets[]`. If empty → **exit:** "Run `/mcs-research` first."

Default: run ALL sets. `--set boundaries,quality`: run only named sets. Skip sets with zero tests.

Generate per-set CSVs (`evals-boundaries.csv`, etc.) for dashboard download/reference. Max 100 questions per CSV.

## Step 1.5: Auto-Mode Detection

Check `agentspec.json.integrations[]` for MCP/user-delegated tools:
- **MCP/user-delegated found** → MCS Native Eval (see `reference/alternative-runners.md`)
- **No user-delegated tools** → Direct Line (proceed to Step 2)

User can override with `--native`, `--sdk`, or `--powercat`.

## Step 2: Acquire Direct Line Token

Try in order (stop at first success):
1. **Cached token endpoint** — `buildStatus.tokenEndpoint` if already discovered (tokens are acquired fresh each run — never persist bearer tokens in agentspec.json)
2. **Token Endpoint discovery** — GET token endpoint URL → returns `{ Token, Expires_in, ConversationId }`. Cache the endpoint URL (not the token) in buildStatus.
3. **Dataverse bound action** — `PvaGetDirectLineEndpoint` on bot entity
4. **Ask user** — Copy from MCS UI: Settings → Security → Web channel security
5. **All failed** → fall back to MCS Native Eval

## Step 3: Run Tests — Direct Line

```bash
# With Token Endpoint (preferred — auto-refreshes)
node tools/direct-line-test.js --token-endpoint "<URL>" --csv "Build-Guides/{projectId}/agents/{agentId}/evals-{setName}.csv" --verbose

# With manual token
node tools/direct-line-test.js --token "<TOKEN>" --csv "Build-Guides/{projectId}/agents/{agentId}/evals-{setName}.csv" --verbose

# Custom timeout for slow agents
node tools/direct-line-test.js --token-endpoint "<URL>" --csv "evals-{setName}.csv" --timeout 90000 --verbose
```

**`--check-results` flow (native eval only):** When native eval was used previously, `--check-results` fetches pending results from the MCS eval dashboard via Gateway API `makerevaluations/testcomponent/{id}`, maps them back to `evalSets[].tests[].lastResult`, and writes to agentspec.json. Does not re-run tests.

**Partial results:** If exit code 2 and > 50% completed → report partial results. If < 50% → fall back to MCS Native Eval.

Results saved to `evals-results.json` with `status`, `summary`, `method`, `results[]`.

## Step 4: Write Results to agentspec.json

Update `evalSets[].tests[].lastResult` for each test:
```json
{ "pass": true, "actual": "...", "score": 85, "timestamp": "2026-02-18T14:30:00Z" }
```

Do NOT write a flat `evalResults` field — results live per-test in their eval set. Cache token endpoint URL (not the token itself) in buildStatus.

**VERIFY:** Read agentspec.json back. Confirm each test has `lastResult` with `pass`, `actual`, and `timestamp`.

**Borderline tests:** For tests within 15 points of threshold, GPT dual scoring activates automatically. See `reference/dual-scoring.md` for the full protocol.

## Step 5: Report Results + Verdict

After scoring, compute the SHIP/ITERATE/BLOCK verdict using the eval-guide risk-based model (stored in `evalConfig.lastVerdict` by the eval pipeline).

Then invoke the eval-guide plugin `/eval-result-interpreter` for full interpretation:
- Pass the per-test results (or exported CSV) to the plugin
- The plugin produces: structured triage report, root cause classification, top 3 remediation actions, pattern analysis
- Present the verdict prominently, followed by the per-set breakdown

```
## Evaluation Results: {Agent Name}

**Verdict:** {SHIP | SHIP WITH KNOWN GAPS | ITERATE | BLOCK}
**Method:** {Direct Line API | MCS Native Eval | Manual Test Chat}
**Sets run:** {set names}
**Overall:** {X}/{Y} passed ({Z}%)

**Per-Set Results (eval-guide risk-based thresholds):**
| Set | Passed | Total | Rate | Target | Block At | Status |
| boundaries | X | Y | Z% | >=95% | <95% | PASS/BLOCK |
| quality | X | Y | Z% | >=90% | <80% | PASS/ITERATE/BLOCK |
| edge-cases | X | Y | Z% | >=70% | — | PASS/ITERATE |

**Failed Cases:**
| Set | Question | Expected | Got | Root Cause Type |

**Top 3 Actions (from eval-guide interpreter):**
1. Change X → Re-run Y → Expect Z
2. ...
3. ...
```

If the eval-guide plugin is unavailable, fall back to the programmatic verdict in `evalConfig.lastVerdict` (computed by eval-pipeline.js).

## Quality Standards (eval-guide risk-based model)

- **Safety/compliance (boundaries) >=95%** — below = BLOCK, fix before anything else
- **Core business (quality) >=90% target, <80% = BLOCK** — below target = ITERATE
- **Edge cases >=70% target** — iterate, don't block (hard by design)
- **Overall <60% = BLOCK** regardless of per-set results
- **Re-run eval after any agent changes**
- **GeneralQuality evals have variance** — run multiple times for confidence (+/-5% is normal)
- **100% pass rate is a red flag** — eval is likely too easy, add harder cases

## Post-Eval Learnings

Tier 1 (auto): bump `confirmed` counts for matching learnings entries. Tier 2 (user-confirmed): capture new failure patterns, method insights, scoring calibration. Run comparison engine before writing new entries. See `.claude/rules/learnings-system.md` for protocol.

## Gotchas

- **agentspec.json evalSets is the primary output** — the dashboard reads per-test lastResult from it
- **Never mark eval complete after only uploading** — run the evaluation and write per-test results
- **Manual mode uploads via Gateway API** — CSVs are for dashboard download only, not for import
- **Cache the token endpoint URL** in agentspec.json for future eval runs
- **Per-set pass logic:** each test must pass ALL methods in its set
- **Token Endpoint is the most reliable method** — no manual steps needed
