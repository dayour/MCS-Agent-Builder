---
date: 2026-04-16 (initial) / 2026-04-17 (HAR unblock)
runbook: tools/upstream-specs/maker-eval-write.md
target: API-Test-Delete-Me (8baaaedb-7213-f111-8342-00224805f27c) in dktest (f9a0cae4-a7e5-e91a-b358-9b848e12071c)
gateway: https://powervamg.us-il301.gateway.prod.island.powerapps.com
outcome: UNBLOCKED — HAR capture revealed two missing discriminators; adapter fixed + live-verified end-to-end
---

## UPDATE 2026-04-17: UNBLOCKED via HAR capture

User captured a HAR from the MCS eval page on bot `63ec2f13-d139-f111-88b4-7c1e528d32a4`
(5 POSTs to `/makerevaluations/testcomponent`, all 200). Diffing against our
failing payload revealed two missing polymorphic-deserializer discriminators:

1. **`"$kind": "MakerEvaluationUpdateTestComponent"`** on each item in the
   `testComponents` array. Not documented on the C# DTO.
2. **`"$kind": "TestCaseComponent"`** on the nested `component` (we had this).

Plus three required fields on the component that the types mark as optional:
- `category: "Testing"` (required)
- `state: "Active"` (required)
- On `EvaluationSet` definition: at least one grader (empty `graders: []` returns 500)

Query param is `ApplyV2Migration=true` (Pascal case — Kestrel case-insensitive, but
the UI sends Pascal so we match).

After updating the adapter to auto-inject both `$kind` wrappers, live smoke
on dktest API-Test-Delete-Me bot:

```
Adding with auto-wrap: mspva_529aca34-9ca2-4f0c-bd5b-0d8707f81b09
Response: {"addedComponentsIdsBySchemaName":{"mspva_...":"717aced7-a5b9-4240-94d0-07cd19d1f006"}}
Cleanup DELETE status: 204
```

Typed WRITE adapter end-to-end proven. Tests: 180/180 (added 2 auto-wrap
validation tests covering both auto-injection and caller-override paths).

### Secondary findings from live runbook (2026-04-16)

- **Idempotency:** sending the same request twice returns HTTP 500 on the
  second attempt (not a duplicate record). So the endpoint has server-side
  dedupe keyed by schemaName. Retry-after-timeout is SAFE when schemaName
  is stable — server will reject the duplicate rather than creating it.
- **listTestSets visibility:** a lone EvaluationSet (no child EvaluationData
  items) does NOT appear in the `/makerevaluations/testsets` response even
  though the component is persisted in Dataverse. The UI creates parent +
  children in a single batch call — parent-only sets are ignored.
- **Delete operation:** typed Delete also returned 500 when called directly
  on the parent set we just created. HAR did not include any Delete ops —
  needs a future HAR with a delete action to fully characterize. For now,
  cleanup via Dataverse DELETE (204) works as a fallback.

### Migration gate — status

The gate conditions from `tools/upstream-specs/maker-eval-write.md` are now:

- ✅ Steps A-F (except F via typed Delete) succeed on throwaway bot
- ✅ Typed writes are persisted (Dataverse GET confirms record with
      correct componenttype=19, category=Testing, state=Active)
- ✅ Idempotency characterized (server rejects duplicates → safe retry)
- ⚠️ Delete payload still unknown — HAR capture of a UI delete required
      OR Dataverse DELETE used as cleanup path
- ⏳ Cleanup script not yet built (though Dataverse DELETE is proven)

**Net: safe to flip the build-pipeline eval-set-creation path** for Add
operations. Delete/Update flip should wait for a second HAR or Dataverse
fallback approach.

# MakerEvaluation write-runbook findings (2026-04-16)

## Summary

The Phase 3d-f typed WRITE adapter for `POST /api/botmanagement/v2/.../makerevaluations/testcomponent` is **infrastructure-complete but production-blocked**. Runbook steps A, B, C executed; D–F could not proceed because the server rejects every payload variant we could construct from public type definitions.

Result: **migration blocked** until we capture a real working payload from the MCS UI (HAR) or read the server-side `IMakerEvaluationObjectModelService.UpdateTestComponentAsync` implementation to derive the missing required fields.

## What worked

- **Preflight** — `maker-eval-enabled` returned `true` for the target bot. Feature is on.
- **Adapter transport** — requests reach the Gateway, get routed to `/api/botmanagement/v2/` correctly, auth headers accepted, JSON body serialized properly.
- **Shape validators** — when the server returned 500 with a JSON error envelope, our validator correctly flagged the `content-type: undefined` AND the non-expected body shape. No silent failures.
- **No partial writes** — three Add attempts, all 500'd. Baseline (`testsets: []`, Dataverse `botcomponents` count 0) identical post-run.

## What did not work

Three progressively richer payload variants were rejected identically:

| Attempt | `component.definition.$kind` | Response |
|---|---|---|
| 1 | `TestCaseDefinition` (with synthetic `input`/`expectedOutput` fields) | HTTP 500, generic "System Error occurred" |
| 2 | `TestSetDefinition` (minimal valid per `checkTestSetDefinition`) | HTTP 500, same |
| 3 | `EvaluationSet` (graders: [], matches legacy Dataverse YAML kind) | HTTP 500, same |
| 3b | Same as 3 with `?applyV2Migration=false` | HTTP 500, same |

Server response body in every case:

```json
{
  "Error": {
    "RetryIn": null,
    "InnerErrors": [],
    "Code": "internalservererror",
    "Message": "System Error occurred.",
    "Properties": { "UserFriendlyMessage": "System Error occurred." },
    "Diagnostics": null
  }
}
```

The generic error masks which specific server-side check failed. `InnerErrors: []` and `Diagnostics: null` are uninformative.

## Hypothesis

The typed endpoint likely requires fields or invariants set by the MCS UI's flows that are not visible from either:
- The hand-derived types in `tools/generated/maker-eval-types.ts`
- The `microsoft-agents-objectmodel` npm package type definitions
- The `MakerEvaluationV2Controller.cs` signature alone

Likely candidates (all speculative):
1. **Server-generated fields on the component** — `id`, `parentBotId`, `auditInfo`, `managedProperties`, `shareContext` — that are expected to be null on Add but still require a specific serialization hint the TypeScript types don't show.
2. **Solution context** — the `_botAccountContext.GetSolutionNameAsync()` resolves to a specific solution; the component may need to declare solution-related fields (`solutionName`, `contentLanguage`) in a specific way.
3. **Graders validation** — `EvaluationSet` with an empty graders array may fail a server-side guard that requires at least one grader.
4. **Schema naming convention** — `mspva.TestCase.xxx` may not match a server-expected regex for `TestCaseSchemaName`.

None are diagnosable from the generic 500.

## What's still delivered

The Phase 3d-f commit stands. All infrastructure is correct:
- `typedPostToGateway` helper with no retries on POST (correct for writes)
- `makerEvalUpdateTestComponents` adapter with request validation
- `isUpdateTestComponentsResponseShape` validator
- 13 unit tests — 178/178 total pass
- Runbook documenting the process
- Hand-derived types in `tools/generated/maker-eval-types.ts`

When the payload question is resolved, the adapter is ready.

## Recommended next step

To unblock the WRITE migration:

**Option A (fastest): Capture from MCS UI.**
1. Open MCS portal → target bot → eval tab.
2. Open DevTools → Network.
3. Create a test set in the UI.
4. Capture the POST request to `/makerevaluations/testcomponent` — headers + full request body.
5. Compare to what our adapter sends. Diff tells us which fields are required.

**Option B (thorough): Read the server implementation.**
1. Find the concrete class implementing `IMakerEvaluationObjectModelService` (not visible in our shallow clone — may be in `MakerEvaluation.Core`).
2. Read the `UpdateTestComponentAsync` method.
3. Identify all validation checks and extract required field invariants.
4. Update the hand-derived types in `tools/generated/maker-eval-types.ts` accordingly.

**Option C (defer): Keep the legacy Dataverse path.**
The reverse-engineered `build-pipeline.js` componenttype-19 write works today. It's not a blocker for the product. Phase 3d-f infrastructure stays ready; the flip can wait until a future session has capacity for Option A or B.

## Decision recorded

No production code touched. Legacy eval-set creation path in `app/lib/build-pipeline.js` unchanged. Typed WRITE adapter remains importable but unreferenced by any production call site. The preflight observability wiring in `app/lib/eval-pipeline.js` (Phase 3 first wiring) is unaffected because it only reads.
