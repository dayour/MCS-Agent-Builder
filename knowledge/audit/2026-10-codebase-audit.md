# Codebase audit 2026-10-19

Audit of `dayour/MCS-Agent-Builder` at `origin/main` `22de50a`. Findings below were read at the cited lines. This is not a line-by-line reading of every file. `tools/om-cli/`, `app/frontend/src/` (except the placeholder hits from search), and `knowledge/cache/` were not read through. No live tenant credentials were used. `npm ci` was not run.

## How this was checked

- Search for `execSync`, `exec(`, `spawn(`, `not yet implemented`, `TODO`, `FIXME`, `UNSUPPORTED`, and `NOT_CONFIGURED` under the repo, excluding `tools/vendor/` (that tree is not on this branch).
- Opened each hit that is cited below.
- `npm audit --package-lock-only` against `package-lock.json`. Exit code 1. The command does not install packages.

`NOT_CONFIGURED` in `tools/lib/anthropic.js` and `tools/lib/openai.js` is an error when credentials are absent. Those sites are not listed as stubs.

## Findings

### A1 — Dataverse URL is interpolated into a shell command

- Severity: **high**
- Status: **partially fixed** on branch `cursor/shell-arg-hardening-d77a`
- Evidence: `app/lib/build-pipeline.js` previously passed `az account get-access-token --resource "${envUrl}"` to `execSync`. `envUrl` is `brief.buildStatus.dataverseUrl`. That call, and `tools/lib/http.js` `getToken()` / `getTenantId()`, now go through `app/lib/az-token.js`. A resource must be an application-id GUID or an `https` URL with no user info, query, fragment, or path. On Windows the helper runs `cmd.exe /d /s /c az.cmd` only after every argument passes an allowlist that rejects `" & | < > ^ % !` and whitespace. `az` was not executed.
- Still open: other `execSync` strings still interpolate an Azure resource or account query. `app/lib/eval-pipeline.js:320`, `tools/diagnose-direct-line.js:47`, `tools/flow-build.js:95`, and `tools/upstream-specs/auth-ado-npm.js:61` are examples. Those are not marked fixed.

### A2 — PowerShell cleanup interpolates a path

- Severity: **medium**
- Status: **partially fixed** on branch `cursor/shell-arg-hardening-d77a`
- Evidence: `cleanupTempDir` calls `fs.rmSync` (`tools/solution-library.js:160`). The same file still interpolates into `execSync` at lines 377, 381, 393, 422, 527, and 763, including `pac solution export` at `:763`. Those call sites stay open.
- Impact: a path or solution name containing a quote can break out of the shell string.
- Fix: the remaining sites need an argument array only after each input is traced. Not applied beyond `cleanupTempDir`.

### A3 — Eval auto-chain calls a runner that always fails

- Severity: **medium**
- Status: **open**
- Evidence: `app/lib/skill-runner.js:14-31` `startSkill()` stores a failed job whose error is `"${skillType} pipeline not yet implemented — coming soon"`. `app/lib/pipeline.js:114-119` loads that module. `app/lib/pipeline.js:199` calls `runner.startSkill("eval", ...)`. A repo search for `onSkillComplete` finds the definition at `app/lib/pipeline.js:125` and the export at `:459`, and no caller.
- Impact: if a caller starts the exported auto-chain, eval is reported as a job and fails immediately. Nothing in the searched tree calls it, so the live build path is `app/lib/build-pipeline.js`, not this stub.
- Fix: point the auto-chain at `startEvalPipeline` in `app/lib/eval-pipeline.js` and call it from build completion only if auto-eval is still wanted. That product choice is **needs owner**. Not changed here.

### A4 — Component verifiers return skipped instead of checking

- Severity: **medium**
- Status: **open**
- Evidence: `tools/verify-component.js:202-221`. `verifyInstructions`, `verifyModel`, `verifyStarters`, `verifyTool`, `verifyKnowledge`, `verifySettings`, `verifyTrigger`, `verifyRecognizer`, `verifyPublish`, `verifyDirectLine`, and `verifyAdaptiveCard` return `status: "skipped"` with `evidence.notImplemented: true` and the reason `"verifier not yet implemented"`. The comment at `:202` says the smoke phase treats these as skipped, not failed.
- Impact: a report that counts only failures will show these components as clean. The result object does not say `passed`.
- Fix: **needs owner**. Implementing each verifier needs a live Dataverse or Gateway read-back. A local change that returns fake MATCH results would hide the gap.

### A5 — Fix-map executors are manual notes

- Severity: **low**
- Status: **open**
- Evidence: `tools/pipeline-fix-map.js:63`, `:73`, `:78`, `:88`, `:93`, `:103`, `:108`, `:113`, `:123`. Each `reason` says the executor is not implemented and names a manual step.
- Impact: the harness does not perform those repairs. The strings do not claim the repair ran.
- Fix: **needs owner** for any executor that publishes or patches a live bot. Not changed here.

### A6 — UI actions that only alert

- Severity: **low**
- Status: **open**
- Evidence: `app/frontend/src/pages/MyStuffPage.tsx:435-436` (`alert('Duplicate functionality coming soon!')`, `alert('Export functionality coming soon!')`). `app/frontend/src/components/Layout.tsx:645` (`alert('Settings functionality coming soon!')`). `app/frontend/src/components/ui/ShareDialog.tsx:140` placeholder `"Add name, group or email (coming soon)"`.
- Impact: those controls do not duplicate, export, share, or open settings.
- Fix: **needs owner** for the product behavior. Not changed here.

### A7 — Published package has no `bin` entry

- Severity: **low**
- Status: **open**
- Evidence: `package.json` `files` lists server and tools paths and does not list `bin/`. The file has no `bin` field. `README.md` tells users to run `mcs start` after `npm install -g mcs-agent-builder`. `bin/cli.js` exists and is the command implementation.
- Impact: a global install from this `package.json` does not register `mcs`. `node bin/cli.js` from a git checkout still works.
- Fix: add a `bin` map and include `bin/cli.js` in `files`. Not applied here because this branch does not carry the manifest CLI change, and the publish shape should be decided with that change.

### A8 — Spec write can overwrite a concurrent edit

- Severity: **medium**
- Status: **open**
- Evidence: `app/lib/build-pipeline.js:97-109`. `writeBrief` locks and writes the pipeline's in-memory brief. The comment records that a chat patch during the step's HTTP calls is overwritten by that stale copy.
- Impact: a user edit during a build step can be lost.
- Fix: per-step read-merge-write inside the lock. Not done. It touches every build step.

### A9 — Lockfile vulnerabilities

- Severity: **high** (one critical advisory in the production tree)
- Status: **closed** for the production critical and high advisories
- Evidence: `npm audit --omit=dev` after the lockfile update reports 3 moderate and no critical or high. `proxy-addr` is 2.0.8. `@xmldom/xmldom` is 0.8.15, `multer` is 2.4.0, `path-to-regexp` is 8.4.2, `source-map-js` is 1.2.2, and `undici` is 7.30.1. `xlsx` is 0.20.3 from `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` because the npm registry copy stops at 0.18.5 and has no patched release. `excelToCsv` still uses `readFile` and `sheet_to_csv`.
- Remaining: `mammoth` depends on `argparse` and `sprintf-js`. That chain is moderate. `npm audit fix --force` would install `mammoth@0.3.29`, a breaking downgrade, so it was not applied.

## Not claimed

- No live Copilot Studio, Dataverse, or Azure call was made.
- External agent-plugin test kits were not run for this audit. See `knowledge/research/agent-plugin-test-kits.md` on the docs branch.
- `npm audit fix` was not run.

## Follow-up pass (2026-10-19, re-anchored on `415af9c`)

A second read covered `app/server.js`, `app/lib/` (not the test files), `bin/`, `tools/` (not the internals of vendored `tools/om-cli/`), `scripts/`, `start.js`, and `.github/workflows/`. Anchors below were re-checked after merging `origin/main` `415af9c` (CI workflow #14). This is still not a line-by-line reading of every file. No fix in this section is applied on `main`.

Items already listed above are not repeated. A1 is still open on `main`. `cursor/shell-arg-hardening-d77a` (PR #13) replaces the `build-pipeline.js` `az` call and the temp-dir `Remove-Item` with `spawnSync` / `fs.rmSync`. That branch is not merged. The other `execSync` sites in A2 are still open, including the `pac solution export` call at `tools/solution-library.js:763`.

### B1 — Mutating HTTP API has no session check

- Severity: **high**
- Status: **open**, **needs owner**
- Evidence: `app/server.js:2497` `POST /api/auth/sign-out` runs `az logout`, `gh auth logout`, and `pac auth clear` through `runShell`. `app/server.js:2101-2198` starts build and analyze jobs. `app/server.js:2854` binds `127.0.0.1`.
- Impact: any process that can open that port can sign the workstation out of Azure, GitHub, and PAC, and can start pipelines. The bind limits this to the local machine unless the port is forwarded.
- Fix: a local gate on mutating `/api/*` routes. Not applied. The product choice is whether a single-user workstation is the whole threat model.

### B2 — Route params are joined into filesystem paths

- Severity: **high**
- Status: **open**
- Evidence: `app/server.js:649` joins `req.params.projectId` onto `BUILD_GUIDES` for upload. `app/server.js:482-489` joins `projectId` and `agentId` for agent state and then `mkdirSync`. Delete uses `safeSlug` at `app/server.js:254-257`. `app/server.js:1900-1907` and `:1938-1945` do the same join for enrichment body fields. `tools/solution-library.js:737-738`, `tools/diagnose-direct-line.js:36-37`, and `tools/live-smoke-eval-gate.js:97-98` join `--project` / `--agent` under `Build-Guides` with no root check.
- Impact: a `..` segment in the id reads or writes outside the intended project directory.
- Fix: one resolver that allows `^[\w-]+$` and checks the resolved path stays under `BUILD_GUIDES`. Not applied.

### B3 — Chat spec store ignores `resolveBuildGuides()`

- Severity: **medium**
- Status: **open**
- Evidence: `app/lib/chat/spec-store.js:22` sets `BUILD_GUIDES` to `path.join(__dirname, '..', '..', '..', 'Build-Guides')`. From `app/lib/chat`, three `..` segments resolve to `<repo>/Build-Guides`. Checked with `node`: `path.join('/workspace/app/lib/chat', '..', '..', '..', 'Build-Guides')` is `/workspace/Build-Guides`. Two `..` segments resolve to `/workspace/app/Build-Guides` and would be the wrong directory. `app/server.js:59-77` `resolveBuildGuides()` prefers `process.env.BUILD_GUIDES`, then `buildGuidesPath` in `~/.mcs-agent-builder/config.json`, then `<repo>/Build-Guides` when that directory exists, else `~/MCS-Agent-Builder`. spec-store does not call it.
- Impact: when the server is using the env var, the config file, or the home directory, `/api/chat` still reads and writes `<repo>/Build-Guides`.
- Fix: share `resolveBuildGuides()` with spec-store. Do not remove a `..` segment. Not applied. Same gap as B14.

### B4 — `pac solution export` interpolates `solutionName`

- Severity: **high**
- Status: **open**
- Evidence: `app/lib/pipeline.js:355-364` passes `` pac solution export --name "${solutionName}" --path "${zipPath}" `` to `execSync`. `solutionName` comes from the agentspec. The same pattern is at `tools/solution-library.js:763-765` (this is one of the untraced A2 sites).
- Impact: a quote in `solutionName` is executed by the shell.
- Fix: `spawnSync` with an argument array, and reject names that are not a single path segment. Not applied.

### B5 — Analyze API launches Claude with permission checks skipped

- Severity: **high**
- Status: **open**, **needs owner**
- Evidence: `app/lib/analyze-pipeline.js:177-185` adds `--dangerously-skip-permissions`. `app/server.js:2141-2145` can start that job from `/api/skill/start`.
- Impact: a local caller can run the Claude CLI with permission prompts skipped, on this repo and its configured tools.
- Fix: **needs owner** for how much autonomy an API-started analyze job should have. Not changed here.

### B6 — Postinstall turns on Claude permission bypass

- Severity: **high**
- Status: **open**, **needs owner**
- Evidence: `bin/postinstall.js:69-72` sets `permissions.dangerouslySkipPermissions` to true when the property is missing or explicitly `false` (`if (!settings.permissions.dangerouslySkipPermissions)`). Call sites are `:81` (project `.claude/settings.json`) and `:84-86` (user `~/.claude/settings.json`).
- Impact: `npm install` turns the bypass on for the user account, including when a settings file had already set it to false.
- Fix: **needs owner**. Removing the write changes install behavior that this package currently performs on purpose. Not changed here.

### B7 — `verify-ui.js` puts `--route` in a shell string

- Severity: **high**
- Status: **open**
- Evidence: `tools/verify-ui.js:121-135` builds `npx ${args.join(' ')}` and passes it to `execSync`. `--route` is copied into that string.
- Impact: shell metacharacters in `--route` run as commands.
- Fix: `spawnSync` with an argument array and `shell: false`. Not applied.

### B8 — `getToken()` interpolates the Dataverse URL and tenant

- Severity: **high**
- Status: **open**
- Evidence: `tools/lib/http.js:138-142` runs `` az account get-access-token --resource ${resource}${tenantArg} `` through `execSync` with no timeout. Callers include `tools/flow-manager.js` (`--org`) and `tools/add-tool.js`. `tools/flow-build.js:94-96` has the same `az` call without a timeout.
- Impact: a crafted org URL or tenant string breaks out of the command. A hung `az` process blocks the caller.
- Fix: argument array, https-or-GUID check, and a timeout. Not applied. This is separate from A1, which is the copy inside `build-pipeline.js`.

### B9 — Direct Line sign-in URL is opened through the shell

- Severity: **high**
- Status: **open**
- Evidence: `tools/direct-line-test.js:254-259` runs `start`, `open`, or `xdg-open` on `signIn.signInUrl` via `execSync`. The URL comes from the bot response.
- Impact: a quote in that URL is executed by the shell. `start.js` already opens a browser with `spawn` and an argument array.
- Fix: use that `spawn` pattern. Not applied.

### B10 — Solution download writes remote filenames as given

- Severity: **high**
- Status: **open**
- Evidence: `tools/solution-library.js:213-221` uses `--output` (`:1038`) as `targetDir` and joins `file.name` from SharePoint into `localPath`.
- Impact: `../` in a remote name, or an `--output` path outside the intended directory, writes files outside the download root.
- Fix: resolve `targetDir` under an allowlisted root and keep only `path.basename(file.name)`. Not applied.

### B11 — Doc routes use a prefix check and a project-root fallback

- Severity: **medium**
- Status: **open**
- Evidence: `app/server.js:899-905` and `:922-928` accept a path when `path.resolve(target).startsWith(path.resolve(docsDir))` with no trailing separator. `app/server.js:872-890` falls back from `docs/<safe>` to the project root file of the same name.
- Impact: a sibling directory whose name extends `docs` can pass the prefix check. The raw route can send a project-root file such as `session.json`.
- Fix: use the existing `assertWithin` helper and do not fall back outside `docs/`. Not applied.

### B12 — Eval Direct Line fallback interpolates into PowerShell

- Severity: **medium**
- Status: **open**
- Evidence: `app/lib/eval-pipeline.js:235-237` puts `envUrl` and `botId` inside single quotes in a `powershell -Command` string passed to `execSync`.
- Impact: a single quote in either value breaks the PowerShell string when this fallback runs.
- Fix: pass the script file and the values as arguments, not as one shell string. Not applied.

### B13 — PAC profile sync interpolates the tenant domain

- Severity: **medium**
- Status: **open**
- Evidence: `app/server.js:1531-1534` takes the domain from PAC `auth list` output and runs `` az login --tenant ${domain} --allow-no-subscriptions `` through `execAsync`.
- Impact: unexpected characters in that domain field are executed by the shell.
- Fix: validate the domain, then call `az` with an argument array. Not applied.

### B14 — Pipeline and server use different Build-Guides roots

- Severity: **medium**
- Status: **open**
- Evidence: `app/lib/pipeline.js:17-18` sets `BUILD_GUIDES` to `<repo>/Build-Guides`. `app/lib/chat/spec-store.js:22` does the same with three `..` segments (B3). `app/server.js:59-77` `resolveBuildGuides()` can select the env var, `~/.mcs-agent-builder/config.json`, or `~/MCS-Agent-Builder` instead.
- Impact: the auto-chain and the chat spec store can read and write a different project tree than the API.
- Fix: pass `resolveBuildGuides()` into the pipeline and spec-store. Not applied.

### B15 — Verify treats skipped checks as a green run

- Severity: **medium**
- Status: **open**
- Evidence: `tools/pipeline-test-loop.js:218-219` sets status `green` when every result is `match` or `skipped`. `tools/verify-component.js:211-213` returns `skipped` with `"verifier not yet implemented"` for instructions, model, and starters (A4). The stub list continues through `:221`.
- Impact: a run can be reported green when those verifiers did not check anything.
- Fix: do not count `skipped` as a pass unless the caller asked for a smoke run. Not applied. Implementing the verifiers themselves remains **needs owner** (A4).

### B16 — Graph download has no timeout

- Severity: **medium**
- Status: **open**
- Evidence: `tools/lib/graph-sharepoint.js:153-177` uses `https.get` and pipes to a file. No `setTimeout` on that request. Upload in the same file does set a timeout.
- Impact: a stalled download keeps the CLI running.
- Fix: destroy the request after the same timeout used for upload. Not applied.

### B17 — Diagnose and backend verify can print response bodies

- Severity: **medium**
- Status: **open**
- Evidence: `tools/diagnose-direct-line.js:54-55` writes the response body to stderr when HTTP status is not 200. `tools/backend-verify.js:201-207` stores `srv.body` from `/api/readiness/credentials` in the failure `excerpt` only inside `if (!srv.ok)`. A successful probe does not keep the body.
- Impact: a failed bot or readiness response can land in stderr or `tools/.backend-verify.last-result.json`. A passing probe does not copy `srv.body` into that file.
- Fix: log status and a short error code only. Not applied. What the readiness route returns was not re-fetched live.

### B18 — Self-test mode reports green

- Severity: **low**
- Status: **open**
- Evidence: `tools/backend-verify.js:98-100` exits 0 with `status: 'green'` when `--self-test` skips the checks.
- Impact: a wrapper that only reads `status` treats a self-test as a passed gate.
- Fix: return `status: 'self-test'`. Not applied.

### B19 — Change-token prefix is logged

- Severity: **low**
- Status: **open**
- Evidence: `tools/island-client.js:1360` prints the first 40 characters of `result.changeToken`.
- Impact: part of a token is copied into logs.
- Fix: log that a token was present, not a prefix. Not applied.

### B20 — Browser bundle can contain an Anthropic key

- Severity: **low**
- Status: **open**, **needs owner**
- Evidence: `app/frontend/src/utils/modelClient.ts:248-251` constructs `Anthropic` with `process.env.REACT_APP_ANTHROPIC_API_KEY` and `dangerouslyAllowBrowser: true`.
- Impact: if that env var is set at frontend build time, the key is in the browser bundle.
- Fix: call Anthropic only from the server. Not applied. Whether this client path is still used is a product choice.

### B21 — Job log route has no auth

- Severity: **low**
- Status: **open**
- Evidence: `app/server.js:2261-2266` is `GET /api/skill/log/:jobId`. It sends the string from `findJobLog()` (`:2094-2098`). That function asks `getJobLog` on every entry in `_pipelines` (`:2069-2085`: research, build, eval, fix, analyze, and the three hybrid pipelines) and then `skillRunner.getJobLog`. The route and `findJobLog` do not mention `rawLog`.
- Impact: a local caller who knows a job id can read that pipeline's log text, for every registered pipeline, not only the build pipeline. Same bind limitation as B1.
- Fix: same gate as B1, if that gate is added. Not applied.

Workflows `publish.yml`, `verify-upstream.yml`, and `ci.yml` (added on `main` in `415af9c`) were read. They do not interpolate untrusted input into `run:` scripts. `ci.yml` runs `npm ci --legacy-peer-deps`, `npm run frontend:build`, lint, typecheck, `npm test`, `npm run test:unit`, `node --test tools/__tests__/*.test.js`, and `npm run validate:manifests --if-present`.
