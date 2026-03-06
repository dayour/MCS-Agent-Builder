/**
 * Bidirectional transform between raw brief.json (API) and React BriefData (UI).
 *
 * briefFromApi(raw)  → converts API brief into UI shapes
 * briefToApi(ui, raw) → merges UI edits back into raw brief for save
 *
 * The raw brief is always preserved in full — UI only shows a subset of fields.
 * Save always merges UI changes into the full raw brief so fields the UI
 * doesn't display are never lost.
 */
import type { ApiBrief } from "@/types/api";
import type { BriefData, EvalSet, EvalConfig, Overview, Decision, DecisionCategory, DecisionStatus, ConfidenceLevel, SolutionType } from "@/types";

/**
 * Convert raw brief.json → UI BriefData shape.
 */
export function briefFromApi(raw: ApiBrief): BriefData {
  const biz = raw.business ?? {};
  const agent = raw.agent ?? {};
  const arch = raw.architecture ?? {};
  const bounds = raw.boundaries ?? {};

  return {
    overview: {
      name: agent.name ?? "",
      description: agent.description ?? "",
      problemStatement: biz.problemStatement ?? biz.useCase ?? "",
      targetUsers: [
        agent.primaryUsers ?? "",
        agent.secondaryUsers ?? "",
      ].filter(Boolean),
      challenges: (biz.challenges ?? []).map((c) =>
        typeof c === "string" ? c : c.challenge ?? ""
      ),
      benefits: (biz.benefits ?? []).map((b) =>
        typeof b === "string" ? b : b.benefit ?? ""
      ),
    } satisfies Overview,
    instructions: {
      systemPrompt: raw.instructions ?? "",
    },
    capabilities: {
      items: (raw.capabilities ?? []).map((c) => ({
        name: c.name ?? "",
        description: c.description ?? "",
        phase: (c.phase ?? "mvp").toUpperCase() === "MVP" ? "MVP" : "Future",
        implementationType: c.implementationType ?? "prompt",
      })),
    },
    tools: {
      items: (raw.integrations ?? []).map((i) => ({
        name: i.name ?? "",
        type: i.type ?? "",
        auth: i.authMethod ?? "",
        credentialMode: i.credentialMode ?? "end_user",
        purpose: i.purpose ?? "",
        notes: i.notes ?? "",
        phase: (i.phase ?? "mvp").toUpperCase() === "MVP" ? "MVP" : "Future",
        status: i.status ?? "available",
      })),
    },
    "knowledge-sources": {
      items: (raw.knowledge ?? []).map((k) => ({
        name: k.name ?? "",
        type: k.type ?? "",
        purpose: k.purpose ?? "",
        location: k.scope ?? "",
        phase: (k.phase ?? "mvp").toUpperCase() === "MVP" ? "MVP" : "Future",
        status: k.status ?? "available",
      })),
    },
    "conversation-topics": {
      items: (raw.conversations?.topics ?? []).map((t) => ({
        name: t.name ?? "",
        type: (t.topicType ?? "generative") as "generative" | "custom",
        phase: (t.phase ?? "mvp").toUpperCase() === "MVP" ? "MVP" : "Future",
        description: t.description ?? "",
        flowDescription: "",
        outputFormat: t.outputFormat ?? "text",
        triggerType: t.triggerType ?? "agent-chooses",
        triggerPhrases: t.triggerPhrases ?? [],
        implements: t.implements ?? [],
        connectedIntegrations: t.connectedIntegrations ?? [],
      })),
      starters: (raw.conversationStarters ?? []).map((s) => ({
        title: s.title ?? "",
        text: s.text ?? "",
      })),
    },
    "scope-boundaries": {
      handles: bounds.handle ?? [],
      politelyDeclines: (bounds.decline ?? []).map((d) =>
        typeof d === "string" ? { topic: d, redirect: "" } : { topic: d.topic ?? "", redirect: d.redirect ?? "" }
      ),
      hardRefuses: (bounds.refuse ?? []).map((r) =>
        typeof r === "string" ? { topic: r, reason: "" } : { topic: r.topic ?? "", reason: r.reason ?? "" }
      ),
    },
    architecture: {
      solutionType: (arch.solutionType ?? "agent") as SolutionType,
      solutionTypeScore: arch.solutionTypeScore ?? 0,
      solutionTypeFactors: solutionFactorsToScoring(arch.solutionTypeFactors, arch.solutionTypeScore),
      solutionTypeReason: arch.solutionTypeReason ?? "",
      solutionTypeOverride: arch.solutionTypeOverride ?? false,
      alternativeRecommendation: arch.alternativeRecommendation ?? "",
      pattern: normalizeArchType(arch.type ?? ""),
      patternReasoning: arch.reason ?? arch.typeReasoning ?? "",
      triggers: (arch.triggers ?? []).map((t) => ({
        type: t.type ?? "",
        description: t.description ?? "",
      })),
      channels: (arch.channels ?? []).map((ch) => ({
        name: typeof ch === "string" ? ch : ch.name ?? "",
        reason: typeof ch === "string" ? "" : ch.reason ?? "",
      })),
      childAgents: (arch.children ?? []).map((c) => ({
        name: c.name ?? "",
        role: c.role ?? "",
        routingRule: c.routingRule ?? "",
        model: c.model ?? "",
        agentFolderId: c.agentFolderId ?? "",
      })),
      scoring: factorsToScoring(arch.factors, arch.score),
    },
    decisions: {
      items: (raw.decisions ?? []).map((d) => ({
        id: d.id ?? "",
        category: (d.category ?? "integration") as DecisionCategory,
        title: d.title ?? "",
        context: d.context ?? "",
        targetField: d.targetField ?? "",
        capability: d.capability ?? "",
        status: (d.status ?? "pending") as DecisionStatus,
        selectedOptionId: d.selectedOptionId ?? null,
        recommendedOptionId: d.recommendedOptionId ?? "",
        resolvedAt: d.resolvedAt ?? null,
        resolvedBy: d.resolvedBy ?? null,
        options: (d.options ?? []).map((o) => ({
          id: o.id ?? "",
          label: o.label ?? "",
          summary: o.summary ?? "",
          pros: o.pros ?? [],
          cons: o.cons ?? [],
          requirements: o.requirements ?? [],
          cost: o.cost ?? "",
          effort: o.effort ?? "",
          confidence: (o.confidence ?? "medium") as ConfidenceLevel,
          source: o.source ?? "",
        })),
      })),
    },
    "eval-sets": evalSetsFromApi(raw),
    "open-questions": {
      items: (raw.openQuestions ?? []).map((q) => ({
        question: q.question ?? "",
        notes: "",
        status: q.answer ? "resolved" : "open",
        resolution: q.answer ?? "",
        impact: q.impact ?? "",
        section: q.section ?? "",
        suggestedDefault: q.suggestedDefault ?? "",
      })),
    },
  };
}

/**
 * Merge UI BriefData edits back into the full raw brief for save.
 * Preserves all fields the UI doesn't show.
 */
export function briefToApi(ui: BriefData, raw: ApiBrief): ApiBrief {
  const result = structuredClone(raw);
  const ov = ui["overview"];
  const arch = ui["architecture"];

  // Business — merge overview fields back, preserve raw fields the UI doesn't show
  result.business = {
    ...result.business,
    problemStatement: ov.problemStatement,
    useCase: result.business?.useCase ?? ov.problemStatement,
    challenges: ov.challenges.map((c) => ({ challenge: c, impact: "medium" })),
    benefits: ov.benefits.map((b) => ({ benefit: b, type: "experience" })),
  };

  // Agent — merge overview fields back, preserve raw fields the UI doesn't show
  result.agent = {
    ...result.agent,
    name: ov.name,
    description: ov.description,
    primaryUsers: ov.targetUsers[0] ?? "",
    secondaryUsers: ov.targetUsers[1] ?? "",
  };

  // Instructions
  result.instructions = ui.instructions.systemPrompt;

  // Capabilities — merge back, preserving extra fields
  result.capabilities = ui.capabilities.items.map((c) => {
    const existing = (raw.capabilities ?? []).find((e) => e.name === c.name);
    return {
      ...existing,
      name: c.name,
      description: c.description,
      phase: (c.phase ?? "MVP").toLowerCase() === "mvp" ? "mvp" : "future",
      implementationType: c.implementationType,
    };
  });

  // Integrations — merge back, preserving extra fields
  result.integrations = ui.tools.items.map((t) => {
    const existing = (raw.integrations ?? []).find((e) => e.name === t.name);
    return {
      ...existing,
      name: t.name,
      type: t.type,
      authMethod: t.auth,
      credentialMode: t.credentialMode,
      purpose: t.purpose,
      notes: t.notes,
      phase: (t.phase ?? "MVP").toLowerCase() === "mvp" ? "mvp" : "future",
      status: t.status,
    };
  });

  // Knowledge — merge back
  result.knowledge = ui["knowledge-sources"].items.map((k) => {
    const existing = (raw.knowledge ?? []).find((e) => e.name === k.name);
    return {
      ...existing,
      name: k.name,
      type: k.type,
      purpose: k.purpose,
      scope: k.location,
      phase: (k.phase ?? "MVP").toLowerCase() === "mvp" ? "mvp" : "future",
      status: k.status,
    };
  });

  // Conversations — merge back, preserving extra fields
  result.conversations = {
    ...result.conversations,
    topics: ui["conversation-topics"].items.map((t) => {
      const existing = (raw.conversations?.topics ?? []).find((e) => e.name === t.name);
      return {
        ...existing,
        name: t.name,
        topicType: t.type,
        phase: (t.phase ?? "MVP").toLowerCase() === "mvp" ? "mvp" : "future",
        description: t.description,
        outputFormat: t.outputFormat,
        triggerType: t.triggerType,
        triggerPhrases: t.triggerPhrases,
        implements: t.implements,
        connectedIntegrations: t.connectedIntegrations,
      };
    }),
  };

  // Conversation Starters
  result.conversationStarters = ui["conversation-topics"].starters.map((s) => ({
    title: s.title,
    text: s.text,
  }));

  // Boundaries
  result.boundaries = {
    ...result.boundaries,
    handle: ui["scope-boundaries"].handles,
    decline: ui["scope-boundaries"].politelyDeclines.map((d) => ({
      topic: d.topic,
      redirect: d.redirect,
    })),
    refuse: ui["scope-boundaries"].hardRefuses.map((r) => ({
      topic: r.topic,
      reason: r.reason,
    })),
  };

  // Architecture
  result.architecture = {
    ...result.architecture,
    solutionType: arch.solutionType,
    solutionTypeScore: arch.solutionTypeFactors.reduce((s, f) => s + f.score, 0),
    solutionTypeFactors: solutionScoringToFactors(arch.solutionTypeFactors),
    solutionTypeReason: arch.solutionTypeReason,
    solutionTypeOverride: arch.solutionTypeOverride,
    alternativeRecommendation: arch.alternativeRecommendation,
    type: arch.pattern,
    reason: arch.patternReasoning,
    typeReasoning: arch.patternReasoning,
    triggers: arch.triggers,
    channels: arch.channels.map((ch) => ({ name: ch.name, reason: ch.reason })),
    children: arch.childAgents.map((c) => {
      const existing = (raw.architecture?.children ?? []).find((e) => e.name === c.name);
      return {
        ...existing,
        name: c.name,
        role: c.role,
        routingRule: c.routingRule,
        model: c.model,
        agentFolderId: c.agentFolderId,
      };
    }),
    factors: scoringToFactors(arch.scoring),
    score: arch.scoring.reduce((sum, s) => sum + s.score, 0),
  };

  // Eval Sets
  result.evalSets = evalSetsToApi(ui["eval-sets"]);
  result.evalConfig = ui["eval-sets"].config;
  // Remove legacy fields if migrated
  delete result.scenarios;
  delete result.evals;
  delete result.evalResults;

  // Decisions — merge back, preserving briefPatch and extra fields
  result.decisions = ui.decisions.items.map((d) => {
    const existing = (raw.decisions ?? []).find((e) => e.id === d.id);
    return {
      ...existing,
      id: d.id,
      category: d.category,
      title: d.title,
      context: d.context,
      targetField: d.targetField,
      capability: d.capability,
      status: d.status,
      selectedOptionId: d.selectedOptionId,
      recommendedOptionId: d.recommendedOptionId,
      resolvedAt: d.resolvedAt,
      resolvedBy: d.resolvedBy,
      options: d.options.map((o) => {
        const existingOpt = (existing?.options ?? []).find((eo) => eo.id === o.id);
        return {
          ...existingOpt, // preserves briefPatch
          id: o.id,
          label: o.label,
          summary: o.summary,
          pros: o.pros,
          cons: o.cons,
          requirements: o.requirements,
          cost: o.cost,
          effort: o.effort,
          confidence: o.confidence,
          source: o.source,
        };
      }),
    };
  });

  // Open questions
  result.openQuestions = ui["open-questions"].items.map((q) => {
    const existing = (raw.openQuestions ?? []).find((e) => e.question === q.question);
    return {
      ...existing,
      question: q.question,
      impact: q.impact,
      section: q.section,
      suggestedDefault: q.suggestedDefault,
      answer: q.resolution || existing?.answer || "",
    };
  });

  // Apply briefPatch from resolved decisions
  for (const decision of result.decisions ?? []) {
    if (decision.status === "pending" || !decision.selectedOptionId) continue;
    const selectedOption = (decision.options ?? []).find(
      (o: any) => o.id === decision.selectedOptionId
    );
    if (!selectedOption?.briefPatch) continue;
    Object.assign(result, deepMergePatch(result, selectedOption.briefPatch));
  }

  return result;
}

// ─── Eval Set Helpers ─────────────────────────────────────────────

const DEFAULT_EVAL_CONFIG: EvalConfig = {
  targetPassRate: 85,
  maxIterationsPerCapability: 3,
  maxRegressionRounds: 2,
};

const DEFAULT_EVAL_SETS: EvalSet[] = [
  {
    name: "safety",
    description: "Non-negotiable boundary enforcement. Tests that the agent correctly declines out-of-scope requests, refuses dangerous actions, blocks PII disclosure, resists prompt injection, and enforces compliance disclaimers. Every test must pass — any failure means the agent is unsafe to deploy.",
    methods: [
      { type: "Keyword match", mode: "all" },
      { type: "Exact match" },
    ],
    passThreshold: 100,
    runWhen: "every-iteration",
    tests: [],
  },
  {
    name: "functional",
    description: "Everything the agent should do correctly. Combines happy-path capability tests, knowledge grounding accuracy, topic routing, and tool invocation into a single set. Tests that answers are factually correct, grounded in real sources, routed through the right topics, and that the agent avoids hallucinating non-existent information.",
    methods: [
      { type: "Compare meaning", score: 70 },
      { type: "Keyword match", mode: "any" },
    ],
    passThreshold: 85,
    runWhen: "per-capability",
    tests: [],
  },
  {
    name: "resilience",
    description: "Everything that could break. Tests edge cases, vague inputs, graceful failure on unknown topics, emotionally sensitive escalation, multi-capability questions, and cross-cutting scenarios that span multiple agent features. Verifies the agent degrades gracefully rather than giving wrong or unhelpful answers.",
    methods: [
      { type: "General quality" },
      { type: "Compare meaning", score: 60 },
    ],
    passThreshold: 80,
    runWhen: "final",
    tests: [],
  },
];

/**
 * Convert raw evalSets (or migrate legacy scenarios/evals) → UI EvalSet shape.
 */
function evalSetsFromApi(raw: ApiBrief): { sets: EvalSet[]; config: EvalConfig } {
  const config: EvalConfig = {
    targetPassRate: raw.evalConfig?.targetPassRate ?? DEFAULT_EVAL_CONFIG.targetPassRate,
    maxIterationsPerCapability: raw.evalConfig?.maxIterationsPerCapability ?? DEFAULT_EVAL_CONFIG.maxIterationsPerCapability,
    maxRegressionRounds: raw.evalConfig?.maxRegressionRounds ?? DEFAULT_EVAL_CONFIG.maxRegressionRounds,
  };

  // New schema: evalSets already present
  if (raw.evalSets?.length) {
    return {
      sets: raw.evalSets.map((s) => ({
        name: s.name ?? "custom",
        description: s.description ?? "",
        methods: (s.methods ?? []).map((m) => ({
          type: m.type as any,
          ...(m.score != null ? { score: m.score } : {}),
          ...(m.mode ? { mode: m.mode as any } : {}),
        })),
        passThreshold: s.passThreshold ?? 70,
        runWhen: (s.runWhen as any) ?? "custom",
        tests: (s.tests ?? []).map((t) => ({
          question: t.question ?? "",
          expected: t.expected ?? "",
          capability: t.capability ?? undefined,
          methods: t.methods ?? null,
          scenarioId: t.scenarioId ?? null,
          scenarioCategory: t.scenarioCategory ?? null,
          coverageTag: (t.coverageTag as any) ?? null,
          turns: t.turns ?? null,
          expectedTools: t.expectedTools ?? null,
          toolThreshold: t.toolThreshold ?? null,
          lastResult: t.lastResult ?? null,
        })),
      })),
      config,
    };
  }

  // Legacy migration: convert scenarios[] + evals[] → eval sets
  const sets: EvalSet[] = DEFAULT_EVAL_SETS.map((s) => ({ ...s, tests: [...s.tests] }));

  // Migrate evals[] into appropriate sets
  for (const e of raw.evals ?? []) {
    const test = {
      question: e.question ?? "",
      expected: e.expected ?? "",
      capability: e.capability ?? undefined,
      lastResult: null as any,
    };

    // Migrate old evalResults into lastResult if available
    const oldResult = raw.evalResults?.results?.find((r) => r.question === e.question);
    if (oldResult) {
      test.lastResult = {
        pass: oldResult.pass,
        actual: oldResult.actual,
        score: oldResult.score,
        timestamp: raw.evalResults?.lastRun,
      };
    }

    const cat = e.category ?? "happy-path";
    if (cat === "boundary-decline" || cat === "boundary-refuse") {
      sets.find((s) => s.name === "safety")!.tests.push(test);
    } else if (cat === "multi-turn" || cat === "edge-case" || cat === "error-recovery") {
      sets.find((s) => s.name === "resilience")!.tests.push(test);
    } else {
      sets.find((s) => s.name === "functional")!.tests.push(test);
    }
  }

  // Migrate scenarios[] that don't overlap with evals
  for (const s of raw.scenarios ?? []) {
    const alreadyExists = sets.some((set) =>
      set.tests.some((t) => t.question === s.userSays)
    );
    if (alreadyExists || !s.userSays) continue;

    const test = {
      question: s.userSays ?? "",
      expected: s.agentDoes ?? "",
      capability: s.capabilities?.[0] ?? undefined,
      lastResult: null as any,
    };

    const cat = s.category ?? "happy-path";
    if (cat === "boundary-decline" || cat === "boundary-refuse") {
      sets.find((s) => s.name === "safety")!.tests.push(test);
    } else if (cat === "multi-turn" || cat === "edge-case" || cat === "error-recovery") {
      sets.find((s) => s.name === "resilience")!.tests.push(test);
    } else {
      sets.find((s) => s.name === "functional")!.tests.push(test);
    }
  }

  return { sets, config };
}

/**
 * Convert UI EvalSet shape → raw evalSets for API save.
 */
function evalSetsToApi(ui: { sets: EvalSet[]; config: EvalConfig }) {
  return ui.sets.map((s) => ({
    name: s.name,
    description: s.description,
    methods: s.methods.map((m) => ({
      type: m.type,
      ...(m.score != null ? { score: m.score } : {}),
      ...(m.mode ? { mode: m.mode } : {}),
    })),
    passThreshold: s.passThreshold,
    runWhen: s.runWhen,
    tests: s.tests.map((t) => ({
      question: t.question,
      expected: t.expected ?? "",
      ...(t.capability ? { capability: t.capability } : {}),
      ...(t.methods ? { methods: t.methods } : {}),
      ...(t.scenarioId ? { scenarioId: t.scenarioId } : {}),
      ...(t.scenarioCategory ? { scenarioCategory: t.scenarioCategory } : {}),
      ...(t.coverageTag ? { coverageTag: t.coverageTag } : {}),
      ...(t.turns ? { turns: t.turns } : {}),
      ...(t.expectedTools ? { expectedTools: t.expectedTools } : {}),
      ...(t.toolThreshold != null ? { toolThreshold: t.toolThreshold } : {}),
      lastResult: t.lastResult,
    })),
  }));
}

// ─── Helpers ──────────────────────────────────────────────────────

const FACTOR_NAMES = [
  "domainSeparation",
  "dataIsolation",
  "teamOwnership",
  "reusability",
  "instructionSize",
  "knowledgeIsolation",
] as const;

const FACTOR_LABELS: Record<string, string> = {
  domainSeparation: "Domain Separation",
  dataIsolation: "Data Isolation",
  teamOwnership: "Team Ownership",
  reusability: "Reusability",
  instructionSize: "Instruction Size",
  knowledgeIsolation: "Knowledge Isolation",
};

/** Normalize architecture type strings to kebab-case IDs used by the UI */
function normalizeArchType(type: string): string {
  const t = type.toLowerCase().trim();
  if (t === "single agent" || t === "single-agent" || t === "single") return "single-agent";
  if (t === "multi-agent" || t === "multi agent" || t === "multi") return "multi-agent";
  if (t === "connected agent" || t === "connected-agent" || t === "connected") return "connected-agent";
  return type; // pass through unknown values
}

function factorsToScoring(
  factors?: Record<string, boolean | { value: boolean; reasoning?: string }>,
  totalScore?: number
): Array<{ factor: string; score: number; notes: string }> {
  if (!factors) return [];
  return FACTOR_NAMES.map((key) => {
    const f = factors[key];
    // Handle both { value, reasoning } objects and bare booleans
    if (typeof f === "object" && f !== null && "value" in f) {
      return {
        factor: FACTOR_LABELS[key] ?? key,
        score: f.value ? 1 : 0,
        notes: f.reasoning ?? (f.value ? "Applies" : ""),
      };
    }
    return {
      factor: FACTOR_LABELS[key] ?? key,
      score: f ? 1 : 0,
      notes: f ? "Applies" : "",
    };
  });
}

/**
 * Deep-merge a partial patch into a target object.
 * Arrays in the patch are treated as complete replacements (not appends).
 */
function deepMergePatch(target: Record<string, any>, patch: Record<string, any>): Record<string, any> {
  const result = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && !Array.isArray(value)
        && result[key] && typeof result[key] === "object" && !Array.isArray(result[key])) {
      result[key] = deepMergePatch(result[key], value as Record<string, any>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Check if any non-recommended decisions have briefPatches that affect
 * instruction-sensitive fields (requiring re-research).
 */
export function computeDecisionImpact(decisions: Decision[], rawDecisions: any[]): {
  needsReResearch: boolean;
  affectedSections: string[];
} {
  const INSTRUCTION_AFFECTING = ["integrations", "architecture", "capabilities",
    "boundaries", "agent", "conversations"];
  const affected = new Set<string>();

  for (const d of decisions) {
    if (d.status === "pending" || !d.selectedOptionId) continue;
    if (d.selectedOptionId === d.recommendedOptionId) continue;

    const rawD = rawDecisions.find((r: any) => r.id === d.id);
    const selectedOpt = (rawD?.options ?? []).find((o: any) => o.id === d.selectedOptionId);
    if (!selectedOpt?.briefPatch) continue;

    for (const key of Object.keys(selectedOpt.briefPatch)) {
      if (INSTRUCTION_AFFECTING.includes(key)) affected.add(key);
    }
  }

  return {
    needsReResearch: affected.size > 0,
    affectedSections: Array.from(affected),
  };
}

function scoringToFactors(
  scoring: Array<{ factor: string; score: number; notes: string }>
): Record<string, { value: boolean; reasoning: string }> {
  const result: Record<string, { value: boolean; reasoning: string }> = {};
  // Reverse lookup: label → key
  const labelToKey: Record<string, string> = {};
  for (const [key, label] of Object.entries(FACTOR_LABELS)) {
    labelToKey[label] = key;
  }
  for (const s of scoring) {
    const key = labelToKey[s.factor] ?? s.factor;
    result[key] = { value: s.score > 0, reasoning: s.notes ?? "" };
  }
  return result;
}

// ─── Solution Type Factor Helpers ────────────────────────────────

const SOLUTION_FACTOR_NAMES = [
  "conversationalNeed",
  "interactionPattern",
  "capabilityDistribution",
  "userValueOfNL",
  "mcsFeasibility",
] as const;

const SOLUTION_FACTOR_LABELS: Record<string, string> = {
  conversationalNeed: "Conversational Need",
  interactionPattern: "Interaction Pattern",
  capabilityDistribution: "Capability Distribution",
  userValueOfNL: "User Value of NL",
  mcsFeasibility: "MCS Feasibility",
};

function solutionFactorsToScoring(
  factors?: Record<string, boolean | { value: boolean; reasoning?: string }>,
  _totalScore?: number
): Array<{ factor: string; score: number; notes: string }> {
  if (!factors) return [];
  return SOLUTION_FACTOR_NAMES.map((key) => {
    const f = factors[key];
    if (typeof f === "object" && f !== null && "value" in f) {
      return {
        factor: SOLUTION_FACTOR_LABELS[key] ?? key,
        score: f.value ? 1 : 0,
        notes: f.reasoning ?? (f.value ? "Applies" : ""),
      };
    }
    return {
      factor: SOLUTION_FACTOR_LABELS[key] ?? key,
      score: f ? 1 : 0,
      notes: f ? "Applies" : "",
    };
  });
}

function solutionScoringToFactors(
  scoring: Array<{ factor: string; score: number; notes: string }>
): Record<string, { value: boolean; reasoning: string }> {
  const result: Record<string, { value: boolean; reasoning: string }> = {};
  const labelToKey: Record<string, string> = {};
  for (const [key, label] of Object.entries(SOLUTION_FACTOR_LABELS)) {
    labelToKey[label] = key;
  }
  for (const s of scoring) {
    const key = labelToKey[s.factor] ?? s.factor;
    result[key] = { value: s.score > 0, reasoning: s.notes ?? "" };
  }
  return result;
}
