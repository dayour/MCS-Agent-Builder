---
created: 2026-04-17
owner: whoever ships the next build-pipeline change
related:
  - tools/typed-adoption-stats.js
  - app/lib/build-pipeline.js (evalSets block)
  - tools/upstream-specs/maker-eval-write.md
status: active gate
---

# Typed-adoption cutover criteria

The build-pipeline eval-set creation path currently runs **typed-first with
legacy Dataverse fallback**. The legacy path was proven reliable before the
migration; the typed path is new. This document defines exactly when the
legacy fallback code can be deleted.

## Why a gate exists

The typed write path was unblocked on 2026-04-17 after a HAR capture revealed
missing `$kind` discriminators. One HAR was enough to build the adapter and
pass live smoke, but it is not enough to prove the adapter handles every
real-world shape a maker will produce — CSV uploads with unicode, long
prompts, empty expected outputs, retries under load, etc.

The fallback is a safety net. It stays until real builds show it's not
needed.

## Measurement source

`tools/typed-adoption-stats.jsonl` is appended to on every `/mcs-build` run
that touches evalSets. Each record is:

```
{
  "ts": "2026-04-17T00:00:00.000Z",
  "build_run_id": "<tsMs>_<commit>",
  "commit_sha": "<sha>",
  "env_hash": "h_<12hex>",
  "bot_hash": "h_<12hex>",
  "typed_sets": N,
  "legacy_sets": N,
  "typed_tests": N,
  "legacy_tests": N,
  "fallback_reasons": ["set: <msg>", ...]
}
```

Env and bot IDs are hashed so the file is safe to share. `build_run_id`
makes retried builds deduplicable.

View the aggregate with:

```
node tools/typed-adoption-stats.js
node tools/typed-adoption-stats.js --since 14d
node tools/typed-adoption-stats.js --last 50
```

## Gate conditions to remove the legacy fallback

**ALL of the following must hold** at the moment the legacy removal PR lands:

1. **Volume.** `node tools/typed-adoption-stats.js --since 30d` reports at
   least **30 unique `build_run_id`s** in the last 30 days.
2. **Purity.** `all-typed` share in that window is **>= 98%**. (Two fallback
   builds in 100 is acceptable noise from transient Gateway issues; more
   than that indicates a real shape the typed path can't handle.)
3. **Distinct breadth.** The 30-day window covers **>= 3 distinct
   `env_hash`** values AND **>= 5 distinct `bot_hash`** values. This
   prevents cutover based on a single developer's local loop.
4. **Fallback reasons triaged.** Every unique message in `fallback_reasons`
   within the window is either (a) a known transient (timeout/5xx) with a
   retry design documented, or (b) a fixed adapter bug with its commit
   linked in this doc. No unknown reasons remain.
5. **Delete operation covered.** Typed Delete is implemented (second HAR)
   OR the pipeline never needs to delete eval components (confirmed via
   code audit) OR the Dataverse DELETE fallback is wired into the
   cleanup-on-error path and exercised by at least one failed-build
   record.

## Rollback triggers (when to re-enable fallback after cutover)

If the legacy fallback has been deleted and either of the following fires,
restore it in the next deploy:

- `all-typed` share drops below **95%** in a rolling 7-day window.
- Any single `fallback_reason` message appears in **>= 3 consecutive
  build_run_ids** from distinct env_hash values.

## What this gate does NOT cover

- Performance (latency between typed vs legacy — not currently measured).
- Downstream eval execution success (the tests are created; do they then
  run correctly? outside this scope — owned by eval-pipeline).
- Cross-region behavior (dktest is US-IL301; other regions untested).

## Owner responsibilities when considering cutover

1. Run `node tools/typed-adoption-stats.js --since 30d` and paste output
   in the cutover PR.
2. Review every unique `fallback_reasons` message. Classify each.
3. Confirm the Delete story (typed, unneeded, or DV-fallback).
4. Keep the fallback deletion in its own commit, behind its own PR, so
   rollback is a single revert.
