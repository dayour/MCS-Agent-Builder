#!/usr/bin/env node
/**
 * Iterate Orchestrator — pure-logic CLI that powers the /iterate skill.
 *
 * Provides deterministic primitives that Claude invokes from the iterate
 * SKILL.md. The skill itself owns the higher-level reasoning loop (run lanes
 * → review → fix → re-run → merge gate). This tool answers small, exact
 * questions with JSON.
 *
 * Subcommands:
 *   classify [--against <ref>]
 *     Walk `git status` and the optional diff against <ref>; assign each
 *     changed file to a lane (frontend / backend / framework / agentspec /
 *     denylist). Print the lane assignment as JSON.
 *
 *   run-lanes [--lanes <comma-list>] [--require-oracle] [--feature <key>]
 *                  [--quick] [--start-server]
 *     Spawn the deterministic lane verifiers in parallel:
 *       frontend  → node tools/agentic-test-loop.js run [--feature X --require-oracle]
 *       backend   → node tools/backend-verify.js [--quick]
 *     Framework + agentspec lanes are NOT spawned here (they require Skill
 *     invocation). The output indicates which non-mechanical lanes need
 *     Claude follow-up.
 *
 *   verdict [--require-merged-review]
 *     Combine the per-lane last-result files, the facilitator review (if
 *     present in the session marker), and the multi-model-review review-merged
 *     output (if --require-merged-review and the result is in the session)
 *     into a single verdict object.
 *
 *   audit-append --event <type> --data '<json>' [--actor <name>]
 *   audit-verify
 *     Hash-chained append-only log at knowledge/learnings/iterate-audit.jsonl.
 *     Identical pattern to app/lib/eval-gate-audit.js.
 *
 *   session-create [--reason <text>]
 *   session-update --phase <phase> --state <state> [--reason <text>] [--data '<json>']
 *   session-get
 *   session-clear
 *     Manages tools/.iterate-session.json. The Stop hook reads this to
 *     surface paused/escalated sessions to the user across turns.
 *
 *   --help
 *     Print this help.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TEST_LOOP = path.join(ROOT, 'tools', 'agentic-test-loop.js');
const BACKEND_VERIFY = path.join(ROOT, 'tools', 'backend-verify.js');
const FRONTEND_RESULT = path.join(ROOT, 'tools', '.test-loop.last-result.json');
const BACKEND_RESULT = path.join(ROOT, 'tools', '.backend-verify.last-result.json');
const SESSION_FILE = path.join(ROOT, 'tools', '.iterate-session.json');
const AUDIT_LOG = process.env.ITERATE_AUDIT_LOG
  || path.join(ROOT, 'knowledge', 'learnings', 'iterate-audit.jsonl');
const GENESIS_HASH = 'GENESIS';

// ---------------------------------------------------------------------------
// Lane classification
// ---------------------------------------------------------------------------

/**
 * Denylist regexes — any change matching these is NOT eligible for auto-merge.
 * Keep these in sync with knowledge/frameworks/auto-merge-denylist.md.
 */
const DENYLIST_PATTERNS = [
  // Dependencies / lockfiles — all major ecosystems (per GPT challenge 2026-05-04)
  /^package\.json$/,
  /^package-lock\.json$/,
  /^yarn\.lock$/,
  /^pnpm-lock\.yaml$/,
  /^npm-shrinkwrap\.json$/,
  /^bun\.lockb$/,
  /(^|\/)package\.json$/,
  /(^|\/)package-lock\.json$/,
  /^pyproject\.toml$/,
  /^requirements.*\.txt$/,
  /^Pipfile(\.lock)?$/,
  /^poetry\.lock$/,
  /^Cargo\.(toml|lock)$/,
  /^go\.(mod|sum)$/,
  /^Gemfile(\.lock)?$/,
  /^composer\.(json|lock)$/,
  /^pom\.xml$/,
  /^build\.gradle(\.kts)?$/,
  /^settings\.gradle(\.kts)?$/,

  // CI / GitHub workflows + adjacent CI providers
  /^\.github\/workflows\//,
  /^\.github\/actions\//,
  /^CODEOWNERS$/i,
  /^\.github\/CODEOWNERS$/i,
  /^\.circleci\//,
  /^\.gitlab-ci\.ya?ml$/,
  /^cloudbuild\.ya?ml$/,
  /^\.buildkite\//,
  /^Jenkinsfile$/i,
  /^azure-pipelines\.ya?ml$/,
  /^bitbucket-pipelines\.ya?ml$/,

  // Database migrations + schema
  /(^|\/)migrations\//,
  /(^|\/)migrate\//,
  /(^|\/)prisma\/schema\.prisma$/,

  // Auth + secrets + credentials
  /(^|\/)auth(?:\/|\.|-)/i,
  /[-_/]auth\.(?:js|ts|cjs|mjs|tsx)$/i,
  /(^|\/)\.env/,
  /(^|\/)secrets?[-_./]/i,
  /(^|\/)credentials?[-_./]/i,

  // Hook plumbing — the harness itself
  /^\.claude\/hooks\//,
  /^\.claude\/settings\.json$/,
  /^\.claude\/settings\.local\.json$/,
  /^tools\/git-hooks\//,

  // High-blast-radius LLM clients
  /^tools\/lib\/openai\.js$/,
  /^tools\/lib\/anthropic\.js$/,

  // The orchestrator/skill machinery itself
  /^tools\/iterate-orchestrator\.js$/,
  /^tools\/auto-merge-gate\.js$/,
  /^tools\/oracle-runner\.js$/,
  /^tools\/backend-verify\.js$/,
  /^tools\/agentic-test-loop\.js$/,
  /^\.claude\/skills\/iterate\//,
  /^\.claude\/skills\/mcs-iterate\//,
  /^\.claude\/agents\/qa-challenger\.md$/,
  /^knowledge\/frameworks\/auto-merge-denylist\.md$/,
  /^\.claude\/rules\/iterate-framework\.md$/,
  /^\.claude\/skills\/iterate\/review-schema\.json$/,

  // The audit log itself — must not be writable by PR
  /^knowledge\/learnings\/(iterate|auto-merge)-audit\.jsonl$/,
  /^knowledge\/learnings\/eval-gate-overrides\.jsonl$/,

  // Build / containerization — execute code at build/deploy
  /^Dockerfile(\..*)?$/,
  /(^|\/)Dockerfile$/,
  /^docker-compose(\..*)?\.ya?ml$/,
  /^Makefile$/,
  /^Taskfile\.ya?ml$/,
  /^Justfile$/,
  /^\.dockerignore$/,
  /^webpack\.config\.(js|ts|cjs|mjs)$/,
  /^vite\.config\.(js|ts|cjs|mjs)$/,
  /^rollup\.config\.(js|ts|cjs|mjs)$/,
  /^babel\.config\.(js|json)$/,
  /^\.babelrc(\.json)?$/,
  /^tsconfig\.json$/,
  /^tsconfig\..*\.json$/,
  /^next\.config\.(js|ts|cjs|mjs)$/,
  /^nuxt\.config\.(js|ts|cjs|mjs)$/,
  /^\.eslintrc(\.[a-z]+)?$/,
  /^eslint\.config\.(js|ts|cjs|mjs)$/,

  // Infrastructure-as-code — production-affecting
  /\.(tf|tfvars|tfstate|tfstate\.backup)$/,
  /^terraform\//,
  /^infra(structure)?\//,
  /^helm\//,
  /^k8s\//,
  /^kubernetes\//,
  /^charts\//,
  /^(deploy|deployment)\//,
  /^pulumi\//,
  /^cdk\//,

  // Submodule + git internals
  /^\.gitmodules$/,
  /^\.git\//,
];

const LANE_PATTERNS = [
  // Order matters: more specific lanes first. First match wins.
  { lane: 'agentspec', re: /^Build-Guides\/[^\/]+\/agents\/[^\/]+\/agentspec\.json$/ },

  // Framework: skill/rule/agent definitions, hooks, settings, top-level CLAUDE.md
  { lane: 'framework', re: /^\.claude\/(rules|skills|agents|hooks)\// },
  { lane: 'framework', re: /^\.claude\/settings(\.local)?\.json$/ },
  { lane: 'framework', re: /^CLAUDE\.md$/ },

  // Frontend: any change under app/frontend/ kicks the frontend lane.
  // Subtree patterns (src/, e2e/) are subsumed by this.
  { lane: 'frontend',  re: /^app\/frontend\// },

  // Backend: server entry, libs, generic tools/. tools/__tests__ stays here too.
  { lane: 'backend',   re: /^app\/server\.js$/ },
  { lane: 'backend',   re: /^app\/lib\// },
  { lane: 'backend',   re: /^tools\// },
  { lane: 'backend',   re: /^scripts\// },
  { lane: 'backend',   re: /^bin\// },

  // Docs at the repo root or in knowledge/. Knowledge frameworks/learnings
  // land here unless they match a more-specific pattern earlier.
  { lane: 'docs',      re: /^(README|CHANGELOG|VERSION|LICENSE)/i },
  { lane: 'docs',      re: /^docs\// },
  { lane: 'docs',      re: /^knowledge\// },
  { lane: 'docs',      re: /\.md$/i },
];

function classifyFile(rel) {
  const norm = rel.replace(/\\/g, '/');
  // Denylist first — if matched, the lane is still computed (so the file
  // gets verified by the appropriate lane), but it's flagged for no-merge.
  const denylisted = DENYLIST_PATTERNS.some((p) => p.test(norm));
  for (const { lane, re } of LANE_PATTERNS) {
    if (re.test(norm)) return { lane, denylisted };
  }
  return { lane: 'other', denylisted };
}

function getChangedFiles({ against } = {}) {
  // Working tree changes (modified, untracked, staged) + optional commit-range diff.
  const out = [];
  try {
    const status = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf-8' });
    for (const line of status.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const file = line.slice(3).trim();
      // Handle renames: "old -> new" — take the new name
      const renamed = file.split(' -> ');
      const f = renamed.length === 2 ? renamed[1] : file;
      out.push(f.replace(/^"|"$/g, ''));
    }
  } catch { /* git not available, return empty */ }
  if (against) {
    try {
      const diff = execSync(`git diff --name-only ${against}...HEAD`, { cwd: ROOT, encoding: 'utf-8' });
      for (const line of diff.split(/\r?\n/)) {
        if (line.trim() && !out.includes(line.trim())) out.push(line.trim());
      }
    } catch { /* ignore */ }
  }
  return [...new Set(out)];
}

function classify({ against } = {}) {
  const files = getChangedFiles({ against });
  const lanes = {
    frontend: { files: [], count: 0 },
    backend:  { files: [], count: 0 },
    framework:{ files: [], count: 0 },
    agentspec:{ files: [], count: 0 },
    docs:     { files: [], count: 0 },
    other:    { files: [], count: 0 },
  };
  const denylistMatches = [];

  for (const f of files) {
    const { lane, denylisted } = classifyFile(f);
    lanes[lane] = lanes[lane] || { files: [], count: 0 };
    lanes[lane].files.push(f);
    lanes[lane].count++;
    if (denylisted) denylistMatches.push(f);
  }

  const lanesNeeded = Object.entries(lanes)
    .filter(([k, v]) => v.count > 0 && k !== 'other')
    .map(([k]) => k);
  const verifiableLanes = lanesNeeded.filter((l) => ['frontend', 'backend', 'framework', 'agentspec'].includes(l));
  const mixed = verifiableLanes.length > 1;

  return {
    totalFiles: files.length,
    files,
    lanes,
    denylist: {
      matches: denylistMatches,
      count: denylistMatches.length,
      autoMergeAllowed: denylistMatches.length === 0,
    },
    lanesNeeded,
    verifiableLanes,
    mixed,
    summary: lanesNeeded.length === 0
      ? 'No relevant changes detected.'
      : `${verifiableLanes.length} lane(s) need verification: ${verifiableLanes.join(', ')}` +
        (denylistMatches.length > 0 ? ` (${denylistMatches.length} denylisted file(s) — auto-merge blocked)` : ''),
  };
}

// ---------------------------------------------------------------------------
// Lane verifiers
// ---------------------------------------------------------------------------

function spawnLane(lane, args, env = {}) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const cmd = lane === 'frontend' ? TEST_LOOP : BACKEND_VERIFY;
    const child = spawn(process.execPath, [cmd, ...args], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env, CLAUDE_HEADLESS: '1' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('close', (exitCode) => {
      let parsed = null;
      try { parsed = JSON.parse(stdout); } catch { /* ignore */ }
      resolve({
        lane,
        exitCode,
        durationMs: Date.now() - startedAt,
        result: parsed,
        stdout: parsed ? null : stdout.slice(-2000),
        stderr: stderr.slice(-1000),
      });
    });
    child.on('error', (err) => {
      resolve({
        lane,
        exitCode: -1,
        durationMs: Date.now() - startedAt,
        error: String(err.message || err),
      });
    });
  });
}

async function runLanes({ lanes, requireOracle, feature, quick, startServer }) {
  const todo = [];
  const skipped = {};

  if (lanes.includes('frontend')) {
    const args = ['run'];
    if (feature) args.push('--feature', feature);
    if (requireOracle) args.push('--require-oracle');
    if (startServer) args.push('--start-server');
    args.push('--note', '/iterate orchestrator run-lanes');
    todo.push(spawnLane('frontend', args));
  }

  if (lanes.includes('backend')) {
    const args = [];
    if (quick) args.push('--quick');
    args.push('--note', '/iterate orchestrator run-lanes');
    todo.push(spawnLane('backend', args));
  }

  if (lanes.includes('framework')) {
    skipped.framework = {
      reason: 'framework lane is not mechanically verified — Claude must invoke /revise-claude-md and the repo-auditor agent.',
      suggestion: 'Use the Agent tool: subagent_type="repo-auditor". Then invoke the revise-claude-md skill.',
    };
  }
  if (lanes.includes('agentspec')) {
    skipped.agentspec = {
      reason: 'agentspec lane requires the /mcs-eval skill — Claude must invoke it explicitly.',
      suggestion: 'Run the /mcs-eval skill against the modified Build-Guides/<project>/agents/<agent>/agentspec.json. Require SHIP verdict.',
    };
  }

  const results = await Promise.all(todo);

  const allGreen = results.every((r) => {
    const status = r.result?.status;
    return status === 'green' || status === 'pass';
  });
  const anyError = results.some((r) => r.exitCode === -1 || r.result?.status === 'error');
  const overallStatus = anyError ? 'error' : (allGreen ? 'green' : 'failing');

  return {
    overallStatus,
    ranAt: new Date().toISOString(),
    durationMs: Math.max(...results.map((r) => r.durationMs), 0),
    lanes: results.reduce((acc, r) => { acc[r.lane] = r; return acc; }, {}),
    skipped,
    summary: results.map((r) => `${r.lane}=${r.result?.status || 'unknown'}`).join(', '),
  };
}

// ---------------------------------------------------------------------------
// Verdict aggregation
// ---------------------------------------------------------------------------

function readJsonSafely(file) {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function verdict({ requireMergedReview = false } = {}) {
  const session = readJsonSafely(SESSION_FILE) || {};
  const frontend = readJsonSafely(FRONTEND_RESULT);
  const backend = readJsonSafely(BACKEND_RESULT);

  // Frontend uses worker wrapper {result: {...}}; backend uses both wrapper
  // and direct shapes — peel inner result if present.
  const fe = frontend?.result || frontend;
  const be = backend?.result || backend;

  const lanes = {
    frontend: fe ? {
      status: fe.status,
      ranAt: fe.ranAt || frontend?.ranAt,
      failed: fe.testResults?.failed ?? null,
      total: fe.testResults?.total ?? null,
      oracle: fe.oracle || null,
      recommendation: fe.recommendation || null,
    } : null,
    backend: be ? {
      status: be.status,
      ranAt: be.ranAt || backend?.ranAt,
      failed: be.testResults?.failed ?? null,
      total: be.testResults?.total ?? null,
      checks: be.checks ? Object.keys(be.checks).reduce((acc, k) => {
        acc[k] = be.checks[k].ok ? (be.checks[k].skipped ? 'skipped' : 'ok') : 'fail';
        return acc;
      }, {}) : null,
      recommendation: be.recommendation || null,
    } : null,
  };

  const lanesPresent = Object.values(lanes).filter(Boolean);
  const lanesGreen = lanesPresent.length > 0 && lanesPresent.every((l) => l.status === 'green' || l.status === 'pass' || l.status === 'skipped');

  const facilitator = session.facilitatorReview || null;
  const facilitatorOk = !facilitator
    ? null
    : (facilitator.score >= 9 && (facilitator.criticalFindings || []).length === 0);

  const reviewMerged = session.reviewMerged || null;
  const reviewMergedOk = !reviewMerged ? null : !!reviewMerged.readyToPublish;

  const blockers = [];
  if (!lanesGreen) blockers.push('lanes-not-green');
  if (facilitator && !facilitatorOk) {
    blockers.push(`facilitator-score-${facilitator.score || 'unknown'}`);
    if ((facilitator.criticalFindings || []).length > 0) blockers.push('facilitator-critical-findings');
  }
  if (requireMergedReview && (reviewMerged === null || !reviewMergedOk)) {
    blockers.push(reviewMerged === null ? 'review-merged-missing' : 'review-merged-not-ready');
  }

  const finalStatus = blockers.length === 0
    ? (lanesPresent.length === 0 ? 'no-changes' : 'green')
    : 'blocked';

  return {
    finalStatus,
    blockers,
    lanes,
    facilitator: facilitator ? { score: facilitator.score, criticalFindings: (facilitator.criticalFindings || []).length, ok: facilitatorOk } : null,
    reviewMerged: reviewMerged ? { readyToPublish: !!reviewMerged.readyToPublish, ok: reviewMergedOk } : null,
    sessionId: session.id || null,
    computedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Audit log (hash-chained, mirrors app/lib/eval-gate-audit.js)
// ---------------------------------------------------------------------------

function sha256(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readLastLine(file) {
  if (!fs.existsSync(file)) return null;
  const content = fs.readFileSync(file, 'utf8').trimEnd();
  if (!content) return null;
  const lines = content.split('\n');
  return lines[lines.length - 1];
}

function auditAppend({ event, data, actor }) {
  ensureDir(AUDIT_LOG);
  const prev = readLastLine(AUDIT_LOG);
  const prevHash = prev ? sha256(prev) : GENESIS_HASH;
  const entry = {
    event,
    timestamp: new Date().toISOString(),
    actor: actor || 'iterate-orchestrator',
    data: data || {},
    prevHash,
  };
  const line = JSON.stringify(entry);
  fs.appendFileSync(AUDIT_LOG, line + '\n');
  return { ...entry, entryHash: sha256(line) };
}

function auditVerify() {
  if (!fs.existsSync(AUDIT_LOG)) return { ok: true, brokenAt: null, totalEntries: 0, logPath: AUDIT_LOG };
  const lines = fs.readFileSync(AUDIT_LOG, 'utf8').trimEnd().split('\n').filter(Boolean);
  let prevHash = GENESIS_HASH;
  for (let i = 0; i < lines.length; i++) {
    let entry;
    try { entry = JSON.parse(lines[i]); }
    catch { return { ok: false, brokenAt: i, reason: 'malformed JSON', totalEntries: lines.length, logPath: AUDIT_LOG }; }
    if (entry.prevHash !== prevHash) {
      return { ok: false, brokenAt: i, reason: `prevHash mismatch (expected ${prevHash}, got ${entry.prevHash})`, totalEntries: lines.length, logPath: AUDIT_LOG };
    }
    prevHash = sha256(lines[i]);
  }
  return { ok: true, brokenAt: null, totalEntries: lines.length, logPath: AUDIT_LOG };
}

// ---------------------------------------------------------------------------
// Session marker (cross-turn resume)
// ---------------------------------------------------------------------------

function sessionCreate({ reason } = {}) {
  const id = `iter-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const sess = {
    id,
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    state: 'running',
    phase: 'classify',
    reason: reason || null,
    history: [],
  };
  ensureDir(SESSION_FILE);
  fs.writeFileSync(SESSION_FILE, JSON.stringify(sess, null, 2));
  return sess;
}

function sessionUpdate({ phase, state, reason, data }) {
  if (!fs.existsSync(SESSION_FILE)) return null;
  const sess = readJsonSafely(SESSION_FILE);
  if (!sess) return null;
  if (phase) sess.phase = phase;
  if (state) sess.state = state;
  if (reason) sess.reason = reason;
  if (data && typeof data === 'object') {
    Object.assign(sess, data);
  }
  sess.lastUpdatedAt = new Date().toISOString();
  sess.history = [...(sess.history || []), { phase: sess.phase, state: sess.state, at: sess.lastUpdatedAt, reason: reason || null }].slice(-50);
  fs.writeFileSync(SESSION_FILE, JSON.stringify(sess, null, 2));
  return sess;
}

function sessionGet() {
  return readJsonSafely(SESSION_FILE);
}

function sessionClear() {
  if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
  return { cleared: true };
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    }
  }
  return flags;
}

function emit(obj, exitCode = 0) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
  process.exit(exitCode);
}

async function main() {
  const cmd = process.argv[2];
  const flags = parseFlags(process.argv.slice(3));

  if (!cmd || cmd === '--help' || cmd === '-h') {
    process.stdout.write(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 50).map((l) => l.replace(/^\s\*\s?/, '').replace(/^\s*\*\/?/, '').replace(/^\s*\/\*\*/, '')).join('\n') + '\n');
    process.exit(0);
  }

  try {
    switch (cmd) {
      case 'classify':
        return emit(classify({ against: flags.against || null }));

      case 'run-lanes': {
        let lanes;
        if (flags.lanes && typeof flags.lanes === 'string') {
          lanes = flags.lanes.split(',').map((s) => s.trim()).filter(Boolean);
        } else {
          // Default to whatever classify needs
          const cls = classify();
          lanes = cls.verifiableLanes;
        }
        const result = await runLanes({
          lanes,
          requireOracle: !!flags['require-oracle'],
          feature: flags.feature || null,
          quick: !!flags.quick,
          startServer: !!flags['start-server'],
        });
        return emit(result, result.overallStatus === 'green' ? 0 : 1);
      }

      case 'verdict':
        return emit(verdict({ requireMergedReview: !!flags['require-merged-review'] }));

      case 'audit-append': {
        const data = flags.data ? JSON.parse(flags.data) : {};
        return emit(auditAppend({
          event: flags.event || 'unknown',
          data,
          actor: flags.actor || null,
        }));
      }

      case 'audit-verify':
        return emit(auditVerify());

      case 'session-create':
        return emit(sessionCreate({ reason: flags.reason || null }));

      case 'session-update': {
        const data = flags.data ? JSON.parse(flags.data) : null;
        const result = sessionUpdate({
          phase: flags.phase || null,
          state: flags.state || null,
          reason: flags.reason || null,
          data,
        });
        return emit(result || { error: 'no session — call session-create first' }, result ? 0 : 1);
      }

      case 'session-get':
        return emit(sessionGet() || { state: 'no-session' });

      case 'session-clear':
        return emit(sessionClear());

      case 'self-test': {
        const cls = classify();
        const ver = verdict();
        return emit({
          ok: true,
          classifyOK: typeof cls.totalFiles === 'number',
          verdictOK: typeof ver.finalStatus === 'string',
          auditLogPath: AUDIT_LOG,
          sessionFile: SESSION_FILE,
          denylistPatternCount: DENYLIST_PATTERNS.length,
          lanePatternCount: LANE_PATTERNS.length,
        });
      }

      default:
        return emit({ error: `unknown command: ${cmd}`, hint: 'see --help' }, 1);
    }
  } catch (err) {
    return emit({ error: String(err.message || err), stack: err.stack?.slice(0, 800) }, 2);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  classify,
  classifyFile,
  runLanes,
  verdict,
  auditAppend,
  auditVerify,
  sessionCreate,
  sessionUpdate,
  sessionGet,
  sessionClear,
  DENYLIST_PATTERNS,
  AUDIT_LOG,
  SESSION_FILE,
};
