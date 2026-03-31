# Solution Library Refresh

When `/mcs-refresh solutions` is invoked (or as part of `/mcs-refresh` / `/mcs-refresh all`), refresh the team's SharePoint solution library index at `knowledge/solutions/`.

This follows the same pattern as the ObjectModel CLI auto-update: scan for changes, process only what's new/changed, commit the results. Users get updates via `git pull`.

## How It Works

```
Lightweight scan (1 API call, ~2s):
  List SharePoint folders -> compare lastModified dates against index
  Report: "2 new, 1 updated, 0 removed"

Delta deep-analysis (only for new/changed):
  Download zip -> extract to temp dir -> parse XML -> write cache JSON -> cleanup temp
  ~30-60s per solution

Result:
  knowledge/solutions/index.json     Updated index (committed)
  knowledge/solutions/cache/*.json   Per-solution analysis (committed)
  Temp zips                          Deleted after analysis
```

## Process

### Step 1: Run Scan

```bash
node tools/solution-library.js scan --json
```

This returns `{ new: [...], updated: [...], removed: [...] }` -- one Graph API call.

### Step 2: Decide Action

| Scan Result | Action |
|-------------|--------|
| No changes | Report "Solution library is current" -- done |
| New/updated found | Proceed to Step 3 |
| `--all` flag | Skip scan, force full re-analyze |

### Step 3: Run Delta Refresh

```bash
node tools/solution-library.js refresh --json
# or for full re-analyze:
node tools/solution-library.js refresh --all --json
```

This downloads + extracts + parses only new/changed solutions. Each analyzed solution gets a cache file at `knowledge/solutions/cache/{id}.json`.

### Step 4: Report

```
## Solution Library Refresh

Scanned: 32 folders in SharePoint
Analyzed: 2 solutions (new/changed)
Skipped: 30 (unchanged)

  NEW: "Contoso Insurance Agent" -> knowledge/solutions/cache/sol-abc123.json
  UPDATED: "Claims Processing Agent" -> knowledge/solutions/cache/sol-def456.json

Solutions: 32 indexed, 28 deep-analyzed
```

## Freshness Rules (Same as Cache)

| Age Since Last Scan | Status | Action |
|---------------------|--------|--------|
| < 3 days | Fresh | Skip (unless forced) |
| 3-14 days | Stale | Lightweight scan on `/mcs-refresh` |
| > 14 days | Expired | Scan + flag for deep refresh |

## Session Start Integration

During session startup, check solution library freshness alongside cache:
```
node tools/solution-library.js freshness --json
```

Report in startup summary:
```
Solutions: 30 indexed, 28 analyzed (scanned 3 days ago -- fresh)
```

Or if stale:
```
Solutions: 30 indexed, 28 analyzed (scanned 12 days ago -- stale, run /mcs-refresh solutions)
```
