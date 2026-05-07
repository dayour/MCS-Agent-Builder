/**
 * computeVerdict tests — pure / no network.
 *
 * Locks in the eval-gate contract:
 *   - empty test set → BLOCK (no UAT promotion without evals)
 *   - safety <threshold → BLOCK regardless of overall rate
 *   - too few tests in a category → BLOCK/ITERATE (statistical floor)
 *   - quality below threshold but safety ok → ITERATE
 *   - all thresholds met → SHIP
 *   - riskTier presets resolve correctly
 *   - explicit thresholds override riskTier
 *
 * Run: node --test app/lib/__tests__/eval-pipeline-verdict.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { computeVerdict, DEFAULT_THRESHOLDS, RISK_TIER_PRESETS } = require("../eval-pipeline");

const set = (name, passed, total) => ({
  name, passed, total, rate: total > 0 ? Math.round((passed / total) * 100) : 0,
});

test("empty results → BLOCK with 'no eval tests' reason", () => {
  const v = computeVerdict([]);
  assert.equal(v.verdict, "BLOCK");
  assert.match(v.reason, /No eval tests defined/i);
});

test("safety category below threshold → BLOCK regardless of overall", () => {
  const v = computeVerdict([
    set("safety", 5, 10),     // 50%
    set("quality", 10, 10),   // 100%
  ]);
  assert.equal(v.verdict, "BLOCK");
  assert.match(v.reason, /Safety/i);
});

test("safety category with too few tests → BLOCK on statistical floor", () => {
  const v = computeVerdict([
    set("safety", 1, 1),      // 100% but only 1 test
    set("quality", 10, 10),
  ]);
  assert.equal(v.verdict, "BLOCK");
  assert.match(v.reason, /Safety category has 1 tests/);
});

test("quality category below threshold but safety/overall ok → ITERATE", () => {
  const v = computeVerdict([
    set("safety", 5, 5),      // 100%
    set("quality", 3, 10),    // 30% (below default 60)
    set("edge-cases", 5, 5),  // 100%
  ]);
  assert.equal(v.verdict, "ITERATE");
  assert.match(v.reason, /Quality\/core/i);
});

test("all thresholds met → SHIP", () => {
  const v = computeVerdict([
    set("safety", 5, 5),
    set("quality", 4, 5),
    set("edge-cases", 3, 5),
  ]);
  assert.equal(v.verdict, "SHIP");
});

test("aliases: 'boundaries' is treated as 'safety', 'core' as 'quality'", () => {
  const v = computeVerdict([
    set("boundaries", 5, 10), // alias for safety
    set("core", 3, 5),
  ]);
  assert.equal(v.verdict, "BLOCK");
  assert.match(v.reason, /Safety\/boundaries/);
});

test("riskTier 'demo' uses lenient thresholds", () => {
  const v = computeVerdict(
    [set("safety", 4, 5), set("quality", 3, 5)],   // 80% / 60%
    { riskTier: "demo" }
  );
  assert.equal(v.verdict, "SHIP", "demo tier accepts 80% safety");
});

test("riskTier 'production' uses strict thresholds", () => {
  const v = computeVerdict(
    [set("safety", 9, 10), set("quality", 8, 10)],  // 90% / 80%
    { riskTier: "production" }
  );
  assert.equal(v.verdict, "BLOCK", "production tier requires 95% safety");
});

test("explicit thresholds override riskTier preset", () => {
  const v = computeVerdict(
    [set("safety", 8, 10), set("quality", 6, 10)],
    { riskTier: "production", thresholds: { safety: 70, quality: 50, overall: 50, minPerCategory: 1 } }
  );
  assert.equal(v.verdict, "SHIP");
});

test("RISK_TIER_PRESETS exposes the three tiers", () => {
  assert.deepEqual(Object.keys(RISK_TIER_PRESETS), ["demo", "internal", "production"]);
  assert.ok(RISK_TIER_PRESETS.production.safety > RISK_TIER_PRESETS.demo.safety);
});

test("DEFAULT_THRESHOLDS matches 'internal' tier presets (the safe default)", () => {
  // internal preset is intentionally identical to defaults — keep them in sync
  assert.deepEqual(DEFAULT_THRESHOLDS, RISK_TIER_PRESETS.internal);
});
