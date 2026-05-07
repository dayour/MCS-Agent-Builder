/**
 * Research generator — classifies integrations into auto-resolved / needs-research.
 *
 * Deterministic lookup against knowledge-resolver (no LLM). Used by
 * enrichment.js enrichResearch() and by the /mcs-research Phase B component
 * resolution step. Auto-adds Work IQ MCP servers when any M365-flavoured
 * integration is detected.
 */

const { VALID_SOURCES } = require("../provenance");
const knowledgeResolver = require("../knowledge-resolver");

const WORKIQ_KEYWORDS = [
  "mail", "email", "outlook", "calendar", "meeting", "schedule",
  "teams", "chat", "channel", "sharepoint", "onedrive", "files",
  "documents", "word", "m365", "microsoft 365", "office 365",
  "user", "profile", "manager", "direct reports", "org chart", "people",
];

const WORKIQ_COPILOT = Object.freeze({
  name:         "Work IQ Copilot",
  type:         "mcp",
  purpose:      "Cross-M365 search and actions (mail, calendar, teams, sharepoint, files)",
  dataProvided: "All M365 data",
  authMethod:   "OAuth (M365 Copilot license)",
  status:       "needs-setup",
  phase:        "mvp",
  _autoAdded:   true,
});

const WORKIQ_USER = Object.freeze({
  name:         "Work IQ User",
  type:         "mcp",
  purpose:      "People, org chart, manager, direct reports, user location",
  dataProvided: "User profiles and org structure",
  authMethod:   "OAuth (M365 Copilot license)",
  status:       "needs-setup",
  phase:        "mvp",
  _autoAdded:   true,
});

/** True when an integration matches any M365 keyword in name or purpose. */
function isM365Integration(integration) {
  if (!integration || typeof integration !== "object") return false;
  const text = `${integration.name || ""} ${integration.purpose || ""}`.toLowerCase();
  return WORKIQ_KEYWORDS.some((kw) => text.includes(kw));
}

/** Clone helper so returned objects are safe to mutate by callers. */
function clone(o) { return JSON.parse(JSON.stringify(o)); }

/**
 * Classify a brief's integrations into resolved + needs-research, with
 * optional Work IQ auto-additions.
 *
 * @returns {Object}
 *   integrations  — original integrations plus any auto-added Work IQ servers
 *   workIqAdded   — string[] of names appended (for caller telemetry)
 *   needsResearch — integrations[] requiring live lookup (Priority 5-6)
 *   recommendations — recommendation records for unresolved items
 *   meta          — summary counts
 *   provenance    — provenance record for the caller to attach
 */
async function generateResearch({ brief, setBy, sourceFiles, reason }) {
  if (!brief || typeof brief !== "object") {
    throw new Error("generateResearch: brief must be an object");
  }
  if (!VALID_SOURCES.has(setBy)) {
    throw new Error(`generateResearch: unknown setBy "${setBy}"`);
  }

  const integrations = Array.isArray(brief.integrations) ? brief.integrations.slice() : [];

  // Auto-add Work IQ MCP servers when any M365-flavoured integration is present.
  const hasM365 = integrations.some(isM365Integration);
  const workIqAdded = [];
  if (hasM365) {
    const names = integrations.map((i) => (i?.name || "").toLowerCase());
    if (!names.some((n) => n.includes("work iq copilot"))) {
      integrations.push(clone(WORKIQ_COPILOT));
      workIqAdded.push("Work IQ Copilot");
    }
    if (!names.some((n) => n.includes("work iq user"))) {
      integrations.push(clone(WORKIQ_USER));
      workIqAdded.push("Work IQ User");
    }
  }

  // Identify integrations that still need live research after auto-add.
  const needsResearch = integrations.filter((i) => {
    if (i?._autoAdded) return false;
    const resolved = knowledgeResolver.resolveIntegrations([i])[0];
    return !resolved?.resolved || resolved.resolved.length === 0;
  });

  const recommendations = needsResearch.map((i) => ({
    category: "integration",
    text:     `"${i.name}" is not in the MCS built-in catalog. Research connector availability or consider custom MCP server.`,
    source:   "enrichment",
  }));

  const filesList = Array.isArray(sourceFiles) ? sourceFiles.filter((s) => typeof s === "string") : [];
  const provenance = {
    lastSetBy:   setBy,
    lastSetAt:   new Date().toISOString(),
    sourceFiles: filesList,
  };
  if (typeof reason === "string" && reason) provenance.reason = reason;

  return {
    integrations,
    workIqAdded,
    needsResearch,
    recommendations,
    meta: {
      hasM365,
      needsResearchCount: needsResearch.length,
      workIqAddedCount:   workIqAdded.length,
      integrationCount:   integrations.length,
    },
    provenance,
  };
}

module.exports = {
  generateResearch,
  isM365Integration,
  WORKIQ_KEYWORDS,
  WORKIQ_COPILOT,
  WORKIQ_USER,
};
