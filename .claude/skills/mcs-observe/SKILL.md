---
name: mcs-observe
description: "Post-deploy agent monitoring: synthetic conversations, latency measurement, knowledge freshness, tool connectivity, quality regression detection. Writes observeReport to brief.json."
user_invocable: true
---

# MCS Observe — Post-Deploy Agent Monitoring

A successful deploy only proves the agent worked once. This skill verifies the agent **stays healthy** — available, fast, grounded in current knowledge, connected to tools, and responding with quality.

## When to Run

| Trigger | How |
|---------|-----|
| Post-deploy | Run immediately after `/mcs-deploy` completes |
| On-demand | Run anytime to check agent health |
| Scheduled | Use `/loop 1h /mcs-observe {projectId} {agentId}` for continuous monitoring |
| Pre-demo | Verify agent is healthy before important demos |

## Input

```
/mcs-observe {projectId} {agentId}                  # Full health check
/mcs-observe {projectId} {agentId} --quick           # Availability + latency only
/mcs-observe {projectId} {agentId} --compare-baseline # Include regression check vs eval baselines
```

Reads from:
- `Build-Guides/{projectId}/agents/{agentId}/brief.json` — buildStatus, deployStatus, evalSets, tools, knowledge
- Published agent endpoint via Direct Line API

Writes to:
- `Build-Guides/{projectId}/agents/{agentId}/brief.json` — `observeReport` field

## Preconditions

1. `buildStatus.status` is `"published"` — agent must be built
2. `deployStatus` exists (or agent is in dev env) — agent must be reachable
3. Azure CLI auth is valid — needed for Dataverse/Direct Line token

If preconditions fail, record in `observeReport` and mark dependent checks as `skipped`.

## Health Checks (6 checks, ordered cheap → expensive)

### Check 1: Agent Availability

**Validates:** Agent is published and responds to Direct Line handshake.

**How:**
```bash
node tools/direct-line-test.js --bot-id {botId} --env {dvUrl} --ping
```

**Collect:** publish state, endpoint reachable, first-response latency

| Result | Criteria |
|--------|----------|
| `pass` | Agent responds within 5s |
| `warn` | Agent responds but slow (>5s) or intermittent |
| `fail` | Agent unreachable, unpublished, or auth fails |

### Check 2: Synthetic Conversation Test

**Validates:** Agent handles representative user queries correctly.

**How:** Select 3-5 prompts from `evalSets[0].tests[]` (boundaries set) or generate representative prompts from capabilities. Run via `direct-line-test.js`:

```bash
node tools/direct-line-test.js --bot-id {botId} --env {dvUrl} --questions '{json}'
```

**Prompt mix:**
- 1 greeting / basic intent
- 1 knowledge lookup question
- 1 tool-backed action
- 1 edge case / boundary test
- 1 follow-up / clarification

**Collect per turn:** latency (ms), response text, pass/fail, error type if any

| Result | Criteria |
|--------|----------|
| `pass` | 80%+ prompts get relevant, complete responses |
| `warn` | 60-80% success, or latency p95 > 8s |
| `fail` | <60% success, or multiple errors/empty responses |

### Check 3: Tool Connectivity (Runtime)

**Validates:** All configured tools respond at runtime (not just configured — actually invocable).

**How:**
1. Read `brief.json.tools[]`
2. For each tool: send a synthetic prompt via Direct Line that should trigger tool invocation
3. Verify the agent's response includes tool output (not a fallback/refusal)
4. Fallback: `add-tool.js list-connections --env {dvUrl}` for config-level check if runtime test not possible

**Collect:** tool name, connection status, auth status, latency

| Result | Criteria |
|--------|----------|
| `pass` | All required tools connected and responsive |
| `warn` | Optional tool unreachable, or auth nearing expiry |
| `fail` | Required tool missing or disconnected |

### Check 4: Knowledge Freshness

**Validates:** Knowledge sources haven't gone stale since last build.

**How:**
1. Read `brief.json.knowledge[]` — extract source URLs/types
2. For SharePoint: Graph API `GET /sites/{id}/drive/root` → check `lastModifiedDateTime`
3. For public URLs: HTTP HEAD → check `Last-Modified` header
4. For uploaded files: Dataverse `annotation` table → check `modifiedon`

**Collect:** source name, type, last modified, age in hours, freshness status

| Result | Criteria |
|--------|----------|
| `pass` | All sources unchanged since last build, or freshly synced |
| `warn` | Source updated after last build (agent may be stale) |
| `fail` | Source unreachable or sync failed |

### Check 5: Response Quality Regression

**Validates:** Current responses haven't degraded vs eval baselines.

**How:** Compare synthetic conversation responses (Check 2) against `evalSets[].tests[].expected`:
- Intent match (does the response address the same topic?)
- Key entity presence (are expected entities/facts in the response?)
- Refusal/fallback frequency (is the agent refusing more than before?)

**Collect:** baseline match %, per-prompt regression classification (improved/same/degraded/unknown)

| Result | Criteria |
|--------|----------|
| `pass` | Quality score within 10% of baseline |
| `warn` | Quality dropped 10-25% |
| `fail` | Quality dropped >25%, or expected behaviors disappeared |

### Check 6: Channel Health (Optional)

**Validates:** Configured channels are active.

**How:** Read `brief.json.architecture.channels[]`, check Dataverse `botchannelconfig` records

| Result | Criteria |
|--------|----------|
| `pass` | All configured channels enabled |
| `warn` | Channel configured but status unverifiable |
| `fail` | Channel disabled or misconfigured |

## Metrics

| Metric | Description |
|--------|-------------|
| `latencyP50Ms` | Median response latency across synthetic tests |
| `latencyP95Ms` | P95 response latency |
| `errorRate` | Failed turns / total turns |
| `availability` | `up` / `degraded` / `down` |
| `knowledgeAgeHours` | Hours since oldest knowledge source was updated |
| `toolSuccessRate` | Connected tools / total required tools |
| `qualityScore` | Aggregate match % vs eval baselines (0-100) |

## Alerting Thresholds

| Condition | Level |
|-----------|-------|
| Agent unavailable | `critical` |
| Synthetic success rate < 80% | `critical` |
| `latencyP95Ms` > 8000 | `high` |
| `latencyP50Ms` > 3000 | `medium` |
| `errorRate` > 10% | `high` |
| Tool success rate < 95% | `high` |
| Quality score dropped > 15% | `high` |
| Knowledge updated after build | `medium` |
| Channel inactive | `medium` |

**Overall status:** `healthy` (no alerts), `degraded` (medium/high alerts), `unhealthy` (any critical alert).

## Output Format

```json
{
  "observeReport": {
    "status": "healthy|degraded|unhealthy",
    "checkedAt": "2026-03-31T14:00:00Z",
    "durationMs": 12300,
    "metrics": {
      "latencyP50Ms": 1200,
      "latencyP95Ms": 3400,
      "errorRate": 0.0,
      "knowledgeAgeHours": 48,
      "toolSuccessRate": 1.0,
      "qualityScore": 92
    },
    "checks": [
      { "name": "Agent Availability", "status": "pass", "summary": "Responds in 800ms", "evidence": [...] },
      { "name": "Knowledge Freshness", "status": "warn", "summary": "SharePoint source updated 2 days after build", "evidence": [...] }
    ],
    "alerts": [
      { "level": "medium", "check": "Knowledge Freshness", "message": "Source 'HR Policies' updated after last build — consider rebuild" }
    ]
  }
}
```

## Build Discipline

- Run all checks even if early ones fail — report everything at once
- Never mark a check `pass` without evidence
- If a metric can't be computed, set to `null` with explanation
- Reuse `evalSets` prompts for synthetic tests to keep monitoring aligned with evaluation
- When run via `/loop`, only write `observeReport` if status changed (avoids noisy brief.json updates)
- If `--quick` flag: run only Checks 1-2 (availability + synthetic), skip the rest

## Progress Markers (Headless Skill Runner)

Emit at each check transition:
```
##PROGRESS## {"step":"observe-avail","label":"Checking availability","status":"running"}
##PROGRESS## {"step":"observe-avail","label":"Checking availability","status":"completed","detail":"Responds in 800ms"}
##PROGRESS## {"step":"observe-synth","label":"Running synthetic tests","status":"running","detail":"0/5 complete"}
##PROGRESS## {"step":"observe-synth","label":"Running synthetic tests","status":"running","detail":"3/5 complete"}
##PROGRESS## {"step":"observe-tools","label":"Checking tool connectivity","status":"running"}
##PROGRESS## {"step":"observe-knowledge","label":"Checking knowledge freshness","status":"running"}
##PROGRESS## {"step":"observe-quality","label":"Checking quality regression","status":"running"}
##PROGRESS## {"step":"observe-channels","label":"Checking channels","status":"running"}
```

On completion:
```
##SKILL_COMPLETE## {"success":true,"summary":"Agent healthy: 6/6 checks pass, p50 latency 1.2s"}
##SKILL_COMPLETE## {"success":false,"summary":"Agent degraded: knowledge stale, quality dropped 18%"}
```

## Next Steps

After observing, consider:
- `/mcs-drift {projectId} {agentId}` — verify the live agent still matches the intended brief (catches config drift not visible in health checks)
- `/mcs-report {projectId} {agentId} --type deployment` — generate a deployment status report including observe results
- `/mcs-retro` — capture monitoring insights into the learnings system
