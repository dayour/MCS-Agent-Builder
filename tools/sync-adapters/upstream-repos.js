/**
 * upstream-repos adapter
 *
 * Wraps tools/upstream-check.js --json to detect commit drift across all
 * tracked GitHub repos in knowledge/upstream-repos.json.
 *
 * Fingerprint shape:
 *   primary:   sha256 of sorted "<repo>:<lastCommitSha>" lines
 *   secondary: JSON {repo -> lastCommitSha}
 *   version:   tracking file's lastFullCheck ISO
 *   timestamp: max(lastChecked) ISO across repos
 *
 * One aggregate ChangeRecord with per-repo evidence entries, preserving
 * granularity for debugging while keeping triage surface single-card.
 * Returns `{ error }` when `gh auth` fails so other sources keep running.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { sha256 } = require('../lib/ids');

function runJson(cmd, args, opts = {}) {
  const stdout = execFileSync(cmd, args, {
    encoding: 'utf8',
    timeout: 60000,
    stdio: ['pipe', 'pipe', 'pipe'],
    ...opts,
  });
  return JSON.parse(stdout);
}

function readTracking(root) {
  const p = path.join(root, 'knowledge', 'upstream-repos.json');
  if (!fs.existsSync(p)) throw new Error(`tracking file missing at ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function computeFingerprint(tracking) {
  const repos = (tracking.repos || []).slice().sort((a, b) => a.repo.localeCompare(b.repo));
  const perRepo = {};
  const lines = [];
  let maxChecked = null;
  for (const r of repos) {
    const sha = r.lastCommitSha || 'NONE';
    perRepo[r.repo] = sha;
    lines.push(`${r.repo}:${sha}`);
    if (r.lastChecked && (!maxChecked || r.lastChecked > maxChecked)) {
      maxChecked = r.lastChecked;
    }
  }
  return {
    primary: sha256(lines.join('\n')),
    secondary: JSON.stringify(perRepo),
    version: tracking.lastFullCheck || null,
    timestamp: maxChecked ? new Date(maxChecked).toISOString() : new Date().toISOString(),
  };
}

async function detect({ source, root }) {
  try {
    const tracking = readTracking(root);
    return { fingerprint: computeFingerprint(tracking) };
  } catch (e) {
    return { error: e.message };
  }
}

async function understand({ source, before, after, root }) {
  const bMap = safeParse(before?.fingerprint?.secondary) || {};
  const aMap = safeParse(after?.fingerprint?.secondary) || {};

  const checkScript = path.join(root, 'tools', 'upstream-check.js');
  let checkResult = null;
  let probeError = null;
  try {
    const stdout = execFileSync(process.execPath, [checkScript, '--json'], {
      encoding: 'utf8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    checkResult = JSON.parse(stdout);
  } catch (e) {
    // upstream-check.js exits 1 when changes are detected (informational, not error).
    // stdout is still present on the error object — try to parse it before giving up.
    const stdout = e.stdout ? String(e.stdout) : '';
    if (stdout.trim().startsWith('{')) {
      try { checkResult = JSON.parse(stdout); }
      catch { probeError = e.stderr ? String(e.stderr).trim() : e.message; }
    } else {
      probeError = e.stderr ? String(e.stderr).trim() : e.message;
    }
  }

  const perRepo = [];
  const changedRepos = [];
  const errorRepos = [];
  const watchedHitRepos = [];

  if (checkResult?.results) {
    for (const r of checkResult.results) {
      const entry = {
        repo: r.repo,
        status: r.status,
        newCommits: (r.commits || []).length,
        hasRelevantChanges: !!r.hasRelevantChanges,
      };
      perRepo.push(entry);
      if (r.status === 'error') errorRepos.push(r.repo);
      if (r.hasChanges) changedRepos.push(r.repo);
      if (r.hasRelevantChanges) watchedHitRepos.push(r.repo);
    }
  } else {
    // Fall back to diff of stored shas if upstream-check unavailable
    for (const repo of Object.keys(aMap)) {
      if (bMap[repo] && bMap[repo] !== aMap[repo]) changedRepos.push(repo);
    }
  }

  const signals = [];
  if (watchedHitRepos.length > 0) signals.push(`${watchedHitRepos.length} repo(s) touched watched paths: ${watchedHitRepos.slice(0, 3).join(', ')}${watchedHitRepos.length > 3 ? '…' : ''}`);
  if (changedRepos.length > 0) signals.push(`${changedRepos.length} repo(s) changed: ${changedRepos.slice(0, 3).join(', ')}${changedRepos.length > 3 ? '…' : ''}`);
  if (errorRepos.length > 0) signals.push(`${errorRepos.length} repo(s) errored (auth or rate limit): ${errorRepos.slice(0, 3).join(', ')}`);
  if (probeError) signals.push(`upstream-check probe failed: ${probeError.split('\n')[0].slice(0, 120)}`);

  const evidence = perRepo.slice(0, 10).map(r => ({
    type: 'repo_status',
    ref: `github.com/${r.repo}`,
    excerpt: `status=${r.status} new=${r.newCommits} watched=${r.hasRelevantChanges}`,
  }));
  if (probeError) evidence.push({ type: 'probe_error', excerpt: probeError.slice(0, 240) });

  const breakingRisk = watchedHitRepos.length > 0 ? 'medium' : 'low';
  const severity = watchedHitRepos.length > 0 ? 'medium' : changedRepos.length > 0 ? 'low' : 'low';

  const { recommendation, actionPlan } = recommend({ watchedHitRepos, changedRepos, errorRepos, hadProbeError: !!probeError });

  return {
    severity,
    confidence: probeError ? 0.3 : 0.85,
    classification: {
      kind: 'dependency',
      subkind: watchedHitRepos.length > 0 ? 'watched_path_drift' : 'repo_commit_drift',
      breakingRisk,
      novelty: watchedHitRepos.length > 0 ? 'incremental' : 'noise',
    },
    recommendation,
    actionPlan,
    evidence,
    headline: buildHeadline(changedRepos, watchedHitRepos, errorRepos),
    why: signals.length > 0 ? signals : ['commit SHAs differ from prior snapshot'],
  };
}

function recommend({ watchedHitRepos, changedRepos, errorRepos, hadProbeError }) {
  if (watchedHitRepos.length > 0) {
    const steps = [
      `Inspect changes on watched paths in: ${watchedHitRepos.slice(0, 5).join(', ')}${watchedHitRepos.length > 5 ? ', …' : ''}`,
      'Decide per repo whether to import patterns into knowledge/cache or knowledge/learnings.',
      'Run `node tools/upstream-check.js --update` to advance lastCommitSha for the repos you reviewed.',
      'Re-run sync to clear the card.',
    ];
    return { recommendation: 'TAKE', actionPlan: steps.join('\n') };
  }
  if (changedRepos.length > 0) {
    return { recommendation: 'REJECT', actionPlan: 'Commits exist but none touched our watched paths; reject as noise.' };
  }
  if (hadProbeError) {
    return { recommendation: 'REJECT', actionPlan: 'gh probe failed (auth/rate limit). Re-run sync once gh auth is restored.' };
  }
  if (errorRepos.length > 0) {
    return { recommendation: 'REJECT', actionPlan: `Some repos errored on probe: ${errorRepos.slice(0, 3).join(', ')}.` };
  }
  return { recommendation: 'REJECT', actionPlan: 'No meaningful upstream movement.' };
}

function buildHeadline(changedRepos, watchedHitRepos, errorRepos) {
  if (watchedHitRepos.length > 0) return `${watchedHitRepos.length} repo(s) changed in watched paths`;
  if (changedRepos.length > 0) return `${changedRepos.length} repo(s) have new commits`;
  if (errorRepos.length > 0) return `${errorRepos.length} repo(s) could not be probed`;
  return 'Upstream repos drifted';
}

function safeParse(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

module.exports = { detect, understand };
