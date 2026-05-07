---
name: mcs-sync
description: "Use this skill to detect changes across all external dependencies (knowledge cache, upstream repos, Elevate, eval-guide plugin, MCP servers, om-cli binary, MS Learn docs, Claude Code plugins) and produce a triage board so a human can decide TAKE or REJECT per change. Never auto-applies. Use when the user asks to 'refresh everything', 'check what's new upstream', 'run dependency sync', 'sync', or when you want to see what has drifted since the last manual review."
---

# MCS Sync — Detect, Understand, Decide

Single manifest-driven pipeline for every external dependency. Replaces the deleted `/mcs-refresh` + `tools/refresh-everything.js` auto-apply path. The key invariants:

1. **Two decisions only** — `TAKE` or `REJECT`. No middle ground.
2. **Never auto-applies** — taking a change prints the impacted artifacts and writes an action plan markdown for the user; the orchestrator never edits a downstream file itself.
3. **Manual cadence** — there is no auto-cron, no session-start auto-fetch. The user runs sync weekly (or on demand). The session-start hook only warns about staleness; it does not invoke sync.

## Invocation

```bash
# Default: detect + understand on all 8 sources, write triage bundle
node tools/sync-orchestrator.js
npm run sync

# Single source
node tools/sync-orchestrator.js run --source knowledge-cache
node tools/sync-orchestrator.js run --source upstream-repos
node tools/sync-orchestrator.js run --source elevate
node tools/sync-orchestrator.js run --source eval-guide
node tools/sync-orchestrator.js run --source mcp-servers
node tools/sync-orchestrator.js run --source om-cli
node tools/sync-orchestrator.js run --source docs-manifest
node tools/sync-orchestrator.js run --source plugins

# Fast detect-only (fingerprints, no classification)
node tools/sync-orchestrator.js detect

# Re-open the last triage (no re-detection)
node tools/sync-orchestrator.js review

# Record a decision
node tools/sync-orchestrator.js decide <changeId> reject --reason "..."
node tools/sync-orchestrator.js decide <changeId> take   --reason "..." --confirm

# Inspect loaded manifest (lists all 8 sources)
node tools/sync-orchestrator.js manifest

# Machine-readable output
node tools/sync-orchestrator.js --json
```

## Decisions

| Decision | Meaning |
|---|---|
| **TAKE** | Accept the upstream change. The orchestrator prints the impact graph (downstream artifacts the change touches) and writes an action plan to `knowledge/sync/views/<runId>-actions.md`. The user works through the plan manually. Requires `--confirm` so the impact list is not silently bypassed. |
| **REJECT** | Decline the change. Permanent for this `changeId`. If upstream moves again, the next sync run produces a fresh card with a different `changeId` and re-presents it. |

There are no `ADOPT/MERGE/LEVERAGE/SKIP/IGNORE` classes anymore. Legacy adapter outputs in those forms are remapped automatically by `tools/sync-orchestrator.js` (`normalizeRecommendation`).

## Sources (8)

All sources registered in `knowledge/sync-manifest.json`. Each has a dedicated adapter under `tools/sync-adapters/`.

| Source | Adapter | Detection Signal | Default |
|---|---|---|---|
| `knowledge-cache` | `knowledge-cache.js` | Normalized markdown content hash per cache file | TAKE |
| `upstream-repos` | `upstream-repos.js` | Commit SHA + watchPaths hash via `upstream-check.js` | REJECT |
| `elevate` | `elevate.js` | Commit SHA + tracked path tree hash via `elevate-sync.js` | REJECT |
| `eval-guide` | `eval-guide.js` | Installed plugin SHA + `gh api` HEAD comparison | TAKE |
| `mcp-servers` | `mcp-servers.js` | Static config hash from `.claude/settings.json` mcpServers | REJECT |
| `om-cli` | `om-cli.js` | Binary hash + stamped source SHA | REJECT |
| `docs-manifest` | `docs-manifest.js` | Per-URL content hash for tracked MS Learn pages | TAKE |
| `plugins` | `plugins.js` | Installed Claude plugin SHA set (excluding eval-guide) | REJECT |

## Storage Layout

```
knowledge/sync/
├── snapshots/          (gitignored — last observed fingerprint per source)
├── runs/               (gitignored — per-run change records, working memory)
├── decisions/<id>/     (committed — hash-chained JSONL, canonical machine truth)
└── views/              (committed — generated markdown projection for humans)
    ├── <runId>.md         (triage board)
    └── <runId>-actions.md (action plan; appended on every TAKE)
```

- **Snapshots** and **runs** are gitignored because they churn on every run.
- **Decisions** (JSONL, partitioned by source id) are the authoritative audit trail.
- **Views** are regenerated on every decision; never hand-edit. The pre-commit hook (`tools/git-hooks/pre-commit`) runs `sync-orchestrator.js verify-views` and rejects edits that break the integrity marker.

## Three-Phase Pipeline

### Phase 1: DETECT
Each adapter reports a fingerprint: `{primary, secondary, version, timestamp}`. The orchestrator compares against the stored snapshot. If fingerprints match, the source is `unchanged` and skipped.

### Phase 2: UNDERSTAND
For each changed source, the adapter's `understand()` classifies the diff: kind (content/structure/behavior/dependency), breakingRisk, novelty. The impact graph in the manifest expands direct impacts into transitive review items (e.g., eval-guide change → flag eval-generation + eval-pipeline for review).

### Phase 3: DECIDE
The orchestrator renders triage cards sorted by priority (impact 40 + breakingRisk 25 + confidence 15 + staleness 10 + opportunity 10). Top 10 shown in console, full bundle in `knowledge/sync/views/<runId>.md`. User issues `decide` per card. On TAKE, the orchestrator:

1. Resolves the change's source through `manifest.impactGraph.edges`.
2. Prints "Taking this change touches N downstream artifact(s)" with the list.
3. Refuses to record without `--confirm`.
4. Once confirmed, appends a hash-chained JSONL entry with `impactedArtifacts: [...]`.
5. Appends a `## <changeId>` section to `knowledge/sync/views/<runId>-actions.md` containing the action plan steps and a checklist of impacted artifacts.

The action plan is a **manual checklist**. The orchestrator never edits any of those files.

## Priority Score

```
priority = 40*impact + 25*breakingRisk + 15*confidence + 10*staleness + 10*opportunity
```

Cards under priority 20 are noise-level; they appear but below the fold.

## When to Use This Skill

- User says **"sync"**, **"refresh everything"**, **"check what's new upstream?"**, **"weekly sync"** → run `npm run sync`
- User says **"check the knowledge cache"** → `run --source knowledge-cache`
- User says **"has eval-guide changed?"** → `run --source eval-guide`
- User says **"is om-cli current?"** → `run --source om-cli`
- Before a major build → `detect` (fast) then full `run` if anything moved
- Weekly cadence: full run, review the triage, decide TAKE or REJECT for everything priority > 40

## When NOT to Use This Skill

- For per-task lookups inside another skill (e.g., `/mcs-research` calling `microsoft_docs_search` for a specific topic) — that is local research, not a dependency sync.
- For applying a TAKE decision automatically — the orchestrator never edits framework files. The user works through the action plan manually and commits.
- For amending a decision — decisions are append-only and hash-chained. To re-evaluate, wait for the next run to produce a fresh `changeId`.

## Extending: Add a New Source

1. Add entry to `knowledge/sync-manifest.json` under `sources[]` with `id`, `adapter`, `defaultRecommendation` (`TAKE` or `REJECT`), and `impacts: [...]`.
2. Write adapter at `tools/sync-adapters/<source-id>.js` exporting `detect({source, prevSnapshot, root})` and `understand({source, before, after, root})`.
3. Declare any new impact graph edges in `manifest.impactGraph.edges`.
4. Run `node tools/sync-orchestrator.js run --source <id>` to baseline.

## Adapter Contract

```js
// tools/sync-adapters/<source-id>.js
module.exports = {
  async detect({ source, prevSnapshot, root }) {
    return {
      fingerprint: { primary, secondary, version, timestamp },
      meta: { /* optional free-form */ },
    };
  },
  async understand({ source, before, after, root }) {
    return {
      severity: 'none' | 'low' | 'medium' | 'high',
      confidence: 0..1,
      classification: { kind, subkind?, breakingRisk, novelty? },
      recommendation: 'TAKE' | 'REJECT',
      actionPlan: 'Step 1\nStep 2\n...',          // newline-delimited; rendered as a checklist
      evidence: [{ type, path?, ref?, excerpt? }],
      headline: 'Short one-line summary',
      why: ['Bullet 1', 'Bullet 2'],
    };
  },
};
```

Return `{ error: '...' }` from `detect` for recoverable issues; orchestrator logs it as a REJECT card without crashing other sources.

## Notes on side effects

- The orchestrator never modifies a tracked source file under the user's control. It only writes:
  - `knowledge/sync/snapshots/*.json` (gitignored)
  - `knowledge/sync/runs/<runId>/*` (gitignored)
  - `knowledge/sync/decisions/<source>/<runId>.jsonl` (committed audit trail)
  - `knowledge/sync/views/<runId>.md` and `<runId>-actions.md` (committed)
  - `knowledge/docs-cache/<slug>.txt` (gitignored, raw fetched content for diff)
- `tools/elevate-sync.js --digest` and `tools/upstream-check.js --update` advance their own tracking state when the user runs them manually as part of an action plan. Sync never invokes those `--update`/`--digest` modes itself.
