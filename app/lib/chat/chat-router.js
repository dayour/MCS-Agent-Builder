/**
 * chat-router.js — Unified /api/chat handler.
 *
 * Replaces /api/project-chat/turn, /api/wizard/chat, /api/copilot/chat
 * with a single SSE endpoint that:
 *   1. classifies user intent (qa | spec-build | research-deep | command)
 *   2. retrieves relevant knowledge chunks (BM25)
 *   3. invokes Claude Opus with a hybrid system prompt
 *   4. parses the structured-action output ({text, actions[]})
 *   5. executes actions server-side via tools.js
 *   6. emits stable app-level SSE events (event-protocol.js)
 *
 * Phase 1 simplification: brain is non-streaming with a structured-JSON
 * contract (similar to the legacy orchestrator) instead of true Anthropic
 * tool-use. This avoids extending tools/lib/anthropic.js for tool-use
 * streaming. Trade-off: no mid-turn tool reaction, but knowledge is
 * pre-retrieved into the system prompt so Q&A is single-roundtrip and
 * spec_patch / confirmation cards work correctly.
 *
 * GPT challenge mitigations:
 *   - Sanitize history (reject role='tool' or 'system' from client)
 *   - Pending tool-call tokens validated server-side (pending-calls.js)
 *   - Spec patch validation (spec-store.validatePatch)
 *   - First-turn rule enforced server-side (mirrors legacy server.js:517-524)
 *   - Long jobs decoupled (start_deep_research returns jobId; frontend
 *     subscribes to /api/jobs/:jobId/events separately)
 *   - Stable app event envelope (event-protocol.js) — no Anthropic internals leaked
 */

const crypto = require('crypto');

const anthropicApi = require('../../../tools/lib/anthropic');
const specStore = require('./spec-store');
const tools = require('./tools');
const knowledgeRetriever = require('./knowledge-retriever');
const dev = require('../dev-logger');
const pendingCalls = require('./pending-calls');
const { createEmitter } = require('./event-protocol');
const { buildSystemPrompt, classifyIntent } = require('./system-prompts');

const BRAIN_MODEL = 'opus';
const BRAIN_MAX_TOKENS = 4096;
const BRAIN_TIMEOUT_MS = 90_000;
const HISTORY_MAX_TURNS = 12;       // pairs of user/assistant
const HISTORY_VALIDATE_CAP = 200;   // hard cap before we even validate shape
const KNOWLEDGE_TOP_K = 4;

const VALID_ROLES = new Set(['user', 'assistant']);

// ---------------------------------------------------------------------------
// Public handlers
// ---------------------------------------------------------------------------

async function handleChat(req, res) {
  const sessionId = (req.headers['x-session-id'] || '').toString().slice(0, 80) || `s_${crypto.randomBytes(6).toString('hex')}`;

  // ─── Preflight checks — run BEFORE any SSE write so we can still return
  // a real HTTP status. Once we call emit.hello() the stream commits to 200.
  let body;
  try {
    body = req.body || {};
  } catch {
    return res.status(400).json({ error: 'invalid_body', message: 'request body could not be parsed' });
  }

  const userMessage = (body.message || '').toString().trim();
  const attachmentsInput = Array.isArray(body.attachments) ? body.attachments.slice(0, 10) : [];
  if (!userMessage && attachmentsInput.length === 0) {
    return res.status(400).json({ error: 'empty_message', message: 'message or attachments required' });
  }

  if (!anthropicApi.isConfigured()) {
    return res.status(503).json({
      error: 'llm_not_configured',
      message: 'Claude not configured. Sign in to Claude Code, set ANTHROPIC_API_KEY, or configure gh auth with copilot scope.',
    });
  }

  // ─── Past preflight: open the SSE stream and proceed in-band.
  const emit = createEmitter(res);

  const projectId = sanitizeProjectId(body.projectId);
  const agentId = sanitizeAgentId(body.agentId) || 'default';
  const turnId = `t_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const history = sanitizeHistory(body.history);
  const attachments = attachmentsInput;
  const hasNewFiles = attachments.length > 0;

  // Validate any toolCallResponse server-side before letting it influence the
  // brain. Without this check, a malicious client could embed a fabricated
  // toolCallId in user content; even though pending-calls.consume catches it
  // at execute time, we waste an LLM turn first. peek() lets us drop the
  // line up-front when the id is unknown or scoped to a different session.
  const rawTcr = body.toolCallResponse || null;
  const toolCallResponse = validateToolCallResponse(rawTcr, { projectId, sessionId });

  // Open the SSE stream
  emit.hello({
    sessionId,
    capabilities: {
      streaming: false,           // Phase 1: non-streaming brain, streamed SSE outputs
      toolUse: 'structured-json',
      tools: tools.listTools().map(t => t.name),
    }
  });

  // Disconnect → cancel. Use res.on('close') (fires when the response stream
  // closes), not req.on('close') (fires on Node 18+ when the request body
  // is fully consumed, which would falsely abort every turn).
  const abortController = new AbortController();
  let aborted = false;
  res.on('close', () => {
    aborted = true;
    try { abortController.abort(); } catch { /* noop */ }
  });

  // Resolve spec context
  let spec = null;
  let specSummary = '(no project)';
  let isFirstTurn = true;
  if (projectId && specStore.projectExists(projectId)) {
    const p = specStore.sessionPaths(projectId);
    spec = specStore.readSpec(p.agentDir);
    specSummary = specStore.summarizeSpec(spec);
    const hasPriorAssistant = history.some(m => m.role === 'assistant');
    const hasExistingSpec = !!(spec && Object.keys(spec).length > 0);
    isFirstTurn = !hasPriorAssistant && !hasExistingSpec;
  }

  // Intent classification
  const completeness = specStore.specCompleteness(spec);
  const intent = classifyIntent({
    message: userMessage,
    hasAttachments: hasNewFiles,
    hasProject: !!projectId,
    specCompleteness: completeness,
  });

  // Retrieval (skip for command-class turns)
  let retrieved = [];
  if (intent !== 'command') {
    try {
      retrieved = await knowledgeRetriever.retrieve({ query: userMessage, k: KNOWLEDGE_TOP_K });
    } catch (err) {
      dev.warn('chat-router', 'knowledge retrieve failed', err.message);
    }
  }

  if (aborted) { emit.end(); return; }

  // Build context for the brain
  const systemPrompt = buildSystemPrompt({
    intent,
    projectContext: projectId ? { projectId, agentId, specSummary } : null,
    retrievedKnowledge: retrieved,
    isFirstTurn,
    hasNewFiles,
  });

  // Compose conversation messages
  const trimmedHistory = trimHistory(history);
  const userContent = composeUserContent({
    message: userMessage,
    attachments,
    toolCallResponse,
  });
  const messages = [
    { role: 'system', content: systemPrompt },
    ...trimmedHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userContent },
  ];

  // Call brain (cancellable via the abort controller wired to res.on('close'))
  let parsed;
  try {
    parsed = await callBrain(messages, abortController.signal);
  } catch (err) {
    if (aborted || err?.name === 'AbortError') { emit.end(); return; }
    emit.error({ code: 'brain_failed', message: err.message });
    emit.done();
    return;
  }

  if (aborted) { emit.end(); return; }
  if (parsed._malformed) {
    // Drop any actions from a malformed envelope — only emit the text we
    // could recover. Belt-and-suspenders: the brain's parser already returns
    // actions: [] in this branch, but a future tweak that produces partials
    // shouldn't silently ship side effects.
    parsed.actions = [];
  }

  // Validate parsed.text + actions
  const text = (parsed && typeof parsed.text === 'string') ? parsed.text : '';
  const actions = Array.isArray(parsed?.actions) ? parsed.actions : [];

  // Emit message_start so the client can begin a bubble
  const messageId = `m_${turnId}`;
  emit.messageStart({ messageId, turnId });

  // Stream the text in chunks (~24 chars) so the UI animates. Phase 2 will
  // use true token streaming once anthropic.js supports tool-use streaming.
  for (const chunk of chunkText(text, 24)) {
    if (aborted) break;
    emit.messageDelta({ messageId, text: chunk });
  }

  // Execute actions in order
  const ctx = {
    projectId,
    agentId,
    sessionId,
    turnId,
    isFirstTurn,
    hasNewFiles,
    emit: (eventType, data) => {
      switch (eventType) {
        case 'artifact_updated': return emit.artifactUpdated(data);
        case 'action_requested': return emit.actionRequested(data);
        case 'action_completed': return emit.actionCompleted(data);
        case 'job_started':      return emit.jobStarted(data);
        case 'job_progress':     return emit.jobProgress(data);
        case 'job_completed':    return emit.jobCompleted(data);
        default: dev.warn('chat-router', 'unknown emit type', eventType);
      }
    },
  };

  for (const action of actions) {
    if (aborted) break;
    if (!action || typeof action.name !== 'string') continue;
    const actionResult = await tools.execute(action, ctx);
    emit.actionCompleted({
      action: action.name,
      ok: !!actionResult.ok,
      result: actionResult.ok ? actionResult.result : undefined,
      error: actionResult.ok ? undefined : actionResult.error,
      detail: actionResult.ok ? undefined : actionResult.detail,
      code: actionResult.code,
    });
  }

  emit.messageDone({ messageId, finishReason: 'end_turn' });
  emit.done({});
}

async function handleCancel(req, res) {
  // Phase 1: stub. Phase 2 wires this to research-pipeline.cancelJob and
  // analyze-pipeline.cancelJob. For now, return ok=true so frontend code
  // can be written against the contract.
  const jobId = (req.body?.jobId || '').toString();
  res.json({ ok: true, jobId, note: 'cancel_job stub — Phase 2 wires real cancellation.' });
}

// ---------------------------------------------------------------------------
// Brain call — non-streaming, structured JSON
// ---------------------------------------------------------------------------

async function callBrain(messages, signal) {
  const attempt = async (appended) => {
    const msgs = appended
      ? [{ role: 'system', content: messages[0].content + '\n\n' + appended }, ...messages.slice(1)]
      : messages;
    const result = await anthropicApi.chatCompletion(msgs, {
      model: BRAIN_MODEL,
      maxTokens: BRAIN_MAX_TOKENS,
      timeout: BRAIN_TIMEOUT_MS,
      cacheSystem: true,
      signal,
    });
    return result.content || '';
  };

  // First attempt
  const raw1 = await attempt();
  if (signal?.aborted) throw new AbortError();
  const parsed1 = tryParseActionEnvelope(raw1);
  if (parsed1) return parsed1;

  // Repair retry
  const raw2 = await attempt(
    `Your previous response was not parseable JSON in the required shape.
Reply again with ONLY a JSON object: {"text": "...", "actions": [...]?}.
No markdown fences, no prose outside the JSON.`
  );
  if (signal?.aborted) throw new AbortError();
  const parsed2 = tryParseActionEnvelope(raw2);
  if (parsed2) return parsed2;

  // Two strikes — surface the raw text as a plain message so the user
  // gets something rather than nothing.
  return {
    text: raw2 ? raw2.slice(0, 1000) : '(model returned no parseable response)',
    actions: [],
    _malformed: true,
  };
}

class AbortError extends Error {
  constructor() { super('aborted'); this.name = 'AbortError'; }
}

function tryParseActionEnvelope(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();

  // Strip markdown fences if the model added them despite instructions
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Find first balanced { ... } in case there's leading prose
  const open = text.indexOf('{');
  if (open < 0) return null;
  let depth = 0;
  let end = -1;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) return null;

  let parsed;
  try { parsed = JSON.parse(text.slice(open, end + 1)); }
  catch { return null; }

  if (!parsed || typeof parsed !== 'object' || typeof parsed.text !== 'string') return null;
  if (parsed.actions != null && !Array.isArray(parsed.actions)) return null;
  return parsed;
}

// ---------------------------------------------------------------------------
// Input sanitation (GPT challenge: client-supplied history is prompt-injection)
// ---------------------------------------------------------------------------

/**
 * Validate a client-supplied toolCallResponse against the pending-calls
 * registry. Returns the original {toolCallId, decision} if it passes (token
 * exists, not yet consumed, scope matches). Returns null if the token is
 * unknown, expired, already used, or out of scope — the brain then never
 * sees the line in the user prompt, so it can't be primed by a forged id.
 */
function validateToolCallResponse(input, { projectId, sessionId }) {
  if (!input || typeof input !== 'object') return null;
  const toolCallId = typeof input.toolCallId === 'string' ? input.toolCallId : null;
  const decision = input.decision === 'confirm' ? 'confirm'
                 : input.decision === 'decline' ? 'decline'
                 : null;
  if (!toolCallId || !decision) return null;
  const entry = pendingCalls.peek(toolCallId);
  if (!entry) return null;
  if (entry.used) return null;
  if (entry.expiresAt < Date.now()) return null;
  if (entry.projectId && projectId && entry.projectId !== projectId) return null;
  if (entry.sessionId && sessionId && entry.sessionId !== sessionId) return null;
  return { toolCallId, decision };
}

function sanitizeProjectId(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  // Defer slug normalization to specStore.safeSlug
  return specStore.safeSlug(v);
}

function sanitizeAgentId(value) {
  if (typeof value !== 'string') return null;
  return value.trim().slice(0, 80) || null;
}

/**
 * Strip anything that isn't a clean user/assistant message. In particular,
 * reject role='system' or 'tool' from the client — those are server-only.
 */
function sanitizeHistory(input) {
  if (!Array.isArray(input)) return [];
  // Cap before validation to bound work — a hostile client posting 100k
  // entries shouldn't be able to make us walk all of them.
  const capped = input.length > HISTORY_VALIDATE_CAP ? input.slice(-HISTORY_VALIDATE_CAP) : input;
  const out = [];
  for (const m of capped) {
    if (!m || typeof m !== 'object') continue;
    if (!VALID_ROLES.has(m.role)) continue;
    const content = typeof m.content === 'string' ? m.content : '';
    if (!content.trim()) continue;
    out.push({ role: m.role, content: content.slice(0, 8000) });
  }
  return out;
}

function trimHistory(history) {
  // Keep last N pairs (most recent first, then reversed)
  const max = HISTORY_MAX_TURNS * 2;
  return history.slice(-max);
}

function composeUserContent({ message, attachments, toolCallResponse }) {
  const parts = [];
  if (message) parts.push(message);
  if (Array.isArray(attachments) && attachments.length > 0) {
    parts.push('\n\n[Attachments this turn:]');
    for (const a of attachments) {
      const name = a?.name ? String(a.name).slice(0, 200) : 'attachment';
      const kind = a?.kind ? ` (${String(a.kind).slice(0, 40)})` : '';
      parts.push(`- ${name}${kind}`);
    }
  }
  if (toolCallResponse && toolCallResponse.toolCallId) {
    const id = String(toolCallResponse.toolCallId).slice(0, 64);
    const decision = toolCallResponse.decision === 'confirm' ? 'confirm' : 'decline';
    parts.push(`\n\n[Tool-call response: toolCallId=${id} decision=${decision}]`);
  }
  return parts.join('\n').slice(0, 16000);
}

function chunkText(text, size) {
  const out = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

module.exports = {
  handleChat,
  handleCancel,
  // exposed for tests
  _internals: { tryParseActionEnvelope, sanitizeHistory },
};
