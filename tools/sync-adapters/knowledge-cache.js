/**
 * knowledge-cache adapter
 *
 * Detects drift in knowledge/cache/*.md cheat sheets by hashing normalized
 * markdown (frontmatter dates stripped, whitespace collapsed, lowercased).
 * Per-file hashes go into the secondary fingerprint so understand() can tell
 * which files changed and why.
 *
 * Fingerprint shape:
 *   primary:   sha256 of the sorted per-file hash list — one rollup for detect
 *   secondary: JSON {filename -> sha256} — used by understand() to diff
 *   version:   max(last_verified: date) across all files — semantic "age"
 *   timestamp: ISO of newest mtime — used for priority staleness scoring
 *
 * classification.kind is always 'content' because these are knowledge docs;
 * we never auto-sync them, we only summarize what drifted so a human can
 * decide MERGE (fold new rows into our cache) vs LEVERAGE (note for future
 * research) vs SKIP.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { sha256 } = require('../lib/ids');

const TIER1 = new Set([
  'triggers.md', 'models.md', 'mcp-servers.md', 'connectors.md',
  'knowledge-sources.md', 'channels.md', 'first-party-agents.md', 'declarative-agents.md',
]);

function normalize(md) {
  return md
    .replace(/^---[\s\S]*?---\s*/m, (block) => block.replace(/last_verified:\s*\S+/g, 'last_verified: <redacted>'))
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .toLowerCase();
}

function extractLastVerified(content) {
  const m = content.match(/last_verified:\s*(\d{4}-\d{2}-\d{2})/i);
  return m ? m[1] : null;
}

function extractSources(content) {
  const m = content.match(/^sources:\s*([\s\S]*?)(?=^\S|\Z)/m);
  if (!m) return [];
  return m[1].split(/\n\s*-\s*/).map(s => s.trim()).filter(Boolean);
}

function enumerateFiles(root, source) {
  const dir = path.join(root, source.locator.root);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => name.endsWith('.md'))
    .sort();
}

function readFileInfo(root, source, name) {
  const abs = path.join(root, source.locator.root, name);
  const raw = fs.readFileSync(abs, 'utf8');
  const norm = normalize(raw);
  return {
    name,
    abs,
    hash: sha256(norm),
    lastVerified: extractLastVerified(raw),
    sources: extractSources(raw),
    mtime: fs.statSync(abs).mtimeMs,
    byteLength: raw.length,
    lineCount: raw.split('\n').length,
  };
}

async function detect({ source, root }) {
  const files = enumerateFiles(root, source);
  if (files.length === 0) {
    return { error: `no files found at ${source.locator.root}` };
  }
  const perFile = {};
  let newestMtime = 0;
  const verifiedDates = [];
  for (const name of files) {
    const info = readFileInfo(root, source, name);
    perFile[name] = info.hash;
    if (info.mtime > newestMtime) newestMtime = info.mtime;
    if (info.lastVerified) verifiedDates.push(info.lastVerified);
  }
  const sortedHashes = Object.keys(perFile).sort().map(k => `${k}:${perFile[k]}`).join('\n');
  const primary = sha256(sortedHashes);
  const oldestVerified = verifiedDates.sort()[0] || null;

  return {
    fingerprint: {
      primary,
      secondary: JSON.stringify(perFile),
      version: oldestVerified,
      timestamp: new Date(newestMtime).toISOString(),
    },
    meta: {
      fileCount: files.length,
      tier1Count: files.filter(f => TIER1.has(f)).length,
      oldestVerified,
    },
  };
}

async function understand({ source, before, after, root }) {
  const bMap = safeParse(before?.fingerprint?.secondary) || {};
  const aMap = safeParse(after?.fingerprint?.secondary) || {};
  const changedFiles = [];
  const newFiles = [];
  const removedFiles = [];

  for (const name of Object.keys(aMap)) {
    if (!(name in bMap)) newFiles.push(name);
    else if (bMap[name] !== aMap[name]) changedFiles.push(name);
  }
  for (const name of Object.keys(bMap)) {
    if (!(name in aMap)) removedFiles.push(name);
  }

  const tier1Changed = changedFiles.filter(n => TIER1.has(n));
  const signals = [];
  const evidence = [];
  let severity = 'low';
  let breakingRisk = 'low';

  if (tier1Changed.length > 0) {
    severity = 'medium';
    signals.push(`${tier1Changed.length} Tier 1 cheat sheet(s) changed: ${tier1Changed.slice(0, 4).join(', ')}${tier1Changed.length > 4 ? ', ...' : ''}`);
  }
  if (newFiles.length > 0) signals.push(`new file(s): ${newFiles.join(', ')}`);
  if (removedFiles.length > 0) {
    signals.push(`removed file(s): ${removedFiles.join(', ')}`);
    breakingRisk = 'medium';
  }

  const detailed = [];
  for (const name of changedFiles.slice(0, 6)) {
    const diff = summarizeFileDiff(root, source, name);
    detailed.push({ name, ...diff });
    evidence.push({
      type: 'file_diff_summary',
      path: path.join(source.locator.root, name).replace(/\\/g, '/'),
      excerpt: diff.summary,
    });
    if (diff.breakingSignal) breakingRisk = 'medium';
  }
  if (changedFiles.length > 6) {
    evidence.push({ type: 'note', excerpt: `...and ${changedFiles.length - 6} more changed file(s)` });
  }

  const { recommendation, actionPlan } = recommend({
    tier1Changed,
    newFiles,
    removedFiles,
    changedFiles,
    breakingRisk,
  });

  const headline = buildHeadline({ newFiles, changedFiles, removedFiles, tier1Changed });

  return {
    severity,
    confidence: 0.85,
    classification: {
      kind: 'content',
      subkind: tier1Changed.length > 0 ? 'tier1_knowledge_drift' : 'knowledge_drift',
      breakingRisk,
      novelty: newFiles.length > 0 ? 'new_content' : 'incremental',
    },
    recommendation,
    actionPlan,
    evidence,
    headline,
    why: signals.length > 0 ? signals : [`${changedFiles.length} file(s) changed (hashes differ)`],
  };
}

function summarizeFileDiff(root, source, name) {
  const abs = path.join(root, source.locator.root, name);
  const info = readFileInfo(root, source, name);
  const lv = info.lastVerified;
  const staleDays = lv ? Math.max(0, Math.floor((Date.now() - new Date(lv).getTime()) / 86400000)) : null;
  let summary = `last_verified=${lv || 'unset'}`;
  if (staleDays !== null) summary += ` (${staleDays}d ago)`;
  summary += `, ${info.lineCount} lines, ${info.byteLength} bytes`;
  const breakingSignal = /deprecated|removed|breaking/i.test(fs.readFileSync(abs, 'utf8'));
  return { summary, breakingSignal, lastVerified: lv, staleDays };
}

function recommend({ tier1Changed, newFiles, removedFiles, changedFiles, breakingRisk }) {
  const meaningful = tier1Changed.length > 0 || newFiles.length > 0 || removedFiles.length > 0;
  if (meaningful) {
    const steps = [];
    if (tier1Changed.length > 0) steps.push(`Review changed Tier 1 files: ${tier1Changed.join(', ')}`);
    if (newFiles.length > 0) steps.push(`Inspect new file(s) and integrate: ${newFiles.join(', ')}`);
    if (removedFiles.length > 0) steps.push(`Remove or migrate references to deleted file(s): ${removedFiles.join(', ')}`);
    if (breakingRisk === 'medium' || breakingRisk === 'high') steps.push('Scan for `deprecated` / `removed` / `breaking` markers and reflect in skills/cache.');
    steps.push('Run `node tools/sync-orchestrator.js run --source knowledge-cache` after edits to clear the card.');
    return { recommendation: 'TAKE', actionPlan: steps.join('\n') };
  }
  if (changedFiles.length > 0) {
    return { recommendation: 'REJECT', actionPlan: `Cosmetic-only diff in ${changedFiles.length} file(s); no Tier 1 impact. Reject.` };
  }
  return { recommendation: 'REJECT', actionPlan: 'No meaningful change detected.' };
}

function buildHeadline({ newFiles, changedFiles, removedFiles, tier1Changed }) {
  const parts = [];
  if (tier1Changed.length > 0) parts.push(`${tier1Changed.length} Tier 1`);
  if (changedFiles.length > 0) parts.push(`${changedFiles.length} modified`);
  if (newFiles.length > 0) parts.push(`${newFiles.length} new`);
  if (removedFiles.length > 0) parts.push(`${removedFiles.length} removed`);
  return `Knowledge cache drift: ${parts.join(', ') || 'minor'}`;
}

function safeParse(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

module.exports = { detect, understand };
