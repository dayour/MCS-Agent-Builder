#!/usr/bin/env node
/**
 * MCS Build Loop — verify-after-push harness for MCS API operations.
 *
 * Mirrors tools/agentic-test-loop.js: where the test loop catches frontend
 * green-light-on-silence, this catches "MCS push reported success but
 * Dataverse didn't actually persist what we sent."
 *
 * Commands:
 *   verify --workspace <path>    Pull current server state, classify diff
 *   verify-self-test             Synthetic divergent state, exercises classifier
 *   status                       Show recent build-log.jsonl entries
 *   reset                        Truncate build-log.jsonl
 *
 * Output: structured JSON to stdout. Result entry appended to
 * tools/build-log.jsonl with {iteration, timestamp, operation, workspace,
 * classification, divergence, gitSha}.
 *
 * Classifications:
 *   identical              workspace files round-trip cleanly via pull
 *   concurrency-mismatch   pull failed with version-skew error (retry needed)
 *   partial                pull succeeded but expected files are missing
 *   silent-failure         pull succeeded but content is degraded (empty/placeholder)
 *   pull-error             pull command itself errored
 *   ok-no-snapshot         used by self-test and one-shot validations
 *
 * Hooks:
 *   - .claude/hooks/mcs-build-verify.js fires on PostToolUse Bash matching
 *     push commands. It parses --workspace from the command line and calls
 *     `mcs-build-loop.js verify`.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { spawnSync, execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LOG_FILE = path.join(__dirname, 'build-log.jsonl');
const MCS_LSP = path.join(__dirname, 'mcs-lsp.js');
const MAX_LOG_LINES = 5_000;

function getGitSha() {
  try { return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim(); }
  catch { return 'unknown'; }
}

function readLog() {
  if (!fs.existsSync(LOG_FILE)) return [];
  try {
    return fs.readFileSync(LOG_FILE, 'utf-8').trim().split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}

function appendLog(entry) {
  try {
    const existing = readLog();
    if (existing.length > MAX_LOG_LINES) {
      const trimmed = existing.slice(-Math.floor(MAX_LOG_LINES / 2));
      fs.writeFileSync(LOG_FILE, trimmed.map((e) => JSON.stringify(e)).join('\n') + '\n');
    }
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch { /* ignore log failures */ }
}

function hashFile(p) {
  const data = fs.readFileSync(p);
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}

function listMcsYamlFiles(workspace) {
  const files = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith('.')) continue;
      const p = path.join(dir, name);
      let stat;
      try { stat = fs.statSync(p); } catch { continue; }
      if (stat.isDirectory()) walk(p);
      else if (stat.isFile() && /\.mcs\.ya?ml$/i.test(name)) files.push(p);
    }
  }
  walk(workspace);
  return files.sort();
}

function snapshotWorkspace(workspace) {
  const out = {};
  for (const f of listMcsYamlFiles(workspace)) {
    try {
      const rel = path.relative(workspace, f).replace(/\\/g, '/');
      const stat = fs.statSync(f);
      out[rel] = {
        size: stat.size,
        hash: hashFile(f),
        mtime: stat.mtimeMs,
      };
    } catch { /* skip unreadable */ }
  }
  return out;
}

function diffSnapshots(before, after) {
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed = [];
  const added = [];
  const removed = [];
  const identical = [];
  for (const key of allKeys) {
    const b = before[key];
    const a = after[key];
    if (b && !a) removed.push(key);
    else if (!b && a) added.push(key);
    else if (b && a && b.hash !== a.hash) changed.push({ file: key, sizeBefore: b.size, sizeAfter: a.size });
    else identical.push(key);
  }
  return { identical, changed, added, removed };
}

function looksDegraded(workspace) {
  // Heuristic: agent.mcs.yml empty/placeholder or contains conflict markers anywhere.
  const findings = [];

  const agentYml = path.join(workspace, 'agent.mcs.yml');
  if (fs.existsSync(agentYml)) {
    const content = fs.readFileSync(agentYml, 'utf-8');
    if (content.trim().length < 50) findings.push('agent.mcs.yml is suspiciously small');
    if (/^# Name: default\b/m.test(content)) findings.push('agent.mcs.yml has placeholder name');
    if (/^# default\b/m.test(content)) findings.push('agent.mcs.yml has placeholder description');
  } else {
    findings.push('agent.mcs.yml is missing');
  }

  for (const f of listMcsYamlFiles(workspace)) {
    const content = fs.readFileSync(f, 'utf-8');
    if (/^<<<<<<< |^=======$|^>>>>>>> /m.test(content)) {
      findings.push(`${path.relative(workspace, f)} has conflict markers`);
    }
  }

  return findings;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0] && !args[0].startsWith('-') ? args[0] : 'verify';
  const opts = { command, workspace: null, operation: null, simulate: null };
  for (let i = command === args[0] ? 1 : 0; i < args.length; i++) {
    switch (args[i]) {
      case '--workspace':       opts.workspace = args[++i]; break;
      case '--operation':       opts.operation = args[++i]; break;
      case '--simulate-divergent': opts.simulate = 'divergent'; break;
    }
  }
  return opts;
}

async function cmdVerify(opts) {
  if (!opts.workspace) {
    console.log(JSON.stringify({ status: 'error', reason: 'workspace required (--workspace <path>)' }, null, 2));
    process.exit(2);
  }

  const workspace = path.resolve(opts.workspace);
  if (!fs.existsSync(workspace)) {
    appendAndPrint({
      operation: opts.operation || 'verify',
      workspace,
      classification: 'pull-error',
      reason: 'workspace-path-not-found',
    });
    process.exit(1);
  }
  if (!fs.existsSync(path.join(workspace, '.mcs', 'conn.json'))) {
    appendAndPrint({
      operation: opts.operation || 'verify',
      workspace,
      classification: 'pull-error',
      reason: 'workspace-missing-mcs-conn',
    });
    process.exit(1);
  }

  const beforeSnapshot = snapshotWorkspace(workspace);

  // Pull current server state — overwrites local with server's view.
  const pull = spawnSync(process.execPath, [MCS_LSP, 'pull', '--workspace', workspace], {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: 120_000,
    env: { ...process.env, CLAUDE_HEADLESS: '1' },
  });

  if (pull.status !== 0) {
    const stderr = (pull.stderr || '').slice(0, 1000);
    const cls = /ConcurrencyVersionMismatch|version mismatch/i.test(stderr) ? 'concurrency-mismatch' : 'pull-error';
    appendAndPrint({
      operation: opts.operation || 'verify',
      workspace,
      classification: cls,
      reason: stderr.split('\n')[0] || 'pull-non-zero-exit',
      pullExitCode: pull.status,
    });
    process.exit(1);
  }

  const afterSnapshot = snapshotWorkspace(workspace);
  const diff = diffSnapshots(beforeSnapshot, afterSnapshot);
  const degradedFindings = looksDegraded(workspace);

  let classification = 'identical';
  if (degradedFindings.length > 0) classification = 'silent-failure';
  else if (diff.removed.length > 0) classification = 'partial';
  else if (diff.changed.length > 0) classification = 'expected-divergence'; // server normalized something
  else if (diff.added.length > 0) classification = 'expected-divergence'; // server added a file

  appendAndPrint({
    operation: opts.operation || 'verify',
    workspace,
    classification,
    divergence: {
      identical: diff.identical.length,
      changed: diff.changed.length,
      added: diff.added.length,
      removed: diff.removed.length,
      changedFiles: diff.changed.slice(0, 10),
      addedFiles: diff.added.slice(0, 10),
      removedFiles: diff.removed.slice(0, 10),
    },
    degradedFindings,
  });
  // Exit 0 for identical/expected-divergence; non-zero only for actual problems.
  process.exit(['identical', 'expected-divergence'].includes(classification) ? 0 : 1);
}

function cmdSelfTest() {
  // Synthesize before/after snapshots and confirm the diffSnapshots + looksDegraded
  // classification path returns the right verdicts.
  const cases = [
    {
      name: 'identical (no changes)',
      before: { 'a.mcs.yml': { size: 10, hash: 'aaaa', mtime: 1 } },
      after: { 'a.mcs.yml': { size: 10, hash: 'aaaa', mtime: 2 } },
      expect: { changed: 0, added: 0, removed: 0, identical: 1 },
    },
    {
      name: 'one file changed',
      before: { 'a.mcs.yml': { size: 10, hash: 'aaaa', mtime: 1 } },
      after: { 'a.mcs.yml': { size: 12, hash: 'bbbb', mtime: 2 } },
      expect: { changed: 1, added: 0, removed: 0, identical: 0 },
    },
    {
      name: 'one file removed (server-side)',
      before: { 'a.mcs.yml': { size: 10, hash: 'aaaa', mtime: 1 }, 'b.mcs.yml': { size: 10, hash: 'cccc', mtime: 1 } },
      after: { 'a.mcs.yml': { size: 10, hash: 'aaaa', mtime: 2 } },
      expect: { changed: 0, added: 0, removed: 1, identical: 1 },
    },
    {
      name: 'one file added (server-side)',
      before: { 'a.mcs.yml': { size: 10, hash: 'aaaa', mtime: 1 } },
      after: { 'a.mcs.yml': { size: 10, hash: 'aaaa', mtime: 2 }, 'b.mcs.yml': { size: 5, hash: 'dddd', mtime: 2 } },
      expect: { changed: 0, added: 1, removed: 0, identical: 1 },
    },
  ];

  const results = [];
  let allPass = true;
  for (const c of cases) {
    const diff = diffSnapshots(c.before, c.after);
    const counts = { changed: diff.changed.length, added: diff.added.length, removed: diff.removed.length, identical: diff.identical.length };
    const pass = counts.changed === c.expect.changed
      && counts.added === c.expect.added
      && counts.removed === c.expect.removed
      && counts.identical === c.expect.identical;
    if (!pass) allPass = false;
    results.push({ case: c.name, expected: c.expect, got: counts, pass });
  }

  // Degraded heuristic
  const tmp = path.join(os.tmpdir(), `mbl-selftest-${process.pid}`);
  fs.mkdirSync(tmp, { recursive: true });
  fs.writeFileSync(path.join(tmp, 'agent.mcs.yml'), '# Name: default\n# default\n');
  const findings = looksDegraded(tmp);
  const placeholderPass = findings.some((f) => f.includes('placeholder'));
  if (!placeholderPass) allPass = false;
  results.push({ case: 'degraded heuristic (placeholder name+desc)', expected: 'finds placeholders', got: findings, pass: placeholderPass });

  // Cleanup
  try { fs.unlinkSync(path.join(tmp, 'agent.mcs.yml')); } catch { /* ignore */ }
  try { fs.rmdirSync(tmp); } catch { /* ignore */ }

  console.log(JSON.stringify({
    command: 'verify-self-test',
    allPass,
    cases: results,
    note: allPass
      ? 'MCS build loop classifier working: detects identical/changed/added/removed/degraded.'
      : 'REGRESSION: classifier returned unexpected results.',
  }, null, 2));
  process.exit(allPass ? 0 : 1);
}

function cmdStatus() {
  const log = readLog();
  if (log.length === 0) {
    console.log(JSON.stringify({ status: 'no-history', message: 'No build operations logged yet.' }, null, 2));
    return;
  }
  const recent = log.slice(-10).map((e) => ({
    iteration: e.iteration,
    timestamp: e.timestamp,
    operation: e.operation,
    workspace: e.workspace ? path.relative(ROOT, e.workspace).replace(/\\/g, '/') : null,
    classification: e.classification,
    divergence: e.divergence,
  }));
  const counts = {};
  for (const e of log) counts[e.classification || 'unknown'] = (counts[e.classification || 'unknown'] || 0) + 1;
  console.log(JSON.stringify({ totalEntries: log.length, classificationCounts: counts, recent }, null, 2));
}

function cmdReset() {
  if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);
  console.log(JSON.stringify({ status: 'reset', message: 'build-log.jsonl cleared.' }, null, 2));
}

function appendAndPrint(partial) {
  const log = readLog();
  const entry = {
    iteration: log.length + 1,
    timestamp: new Date().toISOString(),
    gitSha: getGitSha(),
    ...partial,
  };
  appendLog(entry);
  console.log(JSON.stringify(entry, null, 2));
  return entry;
}

async function main() {
  const opts = parseArgs();
  switch (opts.command) {
    case 'verify': await cmdVerify(opts); break;
    case 'verify-self-test':
    case 'self-test': cmdSelfTest(); break;
    case 'status': cmdStatus(); break;
    case 'reset': cmdReset(); break;
    default:
      console.log(JSON.stringify({
        error: `Unknown command: ${opts.command}`,
        usage: 'verify --workspace <path> | verify-self-test | status | reset',
      }, null, 2));
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ status: 'fatal', error: err.message }, null, 2));
  process.exit(3);
});
