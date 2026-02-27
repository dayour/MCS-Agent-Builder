# Dataverse API Patterns for MCS Agent Management

Reusable patterns for managing Copilot Studio agents via the **3-layer Dataverse automation stack**:

| Layer | Tool | Best For | Cost |
|-------|------|----------|------|
| 1 | **Dataverse MCP Server** | Record CRUD, schema discovery — native MCP tools | Copilot Credits |
| 2 | **PAC CLI MCP Server** | Solution ALM, publish, env management — native MCP tools | Free |
| 3 | **PowerShell + Web API** | Bound actions, complex queries, fallback CRUD | Free |

**Decision flow:** Dataverse MCP → PAC CLI MCP → PowerShell Web API → Playwright (last resort)

---

## Prerequisites

- **PAC CLI authenticated**: `pac auth list` shows active profile
- **Azure CLI**: `az account get-access-token --resource https://<org>.crm.dynamics.com` (primary token method; Az.Accounts module is NOT installed — do not use `Get-AzAccessToken`)
- **Dataverse MCP Server**: `dotnet tool install --global Microsoft.PowerPlatform.Dataverse.MCP` (for Layer 1)
- **PAC CLI MCP Server**: Configured in `.claude/settings.json` via `dnx` (for Layer 2)

---

## Layer 1: Dataverse MCP Server (Native Tools)

When the Dataverse MCP Server is connected, Claude Code can call these directly:

| MCP Tool | Maps To | Use For |
|----------|---------|---------|
| `read_query` | SELECT SQL | Query bots, botcomponents, any table (20-row limit) |
| `create_record` | POST entity | Create knowledge sources, test cases |
| `update_record` | PATCH entity | Update instructions, security settings |
| `delete_record` | DELETE entity | Remove components |
| `list_tables` | Metadata | Discover available tables |
| `describe_table` | Schema | Inspect column definitions |
| `search` | Dataverse Search | Find records by keyword |
| `fetch` | GET by ID | Retrieve full record |

### Example Queries (via `read_query`)

```sql
-- List all agents
SELECT botid, name, schemaname, statecode, publishedon FROM bot ORDER BY name

-- Find agent by name
SELECT botid, name, schemaname FROM bot WHERE name = 'Builder PM RoB Manager'

-- Get instructions component
SELECT botcomponentid, name, content FROM botcomponent
WHERE _parentbotid_value = '<bot-guid>' AND componenttype = 15

-- Get knowledge sources
SELECT botcomponentid, name, content FROM botcomponent
WHERE _parentbotid_value = '<bot-guid>' AND componenttype = 16

-- Get all components for an agent
SELECT botcomponentid, name, componenttype FROM botcomponent
WHERE _parentbotid_value = '<bot-guid>'
```

### Example Updates (via `update_record`)

```
Table: botcomponent
ID: <component-guid>
Fields: { "content": "<updated YAML/JSON>" }
```

### Limitations
- **20-row limit** on `read_query` results
- **No bound actions** (PvaPublish, PvaDeleteBot, PvaGetDirectLineEndpoint)
- **Interactive auth only** (MSAL browser popup on first use)
- **Requires PPAC admin** to enable MCP for the environment

---

## Layer 2: PAC CLI MCP Server (Native Tools)

52 tools available. Most relevant for MCS automation:

| MCP Tool | Use For |
|----------|---------|
| `copilot_publish` | Publish an agent |
| `solution_list` | List solutions in environment |
| `solution_export` | Export solution zip |
| `solution_import` | Import solution zip |
| `solution_check` | Run Power Apps Checker |
| `env_list` | List all environments |
| `env_select` | Switch active environment |
| `env_fetch` | Run FetchXML query (read-only, no row limit) |
| `auth_list` | List auth profiles |
| `auth_select` | Switch active profile |
| `auth_who` | Show current profile info |
| `admin_list` | List all tenant environments |

### FetchXML via `env_fetch` (no row limit)

```xml
<fetch>
  <entity name="bot">
    <attribute name="botid" />
    <attribute name="name" />
    <attribute name="schemaname" />
    <attribute name="statecode" />
    <filter>
      <condition attribute="name" operator="eq" value="Builder PM RoB Manager" />
    </filter>
  </entity>
</fetch>
```

### Not Available via PAC CLI MCP
- `copilot list` / `copilot create` / `copilot status` / `copilot extract-template` — use Bash `pac copilot` directly
- Record CRUD — use Dataverse MCP or PowerShell

---

## Layer 3: PowerShell + Web API (Fallback / Bound Actions)

**Helper script:** `tools/dataverse-helper.ps1`

### Quick Start

```powershell
# Load helper
. .\tools\dataverse-helper.ps1

# Connect (interactive — uses az CLI for token, no module deps)
$ctx = Connect-Dataverse -OrgUrl "https://orgccf4f9a1.crm.dynamics.com"

# Connect (service principal — unattended/CI)
$ctx = Connect-Dataverse -OrgUrl "https://orgccf4f9a1.crm.dynamics.com" `
    -ClientId "<app-id>" -ClientSecret "<secret>" -TenantId "<tenant-id>"

# Connect using active PAC auth profile's environment
$ctx = Connect-DataverseFromPac
```

**Token priority:** Service Principal > Azure CLI (`az account get-access-token`) > Az.Accounts (fallback).
Az.Accounts is NOT required. Azure CLI is the recommended interactive method.

### Operations

```powershell
# List all agents
$bots = Get-Bots -Ctx $ctx

# Find agent by name
$bot = Get-BotByName -Ctx $ctx -Name "Builder PM RoB Manager"

# Get components by type
$instructions = Get-BotComponents -Ctx $ctx -BotId $botId -ComponentType 15
$knowledge = Get-BotComponents -Ctx $ctx -BotId $botId -ComponentType 16
$topics = Get-BotComponents -Ctx $ctx -BotId $botId -ComponentType 9

# Update instructions
Update-BotInstructions -Ctx $ctx -BotId $botId -Instructions "New instructions text"

# Update security
Update-BotSecurity -Ctx $ctx -BotId $botId -AccessControl 0 -AuthMode 2 -AuthTrigger 0

# Upload knowledge file
Add-BotKnowledgeFile -Ctx $ctx -BotId $botId -FilePath "C:\path\to\doc.pdf"

# Publish (bound action)
Publish-Bot -Ctx $ctx -BotId $botId

# Get Direct Line token (bound action)
$dl = Get-DirectLineToken -Ctx $ctx -BotId $botId

# Delete agent (bound action)
Remove-Bot -Ctx $ctx -BotId $botId
```

### When to Use PowerShell Over MCP

| Scenario | Why PowerShell |
|----------|---------------|
| Bound actions (PvaPublish, PvaDeleteBot, PvaGetDirectLineEndpoint) | Not available in either MCP server |
| Queries returning > 20 rows | Dataverse MCP has 20-row limit |
| Unattended / CI/CD | Service principal auth (MCP servers need interactive) |
| Complex multi-step operations | Script orchestration with error handling |
| File upload (knowledge) | Binary content handling |

---

## Key Entity Reference

### bot entity
| Field | Type | Purpose |
|-------|------|---------|
| `botid` | GUID | Primary key |
| `name` | string | Display name |
| `schemaname` | string | Unique schema name |
| `statecode` | int | 0=Active, 1=Inactive |
| `accesscontrolpolicy` | int | Access control mode |
| `authenticationmode` | int | Auth configuration |
| `publishedon` | datetime | Last publish time |
| `language` | int | LCID (1033=English) |

### botcomponent entity
| Field | Type | Purpose |
|-------|------|---------|
| `botcomponentid` | GUID | Primary key |
| `name` | string | Component name |
| `componenttype` | int | Type code (see below) |
| `data` | string | **Source YAML** (writable, what MCS UI reads/writes) |
| `content` | string | **Compiled JSON** (read-only after publish, runtime use) |
| `_parentbotid_value` | GUID | Parent agent |
| `schemaname` | string | Unique schema name |
| `description` | string | Component description |

**CRITICAL: Instructions have TWO fields. Use `data` (YAML), not `content` (JSON).**
- `data`: YAML format `kind: GptComponentMetadata\ndisplayName: ...\ninstructions: |-\n  ...` -- PATCH works, MCS UI reflects changes
- `content`: JSON `{"systemMessage":"..."}` -- compiled/read-only, synced by PvaPublish
- After PATCHing `data`, call `PvaPublish` to sync to `content` for runtime

### Component Type Codes
| Code | Type |
|------|------|
| 0 | Topic |
| 5 | Trigger |
| 9 | Topic (V2) |
| 14 | Bot File Attachment |
| 15 | Custom GPT (instructions) |
| 16 | Knowledge Source |
| 17 | External Trigger |
| 18 | Copilot Settings |
| 19 | Test Case |

---

## Bot Settings via API (No Playwright Needed)

Agent settings that were previously Playwright-only can be configured via Dataverse API.

### bot.configuration field (JSON in Memo field)

Read current → modify JSON → PATCH back → PvaPublish. The `configuration` field stores all generative AI settings.

```bash
# Read
CONFIG=$(curl -s -G "$DV_URL/api/data/v9.2/bots($BOT_ID)" \
  --data-urlencode '$select=configuration' \
  -H "Authorization: Bearer $TOKEN" | python -c "import json,sys; print(json.load(sys.stdin).get('configuration',''))")

# Modify (example: turn off general knowledge)
NEW_CONFIG=$(echo "$CONFIG" | python -c "import json,sys; c=json.load(sys.stdin); c['aISettings']['useModelKnowledge']=False; print(json.dumps(c))")

# Write back (configuration value must be JSON-string-escaped)
curl -s -X PATCH "$DV_URL/api/data/v9.2/bots($BOT_ID)" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "If-Match: *" \
  -d "{\"configuration\": $(echo "$NEW_CONFIG" | python -c "import json,sys; print(json.dumps(sys.stdin.read()))")}"
```

| UI Setting | JSON Path in configuration | Values |
|-----------|--------------------------|--------|
| Use general knowledge | `aISettings.useModelKnowledge` | `true`/`false` |
| File uploads | `aISettings.isFileAnalysisEnabled` | `true`/`false` |
| Content moderation | `aISettings.contentModeration` | `"High"`, `"Medium"`, `"Low"` |
| Use latest models | `aISettings.optInUseLatestModels` | `true`/`false` |
| Generative orchestration | `settings.GenerativeActionsEnabled` | `true`/`false` |
| Allow agent connection | `isAgentConnectable` | `true`/`false` |

### Direct bot entity fields

| UI Setting | Field | Values |
|-----------|-------|--------|
| Auth mode | `authenticationmode` | `0`=None, `1`=Integrated, `2`=GenericOauth |

### GptComponent data field (YAML in botcomponent)

The Custom GPT botcomponent (componenttype=15) `data` field contains YAML with:
- `instructions:` — agent instructions
- `aISettings.model.modelNameHint:` — model selection
- `conversationStarters:` — suggested prompts (array of `title` + `text`)

```yaml
conversationStarters:
  - title: Ask a policy question
    text: What is CDW's policy on remote work?
  - title: Report a concern
    text: I need to report an ethics concern
```

Can be written via LSP push (edit `agent.mcs.yml` in workspace) or Dataverse PATCH on the botcomponent `data` field.

### GptCapabilities in GptComponent (YAML in botcomponent data field)

The web browsing (Bing search) toggle and other capabilities are in the `gptCapabilities` section:

```yaml
# In agent.mcs.yml or GptComponent data field
gptCapabilities:
  webBrowsing: true     # "Use information from the web" / Web Search toggle
  codeInterpreter: false # Code interpreter capability
  generateImages: false  # Image generation capability
```

Can be set via LSP push (`agent.mcs.yml`), Island Gateway API (`PUT botcomponents` GptComponent), or Dataverse PATCH on botcomponent `data` field.

**Note:** This is the per-agent setting. There is also an environment-level admin toggle in Power Platform Admin Center that overrides per-agent settings.

---

## What CANNOT Be Done via API (Requires Playwright)

### UI-Only Operations (Updated 2026-02-27 — post E2E test)

| Operation | Status | Notes |
|-----------|--------|-------|
| ~~Agent creation~~ | **REPLACED** | Dataverse POST + PvaProvision (E2E confirmed 2026-02-27). See `api-capabilities.md`. |
| Create NEW OAuth connections | PARTIALLY REPLACEABLE | First-time OAuth consent needs browser. Existing connections reusable headlessly via `add-tool.js`. |
| ~~Connect child agents~~ | **REPLACED** | Island Gateway `connectedAgentDefinitionChanges` (E2E confirmed 2026-02-27). |
| ~~"Allow other agents to connect"~~ | **REPLACED** | Dataverse PATCH `bot.configuration.isAgentConnectable` (confirmed 2026-02-23). |
| ~~Native eval upload~~ | **REPLACED** | Dataverse POST `botcomponent` componenttype=19 with `parentbotid@odata.bind` (E2E confirmed 2026-02-27). |
| ~~Web search (Bing) toggle~~ | **REPLACED** | `gptCapabilities.webBrowsing` in GptComponent. LSP push, Island Gateway, or Dataverse PATCH. |

> **After E2E testing (2026-02-27): The ONLY Playwright-required operation is first-time OAuth consent for a new connector type.** Everything else — agent creation, model, instructions, topics, knowledge, tools, settings, connected agents, eval upload, publish, delete — is confirmed working via API/LSP. Full test: `tools/e2e-api-pipeline-test.js`.

### CRITICAL: Creating New Components via Raw POST Is Broken

**Raw `POST /botcomponents` creates Dataverse records but MCS never sees them.** The agent appears blank in the UI despite data existing in the table. This is because MCS requires internal orchestration (NLU registration, M:M relationships, compilation) that only happens through the MCS UI or MCS-internal APIs.

| What You Want | Wrong Way (Looks Like It Works) | Right Way |
|---------------|--------------------------------|-----------|
| New topic | `POST /botcomponents` with componenttype=9 | LSP push (`topics/*.mcs.yml` → `mcs-lsp.js push`). Playwright Code Editor is fallback. |
| New instructions | `POST /botcomponents` with componenttype=15 | LSP push (`agent.mcs.yml` → `mcs-lsp.js push`). Playwright is fallback. |
| New knowledge source | `POST /botcomponents` with componenttype=16 | LSP push (`knowledge/*.mcs.yml` → `mcs-lsp.js push`) for sites/URLs. Dataverse API for file uploads. Playwright is fallback. |
| Update EXISTING instructions | `PATCH content` field (400 error) | **`PATCH data` field (YAML) + `PvaPublish` -- WORKS** (E2E tested 2026-02-20) |
| Publish | — | `PvaPublish` bound action or `pac copilot publish` (MCP version) |

**Why this is dangerous:** The POST returns 201 Created with a valid GUID. FetchXML queries confirm the record exists. Everything looks successful. But the agent in MCS shows nothing — no topics, no instructions. The failure is completely silent.

### Safe Dataverse Operations (Verified Working)

| Operation | Method | Notes |
|-----------|--------|-------|
| Query agents | `read_query` / `env_fetch` (FetchXML) | Both work; env_fetch has no row limit |
| Query components | `read_query` / `env_fetch` | Filter by `_parentbotid_value` and `componenttype` |
| Update existing instructions | `PATCH /botcomponents(<id>)` | Component must already exist (created via UI) |
| Publish agent | `PvaPublish` bound action | Or MCP `copilot_publish` |
| Delete agent | `PvaDeleteBot` bound action | Or PowerShell `Remove-Bot` |
| Get Direct Line token | `PvaGetDirectLineEndpoint` | For eval testing |

### Bot Entity Name Update

After Playwright creation, the bot entity `name` may not match the intended display name (LSP push updates GptComponent `displayName` but NOT the bot entity name). Patch it directly:

```bash
TOKEN=$(az account get-access-token --resource https://<org>.crm.dynamics.com --query accessToken -o tsv)
curl -s -X PATCH "https://<org>.crm.dynamics.com/api/data/v9.2/bots(<botId>)" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"<displayName>"}'
```

### Common Pitfalls

1. **`_parentbotid_value` vs `parentbotid@odata.bind`**: For queries, use `_parentbotid_value`. For POST/PATCH with navigation properties, use `"parentbotid@odata.bind": "/bots(<guid>)"`. Direct update of `_parentbotid_value` returns: "CRM does not support direct update of Entity Reference properties."

2. **`schemaname` is required**: POST without `schemaname` returns: "Attribute 'schemaname' cannot be NULL." Generate a unique schema name (e.g., `cr_componentname_<random>`).

3. **OData `$filter` in Bash**: The `$` sign conflicts with Bash variable expansion. Use PowerShell for OData queries, or carefully escape: `\$filter` (but this can cause "Query option '\\' specified more than once" errors). Safest: use FetchXML via `env_fetch` instead of OData `$filter`.
