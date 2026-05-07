<!-- CACHE METADATA
last_verified: 2026-04-27
sources: [MS Learn, Power Platform connector catalog, MS Learn Salesforce connector reference (deep-dive 2026-03-26), MS Learn Bing Search connector reference, MS Learn ServiceNow connector reference, MS Learn Zoom Meetings connector reference, WebSearch Apr 2026, 2026 Wave 1 release plan + change history (fetched 2026-04-22), 2025 Wave 2 release plan, Copilot Studio What's New [last-mod 2026-04-23], Power Platform deprecations page (fetched 2026-04-22), M365 Copilot Federated connectors overview (fetched 2026-04-22), Power Apps MCP Server docs (fetched 2026-04-22), MS Learn real-time knowledge connectors, MS Learn add-tools-custom-agent, MS Learn connector-request-failure, MS Learn knowledge sources summary, Salesforce REST API docs, MCS Cat Blog MCP-vs-connectors, GPTfy integration comparison]
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

## Key Changes (Apr 2026 Refresh)

- **OpenAPI v3 support**: **REMOVED from 2026 Wave 1 release plan on 2026-04-10** — moved to a future release wave. Previously planned as Preview Feb 2026 / GA May 2026. Continue using OpenAPI v2 for connector definitions until further notice. Source: https://learn.microsoft.com/power-platform/release-plan/2026wave1/change-history#microsoft-copilot-studio
- **Enhanced connectors (Connector SDK + PowerFx)**: Preview May 2025, GA May 2026. Build structured data connectors that work as agent knowledge sources. Source: https://learn.microsoft.com/en-us/power-platform/release-plan/2026wave1/microsoft-copilot-studio/build-enhanced-connectors-power-platform-connector-sdk-powerfx
- **SSO for connectors in agents**: GA Jul 2025. Use single sign-on for connector authentication. SSO Consent Card (Preview Jul 2025) streamlines Entra ID auth in chat.
- **Connector catalog**: 1,500+ connectors (up from 1,400+).
- **MCP servers growing rapidly**: 45+ MCP servers now (36 catalog + 9 Work IQ) -- always check if a connector has an MCP server alternative (prefer MCP).
- **Managed Identity for custom connectors** (Preview, Mar 2026): Custom connectors can now use managed identity authentication instead of client secrets. Federated identity trust obtains tokens from Entra ID. No secret rotation needed. Currently single-tenant only. Source: https://ashiqf.com/2026/03/10/access-apis-in-power-platform-without-secrets-using-managed-identity-in-custom-connectors/
- **Tool groups** (Preview, Nov 2025): Curated action groups for Outlook and SharePoint connectors. Add entire toolsets in one step. Source: https://learn.microsoft.com/en-us/microsoft-copilot-studio/whats-new
- **Improved ticket-based connector responses** (Feb 2026): Agents more accurately retrieve ServiceNow tickets and Azure DevOps work items and generate clear, actionable summaries.
- **Copilot connectors expansion**: 35 new M365 Copilot connectors GA (distinct from Power Platform connectors). These are Microsoft Graph connectors that index data into Microsoft 365 for Copilot grounding. 100+ Copilot connectors total. Source: https://techcommunity.microsoft.com/blog/microsoft365copilotblog/fueling-new-experiences-in-microsoft-365-copilot-with-expanded-copilot-connector/4493246
- **QuickBooks Online connector deprecated** (Mar 2026): Being retired, no longer supported.
- **Impala connector deprecated** (Apr 2026): Being retired and removed Apr 1-14, 2026. Existing connections will stop working.
- **Copilot connectors vs Power Platform connectors**: New docs page clarifying the distinction. Copilot connectors = index into Graph (search/knowledge). PP connectors = live API bridges (actions/real-time knowledge). Source: https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-graph-vs-power-platform-connectors
- **Federated Copilot connectors GA (Apr 2026)**: MCP-based real-time connectors for M365 Copilot. No data storage/indexing -- real-time access via user identity. **9 Microsoft-published connectors** (updated list as of 2026-04-21): Canva, Google Calendar, Google Contacts, HubSpot, Intercom, Linear, **LSEG**, **Moody's**, Notion. **S&P Global removed** from list. Supported in M365 Copilot Chat, Copilot in Excel, Researcher agent. 7-day admin review window before each new connector is available to users. Read-only, audited in Microsoft Purview. **Note:** These are M365 Copilot connectors, NOT Power Platform connectors -- they don't appear in the PP connector catalog. Source: https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/federated-connectors-overview
- **MIP labels across connectors** (Preview, Jul 2025): Microsoft Information Protection sensitivity labels now displayed across connectors, test chat, Teams, and M365 Copilot. Prevents oversharing. Integration with Dataverse and Microsoft Purview.
- **Use MCP-compliant tools in agent workflows** (**Preview May 2026** delayed from Apr 2026, GA Oct 2026): Broader MCP tool integration in agent workflow steps. Source: https://learn.microsoft.com/power-platform/release-plan/2026wave1/microsoft-copilot-studio/use-mcp-compliant-tools-agent-workflows
- **Power Apps activity-based agent feed cutover (May 1, 2026)**: After this date, the model-driven app agent feed will **only render items created via the Power Apps MCP Server**. Agents using the legacy Copilot Studio activity-based agent feed will stop appearing. Migrate to Power Apps MCP Server (tools: `log_for_review`, `request_assistance`, `invoke_data_entry`) before the cutover. Preview, English-only. Source: https://learn.microsoft.com/en-us/power-apps/maker/model-driven-apps/power-apps-mcp-server
- **Express mode for agent-invoked flows** (Preview Nov 2025, GA May 2026): Faster flow execution to minimize timeouts. Source: 2026w1 planned features.
- **Bing Custom Search as agent-level knowledge source** (GA Mar 2026): Ground agent responses in a curated, scoped web index using a Custom Configuration ID. Overrides public website knowledge sources when enabled. Source: https://learn.microsoft.com/microsoft-copilot-studio/knowledge-bing-custom-search
- **SharePoint lists as knowledge source** (**delayed: Preview May 2026, GA May 2026** per 2026w1 change history 2026-04-15). Add SharePoint lists directly as a knowledge source.
- **Credential oversharing detection** (**delayed: Preview Jul 2026, GA Sep 2026** per 2026w1 change history 2026-04-16). Enforce safe sharing by detecting when maker credentials are overshared with connector tools.
- **Configure triggers with end-user credentials** (Preview Apr 2026, GA Jul 2026): Triggers can now use end-user credentials for connector authentication.
- **Unified errors/warnings/governance view** (**delayed: Preview May 2026** per 2026w1 change history 2026-04-16, GA Jun 2026): Single view for all agent errors, warnings, and governance notifications including connector issues.
- **Snowflake connector deprecated** (May 2025): Old Snowflake connector discontinued. Replace with new Snowflake v2 (Preview) connector. Source: Power Platform deprecations page.
- **Connector tools in topics** (current): Connectors can now be added as tools directly within topics via Add node > Add a tool > Connector, not just at agent level.
- **Custom search tool** (current): New topic-level custom search node for full control over search processing -- filter sensitive info before summarizing. Supports web search toggle and content moderation.
- **OnKnowledgeRequested trigger** (current): YAML-only trigger for building custom knowledge sources with custom search APIs. Supports multi-turn query rewriting via System.SearchQuery and System.KeywordSearchQuery variables.

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
| Salesforce | **25 active actions** (6 deprecated): Get Account/Contact/Case/Opportunity/Product/User records (typed, OData params), Get records (generic, any object), Get record (by ID), Get record by External ID, Execute SOQL query (parameterized @params), Execute SOSL search, Create/Update(V3)/Delete/Upsert record, Send HTTP request, Bulk job ops (Create/Upload/Close/Get/Delete), Get object types, **MCP server action** (`mcp_SalesforceManagement`). OData filter: `eq`,`ne`,`gt`,`ge`,`lt`,`le`,`and`,`or`,`not` -- no `contains`/`startswith`. `$select`/`$top`/`$skip`/`$orderby` supported. Custom fields (`__c`) work in all params. Row limit: 2000 (Salesforce API) but 500KB response limit is usually binding. SOQL supports JOINs, aggregates, GROUP BY, date literals, relationship queries. Full deep-dive: `Build-Guides/CDW/agents/account-prospecting/research/salesforce-connector-deep-dive.md` | Premium. OAuth 2.0 (Salesforce login). API v58.0. Rate limit: 900 calls/60s/connection. Also a supported **Real-Time Knowledge** source (preview). |
| ServiceNow | **18 actions**: Create Record, Delete Record, Get Record, List Records, Update Record, Get Record Types, Get Knowledge Articles, Get/Delete/Retrieve Attachment (metadata+content), Upload Attachment (binary+multipart), Get Catalogs, Get Catalog Categories, Get Catalog Item(s), Order Item. `List Records` supports `sysparm_query` (ServiceNow encoded query syntax for filtering by priority, severity, state, assignment_group, etc.), `sysparm_limit`, `sysparm_offset`, `sysparm_fields`. Auth: Basic, OAuth2, Entra ID (Certificate or User Login). Rate limit: 600 calls/60s. Publisher: **Microsoft** (GA). Also a supported **Real-Time Knowledge** source (preview). | Premium |
| Zoom Meetings (Independent Publisher) | **3 actions only**: Create Meeting, Get Meetings (list upcoming), Meeting Details (by ID). No recordings, no transcripts, no participants, no past meetings. Auth: OAuth 2.0 (Zoom). Rate limit: 100 calls/60s. Publisher: Akuthota Deekshith (community). **Preview** status. | Premium |
| Jira | Create/update issues | Premium; on-prem needs data gateway |
| Confluence | Create/update pages | Premium; on-prem needs data gateway; also Real-Time Knowledge (preview, Cloud only) |
| Adobe PDF Services | Extract text, convert, merge | Premium |
| Encodian | Document generation, conversion | Premium |
| Zendesk | Ticket management, search | Premium; also Real-Time Knowledge (preview) |
| Snowflake v2 (Preview) | Query data | Premium; also Real-Time Knowledge (preview). **Original Snowflake connector deprecated May 2025 -- use v2.** |
| Oracle Database | Query/CRUD | Premium; also Real-Time Knowledge (preview) |
| SAP OData | Read/write SAP data | Premium; also Real-Time Knowledge (preview) |
| Google Sheets | Read/write spreadsheet data | Premium; also Real-Time Knowledge (preview). Source: MS Learn real-time connectors page. |
| Databricks | Query and manage Databricks workspaces | Premium; also Real-Time Knowledge (preview). Also has MCP server in catalog. |

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
| Databricks | Query and manage Databricks workspaces | Premium. Also has MCP server in catalog. Also Real-Time Knowledge (preview). |
| CData Connect AI | Connect to 200+ data sources via CData | Premium. MCP server in catalog (Preview). |
| Celonis | Process mining and execution management | Premium. MCP server in catalog (Preview). |
| Google Sheets | Read/write spreadsheet data | Premium. Now also a Real-Time Knowledge source (preview). |

### Deprecated Connectors (Apr 2026)

| Connector | Status | Notes |
|-----------|--------|-------|
| QuickBooks Online | **Deprecated** | Retired Mar 2026. No longer supported. Migrate to alternative. |
| Impala | **Deprecated** | Retired Apr 1-14, 2026. Existing connections stop working. No new connections allowed. |
| Snowflake (original) | **Deprecated** | Discontinued May 2025. Replace with [Snowflake v2 (Preview)](https://learn.microsoft.com/connectors/snowflakev2/) connector. Existing connections no longer function. |

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
- Copilot connectors vs Power Platform connectors comparison: https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-graph-vs-power-platform-connectors
- New connectors appear monthly -- search "new Power Platform connectors" for updates
- Check if a connector now has an MCP server (prefer MCP when available)
- On-premises connectors require an on-premises data gateway
- OpenAPI v3 support in preview (Feb 2026) -- eliminates need to downgrade specs. Available by default across all environments.
- Enhanced connectors (Connector SDK) allow structured data connectors to serve as knowledge sources
- Watch for more connectors adding embedded MCP server actions (`mcp_` operations)
- Component collections now support connector types including MCP
- Real-Time Knowledge connectors now include 14 supported sources: Salesforce, ServiceNow, AzureSQL, Azure AI Search, SharePoint, Dataverse, Dynamics 365, Snowflake, Databricks, Zendesk, Confluence (Cloud only), Oracle Database, SAP OData, Google Sheets
- Tool groups (Preview) let makers add curated action sets from Outlook/SharePoint in one step
- Managed Identity auth for custom connectors eliminates secret rotation (Preview, single-tenant only)
- QuickBooks Online connector deprecated Mar 2026
- Impala connector deprecated Apr 2026 (retired Apr 1-14)
- Federated Copilot connectors GA Apr/May 2026 -- MCP-based, no data copy, 10 initial connectors. M365 Copilot only (not PP catalog)
- MIP sensitivity labels across connectors (Preview Jul 2025) -- prevents oversharing
- MCP-compliant tools in agent workflows: Preview Apr 2026, GA Oct 2026
- Express mode for agent-invoked flows: Preview Nov 2025, GA May 2026
- Agent evaluations now GA (Mar 2026) -- multi-turn conversation tests added
- Work IQ tools connection (Preview Mar 2026) -- access M365 data from agents
- **Apr 2026 check**: No new Power Platform connector types added. Federated Copilot connectors are M365-only. Impala connector retired. Enhanced connectors and OpenAPI v3 still on track for GA May 2026. Tool groups still Preview. Snowflake v1 connector deprecated (use v2). Bing Custom Search now GA as agent-level knowledge source. SharePoint lists as knowledge source in preview Apr 2026. Credential oversharing detection in preview Apr 2026. MCP-compliant tools in agent workflows in preview Apr 2026. Custom search tool and OnKnowledgeRequested trigger documented for custom knowledge sources.
- **Apr 27 2026 re-check:** whats-new doc Apr 23, 2026 — no new connectors mentioned beyond Mar 2026 list. Federated Copilot connectors list re-confirmed (9 Microsoft-published: Canva, Google Calendar, Google Contacts, HubSpot, Intercom, Linear, LSEG, Moody's, Notion). Improved ticket-based connector responses (Feb 2026) re-confirmed. No new connector deprecations. OpenAPI v3 still removed from 2026 Wave 1 release plan (Apr 10 2026). Power Apps MCP Server agent-feed cutover (May 1, 2026) approaching — agents using legacy Copilot Studio activity-based feed must migrate to Power Apps MCP Server tools (`log_for_review`, `request_assistance`, `invoke_data_entry`) before then.
