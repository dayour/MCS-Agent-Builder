#!/usr/bin/env node
/**
 * Backend Test Trigger Hook (PostToolUse)
 *
 * Fires after Write/Edit/MultiEdit. If the edited path is a backend source
 * (app/server.js, app/lib/**, tools/** but not tools/bundles, tools/__tests__,
 * or tools/.test-loop.* / tools/.backend-verify.* tracking files), queues a
 * backend-verify run. Single-flight + 5s debounce so a burst of edits
 * collapses into one run.
 *
 * The hook itself does NOT run anything heavy. It updates a pending marker
 * and spawns a detached worker (tools/backend-verify-worker.js) that
 * handles debounce and execution. Hook completes in <50ms.
 *
 * Bypasses (no work, fast exit):
 *   - CLAUDE_HEADLESS=1            sub-agent edits don't recursively trigger
 *   - CLAUDE_OFF_AUTOTEST=1        user opt-out for the session
 *   - input.isSidechain === true   teammate-originated edits
 *   - tool not Write/Edit/MultiEdit
 *   - path not under app/server.js, app/lib/, or tools/
 *   - path is a transient .* file or under tools/bundles/
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

if (process.env.CLAUDE_HEADLESS === '1') process.exit(0);
if (process.env.CLAUDE_OFF_AUTOTEST === '1') process.exit(0);

const ROOT = path.resolve(__dirname, '..', '..');
const APP_LIB = path.resolve(ROOT, 'app', 'lib');
const APP_SERVER = path.resolve(ROOT, 'app', 'server.js');
const TOOLS = path.resolve(ROOT, 'tools');
const PENDING_FILE = path.join(ROOT, 'tools', '.backend-verify.pending.json');
const WORKER_LOCK = path.join(ROOT, 'tools', '.backend-verify.lock');
const WORKER_SCRIPT = path.join(ROOT, 'tools', 'backend-verify-worker.js');

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

    if (!isBackendPath(canon)) {
      process.exit(0);
    }
    if (isExcluded(canon)) {
      process.exit(0);
    }

    let pending = { lastEditAt: 0, files: [] };
    if (fs.existsSync(PENDING_FILE)) {
      try { pending = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8')); } catch { /* corrupt — reset */ }
    }
    pending.lastEditAt = Date.now();
    if (!pending.files.includes(canon)) pending.files.push(canon);
    if (pending.files.length > 100) pending.files = pending.files.slice(-100);
    fs.writeFileSync(PENDING_FILE, JSON.stringify(pending));

    if (workerAlive()) {
      process.stdout.write(`[backend-verify] queued backend edit (worker pid ${readWorkerPid()} active)`);
      process.exit(0);
    }

    const child = spawn(process.execPath, [WORKER_SCRIPT], {
      cwd: ROOT,
      stdio: 'ignore',
      detached: true,
      windowsHide: true,
      env: { ...process.env, CLAUDE_HEADLESS: '1' },
    });
    child.unref();
    try { fs.writeFileSync(WORKER_LOCK, JSON.stringify({ pid: child.pid, startedAt: Date.now() })); } catch { /* ignore */ }
    process.stdout.write(`[backend-verify] queued backend edit (worker spawned pid ${child.pid}); will run after 5s of quiet`);
    process.exit(0);
  } catch {
    process.exit(0);
  }
});

function isBackendPath(canon) {
  if (canon === APP_SERVER) return true;
  if (canon.startsWith(APP_LIB + path.sep) || canon === APP_LIB) return true;
  if (canon.startsWith(TOOLS + path.sep) || canon === TOOLS) return true;
  return false;
}

/**
 * Exclude transient files, build artifacts, log files, and bundles
 * to prevent feedback loops where the worker's own writes re-trigger us.
 */
function isExcluded(canon) {
  const rel = path.relative(ROOT, canon).replace(/\\/g, '/');
  if (rel.startsWith('tools/bundles/')) return true;
  if (rel.startsWith('tools/upstream-specs/contracts/')) return true; // generated parity artifacts
  // Hidden / dotfiles in tools/ (locks, pending markers, last-results, log files)
  if (/^tools\/\.[^\/]+$/.test(rel)) return true;
  // JSONL log files anywhere under tools/
  if (rel.startsWith('tools/') && rel.endsWith('.jsonl')) return true;
  if (rel.startsWith('tools/') && rel.endsWith('.log')) return true;
  // Generated TS types
  if (rel.startsWith('tools/generated/')) return true;
  // Skip om-cli source which is regenerated, not edited by hand
  if (rel.startsWith('tools/om-cli/')) return true;
  return false;
}

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
