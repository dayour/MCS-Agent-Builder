# Brief Report Template

**Audience:** Internal team, customer technical leads
**When:** After research, before build. Or anytime to review current design state.

```markdown
# Design Brief: {agent.name}

**Generated:** {timestamp}
**Project:** {projectId}
**Solution Type:** {architecture.solutionType} (score: {architecture.solutionTypeScore}/5)

## Business Context
**Use Case:** {business.useCase}
**Problem:** {business.problemStatement}

### Challenges
| Challenge | Impact |
|-----------|--------|
{business.challenges -> table rows}

### Success Criteria
| Metric | Target | Measurement |
|--------|--------|-------------|
{business.successCriteria -> table rows}

## Agent Design
**Name:** {agent.name}
**Description:** {agent.description}
**Persona:** {agent.persona}
**Primary Users:** {agent.primaryUsers}

## Capabilities ({mvp count} MVP / {future count} Future)

### MVP -- Building Now
| Capability | Type | Description |
|-----------|------|-------------|
{capabilities where phase=mvp -> table rows}

### Future -- Deferred
| Capability | Reason | Description |
|-----------|--------|-------------|
{capabilities where phase=future -> table rows}

## Architecture
**Type:** {architecture.type}
**Reason:** {architecture.reason}
**Channels:** {architecture.channels -> comma-separated names}
**Model:** {from instructions or buildStatus}

{If architecture.buildPath is set:}
### Build Path Decision
**Selected:** {architecture.buildPath} (custom-agent / declarative-agent / first-party-only)
**Reason:** {architecture.buildPathReason}

{If architecture.frontierAgentMatch has entries:}
### First-Party Agent Matches
| Agent | Coverage | Recommendation | License Required | Matched Capabilities |
|-------|----------|---------------|-----------------|---------------------|
{architecture.frontierAgentMatch -> table rows}

{For rejected paths -- extract from buildPathReason:}
### Why Not Other Paths
- **Declarative Agent:** {reason DA was rejected}
- **First-Party Only:** {reason first-party-only was rejected}
- **Custom Agent:** {if DA was chosen -- reason CA is unnecessary}

{If multi-agent:}
### Agent Topology
| Agent | Role | Routing Rule |
|-------|------|-------------|
{architecture.children -> table rows}

{If connected-agent or single-agent-with-connected-agents:}
### Connected Agents
| Agent | Source | Role | Status |
|-------|--------|------|--------|
{connectedAgents -> table rows}

{For each connected agent with dataPipeline:}
**{name} -- Data Pipeline:** {dataPipeline.source} -> {dataPipeline.ingestion} -> {dataPipeline.destination} (Refresh: {dataPipeline.refreshCadence})

## Integrations ({count})
| Name | Type | Auth | Status | Phase |
|------|------|------|--------|-------|
{integrations -> table rows}

## Knowledge Sources ({count})
| Name | Type | Purpose | Status |
|------|------|---------|--------|
{knowledge -> table rows}

## Cross-Reference Summary
### Capability -> Integration Mapping
| Capability | Integrations Used |
|-----------|------------------|
{cross-reference capabilities[].dataSources against integrations[].name}

### Orphan Detection
- **Integrations not linked to any capability:** {list or "None"}
- **Capabilities with no backing integration/knowledge:** {list or "None"}

## Conversation Design ({topic count} topics)
| Topic | Trigger | Type | Phase | Implements |
|-------|---------|------|-------|-----------|
{conversations.topics -> table rows}

## Boundaries
**Handles:** {boundaries.handle -> bullet list}
**Declines:** {boundaries.decline -> bullet list with redirect}
**Refuses:** {boundaries.refuse -> bullet list with reason}

## Evaluation Plan ({eval set count} sets, {total test count} tests)
| Set | Tests | Threshold | Methods |
|-----|-------|-----------|---------|
{evalSets -> table rows}

## Open Questions ({count})
| Question | Impact | Suggested Default |
|----------|--------|------------------|
{openQuestions where answer is empty -> table rows}

## Pending Decisions ({count})
| Decision | Category | Recommended | Status |
|----------|----------|-------------|--------|
{decisions where status=pending -> table rows}
```
