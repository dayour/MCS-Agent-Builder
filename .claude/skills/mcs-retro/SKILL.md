# /mcs-retro — Post-Session Retrospective

## Purpose

Capture and classify learnings from a build/eval/fix session. Compares discoveries against existing knowledge, presents a classified table, and writes approved items to the learnings system.

## When to Use

After completing a build (`/mcs-build`), eval (`/mcs-eval`), or fix (`/mcs-fix`) session. Optional — never auto-triggered.

## Input

`/mcs-retro` (no arguments — scans the current session)

## Output

- Updated `knowledge/learnings/*.md` files (approved items)
- Updated `knowledge/learnings/index.json` (new/bumped entries)
- Updated `knowledge/cache/*.md` files (if cache corrections found)

## 5-Step Flow

### Step 1: Collect

Scan the current session for actionable items:

- **Build errors** — API failures, LSP errors, Dataverse rejections
- **Eval failures** — test cases that failed unexpectedly
- **Manual workarounds** — steps that should have been automated but weren't
- **Verbal discoveries** — user corrections, "remember that X", "this doesn't work because Y"
- **Tool gaps** — operations that required Playwright when an API should exist
- **Performance observations** — what was fast, what was slow, what could be parallelized

For each item, extract:
- **Summary** (1-2 sentences)
- **Category** (error, workaround, discovery, tool_gap, performance)
- **Proposed tags** (2-4 tags for index.json matching, e.g. `["lsp", "push", "settings"]`)
- **Proposed target file** (which `learnings/*.md` file it belongs in)

### Step 2: Compare

For each collected item:
1. Read `knowledge/learnings/index.json` — find entries with 2+ matching tags
2. For each matching entry, compare scenario + conclusion
3. Check related `knowledge/cache/*.md` files — does the item reveal missing or incorrect cache info?

### Step 3: Classify

Each item gets exactly one classification:

| Classification | Meaning | Tier | Action |
|---------------|---------|------|--------|
| **REPEAT** | Same scenario + conclusion as existing entry | Tier 1 (auto) | Bump `confirmed` count + `lastConfirmed` date |
| **NEW** | Novel discovery, no matching entry | Tier 2 (user) | Add to learnings file + index.json |
| **CORRECTION** | Contradicts an existing entry | Tier 2 (user) | Flag contradiction, propose update |
| **ENHANCEMENT** | Enriches existing entry with new context | Tier 2 (user) | Update existing entry in .md + index.json |
| **TOOLING_GAP** | Missing feature in tools/scripts | Tier 2 (user) | File as suggestion via `/suggest` |

### Step 4: Present

Display a table of ALL collected items:

```
| # | Summary | Classification | Target File | Proposed Action |
|---|---------|---------------|-------------|-----------------|
| 1 | LSP settings.mcs.yml push silently ignored | REPEAT | build-methods.md | Bump confirmed: 3→4 |
| 2 | Browser account mismatch wastes ~10 min | NEW | build-methods.md | Add entry |
| 3 | add-tool.js can't create NEW actions | CORRECTION | build-methods.md | Update existing entry |
```

For Tier 1 (REPEAT) items: auto-apply without asking.
For Tier 2 items: ask user to approve/reject each one (or approve all).

### Step 5: Apply

For approved items:
1. **REPEAT**: Bump `confirmed` count and `lastConfirmed` in `index.json`, update `Last confirmed` line in `.md` file
2. **NEW**: Write entry to target `.md` file, add to `index.json` with `confirmed: 1`
3. **CORRECTION**: Update contradicted entry in `.md` + `index.json`, add correction note
4. **ENHANCEMENT**: Append context to existing `.md` entry, update `index.json` `lastConfirmed`
5. **TOOLING_GAP**: Invoke `/suggest` with pre-filled description

After all writes, report:
- N items applied (X auto, Y user-approved)
- Cache files updated: [list]
- Suggestions filed: [list]

## Learnings Files Read

All files in `knowledge/learnings/`:
- `connectors.md`, `integrations.md`, `architecture.md`, `instructions.md`
- `topics-triggers.md`, `eval-testing.md`, `build-methods.md`, `customer-patterns.md`
- `index.json`

All files in `knowledge/cache/` (for cross-reference and correction detection).

## Rules

- Never auto-apply Tier 2 items — always present and wait for user approval
- REPEAT items (Tier 1) are auto-applied silently — just bump counts
- If no items are collected, report "No learnings found in this session" and exit
- Keep learnings entries concise: 2-3 sentences max per entry
- Use the Comparison Engine (4-step protocol from CLAUDE.md § B) for deduplication
