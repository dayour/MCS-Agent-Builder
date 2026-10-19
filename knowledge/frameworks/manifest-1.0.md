# Agent Plugins 1.0 for MCS Agent Builder

Manifest 1.0 in this repo means **Agent Plugins 1.0.0** (https://agent-plugins.org/specification) plus the extension namespace **`extensions["com.grokbot"]`**. `emitPlugin()` writes a package only after the staged directory passes the default validation profile. The build pipeline's handling of that failure is in [Build hook](#build-hook).

Line numbers below are from `main` at `da8b0a954b0d573f548c801e8d29941c3a180ecd` (the squash of #10, including `439c3a3`). This branch merges that tree, so the same lines are in these files here.

## Sources

Schemas recorded in `schema/PROVENANCE.json` on 2026-10-19:

| Path | Role |
|---|---|
| `schema/vendor/plugin.schema.json` | Official `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`. SHA-256 `0a4aad95ce337878ad38802ebf0daa3fde76abe3f65400c86bcbb1ec0b3ab883`. |
| `schema/vendor/mcp.schema.json` | Official `https://agent-plugins.org/schemas/1.0.0/mcp.schema.json`. SHA-256 `6539175bfcdf43085855183e86da40ea94b166547a72b47ae9a0a390516d3acb`. |
| `schema/grokbot-extension.schema.json` | `extensions["com.grokbot"]`. Owner-supplied copy. `darbotlabs/plugins` returned HTTP 404, so the cited commit `fe3e155653aed57d60641bcd13325742644ff0b7` was not re-fetched. SHA-256 `bbb0949a0c416104a2d48ba5a584ea3252a4fba7067374d78135a680eea7a401`. |

Ajv 8.17.1 is vendored at `tools/vendor/ajv-runtime/` because `npm ci` needs the private Azure DevOps feed for `microsoft-agents-objectmodel`.

The prepared checklist for `darbotlabs/plugins` required a `plugins/<name>/core` TypeScript project, `CONFORMANCE.md`, and `npm run gate`. Those paths are not this repo's layout. The checks below are the ones the code enforces.

## How an agentspec becomes a package

`manifest emit --spec <agentspec.json> --out <parent> [--force]` (`app/lib/agent-plugins/cli.js:27-37`) and the build pipeline's manifest step call `emitPlugin()` in `app/lib/agent-plugins/generate.js`. The CLI passes `{ force }` through. The pipeline calls `emitPlugin(brief, outDir)` with no force flag (`app/lib/build-pipeline.js:156`).

```
<parent>/<plugin-name>/
├── plugin.json
├── mcp.json
├── agent-model.json
├── specs/<SPEC>.md
├── skills/<skill>/SKILL.md
└── core/
    ├── src/index.js
    └── dist/index.js
```

| agentspec | Package |
|---|---|
| `agent.name` | Folder name and `plugin.json` `name`, from `pluginNameFromAgent()` (`app/lib/agent-plugins/generate.js:22-29`). The raw name is trimmed and lowercased. Characters outside `a-z0-9.-` become `-`. Repeated `-` or `.` collapse. Leading and trailing `-` or `.` are stripped. A result longer than 64 characters is sliced and then stripped again. If that string matches `NAME_PATTERN` (`app/lib/agent-plugins/generate.js:10`), it is the name. `Order Status` becomes `order-status`. If the slug is empty or still fails the pattern (for example a name that does not yield `a-z0-9`), the name is `agent-` plus the first 8 hex characters of SHA-256 over the trimmed raw name encoded as UTF-8. The output directory basename must equal this name (`app/lib/agent-plugins/generate.js:274-277`). |
| `agent.description` | `plugin.json` `description` and the skill `description`, collapsed to one line and capped at 1024 characters. |
| `instructions`, capabilities, topics, boundaries, channels, knowledge | `agent-model.json`, which the stdio server reads. Secret-shaped keys and values are removed before the file is written. |
| `integrations[]` with a URL (`url`, `endpoint`, or `mcpUrl`) and `type` omitted or `"mcp"` | Extra `mcpServers` entry of type `streamable-http`, when `safeRemoteUrl()` accepts the URL (`app/lib/agent-plugins/generate.js:65-76` and `:108-133`). Userinfo, a fragment, or any query string (`url.search`) omits the whole server. `https` is kept. `http` is kept only for a loopback host. Anything else is omitted. Each omission is listed in the spec file. |
| headers on a kept remote server | `publicHeaders()` (`app/lib/agent-plugins/generate.js:11-19` and `:79-92`) keeps a header only when the lowercased name is in the allow-list `accept`, `accept-language`, `content-type`, `user-agent`, `x-tenant`, `x-request-id`, `x-correlation-id`, the value is a string, the value has no CR or LF, and the value does not match `SECRET_VALUE` (`app/lib/agent-plugins/generate.js:20`). Every other header is dropped. The server is still emitted. Dropped headers are counted in the omission list (`app/lib/agent-plugins/generate.js:124-131`). The recorded reason text says "not on the public allow-list" for every drop, including a secret-shaped value or a non-string value. |
| (always) | `extensions["com.grokbot"]`: `kind: channel`, `capabilities: ["messaging"]`, `approval.required: true`, `secretsPolicy.plaintextToAgent: false`, `runtimes.core: node-mcp-stdio`, `level: 0` (`app/lib/agent-plugins/generate.js:209-218`). |

`manifest emit --force` sets `options.force` on `emitPlugin()` (`app/lib/agent-plugins/generate.js:270-282`). Without it, an existing destination that is not a directory containing both `agent-model.json` and a `plugin.json` whose `name` matches the package is left in place and emit throws `OUTPUT_EXISTS`. With `--force`, that destination is replaced. `--force` does not skip validation. `emitPlugin()` still runs `validatePluginDir()` on the staged tree (`app/lib/agent-plugins/generate.js:295-300`) and throws `MANIFEST_INVALID` before the rename when that call is not ok.

`messaging` means the packaged conversational contract (channels, topics, instructions, boundaries). The stdio server does not call Copilot Studio. `core/dist/index.js` is a byte copy of `app/lib/agent-plugins/mcp-stdio-server.js`. This repo does not compile that file with `tsc`.

`level` stays 0 because emit has not recorded a later validation round. See the level row rule under Validation.

## Import

`manifest import --dir <plugin> --out <agentspec.json> [--force]` calls `importPlugin()` in `app/lib/agent-plugins/import-plugin.js`.

- `agent-model.json`, when present, restores the agentspec slice.
- `plugin.json` and `mcp.json` fill `agentPlugin` (name, version, extension, servers, skills). A missing `mcp.json` is read as `{ mcpServers: {} }` (`app/lib/agent-plugins/import-plugin.js:57`).
- Remote MCP servers that are not already in the model become `integrations[]` entries of `type: "mcp"`.
- Validation uses the import profile: `validatePluginDir(pluginRoot, { profile: "import" })` (`app/lib/agent-plugins/import-plugin.js:47`).

### Import profile and gate profile

`finalizeValidation()` (`app/lib/agent-plugins/validate.js:517-523`) splits violations by profile.

`IMPORT_WARNING_RULES` is exactly `extension-missing`, `skill-missing`, and `mcp-missing` (`app/lib/agent-plugins/validate.js:30`).

| Profile | Callers | `extension-missing`, `skill-missing`, `mcp-missing` | Every other rule | `ok` |
|---|---|---|---|---|
| `"import"` | `importPlugin()` | `warnings` | `errors` | `errors.length === 0` |
| omitted (default) | `emitPlugin()`, `manifest validate`, `tools/validate-manifests.js --gate` (`tools/validate-manifests.js:42`) | `errors` (`warnings` is empty) | `errors` | `violations.length === 0` |

Those three warning rules are only the absence cases:

- `extension-missing` — `extensions["com.grokbot"]` is missing or not an object (`app/lib/agent-plugins/validate.js:382-383`). A present extension that fails `grokbot-extension.schema.json` is `extension-schema`, which stays an error on import.
- `skill-missing` — no `skills/` directory (`app/lib/agent-plugins/validate.js:268-269`), or the directory has no `skills/<name>/SKILL.md` (`app/lib/agent-plugins/validate.js:274-275`). Bad frontmatter, a bad skill name, or a bad description is `skill-frontmatter` (`app/lib/agent-plugins/validate.js:287-300`) and stays an error on import.
- `mcp-missing` — `mcp.json` is absent (`app/lib/agent-plugins/validate.js:438-439`). Invalid JSON or a schema failure is `mcp-schema` and stays an error on import.

`importCommand()` (`app/lib/agent-plugins/cli.js:45-70`) prints each warning as `warning: ...`. When `errors` is empty the process exits 0, including when warnings were printed, and the agentspec is written. When `errors` is non-empty and `--force` is absent, the errors are printed, the message `import refused because the plugin fails the core spec; pass --force to write the agentspec anyway` is printed, and the process exits 1 without writing. `--force` writes the agentspec anyway, prints the errors, and logs `manifest: invalid (--force)`. A missing `plugin.json` throws `PLUGIN_MISSING` from `importPlugin()` (`app/lib/agent-plugins/import-plugin.js:50-54`) and `main()` exits 1 (`app/lib/agent-plugins/cli.js:102-104`).

The gate and `manifest validate` use the default profile, so a package with no `com.grokbot` extension, no skill, or no `mcp.json` fails those commands.

## Validation

`npm run validate:manifests` runs `node tools/validate-manifests.js --gate` (`package.json`).

The gate passes every directory under `schema/fixtures/valid/` and requires every directory under `schema/fixtures/invalid/` to fail. It calls `validatePluginDir(dir)` with no profile (`tools/validate-manifests.js:41-46`). `node tools/validate-manifests.js <dir>` checks one package. `manifest validate <dir>` is the same default-profile check through `app/lib/agent-plugins/cli.js:73-89`.

Ajv applies the three schemas. The script then checks:

- `name` equals the directory name
- `mcp.json` and `plugin.json` declare the same Agent Plugins version
- stdio `command` is one token, with no shell metacharacters and no `${` expansion
- `cwd` stays under `./`, `${PLUGIN_ROOT}`, or `${PLUGIN_DATA}` and does not contain `..` (`app/lib/agent-plugins/validate.js:105-110`, rule `cwd-containment`)
- `${PLUGIN_ROOT}/` and `./` args, and a `./` command, resolve to a file inside the plugin
- env keys are not `PLUGIN_ROOT`, `PLUGIN_DATA`, or secret-shaped, and values are not secret-shaped
- remote URLs are absolute HTTP(S), without user info or fragments; non-loopback hosts use HTTPS (`app/lib/agent-plugins/validate.js:156-180`). A query string is allowed on validate. A query parameter whose name matches `CREDENTIAL_QUERY` (`app/lib/agent-plugins/validate.js:29`: `code`, `key`, `sig`, `signature`, `token`, `api-key`, `api_key`, `access-token`, `access_token`, `id_token`, `refresh-token`, `refresh_token`, `secret`, `password`, `client-secret`, `client_secret`, `subscription-key`, `subscription_key`, `functions-key`, `functions_key`), or `/(?:^|[-_])key$/i`, or `SECRET_KEY` (`app/lib/agent-plugins/validate.js:17`) is rule `remote-url` with message `remote url contains a credential query parameter` (`app/lib/agent-plugins/validate.js:169-172`). Emit is stricter: any query string omits the server (see the mapping table).
- header names and values on `streamable-http` and `sse` servers (`checkHeaders`, `app/lib/agent-plugins/validate.js:192-212`). `isCredentialHeaderName()` (`app/lib/agent-plugins/validate.js:183-190`) rejects the set `authorization`, `proxy-authorization`, `cookie`, `set-cookie`, `x-api-key`, `api-key`, `x-auth-token`, `x-access-token` (`app/lib/agent-plugins/validate.js:19-28`), any name matching `SECRET_KEY`, any name matching `/(?:^|[-_])key$/` (a header of `key` or ending in `-key` or `_key`), and any name containing `subscription-key` or `functions-key`. Secret-shaped values, duplicate names that differ only by case, names that are not HTTP header tokens, and non-string or CR/LF values are the same rule, `header-secret`. This is the validate check. The emit allow-list above is separate and drops headers the validator would still accept.
- path containment uses `fs.realpathSync`. `realpathInside()` (`app/lib/agent-plugins/validate.js:113-132`) resolves the plugin root and the target. `ENOENT` on the target is reported as missing. Any other `realpath` failure, or a resolved path that is not the root and does not start with the root plus a separator, is `path escapes the plugin root`. `resolvePackagePath()` (`app/lib/agent-plugins/validate.js:134-147`) uses that for `${PLUGIN_ROOT}/` and `./` refs after rejecting `..` and a nested `${`. `checkInside()` (`app/lib/agent-plugins/validate.js:339-347`) uses it for the extension `spec` and for bindings, and also rejects an absolute path or a `..` segment. The violation rule is `path-escape` (`app/lib/agent-plugins/validate.js:389-394` and `:421-431`). A symlink whose real path leaves the plugin root fails this rule. Fixture: `schema/fixtures/invalid/symlink-escape`.
- `extensions["com.grokbot"]` is present on the default profile, its `spec` file exists, and that file names each capability
- each binding path exists inside the plugin (a lexical or realpath escape is `path-escape`; a missing file is `binding-path`)
- `secret-sync` sets `secretsPolicy.direction` to `write-only`
- `level` above 0 has a recorded pass. `hasLevelPassRecord()` (`app/lib/agent-plugins/validate.js:313-318`) scans `CONFORMANCE.md` and `ROADMAP.md` in the plugin root (`app/lib/agent-plugins/validate.js:321-336`). One line, after trim, must match `| L<n> | pass | <YYYY-MM-DD> | <sha> |` for that same `n`. Cells may have surrounding whitespace. The date must be a real calendar date (`isCalendarDate`, `app/lib/agent-plugins/validate.js:306-310`). The sha is 7 to 64 hexadecimal characters. A different level, a status other than `pass`, or a date that is not a calendar day leaves the rule `level-inflated`.
- at least one `skills/<name>/SKILL.md` on the default profile, with a kebab-case `name` equal to its folder and a 1-1024 character `description`

## Differences from the Agent Plugins spec

The published schema sets `additionalProperties: false`. Spec §5.2 tells a loading client to report and ignore unknown top-level fields and keep loading. This validator fails closed on unknown keys, matching the schema and the reference gate.

The spec makes `extensions`, `skills/`, and `mcp.json` optional for a loading client. The default profile used by `emitPlugin()`, `manifest validate`, and `npm run validate:manifests` records `extension-missing`, `skill-missing`, and `mcp-missing` as errors, because every package this builder emits has all three and the review loop checks them. The import profile records those three rules as warnings and still imports the package. See [Import profile and gate profile](#import-profile-and-gate-profile).

## Build hook

`runPipeline()` calls `stepManifest()` and then `stepAuth()` (`app/lib/build-pipeline.js:1333-1334`). `stepAuth()` is the first Dataverse token request (`app/lib/build-pipeline.js:178-214`).

`stepManifest()` (`app/lib/build-pipeline.js:149-175`) writes the package to `<agentDir>/plugin/<plugin-name>/`. On success it sets `brief.agentPlugin` to `directory`, `name`, `schema`, `validatedAt`, and `omitted`. That object does not copy `strict`.

On failure, `emitPlugin()` throws. Validation failure is `MANIFEST_INVALID` (`app/lib/agent-plugins/generate.js:295-300`). Other throws include a missing `agent.name` and `OUTPUT_EXISTS`. The catch marks the manifest step failed, logs `Manifest step failed: ...`, and pushes `err.message` onto `job.errors` (`app/lib/build-pipeline.js:169-172`). It then reads `brief.agentPlugin.strict` from the agentspec that entered the step (`app/lib/build-pipeline.js:173-174`):

- When `agentPlugin.strict` is not `true`, the catch returns. `stepAuth()` and the rest of the pipeline still run, including Dataverse calls. The job later finishes unsuccessful because the manifest step is failed and `job.errors` is non-empty (`app/lib/build-pipeline.js:1351-1355`).
- When `agentPlugin.strict` is `true`, the catch rethrows. `runPipeline()`'s catch (`app/lib/build-pipeline.js:1356-1359`) completes the job and does not call `stepAuth()`.
