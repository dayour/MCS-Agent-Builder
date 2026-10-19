# Agent plugin test kits

Carried from the 2026-10-19 research note for TypeScript MCP stdio packages in Agent Plugins 1.0.0, then adapted to MCS Agent Builder.

Rules: a command listed as **ran** was executed in this repo. A command listed as **unverified** was not executed here and was not re-fetched from vendor docs in this session. Do not treat an unverified row as a passing kit.

## Ran in this repo

The transcript below was captured on `4acf877f461ee0ef109b7c91b3cea1fb6e4b4836` and repeated on `3e92ce8ae1c11eb0f94b6ea4da5edf0f4b595437`. Neither commit is current `main`. `da8b0a954b0d573f548c801e8d29941c3a180ecd` was an older `origin/main` at the time of that note; it is not the base of this tree. Current `main` for the manifest fix-forward is `b7593fb57652591678d1aeb9bcc19738e903ffbe` (the squash of #18). The counts in the transcript (19 tests, 21 invalid fixtures) describe those older commits only.

| Kit | Command | Result |
|---|---|---|
| Manifest gate | `npm run validate:manifests` | Exit 0 on `4acf877f461ee0ef109b7c91b3cea1fb6e4b4836` and again on `3e92ce8ae1c11eb0f94b6ea4da5edf0f4b595437`. Two valid fixtures passed. Twenty-one invalid fixtures were rejected. Transcript below. |
| Unit tests | `node --test app/lib/__tests__/agent-plugins-*.test.js` | Exit 0 on both commits. 19 passed, 0 failed. Transcript below is the `4acf877` names and summary. The `3e92ce8` run had the same names and the same pass/fail counts. |
| CLI | `node bin/cli.js manifest emit`, `manifest import`, `manifest validate` | The unit-test run above includes the subtests `cli emit and import print a valid manifest`, `emit refuses an unrelated directory unless --force`, `spec-core import warns on third-party packages and still refuses a bad name`, and `stdio command token rejects shell strings`. |

`npm run validate:manifests` on `4acf877f461ee0ef109b7c91b3cea1fb6e4b4836`:

```
> mcs-agent-builder@1.0.3 validate:manifests
> node tools/validate-manifests.js --gate

valid schema/fixtures/valid/level-pass
valid schema/fixtures/valid/order-status
rejected schema/fixtures/invalid/apim-key-header (header-secret, header-secret)
rejected schema/fixtures/invalid/bad-name (plugin-schema, name-folder)
rejected schema/fixtures/invalid/bad-skill (skill-frontmatter)
rejected schema/fixtures/invalid/credential-header (manifest-secret, header-secret)
rejected schema/fixtures/invalid/cwd-escape (cwd-containment)
rejected schema/fixtures/invalid/extra-key (plugin-schema)
rejected schema/fixtures/invalid/http-remote (remote-url)
rejected schema/fixtures/invalid/inflated-level (level-inflated)
rejected schema/fixtures/invalid/level-bypass (level-inflated)
rejected schema/fixtures/invalid/level-failed-next (level-inflated)
rejected schema/fixtures/invalid/level-not-passing (level-inflated)
rejected schema/fixtures/invalid/missing-binding (binding-path)
rejected schema/fixtures/invalid/missing-spec (spec-file)
rejected schema/fixtures/invalid/name-mismatch (name-folder)
rejected schema/fixtures/invalid/plugin-root-env (mcp-schema, mcp-schema, mcp-schema, mcp-schema, mcp-schema, mcp-schema, mcp-schema, mcp-schema, mcp-schema, mcp-schema, mcp-schema, mcp-schema, mcp-schema, mcp-schema, mcp-schema, env-secret)
rejected schema/fixtures/invalid/query-key (remote-url)
rejected schema/fixtures/invalid/secret-env (env-secret)
rejected schema/fixtures/invalid/secret-sync-direction (secret-sync-direction)
rejected schema/fixtures/invalid/shell-command (command-token)
rejected schema/fixtures/invalid/symlink-escape (path-escape)
rejected schema/fixtures/invalid/third-party (extension-missing, mcp-missing, skill-missing)
manifests: 2 valid, 21 invalid rejected
```

npm also printed an upgrade notice (`10.9.9 -> 12.2.0`). That notice is not part of the gate result. Exit code was 0.

`node --test app/lib/__tests__/agent-plugins-*.test.js` on the same commit:

```
TAP version 13
ok 1 - emit writes a valid package and import round-trips the model without secrets
ok 2 - cli emit and import print a valid manifest
ok 3 - credential headers and query strings are omitted from the package
ok 4 - a remote server cannot replace the stdio core
ok 5 - emit refuses an unrelated directory unless --force
ok 6 - non-latin names and non-loopback 127 hosts stay valid or omitted
ok 7 - spec-core import warns on third-party packages and still refuses a bad name
ok 8 - invalid plugin JSON raises a coded error
ok 9 - manifest step failure is logged and does not stop the pipeline unless strict
ok 10 - vendored schemas match provenance hashes and canonical ids
ok 11 - valid order-status fixture passes
ok 12 - invalid fixtures fail on the rule they target
ok 13 - stdio command token rejects shell strings
ok 14 - skill frontmatter folds a multiline description
ok 15 - level evidence requires a structured pass row
ok 16 - symlink targets outside the plugin root are rejected
ok 17 - ajv loader restores Node's module path resolver
ok 18 - mcp server redacts secret fields and answers tools/call
ok 19 - mcp server stdio process lists tools
# tests 19
# suites 0
# pass 19
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

The live TAP stream also printed three `[build-pipeline]` log lines and per-test `duration_ms` blocks. The names and the summary counts above are the test result. Duration was about 655 ms. Exit code was 0.

This repo has no `npm run gate` script. Do not substitute `npm ci && npm run gate` from the darbotlabs note.

The `ci` job in `.github/workflows/ci.yml` calls the gate. Its Validate manifests step runs `npm run validate:manifests` after install, build, lint, typecheck, and the other test scripts. There is no `.github/workflows/manifests.yml`.

`npm ci` was not run for the transcript above. The lockfile resolves `microsoft-agents-objectmodel` from a private Azure DevOps feed, and this environment has no token for it. The manifest gate and the agent-plugin unit tests do not need that install. Ajv is vendored.

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
2. `node --test app/lib/__tests__/agent-plugins-*.test.js`
3. `node bin/cli.js manifest validate <plugin-dir>` on any package the change emitted
4. External kits only after they are installed and the unverified mark above is replaced with command output
