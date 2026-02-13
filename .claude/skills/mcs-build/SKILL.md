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

## MANDATORY: Build Account & Environment Gate

**THIS HAPPENS FIRST. Before cache checks, before reading the spec, before anything.**

Every build targets a specific tenant and environment. Wrong target = agent built in wrong place. This gate ensures the user explicitly confirms where we're building.

### Step 1: Read session-config.json

Read `tools/session-config.json` to get the list of accounts and environments.

### Step 2: Ask User to Pick Account + Environment

Use `AskUserQuestion` to present the account picker:

**Question 1: "Which account should we build under?"**
- Options from `session-config.json` accounts (e.g., dennis@testtesttoltest, admin@M365CPI15209943, kimdennis@microsoft.com)

**Question 2: "Which environment?"**
- Options from the selected account's environments (e.g., Test_Test_TOL_Test, dktest, Contoso)

If brief.json already specifies a target environment, pre-select it as the recommended option — but still ask the user to confirm.

### Step 3: Set PAC CLI Profile

If the selected account has a `pacProfileIndex`, switch to it:
```powershell
pac auth select --index {pacProfileIndex}
```

Verify with `pac auth list` — confirm the active profile matches the selected account.

### Step 4: Store Build Context

Record for this build session:
- **Account**: {selected account label}
- **Environment**: {selected environment name}
- **Dataverse URL**: {from session-config.json}
- **PAC CLI Profile**: {index or "N/A — browser only"}

### Step 5: Output Build Stamp

```
## Build Target Confirmed
- Account: {account}
- Environment: {environment}
- Dataverse URL: {url}
- PAC CLI: Profile {index} active
- Agent: {agent name from spec}
- Build mode: {Single Agent | Multi-Agent}

Proceeding with build...
```

**Only after this stamp is output do we proceed to cache checks and the actual build.**

### Rules

- **NEVER skip this gate** — even for "quick" re-builds or single-step changes
- **NEVER assume the session-start account is still correct** — the user may have switched contexts
- **If the user picks an account with no environments listed**, ask them to provide the environment name manually
- **The Playwright Preflight Gate (later in the build) will verify the browser matches** — this gate ensures the intent is set correctly first

---

## Before Building — Knowledge Cache Check

1. Read `knowledge/cache/api-capabilities.md` — check `last_verified` date
2. If stale (> 7 days), refresh: WebSearch + MS Learn for "Copilot Studio API"
3. Check if any Playwright-only operations now have API alternatives
4. Read `knowledge/cache/models.md` if spec requires model selection
5. Read `knowledge/patterns/dataverse-patterns.md` for API call patterns
6. Update cache files if new findings

## Route: Determine Build Mode

Read `brief.json` → `architecture.type`:

| Value | Build Path |
|-------|-----------|
| `Single Agent` | → **Standalone Build** (below) |
| `Multi-Agent` | → **Multi-Agent Build** (below) |
| `Connected Agent` | → **Standalone Build** + external connection notes |

---

## Standalone Build (Single Agent)

### Step 0: Environment Verification

1. Check brief.json for environment info
2. Run `pac auth list` to see PAC CLI target
3. If environments don't match: plan browser-based operations
4. Log verified environment

### Step 1: Scaffold Agent (PAC CLI — no browser)

**Try PAC CLI first. Fall back to Playwright only if no template exists.**

```powershell
# Option A: From template (preferred)
pac copilot create --displayName "[Agent Name]" --schemaName "cr_[schema]" --solution "DefaultSolution" --templateFileName template.yaml

# Option B: Via Playwright (fallback)
# Run Preflight Gate → Create → New agent → Skip to configure → set Name + Description → Create
```

After creation, capture bot ID:
```powershell
pac copilot list
```

**VERIFY:** Agent exists in `pac copilot list` or MCS UI snapshot.

### Step 2: Configure Instructions & Knowledge (Dataverse API — no browser)

**Instructions:** Update via Dataverse API (see `knowledge/patterns/dataverse-patterns.md` § 3).
**Fallback:** Playwright → Edit Instructions → paste → Save

**Knowledge:** Upload via Dataverse API (see `knowledge/patterns/dataverse-patterns.md` § 4).
**Fallback:** Playwright → Knowledge tab → Add knowledge

**Initial Publish:**
```powershell
pac copilot publish --bot <bot-id>
```

**VERIFY:** Snapshot Overview → instructions text matches spec, knowledge sources listed.

### Step 3: Configure Tools & Model (Playwright — browser required)

**Run MCS Preflight Gate FIRST (MANDATORY).**

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
- **Model**: Click combobox → select → auto-saves
- **MCP servers**: Tools → Add tool → Model Context Protocol → search → add
- **Connectors**: Tools → Add tool → search connector → select action → create connection
- **Computer Use**: Tools → Add tool → Computer use → configure
- **Security**: Settings → "Allow other agents to connect" (if specialist)

**VERIFY:** Snapshot Tools tab → all tools listed. Snapshot Overview → model correct.

### Step 4: Author Topics (Code Editor YAML — minimal browser)

Use **Topic Engineer** teammate to generate validated YAML:

For each topic in the spec:
1. Topic Engineer generates YAML from `knowledge/patterns/topic-patterns/`
2. QA Challenger validates YAML syntax
3. In MCS: Topics → "Add a topic" → "From blank"
4. Click "..." → "Open code editor"
5. Paste generated YAML → Save

### Step 5: Publish (PAC CLI — no browser)

```powershell
pac copilot publish --bot <bot-id>
pac copilot status --bot-id <bot-id>
```

**If environments don't match:** Publish via browser Publish button.

**VERIFY:** Snapshot Overview → "Published [today]" visible.

### Step 6: Update brief.json buildStatus

```json
{
  "buildStatus": {
    "status": "published",
    "lastBuild": "2026-02-12T...",
    "mcsAgentId": "<bot-id>",
    "environment": "<env-name>",
    "publishedAt": "2026-02-12T..."
  }
}
```

---

## Multi-Agent Build

### Build Order

**Specialists first, then orchestrator:**

1. For each specialist agent defined in the spec:
   a. Create agent (PAC CLI or Playwright)
   b. Set instructions (Dataverse API) — specialist-focused, with scope limits
   c. Add knowledge (Dataverse API)
   d. Add tools/model (Playwright) — run Preflight Gate once, reuse session
   e. Enable "Allow other agents to connect" (Playwright → Settings → Security)
   f. Author topics (Code Editor YAML)
   g. Publish (PAC CLI)
   h. **VERIFY:** All items above confirmed

2. Build orchestrator:
   a. Create orchestrator (PAC CLI or Playwright)
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
| Model matches spec | Model combobox |
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
