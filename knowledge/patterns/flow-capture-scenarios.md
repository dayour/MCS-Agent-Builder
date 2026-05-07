# Flow Capture Scenarios

Reference for re-capturing the API surface used by Power Automate "agent flows" and AI tool flows in MCS. Drives `tools/har-capture.js`.

## One-time setup

```bash
node tools/har-capture.js auth --channel msedge
```

Sign in with the account you want to capture as (e.g. `admin@M365CPI15209943.onmicrosoft.com` for `dktest`). Close the browser when the portal home loads. Auth state lands at `tools/auth/copilotstudio-storage.json` (gitignored).

Re-run `auth` only when capture starts hitting login redirects again (~30 days, or after Conditional Access changes).

### PowerShell line-continuation gotcha

PowerShell does NOT use bare newlines for line continuation — it uses backtick (` ` `):

```powershell
# WRONG — '--scenario' gets no value, and 'phase0-smoke' is parsed as a separate command:
node tools/har-capture.js capture --scenario
  phase0-smoke --channel msedge

# RIGHT — backtick at end of line:
node tools/har-capture.js capture --scenario `
  phase0-smoke --channel msedge

# OR keep on one line:
node tools/har-capture.js capture --scenario phase0-smoke --channel msedge
```

Bash on Windows (Git Bash) accepts `\` for continuation as usual.

## Capture size

Default capture omits response bodies → ~5 MB HAR for ~4 clicks. Pass `--full-bodies` when you need response payloads (e.g. capturing the response of `/checkFlowErrors`). Embedding all bodies for a small session is ~230 MB.

## Capture cadence

Run a capture before AND after every fix to `tools/flow-manager.js` or `tools/lib/flow-composer.js`. Diff them to confirm the fix produced the expected wire-level change:

```bash
node tools/har-capture.js capture --scenario <name> --channel msedge
# ... make code change ...
node tools/har-capture.js capture --scenario <name> --channel msedge
node tools/har-capture.js diff <before>.har <after>.har --filter workflows
```

## Scenario catalog

Each scenario assumes you start at the agent's overview page in Copilot Studio. Steps describe what you click; the named surfaces are the API calls we care about extracting via `tools/har-capture.js extract <har> --surface <name>`.

### `agent-flow-create` — create an empty agent flow

Steps:
1. Tools → New Tool → Flow → Create new
2. Wait for the editor to load
3. Close the browser

Surfaces: `agent-flow-create` (POST /workflows with category=5), `operations-catalog`, `connection-list`.

### `agent-flow-add-mcp-tool` — add an MCP-backed tool to an agent flow

Steps:
1. Open an existing agent flow (or create one)
2. Add an action → search for an MCP server (e.g. "Work IQ Copilot")
3. Pick an MCP tool from the discovery list
4. Save (Ctrl+S or click Save)
5. Close

Surfaces: `mcp-tools-discovery`, `ai-flow-create` (POST /workflows with category=7 — the AI tool wrapper), `agent-flow-save`, `verify-plan`.

### `agent-flow-add-run-an-agent` — add the "Run an agent" action

Steps:
1. Open an existing agent flow
2. Add a `Run an agent` action
3. Pick the target agent, fill prompt + outputSchema
4. Save
5. Close

Surfaces: `operation-schema` (apiOperations/InvokeAgent), `agent-flow-save`.

### `agent-flow-publish` — publish a saved agent flow

Steps:
1. Open a saved (draft) agent flow
2. Click Publish
3. Wait for "Published" toast
4. Close

Surfaces: `checkflow-errors`, `checkflow-warnings`, `agent-flow-publish` (POST /PublishComponent?ActivateFlowOnPublish=true).

### `agent-flow-open` — open an existing flow (baseline)

Steps:
1. Open an existing agent flow
2. Wait for the editor to fully render
3. Close

Surfaces: `agent-flow-open`, `connection-list`, `operations-catalog`.

### `connector-create-oauth` — create a new OAuth connection

Steps:
1. From an action picker, pick a connector requiring OAuth (e.g. SharePoint, Outlook)
2. Click Create new connection
3. Complete the OAuth consent
4. Confirm the connection appears in the connection list
5. Close

Surfaces: `connector-create`, `consent-link`, `connection-list`.

## Interpreting results

After capture, the easiest path is the existing extract mode for a single endpoint:

```bash
node tools/har-capture.js extract tools/har-captures/mcs-capture-agent-flow-publish-<ts>.har \
  --surface agent-flow-publish \
  --out tools/upstream-specs/contracts/agent-flow-publish/shape-fixture.auto.json
```

For a structured catalog of every endpoint hit during a scenario, see the inline JS one-liners under `tmp/har-analyze.js` (originally written for the manual flow.har export).

## Hygiene

- HAR files contain JWTs and session cookies — `tools/har-captures/` is gitignored. Sanitize before sharing.
- `tools/auth/copilotstudio-storage.json` IS the bearer cookie. Never commit; never paste into chat.
- Delete old captures every couple of weeks — keep only the ones tied to a contract fixture or learning.
