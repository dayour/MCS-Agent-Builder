#!/usr/bin/env bash
# new-session.sh — Create a git worktree for a parallel Claude session.
#
# Usage:
#   tools/new-session.sh <topic> [base-branch]
#
# Args:
#   topic        Required. Used for branch (`wt/<topic>`) and directory name.
#                Must match [a-zA-Z0-9_-]+.
#   base-branch  Optional. Defaults to "main".
#
# Behavior:
#   - Refuses if branch `wt/<topic>` already exists.
#   - Refuses if target path already exists.
#   - Creates worktree at ../Copilot-2-trees/<topic> with branch `wt/<topic>`.
#   - Prints copy-paste command to launch Claude in the new worktree.
#
# Exit codes:
#   0 success
#   2 bad usage / invalid topic
#   3 base branch not found
#   4 branch already exists
#   5 target path occupied
#   6 git worktree command failed

set -euo pipefail

TOPIC="${1:-}"
if [[ -z "$TOPIC" ]]; then
  echo "Usage: $0 <topic> [base-branch]" >&2
  echo "  Creates a git worktree at ../Copilot-2-trees/<topic> on a fresh branch wt/<topic>." >&2
  exit 2
fi

if ! [[ "$TOPIC" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo "topic must match [a-zA-Z0-9_-]+ (got: $TOPIC)" >&2
  exit 2
fi

BASE="${2:-main}"
BRANCH="wt/$TOPIC"

if ! git rev-parse --verify "$BASE" >/dev/null 2>&1; then
  echo "base branch '$BASE' not found in this repo" >&2
  exit 3
fi

if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  echo "branch '$BRANCH' already exists" >&2
  echo "  delete it:        git branch -D $BRANCH" >&2
  echo "  or pick another:  $0 <other-topic>" >&2
  exit 4
fi

ROOT="$(git rev-parse --show-toplevel)"
PARENT="$(dirname "$ROOT")"
TREES_DIR="$PARENT/Copilot-2-trees"
WT_PATH="$TREES_DIR/$TOPIC"

if [[ -e "$WT_PATH" ]]; then
  echo "target path already exists: $WT_PATH" >&2
  echo "  remove it or pick a different topic" >&2
  exit 5
fi

mkdir -p "$TREES_DIR"

if ! git worktree add -b "$BRANCH" "$WT_PATH" "$BASE"; then
  echo "git worktree add failed" >&2
  exit 6
fi

echo
echo "Worktree created."
echo "  path:   $WT_PATH"
echo "  branch: $BRANCH"
echo "  base:   $BASE"
echo
echo "Open Claude in the new worktree:"
echo "  cd \"$WT_PATH\" && claude"
echo
echo "List active worktrees: git worktree list"
echo "Tear down when done:   tools/end-session.sh $TOPIC"
