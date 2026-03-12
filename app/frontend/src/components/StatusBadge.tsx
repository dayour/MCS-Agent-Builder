import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusStyles: Record<string, string> = {
  // Agent lifecycle — matches pipeline progression
  draft: "bg-muted text-muted-foreground",
  researched: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
  ready: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  built: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
  // General states
  "in-progress": "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
  building: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  connected: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
  pending: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  "not-started": "bg-muted text-muted-foreground",
  indexed: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
  open: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  resolved: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
  // Phase tags
  MVP: "bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400",
  Future: "bg-muted text-muted-foreground",
  // Integration status
  available: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
  "needs-setup": "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  "needs-custom": "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  blocked: "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400",
};

const StatusBadge = ({ status, className }: StatusBadgeProps) => (
  <span className={cn(
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
    statusStyles[status] || "bg-muted text-muted-foreground",
    className
  )}>
    {status.replace(/-/g, " ")}
  </span>
);

export default StatusBadge;
