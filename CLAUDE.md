# Claude Code Instructions for MCS Automation

## Overview

Automate Microsoft Copilot Studio (MCS) agent creation using Claude Code with Playwright MCP. You (Claude) research capabilities, analyze use cases, recommend components, and execute UI automation.

**CRITICAL: Never assume components. Every use case is different. Research first, recommend based on requirements.**

---

## MCP Tools Available

| MCP Server | Purpose | When to Use |
|------------|---------|-------------|
| **Playwright** | Browser automation | Build agents in Copilot Studio UI |
| **Microsoft Learn** | Documentation research | Research MCS capabilities, connectors |
| **WorkIQ** | M365 data access (Preview) | Find customer context (emails, docs, meetings) during live builds |

### WorkIQ MCP (Live Meeting Support)

WorkIQ connects to the user's Microsoft 365 Copilot data. Use during live meetings to:

```
# Find customer context
"What emails do I have from [customer] about [project]?"
"Find documents about [topic] I worked on recently"
"What was discussed in meetings about [subject]?"
"Who is working on [project]?"

# Find existing content for agent knowledge sources
"What SharePoint sites have [domain] documentation?"
"Find recent documents about [process/policy]"
```

**Requirements:** M365 Copilot license, Admin consent, EULA accepted (`workiq accept-eula`)

**Note:** WorkIQ is in PUBLIC PREVIEW. For production agents, evaluate stability before recommending as agent's MCP.

---

## Core Philosophy: Multi-Agent First

**The future of enterprise agents is multi-agent architecture.** Every solution should be designed with orchestrator + specialist agents as the default pattern.

### Why Multi-Agent First?

| Benefit | Description |
|---------|-------------|
| **Reusability** | Specialist agents can serve multiple orchestrators |
| **Maintainability** | Update one specialist without touching others |
| **Scalability** | Add new specialists as needs grow |
| **Team Ownership** | Different teams can own different specialists |
| **Focused Excellence** | Each agent does one thing extremely well |
| **Easier Testing** | Test specialists in isolation, then integration |

### The Question to Always Ask

> **"What specialist domains does this problem require?"**

NOT: "Should we use multi-agent?"
BUT: "How do we decompose this into specialists?"

Even a "simple" agent should be designed as a potential:
- **Orchestrator** that might connect to specialists later
- **Specialist** that might be called by orchestrators later

---

## Workflow Phases

```
PREREQUISITES → PHASE 0: Decomposition → PHASE 1: Architecture → PHASE 2: Build → PHASE 3: Validate
     ↓                    ↓                        ↓                    ↓                ↓
  Mission,           Domain analysis,         Component           Build &          Full eval,
  Scenarios,         specialist IDs,          selection,          iterate on       operationalize
  Dimensions         eval design              approval            eval failures
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

### 5. Domain Decomposition (Multi-Agent Analysis)

**Every use case must identify potential specialist domains:**

| Question | Purpose |
|----------|---------|
| What distinct knowledge domains are needed? | Identify knowledge specialists |
| What different systems need to be accessed? | Identify integration specialists |
| What skills require deep expertise? | Identify skill specialists |
| What could be reused by other agents? | Identify reusable specialists |
| What needs separate governance/ownership? | Identify team-owned specialists |

**Output:** List of potential specialist agents with their responsibilities

```markdown
## Specialist Domains (Proposed)

| Domain | Responsibility | Knowledge/Tools | Reusable? |
|--------|---------------|-----------------|-----------|
| [Domain 1] | [What it handles] | [Data sources, APIs] | Yes/No |
| [Domain 2] | [What it handles] | [Data sources, APIs] | Yes/No |
| Orchestrator | Routes & coordinates | General guidance | N/A |
```

**Decision Point:** Even if starting with a single agent, document:
- Which domains COULD become specialists later
- How the agent would split if scaled

---

## PHASE 0: Decomposition & Evaluation Design

**Decompose into specialists and create eval set BEFORE building anything.**

### Step 1: Finalize Domain Decomposition

Review the specialist domains from Prerequisites and decide:

| Decision | When to Choose |
|----------|----------------|
| **Multi-Agent Now** | 2+ distinct knowledge domains, different data sources, reusable components, separate team ownership |
| **Single Agent (Multi-Agent Ready)** | Simple scope, but design for future decomposition |

**For Multi-Agent Architecture:**
```markdown
## Agent Architecture

### Orchestrator: [Name]
- **Role:** User-facing, routes to specialists, handles general queries
- **Owns:** Conversation flow, context management, general guidance
- **Routes to:** [List specialist agents]

### Specialist: [Name]
- **Role:** Deep expertise in [domain]
- **Owns:** [Knowledge sources], [integrations], [specific skills]
- **Called by:** Orchestrator (and potentially other orchestrators)

### Specialist: [Name]
- **Role:** Deep expertise in [domain]
- **Owns:** [Knowledge sources], [integrations], [specific skills]
- **Called by:** Orchestrator (and potentially other orchestrators)
```

### Step 2: Create evaluation.md

Use the template at `Build-Guides/_template/evaluation.md`:
- 2-3 test cases per scenario = 15-25 foundational cases
- Define acceptance criteria per test case
- **Include routing tests for multi-agent scenarios**

### Step 3: Define Acceptance Criteria

Each test case needs four criteria types:

| Criteria | Description | Example |
|----------|-------------|---------|
| **Content** | What MUST be present | "Must include policy number and deadline" |
| **Constraints** | What must NOT happen | "Must not disclose internal pricing logic" |
| **Quality** | Tone, style, empathy | "Professional, empathetic for complaints" |
| **Behavior** | Actions, routing, escalation | "Must route to KYC specialist for customer lookup" |

**For Multi-Agent, add Routing Criteria:**

| Routing Criteria | Description | Example |
|------------------|-------------|---------|
| **Correct Specialist** | Query routed to right agent | "Sales questions → Sales Specialist" |
| **Context Handoff** | Relevant context passed | "Customer ID and intent passed to specialist" |
| **Return Flow** | Specialist response integrated | "Orchestrator summarizes specialist answer" |
| **Fallback** | Graceful handling if specialist unavailable | "Apologize and offer alternative" |

### Step 4: Research MCS Capabilities

1. **Check Knowledge Base below first** - Avoid redundant research
2. **Research via MS Learn MCP:**
   ```
   mcp__microsoft-learn__microsoft_docs_search(query="Copilot Studio [topic]")
   mcp__microsoft-learn__microsoft_docs_fetch(url="[doc URL]")
   ```
3. **For connectors:** `https://learn.microsoft.com/en-us/connectors/[name]`
4. **Check preview vs GA:** Search "Copilot Studio what's new 2024 2025"

### Step 5: Map Eval Requirements → MCS Components

Based on eval criteria, identify required capabilities:

| Eval Requirement | Likely MCS Component |
|------------------|----------------------|
| Answer from documents | Knowledge Sources |
| Execute actions | Agent Flows, Connectors |
| Structured data collection | Topics with Adaptive Cards |
| **Route to specialists** | **Child Agents (Multi-Agent)** |
| Real-time external data | Power Platform Connectors |
| **Reusable domain expertise** | **Specialist Child Agent** |

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

### Build Order (Multi-Agent First)

**For Multi-Agent Architecture (Recommended):**

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: Build Specialists (Children First)                │
├─────────────────────────────────────────────────────────────┤
│  For EACH specialist agent:                                 │
│  1. Create Specialist Agent (name, description, instructions)│
│  2. Add Knowledge Sources (specialist-specific)             │
│  3. Create Flows (specialist-specific integrations)         │
│  4. Create Topics (if deterministic flows needed)           │
│  5. Enable "Allow other agents to connect" in Security      │
│  6. Test specialist in isolation                            │
│  7. Publish specialist                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: Build Orchestrator                                │
├─────────────────────────────────────────────────────────────┤
│  1. Create Orchestrator Agent (user-facing)                 │
│  2. Connect Child Agents (Agents tab → Add agent)           │
│  3. Configure routing in Instructions (/AgentName syntax)   │
│  4. Add orchestrator-level Knowledge (if any)               │
│  5. Create fallback Topics (if needed)                      │
│  6. Test routing to each specialist                         │
│  7. Run full eval set (E2E)                                 │
│  8. Iterate on failures                                     │
│  9. Publish orchestrator                                    │
└─────────────────────────────────────────────────────────────┘
```

**For Single Agent (Multi-Agent Ready):**

1. Create Agent (name, description, instructions)
2. Add Knowledge Sources
3. [If needed] Create Dataverse Tables
4. [If needed] Create Flows
5. [If needed] Create Topics
6. [If needed] Configure Triggers
7. **Document future decomposition points** (where specialists could be carved out)
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

## Multi-Agent Framework (Primary Architecture Pattern)

> **This is the DEFAULT architecture for enterprise agents. Design multi-agent first.**

### Architecture Patterns

**Pattern 1: Hub & Spoke (Most Common)**
```
                    ┌─────────────────────────────┐
                    │     ORCHESTRATOR AGENT      │  ← Users interact here
                    │   Routes to specialists     │
                    └──────────┬──────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │  Knowledge  │     │ Integration │     │   Process   │
    │  Specialist │     │  Specialist │     │  Specialist │
    └─────────────┘     └─────────────┘     └─────────────┘
    (Documents, FAQ)    (CRM, ERP APIs)     (Workflows, approvals)
```

**Pattern 2: Layered Orchestration (Complex Domains)**
```
    ┌─────────────────────────────┐
    │    PRIMARY ORCHESTRATOR     │  ← Entry point
    └──────────┬──────────────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
┌─────────────┐ ┌─────────────┐
│  Domain A   │ │  Domain B   │  ← Domain orchestrators
│ Orchestrator│ │ Orchestrator│
└──────┬──────┘ └──────┬──────┘
       │               │
   ┌───┴───┐       ┌───┴───┐
   ▼       ▼       ▼       ▼
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│Spec1│ │Spec2│ │Spec3│ │Spec4│  ← Leaf specialists
└─────┘ └─────┘ └─────┘ └─────┘
```

**Pattern 3: Shared Specialists (Enterprise Reuse)**
```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ Orchestrator A│     │ Orchestrator B│     │ Orchestrator C│
│   (Sales)     │     │   (Support)   │     │   (HR)        │
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
                    ┌─────────────────┐
                    │  Shared KYC     │  ← Reusable specialist
                    │  Specialist     │     (customer lookup)
                    └─────────────────┘
```

### Specialist Types

| Type | Responsibility | Examples |
|------|---------------|----------|
| **Knowledge Specialist** | Answer questions from specific data sources | Policy Bot, FAQ Bot, Documentation Agent |
| **Integration Specialist** | Execute actions in external systems | CRM Agent, ERP Agent, Ticketing Agent |
| **Process Specialist** | Guide through multi-step workflows | Onboarding Agent, Approval Agent |
| **Analytics Specialist** | Retrieve and summarize data | Reporting Agent, Dashboard Agent |

### Setup (Step-by-Step)

**1. Create Specialist (Child) Agent:**
```
Create → New agent → Configure:
- Name: [Specialist Name] (e.g., "KYC Specialist")
- Description: Clear statement of what this specialist does
- Instructions: Focused on specialist's domain only
```

**2. Enable Agent Sharing:**
```
Settings → Security → Enable "Allow other agents to connect" → Save → Publish
```

**3. Create Orchestrator:**
```
Create → New agent → Configure:
- Name: [User-Facing Name] (e.g., "Sales Assistant")
- Description: What users see
- Instructions: Routing logic + general guidance
```

**4. Connect Specialists:**
```
Orchestrator → Agents tab → Add agent → Select published specialist → Save
```

**5. Configure Routing in Instructions:**
```
You are a Sales Assistant helping the sales team.

## Connected Specialists
/KYCAgent - Use for customer lookups, account info, contact details
/QuotingAgent - Use for pricing, quotes, CPQ guidance
/CompetitorIntelAgent - Use for competitor analysis, battle cards

## Routing Rules
- Customer questions → /KYCAgent
- Pricing/quote questions → /QuotingAgent
- "How do we compete with X?" → /CompetitorIntelAgent
- General sales questions → Answer directly from your knowledge
- Unclear intent → Ask clarifying question before routing

## Response Style
After receiving specialist response, summarize for the user naturally.
Don't expose internal routing mechanics to the user.
```

### When to Use Child Agent vs Topic

| Criteria | → Child Agent | → Topic |
|----------|---------------|---------|
| **Reusability** | Used by multiple orchestrators | Single orchestrator only |
| **Knowledge** | Has its own knowledge sources | Uses orchestrator's knowledge |
| **Complexity** | Complex domain logic | Simple deterministic flow |
| **Ownership** | Different team maintains it | Same team maintains |
| **Updates** | Changes independently | Changes with orchestrator |
| **Testing** | Tested in isolation | Tested with orchestrator |
| **Latency tolerance** | Can accept 1-2s per hop | Needs instant response |

### Design Principles

1. **Specialists should be independently useful** - Each specialist should work standalone
2. **Orchestrator owns the conversation** - User experience is orchestrator's job
3. **Specialists own the expertise** - Deep knowledge lives in specialists
4. **Route by intent, not keywords** - Use semantic understanding for routing
5. **Context flows down** - Orchestrator passes relevant context to specialists
6. **Summaries flow up** - Orchestrator may reframe specialist responses

### Performance Considerations

| Factor | Impact | Mitigation |
|--------|--------|------------|
| **Latency** | Each hop adds 1-2s | Keep specialist chains short (max 2 hops) |
| **Token usage** | Context passed between agents | Pass only necessary context |
| **Consistency** | Different personas confuse users | Align tone/style across all agents |

### Governance Considerations

| Aspect | Requirement |
|--------|-------------|
| **DLP Policies** | Each agent needs appropriate policies |
| **Access Control** | Specialists may need different permissions than orchestrator |
| **Audit** | Log which specialist handled each query |
| **Testing** | Test specialists in isolation → test routing → test E2E |
| **Versioning** | Coordinate releases when specialists change contracts |

### Testing Strategy

```
┌────────────────────────────────────────────────────────────┐
│ Level 1: Specialist Unit Tests                             │
│ - Test each specialist in isolation                        │
│ - Verify knowledge retrieval, tool execution               │
│ - No orchestrator involved                                 │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│ Level 2: Routing Tests                                     │
│ - Test orchestrator routes to correct specialist           │
│ - Verify context handoff                                   │
│ - Test fallback when specialist unavailable                │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│ Level 3: End-to-End Tests                                  │
│ - Test complete user scenarios                             │
│ - Verify response quality after routing                    │
│ - Test multi-turn conversations with specialist switches   │
└────────────────────────────────────────────────────────────┘
```

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
| **WorkIQ MCP** | No (real-time, Preview) | Unified M365 access via natural language |

**Decision Tree:**
- Need semantic search with citations → Copilot Connector
- Need real-time data/actions → Power Platform Connector
- Customer has M365 Copilot + wants simplified architecture → Consider WorkIQ MCP

### WorkIQ MCP for Agents (Preview)

**What it provides:** Single MCP for emails, documents, meetings, Teams messages, people data

| Advantage | Consideration |
|-----------|---------------|
| Single integration vs 5+ connectors | Public Preview (not GA) |
| Natural language queries | Requires M365 Copilot license per user |
| Respects user permissions | Requires admin consent |
| No connector configuration | May have different latency than native connectors |

**When to recommend WorkIQ MCP for agents:**
- Customer has M365 Copilot licenses for all agent users
- Agent needs access to multiple M365 data types (email + docs + calendar)
- Simplified architecture is priority
- Customer accepts Preview status

**When to use traditional connectors:**
- No M365 Copilot licenses
- Production stability required
- Only need one data type (e.g., just SharePoint docs)
- Customer requires GA features only

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

### Feature Status (Feb 2025)

| Feature | Status |
|---------|--------|
| MCP Server Support | GA |
| Generative Orchestration | GA |
| Autonomous Agents (Event/Scheduled Triggers) | GA |
| Azure AI Search | GA |
| Agent-to-Agent Connections | Preview |
| GPT-5 Models | Preview |
| WorkIQ MCP (M365 Data Access) | Public Preview |

### Monitoring Options

| Option | Status | Use Case |
|--------|--------|----------|
| **Built-in Analytics** | GA | Basic metrics, 30-day retention |
| **Application Insights** | GA | Custom queries, alerts, long retention |
| **A365 SDK** | Frontier Preview | Enterprise observability, OpenTelemetry |
| **Copilot Studio Kit** | Community | Testing framework, compliance tools |

---

## Live Meeting Workflow

**For building/iterating agents during customer meetings:**

### Pre-Meeting Prep
```
1. Open Copilot Studio, confirm environment
2. Have Build-Guides/[Customer]/ folder ready
3. WorkIQ authenticated (workiq accept-eula if first time)
```

### During Meeting Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  CUSTOMER DESCRIBES REQUIREMENT                                     │
├─────────────────────────────────────────────────────────────────────┤
│  → Capture in usecase.md (real-time)                                │
│  → If unclear: Ask clarifying questions                             │
│  → If mentions existing docs: Use WorkIQ to find them               │
│     "Find documents about [topic] from [customer domain]"           │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│  RAPID DOMAIN DECOMPOSITION                                         │
├─────────────────────────────────────────────────────────────────────┤
│  → Identify specialists needed (verbally confirm with customer)     │
│  → "I'm thinking we need: [Specialist A] for X, [Specialist B] for Y│
│     Does that match how your team thinks about this?"               │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│  LIVE BUILD (Share screen)                                          │
├─────────────────────────────────────────────────────────────────────┤
│  → Build first specialist or orchestrator                           │
│  → Show customer the agent in Test Chat                             │
│  → Get immediate feedback                                           │
│  → Iterate instructions/knowledge based on feedback                 │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│  KNOWLEDGE SOURCE DECISION                                          │
├─────────────────────────────────────────────────────────────────────┤
│  Ask customer:                                                      │
│  - "Does your team have M365 Copilot licenses?"                     │
│                                                                     │
│  If YES → Consider WorkIQ MCP for agent (single integration)        │
│  If NO  → Use traditional connectors (SharePoint, Outlook, etc.)    │
└─────────────────────────────────────────────────────────────────────┘
```

### WorkIQ Queries During Meetings

| Customer Says | WorkIQ Query |
|---------------|--------------|
| "We have docs about this process" | "Find documents about [process] from [timeframe]" |
| "Sarah sent requirements last week" | "What emails from Sarah about [topic]?" |
| "We discussed this in the kickoff" | "What was discussed in meetings about [topic]?" |
| "The IT team handles that" | "Who in the organization works on [domain]?" |
| "Check the SharePoint site" | "What SharePoint sites have [topic] documentation?" |

### Post-Meeting
```
1. Save usecase.md with captured requirements
2. Document architecture decisions in agent-spec.md
3. Note any WorkIQ-discovered sources for agent knowledge
4. Schedule follow-up for eval design (if not done live)
```

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

1. **Multi-agent first** - Decompose into specialists before building; design for composition
2. **Eval-first development** - Define success criteria before building
3. **Never assume components** - Research first
4. **Present options** - Let user choose
5. **Build specialists first** - Children before orchestrator; test in isolation
6. **Build only what's needed** - Don't over-engineer
7. **Verify before building** - Confirm account/environment
8. **Research errors** - Don't blindly retry
9. **Iterate on failures** - Use failure analysis framework

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
| WorkIQ MCP (Preview) | https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/workiq-overview |
| WorkIQ GitHub | https://github.com/microsoft/work-iq-mcp |
