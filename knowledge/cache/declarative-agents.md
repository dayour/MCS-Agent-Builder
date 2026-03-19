<!-- CACHE METADATA
last_verified: 2026-03-19
sources: [MS Learn (overview-declarative-agent, declarative-agent-architecture, declarative-agent-manifest-1.5, declarative-agent-tool-comparison, agents-overview, declarative-agent-connected-agent, copilot-studio-experience, agent-builder), Microsoft 365 Blog (2025-05-19, 2026-03-09), WorkIQ internal context (CAPE Day 2026-03-11)]
confidence: high
refresh_trigger: before_research
-->
# Declarative Agents (DA) — Cheat Sheet

> **Purpose:** When `/mcs-research` determines a use case fits a Declarative Agent, output a recommendation with this guide instead of building in Copilot Studio. Our automated build pipeline stays focused on Custom Agents (CA).

## What Is a Declarative Agent?

A DA is a customized version of Microsoft 365 Copilot configured through a JSON manifest — no custom code, no hosting. It runs on Copilot's own orchestrator, foundation models, and security/compliance infrastructure.

**Three configuration levers:**
1. **Instructions** — Natural language directions shaping behavior (up to 8,000 chars)
2. **Knowledge** — Scoped data sources (SharePoint, OneDrive, Copilot connectors, Dataverse, Teams messages, email, people, meetings)
3. **Actions** — API plugins, MCP servers, or Power Platform connectors for external system interaction

## DA vs CA — When to Recommend DA

### Recommend DA when ALL of these are true:
- Use case is primarily **information retrieval, Q&A, or simple API calls**
- Users are **M365 Copilot licensed** within the org
- Only needs to run in **M365 apps** (Copilot Chat, Teams, Word, Excel, PowerPoint, Outlook)
- **No complex multi-step workflows** or conditional branching needed
- **No proactive/scheduled triggers** needed (user-initiated only)
- **No custom topics, adaptive cards, or branded UX** needed
- Response times **under 45 seconds** are acceptable

### Hard disqualifiers — if ANY are true, recommend CA instead:

| # | Disqualifier | Why DA Can't Do This |
|---|-------------|---------------------|
| 1 | External channels (web chat, Slack, WhatsApp, Direct Line, mobile app) | DA only runs in M365 apps |
| 2 | Custom YAML topics with branching logic | DA has no topic authoring — sequential processing only |
| 3 | Adaptive card responses | DA returns text only |
| 4 | MCP tools (preview in DA, not production-ready) | Available in DA preview but not recommended for production builds |
| 5 | Multi-agent orchestration (child/connected CA agents) | DA-to-DA text delegation only, no CA orchestration |
| 6 | Autonomous / scheduled / event-driven triggers | DA is user-initiated only |
| 7 | Custom model selection | DA uses M365 Copilot's model, developer has no control |
| 8 | External or non-licensed users | DA requires M365 Copilot license per user |

**Also recommend CA when:** Power Automate flow integration needed, precise topic routing control needed, multi-step conditional workflows needed, custom response formatting needed.

## DA Technical Limits

| Limit | Value | Impact |
|-------|-------|--------|
| Grounding records | 50 items | Affects contextual data available per query |
| Plugin response | 25 items | Constrains external API response sizes |
| Token limit | 4,096 | Includes all context + response data |
| Timeout | 45 seconds | Includes network latency + processing |
| Instructions | 8,000 chars | Same as CA |
| Processing model | Sequential | Typically single-pass: grounding then tool call. No iterative reasoning loops or chained multi-step operations ([source](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/declarative-agent-architecture#declarative-agent-data-flow)) |

**Rule of thumb:** Optimize for ~66% of technical limits to account for overhead.

## DA Manifest Capabilities

Schema v1.5 is the latest fully documented version. Schema v1.6 adds `worker_agents` for connected agents (see Connected Agents section). Capabilities below are from v1.5 (GA).

| Capability | What It Enables |
|------------|----------------|
| `WebSearch` | Web grounding, optionally scoped to 4 sites |
| `OneDriveAndSharePoint` | Document grounding from SharePoint sites/libraries |
| `GraphConnectors` | Copilot connectors (formerly Graph connectors) for external data |
| `GraphicArt` | Image generation |
| `CodeInterpreter` | Python code generation and execution |
| `Dataverse` | CRM/business data from Dataverse tables |
| `TeamsMessages` | Teams chat/channel message search |
| `Email` | Mailbox search (including shared mailboxes) |
| `People` | Organizational people search |
| `Meetings` | Meeting transcript search |
| `ScenarioModels` | Task-specific models |

## DA Connected Agents (Schema v1.6 — Preview)

DAs can delegate to other DAs via `worker_agents` in the manifest.

**Constraints:**
- DA-to-DA only (cannot connect to CA or custom engine agents)
- Text-only communication (no files, images, or adaptive cards)
- Each connected agent must be installed by the user
- Adaptive cards from connected agents are processed as data but not displayed

## Build Tools for DA

| Tool | Audience | How |
|------|----------|-----|
| **Agent Builder** (in M365 Copilot) | Business users, no-code | copilot.microsoft.com → Create agent |
| **Copilot Studio** (DA mode) | Makers, low-code | Agents → M365 Copilot → Add |
| **M365 Agents Toolkit** (VS Code) | Developers, pro-code | VS Code extension, generates manifest JSON |
| **TypeSpec** (`@microsoft/typespec-m365-copilot`) | Developers | Type-safe manifest authoring with compile-time validation |
| **SharePoint** | Site owners, no-code | Create agent scoped to a SharePoint site |

**Conversion paths:**
- DA → Copilot Studio: "Copy to Copilot Studio" button (preserves instructions + knowledge)
- DA → Custom Engine Agent: Via M365 Agents Toolkit conversion
- Copilot Studio CA → M365 Copilot: Publish to M365 Copilot channel (appears as agent but runs on CS orchestrator)

## DA Architecture — Two Separate Orchestrators

```
M365 Copilot Orchestrator          Copilot Studio Orchestrator
(hosts Declarative Agents)         (hosts Custom Agents)
├── Sequential processing          ├── Multi-step planning
├── Single grounding + tool call   ├── Iterative reasoning loops
├── No proactive messaging         ├── Triggers + autonomous
├── DA-to-DA connected agents      ├── Multi-framework connected agents
└── Microsoft-managed              └── Power Platform-managed
```

These are **separate planes** — no unified orchestration layer today. Bridge patterns:
- **DA calling CA:** DA uses an API plugin that calls a CA's REST endpoint. **Note:** Requires explicit auth design (OAuth/API key), least-privilege access, and validation of data crossing between M365 Copilot and Copilot Studio environments.
- **CA in M365 Copilot:** CA published to M365 Copilot channel appears alongside DAs in Agent Store (runs on CS orchestrator, not M365 Copilot orchestrator)
- **Neither can directly call the other** as a sub-agent

## License Requirements

| Feature | License |
|---------|---------|
| Use existing DAs | M365 Copilot ($30/user/month) |
| Build DAs via Agent Builder | M365 Copilot |
| Build DAs via Copilot Studio | M365 Copilot + Copilot Studio license |
| Build DAs via Agents Toolkit | M365 Copilot (developer builds, no extra license) |
| Prebuilt chat agents (coaches) | M365 Copilot Chat (free) or M365 Copilot |

## Key Repos & Resources

| Resource | URL | Purpose |
|----------|-----|---------|
| DA Architecture docs | [MS Learn](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/declarative-agent-architecture) | Limits, data flow, use case alignment |
| DA Overview | [MS Learn](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/overview-declarative-agent) | What DAs are, scenarios, benefits |
| DA Tool Comparison | [MS Learn](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/declarative-agent-tool-comparison) | Agent Builder vs Toolkit vs Copilot Studio |
| Agent Builder vs Copilot Studio | [MS Learn](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/copilot-studio-experience) | When to use which |
| DA Manifest Schema v1.5 | [MS Learn](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/declarative-agent-manifest-1.5) | JSON manifest reference |
| Connected Agents | [MS Learn](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/declarative-agent-connected-agent) | DA-to-DA delegation |
| Agents Overview (DA vs CEA) | [MS Learn](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/agents-overview) | Decision guide |
| pnp/copilot-pro-dev-samples | [GitHub](https://github.com/pnp/copilot-pro-dev-samples) | Community DA samples |
| M365 Agents Toolkit | [GitHub](https://github.com/OfficeDev/microsoft-365-agents-toolkit) | VS Code extension for DA manifests |
| microsoft/AgentSchema | [GitHub](https://github.com/microsoft/AgentSchema) | Unified YAML spec (MCS + Foundry) |
| Copilot Camp | [GitHub](https://microsoft.github.io/copilot-camp/) | Hands-on labs for DA + CEA |

## Convergence Signals (Internal)

From CAPE Day (2026-03-11) and WorkIQ research:
- DAs are gaining capabilities from CAs (topics, evals, testing) — convergence, not deprecation
- Microsoft's intended model: **DA for simple → CA for complex** (progressive enhancement)
- Actions for DAs via Copilot Studio is an active investment area (ADO #4765717)
- DA model upgrading to GPT-5.2 by late March 2026
- Agent 365 (GA May 2026) will provide unified governance across both DA and CA

---

## Customer Recommendation Template

When research determines DA is the right path, include this in the build report:

```markdown
## Recommendation: Declarative Agent

Based on the capability analysis, this use case is best served by a **Declarative Agent**
rather than a custom Copilot Studio build.

### Why Declarative Agent
- [Specific reasons from scoring: e.g., "All capabilities are information retrieval
  from SharePoint, no complex workflows needed"]
- [License confirmation: "Customer has M365 Copilot licenses"]
- [Channel fit: "Users work exclusively in Teams and M365 Copilot"]

### Why NOT Custom Agent
- [Explicit rejection reasons: e.g., "No multi-step workflows, no external channels,
  no adaptive cards needed — CA would be over-engineered"]

### Recommended Build Tool
- [Agent Builder / Copilot Studio DA mode / Agents Toolkit — based on customer's
  technical capability]

### Getting Started
1. Go to [copilot.microsoft.com](https://copilot.microsoft.com) → Create agent (Agent Builder)
   OR open Copilot Studio → Agents → Microsoft 365 Copilot → Add
2. Set agent name: [from brief.json agent.name]
3. Add instructions: [from brief.json instructions or generated instructions]
4. Add knowledge sources: [from brief.json knowledge[]]
5. Add actions if needed: [from brief.json integrations[] where type = connector/api-plugin]
6. Test in M365 Copilot Chat
7. Publish to organizational catalog

### First-Party Agents to Leverage
[From frontierAgentMatch[] — list any first-party agents that cover capabilities]

### Prerequisites to Confirm
- [ ] Customer has M365 Copilot licenses ($30/user/month)
- [ ] [If Office agents recommended] Anthropic subprocessor enabled by admin
- [ ] [If Frontier agents recommended] Frontier program enrollment active
- [ ] Required SharePoint sites / data sources accessible

> If any prerequisite is unconfirmed, note: "DA recommendation is conditional on
> [prerequisite]. Verify before proceeding."

### What We Provide
- Agent instructions (generated from brief)
- Knowledge source configuration guide
- Eval test questions (for manual verification in M365 Copilot)
- Boundary/scope documentation
```
