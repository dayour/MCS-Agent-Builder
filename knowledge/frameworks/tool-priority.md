# Tool Priority Framework

## Priority Order

| Priority | Tool | Use For |
|----------|------|---------|
| 1 | **PAC CLI** | Publishing, solution ALM, listing agents |
| 2 | **Island Gateway API** | Model selection, component read/write, instructions, settings |
| 3 | **Dataverse API** | Knowledge upload, security settings, agent deletion |
| 4 | **Code Editor YAML** | Topic authoring, adaptive cards, branching logic, trigger phrases |
| 5 | **Direct Line API** | Evaluation / testing (send messages, compare responses) |
| 6 | **Playwright MCP** | Agent creation, tool/connector addition, OAuth connections, child agent connection |

## Decision Flow

```
For each build step, ask:
  Can PAC CLI do this?           → YES → Use PAC CLI
  Can Island Gateway API do it?  → YES → Use Island Gateway (tools/island-client.js)
  Can Dataverse API do this?     → YES → Use Dataverse API
  Is this topic/card work?       → YES → Use Code Editor YAML
  Is this testing/eval?          → YES → Use Direct Line API
  None of the above?             → Use Playwright (with silent browser verification)
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
| Upload knowledge | Dataverse API (POST botcomponent type 16) | Playwright |
| Read components | Island Gateway API (POST botcomponents) | Dataverse queries |
| Add tools/connectors | Playwright (no API) | — |
| Create connections | Playwright (no API) | — |
| Author topics (new) | LSP Wrapper (`topics/*.mcs.yml` → push) | Island Gateway API / Playwright |
| Author topics (update) | LSP Wrapper (`topics/*.mcs.yml` → push) | Island Gateway API / Playwright |
| Publish | PAC CLI (`pac copilot publish`) | Playwright / Dataverse PvaPublish |
| Test | Direct Line API | Playwright test chat |
| Connect child agents | Playwright (no API) | — |
| Enable sharing | Playwright (no API) | — |
