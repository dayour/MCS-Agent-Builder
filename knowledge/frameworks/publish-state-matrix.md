# Publish-State Matrix

Canonical mapping from backend `buildStatus.status` to user-facing semantics.
Frontend components MUST consult this matrix rather than aggregating states
with a loose `isPublishedStatus()` helper — that's how `-internal` and
`-uat` accidentally collapse into a single "Published" badge.

## States

| Backend state | User-facing label | Badge color | Readiness counts as "published"? | UAT-visible? | Primary CTA |
|---|---|---|:---:|:---:|---|
| `not_started` | Draft | gray | no | no | Build |
| `in_progress` | Building... | blue (in-progress) | no | no | (running) |
| `published-internal` | Internal — needs eval | amber | yes (for readiness aggregation) | **no** | Run evals |
| `published-uat` | Published (UAT) | green | yes | yes | Update / Publish new version |
| `published` (legacy) | Published (pre-gate) | yellow-gray | yes | yes (grandfathered) | Re-run evals to promote to UAT |
| `failed` | Build failed | red | no | no | View error / retry |
| (unknown) | Unknown state | red outline | **fail-closed** (no) | **no** | (show error, file bug) |

### Key rules

1. **`published-internal` never shows as "Published" without qualification.** The amber badge + "needs eval" copy must be visible so maintainers know the agent is not yet user-visible.
2. **Unknown states fail closed.** If the backend returns a state not in this matrix, the UI treats it as `failed` for access control but renders a distinctive red-outline badge so it's obviously wrong (not silently "Published").
3. **`evalGate.verdict` drives the amber tooltip.** When status is `published-internal`, the tooltip shows `evalGate.verdict` (BLOCK / ITERATE / "no tests") + `evalGate.reason` so owners see what to fix.
4. **`evalGate.override=true` adds a purple "Override" sub-badge.** Owners can tell at a glance that UAT promotion was by explicit approval, not by eval pass. Tooltip shows `overrideApprovedBy` + `overrideTicketRef`.

## Readiness vs display

These are orthogonal axes and must not be conflated:

- **Readiness** (backend `readiness.js`) = "has enough content to build + publish?" Aggregates across all published-* states because readiness is *spec-level*, not *eval-level*.
- **Display state** (frontend) = "what does the user SEE right now?" Must distinguish `-internal` from `-uat` because those are different user experiences.

The backend `isPublishedStatus()` helper stays aggregate (used for readiness). The frontend gets a separate `getPublishDisplayState()` function that returns the 7-state matrix above.

## Feature flag, tenant rollout, role considerations (not yet implemented)

Per GPT review 2026-04-17: "evalGate visibility may depend on role, feature flags, environment, or bot type rather than publish status alone."

Reserved fields in `evalGate`:

- `visibility: "all" | "maker" | "admin"` — who sees the block reason
- `featureFlag: string | null` — flag name if the gate is behind a rollout

Until these are wired, the UI shows full detail to anyone who can see the agent. Document as known-gap in `knowledge/learnings/eval-gate-rollout.md` when rolling out to customers.

## Test contract

Frontend tests MUST cover:

- Every state in the matrix above (including `failed` and unknown)
- Transition: `published-internal` → `published-uat` after SHIP verdict
- Override badge rendering when `evalGate.override === true`
- Tooltip content includes `evalGate.reason` and truncates long reasons
- Unknown state renders distinctively (red outline), NOT as "Published"
