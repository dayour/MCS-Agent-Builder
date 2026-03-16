---
name: mcs-build
description: "Build agent(s) in Copilot Studio using the fully API-native build stack with user-guided manual steps for OAuth connections. Reads brief.json for architecture mode (single/multi-agent)."
---

# MCS Agent Builder — Unified Hybrid Build Stack

Build agents in Microsoft Copilot Studio using the optimized hybrid approach: PAC CLI for listing agents and solution ALM, LSP wrapper for instructions, model, topics, knowledge, and full component sync, Dataverse API for file uploads and PvaPublish, and user-guided manual steps for new OAuth connections.

This skill handles all build modes:
- **Single Agent** — standalone build
- **Multi-Agent** — builds specialists first, then orchestrator with child connections

## Build Discipline — Verify-Then-Mark

These rules apply to every build step, because unverified changes silently accumulate into broken agents.

1. **Atomic tasks**: Every build step is a separate task. "Generate file" and "upload file" and "run eval" are three tasks, not one.
2. **Verify after every action**: After each change, snapshot or read-back to confirm it worked.
3. **Do not mark a task complete until verified**: If you can't verify, say "I did X but couldn't verify Y".
4. **File generation is not deployment**: Writing a local file is not the same as uploading it to MCS.
5. **Environment check**: Before PAC CLI ops, verify the agent's environment matches PAC CLI's active profile.
6. **Attempt every MVP item**: Attempt every item in the brief tagged `phase: "mvp"`. If an item fails, document: (a) what was tried, (b) the specific error, (c) what's needed to unblock it. A failed attempt with a clear error is valuable; a silently skipped item is a build gap.
7. **End-of-build reconciliation**: After all changes, walk the brief's component list and snapshot-verify each item. Every MVP item shows MATCH, PARTIAL (with reason), FAILED (with error), or BLOCKED (with dependency). Zero items should show SKIPPED.

## Input

```
/mcs-build {projectId} {agentId}
```

Reads from:
- `Build-Guides/{projectId}/agents/{agentId}/brief.json` — the single source of truth (architecture, tools, instructions, model, topics, everything)

Writes to:
- `Build-Guides/{projectId}/agents/{agentId}/brief.json` — updates `buildStatus` field
- `Build-Guides/{projectId}/agents/{agentId}/build-report.md` — customer-shareable summary

## Smart Build Account & Environment Gate

Every build targets a specific tenant and environment. This gate reads persisted context, confirms with the user, and verifies Azure CLI + Dataverse + PAC CLI (optional) all work before proceeding.

> Full protocol: see reference/auth-gate.md

---

## Step 0.9: Populate Build Context

After auth is verified, capture all derived state into `brief.json.buildStatus` so every subsequent step reads from one place instead of re-deriving URLs, IDs, and GUIDs.

1. **From session-config.json** (looked up by accountId + environment name):
   - `dataverseUrl`, `gatewayUrl`, `environmentId`

2. **From Dataverse** (if `mcsAgentId` exists — resume build):
   - `botSchemaName` — `GET bots(<mcsAgentId>)` full entity (query without `$select` because it can miss fields)
   - `gptComponentId` — FetchXML query for botcomponent where `parentbotid`=`<mcsAgentId>` AND `componenttype`=15. Use FetchXML with `parentbotid` (logical name) because OData filter with `_parentbotid_value` is unreliable.

3. **Persist to brief.json.buildStatus** — write all fields atomically.

4. **Log Build Context:**
   ```
   Build Context:
     Agent: {name} ({mcsAgentId || "new — will be created in Step 1"})
     Environment: {environment} ({environmentId})
     Dataverse: {dataverseUrl}
     Gateway: {gatewayUrl}
     Workspace: {workspacePath || "will be created in Step 1e"}
     Tenant: {azTenantId}
   ```

All subsequent steps use buildStatus fields directly: Dataverse calls use `dataverseUrl` + `mcsAgentId`, Gateway calls use `gatewayUrl` + `environmentId`, LSP push/pull uses `workspacePath`, description PATCH uses `gptComponentId`, PAC CLI uses `botSchemaName`.

After Step 1 (create agent): update `mcsAgentId`, `botSchemaName`, `gptComponentId` from the newly created agent.

---

## Step 0.95: Pre-flight Validation

Verify all build prerequisites before starting expensive operations. Every check uses buildStatus fields from Step 0.9:

1. **Token check**: `az account get-access-token --resource <dataverseUrl>` — must succeed
2. **Environment reachable**: `GET bots?$top=1` — HTTP 200
3. **Workspace valid** (if resume): `workspacePath` directory exists with `.mcs/conn.json`
4. **Agent exists** (if resume): `GET bots(<mcsAgentId>)` — HTTP 200
5. **Brief completeness**: instructions non-empty and < 8000 chars, agent name non-empty, agent description present (warn if missing), at least 1 MVP capability

If checks 1-4 fail, stop with a clear error and remediation steps. If check 5 has warnings, log them and proceed (quality issues, not blockers). If workspace is missing, clear `workspacePath` and re-clone in Step 1e. If agent was deleted, clear `mcsAgentId` and re-create in Step 1.

---

## MVP Phase Filtering

Only build items tagged `phase: "mvp"`. Skip items tagged `phase: "future"`.

Scan the brief and compute build scope across capabilities, integrations, knowledge, and topics. Output a scope summary:
```
## Build Scope (MVP filter)
- Capabilities: {N} MVP, {M} deferred
- Integrations: {N} MVP, {M} deferred
- Knowledge: {N} MVP, {M} deferred
- Topics: {N} MVP, {M} deferred
```

If all items of a type are `future`, skip that entire build step and note it. Deferred items are listed in the build report (Section 9) so the customer knows what's coming next.

---

## Step 0.25: Solution Type Gate

Reads `brief.json.architecture.solutionType`. If "agent" or not set — proceed. If "hybrid" — proceed, log which capabilities are flow-only. If "flow" or "not-recommended" — hard stop with explanation and override instructions (`architecture.solutionTypeOverride = true`).

---

## Step 0.5: Decision Gate

Reads `brief.json.decisions[]`, filters to MVP-relevant decisions, categorizes as hard-block (`architecture`, `infrastructure`) or soft-warning (`integration`, `model`, `topic-implementation`). Hard blocks stop the build. Soft warnings proceed with recommended defaults pre-applied.

---

## Before Building — Knowledge Cache + Learnings Check

1. Read `knowledge/cache/api-capabilities.md` — check `last_verified` date
2. If stale (> 7 days), refresh via WebSearch + MS Learn
3. Read `knowledge/patterns/dataverse-patterns.md` for API call patterns
4. Read `knowledge/learnings/build-methods.md` — check for creation precedents and known gotchas
5. Update cache files if new findings

## Route: Determine Build Mode

Read `brief.json` -> `architecture.type`:

| Value | Build Path |
|-------|-----------|
| `Single Agent` | Standalone Build (below) |
| `Multi-Agent` | Multi-Agent Build (below) |
| `Connected Agent` | Standalone Build + external connection notes |

---

## On-Demand Teammates During Build

Two teammates are available on-demand when issues arise (not spawned at build start — only when specific conditions trigger them). This keeps simple builds fast while making complex builds resilient.

**Research Analyst** — spawned when tool configuration fails (connector not found, auth mode mismatch, unexpected parameters). RA searches official docs and community, reports correct name/auth/alternatives. Lead applies the fix, updates brief + cache, dismisses RA.

**Prompt Engineer** — spawned when instructions need adjustment after tools are configured (tool names differ, planned tool unavailable, action parameters changed, instructions exceed 8000 chars). PE uses GPT co-generation (`generate-instructions`) to produce and merge revised instructions. QA reviews, lead applies via LSP push, dismisses PE.

---

## Standalone Build (Single Agent)

### Dataverse API Shorthand

All Dataverse calls use buildStatus fields from Step 0.9:

```bash
TOKEN=$(az account get-access-token --resource <buildStatus.dataverseUrl> --query accessToken -o tsv)
DV="<buildStatus.dataverseUrl>"
BOT="<buildStatus.mcsAgentId>"
GPT="<buildStatus.gptComponentId>"
```

**Publish + verify pattern:**
```bash
curl -s -X POST "$DV/api/data/v9.2/bots($BOT)/Microsoft.Dynamics.CRM.PvaPublish" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
sleep 5
# Query WITHOUT $select (synchronizationstatus returns null with $select)
curl -s "$DV/api/data/v9.2/bots($BOT)" -H "Authorization: Bearer $TOKEN" | python -c "
import json, sys
data = json.load(sys.stdin)
ss = json.loads(data.get('synchronizationstatus', '{}'))
status = ss.get('lastFinishedPublishOperation', {}).get('status', 'pending')
print(f'Publish status: {status}')
"
```

**Description PATCH:** Now handled automatically by `mcs-lsp.js push` (patches lines 1-2 of GptComponent `data` field after LSP sync).

### Step 0: Resume Detection & Environment Verification

Read `brief.json.buildStatus.completedSteps`. If the array has entries, this is a resumed build — log which steps will be skipped. Mapping: `"created"` -> skip Step 1, `"instructions"` -> skip Step 2 instructions, `"knowledge"` -> skip Step 2 knowledge, `"tools"` -> skip Step 3 tools, `"model"` -> skip Step 3 model, `"topics"` -> skip Step 4. Step 5 (publish) re-runs on every build because it's cheap and ensures latest state.

### Step 1: Find or Create Agent

Check for existing agent before creating, to prevent duplicates on build resume or session restart.

**1a.** Check `brief.json.buildStatus.mcsAgentId` — if set, verify via `pac copilot list`. If found, skip creation. If not found (deleted), clear ID and proceed.

**1b.** If no ID, search `pac copilot list` for matching `displayName`. If found, store ID and skip creation.

**1c.** Create new agent via Dataverse POST + PvaProvision:
1. POST `bots` with name, schemaname, language, runtimeprovider, configuration (including `GenerativeAIRecognizer`)
2. POST `PvaProvision` bound action
3. Wait for `statuscode` to transition to `Provisioned(1)` (~5-15s)
4. PATCH bot `name` field (LSP push updates GptComponent `displayName` but not the bot entity `name`)

**Fallback:** `pac copilot create` (requires template extraction first).

**1d.** Persist `mcsAgentId` to `brief.json.buildStatus` immediately. Add `"created"` to `completedSteps`.

#### 1e. Clone Agent Workspace (LSP)

```bash
node tools/mcs-lsp.js clone \
  --workspace "Build-Guides/{projectId}/agents/{agentId}/workspace" \
  --agent-id "<mcsAgentId>" --agent-name "<displayName>" \
  --env-id "<environmentId>" --dataverse-url "<dataverseUrl>" --gateway-url "<gatewayUrl>"
```

Store the **agent subfolder** (the one containing `.mcs/conn.json`) in `buildStatus.workspacePath` — not the parent directory. Push/pull commands need the subfolder path.

Skip if `buildStatus.workspacePath` exists and the directory has `.mcs/conn.json`.

#### Pre-push Validation (run before every LSP push)

Before running `mcs-lsp.js push`:
1. Workspace exists: `<workspacePath>/.mcs/conn.json` present
2. `agent.mcs.yml` line 1: starts with `# Name:` and is not `# Name: default`
3. `agent.mcs.yml` line 2: is not `# default` (has actual description)
4. Conversation starters: every entry has both `title` and `text` (missing title causes silent publish failure)
5. Instructions: < 8000 chars
6. Freshness: if last pull was > 30 min ago, pull first to avoid ConcurrencyVersionMismatch

`mcs-lsp.js push` now automatically patches `botcomponent.description`, `botcomponent.name`, and comment headers via Dataverse API after LSP sync.

### Step 2: Configure Agent Metadata, Instructions & Knowledge

**Skip check:** If `"instructions"` and `"knowledge"` are both in `completedSteps`, skip this entire step.

**2a. Description & Starters:** Edit `agent.mcs.yml` — set lines 1-2 (name, description metadata) and `conversationStarters` (each entry needs both `title` and `text`). Push via LSP.

**2b. Instructions:** Edit `agent.mcs.yml` `instructions:` field. Run instruction-capability alignment check first (verify MVP capabilities are addressed, future capabilities are not). Push via LSP. Checkpoint: add `"instructions"` to `completedSteps`.

**Knowledge:** Create `.mcs.yml` files in `knowledge/` folder for SharePoint sites and URLs. Use Dataverse API for file uploads (PDF, DOCX). Phase filter: only MVP entries. Checkpoint: add `"knowledge"` to `completedSteps`.

**Initial Publish:** `pac copilot publish --bot <bot-id>`

**On-demand PE trigger:** After Step 3 configures tools, if tool names differ from brief, spawn PE to adjust instructions.

### Before Step 3: Consult Connector & Integration Learnings

Read `knowledge/learnings/connectors.md` and `integrations.md` — look for connector name mismatches, auth gotchas, known workarounds.

### Step 3: Configure Tools & Model

**Skip check:** If `"tools"` and `"model"` are both in `completedSteps`, skip this step.

**3a. Model Selection:** Edit `agent.mcs.yml` -> `aISettings.model.modelNameHint`. Check available models via `island-client.js get-models`. Checkpoint: add `"model"`.

**3b. Settings (type: "setting" integrations):** Patch `bot.configuration` via Dataverse. Always set: `GenerativeActionsEnabled: true`, `recognizer: GenerativeAIRecognizer`. Per-brief: web browsing, model knowledge, content moderation.

**3c. Tool/Connector/MCP Configuration:**
1. Auto-discover connection refs: `node tools/add-tool.js discover-connections --dataverse-url <url>`
2. Match discovered connections to brief integrations
3. For matched: write YAML action files to `workspace/actions/`, push via LSP
4. For unmatched: guide user to add connector in MCS UI, re-discover, then write YAML + push

**MCP operationId reference:** Calendar=`mcp_CalendarTools`, Mail=`mcp_MailTools`, User Profile=`mcp_MeServer`, Teams=`mcp_TeamsServer`, SharePoint/OneDrive=`mcp_ODSPRemoteServer`. All use connector `shared_a365mcpservers`.

Checkpoint: add `"tools"` to `completedSteps`. Verify via LSP pull that `actions/` has all expected tools.

### Before Step 4: Consult Topic & Trigger Learnings

Read `knowledge/learnings/topics-triggers.md` — look for YAML patterns, adaptive card gotchas, node type issues.

### Step 4: Author Topics (LSP Push)

**Skip check:** If `"topics"` is in `completedSteps`, skip this step.

Use **Topic Engineer** for validated YAML (dual model co-generation for 3+ node topics). Phase filter: only MVP topics. Topic type filter: only `custom` or `system` (customized) — `generative` topics are handled by orchestration, no YAML needed.

For each MVP custom/system topic:
1. TE generates topic definition (trigger phrases, actions, description)
2. QA reviews definitions
3. Create via Gateway API (required — LSP push does not produce renderable new topics):
   ```bash
   node tools/island-client.js create-topic --env <envId> --bot <botId> --topic-file <path>
   ```
4. For adaptive card topics: create with text placeholder via Gateway, pull workspace, edit YAML to add `SendMessage` + `AdaptiveCardTemplate`, push via LSP (LSP can update existing topics safely)
5. For system topic customization: edit in workspace, push via LSP
6. Conversation Start welcome card: if agent has 2+ capabilities and channel supports cards, use `welcome-card.yaml` template

Do not use `mcs-lsp.js push` to create new custom topics because the LSP skips internal MCS registration (NLU trigger indexing, compilation). Gateway API `BotComponentInsert` handles all registration automatically.

Checkpoint: add `"topics"` to `completedSteps`.

### Step 4.5: Post-Build Eval

**Check:** If agent uses MCP servers with user-delegated auth, skip automated eval (Direct Line can't authenticate). Generate test cases for manual testing instead.

**Auto mode (Direct Line):** Acquire token, run boundaries set (target 100%), run quality set (target 85%), write results to `brief.json.evalSets[].tests[].lastResult`.

**Manual mode (Gateway API):** Upload eval sets via `island-client.js upload-evals`, run via `run-eval`, present summary. User checks results in MCS or runs `/mcs-eval` later.

No iterative boundaries/quality/edge-cases loop during build. Build is single-pass. User runs `/mcs-fix` for post-deployment issues.

### Step 5: Publish (Dataverse PvaPublish)

Re-runs on every build (even resume) because publishing is cheap and ensures latest state.

```bash
curl -s -X POST "$DV/api/data/v9.2/bots($BOT)/Microsoft.Dynamics.CRM.PvaPublish" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
```

Verify via `synchronizationstatus` (not just HTTP 200): query bot without `$select`, parse `lastFinishedPublishOperation.status`. Poll up to 6 attempts at 5s intervals. Also check `publishedon` is today.

Common failures: `MissingRequiredProperty: Title` (starter without `title`), `ConcurrencyVersionMismatch` (stale workspace), `InvalidComponent` (malformed YAML).

Checkpoint: add `"published"` to `completedSteps` after `synchronizationstatus` shows `"Succeeded"`.

### Step 5.5: QA Build Validation Gate

After publish, spawn QA Challenger for formal validation. The lead collects reconciliation snapshots, runs automated drift detection (`drift-detect.py`), and QA analyzes everything: brief-vs-actual comparison, cross-reference validation, and deviation impact assessment. QA writes `qa-validation.md` with a verdict of PASS / PASS WITH CAVEATS / FAIL.

> Full QA protocol: see reference/qa-validation-gate.md

### Step 5.6: GPT Build Review

After QA validation, fire GPT-5.4 via `multi-model-review.js`: `review-brief`, `review-instructions`, and per-topic `review-topics`. GPT findings merge with QA verdict (union of findings, stricter wins). If GPT finds a critical issue QA missed, escalate to user before writing buildStatus. If GPT is unavailable, proceed with QA verdict alone.

### Step 7: Offer Library Upload (Optional)

After buildStatus is finalized, if `status == "published"` and QA verdict is not FAIL, offer: "Upload this agent to the team solution library?" If yes, run `solution-library.js upload`. This exports the solution, generates a design-spec.md, uploads to SharePoint, and auto-indexes in `solutions/index.json`. Skip if build failed or no SharePoint auth.

### Step 6: Finalize brief.json buildStatus

Write the complete buildStatus. Most fields were written incrementally during checkpoints — this step ensures the final state is clean:

```json
{
  "buildStatus": {
    "status": "published",
    "lastBuild": "2026-02-18T...",
    "mcsAgentId": "<bot-id>",
    "environment": "<env-name>",
    "account": "<account-label>",
    "accountId": "<session-config-account-id>",
    "publishedAt": "2026-02-18T...",
    "completedSteps": ["created", "instructions", "knowledge", "tools", "model", "topics", "critical-gate", "capability-iteration", "edge-cases", "published"],
    "lastCompletedStep": "published",
    "lastError": null
  }
}
```

---

## Multi-Agent Build

Build specialists first, then orchestrator. Each specialist follows the standalone build flow with specialist-focused instructions and sharing enabled. The orchestrator connects to all specialists via Island Gateway API.

> Full multi-agent protocol: see reference/multi-agent-build.md

---

## End-of-Build Reconciliation

After all changes, walk the brief's MVP-scoped component list and snapshot each item: agent name, model, instructions, knowledge sources, tools, triggers, publish status, (multi-agent) specialist connections and sharing. Collect deferred items list. Then spawn QA Challenger (Step 5.5) with the snapshot data, brief.json, and deferred items list.

## Output: Build Summary Report

After reconciliation, generate two outputs:

### Terminal Output

```
## Build Complete: [Agent Name]

**Status:** Published | **Environment:** [env] | **Account:** [account]
**QA Validation:** PASS ({N}/{N} items match, {M} cross-ref issues — see qa-validation.md)
**Eval Sets:** boundaries {X}% | quality {X}% | edge-cases {X}%
**Capabilities:** {N} passing, {M} failing, {K} not tested
**Deferred:** {J} future items (see build report Section 9)

Report saved: Build-Guides/{projectId}/agents/{agentId}/build-report.md

**Next:** Review the build report, share with customer for approval. Run /mcs-eval for standalone re-runs.
```

### Build Report File

Write a customer-shareable build report to `build-report.md` with 11 sections: overview, architecture, capabilities, tools, knowledge, topics/triggers, key behaviors, open questions, spec-vs-actual changes, eval status, and next steps.

> Full template: see reference/build-report-template.md

---

## Post-Build Learnings Capture

After the build report, run two-tier learnings capture. Tier 1 (auto) bumps confirmed counts silently for routine builds. Tier 2 (user-confirmed) captures deviations, workarounds, and discoveries as new learnings entries.

> Full protocol: see reference/learnings-capture.md
