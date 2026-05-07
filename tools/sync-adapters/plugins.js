/**
 * plugins adapter
 *
 * Detects updates to installed Claude Code plugins, excluding eval-guide
 * (handled by tools/sync-adapters/eval-guide.js). Reads
 * ~/.claude/plugins/installed_plugins.json which records {version,
 * gitCommitSha, lastUpdated} per plugin per marketplace.
 *
 * Fingerprint shape:
 *   primary:   sha256 of sorted "<key>:<sha-or-version>" lines
 *   secondary: JSON {pluginKey -> sha-or-version}
 *   version:   "<count> plugins"
 *   timestamp: max(lastUpdated) ISO across plugins
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { sha256 } = require('../lib/ids');

const SKIP_KEYS = new Set(['eval-guide@eval-guide']); // handled by eval-guide adapter

function installedPath() {
  return path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
}

function readInstalled() {
  const p = installedPath();
  if (!fs.existsSync(p)) return { error: `installed_plugins.json missing at ${p}` };
  try {
    return { data: JSON.parse(fs.readFileSync(p, 'utf8')) };
  } catch (e) {
    return { error: `cannot parse installed_plugins.json: ${e.message}` };
  }
}

function flatten(data) {
  const flat = {};
  const plugins = data?.plugins || {};
  for (const key of Object.keys(plugins)) {
    if (SKIP_KEYS.has(key)) continue;
    const entries = plugins[key];
    if (!entries || entries.length === 0) continue;
    const e = entries[0];
    flat[key] = {
      version: e.version || null,
      gitCommitSha: e.gitCommitSha || null,
      lastUpdated: e.lastUpdated || e.installedAt || null,
    };
  }
  return flat;
}

async function detect({ source, root }) {
  const installed = readInstalled();
  if (installed.error) return { error: installed.error };

  const flat = flatten(installed.data);
  const keys = Object.keys(flat).sort();
  if (keys.length === 0) return { error: 'no plugins installed (after excluding eval-guide)' };

  const perKey = {};
  let newestTs = null;
  for (const key of keys) {
    const stamp = flat[key].gitCommitSha || `version:${flat[key].version || 'unknown'}`;
    perKey[key] = stamp;
    if (flat[key].lastUpdated && (!newestTs || flat[key].lastUpdated > newestTs)) {
      newestTs = flat[key].lastUpdated;
    }
  }
  const lines = keys.map(k => `${k}:${perKey[k]}`);
  return {
    fingerprint: {
      primary: sha256(lines.join('\n')),
      secondary: JSON.stringify(perKey),
      version: `${keys.length} plugins`,
      timestamp: newestTs || new Date().toISOString(),
    },
    meta: { count: keys.length, names: keys },
  };
}

async function understand({ source, before, after, root }) {
  const bMap = safeParse(before?.fingerprint?.secondary) || {};
  const aMap = safeParse(after?.fingerprint?.secondary) || {};

  const updated = [];
  const added = [];
  const removed = [];

  for (const key of Object.keys(aMap)) {
    if (!(key in bMap)) added.push(key);
    else if (bMap[key] !== aMap[key]) updated.push(key);
  }
  for (const key of Object.keys(bMap)) {
    if (!(key in aMap)) removed.push(key);
  }

  const meaningful = updated.length > 0 || added.length > 0 || removed.length > 0;
  const evidence = [];
  for (const k of updated.slice(0, 5)) evidence.push({ type: 'plugin_updated', ref: k, excerpt: `${String(bMap[k]).slice(0, 12)} -> ${String(aMap[k]).slice(0, 12)}` });
  for (const k of added.slice(0, 5)) evidence.push({ type: 'plugin_added', ref: k });
  for (const k of removed.slice(0, 5)) evidence.push({ type: 'plugin_removed', ref: k });

  let recommendation = 'REJECT';
  const planSteps = [];
  if (meaningful) {
    recommendation = 'TAKE';
    if (updated.length > 0) {
      planSteps.push(`Re-read documentation for updated plugin(s): ${updated.join(', ')}`);
      planSteps.push('Update CLAUDE.md plugin table if behavior, slash commands, or routing changed.');
    }
    if (added.length > 0) {
      planSteps.push(`Document newly installed plugin(s): ${added.join(', ')}. Add routing rules to CLAUDE.md.`);
    }
    if (removed.length > 0) {
      planSteps.push(`Remove references to uninstalled plugin(s): ${removed.join(', ')}.`);
    }
    planSteps.push('Re-run sync to clear the card after edits.');
  } else {
    planSteps.push('No plugin drift.');
  }

  return {
    severity: meaningful ? 'low' : 'none',
    confidence: 0.9,
    classification: {
      kind: 'dependency',
      subkind: 'claude_plugin_drift',
      breakingRisk: removed.length > 0 ? 'medium' : 'low',
      novelty: added.length > 0 ? 'new_content' : 'incremental',
    },
    recommendation,
    actionPlan: planSteps.join('\n'),
    evidence,
    headline: buildHeadline({ updated, added, removed }),
    why: [`updated=${updated.length}, added=${added.length}, removed=${removed.length}`],
  };
}

function buildHeadline({ updated, added, removed }) {
  const parts = [];
  if (updated.length > 0) parts.push(`${updated.length} updated`);
  if (added.length > 0) parts.push(`${added.length} added`);
  if (removed.length > 0) parts.push(`${removed.length} removed`);
  return `Plugins: ${parts.join(', ') || 'unchanged'}`;
}

function safeParse(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

module.exports = { detect, understand };
