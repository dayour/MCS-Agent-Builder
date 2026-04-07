---
paths:
  - ".claude/skills/**"
  - ".claude/agents/**"
  - "tools/**"
  - "app/**"
  - "knowledge/**"
  - "templates/**"
  - "CLAUDE.md"
  - "*.md"
  - "*.js"
  - "*.py"
  - "*.ps1"
  - "*.json"
  - "*.ts"
  - "*.tsx"
---

# Dual Model Co-Generation and Review

Fire GPT-5.4 on **every interaction** — no size threshold, no "trivial" exception, everything. This is hook-enforced: the Stop hook blocks if no GPT attestation exists for the session. GPT serves as both a **co-generator** (produces content independently for merging) and a **reviewer** (validates content after generation). This applies to all work: MCS builds, code writing, reviews, cleanup, app updates, architecture decisions, documentation, and even simple greetings (use `ask -q`).

## 5 GPT Value Patterns (Ordered by Impact)

The second model is most valuable as an **adversary, oracle, and safety controller** — not a post-hoc reviewer. Move GPT effort upstream.

### Pattern 1: Spec Attack (Highest Value)
**When:** Before any multi-step task, architecture decision, or non-trivial implementation.
**Command:** `challenge -q "<plan>" [--file <path>]`
**GPT role:** Adversarial product owner — finds missing assumptions, edge cases, ambiguities, and security concerns BEFORE code exists.
**Why:** Bad specs create good-looking wrong code. This is where two models disagree most productively.

### Pattern 2: Independent Design Fork
**When:** Architecture, refactors, complex features, API design.
**Command:** `ask -q "<design question>" --context "<constraints>"` — run in parallel with Claude's own design.
**GPT role:** Produces an independent solution. Lead synthesizes the best of both.
**Why:** Actual design diversity. Avoids premature convergence.

### Pattern 3: Independent Test Oracle
**When:** After spec is agreed, parallel with implementation.
**Command:** `generate-evals --brief <path>` (MCS) or `ask -q "generate test cases for: <spec>"` (code).
**GPT role:** Generates tests/invariants from spec WITHOUT seeing the implementation.
**Why:** If GPT sees the code first, it anchors and misses the same bugs. Independent oracle generation catches correlated failures.

### Pattern 4: Action Guardrail
**When:** Before any side effect — deploys, destructive ops, external API calls, database changes.
**Command:** `challenge -q "<proposed action>" --context "action guardrail: validate blast radius, reversibility, idempotency"`.
**GPT role:** Execution safety controller — validates preconditions, blast radius, rollback plan.
**Why:** Mistakes after side effects are expensive. This is the cost-of-error multiplier.

### Pattern 5: Parallel Failure Triage
**When:** Bug fixing, errors, test failures, unexpected behavior.
**Command:** `diagnose -q "<error description>" [--file <path>]`
**GPT role:** Independent root-cause hypotheses with evidence and discriminating tests.
**Why:** Two models generate uncorrelated hypotheses. One sees config issues, the other sees code-path issues.

## When to Use Which Command

| Situation | Command | Effort |
|-----------|---------|--------|
| Planning what to build | `challenge` | high |
| Answering a question | `ask` | medium |
| Debugging a failure | `diagnose` | high |
| After writing code | `review-code` | medium |
| MCS instructions/topics/evals | `generate-instructions`, `generate-evals`, `generate-topics` | high |
| Component/architecture selection | `generate-components` (co-gen) | high |
| Flow spec design | `generate-flow` (co-gen) | high |
| Eval failure fixes | `generate-fix` (co-gen) | high |
| MCS component review (post-merge) | `review-components` | medium |
| Flow spec review (post-merge) | `review-flow` | medium |
| Before deploy/destructive action | `challenge` (guardrail mode) | high |
| Final pre-publish validation | `review-merged` | high |
| Quick factual check | `ask` | medium |

## When to Skip GPT

GPT fires on **everything** — the only valid skip reason is GPT being unavailable (exit code 3), in which case proceed with Claude alone. There are no task-size exceptions. Fire GPT as a background agent so it never blocks the response.

## Hook Enforcement (3 Layers)

GPT co-generation is mechanically enforced — forgetting is not possible:

1. **UserPromptSubmit hook** (`.claude/hooks/gpt-reminder.js`): Injects a `[GPT CO-GEN REQUIRED]` reminder into every user prompt AND writes a **per-interaction pending marker** (`$TMPDIR/claude-gpt-attestations/pending-<sessionId>.json`) with the prompt timestamp. This marker is the clock that the Stop hook reads.

2. **Stop hook** (`.claude/hooks/check-gpt-attestation.js`): After every response, reads the pending marker timestamp and checks if ANY GPT attestation exists AFTER that timestamp. This is **per-interaction enforcement** — a GPT call from a previous interaction does not satisfy the current one. Falls back to 5-minute window if no pending marker exists (grace period for first run).

3. **Attestation file** (`$TMPDIR/claude-gpt-attestations/<session-id>.json`): Written by `multi-model-review.js` on every successful call (or attempted call with exit 3). Contains session ID, command, status, and timestamp array. Per-session isolation prevents cross-session spoofing.

**Per-interaction flow:** UserPromptSubmit writes marker → Claude works → Claude calls GPT (writes attestation) → Stop hook checks attestation timestamp > marker timestamp → pass/block.

**Break-glass:** GPT unavailable (exit 3) writes `status: "unavailable"` attestation, satisfying the Stop hook. No manual bypass path — if GPT is reachable, it must be called.

**Known limitation:** Background agents spawned via the Agent tool do not trigger hooks and therefore bypass GPT enforcement. The lead agent (main conversation) must fire GPT — subagents are exempt.

## Effort Tiers

| Tier | Commands | Reasoning | When |
|------|----------|-----------|------|
| `none` | score, learn | No reasoning | Pure computation |
| `medium` | ask, review-code, review-* | Moderate | Analysis, second opinions |
| `high` | challenge, diagnose, generate-*, review-merged | Deep | Pre-implementation, generation, quality gates |

## Merge Protocol for Co-Generation

Co-generation produces two independent outputs that must be merged. Each content type has its own merge rules:

**Instructions (PE merges):**
- Constraints: union of both sets; stricter version wins on conflicts
- Boundaries: union of both sets; "refuse" takes precedence over "redirect" over "ignore"
- Response format: take the version with tiered length floors
- Examples: pick the best from each (aim for 2-3 varied)
- Trim to 8,000 chars after merge

**Topics (TE merges):**
- Validate both with om-cli -- only merge if at least one passes
- Both pass: merge node-by-node (better error handling, richer cards, union of trigger phrases); prefer Claude's structure when they diverge
- Only one passes: use the valid one
- Neither passes: fix Claude's first because it has om-cli tooling

**Evals (QA merges):**
- Deduplicate by intent (greater than 70% keyword overlap = same test)
- Union of unique tests
- Stricter expected answers for similar tests
- Recalculate coverage distribution after merge

**Components (RA merges):**
- Architecture scoring: take the higher score per factor (more conservative = safer)
- Integrations: union of both sets; higher-priority Microsoft-native option wins on conflicts
- Decisions: union of both sets; present both perspectives on disagreements
- Gaps: union of both — if either model flags a gap, it's worth investigating

**Flow specs (FD merges):**
- Flows: merge action-by-action; better error handling wins; union of connectors
- If both design the same flow differently: prefer the one with better error handling and sync-callable design
- Connector conflicts: prefer standard over premium when functionality is equivalent
- Include testing notes from both

**Fixes (QA/lead merges):**
- Root cause analysis: union of diagnoses; if models disagree on root cause, present both with evidence
- Fix proposals: prefer the minimum-change fix; flag when one proposes instruction edit vs topic change
- Score predictions: take the more conservative estimate
- Group related failures from both models' analyses

## Merge Protocol for Reviews

- **Union of findings** -- if either model flags something, it is worth looking at
- **Stricter wins on conflicts** -- the more conservative assessment prevails
- **Flag divergence** -- when opinions differ significantly, tell the user both positions
- **Proceed without GPT if it is slow or fails** because GPT should add value, not block progress

## Final Quality Gate — review-merged

After the lead merges all agent team outputs (instructions, topics, evals, components, flows), fire the final GPT pass:

```bash
node tools/multi-model-review.js review-merged --brief <path-to-brief.json>
```

This catches cross-artifact issues that individual reviews miss: orphaned capabilities, instruction-topic duplication, eval gaps, build feasibility blockers. Run this before any publish step. If `readyToPublish: false`, fix critical blockers first.

## How It Works

GPT-5.4 runs via the GitHub Copilot Responses API (`tools/lib/openai.js`). Auth is automatic via `gh auth token` with `copilot` scope. For structured reviews and co-generation, use `tools/multi-model-review.js` (20 commands: 6 co-generation + 7 review + 1 scoring + 1 challenge + 1 diagnose + 1 ask + 1 learn + 2 utility). For ad-hoc reviews, call `chatCompletion()` directly from a temp script via Bash.
