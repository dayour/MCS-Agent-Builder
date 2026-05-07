---
name: mcs-pipeline-test
description: "Use this skill to run the MCS build pipeline verify-fix harness against the canonical kitchen-sink agent. The harness reads back every component from MCS via API, classifies any drift against a fixed taxonomy, and auto-applies fixes for confirmed classifications. Use when validating the build pipeline end-to-end, after touching tools/mcs-lsp.js, tools/island-client.js, tools/add-tool.js, or app/lib/build-runner.js, or when component pushes are silent-failing in real builds."
---

# MCS Pipeline Verify-Fix Harness

Builds the canonical "kitchen-sink" test agent in the **dktest** environment, reads back every component from MCS, and iterates fix → verify until all verifiable components match the spec. Wraps `/mcs-build`; does not replace it.

This skill is the entry point for the harness. The runner that drives the loop is `tools/pipeline-test-loop.js`. The verifier library is `tools/verify-component.js`. Failure taxonomy lives in `tools/pipeline-classifications.js`. Fix planner lives in `tools/pipeline-fix-map.js`.

**Smoke-phase coverage** (current): only `verifyTopic` is wired live. Other component verifiers return `status: 'skipped'` and surface as "not yet implemented." Each iteration of harness work expands one verifier at a time. When a verifier ships, its corresponding classification becomes auto-fix-eligible if `pipeline-fix-map.js` lists it as `type: 'auto'`.

**Out of scope for this skill**: building real customer agents (use `/mcs-build`), evaluating an agent's behavior (use `/mcs-eval`), and Playwright UI snapshots of the MCS portal (deliberately not implemented — see plan).

---

## Pre-flight

Before invoking the runner, confirm the local environment is set up correctly. These checks are fast and prevent wasted iteration on auth/wrong-env issues:

1. **Azure CLI tenant**:
   ```bash
   az account show --query "tenantId,user.name" -o tsv
   ```
   Expected tenant matches the `_environment.tenant` field in `Build-Guides/_pipeline-test/agents/canonical/agentspec.json` (currently `M365CPI15209943`). If not, run `az login --tenant <tenant>`.

2. **PAC CLI environment** (best-effort — Dataverse fallback covers PAC failures):
   ```bash
   pac org list
   ```
   Expected to show the env with org id matching `_environment.orgId` (currently `org04723bf3` / `dktest`). If PAC is misaligned, you can still proceed — the runner uses Dataverse direct.

3. **Workspace existence**:
   The runner needs a cloned MCS workspace at `Build-Guides/_pipeline-test/agents/canonical/workspace/` with `.mcs/conn.json`. If absent, run `/mcs-build _pipeline-test canonical` first to create the agent and clone it.

4. **No background mcs-lsp running**:
   ```bash
   tasklist | grep -i lsp
   ```
   Concurrent LSP processes cause `ConcurrencyVersionMismatch`. Stop any stragglers before running.

If a check fails, stop and surface the issue to the user — do not retry blindly.

---

## Run the loop

Single iteration:

```bash
npm run pipeline:run -- --workspace "Build-Guides/_pipeline-test/agents/canonical/workspace" --note "<what changed since last run>"
```

The runner prints structured JSON to stdout and appends one entry to `tools/pipeline-log.jsonl`.

Read the JSON `recommendation` field — it tells you the next action:

- **`All verifiable components match the spec.`** — green, loop is done.
- **`Auto-fix applied for <classification>. Re-run pipeline:run to verify.`** — re-invoke `npm run pipeline:run` with the same args.
- **`Escalate <classification>: <reason>`** — surface the classification + reason to the user; do not auto-retry.
- **`Same classifications failed N+ iterations.`** — stalled, escalate.

Hard stops (advisory; the runner does not loop on its own):
- `iteration >= 10` (`MAX_ITERATIONS` in `tools/pipeline-test-loop.js`)
- `trend === 'stalled'` (same classification set 3 consecutive iterations)
- Unknown classification — fix-map needs a new entry

Inspect history any time:

```bash
npm run pipeline:status
```

Inspect the latest run's failures with full evidence:

```bash
npm run pipeline:failures
```

Reset between independent harness sessions:

```bash
npm run pipeline:reset
```

---

## Reporting

After a run sequence concludes (green or escalated), write a summary to `Build-Guides/_pipeline-test/agents/canonical/pipeline-report.md` covering:

- Date + git SHA of the run
- Final status (green / escalated / stalled)
- Per-classification disposition: which auto-resolved, which escalated, which never surfaced
- Fix-map entries that need executor implementation (anything currently `type: 'escalate'` that should be `type: 'auto'`)
- Verifier coverage gap: which component classes are still `skipped` (not yet implemented)

This report is the per-session artifact — it shows what the harness proved out and what is still on the to-do list.

---

## Failure handling

If the runner crashes (returns `status: 'error'` in stdout JSON), do not retry blindly. Read the `error` and `stack` fields.

Common causes:

- **`No .mcs/conn.json under <path>`** — workspace not cloned. Run `/mcs-build _pipeline-test canonical` first, or `node tools/mcs-lsp.js clone` against an existing agent.
- **`Failed to get token`** — `az login` expired. Run `az login --tenant M365CPI15209943` and retry.
- **`fetchDialogComponents HTTP 401`** — Dataverse token rejected. Confirm the env id in conn.json matches the env behind `_environment.dataverseUrl`.
- **`Verifier crashed`** — bug in `tools/verify-component.js`. Capture the stack, file an issue, do not retry against MCS.

For escalations (non-auto fix), present the classification's `summary`, `learning`, and `reason` from `tools/pipeline-fix-map.js` to the user and ask how to proceed. Do not silently skip.

---

## Adding a new verifier

When you ship a new verifier (say `verifyKnowledge`):

1. Replace the `verifyKnowledge` stub in `tools/verify-component.js` with a real implementation. Pattern: paired query (Dataverse + Gateway when both exist), classify with a pure helper, return `VerifyResult`.
2. Confirm the relevant classification IDs already exist in `tools/pipeline-classifications.js`. If a new failure mode emerged, add a new ID with a `learning` ref.
3. Update `tools/pipeline-fix-map.js`:
   - If the fix is reversible and reuses an existing helper (mcs-lsp / island-client / add-tool), set `type: 'auto'`.
   - If the fix is destructive or executor missing, leave `type: 'escalate'` with a clear `reason`.
4. Run `npm run pipeline:run` against the canonical workspace. Expect first iteration to surface the new classification, second iteration to either auto-fix or escalate cleanly.
5. Append a row to `pipeline-report.md`.

Do not modify `/mcs-build` SKILL.md to call the new verifier in this PR — wiring real builds to the verifier library is a separate, follow-up change once the harness is green.
