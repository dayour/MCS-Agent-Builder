/**
 * Dual-Model Comparison Engine
 *
 * Compares two model responses and produces structured divergence metadata.
 * Designed for both wizard (structured state) and freeform (prose) modes.
 * Zero Express/React dependencies — usable from both web app and CLI.
 */

// --- Refusal Detection ---

const REFUSAL_PATTERNS = [
  /\bI cannot\b/i,
  /\bI can't\b/i,
  /\bI'm not able to\b/i,
  /\bI am not able to\b/i,
  /\bI must decline\b/i,
  /\bI'm unable to\b/i,
  /\bI am unable to\b/i,
  /\bas an AI\b.*\b(cannot|can't|unable)\b/i,
  /\bI don't think I should\b/i,
  /\bI shouldn't\b.*\b(help|assist|provide)\b/i,
];

function detectRefusal(text) {
  if (!text || text.length < 20) return true; // Empty/tiny response = effective refusal
  return REFUSAL_PATTERNS.some(p => p.test(text));
}

// --- Wizard State Parsing ---

/**
 * Extract WIZARD_STATE JSON from a model response.
 * @param {string} text - Full model response
 * @returns {object|null} Parsed state or null
 */
function extractWizardState(text) {
  if (!text) return null;
  const delimiter = '---WIZARD_STATE---';
  const idx = text.indexOf(delimiter);
  if (idx < 0) return null;

  const afterDelimiter = text.slice(idx + delimiter.length);
  // Find the JSON block — may have a second delimiter or end of string
  const endIdx = afterDelimiter.indexOf(delimiter);
  const jsonStr = endIdx >= 0 ? afterDelimiter.slice(0, endIdx) : afterDelimiter;

  try {
    return JSON.parse(jsonStr.trim());
  } catch {
    // Try extracting JSON object from the text
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    return null;
  }
}

// --- Structured Wizard State Diff ---

/**
 * Diff two wizard states field-by-field.
 * @returns {Array<{aspect, primaryPosition, secondaryPosition, severity}>}
 */
function diffWizardStates(primary, secondary) {
  const divergences = [];
  if (!primary || !secondary) return divergences;

  const pDraft = primary.draft || {};
  const sDraft = secondary.draft || {};

  // Compare top-level draft sections
  const allSections = new Set([...Object.keys(pDraft), ...Object.keys(sDraft)]);
  for (const section of allSections) {
    const pSection = pDraft[section];
    const sSection = sDraft[section];

    if (!pSection && sSection) {
      divergences.push({ aspect: `draft.${section}`, primaryPosition: 'missing', secondaryPosition: 'present', severity: 'warning' });
      continue;
    }
    if (pSection && !sSection) {
      divergences.push({ aspect: `draft.${section}`, primaryPosition: 'present', secondaryPosition: 'missing', severity: 'info' });
      continue;
    }
    if (!pSection || !sSection) continue;

    // Deep compare section fields
    if (typeof pSection === 'object' && typeof sSection === 'object') {
      diffObjects(`draft.${section}`, pSection, sSection, divergences);
    }
  }

  // Compare sections completion status
  const pSections = primary.sections || {};
  const sSections = secondary.sections || {};
  for (const key of new Set([...Object.keys(pSections), ...Object.keys(sSections)])) {
    if (pSections[key] !== sSections[key]) {
      divergences.push({
        aspect: `sections.${key}`,
        primaryPosition: pSections[key] || 'missing',
        secondaryPosition: sSections[key] || 'missing',
        severity: 'info',
      });
    }
  }

  return divergences;
}

/**
 * Recursively diff two objects, collecting divergences.
 */
function diffObjects(prefix, a, b, divergences, depth = 0) {
  if (depth > 3) return; // Prevent deep recursion
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of allKeys) {
    const aVal = a[key];
    const bVal = b[key];
    const path = `${prefix}.${key}`;

    // Skip metadata/internal fields
    if (key.startsWith('_')) continue;

    if (aVal === undefined && bVal !== undefined) {
      divergences.push({ aspect: path, primaryPosition: 'missing', secondaryPosition: summarize(bVal), severity: 'info' });
    } else if (aVal !== undefined && bVal === undefined) {
      divergences.push({ aspect: path, primaryPosition: summarize(aVal), secondaryPosition: 'missing', severity: 'info' });
    } else if (Array.isArray(aVal) && Array.isArray(bVal)) {
      // Compare arrays by length and content summary
      if (aVal.length !== bVal.length || JSON.stringify(aVal) !== JSON.stringify(bVal)) {
        divergences.push({
          aspect: path,
          primaryPosition: `${aVal.length} items`,
          secondaryPosition: `${bVal.length} items`,
          severity: aVal.length === 0 || bVal.length === 0 ? 'warning' : 'info',
        });
      }
    } else if (typeof aVal === 'object' && aVal !== null && typeof bVal === 'object' && bVal !== null) {
      diffObjects(path, aVal, bVal, divergences, depth + 1);
    } else if (aVal !== bVal) {
      // Primitive value differs
      const severity = isHighValueField(key) ? 'warning' : 'info';
      divergences.push({ aspect: path, primaryPosition: summarize(aVal), secondaryPosition: summarize(bVal), severity });
    }
  }
}

/** Fields where disagreement matters more */
function isHighValueField(key) {
  return ['useCase', 'tone', 'scope', 'channels', 'triggerType', 'name', 'description', 'phase'].includes(key);
}

/** Summarize a value for display */
function summarize(val) {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'string') return val.length > 80 ? val.slice(0, 77) + '...' : val;
  if (Array.isArray(val)) return `[${val.length} items]`;
  if (typeof val === 'object') return `{${Object.keys(val).length} keys}`;
  return String(val);
}

// --- Text Similarity (Jaccard on sentences) ---

/**
 * Compute Jaccard similarity on normalized sentence sets.
 * @returns {number} 0-1 score
 */
function textSimilarity(textA, textB) {
  if (!textA || !textB) return 0;

  const normalize = (t) => {
    // Strip wizard state blocks
    const delimIdx = t.indexOf('---WIZARD_STATE---');
    const prose = delimIdx >= 0 ? t.slice(0, delimIdx) : t;
    // Split into sentences, normalize
    return new Set(
      prose
        .split(/[.!?\n]+/)
        .map(s => s.trim().toLowerCase().replace(/[^a-z0-9\s]/g, ''))
        .filter(s => s.length > 10) // Skip very short fragments
    );
  };

  const setA = normalize(textA);
  const setB = normalize(textB);

  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const s of setA) {
    if (setB.has(s)) intersection++;
  }

  // Also check fuzzy matches (> 60% word overlap between sentences)
  for (const sa of setA) {
    if (setB.has(sa)) continue; // Already counted
    const wordsA = new Set(sa.split(/\s+/));
    for (const sb of setB) {
      if (setA.has(sb)) continue;
      const wordsB = new Set(sb.split(/\s+/));
      let overlap = 0;
      for (const w of wordsA) { if (wordsB.has(w)) overlap++; }
      const unionSize = new Set([...wordsA, ...wordsB]).size;
      if (unionSize > 0 && overlap / unionSize > 0.35) {
        intersection += 0.5; // Partial credit for fuzzy match
        break;
      }
    }
  }

  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

// --- Main Comparison ---

/**
 * Compare two model responses.
 *
 * @param {object} primary - { content: string, model: string, latencyMs?: number }
 * @param {object} secondary - { content: string, model: string, latencyMs?: number }
 * @param {object} [options] - { mode: 'wizard'|'freeform' }
 * @returns {Promise<ComparisonResult>}
 */
async function compare(primary, secondary, options = {}) {
  const startTime = Date.now();
  const mode = options.mode || 'freeform';

  // Safety check
  const primaryRefused = detectRefusal(primary.content);
  const secondaryRefused = detectRefusal(secondary.content);
  let saferResponse = 'neither';
  if (primaryRefused && !secondaryRefused) saferResponse = 'primary';
  if (!primaryRefused && secondaryRefused) saferResponse = 'secondary';

  // If both refused, short-circuit
  if (primaryRefused && secondaryRefused) {
    return buildResult('agree', 1.0, [], { primaryRefused, secondaryRefused, saferResponse }, primary, secondary, startTime, 'heuristic');
  }

  // Wizard mode: structured state comparison
  let structuredDivergences = [];
  let structuredScore = null;
  if (mode === 'wizard') {
    const pState = extractWizardState(primary.content);
    const sState = extractWizardState(secondary.content);
    if (pState && sState) {
      structuredDivergences = diffWizardStates(pState, sState);
      // Score based on divergence count and severity
      // Each warning penalizes 15%, each info penalizes 5%, capped at 100%
      const warnings = structuredDivergences.filter(d => d.severity === 'warning').length;
      const infos = structuredDivergences.filter(d => d.severity === 'info').length;
      const conflicts = structuredDivergences.filter(d => d.severity === 'conflict').length;
      const penalty = Math.min(1, conflicts * 0.3 + warnings * 0.15 + infos * 0.05);
      structuredScore = Math.max(0, 1 - penalty);
    }
  }

  // Text similarity on prose portion
  const textScore = textSimilarity(primary.content, secondary.content);

  // Combined score: wizard mode weights structured comparison higher
  let similarityScore;
  if (structuredScore !== null) {
    similarityScore = structuredScore * 0.7 + textScore * 0.3;
  } else {
    similarityScore = textScore;
  }

  // Classify agreement
  let agreement;
  if (similarityScore > 0.7) agreement = 'agree';
  else if (similarityScore > 0.4) agreement = 'partial';
  else if (primaryRefused !== secondaryRefused) agreement = 'conflict';
  else agreement = 'diverge';

  // Collect all divergences
  const divergences = [...structuredDivergences];

  // Add a high-level text divergence note if scores differ significantly
  if (textScore < 0.4 && divergences.length === 0) {
    divergences.push({
      aspect: 'overall_response',
      primaryPosition: `${primary.model} response (${(primary.content || '').length} chars)`,
      secondaryPosition: `${secondary.model} response (${(secondary.content || '').length} chars)`,
      severity: 'warning',
    });
  }

  return buildResult(agreement, similarityScore, divergences, { primaryRefused, secondaryRefused, saferResponse }, primary, secondary, startTime, 'heuristic');
}

function buildResult(agreement, similarityScore, divergences, safety, primary, secondary, startTime, method) {
  return {
    agreement,
    similarityScore: Math.round(similarityScore * 1000) / 1000,
    divergences,
    safety,
    meta: {
      primaryModel: primary.model,
      secondaryModel: secondary.model,
      primaryLatencyMs: primary.latencyMs || null,
      secondaryLatencyMs: secondary.latencyMs || null,
      comparisonMethod: method,
      comparisonLatencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    },
  };
}

module.exports = { compare, extractWizardState, textSimilarity, detectRefusal, diffWizardStates };
