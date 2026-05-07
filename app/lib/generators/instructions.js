/**
 * Instructions generator — shared adapter called by every write path.
 *
 * Both enrichment.js enrichInstructions() and the /mcs-research Phase C PE
 * teammate should produce instructions the same way: same prompt, same output
 * shape, same provenance contract. This module is that shared implementation.
 *
 * The adapter is a pure async function with an injected LLM client. It does
 * NOT read or write the brief file — callers own IO and the canWrite gate.
 *
 * Input:
 *   brief        — parsed agentspec.json object (read-only)
 *   setBy        — provenance source constant (SOURCES.ENRICHMENT / RESEARCH / ...)
 *   sourceFiles  — optional list of document filenames that informed the call
 *   reason       — optional human-readable note stored on provenance
 *   callLLM      — async (systemPrompt, userMessage) => string
 *
 * Output:
 *   { text, meta: { charCount }, provenance: { lastSetBy, lastSetAt, sourceFiles, reason? } }
 */

const { VALID_SOURCES } = require("../provenance");

const DEFAULT_SYSTEM_PROMPT = `Write concise Microsoft Copilot Studio agent instructions. Target 2000-3000 characters. The agent's model is highly capable — give it clear direction, not exhaustive scripts.

Output structure (use markdown headings):
# Identity — 2-3 sentences: who you are, who you serve, your tone
# Capabilities — bullet list: what you can do (name + one-line description each)
# Boundaries — three categories: Handle (in scope), Decline (redirect politely), Refuse (hard stops)
# Response Style — 2-3 sentences: tone, format preference, brevity

Rules:
- Second person ("You are...")
- No examples or sample dialogues — the model infers these
- No internal system names or technical jargon
- Boundaries must be explicit and actionable
- Under 3500 characters total`;

/** Coerce a boundary entry (string or { topic }) to a display string. */
function boundaryText(entry) {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object" && typeof entry.topic === "string") return entry.topic;
  return "";
}

/** Build the user message from the brief — pure, deterministic, testable. */
function buildUserMessage(brief) {
  const agentName = brief?.agent?.name || "Agent";
  const description = brief?.agent?.description || "Not specified";
  const persona = brief?.agent?.persona || "professional and helpful";
  const primaryUsers = brief?.agent?.primaryUsers || "Not specified";
  const responseFormat = brief?.agent?.responseFormat || "Not specified";

  const capsRaw = Array.isArray(brief?.capabilities) ? brief.capabilities : [];
  const caps = capsRaw.filter((c) => c && typeof c === "object" && c.phase === "mvp" && typeof c.name === "string");

  const bounds = brief?.boundaries && typeof brief.boundaries === "object" ? brief.boundaries : {};
  const handleArr  = Array.isArray(bounds.handle)  ? bounds.handle  : [];
  const declineArr = Array.isArray(bounds.decline) ? bounds.decline : [];
  const refuseArr  = Array.isArray(bounds.refuse)  ? bounds.refuse  : [];

  const capLines = caps.map((c) => `- ${c.name}: ${c.description || ""}`).join("\n");
  const handle  = handleArr.filter((s) => typeof s === "string").join(", ") || "Not specified";
  const decline = declineArr.map(boundaryText).filter(Boolean).join(", ") || "Not specified";
  const refuse  = refuseArr.map(boundaryText).filter(Boolean).join(", ")   || "Not specified";

  return `Agent: "${agentName}"
Description: ${description}
Persona: ${persona}
Users: ${primaryUsers}

Capabilities:
${capLines}

Boundaries:
- Handle: ${handle}
- Decline: ${decline}
- Refuse: ${refuse}

Response format: ${responseFormat}`;
}

/**
 * Generate instructions text + provenance record for a brief.
 * The caller is responsible for checking canWrite() before calling this, and
 * for merging the result into the brief afterward.
 */
async function generateInstructions({ brief, setBy, sourceFiles, reason, callLLM, systemPrompt }) {
  if (!brief || typeof brief !== "object") {
    throw new Error("generateInstructions: brief must be an object");
  }
  if (!VALID_SOURCES.has(setBy)) {
    throw new Error(`generateInstructions: unknown setBy "${setBy}"`);
  }
  if (typeof callLLM !== "function") {
    throw new Error("generateInstructions: callLLM function is required");
  }

  const sys = systemPrompt || DEFAULT_SYSTEM_PROMPT;
  const userMsg = buildUserMessage(brief);

  const text = await callLLM(sys, userMsg);
  if (typeof text !== "string") {
    throw new Error("generateInstructions: callLLM must return a string");
  }
  if (text.trim().length === 0) {
    throw new Error("generateInstructions: callLLM returned empty output");
  }

  const filesList = Array.isArray(sourceFiles)
    ? sourceFiles.filter((s) => typeof s === "string")
    : [];
  const provenance = {
    lastSetBy: setBy,
    lastSetAt: new Date().toISOString(),
    sourceFiles: filesList,
  };
  if (typeof reason === "string" && reason) provenance.reason = reason;

  return {
    text,
    meta: { charCount: text.length },
    provenance,
  };
}

module.exports = {
  generateInstructions,
  buildUserMessage,       // exported for tests + inspection
  DEFAULT_SYSTEM_PROMPT,
};
