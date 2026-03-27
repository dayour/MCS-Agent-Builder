/**
 * SkillProgressPanel — Step cards showing skill execution progress.
 *
 * Generic version of BuildProgressPanel that works with any skill type
 * (research, eval, fix, build) via the skillJobStore.
 */
import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  ChevronDown,
  ChevronRight,
  Terminal,
  AlertTriangle,
  Sparkles,
  SkipForward,
} from "lucide-react";
import { useSkillJobStore, type SkillJob } from "@/stores/skillJobStore";

// ---------------------------------------------------------------------------
// Step status icon
// ---------------------------------------------------------------------------

function StepIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
    case "skipped":
      return <SkipForward className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />;
  }
}

// ---------------------------------------------------------------------------
// Skill type labels
// ---------------------------------------------------------------------------

const SKILL_LABELS: Record<string, { running: string; complete: string; failed: string }> = {
  research: { running: "Researching...", complete: "Research Complete", failed: "Research Failed" },
  eval: { running: "Evaluating...", complete: "Evaluation Complete", failed: "Evaluation Failed" },
  fix: { running: "Fixing...", complete: "Fix Complete", failed: "Fix Failed" },
  build: { running: "Building...", complete: "Build Complete", failed: "Build Failed" },
};

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

interface SkillProgressPanelProps {
  jobKey: string;
  onClose?: () => void;
}

export default function SkillProgressPanel({ jobKey, onClose }: SkillProgressPanelProps) {
  const job = useSkillJobStore((s) => s.jobs[jobKey]) as SkillJob | undefined;
  const [showLog, setShowLog] = useState(false);

  if (!job) return null;

  const labels = SKILL_LABELS[job.skillType] || SKILL_LABELS.build;
  const isTerminal = job.phase === "completed" || job.phase === "failed";

  const headerIcon = isTerminal
    ? job.phase === "completed"
      ? <Sparkles className="h-5 w-5 text-emerald-500" />
      : <AlertTriangle className="h-5 w-5 text-destructive" />
    : <Loader2 className="h-5 w-5 text-primary animate-spin" />;

  const headerText = isTerminal
    ? job.phase === "completed"
      ? labels.complete
      : labels.failed
    : job.phase === "paused_auth"
    ? "Waiting for Authorization"
    : job.phase === "starting"
    ? "Starting..."
    : labels.running;

  const completedCount = job.steps.filter((s) => s.status === "completed").length;
  const totalSteps = job.steps.length;

  return (
    <div className="flex flex-col gap-4 p-4 rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center gap-3">
        {headerIcon}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">{headerText}</h3>
          {totalSteps > 0 && (
            <p className="text-xs text-muted-foreground">
              {completedCount} of {totalSteps} steps complete
            </p>
          )}
        </div>
        {totalSteps > 0 && !isTerminal && (
          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / totalSteps) * 100}%` }}
            />
          </div>
        )}
        {isTerminal && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>

      {/* Step list */}
      <div className="space-y-1">
        {job.steps.map((step) => (
          <div
            key={step.id}
            className={`flex items-start gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
              step.status === "running"
                ? "bg-primary/5 border border-primary/20"
                : step.status === "failed"
                ? "bg-destructive/5 border border-destructive/20"
                : "border border-transparent"
            }`}
          >
            <div className="mt-0.5">
              <StepIcon status={step.status} />
            </div>
            <div className="flex-1 min-w-0">
              <span
                className={
                  step.status === "pending" || step.status === "skipped"
                    ? "text-muted-foreground/50"
                    : "text-foreground"
                }
              >
                {step.label}
              </span>
              {step.detail && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {step.detail}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Errors */}
      {job.errors.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
          {job.errors.map((err, i) => (
            <p key={i} className="text-xs text-destructive flex items-start gap-1.5">
              <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
              {err}
            </p>
          ))}
        </div>
      )}

      {/* Summary */}
      {job.summary && isTerminal && (
        <div className={`rounded-md border p-3 text-xs ${
          job.phase === "completed"
            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
            : "border-destructive/30 bg-destructive/5 text-destructive"
        }`}>
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
          <pre className="mt-2 max-h-60 overflow-auto rounded-md bg-zinc-950 text-zinc-300 p-3 text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all">
            {job.rawLog || "No output yet..."}
          </pre>
        )}
      </div>
    </div>
  );
}
