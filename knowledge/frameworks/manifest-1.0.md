# Agent Plugins 1.0 for MCS Agent Builder

Manifest 1.0 in this repo means **Agent Plugins 1.0.0** (https://agent-plugins.org/specification) plus the extension namespace **`extensions["com.grokbot"]`**. `emitPlugin()` writes a package only after the staged directory passes the default validation profile. The build pipeline's handling of that failure is in [Build hook](#build-hook).

Line numbers below match these files after the manifest fix-forward: `stepManifest` keeps user `agentPlugin` keys, a level stands only when its latest recorded row is `pass`, and emit no longer invents a license or author.

## Sources

Schemas recorded in `schema/PROVENANCE.json` on 2026-10-19:

| Path | Role |
|---|---|
| `schema/vendor/plugin.schema.json` | Official `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`. SHA-256 `0a4aad95ce337878ad38802ebf0daa3fde76abe3f65400c86bcbb1ec0b3ab883`. |
| `schema/vendor/mcp.schema.json` | Official `https://agent-plugins.org/schemas/1.0.0/mcp.schema.json`. SHA-256 `6539175bfcdf43085855183e86da40ea94b166547a72b47ae9a0a390516d3acb`. |
| `schema/grokbot-extension.schema.json` | `extensions["com.grokbot"]`. Owner-supplied copy. `darbotlabs/plugins` returned HTTP 404, so the cited commit `fe3e155653aed57d60641bcd13325742644ff0b7` was not re-fetched. SHA-256 `bbb0949a0c416104a2d48ba5a584ea3252a4fba7067374d78135a680eea7a401`. |

Ajv 8.17.1 is vendored at `tools/vendor/ajv-runtime/` so the manifest gate can load Ajv without resolving it from `node_modules`. `loadAjv2020()` (`app/lib/agent-plugins/load-ajv.js`) prepends that directory only while Ajv's own files resolve their runtime dependencies, then restores Node's module path list. `microsoft-agents-objectmodel` is not in `package.json` or the lockfile. CI is `.github/workflows/ci.yml` only: Node 22 (`node-version: '22'`), `npm ci --legacy-peer-deps` because `openapi-typescript@7.13` peers on `typescript` ^5 while this repo pins `typescript` 6, then `npm run validate:manifests` with no `--if-present`. `engines` is `>=20`. The old Node 20 job is not part of CI; `npm run test:unit` needs Node 22 for `node --experimental-strip-types`. Vendoring Ajv is separate from that install flag.

The prepared checklist for `darbotlabs/plugins` required a `plugins/<name>/core` TypeScript project, `CONFORMANCE.md`, and `npm run gate`. Those paths are not this repo's layout. The checks below are the ones the code enforces.

## How an agentspec becomes a package

`manifest emit --spec <agentspec.json> --out <parent> [--force]` (`app/lib/agent-plugins/cli.js:27-44`) and the build pipeline's manifest step call `emitPlugin()` in `app/lib/agent-plugins/generate.js`. The CLI passes `{ force }` through. The pipeline calls `emitPlugin(brief, outDir)` with no force flag (`app/lib/build-pipeline.js:156`). `--force` deletes the existing output directory. The usage text in `bin/cli.js` and `app/lib/agent-plugins/cli.js:32-33` says so.

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
| `agent.name` | Folder name and `plugin.json` `name`, from `pluginNameFromAgent()` (`app/lib/agent-plugins/generate.js:22-30`). The raw name is trimmed and lowercased. Characters outside `a-z0-9.-` become `-`. Repeated `-` or `.` collapse. Leading and trailing `-` or `.` are stripped. A result longer than 64 characters is sliced and then stripped again. If that string matches `NAME_PATTERN` (`app/lib/agent-plugins/generate.js:10`), it is the name. `Order Status` becomes `order-status`. If the slug is empty or still fails the pattern (for example a name that does not yield `a-z0-9`), the name is `agent-` plus the first 8 hex characters of SHA-256 over the trimmed raw name encoded as UTF-8. The output directory basename must equal this name (`app/lib/agent-plugins/generate.js:295-298`). |
| `agent.description` | `plugin.json` `description` and the skill `description`, collapsed to one line and capped at 1024 characters. |
| `instructions`, capabilities, topics, boundaries, channels, knowledge | `agent-model.json`, which the stdio server reads. Secret-shaped keys and values are removed before the file is written. |
| `integrations[]` with `type` exactly `"mcp"` and a URL (`url`, `endpoint`, or `mcpUrl`) | Extra `mcpServers` entry of type `streamable-http`, when `safeRemoteUrl()` accepts the URL (`app/lib/agent-plugins/generate.js:65-77` and `:108-142`). `selectedIntegrations()` does not package an item whose `type` is not `"mcp"`. An item with no `type` is listed in `omitted` with the reason `integration has no type; only type mcp is packaged as a remote server` (`app/lib/agent-plugins/generate.js:115-122`). An item that already has some other type is skipped and is not listed. Userinfo, a fragment, or any query string (`url.search`) omits the whole server. `https` is kept. `http` is kept only for a loopback host. Anything else is omitted. Each omission is listed in the spec file. |
| headers on a kept remote server | `publicHeaders()` (`app/lib/agent-plugins/generate.js:11-19` and `:79-93`) keeps a header only when the lowercased name is in the allow-list `accept`, `accept-language`, `content-type`, `user-agent`, `x-tenant`, `x-request-id`, `x-correlation-id`, the value is a string, the value has no CR or LF, and the value does not match `SECRET_VALUE` (`app/lib/agent-plugins/generate.js:20`). Every other header is dropped. The server is still emitted. Dropped headers are counted in the omission list (`app/lib/agent-plugins/generate.js:132-135`). The recorded reason text says "not on the public allow-list" for every drop, including a secret-shaped value or a non-string value. |
| `agentPlugin.version` | `plugin.json` `version`. A non-empty string is copied. Otherwise the package version is `0.1.0` (`app/lib/agent-plugins/generate.js:217-219`). |
| `agentPlugin.license`, `agentPlugin.repository`, `agentPlugin.author` | Copied onto `plugin.json` by `pluginIdentity()` when set (`app/lib/agent-plugins/generate.js:193-206`). Omitted when unset. Emit does not write a default license, repository, or author. `author` is copied only when it is an object with a non-empty `name`. A `repository` string, `homepage`, or `author.url` that embeds userinfo or a credential query key fails validation as `identity-secret` (`app/lib/agent-plugins/validate.js:196-209` and `:543-551`), so emit throws `MANIFEST_INVALID` instead of writing the package. |
| (always) | `extensions["com.grokbot"]`: `kind: channel`, `capabilities: ["messaging"]`, `approval.required: true`, `secretsPolicy.plaintextToAgent: false`, `runtimes.core: node-mcp-stdio`, `level: 0` (`app/lib/agent-plugins/generate.js:230-239`). |

`manifest emit --force` sets `options.force` on `emitPlugin()` (`app/lib/agent-plugins/generate.js:291-304`). Without it, an existing destination that is not a directory containing both `agent-model.json` and a `plugin.json` whose `name` matches the package is left in place and emit throws `OUTPUT_EXISTS`. With `--force`, that destination is deleted and replaced. `--force` does not skip validation. `emitPlugin()` still runs `validatePluginDir()` on the staged tree (`app/lib/agent-plugins/generate.js:316-321`) and throws `MANIFEST_INVALID` before the rename when that call is not ok.

`messaging` means the packaged conversational contract (channels, topics, instructions, boundaries). The stdio server does not call Copilot Studio. `core/dist/index.js` is a byte copy of `app/lib/agent-plugins/mcp-stdio-server.js`. This repo does not compile that file with `tsc`.

`level` stays 0 because emit has not recorded a later validation round. See the level row rule under Validation.

## Import

`manifest import --dir <plugin> --out <agentspec.json> [--force]` calls `importPlugin()` in `app/lib/agent-plugins/import-plugin.js`.

- `agent-model.json`, when present, restores the agentspec slice.
- `plugin.json` and `mcp.json` fill `agentPlugin` (name, version, extension, servers, skills). A missing `mcp.json` is read as `{ mcpServers: {} }` (`app/lib/agent-plugins/import-plugin.js:57`). `sanitizeMcpServers()` (`app/lib/agent-plugins/validate.js:268-287`, called at `app/lib/agent-plugins/import-plugin.js:79`) drops credential header names, secret-shaped header values, secret-shaped env keys and values, and credential query keys (and userinfo) from server URLs before the agentspec is returned. Model integration URLs get the same query strip, and `redactSecretTree()` (`app/lib/agent-plugins/validate.js:234-245`, called at `app/lib/agent-plugins/import-plugin.js:70-77`) drops integration keys that match `SECRET_KEY` and replaces string values that match `SECRET_VALUE`, including nested objects. `repository`, `homepage`, and `author.url` go through `withoutCredentialQuery()` (`app/lib/agent-plugins/import-plugin.js:120-126`) so userinfo and credential query keys are removed before the agentspec is returned. `import --force` still writes that agentspec. It does not copy those secrets, and it does not keep credential-bearing identity URLs or secret-shaped integration values.
- Remote MCP servers that are not already in the model become `integrations[]` entries of `type: "mcp"`.
- Validation uses the import profile: `validatePluginDir(pluginRoot, { profile: "import" })` (`app/lib/agent-plugins/import-plugin.js:47`).

### Import profile and gate profile

`finalizeValidation()` (`app/lib/agent-plugins/validate.js:704-711`) splits violations by profile.

`IMPORT_WARNING_RULES` is exactly `extension-missing`, `skill-missing`, and `mcp-missing` (`app/lib/agent-plugins/validate.js:30`).

| Profile | Callers | `extension-missing`, `skill-missing`, `mcp-missing` | Every other rule | `ok` |
|---|---|---|---|---|
| `"import"` | `importPlugin()` | `warnings` | `errors` | `errors.length === 0` |
| omitted (default) | `emitPlugin()`, `manifest validate`, `tools/validate-manifests.js --gate` (`tools/validate-manifests.js:42`) | `errors` (`warnings` is empty) | `errors` | `violations.length === 0` |

Those three warning rules are only the absence cases:

- `extension-missing` — `extensions["com.grokbot"]` is missing or not an object (`app/lib/agent-plugins/validate.js:555-556`). A present extension that fails `grokbot-extension.schema.json` is `extension-schema`, which stays an error on import.
- `skill-missing` — no `skills/` directory (`app/lib/agent-plugins/validate.js:374-376`), or the directory has no `skills/<name>/SKILL.md` (`app/lib/agent-plugins/validate.js:380-382`). Bad frontmatter, a bad skill name, or a bad description is `skill-frontmatter` (`app/lib/agent-plugins/validate.js:388-406`) and stays an error on import.
- `mcp-missing` — `mcp.json` is absent (`app/lib/agent-plugins/validate.js:612`). Invalid JSON or a schema failure is `mcp-schema` and stays an error on import.

`importCommand()` (`app/lib/agent-plugins/cli.js:46-72`) prints each warning as `warning: ...`. When `errors` is empty the process exits 0, including when warnings were printed, and the agentspec is written. When `errors` is non-empty and `--force` is absent, the errors are printed, the message `import refused because the plugin fails the core spec; pass --force to write the agentspec anyway` is printed, and the process exits 1 without writing. `--force` writes the agentspec anyway, prints the errors, and logs `manifest: invalid (--force)`. That write uses the spec `importPlugin()` already returned, so credential headers, secret-shaped header and env values, credential query keys, credential-bearing `repository` / `homepage` / `author.url` values, and secret-shaped integration keys and values are not in it. A missing `plugin.json` throws `PLUGIN_MISSING` from `importPlugin()` (`app/lib/agent-plugins/import-plugin.js:50-54`) and `main()` exits 1 (`app/lib/agent-plugins/cli.js:103-105`).

The gate and `manifest validate` use the default profile, so a package with no `com.grokbot` extension, no skill, or no `mcp.json` fails those commands.

## Validation

`npm run validate:manifests` runs `node tools/validate-manifests.js --gate` (`package.json`).

The gate passes every directory under `schema/fixtures/valid/` and requires every directory under `schema/fixtures/invalid/` to fail. It calls `validatePluginDir(dir)` with no profile (`tools/validate-manifests.js:41-46`). `node tools/validate-manifests.js <dir>` checks one package. `manifest validate <dir>` is the same default-profile check through `app/lib/agent-plugins/cli.js:74-91`.

Ajv applies the three schemas. The script then checks:

- `name` equals the directory name
- `mcp.json` and `plugin.json` declare the same Agent Plugins version
- stdio `command` is one token, with no shell metacharacters and no `${` expansion
- `cwd` stays under `./`, `${PLUGIN_ROOT}`, or `${PLUGIN_DATA}` and does not contain `..` (`app/lib/agent-plugins/validate.js:105-110`, rule `cwd-containment`)
- `${PLUGIN_ROOT}/` and `./` args, and a `./` command, resolve to a file inside the plugin
- env keys are not `PLUGIN_ROOT`, `PLUGIN_DATA`, or secret-shaped, and values are not secret-shaped
- remote URLs are absolute HTTP(S), without user info or fragments; non-loopback hosts use HTTPS (`app/lib/agent-plugins/validate.js:156-180`). A query string is allowed on validate. A query parameter whose name matches `CREDENTIAL_QUERY` (`app/lib/agent-plugins/validate.js:29`: `code`, `key`, `sig`, `signature`, `token`, `api-key`, `api_key`, `access-token`, `access_token`, `id_token`, `refresh-token`, `refresh_token`, `secret`, `password`, `client-secret`, `client_secret`, `subscription-key`, `subscription_key`, `functions-key`, `functions_key`), or `/(?:^|[-_])key$/i`, or `SECRET_KEY` (`app/lib/agent-plugins/validate.js:17`) is rule `remote-url` with message `remote url contains a credential query parameter` (`app/lib/agent-plugins/validate.js:169-172`). Emit is stricter: any query string omits the server (see the mapping table).
- header names and values on `streamable-http` and `sse` servers (`checkHeaders`, `app/lib/agent-plugins/validate.js:298-320`). `isCredentialHeaderName()` (`app/lib/agent-plugins/validate.js:183-190`) rejects the set `authorization`, `proxy-authorization`, `cookie`, `set-cookie`, `x-api-key`, `api-key`, `x-auth-token`, `x-access-token` (`app/lib/agent-plugins/validate.js:19-28`), any name matching `SECRET_KEY`, any name matching `/(?:^|[-_])key$/` (a header of `key` or ending in `-key` or `_key`), and any name containing `subscription-key` or `functions-key`. Secret-shaped values, duplicate names that differ only by case, names that are not HTTP header tokens, and non-string or CR/LF values are the same rule, `header-secret`. This is the validate check. The emit allow-list above is separate and drops headers the validator would still accept.
- path containment uses `fs.realpathSync`. `realpathInside()` (`app/lib/agent-plugins/validate.js:113-132`) resolves the plugin root and the target. `ENOENT` on the target is reported as missing. Any other `realpath` failure, or a resolved path that is not the root and does not start with the root plus a separator, is `path escapes the plugin root`. `resolvePackagePath()` (`app/lib/agent-plugins/validate.js:134-147`) uses that for `${PLUGIN_ROOT}/` and `./` refs after rejecting `..` and a nested `${`. `checkInside()` (`app/lib/agent-plugins/validate.js:503-512`) uses it for the extension `spec` and for bindings, and also rejects an absolute path or a `..` segment. The violation rule is `path-escape` (`app/lib/agent-plugins/validate.js:563-567` and `:597-604`). A symlink whose real path leaves the plugin root fails this rule. Fixture: `schema/fixtures/invalid/symlink-escape`.
- `extensions["com.grokbot"]` is present on the default profile, its `spec` file exists, and that file names each capability
- each binding path exists inside the plugin (a lexical or realpath escape is `path-escape`; a missing file is `binding-path`)
- `secret-sync` sets `secretsPolicy.direction` to `write-only`
- `level` above 0 has a recorded pass. `checkLevel()` (`app/lib/agent-plugins/validate.js:484-501`) reads `CONFORMANCE.md` and `ROADMAP.md` and judges them as one set of rows. A pass in one file does not outweigh a later fail in the other. `evidenceLines()` (`app/lib/agent-plugins/validate.js:419-443`) drops HTML comments, 4-space or tab-indented code lines, and CommonMark fences. A fence opens on 0-3 spaces plus at least three backticks or tildes. It closes only on the same character, with a marker at least as long as the opener, and with no info string on the closing line. A backtick fence is not closed by tildes, and a shorter marker does not close a longer one. `levelRows()` (`app/lib/agent-plugins/validate.js:449-470`) collects every remaining line that starts `| L<n> |` for that same `n`. A well-formed row matches `| L<n> | pass|fail|failed | <YYYY-MM-DD> | <sha> |`, case-insensitively. `failed` counts as fail. Cells may have surrounding whitespace. The date must be a real calendar date (`isCalendarDate`, `app/lib/agent-plugins/validate.js:412-417`). The sha is 7 to 64 hexadecimal characters. Any other `| L<n> |` row counts as not-pass: a status such as `FAILING`, an extra column, a sha of `-`, or a date that is not a calendar day. A row with a real date is ordered with the well-formed rows, so a later well-formed pass can supersede it. A row with no usable date cannot be ordered and fails the level. `hasLevelPassRecord()` (`app/lib/agent-plugins/validate.js:479-482`) is true only when at least one row exists, none of those unordered rows exist, no row date is after the current UTC calendar day, and every row that shares the latest date is `pass`. A stale `pass` followed by a later `fail` or a malformed row, a `pass` that exists only inside a fence, an indented code block, or an HTML comment, or a future date is `level-inflated`. A different level does not count. Fixtures: `schema/fixtures/invalid/level-superseded`, `level-cross-file` (a later fail in `CONFORMANCE.md` beats an older pass in `ROADMAP.md`), `level-status-fail` (`FAIL`), `level-status-failed` (`failed`), `level-long-fence` (a four-backtick fence that a three-backtick line does not close), `level-indented` (a four-space indented pass row), `level-fenced`, `level-commented`, and `level-malformed`. `isFutureDate()` (`app/lib/agent-plugins/validate.js:445-447`) compares a row date with the current UTC day. Unit tests supply dates through `utcDay()`. `schema/fixtures/valid/level-pass` records its pass on `2020-01-15`, a fixed past date, so the gate does not depend on the clock.
- `agent-model.json`, when present, is scanned for `SECRET_VALUE` strings (`app/lib/agent-plugins/validate.js:686-698`). A match is `manifest-secret`. Fixture: `schema/fixtures/invalid/model-secret`. `schema/fixtures/invalid/homepage-credential` is `identity-secret` on `/homepage`.
- at least one `skills/<name>/SKILL.md` on the default profile, with a kebab-case `name` equal to its folder and a 1-1024 character `description`

## Differences from the Agent Plugins spec

The published schema sets `additionalProperties: false`. Spec §5.2 tells a loading client to report and ignore unknown top-level fields and keep loading. This validator fails closed on unknown keys, matching the schema and the reference gate.

The spec makes `extensions`, `skills/`, and `mcp.json` optional for a loading client. The default profile used by `emitPlugin()`, `manifest validate`, and `npm run validate:manifests` records `extension-missing`, `skill-missing`, and `mcp-missing` as errors, because every package this builder emits has all three and the review loop checks them. The import profile records those three rules as warnings and still imports the package. See [Import profile and gate profile](#import-profile-and-gate-profile).

## Build hook

`runPipeline()` calls `stepManifest()` and then `stepAuth()` (`app/lib/build-pipeline.js:1330-1331`). `stepAuth()` is the first Dataverse token request (`app/lib/build-pipeline.js:206-212`). A manifest failure does not abort the build unless `agentPlugin.strict` is true.

`stepManifest()` (`app/lib/build-pipeline.js:149-178`) writes the package to `<agentDir>/plugin/<plugin-name>/`. On success it merges the previous `brief.agentPlugin` and overwrites only `directory`, `name`, `schema`, `validatedAt`, and `omitted` (`app/lib/build-pipeline.js:157-165`). `version`, `strict`, `extension`, `mcpServers`, and every other user key stay. Before that merge, `sanitizeCarriedAgentPlugin()` (`app/lib/agent-plugins/validate.js:289-296`) strips credential header names, secret-shaped header values, secret-shaped env keys and values, and credential query keys from the carried `mcpServers`. A second build therefore keeps the user's version and the strict flag, and does not keep those secrets.

On failure, `emitPlugin()` throws before that assignment. Validation failure is `MANIFEST_INVALID` (`app/lib/agent-plugins/generate.js:316-321`). Other throws include a missing `agent.name` and `OUTPUT_EXISTS`. The catch marks the manifest step failed and logs `Manifest step failed: ...` (`app/lib/build-pipeline.js:171-173`). It then reads `brief.agentPlugin.strict` from the agentspec that entered the step (`app/lib/build-pipeline.js:174-176`):

- When `agentPlugin.strict` is not `true`, the catch pushes `err.message` onto `job.errors` once and returns. `stepAuth()` and the rest of the pipeline still run, including Dataverse calls. The job later finishes unsuccessful because the manifest step is failed and `job.errors` is non-empty (`app/lib/build-pipeline.js:1348-1352`).
- When `agentPlugin.strict` is `true`, the catch rethrows without pushing. `runPipeline()`'s catch (`app/lib/build-pipeline.js:1353-1357`) pushes that same message once and completes the job. It does not call `stepAuth()`. The error is not recorded twice.
