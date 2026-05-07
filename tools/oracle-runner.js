#!/usr/bin/env node
/**
 * Oracle Runner — thin wrapper around `agentic-test-loop.js oracle` so the
 * iterate orchestrator (and other consumers) can invoke oracle invariants
 * without depending on agentic-test-loop's CLI internals.
 *
 * The actual oracle implementation runs the `oracles` Playwright project in
 * app/frontend/e2e and is owned by agentic-test-loop.js. This file exists so
 * the orchestrator has a single, stable entrypoint that can later be extended
 * (MCP browser checks per feature-map, broad regression sweep, etc.) without
 * touching the underlying Playwright integration.
 *
 * CLI:
 *   node tools/oracle-runner.js [--feature <key>] [--run-id <id>] [--note "..."]
 *
 * Module:
 *   const { runOracle } = require('./oracle-runner');
 *   const result = await runOracle({ feature: 'auth', runId: 'foo' });
 *
 * Output (CLI and module):
 *   {
 *     status: 'pass' | 'fail' | 'error',
 *     testRunId: '<id>',
 *     oracle: '<feature or all>',
 *     results: { passed, failed, skipped, total },
 *     failures: [{ name, error, classification, route }],
 *     durationMs: <ms>,
 *     classification: 'oracle-mismatch' | null,
 *     recommendation: '<text>',
 *   }
 */
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TEST_LOOP = path.join(ROOT, 'tools', 'agentic-test-loop.js');

/**
 * Run oracle invariants. Returns a structured result.
 *
 * @param {{feature?: string, runId?: string, note?: string, timeoutMs?: number}} opts
 * @returns {Promise<object>}
 */
async function runOracle(opts = {}) {
  const startedAt = Date.now();
  const args = ['oracle'];
  if (opts.feature) args.push('--feature', opts.feature);
  if (opts.runId) args.push('--run-id', opts.runId);
  if (opts.note) args.push('--note', opts.note);

  const run = spawnSync(process.execPath, [TEST_LOOP, ...args], {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: opts.timeoutMs || 240_000,
    env: { ...process.env, CLAUDE_HEADLESS: '1' },
  });

  const durationMs = Date.now() - startedAt;
  let parsed = null;
  try { parsed = JSON.parse(run.stdout || ''); } catch { /* ignore */ }

  if (!parsed) {
    return {
      status: 'error',
      durationMs,
      error: 'Could not parse oracle output as JSON',
      stdout: (run.stdout || '').slice(-500),
      stderr: (run.stderr || '').slice(-500),
      exitCode: run.status,
      recommendation: 'Oracle runner could not parse agentic-test-loop output. Likely the underlying Playwright spawn crashed. Check the dev server (port 8080), then retry.',
    };
  }

  const failed = parsed.results?.failed || 0;
  const status = parsed.status || (run.status === 0 ? 'pass' : 'fail');
  const failures = (parsed.failures || []).map((f) => ({
    name: f.name,
    error: typeof f.error === 'string' ? f.error.slice(0, 1000) : f.error,
    classification: 'oracle-mismatch',
    route: f.route || null,
  }));

  return {
    status: failed > 0 || status === 'fail' ? 'fail' : status,
    testRunId: parsed.testRunId || null,
    oracle: parsed.oracle || (opts.feature || '(all)'),
    results: parsed.results || null,
    failures,
    durationMs,
    classification: failures.length > 0 ? 'oracle-mismatch' : null,
    recommendation: failures.length > 0
      ? `[oracle-mismatch] ${failures.length} oracle invariant(s) failed. Likely a false-green: primary Playwright suite passed but the deeper invariants caught a regression.`
      : 'Oracle invariants pass.',
  };
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--feature') opts.feature = argv[++i];
    else if (a === '--run-id') opts.runId = argv[++i];
    else if (a === '--note') opts.note = argv[++i];
  }
  runOracle(opts).then((result) => {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(result.status === 'pass' ? 0 : 1);
  }).catch((err) => {
    process.stdout.write(JSON.stringify({
      status: 'error',
      error: String(err.message || err).slice(0, 500),
    }, null, 2) + '\n');
    process.exit(2);
  });
}

module.exports = { runOracle };
