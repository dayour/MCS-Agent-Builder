---
name: mcs-retro
description: "Use this skill after a build, eval, or fix session to capture learnings. Collects discoveries, cross-references the solution library, classifies insights (REPEAT, NEW, CORRECTION, ENHANCEMENT, TOOLING_GAP, SOLUTION_PATTERN, DECISION_OUTCOME), and writes to knowledge/learnings/. Use at the end of any significant work session."
user_invocable: true
---

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
- **Tool gaps** — operations that required manual steps when an API should exist
- **Performance observations** — what was fast, what was slow, what could be parallelized
- **Solution patterns** — naive implementation approaches that failed and the proven alternative that worked (e.g., HTTP connector for web scraping failed → containerized Readability succeeded)
- **Decision outcomes** — which `decisions[]` options were selected, whether they worked, and whether the recommendation should change (e.g., "Tier 2 Jina Reader was selected over Tier 1 Azure Function because customer had no Azure subscription — worked well for static sites")

For each item, extract:
- **Summary** (1-2 sentences)
- **Category** (error, workaround, discovery, tool_gap, performance, solution_pattern, decision_outcome)
- **Proposed tags** (2-4 tags for index.json matching, e.g. `["lsp", "push", "settings"]`)
- **Proposed target file** (which `learnings/*.md` file it belongs in)

### Step 1.5: Consult Solution Library

Cross-reference collected items against the team solution library for pattern confirmation.

1. Read `knowledge/solutions/index.json`
2. For each collected item with `solution_pattern` or `decision_outcome` category:
   - Search index for solutions with 2+ matching tags (industry, capabilities, tools, architecture type)
   - If match: note "Similar pattern in library: {folderName}" — enriches Step 2 comparison
3. For all items: check if the current agent's capabilities/integrations match a library solution
   - If match: cross-reference approach differences (different tools for same capability = interesting)
4. Read relevant `knowledge/solutions/cache/*.json` files for matched solutions to get deeper context

This step is fast (local file reads only) and enriches the comparison engine in Step 2 with library evidence.

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
| **SOLUTION_PATTERN** | Naive approach failed, proven alternative found | Tier 2 (user) | Add/update entry in `knowledge/patterns/solution-patterns.md` |
| **DECISION_OUTCOME** | A `decisions[]` option was selected and built — record whether it worked | Tier 2 (user) | Update solution pattern `Confirmed builds` count + add learnings entry |

### Step 3.5: GPT Classification Validation (Automatic)

GPT classification review fires automatically on every retro — not optional. This catches misclassifications that compound into learnings bloat (false NEWs that should be REPEATs) or missed knowledge (false REPEATs that are actually novel).

**Procedure:**

1. Write the classification table to a temp file (`Build-Guides/{projectId}/agents/{agentId}/retro-classification-draft.json`):
   ```json
   {
     "items": [
       {
         "id": 1,
         "summary": "LSP push silently ignored settings",
         "classification": "REPEAT",
         "matchedEntry": "bm-003",
         "targetFile": "build-methods.md",
         "proposedTags": ["lsp", "push", "settings"],
         "confidence": "high"
       }
     ],
     "existingEntries": ["<relevant index.json entries for context>"]
   }
   ```

2. Fire GPT review:
   ```bash
   node tools/multi-model-review.js review-code --file "Build-Guides/{projectId}/agents/{agentId}/retro-classification-draft.json" --context "Retro classification review: verify REPEAT vs NEW distinction, check for missed contradictions with existing learnings, validate proposed tags, flag items where confidence should be lower"
   ```

3. **Merge GPT findings before presenting to user:**
   - If GPT reclassifies an item (e.g., NEW → ENHANCEMENT): adopt the reclassification and note "GPT reclassified: {reason}" in the presentation table
   - If GPT finds a missed contradiction: upgrade to CORRECTION
   - If GPT flags low confidence: add "⚠ low confidence" marker — user should pay extra attention
   - If GPT and Claude agree: no annotation needed (agreement is the default)

4. **Clean up:** Delete the temp classification file after Step 5 (Apply) completes.

**If GPT fails for any reason** (exit code 3 = unavailable, non-zero exit, timeout, malformed/empty output, unparseable JSON): proceed with Claude's classification alone — never block the retro on GPT. Log the specific reason: "GPT {failure type} — proceeding with single-model classification."

**Merge edge cases:**
- GPT references an unknown item ID → ignore that finding
- GPT reclassifies without a reason → mark item as low confidence instead of auto-applying
- GPT emits conflicting recommendations for the same item → mark as low confidence for user review
- GPT suggests tag changes only (no reclassification) → apply tag suggestions independently

**Cleanup:** Delete the temp classification file after Step 5 (Apply) completes, OR if the flow exits early (user rejects all, error before Step 5, etc.). Treat cleanup as a finally-style step — always attempt regardless of outcome.

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
6. **SOLUTION_PATTERN**: Write new pattern entry to `knowledge/patterns/solution-patterns.md` following the existing format (ID `sp-NNN`, sections: naive approach, why it fails, proven pattern, when to match, implementation, tags, confirmed builds). If the pattern updates an existing entry (same problem type), bump `Confirmed builds` count and add implementation notes. Update `knowledge/learnings/index.json` with `file: "patterns/solution-patterns.md"` (cross-directory reference). When library matches from Step 1.5 confirm the pattern, note the library solution name and bump `confirmed` count by match count.
7. **DECISION_OUTCOME**: Record which `decisions[]` option was selected, whether it worked in production, and any surprises. If the option came from a solution pattern → bump that pattern's `Confirmed builds` count. If the recommended option failed and a different option worked better → write a learnings entry to the relevant file (e.g., `connectors.md`, `integrations.md`) noting the context where the non-default option was better. If the user overrode a recommendation and it worked → record why, so future recommendations can factor this in.

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

`knowledge/patterns/solution-patterns.md` (for SOLUTION_PATTERN matching and deduplication).

`knowledge/solutions/index.json` and `knowledge/solutions/cache/*.json` (for library cross-reference in Step 1.5).

## Rules

- Never auto-apply Tier 2 items — always present and wait for user approval
- REPEAT items (Tier 1) are auto-applied silently — just bump counts
- If no items are collected, report "No learnings found in this session" and exit
- Keep learnings entries concise: 2-3 sentences max per entry
- Use the Comparison Engine (4-step protocol from CLAUDE.md § B) for deduplication
