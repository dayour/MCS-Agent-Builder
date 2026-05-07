/**
 * mcp-servers adapter (STATIC config fingerprint — no subprocess spawning)
 *
 * Hashes the normalized mcpServers block from .claude/settings.json. Does NOT
 * spawn stdio servers or run `npx @latest` probes — per GPT security review
 * that would turn routine detection into arbitrary code execution and make
 * results non-deterministic (different devs get different pulled versions).
 *
 * Normalization applied:
 *   - Keys lowercased, sorted
 *   - Env values stripped — only env KEY names retained (no secrets in hash)
 *   - Arrays preserved in original order (argument order matters)
 *   - Whitespace collapsed
 *
 * Unverifiable detection:
 *   - `npx @latest` in args is flagged as novelty='unverifiable' because the
 *     effective code changes behind a stable config.
 *   - `@latest` or missing version pin in HTTP URL path similarly flagged.
 *
 * Fingerprint shape:
 *   primary:   sha256 of canonicalized mcpServers JSON (keys sorted, values normalized)
 *   secondary: JSON {serverName -> per-server hash} for diff granularity
 *   version:   count of pinned vs unpinned servers
 *   timestamp: settings.json mtime
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { sha256 } = require('../lib/ids');

function settingsPath(root) {
  return path.join(root, '.claude', 'settings.json');
}

function normalizeServerConfig(config) {
  const out = {};
  const type = (config.type || 'stdio').toLowerCase();
  out.type = type;

  if (type === 'http') {
    out.url = config.url || null;
  } else {
    out.command = config.command || null;
    out.args = Array.isArray(config.args) ? config.args.map(a => String(a)) : [];
  }

  if (config.cwd) out.cwd = config.cwd;

  if (config.env && typeof config.env === 'object') {
    out.envKeys = Object.keys(config.env).sort();
  } else {
    out.envKeys = [];
  }

  return out;
}

function isUnverifiable(server) {
  if (server.type === 'http') {
    const url = server.url || '';
    if (/@latest\b/.test(url)) return 'http url uses @latest';
    return null;
  }
  const args = server.args || [];
  for (const a of args) {
    if (/@latest\b/.test(a)) return `args contain @latest: ${a}`;
  }
  if ((server.command || '').toLowerCase() === 'npx' && !args.some(a => /@\d/.test(a))) {
    return 'npx with no pinned version';
  }
  return null;
}

function extractPackageRef(server) {
  if (server.type === 'http') return server.url || 'http://unknown';
  const args = server.args || [];
  for (const a of args) {
    if (/^@?[\w/-]+@[\w.\-]+/.test(a)) return a;
    if (/^[\w/-]+\.js$/.test(a)) return a;
  }
  return `${server.command || ''} ${args.slice(0, 2).join(' ')}`.trim();
}

function readMcpServers(root) {
  const p = settingsPath(root);
  if (!fs.existsSync(p)) return { error: `settings.json missing at ${p}` };
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    const servers = data.mcpServers || {};
    const mtime = fs.statSync(p).mtimeMs;
    return { servers, mtime };
  } catch (e) {
    return { error: `cannot parse settings.json: ${e.message}` };
  }
}

async function detect({ source, root }) {
  const read = readMcpServers(root);
  if (read.error) return { error: read.error };

  const names = Object.keys(read.servers).sort();
  if (names.length === 0) return { error: 'no mcpServers configured in .claude/settings.json' };

  const perServer = {};
  const unverifiableCount = { total: 0, byName: {} };

  for (const name of names) {
    const normalized = normalizeServerConfig(read.servers[name]);
    const canonicalJson = JSON.stringify(normalized, Object.keys(normalized).sort());
    const hash = sha256(canonicalJson);
    perServer[name] = hash;
    const unv = isUnverifiable(normalized);
    if (unv) {
      unverifiableCount.total++;
      unverifiableCount.byName[name] = unv;
    }
  }

  const overall = sha256(names.map(n => `${n}:${perServer[n]}`).join('\n'));
  const versionTag = `${names.length} servers, ${unverifiableCount.total} unpinned`;

  return {
    fingerprint: {
      primary: overall,
      secondary: JSON.stringify(perServer),
      version: versionTag,
      timestamp: new Date(read.mtime).toISOString(),
    },
    meta: {
      servers: names,
      unverifiable: unverifiableCount,
    },
  };
}

async function understand({ source, before, after, root }) {
  const bMap = safeParse(before?.fingerprint?.secondary) || {};
  const aMap = safeParse(after?.fingerprint?.secondary) || {};

  const read = readMcpServers(root);
  const changedServers = [];
  const addedServers = [];
  const removedServers = [];
  const unverifiable = after?.meta?.unverifiable?.byName || {};

  for (const name of Object.keys(aMap)) {
    if (!(name in bMap)) addedServers.push(name);
    else if (bMap[name] !== aMap[name]) changedServers.push(name);
  }
  for (const name of Object.keys(bMap)) {
    if (!(name in aMap)) removedServers.push(name);
  }

  const signals = [];
  const evidence = [];
  let severity = 'low';
  let breakingRisk = 'low';
  let novelty = 'incremental';

  if (addedServers.length > 0) {
    signals.push(`new MCP server(s): ${addedServers.join(', ')}`);
    severity = 'medium';
    novelty = 'new_content';
  }
  if (removedServers.length > 0) {
    signals.push(`removed MCP server(s): ${removedServers.join(', ')}`);
    severity = 'medium';
    breakingRisk = 'medium';
  }
  if (changedServers.length > 0) {
    signals.push(`modified MCP server(s): ${changedServers.join(', ')}`);
    if (severity === 'low') severity = 'low';
  }

  for (const name of changedServers.concat(addedServers).slice(0, 6)) {
    const norm = read.servers ? normalizeServerConfig(read.servers[name] || {}) : {};
    evidence.push({
      type: 'mcp_server_change',
      excerpt: `${name}: ${extractPackageRef(norm)}${unverifiable[name] ? ` [UNVERIFIABLE: ${unverifiable[name]}]` : ''}`,
    });
  }

  const unverifiableHits = Object.keys(unverifiable);
  if (unverifiableHits.length > 0) {
    signals.push(`${unverifiableHits.length} server(s) have unpinned versions (behavior may drift silently): ${unverifiableHits.slice(0, 3).join(', ')}`);
    if (novelty !== 'new_content') novelty = 'unverifiable';
    evidence.push({
      type: 'unverifiable_warning',
      excerpt: Object.entries(unverifiable).slice(0, 4).map(([n, r]) => `${n}: ${r}`).join('; '),
    });
  }

  const { recommendation, actionPlan } = recommend({ addedServers, removedServers, changedServers, unverifiableHits });

  return {
    severity,
    confidence: 0.9,
    classification: {
      kind: 'dependency',
      subkind: 'mcp_config_drift',
      breakingRisk,
      novelty,
    },
    recommendation,
    actionPlan,
    evidence,
    headline: buildHeadline({ addedServers, removedServers, changedServers }),
    why: signals.length > 0 ? signals : ['mcpServers config hash differs from prior snapshot'],
  };
}

function recommend({ addedServers, removedServers, changedServers, unverifiableHits }) {
  const meaningful = addedServers.length > 0 || removedServers.length > 0 || changedServers.length > 0;
  if (!meaningful && unverifiableHits.length === 0) {
    return { recommendation: 'REJECT', actionPlan: 'No MCP server configuration drift.' };
  }
  const steps = [];
  if (addedServers.length > 0) steps.push(`Document new MCP server(s) in CLAUDE.md plugin table: ${addedServers.join(', ')}`);
  if (removedServers.length > 0) steps.push(`Remove references to gone server(s): ${removedServers.join(', ')}`);
  if (changedServers.length > 0) steps.push(`Validate skills still bind to changed server(s): ${changedServers.join(', ')}`);
  if (unverifiableHits.length > 0) steps.push(`Pin unstable @latest references where reproducibility matters (${unverifiableHits.length} server(s)).`);
  steps.push('Re-run sync to clear the card after edits.');
  return { recommendation: 'TAKE', actionPlan: steps.join('\n') };
}

function buildHeadline({ addedServers, removedServers, changedServers }) {
  const parts = [];
  if (addedServers.length > 0) parts.push(`+${addedServers.length} added`);
  if (removedServers.length > 0) parts.push(`-${removedServers.length} removed`);
  if (changedServers.length > 0) parts.push(`~${changedServers.length} modified`);
  return `MCP servers: ${parts.join(', ') || 'config changed'}`;
}

function safeParse(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

module.exports = { detect, understand };
