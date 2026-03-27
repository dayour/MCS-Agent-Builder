import { useEffect, useState, useRef } from "react";
import { watchEnrichment, type EnrichmentStepEvent } from "@/lib/api";
import { Loader2, Check, X, Sparkles } from "lucide-react";

interface EnrichmentStep {
  status: string;
  label: string;
  detail?: string;
}

interface Props {
  jobId: string;
  onComplete?: () => void;
}

export default function EnrichmentBanner({ jobId, onComplete }: Props) {
  const [steps, setSteps] = useState<Record<string, EnrichmentStep>>({});
  const [status, setStatus] = useState<string>("running");
  const [errors, setErrors] = useState<string[]>([]);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    watchEnrichment(jobId, (event: EnrichmentStepEvent) => {
      if (event.type === "state" && event.steps) {
        setSteps(event.steps);
        if (event.status) setStatus(event.status);
      } else if (event.type === "step" && event.step) {
        setSteps((prev) => ({
          ...prev,
          [event.step!]: {
            ...prev[event.step!],
            status: event.status || "running",
            detail: event.detail,
          },
        }));
      } else if (event.type === "done") {
        setStatus(event.status || "completed");
        setErrors(event.errors || []);
        onComplete?.();
      }
    }).catch(() => {
      setStatus("failed");
    });
  }, [jobId, onComplete]);

  if (status !== "running" && Object.keys(steps).length === 0) return null;

  const isDone = status !== "running";
  const stepEntries = Object.entries(steps);

  return (
    <div className={`mb-4 rounded-lg border px-4 py-3 ${
      isDone
        ? errors.length > 0
          ? "border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700"
          : "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700"
        : "border-primary/30 bg-primary/5"
    }`}>
      <div className="flex items-center gap-2 mb-2">
        {isDone ? (
          errors.length > 0 ? (
            <X className="h-4 w-4 text-amber-600" />
          ) : (
            <Check className="h-4 w-4 text-emerald-600" />
          )
        ) : (
          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
        )}
        <span className="text-sm font-medium">
          {isDone
            ? errors.length > 0
              ? "Enrichment completed with issues"
              : "Brief enrichment complete"
            : "Enriching your brief..."}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 ml-6">
        {stepEntries.map(([key, step]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs">
            {step.status === "completed" ? (
              <Check className="h-3 w-3 text-emerald-500 shrink-0" />
            ) : step.status === "failed" ? (
              <X className="h-3 w-3 text-destructive shrink-0" />
            ) : step.status === "running" ? (
              <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
            ) : (
              <span className="h-3 w-3 rounded-full border border-muted-foreground/30 shrink-0" />
            )}
            <span className="text-muted-foreground">
              {step.label}
              {step.detail && step.status === "completed" && (
                <span className="text-foreground/60 ml-1">({step.detail})</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {errors.length > 0 && (
        <div className="mt-2 ml-6 text-xs text-amber-700 dark:text-amber-400">
          {errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}
    </div>
  );
}
