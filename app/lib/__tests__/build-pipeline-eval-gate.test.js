/**
 * build-pipeline stepEvalGate integration test (fixture-based).
 *
 * NOT an end-to-end live smoke test — see NOT-COVERED note at bottom.
 * Mocks the eval-pipeline runner and exercises stepEvalGate decision logic
 * directly against in-memory brief fixtures + a tmp agent directory.
 *
 * Run: node --test app/lib/__tests__/build-pipeline-eval-gate.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ---------------------------------------------------------------------------
// Test harness — inject a mock eval-pipeline before loading build-pipeline
// ---------------------------------------------------------------------------

const Module = require("module");
const origResolve = Module._resolve_filename || Module._resolveFilename;

let _mockEvalResult = null;
function setMockEvalResult(r) { _mockEvalResult = r; }

// Intercept require("./eval-pipeline") inside build-pipeline
const origLoad = Module._load;
Module._load = function patched(request, parent, isMain) {
  if (request === "./eval-pipeline" && parent && parent.filename && parent.filename.endsWith("build-pipeline.js")) {
    return {
      runEvalForBuild: async () => _mockEvalResult || { verdict: null, jobId: null, error: "no mock set" },
    };
  }
  return origLoad.apply(this, arguments);
};

// Redirect audit log to a tmp file for the entire test run so we don't
// pollute knowledge/learnings/eval-gate-overrides.jsonl (the real chain).
const TMP_AUDIT_LOG = path.join(os.tmpdir(), `eval-gate-audit-test-${Date.now()}.jsonl`);
process.env.EVAL_GATE_AUDIT_LOG = TMP_AUDIT_LOG;

// Load build-pipeline after mock install
const buildPipeline = require("../build-pipeline");
// We need the non-exported stepEvalGate — reach in via a re-require + module cache peek
const buildPipelinePath = require.resolve("../build-pipeline");
const bpModule = require.cache[buildPipelinePath];
// stepEvalGate is a top-level function in the module closure; not exported.
// For this test we exercise it via a minimal fake job + brief in a tmp dir
// and call the orchestrator only when we want full-pipeline coverage.

// Simpler approach: re-implement the public invocation path by building
// a fake job object and calling the module-exported runPipeline. But
// runPipeline requires auth/create/etc. Instead, we read build-pipeline.js
// source and extract stepEvalGate via a temp eval — but that's fragile.
//
// Pragmatic path: expose stepEvalGate through a tiny accessor by re-requiring
// build-pipeline.js and reading `_testables` if present. We add that now.

// (See end of this file — we rely on `buildPipeline._testables.stepEvalGate`
// which we'll add below via a small export change.)

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeTmpAgentDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-gate-test-"));
  return dir;
}

function makeBrief(overrides = {}) {
  return {
    agent: { name: "Test Agent" },
    buildStatus: { status: "published-internal", mcsAgentId: "bot-123" },
    evalConfig: {},
    evalSets: [
      { name: "boundaries", tests: [{ question: "q1", expected: "a1" }, { question: "q2", expected: "a2" }, { question: "q3", expected: "a3" }] },
      { name: "quality", tests: [{ question: "q4", expected: "a4" }, { question: "q5", expected: "a5" }, { question: "q6", expected: "a6" }] },
    ],
    ...overrides,
  };
}

function writeBriefToDir(dir, brief) {
  fs.writeFileSync(path.join(dir, "agentspec.json"), JSON.stringify(brief, null, 2));
}

function readBriefFromDir(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, "agentspec.json"), "utf8"));
}

function makeFakeJob() {
  const job = {
    id: "job-test-1",
    projectId: "test-proj",
    agentId: "test-agent",
    steps: [{ id: "eval-gate", label: "Eval gate", status: "pending" }],
    errors: [],
    rawLog: "",
    listeners: [],
    status: "running",
  };
  return job;
}

// ---------------------------------------------------------------------------
// Access stepEvalGate via the _testables accessor (added below)
// ---------------------------------------------------------------------------

if (!buildPipeline._testables || !buildPipeline._testables.stepEvalGate) {
  throw new Error("build-pipeline.js must export _testables.stepEvalGate for this test");
}
const { stepEvalGate } = buildPipeline._testables;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("SHIP verdict promotes published-internal → published-uat", async () => {
  const dir = makeTmpAgentDir();
  const brief = makeBrief();
  writeBriefToDir(dir, brief);
  setMockEvalResult({
    verdict: { verdict: "SHIP", reason: "all good", overallRate: 90, perSet: [], thresholds: {} },
    jobId: "eval-job-1",
    error: null,
  });
  const job = makeFakeJob();
  await stepEvalGate(job, brief, dir);
  const final = readBriefFromDir(dir);
  assert.equal(final.buildStatus.status, "published-uat");
  assert.equal(final.evalGate.verdict, "SHIP");
  assert.equal(final.evalGate.promotedTo, "published-uat");
});

test("BLOCK verdict leaves agent at published-internal", async () => {
  const dir = makeTmpAgentDir();
  const brief = makeBrief();
  writeBriefToDir(dir, brief);
  setMockEvalResult({
    verdict: { verdict: "BLOCK", reason: "safety failed", overallRate: 40, perSet: [], thresholds: {} },
    jobId: "eval-job-2",
    error: null,
  });
  const job = makeFakeJob();
  await stepEvalGate(job, brief, dir);
  const final = readBriefFromDir(dir);
  assert.equal(final.buildStatus.status, "published-internal", "BLOCK must NOT promote to UAT");
  assert.equal(final.evalGate.verdict, "BLOCK");
  assert.equal(final.evalGate.promotedTo, null);
});

test("ITERATE verdict leaves agent at published-internal", async () => {
  const dir = makeTmpAgentDir();
  const brief = makeBrief();
  writeBriefToDir(dir, brief);
  setMockEvalResult({
    verdict: { verdict: "ITERATE", reason: "quality 55%", overallRate: 70, perSet: [], thresholds: {} },
    jobId: "eval-job-3",
    error: null,
  });
  const job = makeFakeJob();
  await stepEvalGate(job, brief, dir);
  const final = readBriefFromDir(dir);
  assert.equal(final.buildStatus.status, "published-internal");
  assert.equal(final.evalGate.verdict, "ITERATE");
  assert.equal(final.evalGate.promotedTo, null);
});

test("zero eval tests → BLOCK before calling eval-pipeline", async () => {
  const dir = makeTmpAgentDir();
  const brief = makeBrief({ evalSets: [] });
  writeBriefToDir(dir, brief);
  setMockEvalResult({ verdict: null, error: "eval pipeline should NOT be called" });
  const job = makeFakeJob();
  await stepEvalGate(job, brief, dir);
  const final = readBriefFromDir(dir);
  assert.equal(final.buildStatus.status, "published-internal");
  assert.equal(final.evalGate.verdict, "BLOCK");
  assert.match(final.evalGate.reason, /No eval tests defined/);
});

test("eval-pipeline throws → BLOCK with error captured", async () => {
  const dir = makeTmpAgentDir();
  const brief = makeBrief();
  writeBriefToDir(dir, brief);
  // Replace mock with one that throws
  const origLoad2 = Module._load;
  Module._load = function throwingLoad(request, parent, isMain) {
    if (request === "./eval-pipeline" && parent && parent.filename && parent.filename.endsWith("build-pipeline.js")) {
      return { runEvalForBuild: async () => { throw new Error("simulated eval crash"); } };
    }
    return origLoad2.apply(this, arguments);
  };
  // Reload build-pipeline with the throwing mock
  delete require.cache[buildPipelinePath];
  const bp2 = require("../build-pipeline");
  const job = makeFakeJob();
  await bp2._testables.stepEvalGate(job, brief, dir);
  const final = readBriefFromDir(dir);
  assert.equal(final.buildStatus.status, "published-internal");
  assert.equal(final.evalGate.verdict, "BLOCK");
  assert.match(final.evalGate.reason, /Eval execution failed: simulated eval crash/);

  // Restore for subsequent tests
  Module._load = origLoad2;
  delete require.cache[buildPipelinePath];
  require("../build-pipeline"); // warm cache again
});

test("skipGate=true WITHOUT approval fields → BLOCK with missing-field report", async () => {
  const dir = makeTmpAgentDir();
  const brief = makeBrief({ evalConfig: { skipGate: true } });
  writeBriefToDir(dir, brief);
  const job = makeFakeJob();
  await stepEvalGate(job, brief, dir);
  const final = readBriefFromDir(dir);
  assert.equal(final.buildStatus.status, "published-internal", "override must be rejected — stays internal");
  assert.equal(final.evalGate.verdict, "BLOCK");
  assert.match(final.evalGate.reason, /approval fields missing/);
  assert.match(final.evalGate.reason, /skipGateApprovedBy/);
  assert.match(final.evalGate.reason, /skipGateReason/);
  assert.match(final.evalGate.reason, /skipGateTicketRef/);
});

test("skipGate=true WITH partial fields (approvedBy only) → BLOCK", async () => {
  const dir = makeTmpAgentDir();
  const brief = makeBrief({ evalConfig: { skipGate: true, skipGateApprovedBy: "Jane Doe" } });
  writeBriefToDir(dir, brief);
  const job = makeFakeJob();
  await stepEvalGate(job, brief, dir);
  const final = readBriefFromDir(dir);
  assert.equal(final.buildStatus.status, "published-internal");
  assert.equal(final.evalGate.verdict, "BLOCK");
  assert.doesNotMatch(final.evalGate.reason, /skipGateApprovedBy/, "approvedBy was present — shouldn't be in missing list");
  assert.match(final.evalGate.reason, /skipGateReason/);
  assert.match(final.evalGate.reason, /skipGateTicketRef/);
});

test("skipGate=true with ALL approval fields → promote with audit entry", async () => {
  const dir = makeTmpAgentDir();
  const brief = makeBrief({
    evalConfig: {
      skipGate: true,
      skipGateApprovedBy: "Jane Doe",
      skipGateReason: "Throwaway POC for board demo 2026-Q2 — will be deleted after presentation",
      skipGateTicketRef: "gh-issue-999",
    },
  });
  writeBriefToDir(dir, brief);

  // Capture audit log state before + after
  const audit = require("../eval-gate-audit");
  const logBefore = fs.existsSync(audit.LOG_PATH) ? fs.readFileSync(audit.LOG_PATH, "utf8") : "";

  const job = makeFakeJob();
  await stepEvalGate(job, brief, dir);

  const final = readBriefFromDir(dir);
  assert.equal(final.buildStatus.status, "published-uat", "approved override should promote");
  assert.equal(final.evalGate.override, true);
  assert.equal(final.evalGate.overrideApprovedBy, "Jane Doe");
  assert.equal(final.evalGate.overrideTicketRef, "gh-issue-999");
  assert.ok(final.evalGate.overrideSpecHash && final.evalGate.overrideSpecHash.length === 64, "specHash is SHA-256 hex");
  assert.ok(final.evalGate.overrideEntryHash, "entryHash recorded");

  const logAfter = fs.readFileSync(audit.LOG_PATH, "utf8");
  assert.ok(logAfter.length > logBefore.length, "audit log should have grown by one entry");

  // Chain verification
  const chain = audit.verifyAuditChain();
  assert.equal(chain.ok, true, `audit chain broken at entry ${chain.brokenAt}: ${chain.reason || "ok"}`);
});

// ---------------------------------------------------------------------------
// NOT COVERED by this test (deliberately)
// ---------------------------------------------------------------------------
//
// This is a FIXTURE-BASED INTEGRATION TEST. The following are NOT exercised
// and still need either manual runbook verification or a staging MCS env:
//
//   1. Real Azure CLI auth path (stepAuth) — skipped via direct stepEvalGate call
//   2. Real Dataverse/Gateway publish path — skipped
//   3. Real Direct Line token acquisition — skipped (only logic mocked)
//   4. Actual HTTP transport to MCS — never hit in this test
//   5. Concurrent build races (same agent, two jobs) — not simulated
//   6. Partial eval results (some tests run, others timed out) — mock always
//      returns a single verdict; add that case when partial is observed live
//
// To validate the REAL end-to-end path: pick one agent with test creds, run
// the full /mcs-build against a throwaway bot, inspect the resulting
// buildStatus.status + evalGate + audit log entries manually.

// Cleanup — restore Module._load + remove tmp audit log
test.after(() => {
  Module._load = origLoad;
  try { fs.unlinkSync(TMP_AUDIT_LOG); } catch {}
});
