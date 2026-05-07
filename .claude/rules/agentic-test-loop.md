# Agentic Test Loop Protocol

Autonomous test-fix-iterate workflow for the frontend app. After any frontend change, Claude Code runs tests, diagnoses failures, fixes code, and re-verifies — without manual user intervention.

## When to Run

- After modifying any frontend file (component, page, layout, route, store, CSS)
- After adding or removing a dependency
- After changing the backend API in a way that affects frontend behavior
- When the user says "test it", "verify it", "make sure it works", or similar
- When the user asks to "fix X" — use **feature expansion** to test X and all related features

## Feature Expansion: Comprehensive Testing

When the user asks to fix or work on a feature (e.g., "fix login"), **automatically expand** to test all related functionality. This is the key difference from basic smoke tests.

### How It Works

1. **Resolve the feature**: The user's words map to a canonical feature via `knowledge/feature-map.json`
   - "fix login" → resolves to `auth` feature
   - "fix the nav" → resolves to `navigation` feature
   - "agent list is broken" → resolves to `agent-management` feature

2. **Expand related features**: The feature map defines relationships:
   - `auth` → also tests: `account-switching`, `environment`, `profile`, `navigation`
   - `navigation` → also tests: `auth`, `agent-management`, `environment`
   - Each related feature brings its routes, components, and MCP checks

3. **Run tiered tests**:
   ```
   Tier 1 (direct):    Tests tagged with the primary feature
   Tier 2 (adjacent):  Tests tagged with directly related features
   Tier 3 (broad):     Tests tagged with second-degree related features
   ```

4. **MCP exploratory checks**: For features without formal test coverage, use Playwright MCP to:
   - Navigate to the route and snapshot the DOM
   - Check console for errors
   - Verify key text/buttons are visible
   - Click interactive elements to verify they work

### Commands

```bash
# Preview what "auth" expands to (without running tests)
node tools/agentic-test-loop.js expand auth

# Run with feature expansion
node tools/agentic-test-loop.js run --feature auth --start-server

# The output includes which features were expanded and what MCP checks are recommended
```

### When to Use Feature Expansion vs. Route Filter vs. Full Suite

| User Request | Command | Scope |
|-------------|---------|-------|
| "Fix the login" | `--feature auth` | auth + account + env + profile + nav tests |
| "Check the evaluate page" | `--route /evaluate` | Just the evaluate route |
| "Make sure nothing is broken" | (no flags) | Full 18-test smoke suite |
| "Fix and verify thoroughly" | `--feature <X>` then full run | Feature-focused, then broad regression |

## The Loop

```
0. EXPAND (if user asked about a feature)
   node tools/agentic-test-loop.js expand <feature>
   Review the expansion. Note MCP checks for features without tests.

1. RUN TESTS
   node tools/agentic-test-loop.js run --feature <feature> --start-server
   (or: run --start-server for full suite)

2. CHECK OUTPUT
   Parse the JSON result. Branch on status:
   - "green"      → Go to step 2b.
   - "failing"    → Go to step 3.
   - "stalled"    → Change approach (different fix strategy) or escalate.
   - "regressing" → Revert last change, re-run, then investigate.
   - "stopped"    → Max iterations hit. Escalate to user.

2b. MCP EXPLORATORY PASS (when green but feature expansion has mcp_checks)
   For each mcp_check in the expansion that isn't covered by a formal test:
   - browser_navigate to the route
   - Execute the check (snapshot, verify_text, click, console)
   - If any check fails, treat it as a new failure → go to step 3

3. DIAGNOSE
   Read the failures array. For each failure:
   a. Note the classification (timeout, console-error, element-missing, react-crash, etc.)
   b. Read the debugHints from: node tools/agentic-test-loop.js failures
   c. If classification is unclear, use Playwright MCP for visual debugging:
      - browser_navigate to the failing route
      - browser_snapshot to see actual DOM
      - browser_console_messages for JS errors
      - browser_take_screenshot for visual state

4. FIX
   Edit ONLY app code (src/ files). Rules:
   - Never modify test files to make tests pass
   - Never weaken assertions or add waits/sleeps to mask timing issues
   - Fix the root cause, not the symptom
   - One fix per iteration — don't batch multiple unrelated fixes
   - Add --note "what I changed" to the next run for the log

5. RE-VERIFY
   node tools/agentic-test-loop.js run --feature <feature> --note "Fixed X in component Y"
   Go back to step 2.

6. BROAD REGRESSION (after feature tests are green)
   node tools/agentic-test-loop.js run --note "Full regression after <feature> fix"
   Ensure the fix didn't break unrelated routes.
```

## Hard Stop Conditions

- **Max 5 fix-verify iterations** per task before escalating to user
- **Stall detection**: Same failure count for 3+ consecutive runs → change approach
- **Regression**: More failures than previous run → revert and investigate
- **No-progress**: If the same test fails with the same classification 3 times → escalate

When escalating, provide:
- `node tools/agentic-test-loop.js status` output (full history)
- `node tools/agentic-test-loop.js failures` output (detailed failures + debug hints)
- What was tried and why it didn't work
- Screenshot of the failing route via Playwright MCP

## Playwright MCP Integration

Use Playwright MCP tools for targeted visual debugging AND exploratory testing:

| Situation | MCP Action |
|-----------|------------|
| Element not found | `browser_navigate` + `browser_snapshot` to see actual DOM tree |
| Console error | `browser_console_messages` to see full error with stack trace |
| Layout broken | `browser_take_screenshot` for visual state |
| Interaction failing | `browser_click` / `browser_type` to reproduce manually |
| Network issue | `browser_network_requests` to check API calls |
| Exploratory check | `browser_navigate` → `browser_snapshot` → `browser_verify_text_visible` |

Always navigate with HashRouter URLs: `http://localhost:8080/#/route`

## Feature Map Maintenance

The feature map lives at `knowledge/feature-map.json`. Keep it updated:
- When adding a new page/route, add it to the relevant feature's `routes`
- When adding a new component, add it to the relevant feature's `components`
- When creating new cross-feature dependencies, update `related` arrays
- When adding new test routes, update `tags` in `e2e/helpers.ts` to match

## Log Management

- Log lives at `tools/test-log.jsonl` (JSONL format, one entry per iteration)
- Review with `node tools/agentic-test-loop.js status` before starting a new fix cycle
- Reset with `node tools/agentic-test-loop.js reset` at the start of a new task
- Log entries include: iteration, timestamp, git SHA, changed files, failures, trend, feature expansion, recommendation

## Watch Mode (Semi-Auto Triggering)

The watch command monitors session logs and source files, then triggers test runs based on actionable signals.

```bash
# Assist mode (default): suggests runs, you confirm
node tools/agentic-test-loop.js watch

# Auto mode: runs tests automatically with cooldowns
node tools/agentic-test-loop.js watch --mode auto

# Custom settings
node tools/agentic-test-loop.js watch --mode auto --cooldown 60 --max-runs 5
```

### Signals

| Signal | Detection | Trigger |
|--------|-----------|---------|
| File change | `src/**/*.{ts,tsx,js,jsx,css}` modified | 3s debounce, then fire |
| Crash | `error.uncaught` or `error.unhandled-rejection` in session log | Immediate |
| Error spike | 3+ errors within 60 seconds | On threshold breach |
| API 5xx | `net.fetch:done` with status >= 500 | Immediate |
| Server 5xx | `req` with status >= 500 | Immediate |

### Safety Features

- **Collapse queue**: One test run active, at most one queued. Multiple triggers during a run collapse into one.
- **Cooldown**: 30s between runs (configurable). Exponential backoff (1.5x) after consecutive failures, max 120s.
- **Dedup**: Same trigger key within 30s is ignored.
- **Max runs**: Hard cap per session (default 10).
- **Single instance**: Lock file prevents duplicate watchers.
- **Feedback loop prevention**: Events generated during test runs are ignored.

### Modes

| Mode | Behavior |
|------|----------|
| `assist` | Prints trigger reason + suggested command. You decide whether to run. |
| `auto` | Runs smoke tests automatically. Backs off on repeated failures. |

### When to Use Watch Mode

| Scenario | Recommendation |
|----------|---------------|
| Active development (frequent saves) | `watch --mode assist` — get notified, run when ready |
| Debugging a specific issue | `watch --mode auto` — auto-verify after each fix |
| Pre-commit verification | Don't use watch — run `node tools/agentic-test-loop.js run` directly |
| CI/CD | Don't use watch — run the full test suite |

## Session Logs (Frontend + Backend Telemetry)

The dev logger captures all frontend interactions, network requests, console output, errors, navigation, and performance metrics to `tools/session-log.jsonl`. Use session logs to enrich failure diagnosis:

```bash
# Summary of all captured events
node tools/agentic-test-loop.js logs --summary

# Filter by category: ui, net, error, console, nav, perf, req, state
node tools/agentic-test-loop.js logs --cat error,net --limit 20

# Filter by route
node tools/agentic-test-loop.js logs --route /build --limit 30

# Filter by time (relative: 5m, 1h, or ISO timestamp)
node tools/agentic-test-loop.js logs --since 5m --cat error

# Clear session logs
node tools/agentic-test-loop.js logs-clear
```

The `failures` command automatically enriches test failures with session log context — errors, failed network requests, and console errors that occurred near the failing routes.

### How Session Logs Help Triage

| Failure Type | What to Check in Logs |
|-------------|----------------------|
| Element missing | `--cat nav` — did the route actually load? |
| Console error | `--cat console,error` — JS errors with stack traces |
| API error | `--cat net,req` — failed requests with status codes and timing |
| Blank page | `--cat nav,net` — route change + network requests (or lack thereof) |
| Timeout | `--cat perf` — long tasks that may be blocking the main thread |
| React crash | `--cat error,console` — unhandled errors and rejections |

## What NOT to Do

- Never modify test files (`e2e/*.ts`) to make failing tests pass
- Never add `page.waitForTimeout()` or `sleep` as a fix
- Never ignore console errors — they indicate real issues
- Never skip the re-verify step after a fix
- Never batch multiple unrelated fixes — one fix per iteration for clean attribution
- Never auto-commit during the loop — commit only after green or on user request
- Never skip the broad regression run after a feature-focused fix

## New Feature / New Route

When adding a new page or feature:
1. Add the route to `ROUTES` or `CONDITIONAL_ROUTES` in `e2e/helpers.ts` with feature `tags`
2. Add the feature to `knowledge/feature-map.json` with routes, components, related features, and MCP checks
3. Run the agentic loop with `--feature <name>` — it will test the new route and all related features
4. This is the ONE case where modifying test files is allowed (adding coverage, not weakening)
