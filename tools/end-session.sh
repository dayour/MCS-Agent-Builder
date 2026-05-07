#!/usr/bin/env bash
# end-session.sh — Remove a worktree created by new-session.sh.
#
# Usage:
#   tools/end-session.sh <topic> [--force] [--delete-branch]
#
# Args:
#   topic            Required. The topic passed to new-session.sh.
#   --force          Discard uncommitted/untracked changes in the worktree.
#   --delete-branch  Also delete the wt/<topic> branch after removal.
#
# Default behavior is conservative: refuses to remove if there are uncommitted
# changes or untracked files. Branch is preserved unless --delete-branch given.

set -euo pipefail

TOPIC="${1:-}"
if [[ -z "$TOPIC" ]]; then
  echo "Usage: $0 <topic> [--force] [--delete-branch]" >&2
  exit 2
fi

FORCE=""
DELETE_BRANCH=""
shift || true
for arg in "$@"; do
  case "$arg" in
    --force)         FORCE="--force" ;;
    --delete-branch) DELETE_BRANCH="1" ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

ROOT="$(git rev-parse --show-toplevel)"
PARENT="$(dirname "$ROOT")"
WT_PATH="$PARENT/Copilot-2-trees/$TOPIC"
BRANCH="wt/$TOPIC"

if [[ ! -e "$WT_PATH" ]]; then
  echo "worktree path not found: $WT_PATH"
  echo "(nothing to remove)"
  exit 0
fi

if [[ -z "$FORCE" ]]; then
  if ! git -C "$WT_PATH" diff --quiet || ! git -C "$WT_PATH" diff --cached --quiet; then
    echo "uncommitted changes in $WT_PATH" >&2
    git -C "$WT_PATH" status --short >&2
    echo >&2
    echo "commit, stash, or re-run with --force to discard" >&2
    exit 6
  fi
  UNTRACKED="$(git -C "$WT_PATH" ls-files --others --exclude-standard | head -10 || true)"
  if [[ -n "$UNTRACKED" ]]; then
    echo "untracked files in $WT_PATH:" >&2
    echo "$UNTRACKED" >&2
    echo >&2
    echo "add/commit, delete, or re-run with --force to discard" >&2
    exit 7
  fi
fi

git worktree remove $FORCE "$WT_PATH"
echo "removed worktree: $WT_PATH"

if [[ -n "$DELETE_BRANCH" ]]; then
  if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
    git branch -D "$BRANCH"
    echo "deleted branch:   $BRANCH"
  fi
else
  echo "branch preserved: $BRANCH (delete with: git branch -D $BRANCH)"
fi
