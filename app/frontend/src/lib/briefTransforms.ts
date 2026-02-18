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
import type { BriefData } from "@/types";

/**
 * Convert raw brief.json → UI BriefData shape.
 */
export function briefFromApi(raw: ApiBrief): BriefData {
  const biz = raw.business ?? {};
  const agent = raw.agent ?? {};
  const arch = raw.architecture ?? {};
  const bounds = raw.boundaries ?? {};

  return {
    "business-context": {
      problemStatement: biz.problemStatement ?? biz.useCase ?? "",
      challenges: (biz.challenges ?? []).map((c) =>
        typeof c === "string" ? c : c.challenge ?? ""
      ),
      benefits: (biz.benefits ?? []).map((b) =>
        typeof b === "string" ? b : b.benefit ?? ""
      ),
      successCriteria: (biz.successCriteria ?? []).map((s) => ({
        metric: s.metric ?? "",
        target: s.target ?? "",
        current: (s as any).current ?? s.measurement ?? "",
      })),
      stakeholders: stakeholdersFromApi(biz.stakeholders),
    },
    "agent-identity": {
      name: agent.name ?? "",
      description: agent.description ?? "",
      persona: agent.persona ?? "",
      targetUsers: [
        agent.primaryUsers ?? "",
        agent.secondaryUsers ?? "",
      ].filter(Boolean),
    },
    instructions: {
      systemPrompt: raw.instructions ?? "",
    },
    capabilities: {
      items: (raw.capabilities ?? []).map((c) => ({
        name: c.name ?? "",
        description: c.description ?? "",
        tag: (c.phase ?? "mvp").toUpperCase() === "MVP" ? "MVP" : "Future",
        enabled: (c.phase ?? "mvp").toLowerCase() === "mvp",
      })),
    },
    tools: {
      items: (raw.integrations ?? []).map((i) => ({
        name: i.name ?? "",
        type: i.type ?? "",
        auth: i.authMethod ?? "",
        notes: i.notes ?? "",
      })),
    },
    "knowledge-sources": {
      items: (raw.knowledge ?? []).map((k) => ({
        name: k.name ?? "",
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
      })),
    },
    "scope-boundaries": {
      handles: bounds.handle ?? [],
      politelyDeclines: (bounds.decline ?? []).map((d) =>
        typeof d === "string" ? d : d.topic ?? ""
      ),
      hardRefuses: (bounds.refuse ?? []).map((r) =>
        typeof r === "string" ? r : r.topic ?? ""
      ),
    },
    architecture: {
      pattern: arch.type ?? "",
      patternReasoning: arch.reason ?? "",
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
    scenarios: {
      items: (raw.scenarios ?? []).map((s) => ({
        category: s.category ?? "happy-path",
        title: s.name ?? "",
        userMessage: s.userSays ?? "",
        expectedResponse: s.agentDoes ?? "",
      })),
    },
    "evaluation-tests": {
      items: (raw.evals ?? []).map((e) => ({
        name: e.capability ?? "",
        input: e.question ?? "",
        expectedOutput: e.expected ?? "",
        scoringMethod: e.method ?? "GeneralQuality",
        status: "draft",
      })),
    },
    "open-questions": {
      items: (raw.openQuestions ?? []).map((q) => ({
        question: q.question ?? "",
        assignee: "",
        priority: "Medium",
        status: q.answer ? "resolved" : "open",
        resolution: q.answer ?? undefined,
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
  const bc = ui["business-context"];
  const ai = ui["agent-identity"];
  const arch = ui["architecture"];

  // Business
  result.business = {
    ...result.business,
    problemStatement: bc.problemStatement,
    useCase: result.business?.useCase ?? bc.problemStatement,
    challenges: bc.challenges.map((c) => ({ challenge: c, impact: "medium" })),
    benefits: bc.benefits.map((b) => ({ benefit: b, type: "experience" })),
    successCriteria: bc.successCriteria.map((s) => ({
      metric: s.metric,
      target: s.target,
      measurement: s.current,
    })),
    stakeholders: stakeholdersToApi(bc.stakeholders, result.business?.stakeholders),
  };

  // Agent
  result.agent = {
    ...result.agent,
    name: ai.name,
    description: ai.description,
    persona: ai.persona,
    primaryUsers: ai.targetUsers[0] ?? "",
    secondaryUsers: ai.targetUsers[1] ?? "",
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
      phase: c.enabled ? "mvp" : "future",
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
      notes: t.notes,
    };
  });

  // Knowledge — merge back
  result.knowledge = ui["knowledge-sources"].items.map((k) => {
    const existing = (raw.knowledge ?? []).find((e) => e.name === k.name);
    return {
      ...existing,
      name: k.name,
      purpose: k.purpose,
      scope: k.location,
      phase: k.phase.toLowerCase() === "mvp" ? "mvp" : "future",
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
        phase: t.phase.toLowerCase() === "mvp" ? "mvp" : "future",
        description: t.description,
      };
    }),
  };

  // Boundaries
  result.boundaries = {
    ...result.boundaries,
    handle: ui["scope-boundaries"].handles,
    decline: ui["scope-boundaries"].politelyDeclines.map((topic) => {
      const existing = (raw.boundaries?.decline ?? []).find(
        (d) => (typeof d === "string" ? d : d.topic) === topic
      );
      return typeof existing === "object" ? { ...existing, topic } : { topic, redirect: "" };
    }),
    refuse: ui["scope-boundaries"].hardRefuses.map((topic) => {
      const existing = (raw.boundaries?.refuse ?? []).find(
        (r) => (typeof r === "string" ? r : r.topic) === topic
      );
      return typeof existing === "object" ? { ...existing, topic } : { topic, reason: "" };
    }),
  };

  // Architecture
  result.architecture = {
    ...result.architecture,
    type: arch.pattern,
    reason: arch.patternReasoning,
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

  // Scenarios
  result.scenarios = ui.scenarios.items.map((s) => {
    const existing = (raw.scenarios ?? []).find(
      (e) => e.name === s.title || e.userSays === s.userMessage
    );
    return {
      ...existing,
      name: s.title,
      category: s.category,
      userSays: s.userMessage,
      agentDoes: s.expectedResponse,
    };
  });

  // Evals
  result.evals = ui["evaluation-tests"].items.map((e) => {
    const existing = (raw.evals ?? []).find((ex) => ex.question === e.input);
    return {
      ...existing,
      question: e.input,
      expected: e.expectedOutput,
      method: e.scoringMethod,
      capability: e.name,
    };
  });

  // Open questions
  result.openQuestions = ui["open-questions"].items.map((q) => {
    const existing = (raw.openQuestions ?? []).find((e) => e.question === q.question);
    return {
      ...existing,
      question: q.question,
      answer: q.resolution ?? existing?.answer ?? "",
    };
  });

  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────

function stakeholdersFromApi(
  raw?: { sponsor?: string; owner?: string; users?: string }
): Array<{ name: string; role: string; type: string }> {
  if (!raw) return [];
  const result: Array<{ name: string; role: string; type: string }> = [];
  if (raw.sponsor) result.push({ name: raw.sponsor, role: "Executive Sponsor", type: "Sponsor" });
  if (raw.owner) result.push({ name: raw.owner, role: "Agent Owner", type: "Owner" });
  if (raw.users) result.push({ name: raw.users, role: "Primary Users", type: "User" });
  return result;
}

function stakeholdersToApi(
  ui: Array<{ name: string; role: string; type: string }>,
  existing?: { sponsor?: string; owner?: string; users?: string }
): { sponsor: string; owner: string; users: string } {
  const sponsor = ui.find((s) => s.type === "Sponsor")?.name ?? existing?.sponsor ?? "";
  const owner = ui.find((s) => s.type === "Owner")?.name ?? existing?.owner ?? "";
  const users = ui.find((s) => s.type === "User")?.name ?? existing?.users ?? "";
  return { sponsor, owner, users };
}

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

function factorsToScoring(
  factors?: Record<string, boolean>,
  totalScore?: number
): Array<{ factor: string; score: number; notes: string }> {
  if (!factors) return [];
  return FACTOR_NAMES.map((key) => ({
    factor: FACTOR_LABELS[key] ?? key,
    score: factors[key] ? 1 : 0,
    notes: factors[key] ? "Applies" : "",
  }));
}

function scoringToFactors(
  scoring: Array<{ factor: string; score: number; notes: string }>
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  // Reverse lookup: label → key
  const labelToKey: Record<string, string> = {};
  for (const [key, label] of Object.entries(FACTOR_LABELS)) {
    labelToKey[label] = key;
  }
  for (const s of scoring) {
    const key = labelToKey[s.factor] ?? s.factor;
    result[key] = s.score > 0;
  }
  return result;
}
