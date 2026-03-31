---
name: mcs-deploy
description: "Use this skill to promote a published agent from dev to prod. Two modes: agent-level (fast, replicate-agent.js) and solution-level (PAC CLI export/import, ALM-ready). Includes pre-deploy validation, connection mapping, post-deploy smoke test, and auto-rollback on failure. Use after /mcs-build when the agent is ready for production."
---

# MCS Deployment — Cross-Environment Agent Promotion

Deploy a built and published agent from a source (dev) environment to a target (prod) environment. Two deployment modes cover different ALM needs.

## Build Discipline

This skill has EIGHT separate sub-tasks. Each must be tracked and verified independently per `.claude/rules/build-discipline.md`.

| Sub-task | How to verify |
|----------|--------------|
| Pre-deploy validation | Validation report printed |
| Mode selection | Mode logged |
| Deploy | Target bot ID returned |
| Connection mapping | Report generated |
| Publish in target | Publish timestamp returned |
| Smoke test | Pass/fail result |
| Rollback (if smoke fails) | Target agent unpublished |
| Write deployStatus | Read brief.json back |

## Input

```
/mcs-deploy {projectId} {agentId}                    # Auto-detect mode
/mcs-deploy {projectId} {agentId} --mode solution    # Force solution-level
/mcs-deploy {projectId} {agentId} --mode agent       # Force agent-level
/mcs-deploy {projectId} {agentId} --skip-smoke       # Skip post-deploy smoke test
```

Reads from: `Build-Guides/{projectId}/agents/{agentId}/brief.json`
Writes to: `brief.json` (deployStatus), `deployment-report.md`

## Prerequisites (3 Gates)

### Gate 1: Build Status
`buildStatus.status` must be `"published"`. If not → **STOP.**

### Gate 2: Eval Scores (Soft Gate)
- Boundaries < 100% → **WARN** (not hard stop)
- Quality < target → **WARN**
- No eval results → **WARN**

### Gate 3: Dual Auth
Deploy requires auth to BOTH source and target environments.

1. **Source auth** — verify existing from build (Azure CLI tenant match + PAC CLI profile)
2. **Target auth** — ask user for target environment. Persist to `deployStatus.targetEnvironment`. If different tenant → need separate auth.

## Step 0: Mode Auto-Detection

| Condition | Mode | Reason |
|-----------|------|--------|
| Multi-agent | `solution` | All components in one package |
| Connected agents (external) | `agent` | Only main agent needs deploying |
| Agent in named solution | `solution` | Solution ALM preserves relationships |
| Single agent, default solution | `agent` | Faster, simpler |

**Precedence (first match wins):** multi-agent → named solution → connected agents → single agent default. User can override with `--mode`.

## Step 1: Pre-Deploy Validation

1. **Component inventory:** Pull workspace via `mcs-lsp.js pull`, count topics/tools/knowledge/model.
2. **Env-specific value scan:** Grep workspace for hardcoded URLs, env variables, connection ref IDs, tenant IDs. Flag any found.
3. **Validation report:** Print summary with build status, eval scores, components, env-specific values, mode.

## Step 2a: Agent Mode Deploy

```bash
node tools/replicate-agent.js \
  --source-env "{sourceEnvUrl}" --target-env "{targetEnvUrl}" \
  --bot-id "{sourceBotId}" --bot-name "{agentName}"
```

Creates new bot in target from the **published** agent state (not the current workspace draft). **VERIFY:** returns target bot ID. If `buildStatus.status` is not `"published"`, Gate 1 already blocked — but double-check the source agent is published before cloning.

## Step 2b: Solution Mode Deploy

```bash
# Export from source
pac solution export --name "{solutionName}" --path ".../{solutionName}.zip" --managed --overwrite --async

# Switch to target
pac auth select --index {targetProfileIndex}

# Import to target
pac solution import --path ".../{solutionName}.zip" --publish-changes --activate-plugins --async
```

**VERIFY:** `pac solution list` in target shows the solution. **Always switch PAC CLI back to source** after.

## Step 3: Connection Mapping Report

Generate a checklist for tools/connectors needing manual reconnection:

| Auth Method | Action Needed |
|-------------|---------------|
| MCP (service principal) | Re-authenticate in target MCS |
| OAuth connectors | User sign in via MCS UI |
| API key connectors | Re-enter key in target |
| Dataverse (same tenant) | Auto-connects |
| Dataverse (cross-tenant) | Configure service principal |

For connected agents: list setup steps (must exist independently in target).

## Step 4: Publish in Target

Agent mode: Dataverse `PvaPublish` on target bot ID, or `pac copilot publish --bot "{targetBotId}"`.
Solution mode: Already published via `--publish-changes`. Verify with `pac copilot list`.

## Step 5: Post-Deploy Smoke Test

Unless `--skip-smoke`: run boundaries eval set against target agent via Direct Line. If token not available → skip with note. Results: all pass → `"pass"`, any fail → `"fail"`.

## Step 5.5: Rollback on Smoke Failure

If smoke test fails → auto-unpublish target (non-negotiable safety measure), then offer rollback options. See `reference/rollback-procedure.md` for the full procedure.

## Step 6: Write deployStatus

```json
{
  "deployStatus": {
    "status": "deployed",
    "mode": "agent",
    "targetEnvironment": "Production (org456)",
    "targetBotId": "abc-123-def",
    "deployedAt": "2026-03-04T14:30:00Z",
    "smokeTestResult": "pass",
    "connectionsMapped": false
  }
}
```

Skip if rollback already wrote status. **VERIFY:** Read brief.json back.

## Step 7: Generate Deployment Report

Write `deployment-report.md` with: pre-deploy validation, deployment summary, connection mapping checklist, smoke test results, next steps. Fire GPT review (`review-code`) on the report — catches incomplete connection mapping and missing checklist items.

## Error Handling

| Error | Action |
|-------|--------|
| `replicate-agent.js` fails | Check target env permissions. Try solution mode fallback. |
| Solution import: missing dependency | List missing deps. Ask user to install in target. |
| Solution import: version conflict | Ask user: upgrade or import as new? |
| Publish fails in target | Check connection mapping. |
| Smoke test fails | Auto-rollback (Step 5.5). |

## Gotchas

- **Never deploy without 3 gates passing** — skipping gates risks deploying broken agents
- **Connection mapping always generated** — even if no manual steps needed (IT admins rely on this)
- **Smoke test failure triggers auto-unpublish** — non-negotiable, then user chooses further rollback
- **No teammates needed** — lead-only execution skill
- **Never auto-delete the source agent** — that's a user decision with no undo
