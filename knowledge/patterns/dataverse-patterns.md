# Dataverse API Patterns for MCS Agent Management

Reusable patterns for managing Copilot Studio agents via the **3-layer Dataverse automation stack**:

| Layer | Tool | Best For | Cost |
|-------|------|----------|------|
| 1 | **Dataverse MCP Server** | Record CRUD, schema discovery — native MCP tools | Copilot Credits |
| 2 | **PAC CLI MCP Server** | Solution ALM, publish, env management — native MCP tools | Free |
| 3 | **PowerShell + Web API** | Bound actions, complex queries, fallback CRUD | Free |

**Decision flow:** Dataverse MCP → PAC CLI MCP → PowerShell Web API → User-guided manual steps (last resort, OAuth consent only)

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

**Agent description** lives in `botcomponent.description` (a separate Dataverse entity column), NOT in the YAML `data` field or comment headers. This is the field MCS UI reads for the agent description shown to users. PATCH it directly:
```bash
curl -s -X PATCH "$DV_URL/api/data/v9.2/botcomponents($GPT_ID)" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "If-Match: *" \
  -d '{"description":"Agent description text"}'
```
`mcs-lsp.js push` now auto-patches this field from line 2 of local `agent.mcs.yml`.

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

## Remaining Manual Steps (All-API Stack — Updated 2026-03-05)

### Operations Summary

All agent operations are fully API-native except first-time OAuth consent:

| Operation | Method | Status |
|-----------|--------|--------|
| Agent creation | Dataverse POST + PvaProvision | **API** (E2E confirmed 2026-02-27) |
| Instructions, model, topics, knowledge | LSP push (`mcs-lsp.js`) | **API** |
| Tools/connectors (existing connection) | `add-tool.js` + LSP push | **API** |
| Tools/connectors (NEW OAuth connection) | User creates in MCS portal | **Manual** — only remaining manual step |
| Connected agents | Island Gateway `connectedAgentDefinitionChanges` | **API** (E2E confirmed 2026-02-27) |
| Agent connectable setting | Dataverse PATCH `bot.configuration.isAgentConnectable` | **API** |
| Eval upload | Dataverse POST componenttype=19 | **API** (E2E confirmed 2026-02-27) |
| Web search toggle | `gptCapabilities.webBrowsing` in GptComponent | **API** |
| Publish | PvaPublish bound action | **API** |
| Delete | PvaDeleteBot bound action | **API** |

> **The ONLY manual operation is first-time OAuth consent for a new connector type.** Everything else is confirmed working via API/LSP. Full test: `tools/e2e-api-pipeline-test.js`.

### CRITICAL: Creating New Components via Raw POST Is Broken

**Raw `POST /botcomponents` creates Dataverse records but MCS never sees them.** The agent appears blank in the UI despite data existing in the table. This is because MCS requires internal orchestration (NLU registration, M:M relationships, compilation) that only happens through the MCS UI or MCS-internal APIs.

| What You Want | Wrong Way (Looks Like It Works) | Right Way |
|---------------|--------------------------------|-----------|
| New topic | `POST /botcomponents` with componenttype=9 | LSP push (`topics/*.mcs.yml` → `mcs-lsp.js push`) |
| New instructions | `POST /botcomponents` with componenttype=15 | LSP push (`agent.mcs.yml` → `mcs-lsp.js push`) |
| New knowledge source | `POST /botcomponents` with componenttype=16 | LSP push (`knowledge/*.mcs.yml` → `mcs-lsp.js push`) for sites/URLs. Dataverse API for file uploads. |
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

After Dataverse API creation, the bot entity `name` may not match the intended display name (LSP push updates GptComponent `displayName` but NOT the bot entity name). Patch it directly:

```bash
TOKEN=$(az account get-access-token --resource https://<org>.crm.dynamics.com --query accessToken -o tsv)
curl -s -X PATCH "https://<org>.crm.dynamics.com/api/data/v9.2/bots(<botId>)" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"<displayName>"}'
```

### Common Pitfalls

1. **`_parentbotid_value` vs `parentbotid` — prefer FetchXML**: OData `$filter` with `_parentbotid_value eq <guid>` is **unreliable** — sometimes returns 0 results even when components exist (confirmed Mar 2026). For **FetchXML** (`env_fetch`, curl with `fetchXml=`), use the logical name `parentbotid` — this is the reliable path. For **Dataverse MCP `read_query`** (SQL syntax), `_parentbotid_value` works. For **POST/PATCH** with navigation properties, use `"parentbotid@odata.bind": "/bots(<guid>)"`. **Rule of thumb: always use FetchXML for botcomponent parent lookups.**

2. **`schemaname` is required**: POST without `schemaname` returns: "Attribute 'schemaname' cannot be NULL." Generate a unique schema name (e.g., `cr_componentname_<random>`).

3. **OData `$filter` in Bash**: The `$` sign conflicts with Bash variable expansion. Use PowerShell for OData queries, or carefully escape: `\$filter` (but this can cause "Query option '\\' specified more than once" errors). Safest: use FetchXML via `env_fetch` instead of OData `$filter`.

4. **`$select` doesn't work for JSON/computed fields**: `synchronizationstatus`, `publishedon`, and **`data` on botcomponents** return null/empty when requested via `$select`. Query the full entity (no `$select` parameter) to get these fields. This applies to both `bots` and `botcomponents` entities. Confirmed Mar 2026: `$select=data` on botcomponents returns empty string even when the full entity query returns the YAML content.

---

## Publish Verification Pattern (synchronizationstatus)

**Do NOT rely on PvaPublish HTTP 200 or `publishedon` alone.** Both update even when publish fails internally (e.g., malformed conversation starters). The real publish status lives in the `synchronizationstatus` field.

### Query Pattern

**Important:** Query **without `$select`** — `$select=synchronizationstatus` returns null due to a Dataverse quirk with JSON/computed fields. Query the full entity instead:

```bash
TOKEN=$(az account get-access-token --resource <dataverseUrl> --query accessToken -o tsv)
curl -s "<dataverseUrl>/api/data/v9.2/bots(<botId>)" \
  -H "Authorization: Bearer $TOKEN"
```

### Response Structure

The `synchronizationstatus` field is a JSON string. Parse it to extract:

```json
{
  "lastFinishedPublishOperation": {
    "status": "Succeeded",
    "errorMessage": null,
    "completedOn": "2026-03-05T10:30:00Z"
  }
}
```

### Status Values

| Status | Meaning | Action |
|--------|---------|--------|
| `"Succeeded"` | Publish completed successfully | Proceed — agent is live |
| `"Failed"` | Publish failed internally | Read `errorMessage`, fix the cause, re-publish |
| Field empty / no `lastFinishedPublishOperation` | Publish still in progress | Poll again (up to 6 attempts, 5s apart) |

### Common Failure Causes

| Error in `errorMessage` | Cause | Fix |
|------------------------|-------|-----|
| `MissingRequiredProperty: Title` | Conversation starter missing `title` field | Add `title` to all starters in `agent.mcs.yml`, re-push, re-publish |
| `ConcurrencyVersionMismatch` | Stale workspace — pushed without pulling first | Pull → re-edit → push → re-publish |
| `InvalidComponent` | Malformed YAML in topic or action file | Run `om-cli validate` on workspace YAML files |
| `DuplicateSchemaName` | Two components share the same schema name | Rename one component's `schemaName` field |

### Polling Example (Bash)

```bash
TOKEN=$(az account get-access-token --resource <dataverseUrl> --query accessToken -o tsv)
BOT_ID="<botId>"
DV_URL="<dataverseUrl>"

# Publish
curl -s -X POST "$DV_URL/api/data/v9.2/bots($BOT_ID)/Microsoft.Dynamics.CRM.PvaPublish" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'

# Poll synchronizationstatus (6 attempts, 5s intervals)
for i in $(seq 1 6); do
  sleep 5
  STATUS=$(curl -s "$DV_URL/api/data/v9.2/bots($BOT_ID)" \
    -H "Authorization: Bearer $TOKEN" | python -c "
import json, sys
data = json.load(sys.stdin)
ss = data.get('synchronizationstatus', '')
if ss:
    parsed = json.loads(ss)
    op = parsed.get('lastFinishedPublishOperation', {})
    print(op.get('status', 'pending'))
else:
    print('pending')
" 2>/dev/null)

  if [ "$STATUS" = "Succeeded" ]; then
    echo "Publish succeeded (attempt $i)"
    break
  elif [ "$STATUS" = "Failed" ]; then
    echo "Publish FAILED — check synchronizationstatus for errorMessage"
    break
  else
    echo "Publish pending (attempt $i/6)..."
  fi
done
```
