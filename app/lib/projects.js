/**
 * Project and agent CRUD helpers.
 *
 * Extracts the scanning/listing/document helpers from server.py
 * into a reusable module consumed by server.js routes.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  humanizeName,
  calcReadiness,
  isBuildReady,
  determineStage,
  SKIP_FOLDERS,
} = require("./readiness");
const { migrateSpec } = require("./spec-migrate");

// File types shown in the dashboard document list
const DOC_EXTENSIONS = new Set([
  ".md", ".csv", ".json", ".txt",
  ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp",
  ".pdf",
  ".docx", ".pptx", ".xlsx", ".xls",
]);

// Binary Office formats that need text extraction
const NEEDS_CONVERSION = new Set([".docx", ".pptx", ".xlsx", ".xls"]);

// Formats Claude Code reads natively
const NATIVE_READABLE = new Set([
  ".md", ".csv", ".json", ".txt",
  ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp",
  ".pdf", ".ipynb",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDirs(folder) {
  const docsDir = path.join(folder, "docs");
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
}

function fileSha256(fp) {
  const hash = crypto.createHash("sha256");
  const content = fs.readFileSync(fp);
  hash.update(content);
  return hash.digest("hex");
}

function loadManifest(folder) {
  const manifestPath = path.join(folder, "doc-manifest.json");
  if (fs.existsSync(manifestPath)) {
    try {
      const raw = fs.readFileSync(manifestPath, "utf-8").replace(/^\uFEFF/, "");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Atomically write doc-manifest.json (write .tmp then rename).
 * @param {string} folder  Project folder (contains docs/)
 * @param {Object} manifest  Full manifest object with docsProcessed[]
 */
function saveManifest(folder, manifest) {
  if (!manifest || !Array.isArray(manifest.docsProcessed)) {
    throw new Error("Invalid manifest: must have docsProcessed array");
  }
  const manifestPath = path.join(folder, "doc-manifest.json");
  const tmpPath = manifestPath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(manifest, null, 2), "utf-8");
  fs.renameSync(tmpPath, manifestPath);
}

/**
 * Mark a single document as processed in the manifest.
 * Creates the manifest if it doesn't exist.
 *
 * @param {string} folder     Project folder
 * @param {string} filename   Document filename (in docs/)
 * @param {Object} [opts]     Optional: { source, matchedAgents, status }
 */
function markDocProcessed(folder, filename, opts = {}) {
  markDocsProcessed(folder, [filename], opts);
}

/**
 * Mark multiple documents as processed in a single manifest write.
 * Creates the manifest if it doesn't exist.
 *
 * @param {string} folder       Project folder
 * @param {string[]} filenames  Document filenames (in docs/)
 * @param {Object} [opts]       Optional: { source, matchedAgents, status }
 */
function markDocsProcessed(folder, filenames, opts = {}) {
  const docsDir = path.join(folder, "docs");
  let manifest = loadManifest(folder) || {
    projectId: path.basename(folder),
    lastResearchAt: null,
    docsProcessed: [],
  };

  const existingMap = {};
  for (const entry of manifest.docsProcessed) {
    existingMap[entry.filename] = entry;
  }

  const now = new Date().toISOString();
  for (const filename of filenames) {
    const fp = path.join(docsDir, filename);
    if (!fs.existsSync(fp)) continue;

    const stat = fs.statSync(fp);
    const sha256 = fileSha256(fp);
    const entry = {
      filename,
      sha256,
      size: stat.size,
      mtime: stat.mtimeMs / 1000,
      processedAt: now,
      source: opts.source || "enrichment",
      matchedAgents: opts.matchedAgents || [],
      status: opts.status || "processed",
    };

    if (existingMap[filename]) {
      Object.assign(existingMap[filename], entry);
    } else {
      manifest.docsProcessed.push(entry);
      existingMap[filename] = entry;
    }
  }

  manifest.lastResearchAt = now;
  saveManifest(folder, manifest);
}

// ---------------------------------------------------------------------------
// Document scanning
// ---------------------------------------------------------------------------

function scanDocs(folder) {
  const docsDir = path.join(folder, "docs");
  const docs = [];

  const manifest = loadManifest(folder);
  const manifestEntries = {};
  if (manifest) {
    if (Array.isArray(manifest.docsProcessed)) {
      // New format: { docsProcessed: [{ filename, matchedAgents, ... }] }
      for (const entry of manifest.docsProcessed) {
        manifestEntries[entry.filename] = entry;
      }
    } else {
      // Old flat format: { "filename.md": { hash, processedAt } }
      for (const [filename, entry] of Object.entries(manifest)) {
        if (typeof entry === "object" && entry !== null) {
          manifestEntries[filename] = entry;
        }
      }
    }
  }

  if (fs.existsSync(docsDir)) {
    const files = fs.readdirSync(docsDir).sort();
    for (const name of files) {
      const fp = path.join(docsDir, name);
      if (!fs.statSync(fp).isFile()) continue;
      const ext = path.extname(name).toLowerCase();
      if (!DOC_EXTENSIONS.has(ext)) continue;

      const stat = fs.statSync(fp);
      let isNew = true;
      let isModified = false;
      let matchedAgents = [];

      if (manifest !== null) {
        const known = manifestEntries[name];
        if (known) {
          isNew = false;
          matchedAgents = known.matchedAgents || [];
          const knownSize = known.size;
          const knownMtime = known.mtime;
          if (knownSize != null && knownMtime != null) {
            isModified =
              stat.size !== knownSize ||
              Math.abs(stat.mtimeMs / 1000 - knownMtime) > 1.0;
          } else if (known.sha256) {
            const currentHash = fileSha256(fp);
            isModified = currentHash.toLowerCase() !== known.sha256.toLowerCase();
          }
        }
      }

      docs.push({
        filename: name,
        size: stat.size,
        mtime: stat.mtimeMs,
        isNew,
        isModified,
        matchedAgents,
      });
    }
  }

  return docs;
}

// ---------------------------------------------------------------------------
// Agent scanning (server-level — includes readiness, eval rates, etc.)
// ---------------------------------------------------------------------------

function scanAgents(folder) {
  const agentsDir = path.join(folder, "agents");
  const agents = [];

  if (!fs.existsSync(agentsDir)) return agents;

  const entries = fs.readdirSync(agentsDir).sort();
  for (const name of entries) {
    const agentDir = path.join(agentsDir, name);
    if (!fs.statSync(agentDir).isDirectory() || name.startsWith(".")) continue;

    // Resolve spec file: agentspec.json preferred, brief.json fallback
    const specFile = fs.existsSync(path.join(agentDir, "agentspec.json"))
      ? path.join(agentDir, "agentspec.json")
      : path.join(agentDir, "brief.json");
    let brief = null;
    if (fs.existsSync(specFile)) {
      try {
        const raw = fs.readFileSync(specFile, "utf-8").replace(/^\uFEFF/, "");
        brief = JSON.parse(raw);
      } catch {
        // ignore
      }
    }

    // Extract name/description supporting both v1 and v2
    let agentName, agentDesc;
    if (brief && brief.step1 && !brief.agent) {
      agentName = (brief.step1 || {}).agentName || humanizeName(name);
      agentDesc = ((brief.step1 || {}).problem || "").slice(0, 150);
    } else if (brief) {
      agentName = (brief.agent || {}).name || humanizeName(name);
      agentDesc = (
        (brief.agent || {}).description ||
        (brief.business || {}).useCase ||
        ""
      ).slice(0, 150);
    } else {
      agentName = humanizeName(name);
      agentDesc = "";
    }

    // Eval pass rate
    let evalPassRate = null;
    if (brief) {
      let totalTested = 0;
      let totalPassed = 0;
      for (const es of brief.evalSets || []) {
        for (const t of es.tests || []) {
          const lr = t.lastResult;
          if (lr) {
            totalTested++;
            if (lr.pass) totalPassed++;
          }
        }
      }
      if (totalTested > 0) {
        evalPassRate = Math.round((totalPassed / totalTested) * 100);
      } else {
        // Legacy fallback
        const er = brief.evalResults || {};
        if (typeof er === "object") {
          const summary = er.summary || {};
          if ((summary.total || 0) > 0) {
            const pr = summary.passRate;
            if (typeof pr === "string" && pr.endsWith("%")) {
              const num = parseFloat(pr);
              if (!isNaN(num)) evalPassRate = num;
            }
            if (evalPassRate === null) {
              const total = summary.total || 0;
              const passed = summary.passed || 0;
              if (total > 0) evalPassRate = Math.round((passed / total) * 100);
            }
          }
        }
      }
    }

    // Architecture metadata
    let archType = "";
    let archChildren = [];
    if (brief) {
      const arch = brief.architecture || {};
      if (typeof arch === "object") {
        archType = arch.type || "";
        for (const child of arch.children || []) {
          const fid = child.agentFolderId || "";
          if (fid) archChildren.push(fid);
        }
      }
    }

    // Workflow phase
    let workflowPhase = null;
    if (brief) {
      const wf = brief.workflow || {};
      if (typeof wf === "object" && wf.phase) {
        workflowPhase = wf.phase;
      }
    }

    // Eval-gate projection — surface the minimum required for the frontend's
    // EvalGateBadge without leaking spec internals. evalGate is passed
    // through filterEvalGateForViewer at the listProjects / getProject
    // boundary so viewer role gets honored.
    const buildStatusRaw = brief?.buildStatus?.status || null;
    const evalGateRaw = brief?.evalGate || null;

    agents.push({
      id: name,
      name: agentName,
      description: agentDesc,
      has_brief: brief !== null,
      has_instructions: brief ? !!brief.instructions : false,
      has_evals: fs.existsSync(path.join(agentDir, "evals.csv")),
      has_build_report: fs.existsSync(path.join(agentDir, "build-report.md")),
      readiness: brief ? calcReadiness(brief) : 0,
      build_ready: brief ? isBuildReady(brief) : false,
      eval_pass_rate: evalPassRate,
      folder: path.relative(folder, agentDir).replace(/\\/g, "/"),
      architecture_type: archType,
      architecture_children: archChildren,
      workflow_phase: workflowPhase,
      buildStatusRaw,
      evalGate: evalGateRaw,  // unfiltered here; filtered at the API boundary
      _brief: brief,
    });
  }

  return agents;
}

// ---------------------------------------------------------------------------
// Project listing
// ---------------------------------------------------------------------------

function listProjects(buildGuidesDir) {
  const projects = [];
  if (!fs.existsSync(buildGuidesDir)) return projects;

  const entries = fs.readdirSync(buildGuidesDir).sort();
  for (const name of entries) {
    const itemPath = path.join(buildGuidesDir, name);
    if (!fs.statSync(itemPath).isDirectory()) continue;
    if (SKIP_FOLDERS.has(name) || name.startsWith(".")) continue;

    const hasContent =
      fs.existsSync(path.join(itemPath, "docs")) ||
      fs.existsSync(path.join(itemPath, "agents")) ||
      fs.readdirSync(itemPath).some((f) => f.endsWith(".md")) ||
      fs.existsSync(path.join(itemPath, "session-state.json"));

    if (!hasContent) continue;

    const stat = fs.statSync(itemPath);
    const agents = scanAgents(itemPath);
    const stage = determineStage(agents);

    // Strip _brief + filter evalGate for viewer role before sending to client
    const { filterEvalGateForViewer } = require("./eval-gate-flags");
    const viewerRole = (listProjects.__viewerRole) || "maker";
    for (const a of agents) {
      delete a._brief;
      if (a.evalGate) a.evalGate = filterEvalGateForViewer(a.evalGate, viewerRole);
    }

    // Lightweight doc count
    const docsDir = path.join(itemPath, "docs");
    let docCount = 0;
    if (fs.existsSync(docsDir)) {
      for (const f of fs.readdirSync(docsDir)) {
        const fp = path.join(docsDir, f);
        if (fs.statSync(fp).isFile() && DOC_EXTENSIONS.has(path.extname(f).toLowerCase())) {
          docCount++;
        }
      }
    }

    const createdAt = new Date(stat.birthtimeMs || stat.ctimeMs);
    projects.push({
      id: name,
      name: humanizeName(name),
      path: `Build-Guides/${name}`,
      agents,
      doc_count: docCount,
      stage,
      created_at: createdAt.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      }),
    });
  }

  return projects;
}

// ---------------------------------------------------------------------------
// Single project detail
// ---------------------------------------------------------------------------

function getProject(buildGuidesDir, projectId) {
  const folder = path.join(buildGuidesDir, projectId);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    return null;
  }

  ensureDirs(folder);

  const docs = scanDocs(folder);
  const agents = scanAgents(folder);
  const stage = determineStage(agents);

  const { filterEvalGateForViewer } = require("./eval-gate-flags");
  const viewerRole = (getProject.__viewerRole) || "maker";
  for (const a of agents) {
    delete a._brief;
    if (a.evalGate) a.evalGate = filterEvalGateForViewer(a.evalGate, viewerRole);
  }

  return {
    id: path.basename(folder),
    name: humanizeName(path.basename(folder)),
    path: `Build-Guides/${path.basename(folder)}`,
    agents,
    docs,
    doc_content: {},
    stage,
  };
}

// ---------------------------------------------------------------------------
// Doc status (manifest comparison)
// ---------------------------------------------------------------------------

function getDocStatus(buildGuidesDir, projectId) {
  const folder = path.join(buildGuidesDir, projectId);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    return null;
  }

  const manifest = loadManifest(folder);
  if (!manifest) {
    return {
      hasManifest: false,
      lastResearchAt: null,
      newDocs: [],
      changedDocs: [],
      deletedDocs: [],
      needsUpdate: false,
    };
  }

  const manifestEntries = {};
  for (const entry of manifest.docsProcessed || []) {
    manifestEntries[entry.filename] = entry;
  }

  const docsDir = path.join(folder, "docs");
  const newDocs = [];
  const changedDocs = [];
  const currentFilenames = new Set();

  if (fs.existsSync(docsDir)) {
    const files = fs.readdirSync(docsDir).sort();
    for (const name of files) {
      const fp = path.join(docsDir, name);
      if (!fs.statSync(fp).isFile()) continue;
      if (!DOC_EXTENSIONS.has(path.extname(name).toLowerCase())) continue;

      currentFilenames.add(name);
      const entry = manifestEntries[name];
      if (!entry) {
        newDocs.push(name);
      } else {
        const currentHash = fileSha256(fp);
        if (currentHash !== (entry.sha256 || "").toLowerCase()) {
          changedDocs.push(name);
        }
      }
    }
  }

  const deletedDocs = Object.keys(manifestEntries).filter(
    (name) => !currentFilenames.has(name)
  );

  return {
    hasManifest: true,
    lastResearchAt: manifest.lastResearchAt || null,
    newDocs,
    changedDocs,
    deletedDocs,
    needsUpdate: newDocs.length > 0 || changedDocs.length > 0,
  };
}

module.exports = {
  DOC_EXTENSIONS,
  NEEDS_CONVERSION,
  NATIVE_READABLE,
  ensureDirs,
  fileSha256,
  loadManifest,
  saveManifest,
  markDocProcessed,
  markDocsProcessed,
  scanDocs,
  scanAgents,
  listProjects,
  getProject,
  getDocStatus,
  humanizeName,
  calcReadiness,
  isBuildReady,
};
