# Live smoke — eval-gate end-to-end runbook

This runbook completes the end-to-end verification that the fixture-based
integration tests (`app/lib/__tests__/build-pipeline-eval-gate.test.js`)
cannot cover: real Azure auth, real Direct Line token acquisition, real
Dataverse / Gateway round-trips, real state persistence.

Per GPT review 2026-04-17, the "end-to-end" label does not apply until a
human has executed this runbook and attached evidence.

## Prerequisites

1. **Active `az login`** in the tenant that owns the target environment
   ```bash
   az account show --output json
   ```
   Inspect `tenantId` and `name` — they must match your target.

2. **Target agent already published** in `published-internal` state (or
   legacy `published`). Find one:
   ```bash
   node tools/backfill-published-status.js
   ```

3. **Non-prod confirmation**. Live smoke modifies `agentspec.json` on disk
   and sends real Direct Line messages to a real MCS agent. Do NOT point
   it at a production tenant.

## Step 1 — Preflight only

Verify your environment is ready without making any calls:

```bash
node tools/live-smoke-eval-gate.js --preflight-only --project <project> --agent <agent>
```

Expect all checks to pass:

- `[PASS] az CLI installed`
- `[PASS] az login active — <your-email> on <subscription> (tenant xxxxxxxx...)`
- `[PASS] project + agent args`
- `[PASS] agentspec.json exists / parseable`
- `[PASS] agent is published`
- `[PASS] buildStatus has required fields`
- `[PASS] non-prod target`

Evidence written to `tools/live-smoke-evidence/smoke-<timestamp>.json`.

## Step 2 — Preview

See what would happen without actually running the pipeline:

```bash
node tools/live-smoke-eval-gate.js --project <project> --agent <agent>
```

Inspect the printed target. Confirm the bot ID and dataverse URL match
the throwaway agent you intended.

## Step 3 — Live execute

```bash
node tools/live-smoke-eval-gate.js --project <project> --agent <agent> --confirm
```

What happens:

1. Preflight re-runs (all checks must pass again).
2. `eval-pipeline.runEvalForBuild()` is invoked with the agent's `evalConfig`.
3. Direct Line token is acquired against the MCS agent.
4. Every defined eval test is sent as a chat message, response recorded.
5. Responses are scored per the configured methods.
6. Per-test `lastResult` is written back to `agentspec.json`.
7. Verdict (SHIP / ITERATE / BLOCK) is computed and stored in
   `evalConfig.lastVerdict`.
8. If verdict == SHIP AND the agent was `published-internal`, the build
   pipeline's `stepEvalGate` would promote it to `published-uat`. Note:
   live-smoke invokes eval pipeline directly (no stepEvalGate), so
   status promotion is NOT automatic in this script. To exercise
   promotion, re-run `/mcs-build` or have a fuller pipeline re-run.

Evidence JSON captures state before + after. Attach to the tracking ticket.

## Recommended target agents

These 7 agents have been backfilled to `published-internal` and have
eval tests defined but never run — ideal smoke targets:

| project | agent | tests defined |
|---|---|---:|
| CDW | account-prospecting | 62 |
| CDW | legal-hr-policy-advisor | 62 |
| E2E-Benefits-Buddy | Benefits-Buddy | 33 |
| E2E-Test | it-ops-assistant | 15 |
| MNP | assurance-memo-drafting | 31 |
| MNP | skills-and-knowledge | 30 |
| MNP | time-entry | 30 |

Start with **E2E-Test/it-ops-assistant** (smallest set, freshest build).

## Known limitations

1. **Status promotion requires full pipeline.** This script exercises the
   eval pipeline only, not `stepEvalGate`. After live-smoke writes a
   verdict, run `/mcs-build` again to exercise the gate's promotion path.
2. **Non-prod detection is heuristic.** Pattern matches `.prod.`,
   `prodcopilot`, `contoso-prod`. Does not guarantee the target isn't
   customer-facing. Human judgment required.
3. **No cleanup.** Evidence files accumulate under
   `tools/live-smoke-evidence/`. Gitignored but not auto-pruned.
4. **No rollback.** If the live execution corrupts `agentspec.json`
   somehow, restore from git: `git checkout HEAD -- Build-Guides/<path>`.

## Evidence format

```json
{
  "startedAt": "2026-04-17T...",
  "steps": [...preflight results...],
  "preflight": {
    "identity": { "user": "...", "tenantId": "...", "subscriptionName": "..." },
    "target": { "project": "...", "agent": "...", "botId": "...", "currentStatus": "..." }
  },
  "stateBefore": { "status": "...", "testsWithResults": 0 },
  "stateAfter":  { "status": "...", "testsWithResults": 15 },
  "verdict": { "verdict": "SHIP|ITERATE|BLOCK", "reason": "...", "overallRate": 87 },
  "result": { "ok": true, "mode": "live-execute", "verdict": "SHIP" }
}
```

Attach this file to the PR / ticket that claims eval-gate end-to-end
verified. That is how we close the loop GPT flagged.

## Gitignore

The evidence directory is gitignored to keep credentials, real bot IDs,
and tenant-specific URLs out of commits. Review evidence locally only.
