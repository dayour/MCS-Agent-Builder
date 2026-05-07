---
paths:
  - ".claude/skills/mcs-research/**"
  - ".claude/skills/mcs-build/**"
  - ".claude/skills/mcs-eval/**"
  - ".claude/skills/mcs-fix/**"
  - ".claude/agents/**"
---

# Agent Teams (Experimental)

Agent Teams enables bidirectional communication between specialist teammates who challenge each other's work. The lead orchestrates, teammates do the reasoning and generation, and the lead handles MCS execution (LSP Wrapper, Island Gateway API, PAC CLI, Dataverse).

All teammates (except Repo Auditor) have context7 MCP for non-Microsoft library docs and full Microsoft Learn MCP (search + code samples + fetch). Repo Auditor stays lean — local file analysis only. No agent has Skill tool access — the lead invokes plugins on their behalf when needed.

Enabled via: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `.claude/settings.json`

## Teammates

| Teammate | Role | Key Strength | GPT Usage |
|----------|------|-------------|-----------|
| Research Analyst | Discover MCS capabilities across multiple sources | Prevents false limitation claims | `review-components` after research |
| Prompt Engineer | Write MCS agent instructions + review/sharpen skill files | Sharp instructions, correct `/` references | `generate-instructions` co-gen + merge |
| Topic Engineer | Generate validated YAML topics + adaptive cards | Syntax-correct YAML, channel-safe cards | `generate-topics` co-gen for 3+ node topics |
| QA Challenger | Review all outputs, find gaps, challenge claims | Catches errors before they hit MCS | `generate-evals` co-gen + all `review-*` commands |
| Repo Auditor | Validate repo integrity + find dead code, duplication, bloat | Catches broken refs, drift, and waste | `review-code` on changed files + semantic consistency |
| Flow Designer | Design Power Automate flow specs (triggers, actions, error handling) | Microsoft-native automation patterns, sync-callable design | `generate-flow` co-gen + `review-flow` |

Every teammate has GPT-5.5 access via `tools/multi-model-review.js`. Teammates follow the same merge protocol: union of findings, stricter wins, and GPT is never blocking because if it is unavailable Claude proceeds alone.

Definitions live in `.claude/agents/`. Flow Designer was archived for ~7 months (0 spawns across 186 sessions) and restored 2026-04-28; it is auto-spawned by `/mcs-research` Phase B and `/mcs-build` Step 1 whenever an agent's `solutionType` matches `flow`, `hybrid`, or `automation`.

## When to Use Agent Teams

**During MCS workflow skills:**
- **Research phase** (`/mcs-research`):
  - **Phase A (speculative)**: Research Analyst spawns in background (`run_in_background: true`) during doc reading to scan for Priority 5-6 system mentions. Findings land at `Build-Guides/<project>/agents/<name>/research-analyst.findings.json` for Phase B to consume.
  - **Phase B**: Research Analyst confirms Priority 5-6 components if not pre-resolved. Flow Designer auto-spawns when `solutionType ∈ {flow, hybrid, automation}`.
  - **Phase C (parallel dispatch with worktree isolation)**: PE + QA + TE run in parallel — PE writes instructions, QA generates eval sets, TE validates topic feasibility. Each gets `isolation: "worktree"` so concurrent file writes don't collide. Lead does inline instruction review and merges outputs sequentially.
- **Build phase** (`/mcs-build`):
  - **Step 1 (agent shell)**: Lead-only. After shell exists, Flow Designer spawns if `solutionType ∈ {flow, hybrid, automation}`.
  - **Steps 2-4 (parallel dispatch)**: PE (instructions), lead (knowledge), lead (tools/MCP), TE (topics) all run simultaneously after Step 1. Use `isolation: "worktree"` for PE and TE. Step 5 (publish) is gated on all four completing.
  - **Step 5.5 (post-publish reconciliation)**: QA Challenger validates spec-vs-actual.
- **Eval phase** (`/mcs-eval`): Runs eval sets (all or specific), writes per-test results to evalSets. QA Challenger analyzes failures when sets miss thresholds. Optional `--background` for slow suites.
- **Fix phase** (`/mcs-fix`): QA Challenger classifies failures, Prompt Engineer fixes instructions, Topic Engineer fixes topics.

**GPT-5.5 co-generation + review (all phases):**
GPT runs in parallel with every Claude generation and review at zero added latency. Teammates fire `multi-model-review.js` internally. Protocol: union of findings/content, stricter wins on conflicts. GPT is never blocking.

| Phase | GPT Action (parallel with Claude) |
|-------|----------------------------------|
| Research Phase C | PE: `generate-instructions` (co-gen), QA: `generate-evals` (co-gen), TE: `generate-topics` for feasibility |
| Research Step 3.5 | `review-brief` + `review-instructions` + `review-components` + `review-flow` (if hybrid) |
| Build Step 4 | TE: `generate-topics` for complex topics (3+ nodes, co-gen) |
| Build Step 5.6 | `review-brief` + `review-instructions` + per-topic `review-topics` |
| Eval | Dual scoring on 4 semantic methods (CompareMeaning, GeneralQuality, TextSimilarity, ToolUse) |
| Fix | PE: `generate-instructions` (co-gen for fix proposals), TE: `generate-topics` (co-gen for topic fixes) |

**During general development (Tier 2-3 checks):**
- Tier 2: Repo Auditor in background after 3+ file changes or code changes
- Tier 3: QA Challenger before irreversible decisions (schema, workflow, architecture)

## Auto-Spawn via Hooks

The `team-routing.js` hook (PreToolUse + PostToolUse on Write/Edit/MultiEdit) actually spawns selected agents in the background instead of just printing reminders.

| Trigger | Action | Disable with |
|---------|--------|--------------|
| `Write` to any `agentspec.json` | Spawns `qa-challenger` in detached `claude -p` session. Review lands at `<spec-dir>/.qa-review.json`. One spawn per (session, spec). Skipped if a fresh review already exists. | `CLAUDE_OFF_AUTO_QA=1` |
| Edit under `.claude/{rules,skills,agents}` or `CLAUDE.md` | Reminder only — recommends `prompt-engineer` (Domain 2). Lead's discretion. | — |
| 3+ unique files edited in a session | Reminder only — recommends `repo-auditor` in background. Lead's discretion. | — |

The lead session and the auto-spawned QA session are independent. The lead reads `.qa-review.json` on the next read of the spec or via a Stop hook surfacing.

The QA spawn skips itself if `.qa-review.json` mtime is within 60 seconds of the spec mtime, on the assumption the lead just ran the review explicitly.

## Sub-Agent Worktree Isolation

Whenever the lead dispatches multiple sub-agents that all mutate shared files (Phase C of `/mcs-research`, Steps 2-4 of `/mcs-build`), pass `isolation: "worktree"` on the Agent tool call. Each sub-agent works in its own ephemeral worktree, the lead reads outputs sequentially, and merges to the main checkout.

```
Agent({
  description: "Generate topic YAML",
  subagent_type: "topic-engineer",
  prompt: "...",
  isolation: "worktree",     // <-- ephemeral worktree, auto-cleaned if no changes
})
```

Why: without isolation, two teammates (PE and TE) both write to `Build-Guides/<project>/agents/<name>/agentspec.json` at roughly the same time. The last write wins; the other's changes are lost.

**Merge protocol** when teammates ran in worktrees:

1. Lead reads each teammate's worktree path from the Agent tool result.
2. Lead reads each teammate's output file from its worktree.
3. Lead applies merge rules from `.claude/rules/gpt-co-generation.md` (Instructions: PE merges; Topics: TE merges; Evals: QA merges).
4. Lead writes the merged result to the main checkout's file.
5. Worktree cleanup: agents that made no changes are auto-cleaned. Agents that made changes leave the worktree behind for the lead to inspect or remove with `git worktree remove`.

**Rollout**: piloted in `/mcs-research` Phase C. Expand to `/mcs-build` once stable across 5+ sessions.

## Parallelization Guidance

For multi-agent work, dispatch all teammates in **a single message** with multiple Agent tool calls — that's how Claude Code runs them concurrently. Sequential Agent calls run sequentially.

```
# Parallel — all three start at once:
Agent(subagent_type: "prompt-engineer", isolation: "worktree", ...)
Agent(subagent_type: "topic-engineer", isolation: "worktree", ...)
Agent(subagent_type: "qa-challenger", isolation: "worktree", ...)

# Serial — TE only starts after PE returns:
Agent(subagent_type: "prompt-engineer", ...)
# ...wait for return...
Agent(subagent_type: "topic-engineer", ...)
```

Use `run_in_background: true` for fire-and-forget tasks where the lead continues working immediately:
- Research Analyst speculative scan during Phase A doc reading
- Repo Auditor after 3+ file changes
- Long-running eval batches

## Workflow: Lead + Teammates

```
Lead spawns team for build:
  Research Analyst -> discovers components (parallel)
  Prompt Engineer -> writes instructions
  Topic Engineer -> generates topic YAML + adaptive cards
  QA Challenger -> reviews all outputs, challenges, finds gaps

  Teammates communicate directly:
    QA -> Prompt Engineer: "Instructions reference /ToolName that isn't configured"
    QA -> Topic Engineer: "YAML node ID duplicated on line 14"
    Topic Engineer -> Prompt Engineer: "Your instructions expect Topic.orderStatus but no topic initializes it"

Lead executes validated outputs:
  - Pushes topic YAML via LSP Wrapper (mcs-lsp.js push)
  - Sets instructions via LSP push (agent.mcs.yml) or Dataverse API
  - Configures tools via add-tool.js + LSP push (user creates OAuth connections manually if needed)
  - Publishes (Dataverse PvaPublish, PAC CLI fallback)
```

## Rules

- The lead delegates instruction, YAML, and card generation to teammates because specialist teammates produce higher-quality domain-specific content.
- The lead handles all MCS execution (LSP Wrapper, Island Gateway API, PAC CLI, Dataverse API) because MCP access in teammates is unreliable.
- QA Challenger reviews every teammate output before the lead executes it because catching errors before MCS push avoids costly rollbacks.
- Teammates challenge each other through bidirectional communication because that is the core value of the team structure.
- All generated artifacts go to files (Build-Guides/[Project]/topics/, instructions, etc.) so the lead can read and execute them deterministically.

## Proactive Quality Checks: 3 Tiers

Quality checks scale with risk. Not every response needs a full team debate.

**Tier 1: Self-Check (after any edits)**
After any batch of edits, do a quick inline verification: grep for broken references, re-read changed files, verify cross-references. Takes 10-20 seconds and catches obvious issues. No teammate needed.

**Tier 2: Background Repo Check (after significant changes)**
After changing 3+ files or any code changes, spawn Repo Auditor in background. It runs async so work continues unblocked. Results come back in approximately 60 seconds. Fix issues if found.

**Tier 3: QA Challenge (before irreversible decisions only)**
Before committing to designs that are hard to undo (schema changes, workflow redesign, architecture decisions affecting multiple files), QA Challenger reviews and challenges the approach. This blocks work but is worth the wait for high-impact decisions.

| Trigger | Tier | Blocks Work? |
|---------|------|-------------|
| Any file edits | Tier 1: self-check (grep + re-read) | No -- inline, 10 sec |
| 3+ file changes or code changes | Tier 2: Repo Auditor in background | No -- runs async |
| Schema change, workflow redesign, architecture decision | Tier 3: QA Challenger | Yes -- worth the 2-3 min |
| Before any commit | Tier 2: Repo Auditor | No -- runs async |
| Before commits / weekly | Tier 2: Repo Auditor in background | No -- runs async |
| Simple answer, status check, brainstorming | None | -- |
