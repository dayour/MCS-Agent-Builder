# MakerEvaluation test-component write adapter — runbook

The typed WRITE adapter `makerEvalUpdateTestComponents` wraps
`POST /api/botmanagement/v2/environments/{envId}/bots/{botId}/makerevaluations/testcomponent`.

It is **built, tested, and unwired**. The legacy path in `app/lib/build-pipeline.js`
(Dataverse `POST /api/data/v9.2/botcomponents` with `componenttype: 19`) still owns
production. This document describes the parity process required before the
legacy path is replaced.

## Why a runbook instead of a feature flag

Writes without idempotency are dangerous. A flag flip that turns on a new
WRITE path can produce duplicate records on every retry if timeout behavior
differs from legacy. `makerEvalUpdateTestComponents` therefore has no retry
logic and no shadow-dual-run mode — each write is an intentional, bounded
experiment run by a human (or a script a human ran) against a specific bot
in a specific environment.

## Prerequisites

1. `az login` in the tenant that owns the target environment.
2. Active `az account` pointed at a subscription that gives Dataverse access
   for that tenant.
3. MakerEvaluation feature must be enabled on the target bot. Verify with:

   ```bash
   node tools/island-client.js maker-eval-enabled \
     --env <envId> --bot <botId> \
     --gateway https://powervamg.<region>.gateway.prod.island.powerapps.com
   ```

4. Target bot is a **throwaway test bot** for initial verification. Do not
   run the first typed write against a production bot.

## Parity run (before any production migration)

### Step A — capture baseline

Snapshot what the bot currently has:

```bash
# 1. Existing server-side test sets (should match what the UI shows)
node tools/island-client.js maker-eval-testsets \
  --env <envId> --bot <botId> --gateway <url> --json > /tmp/baseline-sets.json

# 2. Raw Dataverse rows (legacy-visible components)
TOKEN=$(az account get-access-token --resource "<dataverseUrl>" --query accessToken -o tsv)
curl -sS -H "Authorization: Bearer $TOKEN" \
  "<dataverseUrl>/api/data/v9.2/botcomponents?\$filter=parentbotid eq <botId> and componenttype eq 19&\$select=botcomponentid,name,schemaname,data" \
  > /tmp/baseline-dv.json
```

### Step B — build a minimal Add request

Construct a request adding ONE test case via the typed adapter. Use a unique
`schemaName` (e.g. include the current timestamp) so duplicate detection is
clear:

```js
const request = {
  testComponents: [
    {
      component: {
        // TestCaseComponent shape from microsoft-agents-objectmodel
        kind: "TestCaseComponent",
        schemaName: `mspva.TestCase.runbook_${Date.now()}`,
        displayName: "Runbook parity test",
        // additional required fields — consult the TestCaseComponent schema
      },
      operationType: "Add"
    }
  ]
};
```

### Step C — run the typed write

```js
const island = require("./tools/island-client");
const token = getToken("96ff4394-9197-43aa-b393-6a41652e21f8");
const headers = buildHeaders(token, tenantId, envId, botId);
const response = await island.makerEvalUpdateTestComponents(gatewayUrl, envId, botId, headers, request);
console.log(JSON.stringify(response, null, 2));
```

Capture the returned `addedComponentsIdsBySchemaName` map. Record the GUID
returned for your schemaName.

### Step D — verify persistence

Immediately after the write, verify:

1. **Typed read-back**:
   ```bash
   node tools/island-client.js maker-eval-testsets --env <envId> --bot <botId> --gateway <url> --json
   ```
   The new component should appear in the envelope's `testComponents` array.

2. **Dataverse read-back**:
   ```bash
   curl -sS -H "Authorization: Bearer $TOKEN" \
     "<dataverseUrl>/api/data/v9.2/botcomponents(<guid-from-response>)"
   ```
   Inspect ownership, state, schema_name, data, category. Compare to what a
   legacy-created test set looks like by diffing against a known-good record
   from step A's `/tmp/baseline-dv.json`.

3. **UI visibility**: open MCS portal → the bot → eval tab. The new
   component should show up in the test set list. If it does not, the
   typed write persisted a record the portal doesn't render — stop and
   investigate before any further migration.

### Step E — characterize idempotency

Re-run step C with the **same request**. Options observed in testing to date:

- Response's `addedComponentsIdsBySchemaName` includes a NEW GUID for the
  existing schemaName → endpoint creates duplicates silently. Do NOT rely on
  retries without explicit deduplication.
- Response is empty / 409 / error → endpoint rejects duplicates. Safer for
  retry semantics.

Document which behavior you observed before moving forward.

### Step F — cleanup

Remove the test component you created:

```js
await island.makerEvalUpdateTestComponents(gatewayUrl, envId, botId, headers, {
  testComponents: [{
    component: { kind: "TestCaseComponent", schemaName: "mspva.TestCase.runbook_<ts>" },
    operationType: "Delete"
  }]
});
```

Verify deletion via step D's read-back.

## Migration gate

Do NOT replace the Dataverse write path in `app/lib/build-pipeline.js` until:

- Steps A–F succeed on a throwaway bot.
- The read-back (step D) proves typed writes are UI-visible and
  downstream-executable (an actual eval run can use the created test set).
- Idempotency characterization (step E) yields an approach — either the
  endpoint rejects duplicates, or the pipeline enforces unique schemaNames
  before each write.
- A dedicated cleanup script exists that can remove typed-created records
  by correlation ID, tested against a real bot.

## What's ready without the gate

- `makerEvalUpdateTestComponents` exported from `tools/island-client.js`.
- Request validation (non-empty testComponents, operationType ∈ {Add, Update, Delete}).
- Response shape validation (`isUpdateTestComponentsResponseShape`).
- 13 unit tests covering both.

## What's not yet built (future work)

- CLI command (`node tools/island-client.js maker-eval-update-testcomponent ...`).
- Mapping helper from an `agentspec.json` `evalSets[]` entry to a
  `MakerEvaluationUpdateTestComponentRequest`.
- Cleanup script that enumerates typed-created components by schema prefix.
- Production feature flag once the above gate is cleared.
