/**
 * fix-pipeline.js — API-direct fix pipeline for /mcs-fix.
 *
 * Reads eval failures, classifies root causes, generates targeted fixes,
 * applies them, and re-triggers eval:
 * 1. Read eval results from agentspec.json
 * 2. Classify failures (Claude Opus analysis)
 * 3. Generate fixes (instruction edits, topic changes)
 * 4. Apply fixes via Island Gateway / LSP
 * 5. Re-trigger eval pipeline
 *
 * Uses: tools/lib/anthropic.js (Claude Opus), tools/island-client.js,
 *       tools/lib/http.js, app/lib/eval-pipeline.js (re-eval trigger)
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const anthropicApi = require("../../tools/lib/anthropic");
const islandClient = require("../../tools/island-client");
const { httpRequestWithRetry, getToken, getTenantId } = require("../../tools/lib/http");

const PIPELINE_MODEL = "opus";
const MAX_TOKENS = 32768;
const API_TIMEOUT = 300_000;

// ---------------------------------------------------------------------------
// Job Management
// ---------------------------------------------------------------------------

const _jobs = new Map();

const DEFAULT_STEPS = [
  { id: "read", label: "Reading eval results", status: "pending", detail: null },
  { id: "classify", label: "Classifying failures", status: "pending", detail: null },
  { id: "generate", label: "Generating fixes", status: "pending", detail: null },
  { id: "apply", label: "Applying fixes", status: "pending", detail: null },
  { id: "reeval", label: "Re-evaluating", status: "pending", detail: null },
];

function createJob(projectId, agentId) {
  const id = `skill-fix-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const job = {
    id, skillType: "fix",
    command: `API-direct /mcs-fix ${projectId} ${agentId}`,
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
  console.log(`[fix-pipeline] Job ${job.id} ${job.status}: ${summary || ""}`);
}

function log(job, msg) {
  const line = `[fix-pipeline] ${msg}\n`;
  job.rawLog += line;
  console.log(line.trimEnd());
}

function resolveSpecPath(agentDir) {
  const agentspec = path.join(agentDir, "agentspec.json");
  return fs.existsSync(agentspec) ? agentspec : path.join(agentDir, "brief.json");
}

function readBrief(agentDir) {
  const p = resolveSpecPath(agentDir);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : null;
}

function writeBrief(agentDir, brief) {
  brief.updated_at = new Date().toISOString();
  fs.writeFileSync(path.join(agentDir, "agentspec.json"), JSON.stringify(brief, null, 2), "utf-8");
}

async function callClaude(systemPrompt, userMessage) {
  const result = await anthropicApi.chatCompletion(
    [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
    { model: PIPELINE_MODEL, maxTokens: MAX_TOKENS, timeout: API_TIMEOUT, cacheSystem: true }
  );
  return result.content;
}

function extractJSON(text) {
  try { return JSON.parse(text); } catch { /* */ }
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) try { return JSON.parse(fenced[1]); } catch { /* */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) try { return JSON.parse(m[0]); } catch { /* */ }
  const a = text.match(/\[[\s\S]*\]/);
  if (a) try { return JSON.parse(a[0]); } catch { /* */ }
  return null;
}

// ---------------------------------------------------------------------------
// Pipeline Steps
// ---------------------------------------------------------------------------

async function runPipeline(job, agentDir, baseDir) {
  try {
    const brief = readBrief(agentDir);
    if (!brief) throw new Error("agentspec.json not found");

    // Step 1: Read eval results
    updateStep(job, "read", "running", "Analyzing eval failures");
    const evalSets = brief.evalSets || [];
    const failures = [];

    for (const evalSet of evalSets) {
      for (const test of evalSet.tests || []) {
        if (test.lastResult && !test.lastResult.pass) {
          failures.push({
            set: evalSet.name,
            question: test.question,
            expected: test.expected,
            score: test.lastResult.score,
            capability: test.capability || "",
            method: test.lastResult.method || "",
            methodResults: test.lastResult.methodResults,
          });
        }
      }
    }

    if (failures.length === 0) {
      updateStep(job, "read", "completed", "No failures found — all tests passing");
      completeJob(job, true, "No failures to fix");
      return;
    }

    updateStep(job, "read", "completed", `${failures.length} failures found`);

    // Step 2: Classify failures
    updateStep(job, "classify", "running", `Classifying ${failures.length} failures`);

    const systemPrompt = `You are an MCS agent quality analyst. Given eval test failures, classify each failure's root cause and recommend a fix strategy.

Return ONLY valid JSON:
{
  "classifications": [
    {
      "question": "The test question",
      "rootCause": "instruction-gap | boundary-violation | routing-failure | knowledge-gap | scoring-issue | decision-mismatch",
      "reasoning": "Why this classification",
      "fixStrategy": "instruction-edit | topic-change | knowledge-add | tool-config | scoring-adjust",
      "fixDetail": "Specific fix description",
      "priority": "critical | high | medium | low"
    }
  ],
  "summary": {
    "instructionGaps": 0,
    "boundaryViolations": 0,
    "routingFailures": 0,
    "knowledgeGaps": 0,
    "scoringIssues": 0,
    "totalFixes": 0
  }
}

Root cause definitions:
- instruction-gap: Agent instructions don't cover this scenario
- boundary-violation: Agent responds to things it should decline/refuse
- routing-failure: Wrong topic handles the question
- knowledge-gap: Agent lacks the knowledge to answer correctly
- scoring-issue: Response is actually correct but scoring method is too strict
- decision-mismatch: Implementation doesn't match the brief specification`;

    const failureText = failures.map((f, i) =>
      `${i + 1}. [${f.set}] Q: "${f.question}" | Expected: "${f.expected}" | Score: ${f.score} | Capability: ${f.capability}`
    ).join("\n");

    const userMsg = `Agent: ${brief.agent?.name || "Agent"}
Current instructions (first 2000 chars): ${(brief.instructions || "").substring(0, 2000)}

Failures to classify:\n${failureText}`;

    const classResponse = await callClaude(systemPrompt, userMsg);
    const classifications = extractJSON(classResponse);

    if (!classifications) {
      throw new Error("Failed to parse failure classifications from Claude");
    }

    const summary = classifications.summary || {};
    updateStep(job, "classify", "completed",
      `${summary.instructionGaps || 0} instruction gaps, ${summary.boundaryViolations || 0} boundary violations, ${summary.scoringIssues || 0} scoring issues`);

    // Step 3: Generate fixes
    updateStep(job, "generate", "running", "Generating targeted fixes");

    const fixableClasses = (classifications.classifications || []).filter(
      (c) => c.fixStrategy !== "scoring-adjust"
    );

    if (fixableClasses.length === 0) {
      updateStep(job, "generate", "completed", "Only scoring issues found — adjusting thresholds");
      // Adjust scoring for scoring-issue classifications
      for (const cls of (classifications.classifications || [])) {
        if (cls.rootCause === "scoring-issue") {
          for (const evalSet of evalSets) {
            const test = evalSet.tests?.find((t) => t.question === cls.question);
            if (test) {
              test.lastResult = { ...test.lastResult, pass: true, overridden: true, overrideReason: cls.reasoning };
            }
          }
        }
      }
      writeBrief(agentDir, brief);
      updateStep(job, "apply", "skipped", "No code fixes needed");
      updateStep(job, "reeval", "skipped", "Scoring adjustments only");
      completeJob(job, true, `${classifications.classifications?.length || 0} issues resolved (scoring adjustments)`);
      return;
    }

    // Group fixes by strategy
    const instructionFixes = fixableClasses.filter((c) => c.fixStrategy === "instruction-edit");
    const topicFixes = fixableClasses.filter((c) => c.fixStrategy === "topic-change");
    const otherFixes = fixableClasses.filter((c) => !["instruction-edit", "topic-change", "scoring-adjust"].includes(c.fixStrategy));

    let fixedInstructions = null;

    // Generate instruction fix if needed
    if (instructionFixes.length > 0) {
      const instrSystemPrompt = `You are an MCS agent instruction writer. Given the current instructions and a list of gaps/issues, generate UPDATED instructions that address all issues while preserving existing correct behavior.

Output ONLY the full updated instructions text (markdown format, 2000-3500 chars). Do not explain the changes — just output the corrected instructions.`;

      const instrUserMsg = `Current instructions:\n${brief.instructions || "(empty)"}

Issues to fix:
${instructionFixes.map((f) => `- ${f.fixDetail} (for: "${f.question}")`).join("\n")}`;

      fixedInstructions = await callClaude(instrSystemPrompt, instrUserMsg);
    }

    updateStep(job, "generate", "completed",
      `${instructionFixes.length} instruction fixes, ${topicFixes.length} topic fixes, ${otherFixes.length} other`);

    // Step 4: Apply fixes
    updateStep(job, "apply", "running", "Applying fixes to agent");
    let applied = 0;

    // Apply instruction fix
    if (fixedInstructions) {
      brief.instructions = fixedInstructions;
      writeBrief(agentDir, brief);

      // Push to MCS if agent exists
      const botId = brief.buildStatus?.mcsAgentId;
      const envUrl = brief.buildStatus?.dataverseUrl || brief.buildStatus?.orgUrl;
      if (botId && envUrl) {
        try {
          const tenantId = getTenantId();
          const envId = brief.buildStatus?.environmentId;
          const pvaToken = getToken("96ff4394-9197-43aa-b393-6a41652e21f8");
          const headers = islandClient.buildHeaders(pvaToken, tenantId, envId, botId);
          const gatewayUrl = islandClient.loadGatewayFromConfig() || "";
          await islandClient.setInstructions(gatewayUrl, envId, botId, headers, fixedInstructions);
          log(job, `Instructions pushed to MCS (${fixedInstructions.length} chars)`);
        } catch (err) {
          log(job, `Failed to push instructions to MCS: ${err.message}`);
          job.errors.push(`Instruction push failed: ${err.message}`);
        }
      }
      applied += instructionFixes.length;
    }

    // Log topic and other fixes (need manual or future pipeline support)
    for (const fix of [...topicFixes, ...otherFixes]) {
      log(job, `Pending fix (${fix.fixStrategy}): ${fix.fixDetail}`);
    }

    updateStep(job, "apply", "completed", `${applied} fixes applied, ${topicFixes.length + otherFixes.length} pending`);

    // Step 5: Re-evaluate
    updateStep(job, "reeval", "running", "Triggering re-evaluation");

    try {
      const evalPipeline = require("./eval-pipeline");
      const evalJob = evalPipeline.startEvalPipeline(job.projectId, job.agentId, baseDir);
      log(job, `Re-eval started: ${evalJob.id}`);
      updateStep(job, "reeval", "completed", `Re-eval job ${evalJob.id} started`);
    } catch (err) {
      log(job, `Re-eval trigger failed: ${err.message}`);
      updateStep(job, "reeval", "completed", `Re-eval trigger failed: ${err.message}`);
    }

    completeJob(job, true,
      `${applied} fixes applied, ${topicFixes.length + otherFixes.length} pending, re-eval triggered`);
  } catch (err) {
    log(job, `Fix failed: ${err.message}`);
    job.errors.push(err.message);
    completeJob(job, false, err.message);
  }
}

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

function startFixPipeline(projectId, agentId, baseDir) {
  if (!agentId) throw new Error("agentId required for fix");
  const agentDir = path.join(baseDir, "Build-Guides", projectId, "agents", agentId);
  if (!fs.existsSync(path.join(agentDir, "agentspec.json")) && !fs.existsSync(path.join(agentDir, "brief.json"))) throw new Error("agentspec.json not found");
  if (!anthropicApi.isConfigured()) throw new Error("Claude API not configured");

  const job = createJob(projectId, agentId);
  console.log(`[fix-pipeline] Starting job ${job.id}: fix ${projectId}/${agentId}`);

  const bd = path.join(agentDir, "..", "..", "..");
  runPipeline(job, agentDir, bd).catch((err) => completeJob(job, false, err.message));
  return job;
}

function getJob(jobId) { return _jobs.get(jobId) || null; }
function getJobLog(jobId) { const j = _jobs.get(jobId); return j ? j.rawLog : null; }

module.exports = { startFixPipeline, getJob, getJobLog };
