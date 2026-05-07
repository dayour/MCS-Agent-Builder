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

Fire GPT-5.5 **selectively** on the 5 value patterns below — not on every interaction. This was changed on 2026-04-27 after data showed that universal firing produced ~50% low-value `ask` calls; GPT itself rated routine repo-specific Q&A as noise because Claude has full repo context that GPT lacks via tightly-framed prompts. Hard enforcement (Stop hook) was removed. The UserPromptSubmit reminder remains as a soft suggestion. The tool (`multi-model-review.js`) and all merge protocols are unchanged — only the trigger policy is.

GPT serves as **adversary, oracle, and safety controller** — not a post-hoc reviewer on every turn. Use it where two models genuinely disagree productively (architecture decisions, risky actions, hard diagnoses, non-trivial diffs). Skip it for routine Q&A, formatting, simple edits, conversational turns, and repo-specific questions where Claude's context advantage dominates.

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

Skip for routine Q&A, simple edits, formatting/renames, mechanical changes, conversational turns, and project-specific questions where the context Claude already has would be lost in a tightly-framed GPT prompt. GPT-unavailable (exit 3) is also a no-op — proceed with Claude alone. Fire GPT as a background agent (`run_in_background: true`) so it never blocks the response when you do invoke it.

## Hook Enforcement (Soft — Reminder Only, Not Blocked)

As of 2026-04-27, the Stop hook that mechanically enforced per-turn GPT calls has been **removed from `.claude/settings.json`**. The script (`.claude/hooks/check-gpt-attestation.js`) is still present in the repo for easy revert, but unwired. What remains:

1. **UserPromptSubmit hook** (`.claude/hooks/gpt-reminder.js`) — injects a soft `[GPT available, not required]` reminder describing the 5 value patterns and skip criteria. Still computes `turnId`, `promptHash`, and writes the pending marker so that any voluntary `multi-model-review.js` call still produces a properly-tagged attestation entry. The reminder is informational; Claude exercises judgment.

2. **Tool** (`tools/multi-model-review.js`) — unchanged. Still reads the pending marker and writes attestation entries tagged with `{command, turnId, promptHash, timestamp}`. Attestations now serve as a usage log, not a compliance gate.

3. **Bridge state** (`<cwd>/.claude/.gpt-session.json`) — gitignored, harmless to leave between sessions. Stores monotonic turnId only.

### How to revert (if selective firing turns out worse)

Restore the Stop hook entry in `.claude/settings.json`:

```json
"Stop": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "node \"C:/Copilot 2/.claude/hooks/check-gpt-attestation.js\"",
        "timeout": 10,
        "statusMessage": "Checking GPT co-generation compliance..."
      }
    ]
  }
]
```

Then update the wording in `gpt-reminder.js` and the top of this file back to the "every interaction" language. The script logic and attestation format are unchanged, so revert is a config-only change.

### Always pass `--session-id` when you do fire

Even though attestation is no longer gated, pass `--session-id` so the entry binds correctly under multi-instance use:

```bash
node tools/multi-model-review.js --session-id <sid> challenge -q "..."
```

If omitted, the tool falls back to the newest pending marker whose `bridgePath` matches `cwd` — fine for single-session use.

### Bypass conditions (still honored by the reminder hook)

The UserPromptSubmit hook exits early in these cases (no reminder injected):

- **`CLAUDE_HEADLESS=1`** — spawned PTY for skill execution.
- **`CLAUDE_GPT_HOOK_DEPTH >= 2`** — recursion guard.

### Truncation handling

The tool detects truncation (`status=incomplete` or `incomplete_details.reason=max_output_tokens`) and:

1. Retries automatically with 2x `max_output_tokens` and reasoning effort downgraded one tier (`high`→`medium`) to reclaim token budget for completion text. Retry flagged with `_truncationRetry=true` to prevent infinite loops.
2. Always surfaces `_truncated: true` and `_incompleteReason` in stdout JSON so Claude sees the flag and can decide to re-fire or split the task.

The `maxTokens: 16384` overrides on `challenge` and `diagnose` were removed — both commands now use the effort-tier default (65K for `high`), giving enough budget for reasoning + completion.

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
node tools/multi-model-review.js review-merged --brief <path-to-agentspec.json>
```

This catches cross-artifact issues that individual reviews miss: orphaned capabilities, instruction-topic duplication, eval gaps, build feasibility blockers. Run this before any publish step. If `readyToPublish: false`, fix critical blockers first.

## How It Works

GPT-5.5 runs via the GitHub Copilot Responses API (`tools/lib/openai.js`). Auth is automatic via `gh auth token` with `copilot` scope. For structured reviews and co-generation, use `tools/multi-model-review.js` (20 commands: 6 co-generation + 7 review + 1 scoring + 1 challenge + 1 diagnose + 1 ask + 1 learn + 2 utility). For ad-hoc reviews, call `chatCompletion()` directly from a temp script via Bash.
