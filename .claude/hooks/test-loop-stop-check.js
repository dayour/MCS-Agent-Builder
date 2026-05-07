#!/usr/bin/env node
/**
 * Test Loop Stop Check Hook (Stop)
 *
 * Runs at end of turn. Surfaces:
 *   - Pending edits without a completed run (worker still in flight)
 *   - Stalled / regressing test results from the auto-fire worker
 *   - Last MCS push that failed verification (build-log.jsonl)
 *
 * Output is plain text to stdout — Claude sees it as a system message and
 * can react on the next turn. Hook never blocks Stop.
 */
const fs = require('fs');
const path = require('path');

if (process.env.CLAUDE_HEADLESS === '1') process.exit(0);
if (process.env.CLAUDE_OFF_AUTOTEST === '1') process.exit(0);

const ROOT = path.resolve(__dirname, '..', '..');
const PENDING_FILE = path.join(ROOT, 'tools', '.test-loop.pending.json');
const LAST_RESULT = path.join(ROOT, 'tools', '.test-loop.last-result.json');
const WORKER_LOCK = path.join(ROOT, 'tools', '.test-loop.lock');
const BACKEND_PENDING = path.join(ROOT, 'tools', '.backend-verify.pending.json');
const BACKEND_LAST_RESULT = path.join(ROOT, 'tools', '.backend-verify.last-result.json');
const BACKEND_WORKER_LOCK = path.join(ROOT, 'tools', '.backend-verify.lock');
const ITERATE_SESSION = path.join(ROOT, 'tools', '.iterate-session.json');
const BUILD_LOG = path.join(ROOT, 'tools', 'build-log.jsonl');

const messages = [];

// Pending without a completed run — worker still in flight or hasn't started.
if (fs.existsSync(PENDING_FILE)) {
  try {
    const pending = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
    const ageS = Math.round((Date.now() - pending.lastEditAt) / 1000);
    const workerActive = (() => {
      if (!fs.existsSync(WORKER_LOCK)) return false;
      try {
        const lock = JSON.parse(fs.readFileSync(WORKER_LOCK, 'utf8'));
        try { process.kill(lock.pid, 0); return true; } catch { return false; }
      } catch { return false; }
    })();
    if (workerActive) {
      messages.push(
        `[test-loop] auto-fire worker still in flight (${(pending.files || []).length} file(s) queued, ${ageS}s since last edit). ` +
        `Wait for it to complete, or check tools/.test-loop.last-result.json.`
      );
    } else {
      messages.push(
        `[test-loop] frontend edits pending without a completed run. ` +
        `Worker may have crashed. Run manually: \`node tools/agentic-test-loop.js run --start-server\`.`
      );
    }
  } catch { /* ignore corrupt marker */ }
}

// Last auto-fire result — surface non-green outcomes.
if (fs.existsSync(LAST_RESULT)) {
  try {
    const r = JSON.parse(fs.readFileSync(LAST_RESULT, 'utf8'));
    const ageS = r.ranAt ? Math.round((Date.now() - new Date(r.ranAt).getTime()) / 1000) : null;
    if (r.skipped) {
      // Only surface skip if it's recent and likely actionable
      if (r.reason === 'dev-server-not-running' && ageS !== null && ageS < 600) {
        messages.push(
          `[test-loop] auto-fire skipped: dev server not running. ${r.recommendation || 'Start with `npm start`.'} ` +
          `Edited ${(r.editedFiles || []).length} file(s).`
        );
      }
    } else if (r.result && r.result.status && r.result.status !== 'green') {
      messages.push(
        `[test-loop] last auto-fire result: ${r.result.status} ` +
        `(${r.result.testResults?.failed ?? '?'} failed / ${r.result.testResults?.total ?? '?'} total)` +
        (r.result.recommendation ? ` — ${String(r.result.recommendation).slice(0, 240)}` : '') +
        `. Inspect: \`node tools/agentic-test-loop.js failures\`.`
      );
    } else if (r.error) {
      messages.push(`[test-loop] auto-fire worker errored: ${String(r.error).slice(0, 200)}`);
    }
  } catch { /* ignore */ }
}

// Backend verify — pending without a completed run.
if (fs.existsSync(BACKEND_PENDING)) {
  try {
    const pending = JSON.parse(fs.readFileSync(BACKEND_PENDING, 'utf8'));
    const ageS = Math.round((Date.now() - pending.lastEditAt) / 1000);
    const workerActive = (() => {
      if (!fs.existsSync(BACKEND_WORKER_LOCK)) return false;
      try {
        const lock = JSON.parse(fs.readFileSync(BACKEND_WORKER_LOCK, 'utf8'));
        try { process.kill(lock.pid, 0); return true; } catch { return false; }
      } catch { return false; }
    })();
    if (workerActive) {
      messages.push(
        `[backend-verify] worker still in flight (${(pending.files || []).length} file(s) queued, ${ageS}s since last edit). ` +
        `Wait for it, or check tools/.backend-verify.last-result.json.`
      );
    } else {
      messages.push(
        `[backend-verify] backend edits pending without a completed run. ` +
        `Run manually: \`node tools/backend-verify.js\`.`
      );
    }
  } catch { /* ignore */ }
}

// Backend verify — last result.
if (fs.existsSync(BACKEND_LAST_RESULT)) {
  try {
    const r = JSON.parse(fs.readFileSync(BACKEND_LAST_RESULT, 'utf8'));
    const inner = r.result || r; // worker wrapper or direct verify output
    if (inner && inner.status && inner.status !== 'green' && inner.status !== 'skipped') {
      const failedCount = (inner.failures || []).length;
      messages.push(
        `[backend-verify] last auto-fire result: ${inner.status} ` +
        `(${failedCount} check(s) failed)` +
        (inner.recommendation ? ` — ${String(inner.recommendation).slice(0, 240)}` : '') +
        `. Inspect: \`cat tools/.backend-verify.last-result.json\`.`
      );
    } else if (r.error) {
      messages.push(`[backend-verify] worker errored: ${String(r.error).slice(0, 200)}`);
    }
  } catch { /* ignore */ }
}

// /iterate session — surface paused/escalated state for cross-turn resume.
if (fs.existsSync(ITERATE_SESSION)) {
  try {
    const sess = JSON.parse(fs.readFileSync(ITERATE_SESSION, 'utf8'));
    const ageH = sess.lastUpdatedAt ? (Date.now() - new Date(sess.lastUpdatedAt).getTime()) / 3600_000 : 0;
    if (ageH > 24) {
      // Stale — ignore, but don't delete (let orchestrator clean up).
    } else if (sess.state === 'escalated' || sess.state === 'paused') {
      messages.push(
        `[iterate] session ${sess.id || '?'} ${sess.state} at phase \`${sess.phase || '?'}\`. ` +
        `Resume: \`/iterate --resume ${sess.id || ''}\` or abandon: \`/iterate --abandon ${sess.id || ''}\`.` +
        (sess.reason ? ` Reason: ${String(sess.reason).slice(0, 200)}` : '')
      );
    }
  } catch { /* ignore */ }
}

// MCS build verify — last push silent-failure or partial.
if (fs.existsSync(BUILD_LOG)) {
  try {
    const lines = fs.readFileSync(BUILD_LOG, 'utf8').trim().split('\n').filter(Boolean);
    const recent = lines.slice(-5).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const bad = recent.filter((e) => e.classification && !['identical', 'expected-divergence'].includes(e.classification));
    if (bad.length > 0) {
      const summary = bad.slice(-3).map((b) => `${b.operation || '?'}:${b.classification}`).join(', ');
      messages.push(
        `[mcs-build-loop] recent push verification flagged ${bad.length} divergence(s): ${summary}. ` +
        `Inspect tools/build-log.jsonl before marking the build complete.`
      );
    }
  } catch { /* ignore */ }
}

if (messages.length > 0) {
  process.stdout.write(messages.join('\n\n'));
}
process.exit(0);
