/**
 * cli-session-budget.js — Shared CLI subprocess concurrency cap across
 * analyze-pipeline + hybrid-orchestrator.
 *
 * Both modules used to read `MCS_ANALYZE_MAX_CONCURRENCY` independently
 * and each maintained its own counter. Effective ceiling was 2× the
 * intended cap (e.g. 2 analyze + 2 hybrid simultaneously when cap was 2).
 * That contradicted the stated invariant in the orchestrator's docstring.
 *
 * This module owns ONE counter for both. Each pipeline registers its
 * `_jobs` Map's running-job count; the cap check sums across all
 * registered counters before allowing a new spawn.
 *
 * Caller flow:
 *   const budget = require('./cli-session-budget');
 *   budget.registerSource('analyze', () => runningJobCount());
 *   if (budget.atCapacity()) throw capacityError();
 */

const MAX_CONCURRENT_JOBS = (() => {
  const raw = parseInt(process.env.MCS_ANALYZE_MAX_CONCURRENCY || '', 10);
  return Number.isFinite(raw) && raw > 0 && raw <= 16 ? raw : 2;
})();

const _sources = new Map();

/** Register a function that returns this source's current running-job count. */
function registerSource(sourceId, getCount) {
  _sources.set(sourceId, getCount);
}

/** Sum all sources' running counts. */
function totalRunning() {
  let n = 0;
  for (const get of _sources.values()) {
    try { n += get() || 0; } catch { /* */ }
  }
  return n;
}

/** True if total running >= configured cap. */
function atCapacity() {
  return totalRunning() >= MAX_CONCURRENT_JOBS;
}

function getMaxConcurrency() {
  return MAX_CONCURRENT_JOBS;
}

/** Build the typed capacity error both pipelines throw. */
function capacityError() {
  const total = totalRunning();
  const err = new Error(
    `Server is at CLI session capacity (${total}/${MAX_CONCURRENT_JOBS} running across analyze + hybrid). ` +
    `Wait for one to finish or cancel an existing job before starting another.`
  );
  err.code = 'cli_capacity_exceeded';
  return err;
}

module.exports = {
  registerSource,
  totalRunning,
  atCapacity,
  capacityError,
  getMaxConcurrency,
};
