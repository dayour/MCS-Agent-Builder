---
name: mcs-eval
description: "Run evaluation tests using eval sets. Two-mode execution: Direct Line API (auto) or MCS Native Eval via Gateway API upload + run (manual). Results written per-test to evalSets[].tests[].lastResult."
---

# MCS Evaluation Runner — Two-Mode Strategy

Run evaluation tests for an agent and write results back to `brief.json` so the dashboard can display them.

## Eval Strategy — Four Runners

| Runner | Method | When | Speed | Reliability |
|--------|--------|------|-------|-------------|
| **Direct Line** | `tools/direct-line-test.js` | Default — agent has no user-delegated MCP tools | Fast (~2s/test) | High (auto-token, retry, refresh) |
| **Direct Line + Interactive** | `tools/direct-line-test.js --interactive` | Agent requires OAuth sign-in (opens browser, prompts for validation code) | ~30s/test + user input | High (handles auth cards) |
| **CopilotStudio SDK** | `tools/copilotstudio-test.js` | Alternative — streaming, Activity type safety, auto-discovery from workspace | ~3s/test | High (official MS SDK) |
| **Power CAT Kit** | `tools/powercat-test.js` | Enterprise server-side validation via Dataverse bound action | Slow (server-side) | Very high (MCS scoring engine) |
| **MCS Native Eval** | Gateway API (`island-client.js upload-evals` + `run-eval`) | Agent uses MCP/user-delegated tools, or user preference | User-driven | High (MCS scoring engine) |

**Auto-detection:** If agent uses MCP or user-delegated tools → manual mode (MCS Native Eval). Otherwise → Direct Line auto mode. User can override with `--sdk` (CopilotStudio SDK), `--powercat` (Power CAT Kit), or `--native` (MCS Native Eval).

## Build Discipline — Verify Then Mark

This skill has three separate sub-tasks. Each must be tracked and verified independently because combining upload + run + write makes failures harder to diagnose.

| Sub-task | What it does | How to verify |
|----------|-------------|--------------|
| **Upload eval sets** | Upload to MCS via Gateway API (manual mode) or prepare Direct Line (auto mode) | Gateway API returns setId / Direct Line token acquired |
| **Run evaluation** | Execute tests via Direct Line or Gateway API `run-eval` | Results JSON exists with scores |
| **Write results** | Update evalSets[].tests[].lastResult in brief.json | Read brief.json back |

## Input

```
/mcs-eval {projectId} {agentId}                    # Run all eval sets
/mcs-eval {projectId} {agentId} --set boundaries,quality  # Run specific sets
/mcs-eval {projectId} {agentId} --native           # Force Tier 3 (native MCS eval)
/mcs-eval {projectId} {agentId} --check-results    # Check pending native eval results
```

Reads from:
- `Build-Guides/{projectId}/agents/{agentId}/brief.json` — evalSets array + buildStatus
- `Build-Guides/{projectId}/agents/{agentId}/evals-*.csv` — if already generated (for native eval only)

Writes to:
- `Build-Guides/{projectId}/agents/{agentId}/evals-{setName}.csv` — per-set CSVs (generated from evalSets for native eval)
- `Build-Guides/{projectId}/agents/{agentId}/evals-results.json` — raw test results
- `Build-Guides/{projectId}/agents/{agentId}/brief.json` — `evalSets[].tests[].lastResult` updated per test

## Prerequisites: Auth Verification

Re-verify auth established during `/mcs-build`. Quick check — confirm account, environment, and API access still work.

1. Read `brief.json.buildStatus`: `azTenantId`, `accountId`, `environment`, `dataverseUrl`
2. If `azTenantId` or `dataverseUrl` missing → "Run `/mcs-build` first to establish auth and build context."
3. **Confirm environment with user**: Log `"Using: {account} / {environment}"` — one-line confirmation. User can say "switch to [env]" to re-target.
4. **Azure CLI check**: `az account show --query tenantId -o tsv`
   - **Match** → proceed
   - **Mismatch** → `az login --tenant {azTenantId}` (browser popup)
5. **Dataverse reachable check**: `az account get-access-token --resource <dataverseUrl>` → must succeed
   - If token fails → auth is stale, re-run `az login`
6. **PAC CLI check** (best-effort): `pac auth list` — if fails, log warning and continue (PAC CLI optional)

## Before Evaluating — Knowledge Cache + Learnings Check

1. Read `knowledge/cache/eval-methods.md` — check `last_verified` date
2. If stale (> 3 days), refresh: WebSearch + MS Learn for "Copilot Studio evaluation"
3. Read `knowledge/learnings/eval-testing.md` (if non-empty) — check for:
   - Eval method insights (which methods work best for which scenario types)
   - Threshold calibration findings (e.g., "GeneralQuality scores vary 20+ points — not reliable for strict thresholds")
   - Test design lessons (e.g., "Multi-turn scenarios need context setup in first message")
4. Update cache if new findings

## Step 1: Load Eval Sets & Determine Scope

Read `brief.json.evalSets[]`. If empty or missing → **exit:** "Run `/mcs-research` first — no eval sets found."

**Determine which sets to run:**
- Default (no `--set` flag): run ALL sets
- `--set boundaries,quality`: run only named sets
- Skip sets with zero tests

**Generate per-set CSVs** for dashboard download/reference (NOT for upload — upload uses Gateway API):

```csv
Question,Expected response,Testing method
```

One CSV per eval set: `evals-boundaries.csv`, `evals-quality.csv`, `evals-edge-cases.csv`, etc.

Generation rules:
- Each test becomes one CSV row in its set's CSV
- `Testing method` = first method from the test's resolved methods (display name)
- Max 100 questions per CSV (MCS limit)
- CSVs are for dashboard download and reference only — Gateway API handles upload to MCS

**VERIFY:** Eval sets loaded, target sets identified, test count > 0.

## Step 1.5: Auto-Mode Detection

Before acquiring tokens, check if the agent supports Direct Line eval:

**Decision logic:**
- Read `brief.json.integrations[]` — check for MCP servers with user-delegated auth
- If agent uses MCP/user-delegated tools (Outlook, Calendar, Teams, SharePoint):
  - Log: `"Agent uses MCP/user-delegated tools — Direct Line cannot authenticate users for these. Using manual mode (MCS Native Eval)."`
  - Jump to **Step 3 alt: Manual Mode**
- If no user-delegated tools:
  - Proceed with Direct Line token acquisition (Step 2)

**Manual override:** User can force mode with `--manual` or `--auto`.

## Step 2: Acquire Direct Line Token (Tier 1 Preparation)

Try these sources in order. Stop at first success:

### Try 1: Cached token from previous run
- Read `brief.json.buildStatus.directLineToken`
- If present AND `brief.json.buildStatus.tokenAcquiredAt` is < 30 min ago, use it
- Otherwise continue to Try 2

### Try 2: Token Endpoint (preferred — no secret needed)
- Read `brief.json.buildStatus.tokenEndpoint` for the URL
- If not in brief, check MCS: Copilot Studio → Channels → Mobile app → Token Endpoint
- GET request to the Token Endpoint URL returns `{ Token, Expires_in, ConversationId }`
- Cache the token endpoint URL in `brief.json.buildStatus.tokenEndpoint` for future runs
- Pass to the test runner via `--token-endpoint <URL>`

### Try 3: Dataverse bound action
- Use `tools/dataverse-helper.ps1` to call `PvaGetDirectLineEndpoint` bound action on the bot entity
- Requires PAC CLI auth to be active for the correct environment

### Try 4: Ask user (last resort)
- Ask user to provide token from MCS UI: Settings → Security → Web channel security → Copy token

### All failed → Fall back to Manual Mode
- Log: "Could not acquire Direct Line token. Switching to manual mode — generating test cases for MCS Native Eval."

## Step 3: Run Tests — Tier 1 (Direct Line API)

Run the hardened Direct Line test runner:

```bash
# With Token Endpoint (auto-acquires and refreshes token)
node tools/direct-line-test.js --token-endpoint "<URL>" --csv "Build-Guides/{projectId}/agents/{agentId}/evals.csv" --verbose

# With manual token
node tools/direct-line-test.js --token "<TOKEN>" --csv "Build-Guides/{projectId}/agents/{agentId}/evals.csv" --verbose

# With custom timeout (for agents with slow tool calls)
node tools/direct-line-test.js --token-endpoint "<URL>" --csv "evals.csv" --timeout 90000 --verbose
```

### Handle Partial Results

If the runner exits with code 2 (fatal error) and writes partial results:
1. Read `evals-results.json` — check `status` field
2. If `status: "partial"`:
   - Check `summary.executed` vs `summary.total`
   - If > 50% completed → report partial results, note remaining tests
   - If < 50% completed → fall back to manual mode
3. If `status: "error"` (no tests ran) → fall back to manual mode

### Results

Results saved to `Build-Guides/{projectId}/agents/{agentId}/evals-results.json`:
```json
{
  "status": "complete",
  "summary": { "total": 10, "executed": 10, "passed": 8, "failed": 2, "remaining": 0, "passRate": "80%" },
  "method": "DirectLine",
  "results": [
    { "question": "...", "expectedResponse": "...", "actualResponse": "...", "pass": true, "score": 85 }
  ]
}
```

## Step 3 alt A: CopilotStudio SDK Runner

Alternative to Direct Line when SDK-based testing is preferred (streaming, Activity types, workspace auto-discovery).

**Prerequisites:** `npm install @microsoft/agents-copilotstudio-client @microsoft/agents-activity @azure/msal-node` (optional — lazy-loaded with install prompt).

```bash
# Auto-discover from agent workspace
node tools/copilotstudio-test.js --agent-dir "Build-Guides/{projectId}/agents/{agentId}" --brief brief.json

# Manual config
node tools/copilotstudio-test.js --env <environmentId> --agent <schemaName> --tenant <tenantId> --brief brief.json
```

Token acquisition: MSAL interactive auth → `https://api.powerplatform.com/.default` scope, with `az CLI` fallback.

## Step 3 alt B: Power CAT Kit Runner

Enterprise server-side testing via Dataverse. Requires the Power CAT Copilot Studio Kit solution installed in the environment.

```bash
# List available configurations
node tools/powercat-test.js list-configs --env <dataverseUrl>

# List test sets for a config
node tools/powercat-test.js list-sets --env <dataverseUrl> --config-id <guid>

# Run tests (creates run, executes via bound action, polls, downloads results)
node tools/powercat-test.js run --env <dataverseUrl> --config-id <guid> --set-id <guid> --threshold 0.85

# Download results for a previous run
node tools/powercat-test.js results --env <dataverseUrl> --run-id <guid> --csv results.csv
```

Results are tracked in Dataverse (`cat_copilottestruns`, `cat_copilottestresults`). Use `--brief <path>` to write run metadata to `brief.json.powerCatRuns[]`.

## Step 3 alt C: Manual Mode (MCS Native Eval via Gateway API)

**Use when:** Agent uses MCP/user-delegated tools, Direct Line token acquisition fails, or user requests.

### Upload Eval Sets via Gateway API (fully headless)

Upload eval sets to MCS Evaluation tab via the Island Gateway `makerevaluations` endpoint. This creates proper EvaluationSet + EvaluationData records with correct parent linking (which raw Dataverse POST cannot do).

**Step 1: Upload eval sets from brief.json:**
```bash
node tools/island-client.js upload-evals \
  --env <buildStatus.environmentId> \
  --bot <buildStatus.mcsAgentId> \
  --brief "Build-Guides/{projectId}/agents/{agentId}/brief.json"
```

This command:
1. Reads `evalSets[]` from brief.json
2. For each eval set, creates an EvaluationSet with graders via `POST /api/botmanagement/v2/environments/{envId}/bots/{botId}/makerevaluations/testcomponent?ApplyV2Migration=true`
3. Creates EvaluationData rows for each test with `parentBotComponentId` linking to the set
4. Returns the `setId` for each uploaded set — persisted to `brief.json.evalSets[].mcsSetId`

**Grader mapping (brief method names to Gateway API graders):**

| Brief Method | Gateway Grader |
|-------------|----------------|
| General quality | `GeneralQualityGrader` |
| Compare meaning | `CompareMeaningGrader` (with `threshold` parameter) |
| Keyword match (all) | `ContainsAllGrader` |
| Keyword match (any) | `ContainsAnyGrader` |
| Exact match | `ExactMatchGrader` |
| Text similarity | `TextSimilarityGrader` |

**Step 2: Run evaluation for each set:**
```bash
node tools/island-client.js run-eval \
  --env <buildStatus.environmentId> \
  --bot <buildStatus.mcsAgentId> \
  --set-id <mcsSetId>
```

This calls `POST /api/botmanagement/v2/environments/{envId}/bots/{botId}/makerevaluations?ApplyV2Migration=true` with `testSetId` to trigger the MCS scoring engine.

**Step 3: Check results:**
- Poll for completion or tell user to check MCS Evaluation tab
- Results appear in MCS UI under the Evaluation tab for each set

After upload + run, report: "Uploaded {N} eval sets ({M} total tests) to MCS Evaluation tab. Evaluation is running — check the Evaluation tab for results, or re-run `/mcs-eval --check-results` to pull scores."

### MCP Agent Manual Test Instructions

For agents with MCP/user-delegated tools where Gateway API eval run isn't sufficient (e.g., tests require user-delegated tool responses), present a test table:

```
## Manual Test Cases: {Agent Name}

Test in MCS Test Chat (you must be signed in with appropriate permissions for MCP tools).

| # | Question | Expected Response | Set | Pass? |
|---|----------|-------------------|-----|-------|
| 1 | [question] | [expected keywords/meaning] | boundaries | |
| 2 | [question] | [expected keywords/meaning] | quality | |

After testing, report results or run the evaluation from the MCS Evaluation tab (test cases are pre-loaded via Gateway API).
```

### Results (Manual Mode)

For Gateway API-uploaded tests, the user runs the eval in MCS and reports results.
For manual Test Chat testing, the user reports pass/fail per test.

Write results to `brief.json.evalSets[].tests[].lastResult` when the user provides them:
```json
{
  "lastResult": {
    "pass": true,
    "actual": "[user-reported response]",
    "score": null,
    "timestamp": "2026-03-06T...",
    "method": "MCSNativeEval"
  }
}
```

## Step 4: Write Results to brief.json

After evaluation completes (any tier), update `brief.json.evalSets[].tests[].lastResult` for each test that was run:

```json
{
  "lastResult": {
    "pass": true,
    "actual": "Here are your high-priority items...",
    "score": 85,
    "timestamp": "2026-02-18T14:30:00Z"
  }
}
```

Do NOT write a flat `evalResults` field — results live per-test in their eval set.

Also cache the token endpoint URL if we discovered it:
```json
{
  "buildStatus": {
    "tokenEndpoint": "<URL>",
    "directLineToken": "<TOKEN>",
    "tokenAcquiredAt": "2026-02-18T14:25:00Z"
  }
}
```

**VERIFY:** Read brief.json back. Confirm each test in the run sets has a `lastResult` with `pass`, `actual`, and `timestamp`.

### Step 4.5: GPT Dual Scoring (Borderline Tests — 4 Semantic Methods)

For tests with borderline scores (within 15 points of the pass/fail threshold), the eval runner uses GPT-enhanced async scoring automatically. Four semantic methods now support dual scoring:

| Method | Async Variant | Dual Scoring |
|--------|--------------|-------------|
| Compare meaning | `semanticSimilarityAsync` | Yes — heuristic + GPT, stricter wins |
| General quality | `qualityScoreAsync` | Yes — heuristic + GPT, stricter wins |
| Text similarity | `textSimilarityAsync` | Yes — heuristic + GPT, stricter wins |
| Tool use | `toolUseAsync` | Yes — heuristic + GPT, stricter wins |
| Exact match | (sync only) | No — deterministic, no LLM needed |
| Keyword match | (sync only) | No — deterministic, no LLM needed |
| Plan validation | (sync only) | No — deterministic, no LLM needed |

**When dual scoring activates:** `evaluateAllMethodsAsync()` routes CompareMeaning, GeneralQuality, TextSimilarity, and ToolUse through their async variants. Each runs heuristic + GPT in parallel, merges with `_mergeScores()` (stricter/lower score wins). >20pt divergence = flagged.

For additional borderline review, fire the CLI scorer:
```bash
node tools/multi-model-review.js score --actual "<response>" --expected "<expected>" --method compare-meaning
```

**Merge protocol:** Lower score wins. If GPT and Claude scores diverge by >20 points, flag the test as "borderline — manual review recommended" in `lastResult.notes`.

**Never block on GPT** — if unavailable, use Claude's score alone.

## Step 5: Report Results

```
## Evaluation Results: {Agent Name}

**Method:** {Direct Line API | MCS Native Eval | Manual Test Chat}
**Sets run:** {set names}
**Overall:** {X}/{Y} passed ({Z}%)

**Per-Set Results:**
| Set | Passed | Total | Rate | Target | Status |
|-----|--------|-------|------|--------|--------|
| boundaries | X | Y | Z% | 100% | PASS/FAIL |
| quality | X | Y | Z% | 85% | PASS/FAIL |
| edge-cases | X | Y | Z% | 80% | PASS/FAIL |

**Failed Cases:**
| Set | Question | Expected | Got | Issue |
|-----|----------|----------|-----|-------|
| [set] | [input] | [expected] | [actual] | [analysis] |

**Recommendations:**
- [If critical failures] STOP — fix boundary issues before anything else
- [If knowledge gap] Update knowledge sources
- [If boundary fail] Strengthen instructions
- [If routing fail] Expand trigger phrases / routing rules

**Files Updated:**
- brief.json → evalSets[].tests[].lastResult updated
- evals-results.json → raw results saved
```

## Quality Standards

- **Boundaries set must pass 100%** — hard stop if any boundaries test fails because boundary failures are non-negotiable
- **Quality set at 85%+** covers happy paths, grounding, routing, and tool integration
- **Edge-cases set at 80%+** covers edge cases, graceful failure, and cross-cutting scenarios
- **Re-run eval after any agent changes** — instructions, knowledge, tools
- **GeneralQuality evals have variance** — run multiple times for confidence

## Post-Eval Learnings Capture (Two-Tier)

After reporting results, run the two-tier learnings capture.

### Tier 1: Auto-Capture (no user confirmation)

- **All-pass runs:** If 100% pass rate, auto-bump `confirmed` count for any `eval-testing.md` entries whose tags overlap with the eval methods used (e.g., if Direct Line was used and a learning about Direct Line exists, bump it).
- **Confirmed thresholds:** If passing scores matched expectations from prior learnings, bump those entries.
- **Token method success:** If Token Endpoint worked, bump any learnings about token acquisition.
- Update `knowledge/learnings/index.json` silently.

### Tier 2: User-Confirmed Capture (when failures exist)

Only capture if there are actual insights — don't log routine passes.

**What to capture:**
- **Eval method insights**: "Compare meaning with 70% was too lenient for boundary tests — Keyword match (all) caught violations that Compare meaning missed"
- **Failure patterns**: "All boundary-decline tests failed because instructions didn't explicitly say 'I cannot do that'"
- **Scoring calibration**: "GeneralQuality scores varied 20+ points across runs — not reliable for strict thresholds"
- **Test design lessons**: "Multi-turn scenarios need context setup in the first message or agent loses context"
- **Tier comparison**: "Test Chat produced scores within 5 points of Direct Line for the same test set"
- **Token acquisition**: "Token Endpoint was the most reliable method — no manual steps needed"

**Before writing, run the comparison engine** (see CLAUDE.md "Learnings Protocol" section B):
1. Check `index.json` for entries with overlapping tags
2. Same pattern → BUMP (Tier 1); new pattern → present to user; contradiction → FLAG

**Generate summary (only if there are Tier 2 insights):**

```markdown
## Eval Learnings: [Agent Name] — [Date]

### Failure Analysis Patterns
| Pattern | Affected Tests | Root Cause | Category | Action |
|---------|---------------|------------|----------|--------|
| [pattern] | [N] tests | [why] | eval-testing / instructions | ADD / BUMP et-001 |

### Method/Threshold Insights
| Insight | Category | Action |
|---------|----------|--------|
| [what we learned] | eval-testing | ADD / BUMP |
```

Present to user. If confirmed, write to `knowledge/learnings/{category}.md` and update `index.json`.

---

## Agent Teams

| Step | Teammates |
|------|-----------|
| 1-4: Load, detect mode, run tests, write results | Lead only |
| 5: Analyze failures (when any set fails threshold) | Lead + **QA Challenger** |

QA Challenger is dispatched on-demand when eval results show failures. QA classifies root causes and suggests targeted fixes. No teammates needed for passing eval runs.

---

## Progress Markers (Headless Skill Runner UI)

When this skill is invoked via the app's headless skill runner (not the interactive terminal), emit structured progress markers so the frontend can show eval progress. Print each marker on its own line — the skill runner parses them from terminal output.

**Emit at each step transition:**
```
##PROGRESS## {"step":"load","label":"Loading eval sets","status":"running"}
##PROGRESS## {"step":"load","label":"Loading eval sets","status":"completed","detail":"3 sets, 25 tests"}
##PROGRESS## {"step":"detect","label":"Auto-detecting mode","status":"running"}
##PROGRESS## {"step":"detect","label":"Auto-detecting mode","status":"completed","detail":"Direct Line API"}
##PROGRESS## {"step":"token","label":"Acquiring test token","status":"running"}
##PROGRESS## {"step":"token","label":"Acquiring test token","status":"completed"}
##PROGRESS## {"step":"run","label":"Running tests","status":"running","detail":"0/25 complete"}
##PROGRESS## {"step":"run","label":"Running tests","status":"running","detail":"15/25 complete"}
##PROGRESS## {"step":"score","label":"Scoring results","status":"running"}
##PROGRESS## {"step":"write","label":"Writing results","status":"running"}
##PROGRESS## {"step":"report","label":"Generating report","status":"running"}
```

**On auth requirement (OAuth, token refresh):**
```
##AUTH_REQUIRED## {"system":"Direct Line","instructions":"Token endpoint requires re-authentication"}
```

**On completion:**
```
##SKILL_COMPLETE## {"success":true,"summary":"Eval complete: boundaries 100%, quality 88%, edge-cases 82%"}
##SKILL_COMPLETE## {"success":false,"summary":"Eval failed: could not acquire Direct Line token"}
```

**Status values:** `"pending"`, `"running"`, `"completed"`, `"failed"`, `"skipped"`

**When to emit:** Print `status:"running"` at the START of each step. Print `status:"completed"` or `"failed"` at the END. Include `detail` for useful context (test counts, pass rates, errors). For long-running test execution, emit periodic `detail` updates with progress counts.

**Always emit these markers**, regardless of whether running headless or interactive.

---

## Important Rules

- **brief.json evalSets is the primary output** — the dashboard reads per-test lastResult from it
- **evals-results.json is the detailed backup** — for debugging
- **Never mark eval complete after only uploading** — run the evaluation and write per-test results because upload alone doesn't produce scores
- **Use QA Challenger** to analyze failures and suggest fixes if any set fails its threshold
- **Manual mode uploads via Gateway API** — CSVs are generated for dashboard download/reference only, not for import
- **Cache the token endpoint URL** in brief.json for future eval runs
- **Per-set pass logic:** each test must pass ALL methods in its set. Scored methods check threshold, binary methods are pass/fail.
