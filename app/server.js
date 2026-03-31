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
const fs = require("fs");
const path = require("path");
const os = require("os");

const { attachTerminal } = require("./lib/terminal");
const { migrateBrief } = require("./lib/brief-migrate");
const { convertDocument, extractContent, NEEDS_CONVERSION } = require("./lib/documents");
const { isWorkIQAvailable, checkWorkIQAuth, runQueriesBatched, buildQueries, deduplicateDocuments, assembleContextFile, extractSharePointUrls, downloadAndConvertFiles, escapeMd } = require("./lib/workiq");
const {
  ensureDirs,
  listProjects,
  getProject,
  getDocStatus,
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
    const content = assembleContextFile(customer, results, timeRange, dedup);

    try {
      fs.writeFileSync(filePath, content, "utf-8");
      const stat = fs.statSync(filePath);
      sendSSE({
        type: "done",
        filename,
        size: stat.size,
        successCount: results.filter((r) => !r.error && r.content).length,
        totalQueries: queries.length,
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

app.get("/api/readiness/credentials", async (req, res) => {
  const { execSync } = require("child_process");
  const results = {
    claude: false,
    az: false,
    dataverse: false,
    ready: false,
    details: {},
    // Rich account info for the account switcher
    azAccount: null,   // { user, tenantId, tenantName, tenantDomain }
    pacProfiles: [],   // [{ index, active, name, user, environment, environmentUrl }]
    pacEnvironments: [], // [{ active, name, id, url }]
  };

  // 1. Claude CLI configured?
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

  // 2. Azure CLI logged in? — also capture full account info
  try {
    const azOut = execSync("az account show --output json", {
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
    });
    const account = JSON.parse(azOut);
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

  // 3. PAC CLI profiles — list available auth profiles
  try {
    const pacOut = execSync("pac auth list", {
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
    });
    // Parse the table output: Index Active Kind Name User Cloud Type Environment EnvironmentUrl
    const lines = pacOut.split("\n").filter((l) => l.trim().startsWith("["));
    for (const line of lines) {
      const indexMatch = line.match(/\[(\d+)\]/);
      const active = line.includes("*");
      // Extract fields by splitting on 2+ spaces (table columns)
      const afterIndex = line.replace(/\[\d+\]\s+\*?\s*/, "");
      const parts = afterIndex.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
      // parts: [Kind, Name, User, Cloud, Type, Environment, EnvironmentUrl]
      if (indexMatch && parts.length >= 3) {
        results.pacProfiles.push({
          index: parseInt(indexMatch[1]),
          active,
          kind: parts[0] || "",
          name: parts[1] || "",
          user: parts[2] || "",
          environment: parts.length >= 6 ? parts[5] : "",
          environmentUrl: parts.length >= 7 ? parts[6] : "",
        });
      }
    }
  } catch { /* PAC CLI not available */ }

  // 4. PAC environments for current profile
  if (results.pacProfiles.length > 0) {
    try {
      const envOut = execSync("pac env list", {
        timeout: 20000,
        stdio: ["pipe", "pipe", "pipe"],
        encoding: "utf-8",
      });
      const envLines = envOut.split("\n").slice(2).filter((l) => l.trim());
      for (const line of envLines) {
        const active = line.startsWith("*");
        const clean = line.replace(/^\*?\s*/, "");
        const parts = clean.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
        if (parts.length >= 3) {
          results.pacEnvironments.push({
            active,
            name: parts[0],
            id: parts[1],
            url: parts[2],
          });
        }
      }
    } catch { /* ignore */ }
  }

  // 5. Dataverse reachable? (only if az is logged in and a session-config exists)
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
      try {
        const tokenOut = execSync(
          `az account get-access-token --resource ${sc.dataverseUrl} --output json`,
          { timeout: 15000, stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8" }
        );
        const token = JSON.parse(tokenOut);
        results.dataverse = !!token.accessToken;
        results.details.dataverse = `Token valid for ${sc.dataverseUrl}`;
      } catch (err) {
        results.details.dataverse = `Token failed for ${sc.dataverseUrl} — run: az login --tenant <tenant>`;
      }
    } else {
      results.details.dataverse = "No session-config.json found — will be checked at build time";
      results.dataverse = null; // unknown, not failed
    }
  } else {
    results.details.dataverse = "Requires az login first";
  }

  results.ready = results.claude && results.az;
  res.json(results);
});

// ---------------------------------------------------------------------------
// Account Switching — switch PAC profile and/or Azure tenant
// ---------------------------------------------------------------------------

app.post("/api/auth/switch-profile", async (req, res) => {
  const { execFileSync } = require("child_process");
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
  const { execFileSync } = require("child_process");
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
    res.json({ switched: true, environmentId });
  } catch (err) {
    res.status(500).json({ detail: `Failed to switch environment: ${err.message}` });
  }
});

// ---------------------------------------------------------------------------
// Wizard — Conversational Agent Brief Builder
// ---------------------------------------------------------------------------

app.post("/api/wizard/chat", (req, res) => handleWizardChat(req, res));
app.post("/api/wizard/prefetch", (req, res) => handleWizardPrefetch(req, res));

app.get("/api/models", (req, res) => {
  const anthropic = require("../tools/lib/anthropic");
  const openai = require("../tools/lib/openai");
  res.json({
    models: [
      { key: "opus", name: "Claude Opus 4.6", available: anthropic.isConfigured() },
      { key: "sonnet", name: "Claude Sonnet 4.6", available: anthropic.isConfigured() },
      { key: "haiku", name: "Claude Haiku 4.5", available: anthropic.isConfigured() },
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
  const job = startEnrichment(agentDir);
  res.json({ jobId: job.id, status: job.status });
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

// Stop a meeting session
app.post("/api/meeting/:id/stop", async (req, res) => {
  const session = meetingSessions.get(req.params.id);
  if (!session) return res.status(404).json({ detail: "Session not found" });

  try {
    const summary = await session.stop();
    res.json(summary);
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
          const directModels = Object.entries(info.access).filter(([k,v]) => v && k !== '_copilotAvailable').map(([k]) => k);
          const copilotNote = info.copilotAvailable ? ' + all via Copilot' : '';
          console.log(`  AI: direct=[${directModels.join(',')}]${copilotNote} (default: ${info.effectiveDefault})`);
          if (info.copilotAvailable && directModels.length < 3) {
            console.log(`  Opus/Sonnet route via GitHub Copilot (gh auth token)`);
          }
        });
      }
    } catch { /* non-critical */ }
  });
}

// Export for start.js to spawn
module.exports = { app, server, PORT, BUILD_GUIDES, BASE_DIR };
