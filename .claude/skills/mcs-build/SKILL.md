---
name: mcs-build
description: "Build agent(s) in Copilot Studio using the fully API-native build stack with user-guided manual steps for OAuth connections. Reads brief.json for architecture mode (single/multi-agent)."
---

# MCS Agent Builder — Unified Hybrid Build Stack

Build agents in Microsoft Copilot Studio using the optimized hybrid approach: PAC CLI for listing agents and solution ALM, LSP wrapper for instructions, model, topics, knowledge, and full component sync, Dataverse API for file uploads and PvaPublish, and user-guided manual steps for new OAuth connections.

This skill handles all build modes:
- **Single Agent** — standalone build
- **Multi-Agent** — builds specialists first, then orchestrator with child connections

## BUILD DISCIPLINE — VERIFY-THEN-MARK (MANDATORY)

**These rules override all other behavior. Never skip them.**

1. **Atomic tasks**: Every build step is a SEPARATE task. "Generate file" and "upload file" and "run eval" are THREE tasks, not one.
2. **Verify after every action**: After each change, snapshot or read-back to confirm it worked.
3. **Never mark a task complete until verified**: If you can't verify, say "I did X but couldn't verify Y".
4. **File generation ≠ deployment**: Writing a local file is NOT the same as uploading it to MCS.
5. **Environment check**: Before PAC CLI ops, verify the agent's environment matches PAC CLI's active profile.
6. **Never skip MVP items**: Attempt EVERY item in the brief tagged `phase: "mvp"`. If an item fails (missing connector, API unreachable, endpoint not found), document: (a) what was tried, (b) the specific error, (c) what's needed to unblock it. A failed attempt with a clear error is valuable. A silently skipped item is a build gap. Even test builds with fictional data must attempt each step.
7. **End-of-build reconciliation**: After ALL changes, walk the brief's component list and snapshot-verify each item. Every MVP item must show MATCH, PARTIAL (with reason), FAILED (with error), or BLOCKED (with dependency). Zero items should show SKIPPED.

## Input

```
/mcs-build {projectId} {agentId}
```

Reads from:
- `Build-Guides/{projectId}/agents/{agentId}/brief.json` — THE single source of truth (architecture, tools, instructions, model, topics, everything)

Writes to:
- `Build-Guides/{projectId}/agents/{agentId}/brief.json` — updates `buildStatus` field
- `Build-Guides/{projectId}/agents/{agentId}/build-report.md` — customer-shareable summary

## Smart Build Account & Environment Gate

Every build targets a specific tenant and environment. This gate reads persisted context first and only asks the user when no prior build context exists.

### Unified Auth Gate

All auth layers (PAC CLI, Azure CLI, Dataverse API) derive from one account + environment selection. This gate ALWAYS confirms both, then verifies all layers work.

**Two-step selection: Account → Environment. Never assume the environment.**

#### Step A: Account + Environment Selection

1. **Read brief.json** → check `buildStatus.account`, `buildStatus.environment`, `buildStatus.accountId`
2. **Read `tools/session-config.json`** → get all accounts and their environments
3. **Build the confirmation question:**
   - If `buildStatus` has account + environment (previous build): pre-fill from buildStatus
   - Else if `sessionDefaults` has values: pre-fill from sessionDefaults
   - Else: no pre-fill (first time)

4. **Always ask the user to confirm** — even on resume:
   - **Q1: "Which account?"** — list accounts from session-config, pre-select the recommended one
   - **Q2: "Which environment?"** — list environments for the selected account. **This is mandatory when the account has 2+ environments.** If only 1 environment exists, auto-select but still show it in the confirmation.
   - **Single question shortcut:** If the pre-filled account has only 1 environment, combine into one yes/no: "Build on {account} / {environment}?" with "Yes (Recommended)" / "Choose different"
   - **Two questions required:** If the pre-filled account has 2+ environments, ALWAYS ask Q2 separately. Do NOT assume the last-used environment.

5. **Persist the selection** to BOTH locations:
   - `brief.json.buildStatus` → set `account`, `environment`, `accountId`
   - `session-config.json.sessionDefaults` → set `lastAccount`, `lastEnvironment`, `lastUpdated`

#### Step B: Three-Layer Verification

After account + environment are confirmed, verify ALL three layers actually work. Do not proceed until all pass.

**Layer 1 — Azure CLI (primary auth):**
```
az account show --query "{tenantId:tenantId, user:user.name}" -o json
```
- Compare `tenantId` against session-config's `tenantId` for the selected account
- **Match** → proceed
- **Mismatch or not logged in** → `az login --tenant {tenantId}` (browser popup)
- After login, re-verify: `az account show` must match

**Layer 2 — Dataverse API (environment reachable):**
```
TOKEN=$(az account get-access-token --resource <dataverseUrl> --query accessToken -o tsv)
curl -s "<dataverseUrl>/api/data/v9.2/bots?$top=1" -H "Authorization: Bearer $TOKEN"
```
- Must return HTTP 200 (regardless of how many bots exist)
- If token fails → az CLI auth is wrong for this environment
- If HTTP 4xx → Dataverse URL is wrong or environment is unreachable
- **This is the critical check** — if Dataverse API doesn't work, the build cannot proceed

**Layer 3 — PAC CLI (optional, best-effort):**
```
pac auth select --index {pacProfileIndex}
pac copilot list
```
- If PAC CLI works → log "PAC CLI: profile {index} ✓"
- If PAC CLI fails (device auth error, connection error) → log "PAC CLI: UNAVAILABLE — using Dataverse API as fallback" and continue. PAC CLI is optional in the build stack — every PAC CLI operation has a Dataverse API equivalent.
- **Do NOT block the build** on PAC CLI failure

#### Step C: Log Verification Summary

```
Auth verified: {account} / {environment}
  Azure CLI: {user} (tenant {tenantId}) ✓
  Dataverse: {dataverseUrl} reachable ✓
  PAC CLI: profile {index} ✓ | UNAVAILABLE (using API fallback)
```

**If Layer 1 or Layer 2 fails → STOP the build.** Report the failure and what the user should do.
**If only Layer 3 fails → WARN and continue.** The build uses Dataverse API for everything.

### Rules

- **Never assume the environment** — always confirm, even on resume. An account can have multiple environments.
- Never run `az logout` — only `az login` to switch tenants
- This gate runs ONCE at build start, not before every tool call
- If `az login` fails (network, MFA timeout): alert user, build cannot proceed
- If the user says "switch to [account/env]" at any point, re-run the entire gate
- If an account has no environments listed, ask the user to provide the environment name manually
- **Verification must use actual API calls, not just config lookups** — config can be stale

---

## Step 0.9: Populate Build Context

After auth is verified, capture ALL derived state into `brief.json.buildStatus` so every subsequent step reads from ONE place instead of re-deriving URLs, IDs, and GUIDs.

1. **From session-config.json** (looked up by accountId + environment name):
   - `dataverseUrl` ← `accounts[].environments[].dataverseUrl`
   - `gatewayUrl` ← `accounts[].environments[].gatewayUrl`
   - `environmentId` ← `accounts[].environments[].environmentId`

2. **From Dataverse** (if `mcsAgentId` exists — resume build):
   - `botSchemaName` ← `GET <dataverseUrl>/api/data/v9.2/bots(<mcsAgentId>)` → `schemaname` field (query full entity — `$select` can miss fields)
   - `gptComponentId` ← FetchXML query for botcomponent where `parentbotid`=`<mcsAgentId>` AND `componenttype`=15. **Must use FetchXML with `parentbotid` (logical name) — OData filter with `_parentbotid_value` is unreliable.**

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

**All subsequent steps use buildStatus fields directly:**
- Dataverse calls → `buildStatus.dataverseUrl` + `buildStatus.mcsAgentId`
- Island Gateway calls → `buildStatus.gatewayUrl` + `buildStatus.environmentId`
- LSP push/pull → `buildStatus.workspacePath`
- Description/starters PATCH → `buildStatus.gptComponentId`
- PAC CLI → `buildStatus.botSchemaName`

**After Step 1 (create agent):** Update `mcsAgentId`, `botSchemaName`, `gptComponentId` from the newly created agent.

---

## Step 0.95: Pre-flight Validation

Verify all build prerequisites before starting expensive operations. Every check uses buildStatus fields from Step 0.9:

1. **Token check**: `az account get-access-token --resource <buildStatus.dataverseUrl>` → must succeed
2. **Environment reachable**: `GET <buildStatus.dataverseUrl>/api/data/v9.2/bots?$top=1` → HTTP 200
3. **Workspace valid** (if resume): `buildStatus.workspacePath` directory exists AND has `.mcs/conn.json`
4. **Agent exists** (if resume): `GET <buildStatus.dataverseUrl>/api/data/v9.2/bots(<mcsAgentId>)` → HTTP 200
5. **Brief completeness**:
   - `instructions` is non-empty and < 8000 chars
   - `agent.name` is non-empty
   - `agent.description` is non-empty (warn if missing — PE should have generated it)
   - At least 1 MVP capability exists

**If ANY of checks 1-4 fail → STOP with clear error.** Do NOT start building. Report which check failed and what the user should do:
- Token failed → "Run `az login --tenant <tenantId>`"
- Environment unreachable → "Verify Dataverse URL in session-config.json"
- Workspace missing → "Will re-clone in Step 1e" (clear `workspacePath`, continue)
- Agent gone → "Agent was deleted. Clearing mcsAgentId, will re-create in Step 1"

**If check 5 has warnings → log them and proceed** (quality issues, not blockers).

---

## MVP Phase Filtering

**Only build items tagged `phase: "mvp"`. Skip items tagged `phase: "future"`.**

At the start of the build, scan the brief and compute the build scope:

1. **`capabilities[]`** — filter to `phase: "mvp"` only. Future capabilities are noted but not built.
2. **`integrations[]`** — only configure tools/connectors where `phase: "mvp"`. Future integrations are skipped in Step 3.
3. **`knowledge[]`** — only upload knowledge sources where `phase: "mvp"`. Future sources are skipped in Step 2.
4. **`conversations.topics[]`** — only author topics where `phase: "mvp"`. Future topics are skipped in Step 4.

Output a scope summary before proceeding:
```
## Build Scope (MVP filter)
- Capabilities: {N} MVP, {M} deferred
- Integrations: {N} MVP, {M} deferred
- Knowledge: {N} MVP, {M} deferred
- Topics: {N} MVP, {M} deferred
```

If ALL items of a type are `future` (e.g., zero MVP knowledge sources), skip that entire build step and note it.

**Deferred items** are listed in the build report (Section 9: "What Changed from Plan") so the customer knows what's coming next.

---

## Step 0.25: Solution Type Gate (after Auth Gate, before Decision Gate)

**Goal:** Prevent building agents for use cases that don't need an agent. Reads the solution type assessment from research.

```
Read brief.json.architecture.solutionType

If "agent" or not set (backwards compat) or solutionTypeOverride == true:
  → Proceed normally

If "hybrid":
  → Proceed. Log which capabilities are flow-only (won't become topics):
    "Hybrid build: {N} capabilities are flow-only — will be implemented as
    Power Automate flows, not agent topics."

If "flow":
  → HARD STOP: "This use case was assessed as a Power Automate flow, not
    an MCS agent (score {solutionTypeScore}/5). See brief for details.
    To override: set architecture.solutionTypeOverride to true in the brief,
    or tell me to 'build it as an agent anyway'."

If "not-recommended":
  → HARD STOP: "This use case was assessed as not suitable for MCS
    (score {solutionTypeScore}/5). See architecture.alternativeRecommendation
    for the suggested approach. To override: set solutionTypeOverride to true."
```

**User override:** If the user says "build it as an agent anyway," set `architecture.solutionTypeOverride = true` and `architecture.solutionType = "agent"` in brief.json, then proceed normally.

---

## Step 0.5: Decision Gate (after Auth Gate, before building)

**Goal:** Ensure critical decisions from `/mcs-research` are resolved before the build starts. Decisions with pre-applied recommended defaults are buildable, but the user should be aware of unconfirmed choices.

### Check Decisions

1. Read `brief.json.decisions[]`
2. Filter to MVP-relevant decisions only (decisions linked to `phase: "future"` capabilities are ignored)
3. Categorize pending decisions:

| Category | Gate Type | Behavior |
|----------|-----------|----------|
| `architecture` | **Hard block** | Cannot build without knowing single vs multi-agent. Stop and direct user to resolve. |
| `infrastructure` | **Hard block** | Cannot build if infrastructure choice affects agent creation (e.g., connected-agent requires external system). |
| `integration` | **Soft warning** | Recommended default pre-applied. Build proceeds. Warn user. |
| `model` | **Soft warning** | Recommended default pre-applied. Build proceeds. Warn user. |
| `topic-implementation` | **Soft warning** | Recommended default pre-applied. Build proceeds. Warn user. |

### Output

**If hard blocks exist:**
```
## Decision Gate: BLOCKED

{N} architecture/infrastructure decisions must be resolved before building:
| # | Decision | Category | Options |
|---|----------|----------|---------|
| d-001 | Single or multi-agent? | architecture | 2 options |

Resolve in brief.json (set status: "confirmed" and selectedOptionId) or in the dashboard, then re-run /mcs-build.
```
**Stop the build.** Do not proceed.

**If only soft warnings exist:**
```
## Decision Gate: PROCEEDING WITH DEFAULTS

{N} decisions have recommended defaults pre-applied (not yet confirmed by user):
| # | Decision | Category | Using Default |
|---|----------|----------|---------------|
| d-002 | How to extract web content? | integration | Azure Function + Readability |
| d-003 | Which AI model? | model | GPT-4.1 |

Building with recommended defaults. Review and confirm decisions after build, or re-run /mcs-research to change.
```
**Proceed with the build.** Log the warning and continue.

**If all decisions are confirmed or no decisions exist:**
```
Decision Gate: OK ({N} decisions confirmed, 0 pending)
```
**Proceed immediately.**

---

## Before Building — Knowledge Cache + Learnings Check

1. Read `knowledge/cache/api-capabilities.md` — check `last_verified` date
2. If stale (> 7 days), refresh: WebSearch + MS Learn for "Copilot Studio API"
4. Read `knowledge/patterns/dataverse-patterns.md` for API call patterns
5. Read `knowledge/learnings/build-methods.md` — check for agent creation precedents, known build gotchas
6. Update cache files if new findings

## Route: Determine Build Mode

Read `brief.json` → `architecture.type`:

| Value | Build Path |
|-------|-----------|
| `Single Agent` | → **Standalone Build** (below) |
| `Multi-Agent` | → **Multi-Agent Build** (below) |
| `Connected Agent` | → **Standalone Build** + external connection notes |

---

## On-Demand Teammates During Build

In addition to Topic Engineer (YAML authoring, Step 4) and QA Challenger (review, Step 4), two teammates are available on-demand when issues arise during build. They are NOT spawned at build start — only when specific conditions trigger them. This keeps simple builds fast while making complex builds resilient.

### Research Analyst — When Tool Configuration Fails

**Trigger conditions (Step 2 or Step 3):**
- Connector/MCP server not found by expected name in MCS UI
- Auth mode in MCS differs from what brief.json specifies
- Tool behavior doesn't match documentation (unexpected parameters, missing actions)
- Any error during tool configuration that the lead can't resolve in 1 attempt

**What RA does:**
- WebSearch for "[connector name] Copilot Studio" + current year
- MS Learn MCP for official connector docs
- Check if connector was renamed, deprecated, or moved to preview
- Report back: correct name, auth requirements, alternative approaches

**After RA reports:**
- Lead applies the fix (correct connector name, different auth mode, etc.)
- Update `brief.json.integrations[].notes` with the finding
- Update `knowledge/cache/connectors.md` if the discovery is broadly useful
- RA is dismissed (not kept alive for the whole build)

### Prompt Engineer — When Instructions Need Adjustment

**Trigger conditions (Step 2, after tools are configured):**
- Tool names in MCS differ from brief.json (e.g., brief says "Jira" but MCS connector is "Atlassian Jira Cloud (Preview)")
- A planned tool couldn't be added (not available, auth failed) → instructions reference non-existent tool
- Connector actions have different parameter names than expected → instructions reference wrong action names
- Instructions exceed 8000 chars after adding tool-specific guidance

**What PE does:**
- Read current instructions from brief.json
- Read actual tool configuration (names, action names) from the build session
- Produce revised instructions with corrected tool references
- Self-verify: char count < 8000, all referenced tools exist, boundaries intact

**After PE reports:**
- QA Challenger does a quick consistency check (existing QA teammate, already active in Step 4)
- Lead applies revised instructions via LSP push (edit agent.mcs.yml → push)
- Update `brief.json.instructions` with the revised version
- PE is dismissed (not kept alive for the whole build)

---

## Standalone Build (Single Agent)

### Dataverse API Shorthand

All Dataverse calls use buildStatus fields established in Step 0.9:

```bash
# Standard setup (copy-paste into any step)
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

**Description PATCH:** Now handled automatically by `mcs-lsp.js push` (patches lines 1-2 of GptComponent `data` field after LSP sync). For manual override:
```bash
curl -s -X PATCH "$DV/api/data/v9.2/botcomponents($GPT)" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "If-Match: *" \
  -d '{"data":"<updated YAML with correct lines 1-2>"}'
```

### Step 0: Resume Detection & Environment Verification

**Resume check (runs before anything else):**

1. Read `brief.json.buildStatus.completedSteps` (array)
2. If the array has entries, this is a resumed build. Log which steps will be skipped:
   ```
   Resuming build — completed steps: [created, instructions, knowledge]
   Skipping to: tools configuration (Step 3)
   ```
3. Use this mapping to decide what to skip:
   - `"created"` in list → skip Step 1 (find-or-create agent)
   - `"instructions"` in list → skip instruction paste in Step 2
   - `"knowledge"` in list → skip knowledge upload in Step 2
   - `"tools"` in list → skip tool configuration in Step 3
   - `"model"` in list → skip model selection in Step 3
   - `"topics"` in list → skip Step 4 (topic authoring)
   - **Always re-run Step 5 (publish)** — it's cheap and ensures latest state is published

**Environment verification:**

1. Check brief.json for environment info
2. Run `pac auth list` to see PAC CLI target
3. If environments don't match: plan browser-based operations
4. Log verified environment

### Step 1: Find or Create Agent

**Check for existing agent before creating.** This prevents duplicate agents on build resume or session restart.

#### 1a. Check brief.json for existing agent ID

Read `brief.json.buildStatus.mcsAgentId`:

- **If set** → verify it still exists:
  ```powershell
  pac copilot list
  ```
  - If agent ID or name found in output → skip creation, log: "Resuming work on existing agent {name} ({id})"
  - If NOT found (agent was deleted?) → clear `mcsAgentId` from buildStatus, proceed to 1b

#### 1b. Check PAC CLI for matching agent name

If no `mcsAgentId`, search for an agent with the same `displayName` from brief.json:
```powershell
pac copilot list
```
- If a matching name is found → store its ID in `brief.json.buildStatus.mcsAgentId`, skip creation
- If NOT found → proceed to 1c

#### 1c. Create new agent (Dataverse API)

Agent creation is fully API-native via Dataverse POST + PvaProvision (E2E confirmed).

1. **Create bot entity:**
   ```bash
   TOKEN=$(az account get-access-token --resource <dataverseUrl> --query accessToken -o tsv)
   curl -s -X POST "<dataverseUrl>/api/data/v9.2/bots" \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"name":"<displayName>","schemaname":"<publisherPrefix>_<schemaName>","language":1033,"runtimeprovider":0,"configuration":"{\"$kind\":\"BotConfiguration\",\"isCustomizable\":true,\"settings\":{\"GenerativeActionsEnabled\":true},\"recognizer\":{\"$kind\":\"GenerativeAIRecognizer\"}}"}'
   ```
2. **Provision in MCS runtime:**
   ```bash
   curl -s -X POST "<dataverseUrl>/api/data/v9.2/bots(<botId>)/Microsoft.Dynamics.CRM.PvaProvision" \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
   ```
3. Wait for `statuscode` to transition from `Provisioning(3)` to `Provisioned(1)` (~5-15s)
4. Set agent name (LSP push updates GptComponent `displayName` but NOT the bot entity `name`):
   ```bash
   curl -s -X PATCH "<dataverseUrl>/api/data/v9.2/bots(<botId>)" \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"name":"<displayName>"}'
   ```

**Fallback:** `pac copilot create --displayName "Name" --schemaName "cr_name" --solution "DefaultSolution" --templateFileName template.yaml` (requires extracting a template from an existing agent first).

#### 1d. Persist immediately

Write `mcsAgentId` to `brief.json.buildStatus` right after creation or detection — do NOT defer to Step 6. Also add `"created"` to `completedSteps`.

**VERIFY:** Agent exists in `pac copilot list` output and `brief.json.buildStatus.mcsAgentId` is set.

#### 1e. Clone Agent Workspace (LSP)

After the agent exists in MCS, clone it to a local workspace for headless topic authoring:

```bash
node tools/mcs-lsp.js clone \
  --workspace "Build-Guides/{projectId}/agents/{agentId}/workspace" \
  --agent-id "<mcsAgentId>" \
  --agent-name "<displayName>" \
  --env-id "<environmentId>" \
  --dataverse-url "<dataverseUrl>" \
  --gateway-url "<gatewayUrl>"
```

The clone creates a subfolder named after the agent (e.g., `workspace/Agent Name/`) containing `.mcs/conn.json`, `agent.mcs.yml`, `topics/`, `actions/`, etc.

**Two paths to distinguish:**
- `--workspace` argument = the **parent directory** (e.g., `Build-Guides/{projectId}/agents/{agentId}/workspace`)
- Clone output = the **agent subfolder** inside it (e.g., `workspace/Agent Name/`) — this is where `.mcs/conn.json` lives

**Store the agent subfolder** (the one containing `.mcs/conn.json`) in `brief.json.buildStatus.workspacePath`. All `mcs-lsp.js push` and `mcs-lsp.js pull` commands need this subfolder path, NOT the parent. If you store the parent, push/pull will fail with "no conn.json found."

**Skip if:** `buildStatus.workspacePath` exists and the directory has `.mcs/conn.json`.

**VERIFY:** Workspace directory exists with `.mcs/conn.json` and at least `agent.mcs.yml`.

#### LSP Workflow Notes
- Clone runs `postPullCleanup()` automatically — strips BOMs from `settings.mcs.yml`, removes `Signin.mcs.yml` (trailing space bug), and deletes default Lesson template topics (Lesson1-3)
- For updates: pull first (refreshes changetoken), then edit, then push
- Gen orchestration topics: use `modelDescription` for routing — `triggerQueries` may block publish
- Push response `localChanges` may under-report (shows "Settings" but actually pushes instructions, model, knowledge, topics)

#### Pre-push Validation (run before EVERY LSP push)

Before running `node tools/mcs-lsp.js push --workspace <buildStatus.workspacePath>`:

1. **Workspace exists**: `<workspacePath>/.mcs/conn.json` is present
2. **agent.mcs.yml line 1**: Starts with `# Name:` and is NOT `# Name: default`
3. **agent.mcs.yml line 2**: Is NOT `# default` (has actual description)
4. **Conversation starters**: If `conversationStarters:` exists, every entry has both `title` and `text`
5. **Instructions length**: < 8000 chars
6. **Freshness**: If last pull was > 30 min ago, pull first to avoid ConcurrencyVersionMismatch

If checks 1-3 fail → fix before pushing.
If check 4 fails → fix (missing title = silent publish failure).
If check 6 applies → pull first, then re-apply edits, then push.

**Note on metadata:** `mcs-lsp.js push` now automatically patches `botcomponent.description` (the actual MCS UI field), `botcomponent.name`, and comment headers in the `data` field — all via Dataverse API after LSP sync. Check push output for `Metadata patched` confirmation.

### Step 2: Configure Agent Metadata, Instructions & Knowledge (LSP Push — no browser)

**Skip check:** If `"instructions"` is in `completedSteps`, skip sub-steps 2a and 2b. If `"knowledge"` is in `completedSteps`, skip sub-step 2c. If both are completed, skip this entire step.

#### 2a. Agent Description & Conversation Starters

After clone, edit `agent.mcs.yml` in the workspace to set agent metadata:

**Agent description** — the MCS metadata comment on line 2 of `agent.mcs.yml`:
- Line 1: `# Name: {brief.json.agent.name}`
- Line 2: `# {brief.json.agent.description}`
- These are NOT standard YAML comments — MCS runtime parses them as metadata. After clone of a new agent, they default to `# Name: default` / `# default` — overwrite them.
- **LSP push now auto-patches metadata.** The `mcs-lsp.js push` command automatically patches three things via Dataverse API after LSP sync: (1) `botcomponent.description` column — the actual field MCS UI reads for agent description, (2) `botcomponent.name` column, (3) comment headers in the `data` YAML field. Values are read from lines 1-2 of the local `agent.mcs.yml`.

**Conversation starters** — add to the YAML body:
```yaml
conversationStarters:
  - title: "Chip label (short)"
    text: "Full prompt text sent when clicked"
  - title: "Another starter"
    text: "Another full prompt"
```

Each starter **MUST have both `title` and `text`**. Missing `title` causes a silent publish failure: PvaPublish returns HTTP 200, but `synchronizationstatus` shows `"Failed"` with `MissingRequiredProperty: Title`. Pre-push validation: verify every starter object has both fields before pushing.

Push metadata + starters via LSP:
```bash
node tools/mcs-lsp.js push --workspace "<buildStatus.workspacePath>"
```

**VERIFY:** Pull and confirm: `node tools/mcs-lsp.js pull --workspace "<buildStatus.workspacePath>"` → check line 2 has description, `conversationStarters` entries each have `title` + `text`.

#### 2b. Instructions

**Instruction-Capability Phase Alignment (before push):**
Before pushing instructions to MCS, validate that instruction content matches MVP scope:
1. Read `brief.json.capabilities[]`
2. For each capability, search instructions text for the capability name (case-insensitive substring match, also check key nouns from the capability description)
3. Record: `{ name, phase, implementationType, foundInInstructions: true/false }`
4. Flag mismatches:
   - WARN: MVP capability not found in instructions → "Capability '{name}' is MVP but instructions don't address it"
   - WARN: Future capability found in instructions → "Instructions address '{name}' but it's tagged future — promote to MVP or remove from instructions"
   - SKIP: Future capability with `implementationType: "prompt"` found in instructions → this is expected (prompt-only guidance is zero-cost, but capability should be re-tagged MVP)
5. Present mismatches to user. Proceed after acknowledgment. This is a WARNING gate, not a blocker.

**Instructions:** Edit `agent.mcs.yml` in the cloned workspace → set `instructions:` field → push via `mcs-lsp.js push`.
**Fallback:** Dataverse API PATCH botcomponent `data` field (YAML) + PvaPublish (see `knowledge/patterns/dataverse-patterns.md` § "GptComponent data field")
**Checkpoint:** After verified, add `"instructions"` to `brief.json.buildStatus.completedSteps` and set `lastCompletedStep` to `"instructions"`.

**Knowledge:** For SharePoint sites and public websites, create `.mcs.yml` files in the workspace's `knowledge/` folder → push via `mcs-lsp.js push`. For file uploads (PDF, DOCX), use Dataverse API (see `knowledge/patterns/dataverse-patterns.md` § "Operations" → `Add-BotKnowledgeFile`). See `knowledge/cache/knowledge-sources.md` for YAML format per source type.
**Phase filter:** Only configure `knowledge[]` entries where `phase == "mvp"`. Log skipped future sources.
**Fallback:** Dataverse API for file uploads
**Checkpoint:** After verified, add `"knowledge"` to `brief.json.buildStatus.completedSteps` and set `lastCompletedStep` to `"knowledge"`.

**Initial Publish:**
```powershell
pac copilot publish --bot <bot-id>
```

**VERIFY:** LSP pull → instructions text matches spec, knowledge sources listed.

**On-demand PE trigger:** After Step 3 configures tools, if tool names in MCS differ from brief.json, spawn Prompt Engineer to adjust instructions (see "On-Demand Teammates" section above). Re-apply instructions via LSP push after PE revises agent.mcs.yml.

### Before Step 3: Consult Connector & Integration Learnings

Read `knowledge/learnings/connectors.md` and `knowledge/learnings/integrations.md` (if non-empty) before configuring tools. Look for:
- Connector name mismatches (brief says "Jira" but MCS calls it "Atlassian Jira Cloud (Preview)")
- Auth mode gotchas (e.g., OAuth requires admin consent first)
- Known workarounds for specific connectors

### Step 3: Configure Tools & Model (LSP + add-tool.js — mostly headless)

**Skip check:** If `"tools"` is in `completedSteps`, skip tool configuration. If `"model"` is in `completedSteps`, skip model selection. If both are completed, skip this entire step.

#### 3a. Model Selection (LSP Push — no browser)

Edit `agent.mcs.yml` in the cloned workspace → set `aISettings.model.modelNameHint` → push.
Always select the latest available model. Check available models via `node tools/island-client.js get-models --env <envId>`.
**Checkpoint:** After model verified, add `"model"` to `completedSteps`, set `lastCompletedStep` to `"model"`.

#### 3b. Settings Configuration (type: "setting" integrations)

Before configuring tools, set agent-level settings via Dataverse `bot.configuration` JSON PATCH. These are NOT tools — they're toggles.

**ALWAYS set these defaults on every agent (non-negotiable):**
- **Generative Orchestration** → `settings.GenerativeActionsEnabled: true` — ALWAYS enable. Never use classic orchestration. Generative orchestration is required for MCP tools, knowledge grounding, and AI routing.

**Set per-brief (from `type: "setting"` integrations where `phase == "mvp"`):**
- Bing Web Search → `gptCapabilities.webBrowsing: true` (only if brief specifies)
- General Knowledge → `aISettings.useModelKnowledge: true/false`
- Content Moderation → `aISettings.contentModeration: "High"/"Medium"/"Low"`

**Standard configuration PATCH (run on every build):**
```bash
# CRITICAL: config MUST include $kind annotations and recognizer — missing these causes silent publish failure
NEW_CONFIG='{
  "$kind": "BotConfiguration",
  "isCustomizable": true,
  "settings": { "GenerativeActionsEnabled": true },
  "aISettings": { "$kind": "AISettings", "useModelKnowledge": true, "contentModeration": "High" },
  "recognizer": { "$kind": "GenerativeAIRecognizer" }
}'
# Add gptCapabilities.webBrowsing per brief
# NEVER omit recognizer — publish silently fails without it
```

**Common mistake:** Trying to add "Bing Web Search" via `add-tool.js` — it's not a connector or MCP. It's a setting toggle.

#### 3c. Tool/Connector/MCP Configuration (discover → YAML → LSP push)

**Phase filter:** Only configure `integrations[]` entries where `phase == "mvp"` AND `type` is `mcp`, `connector`, `ai-tool`, or `custom-connector`. Skip `type: "setting"` (handled in 3b) and `type: "flow"` (handled separately in PA flow creation).

**Step 1: Auto-discover connection references (ALWAYS do this first)**
```bash
node tools/add-tool.js discover-connections --dataverse-url <buildStatus.dataverseUrl>
```
This queries ALL existing connection references in the environment — from every agent, solution, and flow. If ANY agent in the environment has ever used the connector we need, the connection reference is reusable.

**Step 2: Match discovered connections to brief integrations**
For each MVP integration, find the matching connection reference:
- MCP servers (Calendar, Mail, User Profile, Teams, SharePoint) → look for `shared_a365mcpservers` connector
- Dataverse connector → look for `shared_commondataserviceforapps`
- Planner connector → look for `shared_planner`
- Outlook connector → look for `shared_office365`
- SharePoint connector → look for `shared_sharepointonline`

**Step 3: For each MATCHED integration — write YAML + push (fully headless)**
```bash
# Write action YAML to workspace/actions/ directory
# MCP example:
cat > actions/OutlookCalendarMCP.mcs.yml << EOF
# Name: Microsoft Outlook Calendar MCP
kind: TaskDialog
modelDisplayName: Microsoft Outlook Calendar MCP
modelDescription: "MCP server for calendar operations."
action:
  kind: InvokeExternalAgentTaskAction
  connectionReference: <discovered logicalName>
  connectionProperties:
    mode: Invoker
  operationDetails:
    kind: ModelContextProtocolMetadata
    operationId: <mcp_operationId>
EOF

# Push all at once
node tools/mcs-lsp.js push --workspace "<buildStatus.workspacePath>"
```

**Step 4: For each UNMATCHED integration — user-guided manual step**
Only when discover-connections returns NO matching connection for a required connector:
1. Tell the user: "No existing connection found for {connector} in this environment. Please add it to ANY agent in MCS: Tools → Add tool → {connector name} → Authenticate."
2. Wait for user confirmation
3. Re-run `discover-connections` to pick up the new connection reference
4. Proceed with YAML generation + push

**Key principle: Auto-discover first, manual only as last resort.** In most production environments, common M365 connectors (Outlook, SharePoint, Teams, Planner) already have connection references from other agents or flows.

**MCP operationId reference:**
| MCP Server | operationId | Connector |
|-----------|------------|-----------|
| Outlook Calendar | `mcp_CalendarTools` | `shared_a365mcpservers` |
| Outlook Mail | `mcp_MailTools` | `shared_a365mcpservers` |
| User Profile | `mcp_MeServer` | `shared_a365mcpservers` |
| Teams | `mcp_TeamsServer` | `shared_a365mcpservers` |
| SharePoint/OneDrive | `mcp_ODSPRemoteServer` | `shared_a365mcpservers` |

**Computer Use:** User-guided manual step — provide step-by-step instructions for MCS UI.
**Security:** Dataverse PATCH `bot.configuration.isAgentConnectable` (confirmed API).

**Checkpoint:** After all MVP tools verified, add `"tools"` to `completedSteps`, set `lastCompletedStep` to `"tools"`.

**On-demand RA trigger:** If a connector/MCP server is not found by expected name, or auth mode differs from spec, spawn Research Analyst to investigate (see "On-Demand Teammates" section above). Apply RA's findings before continuing.

**VERIFY:** Pull latest state: `node tools/mcs-lsp.js pull --workspace "<workspacePath>"` → check `actions/` folder has all expected tools.

**Error handling:** If a step fails, write the error to `brief.json.buildStatus.lastError` before stopping. On the next resume, `lastError` tells the lead what went wrong.

### Before Step 4: Consult Topic & Trigger Learnings

Read `knowledge/learnings/topics-triggers.md` (if non-empty) before authoring topics. Look for:
- YAML patterns that improved routing (trigger phrase strategies)
- Adaptive card gotchas (channel-specific rendering limits)
- Node type availability issues discovered in prior builds

### Step 4: Author Topics (LSP Push — no browser needed)

**Skip check:** If `"topics"` is in `completedSteps`, skip this entire step.

Use **Topic Engineer** teammate to generate validated YAML. **TE uses dual model co-generation** for complex topics (3+ nodes) — fires `generate-topics` via GPT and merges results. Trivial topics (< 3 nodes) use single-model generation.

**Phase filter:** Only author `conversations.topics[]` entries where `phase == "mvp"`. Log skipped future topics.

**Topic type filter:** Only generate YAML for topics where `topicType == "custom"` or `topicType == "system"` (customized system topics like Conversation Start). Topics with `topicType == "generative"` are handled by the orchestrator + instructions — no YAML needed. Log them:
```
Generative topics (handled by orchestration, no YAML needed): {list of names}
Custom topics to build: {list of names}
```

**If no custom/system MVP topics remain after filtering:** Add `"topics"` to `completedSteps` and skip. This prevents the step from being silently skipped without being marked complete.

**Adaptive card check (MANDATORY — before generating topic definitions):**

For each MVP custom topic, check `outputFormat` and `cardDesign` from brief.json:

1. If `outputFormat == "adaptive-card"` AND `cardDesign` exists:
   - Topic Engineer MUST generate the topic with adaptive card content
   - Use `knowledge/patterns/topic-patterns/adaptive-card.yaml` as the base pattern
   - Populate card JSON from `cardDesign.elements`, `cardDesign.dynamicData`, `cardDesign.schema`
   - Create via Gateway API with **text placeholder** first, then update with card YAML via LSP push (two-step — see step 4 below)

2. If `outputFormat == "adaptive-card"` but no `cardDesign`:
   - WARN: "Topic '{name}' has outputFormat: adaptive-card but no cardDesign. Using plain text."
   - Fall back to `SendActivity` with text

3. If `outputFormat == "text"` or not specified:
   - Use `SendActivity` with text (standard behavior)

For each MVP custom/system topic in the spec:
1. Topic Engineer generates topic definition (trigger phrases, actions, description). **For adaptive card topics, TE generates the full card JSON using the `cardDesign` spec.**
2. QA Challenger reviews topic definitions — **including card content if applicable**
3. **Create topic via Gateway API** (required — LSP push does NOT produce renderable topics, bm-026):
   ```bash
   # Write a JSON topic definition file, then:
   node tools/island-client.js create-topic \
     --env <buildStatus.environmentId> \
     --bot <buildStatus.mcsAgentId> \
     --topic-file <path-to-topic-def.json>
   ```
   Topic definition JSON format (text placeholder — Gateway API doesn't support cards natively):
   ```json
   {
     "schemaName": "<botSchema>.topic.TopicName",
     "displayName": "Topic Name",
     "description": "When to use / when not to use (routing signal)",
     "triggerQueries": ["phrase 1", "phrase 2"],
     "actions": [
       { "kind": "SendActivity", "id": "sendMsg1", "text": "message text (placeholder for card)" },
       { "kind": "Question", "id": "q1", "variable": "init:Topic.var", "prompt": "Ask?", "entity": "StringPrebuiltEntity" }
     ]
   }
   ```
   **ObjectModel JSON rules (bm-026):**
   - `TextSegment` uses `value` field, NOT `text`
   - `Question.variable` must be a string (`"init:Topic.var"`), NOT an object
   - `Intent` needs `$kind: "Intent"` wrapper + `displayName` in `StringExpression`
   - Server assigns real IDs — use `"00000000-0000-0000-0000-000000000000"` as placeholder

4. **For adaptive card topics (two-step process — MANDATORY when outputFormat is "adaptive-card"):**
   a. Create topic with text placeholder via Gateway API (step 3 above)
   b. Pull workspace to get the new topic YAML: `node tools/mcs-lsp.js pull --workspace "<workspacePath>"`
   c. Edit the topic `.mcs.yml` file — replace `SendActivity` with `SendMessage` + `AdaptiveCardTemplate`:
      ```yaml
      - kind: SendMessage
        id: sendCardMessage
        message:
          text: "Fallback text for channels that don't support cards"
          attachments:
            - kind: AdaptiveCardTemplate
              cardContent: |-
                ={
                  type: "AdaptiveCard",
                  '$schema': "http://adaptivecards.io/schemas/adaptive-card.json",
                  version: "1.5",
                  body: [...],
                  actions: [...]
                }
      ```
   d. Push via LSP: `node tools/mcs-lsp.js push --workspace "<workspacePath>"`
   e. **LSP push CAN update existing topics** — bm-026 only affects NEW topic creation. Since the topic was already created via Gateway API, LSP push updates the YAML content safely.
   f. See `knowledge/patterns/topic-patterns/adaptive-card.yaml` for the full pattern reference
   g. Card schema version: use `1.5` for Teams (supports Action.ToggleVisibility, ActionSet). M365 Copilot supports 1.5 with some limitations.
   h. For Action.Submit buttons in Teams: `data: { msteams: { type: "imBack", value: "user message text" } }`

5. **For system topic customization** (Conversation Start, Fallback, etc.): Edit in the cloned workspace, push via LSP. Existing topics can be updated via LSP — only NEW creation fails.

6. **Conversation Start welcome card (standard for every agent — bm-024):**
   After custom topics are created, generate an adaptive card welcome for Conversation Start:
   a. If the agent has 2+ distinct capabilities AND primary channel supports adaptive cards (Teams, Web Chat):
      - Use `knowledge/patterns/topic-patterns/welcome-card.yaml` as template
      - Populate: agent name, description, Action.Submit buttons for each key capability (max 6 for Teams)
      - Edit `workspace/.../topics/ConversationStart.mcs.yml`
      - Push via LSP
   b. If agent is purely generative with no distinct action buttons: keep text greeting (customize text only)
   c. **Do NOT skip this step.** A welcome card is the first thing users see — it sets expectations and reduces confusion.

**IMPORTANT: Do NOT use `mcs-lsp.js push` to CREATE new custom topics.** The LSP creates botcomponent records but skips internal MCS registration (NLU trigger indexing, dependency tracking, compilation), producing topics that render as empty in the visual editor. The Gateway API `BotComponentInsert` is the same code path MCS UI uses and handles all registration automatically.

**Fallback (if Gateway API fails):** Ask user to create the topic manually in MCS UI.

**Checkpoint:** After all topics verified, add `"topics"` to `completedSteps`, set `lastCompletedStep` to `"topics"`.

### Step 4.5: Post-Build Eval (Direct Line — if supported)

After the agent is configured and published, run a quick evaluation to verify the build works.

#### Check: Can This Agent Use Direct Line?

Read `brief.json.integrations[]` — if the agent uses MCP servers with user-delegated auth (Outlook, Calendar, Teams, SharePoint), Direct Line cannot authenticate users for these tools.

- **No user-delegated MCP tools** → run Direct Line eval (auto mode)
- **Has user-delegated MCP tools** → skip automated eval, generate test cases for manual testing

#### Auto Mode: Direct Line Eval

1. **Acquire token** via Token Endpoint (preferred) or Dataverse `PvaGetDirectLineEndpoint`
2. **Run safety set** via `tools/direct-line-test.js` — must pass 100%
3. **Run functional set** — target 85%
4. **Write results** to `brief.json.evalSets[].tests[].lastResult`
5. If failures found → log them in build report, user can run `/mcs-fix` post-build

#### Manual Mode: Upload Tests via Gateway API

1. Upload eval sets to MCS Evaluation tab via Gateway API:
   ```bash
   node tools/island-client.js upload-evals \
     --env <buildStatus.environmentId> \
     --bot <buildStatus.mcsAgentId> \
     --brief "Build-Guides/{projectId}/agents/{agentId}/brief.json"
   ```
2. Run evaluation for each uploaded set:
   ```bash
   node tools/island-client.js run-eval \
     --env <buildStatus.environmentId> \
     --bot <buildStatus.mcsAgentId> \
     --set-id <mcsSetId>
   ```
3. Present test summary: "Uploaded {N} eval sets ({M} tests) to MCS Evaluation tab. Evaluation running — check results in MCS or run `/mcs-eval --check-results`."
4. Generate per-set CSVs for dashboard download/reference (not for upload)
5. User checks results in MCS, or runs `/mcs-eval` later

**No iterative safety→functional→resilience loop during build.** Build is single-pass. User runs `/mcs-fix` for issues found post-deployment.

### Step 5: Publish (Dataverse PvaPublish — no browser)

**Always runs** — even on resume. Publishing is cheap and ensures the latest state is live.

**Primary method (Dataverse bound action):**
```bash
TOKEN=$(az account get-access-token --resource <dataverseUrl> --query accessToken -o tsv)
curl -s -X POST "<dataverseUrl>/api/data/v9.2/bots(<botId>)/Microsoft.Dynamics.CRM.PvaPublish" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
```

**Fallback:** `pac copilot publish --bot <bot-id>` (crashes on some agents)

**Verify via `synchronizationstatus`** (not just HTTP 200 or `publishedon`):

1. Wait 5 seconds after PvaPublish returns
2. Query the bot **without `$select`** (full entity — `$select=synchronizationstatus` returns null due to a Dataverse quirk with JSON fields):
   ```bash
   curl -s "<dataverseUrl>/api/data/v9.2/bots(<botId>)" \
     -H "Authorization: Bearer $TOKEN"
   ```
3. Parse `synchronizationstatus` (JSON string) → check `lastFinishedPublishOperation.status`:
   - `"Succeeded"` → publish confirmed, proceed
   - `"Failed"` → read `lastFinishedPublishOperation.errorMessage`, log to `buildStatus.lastError`, do NOT mark as published
   - Field empty or status pending → poll again (up to 6 attempts, 5s intervals, 30s total)
4. Also verify `publishedon` timestamp is today as a secondary check

**Common publish failures:**
| Error | Cause | Fix |
|-------|-------|-----|
| `MissingRequiredProperty: Title` | Conversation starter without `title` field | Add `title` to all starters in `agent.mcs.yml` |
| `ConcurrencyVersionMismatch` | Stale workspace — pushed without pulling first | Pull → re-edit → push |
| `InvalidComponent` | Malformed YAML in a topic or action | Run `om-cli validate` on all workspace YAML files |

**If environments don't match:** Ask user to switch PAC CLI profile or publish manually.

**Checkpoint:** After `synchronizationstatus` shows `"Succeeded"`, add `"published"` to `completedSteps`, set `lastCompletedStep` to `"published"`. Clear `lastError`.

**VERIFY:** `synchronizationstatus.lastFinishedPublishOperation.status` is `"Succeeded"` AND `publishedon` timestamp is today.

### Step 5.5: QA Build Validation Gate (Agent Teams)

**After publish and reconciliation snapshot collection, spawn QA Challenger for formal validation.**

The lead collects snapshot data during reconciliation (overview, tools tab, knowledge, topics, triggers — this already happens). Instead of the lead both collecting AND judging, now:
- **Lead collects** snapshots (existing behavior)
- **QA Challenger analyzes** the data (this step)
- **Lead reports** QA's findings and acts on the verdict

#### Pre-QA: Automated Drift Detection

Before spawning QA, run automated drift detection on all built topics:
```bash
python tools/drift-detect.py Build-Guides/{projectId}/agents/{agentId}/brief.json --validate
```
This catches missing/extra topics, trigger mismatches, and variable drift automatically. Include the drift report in QA's input data.

#### QA Challenger Receives

1. The full `brief.json` (spec — what SHOULD be configured)
2. The reconciliation snapshot summaries (what IS configured — collected by the lead)
3. The drift detection report (from `drift-detect.py` above)
4. The list of deferred `phase: "future"` items (so QA doesn't flag them as missing)

#### Check 1: Brief-vs-Actual Comparison

Walk each MVP-scoped section and compare spec to actual:

| Brief Section | What QA Checks |
|---------------|---------------|
| `agent.name` / `agent.description` | Match overview heading |
| `instructions` | Text matches (or char-count delta if large) |
| `integrations[]` (MVP) | Each tool name appears in Tools tab snapshot |
| `knowledge[]` (MVP) | Each source appears in Knowledge section |
| `conversations.topics[]` (MVP) | Each topic name appears in Topics list |
| `architecture.triggers[]` | Trigger types configured |
| `boundaries.refuse[]` | Hard boundaries present in instructions text |

#### Check 2: Cross-Reference Validation

These catch issues that simple reconciliation misses:

| Cross-Reference | What Could Be Wrong |
|----------------|-------------------|
| Instructions → Tools | Instructions mention a tool name that wasn't configured |
| Instructions → Topics | Instructions reference a `/TopicName` that doesn't exist |
| Topics → Variables | Topic YAML uses a variable that's never prompted for |
| Topics → Integrations | Topic calls a connector action that wasn't added |
| Capabilities → Instructions | Instructions include dedicated sections for future-tagged capabilities, or MVP capabilities missing from instructions |
| Adaptive Cards → Channels | Card uses features unsupported on target channel |
| Topics → outputFormat | Brief says `outputFormat: "adaptive-card"` but built topic uses plain text `SendActivity` — card was skipped |
| Conversation Start → Welcome Card | Agent has 2+ capabilities but Conversation Start uses default text greeting instead of adaptive card (bm-024) |
| (Multi-agent) Routing rules → Children | Instructions route to a child agent that isn't connected |

#### Check 3: Deviation Impact Assessment

For each deviation found during the build (Section 9 material), QA assesses:
- **Severity**: Critical (blocks core use case) / High (degrades quality) / Medium (cosmetic or edge case)
- **Can ship?**: Yes / Yes with caveat / No — blocks deployment
- **Suggested fix**: What to do about it (manual step, config change, defer to next iteration)

#### QA Output

QA writes results to `Build-Guides/{projectId}/agents/{agentId}/qa-validation.md`:

```markdown
# QA Build Validation: [Agent Name]

## Brief-vs-Actual: {N}/{M} items match
| Item | Brief Says | Agent Has | Status |
|------|-----------|-----------|--------|
| ... | ... | ... | Match / Mismatch / Missing |

## Cross-References: {N} issues found
| Issue | Severity | Detail |
|-------|----------|--------|
| ... | Critical/High/Medium | ... |

## Deviations: {N} with impact assessment
| Deviation | Severity | Can Ship? | Suggested Fix |
|-----------|----------|-----------|---------------|
| ... | ... | ... | ... |

## QA Verdict: PASS / PASS WITH CAVEATS / FAIL
[1-2 sentence summary]
```

#### How the Lead Uses the Verdict

1. **PASS** → proceed to build report
2. **PASS WITH CAVEATS** → log caveats in build report Section 9, proceed
3. **FAIL** → stop, report critical issues to user, do NOT write `"published"` to buildStatus

#### Terminal Output Update

The reconciliation line changes from:
```
Reconciliation: N/N MVP items verified
```
to:
```
QA Validation: PASS (N/N items match, 0 cross-ref issues)
```
or:
```
QA Validation: PASS WITH CAVEATS (N/N items match, 2 cross-ref issues — see qa-validation.md)
```

### Step 5.6: GPT Build Review (MANDATORY)

After QA validation verdict (Step 5.5) and before finalizing buildStatus, fire GPT-5.4:

```bash
node tools/multi-model-review.js review-brief --brief <path-to-brief.json>
node tools/multi-model-review.js review-instructions --brief <path-to-brief.json>
# Per-topic review for each custom topic YAML:
node tools/multi-model-review.js review-topics --file <path-to-topic.yaml> --brief <path-to-brief.json>
```

**What GPT checks:** Drift between brief spec and actual built agent, instruction issues that QA's structural check missed, integration gaps, per-topic logic issues (dead-end branches, missing error handling, trigger coverage).

**Merge with QA verdict:** GPT findings merge into the QA validation — union of findings, stricter wins. If GPT finds a critical issue QA missed, escalate to user before writing buildStatus.

**Never block on GPT** — if unavailable, proceed with QA verdict alone.

### Step 6: Finalize brief.json buildStatus

Write the complete buildStatus. Most fields were already written incrementally during checkpoints — this step ensures the final state is clean:

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
    "completedSteps": ["created", "instructions", "knowledge", "tools", "model", "topics", "critical-gate", "capability-iteration", "resilience", "published"],
    "lastCompletedStep": "published",
    "lastError": null
  }
}
```

---

## Multi-Agent Build

### Build Order

**Specialists first, then orchestrator:**

1. For each specialist agent defined in the spec:
   a. Create agent via Dataverse POST + PvaProvision
   b. Clone workspace (`mcs-lsp.js clone`)
   c. Set instructions (LSP push — `agent.mcs.yml`) — specialist-focused, with scope limits
   d. Add knowledge (LSP push — `knowledge/*.mcs.yml` for sites; Dataverse API for file uploads)
   e. Add tools/model (LSP push — `agent.mcs.yml` for model, `add-tool.js` for tools)
   f. Enable "Allow other agents to connect" (Dataverse PATCH `bot.configuration.isAgentConnectable`)
   g. Author topics (LSP push — `topics/*.mcs.yml`)
   h. Publish (Dataverse PvaPublish, PAC CLI fallback)
   i. **VERIFY:** Pull latest state via `mcs-lsp.js pull`, confirm all items

2. Build orchestrator:
   a. Create orchestrator via Dataverse POST + PvaProvision
   b. Clone workspace (`mcs-lsp.js clone`)
   c. Set instructions with routing rules (LSP push — `agent.mcs.yml`):
      ```
      ## Connected Specialists
      /[SpecialistName] - [when to use]

      ## Routing Rules
      - [Intent] → /[Specialist]
      ```
   d. Select model (LSP push — `agent.mcs.yml`)
   e. Connect child agents (Island Gateway API `connectedAgentDefinitionChanges`)
   f. Add orchestrator-level tools/knowledge if needed (LSP push)
   g. Author topics if needed (LSP push — `topics/*.mcs.yml`)
   h. Publish (Dataverse PvaPublish, PAC CLI fallback)
   i. **VERIFY:** All specialists connected, routing rules in instructions

### Multi-Agent Verification

After building all agents:
- Each specialist: published, sharing enabled
- Orchestrator: published, all children connected
- Routing test: send test queries to verify correct specialist is invoked

---

## End-of-Build Reconciliation — Data Collection (MANDATORY)

After ALL changes, walk the brief's **MVP-scoped** component list and snapshot each item. This data feeds the QA Build Validation Gate (Step 5.5).

| Check | How to verify |
|-------|--------------|
| Agent exists with correct name | Overview heading |
| Latest model selected | Model combobox |
| Instructions match spec | Instructions text read-back |
| MVP knowledge sources configured | Knowledge section |
| MVP tools/integrations configured | Tools tab |
| MVP triggers match spec | Triggers section |
| Agent is published | "Published [today]" |
| (Multi-agent) All specialists connected | Agents tab |
| (Multi-agent) Sharing enabled on specialists | Settings snapshot |

Collect a deferred items list:
```
Deferred to future phase: {N} capabilities, {M} integrations, {K} knowledge sources, {J} topics
```

**Then spawn QA Challenger (Step 5.5)** with the snapshot data, brief.json, and deferred items list. The QA verdict replaces the old "Reconciliation: N/N" terminal output.

## Output: Build Summary Report

After reconciliation, generate **two outputs**:

1. **Terminal output** — concise build status for the user (shown inline)
2. **Build report file** — shareable document for customer review

### Terminal Output (inline)

```
## Build Complete: [Agent Name]

**Status:** Published | **Environment:** [env] | **Account:** [account]
**QA Validation:** PASS ({N}/{N} items match, {M} cross-ref issues — see qa-validation.md)
**Eval Sets:** safety {X}% | functional {X}% | resilience {X}%
**Capabilities:** {N} passing, {M} failing, {K} not tested
**Deferred:** {J} future items (see build report Section 9)

Report saved: Build-Guides/{projectId}/agents/{agentId}/build-report.md

**Next:** Review the build report, share with customer for approval. Run /mcs-eval for standalone re-runs.
```

### Build Report File

Write to `Build-Guides/{projectId}/agents/{agentId}/build-report.md`.

This is a **customer-shareable deliverable**. Write it in clear, professional language. No internal jargon (no "PAC CLI", "Dataverse API", "LSP" — those are build methods, not customer concerns).

```markdown
# Build Summary: [Agent Name]

**Date:** [today]
**Environment:** [environment name]
**Status:** Published

---

## 1. Agent Overview

**Name:** [agent name]
**Purpose:** [1-2 sentence problem statement from spec]
**Target Users:** [who will use this agent]
**Channels:** [where it's deployed — Teams, web, etc.]

---

## 2. Architecture

**Type:** [Single Agent | Multi-Agent with N specialists]
**Model:** [model name] ([GA | Preview])
**Rationale:** [Why this architecture and model were chosen — 2-3 sentences]

[If multi-agent, list specialists:]
| Agent | Role | Status |
|-------|------|--------|
| [Orchestrator name] | Routes to specialists | Published |
| [Specialist 1] | [domain] | Published |
| [Specialist 2] | [domain] | Published |

---

## 3. Capabilities

### What This Agent Does
[Bullet list of key capabilities from the spec]

### What This Agent Declines
[Bullet list of out-of-scope items it redirects gracefully]

### Hard Boundaries
[Bullet list of things the agent will never do]

---

## 4. Tools & Integrations

| Tool / System | Purpose | Connection Type | Status |
|---------------|---------|----------------|--------|
| [e.g., Outlook Calendar] | Read/manage calendar events | MCP Server | Connected |
| [e.g., ServiceNow] | Query incidents and tickets | Custom Connector | Connected |
| [e.g., SharePoint] | Access project documents | MCP Server | Connected |

---

## 5. Knowledge Sources

| Source | Type | What It Covers |
|--------|------|---------------|
| [e.g., SharePoint site] | SharePoint | Project documentation |
| [e.g., Confluence space] | Graph Connector | Knowledge base articles |

---

## 6. Topics & Triggers

### Conversation Topics
| Topic | What It Handles |
|-------|----------------|
| [topic name] | [description] |

### Triggers
| Trigger | Type | When It Fires |
|---------|------|--------------|
| [e.g., Daily prioritization] | Recurrence | Every weekday at 8 AM |
| [e.g., User message] | Conversational | When user sends a message |

---

## 7. Key Behaviors (Instruction Summary)

[3-5 bullet summary of the agent's core behavioral rules — NOT the full 8000-char instructions, but the essence of how it behaves. Written so a customer can verify "yes, this is what we want."]

- [e.g., Always prioritizes by urgency, then due date, then assignment]
- [e.g., Outputs structured tables for worklists, narrative for leadership summaries]
- [e.g., Never makes up ticket IDs — only returns real data from source systems]

---

## 8. Open Questions

[Items that still need customer input. These block further optimization.]

| # | Question | Impact | Status |
|---|---------|--------|--------|
| 1 | [question] | [what it affects] | Open |
| 2 | [question] | [what it affects] | Open |

---

## 9. What Changed from Plan

[If anything was different from the original spec, note it here. If nothing changed, write "Built as specified."]

| Area | Originally Planned | Actually Built | Reason |
|------|-------------------|----------------|--------|
| [e.g., Jira connector] | Custom connector | Power Automate flow | On-prem auth incompatible |

---

## 10. Evaluation Status

[If eval-driven iteration ran during build:]
**Overall:** {X}/{Y} passed ({Z}%)

| Eval Set | Passed | Total | Rate | Target | Status |
|----------|--------|-------|------|--------|--------|
| Safety | X | Y | Z% | 100% | PASS/FAIL |
| Functional | X | Y | Z% | 85% | PASS/FAIL |
| Resilience | X | Y | Z% | 80% | PASS/FAIL |

**Per-Capability Status:**
| Capability | Status | Tests Passing |
|------------|--------|--------------|
| [name] | Passing/Failing | X/Y |

[If evals haven't run (--skip-eval used):]
**Status:** Pending — run `/mcs-eval` after customer review

---

## 11. Next Steps

1. **Review this report** — confirm capabilities, boundaries, and tool connections are correct
2. **Answer open questions** (Section 8) — these are needed for optimization
3. **Run evaluation tests** — automated tests will verify agent behavior
4. **Pilot deployment** — deploy to pilot users for real-world feedback
5. **Iterate** — incorporate feedback, re-run research if needed

---

*Generated by MCS Agent Builder — [date]*
```

### Rules for the Report

- **Customer-readable language** — no build toolchain details, no API references
- **Decisions explained** — every architecture/tool choice includes a "why"
- **Open questions prominent** — this is how the customer knows what input is needed
- **Spec-vs-actual transparent** — if anything changed during build, it's documented
- **Concise** — aim for 2-3 pages, not 10. Tables over paragraphs.
- **Save as file** — always write to `build-report.md` so it can be shared

---

## Post-Build Learnings Capture (MANDATORY — Two-Tier)

**After reconciliation and the build report, run the two-tier learnings capture.** This is how the system gets smarter over time.

### Tier 1: Auto-Capture (no user confirmation)

Run automatically after every build. Scan for:

1. **Zero-deviation builds:** If nothing deviated from the spec (build-report Section 9 is "Built as specified"), auto-bump `confirmed` count for every learnings entry whose tags overlap with this build's components (e.g., an agent using Dataverse API for creation confirms `bm-001`).
2. **Cache corrections:** If any cache file was updated during the build (Step 3 refreshed api-capabilities), log the correction.
3. **Confirmed approaches:** For each build step that used a known pattern from learnings, bump the entry's `confirmed` and `lastConfirmed` in `index.json`.

### Tier 2: User-Confirmed Capture (when deviations exist)

Run when the build had deviations, errors, or discoveries:

- Did something deviate from the spec? (Already captured in build-report.md Section 9)
- Did an error force a workaround? You researched the fix — that's a learning.
- Did you discover a new component or better method? That's a learning.
- Did the user override a recommendation? That's a learning.

**Before writing, run the comparison engine** (see CLAUDE.md "Learnings Protocol" § B):
1. Check `index.json` for entries with overlapping tags
2. Same scenario → BUMP (becomes Tier 1); new scenario → present to user; contradiction → FLAG both

Output a short learnings block:

```
## Learnings from this build

1. [Natural language description — e.g., "GPT-5.2 Reasoning ignores soft DECLINE boundaries. DO NOT language required."]
   **Tags:** #instructions #boundaries #gpt-5
   **File:** instructions.md
   **Action:** ADD (new entry) / BUMP bm-001 (same pattern confirmed)

Anything else to add? These will be saved to our knowledge base for future builds.
```

### Write Confirmed Learnings

After user confirms (or adds more):
- Write each learning to the appropriate `knowledge/learnings/{topic}.md` file using the entry format with `{#id}` anchors
- Update `knowledge/learnings/index.json` — add new entries or bump existing ones
- If an existing entry covers the same pattern, bump its `Confirmed` count and `lastConfirmed` instead of duplicating

### Rules

- **Don't force Tier 2** — if the build was clean and routine, Tier 1 runs silently. Say "No new learnings. Approach confirmed (N entries bumped)." and move on
- **Tier 2 requires user confirmation** — always ask before writing NEW entries to learnings files
- **Tier 1 is silent** — bump operations happen without user interaction
- **Concise entries** — one insight per entry, not paragraphs
- **Always update index.json** — both tiers must keep the index in sync
