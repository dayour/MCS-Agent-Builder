/**
 * pending-calls.js — Server-authoritative registry of pending tool-call confirmations.
 *
 * GPT challenge top risk: "the plan gives the LLM too much authority over
 * state-changing workflows without a durable server-side workflow/state
 * machine, persisted tool-call validation, and strict authorization."
 *
 * This module fixes that by requiring privileged tools (start_deep_research,
 * start_mcs_build, cancel_job, plus any inline-card UX confirmations) to
 * carry a server-issued one-time confirmation token. The token is created
 * when a card is rendered, validated when the user responds, and burned on
 * use. Without a valid token in scope, the tool refuses.
 *
 * In-memory only (single-instance app). Periodic GC removes expired
 * entries. Tokens expire after 30 minutes of inactivity by default.
 */

const crypto = require('crypto');

const DEFAULT_TTL_MS = 30 * 60 * 1000;        // 30 min
const GC_INTERVAL_MS = 5 * 60 * 1000;         // 5 min

/** @type {Map<string, {toolName, args, projectId, agentId, sessionId, createdAt, expiresAt, used}>} */
const _registry = new Map();

let _gcTimer = null;

function startGc() {
  if (_gcTimer) return;
  _gcTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of _registry.entries()) {
      if (entry.used || entry.expiresAt < now) _registry.delete(id);
    }
  }, GC_INTERVAL_MS);
  _gcTimer.unref?.();
}

/**
 * Issue a pending tool-call token for a card being rendered to the user.
 *
 * @param {object} args
 * @param {string} args.toolName            - e.g. 'start_deep_research'
 * @param {object} args.args                - args the tool will run with
 * @param {string} [args.projectId]         - bound project (authorization scope)
 * @param {string} [args.agentId]
 * @param {string} [args.sessionId]         - bound session (authorization scope)
 * @param {number} [args.ttlMs]
 * @returns {{toolCallId: string, expiresAt: number}}
 */
function issue({ toolName, args, projectId, agentId, sessionId, ttlMs }) {
  startGc();
  const toolCallId = `tc_${crypto.randomBytes(12).toString('hex')}`;
  const now = Date.now();
  const ttl = Math.max(60_000, ttlMs || DEFAULT_TTL_MS);
  _registry.set(toolCallId, {
    toolName,
    args: args || {},
    projectId: projectId || null,
    agentId: agentId || null,
    sessionId: sessionId || null,
    createdAt: now,
    expiresAt: now + ttl,
    used: false,
  });
  return { toolCallId, expiresAt: now + ttl };
}

/**
 * Validate a user's response to a pending tool call. Returns the entry if
 * valid (and burns the token). Throws otherwise — caller should map to
 * 4xx in the API layer.
 *
 * @param {object} args
 * @param {string} args.toolCallId
 * @param {string} [args.expectedToolName]  - if set, must match registered tool
 * @param {string} [args.projectId]         - if set, must match registered scope
 * @param {string} [args.sessionId]         - if set, must match registered scope
 * @returns {{toolName: string, args: object, projectId: string, agentId: string, sessionId: string}}
 */
function consume({ toolCallId, expectedToolName, projectId, sessionId }) {
  if (!toolCallId || typeof toolCallId !== 'string') {
    throw new PendingCallError('missing toolCallId', 'invalid_request');
  }
  const entry = _registry.get(toolCallId);
  if (!entry) throw new PendingCallError('toolCallId not found or already used', 'not_found');
  if (entry.used) throw new PendingCallError('toolCallId already used', 'already_used');
  if (entry.expiresAt < Date.now()) {
    _registry.delete(toolCallId);
    throw new PendingCallError('toolCallId expired', 'expired');
  }
  if (expectedToolName && entry.toolName !== expectedToolName) {
    throw new PendingCallError(
      `toolCallId is for ${entry.toolName}, not ${expectedToolName}`,
      'wrong_tool'
    );
  }
  // Strict scope check — both sides must agree (both null or both equal).
  // The previous "if both truthy" form let a token issued without scope be
  // claimed by any caller, which is the privilege-escalation primitive
  // flagged by review.
  if ((entry.projectId || null) !== (projectId || null)) {
    throw new PendingCallError('projectId mismatch on toolCallId scope', 'scope_mismatch');
  }
  if ((entry.sessionId || null) !== (sessionId || null)) {
    throw new PendingCallError('sessionId mismatch on toolCallId scope', 'scope_mismatch');
  }
  entry.used = true;
  return {
    toolName: entry.toolName,
    args: entry.args,
    projectId: entry.projectId,
    agentId: entry.agentId,
    sessionId: entry.sessionId,
  };
}

/** Peek at a pending entry without consuming. Used by tests + introspection. */
function peek(toolCallId) {
  const entry = _registry.get(toolCallId);
  if (!entry) return null;
  return { ...entry };
}

/** Test/admin only — clear all pending entries. */
function _resetForTests() {
  _registry.clear();
  if (_gcTimer) {
    clearInterval(_gcTimer);
    _gcTimer = null;
  }
}

class PendingCallError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'PendingCallError';
    this.code = code;
  }
}

module.exports = {
  issue,
  consume,
  peek,
  PendingCallError,
  _resetForTests,
};
