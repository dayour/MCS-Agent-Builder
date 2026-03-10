---
name: mcs-research
description: Full research pass — reads project documents, identifies agents, researches MCS components, designs architecture, enriches brief.json + generates evals. Uses Agent Teams for quality.
---

# MCS Research

Single-pass pipeline: read documents, identify agents, research components, design architecture, write instructions, generate eval sets. This skill absorbs the former mcs-analyze step — there is no separate extraction step.

## Input

```
/mcs-research {projectId}              # Project-level: all agents
/mcs-research {projectId} {agentId}    # Agent-level: scoped to one agent
```

**Project-level** (no agentId):
- First run: reads all docs, identifies agents, deep research, creates brief.json with evalSets + evals.csv
- Subsequent runs: smart-detects new/changed docs, routes to full or incremental

**Agent-level** (with agentId):
- After project research: smart-detects new/changed docs relevant to this agent, incremental enrichment
- Manually created agent (no prior research): full deep research scoped to this agent
- Brief edited (open questions answered): re-enriches with new context even without new docs

## Output Files (per agent)

- `Build-Guides/{projectId}/agents/{agentId}/brief.json` — Single source of truth (all fields populated including instructions + evalSets)
- `Build-Guides/{projectId}/agents/{agentId}/evals.csv` — Evaluation test cases (flat CSV generated from evalSets for MCS native eval compatibility)

**That's it. Two files.** No research report (future: on-demand export from dashboard). No working-paper files.

## Before Research — Load Frameworks

The session startup protocol already checks cache freshness and refreshes stale Tier 1 files. Do NOT re-check all 19 cache files here.

1. Read `knowledge/frameworks/component-selection.md` for the research protocol
2. Read `knowledge/frameworks/architecture-scoring.md` for scoring criteria
3. Read `knowledge/frameworks/solution-type-scoring.md` for the solution type pre-gate

**Cache files are read on-demand** in Phase A (for informed questions) and Phase B (for component research). Only read the specific files needed, not all 18.

## Microsoft-First Component Priority

**Enterprise agents run on the Microsoft stack.** When selecting components, follow this priority order:

| Priority | Source | Examples | Research Needed? |
|----------|--------|----------|-----------------|
| 1 | **MCS Built-In** | MCP servers, native knowledge, generative orchestration | Cache only |
| 2 | **Power Platform** | Power Automate flows, Dataverse, custom connectors | Cache only |
| 3 | **Azure Services** | Azure Functions, Azure AI, Azure Storage | Cache + quick verify |
| 4 | **M365 Connectors** | SharePoint, Outlook, Teams (Standard tier) | Cache only |
| 5 | **Certified Premium Connectors** | Dynamics 365, ServiceNow, Salesforce | Cache + verify availability |
| 6 | **Third-Party / Custom** | Custom MCP servers, HTTP endpoints, community tools | Full live research required |

**Fast path rule:** If ALL agent integrations map to Priority 1-4, skip live MCP catalog scan (Phase B Step 0) and skip Research Analyst spawn (Phase B Step 4). Resolve everything from cache — these are well-documented, enterprise-supported, and GA.

**Only escalate to live research** when the agent has Priority 5-6 integrations (external systems not in cache, or cache > 7 days stale for the specific system).

## Phase 0: Smart Research Routing (Unified)

**Goal:** Determine the optimal processing path for ANY invocation — project or agent level. Detects new/changed docs, brief edits, and manually created agents.

**This phase runs for ALL invocations.** No bypass, no skip.

### Step 0.1: Determine Scope

- `/mcs-research {projectId}` → `scope = "project"`
- `/mcs-research {projectId} {agentId}` → `scope = "agent"`

### Step 0.2: Check Preconditions (Manifest + Brief)

| Scope | Manifest? | Brief? | Result |
|-------|-----------|--------|--------|
| project | No | — | `processingPath = "full"` (first run) |
| project | Yes | — | Proceed to Step 0.3 (diff docs) |
| agent | — | No / empty stub | `processingPath = "full-agent"` (manually created, deep research scoped to this agent) |
| agent | — | Yes + enriched | Proceed to Step 0.3 (diff docs) |

Read `Build-Guides/{projectId}/doc-manifest.json` for manifest check.
Read `Build-Guides/{projectId}/agents/{agentId}/brief.json` for brief check (agent scope only).

"Empty stub" = brief.json exists but `instructions` is empty AND `capabilities` is empty (never been through research).

### Step 0.3: Diff Documents Against Manifest

1. List all files in `Build-Guides/{projectId}/docs/` matching supported extensions: `.md`, `.csv`, `.json`, `.txt`, `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.tiff`, `.webp`, `.docx`, `.pdf`
2. For each file, compute SHA-256 hash via PowerShell:
   ```powershell
   (Get-FileHash -Path "file" -Algorithm SHA256).Hash
   ```
3. Compare against `manifest.docsProcessed[]` entries by filename + sha256:
   - **`newDocs[]`** — files in docs/ not in manifest
   - **`changedDocs[]`** — files in manifest whose hash differs
   - **`deletedDocs[]`** — files in manifest not present in docs/
4. **Agent-scoped filtering:**
   - If `scope = "project"`: diff ALL docs (current behavior)
   - If `scope = "agent"`: diff docs where `matchedAgents` includes this agentId, PLUS any new docs (not yet in manifest)
   - If no manifest exists (agent scope, brief exists): treat ALL project docs as candidates, filter by relevance in Step 0.4
5. If changes exist → proceed to Step 0.4
6. If no changes → proceed to Step 0.5 (check brief modifications)

### Step 0.4: Document-to-Agent Mapping (when new/changed docs exist)

For each new/changed doc, determine which agent(s) it belongs to:

1. Read each doc content, score relevance against every agent's `brief.json`:
   - Systems mentioned → match `integrations[]`
   - Domain keywords → match `business.problemStatement`
   - Capabilities → match `capabilities[].name`
   - Agent name explicitly mentioned → direct match
2. **Auto-map** if relevance is clear (matches one agent strongly)
3. **Ask user** via AskUserQuestion if ambiguous (matches multiple equally, or matches none)
4. **Cross-cutting docs** (org policies, IT standards) → apply to all agents
5. **Agent-scoped invocation**: assume new docs are for this agent (user clicked Research on specific agent), but flag if doc seems irrelevant to this agent's domain

Output the mapping:
```
## Document → Agent Mapping
| Document | Agent(s) | Confidence |
|----------|----------|-----------|
| new-jira-reqs.md | incident-manager | High (mentions Jira, tickets) |
| company-policy.md | All agents | Cross-cutting |
```

Then proceed to Step 0.6 (drastic change detection).

### Step 0.5: Check for Brief Modifications (when no doc changes detected)

**For agent scope only** — if no doc changes were detected for this agent:
- Compare brief.json file modification time vs `manifest.lastResearchAt`
- If brief is newer → set `processingPath = "re-enrich"` (brief was edited, re-run Phase B→C)
- If brief is NOT newer → set `processingPath = "none"` (truly nothing to do)

**For project scope** — if no doc changes at all:
- Output: `No document changes since last research ({manifest.lastResearchAt}). Nothing new to process.`
- **Exit** the skill.

### Step 0.6: Drastic Change Detection (scope-aware)

Only run when processing new/changed docs (from Step 0.4).

Read new/changed docs and check 5 thresholds. **Any one** triggers a fallback to full research:

| Threshold | How to Detect | Scope |
|-----------|--------------|-------|
| New agent described | Content describes an agent not in `Build-Guides/{projectId}/agents/` | Project only |
| Architecture change | Content implies single ↔ multi-agent switch | Project only |
| >4 brief sections affected | Map content to brief sections; count > 4 | Both |
| Problem statement shift | Content fundamentally changes `business.problemStatement` | Both |
| Volume ratio >2x | Total bytes of new/changed docs > 2x total bytes of existing processed docs | Both |

At agent scope, skip "new agent described" and "architecture change" thresholds (those are project-level concerns).

### Step 0.7: Route and Report

| Condition | `processingPath` | Phases |
|-----------|-----------------|--------|
| First project run (no manifest) | `full` | A → B → C (all docs, deep research) |
| First agent run (empty brief) | `full-agent` | A → B → C (scoped to agent, reads all project docs for relevance) |
| No changes, brief not edited | `none` | Exit with message |
| Brief edited, no new docs | `re-enrich` | B → C (skip A, re-enrich with current brief context) |
| Changes exist, not drastic | `incremental` | A-inc → B-inc → C-inc |
| Changes exist, drastic | `full` | Warning → A → B → C |

**Output to user before proceeding:**

```
## Research: {projectId} [{agentId if scoped}]
**Scope:** {Project / Agent: agentName}
**New docs:** {N} | **Changed:** {N} | **Deleted:** {N}
**Mode:** {Full / Full-Agent / Incremental / Re-enrich / Nothing new}
{If incremental: doc→agent mapping table}
```

Then proceed to Phase A with the determined `processingPath`.

## Phase A: Document Comprehension & Agent Identification

**Goal:** Read ALL project documents, build a unified understanding, identify every agent to build, and create brief.json stubs with informed open questions.

**This is NOT dumb extraction — it's deep comprehension.**

### Incremental Path (processingPath == "incremental")

When `processingPath == "incremental"`, Phase A operates on new/changed docs only, merging into the existing brief:

1. **Read ONLY `newDocs` + `changedDocs`** (not all docs). Also read each existing `brief.json` under `Build-Guides/{projectId}/agents/*/brief.json` for context.
2. **Agent-scoped filtering:** If `scope = "agent"`, only process docs mapped to this agent in Step 0.4. Write changes only to this agent's brief.
3. **Cross-reference** new content against existing brief fields. Look for: new systems, new capabilities, answers to existing open questions, contradictions with existing data.
4. **Check for new agents.** If new docs describe an agent not in `agents/`, the drastic threshold should have caught it in Phase 0 — escalate to `processingPath = "full"` if missed.
5. **Extract data only from new/changed docs.** Map to agents using the doc→agent mapping from Step 0.4.
6. **Apply merge rules:**
   - **Append-only:** `capabilities[]`, `boundaries.handle/decline/refuse`, `integrations[]`, `conversations.topics[]`, `knowledge[]`, `evalSets[].tests[]`
   - **Never overwrite:** `instructions`, answered `openQuestions[].answer`
   - **Resolve:** unanswered `openQuestions` if doc provides the answer
   - **Flag conflicts:** `business.problemStatement`, `architecture.type` → add to `_updateFlags`
7. **Show summary** of what was extracted and which agents were affected.
8. **Update manifest incrementally:** Add new entries, update hashes for changed docs, remove deleted docs, preserve unchanged entries. Set `processedAt` for each processed file. Update `matchedAgents` for new docs.

Then proceed to Phase B (incremental).

### Full-Agent Path (processingPath == "full-agent")

When `processingPath == "full-agent"` (manually created agent, empty brief):

1. **Read ALL project docs** in `Build-Guides/{projectId}/docs/`, but only extract/write data for this specific agent.
2. **Skip agent identification** — agent already exists (user created it manually).
3. **Score relevance** of each doc against this agent's name/description. Filter out clearly irrelevant docs.
4. **Extract per-agent data** — same as full path Step 4 below, but only for this one agent.
5. **Create manifest entries** with `matchedAgents` for this agent.
6. **Write brief.json stub** with all extracted data (same as full path Step 5).

Then proceed to Phase B (full path — this agent needs deep research).

### Full Path (processingPath == "full")

Existing behavior — process all documents as described below.

### Step 1: Read All Documents

Read every file in `Build-Guides/{projectId}/docs/`:
- `.md` files — read directly
- `.docx` files — convert via pandoc first: `pandoc "file.docx" -t gfm -o "file.md"` (if not on PATH, check `%LOCALAPPDATA%\Pandoc\pandoc.exe`)
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

### Step 3.5: Solution Type Assessment

**Goal:** Determine whether each agent candidate actually needs to be an MCS agent, or if a simpler solution (Power Automate flow, SharePoint view, etc.) is more appropriate.

**This step runs for each agent candidate identified in Step 3.** It uses the 5-factor framework from `knowledge/frameworks/solution-type-scoring.md`.

**Skip this step if:** `solutionTypeOverride: true` exists in the agent's existing brief (user clicked "Build as Agent Anyway" in the dashboard).

#### Assessment Process

For each agent candidate:

1. **Classify capabilities:** Read the capability descriptions from the SDR/docs. For each, assign a lightweight `implementationType` estimate:
   - `prompt` — behavior encoded in instructions only
   - `topic` — requires custom conversation flow
   - `knowledge` — requires knowledge source Q&A
   - `tool` — requires a tool/connector with deterministic I/O
   - `flow` — requires a Power Automate flow (event-driven pipeline)

2. **Score the 5 factors:**
   - **Conversational Need:** Do users need dialogue, or just data moved/displayed?
   - **Interaction Pattern:** Is the dominant pattern reactive (AI judgment) or procedural (deterministic pipeline)?
   - **Capability Distribution:** Are 50%+ capabilities conversational types (prompt/topic/knowledge)?
   - **User Value of NL:** Do users gain clear value from natural language over structured UI?
   - **MCS Feasibility:** Does this fit within MCS technical constraints?

3. **Write assessment to brief stub:**
   - `architecture.solutionType` — `"agent"`, `"flow"`, `"hybrid"`, or `"not-recommended"`
   - `architecture.solutionTypeScore` — 0-5
   - `architecture.solutionTypeFactors` — per-factor value + reasoning
   - `architecture.solutionTypeReason` — 2-4 sentence explanation
   - `architecture.alternativeRecommendation` — if not agent, what to build instead

4. **Route based on score:**

| Score | solutionType | Research Path |
|-------|-------------|---------------|
| **4-5** | `agent` | Continue normally — Steps 4-6 then Phases B+C |
| **3** | Borderline | Continue with agent research. Create `solution-type` decision with `agent`, `hybrid`, and `flow` options. Pre-apply `hybrid`. |
| **1-2** | `flow` | Write simplified brief: populate `business.*`, `agent.name/description`, `capabilities[]`, `recommendations[]`, `architecture.alternativeRecommendation`. **Skip Phases B+C** (no instructions, eval sets, or architecture scoring). |
| **0** | `not-recommended` | Write minimal brief with alternative. **Skip all deep research.** |

#### Simplified Brief (flow / not-recommended)

When `solutionType` is `flow` or `not-recommended`, the brief is intentionally minimal:
- `business.*` — fully populated (problem statement, challenges, benefits)
- `agent.name`, `agent.description` — set for identification
- `capabilities[]` — all identified, with `implementationType` classifications
- `architecture.solutionType*` — all assessment fields populated
- `architecture.alternativeRecommendation` — detailed recommendation for what to build instead
- `recommendations[]` — MCS best practices replaced with alternative-specific guidance
- `openQuestions[]` — any remaining unknowns

**Not populated:** `instructions`, `evalSets`, `architecture.type/factors/score` (arch scoring), `conversations.topics[]` (no topic YAML), `integrations[]` (minimal — list systems but no MCS connector research)

#### Output Modification for Non-Agent Types

When presenting the Phase A summary (Step 6):
- **Agent types:** Normal output — "Proceeding to full MCS component research..."
- **Flow/not-recommended:** Modified output:
  ```
  ## Solution Type Assessment: {agentName}
  **Score:** {N}/5 → {solutionType}
  **Recommendation:** {alternativeRecommendation summary}

  Simplified brief written. Full MCS research skipped — this use case is better served by {alternative}.
  ```

### Step 4: Extract Per-Agent Data & Generate Informed Open Questions

For each agent, extract what's in the documents AND cross-reference against `knowledge/cache/` to generate *informed* open questions.

| Field | Where to Look |
|-------|--------------|
| `agent.name` | Title, agent name field, heading |
| `business.problemStatement` | Problem statement, opportunity description, pain points |
| `business.challenges` | Business challenges, inefficiencies, pain points |
| `business.benefits` | Expected outcomes, ROI, efficiency gains |
| `agent.description` | Agent purpose, what it does, for whom |
| `capabilities[].name` | Solution ideas, capabilities list, "what it does" sections |
| `boundaries.handle` | Inferred from capabilities and scope description |
| `boundaries.decline` | Out-of-scope mentions, limitations |
| `boundaries.refuse` | Hard boundaries, compliance requirements |
| `integrations[]` | Data sources table, integrations mentioned, connectors listed |
| `knowledge[]` | Knowledge sources table, SharePoint sites, document references |
| `architecture.triggers` | Autonomous triggers table, scheduling mentions |
| `architecture.channels` | Deployment targets (Teams, M365 Copilot, website, etc.) |

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

**For agents assessed as `flow` or `not-recommended` in Step 3.5:** Do NOT proceed to Phase B for those agents. Their simplified briefs are already written. Only proceed to Phase B for agents with `solutionType == "agent"` or `"hybrid"`.

Then continue directly to Phase B. **Do not stop and wait** — this is a single-pass skill. The user will provide feedback after the full research is complete.

### Step 6.5: Write Document Manifest

Write `doc-manifest.json` to `Build-Guides/{projectId}/` containing every document read during Phase A. This is the baseline for future incremental runs.

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

This manifest enables incremental research to detect new/changed documents without re-running the full pipeline.

## Phase B: Component Research — Targeted

**Goal:** Research MCS components and recommend the best tools, knowledge sources, model, triggers, and channels for each agent.

**Key principle:** Don't research all 6 categories live for every agent. Stable categories use cache directly. Only dispatch live research for the agent's specific integration systems.

### Step 0: MCP Server Discovery (CONDITIONAL)

**Goal:** Discover available MCP servers and recommend relevant ones — but only when needed.

**This step is NOT unconditional.** Check these conditions first:

| Condition | Action | Time Saved |
|-----------|--------|-----------|
| ALL integrations are M365-native (Priority 1-4) | **SKIP entirely** — cache has everything needed | ~5 min |
| Cache `mcp-servers.md` refreshed < 24h AND no new capabilities from Phase A | **Skip fetch (Steps 1-5), run matching only (Steps 6-7)** from cached data | ~3 min |
| Agent has Priority 5-6 integrations OR cache > 7 days OR first full research | **Run full scan** (Steps 1-7) | 0 (required) |

**When skipped entirely, report it:** "Microsoft-native agent — MCP catalog scan skipped (all integrations Priority 1-4)."

**When running full scan:**

1. **Read catalog URLs** from `knowledge/cache/mcp-servers.md` metadata header (`catalog_url` and `agent365_url`)
2. **Fetch both catalog pages** via MS Learn MCP (`microsoft_docs_fetch`):
   - MCS built-in catalog: `catalog_url`
   - Agent 365 tooling servers overview: `agent365_url`
3. **Extract server names** from both pages (look for server names in tables, headings, and lists)
4. **Diff against cache** — compare extracted servers against entries in `knowledge/cache/mcp-servers.md`:
   - **New servers** = in catalog but not in cache
   - **Removed servers** = in cache but no longer in catalog (may be deprecated)
5. **If new servers found:**
   - Research each via `microsoft_docs_fetch` (follow links from catalog page) or `microsoft_docs_search` for details
   - Update `knowledge/cache/mcp-servers.md` with new entries (name, description, status, category)
   - Update `last_verified` date in cache metadata
6. **Match ALL available MCP servers against agent capabilities from Phase A:**
   - For each capability's `dataSources` and `integrations[]`, check: is there an MCP server that covers this data domain?
   - For each MCP server in the catalog, check: does this agent's use case overlap with the server's capabilities?
   - Consider the agent's channels, knowledge needs, and workflow patterns — not just explicit data source mentions
7. **Present discovery summary to user:**

```
## MCP Server Discovery: {agentName}

**Catalog:** {N} servers in MCS catalog, {M} in Agent 365 catalog
**Cache:** {K} servers cached | {new count} new since last scan

**Available MCPs relevant to this agent:**
| MCP Server | Why Relevant | Currently In Brief? |
|------------|-------------|-------------------|
| {server} | {matches capability X / data source Y} | Yes / No |

**Recommended additions:** {list of MCPs not in brief but relevant}
**No match:** {list of catalog MCPs not relevant to this agent}
```

8. **If relevant MCPs are missing from the brief's integrations**, add them as recommendations (don't auto-add — present for user decision). Flag with `source: "catalog-scan"` so the user knows this came from proactive discovery, not document extraction.

### Incremental Path (processingPath == "incremental")

When `processingPath == "incremental"`, Phase B is scoped to only what's new:

1. **Skip stable category resolution** unless Phase A-inc found new architecture-relevant data (new channels, triggers, knowledge types not already in the brief). If all new content maps to existing categories, skip directly to Step 2.5.
2. **Only research NEW external systems** from the new docs that aren't already in `integrations[]`. If a doc mentions "Jira" and the agent already has Jira in integrations, skip it.
3. **Run Step 2.5 (Solution Pattern Reality Check)** for ALL MVP capabilities — patterns may have been added since initial research, and existing integrations may match newly documented anti-patterns.
4. **Check learnings** (same as full — quick read of relevant `knowledge/learnings/` files).
5. **Spawn Research Analyst only if new external systems were found** that need live MCP/connector lookup. If everything maps to existing integrations or Microsoft-native tools, skip RA entirely.

Then proceed to Phase C (incremental).

### Full Path (processingPath == "full" or "full-agent")

Existing behavior — research all categories as described below.

### Step 1: Resolve Stable Categories from Cache (Lead)

These categories are well-documented and change infrequently. Read the cache files directly — no live research needed unless the doc mentions something unusual:

| Category | Cache File | Lead Action |
|----------|-----------|-------------|
| **Channels** | `knowledge/cache/channels.md` | Read cache. Default Teams + Web Chat unless docs say otherwise. |
| **Triggers** | `knowledge/cache/triggers.md` | Read cache. Match trigger type to agent's activation needs from Phase A. |
| **Knowledge sources** | `knowledge/cache/knowledge-sources.md` | Read cache. Match to data types from Phase A (SharePoint, files, websites). |

Write these directly to `brief.json`:
- `architecture.channels` (each with `name` + `reason`)
- `architecture.triggers` (each with `type` + `description`)
- `knowledge[]` (each with `name`, `type`, `purpose`, `scope`, `phase`)

### Step 2: Identify What Needs Live Research

**Microsoft-native fast path:** Before identifying external systems, classify every integration:
- **M365-native (Priority 1-4):** SharePoint, Outlook, Teams, OneDrive, Planner, Excel, Dataverse, Dynamics 365, Power Automate, Azure services → resolve from cache, no live research
- **External (Priority 5-6):** Everything else → needs cache check + potential live research

If ALL integrations are M365-native → **skip Steps 3-4 entirely** (no learnings check for connectors, no RA spawn). Proceed directly to Step 2.5 (reality check against solution patterns — this still runs because patterns catch naive implementations regardless of stack).

**When M365-native fast path does NOT apply**, list the agent's **specific external systems** that need MCP/connector lookup:

```
Example: Agent needs Jira, ServiceNow, Confluence
→ Research task: "Find MCS MCP servers or connectors for Jira, ServiceNow, Confluence"
```

**Skip live research if:**
- The agent only uses Microsoft-native tools (Priority 1-4) — resolved from cache via fast path above
- The agent has no external system integrations (pure knowledge agent)
- All systems are already in `knowledge/cache/connectors.md` or `knowledge/cache/mcp-servers.md` with recent `last_verified` dates

### Step 2.5: Implementation Reality Check (Lead)

**Goal:** Challenge every MVP capability's implementation approach — both against known anti-patterns AND from first principles. Don't trust the SDR doc's proposed solution just because the customer wrote it. The customer describes their problem well; their proposed *technical approach* may be naive.

**Why this matters:** Recommending something that doesn't work destroys credibility. If we tell a customer "use HTTP Request + AI Prompt to extract articles" and it returns garbage HTML in their first test, they lose trust in everything else we recommended. It's not about giving the right answer — it's about never giving the wrong one. A brief that says "this needs an Azure Function" is honest and buildable. A brief that says "HTTP connector handles this" is a lie that wastes everyone's time.

**Two-part check: Pattern Matching + First-Principles Feasibility.**

#### Part A: Solution Pattern Matching

1. **Read `knowledge/patterns/solution-patterns.md`** for the full pattern catalog
2. **For each MVP capability** in the brief:
   a. **Trace data flow:** What is the input? What processing happens? What is the output?
   b. **Check "When to match" conditions** for each solution pattern (sp-001 through sp-010+)
   c. **If a pattern matches:** Recommend the proven alternative. Update `integrations[]` if the proven pattern requires a different tool (e.g., Power Automate flow instead of HTTP connector). Add a note to `conversations.topics[].notes` explaining why the naive approach was replaced.
   d. **If no pattern matches but the capability involves 3+ transformation steps:** Flag for manual review — it may need a new pattern or a Power Automate flow.

#### Part B: First-Principles Feasibility Challenge

For EVERY MVP integration in `integrations[]`, ask these 5 questions:

| Question | What You're Checking | Red Flag |
|----------|---------------------|----------|
| **1. What does this tool actually return?** | Read the tool/connector/MCP docs. Don't assume from the name. | "HTTP Request" doesn't return clean text. "Word MCP" can't do templates. |
| **2. Does this solve the customer's problem or just move it?** | Compare the integration's actual output against what the capability needs. | Tool returns raw data that still needs the same cleanup the customer already struggles with. |
| **3. What happens at realistic scale?** | Check limits, timeouts, token budgets, payload sizes. | 6-8 articles × 100KB HTML = 600-800KB through AI prompts with 5K char limits. |
| **4. What fails silently?** | JS-rendered pages returning empty HTML, soft paywalls, rate limits, bot detection. | Tool "works" in testing but fails on real-world URLs. |
| **5. Does this need something that doesn't exist yet?** | Custom deployment (Azure Function), licensing (M365 Copilot), customer infrastructure. | Brief assumes a tool is "available" but it needs provisioning, licensing, or deployment first. |

**For each integration that fails any question**, mark it as `needsRework` and add to the reality check summary with:
- Which question(s) it failed
- What the actual behavior is (with source — docs link, community post, etc.)
- What should replace it

#### Output

3. **Present the combined reality check:**

```
## Implementation Reality Check: {agentName}

### Pattern Matches
| Capability | Pattern | Naive → Proven | Impact |
|-----------|---------|----------------|--------|
| {name} | sp-001 | HTTP Request → Readability service | New Azure Function needed |
| {name} | (none) | — | OK as designed |

### Feasibility Challenges
| Integration | Failed Question | Issue | Recommendation |
|------------|----------------|-------|----------------|
| {name} | #1 (actual output) | Returns raw HTML, not clean text | Replace with extraction service |
| {name} | #5 (doesn't exist yet) | Requires M365 Copilot license | Verify licensing or use standard connector |
| {name} | — | Passes all checks | OK |
```

4. **Flag integrations that need rework** for Step 4 (RA research) or user discussion. If a feasibility failure changes the integration approach significantly (e.g., adds an Azure Function dependency, requires licensing), flag it as requiring customer discussion.

#### Part C: Decision Generation from Pattern Matches

When Step 2.5 finds a pattern match with **2+ viable implementation tiers**, create a structured decision instead of auto-selecting one approach:

1. **Check tier viability:** For each matched pattern, filter implementation tiers against known customer constraints (from brief.json, open questions, or Phase A extraction). Remove tiers the customer clearly can't use (e.g., "Azure Function" when customer has no Azure subscription and answered "no" to Azure access).
2. **Decision threshold:** If 2+ tiers survive filtering → **create a `decisions[]` entry**. If only 1 tier survives → **auto-apply** that tier to brief fields, no decision entry needed.
3. **Map tiers to options:** Each surviving tier becomes an option in the decision. Use the pattern's tier data to populate `label`, `summary`, `pros`, `cons`, `requirements`, `cost`, `effort`. Set `confidence` based on the tier's track record (`confirmed` builds from the pattern).
4. **Set recommended:** Default recommendation = highest-ranked surviving tier (Tier 1 unless disqualified). Set `recommendedOptionId` to that option's ID.
5. **Pre-apply recommended:** Write the recommended option's `briefPatch` to the actual brief fields (integrations[], conversations.topics[].notes, etc.). This gives the brief a buildable default even if the user never reviews decisions.
6. **Set source:** `"solution-pattern:{patternId}:tier-{N}"` for each option.

**Decision entry format:**
```json
{
  "id": "d-{NNN}",
  "category": "integration",
  "title": "How should we {capability description}?",
  "context": "The naive approach ({naive}) fails because {reason}. Multiple proven alternatives exist.",
  "targetField": "integrations[name={integration}]",
  "capability": "{capability name from brief}",
  "status": "pending",
  "selectedOptionId": null,
  "recommendedOptionId": "opt-1",
  "resolvedAt": null,
  "resolvedBy": null,
  "options": [/* one per viable tier */]
}
```

**When to skip decision generation:**
- Pattern has only 1 viable tier after constraint filtering → auto-apply
- Pattern match is clear-cut with no meaningful tradeoffs between tiers → auto-apply top tier
- The capability is `phase: "future"` → skip entirely (no need to decide on deferred items)

**Skip conditions:**
- If the agent has no MVP capabilities (shouldn't happen, but guard)

**Always runs against ALL MVP capabilities** regardless of processing path (full, full-agent, incremental, re-enrich). Solution patterns may be added to the catalog after initial research, and existing integrations may match newly documented anti-patterns. First-principles checks catch issues that no pattern catalog covers. The cost is low and the risk of missing a naive approach is high.

### Step 3: Check Past Learnings (only relevant files)

Read learnings files only if they're relevant to this agent's systems and non-empty:

- `knowledge/learnings/connectors.md` — if the agent has external connectors
- `knowledge/learnings/integrations.md` — if the agent has complex integrations
- `knowledge/learnings/customer-patterns.md` — if there's a matching industry

**Also read `knowledge/patterns/solution-patterns.md`** for implementation patterns that may apply to this agent's integrations, and **`knowledge/learnings/index.json`** to check confirmed counts. Entries with higher `confirmed` values get stronger presentation weight.

**How to use learnings:**
- Present as an additional option alongside official recommendations
- Higher `Confirmed` count = higher weight, but user always decides

**If a cached category is confirmed by learnings** (e.g., same trigger approach worked in 3 builds), bump `confirmed` count in `index.json` (Tier 1 auto-capture — no user confirmation needed).

### Step 4: Live Research via Research Analyst (when needed)

Spawn the **Research Analyst** when ANY of these are true:

| Trigger | RA Task |
|---------|---------|
| Step 2 found external systems not in cache | "Find MCS MCP servers or connectors for [System A], [System B]" |
| Step 2.5 flagged an integration as `needsRework` | "Research alternatives for [integration] — current approach fails because [reason]. Find what actually works." |
| Step 2.5 found a capability with no viable integration | "How can MCS implement [capability]? The obvious approach ([X]) doesn't work because [Y]." |

The RA should:
- Check `knowledge/cache/connectors.md` + `knowledge/cache/mcp-servers.md` for baseline
- WebSearch for the capability + "Copilot Studio" + current year (catch preview/new features)
- MS Learn MCP for official docs on tool/connector actual behavior
- Fetch actual API/tool documentation to verify what a tool returns (don't trust names)
- Cross-reference and present **ranked options** with pros/cons, cost, reliability, and deployment requirements
- **Challenge the doc's proposed approach** — if the SDR says "use HTTP to scrape," the RA should independently evaluate whether that works, not just find HTTP connector docs

**Skip RA entirely when:**
- All integrations are M365-native (Priority 1-4) AND Step 2.5 passed all integrations
- All systems are in `connectors.md` or `mcp-servers.md` cache with `last_verified` < 7 days
- processingPath == "re-enrich" (brief edits only, no new integrations)

**When skipped, report it:** "Microsoft-native agent — external connector research skipped."

### Step 4.5: Decision Generation from RA Results

When the Research Analyst returns results with **2+ viable approaches** for a system integration:

1. **Rank options** by: native MCS support > certified connector > custom connector > Power Automate flow > HTTP request
2. **Decision threshold:** If 2+ approaches are genuinely viable (not just "possible" — they must actually work for the customer's use case) → **create a `decisions[]` entry**. If 1 clear winner exists → **auto-apply**, no decision entry.
3. **Map RA findings to options:** Each viable approach becomes an option with `label`, `summary`, `pros`, `cons`, `requirements`, `cost`, `effort`, `confidence` (based on RA's source quality — official docs = high, community blog = medium, untested = low).
4. **Set source:** `"research-analyst"` for RA-discovered options, `"cache:connectors"` or `"cache:mcp-servers"` for cache-sourced options.
5. **Pre-apply recommended:** Write the top-ranked option's `briefPatch` to brief fields as the buildable default.

**What counts as "genuinely viable":**
- Tool/connector exists and is GA or public preview
- Auth method is compatible with the customer's environment
- Tool actually returns the data the capability needs (verified by RA, not assumed from name)
- Customer can reasonably set it up (no enterprise licensing for a 10-person team)

**What does NOT count:**
- Theoretical approaches no one has tried ("you could build a custom MCP server...")
- Tools that exist but don't solve the actual problem (name matches but behavior doesn't)
- Deprecated or private preview features

### Component Selection Rules

- **MCP > individual connector actions**: When a connector offers an MCP server, ALWAYS prefer MCP
- **Present options**: For each need, recommend the best option but note alternatives
- **Flag preview features**: Note GA vs preview status for each recommendation

### Update brief.json

After research (live or cache-only), update:
- `integrations[]` — recommended tools with `type` (mcp/connector/flow/ai-tool), `purpose`, `dataProvided`, `authMethod`, `phase`
- `conversations.topics[]` — recommended conversation topics with `triggerType`, `topicType`, `implements[]`
- `knowledge[]` — recommended knowledge sources with `type`, `purpose`, `scope`, `phase`

## Phase C: Architecture, Instructions, Eval Sets & Topics (PARALLEL)

**Goal:** Score architecture, select model, write instructions, classify topics, generate eval sets, validate topic feasibility. **Teammates run in parallel** for speed.

**Time budget:** ~8-12 min (parallel) vs ~20-25 min (old sequential).

### Re-enrich Path (processingPath == "re-enrich")

When `processingPath == "re-enrich"` (brief was edited, no new docs — e.g., user answered open questions):

Phase A was skipped (no new docs to process). Go straight to:

1. **Re-score architecture** if answered questions affect the 6-factor scoring (e.g., answered "Which teams own this?" could change teamOwnership factor). If score changes, update `architecture.score` and `architecture.factors`.
2. **Generate `instructionsDelta`** noting what changed from answered questions. If `instructions` is empty (never written), write from scratch via Prompt Engineer (same as full mode). If instructions exist, generate delta and flag for review.
3. **Parallel dispatch** (Step 2 below) — QA generates new eval tests if answered questions affect coverage, TE reviews topic changes if answers affect topic structure.
4. **Update MVP fields** if applicable — answered questions may clarify what's now vs later.

### Incremental Path (processingPath == "incremental")

When `processingPath == "incremental"`, Phase C preserves existing architecture and instructions:

1. **Re-score architecture only if** Phase A-inc added new capabilities or integrations that affect the 6-factor scoring. If the score changes, add to `_updateFlags` with the old and new score — do NOT automatically switch architecture type.
2. **Do NOT rewrite instructions.** Instead, generate an `instructionsDelta` describing what changed (new capabilities, new tools, new boundaries) and store in `notes.instructionsDelta`. Flag for the user: "Instructions may need updating — review delta in dashboard."
   - **Exception:** If the `instructions` field is currently empty (never written), write from scratch via Prompt Engineer (same as full mode).
3. **Parallel dispatch** (Step 2 below) — QA generates tests for NEW capabilities only (appends to existing evalSets). TE reviews new custom topics if any. PE skipped unless instructions empty.
4. **Merge new fields only** — append to `mvp.now`/`mvp.later` where appropriate, don't overwrite existing MVP decisions.

### Full Path (processingPath == "full" or "full-agent")

Existing behavior — full architecture scoring + parallel dispatch as described below.

### Before Scoring: Consult Architecture + Instruction Learnings

Read `knowledge/learnings/architecture.md` and `knowledge/learnings/instructions.md` (if non-empty) before architecture scoring and instruction writing. Look for:
- Architecture patterns that matched similar agent profiles (single vs multi-agent precedents)
- Instruction patterns that improved quality (boundary language, tool reference patterns)
- Present relevant learnings to PE alongside the brief data

Also read `knowledge/learnings/topics-triggers.md` and `knowledge/learnings/eval-testing.md` (if non-empty) before topic classification and eval generation. Look for:
- Topic patterns that improved routing (trigger phrase strategies, "by agent" description patterns)
- Eval method insights (which test methods work best for which scenario types, threshold calibration)

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

Also consider **Connected Agent** — when the agent bridges to an external agent system (e.g., Azure AI Foundry agent). Rule out explicitly if not applicable.

Update `brief.json architecture`:
- `architecture.type` — `"single-agent"`, `"multi-agent"`, or `"connected-agent"` (kebab-case, matching dashboard UI card IDs)
- `architecture.reason` — 2-4 sentences explaining WHY this type was selected. Reference the score, the key factors that drove the decision, and why the other types were ruled out. Example: "Score 0/6 — Single Agent. All capabilities serve one domain with shared data and one owning team. Multi-Agent rejected: no quality gain. Connected Agent ruled out: no external system."
- `architecture.factors` — 6-factor object, each with `value` (true/false) and `reasoning` (1-2 sentences explaining why this factor scored the way it did, referencing the agent's specific capabilities and data)
- `architecture.score` — count of true factors (0-6)
- `architecture.children` — child agents if multi-agent

**Every factor MUST have reasoning.** A bare `true`/`false` without explanation is incomplete. The reasoning should reference the agent's specific capabilities, data sources, teams, and constraints — not generic statements.

#### Architecture Decision Generation

| Score | Action |
|-------|--------|
| **0-1** (clearly single) | Auto-apply `single-agent`. No decision entry. Still write `architecture.reason` explaining why. |
| **2-3** (borderline) | **Create architecture decision** with single-agent and multi-agent as options. Pre-apply the score-recommended type. |
| **4-6** (clearly multi) | Auto-apply `multi-agent`. No decision entry. Note in `architecture.reason` that single was considered. |

**Borderline decision format:**
```json
{
  "id": "d-{NNN}",
  "category": "architecture",
  "title": "Single agent or multi-agent architecture?",
  "context": "Score {N}/6 is borderline. Key factors: {factors that scored true}. Both approaches are viable.",
  "targetField": "architecture.type",
  "status": "pending",
  "recommendedOptionId": "opt-1",
  "options": [
    {
      "id": "opt-1",
      "label": "{score-recommended type}",
      "summary": "...",
      "pros": ["..."],
      "cons": ["..."],
      "confidence": "medium",
      "briefPatch": { "architecture": { "type": "{recommended}" } }
    },
    {
      "id": "opt-2",
      "label": "{alternative type}",
      "summary": "...",
      "pros": ["..."],
      "cons": ["..."],
      "confidence": "medium",
      "briefPatch": { "architecture": { "type": "{alternative}" } }
    }
  ]
}
```

### Step 1.5: Model Selection + Topic Classification (Lead — no teammates)

#### Model Selection

**Goal:** Select the AI model during research so the PE can write model-aware instructions and the customer can review the choice.

1. **Query available models:** Read `knowledge/cache/models.md` for the current model catalog. If stale (> 7 days), query live via `node tools/island-client.js get-models --env <envId>`.
2. **Evaluate model fit:** Consider the agent's requirements:
   - Reasoning-heavy (complex multi-step logic, code generation) → models with reasoning capabilities (o3-mini, etc.)
   - General-purpose (Q&A, summarization, routing) → latest GA model (default)
   - Cost-sensitive → smaller/cheaper models
   - Low-latency required → faster models
3. **Decision threshold:**
   - If the latest GA model is the obvious choice (general-purpose agent, no special requirements) → **auto-apply** to `agent.recommendedModel`, no decision entry.
   - If meaningfully different options exist (e.g., GPT-4.1 vs o3-mini for a reasoning-heavy agent, or cost matters) → **create model decision** with options.
4. **Write to brief.json:** Set `agent.recommendedModel` to the selected/recommended model name. PE uses this for model-aware instruction writing.

**Model decision format (when created):**
```json
{
  "id": "d-{NNN}",
  "category": "model",
  "title": "Which AI model for {agent name}?",
  "context": "{Why multiple models are viable — e.g., 'This agent requires complex reasoning. Two models excel here with different cost/speed tradeoffs.'}",
  "targetField": "agent.recommendedModel",
  "status": "pending",
  "recommendedOptionId": "opt-1",
  "options": [/* one per viable model with pros/cons/cost */]
}
```

#### Topic Classification (Lead — quick, before teammate dispatch)

Before dispatching teammates, the Lead classifies each capability's topic type. This enables TE to start immediately without waiting for QA.

**Classification rules** (any TRUE → custom topic):
- Requires multi-step data collection (sequential questions)
- Requires specific response format the model can't reliably produce (e.g., structured summaries, forms)
- Is a hard boundary/decline/refuse scenario (instructions alone are unreliable — need manual response topic)
- Requires tool calls in a specific sequence
- Requires channel-specific behavior (adaptive cards, quick replies)
- Maps to a capability that the brief marks as requiring "structured" or "workflow" behavior

**Borderline cases:** When criteria are mixed, create a `topic-implementation` decision:

```json
{
  "id": "d-{NNN}",
  "category": "topic-implementation",
  "title": "Generative or custom topic for {capability}?",
  "context": "{Why both approaches could work}",
  "targetField": "conversations.topics[name={topic}].topicType",
  "capability": "{capability name}",
  "status": "pending",
  "recommendedOptionId": "opt-1",
  "options": [
    {
      "id": "opt-1",
      "label": "Custom topic",
      "summary": "Dedicated YAML topic with explicit flow control",
      "pros": ["Deterministic behavior", "Explicit error handling", "Structured data collection"],
      "cons": ["Higher build effort", "Maintenance overhead", "Less flexible to prompt changes"],
      "effort": "Medium-High",
      "confidence": "high",
      "briefPatch": { "conversations": { "topics": [{ "name": "{topic}", "topicType": "custom" }] } }
    },
    {
      "id": "opt-2",
      "label": "Generative orchestration",
      "summary": "Handled by AI orchestrator with instructions + knowledge",
      "pros": ["Zero build effort", "Flexible", "Easy to iterate"],
      "cons": ["Less predictable", "May not reliably follow multi-step flows", "Harder to enforce exact formatting"],
      "effort": "Low",
      "confidence": "medium",
      "briefPatch": { "conversations": { "topics": [{ "name": "{topic}", "topicType": "generative" }] } }
    }
  ]
}
```

Write classifications to `conversations.topics[].topicType` before dispatching teammates.

### The Generic-Instructions / Explicit-Topics Balance

Since instructions are now generic (no hardcoded URLs, no tool listing, no naming knowledge sources per MS best practices), **routing must come from elsewhere**. The orchestrator's routing priority is: **description > name > parameters > instructions**. This means:

- **Every capability** in `brief.json.capabilities[]` should map to either a well-described knowledge source OR a custom topic with a strong description
- **Capabilities requiring specific behavior** (multi-step workflows, structured data collection, hard boundaries) → MUST be custom topics, not left to generative orchestration
- **Capabilities handled by knowledge Q&A** → generative orchestration is fine, but the knowledge source description must be specific enough for routing
- **Topic descriptions are the #1 routing signal** — every custom topic's `description` field must clearly state when to use it AND when NOT to use it

### Step 2: Parallel Teammate Dispatch

Spawn ALL teammates simultaneously. They do NOT depend on each other's output.

#### Prompt Engineer — write agent instructions

- Input: full brief.json (Phases A+B complete), `knowledge/cache/instructions-authoring.md`, model selection from Step 1.5
- Output: instruction text (up to 8,000 chars, self-verified per PE checklist)
- Runs independently — does NOT need QA or TE output

**PE must follow the universal instruction template and model-aware rules:**
- **7 universal style rules**: (1) Functional role in first line, no superlatives. (2) WHY on every constraint in parentheses. (3) Tiered length with floor + ceiling per question type. (4) Plain emphasis — bold or "Never X", no aggressive caps. (5) No personality padding. (6) 2-3 varied examples — happy path + boundary + complex. (7) Flat lists only.
- **Three-part structure**: Constraints (what to do/not do) → Response Format (how to present) → Guidance (how to find answers)
- **State the audience** in the Role section (e.g., "for CDW coworkers", "for IT support engineers")
- **NO hardcoded URLs** — describe knowledge capabilities generically; let knowledge citations provide links
- **NO listing all tools/knowledge** — orchestrator already knows them. Only `/ToolName` for disambiguation
- **NO professional tone instructions** — professional is the default. Only specify tone for deviations
- **NO aggressive caps** — never "CRITICAL:", "YOU MUST", "ALWAYS" in all-caps. Use bold or "Never X".
- **NO personality padding** — never "world-class expert", "exceptional specialist". Functional role only.
- **Include follow-up guidance** — "End every response with a relevant follow-up question or next step"
- **Include 2-3 examples** for complex behaviors (boundary enforcement, multi-step workflows)
- **Boundaries in instructions are guidance only** — hard stops require dedicated topics (which are in `conversations.topics`)
- **Topic descriptions drive routing** — instructions are lowest priority for routing. If a topic needs to be found, its description matters more than instructions mentioning it
- **Address ALL capabilities where `phase == "mvp"`** in the instructions — every MVP capability must have corresponding instruction coverage
- **Do NOT write dedicated sections for capabilities where `phase == "future"`** unless the capability's `implementationType` is `"prompt"` (in which case it should be re-tagged as MVP since it's zero-cost prompt guidance)
- **Model-specific scan**: If `recommendedModel` is set, PE runs the model-specific checks from the Model Family Tuning Guide (e.g., Claude → check for aggressive caps; GPT-5.2 → check for missing length floors)
- PE runs their own review checklist before returning (char count, anti-pattern check, reference validity, audience, follow-ups, **model awareness checks**)

#### QA Challenger — generate eval sets (3 default + custom)

- Input: full brief.json (capabilities, boundaries, integrations), eval-scenarios library, topic-triggers + eval-testing learnings
- Output: 3 eval sets (safety/functional/resilience) with 40-55 tests, coverage report
- Does NOT review instructions (Lead handles that inline in Step 3)
- Does NOT classify topics (Lead already did in Step 1.5)

**Eval set generation — scenario-driven:** QA reads `knowledge/frameworks/eval-scenarios/index.json` and uses the **Scenario-Driven Eval Generation** protocol (defined in qa-challenger.md) to generate tests from proven patterns instead of ad-hoc from brief fields.

| Set | What QA Generates | Source Material | Target Count |
|-----|-------------------|----------------|-------------|
| **safety** (100% pass) | Boundary decline/refuse + PII protection + prompt injection + scope boundary + adversarial + disclaimers + compliance language | `boundaries.*`, `agent.persona`, CAP-SB + CAP-CV scenarios | **8-12** |
| **functional** (85% pass) | Per-capability happy paths + grounding accuracy + routing + tool invoke + parameter extraction + error handling + disambiguation | `capabilities[]` (mvp), `knowledge.*`, `integrations[]` (mvp), BP-IR/BP-TS/BP-RS/BP-PN/BP-TR + CAP-KG + CAP-TI + CAP-TR scenarios | **15-25** |
| **resilience** (80% pass) | Edge cases + graceful failure + tone/empathy + cross-capability + end-to-end + regression | Cross-capability, CAP-TQ + CAP-GF + CAP-RT scenarios | **10-18** |

**Total target: 40-55 tests** across all sets. Safety set must have at least 1 test per boundary refuse/decline, plus PII, prompt injection, and any domain-specific compliance tests.

**Each test includes:**
- `question` — realistic user message (including typos, informal language)
- `expected` — what the response should contain or convey
- `capability` — links to `capabilities[].name` (optional for cross-cutting tests)
- `scenarioId` — library scenario ID (e.g., "BP-IR-01", "CAP-SB-03") when generated from a scenario pattern
- `scenarioCategory` — category name (e.g., "Safety & Boundary Enforcement")
- `coverageTag` — "core-business" | "variations" | "architecture" | "edge-cases"
- `readiness` — "ready" (runs as-is without customer data: safety, boundary, scope tests) | "template" (needs customer-specific values: knowledge answers, tool outputs, routing targets)
- `methods` — per-test method override when scenario recommends different methods than set defaults (null = use set methods)

**Methods are preset per set (defaults from schema), with per-test overrides where scenarios recommend different methods:**
- Safety: `Keyword match (all)` + `Exact match`
- Functional: `Compare meaning (70)` + `Keyword match (any)`
- Resilience: `General quality` + `Compare meaning (60)`

Research may adjust methods per set based on agent specifics (e.g., raise Compare meaning threshold for precision-critical agents). Individual tests may override methods when a scenario's recommended methods differ from the set default.

**After eval generation, QA reports coverage distribution** (core-business/variations/architecture/edge-cases percentages) and flags gaps against the scenario library's recommended categories.

#### Flow Designer — write flow specification (only if solutionType is "flow" or "hybrid")

- Input: brief.json (capabilities where `implementationType == "flow"`), integrations, architecture
- Output: `flow-spec.md` with triggers, actions, connectors, data flow, flow-manager.js commands
- Skip if `architecture.solutionType` is "agent" or not set

FD designs the Power Automate flow spec based on the enriched brief. The output file is written to `Build-Guides/{projectId}/agents/{agentId}/flow-spec.md` and is consumed by `/mcs-build` when constructing the flow/hybrid solution.

#### Topic Engineer — topic feasibility validation (only if custom topics exist)

- Input: brief.json topics (classified by Lead in Step 1.5), capabilities, integrations, `knowledge/cache/adaptive-cards.md` + `knowledge/cache/conversation-design.md`
- Output: per-topic feasibility assessment (OK / SPLIT / caveats)
- Skip if no custom topics (all generative)

TE reviews each proposed custom topic and produces a **per-topic feasibility assessment:**

| Check | What TE Validates |
|-------|------------------|
| **Complexity** | Can this be a single topic, or needs splitting? (Rule of thumb: >8 nodes or >3 branch levels → split) |
| **Node types** | Are the required node types available? (e.g., HttpRequest for API calls, InvokeConnectorAction for connectors) |
| **Card feasibility** | If topic needs adaptive cards — will they work on target channels? Size < 28KB? No Action.Execute? |
| **Variable flow** | Do inputs chain to outputs correctly? Any circular dependencies? |
| **Trigger viability** | Is the trigger type appropriate? "By agent" description specific enough for AI routing? |
| **Description quality** | Is the topic description specific enough for routing? Does it say when to use AND when NOT to use? (Descriptions are routing priority #1 — more important than instructions) |

### Step 3: Lead Reconciliation

After all teammates return (or as each finishes):

**3a. Apply PE instructions + inline review:**
- Write instructions to brief.json
- **Lead does inline instruction review** (no separate QA spawn):
  1. Three-part structure present? (Constraints + Response Format + Guidance)
  2. No hardcoded URLs?
  3. No tool/knowledge listing?
  4. References match `integrations[]`?
  5. Boundaries match `boundaries.*`?
  6. Audience stated in Role section?
  7. Follow-up guidance included?
  8. Length < 8,000 chars?
  9. **Capability-instruction alignment:** Every MVP capability addressed? No future capability dedicated sections (unless `implementationType == "prompt"`)?
- If issues found: fix inline (minor) or re-spawn PE with specific fixes (rare)

**3b. Apply QA eval sets:**
- Write evalSets[] to brief.json
- Write evalConfig — `{ targetPassRate: 70, maxIterationsPerCapability: 3, maxRegressionRounds: 2 }`
- Review coverage report — flag gaps

**3c. Apply TE recommendations:**
- **OK** topics → no change to brief
- **SPLIT** recommendations → update `conversations.topics[]` to reflect the split (add sub-topics, mark original as parent)
- **Caveats** → add to `conversations.topics[].notes` field

**3d. Generate per-set CSVs:**

Generate **per-set CSVs** in `Build-Guides/{projectId}/agents/{agentId}/` for MCS native eval compatibility:

```
evals-safety.csv
evals-functional.csv
evals-resilience.csv
```

**CSV format (MCS test set import):**
```csv
Question,Expected response,Testing method
```

**Generation rules:**
- One CSV per eval set (each uploads as a separate MCS test set)
- `Testing method` = first method from the test's resolved methods (display name: "Compare meaning", "Keyword match", etc.)
- Max 100 questions per CSV (MCS limit). If a set has > 100 tests, split into multiple CSVs.
- `Capability use` cannot be specified in CSV — add via MCS UI after import

**3e. Write to brief.json:**

Write all build-ready data:
- `instructions` — full system prompt text (up to 8000 chars)
- `evalSets[]` — all 3 sets with their tests, methods, thresholds
- `evalConfig` — target pass rates and iteration limits
- `conversations.topics[]` — topic classifications and feasibility notes
- `mvp.now` — what to build this sprint
- `mvp.later` — what's deferred and why
- `integrations[].status` — availability status per tool
- `integrations[].notes` — auth details, config notes
- `knowledge[].scope` — scoping/filtering details
- `knowledge[].status` — readiness status
- `notes` — any additional context discovered during research

### Step 3.5: GPT Parallel Review (MANDATORY)

After teammate reconciliation and before final output, fire GPT-5.4 reviews in parallel:

```bash
node tools/multi-model-review.js review-brief --brief <path-to-brief.json>
node tools/multi-model-review.js review-instructions --brief <path-to-brief.json>
```

**What GPT reviews:**
- `review-brief` — completeness, MVP phase alignment, blocking open questions, integration gaps
- `review-instructions` — anti-patterns, boundary coverage, capability-instruction alignment, ambiguity

**Merge protocol:**
- Union of findings — if either model flags something, investigate
- Stricter wins on conflicts
- Flag divergence when opinions differ significantly
- **Never block on GPT** — if GPT fails (exit code 3), proceed without it

**Truncation artifacts:** GPT receives a condensed brief payload. Dismiss findings about "missing" instructions, eval tests, or boundaries shown as `[object Object]` — these are serialization artifacts, not real gaps.

**Apply fixes** for actionable items (instruction ambiguity, phase misalignment, missing boundary paths) before writing final output. Note fixes in the terminal summary.

## Final Output

After all phases complete for each agent:

1. **brief.json** — All fields populated (business, agent, capabilities, integrations, knowledge, conversations, boundaries, architecture, evalSets, evalConfig, mvpSummary, openQuestions, instructions)
2. **evals.csv** — Evaluation test cases in MCS-compatible flat CSV format (generated from evalSets)

### Report to User

#### Terminal Output — Incremental Mode

When `processingPath == "incremental"`, use this format:

```
## Incremental Research Complete: {projectId}

**Mode:** Incremental ({N} new/changed docs processed)
**Agents updated:** {count}

| Agent | +Capabilities | +Integrations | +Tests | +Decisions | Flags |
|-------|--------------|---------------|--------|------------|-------|
| {name} | +{N} | +{M} | +{K} | +{D} | {F} |

{If _updateFlags exist: "Review flagged items in dashboard. Instructions delta in notes."}
{If new decisions: "New decisions added — review in brief before building."}

**Next:** Review changes in dashboard. If instructions need updating, edit in dashboard or re-run with agentId.
```

#### Terminal Output — Full Mode

```
## Research Complete: {projectId}

**Agents:** {count} | **Open Questions:** {count} | **Decisions:** {count pending}

| Agent | Architecture | Tools | Evals | Decisions |
|-------|-------------|-------|-------|-----------|
| {name} | {Single/Multi} | {N} | {N} | {N pending} |

{If decisions exist:}
## Decisions Requiring Review: {count}
| # | Category | Decision | Recommended | Options |
|---|----------|----------|-------------|---------|
| d-001 | integration | How to extract web content? | Azure Function + Readability | 3 options |
| d-002 | model | Which AI model? | GPT-4.1 | 2 options |

Recommended defaults pre-applied to brief. Review and confirm before building.

Files: brief.json + evals.csv per agent

**Next:** Review brief in the dashboard. Resolve open questions and decisions. Then /mcs-build.
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

Present to user. If confirmed (Tier 2), write to `knowledge/learnings/{category}.md` and update `knowledge/learnings/index.json`.

If the research was routine and nothing surprising was found, skip the Tier 2 summary — but still run the Tier 1 auto-check:

**Tier 1 auto-capture (no user confirmation):**
- For each approach that matched a prior learning (same cache category resolved the same way), bump `confirmed` count and `lastConfirmed` date in `index.json`
- For cache corrections found during research, write the correction to the appropriate learnings file and add to `index.json`

**Tier 2 user-confirmed capture:**
- New discoveries not covered by existing entries
- Contradictions with existing learnings (flag both)
- Non-obvious architecture insights

**Comparison engine:** Before writing any new entry, run the 4-step comparison (see CLAUDE.md "Learnings Protocol" § B) to avoid duplicates and catch contradictions.

### Update Document Manifest

After all phases complete, update `doc-manifest.json` with the final `lastResearchAt` timestamp:

```python
manifest["lastResearchAt"] = datetime.now().isoformat()
```

This timestamp lets incremental research know when the last full research was performed.

---

## Important Rules

- **brief.json is THE source of truth** — the dashboard reads it, the build skill reads it, reports are generated from it
- **There is no separate agent-spec.md** — everything lives in brief.json including instructions and MVP scope
- **evals.csv is for MCS native eval compatibility** — flat export from brief.json evalSets. The Eval skill reads evalSets directly.
- **Only 2 permanent output files per agent**: `brief.json` and `evals.csv`. Nothing else.
- **No working-paper files**: Do NOT leave intermediate artifacts like instruction drafts, QA reviews, connector research notes, or scenario docs as separate files. All research findings go INTO brief.json fields (instructions, integrations[].notes, notes{}, etc.). If teammates generate working documents during collaboration, consolidate their content into brief.json and delete the working files before completing.
- **Targeted research, not exhaustive** — only spawn RA for systems that need live lookup. Stable categories (models, channels, triggers, knowledge) use cache.
- **Single-pass QA** — no PE↔QA iteration loop. PE self-checks, QA reviews once, lead applies fixes.
- **Topic Engineer validates feasibility in Phase C** (parallel with PE and QA) but does NOT generate YAML. Full YAML authoring is reserved for `/mcs-build`. TE checks structural feasibility (complexity, node types, card limits, variable flow, triggers) and recommends splits where needed.
- **Never assume components** — always research, always present options
- **Update cache** — after live research, update relevant `knowledge/cache/` files
- **Iteration comes from the user** — present open questions, let the customer/user resolve them, then re-run with `{agentId}` to re-enrich
- **Don't stop between phases** — this is a single-pass skill. Run A→B→C continuously.
- **Phase 0 runs for ALL invocations** — project and agent level. No bypass, no skip.
- **Document-to-agent mapping is auto-detected.** Ask user only when ambiguous.
- **Brief edits trigger re-enrichment.** If brief was modified since last research (answered questions), re-enrich even without new docs.
- **`full-agent` for manually created agents.** Empty brief + agent scope = full research scoped to that agent.
- **Incremental by default** — when a manifest exists and docs changed but no drastic thresholds are triggered, prefer the incremental path. Don't re-process unchanged documents.
- **brief.json IS the context** — the existing brief contains all prior research. During incremental processing, read the brief for context instead of re-reading unchanged docs.
- **Merge rules are sacred** — during incremental processing, follow incremental merge rules exactly. Never overwrite `instructions` or answered `openQuestions`. Append-only for arrays and evalSets tests. Flag conflicts in `_updateFlags`.
- **Manifest consistency** — after ANY path (full, full-agent, incremental, or re-enrich), the manifest must reflect the current `docs/` state with accurate hashes and timestamps.
- **Decisions are structured choices, not open questions** — `decisions[]` stores ranked options when 2+ approaches are viable. `openQuestions[]` stores freeform unknowns. Don't put a decision in openQuestions or vice versa.
- **Only create decisions when genuinely needed** — one clear winner = auto-apply, no decision entry. Creating too many decisions overwhelms the customer and slows the workflow.
- **Pre-apply the recommended option** — the brief must always be buildable, even if the user never reviews decisions. The recommended option's `briefPatch` is written to brief fields as the default.
- **Decision generation rules summary:**

| Trigger | Action |
|---------|--------|
| Step 2.5 pattern match with 2+ viable tiers | Create decision, one option per tier |
| Step 2.5 pattern match with 1 viable tier | Auto-apply, no decision |
| RA finds 2+ viable tools for a system | Create decision with ranked options |
| RA finds 1 clear winner | Auto-apply, no decision |
| Architecture score 2-3 (borderline) | Create architecture decision |
| Architecture score 0-1 or 4-6 (clear) | Auto-apply, no decision |
| Model choice has meaningful tradeoffs | Create model decision |
| Topic type is borderline (generative vs custom) | Create topic decision |
| Only one valid option exists | Auto-apply, no decision |

## Teammate Usage Summary

| Phase | Full | Full-Agent | Incremental | Re-enrich |
|-------|------|-----------|-------------|-----------|
| 0 | Lead | Lead | Lead | Lead |
| A | Lead (all docs, all agents) | Lead (all docs, one agent) | Lead (new docs only) | Skipped |
| B | Lead + **RA** (if external systems) | Lead + **RA** (if external) | Lead + **RA** (new external only) | Lead only |
| C | Lead + **PE** + **QA** + **TE** + **FD** (if flow/hybrid) (PARALLEL) | Lead + **PE** + **QA** + **TE** + **FD** (if flow/hybrid) (PARALLEL) | Lead + **QA** (PE skipped unless instructions empty) + **TE** (if new topics) | Lead + **QA** + **TE** (if topics affected) |

**PARALLEL dispatch in Phase C:** PE, QA, TE (and FD if flow/hybrid) run simultaneously — not sequentially.
**Maximum teammates per run:** 5 (RA + PE + QA + TE + FD). RA runs in Phase B; PE + QA + TE + FD run in parallel in Phase C. FD only for flow/hybrid solutionType.
**Microsoft-native agents:** Often just 3 (PE + QA + TE) — RA skipped when no external systems, FD skipped when solutionType is "agent".
**Incremental runs:** Often just 1-2 (QA alone, or QA + TE for new topics).
