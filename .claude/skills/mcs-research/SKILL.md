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

## Before Research — Knowledge Cache Check

1. Read ALL cache files in `knowledge/cache/` — check `last_verified` dates
2. If any file is > 7 days old, run quick refresh:
   - WebSearch for "[capability] Copilot Studio 2026"
   - MS Learn MCP for official docs
   - Update cache file with findings + new date
3. Read `knowledge/frameworks/component-selection.md` for the research protocol
4. Read `knowledge/frameworks/architecture-scoring.md` for scoring criteria

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

## Phase B: Component Research — Use Agent Teams

**Goal:** Research MCS components and recommend the best tools, knowledge sources, model, triggers, and channels for each agent.

### Check Past Learnings First

Before live research, read relevant `knowledge/learnings/` files for experience-based insights:

- `knowledge/learnings/connectors.md` — past connector experiences
- `knowledge/learnings/integrations.md` — system integration lessons
- `knowledge/learnings/architecture.md` — architecture decision outcomes
- `knowledge/learnings/customer-patterns.md` — industry-specific patterns

**How to use learnings:**
- If a learning matches the current agent's needs (same system, similar use case), note it
- Present as an additional option: "Official docs recommend X. However, in a past build for [context], we found Y works better because [reason]."
- Higher `Confirmed` count = higher weight, but never override official docs silently
- Learnings are options, not defaults — let the user decide

### Spawn Agent Team

Create a team and use the **Research Analyst** teammate:

```
Research Analyst tasks (run in parallel):
1. Search for MCP servers matching the agent's integration needs
2. Search for connectors matching the agent's data sources
3. Research model options (GPT-4o, GPT-4o mini, GPT-5 Auto, etc.)
4. Research trigger types matching the agent's activation needs
5. Research knowledge source options for the agent's data
6. Research channel deployment options
```

For each component category, the Research Analyst should:
- Check `knowledge/cache/` for baseline
- WebSearch for latest capabilities
- MS Learn MCP for official documentation
- GitHub for community examples
- Present options with pros/cons

### Component Selection Rules

- **MCP > individual connector actions**: When a connector offers an MCP server, ALWAYS prefer MCP
- **Research broadly**: Don't rely on cache alone — MCS ships features continuously
- **Present options**: For each need, recommend the best option but note alternatives
- **Flag preview features**: Note GA vs preview status for each recommendation

### Update brief.json step3

After research, update:
- `step3.systems` — recommended tools with `toolType` (mcp/connector/flow/ai-tool)
- `step3.topics` — recommended conversation topics
- `step3.knowledge` — recommended knowledge sources with types

## Phase C: Architecture Design — Use Agent Teams

**Goal:** Score architecture, write instructions, and update brief.json with build-ready data.

### Architecture Decision

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
- `triggers` — recommended trigger types
- `channels` — recommended deployment channels

### Instructions — Use Prompt Engineer

Spawn the **Prompt Engineer** teammate to write the agent instructions:
- Full system prompt ready for MCS (max 8000 chars)
- Follows MCS instruction patterns from `knowledge/cache/instructions-authoring.md`
- References tools by their MCS names (e.g., `/SharePointOneDrive`, `/OutlookCalendar`)
- Includes: identity, capabilities, workflow, response guidelines, boundaries

### QA Review

Spawn the **QA Challenger** to review the Prompt Engineer's output:
- Verify instructions reference only tools that are in step3.systems
- Verify boundaries match step2 handle/decline/refuse
- Verify instruction length < 8000 chars
- Check for vague language, missing edge cases
- Challenge any claims about MCS limitations

**Iterate** until QA Challenger approves.

### Write Instructions + Model to brief.json

After QA approval, write the build-ready data directly to `brief.json`:

- `instructions` — full system prompt text (QA-approved, up to 8000 chars)
- `step4.model` — recommended model with reason
- `step4.modelReason` — why this model
- `step4.architectureScore` — score from 6-factor framework
- `step4.children` — child agents if multi-agent
- `mvp.now` — what to build this sprint
- `mvp.later` — what's deferred and why

Also enrich existing fields with research findings:
- `step3.systems[].status` — availability status per tool
- `step3.systems[].notes` — auth details, config notes
- `step3.knowledge[].scope` — scoping/filtering details
- `step3.knowledge[].status` — readiness status
- `step3.topics[].triggerType` — how each topic is triggered
- `notes` — any additional context discovered during research

## Phase D: Scenarios & Evals — Use Agent Teams

**Goal:** Generate test scenarios and evaluation CSV.

### Scenarios — Use QA Challenger + Topic Engineer

Spawn **QA Challenger** to generate scenarios:

| Type | Count | Purpose |
|------|-------|---------|
| Happy path | 2-3 | Core successful interactions |
| Edge case | 1-2 | Unusual but valid requests |
| Boundary - Decline | 1-2 | Requests to decline gracefully |
| Boundary - Refuse | 1 | Hard stops |
| Error recovery | 1 | Graceful failure handling |
| Multi-turn | 1 | Conversation continuity |

Spawn **Topic Engineer** to identify which scenarios need custom topics vs. generative orchestration.

### Generate evals.csv

From scenarios, create `Build-Guides/{projectId}/agents/{agentId}/evals.csv`:

```csv
"question","expectedResponse","testMethodType","passingScore"
```

Reference `knowledge/cache/eval-methods.md` for valid test method types and scoring rules.

**Mapping rules:**
- Happy path → `GeneralQuality` or `CompareMeaning` with "70"
- Boundary DECLINE → `PartialMatch` with expected decline phrase
- Boundary REFUSE → `PartialMatch` with expected refusal phrase
- Specific factual answers → `PartialMatch` with key facts

### Update brief.json evals

Write the eval test cases to `brief.json.evals` array so the dashboard can display them:
```json
{
  "question": "...",
  "expected": "...",
  "method": "CompareMeaning",
  "score": "70"
}
```

### Update brief.json scenarios

Ensure `step2.scenarios` is populated with the generated scenarios.

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
- **Agent Teams improve quality** — Research Analyst prevents false claims, Prompt Engineer writes sharp instructions, QA Challenger catches errors
- **Never assume components** — always research, always present options
- **Update cache** — after live research, update relevant `knowledge/cache/` files
- **Iteration comes from the user** — present open questions, let the customer/user resolve them, then re-run with `{agentId}` to re-enrich
- **Don't stop between phases** — this is a single-pass skill. Run A→B→C→D continuously.
