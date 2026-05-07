/**
 * enrichment.js — Background enrichment workers for post-wizard brief enrichment.
 *
 * After the wizard saves a brief.json, these workers run in the background to:
 * 1. Generate agent instructions (using Claude Sonnet)
 * 2. Generate eval test sets from scenario templates
 * 3. Research external integrations (Priority 5-6 only)
 * 4. Run solution type + architecture scoring
 *
 * Results are written to brief.json as they complete. Uses file-level locking
 * to prevent race conditions between concurrent workers.
 *
 * The server exposes an SSE endpoint for the frontend to track progress.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const knowledgeResolver = require("./knowledge-resolver");
const { SOURCES, setProvenance, isUserEdited } = require("./provenance");
const { generateInstructions } = require("./generators/instructions");
const { generateEvalStubs }    = require("./generators/evals");
const { generateScoring }      = require("./generators/scoring");
const { generateResearch }     = require("./generators/research");
const dev = require("./dev-logger");
const specStore = require("./chat/spec-store");

// ---------------------------------------------------------------------------
// Job State Management
// ---------------------------------------------------------------------------

/** In-memory job registry. Jobs are keyed by projectId/agentId. */
const _jobs = new Map();

/**
 * @typedef {Object} EnrichmentJob
 * @property {string} id
 * @property {string} projectPath - Full path to agent directory
 * @property {string} status - "running" | "completed" | "completed_with_errors" | "failed"
 * @property {Object} steps - Per-step status
 * @property {string[]} errors
 * @property {Function[]} listeners - SSE listeners
 * @property {string} startedAt
 * @property {string} completedAt
 */

function createJob(projectPath) {
  const id = `enrich-${Date.now()}`;
  const job = {
    id,
    projectPath,
    status: "running",
    steps: {
      scoring: { status: "pending", label: "Architecture scoring" },
      instructions: { status: "pending", label: "Generating instructions" },
      evals: { status: "pending", label: "Generating eval tests" },
      research: { status: "pending", label: "Component research" },
    },
    errors: [],
    listeners: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
  _jobs.set(id, job);
  return job;
}

function notifyListeners(job, event) {
  const dead = [];
  for (let i = 0; i < job.listeners.length; i++) {
    try { job.listeners[i](event); } catch { dead.push(i); }
  }
  // Remove dead listeners in reverse order to preserve indices
  for (let i = dead.length - 1; i >= 0; i--) {
    job.listeners.splice(dead[i], 1);
  }
}

function updateStep(job, stepName, status, detail) {
  job.steps[stepName].status = status;
  if (detail) job.steps[stepName].detail = detail;
  notifyListeners(job, { type: "step", step: stepName, status, detail });
}

// ---------------------------------------------------------------------------
// Agent Spec Read/Write with File Locking
// ---------------------------------------------------------------------------

const SPEC_FILENAME = "agentspec.json";
const LEGACY_SPEC_FILENAME = "brief.json";

/** Resolve spec file: prefers agentspec.json, falls back to brief.json. */
function resolveSpecFile(agentDir) {
  const newPath = path.join(agentDir, SPEC_FILENAME);
  if (fs.existsSync(newPath)) return newPath;
  const legacyPath = path.join(agentDir, LEGACY_SPEC_FILENAME);
  if (fs.existsSync(legacyPath)) return legacyPath;
  return newPath;
}

/** Read agent spec from agent directory. */
function readBrief(agentDir) {
  const specPath = resolveSpecFile(agentDir);
  if (!fs.existsSync(specPath)) return null;
  return JSON.parse(fs.readFileSync(specPath, "utf-8"));
}

// Spec writes are serialized through the shared chat/spec-store mutex
// (specStore.withSpecLock) so concurrent chat patches, build-pipeline
// writes, research-pipeline writes, and enrichment merges don't race.
// The previous local _writeLocks map only protected enrichment-vs-enrichment
// races; this delegation closes the broader gap.

/** Build patch metadata for context-refresh mode. */
function refreshMeta(job) {
  if (!job?.forceRefresh) return {};
  return { _forceRefresh: true, _source: "context-refresh" };
}

/**
 * mergeToBrief historically emitted patchSource="context-refresh" for forced
 * re-runs. That string isn't a valid provenance SOURCE — semantically it's a
 * forced ENRICHMENT write, so we map it here and stash the detail on the
 * provenance record's `reason` field for audit trails.
 */
function patchSourceToProvenance(patchSource, sourceFiles) {
  if (patchSource === "context-refresh") {
    return { setBy: SOURCES.ENRICHMENT, meta: { sourceFiles, reason: "context-refresh" } };
  }
  // All other writers in this file set patchSource to a valid SOURCES value
  // (e.g. "enrichment" from the default, or "research" when research-pipeline
  // reuses mergeToBrief). provenance.js will throw on anything else — that's
  // the intended contract.
  return { setBy: patchSource, meta: { sourceFiles } };
}

/** Merge enrichment results into existing spec (read-modify-write). */
async function mergeToBrief(agentDir, patch) {
  return specStore.withSpecLock(agentDir, () => {
    const briefPath = resolveSpecFile(agentDir);
    const brief = JSON.parse(fs.readFileSync(briefPath, "utf-8"));
    const patchSource = patch._source || "enrichment";
    const patchSourceFiles = patch._sourceFiles || [];
    const forceRefresh = patch._forceRefresh || false;
    const prov = patchSourceToProvenance(patchSource, patchSourceFiles);

    // Apply patch fields
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      // Skip internal patch metadata
      if (key === "_source" || key === "_sourceFiles" || key === "_jobId" || key === "_forceRefresh") continue;

      if (key === "_enrichment") {
        // Merge enrichment metadata, don't overwrite (multiple workers write subfields)
        brief._enrichment = brief._enrichment || {};
        Object.assign(brief._enrichment, value);
      } else if (key === "_provenance") {
        // Merge provenance metadata
        brief._provenance = brief._provenance || {};
        Object.assign(brief._provenance, value);
      } else if (key === "architecture") {
        // Merge architecture fields, don't overwrite
        brief.architecture = brief.architecture || {};
        Object.assign(brief.architecture, value);
        setProvenance(brief, "architecture", prov.setBy, prov.meta);
      } else if (key === "workflow" && typeof value === "object") {
        // Merge workflow fields, don't overwrite
        brief.workflow = brief.workflow || {};
        Object.assign(brief.workflow, value);
      } else if (key === "evalSets" && Array.isArray(value)) {
        if (isUserEdited(brief, "evalSets") && !forceRefresh) {
          // Preserve user-edited/added tests, append new enrichment tests
          const existingTests = new Set();
          for (const es of brief.evalSets || []) {
            for (const t of es.tests || []) {
              if (t.source === "user-edited" || t.source === "user-added") {
                existingTests.add(t.question);
              }
            }
          }
          // Merge: keep user tests, add new enrichment tests
          for (const newSet of value) {
            const existingSet = (brief.evalSets || []).find((s) => s.name === newSet.name);
            if (existingSet) {
              for (const t of newSet.tests || []) {
                if (!existingTests.has(t.question)) {
                  existingSet.tests.push(t);
                }
              }
            } else {
              (brief.evalSets = brief.evalSets || []).push(newSet);
            }
          }
          dev.info("enrichment", "Preserved user-edited eval tests, appended new");
        } else {
          brief.evalSets = value;
          setProvenance(brief, "evalSets", prov.setBy, prov.meta);
        }
      } else if (key === "instructions" && typeof value === "string") {
        if (isUserEdited(brief, "instructions") && !forceRefresh) {
          dev.info("enrichment", "Skipping instructions — user-edited");
        } else {
          brief.instructions = value;
          setProvenance(brief, "instructions", prov.setBy, prov.meta);
        }
      } else if (key === "capabilities" && Array.isArray(value)) {
        if (Array.isArray(brief.capabilities)) {
          // Update metadata on existing caps, append genuinely new ones
          const existingNames = new Set(brief.capabilities.map((c) => c.name));
          for (const enriched of value) {
            const existing = brief.capabilities.find((c) => c.name === enriched.name);
            if (existing) {
              // Only update machine-managed metadata, not user-editable fields
              if (enriched.implementationType) existing.implementationType = enriched.implementationType;
              if (enriched._patternMatch) existing._patternMatch = enriched._patternMatch;
              if (enriched._provenance) existing._provenance = enriched._provenance;
            } else if (!existingNames.has(enriched.name)) {
              // Genuinely new capability — append
              brief.capabilities.push(enriched);
              existingNames.add(enriched.name);
            }
          }
        } else {
          brief.capabilities = value;
        }
        setProvenance(brief, "capabilities", prov.setBy, prov.meta);
      } else if (key === "integrations" && Array.isArray(value)) {
        if (Array.isArray(brief.integrations)) {
          // Append new integrations, don't duplicate
          const existingNames = new Set(brief.integrations.map((i) => (i.name || "").toLowerCase()));
          for (const newInteg of value) {
            if (!existingNames.has((newInteg.name || "").toLowerCase())) {
              brief.integrations.push(newInteg);
              existingNames.add((newInteg.name || "").toLowerCase());
            }
          }
        } else {
          brief.integrations = value;
        }
        setProvenance(brief, "integrations", prov.setBy, prov.meta);
      } else if (key === "knowledge" && Array.isArray(value)) {
        if (Array.isArray(brief.knowledge)) {
          const existingNames = new Set(brief.knowledge.map((k) => (k.name || k.source || "").toLowerCase()));
          for (const newK of value) {
            if (!existingNames.has((newK.name || newK.source || "").toLowerCase())) {
              brief.knowledge.push(newK);
            }
          }
        } else {
          brief.knowledge = value;
        }
        setProvenance(brief, "knowledge", prov.setBy, prov.meta);
      } else if (key === "recommendations" && Array.isArray(value)) {
        // Always append recommendations, never replace
        brief.recommendations = brief.recommendations || [];
        for (const rec of value) {
          const exists = brief.recommendations.some(
            (r) => r.text === rec.text && r.category === rec.category
          );
          if (!exists) brief.recommendations.push(rec);
        }
      } else {
        brief[key] = value;
      }
    }

    // Atomic write via specStore — temp + rename, stamps updated_at.
    specStore.writeSpec(agentDir, brief);
    return brief;
  }).catch((err) => { dev.error("enrichment", "merge error", err.message); throw err; });
}

// ---------------------------------------------------------------------------
// Claude API Helper (reuses wizard's auth)
// ---------------------------------------------------------------------------

const { spawn } = require("child_process");
const anthropicApi = require("../../tools/lib/anthropic");

// Enrichment runs in background — Opus 4.6 for quality + speed
const ENRICHMENT_MODEL = process.env.ENRICHMENT_MODEL || process.env.WIZARD_MODEL || "opus";

/** Resolve Claude CLI path and API key (legacy fallback). */
function getClaudeConfig() {
  const npmGlobal = path.join(os.homedir(), "AppData", "Roaming", "npm",
    "node_modules", "@anthropic-ai", "claude-code", "cli.js");
  const cliPath = fs.existsSync(npmGlobal) ? npmGlobal : null;

  let apiKey = process.env.ANTHROPIC_API_KEY || "";
  if (!apiKey) {
    try {
      const configPath = path.join(os.homedir(), ".claude", "config.json");
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      apiKey = config.primaryApiKey || "";
    } catch { /* ignore */ }
  }
  return { cliPath, apiKey };
}

const _enrichClaudeConfig = getClaudeConfig();

/**
 * Call Claude via direct Anthropic API (primary) or CLI subprocess (fallback).
 * Direct API: ~3-8s. CLI: ~30s.
 */
async function callClaude(systemPrompt, userMessage) {
  // Primary: direct API — 5-10x faster than CLI
  if (anthropicApi.isConfigured()) {
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];
    const callOpts = { model: ENRICHMENT_MODEL, maxTokens: 32768, timeout: 180000, cacheSystem: true };
    const result = await anthropicApi.chatCompletion(messages, callOpts);

    // Retry once with 2x tokens if truncated or empty
    if (result.truncated || !result.content || result.content.trim().length === 0) {
      const reason = result.truncated ? "truncated" : "empty";
      dev.error("enrichment", `Response ${reason}. Retrying with 2x maxTokens...`);
      const retry = await anthropicApi.chatCompletion(messages, { ...callOpts, maxTokens: 65536 });
      return retry.content || result.content || "";
    }

    return result.content;
  }

  // Fallback: CLI subprocess
  const { cliPath, apiKey } = _enrichClaudeConfig;
  if (!cliPath || !apiKey) {
    throw new Error("Claude not configured — ensure Claude Code is logged in");
  }

  return new Promise((resolve, reject) => {
    const args = [
      cliPath,
      "-p", userMessage,
      "--model", ENRICHMENT_MODEL,
      "--system-prompt", systemPrompt,
      "--no-session-persistence",
      "--bare",
    ];

    const child = spawn(process.execPath, args, {
      timeout: 180000,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ANTHROPIC_API_KEY: apiKey },
    });
    child.stdin.end();

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));

    child.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`claude CLI exit ${code}: ${stderr.substring(0, 300)}`));
      }
      resolve(stdout.trim());
    });

    child.on("error", (err) => {
      reject(new Error(`claude CLI spawn error: ${err.message}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Enrichment Workers
// ---------------------------------------------------------------------------

/**
 * Worker 1: Architecture & Component Scoring
 * Runs deterministic scoring using the knowledge resolver.
 */
async function enrichScoring(job) {
  updateStep(job, "scoring", "running");
  try {
    const brief = readBrief(job.projectPath);
    if (!brief) throw new Error("agentspec.json not found");

    const result = await generateScoring({
      brief,
      setBy: SOURCES.ENRICHMENT,
      sourceFiles: [],
    });

    await mergeToBrief(job.projectPath, {
      ...refreshMeta(job),
      capabilities: result.capabilities,
      architecture: result.architecture,
      _enrichment: { scoring: result.enrichmentMeta },
    });

    updateStep(job, "scoring", "completed",
      `${result.architecture.buildPath} (score ${result.meta.score}/5)`);
  } catch (err) {
    job.errors.push(`scoring: ${err.message}`);
    updateStep(job, "scoring", "failed", err.message);
  }
}

/**
 * Worker 2: Generate Instructions
 * Uses Claude to write concise agent instructions from the brief.
 * Trusts the model (GPT-5.4 / Opus 4.6) to infer correct behavior —
 * no verbose examples needed. Target: ~2-3K chars.
 */
async function enrichInstructions(job) {
  updateStep(job, "instructions", "running");
  try {
    const brief = readBrief(job.projectPath);
    if (!brief) throw new Error("agentspec.json not found");

    // Delegate to the shared generator adapter — same module powers the
    // /mcs-research Phase C PE teammate so both paths produce equivalent output.
    const result = await generateInstructions({
      brief,
      setBy: SOURCES.ENRICHMENT,
      sourceFiles: [],
      callLLM: callClaude,
    });

    await mergeToBrief(job.projectPath, { ...refreshMeta(job), instructions: result.text });
    updateStep(job, "instructions", "completed", `${result.meta.charCount} chars generated`);
  } catch (err) {
    job.errors.push(`instructions: ${err.message}`);
    updateStep(job, "instructions", "failed", err.message);
  }
}

/**
 * Worker 3: Generate Eval Stubs
 * Creates minimal eval stub sets from brief capabilities/boundaries.
 * Full eval generation is delegated to the eval-guide plugin during /mcs-research
 * Phase C (QA Challenger uses /eval-suite-planner + /eval-generator).
 * This worker only produces deterministic stubs for the wizard fast-preview flow.
 */
async function enrichEvals(job) {
  updateStep(job, "evals", "running");
  try {
    const brief = readBrief(job.projectPath);
    if (!brief) throw new Error("agentspec.json not found");

    const result = await generateEvalStubs({
      brief,
      setBy: SOURCES.ENRICHMENT,
      sourceFiles: [],
    });

    await mergeToBrief(job.projectPath, {
      ...refreshMeta(job),
      evalSets: result.evalSets,
      workflow: { evalStubsGeneratedAt: new Date().toISOString() },
    });

    updateStep(job, "evals", "completed",
      `${result.meta.totalTests} stubs in ${result.meta.setCount} sets (full generation via eval-guide plugin)`);
  } catch (err) {
    job.errors.push(`evals: ${err.message}`);
    updateStep(job, "evals", "failed", err.message);
  }
}


/**
 * Worker 4: Component Research (Priority 5-6 only)
 * Quick lookup for external systems not covered by the knowledge index.
 */
async function enrichResearch(job) {
  updateStep(job, "research", "running");
  try {
    const brief = readBrief(job.projectPath);
    if (!brief) throw new Error("agentspec.json not found");

    const result = await generateResearch({
      brief,
      setBy: SOURCES.ENRICHMENT,
      sourceFiles: [],
    });

    // Persist auto-added integrations first so downstream readers see them.
    if (result.workIqAdded.length > 0) {
      await mergeToBrief(job.projectPath, {
        ...refreshMeta(job),
        integrations: result.integrations,
      });
      notifyListeners(job, {
        type: "info",
        message: `Auto-added ${result.workIqAdded.join(" + ")} for M365 data access`,
      });
    }

    if (result.needsResearch.length === 0) {
      updateStep(job, "research", "completed",
        result.meta.hasM365
          ? "Work IQ auto-added; all integrations resolved"
          : "All integrations resolved from cache");
      return;
    }

    await mergeToBrief(job.projectPath, {
      ...refreshMeta(job),
      recommendations: [
        ...(brief.recommendations || []),
        ...result.recommendations,
      ],
    });

    updateStep(job, "research", "completed",
      `${result.needsResearch.length} items flagged for manual research`);
  } catch (err) {
    job.errors.push(`research: ${err.message}`);
    updateStep(job, "research", "failed", err.message);
  }
}

// ---------------------------------------------------------------------------
// Worker 5: Delta Document Extraction (new/changed docs only)
// ---------------------------------------------------------------------------

const { extractContent } = require("./documents");

/**
 * Extract new capabilities, integrations, and knowledge from delta documents.
 * Only processes files in deltaFiles — does NOT re-read existing brief content.
 */
async function enrichFromDocs(job, deltaFiles, projectDir) {
  updateStep(job, "docExtract", "running", `Processing ${deltaFiles.length} document(s)`);
  try {
    const brief = readBrief(job.projectPath);
    if (!brief) throw new Error("agentspec.json not found");

    const docsDir = path.join(projectDir, "docs");

    // Read each delta file's content
    const docContents = [];
    for (const filename of deltaFiles) {
      const fp = path.join(docsDir, filename);
      if (!fs.existsSync(fp)) continue;
      const { content, error } = await extractContent(fp);
      if (error || !content) {
        dev.info("enrichment", `Skipping ${filename}: ${error || "no content"}`);
        continue;
      }
      // Truncate very large docs to avoid blowing context
      const truncated = content.length > 50000 ? content.slice(0, 50000) + "\n\n[... truncated]" : content;
      docContents.push({ filename, content: truncated });
    }

    if (docContents.length === 0) {
      updateStep(job, "docExtract", "completed", "No readable content in delta files");
      return;
    }

    const existingCaps = (brief.capabilities || []).map((c) => c.name).join(", ");
    const existingInteg = (brief.integrations || []).map((i) => i.name).join(", ");
    const existingKnowledge = (brief.knowledge || []).map((k) => k.name || k.source).join(", ");

    const systemPrompt = `You are analyzing new documents for an existing Microsoft Copilot Studio agent brief. Extract ONLY items not already present in the brief.

Current agent: "${brief.agent?.name || "Agent"}"
Existing capabilities: ${existingCaps || "none"}
Existing integrations: ${existingInteg || "none"}
Existing knowledge sources: ${existingKnowledge || "none"}

From the documents below, extract:
1. NEW capabilities not already in the brief — include name, description, implementationType (prompt/action/flow)
2. NEW integrations/systems mentioned — include name, type, purpose
3. NEW knowledge source candidates — include name, source type, description
4. CONTRADICTIONS with existing brief data — flag as warnings with explanation

Rules:
- Do NOT repeat items already listed above
- Set source: "from-docs" on all new items
- Be selective — only extract clearly defined agent capabilities, not every topic mentioned
- Return ONLY valid JSON, no markdown

Output format:
{
  "capabilities": [{ "name": "...", "description": "...", "implementationType": "prompt", "source": "from-docs", "phase": "mvp" }],
  "integrations": [{ "name": "...", "type": "connector|mcp|api", "purpose": "...", "source": "from-docs" }],
  "knowledge": [{ "name": "...", "sourceType": "sharepoint|website|file", "description": "...", "source": "from-docs" }],
  "warnings": ["..."]
}`;

    const docsText = docContents
      .map((d) => `--- ${d.filename} ---\n${d.content}`)
      .join("\n\n");

    const response = await callClaude(systemPrompt, docsText);

    // Parse response
    let extracted;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(response);
    } catch {
      dev.error("enrichment", "Failed to parse doc extraction response");
      extracted = { capabilities: [], integrations: [], knowledge: [], warnings: [] };
    }

    // Build the merge patch — append-only
    const patch = {};
    const now = new Date().toISOString();
    const sourceFiles = docContents.map((d) => d.filename);

    if (extracted.capabilities?.length > 0) {
      const newCaps = extracted.capabilities.map((c) => ({
        ...c,
        source: "from-docs",
        phase: c.phase || "mvp",
        _provenance: { sourceFiles, extractedAt: now },
      }));
      patch.capabilities = [...(brief.capabilities || []), ...newCaps];
    }

    if (extracted.integrations?.length > 0) {
      const newInteg = extracted.integrations.map((i) => ({
        ...i,
        source: "from-docs",
        status: "needs-setup",
        phase: "mvp",
        _provenance: { sourceFiles, extractedAt: now },
      }));
      patch.integrations = [...(brief.integrations || []), ...newInteg];
    }

    if (extracted.knowledge?.length > 0) {
      const newKnowledge = extracted.knowledge.map((k) => ({
        ...k,
        source: "from-docs",
        _provenance: { sourceFiles, extractedAt: now },
      }));
      patch.knowledge = [...(brief.knowledge || []), ...newKnowledge];
    }

    if (Object.keys(patch).length > 0) {
      await mergeToBrief(job.projectPath, { ...refreshMeta(job), ...patch });
    }

    const summary = [
      extracted.capabilities?.length ? `${extracted.capabilities.length} capabilities` : null,
      extracted.integrations?.length ? `${extracted.integrations.length} integrations` : null,
      extracted.knowledge?.length ? `${extracted.knowledge.length} knowledge sources` : null,
    ].filter(Boolean).join(", ");

    const warnings = extracted.warnings || [];
    if (warnings.length > 0) {
      notifyListeners(job, { type: "info", message: `Doc extraction warnings: ${warnings.join("; ")}` });
    }

    updateStep(job, "docExtract", "completed", summary || "No new items found");
  } catch (err) {
    job.errors.push(`docExtract: ${err.message}`);
    updateStep(job, "docExtract", "failed", err.message);
  }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Start background enrichment for an agent brief.
 * Returns immediately with the job handle — workers run asynchronously.
 *
 * @param {string} agentDir  Full path to agent directory containing brief.json
 * @param {Object} [options]
 * @param {string[]} [options.deltaFiles]  New/changed doc filenames for delta processing
 * @param {string}   [options.projectDir]  Project folder (for reading docs/)
 * @param {Function} [options.onComplete]  Callback after all workers finish
 * @returns {EnrichmentJob} Job handle for tracking progress via SSE
 */
function startEnrichment(agentDir, options = {}) {
  const job = createJob(agentDir);
  const { deltaFiles, projectDir, onComplete, forceRefresh } = options;
  const isDelta = Array.isArray(deltaFiles) && deltaFiles.length > 0 && projectDir;
  if (forceRefresh) job.forceRefresh = true;

  // Add docExtract step to job if delta mode
  if (isDelta) {
    job.steps.docExtract = { status: "pending", label: "Extracting from new documents" };
  }

  dev.info("enrichment", `Starting ${isDelta ? "delta" : "full"} job ${job.id} for ${agentDir}`);

  // Fire-and-forget: run workers in background, don't block the caller
  (async () => {
    try {
      if (isDelta) {
        // Delta mode: extract from docs first, then run dependent workers
        await enrichFromDocs(job, deltaFiles, projectDir);

        // Run remaining workers (scoring always, others conditionally)
        const brief = readBrief(agentDir);
        const skipInstructions = brief?._provenance?.instructions?.lastSetBy === "user" && !forceRefresh;

        const workers = [enrichScoring(job), enrichResearch(job)];
        if (!skipInstructions) workers.push(enrichInstructions(job));
        workers.push(enrichEvals(job));
        await Promise.all(workers);
      } else {
        // Full mode: all 4 workers in parallel (original behavior)
        await Promise.all([
          enrichScoring(job),
          enrichInstructions(job),
          enrichEvals(job),
          enrichResearch(job),
        ]);
      }

      job.status = job.errors.length > 0 ? "completed_with_errors" : "completed";
      job.completedAt = new Date().toISOString();
      notifyListeners(job, { type: "done", status: job.status, errors: job.errors });
      dev.info("enrichment", `Job ${job.id} ${job.status} (${job.errors.length} errors)`);

      if (typeof onComplete === "function") {
        try { onComplete(job); } catch (e) { dev.error("enrichment", "onComplete error", e.message); }
      }
    } catch (err) {
      job.status = "failed";
      job.completedAt = new Date().toISOString();
      job.errors.push(err.message);
      notifyListeners(job, { type: "done", status: "failed", errors: job.errors });
      dev.error("enrichment", `Job ${job.id} failed`, err.message);
    }
  })();

  return job;
}

/**
 * Get a running or completed job by ID.
 */
function getJob(jobId) {
  return _jobs.get(jobId) || null;
}

/**
 * Get all jobs (for debugging).
 */
function getAllJobs() {
  return Array.from(_jobs.values());
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  startEnrichment,
  getJob,
  getAllJobs,
  createJob,
};
