# Rollback on Smoke Test Failure

If the smoke test fails (`smokeTestResult: "fail"`), automatically execute rollback to prevent a broken agent from being live in the target environment.

## 1. Unpublish the target agent (immediate -- always runs)

**Agent mode:** Use the target bot ID from Step 2a.
**Solution mode:** Resolve the target bot ID from `pac copilot list` in the target environment (match by agent name from brief.json).

```bash
# Unpublish via Dataverse PATCH (primary method)
# Endpoint: PATCH {targetDataverseUrl}/api/data/v9.2/bots({targetBotId})
# Body: { "statecode": 0, "statuscode": 0 }

# Fallback: PvaUnpublish bound action if PATCH fails
```

**If unpublish fails:** retry once. If still fails, log the exact error, set `deployStatus.status: "rollback-partial"`, record `lastDeployError`, and instruct the user: "Could not unpublish target agent -- manually disable access in MCS UI immediately."

## 2. Offer full rollback (user choice -- never auto-delete)

Present the rollback options based on deployment mode:

**Agent mode rollback:**
```
Smoke test FAILED -- {N}/{M} boundaries tests failed in target.
Target agent has been unpublished (not accessible to users).

Rollback options:
  [1] Keep unpublished -- investigate and fix in target (default)
  [2] Delete target agent -- remove entirely, redeploy later
  [3] Re-deploy from source -- fresh replicate-agent.js run

Choose [1/2/3]:
```

**Solution mode rollback:**
```
Smoke test FAILED -- {N}/{M} boundaries tests failed in target.
Target agent has been unpublished (not accessible to users).

Rollback options:
  [1] Keep unpublished -- investigate and fix in target (default)
  [2] Uninstall solution -- pac solution delete in target, clean slate
  [3] Re-import from source -- fresh solution import

Choose [1/2/3]:
```

## 3. Execute chosen rollback

| Option | Agent Mode | Solution Mode |
|--------|-----------|---------------|
| **Keep (1)** | No action -- agent stays unpublished in target | No action -- solution stays, agent unpublished |
| **Delete (2)** | `tools/dataverse-helper.ps1` DELETE bot in target | `pac solution delete --solution-name {name}` in target env |
| **Re-deploy (3)** | Re-run Step 2a (replicate-agent.js) | Re-run Step 2b (export/import) |

After re-deploy (option 3): re-run smoke test automatically. If it fails again -> stop and escalate: "Re-deploy also failed smoke test. Manual investigation required."

## 4. Write rollback status

Update `brief.json.deployStatus`:
```json
{
  "deployStatus": {
    "status": "rolled-back",
    "rollback": {
      "reason": "smoke-test-failure",
      "failedTests": ["test question 1", "test question 2"],
      "action": "unpublished",
      "rolledBackAt": "2026-03-04T14:45:00Z"
    }
  }
}
```

**VERIFY:** Target agent is unpublished (Dataverse read-back confirms draft status). Rollback action recorded in brief.json.

**Skip rollback if:** `--skip-smoke` was used (no smoke test = no rollback trigger), or user explicitly opts out.
