import { Check, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import type { ComparisonResult } from "@/lib/api";

interface DualModelBadgeProps {
  comparison: ComparisonResult | null;
  status: "idle" | "running" | "complete" | "failed" | "disabled";
  onClick?: () => void;
}

const BADGE_CONFIG = {
  agree: {
    icon: Check,
    label: "Models agree",
    className: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800",
  },
  partial: {
    icon: AlertTriangle,
    label: "Models partially agree",
    className: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800",
  },
  diverge: {
    icon: AlertTriangle,
    label: "Models disagree",
    className: "text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950/30 dark:border-orange-800",
  },
  conflict: {
    icon: XCircle,
    label: "Models conflict",
    className: "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-800",
  },
} as const;

export default function DualModelBadge({ comparison, status, onClick }: DualModelBadgeProps) {
  if (status === "disabled" || status === "idle") return null;

  if (status === "running") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 ml-9">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Comparing models...</span>
      </div>
    );
  }

  if (status === "failed" || !comparison) return null;

  const config = BADGE_CONFIG[comparison.agreement];
  const Icon = config.icon;
  const isClickable = comparison.agreement !== "agree";

  return (
    <button
      className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border mt-1 ml-9 transition-colors ${config.className} ${
        isClickable ? "cursor-pointer hover:opacity-80" : "cursor-default"
      }`}
      onClick={isClickable ? onClick : undefined}
      title={isClickable ? "Click to see comparison details" : undefined}
    >
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
      <span className="text-[10px] opacity-60">
        ({Math.round(comparison.similarityScore * 100)}%)
      </span>
    </button>
  );
}
