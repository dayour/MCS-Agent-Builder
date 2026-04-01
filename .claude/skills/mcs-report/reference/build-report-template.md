# Build Report Template

**Audience:** Customer, project team
**When:** After build, after eval, after fix. Anytime to check current state.

```markdown
# Build Report: {agent.name}

**Generated:** {timestamp}
**Environment:** {buildStatus.environment}
**Status:** {buildStatus.status}
**Published:** {buildStatus.publishedAt or "Not yet"}

## Build Summary
| Step | Status |
|------|--------|
| Agent created | {check if "created" in completedSteps} |
| Instructions set | {check "instructions"} |
| Knowledge configured | {check "knowledge"} |
| Tools connected | {check "tools"} |
| Model selected | {check "model"} |
| Topics deployed | {check "topics"} |
| Published | {check "published"} |

{If lastError:}
**Last Error:** {buildStatus.lastError}

## Evaluation Results
**Overall:** {total passed}/{total tests} ({pass rate}%)

| Set | Passed | Total | Rate | Target | Status |
|-----|--------|-------|------|--------|--------|
{evalSets with results -> table rows}

### Failed Tests
| Set | Question | Expected | Got |
|-----|----------|----------|-----|
{tests where lastResult.pass == false -> table rows}

## Capabilities Status
| Capability | Phase | Status | Implementation |
|-----------|-------|--------|---------------|
{capabilities -> table rows with status}

## Deviations from Design
{Compare brief spec against buildStatus -- flag anything built differently than specified:}
- Topics planned but not built
- Tools specified but not connected
- Knowledge sources specified but not added
- Model specified vs actual

## MVP Scope
- **Built:** {count} capabilities
- **Deferred:** {count} capabilities
{mvpSummary.future -> bullet list}

## Recommendations
{recommendations -> bullet list}

## Next Steps
{Based on current state:}
- {If eval failures exist:} Run /mcs-fix to address {N} failing tests
- {If future items exist:} Plan Phase 2 for {count} deferred capabilities
```
