# Playwright Automation Patterns (MCS UI)

**Use Playwright ONLY for operations with no LSP/API alternative.** Check `knowledge/cache/api-capabilities.md` and `knowledge/frameworks/tool-priority.md` first — most operations now use LSP Wrapper or Island Gateway API.

**Playwright-only operations (as of 2026-02-23):** Agent creation, new OAuth connection creation, child agent connection, native eval upload.

## MCS Browser Preflight — User Sign-In (MANDATORY)

Before ANY Playwright interaction:

1. `browser_navigate` to `https://copilotstudio.microsoft.com`
2. `browser_snapshot` — extract Account (top-right) + Environment (header bar)
3. Compare against persisted config from `brief.json.buildStatus` or `session-config.json`
4. If match → proceed. If mismatch or not signed in → ask user to sign in and navigate to the correct environment. Wait for confirmation, re-snapshot.

## Model Selection — SUPERSEDED

> **Use LSP push (`agent.mcs.yml` → `aISettings.model.modelNameHint`) or `island-client.js set-model` instead.** Playwright fallback below.

```
Click model combobox → snapshot to see options → click desired model →
  Wait for "Processing your request..." → wait for "completed successfully"
```

## Tool Addition — MCP Server — SUPERSEDED

> **Use `add-tool.js` + LSP push for tools with existing connections.** Playwright only for first-time OAuth.

```
Add tool → search/select from "Create new" → "Model Context Protocol" →
  Search for MCP name → Select → Add and configure
```

## Tool Addition — Connector — SUPERSEDED (partially)

> **Use `add-tool.js` + LSP push if an OAuth connection already exists.** Playwright only for creating NEW connections.

```
Add tool → search connector → select action →
  Create connection (handle auth popup) → Add and configure
```

## Tool Addition — Computer Use

```
Add tool → "Create new" → "Computer use" →
  Write instructions → "Add and configure" → Rename → Save
```

## Auth Popups (New Tab)

```javascript
// Click "Create" → wait 3-5s → browser_tabs select index=1 →
//   snapshot → click account → wait → switch back to tab 0
```

## Topic Code Editor (for YAML paste) — SUPERSEDED

> **Use LSP push (`topics/*.mcs.yml` → `mcs-lsp.js push`) instead.** Playwright fallback below.

```
Navigate to Topics → Open topic (or create blank) →
  Click "..." → "Open code editor" →
  Clear existing YAML → Paste generated YAML →
  Close code editor (saves automatically) OR click Save
```

## File Upload (Dropzones) — fallback only

```javascript
await page.locator('input[type="file"]').first().setInputFiles('path/to/file');
```

## Publishing — fallback only (prefer PAC CLI)

```
Click "Publish" → dialog → "Publish" → "Close"
```

## Instructions Edit — SUPERSEDED

> **Use LSP push (`agent.mcs.yml` → `instructions:` field) or Dataverse API PATCH instead.** Playwright fallback below.

```
Click "Edit" on Instructions → type in textbox (Lexical editor, 8000 char limit) → Save
```

## Connected Agents

```
Agents tab → Add agent → Select from published list → Add and configure
```

## Security Toggle

```
Settings → Security → "Allow other agents to connect" → toggle ON → Save
```
