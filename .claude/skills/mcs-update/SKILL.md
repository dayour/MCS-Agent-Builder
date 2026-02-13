---
name: mcs-update
description: Incremental brief update — analyzes new/changed docs, maps to agents, updates affected brief.json sections without overwriting user edits. Lightweight alternative to full /mcs-research re-run.
---

# MCS Update — Incremental Brief Update

Lightweight skill that detects new/changed documents, resolves which agent(s) they affect, and surgically updates only the affected brief.json sections — preserving everything the user already edited.

**When to use:** After initial `/mcs-research` has completed and user uploads 1-2 more documents (follow-up emails, updated requirements, tech specs). Avoids the full 4-phase research pipeline.

## Input

```
/mcs-update {projectId}
```

**Requires:** `doc-manifest.json` in `Build-Guides/{projectId}/` (written by `/mcs-research`). If missing, tell the user to run `/mcs-research` first.

## Flow

### Step 1: Read Manifest & Diff Documents

1. Read `Build-Guides/{projectId}/doc-manifest.json`
2. If missing → output "No document manifest found. Run `/mcs-research {projectId}` first." and exit
3. Compute SHA-256 hashes of all current files in `Build-Guides/{projectId}/docs/`
4. Compare to manifest entries:
   - **new_docs**: files in docs/ not in manifest
   - **changed_docs**: files in manifest whose hash differs from current
   - **deleted_docs**: files in manifest not present in docs/
   - **unchanged**: files with matching hashes
5. If nothing changed → output "No document changes detected since last research." and exit

### Step 2: Resolve Agent Targeting

For each new/changed doc, determine which agent(s) it affects:

**If `targetAgent` is set in manifest** (user tagged at upload time):
- Use the tagged agent directly — no auto-detection needed

**If `targetAgent` is null** (no tag, or uploaded before agents existed):
- Read the document content
- Read each agent's `brief.json` from `Build-Guides/{projectId}/agents/*/brief.json`
- Score relevance by matching:
  - Systems mentioned in doc vs `integrations[]` (e.g., doc says "Jira" → agent with Jira)
  - Problem domain in doc vs `business.problemStatement` (e.g., "incident management" → matching agent)
  - Capabilities in doc vs `capabilities[].name` (e.g., "ticket routing" → matching agent)
- Present mapping for confirmation:
  ```
  Document "updated-jira-requirements.md" seems relevant to:
    → Incident Management (matches: Jira, ticket routing)
  Is this correct?
  ```
- If content is generic/cross-cutting (matches all or no agents clearly) → apply to all agents

### Step 3: Check Drastic Change Thresholds

Before proceeding, check if the changes are too large for an incremental update. **Any one** of these triggers a recommendation for full `/mcs-research` instead:

- New agent described in the document (not in current manifest)
- Architecture would change (single ↔ multi-agent)
- More than 4 brief sections affected across all agents
- Problem statement (`business.problemStatement`) would fundamentally change
- New/changed doc volume > 2x existing docs (more new content than original)

If triggered:
```
## Drastic Change Detected

The new documents introduce changes too large for an incremental update:
- [reason]

Recommend running full `/mcs-research {projectId}` instead.
Proceed with incremental update anyway? (not recommended)
```

### Step 4: Analyze Documents & Map to Brief Sections

Read each new/changed document and classify content by brief section:

| Content Signal | Affected Section |
|----------------|-----------------|
| Agent purpose, problem, users | `business`, `agent` |
| Capabilities, use cases | `capabilities[]` |
| Scenarios, user prompts | `scenarios[]` |
| Systems, APIs, connectors, integrations | `integrations[]` |
| Knowledge sources, SharePoint, docs | `knowledge[]` |
| Conversation flows, topics | `conversations.topics[]` |
| Architecture, multi-agent mentions | `architecture` |
| Triggers, schedules, events | `architecture.triggers` |
| Channels (Teams, M365 Copilot, web) | `architecture.channels` |
| Answers to existing open questions | `openQuestions` |

### Step 5: Show Impact Summary & Confirm

Present exact proposed changes per agent before applying:

```
## Update Summary: {projectId}

**New docs:** {count} | **Changed docs:** {count}

### Agent: {name}
| Section | Change | Source |
|---------|--------|--------|
| integrations | +1 new tool (Dynamics 365) | updated-requirements.md |
| capabilities | +2 capabilities | updated-requirements.md |
| openQuestions[3] | Resolved: "Which CRM?" → "Dynamics 365" | updated-requirements.md |

Apply these changes?
```

Wait for user confirmation before proceeding.

### Step 6: Apply Changes (Merge Rules)

Apply changes to each affected agent's `brief.json` using these merge rules:

| Field | Rule |
|-------|------|
| `instructions` | **Never overwrite.** If tools changed, add delta note to `notes.instructionsDelta` |
| `openQuestions[].answer` | **Never overwrite** existing user answers. Can resolve unanswered questions if doc provides the answer |
| `boundaries.handle/decline/refuse` | Append new items only, preserve existing |
| `integrations[]` | Add new tools, don't remove or modify existing ones |
| `conversations.topics[]` | Add new topics |
| `evals` | Append new test cases for new capabilities |
| `notes` | Append with `[update: filename]` prefix |
| Everything else | Append/merge, flag conflicts in `_updateFlags` |

**`_updateFlags`** — temporary field for user review:
```json
"_updateFlags": [
  {
    "section": "integrations",
    "type": "new_tool",
    "summary": "New doc mentions Dynamics 365, not in current design",
    "source": "updated-requirements.md",
    "timestamp": "2026-02-13T11:00:00Z"
  }
]
```

### Step 7: Append New Evals

If new capabilities were added (new items in `capabilities[]` or `boundaries.handle`), generate corresponding eval test cases and append to both the `evals` array in brief.json and the `evals.csv` file.

### Step 8: Update Manifest

Rewrite `doc-manifest.json` with:
- Updated hashes for all current docs
- Agent associations (`targetAgent`, `matchedAgents`) for newly processed docs
- `processedAt` timestamps
- `lastUpdateAt` timestamp for the overall manifest

### Step 9: Report

```
## Update Complete: {projectId}

**Documents processed:** {count}
**Agents updated:** {count}

| Agent | Changes | Flags |
|-------|---------|-------|
| {name} | +{N} systems, +{M} capabilities | {K} flags for review |

{If flags exist: "Review flagged items in the dashboard before building."}

**Next:** Review changes in dashboard. If satisfied, /mcs-build.
```

## Section Merge Rules Reference

These rules protect user edits while allowing incremental additions:

- **Append-only fields:** `capabilities[]`, `boundaries.handle`, `boundaries.decline`, `boundaries.refuse`, `integrations[]`, `conversations.topics[]`, `knowledge[]`, `scenarios[]`, `evals`
- **Never-overwrite fields:** `instructions`, `openQuestions[].answer` (when already answered)
- **Resolve fields:** `openQuestions[].answer` (when currently unanswered and doc provides answer)
- **Flag-on-conflict fields:** `business.problemStatement`, `architecture.type` — add to `_updateFlags` instead of changing

## Important Rules

- **No Agent Teams.** This is a lightweight skill — just document analysis + brief updates.
- **No web research.** Only reads local documents. If new systems are mentioned that need research, flag them in `_updateFlags` and recommend `/mcs-research` re-run for that agent.
- **Preserve user edits.** The whole point is to NOT overwrite what the user already changed.
- **doc-manifest.json is required.** If it doesn't exist, the skill cannot diff. `/mcs-research` creates it.
- **Drastic changes → recommend full research.** Don't try to handle architecture-level changes incrementally.
- **Always confirm before applying.** Show the impact summary and wait for user approval.
