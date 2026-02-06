---
name: mcs-build-agent
description: Build a standalone single agent in Copilot Studio UI using browser automation. Default build path for most agents.
---

# MCS Agent Builder (Single / Standalone)

Build a standalone agent in Microsoft Copilot Studio using Playwright MCP browser automation. This is the **default build path** for most agents.

## Input

Provide project name:
- `/mcs-build-agent ProjectName`

Will read spec from `Build-Guides/[ProjectName]/agent-spec.md`

## Pre-Build: Front-Load Everything

**Before opening the browser, read and extract ALL details from the spec:**

1. Read `agent-spec.md` completely
2. Extract: name, description, instructions, knowledge sources, tools, model preference
3. Read `scenarios.md` for test queries
4. Build a complete action checklist

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
   - Target agent: [agent name from spec]
   - Action: Build new standalone agent

   Is this correct? Please confirm before I proceed.
   ```
6. **WAIT for user confirmation** — do NOT proceed until confirmed
7. If mismatch → help user switch environment first

## Build Process

### Step 1: Create Agent

1. Click "Create" → "New agent" → Select "Skip to configure"
2. Set **Name** from spec
3. Set **Description** from spec
4. Click "Create"
5. Wait for agent to provision

### Step 2: Select Model

1. Click the model combobox on Overview page
2. Take snapshot to see all available models
3. Pick the best model using priority order (see CLAUDE.md § Model Selection)
4. If agent-spec.md specifies a model, use that instead
5. Log which model was selected

### Step 3: Configure Instructions

1. Click "Edit" on Instructions section
2. Enter the full instructions from agent-spec.md
3. Click "Save"
4. Verify instructions saved correctly

### Step 4: Add Knowledge Sources (if in spec)

For each knowledge source in agent-spec.md:
1. Go to "Knowledge" section on Overview (or Knowledge tab)
2. Click "Add knowledge"
3. Select source type (SharePoint / Files / Website / Dataverse)
4. Configure source details
5. Save

### Step 5: Add Tools (if in spec)

**MCP servers first, then connectors, then Computer Use.**

**For MCP servers (preferred — see CLAUDE.md Category 1):**
1. Go to "Tools" section → Click "Add tool"
2. Select "Model Context Protocol" from Create new, or search for MCP name
3. Select the MCP server → "Add and configure"
4. Create connection if needed (handle auth popup in new tab)
5. Save

**For individual connector actions (only when no MCP available):**
1. Click "Add tool" → search/select connector
2. Select specific action
3. Create connection → handle auth popup → "Add and configure"
4. Save

**For Computer Use tools:**
1. Click "Add tool" → "Computer use" from Create new
2. Write natural language instructions (step-by-step)
3. "Add and configure" → rename, update description → Save
4. Configure machine type (Hosted browser for prototype, BYO for production)

**Auth popup pattern (for connections):**
```
Click "Create" → wait 3-5s → browser_tabs select index=1 →
  snapshot → click account → wait → switch back to tab 0
```

### Step 6: Publish

1. Click "Publish"
2. Confirm in dialog
3. Wait for publish (runs in background)
4. Close dialog if needed

### Step 7: Generate & Upload Evals

After publish, proceed to `/mcs-eval` to generate and upload evaluation test set.

## Verification Checklist

Before marking complete:
- [ ] Agent name matches spec
- [ ] Best available model selected
- [ ] Instructions are complete and saved
- [ ] Knowledge sources added (if specified)
- [ ] Tools added (if specified)
- [ ] Agent is published

## Output

Report build status:
```
## Build Complete: [Agent Name]

Verified: Account=[account] | Environment=[env] | Profile=[profile]

**Model:** [Selected model]
**Status:** Published

**Completed:**
- [x] Agent created
- [x] Model: [model name] selected
- [x] Instructions configured ([char count]/8000)
- [x] Knowledge added (N sources)
- [x] Tools added (N tools)
- [x] Published

**Next:** Run `/mcs-eval [ProjectName]` to generate and upload evaluations
```
