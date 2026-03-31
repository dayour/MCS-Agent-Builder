---
name: mcs-drift
description: "Detect drift between brief.json (intended design) and live MCS agent state. Compares instructions, topics, knowledge, tools, model, and metadata. Classifies severity and recommends remediation."
user_invocable: true
---

# MCS Drift — Brief vs Live Agent Reconciliation

Detects and explains differences between the intended agent design (`brief.json`) and the actual live MCS agent state. Essential for governance — manual UI edits, platform updates, or configuration changes silently break the brief-as-source-of-truth guarantee.

## When to Run

| Trigger | Why |
|---------|-----|
| Before `/mcs-build` | Verify brief still reflects accepted design before building |
| Before `/mcs-deploy` | Prevent shipping unexpected live changes |
| On-demand | Investigate suspected manual edits or unexplained behavior |
| After manual MCS edits | Detect UI changes that bypassed brief-first workflow |

## Input

```
/mcs-drift {projectId} {agentId}                     # Full comparison
/mcs-drift {projectId} {agentId} --instructions-only  # Compare instructions only
/mcs-drift {projectId} {agentId} --auto-sync brief    # Auto-sync: push brief → MCS for benign diffs
```

Reads from:
- `Build-Guides/{projectId}/agents/{agentId}/brief.json` — intended design
- Live MCS agent state via `mcs-lsp.js pull {agentId}` — actual state
- Dataverse API — bot metadata, component details
- Island Gateway API — model/routing configuration

Writes to:
- `Build-Guides/{projectId}/agents/{agentId}/brief.json` — `driftReport` field

## Operating Procedure

| Step | Action | Tool |
|------|--------|------|
| 1 | Load `brief.json` as intended baseline | Read file |
| 2 | Pull live agent state | `mcs-lsp.js pull {agentId}` |
| 3 | Query supplementary APIs | Dataverse (metadata), Island Gateway (model) |
| 4 | Compare brief vs actual across all 7 areas | Normalize before diff |
| 5 | Classify each finding | benign / risky / blocking |
| 6 | Recommend remediation per finding | brief→MCS / MCS→brief / manual review |
| 7 | Write `driftReport` to brief.json | Update file |

**Verify-then-mark:** Do not mark drift as resolved until re-pull confirms the fix.

## Drift Detection Areas (7 comparisons)

### 1. Instructions

**Brief source:** `brief.json.instructions` (system prompt, persona, boundaries, examples)
**Actual source:** LSP pull → `GptComponent` data field

**Compare:** Full text diff (normalize whitespace). Flag:
- Wording changes, deleted constraints, added instructions
- Reordered but semantically equivalent text (mark benign)
- Hidden manual edits not reflected in brief

### 2. Topics

**Brief source:** `brief.json.topics[]` (topic list with names, trigger phrases, capabilities)
**Actual source:** LSP pull → topic YAML files

**Compare:**
- Topic inventory: added, removed, renamed topics
- Topic content: node changes, flow logic, handoff behavior
- Active/inactive status changes

### 3. Knowledge Sources

**Brief source:** `brief.json.knowledge[]`
**Actual source:** LSP pull → knowledge component config + Dataverse `botcomponent` query

**Compare:** Missing sources, extra sources, endpoint changes, disabled sources

### 4. Tools / Connections

**Brief source:** `brief.json.integrations[]` and `brief.json.tools[]`
**Actual source:** `add-tool.js list-connections --env {dvUrl}` + LSP pull tool config

**Compare:** Missing tools, extra connectors, wrong environment binding, removed/added actions (auth state is guard's job, not drift's)

### 5. Model Configuration

**Brief source:** `brief.json.model` (name, provider, settings)
**Actual source:** Island Gateway API → `list-models` + agent routing config

**Compare:** Model family changed, temperature changed, routing mode changed

### 6. Agent Metadata

**Brief source:** `brief.json.identity` (name, description, persona)
**Actual source:** Dataverse `bot` entity → `name`, `description` fields

**Compare:** Display name, description text, persona summary

### 7. Trigger Phrases (Optional)

**Brief source:** `brief.json.topics[].triggers[]`
**Actual source:** LSP pull → topic YAML trigger sections

**Compare:** Missing phrases, added aliases, conflicting phrase changes that affect routing

## Drift Classification

| Severity | Definition | Examples |
|----------|-----------|----------|
| `benign` | Cosmetic, no behavior impact | Description rewording, whitespace changes, reordered equivalent text |
| `risky` | Functional change, needs review | Topic logic edited, trigger phrases changed, model setting changed, instruction tone shift |
| `blocking` | Breaks design intent or governance | Required topic missing, critical instruction removed, wrong tool connection, knowledge source missing |

**When uncertain between two severities, choose the more conservative option.**

## Remediation Options

| Option | When | Action |
|--------|------|--------|
| **Sync brief → MCS** | Brief is authoritative, live state was changed unintentionally | `mcs-lsp.js push` to overwrite MCS with brief state |
| **Sync MCS → brief** | Live state is correct, brief is outdated | Update `brief.json` fields to match actual state |
| **Manual review** | Intent unclear, diff complex, or impact high | Present evidence to user, wait for decision |

### Default remediation by area

| Area | Typical Remediation |
|------|-------------------|
| Instructions | Manual review first — instruction changes have wide impact |
| Topics added/removed | Manual review — likely blocking |
| Topics modified | Manual review — may become brief→MCS or MCS→brief |
| Knowledge mismatch | Usually blocking — fix source of truth and resync |
| Tool/connection mismatch | Usually blocking — validate env and credentials |
| Model config | Risky/blocking — verify approved settings |
| Metadata | Usually benign — sync MCS → brief or accept |
| Trigger phrases | Manual review if routing could change |

## Output Format

```json
{
  "driftReport": {
    "status": "matched|drifted|unknown",
    "checkedAt": "2026-03-31T15:00:00Z",
    "durationMs": 8200,
    "agentId": "bot-guid-here",
    "summary": {
      "totalFindings": 3,
      "benign": 1,
      "risky": 1,
      "blocking": 1
    },
    "findings": [
      {
        "area": "instructions",
        "entity": "System prompt",
        "severity": "risky",
        "expected": "You are a helpful HR assistant...",
        "actual": "You are a friendly HR helper...",
        "diffSummary": "Persona tone changed from 'helpful' to 'friendly', removed 3 boundary rules",
        "remediation": "manual-review",
        "source": ["brief.json", "lsp-pull"],
        "status": "open"
      },
      {
        "area": "topics",
        "entity": "Topic: LeaveRequest",
        "severity": "blocking",
        "expected": "Active topic with 5 nodes",
        "actual": "Topic not found in live agent",
        "diffSummary": "Required topic deleted from MCS — likely manual removal",
        "remediation": "sync-brief-to-mcs",
        "source": ["brief.json", "lsp-pull"],
        "status": "open"
      }
    ]
  }
}
```

## Build Discipline

- Always pull fresh live state before comparing — never compare against stale exports
- Normalize values before diffing (trim whitespace, sort arrays, ignore field ordering)
- Explain drift in business-readable language, not raw field diffs
- Record evidence (brief source + actual source) for every finding
- Run all 7 comparisons even if early ones find blocking drift — report everything at once
- If `--auto-sync brief` flag: auto-push benign diffs, still flag risky/blocking for manual review
- Do not mark findings `resolved` without re-pull verification

## Progress Markers (Headless Skill Runner)

Emit at each comparison step:
```
##PROGRESS## {"step":"drift-pull","label":"Pulling live agent state","status":"running"}
##PROGRESS## {"step":"drift-pull","label":"Pulling live agent state","status":"completed"}
##PROGRESS## {"step":"drift-instructions","label":"Comparing instructions","status":"running"}
##PROGRESS## {"step":"drift-topics","label":"Comparing topics","status":"running","detail":"5 topics"}
##PROGRESS## {"step":"drift-knowledge","label":"Comparing knowledge","status":"running"}
##PROGRESS## {"step":"drift-tools","label":"Comparing tools","status":"running"}
##PROGRESS## {"step":"drift-model","label":"Comparing model config","status":"running"}
##PROGRESS## {"step":"drift-metadata","label":"Comparing metadata","status":"running"}
##PROGRESS## {"step":"drift-triggers","label":"Comparing triggers","status":"running"}
```

On completion:
```
##SKILL_COMPLETE## {"success":true,"summary":"No drift detected — brief matches live agent"}
##SKILL_COMPLETE## {"success":true,"summary":"Drift detected: 1 blocking, 2 risky, 1 benign findings"}
```

## Next Steps

- **No drift:** Agent is aligned — proceed to `/mcs-build` or `/mcs-deploy`
- **Benign only:** Accept or auto-sync with `--auto-sync brief`
- **Risky/blocking:** Review findings, choose remediation (brief→MCS or MCS→brief), then re-run `/mcs-drift` to confirm
- After remediation: `/mcs-eval` to verify agent behavior hasn't regressed
