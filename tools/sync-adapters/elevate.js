/**
 * elevate adapter
 *
 * Wraps tools/elevate-sync.js which already implements read-only monitoring
 * of bap-microsoft/Elevate with force-push detection, path categorization,
 * and digest generation. Never merges, never checks out upstream files.
 *
 * Fingerprint shape:
 *   primary:   elevate-upstream tracking tip SHA
 *   secondary: remote elevate/main tip SHA (what we're comparing to)
 *   version:   count-of-new-commits rollup for semantic versioning
 *   timestamp: ISO of when we ran the probe
 *
 * States from elevate-sync: up-to-date | new-commits | force-push.
 * Force-push surfaces as high breakingRisk because upstream was rebased.
 */

'use strict';

const path = require('path');
const { execFileSync } = require('child_process');
const { sha256 } = require('../lib/ids');

function runElevateSync(root, withDigestUpdate) {
  const script = path.join(root, 'tools', 'elevate-sync.js');
  const args = [script];
  if (withDigestUpdate) args.push('--digest', '--update');
  args.push('--json');
  try {
    const stdout = execFileSync(process.execPath, args, {
      encoding: 'utf8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // elevate-sync prints mixed text + a final JSON line; take the last JSON line.
    const lines = stdout.trim().split('\n');
    const jsonLine = [...lines].reverse().find(l => l.trim().startsWith('{'));
    return jsonLine ? JSON.parse(jsonLine) : null;
  } catch (e) {
    // Exit code 1 on new-commits is not a failure — re-parse stdout
    const stdout = e.stdout ? String(e.stdout) : '';
    const lines = stdout.trim().split('\n');
    const jsonLine = [...lines].reverse().find(l => l.trim().startsWith('{'));
    if (jsonLine) return JSON.parse(jsonLine);
    return { status: 'error', error: e.stderr ? String(e.stderr).slice(0, 240) : e.message };
  }
}

function checkRemoteConfigured(root) {
  try {
    execFileSync('git', ['remote', 'get-url', 'elevate'], {
      encoding: 'utf8',
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

async function detect({ source, root }) {
  if (!checkRemoteConfigured(root)) {
    return { error: 'elevate remote not configured (this is fine — skip this source)' };
  }
  const result = runElevateSync(root, /*withDigestUpdate*/ false);
  if (!result) return { error: 'elevate-sync produced no JSON output' };
  if (result.status === 'error') return { error: result.error || 'elevate-sync error' };

  const primary = result.prev || result.remoteHead || 'UNKNOWN';
  const secondary = result.next || result.remoteHead || primary;
  return {
    fingerprint: {
      primary,
      secondary,
      version: result.count != null ? `+${result.count}` : null,
      timestamp: new Date().toISOString(),
    },
    meta: { status: result.status, count: result.count || 0 },
  };
}

async function understand({ source, before, after, root }) {
  // Read-only probe — never advances tracking branch, never writes the digest.
  // The user takes the change explicitly through `decide ... take` and then
  // runs `node tools/elevate-sync.js --digest` manually as part of the action plan.
  const result = runElevateSync(root, /*withDigestUpdate*/ false);
  const status = result?.status || 'unknown';

  const evidence = [];
  const signals = [];
  let severity = 'low';
  let breakingRisk = 'low';
  let novelty = 'incremental';
  let recommendation = 'REJECT';
  let actionPlan = '';

  if (status === 'force-push') {
    severity = 'high';
    breakingRisk = 'high';
    novelty = 'breaking';
    recommendation = 'TAKE';
    actionPlan = [
      'Upstream Elevate was rebased/force-pushed; review the new history before any fast-forward.',
      'Run `node tools/elevate-sync.js --digest` to refresh knowledge/learnings/elevate-upstream-digest.md.',
      'Inspect any cherry-picked patterns under app/frontend/src/ that came from prior digests.',
    ].join('\n');
    signals.push('upstream rebased/force-pushed — tracking branch NOT advanced');
    signals.push('manual review REQUIRED before fast-forward');
    evidence.push({ type: 'force_push', excerpt: `prev=${result.prev?.slice(0,8) || 'unknown'} next=${result.next?.slice(0,8) || 'unknown'}` });
  } else if (status === 'new-commits') {
    const count = result.count || 0;
    severity = count > 20 ? 'medium' : 'low';
    signals.push(`${count} new commit(s) on elevate/main`);
    evidence.push({ type: 'commit_range', excerpt: `${result.prev?.slice(0,8) || 'unknown'}..${result.next?.slice(0,8) || 'unknown'}` });
    recommendation = 'TAKE';
    actionPlan = [
      `${count} new commit(s) on bap-microsoft/Elevate. Run \`node tools/elevate-sync.js --digest\` to capture them in the digest.`,
      'Review knowledge/learnings/elevate-upstream-digest.md and decide per-commit whether to cherry-pick patterns into app/frontend/src/.',
      'Manually advance the elevate-upstream tracking branch only after reviewing.',
    ].join('\n');
  } else if (status === 'up-to-date' || status === 'no-new-commits') {
    signals.push('elevate tracking branch is up to date');
    recommendation = 'REJECT';
    actionPlan = 'Up to date — no action.';
  } else {
    signals.push(`unexpected status: ${status}`);
    recommendation = 'REJECT';
    actionPlan = `Adapter received unexpected status="${status}"; investigate elevate-sync output.`;
  }

  return {
    severity,
    confidence: status === 'force-push' ? 1.0 : 0.9,
    classification: {
      kind: status === 'force-push' ? 'breaking' : 'content',
      subkind: 'upstream_ux_drift',
      breakingRisk,
      novelty,
    },
    recommendation,
    actionPlan,
    evidence,
    headline: buildHeadline(status, result),
    why: signals,
  };
}

function buildHeadline(status, result) {
  if (status === 'force-push') return 'Elevate upstream REBASED — manual review required';
  if (status === 'new-commits') return `Elevate: ${result?.count || '?'} new commit(s) — see digest`;
  if (status === 'up-to-date' || status === 'no-new-commits') return 'Elevate: up to date';
  return `Elevate: ${status}`;
}

module.exports = { detect, understand };
