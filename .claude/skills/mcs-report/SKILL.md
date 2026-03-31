---
name: mcs-report
description: "Use this skill to generate a report from brief.json without running a build. Four report types for different audiences: brief (design state), build (status + deviations), customer (simplified, zero jargon), deployment (checklists + env mapping). Use when the user wants a summary, status update, or customer-ready document."
---

# MCS Report Generator

Generate reports from brief.json at any project stage, for any audience. Read-only — never modifies brief.json.

## Input

```
/mcs-report {projectId} {agentId}                   # Default: "brief" type
/mcs-report {projectId} {agentId} --type brief       # Current design state
/mcs-report {projectId} {agentId} --type build       # Build status + deviations
/mcs-report {projectId} {agentId} --type customer    # Simplified for stakeholders
/mcs-report {projectId} {agentId} --type deployment  # Checklist + instructions
```

Reads from: `Build-Guides/{projectId}/agents/{agentId}/brief.json` — **read-only, never modifies**
Writes to: `Build-Guides/{projectId}/agents/{agentId}/{type}-report.md`

## Step 1: Load and Validate brief.json

Read brief.json. If missing → **STOP:** "No brief.json found. Run `/mcs-research` first."

Check completeness based on report type:

| Report Type | Minimum Required Fields |
|-------------|----------------------|
| `brief` | business, agent, capabilities (at least 1) |
| `build` | buildStatus (with at least 1 completed step) |
| `customer` | business, agent, capabilities |
| `deployment` | buildStatus.status == "published", integrations |

If minimum fields are missing → **WARN** (don't stop): "Some sections will be incomplete — {field} is empty."

## Step 2: Generate Report

Each report type has a detailed template in `reference/`. Read the appropriate template, fill in data from brief.json.

| Type | Template | Audience | When |
|------|----------|----------|------|
| `brief` | `reference/brief-report-template.md` | Internal team, technical leads | After research, before build |
| `build` | `reference/build-report-template.md` | Customer, project team | After build/eval/fix |
| `customer` | `reference/customer-report-template.md` | Non-technical stakeholders | Exec updates, presentations |
| `deployment` | `reference/deployment-report-template.md` | IT admin, deployment team | Before or after deploy |

## Customer Report: Jargon Rules — MANDATORY

Replace ALL technical terms in customer reports:

| Technical | Customer-Friendly |
|-----------|------------------|
| PAC CLI | *(omit entirely)* |
| Dataverse | data storage |
| LSP | *(omit entirely)* |
| YAML | configuration |
| PowerFx | formula |
| MCP | service connection |
| JSON | *(omit entirely)* |
| API | service |
| OAuth | secure sign-in |
| Service Principal | automated access |
| Connector | connection |
| Knowledge source | data source |
| Declarative agent | configuration-based agent |
| Custom agent | custom-built agent |
| First-party agent | Microsoft's built-in agent |
| Frontier agent | Microsoft's advanced built-in agent |
| Topic | conversation flow |
| Trigger | activation rule |
| Eval set | test suite |
| brief.json | design specification |

## Step 3: Write Draft & GPT Review

1. **Write** the report to `Build-Guides/{projectId}/agents/{agentId}/{type}-report.md`
2. **Then** fire GPT review on the written file:

```bash
node tools/multi-model-review.js review-code --file "Build-Guides/{projectId}/agents/{agentId}/{type}-report.md" --context "Report review: verify data accuracy against brief.json, check cross-references, ensure customer report has zero jargon"
```

3. Apply GPT fixes to the report file. If GPT is unavailable, proceed without it.

## Gotchas

- **Validate inputs** — `{projectId}`, `{agentId}`, `{type}` are interpolated into file paths. Reject values containing `..`, `/`, `\`, or special characters before constructing paths.
- **Cross-reference summary (brief type) is unique** — no other report includes orphan detection analysis. Read `reference/brief-report-template.md` for the full cross-reference section.
- **If brief.json is minimal** (just business + agent), only `brief` and `customer` types will produce useful output — warn the user for `build` and `deployment` types.
- **Customer report jargon leaks** — the most common GPT catch is technical terms slipping through. Double-check the jargon table above.

## Important Rules

- **Never modify brief.json** — this skill is strictly read-only
- **No teammates needed** — lightweight lead-only generation
- **Always write the report file** — mark incomplete sections as "N/A" or "Not yet available"
- **Customer report must follow jargon rules** — these reports go to non-technical stakeholders
- **Report file naming:** `{type}-report.md` (brief-report.md, build-report.md, customer-report.md, deployment-report.md)
