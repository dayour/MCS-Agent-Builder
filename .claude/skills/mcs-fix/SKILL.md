---
name: mcs-fix
description: Analyze eval failures, classify root causes, apply fixes (instructions/topics/evals), and re-evaluate. Uses PE + TE + QA teammates. Closes the eval→fix→re-eval loop.
---

# MCS Fix — Post-Eval Fix & Re-Evaluate

Analyze eval failures from `/mcs-eval`, classify root causes, generate and apply targeted fixes, then re-evaluate to measure improvement. This skill closes the eval→fix→re-eval loop that was previously manual.

## Input

```
/mcs-fix {projectId} {agentId}
```

**Reads:** `Build-Guides/{projectId}/agents/{agentId}/brief.json` — evalResults, instructions, integrations, capabilities, conversations.topics
**Writes:** `brief.json` (instructions, conversations.topics, notes.fixHistory), agent in MCS (via hybrid stack)

## Step 1: Read & Validate Eval Results (Lead)

1. Read `brief.json.evalResults` — must exist with at least 1 failure
2. If no `evalResults` → **exit:** "Run `/mcs-eval` first — no eval results found."
3. If 100% pass → **exit:** "All evals passing. Nothing to fix."
4. Output summary:

```
## Fix: {Agent Name}

**Eval results:** {X}/{Y} passed ({Z}%)
**Failures:** {Y-X} test cases to analyze

Proceeding to classify failures...
```

## Step 2: Classify Failures (Lead + QA)

Spawn **QA Challenger** to analyze each failed test case. Provide QA with:
- `brief.json.evalResults` (full results including question, expected, actual, score)
- `brief.json.instructions` (current instructions)
- `brief.json.conversations.topics[]` (current topic list)
- `brief.json.integrations[]` (configured tools)
- `brief.json.knowledge[]` (knowledge sources)

QA classifies each failure into one of 5 root cause categories:

| Root Cause | Signal | Fix Method |
|-----------|--------|-----------|
| **Instruction gap** | Agent doesn't handle the scenario at all | PE rewrites affected instruction section |
| **Boundary violation** | Agent should decline/refuse but doesn't | PE strengthens boundary language |
| **Routing failure** | Wrong topic triggered, or no topic matched | TE adjusts trigger phrases or adds topic |
| **Knowledge gap** | Agent can't find the information | Flag for manual knowledge update (can't auto-add) |
| **Scoring issue** | Response is actually fine, eval method too strict | Adjust eval criteria (passingScore, method type) |

QA outputs a fix plan: which failures, what category, what to change.

**Output the classification to user and WAIT for approval before proceeding:**

```
## Failure Classification

| # | Test Case | Root Cause | Proposed Fix |
|---|-----------|-----------|-------------|
| 1 | [question summary] | Instruction gap | PE: add handling for [scenario] |
| 2 | [question summary] | Routing failure | TE: add trigger phrases for [topic] |
| 3 | [question summary] | Knowledge gap | Manual: add [source] to knowledge |
| 4 | [question summary] | Scoring issue | Lower passingScore from 70 to 60 |

Knowledge gaps (#{list}) require manual updates — these will be skipped.

Proceed with fixes for #{fixable count} items?
```

## Step 3: Generate Fixes (PE + TE + QA, parallel where possible)

Based on QA's classification, generate fixes in parallel:

### Instruction Fixes — Prompt Engineer

Spawn **Prompt Engineer** when QA identified `instruction gap` or `boundary violation` failures. Provide PE with:
- Current instructions from `brief.json.instructions`
- Failed test cases with QA's analysis (only the instruction-related ones)
- `brief.json.integrations[]` (for tool reference validation)
- `brief.json.capabilities[]` (for scope validation)

PE produces:
- Revised instructions draft (or targeted delta for specific sections)
- Self-verification: char count < 8000, all referenced tools exist in integrations[], boundaries intact

### Topic Fixes — Topic Engineer

Spawn **Topic Engineer** when QA identified `routing failure` failures. Provide TE with:
- Current topic list from `brief.json.conversations.topics[]`
- Failed routing test cases with QA's analysis
- `knowledge/patterns/yaml-reference.md` for YAML syntax
- `knowledge/cache/triggers.md` for trigger options

TE produces:
- Revised topic YAML (new trigger phrases, adjusted descriptions for "by agent" routing, new topic if needed)
- TE runs validation checklist (node types, card limits, variable flow)

### Scoring Fixes — Lead

For `scoring issue` failures:
- Adjust `evals.csv` entries — change `testMethodType` or `passingScore`
- Update corresponding `brief.json.evals[]` entries
- **Never remove existing evals** — only adjust method/threshold

### Knowledge Gaps — Skip (Flag Only)

For `knowledge gap` failures:
- Cannot auto-fix — knowledge sources require manual addition in MCS
- Output: "These failures require manual knowledge updates: [list]. Add knowledge sources in MCS, then re-run `/mcs-eval`."

### QA Reviews Fixes

After PE and TE produce their outputs, **QA Challenger** reviews both:
- PE output: verify revised instructions don't break existing passing scenarios
- TE output: verify YAML syntax, trigger phrases don't collide with existing topics

## Step 4: Apply Fixes (Lead — hybrid build stack)

Same tool priority as `/mcs-build`:

| Fix Type | Tool | Method |
|----------|------|--------|
| Instructions | Dataverse API | Update instructions field via `knowledge/patterns/dataverse-patterns.md` |
| Topics | Code Editor YAML via Playwright | Paste revised YAML into code editor |
| Trigger phrases | Code Editor YAML via Playwright | Update topic YAML |
| Eval criteria | Local file | Rewrite `evals.csv` + `brief.json.evals[]` |

**Preflight Gate required** before any Playwright interaction — same as `/mcs-build`.

**Apply fixes in order:**
1. Instructions (Dataverse API — no browser needed)
2. Topics/triggers (Playwright — batch all topic changes in one browser session)
3. Eval criteria (local files — no MCS interaction)

**Publish** after all MCS fixes applied:
```powershell
pac copilot publish --bot <bot-id>
```

**VERIFY:** Snapshot confirms publish date is today.

## Step 5: Re-Evaluate & Compare (Lead)

Re-run eval via Direct Line API (same method as `/mcs-eval` Step 2):
1. Read `evals.csv` (possibly updated with scoring fixes)
2. Run all test cases via `tools/direct-line-test.js`
3. Compare before vs after results

**Output comparison:**

```
## Fix Results: {Agent Name}

**Before:** {X}/{Y} passed ({Z}%)
**After:** {X'}/{Y'} passed ({Z'}%)
**Improvement:** +{delta} percentage points

| Test Case | Before | After | Fix Applied |
|-----------|--------|-------|-------------|
| [question] | FAIL (45) | PASS (82) | Strengthened boundary in instructions |
| [question] | FAIL (30) | FAIL (55) | Knowledge gap — needs manual KB update |
| [question] | FAIL (70) | PASS (85) | Added trigger phrases for topic |

{If still below 70%: "Some failures remain. Review knowledge gaps above, then re-run /mcs-fix."}
{If >= 70%: "Agent meets quality bar. Consider /mcs-eval for a full re-run to confirm."}
```

**Write results:**

1. Update `brief.json.evalResults` with new results
2. Append to `brief.json.notes.fixHistory[]`:

```json
{
  "date": "2026-02-17T...",
  "beforePassRate": "60%",
  "afterPassRate": "85%",
  "fixesApplied": [
    "instructions: strengthened boundary for decline scenarios",
    "topic: added trigger phrases for order-status",
    "eval: adjusted passingScore for edge-case-3 from 70 to 60"
  ]
}
```

3. Write updated `evals-results.json` with the new Direct Line results

---

## Agent Teams

| Step | Teammates |
|------|-----------|
| 1: Read & validate | Lead only |
| 2: Classify failures | Lead + **QA Challenger** |
| 3: Generate fixes | **Prompt Engineer** (instructions) + **Topic Engineer** (topics) — parallel. **QA Challenger** reviews both outputs. |
| 4: Apply fixes | Lead only (MCS execution via hybrid stack) |
| 5: Re-evaluate & compare | Lead only (Direct Line API) |

**Max teammates:** 3 (PE + TE + QA)
**Typical:** 2 (PE + QA when only instruction fixes needed, or TE + QA when only routing fixes)

---

## Important Rules

- **User confirms classification before fixes** — Step 2 outputs the plan and waits for approval
- **Knowledge gaps can't be auto-fixed** — flag and skip, don't attempt to add knowledge sources programmatically
- **Never remove existing evals** — scoring fixes adjust method/threshold, never delete test cases
- **Publish after fixes** — agent must be re-published before re-eval (Direct Line tests the published version)
- **Fix history is append-only** — track improvement over iterations in `notes.fixHistory[]`
- **Max 2 fix iterations per invocation** — if still failing after 2 rounds of fix→re-eval, exit with "Manual review needed. Remaining failures may require knowledge updates or architectural changes."
- **brief.json is THE source of truth** — all fixes update brief.json fields, not separate files
- **Preflight Gate for Playwright** — same rules as `/mcs-build` for any browser interaction
- **Environment check** — verify PAC CLI profile matches agent's environment before publishing
- **No working-paper files** — PE and TE outputs are applied directly to brief.json and MCS. No intermediate files left behind.

---

## Post-Fix Learnings Capture

After Step 5, check if there are learnings worth capturing:

- **Recurring failure patterns** — same root cause appearing across multiple agents? Write to `knowledge/learnings/eval-testing.md`
- **Instruction patterns** — PE discovered a better way to phrase boundaries? Write to `knowledge/learnings/instructions.md`
- **Topic/trigger insights** — TE found trigger phrase patterns that improve routing? Write to `knowledge/learnings/topics-triggers.md`

Only capture if there's something genuinely new. Skip if the fix was routine.

Present to user for confirmation before writing to learnings files.
