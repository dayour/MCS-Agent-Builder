# Alternative Eval Runners

## CopilotStudio SDK Runner

Alternative to Direct Line when SDK-based testing is preferred (streaming, Activity types, workspace auto-discovery).

**Prerequisites:** `npm install @microsoft/agents-copilotstudio-client @microsoft/agents-activity @azure/msal-node` (optional -- lazy-loaded with install prompt).

```bash
# Auto-discover from agent workspace
node tools/copilotstudio-test.js --agent-dir "Build-Guides/{projectId}/agents/{agentId}" --brief brief.json

# Manual config
node tools/copilotstudio-test.js --env <environmentId> --agent <schemaName> --tenant <tenantId> --brief brief.json
```

Token acquisition: MSAL interactive auth -> `https://api.powerplatform.com/.default` scope, with `az CLI` fallback.

## Power CAT Kit Runner

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

## MCS Native Eval via Gateway API

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
4. Returns the `setId` for each uploaded set -- persisted to `brief.json.evalSets[].mcsSetId`

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
