# /iterate — Phased Execution Instructions

Read this file at the start of every `/iterate` invocation. The phases are sequential; do not skip ahead unless a phase explicitly says "skip on X". The skill is a **long-running single-turn loop** — perform every phase in one response, even if it spans many tool calls.

Default mode is **full autonomy**: edit → test → fix → re-test → review → score → commit → push → PR → auto-merge. The user is notified only on auto-merge or escalation. Honor `--no-auto-merge` to stop before merge.

---

## Phase 0 — Boundary check + session create

Before doing anything else:

```bash
node tools/iterate-orchestrator.js classify
```

Read the JSON. Decide:

- `lanesNeeded` is empty → exit early. Tell user: "No relevant changes to iterate on — `git status` is clean."
- All `lanesNeeded` are `docs` only → exit early. Suggest `/commit-push-pr` directly. Doc PRs don't need full iteration.
- `denylist.count > 0` → set `auto-merge=false` for this run. Continue with verification but skip the auto-merge phase. Surface the denylist matches to the user at the end.

Then create the session:

```bash
node tools/iterate-orchestrator.js session-create --reason "<short reason or current goal>"
```

Save the returned `id` — every subsequent `session-update` uses it implicitly via the marker file.

---

## Phase 1 — Lane verification (parallel)

Spawn the verifiers in **one tool call batch** so they run concurrently. The orchestrator's `run-lanes` does this for you on the mechanical lanes (frontend, backend):

```bash
node tools/iterate-orchestrator.js run-lanes --require-oracle --start-server
```

Always pass `--require-oracle` (it runs the oracle pass after Playwright green to catch false greens). Always pass `--start-server` (the worker is idempotent — if it's up, no-op; if not, it auto-starts the dev server).

For lanes the orchestrator doesn't auto-spawn:

- **framework lane**: dispatch `repo-auditor` via `Agent({subagent_type: 'repo-auditor', isolation: 'worktree'})`. Then invoke `claude-md-management:revise-claude-md` if `CLAUDE.md` was edited.
- **agentspec lane**: invoke `/mcs-eval` against the modified spec. Require SHIP verdict from the eval-guide plugin.

Update the session phase: `session-update --phase lanes --state running`.

When all lanes return:

```bash
node tools/iterate-orchestrator.js verdict
```

Read the `lanes` field. Each lane has `status` ∈ `{green, failing, error, pass}`.

- All green → Phase 2 (review).
- Any failing → Phase 1.5 (fix loop).
- Any error → escalate (Phase 6) — likely tooling problem, not a code bug.

---

## Phase 1.5 — Fix loop (per failing lane)

For each failing lane, do this loop. **Hard cap: 5 fix iterations per lane.** If you hit the cap with no progress, escalate.

1. Read the lane's last-result file:
   - frontend → `tools/.test-loop.last-result.json`
   - backend → `tools/.backend-verify.last-result.json`
2. Identify the root cause from `failures[].classification`:
   - `oracle-mismatch` (frontend) — false-green caught. The Playwright suite passed but oracle invariants failed. Read the failures and fix the actual user-visible behavior, not the test.
   - `console-error` (frontend) — read `failures[].excerpt`, find the error in the source, fix.
   - `element-missing` (frontend) — selector changed or render path broken. Check recent edits.
   - `react-crash` (frontend) — crashed component. Read stack, fix.
   - `timeout` (frontend) — async race or infinite loop. Add awaits or check effects.
   - `contract-parity-failed` (backend) — sanitized HAR drifted from live spec. Update the contract registration or fix the implementation.
   - `typescript-error` (backend) — fix types in `tools/`. Don't suppress with `any` unless it's truly external.
   - `unit-test-failed` (backend) — read failed test names, fix the source under `app/lib/`.
   - `server-5xx` (backend) — backend route is 5xx-ing. Read server logs (`node tools/agentic-test-loop.js logs --cat req,error`), fix.
3. Edit ONLY application code. **Never modify test files to make tests pass.** **Never weaken assertions or add waits to mask timing.**
4. Re-spawn that lane (just that lane, not all of them):
   ```bash
   node tools/iterate-orchestrator.js run-lanes --lanes <lane> --require-oracle --start-server
   ```
5. Read the new result. If green, lane done. If still failing, increment the per-lane counter and loop.

After every iteration:

```bash
node tools/iterate-orchestrator.js session-update --phase fix --state running --data '{"lane":"<lane>","attempt":<n>}'
```

If you hit the 5-iteration cap on any lane, set state to `escalated`:

```bash
node tools/iterate-orchestrator.js session-update --state escalated --reason "<lane> stuck at <classification> after 5 attempts"
```

Then break out of the loop and skip to Phase 6.

---

## Phase 2 — Facilitator review (qa-challenger via Agent tool)

This is the swarms facilitator/lead pattern: lead = main session, facilitator = `qa-challenger` in a worktree-isolated sub-agent. The facilitator cannot see the lead's reasoning — only the committed/saved file state. Read `.claude/skills/iterate/facilitator-loop.md` for the full dispatch protocol.

Summary:

```
Agent({
  description: "Iterate review",
  subagent_type: "qa-challenger",
  isolation: "worktree",
  prompt: "MODE=iterate-review. Reviewing changes in current worktree. Output exactly the JSON schema in .claude/skills/iterate/review-schema.json: { score: 1-10, criticalFindings: [], suggestions: [] }. No prose outside the JSON. Score below 9 if there is any critical finding. Score below 7 if there is a security or correctness defect."
})
```

Read the returned JSON. Validate against `review-schema.json`. Loop:

- `score >= 9 && criticalFindings.length === 0` → done, proceed to Phase 3.
- `score >= 9 && criticalFindings.length > 0` → reject (lazy review with high score but findings). Re-dispatch with stronger prompt.
- `score < 9` → apply suggestions, re-test the affected lanes, re-dispatch.

**Hard cap: 5 review cycles.** If still not converged, escalate.

After each cycle:

```bash
node tools/iterate-orchestrator.js session-update --phase review --state running --data '{"facilitatorReview":<json>,"cycle":<n>}'
```

The review JSON is now persisted in the session — `verdict` will pick it up.

---

## Phase 3 — Final oracle (multi-model-review review-merged)

```bash
node tools/multi-model-review.js --session-id <session-id> review-merged --brief <path>
```

The brief: if there's an agentspec.json in the change, use that. Otherwise synthesize a brief from the diff (use `git diff --stat` + `git log --oneline -5` + the change description). For pure code changes, write a temp brief to `tools/.iterate-brief.json` describing what the change does and what it touches.

Read the JSON. Look for `readyToPublish: true` and an empty (or minor-only) `criticalGaps` list.

Persist the result:

```bash
node tools/iterate-orchestrator.js session-update --phase merged-review --state running --data '{"reviewMerged":<json>}'
```

---

## Phase 4 — Combined verdict + denylist gate

```bash
node tools/iterate-orchestrator.js verdict --require-merged-review
```

Read `finalStatus`:

- `green` → all gates pass. Continue to Phase 5 (commit + merge).
- `blocked` → read `blockers[]`. Common blockers:
  - `lanes-not-green` → re-enter Phase 1.5.
  - `facilitator-score-X` → re-enter Phase 2.
  - `review-merged-not-ready` → re-enter Phase 3 (or address the criticalGaps with a fix and re-run lanes).
- `no-changes` → unusual; `git status` was non-empty during classify but is now clean. Verify and exit.

Re-check the denylist (it can change as you commit progressively):

```bash
node tools/iterate-orchestrator.js classify
```

If `denylist.count > 0`, **set `--no-auto-merge` mode for this run**. Do Phase 5 commit + push + PR but skip the auto-merge step. Surface the denylist matches.

---

## Phase 5 — Commit, push, open PR, (auto-merge)

Use `commit-commands` for the commit:

```bash
# Commits via the /commit skill — uses the project's commit message style.
```

Then push and open PR:

```bash
git push -u origin HEAD
gh pr create --title "<short>" --body "$(cat <<'EOF'
## Summary
<bullets>

## Test plan
- [x] /iterate auto-verified all lanes
- [x] qa-challenger facilitator review: <score>/10
- [x] multi-model-review review-merged: ready

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

If `--no-auto-merge` is set OR denylist had matches, **stop here**. Surface PR URL to user.

Otherwise, arm auto-merge (Phase 5 of the rollout — implemented in `tools/auto-merge-gate.js`):

```bash
node tools/auto-merge-gate.js check     # returns reasons not to auto-merge
node tools/auto-merge-gate.js arm       # if check passes, calls gh pr merge --auto
```

The gate enforces: lanes green, facilitator >=9 + zero critical, review-merged ready, CI green-or-pending, denylist clean, no `needs-human-review` label, session cap (3 auto-merges per session), 5-min cooldown since last auto-merge. All checks are hash-chained to `knowledge/learnings/iterate-audit.jsonl`.

Append to audit:

```bash
node tools/iterate-orchestrator.js audit-append --event "iterate-merge" --data '{"prUrl":"<url>","sessionId":"<id>","verdict":"green","facilitatorScore":<n>}'
```

---

## Phase 6 — Escalation

Only fire if a hard cap was hit, denylist forced a stop, or any phase returned `error`.

1. Update session: `session-update --state escalated --reason "<reason>"`.
2. Run `audit-append --event "iterate-escalate" --data '{...}'`.
3. Surface a structured summary to the user:
   - What was attempted (per phase).
   - Where it broke (the specific phase + classification).
   - The current state (which lanes are green, which aren't).
   - Concrete next-step suggestions: re-run with `--no-oracle`, change approach, or `--abandon` the session.

The Stop hook surfaces the session marker on the next turn.

---

## Phase 7 — Clear session

On full success (Phase 5 completed including merge), or on user `--abandon`:

```bash
node tools/iterate-orchestrator.js session-clear
```

Final user-facing message: 1–2 sentences. What changed and what's next.

---

## Hard rules (do not violate)

1. **Single response, multiple tool calls.** This skill runs the whole loop in one response. Do not exit and ask the user "should I continue" between phases.
2. **Lane verifiers run in parallel.** Always batch frontend + backend in one tool call message.
3. **Cap iterations.** 5 fix attempts per lane; 5 facilitator cycles. After cap, escalate.
4. **Edit only application code on fixes.** Never modify e2e test files to make tests pass. Never add `waitForTimeout` as a fix.
5. **Auto-merge requires denylist clean + all gates green + cooldown elapsed + session cap not exceeded.**
6. **Honor kill switches**: `--no-auto-merge`, `CLAUDE_OFF_AUTO_MERGE=1`, `--no-iterate`.
7. **Audit every transition.** Every `audit-append` is hash-chained. Run `audit-verify` at the start of every `/iterate` to catch tampering.
