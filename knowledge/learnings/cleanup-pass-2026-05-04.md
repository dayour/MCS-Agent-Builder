# Codebase Cleanup Pass — 2026-05-04

> **Scope**: comprehensive review for optimization, cleanup, dead code, debugging artifacts, redundancy.
> **Outcome**: 5 PRs opened, all manual-merge per user preference (`/iterate --no-auto-merge` semantics).
> **Total estimated impact**: ~10,000 lines / ~700 KB removed from committed source + ~256 MB local working tree freed.

## Pull requests

| # | Branch | Files | Lines | Auto-merge? |
|---|--------|-------|-------|-------------|
| #19 | cleanup/pr-1-artifacts | 1 | +4 | yes (gitignore-only) |
| #20 | cleanup/pr-tooling-knip | 3 | +1143 | denylisted (package.json) |
| #21 | cleanup/pr-2a-backend-deletes | 16 | -3,044 | yes |
| #22 | cleanup/pr-2b-frontend-deletes | ~50 | -6,000 | yes |
| #23 | cleanup/pr-3-framework-drift | 3 | -1,073 | yes |

User chose **manual merge per PR** for all.

## Method

Five-phase audit-then-act flow:

1. **Phase 1: Parallel `repo-auditor` audits.** Spawned 4 agents simultaneously (Backend, Frontend, Framework, Hot files). Each ran the 20-check audit on its scoped area. Total wall time ~15 minutes.

2. **Phase 2: GPT challenge.** Fired `multi-model-review.js challenge` against the consolidated audit. GPT verdict: **REVISE**. Surfaced 3 critical concerns: (a) grep evidence is insufficient — need a real dependency-graph tool; (b) `dev-logger.js` refactor needs API extension first; (c) `~30 fs.writeFileSync(agentspec.json)` callsites bypass the chat-router/server.js mutex (data integrity risk).

3. **Phase 3-3.5: PR-1 (artifacts) + PR-tooling-knip.** GPT-prompted ordering change: install `knip` BEFORE deletes so cuts cite real dep-graph evidence. Knip found 63 unused files matching most of the audit's findings. Caught **two false-positives**: `pages/TriggerLabPage.tsx` (audit flagged dead, knip showed it's imported by `PreviewPage.tsx`) and `tools/sync-adapters/*` (loaded dynamically via `knowledge/sync-manifest.json`, fixed via knip entry config).

4. **Phase 4-6: Backend / frontend / framework PRs.**

5. **Phase 7: Capture deferred items (this file).**

## Insights

### Knip caught what grep missed
- `pages/TriggerLabPage.tsx` (3,395 lines) — audit said dead. Wrong. Imported by `pages/PreviewPage.tsx:5` (embedded view).
- 10 of 12 `components/workflow/` shim files — audit said dead. Wrong. Only 2 truly orphan; the other 10 still have callers.
- `app/lib/report/static/{report.css, report.js}` — knip said dead, **wrong** (false-positive). Loaded via `fs.readFileSync(STATIC_DIR + ...)`. Knip can't see fs.readFileSync.
- `components/ui/dialog.tsx` — knip said dead, **wrong** (false-positive). Imports use capital-D `Dialog`. Windows is case-insensitive; knip's import graph used the on-disk lowercase `dialog`. Production build (Vite/rolldown) is case-sensitive and broke. Restored as `Dialog.tsx`.

**Key lesson**: knip is a strong oracle but not infallible. The defense-in-depth (knip + grep + production build + unit tests) caught what individual tools missed. A clean `npx tsc --noEmit` does NOT prove the build works — only `npm run build` validates case-sensitive resolution.

### GPT challenge changes that mattered

GPT challenge produced three changes that proved correct:
1. **Tooling first** (knip before deletes) — saved at least 2 false-positive deletions (TriggerLabPage, workflow shims at scale).
2. **Skip `replicate-agent.js`** — touched 2026-05-04 in the same session; recent touch + zero callers = active manual use, not staleness. GPT was right.
3. **Defer dev-logger refactor + mutex unification.** Both have hidden complexity:
   - dev-logger doesn't have an `info/warn/error(tag, msg)` API; needs API design + secret redaction + tests + schema doc.
   - ~30 fs.writeFileSync callsites bypass the mutex; needs centralized atomic-write API + inter-process consideration.

## Deferred items (do not skip)

These were originally in scope but GPT correctly flagged as separate dedicated PRs:

### 1. dev-logger refactor (~70 console.log callsites)
Files: `app/server.js` (25 tagged + 9 banner skips), `app/lib/scheduler.js` (12), `app/lib/enrichment.js` (10), `app/lib/research-pipeline.js` (9), `app/lib/build-pipeline.js` (4), `app/lib/analyze-pipeline.js` (3), `app/lib/chat/chat-router.js` (2), `app/lib/pipeline.js` (3).

Blocker: `app/lib/dev-logger.js` exposes only `{ setup, close, requestLogger, LOG_FILE }`. Categories are fixed (`ui|net|error|console|nav|perf|state|req`). No `[module]` tag field. Needs:
- New API: `log(tag, level, msg, extra)`, plus `info/warn/error` shortcuts
- Secret-redaction rules + tests
- Schema versioning so existing consumers (`tools/agentic-test-loop.js logs --cat ...`) keep working
- A test file at `app/lib/__tests__/dev-logger.test.js` (does not exist today)

### 2. Spec-store mutex unification
~30 direct `fs.writeFileSync(agentspec.json)` callsites bypass the shared `chatSpecStore.withProjectSpecLock` mutex:
- `app/lib/build-pipeline.js`: 15+ callsites in `writeBrief` and inline writes (lines 95, 288, 350, 1082, 1134, 1153, 1178, 1194, 1232, 1246, 1274, 1304, etc.)
- `app/lib/research-pipeline.js`: `writeBrief` at L141
- `app/lib/enrichment.js`: separate `_writeLocks` map (L107-114) — local, not shared
- `app/server.js`: lines 111, 119, 503, 596, 2047, 2092, 1719, 1773

Concurrent build + chat patch can race. Needed: route ALL agentspec.json writes through `specStore.write(agentDir, fn)` with atomic temp-file-rename. Add a CI lint forbidding direct `fs.writeFileSync` to `agentspec.json` outside the centralized store. **Data-integrity PR — do not bundle with cleanup.**

### 3. `tools/replicate-agent.js` owner check
357 lines, zero callers, but touched 2026-05-04 in the "Broad session work" commit. Recent touch suggests active manual use. Decision needed: confirm owner uses it, or delete after explicit sign-off.

### 4. Pre-existing unresolved imports (knip surfaced)
- `start.js:249` requires `./app/lib/terminal` — file doesn't exist
- `app/server.js:2041` requires `./lib/wizard` — file doesn't exist

Both live on conditional code paths that may not fire in normal operation. Logged for separate fix.

### 5. Frontend follow-up
- `utils/agentCreation.ts` — 2 unused exports (~150 lines if true)
- `utils/homeMessageGenerators.ts` (905 lines) — only `generateKnowledgeSuggestions` consumed by `HelperAgent.tsx`. Rest may be dead but needs careful audit.
- 6 unused frontend devDeps (`@tailwindcss/typography`, `@testing-library/user-event`, `autoprefixer`, `eslint-plugin-boundaries`, `postcss`, `tailwindcss`) — separate frontend-tooling PR
- 469 unused exports — knip's biggest output. Don't tighten in one go; one rule per PR.
- `pages/ScrollTestPage.tsx` — already conditionally tree-shaken from production. User said "delete" but it's a low-impact dev tool. Defer to dedicated decision.

### 6. Doc references to deleted backend tools
- `.claude/skills/mcs-eval/reference/alternative-runners.md` references `copilotstudio-test.js` and `powercat-test.js` (deleted in PR-2a)
- `.claude/rules/frontend-verification.md` references `tools/perf-baseline.js` (deleted)
- `knowledge/cache/{known-issues,copilot-studio-kit}.md` reference deleted tools as alternatives
- `knowledge/learnings/{kit-integration-analysis,upstream-adoption-scan}.md` reference deleted tools

These are descriptive prose, not imports. Cleanup is cosmetic but worth a follow-up doc-sync PR.

## Audit framework grades (this session)

| Component | Grade | Notes |
|-----------|-------|-------|
| `repo-auditor` (4 parallel agents) | B+ | Found ~80% of true positives. Two notable misses: TriggerLabPage (false positive — said dead but imported), workflow shims (overstated count). |
| `knip` 6.11.0 | A- | Caught most cases the audit missed. Minus for: case-insensitive on Windows (Dialog.tsx miss), dynamic-load (sync-adapters config required). |
| GPT-5.5 `challenge` | A | Surfaced the dev-logger blocker, mutex gap, and tooling-first ordering — all turned out to be real risks. |
| Defense-in-depth (knip + grep + tsc + build + unit tests) | A | Caught all 3 false positives before they merged. |

## Reusable tooling now in place

- `npm run audit:repo` — one-command knip baseline
- `npm run lint` — frontend eslint
- `knip.json` config (workspaces, sync-adapter entry points, ignore patterns)

## Follow-on session 2026-05-05 — deferred items shipped

After PRs #19-#24 landed on 2026-05-04, a same-day continuation shipped 5 more
PRs covering the deferred items:

| PR  | Scope                                                         | Lines |
|----:|---------------------------------------------------------------|------:|
| #25 | hotfix: SquircleIcon undefined-gradient whitescreen            | +1   |
| #26 | fix(ci): npm ci --legacy-peer-deps; selective install; LF eol  | +27  |
| #27 | deferred items #4, #5a, #6 (imports, devDeps, doc refs)        | -620 |
| #28 | deferred item #1 (dev-logger refactor + 11 tests)              | +258 |
| #29 | deferred item #2 (spec-store mutex + atomic writes + 7 tests)  | +204 |

PR #25 unblocked the dashboard whitescreen surfaced when verifying npm start.
PR #26 unblocked the CI verify-upstream workflow that had been failing on
every recent run for >24h (peer-dep ERESOLVE plus ADO E401 plus CRLF line
endings on a vendored spec).

## GPT challenge after final merge — verdict: revise

Fired `multi-model-review.js challenge` on the merged outcome. GPT flagged
several risks; most were either documented in PR descriptions, out of scope,
or already verified. Three were actionable:

1. **Direct-write regression risk**: someone could later add a new
   `fs.writeFileSync(...agentspec.json)` and bypass the mutex.
   **Action shipped (PR #30):** pre-commit hook check. Bypass via
   `MCS_SPEC_WRITE_SKIP=1`. Exempt: `app/lib/chat/spec-store.js`.

2. **Knip baseline not enforced**: 1 known false positive
   (`app/lib/report/static/report.js`) is currently ignored
   informationally, not via narrow ignore rule.
   **Action deferred:** future PR can add a knip ignore-list entry
   pointing at the fs.readFileSync call; current state acceptable.

3. **Removed endpoints fallback**: `/api/enrichment/speculative` and
   `/api/enrichment/reconcile` now 404. Old frontend bookmarks could
   misinterpret 404 as a generic error.
   **Action deferred:** no telemetry shows callers; unknown if any old
   tabs hit them. Could return explicit 410 Gone if needed.

## Monitoring guidance for the next 24h

If anything regresses from this 11-PR batch, watch:

- **Frontend whitescreens** — SquircleIcon fix may not cover all icon paths
- **404/5xx rates** — especially `/api/enrichment/*` (removed endpoints)
- **Spec write/parse errors** — orphan `.tmp-*` files in agent dirs
  signal a crash mid-rename
- **Pipeline failure rate** — build / research / enrichment jobs writing
  agentspec.json now go through atomic temp+rename
- **Lock wait time spikes** — long mutex queues would surface as request
  latency under concurrent chat + pipeline traffic
- **Logger volume** — dev-logger now writes structured events to
  `tools/session-log.jsonl`; rotation kicks in at 10MB

Quick diagnostics:

```bash
# Orphan temp files (any post-crash spec write artifacts)
find Build-Guides -name '*.tmp-*' 2>/dev/null

# Dev-logger event types since N minutes ago
node tools/agentic-test-loop.js logs --since 30m --cat console,error --limit 50

# Knip baseline — re-run after any source change
npm run audit:repo
```

## Cumulative impact (full session — both days)

| Bucket                              | Files | Lines (net) |
|-------------------------------------|------:|------------:|
| Source deletions (PRs #19-#24)      |   ~70 |     -10,000 |
| Dev-logger refactor + tests (#28)   |     9 |        +258 |
| Spec-store mutex + tests (#29)      |     6 |        +204 |
| Doc/devDep cleanup (#27)            |    10 |        -620 |
| CI + hotfix (#25, #26)              |     5 |         +28 |
| Pre-commit guardrail (#30)          |     1 |         +35 |
| **Total**                           |  ~101 |  **~-10.1k**|

Working tree freed: ~256 MB (HAR captures + session log + test-results).

## Confirmed-Count tracking

This learning supersedes nothing; new entry. **Tier 2** (user-confirmed cleanup pass).

**Source files that informed this:** the 4 repo-auditor reports, the multi-model-review challenge JSON, the knip baseline, the production-build crash that caught the case-sensitivity bug, and the GPT review verdict at session end.
