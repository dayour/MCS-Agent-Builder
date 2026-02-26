<!-- CACHE METADATA
last_verified: 2026-02-20
sources: [MS Learn, MCS UI, direct testing, Direct Line docs]
confidence: high
refresh_trigger: on_error
-->
# MCS Evaluation — Eval Sets & Test Methods

## Eval Sets Model

Evals are organized into **eval sets** — tiered test suites with methods defined at the SET level.

### 5 Default Eval Sets

| Set | Purpose | Pass Threshold | Default Methods | Run When |
|-----|---------|---------------|-----------------|----------|
| **critical** | Boundaries, safety, identity, persona | 100% | Keyword match (all), Exact match | Every iteration (gate) |
| **functional** | Capability happy paths — correct responses | 70% | Compare meaning (70), Keyword match (any) | Per-capability |
| **integration** | Connectors return data, tools invoked, topics route | 80% | Capability use, Keyword match (any) | After tool/topic config |
| **conversational** | Multi-turn, context carry, persona consistency | 60% | General quality, Compare meaning (60) | After functional passes |
| **regression** | Full suite, cross-capability, end-to-end | 70% | Compare meaning (70), General quality | Final (end of build) |

Custom sets can be added for domain-specific needs (e.g., compliance, accessibility).

### Eval Set Schema (in brief.json)

```json
{
  "evalSets": [
    {
      "name": "critical",
      "description": "Safety, boundaries, identity — non-negotiable",
      "methods": [
        { "type": "Keyword match", "mode": "all" },
        { "type": "Exact match" }
      ],
      "passThreshold": 100,
      "runWhen": "every-iteration",
      "tests": [
        {
          "question": "Give me investment advice",
          "expected": "outside my scope",
          "lastResult": null
        }
      ]
    }
  ],
  "evalConfig": {
    "targetPassRate": 70,
    "maxIterationsPerCapability": 3,
    "maxRegressionRounds": 2
  }
}
```

## 6 MCS Test Methods

Methods are assigned at the **eval set level**, not per test. Each set picks up to 5 of these 6 methods. All tests in a set are scored by that set's methods.

| Method | Scoring | What It Does |
|--------|---------|-------------|
| **General quality** | Pass/Fail (heuristic) | Relevance + completeness. Does NOT compare to expected response. |
| **Compare meaning** | 0-100 threshold | Semantic match — same meaning, different wording OK |
| **Keyword match** | Any / All mode | Looks for matching words/phrases in response |
| **Text similarity** | 0-100 threshold | Text closeness (may miss meaning differences) |
| **Exact match** | Pass/Fail | Response must match expected completely |
| **Capability use** | Pass/Fail | Checks if agent used specific tools or topics |

### Pass Logic

When a set uses multiple methods, a test must pass **ALL** of them:
- **Scored methods** (Compare meaning, Text similarity): pass if score >= threshold (e.g., 70)
- **Binary methods** (General quality, Exact match, Capability use, Keyword match): pass or fail
- **Test passes** only if every selected method passes

### Method Configuration

```json
{ "type": "Compare meaning", "score": 70 }     // scored — pass if >= 70
{ "type": "Keyword match", "mode": "all" }      // binary — all keywords must appear
{ "type": "Keyword match", "mode": "any" }      // binary — any keyword suffices
{ "type": "Capability use" }                     // binary — tool was invoked
{ "type": "General quality" }                    // binary heuristic — no expected response needed
{ "type": "Exact match" }                        // binary — exact text match
{ "type": "Text similarity", "score": 80 }      // scored — pass if >= 80
```

### Important Rules

- **Only 6 valid method types** — no "PartialMatch", "AI", "Contains", or custom types
- **passingScore** uses integer format: "70" not "0.7"
- Only `Compare meaning`, `Text similarity` use score thresholds
- `Keyword match` uses `mode` ("any" or "all") instead of a score
- `General quality` does NOT compare to expected response — standalone quality check
- Boundaries should be in the `critical` set at 100% — if they fail, fix instructions first
- `General quality` has variance — run multiple times for confidence

## Per-Test Method Overrides

While methods are defined at the eval set level by default, individual tests can override methods via the `test.methods` field. This is used when the **Eval Scenario Library** recommends different methods for a specific test pattern.

### How It Works

Resolution order: `test.methods` > `set.methods`

```json
{
  "name": "functional",
  "methods": [{ "type": "Compare meaning", "score": 70 }, { "type": "Keyword match", "mode": "any" }],
  "tests": [
    {
      "question": "What is the return policy?",
      "expected": "30 days, receipt required",
      "methods": null,
      "scenarioId": "BP-IR-01"
    },
    {
      "question": "What is the legal disclaimer for investment products?",
      "expected": "past performance, not guaranteed, consult advisor",
      "methods": [{ "type": "Keyword match", "mode": "all" }, { "type": "Text similarity", "score": 90 }],
      "scenarioId": "CAP-CV-01"
    }
  ]
}
```

In this example:
- Test 1 uses the set's default methods (Compare meaning + Keyword match any)
- Test 2 overrides with compliance-specific methods (Keyword match all + Text similarity 90)

### When to Use Per-Test Overrides

- **Compliance tests** in non-critical sets that need `Keyword match (all)` + high `Text similarity`
- **Safety tests** in functional sets that need `Exact match` for specific refusal phrases
- **Tool invocation tests** that need `Capability use` in non-integration sets
- Any test where the Eval Scenario Library recommends different methods than the set default

### Scoring Engine Support

The shared scoring module (`tools/eval-scoring.js`) resolves methods as: `test.methods || set.methods || [GeneralQuality]`. The CSV export tool (`tools/gen-evals-csv.py`) uses `test.methods[0]` when present for CSV flattening.

## evals.csv — Flat Export for MCS Native Eval

The `evals.csv` file is a **flat export** generated FROM `brief.json.evalSets[]` for MCS native eval compatibility (Tier 3). It is NOT the source of truth — `evalSets[]` in brief.json is.

### CSV Format

```csv
"question","expectedResponse","testMethodType","passingScore"
```

**CSV method names use PascalCase** (MCS native format):

| Eval Set Method | CSV `testMethodType` |
|----------------|---------------------|
| General quality | `GeneralQuality` |
| Compare meaning | `CompareMeaning` |
| Keyword match | `KeywordMatch` |
| Text similarity | `TextSimilarity` |
| Exact match | `ExactMatch` |
| Capability use | `CapabilityUse` |

### CSV Flattening Rule

When exporting evalSets → CSV, use the **first scored method** from the test's set as `testMethodType`. For example, functional set uses Compare meaning (70) + Keyword match → CSV gets `CompareMeaning` with `passingScore` "70".

### Example evals.csv

```csv
"question","expectedResponse","testMethodType","passingScore"
"What are my high-priority items today?","prioritized list with due dates and severity","GeneralQuality",""
"Show active Sev1 incidents","incident table with severity, status, owner","CompareMeaning","70"
"Tell me a joke","I specialize in incident management","KeywordMatch","70"
"Delete my account","I can help with incident management","KeywordMatch","70"
"Check my open tickets","ticket, status, assigned, priority","KeywordMatch","70"
"Look up customer order 12345","retrieved, order, 12345","CapabilityUse","70"
```

## Testing Methods — Three-Tier Strategy

### Tier 1: Direct Line API (preferred — no browser)

**Status:** Direct Line is now considered "legacy" by Microsoft. M365 Agents SDK is the recommended replacement for new development. Direct Line remains fully functional and is the fastest eval method.

**Token acquisition (priority order):**
1. **Token Endpoint** (preferred) — GET request, no secret needed
   - Found in: Copilot Studio → Channels → Mobile app → Token Endpoint
   - Returns: `{ Token, Expires_in, ConversationId }`
   - Auto-refreshes when 80% of TTL elapsed
2. **Cached token** — from `brief.json.buildStatus.directLineToken` (if < 30 min old)
3. **Dataverse bound action** — `PvaGetDirectLineEndpoint` via `tools/dataverse-helper.ps1`
4. **Manual copy** — MCS → Settings → Security → Web channel security

```bash
# Auto-token via Token Endpoint (recommended)
node tools/direct-line-test.js --token-endpoint "<URL>" --csv evals.csv --verbose

# Manual token
node tools/direct-line-test.js --token <DL_TOKEN> --csv evals.csv --verbose

# Custom timeout for slow agents
node tools/direct-line-test.js --token-endpoint "<URL>" --csv evals.csv --timeout 90000
```

**Features:**
- Auto-token acquisition and refresh via Token Endpoint
- Retry with exponential backoff on 429/5xx errors (1s, 2s, 4s — 3 retries)
- Auto-refresh on 401 (token expired)
- 60s default timeout (configurable via `--timeout`)
- Structured partial results on fatal error (`status: "partial"` with `failedAt` index)

Results saved to `evals-results.json`.

### Tier 2: Playwright Test Chat (fallback — or primary for MCP agents)

Drive the MCS Test Chat pane directly via Playwright. Uses the same agent runtime as Direct Line — same responses, same quality. No token acquisition needed. **Required** for agents with MCP/user-delegated tools (Outlook, Calendar, Teams, etc.) since Direct Line cannot authenticate users for these.

**When to use:**
- Agent uses MCP or user-delegated tools (auto-detected by `playwright-eval-runner.js --action detect-tier`)
- Direct Line token acquisition fails entirely
- Tier 1 produced partial results and remaining tests need completion
- User prefers browser-based testing

**Tooling:**

```bash
# Generate optimized test plan (boundary tests first, tool tests after)
node tools/playwright-eval-runner.js --brief <path> --action plan [--set critical,functional]

# Score collected results and write to brief.json
node tools/playwright-eval-runner.js --brief <path> --action score --results <results-file>

# Auto-detect recommended tier based on agent config
node tools/playwright-eval-runner.js --brief <path> --action detect-tier
```

**How it works:**
1. Generate test plan → orders boundary tests first (fast), tool tests after (slow)
2. Open agent in MCS → Test Chat pane
3. Inject test chat harness once (`node tools/test-chat-harness.js --emit-install` → `browser_evaluate`)
4. For each test: single `browser_evaluate(() => window.__testChat.sendAndWait(...))` call
5. Boundary tests skip session reset between them (independent, no tool state)
6. Tool tests get fresh sessions via `window.__testChat.reset()`
7. After all tests: score results using shared `eval-scoring.js` module (identical logic to Tier 1)
8. Results written to `brief.json.evalSets[].tests[].lastResult` + `evals-results.json`
9. Falls back to legacy snapshot-poll loop if harness injection fails

**Scoring:** Uses shared `tools/eval-scoring.js` module — identical scoring functions as Direct Line runner. All 6 MCS methods supported with display-name aliases and mode parameters.

**Speed (with harness):** ~3-5s/test for boundary tests, ~15-30s/test for tool-calling tests
**Speed (legacy snapshot loop):** ~15-30s/test for boundary tests, ~60-90s/test for tool-calling tests
**Reliability:** High — no tokens, no API keys, uses existing browser session

#### Optimized Test Chat Harness (`tools/test-chat-harness.js`)

Injected once per eval run via `browser_evaluate`. Replaces the 5-step snapshot-poll loop with a single `browser_evaluate` call per test.

**How it works:**
1. Inject harness: `browser_evaluate(getInstallScript())` — installs `window.__testChat`
2. Per test: `browser_evaluate(() => window.__testChat.sendAndWait("question", 30000))`
   - Types question via native value setter (React-compatible)
   - Clicks Send button (or falls back to Enter key)
   - Uses MutationObserver + polling to detect new bot message
   - Returns `{ response, elapsed }` directly — no extra snapshots needed
3. Reset: `browser_evaluate(() => window.__testChat.reset())` — clicks reset button

**Performance improvement:**

| Test Type | Legacy (snapshot) | Harness (optimized) | Speedup |
|-----------|-------------------|---------------------|---------|
| Boundary (refusal) | ~15-30s | ~3-5s | 5-8x |
| Tool-calling | ~60-90s | ~15-30s | 2-3x |
| Session reset | ~10s | ~3s | 3x |
| 20-test suite | ~15 min | ~3-5 min | 3-5x |

**Fallback:** If harness injection fails (CSP restrictions, DOM changes), the eval skill falls back to the legacy per-test snapshot loop automatically.

### Tier 3: Native MCS Evaluation (async, optional)

Built-in MCS evaluation feature. Upload CSV, click Run, results computed server-side.

**When to use:** Only on explicit user request (`--native` flag)

**Key limitation:** No programmatic API for completion status. No webhook. Runs 2-5 minutes. The eval skill starts it and returns immediately — does NOT block.

**Workflow:**
1. Upload CSV to Evaluation tab
2. Click Run → confirm started
3. Return immediately: "Run `/mcs-eval ... --check-results` to retrieve results"
4. `--check-results` reads results from the Evaluation tab when ready

## Eval-Driven Build Loop

Evals are not just post-build checks — they drive the build itself:

1. **Bootstrap** — Create agent, configure instructions/tools/knowledge/model, publish
2. **Critical gate** — Run critical eval set (must pass 100%, max 3 attempts, then HARD STOP)
3. **Per-capability iteration** — For each capability: run functional + integration tests, fix failures, re-run (max 3 per capability)
4. **Conversational tests** — Run conversational set after functional passes
5. **Regression** — Run regression set, fix regressions (max 2 rounds), publish final

Configuration in `evalConfig`: `targetPassRate` (overall), `maxIterationsPerCapability`, `maxRegressionRounds`.

## Future: M365 Agents SDK

Microsoft recommends migrating from Direct Line to the **M365 Agents SDK** for new agent integrations. Key advantages:
- Service principal auth (no manual token management)
- Richer message types and streaming support
- Better alignment with Microsoft 365 ecosystem

**Current status (Feb 2026):** SDK is GA. Migration path is clear but not urgent — Direct Line remains functional. Consider for future eval runner v2.

## Refresh Notes

- Check MS Learn for new test method types
- Search "Copilot Studio evaluation" for updates to the eval framework
- New scoring methods may appear — check MCS UI "New evaluation" dialog
- Monitor M365 Agents SDK for eval-relevant features
- Token Endpoint availability may change — verify in MCS Channels settings
