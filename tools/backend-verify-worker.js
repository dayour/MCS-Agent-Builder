#!/usr/bin/env node
/**
 * Backend Verify Worker — debounced single-flight runner for backend changes.
 *
 * Spawned (detached) by .claude/hooks/backend-test-trigger.js whenever a
 * backend file edit lands (app/server.js, app/lib/**, tools/**).
 *
 * Reads tools/.backend-verify.pending.json, waits for the 5s debounce window
 * to settle, then runs `backend-verify.js`.
 *
 * Output schema matches agentic-test-loop's worker so the iterate orchestrator
 * (and Stop hook) can read both with the same parser.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PENDING_FILE = path.join(ROOT, 'tools', '.backend-verify.pending.json');
const LAST_RESULT_FILE = path.join(ROOT, 'tools', '.backend-verify.last-result.json');
const WORKER_LOCK = path.join(ROOT, 'tools', '.backend-verify.lock');
const VERIFY = path.join(ROOT, 'tools', 'backend-verify.js');

const DEBOUNCE_MS = 5_000;
const MAX_DEBOUNCE_TOTAL_MS = 60_000;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async function main() {
  const startedAt = Date.now();
  try {
    while (true) {
      const pending = readPending();
      if (!pending) cleanupAndExit(0);
      const sinceLastEdit = Date.now() - pending.lastEditAt;
      if (sinceLastEdit >= DEBOUNCE_MS) break;
      if (Date.now() - startedAt > MAX_DEBOUNCE_TOTAL_MS) break;
      await sleep(DEBOUNCE_MS - sinceLastEdit);
    }

    const pending = readPending();
    if (!pending) cleanupAndExit(0);

    // Decide mode: --quick if only tools/__tests__ or pure-tools edits
    // (still runs contracts + types). Otherwise full.
    const quickMode = (pending.files || []).every((f) => {
      const rel = path.relative(ROOT, f).replace(/\\/g, '/');
      return rel.startsWith('tools/__tests__/') || rel.endsWith('.md');
    });

    const args = ['--note', `auto-fire: ${pending.files.length} backend edit(s)`];
    if (quickMode) args.push('--quick');

    const run = spawnSync(process.execPath, [VERIFY, ...args], {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 240_000,
      env: { ...process.env, CLAUDE_HEADLESS: '1' },
    });

    let parsed = null;
    try { parsed = JSON.parse(run.stdout || ''); } catch { /* ignore */ }

    // backend-verify writes its own LAST_RESULT_FILE, but persist a worker
    // wrapper too so the Stop hook gets a consistent shape regardless of
    // whether the underlying tool finished cleanly.
    const wrapper = {
      skipped: false,
      ranAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      editedFiles: (pending.files || []).map(rel),
      mode: quickMode ? 'quick' : 'full',
      exitCode: run.status,
      result: parsed,
      stderr: (run.stderr || '').slice(0, 2000),
    };
    try { fs.writeFileSync(LAST_RESULT_FILE, JSON.stringify(wrapper, null, 2)); } catch { /* ignore */ }

    cleanupAndExit(run.status === 0 ? 0 : 1);
  } catch (err) {
    try {
      fs.writeFileSync(LAST_RESULT_FILE, JSON.stringify({
        skipped: false,
        ranAt: new Date().toISOString(),
        error: String(err.message || err).slice(0, 500),
      }, null, 2));
    } catch { /* ignore */ }
    cleanupAndExit(2);
  }
})();

function readPending() {
  if (!fs.existsSync(PENDING_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8')); } catch { return null; }
}

function cleanupAndExit(code) {
  try { fs.unlinkSync(PENDING_FILE); } catch { /* ignore */ }
  try { fs.unlinkSync(WORKER_LOCK); } catch { /* ignore */ }
  process.exit(code);
}

function rel(p) {
  try { return path.relative(ROOT, p).replace(/\\/g, '/'); } catch { return p; }
}
