#!/usr/bin/env node
/**
 * MCS Agent Builder — Express.js Server
 *
 * Port of server.py — single process serving:
 *   - REST API for project/agent/document CRUD
 *   - Pre-built React SPA (app/dist/)
 *   - WebSocket terminal (node-pty) on /ws path
 *
 * No Python dependency. No separate terminal sidecar.
 *
 * Usage: node app/server.js
 *   env PORT=8000 (default)
 *   env BUILD_GUIDES=/path/to/projects (default: ~/MCS-Agent-Builder)
 */

const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const cors = require("cors");
const multer = require("multer");
const { execFileSync, exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);
const fs = require("fs");
const path = require("path");
const os = require("os");

let attachTerminal;
try {
  ({ attachTerminal } = require("./lib/terminal"));
} catch (e) {
  console.warn("[server] Terminal unavailable (node-pty not installed). Dashboard will work but terminal sessions will fail.");
  console.warn("[server] Fix: npm install @homebridge/node-pty-prebuilt-multiarch");
  attachTerminal = () => {}; // no-op — WebSocket connections will be accepted but no PTY spawned
}
const { migrateBrief } = require("./lib/brief-migrate");
const { convertDocument, extractContent, NEEDS_CONVERSION } = require("./lib/documents");
const { isWorkIQAvailable, checkWorkIQAuth, runQueriesBatched, buildQueries, deduplicateDocuments, assembleContextFileIncremental, extractSharePointUrls, downloadAndConvertFiles, escapeMd } = require("./lib/workiq");
const {
  ensureDirs,
  listProjects,
  getProject,
  getDocStatus,
  markDocsProcessed,
  humanizeName,
} = require("./lib/projects");
const { handleWizardChat, handleWizardSave, handleWizardPrefetch } = require("./lib/wizard");
const { startEnrichment, getJob } = require("./lib/enrichment");
const buildRunner = require("./lib/build-runner");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const SCRIPT_DIR = __dirname;
const BASE_DIR = path.resolve(SCRIPT_DIR, "..");
const DIST_DIR = path.join(SCRIPT_DIR, "dist");

// Build-Guides location: env var > config file > ~/MCS-Agent-Builder
function resolveBuildGuides() {
  if (process.env.BUILD_GUIDES) return process.env.BUILD_GUIDES;

  const configFile = path.join(os.homedir(), ".mcs-agent-builder", "config.json");
  if (fs.existsSync(configFile)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configFile, "utf-8"));
      if (cfg.buildGuidesPath) return cfg.buildGuidesPath;
    } catch { /* ignore */ }
  }

  // Default: ~/MCS-Agent-Builder — but also check if running from repo with Build-Guides/
  const repoBG = path.join(BASE_DIR, "Build-Guides");
  if (fs.existsSync(repoBG)) return repoBG;

  return path.join(os.homedir(), "MCS-Agent-Builder");
}

const BUILD_GUIDES = resolveBuildGuides();

// ---------------------------------------------------------------------------
// Express app setup
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT, 10) || 8000;

const app = express();
const server = http.createServer(app);

// CORS: restricted to localhost origins
app.use(
  cors({
    origin: [
      `http://localhost:${PORT}`,
      `http://127.0.0.1:${PORT}`,
      "http://localhost:8080", // Vite dev server
    ],
  })
);

app.use(express.json({ limit: "10mb" }));

// File upload via multer — disk storage, 50MB limit
const upload = multer({
  dest: path.join(os.tmpdir(), "mcs-uploads"),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ---------------------------------------------------------------------------
// WebSocket terminal — same port, /ws path
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ server, path: "/ws" });
attachTerminal(wss, BASE_DIR);

// ---------------------------------------------------------------------------
// Helpers — path safety
// ---------------------------------------------------------------------------

/** Sanitize a route parameter to prevent path traversal */
function safeSlug(param) {
  return param.replace(/[^\w-]/g, "");
}

/** Verify resolved path is within the expected base directory */
function assertWithin(base, target) {
  const resolvedBase = path.resolve(base) + path.sep;
  return path.resolve(target).startsWith(resolvedBase);
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", terminal: wss.clients.size > 0 });
});
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", terminal: wss.clients.size > 0 });
});

// Config — terminal WS is now same port
app.get("/api/config", (req, res) => {
  res.json({ terminalWsUrl: `ws://localhost:${PORT}/ws` });
});

// --- Projects ---

app.get("/api/projects", (req, res) => {
  const projects = listProjects(BUILD_GUIDES);
  res.json({
    generated_at: new Date().toISOString(),
    project_count: projects.length,
    projects,
  });
});

app.get("/api/projects/:projectId", (req, res) => {
  const project = getProject(BUILD_GUIDES, req.params.projectId);
  if (!project) return res.status(404).json({ detail: `Project '${req.params.projectId}' not found` });
  res.json(project);
});

app.post("/api/projects", (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ detail: "Project name required" });

  const folderName = name.replace(/ /g, "-").replace(/[^\w-]/g, "");
  if (!folderName) return res.status(400).json({ detail: "Invalid project name" });

  const folder = path.join(BUILD_GUIDES, folderName);
  if (fs.existsSync(folder)) {
    return res.json({
      id: folderName,
      name: humanizeName(folderName),
      path: `Build-Guides/${folderName}`,
      existed: true,
    });
  }

  fs.mkdirSync(path.join(folder, "docs"), { recursive: true });

  res.json({
    id: folderName,
    name: humanizeName(folderName),
    path: `Build-Guides/${folderName}`,
    existed: false,
  });
});

app.delete("/api/projects/:projectId", (req, res) => {
  const projectId = safeSlug(req.params.projectId);
  const folder = path.join(BUILD_GUIDES, projectId);
  if (!assertWithin(BUILD_GUIDES, folder) || !fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    return res.status(404).json({ detail: `Project '${projectId}' not found` });
  }
  fs.rmSync(folder, { recursive: true, force: true });
  res.json({ deleted: true, project_id: projectId });
});

// --- Agents ---

app.get("/api/projects/:projectId/agents/:agentId", (req, res) => {
  const agentDir = path.join(BUILD_GUIDES, req.params.projectId, "agents", req.params.agentId);
  if (!fs.existsSync(agentDir) || !fs.statSync(agentDir).isDirectory()) {
    return res.status(404).json({ detail: `Agent '${req.params.agentId}' not found` });
  }

  const briefFile = path.join(agentDir, "brief.json");
  let brief = null;
  if (fs.existsSync(briefFile)) {
    try {
      const raw = fs.readFileSync(briefFile, "utf-8").replace(/^\uFEFF/, "");
      brief = JSON.parse(raw);
      // Auto-migrate v1 → v2 on read
      if (brief && brief.step1 && !brief.agent) {
        brief = migrateBrief(brief);
        fs.writeFileSync(briefFile, JSON.stringify(brief, null, 2), "utf-8");
      }
    } catch { /* ignore */ }
  }

  let name;
  if (brief && (brief.agent || {}).name) {
    name = brief.agent.name;
  } else if (brief && (brief.step1 || {}).agentName) {
    name = brief.step1.agentName;
  } else {
    name = humanizeName(req.params.agentId);
  }

  let fileMtime = null;
  if (fs.existsSync(briefFile)) {
    fileMtime = new Date(fs.statSync(briefFile).mtimeMs).toISOString();
  }

  res.json({
    id: req.params.agentId,
    name,
    brief,
    _file_mtime: fileMtime,
    has_instructions: brief ? !!brief.instructions : false,
    has_evals: fs.existsSync(path.join(agentDir, "evals.csv")),
    has_build_report: fs.existsSync(path.join(agentDir, "build-report.md")),
  });
});

app.put("/api/projects/:projectId/agents/:agentId/state", (req, res) => {
  const folder = path.join(BUILD_GUIDES, req.params.projectId);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    return res.status(404).json({ detail: `Project '${req.params.projectId}' not found` });
  }

  const agentDir = path.join(folder, "agents", req.params.agentId);
  fs.mkdirSync(agentDir, { recursive: true });

  const stateFile = path.join(agentDir, "brief.json");
  let existing = {};
  if (fs.existsSync(stateFile)) {
    try {
      const raw = fs.readFileSync(stateFile, "utf-8").replace(/^\uFEFF/, "");
      existing = JSON.parse(raw);
    } catch { /* ignore */ }
  }

  Object.assign(existing, req.body);
  existing.updated_at = new Date().toISOString();

  fs.writeFileSync(stateFile, JSON.stringify(existing, null, 2), "utf-8");
  res.json({ saved: true });
});

app.post("/api/projects/:projectId/agents/:agentId/scaffold-children", (req, res) => {
  const folder = path.join(BUILD_GUIDES, req.params.projectId);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    return res.status(404).json({ detail: `Project '${req.params.projectId}' not found` });
  }

  const agentDir = path.join(folder, "agents", req.params.agentId);
  const briefFile = path.join(agentDir, "brief.json");
  if (!fs.existsSync(briefFile)) {
    return res.status(404).json({ detail: `Agent '${req.params.agentId}' has no brief.json` });
  }

  let brief;
  try {
    const raw = fs.readFileSync(briefFile, "utf-8").replace(/^\uFEFF/, "");
    brief = JSON.parse(raw);
  } catch (e) {
    return res.status(500).json({ detail: `Failed to read brief: ${e.message}` });
  }

  const children = ((brief.architecture || {}).children || []);
  if (!children.length) {
    return res.json({ created: [], message: "No children defined in architecture" });
  }

  const created = [];
  const agentsDir = path.join(folder, "agents");
  fs.mkdirSync(agentsDir, { recursive: true });

  for (const child of children) {
    if (child.agentFolderId) continue;

    const childName = (child.name || "").trim();
    if (!childName) continue;

    let folderName = childName.toLowerCase().replace(/ /g, "-").replace(/[^\w-]/g, "");
    if (!folderName) folderName = `agent-${created.length + 1}`;

    const baseName = folderName;
    let counter = 1;
    while (fs.existsSync(path.join(agentsDir, folderName))) {
      folderName = `${baseName}-${counter}`;
      counter++;
    }

    const childDir = path.join(agentsDir, folderName);
    fs.mkdirSync(childDir, { recursive: true });

    const childBrief = {
      _schema: "2.0",
      agent: {
        name: childName,
        description: child.role || "",
        persona: "",
        responseFormat: "",
        primaryUsers: "",
        secondaryUsers: "",
      },
      business: {
        useCase: child.role || "",
        problemStatement: "",
        challenges: [],
        benefits: [],
        successCriteria: [],
        stakeholders: { sponsor: "", owner: "", users: "" },
      },
      architecture: {
        type: "single-agent",
        reason: `Specialist agent — child of ${(brief.agent || {}).name || req.params.agentId}`,
      },
      updated_at: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(childDir, "brief.json"),
      JSON.stringify(childBrief, null, 2),
      "utf-8"
    );

    child.agentFolderId = folderName;
    created.push(folderName);
  }

  // Save parent brief with updated agentFolderIds
  brief.updated_at = new Date().toISOString();
  fs.writeFileSync(briefFile, JSON.stringify(brief, null, 2), "utf-8");

  res.json({ created, message: `Created ${created.length} agent folder(s)` });
});

app.delete("/api/projects/:projectId/agents/:agentId", (req, res) => {
  const projectId = safeSlug(req.params.projectId);
  const agentId = safeSlug(req.params.agentId);
  const agentDir = path.join(BUILD_GUIDES, projectId, "agents", agentId);
  if (!assertWithin(BUILD_GUIDES, agentDir) || !fs.existsSync(agentDir) || !fs.statSync(agentDir).isDirectory()) {
    return res.status(404).json({ detail: `Agent '${agentId}' not found` });
  }
  fs.rmSync(agentDir, { recursive: true, force: true });
  res.json({ deleted: true, agent_id: agentId });
});

// --- Documents ---

app.post("/api/projects/:projectId/upload", upload.single("file"), async (req, res) => {
  const folder = path.join(BUILD_GUIDES, req.params.projectId);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    return res.status(404).json({ detail: `Project '${req.params.projectId}' not found` });
  }

  if (!req.file) return res.status(400).json({ detail: "No file uploaded" });

  ensureDirs(folder);
  const docsDir = path.join(folder, "docs");

  const originalName = req.file.originalname || "upload";
  const ext = path.extname(originalName).toLowerCase();
  const safeBase = path.basename(originalName, path.extname(originalName))
    .toLowerCase()
    .replace(/[^\w-]/g, "_");
  const rawName = `${safeBase}${ext}`;
  const rawPath = path.join(docsDir, rawName);

  // Move uploaded temp file to docs/
  fs.renameSync(req.file.path, rawPath);

  let finalName = rawName;
  let conversionError = null;

  if (NEEDS_CONVERSION.has(ext)) {
    const result = await convertDocument(rawPath, docsDir);
    if (result.error && !result.convertedName) {
      // Encrypted file — delete and return error
      if (result.error.includes("encrypted")) {
        try { fs.unlinkSync(rawPath); } catch { /* ignore */ }
        return res.status(422).json({ detail: result.error });
      }
      conversionError = result.error;
    }
    if (result.convertedName) {
      finalName = result.convertedName;
    }
  }

  const briefOutdated = fs.existsSync(path.join(folder, "doc-manifest.json"));
  const stat = fs.existsSync(path.join(docsDir, finalName))
    ? fs.statSync(path.join(docsDir, finalName))
    : null;

  res.json({
    uploaded: true,
    filename: finalName,
    conversionError,
    size: stat ? stat.size : req.file.size,
    mtime: stat ? stat.mtimeMs : Date.now(),
    path: `Build-Guides/${req.params.projectId}/docs/${finalName}`,
    briefOutdated,
  });
});

app.post("/api/projects/:projectId/paste", (req, res) => {
  const folder = path.join(BUILD_GUIDES, req.params.projectId);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    return res.status(404).json({ detail: `Project '${req.params.projectId}' not found` });
  }

  ensureDirs(folder);
  const text = (req.body.text || "").trim();
  const title = (req.body.title || "").trim() || "pasted-context";

  if (!text) return res.status(400).json({ detail: "No text provided" });

  const safeBase = title.toLowerCase().replace(/ /g, "-").replace(/[^\w-]/g, "_");
  const docsDir = path.join(folder, "docs");

  let mdName = `${safeBase}.md`;
  let mdPath = path.join(docsDir, mdName);
  let counter = 1;
  while (fs.existsSync(mdPath)) {
    mdName = `${safeBase}-${counter}.md`;
    mdPath = path.join(docsDir, mdName);
    counter++;
  }

  const heading = title.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  fs.writeFileSync(mdPath, `# ${heading}\n\n${text}`, "utf-8");

  res.json({
    saved: true,
    filename: mdName,
    size: text.length,
    path: `Build-Guides/${req.params.projectId}/docs/${mdName}`,
  });
});

app.get("/api/projects/:projectId/doc-status", (req, res) => {
  const result = getDocStatus(BUILD_GUIDES, req.params.projectId);
  if (!result) {
    return res.status(404).json({ detail: `Project '${req.params.projectId}' not found` });
  }
  res.json(result);
});

app.post("/api/projects/:projectId/mark-processed", (req, res) => {
  const folder = path.join(BUILD_GUIDES, req.params.projectId);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    return res.status(404).json({ detail: `Project '${req.params.projectId}' not found` });
  }

  const filenames = req.body.filenames;
  if (!Array.isArray(filenames) || filenames.length === 0) {
    return res.status(400).json({ detail: "filenames array required" });
  }

  try {
    markDocsProcessed(folder, filenames, {
      source: req.body.source || "enrichment",
      matchedAgents: req.body.agentId ? [req.body.agentId] : [],
    });
    const result = getDocStatus(BUILD_GUIDES, req.params.projectId);
    res.json({ marked: filenames.length, ...result });
  } catch (e) {
    res.status(500).json({ detail: `Failed to mark docs: ${e.message}` });
  }
});

app.get("/api/projects/:projectId/docs/:filename/raw", (req, res) => {
  const folder = path.join(BUILD_GUIDES, req.params.projectId);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    return res.status(404).json({ detail: `Project '${req.params.projectId}' not found` });
  }

  const safe = req.params.filename.replace(/[^\w\-.]/g, "_");
  let target = path.join(folder, "docs", safe);
  if (!fs.existsSync(target)) target = path.join(folder, safe);
  if (!fs.existsSync(target)) {
    return res.status(404).json({ detail: `File '${safe}' not found` });
  }

  // Path traversal defense — append separator to prevent prefix overlap attacks
  if (!path.resolve(target).startsWith(path.resolve(folder) + path.sep)) {
    return res.status(400).json({ detail: "Invalid file path" });
  }

  res.sendFile(path.resolve(target));
});

app.delete("/api/projects/:projectId/docs/:filename", (req, res) => {
  const folder = path.join(BUILD_GUIDES, req.params.projectId);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    return res.status(404).json({ detail: `Project '${req.params.projectId}' not found` });
  }

  const filename = req.params.filename;
  const docsDir = path.join(folder, "docs");
  const target = path.join(docsDir, filename);

  // Path traversal check
  if (!path.resolve(target).startsWith(path.resolve(docsDir))) {
    return res.status(400).json({ detail: "Invalid file path" });
  }

  if (!fs.existsSync(target)) {
    return res.status(404).json({ detail: `File '${filename}' not found in docs/` });
  }

  fs.unlinkSync(target);
  res.json({ deleted: true, filename });
});

app.get("/api/projects/:projectId/docs/:filename/content", async (req, res) => {
  const folder = path.join(BUILD_GUIDES, req.params.projectId);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    return res.status(404).json({ detail: `Project '${req.params.projectId}' not found` });
  }

  const filename = req.params.filename;
  const docsDir = path.join(folder, "docs");
  const target = path.join(docsDir, filename);

  // Path traversal check
  if (!path.resolve(target).startsWith(path.resolve(docsDir))) {
    return res.status(400).json({ detail: "Invalid file path" });
  }

  if (!fs.existsSync(target)) {
    return res.status(404).json({ detail: `File '${filename}' not found` });
  }

  const result = await extractContent(target);
  res.json({ filename, content: result.content, error: result.error || undefined });
});

// ---------------------------------------------------------------------------
// Pull from M365 via WorkIQ (SSE)
// ---------------------------------------------------------------------------

app.post("/api/projects/:projectId/pull-m365", async (req, res) => {
  const folder = path.join(BUILD_GUIDES, req.params.projectId);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    return res.status(404).json({ detail: `Project '${req.params.projectId}' not found` });
  }

  const customer = (req.body.customer || "").trim();
  const timeRange = req.body.timeRange || "90d";
  const aliases = (req.body.aliases || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!customer) return res.status(400).json({ detail: "Customer name required" });

  const available = await isWorkIQAvailable();
  if (!available) {
    return res.status(503).json({
      detail: "WorkIQ CLI not available. Install WorkIQ and run 'workiq ask -q \"test\"' to authenticate.",
    });
  }

  // Pre-flight auth check — verify session is active before starting SSE
  const authCheck = await checkWorkIQAuth();
  if (!authCheck.ok) {
    return res.status(503).json({
      detail: "WorkIQ session expired. Run 'workiq ask -q \"test\"' in a terminal to re-authenticate, then try again.",
    });
  }

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  let clientDisconnected = false;
  req.on("close", () => { clientDisconnected = true; });

  const sendSSE = (data) => {
    if (clientDisconnected) return;
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch {}
  };

  try {
    const queries = buildQueries(customer, timeRange, aliases);
    sendSSE({ type: "started", total: queries.length, customer });

    // AbortController lets us kill in-flight child processes when auth fails
    const abortController = new AbortController();

    // Run queries in batches of 2 to avoid the Windows WAM broker bug (#71)
    // that crashes after 3+ simultaneous MSAL auth calls in console apps.
    const { results, authAborted } = await runQueriesBatched(queries, {
      batchSize: 2,
      signal: abortController.signal,
      onProgress: (queryId, label, status, completed, total) => {
        sendSSE({ type: "progress", queryId, label, status, completed, total });
      },
    });

    // If auth failed mid-pull, abort remaining queries and end SSE
    if (authAborted) {
      abortController.abort();
      sendSSE({
        type: "error",
        detail: "WorkIQ session expired during pull. Run 'workiq ask -q \"test\"' in a terminal to re-authenticate, then try again.",
      });
      res.end();
      return;
    }
    if (clientDisconnected) {
      res.end();
      return;
    }

    // Minimum success threshold — require at least 3/4 queries to produce content.
    // A mostly-empty context file with 3 "Query failed" sections isn't useful.
    const successCount = results.filter((r) => !r.error && r.content).length;
    const minRequired = Math.max(1, queries.length - 1); // at least N-1 must succeed
    if (successCount < minRequired) {
      const failedLabels = results.filter((r) => r.error).map((r) => `${r.label}: ${r.error}`);
      sendSSE({
        type: "error",
        detail: `Only ${successCount}/${queries.length} queries succeeded (minimum ${minRequired} required). Failed: ${failedLabels.join("; ")}`,
      });
      res.end();
      return;
    }

    // Dedup pass + assemble file
    const dedup = deduplicateDocuments(results);
    ensureDirs(folder);
    const docsDir = path.join(folder, "docs");
    const safeCustomer = customer.toLowerCase().replace(/[^\w-]/g, "_");
    const filename = `workiq-context-${safeCustomer}.md`;
    const filePath = path.join(docsDir, filename);
    // Incremental merge: preserve existing content for sections where new queries failed
    const existingContent = fs.existsSync(filePath)
      ? fs.readFileSync(filePath, "utf-8")
      : null;
    const { content, preserved, replaced } = assembleContextFileIncremental(
      customer, results, timeRange, dedup, existingContent
    );

    if (existingContent && (preserved.length > 0 || replaced.length > 0)) {
      sendSSE({ type: "merge-info", preserved, replaced });
    }

    try {
      fs.writeFileSync(filePath, content, "utf-8");
      const stat = fs.statSync(filePath);
      sendSSE({
        type: "done",
        filename,
        size: stat.size,
        successCount: results.filter((r) => !r.error && r.content).length,
        totalQueries: queries.length,
        incremental: !!existingContent,
      });
    } catch (e) {
      sendSSE({ type: "error", detail: `Failed to save context file: ${e.message}` });
    }

    // Phase 2: Download actual files — CLSCMS library search + SharePoint URLs from results
    if (!clientDisconnected) {
      const spUrls = extractSharePointUrls(results);
      try {
        const downloadResults = await downloadAndConvertFiles(spUrls, docsDir, customer, aliases, sendSSE);

        // Append download summary to context file
        const downloaded = downloadResults.filter((r) => !r.error || r.error === "Already exists in docs");
        if (downloaded.length > 0) {
          const appendLines = [
            "",
            "## Downloaded Documents",
            "",
            `> ${downloaded.length} file(s) downloaded and saved to docs/`,
            "",
            "| File | Status |",
            "|------|--------|",
          ];
          for (const d of downloadResults) {
            const status = d.error
              ? (d.error === "Already exists in docs" ? "Skipped (exists)" : `Error: ${d.error}`)
              : (d.converted ? `Converted to ${d.converted}` : "Saved");
            appendLines.push(`| ${escapeMd(d.name)} | ${escapeMd(status)} |`);
          }
          appendLines.push("");
          fs.appendFileSync(filePath, appendLines.join("\n"), "utf-8");
        }
      } catch (e) {
        sendSSE({ type: "download-skipped", reason: `File download failed: ${e.message}` });
      }
    }
  } catch (e) {
    sendSSE({ type: "error", detail: `Unexpected error: ${e.message}` });
  }

  res.end();
});

// ---------------------------------------------------------------------------
// Credential Readiness Check — surface auth issues before build
// ---------------------------------------------------------------------------

// Cache credential results (30s TTL) — CLI calls are expensive and block-free now
let _credCache = { data: null, ts: 0 };
const CRED_CACHE_TTL = 30000;

/** Run a CLI command asynchronously (non-blocking). Returns stdout or throws.
 *  Uses exec (shell) because az/pac are .cmd wrappers on Windows.
 *  Args are always hardcoded constants — no user input passes through. */
async function runCliAsync(cmd, args, timeoutMs = 10000) {
  const command = [cmd, ...args].join(" ");
  const { stdout } = await execAsync(command, {
    timeout: timeoutMs,
    windowsHide: true,
    encoding: "utf-8",
  });
  return stdout;
}

async function gatherCredentials() {
  const results = {
    claude: false,
    az: false,
    dataverse: false,
    ready: false,
    details: {},
    azAccount: null,
    pacProfiles: [],
    pacEnvironments: [],
  };

  // 1. Claude CLI configured? (local file check — instant)
  try {
    const configPath = path.join(os.homedir(), ".claude", "config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      results.claude = !!config.primaryApiKey;
    }
    if (!results.claude && process.env.ANTHROPIC_API_KEY) {
      results.claude = true;
    }
    results.details.claude = results.claude
      ? "Configured"
      : "Run: claude auth login";
  } catch {
    results.details.claude = "Run: claude auth login";
  }

  // 2 + 3: Run az and pac in PARALLEL (non-blocking)
  const [azResult, pacResult] = await Promise.allSettled([
    // Azure CLI account info
    runCliAsync("az", ["account", "show", "--output", "json"], 10000),
    // PAC CLI auth profiles
    runCliAsync("pac", ["auth", "list"], 10000),
  ]);

  // Process Azure result
  if (azResult.status === "fulfilled") {
    try {
      const account = JSON.parse(azResult.value);
      results.az = true;
      results.azAccount = {
        user: account.user?.name || "unknown",
        tenantId: account.tenantId,
        tenantName: account.tenantDisplayName || null,
        tenantDomain: account.tenantDefaultDomain || null,
      };
      results.details.az = `${account.user?.name || "unknown"} (${account.tenantDisplayName || account.tenantId?.substring(0, 8) + "..."})`;
    } catch {
      results.details.az = "Run: az login";
    }
  } else {
    results.details.az = "Run: az login";
  }

  // Process PAC auth list result — column-position parser (output is fixed-width)
  if (pacResult.status === "fulfilled") {
    const allLines = pacResult.value.replace(/\r/g, "").split("\n");
    const header = allLines[0] || "";
    // Detect column start positions from the header row
    const colStarts = {
      kind: header.indexOf("Kind"),
      name: header.indexOf("Name"),
      user: header.indexOf("User"),
      cloud: header.indexOf("Cloud"),
      type: header.indexOf("Type"),
      env: header.indexOf("Environment"),
      envUrl: header.indexOf("Environment Url"),
    };
    const hasColumns = colStarts.kind >= 0 && colStarts.user >= 0;
    const dataLines = allLines.filter((l) => l.trim().startsWith("["));
    for (const line of dataLines) {
      const indexMatch = line.match(/\[(\d+)\]/);
      const active = /\]\s+\*/.test(line);
      if (!indexMatch) continue;
      if (hasColumns) {
        // Slice by column positions — reliable even when fields are empty
        const slice = (from, to) => (to > 0 ? line.substring(from, to) : line.substring(from)).trim();
        results.pacProfiles.push({
          index: parseInt(indexMatch[1]),
          active,
          kind: slice(colStarts.kind, colStarts.name),
          name: slice(colStarts.name, colStarts.user),
          user: slice(colStarts.user, colStarts.cloud),
          cloud: slice(colStarts.cloud, colStarts.type),
          type: slice(colStarts.type, colStarts.env),
          environment: colStarts.envUrl > 0 ? slice(colStarts.env, colStarts.envUrl) : slice(colStarts.env, -1),
          environmentUrl: colStarts.envUrl > 0 ? slice(colStarts.envUrl, -1) : "",
        });
      } else {
        // Fallback: regex extraction for non-standard output
        const userMatch = line.match(/\S+@\S+/);
        results.pacProfiles.push({
          index: parseInt(indexMatch[1]),
          active,
          kind: "UNIVERSAL",
          name: "",
          user: userMatch?.[0] || "",
          cloud: "",
          type: "",
          environment: "",
          environmentUrl: "",
        });
      }
    }
  }

  // 4 + 5: PAC environments + Dataverse token in PARALLEL
  const parallelPhase2 = [];

  // PAC env list (only if we have profiles)
  if (results.pacProfiles.length > 0) {
    parallelPhase2.push(
      runCliAsync("pac", ["env", "list"], 20000)
        .then((envOut) => {
          const envLines = envOut.replace(/\r/g, "").split("\n");
          // Find header line (contains "Environment ID" or "Display Name")
          const headerIdx = envLines.findIndex((l) => l.includes("Environment ID") || l.includes("Display Name"));
          const envHeader = headerIdx >= 0 ? envLines[headerIdx] : "";
          const envColStarts = {
            active: 0,
            name: envHeader.indexOf("Display Name"),
            id: envHeader.indexOf("Environment ID"),
            url: envHeader.indexOf("Environment URL"),
            unique: envHeader.indexOf("Unique Name"),
          };
          const hasEnvColumns = envColStarts.name >= 0 && envColStarts.id >= 0;
          const envDataLines = envLines.slice(headerIdx + 1).filter((l) => l.trim());
          for (const line of envDataLines) {
            if (!line.trim() || line.startsWith("Connected as")) continue;
            const active = line.startsWith("*");
            if (hasEnvColumns) {
              const slice = (from, to) => (to > 0 ? line.substring(from, to) : line.substring(from)).trim();
              const name = slice(envColStarts.name, envColStarts.id);
              const id = slice(envColStarts.id, envColStarts.url > 0 ? envColStarts.url : -1);
              const url = envColStarts.url > 0 ? slice(envColStarts.url, envColStarts.unique > 0 ? envColStarts.unique : -1) : "";
              if (name && id) {
                results.pacEnvironments.push({ active, name, id, url });
              }
            } else {
              // Fallback: split by 2+ spaces
              const clean = line.replace(/^\*?\s*/, "");
              const parts = clean.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
              if (parts.length >= 3) {
                results.pacEnvironments.push({ active, name: parts[0], id: parts[1], url: parts[2] });
              }
            }
          }
        })
        .catch(() => { /* ignore */ })
    );
  }

  // Dataverse token check (only if az is logged in)
  if (results.az) {
    const sessionConfigs = [];
    try {
      const projects = fs.readdirSync(BUILD_GUIDES).filter((d) => {
        const p = path.join(BUILD_GUIDES, d);
        return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, "session-config.json"));
      });
      for (const p of projects) {
        try {
          const sc = JSON.parse(fs.readFileSync(path.join(BUILD_GUIDES, p, "session-config.json"), "utf-8"));
          if (sc.dataverseUrl) sessionConfigs.push(sc);
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    if (sessionConfigs.length > 0) {
      const sc = sessionConfigs[0];
      parallelPhase2.push(
        runCliAsync("az", ["account", "get-access-token", "--resource", sc.dataverseUrl, "--output", "json"], 15000)
          .then((tokenOut) => {
            const token = JSON.parse(tokenOut);
            results.dataverse = !!token.accessToken;
            results.details.dataverse = `Token valid for ${sc.dataverseUrl}`;
          })
          .catch(() => {
            results.details.dataverse = `Token failed for ${sc.dataverseUrl} — run: az login --tenant <tenant>`;
          })
      );
    } else {
      results.details.dataverse = "No session-config.json found — will be checked at build time";
      results.dataverse = null;
    }
  } else {
    results.details.dataverse = "Requires az login first";
  }

  if (parallelPhase2.length > 0) await Promise.all(parallelPhase2);

  // Fallback: if pac env list returned nothing, use the active profile's own environment
  if (results.pacEnvironments.length === 0) {
    const active = results.pacProfiles.find((p) => p.active);
    if (active && active.environment) {
      results.pacEnvironments.push({
        active: true,
        name: active.environment,
        id: "profile-default",
        url: active.environmentUrl || "",
      });
    }
  }

  results.ready = results.claude && results.az;
  return results;
}

app.get("/api/readiness/credentials", async (req, res) => {
  try {
    const now = Date.now();
    const force = req.query.force === "1";
    if (!force && _credCache.data && (now - _credCache.ts) < CRED_CACHE_TTL) {
      return res.json(_credCache.data);
    }
    const results = await gatherCredentials();
    _credCache = { data: results, ts: Date.now() };
    res.json(results);
  } catch (err) {
    console.error("[credentials] Error:", err.message);
    res.status(500).json({ detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// Account Switching — switch PAC profile and/or Azure tenant
// ---------------------------------------------------------------------------

app.post("/api/auth/switch-profile", async (req, res) => {

  const { profileIndex } = req.body;

  if (typeof profileIndex !== "number" || !Number.isInteger(profileIndex) || profileIndex < 0) {
    return res.status(400).json({ detail: "profileIndex (positive integer) required" });
  }

  try {
    // Switch PAC profile — use execFileSync to avoid shell injection
    execFileSync("pac", ["auth", "select", "--index", String(profileIndex)], {
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
    });

    // Read the newly selected profile to get the tenant for az login
    const pacOut = execFileSync("pac", ["auth", "list"], {
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
    });

    // Find the active profile's user to log a message
    const activeLine = pacOut.split("\n").find((l) => l.includes("*"));
    const userMatch = activeLine?.match(/\S+@\S+/);

    // Invalidate caches after profile switch
    _credCache = { data: null, ts: 0 };
    _platformAgentsCache = { data: null, ts: 0 };

    res.json({
      switched: true,
      activeUser: userMatch?.[0] || "unknown",
      message: `Switched to PAC profile [${profileIndex}]. Run 'az login --tenant <tenant>' in terminal if Azure tenant needs switching too.`,
    });
  } catch (err) {
    res.status(500).json({ detail: `Failed to switch profile: ${err.message}` });
  }
});

app.post("/api/auth/switch-environment", async (req, res) => {

  const { environmentId } = req.body;

  if (!environmentId || typeof environmentId !== "string") {
    return res.status(400).json({ detail: "environmentId (string) required" });
  }

  // Validate environmentId is a GUID to prevent injection
  if (!/^[\w-]+$/.test(environmentId)) {
    return res.status(400).json({ detail: "Invalid environmentId format" });
  }

  try {
    execFileSync("pac", ["env", "select", "--environment", environmentId], {
      timeout: 15000,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
    });
    // Invalidate caches after environment switch
    _credCache = { data: null, ts: 0 };
    _platformAgentsCache = { data: null, ts: 0 };

    res.json({ switched: true, environmentId });
  } catch (err) {
    res.status(500).json({ detail: `Failed to switch environment: ${err.message}` });
  }
});

app.delete("/api/auth/profile/:index", async (req, res) => {
  const index = parseInt(req.params.index, 10);
  if (isNaN(index) || index < 1) {
    return res.status(400).json({ detail: "Valid profile index (>= 1) required" });
  }

  try {
    execFileSync("pac", ["auth", "delete", "--index", String(index)], {
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
    });
    // Invalidate caches
    _credCache = { data: null, ts: 0 };
    _platformAgentsCache = { data: null, ts: 0 };

    res.json({ deleted: true, index });
  } catch (err) {
    res.status(500).json({ detail: `Failed to delete profile: ${err.message}` });
  }
});

// ---------------------------------------------------------------------------
// Wizard — Conversational Agent Brief Builder
// ---------------------------------------------------------------------------

app.post("/api/wizard/chat", (req, res) => handleWizardChat(req, res));
app.post("/api/wizard/prefetch", (req, res) => handleWizardPrefetch(req, res));

// ---------------------------------------------------------------------------
// ─── Platform Agents (pac copilot list) ────────────────────────────
// Cache platform agents (60s TTL) — pac copilot list is slow
let _platformAgentsCache = { data: null, ts: 0 };
const PLATFORM_AGENTS_CACHE_TTL = 60000;

app.get("/api/platform/agents", async (req, res) => {
  try {
    const now = Date.now();
    if (_platformAgentsCache.data && (now - _platformAgentsCache.ts) < PLATFORM_AGENTS_CACHE_TTL) {
      return res.json(_platformAgentsCache.data);
    }
    const pacOut = await runCliAsync("pac", ["copilot", "list"], 30000);
    // Parse column-aligned text table: Name | Copilot ID | Component State | ...
    const lines = pacOut.split("\n").map((l) => l.trimEnd());
    // Find the header line (contains "Copilot ID")
    const headerIdx = lines.findIndex((l) => /Copilot ID/i.test(l));
    const agents = [];
    if (headerIdx >= 0) {
      const header = lines[headerIdx];
      // Determine column start positions from the header
      const nameCol = 0;
      const idCol = header.indexOf("Copilot ID");
      const stateCol = header.indexOf("Component State");
      const managedCol = header.indexOf("Is Managed");
      // Parse data rows (everything after header that has a GUID at the ID position)
      for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim() || line.startsWith("Connected")) continue;
        const id = idCol >= 0 ? line.substring(idCol, stateCol > 0 ? stateCol : idCol + 36).trim() : "";
        if (!/^[0-9a-f-]{36}$/i.test(id)) continue;
        agents.push({
          id,
          name: line.substring(nameCol, idCol).trim(),
          status: stateCol >= 0 ? line.substring(stateCol, managedCol > 0 ? managedCol : stateCol + 20).trim().toLowerCase() : "published",
          description: "",
        });
      }
    }
    const result = { agents };
    _platformAgentsCache = { data: result, ts: Date.now() };
    res.json(result);
  } catch (err) {
    // PAC CLI not available or not connected — return empty, not error
    console.warn("[platform/agents] pac copilot list failed:", err.message);
    res.json({ agents: [], error: err.message });
  }
});

// Import a platform agent into a local project
app.post("/api/platform/agents/import", async (req, res) => {
  const { agentName, schemaName } = req.body;
  if (!agentName) return res.status(400).json({ detail: "agentName required" });

  const folderName = agentName.replace(/ /g, "-").replace(/[^\w-]/g, "");
  if (!folderName) return res.status(400).json({ detail: "Invalid agent name" });

  const projectFolder = path.join(BUILD_GUIDES, folderName);
  const existed = fs.existsSync(projectFolder);

  if (!existed) {
    fs.mkdirSync(path.join(projectFolder, "docs"), { recursive: true });
    fs.mkdirSync(path.join(projectFolder, "agents", folderName), { recursive: true });
  }

  // Write a stub brief.json with the agent name for the scaffold
  const agentFolder = path.join(projectFolder, "agents", folderName);
  if (!fs.existsSync(agentFolder)) fs.mkdirSync(agentFolder, { recursive: true });

  const briefPath = path.join(agentFolder, "brief.json");
  if (!fs.existsSync(briefPath)) {
    const brief = {
      agentName,
      schemaName: schemaName || "",
      importedFromPlatform: true,
      importedAt: new Date().toISOString(),
      business: { description: `Imported from Copilot Studio platform agent: ${agentName}` },
    };
    fs.writeFileSync(briefPath, JSON.stringify(brief, null, 2));
  }

  res.json({
    projectId: folderName,
    agentId: folderName,
    existed,
    message: existed
      ? `Project "${agentName}" already exists.`
      : `Created project "${agentName}" from platform agent.`,
  });
});

// Deploy a solution template into a new project
app.post("/api/solutions/deploy", async (req, res) => {
  const { solutionId, solutionName } = req.body;
  if (!solutionName) return res.status(400).json({ detail: "solutionName required" });

  const folderName = solutionName.replace(/ /g, "-").replace(/[^\w-]/g, "");
  if (!folderName) return res.status(400).json({ detail: "Invalid solution name" });

  const projectFolder = path.join(BUILD_GUIDES, folderName);
  const existed = fs.existsSync(projectFolder);

  if (!existed) {
    fs.mkdirSync(path.join(projectFolder, "docs"), { recursive: true });
    fs.mkdirSync(path.join(projectFolder, "agents", folderName), { recursive: true });
  }

  // Read solution details from index if available
  let solutionInfo = null;
  try {
    const indexPath = path.join(__dirname, "..", "knowledge", "solutions", "index.json");
    if (fs.existsSync(indexPath)) {
      const data = JSON.parse(fs.readFileSync(indexPath, "utf8"));
      solutionInfo = (data.solutions || []).find((s) => s.id === solutionId);
    }
  } catch { /* ignore */ }

  // Write a stub brief.json with template reference
  const agentFolder = path.join(projectFolder, "agents", folderName);
  if (!fs.existsSync(agentFolder)) fs.mkdirSync(agentFolder, { recursive: true });

  const briefPath = path.join(agentFolder, "brief.json");
  if (!fs.existsSync(briefPath)) {
    const brief = {
      agentName: solutionName,
      deployedFromTemplate: true,
      templateId: solutionId || "",
      deployedAt: new Date().toISOString(),
      business: {
        description: `Created from solution template: ${solutionName}`,
      },
    };
    fs.writeFileSync(briefPath, JSON.stringify(brief, null, 2));
  }

  res.json({
    projectId: folderName,
    agentId: folderName,
    existed,
    solutionFiles: solutionInfo?.files?.length || 0,
    message: existed
      ? `Project "${solutionName}" already exists.`
      : `Created project "${solutionName}" from template.`,
  });
});

// ─── Solutions / Templates ─────────────────────────────────────────
app.get("/api/solutions", (req, res) => {
  try {
    const indexPath = path.join(__dirname, "..", "knowledge", "solutions", "index.json");
    if (!fs.existsSync(indexPath)) return res.json({ solutions: [] });
    const data = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    const solutions = (data.solutions || []).map((s) => ({
      id: s.id,
      name: s.folderName,
      files: (s.files || []).length,
      agents: (s.agents || []).length,
      tags: s.tags || {},
      hasPresentation: (s.files || []).some((f) => f.type === "presentation"),
      hasSolution: (s.files || []).some((f) => f.type === "solution"),
    }));
    res.json({ solutions });
  } catch (err) {
    console.error("[solutions] Error:", err.message);
    res.json({ solutions: [] });
  }
});

app.get("/api/models", (req, res) => {
  const anthropic = require("../tools/lib/anthropic");
  const openai = require("../tools/lib/openai");
  res.json({
    models: [
      { key: "opus", name: "Claude Opus 4.6", available: anthropic.isConfigured() },
      { key: "sonnet", name: "Claude Sonnet 4.6", available: anthropic.isConfigured() },
      { key: "gpt-5.4", name: "GPT-5.4", available: openai.isConfigured() },
    ],
    default: "opus",
  });
});

app.post("/api/wizard/save", (req, res) =>
  handleWizardSave(req, res, BUILD_GUIDES)
);

// ---------------------------------------------------------------------------
// Enrichment — Background brief enrichment after wizard save
// ---------------------------------------------------------------------------

app.post("/api/enrichment/start", (req, res) => {
  const { projectId, agentId } = req.body || {};
  if (!projectId || !agentId) {
    return res.status(400).json({ error: "projectId and agentId required" });
  }

  const agentDir = path.join(BUILD_GUIDES, projectId, "agents", agentId);
  const briefPath = path.join(agentDir, "brief.json");
  if (!fs.existsSync(briefPath)) {
    return res.status(404).json({ error: "brief.json not found" });
  }

  // startEnrichment returns immediately — workers run in background
  const projectDir = path.join(BUILD_GUIDES, projectId);
  const job = startEnrichment(agentDir, {
    onComplete: () => {
      // Mark all current docs as processed after full enrichment
      try {
        const docsDir = path.join(projectDir, "docs");
        if (fs.existsSync(docsDir)) {
          const allDocs = fs.readdirSync(docsDir).filter((f) => {
            const ext = path.extname(f).toLowerCase();
            return fs.statSync(path.join(docsDir, f)).isFile() && [".md",".csv",".json",".txt",".pdf",".docx",".pptx",".xlsx",".xls",".jpg",".jpeg",".png"].includes(ext);
          });
          if (allDocs.length > 0) {
            markDocsProcessed(projectDir, allDocs, { source: "enrichment", matchedAgents: [agentId] });
            console.log(`[enrichment] Marked ${allDocs.length} docs as processed (full enrichment)`);
          }
        }
      } catch (e) {
        console.error(`[enrichment] Failed to update manifest after full enrichment: ${e.message}`);
      }
    },
  });
  res.json({ jobId: job.id, status: job.status });
});

// Delta enrichment — process only new/changed documents
app.post("/api/enrichment/delta", (req, res) => {
  const { projectId, agentId } = req.body || {};
  if (!projectId || !agentId) {
    return res.status(400).json({ error: "projectId and agentId required" });
  }

  const projectDir = path.join(BUILD_GUIDES, projectId);
  const agentDir = path.join(projectDir, "agents", agentId);
  const briefPath = path.join(agentDir, "brief.json");
  if (!fs.existsSync(briefPath)) {
    return res.status(404).json({ error: "brief.json not found" });
  }

  // Find new/changed docs from manifest comparison
  const docStatus = getDocStatus(BUILD_GUIDES, projectId);
  const deltaFiles = [...(docStatus?.newDocs || []), ...(docStatus?.changedDocs || [])];

  if (deltaFiles.length === 0) {
    return res.json({ jobId: null, status: "no_delta", message: "No new or changed documents to process" });
  }

  // Start delta enrichment with manifest update on completion
  const job = startEnrichment(agentDir, {
    deltaFiles,
    projectDir,
    onComplete: () => {
      try {
        markDocsProcessed(projectDir, deltaFiles, {
          source: "enrichment",
          matchedAgents: [agentId],
        });
        console.log(`[enrichment] Marked ${deltaFiles.length} docs as processed`);
      } catch (e) {
        console.error(`[enrichment] Failed to update manifest: ${e.message}`);
      }
    },
  });

  res.json({ jobId: job.id, status: job.status, deltaFiles });
});

app.get("/api/enrichment/status/:jobId", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  // SSE stream
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Send current state immediately
  res.write(`data: ${JSON.stringify({ type: "state", steps: job.steps, status: job.status, errors: job.errors })}\n\n`);

  // If already done, close
  if (job.status !== "running") {
    res.write(`data: ${JSON.stringify({ type: "done", status: job.status, errors: job.errors })}\n\n`);
    return res.end();
  }

  // Subscribe to live updates
  const listener = (event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (event.type === "done") {
        res.end();
      }
    } catch { /* client disconnected */ }
  };
  job.listeners.push(listener);

  req.on("close", () => {
    const idx = job.listeners.indexOf(listener);
    if (idx >= 0) job.listeners.splice(idx, 1);
  });
});

// Speculative enrichment — starts enrichment from draft before save
app.post("/api/enrichment/speculative", (req, res) => {
  const { draft, agentName } = req.body || {};
  if (!draft) {
    return res.status(400).json({ error: "draft required" });
  }

  try {
    const { draftToBrief } = require("./lib/wizard");
    const brief = draftToBrief(draft, agentName || "Speculative Agent");

    // Create a temp directory with brief.json for the enrichment workers
    const tmpDir = path.join(os.tmpdir(), `mcs-speculative-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "brief.json"), JSON.stringify(brief, null, 2));

    const job = startEnrichment(tmpDir);
    // Tag the job as speculative so reconcile can find the temp dir
    job._speculative = true;
    job._tmpDir = tmpDir;

    res.json({ jobId: job.id, status: job.status });
  } catch (err) {
    console.error("[enrichment] Speculative start error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Reconcile speculative enrichment into a real agent's brief
app.post("/api/enrichment/reconcile", (req, res) => {
  const { speculativeJobId, projectId, agentId } = req.body || {};
  if (!speculativeJobId || !projectId || !agentId) {
    return res.status(400).json({ error: "speculativeJobId, projectId, and agentId required" });
  }

  const specJob = getJob(speculativeJobId);
  if (!specJob || !specJob._speculative) {
    return res.status(404).json({ error: "Speculative job not found" });
  }

  try {
    const agentDir = path.join(BUILD_GUIDES, projectId, "agents", agentId);
    const targetBrief = path.join(agentDir, "brief.json");
    const specBrief = path.join(specJob._tmpDir, "brief.json");

    if (!fs.existsSync(targetBrief) || !fs.existsSync(specBrief)) {
      return res.status(404).json({ error: "Brief files not found" });
    }

    // Read both briefs and merge speculative enrichment results into the real one
    const target = JSON.parse(fs.readFileSync(targetBrief, "utf8"));
    const spec = JSON.parse(fs.readFileSync(specBrief, "utf8"));

    // Merge enrichment-specific fields (instructions, evals, scores) — don't overwrite core brief
    if (spec.instructions && !target.instructions) target.instructions = spec.instructions;
    if (spec.evalSets && (!target.evalSets || target.evalSets.length === 0)) target.evalSets = spec.evalSets;
    if (spec.scoring && !target.scoring) target.scoring = spec.scoring;
    if (spec.research && !target.research) target.research = spec.research;

    fs.writeFileSync(targetBrief, JSON.stringify(target, null, 2));

    // Cleanup temp dir
    fs.rmSync(specJob._tmpDir, { recursive: true, force: true });

    res.json({ reconciled: true, enrichedFields: ["instructions", "evalSets", "scoring", "research"].filter((k) => spec[k]) });
  } catch (err) {
    console.error("[enrichment] Reconcile error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Build Runner — Headless agent build with progress tracking
// ---------------------------------------------------------------------------

app.post("/api/build/start", (req, res) => {
  const { projectId, agentId } = req.body || {};
  if (!projectId || !agentId) {
    return res.status(400).json({ error: "projectId and agentId required" });
  }

  // Validate inputs are safe path segments
  if (!/^[\w-]+$/.test(projectId) || !/^[\w-]+$/.test(agentId)) {
    return res.status(400).json({ error: "Invalid projectId or agentId format" });
  }

  const briefPath = path.join(BUILD_GUIDES, projectId, "agents", agentId, "brief.json");
  if (!fs.existsSync(briefPath)) {
    return res.status(404).json({ error: "brief.json not found" });
  }

  const baseDir = path.resolve(path.join(__dirname, ".."));
  const job = buildRunner.startBuild(projectId, agentId, baseDir);
  res.json({ jobId: job.id, status: job.status });
});

app.get("/api/build/status/:jobId", (req, res) => {
  const job = buildRunner.getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Build job not found" });
  }

  // SSE stream
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Send current state immediately
  res.write(`data: ${JSON.stringify({
    type: "state",
    steps: job.steps,
    status: job.status,
    errors: job.errors,
    authPrompt: job.authPrompt,
  })}\n\n`);

  // If already done, close
  if (job.status === "completed" || job.status === "failed") {
    res.write(`data: ${JSON.stringify({
      type: "done",
      status: job.status,
      errors: job.errors,
      steps: job.steps,
    })}\n\n`);
    return res.end();
  }

  // Subscribe to live updates
  const listener = (event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (event.type === "done") {
        res.end();
      }
    } catch { /* client disconnected */ }
  };
  job.listeners.push(listener);

  req.on("close", () => {
    const idx = job.listeners.indexOf(listener);
    if (idx >= 0) job.listeners.splice(idx, 1);
  });
});

app.post("/api/build/:jobId/auth-complete", (req, res) => {
  const result = buildRunner.resumeAfterAuth(req.params.jobId);
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

app.get("/api/build/log/:jobId", (req, res) => {
  const log = buildRunner.getJobLog(req.params.jobId);
  if (log === null) {
    return res.status(404).json({ error: "Build job not found" });
  }
  res.type("text/plain").send(log);
});

app.get("/api/build/jobs", (req, res) => {
  res.json({ jobs: buildRunner.getAllJobs() });
});

// ---------------------------------------------------------------------------
// Skill Runner — Generalized headless skill execution (research/eval/fix/build)
// ---------------------------------------------------------------------------

const skillRunner = require("./lib/skill-runner");

/** Map skill type to slash command. agentId may be empty for project-level commands. */
function buildSkillCommand(skillType, projectId, agentId) {
  switch (skillType) {
    case "research": return agentId ? `/mcs-research ${projectId} ${agentId}` : `/mcs-research ${projectId}`;
    case "eval": return `/mcs-eval ${projectId} ${agentId}`;
    case "fix": return `/mcs-fix ${projectId} ${agentId}`;
    case "build": return `/mcs-build ${projectId} ${agentId}`;
    default: return null;
  }
}

app.post("/api/skill/start", (req, res) => {
  const { skillType, projectId, agentId } = req.body || {};
  if (!skillType || !projectId) {
    return res.status(400).json({ error: "skillType and projectId required" });
  }

  const VALID_TYPES = ["research", "eval", "fix", "build"];
  if (!VALID_TYPES.includes(skillType)) {
    return res.status(400).json({ error: `Invalid skillType. Must be one of: ${VALID_TYPES.join(", ")}` });
  }

  if (!/^[\w-]+$/.test(projectId) || (agentId && !/^[\w-]+$/.test(agentId))) {
    return res.status(400).json({ error: "Invalid projectId or agentId format" });
  }

  // eval and fix require agentId; research is optional; build requires it
  if ((skillType === "eval" || skillType === "fix" || skillType === "build") && !agentId) {
    return res.status(400).json({ error: `agentId required for ${skillType}` });
  }

  const command = buildSkillCommand(skillType, projectId, agentId || "");
  if (!command) {
    return res.status(400).json({ error: "Could not construct command" });
  }

  const baseDir = path.resolve(path.join(__dirname, ".."));

  try {
    const job = skillRunner.startSkill(skillType, command, projectId, agentId || "", baseDir);
    res.json({ jobId: job.id, status: job.status, skillType: job.skillType });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/skill/status/:jobId", (req, res) => {
  const job = skillRunner.getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Skill job not found" });
  }

  // SSE stream
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Send current state immediately
  res.write(`data: ${JSON.stringify({
    type: "state",
    skillType: job.skillType,
    steps: job.steps,
    status: job.status,
    errors: job.errors,
    authPrompt: job.authPrompt,
  })}\n\n`);

  // If already done, close
  if (job.status === "completed" || job.status === "failed") {
    res.write(`data: ${JSON.stringify({
      type: "done",
      status: job.status,
      errors: job.errors,
      steps: job.steps,
    })}\n\n`);
    return res.end();
  }

  // Subscribe to live updates
  const listener = (event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (event.type === "done") {
        res.end();
      }
    } catch { /* client disconnected */ }
  };
  job.listeners.push(listener);

  req.on("close", () => {
    const idx = job.listeners.indexOf(listener);
    if (idx >= 0) job.listeners.splice(idx, 1);
  });
});

app.post("/api/skill/:jobId/auth-complete", (req, res) => {
  const result = skillRunner.resumeAfterAuth(req.params.jobId);
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

app.get("/api/skill/log/:jobId", (req, res) => {
  const log = skillRunner.getJobLog(req.params.jobId);
  if (log === null) {
    return res.status(404).json({ error: "Skill job not found" });
  }
  res.type("text/plain").send(log);
});

app.get("/api/skill/jobs", (req, res) => {
  const skillType = req.query.type || undefined;
  res.json({ jobs: skillRunner.getAllJobs(skillType) });
});

// ---------------------------------------------------------------------------
// Meeting Co-Pilot API
// ---------------------------------------------------------------------------

const { MeetingSession } = require("./lib/meeting/meeting-session");
const { analyzeMeeting } = require("./lib/meeting/post-meeting");

// Active meeting sessions (keyed by session ID)
const meetingSessions = new Map();

// Prepare a meeting briefing (pre-meeting step)
app.post("/api/meeting/prepare/:projectId", async (req, res) => {
  try {
    const projectDir = path.join(BUILD_GUIDES, req.params.projectId);
    if (!fs.existsSync(projectDir)) {
      return res.status(404).json({ detail: "Project not found" });
    }

    const session = new MeetingSession({
      projectId: req.params.projectId,
      projectDir,
      agentName: req.body?.agentName,
      answerModel: req.body?.answerModel || "gpt-5.4",
      transcriptionModel: req.body?.transcriptionModel || "tiny.en"
    });

    meetingSessions.set(session.id, session);

    const result = await session.prepare();
    res.json({
      sessionId: session.id,
      state: session.state,
      briefingTokens: result.tokens,
      message: "Meeting prepared. Connect to /api/meeting/:id/stream for real-time events, then POST /api/meeting/:id/start."
    });
  } catch (err) {
    console.error("[meeting] Prepare failed:", err.message);
    res.status(500).json({ detail: err.message });
  }
});

// Start a meeting session (begins audio capture + transcription)
app.post("/api/meeting/:id/start", async (req, res) => {
  const session = meetingSessions.get(req.params.id);
  if (!session) return res.status(404).json({ detail: "Session not found" });

  try {
    await session.start();
    res.json({ sessionId: session.id, state: session.state, startedAt: session.startedAt });
  } catch (err) {
    console.error("[meeting] Start failed:", err.message);
    res.status(500).json({ detail: err.message });
  }
});

// Stop a meeting session — stops capture, then triggers post-meeting analysis
app.post("/api/meeting/:id/stop", async (req, res) => {
  const session = meetingSessions.get(req.params.id);
  if (!session) return res.status(404).json({ detail: "Session not found" });

  try {
    const summary = await session.stop();

    // Return immediately with stats so the UI can transition to "stopped"
    // Then run analysis async and push result via SSE
    res.json(summary);

    // Fire post-meeting analysis in background (non-blocking)
    if (session.transcript.length > 0) {
      analyzeMeeting({
        id: session.id,
        projectId: session.projectId,
        projectDir: session.projectDir,
        startedAt: session.startedAt,
        stoppedAt: session.stoppedAt,
        transcript: session.transcript,
        suggestions: session.suggestions,
        briefing: session.answerEngine?.briefing
      }, (progress) => {
        session.emit('event', { type: 'analysis_progress', ...progress });
      }).then((result) => {
        session.emit('event', { type: 'analysis_complete', report: result.report, briefUpdates: result.briefUpdates, savedTo: result.savedTo });
      }).catch((err) => {
        console.error("[meeting] Post-meeting analysis failed:", err.message);
        session.emit('event', { type: 'analysis_error', error: err.message });
      });
    }
  } catch (err) {
    console.error("[meeting] Stop failed:", err.message);
    res.status(500).json({ detail: err.message });
  }
});

// SSE stream for real-time meeting events (transcript + suggestions)
app.get("/api/meeting/:id/stream", (req, res) => {
  const session = meetingSessions.get(req.params.id);
  if (!session) return res.status(404).json({ detail: "Session not found" });

  // Set up SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });

  // Send current state
  res.write(`data: ${JSON.stringify({ type: "state", state: session.state })}\n\n`);

  // Forward all session events to SSE
  const handler = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  session.on("event", handler);

  // Cleanup on disconnect
  req.on("close", () => {
    session.off("event", handler);
  });
});

// Get full transcript for a meeting
app.get("/api/meeting/:id/transcript", (req, res) => {
  const session = meetingSessions.get(req.params.id);
  if (!session) return res.status(404).json({ detail: "Session not found" });
  res.json({ transcript: session.getTranscript(), stats: session.getStats() });
});

// Get meeting stats
app.get("/api/meeting/:id/stats", (req, res) => {
  const session = meetingSessions.get(req.params.id);
  if (!session) return res.status(404).json({ detail: "Session not found" });
  res.json(session.getStats());
});

// Update answer model at runtime
app.patch("/api/meeting/:id/model", (req, res) => {
  const session = meetingSessions.get(req.params.id);
  if (!session) return res.status(404).json({ detail: "Session not found" });
  const model = req.body?.model;
  if (!model) return res.status(400).json({ detail: "model is required" });
  session.setAnswerModel(model);
  res.json({ model, message: "Model updated" });
});

// Toggle mic capture (disabled = no mic processing at all; enabled = silent context for AI)
app.patch("/api/meeting/:id/mic", (req, res) => {
  const session = meetingSessions.get(req.params.id);
  if (!session) return res.status(404).json({ detail: "Session not found" });
  const disabled = req.body?.disabled;
  if (disabled === undefined) return res.status(400).json({ detail: "disabled (boolean) is required" });
  session.setMicDisabled(disabled);
  res.json({ micDisabled: session.micDisabled });
});

// List active meeting sessions
app.get("/api/meeting/sessions", (req, res) => {
  const sessions = [];
  for (const [id, session] of meetingSessions) {
    sessions.push({
      id,
      projectId: session.projectId,
      state: session.state,
      startedAt: session.startedAt,
      transcriptLength: session.transcript.length,
      suggestionsCount: session.suggestions.length
    });
  }
  res.json(sessions);
});

// ---------------------------------------------------------------------------
// AI Model Status (shows which models are accessible)
// ---------------------------------------------------------------------------

app.get("/api/ai/status", async (req, res) => {
  try {
    const anthropicApi = require("../tools/lib/anthropic");
    const info = anthropicApi.getModelAccessInfo();
    if (!info.probed) {
      // Probe on first request (async, ~3s)
      await anthropicApi.probeModelAccess();
    }
    res.json({
      configured: anthropicApi.isConfigured(),
      ...anthropicApi.getModelAccessInfo(),
      models: anthropicApi.MODELS,
      usage: anthropicApi.getUsageSummary()
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// Static file serving — SPA with catch-all (must be after all API routes)
// ---------------------------------------------------------------------------

if (fs.existsSync(path.join(DIST_DIR, "assets"))) {
  app.use("/assets", express.static(path.join(DIST_DIR, "assets")));
}

// SPA catch-all — must be last (Express v5 requires named param, not bare *)
app.get("/{*splat}", (req, res) => {
  // Skip API routes that weren't matched
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ detail: "Not found" });
  }

  // Try serving a static file from dist/
  const staticFile = path.join(DIST_DIR, req.path);
  if (
    fs.existsSync(staticFile) &&
    fs.statSync(staticFile).isFile() &&
    path.resolve(staticFile).startsWith(path.resolve(DIST_DIR))
  ) {
    return res.sendFile(staticFile);
  }

  // Fall back to index.html for client-side routing
  const index = path.join(DIST_DIR, "index.html");
  if (fs.existsSync(index)) {
    return res.sendFile(index);
  }

  res.status(200).send(
    "<h2>Frontend not built</h2>" +
    "<p>Run <code>npm run frontend:build</code> from the repo root, then refresh.</p>"
  );
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

app.use((err, req, res, next) => {
  // Multer file size error
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ detail: "File too large (max 50 MB)" });
  }
  console.error("[server]", err.message || err);
  res.status(500).json({ detail: err.message || "Internal server error" });
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (require.main === module) {
  // Ensure Build-Guides directory exists
  if (!fs.existsSync(BUILD_GUIDES)) {
    fs.mkdirSync(BUILD_GUIDES, { recursive: true });
    console.log(`  Created project directory: ${BUILD_GUIDES}`);
  }

  server.listen(PORT, "127.0.0.1", async () => {
    console.log(`MCS Agent Builder — http://localhost:${PORT}`);
    console.log(`  Base dir: ${BASE_DIR}`);
    console.log(`  Projects: ${BUILD_GUIDES}`);
    console.log(`  Terminal: ws://localhost:${PORT}/ws`);

    // Probe AI model access in background (non-blocking)
    try {
      const anthropicApi = require("../tools/lib/anthropic");
      if (anthropicApi.isConfigured()) {
        anthropicApi.probeModelAccess().then(access => {
          const info = anthropicApi.getModelAccessInfo();
          const directModels = Object.entries(info.access).filter(([k,v]) => v && k !== '_copilotAvailable' && k !== '_primaryRoute').map(([k]) => k);
          const primary = info.copilotAvailable ? 'copilot' : 'direct';
          if (info.copilotAvailable) {
            console.log(`  AI: copilot=[all models] (default: ${info.effectiveDefault}) — direct API fallback: [${directModels.join(',')}]`);
          } else {
            console.log(`  AI: direct=[${directModels.join(',')}] (default: ${info.effectiveDefault}) — no Copilot available`);
          }
        });
      }
    } catch { /* non-critical */ }
  });
}

// ---------------------------------------------------------------------------
// Graceful shutdown — drain connections when parent sends SIGTERM
// ---------------------------------------------------------------------------

function gracefulShutdown(signal) {
  console.log(`\n[server] ${signal} received — closing server...`);
  // Stop accepting new connections
  server.close(() => {
    console.log("[server] All connections drained. Exiting.");
    process.exit(0);
  });
  // Close all WebSocket connections
  wss.clients.forEach((ws) => {
    try { ws.close(1001, "Server shutting down"); } catch {}
  });
  // Force exit after 2.5s if connections don't drain
  setTimeout(() => process.exit(0), 2500).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Export for start.js to spawn
module.exports = { app, server, PORT, BUILD_GUIDES, BASE_DIR };
