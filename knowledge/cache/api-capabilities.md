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

| Operation | Why Playwright |
|-----------|---------------|
| Agent creation | Full wizard flow, no complete API |
| Create NEW OAuth connections | Interactive browser auth flow |
| Connect child agents | MCS orchestration setup |
| "Allow other agents to connect" | Not in public API |
| Native eval upload/run | MCS eval service |

> **Note:** Most operations have moved to LSP Wrapper or Island Gateway API. Model selection, instructions, topics, knowledge sources, tool editing, settings — all use LSP push now. Playwright is only needed for agent creation, new OAuth connections, and child agent connection.

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
