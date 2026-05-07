#!/usr/bin/env node
/**
 * live-smoke-eval-gate.js — end-to-end live verification of the eval gate.
 *
 * Unlike the fixture-based integration tests (which mock the eval-pipeline
 * and exercise stepEvalGate in isolation), this script runs the REAL pipeline
 * against an already-published MCS agent and observes the state transition.
 *
 * This cannot be auto-invoked by CI — it requires an active az login, a real
 * environment with a real agent, and deliberate non-prod confirmation. It is
 * the "actual end-to-end validation" the runbook references.
 *
 * Usage:
 *   # 1. Preview (no execution, just print what would run)
 *   node tools/live-smoke-eval-gate.js --project E2E-Test --agent it-ops-assistant
 *
 *   # 2. Execute (requires all preflight checks to pass + explicit --confirm)
 *   node tools/live-smoke-eval-gate.js --project E2E-Test --agent it-ops-assistant --confirm
 *
 *   # 3. Just the preflights (useful for CI readiness checks)
 *   node tools/live-smoke-eval-gate.js --preflight-only
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const REPO_ROOT = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
function argVal(name) { const i = args.indexOf(name); return i > -1 ? args[i + 1] : null; }
const CONFIRM = args.includes("--confirm");
const PREFLIGHT_ONLY = args.includes("--preflight-only");
const ALLOW_PROD = args.includes("--allow-prod");
// --via-gate: invoke full build-pipeline stepEvalGate (exercises promotion +
// audit log write) rather than just runEvalForBuild. Proves SHIP→uat live.
const VIA_GATE = args.includes("--via-gate");
const PROJECT = argVal("--project");
const AGENT = argVal("--agent");

// ---------------------------------------------------------------------------
// Log helpers
// ---------------------------------------------------------------------------

const EVIDENCE = { startedAt: new Date().toISOString(), steps: [], preflight: {}, result: null };
function step(name, ok, detail) {
  const icon = ok ? "PASS" : "FAIL";
  console.log(`  [${icon}] ${name}${detail ? ` — ${detail}` : ""}`);
  EVIDENCE.steps.push({ name, ok, detail: detail || null, at: new Date().toISOString() });
  return ok;
}
function fail(msg) { console.error(`\n[live-smoke] FAILED: ${msg}\n`); EVIDENCE.result = { ok: false, reason: msg }; writeEvidence(); process.exit(1); }
function writeEvidence() {
  const dir = path.join(REPO_ROOT, "tools", "live-smoke-evidence");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `smoke-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(EVIDENCE, null, 2));
  console.log(`\n[live-smoke] Evidence: ${file}`);
}

// ---------------------------------------------------------------------------
// Preflight checks (per GPT 2026-04-17: identity + tenant + env + non-prod)
// ---------------------------------------------------------------------------

function preflight() {
  console.log("\n[live-smoke] Preflight checks:");

  // 1. az CLI present
  let azVersion = "";
  try { azVersion = execSync("az --version", { encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] }); }
  catch { return step("az CLI installed", false, "az not found on PATH"); }
  step("az CLI installed", true);

  // 2. az login active — print identity
  let identity;
  try {
    identity = JSON.parse(execSync("az account show --output json", { encoding: "utf8", timeout: 10000 }));
    EVIDENCE.preflight.identity = {
      user: identity.user?.name,
      tenantId: identity.tenantId,
      subscriptionId: identity.id,
      subscriptionName: identity.name,
    };
  } catch { return step("az login active", false, "run `az login` first"); }
  step("az login active", true, `${identity.user?.name} on ${identity.name} (tenant ${identity.tenantId?.slice(0, 8)}...)`);

  // 3. Project + agent args present
  if (!PROJECT || !AGENT) return step("project + agent args", false, "need --project <name> --agent <name>");
  step("project + agent args", true, `${PROJECT}/${AGENT}`);

  // 4. Agent spec exists
  const specPath = path.join(REPO_ROOT, "Build-Guides", PROJECT, "agents", AGENT, "agentspec.json");
  if (!fs.existsSync(specPath)) return step("agentspec.json exists", false, specPath);
  let brief;
  try { brief = JSON.parse(fs.readFileSync(specPath, "utf8")); }
  catch (e) { return step("agentspec.json parseable", false, e.message); }
  step("agentspec.json parseable", true);

  // 5. Agent is in a state where eval gate can run
  const status = brief.buildStatus?.status;
  if (status !== "published-internal" && status !== "published-uat" && status !== "published") {
    return step("agent is published", false, `status=${status} — eval gate needs a live MCS agent`);
  }
  step("agent is published", true, `status=${status}`);

  // 6. Required buildStatus fields — accept either canonical `mcsAgentId`
  // or legacy `botId` (older build paths store it under that key)
  const bs = brief.buildStatus || {};
  const botId = bs.mcsAgentId || bs.botId;
  const envId = bs.environmentId || bs.envId || bs.mcsEnvironmentId;
  const dvUrl = bs.dataverseUrl || bs.orgUrl;
  const missing = [];
  if (!botId) missing.push("mcsAgentId (or botId)");
  if (!dvUrl) missing.push("dataverseUrl");
  if (!envId) missing.push("environmentId");
  if (missing.length > 0) return step("buildStatus has required fields", false, `missing: ${missing.join(", ")}`);
  step("buildStatus has required fields", true);

  EVIDENCE.preflight.target = {
    project: PROJECT, agent: AGENT,
    botId, environmentId: envId, dataverseUrl: dvUrl, currentStatus: status,
  };

  // 7. Non-prod guard — reject if dataverseUrl looks like a prod tenant
  const dv = (bs.dataverseUrl || bs.orgUrl || "").toLowerCase();
  if (!ALLOW_PROD && (dv.includes(".prod.") || /crm\d*\.dynamics\.com/.test(dv) === false)) {
    // lenient: we only flag confidently-prod-looking URLs; allow dev orgs like orgXXX.crm.dynamics.com
  }
  // Hard block if tenant matches explicit prod pattern
  const PROD_PATTERNS = [/\.prod\./i, /prodcopilot/i, /contoso-prod/i];
  if (!ALLOW_PROD && PROD_PATTERNS.some((p) => p.test(dv) || p.test(identity.name || ""))) {
    return step("non-prod target", false, `tenant/env looks like prod: ${dv} / ${identity.name}. Pass --allow-prod to override.`);
  }
  step("non-prod target", true, `allowing dataverseUrl ${dv.slice(0, 60)}`);

  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n[live-smoke] Eval-gate end-to-end verification — ${new Date().toISOString()}`);
  console.log(`[live-smoke] Mode: ${PREFLIGHT_ONLY ? "preflight-only" : CONFIRM ? "LIVE EXECUTE" : "PREVIEW (no execution)"}`);

  if (!preflight()) fail("preflight checks did not pass");

  if (PREFLIGHT_ONLY) {
    console.log("\n[live-smoke] Preflight OK. No execution attempted (preflight-only mode).");
    EVIDENCE.result = { ok: true, mode: "preflight-only" };
    writeEvidence();
    return 0;
  }

  if (!CONFIRM) {
    console.log("\n[live-smoke] PREVIEW only. Re-run with --confirm to actually execute eval-pipeline against the target.");
    console.log(`           Target: ${PROJECT}/${AGENT} on ${EVIDENCE.preflight.target.dataverseUrl}`);
    console.log(`           Bot ID: ${EVIDENCE.preflight.target.botId}`);
    console.log("           The eval pipeline will send test messages via Direct Line and record results.");
    console.log("           No mutations are made to the agent design; only evalSets[].tests[].lastResult + evalGate are written.");
    EVIDENCE.result = { ok: true, mode: "preview" };
    writeEvidence();
    return 0;
  }

  // EXECUTE — run eval-pipeline programmatically
  const mode = VIA_GATE ? "via-gate (full stepEvalGate + promotion)" : "direct (runEvalForBuild only)";
  console.log(`\n[live-smoke] Executing eval pipeline — mode: ${mode}`);
  const agentDir = path.join(REPO_ROOT, "Build-Guides", PROJECT, "agents", AGENT);
  const before = JSON.parse(fs.readFileSync(path.join(agentDir, "agentspec.json"), "utf8"));
  EVIDENCE.stateBefore = {
    status: before.buildStatus?.status,
    evalGate: before.evalGate || null,
    testsWithResults: (before.evalSets || []).reduce((s, e) => s + (e.tests || []).filter((t) => t.lastResult).length, 0),
  };

  const start = Date.now();
  try {
    let verdict, reason, overallRate, promotedTo;

    if (VIA_GATE) {
      // Full stepEvalGate — exercises promotion, audit log, override validation
      const buildPipeline = require("../app/lib/build-pipeline");
      if (!buildPipeline._testables?.stepEvalGate) {
        throw new Error("build-pipeline does not expose _testables.stepEvalGate");
      }
      const fakeJob = {
        id: `smoke-${Date.now()}`,
        projectId: PROJECT,
        agentId: AGENT,
        steps: [{ id: "eval-gate", label: "Eval gate", status: "pending" }],
        errors: [],
        rawLog: "",
        listeners: [],
        status: "running",
      };
      await buildPipeline._testables.stepEvalGate(fakeJob, before, agentDir);
      const after = JSON.parse(fs.readFileSync(path.join(agentDir, "agentspec.json"), "utf8"));
      verdict = after.evalGate?.verdict || "NONE";
      reason = after.evalGate?.reason || "(no reason)";
      overallRate = after.evalGate?.overallRate;
      promotedTo = after.evalGate?.promotedTo || null;
      step(`stepEvalGate completed`, true, `verdict=${verdict} promotedTo=${promotedTo}`);
      EVIDENCE.viaGate = {
        verdict,
        reason,
        overallRate,
        promotedTo,
        statusAfter: after.buildStatus?.status,
        override: after.evalGate?.override || false,
      };
    } else {
      // Direct eval-pipeline — no promotion, just verdict
      const evalPipeline = require("../app/lib/eval-pipeline");
      const result = await evalPipeline.runEvalForBuild(PROJECT, AGENT, REPO_ROOT, {
        riskTier: before.evalConfig?.riskTier,
        thresholds: before.evalConfig?.thresholds,
      });
      verdict = result.verdict?.verdict || "NONE";
      reason = result.verdict?.reason || result.error;
      overallRate = result.verdict?.overallRate;
      EVIDENCE.evalJobId = result.jobId;
      step(`eval-pipeline completed`, true, `verdict=${verdict}`);
    }

    const duration = ((Date.now() - start) / 1000).toFixed(1);
    const after = JSON.parse(fs.readFileSync(path.join(agentDir, "agentspec.json"), "utf8"));
    EVIDENCE.stateAfter = {
      status: after.buildStatus?.status,
      evalGate: after.evalGate || null,
      evalConfig: after.evalConfig ? { lastVerdict: after.evalConfig.lastVerdict, lastVerdictAt: after.evalConfig.lastVerdictAt } : null,
      testsWithResults: (after.evalSets || []).reduce((s, e) => s + (e.tests || []).filter((t) => t.lastResult).length, 0),
    };
    step(`status after = ${after.buildStatus?.status}`, true);

    EVIDENCE.result = {
      ok: true,
      mode: VIA_GATE ? "via-gate" : "direct",
      verdict, reason, overallRate, promotedTo,
      duration: `${duration}s`,
    };
    console.log(`\n[live-smoke] Final verdict: ${verdict} — ${reason}`);
    if (VIA_GATE) {
      console.log(`[live-smoke] Status transition: ${before.buildStatus?.status} → ${after.buildStatus?.status}${promotedTo ? " (promoted)" : " (stayed)"}`);
    }
  } catch (err) {
    step("eval path completed", false, err.message);
    EVIDENCE.result = { ok: false, mode: VIA_GATE ? "via-gate" : "direct", error: err.message };
  }

  writeEvidence();
  return EVIDENCE.result.ok ? 0 : 1;
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error("[live-smoke] Crash:", err);
  EVIDENCE.result = { ok: false, error: err.message };
  writeEvidence();
  process.exit(2);
});
