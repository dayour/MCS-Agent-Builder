# Auto-Merge Denylist

Files matching any pattern below are **denylisted** from `/iterate` auto-merge. The orchestrator will run all verifiers and may open a PR, but it will refuse to call `gh pr merge --auto`. The PR is labeled `needs-human-review` and surfaced to the user for explicit merge decision.

This document is the **single source of truth**. The regexes are duplicated in `tools/iterate-orchestrator.js` (`DENYLIST_PATTERNS`) and `tools/auto-merge-gate.js` for runtime enforcement; if you edit one, edit the others. A test in `tools/__tests__/denylist-parity.test.js` keeps them in sync.

## Why these are denylisted

Each category represents changes whose blast radius exceeds what verification + facilitator review can reasonably catch in a single session. They warrant a human pause.

## Categories

### 1. Dependency / lockfile changes

```
^package\.json$
^package-lock\.json$
^yarn\.lock$
^pnpm-lock\.yaml$
(^|\/)package\.json$
(^|\/)package-lock\.json$
```

**Why:** dep upgrades introduce transitive risk that local tests rarely cover. Supply-chain attacks land here. Lockfile diffs can be 10K+ lines and obscure the actual change.

**Override path:** review the diff manually, run `npm audit`, then merge.

### 2. CI / GitHub workflows

```
^\.github\/workflows\/
^\.github\/actions\/
```

**Why:** workflow changes affect every future PR. A broken workflow can silently disable test gates or expose secrets.

**Override path:** test the workflow on a throwaway branch first, then merge.

### 3. Database migrations and schema

```
(^|\/)migrations\/
(^|\/)prisma\/schema\.prisma$
```

**Why:** migrations are non-reversible in production. The lane verifier doesn't run them against a real database.

**Override path:** run the migration locally + on staging, confirm reversibility plan, then merge.

### 4. Auth, secrets, credentials

```
(^|\/)auth(?:\/|\.|-)/i
[-_/]auth\.(?:js|ts|cjs|mjs|tsx)$/i
(^|\/)\.env
(^|\/)secrets?[-_./]/i
(^|\/)credentials?[-_./]/i
```

**Why:** auth changes are the highest-risk class of code. A subtle change can leak tokens, bypass MFA, or grant unintended access.

**Override path:** independent security review (`/security-review`), then merge.

### 5. Hook plumbing — the harness itself

```
^\.claude\/hooks\/
^\.claude\/settings\.json$
^\.claude\/settings\.local\.json$
^tools\/git-hooks\/
```

**Why:** changes to hooks alter the very system that's verifying the change. Recursive trust violation. A bad hook edit could disable all future verification.

**Override path:** test hooks in isolation, verify they don't break the auto-fire chain, then merge.

### 6. High-blast-radius LLM clients

```
^tools\/lib\/openai\.js$
^tools\/lib\/anthropic\.js$
```

**Why:** these clients are imported by every co-generation, review, and challenge call. A bug here corrupts every multi-model output silently.

**Override path:** confirm GPT challenge + Claude review still produce valid JSON on a representative prompt, then merge.

### 7. The /iterate machinery itself

```
^tools\/iterate-orchestrator\.js$
^tools\/auto-merge-gate\.js$
^tools\/oracle-runner\.js$
^tools\/backend-verify\.js$
^tools\/agentic-test-loop\.js$
^\.claude\/skills\/iterate\/
^\.claude\/skills\/mcs-iterate\/
^\.claude\/rules\/iterate-framework\.md$
^knowledge\/frameworks\/auto-merge-denylist\.md$
```

**Why:** changes to the orchestrator that's deciding to auto-merge create a recursive trust problem. A bug here could green-light any subsequent change.

**Override path:** smoke-test the full /iterate flow (smokes 1–4 in `iterate-framework.md`), confirm hash-chain stays valid, then merge.

## How matches are computed

A file matches the denylist if **any** regex matches its repo-relative path with forward slashes (POSIX-style). The orchestrator normalizes Windows backslashes before testing.

```bash
# Manual check from the CLI:
node tools/iterate-orchestrator.js classify
# Look for `denylist.matches[]` and `denylist.autoMergeAllowed: false`.
```

## What is NOT on the denylist (and why)

These are intentionally **mergeable** without human review when all gates pass:

- Frontend source under `app/frontend/src/` — covered by Playwright + oracle pass.
- Backend libs under `app/lib/` and `tools/` — covered by `backend-verify` (contracts + types + unit + smoke).
- E2E test files under `app/frontend/e2e/` — adding coverage is encouraged.
- Docs (`README.md`, `docs/`, `knowledge/learnings/*.md`, etc.) — text changes have low blast radius.
- Config under `app/frontend/` other than `package*.json` — local config, not lockfile.
- Topic YAML and adaptive cards under `Build-Guides/*/topics/` — Layer B, has its own gates via `/mcs-eval`.

If you find a non-denylisted change that should be denylisted (e.g., a new file pattern that has hidden blast radius), open a PR adding the regex here and to `tools/iterate-orchestrator.js`. That PR will itself be denylisted via category 7, requiring human review — exactly the meta-property we want.

## Threat model

The denylist is **not** RBAC. It's a tripwire. Anyone who can edit `iterate-orchestrator.js` can also edit this file. The hash-chained audit log at `knowledge/learnings/iterate-audit.jsonl` is the post-hoc detection: if someone smuggles a denylisted change through, the audit shows the orchestrator green-lighted it; the PR diff shows the denylist edit; tampering becomes auditable.

## Kill switches

In addition to the denylist, /iterate respects:

| Switch | Effect |
|--------|--------|
| `--no-auto-merge` flag (per-invocation) | Skip auto-merge for this run only. PR opens, user merges manually. |
| `CLAUDE_OFF_AUTO_MERGE=1` env var | Disable auto-merge for the entire session (and any sub-agents). |
| Per-session cap (3 auto-merges) | After 3 auto-merges in one /iterate session, the gate refuses further merges. Reset by ending the session. |
| Cooldown (5 minutes) | At least 5 minutes must elapse since the last auto-merge before the next one fires. |
| `needs-human-review` label on the PR | Gate refuses if this label is applied. Lead can apply it voluntarily. |
| Branch protection | If `main` requires CI green and the CI is red or pending, `gh pr merge --auto` waits — this is the GitHub-side guardrail. |
