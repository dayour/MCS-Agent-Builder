#!/usr/bin/env node
/**
 * batch-smoke-eval-gate.js — run live-smoke-eval-gate against multiple agents
 * sequentially, collecting a structured summary.
 *
 * Default target list: all 7 backfilled `published-internal` agents.
 * Results written to knowledge/learnings/eval-gate-baseline-<timestamp>.json.
 *
 * Usage:
 *   node tools/batch-smoke-eval-gate.js                           # default list, via-gate mode
 *   node tools/batch-smoke-eval-gate.js --agents P1/A1,P2/A2      # specific list
 *   node tools/batch-smoke-eval-gate.js --direct                  # runEvalForBuild only (no promotion)
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const REPO_ROOT = path.resolve(__dirname, "..");

const DEFAULT_TARGETS = [
  "CDW/account-prospecting",
  "CDW/legal-hr-policy-advisor",
  "E2E-Benefits-Buddy/Benefits-Buddy",
  "MNP/assurance-memo-drafting",
  "MNP/time-entry",
];

const args = process.argv.slice(2);
function argVal(n) { const i = args.indexOf(n); return i > -1 ? args[i + 1] : null; }
const explicit = argVal("--agents");
const targets = explicit ? explicit.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_TARGETS;
const mode = args.includes("--direct") ? "direct" : "via-gate";

function runOne(targetKey) {
  const [project, agent] = targetKey.split("/");
  if (!project || !agent) return { targetKey, error: "bad format" };
  const smokeArgs = [
    "tools/live-smoke-eval-gate.js",
    "--project", project,
    "--agent", agent,
    "--confirm",
  ];
  if (mode === "via-gate") smokeArgs.push("--via-gate");

  const start = Date.now();
  const result = spawnSync(process.execPath, smokeArgs, {
    encoding: "utf8", cwd: REPO_ROOT, timeout: 600000,
  });
  const duration = ((Date.now() - start) / 1000).toFixed(1);
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  const combined = stdout + stderr;

  // Parse verdict line
  const verdictMatch = combined.match(/Final verdict:\s*([A-Z ]+?)\s*—\s*(.*?)(\r?\n|$)/);
  const statusMatch = combined.match(/Status transition:\s*(\S+)\s*→\s*(\S+)\s*\((\S+?)\)/);
  const evalResultsMatch = combined.match(/Eval results:\s*(.*?)—\s*Verdict/);

  return {
    targetKey,
    exitCode: result.status,
    duration: `${duration}s`,
    verdict: verdictMatch ? verdictMatch[1].trim() : null,
    reason: verdictMatch ? verdictMatch[2].trim() : null,
    statusFrom: statusMatch ? statusMatch[1] : null,
    statusTo: statusMatch ? statusMatch[2] : null,
    transition: statusMatch ? statusMatch[3] : null,
    perSet: evalResultsMatch ? evalResultsMatch[1].trim() : null,
    ok: result.status === 0,
  };
}

function main() {
  console.log(`[batch-smoke] Running ${targets.length} smoke tests in mode=${mode}`);
  console.log(`[batch-smoke] Targets: ${targets.join(", ")}\n`);

  const startAll = Date.now();
  const results = [];
  for (const t of targets) {
    process.stdout.write(`  ${t.padEnd(40)} ... `);
    const r = runOne(t);
    results.push(r);
    const verdictStr = r.verdict || "(no verdict)";
    const txStr = r.statusFrom && r.statusTo ? `  ${r.statusFrom}→${r.statusTo}` : "";
    process.stdout.write(`${verdictStr.padEnd(20)}${txStr}  [${r.duration}]\n`);
  }
  const totalDuration = ((Date.now() - startAll) / 1000).toFixed(1);

  // Summary
  console.log(`\n[batch-smoke] Completed ${results.length} runs in ${totalDuration}s`);
  const byVerdict = {};
  results.forEach((r) => { const v = r.verdict || "ERROR"; byVerdict[v] = (byVerdict[v] || 0) + 1; });
  console.log(`[batch-smoke] Verdict distribution: ${Object.entries(byVerdict).map(([v, n]) => `${v}=${n}`).join(", ")}`);

  const ok = results.filter((r) => r.ok).length;
  console.log(`[batch-smoke] Pipeline completed cleanly: ${ok}/${results.length}`);

  // Write baseline JSON
  const outDir = path.join(REPO_ROOT, "knowledge", "learnings");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `eval-gate-baseline-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify({
    runAt: new Date().toISOString(),
    mode,
    targets,
    totalDuration: `${totalDuration}s`,
    verdictDistribution: byVerdict,
    pipelineCleanRate: `${ok}/${results.length}`,
    results,
  }, null, 2));
  console.log(`[batch-smoke] Baseline: ${outFile}`);
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

main();
