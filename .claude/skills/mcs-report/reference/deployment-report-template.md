# Deployment Report Template

**Audience:** IT admin, deployment team, ops
**When:** Before or after deploy. Pre-deploy = checklist. Post-deploy = status + instructions.

```markdown
# Deployment Guide: {agent.name}

**Generated:** {timestamp}
**Source Environment:** {buildStatus.environment}
**Target Environment:** {deployStatus.targetEnvironment or "TBD"}
**Deployment Mode:** {deployStatus.mode or "Recommended: {auto-detected mode}"}

## Pre-Deployment Checklist
- [{buildStatus.status == "published" ? "x" : " "}] Agent published in source environment
- [{evalSets have results ? "x" : " "}] Evaluation tests executed
- [{safety pass rate == 100% ? "x" : " "}] Safety tests passing (100%)
- [{functional pass rate >= 85% ? "x" : " "}] Functional tests passing (>= 85%)
- [ ] Target environment created and accessible
- [ ] Deployment account has System Administrator role in target
- [ ] Connection credentials available for target (see below)

## Connection Mapping
{For each integration:}
| Connection | Auth Method | Action Required | Credentials Needed |
|-----------|-------------|-----------------|-------------------|
{integrations -> table rows with auth details}

## Environment-Specific Configuration
{List any values that need updating in target:}
| Setting | Source Value | Target Value (fill in) |
|---------|------------|----------------------|
{Dataverse URLs, environment variables, etc.}

## Deployment Steps
{If not yet deployed:}
1. Verify pre-deployment checklist above
2. Run: /mcs-deploy {projectId} {agentId}
3. Complete connection mapping in target MCS
4. Run smoke test: /mcs-eval {projectId} {agentId} --set safety
5. Configure channels in target environment

{If already deployed:}
**Deployed at:** {deployStatus.deployedAt}
**Target Bot ID:** {deployStatus.targetBotId}
**Smoke Test:** {deployStatus.smokeTestResult}

## Post-Deployment Checklist
- [{deployStatus.status == "deployed" ? "x" : " "}] Agent deployed to target
- [{deployStatus.smokeTestResult == "pass" ? "x" : " "}] Smoke test passed
- [{deployStatus.connectionsMapped ? "x" : " "}] All connections mapped
- [ ] Channels configured (Teams, Web Chat, etc.)
- [ ] Pilot users granted access
- [ ] Monitoring/alerting configured

## Channel Configuration
{For each channel in architecture.channels:}
### {channel.name}
- **Reason:** {channel.reason}
- **Setup:** {channel-specific setup instructions}

## Rollback Plan
- **Agent mode:** Delete target bot via MCS UI or Dataverse API
- **Solution mode:** Uninstall solution from target via PAC CLI: pac solution delete --solution-name "{name}"
- **Source agent is unaffected** -- deployment is additive, never modifies source
```
