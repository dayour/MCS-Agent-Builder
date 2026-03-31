# GPT Dual Scoring (Borderline Tests)

For tests with borderline scores (within 15 points of the pass/fail threshold), the eval runner uses GPT-enhanced async scoring automatically. Four semantic methods support dual scoring:

| Method | Async Variant | Dual Scoring |
|--------|--------------|-------------|
| Compare meaning | `semanticSimilarityAsync` | Yes -- heuristic + GPT, stricter wins |
| General quality | `qualityScoreAsync` | Yes -- heuristic + GPT, stricter wins |
| Text similarity | `textSimilarityAsync` | Yes -- heuristic + GPT, stricter wins |
| Tool use | `toolUseAsync` | Yes -- heuristic + GPT, stricter wins |
| Exact match | (sync only) | No -- deterministic, no LLM needed |
| Keyword match | (sync only) | No -- deterministic, no LLM needed |
| Plan validation | (sync only) | No -- deterministic, no LLM needed |

**When dual scoring activates:** `evaluateAllMethodsAsync()` routes CompareMeaning, GeneralQuality, TextSimilarity, and ToolUse through their async variants. Each runs heuristic + GPT in parallel, merges with `_mergeScores()` (stricter/lower score wins). >20pt divergence = flagged.

For additional borderline review, fire the CLI scorer:
```bash
node tools/multi-model-review.js score --actual "<response>" --expected "<expected>" --method compare-meaning
```

**Merge protocol:** Lower score wins. If GPT and Claude scores diverge by >20 points, flag the test as "borderline -- manual review recommended" in `lastResult.notes`.

**Never block on GPT** -- if unavailable, use Claude's score alone.
