<!-- CACHE METADATA
last_verified: 2026-02-10
sources: [MS Learn, MCS UI, direct testing]
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

## Mapping Rules

| Scenario Type | Recommended Method | Example |
|--------------|-------------------|---------|
| Happy path (general) | `GeneralQuality` | "What are my tasks today?" |
| Happy path (specific meaning) | `CompareMeaning` with "70" | "Summarize the incident report" |
| Boundary — DECLINE | `PartialMatch` | Must contain "outside my area" |
| Boundary — REFUSE | `PartialMatch` | Must contain "not able to help" |
| Factual answer | `PartialMatch` | Must contain specific fact |
| Exact format required | `ExactMatch` | Specific code or ID |

## Important Rules

- **passingScore** uses integer format: "70" not "0.7"
- Only `TextSimilarity` and `CompareMeaning` use passingScore
- **No "DoesNotContain"** type — use PartialMatch for positive assertions only
- **No "AI"**, "Contains", or custom types — only the 5 listed above
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
```

## Testing Methods

### Direct Line API (preferred — no browser)
```bash
node tools/direct-line-test.js --token <DL_TOKEN> --csv evals.csv --verbose
```
Results saved to `evals-results.json`.

### Native MCS Evaluation (fallback — requires Playwright)
1. Navigate to Evaluation tab
2. Upload CSV via file input
3. Click Evaluate → Run

## Refresh Notes

- Check MS Learn for new test method types
- Search "Copilot Studio evaluation" for updates to the eval framework
- New scoring methods may appear — check MCS UI "New evaluation" dialog
