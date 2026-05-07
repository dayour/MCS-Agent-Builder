# MCS Automation — Core Rules

> **RULE ZERO — Fire GPT-5.5 selectively, on the 5 value patterns. Not on every interaction.**
>
> As of 2026-04-27, the universal Stop-hook enforcement was removed after data showed ~50% of GPT calls were low-value `ask` calls on routine turns where Claude has full repo context that GPT lacks. GPT itself rated universal firing as poor value-vs-latency. The framework is now opt-in:
> - **UserPromptSubmit hook** still injects a soft reminder describing when to fire (advisory, not required)
> - **Stop hook** is **unwired** (script preserved for easy revert)
> - **`multi-model-review.js`** is unchanged — call it when one of the 5 patterns applies
>
> **When to fire** (high value): `challenge` before architecture/design decisions or risky/destructive actions; `diagnose` for hard or ambiguous bugs; `review-code` for non-trivial diffs (concurrency, persistence, migrations, security, public APIs); `generate-*` for MCS content where independent oracle generation matters; `review-merged` as the final pre-publish quality gate.
>
> **When to skip** (low value): routine Q&A, formatting, simple edits, conversational turns, repo-specific questions where Claude has context GPT can't get from a tightly-framed prompt.
>
> Full protocol + revert path: `.claude/rules/gpt-co-generation.md`

Automate Microsoft Copilot Studio (MCS) agent creation using a hybrid build stack: PAC CLI for listing agents, MCS LSP Wrapper for component sync, Island Gateway API for model catalog and eval upload, Dataverse API for agent creation and publishing, Direct Line API for testing, and user-guided manual steps for new OAuth connections.

Research Microsoft-first (MCS built-in > Power Platform > Azure > M365 connectors) because enterprise agents run best on the native stack. The **agentspec.json** is the single source of truth — everything flows from it.

---

## Workflow

```
INIT → CONTEXT → RESEARCH → [SOLUTION TYPE GATE] → BUILD (includes guard) → EVALUATE → [FIX] → [REPORT]
```

| Skill | Purpose | Dashboard |
|-------|---------|-----------|
| `/mcs-init` | Create project folder structure | — |
| `/mcs-context` | Pull M365 history via WorkIQ | — |
| `/mcs-research` | Read docs, identify agents, research components, enrich agentspec.json + generate evals | Research |
| `/mcs-build` | Pre-build validation (guard) + build agent(s) in MCS via hybrid stack | Build |
| `/mcs-eval` | Run eval tests, write results to agentspec.json | Evaluate |
| `/mcs-fix` | Analyze eval failures, apply fixes, re-evaluate | Fix Failures |
| `/mcs-pipeline-test` | Run the build-pipeline verify-fix harness against the canonical kitchen-sink agent (framework engineering only — not for customer builds) | — |
| `/mcs-sync` | Detect upstream drift across 8 sources, surface TAKE/REJECT triage | — |
| `/mcs-report` | Generate combined HTML export (spec + evals + how-to guide) | — |
| `/iterate` | Layer A autonomous orchestrator: classify → lane verifiers → fix loop → facilitator review (qa-challenger via Agent + worktree, score≥9) → multi-model-review review-merged → denylist-gated auto-merge. See `.claude/rules/iterate-framework.md` for the autonomy contract. | — |
| `/mcs-iterate` | Layer B autonomous: `/mcs-build` → `/mcs-eval` → `/mcs-fix` → re-eval until SHIP, max 3 fix cycles. Reuses iterate-orchestrator audit + verdict primitives. | — |
| `/feedback` | File bug reports or feature suggestions via GitHub CLI | Sidebar |

Each skill has detailed instructions in its own `.claude/skills/*/SKILL.md`.

### Commit routing — `/commit-push-pr` vs `/iterate`

When changes are ready to ship, route by what changed:

- **Doc-only** (`*.md`, `docs/**`, `knowledge/**`) → `/commit-push-pr` directly
- **Code** (anywhere under `app/`, `tools/`, `bin/`, `.claude/hooks/`, `.github/`, `package.json`, configs, schemas, tests) → `/iterate` first; `/iterate` opens the PR
- **Mixed (doc + code)** → `/iterate` (code portion gates)
- **Hotfix flagged urgent** → `/commit-push-pr` allowed; document urgency in PR description

Quick check: `git diff --name-only HEAD`. If every line matches `\.md$|^docs/|^knowledge/`, doc-only path. Otherwise `/iterate`.

`/iterate` adds lane verifiers + facilitator review + GPT review-merged + audit entry before push. This is **advisory** — no CI gate enforces it. See `.claude/rules/commit-routing.md` for edge cases (mixed changes, reverts, generated files).

---

## Installed Plugins (Auto-Routing Rules)

13 plugins installed (10 from `claude-plugins-official` + 1 from `microsoft/eval-guide` + `superpowers` + `claude-mem`). MCS skills remain primary — plugins handle tooling, code quality, developer experience, debugging, and cross-session memory.

**Auto-firing (no manual invocation needed):**

| Plugin | Triggers When | What It Does |
|--------|---------------|-------------|
| `context7` | Claude needs non-Microsoft library docs (React, Vite, Zustand, etc.) | MCP server provides up-to-date library documentation. Complements `microsoft-learn` MCP. |
| `typescript-lsp` | Any `.ts`/`.tsx`/`.js`/`.jsx` file is edited | Background LSP for type checking, go-to-definition, error detection. |
| `frontend-design` | Frontend/UI work requested ("build a component", "redesign the dashboard") | Distinctive, production-grade UI generation with bold aesthetics. |
| `skill-creator` | User asks to create, improve, or eval a skill | Skill authoring framework with built-in eval benchmarking. |
| `claude-md-management` | User mentions CLAUDE.md quality, audit, or maintenance | Audits CLAUDE.md against codebase state, scores quality. |
| `eval-guide` | `/mcs-research` Phase C (eval generation) or `/mcs-eval` (result interpretation) or `/mcs-fix` (triage) | Plans eval scenarios, generates test cases, interprets results (SHIP/ITERATE/BLOCK), triages failures. Source: `microsoft/eval-guide` marketplace. |
| `figma` | User mentions Figma, shares a figma.com URL, or asks for design-to-code translation | Figma MCP server + skills (figma-use, figma-implement-design, figma-code-connect, figma-generate-design, figma-generate-library, figma-create-design-system-rules). |
| `security-guidance` | User requests `/security-review` or flags security concerns on pending changes | Security review of pending branch changes, OWASP-style checks, dependency/secret scanning. |
| `superpowers` | Layer A engineering: hard bugs (4-phase debug), TDD red-green-refactor on framework code, brainstorming new features. Triggered by description match on debugging/testing/planning prompts. | TDD enforcement, 4-phase systematic debugging (Hypothesize → Reproduce → Isolate → Fix), Socratic brainstorming. Layer A only — does NOT fire inside `/mcs-*` skills. |
| `claude-mem` | All sessions — captures tool calls and prompts, surfaces relevant past context on session start. Cross-session recall via vector search. | Persistent transcript memory. Pair with `MEMORY.md` (curated insights). claude-mem = "what happened", `MEMORY.md` = "what we learned". Hooks self-register; ordering verified so `mcs-build-verify`, `frontend-test-trigger`, `team-routing` run BEFORE claude-mem PostToolUse capture. |

**Routed by Claude (invoke automatically at these moments):**

| Plugin | When to Auto-Invoke | Slash Command |
|--------|-------------------|---------------|
| `code-review` | After creating a PR via `/commit-push-pr` or `gh pr create` — run automatically on the PR | `/code-review` |
| `commit-commands` | When user says "commit", "push", "create PR", or after completing a coding task and user approves | `/commit`, `/commit-push-pr` |
| `session-report` | When user asks about token usage, costs, or session efficiency; or at end of long sessions | `/session-report` |
| `claude-md-management` | At end of sessions that revealed missing CLAUDE.md context or after significant codebase changes | `/revise-claude-md` |

> **`/ultrareview` deprecated 2026-05-04** — replaced by `multi-model-review.js review-merged` (free via Copilot Responses API). Reason: ultrareview's 3 free trial runs expire 2026-05-05, after which it bills $5–$20 per run with no unlimited tier. The new `/iterate` skill (see Workflow table) calls `review-merged` as the final pre-merge gate.

**Routing priority:** MCS skills (`/mcs-*`) always take precedence over plugins. Plugins handle code-level work; MCS skills handle platform-level work.

### Layer A vs Layer B Scoping

Two distinct layers of work happen in this repo. Tools route differently:

| Layer | Scope | Tools that fire |
|-------|-------|----------------|
| **A — Framework engineering** | `tools/`, `app/`, `.claude/`, dashboard, build-runner, LSP wrapper, hooks, frontend code | `superpowers` (debug/TDD/brainstorm), `code-review`, `commit-commands`, `frontend-design`, `figma`, `typescript-lsp`, `context7`, `claude-md-management`, `skill-creator`, `claude-mem`, `/iterate` (auto-test/review/merge orchestrator) |
| **B — MCS automation** | `/mcs-*` skill invocations, work under `Build-Guides/`, agentspec.json edits, MCS API operations | MCS skills (own spec-driven loop, own verify-after-each-step, own retry/escalate). `claude-mem` still captures (cross-session pattern recall is valuable here). `superpowers-debug` fires only on step failures via the protocol below — not pre-emptively. `eval-guide` plugin fires inside `/mcs-research` Phase C, `/mcs-eval`, `/mcs-fix`. |

When a request is ambiguous, the rule is: if user typed `/mcs-*` or files modified are under `Build-Guides/` → Layer B. Everything else → Layer A.

---

## Dual Model Co-Generation (Selective, Advisory)

Fire GPT-5.5 **only when one of the 5 value patterns applies** — not on every turn. The Stop-hook enforcement was removed on 2026-04-27 after usage data showed it was forcing low-value `ask` calls. The reminder hook is now informational.

| Pattern | Command | When |
|---------|---------|------|
| Spec attack | `challenge` | Before architecture/design decisions, risky implementations |
| Design fork | `ask` (only when truly need a second design) | In parallel with Claude's own design |
| Test oracle | `generate-evals`, `generate-instructions`, `generate-topics` | Independent generation from spec, no implementation seen |
| Action guardrail | `challenge --context "action guardrail..."` | Before deploys, destructive ops, irreversible changes |
| Failure triage | `diagnose` | Hard bugs after first-pass uncertainty |

**When to call:**
```bash
node tools/multi-model-review.js --session-id <sid> challenge -q "..."
```

The UserPromptSubmit hook still tells you the session ID via the soft reminder. Pass `--session-id` so attestation entries bind correctly under multi-instance use.

**Truncation auto-handled** — tool retries once with 2x budget + effort downgrade and surfaces `_truncated`/`_incompleteReason` in stdout JSON when clipped.

Full protocol, skip criteria, merge rules, and revert path in `.claude/rules/gpt-co-generation.md`.

---

## Core Philosophy

1. **Spec-driven build** — agentspec.json drives every build because a single source of truth prevents drift between design and execution. Fill gaps before building.

2. **Eval via eval-guide plugin** — three eval buckets (boundaries, quality, edge-cases) generated by the `eval-guide` plugin (`/eval-suite-planner` + `/eval-generator`). Verdict model: SHIP/ITERATE/BLOCK with risk-based thresholds (safety >=95%, core >=90%, edge >=70%). Upload as reference — don't auto-iterate or auto-run.

3. **Multi-agent when justified** — score objectively using 6 factors (3+ = multi-agent) because premature decomposition adds complexity without quality gain.

4. **Microsoft-first research** — resolve Priority 1-4 components from cache because they are well-documented and enterprise-supported. Only escalate to live research for Priority 5-6 external systems.

5. **Assess before building** — run the solution type scoring after identifying agents because a Power Automate flow that works is better than an agent that is just a thin API wrapper.

6. **All-API build stack** — zero browser automation because deterministic API calls are reproducible and verifiable. User-guided manual steps only for new OAuth connections.

7. **Assume max licensing** — always assume the customer has the best license available: M365 Copilot, Copilot Studio, Frontier program, premium connectors, Dynamics 365. Never ask licensing questions during research or preview. Auto-fill all `business.licensing` fields to `"yes"`. Only override if the customer explicitly states a limitation.

---

## Error Handling

When something fails, stop and research broadly before retrying. The protocol differs by attempt:

**Attempt 1 (research → retry):**
1. Query `claude-mem` for similar past failures across projects (vector search on the error message + the operation context). If a prior fix exists, prefer it.
2. Search for the error message + "Copilot Studio" via WebSearch.
3. Check MS Learn MCP for official troubleshooting.
4. Read back API state to verify what actually happened.
5. Retry with the researched approach — never the same failed approach twice.

**Attempt 2 (systematic debug, NOT another generic retry):**
6. Invoke `superpowers` 4-phase debug: **Hypothesize** (list candidate root causes — auth, payload schema, API contract, connector, model, timing), **Reproduce** (minimal repro outside the build pipeline if possible), **Isolate** (narrow to one layer with discriminating tests), **Fix** (apply targeted fix to the isolated cause).
7. Log the isolated cause + fix to `knowledge/learnings/` so future builds (and future claude-mem queries) hit it on Attempt 1.

**Attempt 3 (escalate):**
8. If superpowers-debug doesn't isolate the cause in one cycle, escalate to the user with the hypothesis tree, what was tested, and what remains uncertain.

This converts the prior "2 retries then escalate" into "1 retry, 1 systematic debug, then escalate" — same budget, structured isolation.

---

## Project Structure

```
bin/
├── cli.js (mcs start/stop/health/doctor/update), postinstall.js

.claude/
├── settings.json, hooks/ (9 hooks: 8 wired + check-gpt-attestation preserved-unwired), skills/ (13 skills), agents/ (6 teammates: flow-designer, prompt-engineer, qa-challenger, repo-auditor, research-analyst, topic-engineer), rules/ (path-scoped), plugins (13 installed)

app/
├── server.js, lib/ (documents, projects, workiq, readiness, spec-migrate, enrichment, build-runner, skill-runner, knowledge-resolver, dev-logger, chat/, helper/, report/), frontend/ (React + Vite + shadcn/ui)

knowledge/
├── cache/ (24 cheat sheets + connector-schemas/), docs-cache/ (sync probe artifacts), patterns/ (YAML, Dataverse, topic, flow templates)
├── frameworks/ (component selection, architecture scoring, eval scenarios, auto-merge-denylist)
├── learnings/ (topic files + index.json + audit logs), solutions/ (library index + cache)
├── research/, sync/ (snapshots, decisions, views), index.json, docs-manifest.json, feature-map.json, figma-reference.json, resolver-maps.json, sync-manifest.json, upstream-repos.json

tools/
├── mcs-lsp.js, island-client.js, add-tool.js, flow-manager.js
├── direct-line-test.js, eval-scoring.js, multi-model-review.js
├── solution-library.js, dataverse-helper.ps1
├── upstream-check.js, sync-orchestrator.js, sync-adapters/
├── pac-mcp-wrapper.js (PAC CLI MCP server adapter)
├── om-cli/ (YAML validation, 357 types), lib/ (http, openai, anthropic, graph-sharepoint, flow-composer, connector-schema)
├── gen-constraints.py, drift-detect.py, semantic-gates.py
├── git-hooks/ (pre-commit, pre-push), update-om-cli.ps1
├── iterate-orchestrator.js, auto-merge-gate.js, oracle-runner.js, agentic-test-loop.js, backend-verify.js
├── pipeline-test-loop.js, mcs-build-loop.js, har-capture.js, figma-pull.js
├── live-smoke-eval-gate.js, batch-smoke-eval-gate.js, contract-parity.js, diagnose-direct-line.js
├── upstream-specs/, generated/ (typed specs)

templates/
├── agentspec.json (schema), default-recommendations.json, brief.json (legacy spec fallback)

start.js (process manager — spawns server, opens browser, handles updates)
Build-Guides/[Project]/ (per-project work, gitignored)
├── agents/[name]/ (agentspec.json, build-report.md, topics/, evals)
├── docs/ (uploaded customer documents)
```

---

## Key Principles

1. **Spec is the blueprint** — agentspec.json drives the build
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
| First-party agents inventory (capability matching) | `knowledge/cache/first-party-agents.md` |
| Declarative agents cheat sheet (DA vs CA routing) | `knowledge/cache/declarative-agents.md` |
| YAML patterns + topic templates | `knowledge/patterns/` |
| Eval scenario library | `eval-guide` plugin (bucket mapping: `knowledge/frameworks/eval-scenarios/index.json`) |
| Dataverse API patterns | `knowledge/patterns/dataverse-patterns.md` |
| Solution patterns (naive-to-proven) | `knowledge/patterns/solution-patterns.md` |
| Elevate upstream monitoring (read-only) | `knowledge/learnings/elevate-upstream-digest.md` + `tools/elevate-sync.js` |
| **Publish-state matrix** (backend→UI) | `knowledge/frameworks/publish-state-matrix.md` |
| **API contract registry** (sanitized HAR → parity tests) | `tools/upstream-specs/contracts/README.md` |
| **Live-smoke runbook** (eval gate end-to-end) | `tools/upstream-specs/live-smoke-eval-gate-runbook.md` |
| **Parallel sessions via worktrees** | `.claude/rules/parallel-sessions.md` + `tools/new-session.sh` / `tools/end-session.sh` |
| **Frontend test-iterate loop** (honesty gate) | `.claude/rules/frontend-verification.md` + `tools/agentic-test-loop.js self-test` |

### Eval-as-publish-gate (shipped 2026-04-17)

Build pipeline ends in `published-internal`. Promotion to `published-uat` requires eval verdict = SHIP. All else stays internal (user NOT visible). `evalConfig.skipGate=true` overrides only with `skipGateApprovedBy` + `skipGateReason` + `skipGateTicketRef` — hash-chained audit at `knowledge/learnings/eval-gate-overrides.jsonl`. Risk tiers: `demo` (80/50/50) / `internal` (90/60/60) / `production` (95/80/75). Feature flags in `knowledge/eval-gate-flags.json`.

Commands:

```bash
npm run contracts:check          # Static parity of all 5 registered API contracts (pre-push gate)
npm run contracts:list           # See registered contracts
npm run gate:audit-verify        # Verify the skipGate override audit chain
npm run gate:backfill            # Inventory + migrate pre-gate 'published' → 'published-internal'
npm run gate:diagnose-direct-line --project <p> --agent <a>  # Introspect bot config without dumping values
npm run gate:har-capture capture --url https://copilotstudio.preview.microsoft.com  # Auto-HAR replacement
npm run smoke:eval-gate:preflight --project <p> --agent <a>  # Identity + env + non-prod checks
npm run smoke:eval-gate --project <p> --agent <a> --confirm  # Live eval pipeline only
npm run smoke:eval-gate:via-gate --project <p> --agent <a> --confirm  # Full stepEvalGate + promotion
npm run smoke:eval-gate:batch                                        # Batch all 5 remaining backfilled agents (opt-in; ~7 min)
```

**Override path** (user-controlled — requires setting approval fields in agentspec.json):

```json
"evalConfig": {
  "skipGate": true,
  "skipGateApprovedBy": "your-name@microsoft.com",
  "skipGateReason": ">=10-char reason explaining why eval gate is bypassed",
  "skipGateTicketRef": "gh-issue-or-ticket-id"
}
```

Then `npm run smoke:eval-gate:via-gate -- --project P --agent A --confirm` will promote to `published-uat` and append a hash-chained audit entry to `knowledge/learnings/eval-gate-overrides.jsonl` (gitignored).

### Sync model (manual, one weekly entry point)

All upstream tracking goes through `/mcs-sync`. There is no auto-cron, no session-start auto-fetch, and no auto-apply path. The build itself is the safety net — `/mcs-build` Check 0 refuses to proceed if Tier 1 cache is >14 days stale (override with `--allow-stale --stale-reason "<why>"`).

**Primary workflow — type one thing:**

```
/mcs-sync                                                # detect drift across all 8 sources, render triage
node tools/sync-orchestrator.js review                   # re-open the last triage without re-detecting
node tools/sync-orchestrator.js decide <id> reject --reason "..."         # decline a card
node tools/sync-orchestrator.js decide <id> take   --reason "..." --confirm  # accept and follow the action plan
```

**Sources covered (8):** `knowledge-cache`, `upstream-repos`, `elevate`, `eval-guide`, `mcp-servers`, `om-cli`, `docs-manifest`, `plugins`. Each registers an adapter under `tools/sync-adapters/` and a record in `knowledge/sync-manifest.json`.

**Decisions — only two:**

- **TAKE** — accept the change. The orchestrator prints the impact graph (what downstream artifacts the change touches) and writes an action plan markdown at `knowledge/sync/views/<runId>-actions.md`. The user works through the action plan manually; the orchestrator NEVER edits impacted artifacts itself.
- **REJECT** — decline. Permanent for this `changeId`. If upstream moves again, the next sync run produces a fresh card.

**Audit trail:** decisions append to hash-chained JSONL under `knowledge/sync/decisions/<source-id>/`. Generated views in `knowledge/sync/views/` carry an integrity marker; the pre-commit hook blocks hand-edits.

Cache freshness thresholds (used by `/mcs-build` Check 0): < 3 days = fresh, 3-14 days = stale (warn), > 14 days = critical (blocks unless overridden). The `elevate` source in `tools/elevate-sync.js` monitors bap-microsoft/Elevate and is READ-ONLY — writes a classification digest only when invoked manually with `--digest`. Push URL is set to `DISABLED` and the pre-push hook blocks pushes to the `elevate` remote.

---

## Rules Summary

These five rules apply everywhere and are restated here to counteract position bias:

1. **agentspec.json is the single source of truth** — the dashboard reads it, skills read it, reports generate from it
2. **Fire GPT-5.5 selectively on the 5 value patterns** — advisory (not enforced) since 2026-04-27 (see Rule Zero at top + `.claude/rules/gpt-co-generation.md`)
3. **Verify every build step via API read-back** before marking complete (see `.claude/rules/build-discipline.md`)
4. **Research Microsoft-first** — use cache for M365-native, live research only for external systems
5. **Attempt every MVP item** — a failed attempt with a clear error is more valuable than a silently skipped item
