/**
 * Client-side readiness helpers for the brief editor sidebar.
 */
import type { BriefData } from "@/types";

/** Count total tests across all eval sets. */
function totalEvalTests(data: BriefData): number {
  return (data["eval-sets"]?.sets ?? []).reduce(
    (sum, s) => sum + (s.tests?.length ?? 0), 0
  );
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
