# Sync Orchestrator — Runtime Store

Runtime artifacts for `tools/sync-orchestrator.js`. See `.claude/skills/mcs-sync/SKILL.md` for usage. See `knowledge/sync-manifest.json` for the source registry.

## Layout

| Path | Committed? | Purpose |
|---|---|---|
| `snapshots/<source-id>.json` | **No** (gitignored) | Last observed fingerprint per source. Rewritten on every non-detect run. |
| `runs/<runId>/` | **No** (gitignored) | Per-run ChangeRecord JSONs + triage.json. Working memory. |
| `decisions/<source-id>/<runId>.jsonl` | **Yes** | Hash-chained decision log. Canonical machine truth. Append-only. |
| `views/<runId>.md` | **Yes** | Human-readable triage, regenerated from decisions. Never hand-edit. |

## Why the split

- Snapshots and runs are machine state — they churn on every refresh and would pollute git history.
- Decisions are the audit record. Partitioned by source/run to avoid merge conflicts when two branches decide on the same source.
- Views are derived artifacts. Git history of this folder shows the team's triage decisions over time.

## Do not hand-edit views

Views regenerate from decisions every time `decide` runs. Any manual edit is lost on the next regeneration. If you need to annotate, add the rationale in the `--reason` flag:

```bash
node tools/sync-orchestrator.js decide <changeId> merge --reason "pulling new Tier 1 rows for mcp-servers"
```
