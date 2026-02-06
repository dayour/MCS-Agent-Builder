---
name: mcs-build-specialist
description: Build a specialist/child agent in Copilot Studio UI using browser automation. Follows the agent-spec.md for configuration.
---

# MCS Specialist Agent Builder

Build a specialist agent in Microsoft Copilot Studio using Playwright MCP browser automation.

## Input

Provide project name:
- `/mcs-build-specialist ProjectName`

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
   - Target agent: [specialist name from spec]
   - Action: Build new specialist agent

   Is this correct? Please confirm before I proceed.
   ```
6. **WAIT for user confirmation** — do NOT proceed until confirmed
7. If wrong environment → click environment picker → select correct → re-snapshot → re-confirm

## Build Process

### Step 1: Create Agent

1. Click "Create" button
2. Click "New agent"
3. Fill in from spec:
   - **Name:** [From agent-spec.md]
   - **Description:** [From agent-spec.md]
4. Click "Create"
5. Wait for agent to load

### Step 2: Configure Instructions

1. Navigate to "Overview" or "Instructions" section
2. Enter the Instructions/System Prompt from agent-spec.md
3. Save changes

### Step 3: Add Knowledge Sources (if in spec)

For each knowledge source in agent-spec.md:

1. Go to "Knowledge" tab
2. Click "Add knowledge"
3. Select source type (SharePoint/Files/Website/Dataverse)
4. Configure source details
5. Save

### Step 4: Add Tools (if in spec)

**MCP servers first, then connectors, then Computer Use. See CLAUDE.md Playwright Automation Patterns for detailed steps.**

1. Go to "Tools" section → Click "Add tool"
2. For MCP: Select "Model Context Protocol" → search → add
3. For connectors: Search → select action → create connection (handle auth popup in new tab) → add
4. For Computer Use: Select "Computer use" → write instructions → add → rename → save
5. All auth popups: `browser_tabs select index=1` → pick account → switch back

### Step 5: Enable Agent Sharing (REQUIRED for multi-agent)

1. Go to "Settings" → "Security"
2. Find "Allow other agents to connect to this agent"
3. Toggle ON
4. Save

### Step 6: Test in Isolation

1. Open test chat panel
2. Run 2-3 test queries from scenarios.md
3. Verify responses match expectations
4. Note any issues

### Step 7: Publish

1. Click "Publish" button
2. Confirm publish
3. Wait for publish to complete
4. Verify published status

## Verification Checklist

Before marking complete, verify:
- [ ] Agent name matches spec
- [ ] Instructions are complete
- [ ] Knowledge sources added (if specified)
- [ ] Tools/connectors added (if specified)
- [ ] "Allow other agents to connect" is ON
- [ ] Test queries passed
- [ ] Agent is published

## Error Recovery

If any step fails:
1. Take screenshot
2. Research error via MS Learn if unclear
3. Retry with adjusted approach
4. If still failing, stop and report to user

## Output

Report build status:
```
## Build Complete: [Agent Name]

**Environment:** [Environment name]
**Status:** Published / Draft
**Sharing:** Enabled / Disabled

**Completed:**
- [x] Agent created
- [x] Instructions configured
- [x] Knowledge added (N sources)
- [x] Tools added (N connectors)
- [x] Sharing enabled
- [x] Published

**Test Results:**
- Query 1: [Pass/Fail] - [Notes]
- Query 2: [Pass/Fail] - [Notes]

**Next:** Ready for orchestrator connection
```
