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

### Eval test case upload via Dataverse API — componenttype 19 {#bm-013} — 2026-02-27
**Context:** E2E pipeline test — create evaluation test cases programmatically
**Tried:** `POST /botcomponents` with componenttype=19, content (JSON with testQuery/expectedResponse/keywords), and `parentbotid@odata.bind: /bots(<botId>)`
**Result:** WORKS. Records created and automatically linked to parent bot. Queryable via `$filter=_parentbotid_value eq '<botId>' and componenttype eq 19`. Schemaname must be unique (use publisher prefix + timestamp + random). Note: `parentbotid@odata.bind` works for componenttype=19 (unlike type 9/15/16 which need LSP).
**Better approach:** Create test cases via Dataverse POST. This is the ONLY componenttype where raw POST works correctly (because test cases don't need NLU registration or topic compilation). For test sets, use `botcomponentcollection` table.
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-27
**Related cache:** api-capabilities.md, eval-methods.md
**Tags:** #eval #test-cases #dataverse #componenttype-19 #headless

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

### OData $filter on _parentbotid_value is unreliable — use FetchXML {#bm-012} — 2026-03-06
**Context:** TestNorthwind build — querying botcomponents by parent bot ID after agent creation
**Tried:** OData `GET /botcomponents?$filter=_parentbotid_value eq <guid>` and `$filter=_parentbotid_value eq <guid> and componenttype eq 15`
**Result:** Both queries return 0 results despite 15 components existing. FetchXML with `parentbotid` (logical name) returns all 15 correctly.
**Better approach:** Always use FetchXML with `parentbotid` for botcomponent parent lookups. OData filter on `_parentbotid_value` is unreliable — possibly a Dataverse GUID matching quirk on lookup fields. The `mcs-lsp.js` tool already uses FetchXML correctly; build scripts should too.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-06
**Related cache:** dataverse-patterns.md (pitfall #1)
**Tags:** #dataverse #fetchxml #odata #parentbotid #botcomponent

### $select=data on botcomponents returns empty — query full entity {#bm-013} — 2026-03-06
**Context:** TestNorthwind build — verifying GptComponent data field after Dataverse PATCH
**Tried:** `GET /botcomponents(<id>)?$select=data` to read the YAML content
**Result:** Returns empty string. `GET /botcomponents(<id>)` (full entity, no $select) returns the correct YAML content (4703 chars). Same Dataverse quirk as `synchronizationstatus` on bots.
**Better approach:** Never use `$select=data` on botcomponents. Query the full entity. This extends the known `$select` quirk (bm-011) to include the `data` field on botcomponents, not just `synchronizationstatus`/`publishedon` on bots.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-06
**Related cache:** dataverse-patterns.md (pitfall #4)
**Tags:** #dataverse #select-quirk #botcomponent #data-field

### LSP push "0 changes" on newly created agents — Dataverse PATCH fallback added {#bm-014} — 2026-03-06
**Context:** TestNorthwind build — first push after creating agent via Dataverse API + PvaProvision + LSP clone
**Tried:** Clone agent → write full agent.mcs.yml (instructions, model, starters) → LSP push
**Result:** Push completes with "0 local changes synced". The metadata patch (name + description) succeeds, but the YAML body (instructions, model, conversation starters) is NOT synced to the GptComponent data field. A manual Dataverse PATCH of the full `data` field works.
**Better approach:** `mcs-lsp.js push` now includes `verifyAndPatchBody()` which runs after every push: reads GptComponent data field (full entity, no $select), checks if instructions are present. If missing, patches via Dataverse API. This handles the LSP's failure to detect changes on fresh agents.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-06
**Related cache:** api-capabilities.md
**Tags:** #lsp #push #zero-changes #dataverse #fallback #gpt-component

### Auth gate must explicitly ask for environment — never assume {#bm-015} — 2026-03-06
**Context:** TestNorthwind build — user selected account admin@M365CPI15209943 which has 2 environments (dktest, Contoso)
**Tried:** Selected account → assumed "dktest" from sessionDefaults without asking user
**Result:** Built on dktest without confirming. If user wanted Contoso, the entire build would target the wrong environment. Also, PAC CLI had a device auth error (AADSTS700003) that was only caught after the build started.
**Better approach:** Auth gate must ALWAYS: (1) Ask account, (2) Ask environment explicitly when account has 2+ environments, (3) Verify three layers with actual API calls: Azure CLI tenant match → Dataverse API reachable → PAC CLI best-effort. Build skill updated with two-step selection + three-layer verification. PAC CLI failure is now a warning, not a blocker.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-06
**Related cache:** N/A (process change, not API pattern)
**Tags:** #auth #environment #build-gate #pac-cli #verification

### Knowledge file upload: POST works but file attach endpoints don't exist {#bm-016} — 2026-03-06
**Context:** TestNorthwind build — uploading CommonFixes.csv as agent knowledge file
**Tried:** (1) `POST /botcomponents` with componenttype=16 + `parentbotid@odata.bind` + schemaname → record created successfully. (2) `PATCH /botcomponents(<id>)/fileattachment` → HTTP 404. (3) `PATCH /botcomponents(<id>)/botcomponentfiledata` → HTTP 404. (4) Original helper used `_parentbotid_value` → "CRM does not support direct update of Entity Reference properties" error.
**Result:** Knowledge component record is created in Dataverse, but no file upload endpoint exists on botcomponents. The `content` and `fileattachment` and `botcomponentfiledata` paths all return 404. This extends the bm-002 learning: even with correct navigation properties, raw POST creates records MCS doesn't fully recognize.
**Better approach:** For file knowledge: use MCS UI to upload (user-guided manual step), or find the MCS-specific file upload API (not raw Dataverse). The `dataverse-helper.ps1` `Add-BotKnowledgeFile` function now uses `parentbotid@odata.bind` + `schemaname` (fixed from `_parentbotid_value`), but file attachment still needs the correct endpoint. For SharePoint/URL knowledge: LSP push works (`knowledge/*.mcs.yml`).
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-06
**Related cache:** dataverse-patterns.md, knowledge-sources.md
**Tags:** #knowledge #file-upload #dataverse #botcomponent #manual-step

### Connectivity API doesn't resolve — blocks add-tool.js for tool configuration {#bm-017} — 2026-03-06
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

### Agent flow creation: 3 required fields for MCS visibility {#bm-020} — 2026-03-06
**Context:** TestBriefing build — creating Power Automate agent flow via Dataverse POST and linking to agent
**Tried:** Dataverse `POST /workflows` with `category=5`, custom trigger name `When_an_agent_calls_the_flow`, default `modernflowtype=0`
**Result:** Flow created in Dataverse but: (1) `modernflowtype=0` → MCS shows "Flow was deleted or access rights were lost". (2) Custom trigger name → flow doesn't appear in MCS "Add a tool" picker. (3) Missing `metadata.operationMetadataId` on trigger → may affect tool picker visibility.
**Better approach:** Three required fields for MCS to fully recognize a programmatic agent flow:
  1. `modernflowtype: 1` (not 0) — set in workflow record, controls modern vs classic runtime
  2. Trigger name must be `manual` (not custom) — MCS looks for this exact name
  3. Trigger must have `metadata.operationMetadataId` (any GUID) — standard for MCS-created flows
Link to agent via YAML `InvokeFlowTaskAction` (NOT `InvokeFlowAction` — different type hierarchy: TaskAction vs DialogAction).
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-06
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
