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

### Knowledge file upload: POST works but file attach endpoints don't exist {#bm-023b} — 2026-03-06
**Context:** TestNorthwind build — uploading CommonFixes.csv as agent knowledge file
**Tried:** (1) `POST /botcomponents` with componenttype=16 + `parentbotid@odata.bind` + schemaname → record created successfully. (2) `PATCH /botcomponents(<id>)/fileattachment` → HTTP 404. (3) `PATCH /botcomponents(<id>)/botcomponentfiledata` → HTTP 404. (4) Original helper used `_parentbotid_value` → "CRM does not support direct update of Entity Reference properties" error.
**Result:** Knowledge component record is created in Dataverse, but no file upload endpoint exists on botcomponents. The `content` and `fileattachment` and `botcomponentfiledata` paths all return 404. This extends the bm-002 learning: even with correct navigation properties, raw POST creates records MCS doesn't fully recognize.
**Better approach:** For file knowledge: use MCS UI to upload (user-guided manual step), or find the MCS-specific file upload API (not raw Dataverse). The `dataverse-helper.ps1` `Add-BotKnowledgeFile` function now uses `parentbotid@odata.bind` + `schemaname` (fixed from `_parentbotid_value`), but file attachment still needs the correct endpoint. For SharePoint/URL knowledge: LSP push works (`knowledge/*.mcs.yml`).
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-06
**Related cache:** dataverse-patterns.md, knowledge-sources.md
**Tags:** #knowledge #file-upload #dataverse #botcomponent #manual-step

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
**Better approach:** ALWAYS attempt every MVP item in the brief, even in test builds. If an item fails, document: (1) what was tried, (2) the specific error, (3) what needs to happen to unblock it. A failed attempt with a clear error is infinitely more valuable than a silently skipped item. The build skill already says "never mark complete until verified" — extend this to "never skip without attempting."
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
**Context:** TestBriefing research — classified Bing Web Search as `type: "ai-tool"` in brief.json
**Tried:** Listed Bing Web Search as an integration with `type: "ai-tool"`
**Result:** Confusion during build — tried to add it as a tool. It's actually a toggle in Settings > Generative AI (`gptCapabilities.webBrowsing: true`), not a tool/connector/MCP.
**Better approach:** Use `type: "setting"` in brief.json for agent-level toggles. Added `"setting"` to brief template type options. Updated ai-tools-computer-use.md cache with "NOT tools" callout. Updated build skill Step 3b to handle `type: "setting"` integrations separately. The separate "Bing Search" Power Platform connector IS a tool — different from the grounding toggle.
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
**Result:** Three independent failures converged: (1) Build skill Step 4 never reads `outputFormat`/`cardDesign` from brief — treats them as documentation. (2) `createTopic` cannot create adaptive cards — silently downgrades to text. (3) Conversation Start welcome card not triggered by any build step.
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
**Better approach:** Use `node tools/island-client.js upload-evals --env <envId> --bot <botId> --brief <path>` to upload all eval sets from brief.json, then `run-eval --set-id <id>` to trigger scoring. Endpoint: `POST /api/botmanagement/v2/environments/{envId}/bots/{botId}/makerevaluations/testcomponent?ApplyV2Migration=true`. This is now the ONLY method for eval upload — Dataverse POST is deprecated for this use case.
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

### Update brief.json before GPT review — not after {#bm-031} — 2026-03-16
**Context:** CDW Legal HR Policy Advisor build — GPT review flagged stale topic name references
**Tried:** Pushed updated instructions to MCS (with corrected topic names), then ran GPT review via `multi-model-review.js review-instructions`
**Result:** GPT reviewed brief.json instructions field (which still had old `/HighRiskScenarioEscalation` references) instead of the pushed version (`/High-Risk Scenario Guidance`). GPT flagged this as "critical" — a false alarm that wasted review credibility.
**Better approach:** Always update the brief.json instructions field to match the pushed version BEFORE running GPT review. The sequence should be: (1) write instructions to agent.mcs.yml, (2) update brief.json instructions field to match, (3) push via LSP, (4) run GPT review. This ensures GPT reviews the canonical version.
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
