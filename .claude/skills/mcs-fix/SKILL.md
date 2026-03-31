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

**Reads:** `brief.json` — evalSets (tests with lastResult), instructions, integrations, capabilities, conversations.topics
**Writes:** `brief.json` (instructions, conversations.topics, evalSets, notes.fixHistory), agent in MCS (via hybrid stack)

## Prerequisites: Auth Verification

Re-verify auth from `/mcs-build`. Quick silent check — `az account show` must match `buildStatus.azTenantId`, Dataverse must be reachable. If missing → "Run `/mcs-build` first."

## Step 1: Read & Validate Eval Results

1. Read `brief.json.evalSets[]` — scan for `lastResult`
2. No results → **exit:** "Run `/mcs-eval` first."
3. All sets passing → **exit:** "All eval sets passing. Nothing to fix."
4. Output per-set pass rates and failing test count

## Step 2: Classify Failures (Lead + QA)

**Before classification:** read `knowledge/learnings/eval-testing.md`, `instructions.md`, `topics-triggers.md` for known patterns.

**Spawn QA Challenger** with brief data + relevant learnings. QA classifies each failure:

| Root Cause | Signal | Fix Method |
|-----------|--------|-----------|
| **Instruction gap** | Agent doesn't handle the scenario | PE rewrites section |
| **Boundary violation** | Agent should decline but doesn't | PE strengthens boundary |
| **Routing failure** | Wrong topic triggered | TE adjusts triggers |
| **Knowledge gap** | Agent can't find info | Flag for manual update |
| **Scoring issue** | Response is fine, method too strict | Adjust eval criteria |
| **Decision mismatch** | Failure from pre-applied default decision | Flag decision for user review |

**Decision mismatch detection:** When failure involves a tool from a pending `decisions[]` entry's recommended default, flag as decision mismatch — the right action is often to revisit the decision, not patch around the wrong tool.

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
- Eval criteria → local file update (brief.json + regenerate evals.csv)

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

## Gotchas

- **User confirms classification before fixes** — Step 2 waits for approval
- **Knowledge gaps can't be auto-fixed** — flag and skip
- **Never remove existing tests** — adjust thresholds or add new tests instead
- **Publish after fixes** — Direct Line tests the published version
- **Max 2 fix iterations per invocation** — after 2 rounds, exit with "Manual review needed"
- **No working-paper files** — PE and TE outputs are applied directly, not saved as intermediate files
- **Fix history is append-only** — track improvement in `notes.fixHistory[]`
