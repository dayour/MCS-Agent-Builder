'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

test('sync tracks both official Copilot Studio plugin repositories and installations', () => {
  const upstream = readJson('knowledge/upstream-repos.json');
  const trackedRepos = new Set(upstream.repos.map(({ repo }) => repo));
  assert.ok(trackedRepos.has('microsoft/skills-for-copilot-studio'));
  assert.ok(trackedRepos.has('microsoft/copilot-studio-plugin'));

  const manifest = readJson('knowledge/sync-manifest.json');
  const plugins = manifest.sources.find(({ id }) => id === 'plugins');
  assert.deepEqual(plugins.trackedPlugins, [
    'copilot-studio@skills-for-copilot-studio',
    'mcs-assistant@copilot-studio-plugin',
  ]);
});
