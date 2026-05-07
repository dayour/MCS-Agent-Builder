#!/usr/bin/env node
/**
 * backfill-published-status.js — one-shot migration for agents built before
 * the eval-as-publish-gate was introduced.
 *
 * Finds every Build-Guides/**\/agentspec.json with buildStatus.status === "published"
 * and migrates it to "published-internal" (because none of these agents went
 * through the new eval gate and none have verified eval coverage).
 *
 * Policy: NO silent grandfathering. Per GPT review 2026-04-17:
 *   "Do not blanket-migrate based only on missing eval records. Use a
 *    disposition checklist... downgrade by default, but allow explicit
 *    time-boxed exceptions with sign-off."
 * This script implements "downgrade by default." If an agent should be
 * treated as legit production without running through the new gate,
 * the owner must add an explicit evalGate.override record with
 * skipGateApprovedBy/Reason/TicketRef BEFORE running the migration —
 * those agents are then left alone.
 *
 * Usage:
 *   node tools/backfill-published-status.js                 # DRY RUN (default)
 *   node tools/backfill-published-status.js --apply          # actually write
 *   node tools/backfill-published-status.js --agent <proj>/<agent>  # single-agent
 *   node tools/backfill-published-status.js --verify         # just check, no changes
 *
 * Output: per-agent table showing before/after status + eval coverage +
 * recommended disposition. Apply mode re-reads before writing to guard
 * against concurrent mutation.
 */

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const BUILD_GUIDES = path.join(REPO_ROOT, "Build-Guides");

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const VERIFY_ONLY = args.includes("--verify");
const agentFilter = (() => {
  const idx = args.indexOf("--agent");
  return idx > -1 ? args[idx + 1] : null;
})();

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

function walkAgentSpecs(root) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "agentspec.json") out.push(p);
    }
  }
  walk(root);
  return out;
}

function countEvalCoverage(brief) {
  let total = 0, withResults = 0;
  for (const s of brief.evalSets || []) {
    for (const t of s.tests || []) {
      total++;
      if (t.lastResult) withResults++;
    }
  }
  return { total, withResults, pct: total > 0 ? Math.round((withResults / total) * 100) : 0 };
}

function projectAgentFromPath(specPath) {
  const parts = specPath.split(path.sep);
  const bgIdx = parts.lastIndexOf("Build-Guides");
  if (bgIdx === -1) return { projectId: "?", agentId: "?" };
  return {
    projectId: parts[bgIdx + 1] || "?",
    agentId: parts[bgIdx + 3] || "?",   // Build-Guides/<proj>/agents/<agent>/agentspec.json
  };
}

// ---------------------------------------------------------------------------
// Disposition logic
// ---------------------------------------------------------------------------

function classify(brief) {
  const status = brief.buildStatus?.status || "(none)";
  const evalGate = brief.evalGate;
  const cov = countEvalCoverage(brief);

  // Already migrated: skip
  if (status === "published-internal" || status === "published-uat") {
    return { action: "SKIP-MIGRATED", reason: `Already on ${status}` };
  }

  // Explicit override already present: preserve (owner has opted out of migration)
  if (evalGate && evalGate.override === true && evalGate.overrideApprovedBy) {
    return { action: "SKIP-OVERRIDE-PRESENT", reason: `Override by ${evalGate.overrideApprovedBy} (ticket ${evalGate.overrideTicketRef || "?"})` };
  }

  // On "published" with prior eval results → policy: still migrate.
  // Post-publish eval results from BEFORE the gate existed may be stale
  // or used old thresholds. Owner can re-run /mcs-eval after migration
  // to promote to published-uat properly.
  if (status === "published") {
    return {
      action: "MIGRATE",
      from: "published",
      to: "published-internal",
      reason: cov.withResults > 0
        ? `${cov.withResults}/${cov.total} tests have results (${cov.pct}%) but predate the eval gate — owner should re-run /mcs-eval to promote`
        : `${cov.total} tests defined, 0 run — agent never validated post-publish`,
    };
  }

  // Not published at all — leave alone
  return { action: "SKIP-NOT-PUBLISHED", reason: `status=${status}` };
}

function migrate(brief, disposition) {
  const now = new Date().toISOString();
  brief.buildStatus = brief.buildStatus || {};
  brief.buildStatus.status = disposition.to;
  brief.evalGate = brief.evalGate || {};
  // Preserve any existing evalGate content, add migration metadata
  brief.evalGate.migrationFrom = disposition.from;
  brief.evalGate.migrationReason = disposition.reason;
  brief.evalGate.migratedAt = now;
  brief.evalGate.verdict = brief.evalGate.verdict || "BLOCK";
  brief.evalGate.reason = brief.evalGate.reason
    || `Pre-gate migration: ${disposition.reason}. Re-run /mcs-eval to promote to published-uat.`;
  brief.evalGate.promotedTo = null;
  return brief;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const specs = walkAgentSpecs(BUILD_GUIDES);
  if (specs.length === 0) {
    console.log(`No agentspec.json files found under ${BUILD_GUIDES}`);
    return 0;
  }

  console.log(`\n[backfill] Scan: ${specs.length} agentspec files`);
  console.log(`[backfill] Mode: ${APPLY ? "APPLY (will write)" : VERIFY_ONLY ? "VERIFY-ONLY" : "DRY-RUN (no writes)"}`);
  if (agentFilter) console.log(`[backfill] Filter: ${agentFilter}`);
  console.log("");

  const rows = [];
  for (const spec of specs) {
    const { projectId, agentId } = projectAgentFromPath(spec);
    const targetKey = `${projectId}/${agentId}`;
    if (agentFilter && targetKey !== agentFilter) continue;

    let brief;
    try { brief = JSON.parse(fs.readFileSync(spec, "utf8")); }
    catch (e) { rows.push({ projectId, agentId, error: `parse: ${e.message}` }); continue; }

    const before = brief.buildStatus?.status || "(none)";
    const cov = countEvalCoverage(brief);
    const disposition = classify(brief);

    rows.push({
      projectId, agentId, spec,
      before, cov, disposition, brief,
    });
  }

  // Print table
  console.log("project".padEnd(20), "agent".padEnd(30), "before".padEnd(22), "eval cov".padEnd(12), "action".padEnd(24), "reason");
  console.log("-".repeat(180));
  for (const r of rows) {
    if (r.error) {
      console.log(r.projectId.padEnd(20), r.agentId.padEnd(30), "ERROR".padEnd(22), "".padEnd(12), "SKIP".padEnd(24), r.error);
      continue;
    }
    const cov = `${r.cov.withResults}/${r.cov.total} (${r.cov.pct}%)`;
    console.log(
      r.projectId.padEnd(20),
      r.agentId.padEnd(30),
      r.before.padEnd(22),
      cov.padEnd(12),
      r.disposition.action.padEnd(24),
      r.disposition.reason.slice(0, 80),
    );
  }
  console.log("");

  const migrations = rows.filter((r) => !r.error && r.disposition.action === "MIGRATE");
  console.log(`[backfill] ${migrations.length} agent(s) would be migrated to published-internal.`);
  const skipMigrated = rows.filter((r) => r.disposition?.action === "SKIP-MIGRATED").length;
  const skipOverride = rows.filter((r) => r.disposition?.action === "SKIP-OVERRIDE-PRESENT").length;
  const skipOther = rows.filter((r) => r.disposition?.action === "SKIP-NOT-PUBLISHED").length;
  console.log(`[backfill] Skipped: ${skipMigrated} already-migrated, ${skipOverride} with existing override, ${skipOther} not published.`);

  if (VERIFY_ONLY) return migrations.length > 0 ? 1 : 0;

  if (!APPLY) {
    console.log("\n[backfill] DRY RUN — re-run with --apply to write the changes. Single agent: --agent <projectId>/<agentId>");
    return 0;
  }

  console.log("\n[backfill] APPLYING migrations...\n");
  let applied = 0, failed = 0;
  for (const r of migrations) {
    try {
      // Re-read from disk to guard against concurrent writes between scan + apply
      const fresh = JSON.parse(fs.readFileSync(r.spec, "utf8"));
      const freshStatus = fresh.buildStatus?.status;
      if (freshStatus !== "published") {
        console.log(`  SKIP ${r.projectId}/${r.agentId}: status changed to '${freshStatus}' since scan`);
        continue;
      }
      const migrated = migrate(fresh, r.disposition);
      migrated.updated_at = new Date().toISOString();
      fs.writeFileSync(r.spec, JSON.stringify(migrated, null, 2));
      console.log(`  OK   ${r.projectId}/${r.agentId}: published → published-internal`);
      applied++;
    } catch (e) {
      console.log(`  FAIL ${r.projectId}/${r.agentId}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n[backfill] Applied: ${applied}, Failed: ${failed}`);
  return failed > 0 ? 1 : 0;
}

process.exit(main());
