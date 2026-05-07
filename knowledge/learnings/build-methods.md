# Build Method Learnings

Lessons learned about build execution — PAC CLI vs Playwright, Dataverse API patterns, Code Editor YAML, publish methods. Consulted during `/mcs-build`.

<!--
Entry format:
### [Title] {#id} — [Date]
**Context:** [Customer/project, what was being built]
**Tried:** [Initial approach]
**Result:** [What happened]
**Better approach:** [What worked or was recommended]
**Confirmed:** [N] build(s) | Last confirmed: [YYYY-MM-DD]
**Related cache:** [cache file(s) if applicable]
**Tags:** #tag1 #tag2
-->

> **Note (2026-03-13):** Eval set names were renamed: safety → boundaries, functional → quality, resilience → edge-cases. Historical entries below use the original names.

### Adaptive card cardContent PowerFx is topic-scoped — Global.* refs break the card {#bm-LSP-002} — 2026-04-28
**Context:** Blackstone Market Research v7. After promoting Topic.target_ticker / Topic.template_choice / Topic.confirmed (and label vars) to Global.* in topic actions for cross-topic survival, the MCS UI started showing errors on both Pick Template and Build Comparables topics for the AdaptiveCard nodes.

**Tried:** v7 references inside `cardContent: |- = { ... }` PowerFx — e.g. `text: "Pick a template for " & Global.target_label`, `text: "Confirm to populate the " & Global.template_label`. Validation passed locally (om-cli + LSP). MCS UI flagged the cards as errored.

**Result:** PowerFx in `AdaptiveCardTemplate.cardContent` evaluates against a **topic-bound scope**. `Global.*` references don't resolve there even though they work fine in `condition:` / `value:` / `activity:` interpolation outside of the card. The card validator rejects (or runtime fails to bind) any `Global.foo` reference inside the cardContent body.

**Better approach (v8 hybrid):**
- Keep all card-content refs as `Topic.*` (do the SetVariable Switch/derive logic with Topic-scoped vars).
- After card interactions complete (e.g. inside the `do_confirm` branch of the final ConditionGroup), append `kind: SetVariable` nodes that mirror `Topic.* → Global.*` so the values survive after the topic exits.
- The agent's generative orchestration after topic exit reads `Global.*` cleanly.

```yaml
# IN-TOPIC: Topic-scoped (cardContent works)
- kind: SetVariable
  variable: Topic.target_label
  value: =Switch(Topic.target_ticker, "CMG", "Chipotle Mexican Grill (CMG)", ...)
- kind: Question
  prompt:
    attachments:
      - kind: AdaptiveCardTemplate
        cardContent: |-
          ={ type: "AdaptiveCard", body: [
            { type: "TextBlock", text: "Pick a template for " & Topic.target_label }
          ]}

# AT TOPIC END: mirror to Global for cross-topic survival
- kind: SetVariable
  variable: Global.target_ticker
  value: =Topic.target_ticker
- kind: SetVariable
  variable: Global.target_label
  value: =Topic.target_label
```

**Confirmed:** 1 build (Blackstone Market Research v7→v8) | Last confirmed: 2026-04-28
**Related cache:** `knowledge/cache/adaptive-cards.md` (PowerFx in cards section needs an explicit note about Global.* not being supported in cardContent)
**Tags:** #adaptive-card #powerfx #topic-scope #global-variable #scope-mirroring

### LSP push hazard: phantom `actions/` dir + GptComponentMetadata silent deletion {#bm-LSP-001} — 2026-04-28
**Context:** Blackstone Market Research v4 → v5 adaptive-card refactor. After several pull-edit-push cycles, the agent's GptComponentMetadata (componenttype=15) — which carries instructions, aISettings.model, conversationStarters, and the agent description — was silently deleted, causing the MCS UI to show "no description, model GPT-4.1, no instructions, no knowledge". Topics and the connector action were also tied up in cascading errors.

**Two distinct LSP wrapper bugs surfaced together:**

1. **Phantom `actions/` directory recreation**: `mcs-lsp pull` recreates a file at `actions/cr1a5_<bot_schema>.topic.<ActionName>.mcs.yml` even when the canonical action component already lives at `topics/<ActionName>.mcs.yml`. The phantom file's bot-schema-prefixed filename produces a >100 char schema name on the next push, triggering `[0x80044331:StringLengthTooLong] The length of the 'schemaname' attribute of the 'botcomponent' entity exceeded the maximum allowed length of '100'` and aborting the push.

2. **`agent.mcs.yml` deletion when missing locally**: If `agent.mcs.yml` is absent from the workspace root at push time (e.g. after a manual cleanup or a pull cycle that doesn't refetch it), the LSP push interprets that as a delete intent and removes the GptComponentMetadata botcomponent record from Dataverse. There is no warning. The agent loses its instructions, model setting, conversationStarters, and the description column — the entire agent component header.

**Tried:** Multiple variants of pull-then-push, no-op push, push with renamed action file, isolated topic push. All failed with StringLengthTooLong until the phantom `actions/` dir was deleted immediately before push.

**Result (working procedure):**
```bash
# Always run as one command — nothing should run between rm and push
rm -rf "<workspace>/actions" && node tools/mcs-lsp.js push --workspace "<workspace>"
```

**Recovery if GptComponentMetadata was deleted:** Reconstruct `agent.mcs.yml` with `kind: GptComponentMetadata` (the kind field gets stripped on push but is recovered from componenttype=15 internally), `aISettings.model.modelNameHint: GPT5Auto`, `conversationStarters: [...]`, and `instructions: |- ...`. Push. The botcomponent.description column is a separate Dataverse field — PATCH it explicitly via `/api/data/v9.2/botcomponents(<id>)` because the YAML `description:` line gets stripped by the LSP push serializer.

**Better approach:**
- Pre-push guard: scan the workspace for `agent.mcs.yml`. If missing, refuse to push and instruct user to pull first (a missing agent.mcs.yml almost certainly means workspace state is broken, not that the user wants to delete the agent header).
- Pre-push cleanup: scan `actions/` for any file matching `<bot_schema>.topic.*` (bot-schema prefix in name) and delete — these are phantoms.
- Post-push verification: query componenttype=15 record exists and has non-empty data field.
- Add to mcs-lsp.js as `--safe-push` mode by default.

**Confirmed:** 1 build (Blackstone Market Research v4→v5) | Last confirmed: 2026-04-28
**Related cache:** `knowledge/patterns/dataverse-patterns.md` (componenttype=15 reference)
**Tags:** #lsp #actions-dir #gpt-component-metadata #stringlengthtoolong #recovery

### Agent creation is fully headless: Dataverse POST + PvaProvision {#bm-001} — 2026-02-27
**Context:** Tested full API agent creation pipeline — Dataverse POST + PvaProvision + LSP clone
**Tried:** (1) `pac copilot create` — needs template YAML (~30% of config). (2) Playwright wizard. (3) Dataverse POST + PvaProvision.
**Result:** Dataverse POST + PvaProvision WORKS. Full E2E pipeline tested Feb 27 (24/24 steps pass):
  1. `POST /api/data/v9.2/bots` with name, schemaname, language:1033, runtimeprovider:0, configuration (JSON) → HTTP 201
  2. `POST /bots(<id>)/Microsoft.Dynamics.CRM.PvaProvision` with {} body → HTTP 204
  3. Poll statuscode: Provisioning(3) → Provisioned(1) in ~5-15s
  4. Agent appears in `pac copilot list` immediately after provisioning
  5. LSP clone works — gets agent.mcs.yml + settings.mcs.yml (system topics come later after clone detects them)
  6. LSP push works for all config: instructions, model, topics, knowledge sources, conversation starters, web search toggle
  7. Dataverse PATCH works for bot entity settings: configuration JSON, authenticationmode, isAgentConnectable
  8. PvaPublish → publishedon updates. PvaDeleteBot → HTTP 204 cleanup.
**Better approach:** Create agents via Dataverse API (2 calls, ~3 seconds total). No Playwright needed. Required fields: name (string), schemaname (publisher prefix e.g. cr509_name), language (1033), runtimeprovider (0), configuration (JSON BotConfiguration string). After creation: LSP clone → edit → push → PvaPublish.
**Confirmed:** 2 build(s) | Last confirmed: 2026-02-27
**Related cache:** agent-lifecycle.md, api-capabilities.md, dataverse-patterns.md
**Tags:** #dataverse #api #agent-creation #pva-provision #headless #lsp

### Dataverse POST for new botcomponents skips MCS orchestration {#bm-002} — 2026-02-20
**Context:** CDW Legal & HR Policy Advisor build — attempted to create topics and instructions via raw `POST /botcomponents`
**Tried:** PowerShell Web API `POST` to create botcomponent records (componenttype 9 for topics, 15 for instructions) with YAML/JSON content
**Result:** Records created in Dataverse (confirmed via FetchXML), but agent appears BLANK in MCS UI. MCS doesn't recognize the components because raw POST skips:
- NLU trigger phrase registration
- `bot_botcomponent` M:M relationship setup
- Dependency tracking and topic compilation
**Better approach:** For NEW topics: use LSP push (see bm-007) — write `.mcs.yml` to workspace, push. Playwright Code Editor is fallback only. For EXISTING instructions: LSP push via agent.mcs.yml (preferred) or PATCH the `data` field (see bm-005). For publish: PvaPublish bound action (see bm-004).
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-20
**Related cache:** api-capabilities.md, dataverse-patterns.md
**Tags:** #dataverse #botcomponent #topic-creation #instructions #playwright #code-editor

### PAC CLI extract-template crashes on complex agents {#bm-003} — 2026-02-20
**Context:** CDW build — attempted `pac copilot extract-template --bot <CDW-Legal-bot>` to get a working template
**Tried:** `pac copilot extract-template` on the CDW Legal & HR Policy Advisor agent
**Result:** `System.ArgumentException` crash. Reproduced on multiple agents with custom topics or complex configurations.
**Better approach:** Use the simplest available agent in the environment as the template source. Or skip templates entirely — create agents via Playwright UI (preferred) and configure from there.
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-20
**Related cache:** agent-lifecycle.md
**Tags:** #pac-cli #extract-template #crash #agent-creation

### PAC CLI publish (MSI) crashes — PvaPublish bound action is the reliable method {#bm-004} — 2026-02-20
**Context:** CDW + BY builds — attempted multiple publish methods
**Tried:** (1) `pac copilot publish` via MSI CLI v2.1.2, (2) MCP `copilot_publish` via dnx v2.2.1, (3) PvaPublish bound action via Web API, (4) Playwright Publish button
**Result:** MSI crashes with `System.ArgumentException`. MCP returns `Invalid response format`. PvaPublish bound action WORKS. Playwright works but is fragile.
**Better approach:** Use `PvaPublish` bound action via Dataverse Web API (`POST /bots(<id>)/Microsoft.Dynamics.CRM.PvaPublish`). Token via `az account get-access-token`. This is now the primary publish method — no PAC CLI dependency, no browser needed.
**Confirmed:** 2 build(s) | Last confirmed: 2026-02-20
**Related cache:** api-capabilities.md, dataverse-patterns.md
**Tags:** #publish #pva-publish #bound-action #dataverse #pac-cli #workaround

### Instructions use 'data' field (YAML), NOT 'content' field (JSON) {#bm-005} — 2026-02-20
**Context:** BY Digital Resource Matching Agent build — investigated why API-written instructions didn't appear in MCS UI
**Tried:** PATCH `botcomponent.content` field with `{"systemMessage":"..."}` (JSON format, componenttype 15)
**Result:** PATCH to `content` returned 400 Bad Request on published agents. Even when it succeeded on new agents, the MCS UI Instructions card showed empty. Investigation revealed TWO fields:
- `content` (JSON): Compiled runtime field. Read-only via API after first publish.
- `data` (YAML): Source of truth. Format: `kind: GptComponentMetadata\ndisplayName: ...\ninstructions: |-\n  ...`
The MCS UI reads/writes the `data` field. PvaPublish syncs `data` -> `content` for runtime.
**Better approach:** PATCH the `data` field with YAML format. Use `If-Match: *` header. Then call PvaPublish to sync to runtime. Full E2E tested: write -> publish -> verify (12/13 tests pass).
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-20
**Related cache:** api-capabilities.md, dataverse-patterns.md
**Tags:** #instructions #dataverse #data-field #content-field #yaml #custom-gpt #botcomponent

### LSP push is the primary build method — replaces Dataverse PATCH + Playwright Code Editor {#bm-007} — 2026-02-26
**Context:** CDW Legal HR Policy Advisor — full end-to-end build testing of LSP wrapper
**Tried:** Previous builds used Dataverse API PATCH for instructions and Playwright Code Editor for topics. Tested LSP push (via `mcs-lsp.js`) for all components.
**Result:** LSP push handles instructions, model, knowledge (SharePoint), and custom topics in a single operation. Three bugs fixed to enable this: (1) URI encoding — `pathToFileURL()` instead of manual string, (2) token audience — PVA app ID `96ff4394-9197-43aa-b393-6a41652e21f8` instead of `api.powerplatform.com`, (3) settings.mcs.yml BOM corruption — auto-stripped after pull/clone.
**Better approach:** Clone workspace → edit agent.mcs.yml (instructions + model) → add knowledge/*.mcs.yml → add topics/*.mcs.yml → push (one operation). Post-clone: auto-cleanup strips BOMs and removes Signin.mcs.yml. For gen orchestration agents, topics must use `modelDescription` for routing — `triggerQueries` blocks publish.
**Caveat:** Non-verbose push can report "0 local changes synced" even when changes were synced — stdout races with process exit. Use `MCS_LSP_VERBOSE=1` for reliable output, or verify via pull read-back.
**Confirmed:** 4 build(s) | Last confirmed: 2026-02-27
**Related cache:** api-capabilities.md
**Tags:** #lsp #push #instructions #model #knowledge #topics #uri-encoding #token-audience #bom

### LSP push doesn't update bot entity name — use Dataverse PATCH {#bm-008} — 2026-02-26
**Context:** CDW Legal HR Policy Advisor — new agent created via Playwright showed as "Agent" in PAC CLI after LSP push
**Tried:** LSP push with `displayName` in agent.mcs.yml
**Result:** LSP updates the GptComponent `displayName` but NOT the bot entity `name` field. PAC CLI and MCS agent list show the old name. The bot entity `name` is separate from the GptComponent `displayName`.
**Better approach:** After Playwright creates an agent, PATCH the bot entity name via Dataverse API: `PATCH /bots(<id>) { "name": "<displayName>" }`. Do this before clone so the clone picks up the correct name.
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-26
**Related cache:** dataverse-patterns.md
**Tags:** #lsp #bot-name #dataverse #patch #agent-creation

### Browser account must match build target BEFORE any Playwright operation {#bm-009} — 2026-02-27
**Context:** CDW Legal HR build — browser was logged in as kimdennis@microsoft.com but build target was admin@M365CPI15209943 / dktest (different tenant)
**Tried:** Navigating directly to agent URL in wrong-tenant browser. Also tried running evals via Playwright Test Chat.
**Result:** MCS shows "Looks like that link is broken" when accessing cross-tenant environment URLs. Test Chat is inaccessible. Suggested Prompts config blocked. Settings changes blocked. Everything requiring browser was blocked.
**Better approach:** On first Playwright use, navigate to MCS and snapshot. If the browser shows the wrong account or environment, ask the user to sign in to the correct account and navigate to the right environment manually. Wait for confirmation, then re-snapshot to verify. Never automate sign-out, account picker, or environment switcher via Playwright — the user handles these. Browser cookies persist at `~/.playwright-mcp-edge` so the user only needs to sign in once per session.
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-27
**Related cache:** api-capabilities.md
**Tags:** #playwright #browser #account-switch #tenant #auth-gate

### LSP push does NOT handle settings.mcs.yml — use Dataverse API (fastest) or Playwright {#bm-010} — 2026-02-27
**Context:** CDW build — tried to push `useModelKnowledge: false` via LSP, then tested Dataverse API
**Tried:** (1) Edit settings.mcs.yml → LSP push. (2) PATCH bot.configuration via Dataverse API. (3) Playwright Settings UI.
**Result:** LSP push reports "0 local changes synced" for settings.mcs.yml — does NOT push settings. BUT Dataverse API works: the `bot.configuration` field (Memo/JSON) contains all AI settings. Read current JSON → modify → PATCH back → PvaPublish. Round-trip confirmed for `useModelKnowledge` in ~2 seconds vs ~30 seconds via Playwright.
**Better approach:** Use Dataverse API PATCH on `bot.configuration` field for: `useModelKnowledge` (general knowledge), `isFileAnalysisEnabled`, `contentModeration`, `optInUseLatestModels`. Use direct PATCH on `bot.authenticationmode` for auth mode. Use Dataverse PATCH on GptComponent `data` field for: `conversationStarters` (suggested prompts), `instructions`, `aISettings.model`. Playwright is last resort only. Web search (Bing) toggle location TBD — not in `configuration.aISettings`.
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-27
**Related cache:** api-capabilities.md, dataverse-patterns.md
**Tags:** #lsp #settings #dataverse #api #playwright #general-knowledge #auth-mode #suggested-prompts #configuration

### General knowledge must be OFF for policy/compliance agents {#bm-011} — 2026-02-27
**Context:** CDW Legal HR Policy Advisor — agent must ONLY answer from CDW SharePoint knowledge sources
**Tried:** Default agent creation leaves "Use general knowledge" ON in Settings > Generative AI > Knowledge
**Result:** With general knowledge ON, the model can answer from its training data — not just the configured knowledge sources. For a compliance agent grounded in specific company policies, this means the agent may provide answers from generic knowledge that contradict or supplement company-specific policies without the user knowing the source. Two separate settings: (1) "Use general knowledge" = model training data, (2) "Use information from the Web" = Bing search. Both should be OFF for policy-grounded agents.
**Better approach:** During /mcs-build Step 2 or Step 3 (after agent creation), check the agent's knowledge settings via Playwright Settings UI and disable "Use general knowledge" and "Use information from the Web" for agents whose brief specifies grounding in specific knowledge sources (SharePoint, files). This should be part of the standard build checklist for any agent with `knowledge[]` entries.
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-27
**Related cache:** knowledge-sources.md
**Tags:** #general-knowledge #grounding #compliance #settings #knowledge

### Connected agents via Island Gateway API — no Playwright needed {#bm-012} — 2026-02-27
**Context:** E2E pipeline test — connect specialist agent to orchestrator programmatically
**Tried:** Island Gateway API `PUT content/botcomponents` with `connectedAgentDefinitionChanges` array
**Result:** WORKS. Payload: `{ connectedAgentDefinitionChanges: [{ "$kind": "ConnectedAgentDefinitionInsert", connectedAgentDefinition: { "$kind": "ConnectedAgentDefinition", connectedAgentSchemaName: "<schema>", isAgentConnectable: true } }], changeToken: "<from readComponents>" }`. Returns 200. Connected agent appears in orchestrator's component tree immediately.
**Better approach:** Prerequisites: (1) target agent must have `isAgentConnectable: true` (Dataverse PATCH), (2) target agent must be published, (3) read orchestrator components to get changeToken. Then single PUT to write the connection.
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-27
**Related cache:** api-capabilities.md, island-gateway-api.md
**Tags:** #connected-agents #island-gateway #multi-agent #orchestrator #headless

### Eval test case upload via Dataverse API — componenttype 19 {#bm-013} — 2026-02-27 [SUPERSEDED by bm-025]
**Context:** E2E pipeline test — create evaluation test cases programmatically
**Tried:** `POST /botcomponents` with componenttype=19, content (JSON with testQuery/expectedResponse/keywords), and `parentbotid@odata.bind: /bots(<botId>)`
**Result:** Creates records linked to parent bot but CANNOT set `parentBotComponentId` (the link between EvaluationData and EvaluationSet). Raw Dataverse POST creates orphaned test rows without proper set membership. Records are queryable but MCS Evaluation tab doesn't group them correctly.
**Better approach:** **SUPERSEDED** — Use Gateway API `makerevaluations/testcomponent` endpoint instead (see bm-025). The Gateway API handles `parentBotComponentId` internally, creating properly linked EvaluationSet + EvaluationData records. Also supports grader configuration and eval execution (`run-eval`).
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-27
**Related cache:** api-capabilities.md, eval-methods.md, island-gateway-api.md
**Tags:** #eval #test-cases #dataverse #componenttype-19 #headless #superseded

### Knowledge source YAML format must use KnowledgeSourceConfiguration kind {#bm-014} — 2026-02-27
**Context:** E2E pipeline test — LSP push silently ignored knowledge source with wrong YAML format
**Tried:** First attempt used `kind: KnowledgeSource` with `sourceType: publicUrl` and `urls:` array — LSP push returned 200 but created no knowledge component in Dataverse (0 sources).
**Result:** The correct .mcs.yml format for knowledge sources (discovered from cloning an agent with knowledge):
```yaml
# Name: Display Name
# Description text
kind: KnowledgeSourceConfiguration
source:
  kind: PublicSiteSearchSource
  site: https://example.com/path/
  includeSubPages: true
```
File must be named using the component's schema name: `{botSchemaName}.topic.{KnowledgeName}.mcs.yml` (stored in `knowledge/` directory). Second attempt with correct format: push creates componenttype=16 record successfully.
**Better approach:** Always use `kind: KnowledgeSourceConfiguration` with `source.kind` matching the ObjectModel type: `PublicSiteSearchSource` (public URLs), `SharePointSearchSource` (SharePoint), `FileGroupKnowledgeSource` (uploaded files), `DataverseStructuredSearchSource` (Dataverse tables). The LSP silently ignores invalid YAML — always verify via Dataverse read-back.
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-27
**Related cache:** knowledge-sources.md, api-capabilities.md
**Tags:** #knowledge #lsp #yaml #knowledge-source #silent-failure #public-url #sharepoint

### Az.Accounts not needed — az CLI provides reliable Dataverse tokens {#bm-006} — 2026-02-20
**Context:** BY build — `Connect-DataverseFromPac` crashed because Az.Accounts module not installed
**Tried:** `Get-AzAccessToken -ResourceUrl <org-url>` (requires Az.Accounts module)
**Result:** Module not installed, no reliable way to install it in the build environment without admin rights.
**Better approach:** `az account get-access-token --resource <org-url>` works everywhere Azure CLI is installed. Returns JSON with `.accessToken`. No module dependency. Now the primary token method in `dataverse-helper.ps1`.
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-20
**Related cache:** dataverse-patterns.md
**Tags:** #token #az-cli #az-accounts #authentication #dataverse

### Build Step 4 must filter by topicType — generative topics need no YAML {#bm-015} — 2026-02-27
**Context:** CDW Account Prospecting Agent — build skipped Step 4 entirely, `topics` never added to `completedSteps`, but build continued to publish and safety gate.
**Tried:** Step 4 said "For each MVP topic, Topic Engineer generates YAML" but didn't distinguish `topicType: generative` from `topicType: custom`. 3 of 5 topics were generative (handled by orchestrator + instructions), 2 were custom.
**Result:** Step 4 was silently skipped. The 2 custom topics (Conversation Start, Scheduled Prospect Delivery) were never built. Build proceeded to publish without flagging the gap. `topics` was missing from `completedSteps` so resume logic couldn't detect the skip.
**Better approach:** Step 4 now explicitly filters: (1) Log generative topics as "handled by orchestration, no YAML needed". (2) Only generate YAML for `topicType: custom` or `system` (customized system topics). (3) If no custom/system MVP topics remain after filtering, add `topics` to `completedSteps` and skip cleanly. (4) For system topics like Conversation Start, overwrite the default file in the workspace.
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-27
**Related cache:** api-capabilities.md
**Tags:** #build #topics #generative #custom #completedSteps #skip-logic #topic-type

### Conversation starters require 'title' field — text-only format blocks publish {#bm-016} — 2026-03-05
**Context:** BY Solution Design Assistant — PvaPublish failed with "Missing required property 'Title'" (5 occurrences, one per conversation starter)
**Tried:** `conversationStarters` in agent.mcs.yml with `text` only: `- text: Generate a baseline solution design`
**Result:** PvaPublish returned 200 but `synchronizationstatus.lastFinishedPublishOperation.status` was "Failed" with 5x `MissingRequiredProperty` for `Title`. The `publishedon` field remained null.
**Better approach:** Each conversation starter must include both `title` (short label, displayed as chip) and `text` (full prompt sent on click):
```yaml
conversationStarters:
  - title: Solution design
    text: Generate a baseline solution design for a WMS implementation
```
Always verify publish success by checking `synchronizationstatus` JSON, not just the HTTP 200 from PvaPublish — 200 means "accepted" not "succeeded".
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-05
**Related cache:** api-capabilities.md, agent-lifecycle.md
**Tags:** #conversation-starters #publish #title #pva-publish #agent-mcs-yml

### Agent description lives in agent.mcs.yml comment line 2 — LSP pushable {#bm-017} — 2026-03-05
**Context:** BY Solution Design Assistant — agent description was empty in MCS UI after build
**Tried:** Checked bot entity for `description` column (doesn't exist), checked settings.mcs.yml (no description field), checked GptComponentMetadata schema (om-cli stack overflow)
**Result:** The description is stored as the SECOND comment line in `agent.mcs.yml`, NOT as a YAML property:
```yaml
# Name: BY Solution Design Assistant
# Helps Blue Yonder ProServ solution architects generate baseline solution designs...
kind: GptComponentMetadata
```
Line 1 (`# Name:`) = GptComponent display name. Line 2 (`# ...`) = agent description shown in MCS overview. These are MCS metadata comments parsed by the LSP/MCS runtime, not standard YAML comments.
**Better approach:** Always set both comment lines when writing `agent.mcs.yml`. Pull after clone to see the default `# Name: default / # default` placeholder, then replace with actual name and description. **Fixed (2026-03-05):** `mcs-lsp.js push` now auto-patches metadata via Dataverse API after LSP sync. Patches three fields: (1) `botcomponent.description` — the actual field MCS UI reads (discovered via ObjectModel `AgentDefinition.description`), (2) `botcomponent.name`, (3) comment headers in `data` YAML. PvaPublish still required to make changes live.
**Confirmed:** 2 build(s) | Last confirmed: 2026-03-05
**Related cache:** api-capabilities.md, agent-lifecycle.md, dataverse-patterns.md
**Tags:** #agent-description #agent-mcs-yml #lsp #gpt-component #comment-metadata #dataverse-patch

### synchronizationstatus requires full entity query — $select returns null {#bm-018} — 2026-03-05
**Context:** BY Solution Design Assistant — implementing publish verification with `synchronizationstatus`
**Tried:** `GET /bots(<id>)?$select=publishedon,synchronizationstatus` — both fields returned null/None even after successful publish
**Result:** When queried with `$select`, `synchronizationstatus` and `publishedon` return null. Querying the full entity (no `$select`) returns both correctly. `synchronizationstatus` is a JSON string with `\r\n` line endings containing `lastFinishedPublishOperation.status` ("Succeeded" or "Failed").
**Better approach:** Always query without `$select` for publish verification: `GET /bots(<id>)`. Parse `synchronizationstatus` as JSON, check `lastFinishedPublishOperation.status`. This is a Dataverse quirk — likely because the field is computed/JSON-typed.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-05
**Related cache:** dataverse-patterns.md, agent-lifecycle.md
**Tags:** #synchronizationstatus #publish #dataverse #select-quirk #verification

### OData $filter on _parentbotid_value is unreliable — use FetchXML {#bm-019b} — 2026-03-06
**Context:** TestNorthwind build — querying botcomponents by parent bot ID after agent creation
**Tried:** OData `GET /botcomponents?$filter=_parentbotid_value eq <guid>` and `$filter=_parentbotid_value eq <guid> and componenttype eq 15`
**Result:** Both queries return 0 results despite 15 components existing. FetchXML with `parentbotid` (logical name) returns all 15 correctly.
**Better approach:** Always use FetchXML with `parentbotid` for botcomponent parent lookups. OData filter on `_parentbotid_value` is unreliable — possibly a Dataverse GUID matching quirk on lookup fields. The `mcs-lsp.js` tool already uses FetchXML correctly; build scripts should too.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-06
**Related cache:** dataverse-patterns.md (pitfall #1)
**Tags:** #dataverse #fetchxml #odata #parentbotid #botcomponent

### $select=data on botcomponents returns empty — query full entity {#bm-020b} — 2026-03-06
**Context:** TestNorthwind build — verifying GptComponent data field after Dataverse PATCH
**Tried:** `GET /botcomponents(<id>)?$select=data` to read the YAML content
**Result:** Returns empty string. `GET /botcomponents(<id>)` (full entity, no $select) returns the correct YAML content (4703 chars). Same Dataverse quirk as `synchronizationstatus` on bots.
**Better approach:** Never use `$select=data` on botcomponents. Query the full entity. This extends the known `$select` quirk (bm-011) to include the `data` field on botcomponents, not just `synchronizationstatus`/`publishedon` on bots.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-06
**Related cache:** dataverse-patterns.md (pitfall #4)
**Tags:** #dataverse #select-quirk #botcomponent #data-field

### LSP push "0 changes" on newly created agents — Dataverse PATCH fallback added {#bm-021b} — 2026-03-06
**Context:** TestNorthwind build — first push after creating agent via Dataverse API + PvaProvision + LSP clone
**Tried:** Clone agent → write full agent.mcs.yml (instructions, model, starters) → LSP push
**Result:** Push completes with "0 local changes synced". The metadata patch (name + description) succeeds, but the YAML body (instructions, model, conversation starters) is NOT synced to the GptComponent data field. A manual Dataverse PATCH of the full `data` field works.
**Better approach:** `mcs-lsp.js push` now includes `verifyAndPatchBody()` which runs after every push: reads GptComponent data field (full entity, no $select), checks if instructions are present. If missing, patches via Dataverse API. This handles the LSP's failure to detect changes on fresh agents.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-06
**Related cache:** api-capabilities.md
**Tags:** #lsp #push #zero-changes #dataverse #fallback #gpt-component

### Auth gate must explicitly ask for environment — never assume {#bm-022b} — 2026-03-06
**Context:** TestNorthwind build — user selected account admin@M365CPI15209943 which has 2 environments (dktest, Contoso)
**Tried:** Selected account → assumed "dktest" from sessionDefaults without asking user
**Result:** Built on dktest without confirming. If user wanted Contoso, the entire build would target the wrong environment. Also, PAC CLI had a device auth error (AADSTS700003) that was only caught after the build started.
**Better approach:** Auth gate must ALWAYS: (1) Ask account, (2) Ask environment explicitly when account has 2+ environments, (3) Verify three layers with actual API calls: Azure CLI tenant match → Dataverse API reachable → PAC CLI best-effort. Build skill updated with two-step selection + three-layer verification. PAC CLI failure is now a warning, not a blocker.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-06
**Related cache:** N/A (process change, not API pattern)
**Tags:** #auth #environment #build-gate #pac-cli #verification

### Knowledge file upload: POST works but file attach endpoints don't exist {#bm-023b} — 2026-03-06 [SUPERSEDED by bm-047]
**Context:** TestNorthwind build — uploading CommonFixes.csv as agent knowledge file
**Tried:** (1) `POST /botcomponents` with componenttype=16 + `parentbotid@odata.bind` + schemaname → record created successfully. (2) `PATCH /botcomponents(<id>)/fileattachment` → HTTP 404. (3) `PATCH /botcomponents(<id>)/botcomponentfiledata` → HTTP 404. (4) Original helper used `_parentbotid_value` → "CRM does not support direct update of Entity Reference properties" error.
**Result:** Knowledge component record is created in Dataverse, but no file upload endpoint exists on botcomponents. The `content` and `fileattachment` and `botcomponentfiledata` paths all return 404. This extends the bm-002 learning: even with correct navigation properties, raw POST creates records MCS doesn't fully recognize.
**Better approach:** **SUPERSEDED — see bm-047.** The correct endpoint is `PATCH /botcomponents(<id>)/filedata` (not `/fileattachment` or `/botcomponentfiledata`) with `Content-Type: application/octet-stream` and `x-ms-file-name` header. The previous attempts failed because `filedata` is the file Virtual column, not `fileattachment`.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-06
**Related cache:** dataverse-patterns.md, knowledge-sources.md
**Tags:** #knowledge #file-upload #dataverse #botcomponent #superseded

### Connectivity API doesn't resolve — blocks add-tool.js for tool configuration {#bm-024b} — 2026-03-06
**Context:** TestNorthwind build — attempting to list connections and add tools
**Tried:** `node tools/add-tool.js list-connections --env <envId> --connector shared_sharepointonline`
**Result:** `getaddrinfo ENOTFOUND {envId}.environment.api.powerplatform.com` — the Power Platform Connectivity API hostname doesn't resolve for this tenant (M365CPI15209943). This is a known issue for certain tenants (also noted in MEMORY.md).
**Better approach:** When connectivity API is unreachable: (1) Try Island Gateway API for tool discovery, (2) Use LSP pull to discover existing connections from the workspace, (3) Fall back to user-guided manual step (tell user to add the tool in MCS UI, verify via LSP pull after). This is a tenant-level infrastructure issue, not a code bug.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-06
**Related cache:** api-capabilities.md, connectors.md
**Tags:** #connectivity-api #add-tool #tool-configuration #manual-step #tenant-issue

### Build discipline: never skip MVP items — attempt and document failures {#bm-018b} — 2026-03-06
**Context:** TestNorthwind build — first pass skipped tools, knowledge, and custom topics entirely with rationalization "fictional data sources"
**Tried:** Skipped 9 of 17 MVP items because external systems were fictional
**Result:** Reconciliation showed 8/17 match — build was incomplete. Second pass attempted every item: 14 matched, 1 partial (placeholder topic), 4 blocked with specific errors documented.
**Better approach:** ALWAYS attempt every MVP item in the agent spec, even in test builds. If an item fails, document: (1) what was tried, (2) the specific error, (3) what needs to happen to unblock it. A failed attempt with a clear error is infinitely more valuable than a silently skipped item. The build skill already says "never mark complete until verified" — extend this to "never skip without attempting."
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-06
**Related cache:** N/A (process discipline)
**Tags:** #build-discipline #reconciliation #skip-nothing #test-builds

### MCP tool addition is fully headless via connection reference discovery {#bm-019} — 2026-03-06
**Context:** TestBriefing build — needed to add Calendar, Mail, and User Profile MCPs to a new agent in dktest environment
**Tried:** (1) `add-tool.js list-connections` → Connectivity API unreachable. (2) Assumed manual-only. (3) Discovered existing "Daily Briefing" agent in same env already had MCP tools.
**Result:** Queried Dataverse `connectionreference` entity via FetchXML → found 16 connection references including `shared_a365mcpservers` with logicalName `auto_agent_3aiWd.shared_a365mcpservers.71cb47105718486088264bc29dbdd425`. Wrote 3 MCP action YAML files referencing this connection → LSP push → all 3 MCPs appeared on the agent as DialogComponents. Fully headless.
**Better approach:** ALWAYS run `discover-connections` before asking user for manual setup. Connection references are environment-wide — any agent's connections are reusable by all other agents. The only manual step is first-time OAuth consent per connector type per environment. Built `add-tool.js discover-connections` command that queries Dataverse directly (bypasses broken Connectivity API). Updated build skill Step 3c with auto-discover-first flow.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-06
**Related cache:** connectors.md, mcp-servers.md, island-gateway-api.md
**Tags:** #mcp #tool-addition #connection-reference #discover #headless #dataverse

### Agent flow creation: 4 required fields for MCS visibility {#bm-020} — 2026-03-06
**Context:** TestBriefing build — creating Power Automate agent flow via Dataverse POST and linking to agent
**Tried:** Dataverse `POST /workflows` with `category=5`, custom trigger name `When_an_agent_calls_the_flow`, default `modernflowtype=0`
**Result:** Flow created in Dataverse but: (1) `modernflowtype=0` → MCS shows "Flow was deleted or access rights were lost". (2) Custom trigger name → flow doesn't appear in MCS "Add a tool" picker. (3) Missing `metadata.operationMetadataId` on trigger → may affect tool picker visibility.
**Better approach:** Four required fields for MCS to fully recognize a programmatic agent flow:
  1. `modernflowtype: 1` (not 0) — set in workflow record, controls modern vs classic runtime
  2. Trigger name must be `manual` (not custom) — MCS looks for this exact name
  3. Trigger must have `metadata.operationMetadataId` (any GUID) — standard for MCS-created flows
  4. `type: 1` — Workflow Definition type (required for MCS to treat as an agent flow)
Additionally required: `scope: 4` (Organization scope) and `primaryentity: "none"` for proper MCS visibility.
Link to agent via YAML `InvokeFlowTaskAction` (NOT `InvokeFlowAction` — different type hierarchy: TaskAction vs DialogAction).
**Confirmed:** 2 build(s) | Last confirmed: 2026-03-16
**Related cache:** power-automate-integration.md
**Tags:** #agent-flow #power-automate #modernflowtype #trigger-name #dataverse #headless

### GenerativeAIRecognizer required in bot.configuration for publish {#bm-021} — 2026-03-06
**Context:** TestBriefing build — enabling generative orchestration via Dataverse PATCH on bot.configuration
**Tried:** Set `settings.GenerativeActionsEnabled: true` without `recognizer` field
**Result:** Publish silently fails — `synchronizationstatus` shows "Failed" with no error message. Adding `"recognizer": {"$kind": "GenerativeAIRecognizer"}` to the same config fixes it.
**Better approach:** The `bot.configuration` JSON must include BOTH `GenerativeActionsEnabled` AND `recognizer.$kind: GenerativeAIRecognizer`. Also include `$kind` annotations on sub-objects (`AISettings`). Reference pattern from existing working agents. Standard config template now in build skill Step 3b.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-06
**Related cache:** generative-orchestration.md, api-capabilities.md
**Tags:** #generative-orchestration #recognizer #configuration #publish #silent-failure

### Wrong connector operationId causes silent publish failure {#bm-022} — 2026-03-06
**Context:** TestBriefing build — added Planner connector with guessed operationId `CreateTask_V3`
**Tried:** TaskDialog YAML with `InvokeConnectorTaskAction` + `operationId: CreateTask_V3` for the Planner connector
**Result:** LSP push succeeded, but PvaPublish silently fails — no error message, just "Failed" status. Removing the component fixes publish. The operationId was a guess — the correct one might be different.
**Better approach:** Never guess operationIds. Discover from: (1) existing agents in the environment (query their botcomponent data field), (2) Connectivity API `list-operations` if available, (3) MS Learn connector reference pages. A wrong operationId doesn't fail at push time — it fails silently at publish time.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-06
**Related cache:** connectors.md
**Tags:** #operationId #connector #planner #publish #silent-failure

### Bing Web Search is a setting toggle, not a tool {#bm-023} — 2026-03-06
**Context:** TestBriefing research — classified Bing Web Search as `type: "ai-tool"` in agentspec.json
**Tried:** Listed Bing Web Search as an integration with `type: "ai-tool"`
**Result:** Confusion during build — tried to add it as a tool. It's actually a toggle in Settings > Generative AI (`gptCapabilities.webBrowsing: true`), not a tool/connector/MCP.
**Better approach:** Use `type: "setting"` in agentspec.json for agent-level toggles. Added `"setting"` to brief template type options. Updated ai-tools-computer-use.md cache with "NOT tools" callout. Updated build skill Step 3b to handle `type: "setting"` integrations separately. The separate "Bing Search" Power Platform connector IS a tool — different from the grounding toggle.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-06
**Related cache:** ai-tools-computer-use.md, knowledge-sources.md
**Tags:** #bing #web-search #setting #not-a-tool #classification

### Adaptive card conversation start is a standard pattern {#bm-024} — 2026-03-06
**Context:** TestBriefing build — user requested adaptive card welcome as standard for all agents
**Tried:** Plain text Conversation Start topic (default MCS template)
**Result:** Users don't know what the agent can do. Plain text greeting is generic and unhelpful.
**Better approach:** Every agent should have an adaptive card Conversation Start topic with action buttons for key capabilities, unless purely generative with no distinct actions. Created `knowledge/patterns/topic-patterns/welcome-card.yaml` template. Added to `templates/default-recommendations.json` as standard recommendation. Also standard: customize Escalation (specific contacts), Fallback (list capabilities), and On Error topics.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-06
**Related cache:** adaptive-cards.md, conversation-design.md
**Tags:** #adaptive-card #conversation-start #welcome #standard-pattern #topic

### LSP push creates topics that don't render in MCS visual editor — use Gateway API {#bm-026} — 2026-03-10
**Context:** Fidelity FSC Incident Management Agent — 3 custom topics pushed via LSP showed empty canvas in MCS visual editor
**Tried:** (1) Topic Engineer generated valid YAML (om-cli validated). (2) LSP push synced files. (3) Dataverse data field had content. (4) Stripped # Name: comment headers from data → still empty. (5) Added triggerQueries alongside modelDescription → still empty. (6) Created topic via Gateway API BotComponentInsert → WORKS.
**Result:** Two separate issues:
  1. LSP push writes `# Name:` / `# Description:` comment headers into the data field. Fixed via `mcs-lsp.js stripTopicCommentHeaders()` (defense-in-depth).
  2. Even without comments, topics created via LSP push don't render in the MCS canvas. The LSP creates botcomponent records but may skip internal MCS registration (NLU trigger phrase indexing, dependency tracking, topic compilation). The Gateway API BotComponentInsert handles all of these — it's the same code path the MCS UI uses.
**Better approach:** Create topics via Island Gateway API `PUT content/botcomponents` with `BotComponentInsert`. Use `island-client.js createTopic` command. Key ObjectModel JSON rules:
  - `TextSegment` uses `value` field, NOT `text` (text produces empty messages)
  - `Question` node `variable` must be a plain string (`"init:Topic.var"`), NOT a VariableDeclaration object (500 error)
  - `Intent` needs `$kind: "Intent"` wrapper + `displayName` wrapped in `StringExpression`
  - Use `id: "00000000-0000-0000-0000-000000000000"` — server assigns real ID
  - For adaptive cards: create topic with text placeholder via Gateway API, then PATCH data field with YAML containing `SendMessage` + `AdaptiveCardTemplate` + PowerFx `cardContent`
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-10
**Related cache:** api-capabilities.md, island-gateway-api.md
**Tags:** #lsp #topic #gateway-api #visual-editor #canvas #BotComponentInsert #ObjectModel

### MCS native eval runs are sequential — one at a time per agent {#bm-027} — 2026-03-10
**Context:** Fidelity FSC Incident Management Agent — tried to start 3 eval runs simultaneously
**Tried:** Started safety eval run, then immediately started functional eval run
**Result:** Second run failed: HTTP 422 `fairusagepolicy.botactiverunquotaviolated` — "A test is already running for this agent. After it finishes, you can start another test."
**Better approach:** Run eval sets sequentially. After starting a run, poll for completion (or wait ~60s for small sets) before starting the next set. `island-client.js run-eval` should handle this with a `--wait` flag or the eval runner should queue sets internally.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-10
**Related cache:** eval-methods.md
**Tags:** #eval #sequential #quota #gateway-api #makerevaluations

### Empty question in eval set crashes island-client.js {#bm-028} — 2026-03-10
**Context:** Fidelity FSC Incident Management Agent — resilience test #2 had empty question (testing empty input handling)
**Tried:** `island-client.js upload-evals` with a test where `question: ""`
**Result:** Crash: `Cannot read properties of undefined (reading 'substring')` at line 775. Both `t.input` and `t.question` were falsy, so `(t.input || t.question)` returned undefined.
**Better approach:** Fixed: null guard on all eval data fields — `(t.input || t.question || '(empty input test)')`. Also guard the `input` field sent to Gateway API: `t.input || t.question || ' '`. Empty strings are not valid eval inputs — use a space as minimum.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-10
**Related cache:** eval-methods.md
**Tags:** #eval #crash #null-guard #empty-question #island-client

### Adaptive cards require two-step topic creation: Gateway API text + LSP YAML push {#bm-029} — 2026-03-10
**Context:** Fidelity FSC Incident Management — brief specified `outputFormat: "adaptive-card"` with `cardDesign` for Scope Boundary and Write Action Decline, plus bm-024 mandates welcome card for Conversation Start. Build created all topics with plain text, skipping cards entirely.
**Tried:** `island-client.js createTopic` with `kind: "SendActivity"` — only supports plain text. The `SendMessage` handler has a stub comment ("caller should update data field with YAML after creation") but no implementation exists.
**Result:** Three independent failures converged: (1) Build skill Step 4 never reads `outputFormat`/`cardDesign` from agent spec — treats them as documentation. (2) `createTopic` cannot create adaptive cards — silently downgrades to text. (3) Conversation Start welcome card not triggered by any build step.
**Better approach:** Two-step process for adaptive card topics:
  1. Create topic via Gateway API with TEXT PLACEHOLDER (`SendActivity` with fallback text)
  2. Pull workspace → edit topic `.mcs.yml` → replace `SendActivity` with `SendMessage` + `AdaptiveCardTemplate` → LSP push
  LSP push CAN update existing topics (bm-026 only blocks NEW creation). YAML pattern:
  ```yaml
  - kind: SendMessage
    id: sendCard
    message:
      text: "Fallback text"
      attachments:
        - kind: AdaptiveCardTemplate
          cardContent: |-
            ={ type: "AdaptiveCard", version: "1.5", body: [...], actions: [...] }
  ```
  For Conversation Start: use `SendActivity` (not `SendMessage`) with `activity.attachments` per welcome-card.yaml pattern.
  For Action.Submit in Teams: `data: { msteams: { type: "imBack", value: "text" } }`.
  Card schema: 1.5 for Teams. See `knowledge/patterns/topic-patterns/adaptive-card.yaml` and `welcome-card.yaml`.
**Systemic fixes applied:** Build skill Step 4 now has mandatory `outputFormat` check. Topic Engineer agent updated. QA cross-ref checks added.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-10
**Related cache:** adaptive-cards.md, conversation-design.md
**Tags:** #adaptive-card #topic #two-step #gateway-api #lsp #outputFormat #cardDesign #welcome-card #bm-024

### Eval upload is fully headless via Gateway API makerevaluations endpoint {#bm-025} — 2026-03-06
**Context:** Eval upload to MCS — replacing Dataverse POST componenttype=19 approach
**Tried:** (1) Dataverse `POST /botcomponents` with componenttype=19 — creates records but cannot set `parentBotComponentId` (navigation property not supported on botcomponent entity). Test cases appear as orphaned records, not linked to an EvaluationSet. (2) Gateway API `makerevaluations/testcomponent` endpoint.
**Result:** Gateway API works end-to-end. Three-step process: (1) Create EvaluationSet with graders → returns setId. (2) Create EvaluationData rows with `parentBotComponentId: setId` — the critical parent link. (3) Run eval via `POST makerevaluations` with `testSetId`. Grader mapping: GeneralQualityGrader, CompareMeaningGrader (with threshold), ContainsAllGrader, ContainsAnyGrader, ExactMatchGrader, TextSimilarityGrader. Supersedes bm-013 (Dataverse componenttype=19 approach).
**Better approach:** Use `node tools/island-client.js upload-evals --env <envId> --bot <botId> --brief <path>` to upload all eval sets from agentspec.json, then `run-eval --set-id <id>` to trigger scoring. Endpoint: `POST /api/botmanagement/v2/environments/{envId}/bots/{botId}/makerevaluations/testcomponent?ApplyV2Migration=true`. This is now the ONLY method for eval upload — Dataverse POST is deprecated for this use case.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-06
**Related cache:** island-gateway-api.md, eval-methods.md
**Tags:** #eval #gateway-api #makerevaluations #headless #upload #test-cases #supersedes-bm-013

### Bots entity rejects $select and $top — query without OData params {#bm-030} — 2026-03-16
**Context:** CDW Legal HR Policy Advisor update build — listing agents in dktest environment
**Tried:** (1) `GET /bots?$select=name,botid,schemaname,statuscode` — returned `{"value":[]}` (0 results despite 8 agents). (2) `GET /bots?$top=50` — HTTP 400 error "query parameter not supported". (3) `GET /bots` (no OData params) — returned all 8 agents correctly.
**Result:** The bots entity does not reliably support `$select` or `$top` OData query parameters. `$select` silently returns empty results. `$top` returns an explicit error. This extends the known `$select` quirk (bm-018 for synchronizationstatus, bm-020b for botcomponent data field) to the entity level.
**Better approach:** Always query the bots entity WITHOUT `$select` or `$top`. Parse the full response client-side. Use FetchXML if filtering is needed. For bots with many fields, the full entity response is ~14KB per bot — acceptable for environments with <100 agents.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-16
**Related cache:** dataverse-patterns.md
**Tags:** #dataverse #bots #select-quirk #top-parameter #odata #query-limitations

### Update agentspec.json before GPT review — not after {#bm-031} — 2026-03-16
**Context:** CDW Legal HR Policy Advisor build — GPT review flagged stale topic name references
**Tried:** Pushed updated instructions to MCS (with corrected topic names), then ran GPT review via `multi-model-review.js review-instructions`
**Result:** GPT reviewed agentspec.json instructions field (which still had old `/HighRiskScenarioEscalation` references) instead of the pushed version (`/High-Risk Scenario Guidance`). GPT flagged this as "critical" — a false alarm that wasted review credibility.
**Better approach:** Always update the agentspec.json instructions field to match the pushed version BEFORE running GPT review. The sequence should be: (1) write instructions to agent.mcs.yml, (2) update agentspec.json instructions field to match, (3) push via LSP, (4) run GPT review. This ensures GPT reviews the canonical version.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-16
**Related cache:** N/A (process)
**Tags:** #gpt-review #brief #instructions #process #topic-names #sequence

### Python JSON parsing unreliable on Windows — use Node.js {#bm-032} — 2026-03-16
**Context:** CDW Legal HR Policy Advisor build — inline Python parsing failed repeatedly
**Tried:** (1) `python3` — "not found" (Windows App Execution Alias intercept). (2) `python` with stdin piping — returned 0 results/empty arrays despite valid JSON input. (3) `python -c` with inline scripts — inconsistent behavior.
**Result:** 6 failed Python parsing attempts before switching to Node.js. Python stdin piping appears to silently fail on Git Bash / Windows. All subsequent parsing used temp .js files + `node "$TEMP/script.js"` pattern.
**Better approach:** Never use Python for JSON parsing in build scripts. Use `tools/lib/dv-query.js` helper (Node.js) which handles token acquisition, Dataverse queries, and JSON parsing natively. For inline JSON parsing, use temp .js files (required anyway due to Node v24 `!` quirk with -e flag).
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-16
**Related cache:** N/A (tooling)
**Tags:** #python #node-js #json-parsing #windows #git-bash #tooling

### Work IQ dual-connector architecture: overview-page add uses different connectors than Tools menu {#bm-036} — 2026-04-06
**Context:** Fidelity FSC build — had added 3 individual MCPs (Teams, SharePoint, UserProfile) via `shared_a365mcpservers`. User manually added "Work IQ" from the agent overview page instead.
**Tried:** Individual MCP servers via `shared_a365mcpservers` connector with operationIds `mcp_TeamsServer`, `mcp_ODSPRemoteServer`, `mcp_MeServer`.
**Result:** Work IQ from the overview page adds 2 servers using DIFFERENT dedicated connectors:
  1. Work IQ Copilot → `shared_a365copilotchatmcp`, operationId `mcp_m365copilot` (cross-M365 **search-only**, 1 tool: `copilot_chat`)
  2. Work IQ User → `shared_a365memcp`, operationId `mcp_MeServer` (people/org, 6 tools)
  These are separate from `shared_a365mcpservers` (the unified connector hosting ALL individual servers).
**Better approach:** Default to Work IQ from overview page for read-only agents — covers search + people in 2 servers. For write operations (send email, create meeting, post Teams), add individual Work IQ servers via Tools > Add Tool > MCP (uses `shared_a365mcpservers`). Build tools must check for BOTH connector patterns: `shared_a365copilotchatmcp`/`shared_a365memcp` AND `shared_a365mcpservers`. Work IQ Copilot is NOT full CRUD — it's search-only across M365. MS recommends new dedicated connectors for new connections but old unified connector still supported.
**Confirmed:** 1 build(s) | Last confirmed: 2026-04-06
**Related cache:** mcp-servers.md
**Tags:** #work-iq #mcp #connector #dual-architecture #overview-page #search-only #read-write

### Dataverse MCP requires botcomponent_connectionreference M:M association {#bm-037} — 2026-04-06
**Context:** Fidelity FSC build — added Dataverse MCP via raw Dataverse POST (botcomponent type 9)
**Tried:** Created botcomponent with `InvokeExternalAgentTaskAction` YAML referencing `new_sharedcommondataserviceforapps_26751` connection reference. Component appeared in Dataverse query but NOT linked.
**Result:** Querying existing TeamsMCP showed it had a `botcomponent_connectionreference` M:M record. DataverseMCP did not. Created the association via POST to `botcomponents(<id>)/botcomponent_connectionreference/$ref`.
**Better approach:** When creating MCP action components via raw Dataverse POST, always create the M:M `botcomponent_connectionreference` association as a second step. Use: `POST /botcomponents(<componentId>)/botcomponent_connectionreference/$ref` with body `{"@odata.id": "/connectionreferences(<connRefId>)"}`. Without this, MCS may not resolve the connection at runtime.
**Confirmed:** 1 build(s) | Last confirmed: 2026-04-06
**Related cache:** mcp-servers.md, api-capabilities.md
**Tags:** #dataverse-mcp #botcomponent #connection-reference #m2m #association #headless

### DataverseSearchSource is NOT a valid knowledge source kind -- use DataverseStructuredSearchSource {#bm-038b} -- 2026-04-06
**Context:** Fidelity FSC Incident Management, creating 6 Dataverse knowledge sources via raw Dataverse POST
**Tried:** Created botcomponents with `kind: KnowledgeSourceConfiguration` and `source.kind: DataverseSearchSource` with `tables: [{logicalName: "cr509_fscincidents"}]`
**Result:** Components created successfully but MCS publish failed with `UnknownElementError: Node is unknown to the system` for all 6 components. DataverseSearchSource is not a recognized kind.
**Better approach:** The valid kind is `DataverseStructuredSearchSource` with `skillConfiguration` reference (not `tables`). This requires UI setup because the skillConfiguration reference is auto-generated. For structured Dataverse data, use Dataverse MCP Server instead -- it provides precise field-level queries which is better than fuzzy text search for structured tables. Delete invalid knowledge sources to unblock publish.
**Confirmed:** 1 build(s) | Last confirmed: 2026-04-06
**Tags:** #dataverse #knowledge-source #DataverseSearchSource #DataverseStructuredSearchSource #publish-error #UnknownElementError

### PvaPublish is a bound action on the bot entity -- not a root API endpoint {#bm-039} -- 2026-04-06
**Context:** Fidelity FSC Incident Management, publishing agent after topic updates
**Tried:** POST to `api/data/v9.2/PvaPublish` with `{BotId: "..."}` in body
**Result:** HTTP 404 -- `Resource not found for the segment 'PvaPublish'`
**Better approach:** PvaPublish is a bound action. Correct URL: `api/data/v9.2/bots(<botId>)/Microsoft.Dynamics.CRM.PvaPublish` with empty body `{}`. Returns HTTP 200 on success.
**Confirmed:** 1 build(s) | Last confirmed: 2026-04-06
**Tags:** #PvaPublish #bound-action #dataverse #api #publish

### componenttype 9 for topics -- componenttype 1 is Botskill (wrong) {#bm-040} -- 2026-04-06
**Context:** Creating Leadership Summary Report topic via raw Dataverse POST
**Tried:** `componenttype: 1` in the botcomponent POST body
**Result:** HTTP 400 -- `Invalid bot component with bot component type:[Botskill]`
**Better approach:** Use `componenttype: 9` for custom topics (AdaptiveDialog). Key component type mapping: 1=Botskill, 2=Variable, 8=TaskDialog (MCP actions), 9=Topic (custom/system), 10=Localized topic, 15=Instructions (GptComponentMetadata), 16=Knowledge source, 19=Eval data. Always verify componenttype before POST.
**Confirmed:** 1 build(s) | Last confirmed: 2026-04-06
**Tags:** #componenttype #botcomponent #topic #dataverse #POST

### Never use curly braces in MCS instruction text -- PowerFx parse error {#bm-041} -- 2026-04-06
**Context:** Added QuickChart URL examples to agent instructions with placeholder `{encoded_config}`
**Tried:** Instruction text containing `https://quickchart.io/chart?c={encoded_config}&w=500`
**Result:** Runtime error: `Name isn't valid. 'encoded_config' isn't recognized` -- MCS parses all `{...}` in instruction text as PowerFx expression references, even in URLs or examples
**Better approach:** Never include curly braces in instruction YAML text fields. Use URL-encoded equivalents (%7B/%7D), describe patterns in words instead of literal examples, or move complex URL templates to external documentation. This applies to all text fields in botcomponent data, not just instructions.
**Confirmed:** 1 build(s) | Last confirmed: 2026-04-06
**Tags:** #instructions #PowerFx #curly-braces #parse-error #encoding

### Connected agents need TWO components — definition (type 15) AND invocation action (type 9) {#bm-042} — 2026-04-30
**Context:** Multi-agent orchestrator wired to 3 children. Created ConnectedAgentDefinition components via direct Dataverse POST and via Island Gateway `connectedAgentDefinitionChanges` (per bm-012). Both reported success. PvaPublish status=Succeeded. But the orchestrator did NOT actually call the children at runtime — UI showed connected-agent slots empty.
**Tried:** (1) Direct Dataverse POST of `componenttype=15` records with `kind: ConnectedAgentDefinition` data only. (2) Island Gateway `connectedAgentDefinitionChanges` API. Neither resulted in callable children. User had to manually re-add each child via the MCS UI "Agents" tab.
**Result:** Manual UI add created NEW `componenttype=9` records with schema pattern `<orch_schema>.InvokeConnectedAgentTaskAction.<DisplayName>` containing:
```yaml
kind: TaskDialog
modelDisplayName: <child name>
modelDescription: <child description>
action:
  kind: InvokeConnectedAgentTaskAction
  botSchemaName: <child_schema>
  historyType:
    kind: ConversationHistory
```
The original type-15 ConnectedAgentDefinition records remained but alone were insufficient. The type-9 records register each child as an INVOKABLE TOOL the orchestrator can dispatch.
**Better approach:** When wiring a connected agent, create BOTH components in one transaction:
1. **type=15** `ConnectedAgentDefinition` (registers the connection, makes child discoverable)
2. **type=9** TaskDialog with `InvokeConnectedAgentTaskAction` (makes the child callable as a tool — this is what generative orchestration uses to dispatch).

Schema name for the type-9 component: `<orch_schema>.InvokeConnectedAgentTaskAction.<PascalCaseName>` (max display-name chunk ~30 chars; longer names get truncated). Both records must be present BEFORE PvaPublish on the orchestrator. **Supersedes bm-012**: Island Gateway alone creates only the definition, not the invocation action — incomplete.
**Prerequisites on the child (the agent being connected):**
- `bot.configuration.isAgentConnectable: true` (Dataverse PATCH on configuration JSON)
- `bot.authenticationmode = 2` (Microsoft auth)
- Child must be published (PvaPublish + sync status Succeeded) before connection is wired
**Confirmed:** 1 build(s) | Last confirmed: 2026-04-30
**Related cache:** agent-lifecycle.md (Connected Agents section), api-capabilities.md
**Tags:** #connected-agents #multi-agent #orchestrator #componenttype-9 #componenttype-15 #invoke-task-action #supersedes-bm-012

### Flow tool topics need `outputs:` declaration + `connectionProperties.mode: Invoker` {#bm-043} — 2026-04-30
**Context:** Wired a Power Automate flow as a tool on the orchestrator. Wrote a TaskDialog topic component with `inputs:` (AutomaticTaskInput entries describing each flow input) and `action: kind: InvokeFlowTaskAction flowId: <id>`. PvaPublish failed silently with `InvalidReferenceError: CloudFlow with id '<id>' not found`. Activating the flow (`statecode=1`) was not enough.
**Tried:** (1) Set flow `statecode=1, statuscode=2` via Dataverse PATCH. (2) Topic with `inputs:` array of AutomaticTaskInput. (3) `kind: InvokeFlowAction` (DialogAction variant) inside an `OnRecognizedIntent`. All failed.
**Result:** User had to open the flow in Power Automate maker, edit/save (re-publish), then add the agent topic action via MCS UI. The MCS UI created a much simpler component:
```yaml
kind: TaskDialog
outputs:
  - propertyName: text_file_url
  - propertyName: text_file_name
  - propertyName: text_status
action:
  kind: InvokeFlowTaskAction
  flowId: <id>
  connectionProperties:
    $kind: ConnectionProperties
    diagnostics:
    mode: Invoker
outputMode: All
```
Two key differences from my version: (a) NO `inputs:` section — generative orchestration auto-derives inputs from the flow's trigger schema and fills them from conversation context, (b) `connectionProperties.mode: Invoker` runs the flow in the END-USER's identity (not the maker's), required by enterprise security policies.
**Better approach:** When adding a flow as an agent tool:
1. Open the flow in Power Automate maker UI and click "Save" / "Publish" (Dataverse `statecode` PATCH alone does NOT register the agent linkage; the maker UI re-validates inputs/outputs and writes the agent association).
2. Create the tool component with:
   - `kind: TaskDialog`
   - `outputs:` listing the flow's response properties (do NOT include `inputs:` — that's an old pattern)
   - `action.kind: InvokeFlowTaskAction` + `flowId` + `connectionProperties.$kind: ConnectionProperties` + `connectionProperties.mode: Invoker` (always end-user creds for enterprise)
   - `outputMode: All`
3. Schema name: `<agent_schema>.action.<PascalCaseName>` (NOT `.topic.`).
**Confirmed:** 1 build(s) | Last confirmed: 2026-04-30
**Related cache:** agent-lifecycle.md, power-automate-integration.md
**Tags:** #flow-tools #agent-flow #invoke-flow-task-action #connection-properties #invoker-mode #end-user-cred

### Agent settings — required defaults for multi-agent + enterprise {#bm-044} — 2026-04-30
**Context:** After programmatic agent creation, agents had `authenticationmode=1` (None) and missing AI settings. Direct Line worked but children didn't dispatch. User had to set every agent (orchestrator + children) to "Authenticate with Microsoft" via UI.
**Tried:** Created agents via Dataverse POST with default settings — `authenticationmode=1`, `accesscontrolpolicy=2`, no `optInUseLatestModels`, no `isAgentConnectable`. Connected-agent dispatch was silent.
**Result:** User-applied settings on every agent in the chain:
- `authenticationmode = 2` (Microsoft auth — required for connected-agent dispatch and enterprise governance)
- `authenticationconfiguration = {"$kind":"BotAuthenticationConfiguration"}`
- `configuration.isAgentConnectable = true` (toggle "Let other agents connect to and use this one")
- `configuration.aISettings.optInUseLatestModels = true` (latest model selection — currently routes to GPT 5.5 reasoning + Deep reasoning preview)
- `configuration.aISettings.useModelKnowledge = false`
- `configuration.aISettings.isFileAnalysisEnabled = false` (unless explicitly needed)
- `configuration.aISettings.isSemanticSearchEnabled = false` (unless explicitly needed)
- `configuration.aISettings.contentModeration = "Medium"`
- For any tool with `connectionProperties`: `mode: Invoker` (NEVER `Maker` for production demos — runs as end-user not the agent author)
**Better approach:** Bake these settings into agent-creation scripts as defaults. The minimum delta when promoting any agent to multi-agent: `authenticationmode=2 + isAgentConnectable=true + optInUseLatestModels=true`. PATCH the bot row's `configuration` JSON column atomically.
**Confirmed:** 1 build(s) | Last confirmed: 2026-04-30
**Related cache:** agent-lifecycle.md, security-auth.md, limits-licensing.md
**Tags:** #agent-settings #authentication #microsoft-auth #invoker-mode #multi-agent #enterprise-defaults

### Generative orchestration only fills schema-required flow fields {#bm-049} — 2026-04-30
**Context:** Sustainability orchestrator wired to Generate ESG IC Slide flow as a tool (TaskDialog + InvokeFlowTaskAction). Flow trigger schema had 10 input fields but only 2 marked `required` (text_company_name, text_esg_summary). Orchestrator instructions explicitly told it to pass all 10. Fired the demo: trigger body delivered to flow had ONLY the 2 required fields. The 4 material-factor commentaries, ticker, analyst name, review date, and `array_exposure_rows` (most critical) were silently dropped. Result: half-empty slide.
**Tried:** (1) Detailed orchestrator instructions with field-by-field recipe + explicit "fill EVERY parameter" + concrete JSON examples for the array. Still only 2 fields delivered to flow. (2) Verified upstream child agents WERE called and DID produce relevant output in conversation. (3) Confirmed `useModelKnowledge: false` on the orchestrator (the recommended enterprise default per bm-011/bm-046). (4) Confirmed `recognizer.kind = GenerativeAIRecognizer`.
**Result:** Generative orchestration is conservative about optional flow-trigger fields when `useModelKnowledge: false` — it appears to populate ONLY the schema-`required` fields and skip optional ones, even when instructions are emphatic. Instruction discipline alone is insufficient.
**Better approach:** When designing a Power Automate flow that an orchestrator must call as a tool, mark EVERY input the agent is supposed to pass as `required` in the flow trigger schema. Optional inputs should only exist when the flow itself can default them server-side. Specifically:
- For the slide flow: mark all 10 inputs required.
- For agent-narration flows: keep only the truly optional ones (e.g. "language" with a server default) optional.
- Combine with directive instructions ("fill EVERY parameter") for belt-and-braces.
- For a more robust contract, **move data lookups into the flow itself** (Dataverse "List rows" action inside the flow, querying by the company name) — orchestrator passes only the company name, flow does the rest. This eliminates the brittle generative-orchestration array-construction step entirely.
**Confirmed:** 1 build(s) | Last confirmed: 2026-04-30
**Related cache:** power-automate-integration.md, generative-orchestration.md
**Tags:** #generative-orchestration #flow-trigger-schema #required-fields #use-model-knowledge #optional-field-omission #half-empty-slide

### Default to the LATEST experimental model — never hardcode old hints in build scripts {#bm-051} — 2026-04-30
**Context:** Across multiple iterations on the Sustainability multi-agent demo, every script I wrote defaulted to `modelNameHint: GPT5Auto` ($kind: CurrentModels). This is a Preview model from late 2025. The user pointed out: every time I created or updated an agent, the model silently regressed from their preferred latest experimental model back to GPT5Auto. Per `knowledge/cache/models.md` (last verified 2026-04-25), the current latest experimental is GPT-5.5 Reasoning (`modelNameHint: GPT55Reasoning`, `$kind: ExperimentalModels`).
**Tried:** Hardcoded `GPT5Auto` in `create-children.js`, `replicate-agent.js`, `tmp/update-agent-instructions.js`, every PATCH script, and the `agent-lifecycle.md` cache template. Each script created or repaired an agent it would silently downgrade the model.
**Result:** Hardcoded model defaults rot fast. MCS releases new experimental models every few weeks (GPT-5.2 → GPT-5.3 → GPT-5.4 → GPT-5.5 Reasoning all in 2026 wave 1). Hardcoded values in N scripts means N places to update on every refresh.
**Better approach:** Created `knowledge/frameworks/latest-model.json` as the single source of truth for the default model + its `$kind`. All agent-creation scripts (`create-children.js`, `replicate-agent.js`, future scripts) read from this file. Update this file when you TAKE a `knowledge-cache` card from `/mcs-sync` after `models.md` drifts. Pattern:
```js
const _modelCfg = JSON.parse(fs.readFileSync('knowledge/frameworks/latest-model.json', 'utf8'));
const _latestModel = { '$kind': _modelCfg.default.$kind, modelNameHint: _modelCfg.default.modelNameHint };
// Use _latestModel in bot.configuration.aISettings.model
```
**ALSO update both layers when changing models:** `bot.configuration.aISettings.model` (runtime/Bot row JSON) AND the gpt.default component's YAML data field (`aISettings.model.kind` + `modelNameHint`). If only one is updated, they drift — and the YAML one is what the maker UI displays.
**Convention for $kind:** `CurrentModels` for GA + Preview models (e.g. GPT5Chat, GPT5Reasoning, GPT5Auto). `ExperimentalModels` for experimental (e.g. GPT55Reasoning, Claude Opus 4.7). Pair with `optInUseLatestModels: true` so the agent floats forward as MS releases newer versions within the same tier.
**Confirmed:** 1 build(s) | Last confirmed: 2026-04-30
**Related cache:** models.md, agent-lifecycle.md, frameworks/latest-model.json
**Tags:** #model-selection #latest-model #experimental-models #framework-defaults #single-source-of-truth #model-rot

### Power Automate flow PATCH ActiveUnpublished lock — clear by UI save (any modification works) {#bm-050b} — 2026-04-30
**Context:** Same scenario as bm-050. After many failed PATCH attempts, the user added two throwaway test parameters via the UI Parameters tab and saved. Immediately after, programmatic Dataverse PATCH on `workflow.clientdata` succeeded (204). Removed the test parameters in the same PATCH that marked all 10 real parameters as required and fixed the URL binding.
**Tried + Result:** ANY UI save event clears the ActiveUnpublished lock long enough for one PATCH to land. The "phantom" state isn't truly phantom — it's an internal version-tracking row that gets reset whenever maker UI commits. After my PATCH, an explicit `PublishXml` call commits the new published version cleanly.
**Better approach:** When you need to update a published cloud flow programmatically and hit `ActiveUnpublished`:
1. Have the user open the flow in maker UI and either Save (with no edits OR with a trivial edit like adding+removing a parameter) — this clears the lock.
2. Programmatic PATCH on `workflow.clientdata` (Dataverse direct) within ~1 minute of the UI save lands successfully.
3. Follow with `POST /PublishXml` with `ParameterXml: <importexportxml><workflows><workflow id="<id>"/></workflows></importexportxml>` to commit.
4. Republish any agents that reference the flow so they pick up the new trigger schema.

This **unblocks the bm-050 limitation**. The maker UI save is the trigger that clears the lock, but you don't need to make the actual edit through the UI — just trigger any save, then your API PATCH can do the real work.
**Confirmed:** 1 build(s) | Last confirmed: 2026-04-30
**Related cache:** power-automate-integration.md, agent-lifecycle.md
**Tags:** #power-automate #flow-update #active-unpublished #ui-save-unlock #patch-window #publishxml

### Power Automate flow PATCH blocked by ActiveUnpublished — UI Save is the only way to clear {#bm-050} — 2026-04-30
**Context:** Tried to programmatically update a Power Automate flow (Generate ESG IC Slide) to mark trigger fields required + fix the SharePoint Path expression. Both the Dataverse direct PATCH on workflows row and the Power Automate Service API PATCH returned 500 with `XrmApiServerError: ... Component Type: 29  Object Id: <flow-id>  CurrentState=ActiveUnpublished`.
**Tried:** (1) Dataverse PATCH on workflows row with If-Match: * — 400 ActiveUnpublished. (2) Power Automate Service API PATCH (`PATCH /environments/{env}/flows/{flow}?api-version=2016-11-01` with `properties.definition`) — 500 ActiveUnpublished. (3) `PublishXml` action with workflow id in ParameterXml — 204 success, but next PATCH attempt still hit ActiveUnpublished. (4) `Microsoft.Dynamics.CRM.PublishWorkflow` bound action — 404 not found. (5) PAC CLI — no flow namespace. (6) Read back workflow row showed componentstate=0 (Published) and statecode=1/2 (Activated), yet PATCH said ActiveUnpublished.
**Result:** Power Automate cloud flows have a phantom unpublished version state that the maker-UI Save button is the only reliable way to commit. PublishXml and bound publish actions don't clear it. Once any programmatic API PATCH is attempted (even a successful read), a new ActiveUnpublished context is created that blocks subsequent writes.
**Better approach:** When you need to update a published cloud flow, do it BEFORE handing the flow to the user, OR have the user perform the maker-UI Save once after your changes (the API path you used to attempt the change creates the lock). For automation pipelines, deploy flow changes only via solution import (which handles the publish atomically) — never via incremental PATCH after a published version exists. Open question: is there a `/savePublishedVersion` or `/commit` endpoint on the Power Automate Service API that mirrors the maker-UI Save button? Worth filing for `tools/upstream-specs/contracts/`.
**Confirmed:** 1 build(s) | Last confirmed: 2026-04-30
**Related cache:** power-automate-integration.md, agent-lifecycle.md
**Tags:** #power-automate #flow-update #active-unpublished #maker-ui-save #patch-blocked #solution-import-workaround

### SharePoint connector path must be site-relative when dataset is the site URL {#bm-048} — 2026-04-30
**Context:** Generate ESG IC Slide flow. The `Get_template_file_content` action used `dataset = https://<tenant>.sharepoint.com/sites/DKTEST` and `path = /sites/DKTEST/Shared Documents/ESG-Templates/ESG-IC-Slide-Template.pptx`. PvaPublish on the agent succeeded; the file existed at exactly that server-relative path; but at runtime the action returned 404 (NotFound). Power Automate then surfaced the failure to the agent as "BadGateway / NoResponse from upstream server" — a misleading transport error.
**Tried:** (1) Verified template file exists at `/sites/DKTEST/Shared Documents/ESG-Templates/ESG-IC-Slide-Template.pptx` via Graph (37,857 bytes — yes). (2) Replayed the Azure Function call directly with same payload — 0.8s success. (3) Fetched the flow run history — `Get_template_file_content` failed with `code=NotFound`, all subsequent actions skipped. (4) Compared with the MR agent's working flow — its SharePoint paths use **site-relative** form (no `/sites/<site>` prefix), e.g. `/Shared Documents/Blackstone/Generated/`.
**Result:** When the SharePoint connector's `dataset` is the site URL (`https://.../sites/DKTEST`), the `path` parameter must be **site-relative** (start at `/Shared Documents/...`, NOT `/sites/DKTEST/Shared Documents/...`). The doubled prefix resolves on the connector backend as `/sites/DKTEST/sites/DKTEST/...` which doesn't exist. The misleading "BadGateway" error from Power Automate masks the actual cause.
**Better approach:** When generating Power Automate cloud flows that use `shared_sharepointonline` actions:
- Set `dataset` = full site URL (e.g. `https://<tenant>.sharepoint.com/sites/<SiteName>`)
- Set `path` (or `folderPath`) = SITE-RELATIVE path with leading slash (e.g. `/Shared Documents/Folder/file.ext`) — NEVER include the `/sites/<SiteName>` prefix
- Same rule for `GetFileContentByPath`, `CreateFile`, `GetFileMetadataByPath`, etc.
- When debugging "BadGateway / NoResponse from upstream" errors from Power Automate flow actions, do not assume the upstream service (Azure Function, etc.) is the problem — fetch the flow run actions list (`/runs/<id>/actions?api-version=2016-11-01`) and check which action actually failed and with what code. The flow's error surfaced to the agent is often a generic wrapper over the real first-failure code.
**Confirmed:** 1 build(s) | Last confirmed: 2026-04-30
**Related cache:** power-automate-integration.md, connectors.md
**Tags:** #power-automate #sharepoint-connector #site-relative-path #bad-gateway-misleading #flow-debugging

### Knowledge file upload IS programmable — use `filedata` virtual column with octet-stream {#bm-047} — 2026-04-30
**Context:** Sustainability multi-agent demo. Children needed grounded knowledge but `useModelKnowledge: false` blocked instruction-only responses. SharePoint knowledge source worked but added a connection-authorization step in test chat. User asked for direct .md file attachment to each agent. Prior learning bm-023b said this wasn't programmable.
**Tried:** (1) Re-checked botcomponent entity attributes via `GET /EntityDefinitions(LogicalName='botcomponent')/Attributes` and found `filedata` (type=Virtual) and `filedata_name` (type=String) — these ARE the file column pair on botcomponent (bm-023b missed them by querying for File-type attributes; Virtual is the correct AttributeType for Dataverse file columns). (2) Created componenttype=16 record with FileGroupKnowledgeSource YAML in `data` + `filedata_name: <filename>` set on creation. (3) PATCHed `/botcomponents(<id>)/filedata` with binary content and `Content-Type: application/octet-stream` + `x-ms-file-name: <filename>` headers.
**Result:** PATCH returned 204 — file uploaded. Verified via fetch query showing `filedata_name` populated. Three children received their .md knowledge files (esg_company_data.md, revenue_exposure_data.md) via this API path. PvaPublish succeeded for all 4 agents. NO MCS UI step needed.
**Better approach:** Knowledge files are stored as TWO related component types — `componenttype=14` for the actual file binary (one per file) and `componenttype=16` for the `FileGroupKnowledgeSource` that wraps them as searchable knowledge. The agent runtime needs both.

```
# Step 1 — Upload each file (componenttype=14, file column populated)
POST /botcomponents
{
  "componenttype": 14,
  "name": "<file.ext>",
  "schemaname": "<botSchema>.file.<filename_no_dots>",
  "filedata_name": "<file.ext>",
  "parentbotid@odata.bind": "/bots(<botId>)"
}

PATCH /botcomponents(<id>)/filedata
  Content-Type: application/octet-stream     # MUST be octet-stream (text/markdown returns 415)
  x-ms-file-name: <file.ext>
  <raw bytes>

# Step 2 — Wrap them as a FileGroupKnowledgeSource (componenttype=16, NO filedata)
POST /botcomponents
{
  "componenttype": 16,
  "name": "Uploaded files",
  "schemaname": "<botSchema>.knowledge.UploadedFiles",
  "data": "kind: KnowledgeSourceConfiguration\nsource:\n  kind: FileGroupKnowledgeSource\n  instructions:\n    - kind: TextSegment\n      value: \"Reference data file. Search by ...\"\n",
  "parentbotid@odata.bind": "/bots(<botId>)"
}
```

**Important quirk discovered:** if you POST a single componenttype=16 record with BOTH the FileGroupKnowledgeSource YAML and a populated `filedata` column, PvaPublish silently re-types it to componenttype=14 and wipes the YAML. The two layers must be separate records — the type=14 file PLUS a type=16 wrapper that has no filedata of its own. The wrapper auto-discovers all file attachments on the parent bot.

This makes file-based knowledge fully programmable, removes bm-023b's "manual UI upload required" workaround, and fixes the long-standing gap in `dataverse-helper.ps1` `Add-BotKnowledgeFile`.
**Confirmed:** 1 build(s) | Last confirmed: 2026-04-30
**Related cache:** dataverse-patterns.md, knowledge-sources.md, agent-lifecycle.md
**Tags:** #knowledge #file-upload #filedata-virtual-column #octet-stream #x-ms-file-name #supersedes-bm-023b

### `useModelKnowledge: false` + zero knowledge sources/tools = mute agent {#bm-046} — 2026-04-30
**Context:** Child agents in a multi-agent setup had `bot.configuration.aISettings.useModelKnowledge: false` (the "Allow ungrounded responses" UI toggle) per enterprise default. I removed Bing, file search, and other tools from the children, then embedded the mock Dataverse data inline in their gpt.default `instructions`. Expected the children to "narrate from the embedded data". Children went silent at runtime — the model refused to answer without a grounded source.
**Tried:** Embedding cr1a5_esg_company / cr1a5_revenue_exposure data directly inside the children's instruction YAML, with explicit "If asked about X, return Y" rules, expecting the instruction context itself to act as grounding.
**Result:** Instructions are NOT a grounded knowledge source — they are prompt context, and `useModelKnowledge: false` only allows responses backed by knowledge sources (componenttype=16) or tool-call results. With neither configured, the child cannot respond.
**Better approach:** When `useModelKnowledge: false` (the recommended enterprise default per bm-011), every agent that needs to answer questions MUST have at least one of:
  1. A knowledge source (componenttype=16 — SharePoint, file, public URL, Dataverse, custom)
  2. A tool that returns data (flow tool, MCP tool, connector action)
  3. The orchestrator's conversation history dispatched via `historyType: ConversationHistory` (only for connected agents that synthesize without their own data needs)

For mock-data demos, the simplest reproducible path is to upload a Markdown file with the mock data to SharePoint and add a `SharePointSearchSource` knowledge component on the child. SharePointSearchSource accepts a site URL + optional `additionalSearchTerms` to focus discovery. The agent searches the file, finds matching content, and grounds its response. The Sustainability demo wires this with `additionalSearchTerms: esg_company_data` for ESG Research and `revenue_exposure_data` for Revenue Exposure.

YAML for the type-16 component's `data` field:
```yaml
kind: KnowledgeSourceConfiguration
source:
  kind: SharePointSearchSource
  site: https://<tenant>.sharepoint.com/sites/<SiteName>
  cascadeShare: true
  indexBehavior: EnabledWithFallback
  additionalSearchTerms: <unique-keyword-from-file-name>
```

**Build-discipline rule (recommend adding to mcs-build SKILL):** before finishing Step 3 (tools/knowledge configuration), enforce: every agent with `useModelKnowledge: false` must have at least one knowledge source OR tool — otherwise abort and flag.
**Confirmed:** 1 build(s) | Last confirmed: 2026-04-30
**Related cache:** agent-lifecycle.md, knowledge-sources.md
**Tags:** #grounding #use-model-knowledge #knowledge-source #ungrounded-responses #componenttype-16 #sharepoint-search-source #multi-agent #mute-agent

### Power Automate agent flow needs maker-UI re-publish to register agent linkage {#bm-045} — 2026-04-30
**Context:** Created an agent flow programmatically (Dataverse POST with `category=5`, `modernflowtype=1`, `recognizer` field). Tried to register it as an agent tool via topic component. Publish failed with "CloudFlow not found" even though the flow existed in Dataverse and was activated.
**Tried:** PATCH `workflows(<id>)` to `statecode=1, statuscode=2` (Activated). Confirmed flow was active. Added agent topic component referencing the flow ID. PvaPublish on agent → diagnostic error `InvalidReferenceError: CloudFlow with id '<flow-id>' not found`.
**Result:** The Dataverse `workflows` row activation does NOT register the agent linkage. Power Automate maintains a separate "agent-flow registration" state visible only via the maker UI. User opened flow in https://make.powerautomate.com, clicked Save/Publish, then the agent could find the flow.
**Better approach:** After programmatically creating an agent flow, the FINAL step must be a maker-UI publish (or an equivalent Power Platform Cloud Flow Designer API call — under investigation). Until that step, the flow is "headless ready" but NOT discoverable by agent tooling.
- Symptom to watch for: PvaPublish `synchronizationstatus.lastFinishedPublishOperation.diagnosticDetails` containing `InvalidReferenceError: CloudFlow with id '<id>' not found` even though `GET workflows(<id>)` returns the flow.
- Workaround: open https://make.powerautomate.com/environments/<env>/flows, find the flow, click Save (no edits needed) — this triggers the registration.
- Open question: Is there a `PvaCreateContentSnapshot` or `flows-as-agent-tool/register` API that performs the linkage? File for `tools/upstream-specs/contracts/`.
**Confirmed:** 1 build(s) | Last confirmed: 2026-04-30
**Related cache:** agent-lifecycle.md, power-automate-integration.md
**Tags:** #power-automate #agent-flow #flow-publish #agent-linkage #cloud-flow-not-found
