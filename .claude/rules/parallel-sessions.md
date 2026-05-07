# Parallel Sessions via Git Worktrees

When you need to work on more than one task at the same time, use a separate git worktree per Claude session — never run two Claude sessions against the same working directory. Multiple sessions in one directory share `HEAD`, so commits collide, untracked files mix, and lost work is the default outcome.

Worktrees give each session its own working directory while sharing the underlying `.git` repository. Branches are independent. Stashes are independent. Concurrent commits are safe.

## When to use a worktree

Open a worktree when any of these is true:
- The task will take more than ~2 hours and you may need to context-switch.
- You want to compare two approaches side-by-side without thrashing one branch.
- You're trying something risky (large refactor, dependency upgrade, schema change) and want a clean fallback.
- Another session is already running and you have new work to start.
- You're spawning a sub-agent that mutates shared files (see `agent-teams.md` — sub-agent worktree isolation).

Do **not** open a worktree for:
- Hotfixes you'll commit and push within minutes — branch on the main checkout.
- Reading or research tasks where no edits will happen.
- One-off command runs (tests, scripts, status checks).

## Naming convention

| Branch prefix | Use |
|---------------|-----|
| `wt/<topic>`  | Ephemeral worktree branches (this rule). Created by `new-session.sh`. |
| `feature/<name>` | Long-lived feature branches you may push to remote. |
| `fix/<name>`   | Bug fix branches destined for PR. |
| `main`         | Default base; never check it out into a worktree (worktree on main + main checkout = git refuses). |

`wt/<topic>` branches are not pushed to origin. They live until the worktree is torn down. Promote interesting work onto a feature branch before tearing down.

## Helper scripts

```bash
# Create a worktree at ../Copilot-2-trees/<topic> from main on branch wt/<topic>:
tools/new-session.sh <topic>

# Same, but base on a different branch:
tools/new-session.sh <topic> elevate-migration

# Tear down (refuses on uncommitted changes):
tools/end-session.sh <topic>

# Tear down and discard everything:
tools/end-session.sh <topic> --force --delete-branch
```

PowerShell equivalent: `tools\new-session.ps1 <topic>`. The shell script also runs in Git Bash on Windows.

## Per-session pattern

```
1. Decide the topic. Keep it short, kebab-case, descriptive: agentspec-eval-fix, frontend-nav-redo.
2. tools/new-session.sh <topic>      # creates worktree + branch
3. cd ../Copilot-2-trees/<topic>     # enter the new worktree
4. claude                             # start Claude in this worktree
5. Work, commit. Each commit lives only on wt/<topic>.
6. When ready to merge: rebase onto main, then either fast-forward main or open a PR.
7. tools/end-session.sh <topic>       # cleanup
```

The original session in `C:\Copilot 2\` is unaffected throughout.

## Sync workflow

Before merging a `wt/<topic>` branch:

```bash
# In the worktree
git fetch origin
git rebase origin/main      # resolve conflicts in the worktree
# Optional: run tests in the worktree
node tools/agentic-test-loop.js run --start-server

# Back in the main checkout
git merge --ff-only wt/<topic>     # fast-forward; refuses if not in sync
# OR
gh pr create                       # open a PR on origin
```

## Cleanup discipline

Worktrees consume disk space. Each is a full checkout of the codebase plus `node_modules` if you run `npm install`.

- Tear down with `tools/end-session.sh <topic>` when the branch merges or is abandoned.
- The SessionStart hook (`.claude/hooks/session-start.js`) prints active worktrees so you see what's outstanding.
- `git worktree list` is the source of truth.
- `git worktree prune` removes records of worktrees whose directories are gone (useful after a manual `rm -rf`).

## Sub-agent worktree isolation

When the lead spawns multiple sub-agents that all mutate shared files (Phase C of `/mcs-research`, Step 2-4 of `/mcs-build`), pass `isolation: "worktree"` on the Agent tool call. Each sub-agent then works in its own ephemeral worktree, the lead reads outputs sequentially, and merges to main. This prevents the long-standing class of issues where two teammates write to `agentspec.json` simultaneously.

See `agent-teams.md` for the merge protocol.

## Anti-patterns

- **Two Claude sessions on the same directory.** They will both edit and commit; one will lose work.
- **Worktree on `main`.** Git rejects it; always use a topic branch.
- **Editing `.git/` directly.** Worktrees share the `.git` directory; manual edits affect every session.
- **Long-lived `wt/*` branches.** They are meant to be ephemeral. If a worktree branch becomes a real feature, rename it (`git branch -m wt/foo feature/foo`) before promoting it.
- **Forgetting to clean up.** Half a dozen orphan worktrees is one bad week.
