<!-- CACHE METADATA
last_verified: 2026-02-10
sources: [MS Learn, Power Platform connector catalog]
confidence: medium
refresh_trigger: before_architecture
-->
# Power Platform Connectors for MCS

## Connector Types

| Type | License | Examples |
|------|---------|---------|
| Standard | Included with MCS | SharePoint, Outlook, Teams, OneDrive, Dataverse |
| Premium | Premium license required | HTTP, SQL Server, Azure services, Salesforce |
| Custom | Built by org | Custom API connectors (OpenAPI-based) |

## Commonly Used Connectors in MCS Agents

### M365 / Productivity
| Connector | Key Actions | MCP Alternative? |
|-----------|-------------|-----------------|
| SharePoint | Get items, Create item, Get file content | Yes — prefer SharePoint/OneDrive MCP |
| Outlook 365 | Send email, Get events, Search mail | Yes — prefer Outlook Calendar/Mail MCP |
| Microsoft Teams | Post message, Get channels, Create meeting | Yes — prefer Teams MCP |
| OneDrive for Business | Get file, Create file, List folder | Yes — prefer SharePoint/OneDrive MCP |
| Planner | Create task, List tasks, Update task | No MCP — use connector |
| Excel Online | Get rows, Add row, Update row | No MCP — use connector |

### Data & Integration
| Connector | Key Actions | Notes |
|-----------|-------------|-------|
| Dataverse | CRUD operations on tables | MCP available (preview) |
| SQL Server | Execute query, Get rows | Premium |
| HTTP | Send HTTP request (any REST API) | Premium; flexible fallback |
| Azure Blob Storage | Upload/download blobs | Premium |

### Third-Party
| Connector | Key Actions | Notes |
|-----------|-------------|-------|
| Salesforce | CRUD on objects | Premium |
| ServiceNow | Create/update incidents, queries | Premium |
| Jira | Create/update issues | Premium; on-prem needs data gateway |
| Confluence | Create/update pages | Premium; on-prem needs data gateway |
| Adobe PDF Services | Extract text, convert, merge | Premium |
| Encodian | Document generation, conversion | Premium |

### AI & Automation
| Connector | Key Actions | Notes |
|-----------|-------------|-------|
| AI Builder | Prompt actions, extraction | Premium |
| Power Automate | Trigger flows | Standard |
| Azure OpenAI | Custom completions | Premium |

## How to Add a Connector

Requires Playwright (no API alternative for tool attachment):
1. Go to Tools section → "Add tool"
2. Search for connector name
3. Select specific action(s)
4. Create connection (may require auth popup)
5. "Add and configure"

## Refresh Notes

- Full connector catalog: https://learn.microsoft.com/en-us/connectors/connector-reference/
- New connectors appear monthly — search "new Power Platform connectors" for updates
- Check if a connector now has an MCP server (prefer MCP when available)
- On-premises connectors require an on-premises data gateway
