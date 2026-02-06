# Agent Spec: [Agent Name]

## Architecture Decision

| Factor | Assessment | Score |
|--------|-----------|-------|
| **Domain** | [Same domain or separate domains?] | 0 or 1 |
| **Data sources** | [Shared or different systems?] | 0 or 1 |
| **Team ownership** | [Same team or different teams?] | 0 or 1 |
| **Reusability** | [One-off or reusable specialists?] | 0 or 1 |
| **Instruction size** | [Fits 8000 chars or exceeds?] | 0 or 1 |
| **Knowledge isolation** | [Shared KB or separate deep KBs?] | 0 or 1 |
| **Total** | | **X/6** |

**Decision:** [ ] Single Agent (score 0-2) / [ ] Multi-Agent (score 3+)

## Agent Role

| Attribute | Value |
|-----------|-------|
| **Role Type** | [ ] Standalone (Single Agent) / [ ] Orchestrator / [ ] Specialist |
| **User-Facing** | Yes / No |
| **Reusable** | Yes / No (Can other orchestrators connect?) |
| **Parent Agent(s)** | [If specialist: which orchestrators call this agent] |
| **Child Agent(s)** | [If orchestrator: which specialists this agent routes to] |

---

## Objective
[One-paragraph description of the agent's purpose and value proposition.]

## Instructions
[The system prompt/instructions that define the agent's personality, behavior, and guidelines.]

**For Standalone (Single Agent) — DEFAULT:**
```
You are [Agent Name], an AI assistant that [primary purpose].

## Your Capabilities
- [Capability 1]
- [Capability 2]
- [Capability 3]

## How You Work
- [Guideline 1]
- [Guideline 2]
- [Guideline 3]

## Response Guidelines
- [Tone and format instructions]
- [When to use tables, lists, etc.]
- [Confirmation requirements before actions]

## Boundaries — You must ALWAYS enforce these:
- DECLINE [what to decline] → [what to say instead]
- REFUSE [what to refuse] → [redirect where]
- NEVER [hard constraint]
- ALWAYS [required behavior]
```

**For Orchestrator (Multi-Agent only):**
```
You are [Agent Name], a [description].
Your purpose is to [main function] by coordinating with specialist agents.

## Connected Specialists
/[SpecialistName1] - [When to use, what it handles]
/[SpecialistName2] - [When to use, what it handles]
/[SpecialistName3] - [When to use, what it handles]

## Routing Rules
- [Intent pattern] → /[SpecialistName]
- [Intent pattern] → /[SpecialistName]
- [General questions] → Answer directly
- [Unclear intent] → Ask clarifying question

## Response Guidelines
- Summarize specialist responses naturally for the user
- Don't expose routing mechanics to users
- Maintain consistent tone across all interactions

You must NOT:
- [Restriction 1]
- [Restriction 2]
```

**For Specialist:**
```
You are [Agent Name], a specialist in [domain].
Your purpose is to [specific function].

## Your Expertise
- [Domain area 1]
- [Domain area 2]
- [Domain area 3]

## Guidelines
- [Guideline 1]
- [Guideline 2]
- Be concise - orchestrator will contextualize your response

## Scope Limits
- [What to handle]
- [What to decline - return to orchestrator]

You must NOT:
- [Restriction 1]
- [Restriction 2]
```

## Personas
- **Primary:** [Target user] - [Their needs]
- **Secondary:** [Target user] - [Their needs]

---

## Multi-Agent Architecture (If applicable)

*Complete this section if this is an orchestrator or part of a multi-agent system.*

### System Overview
```
[Draw the architecture - example below]

                    ┌─────────────────────────────┐
                    │     [Orchestrator Name]     │
                    │         (This Agent)        │
                    └──────────┬──────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │ [Specialist │     │ [Specialist │     │ [Specialist │
    │    Name]    │     │    Name]    │     │    Name]    │
    └─────────────┘     └─────────────┘     └─────────────┘
```

### Connected Agents

| Agent Name | Role | Routing Trigger | What It Returns |
|------------|------|-----------------|-----------------|
| /[Name] | [Specialist type] | [When to route - intent/keywords] | [Expected response type] |
| /[Name] | [Specialist type] | [When to route - intent/keywords] | [Expected response type] |
| /[Name] | [Specialist type] | [When to route - intent/keywords] | [Expected response type] |

### Routing Strategy

| Priority | Intent Pattern | Route To | Fallback |
|----------|---------------|----------|----------|
| 1 | [High-confidence match for Specialist A] | /SpecialistA | - |
| 2 | [High-confidence match for Specialist B] | /SpecialistB | - |
| 3 | [Ambiguous between A and B] | Ask clarifying question | /SpecialistA |
| 4 | [General query, no specialist needed] | Handle directly | - |
| 5 | [Unknown/out of scope] | Decline gracefully | - |

---

## Selected Components

**Note:** Components MUST be determined through analysis of ALL available options (see CLAUDE.md Component Selection). Never assume. For each capability, evaluate MCP servers, standard connectors, Computer Use, Power Automate, third-party connectors, and custom code. Document what was considered and why each was selected or rejected.

**IMPORTANT: MCP servers are PREFERRED over individual connector actions.** When a connector has an MCP server available (Outlook, Teams, SharePoint), use the MCP. It gives the agent the full operation set through a single tool.

### Model
| Model | Recommendation | Why |
|-------|---------------|-----|
| [GPT-4.1 / GPT-4.1 mini / GPT-5 Chat / GPT-5 Reasoning] | [Selected] | [Rationale based on complexity] |

### Knowledge Sources
| Component | Purpose | Why Selected | Status |
|-----------|---------|--------------|--------|
| [Name] | [What it does] | [Reasoning] | Ready / Needs setup / Blocked |

### Tools — MCP Servers (preferred over individual connector actions)
| Component | Purpose | Why Selected | Status |
|-----------|---------|--------------|--------|
| [MCP Name] | [What operations it provides] | [Reasoning] | Ready / Needs setup / Blocked |

### Tools — Connectors (only when no MCP available)
| Component | Purpose | Why Selected | Status |
|-----------|---------|--------------|--------|
| [Name] | [What it does] | [Reasoning] | Ready / Needs setup / Blocked |

### Computer Use Tools (if applicable)
| Tool Name | Task | Instructions Summary | Machine Type | Status |
|-----------|------|---------------------|-------------|--------|
| [Name] | [What desktop/web task it automates] | [Brief description of steps] | Hosted / BYO | Ready / Needs setup |

### Power Automate Flows (if applicable)
| Flow Name | Purpose | Trigger | Status |
|-----------|---------|---------|--------|
| [Name] | [What it automates] | [Recurrence / Event / Manual] | Ready / Needs build |

### Component Decisions Log
*For each major capability, document what options were evaluated:*

| Capability | Options Considered | Selected | Rationale |
|------------|-------------------|----------|-----------|
| [e.g., Deck assembly] | [e.g., Computer Use, Encodian, Azure Function, Graph API] | [e.g., Computer Use] | [e.g., No API exists for PPT manipulation; monthly frequency makes credit cost acceptable; no third-party dependency] |

---

## Build Checklist

### Pre-Build
- [ ] Use case analyzed
- [ ] Architecture scored (Single Agent default, Multi-Agent only if 3+/6)
- [ ] Agent role defined (Standalone / Orchestrator / Specialist)
- [ ] Components selected
- [ ] Spec reviewed

### Build - Standalone Agent (DEFAULT — use `/mcs-build-agent`)
- [ ] Agent created (name, description)
- [ ] Best model selected
- [ ] Instructions configured
- [ ] Knowledge sources added (if any)
- [ ] Tools added (if any)
- [ ] Published
- [ ] Evals generated and uploaded

### Build - Multi-Agent (only if score 3+/6)

**Specialist Agents (use `/mcs-build-specialist` for each):**
- [ ] Each specialist created, configured, published
- [ ] "Allow other agents to connect" enabled on each

**Orchestrator (use `/mcs-build-orchestrator`):**
- [ ] All specialists published first
- [ ] Orchestrator created (name, description, instructions with routing)
- [ ] Child agents connected
- [ ] Published
