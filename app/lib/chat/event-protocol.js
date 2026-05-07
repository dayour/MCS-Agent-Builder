/**
 * event-protocol.js — Stable app-level SSE event envelope for /api/chat.
 *
 * GPT challenge: "Do not leak vendor stream event shapes to the frontend
 * contract." This module defines the stable client-facing event types and
 * provides a single helper to write them to an Express response. The
 * Anthropic native event types (content_block_delta, etc.) are an
 * implementation detail of chat-router.js — they never reach the client.
 *
 * Event types:
 *
 *   - hello              { sessionId, capabilities } - first event, opens stream
 *   - message_delta      { text }                    - assistant text token
 *   - message_start      { messageId }
 *   - message_done       { messageId, finishReason }
 *   - action_requested   { toolCallId, action, ... } - server is asking the
 *                                                      user to confirm or
 *                                                      pick an option (lifted
 *                                                      cards: disambiguate,
 *                                                      select_channels, etc.)
 *   - action_completed   { toolCallId, ok, result }  - server confirms a tool
 *                                                      executed
 *   - artifact_updated   { kind: 'spec'|'eval'|...,  - durable artifact changed
 *                          projectId, agentId, summary, patch?, version }
 *   - job_started        { jobId, kind, ... }        - long job kicked off
 *   - job_progress       { jobId, step, status, detail }
 *   - job_completed      { jobId, ok, result }
 *   - error              { code, message, ...detail }
 *   - done               {}                          - terminal event
 *
 * The frontend treats anything else as ignorable (forward-compat).
 */

const EVENT_TYPES = Object.freeze({
  HELLO: 'hello',
  MESSAGE_START: 'message_start',
  MESSAGE_DELTA: 'message_delta',
  MESSAGE_DONE: 'message_done',
  ACTION_REQUESTED: 'action_requested',
  ACTION_COMPLETED: 'action_completed',
  ARTIFACT_UPDATED: 'artifact_updated',
  JOB_STARTED: 'job_started',
  JOB_PROGRESS: 'job_progress',
  JOB_COMPLETED: 'job_completed',
  ERROR: 'error',
  DONE: 'done',
});

/**
 * Build an SSE-writer bound to an Express response. Sets headers on first
 * emit. Returns helpers for emitting each event type, with auto-flush.
 *
 * Usage:
 *   const emit = createEmitter(res);
 *   emit.hello({ sessionId });
 *   emit.messageDelta({ text: 'hi' });
 *   emit.done();
 *   emit.end();
 */
function createEmitter(res) {
  let headersSent = false;
  let closed = false;

  const ensureHeaders = () => {
    if (headersSent) return;
    headersSent = true;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
  };

  const writeEvent = (type, data) => {
    if (closed) return;
    ensureHeaders();
    try {
      res.write(`event: ${type}\n`);
      res.write(`data: ${JSON.stringify({ type, ...data, ts: Date.now() })}\n\n`);
      // res.flush exists on compression-extended responses; fallback noop.
      if (typeof res.flush === 'function') res.flush();
    } catch {
      closed = true;
    }
  };

  return {
    hello: (data) => writeEvent(EVENT_TYPES.HELLO, data || {}),
    messageStart: (data) => writeEvent(EVENT_TYPES.MESSAGE_START, data || {}),
    messageDelta: (data) => writeEvent(EVENT_TYPES.MESSAGE_DELTA, data || {}),
    messageDone: (data) => writeEvent(EVENT_TYPES.MESSAGE_DONE, data || {}),
    actionRequested: (data) => writeEvent(EVENT_TYPES.ACTION_REQUESTED, data || {}),
    actionCompleted: (data) => writeEvent(EVENT_TYPES.ACTION_COMPLETED, data || {}),
    artifactUpdated: (data) => writeEvent(EVENT_TYPES.ARTIFACT_UPDATED, data || {}),
    jobStarted: (data) => writeEvent(EVENT_TYPES.JOB_STARTED, data || {}),
    jobProgress: (data) => writeEvent(EVENT_TYPES.JOB_PROGRESS, data || {}),
    jobCompleted: (data) => writeEvent(EVENT_TYPES.JOB_COMPLETED, data || {}),
    error: (data) => writeEvent(EVENT_TYPES.ERROR, data || {}),
    done: (data) => {
      writeEvent(EVENT_TYPES.DONE, data || {});
      closed = true;
      try { res.end(); } catch { /* ignore */ }
    },
    end: () => {
      closed = true;
      try { res.end(); } catch { /* ignore */ }
    },
    isClosed: () => closed,
  };
}

module.exports = {
  EVENT_TYPES,
  createEmitter,
};
