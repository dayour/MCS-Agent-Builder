# MCS API Contract Registry

Each subfolder is a **contract** for one MCS API surface — the deterministic
truth about what we send, what we expect back, and how we know we're still in
sync with the live platform.

This registry exists because the dominant failure mode for our build pipeline
is **API-contract-gap**: undocumented payload requirements, missing `$kind`
discriminators, schema drift between our typed adapters and what the server
actually accepts. The MakerEval write adapter was blocked for two days until
HAR capture revealed two missing discriminators; without a registry, the next
surface will repeat that loss.

A contract entry is the minimum needed to detect and prevent that drift in
under a minute.

## What a contract entry looks like

```
contracts/<surface-id>/
├── contract.json           — surface metadata, $kind discriminators, required fields, references
├── shape-fixture.json      — sanitized request + response captured from a real successful call
├── parity.test.js          — node:test that wires the fixture against the typed adapter validator
└── README.md               — surface description, recapture instructions, known quirks
```

## Surface IDs

A surface ID names ONE specific endpoint or related endpoint cluster, scoped
narrow enough that a single payload shape characterizes it. Examples:

| Surface ID | What it covers |
|---|---|
| `maker-eval-testcomponent` | `POST /makerevaluations/testcomponent` (Add/Update/Delete) |
| `dialogs-list`             | `GET /api/botauthoring/v1/dialogs` (paged) |
| `bot-create`               | `POST /api/data/v9.2/bots` (full BotConfiguration body) |
| `pva-publish`              | `POST /bots({id})/Microsoft.Dynamics.CRM.PvaPublish` |

When in doubt, split. Two parity tests against narrow contracts is more
diagnostic than one parity test against a broad surface.

## What goes in `contract.json`

```json
{
  "surfaceId": "maker-eval-testcomponent",
  "method": "POST",
  "urlPattern": "{gatewayUrl}/api/botmanagement/v2/environments/{envId}/bots/{botId}/makerevaluations/testcomponent?ApplyV2Migration=true",
  "auth": "PVA token (sub 96ff4394-...)",
  "kindDiscriminators": [
    {"path": "$.testComponents[*].$kind", "value": "MakerEvaluationUpdateTestComponent"},
    {"path": "$.testComponents[*].component.$kind", "value": "TestCaseComponent"},
    {"path": "$.testComponents[*].component.definition.$kind", "value": "EvaluationSet"}
  ],
  "requiredFields": [
    "testComponents[*].operationType (enum: Add | Update | Delete)",
    "testComponents[*].component.category = 'Testing'",
    "testComponents[*].component.state = 'Active'",
    "testComponents[*].component.definition.graders[] (must be non-empty)"
  ],
  "responseShape": "{ addedComponentsIdsBySchemaName: Record<string,string> }",
  "lastVerified": "2026-04-17",
  "lastVerifiedBy": "HAR capture from MCS UI (bot 63ec2f13-d139-f111-88b4-7c1e528d32a4)",
  "typedAdapterRef": "tools/island-client.js:makerEvalUpdateTestComponents",
  "typeRef": "tools/generated/maker-eval-types.ts",
  "runbookRef": "tools/upstream-specs/maker-eval-write.md",
  "knownQuirks": [
    "Idempotent Add returns 500 on duplicate schemaName (server-side dedupe)",
    "Empty graders array returns 500 — at least one grader required",
    "Lone EvaluationSet without children does not appear in listTestSets"
  ]
}
```

## What goes in `shape-fixture.json`

A SANITIZED capture — no bearer tokens, no cookies, no PII, no real customer
identifiers. Use placeholder values like `<envId>`, `<botId>`, `<schemaName>`.

```json
{
  "request": {
    "method": "POST",
    "url": "/api/botmanagement/v2/environments/<envId>/bots/<botId>/makerevaluations/testcomponent?ApplyV2Migration=true",
    "body": { "...": "..." }
  },
  "response": {
    "status": 200,
    "body": { "addedComponentsIdsBySchemaName": { "<schemaName>": "<guid>" } }
  }
}
```

**HAR sanitization is mandatory before commit.** Run:

```bash
node tools/contract-parity.js sanitize <path-to-raw.har> > shape-fixture.json
```

(Sanitizer strips Authorization, Cookie, x-ms-correlation-id, replaces
GUIDs/URLs with placeholders, and rejects payloads containing email-shaped
strings unless explicitly allowlisted.)

## What goes in `parity.test.js`

Standard `node:test` that loads the fixture and asserts the typed adapter's
validators accept the captured payload. **No network calls in static mode.**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { _internal } = require("../../../island-client.js");

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "shape-fixture.json"), "utf8"));

test("captured response matches typed validator", () => {
  assert.equal(_internal.isUpdateTestComponentsResponseShape(fixture.response.body), true);
});

test("captured request shape has all kindDiscriminators", () => {
  const req = fixture.request.body;
  assert.equal(req.testComponents[0].$kind, "MakerEvaluationUpdateTestComponent");
  assert.equal(req.testComponents[0].component.$kind, "TestCaseComponent");
});
```

## Live mode

For surfaces that need real-API verification, parity.test.js can opt in to
a live mode guarded by an env var:

```js
test("live POST round-trip", { skip: !process.env.CONTRACT_PARITY_LIVE }, async () => {
  // ... real call, compare to fixture
});
```

Live mode is **never run on pre-push** (developer machines lack consistent
auth). Run manually before declaring a contract verified:

```bash
CONTRACT_PARITY_LIVE=1 node tools/contract-parity.js maker-eval-testcomponent
```

## Adding a new contract

1. Create `contracts/<surface-id>/`
2. Capture HAR from MCS UI for one successful call
3. Sanitize: `node tools/contract-parity.js sanitize raw.har > shape-fixture.json`
4. Write `contract.json` (use existing entries as templates)
5. Write `parity.test.js` against the existing typed validators
6. Add entry to `index.json`
7. Run `node tools/contract-parity.js` — all entries should pass static parity
8. Commit shape-fixture.json + contract.json + parity.test.js (NEVER raw.har)

## Why not just trust the OpenAPI spec?

We vendor `botmanagement-2022-01-15.json` (493 endpoints) but it's **stale**:
the MakerEvaluation V2 controller, polymorphic `$kind` requirements, and a
dozen newer surfaces are not represented in the version we have access to.
HAR capture is faster than waiting for the spec to update — and the contract
registry is what makes those captures durable instead of one-off fixes.
