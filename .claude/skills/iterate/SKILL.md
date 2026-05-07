---
name: iterate
description: "Use this skill when the user asks Claude to autonomously test, fix, review, and merge a change end-to-end. Detects which lane(s) changed (frontend / backend / framework / agentspec), spawns relevant verifiers (agentic-test-loop with --require-oracle for false-green prevention; backend-verify for contracts/types/unit/server), runs a facilitator review loop using qa-challenger via Agent tool with worktree isolation until score>=9 and zero critical findings, calls multi-model-review.js review-merged as the final pre-merge oracle, and auto-merges via gh pr merge --auto if all gates pass and the change is not on the auto-merge denylist. User notified only on auto-merge completion or escalation. Triggered by /iterate, by phrases like 'make it work', 'iterate to green', 'fix and ship', or after Claude completes any non-trivial implementation in Layer A. Does NOT fire inside /mcs-* skills (they own their build/eval/fix loop) — for that, use /mcs-iterate."
---

# /iterate — Autonomous Test-Fix-Review-Merge Orchestrator (Layer A)

Single entry point for fully-autonomous iteration on a change. The skill runs as a **long-running single-turn** loop: Claude detects the lane(s) involved, dispatches verifiers in parallel, fixes failures in-place, reruns until green, runs an independent facilitator review, runs `multi-model-review.js review-merged` as the third oracle, and auto-merges if everything passes denylist + score thresholds.

## When to fire

- User typed `/iterate`.
- User said "iterate", "make it work", "fix and ship", "test and verify", "iterate to green".
- Claude just completed any non-trivial implementation in Layer A (frontend, backend, hooks, tools, framework). Fire automatically before announcing the work is done.
- The Stop hook surfaced a paused/escalated `/iterate` session — resume with `--resume <session-id>`.

## When NOT to fire

- Inside `/mcs-*` skills — they have their own build/eval/fix loop. For autonomous MCS iteration, use `/mcs-iterate`.
- The user explicitly says "don't iterate" or passes `--no-iterate`.
- The change is doc-only and has no test impact — a docs PR can go straight to `/commit-push-pr`.
- Trivial edits the user already validated themselves (typo fixes, comment changes).

## Flags

| Flag | Effect |
|------|--------|
| `--no-auto-merge` | Run all gates but stop before `gh pr merge --auto`. User reviews PR. |
| `--no-oracle` | Skip the `--require-oracle` pass on agentic-test-loop. Faster but reintroduces false-green risk. |
| `--scope <lanes>` | Comma-list of lanes to verify. Defaults to whatever `iterate-orchestrator classify` produces. |
| `--feature <key>` | Pin the agentic-test-loop feature expansion. Defaults to inferred. |
| `--resume <id>` | Resume a paused session. Reads `tools/.iterate-session.json`. |
| `--abandon <id>` | Clear a paused session marker without resuming. |

## Quick command surface

```bash
node tools/iterate-orchestrator.js classify           # JSON: which lanes need verification
node tools/iterate-orchestrator.js run-lanes --require-oracle --start-server
node tools/iterate-orchestrator.js verdict --require-merged-review
node tools/iterate-orchestrator.js audit-append --event <type> --data '<json>'
node tools/iterate-orchestrator.js audit-verify
node tools/iterate-orchestrator.js session-create --reason "<text>"
node tools/iterate-orchestrator.js session-update --phase <p> --state <s>
node tools/iterate-orchestrator.js session-clear

node tools/agentic-test-loop.js run --feature <key> --start-server --require-oracle
node tools/oracle-runner.js --feature <key>
node tools/backend-verify.js [--quick]

node tools/multi-model-review.js --session-id <sid> review-merged --brief <path>
```

## Phased execution

Read `orchestrator.md` in this skill directory. It contains the full phased instruction set Claude follows turn-by-turn. The phases are:

1. **Classify** — `node tools/iterate-orchestrator.js classify`
2. **Session-create** — start tracking
3. **Run lanes** — frontend (`agentic-test-loop --require-oracle`) + backend (`backend-verify`) in parallel; framework + agentspec require explicit Skill invocation
4. **Fix loop** — for each non-green lane, identify root cause, edit, re-run that lane only. Cap: 5 fix iterations per lane.
5. **Facilitator review** — dispatch `qa-challenger` via Agent tool with `isolation: "worktree"`, structured review schema. Loop until `score>=9 && criticalFindings.length===0`. Cap: 5 review cycles.
6. **Final oracle** — `multi-model-review.js review-merged` against the changed agentspec or a synthesized brief.
7. **Denylist + autonomy gate** — combined verdict: lanes green, facilitator OK, review-merged OK, denylist clean, no `--no-auto-merge`, session cap not exceeded, cooldown elapsed.
8. **Commit + push + PR** — `commit-commands` → `gh pr create`.
9. **Auto-merge** — `node tools/auto-merge-gate.js arm` (Phase 5 — until then, stop after PR creation).
10. **Notify** — emit final summary to user; clear session marker.

## Autonomy contract

See `.claude/rules/iterate-framework.md` for the full contract:
- Notify on auto-merge or escalation only
- Per-session cap: 3 auto-merges (configurable)
- 5-minute cooldown between auto-merges
- Hash-chained audit at `knowledge/learnings/iterate-audit.jsonl`
- Kill switches: `--no-auto-merge`, `CLAUDE_OFF_AUTO_MERGE=1`, denylist match
- Escalation triggers: any lane stalled, facilitator can't reach 9/10 in 5 cycles, review-merged rejects, denylist match, dynamic high-risk flag

## What the orchestrator owns vs. what Claude owns

| Layer | Owner |
|-------|-------|
| Pure-logic primitives (classify, audit, session) | `tools/iterate-orchestrator.js` |
| Frontend lane verifier | `tools/agentic-test-loop.js run --require-oracle` (autonomous up to 5 iterations) |
| Backend lane verifier | `tools/backend-verify.js` |
| Oracle runner | `tools/oracle-runner.js` (called from agentic-test-loop on green) |
| Facilitator review | Claude (lead) dispatching `qa-challenger` via Agent tool |
| Final oracle review | `multi-model-review.js review-merged` |
| Auto-merge | `tools/auto-merge-gate.js` (Phase 5) |
| Phased reasoning + fix decisions | Claude (this skill) |
| Cross-turn resume | Stop hook + `tools/.iterate-session.json` |

## Verification (smoke)

```bash
# Sanity — no real spawn
node tools/iterate-orchestrator.js self-test

# Real classification on current working tree
node tools/iterate-orchestrator.js classify

# Run lanes (requires dev server up — `npm start` in another terminal)
node tools/iterate-orchestrator.js run-lanes --require-oracle --start-server

# Combined verdict
node tools/iterate-orchestrator.js verdict
```

A green run logs to `knowledge/learnings/iterate-audit.jsonl` with hash-chained provenance. Verify with:

```bash
node tools/iterate-orchestrator.js audit-verify
```
