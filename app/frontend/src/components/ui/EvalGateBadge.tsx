/**
 * EvalGateBadge — renders the canonical publish-state badge defined in
 * publish-state-matrix.md. Consumes a backend buildStatus.status +
 * optional evalGate summary and produces the 7 distinct visual states.
 *
 * This is a PURE presentational component. No data fetching. Parent
 * components pass the backend state as props.
 */

import React from "react";
import {
  getPublishDisplayState,
  type BackendPublishStatus,
  type EvalGateSummary,
  type PublishDisplay,
} from "../../utils/publishState";

interface EvalGateBadgeProps {
  status?: BackendPublishStatus | null;
  evalGate?: EvalGateSummary | null;
  /** Show the secondary "Override" sub-badge when evalGate.override=true. Default true. */
  showOverrideBadge?: boolean;
  className?: string;
}

const BADGE_CLASSES: Record<PublishDisplay["badgeVariant"], string> = {
  gray:         "bg-[hsl(var(--muted))] text-[hsl(var(--text-subtle))] border-[hsl(var(--muted))]",
  blue:         "bg-[hsl(var(--status-info)/0.12)] text-[hsl(var(--status-info))] border-[hsl(var(--status-info)/0.3)]",
  amber:        "bg-[hsl(var(--status-warning)/0.12)] text-[hsl(var(--status-warning))] border-[hsl(var(--status-warning)/0.3)]",
  green:        "bg-[hsl(var(--status-success)/0.12)] text-[hsl(var(--status-success))] border-[hsl(var(--status-success)/0.3)]",
  yellow:       "bg-[hsl(var(--status-warning)/0.08)] text-[hsl(var(--status-warning))] border-[hsl(var(--status-warning)/0.2)]",
  red:          "bg-[hsl(var(--status-error)/0.12)] text-[hsl(var(--status-error))] border-[hsl(var(--status-error)/0.3)]",
  "red-outline":"bg-white text-[hsl(var(--status-error))] border-[hsl(var(--status-error))] border-2",
};

const DOT_CLASSES: Record<PublishDisplay["badgeVariant"], string> = {
  gray:         "bg-[hsl(var(--text-disabled))]",
  blue:         "bg-[hsl(var(--status-info))]",
  amber:        "bg-[hsl(var(--status-warning))]",
  green:        "bg-[hsl(var(--status-success))]",
  yellow:       "bg-[hsl(var(--status-warning))]",
  red:          "bg-[hsl(var(--status-error))]",
  "red-outline":"bg-[hsl(var(--status-error))]",
};

export function EvalGateBadge({
  status,
  evalGate,
  showOverrideBadge = true,
  className = "",
}: EvalGateBadgeProps) {
  const display = getPublishDisplayState(status, evalGate);
  const badgeCls = BADGE_CLASSES[display.badgeVariant];
  const dotCls = DOT_CLASSES[display.badgeVariant];

  return (
    <span
      className={`inline-flex items-center gap-2 ${className}`}
      data-testid="eval-gate-badge"
      data-state={display.state}
    >
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${badgeCls}`}
        title={display.tooltip}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} aria-hidden="true" />
        {display.label}
      </span>
      {showOverrideBadge && display.hasOverride && (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-purple-300 text-purple-700 bg-purple-50"
          title={
            `Override approved by ${evalGate?.overrideApprovedBy || "unknown"}` +
            (evalGate?.overrideTicketRef ? ` — ticket ${evalGate.overrideTicketRef}` : "")
          }
          data-testid="eval-gate-override-badge"
        >
          Override
        </span>
      )}
    </span>
  );
}
