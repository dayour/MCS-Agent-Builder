/**
 * ActionToast — Rich toast card for deploy/import/refresh actions.
 *
 * Used with sonner's toast.custom() for branded visual feedback.
 */
import type { ReactNode } from "react";
import { XCircle, ArrowRight } from "lucide-react";

interface ActionToastProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  variant?: "error";
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
}

export default function ActionToast({ icon, title, subtitle, variant, action, onDismiss }: ActionToastProps) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm animate-slide-up-fade ${
        variant === "error"
          ? "bg-destructive/5 border-destructive/30"
          : "bg-card border-border"
      }`}
      style={{ minWidth: 300, maxWidth: 420 }}
      role="alert"
    >
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${variant === "error" ? "text-destructive" : "text-foreground"}`}>
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{subtitle}</p>
        )}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {action.label}
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 mt-0.5 p-0.5 rounded text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          aria-label="Dismiss"
        >
          <XCircle className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
