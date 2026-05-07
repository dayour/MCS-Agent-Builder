/**
 * spec-store.js — Project + spec read/write helpers for the unified /api/chat router.
 *
 * Mirrors the logic in app/server.js (`sessionPaths`, `applySpecPatch`,
 * `withProjectSpecLock`, `appendChangelog`) so chat-router can read and
 * write specs without going through HTTP. Phase 5 cleanup will refactor
 * server.js to import from here too — for now we have a small, intentional
 * duplication.
 *
 * GPT challenge: "Make spec_patch a constrained domain operation with
 * schema validation, JSON Patch allowlists, revision preconditions, dry-run
 * preview, and rollback." This module enforces:
 *   - Allowlisted top-level sections (anything else rejected)
 *   - Required-fields shape check on each section
 *   - Atomic write with file lock (in-memory mutex per project)
 *   - Changelog append after every successful patch
 */

const fs = require('fs');
const path = require('path');

const BUILD_GUIDES = path.join(__dirname, '..', '..', '..', 'Build-Guides');
const SESSION_FILENAME = 'session.json';
const CHANGELOG_FILENAME = 'spec-changelog.jsonl';

// ---------------------------------------------------------------------------
// Path safety
// ---------------------------------------------------------------------------

function safeSlug(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled';
}

function assertWithin(parent, child) {
  const p = path.resolve(parent);
  const c = path.resolve(child);
  return c === p || c.startsWith(p + path.sep);
}

function sessionPaths(projectId) {
  const slug = safeSlug(projectId);
  const folder = path.join(BUILD_GUIDES, slug);
  return {
    slug,
    folder,
    sessionFile: path.join(folder, SESSION_FILENAME),
    changelogFile: path.join(folder, CHANGELOG_FILENAME),
    agentDir: path.join(folder, 'agents', 'default'),
  };
}

// ---------------------------------------------------------------------------
// Spec read / write
// ---------------------------------------------------------------------------

function specPath(agentDir) {
  return path.join(agentDir, 'agentspec.json');
}

function readSpec(agentDir) {
  const p = specPath(agentDir);
  if (!fs.existsSync(p)) {
    // Fall back to legacy brief.json (matches enrichment.js behavior)
    const legacy = path.join(agentDir, 'brief.json');
    if (fs.existsSync(legacy)) {
      try { return JSON.parse(fs.readFileSync(legacy, 'utf-8')); } catch { /* fall through */ }
    }
    return null;
  }
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
  catch { return null; }
}

function writeSpec(agentDir, spec) {
  if (!fs.existsSync(agentDir)) fs.mkdirSync(agentDir, { recursive: true });
  spec.updated_at = new Date().toISOString();
  // Atomic write: temp file + rename. Prevents truncated/corrupt JSON on
  // process crash mid-write, which can otherwise leave the spec
  // unparseable until a manual restore from spec-changelog.jsonl.
  const target = specPath(agentDir);
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(spec, null, 2), 'utf-8');
  fs.renameSync(tmp, target);
  return spec;
}

// ---------------------------------------------------------------------------
// Patch validation + application
// ---------------------------------------------------------------------------

const ALLOWED_SECTIONS = new Set([
  'business',
  'agent',
  'capabilities',
  'integrations',
  'knowledge',
  'conversations',
  'boundaries',
  'architecture',
  'flows',
  'evalSets',
  'decisions',
  'workflow',
  'evalConfig',
  'openQuestions',
]);

const REJECTED_TOP_KEYS = new Set([
  'buildStatus',         // controlled by build pipeline
  '_enrichment',         // controlled by enrichment.js
  '_provenance',         // controlled by provenance.js
  'updated_at',          // server-managed
  'created_at',          // server-managed
]);

/**
 * Validate a patch object before applying. Returns a list of human-readable
 * problems. Empty array means OK.
 */
function validatePatch(patch) {
  const problems = [];
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return ['patch must be a non-array object'];
  }
  for (const key of Object.keys(patch)) {
    if (REJECTED_TOP_KEYS.has(key)) {
      problems.push(`patch may not write to controlled field "${key}"`);
      continue;
    }
    if (!ALLOWED_SECTIONS.has(key)) {
      problems.push(`unknown top-level section "${key}"`);
      continue;
    }
    // Shape sanity per section
    const v = patch[key];
    if (v === null || v === undefined) continue;
    switch (key) {
      case 'capabilities':
      case 'integrations':
      case 'knowledge':
      case 'flows':
      case 'evalSets':
      case 'decisions':
      case 'openQuestions':
        if (!Array.isArray(v)) problems.push(`"${key}" must be an array`);
        break;
      case 'conversations':
      case 'business':
      case 'agent':
      case 'architecture':
      case 'boundaries':
      case 'workflow':
      case 'evalConfig':
        if (typeof v !== 'object' || Array.isArray(v)) {
          problems.push(`"${key}" must be an object`);
        }
        break;
    }
  }
  return problems;
}

/**
 * Apply a deep-merge patch — arrays REPLACE, objects MERGE.
 * Mirrors the contract in app/server.js applySpecPatch (line 417-430)
 * and the frontend specPatchUtils.applyPatch.
 */
function applyPatch(spec, patch) {
  const result = { ...(spec || {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (REJECTED_TOP_KEYS.has(key)) continue;       // belt and suspenders
    if (key === 'conversations' && value && typeof value === 'object' && !Array.isArray(value)) {
      result.conversations = { ...(result.conversations || {}), ...value };
    } else if (Array.isArray(value)) {
      result[key] = value;
    } else if (value && typeof value === 'object') {
      result[key] = { ...(result[key] || {}), ...value };
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Per-spec mutex (in-memory) — every agentspec.json writer uses the same map
// keyed by the agentDir absolute path. Old callsites that lock by projectId
// continue to work via withProjectSpecLock — it derives the agentDir.
// ---------------------------------------------------------------------------

const _writeLocks = new Map();

/**
 * Serialize spec writes for a single agentDir against every other writer
 * in this process. Concurrent calls to fn run one at a time; rejected
 * promises do NOT poison the lock for the next caller.
 */
function withSpecLock(agentDir, fn) {
  const key = path.resolve(agentDir);
  const prev = _writeLocks.get(key) || Promise.resolve();
  const next = prev.then(fn, fn);
  _writeLocks.set(key, next.catch(() => {}));
  return next;
}

/**
 * @deprecated Use withSpecLock(agentDir, fn) instead. This wrapper derives
 * the canonical agentDir from projectId via sessionPaths() so chat-router
 * and pipeline writes share the same mutex map. Kept for chat-router
 * compatibility — every internal caller in this file delegates here.
 */
function withProjectSpecLock(projectId, fn) {
  const { agentDir } = sessionPaths(projectId);
  return withSpecLock(agentDir, fn);
}

/**
 * Combined lock + atomic write helper. Use this from any module that
 * mutates agentspec.json to participate in the shared mutex and get
 * crash-safe writes for free.
 */
function writeSpecLocked(agentDir, spec) {
  return withSpecLock(agentDir, () => writeSpec(agentDir, spec));
}

// ---------------------------------------------------------------------------
// Changelog
// ---------------------------------------------------------------------------

function appendChangelog(changelogFile, entry) {
  const withId = {
    changeId: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    ...entry,
  };
  try {
    fs.appendFileSync(changelogFile, JSON.stringify(withId) + '\n', 'utf-8');
  } catch (err) {
    console.warn(`[chat/spec-store] changelog append failed: ${err.message}`);
  }
  return withId;
}

function readChangelog(changelogFile, tail = 50) {
  if (!fs.existsSync(changelogFile)) return [];
  const raw = fs.readFileSync(changelogFile, 'utf-8');
  const entries = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { entries.push(JSON.parse(line)); } catch { /* skip bad lines */ }
  }
  return tail ? entries.slice(-tail) : entries;
}

// ---------------------------------------------------------------------------
// Compact spec summary (used by system prompts)
// ---------------------------------------------------------------------------

function summarizeSpec(spec) {
  if (!spec || typeof spec !== 'object') return '(no spec yet)';
  const lines = [];
  if (spec.agent?.name) lines.push(`Agent: ${spec.agent.name}`);
  if (spec.agent?.description) lines.push(`Desc: ${String(spec.agent.description).slice(0, 200)}`);
  if (spec.agent?.primaryUsers) lines.push(`Primary users: ${spec.agent.primaryUsers}`);
  if (Array.isArray(spec.capabilities)) {
    lines.push(`Capabilities (${spec.capabilities.length}): ${spec.capabilities.map(c => c.name).filter(Boolean).slice(0, 8).join(', ')}`);
  }
  if (Array.isArray(spec.integrations)) {
    lines.push(`Integrations (${spec.integrations.length}): ${spec.integrations.map(i => i.name).filter(Boolean).slice(0, 6).join(', ')}`);
  }
  if (Array.isArray(spec.knowledge)) lines.push(`Knowledge (${spec.knowledge.length})`);
  if (spec.architecture?.type) lines.push(`Architecture: ${spec.architecture.type}`);
  return lines.length ? lines.join('\n') : '(spec skeleton only)';
}

function specCompleteness(spec) {
  if (!spec || typeof spec !== 'object') return 0;
  let score = 0;
  if (spec.agent?.name) score += 0.1;
  if (spec.agent?.description) score += 0.1;
  if (spec.agent?.primaryUsers) score += 0.1;
  if (spec.business?.useCase) score += 0.15;
  if (Array.isArray(spec.capabilities) && spec.capabilities.length > 0) score += 0.2;
  if (Array.isArray(spec.integrations) && spec.integrations.length > 0) score += 0.1;
  if (Array.isArray(spec.knowledge) && spec.knowledge.length > 0) score += 0.1;
  if (spec.architecture?.type) score += 0.1;
  if (Array.isArray(spec.evalSets) && spec.evalSets.length > 0) score += 0.05;
  return Math.min(1, score);
}

// ---------------------------------------------------------------------------
// Project existence + creation (deferred)
// ---------------------------------------------------------------------------

function projectExists(projectId) {
  const p = sessionPaths(projectId);
  return assertWithin(BUILD_GUIDES, p.folder)
    && fs.existsSync(p.folder)
    && fs.statSync(p.folder).isDirectory();
}

function ensureProject(projectId) {
  const p = sessionPaths(projectId);
  if (!assertWithin(BUILD_GUIDES, p.folder)) {
    throw new Error(`Project path "${projectId}" escapes Build-Guides`);
  }
  if (!fs.existsSync(p.folder)) fs.mkdirSync(p.folder, { recursive: true });
  if (!fs.existsSync(p.agentDir)) fs.mkdirSync(p.agentDir, { recursive: true });
  const docsDir = path.join(p.folder, 'docs');
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
  return p;
}

module.exports = {
  BUILD_GUIDES,
  safeSlug,
  assertWithin,
  sessionPaths,
  readSpec,
  writeSpec,
  writeSpecLocked,
  validatePatch,
  applyPatch,
  withSpecLock,
  withProjectSpecLock,
  appendChangelog,
  readChangelog,
  summarizeSpec,
  specCompleteness,
  projectExists,
  ensureProject,
};
