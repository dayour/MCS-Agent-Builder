#!/usr/bin/env node
/**
 * Team Routing Hook — Auto-spawn agent teammates and surface routing reminders.
 *
 * Triggers (per-session state):
 *   1. PreToolUse on Write targeting agentspec.json
 *      -> spawn qa-challenger via `claude -p` in the background, writes
 *         review to <spec-dir>/.qa-review.json. One spawn per (session, spec).
 *         Skipped if .qa-review.json is fresher than spec mtime.
 *   2. PostToolUse on Edit/Write/MultiEdit targeting .claude/{rules,skills,agents} or CLAUDE.md
 *      -> remind lead about prompt-engineer (Domain 2: system instruction review).
 *         Reminder only — instruction edits don't auto-spawn (lead's discretion).
 *   3. PostToolUse cumulative edit count >= 3
 *      -> remind lead to spawn repo-auditor in background.
 *
 * Bypasses (no work, fast exit):
 *   - CLAUDE_HEADLESS=1            sub-agent edits don't recursively trigger
 *   - input.isSidechain === true   teammate-originated edits
 *   - CLAUDE_OFF_AUTO_QA=1         user opt-out for QA auto-spawn
 *   - tool_name not Write/Edit/MultiEdit
 *
 * State: per-session in $TMPDIR/claude-team-routing/<sessionKey>.json.
 * Reminder text is generic (no file paths or content) to avoid leaking sensitive info.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

if (process.env.CLAUDE_HEADLESS === '1') {
  process.exit(0);
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    if (input.isSidechain === true || input.source === 'subagent') {
      process.exit(0);
    }

    const rawSessionId = input.session_id;
    if (!rawSessionId || typeof rawSessionId !== 'string') {
      process.exit(0);
    }
    const sessionKey = crypto.createHash('sha256').update(rawSessionId).digest('hex').slice(0, 16);

    const event = input.hook_event_name;
    const toolName = input.tool_name;
    const toolInput = input.tool_input || {};
    const filePath = toolInput.file_path || '';

    if (!['Write', 'Edit', 'MultiEdit'].includes(toolName)) {
      process.exit(0);
    }

    const stateDir = path.join(os.tmpdir(), 'claude-team-routing');
    fs.mkdirSync(stateDir, { recursive: true });
    const stateFile = path.join(stateDir, `${sessionKey}.json`);
    if (path.dirname(path.resolve(stateFile)) !== path.resolve(stateDir)) {
      process.exit(0);
    }

    let state = {
      editedFiles: [],
      remindedRepoAudit: false,
      remindedPE: false,
      qaSpawnedFor: {}, // map of specHash -> ISO timestamp
    };
    if (fs.existsSync(stateFile)) {
      try { state = { ...state, ...JSON.parse(fs.readFileSync(stateFile, 'utf8')) }; } catch { /* corrupt — reset */ }
    }
    state.qaSpawnedFor = state.qaSpawnedFor || {};

    const canon = filePath ? path.resolve(filePath) : '';
    const messages = [];

    // ── 1. agentspec.json write → auto-spawn QA Challenger ────────────────
    if (event === 'PreToolUse' && toolName === 'Write' && canon && /[\\/]agentspec\.json$/i.test(canon)) {
      const specHash = crypto.createHash('sha256').update(canon).digest('hex').slice(0, 12);
      const reviewPath = path.join(path.dirname(canon), '.qa-review.json');

      if (process.env.CLAUDE_OFF_AUTO_QA === '1') {
        if (!state.qaSpawnedFor[specHash]) {
          messages.push('[team-routing] agentspec.json write detected. QA auto-spawn disabled (CLAUDE_OFF_AUTO_QA=1). Spawn qa-challenger manually if review needed.');
          state.qaSpawnedFor[specHash] = 'skipped';
        }
      } else if (state.qaSpawnedFor[specHash] && state.qaSpawnedFor[specHash] !== 'skipped') {
        // Already spawned QA for this spec in this session — no-op
      } else {
        // Skip if a recent review exists.
        let recentReview = false;
        if (fs.existsSync(reviewPath) && fs.existsSync(canon)) {
          try {
            const reviewMtime = fs.statSync(reviewPath).mtimeMs;
            const specMtime = fs.statSync(canon).mtimeMs;
            // Allow 60s grace — review covers this spec generation
            if (reviewMtime >= specMtime - 60_000) recentReview = true;
          } catch { /* ignore stat errors */ }
        }

        if (recentReview) {
          messages.push('[team-routing] agentspec.json write detected. Existing .qa-review.json is recent — re-using. Re-spawn manually if you want a fresh review.');
          state.qaSpawnedFor[specHash] = new Date().toISOString();
        } else {
          // Lock prevents concurrent spawns across hooks (e.g., Pre + Post fire on same write).
          const lockPath = path.join(path.resolve(__dirname, '..'), `.qa-pending.${specHash}.lock`);
          if (!fs.existsSync(lockPath)) {
            try { fs.writeFileSync(lockPath, JSON.stringify({ spec: canon, queuedAt: new Date().toISOString() })); } catch { /* ignore */ }
            spawnQaChallenger(canon, reviewPath, lockPath);
            messages.push(
              `[team-routing] agentspec.json write detected. qa-challenger spawned in background (one-shot/session/spec). ` +
              `Review will land at: ${path.relative(path.resolve(__dirname, '..', '..'), reviewPath).replace(/\\/g, '/')}. ` +
              `Disable with CLAUDE_OFF_AUTO_QA=1.`
            );
            state.qaSpawnedFor[specHash] = new Date().toISOString();
          }
        }
      }
    }

    // ── 2. .claude/ or CLAUDE.md edit → remind about prompt-engineer ──────
    if (event === 'PostToolUse' && canon) {
      const isClaudeConfigEdit = /[\\/]\.claude[\\/](rules|skills|agents)[\\/]/.test(canon) || /[\\/]CLAUDE\.md$/i.test(canon);
      if (isClaudeConfigEdit && !state.remindedPE) {
        messages.push('[team-routing] Edit under .claude/ or CLAUDE.md detected. Recommend spawning prompt-engineer (Domain 2: system instruction review) in background to check for vague instructions, contradictions, anti-patterns. One-shot per session.');
        state.remindedPE = true;
      }

      if (!state.editedFiles.includes(canon)) {
        state.editedFiles.push(canon);
      }
      if (state.editedFiles.length >= 3 && !state.remindedRepoAudit) {
        messages.push('[team-routing] 3+ unique files edited this session. Recommend spawning repo-auditor in background (run_in_background=true) for integrity + optimization audit. Non-blocking, results in ~60s. One-shot per session.');
        state.remindedRepoAudit = true;
      }
    }

    const tmp = `${stateFile}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(state));
      fs.renameSync(tmp, stateFile);
    } catch {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }

    if (messages.length > 0) {
      process.stdout.write(messages.join('\n\n'));
    }
    process.exit(0);
  } catch {
    process.exit(0);
  }
});

/**
 * Spawn a detached `claude -p` session that runs the qa-challenger sub-agent
 * against the given agentspec.json and writes the review to reviewPath.
 *
 * Detached + ignored stdio: the hook returns immediately. The QA review
 * continues in the background and writes its findings to disk for the lead
 * (or Stop hook) to pick up later.
 */
function spawnQaChallenger(specPath, reviewPath, lockPath) {
  const prompt = [
    'Use the qa-challenger sub-agent to review this agentspec.json:',
    '  ' + specPath,
    '',
    'Run the standard QA review protocol:',
    '  1. Cross-reference validity: every capability, integration, topic, and evalSet entry resolves to something real.',
    '  2. Missing fields against templates/agentspec.json schema.',
    '  3. Contradictions between architecture, business.licensing, and integrations[].priority.',
    '  4. Coverage gaps in evalSets (boundaries / quality / edge-cases).',
    '  5. Topic feasibility: do the topics named in instructions exist or are they generative-only?',
    '',
    'Write the result to ' + reviewPath + ' as JSON with shape:',
    '{',
    '  "verdict": "approved" | "needs-revision" | "blocking-issues",',
    '  "reviewedAt": "<ISO timestamp>",',
    '  "specPath": "' + specPath.replace(/\\/g, '/') + '",',
    '  "findings": [ { "severity": "blocking|major|minor|nit", "category": "...", "message": "...", "location": "..." } ],',
    '  "summary": "<1-3 sentence overall assessment>"',
    '}',
    '',
    'Be terse. Do not explain methodology. Just write the JSON.',
  ].join('\n');

  const child = spawn('claude', ['-p', prompt, '--output-format', 'text'], {
    cwd: path.resolve(__dirname, '..', '..'),
    stdio: 'ignore',
    detached: true,
    windowsHide: true, // suppress cmd.exe popup; Node sets CREATE_NO_WINDOW
    env: { ...process.env, CLAUDE_HEADLESS: '1', CLAUDE_OFF_AUTOTEST: '1' },
    shell: process.platform === 'win32', // claude is a .cmd on Windows; Node >=18.20.2 (CVE-2024-27980) requires shell:true to spawn .cmd safely. windowsHide hides the cmd.exe window.
  });
  child.on('error', () => { try { fs.unlinkSync(lockPath); } catch { /* ignore */ } });
  child.on('exit', () => { try { fs.unlinkSync(lockPath); } catch { /* ignore */ } });
  child.unref();
}
