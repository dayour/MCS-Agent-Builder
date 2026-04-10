/**
 * knowledge-resolver.js — Fast lookup service for MCS component resolution.
 *
 * Loaded at server startup, reads knowledge/index.json into memory.
 * Provides deterministic resolution functions that the wizard and
 * enrichment system call to match user descriptions to MCS components.
 *
 * Graceful degradation: if index.json is missing or corrupt, all functions
 * return empty results with { confidence: 0, fallback: true }.
 */

const fs = require("fs");
const path = require("path");

const INDEX_PATH = path.join(__dirname, "..", "..", "knowledge", "index.json");

let _index = null;
let _healthy = false;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/** Load the knowledge index into memory. Call at server startup. */
function load() {
  try {
    if (!fs.existsSync(INDEX_PATH)) {
      console.warn("[knowledge-resolver] index.json not found — run: node tools/build-knowledge-index.js");
      _index = null;
      _healthy = false;
      return false;
    }
    const raw = fs.readFileSync(INDEX_PATH, "utf-8");
    _index = JSON.parse(raw);
    if (!_index._meta || !_index.components) {
      console.warn("[knowledge-resolver] index.json has invalid schema");
      _index = null;
      _healthy = false;
      return false;
    }
    _healthy = true;
    console.log(`[knowledge-resolver] Loaded index: ${JSON.stringify(_index._meta.stats)}`);
    return true;
  } catch (err) {
    console.error("[knowledge-resolver] Failed to load index:", err.message);
    _index = null;
    _healthy = false;
    return false;
  }
}

/** Check if the resolver is ready. */
function isHealthy() {
  return _healthy && _index !== null;
}

/** Get the index metadata. */
function getMeta() {
  return _index ? _index._meta : null;
}

// ---------------------------------------------------------------------------
// Text Matching Helpers
// ---------------------------------------------------------------------------

/** Simple keyword relevance score (0-1) between a query and a target string. */
function keywordScore(query, target) {
  if (!query || !target) return 0;
  const qWords = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const tLower = target.toLowerCase();
  if (qWords.length === 0) return 0;
  let hits = 0;
  for (const w of qWords) {
    // Exact match or stem match (e.g., "creation" matches "create")
    if (tLower.includes(w)) { hits++; continue; }
    // Simple stemming: check if first 4+ chars match any word in target
    if (w.length >= 4) {
      const stem = w.substring(0, Math.min(w.length - 1, 6));
      const tWords = tLower.split(/\W+/);
      if (tWords.some((tw) => tw.startsWith(stem) || stem.startsWith(tw.substring(0, Math.min(tw.length - 1, 6))))) {
        hits += 0.7;
      }
    }
  }
  return hits / qWords.length;
}

/** Check if any keyword from a list appears in text. */
function matchesAnyKeyword(text, keywords) {
  if (!text || !keywords || keywords.length === 0) return false;
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Resolver Functions
// ---------------------------------------------------------------------------

/**
 * Resolve capabilities to suggested implementation types and matching patterns.
 * @param {Array<{name: string, description?: string}>} capabilities
 * @returns {Array<{name: string, suggestedType: string, matchedPattern: object|null, confidence: number}>}
 */
function resolveCapabilities(capabilities) {
  if (!_index || !capabilities) return [];

  return capabilities.map((cap) => {
    const text = `${cap.name} ${cap.description || ""}`.toLowerCase();
    const result = { name: cap.name, suggestedType: "prompt", matchedPattern: null, confidence: 0.5 };

    // Check against solution patterns
    for (const pattern of _index.patterns || []) {
      const matchScore = pattern.matchKeywords.reduce((score, kw) => {
        return score + (text.includes(kw.toLowerCase().substring(0, 20)) ? 1 : 0);
      }, 0);
      if (matchScore > 0 || matchesAnyKeyword(text, pattern.tags)) {
        result.matchedPattern = { id: pattern.id, name: pattern.name, proven: pattern.proven, tierCount: pattern.tierCount };
        result.suggestedType = "flow";
        result.confidence = Math.min(0.9, 0.5 + matchScore * 0.2);
        break;
      }
    }

    // Heuristic implementation type detection
    if (text.match(/\b(answer|explain|describe|faq|policy|knowledge|information)\b/)) {
      result.suggestedType = "knowledge";
      result.confidence = Math.max(result.confidence, 0.6);
    } else if (text.match(/\b(create|update|delete|submit|send|trigger|automate|schedule|batch|notify|alert)\b/)) {
      result.suggestedType = "flow";
      result.confidence = Math.max(result.confidence, 0.6);
    } else if (text.match(/\b(route|triage|classify|hand.?off|escalate|transfer)\b/)) {
      result.suggestedType = "topic";
      result.confidence = Math.max(result.confidence, 0.6);
    } else if (text.match(/\b(search|lookup|query|retrieve|fetch|get)\b/)) {
      result.suggestedType = "tool";
      result.confidence = Math.max(result.confidence, 0.55);
    }

    return result;
  });
}

/**
 * Resolve integrations to matching connectors/MCP servers.
 * @param {Array<{name: string, type?: string, purpose?: string}>} integrations
 * @returns {Array<{name: string, resolved: Array<{name: string, type: string, tier: string, status: string, confidence: number}>, suggestedType: string}>}
 */
function resolveIntegrations(integrations) {
  if (!_index || !integrations) return [];

  // Work IQ: Adding from overview page gives 2 servers that cover everything:
  // - Work IQ Copilot (mcp_M365Copilot): all M365 data (mail, calendar, teams, sharepoint, files, etc.)
  // - Work IQ User (mcp_MeServer): people, org chart, manager, direct reports
  // All M365 keywords resolve to these 2 servers. Individual servers (Mail, Calendar, etc.)
  // are only needed for edge cases where Copilot doesn't cover a specific write operation.
  const WORKIQ_MAP = {
    mail: { server: "Work IQ Copilot", operationId: "mcp_M365Copilot" },
    email: { server: "Work IQ Copilot", operationId: "mcp_M365Copilot" },
    outlook: { server: "Work IQ Copilot", operationId: "mcp_M365Copilot" },
    calendar: { server: "Work IQ Copilot", operationId: "mcp_M365Copilot" },
    meeting: { server: "Work IQ Copilot", operationId: "mcp_M365Copilot" },
    schedule: { server: "Work IQ Copilot", operationId: "mcp_M365Copilot" },
    teams: { server: "Work IQ Copilot", operationId: "mcp_M365Copilot" },
    chat: { server: "Work IQ Copilot", operationId: "mcp_M365Copilot" },
    channel: { server: "Work IQ Copilot", operationId: "mcp_M365Copilot" },
    sharepoint: { server: "Work IQ Copilot", operationId: "mcp_M365Copilot" },
    onedrive: { server: "Work IQ Copilot", operationId: "mcp_M365Copilot" },
    files: { server: "Work IQ Copilot", operationId: "mcp_M365Copilot" },
    documents: { server: "Work IQ Copilot", operationId: "mcp_M365Copilot" },
    word: { server: "Work IQ Copilot", operationId: "mcp_M365Copilot" },
    "m365 search": { server: "Work IQ Copilot", operationId: "mcp_M365Copilot" },
    copilot: { server: "Work IQ Copilot", operationId: "mcp_M365Copilot" },
    user: { server: "Work IQ User", operationId: "mcp_MeServer" },
    profile: { server: "Work IQ User", operationId: "mcp_MeServer" },
    manager: { server: "Work IQ User", operationId: "mcp_MeServer" },
    "direct reports": { server: "Work IQ User", operationId: "mcp_MeServer" },
    "org chart": { server: "Work IQ User", operationId: "mcp_MeServer" },
  };

  return integrations.map((integration) => {
    const text = `${integration.name} ${integration.purpose || ""}`.toLowerCase();
    const matches = [];

    // Check Work IQ match (Priority 1a — preferred for all M365 data)
    // Evaluate all keywords and pick the one with most hits (handles multi-service queries)
    const intName = integration.name.toLowerCase().replace(/\s+/g, "");
    let workiqMatch = null;
    const workiqHits = {};
    for (const [keyword, wiq] of Object.entries(WORKIQ_MAP)) {
      if (text.includes(keyword)) {
        const key = wiq.server;
        workiqHits[key] = (workiqHits[key] || { ...wiq, count: 0 });
        workiqHits[key].count++;
      }
    }
    // Pick the Work IQ server with the most keyword matches
    let bestCount = 0;
    for (const [, hit] of Object.entries(workiqHits)) {
      if (hit.count > bestCount) {
        bestCount = hit.count;
        workiqMatch = hit;
      }
    }

    // Search MCP servers (preferred)
    for (const mcp of _index.components.mcpServers || []) {
      const mcpNameLower = mcp.name.toLowerCase().replace(/\s+/g, "");
      // Exact name match gets high score
      const exactBonus = mcpNameLower.includes(intName) || intName.includes(mcpNameLower.replace(/mcpserver/g, "")) ? 0.5 : 0;
      const score = keywordScore(text, `${mcp.name} ${mcp.description}`) + exactBonus;

      // Boost the recommended Work IQ server (Copilot or User) above individual servers
      const isWorkIQ = mcp.name.toLowerCase().startsWith("work iq");
      const workiqBoost = (isWorkIQ && workiqMatch && mcp.name === workiqMatch.server) ? 0.6 : 0;

      if (score + workiqBoost > 0.4) {
        matches.push({
          name: mcp.name,
          type: "mcp",
          tier: isWorkIQ ? "1a" : "1b",
          status: mcp.status,
          confidence: Math.min(score + workiqBoost + 0.1, 1),
          description: mcp.description,
          workiqPreferred: isWorkIQ && workiqMatch !== null,
          operationId: workiqMatch && mcp.name === workiqMatch.server ? workiqMatch.operationId : undefined,
        });
      }
    }

    // Search connectors (deprioritized when Work IQ match exists)
    for (const conn of _index.components.connectors || []) {
      const connNameLower = conn.name.toLowerCase().replace(/\s+/g, "");
      const exactBonus = connNameLower.includes(intName) || intName.includes(connNameLower) ? 0.5 : 0;
      const score = keywordScore(text, `${conn.name} ${conn.keyActions} ${conn.notes}`) + exactBonus;
      if (score > 0.4) {
        const priorityTier = conn.mcpAlternative ? "2" : conn.tier === "premium" ? "5" : "4";
        matches.push({
          name: conn.name,
          type: "connector",
          tier: priorityTier,
          status: "GA",
          confidence: Math.min(score + 0.1, 1),
          mcpPreferred: conn.mcpAlternative,
          mcpNote: conn.mcpNote,
          // Flag that Work IQ is the better choice for M365 data
          workiqAlternative: workiqMatch ? workiqMatch.server : undefined,
        });
      }
    }

    // Sort: Work IQ first, then other MCP, then connectors, then confidence
    matches.sort((a, b) => {
      // Work IQ preferred matches always first
      if (a.workiqPreferred && !b.workiqPreferred) return -1;
      if (b.workiqPreferred && !a.workiqPreferred) return 1;
      // Exact name match
      const aExact = a.name.toLowerCase().replace(/\s+/g, "").includes(intName) ? 1 : 0;
      const bExact = b.name.toLowerCase().replace(/\s+/g, "").includes(intName) ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      // MCP over connectors
      if (a.type === "mcp" && b.type !== "mcp") return -1;
      if (b.type === "mcp" && a.type !== "mcp") return 1;
      return b.confidence - a.confidence;
    });

    // Determine suggested type
    let suggestedType = integration.type || "connector";
    if (matches.length > 0 && matches[0].type === "mcp") suggestedType = "mcp";

    return {
      name: integration.name,
      resolved: matches.slice(0, 3),
      suggestedType,
      workiqRecommended: workiqMatch ? workiqMatch.server : undefined,
    };
  });
}

/**
 * Resolve knowledge source descriptions to available types.
 * @param {Array<{name: string, type?: string, purpose?: string}>} sources
 * @returns {Array<{name: string, suggestedType: string, limits: string, confidence: number}>}
 */
function resolveKnowledge(sources) {
  if (!_index || !sources) return [];

  return sources.map((source) => {
    const text = `${source.name} ${source.type || ""} ${source.purpose || ""}`.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    for (const ks of _index.components.knowledgeSources || []) {
      const score = keywordScore(text, `${ks.type} ${ks.description}`);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = ks;
      }
    }

    // Heuristic fallback
    let suggestedType = source.type || "Uploaded files";
    if (text.includes("sharepoint")) suggestedType = "SharePoint";
    else if (text.includes("dataverse") || text.includes("database")) suggestedType = "Dataverse";
    else if (text.includes("website") || text.includes("url") || text.includes("web")) suggestedType = "Public websites";
    else if (text.includes("file") || text.includes("document") || text.includes("pdf")) suggestedType = "Uploaded files";
    else if (text.includes("graph") || text.includes("enterprise")) suggestedType = "Enterprise data (Copilot connectors)";
    else if (text.includes("servicenow") || text.includes("salesforce") || text.includes("confluence") || text.includes("zendesk")) suggestedType = "Unstructured data";

    return {
      name: source.name,
      suggestedType,
      limits: bestMatch ? bestMatch.limits : "",
      confidence: Math.max(bestScore, 0.4),
    };
  });
}

/**
 * Score solution type (agent vs flow vs hybrid vs not-recommended).
 * @param {{conversationalNeed: number, interactionPattern: number, capabilityDistribution: number, userValueOfNL: number, mcsFeasibility: number}} factors - Each 0 or 1
 * @returns {{score: number, solutionType: string, reason: string}}
 */
function scoreSolutionType(factors) {
  if (!_index) return { score: 0, solutionType: "agent", reason: "Index unavailable — defaulting to agent", fallback: true };

  const score = (factors.conversationalNeed || 0) +
    (factors.interactionPattern || 0) +
    (factors.capabilityDistribution || 0) +
    (factors.userValueOfNL || 0) +
    (factors.mcsFeasibility || 0);

  let solutionType, reason;
  if (score >= 4) {
    solutionType = "agent";
    reason = `Score ${score}/5 — strong agent fit. Users need conversation, AI judgment, and natural language value.`;
  } else if (score === 3) {
    solutionType = "hybrid";
    reason = `Score ${score}/5 — borderline. Consider agent + Power Automate flow combination.`;
  } else if (score >= 1) {
    solutionType = "flow";
    reason = `Score ${score}/5 — better as Power Automate flow. Deterministic pipeline, limited conversation need.`;
  } else {
    solutionType = "not-recommended";
    reason = `Score ${score}/5 — this use case doesn't benefit from an agent or flow in MCS.`;
  }

  return { score, solutionType, reason };
}

/**
 * Score architecture (single vs multi-agent).
 * @param {{domain: boolean, dataSources: boolean, teamOwnership: boolean, reusability: boolean, instructionSize: boolean, knowledgeIsolation: boolean}} factors
 * @returns {{score: number, type: string, reason: string}}
 */
function scoreArchitecture(factors) {
  if (!_index) return { score: 0, type: "single-agent", reason: "Index unavailable — defaulting to single", fallback: true };

  const score = [factors.domain, factors.dataSources, factors.teamOwnership, factors.reusability, factors.instructionSize, factors.knowledgeIsolation]
    .filter(Boolean).length;

  const type = score >= 3 ? "multi-agent" : "single-agent";
  const reason = score >= 3
    ? `Score ${score}/6 — multi-agent recommended. Separate domains, data, or teams justify decomposition.`
    : `Score ${score}/6 — single agent sufficient. Shared domain and data, no decomposition needed.`;

  return { score, type, reason };
}

/**
 * Match capabilities against first-party agents.
 * @param {Array<{name: string, description?: string}>} capabilities
 * @returns {Array<{agentName: string, tier: number, status: string, license: string, matchedCapabilities: string[], confidence: number, whenToBuildCA: string}>}
 */
function matchFirstPartyAgents(capabilities) {
  if (!_index || !capabilities) return [];

  const matches = [];
  for (const agent of _index.firstPartyAgents || []) {
    const matchedCaps = [];
    for (const cap of capabilities) {
      const text = `${cap.name} ${cap.description || ""}`.toLowerCase();
      for (const pattern of agent.matchPatterns) {
        // Require higher threshold (0.5) to avoid over-matching
        if (keywordScore(text, pattern) > 0.5) {
          matchedCaps.push(cap.name);
          break;
        }
      }
    }
    if (matchedCaps.length > 0) {
      matches.push({
        agentName: agent.name,
        tier: agent.tier,
        status: agent.status,
        license: agent.license,
        matchedCapabilities: matchedCaps,
        confidence: Math.min(matchedCaps.length / capabilities.length, 1),
        whenToBuildCA: agent.whenToBuildCA,
      });
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Suggest build path: custom-agent vs flow vs hybrid vs first-party-only.
 *
 * Routing is driven by solution type scoring (5 factors). DA (Declarative Agent)
 * is not a build target — CA has all DA capabilities plus more.
 *
 * @param {object} draft - Wizard draft with capabilities, integrations, architecture, etc.
 * @returns {{buildPath: string, solutionType: string, score: number, reason: string, confidence: number, fpMatches?: Array}}
 */
function suggestBuildPath(draft) {
  if (!_index) return { buildPath: "custom-agent", solutionType: "agent", score: 0, reason: "Index unavailable — defaulting to custom agent", confidence: 0, fallback: true };

  const draftCaps = draft.capabilities || [];

  // Step 1: Compute solution type factors from capability analysis
  const factors = computeSolutionTypeFactors(draftCaps, draft);
  const { score, solutionType, reason: stReason } = scoreSolutionType(factors);

  // Step 2: Check first-party agent coverage (informational + routing gate)
  // Only Tier 1-2 agents count for "first-party-only" routing — Tier 3 agents
  // (coaches, general-purpose) are too broad and match nearly everything.
  const fpMatches = matchFirstPartyAgents(draftCaps);
  const fpSpecific = fpMatches.filter((m) => m.tier <= 2);
  const coveredCaps = new Set();
  for (const m of fpSpecific) { for (const c of m.matchedCapabilities) coveredCaps.add(c); }
  const coverageRatio = draftCaps.length > 0 ? coveredCaps.size / draftCaps.length : 0;

  // First-party-only when ALL capabilities are covered by Tier 1-2 agents.
  // If 3+ agents claim full coverage, matching is too loose — skip this gate.
  const fullCoverageAgents = fpSpecific.filter((m) => m.confidence >= 1.0);
  if (coverageRatio >= 1.0 && fpSpecific.length > 0 && fullCoverageAgents.length <= 2 && solutionType === "agent") {
    return {
      buildPath: "first-party-only",
      solutionType,
      score,
      reason: `All ${draftCaps.length} capabilities matched by first-party agents (${fpSpecific.map((m) => m.agentName).join(", ")}). Recommend using existing agents instead of building.`,
      confidence: 0.85,
      fpMatches,
      factors,
    };
  }

  // Step 3: Route based on solution type score
  if (score >= 4) {
    return {
      buildPath: "custom-agent",
      solutionType,
      score,
      reason: stReason,
      confidence: 0.8,
      fpMatches: fpMatches.length > 0 ? fpMatches : undefined,
      factors,
    };
  }

  if (score === 3) {
    return {
      buildPath: "hybrid",
      solutionType,
      score,
      reason: `${stReason} Build a CA for conversational capabilities and Power Automate flow(s) for automation.`,
      confidence: 0.6,
      fpMatches: fpMatches.length > 0 ? fpMatches : undefined,
      factors,
    };
  }

  if (score >= 1) {
    return {
      buildPath: "flow",
      solutionType,
      score,
      reason: stReason,
      confidence: 0.75,
      factors,
    };
  }

  return {
    buildPath: "not-recommended",
    solutionType,
    score,
    reason: stReason,
    confidence: 0.7,
    factors,
  };
}

/**
 * Compute solution type factors from capabilities and draft context.
 * Returns the 5 factor scores (0 or 1 each) for scoreSolutionType.
 */
function computeSolutionTypeFactors(capabilities, draft) {
  const caps = capabilities || [];
  if (caps.length === 0) return { conversationalNeed: 0, interactionPattern: 0, capabilityDistribution: 0, userValueOfNL: 0, mcsFeasibility: 1 };

  // Factor 1: Conversational Need — are capabilities conversational in nature?
  // Ties favor conversational (if half the capabilities need conversation, removing chat loses value)
  const conversationalKeywords = /\b(answer|ask|explain|chat|convers|discuss|advise|recommend|guide|help|assist|clarify|interpret|summarize|analyze)\b/i;
  const automationKeywords = /\b(create|update|delete|send|trigger|schedule|batch|notify|alert|sync|move|copy|transform|extract|load|import|export|migrate|process)\b/i;
  const capTexts = caps.map((c) => `${c.name} ${c.description || ""}`);
  const conversationalCount = capTexts.filter((t) => conversationalKeywords.test(t)).length;
  const automationCount = capTexts.filter((t) => automationKeywords.test(t)).length;
  const conversationalNeed = conversationalCount >= automationCount && conversationalCount > 0 ? 1 : 0;

  // Factor 2: Interaction Pattern — do capabilities need AI judgment?
  // Only true AI reasoning keywords — not conversational keywords like "answer" or "explain"
  const aiJudgmentKeywords = /\b(classify|triage|interpret|reason|decide|assess|evaluate|diagnose|prioritize|sentiment|intent|context|recommend|advise|analyze)\b/i;
  const deterministicKeywords = /\b(pipeline|workflow|sequence|step|rule|condition|filter|map|reduce|loop|iterate|cron|recurrence|monitor|extract|sync|create|update|send|notify)\b/i;
  const aiCount = capTexts.filter((t) => aiJudgmentKeywords.test(t)).length;
  const detCount = capTexts.filter((t) => deterministicKeywords.test(t)).length;
  const interactionPattern = (aiCount / caps.length) >= 0.4 ? 1 : (detCount > aiCount ? 0 : (aiCount > 0 ? 1 : 0));

  // Factor 3: Capability Distribution — count conversational vs automation implementation types
  const convTypes = ["prompt", "topic", "knowledge"];
  const autoTypes = ["flow", "tool"];
  let convCount = 0, autoCount = 0;
  for (const c of caps) {
    const t = (c.implementationType || "prompt").toLowerCase();
    if (convTypes.includes(t)) convCount++;
    else if (autoTypes.includes(t)) autoCount++;
  }
  const capabilityDistribution = convCount >= autoCount ? 1 : 0;

  // Factor 4: User Value of NL — broad audience or ambiguous queries?
  // Only scores 1 when audience description explicitly signals NL value
  const audience = (draft.agent?.primaryUsers || draft.identity?.primaryUsers || "").toLowerCase();
  const nlValueSignals = /\b(non.?technical|broad|everyone|all employees|ambiguous|freeform|open.?ended|multi.?domain)\b/i;
  const userValueOfNL = nlValueSignals.test(audience) ? 1 : 0;

  // Factor 5: MCS Feasibility — can MCS handle this?
  const infeasibleKeywords = /\b(sub.?second|real.?time streaming|batch processing|thousands of records|bulk|heavy compute|transaction|multi.?system atomic)\b/i;
  const allCapText = capTexts.join(" ");
  const mcsFeasibility = infeasibleKeywords.test(allCapText) ? 0 : 1;

  return { conversationalNeed, interactionPattern, capabilityDistribution, userValueOfNL, mcsFeasibility };
}

/**
 * Suggest channels based on audience description.
 * @param {string} audience - Description of target audience
 * @returns {Array<{name: string, reason: string}>}
 */
function suggestChannels(audience) {
  if (!_index || !audience) return [{ name: "Microsoft Teams + M365 Copilot", reason: "Default for internal users" }];

  const text = audience.toLowerCase();
  const suggestions = [];

  if (text.includes("internal") || text.includes("employee") || text.includes("staff")) {
    suggestions.push({ name: "Microsoft Teams + M365 Copilot", reason: "Default for internal employees — zero friction, SSO" });
    if (text.includes("intranet") || text.includes("sharepoint")) {
      suggestions.push({ name: "SharePoint", reason: "Embedded in intranet for contextual access" });
    }
  }
  if (text.includes("external") || text.includes("customer") || text.includes("public")) {
    suggestions.push({ name: "Custom Website (iframe)", reason: "Branded experience for external users, no login required" });
    if (text.includes("whatsapp") || text.includes("messaging")) {
      suggestions.push({ name: "WhatsApp", reason: "Familiar messaging platform for customers" });
    }
  }
  if (text.includes("phone") || text.includes("voice") || text.includes("call")) {
    suggestions.push({ name: "Telephony", reason: "Voice support via Azure Communication Services" });
  }

  if (suggestions.length === 0) {
    suggestions.push({ name: "Microsoft Teams + M365 Copilot", reason: "Default channel for most scenarios" });
  }

  return suggestions;
}

/**
 * Get the condensed cheat sheet for the wizard system prompt.
 * @returns {string}
 */
function getCheatSheet() {
  if (!_index) return "";
  return _index.cheatSheet || "";
}

/**
 * Get eval scenario categories relevant to a set of capabilities.
 * @param {Array<{name: string, description?: string}>} capabilities
 * @returns {Array<{id: string, name: string, scenarioCount: number, applicableWhen: string}>}
 */
function getRelevantEvalScenarios(capabilities) {
  if (!_index || !_index.evalScenarios || !capabilities) return [];

  const categories = _index.evalScenarios.categories || [];
  const relevant = [];

  for (const cat of categories) {
    for (const cap of capabilities) {
      const text = `${cap.name} ${cap.description || ""}`.toLowerCase();
      const applicable = (cat.applicableWhen || "").toLowerCase();
      if (keywordScore(text, applicable) > 0.2) {
        relevant.push(cat);
        break;
      }
    }
  }

  return relevant;
}

/**
 * Full resolution pass — run all resolvers on a wizard draft.
 * Used per-turn during wizard conversation to inject context.
 * @param {object} draft - Wizard draft
 * @returns {object} Resolution results
 */
function resolveDraft(draft) {
  if (!_index) return { healthy: false, fallback: true };

  const result = {
    healthy: true,
    capabilities: resolveCapabilities(draft.capabilities || []),
    integrations: resolveIntegrations(draft.integrations || []),
    knowledge: resolveKnowledge(draft.knowledge || []),
    fpMatches: matchFirstPartyAgents(draft.capabilities || []),
    channelSuggestions: suggestChannels(draft.identity?.primaryUsers || ""),
    buildPath: (draft.capabilities || []).length > 0 ? suggestBuildPath(draft) : null,
    patternWarnings: [],
  };

  // Check for pattern matches that need warnings
  for (const cap of result.capabilities) {
    if (cap.matchedPattern) {
      result.patternWarnings.push({
        capability: cap.name,
        pattern: cap.matchedPattern.id,
        patternName: cap.matchedPattern.name,
        warning: `"${cap.name}" matches solution pattern ${cap.matchedPattern.id} (${cap.matchedPattern.name}). Use the proven pattern: ${cap.matchedPattern.proven}`,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  load,
  isHealthy,
  getMeta,
  resolveCapabilities,
  resolveIntegrations,
  resolveKnowledge,
  scoreSolutionType,
  scoreArchitecture,
  matchFirstPartyAgents,
  suggestBuildPath,
  computeSolutionTypeFactors,
  suggestChannels,
  getCheatSheet,
  getRelevantEvalScenarios,
  resolveDraft,
};
