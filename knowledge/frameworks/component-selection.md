# Component Selection Framework

## Principle

**Microsoft-first, research externals only when needed.** Enterprise agents run on the Microsoft stack. Prefer MCS built-in capabilities, Power Platform, Azure, and M365 connectors before considering third-party or custom solutions.

MCS ships continuously — but the core Microsoft stack is well-documented in cache. Only escalate to live research for external systems not covered by cache.

## Microsoft-First Priority Ladder

| Priority | Source | Examples | Research Needed? |
|----------|--------|----------|-----------------|
| **1a** | **Work IQ (2 servers)** | Work IQ Copilot + Work IQ User — covers all M365 data (mail, calendar, teams, sharepoint, files, people) | Cache only |
| **1b** | **Other MCS Built-In MCP** | Dataverse, Dynamics 365, Fabric, GitHub, Learn Docs, Sentinel | Cache only |
| 2 | **Power Platform** | Power Automate flows, Dataverse, custom connectors | Cache only |
| 3 | **Azure Services** | Azure Functions, Azure AI, Azure Storage | Cache + quick verify |
| 4 | **M365 Connectors** | SharePoint, Outlook, Teams (only if Work IQ unavailable) | Cache only |
| 5 | **Certified Premium Connectors** | Dynamics 365, ServiceNow, Salesforce | Cache + verify availability |
| 6 | **Third-Party / Custom** | Custom MCP servers, HTTP endpoints, community tools | Full live research required |

**Work IQ first:** For any M365 data access, add Work IQ from the agent overview page. This adds 2 MCP servers — **Work IQ Copilot** (cross-M365 search/actions for mail, calendar, teams, sharepoint, files, everything) + **Work IQ User** (people, org chart, manager). These 2 servers replace the need for individual Mail, Calendar, Teams, SharePoint MCP servers or connectors. Requires M365 Copilot license. Status: Preview (Mar 2026). Fall back to individual M365 connectors (Priority 4) only when Work IQ is unavailable.

**Fast path:** Priority 1-4 integrations resolve from cache — no live research needed. Priority 5-6 require cache check + potential live research via Research Analyst.

## Research Protocol

For each agent capability, ask: **"What's the best way to implement this in the Microsoft stack?"** then:

1. **Check cache** — read relevant `knowledge/cache/` files for baseline knowledge
2. **Classify priority** — which tier does each integration fall into? (1-4 = fast path, 5-6 = needs research)
3. **For Priority 1-4:** Resolve from cache. These are well-documented, enterprise-supported, and GA.
4. **For Priority 5-6:** Check cache freshness (> 7 days → live research). Then:
   - WebSearch for the capability + "Copilot Studio" + current year
   - MS Learn MCP for official docs and code samples
   - Community search if relevant (custom connectors, community MCP servers)
5. **Update cache** with any new findings

**When to escalate beyond Microsoft stack:**
- No Microsoft-native solution exists for the requirement
- Microsoft solution exists but has critical limitations (scale, latency, cost)
- Customer has existing infrastructure on a different platform they must keep

## Enterprise Selection Criteria

When evaluating any component, score against these enterprise requirements:

| Criterion | What to Check |
|-----------|--------------|
| **GA Status** | Is it Generally Available? Preview features need explicit customer approval |
| **Support / SLA** | Does Microsoft or the vendor offer support? What's the uptime commitment? |
| **Security Compliance** | SOC2, ISO 27001, GDPR? Does it meet customer's security requirements? |
| **Managed vs Custom** | Managed service preferred. Custom code = ongoing maintenance burden |
| **Licensing** | Assume best licensing available (M365 Copilot, Copilot Studio, Premium, Frontier). Only flag if customer explicitly states a limitation. |
| **Data Residency** | Where is data stored/processed? Relevant for regulated industries |

## Component Categories (Checklist)

Check each category in Microsoft-first order:

| Category | Cache File | Key Question |
|----------|-----------|-------------|
| **Work IQ MCP** | `knowledge/cache/mcp-servers.md` § Work IQ | Is this M365 data? Use Work IQ first (Priority 1a) |
| Other MCP Servers | `knowledge/cache/mcp-servers.md` | Does an MCS built-in MCP server exist? (Priority 1b) |
| M365 Connectors | `knowledge/cache/connectors.md` | Is there a standard M365 connector? (Priority 4 — only if Work IQ unavailable) |
| Power Automate Flows | `knowledge/cache/power-automate-integration.md` | Does this need scheduling, loops, or multi-step orchestration? (Priority 2) |
| AI Builder / AI Tools | `knowledge/cache/ai-tools-computer-use.md` | Does this need prompt actions, extraction, or classification? (Priority 1-2) |
| Azure Services | — | Is Azure Functions / Azure AI the right layer? (Priority 3) |
| Premium Connectors | `knowledge/cache/connectors.md` | Is there a certified premium connector? (Priority 5) |
| Knowledge Sources | `knowledge/cache/knowledge-sources.md` | What data does the agent need to read? |
| Channels | `knowledge/cache/channels.md` | Where will users interact with this agent? |
| Computer Use Tool | — | Does this task lack an API? Could a human do it in a GUI? (Priority 6) |
| Custom Code | — | Is a custom connector or HTTP endpoint the only option? (Priority 6) |
| Custom MCP Servers | — | Does a community MCP server exist? (Priority 6) |
| **Agent Settings (toggles)** | `knowledge/cache/ai-tools-computer-use.md` § "Generative AI Settings" | Bing Web Search, General Knowledge, Moderation — these are `type: "setting"` in brief.json, NOT tools. Configured via Settings > Generative AI or LSP push. |
| Agent Auth & Access | — | What auth mode, access control? |

## Selection Output

For each capability in the spec, document:

1. **Priority tier** — which level (1-6) in the Microsoft-first ladder
2. **Research performed** — cache-only for 1-4, live research for 5-6
3. **Options considered** — minimum 2, with current status (GA / Preview / Private Preview)
4. **What was selected and why**
5. **What was rejected and why**
6. **Status** — ready / needs setup / blocked

## Work IQ Integration Strategy (M365 Data Access)

When an agent needs any M365 data (email, calendar, Teams, SharePoint, OneDrive, user profile, files, search):

### Default: Add Work IQ from Overview Page
Add Work IQ from the agent overview page. This adds **2 MCP servers** that cover everything:
- **Work IQ Copilot** (`mcp_M365Copilot`) — cross-M365 search and actions for mail, calendar, teams, sharepoint, onedrive, files, everything
- **Work IQ User** (`mcp_MeServer`) — people, org chart, manager, direct reports

No need to add individual Mail, Calendar, Teams, SharePoint servers separately. These 2 servers are the unified M365 integration.

### When to Add Individual Work IQ Servers
Only add individual servers (Work IQ Mail, Work IQ Calendar, etc.) if Work IQ Copilot doesn't cover a specific write operation you need. For most agents, the 2 default servers are sufficient.

### Gaps (Use Connectors)
Planner, Excel, Approvals, PowerPoint — no Work IQ equivalent. Use Power Platform connectors.

### Prerequisites
- M365 Copilot license required
- Status: Preview (Mar 2026)
- Fall back to individual M365 connectors only when Work IQ is unavailable

## Architecture Decision: Agent vs Tool vs Computer Use

| Type | Characteristics | Implementation |
|------|-----------------|----------------|
| **Tool** | Fetches data, executes actions, stateless | MCP Server / Connector |
| **Expert** | Has knowledge, makes judgments, has persona | Child Agent |
| **Desktop task** | No API available, human could do it in a GUI app | Computer Use tool |
