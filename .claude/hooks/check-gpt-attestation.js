#!/usr/bin/env node
/**
 * Stop hook: Enforce GPT co-generation on every interaction.
 *
 * Two enforcement modes:
 *
 * 1. **Per-interaction** (default) — compares GPT attestation timestamps against
 *    the pending marker written by the UserPromptSubmit hook. Every user message
 *    must have a corresponding GPT call.
 *
 * 2. **Burst mode** — after a high-value GPT call (challenge, diagnose, review-code,
 *    review-*, generate-*), subsequent interactions within 10 minutes get a pass.
 *    This prevents wasteful compliance-only fires during rapid implementation phases.
 *    Low-value `ask` calls satisfy the current interaction but don't open a burst window.
 *
 * Fallback: if no pending marker exists (first run, or marker was cleaned up),
 * uses a 5-minute grace window.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

// Commands that open a burst window (high-value patterns)
const HIGH_VALUE_COMMANDS = new Set([
  'challenge', 'diagnose',
  'review-code', 'review-components', 'review-flow', 'review-merged',
  'generate-instructions', 'generate-evals', 'generate-topics',
  'generate-components', 'generate-flow', 'generate-fix',
]);

const BURST_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Skip enforcement in headless mode (spawned PTY for skill execution)
if (process.env.CLAUDE_HEADLESS === '1') {
  process.exit(0);
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);

    // Only enforce on Stop events
    if (input.hook_event_name !== 'Stop') {
      process.exit(0);
    }

    const sessionId = input.session_id || 'unknown';
    const attestDir = path.join(os.tmpdir(), 'claude-gpt-attestations');

    if (!fs.existsSync(attestDir)) {
      // No attestation dir at all — first run, be lenient
      process.exit(0);
    }

    // Read the pending marker to get the prompt timestamp for THIS interaction
    const markerPath = path.join(attestDir, `pending-${sessionId}.json`);
    let promptTimestamp = null;
    if (fs.existsSync(markerPath)) {
      try {
        const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
        promptTimestamp = new Date(marker.promptTimestamp);
      } catch { /* corrupt — fall through to grace window */ }
    }

    // Collect invocations from ALL attestation files (not just this session).
    // multi-model-review.js reads session ID from current-session.json, which
    // can be overwritten by other Claude sessions. So GPT attestations may land
    // in a different session's file. Scan all to find them.
    let invocations = [];
    try {
      for (const name of fs.readdirSync(attestDir)) {
        if (name.startsWith('pending-') || name === 'current-session.json') continue;
        if (!name.endsWith('.json')) continue;
        const p = path.join(attestDir, name);
        try {
          const data = JSON.parse(fs.readFileSync(p, 'utf8'));
          if (data.invocations) invocations = invocations.concat(data.invocations);
        } catch { /* corrupt — skip */ }
      }
    } catch { /* dir read error — invocations stays empty */ }

    // ── Burst mode check ──────────────────────────────────────────
    // If a high-value GPT call happened within the burst window, pass.
    const burstCutoff = new Date(Date.now() - BURST_WINDOW_MS);
    const recentHighValue = invocations.find(
      inv => HIGH_VALUE_COMMANDS.has(inv.command) &&
             inv.status === 'success' &&
             new Date(inv.timestamp) > burstCutoff
    );
    if (recentHighValue) {
      process.exit(0);
    }

    // ── Per-interaction check ─────────────────────────────────────
    if (promptTimestamp) {
      // Any GPT call (including ask) AFTER the pending marker timestamp?
      const hasCallAfterPrompt = invocations.some(
        inv => new Date(inv.timestamp) > promptTimestamp
      );
      if (hasCallAfterPrompt) {
        process.exit(0);
      }
    } else {
      // No pending marker — use 5-minute grace window as fallback
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const hasRecentCall = invocations.some(inv => new Date(inv.timestamp) > fiveMinAgo);
      if (hasRecentCall) {
        process.exit(0);
      }
    }

    // No GPT call for this interaction — block
    const output = {
      decision: 'block',
      reason: '[GPT] No GPT call detected for this interaction. Fire: node tools/multi-model-review.js <command> before responding.',
    };
    process.stdout.write(JSON.stringify(output));
  } catch {
    // Parse error — fail open
    process.exit(0);
  }
});
