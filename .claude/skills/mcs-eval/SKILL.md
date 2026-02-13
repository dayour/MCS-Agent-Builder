---
name: mcs-eval
description: Run evaluation tests for an agent. Reads evals from brief.json or evals.csv, runs via Direct Line API (preferred) or MCS native eval (fallback), writes results back to brief.json.
---

# MCS Evaluation Runner

Run evaluation tests for an agent and write results back to `brief.json` so the dashboard can display them.

## BUILD DISCIPLINE — VERIFY-THEN-MARK (MANDATORY)

**This skill has THREE separate sub-tasks. Each must be tracked and verified independently.**

| Sub-task | What it does | How to verify |
|----------|-------------|--------------|
| **Generate CSV** | Write evals.csv to disk (if not present) | Read the file back |
| **Run evaluation** | Execute tests via Direct Line or MCS | Results JSON exists with scores |
| **Write results** | Update brief.json with evalResults | Read brief.json back |

## Input

```
/mcs-eval {projectId} {agentId}
```

Reads from:
- `Build-Guides/{projectId}/agents/{agentId}/brief.json` — evals array + buildStatus
- `Build-Guides/{projectId}/agents/{agentId}/evals.csv` — if already generated
- `Build-Guides/{projectId}/agents/{agentId}/brief.json` — fallback for scenario extraction (step2.scenarios)

Writes to:
- `Build-Guides/{projectId}/agents/{agentId}/evals.csv` — test cases (if not present)
- `Build-Guides/{projectId}/agents/{agentId}/evals-results.json` — raw test results
- `Build-Guides/{projectId}/agents/{agentId}/brief.json` — `evalResults` field updated

## Before Evaluating — Knowledge Cache Check

1. Read `knowledge/cache/eval-methods.md` — check `last_verified` date
2. If stale (> 7 days), refresh: WebSearch + MS Learn for "Copilot Studio evaluation"
3. Update cache if new findings

## Step 1: Ensure evals.csv Exists

Check if `Build-Guides/{projectId}/agents/{agentId}/evals.csv` exists.

**If present:** Read and validate format.
**If absent:** Generate from `brief.json.evals` array:

```csv
"question","expectedResponse","testMethodType","passingScore"
```

**Test method mapping:**
| Source | Method | Score |
|--------|--------|-------|
| Happy path scenarios | `GeneralQuality` or `CompareMeaning` | "70" |
| Boundary DECLINE | `PartialMatch` | "" |
| Boundary REFUSE | `PartialMatch` | "" |
| Specific facts | `PartialMatch` | "" |

**Important:**
- passingScore uses integer format ("70" not "0.7")
- Only `TextSimilarity` and `CompareMeaning` use passingScore
- No "DoesNotContain", "AI", or "Contains" — these don't exist in MCS

**VERIFY:** Read the file back. Confirm row count = header + N test cases. No formatting issues.

## Step 2: Run Evaluation via Direct Line API (Preferred)

**This is the primary eval method. No browser, no Playwright.**

### Get Direct Line Token

Ask user for Direct Line token, OR get from:
- MCS → Settings → Security → Web channel security → Copy token
- Dataverse API: `PvaGetDirectLineEndpoint` bound action

### Run Tests

```bash
node tools/direct-line-test.js --token <DL_TOKEN> --csv "Build-Guides/{projectId}/agents/{agentId}/evals.csv" --verbose
```

### Results

Results saved to `Build-Guides/{projectId}/agents/{agentId}/evals-results.json`:
```json
{
  "summary": { "total": 10, "passed": 8, "failed": 2, "passRate": "80%" },
  "results": [
    { "question": "...", "expectedResponse": "...", "actualResponse": "...", "pass": true, "score": 85 }
  ]
}
```

## Fallback: Native MCS Evaluation (Playwright)

**Only use if Direct Line token is not available.**

### MCS Preflight Gate (MANDATORY)

1. `browser_navigate` to `https://copilotstudio.microsoft.com`
2. `browser_snapshot`
3. Output verification stamp:
   ```
   ## MCS Preflight Check
   - Account: [name]
   - Environment: [name]
   - Target agent: [agent name]
   - Action: Upload evals.csv and run native evaluation

   Is this correct? Please confirm before I proceed.
   ```
4. **WAIT for user confirmation**

### Upload and Run

1. Open the agent → Evaluation tab
2. Click "New evaluation"
3. Upload CSV: `page.locator('input[type="file"]').first().setInputFiles(path)`
4. Wait for upload confirmation
5. **VERIFY:** Snapshot → "Review your test cases (N)" shows expected count
6. Click "Evaluate" → wait for start
7. **VERIFY:** Snapshot shows "Running" status

## Step 3: Write Results to brief.json

After evaluation completes (Direct Line or MCS native), update `brief.json`:

```json
{
  "evalResults": {
    "lastRun": "2026-02-12T14:30:00Z",
    "method": "DirectLine",
    "summary": {
      "total": 10,
      "passed": 8,
      "failed": 2,
      "passRate": "80%"
    },
    "results": [
      {
        "question": "What are my high-priority items?",
        "expected": "prioritized list with due dates",
        "actual": "Here are your high-priority items...",
        "pass": true,
        "score": 85,
        "method": "CompareMeaning"
      }
    ]
  }
}
```

**VERIFY:** Read brief.json back. Confirm `evalResults.summary` matches test results.

## Step 4: Report Results

```
## Evaluation Results: {Agent Name}

**Method:** {Direct Line API | MCS Native}
**Overall:** {X}/{Y} passed ({Z}%)

**By Category:**
| Category | Passed | Total | Rate |
|----------|--------|-------|------|
| Happy Path | X | Y | Z% |
| Boundaries | X | Y | Z% |

**Failed Cases:**
| Question | Expected | Got | Issue |
|----------|----------|-----|-------|
| [input] | [expected] | [actual] | [analysis] |

**Recommendations:**
- [If knowledge gap] Update knowledge sources
- [If boundary fail] Strengthen instructions
- [If routing fail] Expand trigger phrases / routing rules

**Files Updated:**
- brief.json → evalResults written
- evals-results.json → raw results saved
```

## Quality Standards

- **Boundaries should pass at 100%** — fix instructions if they don't
- **Happy path at 70%+** is acceptable — review low scores for patterns
- **Re-run eval after any agent changes** — instructions, knowledge, tools
- **GeneralQuality evals have variance** — run multiple times for confidence

## Post-Eval Learnings Capture

After reporting results, analyze failure patterns for learnings. **Only capture if there are actual insights** — don't log routine passes.

### What to Capture

- **Eval method insights**: "CompareMeaning with 70% was too lenient for boundary tests — PartialMatch caught violations that CompareMeaning missed"
- **Failure patterns**: "All boundary-decline tests failed because instructions didn't explicitly say 'I cannot do that'"
- **Scoring calibration**: "GeneralQuality scores varied 20+ points across runs — not reliable for strict thresholds"
- **Test design lessons**: "Multi-turn scenarios need context setup in the first message or agent loses context"

### Generate Summary (only if there are insights)

```markdown
## Eval Learnings: [Agent Name] — [Date]

### Failure Analysis Patterns
| Pattern | Affected Tests | Root Cause | Fix Applied | Category |
|---------|---------------|------------|-------------|----------|
| [pattern] | [N] tests | [why] | [what was fixed] | eval-testing / instructions |

### Method/Threshold Insights
| Insight | Category |
|---------|----------|
| [what we learned about eval methods/thresholds] | eval-testing |
```

Present to user. If confirmed, write to `knowledge/learnings/eval-testing.md` (or other relevant topic file if the root cause was instructions, knowledge, etc.).

---

## Important Rules

- **brief.json is the primary output** — the dashboard reads evalResults from it
- **evals-results.json is the detailed backup** — for debugging
- **Never mark eval complete after only generating CSV** — must run AND write results
- **Use QA Challenger** to analyze failures and suggest fixes if pass rate is below 70%
