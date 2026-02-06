# Claude Code Instructions for MCS Automation

## Overview

Automate Microsoft Copilot Studio (MCS) agent creation using Claude Code with Playwright MCP for browser automation. Research capabilities broadly, analyze use cases, recommend components, and execute UI automation.

**CRITICAL: Never assume components. Research BROADLY first (web, GitHub, MS Learn, community — not just one source), recommend based on requirements.**

---

## MANDATORY: MCS Browser Preflight Gate

**THIS IS A HARD STOP. No exceptions. No skipping. No "I'll check later."**

Before ANY Playwright browser interaction with Copilot Studio — whether via a skill, ad-hoc user request, or agent update — you MUST complete this preflight gate and output the verification stamp. This applies to ALL browser work: builds, updates, testing, publishing, evaluation uploads, knowledge changes, tool additions, EVERYTHING.

### Preflight Steps

1. `browser_navigate` to `https://copilotstudio.microsoft.com`
2. `browser_snapshot` — read the page
3. Extract from snapshot:
   - **Account name** (top-right account button)
   - **Environment name** (header bar environment picker)
4. Output the verification stamp (see below)
5. **WAIT for user confirmation** before ANY further browser action

### Required Verification Stamp

You MUST output this EXACT format to the user and STOP until they confirm:

```
## MCS Preflight Check
- Account: [name from snapshot]
- Environment: [name from snapshot]
- Target agent: [what you're about to work on]
- Action: [what you plan to do]

Is this correct? Please confirm before I proceed.
```

### Rules

- If the page hasn't loaded yet (shows "Loading..."), WAIT and re-snapshot
- If you're already in MCS but navigated away and back, RE-VERIFY
- If the user says the environment is wrong, help them switch BEFORE doing anything
- NEVER click on an agent, tab, button, or form element until the user has confirmed
- This gate applies even for "quick" changes — there are no exceptions

---

## MCP Tools

| Tool | Purpose |
|------|---------|
| **Playwright MCP** | Browser automation for Copilot Studio UI (`@playwright/mcp`) |
| **Microsoft Learn MCP** | Official docs, reference, code samples |
| **WebSearch** | Latest announcements, preview features, community discoveries, GitHub |
| **WebFetch** | Deep-read blog posts, GitHub READMEs, release notes |
| **WorkIQ** | M365 data access during live builds (Preview) |

---

## Learning System

**Capture learnings automatically. Log to `learnings/YYYY-MM-DD.md` when:**
- Errors occur
- New patterns discovered
- MS Learn reveals updates
- User provides insights
- Build completes (prompt: "Did anything surprise you?")

**Format:**
```markdown
### HH:MM - [Title]
**Context:** [Scenario]
**What Happened:** [Issue/discovery]
**Resolution:** [What we learned]
**Tags:** #tag1 #tag2
```

---

## Core Philosophy

### 1. Spec-Driven Build
The **agent-spec.md** is the single source of truth. Everything flows from it:
- SDR/intake → **agent-spec.md** → Build → Eval
- The spec contains everything needed to execute a build without stopping to ask questions
- If the spec has gaps, fill them BEFORE building

### 2. Eval-Verified Quality
Evals are generated from the spec and verify the build works:
- **Golden examples** = quality bar (semantic matching, 70%+ pass)
- **Boundaries** = hard rules (must pass 100%)
- Test during build, not just at end

### 3. Multi-Agent First
Decompose into specialists by default. Score objectively (6 factors, 3+ = multi-agent).

**Always ask:** "What specialist domains does this problem require?"

### 4. Never Assume — Research Broadly
Research EVERY TIME before recommending components. Do NOT rely on a static list — MCS ships features continuously, including preview/experimental capabilities not yet in official docs. Present options with confidence, recommend the best one, let user override.

**Research sources (use ALL, not just one):**
- **WebSearch** — latest announcements, blog posts, preview features, community discoveries
- **MS Learn MCP** — official docs, reference, code samples
- **GitHub** — repos, issues, discussions, sample projects
- **MCS UI itself** — snapshot the actual UI to see what's available now (tools, models, knowledge types, settings)
- **Community** — Power Platform community, MVP blogs, X/Twitter from product teams

**When to research:** Every Phase 1 component selection. Every time you encounter a capability you haven't verified recently. Every error you can't explain.

---

## Intake Paths

Requirements come in one of three ways. Handle each:

### Path A: SDR Files in Project Folder
Customer provides Solution Discovery Report (SDR) documents (`.docx`, `.md`, `.pdf`).

1. Check `Build-Guides/[ProjectName]/` for SDR files
2. Convert `.docx` files to `.md` using pandoc if needed
3. Read and analyze SDR content
4. Extract into `agent-spec.md` (see Phase 1)

### Path B: Pasted in Chat
User pastes requirements, SDR content, or use case description directly in conversation.

1. Analyze the pasted content
2. Create project folder: `Build-Guides/[ProjectName]/`
3. Save raw input as `sdr-raw.md` for reference
4. Extract into `agent-spec.md` (see Phase 1)

### Path C: No Input — Ask User
No SDR or requirements available.

1. Ask: "What are we building? Describe the agent's purpose, users, and key scenarios."
2. Use `templates/agent-spec.md` sections as a guide for what to ask
3. Gather enough detail to produce an `agent-spec.md`

---

## Workflow

```
INTAKE → PHASE 1: Analyze & Spec → PHASE 2: Build → PHASE 3: Eval & Validate
```

---

## PHASE 1: Analyze & Spec

**Goal:** Produce a complete `agent-spec.md` that can be executed as a build without questions.

### From SDR: Extract These Fields

| Field | Where in SDR | Notes |
|-------|-------------|-------|
| Agent name & description | Title / opportunity scope | Clear, concise |
| Problem statement | "What is the problem" section | 1-2 sentences |
| Personas | "Key personas" section | Primary + secondary |
| User prompts & expected results | "User Prompts" section | Become scenarios |
| Autonomous triggers | "Autonomous Agent" section | If applicable |
| Data sources (read) | "Knowledge / data sources" table | Note connector status |
| Actions (write) | "Actions" table | Note auth requirements |
| Solution approach | "Solution ideas" section | Customer's preference |
| Dependencies/blockers | "Dependencies" section | Critical for MVP scoping |
| Contacts | "Key personnel" section | Who to escalate to |

### Architecture Decision

Score single vs multi-agent:

| Factor | Single Agent (0 pts) | Multi-Agent (1 pt) |
|--------|---------------------|-------------------|
| **Domain** | Same domain | Truly separate domains |
| **Data sources** | Shared data | Different systems per capability |
| **Team ownership** | Same team | Different teams own parts |
| **Reusability** | One-off agent | Specialists reusable elsewhere |
| **Instruction size** | Fits in 8000 chars | Would exceed 8000 chars |
| **Knowledge isolation** | Shared KB | Each needs own deep KB |

**Score: 0-2 → Single Agent | 3+ → Multi-Agent**

### MVP Scoping

Analyze dependencies and recommend what's buildable NOW vs. later:

```markdown
## MVP (Build Now)
- [Capabilities with available connectors/data]
- [Core user prompts that work with current access]

## Phase 2 (Build Later)
- [Capabilities blocked by connector/access dependencies]
- [Autonomous triggers requiring Power Automate flows]

## Blockers to Resolve
- [Missing connectors, TBD access, undefined rules]
```

### Gap Analysis

Flag anything missing that blocks a build:

| Required | Status | Action |
|----------|--------|--------|
| Scope boundaries (HANDLE/DECLINE/REFUSE) | Missing? | Infer from SDR context, flag for customer validation |
| Connector availability | TBD? | Flag as blocker or MVP limitation |
| Concrete definitions (e.g., "high-impact") | Vague? | Propose a definition, flag for validation |
| Instructions/persona | Missing? | Draft from SDR context |
| Model selection | Missing? | Recommend based on complexity |

### Generate agent-spec.md

Write `Build-Guides/[ProjectName]/agent-spec.md` using template from `templates/agent-spec.md`. The spec must include:

1. **Identity**: Name, description, model recommendation
2. **Instructions**: Full system prompt ready to paste into MCS
3. **Scope boundaries**: HANDLE / DECLINE / REFUSE table
4. **Knowledge sources**: With connector status (ready / not ready / TBD)
5. **Actions**: With connector status
6. **Scenarios**: 6-10 covering happy path, edge case, boundary, multi-turn
7. **Evals**: Input → expected output pairs ready for CSV generation
8. **MVP scope**: What to build now vs. later
9. **Build checklist**: Step-by-step execution plan

### Present to User

Before building, present:
1. Architecture recommendation with score
2. MVP scope recommendation
3. Any gaps/blockers found
4. Ask user to confirm or adjust

---

## PHASE 2: Build

### Pre-Build (CRITICAL)

**ALWAYS verify environment on every browser session:**
1. Navigate to copilotstudio.microsoft.com
2. Snapshot
3. Check environment in header
4. If wrong → switch
5. Confirm with user

### Build Order (Multi-Agent)

**Build Specialists First:**
1. Create agent (name, description, instructions from spec)
2. Add Knowledge Sources
3. Add Tools/Connectors
4. Enable "Allow other agents to connect" in Security
5. Test in isolation
6. Publish

**Then Build Orchestrator:**
1. Create orchestrator agent
2. Connect child agents (Agents tab → Add agent)
3. Configure routing in Instructions (`/AgentName` syntax)
4. Test routing
5. Publish

### Specialist Verification (Before Publishing)
- [ ] Tools tab has required connectors
- [ ] Knowledge tab has required sources
- [ ] Instructions match spec
- [ ] Security → "Allow other agents" enabled
- [ ] Quick test passes

---

## PHASE 3: Eval & Validate

### Generate evals.csv

From agent-spec.md scenarios and boundaries:

```csv
"question","expectedResponse","testMethodType","passingScore"
```

**Test method types (MCS-supported):**
- `GeneralQuality` - Overall response quality assessment
- `TextSimilarity` - Text similarity scoring (needs passingScore)
- `CompareMeaning` - Semantic meaning comparison (needs passingScore)
- `PartialMatch` - Response must contain expected text
- `ExactMatch` - Response must exactly match

**Passing scores:** Integer format ("70" not "0.7"), only for TextSimilarity and CompareMeaning.

**Mapping from spec:**
- Happy path scenarios → `GeneralQuality` or `CompareMeaning` with score "70"
- Boundary DECLINE scenarios → `PartialMatch` (must contain decline phrase)
- Boundary REFUSE scenarios → `PartialMatch` (must contain refusal phrase)

### Upload & Run

1. Navigate to agent's Evaluation tab
2. Import evals.csv (automated via hidden file input — see Playwright Patterns below)
3. Click Evaluate (runs async)

### Failure Analysis

| Type | Fix |
|------|-----|
| Knowledge Gap | Update sources |
| Retrieval Failure | Improve search terms |
| Grounding Violation | Strengthen instructions |
| Routing Failure | Expand trigger phrases |

---

## Component Selection — Live Research Framework

**CRITICAL: The categories below are a CHECKLIST of where to look, NOT a static inventory. MCS ships continuously — preview features, new MCP servers, new connectors, and UI changes can appear at any time. You MUST research broadly at decision time, not rely on cached knowledge.**

### Research Protocol (Run EVERY Phase 1)

For each agent capability, ask: **"What's the best way to implement this?"** then:

1. **WebSearch** for the capability + "Copilot Studio" + current year (catch preview/new features)
2. **MS Learn MCP** for official docs and code samples
3. **MCS UI snapshot** — browse the actual Add Tool / Add Knowledge / Model picker UI to see what's available RIGHT NOW (preview badges, new entries)
4. **GitHub search** if relevant (custom connectors, community MCP servers, sample repos)
5. Cross-reference findings across sources — if something shows in the UI but not in docs, it's likely preview. Note it.

**The goal: know every option that exists TODAY, not just what was documented last month.**

### Component Categories (Checklist — not exhaustive)

Evaluate across ALL of these for every capability. Items listed are examples to orient you — always verify current availability via research.

**1. MCP Servers (PREFERRED for M365)**
When a connector offers an MCP server, prefer MCP — gives agent full operation set via single tool. Research what MCP servers exist now (new ones ship regularly). Known examples: Outlook (email, calendar, contacts), SharePoint, Teams. But ALWAYS check for new ones.

Only use individual connector actions when no MCP exists or you need a single deterministic operation.

**2. Standard Connectors**
Built-in Power Platform connectors (Dataverse, Office 365 Users, OneDrive, Planner, etc.). Research the full connector catalog — don't assume you know every connector.

**3. Computer Use Tool**
Agent controls desktop via virtual mouse/keyboard. Research current status (preview/GA), supported models, cost, regions. Good for tasks with no API.

**4. Power Automate Flows**
Scheduling, loops, conditions, multi-step orchestration, HTTP calls, approval flows. Research current triggers and actions available.

**5. AI Builder / AI Tools**
Prompt actions, AI-powered extraction, classification, etc. Research what AI tools are available in the MCS "Add tool" menu now.

**6. Third-Party Premium Connectors**
Encodian, Plumsail, Muhimbi, Adobe, Salesforce, ServiceNow, etc. Research availability, cost, and whether a native option has appeared since last check.

**7. Custom Code**
Azure Functions, Custom Connectors, Open XML SDK. Last resort — high dev cost.

**8. Custom MCP Servers**
For external systems. Research community MCP servers on GitHub.

**9. Knowledge Sources**
SharePoint, uploaded files, Dataverse, public websites, Graph connectors, etc. Research what knowledge source types the MCS UI currently supports — new types appear in preview.

**10. Channels & Deployment**
Teams, web, custom canvas, telephony/voice, etc. Research current channel options.

**11. Agent Settings & Security**
Auth modes, access control, "allow other agents to connect", generative AI settings. Snapshot the Settings pages to see current options.

### UI Discovery Pattern

When researching components, **snapshot the actual MCS UI** to see what exists now:
- **Tools tab → "Add a tool"** — see all tool categories (connectors, MCP, Computer Use, AI tools, etc.)
- **Knowledge tab → "Add knowledge"** — see all knowledge source types
- **Model picker** — see all available models
- **Settings pages** — see all configuration options
- **Channels** — see deployment targets

This catches preview features that aren't in docs yet.

### Selection Output

For each capability in the spec, document:
1. **Research performed** (what sources checked, what was found)
2. **Options considered** (minimum 2, with current status: GA/Preview/Private Preview)
3. **What was selected and why**
4. **What was rejected and why**
5. **Status** (ready / needs setup / blocked)

---

## Architecture Decision: Agent vs MCP vs Computer Use

**Key question:** Is this a **tool**, an **expert**, or a **desktop task**?

| Type | Characteristics | Implementation |
|------|-----------------|----------------|
| **Tool** | Fetches data, executes actions, stateless | MCP Server / Connector |
| **Expert** | Has knowledge, makes judgments, has persona | Child Agent |
| **Desktop task** | No API available, human could do it in a GUI app | Computer Use tool |

---

## Multi-Agent Setup

### 1. Create Specialist
```
Create → New agent → name, description, instructions (focused on domain)
```

### 2. Enable Sharing
```
Settings → Security → "Allow other agents to connect" → Save → Publish
```

### 3. Connect to Orchestrator
```
Orchestrator → Agents tab → Add agent → Select specialist
```

### 4. Configure Routing
```
## Connected Specialists
/KYCAgent - Customer lookups
/QuotingAgent - Pricing, quotes

## Routing Rules
- Customer questions → /KYCAgent
- Pricing questions → /QuotingAgent
- Unclear → Ask clarifying question
```

---

## Playwright Automation Patterns (MCS UI)

**GOAL: Full automation. Minimize human-in-the-loop. The only required human step is the Preflight Gate confirmation.**

### File Upload (Dropzones)
MCS uses custom dropzones (not standard file inputs), but they have hidden `<input type="file">` elements underneath. **Do NOT ask the user to upload manually.**

```javascript
// Pattern: Find hidden file input and set files directly
await page.locator('input[type="file"]').first().setInputFiles('C:\\path\\to\\file.csv');
// Works for: eval uploads, knowledge file uploads, any dropzone
```

### Auth Popups (New Tab)
When creating connector connections, auth opens in a new tab.

```javascript
// Pattern: Wait for new tab → switch → select account → switch back
// 1. Click "Create" on connection dialog
// 2. Wait 3-5 seconds for popup
// 3. browser_tabs action=select index=1
// 4. browser_snapshot → find "Pick an account"
// 5. Click the correct account (match to environment)
// 6. Wait for redirect, tab auto-closes or switch back to tab 0
```

### Connector Connection Creation
```
Click "Not connected" → menu appears → "Create new connection" →
  Connection dialog → "Create" → handle auth popup →
  Back on tool page → "Add and configure"
```

### MCP Server Addition
```
Add tool → search/select from "Create new" → "Model Context Protocol" →
  Search for MCP name → Select → Add and configure
```

### Computer Use Tool Addition
```
Add tool → "Create new" → "Computer use" →
  Write instructions → "Add and configure" →
  Rename, update description → Save
```

### Model Selection
```
Click model combobox → snapshot to see options → click desired model →
  Wait for "Processing your request..." → wait for "completed successfully"
```

### Instructions (Lexical Editor)
```
Click "Edit" on Instructions → fill textbox with full text →
  Click "Save" → wait for confirmation
```

### Publishing
```
Click "Publish" → dialog appears → click "Publish" again →
  "Publishing in background" → click "Close"
```

### Evaluation Upload + Run (Full Automation)
```
Navigate to Evaluation tab (via +8 menu) → "Create a test set" →
  page.locator('input[type="file"]').first().setInputFiles(path) →
  Wait for "uploaded successfully" → click "Evaluate" →
  "Manage connections" dialog → select account → click "Run"
```

---

## Error Handling

**STOP → RESEARCH BROADLY → RETRY**

```
1. Don't retry same approach
2. Research across ALL sources:
   - WebSearch for the error message + "Copilot Studio"
   - MS Learn MCP for official troubleshooting
   - GitHub issues for known bugs / workarounds
   - MCS UI snapshot to verify current state
3. Log significant findings to learnings/
4. Retry with researched approach
```

---

## Key Principles

1. **Spec is the blueprint** - agent-spec.md drives the build
2. **Evals verify quality** - generate from spec, run after build
3. **Multi-agent first** - decompose into specialists (score objectively)
4. **Never assume** - research broadly (web + docs + UI + GitHub), present options
5. **MVP first** - build what's possible now, plan what's blocked
6. **Build specialists first** - children before orchestrator
7. **Verify environment** - every browser session
8. **Research errors** - don't blindly retry
9. **Capture learnings** - every build makes next build smarter
10. **Fill gaps before building** - incomplete spec → incomplete agent
11. **Full automation** - never ask user to do something manually that can be automated
12. **MCP over connectors** - prefer MCP servers over individual connector actions
13. **Research broadly** - use WebSearch, GitHub, MS Learn, and MCS UI snapshots — not just one source. Features ship continuously including undocumented previews

---

## Project Structure

```
Build-Guides/[Project]/
├── sdr-raw.md          # Raw SDR content (if from customer docs)
├── agent-spec.md       # THE build blueprint (extracted from SDR)
├── evals.csv           # Generated from spec for MCS upload
└── [source].docx/.md   # Original customer documents

learnings/
└── YYYY-MM-DD.md       # Daily learnings
```
