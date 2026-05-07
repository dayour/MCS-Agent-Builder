#!/usr/bin/env node
/**
 * Agentic Test Loop — Autonomous test-fix-iterate orchestrator
 *
 * Wraps verify-ui.js and Playwright smoke tests with structured output,
 * iteration logging, trend detection, and failure classification so that
 * Claude Code can autonomously test, diagnose, fix, and re-verify.
 *
 * Commands:
 *   run            Run tests and log results (default)
 *   expand         Preview feature expansion without running tests
 *   status         Show iteration history and trend
 *   failures       Show detailed failures from the last run (enriched with session logs)
 *   reset          Clear the test log for a fresh start
 *   screenshot     Take a screenshot of a specific route via Playwright CLI
 *   mcp-probe      Execute data-driven exploratory checks from feature-map.json
 *   oracle         Run scenario oracles (semantic invariants for top features)
 *   after          Post-event verification (e.g. after mcs-eval, mcs-build)
 *   bundle         Bundle all artifacts for one testRunId (manifest + refs)
 *   logs           Read/filter/summarize session logs (frontend + backend telemetry)
 *   logs-clear     Clear the session log file
 *   watch          Semi-auto: monitor logs + file changes, trigger test runs
 *   self-test      Verify the parseResults honesty gate (no Playwright/server needed)
 *
 * Usage:
 *   node tools/agentic-test-loop.js run [--start-server] [--route /path] [--feature auth]
 *   node tools/agentic-test-loop.js expand auth
 *   node tools/agentic-test-loop.js status
 *   node tools/agentic-test-loop.js failures
 *   node tools/agentic-test-loop.js reset
 *   node tools/agentic-test-loop.js screenshot /evaluate
 *   node tools/agentic-test-loop.js logs [--since 5m --cat error,net --route /build --summary]
 *   node tools/agentic-test-loop.js logs-clear
 *   node tools/agentic-test-loop.js watch [--mode assist|auto] [--cooldown 30] [--max-runs 10]
 *
 * Output: Structured JSON to stdout (machine-readable for Claude Code)
 * Log:    Appends JSONL to tools/test-log.jsonl (iteration history)
 */

const http = require('http');
const { execSync, spawnSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const ROOT = path.join(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT, 'app', 'frontend');
const RESULTS_FILE = path.join(FRONTEND_DIR, 'e2e', 'results.json');
const MCP_PROBE_RESULTS_FILE = path.join(FRONTEND_DIR, 'e2e', 'mcp-probe-results.json');
const FEATURE_MAP_FILE = path.join(ROOT, 'knowledge', 'feature-map.json');
const LOG_FILE = path.join(__dirname, 'test-log.jsonl');
const SESSION_LOG_FILE = path.join(__dirname, 'session-log.jsonl');
const BUNDLES_DIR = path.join(__dirname, 'bundles');
const DEV_SERVER_URL = 'http://localhost:8080';
const BACKEND_URL = 'http://localhost:8000';
const MAX_ITERATIONS = 10;
const STALL_THRESHOLD = 3; // same failure count N times = stalled
const TEST_RUN_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0] && !args[0].startsWith('-') ? args[0] : 'run';
  const opts = {
    command, route: null, feature: null, startServer: false,
    note: '', runId: null, autoCommit: false, requireOracle: false,
  };

  for (let i = command === args[0] ? 1 : 0; i < args.length; i++) {
    switch (args[i]) {
      case '--route': opts.route = args[++i]; break;
      case '--feature': opts.feature = args[++i]; break;
      case '--project': opts.project = args[++i]; break;
      case '--start-server': opts.startServer = true; break;
      case '--note': opts.note = args[++i] || ''; break;
      case '--run-id': opts.runId = args[++i]; break;
      case '--auto-commit': opts.autoCommit = true; break;
      case '--require-oracle': opts.requireOracle = true; break;
      case '--no-oracle': opts.requireOracle = false; break;
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function getGitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim();
  } catch { return 'unknown'; }
}

function getChangedFiles() {
  try {
    const out = execSync('git diff --name-only HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim();
    return out ? out.split('\n') : [];
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// Opt-in auto-commit after stable green
// Requires: current run green + previous run green + no test-file modifications
// without allow-test-change + no staged content outside safe paths
// ---------------------------------------------------------------------------
const SAFE_AUTO_COMMIT_PATHS = [
  /^app\/frontend\/src\//,
  /^app\/lib\//,
  /^app\/server\.js$/,
];
const TEST_FILE_PATHS = [
  /^app\/frontend\/e2e\//,
  /^knowledge\/feature-map\.json$/,
  /^app\/frontend\/playwright\.config\.ts$/,
];

function maybeAutoCommit(currentEntry, opts, log) {
  const reasons = [];
  if (!opts.autoCommit) return { skipped: true, reason: 'auto-commit flag not set' };
  if (currentEntry.status !== 'green') return { skipped: true, reason: `run status is ${currentEntry.status}` };

  // Require 2 consecutive green runs.
  const prev = log[log.length - 1]; // the last LOGGED entry is current; second-to-last is prior
  // Actually log doesn't yet include currentEntry at this point — it's about to be appended.
  // So log[length-1] IS the previous run.
  if (!prev || prev.status !== 'green') {
    return { skipped: true, reason: `previous run was ${prev?.status || 'none'}, need 2 consecutive greens` };
  }

  const changed = getChangedFiles();
  if (changed.length === 0) return { skipped: true, reason: 'no file changes to commit' };

  // Reject if any test files changed without allow-test-change env or commit-msg bypass.
  const testChanges = changed.filter((f) => TEST_FILE_PATHS.some((p) => p.test(f)));
  const allowTestEnv = process.env.ALLOW_TEST_CHANGE;
  if (testChanges.length > 0 && (!allowTestEnv || allowTestEnv === '0' || allowTestEnv === 'false')) {
    return {
      skipped: true,
      reason: `test-file changes need ALLOW_TEST_CHANGE env: ${testChanges.join(', ')}`,
    };
  }

  // Reject if any changed file is OUTSIDE safe paths (protects knowledge/, .claude/, tools/).
  const unsafe = changed.filter((f) =>
    !SAFE_AUTO_COMMIT_PATHS.some((p) => p.test(f)) &&
    !TEST_FILE_PATHS.some((p) => p.test(f)),
  );
  if (unsafe.length > 0) {
    return { skipped: true, reason: `changes outside safe paths: ${unsafe.slice(0, 3).join(', ')}` };
  }

  // Reject if anything is already staged — don't silently mix concerns.
  try {
    const staged = execSync('git diff --cached --name-only', { cwd: ROOT, encoding: 'utf-8' }).trim();
    if (staged.length > 0) return { skipped: true, reason: 'other changes already staged' };
  } catch { /* no staging area probably fine */ }

  // Stage only safe + allowed test files by exact path.
  const toStage = changed.filter((f) =>
    SAFE_AUTO_COMMIT_PATHS.some((p) => p.test(f)) ||
    (TEST_FILE_PATHS.some((p) => p.test(f)) && allowTestEnv && allowTestEnv !== '0'),
  );
  if (toStage.length === 0) return { skipped: true, reason: 'nothing in safe paths to auto-commit' };

  const noteSuffix = opts.note ? ` — ${opts.note}` : '';
  const msg = `test: green x2, auto-commit from agentic loop${noteSuffix}\n\nIteration ${currentEntry.iteration}, run ${currentEntry.testRunId || 'n/a'}\n${toStage.length} file(s): ${toStage.slice(0, 5).join(', ')}${toStage.length > 5 ? ` +${toStage.length - 5}` : ''}`;
  if (testChanges.length > 0 && allowTestEnv) {
    // Embed the justification for audit trail.
    const justification = typeof allowTestEnv === 'string' && allowTestEnv !== '1' ? allowTestEnv : 'env-bypass';
    // Extra newline pair then the allow-test-change line so the pre-commit guard matches it.
    return { skipped: false, toStage, msg: `${msg}\n\nallow-test-change: ${justification.slice(0, 120)}` };
  }

  return { skipped: false, toStage, msg };
}

function performAutoCommit(plan) {
  const { toStage, msg } = plan;
  try {
    // Stage files explicitly (not git add -A — don't pick up secrets/temp files).
    for (const f of toStage) {
      execSync(`git add -- "${f}"`, { cwd: ROOT, encoding: 'utf-8' });
    }
    // Use stdin for commit message to avoid shell quoting pitfalls across Windows/Unix.
    const tmpMsgFile = path.join(ROOT, '.git', 'AGENTIC_COMMIT_MSG.tmp');
    fs.writeFileSync(tmpMsgFile, msg);
    try {
      execSync(`git commit -F "${tmpMsgFile}"`, { cwd: ROOT, encoding: 'utf-8' });
    } finally {
      try { fs.unlinkSync(tmpMsgFile); } catch { /* ignore */ }
    }
    const sha = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim();
    return { committed: true, sha, files: toStage };
  } catch (err) {
    return { committed: false, error: (err.message || '').slice(0, 300) };
  }
}

function checkServer(url, timeout = 3000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeout);
    http.get(url, (res) => { clearTimeout(timer); res.resume(); resolve(true); })
      .on('error', () => { clearTimeout(timer); resolve(false); });
  });
}

async function waitForServer(url, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await checkServer(url, 2000)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function readLog() {
  if (!fs.existsSync(LOG_FILE)) return [];
  return fs.readFileSync(LOG_FILE, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

function appendLog(entry) {
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
}

// ---------------------------------------------------------------------------
// Feature expansion engine
// ---------------------------------------------------------------------------
function loadFeatureMap() {
  if (!fs.existsSync(FEATURE_MAP_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(FEATURE_MAP_FILE, 'utf-8')); }
  catch { return null; }
}

function resolveFeature(query, featureMap) {
  if (!featureMap?.features) return null;
  const q = query.toLowerCase().trim();

  // Direct match by feature key
  if (featureMap.features[q]) return { key: q, ...featureMap.features[q] };

  // Match by alias
  for (const [key, feat] of Object.entries(featureMap.features)) {
    if (feat.aliases?.some((a) => a.toLowerCase() === q)) {
      return { key, ...feat };
    }
  }

  // Fuzzy match: check if query is contained in any alias
  for (const [key, feat] of Object.entries(featureMap.features)) {
    if (feat.aliases?.some((a) => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()))) {
      return { key, ...feat };
    }
  }

  return null;
}

function expandFeature(featureKey, featureMap, depth = 0) {
  if (depth > 2 || !featureMap?.features) return { routes: [], tags: [], mcp_checks: [], features: [] };

  const feat = featureMap.features[featureKey];
  if (!feat) return { routes: [], tags: [], mcp_checks: [], features: [] };

  const result = {
    routes: new Set(feat.routes || []),
    tags: new Set(feat.tags || []),
    mcp_checks: [...(feat.mcp_checks || [])],
    features: [{ key: featureKey, tier: depth === 0 ? 'direct' : depth === 1 ? 'adjacent' : 'broad' }],
  };

  // Expand related features (one level deep for adjacent, two for broad)
  for (const relatedKey of feat.related || []) {
    const related = featureMap.features[relatedKey];
    if (!related) continue;

    result.features.push({ key: relatedKey, tier: depth === 0 ? 'adjacent' : 'broad' });
    for (const r of related.routes || []) result.routes.add(r);
    for (const t of related.tags || []) result.tags.add(t);

    // Only go one more level deep
    if (depth === 0) {
      const deeper = expandFeature(relatedKey, featureMap, depth + 1);
      for (const r of deeper.routes) result.routes.add(r);
      for (const t of deeper.tags) result.tags.add(t);
      result.mcp_checks.push(...(related.mcp_checks || []));
    }
  }

  return {
    routes: [...result.routes],
    tags: [...result.tags],
    mcp_checks: result.mcp_checks,
    features: result.features,
  };
}

function buildGrepFromTags(tags) {
  // Build a Playwright --grep pattern that matches any route with these tags
  // Since tests are named like "Home (/) loads without errors", we grep by route names
  // Read the helpers to get the tag-to-route mapping
  const helpersPath = path.join(FRONTEND_DIR, 'e2e', 'helpers.ts');
  if (!fs.existsSync(helpersPath)) return null;

  const helpersContent = fs.readFileSync(helpersPath, 'utf-8');
  const tagSet = new Set(tags);
  const matchingRouteNames = [];

  // Parse route definitions from helpers.ts
  const routeRegex = /{\s*path:\s*'([^']+)',\s*name:\s*'([^']+)'.*?tags:\s*\[([^\]]*)\]/g;
  let match;
  while ((match = routeRegex.exec(helpersContent))) {
    const routeTags = match[3].replace(/'/g, '').split(',').map((t) => t.trim()).filter(Boolean);
    if (routeTags.some((t) => tagSet.has(t))) {
      matchingRouteNames.push(match[2]); // Use route name for grep
    }
  }

  if (matchingRouteNames.length === 0) return null;
  // Build grep regex: "Home|My Stuff|Discover"
  return matchingRouteNames.join('|');
}

// ---------------------------------------------------------------------------
// Classify failures
// ---------------------------------------------------------------------------
function classifyFailure(name, error) {
  const e = (error || '').toLowerCase();
  if (e.includes('timeout') || e.includes('timed out')) return 'timeout';
  if (e.includes('console error') || e.includes('console.error')) return 'console-error';
  if (e.includes('not visible') || e.includes('not attached')) return 'element-missing';
  if (e.includes('error boundary') || e.includes('something went wrong')) return 'react-crash';
  if (e.includes('blank') || e.includes('length(0)')) return 'blank-page';
  if (e.includes('navigation') || e.includes('nav')) return 'navigation';
  if (e.includes('api') || e.includes('proxy') || e.includes('500')) return 'api-error';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Compute trend from log history
// ---------------------------------------------------------------------------
function computeTrend(log, currentFailCount) {
  if (log.length === 0) return currentFailCount === 0 ? 'green' : 'first-run';

  const recent = log.slice(-STALL_THRESHOLD);
  const recentFailCounts = recent.map((e) => e.testResults?.failed || 0);

  if (currentFailCount === 0) return 'green';

  // Check stall: same failure count for STALL_THRESHOLD runs
  if (recentFailCounts.length >= STALL_THRESHOLD &&
      recentFailCounts.every((c) => c === currentFailCount)) {
    return 'stalled';
  }

  const lastFailCount = recentFailCounts[recentFailCounts.length - 1] || 0;
  if (currentFailCount < lastFailCount) return 'improving';
  if (currentFailCount > lastFailCount) return 'regressing';
  return 'flat';
}

// ---------------------------------------------------------------------------
// Parse Playwright results.json
//
// Returns { state, passed, failed, skipped, total, failures, allTests }
// where state is:
//   'ok'          — file present, valid JSON, has at least one test result
//   'missing'     — results file does not exist (Playwright never wrote it)
//   'stale'       — file exists but mtime is older than the run's spawn time
//   'parse-error' — file exists but is not valid JSON
//   'empty'       — file parsed but has zero tests (grep matched nothing,
//                   or Playwright crashed before running anything)
//
// cmdRun must check state — it is unsafe to interpret { failed: 0 } as green
// without confirming state === 'ok'.
// ---------------------------------------------------------------------------
function parseResults(spawnTime, filePath) {
  const file = filePath || RESULTS_FILE;
  const empty = { state: 'missing', passed: 0, failed: 0, skipped: 0, total: 0, failures: [], allTests: [] };

  if (!fs.existsSync(file)) {
    return empty;
  }

  // Stale file from a previous run that Playwright didn't overwrite.
  // cmdRun unlinks before spawn so any surviving file is suspect, but if a
  // spawnTime was passed, also enforce mtime > spawnTime as a belt-and-braces.
  if (typeof spawnTime === 'number') {
    try {
      const stat = fs.statSync(file);
      if (stat.mtimeMs < spawnTime) {
        return { ...empty, state: 'stale' };
      }
    } catch {
      return empty;
    }
  }

  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return { ...empty, state: 'parse-error' }; }

  let passed = 0, failed = 0, skipped = 0;
  const failures = [];
  const allTests = [];

  function walk(suite) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const result = test.results?.[0];
        const status = result?.status || 'unknown';
        const duration = result?.duration || 0;
        const errorMsg = result?.error?.message || '';
        const errorSnippet = result?.error?.snippet || '';

        const entry = {
          name: spec.title,
          suite: suite.title,
          status,
          duration,
        };

        if (status === 'passed') { passed++; }
        else if (status === 'failed' || status === 'timedOut') {
          failed++;
          // Extract route from test name (e.g., "Home (/) loads without errors" -> "/")
          const routeMatch = spec.title.match(/\(([^)]+)\)/);
          const route = routeMatch ? routeMatch[1] : null;

          failures.push({
            name: spec.title,
            suite: suite.title,
            route,
            error: errorMsg.slice(0, 500),
            errorSnippet: errorSnippet.slice(0, 300),
            classification: classifyFailure(spec.title, errorMsg),
            duration,
            attachments: (result?.attachments || []).map((a) => ({
              name: a.name,
              path: a.path,
              contentType: a.contentType,
            })),
          });
        } else { skipped++; }

        allTests.push(entry);
      }
    }
    for (const child of suite.suites || []) walk(child);
  }

  for (const suite of data.suites || []) walk(suite);
  const total = passed + failed + skipped;
  return {
    state: total === 0 ? 'empty' : 'ok',
    passed, failed, skipped, total, failures, allTests,
  };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdRun(opts) {
  const log = readLog();
  const iteration = log.length + 1;

  if (iteration > MAX_ITERATIONS) {
    const result = {
      status: 'stopped',
      reason: `Max iterations (${MAX_ITERATIONS}) reached. Escalate to user.`,
      iteration,
      log: log.slice(-3),
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  // Check server
  const frontendUp = await checkServer(DEV_SERVER_URL);
  const backendUp = await checkServer(BACKEND_URL);

  if (!frontendUp) {
    if (opts.startServer) {
      // Start dev server in background
      const child = spawn('npm', ['run', 'dev'], {
        cwd: FRONTEND_DIR, stdio: 'ignore', detached: true, shell: true,
      });
      child.unref();
      const ready = await waitForServer(DEV_SERVER_URL);
      if (!ready) {
        console.log(JSON.stringify({
          status: 'error',
          reason: 'Dev server failed to start within 30s',
          action: 'Start manually: cd app/frontend && npm run dev',
        }, null, 2));
        process.exit(2);
      }
    } else {
      console.log(JSON.stringify({
        status: 'error',
        reason: 'Dev server not running on port 8080',
        action: 'Run with --start-server or start manually: cd app/frontend && npm run dev',
      }, null, 2));
      process.exit(2);
    }
  }

  // Feature expansion: resolve feature → tags → grep pattern
  let featureExpansion = null;
  if (opts.feature) {
    const featureMap = loadFeatureMap();
    const resolved = resolveFeature(opts.feature, featureMap);
    if (resolved) {
      featureExpansion = expandFeature(resolved.key, featureMap);
      featureExpansion.resolvedAs = resolved.key;
      featureExpansion.description = resolved.description;
    }
  }

  // Run Playwright tests via direct Node invocation (bypasses npx shell quirks on Windows)
  const playwrightCli = path.resolve(FRONTEND_DIR, 'node_modules', '@playwright', 'test', 'cli.js');
  // Default to the smoke project (the documented CI gate, ~2 min). The full
  // suite (~140 tests, ~11 min) used to be the default but consistently
  // timed out at the 6-min spawnSync limit, leaving every iteration as a
  // ghost-failure ("results.json missing"). Use --project=<name> to override.
  const playwrightArgs = ['test'];
  const projectArg = opts.project || 'smoke';
  playwrightArgs.push('--project', projectArg);
  if (featureExpansion) {
    // Use tag-based grep from feature expansion
    const grepPattern = buildGrepFromTags(featureExpansion.tags);
    if (grepPattern) playwrightArgs.push('--grep', grepPattern);
    // If no grep pattern could be built, run all tests (broad coverage)
  } else if (opts.route) {
    // Extract route name for grep. Handle MSYS path translation on Windows Git Bash
    // where /mystuff becomes "C:Program Files/Git/mystuff" at the arg level.
    let grepPattern = opts.route;
    if (/^[A-Z]:/.test(grepPattern) || grepPattern.includes('Program Files')) {
      // MSYS-mangled path — extract the last segment
      grepPattern = grepPattern.split('/').pop() || grepPattern;
    }
    grepPattern = grepPattern.replace(/^\//, '');
    playwrightArgs.push('--grep', grepPattern);
  }

  // Clear stale results
  if (fs.existsSync(RESULTS_FILE)) fs.unlinkSync(RESULTS_FILE);

  // Correlation ID: pass TEST_RUN_ID so tests that opt into attachTestRunId can
  // stamp their frontend + backend events. Unused by tests that don't opt in.
  const runId = opts.runId && TEST_RUN_ID_RE.test(opts.runId) ? opts.runId : generateRunId('run');
  const spawnTime = Date.now();
  const testRun = spawnSync(process.execPath, [playwrightCli, ...playwrightArgs], {
    cwd: FRONTEND_DIR,
    encoding: 'utf-8',
    timeout: 360_000,
    env: { ...process.env, TEST_RUN_ID: runId },
  });
  const testOutput = testRun.stdout || '';
  const testStderr = testRun.stderr || '';
  const testExitCode = typeof testRun.status === 'number' ? testRun.status : null;
  const testSpawnError = testRun.error ? String(testRun.error.message || testRun.error) : null;

  // Parse results — must check parsedState before treating failed===0 as green.
  // Playwright can crash, hang, or match no tests; in any of those cases
  // results.json is missing/empty/stale and we must not green-light silence.
  const results = parseResults(spawnTime);
  const parsedState = results.state;
  const trend = computeTrend(log, results.failed);
  const gitSha = getGitSha();
  const changedFiles = getChangedFiles();

  // Build structured entry
  const entry = {
    iteration,
    timestamp: new Date().toISOString(),
    gitSha,
    testRunId: runId,
    serverStatus: { frontend: true, backend: backendUp },
    testResults: {
      passed: results.passed,
      failed: results.failed,
      skipped: results.skipped,
      total: results.total,
      parsedState,
      playwrightExitCode: testExitCode,
    },
    failures: results.failures,
    trend,
    changedFiles,
    note: opts.note,
    duration: results.allTests.reduce((sum, t) => sum + (t.duration || 0), 0),
    featureExpansion: featureExpansion ? {
      query: opts.feature,
      resolvedAs: featureExpansion.resolvedAs,
      description: featureExpansion.description,
      features: featureExpansion.features,
      routes: featureExpansion.routes,
      tags: featureExpansion.tags,
      mcpChecks: featureExpansion.mcp_checks?.length || 0,
    } : null,
  };

  // Honesty gate: refuse to report green when Playwright produced no usable
  // results. Past silent-green runs (test-log entries with total:0 reported as
  // green) hid real regressions; treat any non-ok parsed state as stalled and
  // surface the underlying cause so the next turn can investigate instead of
  // shipping broken UI.
  if (parsedState !== 'ok') {
    const reasonByState = {
      missing: 'Playwright did not write results.json — process likely crashed before any test ran.',
      stale: 'results.json mtime is older than spawn time — Playwright did not refresh it.',
      'parse-error': 'results.json is not valid JSON — reporter aborted mid-write.',
      empty: featureExpansion
        ? `No tests matched the feature filter "${opts.feature}". Check tags in e2e/helpers.ts.`
        : 'Playwright ran but reported zero tests. Check the test file glob.',
    };
    entry.status = 'stalled';
    entry.recommendation =
      `[honesty-gate] ${reasonByState[parsedState] || `Unknown parsed state: ${parsedState}`}` +
      (testExitCode != null && testExitCode !== 0 ? ` (exit ${testExitCode})` : '') +
      (testSpawnError ? ` spawn-error: ${testSpawnError}` : '') +
      (testStderr ? ` stderr: ${testStderr.slice(0, 200).replace(/\s+/g, ' ').trim()}` : '');
  } else if (results.failed === 0) {
    entry.recommendation = 'All tests passing. System is green.';
    entry.status = 'green';
  } else if (trend === 'stalled') {
    entry.recommendation = `Stalled at ${results.failed} failures for ${STALL_THRESHOLD}+ iterations. Change approach or escalate.`;
    entry.status = 'stalled';
  } else if (trend === 'regressing') {
    entry.recommendation = `Regression: ${results.failed} failures (was ${log[log.length-1]?.testResults?.failed || 0}). Revert last change and investigate.`;
    entry.status = 'regressing';
  } else {
    const byClass = {};
    for (const f of results.failures) {
      byClass[f.classification] = byClass[f.classification] || [];
      byClass[f.classification].push(f.route || f.name);
    }
    const summary = Object.entries(byClass)
      .map(([cls, routes]) => `${cls}: ${routes.join(', ')}`)
      .join('; ');
    entry.recommendation = `Fix ${results.failed} failure(s) — ${summary}`;
    entry.status = 'failing';
  }

  // False-green prevention: after Playwright green, optionally run oracle
  // pass to catch regressions that pass formal tests but break user-visible
  // behavior. Demote to 'failing' with classification 'oracle-mismatch' on
  // any oracle invariant break.
  if (entry.status === 'green' && opts.requireOracle) {
    const oracleArgs = ['oracle'];
    if (opts.feature) oracleArgs.push('--feature', opts.feature);
    oracleArgs.push('--run-id', `${runId}-oracle`);
    oracleArgs.push('--note', `auto-fired by run --require-oracle (testRunId=${runId})`);
    const oracleRun = spawnSync(process.execPath, [__filename, ...oracleArgs], {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 240_000,
      env: { ...process.env, CLAUDE_HEADLESS: '1' },
    });
    let oracleResult = null;
    try { oracleResult = JSON.parse(oracleRun.stdout || ''); } catch { /* ignore */ }

    entry.oracle = {
      ran: true,
      status: oracleResult?.status || (oracleRun.status === 0 ? 'pass' : 'fail'),
      runId: oracleResult?.testRunId || `${runId}-oracle`,
      results: oracleResult?.results || null,
      failures: (oracleResult?.failures || []).slice(0, 5).map((f) => ({
        name: f.name,
        error: typeof f.error === 'string' ? f.error.slice(0, 500) : f.error,
      })),
    };

    const oracleFailed = oracleRun.status !== 0
      || (oracleResult && oracleResult.status === 'fail')
      || (oracleResult?.results?.failed > 0);

    if (oracleFailed) {
      entry.status = 'failing';
      // Add oracle failures to the entry's failures list with the
      // 'oracle-mismatch' classification so existing triage logic groups them.
      const oracleFailures = (oracleResult?.failures || []).map((f) => ({
        name: f.name,
        error: typeof f.error === 'string' ? f.error.slice(0, 1000) : f.error,
        classification: 'oracle-mismatch',
        route: f.route || null,
        oracle: true,
      }));
      entry.failures = [...(entry.failures || []), ...oracleFailures];
      entry.testResults = {
        ...entry.testResults,
        failed: (entry.testResults?.failed || 0) + (oracleResult?.results?.failed || oracleFailures.length || 1),
        oracleFailed: oracleResult?.results?.failed || oracleFailures.length || 1,
      };
      entry.recommendation =
        `[oracle-mismatch] Playwright primary tests passed but oracle invariants failed ` +
        `(${entry.testResults.oracleFailed} oracle test(s)). False green caught — fix the regression and re-run. ` +
        `Inspect: \`node tools/agentic-test-loop.js failures\` and \`cat ${path.relative(ROOT, RESULTS_FILE).replace(/\\/g, '/')}\`.`;
    }
  } else if (entry.status === 'green' && !opts.requireOracle) {
    entry.oracle = { ran: false, reason: 'flag --require-oracle not set' };
  }

  // Evaluate auto-commit BEFORE appending to log — so "previous run" means prior green
  const autoCommitPlan = maybeAutoCommit(entry, opts, log);

  // Append to log
  appendLog(entry);

  // Execute auto-commit if approved
  let autoCommitResult = null;
  if (!autoCommitPlan.skipped) {
    autoCommitResult = performAutoCommit(autoCommitPlan);
    entry.autoCommit = autoCommitResult;
  } else if (opts.autoCommit) {
    entry.autoCommit = { skipped: true, reason: autoCommitPlan.reason };
  }

  // Output to stdout
  console.log(JSON.stringify(entry, null, 2));
  // Exit non-zero on any non-green status so hooks and CI see a real failure
  process.exit(entry.status === 'green' ? 0 : 1);
}

function cmdStatus() {
  const log = readLog();
  if (log.length === 0) {
    console.log(JSON.stringify({ status: 'no-history', message: 'No test runs logged yet. Run: node tools/agentic-test-loop.js run' }, null, 2));
    return;
  }

  const latest = log[log.length - 1];
  const history = log.map((e) => ({
    iteration: e.iteration,
    timestamp: e.timestamp,
    passed: e.testResults?.passed,
    failed: e.testResults?.failed,
    trend: e.trend,
    note: e.note,
  }));

  console.log(JSON.stringify({
    totalIterations: log.length,
    latest: {
      iteration: latest.iteration,
      status: latest.status,
      passed: latest.testResults?.passed,
      failed: latest.testResults?.failed,
      trend: latest.trend,
      recommendation: latest.recommendation,
    },
    history,
  }, null, 2));
}

function cmdFailures() {
  const log = readLog();
  if (log.length === 0) {
    console.log(JSON.stringify({ message: 'No test runs logged.' }, null, 2));
    return;
  }

  const latest = log[log.length - 1];
  if (!latest.failures || latest.failures.length === 0) {
    console.log(JSON.stringify({ message: 'No failures in the last run.', iteration: latest.iteration }, null, 2));
    return;
  }

  // Enrich failures with session log context (errors + failed requests on failing routes)
  let sessionContext = null;
  if (fs.existsSync(SESSION_LOG_FILE)) {
    try {
      const sessionLines = fs.readFileSync(SESSION_LOG_FILE, 'utf-8').trim().split('\n').filter(Boolean);
      // Look back 5 minutes from the test run timestamp
      const cutoff = new Date(new Date(latest.timestamp).getTime() - 5 * 60 * 1000);
      const failingRoutes = new Set(latest.failures.map(f => f.route).filter(Boolean));

      const relevantEvents = sessionLines
        .map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(Boolean)
        .filter(e => new Date(e.ts) >= cutoff)
        .filter(e =>
          e.cat === 'error' ||
          (e.cat === 'net' && !e.data?.ok) ||
          (e.cat === 'console' && e.type === 'error') ||
          (failingRoutes.has(e.route) && (e.cat === 'error' || e.cat === 'net'))
        )
        .slice(-30);

      if (relevantEvents.length > 0) {
        sessionContext = {
          eventsFound: relevantEvents.length,
          errors: relevantEvents.filter(e => e.cat === 'error').map(e => ({
            type: e.type,
            message: e.data?.message,
            route: e.route,
          })),
          failedRequests: relevantEvents.filter(e => e.cat === 'net' && !e.data?.ok).map(e => ({
            method: e.data?.method,
            url: e.data?.url,
            status: e.data?.status,
            route: e.route,
          })),
          consoleErrors: relevantEvents.filter(e => e.cat === 'console' && e.type === 'error').map(e => ({
            args: e.data?.args?.slice(0, 2),
            route: e.route,
          })),
        };
      }
    } catch { /* ignore session log parse errors */ }
  }

  console.log(JSON.stringify({
    iteration: latest.iteration,
    timestamp: latest.timestamp,
    failureCount: latest.failures.length,
    failures: latest.failures,
    sessionContext,
    recommendation: latest.recommendation,
    debugHints: latest.failures.map((f) => {
      const hints = [`Route: ${f.route || 'unknown'}`];
      switch (f.classification) {
        case 'timeout':
          hints.push('Element not found in time. Check selector, component render, or loading state.');
          hints.push(`Use Playwright MCP: browser_navigate to http://localhost:8080/#${f.route} then browser_snapshot`);
          break;
        case 'console-error':
          hints.push('JS error in console. Check browser_console_messages via Playwright MCP.');
          hints.push('Common: missing API response, undefined prop, import error.');
          break;
        case 'element-missing':
          hints.push('Expected element not in DOM. Check component render conditions and marker text.');
          hints.push(`Use Playwright MCP: browser_snapshot on route ${f.route} to see actual DOM.`);
          break;
        case 'react-crash':
          hints.push('React error boundary triggered. Check component tree for thrown errors.');
          hints.push('Use Playwright MCP: browser_console_messages for the stack trace.');
          break;
        case 'blank-page':
          hints.push('Page rendered empty. Check route definition in App.tsx and component imports.');
          break;
        case 'api-error':
          hints.push('Backend API issue. Check if server.js is running on port 8000.');
          break;
        default:
          hints.push('Unknown failure type. Use Playwright MCP to visually inspect the route.');
      }
      return { name: f.name, route: f.route, classification: f.classification, hints };
    }),
  }, null, 2));
}

function cmdExpand(query) {
  if (!query) {
    console.log(JSON.stringify({ error: 'Provide a feature: node tools/agentic-test-loop.js expand auth' }, null, 2));
    process.exit(1);
  }

  const featureMap = loadFeatureMap();
  if (!featureMap) {
    console.log(JSON.stringify({ error: 'Feature map not found at ' + FEATURE_MAP_FILE }, null, 2));
    process.exit(1);
  }

  const resolved = resolveFeature(query, featureMap);
  if (!resolved) {
    const available = Object.keys(featureMap.features).join(', ');
    console.log(JSON.stringify({
      error: `Feature "${query}" not found`,
      available,
      hint: 'Try one of the feature names above, or an alias like "login", "nav", "eval"',
    }, null, 2));
    process.exit(1);
  }

  const expansion = expandFeature(resolved.key, featureMap);
  const grepPattern = buildGrepFromTags(expansion.tags);

  console.log(JSON.stringify({
    query,
    resolvedAs: resolved.key,
    description: resolved.description,
    expansion: {
      features: expansion.features,
      routes: expansion.routes,
      tags: expansion.tags,
      grepPattern: grepPattern || '(all tests — no tag-based filter)',
      mcpChecks: expansion.mcp_checks,
    },
    testCommand: grepPattern
      ? `node tools/agentic-test-loop.js run --feature ${query}`
      : 'node tools/agentic-test-loop.js run (runs all tests)',
  }, null, 2));
}

function cmdReset() {
  if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);
  console.log(JSON.stringify({ status: 'reset', message: 'Test log cleared.' }, null, 2));
}

/**
 * GPT-diagnose: Send test failures to GPT-5.5 for independent root-cause analysis.
 * Reads error-context.md files from test-results/ and feeds them to the diagnose command.
 */
function cmdGptDiagnose() {
  const log = readLog();
  if (log.length === 0) {
    console.log(JSON.stringify({ message: 'No test runs logged. Run tests first.' }, null, 2));
    return;
  }

  const latest = log[log.length - 1];
  if (!latest.failures || latest.failures.length === 0) {
    console.log(JSON.stringify({ message: 'No failures to diagnose — last run was green.' }, null, 2));
    return;
  }

  // Collect error-context.md files from test-results/
  const resultsDir = path.join(FRONTEND_DIR, 'test-results');
  let contextFiles = [];
  if (fs.existsSync(resultsDir)) {
    const dirs = fs.readdirSync(resultsDir).filter(d =>
      fs.statSync(path.join(resultsDir, d)).isDirectory()
    );
    for (const d of dirs) {
      const ctxFile = path.join(resultsDir, d, 'error-context.md');
      if (fs.existsSync(ctxFile)) {
        contextFiles.push(ctxFile);
      }
    }
  }

  // Build failure summary
  const failureSummary = latest.failures.map(f =>
    `- ${f.name}: ${f.classification} — ${(f.error || '').slice(0, 200)}`
  ).join('\n');

  // Read up to 5 error-context files (most recent)
  const maxContextFiles = Math.min(contextFiles.length, 5);
  const contextContent = contextFiles.slice(0, maxContextFiles).map(f => {
    try { return fs.readFileSync(f, 'utf8').slice(0, 3000); } catch { return ''; }
  }).filter(Boolean).join('\n---\n');

  const question = `Playwright E2E test suite has ${latest.failures.length} failures out of ${(latest.testResults?.passed || 0) + latest.failures.length} tests.

Failure summary:
${failureSummary}

${contextContent ? `Error context (DOM snapshots + test source from ${maxContextFiles} failures):\n${contextContent}` : ''}

Diagnose the root causes. Group related failures. Suggest specific fixes (selectors, state seeding, timing). Prioritize by impact.`;

  // Call GPT via multi-model-review.js diagnose
  const reviewScript = path.join(__dirname, 'multi-model-review.js');
  try {
    const result = spawnSync(process.execPath, [reviewScript, 'diagnose', '-q', question], {
      encoding: 'utf-8', timeout: 120_000, cwd: path.join(__dirname, '..'),
    });
    if (result.stdout) {
      try {
        const parsed = JSON.parse(result.stdout);
        console.log(JSON.stringify({
          command: 'gpt-diagnose',
          failureCount: latest.failures.length,
          gptAnalysis: parsed,
        }, null, 2));
      } catch {
        console.log(result.stdout);
      }
    }
    if (result.status === 3) {
      console.log(JSON.stringify({
        command: 'gpt-diagnose',
        status: 'gpt-unavailable',
        message: 'GPT not configured. Use "failures" command for local debug hints instead.',
      }, null, 2));
    }
  } catch (err) {
    console.log(JSON.stringify({
      command: 'gpt-diagnose',
      status: 'error',
      error: (err.message || '').slice(0, 300),
    }, null, 2));
  }
}

// ---------------------------------------------------------------------------
// Session logs — read/filter/summarize frontend+backend telemetry
// ---------------------------------------------------------------------------
function cmdLogs(opts) {
  if (!fs.existsSync(SESSION_LOG_FILE)) {
    console.log(JSON.stringify({
      status: 'no-logs',
      message: 'No session logs found. Start the app with npm start and interact to generate logs.',
      logFile: SESSION_LOG_FILE,
    }, null, 2));
    return;
  }

  const lines = fs.readFileSync(SESSION_LOG_FILE, 'utf-8').trim().split('\n').filter(Boolean);
  let events = lines.map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);

  // Apply filters
  const args = process.argv.slice(3);
  let since = null, category = null, route = null, limit = 100, summary = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--since': since = args[++i]; break;
      case '--category': case '--cat': category = args[++i]; break;
      case '--route': route = args[++i]; break;
      case '--limit': limit = parseInt(args[++i], 10) || 100; break;
      case '--summary': summary = true; break;
    }
  }

  if (since) {
    // Support relative times: "5m" = 5 minutes ago, "1h" = 1 hour ago
    let sinceDate;
    const relMatch = since.match(/^(\d+)(s|m|h)$/);
    if (relMatch) {
      const mult = { s: 1000, m: 60000, h: 3600000 };
      sinceDate = new Date(Date.now() - parseInt(relMatch[1]) * mult[relMatch[2]]);
    } else {
      sinceDate = new Date(since);
    }
    events = events.filter(e => new Date(e.ts) >= sinceDate);
  }
  if (category) {
    const cats = category.split(',');
    events = events.filter(e => cats.includes(e.cat));
  }
  if (route) {
    events = events.filter(e => e.route === route || (e.route && e.route.startsWith(route)));
  }

  if (summary) {
    // Produce summary instead of raw events
    const categories = {};
    const routes = {};
    const errors = [];
    const networkCalls = { total: 0, failed: 0, slowest: null };
    let sessions = new Set();

    for (const e of events) {
      categories[e.cat] = (categories[e.cat] || 0) + 1;
      if (e.route) routes[e.route] = (routes[e.route] || 0) + 1;
      if (e.sid) sessions.add(e.sid);

      if (e.cat === 'error') {
        errors.push({
          type: e.type,
          message: e.data?.message,
          route: e.route,
          ts: e.ts,
        });
      }

      if (e.cat === 'net' && e.type === 'fetch:done') {
        networkCalls.total++;
        if (!e.data?.ok) networkCalls.failed++;
        if (!networkCalls.slowest || (e.data?.duration || 0) > networkCalls.slowest.duration) {
          networkCalls.slowest = { url: e.data?.url, duration: e.data?.duration, status: e.data?.status };
        }
      }
    }

    console.log(JSON.stringify({
      totalEvents: events.length,
      filtered: { since, category, route },
      categories,
      routes,
      sessions: [...sessions],
      errors: errors.slice(-10),
      network: networkCalls,
      timeRange: events.length > 0
        ? { first: events[0].ts, last: events[events.length - 1].ts }
        : null,
    }, null, 2));
    return;
  }

  // Return last N events
  const tail = events.slice(-limit);

  console.log(JSON.stringify({
    total: events.length,
    returned: tail.length,
    filters: { since, category, route, limit },
    events: tail,
  }, null, 2));
}

function cmdLogsClear() {
  if (fs.existsSync(SESSION_LOG_FILE)) {
    fs.writeFileSync(SESSION_LOG_FILE, '');
  }
  console.log(JSON.stringify({ status: 'cleared', file: SESSION_LOG_FILE }, null, 2));
}

// ---------------------------------------------------------------------------
// Watch mode — semi-auto trigger engine
// ---------------------------------------------------------------------------

const WATCH_LOCK_FILE = path.join(__dirname, '.watch-lock');
const WATCH_STATE_FILE = path.join(__dirname, '.watch-state.json');
const SRC_DIR = path.join(FRONTEND_DIR, 'src');

// Default thresholds (overridable via --config or env)
const WATCH_DEFAULTS = {
  mode: 'assist',             // 'assist' = suggest, 'auto' = run automatically
  cooldownMs: 30_000,         // minimum ms between test runs
  maxRunsPerSession: 10,      // hard cap per watch session
  errorSpikeCount: 3,         // errors in window to trigger
  errorSpikeWindowMs: 60_000, // window for error spike detection
  fileDebounceMs: 3_000,      // debounce for file changes
  logPollMs: 2_000,           // how often to check for new log events
  backoffMultiplier: 1.5,     // multiply cooldown after consecutive failures
  backoffMaxMs: 120_000,      // max cooldown after backoff
  watchExtensions: new Set(['.ts', '.tsx', '.js', '.jsx', '.css']),
  ignorePatterns: [/node_modules/, /\.test\./, /\.spec\./, /test-results/, /e2e\//],
};

function loadWatchConfig() {
  const cfg = { ...WATCH_DEFAULTS };
  const args = process.argv.slice(3);
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--mode': cfg.mode = args[++i] === 'auto' ? 'auto' : 'assist'; break;
      case '--cooldown': cfg.cooldownMs = parseInt(args[++i], 10) * 1000; break;
      case '--max-runs': cfg.maxRunsPerSession = parseInt(args[++i], 10); break;
    }
  }
  return cfg;
}

function acquireWatchLock() {
  if (fs.existsSync(WATCH_LOCK_FILE)) {
    try {
      const lock = JSON.parse(fs.readFileSync(WATCH_LOCK_FILE, 'utf-8'));
      // Check if the PID is still alive
      try {
        process.kill(lock.pid, 0);
        return false; // another watcher is running
      } catch {
        // Dead process — clean up stale lock
        fs.unlinkSync(WATCH_LOCK_FILE);
      }
    } catch {
      try { fs.unlinkSync(WATCH_LOCK_FILE); } catch {}
    }
  }
  fs.writeFileSync(WATCH_LOCK_FILE, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  return true;
}

function releaseWatchLock() {
  try { if (fs.existsSync(WATCH_LOCK_FILE)) fs.unlinkSync(WATCH_LOCK_FILE); } catch {}
  try { if (fs.existsSync(WATCH_STATE_FILE)) fs.unlinkSync(WATCH_STATE_FILE); } catch {}
}

async function cmdWatch() {
  const cfg = loadWatchConfig();

  // Single-instance lock
  if (!acquireWatchLock()) {
    console.log(JSON.stringify({
      status: 'error',
      message: 'Another watch process is already running. Kill it first or remove tools/.watch-lock',
    }, null, 2));
    process.exit(1);
  }

  // State
  let logOffset = 0; // byte offset into session-log.jsonl
  let runCount = 0;
  let lastRunTime = 0;
  let currentCooldown = cfg.cooldownMs;
  let consecutiveFailures = 0;
  let isRunning = false;
  let pendingTrigger = null;        // collapse queue: at most one pending
  const recentErrors = [];           // sliding window for spike detection
  const recentTriggers = new Map();  // dedup: triggerKey → lastFireTime
  let fileChangeTimer = null;
  let changedFiles = new Set();

  // Initialize log offset to end of file (don't process historical events)
  if (fs.existsSync(SESSION_LOG_FILE)) {
    logOffset = fs.statSync(SESSION_LOG_FILE).size;
  }

  // ── Terminal output helpers ──────────────────────────────────────────────

  const C = {
    reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
    cyan: '\x1b[36m', yellow: '\x1b[33m', green: '\x1b[32m',
    red: '\x1b[31m', magenta: '\x1b[35m', blue: '\x1b[34m',
  };

  function log(color, label, msg) {
    const time = new Date().toTimeString().slice(0, 8);
    process.stdout.write(`${C.dim}${time}${C.reset} ${color}[${label}]${C.reset} ${msg}\n`);
  }

  function logWatch(msg) { log(C.cyan, 'watch', msg); }
  function logTrigger(msg) { log(C.yellow, 'trigger', msg); }
  function logRun(msg) { log(C.green, 'run', msg); }
  function logSkip(msg) { log(C.dim, 'skip', msg); }

  // ── Trigger evaluation ──────────────────────────────────────────────────

  function shouldTrigger(reason, key) {
    const now = Date.now();

    // Max runs check
    if (runCount >= cfg.maxRunsPerSession) {
      logSkip(`max runs reached (${runCount}/${cfg.maxRunsPerSession}) — ignoring: ${reason}`);
      return false;
    }

    // Cooldown check
    if (now - lastRunTime < currentCooldown) {
      const remaining = Math.ceil((currentCooldown - (now - lastRunTime)) / 1000);
      logSkip(`cooldown (${remaining}s left) — queuing: ${reason}`);
      pendingTrigger = { reason, key, queuedAt: now };
      return false;
    }

    // Dedup check: same trigger key within 30 seconds
    const dedupKey = key || reason;
    const lastFire = recentTriggers.get(dedupKey) || 0;
    if (now - lastFire < 30_000) {
      logSkip(`dedup — same trigger within 30s: ${dedupKey}`);
      return false;
    }

    recentTriggers.set(dedupKey, now);
    return true;
  }

  // ── Test runner with collapse queue ─────────────────────────────────────

  async function runTests(reason) {
    if (isRunning) {
      // Collapse: overwrite pending with latest trigger
      pendingTrigger = { reason, key: reason, queuedAt: Date.now() };
      logSkip(`test run in progress — queued: ${reason}`);
      return;
    }

    isRunning = true;
    runCount++;
    lastRunTime = Date.now();
    pendingTrigger = null;

    logRun(`#${runCount} triggered by: ${reason}`);

    try {
      // Save state for crash recovery
      fs.writeFileSync(WATCH_STATE_FILE, JSON.stringify({
        runCount, lastRunTime, currentCooldown, consecutiveFailures,
      }));

      const playwrightCli = path.resolve(FRONTEND_DIR, 'node_modules', '@playwright', 'test', 'cli.js');

      // Run smoke tests only (fast feedback)
      const testRun = spawnSync(process.execPath, [playwrightCli, 'test', '--project=smoke'], {
        cwd: FRONTEND_DIR, encoding: 'utf-8', timeout: 360_000,
      });

      // Parse results
      const results = parseResults();
      const logHistory = readLog();
      const trend = computeTrend(logHistory, results.failed);

      // Append to test log
      appendLog({
        iteration: logHistory.length + 1,
        timestamp: new Date().toISOString(),
        gitSha: getGitSha(),
        serverStatus: { frontend: true, backend: true },
        testResults: { passed: results.passed, failed: results.failed, skipped: results.skipped, total: results.total },
        failures: results.failures,
        trend,
        changedFiles: getChangedFiles(),
        note: `watch: ${reason}`,
        source: 'watch',
      });

      if (results.failed === 0) {
        logRun(`${C.green}GREEN${C.reset} — ${results.passed} passed, ${results.total} total`);
        consecutiveFailures = 0;
        currentCooldown = cfg.cooldownMs; // reset cooldown
      } else {
        logRun(`${C.red}${results.failed} FAILURES${C.reset} — ${results.passed} passed, ${results.total} total`);
        consecutiveFailures++;
        // Exponential backoff after consecutive failures
        currentCooldown = Math.min(
          cfg.cooldownMs * Math.pow(cfg.backoffMultiplier, consecutiveFailures),
          cfg.backoffMaxMs
        );
        logWatch(`backoff: next cooldown ${Math.round(currentCooldown / 1000)}s (${consecutiveFailures} consecutive failures)`);

        // Print failure summary
        for (const f of results.failures.slice(0, 5)) {
          log(C.red, 'fail', `${f.name} — ${f.classification}: ${(f.error || '').slice(0, 100)}`);
        }
      }
    } catch (err) {
      log(C.red, 'error', `Test run failed: ${(err.message || '').slice(0, 200)}`);
      consecutiveFailures++;
      currentCooldown = Math.min(
        cfg.cooldownMs * Math.pow(cfg.backoffMultiplier, consecutiveFailures),
        cfg.backoffMaxMs
      );
    } finally {
      isRunning = false;

      // Process pending trigger (collapse queue)
      if (pendingTrigger && !isRunning) {
        const pending = pendingTrigger;
        pendingTrigger = null;
        logWatch(`processing queued trigger: ${pending.reason}`);
        // Small delay to avoid tight loops
        setTimeout(() => runTests(pending.reason), 1000);
      }
    }
  }

  function handleTrigger(reason, key) {
    if (cfg.mode === 'assist') {
      logTrigger(`${C.bold}${reason}${C.reset}`);
      logTrigger(`  Run: node tools/agentic-test-loop.js run --note "watch: ${reason}"`);
      return;
    }
    // Auto mode
    if (shouldTrigger(reason, key)) {
      runTests(reason);
    }
  }

  // ── Log watcher (poll session-log.jsonl for new events) ─────────────────

  function pollLogs() {
    if (!fs.existsSync(SESSION_LOG_FILE)) return;

    let stat;
    try { stat = fs.statSync(SESSION_LOG_FILE); } catch { return; }

    // Handle log rotation / truncation
    if (stat.size < logOffset) {
      logOffset = 0; // file was rotated or cleared
    }

    if (stat.size <= logOffset) return; // no new data

    // Read only new bytes
    const fd = fs.openSync(SESSION_LOG_FILE, 'r');
    const buf = Buffer.alloc(stat.size - logOffset);
    fs.readSync(fd, buf, 0, buf.length, logOffset);
    fs.closeSync(fd);
    logOffset = stat.size;

    const newLines = buf.toString('utf-8').trim().split('\n').filter(Boolean);
    const now = Date.now();

    for (const line of newLines) {
      let event;
      try { event = JSON.parse(line); } catch { continue; }

      // Skip events from the watcher's own test runs (tagged with sid="server" from test output)
      // We detect our own events by checking if they come from a test run period
      if (isRunning) continue;

      // ── Signal: error/crash ───────────────────────────────────────
      if (event.cat === 'error') {
        recentErrors.push(now);
        // Prune old errors outside window
        while (recentErrors.length > 0 && (now - recentErrors[0]) > cfg.errorSpikeWindowMs) {
          recentErrors.shift();
        }

        if (event.type === 'uncaught' || event.type === 'unhandled-rejection') {
          handleTrigger(
            `crash: ${(event.data?.message || 'unknown').slice(0, 80)}`,
            `crash:${(event.data?.message || '').slice(0, 40)}`
          );
        } else if (recentErrors.length >= cfg.errorSpikeCount) {
          handleTrigger(
            `error spike: ${recentErrors.length} errors in ${Math.round(cfg.errorSpikeWindowMs / 1000)}s`,
            'error-spike'
          );
        }
      }

      // ── Signal: API 5xx ────────────────────────────────────────────
      if (event.cat === 'net' && event.type === 'fetch:done' && event.data?.status >= 500) {
        handleTrigger(
          `API ${event.data.status}: ${event.data.method} ${event.data.url}`,
          `api5xx:${event.data.url}`
        );
      }
      if (event.cat === 'req' && event.data?.status >= 500) {
        handleTrigger(
          `server ${event.data.status}: ${event.data.method} ${event.data.url}`,
          `srv5xx:${event.data.url}`
        );
      }

      // ── Signal: console.error ──────────────────────────────────────
      if (event.cat === 'console' && event.type === 'error') {
        recentErrors.push(now);
        while (recentErrors.length > 0 && (now - recentErrors[0]) > cfg.errorSpikeWindowMs) {
          recentErrors.shift();
        }
        if (recentErrors.length >= cfg.errorSpikeCount) {
          handleTrigger(
            `console error spike: ${recentErrors.length} in ${Math.round(cfg.errorSpikeWindowMs / 1000)}s`,
            'console-error-spike'
          );
        }
      }
    }
  }

  // ── File watcher (src/ changes with debounce) ───────────────────────────

  function startFileWatcher() {
    if (!fs.existsSync(SRC_DIR)) {
      logWatch('src/ directory not found — file watching disabled');
      return null;
    }

    const watcher = fs.watch(SRC_DIR, { recursive: true }, (eventType, filename) => {
      if (!filename) return;

      // Filter by extension
      const ext = path.extname(filename);
      if (!cfg.watchExtensions.has(ext)) return;

      // Filter out ignored patterns
      if (cfg.ignorePatterns.some(p => p.test(filename))) return;

      changedFiles.add(filename);

      // Debounce: collect changes, then fire once
      if (fileChangeTimer) clearTimeout(fileChangeTimer);
      fileChangeTimer = setTimeout(() => {
        const files = [...changedFiles];
        changedFiles.clear();
        fileChangeTimer = null;

        const summary = files.length <= 3
          ? files.join(', ')
          : `${files.slice(0, 2).join(', ')} +${files.length - 2} more`;

        handleTrigger(`file change: ${summary}`, 'file-change');
      }, cfg.fileDebounceMs);
    });

    watcher.on('error', (err) => {
      logWatch(`file watcher error: ${err.message}`);
    });

    return watcher;
  }

  // ── Cooldown drain: check for pending triggers ──────────────────────────

  function drainPending() {
    if (!pendingTrigger || isRunning) return;
    const now = Date.now();
    if (now - lastRunTime >= currentCooldown) {
      const pending = pendingTrigger;
      pendingTrigger = null;
      logWatch(`cooldown expired — processing queued: ${pending.reason}`);
      if (cfg.mode === 'auto') {
        runTests(pending.reason);
      } else {
        logTrigger(`${C.bold}${pending.reason}${C.reset} (was queued during cooldown)`);
        logTrigger(`  Run: node tools/agentic-test-loop.js run --note "watch: ${pending.reason}"`);
      }
    }
  }

  // ── Main watch loop ─────────────────────────────────────────────────────

  // Banner
  console.log('');
  logWatch(`${C.bold}Agentic Test Loop — Watch Mode${C.reset}`);
  logWatch(`mode: ${C.bold}${cfg.mode}${C.reset} | cooldown: ${cfg.cooldownMs / 1000}s | max runs: ${cfg.maxRunsPerSession}`);
  logWatch(`watching: ${SESSION_LOG_FILE}`);
  logWatch(`watching: ${SRC_DIR} (${[...cfg.watchExtensions].join(', ')})`);
  logWatch(`signals: error-spike (${cfg.errorSpikeCount} in ${cfg.errorSpikeWindowMs / 1000}s), API 5xx, crash, file-change`);
  if (cfg.mode === 'assist') {
    logWatch(`${C.yellow}assist mode${C.reset} — will suggest test runs, not execute them`);
    logWatch(`switch to auto: node tools/agentic-test-loop.js watch --mode auto`);
  }
  console.log('');

  // Start watchers
  const fileWatcher = startFileWatcher();
  const logPollInterval = setInterval(pollLogs, cfg.logPollMs);
  const drainInterval = setInterval(drainPending, 5_000);

  // Graceful shutdown
  function shutdown() {
    logWatch('shutting down...');
    clearInterval(logPollInterval);
    clearInterval(drainInterval);
    if (fileWatcher) fileWatcher.close();
    if (fileChangeTimer) clearTimeout(fileChangeTimer);
    releaseWatchLock();

    // Final summary
    console.log('');
    logWatch(`${C.bold}Session summary${C.reset}: ${runCount} test runs, ${consecutiveFailures} consecutive failures`);
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', () => { try { releaseWatchLock(); } catch {} });

  // Keep alive
  logWatch('watching for signals... (Ctrl+C to stop)');
}

async function cmdScreenshot(route) {
  if (!route) {
    console.log(JSON.stringify({ error: 'Provide a route: node tools/agentic-test-loop.js screenshot /evaluate' }, null, 2));
    process.exit(1);
  }

  const url = `http://localhost:8080/#${route}`;
  const outDir = path.join(FRONTEND_DIR, 'test-results', 'screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${route.replace(/\//g, '_') || 'home'}-${Date.now()}.png`);

  try {
    // Use Playwright CLI for a quick screenshot
    execSync(
      `npx playwright screenshot --browser msedge --viewport-size 1280,720 "${url}" "${outFile}"`,
      { cwd: FRONTEND_DIR, encoding: 'utf-8', timeout: 30_000 }
    );
    console.log(JSON.stringify({ status: 'ok', route, screenshot: outFile }, null, 2));
  } catch (err) {
    console.log(JSON.stringify({
      status: 'error',
      route,
      error: (err.stderr || err.message || '').slice(0, 300),
      hint: 'Use Playwright MCP browser_navigate + browser_take_screenshot instead for interactive debugging.',
    }, null, 2));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// mcp-probe — execute data-driven exploratory checks from feature-map.json
// ---------------------------------------------------------------------------
function generateRunId(prefix = 'run') {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${ts}-${rand}`;
}

async function cmdMcpProbe(opts) {
  const feature = opts.feature || process.argv[3];
  if (!feature) {
    console.log(JSON.stringify({
      error: 'Provide a feature: node tools/agentic-test-loop.js mcp-probe --feature auth',
    }, null, 2));
    process.exit(1);
  }

  const featureMap = loadFeatureMap();
  if (!featureMap) {
    console.log(JSON.stringify({ error: 'feature-map.json not found' }, null, 2));
    process.exit(1);
  }
  const resolved = resolveFeature(feature, featureMap);
  if (!resolved) {
    console.log(JSON.stringify({
      error: `feature "${feature}" not resolvable`,
      available: Object.keys(featureMap.features).join(', '),
    }, null, 2));
    process.exit(1);
  }

  const frontendUp = await checkServer(DEV_SERVER_URL);
  if (!frontendUp) {
    console.log(JSON.stringify({
      status: 'error',
      reason: 'Dev server not running on :8080. Start with: cd app/frontend && npm run dev',
    }, null, 2));
    process.exit(2);
  }

  const runId = opts.runId && TEST_RUN_ID_RE.test(opts.runId) ? opts.runId : generateRunId('probe');

  if (fs.existsSync(MCP_PROBE_RESULTS_FILE)) {
    try { fs.unlinkSync(MCP_PROBE_RESULTS_FILE); } catch { /* ignore */ }
  }

  const playwrightCli = path.resolve(FRONTEND_DIR, 'node_modules', '@playwright', 'test', 'cli.js');
  const env = { ...process.env, FEATURE: resolved.key, TEST_RUN_ID: runId };
  const testRun = spawnSync(process.execPath, [playwrightCli, 'test', '--project=mcp-probe'], {
    cwd: FRONTEND_DIR,
    encoding: 'utf-8',
    timeout: 360_000,
    env,
  });

  let results = null;
  if (fs.existsSync(MCP_PROBE_RESULTS_FILE)) {
    try { results = JSON.parse(fs.readFileSync(MCP_PROBE_RESULTS_FILE, 'utf-8')); } catch { /* ignore */ }
  }

  const status = testRun.status === 0 ? 'pass' : 'fail';
  const entry = {
    iteration: readLog().length + 1,
    timestamp: new Date().toISOString(),
    gitSha: getGitSha(),
    source: 'mcp-probe',
    testRunId: runId,
    feature: resolved.key,
    status,
    results: results?.totals || { passed: 0, failed: 0, skipped: 0, total: 0 },
    failures: (results?.results || []).filter((r) => r.status === 'fail').map((r) => ({
      name: `${r.feature}/${r.action} ${r.route || ''}`,
      classification: 'mcp-probe',
      error: r.error,
      route: r.route,
      stepId: r.stepId,
    })),
    note: opts.note,
  };
  appendLog(entry);

  console.log(JSON.stringify({
    command: 'mcp-probe',
    testRunId: runId,
    feature: resolved.key,
    status,
    totals: entry.results,
    failures: entry.failures,
    resultsFile: path.relative(ROOT, MCP_PROBE_RESULTS_FILE).replace(/\\/g, '/'),
    bundleCommand: `node tools/agentic-test-loop.js bundle ${runId}`,
    stderr: testRun.stderr ? testRun.stderr.slice(0, 500) : undefined,
  }, null, 2));
  process.exit(status === 'pass' ? 0 : 1);
}

// ---------------------------------------------------------------------------
// after — post-event verification dispatcher
//
// Invoked after external events (e.g., /mcs-eval, /mcs-build). Maps the event
// to a feature set, then runs oracle + mcp-probe for UI regression detection.
// Used to wire the MCS evaluation pipeline to the frontend test loop without
// spawning a separate dispatcher tool.
//
// Usage:
//   node tools/agentic-test-loop.js after mcs-eval
//   node tools/agentic-test-loop.js after mcs-build
//   node tools/agentic-test-loop.js after frontend-deploy
// ---------------------------------------------------------------------------
const AFTER_EVENT_MAP = {
  'mcs-eval':        ['evaluation'],
  'mcs-build':       ['build', 'agent-management'],
  'mcs-fix':         ['evaluation', 'build'],
  'mcs-research':    ['agent-management'],
  'frontend-deploy': ['auth', 'navigation', 'agent-management'],
};

async function cmdAfter(event) {
  if (!event) {
    console.log(JSON.stringify({
      error: 'event required',
      usage: 'node tools/agentic-test-loop.js after <event>',
      availableEvents: Object.keys(AFTER_EVENT_MAP),
    }, null, 2));
    process.exit(1);
  }

  const features = AFTER_EVENT_MAP[event];
  if (!features) {
    console.log(JSON.stringify({
      error: `unknown event "${event}"`,
      availableEvents: Object.keys(AFTER_EVENT_MAP),
    }, null, 2));
    process.exit(1);
  }

  const frontendUp = await checkServer(DEV_SERVER_URL);
  if (!frontendUp) {
    console.log(JSON.stringify({
      status: 'skipped',
      reason: 'frontend not running — cannot verify post-event UI state',
      action: 'Start with: cd app/frontend && npm run dev',
    }, null, 2));
    process.exit(0);
  }

  const runId = generateRunId(`after-${event}`);
  const playwrightCli = path.resolve(FRONTEND_DIR, 'node_modules', '@playwright', 'test', 'cli.js');

  // Run oracles for all mapped features (single Playwright invocation)
  if (fs.existsSync(RESULTS_FILE)) {
    try { fs.unlinkSync(RESULTS_FILE); } catch { /* ignore */ }
  }
  const oracleRun = spawnSync(process.execPath, [playwrightCli, 'test', '--project=oracles'], {
    cwd: FRONTEND_DIR,
    encoding: 'utf-8',
    timeout: 360_000,
    env: { ...process.env, TEST_RUN_ID: runId, ORACLE: features.join(',') },
  });
  const oracleResults = parseResults();

  const entry = {
    iteration: readLog().length + 1,
    timestamp: new Date().toISOString(),
    gitSha: getGitSha(),
    source: 'after',
    afterEvent: event,
    testRunId: runId,
    features,
    status: oracleRun.status === 0 ? 'pass' : 'fail',
    testResults: {
      passed: oracleResults.passed,
      failed: oracleResults.failed,
      skipped: oracleResults.skipped,
      total: oracleResults.total,
    },
    failures: oracleResults.failures,
  };
  appendLog(entry);

  console.log(JSON.stringify({
    command: 'after',
    event,
    testRunId: runId,
    features,
    status: entry.status,
    results: entry.testResults,
    failures: entry.failures.slice(0, 5).map((f) => ({ name: f.name, error: (f.error || '').slice(0, 200) })),
    bundleCommand: `node tools/agentic-test-loop.js bundle ${runId}`,
  }, null, 2));
  process.exit(oracleRun.status === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------------
// oracle — run scenario oracle(s) for one or more features
// ---------------------------------------------------------------------------
async function cmdOracle(opts) {
  // Positional fallback for the legacy `oracle <feature>` invocation, but
  // skip it if argv[3] is a flag (`--run-id`, `--note`, etc.) — otherwise
  // a flag-only invocation like `oracle --run-id X` was incorrectly using
  // "--run-id" as the feature name and producing
  // `Oracle not found for feature "--run-id"`.
  const argv3 = process.argv[3];
  const positionalFeature = argv3 && !argv3.startsWith('--') ? argv3 : null;
  const feature = opts.feature || positionalFeature;

  const frontendUp = await checkServer(DEV_SERVER_URL);
  if (!frontendUp) {
    console.log(JSON.stringify({
      status: 'error',
      reason: 'Dev server not running on :8080. Start with: cd app/frontend && npm run dev',
    }, null, 2));
    process.exit(2);
  }

  const runId = opts.runId && TEST_RUN_ID_RE.test(opts.runId) ? opts.runId : generateRunId('oracle');
  const playwrightCli = path.resolve(FRONTEND_DIR, 'node_modules', '@playwright', 'test', 'cli.js');

  if (fs.existsSync(RESULTS_FILE)) {
    try { fs.unlinkSync(RESULTS_FILE); } catch { /* ignore */ }
  }

  const env = { ...process.env, TEST_RUN_ID: runId };
  if (feature) env.ORACLE = feature;

  const testRun = spawnSync(process.execPath, [playwrightCli, 'test', '--project=oracles'], {
    cwd: FRONTEND_DIR,
    encoding: 'utf-8',
    timeout: 360_000,
    env,
  });

  const results = parseResults();
  const entry = {
    iteration: readLog().length + 1,
    timestamp: new Date().toISOString(),
    gitSha: getGitSha(),
    source: 'oracle',
    testRunId: runId,
    oracle: feature || '(all)',
    status: testRun.status === 0 ? 'pass' : 'fail',
    testResults: {
      passed: results.passed,
      failed: results.failed,
      skipped: results.skipped,
      total: results.total,
    },
    failures: results.failures,
    note: opts.note,
  };
  appendLog(entry);

  console.log(JSON.stringify({
    command: 'oracle',
    testRunId: runId,
    oracle: feature || '(all)',
    status: entry.status,
    results: entry.testResults,
    failures: entry.failures.map((f) => ({ name: f.name, error: f.error })),
    bundleCommand: `node tools/agentic-test-loop.js bundle ${runId}`,
    stderr: testRun.stderr ? testRun.stderr.slice(0, 500) : undefined,
  }, null, 2));
  process.exit(testRun.status === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------------
// bundle — collect all artifacts for one testRunId into a manifest bundle
// ---------------------------------------------------------------------------
function cmdBundle(runIdArg) {
  const log = readLog();
  let runId = runIdArg;
  if (!runId) {
    // Find latest entry with a testRunId
    for (let i = log.length - 1; i >= 0; i--) {
      if (log[i].testRunId) { runId = log[i].testRunId; break; }
    }
    if (!runId) {
      console.log(JSON.stringify({
        error: 'No testRunId found in test-log.jsonl. Run mcp-probe first or pass a runId.',
      }, null, 2));
      process.exit(1);
    }
  }
  if (!TEST_RUN_ID_RE.test(runId)) {
    console.log(JSON.stringify({
      error: `invalid runId — must match ${TEST_RUN_ID_RE}`,
    }, null, 2));
    process.exit(1);
  }

  // Collect test-log entries for this run
  const testEntries = log.filter((e) => e.testRunId === runId);

  // Collect session-log events for this run
  const sessionEvents = [];
  if (fs.existsSync(SESSION_LOG_FILE)) {
    const lines = fs.readFileSync(SESSION_LOG_FILE, 'utf-8').trim().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const ev = JSON.parse(line);
        if (ev.testRunId === runId) sessionEvents.push(ev);
      } catch { /* skip malformed */ }
    }
  }

  // Collect mcp-probe results if they match
  let probeResults = null;
  if (fs.existsSync(MCP_PROBE_RESULTS_FILE)) {
    try {
      const r = JSON.parse(fs.readFileSync(MCP_PROBE_RESULTS_FILE, 'utf-8'));
      if (r.testRunId === runId) probeResults = r;
    } catch { /* ignore */ }
  }

  // Collect screenshots/traces under app/frontend/test-results/ that mention this runId
  const artifactRefs = [];
  const testResultsDir = path.join(FRONTEND_DIR, 'test-results');
  if (fs.existsSync(testResultsDir)) {
    const walk = (dir) => {
      try {
        for (const name of fs.readdirSync(dir)) {
          const full = path.join(dir, name);
          const stat = fs.statSync(full);
          if (stat.isDirectory()) walk(full);
          else if (/\.(png|jpg|webm|zip|md)$/i.test(name)) {
            // Include all artifacts in test-results — Playwright names them by test, not runId
            artifactRefs.push({
              kind: name.endsWith('.png') ? 'screenshot' : name.endsWith('.webm') ? 'video' : name.endsWith('.zip') ? 'trace' : 'context',
              relativePath: path.relative(ROOT, full).replace(/\\/g, '/'),
              sizeBytes: stat.size,
            });
          }
        }
      } catch { /* ignore unreadable dirs */ }
    };
    walk(testResultsDir);
  }

  // Collect mcp-probe step artifacts (already in probeResults.results[].artifacts)
  if (probeResults?.results) {
    for (const step of probeResults.results) {
      for (const a of step.artifacts || []) {
        artifactRefs.push({
          kind: a.kind,
          relativePath: `app/frontend/${a.relativePath}`,
          stepId: step.stepId,
        });
      }
    }
  }

  // Failure summary across test + probe + session errors
  const sessionErrors = sessionEvents.filter((e) => e.cat === 'error' || (e.cat === 'console' && e.type === 'error'));
  const sessionFailedReqs = sessionEvents.filter((e) => e.cat === 'req' && e.data?.status >= 400)
    .concat(sessionEvents.filter((e) => e.cat === 'net' && e.type === 'fetch:done' && e.data?.status >= 400));

  if (!fs.existsSync(BUNDLES_DIR)) fs.mkdirSync(BUNDLES_DIR, { recursive: true });
  const manifestPath = path.join(BUNDLES_DIR, `${runId}.manifest.json`);
  const eventsPath = path.join(BUNDLES_DIR, `${runId}.events.jsonl`);

  const manifest = {
    testRunId: runId,
    generatedAt: new Date().toISOString(),
    gitSha: getGitSha(),
    summary: {
      testRunCount: testEntries.length,
      sessionEventCount: sessionEvents.length,
      sessionErrorCount: sessionErrors.length,
      sessionFailedRequestCount: sessionFailedReqs.length,
      mcpProbeStatus: probeResults ? (probeResults.totals?.failed > 0 ? 'fail' : 'pass') : 'not-run',
      artifactCount: artifactRefs.length,
    },
    testRuns: testEntries.map((e) => ({
      iteration: e.iteration,
      timestamp: e.timestamp,
      source: e.source,
      status: e.status,
      failures: e.failures?.length || 0,
      note: e.note,
    })),
    mcpProbe: probeResults,
    topErrors: sessionErrors.slice(-10).map((e) => ({
      ts: e.ts,
      type: e.type,
      route: e.route,
      message: e.data?.message || e.data?.args?.join(' '),
    })),
    topFailedRequests: sessionFailedReqs.slice(-10).map((e) => ({
      ts: e.ts,
      method: e.data?.method,
      url: e.data?.url,
      status: e.data?.status,
      route: e.route,
    })),
    artifacts: artifactRefs,
    eventsFile: path.relative(ROOT, eventsPath).replace(/\\/g, '/'),
  };

  // Stream events to separate NDJSON file — avoid loading all events into one JSON object
  fs.writeFileSync(eventsPath, sessionEvents.map((e) => JSON.stringify(e)).join('\n'));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(JSON.stringify({
    command: 'bundle',
    testRunId: runId,
    manifest: path.relative(ROOT, manifestPath).replace(/\\/g, '/'),
    events: path.relative(ROOT, eventsPath).replace(/\\/g, '/'),
    summary: manifest.summary,
  }, null, 2));
}

// ---------------------------------------------------------------------------
// Self-test — exercise parseResults state machine with synthetic fixtures.
// Confirms the honesty gate would catch missing/stale/parse-error/empty
// results.json before they reach the green-classification path. Has no
// dependency on Playwright, dev servers, or Dataverse.
// ---------------------------------------------------------------------------
function cmdSelfTest() {
  const tmpDir = path.join(os.tmpdir(), `atl-selftest-${process.pid}-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, 'results.json');

  const cases = [
    { name: 'missing', setup: () => { /* no file */ }, expect: 'missing' },
    {
      name: 'parse-error',
      setup: () => fs.writeFileSync(tmpFile, '{not valid json'),
      expect: 'parse-error',
    },
    {
      name: 'empty (no suites)',
      setup: () => fs.writeFileSync(tmpFile, JSON.stringify({ suites: [] })),
      expect: 'empty',
    },
    {
      name: 'empty (suites with no tests)',
      setup: () => fs.writeFileSync(tmpFile, JSON.stringify({
        suites: [{ title: 'foo', specs: [], suites: [] }],
      })),
      expect: 'empty',
    },
    {
      name: 'ok (one passing test)',
      setup: () => fs.writeFileSync(tmpFile, JSON.stringify({
        suites: [{
          title: 'foo',
          specs: [{
            title: 'home loads (/)',
            tests: [{ results: [{ status: 'passed', duration: 100 }] }],
          }],
        }],
      })),
      expect: 'ok',
    },
    {
      name: 'ok (one failing test)',
      setup: () => fs.writeFileSync(tmpFile, JSON.stringify({
        suites: [{
          title: 'foo',
          specs: [{
            title: 'evaluate loads (/evaluate)',
            tests: [{
              results: [{
                status: 'failed',
                duration: 5000,
                error: { message: 'expected element to be visible' },
              }],
            }],
          }],
        }],
      })),
      expect: 'ok',
    },
  ];

  // Stale-detection check: write a file in the past, set spawnTime now
  const staleCase = {
    name: 'stale (mtime older than spawn)',
    run: () => {
      fs.writeFileSync(tmpFile, JSON.stringify({ suites: [] }));
      const oldTime = Date.now() - 60_000;
      fs.utimesSync(tmpFile, oldTime / 1000, oldTime / 1000);
      const r = parseResults(Date.now() - 1000, tmpFile);
      return r.state === 'stale';
    },
    expect: 'stale',
  };

  const results = [];
  let allPass = true;

  for (const c of cases) {
    try { fs.unlinkSync(tmpFile); } catch { /* not present */ }
    c.setup();
    const r = parseResults(undefined, tmpFile);
    const pass = r.state === c.expect;
    if (!pass) allPass = false;
    results.push({
      case: c.name,
      expected: c.expect,
      got: r.state,
      pass,
      counts: { passed: r.passed, failed: r.failed, total: r.total },
    });
  }

  // Run stale case
  try { fs.unlinkSync(tmpFile); } catch { /* not present */ }
  const stalePass = staleCase.run();
  if (!stalePass) allPass = false;
  results.push({
    case: staleCase.name,
    expected: staleCase.expect,
    got: stalePass ? 'stale' : 'NOT-stale',
    pass: stalePass,
  });

  // Cleanup
  try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  try { fs.rmdirSync(tmpDir); } catch { /* ignore */ }

  console.log(JSON.stringify({
    command: 'self-test',
    allPass,
    cases: results,
    note: allPass
      ? 'Honesty gate working: parseResults distinguishes missing/stale/parse-error/empty/ok.'
      : 'REGRESSION: parseResults state machine returned unexpected results. cmdRun could green-light silence.',
  }, null, 2));
  process.exit(allPass ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs();

  switch (opts.command) {
    case 'run': await cmdRun(opts); break;
    case 'expand': cmdExpand(opts.feature || process.argv[3]); break;
    case 'status': cmdStatus(); break;
    case 'failures': cmdFailures(); break;
    case 'reset': cmdReset(); break;
    case 'screenshot': await cmdScreenshot(opts.route || process.argv[3]); break;
    case 'gpt-diagnose': cmdGptDiagnose(); break;
    case 'logs': cmdLogs(opts); break;
    case 'logs-clear': cmdLogsClear(); break;
    case 'watch': await cmdWatch(); break;
    case 'mcp-probe': await cmdMcpProbe(opts); break;
    case 'bundle': cmdBundle(opts.runId || process.argv[3]); break;
    case 'oracle': await cmdOracle(opts); break;
    case 'after': await cmdAfter(process.argv[3]); break;
    case 'self-test': cmdSelfTest(); break;
    default:
      console.log(JSON.stringify({
        error: `Unknown command: ${opts.command}`,
        usage: 'run | expand | status | failures | reset | screenshot | mcp-probe | oracle | bundle | gpt-diagnose | logs | logs-clear | watch | self-test [--mode assist|auto]',
      }, null, 2));
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ status: 'fatal', error: err.message }, null, 2));
  process.exit(3);
});
