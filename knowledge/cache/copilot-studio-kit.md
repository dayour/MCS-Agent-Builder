<!-- CACHE METADATA
last_verified: 2026-03-18
sources: [MS Learn (30 pages), GitHub repo, AppSource, Power CAT blog, community blogs, 3 research agents]
confidence: high
refresh_trigger: on_error
-->
# Power-CAT Copilot Studio Kit — Quick Reference

## Overview

Free, MIT-licensed Power Platform solution from Microsoft Power CAT team. Testing + governance + analytics for Copilot Studio agents. **Cannot create/modify/publish agents** — purely testing and governance.

- **GitHub:** microsoft/Power-CAT-Copilot-Studio-Kit (~345 stars, 60 open issues)
- **AppSource:** https://aka.ms/DownloadCopilotStudioKit
- **Latest:** March 2026 (2026-03-13) — monthly release cadence, 14 releases in 20 months
- **License:** MIT (no Microsoft Support — community/GitHub issues only)
- **MS Learn:** `https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/kit-*`

## 18 Features

| # | Feature | Category | Key Detail |
|---|---------|----------|------------|
| 1 | Test Automation | Testing | 6 test types via Direct Line API, Excel bulk import/export |
| 2 | Rubrics Refinement | Testing | 5-point AI rubrics with human alignment workflow |
| 3 | Multi-turn Testing | Testing | Ordered child tests, critical/non-critical turns |
| 4 | Plan Validation | Testing | Expected tools + threshold %, uses ConversationTranscript |
| 5 | Compliance Hub | Governance | Risk thresholds, SLA enforcement, quarantine/delete |
| 6 | Agent Inventory | Governance | 44-column tenant-wide agent catalog |
| 7 | Agent Insights Hub | Analytics | App Insights + transcript telemetry, 9-tab React dashboard |
| 8 | Conversation KPIs | Analytics | Sessions/turns/outcomes, Power BI template, auto 2x/day |
| 9 | Agent Value | Analytics | AI-classified agent type/behavior/value |
| 10 | Conversation Analyzer | Analytics | Custom AI prompt analysis of transcripts |
| 11 | Agent Review Tool | Quality | Solution anti-pattern detection, severity scoring |
| 12 | SharePoint Sync | Knowledge | 500+ files, up to 512MB each |
| 13 | Prompt Advisor | Authoring | Confidence scoring, refinement (~120 AI Builder credits/iter) |
| 14 | Webchat Playground | Authoring | Theme designer with JSON/HTML export |
| 15 | Adaptive Cards Gallery | Authoring | Template library with sample data |
| 16 | Component Library | Authoring | Pre-built importable agent components |
| 17 | Automated Testing via Pipelines | CI/CD | Quality gate in PP Pipelines, blocks failed deploys |
| 18 | Setup Wizard | Admin | Guided connection ref + env var + flow activation |

## 6 Test Types

| Type | Scoring | Requirements |
|------|---------|-------------|
| Response Match | Operators: equals, contains, begins/ends with, negatives | None |
| Attachments | JSON comparison + AI Validation option | None |
| Topic Match | Exact topic name match (multi-topic comma-separated) | Dataverse enrichment (ConversationTranscript) |
| Generative Answers | AI Builder LLM evaluation (~50 credits/test) | AI Builder + optionally App Insights |
| Multi-turn | Ordered child tests, critical/non-critical | Depends on child types |
| Plan Validation | Expected tools + pass threshold % | Dataverse enrichment |

## 33 Dataverse Tables (cat_ prefix)

### Core Testing (7 tables)
- `cat_CopilotTestSet` — test group container
- `cat_CopilotTest` (cat_agenttest) — individual test case
- `cat_CopilotTestRun` — execution record (creating triggers cloud flow)
- `cat_CopilotTestResult` — per-test outcome
- `cat_Rubric` — evaluation rubric definition
- `cat_RubricExample` — good/bad examples for refinement
- `cat_DeploymentPipelineConfiguration` — pipeline gate config

### Agent Config (2 tables)
- `cat_AgentConfiguration` — connection details (DL, token endpoint, region, auth, App Insights)
- `cat_FileIndexerConfiguration` — SharePoint sync config

### Agent Inventory (2 tables)
- `cat_AgentDetails` — 44-column tenant-wide inventory
- `cat_AgentUsageHistory` — per-agent per-feature per-day metrics

### Compliance Hub (4 tables)
- Compliance Case, Agent Fact Row Counts, Threshold Config, Action Policy

### Analytics (4 tables)
- Agent Transcripts, Conversation KPI, Conversation Analyzer, Conversation Analyzer Prompt

### Other (8+ tables)
- Agent Value, Agent Review (8 sub-tables), Chatbot Style, Agent Card

## Headless API Workflow

**All Kit operations go through Dataverse CRUD — no dedicated REST API.**

```
1. POST cat_agentconfigurations → agent connection config
2. POST cat_agenttestsets → test group
3. POST cat_agenttests (bulk) → test cases
4. POST cat_copilottestruns → TRIGGERS cloud flow execution
5. POLL cat_copilottestruns(guid)?$select=cat_runstatus → wait for Complete
6. GET cat_agenttestresults?$filter=_cat_agenttestrun_value eq guid → results
```

**Our `powercat-test.js` already implements steps 4-6.**

## Cloud Flow Ordering

Flows must be enabled: Grandchild → Child → Parent. Categories:
- Test Automation (core): triggered by test run record creation
- App Insights Enrichment: after test completion
- Dataverse Enrichment: after test (60 min delay default)
- Generated Answers Analysis: after enrichment, uses AI Builder
- SharePoint Sync: daily scheduled + manual
- Conversation KPIs: twice daily + manual (up to 75K transcripts/run)
- Agent Inventory: daily scheduled + manual
- Compliance Hub: daily scheduled
- Pipeline Pre-deployment: on pipeline request

## Security Roles

| Role | Scope |
|------|-------|
| CSK Administrator | Organization-level, all features |
| CSK Configurator | User-level, full Kit tables |
| CSK Tester | Create and run tests only |

## Prerequisites

| Requirement | Mandatory? | Notes |
|-------------|-----------|-------|
| PP env with Dataverse | Yes | |
| System Admin role | Yes | For installation |
| Model-driven app license | Yes | To run Kit app |
| Premium PA flows license | Yes | DL, HTTP w/Entra ID connectors |
| PCF enabled | Yes | |
| Creator Kit | Yes | Auto-dependency |
| AI Builder credits | Optional | ~50/generative test, ~120/Prompt Advisor iter |
| App Insights | Optional | Enhanced telemetry |
| Power BI | Optional | Conversation KPIs dashboard |

## Known Issues

- Compliance scan is manual-only (no API trigger) — GitHub issue #620
- Scheduled test runs not supported — GitHub issue #629
- Compliance Hub scan produces no results after setup — issue #615
- Solution upgrade: `cat_copilottestrunid` deletion error — stage before apply
- AI Builder credits: seeded credits expire Nov 1, 2026
- Authentication testing limited to Entra ID v2 SSO + MS Auth only

## Our Integration Points

| Our Tool | Kit Entity/Feature | Status |
|---------|-------------------|--------|
| `powercat-test.js run` | cat_copilottestruns | **Already integrated** |
| `powercat-test.js results` | cat_copilottestresults | **Already integrated** |
| `powercat-test.js list-configs` | cat_agentconfigurations | **Already integrated** |
| `powercat-test.js list-sets` | cat_agenttestsets | **Already integrated** |
| `direct-line-test.js` | (Kit uses same DL API) | **Parallel capability** |
| `eval-scoring.js` (7 methods) | Kit's 6 types | **Our 7th method (Plan validation via activity stream) + GPT scoring are net-new** |
| Compliance Hub | None in our system | **Gap — Kit fills it** |
| Agent Inventory | Manual tracking | **Gap — Kit fills it** |
| Agent Review Tool | None | **Gap — Kit fills it** |
| Conversation KPIs | None | **Gap — Kit fills it** |
| CI/CD quality gates | None | **Gap — Kit fills it** |

## Refresh Notes

- Check GitHub releases page for new versions (monthly cadence)
- Monitor GitHub issues for API trigger support (#620, #629)
- Track AI Builder credit policy changes (Nov 2026 deadline)
- Watch for M365 Agents SDK migration in Kit (currently Direct Line only)
