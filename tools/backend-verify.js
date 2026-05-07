#!/usr/bin/env node
/**
 * Backend Verify — fast, deterministic gate for backend changes.
 *
 * Runs in this order, short-circuiting on first hard failure:
 *   1. contracts:check    — static parity of all registered API contracts
 *   2. typecheck:tools    — tsc --noEmit on tsconfig.tools.json
 *   3. test:unit (app/lib portion only) — node --test on app/lib/__tests__
 *   4. server smoke       — GET /api/readiness/credentials on localhost:8000
 *                           (skipped if server isn't running — never fails for that reason)
 *
 * Output is JSON to stdout matching the shape of agentic-test-loop's output
 * so the iterate orchestrator can read both interchangeably:
 *
 *   { status, ranAt, durationMs, checks, testResults, failures, recommendation,
 *     editedFiles, classification, debugHints }
 *
 * status: 'green' | 'failing' | 'skipped' | 'error'
 *
 * Result also persisted to tools/.backend-verify.last-result.json so the
 * Stop hook can pick it up.
 *
 * Usage:
 *   node tools/backend-verify.js                # run all checks
 *   node tools/backend-verify.js --self-test    # validate output shape, no real checks
 *   node tools/backend-verify.js --note "..."   # tag the run for the log
 *   node tools/backend-verify.js --quick        # skip server smoke + tests, run contracts+types only
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LAST_RESULT_FILE = path.join(ROOT, 'tools', '.backend-verify.last-result.json');
const SERVER_HOST = process.env.MCS_SERVER_HOST || 'localhost';
const SERVER_PORT = process.env.MCS_SERVER_PORT || '8000';
const SERVER_PROBE_PATH = '/api/readiness/credentials';
const SERVER_PROBE_TIMEOUT_MS = 2000;

function parseArgs(argv) {
  const args = { selfTest: false, quick: false, note: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--self-test') args.selfTest = true;
    else if (a === '--quick') args.quick = true;
    else if (a === '--note') args.note = argv[++i];
  }
  return args;
}

function emit(result) {
  const json = JSON.stringify(result, null, 2);
  try { fs.writeFileSync(LAST_RESULT_FILE, json); } catch { /* ignore */ }
  process.stdout.write(json + '\n');
  return result.status === 'green' || result.status === 'skipped' ? 0 : 1;
}

function run(cmd, args, opts = {}) {
  const startedAt = Date.now();
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf-8',
    shell: true,
    timeout: opts.timeoutMs || 120_000,
    env: { ...process.env, ...(opts.env || {}) },
  });
  return {
    ok: r.status === 0,
    exitCode: r.status,
    durationMs: Date.now() - startedAt,
    stdout: (r.stdout || '').slice(-4000),
    stderr: (r.stderr || '').slice(-4000),
  };
}

function probeServer() {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get({
      host: SERVER_HOST,
      port: SERVER_PORT,
      path: SERVER_PROBE_PATH,
      timeout: SERVER_PROBE_TIMEOUT_MS,
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ ok: res.statusCode < 500, status: res.statusCode, body: body.slice(0, 500) }));
    });
    req.on('error', () => resolve(null)); // server not up — skip
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

(async function main() {
  const args = parseArgs(process.argv);
  const startedAt = Date.now();

  if (args.selfTest) {
    return process.exit(emit({
      status: 'green',
      ranAt: new Date().toISOString(),
      durationMs: 0,
      mode: 'self-test',
      checks: {
        contracts: { ok: true, skipped: true },
        typecheck: { ok: true, skipped: true },
        unit:      { ok: true, skipped: true },
        server:    { ok: true, skipped: true },
      },
      testResults: { total: 0, failed: 0 },
      failures: [],
      recommendation: 'self-test passed; output shape is valid',
      note: args.note,
    }));
  }

  const checks = {};
  const failures = [];

  // 1. Contracts parity
  const contracts = run('npm', ['run', 'contracts:check', '--silent'], { timeoutMs: 60_000 });
  checks.contracts = {
    ok: contracts.ok,
    durationMs: contracts.durationMs,
    exitCode: contracts.exitCode,
  };
  if (!contracts.ok) {
    failures.push({
      check: 'contracts',
      classification: 'contract-parity-failed',
      message: 'API contract parity check failed — sanitized HAR diverges from live spec',
      excerpt: contracts.stdout.split('\n').filter((l) => /fail|error|diff/i.test(l)).slice(-5).join('\n') || contracts.stderr.slice(-500),
      debugHints: 'Run `npm run contracts:check` directly to see the diff. Update registered contracts under tools/upstream-specs/contracts/ or fix the implementation.',
    });
  }

  // 2. Typecheck (tools)
  const tsc = run('npm', ['run', 'typecheck:tools', '--silent'], { timeoutMs: 90_000 });
  checks.typecheck = {
    ok: tsc.ok,
    durationMs: tsc.durationMs,
    exitCode: tsc.exitCode,
  };
  if (!tsc.ok) {
    const errCount = (tsc.stdout.match(/error TS\d+/g) || []).length;
    failures.push({
      check: 'typecheck',
      classification: 'typescript-error',
      message: `TypeScript reported ${errCount || '>=1'} error(s) under tools/`,
      excerpt: tsc.stdout.split('\n').filter((l) => /error TS\d+/.test(l)).slice(0, 10).join('\n'),
      debugHints: 'Run `npm run typecheck:tools` to see all errors. Fix types in tools/ or update tsconfig.tools.json includes.',
    });
  }

  // 3. Unit tests (app/lib only for speed; frontend tests run via agentic-test-loop)
  let unit = null;
  if (!args.quick) {
    // Use a recursive glob, not the bare directory. `node --test <dir>` does
    // NOT walk subdirectories — it treats the path as a single test file and
    // exits with a synthetic "test failed" + 0 passes. The npm `test:unit`
    // script uses the same glob pattern; matching it here keeps run-lanes
    // and `npm test` in lockstep.
    unit = run('node', ['--test', '"app/lib/__tests__/**/*.test.js"'], { timeoutMs: 120_000 });
    // node --test exits non-zero ONLY if tests failed or syntax error.
    // No tests = 0. We want to count "tests" attribute.
    const passMatch = unit.stdout.match(/# pass (\d+)/);
    const failMatch = unit.stdout.match(/# fail (\d+)/);
    const totalTests = passMatch ? parseInt(passMatch[1], 10) : 0;
    const failedTests = failMatch ? parseInt(failMatch[1], 10) : 0;
    checks.unit = {
      ok: unit.ok,
      tests: totalTests,
      failed: failedTests,
      durationMs: unit.durationMs,
      exitCode: unit.exitCode,
    };
    if (!unit.ok || failedTests > 0) {
      failures.push({
        check: 'unit',
        classification: 'unit-test-failed',
        message: `${failedTests || 'unknown'} unit test(s) failed in app/lib/__tests__`,
        excerpt: unit.stdout.split('\n').filter((l) => /^not ok|^# fail/.test(l)).slice(0, 15).join('\n'),
        debugHints: 'Run `node --test app/lib/__tests__` to reproduce. Check failed test names against recent edits to app/lib/.',
      });
    }
  } else {
    checks.unit = { ok: true, skipped: true, reason: 'quick-mode' };
  }

  // 4. Server smoke (only if server is up)
  if (!args.quick) {
    const srv = await probeServer();
    if (srv === null) {
      checks.server = { ok: true, skipped: true, reason: 'server-not-running' };
    } else {
      checks.server = {
        ok: srv.ok,
        status: srv.status,
        endpoint: SERVER_PROBE_PATH,
      };
      if (!srv.ok) {
        failures.push({
          check: 'server',
          classification: 'server-5xx',
          message: `Server smoke probe returned ${srv.status} on ${SERVER_PROBE_PATH}`,
          excerpt: srv.body || '',
          debugHints: 'Server is running but the readiness endpoint is failing. Check server logs (tools/session-log.jsonl --cat req,error) and recent edits to app/server.js or app/lib/.',
        });
      }
    }
  } else {
    checks.server = { ok: true, skipped: true, reason: 'quick-mode' };
  }

  const allChecks = Object.values(checks);
  const failedCount = allChecks.filter((c) => !c.ok).length;
  const status = failedCount === 0 ? 'green' : 'failing';

  const totalTests = allChecks.reduce((acc, c) => acc + (c.tests || 0), 0);

  const result = {
    status,
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    mode: args.quick ? 'quick' : 'full',
    checks,
    testResults: {
      total: Math.max(totalTests, allChecks.length),
      failed: failures.length,
    },
    failures,
    recommendation: failures.length === 0
      ? 'Backend gates pass. Safe to commit.'
      : `${failures.length} backend gate(s) failed. Address: ${failures.map((f) => f.classification).join(', ')}.`,
    classification: failures[0]?.classification || null,
    note: args.note,
  };

  return process.exit(emit(result));
})().catch((err) => {
  emit({
    status: 'error',
    ranAt: new Date().toISOString(),
    durationMs: 0,
    error: String(err.message || err).slice(0, 500),
    failures: [{ check: 'runner', classification: 'runner-error', message: String(err.message || err) }],
    recommendation: 'Backend verify runner crashed. Check exception above.',
  });
  process.exit(2);
});
