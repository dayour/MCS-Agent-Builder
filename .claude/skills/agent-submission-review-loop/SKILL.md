---
name: agent-submission-review-loop
description: >-
  Use whenever a coding agent submits a commit, branch, or PR in
  MCS-Agent-Builder, before calling the work done: review against the spec,
  Agent Plugins 1.0 manifest, security, and CI, send back task-step feedback,
  and repeat up to a retry limit.
---

# Agent submission adversarial review loop

Nothing an agent submits counts as done until it passes this loop. Review the code, assuming a stub or a skipped check until the files prove otherwise.

## Inputs

- The submission: repo, branch, head SHA, PR number if any.
- The spec: the task text plus repo docs that name the target (`README.md`, `CLAUDE.md`, `knowledge/frameworks/manifest-1.0.md`).
- The manifest spec: Agent Plugins 1.0.0 schemas under `schema/`, plus `schema/grokbot-extension.schema.json`.
- Retry limit: default **2 send-backs**, then escalate to the user.

## Each round

1. **Pin the head.** Record the head SHA. Review only that SHA, and diff it against the base branch.
2. **Completeness vs spec.** Read the code. FAIL a main path that contains TODO, FIXME, stub, placeholder, or "not implemented" markers; `UNSUPPORTED`, `NOT_CONFIGURED`, or throw-only handlers; empty bodies; hardcoded or mock data returned as real; simulated calls where the spec requires a real API; missing error handling; manifest wiring that does not match the code; or tests that only exercise mocks. Grade against the level the spec asked for.
3. **Manifest check.** Run the check in the next section.
4. **Security.** Rate each finding high, medium, or low, with file:line evidence. Cover secrets, shell and path injection, auth flows, permission scope, and `npm audit` when `node_modules` or the lockfile can be audited.
5. **CI.** Read the runs on the head SHA. This repo's manifest script is `npm run validate:manifests`. There is no `npm run gate` script and no `.github/workflows/manifests.yml`. The `ci` job in `.github/workflows/ci.yml` pins Node 22 (`node-version: '22'`), installs with `npm ci --legacy-peer-deps`, and runs `npm run validate:manifests` with no `--if-present` in the Validate manifests step. `engines` is `>=20`. There is no Node 20 job; `npm run test:unit` needs Node 22 for `node --experimental-strip-types`. If that job is absent on the head, run the unit tests and `npm run validate:manifests` locally and say that CI was not present.
6. **Verdict.** PASS means no completeness FAIL in the requested scope, a valid manifest, no high or medium security finding, and CI green or a documented reason it is absent. Otherwise SEND BACK.

## Manifest 1.0 check

Full checklist: `knowledge/frameworks/manifest-1.0.md`. Platform kits: `knowledge/research/agent-plugin-test-kits.md`.

1. Run `npm run validate:manifests`. It loads `schema/vendor/plugin.schema.json`, `schema/vendor/mcp.schema.json`, and `schema/grokbot-extension.schema.json` (Ajv 8.17.1). Record those paths and the commit SHA that last changed them (`schema/PROVENANCE.json`).
2. **`plugin.json`.** `$schema` is exactly `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`. `name` is 1-64 characters (`a-z0-9.-`, no leading, trailing, or doubled `-` or `.`) and equals the folder name. Top-level keys are only `$schema, name, version, description, author, homepage, repository, license, keywords, extensions`. No secrets.
3. **`extensions["com.grokbot"]`.** Present and schema-valid on the default profile (`emit`, `manifest validate`, and `npm run validate:manifests`). `kind` is in the schema enum. The `spec` file exists and names each capability. `approval.required` is `true`. `secretsPolicy.plaintextToAgent` is `false`. `kind: secret-sync` requires `secretsPolicy.direction: write-only`. Generated Copilot Studio packages use `kind: channel`, capability `messaging`, `runtimes.core: node-mcp-stdio`, and `level: 0`. A `level` above 0 is a FAIL unless the latest well-formed `| L<n> | pass|fail|failed | <YYYY-MM-DD> | <sha> |` row across `CONFORMANCE.md` and `ROADMAP.md` combined is `pass`. `pass` and `fail` match without case, and `failed` counts as fail. A `| L<n> |` row that is not that shape (`FAILING`, an extra column, a sha of `-`, or a date that is not a calendar day) counts as not-pass. The row must be outside CommonMark fences (a fence closes only on the same character at a length at least the opener), 4-space indented code, and HTML comments, and the date must not be in the future (`app/lib/agent-plugins/validate.js:419-501`). `homepage`, `repository`, and `author.url` that embed userinfo or a credential query key are `identity-secret` (`app/lib/agent-plugins/validate.js:543-551`). Secret-shaped values in `agent-model.json` are `manifest-secret` (`app/lib/agent-plugins/validate.js:686-698`). The `ci` job runs `npm run validate:manifests` with no `--if-present`. The import profile treats a missing extension as the warning `extension-missing` (`app/lib/agent-plugins/validate.js:30` and `:704-711`). Skills stay at `app/lib/agent-plugins/validate.js:371-406`.
4. **`mcp.json`.** `$schema` is exactly `https://agent-plugins.org/schemas/1.0.0/mcp.schema.json` and its version matches `plugin.json`. Top-level keys are only `$schema` and `mcpServers`. The stdio `command` is one token. `cwd` stays under `./`, `${PLUGIN_ROOT}`, or `${PLUGIN_DATA}`. `args` that point at the plugin resolve to files that exist, and `fs.realpathSync` must keep the target inside the plugin (`path-escape` when a symlink leaves the root, `app/lib/agent-plugins/validate.js:113-147`). `env` has no `PLUGIN_ROOT`, `PLUGIN_DATA`, or secrets. Remote URLs are HTTPS except loopback HTTP, with no user info and no fragment. Validate rejects credential query parameter names and `*-key` headers (`app/lib/agent-plugins/validate.js:169-190`). Emit drops any remote URL that has a query string, and it keeps only the public header allow-list in `app/lib/agent-plugins/generate.js:11-19`. A missing `mcp.json` is an error on the default profile and the warning `mcp-missing` on the import profile.
5. **Skills.** On the default profile, at least one `skills/<skill>/SKILL.md` is required. Each skill file has frontmatter. `name` is kebab-case, 1-64 characters, and equals the folder name. `description` is 1-1024 characters. Missing skills are `skill-missing` (an error on the gate, a warning on `manifest import`). Bad frontmatter stays `skill-frontmatter` on both profiles (`app/lib/agent-plugins/validate.js:371-406`).
6. **Wiring.** For a package this builder emitted, `core/dist/index.js` is the stdio server and `agent-model.json` is the packaged agentspec slice. `tools/list` must match the tools in `app/lib/agent-plugins/mcp-stdio-server.js`. The `com.grokbot` capability `messaging` is that conversational contract, not a live Copilot Studio call.
7. **Record the result.** Write `manifest: valid` or the violations as file plus JSON pointer. A manifest PASS does not offset a completeness FAIL.

This repo allows unit tests under `app/lib/__tests__/`. Do not apply another repo's ban on test files here.

## Send back

Write a numbered list of steps the agent can run. Each step names the file, the function or symbol, the change, and the done condition. Group steps under Completeness, Manifest, and Security, highest severity first. Post one comment per round.

Deliver it on the agent's channel: a PR comment for a Copilot cloud agent, a follow-up for a Cursor cloud agent, or an agent message for a peer bot. Wait for a new head SHA and review that SHA. At the retry limit, stop and report the outstanding steps.

## Check-in gate

Before round N+1, confirm the agent acknowledged the send-back and that each prior step is approved with evidence or rejected. If the agent stalled, count the round and escalate at the limit.

## Done

Report verdict, round count, head SHA, manifest result, findings fixed, findings outstanding, and CI state with a link. Do not merge from this loop. Do not call the work finished without a PASS on the current head SHA.
