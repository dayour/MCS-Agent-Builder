---
name: mcs-refresh
description: "Use this skill to update knowledge cache files and the solution library with live research. Checks staleness of the 24 cache files in knowledge/cache/, runs targeted MS Learn + WebSearch queries, and updates inventories. Use when cache is stale (>3 days), before a build, or when the user asks to refresh knowledge."
---

# MCS Knowledge Cache Refresh

Refresh knowledge cache files in `knowledge/cache/` and the team solution library in `knowledge/solutions/` with targeted live research. These form a **specialized MCS knowledge layer** — distilled cheat sheets, decision tables, gotchas, current-state inventories, and team build patterns that Claude's base training doesn't have.

## Usage

- `/mcs-refresh` — refresh all stale cache files (> 3 days old) + check upstream repos + scan solution library
- `/mcs-refresh triggers` — refresh just `knowledge/cache/triggers.md`
- `/mcs-refresh models connectors` — refresh specific files
- `/mcs-refresh solutions` — refresh solution library only (delta: new/changed solutions)
- `/mcs-refresh upstream` — check upstream repos only (no cache refresh)
- `/mcs-refresh all` — force refresh everything regardless of age (cache + upstream + solutions)

## Cache File Index

See `reference/cache-file-index.md` for the full list of all 24 cache files organized by tier (Tier 1 build-critical, Tier 2 build-phase, Tier 3 reference) with search queries for each.

## Freshness Rules

| Age | Action |
|-----|--------|
| < 3 days | Skip (unless forced with `all`) |
| 3-14 days | Refresh |
| > 14 days | Refresh (high priority — flag to user) |

## Step 0: Upstream Repository Check

**Always run first** (before cache file refresh), unless the user specified individual cache files.

```bash
node tools/upstream-check.js --update
```

Checks all repos in `knowledge/upstream-repos.json` (3-day freshness) via `gh api`. For `/mcs-refresh upstream` — run only this step and stop.

## Process (Per Cache File)

### Step 1: Read Current Cache
Read the cache file. Extract the `last_verified` date from the metadata header.

### Step 2: Check Freshness
If < 3 days AND not forced → skip. If 3-14 days → proceed. If > 14 days → proceed (high priority).

### Step 3: Targeted Research
Run **two research queries** (minimum):
1. **MS Learn MCP** — `microsoft_docs_search(query="{search query}")` → official docs
2. **WebSearch** — `"{search query} {current year}"` → announcements, preview features

If either surfaces a high-value page: **MS Learn fetch** → get full content.

**What to look for:** New items, deprecations, status changes (Preview → GA), changed limits, new patterns.

#### Step 3.5: MCP Catalog Diff (mcp-servers.md only)
When refreshing `mcp-servers.md`, fetch both catalog pages (MCS built-in + Agent 365), extract server names, diff against cache. Add new servers, mark removed ones as deprecated.

### Step 4: Compare and Update
Add new items, update changed items, mark deprecated items (don't delete). Update `last_verified` and `sources` **only if research succeeded** — if Step 3 queries failed or returned errors, leave `last_verified` unchanged to avoid marking stale content as fresh.

### Step 5: Rebuild Knowledge Index
```bash
node tools/build-knowledge-index.js
```
**Always run after all cache file updates complete (not after each individual file).** The index is the compiled form used by the wizard and knowledge resolver. Run once at the end of the refresh batch to avoid concurrent rebuild races.

### Step 6: Report
Output a summary table: file, previous date, updated date, changes. Report total refreshed/skipped and notable changes.

## Solution Library Refresh

For `/mcs-refresh solutions` or as part of a full refresh: see `reference/solution-library-refresh.md` for the complete scan → analyze → report process using `tools/solution-library.js`.

## Session-Start Mode

When called during session startup (auto-refresh):
1. Run upstream check (3-day cycle)
2. Read all 24 files, check dates
3. Only refresh files > 3 days old
4. Tier 1: always refresh if stale. Tier 2-3: flag but skip unless user is about to build.
5. Target: under 3-5 minutes.

## Gotchas

- **Update `last_verified` only on successful research** — if queries succeed with no changes, still update (means "verified as still current"). If queries fail, leave the date unchanged.
- **Don't delete content** unless confirmed removed — mark old items as deprecated
- **GA/Preview status on every entry** — every item must have a status column. Status changes are high-priority findings.
- **Preserve the metadata header format** exactly — other tools parse it
- **Parallel where possible** — run queries for multiple files in parallel to speed up refresh
