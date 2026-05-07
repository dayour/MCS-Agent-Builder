---
name: mcs-fix
description: "Use this skill to fix an agent after eval failures. Classifies root causes (instruction gaps, boundary violations, routing failures, knowledge gaps, scoring issues, decision mismatches), applies targeted fixes via PE and TE, then re-evaluates. Use after /mcs-eval shows failures, not during initial build (which has its own fix loop)."
---

# MCS Fix — Post-Eval Fix & Re-Evaluate

Analyze eval set failures from `/mcs-eval`, classify root causes, generate and apply targeted fixes, then re-evaluate to measure improvement.

## Input

```
/mcs-fix {projectId} {agentId}
```

**Reads:** `agentspec.json` — evalSets (tests with lastResult), instructions, integrations, capabilities, conversations.topics
**Writes:** `agentspec.json` (instructions, conversations.topics, evalSets, notes.fixHistory), agent in MCS (via hybrid stack)

## Prerequisites: Auth Verification

Re-verify auth from `/mcs-build`. Quick silent check — `az account show` must match `buildStatus.azTenantId`, Dataverse must be reachable. If missing → "Run `/mcs-build` first."

## Step 1: Read & Validate Eval Results

1. Read `agentspec.json.evalSets[]` — scan for `lastResult`
2. No results → **exit:** "Run `/mcs-eval` first."
3. All sets passing → **exit:** "All eval sets passing. Nothing to fix."
4. Output per-set pass rates and failing test count

## Step 2: Classify Failures (Lead + QA + eval-guide plugin)

**Before classification — query claude-mem for similar past failures:**
For each failing test, vector-search claude-mem on `(test.question + agent.capability + lastResult.actualOutput tail)`. If a prior project hit the same failure pattern and was resolved (fix recorded in `notes.fixHistory[]` or learnings), surface that fix as a candidate before classifying. This is the cross-project recall that MEMORY.md doesn't provide — claude-mem captures raw test transcripts.

**Then read learnings:** `knowledge/learnings/eval-testing.md`, `instructions.md`, `topics-triggers.md` for known patterns.

**Then the lead invokes eval-guide plugin `/eval-triage-and-improvement`** for interactive triage (teammates lack Skill tool access — the lead runs the plugin and shares classifications with QA). The plugin applies the 5-question eval verification sequence (is the eval wrong before blaming the agent?) and classifies each failure into one of 3 root cause types:

| Root Cause Type | Signal | Fix Method |
|----------------|--------|-----------|
| **Eval Setup Issue** | Response is acceptable but grader rejects | Adjust eval criteria/expected values |
| **Agent Configuration Issue** | Agent genuinely produced bad response | PE/TE fix (see sub-classification below) |
| **Platform Limitation** | Persists across config variations | Document and workaround |

**Agent Configuration sub-classification** (when root cause = Agent Configuration):

| Sub-Cause | Signal | Fix Method |
|-----------|--------|-----------|
| **Instruction gap** | Agent doesn't handle the scenario | PE rewrites section |
| **Boundary violation** | Agent should decline but doesn't | PE strengthens boundary |
| **Routing failure** | Wrong topic triggered | TE adjusts triggers |
| **Knowledge gap** | Agent can't find info | Flag for manual update |
| **Decision mismatch** | Failure from pre-applied default decision | Flag decision for user review |

**Decision mismatch detection:** When failure involves a tool from a pending `decisions[]` entry's recommended default, flag as decision mismatch — the right action is often to revisit the decision, not patch around the wrong tool.

**Also spawn QA Challenger** for cross-reference validation and independent challenge of the plugin's classification.

**Output classification and WAIT for user approval before proceeding.**

## Step 3: Generate Fixes (PE + TE + QA parallel)

### Instruction Fixes — Prompt Engineer
Spawn PE for `instruction gap` and `boundary violation` failures. PE uses dual model co-generation (`generate-instructions`). PE produces revised instructions (or delta), self-verifies: char count < 8000, no anti-patterns, all referenced tools exist.

### Topic Fixes — Topic Engineer
Spawn TE for `routing failure` failures. TE uses dual model co-generation for complex fixes. TE validates via `om-cli validate` + `semantic-gates.py`.

### Scoring Fixes — Lead
Adjust `methods[]` or `passThreshold`. Move tests between sets if misclassified. **Never remove existing tests** — only adjust thresholds or add new tests.

### Decision Mismatch — Escalate to User
Present the decision entry from `decisions[]`, show which default was applied, why it failed, and ask the user to reconsider the decision. If user picks a different option → update `decisions[]` selection and re-apply the component change (may require tool swap, connector change, etc.). Do not patch around a wrong decision — fix the decision itself.

### Knowledge Gaps — Skip
Flag and skip: "These failures require manual knowledge updates: [list]. Add sources in MCS, then re-run `/mcs-eval`."

### QA Reviews Fixes
QA reviews PE and TE outputs: verify instructions don't break passing scenarios, verify YAML syntax and trigger phrase collisions.

**GPT review:** Fire `review-instructions` after QA and before applying. Catches regressions. Merge with QA (union, stricter wins).

## Step 4: Apply Fixes (Lead)

Same tool priority as `/mcs-build`:
- Instructions → LSP push (`mcs-lsp.js`), fallback Dataverse PATCH
- Topics/triggers → write `.mcs.yml` to workspace, LSP push
- Eval criteria → local file update (agentspec.json + regenerate evals.csv)

Apply in order: instructions → topics → eval criteria. **Publish** after MCS fixes, verify via `synchronizationstatus`.

## Step 5: Re-Evaluate & Compare

Re-run via `tools/direct-line-test.js`. Compare before vs after:

```
## Fix Results: {Agent Name}

**Before:** {X}/{Y} ({Z}%) | **After:** {X'}/{Y'} ({Z'}%) | **Improvement:** +{delta}pp

| Test Case | Before | After | Fix Applied |
```

Write updated `lastResult` per test. Append to `notes.fixHistory[]`. Write updated `evals-results.json`.

## Post-Fix Learnings

Tier 1 (auto): bump confirmed counts for known patterns. Tier 2 (user-confirmed): capture new failure patterns, instruction insights, topic/trigger discoveries. See `.claude/rules/learnings-system.md` for protocol.

## Step 3.5: Stuck-Fix Protocol (Same Failure After 1 Fix Attempt)

If after applying PE/TE fixes the same test still fails with the same classification, do NOT iterate with another small instruction tweak. Invoke `superpowers` 4-phase debug (mirrors the build-time Step Failure Protocol):

1. **Hypothesize** — enumerate candidate causes for the persistent failure: `instructions-not-loaded`, `published-state-stale`, `topic-not-triggered`, `tool-call-malformed`, `model-context-too-long`, `eval-criteria-mismatch`, `tenant-policy-block`, `direct-line-channel-quirk`.
2. **Reproduce** — invoke the failing scenario via Direct Line outside `/mcs-fix` to confirm determinism. Test the same prompt in MCS test chat to compare channels.
3. **Isolate** — one discriminating test per hypothesis. Example: if "instructions-not-loaded" — Dataverse query GptComponent, confirm latest content is published. If "topic-not-triggered" — check topic trigger phrases vs the test question.
4. **Fix** — targeted fix to the isolated layer. Log to `knowledge/learnings/eval-testing.md` so claude-mem surfaces it on Attempt 1 next time.

If isolation fails in one cycle → escalate to user with hypothesis tree.

## Gotchas

- **User confirms classification before fixes** — Step 2 waits for approval
- **Knowledge gaps can't be auto-fixed** — flag and skip
- **Never remove existing tests** — adjust thresholds or add new tests instead
- **Publish after fixes** — Direct Line tests the published version
- **Max 2 fix iterations per invocation** — after 2 rounds, hand off to Step 3.5 superpowers-debug or exit with "Manual review needed"
- **No working-paper files** — PE and TE outputs are applied directly, not saved as intermediate files
- **Fix history is append-only** — track improvement in `notes.fixHistory[]`
