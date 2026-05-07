#!/usr/bin/env node
/**
 * UserPromptSubmit hook — per-turn GPT co-gen enforcement
 *
 * Writes per-session pending marker with:
 *   - sessionId     (from hook input)
 *   - turnId        (monotonic counter stored in per-project bridge)
 *   - promptHash    (SHA256 of normalized user prompt)
 *   - promptTimestamp
 *
 * Marker: $TMPDIR/claude-gpt-attestations/pending-<sessionId>.json
 * Bridge: <cwd>/.claude/.gpt-session.json  (per-project, avoids cross-project race)
 *
 * multi-model-review.js reads the pending marker for this session and
 * copies (sessionId, turnId, promptHash) into its attestation entry.
 * The Stop hook verifies the attestation binds to the current turn.
 *
 * Skips when CLAUDE_HEADLESS=1 (spawned PTY) OR when CLAUDE_GPT_HOOK_DEPTH >= 2
 * (recursion guard — prevents infinite loop if a hook-spawned subprocess
 * triggers the hook again).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

if (process.env.CLAUDE_HEADLESS === '1') {
  process.exit(0);
}

const hookDepth = parseInt(process.env.CLAUDE_GPT_HOOK_DEPTH || '0', 10);
if (hookDepth >= 2) {
  process.exit(0);
}

function normalizePrompt(s) {
  if (!s) return '';
  return String(s).replace(/\s+/g, ' ').trim().toLowerCase();
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function bridgeFilePath() {
  const cwd = process.cwd();
  const claudeDir = path.join(cwd, '.claude');
  try { fs.mkdirSync(claudeDir, { recursive: true }); } catch { /* ignore */ }
  return path.join(claudeDir, '.gpt-session.json');
}

function readBridge(bridgePath) {
  try { return JSON.parse(fs.readFileSync(bridgePath, 'utf8')); } catch { return null; }
}

function writeBridge(bridgePath, data) {
  const tmp = bridgePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, bridgePath);
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let sessionId = 'unknown';
  let promptText = '';
  try {
    const input = JSON.parse(raw);
    sessionId = input.session_id || 'unknown';
    promptText = input.prompt || '';
  } catch {
    // No input or parse error — proceed with unknowns
  }

  const promptHash = sha256(normalizePrompt(promptText)).slice(0, 16);

  const bridgePath = bridgeFilePath();
  const prior = readBridge(bridgePath);
  let turnId = 1;
  if (prior && prior.sessionId === sessionId && typeof prior.turnId === 'number') {
    turnId = prior.turnId + 1;
  }
  try {
    writeBridge(bridgePath, {
      sessionId,
      turnId,
      promptHash,
      promptTimestamp: new Date().toISOString(),
      cwd: process.cwd(),
    });
  } catch { /* non-fatal */ }

  const attestDir = path.join(os.tmpdir(), 'claude-gpt-attestations');
  try {
    fs.mkdirSync(attestDir, { recursive: true });
    const markerFile = path.join(attestDir, `pending-${sessionId}.json`);
    const tmp = markerFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({
      sessionId,
      turnId,
      promptHash,
      promptTimestamp: new Date().toISOString(),
      status: 'pending',
      bridgePath,
    }, null, 2));
    fs.renameSync(tmp, markerFile);
  } catch { /* non-fatal */ }

  const sidSuffix = sessionId && sessionId !== 'unknown' ? ` --session-id ${sessionId}` : '';
  process.stdout.write(
    `[GPT available, not required] Fire selectively when the second-model angle adds real value: ` +
    `challenge (before architecture/design decisions, risky/destructive actions), ` +
    `diagnose (hard or ambiguous bugs after first-pass uncertainty), ` +
    `review-code (non-trivial diffs — concurrency, persistence, migrations, security, public APIs), ` +
    `generate-* (MCS content where independent oracle generation matters). ` +
    `Skip for routine Q&A, formatting, simple edits, and repo-specific questions where Claude has full context that GPT lacks. ` +
    `Tool: node tools/multi-model-review.js${sidSuffix} <subcommand>. Not enforced — judgment call.`
  );
});
