#!/usr/bin/env node
/**
 * E2E Test: Wizard → Save → Enrichment → Verify Pipeline
 *
 * Tests the full agent creation flow via API calls (no browser needed).
 * Starts the server, runs a simulated wizard conversation, saves the brief,
 * triggers enrichment, and verifies the results.
 *
 * Usage: node tests/e2e-wizard-pipeline.js
 */

const http = require("http");
const path = require("path");
const fs = require("fs");

const BASE_URL = "http://localhost:8000";
const TIMINGS = {};
const RESULTS = {};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function time(label) {
  TIMINGS[label] = { start: Date.now() };
  return () => {
    TIMINGS[label].end = Date.now();
    TIMINGS[label].duration = TIMINGS[label].end - TIMINGS[label].start;
    const sec = (TIMINGS[label].duration / 1000).toFixed(2);
    console.log(`  [${sec}s] ${label}`);
    return TIMINGS[label].duration;
  };
}

function post(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const data = JSON.stringify(body);
    const req = http.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
    }, (res) => {
      let chunks = "";
      res.on("data", (d) => (chunks += d));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`${res.statusCode}: ${chunks.substring(0, 500)}`));
        }
        try { resolve(JSON.parse(chunks)); } catch { resolve(chunks); }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    http.get(url, (res) => {
      let chunks = "";
      res.on("data", (d) => (chunks += d));
      res.on("end", () => {
        if (res.statusCode >= 400) return reject(new Error(`${res.statusCode}: ${chunks.substring(0, 500)}`));
        try { resolve(JSON.parse(chunks)); } catch { resolve(chunks); }
      });
    }).on("error", reject);
  });
}

/** Read SSE stream, collect events, resolve when done event or timeout. */
function readSSE(urlPath, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const events = [];
    const url = new URL(urlPath, BASE_URL);
    const timer = setTimeout(() => {
      req.destroy();
      resolve({ events, timedOut: true });
    }, timeoutMs);

    const req = http.get(url, (res) => {
      let buffer = "";
      res.on("data", (chunk) => {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const evt = JSON.parse(line.slice(6));
              events.push(evt);
              if (evt.type === "done") {
                clearTimeout(timer);
                req.destroy();
                resolve({ events, timedOut: false });
              }
            } catch { /* skip */ }
          }
        }
      });
      res.on("end", () => {
        clearTimeout(timer);
        resolve({ events, timedOut: false });
      });
    });
    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/** Send SSE wizard chat request and collect all events. */
function wizardChat(mode, messages, currentState) {
  return new Promise((resolve, reject) => {
    const events = [];
    const body = JSON.stringify({ mode, messages, currentState });
    const url = new URL("/api/wizard/chat", BASE_URL);
    const req = http.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      if (res.statusCode >= 400) {
        let err = "";
        res.on("data", (d) => (err += d));
        res.on("end", () => reject(new Error(`${res.statusCode}: ${err.substring(0, 500)}`)));
        return;
      }
      let buffer = "";
      res.on("data", (chunk) => {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try { events.push(JSON.parse(line.slice(6))); } catch {}
          }
        }
      });
      res.on("end", () => resolve(events));
    });
    req.on("error", reject);
    req.setTimeout(300000, () => { req.destroy(); reject(new Error("Wizard chat timeout")); });
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Test Scenario: IT Helpdesk Agent
// ---------------------------------------------------------------------------

const SCENARIO = {
  name: "IT Helpdesk Agent",
  conversation: [
    // Turn 1: User describes the agent
    "I want to build an IT helpdesk agent that helps employees troubleshoot common tech issues like password resets, VPN problems, and software installation requests. It should be able to search our knowledge base and create tickets in ServiceNow.",
    // Turn 2: Follow-up on boundaries
    "It should handle password resets, VPN troubleshooting, software requests, printer issues, and general IT FAQs. It should NOT help with HR questions, salary info, or anything personal. If something is urgent or hardware-related, it should escalate to a human agent.",
    // Turn 3: Users and tone
    "The main users are all employees in the company, about 5000 people. The tone should be friendly and efficient - not too formal but professional. It should be deployed on Microsoft Teams.",
  ],
};

// ---------------------------------------------------------------------------
// Pipeline Steps
// ---------------------------------------------------------------------------

async function step0_healthCheck() {
  const done = time("Step 0: Health check");
  try {
    const result = await get("/api/health");
    RESULTS.health = result;
    console.log(`    Server: ${JSON.stringify(result)}`);
    done();
    return true;
  } catch (err) {
    console.error(`    FAIL: ${err.message}`);
    done();
    return false;
  }
}

async function step1_wizardConversation() {
  console.log("\n--- Step 1: Wizard Conversation (3 turns) ---");
  const totalDone = time("Step 1: Full wizard conversation");

  let currentState = {
    sections: {},
    draft: {},
    suggestions: [],
    activeSection: null,
    readyToSave: false,
  };
  const allMessages = [];
  let assistantText = "";
  let wizardState = null;

  for (let i = 0; i < SCENARIO.conversation.length; i++) {
    const userMsg = SCENARIO.conversation[i];
    allMessages.push({ role: "user", content: userMsg });

    const turnDone = time(`  Turn ${i + 1}: "${userMsg.substring(0, 50)}..."`);

    try {
      const events = await wizardChat("interview", allMessages, currentState);

      // Process events
      let turnText = "";
      for (const evt of events) {
        if (evt.type === "token" && evt.text) turnText += evt.text;
        if (evt.type === "state" && evt.wizardState) {
          wizardState = evt.wizardState;
          currentState = wizardState;
        }
      }

      assistantText = turnText;
      allMessages.push({ role: "assistant", content: assistantText });

      const sections = wizardState?.sections || {};
      const completeSections = Object.entries(sections).filter(([, v]) => v === "complete").length;
      const readyToSave = wizardState?.readyToSave || false;
      console.log(`    Response: ${assistantText.length} chars | Sections complete: ${completeSections} | Ready: ${readyToSave}`);

      if (wizardState?.draft) {
        const d = wizardState.draft;
        const capCount = (d.capabilities || []).length;
        const intCount = (d.integrations || []).length;
        console.log(`    Draft: ${capCount} capabilities, ${intCount} integrations`);
      }

      // Check for inline resolution
      if (wizardState?._resolution) {
        const r = wizardState._resolution;
        console.log(`    Resolution: buildPath=${r.buildPath?.buildPath || "?"}, fpMatches=${r.firstPartyMatches?.length || 0}`);
      }

      turnDone();
    } catch (err) {
      console.error(`    FAIL: ${err.message}`);
      turnDone();
      RESULTS.wizardError = err.message;
      break;
    }
  }

  RESULTS.wizardState = wizardState;
  RESULTS.wizardMessages = allMessages;
  totalDone();
  return wizardState;
}

async function step2_wizardSave(wizardState) {
  console.log("\n--- Step 2: Wizard Save ---");
  const done = time("Step 2: Save brief");

  try {
    const draft = wizardState?.draft || {};
    const result = await post("/api/wizard/save", {
      projectName: "E2E-Test-ITHelpdesk",
      agentName: draft.identity?.name || "IT Helpdesk Agent",
      draft,
    });

    console.log(`    Project: ${result.projectId} | Agent: ${result.agentId}`);
    RESULTS.projectId = result.projectId;
    RESULTS.agentId = result.agentId;
    done();
    return result;
  } catch (err) {
    console.error(`    FAIL: ${err.message}`);
    done();
    RESULTS.saveError = err.message;
    return null;
  }
}

async function step3_triggerEnrichment(projectId, agentId) {
  console.log("\n--- Step 3: Background Enrichment ---");
  const done = time("Step 3: Full enrichment");

  try {
    // Start enrichment
    const startDone = time("  3a: Trigger enrichment");
    const { jobId } = await post("/api/enrichment/start", { projectId, agentId });
    console.log(`    Job: ${jobId}`);
    startDone();

    // Watch enrichment progress via SSE
    const watchDone = time("  3b: Watch enrichment SSE");
    const { events, timedOut } = await readSSE(`/api/enrichment/status/${jobId}`, 600000);

    if (timedOut) {
      console.log("    WARNING: Enrichment timed out after 3 minutes");
    }

    // Report step-by-step progress
    const stepEvents = events.filter((e) => e.type === "step");
    for (const evt of stepEvents) {
      console.log(`    ${evt.step}: ${evt.status}${evt.detail ? ` — ${evt.detail}` : ""}`);
    }

    const doneEvt = events.find((e) => e.type === "done");
    if (doneEvt) {
      console.log(`    Final status: ${doneEvt.status} (${(doneEvt.errors || []).length} errors)`);
      if (doneEvt.errors?.length > 0) {
        for (const err of doneEvt.errors) console.log(`    Error: ${err}`);
      }
    }

    RESULTS.enrichJobId = jobId;
    RESULTS.enrichEvents = events;
    watchDone();
    done();
    return events;
  } catch (err) {
    console.error(`    FAIL: ${err.message}`);
    done();
    RESULTS.enrichError = err.message;
    return null;
  }
}

async function step4_verifyBrief(projectId, agentId) {
  console.log("\n--- Step 4: Verify Brief.json ---");
  const done = time("Step 4: Verify brief");

  try {
    const agent = await get(`/api/projects/${projectId}/agents/${agentId}`);
    const brief = agent.brief || {};

    // Check key sections
    const checks = {
      "Agent name": brief.agent?.name || "MISSING",
      "Agent description": brief.agent?.description ? `${brief.agent.description.length} chars` : "MISSING",
      "Capabilities": (brief.capabilities || []).length,
      "Integrations": (brief.integrations || []).length,
      "Knowledge sources": (brief.knowledge || []).length,
      "Boundaries": brief.boundaries ? "present" : "MISSING",
      "Instructions": brief.instructions ? `${brief.instructions.length} chars` : "MISSING",
      "Eval sets": (brief.evalSets || []).length,
      "Total eval tests": (brief.evalSets || []).reduce((sum, s) => sum + (s.tests || []).length, 0),
      "Architecture buildPath": brief.architecture?.buildPath || "MISSING",
      "Workflow phase": brief.workflow?.phase || "MISSING",
      "_enrichment": brief._enrichment ? "present" : "MISSING",
    };

    for (const [label, value] of Object.entries(checks)) {
      const status = value === "MISSING" || value === 0 ? "WARN" : "OK";
      console.log(`    [${status}] ${label}: ${value}`);
    }

    // Check eval set details
    if (brief.evalSets?.length > 0) {
      for (const set of brief.evalSets) {
        console.log(`    Eval: "${set.name}" — ${(set.tests || []).length} tests, threshold: ${set.passThreshold}%`);
      }
    }

    RESULTS.brief = checks;
    done();
    return brief;
  } catch (err) {
    console.error(`    FAIL: ${err.message}`);
    done();
    RESULTS.verifyError = err.message;
    return null;
  }
}

async function step5_verifyFiles(projectId, agentId) {
  console.log("\n--- Step 5: Verify Files on Disk ---");
  const done = time("Step 5: File verification");

  const buildGuides = path.join(__dirname, "..", "Build-Guides");
  const agentDir = path.join(buildGuides, projectId, "agents", agentId);

  try {
    const briefPath = path.join(agentDir, "brief.json");
    if (fs.existsSync(briefPath)) {
      const stat = fs.statSync(briefPath);
      console.log(`    brief.json: ${(stat.size / 1024).toFixed(1)} KB`);
      const brief = JSON.parse(fs.readFileSync(briefPath, "utf-8"));
      console.log(`    brief.json keys: ${Object.keys(brief).join(", ")}`);
    } else {
      console.log("    brief.json: NOT FOUND");
    }

    // Check agent directory structure
    const items = fs.existsSync(agentDir) ? fs.readdirSync(agentDir) : [];
    console.log(`    Agent dir contents: ${items.join(", ") || "(empty)"}`);

    RESULTS.files = { briefExists: fs.existsSync(briefPath), agentDirItems: items };
    done();
  } catch (err) {
    console.error(`    FAIL: ${err.message}`);
    done();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== E2E Wizard Pipeline Test ===");
  console.log(`Scenario: ${SCENARIO.name}`);
  console.log(`Server: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  const pipelineStart = Date.now();

  // Step 0: Health check
  console.log("--- Step 0: Server Health ---");
  const healthy = await step0_healthCheck();
  if (!healthy) {
    console.error("\nServer not running. Start with: node start.js");
    process.exit(1);
  }

  // Step 1: Wizard conversation
  const wizardState = await step1_wizardConversation();
  if (!wizardState) {
    console.error("\nWizard conversation failed — check API key configuration");
    printReport(pipelineStart);
    process.exit(1);
  }

  // Step 2: Save
  const saveResult = await step2_wizardSave(wizardState);
  if (!saveResult) {
    console.error("\nSave failed");
    printReport(pipelineStart);
    process.exit(1);
  }

  // Step 3: Enrichment
  await step3_triggerEnrichment(saveResult.projectId, saveResult.agentId);

  // Step 4: Verify via API
  await step4_verifyBrief(saveResult.projectId, saveResult.agentId);

  // Step 5: Verify files
  await step5_verifyFiles(saveResult.projectId, saveResult.agentId);

  // Report
  printReport(pipelineStart);
}

function printReport(pipelineStart) {
  const totalMs = Date.now() - pipelineStart;
  console.log("\n=== TIMING REPORT ===\n");
  console.log(`${"Step".padEnd(50)} ${"Duration".padStart(10)}`);
  console.log("-".repeat(62));

  for (const [label, t] of Object.entries(TIMINGS)) {
    if (t.duration !== undefined) {
      const sec = (t.duration / 1000).toFixed(2) + "s";
      console.log(`${label.padEnd(50)} ${sec.padStart(10)}`);
    }
  }
  console.log("-".repeat(62));
  console.log(`${"TOTAL PIPELINE".padEnd(50)} ${((totalMs / 1000).toFixed(2) + "s").padStart(10)}`);

  // Pass/fail summary
  console.log("\n=== RESULT SUMMARY ===\n");
  const checks = [
    ["Wizard conversation", !RESULTS.wizardError],
    ["Save brief", !!RESULTS.projectId],
    ["Enrichment triggered", !!RESULTS.enrichJobId],
    ["Instructions generated", RESULTS.brief?.Instructions !== "MISSING"],
    ["Eval tests generated", RESULTS.brief?.["Total eval tests"] > 0],
    ["Build path set", RESULTS.brief?.["Architecture buildPath"] !== "MISSING"],
    ["Files on disk", RESULTS.files?.briefExists],
  ];

  let passed = 0;
  for (const [name, ok] of checks) {
    console.log(`  ${ok ? "PASS" : "FAIL"} ${name}`);
    if (ok) passed++;
  }
  console.log(`\n${passed}/${checks.length} checks passed | Total: ${(totalMs / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
