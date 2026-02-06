---
name: mcs-architect
description: Design MCS agent architecture with component recommendations. Researches options and presents choices - never assumes.
---

# MCS Architecture Designer

Analyze requirements (SDR, pasted content, or usecase.md) and produce a build-ready agent-spec.md.

## Input

Provide project name or path:
- `/mcs-architect ProjectName` → reads from `Build-Guides/ProjectName/`
- `/mcs-architect path/to/file.md` → reads specified file

## Process

### Step 1: Detect Input Source

Check `Build-Guides/[ProjectName]/` for:
1. **SDR files** (`.md` converted from `.docx`, or raw `.md` with SDR structure) → Extract from SDR
2. **usecase.md** → Extract from usecase
3. **agent-spec.md already exists** → Review and enhance
4. **Nothing useful** → Ask user to paste requirements or describe the agent

### Step 2: Extract Requirements

**From SDR, extract:**

| Field | Where in SDR | Map To |
|-------|-------------|--------|
| Agent name & description | Title / opportunity scope | Identity section |
| Problem statement | "What is the problem" | Objective section |
| Personas | "Key personas" | Personas section |
| User prompts + expected results | "User Prompts" table | Scenarios section |
| Autonomous triggers | "Autonomous Agent" table | Scenarios section |
| Data sources (read) | "Knowledge / data sources" table | Knowledge Sources |
| Actions (write) | "Actions" table | Tools/Connectors |
| Solution approach | "Solution ideas" | Architecture notes |
| Dependencies/blockers | "Dependencies" | MVP Scoping |
| Key contacts | "Key personnel" | Contacts |

**From usecase.md, extract:**
- Core mission, scope boundaries, key scenarios, domain decomposition

### Step 3: Architecture Decision

Score single vs multi-agent:

| Factor | Single Agent (0 pts) | Multi-Agent (1 pt) |
|--------|---------------------|-------------------|
| **Domain** | All tasks in same domain | Truly separate domains |
| **Data sources** | Shared data across all capabilities | Different systems per capability |
| **Team ownership** | Same team owns everything | Different teams own different parts |
| **Reusability** | One-off agent | Specialists reusable by other orchestrators |
| **Instruction size** | Fits in 8000 chars | Would exceed 8000 chars per agent |
| **Knowledge isolation** | Same knowledge base | Each needs its own deep knowledge |

**Score: 0-2 → Single Agent | 3+ → Multi-Agent**

Present the score with rationale.

### Step 4: MVP Scoping

Analyze dependencies and categorize:

```markdown
## MVP (Build Now)
- [Capabilities with available connectors/data]

## Phase 2 (Build Later)
- [Capabilities blocked by dependencies]

## Blockers to Resolve
- [Missing connectors, undefined rules, TBD items]
```

### Step 5: Gap Analysis

Flag anything missing that blocks a build:

| Required | Status | Action |
|----------|--------|--------|
| Scope boundaries (HANDLE/DECLINE/REFUSE) | ? | Infer from context, flag for validation |
| Connector availability | ? | Flag as blocker or MVP limitation |
| Concrete definitions (e.g., "high-impact") | ? | Propose definition, flag for validation |
| Instructions/persona | ? | Draft from SDR context |
| Model selection | ? | Recommend based on complexity |

### Step 6: Research Components

For each integration/component need, research via MS Learn MCP:
```
mcp__microsoft-learn__microsoft_docs_search(query="Copilot Studio [component]")
```

### Step 7: Present Options (NEVER ASSUME)

For each decision point:

```markdown
## [Requirement Area]

| Option | Pros | Cons |
|--------|------|------|
| A: [Option] | [Benefits] | [Drawbacks] |
| B: [Option] | [Benefits] | [Drawbacks] |

**Recommendation:** [Option] because [reason]
**Your choice?**
```

### Step 8: Generate agent-spec.md

After user confirms choices, create/update `Build-Guides/[Project]/agent-spec.md` with ALL sections:

1. **Identity**: Name, description, model
2. **Instructions**: Full system prompt ready to paste into MCS
3. **Scope**: HANDLE / DECLINE / REFUSE table
4. **Knowledge Sources**: With connector status (ready / not ready / TBD)
5. **Actions/Tools**: With connector status
6. **Scenarios**: 6-10 covering happy path, edge case, boundary, multi-turn
7. **Evaluation criteria**: Input → expected output pairs
8. **MVP scope**: What to build now vs later
9. **Build checklist**: Step-by-step execution plan

### Step 9: Draft Instructions

Write the full MCS instructions text (most critical output):

**For Standalone:**
```
You are [Agent Name], an AI assistant that [primary purpose].

## Your Capabilities
- [Capability 1]

## How You Work
- [Guideline 1]

## Response Guidelines
- [Tone, format, confirmation requirements]

## Boundaries
- DECLINE [what] → [response]
- REFUSE [what] → [response]
- NEVER [constraint]
- ALWAYS [requirement]
```

**For Orchestrator:**
```
You are [Name]. You coordinate specialist agents.

## Connected Specialists
/[Specialist1] - [when to use]

## Routing Rules
- [Intent] → /[Specialist]
- [Unclear] → Ask clarifying question
```

**For Specialist:**
```
You are [Name], a specialist in [domain].

## Your Expertise
- [Area 1]

## Scope Limits
- [Handle]
- [Decline - return to orchestrator]
```

## Output

Creates/updates `Build-Guides/[Project]/agent-spec.md` — a complete, build-ready spec.

## Important Rules

- **Spec must be complete** - no placeholder text, no "[TBD]" in instructions
- **Default to single agent** - only recommend multi-agent with score 3+
- **Never assume components** - always present options
- **Research before recommending** - use MS Learn MCP
- **Flag gaps clearly** - distinguish "inferred" from "confirmed by customer" content
- **MVP first** - what can we build NOW with available connectors
