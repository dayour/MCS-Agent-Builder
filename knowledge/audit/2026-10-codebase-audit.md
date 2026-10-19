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
