#!/usr/bin/env node
/**
 * Test Loop Worker — debounced single-flight runner for the agentic test loop.
 *
 * Spawned (detached) by .claude/hooks/frontend-test-trigger.js whenever a
 * frontend src/ edit lands. Reads tools/.test-loop.pending.json, waits for
 * the 5s debounce window to settle, infers the feature from edited files via
 * knowledge/feature-map.json, then runs `agentic-test-loop.js run`.
 *
 * Result is written to tools/.test-loop.last-result.json. The Stop hook
 * picks it up at end of turn.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PENDING_FILE = path.join(ROOT, 'tools', '.test-loop.pending.json');
const LAST_RESULT_FILE = path.join(ROOT, 'tools', '.test-loop.last-result.json');
const WORKER_LOCK = path.join(ROOT, 'tools', '.test-loop.lock');
const FEATURE_MAP = path.join(ROOT, 'knowledge', 'feature-map.json');
const TEST_LOOP = path.join(ROOT, 'tools', 'agentic-test-loop.js');
const SRC = path.resolve(ROOT, 'app', 'frontend', 'src');

const DEBOUNCE_MS = 5_000;
const MAX_DEBOUNCE_TOTAL_MS = 60_000;
const SERVER_CHECK_TIMEOUT_MS = 2_000;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async function main() {
  const startedAt = Date.now();
  try {
    // Debounce loop: if more edits land while we're waiting, restart the timer.
    while (true) {
      const pending = readPending();
      if (!pending) {
        cleanupAndExit(0, { skipped: true, reason: 'no-pending-marker' });
      }
      const sinceLastEdit = Date.now() - pending.lastEditAt;
      if (sinceLastEdit >= DEBOUNCE_MS) break;
      // Cap the total wait so a runaway editor doesn't keep us alive forever.
      if (Date.now() - startedAt > MAX_DEBOUNCE_TOTAL_MS) break;
      await sleep(DEBOUNCE_MS - sinceLastEdit);
    }

    const pending = readPending();
    if (!pending) cleanupAndExit(0, { skipped: true, reason: 'pending-disappeared' });

    // Server up? If not, skip — auto-starting Vite from a hook is too
    // intrusive (leaves processes running, conflicts with `npm start`).
    if (!(await isServerUp('http://localhost:8080'))) {
      writeResult({
        skipped: true,
        reason: 'dev-server-not-running',
        recommendation: 'Run `npm start` in another terminal, or pass --start-server manually.',
        editedFiles: pending.files.map(rel),
        editsObservedAt: new Date(pending.lastEditAt).toISOString(),
        ranAt: new Date().toISOString(),
      });
      cleanupAndExit(0);
    }

    const feature = inferFeature(pending.files);

    const args = ['run'];
    if (feature) {
      args.push('--feature', feature);
    }
    args.push('--note', `auto-fire: ${pending.files.length} frontend edit(s)`);

    const run = spawnSync(process.execPath, [TEST_LOOP, ...args], {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 240_000,
      env: { ...process.env, CLAUDE_HEADLESS: '1' },
    });

    let parsed = null;
    try { parsed = JSON.parse(run.stdout || ''); } catch { /* ignore */ }

    writeResult({
      skipped: false,
      ranAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      editedFiles: pending.files.map(rel),
      inferredFeature: feature,
      exitCode: run.status,
      result: parsed,
      stderr: (run.stderr || '').slice(0, 2000),
    });

    cleanupAndExit(run.status === 0 ? 0 : 1);
  } catch (err) {
    writeResult({
      skipped: false,
      error: String(err.message || err).slice(0, 500),
      ranAt: new Date().toISOString(),
    });
    cleanupAndExit(2);
  }
})();

function readPending() {
  if (!fs.existsSync(PENDING_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8')); } catch { return null; }
}

function writeResult(obj) {
  try { fs.writeFileSync(LAST_RESULT_FILE, JSON.stringify(obj, null, 2)); } catch { /* ignore */ }
}

function cleanupAndExit(code) {
  try { fs.unlinkSync(PENDING_FILE); } catch { /* ignore */ }
  try { fs.unlinkSync(WORKER_LOCK); } catch { /* ignore */ }
  process.exit(code);
}

function rel(p) {
  try { return path.relative(ROOT, p).replace(/\\/g, '/'); } catch { return p; }
}

async function isServerUp(url) {
  return new Promise((resolve) => {
    const http = require('http');
    const u = new URL(url);
    const req = http.get({ host: u.hostname, port: u.port, path: '/', timeout: SERVER_CHECK_TIMEOUT_MS }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

/**
 * Infer the most relevant feature from the set of edited files.
 *
 * Strategy: for each feature in feature-map.json, count how many edited files
 * mention any of the feature's components (case-insensitive substring match
 * on basename) or sit under a path that hints at the feature's routes.
 * Tie-break by feature definition order (which is roughly priority order).
 */
function inferFeature(files) {
  if (!fs.existsSync(FEATURE_MAP)) return null;
  let map;
  try { map = JSON.parse(fs.readFileSync(FEATURE_MAP, 'utf8')); } catch { return null; }
  const features = map.features || {};

  const basenames = files.map((f) => path.basename(f, path.extname(f)).toLowerCase());
  const lowered = files.map((f) => f.toLowerCase().replace(/\\/g, '/'));

  let best = null;
  let bestScore = 0;

  for (const [key, def] of Object.entries(features)) {
    let score = 0;
    const components = (def.components || []).map((c) => c.toLowerCase());
    for (const bn of basenames) {
      if (components.some((c) => bn === c.toLowerCase() || bn.includes(c.toLowerCase()))) score += 2;
    }
    // Path-based hints from routes. Treat /<route> as a domain hint.
    const routes = (def.routes || []).map((r) => r.replace(/^\//, '').toLowerCase());
    for (const lp of lowered) {
      for (const r of routes) {
        if (!r) continue;
        if (lp.includes(`/pages/${r}`) || lp.includes(`/domains/${r}`) || lp.includes(`/${r}/`)) {
          score += 1;
        }
      }
    }
    if (score > bestScore) {
      best = key;
      bestScore = score;
    }
  }

  return best;
}
