<!-- CACHE METADATA
last_verified: 2026-03-23
sources: [MS Learn Built-in MCP catalog (fetched 2026-03-23), Agent 365 tooling overview (fetched 2026-03-23), WebSearch, Dynamics 365 MCP docs, Agent 365 server references, Power Apps MCP docs, Work IQ docs, 2026 Wave 1 release plan, Copilot Studio What's New (fetched 2026-03-23), community blogs]
confidence: high
refresh_trigger: before_architecture
catalog_url: https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-microsoft-mcp-servers
agent365_url: https://learn.microsoft.com/en-us/microsoft-agent-365/tooling-servers-overview
-->
# MCS Built-in MCP Servers

## What Are MCP Servers in MCS?

MCP (Model Context Protocol) servers provide rich, multi-tool access to services. **When a connector also has an MCP server, always prefer the MCP server** -- it gives the agent broader capability with a single connection.

MCP went GA in Copilot Studio in May 2025. MCP resources support added in public preview Nov 2025.

## Custom MCP Servers

| Feature | Details |
|---------|---------|
| Status | **Public preview Mar 2026, GA Apr 2026** |
| Transport | **Streamable HTTP only** (SSE deprecated after Aug 2025) |
| Auth | API key or OAuth 2.0 |
| Capabilities | Tools + Resources (prompts NOT yet supported) |
| Requirement | **Generative Orchestration must be enabled** |
| Limitation | **Topics cannot call MCP servers directly** -- only orchestrator can route to MCP tools |
| Clone support | Clone existing Microsoft-authored or hosted MCP servers (e.g., Dataverse MCP) and tailor them |
| DLP | Enforce Data Loss Prevention policies at MCP server and individual tool level |

**2026 Wave 1 upcoming:** "Use MCP-compliant tools in agent workflows" -- preview Apr 2026, GA Oct 2026. Agent workflows (flows) will be able to discover and invoke MCP tools as workflow steps with structured I/O. Source: https://learn.microsoft.com/en-us/power-platform/release-plan/2026wave1/microsoft-copilot-studio/use-mcp-compliant-tools-agent-workflows

## Official Built-in MCP Servers Catalog (Mar 2026)

Source: https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-microsoft-mcp-servers (fetched 2026-03-19)

**Note:** The catalog states "This list isn't exhaustive. New MCP connectors are added regularly."

The catalog now contains **36 MCP servers on the catalog page + 9 Work IQ servers on the Agent 365 page = 45+ total** (up from ~25 in Feb 2026). Significant ISV/third-party expansion.

### Category 1: Dataverse

| MCP Server | Description | Status |
|------------|-------------|--------|
| **Microsoft Dataverse** | CRUD operations on Dataverse tables, list/describe tables, search, FetchXML queries. Natural language data access. | GA |

### Category 2: Dynamics 365

| MCP Server | Connector Name in Catalog | Description | Status |
|------------|--------------------------|-------------|--------|
| **Dynamics 365 Sales MCP Server** | `d365salesmcpserver` | List leads, retrieve lead summaries, qualify leads, get/send outreach emails. Cross-functional with Service and ERP. | Preview |
| **Dynamics 365 ERP Analytics MCP** | `d365erpmcpserver` | Dynamic framework for F&O apps -- data operations + business logic. Adaptive tools, analytics-ready. Replaces older 13-static-tool version. | Preview |
| **Dynamics 365 Service MCP** | `d365customerservicemcpserver` | Case management, knowledge articles, omnichannel capabilities. Old D365 Service MCP is deprecated -- use new version. | Preview |
| **D365 Contact Center Admin MCP** | `d365contactcenteradminmcpserver` | Omnichannel and supervisor capabilities for service operations. Admin-focused. | Preview |
| **Dynamics 365 Business Central** | `dynamicssmbsaas` | Business Central connector with MCP capabilities. | GA |
| **Fin & Ops Apps (Dynamics 365)** | `dynamicsax` | Finance and operations apps connector. | GA |

*Note: Dynamics 365 Commerce MCP Server launched preview early 2026 -- catalog, pricing, promotions, inventory, carts, orders, fulfillment. Accessible via ERP MCP framework.*

### Category 3: Microsoft Fabric

| MCP Server | Description | Status |
|------------|-------------|--------|
| **Fabric MCP** | Connect to Fabric Data Agents for analytics and insights. Multi-agent orchestration -- Copilot Studio delegates data queries to Fabric agent. | Preview |

### Category 4: Office 365 Outlook (Legacy names -- see Work IQ below for latest)

| MCP Server | Description | Status |
|------------|-------------|--------|
| **Office 365 Outlook -- Contact Management** | Manage Outlook contacts. | GA |
| **Office 365 Outlook -- Email Management** | Email composition, management, search, filter via KQL/OData. | GA |
| **Office 365 Outlook -- Meeting Management** | Create, read, update, delete events. Free/busy slots, meeting invitations. | GA |

### Category 5: Kusto Query (REMOVED from built-in catalog)

| MCP Server | Description | Status |
|------------|-------------|--------|
| **Kusto Query** | ~~Run KQL queries against Azure Data Explorer clusters.~~ **No longer in the built-in MCS catalog as of Mar 2026.** KQL/ADX capabilities are now available via: (1) Azure MCP Server (external, deploy to ACA), (2) Fabric RTI MCP Server (open-source, github.com/microsoft/fabric-rti-mcp), (3) Microsoft Sentinel MCP (data exploration tools include KQL). | **Removed from catalog** |

### Category 6: Learn Docs MCP

| MCP Server | Description | Status |
|------------|-------------|--------|
| **Microsoft Learn Docs MCP** | Search Microsoft Learn documentation, fetch complete articles, search code samples. Free, no auth required. Streamable HTTP transport. Native in Copilot Studio since Aug 2025. | GA |

### Category 7: Box.com

| MCP Server | Description | Status |
|------------|-------------|--------|
| **Box MCP Server** | Cloud content management -- file access, search, sharing via Box platform. Third-party certified MCP connector. | Preview |

### Category 8: GitHub

| MCP Server | Description | Status |
|------------|-------------|--------|
| **GitHub** | Repository and issue management via GitHub MCP server. Available in built-in catalog. | GA |

### Category 9: Gieni

| MCP Server | Description | Status |
|------------|-------------|--------|
| **Gieni TS Server MCP** | Third-party MCP connector for fetching answers/insights. ISV-certified connector by Orderfox-Gieni. | Preview |

### Category 10: Power Apps MCP Server

| MCP Server | Description | Status |
|------------|-------------|--------|
| **Power Apps MCP Server** | Human-in-the-loop agent supervision for model-driven apps. Tools: `log_for_review` (passive oversight), `request_assistance` (async human handoff), `invoke_data_entry` (extract data from unstructured content into Dataverse forms with human review). Enhanced agent feed UI. NOT an Agent 365 server -- it is a Power Platform MCP server. | **Preview** |

### Category 11: Microsoft MCP Servers (Agent 365 / Work IQ)

These are enterprise-grade MCP servers under the Agent 365 umbrella. Require Microsoft 365 Copilot license. The Agent 365 page now uses **"Work IQ"** branding for M365 productivity servers.

**IMPORTANT (Mar 2026):** Agent 365 docs now state: "For all new connections, use the latest Work IQ MCP servers (e.g., Work IQ Teams). Existing connections using previous versions (e.g., Microsoft Teams MCP server) remain supported."

**STATUS CLARIFICATION (Mar 2026):** The Agent 365 tooling overview page now carries an explicit **"This is a preview feature"** banner at the top. The page title is "Work IQ MCP overview (preview)." While individual Work IQ servers function and are accessible in Copilot Studio, the Work IQ platform as a whole is officially in **Preview** with supplemental terms of use. The individual MCP connector entries (e.g., `a365mcpservers`) on the catalog page also show Preview badges. For production decisions, treat Work IQ as **Preview** until Microsoft removes the preview banner.

| MCP Server (New Name) | Old Name | Description | Status |
|------------------------|----------|-------------|--------|
| **Work IQ Mail** | Microsoft Outlook Mail MCP | Create, update, delete messages. Reply, reply-all. Semantic search with KQL-style queries and OData. | **Preview** (Work IQ platform) |
| **Work IQ User** | Microsoft 365 User Profile MCP | Get manager, direct reports, profile info. Search users. | **Preview** (Work IQ platform) |
| **Work IQ Calendar** | Microsoft Outlook Calendar MCP | Create, list, update, delete events. Accept/decline. Resolve conflicts. Find free/busy slots. | **Preview** (Work IQ platform) |
| **Work IQ Teams** | Microsoft Teams MCP | Create, update, delete chats. Add members. Post messages. Channel operations. | **Preview** (Work IQ platform) |
| **Work IQ SharePoint** | Microsoft SharePoint and OneDrive MCP | Upload files, get metadata, search files/folders. File and folder management. | **Preview** (Work IQ platform) |
| **Work IQ OneDrive** | *(new -- split from SharePoint)* | Manage files and folders in user's personal OneDrive. | **Preview** (Work IQ platform) |
| **Microsoft SharePoint Lists MCP** | *(same)* | Create lists, columns, items. Query with filters and pagination. | **Preview** (Work IQ platform) |
| **Microsoft 365 Admin Center MCP** | *(same)* | Admin-focused capabilities for Microsoft 365 administration. | **Preview** (Work IQ platform) |
| **Work IQ Word** | Microsoft Word MCP | Create/read documents, add comments, reply to comments. | **Preview** (Work IQ platform) |
| **Work IQ Copilot** | Microsoft 365 Copilot (Search) MCP | Chat with M365 Copilot, multi-turn conversations, ground responses with files. Cross-tenant search. Tool: `copilot_chat`. operationId: `mcp_m365copilot`. | **Preview** (Work IQ platform) |
| **Dataverse and Dynamics 365** | *(Agent 365 variant)* | CRUD operations and domain-specific actions via Agent 365 control plane. | **Preview** (Work IQ platform) |

### Category 12: Microsoft Security

| MCP Server | Description | Status |
|------------|-------------|--------|
| **Microsoft Sentinel MCP** | Security operations, threat hunting, incident management via Microsoft Sentinel. | Preview |
| **ICM MCP** | Microsoft internal incident management (IcM). | GA (Microsoft internal) |

### Category 13: Process Mining

| MCP Server | Description | Status |
|------------|-------------|--------|
| **Process Mining** | Process mining capabilities via Power Platform. By Microsoft. | GA |

### Category 14: Third-Party ISV MCP Servers (NEW -- expanded Mar 2026)

These are ISV-certified MCP servers now appearing in the Copilot Studio built-in catalog.

| MCP Server | Publisher | Description | Status |
|------------|-----------|-------------|--------|
| **Azure Databricks** | Databricks Inc. | Databricks workspace integration. Premium. | GA |
| **Databricks** | Databricks Inc. | Alternative Databricks connector with MCP. Premium. | Preview |
| **Bigdata-com** | Ravenpack International | Big data analytics. Premium. | Preview |
| **CData Connect AI** | CData Software | Connect to 200+ data sources via CData. Premium. | Preview |
| **Celonis MCP Server** | Celonis GmbH | Process mining and execution management. Premium. | Preview |
| **Cronofy MCP** | Cronofy Ltd | Cross-platform calendar scheduling. Premium. | Preview |
| **Draup MCP Server** | Draup | AI-powered talent and sales intelligence. Premium. | Preview |
| **Enlyft MCP** | Enlyft | Account intelligence and technographic data. Premium. | Preview |
| **Experlogix Smart Flows** | Experlogix US | Document generation and smart workflows. Premium. | GA |
| **Ezekia-MCP** | Ezekia | Executive search and recruitment. Premium. | Preview |
| **Highspot MCP** | Highspot | Sales enablement platform. Premium. | Preview |
| **Intelix IOC Analysis MCP** | Sophos Ltd | Security threat analysis (IOC). Premium. | Preview |
| **LSEG** | LSEG Financial Analytics | Financial data and analytics. Premium. | Preview |
| **Mobile Text Alerts MCP Server** | Mobile Text Alerts | SMS messaging. Premium. | Preview |
| **monday.com** | monday.com ltd | Work management platform. Premium. | Preview |
| **Morningstar** | Morningstar | Investment research data. Premium. | Preview |
| **Process Street MCP Server** | Process Street | Workflow and process management. Premium. | Preview |
| **S360 Breeze MCP** | Microsoft | Sustainability/compliance tooling. | GA |
| **SuperMCP** | Supermetrics | Marketing analytics data. Premium. | Preview |
| **Zapier MCP** | Zapier Inc | Connect to 7,000+ apps via Zapier. Premium. | Preview |

### Also Available (Agent 365 Tooling Platform)

| MCP Server | Description | Status |
|------------|-------------|--------|
| **Microsoft MCP Management Server** | Create, update, delete, and publish custom MCP servers programmatically. API-first -- no UI needed. Uses connectors, Graph APIs, REST, Dataverse custom APIs. Tools: CreateMCPServer, CreateToolWithConnector, UpdateTool, DeleteMCPServer, PublishMCPServer. | Preview |

## Microsoft MCP Connectors (Direct Integration)

These are the Microsoft-published MCP connectors available directly in Copilot Studio:

| Connector | Description |
|-----------|-------------|
| **Microsoft Dataverse** | Full CRUD on Dataverse tables |
| **D365 Customer Service** | Case management and knowledge |
| **D365 Sales** | Lead and opportunity management |
| **D365 ERP Analytics** | Finance & Operations analytics |
| **D365 Contact Center Admin** | Contact center administration |
| **Fabric MCP** | Microsoft Fabric data agents |
| **Microsoft Learn Docs MCP** | Documentation search |
| **Microsoft MCP Servers (a365mcpservers)** | Agent 365 unified connector |
| **Microsoft Sentinel MCP** | Security operations |
| **GitHub** | Repository and issue management |

## News / Bing Search MCP Server

**As of Mar 2026, there is NO dedicated Bing News, MSN News, Bing Search, or news-focused MCP server in the Copilot Studio built-in catalog.**

Alternatives for news/web search capabilities:
- **Work IQ Copilot (Search) MCP** can ground responses with web content (via M365 Copilot's Bing grounding)
- **Bing Search connector** (classic Power Platform connector, not MCP) provides web/news/image search
- **Custom MCP server** -- build one wrapping Bing Search API or any news API
- **Knowledge sources** -- add web URLs as knowledge in agent settings

## Graph Search and Intelligence MCP Connector (Mar 2026 community discovery)

A community-built MCP connector bringing Microsoft 365 search and insight capabilities to agents with 19 MCP tools spanning 5 categories. Uses Microsoft Graph Search API (POST /v1.0/search/query). Supports: emails, calendars, documents, Teams chats, SharePoint, external data sources. Requires M365 Copilot license for semantic search features. Source: https://troystaylor.com/power%20platform/custom%20connectors/mcp/2026-03-10-graph-search-intelligence-mcp-connector.html

## Work IQ -- Updated Understanding (Mar 2026)

**Work IQ is now the official branding for the Agent 365 M365 productivity MCP servers.** The Agent 365 tooling overview page has been rewritten with Work IQ as the primary concept. **The entire Work IQ platform is officially in Preview (Mar 2026).**

**Key changes from Feb 2026:**
- Agent 365 servers are now called "Work IQ MCP servers" (e.g., Work IQ Mail, Work IQ Calendar, Work IQ Teams)
- **OneDrive is now a separate Work IQ server** (previously combined with SharePoint)
- Old server names (Microsoft Outlook Mail MCP, etc.) still work for existing connections
- Work IQ has 3 layers: Data (unified signals), Memory (persistent understanding), Inference (models + tools)
- Admin governance via M365 admin center under "Agents and Tools"
- Observability via Microsoft Defender Advanced Hunting
- Available in both Copilot Studio (low-code) and Microsoft Foundry (pro-code)

**Mar 2026 What's New entry:** "(Preview) Use Work IQ tools to connect Microsoft 365 Copilot and your agents to the Work IQ service, enabling access to real-time work insights and context from Microsoft 365 files, emails, meetings, chats, and more." Source: https://learn.microsoft.com/en-us/microsoft-copilot-studio/whats-new

**How agents access Work IQ data:**
- **Via Work IQ MCP servers** -- Mail, Calendar, Teams, SharePoint, OneDrive, User, Word, Copilot Search all expose Work IQ-indexed data
- **Via Work IQ CLI/MCP** -- The `@microsoft/workiq` npm package provides a CLI and MCP server for developer tools (VS Code, GitHub Copilot, Claude Code). This is NOT available inside Copilot Studio as a built-in MCP server.
- **Via Work IQ Copilot MCP** -- The closest thing to "Work IQ in MCS settings." Searches across entire M365 ecosystem using Work IQ intelligence layer.

**Work IQ for custom agents** (announced Ignite 2025): Secure agent grounding that respects permissions, sensitivity labels, and compliance. Available in Copilot Studio or via API. Requires M365 Copilot license.

Source: https://learn.microsoft.com/en-us/microsoft-agent-365/tooling-servers-overview

## MCP Server operationIds (Agent 365)

| Service | operationId | Notes |
|---------|-------------|-------|
| Mail | `mcp_MailTools` | Work IQ Mail |
| Calendar | `mcp_CalendarTools` | Work IQ Calendar |
| Teams | `mcp_TeamsServer` | Work IQ Teams |
| User Profile | `mcp_MeServer` | Work IQ User |
| SharePoint/OneDrive | `mcp_ODSPRemoteServer` | Work IQ SharePoint/OneDrive |
| M365 Copilot Search | `mcp_m365copilot` | Work IQ Copilot (tool: `copilot_chat`) |

## Timeline: MCP Servers Added Late 2025 / Early 2026

| Timeframe | What Was Added |
|-----------|---------------|
| **May 2025** | MCP GA in Copilot Studio. Initial servers: Outlook Mail, Calendar, SharePoint/OneDrive, Teams |
| **Jul-Aug 2025** | Learn docs MCP added natively (no custom connector needed). |
| **Sep 2025** | MCP onboarding wizard, connector certification pipeline |
| **Oct 2025** | Dynamics 365 Sales MCP (GA). Dynamics 365 ERP MCP (new dynamic version). |
| **Nov 2025 (Ignite)** | MCP resources support (preview). Dataverse MCP advances. Agent 365 servers expanded (Word, SharePoint Lists, Admin Center, User Profile, M365 Copilot Search). Dynamics 365 Service MCP (new, old deprecated). Fabric MCP. Box.com, Gieni, Kusto added to catalog. MCP Management Server preview. |
| **Dec 2025** | Dynamics 365 Contact Center MCP. Supply Chain / Finance MCP improvements. |
| **Jan 2026** | Agent 365 tooling servers overview published. Frontier program enrollment for full Agent 365 access. |
| **Feb 2026** | Dynamics 365 Commerce MCP preview. Catalog at 25+ servers. ISV expansion begins (Celonis, Draup, Highspot, Enlyft, monday.com, etc.). |
| **Mar 2026** | Custom MCP servers public preview. Work IQ rebranding of Agent 365 servers (officially Preview). Catalog now 36 servers + 9 Work IQ = 45+ total. Sentinel MCP, Zapier MCP, CData Connect AI, LSEG, Cronofy, and many more ISV servers added. OneDrive split into separate Work IQ server. Kusto Query removed from built-in catalog (use Azure MCP Server or Fabric RTI MCP instead). A2A (Agent-to-Agent) protocol support added. Service principal auth for MCP servers discovered (community). |
| **Apr 2026** | Custom MCP servers GA (planned). "Use MCP-compliant tools in agent workflows" preview (planned). |
| **Oct 2026** | "Use MCP-compliant tools in agent workflows" GA (planned). |

## How to Add an MCP Server

### Method 1: User-Guided Manual Step (first-time per connector per environment)
When no connection reference exists for the MCP connector in the environment:
1. User goes to Tools section in MCS UI -> "Add tool"
2. Select "Model Context Protocol" filter
3. Search for the MCP server name
4. Select -> "Add to agent" or "Add and configure"
5. Create connection if prompted (handle auth popup / OAuth consent)
6. Connection reference + connection instance created automatically by MCS

### Method 2: Headless Reuse (when connection reference already exists)
When a connection reference for the MCP connector already exists in the environment (from any agent):
1. Discover connectionReferenceLogicalName via Dataverse query:
   `GET /connectionreferences?$filter=connectorid eq '/providers/Microsoft.PowerApps/apis/<connectorId>'`
2. Generate action YAML: `node tools/add-tool.js add --kind mcp --workspace <path> --connector <id> --action <operationId> --connection <connRefLogicalName>`
3. LSP push: `node tools/mcs-lsp.js push --workspace <path>`
4. Publish via PvaPublish

### Method 3: Template Agent Pattern (scalable, for repeated builds)
Pre-configure a "golden" template agent with common MCP servers (Outlook Mail, Calendar, Teams, SharePoint):
1. One-time: create template agent in MCS UI with all common MCP connections
2. Export as solution: `pac solution export --name "MCPTemplate" --path template.zip`
3. Import to target: `pac solution import --path template.zip --settings-file conn-map.json`
4. Connection references travel with the solution; map connections at import via settings file

### Method 4: MCP Management Server (Preview)
For creating NEW custom MCP servers (not adding existing built-in ones):
1. Requires M365 Copilot license (Frontier program no longer strictly required for basic access)
2. Use CreateMCPServer + CreateToolWithConnector/Graph/CustomAPI/RemoteAPI
3. Publish via PublishMCPServer
4. Connect via VS Code MCP client or Copilot Studio UI
5. Currently only tenant admins can publish custom MCP servers within a tenant

### Method 5: Azure MCP Server (for Azure resource access)
Deploy Azure MCP Server as a remote MCP server and connect to Copilot Studio:
1. Deploy to Azure Container Apps using `azd` template
2. MCP servers use connector infrastructure for enterprise security (VNet, DLP)
3. Source: https://learn.microsoft.com/en-us/azure/developer/azure-mcp-server/how-to/deploy-remote-mcp-server-copilot-studio

### Programmatic Addition Blockers (Mar 2026)
- **OAuth connection creation** cannot be done headlessly -- no public API to create user-delegated OAuth connections in API Hub
- **PvaShareConnection** action exists on connectionreference entity but is "internal use only" with no documented parameters
- **connectionparametersconfig** field on connectionreference may enable pre-seeded connections but format is undocumented
- **Connectivity API** (`{envId}.environment.api.powerplatform.com`) does not resolve for Microsoft internal tenant environments
- **connectioninstance** table supports POST but requires `connectioninternalid` (API Hub ID) which cannot be fabricated

### Dataverse Entities Involved (for headless approaches)
| Entity | Table | Key Fields | Role |
|--------|-------|-----------|------|
| connectionreference | `connectionreferences` | connectionreferencelogicalname, connectorid, connectionid | Links connector type to agent |
| connectioninstance | `connectioninstances` | connectioninternalid, connectionreferenceid, connectorinternalid | Stores authenticated connection |
| botcomponent_connectionreference | M:M intersect | botcomponentid, connectionreferenceid | Associates tool action with connection |
| bot.providerconnectionreferenceid | bot table | providerconnectionreferenceid -> connectionreferenceid | Agent-level connection reference lookup |

## MCP vs Connector Decision

| Factor | Prefer MCP | Prefer Connector |
|--------|-----------|-----------------|
| Breadth of access | Need multiple operations | Need one specific action |
| Setup complexity | Single connection | May need per-action setup |
| Capability | Richer context for AI, dynamic tools | Specific, predictable action |
| Availability | Check MCS UI catalog (~45+ servers) | Larger catalog (1,500+ connectors) |
| Custom servers | Build scenario-focused MCP servers via MCP Management Server | Use Power Platform custom connectors |
| Tool selection | Can selectively enable/disable individual MCP tools | All-or-nothing per action |
| Versioning | MCP server updates auto-reflect without republishing agent | Connector updates may require republishing |

## Connector-Embedded MCP Servers (Feb 2026 Discovery)

Some Power Platform connectors now include MCP server actions as built-in operations. These are **distinct from the MCS catalog MCP servers** listed above. They appear as actions on the connector reference page with `mcp_` prefixed operation IDs.

| Connector | MCP Operation ID | Description |
|-----------|-----------------|-------------|
| **Salesforce** | `mcp_SalesforceManagement` | MCP server for Salesforce management via JSON-RPC. Uses same Salesforce connector auth. |

This is a new pattern where Microsoft embeds MCP server endpoints inside existing connectors. More connectors may have these -- check connector reference pages for `mcp_` operations.

Source: https://learn.microsoft.com/en-us/connectors/salesforce/ (Actions section)

## Key Facts

- MCP went GA in May 2025 in Copilot Studio
- MCP resources support added Nov 2025 (preview)
- SSE transport deprecated -- only Streamable HTTP supported after Aug 2025
- **Custom MCP servers: public preview Mar 2026, GA Apr 2026**
- Custom MCP auth: API key or OAuth 2.0
- MCP supports tools + resources (prompts NOT yet supported)
- Generative Orchestration must be enabled to use MCP
- **Topics cannot call MCP servers directly** -- only the orchestrator routes to MCP tools
- **MCP in agent workflows (flows): preview Apr 2026, GA Oct 2026** -- will enable deterministic MCP tool invocation in flows
- Agent 365 servers now branded as "Work IQ" -- require M365 Copilot license -- **entire Work IQ platform is officially Preview (Mar 2026)**
- Custom MCP servers: use MCP onboarding wizard or create custom connector in Power Apps
- ISVs can certify and publish MCP servers to the catalog -- 20+ ISV servers now in catalog
- MCP Management Server enables programmatic creation of custom MCP servers
- Some connectors embed MCP server actions (e.g., Salesforce `mcp_SalesforceManagement`) -- accessed as connector actions, not via MCP catalog
- **Catalog has grown from ~25 servers (Feb 2026) to 36 catalog + 9 Work IQ = 45+ servers (Mar 2026)**
- **Kusto Query no longer in built-in catalog** -- use Azure MCP Server (deploy to ACA) or Fabric RTI MCP Server (open-source) for KQL/ADX access
- **A2A (Agent-to-Agent) protocol** -- Copilot Studio now supports connecting agents over the A2A protocol (preview). Source: https://learn.microsoft.com/microsoft-copilot-studio/add-agent-agent-to-agent
- **Service principal auth for MCP servers** -- MCP servers can now use service principal (application) auth, not just user-delegated OAuth. Source: community blog (ashiqf.com, 2026-03-19)
- Selective tool enabling: turn off individual MCP tools via "Allow all" toggle in agent settings
- Component collections now support MCP connector types for export/import

## Refresh Notes

- New MCP servers appear in MCS UI before documentation
- Check "Add tool" -> "Model Context Protocol" section for current list
- The official catalog at learn.microsoft.com/microsoft-copilot-studio/mcp-microsoft-mcp-servers is the authoritative source
- Search community sources for MCP servers for non-M365 systems
- Agent 365 tooling servers overview: learn.microsoft.com/microsoft-agent-365/tooling-servers-overview
- Watch for Work IQ branding changes -- old server names deprecated but still functional
- ISV catalog expanding rapidly -- check catalog monthly
