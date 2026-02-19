<!-- CACHE METADATA
last_verified: 2026-02-19
sources: [MS Learn, PAC CLI docs, Dataverse MCP docs, direct testing]
confidence: high
refresh_trigger: on_error
-->
# API Capabilities by Layer — Quick Reference

## Layer Overview

| Layer | Tool | Best For | Cost |
|-------|------|----------|------|
| 1 | Dataverse MCP Server | Record CRUD, schema discovery | Copilot Credits |
| 2 | PAC CLI (MSI + MCP) | Solution ALM, publish, env management | Free |
| 3 | PowerShell Web API | Bound actions, complex queries, unattended | Free |
| 4 | Playwright | UI-only operations | Free |

## Layer 1: Dataverse MCP Server (v0.2.310025)

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

## Layer 4: Playwright (UI Only)

| Operation | Why Playwright |
|-----------|---------------|
| Model selection | Not in API |
| Add tools/connectors | Tool attachment requires MCS sync |
| Add MCP servers | MCP server attachment via UI only |
| Create OAuth connections | Interactive auth flow |
| Connect child agents | MCS orchestration setup |
| Gen AI settings | Internal MCS setting |
| "Allow other agents to connect" | Not in public API |
| Native eval upload/run | MCS eval service |

## Upcoming API Capabilities

| Feature | Timeline | Impact |
|---------|----------|--------|
| Custom MCP servers | Public preview Mar 2026, GA Apr 2026 | Programmatic MCP server creation via MCP Management Server (already in preview) |

## Refresh Notes

When a Playwright-only operation starts failing, check if an API was added. APIs expand over time.
