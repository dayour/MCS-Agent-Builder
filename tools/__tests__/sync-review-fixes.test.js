'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const plugins = require('../sync-adapters/plugins');
const mcp = require('../sync-adapters/mcp-servers');

const ROOT = path.resolve(__dirname, '..', '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

test('copilot-studio-plugin watch paths match the 2026-10-19 GitHub tree', () => {
  // github.com/microsoft/copilot-studio-plugin root on 2026-10-19:
  // .claude-plugin, agents, commands, hooks, reference, scripts, skills.
  // templates/ and schemas/ are not in that tree. commands/, reference/,
  // hooks/, and .claude-plugin/ are the authoring surface that was unwatched.
  const upstream = readJson('knowledge/upstream-repos.json');
  const repo = upstream.repos.find((entry) => entry.repo === 'microsoft/copilot-studio-plugin');
  assert.deepEqual(repo.watchPaths, [
    '.claude-plugin/',
    'agents/',
    'commands/',
    'hooks/',
    'reference/',
    'scripts/',
    'skills/',
  ]);
  assert.equal(repo.watchPaths.includes('templates/'), false);
  assert.equal(repo.watchPaths.includes('schemas/'), false);
});

test('a missing tracked plugin changes the fingerprint and recommends TAKE', async () => {
  const tracked = [
    'copilot-studio@skills-for-copilot-studio',
    'mcs-assistant@copilot-studio-plugin',
  ];
  const installed = {
    plugins: {
      'copilot-studio@skills-for-copilot-studio': [{ version: '1.2.3', gitCommitSha: 'abc', lastUpdated: '2026-10-01T00:00:00.000Z' }],
      'other@other': [{ version: '0.1.0', gitCommitSha: 'def', lastUpdated: '2026-10-02T00:00:00.000Z' }],
    },
  };
  const missing = plugins.buildPluginDetection({ trackedPlugins: tracked }, installed);
  const present = plugins.buildPluginDetection({ trackedPlugins: tracked }, {
    plugins: {
      ...installed.plugins,
      'mcs-assistant@copilot-studio-plugin': [{ version: '1.0.0', gitCommitSha: 'fff', lastUpdated: '2026-10-03T00:00:00.000Z' }],
    },
  });

  assert.deepEqual(missing.meta.missingTrackedPlugins, ['mcs-assistant@copilot-studio-plugin']);
  assert.deepEqual(present.meta.missingTrackedPlugins, []);
  assert.notEqual(missing.fingerprint.primary, present.fingerprint.primary);

  const understood = await plugins.understand({
    source: { trackedPlugins: tracked },
    before: { fingerprint: present.fingerprint },
    after: missing,
  });
  assert.equal(understood.recommendation, 'TAKE');
  assert.equal(understood.evidence.some((item) => item.type === 'tracked_plugin_missing'), true);
  assert.match(understood.actionPlan, /mcs-assistant@copilot-studio-plugin/);

  const quiet = await plugins.understand({
    before: { fingerprint: present.fingerprint },
    after: present,
  });
  assert.equal(quiet.recommendation, 'REJECT');
});

function writeMcpFixture(dir, { settingsPin = '1.0.0', mcpPin = '1.0.0', omitMcp = false } = {}) {
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  const settings = {
    mcpServers: {
      workiq: { type: 'stdio', command: 'npx', args: ['-y', `@microsoft/workiq@${settingsPin}`, 'mcp'] },
    },
  };
  fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), JSON.stringify(settings));
  if (!omitMcp) {
    const mcpJson = {
      mcpServers: {
        workiq: { command: 'cmd', args: ['/c', 'npx', '-y', `@microsoft/workiq@${mcpPin}`, 'mcp'] },
      },
    };
    fs.writeFileSync(path.join(dir, '.mcp.json'), JSON.stringify(mcpJson));
  }
}

const pinnedSource = {
  pinnedVersions: {
    workiq: { package: '@microsoft/workiq', pinnedAt: '1.0.0' },
  },
};

test('registry URL only accepts a package name and encodes the slash', () => {
  assert.equal(mcp.registryUrl('@microsoft/workiq'), 'https://registry.npmjs.org/@microsoft%2Fworkiq');
  assert.throws(() => mcp.registryUrl('../evil'), /invalid npm package name/);
  assert.throws(() => mcp.registryUrl('workiq?x=1'), /invalid npm package name/);
});

test('pin mismatch between settings and .mcp.json changes the fingerprint and recommends TAKE', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-pin-'));
  writeMcpFixture(dir, { settingsPin: '1.0.0', mcpPin: '9.9.9' });
  const lookup = async () => '1.0.0';
  const drifted = await mcp.detect({ source: pinnedSource, root: dir, lookupLatest: lookup });
  assert.equal(drifted.meta.pinMismatches.length, 1);
  assert.equal(drifted.meta.pinMismatches[0].mcpPin, '9.9.9');
  assert.deepEqual(drifted.meta.registryDrift, []);

  const alignedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-pin-ok-'));
  writeMcpFixture(alignedDir);
  const aligned = await mcp.detect({ source: pinnedSource, root: alignedDir, lookupLatest: lookup });
  assert.deepEqual(aligned.meta.pinMismatches, []);
  assert.notEqual(drifted.fingerprint.primary, aligned.fingerprint.primary);

  const understood = await mcp.understand({ after: drifted, before: { fingerprint: aligned.fingerprint } });
  assert.equal(understood.recommendation, 'TAKE');
  assert.equal(understood.evidence.some((item) => item.type === 'mcp_pin_mismatch'), true);
});

test('a newer registry latest opens one TAKE card and a failed lookup reuses the previous key', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-reg-'));
  writeMcpFixture(dir);
  const drifted = await mcp.detect({
    source: pinnedSource,
    root: dir,
    lookupLatest: async () => '1.0.1',
  });
  assert.deepEqual(drifted.meta.registryDrift, ['registry:@microsoft/workiq@1.0.1']);

  const understood = await mcp.understand({
    after: drifted,
    before: { fingerprint: { secondary: JSON.stringify({ workiq: 'old' }) } },
  });
  assert.equal(understood.recommendation, 'TAKE');
  assert.equal(understood.evidence.some((item) => item.type === 'npm_registry_drift'), true);
  assert.equal(understood.evidence.some((item) => item.type === 'mcp_server_change' && /registry:/.test(item.excerpt || '')), false);
  const addedAsServer = (understood.why || []).some((line) => /new MCP server/.test(line) && /registry:/.test(line));
  assert.equal(addedAsServer, false);

  const offline = await mcp.detect({
    source: pinnedSource,
    root: dir,
    prevSnapshot: { fingerprint: drifted.fingerprint },
    lookupLatest: async () => { throw new Error('offline'); },
  });
  assert.deepEqual(offline.meta.registryDrift, ['registry:@microsoft/workiq@1.0.1']);
  assert.equal(offline.fingerprint.primary, drifted.fingerprint.primary);

  const inSync = await mcp.detect({
    source: pinnedSource,
    root: dir,
    lookupLatest: async () => '1.0.0',
  });
  assert.deepEqual(inSync.meta.registryDrift, []);
  const quiet = await mcp.understand({ after: inSync, before: { fingerprint: inSync.fingerprint } });
  assert.equal(quiet.recommendation, 'REJECT');
});

function withLocalServer(handler, run) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', async () => {
      try {
        resolve(await run(server.address().port));
      } catch (err) {
        reject(err);
      } finally {
        server.closeAllConnections();
        server.close();
      }
    });
  });
}

function lookupLocal(port, timeoutMs, pathname = '/pkg') {
  return mcp.lookupNpmLatest('@microsoft/workiq', timeoutMs, {
    request: http.get,
    url: `http://127.0.0.1:${port}${pathname}`,
  });
}

test('lookupNpmLatest against a local server covers status, size, and deadline', async () => {
  const ok = await withLocalServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ 'dist-tags': { latest: '1.2.3' } }));
  }, (port) => lookupLocal(port, 2000));
  assert.equal(ok, '1.2.3');

  const tooBig = await withLocalServer((req, res) => {
    res.writeHead(200);
    const chunk = Buffer.alloc(256 * 1024, 0x61);
    let sent = 0;
    const writeMore = () => {
      if (res.destroyed) return;
      while (sent <= (2 * 1024 * 1024) + chunk.length) {
        const canContinue = res.write(chunk);
        sent += chunk.length;
        if (!canContinue) {
          res.once('drain', writeMore);
          return;
        }
      }
      res.end();
    };
    writeMore();
  }, (port) => lookupLocal(port, 5000));
  assert.equal(tooBig, null);

  const silentStarted = Date.now();
  const silent = await withLocalServer(() => {}, (port) => lookupLocal(port, 400));
  const silentElapsed = Date.now() - silentStarted;
  assert.equal(silent, null);
  assert.ok(silentElapsed < 1500, `silent lookup took ${silentElapsed}ms`);

  const dripStarted = Date.now();
  const drip = await withLocalServer((req, res) => {
    res.writeHead(200);
    res.write('x');
    const timer = setInterval(() => { res.write('x'); }, 3000);
    res.on('close', () => clearInterval(timer));
  }, (port) => lookupLocal(port, 5000));
  const dripElapsed = Date.now() - dripStarted;
  assert.equal(drip, null);
  assert.ok(dripElapsed >= 4500, `drip resolved too fast (${dripElapsed}ms)`);
  assert.ok(dripElapsed < 5500, `drip resolved too slow (${dripElapsed}ms)`);

  const redirected = await withLocalServer((req, res) => {
    if (req.url === '/target') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ 'dist-tags': { latest: '9.9.9' } }));
      return;
    }
    res.writeHead(302, { location: '/target' });
    res.end();
  }, (port) => lookupLocal(port, 2000, '/start'));
  assert.equal(redirected, null);

  const missing = await withLocalServer((req, res) => {
    res.writeHead(404);
    res.end('no such package');
  }, (port) => lookupLocal(port, 2000));
  assert.equal(missing, null);

  const reset = await withLocalServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.write('{"dist-tags":{"latest":"1.0.1"');
    res.destroy();
  }, (port) => lookupLocal(port, 2000));
  assert.equal(reset, null);
});

test('lookup hooks cannot leave loopback http', async () => {
  let called = false;
  const result = await mcp.lookupNpmLatest('@microsoft/workiq', 200, {
    request: () => { called = true; },
    url: 'https://registry.npmjs.org/@microsoft%2Fworkiq',
  });
  assert.equal(called, false);
  assert.equal(result, null);
  assert.equal(new URL(mcp.registryUrl('@microsoft/workiq')).hostname, 'registry.npmjs.org');
});

test('parseLatest ignores a non-version dist-tag', () => {
  assert.equal(mcp.parseLatest(JSON.stringify({ 'dist-tags': { latest: '1.0.1' } })), '1.0.1');
  assert.equal(mcp.parseLatest(JSON.stringify({ 'dist-tags': { latest: 'not a version\ninjected' } })), null);
  assert.equal(mcp.parseLatest('not-json'), null);
});
