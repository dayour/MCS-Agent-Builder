#!/usr/bin/env node
/**
 * Test-guard: block commits that change test files without explicit justification.
 *
 * Anti-gaming rationale: the agentic test loop runs tests and iterates to green.
 * If the loop can freely modify e2e/** or knowledge/feature-map.json, it can
 * "fix" failing tests by weakening assertions or deleting checks. This guard
 * requires commits touching those paths to include "allow-test-change: <reason>"
 * in the commit message (or set ALLOW_TEST_CHANGE env var).
 *
 * Exit codes:
 *   0 — no test-file changes, or justification present
 *   1 — test files changed without justification
 *
 * Bypass (all audited to tools/test-guard-audit.jsonl):
 *   - Commit message contains "allow-test-change: <reason>"
 *   - ALLOW_TEST_CHANGE=1 env var set
 *   - ALLOW_TEST_CHANGE="reason" env var set
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const GUARDED_PATTERNS = [
  /^app\/frontend\/e2e\//,                    // all e2e test files
  /^knowledge\/feature-map\.json$/,           // feature routing
  /^app\/frontend\/playwright\.config\.ts$/,  // project config
];

function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMRD', { encoding: 'utf-8' }).trim();
    return out ? out.split('\n') : [];
  } catch {
    return [];
  }
}

function getCommitMessage() {
  // Git passes the commit message file path as arg[0] during commit-msg hook,
  // but for pre-commit there is no message yet. Check COMMIT_EDITMSG as fallback.
  const msgFile = process.argv[2];
  if (msgFile && fs.existsSync(msgFile)) {
    try { return fs.readFileSync(msgFile, 'utf-8'); } catch { /* ignore */ }
  }
  const gitDir = (() => {
    try { return execSync('git rev-parse --git-dir', { encoding: 'utf-8' }).trim(); }
    catch { return '.git'; }
  })();
  const editmsg = path.join(gitDir, 'COMMIT_EDITMSG');
  if (fs.existsSync(editmsg)) {
    try { return fs.readFileSync(editmsg, 'utf-8'); } catch { /* ignore */ }
  }
  return '';
}

function auditBypass(bypassType, reason, files) {
  try {
    const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
    const auditPath = path.join(repoRoot, 'tools', 'test-guard-audit.jsonl');
    const committer = (() => {
      try { return execSync('git var GIT_COMMITTER_IDENT', { encoding: 'utf-8' }).trim(); }
      catch { return 'unknown'; }
    })();
    const gitSha = (() => {
      try { return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim(); }
      catch { return 'unknown'; }
    })();
    const entry = {
      ts: new Date().toISOString(),
      gitSha,
      committer,
      bypassType,
      reason: String(reason).slice(0, 200),
      files,
    };
    fs.appendFileSync(auditPath, JSON.stringify(entry) + '\n');
  } catch {
    // Audit failure must not block the commit — log to stderr only.
    console.error('[test-guard] WARNING: audit log write failed (commit proceeds)');
  }
}

function main() {
  const staged = getStagedFiles();
  const offending = staged.filter((f) => GUARDED_PATTERNS.some((p) => p.test(f)));

  if (offending.length === 0) {
    process.exit(0);
  }

  // New test files are always allowed — only *modifications* are risky.
  // Check git diff --cached --diff-filter=AM to separate adds from modifies.
  let modified;
  try {
    const modOut = execSync('git diff --cached --name-only --diff-filter=M', { encoding: 'utf-8' }).trim();
    modified = new Set(modOut ? modOut.split('\n') : []);
  } catch {
    modified = new Set();
  }
  const offendingMods = offending.filter((f) => modified.has(f));

  if (offendingMods.length === 0) {
    // All offending files are new additions, not modifications — allowed.
    process.exit(0);
  }

  // Check bypass conditions
  const env = process.env.ALLOW_TEST_CHANGE;
  if (env && env !== '0' && env !== 'false') {
    console.error(`[test-guard] test changes allowed by ALLOW_TEST_CHANGE env: ${env.slice(0, 100)}`);
    auditBypass('env', env, offendingMods);
    process.exit(0);
  }

  const msg = getCommitMessage();
  const match = msg.match(/allow-test-change\s*:\s*([^\n]+)/i);
  if (match && match[1].trim().length >= 8) {
    console.error(`[test-guard] test changes allowed: "${match[1].trim().slice(0, 100)}"`);
    auditBypass('commit-msg', match[1].trim(), offendingMods);
    process.exit(0);
  }

  console.error('');
  console.error('[test-guard] BLOCKED: staged commit modifies test files:');
  for (const f of offendingMods) console.error(`  ${f}`);
  console.error('');
  console.error('Test-file modifications risk gaming the agentic loop (weakening');
  console.error('assertions to turn red tests green). Provide explicit justification:');
  console.error('');
  console.error('  Option 1 — add to commit message:');
  console.error('    allow-test-change: <reason, at least 8 chars>');
  console.error('');
  console.error('  Option 2 — env bypass (one-off):');
  console.error('    ALLOW_TEST_CHANGE="adding coverage for X" git commit ...');
  console.error('');
  console.error('New test files are NOT blocked — only modifications to existing tests.');
  console.error('');
  process.exit(1);
}

main();
