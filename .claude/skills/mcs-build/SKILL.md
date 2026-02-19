---
name: mcs-build
description: Build agent(s) in Copilot Studio using the hybrid build stack. Reads brief.json for architecture mode (single/multi-agent). Handles standalone, specialist, and orchestrator builds.
---

# MCS Agent Builder — Unified Hybrid Build Stack

Build agents in Microsoft Copilot Studio using the optimized hybrid approach: PAC CLI for lifecycle, Dataverse API for configuration, Code Editor YAML for topics, and Playwright only where no API exists.

This skill handles all build modes:
- **Single Agent** — standalone build
- **Multi-Agent** — builds specialists first, then orchestrator with child connections

## BUILD DISCIPLINE — VERIFY-THEN-MARK (MANDATORY)

**These rules override all other behavior. Never skip them.**

1. **Atomic tasks**: Every build step is a SEPARATE task. "Generate file" and "upload file" and "run eval" are THREE tasks, not one.
2. **Verify after every action**: After each change, snapshot or read-back to confirm it worked.
3. **Never mark a task complete until verified**: If you can't verify, say "I did X but couldn't verify Y".
4. **File generation ≠ deployment**: Writing a local file is NOT the same as uploading it to MCS.
5. **Environment check**: Before PAC CLI ops, verify the agent's environment matches PAC CLI's active profile.
6. **End-of-build reconciliation**: After ALL changes, walk the brief's component list and snapshot-verify each item.

## Input

```
/mcs-build {projectId} {agentId}
```

Reads from:
- `Build-Guides/{projectId}/agents/{agentId}/brief.json` — THE single source of truth (architecture, tools, instructions, model, topics, everything)

Writes to:
- `Build-Guides/{projectId}/agents/{agentId}/brief.json` — updates `buildStatus` field
- `Build-Guides/{projectId}/agents/{agentId}/build-report.md` — customer-shareable summary

## Smart Build Account & Environment Gate

Every build targets a specific tenant and environment. This gate reads persisted context first and only asks the user when no prior build context exists.

### Flow

1. **Read brief.json** → check `buildStatus.account`, `buildStatus.environment`, `buildStatus.accountId`
2. **If all three exist** (previous build ran):
   - Look up account in `tools/session-config.json` by `accountId` to get `pacProfileIndex`
   - Set PAC CLI profile: `pac auth select --index {pacProfileIndex}`
   - Output a one-line confirmation and proceed:
     ```
     Resuming build on {account} / {environment} (PAC CLI profile {index}).
     ```
   - **No question asked.** If the user wants to change target, they can say so.
3. **If missing** (first build for this agent):
   a. Read `tools/session-config.json`
   b. Check `sessionDefaults.lastAccount` and `sessionDefaults.lastEnvironment`
   c. If sessionDefaults has values → pre-select them as "(Recommended)" in the picker
   d. Use `AskUserQuestion`:
      - Q1: "Which account should we build under?" — options from session-config accounts
      - Q2: "Which environment?" — options from the selected account's environments
   e. Set PAC CLI profile: `pac auth select --index {pacProfileIndex}`
   f. **Persist the selection** to BOTH locations:
      - `brief.json.buildStatus` → set `account`, `environment`, `accountId`
      - `session-config.json.sessionDefaults` → set `lastAccount`, `lastEnvironment`, `lastUpdated`
   g. Output build stamp:
     ```
     ## Build Target Confirmed
     - Account: {account}
     - Environment: {environment}
     - Dataverse URL: {url}
     - PAC CLI: Profile {index} active
     - Agent: {agent name from spec}
     - Build mode: {Single Agent | Multi-Agent}
     ```

### Rules

- If the user says "switch to [account/env]" at any point, re-run the picker and update both persistence locations
- If an account has no environments listed, ask the user to provide the environment name manually
- The Playwright Preflight Gate (later in the build) verifies the browser matches this gate's selection

---

## Before Building — Knowledge Cache Check

1. Read `knowledge/cache/api-capabilities.md` — check `last_verified` date
2. If stale (> 7 days), refresh: WebSearch + MS Learn for "Copilot Studio API"
3. Check if any Playwright-only operations now have API alternatives
4. Read `knowledge/patterns/dataverse-patterns.md` for API call patterns
6. Update cache files if new findings

## Route: Determine Build Mode

Read `brief.json` → `architecture.type`:

| Value | Build Path |
|-------|-----------|
| `Single Agent` | → **Standalone Build** (below) |
| `Multi-Agent` | → **Multi-Agent Build** (below) |
| `Connected Agent` | → **Standalone Build** + external connection notes |

---

## On-Demand Teammates During Build

In addition to Topic Engineer (YAML authoring, Step 4) and QA Challenger (review, Step 4), two teammates are available on-demand when issues arise during build. They are NOT spawned at build start — only when specific conditions trigger them. This keeps simple builds fast while making complex builds resilient.

### Research Analyst — When Tool Configuration Fails

**Trigger conditions (Step 2 or Step 3):**
- Connector/MCP server not found by expected name in MCS UI
- Auth mode in MCS differs from what brief.json specifies
- Tool behavior doesn't match documentation (unexpected parameters, missing actions)
- Any error during Playwright tool configuration that the lead can't resolve in 1 attempt

**What RA does:**
- WebSearch for "[connector name] Copilot Studio" + current year
- MS Learn MCP for official connector docs
- Check if connector was renamed, deprecated, or moved to preview
- Report back: correct name, auth requirements, alternative approaches

**After RA reports:**
- Lead applies the fix (correct connector name, different auth mode, etc.)
- Update `brief.json.integrations[].notes` with the finding
- Update `knowledge/cache/connectors.md` if the discovery is broadly useful
- RA is dismissed (not kept alive for the whole build)

### Prompt Engineer — When Instructions Need Adjustment

**Trigger conditions (Step 2, after tools are configured):**
- Tool names in MCS differ from brief.json (e.g., brief says "Jira" but MCS connector is "Atlassian Jira Cloud (Preview)")
- A planned tool couldn't be added (not available, auth failed) → instructions reference non-existent tool
- Connector actions have different parameter names than expected → instructions reference wrong action names
- Instructions exceed 8000 chars after adding tool-specific guidance

**What PE does:**
- Read current instructions from brief.json
- Read actual tool configuration (names, action names) from the build session
- Produce revised instructions with corrected tool references
- Self-verify: char count < 8000, all referenced tools exist, boundaries intact

**After PE reports:**
- QA Challenger does a quick consistency check (existing QA teammate, already active in Step 4)
- Lead applies revised instructions via Dataverse API
- Update `brief.json.instructions` with the revised version
- PE is dismissed (not kept alive for the whole build)

---

## Standalone Build (Single Agent)

### Step 0: Resume Detection & Environment Verification

**Resume check (runs before anything else):**

1. Read `brief.json.buildStatus.completedSteps` (array)
2. If the array has entries, this is a resumed build. Log which steps will be skipped:
   ```
   Resuming build — completed steps: [created, instructions, knowledge]
   Skipping to: tools configuration (Step 3)
   ```
3. Use this mapping to decide what to skip:
   - `"created"` in list → skip Step 1 (find-or-create agent)
   - `"instructions"` in list → skip instruction paste in Step 2
   - `"knowledge"` in list → skip knowledge upload in Step 2
   - `"tools"` in list → skip tool configuration in Step 3
   - `"model"` in list → skip model selection in Step 3
   - `"topics"` in list → skip Step 4 (topic authoring)
   - **Always re-run Step 5 (publish)** — it's cheap and ensures latest state is published

**Environment verification:**

1. Check brief.json for environment info
2. Run `pac auth list` to see PAC CLI target
3. If environments don't match: plan browser-based operations
4. Log verified environment

### Step 1: Find or Create Agent

**Check for existing agent before creating.** This prevents duplicate agents on build resume or session restart.

#### 1a. Check brief.json for existing agent ID

Read `brief.json.buildStatus.mcsAgentId`:

- **If set** → verify it still exists:
  ```powershell
  pac copilot list
  ```
  - If agent ID or name found in output → skip creation, log: "Resuming work on existing agent {name} ({id})"
  - If NOT found (agent was deleted?) → clear `mcsAgentId` from buildStatus, proceed to 1b

#### 1b. Check PAC CLI for matching agent name

If no `mcsAgentId`, search for an agent with the same `displayName` from brief.json:
```powershell
pac copilot list
```
- If a matching name is found → store its ID in `brief.json.buildStatus.mcsAgentId`, skip creation
- If NOT found → proceed to 1c

#### 1c. Create new agent (Playwright — Preflight Gate required)

PAC CLI `create` requires an undocumented template YAML that only captures ~30% of config (topics/instructions — not tools, knowledge, or model). Since Playwright is already required for tools + model, using it for creation eliminates the template dependency.

1. **Run MCS Preflight Gate** (see Step 3 for full gate procedure)
2. Navigate to MCS home → **Create** → **New agent** → **Skip to configure**
3. Set **Name** and **Description** from brief.json
4. Set icon if specified in brief.json
5. Click **Create**

After creation, capture bot ID:
```powershell
pac copilot list
```

**Fallback:** If browser is unavailable, use `pac copilot create --displayName "Name" --schemaName "cr_name" --solution "DefaultSolution" --templateFileName template.yaml` (requires extracting a template from an existing agent first).

#### 1d. Persist immediately

Write `mcsAgentId` to `brief.json.buildStatus` right after creation or detection — do NOT defer to Step 6. Also add `"created"` to `completedSteps`.

**VERIFY:** Agent exists in `pac copilot list` output and `brief.json.buildStatus.mcsAgentId` is set.

### Step 2: Configure Instructions & Knowledge (Dataverse API — no browser)

**Skip check:** If `"instructions"` is in `completedSteps`, skip the instructions sub-step. If `"knowledge"` is in `completedSteps`, skip the knowledge sub-step. If both are completed, skip this entire step.

**Instructions:** Update via Dataverse API (see `knowledge/patterns/dataverse-patterns.md` § 3).
**Fallback:** Playwright → Edit Instructions → paste → Save
**Checkpoint:** After verified, add `"instructions"` to `brief.json.buildStatus.completedSteps` and set `lastCompletedStep` to `"instructions"`.

**Knowledge:** Upload via Dataverse API (see `knowledge/patterns/dataverse-patterns.md` § 4).
**Fallback:** Playwright → Knowledge tab → Add knowledge
**Checkpoint:** After verified, add `"knowledge"` to `brief.json.buildStatus.completedSteps` and set `lastCompletedStep` to `"knowledge"`.

**Initial Publish:**
```powershell
pac copilot publish --bot <bot-id>
```

**VERIFY:** Snapshot Overview → instructions text matches spec, knowledge sources listed.

**On-demand PE trigger:** After Step 3 configures tools, if tool names in MCS differ from brief.json, spawn Prompt Engineer to adjust instructions (see "On-Demand Teammates" section above). Re-apply instructions via Dataverse API after PE revises them.

### Step 3: Configure Tools & Model (Playwright — browser required)

**Skip check:** If `"tools"` is in `completedSteps`, skip tool configuration. If `"model"` is in `completedSteps`, skip model selection. If both are completed, skip this entire step.

**Run MCS Preflight Gate FIRST (MANDATORY) — unless entire step is skipped.**

1. `browser_navigate` to `https://copilotstudio.microsoft.com`
2. `browser_snapshot` — wait for load
3. Output verification stamp:
   ```
   ## MCS Preflight Check
   - Account: [name]
   - Environment: [name]
   - Target agent: [agent name]
   - Action: Configure model, tools, and connections

   Is this correct? Please confirm before I proceed.
   ```
4. **WAIT for user confirmation**

Then configure:
- **Model**: Always select the latest available model. In the MCS model combobox, pick the newest option (typically the top preview model). Do not read architecture.model from brief.json.
  **Checkpoint:** After model verified, add `"model"` to `completedSteps`, set `lastCompletedStep` to `"model"`.
- **MCP servers**: Tools → Add tool → Model Context Protocol → search → add
- **Connectors**: Tools → Add tool → search connector → select action → create connection
- **Computer Use**: Tools → Add tool → Computer use → configure
- **Security**: Settings → "Allow other agents to connect" (if specialist)
  **Checkpoint:** After all tools verified, add `"tools"` to `completedSteps`, set `lastCompletedStep` to `"tools"`.

**On-demand RA trigger:** If a connector/MCP server is not found by expected name, or auth mode differs from spec, spawn Research Analyst to investigate (see "On-Demand Teammates" section above). Apply RA's findings before continuing.

**VERIFY:** Snapshot Tools tab → all tools listed. Snapshot Overview → model correct.

**Error handling:** If a step fails, write the error to `brief.json.buildStatus.lastError` before stopping. On the next resume, `lastError` tells the lead what went wrong.

### Step 4: Author Topics (Code Editor YAML — minimal browser)

**Skip check:** If `"topics"` is in `completedSteps`, skip this entire step.

Use **Topic Engineer** teammate to generate validated YAML:

For each topic in the spec:
1. Topic Engineer generates YAML from `knowledge/patterns/topic-patterns/`
2. QA Challenger validates YAML syntax
3. In MCS: Topics → "Add a topic" → "From blank"
4. Click "..." → "Open code editor"
5. Paste generated YAML → Save

**Checkpoint:** After all topics verified, add `"topics"` to `completedSteps`, set `lastCompletedStep` to `"topics"`.

### Step 5: Publish (PAC CLI — no browser)

**Always runs** — even on resume. Publishing is cheap and ensures the latest state is live.

```powershell
pac copilot publish --bot <bot-id>
pac copilot status --bot-id <bot-id>
```

**If environments don't match:** Publish via browser Publish button.

**Checkpoint:** After verified, add `"published"` to `completedSteps`, set `lastCompletedStep` to `"published"`. Clear `lastError`.

**VERIFY:** Snapshot Overview → "Published [today]" visible.

### Step 6: Finalize brief.json buildStatus

Write the complete buildStatus. Most fields were already written incrementally during checkpoints — this step ensures the final state is clean:

```json
{
  "buildStatus": {
    "status": "published",
    "lastBuild": "2026-02-18T...",
    "mcsAgentId": "<bot-id>",
    "environment": "<env-name>",
    "account": "<account-label>",
    "accountId": "<session-config-account-id>",
    "publishedAt": "2026-02-18T...",
    "completedSteps": ["created", "instructions", "knowledge", "tools", "model", "topics", "published"],
    "lastCompletedStep": "published",
    "lastError": null
  }
}
```

---

## Multi-Agent Build

### Build Order

**Specialists first, then orchestrator:**

1. For each specialist agent defined in the spec:
   a. Create agent via Playwright (Preflight Gate required)
   b. Set instructions (Dataverse API) — specialist-focused, with scope limits
   c. Add knowledge (Dataverse API)
   d. Add tools/model (Playwright) — reuse session from creation
   e. Enable "Allow other agents to connect" (Playwright → Settings → Security)
   f. Author topics (Code Editor YAML)
   g. Publish (PAC CLI)
   h. **VERIFY:** All items above confirmed

2. Build orchestrator:
   a. Create orchestrator via Playwright (Preflight Gate required)
   b. Set instructions with routing rules (Dataverse API):
      ```
      ## Connected Specialists
      /[SpecialistName] - [when to use]

      ## Routing Rules
      - [Intent] → /[Specialist]
      ```
   c. Select model (Playwright)
   d. Connect child agents (Playwright → Agents tab → Add agent → search → add)
   e. Add orchestrator-level tools/knowledge if needed
   f. Author topics if needed (Code Editor YAML)
   g. Publish (PAC CLI)
   h. **VERIFY:** All specialists connected, routing rules in instructions

### Multi-Agent Verification

After building all agents:
- Each specialist: published, sharing enabled
- Orchestrator: published, all children connected
- Routing test: send test queries to verify correct specialist is invoked

---

## End-of-Build Reconciliation (MANDATORY)

After ALL changes, walk the brief's component list and snapshot-verify each item:

| Check | How to verify |
|-------|--------------|
| Agent exists with correct name | Overview heading |
| Latest model selected | Model combobox |
| Instructions match spec | Instructions text read-back |
| Knowledge sources match spec | Knowledge section |
| Tools match spec | Tools tab |
| Triggers match spec | Triggers section |
| Agent is published | "Published [today]" |
| (Multi-agent) All specialists connected | Agents tab |
| (Multi-agent) Sharing enabled on specialists | Settings snapshot |

Report: "Reconciliation: N/N items verified" or "Found M issues: [list]"

## Output: Build Summary Report

After reconciliation, generate **two outputs**:

1. **Terminal output** — concise build status for the user (shown inline)
2. **Build report file** — shareable document for customer review

### Terminal Output (inline)

```
## Build Complete: [Agent Name]

**Status:** Published | **Environment:** [env] | **Account:** [account]
**Reconciliation:** {N}/{N} items verified

Report saved: Build-Guides/{projectId}/agents/{agentId}/build-report.md

**Next:** Review the build report, share with customer for approval, then run /mcs-eval.
```

### Build Report File

Write to `Build-Guides/{projectId}/agents/{agentId}/build-report.md`.

This is a **customer-shareable deliverable**. Write it in clear, professional language. No internal jargon (no "Playwright", "PAC CLI", "Dataverse API" — those are build methods, not customer concerns).

```markdown
# Build Summary: [Agent Name]

**Date:** [today]
**Environment:** [environment name]
**Status:** Published

---

## 1. Agent Overview

**Name:** [agent name]
**Purpose:** [1-2 sentence problem statement from spec]
**Target Users:** [who will use this agent]
**Channels:** [where it's deployed — Teams, web, etc.]

---

## 2. Architecture

**Type:** [Single Agent | Multi-Agent with N specialists]
**Model:** [model name] ([GA | Preview])
**Rationale:** [Why this architecture and model were chosen — 2-3 sentences]

[If multi-agent, list specialists:]
| Agent | Role | Status |
|-------|------|--------|
| [Orchestrator name] | Routes to specialists | Published |
| [Specialist 1] | [domain] | Published |
| [Specialist 2] | [domain] | Published |

---

## 3. Capabilities

### What This Agent Does
[Bullet list of key capabilities from the spec]

### What This Agent Declines
[Bullet list of out-of-scope items it redirects gracefully]

### Hard Boundaries
[Bullet list of things the agent will never do]

---

## 4. Tools & Integrations

| Tool / System | Purpose | Connection Type | Status |
|---------------|---------|----------------|--------|
| [e.g., Outlook Calendar] | Read/manage calendar events | MCP Server | Connected |
| [e.g., ServiceNow] | Query incidents and tickets | Custom Connector | Connected |
| [e.g., SharePoint] | Access project documents | MCP Server | Connected |

---

## 5. Knowledge Sources

| Source | Type | What It Covers |
|--------|------|---------------|
| [e.g., SharePoint site] | SharePoint | Project documentation |
| [e.g., Confluence space] | Graph Connector | Knowledge base articles |

---

## 6. Topics & Triggers

### Conversation Topics
| Topic | What It Handles |
|-------|----------------|
| [topic name] | [description] |

### Triggers
| Trigger | Type | When It Fires |
|---------|------|--------------|
| [e.g., Daily prioritization] | Recurrence | Every weekday at 8 AM |
| [e.g., User message] | Conversational | When user sends a message |

---

## 7. Key Behaviors (Instruction Summary)

[3-5 bullet summary of the agent's core behavioral rules — NOT the full 8000-char instructions, but the essence of how it behaves. Written so a customer can verify "yes, this is what we want."]

- [e.g., Always prioritizes by urgency, then due date, then assignment]
- [e.g., Outputs structured tables for worklists, narrative for leadership summaries]
- [e.g., Never makes up ticket IDs — only returns real data from source systems]

---

## 8. Open Questions

[Items that still need customer input. These block further optimization.]

| # | Question | Impact | Status |
|---|---------|--------|--------|
| 1 | [question] | [what it affects] | Open |
| 2 | [question] | [what it affects] | Open |

---

## 9. What Changed from Plan

[If anything was different from the original spec, note it here. If nothing changed, write "Built as specified."]

| Area | Originally Planned | Actually Built | Reason |
|------|-------------------|----------------|--------|
| [e.g., Jira connector] | Custom connector | Power Automate flow | On-prem auth incompatible |

---

## 10. Evaluation Status

[If evals haven't run yet:]
**Status:** Pending — run `/mcs-eval` after customer review

[If evals have run, include summary:]
**Overall:** {X}/{Y} passed ({Z}%)

| Category | Passed | Total |
|----------|--------|-------|
| Happy Path | X | Y |
| Boundaries | X | Y |

---

## 11. Next Steps

1. **Review this report** — confirm capabilities, boundaries, and tool connections are correct
2. **Answer open questions** (Section 8) — these are needed for optimization
3. **Run evaluation tests** — automated tests will verify agent behavior
4. **Pilot deployment** — deploy to pilot users for real-world feedback
5. **Iterate** — incorporate feedback, re-run research if needed

---

*Generated by MCS Agent Builder — [date]*
```

### Rules for the Report

- **Customer-readable language** — no build toolchain details, no API references
- **Decisions explained** — every architecture/tool choice includes a "why"
- **Open questions prominent** — this is how the customer knows what input is needed
- **Spec-vs-actual transparent** — if anything changed during build, it's documented
- **Concise** — aim for 2-3 pages, not 10. Tables over paragraphs.
- **Save as file** — always write to `build-report.md` so it can be shared

---

## Post-Build Learnings Capture (MANDATORY)

**After reconciliation and the build report, generate a learnings summary.** This is how the system gets smarter over time.

### How It Works

You were there for the entire build. You know what happened. Just write it down naturally:

- Did something deviate from the spec? (Already captured in build-report.md Section 9)
- Did an error force a workaround? You researched the fix — that's a learning.
- Did you discover a new component or better method? That's a learning.
- Did the user override a recommendation? That's a learning.
- Did everything go as planned? That confirms the approach — also a learning.

### Generate Learnings Summary

After the build report, output a short learnings block. **Only include things worth remembering for future builds.** Skip if the build was routine.

```
## Learnings from this build

1. [Natural language description of what was learned — e.g., "Jira on-prem custom connector failed auth. Power Automate HTTP flow worked as middleware. Tag: #jira #on-prem #integrations"]
2. [Another learning]
3. [Another learning]

Anything else to add? These will be saved to our knowledge base for future builds.
```

### Write Confirmed Learnings

After user confirms (or adds more):
- Write each learning to the appropriate `knowledge/learnings/{topic}.md` file
- Use the entry format from the file headers
- If an existing entry covers the same pattern, bump its `Confirmed` count instead of duplicating

### Rules

- **Don't force it** — if the build was clean and routine, say "No new learnings. Approach confirmed." and move on
- **User confirmation required** — always ask before writing to learnings files
- **Concise entries** — one insight per entry, not paragraphs
