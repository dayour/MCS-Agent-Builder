/**
 * Provenance contract for agentspec.json
 *
 * Every mutation to a tracked field records who wrote it, when, and optionally
 * what it was derived from. Downstream consumers (enrichment merge, research
 * pipeline, frontend badges) read the same shape.
 *
 * Contract shape — brief._provenance[fieldName]:
 *   {
 *     lastSetBy:    <SOURCE>         // required; see SOURCES
 *     lastSetAt:    <ISO timestamp>  // required
 *     sourceFiles:  <string[]>       // optional; document filenames that informed the write
 *     confidence:   "high"|"medium"|"low"  // optional; inference/research may set
 *     reason:       <string>         // optional; short human-readable justification
 *   }
 *
 * Merge rule: a user-set field is protected from non-user writes unless the
 * caller passes `forceRefresh: true`. Use `canWrite()` before mutating a
 * tracked field; use `setProvenance()` to record the write.
 */

const SCHEMA_VERSION = "2.0";

const SOURCES = Object.freeze({
  USER:        "user",         // direct user edit in spec/build page
  WIZARD:      "wizard",       // wizard chat flow (pre-save)
  CHAT:        "chat",         // unified cockpit chat (post Phase 1 rename — alias of wizard for now)
  INFERENCE:   "inference",    // legacy: kept for back-compat with existing provenance entries
  RESEARCH:    "research",     // /mcs-research analyze pipeline
  ENRICHMENT:  "enrichment",   // enrichment.js workers
  UPLOAD:      "upload",       // derived from uploaded documents (e.g. extracted capabilities)
});

const VALID_SOURCES = new Set(Object.values(SOURCES));
const VALID_CONFIDENCE = new Set(["high", "medium", "low"]);

function assertBrief(brief, fn) {
  if (!brief || typeof brief !== "object") {
    throw new Error(`provenance.${fn}: brief must be an object`);
  }
}

/** Return the provenance record for a field, or null if none. */
function getProvenance(brief, fieldName) {
  return brief?._provenance?.[fieldName] || null;
}

/** True when the field was last written by a direct user edit. */
function isUserEdited(brief, fieldName) {
  return getProvenance(brief, fieldName)?.lastSetBy === SOURCES.USER;
}

/**
 * Check whether a write should proceed given current provenance.
 * User-set fields are protected unless `forceRefresh` is true.
 *
 * @param {Object}  brief
 * @param {string}  fieldName
 * @param {Object}  opts
 * @param {string}  opts.setBy          — one of SOURCES
 * @param {boolean} [opts.forceRefresh] — bypass user-edit protection
 * @returns {boolean}
 */
function canWrite(brief, fieldName, opts) {
  const o = (opts && typeof opts === "object") ? opts : {};
  const setBy = o.setBy;
  if (!VALID_SOURCES.has(setBy)) {
    throw new Error(`provenance.canWrite: unknown source "${setBy}"`);
  }
  if (setBy === SOURCES.USER) return true;           // user writes always win
  if (o.forceRefresh) return true;                   // explicit override
  return !isUserEdited(brief, fieldName);
}

/**
 * Record who just wrote a tracked field. Mutates brief._provenance in place.
 *
 * @param {Object} brief
 * @param {string} fieldName
 * @param {string} setBy         — one of SOURCES
 * @param {Object} [meta]
 * @param {string[]} [meta.sourceFiles]
 * @param {"high"|"medium"|"low"} [meta.confidence]
 * @param {string} [meta.reason]
 * @returns {Object} the new provenance record
 */
function setProvenance(brief, fieldName, setBy, meta = {}) {
  if (!VALID_SOURCES.has(setBy)) {
    throw new Error(`provenance.setProvenance: unknown source "${setBy}"`);
  }
  assertBrief(brief, "setProvenance");
  if (meta.confidence != null && !VALID_CONFIDENCE.has(meta.confidence)) {
    throw new Error(`provenance.setProvenance: confidence must be high|medium|low, got "${meta.confidence}"`);
  }
  brief._provenance = brief._provenance || {};
  const sourceFiles = Array.isArray(meta.sourceFiles)
    ? meta.sourceFiles.filter((s) => typeof s === "string")
    : [];
  const record = {
    lastSetBy:   setBy,
    lastSetAt:   new Date().toISOString(),
    sourceFiles,
  };
  if (meta.confidence) record.confidence = meta.confidence;
  if (typeof meta.reason === "string" && meta.reason) record.reason = meta.reason;
  brief._provenance[fieldName] = record;
  return record;
}

/**
 * Merge a provenance patch into the brief.
 *
 * Each incoming record's own `lastSetBy` drives the canWrite gate: user-edited
 * fields are preserved unless `forceRefresh: true` is passed. Records with
 * invalid shape or unknown source are rejected.
 *
 * @param {Object} brief
 * @param {Object} patchProvenance        — { fieldName: {lastSetBy, lastSetAt, ...} }
 * @param {Object} [opts]
 * @param {boolean} [opts.forceRefresh]   — bypass user-edit protection for all fields
 * @returns {{ applied: string[], rejected: Array<{field:string, reason:string}> }}
 */
function mergeProvenance(brief, patchProvenance, opts = {}) {
  const result = { applied: [], rejected: [] };
  if (patchProvenance == null) return result;
  assertBrief(brief, "mergeProvenance");
  if (typeof patchProvenance !== "object") return result;

  const forceRefresh = !!opts.forceRefresh;
  brief._provenance = brief._provenance || {};

  for (const [field, record] of Object.entries(patchProvenance)) {
    if (!record || typeof record !== "object") {
      result.rejected.push({ field, reason: "record-not-object" });
      continue;
    }
    if (!VALID_SOURCES.has(record.lastSetBy)) {
      result.rejected.push({ field, reason: `unknown-source:${record.lastSetBy}` });
      continue;
    }
    if (!record.lastSetAt || typeof record.lastSetAt !== "string") {
      result.rejected.push({ field, reason: "missing-lastSetAt" });
      continue;
    }
    if (record.confidence != null && !VALID_CONFIDENCE.has(record.confidence)) {
      result.rejected.push({ field, reason: `invalid-confidence:${record.confidence}` });
      continue;
    }
    if (!canWrite(brief, field, { setBy: record.lastSetBy, forceRefresh })) {
      result.rejected.push({ field, reason: "protected-user-edit" });
      continue;
    }
    const sanitized = {
      lastSetBy:   record.lastSetBy,
      lastSetAt:   record.lastSetAt,
      sourceFiles: Array.isArray(record.sourceFiles)
        ? record.sourceFiles.filter((s) => typeof s === "string")
        : [],
    };
    if (record.confidence) sanitized.confidence = record.confidence;
    if (typeof record.reason === "string" && record.reason) sanitized.reason = record.reason;
    brief._provenance[field] = sanitized;
    result.applied.push(field);
  }
  return result;
}

/** Return the list of fields that have a provenance record. */
function fieldsWithProvenance(brief) {
  return Object.keys(brief?._provenance || {});
}

/**
 * Apply a user-originated patch to an existing spec, stamping `user` provenance
 * on every top-level field that actually changed. Used by the /state endpoint
 * (PUT /api/projects/:projectId/agents/:agentId/state) which is the user-edit
 * write path from AgentContext's debounced writeback and from usePublish.
 *
 * Contract:
 *  - `_provenance` on the incoming patch is stripped (never trust the client).
 *  - Internal metadata keys (`updated_at`, `_enrichment`) are stored but do not
 *    trigger user-edit stamps.
 *  - Prototype-pollution keys (`__proto__`, `constructor`, `prototype`) are
 *    rejected at every nesting level.
 *  - For plain-object values at the top level, the patch is DEEP-MERGED into
 *    the existing object so partial patches (e.g. `{agent: {name}}`) don't
 *    drop sibling fields (`description`, `persona`, …). Arrays and primitives
 *    remain full-replace.
 *  - Change detection is canonical JSON.stringify over the final top-level
 *    value; unchanged fields keep their existing provenance.
 *
 * @param {Object} existing   — current stored spec (mutated in place)
 * @param {Object} patch      — incoming body from the client
 * @returns {{ changed: string[], ignored: string[] }}
 */
function applyUserPatch(existing, patch) {
  assertBrief(existing, "applyUserPatch");
  if (patch == null || typeof patch !== "object" || Array.isArray(patch)) {
    return { changed: [], ignored: [] };
  }

  const METADATA_KEYS    = new Set(["_provenance", "updated_at"]);
  const POLLUTION_KEYS   = new Set(["__proto__", "constructor", "prototype"]);
  const changed = [];
  const ignored = [];

  for (const [key, value] of Object.entries(patch)) {
    if (POLLUTION_KEYS.has(key)) {
      ignored.push(key);
      continue;
    }
    if (METADATA_KEYS.has(key)) {
      ignored.push(key);
      continue;
    }

    const before = canonical(existing[key]);

    if (isPlainObject(existing[key]) && isPlainObject(value)) {
      // Partial object patch — deep-merge so unmentioned siblings survive.
      existing[key] = deepMergePlain(existing[key], value);
    } else {
      // Array, primitive, or type mismatch — full replace matches old behavior.
      existing[key] = value;
    }

    const after = canonical(existing[key]);
    if (before !== after) {
      setProvenance(existing, key, SOURCES.USER);
      changed.push(key);
    }
  }

  return { changed, ignored };
}

/** True for plain (non-array, non-null) objects. */
function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Recursive merge that preserves existing keys not mentioned in the patch.
 * Rejects prototype-pollution keys at every level. Arrays and primitives
 * replace wholesale; nested plain objects recurse.
 */
function deepMergePlain(target, patch) {
  const merged = { ...target };
  for (const [k, v] of Object.entries(patch)) {
    if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
    if (isPlainObject(merged[k]) && isPlainObject(v)) {
      merged[k] = deepMergePlain(merged[k], v);
    } else {
      merged[k] = v;
    }
  }
  return merged;
}

/** Stable stringify for change detection — undefined collapses to the literal. */
function canonical(v) {
  if (v === undefined) return "__undefined__";
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

module.exports = {
  SCHEMA_VERSION,
  SOURCES,
  VALID_SOURCES,
  getProvenance,
  isUserEdited,
  canWrite,
  setProvenance,
  mergeProvenance,
  fieldsWithProvenance,
  applyUserPatch,
};
