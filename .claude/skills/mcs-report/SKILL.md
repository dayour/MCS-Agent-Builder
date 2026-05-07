---
name: mcs-report
description: "Use this skill to generate an export from agentspec.json without running a build. Produces a single self-contained HTML file with three tabs: Brief (design state), Evaluations (test sets and results), and How-To Guide (step-by-step MCS build instructions). Use when the user wants a summary, status update, or shareable document."
---

# MCS Report Generator

Generate a combined HTML export from agentspec.json at any project stage. Read-only — never modifies agentspec.json.

## Input

```
/mcs-report {projectId} {agentId}
```

Reads from: `Build-Guides/{projectId}/agents/{agentId}/agentspec.json` — **read-only, never modifies**
Writes to: `Build-Guides/{projectId}/agents/{agentId}/export.html`

## Step 1: Load and Validate agentspec.json

Read agentspec.json. If missing → **STOP:** "No agentspec.json found. Run `/mcs-research` first."

Check completeness — minimum required: `business`, `agent`, `capabilities` (at least 1). If missing → **WARN** (don't stop): "Some sections will be incomplete — {field} is empty."

## Step 2: Generate HTML Export

Generate the self-contained HTML export by calling the server-side renderer:

```bash
node -e "
const path = require('path');
const { renderReport } = require('./app/lib/report');
const briefPath = path.resolve('Build-Guides/{projectId}/agents/{agentId}/agentspec.json');
const outPath = path.resolve('Build-Guides/{projectId}/agents/{agentId}/export.html');
renderReport(briefPath).then(html => {
  require('fs').writeFileSync(outPath, html);
  console.log('Export written:', outPath, '(' + (html.length / 1024).toFixed(1) + ' KB)');
}).catch(err => console.error('Export generation failed:', err.message));
"
```

The export is a single self-contained .html file with:
- **Brief tab** — Overview, architecture, instructions, capabilities, integrations, knowledge sources, topics, scope/boundaries, decisions, open questions, cross-reference
- **Evaluations tab** — Eval sets with pass rate charts, test tables, results
- **How-To Guide tab** — Step-by-step instructions for building this agent in Copilot Studio manually

All CSS, JS, and SVG charts are inlined. Works offline. Prints all tabs via Ctrl+P.

## Step 3: GPT Review (optional)

Fire GPT review on the spec data for accuracy:

```bash
node tools/multi-model-review.js review-code --file "Build-Guides/{projectId}/agents/{agentId}/agentspec.json" --context "Export review: verify data accuracy, check cross-references between capabilities/integrations/topics, flag missing sections"
```

If GPT is unavailable, proceed without it.

## Gotchas

- **Validate inputs** — `{projectId}`, `{agentId}` are interpolated into file paths. Reject values containing `..`, `/`, `\`, or special characters before constructing paths.
- **If agentspec.json is minimal** (just business + agent), the Brief tab will have sparse sections and the How-To Guide will show warnings for missing data. This is expected.
- **How-To Guide is auto-generated** from spec data — steps appear conditionally based on what's configured. Missing data shows a warning callout, not an empty section.

## Important Rules

- **Never modify agentspec.json** — this skill is strictly read-only
- **No teammates needed** — lightweight lead-only generation
- **Single output** — one HTML file with all content in tabs
