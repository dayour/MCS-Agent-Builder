/**
 * BuildProgressPanel — Elevate-style visual checklist with timeline.
 *
 * Vertical timeline connecting step markers, gradient active step,
 * collapsible completed steps, confetti on success.
 */
import { useState, useEffect, useRef } from "react";
import {
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  Terminal,
  AlertTriangle,
  Sparkles,
  SkipForward,
  Lock,
} from "lucide-react";
import { useBuildJobStore } from "@/stores/buildJobStore";

// ---------------------------------------------------------------------------
// Step marker on the vertical timeline
// ---------------------------------------------------------------------------

function StepMarker({ status, index }: { status: string; index: number }) {
  const base = "relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold shrink-0 transition-all duration-300";

  switch (status) {
    case "completed":
      return (
        <div className={`${base} bg-emerald-500 text-white shadow-sm`}>
          <Check className="h-3.5 w-3.5" />
        </div>
      );
    case "running":
      return (
        <div className={`${base} bg-[hsl(var(--brand-background))] text-primary shadow-sm shadow-primary/20 animate-pulse-subtle`}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        </div>
      );
    case "failed":
      return (
        <div className={`${base} bg-destructive/15 text-destructive`}>
          <X className="h-3.5 w-3.5" />
        </div>
      );
    case "skipped":
      return (
        <div className={`${base} bg-muted text-muted-foreground/50`}>
          <SkipForward className="h-3 w-3" />
        </div>
      );
    default:
      return (
        <div className={`${base} border-2 border-border bg-background text-muted-foreground/40`}>
          {index + 1}
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// Connector line between steps
// ---------------------------------------------------------------------------

function Connector({ completed }: { completed: boolean }) {
  return (
    <div className="absolute left-[13px] top-7 bottom-0 w-0.5">
      <div
        className={`h-full w-full rounded-full transition-colors duration-500 ${
          completed ? "bg-emerald-500/40" : "bg-border"
        }`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confetti burst on completion
// ---------------------------------------------------------------------------

const CONFETTI_COLORS = ["hsl(237 81% 60%)", "hsl(199 89% 55%)", "hsl(142 71% 45%)", "hsl(45 93% 58%)", "hsl(340 82% 60%)"];

function ConfettiBurst() {
  const [visible, setVisible] = useState(true);
  // Stable particle config — generated once on mount
  const particles = useRef(
    Array.from({ length: 24 }, (_, i) => ({
      left: `${8 + Math.random() * 84}%`,
      color: CONFETTI_COLORS[i % 5],
      delay: `${Math.random() * 0.8}s`,
      duration: `${1.5 + Math.random()}s`,
    })),
  );

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {particles.current.map((p, i) => (
        <div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full animate-confetti-fall"
          style={{
            left: p.left,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function BuildProgressPanel() {
  const job = useBuildJobStore((s) => s.job);
  const phase = useBuildJobStore((s) => s.phase);
  const [showLog, setShowLog] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const activeRef = useRef<HTMLDivElement>(null);

  // Reset local state when job changes
  const jobId = job?.jobId;
  useEffect(() => {
    setExpandedSteps(new Set());
    setShowLog(false);
  }, [jobId]);

  // Auto-scroll active step into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [job?.steps.find((s) => s.status === "running")?.id]);

  if (!job) return null;

  const isTerminal = phase === "completed" || phase === "failed";
  const completedCount = job.steps.filter((s) => s.status === "completed").length;
  const totalSteps = job.steps.length;
  const progress = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;

  const toggleStep = (id: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="relative flex flex-col gap-4 p-4">
      {/* Confetti on success */}
      {phase === "completed" && <ConfettiBurst />}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
          phase === "completed"
            ? "bg-emerald-500/10"
            : phase === "failed"
            ? "bg-destructive/10"
            : "bg-[hsl(var(--brand-background))]"
        }`}>
          {phase === "completed" ? (
            <Sparkles className="h-4.5 w-4.5 text-emerald-500" />
          ) : phase === "failed" ? (
            <AlertTriangle className="h-4.5 w-4.5 text-destructive" />
          ) : phase === "paused_auth" ? (
            <Lock className="h-4.5 w-4.5 text-amber-500" />
          ) : (
            <Loader2 className="h-4.5 w-4.5 text-primary animate-spin" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">
            {phase === "completed" ? "Build Complete" :
             phase === "failed" ? "Build Failed" :
             phase === "paused_auth" ? "Waiting for Authorization" :
             phase === "starting" ? "Starting Build..." :
             "Publishing Agent..."}
          </h3>
          {totalSteps > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {completedCount} of {totalSteps} steps complete
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {totalSteps > 0 && !isTerminal && (
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, hsl(237 81% 60%), hsl(199 89% 55%))",
            }}
          />
        </div>
      )}

      {/* Timeline checklist */}
      <div className="relative">
        {job.steps.map((step, i) => {
          const isActive = step.status === "running";
          const isFailed = step.status === "failed";
          const isCompleted = step.status === "completed";
          const isLast = i === job.steps.length - 1;
          const isExpanded = isActive || isFailed || expandedSteps.has(step.id);

          return (
            <div
              key={step.id}
              ref={isActive ? activeRef : undefined}
              className="relative flex gap-3 pb-3 last:pb-0"
            >
              {/* Vertical connector */}
              {!isLast && <Connector completed={isCompleted} />}

              {/* Marker */}
              <StepMarker status={step.status} index={i} />

              {/* Content */}
              <div
                className={`flex-1 min-w-0 rounded-lg px-3 py-2 transition-all duration-300 ${
                  isActive
                    ? "bg-[hsl(var(--brand-background))] border border-primary/20"
                    : isFailed
                    ? "bg-destructive/5 border border-destructive/20"
                    : "border border-transparent"
                }`}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 text-left"
                  onClick={() => isCompleted && toggleStep(step.id)}
                >
                  <span
                    className={`text-sm flex-1 ${
                      step.status === "pending" || step.status === "skipped"
                        ? "text-muted-foreground/50"
                        : isActive
                        ? "font-medium text-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                  {isActive && (
                    <span className="inline-block w-1 h-1 rounded-full bg-primary animate-pulse-subtle" />
                  )}
                </button>

                {/* Expanded detail */}
                {isExpanded && step.detail && (
                  <p className="mt-1 text-xs text-muted-foreground animate-slide-up-fade">
                    {step.detail}
                  </p>
                )}

                {/* Active step shimmer */}
                {isActive && !step.detail && (
                  <div className="mt-1.5 h-2 w-3/4 rounded shimmer" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Errors */}
      {job.errors.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1.5 animate-slide-up-fade">
          {job.errors.map((err, i) => (
            <p key={i} className="text-xs text-destructive flex items-start gap-1.5">
              <X className="h-3 w-3 mt-0.5 shrink-0" />
              {err}
            </p>
          ))}
        </div>
      )}

      {/* Success summary */}
      {job.summary && phase === "completed" && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-300 animate-scale-in">
          {job.summary}
        </div>
      )}

      {/* Failure summary */}
      {job.summary && phase === "failed" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {job.summary}
        </div>
      )}

      {/* Debug log toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowLog(!showLog)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Terminal className="h-3 w-3" />
          {showLog ? (
            <><ChevronDown className="h-3 w-3" /> Hide Console</>
          ) : (
            <><ChevronRight className="h-3 w-3" /> Show Console</>
          )}
        </button>
        {showLog && (
          <pre className="mt-2 max-h-60 overflow-auto rounded-xl bg-zinc-950 text-zinc-300 p-3 text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all">
            {job.rawLog || "No output yet..."}
          </pre>
        )}
      </div>
    </div>
  );
}
