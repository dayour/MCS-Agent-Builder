/**
 * Scoring generator — architecture + solution-type + build-path scoring.
 *
 * Pure wrapper around knowledge-resolver. Used by enrichment.js enrichScoring()
 * and by the /mcs-research Phase C scoring step. No LLM involved — deterministic
 * cache-backed reasoning only.
 */

const { VALID_SOURCES } = require("../provenance");
const knowledgeResolver = require("../knowledge-resolver");

/**
 * Compute enriched capabilities + architecture decisions for a brief.
 *
 * @returns {Object}
 *   capabilities      — array of capabilities with implementationType / _patternMatch filled in
 *   architecture      — { buildPath, buildPathReason, solutionType, solutionTypeScore,
 *                          solutionTypeFactors, type?, archScore?, archReason?, frontierAgentMatch }
 *   enrichmentMeta    — diagnostics for the _enrichment.scoring block
 *   provenance        — provenance record for the caller to attach
 */
async function generateScoring({ brief, setBy, sourceFiles, reason }) {
  if (!brief || typeof brief !== "object") {
    throw new Error("generateScoring: brief must be an object");
  }
  if (!VALID_SOURCES.has(setBy)) {
    throw new Error(`generateScoring: unknown setBy "${setBy}"`);
  }

  const caps = Array.isArray(brief.capabilities) ? brief.capabilities : [];
  const integ = Array.isArray(brief.integrations) ? brief.integrations : [];

  const resolvedCaps = knowledgeResolver.resolveCapabilities(caps);
  knowledgeResolver.resolveIntegrations(integ);
  knowledgeResolver.resolveKnowledge(Array.isArray(brief.knowledge) ? brief.knowledge : []);

  const enrichedCaps = caps.map((c, i) => ({
    ...c,
    implementationType: resolvedCaps[i]?.suggestedType || c.implementationType,
    _patternMatch:      resolvedCaps[i]?.matchedPattern?.id || c._patternMatch,
  }));

  const buildPath = knowledgeResolver.suggestBuildPath({
    capabilities:  enrichedCaps,
    integrations:  integ,
    architecture:  brief.architecture,
    agent:         brief.agent,
    identity:      brief.identity,
  });

  let archResult = null;
  if (buildPath.solutionType === "agent" || buildPath.solutionType === "hybrid") {
    archResult = knowledgeResolver.scoreArchitecture({
      domain:              false,
      dataSources:         false,
      teamOwnership:       false,
      reusability:         false,
      instructionSize:     enrichedCaps.length > 12,
      knowledgeIsolation:  false,
    });
  }

  const architecture = {
    buildPath:            buildPath.buildPath,
    buildPathReason:      buildPath.reason,
    solutionType:         buildPath.solutionType,
    solutionTypeScore:    buildPath.score,
    solutionTypeFactors:  buildPath.factors,
    ...(archResult ? { type: archResult.type, archScore: archResult.score, archReason: archResult.reason } : {}),
    frontierAgentMatch: (buildPath.fpMatches || []).map((m) => ({
      agentName:            m.agentName,
      tier:                 m.tier,
      matchedCapabilities:  m.matchedCapabilities,
      confidence:           m.confidence,
    })),
  };

  const enrichmentMeta = {
    completedAt:            new Date().toISOString(),
    resolvedCapabilities:   resolvedCaps.length,
    resolvedIntegrations:   integ.length,
    fpMatches:              (buildPath.fpMatches || []).length,
    buildPath:              buildPath.buildPath,
    solutionTypeScore:      buildPath.score,
    archScore:              archResult?.score ?? null,
  };

  const filesList = Array.isArray(sourceFiles) ? sourceFiles.filter((s) => typeof s === "string") : [];
  const provenance = {
    lastSetBy:   setBy,
    lastSetAt:   new Date().toISOString(),
    sourceFiles: filesList,
  };
  if (typeof reason === "string" && reason) provenance.reason = reason;

  return {
    capabilities:   enrichedCaps,
    architecture,
    enrichmentMeta,
    provenance,
    meta: {
      buildPath:   buildPath.buildPath,
      score:       buildPath.score,
      archScore:   archResult?.score ?? null,
    },
  };
}

module.exports = {
  generateScoring,
};
