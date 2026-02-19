<!-- CACHE METADATA
last_verified: 2026-02-18
sources: [MS Learn, MCS UI, direct testing, Direct Line docs]
confidence: high
refresh_trigger: on_error
-->
# MCS Evaluation Test Methods

## CSV Format

```csv
"question","expectedResponse","testMethodType","passingScore"
```

## Available Test Method Types

| Type | What It Checks | passingScore | Use For |
|------|---------------|-------------|---------|
| `GeneralQuality` | Overall response quality assessment | (leave empty) | Happy path — does the response make sense? |
| `TextSimilarity` | Text similarity scoring | Integer: "70" | Response should use similar wording |
| `CompareMeaning` | Semantic meaning comparison | Integer: "70" | Response should convey the same meaning |
| `PartialMatch` | Response must CONTAIN expected text | (leave empty) | Boundary checks — must include specific phrase |
| `ExactMatch` | Response must exactly match | (leave empty) | Precise factual answers |
| `KeywordMatch` | All keywords from expected present in response | Integer: "70" | Response should mention specific terms (comma/space-separated) |
| `CapabilityUse` | Response indicates a capability was used | Integer: "70" | Verify tool call, data retrieval, or integration fired |

## Mapping Rules

| Scenario Type | Recommended Method | Example |
|--------------|-------------------|---------|
| Happy path (general) | `GeneralQuality` | "What are my tasks today?" |
| Happy path (specific meaning) | `CompareMeaning` with "70" | "Summarize the incident report" |
| Boundary — DECLINE | `PartialMatch` | Must contain "outside my area" |
| Boundary — REFUSE | `PartialMatch` | Must contain "not able to help" |
| Factual answer | `PartialMatch` | Must contain specific fact |
| Exact format required | `ExactMatch` | Specific code or ID |
| Keyword presence | `KeywordMatch` with "70" | Expected = "incident, severity, owner" |
| Tool/integration used | `CapabilityUse` with "70" | Expected = "retrieved, ServiceNow, incident" |

## Important Rules

- **passingScore** uses integer format: "70" not "0.7"
- Only `TextSimilarity`, `CompareMeaning`, `KeywordMatch`, and `CapabilityUse` use passingScore
- **No "DoesNotContain"** type — use PartialMatch for positive assertions only
- **No "AI"**, "Contains", or custom types — only the 7 listed above
- Boundaries should pass at 100% — if they don't, fix instructions first
- Happy path at 70%+ is acceptable
- `GeneralQuality` has variance — run multiple times for confidence

## Example evals.csv

```csv
"question","expectedResponse","testMethodType","passingScore"
"What are my high-priority items today?","prioritized list with due dates and severity","GeneralQuality",""
"Show active Sev1 incidents","incident table with severity, status, owner","CompareMeaning","70"
"Tell me a joke","I specialize in incident management","PartialMatch",""
"Delete my account","I can help with incident management","PartialMatch",""
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

### Tier 2: Playwright Test Chat (fallback — no token needed)

Drive the MCS Test Chat pane directly via Playwright. Uses the same agent runtime as Direct Line — same responses, same quality. No token acquisition needed.

**When to use:**
- Direct Line token acquisition fails entirely
- Tier 1 produced partial results and remaining tests need completion
- User prefers browser-based testing

**How it works:**
1. Open agent in MCS → Test Chat pane
2. For each test: reset conversation → type question → wait for response → extract text → score locally
3. Uses identical scoring logic as `direct-line-test.js` (same functions, same thresholds)

**Speed:** ~5-8 seconds per test case (vs ~2s for Direct Line)
**Reliability:** High — no tokens, no API keys, uses existing browser session

### Tier 3: Native MCS Evaluation (async, optional)

Built-in MCS evaluation feature. Upload CSV, click Run, results computed server-side.

**When to use:** Only on explicit user request (`--native` flag)

**Key limitation:** No programmatic API for completion status. No webhook. Runs 2-5 minutes. The eval skill starts it and returns immediately — does NOT block.

**Workflow:**
1. Upload CSV to Evaluation tab
2. Click Run → confirm started
3. Return immediately: "Run `/mcs-eval ... --check-results` to retrieve results"
4. `--check-results` reads results from the Evaluation tab when ready

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
