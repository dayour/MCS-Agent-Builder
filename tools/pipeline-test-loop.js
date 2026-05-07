#!/usr/bin/env node
/**
 * MCS Pipeline Test Loop — Verify-Fix Runner
 *
 * Verifies every component in an agentspec against live MCS state, classifies
 * any drift against the fixed taxonomy, and auto-applies fixes for
 * classifications confirmed in the fix-map. One iteration per invocation;
 * the JSONL log accumulates state across calls.
 *
 * Smoke-phase coverage:
 *   - verifyAllTopics is the only live verifier; everything else is skipped.
 *   - Auto-fix: topic-not-rendered, lsp-zero-change, metadata-not-patched.
 *   - Build orchestration is OUT — call /mcs-build first, then this runner.
 *
 * Commands:
 *   run     [--workspace <path>] [--spec <agentspec.json>] [--note <note>] [--dry-run]
 *   status  — last N iterations + trend
 *   failures — enriched detail from latest run
 *   reset   — truncate log
 *
 * Output: structured JSON to stdout. Iteration log appended to
 * tools/pipeline-log.jsonl.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const verify = require('./verify-component');
const fixMap = require('./pipeline-fix-map');
const { SEVERITY_ORDER, getClassification, getSeverityRank } = require('./pipeline-classifications');

// --- Paths / constants ---
const ROOT = path.join(__dirname, '..');
const LOG_FILE = path.join(__dirname, 'pipeline-log.jsonl');
const MAX_ITERATIONS = 10;
const STALL_THRESHOLD = 3;

// --- Lazy executor binding ---
let lspMod = null;
function getLsp() {
    if (!lspMod) lspMod = require('./mcs-lsp');
    return lspMod;
}

// --- CLI args ---
function parseArgs() {
    const args = process.argv.slice(2);
    const command = args[0] && !args[0].startsWith('-') ? args[0] : 'run';
    const opts = { command, workspace: null, spec: null, note: '', dryRun: false };
    for (let i = command === args[0] ? 1 : 0; i < args.length; i++) {
        switch (args[i]) {
            case '--workspace': opts.workspace = args[++i]; break;
            case '--spec':      opts.spec = args[++i]; break;
            case '--note':      opts.note = args[++i] || ''; break;
            case '--dry-run':   opts.dryRun = true; break;
        }
    }
    return opts;
}

// --- Log helpers (mirror agentic-test-loop) ---
function readLog() {
    if (!fs.existsSync(LOG_FILE)) return [];
    return fs.readFileSync(LOG_FILE, 'utf-8')
        .split('\n').filter(Boolean)
        .map(line => { try { return JSON.parse(line); } catch { return null; } })
        .filter(Boolean);
}
function appendLog(entry) {
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
}
function getGitSha() {
    try { return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim(); }
    catch { return 'unknown'; }
}

// --- Trend detection ---
function computeTrend(log, currentClassifications) {
    if (log.length === 0) return 'first-run';
    const prev = log[log.length - 1];
    const prevSet = new Set(prev.classifications || []);
    const currSet = new Set(currentClassifications);
    if (currSet.size === 0) return 'green';
    if (prevSet.size === 0 && currSet.size > 0) return 'regressing';
    if (currSet.size > prevSet.size) return 'regressing';
    if (currSet.size < prevSet.size) return 'improving';
    if (currSet.size === prevSet.size) {
        const same = [...currSet].every(c => prevSet.has(c));
        if (same) {
            // count consecutive identical sets
            let stallCount = 1;
            for (let i = log.length - 1; i >= 0; i--) {
                const s = new Set(log[i].classifications || []);
                if (s.size === currSet.size && [...currSet].every(c => s.has(c))) stallCount++;
                else break;
            }
            return stallCount >= STALL_THRESHOLD ? 'stalled' : 'flat';
        }
        return 'shifting';
    }
    return 'unknown';
}

// --- Spec loading ---
function resolveSpecPath(opts) {
    if (opts.spec) return path.resolve(opts.spec);
    if (opts.workspace) {
        // Expect spec at <workspace>/../agentspec.json (workspace is typically agents/<name>/workspace/)
        const wsAbs = path.resolve(opts.workspace);
        const candidate1 = path.join(path.dirname(wsAbs), 'agentspec.json');
        if (fs.existsSync(candidate1)) return candidate1;
        const candidate2 = path.join(wsAbs, '..', 'agentspec.json');
        if (fs.existsSync(candidate2)) return candidate2;
    }
    throw new Error('Could not resolve agentspec.json path. Pass --spec explicitly.');
}

function loadSpec(specPath) {
    const raw = fs.readFileSync(specPath, 'utf-8');
    return JSON.parse(raw);
}

// --- Executor: dispatch fix actions to the right module ---
async function executeAction(action, ctx) {
    const resolved = fixMap.resolveAction(action, ctx);
    if (resolved.tool === 'mcs-lsp') {
        const lsp = getLsp();
        if (typeof lsp[resolved.fn] !== 'function') {
            throw new Error(`mcs-lsp has no exported function: ${resolved.fn}`);
        }
        return await lsp[resolved.fn](resolved.args.workspacePath);
    }
    throw new Error(`Unknown action tool: ${resolved.tool}`);
}

async function applyFix(plan, ctx, dryRun) {
    const summary = { classification: plan.classification, learningRef: plan.learningRef,
                       actions: [], dryRun: !!dryRun };
    for (const action of plan.actions) {
        const resolved = fixMap.resolveAction(action, ctx);
        if (dryRun) {
            summary.actions.push({ tool: resolved.tool, fn: resolved.fn, args: resolved.args, dryRun: true });
            continue;
        }
        try {
            const result = await executeAction(action, ctx);
            summary.actions.push({ tool: resolved.tool, fn: resolved.fn, args: resolved.args,
                                    ok: true, result: summarizeResult(result) });
        } catch (err) {
            summary.actions.push({ tool: resolved.tool, fn: resolved.fn, args: resolved.args,
                                    ok: false, error: err.message });
            summary.error = err.message;
            return summary;
        }
    }
    return summary;
}

function summarizeResult(result) {
    if (!result || typeof result !== 'object') return result;
    const keys = Object.keys(result).slice(0, 5);
    return Object.fromEntries(keys.map(k => [k, typeof result[k] === 'object' ? '...' : result[k]]));
}

// --- Severity-order picker ---
function pickHighestSeverity(results) {
    const failed = results.filter(r => r.status === 'failed' && r.classification);
    if (failed.length === 0) return null;
    failed.sort((a, b) => getSeverityRank(a.classification) - getSeverityRank(b.classification));
    return failed[0];
}

// --- Commands ---

async function cmdRun(opts) {
    if (!opts.workspace) {
        return failHard({ error: 'Provide --workspace <path-to-cloned-mcs-workspace>' });
    }
    const wsAbs = path.resolve(opts.workspace);
    if (!fs.existsSync(path.join(wsAbs, '.mcs', 'conn.json'))) {
        return failHard({ error: `No .mcs/conn.json under ${wsAbs}. Workspace not cloned via Copilot Studio extension.` });
    }
    const specPath = resolveSpecPath(opts);
    const spec = loadSpec(specPath);

    const ctx = verify.loadContext(wsAbs);
    ctx.specPath = specPath;

    const startedAt = new Date().toISOString();
    let results;
    try {
        results = await verify.verifyAll(ctx, spec);
    } catch (err) {
        return failHard({ error: `Verifier crashed: ${err.message}`, stack: err.stack?.split('\n').slice(0, 5).join('\n') });
    }

    const classifications = [...new Set(results.map(r => r.classification).filter(Boolean))];
    const log = readLog();
    const iteration = (log[log.length - 1]?.iteration || 0) + 1;
    const trend = computeTrend(log, classifications);

    // Pick top failure and plan a fix
    const top = pickHighestSeverity(results);
    let planSummary = null;
    let appliedFix = null;
    if (top) {
        const plan = fixMap.planFor(top.classification);
        planSummary = plan ? { type: plan.type, classification: plan.classification, learningRef: plan.learningRef,
                                rationale: plan.rationale, reason: plan.reason } : { type: 'unknown' };
        if (plan && plan.type === 'auto') {
            appliedFix = await applyFix(plan, ctx, opts.dryRun);
        }
    }

    const allMatch = results.every(r => r.status === 'match' || r.status === 'skipped');
    const status = allMatch ? 'green' : (trend === 'stalled' ? 'stalled' : 'failing');

    const entry = {
        iteration,
        ts: startedAt,
        finishedTs: new Date().toISOString(),
        gitSha: getGitSha(),
        workspace: wsAbs,
        specPath,
        note: opts.note,
        status,
        trend,
        classifications,
        results: results.map(stripBigEvidence),
        topFailure: top ? { classification: top.classification, id: top.id, component: top.component } : null,
        plan: planSummary,
        appliedFix,
    };

    appendLog(entry);

    const recommendation = recommend(entry);
    console.log(JSON.stringify({ ...entry, recommendation }, null, 2));
    process.exit(allMatch ? 0 : 1);
}

function stripBigEvidence(result) {
    // Trim huge evidence payloads so the JSONL log stays readable.
    if (!result.evidence) return result;
    const ev = { ...result.evidence };
    if (typeof ev.raw === 'string' && ev.raw.length > 400) ev.raw = ev.raw.slice(0, 400) + '...';
    if (typeof ev.firstLine === 'string' && ev.firstLine.length > 200) ev.firstLine = ev.firstLine.slice(0, 200) + '...';
    return { ...result, evidence: ev };
}

function recommend(entry) {
    if (entry.status === 'green') {
        return 'All verifiable components match the spec. Loop is done.';
    }
    if (entry.trend === 'stalled') {
        return `Same classifications failed ${STALL_THRESHOLD}+ iterations. Escalate; do not auto-retry.`;
    }
    if (entry.iteration >= MAX_ITERATIONS) {
        return `Hit MAX_ITERATIONS=${MAX_ITERATIONS}. Escalate.`;
    }
    if (entry.appliedFix && !entry.appliedFix.error) {
        return `Auto-fix applied for ${entry.topFailure.classification}. Re-run pipeline:run to verify.`;
    }
    if (entry.plan?.type === 'escalate') {
        return `Escalate ${entry.topFailure.classification}: ${entry.plan.reason || 'no auto-fix available'}`;
    }
    if (entry.plan?.type === 'unknown') {
        return `Unknown classification ${entry.topFailure?.classification}. Update fix-map.js.`;
    }
    return 'Failures detected. Inspect the results array.';
}

function cmdStatus() {
    const log = readLog();
    if (log.length === 0) {
        console.log(JSON.stringify({ status: 'no-history',
            message: 'No pipeline runs logged yet. Run: node tools/pipeline-test-loop.js run --workspace <path>' }, null, 2));
        return;
    }
    const latest = log[log.length - 1];
    const history = log.map(e => ({
        iteration: e.iteration, ts: e.ts, status: e.status, trend: e.trend,
        classifications: e.classifications, note: e.note,
    }));
    console.log(JSON.stringify({
        totalIterations: log.length,
        latest: {
            iteration: latest.iteration, status: latest.status, trend: latest.trend,
            topFailure: latest.topFailure, plan: latest.plan,
            appliedFix: latest.appliedFix ? { classification: latest.appliedFix.classification,
                                                 ok: !latest.appliedFix.error } : null,
        },
        history,
    }, null, 2));
}

function cmdFailures() {
    const log = readLog();
    if (log.length === 0) {
        console.log(JSON.stringify({ message: 'No pipeline runs logged.' }, null, 2));
        return;
    }
    const latest = log[log.length - 1];
    const failed = (latest.results || []).filter(r => r.status === 'failed' || r.status === 'partial');
    if (failed.length === 0) {
        console.log(JSON.stringify({ message: 'No failures in the last run.', iteration: latest.iteration }, null, 2));
        return;
    }
    const debugHints = failed.map(r => {
        const meta = r.classification ? getClassification(r.classification) : null;
        const plan = r.classification ? fixMap.planFor(r.classification) : null;
        return {
            id: r.id, component: r.component, classification: r.classification,
            severity: meta?.severity, learning: meta?.learning,
            summary: meta?.summary, evidence: r.evidence,
            fixType: plan?.type, fixHint: plan?.rationale || plan?.reason,
        };
    });
    console.log(JSON.stringify({
        iteration: latest.iteration, ts: latest.ts,
        failureCount: failed.length, failures: debugHints,
        recommendation: recommend(latest),
    }, null, 2));
}

function cmdReset() {
    if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);
    console.log(JSON.stringify({ status: 'reset', message: 'Pipeline log cleared.' }, null, 2));
}

function failHard(payload) {
    console.log(JSON.stringify({ status: 'error', ...payload }, null, 2));
    process.exit(2);
}

// --- Entrypoint ---
async function main() {
    const opts = parseArgs();
    switch (opts.command) {
        case 'run':       return cmdRun(opts);
        case 'status':    return cmdStatus();
        case 'failures':  return cmdFailures();
        case 'reset':     return cmdReset();
        default:
            console.error(`Unknown command: ${opts.command}`);
            console.error('Usage: node tools/pipeline-test-loop.js run|status|failures|reset [options]');
            process.exit(2);
    }
}

if (require.main === module) {
    main().catch(err => {
        console.error('Fatal:', err.message);
        process.exit(2);
    });
}

module.exports = { computeTrend, pickHighestSeverity, recommend };
