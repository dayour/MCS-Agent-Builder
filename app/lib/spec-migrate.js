/**
 * Agent spec v1 → v2 migration.
 *
 * Port of _migrate_brief() from server.py.
 * Converts step1-4 schema to named-sections schema.
 *
 * Renamed from brief-migrate.js → spec-migrate.js (2026-04-12).
 * The function name stays `migrateSpec` (was `migrateBrief`).
 */

function migrateSpec(spec) {
  if (!spec) return spec;
  if (spec._schema === "2.0" || "agent" in spec) return spec;

  // Deep-copy to avoid mutating the original
  spec = JSON.parse(JSON.stringify(spec));

  const s1 = spec.step1 || {};
  const s2 = spec.step2 || {};
  const s3 = spec.step3 || {};
  const s4 = spec.step4 || {};
  const oldMvp = spec.mvp || {};

  delete spec.step1;
  delete spec.step2;
  delete spec.step3;
  delete spec.step4;
  delete spec.mvp;

  // Section 1: business
  if (!spec.business) {
    spec.business = {
      useCase: "",
      problemStatement: s1.problem || "",
      challenges: [],
      benefits: [],
      successCriteria: [],
      stakeholders: { sponsor: "", owner: "", users: "" },
    };
  }

  // Section 2: agent
  spec.agent = {
    name: s1.agentName || "",
    description: "",
    persona: "",
    responseFormat: "",
    primaryUsers: (s1.users || {}).primary || "",
    secondaryUsers: (s1.users || {}).secondary || "",
  };

  // Section 3: capabilities
  const capsText = s2.capabilities || "";
  const caps = [];
  if (capsText) {
    for (let line of capsText.trim().split("\n")) {
      line = line.trim().replace(/^-\s*/, "").trim();
      if (line) {
        caps.push({ name: line, phase: "mvp", reason: "", dataSources: [] });
      }
    }
  }
  spec.capabilities = caps;

  // Section 4: integrations
  spec.integrations = (s3.systems || []).map((s) => ({
    name: s.name || "",
    type: s.toolType || "connector",
    purpose: s.purpose || "",
    dataProvided: "",
    authMethod: "",
    status: s.status || "available",
    phase: "mvp",
    notes: s.notes || "",
  }));

  // Section 5: knowledge
  spec.knowledge = (s3.knowledge || []).map((k) => ({
    name: k.name || "",
    type: k.type || "SharePoint",
    purpose: "",
    scope: k.scope || "",
    status: k.status || "available",
    phase: "mvp",
  }));

  // Section 6: conversations
  spec.conversations = {
    topics: (s3.topics || []).map((t) => ({
      name: t.name || "",
      schemaName: "",
      description: t.description || "",
      triggerType: t.triggerType || "agent-chooses",
      triggerPhrases: [],
      topicType: "custom",
      phase: "mvp",
      implements: [],
      variables: [],
      connectedIntegrations: [],
      outputFormat: "text",
      yaml: t.yaml || undefined,
    })),
  };

  // Section 7: boundaries
  const handle = s2.handle || "";
  let handleList;
  if (typeof handle === "string") {
    handleList = handle
      .split("\n")
      .map((h) => h.trim())
      .filter(Boolean);
  } else {
    handleList = handle || [];
  }

  const declineText = s2.decline || "";
  let declineList = [];
  if (declineText) {
    const items = typeof declineText === "string" ? declineText.split("\n") : [];
    declineList = items
      .filter((d) => d.trim())
      .map((d) => ({ topic: d.trim(), redirect: "" }));
  }

  const refuseText = s2.refuse || "";
  let refuseList = [];
  if (refuseText) {
    const items = typeof refuseText === "string" ? refuseText.split("\n") : [];
    refuseList = items
      .filter((r) => r.trim())
      .map((r) => ({ topic: r.trim(), reason: "" }));
  }

  spec.boundaries = {
    handle: handleList,
    decline: declineList,
    refuse: refuseList,
  };

  // Section 8: architecture
  spec.architecture = {
    type: s4.architectureRecommendation || "",
    reason: s4.architectureReason || "",
    score: s4.architectureScore || 0,
    model: s4.model || "",
    modelReason: s4.modelReason || "",
    triggers: (s4.triggers || []).map((t) => ({ type: t, description: "" })),
    channels: (s4.channels || []).map((c) => ({ name: c, reason: "" })),
    children: s4.children || [],
  };

  // Section 9: scenarios
  spec.scenarios = (s2.scenarios || []).map((sc, i) => ({
    name: `Scenario ${i + 1}`,
    category: "happy-path",
    userSays: sc.userSays || "",
    agentDoes: sc.agentShould || "",
    capabilities: [],
  }));

  // mvpSummary
  spec.mvpSummary = {
    now: oldMvp.now || [],
    future: oldMvp.later || [],
    blockers: [],
  };

  spec._schema = "2.0";
  return spec;
}

// Backward compat: export both names
module.exports = { migrateSpec, migrateBrief: migrateSpec };
