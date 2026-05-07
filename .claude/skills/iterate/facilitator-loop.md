# /iterate — Facilitator/Lead Review Loop (Phase 2)

This file expands Phase 2 of `orchestrator.md`. Read it when entering the review loop, not before.

The pattern is from `dheerg/swarms`: the **lead** (you, the main session) implemented the change. The **facilitator** (qa-challenger sub-agent in a worktree) reviews. The lead applies feedback and re-dispatches. Loop until convergence at `score>=9 && criticalFindings.length === 0`.

Mechanical role separation: the facilitator runs in `isolation: "worktree"`, so it cannot see your in-flight thoughts — only committed/saved state. This is the swarms "lead-facilitator-cannot-be-same" constraint enforced by infrastructure.

## Dispatch protocol

### First dispatch

Save all in-flight changes (the worktree captures committed + staged + untracked). Then:

```
Agent({
  description: "Iterate review (facilitator)",
  subagent_type: "qa-challenger",
  isolation: "worktree",
  prompt: <see prompt below>
})
```

**Prompt template** (substitute the bracketed values):

```
MODE=iterate-review

You are the facilitator in an /iterate review loop. Output exactly the JSON
schema described in .claude/agents/qa-challenger.md "Iterate Review Mode"
section. Read .claude/skills/iterate/review-schema.json for the strict shape.

Context: the lead just completed implementation work on the iterate session
[<session-id>] in the parent worktree. The current worktree contains all
changes (committed + working tree). Your job is to find correctness, security,
testing, architecture, regression-risk, and tooling-integrity issues — ranked.

Scope of changes (from `git status` in this worktree):
[paste output of `git status --porcelain` here]

Recent commits on this branch (for context):
[paste output of `git log --oneline -5` here]

What the lead intended to build:
[paste 2-3 sentence description from the iterate session reason]

Strict requirements:
1. Output ONE JSON object matching review-schema.json. No prose. No markdown fence.
2. If criticalFindings is non-empty, score MUST be < 9.
3. Score 10 only if you found nothing actionable and the suggestions array is empty.
4. Use repo-relative file paths with forward slashes.
5. Cite line numbers when you reference specific code.
6. If you cannot read a file, return a single criticalFinding with
   category="testing" and summary="review-blocked: <reason>".
```

### Reading the response

The Agent returns a stringified message. Extract the JSON object (it may have a leading `\`\`\`json` fence if qa-challenger forgot the contract — strip it and warn). Validate against `.claude/skills/iterate/review-schema.json` (you can use `node -e "const s=require('jsonschema'); ..."` or just structurally).

### Validation rules (post-parse)

After parsing, check:

1. `score` is an integer 1–10.
2. If `criticalFindings.length > 0`, then `score < 9`. If both `>= 9` AND non-empty critical findings, **reject and re-dispatch** with this addendum to the prompt:

   ```
   PRIOR REVIEW REJECTED: you scored >= 9 but listed critical findings.
   This is contradictory. Score >= 9 means "merge as-is" — critical findings
   block merge. Either downgrade the score to <9 or move the items to suggestions.
   Re-do the review with this constraint.
   ```

3. Every `criticalFindings[]` entry has `category`, `summary` (>=5 chars), `fix` (>=5 chars). Reject if not.
4. `summary` is 10-600 chars.

### Decision after each cycle

- `score >= 9 && criticalFindings.length === 0` → **converged**. Persist to session and exit Phase 2:
  ```bash
  node tools/iterate-orchestrator.js session-update --phase review --state running --data '{"facilitatorReview":<json>,"cycle":<n>,"converged":true}'
  ```
- `criticalFindings.length > 0` → apply each `fix`, re-run the affected lane verifier (so green-state is fresh), re-dispatch.
- `score < 9 && criticalFindings.length === 0` → apply the suggestions (or the most material ones), re-dispatch.

### Hard cap: 5 review cycles

After 5 cycles without convergence, escalate:

```bash
node tools/iterate-orchestrator.js session-update --state escalated --reason "facilitator did not converge after 5 cycles; last score=<n>, critical=<m>"
```

Then break out of Phase 2 and skip to Phase 6 (escalation) per `orchestrator.md`.

## Tracking the loop

Keep a small array in your reasoning:

```
cycles = [
  { cycle: 1, score: 6, critical: 2, summary: "..." },
  { cycle: 2, score: 8, critical: 0, summary: "..." },
  { cycle: 3, score: 9, critical: 0, summary: "..." },
]
```

Use this to detect non-progress (e.g., same score twice with the same critical count). If non-progress, change approach (read a different file, reframe the prompt) on the next cycle. Don't blindly re-dispatch with the same prompt.

## Anti-patterns

| Anti-pattern | What's wrong | Mitigation |
|---|---|---|
| Re-dispatching with no diff to commit | Facilitator sees the same code, returns the same review | Apply at least one fix or re-stage before re-dispatching |
| Score 9 with critical findings, accepting it | Critical findings should block merge by definition | Reject and re-dispatch with addendum (above) |
| Editing tests to make findings disappear | Same anti-pattern as fix-loop | Address the underlying defect, not the test |
| Asking the facilitator to "be nicer" | Score isn't a feeling — it's a contract | Don't try to influence the score; address the findings |
| Spawning facilitator without `isolation: "worktree"` | Mechanical separation is broken; lead's reasoning leaks | ALWAYS pass `isolation: "worktree"`. Use `Agent({...isolation: "worktree"...})` |

## Why pattern adoption, not `/swarm:code` direct invocation

We installed `dheerg/swarms` for reference and to learn from its rules, but this loop **does NOT call `/swarm:code`** from inside the orchestrator. Reasons:

1. `/swarm:code` returns natural-language output. The orchestrator needs deterministic JSON to make merge decisions.
2. The 9/10 convergence threshold and structured review schema are tighter contracts than the swarms generic recipe.
3. Calling another skill from within `/iterate` adds an indirection layer and version-drift risk.

The pattern (lead/facilitator separation, recursive review to 9/10, mechanical role enforcement via worktree) is what we adopt. The implementation is ours.
