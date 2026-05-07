#!/usr/bin/env node
/**
 * Session End Hook
 *
 * Captures lightweight session metrics and surfaces a parting note:
 *   - Files modified vs git HEAD (uncommitted scope of work).
 *   - Suggests /commit if there are changes.
 *   - Suggests /revise-claude-md if many .claude/ or CLAUDE.md changes.
 *
 * Metrics append to tools/session-metrics.jsonl for trend tracking. Hook
 * never blocks Stop.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

if (process.env.CLAUDE_HEADLESS === '1') process.exit(0);

const ROOT = path.resolve(__dirname, '..', '..');
const METRICS_FILE = path.join(ROOT, 'tools', 'session-metrics.jsonl');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  try {
    const input = (() => { try { return JSON.parse(raw); } catch { return {}; } })();
    const sessionId = input.session_id || 'unknown';

    let modifiedFiles = [];
    try {
      const out = execFileSync('git', ['status', '--porcelain'], {
        cwd: ROOT, encoding: 'utf8', timeout: 3_000,
      });
      modifiedFiles = out.split('\n').filter(Boolean).map((l) => l.slice(3));
    } catch { /* not a repo or git unavailable */ }

    const claudeConfigChanges = modifiedFiles.filter((f) => /^\.claude[\\/](rules|skills|agents|hooks)[\\/]/i.test(f) || /^CLAUDE\.md$/i.test(f));
    const codeChanges = modifiedFiles.filter((f) => /\.(js|ts|tsx|jsx|py)$/.test(f));

    const metric = {
      sessionId,
      endedAt: new Date().toISOString(),
      modifiedFileCount: modifiedFiles.length,
      claudeConfigChangeCount: claudeConfigChanges.length,
      codeChangeCount: codeChanges.length,
    };
    try { fs.appendFileSync(METRICS_FILE, JSON.stringify(metric) + '\n'); } catch { /* ignore */ }

    const messages = [];
    if (modifiedFiles.length > 0) {
      messages.push(
        `[session-end] ${modifiedFiles.length} uncommitted change${modifiedFiles.length === 1 ? '' : 's'}. ` +
        `Commit with \`/commit\` (or \`/commit-push-pr\` to ship).`
      );
    }
    if (claudeConfigChanges.length >= 2) {
      messages.push(
        `[session-end] ${claudeConfigChanges.length} change${claudeConfigChanges.length === 1 ? '' : 's'} under .claude/ or CLAUDE.md. ` +
        `Consider running /revise-claude-md to keep the index in sync with new rules/skills/hooks.`
      );
    }

    if (messages.length > 0) {
      process.stdout.write(messages.join('\n\n'));
    }
    process.exit(0);
  } catch {
    process.exit(0);
  }
});
