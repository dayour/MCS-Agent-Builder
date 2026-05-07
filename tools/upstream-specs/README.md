# Upstream API Specs — Vendored

This directory holds OpenAPI/Swagger specs vendored from Microsoft-internal upstream repos. These specs drive type generation for the MCS Agent Builder backend.

**Do not hand-edit the spec files.** Re-vendor from upstream if changes are needed.

## Current vendored specs

| File | Source | API version | Used by |
|---|---|---|---|
| `botmanagement-2022-01-15.json` | `msazure/CCI/_git/BotDesigner` — `src/BotDesigner.Management.Server/Swagger/2022-01-15/botmanagement.json` | `2022-01-15` | `tools/generated/mgmt-types.ts` |

Each spec has a `.provenance.json` sibling recording source URL, commit SHA, SHA-256, endpoint/definition/tag counts, and fetch metadata.

## Adopted upstream path (what we've replaced)

Previously: `tools/island-client.js` and `tools/parse-har-*.js` reverse-engineered endpoint shapes by parsing HAR captures of live MCS UI traffic. This was always a guess at field names, types, and envelope shapes.

Now: the same endpoints are defined in upstream `botmanagement.json`. We vendor the spec, generate TS types, and import those types into our clients. No more guessing.

## Regenerating types

```bash
# From repo root
npm run regen:mgmt-types
```

This runs:
1. `npm run validate:mgmt-spec` — structural validation
2. `openapi-typescript tools/upstream-specs/botmanagement-2022-01-15.json -o tools/generated/mgmt-types.ts` — types only, no runtime code

Both steps are deterministic — running twice produces the same output byte-for-byte.

## Re-vendoring from upstream

When the upstream spec changes (new API version, new endpoints, or after a `git pull` on `/tmp/mcs-upstream/BotDesigner`):

```bash
# Get the fresh copy
cp /tmp/mcs-upstream/BotDesigner/src/BotDesigner.Management.Server/Swagger/<version>/botmanagement.json \
   tools/upstream-specs/botmanagement-<version>.json

# Compute new SHA-256
node -e "const c=require('crypto'),f=require('fs');console.log(c.createHash('sha256').update(f.readFileSync('tools/upstream-specs/botmanagement-<version>.json')).digest('hex'))"

# Update the provenance file: sha256, head_commit, fetched.timestamp_utc
# Regenerate types
npm run regen:mgmt-types

# Commit spec + provenance + regenerated types together
```

## Why vendor instead of live-fetch

- **Reproducible builds.** CI and fresh clones don't depend on network access or Microsoft-internal ADO reachability.
- **Provenance tracking.** SHA-256 + commit SHA let us prove exactly which spec a given build was compiled against.
- **Deterministic drift detection.** When upstream changes, a re-vendor produces a reviewable diff in git. Nothing changes silently.

## microsoft-agents-objectmodel npm package (Phase 2)

The Copilot Studio ObjectModel ships as an npm package on Microsoft's ADO
Artifacts feed. Our adapters can consume its schemas and generated types
directly instead of maintaining hand-rolled equivalents.

### One-time setup per developer

Requires an `az` CLI login with a Microsoft-tenant account (`kimdennis@microsoft.com`-style).

```bash
# Auth: fetches an Azure DevOps AAD token, writes it as _authToken in ~/.npmrc
npm run auth:ado-npm

# Install (pinned in package.json dependencies)
npm install
```

The auth script writes ONLY to `~/.npmrc` (user-level). The repo-level `.npmrc`
stays secret-free. `.gitignore` blocks `.npmrc` at the repo root as belt-and-braces.

### Re-auth when npm returns 401

AAD tokens expire in ~1 hour. Re-run the auth script:

```bash
npm run auth:ado-npm
```

### Importing

The upstream package uses an older pre-`exports` convention (no `main` or
`exports` field, only `module`). Import via the explicit dist path:

```js
// CJS dynamic import
const om = await import('microsoft-agents-objectmodel/dist/index.esm.js');
console.log(om.schema);       // bot schema
console.log(om.yamlSchema);   // yaml-authoring schema
```

```ts
// TypeScript — types resolve from dist/types/src/index.d.ts
import { schema, yamlSchema, ActivityType } from 'microsoft-agents-objectmodel/dist/index.esm.js';
```

2715+ exports include: bot schemas, generated kinds, idTypes, valueTypes, enums,
mapper, commands, type-guards, structuralIntegrityChecks, PowerFx helpers.

### CI

CI needs either an Azure DevOps PAT (Packaging Read scope) or the same
`az` CLI token flow. Typical pattern:
1. Federated service connection from GitHub Actions → Azure DevOps, OR
2. A secret PAT rotated via Azure Key Vault

Full how-to: (add when CI needs it)

## Type-on-touch policy — for contributors

The vendored spec covers 493 endpoints; we've typed ~15. The remaining ~478
are intentionally **not** pre-typed — typing for typing's sake adds churn
with no user value. Instead, we migrate on demand.

**Rule for any PR that adds or modifies a new MCS API call:**

1. If the endpoint is already typed (has an adapter in `tools/island-client.js`),
   use the adapter. Don't introduce a parallel hand-rolled path.
2. If the endpoint is NOT yet typed, the same PR must add:
   - A typed adapter in `tools/island-client.js` using `typedGetFromGateway`
     or `typedPostToGateway`.
   - A runtime shape validator for the response body (reject on mismatch —
     don't silently pass through garbage).
   - Unit tests covering the validator and the adapter's request validation.
   - A request-schema snippet in `tools/generated/` (either auto-generated
     if the endpoint is in our vendored swagger, or hand-derived with a
     comment pointing at the C# source if not).
3. If the endpoint isn't in the vendored swagger AND the types can't be
   derived safely from controller source alone, a HAR capture from the
   MCS UI is the fastest unblock. See `tools/upstream-specs/maker-eval-write.md`
   for the pattern — same structure worked for Phase 3.

WRITE endpoints additionally need:
- Request validation (required fields, enum values) BEFORE any POST.
- A runbook at `tools/upstream-specs/<endpoint>-write.md` describing the
  manual parity gate before production cutover.
- Entry in `knowledge/learnings/typed-adoption-cutover.md` if the flip
  has a staged rollout with legacy fallback.

This keeps the type surface targeted at code we actually use while
maintaining a single consistent pattern for every new adapter.

## See also

- Full adoption scan: `knowledge/learnings/upstream-adoption-scan.md`
- Typed-adoption observability: `tools/typed-adoption-stats.js`
- Cutover criteria: `knowledge/learnings/typed-adoption-cutover.md`
- Write-path runbook pattern: `tools/upstream-specs/maker-eval-write.md`
- Generated output: `tools/generated/mgmt-types.ts`
- npm package integration smoke: `app/lib/__tests__/microsoft-agents-objectmodel.test.js`
