# Alternative Eval Runners

> **Note (2026-05-05)**: The CopilotStudio SDK runner (`tools/copilotstudio-test.js`)
> and Power CAT Kit runner (`tools/powercat-test.js`) were removed in cleanup PR #21.
> Direct Line (`tools/direct-line-test.js`) and MCS Native Eval via Gateway API
> (below) are now the supported runners. Restore the deleted tools from git
> history (commit `b60da346`) if SDK or Kit-based runs are required.

## MCS Native Eval via Gateway API

**Use when:** Agent uses MCP/user-delegated tools, Direct Line token acquisition fails, or user requests.

### Upload Eval Sets via Gateway API (fully headless)

Upload eval sets to MCS Evaluation tab via the Island Gateway `makerevaluations` endpoint. This creates proper EvaluationSet + EvaluationData records with correct parent linking (which raw Dataverse POST cannot do).

**Step 1: Upload eval sets from agentspec.json:**
```bash
node tools/island-client.js upload-evals \
  --env <buildStatus.environmentId> \
  --bot <buildStatus.mcsAgentId> \
  --brief "Build-Guides/{projectId}/agents/{agentId}/agentspec.json"
```

This command:
1. Reads `evalSets[]` from agentspec.json
2. For each eval set, creates an EvaluationSet with graders via `POST /api/botmanagement/v2/environments/{envId}/bots/{botId}/makerevaluations/testcomponent?ApplyV2Migration=true`
3. Creates EvaluationData rows for each test with `parentBotComponentId` linking to the set
4. Returns the `setId` for each uploaded set -- persisted to `agentspec.json.evalSets[].mcsSetId`

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

After upload + run, report: "Uploaded {N} eval sets ({M} total tests) to MCS Evaluation tab. Evaluation is running -- check the Evaluation tab for results, or re-run `/mcs-eval --check-results` to pull scores."

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

Write results to `agentspec.json.evalSets[].tests[].lastResult` when the user provides them:
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
