#!/usr/bin/env node
/**
 * Auto-Merge Gate — final pre-merge guardrail for /iterate.
 *
 * Reuses primitives from tools/iterate-orchestrator.js (classify, verdict,
 * auditAppend) and adds gate-specific checks: denylist, session cap,
 * cooldown, kill switches, PR labels, and CI status.
 *
 * Subcommands:
 *   check [--pr <number-or-url>]
 *     Run all gates against the current iterate session + the optional PR.
 *     Print a JSON object listing every gate's verdict. Exit 0 if all pass,
 *     exit 1 if any fail. The summary `allowed` field is the merge decision.
 *
 *   arm --pr <number-or-url> [--strategy squash|merge|rebase]
 *     If `check` passes, call `gh pr merge --auto --squash` (or chosen
 *     strategy). Append an `arm` audit event. The actual merge happens when
 *     CI completes (GitHub side).
 *
 *   audit-append --event <type> --data '<json>'
 *     Pass-through to iterate-orchestrator audit-append. Useful for callers
 *     that don't want to spawn the orchestrator.
 *
 *   audit-finalize --pr <number>
 *     After `gh pr merge --auto` actually merges (state OPEN → MERGED), look up
 *     the merge commit SHA and append an `iterate-merge-completed` event. Pairs
 *     with the `mergeCommitSha: 'pending'` placeholder written by `arm`.
 *
 *   audit-verify
 *     Verify the hash chain at knowledge/learnings/iterate-audit.jsonl.
 *
 *   self-test
 *     Validate output shape without external calls (no gh, no git).
 *
 * Kill switches:
 *   --no-auto-merge          per-invocation, makes `arm` a no-op
 *   CLAUDE_OFF_AUTO_MERGE=1  session-wide, makes `arm` a no-op
 */
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const orchestrator = require('./iterate-orchestrator');
const { DENYLIST_PATTERNS, AUDIT_LOG, SESSION_FILE } = orchestrator;

// Session cap and cooldown.
const SESSION_CAP_DEFAULT = 3;
const COOLDOWN_MS_DEFAULT = 5 * 60 * 1000; // 5 min

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJsonSafely(file) {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/**
 * Count `auto-merge-armed` events for the current session.
 */
function countSessionMerges(sessionId) {
  if (!sessionId || !fs.existsSync(AUDIT_LOG)) return 0;
  const lines = fs.readFileSync(AUDIT_LOG, 'utf8').trimEnd().split('\n').filter(Boolean);
  let count = 0;
  for (const l of lines) {
    try {
      const e = JSON.parse(l);
      if (e.event === 'auto-merge-armed' && e.data && e.data.sessionId === sessionId) count++;
    } catch { /* skip malformed */ }
  }
  return count;
}

function lastMergeTimestamp() {
  if (!fs.existsSync(AUDIT_LOG)) return null;
  const lines = fs.readFileSync(AUDIT_LOG, 'utf8').trimEnd().split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const e = JSON.parse(lines[i]);
      if (e.event === 'auto-merge-armed') return e.timestamp;
    } catch { /* skip */ }
  }
  return null;
}

/**
 * Resolve a PR ref (number or full URL) into number + repo. Uses gh by default.
 */
function resolvePrRef(prRef) {
  if (!prRef) return null;
  // Numeric → assume current repo
  if (/^\d+$/.test(String(prRef))) {
    return { number: parseInt(prRef, 10), repo: null };
  }
  // GitHub URL
  const m = String(prRef).match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  if (m) return { number: parseInt(m[2], 10), repo: m[1] };
  return null;
}

function getPrInfo(prRef) {
  const ref = resolvePrRef(prRef);
  if (!ref) return null;
  try {
    const args = ['pr', 'view', String(ref.number), '--json', 'number,title,labels,state,statusCheckRollup,mergeable,mergeStateStatus,headRefName,headRefOid,baseRefName,baseRefOid,mergeCommit,url'];
    if (ref.repo) args.push('--repo', ref.repo);
    const out = execSync(`gh ${args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 15000,
    });
    return JSON.parse(out);
  } catch (err) {
    return { error: String(err.message || err).slice(0, 500) };
  }
}

// ---------------------------------------------------------------------------
// Gate checks
// ---------------------------------------------------------------------------

/**
 * Run every gate; return a structured object.
 * Each gate has { name, passed, reason }.
 */
async function runGates({ prRef, sessionCap, cooldownMs, noAutoMerge }) {
  const gates = [];

  // 0. Kill switches
  if (noAutoMerge) {
    gates.push({ name: 'kill-switch:--no-auto-merge', passed: false, reason: '--no-auto-merge flag passed' });
  } else if (process.env.CLAUDE_OFF_AUTO_MERGE === '1') {
    gates.push({ name: 'kill-switch:env:CLAUDE_OFF_AUTO_MERGE', passed: false, reason: 'CLAUDE_OFF_AUTO_MERGE=1 set in environment' });
  } else {
    gates.push({ name: 'kill-switch', passed: true });
  }

  // 1. Audit chain integrity (refuse to merge if previous audits are tampered)
  const audit = orchestrator.auditVerify();
  gates.push({
    name: 'audit-chain-intact',
    passed: audit.ok,
    reason: audit.ok ? null : `audit chain broken at entry ${audit.brokenAt}: ${audit.reason}`,
    details: audit,
  });

  // 2. Iterate verdict (lanes + facilitator + review-merged)
  const verdict = orchestrator.verdict({ requireMergedReview: true });
  gates.push({
    name: 'iterate-verdict',
    passed: verdict.finalStatus === 'green',
    reason: verdict.finalStatus === 'green' ? null : `verdict: ${verdict.finalStatus} (blockers: ${(verdict.blockers || []).join(', ') || 'unknown'})`,
    details: { finalStatus: verdict.finalStatus, blockers: verdict.blockers, lanes: verdict.lanes, facilitator: verdict.facilitator, reviewMerged: verdict.reviewMerged },
  });

  // 3. Denylist check
  const cls = orchestrator.classify();
  gates.push({
    name: 'denylist',
    passed: cls.denylist.count === 0,
    reason: cls.denylist.count === 0 ? null : `${cls.denylist.count} file(s) on denylist: ${(cls.denylist.matches || []).slice(0, 5).join(', ')}${cls.denylist.matches.length > 5 ? '...' : ''}`,
    details: cls.denylist,
  });

  // 4. Session present
  const session = readJsonSafely(SESSION_FILE);
  gates.push({
    name: 'iterate-session',
    passed: !!session,
    reason: session ? null : 'no /iterate session active — run session-create first',
    details: session ? { id: session.id, state: session.state, phase: session.phase } : null,
  });

  // 5. Session cap
  const sessionId = session?.id || null;
  const mergesThisSession = countSessionMerges(sessionId);
  gates.push({
    name: 'session-cap',
    passed: mergesThisSession < sessionCap,
    reason: mergesThisSession < sessionCap ? null : `session ${sessionId} has already auto-merged ${mergesThisSession} times (cap=${sessionCap})`,
    details: { sessionId, mergesThisSession, cap: sessionCap },
  });

  // 6. Cooldown since last merge (across all sessions)
  const lastTs = lastMergeTimestamp();
  let cooldownPassed = true;
  let cooldownReason = null;
  if (lastTs) {
    const since = Date.now() - new Date(lastTs).getTime();
    if (since < cooldownMs) {
      cooldownPassed = false;
      cooldownReason = `last auto-merge was ${Math.round(since / 1000)}s ago (cooldown=${cooldownMs / 1000}s)`;
    }
  }
  gates.push({
    name: 'cooldown',
    passed: cooldownPassed,
    reason: cooldownReason,
    details: { lastTimestamp: lastTs, cooldownMs },
  });

  // 7-9. PR-side gates (only if a PR was passed)
  if (prRef) {
    const pr = getPrInfo(prRef);
    if (!pr || pr.error) {
      gates.push({ name: 'pr-resolvable', passed: false, reason: `gh pr view failed: ${pr?.error || 'unknown'}` });
    } else {
      // 7. State open
      gates.push({
        name: 'pr-state-open',
        passed: pr.state === 'OPEN',
        reason: pr.state === 'OPEN' ? null : `PR is ${pr.state}`,
        details: { state: pr.state },
      });

      // 8. Mergeable
      gates.push({
        name: 'pr-mergeable',
        passed: pr.mergeable === 'MERGEABLE' && (pr.mergeStateStatus === 'CLEAN' || pr.mergeStateStatus === 'HAS_HOOKS' || pr.mergeStateStatus === 'UNSTABLE'),
        reason: (pr.mergeable === 'MERGEABLE' && pr.mergeStateStatus !== 'BLOCKED' && pr.mergeStateStatus !== 'BEHIND' && pr.mergeStateStatus !== 'DIRTY' && pr.mergeStateStatus !== 'DRAFT')
          ? null
          : `mergeable=${pr.mergeable}, mergeStateStatus=${pr.mergeStateStatus}`,
        details: { mergeable: pr.mergeable, mergeStateStatus: pr.mergeStateStatus },
      });

      // 9. CI checks fully green — pending blocks (per GPT challenge 2026-05-04).
      // Previously this allowed pending; that's a TOCTOU race against CI completion.
      // Now: every check must be SUCCESS / NEUTRAL / SKIPPED; any non-terminal
      // (PENDING / IN_PROGRESS / QUEUED / EXPECTED) blocks the gate.
      const checks = pr.statusCheckRollup || [];
      const isGreen = (c) => {
        const concl = c.conclusion || c.state || '';
        return concl === 'SUCCESS' || concl === 'NEUTRAL' || concl === 'SKIPPED';
      };
      const isFailed = (c) => {
        const concl = c.conclusion || c.state || '';
        return concl === 'FAILURE' || concl === 'CANCELLED' || concl === 'TIMED_OUT' || concl === 'ACTION_REQUIRED' || concl === 'STALE';
      };
      const isPending = (c) => {
        const stat = c.status || c.state || '';
        const concl = c.conclusion || '';
        // No conclusion yet means still running; any of these statuses mean not-final.
        if (concl === '' && (stat === 'PENDING' || stat === 'IN_PROGRESS' || stat === 'QUEUED' || stat === 'EXPECTED' || stat === 'WAITING' || stat === 'REQUESTED')) return true;
        return false;
      };
      const failed = checks.filter(isFailed);
      const pending = checks.filter(isPending);
      const ciBlocked = failed.length > 0 || pending.length > 0;
      gates.push({
        name: 'ci-fully-green',
        passed: !ciBlocked,
        reason: !ciBlocked ? null : (
          failed.length > 0
            ? `${failed.length} CI check(s) failed: ${failed.map((f) => f.name || f.context || '?').slice(0, 3).join(', ')}`
            : `${pending.length} CI check(s) still pending — pending blocks auto-merge: ${pending.map((p) => p.name || p.context || '?').slice(0, 3).join(', ')}`
        ),
        details: { failedCount: failed.length, pendingCount: pending.length, totalCount: checks.length, breakdown: checks.map((c) => ({ name: c.name || c.context, conclusion: c.conclusion, status: c.status })) },
      });

      // 10. PR has no needs-human-review label
      const labels = (pr.labels || []).map((l) => l.name || l);
      gates.push({
        name: 'pr-no-human-review-label',
        passed: !labels.includes('needs-human-review'),
        reason: labels.includes('needs-human-review') ? 'PR has needs-human-review label applied' : null,
        details: { labels },
      });
    }
  } else {
    gates.push({ name: 'pr-required', passed: false, reason: 'no --pr flag passed; cannot evaluate PR-side gates' });
  }

  const allPassed = gates.every((g) => g.passed);
  const blockers = gates.filter((g) => !g.passed).map((g) => g.name);

  // Get head SHA for TOCTOU binding (re-checked in arm()).
  let headRefOid = null;
  if (prRef) {
    const pr = getPrInfo(prRef);
    headRefOid = pr?.headRefOid || null;
  }

  return {
    allowed: allPassed,
    blockers,
    gates,
    sessionId,
    headRefOid,
    classification: cls.lanesNeeded ? cls.lanesNeeded.join(',') : 'unknown',
    computedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// arm — actually call gh pr merge --auto
// ---------------------------------------------------------------------------

async function arm({ prRef, strategy, sessionCap, cooldownMs, noAutoMerge, dryRun }) {
  const ref = resolvePrRef(prRef);
  if (!ref) {
    return { armed: false, error: 'invalid --pr value (expected number or full PR URL)' };
  }

  // First gate evaluation. Captures headRefOid as `sha1`.
  const checkResult = await runGates({ prRef, sessionCap, cooldownMs, noAutoMerge });
  if (!checkResult.allowed) {
    return { armed: false, blockers: checkResult.blockers, gates: checkResult.gates, error: 'gates blocked auto-merge — run check for details' };
  }

  // TOCTOU bind: re-evaluate head SHA right before arming. If a force-push
  // landed between check and arm, gates may no longer apply to the actual
  // merge head. Refuse rather than racing.
  const sha1 = checkResult.headRefOid;
  const reverify = getPrInfo(prRef);
  const sha2 = reverify?.headRefOid || null;
  if (!sha1 || !sha2 || sha1 !== sha2) {
    return {
      armed: false,
      error: `head SHA changed during gate evaluation (${sha1?.slice(0, 7) || 'unknown'} -> ${sha2?.slice(0, 7) || 'unknown'}); refusing to arm. Re-run /iterate against the new head.`,
      sha1, sha2,
    };
  }

  if (dryRun) {
    return { armed: false, dryRun: true, wouldMerge: true, sha: sha1, gates: checkResult.gates };
  }

  // Call gh pr merge --auto
  const args = ['pr', 'merge', String(ref.number), '--auto', `--${strategy || 'squash'}`];
  if (ref.repo) args.push('--repo', ref.repo);
  const result = spawnSync('gh', args, {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: 30000,
    shell: true,
  });

  const armed = result.status === 0;
  const event = orchestrator.auditAppend({
    event: armed ? 'auto-merge-armed' : 'auto-merge-arm-failed',
    actor: 'auto-merge-gate',
    data: {
      sessionId: checkResult.sessionId,
      prNumber: ref.number,
      prRepo: ref.repo,
      strategy: strategy || 'squash',
      headRefOid: sha1,
      baseRefName: reverify?.baseRefName || null,
      baseRefOid: reverify?.baseRefOid || null,
      mergeCommitSha: 'pending', // filled later by `audit-finalize` after gh confirms merge
      stdout: (result.stdout || '').slice(-300),
      stderr: (result.stderr || '').slice(-300),
      exitCode: result.status,
    },
  });

  return {
    armed,
    prNumber: ref.number,
    strategy: strategy || 'squash',
    auditEntry: event,
    error: armed ? null : (result.stderr || result.stdout || 'gh exited non-zero').slice(0, 500),
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    }
  }
  return flags;
}

function emit(obj, exitCode = 0) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
  process.exit(exitCode);
}

(async function main() {
  const cmd = process.argv[2];
  const flags = parseFlags(process.argv.slice(3));

  if (!cmd || cmd === '--help' || cmd === '-h') {
    process.stdout.write('See top-of-file docstring. Subcommands: check, arm, audit-append, audit-finalize, audit-verify, self-test.\n');
    process.exit(0);
  }

  const sessionCap = flags['session-cap'] ? parseInt(flags['session-cap'], 10) : SESSION_CAP_DEFAULT;
  const cooldownMs = flags['cooldown-ms'] ? parseInt(flags['cooldown-ms'], 10) : COOLDOWN_MS_DEFAULT;

  try {
    switch (cmd) {
      case 'check': {
        const result = await runGates({
          prRef: flags.pr || null,
          sessionCap,
          cooldownMs,
          noAutoMerge: !!flags['no-auto-merge'],
        });
        return emit(result, result.allowed ? 0 : 1);
      }

      case 'arm': {
        if (!flags.pr) return emit({ armed: false, error: '--pr is required for arm' }, 1);
        const result = await arm({
          prRef: flags.pr,
          strategy: flags.strategy || 'squash',
          sessionCap,
          cooldownMs,
          noAutoMerge: !!flags['no-auto-merge'],
          dryRun: !!flags['dry-run'],
        });
        return emit(result, result.armed ? 0 : 1);
      }

      case 'audit-append': {
        const data = flags.data ? JSON.parse(flags.data) : {};
        return emit(orchestrator.auditAppend({
          event: flags.event || 'unknown',
          data,
          actor: flags.actor || 'auto-merge-gate',
        }));
      }

      case 'audit-finalize': {
        // Resolve the merge commit SHA for a PR that's now MERGED and append
        // an `iterate-merge-completed` event. Run after `gh pr merge --auto`
        // actually completes (state transitions OPEN → MERGED). Pairs with the
        // `mergeCommitSha: 'pending'` placeholder written by `arm`.
        if (!flags.pr) return emit({ error: 'audit-finalize requires --pr <num>' }, 1);
        const info = getPrInfo(flags.pr);
        if (!info) return emit({ error: `could not resolve PR ${flags.pr}` }, 1);
        if (info.state !== 'MERGED') {
          return emit({
            ok: false,
            prNumber: info.number,
            state: info.state,
            error: `PR is ${info.state}, not MERGED — finalize is premature`,
          }, 1);
        }
        const mergeCommitSha = info.mergeCommit?.oid || null;
        if (!mergeCommitSha) {
          return emit({ ok: false, error: 'PR is MERGED but mergeCommit.oid missing from gh response' }, 1);
        }
        const event = orchestrator.auditAppend({
          event: 'iterate-merge-completed',
          actor: 'auto-merge-gate',
          data: {
            prNumber: info.number,
            prRepo: info.repo || null,
            headRefOid: info.headRefOid,
            baseRefName: info.baseRefName,
            baseRefOid: info.baseRefOid,
            mergeCommitSha,
          },
        });
        return emit({ ok: true, prNumber: info.number, mergeCommitSha, auditEntry: event });
      }

      case 'audit-verify':
        return emit(orchestrator.auditVerify());

      case 'self-test':
        return emit({
          ok: true,
          denylistPatternCount: DENYLIST_PATTERNS.length,
          auditLogPath: AUDIT_LOG,
          sessionFile: SESSION_FILE,
          sessionCapDefault: SESSION_CAP_DEFAULT,
          cooldownMsDefault: COOLDOWN_MS_DEFAULT,
        });

      default:
        return emit({ error: `unknown command: ${cmd}` }, 1);
    }
  } catch (err) {
    return emit({ error: String(err.message || err), stack: err.stack?.slice(0, 800) }, 2);
  }
})();
