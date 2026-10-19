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
- Status: **closed**
- Evidence: `app/lib/build-pipeline.js` and `tools/lib/http.js` `getToken()` / `getTenantId()` go through `app/lib/az-token.js` (merged in #13, `53ee1bc`). The remaining Azure calls do too: `app/lib/eval-pipeline.js` `azAccessToken(envUrl)`, `tools/diagnose-direct-line.js` `azAccessToken(envUrl)`, `tools/flow-build.js` `getAzToken` via `azAccessToken`, `tools/upstream-specs/auth-ado-npm.js` `runAz` for `account list` and `azAccessToken` with `--subscription`, and `app/lib/pipeline.js` for the Graph token. A resource must be an application-id GUID or an `https` URL with no user info, query, fragment, or path. On Windows the helper runs `cmd.exe /d /s /c az.cmd` only after every argument passes an allowlist. `az` was not executed.
- Check: wrappers that build a shell string are included, not only a backtick sitting against `execSync`.

```
rg -n --pcre2 '(?<![\w.])(execSync|execAsync|exec|runSafe|run)\(\s*(`|[^)\n]*\+)' app tools bin start.js scripts
```

Real output on this head: no matches (rg exit 1).

```
rg -n --pcre2 '(?<![\w.])(execSync|execAsync|exec)\((?!\s*["'\''])' app tools bin start.js scripts
```

```
tools/mcs-lsp.js:1291:                        tenantId = execSync(
app/frontend/src/utils/helperAgent.ts:1054:  // NOTE: Use matchAll + single replace() to avoid the exec()+mutation bug where
```

Both hits are constants, not interpolated commands. `tools/mcs-lsp.js:1291-1293` is the literal `'az account show --query tenantId -o tsv'` continued on the next line. `app/frontend/src/utils/helperAgent.ts:1054` is a comment about `String.prototype` matching, not `child_process`.

`tools/elevate-sync.js` `run` / `runSafe` (`tools/elevate-sync.js:54`, `:63`) call `execFileSync('git', args)` with `shell: false`. Refs and shas go through `assertGitRevision`. `git merge-base --is-ancestor` success is decided in JS; there is no `&& echo OK`. `bin/cli.js` doctor `run` (`bin/cli.js:380`) is `spawnSync` with an argument array and `shell: false`. `2>&1` is `mergeStderr`. `2>NUL` is `stdio` stderr `ignore`. On Windows, `az`, `pac`, `npm`, and `gh` go through `cmd.exe /d /s /c <name>.cmd`.

These `execSync` calls stay because the command text is a constant:

- `start.js:179` `git --version`
- `start.js:183` `git fetch --quiet`
- `start.js:190` `git rev-list --count HEAD..@{upstream}`
- `start.js:196` `git rev-parse HEAD`
- `start.js:200` `git status --porcelain`
- `start.js:209` `git pull --ff-only`
- `start.js:317` `npm ci --legacy-peer-deps`
- `start.js:484` `npm ci --legacy-peer-deps` (frontend)
- `start.js:527` `npm run build`
- `bin/cli.js:125` and `bin/cli.js:207` `npm install -g mcs-agent-builder@latest`
- `bin/postinstall.js:38` `npm ci --legacy-peer-deps --no-audit --no-fund`
- `bin/postinstall.js:43` `npm run build`

`scripts/dev.js:146` and `:220` spawn `cmd.exe` with a constant `/c` string (`npm run dev -- --host localhost --port 8080`, and `start` plus a fixed localhost URL). No interpolation. PIDs from `netstat` / `lsof` are accepted only when they match `^[1-9]\d*$` (`assertPid`). Ports go through `assertPort`. The git diff after pull uses `assertGitRevision` (`start.js` `git diff --name-only`).

### A2 — PowerShell cleanup interpolates a path

- Severity: **medium**
- Status: **closed**
- Evidence: `cleanupTempDir` and the extract-dir cleanup call `fs.rmSync` (`tools/solution-library.js:160`, `:377`, `:394`). `Expand-Archive` and the two XML parsers call `runPowerShellFile` (`app/lib/argv-exec.js`) with `powershell.exe` / `powershell`, `-File`, and the path as a script parameter (`tools/solution-library.js:381`, `:422`, `:525`). `pac solution export` is `exportPacSolution` (`tools/solution-library.js:759`). The script body does not interpolate the path. `az` and `pac` were not executed.

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

- Severity: **high** (one critical advisory in the tree)
- Status: **open**
- Evidence: `npm audit --package-lock-only` on 2026-10-19, exit code 1. 19 advisories: 1 critical, 11 high, 6 moderate, 1 low.
- Critical: `proxy-addr` (IP spoofing via IPv4-mapped IPv6 trust).
- High names reported: `@xmldom/xmldom`, `brace-expansion`, `js-yaml`, `microsoft-agents-objectmodel`, `multer`, `nanoid`, `path-to-regexp`, `smol-toml`, `source-map-js`, `undici`, `xlsx`.
- Fix: **needs owner** for a lockfile update. `npm ci` cannot be run here because `microsoft-agents-objectmodel` resolves from `pkgs.dev.azure.com` (see `.github/workflows/verify-upstream.yml`). An upgrade was not applied and was not verified.

## Not claimed

- No live Copilot Studio, Dataverse, or Azure call was made.
- External agent-plugin test kits were not run for this audit. See `knowledge/research/agent-plugin-test-kits.md` on the docs branch.
- `npm audit fix` was not run.

## Follow-up pass (2026-10-19, re-anchored on `415af9c`)

A second read covered `app/server.js`, `app/lib/` (not the test files), `bin/`, `tools/` (not the internals of vendored `tools/om-cli/`), `scripts/`, `start.js`, and `.github/workflows/`. Anchors below were re-checked after merging `origin/main` `415af9c` (CI workflow #14). This is still not a line-by-line reading of every file. No fix in this section is applied on `main`.

Items already listed above are not repeated. A1 and A2 are closed. PR #13 (`53ee1bc`) replaced the `build-pipeline.js` `az` call and the temp-dir `Remove-Item`. The later argv change closes the remaining A1 `az` calls and the A2 `solution-library.js` sites, including `pac solution export`.

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
- Status: **closed**
- Evidence: `app/lib/pipeline.js` and `tools/solution-library.js` call `exportPacSolution` (`app/lib/argv-exec.js`). The name must match `^[A-Za-z][A-Za-z0-9_]{0,127}$`. Linux runs `pac` with an argument array and `shell: false`. Windows runs `cmd.exe /d /s /c pac.cmd` only after every argument, including the zip path, passes the same allowlist as `az`. A quote, slash, or `..` in the name throws before spawn. `pac` was not executed.

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
- Status: **closed**
- Evidence: `tools/verify-ui.js` calls `runNpx` (`app/lib/argv-exec.js`) with an argument array and `shell: false`. On Windows that is `cmd.exe /d /s /c npx.cmd` after each argument passes the allowlist. A route character outside the allowlist throws before spawn. `npx` was not executed.

### B8 — `getToken()` interpolates the Dataverse URL and tenant

- Severity: **high**
- Status: **closed**
- Evidence: `tools/lib/http.js` `getToken()` uses `azAccessTokenJson` (merged in #13). `tools/flow-build.js` `getAzToken` uses `azAccessToken`, which checks https-or-GUID, rejects a bad tenant or subscription before spawn, and times out at 15 seconds. `az` was not executed.

### B9 — Direct Line sign-in URL is opened through the shell

- Severity: **high**
- Status: **closed**
- Evidence: `tools/direct-line-test.js` calls `openInBrowser` (`app/lib/argv-exec.js`). The URL must be `https`. Windows uses `explorer.exe`, macOS `open`, and other platforms `xdg-open`, each with the URL as one argument and `shell: false`. A non-https URL throws before spawn.

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
- Status: **closed**
- Evidence: `app/lib/eval-pipeline.js` writes a constant script and calls `runPowerShellFile` with `-Helper`, `-OrgUrl`, and `-BotId` as arguments. The org URL must be https with no userinfo, query, fragment, or path. The bot id must be a GUID. `powershell` was not executed.

### B13 — PAC profile sync interpolates the tenant domain

- Severity: **medium**
- Status: **closed**
- Evidence: `app/server.js` `runCliAsync` / `runArgv` call `execFile` with an argument array and `shell: false`. On Windows the command is `cmd.exe /d /s /c az.cmd` (or `pac.cmd` / `gh.cmd`) after `assertCliArg`. The profile-switch login is `runCliAsync("az", ["login", "--tenant", assertTenant(domain), "--allow-no-subscriptions"])`. The add-account and connect routes use the same array and reject a tenant that is not a GUID or domain. `az` was not executed.

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
