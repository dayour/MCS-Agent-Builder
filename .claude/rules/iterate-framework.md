# Autonomous Iterate Framework — Contract & Kill Switches

The `/iterate` skill (Layer A) and `/mcs-iterate` skill (Layer B) run a fully-autonomous edit → test → fix → review → score → commit → push → PR → auto-merge loop. This file is the **contract** — what's promised, what's guarded, and how to stop it.

## Advisory Mode (current default, 2026-05-05)

**`/iterate` is advisory, not CI-enforced.** A 2026-05-05 audit found the framework had never run on this repo (`iterate-audit.jsonl` was empty) — every recent PR shipped through `/commit-push-pr` + GitHub UI manual merge. The repo has no CI workflow that requires `/iterate` to pass before merge, so nothing prevents a future change from skipping it again.

The current contract:

- **`/commit-push-pr` is the canonical merge path.** Per `.claude/rules/commit-routing.md`, it's used for doc-only changes (`*.md`, `docs/**`, `knowledge/**`).
- **`/iterate` adds value for code changes** — lane verifiers, facilitator review, GPT review-merged, audit entry — but does NOT gate merge. Claude reads `commit-routing.md` and chooses; there's no hook block, no CI gate, no skill-level interception.
- **No bypass detection.** If a future Claude session (or human) runs `/commit-push-pr` on a code change, the PR can merge on GitHub UI without `/iterate` ever knowing. The audit log only records runs that actually went through `/iterate`.
- **Audit entries bind to PR SHA.** When `/iterate` does run, audit entries (and the post-merge `iterate-merge-completed` finalization step) include `prNumber`, `headRefOid`, `baseRefName`, `baseRefOid`, and `mergeCommitSha` so a retrospective audit can reconstruct what shipped under what review.

This is an explicit choice — see the user's decision in the 2026-05-05 framework optimization plan. The framework's local primitives (oracle, facilitator, denylist, audit chain) all work and remain available; what's missing is the GitHub-side enforcement.

### Enforced Mode (future, deferred)

To upgrade to enforced mode without rewriting the framework: add a `.github/workflows/iterate-gate.yml` workflow that runs `tools/agentic-test-loop.js run --require-oracle`, `tools/backend-verify.js`, and posts a status check named `iterate-required`. Configure GitHub branch protection on `main` to require `iterate-required`. Modify `auto-merge-gate.js` `ci-fully-green` to require the check exists, not just "no failures." This was scoped out of the 2026-05-05 plan.

## Default behavior

A naked `/iterate` invocation does:

1. Classify changes via `tools/iterate-orchestrator.js classify`.
2. Spawn lane verifiers in parallel (frontend → `agentic-test-loop` with `--require-oracle`; backend → `backend-verify`).
3. Fix lane failures in-place, max 5 iterations per lane.
4. Dispatch facilitator (`qa-challenger` via Agent tool with `isolation: "worktree"`).
5. Loop facilitator review until `score>=9 && criticalFindings.length===0`, max 5 cycles.
6. Run `multi-model-review.js review-merged` as third oracle.
7. Combined verdict + denylist gate.
8. Commit + push + open PR via `commit-commands` skill.
9. Arm `gh pr merge --auto --squash` via `tools/auto-merge-gate.js`.
10. Notify user **only on auto-merge or escalation**.

## What changes auto-merge vs. stops at PR

`/iterate` auto-merges by default. It stops at PR (does not arm auto-merge) when **any** of these is true:

- The user passed `--no-auto-merge`.
- The env has `CLAUDE_OFF_AUTO_MERGE=1`.
- Any change is on the auto-merge denylist (`knowledge/frameworks/auto-merge-denylist.md`).
- Session-level cap reached (3 auto-merges per `/iterate` session).
- Cooldown not elapsed (5 minutes since last auto-merge).
- Facilitator score < 9 or has critical findings.
- `multi-model-review review-merged` returned `readyToPublish: false`.
- CI checks failed OR pending — pending blocks (per GPT challenge 2026-05-04: pending is a TOCTOU race).
- PR has `needs-human-review` label.
- The PR head SHA changed between the gate check and the arm call (force-push race).

In any of these, the PR opens and the user is asked to merge manually.

## Kill switches (hard)

| Switch | Scope | Effect |
|--------|-------|--------|
| `--no-auto-merge` flag | One `/iterate` invocation | Skip arm; PR opens, user merges. |
| `CLAUDE_OFF_AUTO_MERGE=1` | Whole session + sub-agents | Same as above, plus prevents nested `/iterate` calls from auto-merging. |
| `CLAUDE_OFF_AUTOTEST=1` | Whole session | Disables all auto-fire test triggers (frontend + backend). Hooks no-op. |
| `--no-iterate` flag (not yet wired) | One invocation | Tells Claude to skip the whole skill. |
| Branch protection on `main` | Org/repo level | If `main` requires CI green or CODEOWNER review, GitHub enforces it server-side regardless of local gate. |
| `needs-human-review` label | Per PR | Apply via `gh pr edit <n> --add-label needs-human-review` to block auto-merge on a PR even if gates pass. |

## Audit trail

Every transition appends a hash-chained entry to `knowledge/learnings/iterate-audit.jsonl` (gitignored — local to the machine that wrote it).

Verify the chain at any time:

```bash
node tools/iterate-orchestrator.js audit-verify
node tools/auto-merge-gate.js audit-verify
```

A broken chain refuses subsequent merges (the `audit-chain-intact` gate fails closed).

The audit log is on the denylist itself — a PR cannot modify it without escalating to human review.

## Escalation triggers

`/iterate` escalates and ends the autonomous run when:

- Any lane verifier hits its 5-iteration cap without going green.
- Facilitator hasn't converged after 5 cycles.
- `multi-model-review review-merged` returned `readyToPublish: false` AND the criticalGaps cannot be auto-fixed by re-running lanes.
- Any phase returns `error` (tooling problem, not a code bug).
- A force-push during the gate evaluation invalidates head SHA binding.

On escalation, the session marker (`tools/.iterate-session.json`) is set to `state: 'escalated'`. The Stop hook surfaces this on the next user turn:

```
[iterate] session iter-XXX paused at phase=<phase>. Resume: /iterate --resume <id> or abandon: /iterate --abandon <id>.
```

## What `/iterate` does NOT do (yet)

- **Allowlist mode** (the GPT challenge recommends allowlist-first; defaults are denylist-first because the user wants full autonomy on routine code changes).
- **External audit anchoring** (audit log is local; not signed and not in an external append-only store).
- **Static security analysis** (no semantic checks for destructive SQL, secret reads, network exfiltration paths).
- **Canary deploy / runtime monitoring / auto-rollback** (no post-merge safety net).
- **Cross-machine session-cap atomic counter** (cap is per local audit log; concurrent runs from different machines could each get 3 merges).
- **Author trust differentiation** (no special handling for fork PRs, Dependabot, bot-authored PRs — gates apply uniformly).

These are documented gaps from the GPT challenge (2026-05-04). The current trade-off favors autonomy + denylist breadth over allowlist strictness; review this every quarter and tighten as warranted.

## Concurrent /iterate sessions

Multiple `/iterate` invocations from different terminals on the same machine share the audit log and session-cap counter (single file). They do NOT share an in-memory lock; concurrent runs may both pass the cap check before either appends. Mitigation: only run one `/iterate` at a time on a given machine. The session marker file's TTL (24h) prevents stale state from leaking into the next session.

For two genuinely parallel changes, use `tools/new-session.sh <topic>` — each worktree has its own `tools/.iterate-session.json` and audit log path (when run from that worktree's cwd).

## Reverting / disabling /iterate

If `/iterate` produces a regression that auto-merged into `main`:

```bash
# 1. Find the merge commit
gh pr list --state merged --search "in:title /iterate" --limit 5

# 2. Revert
git revert <merge-sha>

# 3. Disable auto-merge for the session while you investigate
export CLAUDE_OFF_AUTO_MERGE=1

# 4. Append an audit entry so the disable is recorded
node tools/iterate-orchestrator.js audit-append \
  --event "auto-merge-disabled" \
  --data '{"reason":"<reason>","actor":"<who>","reverted":"<merge-sha>"}'
```

To permanently disable until reviewed, add patterns from the change to the denylist in `tools/iterate-orchestrator.js` and `knowledge/frameworks/auto-merge-denylist.md`. The next `/iterate` will refuse anything matching.

## See also

- `.claude/skills/iterate/SKILL.md` — entry point + when-to-fire
- `.claude/skills/iterate/orchestrator.md` — phased execution instructions
- `.claude/skills/iterate/facilitator-loop.md` — facilitator/lead pattern
- `.claude/skills/iterate/review-schema.json` — JSON Schema for facilitator output
- `knowledge/frameworks/auto-merge-denylist.md` — canonical denylist with categories + override paths
- `tools/iterate-orchestrator.js` — pure-logic primitives (classify, run-lanes, verdict, audit, session)
- `tools/auto-merge-gate.js` — final pre-merge gate + `gh pr merge --auto`
- `tools/agentic-test-loop.js` — frontend lane (with `--require-oracle`)
- `tools/backend-verify.js` — backend lane
- `tools/oracle-runner.js` — false-green prevention wrapper
- `.claude/agents/qa-challenger.md` — facilitator agent in `MODE=iterate-review`
