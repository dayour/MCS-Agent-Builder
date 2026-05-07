# MCS Agent Creation API Sequence — HAR Analysis 2026-04-15

> Captured by clicking through MCS UI to create and configure an agent in dktest environment.
> Bot created: dde31320-3039-f111-88b4-7c1e528d32a4

## Key Discovery: Bot Creation Body

MCS creates agents via `POST /api/data/v9.2/bots?$select=botid` with a **rich configuration JSON** that includes the GptComponent seed inline:

```json
{
  "configuration": {
    "categories": [],
    "channels": [],
    "settings": {
      "GenerativeActionsEnabled": true,
      "default-2.1.0": {
        "spec": { "connectors": [] },
        "content": {
          "displayName": "Agent",
          "description": "",
          "instructions": "",
          "conversationStarters": [],
          "capabilities": {
            "diagnostics": [],
            "webBrowsing": true,
            "$kind": "GptCapabilities"
          }
        }
      }
    },
    "diagnostics": [],
    "$kind": "BotConfiguration",
    "isAgentConnectable": true,
    "aISettings": {
      "diagnostics": [],
      "$kind": "AISettings",
      "useModelKnowledge": true,
      "isSemanticSearchEnabled": true,
      "isFileAnalysisEnabled": true,
      "optInUseLatestModels": false
    }
  },
  "name": "Agent",
  "iconbase64": "<base64 PNG>"
}
```

**Critical insight**: The `settings.default-2.1.0.content` block IS the GptComponent seed. MCS embeds instructions, description, conversationStarters, and capabilities directly in the bot.configuration JSON at creation time. This is why our Dataverse POST (which only sent name + empty configuration) resulted in no GptComponent.

## Post-Creation API Sequence

After bot creation (POST /bots → 201), MCS calls:

1. `POST /powervirtualagents/bots/{id}/api/botcomponents?api-version=2022-03-01-preview` with `{"Kind": ["BotEntity"]}` — reads bot entity components
2. `POST /api/botmanagement/v1/environments/{envId}/bots/{botId}/content/botcomponents` with `{"componentDeltaToken": null}` — initial component sync (reads all)
3. Repeated `POST content/botcomponents` with `componentDeltaToken` — delta syncs as user edits
4. `PUT /api/botmanagement/v1/environments/{envId}/bots/{botId}/content/botcomponents` — writes component changes

## Two API Surfaces

| API | Base URL | Purpose | Auth |
|-----|----------|---------|------|
| **PVA Direct** | `/powervirtualagents/bots/{id}/api/botcomponents` | Read bot entity, trigger component materialization | PVA token |
| **Island Gateway** | `/api/botmanagement/v1/environments/{envId}/bots/{botId}/content/botcomponents` | Read/write components, delta sync | PVA token + Island headers |

## PUT (Write) Operations Found

- `PUT /api/botmanagement/v1/environments/{envId}/bots/{botId}/content/botcomponents` (x18) — component updates
- `POST /api/botauthoring/v1/environments/{envId}/bots/{botId}/content/flows` (x9) — flow creation
- `POST /api/botmanagement/v1/environments/{envId}/nl2action` (x2) — NL-to-action conversion
- `POST /api/botmanagement/v2/triggers` — trigger registration

## API Domains

| Domain | Calls | Purpose |
|--------|-------|---------|
| org04723bf3.crm.dynamics.com | 454 | Dataverse (bot entity CRUD, component queries) |
| powervamg.us-il301.gateway.prod.island.powerapps.com | 278 | Island Gateway (component sync, settings, DLP) |
| copilotstudio.preview.microsoft.com | 37 | MCS frontend (PVA direct API, feature settings) |

## Fix for Our Pipeline

Our `POST /bots` was missing the critical `settings.default-2.1.0.content` block in configuration. This caused MCS to never materialize the GptComponent. The fix:

1. Include the full `BotConfiguration` JSON with `default-2.1.0.content` containing displayName, description, instructions, conversationStarters
2. After creation, call `POST /powervirtualagents/bots/{id}/api/botcomponents` with `{"Kind": ["BotEntity"]}` to trigger component materialization
3. Then use Island Gateway `PUT content/botcomponents` for updates

No PvaProvision needed — the rich configuration + PVA BotEntity call handles it.

Last updated: 2026-04-15
