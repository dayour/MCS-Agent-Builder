# Claude Code Instructions for MCS Automation

## Overview

Automate Microsoft Copilot Studio (MCS) agent creation using a **hybrid build stack**: PAC CLI for listing agents and solution ALM, MCS LSP Wrapper for component sync (instructions, model, topics, tools, knowledge, settings), Island Gateway API for model catalog, component reads, connected agent setup, and eval upload/run (makerevaluations), Dataverse API for agent creation (POST + PvaProvision), file uploads, bot name PATCH, PvaPublish, and security, Direct Line API for testing, and user-guided manual steps for new OAuth connections and Computer Use tool setup.

**CRITICAL: Never assume components. Research Microsoft-first (MCS built-in → Power Platform → Azure → M365 connectors), escalate to broad research only for external systems. Recommend based on requirements.**

---

## MANDATORY: Dual Model Co-Generation & Review — Every Non-Trivial Task

**For every task that isn't a simple one-liner, fire GPT-5.4 in parallel with your own work.** GPT is both a **co-generator** (produces content independently for merging) and a **reviewer** (validates content after generation). This applies to ALL work — MCS builds, code writing, reviews, cleanup, app updates, architecture decisions, documentation.

### When to Fire GPT (default: yes)

| Task Type | GPT Action | How |
|-----------|-----------|-----|
| **Writing MCS instructions** | **Co-generate** independently, PE merges | `generate-instructions --brief <path>` |
| **Generating eval tests** | **Co-generate** independently, QA merges | `generate-evals --brief <path>` |
| **Generating topic YAML** (3+ nodes) | **Co-generate** independently, TE merges | `generate-topics --topic-spec <path> --brief <path>` |
| **Component selection** | GPT **reviews** RA's choices | `review-components --brief <path>` |
| **Flow spec design** | GPT **reviews** FD's output | `review-flow --file <path> --brief <path>` |
| **Writing code** (3+ lines) | GPT **reviews** after writing | `review-*` or inline `chatCompletion` |
| **Reviewing/auditing** | GPT **reviews** same artifact in parallel | Fire GPT review alongside your own analysis |
| **Architecture/design decisions** | GPT gives a second opinion | Send decision context, get alternative perspective |
| **All other non-trivial tasks** | GPT **reviews** after completion | Appropriate `review-*` command |

### When to Skip GPT

- Single-line fixes, typos, trivial renames
- Pure git operations (commit, push, branch)
- File reads, searches, status checks
- Trivial topics (< 3 nodes) — co-generation skipped, review still runs
- Incremental instruction deltas (not full rewrites)
- When GPT is unavailable (exit code 3) — proceed without it

### Merge Protocol for Co-Generation

Co-generation produces two independent outputs that must be merged. Each content type has its own merge rules:

**Instructions (PE merges):**
- Constraints: union, stricter wins on conflicts
- Boundaries: union, "refuse" > "redirect" > "ignore"
- Response format: take version with tiered length floors
- Examples: pick best from each (aim for 2-3 varied)
- Trim to 8,000 chars after merge

**Topics (TE merges):**
- Validate both with om-cli — only merge if at least one passes
- Both pass: merge node-by-node (better error handling, richer cards, union of trigger phrases). Prefer Claude's structure on divergence.
- Only one passes: use the valid one
- Neither passes: fix Claude's first (has om-cli tooling)

**Evals (QA merges):**
- Deduplicate by intent (>70% keyword overlap = same test)
- Union of unique tests
- Stricter expected answers for similar tests
- Recalculate coverage distribution after merge

### Merge Protocol for Reviews

- **Union of findings** — if either model flags something, it's worth looking at
- **Stricter wins on conflicts** — the more conservative assessment prevails
- **Flag divergence** — when opinions differ significantly, tell the user both positions
- **Never block on GPT** — if GPT is slow or fails, proceed with Claude's work alone

### How It Works

GPT-5.4 runs via the GitHub Copilot Responses API (`tools/lib/openai.js`). Auth is automatic via `gh auth token` with `copilot` scope. For structured reviews and co-generation, use `tools/multi-model-review.js` (11 commands: 3 co-generation + 5 review + 1 scoring + 1 utility + 1 info). For ad-hoc reviews, call `chatCompletion()` directly from a temp script via Bash.

---

## MANDATORY: Build Discipline — Verify-Then-Mark

**THIS IS A HARD STOP. Every build step must be verified before marking complete.**

### Rules

1. **Atomic tasks**: Every build step is a SEPARATE task in TaskCreate. "Generate CSV" + "upload to MCS" + "run eval" = THREE tasks, not one. Never combine steps that happen in different systems (local file vs MCS UI vs API).
2. **Verify after every action**: After each change, snapshot/read-back to confirm it worked:
   - Instructions updated → LSP pull confirms text saved
   - Tool added/removed → LSP pull or `add-tool.js list-connections` confirms tool list matches spec
   - Trigger created/deleted → LSP pull confirms expected state
   - Published → `pac copilot status` or Dataverse query confirms Published date is today
   - CSV generated → read file back to confirm content
   - Eval uploaded → Dataverse query confirms test case count
3. **Never mark complete until verified**: If you can't verify, tell the user "I did X but couldn't verify Y" rather than silently assuming success.
4. **File ≠ deployment**: Writing a local file is NOT the same as uploading it to MCS. These are ALWAYS separate tasks.
5. **Environment check**: Before PAC CLI operations, verify the agent's environment matches PAC CLI's active profile (`pac auth list`). If they differ, ask user to switch PAC CLI profile.
6. **LSP workspace freshness**: Always `pull → modify → push` when using the LSP Wrapper. Never modify workspace `.mcs.yml` files without pulling first — stale row versions cause `ConcurrencyVersionMismatch` errors and force a re-pull that overwrites your changes.
7. **Never skip MVP items**: Attempt EVERY item tagged `phase: "mvp"`. If it fails, document: what was tried, the specific error, what's needed to unblock. A failed attempt with a clear error is valuable — a silently skipped item is a build gap.
8. **End-of-build reconciliation + QA validation**: After ALL changes, walk the spec's build checklist and snapshot-verify every item against the actual agent state. Every MVP item must show MATCH, PARTIAL, FAILED, or BLOCKED — never SKIPPED. Then spawn QA Challenger (Step 5.5) to validate brief-vs-actual, cross-references, and deviation impact. QA verdict determines whether the build proceeds to the report or escalates issues.

---

## MANDATORY: User-Guided Manual Steps

Some operations require the user to perform actions in the Copilot Studio web UI. When these arise, we:

1. Tell the user exactly what to do (connector name, settings path, buttons to click)
2. Wait for user confirmation
3. Verify via API (LSP pull, Dataverse query, `add-tool.js list-connections`) that the change took effect
4. Continue the build

### When Manual Steps Are Needed
- **New OAuth connection creation** — user creates in MCS portal, we verify via `add-tool.js list-connections`
- **Computer Use tool addition** — user follows step-by-step guide in MCS UI
- **Any operation where API verification shows a gap** — user checks MCS UI and reports

### Rules
- NEVER leave the user without clear, numbered step-by-step instructions
- ALWAYS verify via API after user confirms — trust but verify
- NEVER block on manual steps if an API alternative exists

---

## Hybrid Build Stack — Tool Priority

**Use the best tool for each job. User-guided manual steps as last resort.**

### Tool Priority Order

| Priority | Tool | Use For |
|----------|------|---------|
| 1 | **PAC CLI** | Listing agents, solution ALM |
| 2 | **MCS LSP Wrapper** | Instructions, model, topics, knowledge (sites/URLs), full component sync (`tools/mcs-lsp.js`) |
| 3 | **Island Gateway API** | Model catalog, component reads, routing, settings, eval upload/run (`tools/island-client.js`) |
| 4 | **Flow Manager** | Power Automate cloud flow CRUD + composition — trigger creation, flow composition from specs, validation, connector schema discovery, schedule/message updates, activate/deactivate (`tools/flow-manager.js` + `tools/lib/flow-composer.js` + `tools/lib/connector-schema.js`) |
| 5 | **Dataverse API** | File uploads (PDF/DOCX), bot name PATCH, PvaPublish, security, deletion |
| 6 | **Direct Line API** | Evaluation / testing (send messages, compare responses) |
**Detailed capabilities per layer:** See `knowledge/cache/api-capabilities.md`
**Decision flow and build phase mapping:** See `knowledge/frameworks/tool-priority.md`

### Unified Auth Gate (all layers verified together)

Account + environment selection determines everything. **Never assume the environment** — always confirm with the user, even on resume. An account can have multiple environments.

| Layer | What It Covers | How | Required? |
|-------|---------------|-----|-----------|
| **Azure CLI** | LSP, Island Gateway, Dataverse, Direct Line | `az login --tenant` (auto, browser popup) | **Yes — blocks build** |
| **Dataverse API** | Environment reachable, token works | `az account get-access-token` + `GET /bots?$top=1` | **Yes — blocks build** |
| **PAC CLI** | Listing agents, solution ALM | `pac auth select` (automatic) | **No — best-effort, API fallback** |

**Build gate:** Two-step selection (account → environment) + three-layer verification. **Eval/fix:** re-verify against `buildStatus` values + Dataverse reachable check.

---

## Agent Teams (Experimental)

Agent Teams enables bidirectional communication between specialist teammates who challenge each other's work. The lead (you) orchestrates, teammates do the reasoning/generation, and the lead handles MCS execution (LSP Wrapper, Island Gateway API, PAC CLI, Dataverse).

**Enabled via:** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `.claude/settings.json`

### Teammates

| Teammate | Role | Key Strength | GPT Usage |
|----------|------|-------------|-----------|
| **Research Analyst** | Discover MCS capabilities across multiple sources | Prevents false limitation claims | `review-components` after research |
| **Prompt Engineer** | Write MCS agent instructions + review/sharpen our own skill files | Sharp instructions, correct `/` references | `generate-instructions` co-gen + merge |
| **Topic Engineer** | Generate validated YAML topics + adaptive cards | Syntax-correct YAML, channel-safe cards | `generate-topics` co-gen for 3+ node topics |
| **QA Challenger** | Review ALL outputs, find gaps, challenge claims | Catches errors before they hit MCS | `generate-evals` co-gen + all `review-*` commands |
| **Repo Checker** | Validate repo integrity after changes | Catches broken paths, stale docs, drift | `review-code` on changed files + semantic consistency |
| **Repo Optimizer** | Audit repo for dead code, duplication, bloat | Catches waste before it accumulates | `review-code` for dead code + complexity analysis |
| **Flow Designer** | Design Power Automate flow specs from brief.json capabilities | Actionable flow specs with triggers, actions, connectors | `review-flow` before returning specs |

**Every teammate has GPT-5.4 access** via `tools/multi-model-review.js`. GPT is a universal "extra tool" — each teammate uses the commands relevant to their domain. MCS agents use co-generation + domain reviews. Utility agents (Repo Checker, Repo Optimizer) use `review-code` for deep analysis. All follow the same merge protocol: union of findings, stricter wins, never block on GPT.

Definitions: `.claude/agents/` (research-analyst.md, prompt-engineer.md, topic-engineer.md, qa-challenger.md, repo-checker.md, repo-optimizer.md, flow-designer.md)

### When to Use Agent Teams

**During MCS workflow skills:**
- **Research phase** (`/mcs-research`): Research Analyst searches for external connectors/MCP (only if Priority 5-6 integrations), then **PE + QA + TE (+ FD if flow/hybrid) run in parallel** in Phase C: PE writes instructions, QA generates eval sets, TE validates topic feasibility, Flow Designer writes flow-spec.md (only when solutionType is "flow" or "hybrid"). Lead does inline instruction review.
- **Build phase** (`/mcs-build`): Topic Engineer generates YAML, QA Challenger reviews before execution, **eval-driven iteration loop** (safety gate → functional per-capability → resilience), **Research Analyst on-demand (connector issues)**, **Prompt Engineer on-demand (instruction adjustments + fix iteration)**
- **Eval phase** (`/mcs-eval`): Runs eval sets (all or specific), writes per-test results to evalSets. QA Challenger analyzes failures when sets miss thresholds.
- **Fix phase** (`/mcs-fix`): QA Challenger classifies failures, Prompt Engineer fixes instructions, Topic Engineer fixes topics

**GPT-5.4 co-generation + review (all phases):**
GPT runs in parallel with every Claude generation and review — zero added latency. Teammates fire `multi-model-review.js` internally: PE/QA/TE use co-generation commands, QA/RA/FD use review commands. Protocol: **union of findings/content, stricter wins on conflicts.** GPT is never blocking — if unavailable, Claude proceeds alone.

| Phase | GPT Action (parallel with Claude) |
|-------|----------------------------------|
| Research Phase C | PE: `generate-instructions` (co-gen), QA: `generate-evals` (co-gen), TE: `generate-topics` for feasibility |
| Research Step 3.5 | `review-brief` + `review-instructions` + `review-components` + `review-flow` (if hybrid) |
| Build Step 4 | TE: `generate-topics` for complex topics (3+ nodes, co-gen) |
| Build Step 5.6 | `review-brief` + `review-instructions` + per-topic `review-topics` |
| Eval | Dual scoring on 4 semantic methods (CompareMeaning, GeneralQuality, TextSimilarity, CapabilityUse) |
| Fix | PE: `generate-instructions` (co-gen for fix proposals), TE: `generate-topics` (co-gen for topic fixes) |

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
  - Pushes topic YAML via LSP Wrapper (mcs-lsp.js push)
  - Sets instructions via LSP push (agent.mcs.yml) or Dataverse API
  - Configures tools via add-tool.js + LSP push (user creates OAuth connections manually if needed)
  - Publishes (Dataverse PvaPublish, PAC CLI fallback)
```

### Rules

- **Lead does NOT generate instructions, YAML, or cards directly.** Delegate to teammates.
- **Lead DOES handle all MCS execution** (LSP Wrapper, Island Gateway API, PAC CLI, Dataverse API) since MCP access in teammates is unreliable.
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
| Before commits / weekly | Tier 2: Repo Optimizer in background | No — runs async |
| Simple answer, status check, brainstorming | None | — |

---

## Available Tools

| Tool | Purpose |
|------|---------|
| **PAC CLI** | Listing agents, status, solution ALM (`pac copilot`, `pac solution`) |
| **MCS LSP Wrapper** | Instructions, model, topics, knowledge sync, full component push/pull via official LS (`tools/mcs-lsp.js`) |
| **Island Gateway API** | Model catalog, component reads, routing info, bot settings, eval upload/run (`tools/island-client.js`) |
| **Add Tool CLI** | Headless tool/connector/MCP addition — discovers connection refs from Dataverse, generates action YAML, LSP push (`tools/add-tool.js`). Key commands: `discover-connections` (query env), `add` (write YAML) |
| **Dataverse API** | File uploads, bot name PATCH, PvaPublish bound action, security, deletion (via HTTP/PowerShell) |
| **Code Editor YAML** | Topic authoring fallback: conversations, cards, branching (paste into MCS code editor) |
| **ObjectModel CLI** | Full YAML validation + schema exploration (357 types, catches unknown nodes + missing fields): `tools/om-cli/om-cli.exe` (validate, schema, search, list, hierarchy, composition, examples) |
| **Gen Constraints** | Pre-generation constraint extraction: `python tools/gen-constraints.py <types>` — required fields per node type |
| **Drift Detection** | Compare brief.json specs vs built YAML: `python tools/drift-detect.py <brief.json>` — missing topics, trigger mismatches, variable drift |
| **Semantic Gates** | 5 validation gates beyond structural checks: `python tools/semantic-gates.py <file.yaml> --brief <brief.json>` (PowerFx, cross-refs, variable flow, channel compat, connectors) |
| **Flow Manager** | Power Automate cloud flow CRUD + composition — compose flows from specs, create from definitions, validate, connector schema lookup, discover operations, trigger creation, schedule/message updates, activate/deactivate (`tools/flow-manager.js` + `tools/lib/flow-composer.js` + `tools/lib/connector-schema.js` + `knowledge/patterns/flow-patterns/`) |
| **Replicate Agent** | Cross-environment agent replication: Dataverse create + LSP clone + push (`tools/replicate-agent.js`) |
| **Direct Line API** | Agent testing: send messages, compare responses. `--gpt` flag for GPT-enhanced scoring (`tools/direct-line-test.js`) |
| **Multi-Model Review** | GPT-5.4 dual model co-generation + review — 12 commands: 3 co-generation (`generate-instructions`, `generate-evals`, `generate-topics`), 6 review (`review-instructions`, `review-topics`, `review-brief`, `review-flow`, `review-components`, `review-code`), 1 scoring (`score`), 1 utility (`usage`), 1 info (`models`). Auto-detects via `gh auth token` + copilot scope → GitHub Copilot Responses API. Fully optional, graceful fallback (`tools/multi-model-review.js` + `tools/lib/openai.js`) |
| **Solution Library** | Team SharePoint solution library: list, download, analyze, upload, index, search (`tools/solution-library.js`) |
| **WorkIQ MCP** | M365 context: emails, meetings, documents, Teams, people (`workiq mcp`) |
| **Microsoft Learn MCP** | Official docs, reference, code samples |
| **WebSearch** | Latest announcements, preview features, community discoveries |
| **WebFetch** | Deep-read blog posts, READMEs, release notes |

---

## Bug Reports & Suggestions

Users file bugs and suggestions via the header buttons, which open a feedback dialog. The dialog collects a description + auto-gathered context (project, agent, page, build/eval status), then dispatches `/bug` or `/suggest` to the embedded Claude terminal for GitHub issue creation.

**Issue creation rules:**
- Target: GitHub `microsoft/MCS-Agent-Builder` (`gh issue create --repo microsoft/MCS-Agent-Builder`)
- Labels: `bug` for bugs, `enhancement` for suggestions
- Always preview title + body before submitting — never auto-submit
- Use HEREDOC for the `--body` argument to preserve formatting
- Auto-enrich with session context (project, agent, page, build status, eval score) when available
- Keep titles under 70 characters (`Bug: ...` or `Suggestion: ...`)
- When invoked with pre-filled args from the dashboard dialog, skip the "ask" step and go straight to drafting

---

## Learning System — Continuous Improvement

The system captures learnings from every build and makes them available in future research. This creates a **feedback loop**: builds generate insights → insights improve future research → better specs → better builds.

### Knowledge Layers

| Layer | Location | What | Refresh |
|-------|----------|------|---------|
| **Official cache** | `knowledge/cache/` | MCS capabilities from MS Learn + WebSearch | Auto (session start + before research) |
| **Experience learnings** | `knowledge/learnings/` | Insights from past builds, user feedback, failures | After every build/research/eval |
| **Stable patterns** | `knowledge/patterns/` | YAML syntax, Dataverse API, solution patterns | Manual (rarely changes) |
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
| `topics-triggers.md` | `/mcs-research` Phase C + `/mcs-build` Step 4 |
| `eval-testing.md` | `/mcs-research` Phase C + `/mcs-eval` |
| `build-methods.md` | `/mcs-build` (tool selection per step) |
| `customer-patterns.md` | `/mcs-research` Phase B (component research) |

> **Complete consultation matrix:** See "Learnings Protocol" § D below for all consultation points across all skills.

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

### Learnings Protocol — Automated Capture & Consultation

Learnings are captured automatically after every phase and consulted throughout every skill — not just research. A machine-readable `knowledge/learnings/index.json` enables deduplication, confirmed-count tracking, and staleness detection.

#### A. Two-Tier Capture Model

Every post-phase hook classifies learnings into one of two tiers:

| Tier | When | User Confirmation | Examples |
|------|------|-------------------|----------|
| **Tier 1 (Auto)** | Routine confirmations, cache corrections | No — silent bump/write | Same approach worked again → bump Confirmed count; cache file had wrong info → correct and log |
| **Tier 2 (User confirms)** | New discoveries, contradictions, architecture insights | Yes — present summary and wait | New failure pattern; learning contradicts existing entry; non-obvious architecture recommendation |

**Tier 1 actions:** Bump `confirmed` count and `lastConfirmed` date in `index.json`, update the entry's `Last confirmed` line in the `.md` file. No user interaction needed.

**Tier 2 actions:** Present the learning to the user with proposed file + tags. If confirmed, write entry to `.md` file and add to `index.json`.

#### B. Comparison Engine (4-step decision protocol)

Before writing any learning, run this comparison:

1. **Read `index.json`** entries with overlapping tags (match 2+ tags with the proposed learning)
2. **For each match, decide:**
   - Same scenario, same conclusion → **BUMP** confirmed count (Tier 1)
   - Same scenario, different conclusion → **FLAG** contradiction for user (Tier 2)
   - Different scenario, related tags → **ADD** as new entry (Tier 2)
   - No matches → **ADD** as new entry (Tier 2)
3. **Check related cache files:** Does the learning reveal info missing from `knowledge/cache/`? → update cache + add learning. Does it contradict cache? → **FLAG** for user.
4. **Execute decision:** BUMP / ADD / SKIP / FLAG — then update `index.json` accordingly.

#### C. Staleness Rules

| Condition | Status | Action |
|-----------|--------|--------|
| Not confirmed in > 6 months | `stale` | Flag during session startup |
| Contradicted by 2+ builds | `deprecated` | Flag and recommend removal |
| References removed component | `superseded` | Flag and recommend update |

Report during session startup alongside cache freshness:
```
Learnings: N active, M stale, K deprecated
```

#### D. Consultation Points (All Skills)

Learnings are consulted at these specific points across all workflow skills:

| Skill | Phase/Step | Learnings Files Read |
|-------|-----------|---------------------|
| `/mcs-research` | Phase B (component research) | `connectors.md`, `integrations.md`, `customer-patterns.md`, `patterns/solution-patterns.md` |
| `/mcs-research` | Phase C (architecture + instructions + evals + topics) | `architecture.md`, `instructions.md`, `topics-triggers.md`, `eval-testing.md` |
| `/mcs-build` | Before Step 1 (agent creation) | `build-methods.md` |
| `/mcs-build` | Before Step 3 (tools config) | `connectors.md`, `integrations.md` |
| `/mcs-build` | Before Step 4 (topics) | `topics-triggers.md` |
| `/mcs-eval` | Before Step 2 (run evaluation) | `eval-testing.md` |
| `/mcs-fix` | Step 2 (classify failures) | `eval-testing.md`, `instructions.md`, `topics-triggers.md` |
| `/mcs-retro` | All steps (collect + compare) | All learnings files + `index.json` + all cache files |

---

## Core Philosophy

### 1. Brief-Driven Build
The **brief.json** is the single source of truth. Everything flows from it:
- SDR/intake → **brief.json** → Build → Eval
- The brief contains everything needed to execute a build (instructions, tools, model, topics, MVP scope, decisions)
- `decisions[]` stores structured choice points where research found 2+ viable approaches — each with ranked options, pros/cons, requirements. The recommended option is pre-applied to brief fields as the buildable default. User confirms or overrides.
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

### 4. Never Assume — Microsoft-First, Research Externals When Needed
Research Microsoft-first: MCS built-in → Power Platform → Azure → M365 connectors → certified premium connectors. Only escalate to broad research (WebSearch, MS Learn, community) for external systems not covered by cache. When multiple valid approaches exist, present them as structured decisions with pros/cons/requirements. Recommend the best one, pre-apply it as the buildable default, but let the user choose.

**Priority 1-4 (Microsoft-native):** Resolve from cache — well-documented, enterprise-supported, GA.
**Priority 5-6 (external/custom):** Cache check + live research via Research Analyst when needed.

**When to do live research:** External systems not in cache. Cache > 7 days stale for the specific system. Every error you can't explain.

### 5. All-API Build Stack
Zero browser automation. User-guided manual steps only when no API alternative exists (new OAuth connections, Computer Use tool). See "User-Guided Manual Steps" section above.

### 6. Not Every Use Case Needs an Agent
Run the Solution Type Assessment (5 factors, see `knowledge/frameworks/solution-type-scoring.md`) after identifying agent candidates. Score 0-2 = recommend simpler solution (Power Automate flow, SharePoint views, etc.). Score 4-5 = proceed with agent. Never force-fit automation into an agent.

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
CREATE → UPLOAD → RESEARCH → [SOLUTION TYPE GATE] → BUILD → EVALUATE → [FIX] → [DEPLOY] → [REPORT] → [RETRO]
                  /mcs-research        |              /mcs-build  /mcs-eval  /mcs-fix  /mcs-deploy  /mcs-report  /mcs-retro
                                       |
                                    flow/not-rec → Flow Designer writes flow-spec.md, simplified brief
```

| Step | Skill | Input | Output | Agent Teams |
|------|-------|-------|--------|-------------|
| **Init** | `/mcs-init` | Project name | Folder structure | None |
| **Context** | `/mcs-context` | Customer name | customer-context.md | None |
| **Research** | `/mcs-research {projectId}` or `/mcs-research {projectId} {agentId}` | docs/ | brief.json (enriched with evalSets + decisions[]) | RA (if needed) + PE + QA + TE |
| **Build** | `/mcs-build {projectId} {agentId}` | brief.json | MCS agent (published) + build-report.md | TE + QA (+ RA/PE on-demand) |
| **Evaluate** | `/mcs-eval {projectId} {agentId}` | brief.json evalSets | evalSets[].tests[].lastResult | QA |
| **Fix** | `/mcs-fix {projectId} {agentId}` | brief.json evalSets (failing tests) | brief.json (fixed) + re-eval results | PE + TE + QA |
| **Deploy** | `/mcs-deploy {projectId} {agentId}` | brief.json (buildStatus, evalSets) | brief.json (deployStatus) + deployment-report.md | None |
| **Report** | `/mcs-report {projectId} {agentId}` | brief.json (read-only) | {type}-report.md | None |
| **Retro** | `/mcs-retro` | Session context | Updated learnings + cache | None |

> **`/mcs-context`** is optional but recommended — it pulls all M365 history for a customer via WorkIQ MCP and pre-fills 60-80% of research.

---

## Skills (13 total — 11 workflow + 2 utility)

| Skill | Purpose | Dashboard Button |
|-------|---------|-----------------|
| **mcs-init** | Create project folder structure | None (API) |
| **mcs-context** | Pull M365 history via WorkIQ | None (CLI) |
| **mcs-research** | Read docs, identify agents, research components, design architecture, enrich brief.json + generate evals. Smart incremental at both project and agent level. | **Research** |
| **mcs-build** | Build agent(s) in MCS via hybrid stack | **Build** |
| **mcs-eval** | Run eval tests, write results to brief.json | **Evaluate** |
| **mcs-fix** | Analyze eval failures, apply fixes (instructions/topics/evals), re-evaluate | **Fix Failures** (conditional — appears when eval < 70%) |
| **mcs-refresh** | Refresh knowledge cache files | None (CLI) |
| **mcs-retro** | Post-session retrospective: collect, classify, and persist learnings | None (CLI) |
| **mcs-deploy** | Deploy agents from dev to prod (agent-level or solution-level) | None (CLI) |
| **mcs-report** | Generate reports from brief.json (brief/build/customer/deployment) | None (CLI) |
| **mcs-library** | Browse, analyze, and contribute to team SharePoint solution library | None (CLI) |
| **bug** | File bug reports via `az` CLI | Sidebar button |
| **suggest** | File feature suggestions via `az` CLI | Sidebar button |

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

**Goal:** Read all project documents, identify agents, research MCS components, and produce fully enriched brief.json (the single source of truth) with evalSets (3 default sets: safety, functional, resilience + custom) and structured `decisions[]` for choice points where multiple valid approaches exist.

**Input:** `/mcs-research {projectId}` (project-level) or `/mcs-research {projectId} {agentId}` (agent-level)
**Reads:** `Build-Guides/{projectId}/docs/` + `customer-context.md` (if exists) + `knowledge/cache/` + `knowledge/learnings/`
**Writes:** `brief.json` (all fields including instructions, evalSets, and decisions[]) + `evals.csv` (derived flat export for MCS native eval compatibility)

**Smart at both levels:** Phase 0 runs for ALL invocations — detects new/changed docs, brief edits, and manually created agents. Routes to full, incremental, re-enrich, or full-agent processing as appropriate.

**3 phases (optimized — Microsoft-first, parallel teammates):**
1. **Document comprehension & agent identification** — lead reads all docs, cross-references, identifies agents, extracts data, generates informed open questions using MCS cache
2. **Component research (targeted, Microsoft-first)** — lead resolves stable categories from cache (channels, triggers, knowledge). MCP catalog scan conditional (skipped for M365-native agents). Research Analyst spawned ONLY for Priority 5-6 integrations needing live lookup. **Generates structured `decisions[]`** when 2+ viable approaches exist.
3. **Architecture, instructions, eval sets & topics (PARALLEL)** — lead scores architecture + selects model + classifies topics, then dispatches PE (instructions) + QA (eval sets) + TE (topic feasibility) **simultaneously**. Lead does inline instruction review after teammates return.

**Uses Agent Teams:** Research Analyst (only if Priority 5-6 integrations need lookup), Prompt Engineer (instructions — parallel), QA Challenger (eval set generation — parallel), Topic Engineer (feasibility validation — parallel in Phase C).

**Iteration:** Customer reviews brief in the dashboard, answers open questions, then user re-runs `/mcs-research {projectId} {agentId}` to re-enrich (Phase 0 detects brief edits automatically).

---

## BUILD: Construct Agent (`/mcs-build`)

**Goal:** Build and publish agent(s) in Copilot Studio using the hybrid stack.

**Input:** `/mcs-build {projectId} {agentId}`
**Reads:** `brief.json` (the single source of truth — architecture, instructions, tools, model, everything)
**Writes:** `brief.json` buildStatus field (including step-level checkpoints for resume)

**Unified Auth Gate:**
- Two-step selection: account → environment. **Never assumes the environment** — always confirms with user, even on resume (accounts can have multiple environments)
- Three-layer verification: Azure CLI (tenant match) → Dataverse API (env reachable) → PAC CLI (best-effort, not required)
- Azure CLI + Dataverse must pass. PAC CLI failure = warning only (API fallback for everything)
- Persists to both `brief.json.buildStatus` AND `session-config.json.sessionDefaults`
- User can always override by saying "switch to [account/env]"

**Decision Gate (Step 0.5):**
- After Auth Gate, before MVP filtering: reads `decisions[]`, blocks on pending architecture/infrastructure decisions, warns on pending integration/model/topic decisions (recommended defaults pre-applied, build proceeds with warning)

**Find-or-Create Agent (Step 1):**
- Reads `brief.json.buildStatus.mcsAgentId` — if set, verifies agent still exists via `pac copilot list`
- If no ID, checks `pac copilot list` for matching `displayName` before creating a new one
- Prevents duplicate agents on build restart / session crash
- Clones agent workspace via LSP; stores agent subfolder path (with `.mcs/conn.json`) in `buildStatus.workspacePath`

**Agent Metadata (Step 2a):**
- Sets agent description (comment line 2 in `agent.mcs.yml` — MCS metadata, not a standard YAML comment)
- Adds conversation starters (each MUST have both `title` and `text` — missing `title` causes silent publish failure)
- Publish verification uses `synchronizationstatus` field, not just HTTP 200 or `publishedon`

**Step-Level Checkpoints (Resume Logic):**
- `buildStatus.completedSteps` tracks which steps succeeded: `created`, `instructions`, `knowledge`, `tools`, `model`, `topics`, `critical-gate`, `capability-iteration`, `regression`, `published`
- On resume, completed steps are skipped — build continues from the failure point
- Publish always re-runs since it's cheap and ensures latest state

**Post-Build Eval (Direct Line):**
- After publish, runs Direct Line eval if agent supports it (no MCP/user-delegated tools)
- For MCP agents: generates test cases, user tests manually in MCS
- User requests `/mcs-fix` for issues found post-deployment

**MVP Phase Filtering:**
- Only builds items tagged `phase: "mvp"` — skips `phase: "future"` across capabilities, integrations, knowledge, and topics
- Outputs a scope summary (N MVP / M deferred) before starting
- Deferred items are listed in the build report for customer visibility

**Routes by architecture:**
- `Single Agent` → standalone build (PAC CLI + LSP Wrapper + Island Gateway + Dataverse)
- `Multi-Agent` → specialists first, then orchestrator with child connections

**On-demand teammates:** Research Analyst (when tool configuration hits issues) and Prompt Engineer (when instructions need adjustment for actual tool names)

**QA Build Validation Gate (Step 5.5):** After publish, QA Challenger validates brief-vs-actual (every MVP item), cross-references (instructions→tools, topics→variables, routing→children), and deviation impact (severity + can-ship assessment). QA verdict (PASS / PASS WITH CAVEATS / FAIL) determines whether the build report is generated or critical issues are escalated to the user. Output: `qa-validation.md` in the agent folder.

---

## EVAL: Test & Validate (`/mcs-eval`)

**Goal:** Run eval sets (all or specific) and write per-test results to brief.json for dashboard display.

**Input:** `/mcs-eval {projectId} {agentId}` or `/mcs-eval {projectId} {agentId} --set critical,functional`
**Reads:** `brief.json` evalSets array
**Writes:** `brief.json` evalSets[].tests[].lastResult + `evals-results.json`

**Two-mode eval strategy:**
- **Auto (Direct Line API)** — automated for agents without user-delegated MCP tools. Hardened with auto-token, retry with backoff, 60s timeout, structured partial results.
- **Manual (MCS Native Eval)** — upload eval sets via Gateway API `makerevaluations` (populates Evaluation tab) + run eval via Gateway API. Per-set CSVs generated for dashboard download/reference. User checks results in MCS or tests in chat.
- **MCP Agent Manual Test Mode** — present test table (questions + expected answers), user tests in Test Chat, reports results or uses MCS native eval.

**Per-set pass logic:** each test must pass ALL methods defined by its set. Scored methods check threshold, binary methods are pass/fail.

**Test method types:** See `knowledge/cache/eval-methods.md`

### Failure Analysis

| Type | Fix |
|------|-----|
| Knowledge Gap | Update knowledge sources |
| Retrieval Failure | Improve search terms in instructions |
| Grounding / Hallucination | Strengthen boundaries in instructions |
| Routing Failure | Expand trigger phrases, clarify routing rules |

---

## FIX: Post-Deployment Fix & Re-Evaluate (`/mcs-fix`)

**Goal:** Fix post-deployment issues — edge cases found by real users, regressions, new requirements. For initial build iteration, use `/mcs-build` (which has an internal eval-driven fix loop).

**Input:** `/mcs-fix {projectId} {agentId}`
**Reads:** `brief.json` (evalSets with failing tests, instructions, integrations, capabilities, conversations.topics)
**Writes:** `brief.json` (instructions, conversations.topics, evalSets, notes.fixHistory), agent in MCS (via hybrid stack)

**5 root cause categories:** instruction gap, boundary violation, routing failure, knowledge gap (manual — can't auto-fix), scoring issue

**Flow:** Read eval set results → QA classifies failures → User approves classification → PE fixes instructions + TE fixes topics (parallel) → Lead applies via hybrid stack → Re-evaluate via Direct Line → Compare per-set pass rates before/after

**Uses Agent Teams:** QA Challenger (failure classification), Prompt Engineer (instruction fixes), Topic Engineer (topic/trigger fixes). Max 2 fix iterations per invocation. Can add new tests to eval sets based on real-world failures.

---

## RETRO: Post-Session Retrospective (`/mcs-retro`)

**Goal:** Capture and classify learnings from a build/eval/fix session into the knowledge system.

**Input:** `/mcs-retro` (no arguments — scans the current session)
**Reads:** Session context + all `knowledge/learnings/*.md` + `knowledge/learnings/index.json` + `knowledge/cache/*.md`
**Writes:** Updated learnings files, index.json, cache corrections

**5-step flow:**
1. **Collect** — scan session for build errors, eval failures, manual workarounds, verbal discoveries, tool gaps
2. **Compare** — for each item, search `index.json` for matching tags, check cache files
3. **Classify** — REPEAT (auto-bump), NEW (add), CORRECTION (flag), ENHANCEMENT (update), TOOLING_GAP (file suggestion)
4. **Present** — table of all items with classification, target file, proposed action
5. **Apply** — auto-apply Tier 1 (REPEAT), ask user approval for Tier 2 (NEW/CORRECTION/ENHANCEMENT/TOOLING_GAP)

**When to run:** After build/eval/fix sessions. Optional — never auto-triggered.

---

## DEPLOY: Cross-Environment Promotion (`/mcs-deploy`)

**Goal:** Deploy agents from dev to prod environments. Two modes: agent-level (fast, `replicate-agent.js`) and solution-level (PAC CLI export/import, ALM-ready).

**Input:** `/mcs-deploy {projectId} {agentId}` or `/mcs-deploy {projectId} {agentId} --mode solution`
**Reads:** `brief.json` (buildStatus, evalSets, integrations, architecture)
**Writes:** `brief.json` (deployStatus) + `deployment-report.md`

**Prerequisites (gates):** Agent must be published, evals should be passing (warn if below target), dual auth gate (source + target environments).

**Mode auto-detection:** Multi-agent or named solution → `solution` mode. Single agent in default solution → `agent` mode. User can override with `--mode`.

**7 steps:** Pre-deploy validation → Mode selection → Deploy (replicate or PAC CLI export/import) → Connection mapping report → Publish in target → Post-deploy smoke test (safety set) → Write deployStatus to brief.json + deployment-report.md.

**No teammates** — lead-only execution (mechanical, no generation).

---

## REPORT: On-Demand Report Generation (`/mcs-report`)

**Goal:** Generate reports from brief.json on demand — without running a build. Read-only, never modifies brief.json.

**Input:** `/mcs-report {projectId} {agentId} --type {brief|build|customer|deployment}`
**Reads:** `brief.json` (read-only)
**Writes:** `Build-Guides/{projectId}/agents/{agentId}/{type}-report.md`

**4 report types:**

| Type | Audience | Key Content | When to Use |
|------|----------|-------------|-------------|
| `brief` | Internal / customer | Full design state + cross-reference summary + solution type | After research, before build |
| `build` | Customer | Build status, deviations, eval results, next steps | After build |
| `customer` | Non-technical stakeholders | Simplified — zero jargon, features + decisions only | Anytime for exec review |
| `deployment` | IT admin / deploy team | Pre/post deploy checklists, connection mapping, env mapping | Before or after deploy |

**Customer report jargon rules:** No PAC CLI, Dataverse, LSP, YAML, PowerFx, MCP, JSON, API, OAuth, Service Principal. Use plain language equivalents.

**No teammates** — lightweight lead-only generation.

---

## LIBRARY: Solution Library (`/mcs-library`)

**Goal:** Browse, analyze, and contribute to the Builder PMs team's SharePoint "Solution & Demo Library" (~30 exported MCS agent solutions). Independent utility skill — not part of the linear build workflow.

**Input:** `/mcs-library <command>` — see `.claude/skills/mcs-library/SKILL.md` for full command reference.

**Commands:** `list`, `search <query>`, `download <name>`, `analyze <name>` (teams: RA + PE), `index` (teams: RA + PE), `upload <project> <agent>` (optional QA)

**Tool:** `tools/solution-library.js` + `tools/lib/graph-sharepoint.js` (Graph API via `az login` delegated auth)

**Index:** `knowledge/solutions/index.json` (committed, populated by `refresh`/`analyze`)

**Cache:** `knowledge/solutions/cache/*.json` (per-solution analysis, committed)

**Downloads:** OS temp dir (ephemeral — cleaned up after analysis)

---

## Component Selection & Architecture Decisions

**Component selection framework:** See `knowledge/frameworks/component-selection.md` (Microsoft-first priority ladder: MCS built-in → Power Platform → Azure → M365 → Premium → Custom)
**Architecture scoring (single vs multi-agent):** See `knowledge/frameworks/architecture-scoring.md`
**Current inventories:** See `knowledge/cache/` (MCP servers, connectors, models, triggers, etc.)

**CRITICAL:** Always check cache freshness before using. If > 7 days old for Priority 5-6 integrations, run `/mcs-refresh` or do live research before deciding. Priority 1-4 (Microsoft-native) can use cache as-is if < 30 days old.

---

## Patterns & References

**MCS Authoring Schema:** Query via `tools/om-cli/om-cli.exe` (357 concrete types, validates unknown nodes + missing fields). Schema files baked into `tools/om-cli/schemas/`.
**Code Editor YAML reference:** See `knowledge/patterns/yaml-reference.md` (action types, entity catalog, binding rules, compile errors)
**Topic YAML templates:** See `knowledge/patterns/topic-patterns/` (11 patterns including AI Builder model and welcome card)
**Dataverse API patterns:** See `knowledge/patterns/dataverse-patterns.md`
**Solution patterns:** See `knowledge/patterns/solution-patterns.md` (naive-to-proven implementation patterns, checked during research Phase B Step 2.5)
**Trigger types:** See `knowledge/cache/triggers.md`
**Eval scenario library:** See `knowledge/frameworks/eval-scenarios/` (business-problem + capability scenarios)

---

## Error Handling

**STOP → RESEARCH BROADLY → RETRY**

```
1. Don't retry same approach
2. Research across ALL sources:
   - WebSearch for the error message + "Copilot Studio"
   - MS Learn MCP for official troubleshooting
   - Community forums for known bugs / workarounds
   - API read-back to verify current state
3. Log significant findings to knowledge/learnings/
4. Retry with researched approach
```

---

## Key Principles

1. **Brief is the blueprint** — brief.json drives the build (single source of truth)
2. **Evals drive the build** — 3 eval sets (safety, functional, resilience) aligned with [MS Eval Scenario Library](https://github.com/microsoft/ai-agent-eval-scenario-library), safety gate → functional per-capability → resilience before publish
3. **Multi-agent first** — decompose into specialists (score objectively)
4. **Never assume** — research Microsoft-first (MCS built-in → Power Platform → Azure → M365 connectors), escalate to broad research for external systems. Present structured decisions when multiple valid approaches exist
5. **MVP first** — build what's possible now, plan what's blocked
6. **Build specialists first** — children before orchestrator
7. **Verify environment** — confirm PAC CLI + Azure CLI target before operations
8. **Research errors** — don't blindly retry
9. **Capture learnings** — every build makes next build smarter
10. **Fill gaps before building** — incomplete brief → incomplete agent
11. **All-API build stack** — zero browser automation. User-guided manual steps for new OAuth connections only
12. **MCP over connectors** — prefer MCP servers over individual connector actions
13. **Microsoft-first research** — use cache for M365-native components (Priority 1-4), escalate to WebSearch + MS Learn + community only for external systems (Priority 5-6) not in cache
14. **API verification** — every change verified via LSP pull, Dataverse query, or PAC CLI status — deterministic, not screenshot-based
15. **Present options, don't prescribe** — when research finds 2+ genuinely viable approaches, create structured `decisions[]` entries with pros/cons/requirements. Recommend the best, pre-apply it as the buildable default, let the user choose. One clear winner = auto-apply, no decision entry.
16. **Assess before building** — run solution type scoring after identifying agents. Force-fitting automation into an agent wastes effort and produces inferior results. A Power Automate flow that works is better than an agent that's just a thin API wrapper.

---

## Knowledge System

Cached inventories, stable patterns, and decision frameworks live in `knowledge/`:

- **`knowledge/cache/`** — 20 quick-reference cheat sheets covering MCS capabilities: options, limits, gotchas, and decision tables. For step-by-step details, use MS Learn MCP. Each file has freshness metadata. Check before architecture decisions.
- **`knowledge/patterns/`** — Stable HOW-TO references (YAML syntax, Dataverse API patterns, solution patterns, topic templates).
- **`knowledge/frameworks/`** — Decision frameworks (component selection, architecture scoring, tool priority).

**Tiered refresh:**
- **Tier 1 (build-critical):** triggers, models, mcp-servers, connectors, knowledge-sources, channels — auto-refreshed at session start if > 7 days old
- **Tier 2 (build-phase):** api-capabilities, island-gateway-api, instructions-authoring, generative-orchestration, adaptive-cards, ai-tools-computer-use, power-automate-integration — refreshed before `/mcs-build` if stale
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
start.cmd                   # Double-click entry point (installs deps + launches)
setup.ps1                   # Bootstrap script (winget/npm/pip)
start.js                    # One-command launcher (npm start)
package.json                # Node dependencies & scripts
requirements.txt            # Python dependencies

bin/
├── cli.js                  # npm CLI entry point (mcs-agent-builder command)
└── postinstall.js          # Post-install setup (git hooks, dependency check)

.claude/
├── settings.json           # MCP servers, permissions, Agent Teams env flag
├── skills/                 # 13 skills (11 workflow + 2 utility)
│   ├── mcs-init/           # Create project folder
│   ├── mcs-context/        # Pull M365 history via WorkIQ
│   ├── mcs-research/       # Read docs + full enrichment → brief.json + evals
│   ├── mcs-build/          # Build agent(s) in MCS via hybrid stack
│   ├── mcs-eval/           # Run eval sets → evalSets[].tests[].lastResult
│   ├── mcs-fix/            # Post-eval fix → re-eval loop
│   ├── mcs-refresh/        # Refresh knowledge cache
│   ├── mcs-retro/          # Post-session retrospective
│   ├── mcs-deploy/         # Cross-environment agent promotion
│   ├── mcs-report/         # On-demand report generation (4 types)
│   ├── mcs-library/        # SharePoint solution library integration
│   ├── bug/                # File bug reports via az CLI
│   └── suggest/            # File feature suggestions via az CLI
└── agents/                 # Agent Teams teammate definitions
    ├── research-analyst.md # MCS capability researcher
    ├── prompt-engineer.md  # Instructions & Custom Prompt specialist
    ├── topic-engineer.md   # YAML, adaptive cards & flow specialist
    ├── qa-challenger.md    # Adversarial reviewer & gap finder
    ├── repo-checker.md     # Cross-reference & sync validator
    ├── repo-optimizer.md   # Dead code, duplication & bloat auditor
    └── flow-designer.md    # Power Automate flow spec designer

app/                        # Dashboard application
├── server.py               # FastAPI backend (CRUD, file upload, SPA serving)
├── terminal-server.js      # Node-pty WebSocket server (embedded Claude Code terminal)
├── lib/                    # Shared Python modules
│   └── readiness_calc.py   # Readiness calc, project scanning, stage detection
├── dist/                   # Vite production build output (gitignored)
└── frontend/               # React + TypeScript SPA (Vite + shadcn/ui)
    ├── src/
    │   ├── pages/          # Route pages (Index, ProjectPage, BriefEditor, etc.)
    │   ├── components/     # UI components (brief sections, terminal, layout)
    │   ├── stores/         # Zustand stores (projects, project, brief, terminal)
    │   ├── lib/            # Utilities (api client, transforms, readiness, reports)
    │   ├── types/          # TypeScript types (domain + API response shapes)
    │   ├── config/         # App config (brief sections, guidelines)
    │   ├── hooks/          # React hooks
    │   └── test/           # Test utilities
    ├── package.json        # Frontend dependencies
    └── vite.config.ts      # Build config (outputs to app/dist/)

knowledge/
├── solutions/              # Team solution library (populated by /mcs-library + /mcs-refresh)
│   ├── index.json          # Solution metadata index (folder names, dates, agents, tags)
│   └── cache/              # Per-solution deep analysis (committed, ~1KB each)
├── learnings/              # Experience-based insights from past builds (8 topic files + index.json)
│   ├── index.json          # Machine-readable learnings index (dedup, confirmed counts, staleness)
├── cache/                  # 20 quick-reference cheat sheets (with freshness metadata)
│   ├── triggers.md, models.md, mcp-servers.md, connectors.md
│   ├── knowledge-sources.md, channels.md, api-capabilities.md, eval-methods.md
│   ├── generative-orchestration.md, security-auth.md, instructions-authoring.md
│   ├── powerfx-variables.md, agent-lifecycle.md, power-automate-integration.md
│   ├── adaptive-cards.md, ai-tools-computer-use.md, limits-licensing.md, conversation-design.md
│   ├── island-gateway-api.md
│   ├── mcs-primer-gpt.md   # Condensed MCS domain primer injected into GPT review calls (~500 words)
│   └── connector-schemas/  # Pre-cached connector Swagger schemas (populated by schema --cache-all)
├── patterns/               # Stable HOW-TO references
│   ├── yaml-reference.md, dataverse-patterns.md
│   ├── solution-patterns.md  # Naive-to-proven implementation patterns (checked in research Phase B)
│   ├── topic-patterns/     # 11 reusable YAML templates
│   └── flow-patterns/     # 9 reusable flow JSON templates (triggers, actions, control flow)
└── frameworks/             # Decision frameworks
    ├── component-selection.md, architecture-scoring.md
    ├── solution-type-scoring.md
    ├── tool-priority.md
    └── eval-scenarios/     # Eval scenario library (aligned with MS Eval Scenario Library)

templates/                  # Project scaffolding templates
├── brief.json              # Agent brief schema — THE single source of truth
└── default-recommendations.json  # Generic MCS best practices (baseline for /mcs-research)

tools/
├── om-cli/                 # ObjectModel CLI — full YAML validation + schema explorer (357 types, .NET 10)
│   ├── om-cli.exe          # Main binary (framework-dependent, ~20MB)
│   └── README.md           # Commands, rebuild instructions
├── lib/
│   ├── http.js             # Shared HTTP request + Azure CLI token helpers (used by all JS tools)
│   ├── openai.js           # Shared GPT client — GitHub Copilot API/GPT-5.4 via gh auth token + copilot scope
│   ├── graph-sharepoint.js # SharePoint Graph API helper (list, download, upload, create folder)
│   ├── flow-composer.js    # Pure flow composition functions (builders, wiring, validation, patterns)
│   └── connector-schema.js # Connector schema fetch, parse & cache (Swagger → operation params)
├── gen-constraints.py      # Pre-generation constraint extraction (queries om-cli for required fields)
├── drift-detect.py         # Brief-vs-YAML drift detection (missing topics, trigger/variable mismatches)
├── semantic-gates.py       # 5 semantic validation gates (PowerFx, cross-refs, variables, channels, connectors)
├── powerfx-catalog.json    # Official PowerFx function catalog (loaded by semantic-gates.py)
├── mcs-lsp.js              # MCS Language Server wrapper — headless push/pull via official LS (topics, sync)
├── island-client.js        # Island Control Plane Gateway API client (model catalog, reads, routing, settings)
├── add-tool.js             # Headless tool/connector addition — generates action YAML + LSP push
├── flow-manager.js         # Power Automate cloud flow CRUD + composition — compose, create-flow, validate, schema, discover-operations, triggers
├── direct-line-test.js     # Direct Line API test runner
├── eval-scoring.js         # Shared scoring module (7 methods: 6 MCS native + PlanValidation, multi-turn support, async GPT-enhanced variants)
├── multi-model-review.js   # GPT dual model co-generation + review CLI (3 co-gen + 6 review + 1 scoring + 2 utility/info)
├── solution-library.js     # Team SharePoint solution library CLI (list, download, analyze, upload, index, search)
├── replicate-agent.js      # Cross-environment agent replication via Dataverse + LSP clone + push
├── dataverse-helper.ps1    # PowerShell Dataverse Web API helper
├── pac-mcp-wrapper.js      # PAC CLI MCP server wrapper
├── update-om-cli.ps1       # Auto-update om-cli from ObjectModel source (called by pre-push hook)
├── e2e-api-pipeline-test.js    # Full API pipeline E2E test (24-step Dataverse→LSP→DirectLine)
├── session-config.example.json  # Account/environment config template
└── git-hooks/
    ├── pre-commit          # Core file protection hook
    └── pre-push            # Auto-update om-cli from ObjectModel source (both installed by start.js)

Build-Guides/[Project]/     # Per-project work (gitignored)
├── agents/[name]/
│   ├── brief.json          # THE source of truth — design, instructions, tools, evalSets, decisions[], build status
│   ├── build-report.md     # Customer-shareable build summary (generated after /mcs-build)
│   ├── deployment-report.md # Deployment summary + connection mapping (from /mcs-deploy)
│   ├── flow-spec.md        # Power Automate flow specification (from Flow Designer, for flow/hybrid)
│   ├── evals.csv           # Flat CSV export of evalSets (derived — for MCS native eval compatibility)
│   ├── evals-results.json  # Direct Line test results backup (from /mcs-eval)
│   └── topics/             # Generated topic YAML files
├── docs/                   # Uploaded customer documents
├── doc-manifest.json       # Document hash manifest (from /mcs-research)
└── customer-context.md     # M365 history (from /mcs-context, optional)

```

---

## PAC CLI Reference (Quick)

```powershell
# List agents
pac copilot list

# Create from template (fallback — prefer Dataverse POST + PvaProvision for creation)
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
