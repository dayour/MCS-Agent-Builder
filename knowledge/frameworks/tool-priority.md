# Tool Priority Framework

## Priority Order

| Priority | Tool | Use For |
|----------|------|---------|
| 1 | **PAC CLI** | Listing agents, solution ALM |
| 2 | **MCS LSP Wrapper** | Topic push/pull, instructions, model, tools, knowledge, full component sync (`tools/mcs-lsp.js`) |
| 3 | **Island Gateway API** | Model catalog, component reads, routing info, bot settings (`tools/island-client.js`) |
| 4 | **Flow Manager** | Power Automate cloud flow CRUD — trigger creation, schedule/message updates, activate/deactivate (`tools/flow-manager.js`) |
| 5 | **Dataverse API** | File uploads (PDF/DOCX), bot name PATCH, PvaPublish, security, deletion |
| 6 | **Direct Line API** | Evaluation / testing (send messages, compare responses) |
| 7 | **Playwright MCP** | Agent creation, new OAuth connections, child agent connection |

## Decision Flow

```
For each build step, ask:
  Can PAC CLI do this?           → YES → Use PAC CLI
  Can LSP Wrapper do this?       → YES → Use mcs-lsp.js (topics, instructions, model, tools, knowledge, settings)
  Can Island Gateway API do it?  → YES → Use island-client.js (model catalog, reads, routing)
  Is this a PA flow/trigger op?  → YES → Use flow-manager.js (create, update, activate, discover)
  Can Dataverse API do this?     → YES → Use Dataverse API (security, deletion, file uploads)
  Is this testing/eval?          → YES → Use Direct Line API
  None of the above?             → Use Playwright (agent creation, new OAuth, child agents)
```

## Detailed Capability Matrix

See `knowledge/cache/api-capabilities.md` for the full breakdown of what each layer can do.

## Key Principle

**Every Playwright interaction is a fragility risk.** Before using the browser, always check `knowledge/cache/api-capabilities.md` to see if a non-browser alternative exists. APIs are added over time — what required Playwright last month may have an API now.

## Build Phase → Tool Mapping

| Build Phase | Primary Tool | Fallback |
|-------------|-------------|----------|
| Create agent | Playwright (MCS UI) | PAC CLI (`pac copilot create` — requires template) |
| Clone workspace | LSP Wrapper (`mcs-lsp.js clone`) | VS Code extension GUI |
| Set instructions | LSP Wrapper (`agent.mcs.yml` → push) | Island Gateway API / Dataverse PATCH |
| Select model | LSP Wrapper (`agent.mcs.yml` → push) | Island Gateway API |
| Set capabilities | LSP Wrapper (`agent.mcs.yml` gptCapabilities → push) | Playwright |
| Set conversation starters | LSP Wrapper (`agent.mcs.yml` → push) | Playwright |
| Set auth mode | LSP Wrapper (`settings.mcs.yml` → push) | Playwright |
| Set agent settings | LSP Wrapper (`settings.mcs.yml` → push) | Playwright |
| Upload knowledge (sites/URLs) | LSP push (`knowledge/*.mcs.yml`) | Playwright |
| Upload knowledge (PDF/DOCX) | Dataverse API (file upload) | Playwright |
| Read components | Island Gateway API (POST botcomponents) | Dataverse queries |
| Add tools/connectors | `add-tool.js` + LSP push (if connection exists) | Playwright (for new OAuth connections) |
| Create connections | Playwright (OAuth browser flow) | — |
| Author topics (new) | LSP Wrapper (`topics/*.mcs.yml` → push) | Island Gateway API / Playwright |
| Author topics (update) | LSP Wrapper (`topics/*.mcs.yml` → push) | Island Gateway API / Playwright |
| Publish | Dataverse PvaPublish (bound action) | PAC CLI (`pac copilot publish`) / Playwright |
| Test | Direct Line API | Playwright test chat |
| Connect child agents | Playwright (no API) | — |
| Enable sharing | Playwright (no API) | — |
