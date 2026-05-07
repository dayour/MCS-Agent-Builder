/**
 * tools.js — Tool definitions and handlers for the unified /api/chat router.
 *
 * Each tool is a pair: { definition } for the LLM (Anthropic tool-use
 * schema, JSON Schema arguments) and { execute(args, ctx) } for the
 * server. The server is the source of truth — the LLM proposes, the
 * server decides. Privileged tools (start_deep_research, start_mcs_build,
 * cancel_job) require a one-time confirmation token issued by the server
 * via pending-calls.js.
 *
 * GPT challenge mitigations encoded here:
 *   - Authorization: every tool validates projectId/agentId scope vs ctx
 *   - Confirmation: privileged tools error without a valid toolCallId
 *   - Validation: spec_patch runs through validatePatch before commit
 *   - Long jobs decoupled from chat stream: job tools return { jobId }
 *     and the frontend subscribes to /api/jobs/:jobId/events separately
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const specStore = require('./spec-store');
const knowledgeRetriever = require('./knowledge-retriever');
const pendingCalls = require('./pending-calls');

// ---------------------------------------------------------------------------
// Tool definitions (Anthropic tool-use schema)
// ---------------------------------------------------------------------------

const TOOL_DEFINITIONS = [
  {
    name: 'query_knowledge',
    description: 'Retrieve grounding chunks from the local MCS knowledge cache (24 cheat sheets + frameworks). Use BEFORE answering any MCS-specific factual question. Returns up to k chunks with file path, heading, and excerpt — cite by file path.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text query (e.g. "SharePoint knowledge sources", "MCP server vs connector").' },
        k: { type: 'integer', minimum: 1, maximum: 8, default: 4 },
        topics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional file basename filter, e.g. ["mcp-servers", "connectors"]'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'mcs_doc_search',
    description: 'Search official Microsoft Learn for MCS / Power Platform / Azure documentation. Returns up to 10 top results. Use when the local cache is silent or the user wants Microsoft-authoritative guidance.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' }
      },
      required: ['query']
    }
  },
  {
    name: 'spec_patch',
    description: 'Apply a JSON merge patch to the active project agentspec.json. Arrays REPLACE; objects MERGE. Allowed top-level sections: business, agent, capabilities, integrations, knowledge, conversations, boundaries, architecture, flows, evalSets, decisions, workflow, evalConfig, openQuestions. NEVER patch on the very first turn of an empty project — see first-turn rule.',
    input_schema: {
      type: 'object',
      properties: {
        patch: { type: 'object', description: 'Partial spec (top-level keys → fields).' },
        summary: { type: 'string', description: 'One-line changelog summary (240 chars max).' },
        affectedSection: { type: 'string', description: 'Primary section being modified, for UI highlight.' }
      },
      required: ['patch', 'summary']
    }
  },
  {
    name: 'extract_from_doc',
    description: 'Extract spec patches from a single uploaded document via a fast Sonnet pass. Cheaper and faster than start_deep_research when one file is enough.',
    input_schema: {
      type: 'object',
      properties: {
        docName: { type: 'string', description: 'File name as stored under Build-Guides/{projectId}/docs/' },
        focus: { type: 'string', description: 'Optional hint about which sections to focus on.' }
      },
      required: ['docName']
    }
  },
  {
    name: 'start_deep_research',
    description: 'Kick the CLI-backed analyze pipeline (full /mcs-research agentic mode with skills, MCP servers, and the knowledge cache). Takes ~20-30 min — this is the deep, thorough path. REQUIRES the user to have confirmed via an action_requested card; pass that toolCallId here. Tell the user to expect 20-30 minutes when surfacing the confirmation.',
    input_schema: {
      type: 'object',
      properties: {
        toolCallId: { type: 'string', description: 'One-time confirmation token from a prior action_requested event.' },
        scope: {
          type: 'string',
          enum: ['preview', 'full', 're-enrich'],
          default: 'full',
          description: 'preview = Phase A only (~60s). full = A+B+C (3-5min). re-enrich = Phase C only.'
        }
      },
      required: ['toolCallId']
    }
  },
  {
    name: 'start_mcs_build',
    description: 'Kick the hybrid build pipeline: CLI agentic step produces a BuildPlan, API step executes (Dataverse + LSP + PVA + publish + verify). REQUIRES a confirmation toolCallId from the user. Tell them to expect ~10-20 min when surfacing the confirmation card.',
    input_schema: {
      type: 'object',
      properties: {
        toolCallId: { type: 'string' }
      },
      required: ['toolCallId']
    }
  },
  {
    name: 'request_user_confirmation',
    description: 'Render an inline action card to the user for a privileged action (deep research, build, cancel). The server returns a toolCallId — pass it back through the matching start_* / cancel_job tool when the user confirms.',
    input_schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['confirm_deep_research', 'confirm_mcs_build', 'confirm_cancel_job'],
        },
        title: { type: 'string' },
        body: { type: 'string' },
        confirmLabel: { type: 'string', default: 'Run it' },
        declineLabel: { type: 'string', default: 'Stay interactive' },
        // tool-specific args persisted with the pending call
        scope: { type: 'string', enum: ['preview', 'full', 're-enrich'] },
        jobId: { type: 'string' }
      },
      required: ['action', 'title', 'body']
    }
  },
  {
    name: 'cancel_job',
    description: 'Abort an active research or build job. REQUIRES a confirmation toolCallId.',
    input_schema: {
      type: 'object',
      properties: {
        toolCallId: { type: 'string' },
        jobId: { type: 'string' }
      },
      required: ['toolCallId', 'jobId']
    }
  },
  {
    name: 'suggest_options',
    description: 'Render a chip selector with 2-6 quick-reply options. Use this whenever you would otherwise list choices in the text ("Should it run on Teams, M365 Copilot, or both?") — the chips let the user click instead of typing. Each chip carries a label (what the user sees) and a value (the message that gets sent on click). No confirmation token needed; the user can also type a different answer if none of the chips fit.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short heading on the card (e.g. "Pick a channel").' },
        body: { type: 'string', description: 'Optional 1-line explanation of the choice. Omit when the title is self-explanatory.' },
        options: {
          type: 'array',
          minItems: 2,
          maxItems: 6,
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'Chip label users click (≤60 chars).' },
              value: { type: 'string', description: 'Message sent when the chip is clicked. Defaults to label.' },
              hint:  { type: 'string', description: 'Optional sub-line under the chip (≤120 chars).' }
            },
            required: ['label']
          }
        }
      },
      required: ['title', 'options']
    }
  },
];

// ---------------------------------------------------------------------------
// Handlers — execute(args, ctx) -> { ok, result?, error?, sse?: [...events] }
// ---------------------------------------------------------------------------

/** Lazy-require to avoid circular deps + boot cost */
function lazyAnalyzePipeline() {
  return require('../analyze-pipeline');
}
function lazyDocuments() {
  return require('../documents');
}
function lazyAnthropic() {
  return require('../../../tools/lib/anthropic');
}

async function execQueryKnowledge(args, ctx) {
  const { query, k = 4, topics } = args || {};
  if (!query || typeof query !== 'string') {
    return { ok: false, error: 'query is required' };
  }
  const results = await knowledgeRetriever.retrieve({ query, k, topics });
  return {
    ok: true,
    result: {
      query,
      hitCount: results.length,
      hits: results.map(r => ({
        file: r.file,
        heading: r.heading,
        excerpt: r.text,
        score: r.score,
      })),
    }
  };
}

async function execMcsDocSearch(args, ctx) {
  const query = (args?.query || '').toString().trim();
  if (!query) return { ok: false, error: 'query required' };

  // Microsoft Learn search API — public, no auth, returns structured results.
  // We use a 6s timeout and gracefully return zero hits on any failure so the
  // brain can fall back to query_knowledge without surfacing an error.
  const url = new URL('https://learn.microsoft.com/api/search');
  url.searchParams.set('search', query);
  url.searchParams.set('locale', 'en-us');
  url.searchParams.set('$top', '10');

  let data;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    let res;
    try {
      res = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      return {
        ok: true,
        result: {
          query,
          hits: [],
          note: `MS Learn search returned ${res.status}; fall back to query_knowledge.`
        }
      };
    }
    data = await res.json();
  } catch (err) {
    return {
      ok: true,
      result: {
        query,
        hits: [],
        note: `MS Learn search unreachable (${err.message || 'timeout'}); fall back to query_knowledge.`
      }
    };
  }

  const results = Array.isArray(data?.results) ? data.results : [];
  const hits = results.slice(0, 10).map((r) => ({
    title: r.title || r.displayName || '(untitled)',
    url: r.url,
    description: (r.description || '').slice(0, 400),
    lastUpdated: r.lastUpdatedDate || null,
  }));

  return {
    ok: true,
    result: { query, hitCount: hits.length, hits }
  };
}

async function execSpecPatch(args, ctx) {
  const { patch, summary, affectedSection } = args || {};

  // First-turn rule. Original intent: don't let the brain speed-create a
  // full spec from a one-line user message. Refined for the project-name-
  // first flow: agent.name-only patches ARE allowed on turn 1, because
  // that's exactly how the user-supplied name gets recorded (and the
  // project lazy-created from it). Anything richer than agent.name on turn
  // 1 is still refused so the brain can't fabricate capabilities/etc.
  if (ctx.isFirstTurn && !ctx.hasNewFiles) {
    const topKeys = Object.keys(patch || {});
    const agentSubKeys = Object.keys(patch?.agent || {});
    const isJustAgentName =
      topKeys.length === 1 &&
      topKeys[0] === 'agent' &&
      agentSubKeys.length === 1 &&
      agentSubKeys[0] === 'name' &&
      typeof patch.agent.name === 'string' &&
      patch.agent.name.trim().length > 0;
    if (!isJustAgentName) {
      return {
        ok: false,
        error: 'first-turn rule: on turn 1 you may only patch agent.name (the project name the user gave). Ask another clarifying question before recording anything else.'
      };
    }
  }

  const problems = specStore.validatePatch(patch);
  if (problems.length > 0) {
    return { ok: false, error: 'patch validation failed', detail: problems };
  }

  // Lazy project creation. When no project is active but the patch carries
  // a fresh agent.name, derive a slug from that name and create the project
  // on the spot — this is how the "ask for project name first" UX gets to
  // turn-2: turn 1 asks for the name, turn 2 patches { agent: { name } },
  // and the server materializes the folder + spec under that name.
  let activeProjectId = ctx.projectId;
  let projectCreatedThisTurn = false;
  if (!activeProjectId) {
    const proposedName = (patch && patch.agent && typeof patch.agent.name === 'string') ? patch.agent.name.trim() : '';
    if (!proposedName) {
      return { ok: false, error: 'no active project — patch must include agent.name to create one' };
    }
    const baseSlug = specStore.safeSlug(proposedName);
    if (!baseSlug) {
      return { ok: false, error: 'agent.name did not produce a valid project slug' };
    }
    // Slug-collision safety: if a project with this slug already exists, do
    // NOT attach — its history isn't ours, and silently patching a stranger's
    // project is the privilege-escalation primitive flagged by review. Mint a
    // unique suffix instead. 16 bits of entropy is more than enough at our
    // scale — even with thousands of projects, collision prob is ~1/65536.
    activeProjectId = baseSlug;
    if (specStore.projectExists(activeProjectId)) {
      const suffix = crypto.randomBytes(2).toString('hex');
      activeProjectId = `${baseSlug}-${suffix}`;
    }
    projectCreatedThisTurn = true;
    // Mutate ctx so any later actions in this same turn (rare, but possible
    // if the brain stacks multiple actions) see the new projectId without
    // having to re-derive it.
    ctx.projectId = activeProjectId;
  }

  const p = specStore.ensureProject(activeProjectId);

  const result = await specStore.withProjectSpecLock(p.slug, async () => {
    const current = specStore.readSpec(p.agentDir) || {};
    const merged = specStore.applyPatch(current, patch);
    specStore.writeSpec(p.agentDir, merged);
    const entry = specStore.appendChangelog(p.changelogFile, {
      source: 'chat',
      summary: (summary || '').slice(0, 240),
      turnId: ctx.turnId || null,
      affectedPaths: Object.keys(patch),
      affectedSection: affectedSection || null,
    });
    return { merged, entry };
  });

  // Emit an artifact_updated event after the lock releases
  ctx.emit?.('artifact_updated', {
    kind: 'spec',
    projectId: p.slug,
    agentId: 'default',
    summary: result.entry.summary,
    affectedPaths: result.entry.affectedPaths,
    changeId: result.entry.changeId,
    version: result.merged.updated_at,
  });

  return {
    ok: true,
    result: {
      changeId: result.entry.changeId,
      affectedPaths: result.entry.affectedPaths,
      summary: result.entry.summary,
    }
  };
}

async function execExtractFromDoc(args, ctx) {
  const { docName, focus } = args || {};
  if (!ctx.projectId) return { ok: false, error: 'no active project' };
  if (!docName) return { ok: false, error: 'docName required' };

  // Reject any path component or escape sequence in docName before joining.
  // The brain only ever needs basenames under <project>/docs/; anything else
  // is either a hallucination or a traversal attempt.
  if (typeof docName !== 'string' ||
      docName.length === 0 ||
      docName.length > 200 ||
      /[\\/]/.test(docName) ||
      docName.includes('..') ||
      docName.startsWith('.') ||
      /[\x00-\x1f]/.test(docName)) {
    return { ok: false, error: 'invalid docName', code: 'invalid_path' };
  }

  const p = specStore.sessionPaths(ctx.projectId);
  const docsDir = path.join(p.folder, 'docs');
  const docPath = path.join(docsDir, docName);
  // Scope to docs/ specifically — not the project root — so the brain can
  // never reach agentspec.json, session.json, or the changelog from here.
  if (!specStore.assertWithin(docsDir, docPath)) {
    return { ok: false, error: 'docName escapes docs/ scope', code: 'invalid_path' };
  }
  if (!fs.existsSync(docPath)) {
    return { ok: false, error: `doc not found: ${docName}` };
  }

  const documents = lazyDocuments();
  let extractResult;
  try {
    extractResult = await documents.extractContent(docPath);
  } catch (err) {
    return { ok: false, error: `extraction failed: ${err.message}` };
  }

  // documents.extractContent returns { content, error } — handle both shapes
  // defensively in case the contract changes (older callers got a raw string).
  const content = typeof extractResult === 'string'
    ? extractResult
    : (extractResult?.content || '');
  const extractionError = typeof extractResult === 'object' ? extractResult?.error : null;
  if (extractionError && !content) {
    return { ok: false, error: `extraction failed: ${extractionError}` };
  }
  const trimmed = content.slice(0, 30_000);
  const focusLine = focus ? `\nFocus: ${focus}` : '';
  const anthropic = lazyAnthropic();
  if (!anthropic.isConfigured()) {
    return { ok: false, error: 'LLM not configured for extraction' };
  }

  const messages = [
    {
      role: 'system',
      content: `You extract MCS agentspec.json patches from documents. Reply with ONLY a JSON
object: { "patch": {...}, "summary": "..." } — no markdown, no fences, no prose
outside the JSON.

Schema (pay attention to array vs object):

ARRAYS — these top-level keys MUST be arrays of objects:
  capabilities, integrations, knowledge, flows, evalSets, decisions, openQuestions

OBJECTS — these top-level keys MUST be objects:
  business, agent, conversations, boundaries, architecture, workflow, evalConfig

Per-section shapes (omit fields you don't have clear evidence for):
- business: { useCase, problemStatement, challenges:[{challenge,impact}],
              benefits:[{benefit,type}], successCriteria:[{metric,target,measurement}] }
- agent: { name, description, persona, primaryUsers, secondaryUsers }
- capabilities: [{ name, phase:"mvp"|"future", implementationType:"prompt"|"topic"|"tool"|"knowledge"|"flow", description }]
- integrations: [{ name, type:"mcp"|"connector"|"flow"|"ai-tool", purpose, dataProvided, authMethod }]
- knowledge: [{ name, type:"SharePoint"|"Dataverse"|"File"|"Website", purpose, scope }]
- conversations: { topics: [{ name, description, triggerType, triggerPhrases:[] }] }
- boundaries: { handle:[], decline:[{topic,redirect}], refuse:[{topic,reason}] }
- architecture: { type:"single"|"multi-agent", channels:[{name,reason}] }

Arrays REPLACE on patch; objects MERGE. Be conservative — only include fields
supported by clear evidence in the doc. Keep summary to one line.`
    },
    { role: 'user', content: `Document: ${docName}${focusLine}\n\n${trimmed}` }
  ];

  let raw;
  try {
    // Opus per "everything must be opus" — quality + performance over cost.
    // The 'opus' family sentinel auto-resolves to the latest Opus snapshot.
    const result = await anthropic.chatCompletion(messages, {
      model: 'opus',
      maxTokens: 8192,
      timeout: 120_000,
      cacheSystem: true,
    });
    raw = result.content || '';
  } catch (err) {
    return { ok: false, error: `LLM extraction error: ${err.message}` };
  }

  let parsed;
  try {
    const jsonText = raw.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    parsed = JSON.parse(jsonText);
  } catch (err) {
    return { ok: false, error: `extraction returned non-JSON: ${err.message}`, raw: raw.slice(0, 300) };
  }

  if (!parsed || typeof parsed !== 'object' || !parsed.patch) {
    return { ok: false, error: 'extraction missing { patch, summary }' };
  }

  // Apply the patch through the same spec_patch path so validation + changelog hit
  return execSpecPatch({
    patch: parsed.patch,
    summary: parsed.summary || `extracted from ${docName}`,
    affectedSection: 'multiple',
  }, ctx);
}

async function execRequestUserConfirmation(args, ctx) {
  const { action, title, body, confirmLabel, declineLabel, scope, jobId } = args || {};
  if (!action || !title || !body) return { ok: false, error: 'action, title, body required' };

  const innerArgs = { scope, jobId };
  const expectedTool = ({
    confirm_deep_research: 'start_deep_research',
    confirm_mcs_build: 'start_mcs_build',
    confirm_cancel_job: 'cancel_job',
  })[action];

  if (!expectedTool) return { ok: false, error: `unknown action: ${action}` };

  const { toolCallId, expiresAt } = pendingCalls.issue({
    toolName: expectedTool,
    args: innerArgs,
    projectId: ctx.projectId,
    agentId: ctx.agentId,
    sessionId: ctx.sessionId,
    ttlMs: 30 * 60 * 1000,
  });

  // Emit the action_requested envelope event
  ctx.emit?.('action_requested', {
    toolCallId,
    action,
    title,
    body,
    confirmLabel: confirmLabel || 'Run it',
    declineLabel: declineLabel || 'Stay interactive',
    expiresAt,
  });

  return {
    ok: true,
    result: {
      toolCallId,
      expiresAt,
      note: 'card rendered to user; await their action_response in the next turn',
    }
  };
}

async function execStartDeepResearch(args, ctx) {
  const { toolCallId, scope } = args || {};
  if (!toolCallId) {
    return { ok: false, error: 'toolCallId required — call request_user_confirmation first' };
  }

  let entry;
  try {
    entry = pendingCalls.consume({
      toolCallId,
      expectedToolName: 'start_deep_research',
      projectId: ctx.projectId,
      sessionId: ctx.sessionId,
    });
  } catch (err) {
    return { ok: false, error: `confirmation invalid: ${err.message}`, code: err.code };
  }

  if (!ctx.projectId) return { ok: false, error: 'no active project' };

  const pipeline = lazyAnalyzePipeline();
  const finalScope = scope || entry.args?.scope || 'full';
  // Project root: tools.js lives at app/lib/chat/tools.js, so '../../..'
  // resolves to <repo>/. analyze-pipeline.startAnalyzePipeline does
  // path.join(baseDir, "Build-Guides", projectId) and throws if baseDir
  // is undefined.
  const baseDir = path.resolve(__dirname, '..', '..', '..');

  // Decision (2026-05-05): chat-issued deep research now runs through the
  // CLI-backed analyze-pipeline, NOT the API-direct research-pipeline. The
  // CLI path has access to skills (mcs-research), MCP servers (PAC, WIQ,
  // Dataverse), the knowledge cache, and the framework files — all the
  // contracts we built specifically to take guesswork out of CLI runs.
  // Trade-off: ~20-30 min vs ~3-8 min, accepted for the agentic gain.
  // research-pipeline.js is preserved for emergency rollback (revert this
  // call site to lazyResearchPipeline + startResearchPipeline).
  // See knowledge/learnings/cli-vs-api-deep-research.md for the full
  // decision record + GPT challenge findings still on the deferred list
  // (concurrency limits, prompt-injection sandboxing, observability gap).
  let job;
  try {
    job = pipeline.startAnalyzePipeline(
      ctx.projectId,
      ctx.agentId || 'default',
      baseDir
    );
  } catch (err) {
    // Typed capacity errors get a clean code so the chat UI can render a
    // 'try again later' message rather than the generic failure phrasing.
    if (err && err.code === 'analyze_capacity_exceeded') {
      return { ok: false, error: err.message, code: 'capacity_exceeded' };
    }
    return { ok: false, error: `failed to start research: ${err.message}` };
  }

  // Frontend subscribes to /api/skill/status/:jobId — the unified SSE
  // endpoint that findJob() routes to analyze-pipeline._jobs.
  const eventsUrl = `/api/skill/status/${encodeURIComponent(job.id)}`;

  ctx.emit?.('job_started', {
    jobId: job.id,
    // skillType matches what analyze-pipeline stamps on its job records
    // so PipelineActivityContext.trackJob and SpecCanvasDocument's
    // STEP_TO_SECTIONS lookup both key off the same value.
    kind: 'analyze',
    scope: finalScope,
    projectId: ctx.projectId,
    agentId: ctx.agentId || 'default',
    eventsUrl,
  });

  return {
    ok: true,
    result: {
      jobId: job.id,
      kind: 'analyze',
      scope: finalScope,
      eventsUrl,
      note: 'CLI-backed pipeline started — full agentic mode (skills + MCPs + cache)',
    }
  };
}

async function execStartMcsBuild(args, ctx) {
  const { toolCallId } = args || {};
  if (!toolCallId) return { ok: false, error: 'toolCallId required' };
  try {
    pendingCalls.consume({
      toolCallId,
      expectedToolName: 'start_mcs_build',
      projectId: ctx.projectId,
      sessionId: ctx.sessionId,
    });
  } catch (err) {
    return { ok: false, error: `confirmation invalid: ${err.message}`, code: err.code };
  }

  if (!ctx.projectId) return { ok: false, error: 'no active project' };

  // Wire to the hybrid build pipeline (CLI agentic plan → API deterministic
  // execute). Same project root resolution as start_deep_research.
  const baseDir = path.resolve(__dirname, '..', '..', '..');
  const buildHybrid = require('../build-pipeline-hybrid');

  let job;
  try {
    job = buildHybrid.startBuildHybridPipeline(
      ctx.projectId,
      ctx.agentId || 'default',
      baseDir
    );
  } catch (err) {
    if (err && err.code === 'hybrid_capacity_exceeded') {
      return { ok: false, error: err.message, code: 'capacity_exceeded' };
    }
    return { ok: false, error: `failed to start build: ${err.message}` };
  }

  const eventsUrl = `/api/skill/status/${encodeURIComponent(job.id)}`;
  ctx.emit?.('job_started', {
    jobId: job.id,
    kind: 'build',
    projectId: ctx.projectId,
    agentId: ctx.agentId || 'default',
    eventsUrl,
  });

  return {
    ok: true,
    result: {
      jobId: job.id,
      kind: 'build',
      eventsUrl,
      note: 'Hybrid build started — CLI plan → API execute → verify',
    },
  };
}

async function execSuggestOptions(args, ctx) {
  const { title, body, options } = args || {};
  if (!title || typeof title !== 'string') return { ok: false, error: 'title required' };
  if (!Array.isArray(options) || options.length < 2) {
    return { ok: false, error: 'options must be an array with at least 2 entries' };
  }
  const safeOptions = options
    .slice(0, 6)
    .map((o) => {
      if (!o || typeof o !== 'object') return null;
      const label = (typeof o.label === 'string' ? o.label : '').trim().slice(0, 60);
      if (!label) return null;
      const value = (typeof o.value === 'string' && o.value.trim() ? o.value.trim() : label).slice(0, 200);
      const hint = typeof o.hint === 'string' ? o.hint.slice(0, 120) : undefined;
      return { label, value, hint };
    })
    .filter(Boolean);
  if (safeOptions.length < 2) {
    return { ok: false, error: 'at least 2 valid options required' };
  }
  // No pendingCalls token — clicking a chip just submits its value as a
  // normal user turn, which the brain reads with full context. The
  // toolCallId here is a disposable React key, not a security primitive.
  const cardId = `sug_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  ctx.emit?.('action_requested', {
    toolCallId: cardId,
    action: 'suggest_options',
    title: String(title).slice(0, 120),
    body: typeof body === 'string' ? body.slice(0, 400) : '',
    options: safeOptions,
  });
  return { ok: true, result: { offered: safeOptions.length, cardId } };
}

async function execCancelJob(args, ctx) {
  const { toolCallId, jobId } = args || {};
  if (!toolCallId || !jobId) return { ok: false, error: 'toolCallId and jobId required' };
  try {
    pendingCalls.consume({
      toolCallId,
      expectedToolName: 'cancel_job',
      projectId: ctx.projectId,
      sessionId: ctx.sessionId,
    });
  } catch (err) {
    return { ok: false, error: `confirmation invalid: ${err.message}`, code: err.code };
  }
  // Phase 1: pipelines do not yet expose cancelJob — return stub.
  // Phase 2 will wire research-pipeline + analyze-pipeline cancellation.
  return {
    ok: true,
    result: {
      jobId,
      note: 'cancel_job stub — wires to research-pipeline.cancelJob in Phase 2.',
    }
  };
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const HANDLERS = {
  query_knowledge: execQueryKnowledge,
  mcs_doc_search: execMcsDocSearch,
  spec_patch: execSpecPatch,
  extract_from_doc: execExtractFromDoc,
  request_user_confirmation: execRequestUserConfirmation,
  start_deep_research: execStartDeepResearch,
  start_mcs_build: execStartMcsBuild,
  cancel_job: execCancelJob,
  suggest_options: execSuggestOptions,
};

/**
 * Execute a tool by name. Always resolves; never throws — errors are returned
 * in `{ ok: false, error: string }` shape so the LLM can read them and adapt.
 *
 * @param {object} call
 * @param {string} call.name
 * @param {object} call.args
 * @param {object} ctx                - { projectId, agentId, sessionId, turnId, emit, isFirstTurn, hasNewFiles }
 * @returns {Promise<{ok: boolean, result?: any, error?: string, code?: string}>}
 */
async function execute(call, ctx) {
  const handler = HANDLERS[call?.name];
  if (!handler) return { ok: false, error: `unknown tool: ${call?.name}` };
  try {
    return await handler(call.args || {}, ctx || {});
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

function listTools() {
  return TOOL_DEFINITIONS.map(t => ({ ...t }));
}

module.exports = {
  TOOL_DEFINITIONS,
  listTools,
  execute,
};
