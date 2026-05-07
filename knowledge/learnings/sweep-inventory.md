# Codebase Sweep — Final Status

> 2026-04-14. GPT-5.4 review-code (14 batches, 24 files, ~$1.50) + repo-auditor agent.
> Total findings: ~120. Sweep substantially complete — 8 items remain for backend.

---

## Result Summary

| Phase | Scope | Status | Fixed | Remaining |
|-------|-------|--------|-------|-----------|
| **1. Security** | All `execSync` + path traversal + prompt injection | **DONE** | 7/7 | 0 |
| **2. Core Bugs** | 28 high-severity bugs across 12 files | **DONE** | 28/28 | 0 |
| **3. Error Handling** | JSON parse safety, score validation, silent catches | **Substantially done** | 25+ sites | CSV parser, CLI arg validation (deferred) |
| **4. Dead Code** | Unused imports, duplicated logic, unbounded maps | **Deferred** | 2 items | Memory fix needed (see below) |

**Zero `execSync` in tools/** and app/lib/**. 38 remain in low-risk infra (start.js, bin/, scripts/).**

---

## Shared Helpers Created

| File | Exports | Purpose |
|------|---------|---------|
| `tools/lib/safe-exec.js` | `safeExec`, `shellTool`, `nodeExec`, `ALLOWED_TOOLS` | Safe process execution — tool allowlist, Windows cmd.exe resolution, structured returns |
| `tools/lib/ids.js` | `generateId`, `shortId` | Collision-safe IDs via `crypto.randomUUID()` |
| `tools/lib/safe-json.js` | `readJsonFile`, `extractJson` | JSON file reading with error context + LLM output JSON extraction |
| `app/lib/spec-io.js` | `resolveSpecPath`, `readBrief`, `writeBrief` | Canonical spec file I/O (writes to source file, not always agentspec.json) |

---

## Phase 1: Security — ALL DONE

| # | File | Fix | Session |
|---|------|-----|---------|
| S1 | enrichment.js | `execSync` → `nodeExec` | Backend |
| S2 | pipeline.js | `execSync` with `solutionName` → `shellTool` (args array) | Backend |
| S3 | pipeline.js | Path traversal guard: `ID_RE = /^[\w-]+$/` | Backend |
| S4 | wizard.js | Symlink rejection via `lstatSync` | Backend |
| S5 | wizard.js | Anti-injection instruction on doc context | Backend |
| S6 | solution-library.js | 7 `execSync` → `safeExec`/`shellTool` | Tooling |
| S7 | fix-pipeline.js | LLM output validated before persisting | Backend |

---

## Phase 2: Core Bugs — ALL DONE

| # | File | Fix | Session |
|---|------|-----|---------|
| B1 | anthropic.js | Fallback chain only goes down (never escalates tier) | Tooling |
| B2 | anthropic.js | `normalizeModelKey()` maps full model IDs → shorthand | Tooling |
| B3 | anthropic.js | Already correct (GPT false positive) | — |
| B4 | anthropic.js | Streaming has Copilot→Anthropic fallback | Tooling |
| B5 | anthropic.js | `done` event on stream end + cost tracking + `incomplete` flag | Tooling |
| B6 | enrichment.js | Write lock recovers from prior failures | Backend |
| B7 | enrichment.js | `conversations` merged, not replaced | Backend |
| B8 | enrichment.js | `generateId()` UUID replaces `Date.now()` | Backend |
| B9 | eval-scoring.js | GeneralQuality uses caller threshold (was hardcoded 50) | Tooling |
| B10 | eval-scoring.js | PlanValidation filters empty tool names | Tooling |
| B11 | pipeline.js | `Array.isArray(evalSets)` check | Backend |
| B12 | pipeline.js | `generateId()` UUID | Backend |
| B13 | pipeline.js | Failed steps now `"failed"` not `"completed"` | Backend |
| B14 | fix-pipeline.js | `spec-io.js` writes to source file | Backend |
| B15 | fix-pipeline.js | `baseDir` passed through directly | Backend |
| B16 | fix-pipeline.js | No longer force-writes `pass: true` | Backend |
| B17 | fix-pipeline.js | Per-agent `_activeAgents` Set + reject-if-busy | Backend |
| B18 | island-client.js | Lazy PVA auth — BAP commands skip gateway auth | Tooling |
| B19 | mcs-lsp.js | patchMetadata only patches comment-header format | Tooling |
| B20 | flow-manager.js | `validate` in `noOrgCommands` | Tooling |
| B21 | flow-manager.js | `discoverCopilotParam` filters by botId | Tooling |
| B22 | flow-manager.js | Power Platform API gets own token | Tooling |
| B23 | wizard.js | Model-aware config gate | Backend |
| B24 | wizard.js | Dual-model guarded on `anthropicApi.isConfigured()` | Backend |
| B25 | wizard.js | `mergeDrafts` merges arrays by `name` key | Backend |
| B26 | readiness.js | Published → "deployed" terminal state | Backend |
| B27 | workiq.js | Non-zero exit always returns error | Backend |
| B28 | workiq.js | Stale content on no-data results | Backend |

---

## Phase 3: Error Handling — Substantially Done

| Item | Status | Session |
|------|--------|---------|
| `tools/lib/safe-json.js` created | DONE | Tooling |
| eval-scoring: `\|\| 70` → `?? 70` (4 sites) | DONE | Tooling |
| eval-scoring: GPT score validation (clamp 0-100, reject NaN) | DONE | Tooling |
| eval-scoring: `_parseGptJson` → `extractJson` | DONE | Tooling |
| eval-scoring: 2 unprotected JSON.parse → `readJsonFile` | DONE | Tooling |
| island-client: `loadGatewayFromConfig` → `readJsonFile` (surfaces corruption) | DONE | Tooling |
| island-client: 2 unprotected JSON.parse → `readJsonFile` | DONE | Tooling |
| multi-model-review: 12 unprotected JSON.parse → `readJsonFile` | DONE | Tooling |
| solution-library: `loadIndex` ENOENT vs corruption | DONE | Tooling |
| enrichment.js: JSON extraction dedup (6 workers) | DONE | Backend |
| projects.js: `isV2()` null guard | DONE | Backend |
| projects.js: `scanAgents` per-entry try/catch | DONE | Backend |
| Silent catch{} audit | Deferred — most intentional | — |
| CLI arg validation (island-client, flow-manager, mcs-lsp) | Deferred — risks breaking scripts | — |
| CSV parser quoted newlines | Deferred — needs library | — |

---

## Phase 4: Dead Code — Deferred (except memory fix)

Low-priority cleanup items. Not blocking, can be done in a future session.

**One item warrants attention:** unbounded in-memory maps in the long-running server.

| Pattern | Files | Status |
|---------|-------|--------|
| `_jobs` Map grows unbounded | enrichment.js | [DONE] 30min TTL prune + 200 cap + 10min interval |
| `_writeLocks` Map grows unbounded | enrichment.js | [DONE] Auto-delete when lock settles (no newer lock) |
| `_packageJobs` Map grows unbounded | pipeline.js | [DONE] 30min TTL prune + 10min interval |
| Unused imports, constants | fix-pipeline, projects, workiq | Deferred |
| Duplicated bot component scaffold | island-client | Deferred |
| Duplicated HTTP/PATCH boilerplate | flow-manager | Deferred |
| `calcReadiness`/`isBuildReady` overlap | readiness.js | Deferred |

---

## Repo Auditor Findings

| # | Item | Status |
|---|------|--------|
| R1 | `start.js` broken require to deleted `terminal.js` | [DONE] Tooling |
| R2 | `brief-migrate.js` dead file | [DONE] Backend |
| R3 | `readBrief()` x3 → extracted to `spec-io.js` | [DONE] Backend |
| R4 | Frontend temp files (`tmp-debug.cjs`, `tmp-final-verify.cjs`) | FRONTEND |
| R5 | CLAUDE.md missing 9 file listings | Deferred |
| R6 | 17 files >50KB | Deferred |

---

## GPT Review Costs

| Batch | Files | Cost |
|-------|-------|------|
| Phase 0 inventory (11 batches) | 24 files | ~$0.68 |
| Phase 1-3 reviews (3 batches) | safe-exec, ids, anthropic, eval-scoring | ~$0.16 |
| Challenge + ask calls (~10) | — | ~$0.15 |
| **Total** | | **~$1.00** |

## Post-Sweep Quality Scores

| File | Before | After | Delta |
|------|--------|-------|-------|
| eval-scoring.js | 6 | 7 | +1 (B9/B10 + Phase 3 hardening) |
| anthropic.js | 6 | 7* | +1 (B1-B5 model routing fixes) |
| ids.js | — | 10 | New file |
| safe-exec.js | — | 7* | New file (after GPT revision) |
| All others | 5-6 | 6-7* | +0.5-1 avg (execSync removal + bug fixes) |

*Estimated based on fixes applied; not re-scored by GPT.
