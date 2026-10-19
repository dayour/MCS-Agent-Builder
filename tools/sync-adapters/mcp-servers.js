/**
 * mcp-servers adapter (STATIC config fingerprint — no subprocess spawning)
 *
 * Hashes the normalized mcpServers block from .claude/settings.json. Does NOT
 * spawn stdio servers or run `npx @latest` probes — per GPT security review
 * that would turn routine detection into arbitrary code execution and make
 * results non-deterministic (different devs get different pulled versions).
 *
 * Declared pins (source.pinnedVersions) are compared to the same server's
 * args in .claude/settings.json and .mcp.json. A mismatch is part of the
 * fingerprint. For each declared package, dist-tags.latest is read with an
 * HTTPS GET to registry.npmjs.org (no shell). A latest tag that differs from
 * pinnedAt (not only a greater one) is stored as a
 * `registry:<package>@<latest>` secondary key so the next sync opens one
 * TAKE card. The pin is not edited. A failed lookup reuses the previous
 * registry key so an offline run does not flap. The lookup has a total
 * deadline, not only an idle timeout. `isUnverifiable()` only flags @latest
 * or an unpinned npx command; a pinned version that has a different
 * published release is not unverifiable.
 *
 * Normalization applied:
 *   - Keys lowercased, sorted
 *   - Env values stripped — only env KEY names retained (no secrets in hash)
 *   - Arrays preserved in original order (argument order matters)
 *   - Whitespace collapsed
 *
 * Unverifiable detection:
 *   - `npx @latest` in args is flagged as novelty='unverifiable' because the
 *     effective code changes behind a stable config.
 *   - `@latest` or missing version pin in HTTP URL path similarly flagged.
 *
 * Fingerprint shape:
 *   primary:   sha256 of canonicalized mcpServers JSON (keys sorted, values normalized)
 *   secondary: JSON {serverName -> per-server hash} for diff granularity
 *   version:   count of pinned vs unpinned servers
 *   timestamp: settings.json mtime
 */

'use strict';

const fs = require('fs');
const https = require('https');
const path = require('path');
const { sha256 } = require('../lib/ids');

const PACKAGE_NAME_RE = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const VERSION_RE = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,64}$/;
const REGISTRY_HOST = 'registry.npmjs.org';

function settingsPath(root) {
  return path.join(root, '.claude', 'settings.json');
}

function normalizeServerConfig(config) {
  const out = {};
  const type = (config.type || 'stdio').toLowerCase();
  out.type = type;

  if (type === 'http') {
    out.url = config.url || null;
  } else {
    out.command = config.command || null;
    out.args = Array.isArray(config.args) ? config.args.map(a => String(a)) : [];
  }

  if (config.cwd) out.cwd = config.cwd;

  if (config.env && typeof config.env === 'object') {
    out.envKeys = Object.keys(config.env).sort();
  } else {
    out.envKeys = [];
  }

  return out;
}

function isUnverifiable(server) {
  if (server.type === 'http') {
    const url = server.url || '';
    if (/@latest\b/.test(url)) return 'http url uses @latest';
    return null;
  }
  const args = server.args || [];
  for (const a of args) {
    if (/@latest\b/.test(a)) return `args contain @latest: ${a}`;
  }
  if ((server.command || '').toLowerCase() === 'npx' && !args.some(a => /@\d/.test(a))) {
    return 'npx with no pinned version';
  }
  return null;
}

function extractPackageRef(server) {
  if (server.type === 'http') return server.url || 'http://unknown';
  const args = server.args || [];
  for (const a of args) {
    if (/^@?[\w/-]+@[\w.\-]+/.test(a)) return a;
    if (/^[\w/-]+\.js$/.test(a)) return a;
  }
  return `${server.command || ''} ${args.slice(0, 2).join(' ')}`.trim();
}

function registryUrl(packageName) {
  if (typeof packageName !== 'string' || !PACKAGE_NAME_RE.test(packageName)) {
    throw new Error(`invalid npm package name: ${packageName}`);
  }
  return `https://${REGISTRY_HOST}/${packageName.replace(/\//g, '%2F')}`;
}

function parseLatest(text) {
  try {
    const body = JSON.parse(text);
    const latest = body?.['dist-tags']?.latest;
    if (typeof latest !== 'string' || !VERSION_RE.test(latest)) return null;
    return latest;
  } catch {
    return null;
  }
}

function isLoopbackTestUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost');
  } catch {
    return false;
  }
}

// hooks.request / hooks.url exist so tests can point a local http server at
// this function. The default path never reads hooks and only GETs
// https://registry.npmjs.org. A test URL that is not loopback http is refused.
function lookupNpmLatest(packageName, timeoutMs = 5000, hooks) {
  const testRequest = hooks && hooks.request;
  let url;
  if (testRequest) {
    if (!isLoopbackTestUrl(hooks.url)) return Promise.resolve(null);
    url = hooks.url;
  } else {
    try { url = registryUrl(packageName); } catch { return Promise.resolve(null); }
  }
  const request = testRequest || https.get;
  const limit = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000;
  return new Promise((resolve) => {
    let settled = false;
    let deadlineTimer = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadlineTimer);
      resolve(value);
    };
    const req = request(url, {
      headers: {
        accept: 'application/vnd.npm.install-v1+json',
        'user-agent': 'mcs-sync-mcp-pin-check',
      },
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        finish(null);
        return;
      }
      const chunks = [];
      let size = 0;
      let tooBig = false;
      res.on('data', (chunk) => {
        if (settled) return;
        size += chunk.length;
        if (size > 2 * 1024 * 1024) {
          tooBig = true;
          req.destroy();
          finish(null);
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        if (tooBig || settled) return;
        finish(parseLatest(Buffer.concat(chunks).toString('utf8')));
      });
      res.on('error', () => finish(null));
    });
    // Idle timeout: reset by every byte. A slow drip never trips it.
    req.setTimeout(limit, () => {
      req.destroy();
      finish(null);
    });
    // Total deadline: not reset by bytes. Sync runs sources serially with
    // no outer deadline, so this probe must bound itself.
    deadlineTimer = setTimeout(() => {
      req.destroy();
      finish(null);
    }, limit);
    if (settled) clearTimeout(deadlineTimer);
    req.on('error', () => finish(null));
  });
}

function extractVersionPin(serverConfig, packageName) {
  if (!serverConfig || typeof serverConfig !== 'object') return null;
  const args = Array.isArray(serverConfig.args) ? serverConfig.args.map((a) => String(a)) : [];
  const prefix = `${packageName}@`;
  for (const arg of args) {
    if (!arg.startsWith(prefix)) continue;
    const version = arg.slice(prefix.length);
    if (version && !version.includes('@')) return version;
  }
  return null;
}

function compareDeclaredPins(pinnedVersions, settingsServers, mcpServers, mcpUnreadable) {
  const mismatches = [];
  for (const serverName of Object.keys(pinnedVersions || {}).sort()) {
    const spec = pinnedVersions[serverName] || {};
    if (typeof spec.package !== 'string' || !PACKAGE_NAME_RE.test(spec.package)) continue;
    if (typeof spec.pinnedAt !== 'string' || !VERSION_RE.test(spec.pinnedAt)) continue;
    const settingsPin = extractVersionPin(settingsServers?.[serverName], spec.package);
    const mcpPin = mcpUnreadable ? null : extractVersionPin(mcpServers?.[serverName], spec.package);
    if (settingsPin !== spec.pinnedAt || mcpPin !== spec.pinnedAt || mcpUnreadable) {
      mismatches.push({
        serverName,
        package: spec.package,
        pinnedAt: spec.pinnedAt,
        settingsPin,
        mcpPin,
        mcpUnreadable: !!mcpUnreadable,
      });
    }
  }
  return mismatches;
}

function pinMismatchLine(mismatch) {
  const clean = (value, fallback) => String(value == null || value === '' ? fallback : value).replace(/[\r\n]/g, '');
  const mcp = mismatch.mcpUnreadable ? 'unreadable' : clean(mismatch.mcpPin, 'missing');
  return `pin-mismatch:${clean(mismatch.serverName, 'unknown')}:settings=${clean(mismatch.settingsPin, 'missing')}:mcp=${mcp}:expected=${clean(mismatch.pinnedAt, 'missing')}`;
}

function previousRegistryKeys(prevSnapshot, packageName) {
  const secondary = safeParse(prevSnapshot?.fingerprint?.secondary) || {};
  const prefix = `registry:${packageName}@`;
  return Object.keys(secondary).filter((key) => key.startsWith(prefix)).sort();
}

async function registryDriftKeys({ packageName, pinnedAt, prevSnapshot, lookup }) {
  if (typeof packageName !== 'string' || !PACKAGE_NAME_RE.test(packageName)) return [];
  let latest = null;
  try {
    latest = await lookup(packageName);
  } catch {
    latest = null;
  }
  if (typeof latest === 'string' && VERSION_RE.test(latest)) {
    // Different from pinnedAt, including an older published tag. Not a semver compare.
    return latest === pinnedAt ? [] : [`registry:${packageName}@${latest}`];
  }
  return previousRegistryKeys(prevSnapshot, packageName);
}

function readMcpJsonServers(root) {
  const p = path.join(root, '.mcp.json');
  if (!fs.existsSync(p)) return { servers: {}, missing: true };
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { servers: data && typeof data.mcpServers === 'object' && data.mcpServers ? data.mcpServers : {} };
  } catch (e) {
    return { servers: {}, error: e.message };
  }
}

function readMcpServers(root) {
  const p = settingsPath(root);
  if (!fs.existsSync(p)) return { error: `settings.json missing at ${p}` };
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    const servers = data.mcpServers || {};
    const mtime = fs.statSync(p).mtimeMs;
    return { servers, mtime };
  } catch (e) {
    return { error: `cannot parse settings.json: ${e.message}` };
  }
}

async function detect({ source, prevSnapshot, root, lookupLatest } = {}) {
  const read = readMcpServers(root);
  if (read.error) return { error: read.error };

  const names = Object.keys(read.servers).sort();
  if (names.length === 0) return { error: 'no mcpServers configured in .claude/settings.json' };

  const perServer = {};
  const unverifiableCount = { total: 0, byName: {} };

  for (const name of names) {
    const normalized = normalizeServerConfig(read.servers[name]);
    const canonicalJson = JSON.stringify(normalized, Object.keys(normalized).sort());
    const hash = sha256(canonicalJson);
    perServer[name] = hash;
    const unv = isUnverifiable(normalized);
    if (unv) {
      unverifiableCount.total++;
      unverifiableCount.byName[name] = unv;
    }
  }

  const mcpRead = readMcpJsonServers(root);
  const pinMismatches = compareDeclaredPins(
    source?.pinnedVersions,
    read.servers,
    mcpRead.servers,
    !!mcpRead.error,
  );
  const lookup = lookupLatest || lookupNpmLatest;
  const registryDrift = [];
  for (const serverName of Object.keys(source?.pinnedVersions || {}).sort()) {
    const spec = source.pinnedVersions[serverName] || {};
    if (typeof spec.package !== 'string' || typeof spec.pinnedAt !== 'string') continue;
    const keys = await registryDriftKeys({
      packageName: spec.package,
      pinnedAt: spec.pinnedAt,
      prevSnapshot,
      lookup,
    });
    registryDrift.push(...keys);
  }
  const registryKeys = [...new Set(registryDrift)].sort();

  const lines = names.map((n) => `${n}:${perServer[n]}`);
  for (const mismatch of pinMismatches) lines.push(pinMismatchLine(mismatch));
  lines.push(...registryKeys);
  const overall = sha256(lines.join('\n'));
  const secondary = { ...perServer };
  for (const key of registryKeys) secondary[key] = 'drift';
  const versionTag = `${names.length} servers, ${unverifiableCount.total} unpinned`;

  return {
    fingerprint: {
      primary: overall,
      secondary: JSON.stringify(secondary),
      version: versionTag,
      timestamp: new Date(read.mtime).toISOString(),
    },
    meta: {
      servers: names,
      unverifiable: unverifiableCount,
      pinMismatches,
      registryDrift: registryKeys,
    },
  };
}

async function understand({ source, before, after, root }) {
  const bMap = safeParse(before?.fingerprint?.secondary) || {};
  const aMap = safeParse(after?.fingerprint?.secondary) || {};

  const read = root ? readMcpServers(root) : {};
  const changedServers = [];
  const addedServers = [];
  const removedServers = [];
  const unverifiable = after?.meta?.unverifiable?.byName || {};
  const isAnnotation = (name) => name.startsWith('registry:') || name.startsWith('pin-mismatch:');

  for (const name of Object.keys(aMap)) {
    if (isAnnotation(name)) continue;
    if (!(name in bMap)) addedServers.push(name);
    else if (bMap[name] !== aMap[name]) changedServers.push(name);
  }
  for (const name of Object.keys(bMap)) {
    if (isAnnotation(name)) continue;
    if (!(name in aMap)) removedServers.push(name);
  }

  const signals = [];
  const evidence = [];
  let severity = 'low';
  let breakingRisk = 'low';
  let novelty = 'incremental';

  if (addedServers.length > 0) {
    signals.push(`new MCP server(s): ${addedServers.join(', ')}`);
    severity = 'medium';
    novelty = 'new_content';
  }
  if (removedServers.length > 0) {
    signals.push(`removed MCP server(s): ${removedServers.join(', ')}`);
    severity = 'medium';
    breakingRisk = 'medium';
  }
  if (changedServers.length > 0) {
    signals.push(`modified MCP server(s): ${changedServers.join(', ')}`);
    if (severity === 'low') severity = 'low';
  }

  for (const name of changedServers.concat(addedServers).slice(0, 6)) {
    const norm = read.servers ? normalizeServerConfig(read.servers[name] || {}) : {};
    evidence.push({
      type: 'mcp_server_change',
      excerpt: `${name}: ${extractPackageRef(norm)}${unverifiable[name] ? ` [UNVERIFIABLE: ${unverifiable[name]}]` : ''}`,
    });
  }

  const unverifiableHits = Object.keys(unverifiable);
  const pinMismatches = Array.isArray(after?.meta?.pinMismatches) ? after.meta.pinMismatches : [];
  const registryDrift = Object.keys(aMap).filter((name) => name.startsWith('registry:')).sort();
  if (pinMismatches.length > 0) {
    signals.push(`pinned MCP package mismatch: ${pinMismatches.map((m) => m.serverName).join(', ')}`);
    severity = 'medium';
    for (const mismatch of pinMismatches.slice(0, 6)) {
      evidence.push({ type: 'mcp_pin_mismatch', excerpt: pinMismatchLine(mismatch) });
    }
  }
  if (registryDrift.length > 0) {
    signals.push(`npm latest differs from pinnedAt: ${registryDrift.join(', ')}`);
    severity = 'medium';
    for (const key of registryDrift.slice(0, 6)) {
      evidence.push({ type: 'npm_registry_drift', excerpt: key });
    }
  }
  if (unverifiableHits.length > 0) {
    signals.push(`${unverifiableHits.length} server(s) have unpinned versions (behavior may drift silently): ${unverifiableHits.slice(0, 3).join(', ')}`);
    if (novelty !== 'new_content') novelty = 'unverifiable';
    evidence.push({
      type: 'unverifiable_warning',
      excerpt: Object.entries(unverifiable).slice(0, 4).map(([n, r]) => `${n}: ${r}`).join('; '),
    });
  }

  const { recommendation, actionPlan } = recommend({
    addedServers, removedServers, changedServers, unverifiableHits, pinMismatches, registryDrift,
  });

  return {
    severity,
    confidence: 0.9,
    classification: {
      kind: 'dependency',
      subkind: 'mcp_config_drift',
      breakingRisk,
      novelty,
    },
    recommendation,
    actionPlan,
    evidence,
    headline: buildHeadline({ addedServers, removedServers, changedServers, pinMismatches, registryDrift }),
    why: signals.length > 0 ? signals : ['mcpServers config hash differs from prior snapshot'],
  };
}

function recommend({ addedServers, removedServers, changedServers, unverifiableHits, pinMismatches, registryDrift }) {
  const pinCount = pinMismatches?.length || 0;
  const driftCount = registryDrift?.length || 0;
  const meaningful = addedServers.length > 0 || removedServers.length > 0 || changedServers.length > 0
    || pinCount > 0 || driftCount > 0;
  if (!meaningful && unverifiableHits.length === 0) {
    return { recommendation: 'REJECT', actionPlan: 'No MCP server configuration drift.' };
  }
  const steps = [];
  if (addedServers.length > 0) steps.push(`Document new MCP server(s) in CLAUDE.md plugin table: ${addedServers.join(', ')}`);
  if (removedServers.length > 0) steps.push(`Remove references to gone server(s): ${removedServers.join(', ')}`);
  if (changedServers.length > 0) steps.push(`Validate skills still bind to changed server(s): ${changedServers.join(', ')}`);
  if (unverifiableHits.length > 0) steps.push(`Pin unstable @latest references where reproducibility matters (${unverifiableHits.length} server(s)).`);
  if (pinCount > 0) {
    steps.push(`Align ${pinMismatches.map((m) => m.serverName).join(', ')} across .claude/settings.json, .mcp.json, and pinnedVersions. The adapter does not edit the pin.`);
  }
  if (driftCount > 0) {
    steps.push(`Review registry drift (${registryDrift.join(', ')}). Update pinnedAt and both config files together only if you accept that different release.`);
  }
  steps.push('Re-run sync to clear the card after edits.');
  return { recommendation: 'TAKE', actionPlan: steps.join('\n') };
}

function buildHeadline({ addedServers, removedServers, changedServers, pinMismatches, registryDrift }) {
  const parts = [];
  if (addedServers.length > 0) parts.push(`+${addedServers.length} added`);
  if (removedServers.length > 0) parts.push(`-${removedServers.length} removed`);
  if (changedServers.length > 0) parts.push(`~${changedServers.length} modified`);
  if (pinMismatches?.length > 0) parts.push(`${pinMismatches.length} pin mismatch`);
  if (registryDrift?.length > 0) parts.push(`${registryDrift.length} registry drift`);
  return `MCP servers: ${parts.join(', ') || 'config changed'}`;
}

function safeParse(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

module.exports = {
  detect,
  understand,
  compareDeclaredPins,
  registryUrl,
  registryDriftKeys,
  parseLatest,
  pinMismatchLine,
  lookupNpmLatest,
};
