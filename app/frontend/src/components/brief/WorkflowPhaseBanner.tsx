/**
 * NextStepCard — Passive progress track + single context-appropriate CTA.
 *
 * Replaces the old multi-button WorkflowPhaseBanner with a state-driven
 * card that shows one primary action based on the agent's current state.
 */
import { Check, Loader2, Eye, Microscope, ListChecks, Hammer, FlaskConical, Wrench, Package, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkflowPhase } from "@/types";

interface Props {
  // State inputs
  phase: WorkflowPhase;
  agentStatus: "draft" | "researched" | "ready" | "built";
  evalPassRate: number | null;
  docsChanged: boolean;
  pendingDecisionCount: number;

  // Running state
  isAnalyzing?: boolean;
  isBuilding?: boolean;
  isEvaluating?: boolean;
  isFixing?: boolean;

  // Compat props (still passed by BriefEditor — used for progress track)
  previewGeneratedAt?: string | null;
  researchCompletedAt?: string | null;
  isGenerating?: boolean;
  isResearching?: boolean;

  // Actions
  onAnalyze?: () => void;
  onReviewDecisions?: () => void;
  onApproveAndBuild?: () => void;
  onBuild?: () => void;
  onEvaluate?: () => void;
  onFix?: () => void;
  onPackage?: () => void;
  onBackToProject?: () => void;

  // Legacy (unused but prevents TS errors during migration)
  onGeneratePreview?: () => void;
  onRunResearch?: () => void;
}

// ─── Progress Track ──────────────────────────────────────────────

const TRACK_STEPS = [
  { key: "analyze", label: "Analyze", icon: Eye },
  { key: "review", label: "Review", icon: ListChecks },
  { key: "build", label: "Build", icon: Hammer },
] as const;

function getTrackIndex(phase: WorkflowPhase, agentStatus: string): number {
  if (agentStatus === "built") return 3; // past build
  if (phase === "ready_to_build") return 2;
  if (phase === "decisions") return 1;
  if (phase === "research") return 0;
  return 0; // preview or no phase
}

// ─── Next Step Logic ─────────────────────────────────────────────

interface NextStep {
  text: string;
  cta: string | null;
  action?: () => void;
  variant: "blue" | "amber" | "emerald" | "red" | "muted";
  icon?: React.ReactNode;
}

function getNextStep(props: Props): NextStep {
  const analyzing = props.isAnalyzing || props.isGenerating || props.isResearching;

  // Docs changed takes priority
  if (props.docsChanged) {
    return {
      text: "Source documents changed since last analysis",
      cta: "Refresh Analysis",
      action: props.onAnalyze,
      variant: "amber",
      icon: <Microscope className="h-3.5 w-3.5" />,
    };
  }

  // Not yet analyzed
  if ((!props.phase || props.phase === "preview") && props.agentStatus === "draft" && !analyzing) {
    if (!props.previewGeneratedAt) {
      return {
        text: "Upload docs on the project page to get started",
        cta: "Back to project",
        action: props.onBackToProject,
        variant: "muted",
        icon: <ArrowLeft className="h-3.5 w-3.5" />,
      };
    }
    return {
      text: "Preview complete — run research to design this agent",
      cta: "Run Research",
      action: props.onAnalyze,
      variant: "blue",
      icon: <Microscope className="h-3.5 w-3.5" />,
    };
  }

  // Analyzing
  if (analyzing) {
    return {
      text: "Analyzing documents and researching components...",
      cta: null,
      variant: "blue",
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    };
  }

  // Needs decisions
  if (props.pendingDecisionCount > 0) {
    return {
      text: `${props.pendingDecisionCount} decision${props.pendingDecisionCount > 1 ? "s" : ""} need${props.pendingDecisionCount === 1 ? "s" : ""} your confirmation`,
      cta: "Review Decisions",
      action: props.onReviewDecisions,
      variant: "blue",
      icon: <ListChecks className="h-3.5 w-3.5" />,
    };
  }

  // Ready to build
  if (props.phase === "ready_to_build" || (props.phase === "decisions" && props.pendingDecisionCount === 0)) {
    return {
      text: "Analysis complete — all decisions confirmed",
      cta: "Build Agent",
      action: props.onBuild || props.onApproveAndBuild,
      variant: "amber",
      icon: <Hammer className="h-3.5 w-3.5" />,
    };
  }

  // Building
  if (props.isBuilding) {
    return {
      text: "Building agent in Copilot Studio...",
      cta: null,
      variant: "amber",
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    };
  }

  // Built, no eval
  if (props.agentStatus === "built" && props.evalPassRate === null) {
    return {
      text: "Agent is live — run quality checks",
      cta: "Evaluate",
      action: props.onEvaluate,
      variant: "emerald",
      icon: <FlaskConical className="h-3.5 w-3.5" />,
    };
  }

  // Evaluating
  if (props.isEvaluating) {
    return {
      text: "Evaluating agent quality...",
      cta: null,
      variant: "emerald",
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    };
  }

  // Eval passing
  if (props.evalPassRate !== null && props.evalPassRate >= 85) {
    return {
      text: `All tests passing (${props.evalPassRate}%)`,
      cta: "Package & Upload",
      action: props.onPackage,
      variant: "emerald",
      icon: <Package className="h-3.5 w-3.5" />,
    };
  }

  // Eval failing
  if (props.evalPassRate !== null && props.evalPassRate < 85) {
    return {
      text: `Tests failing (${props.evalPassRate}% pass rate)`,
      cta: "Fix Failures",
      action: props.onFix,
      variant: "red",
      icon: <Wrench className="h-3.5 w-3.5" />,
    };
  }

  // Fixing
  if (props.isFixing) {
    return {
      text: "Fixing failures...",
      cta: null,
      variant: "red",
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    };
  }

  // Research complete but not yet at decisions
  if (props.researchCompletedAt && props.phase === "research") {
    return {
      text: "Research complete — review your agent plan",
      cta: "Review Decisions",
      action: props.onReviewDecisions,
      variant: "blue",
      icon: <ListChecks className="h-3.5 w-3.5" />,
    };
  }

  // Fallback
  return { text: "Ready", cta: null, variant: "muted" };
}

// ─── Variant Styles ──────────────────────────────────────────────

const VARIANT_STYLES: Record<string, { card: string; btn: string; dot: string }> = {
  blue: {
    card: "border-blue-500/30 bg-blue-500/5",
    btn: "bg-blue-600 hover:bg-blue-700 text-white",
    dot: "bg-blue-500",
  },
  amber: {
    card: "border-amber-500/30 bg-amber-500/5",
    btn: "bg-amber-600 hover:bg-amber-700 text-white",
    dot: "bg-amber-500",
  },
  emerald: {
    card: "border-emerald-500/30 bg-emerald-500/5",
    btn: "bg-emerald-600 hover:bg-emerald-700 text-white",
    dot: "bg-emerald-500",
  },
  red: {
    card: "border-red-500/30 bg-red-500/5",
    btn: "bg-red-600 hover:bg-red-700 text-white",
    dot: "bg-red-500",
  },
  muted: {
    card: "border-border bg-surface-1",
    btn: "bg-muted text-foreground hover:bg-muted/80",
    dot: "bg-muted-foreground/30",
  },
};

// ─── Component ───────────────────────────────────────────────────

const WorkflowPhaseBanner = (props: Props) => {
  const trackIdx = getTrackIndex(props.phase, props.agentStatus);
  const nextStep = getNextStep(props);
  const styles = VARIANT_STYLES[nextStep.variant];

  return (
    <div className="mb-4">
      {/* Passive progress track */}
      <div className="flex items-center gap-1 mb-3">
        {TRACK_STEPS.map((step, i) => {
          const StepIcon = step.icon;
          const isCompleted = i < trackIdx;
          const isCurrent = i === trackIdx && trackIdx < 3;
          return (
            <div key={step.key} className="flex items-center gap-1">
              {i > 0 && (
                <div className={`h-px w-6 ${isCompleted ? "bg-emerald-500/40" : "bg-border"}`} />
              )}
              <div
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  isCurrent
                    ? `${styles.card} text-foreground`
                    : isCompleted
                    ? "text-emerald-500 dark:text-emerald-400"
                    : "bg-surface-2 text-muted-foreground/40"
                }`}
              >
                {isCompleted ? <Check className="h-3 w-3" /> : <StepIcon className="h-3 w-3" />}
                {step.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Next Step Card */}
      <div className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${styles.card}`}>
        <div className="flex items-center gap-2.5">
          {nextStep.icon && <span className="text-foreground">{nextStep.icon}</span>}
          <p className="text-sm text-foreground">{nextStep.text}</p>
        </div>
        <div>
          {nextStep.cta && nextStep.action && (
            <Button
              size="sm"
              className={`h-7 text-xs gap-1.5 ${styles.btn}`}
              onClick={nextStep.action}
            >
              {nextStep.cta}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowPhaseBanner;
