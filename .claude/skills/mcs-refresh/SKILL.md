---
name: mcs-refresh
description: Refresh knowledge cache files and solution library with live research from MS Learn, WebSearch, SharePoint, and MCS UI snapshots. Use to keep inventories current.
---

# MCS Knowledge Cache Refresh

Refresh knowledge cache files in `knowledge/cache/` and the team solution library in `knowledge/solutions/` with targeted live research. These form a **specialized MCS knowledge layer** — distilled cheat sheets, decision tables, gotchas, current-state inventories, and team build patterns that Claude's base training doesn't have.

## Usage

- `/mcs-refresh` — refresh all stale cache files (> 7 days old) + scan solution library
- `/mcs-refresh triggers` — refresh just `knowledge/cache/triggers.md`
- `/mcs-refresh models connectors` — refresh specific files
- `/mcs-refresh solutions` — refresh solution library only (delta: new/changed solutions)
- `/mcs-refresh all` — force refresh everything regardless of age (cache + solutions)

## All 19 Cache Files

### Tier 1: Build-Critical (refresh before every `/mcs-research`)

These directly drive component selection and architecture decisions. Staleness here = wrong recommendations.

| File | What It Contains | Search Queries |
|------|-----------------|----------------|
| `triggers.md` | Topic trigger types, YAML kinds, event triggers | "Copilot Studio topic trigger types", "Copilot Studio triggers YAML" |
| `models.md` | Available LLM models, GA vs Preview status | "Copilot Studio available models", "Copilot Studio AI models" |
| `mcp-servers.md` | Built-in MCP server catalog | "Copilot Studio MCP servers", "Copilot Studio Model Context Protocol" |
| `connectors.md` | Key Power Platform connectors for agents | "Power Platform connectors Copilot Studio", "new connectors" |
| `knowledge-sources.md` | Knowledge source types + limits | "Copilot Studio knowledge sources types", "knowledge source limits" |
| `channels.md` | Deployment channels + capabilities | "Copilot Studio deployment channels", "Copilot Studio channels" |

### Tier 2: Build-Phase (refresh before `/mcs-build`)

These drive the actual build execution. Staleness here = build errors or suboptimal patterns.

| File | What It Contains | Search Queries |
|------|-----------------|----------------|
| `api-capabilities.md` | What each API layer can do (LSP Wrapper, Island Gateway, PAC CLI, Dataverse) | "Copilot Studio API Dataverse", "PAC CLI copilot commands" |
| `instructions-authoring.md` | Instruction writing patterns, limits, Custom Prompt | "Copilot Studio instructions authoring", "Custom Prompt actions" |
| `generative-orchestration.md` | How gen orchestration routes topics | "Copilot Studio generative orchestration", "topic routing" |
| `adaptive-cards.md` | Adaptive card syntax, channel limits, PowerFx in cards | "Copilot Studio adaptive cards", "adaptive card channel support" |
| `ai-tools-computer-use.md` | AI tools, computer use, prompt actions | "Copilot Studio AI tools", "computer use agent" |
| `island-gateway-api.md` | Island Control Plane gateway endpoints, component CRUD, model hints | "Copilot Studio gateway API", "Island Control Plane botcomponents" |
| `power-automate-integration.md` | Flow integration patterns, cloud vs desktop | "Copilot Studio Power Automate", "cloud flow integration" |

### Tier 3: Reference (refresh weekly or on-demand)

These are stable reference material that changes less frequently.

| File | What It Contains | Search Queries |
|------|-----------------|----------------|
| `eval-methods.md` | Test method types, scoring rules | "Copilot Studio evaluation test methods", "agent testing" |
| `security-auth.md` | Auth patterns, DLP, security settings | "Copilot Studio security authentication", "DLP policies" |
| `agent-lifecycle.md` | Create, publish, version, delete lifecycle | "Copilot Studio agent lifecycle", "publish versioning" |
| `limits-licensing.md` | Message limits, licensing, throttling | "Copilot Studio limits licensing", "rate limits quotas" |
| `powerfx-variables.md` | PowerFx in topics, variable types | "Copilot Studio PowerFx variables", "topic variables" |
| `conversation-design.md` | UX patterns, conversation flows | "Copilot Studio conversation design", "best practices" |

## Freshness Rules

| Age | Action |
|-----|--------|
| < 7 days | Skip (unless forced with `all`) |
| 7-30 days | Refresh |
| > 30 days | Refresh (high priority — flag to user) |

## Process (Per Cache File)

### Step 1: Read Current Cache

Read the cache file. Extract the `last_verified` date from the metadata header.

### Step 2: Check Freshness

Calculate days since `last_verified`:
- If < 7 days AND not forced → skip, report "Still fresh"
- Otherwise → proceed to research

### Step 3: Targeted Research

For each stale file, run **two research queries** (minimum):

1. **MS Learn MCP** — `microsoft_docs_search(query="{search query from table above}")` → official docs, most reliable source
2. **WebSearch** — `"{search query} {current year}"` → catches announcements, blog posts, preview features not yet in docs

If either query surfaces a high-value page (detailed reference, release notes, "what's new"):
3. **MS Learn fetch** — `microsoft_docs_fetch(url="{page URL}")` → get full content

**What to look for:**
- New items added (new models, new MCP servers, new triggers, etc.)
- Items deprecated or removed
- Status changes (Preview → GA, GA → Deprecated)
- Changed limits or behavior
- New patterns or best practices

### Step 3.5: MCP Catalog Diff (mcp-servers.md only)

**When refreshing `mcp-servers.md`, add this catalog diff step after the standard research queries (Step 3) and before Compare and Update (Step 4).**

1. **Read catalog URLs** from the cache file's metadata header: `catalog_url` and `agent365_url`
2. **Fetch both catalog pages** via MS Learn MCP (`microsoft_docs_fetch`):
   - MCS built-in catalog: `catalog_url` (https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-microsoft-mcp-servers)
   - Agent 365 tooling servers overview: `agent365_url` (https://learn.microsoft.com/en-us/microsoft-agent-365/tooling-servers-overview)
3. **Extract server names** from both pages (look for server names in tables, headings, and lists)
4. **Compare against current cache entries:**
   - **New servers** = in catalog pages but not in `mcp-servers.md`
   - **Removed servers** = in `mcp-servers.md` but no longer in either catalog page
5. **Report the diff:**
   ```
   MCP Catalog Diff: {N} servers in catalog, {M} in cache.
   New: [{list of new server names}]
   Removed: [{list of removed server names}]
   ```
6. **For each new server:** Research via `microsoft_docs_fetch` (follow links from catalog) or `microsoft_docs_search` for details (description, status, auth, capabilities). Add to `mcp-servers.md` under the appropriate category.
7. **For each removed server:** Mark as deprecated in `mcp-servers.md` (add "Deprecated" status, don't delete the entry). Note the removal date.

**Skip this step** for all other cache files — it only applies to `mcp-servers.md`.

### Step 4: Compare and Update

For each file:
1. Compare research findings against current cache content
2. **Add** new items discovered
3. **Update** items that changed (status, limits, behavior)
4. **Mark deprecated** items confirmed removed (don't delete — mark with ~~strikethrough~~ or "Deprecated" status)
5. Update metadata header: `last_verified: {today's date}`
6. Update `sources` list with what was checked
7. Adjust `confidence` if findings are ambiguous

### Step 5: Report

```
## Knowledge Cache Refresh Report

| File | Previous | Updated | Changes |
|------|----------|---------|---------|
| triggers.md | Feb 03 | Feb 12 | Added OnPlanComplete trigger |
| models.md | Feb 10 | — | Still fresh (skipped) |
| mcp-servers.md | Jan 15 | Feb 12 | 2 new MCP servers found |
| ... | ... | ... | ... |

**Refreshed:** N / 19 files
**Skipped (fresh):** M files
**Notable changes:**
- {change 1}
- {change 2}
```

## Session-Start Mode

When called during session startup (auto-refresh), use a **lightweight pass**:

1. Read all 19 files, check dates
2. Only refresh files > 7 days old
3. For Tier 1 files: always refresh if stale (these affect research quality)
4. For Tier 2-3 files: flag as stale but skip unless user is about to build
5. Report what was refreshed and what's flagged

This keeps session start under 3-5 minutes while ensuring build-critical knowledge is current.

## Important Rules

- **Always update `last_verified`** even if no changes found — it means "verified as still current"
- **Don't delete content** unless confirmed removed/deprecated — add new, mark old as deprecated
- **Note confidence level** — if only one source mentions something, set confidence to "medium"
- **Preserve the metadata header format** exactly — other tools parse it
- **Parallel where possible** — run MS Learn + WebSearch queries for multiple files in parallel to speed up refresh
- **If MCS UI verification would help** (e.g., checking current model list), mention it to user

---

## Solution Library Refresh

When `/mcs-refresh solutions` is invoked (or as part of `/mcs-refresh` / `/mcs-refresh all`), refresh the team's SharePoint solution library index at `knowledge/solutions/`.

This follows the same pattern as the ObjectModel CLI auto-update: scan for changes, process only what's new/changed, commit the results. Users get updates via `git pull`.

### How It Works

```
Lightweight scan (1 API call, ~2s):
  List SharePoint folders → compare lastModified dates against index
  Report: "2 new, 1 updated, 0 removed"

Delta deep-analysis (only for new/changed):
  Download zip → extract to temp dir → parse XML → write cache JSON → cleanup temp
  ~30-60s per solution

Result:
  knowledge/solutions/index.json     Updated index (committed)
  knowledge/solutions/cache/*.json   Per-solution analysis (committed)
  Temp zips                          Deleted after analysis
```

### Process

#### Step 1: Run Scan

```bash
node tools/solution-library.js scan --json
```

This returns `{ new: [...], updated: [...], removed: [...] }` — one Graph API call.

#### Step 2: Decide Action

| Scan Result | Action |
|-------------|--------|
| No changes | Report "Solution library is current" — done |
| New/updated found | Proceed to Step 3 |
| `--all` flag | Skip scan, force full re-analyze |

#### Step 3: Run Delta Refresh

```bash
node tools/solution-library.js refresh --json
# or for full re-analyze:
node tools/solution-library.js refresh --all --json
```

This downloads + extracts + parses only new/changed solutions. Each analyzed solution gets a cache file at `knowledge/solutions/cache/{id}.json`.

#### Step 4: Report

```
## Solution Library Refresh

Scanned: 32 folders in SharePoint
Analyzed: 2 solutions (new/changed)
Skipped: 30 (unchanged)

  NEW: "Contoso Insurance Agent" → knowledge/solutions/cache/sol-abc123.json
  UPDATED: "Claims Processing Agent" → knowledge/solutions/cache/sol-def456.json

Solutions: 32 indexed, 28 deep-analyzed
```

### Freshness Rules (Same as Cache)

| Age Since Last Scan | Status | Action |
|---------------------|--------|--------|
| < 7 days | Fresh | Skip (unless forced) |
| 7-30 days | Stale | Lightweight scan on `/mcs-refresh` |
| > 30 days | Expired | Scan + flag for deep refresh |

### Session Start Integration

During session startup, check solution library freshness alongside cache:
```
node tools/solution-library.js freshness --json
```

Report in startup summary:
```
Solutions: 30 indexed, 28 analyzed (scanned 3 days ago — fresh)
```

Or if stale:
```
Solutions: 30 indexed, 28 analyzed (scanned 12 days ago — stale, run /mcs-refresh solutions)
```
