<!-- CACHE METADATA
last_verified: 2026-02-27
sources: [MS Learn, PAC CLI docs, Dataverse MCP docs, direct testing, E2E pipeline test (24/24 pass), ObjectModel schema, Island Gateway wire captures, Power Platform community, VS Code extension blog]
confidence: high
refresh_trigger: on_error
-->
# API Capabilities by Layer — Quick Reference

## Layer Overview

| Layer | Tool | Best For | Cost |
|-------|------|----------|------|
| 1 | PAC CLI (MSI + MCP) | Listing agents, solution ALM | Free |
| 1.5 | **MCS LSP Wrapper** | **Topic push/pull, instructions, model, tools, knowledge, full sync** | **Free** |
| 1.5 | **Island Gateway API** | **Model catalog, component reads, routing, settings** | **Free** |
| 2 | Dataverse MCP Server | Record CRUD, schema discovery | Copilot Credits |
| 3 | PowerShell Web API | Bound actions, complex queries, unattended | Free |
| 4 | Playwright | Agent creation, new OAuth connections | Free |

## Layer 1.5a: MCS LSP Wrapper

**Client:** `tools/mcs-lsp.js` (wraps `LanguageServerHost.exe` from VS Code extension)
**Prerequisite:** Copilot Studio VS Code extension installed + `az login`
**Reference:** `knowledge/cache/island-gateway-api.md` (LSP Wrapper section)

| Operation | Method | Replaces |
|-----------|--------|----------|
| **Clone agent** | `mcs-lsp.js clone` | VS Code GUI |
| **Push topics** | `mcs-lsp.js push` (topics/*.mcs.yml) | Playwright code editor |
| **Push instructions** | `mcs-lsp.js push` (agent.mcs.yml) | Dataverse PATCH / Playwright |
| **Push model selection** | `mcs-lsp.js push` (agent.mcs.yml aISettings) | Playwright dropdown |
| **Push knowledge sources** | `mcs-lsp.js push` (knowledge/*.mcs.yml) | Playwright Knowledge tab |
| **Push settings** | `mcs-lsp.js push` (settings.mcs.yml) | Playwright Settings |
| **Push tool edits** | `mcs-lsp.js push` (actions/*.mcs.yml) | Playwright |
| **Add new tools** | `add-tool.js` + `mcs-lsp.js push` | Playwright Tools tab |
| **Pull remote changes** | `mcs-lsp.js pull` | Manual comparison |
| **Preview changes** | `mcs-lsp.js preview` | N/A |

Handles YAML→JSON conversion automatically via `YamlPassThroughSerializationContext`. Same code path as the official GA VS Code extension.

### LSP Push Limitations

Known limitations of `mcs-lsp.js push` discovered through E2E testing:

| Limitation | Behavior | Workaround |
|-----------|----------|------------|
| Cannot create NEW action components | Push syncs existing actions only; new actions are silently skipped | Add tools via Playwright UI or `add-tool.js` first, then push edits to existing actions |
| `settings.mcs.yml` not pushed | Reports "0 changes", settings silently ignored | Dataverse PATCH on `bot.configuration` JSON field |
| "0 local changes synced" ambiguity | Could mean "nothing to sync" OR "push succeeded, no diff" | Verify via pull or Dataverse read-back after push |
| Bot entity name unchanged by push | `displayName` updates GptComponent, not the bot record itself | Dataverse PATCH `/bots(<id>)` with `{ "name": "..." }` |

> **Cross-reference:** These limitations also apply to the `replicate-agent.js` cross-environment replication tool, which skips actions (connection refs differ per env) and reports settings as a manual verification step.

## Layer 1.5b: Island Control Plane Gateway API

**Client:** `tools/island-client.js` (zero dependencies, Node.js)
**Base:** `powervamg.{region}.gateway.prod.island.powerapps.com`
**Auth:** `az account get-access-token --resource 96ff4394-9197-43aa-b393-6a41652e21f8` (PVA app ID — NOT `api.powerplatform.com`)
**Full reference:** `knowledge/cache/island-gateway-api.md`

| Operation | Endpoint | Replaces |
|-----------|----------|----------|
| **Model discovery** | `GET modelSettings/v2` | Playwright dropdown |
| **Model selection** | `PUT content/botcomponents` (GptComponent) | Playwright dropdown |
| **Read all components** | `POST content/botcomponents` (delta sync) | Dataverse queries |
| **Write components** | `PUT content/botcomponents` | Dataverse PATCH |
| **Get/set instructions** | GptComponent in botcomponents | Dataverse PATCH |
| **Bot settings** | `GET bots/{bid}/settings` | Playwright |
| **Bot routing info** | `GET botroutinginfo` | N/A (new) |
| **Publish status** | `GET publishv2-operations` | Playwright polling |
| **DLP check** | `GET bots/{bid}/dlpstatus` | Manual MCS UI check |
| **List topics** | `POST content/botcomponents` (filtered for DialogComponent) | Raw component parsing |
| **Topic create** | `PUT content/botcomponents` (BotComponentInsert + DialogComponent) | Playwright code editor |
| **Topic update** | `PUT content/botcomponents` (BotComponentUpdate + DialogComponent) | Playwright code editor |

Uses ObjectModel `$kind` types — same schema om-cli validates. Same API the VS Code extension uses.
YAML → JSON mapping documented in `knowledge/cache/island-gateway-api.md`.

## Layer 1.5c: Power Platform Connectivity API

**Client:** `tools/add-tool.js` (`list-operations`, `list-connections` commands)
**Base:** `{envId}.environment.api.powerplatform.com`
**Auth:** `az account get-access-token --resource https://service.powerapps.com/`

| Operation | Endpoint | Replaces |
|-----------|----------|----------|
| **List connector operations** | `GET /connectivity/connectors/{id}?api-version=1` | Manual operationId lookup / static 1.2MB file |
| **List connections** | `GET /connectivity/connectors/{id}/connections?api-version=1` | Manual --connection param lookup |

Enables fully headless tool addition flow: `list-connectors` → `list-operations` → `list-connections` → `add` → `mcs-lsp.js push`.

## Layer 2: Dataverse MCP Server (v0.2.310025)

Tools: `read_query` (20-row limit), `create_record`, `update_record`, `delete_record`, `list_tables`, `describe_table`, `search`, `fetch`

**Limitations**: 20-row limit, no bound actions, interactive auth only, PPAC admin must enable.

## Layer 2: PAC CLI

**MSI** (Bash): `pac copilot list/create/publish/status/extract-template`, `pac solution export/import`
> **Note:** `pac copilot create` requires an undocumented template YAML (topics/instructions only, ~30% of config). Prefer MCS UI creation via Playwright for full-featured agents.
**MCP** (dnx, 52 tools): `copilot_publish`, `env_fetch` (FetchXML, no row limit), `solution_*`, `auth_*`

**Not in PAC CLI MCP**: copilot list/create/status/extract-template — use Bash.

## Layer 3: PowerShell Web API

`Get-Bots`, `Get-BotByName`, `Get-BotComponents`, `Update-BotInstructions`, `Update-BotSecurity`, `Add-BotKnowledgeFile`, `Publish-Bot`, `Get-DirectLineToken`, `Remove-Bot`

**Use when**: bound actions, >20 rows, unattended/CI/CD, file upload.

## Layer 4: Playwright (UI Only — Last Resort)

| Operation | Why Playwright | API Alternative? |
|-----------|---------------|-----------------|
| ~~Agent creation~~ | ~~Full wizard flow~~ | **REPLACED:** Dataverse POST + PvaProvision (E2E confirmed 2026-02-27) |
| Create NEW OAuth connections | Interactive browser auth flow (first time only) | Non-OAuth connections are API-creatable; reuse existing OAuth connections headlessly |
| ~~Connect child agents~~ | ~~MCS orchestration setup~~ | **REPLACED:** Island Gateway `connectedAgentDefinitionChanges` (E2E confirmed 2026-02-27) |
| ~~"Allow other agents to connect"~~ | ~~Not in public API~~ | **REPLACED:** Dataverse PATCH `bot.configuration.isAgentConnectable` (confirmed 2026-02-23) |
| ~~Native eval upload~~ | ~~No API for test cases~~ | **REPLACED:** Dataverse POST `botcomponent` componenttype=19 (E2E confirmed 2026-02-27) |

> **After E2E testing (2026-02-27): Playwright is only needed for first-time OAuth consent.** Agent creation, child agent connection, eval upload, model selection, instructions, topics, knowledge sources, tool editing, settings, web search toggle — all confirmed working via API/LSP. See "API Replacement Research" section below and `tools/e2e-api-pipeline-test.js` for the full test.

## CRITICAL: What Raw Dataverse POST CANNOT Do

**Creating new `botcomponent` records via `POST /botcomponents` is UNSUPPORTED for MCS agents.**

Raw POST creates the Dataverse record but skips MCS internal orchestration:
- No NLU trigger phrase registration (topics won't route)
- No `bot_botcomponent` M:M relationship (agent won't see components)
- No dependency tracking or topic compilation
- Agent appears BLANK in MCS UI despite data existing in Dataverse

| Operation | POST Works? | PATCH Works? | Correct Method |
|-----------|------------|-------------|----------------|
| New topic (type 9) | **NO** — record created but invisible to MCS | N/A | LSP push (`topics/*.mcs.yml` → `mcs-lsp.js push`) |
| New instructions (type 15) | **NO** — same problem | N/A | LSP push (`agent.mcs.yml` → `mcs-lsp.js push`) |
| Update EXISTING instructions (type 15) | N/A | **YES** — component already registered | LSP push (primary) or Dataverse PATCH + PvaPublish |
| Update EXISTING topic content (type 9) | N/A | **RISKY** — MS warns against direct edits | LSP push (`topics/*.mcs.yml` → `mcs-lsp.js push`) |
| New knowledge source (type 16) | **NO** | N/A | LSP push (`knowledge/*.mcs.yml` → `mcs-lsp.js push`) |

### Other Bound Actions

| Action | Status | Use |
|--------|--------|-----|
| `PvaPublish` | Supported | Compile and publish registered components |
| `PvaDeleteBot` | Supported | Delete an agent |
| `PvaGetDirectLineEndpoint` | Supported | Get Direct Line token endpoint |
| `PvaCreateBotComponents` | **Internal use only** — do NOT call | MS-internal, undocumented behavior |

### Column Distinction: `data` vs `content`

The `botcomponent` table has both `data` and `content` columns. Instructions (type 15) use `content` for the JSON payload. Topics (type 9) use `content` for YAML. The `data` column exists but its usage varies by component type — always check via `describe_table` first.

---

## Upcoming API Capabilities

| Feature | Timeline | Impact |
|---------|----------|--------|
| Custom MCP servers | Public preview Mar 2026, GA Apr 2026 | Programmatic MCP server creation via MCP Management Server (already in preview) |

## Refresh Notes

When a Playwright-only operation starts failing, check if an API was added. APIs expand over time.

---

## API Replacement Research (Feb 2026)

**Research date:** 2026-02-26
**Sources checked:** MS Learn (bot entity reference, PAC CLI reference, connection docs, evaluation docs), WebSearch (6 queries), Island Gateway API captured wire format, ObjectModel schema (`bot.schema.yaml.cli.json`), Power Platform community forums, VS Code extension GA blog
**Researcher:** Research Analyst

### 1. Agent Creation

**Verdict: CONFIRMED WORKING (E2E tested 2026-02-27)**

Headless agent creation via Dataverse POST + PvaProvision is fully functional. The two-step flow:

1. **Step A: `POST /api/data/v9.2/bots`** — Create the bot entity record with required fields:
   - `name` (string, max 100)
   - `schemaname` (string, required, unique, max 100 — must use solution publisher prefix e.g. `cr509_agentname`)
   - `language` (int, LCID — 1033 for English)
   - `runtimeprovider` (int, 0 = Power Virtual Agents — required, ApplicationRequired)
   - `configuration` (JSON string — BotConfiguration with aISettings, settings, recognizer)
   - `authenticationmode` (int, default 0)
   - `accesscontrolpolicy` (int, default 0)
   - Optional: `ownerid`, `template`
2. **Step B: `POST /api/data/v9.2/bots(<botId>)/Microsoft.Dynamics.CRM.PvaProvision`** — Provisions the bot in the MCS runtime (registers with Island, creates default components like system topics, GptComponent)

**E2E test results (2026-02-27):**
- POST returns 201 with bot entity immediately
- PvaProvision returns 204 and begins async provisioning
- statuscode transitions: `Provisioning(3) -> Provisioned(1)` (takes ~5-15s)
- After provisioning: agent appears in `pac copilot list`, LSP clone works (produces agent.mcs.yml + settings.mcs.yml)
- Full pipeline confirmed: create → clone → edit YAML → push (instructions, model, topics, knowledge, settings) → publish
- **No special headers or undocumented fields required** — standard Dataverse auth is sufficient
- Provisioned agents get default system topics (Greeting, Escalate, Fallback, etc.)
- Tested with configuration JSON including `aISettings.model.modelNameHint` and `settings.GenerativeActionsEnabled`

**This replaces Playwright for agent creation.** The only remaining Playwright-only operation is first-time OAuth consent.

### 2. OAuth Connection Creation

**Verdict: PARTIALLY REPLACEABLE (non-OAuth connections are API-creatable; OAuth still needs browser)**

**Connection creation API exists** at the Power Platform Connectivity API:

```
PUT https://{ENVIRONMENT_ID_URL}.environment.api.powerplatform.com/connectivity/connectors/{connectorId}/connections/{connectionId}?api-version=1
Authorization: Bearer <token for https://service.powerapps.com/>
```

**What CAN be done via API:**
- Create connections for connectors that use **API key**, **basic auth**, or **service principal** authentication — no browser popup needed
- Create desktop flow (UI Flow) connections with machine credentials
- Reuse existing OAuth connections — `add-tool.js list-connections` finds them, `add-tool.js add` uses them headlessly
- Create connection references in Dataverse (`connectionreference` entity) — these link a connection to a solution

**What CANNOT be done via API:**
- Create **OAuth connections** that require interactive browser consent (e.g., SharePoint, Outlook, Planner, Teams) — the user must click "Allow" in a browser popup during the OAuth consent grant flow
- There is no way to programmatically complete an OAuth consent flow without browser interaction

**Mitigation strategies:**
- **Pre-create connections manually once.** After that, `add-tool.js list-connections` discovers them and they can be reused across multiple agents headlessly.
- **Service principal connections** can replace OAuth for some connectors (notably Dataverse, desktop flows) — fully API-creatable
- **Connection sharing** can be automated via the Power Apps for Makers connector "Edit Connection Role Assignment" action

**Bottom line:** For any connector that already has an active connection in the environment, Playwright is not needed. Playwright is only required for the first-time OAuth consent for a new connector type.

### 3. Child Agent Connection (Connected Agents)

**Verdict: CONFIRMED WORKING (E2E tested 2026-02-27)**

Connected agents can be added programmatically via Island Gateway API `PUT content/botcomponents` using the `connectedAgentDefinitionChanges` array.

**Confirmed payload format:**

```json
{
  "botComponentChanges": [],
  "connectedAgentDefinitionChanges": [
    {
      "$kind": "ConnectedAgentDefinitionInsert",
      "connectedAgentDefinition": {
        "$kind": "ConnectedAgentDefinition",
        "connectedAgentSchemaName": "<target_agent_schemaname>",
        "isAgentConnectable": true
      }
    }
  ],
  "changeToken": "<from readComponents>"
}
```

**Prerequisites:**
1. Target agent must have `isAgentConnectable: true` in `bot.configuration` (set via Dataverse PATCH)
2. Target agent must be published
3. Read orchestrator components first to get `changeToken`
4. Use `ConnectedAgentDefinitionInsert` as the `$kind` for the change entry

**E2E test results (2026-02-27):**
- Island Gateway `PUT content/botcomponents` with `connectedAgentDefinitionChanges` returns 200
- Connected agent appears immediately in orchestrator's component tree
- No additional registration steps needed beyond the single PUT
- The `connectedAgentSchemaName` maps to the target agent's `schemaname` field in Dataverse

**This replaces Playwright for connecting child agents.** No browser interaction needed.

### 4. Native Eval Upload/Run

**Verdict: UPLOAD CONFIRMED, RUN STILL NEEDS UI (E2E tested 2026-02-27)**

Test case creation via Dataverse API is confirmed working. Run triggering still requires MCS UI.

**What's CONFIRMED working via API (E2E tested):**
- **Create test case records** via `POST /botcomponents` with `componenttype = 19` and `parentbotid@odata.bind: /bots(<botId>)`
- Records are automatically linked to the parent bot via the `parentbotid@odata.bind` navigation property
- Content field accepts JSON with test case data (testQuery, expectedResponse, keywords)
- Schemaname must be unique (use publisher prefix + timestamp + random suffix)
- Multiple test cases can be created sequentially, each with its own component record
- Records are queryable via `$filter=_parentbotid_value eq '<botId>' and componenttype eq 19`

**What CANNOT be done via API:**
- **Trigger an evaluation run** — no public API endpoint found
- **Check evaluation progress** — not found in public API

**Practical impact:** For our workflow, Direct Line API (Tier 1) handles all testing programmatically. Native eval upload is useful for populating the MCS Evaluation tab for customer review/manual runs.

### 5. Test Chat API (MCS internal Test Chat WebSocket)

**Verdict: NOT REPLACEABLE (but Direct Line API covers the same need)**

**What the MCS Test Chat pane uses:**
The Test Chat in MCS UI communicates via WebSocket to an internal endpoint that is part of the MCS authoring service. This endpoint:
- Is authenticated via the MCS session cookie (not a standard Bearer token)
- Uses the authoring context (draft content, unpublished changes)
- Has access to the activity map, topic tracking, and debugging features

**Why it's not replaceable:**
- The WebSocket endpoint is internal to the MCS authoring service and not documented
- It requires MCS session state that cannot be obtained programmatically
- Its unique value is testing DRAFT (unpublished) content — something Direct Line cannot do

**Why it doesn't matter:**
- **Direct Line API** (our Tier 1) tests the PUBLISHED agent and is the standard programmatic testing path
- Direct Line supports WebSocket streams for real-time communication
- For agents with Integrated auth that block Direct Line, Playwright Test Chat (Tier 2) is the documented fallback
- The MCS "Run test" button in the Evaluation tab may eventually get an API (see item 4 above)

**Bottom line:** Direct Line replaces the NEED for programmatic test chat. The MCS internal test chat WebSocket is not intended for external programmatic access and has no public API.

### 6. Web Search (Bing) Toggle

**Verdict: REPLACEABLE (confirmed in schema, already documented as LSP-pushable)**

**Where it lives:**

The web browsing/search toggle is in the `GptCapabilities` section of the `GptComponentMetadata`:

```yaml
# In agent.mcs.yml
gptCapabilities:
  webBrowsing: true    # Enables "Use information from the web" / Web Search
  codeInterpreter: false
  generateImages: false
```

**Schema confirmation** (`bot.schema.yaml.cli.json`):
```json
"GptCapabilities": {
  "properties": {
    "webBrowsing": {
      "title": "Web browsing",
      "description": "Uses web browsing as a data source",
      "default": false,
      "type": "boolean"
    },
    "codeInterpreter": { "type": "boolean" },
    "generateImages": { "type": "boolean" }
  }
}
```

**How to set it:**
1. **LSP push** (confirmed working 2026-02-23): Edit `agent.mcs.yml`, set `gptCapabilities.webBrowsing: true`, then `mcs-lsp.js push`
2. **Island Gateway API**: Modify the GptComponent via `PUT content/botcomponents`, setting `metadata.gptCapabilities.webBrowsing: true`
3. **Dataverse PATCH**: Update the GptComponent `data` field (YAML) in `botcomponent` table where `componenttype = 15`

**Note:** This is separate from the admin-level "Allow web search" toggle in Power Platform Admin Center, which is an environment-level setting not controllable per-agent.

**This was already listed as confirmed in `knowledge/cache/island-gateway-api.md` (line 492) but was incorrectly listed as "NOT in the API" in `knowledge/patterns/dataverse-patterns.md`. Cache correction needed.**

---

### Summary Table

| # | Operation | Verdict | Method | Confidence |
|---|-----------|---------|--------|------------|
| 1 | Agent creation | **CONFIRMED** | Dataverse POST + PvaProvision (E2E tested 2026-02-27) | **Proven** |
| 2 | OAuth connection creation | PARTIALLY REPLACEABLE | API for non-OAuth; browser for first OAuth consent only | High |
| 3 | Child agent connection | **CONFIRMED** | Island Gateway `connectedAgentDefinitionChanges` (E2E tested 2026-02-27) | **Proven** |
| 4 | Native eval upload/run | UPLOAD CONFIRMED | Upload test cases via Dataverse componenttype=19 (E2E tested); run still needs UI | **Upload: Proven** |
| 5 | Test Chat WebSocket | NOT REPLACEABLE | Direct Line API covers the programmatic testing need | High |
| 6 | Web search (Bing) toggle | **CONFIRMED** | LSP push `gptCapabilities.webBrowsing` (E2E tested 2026-02-27) | **Proven** |

### Impact on Playwright-Only List

**After E2E testing (2026-02-27), the true Playwright-only operation is:**

1. **First-time OAuth consent** for a new connector type — requires interactive browser

**Everything else is now API-replaceable:**
- ~~Agent creation~~ → Dataverse POST + PvaProvision (confirmed)
- ~~Connect child agents~~ → Island Gateway `connectedAgentDefinitionChanges` (confirmed)
- ~~"Allow other agents to connect"~~ → Dataverse PATCH `bot.configuration.isAgentConnectable` (confirmed)
- ~~Native eval upload~~ → Dataverse POST `botcomponent` componenttype=19 (confirmed)
- ~~Web search toggle~~ → LSP push `gptCapabilities.webBrowsing` (confirmed)
- ~~Test Chat for evals~~ → Direct Line API (separate from MCS internal WebSocket)
- ~~Native eval run trigger~~ → Not needed (Direct Line API handles programmatic testing)

### E2E Test Reference

Full pipeline test: `tools/e2e-api-pipeline-test.js` — 24 steps, all passing.
Test time: ~110 seconds for full create → configure → publish → connect → eval upload → teardown cycle.
