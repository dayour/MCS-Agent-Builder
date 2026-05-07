---
name: mcs-iterate
description: "Use this skill to autonomously build, evaluate, and fix an MCS agent until it reaches SHIP verdict. Composite of /mcs-build → /mcs-eval → /mcs-fix → re-eval, max 3 fix cycles per agent. Reuses the iterate-orchestrator audit + verdict primitives. Use after /mcs-research when agentspec.json is ready and the user wants the agent shipped without manual phase transitions. Use when the user says 'ship it', 'iterate to SHIP', 'build and evaluate this agent', or to resume a partially-built agent. Notify user only on SHIP verdict, BLOCK verdict, or when fix cycles are exhausted."
---

# /mcs-iterate — Autonomous MCS Build → Eval → Fix Loop (Layer B)

Single command for fully-autonomous MCS agent shipping. Runs the full Build-Guides flow without manual phase transitions: build the agent, run evals, classify failures, apply fixes, re-eval, loop until SHIP or hard cap.

This is the Layer B counterpart to `/iterate`. It does NOT touch Layer A code (frontend/backend/framework). It only iterates on the MCS agent state via the existing `/mcs-*` skills, reusing the iterate-orchestrator's audit + verdict primitives where appropriate.

## When to fire

- User typed `/mcs-iterate {projectId} {agentId}`.
- User said "ship the agent", "iterate to SHIP", "build, eval, fix until ready".
- After `/mcs-research` produced a complete agentspec.json and the user wants the agent shipped autonomously.
- To resume a partial build where `agentspec.json.buildStatus` shows incomplete steps and `evalConfig.lastVerdict` is BLOCK or ITERATE.

## When NOT to fire

- The agentspec.json is incomplete — run `/mcs-research` first.
- The user wants to manually review between phases — run `/mcs-build`, `/mcs-eval`, `/mcs-fix` separately.
- The agent doesn't have eval sets defined — run `/mcs-research` Phase C first.
- `evalConfig.skipGate` is true — that's the manual override path; don't auto-iterate over it.

## Input

```
/mcs-iterate {projectId} {agentId}                      # default: max 3 fix cycles, SHIP gate enforced
/mcs-iterate {projectId} {agentId} --max-cycles 5       # raise the cap
/mcs-iterate {projectId} {agentId} --skip-build         # skip /mcs-build (resume from eval)
/mcs-iterate {projectId} {agentId} --eval-only          # eval + fix loop only, no rebuild
```

Reads from + writes to:
- `Build-Guides/{projectId}/agents/{agentId}/agentspec.json` — single source of truth.
- `knowledge/learnings/iterate-audit.jsonl` — hash-chained audit (per cycle).

## Phased execution

### Phase 0 — Boundary check + session create

```bash
node tools/iterate-orchestrator.js classify
```

If any non-agentspec lane is non-empty (frontend/backend/framework changes), **refuse** and tell the user: "Layer A changes detected — run `/iterate` first or commit those, then re-run `/mcs-iterate`." This skill is Layer B only.

If `Build-Guides/{projectId}/agents/{agentId}/agentspec.json` is the only relevant change (or the agent has no working-tree changes but is mid-build), proceed.

```bash
node tools/iterate-orchestrator.js session-create --reason "/mcs-iterate {project}/{agent}"
```

### Phase 1 — Build (skip if `--skip-build` or `--eval-only`)

Invoke `/mcs-build {projectId} {agentId}` skill via Skill tool. This handles its own internal verify-after-each-step gates. On `##BUILD_COMPLETE##`, parse the buildStatus.

If build fails irrecoverably (e.g., auth failure, missing connection), **escalate** — `/mcs-iterate` cannot fix env-level issues automatically.

Append audit:

```bash
node tools/iterate-orchestrator.js audit-append \
  --event "mcs-iterate-build-complete" \
  --data '{"projectId":"<p>","agentId":"<a>","buildStatus":"<status>"}'
```

### Phase 2 — Eval

Invoke `/mcs-eval {projectId} {agentId}` skill. Reads agentspec, runs eval sets, writes per-test results to `evalSets[].tests[].lastResult`. Eval-guide plugin computes verdict.

Read the verdict from agentspec.json `evalConfig.lastVerdict`:

- `SHIP` → done. Skip to Phase 4 (publish + notify).
- `SHIP WITH KNOWN GAPS` → done with caveat. Phase 4, but include caveats in the notification.
- `ITERATE` → Phase 3 (fix cycle).
- `BLOCK` → Phase 3 (fix cycle), but flag this as elevated risk.

Append audit:

```bash
node tools/iterate-orchestrator.js audit-append \
  --event "mcs-iterate-eval-complete" \
  --data '{"projectId":"<p>","agentId":"<a>","verdict":"<verdict>","passRate":<pct>,"cycle":<n>}'
```

### Phase 3 — Fix (per cycle, max 3)

Invoke `/mcs-fix {projectId} {agentId}` skill. It classifies failures (instruction gaps, boundary violations, routing failures, knowledge gaps, scoring issues, decision mismatches), applies targeted fixes via PE/TE, then re-evaluates internally.

`/mcs-fix` already calls `/mcs-eval` at the end of its own flow. Read the new verdict from agentspec.json.

If verdict moved to SHIP / SHIP WITH KNOWN GAPS → Phase 4.
If verdict is still ITERATE/BLOCK and cycle < `maxCycles` → run another Phase 3 cycle.
If cycle >= `maxCycles` → escalate.

Per cycle, append audit:

```bash
node tools/iterate-orchestrator.js audit-append \
  --event "mcs-iterate-fix-cycle" \
  --data '{"projectId":"<p>","agentId":"<a>","cycle":<n>,"verdictBefore":"<v1>","verdictAfter":"<v2>","fixesApplied":<count>}'
```

### Phase 4 — Publish + notify

If verdict is SHIP or SHIP WITH KNOWN GAPS, the eval-as-publish gate (already wired in `app/lib/eval-gate-audit.js`) promotes the agent state from `published-internal` → `published-uat`. The /mcs-eval skill handles this via `npm run smoke:eval-gate:via-gate`.

Confirm promotion via `agentspec.json.buildStatus`:
- `published-internal` → not promoted yet (rare; usually means the eval-gate hit a manual override or a config issue). Surface to user.
- `published-uat` → success.

Append final audit:

```bash
node tools/iterate-orchestrator.js audit-append \
  --event "mcs-iterate-shipped" \
  --data '{"projectId":"<p>","agentId":"<a>","verdict":"<v>","cyclesUsed":<n>,"durationMs":<ms>}'
```

Then clear the session:

```bash
node tools/iterate-orchestrator.js session-clear
```

Notify user with a 1-2 sentence summary: agent name, verdict, # cycles used, link to `/mcs-report`.

### Phase 5 — Escalation

Fire when:
- Build fails on env-level issue (auth, connection, model not available).
- Eval verdict is BLOCK and no clear fix path emerged after `maxCycles`.
- `/mcs-fix` returns "no fixable failures" but verdict is still ITERATE/BLOCK.
- `evalConfig.skipGate` is set externally during the run.

Update session: `session-update --state escalated --reason "<text>"`.

Append audit:

```bash
node tools/iterate-orchestrator.js audit-append \
  --event "mcs-iterate-escalate" \
  --data '{"projectId":"<p>","agentId":"<a>","cyclesUsed":<n>,"finalVerdict":"<v>","reason":"<text>"}'
```

Surface to user with concrete next-step suggestions:
- For instruction-gap failures: re-run `/mcs-research` to enrich.
- For knowledge-gap failures: add knowledge sources, then re-run `/mcs-iterate --eval-only`.
- For boundary failures: surface the failing tests and ask the user whether to update boundaries or update the eval expectations.

## Hard rules

1. **One agent per `/mcs-iterate` call.** This skill does NOT iterate over multiple agents in one invocation. For a multi-agent project, run `/mcs-iterate {project} {agent}` per agent in separate calls.
2. **Cap at 3 fix cycles by default.** After 3 cycles without SHIP, escalate. Configurable via `--max-cycles`.
3. **Layer A unchanged.** This skill does not edit application code. If Layer A files appear in `git status`, refuse with "run /iterate first".
4. **The eval-as-publish gate stays sacred.** SHIP verdict + non-bypassed eval gate is the only path to `published-uat`. `--skip-gate` is NOT a valid flag for `/mcs-iterate` — manual override requires editing `evalConfig.skipGate*` in agentspec and using `npm run smoke:eval-gate:via-gate` directly.
5. **Audit every transition.** Every Phase end logs to `iterate-audit.jsonl`.

## See also

- `.claude/skills/mcs-build/SKILL.md`
- `.claude/skills/mcs-eval/SKILL.md`
- `.claude/skills/mcs-fix/SKILL.md`
- `.claude/rules/iterate-framework.md` (autonomy contract — the same audit + escalation patterns apply here)
- `knowledge/frameworks/publish-state-matrix.md` (eval-as-publish gate states)
- `tools/iterate-orchestrator.js` (audit + session primitives reused here)
