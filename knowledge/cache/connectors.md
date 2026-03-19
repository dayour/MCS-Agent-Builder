<!-- CACHE METADATA
last_verified: 2026-03-19
sources: [MS Learn, Power Platform connector catalog, MS Learn Salesforce connector reference, MS Learn Bing Search connector reference, MS Learn ServiceNow connector reference, MS Learn Zoom Meetings connector reference, WebSearch, 2026 Wave 1 release plan, 2025 Wave 2 release plan]
confidence: high
refresh_trigger: before_architecture
-->
# Power Platform Connectors for MCS

## Connector Types

| Type | License | Examples |
|------|---------|---------|
| Standard | Included with MCS | SharePoint, Outlook, Teams, OneDrive, Dataverse |
| Premium | Premium license required | HTTP, SQL Server, Azure services, Salesforce |
| Custom | Built by org | Custom API connectors (OpenAPI-based) |

## Key Changes (Mar 2026 Refresh)

- **OpenAPI v3 support**: Preview Feb 2026, GA May 2026. Import OpenAPI v3 specs directly -- no more downgrading to v2. Source: https://learn.microsoft.com/en-us/power-platform/release-plan/2025wave2/microsoft-copilot-studio/build-power-platform-connectors-openapi-v3
- **Enhanced connectors (Connector SDK + PowerFx)**: Preview May 2025, GA May 2026. Build structured data connectors that work as agent knowledge sources. Source: https://learn.microsoft.com/en-us/power-platform/release-plan/2026wave1/microsoft-copilot-studio/build-enhanced-connectors-power-platform-connector-sdk-powerfx
- **SSO for connectors in agents**: GA Jul 2025. Use single sign-on for connector authentication.
- **Connector catalog**: 1,500+ connectors (up from 1,400+).
- **MCP servers growing rapidly**: 40+ MCP servers now in catalog -- always check if a connector has an MCP server alternative (prefer MCP).

## Commonly Used Connectors in MCS Agents

### M365 / Productivity
| Connector | Key Actions | MCP Alternative? |
|-----------|-------------|-----------------|
| SharePoint | Get items, Create item, Get file content | Yes -- prefer Work IQ SharePoint MCP (or SharePoint/OneDrive MCP) |
| Outlook 365 | Send email, Get events, Search mail | Yes -- prefer Work IQ Mail / Work IQ Calendar MCP |
| Microsoft Teams | Post message, Get channels, Create meeting | Yes -- prefer Work IQ Teams MCP |
| OneDrive for Business | Get file, Create file, List folder | Yes -- prefer Work IQ OneDrive MCP (now separate from SharePoint) |
| Planner | Create task, List tasks, Update task | No MCP -- use connector |
| Excel Online | Get rows, Add row, Update row | No MCP -- use connector |

### Data & Integration
| Connector | Key Actions | Notes |
|-----------|-------------|-------|
| Dataverse | CRUD operations on tables | MCP available (GA) -- prefer Dataverse MCP |
| SQL Server | Execute query, Get rows | Premium |
| HTTP | Send HTTP request (any REST API) | Premium; flexible fallback |
| Azure Blob Storage | Upload/download blobs | Premium |

### Third-Party
| Connector | Key Actions | Notes |
|-----------|-------------|-------|
| Salesforce | Get Account/Contact/Opportunity/Lead/Case/Product/User records, Execute SOQL query, Execute SOSL search, Create/Update/Delete/Upsert record, Send HTTP request, Bulk job operations, **MCP server action** (`mcp_SalesforceManagement`) | Premium. OAuth 2.0 (Salesforce login). API v58.0. Rate limit: 900 calls/60s/connection. Also a supported **Real-Time Knowledge** source (preview). |
| ServiceNow | **18 actions**: Create Record, Delete Record, Get Record, List Records, Update Record, Get Record Types, Get Knowledge Articles, Get/Delete/Retrieve Attachment (metadata+content), Upload Attachment (binary+multipart), Get Catalogs, Get Catalog Categories, Get Catalog Item(s), Order Item. `List Records` supports `sysparm_query` (ServiceNow encoded query syntax for filtering by priority, severity, state, assignment_group, etc.), `sysparm_limit`, `sysparm_offset`, `sysparm_fields`. Auth: Basic, OAuth2, Entra ID (Certificate or User Login). Rate limit: 600 calls/60s. Publisher: **Microsoft** (GA). Also a supported **Real-Time Knowledge** source (preview). | Premium |
| Zoom Meetings (Independent Publisher) | **3 actions only**: Create Meeting, Get Meetings (list upcoming), Meeting Details (by ID). No recordings, no transcripts, no participants, no past meetings. Auth: OAuth 2.0 (Zoom). Rate limit: 100 calls/60s. Publisher: Akuthota Deekshith (community). **Preview** status. | Premium |
| Jira | Create/update issues | Premium; on-prem needs data gateway |
| Confluence | Create/update pages | Premium; on-prem needs data gateway; also Real-Time Knowledge (preview, Cloud only) |
| Adobe PDF Services | Extract text, convert, merge | Premium |
| Encodian | Document generation, conversion | Premium |
| Zendesk | Ticket management, search | Premium; also Real-Time Knowledge (preview) |
| Snowflake | Query data | Premium; also Real-Time Knowledge (preview) |
| Oracle Database | Query/CRUD | Premium; also Real-Time Knowledge (preview) |
| SAP OData | Read/write SAP data | Premium; also Real-Time Knowledge (preview) |

### Connector-Embedded MCP Servers (Feb 2026 discovery)

Some Power Platform connectors now include MCP server actions as operations. These are NOT separate MCS catalog MCP servers -- they are accessed as connector actions.

| Connector | MCP Operation ID | Description |
|-----------|-----------------|-------------|
| Salesforce | `mcp_SalesforceManagement` | MCP server for Salesforce management. JSON-RPC interface. Accessed as a connector action, not through Add Tool > MCP. |

Note: More connectors may have embedded MCP server actions. Check the connector reference page for `mcp_` operation IDs.

### Search & News
| Connector | Key Actions | Notes |
|-----------|-------------|-------|
| Bing Search | `GetNews` (list news by query), `TrigNewNews` (trigger on new article) | **Preview**. Standard tier (no premium needed). API key auth (Bing API key). Returns: name, URL, description, datePublished, category. 1,200 calls/min. Trigger poll: 1/900s. Market and safe search filters supported. Available in Copilot Studio, Power Automate, Power Apps, Logic Apps. Source: https://learn.microsoft.com/en-us/connectors/bingsearch/ |

### AI & Automation
| Connector | Key Actions | Notes |
|-----------|-------------|-------|
| AI Builder | Prompt actions, document processing, contract processing (preview) | Premium. Copilot Credits required (AI Builder credits removed Nov 2026). |
| Power Automate | Trigger flows | Standard |
| Azure OpenAI | Custom completions | Premium |

### New / Notable Connectors (Mar 2026)

| Connector | Key Actions | Notes |
|-----------|-------------|-------|
| monday.com | Work management -- boards, items, updates | Premium. Also has MCP server in catalog (Preview). |
| Zapier | Connect to 7,000+ apps via Zapier automation | Premium. Also has MCP server in catalog (Preview). |
| Databricks | Query and manage Databricks workspaces | Premium. Also has MCP server in catalog. |
| CData Connect AI | Connect to 200+ data sources via CData | Premium. MCP server in catalog (Preview). |
| Celonis | Process mining and execution management | Premium. MCP server in catalog (Preview). |

## Connector Capabilities for Knowledge (Enhanced Connectors)

**New (2025 Wave 1, GA May 2026):** Enhanced connectors built with the Power Platform Connector SDK can serve as knowledge sources in Copilot Studio agents. This bridges the gap between connectors and knowledge:

- Build a Web API that provides structured data
- Register as a connector in any Power Platform environment
- Automatically available as a knowledge source in agents
- Uses Power Fx for app builders

Source: https://learn.microsoft.com/en-us/power-platform/release-plan/2026wave1/microsoft-copilot-studio/build-enhanced-connectors-power-platform-connector-sdk-powerfx

## How to Add a Connector / MCP Server

**Headless (preferred):** Discover existing connection references -> write YAML -> LSP push.

```bash
# 1. Discover existing connection references in the environment
node tools/add-tool.js discover-connections --dataverse-url <dvUrl> --connector <name>

# 2. Write action YAML referencing the discovered connectionReference logicalName
# (add-tool.js add or manual YAML in workspace/actions/)

# 3. Push via LSP
node tools/mcs-lsp.js push --workspace <path>
```

**If no connection reference exists** (first time for this connector type in this environment):
1. User adds the tool to ANY agent via MCS UI (2-minute wizard -- one-time OAuth consent)
2. This creates the connection reference in Dataverse
3. All subsequent agents in the environment reuse it headlessly via discover-connections

**Note:** The Power Platform Connectivity API (`{envId}.environment.api.powerplatform.com`) does not resolve on some tenants. The `discover-connections` command bypasses it by querying Dataverse directly.

## GCC Limits

- Connector payload limit: **450 KB** (vs 5 MB in public cloud)

## Refresh Notes

- Full connector catalog: https://learn.microsoft.com/en-us/connectors/connector-reference/
- New connectors appear monthly -- search "new Power Platform connectors" for updates
- Check if a connector now has an MCP server (prefer MCP when available)
- On-premises connectors require an on-premises data gateway
- OpenAPI v3 support in preview (Feb 2026) -- eliminates need to downgrade specs
- Enhanced connectors (Connector SDK) allow structured data connectors to serve as knowledge sources
- Watch for more connectors adding embedded MCP server actions (`mcp_` operations)
- Component collections now support connector types including MCP
