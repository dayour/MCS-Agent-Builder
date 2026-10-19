# Agent plugin test kits

Carried from the 2026-10-19 research note for TypeScript MCP stdio packages in Agent Plugins 1.0.0, then adapted to MCS Agent Builder.

Rules: a command listed as **ran** was executed in this repo. A command listed as **unverified** was not executed here and was not re-fetched from vendor docs in this session. Do not treat an unverified row as a passing kit.

## Ran in this repo

| Kit | Command | Result |
|---|---|---|
| Manifest gate | `npm run validate:manifests` | Ran on commit `9ee7ac16760473399770eb341fc6a3506998067d`. One valid fixture passed. Fourteen invalid fixtures were rejected. |
| Unit tests | `node --test app/lib/__tests__/agent-plugins-validate.test.js app/lib/__tests__/agent-plugins-generate.test.js` | Ran on that commit. 9 passed, 0 failed. |
| CLI | `node bin/cli.js manifest emit`, `manifest import`, `manifest validate` | Covered by `agent-plugins-generate.test.js`, including a `command-token` failure on `schema/fixtures/invalid/shell-command`. |

This repo has no `npm run gate` script. Do not substitute `npm ci && npm run gate` from the darbotlabs note. CI is expected to call `npm run validate:manifests --if-present` from `.github/workflows/ci.yml` when that workflow is on the branch. This docs change does not add a workflow.

`npm ci` was not run. The lockfile resolves `microsoft-agents-objectmodel` from a private Azure DevOps feed, and this environment has no token for it. That is why Ajv is vendored.

## Unverified external kits

These rows are the 2026-10-19 note. They were **not** re-executed and their vendor pages were **not** re-fetched for this file. Treat every command as unverified until someone runs it.

| Platform | Kit | Command as recorded on 2026-10-19 | Fit for a package this builder emits |
|---|---|---|---|
| Agent Plugins | `apv` (community) | `apv validate <plugin-dir> --format json` | Schema only. It does not know `com.grokbot`. Unverified. |
| MCP runtime | MCP Inspector CLI | `npx @modelcontextprotocol/inspector --cli node <plugin>/core/dist/index.js --method tools/list` | The stdio server speaks newline-delimited JSON-RPC. Inspector support was not run. Unverified. |
| MCP protocol | `@modelcontextprotocol/conformance` | `npx @modelcontextprotocol/conformance server --url <http-url>` | Needs an HTTP URL. The emitted server is stdio. Unverified. Do not start a public endpoint without the owner's hosting and auth decision. |
| Skills | `skills-ref` | `skills-ref validate <skill-dir>` | The repo validator parses frontmatter itself. `skills-ref` was not run. Unverified. |
| GitHub Copilot CLI | Plugin loader | `copilot plugin install <dir>`, `copilot plugin list --json` | Not run. Unverified. |
| Microsoft Copilot Cowork | `wiqd` | `wiqd plugin validate --mode deep` | Not run. The 2026-10-19 note says connectors must be remote HTTPS and the layout must be translated. Unverified. |
| Microsoft 365 / Teams | Agents Toolkit | `atk validate --manifest-file appPackage/manifest.json` | Not applicable to the emitted stdio package. Unverified. |
| Claude Code | `claude plugin validate` | `claude plugin validate <dir> --strict --json` | The 2026-10-19 note says this wants a `.claude-plugin` layout. Not run. Unverified. |
| Grok Build | `grok plugin validate` | `grok plugin validate <dir>` | The 2026-10-19 note marked native Agent Plugins `mcp.json` support unverified. Still unverified. |
| Grok Bot | none found | — | `com.grokbot` is checked only by `schema/grokbot-extension.schema.json`. No public Grok Bot validator was run. |
| ChatGPT / Codex | Directory upload | ZIP upload | Not run. The 2026-10-19 note says a public HTTPS MCP is required for the hosted path. Do not stand one up without the owner's approval. |

## What to run on a review round

1. `npm run validate:manifests`
2. `node --test app/lib/__tests__/agent-plugins-validate.test.js app/lib/__tests__/agent-plugins-generate.test.js`
3. `node bin/cli.js manifest validate <plugin-dir>` on any package the change emitted
4. External kits only after they are installed and the unverified mark above is replaced with command output
