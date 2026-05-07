#!/usr/bin/env node
/**
 * Sync Orchestrator — detect -> understand -> decide
 *
 * Single entry point for all dependency-sync work. Reads knowledge/sync-manifest.json,
 * dispatches to per-source adapters, and produces a triage bundle for human review.
 * Never auto-applies changes to our framework.
 *
 * Phases:
 *   1. DETECT     — adapter.detect() returns current fingerprint; diff vs snapshot.
 *   2. UNDERSTAND — adapter.understand(before, after) classifies the change and
 *                   emits a normalized ChangeRecord (severity, impacts, signals).
 *   3. DECIDE     — render triage cards. Decisions recorded via `--decide` are
 *                   appended to partitioned JSONL and exported to a committed MD view.
 *
 * Storage layout (from manifest.storage):
 *   knowledge/sync/snapshots/<source-id>.json         — gitignored, machine state
 *   knowledge/sync/runs/<runId>/                      — gitignored, per-run artifacts
 *   knowledge/sync/decisions/<source-id>/<runId>.jsonl — committed, hash-chained truth
 *   knowledge/sync/views/<runId>.md                   — committed, generated projection
 *
 * Usage:
 *   node tools/sync-orchestrator.js                   Full detect + understand, show triage
 *   node tools/sync-orchestrator.js detect            Phase 1 only (fast)
 *   node tools/sync-orchestrator.js run --source eval-guide
 *   node tools/sync-orchestrator.js review            Re-open last run's triage
 *   node tools/sync-orchestrator.js decide <changeId> <take|reject> --reason "..." [--confirm]
 *   node tools/sync-orchestrator.js manifest          Print loaded manifest
 *   node tools/sync-orchestrator.js --json            Emit JSON bundle instead of prose
 *
 * Decisions are TAKE or REJECT only. TAKE prints the impact graph and requires
 * --confirm (or interactive y/N) before recording, then writes an action plan
 * markdown listing the impacted artifacts. REJECT records and is permanent
 * for the changeId; if upstream moves again, the next run produces a fresh card.
 *
 * Exit codes:
 *   0 = no pending changes
 *   1 = pending changes detected (triage cards produced)
 *   2 = error (manifest parse, adapter crash)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'knowledge', 'sync-manifest.json');

// ── Manifest ─────────────────────────────────────────────────────────────────

function loadManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (e) {
    fail(`Cannot read manifest ${MANIFEST_PATH}: ${e.message}`);
  }
}

function resolveStorage(manifest) {
  const s = manifest.storage || {};
  return {
    snapshots: path.join(ROOT, s.snapshots || 'knowledge/sync/snapshots'),
    decisions: path.join(ROOT, s.decisions || 'knowledge/sync/decisions'),
    views:     path.join(ROOT, s.views     || 'knowledge/sync/views'),
    runs:      path.join(ROOT, s.runs      || 'knowledge/sync/runs'),
  };
}

// ── Snapshots ────────────────────────────────────────────────────────────────

function snapshotPath(storage, sourceId) {
  return path.join(storage.snapshots, `${sourceId}.json`);
}

function readSnapshot(storage, sourceId) {
  const p = snapshotPath(storage, sourceId);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function writeSnapshot(storage, sourceId, snapshot) {
  fs.mkdirSync(storage.snapshots, { recursive: true });
  const p = snapshotPath(storage, sourceId);
  fs.writeFileSync(p, JSON.stringify(snapshot, null, 2) + '\n');
}

// ── ChangeRecord + Triage Card ──────────────────────────────────────────────

function changeId(sourceId, dateStr) {
  const d = (dateStr || new Date().toISOString()).slice(0, 10);
  return `chg_${sourceId}_${d}_${crypto.randomBytes(3).toString('hex')}`;
}

/**
 * @typedef {Object} ChangeRecord
 * @property {string} id
 * @property {string} sourceId
 * @property {string} detectedAt
 * @property {'new'|'modified'|'removed'|'unchanged'} changeType
 * @property {'none'|'low'|'medium'|'high'} severity
 * @property {number} confidence 0..1
 * @property {{primary:string,secondary?:string,version?:string,timestamp?:string}} fingerprintBefore
 * @property {{primary:string,secondary?:string,version?:string,timestamp?:string}} fingerprintAfter
 * @property {{kind:string,subkind?:string,breakingRisk:string,novelty?:string}} classification
 * @property {Array<{target:string,type:'direct'|'inferred',reason:string,strength?:string}>} impacts
 * @property {'TAKE'|'REJECT'} recommendation
 * @property {string} [actionPlan]
 * @property {Array<{type:string,ref?:string,path?:string,excerpt?:string}>} evidence
 * @property {string} [headline]
 * @property {string[]} [why]
 */

function priorityScore(record, weights) {
  const impactMap = { none: 0, low: 0.25, medium: 0.6, high: 1 };
  const riskMap = { none: 0, low: 0.2, medium: 0.6, high: 1 };
  const maxImpact = (record.impacts || [])
    .map(i => impactMap[i.strength] ?? 0.5)
    .reduce((m, v) => Math.max(m, v), 0);
  const risk = riskMap[record.classification?.breakingRisk] ?? 0;
  const conf = record.confidence ?? 0.5;
  const staleDays = stalenessDays(record);
  const staleScore = Math.min(1, staleDays / 30);
  const novelty = record.classification?.novelty === 'breaking' ? 1
                : record.classification?.novelty === 'incremental' ? 0.5
                : 0.2;
  const w = weights || {};
  return Math.round(
    (w.impact ?? 40) * maxImpact +
    (w.breakingRisk ?? 25) * risk +
    (w.confidence ?? 15) * conf +
    (w.staleness ?? 10) * staleScore +
    (w.opportunity ?? 10) * novelty
  );
}

function stalenessDays(record) {
  const ts = record.fingerprintAfter?.timestamp || record.detectedAt;
  if (!ts) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 86400000));
}

function triageCard(record, weights) {
  return {
    changeId: record.id,
    sourceId: record.sourceId,
    status: record.changeType,
    priority: priorityScore(record, weights),
    headline: record.headline || `${record.sourceId}: ${record.changeType}`,
    changeClass: record.classification?.kind || 'unknown',
    breakingRisk: record.classification?.breakingRisk || 'unknown',
    frameworkImpact: impactLabel(record.impacts),
    recommendedDecision: record.recommendation || 'REJECT',
    actionPlan: record.actionPlan || '',
    timeToReview: reviewCost(record),
    why: record.why || [],
    evidenceRef: `.mcs/sync/runs/latest/changes/${record.id}.json`,
  };
}

function impactLabel(impacts) {
  const strengths = (impacts || []).map(i => i.strength).filter(Boolean);
  if (strengths.includes('high')) return 'high';
  if (strengths.includes('medium')) return 'medium';
  if (strengths.includes('low')) return 'low';
  return 'none';
}

function reviewCost(record) {
  const evLen = (record.evidence || []).length;
  if (evLen <= 1) return '<1m';
  if (evLen <= 3) return '1-2m';
  if (evLen <= 6) return '2-5m';
  return '>5m';
}

// ── Impact graph (transitive review) ────────────────────────────────────────

function expandImpacts(record, graph) {
  const edges = (graph && graph.edges) || [];
  const direct = new Set((record.impacts || []).map(i => i.target));
  const transitive = [];
  for (const e of edges) {
    if (direct.has(e.from) && !direct.has(e.to)) {
      transitive.push({
        target: e.to,
        type: 'inferred',
        reason: `${e.from} → ${e.to} (${e.kind}, ${e.strength})`,
        strength: e.strength,
      });
    }
  }
  if (transitive.length > 0) {
    record.impacts = [...(record.impacts || []), ...transitive];
  }
  return record;
}

// ── Adapter dispatch ─────────────────────────────────────────────────────────

function loadAdapter(source) {
  const adapterPath = path.join(ROOT, source.adapter);
  if (!fs.existsSync(adapterPath)) {
    return {
      missing: true,
      detect: () => ({ fingerprint: null, error: `adapter missing: ${source.adapter}` }),
      understand: () => null,
    };
  }
  try {
    delete require.cache[require.resolve(adapterPath)];
    return require(adapterPath);
  } catch (e) {
    return {
      brokenError: e.message,
      detect: () => ({ fingerprint: null, error: `adapter load failed: ${e.message}` }),
      understand: () => null,
    };
  }
}

// ── Phases ───────────────────────────────────────────────────────────────────

async function phaseDetect(manifest, storage, filter) {
  const results = [];
  const sources = manifest.sources.filter(s => !filter || s.id === filter);

  for (const source of sources) {
    const adapter = loadAdapter(source);
    const prevSnapshot = readSnapshot(storage, source.id);
    let detection;
    try {
      detection = await adapter.detect({ source, prevSnapshot, root: ROOT });
    } catch (e) {
      detection = { error: `detect threw: ${e.message}` };
    }
    const now = new Date().toISOString();
    results.push({
      source,
      prevSnapshot,
      detection,
      detectedAt: now,
      adapterMissing: !!adapter.missing,
      adapterBroken: !!adapter.brokenError,
    });
  }
  return results;
}

async function phaseUnderstand(detectResults, manifest, storage) {
  const records = [];
  for (const item of detectResults) {
    const { source, prevSnapshot, detection, detectedAt } = item;
    if (detection?.error) {
      records.push(buildErrorRecord(source, detection.error, detectedAt));
      continue;
    }

    const before = prevSnapshot?.fingerprint || {};
    const after = detection.fingerprint || {};
    const changed = before.primary !== after.primary || before.secondary !== after.secondary;

    if (!changed && prevSnapshot) {
      records.push({
        id: changeId(source.id, detectedAt),
        sourceId: source.id,
        detectedAt,
        changeType: 'unchanged',
        severity: 'none',
        confidence: 1,
        fingerprintBefore: before,
        fingerprintAfter: after,
        classification: { kind: 'none', breakingRisk: 'none' },
        impacts: [],
        recommendation: null,
        actionPlan: '',
        evidence: [],
        headline: `${source.name}: no change`,
        why: [],
      });
      continue;
    }

    const adapter = loadAdapter(source);
    let understanding = null;
    if (typeof adapter.understand === 'function') {
      try {
        understanding = await adapter.understand({ source, before: prevSnapshot, after: detection, root: ROOT });
      } catch (e) {
        understanding = { classification: { kind: 'error', breakingRisk: 'unknown' }, why: [`understand threw: ${e.message}`] };
      }
    }

    const record = {
      id: changeId(source.id, detectedAt),
      sourceId: source.id,
      detectedAt,
      changeType: prevSnapshot ? 'modified' : 'new',
      severity: understanding?.severity || 'medium',
      confidence: understanding?.confidence ?? 0.7,
      fingerprintBefore: before,
      fingerprintAfter: after,
      classification: understanding?.classification || { kind: 'content', breakingRisk: 'low' },
      impacts: (source.impacts || []).map(target => ({
        target,
        type: 'direct',
        reason: `declared in manifest.sources[${source.id}].impacts`,
        strength: 'medium',
      })),
      recommendation: normalizeRecommendation(understanding?.recommendation, source.defaultRecommendation),
      actionPlan: understanding?.actionPlan || '',
      evidence: understanding?.evidence || [],
      headline: understanding?.headline || `${source.name} changed`,
      why: understanding?.why || [],
    };

    expandImpacts(record, manifest.impactGraph);
    records.push(record);
  }
  return records;
}

function buildErrorRecord(source, errorMessage, detectedAt) {
  return {
    id: changeId(source.id, detectedAt),
    sourceId: source.id,
    detectedAt,
    changeType: 'modified',
    severity: 'low',
    confidence: 0,
    fingerprintBefore: {},
    fingerprintAfter: {},
    classification: { kind: 'error', breakingRisk: 'unknown' },
    impacts: [],
    recommendation: 'REJECT',
    actionPlan: 'Adapter errored — fix the adapter and re-run sync. No upstream action.',
    evidence: [{ type: 'error', excerpt: errorMessage }],
    headline: `${source.name}: adapter error`,
    why: [errorMessage],
  };
}

// Coerce an adapter recommendation (possibly legacy ADOPT/MERGE/LEVERAGE/SKIP/IGNORE
// from older code paths) into the canonical TAKE / REJECT pair.
function normalizeRecommendation(value, fallback) {
  const map = {
    TAKE: 'TAKE', REJECT: 'REJECT',
    // legacy mappings
    ADOPT: 'TAKE', MERGE: 'TAKE',
    LEVERAGE: 'REJECT', SKIP: 'REJECT', IGNORE: 'REJECT',
  };
  if (typeof value === 'string') {
    const upper = value.toUpperCase();
    if (map[upper]) return map[upper];
  }
  if (Array.isArray(value) && value.length > 0) {
    return normalizeRecommendation(value[0], fallback);
  }
  if (typeof fallback === 'string' && map[fallback.toUpperCase()]) {
    return map[fallback.toUpperCase()];
  }
  return 'REJECT';
}

// ── Run artifacts ────────────────────────────────────────────────────────────

function newRunId() {
  const d = new Date();
  const stamp = d.toISOString().replace(/[:.]/g, '').slice(0, 15);
  return `run_${stamp}_${crypto.randomBytes(2).toString('hex')}`;
}

function writeRunArtifacts(storage, runId, records, triageCards, persistSnapshots) {
  const runDir = path.join(storage.runs, runId);
  const changesDir = path.join(runDir, 'changes');
  fs.mkdirSync(changesDir, { recursive: true });

  for (const r of records) {
    fs.writeFileSync(path.join(changesDir, `${r.id}.json`), JSON.stringify(r, null, 2) + '\n');
  }
  fs.writeFileSync(
    path.join(runDir, 'triage.json'),
    JSON.stringify({ runId, generatedAt: new Date().toISOString(), cards: triageCards }, null, 2) + '\n'
  );

  // Maintain latest pointer
  const latest = path.join(storage.runs, 'latest');
  try { if (fs.existsSync(latest)) fs.rmSync(latest, { recursive: true, force: true }); } catch {}
  try {
    // Prefer junction on Windows; fallback to writing a pointer file.
    fs.symlinkSync(runDir, latest, 'junction');
  } catch {
    fs.writeFileSync(path.join(storage.runs, 'latest.txt'), runId + '\n');
  }

  if (persistSnapshots) {
    for (const r of records) {
      if (r.changeType === 'unchanged') continue;
      writeSnapshot(storage, r.sourceId, {
        sourceId: r.sourceId,
        observedAt: r.detectedAt,
        fingerprint: r.fingerprintAfter,
        lastChangeId: r.id,
      });
    }
  }
}

// ── Decisions (hash-chained JSONL, partitioned by source) ───────────────────

function decisionFilePath(storage, sourceId, runId) {
  const dir = path.join(storage.decisions, sourceId);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${runId}.jsonl`);
}

function lastDecisionHash(file) {
  if (!fs.existsSync(file)) return 'GENESIS';
  const content = fs.readFileSync(file, 'utf8').trim();
  if (!content) return 'GENESIS';
  const lines = content.split('\n');
  const last = JSON.parse(lines[lines.length - 1]);
  return last.entryHash || 'GENESIS';
}

function appendDecision(storage, decision) {
  const { changeId, sourceId, runId } = decision;
  const file = decisionFilePath(storage, sourceId, runId);
  const prevHash = lastDecisionHash(file);
  const ts = new Date().toISOString();
  const body = {
    changeId,
    sourceId,
    runId,
    decision: decision.decision,
    decidedBy: decision.decidedBy || process.env.USER || process.env.USERNAME || 'unknown',
    decidedAt: ts,
    rationale: decision.rationale || '',
    expiresAt: decision.expiresAt || null,
    prevHash,
  };
  const entryHash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const entry = { ...body, entryHash };
  fs.appendFileSync(file, JSON.stringify(entry) + '\n');
  return entry;
}

// ── MD view generation ──────────────────────────────────────────────────────

function writeMarkdownView(storage, runId, triageCards, records) {
  fs.mkdirSync(storage.views, { recursive: true });
  const p = path.join(storage.views, `${runId}.md`);
  const now = new Date().toISOString();

  const lines = [];
  lines.push(`# Sync Triage — ${runId}`);
  lines.push('');
  lines.push(`> Generated from \`tools/sync-orchestrator.js\` at ${now}.`);
  lines.push('> **This file is GENERATED. Edit decisions via \`node tools/sync-orchestrator.js decide ...\` not by hand.**');
  lines.push('> Source of truth: \`knowledge/sync/decisions/<source-id>/<runId>.jsonl\` (hash-chained).');
  lines.push('>');
  lines.push('> Pre-commit hook \`tools/git-hooks/pre-commit-sync-views\` verifies the integrity marker below.');
  lines.push('');
  lines.push(`## Summary — ${triageCards.length} change(s)`);
  lines.push('');
  lines.push('| Priority | Source | Status | Impact | Risk | Recommendation | Time |');
  lines.push('|---:|---|---|---|---|---|---|');
  const sorted = [...triageCards].sort((a, b) => b.priority - a.priority);
  for (const c of sorted) {
    lines.push(`| ${c.priority} | \`${c.sourceId}\` | ${c.status} | ${c.frameworkImpact} | ${c.breakingRisk} | **${c.recommendedDecision}** | ${c.timeToReview} |`);
  }
  lines.push('');
  lines.push('## Detail');
  lines.push('');
  for (const c of sorted) {
    const rec = records.find(r => r.id === c.changeId);
    lines.push(`### ${c.sourceId} — ${c.headline}`);
    lines.push('');
    lines.push(`- **ChangeId**: \`${c.changeId}\``);
    lines.push(`- **Priority**: ${c.priority}  ·  **Impact**: ${c.frameworkImpact}  ·  **Risk**: ${c.breakingRisk}`);
    lines.push(`- **ChangeClass**: ${c.changeClass}  ·  **Recommendation**: **${c.recommendedDecision}**`);
    if (c.why?.length > 0) {
      lines.push('- **Why**:');
      for (const w of c.why) lines.push(`  - ${w}`);
    }
    if (rec?.impacts?.length > 0) {
      lines.push('- **Impacts**:');
      for (const i of rec.impacts) lines.push(`  - \`${i.target}\` (${i.type}, ${i.strength || '—'}): ${i.reason}`);
    }
    if (rec?.evidence?.length > 0) {
      lines.push('- **Evidence**:');
      for (const ev of rec.evidence) lines.push(`  - ${ev.type}${ev.path ? ` · \`${ev.path}\`` : ''}${ev.ref ? ` · ${ev.ref}` : ''}`);
    }
    if (c.actionPlan) {
      lines.push('- **Action plan if TAKEN**:');
      for (const step of String(c.actionPlan).split('\n')) {
        if (step.trim()) lines.push(`  - ${step.trim()}`);
      }
    }
    lines.push('');
    lines.push('Decide with:');
    lines.push('```');
    lines.push(`node tools/sync-orchestrator.js decide ${c.changeId} take --reason "..." --confirm   # or: reject --reason "..."`);
    lines.push('```');
    lines.push('');
  }

  // Append content-hash integrity marker. Pre-commit hook verifies this matches
  // a re-hash of the body; hand-edits break the match and are rejected.
  const body = lines.join('\n');
  const integrityHash = crypto.createHash('sha256').update(body).digest('hex');
  const marker = `\n<!-- mcs-sync:generated:v1 sha256=${integrityHash} runId=${runId} -->\n`;
  fs.writeFileSync(p, body + marker);
  return p;
}

function verifyViewIntegrity(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const markerMatch = content.match(/\n<!-- mcs-sync:generated:v1 sha256=([a-f0-9]{64}) runId=([^\s]+) -->\n?$/);
  if (!markerMatch) {
    return { ok: false, reason: 'no integrity marker found — file is not a generated view or marker was stripped' };
  }
  const claimed = markerMatch[1];
  const runId = markerMatch[2];
  const body = content.slice(0, markerMatch.index);
  const actual = crypto.createHash('sha256').update(body).digest('hex');
  if (claimed !== actual) {
    return { ok: false, reason: `integrity hash mismatch (claimed=${claimed.slice(0,12)}, actual=${actual.slice(0,12)}) — likely hand-edited`, runId };
  }
  return { ok: true, runId, hash: actual };
}

// ── Console rendering ───────────────────────────────────────────────────────

function renderConsole(triageCards, runId, viewPath) {
  if (triageCards.length === 0) {
    console.log('[sync] No sources detected changes.');
    return;
  }
  const sorted = [...triageCards].sort((a, b) => b.priority - a.priority);
  console.log(`[sync] Run ${runId}`);
  console.log(`[sync] ${triageCards.length} change(s) detected. Triage top ${Math.min(10, sorted.length)}:`);
  console.log('');
  const header = ' #  Pri Source                 Status     Impact  Risk    Rec         Review';
  console.log(header);
  console.log('─'.repeat(header.length));
  for (const [i, c] of sorted.slice(0, 10).entries()) {
    const row = [
      String(i + 1).padStart(2),
      String(c.priority).padStart(3),
      c.sourceId.padEnd(22).slice(0, 22),
      c.status.padEnd(10).slice(0, 10),
      c.frameworkImpact.padEnd(7).slice(0, 7),
      c.breakingRisk.padEnd(7).slice(0, 7),
      c.recommendedDecision.padEnd(11).slice(0, 11),
      c.timeToReview,
    ].join(' ');
    console.log(' ' + row);
  }
  console.log('');
  console.log(`[sync] Full view: ${path.relative(ROOT, viewPath)}`);
  console.log('[sync] Decide with: node tools/sync-orchestrator.js decide <changeId> <take|reject> --reason "..." [--confirm]');
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { cmd: 'run', flags: {}, positional: [] };
  const args = argv.slice(2);
  if (args.length > 0 && !args[0].startsWith('-')) {
    out.cmd = args.shift();
  }
  while (args.length > 0) {
    const a = args.shift();
    if (a === '--source') out.flags.source = args.shift();
    else if (a === '--reason') out.flags.reason = args.shift();
    else if (a === '--run') out.flags.run = args.shift();
    else if (a === '--json') out.flags.json = true;
    else if (a === '--no-persist') out.flags.noPersist = true;
    else if (a === '--confirm') out.flags.confirm = true;
    else if (a === '--help' || a === '-h') out.flags.help = true;
    else out.positional.push(a);
  }
  return out;
}

async function cmdRun(args, manifest, storage, detectOnly) {
  const detectResults = await phaseDetect(manifest, storage, args.flags.source);
  const records = detectOnly
    ? detectResults.map(r => ({
        id: changeId(r.source.id, r.detectedAt),
        sourceId: r.source.id,
        detectedAt: r.detectedAt,
        changeType: 'detect-only',
        severity: 'none',
        confidence: 0,
        fingerprintBefore: r.prevSnapshot?.fingerprint || {},
        fingerprintAfter: r.detection?.fingerprint || {},
        classification: { kind: 'detect-only', breakingRisk: 'none' },
        impacts: [],
        recommendedActions: [],
        evidence: [],
        headline: r.source.name,
        why: r.detection?.error ? [r.detection.error] : [],
      }))
    : await phaseUnderstand(detectResults, manifest, storage);

  const pending = records.filter(r => r.changeType !== 'unchanged' && r.changeType !== 'detect-only');
  const cards = pending.map(r => triageCard(r, manifest.defaults?.priorityWeights));
  const runId = newRunId();
  writeRunArtifacts(storage, runId, records, cards, /*persistSnapshots*/ !detectOnly && !args.flags.noPersist);
  const viewPath = pending.length > 0 ? writeMarkdownView(storage, runId, cards, records) : null;

  if (args.flags.json) {
    console.log(JSON.stringify({ runId, cards, records }, null, 2));
  } else {
    renderConsole(cards, runId, viewPath || path.join(storage.views, 'none'));
  }
  return pending.length > 0 ? 1 : 0;
}

function cmdManifest(manifest) {
  console.log(JSON.stringify(manifest, null, 2));
  return 0;
}

function cmdReview(storage, args) {
  const runId = args.flags.run || readLatestRunId(storage);
  if (!runId) fail('No runs yet. Execute `node tools/sync-orchestrator.js` first.');
  const triagePath = path.join(storage.runs, runId, 'triage.json');
  if (!fs.existsSync(triagePath)) fail(`No triage.json for run ${runId}`);
  const triage = JSON.parse(fs.readFileSync(triagePath, 'utf8'));
  if (args.flags.json) {
    console.log(JSON.stringify(triage, null, 2));
  } else {
    const viewPath = path.join(storage.views, `${runId}.md`);
    renderConsole(triage.cards, runId, viewPath);
  }
  return 0;
}

function readLatestRunId(storage) {
  const ptr = path.join(storage.runs, 'latest.txt');
  if (fs.existsSync(ptr)) return fs.readFileSync(ptr, 'utf8').trim();
  const linkPath = path.join(storage.runs, 'latest');
  if (fs.existsSync(linkPath)) {
    try { return path.basename(fs.readlinkSync(linkPath)); } catch {}
  }
  // Fallback: newest run_ dir
  if (!fs.existsSync(storage.runs)) return null;
  const entries = fs.readdirSync(storage.runs)
    .filter(n => n.startsWith('run_'))
    .sort()
    .reverse();
  return entries[0] || null;
}

function cmdDecide(args, storage, manifest) {
  const [changeIdArg, decisionRaw] = args.positional;
  if (!changeIdArg || !decisionRaw) fail('Usage: decide <changeId> <take|reject> --reason "..." [--confirm]');
  const decision = decisionRaw.toUpperCase();
  if (!['TAKE', 'REJECT'].includes(decision)) {
    fail(`Unknown decision "${decisionRaw}". Use: take | reject`);
  }
  const found = findChangeRecord(storage, changeIdArg);
  if (!found) fail(`ChangeId ${changeIdArg} not found in any run.`);
  const runId = found.runId;
  const runDir = path.join(storage.runs, runId);
  const fullRecord = loadRecord(runDir, changeIdArg);
  if (!fullRecord) fail(`Record file missing for ${changeIdArg} in run ${runId}.`);

  // TAKE requires impact disclosure + confirmation. The orchestrator never
  // edits impacted artifacts itself; it prints the list and emits an action
  // plan markdown for the user to work through.
  if (decision === 'TAKE') {
    const impacted = collectImpactedArtifacts(fullRecord, manifest);
    console.log(`[sync] TAKE for ${changeIdArg} touches ${impacted.length} downstream artifact(s):`);
    for (const t of impacted) console.log(`  - ${t.target}  (${t.type}${t.strength ? ', ' + t.strength : ''}) — ${t.reason}`);
    if (fullRecord.actionPlan) {
      console.log('');
      console.log('[sync] Suggested action plan:');
      for (const step of String(fullRecord.actionPlan).split('\n')) {
        if (step.trim()) console.log(`  • ${step.trim()}`);
      }
    }
    if (!args.flags.confirm) {
      console.error('');
      console.error('[sync] Re-run with --confirm to record the decision.');
      console.error('[sync] Reject instead with: decide ' + changeIdArg + ' reject --reason "..."');
      return 2;
    }
  }

  const entry = appendDecision(storage, {
    changeId: found.changeId,
    sourceId: found.sourceId,
    runId,
    decision,
    rationale: args.flags.reason || '',
    impactedArtifacts: decision === 'TAKE' ? collectImpactedArtifacts(fullRecord, manifest).map(i => i.target) : [],
  });
  if (decision === 'TAKE') {
    writeActionPlan(storage, runId, fullRecord, collectImpactedArtifacts(fullRecord, manifest));
  }
  // Regenerate the view to show decision inline
  const triagePath = path.join(runDir, 'triage.json');
  if (fs.existsSync(triagePath)) {
    const triage = JSON.parse(fs.readFileSync(triagePath, 'utf8'));
    const records = (triage.cards || []).map(c => loadRecord(runDir, c.changeId)).filter(Boolean);
    writeMarkdownView(storage, runId, triage.cards, records);
  }
  console.log(`[sync] decision recorded: ${decision} for ${changeIdArg}`);
  console.log(`[sync] hash-chained entry: ${entry.entryHash.slice(0, 16)}...`);
  return 0;
}

function collectImpactedArtifacts(record, manifest) {
  const direct = (record.impacts || []).map(i => ({
    target: i.target,
    type: i.type || 'direct',
    strength: i.strength,
    reason: i.reason || 'declared impact',
  }));
  const seen = new Set(direct.map(d => d.target));
  const edges = (manifest?.impactGraph?.edges) || [];
  for (const e of edges) {
    if (seen.has(e.from) && !seen.has(e.to)) {
      direct.push({
        target: e.to,
        type: 'inferred',
        strength: e.strength,
        reason: `${e.from} → ${e.to} (${e.kind || 'depends'})`,
      });
      seen.add(e.to);
    }
  }
  return direct;
}

function writeActionPlan(storage, runId, record, impacts) {
  fs.mkdirSync(storage.views, { recursive: true });
  const p = path.join(storage.views, `${runId}-actions.md`);
  const exists = fs.existsSync(p);
  const lines = [];
  if (!exists) {
    lines.push(`# Action plan — ${runId}`);
    lines.push('');
    lines.push('> Generated when a sync change is TAKEN. Each entry is a manual checklist for the user. The orchestrator never edits these targets — read, decide, edit by hand, commit.');
    lines.push('');
  } else {
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  lines.push(`## ${record.id} — ${record.headline || record.sourceId}`);
  lines.push('');
  lines.push(`- **Source**: \`${record.sourceId}\``);
  lines.push(`- **Detected**: ${record.detectedAt}`);
  lines.push(`- **Change class**: ${record.classification?.kind || 'unknown'}`);
  lines.push('');
  if (record.actionPlan) {
    lines.push('### Recommended steps');
    lines.push('');
    for (const step of String(record.actionPlan).split('\n')) {
      if (step.trim()) lines.push(`- [ ] ${step.trim()}`);
    }
    lines.push('');
  }
  if (impacts.length > 0) {
    lines.push('### Impacted artifacts (review each)');
    lines.push('');
    for (const i of impacts) {
      lines.push(`- [ ] \`${i.target}\` — ${i.reason}${i.strength ? ` *(strength: ${i.strength})*` : ''}`);
    }
    lines.push('');
  }
  fs.appendFileSync(p, lines.join('\n'));
  return p;
}

function loadRecord(runDir, changeId) {
  const p = path.join(runDir, 'changes', `${changeId}.json`);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function findChangeRecord(storage, changeId) {
  if (!fs.existsSync(storage.runs)) return null;
  const runIds = fs.readdirSync(storage.runs)
    .filter(n => n.startsWith('run_'))
    .sort()
    .reverse();
  for (const runId of runIds) {
    const p = path.join(storage.runs, runId, 'changes', `${changeId}.json`);
    if (fs.existsSync(p)) {
      return { changeId, runId, sourceId: JSON.parse(fs.readFileSync(p, 'utf8')).sourceId };
    }
  }
  return null;
}

function fail(msg) {
  console.error(`[sync] ERROR: ${msg}`);
  process.exit(2);
}

function printHelp() {
  console.log(`Sync Orchestrator — detect -> understand -> decide

Commands:
  run                   (default) detect + understand, write triage bundle
  detect                Phase 1 only: fingerprint each source, skip classification
  review                Re-open last run's triage (--run <id> for a specific run)
  decide <id> <action>  Record a decision (take|reject) + --reason ["..."] [--confirm]
  manifest              Print loaded manifest
  verify-views [files]  Verify generated views haven't been hand-edited (pre-commit gate)
  help                  Show this message

Flags:
  --source <id>         Limit to one source by manifest id
  --run <id>            Use a specific runId (for review / decide inspection)
  --reason "..."        Rationale for decide (goes into the hash chain)
  --confirm             Required when decision = take (acknowledges the impact list)
  --no-persist          Run without updating snapshots (preview mode)
  --json                Emit JSON instead of prose
  --help                This message`);
}

function cmdVerifyViews(args, storage) {
  const files = args.positional.length > 0
    ? args.positional
    : (fs.existsSync(storage.views)
        ? fs.readdirSync(storage.views).filter(n => n.endsWith('.md')).map(n => path.join(storage.views, n))
        : []);
  if (files.length === 0) {
    if (!args.flags.json) console.log('[sync] no views to verify');
    return 0;
  }
  const failures = [];
  for (const f of files) {
    const abs = path.isAbsolute(f) ? f : path.resolve(ROOT, f);
    if (!fs.existsSync(abs)) {
      failures.push({ path: f, reason: 'file not found' });
      continue;
    }
    // -actions.md files are append-only checklists generated incrementally
    // on each TAKE decision; they don't carry a single integrity marker
    // because they grow over time. Their integrity is implicit via the
    // hash-chained decisions JSONL that drives them. Skip the integrity check.
    if (/-actions\.md$/i.test(abs)) continue;
    const result = verifyViewIntegrity(abs);
    if (!result.ok) {
      failures.push({ path: path.relative(ROOT, abs), reason: result.reason, runId: result.runId });
    }
  }
  if (args.flags.json) {
    console.log(JSON.stringify({ checked: files.length, failures }, null, 2));
  } else if (failures.length === 0) {
    console.log(`[sync] verified ${files.length} view file(s) — all integrity hashes match`);
  } else {
    console.error(`[sync] INTEGRITY FAIL — ${failures.length}/${files.length} view file(s) have been modified:`);
    for (const f of failures) {
      console.error(`  - ${f.path}: ${f.reason}`);
    }
    console.error('');
    console.error('[sync] Views are GENERATED artifacts. Never hand-edit them.');
    console.error('[sync] To change a decision, use: node tools/sync-orchestrator.js decide <changeId> <action> --reason "..."');
    console.error('[sync] To regenerate after a decision: the decide command regenerates automatically.');
    console.error('[sync] To bypass (not recommended): MCS_SYNC_SKIP_VIEW_CHECK=1');
  }
  return failures.length > 0 ? 1 : 0;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.flags.help || args.cmd === 'help') { printHelp(); process.exit(0); }

  const manifest = loadManifest();
  const storage = resolveStorage(manifest);

  try {
    let code = 0;
    switch (args.cmd) {
      case 'run':          code = await cmdRun(args, manifest, storage, /*detectOnly*/ false); break;
      case 'detect':       code = await cmdRun(args, manifest, storage, /*detectOnly*/ true); break;
      case 'review':       code = cmdReview(storage, args); break;
      case 'decide':       code = cmdDecide(args, storage, manifest); break;
      case 'manifest':     code = cmdManifest(manifest); break;
      case 'verify-views': code = cmdVerifyViews(args, storage); break;
      default: fail(`Unknown command: ${args.cmd}. Try --help`);
    }
    process.exit(code);
  } catch (e) {
    fail(e.stack || e.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  loadManifest,
  resolveStorage,
  phaseDetect,
  phaseUnderstand,
  triageCard,
  priorityScore,
  appendDecision,
  writeMarkdownView,
  verifyViewIntegrity,
};
