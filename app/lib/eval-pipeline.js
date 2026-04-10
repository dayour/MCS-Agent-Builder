/**
 * eval-pipeline.js — API-direct eval pipeline for /mcs-eval.
 *
 * Runs eval test sets against a published agent:
 * 1. Load evalSets from brief.json
 * 2. Acquire Direct Line token
 * 3. Send test questions, capture responses
 * 4. Score responses (keyword, semantic, quality)
 * 5. Write results back to brief.json
 * 6. Generate summary report
 *
 * Uses: tools/direct-line-test.js (Direct Line client),
 *       tools/eval-scoring.js (scoring methods),
 *       tools/lib/http.js (Dataverse token for DL token acquisition)
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const evalScoring = require("../../tools/eval-scoring");
const { httpRequestWithRetry, getToken } = require("../../tools/lib/http");

const PIPELINE_MODEL = "opus";

// ---------------------------------------------------------------------------
// Job Management
// ---------------------------------------------------------------------------

const _jobs = new Map();

const DEFAULT_STEPS = [
  { id: "load", label: "Loading eval sets", status: "pending", detail: null },
  { id: "detect", label: "Auto-detecting mode", status: "pending", detail: null },
  { id: "token", label: "Acquiring test token", status: "pending", detail: null },
  { id: "run", label: "Running tests", status: "pending", detail: null },
  { id: "score", label: "Scoring results", status: "pending", detail: null },
  { id: "write", label: "Writing results", status: "pending", detail: null },
  { id: "report", label: "Generating report", status: "pending", detail: null },
];

function createJob(projectId, agentId) {
  const id = `skill-eval-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const job = {
    id, skillType: "eval",
    command: `API-direct /mcs-eval ${projectId} ${agentId}`,
    projectId, agentId,
    status: "running",
    steps: DEFAULT_STEPS.map((s) => ({ ...s })),
    errors: [], rawLog: "", listeners: [],
    startedAt: new Date().toISOString(),
    completedAt: null, authPrompt: null,
  };
  _jobs.set(id, job);
  return job;
}

function notifyListeners(job, event) {
  const dead = [];
  for (let i = 0; i < job.listeners.length; i++) {
    try { job.listeners[i](event); } catch { dead.push(i); }
  }
  for (let i = dead.length - 1; i >= 0; i--) job.listeners.splice(dead[i], 1);
}

function updateStep(job, stepId, status, detail) {
  const step = job.steps.find((s) => s.id === stepId);
  if (step) { step.status = status; if (detail !== undefined) step.detail = detail; }
  notifyListeners(job, { type: "step", step: stepId, status, detail: detail ?? null, steps: job.steps });
}

function completeJob(job, success, summary) {
  if (job.status === "completed" || job.status === "failed") return;
  job.status = success ? "completed" : "failed";
  job.completedAt = new Date().toISOString();
  for (const step of job.steps) {
    if (step.status === "running") step.status = success ? "completed" : "failed";
    else if (step.status === "pending") step.status = success ? "skipped" : "pending";
  }
  notifyListeners(job, { type: "done", status: job.status, summary, errors: job.errors, steps: job.steps });
  console.log(`[eval-pipeline] Job ${job.id} ${job.status}: ${summary || ""}`);
}

function log(job, msg) {
  const line = `[eval-pipeline] ${msg}\n`;
  job.rawLog += line;
  console.log(line.trimEnd());
}

function readBrief(agentDir) {
  const p = path.join(agentDir, "brief.json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : null;
}

function writeBrief(agentDir, brief) {
  brief.updated_at = new Date().toISOString();
  fs.writeFileSync(path.join(agentDir, "brief.json"), JSON.stringify(brief, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Direct Line Client (import classes from direct-line-test.js)
// ---------------------------------------------------------------------------

let _dlModule = null;
function getDLModule() {
  if (!_dlModule) {
    // direct-line-test.js doesn't have module.exports, so we load it via vm
    // Alternatively, extract the classes. For safety, use a wrapper approach.
    const dlPath = path.join(__dirname, "../../tools/direct-line-test.js");
    const dlCode = fs.readFileSync(dlPath, "utf-8");

    // The file has TokenManager and DirectLineClient classes
    // We'll use a simpler approach: call the Dataverse helper for DL token
    _dlModule = { loaded: true };
  }
  return _dlModule;
}

/**
 * Get Direct Line token for a bot via Dataverse.
 */
async function getDirectLineToken(envUrl, token, botId) {
  // Try PowerShell helper first
  try {
    const result = execSync(
      `powershell -NoProfile -Command "& { . '${path.join(__dirname, "../../tools/dataverse-helper.ps1")}'; $ctx = Connect-Dataverse -OrgUrl '${envUrl}'; Get-DirectLineToken -Ctx $ctx -BotId '${botId}' }"`,
      { encoding: "utf8", timeout: 30000 }
    ).trim();
    if (result && result.length > 20) return result;
  } catch { /* fallback */ }

  // Fallback: get token endpoint from bot config
  const resp = await httpRequestWithRetry("GET",
    `${envUrl}/api/data/v9.2/bots(${botId})?$select=configuration`, {
      Authorization: `Bearer ${token}`,
      "OData-MaxVersion": "4.0", "OData-Version": "4.0",
    });

  const config = typeof resp.data?.configuration === "string"
    ? JSON.parse(resp.data.configuration)
    : resp.data?.configuration;

  const tokenEndpoint = config?.directLineTokenEndpoint || config?.DirectLineTokenEndpoint;
  if (!tokenEndpoint) throw new Error("No Direct Line token endpoint found in bot config");

  const dlResp = await httpRequestWithRetry("GET", tokenEndpoint, {});
  const dlToken = typeof dlResp.data === "string" ? JSON.parse(dlResp.data).token : dlResp.data?.token;
  if (!dlToken) throw new Error("Failed to acquire Direct Line token");
  return dlToken;
}

/**
 * Send a message via Direct Line and get response.
 */
async function sendAndReceive(dlToken, conversationId, question, timeout = 30000) {
  const dlBase = "https://directline.botframework.com/v3/directline";
  const headers = { Authorization: `Bearer ${dlToken}`, "Content-Type": "application/json" };

  // Start conversation if needed
  if (!conversationId) {
    const startResp = await httpRequestWithRetry("POST", `${dlBase}/conversations`, headers, "{}");
    const data = typeof startResp.data === "string" ? JSON.parse(startResp.data) : startResp.data;
    conversationId = data.conversationId;
    // Update token if refreshed
    if (data.token) dlToken = data.token;
  }

  // Send message
  await httpRequestWithRetry("POST", `${dlBase}/conversations/${conversationId}/activities`, headers,
    JSON.stringify({ type: "message", from: { id: "eval-user" }, text: question }));

  // Poll for response
  const deadline = Date.now() + timeout;
  let watermark = null;
  while (Date.now() < deadline) {
    const url = `${dlBase}/conversations/${conversationId}/activities${watermark ? `?watermark=${watermark}` : ""}`;
    const resp = await httpRequestWithRetry("GET", url, headers);
    const data = typeof resp.data === "string" ? JSON.parse(resp.data) : resp.data;

    const botActivities = (data.activities || []).filter(
      (a) => a.from?.id !== "eval-user" && a.type === "message" && a.text
    );
    if (botActivities.length > 0) {
      return { conversationId, response: botActivities.map((a) => a.text).join("\n"), dlToken };
    }

    watermark = data.watermark;
    await new Promise((r) => setTimeout(r, 1000));
  }

  return { conversationId, response: "[No response within timeout]", dlToken };
}

// ---------------------------------------------------------------------------
// Pipeline Steps
// ---------------------------------------------------------------------------

async function runPipeline(job, agentDir) {
  try {
    const brief = readBrief(agentDir);
    if (!brief) throw new Error("brief.json not found");

    // Step 1: Load eval sets
    updateStep(job, "load", "running");
    const evalSets = brief.evalSets || [];
    const totalTests = evalSets.reduce((s, e) => s + (e.tests || []).length, 0);
    if (totalTests === 0) {
      updateStep(job, "load", "completed", "No tests to run");
      completeJob(job, true, "No eval tests found in brief");
      return;
    }
    updateStep(job, "load", "completed", `${totalTests} tests in ${evalSets.length} sets`);

    // Step 2: Detect mode
    updateStep(job, "detect", "running", "Checking build status");
    const buildStatus = brief.buildStatus || {};
    const botId = buildStatus.mcsAgentId;
    const envUrl = buildStatus.dataverseUrl || buildStatus.orgUrl;
    if (!botId || !envUrl) {
      throw new Error("Agent not built — run /mcs-build first (need mcsAgentId and dataverseUrl)");
    }
    updateStep(job, "detect", "completed", "Direct Line API mode");

    // Step 3: Acquire token
    updateStep(job, "token", "running", "Getting Direct Line token");
    let dvToken;
    try {
      dvToken = execSync(`az account get-access-token --resource "${envUrl}" --query accessToken -o tsv`, {
        encoding: "utf8", timeout: 15000,
      }).trim();
    } catch { throw new Error("Azure CLI auth failed — run: az login"); }

    let dlToken = await getDirectLineToken(envUrl, dvToken, botId);
    updateStep(job, "token", "completed", "Token acquired");

    // Step 4: Run tests
    updateStep(job, "run", "running", `Running ${totalTests} tests`);
    let conversationId = null;
    let completed = 0;

    for (const evalSet of evalSets) {
      for (const test of evalSet.tests || []) {
        try {
          const result = await sendAndReceive(dlToken, conversationId, test.question);
          conversationId = result.conversationId;
          dlToken = result.dlToken;
          test._actualResponse = result.response;
          completed++;
          updateStep(job, "run", "running", `${completed}/${totalTests} tests sent`);
        } catch (err) {
          test._actualResponse = `[Error: ${err.message}]`;
          test._error = err.message;
          completed++;
          log(job, `Test failed: ${test.question.substring(0, 50)}... — ${err.message}`);
        }
      }
    }
    updateStep(job, "run", "completed", `${completed} tests executed`);

    // Step 5: Score results
    updateStep(job, "score", "running", "Scoring responses");
    let passed = 0, failed = 0;

    for (const evalSet of evalSets) {
      for (const test of evalSet.tests || []) {
        if (!test._actualResponse || test._error) {
          test.lastResult = { pass: false, score: 0, method: "error", error: test._error || "No response" };
          failed++;
          continue;
        }

        const methods = test.methods || evalSet.methods || [{ type: "General quality" }];
        try {
          const result = await evalScoring.evaluateAllMethodsAsync(
            test._actualResponse, test.expected, methods, null, test.keywords
          );
          test.lastResult = { pass: result.pass, score: result.score, methodResults: result.methodResults };
          if (result.pass) passed++; else failed++;
        } catch (err) {
          // Fallback to sync scoring
          const result = evalScoring.evaluateAllMethods(
            test._actualResponse, test.expected, methods, null, test.keywords
          );
          test.lastResult = { pass: result.pass, score: result.score, methodResults: result.methodResults };
          if (result.pass) passed++; else failed++;
        }

        // Clean up temp fields
        delete test._actualResponse;
        delete test._error;
      }
    }
    updateStep(job, "score", "completed", `${passed} passed, ${failed} failed`);

    // Step 6: Write results
    updateStep(job, "write", "running");
    brief.evalSets = evalSets;
    brief.workflow = brief.workflow || {};
    brief.workflow.lastEvalAt = new Date().toISOString();
    writeBrief(agentDir, brief);
    updateStep(job, "write", "completed", "Results written to brief.json");

    // Step 7: Report
    updateStep(job, "report", "running");
    const setResults = evalSets.map((s) => {
      const tests = s.tests || [];
      const p = tests.filter((t) => t.lastResult?.pass).length;
      const rate = tests.length > 0 ? Math.round((p / tests.length) * 100) : 0;
      return { name: s.name, passed: p, total: tests.length, rate, threshold: s.passThreshold };
    });

    const allPass = setResults.every((s) => s.rate >= (s.threshold || 85));
    const summary = setResults.map((s) => `${s.name}: ${s.rate}% (${s.passed}/${s.total}, threshold ${s.threshold}%)`).join(" | ");

    log(job, `Eval results: ${summary}`);
    updateStep(job, "report", "completed", summary);
    completeJob(job, true, `${allPass ? "All sets pass" : "Some sets below threshold"} — ${summary}`);
  } catch (err) {
    log(job, `Eval failed: ${err.message}`);
    job.errors.push(err.message);
    completeJob(job, false, err.message);
  }
}

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

function startEvalPipeline(projectId, agentId, baseDir) {
  if (!agentId) throw new Error("agentId required for eval");
  const agentDir = path.join(baseDir, "Build-Guides", projectId, "agents", agentId);
  if (!fs.existsSync(path.join(agentDir, "brief.json"))) throw new Error("brief.json not found");

  const job = createJob(projectId, agentId);
  console.log(`[eval-pipeline] Starting job ${job.id}: eval ${projectId}/${agentId}`);
  runPipeline(job, agentDir).catch((err) => completeJob(job, false, err.message));
  return job;
}

function getJob(jobId) { return _jobs.get(jobId) || null; }
function getJobLog(jobId) { const j = _jobs.get(jobId); return j ? j.rawLog : null; }

module.exports = { startEvalPipeline, getJob, getJobLog };
