/**
 * Meeting Context Loader
 *
 * Reads and caches all project context + MCS knowledge for the answer engine.
 * No LLM call — just fast file reads and structured concatenation.
 *
 * Sources:
 * 1. Customer Context — brief.json, uploaded docs
 * 2. MCS Knowledge — knowledge/cache/*.md files (connectors, MCPs, triggers, etc.)
 * 3. Frameworks — component selection, architecture scoring
 *
 * Cache: Writes a combined context file to disk. Invalidated when any source
 * file is newer than the cache. Prompt caching on the API side handles the
 * repeated-system-prompt optimization automatically.
 */

const fs = require('fs');
const path = require('path');
const { extractContent } = require('../documents');

const MAX_DOC_CHARS = 20000; // Per-document truncation limit

// Key knowledge cache files for MCS solutioning
const MCS_KNOWLEDGE_FILES = [
  'connectors.md',
  'mcp-servers.md',
  'knowledge-sources.md',
  'triggers.md',
  'channels.md',
  'models.md',
  'first-party-agents.md',
  'limits-licensing.md',
  'declarative-agents.md'
];

const KNOWLEDGE_DIR = path.join(__dirname, '..', '..', '..', 'knowledge');
const FRAMEWORKS_DIR = path.join(KNOWLEDGE_DIR, 'frameworks');

/**
 * Build or load cached meeting context for the answer engine.
 *
 * Fast path: if cache exists and no source files changed, returns cached text (~5ms).
 * Slow path: reads all source files and concatenates (~50-200ms, no LLM call).
 *
 * @param {object} options
 * @param {string} options.projectDir - Path to the project directory (Build-Guides/<project>/)
 * @param {string} [options.agentName] - Specific agent name (optional)
 * @param {function} [options.onProgress] - Progress callback
 * @returns {Promise<{briefing: string, tokens: number, sources: string[], cached: boolean}>}
 */
async function generateBriefing(options) {
  const { projectDir, agentName, onProgress } = options;

  // Check if cached context is still fresh
  const cachePath = getCachePath(projectDir, agentName);
  if (fs.existsSync(cachePath)) {
    const cacheTime = fs.statSync(cachePath).mtimeMs;
    const sourcePaths = getSourcePaths(projectDir, agentName);
    const latestSource = getLatestMtime(sourcePaths);

    if (latestSource <= cacheTime) {
      if (onProgress) onProgress({ stage: 'done', message: 'Context loaded from cache' });
      const briefing = fs.readFileSync(cachePath, 'utf-8');
      return { briefing, tokens: estimateTokenCount(briefing), sources: ['(cached)'], cached: true };
    }
  }

  if (onProgress) onProgress({ stage: 'gathering', message: 'Reading project context...' });

  const sources = [];
  const sections = [];

  // ── Section 1: Customer Context ────────────────────────────────────
  sections.push('# CUSTOMER CONTEXT\n');

  // 1a. Load brief.json
  const briefPath = agentName
    ? path.join(projectDir, 'agents', agentName, 'brief.json')
    : findBriefJson(projectDir);
  if (briefPath && fs.existsSync(briefPath)) {
    try {
      const brief = JSON.parse(fs.readFileSync(briefPath, 'utf-8'));
      sections.push(formatBrief(brief));
      sources.push('brief.json');
    } catch { /* ignore parse errors */ }
  }

  // 1b. Load all brief.json files from all agents (multi-agent projects)
  const agentsDir = path.join(projectDir, 'agents');
  if (fs.existsSync(agentsDir)) {
    const agentDirs = fs.readdirSync(agentsDir).filter(f => {
      try { return fs.statSync(path.join(agentsDir, f)).isDirectory(); } catch { return false; }
    });
    for (const dir of agentDirs) {
      if (dir === agentName) continue; // Already loaded above (explicit agent)
      const otherBrief = path.join(agentsDir, dir, 'brief.json');
      // Skip if this is the same file findBriefJson returned (avoids duplication when agentName is null)
      if (briefPath && path.resolve(otherBrief) === path.resolve(briefPath)) continue;
      if (fs.existsSync(otherBrief)) {
        try {
          const brief = JSON.parse(fs.readFileSync(otherBrief, 'utf-8'));
          sections.push(`\n## Agent: ${dir}\n`);
          sections.push(formatBrief(brief));
          sources.push(`agents/${dir}/brief.json`);
        } catch { /* skip */ }
      }
    }
  }

  // 1c. Load uploaded customer documents
  if (onProgress) onProgress({ stage: 'loading_docs', message: 'Reading customer documents...' });
  const docsDir = path.join(projectDir, 'docs');
  if (fs.existsSync(docsDir)) {
    const docFiles = fs.readdirSync(docsDir).filter(f => !f.startsWith('.'));
    for (const file of docFiles.slice(0, 8)) { // Max 8 docs
      try {
        const { content } = await extractContent(path.join(docsDir, file));
        if (content) {
          sections.push(`\n### Document: ${file}\n${content.substring(0, MAX_DOC_CHARS)}\n`);
          sources.push(file);
        }
      } catch { /* skip unreadable docs */ }
    }
  }

  // ── Section 2: MCS Knowledge ───────────────────────────────────────
  if (onProgress) onProgress({ stage: 'loading_knowledge', message: 'Loading MCS knowledge...' });
  sections.push('\n\n# MCS CONSULTANT KNOWLEDGE\n');

  const cacheDir = path.join(KNOWLEDGE_DIR, 'cache');
  for (const file of MCS_KNOWLEDGE_FILES) {
    const filePath = path.join(cacheDir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      sections.push(`\n## ${file.replace('.md', '').replace(/-/g, ' ').toUpperCase()}\n`);
      sections.push(content + '\n');
      sources.push(`cache/${file}`);
    }
  }

  // ── Section 3: Frameworks ──────────────────────────────────────────
  sections.push('\n\n# DECISION FRAMEWORKS\n');

  const frameworkFiles = ['component-selection.md', 'architecture-scoring.md'];
  for (const file of frameworkFiles) {
    const filePath = path.join(FRAMEWORKS_DIR, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      sections.push(`\n## ${file.replace('.md', '').replace(/-/g, ' ').toUpperCase()}\n`);
      sections.push(content + '\n');
      sources.push(`frameworks/${file}`);
    }
  }

  // ── Section 4: Learnings ───────────────────────────────────────────
  const learningsDir = path.join(KNOWLEDGE_DIR, 'learnings');
  if (fs.existsSync(learningsDir)) {
    const learningFiles = fs.readdirSync(learningsDir).filter(f => f.endsWith('.md'));
    if (learningFiles.length > 0) {
      sections.push('\n\n# LEARNINGS FROM PAST BUILDS\n');
      for (const file of learningFiles.slice(0, 5)) {
        try {
          const content = fs.readFileSync(path.join(learningsDir, file), 'utf-8');
          sections.push(`\n## ${file.replace('.md', '')}\n${content.substring(0, 3000)}\n`);
          sources.push(`learnings/${file}`);
        } catch { /* skip */ }
      }
    }
  }

  const briefing = sections.join('');
  const tokens = estimateTokenCount(briefing);

  // Write cache
  const cacheDirectory = path.dirname(cachePath);
  if (!fs.existsSync(cacheDirectory)) fs.mkdirSync(cacheDirectory, { recursive: true });
  fs.writeFileSync(cachePath, briefing, 'utf-8');

  if (onProgress) onProgress({ stage: 'done', message: `Context ready (${tokens} est. tokens, ${sources.length} sources)`, tokens });

  return { briefing, tokens, sources, cached: false };
}

/**
 * Get the cache file path for a project's meeting context.
 */
function getCachePath(projectDir, agentName) {
  return agentName
    ? path.join(projectDir, 'agents', agentName, '.meeting-context-cache.md')
    : path.join(projectDir, '.meeting-context-cache.md');
}

/**
 * Get all source file paths that the context depends on.
 * Used to check if cache is stale.
 */
function getSourcePaths(projectDir, agentName) {
  const paths = [];

  // Brief.json files
  const briefPath = agentName
    ? path.join(projectDir, 'agents', agentName, 'brief.json')
    : findBriefJson(projectDir);
  if (briefPath) paths.push(briefPath);

  // All agent briefs
  const agentsDir = path.join(projectDir, 'agents');
  if (fs.existsSync(agentsDir)) {
    try {
      const dirs = fs.readdirSync(agentsDir).filter(f => {
        try { return fs.statSync(path.join(agentsDir, f)).isDirectory(); } catch { return false; }
      });
      for (const d of dirs) {
        const bp = path.join(agentsDir, d, 'brief.json');
        if (fs.existsSync(bp)) paths.push(bp);
      }
    } catch { /* skip */ }
  }

  // Individual doc files (dir mtime only changes on add/remove, not edit)
  const docsDir = path.join(projectDir, 'docs');
  if (fs.existsSync(docsDir)) {
    paths.push(docsDir);
    try {
      const docFiles = fs.readdirSync(docsDir).filter(f => !f.startsWith('.')).slice(0, 8);
      for (const f of docFiles) paths.push(path.join(docsDir, f));
    } catch { /* skip */ }
  }

  // Knowledge cache files
  const cacheDir = path.join(KNOWLEDGE_DIR, 'cache');
  for (const file of MCS_KNOWLEDGE_FILES) {
    const fp = path.join(cacheDir, file);
    if (fs.existsSync(fp)) paths.push(fp);
  }

  // Framework files
  for (const file of ['component-selection.md', 'architecture-scoring.md']) {
    const fp = path.join(FRAMEWORKS_DIR, file);
    if (fs.existsSync(fp)) paths.push(fp);
  }

  // Learnings files (must match the slice(0, 5) in generateBriefing)
  const learningsDir = path.join(KNOWLEDGE_DIR, 'learnings');
  if (fs.existsSync(learningsDir)) {
    paths.push(learningsDir);
    try {
      const files = fs.readdirSync(learningsDir).filter(f => f.endsWith('.md')).slice(0, 5);
      for (const f of files) paths.push(path.join(learningsDir, f));
    } catch { /* skip */ }
  }

  return paths;
}

/**
 * Get the latest modification time across a list of paths.
 */
function getLatestMtime(filePaths) {
  let latest = 0;
  for (const fp of filePaths) {
    try {
      const mtime = fs.statSync(fp).mtimeMs;
      if (mtime > latest) latest = mtime;
    } catch { /* missing file, skip */ }
  }
  return latest;
}

/**
 * Simple token count estimate (~4 chars per token for English).
 */
function estimateTokenCount(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Format brief.json into readable text.
 */
function formatBrief(brief) {
  const sections = [];

  if (brief.business) {
    const b = brief.business;
    sections.push(`Business: ${b.name || 'Unknown'}`);
    if (b.industry) sections.push(`Industry: ${b.industry}`);
    if (b.description) sections.push(`Description: ${b.description}`);
    if (b.size) sections.push(`Size: ${b.size}`);
  }

  if (brief.capabilities && brief.capabilities.length > 0) {
    sections.push(`\nCapabilities needed:`);
    for (const cap of brief.capabilities) {
      sections.push(`- ${cap.name}: ${cap.description || ''}`);
    }
  }

  if (brief.integrations && brief.integrations.length > 0) {
    sections.push(`\nIntegrations:`);
    for (const int of brief.integrations) {
      sections.push(`- ${int.system || int.name}: ${int.description || ''}`);
    }
  }

  if (brief.boundaries && brief.boundaries.length > 0) {
    sections.push(`\nBoundaries/constraints:`);
    for (const b of brief.boundaries) {
      sections.push(`- ${typeof b === 'string' ? b : b.rule || JSON.stringify(b)}`);
    }
  }

  if (brief.decisions && brief.decisions.length > 0) {
    sections.push(`\nDecisions:`);
    for (const d of brief.decisions) {
      sections.push(`- ${d.decision}: ${d.rationale || ''}`);
    }
  }

  return sections.join('\n');
}

/**
 * Find brief.json in a project directory (searches agents/ subdirectories).
 */
function findBriefJson(projectDir) {
  const direct = path.join(projectDir, 'brief.json');
  if (fs.existsSync(direct)) return direct;

  const agentsDir = path.join(projectDir, 'agents');
  if (fs.existsSync(agentsDir)) {
    try {
      const agents = fs.readdirSync(agentsDir).filter(f =>
        fs.statSync(path.join(agentsDir, f)).isDirectory()
      );
      for (const agent of agents) {
        const briefPath = path.join(agentsDir, agent, 'brief.json');
        if (fs.existsSync(briefPath)) return briefPath;
      }
    } catch { /* skip */ }
  }

  return null;
}

/**
 * Load an existing cached context from disk.
 */
function loadBriefing(projectDir, agentName) {
  const cachePath = getCachePath(projectDir, agentName);
  if (fs.existsSync(cachePath)) {
    return fs.readFileSync(cachePath, 'utf-8');
  }
  // Fallback: check old-style briefing file
  const oldPath = agentName
    ? path.join(projectDir, 'agents', agentName, 'meeting-briefing.md')
    : path.join(projectDir, 'meeting-briefing.md');
  if (fs.existsSync(oldPath)) {
    return fs.readFileSync(oldPath, 'utf-8');
  }
  return null;
}

/**
 * Save context to disk (for backwards compat — generateBriefing already caches).
 */
function saveBriefing(projectDir, briefing, agentName) {
  const cachePath = getCachePath(projectDir, agentName);
  const dir = path.dirname(cachePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(cachePath, briefing, 'utf-8');
  return cachePath;
}

module.exports = { generateBriefing, loadBriefing, saveBriefing, findBriefJson, estimateTokenCount };
