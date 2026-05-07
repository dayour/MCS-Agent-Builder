/**
 * eval-gate-audit.js — append-only audit log for skipGate overrides.
 *
 * Writes to knowledge/learnings/eval-gate-overrides.jsonl with a hash chain:
 * each entry records the SHA-256 of the previous entry's JSON line, so
 * post-hoc tampering (editing or deleting entries) is detectable by
 * re-running `verifyAuditChain()`.
 *
 * This is NOT RBAC — approvedBy is a free-form string — but it does bind
 * every override to an immutable spec hash + timestamp + prevHash, and
 * requires mandatory fields (approvedBy, reason, ticketRef) before the
 * gate will emit an audit event. See eval-gate-audit.md for threat model.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Real audit log path. Override via EVAL_GATE_AUDIT_LOG env var for tests
// (keeps fixture runs from polluting the committed audit chain).
const LOG_PATH = process.env.EVAL_GATE_AUDIT_LOG
  || path.join(__dirname, "..", "..", "knowledge", "learnings", "eval-gate-overrides.jsonl");
const GENESIS_HASH = "GENESIS";

function sha256(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function ensureDir() {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readLastLine() {
  if (!fs.existsSync(LOG_PATH)) return null;
  const content = fs.readFileSync(LOG_PATH, "utf8").trimEnd();
  if (!content) return null;
  const lines = content.split("\n");
  return lines[lines.length - 1];
}

/**
 * Hash a brief (agentspec.json content) excluding mutable runtime fields
 * so the hash characterizes the agent design at approval time, not the
 * transient buildStatus / evalGate state.
 */
function specHash(brief) {
  const clone = JSON.parse(JSON.stringify(brief || {}));
  // Drop mutable state so the hash is stable across re-runs of the pipeline
  delete clone.buildStatus;
  delete clone.evalGate;
  delete clone.workflow;
  delete clone.updated_at;
  if (clone.evalConfig) {
    delete clone.evalConfig.lastVerdict;
    delete clone.evalConfig.lastVerdictAt;
  }
  // Drop transient eval results but keep the TEST definitions (those are part of the design)
  if (Array.isArray(clone.evalSets)) {
    clone.evalSets = clone.evalSets.map((s) => ({
      ...s,
      tests: (s.tests || []).map(({ lastResult, _actualResponse, _error, ...rest }) => rest),
    }));
  }
  return sha256(JSON.stringify(clone));
}

/**
 * Validate that an evalConfig carries the fields needed to grant a skipGate
 * override. Returns {ok, missing[]} — non-ok means the override is rejected.
 */
function validateOverrideFields(evalConfig) {
  const cfg = evalConfig || {};
  const missing = [];
  if (!cfg.skipGateApprovedBy || String(cfg.skipGateApprovedBy).trim().length < 2) {
    missing.push("skipGateApprovedBy (who approved the override — full name or identity)");
  }
  if (!cfg.skipGateReason || String(cfg.skipGateReason).trim().length < 10) {
    missing.push("skipGateReason (>= 10 chars explaining WHY the eval gate is being bypassed)");
  }
  if (!cfg.skipGateTicketRef || String(cfg.skipGateTicketRef).trim().length < 3) {
    missing.push("skipGateTicketRef (issue/ticket link or ID tying this override to a tracked decision)");
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Append an override event to the audit log with a hash chain.
 * Returns the full entry for inclusion in evalGate.
 */
function appendOverrideEvent({ projectId, agentId, brief, approvedBy, reason, ticketRef }) {
  ensureDir();
  const prev = readLastLine();
  const prevHash = prev ? sha256(prev) : GENESIS_HASH;
  const entry = {
    event: "eval-gate-override",
    timestamp: new Date().toISOString(),
    projectId,
    agentId,
    agentName: brief?.agent?.name || null,
    approvedBy,
    reason,
    ticketRef,
    specHash: specHash(brief),
    prevHash,
  };
  const line = JSON.stringify(entry);
  fs.appendFileSync(LOG_PATH, line + "\n");
  return { ...entry, entryHash: sha256(line) };
}

/**
 * Walk the audit log and confirm every entry's prevHash matches the SHA-256
 * of the previous line. Returns {ok, brokenAt, totalEntries}.
 */
function verifyAuditChain() {
  if (!fs.existsSync(LOG_PATH)) return { ok: true, brokenAt: null, totalEntries: 0 };
  const lines = fs.readFileSync(LOG_PATH, "utf8").trimEnd().split("\n").filter(Boolean);
  let prevHash = GENESIS_HASH;
  for (let i = 0; i < lines.length; i++) {
    let entry;
    try { entry = JSON.parse(lines[i]); }
    catch { return { ok: false, brokenAt: i, reason: "malformed JSON", totalEntries: lines.length }; }
    if (entry.prevHash !== prevHash) {
      return { ok: false, brokenAt: i, reason: `prevHash mismatch (expected ${prevHash}, got ${entry.prevHash})`, totalEntries: lines.length };
    }
    prevHash = sha256(lines[i]);
  }
  return { ok: true, brokenAt: null, totalEntries: lines.length };
}

module.exports = {
  specHash,
  validateOverrideFields,
  appendOverrideEvent,
  verifyAuditChain,
  LOG_PATH,
  _internal: { sha256, readLastLine },
};
