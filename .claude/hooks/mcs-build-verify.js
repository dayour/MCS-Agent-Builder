#!/usr/bin/env node
/**
 * MCS Build Verify Hook (PostToolUse on Bash)
 *
 * Detects MCS push commands in Bash tool calls and fires the verify-iterate
 * loop in the background. Result lands in tools/build-log.jsonl. Stop hook
 * surfaces classifications other than identical/expected-divergence.
 *
 * Patterns matched:
 *   node tools/mcs-lsp.js push --workspace <path>
 *   node tools/add-tool.js push --workspace <path>
 *
 * Bypasses:
 *   - CLAUDE_HEADLESS=1            sub-agent edits don't recursively trigger
 *   - input.isSidechain === true   teammate-originated edits
 *   - CLAUDE_OFF_AUTO_BUILD_VERIFY=1   user opt-out
 *   - tool_name not Bash
 *   - command did not match a push pattern
 *
 * The hook is fast (under 50ms): it parses, spawns a detached verify worker,
 * and exits. The worker pulls from Dataverse (via mcs-lsp.js pull) and
 * classifies divergence.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

if (process.env.CLAUDE_HEADLESS === '1') process.exit(0);
if (process.env.CLAUDE_OFF_AUTO_BUILD_VERIFY === '1') process.exit(0);

const ROOT = path.resolve(__dirname, '..', '..');
const BUILD_LOOP = path.join(ROOT, 'tools', 'mcs-build-loop.js');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    if (input.isSidechain === true || input.source === 'subagent') process.exit(0);
    if (input.tool_name !== 'Bash') process.exit(0);

    const cmd = (input.tool_input && input.tool_input.command) || '';
    if (!cmd) process.exit(0);

    // Match recognized push commands. Use anchored patterns to avoid false
    // positives in surrounding shell pipelines.
    const pushPattern = /\b(?:node\s+)?(?:tools[/\\])?(?:mcs-lsp\.js|add-tool\.js)\s+push\b/;
    if (!pushPattern.test(cmd)) process.exit(0);

    const workspace = extractWorkspace(cmd);
    if (!workspace) {
      process.stdout.write('[mcs-build-loop] push detected but --workspace not parseable; skipping verify');
      process.exit(0);
    }

    const operation = cmd.includes('add-tool.js') ? 'add-tool-push' : 'mcs-lsp-push';

    const child = spawn(process.execPath, [BUILD_LOOP, 'verify', '--workspace', workspace, '--operation', operation], {
      cwd: ROOT,
      stdio: 'ignore',
      detached: true,
      windowsHide: true,
      env: { ...process.env, CLAUDE_HEADLESS: '1' },
    });
    child.unref();

    process.stdout.write(
      `[mcs-build-loop] ${operation} verify queued (pid ${child.pid}). ` +
      `Result will append to tools/build-log.jsonl. Disable with CLAUDE_OFF_AUTO_BUILD_VERIFY=1.`
    );
    process.exit(0);
  } catch {
    process.exit(0);
  }
});

function extractWorkspace(cmd) {
  // Match --workspace "path with spaces", --workspace 'single quoted', or --workspace bareword
  const re = /--workspace\s+(?:"([^"]+)"|'([^']+)'|(\S+))/;
  const m = cmd.match(re);
  if (!m) return null;
  const raw = m[1] || m[2] || m[3];
  // Normalize the path; reject obviously suspicious values (option flags).
  if (!raw || raw.startsWith('-')) return null;
  return path.resolve(raw);
}
