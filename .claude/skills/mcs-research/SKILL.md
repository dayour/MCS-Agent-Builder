---
name: mcs-research
description: Full research pass — reads project documents, identifies agents, researches MCS components, designs architecture, enriches brief.json + generates evals. Uses Agent Teams for quality.
---

# MCS Research

Single-pass pipeline: read documents, identify agents, research components, design architecture, write instructions, generate scenarios and evals. This skill absorbs the former mcs-analyze step — there is no separate extraction step.

## Input

```
/mcs-research {projectId}              # First run: read docs, identify agents, full enrichment for all
/mcs-research {projectId} {agentId}    # Re-run: re-enrich a specific agent (after user feedback)
```

**First run** (no agentId):
- Reads `Build-Guides/{projectId}/docs/`
- Identifies all agents
- Creates and enriches `brief.json` + `evals.csv` for each

**Re-run** (with agentId):
- Reads existing `Build-Guides/{projectId}/agents/{agentId}/brief.json`
- Re-enriches based on updated brief or new docs
- Skips agent identification (already done)

## Output Files (per agent)

- `Build-Guides/{projectId}/agents/{agentId}/brief.json` — Single source of truth (all fields populated including instructions)
- `Build-Guides/{projectId}/agents/{agentId}/evals.csv` — Evaluation test cases

**That's it. Two files.** No research report (future: on-demand export from dashboard). No working-paper files.

## Before Research — Load Frameworks

The session startup protocol already checks cache freshness and refreshes stale Tier 1 files. Do NOT re-check all 18 cache files here.

1. Read `knowledge/frameworks/component-selection.md` for the research protocol
2. Read `knowledge/frameworks/architecture-scoring.md` for scoring criteria

**Cache files are read on-demand** in Phase A (for informed questions) and Phase B (for component research). Only read the specific files needed, not all 18.

## Phase A: Document Comprehension & Agent Identification

**Goal:** Read ALL project documents, build a unified understanding, identify every agent to build, and create brief.json stubs with informed open questions.

**This is NOT dumb extraction — it's deep comprehension.**

### Step 1: Read All Documents

Read every file in `Build-Guides/{projectId}/docs/`:
- `.md` files — read directly
- `.docx` files — convert via pandoc first: `C:\Users\kimdennis\AppData\Local\Pandoc\pandoc.exe "file.docx" -t gfm -o "file.md"`
- `.pdf` files — read via Read tool (PDF support)
- `.txt` files — read directly
- Images (`.png`, `.jpg`) — read via Read tool (multimodal)

If `customer-context.md` exists in the project folder, read it too — it provides M365 history.

### Step 2: Cross-Reference & Build Unified Picture

Don't read documents in isolation. Build a single mental model:
- Cross-reference systems mentioned across documents (same system, different names?)
- Cross-reference personas (same user group described differently?)
- Identify contradictions between documents (flag as open questions)
- Identify themes: what's consistent across all docs?
- Note what's explicit vs implied vs missing

### Step 3: Identify Agents

From the unified understanding, identify distinct agents. Look for:
- Explicit agent names or titles
- Distinct problem domains that suggest separate agents
- SDR sections: "Agent Name", "Solution Ideas", "Autonomous Agent" tables
- Separate use case descriptions or user prompt tables

**If documents describe ONE agent:** Create one agent entry.
**If documents describe MULTIPLE agents:** Create one entry per agent.
**If unclear:** Default to one agent, note uncertainty in openQuestions.

### Step 4: Extract Per-Agent Data & Generate Informed Open Questions

For each agent, extract what's in the documents AND cross-reference against `knowledge/cache/` to generate *informed* open questions.

| Field | Where to Look |
|-------|--------------|
| `step1.agentName` | Title, agent name field, heading |
| `step1.problem` | Problem statement, opportunity description, pain points |
| `step2.capabilities` | Solution ideas, capabilities list, "what it does" sections |
| `step2.scenarios` | User prompts table, use case scenarios, conversation examples |
| `step2.handle` | Inferred from capabilities and scope description |
| `step2.decline` | Out-of-scope mentions, limitations |
| `step2.refuse` | Hard boundaries, compliance requirements |
| `step3.systems` | Data sources table, integrations mentioned, connectors listed |
| `step3.knowledge` | Knowledge sources table, SharePoint sites, document references |
| `step4.triggers` | Autonomous triggers table, scheduling mentions |
| `step4.channels` | Deployment targets (Teams, website, etc.) |

**Informed open questions** — use cache knowledge to ask the RIGHT questions:
- Doc mentions a system → check `knowledge/cache/connectors.md` and `knowledge/cache/mcp-servers.md` → if no native connector, ask: "System X has no native MCS connector. Options: custom connector, Power Automate flow, or HTTP request action. Which applies?"
- Doc mentions triggers → check `knowledge/cache/triggers.md` → ask about specific trigger types, not vague "what triggers?"
- Doc mentions "proactive alerts" → ask: "Should alerts use a Recurrence trigger polling every N hours, or an event-driven trigger from Power Automate?"
- Doc mentions "write-back" → flag: "Write operations require connector actions. Has the customer approved write access to [system]?"

### Step 5: Create brief.json Stubs

For each agent, create:
```
Build-Guides/{projectId}/agents/{slug}/brief.json
```

Where `{slug}` is a kebab-case version of the agent name (e.g., "Incident Manager" → "incident-manager").

Follow the schema in `templates/brief.json`. Include only fields with extracted data + informed openQuestions.

**If agents already exist** under `Build-Guides/{projectId}/agents/`:
- Update their `brief.json` with new info from documents
- Do NOT duplicate existing agents
- Merge new data into existing fields

### Step 6: Confirm with User

Present what was found and get confirmation before proceeding to research:

```
## Documents Analyzed: {projectId}

**Documents read:** {count}
**Agents identified:** {count}

| Agent | Key Capabilities | Open Questions |
|-------|-----------------|----------------|
| {name} | {2-3 capabilities} | {count} |

{List top 3-5 open questions across all agents}

Proceeding to full MCS component research for all {count} agents...
```

Then continue directly to Phase B. **Do not stop and wait** — this is a single-pass skill. The user will provide feedback after the full research is complete.

### Step 6.5: Write Document Manifest

Write `doc-manifest.json` to `Build-Guides/{projectId}/` containing every document read during Phase A. This is the baseline for future `/mcs-update` runs.

```json
{
  "projectId": "{projectId}",
  "lastResearchAt": null,
  "docsProcessed": [
    {
      "filename": "sdr-agent-1.md",
      "sha256": "a1b2c3...",
      "size": 4520,
      "processedAt": "2026-02-13T10:30:00Z",
      "targetAgent": null,
      "source": "research",
      "matchedAgents": ["incident-management", "confluence-knowledge"]
    }
  ]
}
```

For each file in `docs/`:
- Compute SHA-256 hash of file contents
- Set `targetAgent: null` (initial research reads everything for all agents)
- Set `matchedAgents` to all identified agent slugs
- Set `source: "research"`

This manifest enables `/mcs-update` to detect new/changed documents without re-running the full pipeline.

## Phase B: Component Research — Targeted

**Goal:** Research MCS components and recommend the best tools, knowledge sources, model, triggers, and channels for each agent.

**Key principle:** Don't research all 6 categories live for every agent. Stable categories use cache directly. Only dispatch live research for the agent's specific integration systems.

### Step 1: Resolve Stable Categories from Cache (Lead)

These categories are well-documented and change infrequently. Read the cache files directly — no live research needed unless the doc mentions something unusual:

| Category | Cache File | Lead Action |
|----------|-----------|-------------|
| **Models** | `knowledge/cache/models.md` | Read cache. Pick model based on agent complexity. |
| **Channels** | `knowledge/cache/channels.md` | Read cache. Default Teams + Web Chat unless docs say otherwise. |
| **Triggers** | `knowledge/cache/triggers.md` | Read cache. Match trigger type to agent's activation needs from Phase A. |
| **Knowledge sources** | `knowledge/cache/knowledge-sources.md` | Read cache. Match to data types from Phase A (SharePoint, files, websites). |

Write these directly to `brief.json`:
- `step4.model` + `step4.modelReason`
- `step4.channels`
- `step4.triggers`
- `step3.knowledge`

### Step 2: Identify What Needs Live Research

From Phase A extraction, list the agent's **specific external systems** that need MCP/connector lookup:

```
Example: Agent needs Jira, ServiceNow, Confluence
→ Research task: "Find MCS MCP servers or connectors for Jira, ServiceNow, Confluence"
```

**Skip live research if:**
- The agent only uses Microsoft-native tools (Outlook, SharePoint, Teams) — these are well-documented in cache
- The agent has no external system integrations (pure knowledge agent)
- All systems are already in `knowledge/cache/connectors.md` or `knowledge/cache/mcp-servers.md` with recent `last_verified` dates

### Step 3: Check Past Learnings (only relevant files)

Read learnings files only if they're relevant to this agent's systems and non-empty:

- `knowledge/learnings/connectors.md` — if the agent has external connectors
- `knowledge/learnings/integrations.md` — if the agent has complex integrations
- `knowledge/learnings/customer-patterns.md` — if there's a matching industry

**How to use learnings:**
- Present as an additional option alongside official recommendations
- Higher `Confirmed` count = higher weight, but user always decides

### Step 4: Live Research via Research Analyst (only if needed)

**If Step 2 identified systems needing live research**, spawn the **Research Analyst** teammate with **targeted tasks only**:

```
Research Analyst tasks (ONLY for systems not resolved from cache):
- "Find MCS MCP servers or connectors for [System A], [System B]"
- "What connector auth modes does [System C] support in MCS?"
```

The RA should:
- Check `knowledge/cache/connectors.md` + `knowledge/cache/mcp-servers.md` for baseline
- WebSearch for "[system] Copilot Studio connector" + current year
- MS Learn MCP for official docs
- Cross-reference and present options with pros/cons

**If Step 2 found nothing needing live research**, skip the RA entirely — proceed to Phase C.

### Component Selection Rules

- **MCP > individual connector actions**: When a connector offers an MCP server, ALWAYS prefer MCP
- **Present options**: For each need, recommend the best option but note alternatives
- **Flag preview features**: Note GA vs preview status for each recommendation

### Update brief.json step3

After research (live or cache-only), update:
- `step3.systems` — recommended tools with `toolType` (mcp/connector/flow/ai-tool)
- `step3.topics` — recommended conversation topics
- `step3.knowledge` — recommended knowledge sources with types

## Phase C: Architecture Design + Instructions

**Goal:** Score architecture, write instructions, and update brief.json with build-ready data.

### Step 1: Architecture Decision (Lead)

Score single vs multi-agent using the 6-factor framework:

| Factor | Single Agent (0 pts) | Multi-Agent (1 pt) |
|--------|---------------------|-------------------|
| **Domain** | Same domain | Truly separate domains |
| **Data sources** | Shared data | Different systems per capability |
| **Team ownership** | Same team | Different teams own parts |
| **Reusability** | One-off agent | Specialists reusable elsewhere |
| **Instruction size** | Fits in 8000 chars | Would exceed 8000 chars |
| **Knowledge isolation** | Shared KB | Each needs own deep KB |

**Score: 0-2 → Single Agent | 3+ → Multi-Agent**

Update `brief.json step4`:
- `architectureRecommendation` — "Single Agent" or "Multi-Agent"
- `architectureReason` — explanation with score
- `architectureScore` — the numeric score
- `children` — child agents if multi-agent

### Step 2: Instructions — Prompt Engineer (single pass)

Spawn the **Prompt Engineer** teammate to write the agent instructions. Provide the PE with:
- The agent's complete `brief.json` (step1-4 populated from Phases A-B)
- `knowledge/cache/instructions-authoring.md` for MCS patterns

The PE writes a complete, self-verified draft:
- Full system prompt ready for MCS (max 8000 chars)
- Follows MCS instruction patterns
- References tools by their MCS names (e.g., `/SharePointOneDrive`, `/OutlookCalendar`)
- Includes: identity, capabilities, workflow, response guidelines, boundaries
- PE runs their own review checklist before returning (char count, reference validity, boundary coverage)

### Step 3: QA Review (single pass, no iteration)

Spawn the **QA Challenger** to review the PE's output in a **single pass**:
- Verify instructions reference only tools that are in step3.systems
- Verify boundaries match step2 handle/decline/refuse
- Verify instruction length < 8000 chars
- Check for vague language, missing edge cases

**QA produces a verdict:**
- **PASS** — instructions are ready as-is
- **PASS WITH FIXES** — instructions are good but have specific issues. QA outputs the exact fixes needed (e.g., "Line 4: change `/JiraConnector` to `/Jira`", "Remove reference to `/TopicX` — not configured")
- **FAIL** — fundamental problems requiring rewrite (rare — only if PE missed something major)

**No iteration loop.** If QA returns PASS WITH FIXES, the lead applies the specific fixes directly. If QA returns FAIL, the lead spawns PE again with QA's feedback for one more attempt, then accepts the result.

### Step 4: Write to brief.json

Write the build-ready data directly to `brief.json`:

- `instructions` — full system prompt text (QA-reviewed, up to 8000 chars)
- `mvp.now` — what to build this sprint
- `mvp.later` — what's deferred and why

Also enrich existing fields with research findings:
- `step3.systems[].status` — availability status per tool
- `step3.systems[].notes` — auth details, config notes
- `step3.knowledge[].scope` — scoping/filtering details
- `step3.knowledge[].status` — readiness status
- `step3.topics[].triggerType` — how each topic is triggered
- `notes` — any additional context discovered during research

## Phase D: Scenarios & Evals

**Goal:** Generate test scenarios, classify topic needs, and produce evaluation CSV.

### Step 1: Generate Scenarios + Classify Topics — QA Challenger (single pass)

Spawn **QA Challenger** to generate scenarios AND classify which need custom topics vs. generative orchestration in one pass. No separate Topic Engineer needed — TE is used during `/mcs-build` when actual YAML is generated.

QA produces:

| Type | Count | Purpose |
|------|-------|---------|
| Happy path | 2-3 | Core successful interactions |
| Edge case | 1-2 | Unusual but valid requests |
| Boundary - Decline | 1-2 | Requests to decline gracefully |
| Boundary - Refuse | 1 | Hard stops |
| Error recovery | 1 | Graceful failure handling |
| Multi-turn | 1 | Conversation continuity |

For each scenario, QA also notes:
- **Topic type**: `generative` (handled by orchestration) or `custom` (needs dedicated topic YAML)
- **Trigger type**: `by-agent` (AI routes) or `phrases` (explicit triggers) or `event` (autonomous)

### Step 2: Generate evals.csv (Lead)

From QA's scenarios, create `Build-Guides/{projectId}/agents/{agentId}/evals.csv`:

```csv
"question","expectedResponse","testMethodType","passingScore"
```

Reference `knowledge/cache/eval-methods.md` for valid test method types and scoring rules.

**Mapping rules:**
- Happy path → `GeneralQuality` or `CompareMeaning` with "70"
- Boundary DECLINE → `PartialMatch` with expected decline phrase
- Boundary REFUSE → `PartialMatch` with expected refusal phrase
- Specific factual answers → `PartialMatch` with key facts

### Step 3: Update brief.json

Write evals to `brief.json.evals` array:
```json
{
  "question": "...",
  "expected": "...",
  "method": "CompareMeaning",
  "score": "70"
}
```

Update `step2.scenarios` with the generated scenarios.
Update `step3.topics` with topic classifications from QA.

## Final Output

After all phases complete for each agent:

1. **brief.json** — All fields populated (step1-4, instructions, mvp, evals, openQuestions, notes)
2. **evals.csv** — Evaluation test cases in MCS format

### Report to User

#### Terminal Output

```
## Research Complete: {projectId}

**Agents:** {count} | **Open Questions:** {count}

| Agent | Architecture | Model | Tools | Evals |
|-------|-------------|-------|-------|-------|
| {name} | {Single/Multi} | {model} | {N} | {N} |

Files: brief.json + evals.csv per agent

**Next:** Review brief in the dashboard. Resolve open questions. Then /mcs-build.
```

**No report file generated.** The dashboard renders brief.json directly. Customer-shareable reports will be an on-demand export feature (future).

## Post-Research Learnings Capture

After the terminal output, check if there are learnings worth capturing. This is lighter than the post-build capture — focus on **research-phase discoveries only**.

### What to Capture

- **New components found** that weren't in `knowledge/cache/` (already updated cache, but also log the discovery)
- **Cache corrections** — if a cache file had wrong or outdated information
- **Customer-specific patterns** — if the SDR reveals an industry pattern (e.g., "financial services customers always need X")
- **Architecture insights** — if the scoring led to a non-obvious recommendation

### Generate Summary (only if there are learnings)

```markdown
## Research Learnings: [Project] — [Date]

### New Discoveries
| Discovery | Updated In | Category |
|-----------|-----------|----------|
| [what was found] | [cache file updated] | [learnings topic] |

### Customer/Industry Patterns
| Pattern | Context | Category |
|---------|---------|----------|
| [pattern observed] | [customer/industry] | customer-patterns |
```

Present to user. If confirmed, write to `knowledge/learnings/{category}.md`.

If the research was routine and nothing surprising was found, skip the summary — don't generate empty learnings.

### Update Document Manifest

After all phases complete, update `doc-manifest.json` with the final `lastResearchAt` timestamp:

```python
manifest["lastResearchAt"] = datetime.now().isoformat()
```

This timestamp lets `/mcs-update` know when the last full research was performed.

---

## Important Rules

- **brief.json is THE source of truth** — the dashboard reads it, the build skill reads it, reports are generated from it
- **There is no separate agent-spec.md** — everything lives in brief.json including instructions and MVP scope
- **evals.csv is for testing** — the Eval skill reads it (also mirrored in brief.json evals array)
- **Only 2 permanent output files per agent**: `brief.json` and `evals.csv`. Nothing else.
- **No working-paper files**: Do NOT leave intermediate artifacts like instruction drafts, QA reviews, connector research notes, or scenario docs as separate files. All research findings go INTO brief.json fields (instructions, step3.systems[].notes, notes{}, etc.). If teammates generate working documents during collaboration, consolidate their content into brief.json and delete the working files before completing.
- **Targeted research, not exhaustive** — only spawn RA for systems that need live lookup. Stable categories (models, channels, triggers, knowledge) use cache.
- **Single-pass QA** — no PE↔QA iteration loop. PE self-checks, QA reviews once, lead applies fixes.
- **No Topic Engineer in research** — TE is for `/mcs-build` when actual YAML is needed. QA classifies topic types in Phase D.
- **Never assume components** — always research, always present options
- **Update cache** — after live research, update relevant `knowledge/cache/` files
- **Iteration comes from the user** — present open questions, let the customer/user resolve them, then re-run with `{agentId}` to re-enrich
- **Don't stop between phases** — this is a single-pass skill. Run A→B→C→D continuously.

## Teammate Usage Summary

| Phase | Teammates | When Spawned |
|-------|-----------|-------------|
| A | None | Lead reads docs, extracts data, creates stubs |
| B | **Research Analyst** | Only if agent has external systems needing live MCP/connector lookup |
| C | **Prompt Engineer** | Always — writes instructions (single pass) |
| C | **QA Challenger** | Always — reviews instructions (single pass, no iteration) |
| D | **QA Challenger** | Always — generates scenarios + classifies topics (single pass) |

**Maximum teammates per research run:** 3 (RA + PE + QA). Often just 2 (PE + QA) for Microsoft-native agents.
