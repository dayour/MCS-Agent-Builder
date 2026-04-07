#!/usr/bin/env node
/**
 * Stop hook: Enforce GPT co-generation on every interaction.
 *
 * Simplified approach — checks if GPT was called within the last 2 minutes
 * of this hook firing. This handles:
 * - Synchronous GPT calls (attestation written before stop hook)
 * - Background GPT calls (attestation may arrive slightly after prompt)
 * - Session ID mismatches (checks all attestation files)
 *
 * The 2-minute window is tight enough to catch skipped interactions
 * but loose enough to handle background execution timing.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

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

    // Collect invocations from session-specific and fallback attestation files
    let invocations = [];
    for (const name of [`${sessionId}.json`, 'unknown.json']) {
      const p = path.join(attestDir, name);
      if (fs.existsSync(p)) {
        try {
          const data = JSON.parse(fs.readFileSync(p, 'utf8'));
          if (data.invocations) invocations = invocations.concat(data.invocations);
        } catch { /* corrupt — skip */ }
      }
    }

    // Check: was GPT called within the last 2 minutes?
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);
    const hasRecentCall = invocations.some(inv => new Date(inv.timestamp) > twoMinAgo);

    if (hasRecentCall) {
      // Clean up stale pending markers for this session
      try { fs.unlinkSync(path.join(attestDir, `pending-${sessionId}.json`)); } catch {}
      process.exit(0);
    }

    // No recent GPT call — notify
    const output = {
      decision: 'notify',
      additionalContext: '[GPT] No GPT call detected in the last 2 minutes. Fire: node tools/multi-model-review.js <command>',
    };
    process.stdout.write(JSON.stringify(output));
  } catch {
    // Parse error — fail open
    process.exit(0);
  }
});
