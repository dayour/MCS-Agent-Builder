#!/usr/bin/env node
/**
 * UserPromptSubmit hook: Inject GPT co-generation reminder AND write a
 * per-interaction "pending" marker so the Stop hook can verify GPT was
 * called for THIS specific interaction — not just recently.
 *
 * Marker file: $TMPDIR/claude-gpt-attestations/pending-<sessionId>.json
 * Written on every user prompt. Stop hook compares attestation timestamps
 * against this marker to enforce per-interaction compliance.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

// Skip in headless mode (spawned PTY for skill execution)
if (process.env.CLAUDE_HEADLESS === '1') {
  process.exit(0);
}

// Read stdin for hook input (contains session_id)
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let sessionId = 'unknown';
  try {
    const input = JSON.parse(raw);
    sessionId = input.session_id || 'unknown';
  } catch {
    // No input or parse error — proceed with unknown
  }

  // Write pending marker with current timestamp
  const attestDir = path.join(os.tmpdir(), 'claude-gpt-attestations');
  try {
    fs.mkdirSync(attestDir, { recursive: true });
    const markerFile = path.join(attestDir, `pending-${sessionId}.json`);
    fs.writeFileSync(markerFile, JSON.stringify({
      sessionId,
      promptTimestamp: new Date().toISOString(),
      status: 'pending'
    }));
    // Bridge session ID to Bash subprocesses (multi-model-review.js reads this)
    fs.writeFileSync(path.join(attestDir, 'current-session.json'), JSON.stringify({
      sessionId,
      updatedAt: new Date().toISOString()
    }));
  } catch {
    // Non-fatal — don't block the prompt
  }

  // Output the reminder
  process.stdout.write(
    '[GPT CO-GEN REQUIRED] Fire GPT-5.4 (node tools/multi-model-review.js) on this interaction. ' +
    'Pick the right command: challenge (before implementing), ask (design/questions), ' +
    'review-code (after code), diagnose (debugging), generate-* (MCS content). ' +
    'If GPT fails (exit 3), proceed alone — that counts as attempted.'
  );
});
