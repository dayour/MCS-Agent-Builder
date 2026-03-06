<!-- CACHE METADATA
last_verified: 2026-02-27
sources: [MS Learn, PAC CLI docs, VS Code Extension docs, Dataverse entity reference, WebSearch Feb 2026, MS Learn guidance/alm, MS Learn whats-new]
confidence: high
refresh_trigger: weekly
-->
# MCS Agent Lifecycle & ALM — Quick Reference

## Creation Methods

| Method | Native MCS? | Captures Tools/Knowledge/Model? |
|--------|------------|--------------------------------|
| MCS UI | Yes | Yes (full) |
| PAC CLI (`pac copilot create`) | Yes | **No** — topics/instructions only. Template format undocumented. **Prefer Dataverse POST + PvaProvision for creation.** PAC CLI template-based creation is a fallback for environments where browser is unavailable. |
| **VS Code Extension (GA Jan 2026)** | Yes | Yes (full YAML clone) — clone/edit/sync YAML, but clone/apply are GUI-only |
| Agent Builder (M365) | Yes (limited) | Limited |
| M365 Agents SDK | No — external | N/A |
| Azure AI Foundry | No — connected (preview) | N/A |

**Agent limits**: name 42 chars, description 1,024 chars, instructions 8,000 chars, icon PNG <72KB 192x192. Primary language CANNOT change after creation.

## Publishing

- Draft → Publish → Live on ALL channels simultaneously
- Existing Teams conversations: old version until idle >30 min (or "start over")
- **Not included in publish** (manual post-deploy): App Insights, manual auth, Direct Line security, channels, sharing

### Methods
| Method | Command |
|--------|---------|
| PAC CLI | `pac copilot publish --bot <id>` |
| Dataverse API | `POST bots(<id>)/Microsoft.Dynamics.CRM.PvaPublish` |
| MCS UI | Click "Publish" |

## Component Type Codes

| Code | Type | Code | Type |
|------|------|------|------|
| 0 | Topic (classic) | 9 | Topic (V2/modern) |
| 14 | Bot File Attachment | **15** | **Custom GPT (instructions)** |
| **16** | **Knowledge Source** | 17 | External Trigger |
| 18 | Copilot Settings | 19 | Test Case |

Full list: 0-19 (also includes Skill, Variable, Entity, Dialog, Trigger, NLU, LG, Schema, Translations — types 1-8, 10-13)

## Bot Entity Key Fields

| Field | Values |
|-------|--------|
| `statecode` | 0=Active, 1=Inactive |
| `statuscode` | 1=Provisioned, 2=Deprovisioned, 3=Provisioning, 4=ProvisionFailed, 5=MissingLicense |
| `componentstate` | 0=Published, 1=Unpublished, 2=Deleted |
| `accesscontrolpolicy` | 0=Any, 1=Copilot readers, 2=Group membership, 3=Any multi-tenant |
| `authenticationmode` | 0=Unspecified, 1=None, 2=Integrated, 3=Custom AAD, 4=Generic OAuth2 |
| `synchronizationstatus` | JSON string — contains `lastFinishedPublishOperation.status` (`Succeeded` / `Failed`) |

## GptComponent Metadata (agent.mcs.yml)

The Custom GPT botcomponent (componenttype=15) `data` field contains YAML with MCS-specific comment headers:

**Comment header format (lines 1-2):**
- Line 1: `# Name: {agent display name}`
- Line 2: `# {agent description}`

These are **NOT standard YAML comments** — MCS runtime parses them as agent metadata. Line 2 becomes the agent description shown to end users when discovering the agent.

**After cloning a new agent**, the defaults are `# Name: default` / `# default` — these MUST be overwritten with the actual agent name and description during build Step 2a.

**Agent description lives in `botcomponent.description` column** (Dataverse entity field), NOT in the YAML `data` field comment headers. The comment headers (lines 1-2) are local metadata only. MCS UI reads `botcomponent.description` for the agent description shown to users.

**LSP push now auto-patches metadata (as of 2026-03-05).** The `mcs-lsp.js push` command reads lines 1-2 from local `agent.mcs.yml` and PATCHes three Dataverse fields: `botcomponent.description` (actual MCS UI field), `botcomponent.name`, and comment headers in the `data` YAML. This was discovered via the ObjectModel schema (`AgentDefinition.description` property). Publish is still required after push to make changes live.

**Conversation starters** (in the YAML body):
```yaml
conversationStarters:
  - title: "Chip label"
    text: "Full prompt text"
```
Both `title` and `text` are **required**. Missing `title` → silent publish failure (PvaPublish returns HTTP 200 but `synchronizationstatus` shows `"Failed"` with `MissingRequiredProperty: Title`).

**Publish verification:**
- Do NOT rely solely on PvaPublish HTTP 200 or `publishedon` field — these update even when publish fails internally
- Query `synchronizationstatus` field → parse JSON → check `lastFinishedPublishOperation.status`
- `"Succeeded"` = real success. `"Failed"` = read `errorMessage` for details.

## Bound Actions on `bot` Entity

`PvaPublish`, `PvaPublishStatus`, `PvaProvision`, `PvaGetDirectLineEndpoint`, `PvaDeleteBot`, `PvaAuthorize`, `PvaCreateBotComponents`, `PvaCreateContentSnapshot`

## Solution ALM

- Export: `pac solution export --name "Name" --path "file.zip" [--managed]`
- Import: `pac solution import --path "file.zip" --publish-changes`
- **Custom connectors must be imported FIRST**, then agent solution
- Cannot export topics with `.` in names; comments NOT exported
- Managed = read-only in target; Unmanaged = editable

## VS Code Extension (GA Jan 2026)

Clone → Get (cloud→local) → Edit → Apply (local→cloud, does NOT publish). Apply blocked if unreviewed remote changes. Reattach Agent for cross-environment.

**Key capabilities:**
- Full YAML clone of agents (topics, instructions, settings)
- Edit locally with IntelliSense
- Sync changes back to MCS
- **Limitation:** Clone and Apply operations are GUI-only (not scriptable)

## Copy Agent from M365 Copilot to Copilot Studio (Nov 2025)

Agents created in M365 Copilot Agent Builder can be copied to Copilot Studio to unlock:
- Enhanced lifecycle management (versioning, staged deployments, rollback, structured release)
- Usage monitoring and analytics dashboards
- Governance controls (role-based access, data policies, compliance checks)
- Advanced customization (multistep workflows, custom integrations, broader deployment)
- Environment management (dev/test/prod)

## Component Collections (Enhanced Nov 2025)

Reusable sets of agent components (topics, knowledge, actions, entities) shared across agents within an environment.
- Access collections directly from the sidebar
- Export/import via solutions for ALM across environments
- Support for primary agents, new connector types, child agents, and MCP
- Enables independent release cadences per team
- **ALM-ready**: Version-controlled, exportable as managed/unmanaged solutions

## Agent Evaluation Versioning (Dec 2025)

- Compare multiple agent versions side by side to validate improvements
- Quickly spot regressions when evaluating agents with test sets

## Versioning & Rollback

- **No built-in version numbering** for agents (but side-by-side comparison now available in evals)
- Rollback via: solution reimport, Git revert + VS Code apply, template recreation
- No native "rollback to previous version" button
- **Copy to Copilot Studio** unlocks staged deployments and rollback options

## Multitenant Mode (Preview)

Agents can be used across different Entra tenants via Teams and M365 Copilot.
- Agent hosted in one tenant, accessed from another
- Discoverable on global Teams Store
- **Limitations (preview)**: Not all features supported; SharePoint knowledge doesn't work cross-tenant
- Requires higher testing standards (separate test tenant recommended)
- Sideload via .ZIP package through Teams/MAC admin center

## ALM-Specific Non-Solution Items

These items are NOT included in solution export/import and require manual post-deployment configuration:
1. Azure Application Insights settings
2. Manual authentication settings
3. Direct Line / Web channel security settings
4. Deployed channels
5. Sharing (with other makers or end-users)
6. **Unstructured data knowledge sources** (SharePoint, OneDrive, Salesforce, Confluence, ServiceNow, ZenDesk) -- ALM not supported, importing agents doesn't trigger knowledge source processing

## ALM Golden Rules

1. Don't customize outside of a development environment
2. Always work in the context of solutions
3. Use a custom publisher and prefix
4. Create separate solutions only for independently deployable components
5. Use environment variables for settings/secrets that change across environments
6. Export/deploy solutions as managed (unless setting up dev environment)
7. Consider automating ALM for source control and automated deployments

## API Namespace Update (Nov 2025)

Update Power Platform API calls to use the new `copilotstudio` namespace. The previous namespace continues to work temporarily, but switching ensures future compatibility.

## PAC CLI Quick Reference

```powershell
pac copilot list | create | publish | status | extract-template
pac copilot extract-translation | merge-translation
pac copilot model list | model predict
pac copilot mcp --run
pac solution list | export | import | check
pac pipeline list | deploy
```
