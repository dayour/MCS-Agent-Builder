/**
 * Client-side readiness calculator — mirrors server.py _calc_readiness().
 *
 * 12 checks, each worth equal weight. Returns 0–100.
 * Eval sets replace the old scenarios + evals checks.
 */
import type { BriefData } from "@/types";

/** Count total tests across all eval sets. */
function totalEvalTests(data: BriefData): number {
  return (data["eval-sets"]?.sets ?? []).reduce(
    (sum, s) => sum + (s.tests?.length ?? 0), 0
  );
}

/** Check if any eval test has a lastResult. */
function hasAnyEvalResult(data: BriefData): boolean {
  return (data["eval-sets"]?.sets ?? []).some((s) =>
    s.tests?.some((t) => t.lastResult != null)
  );
}

export function calcReadiness(data: BriefData): number {
  const ov = data["overview"];
  const arch = data["architecture"];
  const solutionType = arch?.solutionType ?? "agent";
  const isNonAgent = solutionType === "flow" || solutionType === "not-recommended";

  // Non-agent types use a reduced check set (5 checks instead of 12)
  if (isNonAgent) {
    const questions = data["open-questions"]?.items ?? [];
    const unanswered = questions.filter((q) => q.question && q.status !== "resolved");
    const decisions = data.decisions?.items ?? [];
    const pendingBlockers = decisions.filter(
      (d) => d.status === "pending" && (d.category === "architecture" || d.category === "infrastructure")
    );
    const checks = [
      Boolean(ov.problemStatement),                                       // 1. Business context
      Boolean(arch.solutionType),                                         // 2. Solution type assessed
      (data["capabilities"]?.items ?? []).some((c) => c.name),            // 3. Capabilities identified
      Boolean(arch.alternativeRecommendation),                            // 4. Alternative recommendation
      pendingBlockers.length === 0,                                       // 5. No blocking decisions
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  const tools = data["tools"]?.items ?? [];
  const knowledge = data["knowledge-sources"]?.items ?? [];
  const topics = data["conversation-topics"]?.items ?? [];
  const bounds = data["scope-boundaries"];
  const questions = data["open-questions"]?.items ?? [];
  const unanswered = questions.filter((q) => q.question && q.status !== "resolved");
  const decisions = data.decisions?.items ?? [];
  const pendingBlockers = decisions.filter(
    (d) => d.status === "pending" && (d.category === "architecture" || d.category === "infrastructure")
  );

  const checks = [
    Boolean(ov.problemStatement),                                         // 1. Business context
    Boolean(arch.pattern),                                                // 2. Architecture
    Boolean(data.instructions?.systemPrompt),                             // 3. Instructions
    tools.filter((t) => t.name).length + topics.filter((t) => t.name).length > 0,  // 4. Components
    knowledge.filter((k) => k.name).length > 0,                           // 5. Knowledge
    totalEvalTests(data) >= 5,                                            // 6. Eval tests defined (5+)
    Boolean(bounds.handles.length || bounds.politelyDeclines.length || bounds.hardRefuses.length), // 7. Boundaries
    Boolean(arch.channels?.length || arch.triggers?.length),               // 8. Channels/Triggers
    unanswered.length === 0,                                              // 9. Questions resolved
    false,                                                                // 10. Build published (set externally)
    false,                                                                // 11. Eval results exist (set externally)
    pendingBlockers.length === 0,                                         // 12. No blocking decisions pending
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

/**
 * Enhanced readiness that includes build + eval status from raw brief.
 */
export function calcReadinessWithStatus(
  data: BriefData,
  buildPublished: boolean,
  hasEvalResults: boolean
): number {
  const ov = data["overview"];
  const arch = data["architecture"];
  const solutionType = arch?.solutionType ?? "agent";
  const isNonAgent = solutionType === "flow" || solutionType === "not-recommended";

  // Non-agent types use a reduced check set
  if (isNonAgent) {
    const questions = data["open-questions"]?.items ?? [];
    const unanswered = questions.filter((q) => q.question && q.status !== "resolved");
    const decisions = data.decisions?.items ?? [];
    const pendingBlockers = decisions.filter(
      (d) => d.status === "pending" && (d.category === "architecture" || d.category === "infrastructure")
    );
    const checks = [
      Boolean(ov.problemStatement),
      Boolean(arch.solutionType),
      (data["capabilities"]?.items ?? []).some((c) => c.name),
      Boolean(arch.alternativeRecommendation),
      pendingBlockers.length === 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  const tools = data["tools"]?.items ?? [];
  const knowledge = data["knowledge-sources"]?.items ?? [];
  const topics = data["conversation-topics"]?.items ?? [];
  const bounds = data["scope-boundaries"];
  const questions = data["open-questions"]?.items ?? [];
  const unanswered = questions.filter((q) => q.question && q.status !== "resolved");
  const decisions = data.decisions?.items ?? [];
  const pendingBlockers = decisions.filter(
    (d) => d.status === "pending" && (d.category === "architecture" || d.category === "infrastructure")
  );

  const checks = [
    Boolean(ov.problemStatement),
    Boolean(arch.pattern),
    Boolean(data.instructions?.systemPrompt),
    tools.filter((t) => t.name).length + topics.filter((t) => t.name).length > 0,
    knowledge.filter((k) => k.name).length > 0,
    totalEvalTests(data) >= 5,
    Boolean(bounds.handles.length || bounds.politelyDeclines.length || bounds.hardRefuses.length),
    Boolean(arch.triggers?.length),
    unanswered.length === 0,
    buildPublished,
    hasEvalResults || hasAnyEvalResult(data),
    pendingBlockers.length === 0,
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

/**
 * Per-section completion check for the sidebar.
 */
export function sectionCompletion(data: BriefData): Record<string, boolean> {
  const ov = data["overview"];
  const arch = data["architecture"];
  const tools = data["tools"]?.items ?? [];
  const knowledge = data["knowledge-sources"]?.items ?? [];
  const topics = data["conversation-topics"]?.items ?? [];
  const bounds = data["scope-boundaries"];
  const questions = data["open-questions"]?.items ?? [];

  return {
    overview: Boolean(ov.name && ov.problemStatement),
    architecture: Boolean(arch.pattern || arch.solutionType),
    decisions: (() => {
      const items = data.decisions?.items ?? [];
      if (items.length === 0) return true;
      return items.every((d) => d.status !== "pending");
    })(),
    instructions: Boolean(data.instructions?.systemPrompt),
    capabilities: data["capabilities"]?.items?.some((c) => c.name) ?? false,
    tools: tools.some((t) => t.name),
    "knowledge-sources": knowledge.some((k) => k.name),
    "conversation-topics": topics.some((t) => t.name),
    "scope-boundaries": Boolean(
      bounds.handles.length || bounds.politelyDeclines.length || bounds.hardRefuses.length
    ),
    "eval-sets": totalEvalTests(data) >= 5,
    "open-questions": questions.filter((q) => q.question && q.status !== "resolved").length === 0,
  };
}
