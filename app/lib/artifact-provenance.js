/**
 * artifact-provenance.js — immutable provenance captured at every eval verdict.
 *
 * Per GPT review 2026-04-17: "Promotion decisions MUST be tied to immutable
 * artifact provenance including build SHA, prompt/config version, model
 * version, tool configuration, and relevant dataset/index versions."
 *
 * This closes the spec-swap attack vector: even if someone edits the spec
 * AFTER an eval verdict is recorded, the stored provenance reveals the
 * mismatch (specHash changed, modelId changed, toolSetHash changed).
 *
 * Usage:
 *   const { captureProvenance } = require("./artifact-provenance");
 *   const prov = captureProvenance(brief, agentDir);
 *   // prov = { buildSha, specHash, modelId, toolSetHash, evalSetHash, ... }
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");
const { specHash } = require("./eval-gate-audit");

function sha256(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function tryGitSha() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8", timeout: 3000, stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

function tryGitDirty() {
  try {
    const status = execSync("git status --porcelain", { encoding: "utf8", timeout: 3000, stdio: ["pipe", "pipe", "pipe"] }).trim();
    return status.length > 0;
  } catch {
    return null;
  }
}

/**
 * Hash the integrations + knowledge + tools surface. Captures "what tools
 * did the agent have at eval time." Sorts by name so two builds with the
 * same logical tool set produce identical hashes regardless of array order.
 */
function toolSetHash(brief) {
  const integrations = (brief?.integrations || [])
    .filter((i) => i && i.name)
    .map((i) => ({ name: i.name, type: i.type, purpose: i.purpose, authMethod: i.authMethod, phase: i.phase }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const knowledge = (brief?.knowledge || [])
    .filter((k) => k && k.name)
    .map((k) => ({ name: k.name, type: k.type, purpose: k.purpose, scope: k.scope, phase: k.phase }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return sha256(JSON.stringify({ integrations, knowledge }));
}

/**
 * Hash the eval test DEFINITIONS (question, expected, methods, capability,
 * scenarioId) but NOT results. Captures what was being tested, not what was
 * measured.
 */
function evalSetHash(brief) {
  const sets = (brief?.evalSets || []).map((s) => ({
    name: s.name,
    passThreshold: s.passThreshold,
    methods: s.methods,
    tests: (s.tests || []).map((t) => ({
      question: t.question,
      expected: t.expected,
      keywords: t.keywords,
      capability: t.capability,
      scenarioId: t.scenarioId,
      methods: t.methods,
    })),
  }));
  return sha256(JSON.stringify(sets));
}

function modelIdentifier(brief) {
  // Capture whatever the spec declares as "the model" — different spec
  // versions use different field names.
  return {
    agentModel: brief?.agent?.model || null,
    recommendedModel: brief?.agent?.recommendedModel || null,
    modelName: brief?.model?.name || null,
  };
}

/**
 * Capture all provenance at a single point in time. Returns a structured
 * object caller stores alongside the verdict/override.
 */
function captureProvenance(brief, agentDir) {
  return {
    capturedAt: new Date().toISOString(),
    buildSha: tryGitSha(),
    buildDirty: tryGitDirty(),
    specHash: specHash(brief),
    model: modelIdentifier(brief),
    toolSetHash: toolSetHash(brief),
    evalSetHash: evalSetHash(brief),
    agentDir: agentDir ? path.basename(agentDir) : null,
  };
}

/**
 * Compare two provenance records and return the set of differing fields.
 * Useful for post-hoc forensics: "the eval ran against THIS provenance,
 * but the promotion step saw a different one."
 */
function diffProvenance(a, b) {
  const diffs = [];
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) {
    if (k === "capturedAt") continue; // timestamps always differ
    const av = a?.[k], bv = b?.[k];
    if (JSON.stringify(av) !== JSON.stringify(bv)) {
      diffs.push({ field: k, before: av, after: bv });
    }
  }
  return diffs;
}

module.exports = {
  captureProvenance,
  diffProvenance,
  _internal: { toolSetHash, evalSetHash, modelIdentifier, tryGitSha, tryGitDirty },
};
