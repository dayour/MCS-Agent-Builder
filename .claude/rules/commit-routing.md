# Commit Routing — Choose `/commit-push-pr` vs `/iterate`

When you have changes ready to ship, route them through the right command. This rule is **advisory** — there's no CI gate forcing the choice. Claude reads this and decides.

## The rule

Look at `git diff --name-only` (or the staged/working set you're about to commit):

| What changed | Use | Why |
|--------------|-----|-----|
| **Doc-only** — `*.md`, `docs/**`, `knowledge/**`, comments-only edits | `/commit-push-pr` | No code paths affected. Lane verifiers + facilitator + GPT review-merged add no value here. |
| **Code** — anything under `app/`, `tools/`, `bin/`, `.claude/hooks/`, `.github/`, `package.json`, `*.config.*`, schemas, types, tests | `/iterate` | These changes can break behavior. Run lane verifiers (frontend smoke + backend verify), facilitator review, and GPT review-merged before pushing. |
| **Mixed (doc + code)** | `/iterate` | The code portion gates the whole change. |
| **Hotfix flagged urgent** | `/commit-push-pr` allowed | Document urgency in the PR description. Note the skipped review explicitly. |

## How to decide quickly

```
git diff --name-only HEAD
```

If every line of output matches `\.md$|^docs/|^knowledge/`, you're doc-only → `/commit-push-pr`.

Otherwise → `/iterate`.

## Edge cases

- **Generated files in commit** (e.g., `tools/generated/`, `tools/upstream-specs/contracts/`): treat as code. They reflect upstream behavior and need verification.
- **`CLAUDE.md` and `.claude/rules/*.md`**: these are docs but they shape Claude's behavior. Treat as code: run `/iterate` so that any drift is caught by the facilitator review.
- **`package.json` / lockfile changes**: code. Always `/iterate`.
- **Test additions only** (no source change, only `e2e/` or `__tests__/`): `/iterate` — tests can break the suite, and oracle invariants apply.
- **Reverts**: match the routing of the original change. Reverting a code PR → `/iterate`. Reverting a doc PR → `/commit-push-pr`.
- **Squash undo of the last commit** (`git reset --soft HEAD~1`): re-route based on the diff being re-committed.

## What `/iterate` will do that `/commit-push-pr` won't

`/iterate` adds these phases between commit-prep and push:

1. **Classify** the change (frontend / backend / framework / agentspec)
2. **Lane verifiers** — `agentic-test-loop --require-oracle --start-server` for frontend; `backend-verify` for backend. Fix loop runs in-place if either fails.
3. **Facilitator review** — `qa-challenger` sub-agent in an isolated worktree. Loops until `score >= 9 && criticalFindings.length === 0`.
4. **GPT review-merged** — `multi-model-review.js review-merged` as third independent oracle.
5. **Audit entry** — appends a hash-chained entry to `knowledge/learnings/iterate-audit.jsonl` with PR number + head/base/merge SHAs.

If `/iterate` cannot finish a phase, it escalates to the user instead of merging silently.

## What `/iterate` will NOT do (advisory mode)

- Force itself on PRs that bypass it. There's no CI gate. A future Claude session (or a human) can `/commit-push-pr` a code change and the PR will merge on GitHub UI.
- Detect retroactive bypasses. The audit log only knows about runs that went through `/iterate`.

This is the explicit advisory-mode tradeoff. See `.claude/rules/iterate-framework.md` "Advisory Mode" section for the full contract.

## When to override

- **Solo experimentation on a throwaway branch**: skip everything, edit-test-edit-push manually. Don't drag `/iterate` into rapid prototyping.
- **Synced fixup commits during an active PR review**: `/commit-push-pr` is fine for follow-ups on a PR that already passed `/iterate` once.
- **Reverting a broken merge fast**: `/commit-push-pr` for the revert commit; the original `/iterate` audit covered the prior run.

## What to do after merge

After `/iterate` opens a PR, GitHub auto-merge will fire if all gates pass. If a gate blocks, the PR stays open with a labelled reason. Either:
- Fix the blocker locally and re-push (the gate re-evaluates)
- Apply `needs-human-review` label and wait for a maintainer
- Add `--no-auto-merge` to the next `/iterate` invocation if you want the PR to stay manual permanently

After `/commit-push-pr` (doc PR), merge from GitHub UI.

## Related

- `.claude/rules/iterate-framework.md` — full `/iterate` contract, kill switches, escalation protocol
- `.claude/rules/gpt-co-generation.md` — when to fire GPT inside `/iterate` lanes
- `.claude/rules/build-discipline.md` — applies inside MCS automation, not Layer A code routing
