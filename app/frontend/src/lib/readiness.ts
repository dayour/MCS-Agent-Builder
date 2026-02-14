/**
 * Client-side readiness calculator — mirrors server.py _calc_readiness().
 *
 * 12 checks, each worth equal weight. Returns 0–100.
 */
import type { BriefData } from "@/types";

export function calcReadiness(data: BriefData): number {
  const bc = data["business-context"];
  const arch = data["architecture"];
  const caps = data["capabilities"]?.items ?? [];
  const tools = data["tools"]?.items ?? [];
  const knowledge = data["knowledge-sources"]?.items ?? [];
  const topics = data["conversation-topics"]?.items ?? [];
  const bounds = data["scope-boundaries"];
  const scenarios = data["scenarios"]?.items ?? [];
  const evals = data["evaluation-tests"]?.items ?? [];
  const questions = data["open-questions"]?.items ?? [];
  const unanswered = questions.filter((q) => q.question && q.status !== "resolved");

  const checks = [
    Boolean(bc.problemStatement),                                         // 1. Business context
    Boolean(arch.pattern),                                                // 2. Architecture
    Boolean(data.instructions?.systemPrompt),                             // 3. Instructions
    tools.filter((t) => t.name).length + topics.filter((t) => t.name).length > 0,  // 4. Components
    knowledge.filter((k) => k.name).length > 0,                           // 5. Knowledge
    scenarios.filter((s) => s.userMessage).length >= 3,                   // 6. Scenarios (3+)
    evals.length > 0,                                                     // 7. Evals defined
    Boolean(bounds.handles.length || bounds.politelyDeclines.length || bounds.hardRefuses.length), // 8. Boundaries
    Boolean(arch.triggers?.length),                                       // 9. Channels/Triggers
    unanswered.length === 0,                                              // 10. Questions resolved
    false,                                                                // 11. Build published (set externally)
    false,                                                                // 12. Eval results (set externally)
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
  const bc = data["business-context"];
  const arch = data["architecture"];
  const tools = data["tools"]?.items ?? [];
  const knowledge = data["knowledge-sources"]?.items ?? [];
  const topics = data["conversation-topics"]?.items ?? [];
  const bounds = data["scope-boundaries"];
  const scenarios = data["scenarios"]?.items ?? [];
  const evals = data["evaluation-tests"]?.items ?? [];
  const questions = data["open-questions"]?.items ?? [];
  const unanswered = questions.filter((q) => q.question && q.status !== "resolved");

  const checks = [
    Boolean(bc.problemStatement),
    Boolean(arch.pattern),
    Boolean(data.instructions?.systemPrompt),
    tools.filter((t) => t.name).length + topics.filter((t) => t.name).length > 0,
    knowledge.filter((k) => k.name).length > 0,
    scenarios.filter((s) => s.userMessage).length >= 3,
    evals.length > 0,
    Boolean(bounds.handles.length || bounds.politelyDeclines.length || bounds.hardRefuses.length),
    Boolean(arch.triggers?.length),
    unanswered.length === 0,
    buildPublished,
    hasEvalResults,
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

/**
 * Per-section completion check for the sidebar.
 */
export function sectionCompletion(data: BriefData): Record<string, boolean> {
  const bc = data["business-context"];
  const ai = data["agent-identity"];
  const arch = data["architecture"];
  const tools = data["tools"]?.items ?? [];
  const knowledge = data["knowledge-sources"]?.items ?? [];
  const topics = data["conversation-topics"]?.items ?? [];
  const bounds = data["scope-boundaries"];
  const scenarios = data["scenarios"]?.items ?? [];
  const evals = data["evaluation-tests"]?.items ?? [];
  const questions = data["open-questions"]?.items ?? [];

  return {
    "business-context": Boolean(bc.problemStatement),
    "agent-identity": Boolean(ai.name && ai.description),
    architecture: Boolean(arch.pattern && arch.model),
    instructions: Boolean(data.instructions?.systemPrompt),
    capabilities: data["capabilities"]?.items?.some((c) => c.name) ?? false,
    tools: tools.some((t) => t.name),
    "knowledge-sources": knowledge.some((k) => k.name),
    "conversation-topics": topics.some((t) => t.name),
    "scope-boundaries": Boolean(
      bounds.handles.length || bounds.politelyDeclines.length || bounds.hardRefuses.length
    ),
    scenarios: scenarios.filter((s) => s.userMessage).length >= 3,
    "evaluation-tests": evals.length > 0,
    "open-questions": questions.filter((q) => q.question && q.status !== "resolved").length === 0,
  };
}
