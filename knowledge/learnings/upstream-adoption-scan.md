---
scan_date: 2026-04-16
scanner: Claude Opus 4.7 + GPT-5.4 (co-generation)
repos_scanned:
  - https://dev.azure.com/msazure/CCI/_git/BotDesigner (master @ dcef79e4)
  - https://dev.azure.com/msazure/CCI/_git/ObjectModel (master)
local_checkouts:
  - /tmp/mcs-upstream/BotDesigner
  - /tmp/mcs-upstream/ObjectModel
status: Phase 1 in progress — adapters built, live smoke pending user
confidentiality: Microsoft-internal use only
---

> **Status update (2026-05-05):** Several tools referenced in this scan
> — `tools/list-bot-dialogs.js`, `tools/dataverse-tables.js`,
> `tools/copilotstudio-test.js`, `tools/powercat-test.js`,
> `tools/parse-har-*.js` — were removed in cleanup PR #21 because
> they had zero callers and were not consumed by the active typed-adapter
> path. The "delete `parse-har-*.js`" deprecation gate (item 17 below) is
> satisfied. Restore from git history (commit `b60da346`) if any of these
> are needed for upstream adoption work.

## Phase 1 Progress (live)

| Commit | Phase | Delivery |
|---|---|---|
| `c16b354a` | 1a | Vendored spec + 26K-line generated TS types + tooling |
| `497e1c8e` | 1b | `listDialogs()` typed adapter (paged response) |
| `8e08ecab` | 1b-fix | HTTPS enforcement + shape-check tightening per GPT review |
| `71e62456` | 1c | `getSystemDialogs()` typed adapter (bare array response) |
| `c73af084` | 1d | `getSystemIntents()` + extracted generic validator |
| `107438fd` | 1e | `getDialogById()` typed adapter (detail endpoint) |
| `5e073b0c` | refactor | Extracted `typedGetFromGateway()` helper — 4 adapters collapsed |
| `362af955` | hardening | `npm run assert:regen-clean` drift detector |

**Unit tests:** 110/110 passing across the full suite (includes existing 84 + 26 new). Typecheck green.

**Adapters shipped:**
- `listDialogs` → `PagedQueryResponseOfDialog` (paged envelope shape)
- `getSystemDialogs` → `Dialog2[]` (bare array shape)
- `getSystemIntents` → `Intent2[]` (bare array shape)
- `getDialogById` → `Dialog2` (single object shape)

**Shared plumbing:**
- `typedGetFromGateway()` — canonical fail-fast: hostname allowlist (HTTPS-only suffix match), status 200, JSON content-type, shape validator, redacted error preview
- `RoutingMisconfiguredError` — single error taxonomy across adapters
- `isPagedDialogsShape`, `isBareObjectArrayShape`, `isNonEmptyObjectShape` — three shape validators covering the response variants we've seen so far
- `npm run assert:regen-clean` — drift detector for CI and pre-push

**Blockers resolved in this session:**
- ✅ **Live smoke:** all 3 adapters proven end-to-end against `dktest` env (`f9a0cae4-a7e5-e91a-b358-9b848e12071c`) in the M365CPI admin tenant. `list-dialogs` returned `msdyn_searchknowledgearticleprivatetopic`; `get-system-dialogs` and `get-system-intents` returned valid empty arrays. HTTP 200, JSON content-type, shape validation all passed on real Gateway traffic.
- ✅ **Phase 2 npm package:** `microsoft-agents-objectmodel@2026.3.2-1` installed via `az` CLI token (no third-party auth tool needed). 2,715 runtime exports reachable. `npm run auth:ado-npm` refreshes ~/.npmrc from the Microsoft tenant AAD token.

**Open blockers (revised):**
- Phase 3 (Graders) pivoted: the `Microsoft.Agents.Graders.csproj` has cascading dependencies on internal `MakerEvaluation.*`, `ManagedStore.*`, `Infrastructure.Common.*` projects that need full BotDesigner monorepo build + internal NuGet feed auth. The sidecar-on-dev-box plan was overkill. **New plan:** hand-write typed adapters for `MakerEvaluationV2Controller` endpoints (same Phase 1 pattern) and call the live MCS service instead of running graders locally. Endpoint shapes must be hand-derived from C# controller source because the 2022-01-15 botmanagement.json spec predates this controller.
- Phase 4 (DirectLine CLI) — not started. `Microsoft.CCI.Tools.DirectLineCommand` is a published NuGet global tool (`dotnet tool install --global Microsoft.CCI.Tools.DirectLineCommand`) so this is low-risk whenever we get to it.
- Frontend type adoption — parked per user instruction. Elevate Figma migration is in-flight on `elevate-migration` branch; types from `microsoft-agents-objectmodel` will be wired in once UI stabilizes.

**Reader layer added (wiring started):** `app/lib/readers/dialogs.js` wraps the Phase 1 typed adapters and exposes three modes — `typed` (default), `legacy` (keep using `readComponents` + filter), and `shadow` (call both, diff, return typed). Mode is picked from `MCS_DIALOGS_MODE` env var or an opt param. Tests (`app/lib/__tests__/readers-dialogs.test.js`): 9/9 pass.

**First CLI consumer:** `tools/list-bot-dialogs.js` drives the reader end-to-end with `--mode typed|legacy|shadow`.

**Live finding via shadow-mode parity (2026-04-16 dktest, Daily Briefing bot):**

```
typed (/api/botauthoring/v1/dialogs)    → 0 dialogs
legacy (readComponents + filter)         → 25 DialogComponents
onlyInTyped=[] onlyInLegacy=[25 GUIDs]
```

The typed `Dialogs_Get` endpoint is NOT a drop-in replacement for `readComponents` + DialogComponent filter. Explicit `filter=Regular` returns 1 dialog (`msdyn_searchknowledgearticleprivatetopic`); no filter returns 0. The legacy path reads ALL `botcomponent` rows of DialogComponent kind including scaffolded, system-owned, and knowledge article topics. The typed path is curated to "Regular" / "System" published dialogs only.

**Implication for migration:** any code that today reads the full DialogComponent set via `readComponents` must continue doing so until we identify per-consumer what subset they actually need. Shadow mode is the right tool for every subsequent migration decision.

---

# Upstream Adoption Scan — BotDesigner + ObjectModel

> **Bottom line.** The full 493-endpoint OpenAPI spec for the Copilot Studio control plane exists. The ObjectModel ships as a published npm package (`microsoft-agents-objectmodel`) plus a 48-command WASM runtime. A `Graders/` C# library with 13+ production graders (BLEU, ROUGE, Cosine, LLM-based abstention/groundedness/coherence) exists. We've been reverse-engineering all three. Pilot results should tell us how much of the reverse-engineered path we can retire.
>
> **Scope of confidence.** OpenAPI codegen covers request/response shapes. It does NOT automatically capture: long-running operation polling, retry/backoff strategies, auth token acquisition, multi-step workflow semantics (publish pipelines, snapshot generation, bot create → provisioning), feature-flagged tenant availability, or unpublished server fields. Mark async/LRO endpoints as **wrap/extend**, not **replace**, until contract tests confirm parity.
>
> **Internal-use warning.** This document references internal repo URLs, endpoint paths, private package feeds, and local checkout locations. Keep in the private repo. If this repo is ever mirrored externally, split sensitive data into an `internal-appendix.md` that is gitignored or stored out-of-tree.

## 1. Repos Inventory

### BotDesigner — the Copilot Studio monorepo
- **Scale:** 60,421 files on master, 70+ top-level src dirs.
- **Branch:** `master`, HEAD `dcef79e4` (Apr 2026 — Update InlineAgents offline evaluation test suites).
- **Key areas relevant to us:**
  | Area | Purpose | Our tool it touches |
  |---|---|---|
  | `src/BotDesigner.Management.Server/Swagger/2022-01-15/botmanagement.json` | **OpenAPI 2.0 spec, 493 endpoints, 361 definitions, 83 tags.** Generated by NSwag 13.16.1.0. | `tools/island-client.js`, `tools/mcs-lsp.js`, `tools/dataverse-tables.js`, `tools/add-tool.js`, `tools/replicate-agent.js` |
  | `src/BotDesigner.Management.Server/BotDesigner.Citizen.Server/` | Management API implementation (the 493 endpoints) | same |
  | `src/BotDesigner.Management.Server/Microsoft.Bot.ControlPlane.MinimalBot.Api/` | MinimalBot control plane (light-weight API) | `tools/replicate-agent.js` |
  | `src/BotDesigner.Management.Server/SynchronizationWorker/` | Background worker that syncs Dataverse | Whole wizard/build pipeline |
  | `src/MakerEvaluation/` | Orchestration for eval runs (Durable Task, Cosmos DB) | `app/lib/eval-pipeline.js` |
  | `src/Graders/Microsoft.Agents.Graders/` | 13+ grader implementations, factory, result model | `tools/eval-scoring.js` |
  | `src/Evaluation/Microsoft.Bot.EvaluationService/` | Bot response quality evaluator microservice (LLM-based) | `tools/eval-scoring.js` |
  | `src/Evaluation/OfflineEvaluation/` | Python-based offline eval (Dispatcher, omega, test_suite_framework) | `app/lib/eval-pipeline.js` |
  | `src/AgentBuilder/` | AgentBuilder services (AgentBuilder.Web, AgentBuilder.Host) | `app/lib/build-pipeline.js` |
  | `src/AIService/` | AI processing, suggestion engines | `app/lib/enrichment.js`, `app/lib/research-pipeline.js` |
  | `src/Gateway/Microsoft.CCI.GatewayService/` | Gateway implementation | `tools/island-client.js` |
  | `src/Tools/DirectLineCommand/` | NuGet-published DirectLine CLI (`Microsoft.CCI.Tools.DirectLineCommand`) | `tools/direct-line-test.js` |
  | `src/Platform/Content.Validation/` | Bot content validation service | any yaml/topic linting |
  | `src/Platform/ContentConversion/` | Content conversion (format transforms) | `app/lib/spec-migrate.js`, `tools/om-cli` |

### ObjectModel — the schema & serialization library
- **Scale:** ~5148 files, full clone successful (1 long-path test fixture blocked by Windows MAX_PATH, non-critical).
- **Key areas:**
  | Area | Purpose | Our tool |
  |---|---|---|
  | `src/ObjectModel/DataModel.xml`, `BotDefinition.xml`, `SolutionComponents.xml` | Contract definitions — the single source of truth for every bot component shape | `tools/om-cli/` (we bundle the .NET binary) |
  | `src/Client/microsoft-agents-objectmodel/` | **Published npm package** `microsoft-agents-objectmodel@1.0.0` with all generated TS types, bot schemas, mappers, type guards, WASM wrappers | (none — we don't use this yet) |
  | `src/Wasm/Wasm.Core/Commands/` | **48 WASM commands** — client-side validators, converters, diagnostics, PowerFx, component graph, variable refs, DLP, localization, GPT export | (none) |
  | `src/Serialization/` | Fast JSON/YAML ser/des | `tools/om-cli` (bundled) |
  | `src/PowerFx/` | PowerFx integration | (none — we string-match PowerFx) |
  | `src/vscode/LanguageServers/PowerPlatformLS/` | Power Platform language server | `tools/mcs-lsp.js` (ours is wrapper; this is the real LSP source) |

## 2. The Five Highest-Leverage Wins

*Ordered by impact-per-effort — mirrors GPT-5.4's second-opinion recommendation.*

### #1 Replace reverse-engineered Gateway/Dataverse calls with a generated TS client
- **Source:** `botmanagement.json` (493 endpoints) + possibly additional swagger docs from MinimalBot and Gateway.
- **Effort:** Low — run `openapi-typescript` or `nswag` against the spec.
- **Impact:** High for simple CRUD endpoints. Medium for async/LRO flows (publish, bot create, snapshot) where the generated client is a starting point, not a drop-in replacement.
- **Why it matters:** Every endpoint currently referenced from `island-client.js` is in there — `PublishBot_PublishBotContent`, `BotsV2_BeginCreateBot`, `Dialogs_Get`, `Intent_Upsert`, `DataSources_UpsertDataSource`, `Skills_ValidateAndImportSkill`, `TopicSuggestion_StartTopicSuggestionJob`, `Validation_ValidateFlows`. We've been guessing names; the names are here. We still have to implement the workflow semantics around them.

### #2 Adopt `microsoft-agents-objectmodel` npm package as canonical schema layer
- **Source:** `ObjectModel/src/Client/microsoft-agents-objectmodel/` — published to Azure DevOps NPM feed (`pkgs.dev.azure.com/msazure/_packaging/CCI-Dependency/npm/registry/`).
- **Effort:** Low-medium. Requires `ado-npm-auth`, `.npmrc` pointed at feed, `rush update`. Replace our TypeScript `types/` and `app/frontend` schema files with the package.
- **Impact:** High for shape-sharing. Product-specific shapes (`EvalTest`, `AgentSpec` extensions) stay local. Drift is reduced **for the shapes the package owns**, not eliminated — feature flags, unpublished server fields, and version skew between spec and package can still diverge.
- **What it gives us:** `schema`, `yamlSchema`, `kinds`, `idTypes`, `valueTypes`, `enums`, `types`, `mapper`, `commands`, `type-guards`, `structuralIntegrityChecks`, `propertyPath`, `variable`, `powerFxJson`, `schemanameGenerator`, `idGenerator`.
- **Compatibility matrix:** Maintain in `tools/upstream-specs/compat.md` — pin `botmanagement.json` commit-hash + `microsoft-agents-objectmodel` version + our app version. Schema-validation tests against live payloads catch version skew.

### #3 Integrate `src/Graders/` as our eval scoring engine (or wrap via REST)
- **Source:** `BotDesigner/src/Graders/Microsoft.Agents.Graders/` — standalone C# library.
- **Effort:** Medium. Two paths:
  - **Direct:** spin up a thin .NET sidecar that exposes graders over HTTP/gRPC (low-risk, 100% parity).
  - **Indirect:** call `Microsoft.Bot.EvaluationService` REST API if available in the tenant.
- **Impact:** High. Our `tools/eval-scoring.js` currently does naive text matching + a few LLM calls. Graders gives: `ExactMatchGrader`, `PartialMatchGrader`, `IntentMatchGrader`, `CustomLabelsGrader`, `InvocationGrader`, `QualityMetricsGrader`, `WithRetrievedKnowledgeQualityGrader` (groundedness!), `WithoutRetrievedKnowledgeQualityGrader` (abstention!), `CoherenceGrader`, `CosineEmbeddingSimilarityGrader`, plus multi-turn versions. All production-tested.

### #4 Use `MakerEvaluation` as the eval orchestration and upload path
- **Source:** `src/MakerEvaluation/` + `MakerEvaluationV2Controller`.
- **Effort:** Medium. Route our `eval-pipeline.js` uploads through:
  - `POST /bots/{cdsBotId}/api/makerevaluation/testsets/{testSetId}/run` (PPAPI public)
  - `POST /environments/{envId}/bots/{cdsBotId}/makerevaluations/testcomponent` (test component upload — this is what we reverse-engineered)
- **Impact:** Medium-high. Kills the Island Gateway reverse-engineering for eval uploads. Gives us retries/cancellation/fair-usage policies for free.
- **Supported features:** Generate queries, start/get/cancel/delete runs, test sets, snapshots, feedback, share MCS connection, supportedKnowledgeSources.

### #5 Replace `direct-line-test.js` with `Microsoft.CCI.Tools.DirectLineCommand`
- **Source:** `src/Tools/DirectLineCommand/` — already published as a NuGet global tool (`dotnet tool install --global Microsoft.CCI.Tools.DirectLineCommand`).
- **Effort:** Very low. Install the tool, shell out from a thin wrapper.
- **Impact:** Medium. Our DirectLine client is ~500 lines of JS reverse-engineering. This tool handles auth, streaming, and is the canonical Microsoft CLI for this.
- **Modes:** `ModeAutomatic`, `ModeInteractive`.

## 3. Tool-by-Tool Adoption Map

Legend: **R** = replace outright, **W** = wrap upstream, **K** = keep (no upstream equivalent), **E** = extend upstream (use + augment).

| Our code | Lines | Current approach | Upstream equivalent | Action | Effort |
|---|---|---|---|---|---|
| `tools/island-client.js` | ~600 | Reverse-engineered Gateway API HTTP calls | `botmanagement.json` + generated TS client | **W** (simple CRUD calls can be **R** once parity-tested; LRO/publish/create stay **W**) | L–M |
| `tools/mcs-lsp.js` | ~400 | JSON-RPC wrapper over om-cli LSP | `ObjectModel/src/vscode/LanguageServers/PowerPlatformLS/` (full LSP) or `ObjectModel.Wasm` (browser) | **W** | M |
| `tools/add-tool.js` | ~500 | Hand-rolled MCP/connector discovery + Dataverse POST | `Skills_ValidateAndImportSkill` + `DataSources_UpsertDataSource` endpoints | **W** (multi-step import flow) | M |
| `tools/dataverse-tables.js` | ~200 | Raw Dataverse query via PowerShell helper | `botmanagement.json` endpoints + `ObjectModel/src/Platform` | **W** | L |
| `tools/replicate-agent.js` | ~300 | Dataverse clone of bot record | `BotsV2_BeginCreateBot` + `BotContent_GenerateSnapshot` | **W** (LRO with provisioning poll) | M |
| `tools/flow-manager.js` | ~400 | Dataverse POST to create agent flows | Native Power Automate API + `ObjectModel` flow serializer | **E** | M |
| `tools/eval-scoring.js` | ~600 | Text diff + OpenAI grader | `Microsoft.Agents.Graders` library (all 13+ graders) | **W** (sidecar wrapping the C# library) | M |
| `tools/direct-line-test.js` | ~500 | Hand-rolled Direct Line client | `Microsoft.CCI.Tools.DirectLineCommand` NuGet tool | **R** | L |
| `tools/copilotstudio-test.js` | ~200 | CopilotStudio SDK thin wrapper | Same, plus `MakerEvaluation` channel client | **E** | L |
| `tools/powercat-test.js` | ~150 | Kit SDK wrapper | Out of scope (Kit deferred per memory) | **K** | — |
| `tools/solution-library.js` | ~300 | Hand-rolled solution pattern library | (No upstream equivalent) | **K** | — |
| `tools/parse-har-*.js` | ~800 | Reverse-engineering HAR captures | **Dead code once #1 lands** | **R** (delete) | L |
| `tools/om-cli/` | bundled bin | Ship .NET binary | `microsoft-agents-objectmodel` npm + (optional) newer om-cli rebuilt from `ObjectModel/src/Cli` | **E** | M |
| `app/lib/build-pipeline.js` | ~900 | Orchestrates LSP + Gateway + Dataverse | Same orchestration, but over generated client + AgentBuilder service semantics | **E** | M |
| `app/lib/eval-pipeline.js` | ~800 | Our custom eval orchestration | `MakerEvaluation.Core` orchestration model (DTFx-inspired state machine) | **E** | M |
| `app/lib/spec-migrate.js` | ~400 | Hand-rolled schema migrations | `ObjectModel` Converters + schema versions | **E** | M |
| `app/lib/enrichment.js` | ~500 | LLM + cache to enrich agentspec | `AIService` suggestion engine (if exposed) | **K** (likely private) | — |
| `app/lib/wizard.js` | ~600 | Our intake workflow | (no equivalent — product-specific) | **K** | — |
| `app/lib/readiness.js` | ~300 | Pre-build checks | `Platform/Content.Validation` + `WASM ValidateContentCommandExecutor` | **E** | M |
| `app/lib/knowledge-resolver.js` | ~400 | Our knowledge source routing | `DataSources_UpsertDataSource` + `supportedKnowledgeSources` endpoint | **E** | L |
| `app/lib/workiq.js` | ~200 | WorkIQ MCP wrapper | (no equivalent) | **K** | — |
| `app/frontend/src/types/index.ts` | ~? | Hand-written types | `microsoft-agents-objectmodel` generated TS | **R** | L |
| Our topic YAML templates (`knowledge/patterns/`) | — | Hand-authored | `bot.schema.yaml-authoring.json` + `WASM ParseElementCommandExecutor` | **E** | M |

**Net effect when done:** Order-of-magnitude reduction in reverse-engineered lines (estimate ~6,000–7,000 across island-client + parse-har + hand-written types), but the actual figure depends on LRO semantics we still own. Shape drift for upstream-owned types is reduced per compatibility-matrix pins; product-specific shapes and unpublished server fields remain under our care.

## 4. The 48 WASM Commands — What They Unlock

Full list from `ObjectModel/src/Wasm/Wasm.Core/Commands/`. Each is a client-callable command we can invoke from the browser or Node via the npm package.

Grouped by function:

- **Content I/O** — `LoadContent`, `LoadContentChanges`, `LoadTranslations`, `GetSerializedContent`, `GetSerializedDataType`, `GetSerializedElement`, `ParseDataType`, `ParseElement`, `ConvertFileFormat`
- **Validation** — `ValidateContent`, `ValidateComponents`, `SetExternalValidationContext`, `UpdateDlpViolations`
- **Components & graph** — `GetComponent`, `GetComponentConsumers`, `GetComponentDependencies`, `GetDialogActions`, `GetToolDefinition`, `GetDiagnosticsSummary`
- **Variables & option sets** — `GetVariables`, `GetVariableReferences`, `UpdateVariable`, `SetVariableSensitivity`, `RemoveOptionSetName`, `UpsertOptionSetName`, `UpdateOptionSetItemName`
- **PowerFx** — `EvaluatePowerFx`, `PowerFxLanguageServer`
- **GPT / suggestions** — `GetBotDefinitionAsGptDefinition`, `ApplyBotElementSuggestion`, `InferOutputTypesFromAdaptiveCard`, `GetDataTypeFromSampleData`
- **Fix / convert** — `FixCopyPastedContent`, `FixTopicConditions`, `ConvertDisplayExpressionToInvariant`, `ConvertSearchAndSummarizeSources`
- **Search / summarization** — `GetSearchSummarizationInfo`, `GetSearchSummarizationPublishInfo`, `SetSearchSummarizationInfo`
- **Localization** — `SetCurrentLangage` (sic), `GenerateChangeSetForLocalizedContent`, `GetLocalizedContent`
- **State transfer** — `ApplyTransferState`, `ExtractTransferState`
- **Telephony** — `EnableTelephony`
- **AI features** — `GetAIFeaturesPublishInfo`

Each one is code we'd otherwise have to rebuild in Node.js. `GetBotDefinitionAsGptDefinition` alone is huge — it's the canonical GPT export.

## 5. Phased Migration Plan

### Phase 0 — Provenance + vendor path (week 0, no code changes)
1. Confirm: `botmanagement.json` is OK for Microsoft-internal dev tooling use (likely fine — it's used by `BotDesigner.Nswag` internally).
2. Pin a BotDesigner snapshot and an ObjectModel snapshot in `knowledge/upstream-repos.json`. Extend `tools/upstream-check.js` to track them.
3. Install `ado-npm-auth`; verify we can `npm install microsoft-agents-objectmodel` from our repo.

### Phase 1a — TYPES ONLY (week 1, zero transport change)
4. Copy `botmanagement.json` into `tools/upstream-specs/` with recorded commit-hash + fetch date + SHA-256 checksum. Vendored, no live fetch.
5. Generate **TypeScript types only** into `tools/generated/mgmt-types.ts` using `openapi-typescript` (types-only mode). Pin exact generator version. No runtime transport code.
6. **Pilot:** import one response type (e.g., `GetDialogsResponse`) and annotate ONE existing handwritten `island-client.js` call site. Keep all current transport: same base URL, same auth flow, same headers, same retries, same telemetry redaction.
7. Verify TypeScript build is green and existing tests pass. This proves the toolchain without changing runtime routing or auth audience.

> **Why types-first.** The swagger says `host: "localhost:4201"` — clearly the internal service, not our Gateway target. Swagger does not capture: real base URL, token audience/scope, required correlation headers, WAF/rate-limit translation the Gateway performs. Generating a runtime client and sending a Gateway-scoped token to a raw management host would be credential mis-routing. Types-first sidesteps this entirely.

### Phase 1b — Transport pilot (week 2, only after 1a green)
8. Record a golden trace of one `Dialogs_Get` request via the existing client: method + path + query + headers (redacted) + response. Store at `tools/upstream-specs/golden/dialogs-get.json`.
9. Build a tiny adapter `tools/generated/mgmt-adapter.ts` that uses generated types but reuses our existing request pipeline (base URL, token acquisition, retries, telemetry). No direct swagger-host calls.
10. **Pilot with feature flag** `MCS_USE_GENERATED_CLIENT=1`. Route the ONE `Dialogs_Get` call through the adapter.
11. **Dual-run validation window:** shadow-call both paths for ≥ 1 development week. Diff responses AND error codes (401, 403, 404, 409, 429, 5xx, timeouts, malformed bodies). Only flip the flag default to ON after zero diffs across happy + error paths.
12. **Rollback test** is part of pilot acceptance: confirm `MCS_USE_GENERATED_CLIENT=0` restores the old path in under 5 minutes end-to-end.

### Phase 1b — npm package adoption (week 2, separate CI validation)
7. Configure `ado-npm-auth` in a branch. Verify `npm install microsoft-agents-objectmodel` succeeds locally and in CI.
8. Add `microsoft-agents-objectmodel` as dependency in `app/frontend/package.json` and `package.json` (root) **behind a build-time flag**. Importing the package does not yet replace any local type.
9. Stand up the compatibility matrix (`tools/upstream-specs/compat.md`) — pin `botmanagement.json` commit hash + `microsoft-agents-objectmodel` version.

### Phase 1c — parity + retire (week 3+, per-endpoint)
13. For each simple CRUD endpoint: dual-run → zero-diff → flip flag → retire reverse-engineered code in a separate commit with a rollback tag.
14. Async/LRO endpoints (publish, bot create, snapshot, share) stay on the reverse-engineered path until we have contract tests for the polling/retry/auth semantics. Generated types used; adapter wraps initial request; our code owns the polling loop and error recovery.
15. **Deprecation gate for `parse-har-*.js`:** do NOT delete until ≥ 80% of the endpoints it helped discover have been migrated AND a full `/mcs-build` + `/mcs-eval` regression is green using the adapter path. Until then, keep as diagnostic tooling.

### Phase 2 — Schema + type unification (week 2)
8. Replace our `app/frontend/src/types/index.ts` bot-shape types with imports from `microsoft-agents-objectmodel`. Keep `EvalTest`, `AgentSpec` product-specific shapes local.
9. Use exported `schema` and `yamlSchema` in `app/lib/spec-migrate.js` for validation.
10. Retire any hand-written JSON schema in `knowledge/patterns/` that duplicates upstream.

### Phase 3 — Eval stack (weeks 3–4)
11. Spin up `tools/graders-sidecar/` — a thin .NET 10 console project that `dotnet adds reference` to `Microsoft.Agents.Graders.csproj` and exposes a tiny HTTP surface (one endpoint: `POST /grade` with `{grader, input, criteria}`).
12. Replace `tools/eval-scoring.js` internals to shell out to the sidecar. Keep the public API shape identical so `eval-pipeline.js` doesn't change.
13. **Upload path:** replace our Island Gateway `makerevaluations/testcomponent` POST with `MakerEvaluationV2Controller` endpoint via generated client.

### Phase 4 — Runtime/tool commands (weeks 5–6)
14. Replace `tools/direct-line-test.js` with the `Microsoft.CCI.Tools.DirectLineCommand` NuGet tool (install during postinstall, shell from a thin wrapper).
15. Wire WASM `ValidateContent` + `ValidateComponents` into `app/lib/readiness.js`. Catches drift earlier than server-side validation.
16. Use `GetBotDefinitionAsGptDefinition` WASM command for any "export as GPT" flow.

### Phase 5 — Cleanup (week 7)
17. Delete `tools/parse-har-*.js` (HAR reverse-engineering is obsolete once #1 lands).
18. Delete reverse-engineered topic YAML patterns that duplicate `bot.schema.yaml-authoring.json`.
19. Regenerate om-cli from `/tmp/mcs-upstream/ObjectModel/src/Cli/` — current binary is a known older build; rebuilding guarantees schema parity with the npm package.

## 6. Recommended Pilot (before full rollout)

**Pilot step 1 (Phase 1a):** import ONE generated response type for `Dialogs_Get` in `tools/island-client.js`. No transport change. Build green, tests green.

**Pilot step 2 (Phase 1b, only after step 1 green):** record golden trace, build adapter, run `Dialogs_Get` through adapter behind `MCS_USE_GENERATED_CLIENT=1`. Dual-run for ≥ 1 week.

**Why this pilot sequence:**
- Types-first isolates schema/toolchain validation from runtime auth/routing risk.
- Transport swap only happens after golden-trace byte-parity on headers/query/method and after negative-path diffs on 401/403/404/429/5xx/timeout.
- Base URL, token audience, and WAF-translation assumptions are validated before any privileged call goes through generated code.

**Acceptance criteria (Phase 1b completion):**
- Exact `botmanagement.json` commit-hash, generator version, and generation command recorded and reproducible in CI.
- Golden trace captured; adapter matches on method, path, query, headers (modulo correlation IDs), and response shape.
- Negative-path tests pass for 401, 403, 404, 409, 429, 5xx, timeout, malformed/non-JSON error body.
- Logging redacts Authorization, session IDs, correlation IDs; existing telemetry/observability unchanged.
- Feature flag rollback (`MCS_USE_GENERATED_CLIENT=0`) tested end-to-end, restores old path in < 5 minutes.
- `tools/agentic-test-loop.js` green before AND after flag flip.
- No destructive management operations are imported from the generated client surface (only `Dialogs_Get` is exposed to callers in the pilot).

## 7. Risks + Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| ADO npm feed auth breaks in CI | Medium | Ship `.npmrc` and `ado-npm-auth --non-interactive` in postinstall. Document fallback to manual `vsts-npm-auth`. |
| botmanagement.json falls out of date | Medium | Pin a snapshot; add spec-hash check in `tools/upstream-check.js` so we notice when upstream changes. |
| Graders sidecar requires .NET 10 runtime on every dev machine | Medium | Document it in `bin/cli.js doctor`. Add a `dotnet --list-runtimes` check. Fall back to old scoring path if missing. |
| WASM download size bloats frontend bundle | Low | Lazy-load WASM; only instantiate when validation is requested. |
| Breaking schema change in newer ObjectModel | Medium | Pin version; test suite catches shape drift; migration scripts in `app/lib/spec-migrate.js`. |
| Internal endpoints on critical path | Low | GPT-5.4 flagged. Mitigation: pilot one endpoint at a time; roll back if any endpoint is inaccessible from our tenant. |

## 8. What We Are NOT Adopting (and why)

- **OnlineEngine/RuntimeV2, Dialog.Engine, AgenticLoop** — these are runtime internals for the actual bot execution. We don't execute bots; MCS does. **Skip.**
- **Orleans/Plex containers, Service Fabric hosting** — infra layer. We are a dev/build tool. **Skip.**
- **AetherOrchestrator (Python), AIService executors** — internal AI pipeline. We consume its outputs via MCS APIs. **Skip.**
- **ManagedStore runtime connectors** — runtime-side PowerFx connector execution. **Skip.**
- **Telephony, Voice, SMBA, Teams streaming specifics** — channel internals. We surface channel choices to users but don't implement them. **Skip.**

## 9. Appendix — Command Checklists

### To refresh this scan:
```bash
cd /tmp/mcs-upstream
git -C BotDesigner fetch origin master && git -C BotDesigner reset --hard origin/master
git -C ObjectModel fetch origin master && git -C ObjectModel reset --hard origin/master
```

### To extract endpoints by tag:
```bash
cd /tmp/mcs-upstream/BotDesigner/src/BotDesigner.Management.Server/Swagger/2022-01-15
node -e "const s=require('./botmanagement.json');for(const p of Object.keys(s.paths))for(const m of Object.keys(s.paths[p]))console.log(m.toUpperCase(),p,'->',s.paths[p][m].operationId)" | grep -i "publish"
```

### To test the npm package locally (Phase 1):
```bash
npx ado-npm-auth -c .npmrc
npm install microsoft-agents-objectmodel --registry https://pkgs.dev.azure.com/msazure/_packaging/CCI-Dependency/npm/registry/
node -e "console.log(Object.keys(require('microsoft-agents-objectmodel')))"
```

---

## Decision Points — Need Explicit User OK

1. **Proceed to Phase 1 pilot** (generate TS client + pilot `Dialogs_Get` swap)?
2. **Add BotDesigner to `knowledge/upstream-repos.json` tracking** (read-only, like elevate-upstream)?
3. **Re-vendor ObjectModel source** into `tools/om-cli-source/` so we can rebuild from pinned snapshot?
4. **Publish this scan report as a checked-in artifact** (current path: `knowledge/learnings/upstream-adoption-scan.md`)?
