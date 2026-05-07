#!/usr/bin/env node
/**
 * Elevate upstream sync — READ-ONLY research monitoring.
 *
 * Compares our elevate-upstream tracking branch against elevate/main
 * (bap-microsoft/Elevate) and produces:
 *   - A terminal summary (default)
 *   - A structured digest appended to knowledge/learnings/elevate-upstream-digest.md (--digest)
 *
 * This tool NEVER merges, rebases, checks out, or modifies any file in our app.
 * Cherry-picking is a manual human decision after reviewing the digest.
 *
 * Local safety rails (pushURL=DISABLED + pre-push hook) are discipline aids,
 * NOT policy enforcement. Server-side org policy is the real guarantee.
 *
 * Usage:
 *   node tools/elevate-sync.js                Report diffs to terminal
 *   node tools/elevate-sync.js --update       Fast-forward elevate-upstream tracking branch
 *   node tools/elevate-sync.js --digest       Write classified digest to knowledge/learnings/
 *   node tools/elevate-sync.js --digest --update   Manual path invoked from /mcs-sync action plans
 *
 * Exit codes:
 *   0 = no new commits (nothing to report) / success
 *   1 = new commits found (informational, non-error)
 *   2 = error (remote unreachable, force-push detected, IO failure)
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.dirname(__dirname);

const REMOTE = 'elevate';
const UPSTREAM_REF = `${REMOTE}/main`;
const UPSTREAM_BRANCH = 'elevate-upstream';
const DIGEST_PATH = path.join(REPO_ROOT, 'knowledge', 'learnings', 'elevate-upstream-digest.md');
const MAX_COMMITS_PER_RUN = 50;

// Map Elevate source paths -> our equivalent paths.
// If Elevate changes src/pages/X, we check app/frontend/src/pages/X.
const PATH_MAP = [
  { from: 'src/pages/',      to: 'app/frontend/src/pages/' },
  { from: 'src/components/', to: 'app/frontend/src/components/' },
  { from: 'src/hooks/',      to: 'app/frontend/src/hooks/' },
  { from: 'src/context/',    to: 'app/frontend/src/context/' },
  { from: 'src/utils/',      to: 'app/frontend/src/utils/' },
  { from: 'src/domains/',    to: 'app/frontend/src/domains/' },
  { from: 'src/types/',      to: 'app/frontend/src/types/' },
  { from: 'src/config/',     to: 'app/frontend/src/config/' },
  { from: 'src/styles/',     to: 'app/frontend/src/styles/' },
];

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', cwd: REPO_ROOT, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function runSafe(cmd) {
  try { return run(cmd); } catch { return ''; }
}

// ── Safety: sanitize upstream content before writing to local files ────────
// Strips control characters, neutralizes agent/prompt-injection markers,
// and truncates to a safe length. Never write raw upstream text verbatim.
function sanitize(text, maxLen = 140) {
  if (!text) return '';
  return String(text)
    .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, ' ')
    .replace(/<\/?(system-reminder|system|user|assistant|instructions?)>/gi, '[tag]')
    .replace(/\[(GPT CO-GEN|SYSTEM NOTIFICATION|IMPORTANT)[^\]]*\]/gi, '[redacted]')
    .replace(/\|/g, '\\|')
    .slice(0, maxLen);
}

function categorize(files) {
  const cats = {
    components: [], pages: [], hooks: [], context: [], utils: [],
    domains: [], styles: [], types: [], config: [], other: [],
  };
  for (const f of files) {
    if (f.includes('src/components/')) cats.components.push(f);
    else if (f.includes('src/pages/')) cats.pages.push(f);
    else if (f.includes('src/hooks/')) cats.hooks.push(f);
    else if (f.includes('src/context/')) cats.context.push(f);
    else if (f.includes('src/utils/')) cats.utils.push(f);
    else if (f.includes('src/domains/')) cats.domains.push(f);
    else if (f.endsWith('.css') || f.includes('/styles/')) cats.styles.push(f);
    else if (f.includes('src/types/')) cats.types.push(f);
    else if (f.includes('config') || f === 'package.json' || f === 'package-lock.json') cats.config.push(f);
    else cats.other.push(f);
  }
  return cats;
}

// Map an Elevate path to our equivalent, return null if unmapped.
function mapToOurPath(elevatePath) {
  for (const { from, to } of PATH_MAP) {
    if (elevatePath.startsWith(from)) {
      return elevatePath.replace(from, to);
    }
  }
  return null;
}

function ourRepoHas(relPath) {
  return fs.existsSync(path.join(REPO_ROOT, relPath));
}

// ── Fetch + force-push detection ─────────────────────────────────────────
function fetchUpstream() {
  try {
    run(`git fetch ${REMOTE} main --no-tags --quiet`);
    return true;
  } catch {
    console.error(`[Elevate Sync] Failed to fetch ${REMOTE}. Configure with:`);
    console.error(`  git remote add elevate https://github.com/bap-microsoft/Elevate.git`);
    return false;
  }
}

// If the new upstream tip is not a descendant of our previous tracking tip,
// upstream rebased or force-pushed. Surface this — don't silently reprocess.
function detectForcePush(prevSha, newSha) {
  if (!prevSha || prevSha === newSha) return false;
  const isDescendant = runSafe(`git merge-base --is-ancestor ${prevSha} ${newSha} && echo OK`);
  return isDescendant !== 'OK';
}

// ── Digest formatting ────────────────────────────────────────────────────
function buildCommitSection(sha, sanitizedMsg, author, date, files) {
  const cats = categorize(files);
  const overlaps = [];
  const newForUs = [];
  for (const f of files) {
    const mapped = mapToOurPath(f);
    if (mapped && ourRepoHas(mapped)) overlaps.push({ upstream: f, ours: mapped });
    else if (mapped) newForUs.push({ upstream: f, wouldBe: mapped });
  }

  const catSummary = Object.entries(cats)
    .filter(([, v]) => v.length > 0)
    .map(([k, v]) => `${k}(${v.length})`)
    .join(', ');

  const lines = [];
  lines.push(`### ${sha.slice(0, 8)} — ${sanitizedMsg}`);
  lines.push('');
  lines.push(`- Author: ${sanitize(author, 60)} · Date: ${sanitize(date, 32)}`);
  lines.push(`- Files: ${files.length} · Categories: ${catSummary || 'none'}`);
  if (overlaps.length > 0) {
    lines.push(`- Overlaps with our repo (${overlaps.length}):`);
    for (const o of overlaps.slice(0, 6)) lines.push(`  - \`${o.upstream}\` ↔ \`${o.ours}\``);
    if (overlaps.length > 6) lines.push(`  - ...and ${overlaps.length - 6} more`);
  }
  if (newForUs.length > 0) {
    lines.push(`- New paths we do not have (${newForUs.length}):`);
    for (const n of newForUs.slice(0, 6)) lines.push(`  - \`${n.upstream}\` → would map to \`${n.wouldBe}\``);
    if (newForUs.length > 6) lines.push(`  - ...and ${newForUs.length - 6} more`);
  }
  lines.push('');
  lines.push('- Classification: [ ] ADOPT  [ ] REPLACE  [ ] IGNORE  — _pending manual review_');
  lines.push('');
  return lines.join('\n');
}

function ensureDigestHeader() {
  if (fs.existsSync(DIGEST_PATH)) return;
  const header = [
    '# Elevate Upstream Digest (Read-Only Monitoring)',
    '',
    '> **Source**: bap-microsoft/Elevate (Copilot Studio product UX research).',
    '> **Policy**: READ-ONLY. Never auto-merge, rebase, or check out upstream files.',
    '> **Legal**: Review Microsoft IP, license, and attribution policy BEFORE cherry-picking.',
    '> **Safety**: Local `pushURL=DISABLED` + pre-push hook block accidental pushes.',
    '>   These are discipline aids — true enforcement requires server-side org policy.',
    '',
    'Newest entries at top. Each section is keyed by upstream commit SHA so re-runs',
    'dedup naturally. Classify each commit as ADOPT / REPLACE / IGNORE after review.',
    '',
    '---',
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(DIGEST_PATH), { recursive: true });
  fs.writeFileSync(DIGEST_PATH, header);
}

// Read existing digest; return set of already-recorded SHAs.
function existingDigestShas() {
  if (!fs.existsSync(DIGEST_PATH)) return new Set();
  const content = fs.readFileSync(DIGEST_PATH, 'utf8');
  const matches = content.match(/^### ([0-9a-f]{8}) /gm) || [];
  return new Set(matches.map(m => m.replace(/^### |\s.*$/g, '')));
}

function prependToDigest(runHeader, sections) {
  ensureDigestHeader();
  const existing = fs.readFileSync(DIGEST_PATH, 'utf8');
  const marker = '---\n\n';
  const idx = existing.indexOf(marker);
  if (idx === -1) {
    fs.writeFileSync(DIGEST_PATH, existing + '\n' + runHeader + sections.join('\n'));
    return;
  }
  const head = existing.slice(0, idx + marker.length);
  const tail = existing.slice(idx + marker.length);
  fs.writeFileSync(DIGEST_PATH, head + runHeader + sections.join('\n') + tail);
}

// ── Main ──────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const doUpdate = args.includes('--update');
  const doDigest = args.includes('--digest');
  const isJson = args.includes('--json');

  if (!fetchUpstream()) process.exit(2);

  const remoteHead = runSafe(`git rev-parse ${UPSTREAM_REF}`);
  if (!remoteHead) {
    console.error(`[Elevate Sync] Cannot resolve ${UPSTREAM_REF}.`);
    process.exit(2);
  }

  // Ensure elevate-upstream tracking branch exists (create from elevate/main if not).
  let localHead = runSafe(`git rev-parse ${UPSTREAM_BRANCH}`);
  if (!localHead) {
    runSafe(`git branch ${UPSTREAM_BRANCH} ${UPSTREAM_REF}`);
    localHead = runSafe(`git rev-parse ${UPSTREAM_BRANCH}`);
  }

  if (localHead === remoteHead) {
    if (isJson) console.log(JSON.stringify({ status: 'up-to-date', remoteHead }));
    else console.log('[Elevate Sync] Up to date. No new changes.');
    process.exit(0);
  }

  // Force-push / rebase detection
  const forcePushed = detectForcePush(localHead, remoteHead);
  if (forcePushed) {
    const msg = `Upstream rebased/force-pushed. Previous tip ${localHead.slice(0, 8)} is not an ancestor of ${remoteHead.slice(0, 8)}. Skipping digest — manual review required.`;
    if (isJson) console.log(JSON.stringify({ status: 'force-push', prev: localHead, next: remoteHead }));
    else console.error(`[Elevate Sync] WARNING: ${msg}`);
    // Do NOT update tracking branch on force-push — requires human decision.
    process.exit(2);
  }

  // Collect new commits (oldest → newest) since our tracking tip.
  const log = runSafe(`git log --pretty=format:%H%x1f%an%x1f%ai%x1f%s ${UPSTREAM_BRANCH}..${UPSTREAM_REF}`);
  const commits = log
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [sha, author, date, subject] = line.split('\x1f');
      return { sha, author, date, subject };
    })
    .reverse();

  if (commits.length === 0) {
    if (isJson) console.log(JSON.stringify({ status: 'no-new-commits' }));
    else console.log('[Elevate Sync] No new commits in range.');
    process.exit(0);
  }

  // Terminal summary (always)
  if (!isJson) {
    console.log(`[Elevate Sync] ${commits.length} new commit(s) on ${UPSTREAM_REF}:`);
    for (const c of commits.slice(0, 8)) {
      console.log(`  ${c.sha.slice(0, 8)} ${sanitize(c.subject, 80)}`);
    }
    if (commits.length > 8) console.log(`  ...and ${commits.length - 8} more`);
  }

  // Digest write
  if (doDigest) {
    const already = existingDigestShas();
    const newCommits = commits.filter(c => !already.has(c.sha.slice(0, 8)));
    const capped = newCommits.slice(-MAX_COMMITS_PER_RUN);

    const sections = capped.map(c => {
      const filesRaw = runSafe(`git show --name-only --pretty=format: ${c.sha}`);
      const files = filesRaw.split('\n').filter(Boolean);
      return buildCommitSection(
        c.sha,
        sanitize(c.subject, 120),
        c.author,
        c.date,
        files
      );
    });

    const today = new Date().toISOString().slice(0, 10);
    const runHeader = [
      `## Run ${today} — ${capped.length} new commit(s)`,
      '',
      `- Tracking tip before: \`${localHead.slice(0, 8)}\``,
      `- Upstream tip after:  \`${remoteHead.slice(0, 8)}\``,
      `- Commits processed:   ${capped.length}${newCommits.length > MAX_COMMITS_PER_RUN ? ` (capped from ${newCommits.length})` : ''}`,
      '',
    ].join('\n');

    if (capped.length > 0) {
      prependToDigest(runHeader, sections);
      if (!isJson) console.log(`[Elevate Sync] Digest updated: ${path.relative(REPO_ROOT, DIGEST_PATH)}`);
    } else if (!isJson) {
      console.log('[Elevate Sync] All new commits already recorded in digest.');
    }
  }

  // Advance tracking branch only if --update was requested AND fast-forward is safe.
  if (doUpdate) {
    runSafe(`git branch -f ${UPSTREAM_BRANCH} ${UPSTREAM_REF}`);
    if (!isJson) console.log(`[Elevate Sync] ${UPSTREAM_BRANCH} fast-forwarded to ${remoteHead.slice(0, 8)}`);
  } else if (!isJson) {
    console.log(`[Elevate Sync] Run with --update to fast-forward ${UPSTREAM_BRANCH}.`);
  }

  if (isJson) {
    console.log(JSON.stringify({
      status: 'new-commits',
      count: commits.length,
      prev: localHead,
      next: remoteHead,
      digestWritten: doDigest,
      trackingAdvanced: doUpdate,
    }));
  }

  process.exit(1);
}

main();
