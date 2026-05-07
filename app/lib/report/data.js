/**
 * Server-side data transformer for HTML reports.
 * Ports the field mapping logic from briefTransforms.ts:specFromApi()
 * and computes aggregate metrics for template rendering.
 */
const fs = require("fs");

// ── Eval set defaults (mirrors briefTransforms.ts) ──────────────

const EVAL_SET_NAME_MIGRATION = {
  safety: "boundaries",
  functional: "quality",
  resilience: "edge-cases",
};

// ── Main entry point ────────────────────────────────────────────

function loadAndTransform(briefPath) {
  const raw = JSON.parse(fs.readFileSync(briefPath, "utf-8"));
  return transformBrief(raw);
}

function transformBrief(raw) {
  const biz = raw.business || {};
  const agent = raw.agent || {};
  const arch = raw.architecture || {};
  const bounds = raw.boundaries || {};
  const wf = raw.workflow || {};

  // ── Overview ──────────────────────────────────────────────
  const overview = {
    name: agent.name || "",
    description: agent.description || "",
    problemStatement: biz.problemStatement || biz.useCase || "",
    targetUsers: agent.targetUsers?.length
      ? agent.targetUsers.filter(Boolean)
      : [agent.primaryUsers, agent.secondaryUsers].filter(Boolean),
    challenges: (biz.challenges || []).map(c => typeof c === "string" ? c : c.challenge || ""),
    benefits: (biz.benefits || []).map(b => typeof b === "string" ? b : b.benefit || ""),
    persona: agent.persona || "",
    responseFormat: agent.responseFormat || "",
  };

  // ── Capabilities ──────────────────────────────────────────
  const capabilities = (raw.capabilities || []).map(c => ({
    name: c.name || "",
    description: c.description || "",
    phase: (c.phase || "mvp").toUpperCase() === "MVP" ? "MVP" : "Future",
    implementationType: c.implementationType || "prompt",
  }));

  // ── Integrations (raw.integrations -> "tools") ────────────
  const integrations = (raw.integrations || []).map(i => ({
    name: i.name || "",
    type: i.type || "",
    auth: i.authMethod || "",
    purpose: i.purpose || "",
    phase: (i.phase || "mvp").toUpperCase() === "MVP" ? "MVP" : "Future",
    status: i.status || "available",
  }));

  // ── Knowledge Sources ─────────────────────────────────────
  const knowledgeSources = (raw.knowledge || []).map(k => ({
    name: k.name || "",
    type: k.type || "",
    purpose: k.purpose || "",
    location: k.scope || "",
    phase: (k.phase || "mvp").toUpperCase() === "MVP" ? "MVP" : "Future",
    status: k.status || "available",
  }));

  // ── Conversation Topics ───────────────────────────────────
  const topics = (raw.conversations?.topics || []).map(t => ({
    name: t.name || "",
    type: t.topicType || "generative",
    phase: (t.phase || "mvp").toUpperCase() === "MVP" ? "MVP" : "Future",
    description: t.description || "",
    flowDescription: t.flowDescription || "",
    outputFormat: t.outputFormat || "text",
    triggerType: t.triggerType || "agent-chooses",
    triggerPhrases: t.triggerPhrases || [],
    implements: t.implements || [],
    connectedIntegrations: t.connectedIntegrations || [],
  }));

  // ── Scope / Boundaries ────────────────────────────────────
  const scope = {
    handles: (bounds.handle || []).map(h => typeof h === "string" ? h : h.text || ""),
    declines: (bounds.decline || []).map(d =>
      typeof d === "string" ? { topic: d, redirect: "" } : { topic: d.topic || "", redirect: d.redirect || "" }
    ),
    refuses: (bounds.refuse || []).map(r =>
      typeof r === "string" ? { topic: r, reason: "" } : { topic: r.topic || "", reason: r.reason || "" }
    ),
  };

  // ── Architecture ──────────────────────────────────────────
  const architecture = {
    solutionType: arch.solutionType || "agent",
    solutionTypeScore: arch.solutionTypeScore || 0,
    solutionTypeReason: arch.solutionTypeReason || "",
    alternativeRecommendation: arch.alternativeRecommendation || "",
    pattern: normalizeArchType(arch.type || ""),
    patternReasoning: arch.reason || arch.typeReasoning || "",
    triggers: (arch.triggers || []).map(t => ({ type: t.type || "", description: t.description || "" })),
    channels: (arch.channels || []).map(ch =>
      typeof ch === "string" ? { name: ch, reason: "" } : { name: ch.name || "", reason: ch.reason || "" }
    ),
    childAgents: (arch.children || []).map(c => ({
      name: c.name || "", role: c.role || "", routingRule: c.routingRule || "", model: c.model || "",
    })),
    buildPath: arch.buildPath || null,
    buildPathReason: arch.buildPathReason || "",
    frontierAgentMatch: (arch.frontierAgentMatch || []).map(m => ({
      agentName: m.agentName || "", matchedCapabilities: m.matchedCapabilities || [],
      coverage: m.coverage || "none", recommendation: m.recommendation || "",
      licenseRequired: m.licenseRequired || "", notes: m.notes || "",
    })),
    scoring: factorsToScoring(arch.factors, arch.score),
  };

  // ── Decisions ─────────────────────────────────────────────
  const decisions = (raw.decisions || []).map(d => ({
    id: d.id || "",
    category: d.category || "integration",
    title: d.title || "",
    context: d.context || "",
    capability: d.capability || "",
    status: d.status || "pending",
    selectedOptionId: d.selectedOptionId || null,
    recommendedOptionId: d.recommendedOptionId || "",
    options: (d.options || []).map(o => ({
      id: o.id || "", label: o.label || "", summary: o.summary || "",
      pros: o.pros || [], cons: o.cons || [], requirements: o.requirements || [],
      cost: o.cost || "", effort: o.effort || "", confidence: o.confidence || "medium",
    })),
  }));

  // ── Eval Sets ─────────────────────────────────────────────
  const evalSets = transformEvalSets(raw);

  // ── Open Questions ────────────────────────────────────────
  const openQuestions = (raw.openQuestions || []).map(q => ({
    question: q.question || "",
    notes: q.notes || "",
    status: q.status || (q.answer ? "resolved" : "open"),
    resolution: q.answer || "",
    impact: q.impact || "",
    section: q.section || "",
  }));

  // ── Instructions ──────────────────────────────────────────
  const instructions = raw.instructions || "";

  // ── Compute Metrics ───────────────────────────────────────
  const mvpCaps = capabilities.filter(c => c.phase === "MVP");
  const futureCaps = capabilities.filter(c => c.phase === "Future");

  let totalTests = 0, testedTests = 0, passedTests = 0;
  for (const set of evalSets) {
    let setTested = 0, setPassed = 0;
    for (const t of set.tests) {
      totalTests++;
      if (t.lastResult != null) {
        testedTests++;
        setTested++;
        if (t.lastResult.pass) { passedTests++; setPassed++; }
      }
    }
    // Attach computed stats directly to each set
    set.testedCount = setTested;
    set.passedCount = setPassed;
    set.passRate = setTested > 0 ? Math.round((setPassed / setTested) * 100) : null;
  }
  const overallPassRate = testedTests > 0 ? Math.round((passedTests / testedTests) * 100) : null;

  const pendingDecisions = decisions.filter(d => d.status === "pending").length;
  const openQuestionCount = openQuestions.filter(q => q.status !== "resolved").length;

  // Compute readiness (simple heuristic matching existing UI)
  const readiness = computeReadiness(raw, capabilities, integrations, knowledgeSources, evalSets, decisions, openQuestions);

  // ── Build status (for build/deployment reports) ───────────
  const buildStatus = raw.buildStatus || null;

  // ── Workflow ──────────────────────────────────────────────
  const workflow = {
    phase: wf.phase || "preview",
    previewConfirmed: wf.previewConfirmed || false,
    decisionsConfirmed: wf.decisionsConfirmed || false,
  };

  // ── Connected agents ──────────────────────────────────────
  const connectedAgents = (raw.connectedAgents || []).map(ca => ({
    name: ca.name || "", source: ca.source || "",
    phase: (ca.phase || "mvp").toUpperCase() === "MVP" ? "MVP" : "Future",
    status: ca.status || "needs-setup", role: ca.role || "",
    description: ca.description || "",
  }));

  return {
    // Metadata
    generated_date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),

    // Overview
    overview,
    instructions,

    // Sections
    capabilities,
    integrations,
    knowledgeSources,
    topics,
    scope,
    architecture,
    decisions,
    evalSets,
    openQuestions,
    connectedAgents,

    // Metrics
    metrics: {
      readiness,
      capabilityCount: capabilities.length,
      mvpCount: mvpCaps.length,
      futureCount: futureCaps.length,
      integrationCount: integrations.length,
      knowledgeCount: knowledgeSources.length,
      topicCount: topics.length,
      totalTests,
      testedTests,
      passedTests,
      overallPassRate,
      pendingDecisions,
      openQuestionCount,
    },

    // Build-specific
    buildStatus,
    workflow,

    // Cross-reference (pre-computed for templates)
    crossRef: computeCrossRef(capabilities, integrations, topics),
  };
}

// ── Eval set transformer (matches briefTransforms.ts) ───────────

function transformEvalSets(raw) {
  if (raw.evalSets?.length) {
    return raw.evalSets.map(s => ({
      name: EVAL_SET_NAME_MIGRATION[s.name] || s.name || "custom",
      description: s.description || "",
      methods: (s.methods || []).map(m => ({
        type: m.type, score: m.score ?? null, mode: m.mode || null,
      })),
      passThreshold: s.passThreshold || 70,
      runWhen: s.runWhen || "custom",
      tests: (s.tests || []).map(t => ({
        question: t.question || "", expected: t.expected || "",
        capability: t.capability || null,
        lastResult: t.lastResult || null,
      })),
    }));
  }

  // Legacy migration
  const sets = [
    { name: "boundaries", description: "Boundary tests", methods: [], passThreshold: 100, runWhen: "every-iteration", tests: [] },
    { name: "quality", description: "Quality tests", methods: [], passThreshold: 85, runWhen: "per-capability", tests: [] },
    { name: "edge-cases", description: "Edge case tests", methods: [], passThreshold: 80, runWhen: "final", tests: [] },
  ];
  for (const e of raw.evals || []) {
    const test = { question: e.question || "", expected: e.expected || "", capability: e.capability || null, lastResult: null };
    const cat = e.category || "happy-path";
    if (cat === "boundary-decline" || cat === "boundary-refuse") sets[0].tests.push(test);
    else if (cat === "multi-turn" || cat === "edge-case" || cat === "error-recovery") sets[2].tests.push(test);
    else sets[1].tests.push(test);
  }
  return sets;
}

// ── Readiness heuristic ─────────────────────────────────────────

function computeReadiness(raw, capabilities, integrations, knowledgeSources, evalSets, decisions, openQuestions) {
  let score = 0, total = 0;

  // Has agent name and description
  total += 2;
  if (raw.agent?.name) score++;
  if (raw.agent?.description) score++;

  // Has problem statement
  total++;
  if (raw.business?.problemStatement || raw.business?.useCase) score++;

  // Has capabilities
  total++;
  if (capabilities.length > 0) score++;

  // Has instructions
  total++;
  if (raw.instructions && raw.instructions.length > 50) score++;

  // Has integrations
  total++;
  if (integrations.length > 0) score++;

  // Has knowledge sources
  total++;
  if (knowledgeSources.length > 0) score++;

  // Has eval tests
  total++;
  if (evalSets.some(s => s.tests.length > 0)) score++;

  // Has architecture
  total++;
  if (raw.architecture?.type || raw.architecture?.solutionType) score++;

  // Decisions resolved
  total++;
  const allDecisions = decisions.length;
  const resolved = decisions.filter(d => d.status !== "pending").length;
  if (allDecisions === 0 || resolved >= allDecisions * 0.8) score++;

  // Open questions resolved
  total++;
  const allOq = openQuestions.length;
  const resolvedOq = openQuestions.filter(q => q.status === "resolved").length;
  if (allOq === 0 || resolvedOq >= allOq * 0.8) score++;

  return total > 0 ? Math.round((score / total) * 100) : 0;
}

// ── Cross-reference computation ─────────────────────────────────

function computeCrossRef(capabilities, integrations, topics) {
  const linkedCaps = new Set();
  const linkedIntegrations = new Set();
  for (const t of topics) {
    for (const cap of (t.implements || [])) linkedCaps.add(cap);
    for (const ci of (t.connectedIntegrations || [])) linkedIntegrations.add(ci);
  }
  const orphanCaps = capabilities.filter(c => !linkedCaps.has(c.name)).map(c => c.name);
  const orphanIntegrations = integrations.filter(i => !linkedIntegrations.has(i.name)).map(i => i.name);
  return {
    linkedCapCount: linkedCaps.size,
    linkedIntegrationCount: linkedIntegrations.size,
    orphanCaps,
    orphanIntegrations,
  };
}

// ── Helpers ─────────────────────────────────────────────────────

const FACTOR_LABELS = {
  domainSeparation: "Domain Separation",
  dataIsolation: "Data Isolation",
  teamOwnership: "Team Ownership",
  reusability: "Reusability",
  instructionSize: "Instruction Size",
  knowledgeIsolation: "Knowledge Isolation",
};

const FACTOR_NAMES = ["domainSeparation", "dataIsolation", "teamOwnership", "reusability", "instructionSize", "knowledgeIsolation"];

function factorsToScoring(factors, totalScore) {
  if (!factors) return [];
  return FACTOR_NAMES.map(key => {
    const f = factors[key];
    if (typeof f === "object" && f !== null && "value" in f) {
      return { factor: FACTOR_LABELS[key] || key, score: f.value ? 1 : 0, notes: f.reasoning || (f.value ? "Applies" : "") };
    }
    return { factor: FACTOR_LABELS[key] || key, score: f ? 1 : 0, notes: f ? "Applies" : "" };
  });
}

function normalizeArchType(type) {
  const t = type.toLowerCase().trim();
  if (t === "single agent" || t === "single-agent" || t === "single") return "single-agent";
  if (t === "multi-agent" || t === "multi agent" || t === "multi") return "multi-agent";
  if (t === "connected agent" || t === "connected-agent" || t === "connected" || t === "single-agent-with-connected-agents") return "connected-agent";
  return t;
}

module.exports = { loadAndTransform, transformBrief };
