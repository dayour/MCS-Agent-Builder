# Architecture Scoring: Single vs Multi-Agent

## Pre-Gate: Solution Type Assessment

Before scoring single vs multi-agent, confirm the use case needs an agent at all.
See `knowledge/frameworks/solution-type-scoring.md` for the 5-factor assessment.

Only proceed to architecture scoring when `solutionType == "agent"` or `"hybrid"`.
If `solutionType` is `"flow"` or `"not-recommended"`, skip architecture scoring entirely.

## Architecture Types

| Type | When to Use |
|------|-------------|
| **Single Agent** | Score 0-2. All capabilities in one domain, shared data, one team. |
| **Multi-Agent** | Score 3+. Separate domains, isolated data, different teams, reusable specialists. |
| **Connected Agent** | External agent system (e.g., Azure AI Foundry agent) bridges into MCS via runtime connection. Not import — runtime bridge. |

## Scoring Matrix

| Factor | Single Agent (0 pts) | Multi-Agent (1 pt) |
|--------|---------------------|-------------------|
| **Domain** | All tasks in same domain | Truly separate domains |
| **Data sources** | Shared data across all capabilities | Different systems per capability |
| **Team ownership** | Same team owns everything | Different teams own different parts |
| **Reusability** | One-off agent | Specialists reusable by other orchestrators |
| **Instruction size** | Fits in 8000 chars | Would exceed 8000 chars per agent |
| **Knowledge isolation** | Same knowledge base | Each needs its own deep knowledge |

## Decision

- **Score 0-2** → Single Agent
- **Score 3+** → Multi-Agent
- **Connected Agent** → when bridging to an external agent system (independent of score)

## Required Output

The architecture section in `agentspec.json` MUST include:

### 1. `type` — Selected architecture type (kebab-case)
One of: `"single-agent"`, `"single-agent-with-connected-agents"`, `"multi-agent"`, `"connected-agent"` (legacy alias for single-agent-with-connected-agents)

- **single-agent**: Standalone, no child or connected agents
- **single-agent-with-connected-agents**: One main MCS agent + external agents (Fabric Data Agent, other MCS agents) it routes to. Use when the main agent connects to external agents but you don't build child agents in MCS. Top-level `connectedAgents[]` array describes each external agent.
- **multi-agent**: Parent orchestrator + child agents built in MCS. `architecture.children[]` describes each child.

### 2. `reason` — WHY this type was selected
2-4 sentences that:
- State the score and what it means
- Reference the key factors that drove the decision
- Explain why the other types were **ruled out**
- Reference the agent's specific context (not generic statements)

**Example (Single Agent):**
> "Score 0/6 — Single Agent. All five capabilities (link collection, classification, extraction, doc generation, distribution) serve a single news curation domain with shared data. Multi-Agent rejected: the pipeline stages share data and splitting would add routing latency with no quality gain. Connected Agent ruled out: no external agent system to bridge."

**Example (Multi-Agent):**
> "Score 4/6 — Multi-Agent. The incident management domain (ServiceNow integration, triage logic) is fully separate from the knowledge base domain (Confluence, SharePoint). Different teams own each domain, and the knowledge specialist is reusable by other orchestrators. Single Agent rejected: instructions would exceed 8K chars combining both domains, and knowledge isolation is critical for security."

### 3. `factors` — Per-factor scoring with reasoning
Each factor must include:
- `value`: true (Multi-Agent point) or false (Single Agent point)
- `reasoning`: 1-2 sentences explaining why, referencing the agent's **specific** capabilities, data, teams, and constraints

**Bad reasoning:** "Same domain" (too generic)
**Good reasoning:** "All capabilities (mailbox monitoring, extraction, tracker CRUD, ownership assignment, status queries) serve one domain: IT chargeback dispute management. No separate problem domains exist."

### 4. `score` — Count of true factors (0-6)

### 5. `children` — Child agents (Multi-Agent only)

## Multi-Agent Build Order

1. Build all specialist agents first (children before parent)
2. Publish each specialist (`pac copilot publish`)
3. Enable "Allow other agents to connect" on each specialist
4. Create orchestrator → set instructions with routing rules → connect children
5. Publish orchestrator
6. Generate evals.csv and run via Direct Line API

## Orchestrator Instructions Pattern

```
You are [Agent Name], a [description].
Your purpose is to [main function] by coordinating with specialist agents.

## Connected Specialists
/[SpecialistName1] - [When to use, what it handles]
/[SpecialistName2] - [When to use, what it handles]

## Routing Rules
- [Intent pattern] → /[SpecialistName]
- [General questions] → Answer directly
- [Unclear intent] → Ask clarifying question

## Response Guidelines
- Summarize specialist responses naturally
- Don't expose routing mechanics to users
- Maintain consistent tone
```

## Specialist Instructions Pattern

```
You are [Name], a specialist in [domain].

## Your Expertise
- [Area 1]

## Scope Limits
- [Handle]
- [Decline - return to orchestrator]
```
