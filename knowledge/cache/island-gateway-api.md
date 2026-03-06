<!-- CACHE METADATA
last_verified: 2026-02-23
sources: [Network interception, ObjectModel VS Code extension source (IslandControlPlaneService.cs), direct testing]
confidence: high
refresh_trigger: on_error
-->
# Island Control Plane Gateway API — Reference

## Overview

The MCS frontend communicates with a REST API called the **Island Control Plane** at `powervamg.{region}.gateway.prod.island.powerapps.com`. This is the same API the ObjectModel team's VS Code extension (`PowerPlatformLS`) uses for content authoring.

**Client:** `tools/island-client.js` (zero dependencies, Node.js)

---

## Authentication

**Token resource:** `96ff4394-9197-43aa-b393-6a41652e21f8` (PVA app ID)

> **Note:** The Connectivity API (connector metadata, `add-tool.js`) uses `https://service.powerapps.com/` as its token resource, while the Island Gateway (agent components) uses the PVA app ID. Do not confuse the two. (`api.powerplatform.com` is a hostname used in Connectivity API URLs, not a token resource.)

```bash
az account get-access-token --resource 96ff4394-9197-43aa-b393-6a41652e21f8 --query accessToken -o tsv
```

**Required headers** (from `IslandControlPlaneService.cs` lines 136-148):

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer {token}` |
| `x-ms-client-tenant-id` | Tenant GUID |
| `x-cci-tenantid` | Tenant GUID (same) |
| `x-cci-bapenvironmentid` | Environment ID (e.g. `Default-xxx`) |
| `x-cci-cdsbotid` | CDS Bot ID GUID (for bot-specific calls) |
| `Content-Type` | `application/json` |

---

## Gateway URL Discovery

The gateway URL follows the pattern: `powervamg.{geo}-il{island}.gateway.prod.island.powerapps.com`

**Discovery method:** Call `botroutinginfo` to get the island number, or capture from MCS frontend's initial settings call.

**Known regions:**
| Geo | Island | Full URL |
|-----|--------|----------|
| US | 104 | `powervamg.us-il104.gateway.prod.island.powerapps.com` |

The gateway URL should be persisted in `session-config.json` after first discovery.

---

## API Endpoints

### Bot Management (v1)

Base: `/api/botmanagement/v1/`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `languages` | GET | Available languages |
| `settings/client?environmentId={eid}` | GET | MCS client settings |
| `environments/{eid}/botroutinginfo?cdsBotId={bid}` | GET | Map CDS bot → PVA bot, island, schema |
| `environments/{eid}/bots/{bid}/settings` | GET | Bot settings (overlap detection, etc.) |
| `environments/{eid}/bots/{bid}/content/botcomponents` | POST | **Read all components** (delta sync) |
| `environments/{eid}/bots/{bid}/content/botcomponents` | PUT | **Write component changes** |
| `environments/{eid}/bots/{bid}/publishv2-operations` | GET | Publish status tracking |
| `environments/{eid}/bots/{bid}/dlpstatus` | GET | DLP violation status |
| `environments/{eid}/bots/{bid}/dlpstatus/channels` | GET | DLP per channel |
| `environments/{eid}/dlp/blockedConnectors` | POST | Check blocked connectors |
| `environments/{eid}/notifications` | GET | Environment notifications |
| `environments/{eid}/custom-templates/manifests` | GET | Agent template catalog |
| `userlicenseinfo/entitlements` | GET | License entitlements |
| `userlicenseinfo/viralsku` | GET | Trial/viral SKU status |
| `usersettings/defaultbot` | PUT | Set default bot for user |
| `analytics/bots/{bid}/protection/summary` | GET | Security analytics |
| `email/sendwelcomemessage` | POST | Welcome email |
| `nps/renderUrl` | GET | NPS survey URL |

### Chat Bot Management (Legacy Path)

Base: `/chatbotmanagement/tenants/{tid}/environments/{eid}/api/`

| Endpoint | Method | Purpose | **Key?** |
|----------|--------|---------|----------|
| `featureSettings/clientSettings` | GET | Feature flags | Yes |
| `featureSettings/modelSettings/v2` | GET | **Available models catalog** | **Critical** |

### Bot Authoring (v1)

Base: `/api/botauthoring/v1/`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `environments/{eid}/bots/{bid}/content/flows` | POST | Power Automate flow sync (delta) |

---

## Component CRUD Contract

The core read/write pattern for ALL bot components (topics, instructions, model, tools):

### Read (Initial Sync)

```
POST /api/botmanagement/v1/environments/{envId}/bots/{botId}/content/botcomponents
Body: {}
```

### Read (Delta Sync)

```
POST /api/botmanagement/v1/environments/{envId}/bots/{botId}/content/botcomponents
Body: { "componentDeltaToken": "<base64 token from previous read>" }
```

### Write (Update Components)

```
PUT /api/botmanagement/v1/environments/{envId}/bots/{botId}/content/botcomponents
Body: {
  "botComponentChanges": [
    { "$kind": "BotComponentUpdate", "component": { ... } }
  ],
  "cloudFlowDefinitionChanges": [],
  "connectorDefinitionChanges": [],
  "environmentVariableChanges": [],
  "connectionReferenceChanges": [],
  "aIPluginOperationChanges": [],
  "componentCollectionChanges": [],
  "dataverseTableSearchChanges": [],
  "connectedAgentDefinitionChanges": [],
  "changeToken": "<from previous read>"
}
```

### Response Shape

```json
{
  "botComponentChanges": [
    {
      "$kind": "BotComponentInsert",
      "component": {
        "$kind": "DialogComponent",
        "displayName": "Topic Name",
        "id": "guid",
        "parentBotId": "guid",
        "schemaName": "bot_schema.topic.TopicName",
        "dialog": {
          "$kind": "AdaptiveDialog",
          "beginDialog": { "$kind": "OnUnknownIntent", "actions": [...] }
        }
      }
    }
  ],
  "changeToken": "<new delta token>"
}
```

### Change Types

| `$kind` | Purpose |
|---------|---------|
| `BotComponentInsert` | New component (from read) |
| `BotComponentUpdate` | Modified component (for write) |
| `BotComponentDelete` | Deleted component (for write) |

### Component Types (ObjectModel `$kind`)

| `$kind` | What |
|---------|------|
| `GptComponent` | Agent config — instructions, model, tools, conversation starters |
| `DialogComponent` | Topic — triggers, actions, branching logic |
| `SkillComponent` | Skill/connector attachment |
| `KnowledgeComponent` | Knowledge source |
| `EntityComponent` | Custom entity/variable |

---

## Model Selection via API

Model selection is a GptComponent update. The model is at `metadata.aISettings.model.modelNameHint`.

### Available Model Hints (from modelSettings/v2)

| Display Name | `modelNameHint` | Provider | Status |
|-------------|----------------|----------|--------|
| GPT-4.1 | `GPT41` | OpenAI | Production (Default) |
| GPT-5 Chat | `GPT5Chat` | OpenAI | Production |
| GPT-5 Auto | `GPT5Auto` | OpenAI | Preview |
| GPT-5 Reasoning | `GPT5Reasoning` | OpenAI | Preview |
| Claude Sonnet 4.5 | `sonnet4-5` | Anthropic | Preview |
| Claude Opus 4.5 | `opus4-1` | Anthropic | Experimental |

### Set Model Procedure

1. **POST** `content/botcomponents` with `{}` → read all components
2. Find the `GptComponent` in response
3. Modify `component.metadata.aISettings.model.modelNameHint`
4. **PUT** `content/botcomponents` with the modified component + `changeToken`
5. Response confirms with new `changeToken` + updated `version`

### GptComponent Structure (Key Fields)

```json
{
  "$kind": "GptComponent",
  "version": 2957730,
  "displayName": "Agent Name",
  "id": "guid",
  "parentBotId": "guid",
  "schemaName": "bot_schema.gpt.default",
  "state": "Active",
  "status": "Active",
  "metadata": {
    "$kind": "GptComponentMetadata",
    "displayName": "Agent Name",
    "instructions": "You are a helpful assistant...",
    "tools": [],
    "conversationStarters": [],
    "aISettings": {
      "$kind": "AISettings",
      "model": {
        "$kind": "CurrentModels",
        "modelNameHint": "GPT5Chat"
      }
    }
  }
}
```

---

## Bot Configuration (Dataverse Field)

The `bot.configuration` Dataverse field also contains AI settings:

```json
{
  "$kind": "BotConfiguration",
  "settings": { "GenerativeActionsEnabled": true },
  "isAgentConnectable": true,
  "gPTSettings": {
    "$kind": "GPTSettings",
    "defaultSchemaName": "bot_schema.gpt.default"
  },
  "aISettings": {
    "$kind": "AISettings",
    "useModelKnowledge": true,
    "isFileAnalysisEnabled": true,
    "isSemanticSearchEnabled": true,
    "optInUseLatestModels": false
  },
  "recognizer": { "$kind": "GenerativeRecognizer" }
}
```

---

## What This API Can Replace

| Operation | Before | After | Confidence |
|-----------|--------|-------|------------|
| Model discovery | Playwright dropdown | `GET modelSettings/v2` | Confirmed |
| Model selection | Playwright dropdown | `PUT botcomponents` (GptComponent) | Confirmed |
| Read components | Playwright/Dataverse | `POST botcomponents` | Confirmed |
| Read instructions | Dataverse PATCH | `POST botcomponents` → GptComponent | Confirmed |
| Write instructions | Dataverse PATCH | `PUT botcomponents` (GptComponent) | High (needs test) |
| Bot settings read | Playwright | `GET settings` | Confirmed |
| Publish status | Playwright | `GET publishv2-operations` | Confirmed |
| **Topic update** | Playwright code editor | `PUT botcomponents` (BotComponentUpdate + DialogComponent) | **Confirmed** |
| **Topic create** | Playwright code editor | `PUT botcomponents` (BotComponentInsert + DialogComponent) | **Confirmed** |
| **Topic delete** | Playwright UI | `PUT botcomponents` (BotComponentDelete) | High (contract exists) |

## Topic Save via API — Captured 2026-02-23

### Update Existing Topic (BotComponentUpdate)

**Save sequence:**
1. `GET authorstate` — check who's editing
2. `PUT authorstate/{componentId}` — claim author lock
3. `PUT content/botcomponents` — save with `BotComponentUpdate`

### Create New Topic (BotComponentInsert)

**Single call:** `PUT content/botcomponents` with `BotComponentInsert`
- Use `id: "00000000-0000-0000-0000-000000000000"` — server assigns real ID
- `schemaName` follows pattern: `{botSchema}.topic.{TopicNameNoSpaces}`
- No version, auditInfo, or parentBotId needed
- Server handles NLU trigger registration, compilation, dependency tracking

### YAML → JSON Mapping for Topics

| YAML (code editor) | JSON (API wire format) |
|--------------------|-----------------------|
| `kind: AdaptiveDialog` | `$kind: DialogComponent` wrapper + `dialog.$kind: AdaptiveDialog` |
| `kind: OnRecognizedIntent` | `$kind: OnRecognizedIntent` |
| `triggerQueries: [...]` | `intent.triggerQueries: [...]` (plain string array) |
| `displayName: X` | `$kind: StringExpression` + `literalValue` |
| `kind: SendActivity` + `activity: "text"` | `$kind: SendActivity` + `$kind: Message` > `$kind: TemplateLine` > `$kind: TextSegment` |
| `activity: "Hi {Topic.var}!"` | TextSegment + ExpressionSegment(ValueExpression) + TextSegment interleaved |
| `kind: Question` + `entity: StringPrebuiltEntity` | `$kind: Question` + `entity: {$kind: StringPrebuiltEntity}` |
| `kind: EndDialog` | `$kind: EndDialog` |
| `kind: CancelAllDialogs` | `$kind: CancelAllDialogs` |
| `kind: ConditionGroup` | `$kind: ConditionGroup` |
| `kind: SetVariable` | `$kind: SetVariable` |

## Connector Discovery (Connectivity API)

The Power Platform Connectivity API at `{envId}.environment.api.powerplatform.com` exposes connector metadata, operations, and connections. This is a **separate API surface** from the Island Gateway — uses `https://service.powerapps.com/` as the token resource.

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/connectivity/connectors?$filter=environment+eq+'{envId}'&api-version=2022-03-01-preview&showApisWithTos=true` | GET | List all connectors |
| `/connectivity/connectors/{connectorId}?$filter=environment+eq+'{envId}'&api-version=1` | GET | **Connector metadata + embedded swagger (operations)** |
| `/connectivity/connectors/{connectorId}/connections?$expand=&api-version=1` | GET | **List existing connections** for a connector |
| `/connectivity/aipluginoperations?api-version=1` | POST | AI plugin operations catalog |
| `/connectivity/discoveraiplugins?api-version=2022-03-01-preview&$expand=swagger&IsDraft=1` | POST | Discover AI plugin definitions |

### CLI

```bash
# List operations (actions/triggers) for a connector
node tools/add-tool.js list-operations --env <envId> --connector shared_todo

# List existing connections for a connector
node tools/add-tool.js list-connections --env <envId> --connector shared_todo
```

### Authentication

**Token resource:** `https://service.powerapps.com/` (different from Island Gateway's PVA app ID `96ff4394-9197-43aa-b393-6a41652e21f8`)

```bash
az account get-access-token --resource https://service.powerapps.com/ --query accessToken -o tsv
```

---

## What Requires User-Guided Manual Steps (No Playwright — removed Mar 2026)

| Operation | Status | Headless Alternative |
|-----------|--------|---------------------|
| Agent creation | **SOLVED** | Dataverse POST + PvaProvision |
| Tool/connector attachment | **SOLVED** | `discover-connections` → YAML → LSP push |
| MCP server addition | **SOLVED** | Same as tool attachment — discover `shared_a365mcpservers` connection ref |
| Connected agent setup | **SOLVED** | Island Gateway `connectedAgentDefinitionChanges` |
| Power Automate flow attach | **Partial** | Agent flows need MCS flow designer; cloud flows via `flow-manager.js` |
| **OAuth connection (first-time)** | **Manual** | No API — interactive auth popup required once per connector per environment |
| Native eval upload | **SOLVED** | Dataverse POST componenttype=19 |
| Knowledge file upload | **Partial** | Component created via Dataverse; file attachment endpoint not found — user uploads in MCS |

## Tool Addition API Flow — Captured 2026-02-23

Adding a connector action (e.g., "Microsoft To-Do List to-do's by folder V2") uses 4 API surfaces in sequence:

### Step 1: Search Connector Catalog

**Connector list:**
```
GET https://{envId}.environment.api.powerplatform.com/connectivity/connectors?$filter=environment+eq+'{envId}'&api-version=2022-03-01-preview&showApisWithTos=true
```

**AI-powered action search (natural language):**
```
POST https://powervamg.{region}.gateway.prod.island.powerapps.com/api/botmanagement/v1/environments/{envId}/nl2action
```

**Plugin operations catalog:**
```
POST https://{envId}.environment.api.powerplatform.com/connectivity/aipluginoperations?api-version=1
```

### Step 2: Get Connector Details + Connection

**Connector metadata (including operations/actions):**
```
GET https://{envId}.environment.api.powerplatform.com/connectivity/connectors/{connectorId}?$filter=environment+eq+'{envId}'&api-version=1
```

**List existing connections:**
```
GET https://{envId}.environment.api.powerplatform.com/connectivity/connectors/{connectorId}/connections?$expand=&api-version=1
```

**Connection reference lookup (Dataverse):**
```
GET https://{org}.crm.dynamics.com/api/data/v9.2/connectionreferences?$filter=connectionreferencelogicalname+eq+'{refLogicalName}'
```

### Step 3: Create Bot Component (the actual "add" call)

```
POST https://{envId}.environment.api.powerplatform.com/powervirtualagents/bots/{botId}/api/botcomponents?api-version=2022-03-01-preview
```
This is the **key API** — creates the SkillComponent in Dataverse.

### Step 4: Sync to Island (component write)

```
PUT https://powervamg.{region}.gateway.prod.island.powerapps.com/api/botmanagement/v1/environments/{envId}/bots/{botId}/content/botcomponents
```
Standard Island API write — same as LSP push uses internally.

### Step 5: Discover Plugin Definition

```
POST https://{envId}.environment.api.powerplatform.com/connectivity/discoveraiplugins?api-version=2022-03-01-preview&$expand=swagger&IsDraft=1
```

### Implication for Headless Tool Addition

To add a tool programmatically (without Playwright), you need:
1. The `connectorId` (e.g., `shared_todo`) — from the connector catalog
2. The `operationId` (e.g., `ListToDosByFolderV2`) — from connector metadata
3. An existing `connectionId` — from the connections list (OAuth must already be done)
4. Call `/powervirtualagents/bots/{botId}/api/botcomponents` to create the component
5. Call Island API `PUT content/botcomponents` to sync (or use LSP push)

**What still needs Playwright:** Creating OAuth connections (Step 2 requires browser auth popup). But if a connection already exists for that connector type, it can be reused headlessly.

### Confirmed: Headless Tool Addition via LSP Push (Tested 2026-02-23)

**Full flow tested and verified in MCS UI:**
1. Clone workspace: `node tools/mcs-lsp.js clone --workspace ...`
2. Generate action YAML: `node tools/add-tool.js add --workspace ... --connector shared_planner --action CreateTask_V3 --connection <ref> --name "Create a task"`
3. Push to MCS: `node tools/mcs-lsp.js push --workspace ...`
4. Verified: "Create a task" appeared in MCS Tools tab as Connector type, enabled, 32 seconds ago
5. Revert: deleted action file, pushed again — tool removed from MCS

**Key requirement:** The VS Code Copilot Studio extension must be activated in the current VS Code session before calling the LSP. If clone returns 400, open VS Code and click on the extension icon first.

**Naming:** Action filenames must use only alphanumeric + underscore (e.g., `shared_planner_CreateTask_V3.mcs.yml`). The `add-tool.js` CLI handles this automatically.

---

## LSP Wrapper (`tools/mcs-lsp.js`)

For topic authoring and full component sync, prefer the LSP wrapper over raw API calls. It wraps the Copilot Studio VS Code extension's `LanguageServerHost.exe` and handles YAML→JSON conversion automatically via `YamlPassThroughSerializationContext`.

### Why Use the LSP Wrapper

| Approach | YAML→JSON | Auth Handling | Completeness |
|----------|-----------|---------------|-------------|
| Raw Island API (this file) | Manual — must build JSON wire format | Manual headers | Full control, but fragile for topics |
| Playwright Code Editor | Paste YAML, let UI compile | Browser session | Works but slow and fragile |
| **LSP Wrapper** | Automatic — LSP does it | az CLI tokens | Same code path as official extension |

### Commands

```bash
# Clone an agent to a local workspace (headless — no VS Code GUI needed)
node tools/mcs-lsp.js clone --workspace "./workspace" --agent-id "<guid>" --agent-name "Agent Name" \
  --env-id "<envId>" --dataverse-url "https://org.crm.dynamics.com" --gateway-url "https://powervamg.us-il301..."

# Push local .mcs.yml files to MCS
node tools/mcs-lsp.js push --workspace "./workspace/Agent Name"

# Pull remote state to local files
node tools/mcs-lsp.js pull --workspace "./workspace/Agent Name"

# Preview changes without applying
node tools/mcs-lsp.js preview --workspace "./workspace/Agent Name"

# Show workspace/agent info
node tools/mcs-lsp.js info --workspace "./workspace/Agent Name"
```

### Prerequisites

1. Copilot Studio VS Code extension installed (`ms-copilotstudio.vscode-copilotstudio`)
2. `az login` completed for token acquisition

### Confirmed LSP Push Capabilities (Tested 2026-02-23)

All of these were tested via clone → edit YAML → push → verify:

| Operation | File | Confirmed |
|-----------|------|-----------|
| Clone agent (headless) | `cloneAgent` LSP method | Yes |
| Topics (create/update/triggers) | `topics/*.mcs.yml` | Yes |
| Instructions | `agent.mcs.yml` → `instructions:` | Yes |
| Model selection | `agent.mcs.yml` → `aISettings.model.modelNameHint:` | Yes |
| Conversation starters | `agent.mcs.yml` → `conversationStarters:` | Yes |
| Web browsing / code interpreter | `agent.mcs.yml` → `gptCapabilities:` | Yes |
| Content moderation level | `settings.mcs.yml` → `contentModeration:` | Yes |
| File analysis toggle | `settings.mcs.yml` → `isFileAnalysisEnabled:` | Yes |
| Auth mode | `settings.mcs.yml` → `authenticationMode:` | Yes |
| Auth trigger | `settings.mcs.yml` → `authenticationTrigger:` | Yes |

| Connector action edit | `actions/*.mcs.yml` → `modelDescription:` etc. | Yes |
| Connector action delete | Delete `actions/*.mcs.yml` file → push | Yes |
| MCP action edit | `actions/*.mcs.yml` → `modelDisplayName:` etc. | Yes |
| Pull (sync remote → local) | `mcs-lsp.js pull` | Yes |
| Sequential pushes | Multiple pushes on same workspace | Yes (LSP updates token) |

**Known limitations:**
- Creating NEW actions via file creation + push fails if filename contains hyphens (schema name validation). Use MCS UI for new action creation; use LSP for editing/deleting existing actions.
- Restore a deleted action requires MCS UI (re-add the connector action).

### When to Use Which Tool

| Operation | Best Tool |
|-----------|-----------|
| Push/pull topics, instructions, full sync | `mcs-lsp.js` |
| Model selection, model catalog | `mcs-lsp.js` (YAML) or `island-client.js` (API) |
| Component reads (quick inspection) | `island-client.js` |
| Routing info, bot settings | `island-client.js` |

---

## ObjectModel Team Source References

The VS Code extension implements this exact API:

| File | Purpose |
|------|---------|
| `IslandControlPlaneService.cs` | The API client — headers, read/write |
| `AgentSyncInfo.cs` | Connection model — `AgentManagementEndpoint` |
| `WorkspaceSynchronizer.cs` | Orchestrates pull/push |
| `SyncPushHandler.cs` | Computes diff, pushes via island API |
| `IContentAuthoringService.cs` | Interface: `GetComponentsAsync`, `SaveChangesAsync` |

They call it: **"Island Control Plane"** / **"Content Authoring Service"**

---

## CLI Usage

```bash
# List available models
node tools/island-client.js get-models --env Default-xxx --tenant xxx

# Read all components
node tools/island-client.js read-components --env Default-xxx --bot fec3b192-xxx

# Change model
node tools/island-client.js set-model --env Default-xxx --bot fec3b192-xxx --model GPT5Chat

# Get instructions
node tools/island-client.js get-instructions --env Default-xxx --bot fec3b192-xxx

# Get routing info
node tools/island-client.js get-routing --env Default-xxx --bot fec3b192-xxx

# Raw JSON output
node tools/island-client.js read-components --env Default-xxx --bot fec3b192-xxx --json
```
