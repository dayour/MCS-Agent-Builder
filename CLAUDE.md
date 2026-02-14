# Claude Code Instructions for MCS Automation

## Overview

Automate Microsoft Copilot Studio (MCS) agent creation using a **hybrid build stack**: PAC CLI for lifecycle operations, Dataverse API for configuration, Code Editor YAML for topics, Direct Line API for testing, and Playwright MCP only for operations that have no API alternative.

**CRITICAL: Never assume components. Research BROADLY first (web, GitHub, MS Learn, community — not just one source), recommend based on requirements.**

---

## MANDATORY: Build Discipline — Verify-Then-Mark

**THIS IS A HARD STOP. Every build step must be verified before marking complete.**

### Rules

1. **Atomic tasks**: Every build step is a SEPARATE task in TaskCreate. "Generate CSV" + "upload to MCS" + "run eval" = THREE tasks, not one. Never combine steps that happen in different systems (local file vs MCS UI vs API).
2. **Verify after every action**: After each change, snapshot/read-back to confirm it worked:
   - Instructions updated → snapshot confirms text saved (not still in edit mode)
   - Tool added/removed → snapshot Tools tab confirms tool list matches spec
   - Trigger created/deleted → snapshot Triggers section confirms expected state
   - Published → snapshot confirms Published date is today
   - CSV generated → read file back to confirm content
   - Eval uploaded → snapshot Evaluation tab confirms test case count
3. **Never mark complete until verified**: If you can't verify, tell the user "I did X but couldn't verify Y" rather than silently assuming success.
4. **File ≠ deployment**: Writing a local file is NOT the same as uploading it to MCS. These are ALWAYS separate tasks.
5. **Environment check**: Before PAC CLI operations, verify the agent's environment matches PAC CLI's active profile (`pac auth list`). If they differ, use browser instead.
6. **End-of-build reconciliation**: After ALL changes, walk the spec's build checklist and snapshot-verify every item against the actual agent state. Report "Reconciliation: N/N items verified" or "Found M issues: [list]".

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

## Hybrid Build Stack — Tool Priority

**Use the best tool for each job. Playwright is the last resort, not the default.**

### Tool Priority Order

| Priority | Tool | Use For |
|----------|------|---------|
| 1 | **PAC CLI** | Agent creation, publishing, status checks, solution export/import, listing agents |
| 2 | **Dataverse API** | Instructions update, knowledge file upload, security settings, agent deletion |
| 3 | **Code Editor YAML** | Topic authoring, adaptive cards, branching logic, trigger phrases |
| 4 | **Direct Line API** | Evaluation / testing (send messages, compare responses) |
| 5 | **Playwright MCP** | Model selection, tool/connector addition, OAuth connections, child agent connection, generative AI settings, MCS-only UI operations |

**Detailed capabilities per layer:** See `knowledge/cache/api-capabilities.md`
**Decision flow and build phase mapping:** See `knowledge/frameworks/tool-priority.md`

---

## Agent Teams (Experimental)

Agent Teams enables bidirectional communication between specialist teammates who challenge each other's work. The lead (you) orchestrates, teammates do the reasoning/generation, and the lead handles MCS execution (Playwright, PAC CLI, Dataverse).

**Enabled via:** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `.claude/settings.json`

### Teammates

| Teammate | Role | Key Strength |
|----------|------|-------------|
| **Research Analyst** | Discover MCS capabilities across multiple sources | Prevents false limitation claims |
| **Prompt Engineer** | Write MCS agent instructions + review/sharpen our own skill files and agent definitions when quality drops | Sharp instructions, correct `/` references |
| **Topic Engineer** | Generate validated YAML topics + adaptive cards | Syntax-correct YAML, channel-safe cards |
| **QA Challenger** | Review ALL outputs, find gaps, challenge claims | Catches errors before they hit MCS |
| **Repo Checker** | Validate repo integrity after changes | Catches broken paths, stale docs, drift |

Definitions: `.claude/agents/` (research-analyst.md, prompt-engineer.md, topic-engineer.md, qa-challenger.md, repo-checker.md)

### When to Use Agent Teams

**During MCS workflow skills:**
- **Research phase** (`/mcs-research`): Research Analyst searches for external connectors/MCP (only if needed), Prompt Engineer writes instructions (single pass), QA Challenger reviews instructions + generates scenarios (single pass each). Topic Engineer is NOT used in research.
- **Build phase** (`/mcs-build`): Topic Engineer generates YAML, QA Challenger reviews before execution
- **Eval phase** (`/mcs-eval`): QA Challenger analyzes failures, maps back to root causes

**During general development (Tier 2-3 checks):**
- **Tier 2**: Repo Checker in background after 3+ file changes or code changes
- **Tier 3**: QA Challenger before irreversible decisions (schema, workflow, architecture)

### Workflow: Lead + Teammates

```
Lead spawns team for build:
  Research Analyst → discovers components (parallel)
  Prompt Engineer → writes instructions
  Topic Engineer → generates topic YAML + adaptive cards
  QA Challenger → reviews all outputs, challenges, finds gaps

  Teammates communicate directly:
    QA → Prompt Engineer: "Instructions reference /ToolName that isn't configured"
    QA → Topic Engineer: "YAML node ID duplicated on line 14"
    Topic Engineer → Prompt Engineer: "Your instructions expect Topic.orderStatus but no topic initializes it"

Lead executes validated outputs:
  - Pastes YAML into MCS code editor (Playwright)
  - Sets instructions via Dataverse API
  - Configures tools/model (Playwright)
  - Publishes (PAC CLI)
```

### Rules

- **Lead does NOT generate instructions, YAML, or cards directly.** Delegate to teammates.
- **Lead DOES handle all MCS execution** (Playwright, PAC CLI, Dataverse API) since MCP access in teammates is unreliable.
- **QA Challenger reviews EVERY teammate output** before the lead executes it.
- **Teammates challenge each other** — bidirectional communication is the point.
- **All generated artifacts go to files** (Build-Guides/[Project]/topics/, instructions, etc.) so the lead can read and execute them.

### Proactive Quality Checks — 3 Tiers

Quality checks scale with risk. Not every response needs a full team debate.

**Tier 1: Self-Check (always, after any edits)**
After any batch of edits, do a quick inline verification: grep for broken references, re-read changed files, verify cross-references. Takes 10-20 seconds, catches obvious issues. No teammate needed.

**Tier 2: Background Repo Check (after significant changes)**
After changing 3+ files or any code changes, spawn Repo Checker in background. It runs async — don't block, keep working. Results come back in ~60 seconds. Fix issues if found.

**Tier 3: QA Challenge (before irreversible decisions only)**
Before committing to designs that are hard to undo — schema changes, workflow redesign, architecture decisions affecting multiple files. QA Challenger reviews and challenges the approach. This blocks work but is worth the wait for big decisions.

| Trigger | Tier | Blocks Work? |
|---------|------|-------------|
| Any file edits | Tier 1: self-check (grep + re-read) | No — inline, 10 sec |
| 3+ file changes or code changes | Tier 2: Repo Checker in background | No — runs async |
| Schema change, workflow redesign, architecture decision | Tier 3: QA Challenger | Yes — worth the 2-3 min |
| Before any commit | Tier 2: Repo Checker | No — runs async |
| Simple answer, status check, brainstorming | None | — |

---

## Available Tools

| Tool | Purpose |
|------|---------|
| **PAC CLI** | Agent lifecycle: create, publish, list, status, solution ALM (`pac copilot`, `pac solution`) |
| **Dataverse API** | Agent config: instructions, knowledge, settings, publish (via HTTP/PowerShell) |
| **Code Editor YAML** | Topic authoring: conversations, cards, branching (paste into MCS code editor) |
| **Direct Line API** | Agent testing: send messages, compare responses (`tools/direct-line-test.js`) |
| **Playwright MCP** | MCS UI automation for operations with no API (`@playwright/mcp`) |
| **WorkIQ MCP** | M365 context: emails, meetings, documents, Teams, people (`workiq mcp`) |
| **Microsoft Learn MCP** | Official docs, reference, code samples |
| **WebSearch** | Latest announcements, preview features, community discoveries, GitHub |
| **WebFetch** | Deep-read blog posts, GitHub READMEs, release notes |

---

## Bug Reports & Suggestions

Users file bugs and suggestions via the sidebar buttons, which invoke `/bug` and `/suggest` skills through the embedded terminal.

**Issue creation rules:**
- Repo: always `microsoft/CAD-MCS-Builder`
- Labels: `bug` for bugs, `enhancement` for suggestions
- Always preview title + body before submitting — never auto-submit
- Use HEREDOC for the `--body` argument to preserve markdown formatting
- Auto-enrich with session context (project, environment, skill, errors) when available
- Keep titles under 70 characters (`Bug: ...` or `Suggestion: ...`)

---

## Learning System — Continuous Improvement

The system captures learnings from every build and makes them available in future research. This creates a **feedback loop**: builds generate insights → insights improve future research → better specs → better builds.

### Knowledge Layers

| Layer | Location | What | Refresh |
|-------|----------|------|---------|
| **Official cache** | `knowledge/cache/` | MCS capabilities from MS Learn + WebSearch | Auto (session start + before research) |
| **Experience learnings** | `knowledge/learnings/` | Insights from past builds, user feedback, failures | After every build/research/eval |
| **Stable patterns** | `knowledge/patterns/` | YAML syntax, Playwright patterns, Dataverse API | Manual (rarely changes) |
| **Decision frameworks** | `knowledge/frameworks/` | Component selection, architecture scoring | Manual (rarely changes) |

### Learnings Capture Points

| When | What Gets Captured | How |
|------|-------------------|-----|
| **Post-build** | Spec vs actual diff, errors & fixes, new discoveries, build method insights | Structured summary → user confirms → written to topic files |
| **Post-research** | New components found, cache corrections, customer/industry patterns | Summary if discoveries exist → user confirms |
| **Post-eval** | Failure patterns, eval method insights, scoring calibration | Summary if insights exist → user confirms |
| **Anytime** | User says "remember that X" or provides feedback | Write directly to relevant topic file |

### Learnings Topic Files (`knowledge/learnings/`)

| File | Consulted During |
|------|-----------------|
| `connectors.md` | `/mcs-research` Phase B (component research) |
| `integrations.md` | `/mcs-research` Phase B (system integration choices) |
| `architecture.md` | `/mcs-research` Phase C (architecture scoring) |
| `instructions.md` | `/mcs-research` Phase C (Prompt Engineer) |
| `topics-triggers.md` | `/mcs-research` Phase D + `/mcs-build` Step 4 |
| `eval-testing.md` | `/mcs-research` Phase D + `/mcs-eval` |
| `build-methods.md` | `/mcs-build` (tool selection per step) |
| `customer-patterns.md` | `/mcs-research` Phase A (document comprehension) |

### How Learnings Are Used

During research, learnings are presented as **additional options, not defaults**:

> "Official docs recommend Connector X. However, in a past build for [customer], we found Y works better because [reason] (confirmed in 3 builds). Consider both options."

Higher `Confirmed` count = higher weight, but the user always decides.

### Confidence Levels

| Confirmed In | Weight | Presentation |
|-------------|--------|-------------|
| 1 build | Low | "In one past build, we observed..." |
| 2-3 builds | Medium | "Based on multiple builds, we recommend considering..." |
| 4+ builds | High | "Consistently confirmed: ..." |

---

## Core Philosophy

### 1. Brief-Driven Build
The **brief.json** is the single source of truth. Everything flows from it:
- SDR/intake → **brief.json** → Build → Eval
- The brief contains everything needed to execute a build (instructions, tools, model, topics, MVP scope)
- If the brief has gaps, fill them BEFORE building (research catches gaps early)
- The dashboard reads/writes brief.json. The build skill reads it. Reports are generated from it.

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

### 5. Minimize Playwright — Use APIs First
Every browser interaction is fragile. Before using Playwright, check if PAC CLI, Dataverse API, Code Editor YAML, or Direct Line API can handle the operation. See "Hybrid Build Stack" section above.

---

## Intake Paths

Requirements come in one of three ways. Handle each:

### Path A: SDR Files in Project Folder
Customer provides Solution Discovery Report (SDR) documents (`.docx`, `.md`, `.pdf`).

1. Check `Build-Guides/[ProjectName]/` for SDR files
2. Convert `.docx` files to `.md` using pandoc if needed
3. **(Optional) Run `/mcs-context [CustomerName]`** → pull M365 history via WorkIQ
4. Run **Research** (`/mcs-research`) → reads docs, identifies agents, researches components, enriches brief.json + generates evals

### Path B: Pasted in Chat
User pastes requirements, SDR content, or use case description directly in conversation.

1. Create project folder: `Build-Guides/[ProjectName]/`
2. Save raw input as `sdr-raw.md` in `docs/` for reference
3. **(Optional) Run `/mcs-context [CustomerName]`** → pull M365 history via WorkIQ
4. Run **Research** (`/mcs-research`) → reads docs, identifies agents, full enrichment

### Path C: No Input — Ask User
No SDR or requirements available.

1. Ask: "What are we building? Describe the agent's purpose, users, and key scenarios."
2. **(Recommended) Run `/mcs-context [CustomerName]`** → pull M365 history via WorkIQ
3. Create project folder and save user input as `sdr-raw.md`
4. Run **Research** → **Build** → **Evaluate**

---

## Workflow

```
CREATE → UPLOAD → RESEARCH → [UPDATE] → BUILD → EVALUATE
                  /mcs-research  /mcs-update  /mcs-build  /mcs-eval
```

| Step | Skill | Input | Output | Agent Teams |
|------|-------|-------|--------|-------------|
| **Init** | `/mcs-init` | Project name | Folder structure | None |
| **Context** | `/mcs-context` | Customer name | customer-context.md | None |
| **Research** | `/mcs-research {projectId}` | docs/ | brief.json (fully enriched) + evals.csv per agent | RA (if needed) + PE + QA |
| **Update** | `/mcs-update {projectId}` | new/changed docs/ | brief.json (sections updated) | None |
| **Build** | `/mcs-build {projectId} {agentId}` | brief.json | MCS agent (published) + build-report.md | TE + QA |
| **Evaluate** | `/mcs-eval {projectId} {agentId}` | brief.json evals | brief.json evalResults | QA |

> **`/mcs-context`** is optional but recommended — it pulls all M365 history for a customer via WorkIQ MCP and pre-fills 60-80% of research.

---

## Skills (9 total — 7 workflow + 2 utility)

| Skill | Purpose | Dashboard Button |
|-------|---------|-----------------|
| **mcs-init** | Create project folder structure | None (API) |
| **mcs-context** | Pull M365 history via WorkIQ | None (CLI) |
| **mcs-research** | Read docs, identify agents, research components, design architecture, enrich brief.json + generate evals | **Research** |
| **mcs-update** | Incremental brief update — analyzes new/changed docs, maps to agents, updates affected brief.json sections | **Update Brief** |
| **mcs-build** | Build agent(s) in MCS via hybrid stack | **Build** |
| **mcs-eval** | Run eval tests, write results to brief.json | **Evaluate** |
| **mcs-refresh** | Refresh knowledge cache files | None (CLI) |
| **bug** | File bug reports via `gh` CLI | Sidebar button |
| **suggest** | File feature suggestions via `gh` CLI | Sidebar button |

---

## INIT: Initialize Project (`/mcs-init`)

Create project folder, detect SDR files, convert `.docx` → `.md`, guide user to next step.

---

## CONTEXT: Pull Customer History (`/mcs-context`)

Use WorkIQ MCP to search all M365 data (emails, meetings, documents, Teams, people) for a customer name. Compiles findings into:

- **`customer-context.md`** — Narrative summary: stakeholders, history, requirements, decisions, pain points, documents, gaps
- **`customer-interactions.csv`** — Structured timeline: date, type, participants, summary, source

**Prerequisites:** WorkIQ CLI authenticated (`workiq ask -q "test"` in terminal for first-time setup).

---

## RESEARCH: Read Docs + Full Enrichment (`/mcs-research`)

**Goal:** Read all project documents, identify agents, research MCS components, and produce fully enriched brief.json (the single source of truth) + evals.csv per agent.

**Input:** `/mcs-research {projectId}` (first run) or `/mcs-research {projectId} {agentId}` (re-run after feedback)
**Reads:** `Build-Guides/{projectId}/docs/` + `customer-context.md` (if exists) + `knowledge/cache/` + `knowledge/learnings/`
**Writes:** `brief.json` (all fields including instructions) + `evals.csv` per agent

**4 phases (optimized — targeted research, single-pass QA):**
1. **Document comprehension & agent identification** — lead reads all docs, cross-references, identifies agents, extracts data, generates informed open questions using MCS cache
2. **Component research (targeted)** — lead resolves stable categories from cache (models, channels, triggers, knowledge). Research Analyst spawned ONLY for external systems needing live MCP/connector lookup
3. **Architecture + instructions (single-pass)** — lead scores architecture, Prompt Engineer writes instructions (self-verified), QA Challenger reviews once (no iteration loop)
4. **Scenarios + evals** — QA Challenger generates test cases AND classifies topic types in one pass

**Uses Agent Teams:** Research Analyst (only if external systems need lookup), Prompt Engineer (instructions), QA Challenger (review + scenarios). Topic Engineer is NOT used in research — reserved for `/mcs-build`.

**Iteration:** Customer reviews brief in the dashboard, answers open questions, then user re-runs `/mcs-research {projectId} {agentId}` to re-enrich.

---

## UPDATE: Incremental Brief Update (`/mcs-update`)

**Goal:** Detect new/changed documents, resolve which agent(s) they affect, and surgically update only the affected brief.json sections — preserving user edits.

**Input:** `/mcs-update {projectId}`
**Reads:** `doc-manifest.json` + new/changed docs in `docs/`
**Writes:** `brief.json` (affected sections only) + updated `doc-manifest.json`

**When to use:** After `/mcs-research` has completed and user uploads 1-2 more documents. Avoids the full 4-phase research pipeline.

**Flow:** Diff docs vs manifest → resolve agent targeting (tagged or auto-detected) → check drastic change thresholds → analyze new content → show impact summary → user confirms → merge changes preserving user edits → update manifest

**Drastic change thresholds** (any triggers recommendation for full `/mcs-research`): new agent described, architecture change, >4 sections affected, problem statement fundamentally changes, new doc volume > 2x existing.

**Merge rules:** Never overwrite `instructions` or answered `openQuestions`. Append-only for `capabilities[]`, `boundaries.handle/decline/refuse`, `integrations[]`, `conversations.topics[]`, `evals`. Flag conflicts in `_updateFlags` for user review.

**No Agent Teams, no web research.** Lightweight document analysis only.

---

## BUILD: Construct Agent (`/mcs-build`)

**Goal:** Build and publish agent(s) in Copilot Studio using the hybrid stack.

**Input:** `/mcs-build {projectId} {agentId}`
**Reads:** `brief.json` (the single source of truth — architecture, instructions, tools, model, everything)
**Writes:** `brief.json` buildStatus field

**Build Account & Environment Gate (MANDATORY FIRST STEP):**
1. Read `tools/session-config.json` for available accounts/environments
2. Ask user to explicitly pick account + environment via `AskUserQuestion`
3. Set PAC CLI profile to match (`pac auth select --index N`)
4. Output build stamp with confirmed target before proceeding

**Routes by architecture:**
- `Single Agent` → standalone build (PAC CLI + Dataverse + Playwright + YAML)
- `Multi-Agent` → specialists first, then orchestrator with child connections

**Build steps:** Account Gate → Cache Check → Scaffold (PAC CLI) → Instructions & Knowledge (Dataverse API) → Tools & Model (Playwright) → Topics (Code Editor YAML) → Publish (PAC CLI) → Reconciliation → `build-report.md` → Learnings Capture → Update brief.json buildStatus

**Preflight Gate required** before any Playwright interaction (verifies browser matches the account gate selection).

---

## EVAL: Test & Validate (`/mcs-eval`)

**Goal:** Run evaluation tests and write results back to brief.json for dashboard display.

**Input:** `/mcs-eval {projectId} {agentId}`
**Reads:** `brief.json` evals array or `evals.csv`
**Writes:** `brief.json` evalResults + `evals-results.json`

**Preferred method:** Direct Line API (`tools/direct-line-test.js`)
**Fallback:** Native MCS eval via Playwright

**Test method types:** See `knowledge/cache/eval-methods.md`

### Failure Analysis

| Type | Fix |
|------|-----|
| Knowledge Gap | Update knowledge sources |
| Retrieval Failure | Improve search terms in instructions |
| Grounding Violation | Strengthen boundaries in instructions |
| Routing Failure | Expand trigger phrases, clarify routing rules |

---

## Component Selection & Architecture Decisions

**Component selection framework:** See `knowledge/frameworks/component-selection.md`
**Architecture scoring (single vs multi-agent):** See `knowledge/frameworks/architecture-scoring.md`
**Current inventories:** See `knowledge/cache/` (MCP servers, connectors, models, triggers, etc.)

**CRITICAL:** Always check cache freshness before using. If > 7 days old, run `/mcs-refresh` or do live research before deciding.

---

## Patterns & References

**Playwright UI patterns:** See `knowledge/patterns/playwright-patterns.md`
**Code Editor YAML reference:** See `knowledge/patterns/yaml-reference.md`
**Topic YAML templates:** See `knowledge/patterns/topic-patterns/`
**Dataverse API patterns:** See `knowledge/patterns/dataverse-patterns.md`
**Trigger types:** See `knowledge/cache/triggers.md`

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
3. Log significant findings to knowledge/learnings/
4. Retry with researched approach
```

---

## Key Principles

1. **Brief is the blueprint** — brief.json drives the build (single source of truth)
2. **Evals verify quality** — generate from spec, run after build
3. **Multi-agent first** — decompose into specialists (score objectively)
4. **Never assume** — research broadly (web + docs + UI + GitHub), present options
5. **MVP first** — build what's possible now, plan what's blocked
6. **Build specialists first** — children before orchestrator
7. **Verify environment** — every browser session (Preflight Gate)
8. **Research errors** — don't blindly retry
9. **Capture learnings** — every build makes next build smarter
10. **Fill gaps before building** — incomplete brief → incomplete agent
11. **Minimize Playwright** — use PAC CLI, Dataverse API, Code Editor YAML, Direct Line first
12. **MCP over connectors** — prefer MCP servers over individual connector actions
13. **Research broadly** — use WebSearch, GitHub, MS Learn, and MCS UI snapshots
14. **API first, browser last** — every Playwright interaction is a fragility risk; prefer API alternatives

---

## Knowledge System

Cached inventories, stable patterns, and decision frameworks live in `knowledge/`:

- **`knowledge/cache/`** — 18 quick-reference cheat sheets covering MCS capabilities: options, limits, gotchas, and decision tables. For step-by-step details, use MS Learn MCP. Each file has freshness metadata. Check before architecture decisions.
- **`knowledge/patterns/`** — Stable HOW-TO references (YAML syntax, Playwright patterns, Dataverse API patterns, topic templates).
- **`knowledge/frameworks/`** — Decision frameworks (component selection, architecture scoring, tool priority).

**Tiered refresh:**
- **Tier 1 (build-critical):** triggers, models, mcp-servers, connectors, knowledge-sources, channels — auto-refreshed at session start if > 7 days old
- **Tier 2 (build-phase):** api-capabilities, instructions-authoring, generative-orchestration, adaptive-cards, ai-tools-computer-use, power-automate-integration — refreshed before `/mcs-build` if stale
- **Tier 3 (reference):** eval-methods, security-auth, agent-lifecycle, limits-licensing, powerfx-variables, conversation-design — refreshed on demand via `/mcs-refresh`

**Freshness rules:**
- < 7 days old → use as-is
- 7-30 days old → Tier 1: auto-refresh. Tier 2-3: flag, refresh on demand
- > 30 days old → refresh immediately regardless of tier

**After live research, always UPDATE the cache file** with findings + new `last_verified` date.

See `knowledge/README.md` for full details.

---

## Project Structure

```
.github/
├── ISSUE_TEMPLATE/         # Bug report, feedback & suggestion templates (3)
└── CODEOWNERS              # Code ownership rules
start.js                    # One-command launcher (npm start)
package.json                # Node dependencies & scripts

.claude/
├── settings.json           # MCP servers, permissions, Agent Teams env flag
├── skills/                 # 9 skills (7 workflow + 2 utility)
│   ├── mcs-init/           # Create project folder
│   ├── mcs-context/        # Pull M365 history via WorkIQ
│   ├── mcs-research/       # Read docs + full enrichment → brief.json + evals
│   ├── mcs-update/         # Incremental brief update from new/changed docs
│   ├── mcs-build/          # Build agent(s) in MCS via hybrid stack
│   ├── mcs-eval/           # Run eval tests → brief.json evalResults
│   ├── mcs-refresh/        # Refresh knowledge cache
│   ├── bug/                # File bug reports via gh CLI
│   └── suggest/            # File feature suggestions via gh CLI
└── agents/                 # Agent Teams teammate definitions
    ├── research-analyst.md # MCS capability researcher
    ├── prompt-engineer.md  # Instructions & Custom Prompt specialist
    ├── topic-engineer.md   # YAML, adaptive cards & flow specialist
    ├── qa-challenger.md    # Adversarial reviewer & gap finder
    └── repo-checker.md     # Cross-reference & sync validator

app/                        # Dashboard application
├── server.py               # FastAPI backend (CRUD, file upload, SPA serving)
├── terminal-server.js      # Node-pty WebSocket server (embedded Claude Code terminal)
├── generate-data.py        # Build-Guides scanner (used by server.py)
├── dist/                   # Vite production build output (gitignored)
└── frontend/               # React + TypeScript SPA (Vite + shadcn/ui)
    ├── src/
    │   ├── pages/          # Route pages (Index, ProjectPage, BriefEditor, etc.)
    │   ├── components/     # UI components (brief sections, terminal, layout)
    │   ├── stores/         # Zustand stores (projects, project, brief, terminal)
    │   ├── lib/            # Utilities (api client, transforms, readiness, reports)
    │   ├── types/          # TypeScript types (domain + API response shapes)
    │   └── config/         # App config (brief sections)
    ├── package.json        # Frontend dependencies
    └── vite.config.ts      # Build config (outputs to app/dist/)

knowledge/
├── learnings/              # Experience-based insights from past builds (8 topic files)
├── cache/                  # 18 quick-reference cheat sheets (with freshness metadata)
│   ├── triggers.md, models.md, mcp-servers.md, connectors.md
│   ├── knowledge-sources.md, channels.md, api-capabilities.md, eval-methods.md
│   ├── generative-orchestration.md, security-auth.md, instructions-authoring.md
│   ├── powerfx-variables.md, agent-lifecycle.md, power-automate-integration.md
│   └── adaptive-cards.md, ai-tools-computer-use.md, limits-licensing.md, conversation-design.md
├── patterns/               # Stable HOW-TO references
│   ├── yaml-reference.md, playwright-patterns.md, dataverse-patterns.md
│   └── topic-patterns/     # 9 reusable YAML templates
└── frameworks/             # Decision frameworks
    ├── component-selection.md, architecture-scoring.md
    └── tool-priority.md

templates/                  # Project scaffolding templates
├── brief.json              # Agent brief schema — THE single source of truth

tools/
├── direct-line-test.js     # Direct Line API test runner
├── dataverse-helper.ps1    # PowerShell Dataverse Web API helper
├── fetch-instructions.ps1  # Fetch agent instructions from Dataverse
├── pac-mcp-wrapper.js      # PAC CLI MCP server wrapper
├── session-config.example.json  # Account/environment config template
└── git-hooks/pre-commit    # Core file protection hook (installed by start.js)

Build-Guides/[Project]/     # Per-project work (gitignored)
├── agents/[name]/
│   ├── brief.json          # THE source of truth — design, instructions, tools, evals, build status
│   ├── build-report.md     # Customer-shareable build summary (generated after /mcs-build)
│   ├── evals.csv           # Evaluation test cases (from /mcs-research)
│   ├── evals-results.json  # Direct Line test results (from /mcs-eval)
│   └── topics/             # Generated topic YAML files
├── docs/                   # Uploaded customer documents
├── doc-manifest.json       # Document hash manifest (from /mcs-research, for /mcs-update)
└── customer-context.md     # M365 history (from /mcs-context, optional)

```

---

## PAC CLI Reference (Quick)

```powershell
# List agents
pac copilot list

# Create from template
pac copilot create --displayName "Name" --schemaName "cr_name" --solution "SolutionName" --templateFileName template.yaml

# Publish
pac copilot publish --bot <bot-id-or-schema-name>

# Check status
pac copilot status --bot-id <bot-id>

# Extract template from existing agent
pac copilot extract-template --bot <bot-id> --templateFileName output.yaml

# Solution export/import (ALM)
pac solution export --name "SolutionName" --path "Solution.zip"
pac solution import --path "Solution.zip" --publish-changes

# Check auth
pac auth list
```
