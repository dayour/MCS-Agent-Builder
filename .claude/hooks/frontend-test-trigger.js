#!/usr/bin/env node
/**
 * Frontend Test Trigger Hook (PostToolUse)
 *
 * Fires after Write/Edit/MultiEdit. If the edited path is under
 * app/frontend/src/, queues an agentic-test-loop run. Single-flight + 5s
 * debounce so a burst of edits collapses into one run.
 *
 * The hook itself does NOT run Playwright. It updates a pending marker and
 * spawns a detached worker (tools/test-loop-worker.js) that handles debounce
 * and test execution. The hook completes in <50ms.
 *
 * Bypasses (no work, fast exit):
 *   - CLAUDE_HEADLESS=1            sub-agent edits don't recursively trigger
 *   - CLAUDE_OFF_AUTOTEST=1        user opt-out for the session
 *   - input.isSidechain === true   teammate-originated edits
 *   - tool not Write/Edit/MultiEdit
 *   - path not under app/frontend/src/
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

if (process.env.CLAUDE_HEADLESS === '1') process.exit(0);
if (process.env.CLAUDE_OFF_AUTOTEST === '1') process.exit(0);

const ROOT = path.resolve(__dirname, '..', '..');
const SRC_PREFIX = path.resolve(ROOT, 'app', 'frontend', 'src');
const PENDING_FILE = path.join(ROOT, 'tools', '.test-loop.pending.json');
const WORKER_LOCK = path.join(ROOT, 'tools', '.test-loop.lock');
const WORKER_SCRIPT = path.join(ROOT, 'tools', 'test-loop-worker.js');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    if (input.isSidechain === true || input.source === 'subagent') {
      process.exit(0);
    }
    if (!['Write', 'Edit', 'MultiEdit'].includes(input.tool_name)) {
      process.exit(0);
    }

    const filePath = input.tool_input?.file_path;
    if (!filePath || typeof filePath !== 'string') {
      process.exit(0);
    }
    const canon = path.resolve(filePath);
    if (!canon.startsWith(SRC_PREFIX + path.sep) && canon !== SRC_PREFIX) {
      // Not a frontend src edit
      process.exit(0);
    }

    // Update pending marker. Append the file to the list so the worker
    // can infer the right feature.
    let pending = { lastEditAt: 0, files: [] };
    if (fs.existsSync(PENDING_FILE)) {
      try { pending = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8')); } catch { /* corrupt — reset */ }
    }
    pending.lastEditAt = Date.now();
    if (!pending.files.includes(canon)) pending.files.push(canon);
    if (pending.files.length > 100) pending.files = pending.files.slice(-100);
    fs.writeFileSync(PENDING_FILE, JSON.stringify(pending));

    // Single-flight: if a worker is already running, the existing one will
    // pick up our marker on its next debounce check.
    if (workerAlive()) {
      process.stdout.write(`[test-loop] queued frontend edit (worker pid ${readWorkerPid()} active)`);
      process.exit(0);
    }

    // Spawn detached worker.
    const child = spawn(process.execPath, [WORKER_SCRIPT], {
      cwd: ROOT,
      stdio: 'ignore',
      detached: true,
      windowsHide: true,
      env: { ...process.env, CLAUDE_HEADLESS: '1' },
    });
    child.unref();
    try { fs.writeFileSync(WORKER_LOCK, JSON.stringify({ pid: child.pid, startedAt: Date.now() })); } catch { /* ignore */ }
    process.stdout.write(`[test-loop] queued frontend edit (worker spawned pid ${child.pid}); will run after 5s of quiet`);
    process.exit(0);
  } catch {
    // Hook never blocks tool execution
    process.exit(0);
  }
});

function workerAlive() {
  if (!fs.existsSync(WORKER_LOCK)) return false;
  try {
    const lock = JSON.parse(fs.readFileSync(WORKER_LOCK, 'utf8'));
    if (!lock.pid) return false;
    try { process.kill(lock.pid, 0); return true; } catch { return false; }
  } catch { return false; }
}

function readWorkerPid() {
  try { return JSON.parse(fs.readFileSync(WORKER_LOCK, 'utf8')).pid; } catch { return '?'; }
}
