#!/usr/bin/env node
/**
 * Session Start Hook
 *
 * Surfaces at session open:
 *   - Tier 1 cache freshness (warns at >14 days, blocks /mcs-build elsewhere).
 *   - Active git worktrees (so the user sees parallel sessions).
 *   - Pending test-loop or build-loop verification results from a prior session.
 *
 * Fast path: reads HTML-comment frontmatter from knowledge/cache/*.md and
 * computes staleness locally. No network calls, no npm scripts. Total
 * runtime should stay under 200ms even on a cold disk.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

if (process.env.CLAUDE_HEADLESS === '1') process.exit(0);

const ROOT = path.resolve(__dirname, '..', '..');
const CACHE_DIR = path.join(ROOT, 'knowledge', 'cache');
const TEST_LAST = path.join(ROOT, 'tools', '.test-loop.last-result.json');
const BUILD_LOG = path.join(ROOT, 'tools', 'build-log.jsonl');

// Tier 1: build-critical files — staleness >14 days blocks /mcs-build.
const TIER1_FILES = [
  'triggers.md',
  'models.md',
  'mcp-servers.md',
  'connectors.md',
  'knowledge-sources.md',
  'channels.md',
  'first-party-agents.md',
  'declarative-agents.md',
];

const messages = [];

// 1. Cache staleness
try {
  const stale = [];
  const today = new Date();
  for (const file of TIER1_FILES) {
    const p = path.join(CACHE_DIR, file);
    if (!fs.existsSync(p)) {
      stale.push({ file, ageDays: null, reason: 'missing' });
      continue;
    }
    const head = fs.readFileSync(p, 'utf8').slice(0, 2000);
    const m = head.match(/last_verified:\s*(\d{4}-\d{2}-\d{2})/i);
    if (!m) {
      stale.push({ file, ageDays: null, reason: 'no-frontmatter' });
      continue;
    }
    const verified = new Date(m[1]);
    const ageDays = Math.round((today - verified) / 86_400_000);
    if (ageDays > 14) stale.push({ file, ageDays, reason: 'over-14-days' });
  }
  if (stale.length > 0) {
    const summary = stale.map((s) => s.ageDays != null ? `${s.file} (${s.ageDays}d)` : `${s.file} (${s.reason})`).join(', ');
    messages.push(
      `[session-start] Tier 1 cache stale (${stale.length} file${stale.length === 1 ? '' : 's'}): ${summary}. ` +
      `/mcs-build will refuse without --allow-stale. Run \`/mcs-sync\` to surface drift; TAKE the cache cards to update.`
    );
  }
} catch { /* don't break session start on cache errors */ }

// 2. Active worktrees
try {
  const out = execFileSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 3_000,
  });
  const worktrees = [];
  let current = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current) worktrees.push(current);
      current = { path: line.slice(9), branch: null };
    } else if (line.startsWith('branch ') && current) {
      current.branch = line.slice(7);
    }
  }
  if (current) worktrees.push(current);
  // Filter out the main worktree (the one running this session) — not interesting.
  const others = worktrees.filter((w) => path.resolve(w.path) !== ROOT);
  if (others.length > 0) {
    const summary = others.map((w) => `${path.basename(w.path)} (${w.branch || '?'})`).join(', ');
    messages.push(
      `[session-start] ${others.length} active worktree${others.length === 1 ? '' : 's'}: ${summary}. ` +
      `Tear down with \`tools/end-session.sh <topic>\`.`
    );
  }
} catch { /* git not available or not a repo */ }

// 3. Stale test-loop result
try {
  if (fs.existsSync(TEST_LAST)) {
    const r = JSON.parse(fs.readFileSync(TEST_LAST, 'utf8'));
    const ranAt = r.ranAt ? new Date(r.ranAt) : null;
    const ageH = ranAt ? Math.round((Date.now() - ranAt.getTime()) / 3_600_000) : null;
    if (ageH != null && ageH < 24) {
      if (!r.skipped && r.result && r.result.status && r.result.status !== 'green') {
        messages.push(
          `[session-start] Last auto-fire test loop run (${ageH}h ago) was ${r.result.status}: ` +
          `${r.result.testResults?.failed ?? '?'} failed / ${r.result.testResults?.total ?? '?'} total. ` +
          `Inspect: \`node tools/agentic-test-loop.js failures\`.`
        );
      }
    }
  }
} catch { /* ignore */ }

// 4. Recent MCS build verifications
try {
  if (fs.existsSync(BUILD_LOG)) {
    const lines = fs.readFileSync(BUILD_LOG, 'utf8').trim().split('\n').filter(Boolean);
    const last5 = lines.slice(-5).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const bad = last5.filter((e) => e.classification && !['identical', 'expected-divergence'].includes(e.classification));
    if (bad.length > 0) {
      messages.push(
        `[session-start] Recent MCS build verifications include ${bad.length} non-clean result${bad.length === 1 ? '' : 's'}. ` +
        `Inspect: \`node tools/mcs-build-loop.js status\`.`
      );
    }
  }
} catch { /* ignore */ }

if (messages.length > 0) {
  process.stdout.write(messages.join('\n\n'));
}
process.exit(0);
