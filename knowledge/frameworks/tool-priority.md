# Tool Priority Framework

## Priority Order

| Priority | Tool | Use For |
|----------|------|---------|
| 1 | **PAC CLI** | Listing agents, solution ALM |
| 2 | **MCS LSP Wrapper** | Topic push/pull, instructions, model, tools, knowledge, full component sync (`tools/mcs-lsp.js`) |
| 3 | **Island Gateway API** | Model catalog, component reads, routing info, bot settings (`tools/island-client.js`) |
| 4 | **Flow Manager** | Power Automate cloud flow CRUD + composition — create-flow, compose, validate, discover-operations, trigger creation, schedule/message updates, activate/deactivate (`tools/flow-manager.js` + `tools/lib/flow-composer.js` + `knowledge/patterns/flow-patterns/`) |
| 5 | **Dataverse API** | File uploads (PDF/DOCX), bot name PATCH, PvaPublish, security, deletion |
| 6 | **Direct Line API** | Evaluation / testing (send messages, compare responses) |

## Decision Flow

```
For each build step, ask:
  Can PAC CLI do this?           → YES → Use PAC CLI
  Can LSP Wrapper do this?       → YES → Use mcs-lsp.js (topics, instructions, model, tools, knowledge, settings)
  Can Island Gateway API do it?  → YES → Use island-client.js (model catalog, reads, routing)
  Is this a PA flow/trigger op?  → YES → Use flow-manager.js (compose, create-flow, validate, discover-operations, create-trigger, update, activate)
  Can Dataverse API do this?     → YES → Use Dataverse API (security, deletion, file uploads)
  Is this testing/eval?          → YES → Use Direct Line API
  None of the above?             → User-guided manual step (new OAuth connections only)
```

## Detailed Capability Matrix

See `knowledge/cache/api-capabilities.md` for the full breakdown of what each layer can do.

## Key Principle

**All operations are API-native.** The only user-guided manual step is first-time OAuth consent for new connector types. Check `knowledge/cache/api-capabilities.md` for the full capability matrix.

## Build Phase → Tool Mapping

| Build Phase | Primary Tool | Fallback |
|-------------|-------------|----------|
| Create agent | Dataverse POST + PvaProvision | PAC CLI (`pac copilot create` — requires template) |
| Clone workspace | LSP Wrapper (`mcs-lsp.js clone`) | VS Code extension GUI |
| Set instructions | LSP Wrapper (`agent.mcs.yml` → push) | Island Gateway API / Dataverse PATCH |
| Select model | LSP Wrapper (`agent.mcs.yml` → push) | Island Gateway API |
| Set capabilities | LSP Wrapper (`agent.mcs.yml` gptCapabilities → push) | Island Gateway API |
| Set conversation starters | LSP Wrapper (`agent.mcs.yml` → push) | Island Gateway API |
| Set auth mode | LSP Wrapper (`settings.mcs.yml` → push) | Dataverse API |
| Set agent settings | LSP Wrapper (`settings.mcs.yml` → push) | Dataverse API |
| Upload knowledge (sites/URLs) | LSP push (`knowledge/*.mcs.yml`) | Dataverse API |
| Upload knowledge (PDF/DOCX) | Dataverse API (file upload) | User-guided (MCS Knowledge tab) |
| Read components | Island Gateway API (POST botcomponents) | Dataverse queries |
| Add tools/connectors | `add-tool.js` + LSP push (if connection exists) | User-guided (for new OAuth connections) |
| Create connections | User-guided (OAuth browser flow) | API for non-OAuth (API key, service principal) |
| Author topics (new) | LSP Wrapper (`topics/*.mcs.yml` → push) | Island Gateway API |
| Author topics (update) | LSP Wrapper (`topics/*.mcs.yml` → push) | Island Gateway API |
| Publish | Dataverse PvaPublish (bound action) | PAC CLI (`pac copilot publish`) |
| Test | Direct Line API | Manual (MCS Test Chat) |
| Connect child agents | Island Gateway API (`connectedAgentDefinitionChanges`) | Dataverse PATCH |
| Enable sharing | Dataverse PATCH (`bot.configuration.isAgentConnectable`) | — |
