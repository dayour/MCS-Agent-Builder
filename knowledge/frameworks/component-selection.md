# Component Selection Framework

## Principle

**Microsoft-first, research externals only when needed.** Enterprise agents run on the Microsoft stack. Prefer MCS built-in capabilities, Power Platform, Azure, and M365 connectors before considering third-party or custom solutions.

MCS ships continuously — but the core Microsoft stack is well-documented in cache. Only escalate to live research for external systems not covered by cache.

## Microsoft-First Priority Ladder

| Priority | Source | Examples | Research Needed? |
|----------|--------|----------|-----------------|
| 1 | **MCS Built-In** | MCP servers, native knowledge, generative orchestration | Cache only |
| 2 | **Power Platform** | Power Automate flows, Dataverse, custom connectors | Cache only |
| 3 | **Azure Services** | Azure Functions, Azure AI, Azure Storage | Cache + quick verify |
| 4 | **M365 Connectors** | SharePoint, Outlook, Teams (Standard tier) | Cache only |
| 5 | **Certified Premium Connectors** | Dynamics 365, ServiceNow, Salesforce | Cache + verify availability |
| 6 | **Third-Party / Custom** | Custom MCP servers, HTTP endpoints, community tools | Full live research required |

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
| MCP Servers | `knowledge/cache/mcp-servers.md` | Does an MCS built-in MCP server exist? (Priority 1) |
| M365 Connectors | `knowledge/cache/connectors.md` | Is there a standard M365 connector? (Priority 4) |
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

## Architecture Decision: Agent vs Tool vs Computer Use

| Type | Characteristics | Implementation |
|------|-----------------|----------------|
| **Tool** | Fetches data, executes actions, stateless | MCP Server / Connector |
| **Expert** | Has knowledge, makes judgments, has persona | Child Agent |
| **Desktop task** | No API available, human could do it in a GUI app | Computer Use tool |
