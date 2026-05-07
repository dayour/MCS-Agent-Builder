#!/usr/bin/env node
/**
 * Stop hook — enforce GPT co-generation bound to THIS turn.
 *
 * Pairs with gpt-reminder.js. UserPromptSubmit writes a pending marker with:
 *   { sessionId, turnId, promptHash, promptTimestamp }
 * multi-model-review.js reads this marker on every call and tags its
 * attestation entry with the same (turnId, promptHash) triple.
 *
 * This Stop hook blocks unless at least one attestation entry in the
 * CURRENT session's attestation file has turnId === current-pending-turnId.
 * No cross-session scan, no 10-minute burst pass, no timestamp-based grace.
 *
 * Bypass conditions:
 *   - CLAUDE_HEADLESS=1              (spawned PTY for skill execution)
 *   - CLAUDE_GPT_HOOK_DEPTH >= 2     (recursion guard; see gpt-reminder.js)
 *   - No attestation dir exists       (first run — be lenient)
 *   - No pending marker for session   (turnId unknowable — fail open)
 *   - GPT unavailable attestation     (status='unavailable' counts as attempted)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

if (process.env.CLAUDE_HEADLESS === '1') {
  process.exit(0);
}

const hookDepth = parseInt(process.env.CLAUDE_GPT_HOOK_DEPTH || '0', 10);
if (hookDepth >= 2) {
  process.exit(0);
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);

    if (input.hook_event_name !== 'Stop') {
      process.exit(0);
    }

    const sessionId = input.session_id || 'unknown';
    const attestDir = path.join(os.tmpdir(), 'claude-gpt-attestations');

    if (!fs.existsSync(attestDir)) {
      process.exit(0);
    }

    // Read pending marker for THIS session only.
    const markerPath = path.join(attestDir, `pending-${sessionId}.json`);
    if (!fs.existsSync(markerPath)) {
      // No marker — can't enforce turn binding. Fail open (lenient).
      process.exit(0);
    }

    let marker;
    try {
      marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    } catch {
      process.exit(0); // corrupt marker — fail open
    }

    const currentTurnId = marker.turnId;
    const currentPromptHash = marker.promptHash;

    // Marker has no binding identifiers (e.g., notification-style turns where
    // UserPromptSubmit fires without a real user prompt). Can't enforce
    // turn-binding, so fail open to match the lenient pattern above.
    if (typeof currentTurnId !== 'number' && !currentPromptHash) {
      process.exit(0);
    }

    // Read THIS session's attestation file only. No cross-session scan.
    const attestPath = path.join(attestDir, `${sessionId}.json`);
    let invocations = [];
    if (fs.existsSync(attestPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(attestPath, 'utf8'));
        invocations = data.invocations || [];
      } catch { /* corrupt — treat as empty */ }
    }

    // Pass if any invocation binds to the current turn.
    // - turnId match is primary binding
    // - promptHash match is secondary binding (survives if turnId lost)
    // - status='unavailable' (GPT exit 3) counts as attempted
    const matchesTurn = invocations.some(inv => {
      if (inv.status === 'unavailable') return true;
      if (typeof currentTurnId === 'number' && inv.turnId === currentTurnId) return true;
      if (currentPromptHash && inv.promptHash === currentPromptHash) return true;
      return false;
    });

    if (matchesTurn) {
      process.exit(0);
    }

    // No GPT call bound to this turn — block.
    const output = {
      decision: 'block',
      reason: `[GPT] No GPT call detected for turn ${currentTurnId}. Fire: node tools/multi-model-review.js <command> before responding.`,
    };
    process.stdout.write(JSON.stringify(output));
  } catch {
    // Parse error — fail open
    process.exit(0);
  }
});
