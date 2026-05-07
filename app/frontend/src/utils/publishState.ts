/**
 * Publish-state matrix — canonical mapping from backend buildStatus.status
 * to user-facing display state. See knowledge/frameworks/publish-state-matrix.md.
 *
 * This is a DISPLAY helper, not an access-control helper. Do not use it to
 * infer permissions — backend is the source of truth for authorization.
 */

export type BackendPublishStatus =
  | "not_started"
  | "in_progress"
  | "published-internal"
  | "published-uat"
  | "published"
  | "failed"
  | string;  // unknown/future states fall through

export type DisplayState =
  | "draft"
  | "building"
  | "internal-needs-eval"
  | "uat"
  | "legacy-published"
  | "failed"
  | "unknown";

export interface EvalGateSummary {
  verdict?: "SHIP" | "ITERATE" | "BLOCK" | string;
  reason?: string;
  override?: boolean;
  overrideApprovedBy?: string;
  overrideTicketRef?: string;
  overallRate?: number;
}

export interface PublishDisplay {
  state: DisplayState;
  label: string;
  badgeVariant: "gray" | "blue" | "amber" | "green" | "yellow" | "red" | "red-outline";
  tooltip: string;
  isUatVisible: boolean;
  hasOverride: boolean;
  primaryCta: string;
}

export function getPublishDisplayState(
  status: BackendPublishStatus | undefined | null,
  evalGate?: EvalGateSummary | null,
): PublishDisplay {
  switch (status) {
    case "not_started":
      return {
        state: "draft",
        label: "Draft",
        badgeVariant: "gray",
        tooltip: "Agent is still in design — not yet built.",
        isUatVisible: false,
        hasOverride: false,
        primaryCta: "Build",
      };

    case "in_progress":
      return {
        state: "building",
        label: "Building…",
        badgeVariant: "blue",
        tooltip: "Build in progress.",
        isUatVisible: false,
        hasOverride: false,
        primaryCta: "View progress",
      };

    case "published-internal": {
      const verdict = evalGate?.verdict || "BLOCK";
      const reason = evalGate?.reason || "Eval gate has not run yet.";
      const truncReason = reason.length > 180 ? reason.slice(0, 177) + "…" : reason;
      return {
        state: "internal-needs-eval",
        label: "Internal — needs eval",
        badgeVariant: "amber",
        tooltip: `Deployed to MCS but NOT user-visible. ${verdict}: ${truncReason}`,
        isUatVisible: false,
        hasOverride: false,
        primaryCta: "Run evals",
      };
    }

    case "published-uat": {
      const override = evalGate?.override === true;
      if (override) {
        const who = evalGate?.overrideApprovedBy || "unknown approver";
        const ticket = evalGate?.overrideTicketRef || "no ticket";
        return {
          state: "uat",
          label: "Published (UAT)",
          badgeVariant: "green",
          tooltip: `UAT — promoted via OVERRIDE by ${who} (ticket ${ticket}). Not eval-passing.`,
          isUatVisible: true,
          hasOverride: true,
          primaryCta: "Update",
        };
      }
      const rate = typeof evalGate?.overallRate === "number" ? ` (eval ${evalGate.overallRate}%)` : "";
      return {
        state: "uat",
        label: "Published (UAT)",
        badgeVariant: "green",
        tooltip: `Passed eval gate${rate}. User-visible in UAT.`,
        isUatVisible: true,
        hasOverride: false,
        primaryCta: "Update",
      };
    }

    case "published":
      // Legacy pre-gate state. Post-backfill these should be migrated to
      // published-internal but we render the grandfathered state correctly.
      return {
        state: "legacy-published",
        label: "Published (pre-gate)",
        badgeVariant: "yellow",
        tooltip: "Published before the eval gate was introduced. Re-run evals to promote to UAT.",
        isUatVisible: true,
        hasOverride: false,
        primaryCta: "Re-run evals",
      };

    case "failed":
      return {
        state: "failed",
        label: "Build failed",
        badgeVariant: "red",
        tooltip: "Build failed. Check errors and retry.",
        isUatVisible: false,
        hasOverride: false,
        primaryCta: "View error",
      };

    default:
      // Unknown / future state — fail closed
      return {
        state: "unknown",
        label: `Unknown (${status || "null"})`,
        badgeVariant: "red-outline",
        tooltip: `Backend returned an unrecognized status: '${status}'. Falling back to not-user-visible.`,
        isUatVisible: false,
        hasOverride: false,
        primaryCta: "File bug",
      };
  }
}
