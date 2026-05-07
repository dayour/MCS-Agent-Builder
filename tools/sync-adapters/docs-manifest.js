/**
 * docs-manifest adapter
 *
 * Probes the curated MS Learn URLs in knowledge/docs-manifest.json and
 * fingerprints their content. Surfaces per-URL drift as TAKE cards whose
 * action plan tells the user which knowledge/cache files to update.
 *
 * Fingerprint shape:
 *   primary:   sha256 of sorted "<url>:<contentHash>" lines
 *   secondary: JSON {url -> contentHash} for diff
 *   version:   ISO of newest probe
 *   timestamp: ISO of newest probe
 *
 * Notes:
 *   - Network probe with 30s per-URL timeout. If gh/network is offline, the
 *     adapter returns { error } and the orchestrator surfaces a no-op card.
 *   - Cache directory `knowledge/docs-cache/` is gitignored. Adapter writes
 *     fetched content there for future diffing but does NOT modify any
 *     committed file.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { sha256 } = require('../lib/ids');

const REL_MANIFEST = 'knowledge/docs-manifest.json';
const REL_CACHE = 'knowledge/docs-cache';

function slugify(url) {
  return url.replace(/^https?:\/\//, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}

function httpGet(url, ifModifiedSince, redirects = 5) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: { 'User-Agent': 'mcs-sync-docs/1.0', 'Accept': 'text/html,application/xhtml+xml' },
      timeout: 30000,
    };
    if (ifModifiedSince) opts.headers['If-Modified-Since'] = ifModifiedSince;
    const req = https.get(url, opts, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        return httpGet(next, ifModifiedSince, redirects - 1).then(resolve, reject);
      }
      if (res.statusCode === 304) { res.resume(); return resolve({ status: 304, headers: res.headers }); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      let data = '';
      res.setEncoding('utf-8');
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: 200, body: data, headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`timeout: ${url}`)); });
  });
}

function extractHtmlText(html) {
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const src = main ? main[1] : html;
  const art = src.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const content = art ? art[1] : src;
  return content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<\/?(h[1-6]|p|li|div|section|article|pre|code|blockquote)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
}

async function probeManifest(root) {
  const manifestPath = path.join(root, REL_MANIFEST);
  if (!fs.existsSync(manifestPath)) throw new Error(`${REL_MANIFEST} missing`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const docs = manifest.docs || [];
  const cacheDir = path.join(root, REL_CACHE);
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

  const perUrl = {};
  const errors = [];
  for (const doc of docs) {
    try {
      const slug = slugify(doc.url);
      const cachePath = path.join(cacheDir, `${slug}.txt`);
      const resp = await httpGet(doc.url, null);
      if (resp.status === 304) {
        perUrl[doc.url] = fs.existsSync(cachePath) ? sha256(fs.readFileSync(cachePath, 'utf8')) : 'unmodified-no-cache';
        continue;
      }
      const content = extractHtmlText(resp.body);
      const hash = sha256(content);
      perUrl[doc.url] = hash;
      try { fs.writeFileSync(cachePath, content); } catch {}
    } catch (e) {
      perUrl[doc.url] = `error:${e.message.slice(0, 40)}`;
      errors.push({ url: doc.url, error: e.message });
    }
  }
  return { docs, perUrl, errors };
}

async function detect({ source, root }) {
  try {
    const { docs, perUrl, errors } = await probeManifest(root);
    const lines = Object.keys(perUrl).sort().map(u => `${u}:${perUrl[u]}`);
    const primary = sha256(lines.join('\n'));
    const now = new Date().toISOString();
    return {
      fingerprint: {
        primary,
        secondary: JSON.stringify(perUrl),
        version: now,
        timestamp: now,
      },
      meta: { docCount: docs.length, errorCount: errors.length, errors: errors.slice(0, 5) },
    };
  } catch (e) {
    return { error: e.message };
  }
}

async function understand({ source, before, after, root }) {
  const bMap = safeParse(before?.fingerprint?.secondary) || {};
  const aMap = safeParse(after?.fingerprint?.secondary) || {};

  // Read manifest to map urls -> appliesTo
  const manifestPath = path.join(root, REL_MANIFEST);
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { docs: [] };
  const appliesByUrl = {};
  for (const d of manifest.docs || []) appliesByUrl[d.url] = d.appliesTo || [];

  const changed = [];
  const added = [];
  const removed = [];
  const errored = [];

  for (const url of Object.keys(aMap)) {
    if (String(aMap[url]).startsWith('error:')) { errored.push(url); continue; }
    if (!(url in bMap)) added.push(url);
    else if (bMap[url] !== aMap[url]) changed.push(url);
  }
  for (const url of Object.keys(bMap)) {
    if (!(url in aMap)) removed.push(url);
  }

  const meaningful = changed.length > 0 || added.length > 0 || removed.length > 0;
  const cacheTargets = new Set();
  for (const url of changed.concat(added)) {
    for (const f of (appliesByUrl[url] || [])) cacheTargets.add(f);
  }

  const evidence = [];
  for (const url of changed.slice(0, 5)) {
    evidence.push({ type: 'doc_changed', ref: url, excerpt: `appliesTo=${(appliesByUrl[url] || []).join(', ') || '—'}` });
  }
  for (const url of added.slice(0, 3)) evidence.push({ type: 'doc_added', ref: url });
  for (const url of removed.slice(0, 3)) evidence.push({ type: 'doc_removed', ref: url });
  for (const url of errored.slice(0, 3)) evidence.push({ type: 'fetch_error', ref: url });

  let recommendation = 'REJECT';
  const planSteps = [];
  if (meaningful) {
    recommendation = 'TAKE';
    if (changed.length > 0) planSteps.push(`Review ${changed.length} changed MS Learn URL(s); diff knowledge/docs-cache/ entries.`);
    if (cacheTargets.size > 0) planSteps.push(`Update affected cache file(s): ${Array.from(cacheTargets).join(', ')}`);
    if (added.length > 0) planSteps.push(`Inspect newly tracked URL(s) and add to cache where applicable: ${added.slice(0, 3).join(', ')}${added.length > 3 ? '…' : ''}`);
    if (removed.length > 0) planSteps.push(`Remove or repoint references to dropped URL(s): ${removed.slice(0, 3).join(', ')}${removed.length > 3 ? '…' : ''}`);
    planSteps.push('Bump `last_verified` in each updated knowledge/cache/*.md after edits.');
    planSteps.push('Re-run sync to clear the card.');
  } else if (errored.length > 0) {
    planSteps.push(`Network/auth issue probing ${errored.length} URL(s); re-run when connectivity is restored.`);
  } else {
    planSteps.push('No content drift on tracked MS Learn URLs.');
  }

  return {
    severity: meaningful ? (cacheTargets.size > 3 ? 'medium' : 'low') : 'none',
    confidence: errored.length > 5 ? 0.4 : 0.85,
    classification: {
      kind: 'content',
      subkind: 'ms_learn_doc_drift',
      breakingRisk: changed.length > 5 ? 'medium' : 'low',
      novelty: added.length > 0 ? 'new_content' : 'incremental',
    },
    recommendation,
    actionPlan: planSteps.join('\n'),
    evidence,
    headline: buildHeadline({ changed, added, removed, errored }),
    why: meaningful ? [`${changed.length} changed, ${added.length} added, ${removed.length} removed, ${errored.length} errored`] : ['no doc drift'],
  };
}

function buildHeadline({ changed, added, removed, errored }) {
  const parts = [];
  if (changed.length > 0) parts.push(`${changed.length} changed`);
  if (added.length > 0) parts.push(`${added.length} added`);
  if (removed.length > 0) parts.push(`${removed.length} removed`);
  if (errored.length > 0) parts.push(`${errored.length} errored`);
  return `MS Learn docs: ${parts.join(', ') || 'minor'}`;
}

function safeParse(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

module.exports = { detect, understand };
