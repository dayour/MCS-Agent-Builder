/**
 * knowledge-retriever.js — BM25 retrieval over knowledge/cache + knowledge/frameworks.
 *
 * Replaces the "inject all 24 cache files" pattern in /api/copilot/chat
 * (~50K tokens per turn) with k=3-4 chunks per turn (~1.5K tokens). Keeps
 * Anthropic prompt cache hot and saves cost.
 *
 * Self-contained — no npm deps. Plain BM25 over heading-chunked markdown.
 * Index built at server boot, refreshed when files mtime changes.
 *
 * Used by the `query_knowledge` tool in the unified /api/chat endpoint.
 */

const fs = require('fs');
const path = require('path');

const KNOWLEDGE_ROOTS = [
  path.join(__dirname, '..', '..', '..', 'knowledge', 'cache'),
  path.join(__dirname, '..', '..', '..', 'knowledge', 'frameworks'),
];

// BM25 parameters (defaults that work well for tech docs)
const K1 = 1.5;
const B = 0.75;

let _index = null;            // { docs, df, avgLen, totalDocs, builtAt }
let _buildPromise = null;     // dedup concurrent boot builds

const STOPWORDS = new Set([
  'a','an','and','are','as','at','be','by','for','from','has','have','he','her','his',
  'i','in','is','it','its','of','on','or','our','she','that','the','their','them','then',
  'there','these','they','this','to','was','were','will','with','you','your','yours',
]);

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9_\-/.]+/g, ' ')
    .split(/\s+/)
    .filter(t => t && t.length > 1 && !STOPWORDS.has(t));
}

/** Split a markdown file into chunks by H1/H2/H3 headings. */
function chunkMarkdown(content, file) {
  const lines = content.split(/\r?\n/);
  const chunks = [];
  let current = { heading: null, depth: 0, body: [] };

  const flush = () => {
    const body = current.body.join('\n').trim();
    if (body || current.heading) {
      chunks.push({
        file,
        heading: current.heading || path.basename(file, '.md'),
        text: (current.heading ? `# ${current.heading}\n` : '') + body,
      });
    }
  };

  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+)$/);
    if (m) {
      flush();
      current = { heading: m[2].trim(), depth: m[1].length, body: [] };
    } else {
      current.body.push(line);
    }
  }
  flush();

  // Drop empty chunks
  return chunks.filter(c => c.text && c.text.length > 50);
}

function listMarkdownFiles() {
  const out = [];
  for (const root of KNOWLEDGE_ROOTS) {
    if (!fs.existsSync(root)) continue;
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
      }
    };
    walk(root);
  }
  return out;
}

/** Build (or rebuild) the BM25 index over all markdown chunks. */
async function buildIndex() {
  if (_buildPromise) return _buildPromise;

  _buildPromise = (async () => {
    const files = listMarkdownFiles();
    const docs = [];

    for (const file of files) {
      let content;
      try { content = fs.readFileSync(file, 'utf-8'); } catch { continue; }
      for (const chunk of chunkMarkdown(content, file)) {
        const tokens = tokenize(chunk.text);
        if (tokens.length === 0) continue;
        const tf = Object.create(null);
        for (const tok of tokens) tf[tok] = (tf[tok] || 0) + 1;
        docs.push({
          id: docs.length,
          file: chunk.file,
          heading: chunk.heading,
          text: chunk.text,
          tokens,
          tf,
          len: tokens.length,
        });
      }
    }

    // Document frequency per term
    const df = Object.create(null);
    for (const doc of docs) {
      for (const tok of Object.keys(doc.tf)) df[tok] = (df[tok] || 0) + 1;
    }

    const totalLen = docs.reduce((s, d) => s + d.len, 0);
    const avgLen = docs.length ? totalLen / docs.length : 0;

    _index = {
      docs,
      df,
      avgLen,
      totalDocs: docs.length,
      builtAt: Date.now(),
    };
    return _index;
  })();

  try {
    return await _buildPromise;
  } finally {
    _buildPromise = null;
  }
}

/** Score a doc against query tokens using BM25. */
function scoreDoc(queryTokens, doc, idx) {
  let score = 0;
  for (const qt of queryTokens) {
    const docFreq = idx.df[qt];
    if (!docFreq) continue;
    const tf = doc.tf[qt] || 0;
    if (!tf) continue;
    // IDF with +1 smoothing to avoid negatives
    const idf = Math.log((idx.totalDocs - docFreq + 0.5) / (docFreq + 0.5) + 1);
    const norm = 1 - B + B * (doc.len / (idx.avgLen || 1));
    const tfNorm = (tf * (K1 + 1)) / (tf + K1 * norm);
    score += idf * tfNorm;
  }
  return score;
}

/**
 * Retrieve top-k chunks for a free-text query.
 * @param {object} args
 * @param {string} args.query
 * @param {number} [args.k=4]
 * @param {string[]} [args.topics] - Optional file basename filter (e.g. ['mcp-servers', 'connectors'])
 * @returns {Promise<Array<{file: string, heading: string, text: string, score: number}>>}
 */
async function retrieve({ query, k = 4, topics }) {
  if (!_index) await buildIndex();
  const idx = _index;
  if (!idx || idx.docs.length === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const filter = topics && topics.length
    ? new Set(topics.map(t => t.toLowerCase().replace(/\.md$/, '')))
    : null;

  const scored = [];
  for (const doc of idx.docs) {
    if (filter) {
      const base = path.basename(doc.file, '.md').toLowerCase();
      if (!filter.has(base)) continue;
    }
    const score = scoreDoc(queryTokens, doc, idx);
    if (score > 0) scored.push({ doc, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map(({ doc, score }) => ({
    file: path.relative(path.join(__dirname, '..', '..', '..'), doc.file),
    heading: doc.heading,
    text: doc.text.length > 1500 ? doc.text.slice(0, 1500) + '\n...[truncated]' : doc.text,
    score: Math.round(score * 100) / 100,
  }));
}

/** Force-rebuild the index (e.g. after a sync). */
function rebuildIndex() {
  _index = null;
  return buildIndex();
}

function getIndexInfo() {
  if (!_index) return { built: false };
  return {
    built: true,
    totalChunks: _index.totalDocs,
    avgLen: Math.round(_index.avgLen),
    builtAt: _index.builtAt,
    files: KNOWLEDGE_ROOTS,
  };
}

module.exports = {
  retrieve,
  rebuildIndex,
  buildIndex,
  getIndexInfo,
};
