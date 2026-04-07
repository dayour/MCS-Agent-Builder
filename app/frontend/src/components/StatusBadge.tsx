import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  // Agent lifecycle — matches pipeline progression
  draft: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  researched: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
  ready: { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  built: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  // General states
  "in-progress": { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
  building: { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500 animate-pulse" },
  connected: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  pending: { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  "not-started": { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  indexed: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  open: { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  resolved: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  // Phase tags
  MVP: { bg: "bg-[hsl(var(--brand-background))]", text: "text-primary", dot: "bg-primary" },
  Future: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  // Integration status
  available: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  "needs-setup": { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  "needs-custom": { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  blocked: { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
};

const defaultConfig = { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" };

const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const cfg = statusConfig[status] || defaultConfig;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize",
      cfg.bg, cfg.text,
      className,
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
      {status.replace(/-/g, " ")}
    </span>
  );
};

export default StatusBadge;
