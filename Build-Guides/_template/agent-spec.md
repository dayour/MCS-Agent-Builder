# Agent Spec: [Agent Name]

## Agent Role

| Attribute | Value |
|-----------|-------|
| **Role Type** | [ ] Orchestrator  [ ] Specialist  [ ] Standalone (Multi-Agent Ready) |
| **User-Facing** | Yes / No |
| **Reusable** | Yes / No (Can other orchestrators connect?) |
| **Parent Agent(s)** | [If specialist: which orchestrators call this agent] |
| **Child Agent(s)** | [If orchestrator: which specialists this agent routes to] |

---

## Objective
[One-paragraph description of the agent's purpose and value proposition.]

## Instructions
[The system prompt/instructions that define the agent's personality, behavior, and guidelines.]

**For Orchestrator:**
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

### Context Handoff

| Context Element | Pass to Specialist? | How |
|-----------------|---------------------|-----|
| User identity | Yes / No | [Method - e.g., System variable] |
| Conversation history | Yes / No | [Method - e.g., Summary in prompt] |
| Previous specialist response | Yes / No | [Method] |
| User-provided entities | Yes / No | [Method - e.g., Variables] |

### Response Integration

| Specialist Response Type | Orchestrator Behavior |
|--------------------------|----------------------|
| Complete answer | Pass through with light framing |
| Partial answer | Add context, ask follow-up if needed |
| "I don't know" | Try alternative specialist or handle directly |
| Error | Graceful fallback message, don't expose error |
| Action confirmation | Summarize what was done |

---

## User Flows

Define each distinct user interaction path:

### Flow 1: [Flow Name]
```
User: "[Example trigger]"
  ↓
Agent: [What agent does]
  ↓
User: [User action]
  ↓
Agent: [Next action]
  ↓
Outcome: [Final result]
```

### Flow 2: [Flow Name]
```
User: "[Example trigger]"
  ↓
...
```

---

## Requirements Analysis

### Data Requirements
| Requirement | Persists? | User-specific? | Notes |
|-------------|-----------|----------------|-------|
| [e.g., Task progress] | Yes/No | Yes/No | [Details] |

### Integration Requirements
| Requirement | External System | Notes |
|-------------|-----------------|-------|
| [e.g., Send emails] | [System] | [Details] |

### Conversation Requirements
| Requirement | Type | Notes |
|-------------|------|-------|
| [e.g., Checklist display] | [UI/Dialog/Q&A] | [Details] |

---

## Selected Components

**Note:** Components should be determined through analysis, not assumed. Document what was selected and why.

### [Component Category 1, if needed]
| Component | Purpose | Why Selected |
|-----------|---------|--------------|
| [Name] | [What it does] | [Reasoning] |

### [Component Category 2, if needed]
| Component | Purpose | Why Selected |
|-----------|---------|--------------|
| [Name] | [What it does] | [Reasoning] |

---

## Implementation Details

**Only document details for selected components.**

### [If Topics selected]

#### Topic: [Topic Name]
- **Trigger phrases:** "[phrase 1]", "[phrase 2]", "[phrase 3]"
- **Purpose:** [What this topic accomplishes]
- **Conversation flow:**
  1. [Node 1]: [Description]
  2. [Node 2]: [Description]
- **Variables used:** [List]
- **Calls flow:** [Yes/No - which]
- **Uses Adaptive Card:** [Yes/No - which]

### [If Adaptive Cards selected]

#### Card: [Card Name]
- **Purpose:** [What this card displays/collects]
- **Used in:** [Topic name]
- **Elements:** [Brief description]
- **Outputs:** [Variables set when submitted]

### [If Flows selected (Agent or Power Automate)]

#### Flow: [Flow Name]
- **Type:** [Agent Flow / Power Automate]
- **Trigger:** [How it's triggered]
- **Purpose:** [What this flow does]
- **Inputs:** [List]
- **Actions:** [Brief description]
- **Outputs:** [List]

### [If Data persistence selected]

#### Table: [Table Name]
- **Purpose:** [What this table stores]
- **Columns:**
  | Column | Type | Description |
  |--------|------|-------------|
  | [Name] | [Type] | [Details] |

### [If Knowledge Sources selected]

#### Knowledge: [Source Name]
- **Type:** [SharePoint/OneDrive/Dataverse/Files/Website]
- **Location:** [URL or description]
- **Purpose:** [What it provides]

### [If WorkIQ MCP selected for M365 data]

#### MCP: WorkIQ
- **Status:** Public Preview
- **Prerequisites:**
  - [ ] Customer has M365 Copilot licenses for agent users
  - [ ] Admin consent granted for WorkIQ app
  - [ ] EULA accepted
- **Data Access:**
  | Data Type | Enabled | Example Queries |
  |-----------|---------|-----------------|
  | Emails | Yes/No | "Find emails about [topic]" |
  | Documents | Yes/No | "Find documents about [topic]" |
  | Meetings | Yes/No | "What meetings discussed [topic]" |
  | Teams Messages | Yes/No | "Summarize messages in [channel]" |
  | People | Yes/No | "Who works on [project]" |
- **Why WorkIQ over traditional connectors:** [Reasoning - e.g., "Unified access, simplified architecture"]
- **Fallback plan (if Preview issues):** [e.g., "Switch to SharePoint + Outlook connectors"]

---

## Sample Interactions

### Interaction 1: [Scenario Name]
**User:** "[Example prompt]"
**Agent:** [Expected response]

### Interaction 2: [Scenario Name]
**User:** "[Example prompt]"
**Agent:** [Expected response]

---

## Error Handling

| Scenario | Response |
|----------|----------|
| [Error case] | [How agent handles it] |

---

## Build Checklist

### Pre-Build
- [ ] Use case analyzed
- [ ] Domain decomposition completed
- [ ] Agent role defined (Orchestrator / Specialist / Standalone)
- [ ] Components selected with user
- [ ] Spec reviewed

### Build - Specialist Agent
- [ ] Agent created (name, description, instructions)
- [ ] [If selected] Knowledge sources added (specialist-specific)
- [ ] [If selected] Data tables created
- [ ] [If selected] Flows created (specialist-specific integrations)
- [ ] [If selected] Topics created
- [ ] Security: "Allow other agents to connect" enabled
- [ ] Tested in isolation
- [ ] Published

### Build - Orchestrator Agent
- [ ] All specialist agents built and published first
- [ ] Orchestrator created (name, description, instructions)
- [ ] Child agents connected (Agents tab → Add agent)
- [ ] Routing logic configured in Instructions
- [ ] [If selected] Orchestrator-level knowledge added
- [ ] [If selected] Fallback topics created
- [ ] Routing tested to each specialist
- [ ] Published

### Build - Standalone Agent (Multi-Agent Ready)
- [ ] Agent created (name, description, instructions)
- [ ] [If selected] Knowledge sources added
- [ ] [If selected] Data tables created
- [ ] [If selected] Flows created
- [ ] [If selected] Topics created
- [ ] [If selected] Triggers configured
- [ ] Future decomposition points documented
- [ ] Published

### Test
- [ ] [If multi-agent] Level 1: Specialist unit tests passed
- [ ] [If multi-agent] Level 2: Routing tests passed
- [ ] Level 3: End-to-end scenarios validated
- [ ] Error scenarios verified
- [ ] Foundational eval set passed (100%)

### Deploy
- [ ] User sign-off obtained
- [ ] All agents published (specialists first, then orchestrator)
- [ ] Documentation complete
