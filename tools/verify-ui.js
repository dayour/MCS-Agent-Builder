#!/usr/bin/env node
/**
 * UI Verification Orchestrator
 *
 * Runs Playwright smoke tests against the local dev server.
 * Checks server readiness, runs tests, reports structured results.
 *
 * Usage:
 *   node tools/verify-ui.js                    # Run all smoke tests
 *   node tools/verify-ui.js --route /build     # Test specific route
 *   node tools/verify-ui.js --start-server     # Auto-start dev server if not running
 *   node tools/verify-ui.js --verbose          # Show full Playwright output
 *   node tools/verify-ui.js --headed           # Run in headed mode (visible browser)
 *
 * Exit codes:
 *   0 = all tests passed
 *   1 = some tests failed
 *   2 = server not running (and --start-server not specified)
 *   3 = setup error
 */

const http = require('http');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const FRONTEND_DIR = path.join(__dirname, '..', 'app', 'frontend');
const RESULTS_FILE = path.join(FRONTEND_DIR, 'e2e', 'results.json');
const DEV_SERVER_URL = 'http://localhost:8080';
const SERVER_CHECK_TIMEOUT = 5_000;
const SERVER_START_TIMEOUT = 30_000;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    route: null,
    startServer: false,
    verbose: false,
    headed: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--route':
        opts.route = args[++i];
        break;
      case '--start-server':
        opts.startServer = true;
        break;
      case '--verbose':
        opts.verbose = true;
        break;
      case '--headed':
        opts.headed = true;
        break;
      case '--help':
      case '-h':
        console.log(`
UI Verification Orchestrator

Usage:
  node tools/verify-ui.js [options]

Options:
  --route <path>   Test a specific route (e.g., --route /build)
  --start-server   Auto-start dev server if not running
  --verbose        Show full Playwright output
  --headed         Run in headed mode (visible browser)
  -h, --help       Show this help message
`);
        process.exit(0);
    }
  }

  return opts;
}

// ---------------------------------------------------------------------------
// Server readiness check
// ---------------------------------------------------------------------------
function checkServer(url, timeout) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeout);

    http
      .get(url, (res) => {
        clearTimeout(timer);
        res.resume();
        resolve(true);
      })
      .on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
  });
}

async function waitForServer(url, timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await checkServer(url, 2_000)) return true;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Run Playwright tests
// ---------------------------------------------------------------------------
function runTests(opts) {
  // Use config-defined reporters (list + json file output)
  // Do NOT pass --reporter here — let playwright.config.ts handle it
  const args = ['playwright', 'test'];

  if (opts.route) {
    args.push('--grep', opts.route.replace('/', ''));
  }

  if (opts.headed) {
    args.push('--headed');
  }

  // Remove stale results file so we only read fresh results
  if (fs.existsSync(RESULTS_FILE)) {
    fs.unlinkSync(RESULTS_FILE);
  }

  try {
    const output = execSync(`npx ${args.join(' ')}`, {
      cwd: FRONTEND_DIR,
      encoding: 'utf-8',
      stdio: opts.verbose ? 'inherit' : 'pipe',
      timeout: 180_000,
    });
    return { success: true, output };
  } catch (err) {
    return { success: false, output: err.stdout || '', stderr: err.stderr || '' };
  }
}

// ---------------------------------------------------------------------------
// Parse and display results
// ---------------------------------------------------------------------------
function displayResults() {
  if (!fs.existsSync(RESULTS_FILE)) {
    console.log('\n  No results file found. Tests may not have run.\n');
    return { passed: 0, failed: 0, skipped: 0 };
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'));
  } catch {
    console.log('\n  Could not parse results file.\n');
    return { passed: 0, failed: 0, skipped: 0 };
  }

  const suites = data.suites || [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const rows = [];

  function collectSpecs(suite) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const result = test.results?.[0];
        const status = result?.status || 'unknown';
        const duration = result?.duration || 0;

        if (status === 'passed') passed++;
        else if (status === 'failed' || status === 'timedOut') failed++;
        else skipped++;

        rows.push({
          name: spec.title,
          status,
          duration: `${duration}ms`,
          error: status === 'failed' ? (result?.error?.message || '').slice(0, 100) : '',
        });
      }
    }
    for (const child of suite.suites || []) {
      collectSpecs(child);
    }
  }

  for (const suite of suites) {
    collectSpecs(suite);
  }

  // Print table
  console.log('\n  ┌──────────────────────────────────────────────────────────────────┐');
  console.log('  │  UI Verification Results                                        │');
  console.log('  ├──────────────────────────────────────────────────────────────────┤');

  for (const row of rows) {
    const icon = row.status === 'passed' ? 'PASS' : row.status === 'failed' ? 'FAIL' : 'SKIP';
    const name = row.name.padEnd(40).slice(0, 40);
    console.log(`  │  ${icon}  ${name}  ${row.duration.padStart(8)}  │`);
    if (row.error) {
      console.log(`  │       ${row.error.padEnd(57).slice(0, 57)}  │`);
    }
  }

  console.log('  ├──────────────────────────────────────────────────────────────────┤');
  console.log(`  │  Passed: ${passed}  Failed: ${failed}  Skipped: ${skipped}`.padEnd(67) + '│');
  console.log('  └──────────────────────────────────────────────────────────────────┘\n');

  return { passed, failed, skipped };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs();
  let serverProcess = null;

  console.log('\n  UI Verification Orchestrator');
  console.log('  ===========================\n');

  // Step 1: Check dev server
  console.log(`  Checking dev server at ${DEV_SERVER_URL}...`);
  const serverUp = await checkServer(DEV_SERVER_URL, SERVER_CHECK_TIMEOUT);

  if (!serverUp) {
    if (opts.startServer) {
      console.log('  Server not running. Starting dev server...');
      serverProcess = spawn('npm', ['run', 'dev'], {
        cwd: FRONTEND_DIR,
        stdio: 'ignore',
        detached: true,
        shell: true,
      });
      serverProcess.unref();

      const ready = await waitForServer(DEV_SERVER_URL, SERVER_START_TIMEOUT);
      if (!ready) {
        console.error('  ERROR: Dev server did not start within 30s.');
        process.exit(2);
      }
      console.log('  Dev server started.');
    } else {
      console.error('  ERROR: Dev server is not running on port 8080.');
      console.error('  Start it with: cd app/frontend && npm run dev');
      console.error('  Or use: node tools/verify-ui.js --start-server');
      process.exit(2);
    }
  } else {
    console.log('  Dev server is running.');
  }

  // Step 2: Run tests
  console.log('  Running Playwright smoke tests...\n');
  const { success } = runTests(opts);

  // Step 3: Display results
  const { passed, failed } = displayResults();

  // Step 4: Cleanup
  if (serverProcess) {
    try {
      process.kill(-serverProcess.pid);
    } catch {
      // Already exited
    }
  }

  // Step 5: Exit
  if (failed > 0) {
    console.log(`  ${failed} test(s) failed. Review errors above.\n`);
    process.exit(1);
  } else if (passed === 0) {
    console.log('  No tests ran. Check configuration.\n');
    process.exit(3);
  } else {
    console.log(`  All ${passed} tests passed.\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('  Fatal error:', err.message);
  process.exit(3);
});
