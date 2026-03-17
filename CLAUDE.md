# MCS Automation — Core Rules

Automate Microsoft Copilot Studio (MCS) agent creation using a hybrid build stack: PAC CLI for listing agents, MCS LSP Wrapper for component sync, Island Gateway API for model catalog and eval upload, Dataverse API for agent creation and publishing, Direct Line API for testing, and user-guided manual steps for new OAuth connections.

Research Microsoft-first (MCS built-in > Power Platform > Azure > M365 connectors) because enterprise agents run best on the native stack. The **brief.json** is the single source of truth — everything flows from it.

---

## Workflow

```
INIT → CONTEXT → RESEARCH → [SOLUTION TYPE GATE] → BUILD → EVALUATE → [FIX] → [DEPLOY] → [REPORT] → [RETRO]
```

| Skill | Purpose | Dashboard |
|-------|---------|-----------|
| `/mcs-init` | Create project folder structure | — |
| `/mcs-context` | Pull M365 history via WorkIQ | — |
| `/mcs-research` | Read docs, identify agents, research components, enrich brief.json + generate evals | Research |
| `/mcs-build` | Build agent(s) in MCS via hybrid stack | Build |
| `/mcs-eval` | Run eval tests, write results to brief.json | Evaluate |
| `/mcs-fix` | Analyze eval failures, apply fixes, re-evaluate | Fix Failures |
| `/mcs-refresh` | Refresh knowledge cache files | — |
| `/mcs-retro` | Post-session retrospective: capture learnings | — |
| `/mcs-deploy` | Deploy agents from dev to prod | — |
| `/mcs-report` | Generate reports (brief/build/customer/deployment) | — |
| `/mcs-library` | Team SharePoint solution library | — |
| `/bug` | File bug reports via GitHub CLI | Sidebar |
| `/suggest` | File feature suggestions via GitHub CLI | Sidebar |

Each skill has detailed instructions in its own `.claude/skills/*/SKILL.md`.

---

## Dual Model Co-Generation — Every Non-Trivial Task

Fire GPT-5.4 in parallel with your own work on every task that is not a single-line fix, git operation, or file read. Quality is the priority — cost and tokens do not matter. GPT serves as both a **co-generator** (produces content independently for merging) and a **reviewer** (validates your output). This applies to all work: MCS builds, code, reviews, cleanup, app changes, architecture, docs, debugging, planning, answering questions.

| Task Type | GPT Action | Command |
|-----------|-----------|---------|
| MCS instructions | Co-generate, PE merges | `generate-instructions --brief <path>` |
| Eval tests | Co-generate, QA merges | `generate-evals --brief <path>` |
| Topic YAML (3+ nodes) | Co-generate, TE merges | `generate-topics --topic-spec <path> --brief <path>` |
| Writing code (3+ lines) | GPT reviews as you write each file | `review-code --file <path>` |
| Component selection | GPT reviews RA's choices | `review-components --brief <path>` |
| Flow spec design | GPT reviews FD's output | `review-flow --file <path> --brief <path>` |
| Architecture/design decisions | GPT gives a second opinion | Send context, get alternative perspective |
| All other non-trivial tasks | GPT reviews after completion | Appropriate `review-*` command |

**Skip only:** single-line fixes, typos, git ops, file reads, status checks, GPT unavailable (exit code 3).

**For code changes:** fire `review-code --file <path>` on each file as you write it — not batched at the end. For multi-file changes, review the first 2-3 files, fix issues, then continue.

**Final quality gate:** after merging all agent team outputs, fire `review-merged --brief <path>` for cross-artifact validation before publish. Catches orphaned capabilities, instruction-topic duplication, eval gaps, and build feasibility blockers.

**Merge protocol:** union of findings from both models, stricter assessment wins on conflicts, flag divergence for the user. Full merge rules for co-generation (instructions/topics/evals) in `.claude/rules/gpt-co-generation.md`.

**How it works:** GPT-5.4 via GitHub Copilot Responses API (`tools/lib/openai.js`). Auth: `gh auth token` with `copilot` scope. CLI: `tools/multi-model-review.js` (14 commands). If GPT fails, proceed with Claude alone — never block on GPT.

---

## Core Philosophy

1. **Brief-driven build** — brief.json drives every build because a single source of truth prevents drift between design and execution. Fill gaps before building.

2. **Eval-verified quality** — three eval sets (boundaries 100%, quality 85%, edge-cases 80%) aligned with the MS Eval Scenario Library because testing during build catches issues early.

3. **Multi-agent when justified** — score objectively using 6 factors (3+ = multi-agent) because premature decomposition adds complexity without quality gain.

4. **Microsoft-first research** — resolve Priority 1-4 components from cache because they are well-documented and enterprise-supported. Only escalate to live research for Priority 5-6 external systems.

5. **Assess before building** — run the solution type scoring after identifying agents because a Power Automate flow that works is better than an agent that is just a thin API wrapper.

6. **All-API build stack** — zero browser automation because deterministic API calls are reproducible and verifiable. User-guided manual steps only for new OAuth connections.

---

## Error Handling

When something fails, stop and research broadly before retrying:

1. Search for the error message + "Copilot Studio" via WebSearch
2. Check MS Learn MCP for official troubleshooting
3. Read back API state to verify what actually happened
4. Log significant findings to `knowledge/learnings/`
5. Retry with the researched approach — never the same failed approach twice
6. After 2 failed approaches, escalate to the user

---

## Project Structure

```
.claude/
├── settings.json, skills/ (13 skills), agents/ (7 teammates), rules/ (path-scoped)

app/
├── server.js, terminal-server.js, lib/, frontend/ (React + Vite + shadcn/ui)

knowledge/
├── cache/ (21 cheat sheets), patterns/ (YAML, Dataverse, topic, flow templates)
├── frameworks/ (component selection, architecture scoring, eval scenarios)
├── learnings/ (8 topic files + index.json), solutions/ (library index + cache)

tools/
├── mcs-lsp.js, island-client.js, add-tool.js, flow-manager.js
├── direct-line-test.js, eval-scoring.js, multi-model-review.js
├── solution-library.js, replicate-agent.js, dataverse-helper.ps1
├── om-cli/ (YAML validation, 357 types), lib/ (http, openai, graph, flow-composer, connector-schema)
├── gen-constraints.py, drift-detect.py, semantic-gates.py

templates/
├── brief.json (schema), default-recommendations.json

Build-Guides/[Project]/ (per-project work, gitignored)
├── agents/[name]/ (brief.json, build-report.md, topics/, evals)
├── docs/ (uploaded customer documents)
```

---

## Key Principles

1. **Brief is the blueprint** — brief.json drives the build
2. **Evals drive quality** — boundaries gate then quality then edge-cases before publish
3. **MVP first** — build what is possible now, plan what is blocked
4. **Build specialists first** — children before orchestrator in multi-agent
5. **Verify environment** — confirm account + environment target before operations
6. **Research errors** — stop, research broadly, then retry with a new approach
7. **Capture learnings** — every build makes the next build smarter
8. **MCP over connectors** — prefer MCP servers over individual connector actions because they provide broader capability
9. **API verification** — every change verified via LSP pull, Dataverse query, or PAC CLI status
10. **Present options** — when 2+ viable approaches exist, create structured `decisions[]` entries with pros/cons. Recommend the best, let the user choose.
11. **Verify then mark** — never mark a build step complete until the result is confirmed via API read-back
12. **Atomic tasks** — every build step is a separate task because combining steps across systems makes failures harder to diagnose

---

## Reference Pointers

| What | Where |
|------|-------|
| Component selection framework | `knowledge/frameworks/component-selection.md` |
| Architecture scoring (single vs multi) | `knowledge/frameworks/architecture-scoring.md` |
| Solution type scoring | `knowledge/frameworks/solution-type-scoring.md` |
| Tool priority + auth gate | `.claude/rules/tool-priority.md` |
| MCS inventories (models, triggers, MCPs, connectors) | `knowledge/cache/*.md` |
| YAML patterns + topic templates | `knowledge/patterns/` |
| Eval scenario library | `knowledge/frameworks/eval-scenarios/` |
| Dataverse API patterns | `knowledge/patterns/dataverse-patterns.md` |
| Solution patterns (naive-to-proven) | `knowledge/patterns/solution-patterns.md` |

Cache freshness: < 7 days = use as-is. 7-30 days = Tier 1 auto-refresh, Tier 2-3 flag. > 30 days = refresh immediately. After live research, update the cache file with findings and a new `last_verified` date.

---

## Rules Summary

These five rules apply everywhere and are restated here to counteract position bias:

1. **brief.json is the single source of truth** — the dashboard reads it, skills read it, reports generate from it
2. **Fire GPT-5.4 on every non-trivial task** — dual-model review catches bugs during implementation (see `.claude/rules/gpt-co-generation.md`)
3. **Verify every build step via API read-back** before marking complete (see `.claude/rules/build-discipline.md`)
4. **Research Microsoft-first** — use cache for M365-native, live research only for external systems
5. **Attempt every MVP item** — a failed attempt with a clear error is more valuable than a silently skipped item
