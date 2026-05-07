/**
 * eval-guide adapter
 *
 * Detects updates to the microsoft/eval-guide Claude Code plugin.
 *
 * Authoritative source: ~/.claude/plugins/installed_plugins.json which records
 * {version, gitCommitSha, lastUpdated} written by the Claude plugin manager on
 * install/update. Optionally cross-references github.com/microsoft/eval-guide
 * HEAD via `gh api` to detect when a marketplace update is available.
 *
 * NOT used: scraping files from ~/.claude/plugins/cache/<plugin>/ — that folder
 * is per-user local state and per GPT challenge review would make sync non-
 * reproducible. We read only the structured installed_plugins.json.
 *
 * Fingerprint shape:
 *   primary:   installed_plugins.json gitCommitSha (or 'unknown' + 'version')
 *   secondary: optional remote HEAD SHA from github.com/microsoft/eval-guide
 *   version:   plugin version string
 *   timestamp: installed_plugins.json lastUpdated
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const PLUGIN_KEY = 'eval-guide@eval-guide';

function installedPluginsPath() {
  return path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
}

function readInstalled() {
  const p = installedPluginsPath();
  if (!fs.existsSync(p)) return { error: `installed_plugins.json missing at ${p}` };
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    const entries = data?.plugins?.[PLUGIN_KEY];
    if (!entries || entries.length === 0) return { error: `plugin ${PLUGIN_KEY} not installed` };
    return { entry: entries[0] };
  } catch (e) {
    return { error: `cannot parse installed_plugins.json: ${e.message}` };
  }
}

function ghRemoteHead() {
  try {
    const stdout = execFileSync('gh', ['api', 'repos/microsoft/eval-guide/commits/main', '--jq', '.sha', '--cache', '300s'], {
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

async function detect({ source, root }) {
  const installed = readInstalled();
  if (installed.error) return { error: installed.error };

  const entry = installed.entry;
  const localSha = entry.gitCommitSha || null;
  const remoteSha = ghRemoteHead();

  const primary = localSha || `version:${entry.version || 'unknown'}`;
  const secondary = remoteSha || 'remote-unknown';

  return {
    fingerprint: {
      primary,
      secondary,
      version: entry.version || 'unknown',
      timestamp: entry.lastUpdated || entry.installedAt || new Date().toISOString(),
    },
    meta: {
      installed: {
        version: entry.version,
        sha: localSha ? localSha.slice(0, 8) : null,
        lastUpdated: entry.lastUpdated,
      },
      remote: {
        sha: remoteSha ? remoteSha.slice(0, 8) : null,
      },
      ahead: remoteSha && localSha && remoteSha !== localSha,
    },
  };
}

async function understand({ source, before, after, root }) {
  const prevLocal = before?.fingerprint?.primary;
  const currLocal = after?.fingerprint?.primary;
  const prevRemote = before?.fingerprint?.secondary;
  const currRemote = after?.fingerprint?.secondary;

  const localChanged = prevLocal !== currLocal;
  const remoteAhead = after?.meta?.ahead === true;

  const signals = [];
  const evidence = [];
  let severity = 'low';
  let breakingRisk = 'low';
  let novelty = 'incremental';
  let recommendation = 'REJECT';
  const planSteps = [];

  if (localChanged) {
    signals.push(`installed plugin updated: ${String(prevLocal).slice(0, 10)} -> ${String(currLocal).slice(0, 10)}`);
    severity = 'medium';
    breakingRisk = 'medium';
    recommendation = 'TAKE';
    planSteps.push('Re-read /eval-suite-planner, /eval-generator, /eval-result-interpreter, /eval-triage-and-improvement docs in the plugin to learn what changed.');
    planSteps.push('Update .claude/skills/mcs-research, mcs-eval, mcs-fix references that depend on the plugin if behavior shifted.');
    planSteps.push('Re-run a recent eval suite to confirm scoring still produces stable verdicts.');
    evidence.push({
      type: 'plugin_update',
      excerpt: `version=${after?.fingerprint?.version} sha=${String(currLocal).slice(0, 8)}`,
    });
  }

  if (remoteAhead) {
    signals.push('upstream eval-guide has newer commits than the installed plugin');
    signals.push('run `claude plugin update eval-guide@eval-guide` to pull');
    if (!localChanged) {
      recommendation = 'TAKE';
      planSteps.push('Run `claude plugin update eval-guide@eval-guide` to pull the newer commits.');
      planSteps.push('Re-run sync afterward to verify the installed sha matches remote.');
    }
    evidence.push({
      type: 'remote_ahead',
      ref: `github.com/microsoft/eval-guide@${String(currRemote).slice(0, 8)}`,
    });
  }

  if (!localChanged && !remoteAhead && prevLocal && prevLocal === currLocal) {
    signals.push('eval-guide plugin up to date (installed matches remote)');
    recommendation = 'REJECT';
    planSteps.length = 0;
  }

  if (String(currLocal).startsWith('version:')) {
    signals.push('no gitCommitSha in installed_plugins.json — fingerprint is version-only (less precise)');
    novelty = 'unverifiable';
  }

  return {
    severity,
    confidence: String(currLocal).startsWith('version:') ? 0.5 : 0.9,
    classification: {
      kind: 'dependency',
      subkind: 'claude_plugin_drift',
      breakingRisk,
      novelty,
    },
    recommendation,
    actionPlan: planSteps.length > 0 ? planSteps.join('\n') : 'No action needed.',
    evidence,
    headline: buildHeadline({ localChanged, remoteAhead }),
    why: signals,
  };
}

function buildHeadline({ localChanged, remoteAhead }) {
  if (localChanged && remoteAhead) return 'eval-guide plugin updated AND remote still ahead';
  if (localChanged) return 'eval-guide plugin updated';
  if (remoteAhead) return 'eval-guide plugin update available upstream';
  return 'eval-guide: no change';
}

module.exports = { detect, understand };
