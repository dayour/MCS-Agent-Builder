# Agent Plugins 1.0 for MCS Agent Builder

Manifest 1.0 in this repo means **Agent Plugins 1.0.0** (https://agent-plugins.org/specification) plus the extension namespace **`extensions["com.grokbot"]`**. The builder writes one plugin package per agentspec and refuses to keep a package that fails validation.

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

`manifest emit --spec <agentspec.json> --out <parent>` (and the build pipeline's manifest step) calls `emitPlugin()` in `app/lib/agent-plugins/generate.js`.

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
| `agent.name` | Folder name and `plugin.json` `name`, slugified to the schema pattern. `Order Status` becomes `order-status`. The output directory basename must match. |
| `agent.description` | `plugin.json` `description` and the skill `description`, collapsed to one line and capped at 1024 characters. |
| `instructions`, capabilities, topics, boundaries, channels, knowledge | `agent-model.json`, which the stdio server reads. Secret-shaped keys and values are removed before the file is written. |
| `integrations[]` with `type: "mcp"` and an HTTPS URL | Extra `mcpServers` entry of type `streamable-http`. Credential headers and non-HTTPS non-loopback URLs are omitted and listed in the spec file. |
| (always) | `extensions["com.grokbot"]`: `kind: channel`, `capabilities: ["messaging"]`, `approval.required: true`, `secretsPolicy.plaintextToAgent: false`, `runtimes.core: node-mcp-stdio`, `level: 0`. |

`messaging` means the packaged conversational contract (channels, topics, instructions, boundaries). The stdio server does not call Copilot Studio. `core/dist/index.js` is a byte copy of `app/lib/agent-plugins/mcp-stdio-server.js`. This repo does not compile that file with `tsc`.

`level` stays 0 because emit has not recorded a later validation round. A package that claims a higher level must carry `CONFORMANCE.md` or `ROADMAP.md` with a recorded pass, or `validate:manifests` fails it.

## Import

`manifest import --dir <plugin> --out <agentspec.json>` calls `importPlugin()` in `app/lib/agent-plugins/import-plugin.js`.

- `agent-model.json`, when present, restores the agentspec slice.
- `plugin.json` and `mcp.json` fill `agentPlugin` (name, version, extension, servers, skills).
- Remote MCP servers that are not already in the model become `integrations[]` entries of `type: "mcp"`.
- The command exits non-zero on an invalid plugin unless `--force` is passed. `--force` still writes the agentspec and prints `manifest: invalid`.

## Validation

`npm run validate:manifests` runs `node tools/validate-manifests.js --gate`.

The gate passes every directory under `schema/fixtures/valid/` and requires every directory under `schema/fixtures/invalid/` to fail. `node tools/validate-manifests.js <dir>` checks one package. `manifest validate <dir>` is the same check through `bin/cli.js`.

Ajv applies the three schemas. The script then checks:

- `name` equals the directory name
- `mcp.json` and `plugin.json` declare the same Agent Plugins version
- stdio `command` is one token, with no shell metacharacters and no `${` expansion
- `cwd` and `${PLUGIN_ROOT}` / `./` args stay inside the plugin and the targeted files exist
- env keys are not `PLUGIN_ROOT`, `PLUGIN_DATA`, or secret-shaped, and values are not secret-shaped
- remote URLs are absolute HTTP(S), without user info or fragments; non-loopback hosts use HTTPS
- header names are not credential headers and values are not secret-shaped
- `extensions["com.grokbot"]` is present, its `spec` file exists, and that file names each capability
- each binding path exists inside the plugin
- `secret-sync` sets `secretsPolicy.direction` to `write-only`
- `level` above 0 has a recorded pass
- at least one `skills/<name>/SKILL.md` has a kebab-case `name` equal to its folder and a 1-1024 character `description`

## Differences from the Agent Plugins spec

The published schema sets `additionalProperties: false`. Spec §5.2 tells a loading client to report and ignore unknown top-level fields and keep loading. This validator fails closed on unknown keys, matching the schema and the reference gate.

The spec makes `extensions` and `skills/` optional. This gate requires `extensions["com.grokbot"]` and at least one skill, because every package this builder emits has both and the review loop checks both.

## Build hook

`app/lib/build-pipeline.js` runs the manifest step before auth. The package is written to `Build-Guides/<project>/agents/<agent>/plugin/<plugin-name>/`. The agentspec gains `agentPlugin.directory`, `agentPlugin.name`, `agentPlugin.schema`, and `agentPlugin.validatedAt`. A validation failure stops the build before any Dataverse call.
