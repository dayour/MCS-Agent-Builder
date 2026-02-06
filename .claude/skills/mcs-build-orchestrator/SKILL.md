---
name: mcs-build-orchestrator
description: Build an orchestrator agent and connect child specialists in Copilot Studio UI using browser automation.
---

# MCS Orchestrator Agent Builder

Build an orchestrator agent and connect specialist children in Microsoft Copilot Studio.

## Prerequisites

**Before running this skill:**
- All specialist agents must be built and published (use `/mcs-build-specialist` first)
- All specialists must have "Allow other agents to connect" enabled
- agent-spec.md must define the orchestrator and its children

## Input

Provide project name:
- `/mcs-build-orchestrator ProjectName`

Will read spec from `Build-Guides/[ProjectName]/agent-spec.md`

## Step 0: MCS Preflight Gate (MANDATORY — DO NOT SKIP)

**HARD STOP. Complete this before ANY browser interaction.**

1. `browser_navigate` to `https://copilotstudio.microsoft.com`
2. `browser_snapshot` — wait for page to fully load
3. If login required → pause and let user authenticate
4. Extract **Account** (top-right) and **Environment** (header bar)
5. Output verification stamp to user:
   ```
   ## MCS Preflight Check
   - Account: [name]
   - Environment: [name]
   - Target agent: [orchestrator name from spec]
   - Action: Build orchestrator and connect specialists

   Is this correct? Please confirm before I proceed.
   ```
6. **WAIT for user confirmation** — do NOT proceed until confirmed
7. If wrong environment → click environment picker → select correct → re-snapshot → re-confirm

## Build Process

### Step 1: Create Orchestrator Agent

1. Click "Create" button
2. Click "New agent"
3. Fill in from spec:
   - **Name:** [Orchestrator name from spec]
   - **Description:** [From spec]
4. Click "Create"
5. Wait for agent to load

### Step 2: Configure Orchestrator Instructions

1. Navigate to "Overview" or "Instructions"
2. Enter Instructions including:
   - Agent identity and purpose
   - **Connected Specialists section** with `/AgentName` syntax
   - **Routing Rules** for when to use each specialist
   - Response guidelines
3. Save changes

Example Instructions format:
```
You are [Name], coordinating specialists to help users.

## Connected Specialists
/KYCAgent - Customer data lookups
/QuotingAgent - Pricing and quotes

## Routing Rules
- Customer questions → /KYCAgent
- Pricing questions → /QuotingAgent
- General questions → Answer directly
- Unclear → Ask clarifying question
```

### Step 3: Connect Child Agents

For each specialist in the architecture:

1. Go to "Agents" tab (or "Extensions" → "Agents")
2. Click "Add agent"
3. Search for the specialist agent by name
4. Select and add
5. Repeat for all specialists

### Step 4: Add Orchestrator-Level Knowledge (if any)

Some orchestrators have their own knowledge sources:
1. Go to "Knowledge" tab
2. Add any orchestrator-specific sources

### Step 5: Test Routing

Test each routing path:

1. Open test chat panel
2. For each specialist, send a query that should route to it:
   - "Tell me about customer Acme Corp" → Should route to KYC
   - "What's the price for product X" → Should route to Quoting
3. Verify correct specialist is invoked
4. Verify response is appropriate

### Step 6: Test Edge Cases

1. Ambiguous query → Should ask clarifying question
2. Out of scope query → Should decline gracefully
3. Multi-specialist query → Should coordinate correctly

### Step 7: Publish

1. Click "Publish"
2. Confirm
3. Wait for completion
4. Verify published status

## Verification Checklist

Before marking complete:
- [ ] Orchestrator created with correct name
- [ ] Instructions include routing rules
- [ ] All child agents connected
- [ ] Routing to Specialist A works
- [ ] Routing to Specialist B works
- [ ] [Add row for each specialist]
- [ ] Ambiguous queries handled
- [ ] Out of scope handled
- [ ] Orchestrator published

## Output

Report build status:
```
## Build Complete: [Orchestrator Name]

**Environment:** [Environment name]
**Status:** Published
**Architecture:** Multi-agent orchestrator

**Connected Specialists:**
| Specialist | Status | Routing Test |
|------------|--------|--------------|
| /[Name] | Connected | Pass/Fail |
| /[Name] | Connected | Pass/Fail |

**Routing Tests:**
- Query → [Specialist]: [Pass/Fail]
- Query → [Specialist]: [Pass/Fail]
- Ambiguous query: [Pass/Fail]
- Out of scope: [Pass/Fail]

**System Ready:** Yes/No
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't find specialist in "Add agent" | Verify specialist is published AND has sharing enabled |
| Routing goes to wrong specialist | Update Instructions with clearer routing rules |
| Specialist returns error | Test specialist in isolation first |
| Child agent not responding | Check specialist is published (not just saved) |
