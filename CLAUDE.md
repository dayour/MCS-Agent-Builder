# Claude Code Instructions for MCS Automation

## Overview

Automate Microsoft Copilot Studio (MCS) agent creation using Claude Code with Playwright MCP. You (Claude) research capabilities, analyze use cases, recommend components, and execute UI automation.

**CRITICAL: Never assume components. Every use case is different. Research first, recommend based on requirements.**

## Workflow Phases

```
PREREQUISITES → PHASE 0: Eval Design → PHASE 1: Architecture → PHASE 2: Build → PHASE 3: Validate
     ↓                    ↓                      ↓                    ↓                ↓
  Mission,           Foundational           Component           Build &          Full eval,
  Scenarios,         eval set,              selection,          iterate on       operationalize
  Dimensions         acceptance             approval            eval failures
                     criteria
```

---

## PREREQUISITES: Mission & Scope

**Before any research or design, ensure usecase.md contains:**

### 1. Core Mission
- What tasks does this agent perform?
- What user needs does it address?
- What does success look like?

### 2. Scope & Boundaries

| Category | Description |
|----------|-------------|
| **HANDLE** | Tasks the agent should complete fully |
| **DECLINE GRACEFULLY** | Out-of-expertise requests to redirect with helpful guidance |
| **OUT OF SCOPE** | Requests to refuse (with or without explanation) |

### 3. Key Scenarios (6-10)

Identify representative user interactions:
- Happy path scenarios (most common use)
- Edge cases (unusual but valid requests)
- Boundary scenarios (scope limits)
- Error recovery scenarios

### 4. Quality Dimensions & Thresholds

Define per agent (no org-wide defaults):

| Dimension | Example Threshold | When Critical |
|-----------|-------------------|---------------|
| **Accuracy** | 95%+ | Factual/technical agents |
| **Grounding** | 100% | Compliance-sensitive contexts |
| **Empathy** | High | Customer-facing agents |
| **Response Time** | <3s | Real-time assistance |
| **Escalation Rate** | <10% | Self-service goals |

---

## PHASE 0: Evaluation Design

**Create foundational eval set BEFORE building anything.**

### Step 1: Create evaluation.md

Use the template at `Build-Guides/_template/evaluation.md`:
- 2-3 test cases per scenario = 15-25 foundational cases
- Define acceptance criteria per test case

### Step 2: Define Acceptance Criteria

Each test case needs four criteria types:

| Criteria | Description | Example |
|----------|-------------|---------|
| **Content** | What MUST be present | "Must include policy number and deadline" |
| **Constraints** | What must NOT happen | "Must not disclose internal pricing logic" |
| **Quality** | Tone, style, empathy | "Professional, empathetic for complaints" |
| **Behavior** | Actions, routing, escalation | "Must create ticket for billing disputes" |

### Step 3: Research MCS Capabilities

1. **Check Knowledge Base below first** - Avoid redundant research
2. **Research via MS Learn MCP:**
   ```
   mcp__microsoft-learn__microsoft_docs_search(query="Copilot Studio [topic]")
   mcp__microsoft-learn__microsoft_docs_fetch(url="[doc URL]")
   ```
3. **For connectors:** `https://learn.microsoft.com/en-us/connectors/[name]`
4. **Check preview vs GA:** Search "Copilot Studio what's new 2024 2025"

### Step 4: Map Eval Requirements → MCS Components

Based on eval criteria, identify required capabilities:

| Eval Requirement | Likely MCS Component |
|------------------|----------------------|
| Answer from documents | Knowledge Sources |
| Execute actions | Agent Flows, Connectors |
| Structured data collection | Topics with Adaptive Cards |
| Route to specialists | Multi-agent, Topics |
| Real-time external data | Power Platform Connectors |

---

## PHASE 1: Architecture

### MCS Component Quick Reference

| Category | Components | When to Use |
|----------|------------|-------------|
| **AI/Orchestration** | Generative Orchestration, Generative Answers, AI Prompts | Dynamic conversation flow, open-ended Q&A |
| **Automation** | Agent Flows, Power Automate, HTTP Requests, Custom Connectors, MCP | Workflow automation, API integration |
| **Conversation** | Topics, Adaptive Cards, Message/Question/Condition Nodes | Structured flows, rich UI, branching logic |
| **Knowledge** | SharePoint, Dataverse, Public Websites, Files, Enterprise Connectors | Document Q&A, structured data, external systems |
| **Triggers** | Conversation, Event, Scheduled, On Knowledge Requested | User-initiated, autonomous, periodic tasks |
| **State** | Topic Variables, Global Variables, System Variables, Power Fx | Temporary data, session state, calculations |

### Present Options (Don't Assume)

```markdown
## Recommendations: [Agent Name]

### For [Requirement]
| Option | Pros | Cons |
|--------|------|------|
| Option A | ... | ... |
| Option B | ... | ... |

**Recommendation:** [Option] because [reason]

Which options would you like to proceed with?
```

### Design Document

After user approves components:

```markdown
# Agent Design: [Name]

## Selected Components
[Only what was agreed]

## User Flows
[Each interaction path]

## Implementation Details
[Only for selected components]
```

### UX Quick Wins (2-min check)

| If... | Consider... |
|-------|-------------|
| Users return multiple times | Smart greeting (new vs returning user) |
| User-specific data exists | Personalize greeting, show status |
| Multi-step process | Show progress (X of Y) |
| Common next actions | Quick action buttons |

**Rule:** If <5 lines in Instructions, worth doing. If needs new Topic/Flow, ask first.

---

## PHASE 2: Build

### Pre-Build Validation

Before ANY Copilot Studio operation:

1. Navigate: `mcp__playwright__browser_navigate(url="https://copilotstudio.microsoft.com")`
2. Snapshot: `mcp__playwright__browser_snapshot()`
3. Confirm: "Current session: [account] in [environment]. Proceeding with [operation]..."

### Build Order

1. Create Agent (name, description, instructions)
2. [If needed] Add Knowledge Sources
3. [If needed] Create Dataverse Tables
4. [If needed] Create Flows
5. [If needed] Create Topics
6. [If needed] Configure Triggers
7. [If multi-agent] Connect Child Agents
8. **Run foundational eval set**
9. Iterate on failures
10. Publish (when ready)

### Build Operations

| Operation | Steps |
|-----------|-------|
| **Create Agent** | Create → New agent → name, description, instructions → Save |
| **Add Knowledge** | Knowledge tab → Add → Select source type → Configure |
| **Create Topic** | Topics → New → Add triggers (5-10 phrases) → Build nodes |
| **Create Flow** | Flows → New → Natural language or visual designer |
| **Add Child Agent** | Agents tab → Add agent → Select → Reference with `/AgentName` in instructions |

### Build-Test Loop

```
Build component → Run relevant eval cases → Pass? → Next component
                                              ↓
                                           Fail? → Analyze failure → Fix → Re-test
```

---

## PHASE 3: Validate & Operationalize

### Run Full Evaluation Suite

After build complete, run all eval sets:
- [ ] Foundational set (15-25 cases) - Must pass 100%
- [ ] Variations set (20-30 cases) - Target threshold per dimension
- [ ] Architecture tests (20-30 cases) - Component validation
- [ ] Edge cases (15-20 cases) - Graceful handling

### MCS Evaluation Tools

| Eval Need | MCS Tool | Grader/Method |
|-----------|----------|---------------|
| Response quality | Agent Evaluation | Quality grader (Relevance, Groundedness, Completeness) |
| Exact answers | Agent Evaluation | Text Match (exact/keyword) |
| Semantic match | Agent Evaluation | Similarity (0-1 score) |
| Multi-turn flows | Copilot Studio Kit | Multi-turn test type |
| Topic routing | Copilot Studio Kit | Topic Match + Dataverse |
| Production metrics | Built-in Analytics | Engagement, Resolution, Deflection rates |

*For detailed eval configuration, use:*
```
mcp__microsoft-learn__microsoft_docs_search(query="Copilot Studio agent evaluation")
```

### Failure Analysis Framework

| Failure Type | Symptoms | Fix |
|--------------|----------|-----|
| **Knowledge Gap** | Correct retrieval, wrong/missing info | Update knowledge sources, add content |
| **Retrieval Failure** | Wrong document or no results | Improve search terms, add synonyms, chunk differently |
| **Grounding Violation** | Hallucinated or invented info | Strengthen grounding in instructions, reduce temperature |
| **Tone Failure** | Cold, robotic, or unprofessional | Adjust persona/tone in instructions |
| **Escalation Failure** | Didn't route sensitive topic | Expand escalation trigger phrases, add topic |
| **Tool Failure** | Action didn't execute correctly | Fix connector config, add error handling |
| **Latency Failure** | Response too slow | Simplify flow, reduce hops, optimize queries |

### Operationalize

| Task | Frequency | Tool |
|------|-----------|------|
| Run foundational eval | Every change | Agent Evaluation |
| Run full eval suite | Monthly / before releases | Agent Evaluation + Kit |
| Monitor production | Continuous | Built-in Analytics |
| Review escalations | Weekly | Conversation transcripts |

---

## Multi-Agent Framework

### Architecture

```
┌─────────────────────────────┐
│     ORCHESTRATOR AGENT      │  ← Users interact here
│   Routes to specialists     │
└──────────┬──────────────────┘
           │
    ┌──────┼──────┐
    ▼      ▼      ▼
┌───────┐┌───────┐┌───────┐
│ Child ││ Child ││ Child │  ← Own knowledge, tools
└───────┘└───────┘└───────┘
```

### Setup

1. **Child Agent:** Settings → Security → Enable "Allow other agents to connect" → Publish
2. **Orchestrator:** Agents tab → Add agent → Select child
3. **Reference:** Use `/AgentName` in orchestrator instructions

**Example Instructions:**
```
You help with sales tasks.

/PowerPlaysAgent - Sales strategies
/KYCAgent - Customer info from Salesforce
/CPQHowToAgent - Quoting guidance

Route based on user intent. Answer general questions directly.
```

### Child Agent vs Topic

| Use Child Agent | Use Topic |
|-----------------|-----------|
| Reusable across orchestrators | Simple deterministic flow |
| Needs own knowledge/tools | Quick response needed |
| Separate team owns it | Single-agent scenario |

### Considerations

- **Latency:** Each hop adds 1-2s. Keep child instructions focused.
- **Governance:** Match persona across all agents. Each needs DLP policies.
- **Testing:** Test children in isolation, then routing, then E2E scenarios.

---

## Knowledge Base (Researched)

*Last Updated: January 2025*

### Enterprise Connectors

| Connector | Status | Modes | Key Actions |
|-----------|--------|-------|-------------|
| **Salesforce** | GA, Premium | Knowledge, Tool, Graph Index | SOQL queries, CRUD, HTTP requests |
| **ServiceNow** | GA, Premium | Knowledge, Tool, Graph Index | KB articles, incidents, cases |
| **Azure SQL** | GA | Knowledge, Tool | Direct database queries |
| **Dataverse** | GA | Native | Full Power Platform integration |
| **SharePoint** | GA | Knowledge, Tool | Documents and lists |

**All connectors:** https://learn.microsoft.com/en-us/connectors/connector-reference

### Knowledge Source Types

| Type | Data Movement | Best For |
|------|---------------|----------|
| **Copilot Connectors** | Yes (indexed to Graph) | Semantic search, citations |
| **Power Platform Connectors** | No (real-time) | Live data, no replication |

**Decision:** Need semantic search → Copilot Connector. Need real-time/actions → Power Platform Connector.

### Adaptive Cards

| Channel | Max Version | Notes |
|---------|-------------|-------|
| Web Chat | 1.6 | No `Action.Execute` |
| Teams | 1.5 | Use for compatibility |

**Note:** Canvas shows "Empty AdaptiveCard" - this is expected. Cards render only in test chat.

```json
{
  "type": "AdaptiveCard",
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "version": "1.5",
  "body": [
    {"type": "TextBlock", "text": "Title", "weight": "Bolder", "size": "Large"}
  ],
  "actions": [
    {"type": "Action.Submit", "title": "Button", "data": {"action": "value"}}
  ]
}
```

### Feature Status (Jan 2025)

| Feature | Status |
|---------|--------|
| MCP Server Support | GA |
| Generative Orchestration | GA |
| Autonomous Agents (Event/Scheduled Triggers) | GA |
| Azure AI Search | GA |
| Agent-to-Agent Connections | Preview |
| GPT-5 Models | Preview |

### Monitoring Options

| Option | Status | Use Case |
|--------|--------|----------|
| **Built-in Analytics** | GA | Basic metrics, 30-day retention |
| **Application Insights** | GA | Custom queries, alerts, long retention |
| **A365 SDK** | Frontier Preview | Enterprise observability, OpenTelemetry |
| **Copilot Studio Kit** | Community | Testing framework, compliance tools |

---

## Error Handling

**When errors occur: STOP → RESEARCH → RETRY**

```
1. Don't retry the same approach
2. Research via MS Learn MCP:
   mcp__microsoft-learn__microsoft_docs_search(query="Copilot Studio [feature] [error]")
3. Document significant findings in Knowledge Base
4. Retry with researched approach
```

---

## Key Principles

1. **Eval-first development** - Define success criteria before building
2. **Never assume components** - Research first
3. **Present options** - Let user choose
4. **Build only what's needed** - Don't over-engineer
5. **Verify before building** - Confirm account/environment
6. **Research errors** - Don't blindly retry
7. **Iterate on failures** - Use failure analysis framework

---

## Quick Reference URLs

### Core
| Topic | URL |
|-------|-----|
| What's New | https://learn.microsoft.com/en-us/microsoft-copilot-studio/whats-new |
| Knowledge Sources | https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-copilot-studio |
| Agent Flows | https://learn.microsoft.com/en-us/microsoft-copilot-studio/flows-overview |
| Multi-Agent | https://learn.microsoft.com/en-us/microsoft-copilot-studio/advanced-use-agent-in-other-agents |
| Agent Evaluation | https://learn.microsoft.com/en-us/microsoft-copilot-studio/advanced-bot-evaluation |

### Connectors
| System | URL |
|--------|-----|
| Salesforce | https://learn.microsoft.com/en-us/connectors/salesforce |
| ServiceNow | https://learn.microsoft.com/en-us/connectors/service-now |
| All Connectors | https://learn.microsoft.com/en-us/connectors/connector-reference |

### Tools
| Tool | URL |
|------|-----|
| YAML Editor | https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/topics-code-editor |
| Adaptive Cards | https://learn.microsoft.com/en-us/microsoft-copilot-studio/adaptive-cards-overview |
| Copilot Studio Kit | https://github.com/microsoft/Power-Platform-Copilot-Studio-Kit |
