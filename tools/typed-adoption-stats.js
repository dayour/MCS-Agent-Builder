#!/usr/bin/env node
/**
 * Typed-vs-legacy write path observability for the Phase 3 build-pipeline flip.
 *
 * Each build-pipeline run of stepComponents calls recordBuildStats() when the
 * evals block runs, appending one JSONL record to tools/typed-adoption-stats.jsonl
 * with per-run path counts and fallback reasons.
 *
 * Usage as a CLI to summarize:
 *   node tools/typed-adoption-stats.js
 *   node tools/typed-adoption-stats.js --last 50      # tail N records
 *   node tools/typed-adoption-stats.js --since 7d     # records newer than 7 days
 *   node tools/typed-adoption-stats.js --json         # dump raw records
 *
 * Exit codes:
 *   0  normal
 *   2  file missing (no builds have run yet)
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const STATS_FILE = path.join(REPO_ROOT, 'tools', 'typed-adoption-stats.jsonl');

function gitSha() {
    try {
        return execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch { return null; }
}

/**
 * Hash IDs so the stats file is safe to share without leaking tenant/bot GUIDs.
 * Stable per-ID (same input -> same output within a commit) so we can trend usage
 * across a specific env/bot over time without the raw identifier.
 */
function hashId(id) {
    if (!id) return null;
    return 'h_' + crypto.createHash('sha256').update(String(id)).digest('hex').slice(0, 12);
}

/**
 * Append one JSONL record. Called from app/lib/build-pipeline.js when the
 * eval-sets block finishes.
 *
 * @param {object} stats
 * @param {string} [stats.envId]      - will be hashed before persisting
 * @param {string} [stats.botId]      - will be hashed before persisting
 * @param {number} stats.typed_sets
 * @param {number} stats.legacy_sets
 * @param {number} stats.typed_tests
 * @param {number} stats.legacy_tests
 * @param {string[]} [stats.fallback_reasons]  - per-failure message extracts (pre-redacted)
 * @param {string} [stats.build_run_id] - pipeline-assigned id; defaults to timestamp+sha
 */
function recordBuildStats(stats) {
    try {
        const sha = gitSha();
        const tsMs = Date.now();
        const record = {
            ts: new Date(tsMs).toISOString(),
            build_run_id: stats.build_run_id || `${tsMs.toString(36)}_${(sha || 'unknown').slice(0, 7)}`,
            commit_sha: sha,
            env_hash: hashId(stats.envId),
            bot_hash: hashId(stats.botId),
            typed_sets: stats.typed_sets | 0,
            legacy_sets: stats.legacy_sets | 0,
            typed_tests: stats.typed_tests | 0,
            legacy_tests: stats.legacy_tests | 0,
            fallback_reasons: (stats.fallback_reasons || []).slice(0, 10).map((s) => String(s).slice(0, 200)),
        };
        fs.appendFileSync(STATS_FILE, JSON.stringify(record) + '\n');
    } catch {
        // Best-effort. Never fail a build because stats couldn't be written.
    }
}

function readRecords() {
    if (!fs.existsSync(STATS_FILE)) return [];
    const text = fs.readFileSync(STATS_FILE, 'utf8');
    const records = [];
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try { records.push(JSON.parse(trimmed)); } catch { /* skip malformed line */ }
    }
    return records;
}

function parseDurationFlag(arg) {
    const m = /^(\d+)([hdw])$/.exec(arg);
    if (!m) return null;
    const n = Number(m[1]);
    const unit = m[2];
    const ms = unit === 'h' ? 3600e3 : unit === 'd' ? 86400e3 : 7 * 86400e3;
    return n * ms;
}

function summarize(records) {
    // Dedup by build_run_id so retried builds don't inflate totals.
    const byRunId = new Map();
    for (const r of records) byRunId.set(r.build_run_id, r);
    const unique = [...byRunId.values()];

    if (unique.length === 0) {
        console.log('typed-adoption-stats: no unique build records yet.');
        return;
    }

    const typed_sets = unique.reduce((s, r) => s + r.typed_sets, 0);
    const legacy_sets = unique.reduce((s, r) => s + r.legacy_sets, 0);
    const typed_tests = unique.reduce((s, r) => s + r.typed_tests, 0);
    const legacy_tests = unique.reduce((s, r) => s + r.legacy_tests, 0);
    const total_sets = typed_sets + legacy_sets;
    const total_tests = typed_tests + legacy_tests;

    const all_typed_runs = unique.filter((r) => r.legacy_sets === 0 && r.legacy_tests === 0).length;
    const any_fallback_runs = unique.length - all_typed_runs;

    const byEnv = {};
    for (const r of unique) {
        const k = r.env_hash || 'unknown';
        if (!byEnv[k]) byEnv[k] = { runs: 0, typed_sets: 0, legacy_sets: 0 };
        byEnv[k].runs++;
        byEnv[k].typed_sets += r.typed_sets;
        byEnv[k].legacy_sets += r.legacy_sets;
    }
    const envCount = Object.keys(byEnv).length;

    const pct = (n, d) => (d === 0 ? 'n/a' : (100 * n / d).toFixed(1) + '%');

    console.log(`typed-adoption-stats: ${unique.length} unique builds across ${envCount} environments\n`);
    console.log('Counts');
    console.log(`  sets  — typed: ${typed_sets}  legacy: ${legacy_sets}  (typed share: ${pct(typed_sets, total_sets)})`);
    console.log(`  tests — typed: ${typed_tests}  legacy: ${legacy_tests}  (typed share: ${pct(typed_tests, total_tests)})`);
    console.log();
    console.log('Runs');
    console.log(`  all-typed:       ${all_typed_runs}  (${pct(all_typed_runs, unique.length)})`);
    console.log(`  any fallback:    ${any_fallback_runs}`);
    console.log();
    if (any_fallback_runs > 0) {
        const reasons = {};
        for (const r of unique) for (const msg of r.fallback_reasons || []) reasons[msg] = (reasons[msg] || 0) + 1;
        const topReasons = Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (topReasons.length > 0) {
            console.log('Top fallback reasons');
            for (const [msg, n] of topReasons) console.log(`  ${n}x ${msg.slice(0, 80)}`);
            console.log();
        }
    }

    const lastRun = unique[unique.length - 1];
    console.log(`Most recent build: ${lastRun.ts} (${lastRun.commit_sha?.slice(0, 7) || 'no-sha'})`);
}

function main() {
    const args = process.argv.slice(2);
    if (!fs.existsSync(STATS_FILE)) {
        console.log(`typed-adoption-stats: no records at ${STATS_FILE}`);
        console.log('(a /mcs-build run will create it)');
        process.exit(2);
    }

    let records = readRecords();
    if (records.length === 0) {
        console.log('typed-adoption-stats: file exists but no parseable records.');
        process.exit(2);
    }

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--last' && args[i + 1]) {
            const n = Number(args[++i]);
            if (n > 0) records = records.slice(-n);
        } else if (args[i] === '--since' && args[i + 1]) {
            const ms = parseDurationFlag(args[++i]);
            if (ms != null) {
                const cutoff = Date.now() - ms;
                records = records.filter((r) => new Date(r.ts).getTime() >= cutoff);
            }
        } else if (args[i] === '--json') {
            console.log(JSON.stringify(records, null, 2));
            return;
        } else if (args[i] === '--help') {
            console.log('Usage: node tools/typed-adoption-stats.js [--last N] [--since Nd|Nw|Nh] [--json]');
            return;
        }
    }

    summarize(records);
}

if (require.main === module) main();

module.exports = {
    recordBuildStats,
    // Exported for tests
    _internal: { hashId, readRecords, summarize, STATS_FILE },
};
