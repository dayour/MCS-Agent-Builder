---
name: mcs-guard
description: "Use this skill before /mcs-build to validate all prerequisites. Checks Azure CLI auth, environment reachability, PAC CLI, required connections, knowledge sources, tools, and model availability. Catches failures that would waste build time. Use proactively before any build, or when auth/environment issues are suspected."
user_invocable: true
---

# MCS Guard — Pre-Build Validation

Validate all prerequisites before `mcs-build` starts. Catches auth failures, missing connections, unreachable knowledge sources, and model gaps that would otherwise waste 5-10 minutes of build time.

## When to Run

| Trigger | Why |
|---------|-----|
| Before `mcs-build` | Primary — catch blockers before build time is wasted |
| Before `mcs-deploy` | Re-verify target env readiness |
| On-demand | After credential refresh, env switch, or brief updates |

Recommended workflow position: `research → **guard** → build → eval`

## Input

```
/mcs-guard {projectId} {agentId}              # Full preflight
/mcs-guard {projectId} {agentId} --quick      # Auth + env only (skip connection/knowledge checks)
```

Reads from:
- `Build-Guides/{projectId}/agents/{agentId}/brief.json` — integrations, tools, knowledge, model config, architecture

Writes to:
- `Build-Guides/{projectId}/agents/{agentId}/brief.json` — `guardReport` field

## Checks (7 checks, run in order)

Each check produces `pass`, `warn`, `fail`, or `skipped` (when a dependency check failed). Evidence is recorded for every result.

### Check 1: Azure CLI Auth

**Validates:** Current Azure CLI session is authenticated to the correct tenant.

**How:**
```bash
az account show --query "{user:user.name, tenant:tenantId}" -o json
```
Then acquire Dataverse token:
```bash
az account get-access-token --resource https://{org}.crm.dynamics.com --query accessToken -o tsv
```

| Result | Criteria |
|--------|----------|
| `pass` | Signed in, token acquired, tenant matches brief/session-config |
| `warn` | Signed in but tenant can't be confirmed, or token expires within 10 min |
| `fail` | Not signed in, token acquisition fails, or tenant mismatch |

**If fail:** Stop remaining checks that depend on Dataverse. Report: "Run `az login --tenant {tenantId}` to authenticate."

### Check 2: Environment Reachability

**Validates:** Target Dataverse environment responds.

**How:** Using token from Check 1:
```bash
node -e "const {get} = require('./tools/lib/http'); get('{dvUrl}/api/data/v9.2/WhoAmI').then(r => console.log(JSON.stringify(r)))"
```

| Result | Criteria |
|--------|----------|
| `pass` | WhoAmI succeeds, environment URL matches brief |
| `warn` | Responds but with throttling (429) or slow (>5s) |
| `fail` | Unreachable, 401/403, DNS failure, or env doesn't exist |

### Check 3: PAC CLI Profile

**Validates:** PAC CLI targets the same environment.

**How:** `pac auth list` + `pac env who` via PAC CLI MCP or direct execution.

| Result | Criteria |
|--------|----------|
| `pass` | Active profile matches target environment |
| `warn` | PAC available but no profile selected, or needs `pac auth select` |
| `fail` | PAC CLI not installed or unreachable |

**Note:** PAC CLI is optional (API fallback exists). A `fail` here is a `warn` for overall status.

### Check 4: Required Connections

**Validates:** All connections from `brief.json.integrations[]` exist in the target environment.

**How:**
1. Read `brief.json.integrations[]` — extract required connector names
2. Run `add-tool.js discover-connections --env {envUrl}` to list available connections
3. Match each required integration against discovered connections

| Result | Criteria |
|--------|----------|
| `pass` | All required connections found and in usable state |
| `warn` | Connection exists but status is unknown or needs re-auth |
| `fail` | One or more required connections missing |

**If fail:** Report which connections are missing and provide manual creation instructions (connector name, settings path in MCS portal).

### Check 5: Knowledge Sources Accessibility

**Validates:** All knowledge sources from `brief.json.knowledge[]` are reachable.

**How:** For each knowledge source:
- **Public URLs:** HTTP HEAD request, check for 200/301/302
- **SharePoint sites:** Graph API `GET /sites/{hostname}:/{path}` using Azure CLI token
- **Dataverse files:** Check `annotation` table for file existence

| Result | Criteria |
|--------|----------|
| `pass` | All sources reachable and accessible |
| `warn` | Reachable but permissions not fully verifiable (e.g., SharePoint requires user consent) |
| `fail` | Source unreachable, 401/403, invalid URL |

### Check 6: Tool / MCP Server Availability

**Validates:** All tools from `brief.json.tools[]` are configured and responsive.

**How:**
1. Read `brief.json.tools[]` — extract tool names and types
2. For MCP servers: check `add-tool.js list-connections` output
3. For Work IQ servers: verify Work IQ MCP is configured
4. For custom connectors: check Dataverse `connector` table

| Result | Criteria |
|--------|----------|
| `pass` | All required tools configured and responsive |
| `warn` | Tool exists but health uncertain, or optional tool missing |
| `fail` | Required tool/server missing or misconfigured |

### Check 7: Model Availability

**Validates:** Requested AI model is available for the target environment.

**How:** Query Island Gateway model catalog:
```bash
node tools/island-client.js list-models --env {envUrl}
```
Match `brief.json.model.name` against available models.

| Result | Criteria |
|--------|----------|
| `pass` | Exact model found and available |
| `warn` | Exact model unavailable but compatible fallback exists |
| `fail` | Model not found, not enabled, or blocked for tenant |

## Output Format

```json
{
  "guardReport": {
    "status": "pass|warn|fail",
    "mode": "full|quick",
    "checkedAt": "2026-03-31T12:00:00Z",
    "durationMs": 4500,
    "environment": {
      "url": "https://org.crm.dynamics.com",
      "name": "Test_Test_TOL_Test",
      "tenantId": "..."
    },
    "checks": [
      {
        "name": "Azure CLI Auth",
        "status": "pass",
        "summary": "Authenticated as you@yourtenant, token valid for 45 min",
        "evidence": ["az account show succeeded", "Token acquired for orgxxxxxxxx.crm.dynamics.com"],
        "fix": null
      },
      {
        "name": "Required Connections",
        "status": "fail",
        "summary": "2 of 4 required connections missing",
        "evidence": ["Missing: shared_office365", "Missing: shared_sharepointonline", "Found: shared_commondataservice", "Found: shared_teams"],
        "fix": "Create missing connections in MCS portal: Settings > Connections > New"
      }
    ],
    "blockingIssues": ["2 required connections missing"],
    "warnings": [],
    "nextAction": "Create missing connections before running /mcs-build"
  }
}
```

## Status Rules

| Level | Meaning | Build impact |
|-------|---------|-------------|
| `pass` | All checks verified | Safe to proceed with `/mcs-build` |
| `warn` | Non-blocking risks detected | Build may proceed with caution — user decides |
| `fail` | Blocking issue confirmed | Do not start `/mcs-build` until resolved |

**Overall status precedence:** `fail` > `warn` > `pass`. Any hard fail = overall fail.

**Exception:** PAC CLI failure is always a `warn` (never blocks) because API fallback covers all PAC CLI operations.

## Build Discipline

- Run all 7 checks even if early checks fail — report everything at once rather than failing one at a time
- Record evidence for every result — no silent passes
- Write `guardReport` to brief.json after all checks complete
- If `--quick` flag: run only Checks 1-3 (auth + env + PAC), skip connection/knowledge/tool/model checks
- If Checks 1-2 fail (no auth/no env): mark Checks 4-7 as `skipped` with reason "Blocked by auth/env failure" — evaluate all possible checks, mark blocked dependencies as skipped

## Progress Markers (Headless Skill Runner)

Emit at each check transition:
```
##PROGRESS## {"step":"guard-auth","label":"Checking Azure CLI auth","status":"running"}
##PROGRESS## {"step":"guard-auth","label":"Checking Azure CLI auth","status":"completed","detail":"Authenticated as you@yourtenant"}
##PROGRESS## {"step":"guard-env","label":"Checking environment","status":"running"}
##PROGRESS## {"step":"guard-connections","label":"Checking connections","status":"running","detail":"4 required"}
##PROGRESS## {"step":"guard-knowledge","label":"Checking knowledge sources","status":"running"}
##PROGRESS## {"step":"guard-tools","label":"Checking tools/MCP","status":"running"}
##PROGRESS## {"step":"guard-model","label":"Checking model availability","status":"running"}
```

On completion:
```
##SKILL_COMPLETE## {"success":true,"summary":"Guard passed: 7/7 checks OK — safe to build"}
##SKILL_COMPLETE## {"success":false,"summary":"Guard failed: 2 blocking issues (missing connections, model unavailable)"}
```

## Next Steps

- **All pass:** Proceed to `/mcs-build {projectId} {agentId}`
- **Warnings only:** Review warnings, then `/mcs-build` at your discretion
- **Any fail:** Fix blocking issues first, then re-run `/mcs-guard` to confirm
