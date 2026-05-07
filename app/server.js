#!/usr/bin/env node
/**
 * MCS Agent Builder — Express.js Server
 *
 * Serves:
 *   - REST API for project/agent/document CRUD
 *   - Pre-built React SPA (app/dist/)
 *   - API-direct skill pipelines (research, build, eval, fix)
 *   - Helper chatbot API
 *
 * All AI operations use direct API calls via GitHub Copilot passthrough
 * (tools/lib/anthropic.js for Claude Opus, tools/lib/openai.js for GPT-5.5).
 * No CLI dependency, no PTY, no node-pty.
 *
 * Usage: node app/server.js
 *   env PORT=8000 (default)
 *   env BUILD_GUIDES=/path/to/projects (default: ~/MCS-Agent-Builder)
 */

const express = require("express");
const http = require("http");
const cors = require("cors");
const multer = require("multer");
const { execFileSync, exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);
const fs = require("fs");
const path = require("path");
const os = require("os");

const { migrateSpec } = require("./lib/spec-migrate");
const { convertDocument, extractContent, NEEDS_CONVERSION } = require("./lib/documents");
const { isWorkIQAvailable, checkWorkIQAuth, runQueriesBatched, buildQueries, deduplicateDocuments, assembleContextFileIncremental, extractSharePointUrls, downloadAndConvertFiles, escapeMd } = require("./lib/workiq");
const {
  ensureDirs,
  listProjects,
  getProject,
  getDocStatus,
  loadManifest,
  markDocsProcessed,
  humanizeName,
} = require("./lib/projects");
const { startEnrichment, getJob } = require("./lib/enrichment");
const pipeline = require("./lib/pipeline");
const scheduler = require("./lib/scheduler");
const chatRouter = require("./lib/chat/chat-router");
const knowledgeRetriever = require("./lib/chat/knowledge-retriever");
const chatSpecStore = require("./lib/chat/spec-store");

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
// Agent Spec file resolution (backward compat: agentspec.json > brief.json)
// ---------------------------------------------------------------------------

const SPEC_FILENAME = "agentspec.json";
const LEGACY_SPEC_FILENAME = "brief.json";

/** Resolve spec file path. Prefers agentspec.json, falls back to brief.json. */
function resolveSpecFile(agentDir) {
  const newPath = path.join(agentDir, SPEC_FILENAME);
  if (fs.existsSync(newPath)) return newPath;
  const legacyPath = path.join(agentDir, LEGACY_SPEC_FILENAME);
  if (fs.existsSync(legacyPath)) return legacyPath;
  return newPath; // default to new name for creation
}

/** Always write to agentspec.json — gradually migrates old projects. */
function specWritePath(agentDir) {
  return path.join(agentDir, SPEC_FILENAME);
}

/** Read + parse a spec file, auto-migrating v1→v2 and renaming to agentspec.json. */
function readSpec(agentDir) {
  const specFile = resolveSpecFile(agentDir);
  if (!fs.existsSync(specFile)) return null;
  try {
    const raw = fs.readFileSync(specFile, "utf-8").replace(/^\uFEFF/, "");
    let spec = JSON.parse(raw);
    // Auto-migrate v1 → v2
    if (spec && spec.step1 && !spec.agent) {
      spec = migrateSpec(spec);
      // Atomic write via shared spec-store (temp + rename, stamps updated_at)
      chatSpecStore.writeSpec(agentDir, spec);
      // Clean up legacy file if we wrote to the new name. The shared
      // spec-store always writes to agentspec.json (canonical target);
      // if the source file was the legacy brief.json, remove it now that
      // the new file has been written. (Pre-existing ReferenceError for
      // `writeTo` was exposed by qa-challenger 2026-05-05; the var was
      // dropped in an earlier refactor and the cleanup branch was dead.)
      const writeTo = path.join(agentDir, SPEC_FILENAME);
      if (specFile !== writeTo && fs.existsSync(specFile)) {
        fs.unlinkSync(specFile);
      }
    } else if (path.basename(specFile) === LEGACY_SPEC_FILENAME) {
      // Migrate filename: rename brief.json → agentspec.json on read.
      // Atomic write via shared spec-store.
      chatSpecStore.writeSpec(agentDir, spec);
      fs.unlinkSync(specFile);
    }
    return spec;
  } catch { return null; }
}

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

// Dev logger — request timing, frontend event collector, session JSONL
const devLogger = require("./lib/dev-logger");
devLogger.setup(app);

// File upload via multer — disk storage, 50MB limit
const upload = multer({
  dest: path.join(os.tmpdir(), "mcs-uploads"),
  limits: { fileSize: 50 * 1024 * 1024 },
});

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
  res.json({ status: "ok" });
});
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// --- Projects ---

// Honor ?role= query param for eval-gate visibility filter. Not auth —
// just a hint the frontend can pass so the filter module can reduce fields
// for non-maker viewers. Default 'maker' for existing callers.
function resolveViewerRole(req) {
  const r = (req.query.role || "maker").toString().toLowerCase();
  if (r === "anonymous" || r === "admin" || r === "maker") return r;
  return "maker";
}

app.get("/api/projects", (req, res) => {
  listProjects.__viewerRole = resolveViewerRole(req);
  try {
    const projects = listProjects(BUILD_GUIDES);
    res.json({
      generated_at: new Date().toISOString(),
      project_count: projects.length,
      projects,
    });
  } finally {
    listProjects.__viewerRole = undefined;
  }
});

app.get("/api/projects/:projectId", (req, res) => {
  getProject.__viewerRole = resolveViewerRole(req);
  try {
    const project = getProject(BUILD_GUIDES, req.params.projectId);
    if (!project) return res.status(404).json({ detail: `Project '${req.params.projectId}' not found` });
    res.json(project);
  } finally {
    getProject.__viewerRole = undefined;
  }
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

// ---------------------------------------------------------------------------
// Spec session persistence — powers the unified home chat.
// Keys off projectId (the Build-Guides folder). Stores chat messages and a
// patch changelog alongside the existing docs/ + agents/default/agentspec.json.
// The spec itself lives in agents/default/agentspec.json and is the source of
// truth; the session file only carries conversation state + provenance.
// ---------------------------------------------------------------------------

const SESSION_FILENAME = "session.json";
const CHANGELOG_FILENAME = "spec-changelog.jsonl";

function sessionPaths(projectId) {
  const slug = safeSlug(projectId);
  const folder = path.join(BUILD_GUIDES, slug);
  return {
    slug,
    folder,
    sessionFile: path.join(folder, SESSION_FILENAME),
    changelogFile: path.join(folder, CHANGELOG_FILENAME),
    agentDir: path.join(folder, "agents", "default"),
  };
}

function readSessionFile(sessionFile) {
  if (!fs.existsSync(sessionFile)) return { messages: [], updatedAt: null };
  try {
    const data = JSON.parse(fs.readFileSync(sessionFile, "utf-8"));
    return {
      messages: Array.isArray(data.messages) ? data.messages : [],
      updatedAt: data.updatedAt || null,
    };
  } catch (err) {
    devLogger.warn("session", `corrupt session.json for ${sessionFile}: ${err.message}`);
    return { messages: [], updatedAt: null };
  }
}

function readChangelog(changelogFile) {
  if (!fs.existsSync(changelogFile)) return [];
  const raw = fs.readFileSync(changelogFile, "utf-8");
  const entries = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { entries.push(JSON.parse(line)); } catch { /* skip bad lines */ }
  }
  return entries;
}

function appendChangelog(changelogFile, entry) {
  const withId = {
    changeId: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    ...entry,
  };
  try {
    fs.appendFileSync(changelogFile, JSON.stringify(withId) + "\n", "utf-8");
  } catch (err) {
    devLogger.warn("changelog", `append failed: ${err.message}`);
  }
  return withId;
}

function readSpecForProject(agentDir) {
  if (!fs.existsSync(agentDir)) return null;
  return readSpec(agentDir);
}

// GET /api/projects/:projectId/session — load messages + current spec + changelog tail
app.get("/api/projects/:projectId/session", (req, res) => {
  const p = sessionPaths(req.params.projectId);
  if (!assertWithin(BUILD_GUIDES, p.folder) || !fs.existsSync(p.folder) || !fs.statSync(p.folder).isDirectory()) {
    return res.status(404).json({ detail: `Project '${p.slug}' not found` });
  }
  const session = readSessionFile(p.sessionFile);
  const spec = readSpecForProject(p.agentDir);
  const changelog = readChangelog(p.changelogFile);
  res.json({
    projectId: p.slug,
    messages: session.messages,
    updatedAt: session.updatedAt,
    specData: spec,
    changelog: changelog.slice(-50),
  });
});

// PUT /api/projects/:projectId/session — save messages (spec is saved via other paths)
app.put("/api/projects/:projectId/session", (req, res) => {
  const p = sessionPaths(req.params.projectId);
  if (!assertWithin(BUILD_GUIDES, p.folder) || !fs.existsSync(p.folder) || !fs.statSync(p.folder).isDirectory()) {
    return res.status(404).json({ detail: `Project '${p.slug}' not found` });
  }
  const incoming = req.body || {};
  const messages = Array.isArray(incoming.messages) ? incoming.messages : [];
  const payload = {
    messages,
    updatedAt: new Date().toISOString(),
  };
  try {
    fs.writeFileSync(p.sessionFile, JSON.stringify(payload, null, 2), "utf-8");
    res.json({ saved: true, updatedAt: payload.updatedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Per-project spec-write mutex. Serializes patches so chat edits during an
// analyze run queue behind each other instead of clobbering. Imported from
// app/lib/chat/spec-store.js so /api/chat (chat-router) and /api/projects/
// :id/spec (this file) share one map — without sharing, a chat spec_patch
// and a /spec editor save can race within the same process.
const withProjectSpecLock = chatSpecStore.withProjectSpecLock;

// POST /api/projects/:projectId/spec — apply a patch to the spec, stamp changelog
// Body: { patch: { sectionKey: {...} }, source: 'chat'|'analyze', summary?: string, turnId?: string }
app.post("/api/projects/:projectId/spec", async (req, res) => {
  const p = sessionPaths(req.params.projectId);
  if (!assertWithin(BUILD_GUIDES, p.folder) || !fs.existsSync(p.folder) || !fs.statSync(p.folder).isDirectory()) {
    return res.status(404).json({ detail: `Project '${p.slug}' not found` });
  }
  const body = req.body || {};
  const patch = body.patch;
  if (!patch || typeof patch !== "object") {
    return res.status(400).json({ error: "patch object required" });
  }

  // Ensure agent dir exists
  if (!fs.existsSync(p.agentDir)) fs.mkdirSync(p.agentDir, { recursive: true });

  try {
    const result = await withProjectSpecLock(p.slug, async () => {
      // Re-read inside the lock so we merge onto the absolute latest spec —
      // critical when analyze finishes writing a base revision while a chat
      // patch was queued behind it.
      const current = readSpec(p.agentDir) || {};
      const merged = applySpecPatch(current, patch);
      // Atomic write via shared spec-store (already inside withProjectSpecLock).
      chatSpecStore.writeSpec(p.agentDir, merged);

      const affectedPaths = Object.keys(patch);
      const entry = appendChangelog(p.changelogFile, {
        source: (body.source === "analyze" ? "analyze" : "chat"),
        summary: (body.summary || "").slice(0, 240),
        turnId: body.turnId || null,
        affectedPaths,
      });
      return { merged, entry };
    });
    res.json({ saved: true, spec: result.merged, change: result.entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deep-merge patch — mirrors the frontend specPatchUtils.applyPatch contract.
// Arrays REPLACE, objects MERGE (except `conversations` which merges at the top).
function applySpecPatch(spec, patch) {
  const result = { ...(spec || {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (key === "conversations" && value && typeof value === "object" && !Array.isArray(value)) {
      result.conversations = { ...(result.conversations || {}), ...value };
    } else if (Array.isArray(value)) {
      result[key] = value;
    } else if (value && typeof value === "object") {
      result[key] = { ...(result[key] || {}), ...value };
    } else {
      result[key] = value;
    }
  }
  return result;
}

// GET /api/projects/:projectId/changelog — full changelog (newest last)
app.get("/api/projects/:projectId/changelog", (req, res) => {
  const p = sessionPaths(req.params.projectId);
  if (!assertWithin(BUILD_GUIDES, p.folder) || !fs.existsSync(p.folder)) {
    return res.status(404).json({ detail: `Project '${p.slug}' not found` });
  }
  res.json({ changelog: readChangelog(p.changelogFile) });
});


// --- Agents ---

app.get("/api/projects/:projectId/agents/:agentId", (req, res) => {
  const agentDir = path.join(BUILD_GUIDES, req.params.projectId, "agents", req.params.agentId);
  if (!fs.existsSync(agentDir) || !fs.statSync(agentDir).isDirectory()) {
    return res.status(404).json({ detail: `Agent '${req.params.agentId}' not found` });
  }

  const spec = readSpec(agentDir);

  let name;
  if (spec && (spec.agent || {}).name) {
    name = spec.agent.name;
  } else if (spec && (spec.step1 || {}).agentName) {
    name = spec.step1.agentName;
  } else {
    name = humanizeName(req.params.agentId);
  }

  const specFile = resolveSpecFile(agentDir);
  let fileMtime = null;
  if (fs.existsSync(specFile)) {
    fileMtime = new Date(fs.statSync(specFile).mtimeMs).toISOString();
  }

  res.json({
    id: req.params.agentId,
    name,
    spec,
    brief: spec, // backward compat alias
    _file_mtime: fileMtime,
    has_instructions: spec ? !!spec.instructions : false,
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

  // Read from whichever file exists, write to agentspec.json
  const readFrom = resolveSpecFile(agentDir);
  let existing = {};
  if (fs.existsSync(readFrom)) {
    try {
      const raw = fs.readFileSync(readFrom, "utf-8").replace(/^\uFEFF/, "");
      existing = JSON.parse(raw);
    } catch { /* ignore */ }
  }

  // Phase 1b: stamp user provenance on every top-level field the client
  // actually changed. Strips any client-supplied _provenance and ignores
  // no-op merges so badges on SpecPage reflect reality.
  const { applyUserPatch } = require("./lib/provenance");
  const result = applyUserPatch(existing, req.body || {});
  existing.updated_at = new Date().toISOString();

  const writeTo = specWritePath(agentDir);
  fs.writeFileSync(writeTo, JSON.stringify(existing, null, 2), "utf-8");
  // Clean up legacy file if it still exists
  if (readFrom !== writeTo && fs.existsSync(readFrom)) {
    try { fs.unlinkSync(readFrom); } catch { /* ignore */ }
  }
  res.json({ saved: true, changed: result.changed });
});

app.post("/api/projects/:projectId/agents/:agentId/scaffold-children", (req, res) => {
  const folder = path.join(BUILD_GUIDES, req.params.projectId);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    return res.status(404).json({ detail: `Project '${req.params.projectId}' not found` });
  }

  const agentDir = path.join(folder, "agents", req.params.agentId);
  const specFile = resolveSpecFile(agentDir);
  if (!fs.existsSync(specFile)) {
    return res.status(404).json({ detail: `Agent '${req.params.agentId}' has no agent spec` });
  }

  let spec;
  try {
    const raw = fs.readFileSync(specFile, "utf-8").replace(/^\uFEFF/, "");
    spec = JSON.parse(raw);
  } catch (e) {
    return res.status(500).json({ detail: `Failed to read agent spec: ${e.message}` });
  }

  const children = ((spec.architecture || {}).children || []);
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
        reason: `Specialist agent — child of ${(spec.agent || {}).name || req.params.agentId}`,
      },
      updated_at: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(childDir, SPEC_FILENAME),
      JSON.stringify(childBrief, null, 2),
      "utf-8"
    );

    child.agentFolderId = folderName;
    created.push(folderName);
  }

  // Save parent spec with updated agentFolderIds — atomic via shared spec-store.
  chatSpecStore.writeSpec(agentDir, spec);
  // Clean up legacy file
  if (path.basename(specFile) === LEGACY_SPEC_FILENAME && fs.existsSync(specFile)) {
    try { fs.unlinkSync(specFile); } catch { /* ignore */ }
  }

  res.json({ created, message: `Created ${created.length} agent folder(s)` });
});

// --- HTML Export ---

app.get("/api/projects/:projectId/agents/:agentId/export", async (req, res) => {
  const projectId = safeSlug(req.params.projectId);
  const agentId = safeSlug(req.params.agentId);

  const { renderReport } = require("./lib/report");

  const specDir = path.join(BUILD_GUIDES, projectId, "agents", agentId);
  const specFile = resolveSpecFile(specDir);
  if (!assertWithin(BUILD_GUIDES, specFile) || !fs.existsSync(specFile)) {
    return res.status(404).json({ detail: `Brief not found for agent '${agentId}'` });
  }

  try {
    const html = await renderReport(specFile, { agentName: agentId, projectId, agentId });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Disposition", `attachment; filename="${agentId}-export.html"`);
    res.send(html);
  } catch (err) {
    devLogger.error("server", "Export failed", err.message || String(err));
    res.status(500).json({ detail: `Export failed: ${err.message}` });
  }
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

  const finalPath = path.join(docsDir, finalName);

  const specOutdated = fs.existsSync(path.join(folder, "doc-manifest.json"));
  const stat = fs.existsSync(finalPath) ? fs.statSync(finalPath) : null;

  res.json({
    uploaded: true,
    filename: finalName,
    conversionError,
    size: stat ? stat.size : req.file.size,
    mtime: stat ? stat.mtimeMs : Date.now(),
    path: `Build-Guides/${req.params.projectId}/docs/${finalName}`,
    specOutdated,
    briefOutdated: specOutdated, // backward compat alias
  });

  // Notify pipeline settling window
  pipeline.notifyDocChange(req.params.projectId);
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

  // Notify pipeline settling window
  pipeline.notifyDocChange(req.params.projectId);
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

// Classify docs → tag each doc to the agent(s) it relates to
app.post("/api/projects/:projectId/classify-docs", (req, res) => {
  const projectId = safeSlug(req.params.projectId);
  const folder = path.join(BUILD_GUIDES, projectId);
  if (!assertWithin(BUILD_GUIDES, folder) || !fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    return res.status(404).json({ detail: `Project '${projectId}' not found` });
  }

  const project = getProject(BUILD_GUIDES, projectId);
  if (!project) return res.status(404).json({ detail: "Project not found" });

  const agents = project.agents || [];
  const docs = project.docs || [];
  if (agents.length === 0 || docs.length === 0) {
    return res.json({ classified: 0, docs: [] });
  }

  // Build keyword sets for each agent from name, description, and spec capabilities
  const agentKeywords = agents.map(a => {
    const words = new Set();
    // Agent name tokens
    for (const w of (a.name || "").toLowerCase().split(/[\s_-]+/)) {
      if (w.length > 2) words.add(w);
    }
    // Description tokens
    for (const w of (a.description || "").toLowerCase().split(/[\s_-]+/)) {
      if (w.length > 3) words.add(w);
    }
    return { id: a.id, name: a.name, words };
  });

  // Classify each doc by matching filename tokens against agent keywords
  const results = docs.map(doc => {
    const docTokens = doc.filename.toLowerCase().replace(/\.\w+$/, "").split(/[\s_-]+/);
    const matched = [];

    for (const agent of agentKeywords) {
      let score = 0;
      for (const token of docTokens) {
        if (token.length < 3) continue;
        if (agent.words.has(token)) score += 2;
        // Partial match
        for (const kw of agent.words) {
          if (kw.includes(token) || token.includes(kw)) score += 1;
        }
      }
      if (score >= 2) matched.push(agent.id);
    }

    // SDR and transcript docs that mention an agent name directly
    if (matched.length === 0) {
      const lower = doc.filename.toLowerCase();
      for (const agent of agentKeywords) {
        const agentSlug = agent.id.toLowerCase().replace(/[\s_-]+/g, "");
        const fileSlug = lower.replace(/[\s_-]+/g, "");
        if (fileSlug.includes(agentSlug) || agentSlug.includes(fileSlug.replace(/\.\w+$/, ""))) {
          matched.push(agent.id);
        }
      }
    }

    // If no specific match, tag as shared (all agents)
    const finalMatch = matched.length > 0 ? matched : agents.map(a => a.id);

    return { filename: doc.filename, matchedAgents: finalMatch, isShared: matched.length === 0 };
  });

  // Write classifications to manifest
  const manifestPath = path.join(folder, "doc-manifest.json");
  let manifest = {};
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")); } catch {}

  // Handle both old and new format — normalize to new format
  const docsProcessed = [];
  for (const r of results) {
    const existing = manifest[r.filename] || (manifest.docsProcessed || []).find(e => e.filename === r.filename) || {};
    docsProcessed.push({
      filename: r.filename,
      sha256: existing.sha256 || existing.hash || "",
      size: docs.find(d => d.filename === r.filename)?.size || 0,
      mtime: (docs.find(d => d.filename === r.filename)?.mtime || 0) / 1000,
      processedAt: existing.processedAt || new Date().toISOString(),
      source: existing.source || "classify",
      matchedAgents: r.matchedAgents,
      status: "processed",
    });
  }

  const newManifest = { docsProcessed };
  fs.writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2));

  res.json({ classified: results.length, docs: results });
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

  // Notify pipeline settling window after M365 pull completes (files landed in docs/)
  pipeline.notifyDocChange(req.params.projectId);

  res.end();
});

// ---------------------------------------------------------------------------
// Pipeline Events SSE — docs-settled, auto-chain, eval-complete
// ---------------------------------------------------------------------------

app.get("/api/pipeline/events/:projectId", (req, res) => {
  const { projectId } = req.params;
  if (!/^[\w-]+$/.test(projectId)) {
    return res.status(400).json({ error: "Invalid projectId format" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Send keepalive comment immediately
  res.write(": connected\n\n");

  const unsub = pipeline.subscribePipelineEvents(projectId, (event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch { /* client disconnected */ }
  });

  req.on("close", unsub);
});

// ---------------------------------------------------------------------------
// Package Endpoint — export solution + upload to SharePoint
// ---------------------------------------------------------------------------

app.post("/api/projects/:projectId/agents/:agentId/package", (req, res) => {
  const { projectId, agentId } = req.params;
  if (!/^[\w-]+$/.test(projectId) || !/^[\w-]+$/.test(agentId)) {
    return res.status(400).json({ error: "Invalid projectId or agentId format" });
  }

  const agentDir = path.join(BUILD_GUIDES, projectId, "agents", agentId);
  if (!fs.existsSync(agentDir)) {
    return res.status(404).json({ error: `Agent '${agentId}' not found in project '${projectId}'` });
  }

  try {
    const job = pipeline.packageAgent(projectId, agentId);
    res.json({ jobId: job.id, status: job.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/package/status/:jobId", (req, res) => {
  const job = pipeline.getPackageJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Package job not found" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Send current state
  res.write(`data: ${JSON.stringify({
    type: "state",
    steps: job.steps,
    status: job.status,
    errors: job.errors,
  })}\n\n`);

  // If already done, close
  if (job.status !== "running") {
    res.write(`data: ${JSON.stringify({
      type: "done",
      status: job.status,
      errors: job.errors,
      steps: job.steps,
      result: job.result,
    })}\n\n`);
    return res.end();
  }

  // Subscribe to live updates
  const listener = (event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (event.type === "done") res.end();
    } catch { /* client disconnected */ }
  };
  job.listeners.push(listener);

  req.on("close", () => {
    const idx = job.listeners.indexOf(listener);
    if (idx >= 0) job.listeners.splice(idx, 1);
  });
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
    gh: false,
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

  // 2 + 3 + GitHub: Run az, pac, and gh in PARALLEL (non-blocking)
  const [azResult, pacResult, ghResult] = await Promise.allSettled([
    // Azure CLI account info
    runCliAsync("az", ["account", "show", "--output", "json"], 10000),
    // PAC CLI auth profiles
    runCliAsync("pac", ["auth", "list"], 10000),
    // GitHub CLI auth status (outputs to stderr, so capture both)
    execAsync("gh auth status", { timeout: 10000, windowsHide: true, encoding: "utf-8" })
      .then(({ stdout, stderr }) => (stderr || stdout || "")),
  ]);

  // Process Azure result
  if (azResult.status === "fulfilled") {
    try {
      const account = JSON.parse(azResult.value);
      results.az = true;
      // Try to get display name from Azure AD (Graph API)
      let displayName = null;
      try {
        const { stdout } = await execAsync('az ad signed-in-user show --query displayName -o tsv', { timeout: 15000 });
        displayName = stdout.trim() || null;
      } catch {}
      // Fallback: parse from email
      if (!displayName) {
        const name = account.user?.name || "";
        if (name.includes("@")) {
          const local = name.split("@")[0];
          if (local.includes(".")) {
            displayName = local.split(".").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          }
        } else if (name) {
          displayName = name;
        }
      }
      results.azAccount = {
        user: account.user?.name || "unknown",
        displayName,
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

  // Process GitHub auth status result
  if (ghResult.status === "fulfilled") {
    // gh auth status outputs to stderr on success, but exits 0 when logged in
    results.gh = true;
    // Parse the account name from output (format: "Logged in to github.com account <user>")
    const ghOut = ghResult.value || "";
    const accountMatch = ghOut.match(/account\s+(\S+)/);
    results.details.gh = accountMatch
      ? `${accountMatch[1]} (github.com)`
      : "Authenticated";
  } else {
    // gh auth status exits non-zero when not logged in
    results.gh = false;
    results.details.gh = "Run: gh auth login";
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
    devLogger.error("credentials", "Error", err.message);
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

    // Try to switch az tenant to match the PAC profile's tenant
    let azSwitched = false;
    const activeUser = userMatch?.[0] || "";
    if (activeUser && activeUser.includes("@")) {
      // Extract tenant domain from user email
      const domain = activeUser.split("@")[1];
      if (domain) {
        try {
          await execAsync(`az login --tenant ${domain} --allow-no-subscriptions`, { timeout: 120000 });
          azSwitched = true;
        } catch {
          // az login may fail if token is stale — user may need to re-auth
        }
      }
    }

    // Invalidate caches after profile switch
    _credCache = { data: null, ts: 0 };
    _platformAgentsCache = { data: null, ts: 0 };

    res.json({
      switched: true,
      activeUser: activeUser || "unknown",
      azSwitched,
      message: azSwitched
        ? `Switched to PAC profile [${profileIndex}] and Azure tenant synced.`
        : `Switched to PAC profile [${profileIndex}]. Azure tenant may need manual switch.`,
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
// Unified chat — replaces /api/project-chat/turn, /api/wizard/chat,
// /api/copilot/chat. SSE stream with stable app-level events.
// See app/lib/chat/event-protocol.js for the event envelope.
// ---------------------------------------------------------------------------
// Wrap async chat handlers with an error boundary so a thrown promise
// surfaces as a clean 500 instead of an unhandled rejection. Express 5
// handles thrown errors in async handlers natively, but we still catch
// here for SSE — the emitter may have already sent headers, so we bail
// out without trying to set a status.
app.post("/api/chat", (req, res, next) => {
  Promise.resolve(chatRouter.handleChat(req, res)).catch((err) => {
    devLogger.error("chat-router", "unhandled", err.message || String(err));
    if (!res.headersSent) {
      try { res.status(500).json({ error: "chat_failed", message: err.message }); } catch { /* ignore */ }
      return;
    }
    // Stream is already open — emit a protocol-compliant error event before
    // closing so the client knows the failure was real, not a normal close.
    try {
      const payload = JSON.stringify({ type: "error", code: "chat_failed", message: err.message || String(err), ts: Date.now() });
      res.write(`event: error\ndata: ${payload}\n\n`);
      const donePayload = JSON.stringify({ type: "done", ts: Date.now() });
      res.write(`event: done\ndata: ${donePayload}\n\n`);
    } catch { /* ignore */ }
    try { res.end(); } catch { /* ignore */ }
  });
});
app.post("/api/chat/cancel", (req, res, next) => {
  Promise.resolve(chatRouter.handleCancel(req, res)).catch(next);
});

// Build the BM25 index lazily so server boot stays fast; first /api/chat
// call triggers the build.
app.get("/api/chat/index-info", (req, res) => res.json(knowledgeRetriever.getIndexInfo()));

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
    devLogger.warn("platform-agents", `pac copilot list failed: ${err.message}`);
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

  // Write a stub agentspec.json with the agent name for the scaffold
  const agentFolder = path.join(projectFolder, "agents", folderName);
  if (!fs.existsSync(agentFolder)) fs.mkdirSync(agentFolder, { recursive: true });

  const specPath = specWritePath(agentFolder);
  if (!fs.existsSync(specPath) && !fs.existsSync(path.join(agentFolder, LEGACY_SPEC_FILENAME))) {
    const stub = {
      agentName,
      schemaName: schemaName || "",
      importedFromPlatform: true,
      importedAt: new Date().toISOString(),
      business: { description: `Imported from Copilot Studio platform agent: ${agentName}` },
    };
    chatSpecStore.writeSpec(agentFolder, stub);
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

  // Write a stub agentspec.json with template reference
  const agentFolder = path.join(projectFolder, "agents", folderName);
  if (!fs.existsSync(agentFolder)) fs.mkdirSync(agentFolder, { recursive: true });

  const specPath = specWritePath(agentFolder);
  if (!fs.existsSync(specPath) && !fs.existsSync(path.join(agentFolder, LEGACY_SPEC_FILENAME))) {
    const stub = {
      agentName: solutionName,
      deployedFromTemplate: true,
      templateId: solutionId || "",
      deployedAt: new Date().toISOString(),
      business: {
        description: `Created from solution template: ${solutionName}`,
      },
    };
    chatSpecStore.writeSpec(agentFolder, stub);
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
    devLogger.error("solutions", "Error", err.message);
    res.json({ solutions: [] });
  }
});

app.get("/api/models", (req, res) => {
  const anthropic = require("../tools/lib/anthropic");
  const openai = require("../tools/lib/openai");
  const resolved = anthropic.getResolvedCopilotIds();
  const opusId = resolved.opus || anthropic.KNOWN_LATEST_COPILOT.opus;
  const sonnetId = resolved.sonnet || anthropic.KNOWN_LATEST_COPILOT.sonnet;
  const opusVer = (opusId.match(/(\d+\.\d+)$/) || [, ''])[1];
  const sonnetVer = (sonnetId.match(/(\d+\.\d+)$/) || [, ''])[1];
  // GPT id is resolved lazily by the openai client. Use whatever discovery has
  // produced (or the env-pinned override) and fall back to the known-latest
  // floor if discovery hasn't run yet — the next backend call will warm it.
  const gptId = openai.getResolvedGptId() || openai.KNOWN_LATEST_GPT;
  const gptVer = (gptId.match(/^gpt-([\d.]+)/) || [, ''])[1];
  res.json({
    models: [
      { key: "opus", name: `Claude Opus ${opusVer}`, id: opusId, available: anthropic.isConfigured() },
      { key: "sonnet", name: `Claude Sonnet ${sonnetVer}`, id: sonnetId, available: anthropic.isConfigured() },
      { key: gptId, name: `GPT-${gptVer}`, id: gptId, available: openai.isConfigured() },
    ],
    default: "opus",
  });
});

/**
 * Live model catalog — returns the currently resolved Copilot model IDs
 * (forward-probed for Claude, discovery-resolved for GPT) so frontend
 * dropdowns can display whatever the backend just discovered. When
 * claude-opus-4.8 or gpt-5.6 land, this endpoint returns them without any
 * code changes.
 *
 * Response shape:
 *   {
 *     claude: {
 *       resolved: { opus, sonnet, haiku },
 *       knownLatest: { opus, sonnet, haiku },
 *       skipDiscovery: bool
 *     },
 *     gpt: {
 *       resolved: string|null,            // null until first discovery
 *       knownLatest: string,              // floor
 *       envOverride: string|null,         // GPT_MODEL_ID
 *       skipDiscovery: bool,              // GPT_SKIP_DISCOVERY=1 or env override
 *       available: bool                   // copilot reachable
 *     },
 *     copilotAvailable: bool
 *   }
 */
app.get("/api/models/catalog", async (req, res) => {
  try {
    const anthropic = require("../tools/lib/anthropic");
    const openai = require("../tools/lib/openai");
    // Trigger resolution for any families not yet resolved (Claude + GPT in parallel).
    await Promise.all([
      anthropic.warmModelResolution(),
      openai.warmGptModelResolution()
    ]);
    const claudeInfo = anthropic.getModelAccessInfo();
    const gptInfo = openai.getGptModelInfo();
    res.json({
      claude: {
        resolved: claudeInfo.resolvedCopilotIds,
        knownLatest: claudeInfo.knownLatestCopilot,
        skipDiscovery: claudeInfo.skipDiscovery
      },
      gpt: {
        resolved: gptInfo.resolvedGptId,
        knownLatest: gptInfo.knownLatestGpt,
        envOverride: gptInfo.envOverride,
        skipDiscovery: gptInfo.skipDiscovery,
        available: gptInfo.copilotAvailable
      },
      copilotAvailable: claudeInfo.copilotAvailable,
      // Legacy compatibility — older callers expected flat fields:
      resolved: claudeInfo.resolvedCopilotIds,
      knownLatest: claudeInfo.knownLatestCopilot,
      skipDiscovery: claudeInfo.skipDiscovery
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Enrichment — Background spec enrichment (formerly post-wizard, now manual)
// ---------------------------------------------------------------------------

app.post("/api/enrichment/start", (req, res) => {
  const { projectId, agentId } = req.body || {};
  if (!projectId || !agentId) {
    return res.status(400).json({ error: "projectId and agentId required" });
  }

  const agentDir = path.join(BUILD_GUIDES, projectId, "agents", agentId);
  if (!fs.existsSync(resolveSpecFile(agentDir))) {
    return res.status(404).json({ error: "Agent spec not found" });
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
            devLogger.info("enrichment", `Marked ${allDocs.length} docs as processed (full enrichment)`);
          }
        }
      } catch (e) {
        devLogger.error("enrichment", `Failed to update manifest after full enrichment: ${e.message}`);
      }
    },
  });
  res.json({ jobId: job.id, status: job.status });
});

// Delta enrichment — process only new/changed documents
// Pass forceRefresh: true to bypass user-edit protection (context-refresh mode)
app.post("/api/enrichment/delta", (req, res) => {
  const { projectId, agentId, forceRefresh } = req.body || {};
  if (!projectId || !agentId) {
    return res.status(400).json({ error: "projectId and agentId required" });
  }

  const projectDir = path.join(BUILD_GUIDES, projectId);
  const agentDir = path.join(projectDir, "agents", agentId);
  if (!fs.existsSync(resolveSpecFile(agentDir))) {
    return res.status(404).json({ error: "Agent spec not found" });
  }

  // Find new/changed docs from manifest comparison
  const docStatus = getDocStatus(BUILD_GUIDES, projectId);
  const deltaFiles = [...(docStatus?.newDocs || []), ...(docStatus?.changedDocs || [])];

  if (deltaFiles.length === 0) {
    return res.json({ jobId: null, status: "no_delta", message: "No new or changed documents to process" });
  }

  // When forceRefresh + context file changed, enrich ALL mapped agents
  const contextFile = forceRefresh && deltaFiles.find((f) => f.startsWith("workiq-context-"));
  let targetAgentIds = [agentId];
  if (contextFile) {
    try {
      const manifest = loadManifest(projectDir);
      const mapped = manifest?.docs?.[contextFile]?.agents;
      if (Array.isArray(mapped) && mapped.length > 0) {
        targetAgentIds = [...new Set([agentId, ...mapped])];
      }
    } catch { /* use single agent fallback */ }
  }

  // Start delta enrichment with manifest update on completion
  const jobs = [];
  for (const aid of targetAgentIds) {
    const dir = path.join(projectDir, "agents", aid);
    if (!fs.existsSync(resolveSpecFile(dir))) continue;
    const job = startEnrichment(dir, {
      deltaFiles,
      projectDir,
      forceRefresh: forceRefresh || false,
      onComplete: () => {
        try {
          markDocsProcessed(projectDir, deltaFiles, {
            source: forceRefresh ? "context-refresh" : "enrichment",
            matchedAgents: [aid],
          });
          devLogger.info("enrichment", `Marked ${deltaFiles.length} docs as processed for ${aid}`);
        } catch (e) {
          devLogger.error("enrichment", `Failed to update manifest: ${e.message}`);
        }
      },
    });
    jobs.push({ agentId: aid, jobId: job.id, status: job.status });
  }

  const primaryJob = jobs[0] || { jobId: null, status: "no_agents" };
  res.json({ ...primaryJob, deltaFiles, agents: jobs.map((j) => j.agentId) });
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

// ---------------------------------------------------------------------------
// Removed endpoints (Gone) — 410 instead of generic 404 so legacy clients see
// an actionable error. Removed in cleanup PR #27 (2026-05-05) after the
// unified-chat refactor (commit 234c34b6) made them unreachable.
// ---------------------------------------------------------------------------

const REMOVED_ENRICHMENT_ENDPOINTS = [
  ["/api/enrichment/speculative", "Speculative enrichment was removed when the wizard endpoint was deleted; use /api/chat with action=spec_patch instead."],
  ["/api/enrichment/reconcile",   "Speculative reconcile was removed; the unified chat router writes specs directly."],
];
for (const [routePath, message] of REMOVED_ENRICHMENT_ENDPOINTS) {
  app.all(routePath, (_req, res) => {
    res.status(410).json({ error: "endpoint removed", message });
  });
}

// ---------------------------------------------------------------------------
// Build Runner: API-direct build pipeline (build-pipeline.js)
// Build endpoints route through skill-runner stub
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Skill Runner — Generalized headless skill execution (research/eval/fix/build)
// ---------------------------------------------------------------------------

const skillRunner = require("./lib/skill-runner");

// ---------------------------------------------------------------------------
// Pipeline Job Lookup — checks all API-direct pipelines
// ---------------------------------------------------------------------------

const _pipelines = [
  () => require("./lib/research-pipeline"),
  () => require("./lib/build-pipeline"),
  () => require("./lib/eval-pipeline"),
  () => require("./lib/fix-pipeline"),
  () => require("./lib/analyze-pipeline"),
  // Hybrid pipelines — own their own _jobs registry via hybrid-orchestrator,
  // but expose getJob/getJobLog so findJob() resolves their job IDs through
  // the same /api/skill/status/:jobId SSE endpoint. NOTE: build/eval/fix
  // hybrid all delegate to the shared `hybrid-orchestrator` Map, so any one
  // of them resolving a jobId is sufficient. Listing each separately is
  // safe and self-documenting; findJob's first-match-wins iteration finds
  // the job on the first hit.
  () => require("./lib/build-pipeline-hybrid"),
  () => require("./lib/eval-pipeline-hybrid"),
  () => require("./lib/fix-pipeline-hybrid"),
];

function findJob(jobId) {
  for (const getPipeline of _pipelines) {
    try { const j = getPipeline().getJob(jobId); if (j) return j; } catch { /* */ }
  }
  return skillRunner.getJob(jobId); // fallback stub
}

function findJobLog(jobId) {
  for (const getPipeline of _pipelines) {
    try { const l = getPipeline().getJobLog(jobId); if (l !== null) return l; } catch { /* */ }
  }
  return skillRunner.getJobLog(jobId);
}

app.post("/api/skill/start", (req, res) => {
  const { skillType, projectId, agentId } = req.body || {};
  if (!skillType || !projectId) {
    return res.status(400).json({ error: "skillType and projectId required" });
  }

  // '*-hybrid' variants are opt-in; the matching env var (e.g. MCS_BUILD_HYBRID=1)
  // also flips the plain skillType so existing callers can adopt without changing.
  const VALID_TYPES = [
    "research", "analyze",
    "build", "build-hybrid",
    "eval",  "eval-hybrid",
    "fix",   "fix-hybrid",
  ];
  if (!VALID_TYPES.includes(skillType)) {
    return res.status(400).json({ error: `Invalid skillType. Must be one of: ${VALID_TYPES.join(", ")}` });
  }

  if (!/^[\w-]+$/.test(projectId) || (agentId && !/^[\w-]+$/.test(agentId))) {
    return res.status(400).json({ error: "Invalid projectId or agentId format" });
  }

  // eval / fix / build (and their hybrid aliases) all require agentId.
  // research and analyze treat agentId as optional ('default').
  const REQUIRES_AGENT = ["eval", "eval-hybrid", "fix", "fix-hybrid", "build", "build-hybrid"];
  if (REQUIRES_AGENT.includes(skillType) && !agentId) {
    return res.status(400).json({ error: `agentId required for ${skillType}` });
  }

  const baseDir = path.resolve(path.join(__dirname, ".."));

  // Research and analyze both run through the CLI-backed analyze pipeline.
  // Decision (2026-05-05): converged on CLI-backed for both names so the
  // chat tool, the legacy CTA button, and direct /api/skill/start callers
  // all get the same agentic-mode behavior with access to skills, MCPs,
  // and the knowledge cache. research-pipeline.js is preserved as a file
  // for emergency rollback but no longer reachable through public routes.
  // See knowledge/learnings/cli-vs-api-deep-research.md for the rationale
  // and the deferred GPT-flagged risks (concurrency, prompt-injection
  // sandboxing, observability) that still need follow-up work.
  if (skillType === "research" || skillType === "analyze") {
    try {
      const analyzePipeline = require("./lib/analyze-pipeline");
      const job = analyzePipeline.startAnalyzePipeline(projectId, agentId || "", baseDir);
      return res.json({ jobId: job.id, status: job.status, skillType: "analyze" });
    } catch (err) {
      // Capacity errors deserve 429 + Retry-After so frontends can render
      // a "wait a few minutes" state instead of a generic build failure.
      if (err && err.code === "analyze_capacity_exceeded") {
        res.set("Retry-After", "300"); // hint: 5 min
        return res.status(429).json({
          error: err.message,
          code: "capacity_exceeded",
          retryAfterSeconds: 300,
        });
      }
      return res.status(400).json({ error: err.message });
    }
  }

  // Build, eval, fix — API-direct pipelines (build optionally routed via
  // the hybrid orchestrator when caller opts in or env flips the default).
  try {
    let job;
    if (skillType === "build" || skillType === "build-hybrid") {
      const useHybrid = skillType === "build-hybrid" || process.env.MCS_BUILD_HYBRID === "1";
      if (useHybrid) {
        const buildHybrid = require("./lib/build-pipeline-hybrid");
        job = buildHybrid.startBuildHybridPipeline(projectId, agentId, baseDir);
      } else {
        const buildPipeline = require("./lib/build-pipeline");
        job = buildPipeline.startBuildPipeline(projectId, agentId, baseDir);
      }
    } else if (skillType === "eval" || skillType === "eval-hybrid") {
      const useHybrid = skillType === "eval-hybrid" || process.env.MCS_EVAL_HYBRID === "1";
      if (useHybrid) {
        const evalHybrid = require("./lib/eval-pipeline-hybrid");
        job = evalHybrid.startEvalHybridPipeline(projectId, agentId, baseDir);
      } else {
        const evalPipeline = require("./lib/eval-pipeline");
        job = evalPipeline.startEvalPipeline(projectId, agentId, baseDir);
      }
    } else if (skillType === "fix" || skillType === "fix-hybrid") {
      const useHybrid = skillType === "fix-hybrid" || process.env.MCS_FIX_HYBRID === "1";
      if (useHybrid) {
        const fixHybrid = require("./lib/fix-pipeline-hybrid");
        job = fixHybrid.startFixHybridPipeline(projectId, agentId, baseDir);
      } else {
        const fixPipeline = require("./lib/fix-pipeline");
        job = fixPipeline.startFixPipeline(projectId, agentId, baseDir);
      }
    } else {
      return res.status(400).json({ error: `Unknown skillType: ${skillType}` });
    }
    res.json({ jobId: job.id, status: job.status, skillType });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/skill/status/:jobId", (req, res) => {
  const job = findJob(req.params.jobId);
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
  const log = findJobLog(req.params.jobId);
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
// Helper Chatbot API
// ---------------------------------------------------------------------------

const { loadContext, estimateTokenCount } = require("./lib/helper/context-loader");
const { ChatEngine } = require("./lib/helper/chat-engine");

// Active helper sessions (keyed by session ID)
const helperSessions = new Map();

// Initialize a helper session (loads project context)
app.post("/api/helper/init/:projectId", async (req, res) => {
  try {
    const projectDir = path.join(BUILD_GUIDES, req.params.projectId);
    if (!fs.existsSync(projectDir)) {
      return res.status(404).json({ detail: "Project not found" });
    }

    // model = explicit request body model, else family sentinel "gpt" so the
    // ChatEngine resolves to the latest GPT id at send time.
    const engine = new ChatEngine({
      model: req.body?.model || "gpt"
    });

    const result = await loadContext({
      projectDir,
      agentName: req.body?.agentName
    });

    engine.loadContext(result.context);

    const sessionId = `helper_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    helperSessions.set(sessionId, {
      engine,
      projectId: req.params.projectId,
      projectDir,
      agentName: req.body?.agentName,
      createdAt: Date.now()
    });

    res.json({
      sessionId,
      contextTokens: result.tokens,
      sources: result.sources,
      cached: result.cached
    });
  } catch (err) {
    devLogger.error("helper", "Init failed", err.message);
    res.status(500).json({ detail: err.message });
  }
});

// Send a message (starts async streaming via SSE)
app.post("/api/helper/:id/message", async (req, res) => {
  const session = helperSessions.get(req.params.id);
  if (!session) return res.status(404).json({ detail: "Session not found" });

  const message = req.body?.message;
  if (!message) return res.status(400).json({ detail: "message is required" });

  // Start streaming in background — response delivered via SSE
  session.engine.sendMessage(message).catch(err => {
    devLogger.error("helper", "Message failed", err.message);
  });

  res.json({ messageId: `pending`, status: "streaming" });
});

// SSE stream for real-time helper events
app.get("/api/helper/:id/stream", (req, res) => {
  const session = helperSessions.get(req.params.id);
  if (!session) return res.status(404).json({ detail: "Session not found" });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });

  res.write(`data: ${JSON.stringify({ type: "ready", model: session.engine.model })}\n\n`);

  const handler = (eventName) => (data) => {
    res.write(`data: ${JSON.stringify({ type: eventName, ...data })}\n\n`);
  };

  const events = ['message_start', 'message_delta', 'message_ttft', 'message_complete', 'message_error', 'message_cancelled', 'status'];
  const handlers = {};
  for (const evt of events) {
    handlers[evt] = handler(evt);
    session.engine.on(evt, handlers[evt]);
  }

  req.on("close", () => {
    for (const evt of events) {
      session.engine.off(evt, handlers[evt]);
    }
  });
});

// Close a helper session
app.delete("/api/helper/:id", (req, res) => {
  const session = helperSessions.get(req.params.id);
  if (!session) return res.status(404).json({ detail: "Session not found" });

  session.engine.cancelMessage();
  session.engine.removeAllListeners();
  helperSessions.delete(req.params.id);
  res.json({ closed: true });
});

// List active helper sessions
app.get("/api/helper/sessions", (req, res) => {
  const sessions = [];
  for (const [id, session] of helperSessions) {
    sessions.push({
      id,
      projectId: session.projectId,
      agentName: session.agentName,
      messageCount: session.engine.stats.messages,
      contextTokens: session.engine.contextTokens,
      model: session.engine.model,
      createdAt: session.createdAt
    });
  }
  res.json(sessions);
});

// ---------------------------------------------------------------------------
// Scheduler — recurring automation (cache refresh, upstream checks, etc.)
// ---------------------------------------------------------------------------

app.get("/api/scheduler/status", (req, res) => {
  res.json(scheduler.getStatus());
});

app.post("/api/scheduler/trigger/:jobName", async (req, res) => {
  const { jobName } = req.params;
  try {
    const result = await scheduler.triggerJob(jobName);
    res.json(result);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
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
// Elevate Compatibility — Adapter routes for the forked Elevate frontend
// These routes bridge Elevate's expected API surface to our backend.
// ---------------------------------------------------------------------------

// Feedback (Elevate stores user feedback/ratings)
app.get("/api/feedback", (_req, res) => {
  // Return empty array — Elevate falls back to localStorage on error
  res.json([]);
});
app.post("/api/feedback", (req, res) => {
  // Accept and acknowledge feedback submissions
  devLogger.info("elevate-compat", `Feedback submitted: ${JSON.stringify(req.body).slice(0, 200)}`);
  res.json({ ok: true });
});

// Message feedback (per-message thumbs up/down)
app.post("/api/message-feedback", (req, res) => {
  devLogger.info("elevate-compat", `Message feedback: ${JSON.stringify(req.body).slice(0, 200)}`);
  res.json({ ok: true });
});

// Evals (Elevate's eval system — bridge to our eval pipeline later)
app.get("/api/evals", (_req, res) => {
  res.json([]);
});
app.post("/api/evals", (req, res) => {
  devLogger.info("elevate-compat", `Eval submitted: ${JSON.stringify(req.body).slice(0, 200)}`);
  res.json({ ok: true });
});
app.get("/api/evals/export", (_req, res) => {
  res.setHeader("Content-Type", "text/csv");
  res.send("id,question,expected,actual,score\n");
});

// Eval results (dev-only endpoint Elevate checks)
app.get("/api/eval-results/latest", (_req, res) => {
  res.status(404).json({ detail: "No eval results yet" });
});

// ---------------------------------------------------------------------------
// Auth management — sign out, add account, connect tool
// ---------------------------------------------------------------------------

// Helper: run shell command safely (handles .cmd shims on Windows)
async function runShell(cmd, timeoutMs = 15000) {
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: timeoutMs });
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    return { ok: false, error: err.stderr?.trim() || err.message };
  }
}

// Sign out — clear all CLI auth sessions
app.post("/api/auth/sign-out", async (_req, res) => {
  const results = {};
  const tasks = [
    runShell("az logout").then(r => { results.az = r.ok ? "signed out" : r.error; }),
    runShell("gh auth logout --hostname github.com -y").then(r => { results.gh = r.ok ? "signed out" : r.error; }),
    runShell("pac auth clear").then(r => { results.pac = r.ok ? "signed out" : r.error; }),
  ];
  await Promise.allSettled(tasks);
  // Invalidate caches
  _credCache = { data: null, ts: 0 };
  _platformAgentsCache = { data: null, ts: 0 };
  devLogger.info("auth", "Sign out results", results);
  res.json({ ok: true, results });
});

// Add account — spawn interactive login for a specific tool
// The frontend shows a modal, user clicks a tool, we spawn interactive auth
// The process opens a browser popup for auth, user completes it, we detect success
app.post("/api/auth/add-account", async (req, res) => {
  const { tool, tenant } = req.body || {};
  const validTools = ["az", "gh", "pac", "all"];
  if (!validTools.includes(tool)) {
    return res.status(400).json({ detail: `tool must be one of: ${validTools.join(", ")}` });
  }

  const results = {};
  const steps = [];

  if (tool === "az" || tool === "all") {
    const tenantArg = tenant ? ` --tenant ${tenant}` : "";
    steps.push(
      runShell(`az login${tenantArg}`, 120000)
        .then(r => { results.az = r.ok ? "authenticated" : r.error; })
    );
  }

  if (tool === "gh" || tool === "all") {
    // gh auth login needs interactive terminal — use device flow
    steps.push(
      runShell("gh auth login --hostname github.com --git-protocol https --web", 120000)
        .then(r => { results.gh = r.ok ? "authenticated" : r.error; })
    );
  }

  if (tool === "pac" || tool === "all") {
    steps.push(
      runShell("pac auth create", 120000)
        .then(r => { results.pac = r.ok ? "authenticated" : r.error; })
    );
  }

  await Promise.allSettled(steps);

  // Invalidate caches after auth change
  _credCache = { data: null, ts: 0 };
  _platformAgentsCache = { data: null, ts: 0 };

  devLogger.info("auth", "Add account results", results);
  res.json({ ok: true, results });
});

// Connect/reconnect a specific tool
app.post("/api/auth/connect", async (req, res) => {
  const { tool, tenant } = req.body || {};

  try {
    let result;
    switch (tool) {
      case "az": {
        const tenantArg = tenant ? ` --tenant ${tenant}` : "";
        result = await runShell(`az login${tenantArg}`, 120000);
        break;
      }
      case "gh":
        result = await runShell("gh auth login --hostname github.com --git-protocol https --web", 120000);
        break;
      case "pac":
        result = await runShell("pac auth create", 120000);
        break;
      case "dataverse": {
        // Verify Dataverse connectivity using current pac environment
        result = await runShell("pac env who", 15000);
        break;
      }
      default:
        return res.status(400).json({ detail: "tool must be az, gh, pac, or dataverse" });
    }

    _credCache = { data: null, ts: 0 };
    _platformAgentsCache = { data: null, ts: 0 };

    res.json({ ok: result.ok, tool, detail: result.ok ? "Connected" : result.error });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// ── MCS Knowledge Cache (lazy-loaded, memory-cached for copilot/chat enrichment) ──
let _mcsKnowledgeCache = null;
let _mcsKnowledgeMtime = 0;

function loadMcsKnowledge() {
  const cacheDir = path.join(__dirname, "..", "knowledge", "cache");
  const frameworksDir = path.join(__dirname, "..", "knowledge", "frameworks");
  const files = [
    { dir: cacheDir, name: "connectors.md" },
    { dir: cacheDir, name: "mcp-servers.md" },
    { dir: cacheDir, name: "knowledge-sources.md" },
    { dir: cacheDir, name: "triggers.md" },
    { dir: cacheDir, name: "channels.md" },
    { dir: cacheDir, name: "models.md" },
    { dir: cacheDir, name: "first-party-agents.md" },
    { dir: cacheDir, name: "limits-licensing.md" },
    { dir: cacheDir, name: "declarative-agents.md" },
    { dir: frameworksDir, name: "component-selection.md" },
    { dir: frameworksDir, name: "architecture-scoring.md" },
  ];

  // Check staleness — reload if any source file changed
  let latestMtime = 0;
  for (const f of files) {
    try {
      const mt = fs.statSync(path.join(f.dir, f.name)).mtimeMs;
      if (mt > latestMtime) latestMtime = mt;
    } catch { /* skip missing */ }
  }
  if (_mcsKnowledgeCache && latestMtime <= _mcsKnowledgeMtime) {
    return _mcsKnowledgeCache;
  }

  const sections = ["# MCS CONSULTANT KNOWLEDGE\n"];
  for (const f of files) {
    const fp = path.join(f.dir, f.name);
    if (fs.existsSync(fp)) {
      const label = f.name.replace(".md", "").replace(/-/g, " ").toUpperCase();
      sections.push(`\n## ${label}\n${fs.readFileSync(fp, "utf-8")}\n`);
    }
  }
  _mcsKnowledgeCache = sections.join("");
  _mcsKnowledgeMtime = latestMtime;
  return _mcsKnowledgeCache;
}

/**
 * Map frontend model IDs to backend client + options.
 * Frontend sends family-style IDs like claude-sonnet-4-6, claude-opus-4-7,
 * claude-haiku-4-5, gpt-5.5, gpt-5, gpt-5-mini, etc. The specific version in
 * the string doesn't matter — anthropic.js and openai.js resolve the actual
 * current model ID via auto-discovery. This mapper only normalises to family
 * shorthand (opus/sonnet/haiku) and routes GPT-anything to openai.js, which
 * picks up the latest gpt-N.M without code changes here.
 */
function resolveModelClient(modelId) {
  const openai = require("../tools/lib/openai");
  const anthropic = require("../tools/lib/anthropic");
  const id = (modelId || "").toLowerCase();

  if (id.includes("gpt")) {
    if (openai.isConfigured()) return { client: openai, opts: {} };
    // GPT requested but unavailable — fall back to Claude
    if (anthropic.isConfigured()) return { client: anthropic, opts: { model: "opus" } };
  }

  // Claude model — map to shorthand
  let model = "opus";
  if (id.includes("haiku")) model = "haiku";
  else if (id.includes("sonnet")) model = "sonnet";

  if (anthropic.isConfigured()) return { client: anthropic, opts: { model, cacheSystem: true } };
  // Claude unavailable — fall back to GPT
  if (openai.isConfigured()) return { client: openai, opts: {} };

  return null;
}

// Copilot chat proxy — Elevate's primary LLM endpoint
// Routes to the latest GPT-5.x or Claude via tools/lib/openai.js and tools/lib/anthropic.js.
// Optional mcsKnowledge flag injects the full MCS knowledge cache into the system prompt.
app.post("/api/copilot/chat", async (req, res) => {
  try {
    const { model, maxTokens, messages, system, temperature, mcsKnowledge } = req.body || {};

    // Resolve which model client to use
    const resolved = resolveModelClient(model);
    if (!resolved) {
      return res.status(503).json({
        text: "No model configured. Run 'gh auth login' then 'gh auth refresh --scopes copilot'.",
      });
    }

    // Build system prompt — optionally enriched with MCS knowledge
    let enrichedSystem = system || "";
    if (mcsKnowledge) {
      const knowledge = loadMcsKnowledge();
      if (knowledge) {
        enrichedSystem = knowledge + "\n\n---\n\n" + enrichedSystem;
      }
    }

    // Assemble messages array for the model client
    const fullMessages = [];
    if (enrichedSystem) {
      fullMessages.push({ role: "system", content: enrichedSystem });
    }
    for (const msg of (messages || [])) {
      fullMessages.push({ role: msg.role, content: msg.content });
    }

    const result = await resolved.client.chatCompletion(fullMessages, {
      ...resolved.opts,
      maxTokens: maxTokens || 4096,
    });

    res.json({ text: result.content });
  } catch (err) {
    devLogger.error("copilot-chat", "Error", err.message);
    const status = err.code === "NOT_CONFIGURED" ? 503 : 500;
    res.status(status).json({ text: "Model call failed: " + err.message });
  }
});

// Model proxy (SWA/COLIN alternative endpoint — OpenAI-compatible format)
app.post("/api/model", async (req, res) => {
  try {
    const { model, max_tokens, messages: rawMessages } = req.body || {};

    const resolved = resolveModelClient(model);
    if (!resolved) {
      return res.status(503).json({
        choices: [{ message: { content: "No model configured." } }],
      });
    }

    // OpenAI format: system prompt is a message with role "system", content may be blocks
    const messages = (rawMessages || []).map((m) => ({
      role: m.role,
      content: typeof m.content === "string"
        ? m.content
        : (m.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n"),
    }));

    const result = await resolved.client.chatCompletion(messages, {
      ...resolved.opts,
      maxTokens: max_tokens || 4096,
    });

    res.json({
      choices: [{ message: { content: result.content } }],
    });
  } catch (err) {
    devLogger.error("model", "Error", err.message);
    res.status(500).json({
      choices: [{ message: { content: "Model call failed: " + err.message } }],
    });
  }
});

// Capture endpoints (Playwright/screenshot — stub)
app.get("/api/capture/cdp-status", (_req, res) => {
  res.json({ available: false });
});
app.get("/api/capture/flows", (_req, res) => {
  res.json({ flows: [] });
});
app.post("/api/capture/screenshot", (_req, res) => {
  res.json({ error: "Screenshot capture not available in MCS Agent Builder" });
});
app.post("/api/capture/run-flow", (_req, res) => {
  res.json({ error: "Flow capture not available in MCS Agent Builder" });
});

// Figma plugin (stub — not needed in our setup)
app.get("/api/figma/plugin-status", (_req, res) => {
  res.json({ connected: false });
});
app.get("/api/figma/pages", (_req, res) => {
  res.json({ pages: [] });
});
app.post("/api/figma/upload", (_req, res) => {
  res.json({ sentToPlugin: false, error: "Figma plugin not available" });
});
app.post("/api/figma/save-local", (_req, res) => {
  res.json({ error: "Figma save not available" });
});

// ---------------------------------------------------------------------------
// Static file serving — SPA with catch-all (must be after all API routes)
// ---------------------------------------------------------------------------

// Dev mode: redirect non-API browser requests to the Vite dev server.
// Prevents users from accidentally viewing the stale production build on :8000
// when they should be on :8080 (Vite HMR).
const VITE_DEV_URL = process.env.VITE_DEV_URL;
const IS_DEV_MODE = process.env.MCS_DEV_MODE === "1";

if (!IS_DEV_MODE && fs.existsSync(path.join(DIST_DIR, "assets"))) {
  app.use("/assets", express.static(path.join(DIST_DIR, "assets")));
}

// SPA catch-all — must be last (Express v5 requires named param, not bare *)
app.get("/{*splat}", (req, res) => {
  // Skip API routes that weren't matched
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ detail: "Not found" });
  }

  // Dev mode: redirect to Vite dev server (prevents stale-build confusion)
  if (IS_DEV_MODE && VITE_DEV_URL) {
    return res.redirect(302, VITE_DEV_URL + (req.path === "/" ? "" : req.path));
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
  devLogger.error("server", "uncaught", err.message || String(err));
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

    // Initialize recurring scheduler (cache refresh, upstream checks, etc.)
    try {
      scheduler.initScheduler();
      console.log(`  Scheduler: 6 recurring jobs initialized`);
    } catch (err) {
      console.warn(`  Scheduler: failed to initialize — ${err.message}`);
    }

    // Probe AI model access in background (non-blocking)
    try {
      const anthropicApi = require("../tools/lib/anthropic");
      if (anthropicApi.isConfigured()) {
        anthropicApi.probeModelAccess().then(access => {
          const info = anthropicApi.getModelAccessInfo();
          const directModels = Object.entries(info.access).filter(([k,v]) => v && k !== '_copilotAvailable' && k !== '_primaryRoute').map(([k]) => k);
          if (info.copilotAvailable) {
            console.log(`  AI: copilot=[all models] (default: ${info.effectiveDefault}) — direct API fallback: [${directModels.join(',')}]`);
          } else {
            console.log(`  AI: direct=[${directModels.join(',')}] (default: ${info.effectiveDefault}) — no Copilot available`);
          }
        });
        // Pre-warm forward-probe discovery so the first chat request doesn't
        // pay the 2-3s probe cost. Fires in background — prints the resolved
        // model IDs once done so we can see whether 4.8/5.0 was auto-picked.
        anthropicApi.warmModelResolution().then(resolved => {
          const entries = Object.entries(resolved).map(([k, v]) => `${k}=${v}`).join(', ');
          if (entries) console.log(`  AI: resolved Copilot IDs — ${entries}`);
        }).catch(() => { /* non-critical */ });
        // Pre-warm GPT discovery alongside Claude so /api/models returns the
        // resolved id immediately on first call.
        const openaiApi = require("../tools/lib/openai");
        openaiApi.warmGptModelResolution().then(resolved => {
          if (resolved) console.log(`  AI: resolved GPT ID — ${resolved}`);
        }).catch(() => { /* non-critical */ });
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
  // Force exit after 2.5s if connections don't drain
  setTimeout(() => process.exit(0), 2500).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Export for start.js to spawn
module.exports = { app, server, PORT, BUILD_GUIDES, BASE_DIR };
