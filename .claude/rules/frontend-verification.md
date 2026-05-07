---
paths:
  - "app/frontend/**"
---

# Frontend Verification Workflow

After modifying frontend files, verify the UI works in a real browser. This is the agentic dev loop — build, verify, fix, re-verify.

## When to Verify

- After modifying any React component, page, layout, route, store, or CSS file
- After adding or removing a dependency that affects rendering
- After changing the backend API in a way that affects frontend behavior
- After changing state management (stores, context providers)
- When the user says "test it", "verify it", "make sure it works", or similar
- When the user asks to "fix X" — use **feature expansion** to test X and all related features

## Verification Strategy

### Quick Check (single page changed)

Use Playwright MCP tools for targeted verification:

1. `browser_navigate` to `http://localhost:8080/#/{route}` — open the changed page
2. `browser_snapshot` — read the accessibility tree to verify structure
3. `browser_console_messages` — check for JavaScript errors
4. `browser_verify_text_visible` — confirm expected text/headings are present
5. `browser_take_screenshot` — visual confirmation if layout or styling changed

### Broad Check (shared component, routing, or layout changed)

Use the agentic test loop for autonomous test-fix-iterate:

```bash
node tools/agentic-test-loop.js run --start-server
```

This runs all Playwright smoke tests and returns structured JSON with:
- Pass/fail counts and failure classifications
- Trend detection (green/improving/regressing/stalled)
- Debug hints with Playwright MCP commands for each failure
- JSONL log at `tools/test-log.jsonl` for iteration tracking

**Other commands:**
- `node tools/agentic-test-loop.js status` — iteration history and trend
- `node tools/agentic-test-loop.js failures` — detailed failure info with debug hints
- `node tools/agentic-test-loop.js verify [feature]` — output MCP exploratory checks for Playwright MCP
- `node tools/agentic-test-loop.js reset` — clear log for new task

For single-route testing: `node tools/agentic-test-loop.js run --route /evaluate`

### New Feature or Page Added

1. Write a new test in `app/frontend/e2e/` using Playwright Test
2. Add the route to `ROUTES` or `CONDITIONAL_ROUTES` in `e2e/helpers.ts` with feature `tags`
3. Add the feature to `knowledge/feature-map.json` with routes, components, related features, and MCP checks
4. Run the agentic loop with `--feature <name>` — it will test the new route and all related features
5. This is the ONE case where modifying test files is allowed (adding coverage, not weakening)

---

## Feature Expansion

When the user asks to fix or work on a feature (e.g., "fix login"), **automatically expand** to test all related functionality.

1. **Resolve the feature**: User's words map to a canonical feature via `knowledge/feature-map.json`
   - "fix login" → `auth` feature
   - "fix the nav" → `navigation` feature
   - "agent list is broken" → `agent-management` feature

2. **Expand related features**: The feature map defines relationships:
   - `auth` → also tests: `account-switching`, `environment`, `profile`, `navigation`
   - `navigation` → also tests: `auth`, `agent-management`, `environment`

3. **Run tiered tests**:
   ```
   Tier 1 (direct):    Tests tagged with the primary feature
   Tier 2 (adjacent):  Tests tagged with directly related features
   Tier 3 (broad):     Tests tagged with second-degree related features
   ```

4. **MCP exploratory checks**: For features without formal test coverage, use Playwright MCP to navigate, snapshot, check console, verify text, and click interactive elements.

```bash
# Preview expansion (dry run)
node tools/agentic-test-loop.js expand auth

# Run with feature expansion
node tools/agentic-test-loop.js run --feature auth --start-server
```

| User Request | Command | Scope |
|-------------|---------|-------|
| "Fix the login" | `--feature auth` | auth + account + env + profile + nav tests |
| "Check the evaluate page" | `--route /evaluate` | Just the evaluate route |
| "Make sure nothing is broken" | (no flags) | Full smoke suite |
| "Fix and verify thoroughly" | `--feature <X>` then full run | Feature-focused, then broad regression |

---

## The Test-Fix-Iterate Loop

```
0. EXPAND (if user asked about a feature)
   node tools/agentic-test-loop.js expand <feature>

1. RUN TESTS
   node tools/agentic-test-loop.js run --feature <feature> --start-server

2. CHECK OUTPUT — branch on status:
   - "green"      → Go to step 2b
   - "failing"    → Go to step 3
   - "stalled"    → Change approach or escalate
   - "regressing" → Revert last change, re-run, investigate
   - "stopped"    → Max iterations hit, escalate to user

2b. MCP EXPLORATORY PASS (green but feature expansion has mcp_checks)
   Run: node tools/agentic-test-loop.js verify <feature>
   Execute each step's tools via Playwright MCP (browser_navigate → snapshot → console)
   If any assertion fails → treat as new failure → go to step 3

3. DIAGNOSE
   Read the failures array. For each failure:
   a. Note classification (timeout, console-error, element-missing, react-crash, etc.)
   b. Read debugHints: node tools/agentic-test-loop.js failures
   c. If unclear, use Playwright MCP for visual debugging:
      browser_navigate → browser_snapshot → browser_console_messages → browser_take_screenshot

4. FIX
   Edit ONLY app code (src/ files):
   - Never modify test files to make tests pass
   - Never weaken assertions or add waits/sleeps
   - Fix the root cause, not the symptom
   - One fix per iteration
   - Add --note "what I changed" to the next run

5. RE-VERIFY
   node tools/agentic-test-loop.js run --feature <feature> --note "Fixed X in component Y"
   Go back to step 2.

6. BROAD REGRESSION (after feature tests are green)
   node tools/agentic-test-loop.js run --note "Full regression after <feature> fix"
```

## Hard Stop Conditions

- **Max 5 fix-verify iterations** per task before escalating to user
- **Stall detection**: Same failure count for 3+ consecutive runs → change approach
- **Regression**: More failures than previous run → revert and investigate
- **No-progress**: Same test fails with same classification 3 times → escalate

When escalating, provide:
- `node tools/agentic-test-loop.js status` output (full history)
- `node tools/agentic-test-loop.js failures` output (detailed failures + debug hints)
- What was tried and why it didn't work
- Screenshot of the failing route via Playwright MCP

---

## Playwright MCP Integration

| Situation | MCP Action |
|-----------|------------|
| Element not found | `browser_navigate` + `browser_snapshot` to see actual DOM tree |
| Console error | `browser_console_messages` to see full error with stack trace |
| Layout broken | `browser_take_screenshot` for visual state |
| Interaction failing | `browser_click` / `browser_type` to reproduce manually |
| Network issue | `browser_network_requests` to check API calls |
| Exploratory check | `browser_navigate` → `browser_snapshot` → `browser_verify_text_visible` |

Always navigate with HashRouter URLs: `http://localhost:8080/#/route`

---

## Watch Mode (Semi-Auto Triggering)

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

- **Collapse queue**: One test run active, at most one queued
- **Cooldown**: 30s between runs (configurable), exponential backoff (1.5x) on failures, max 120s
- **Dedup**: Same trigger key within 30s is ignored
- **Max runs**: Hard cap per session (default 10)
- **Single instance**: Lock file prevents duplicate watchers
- **Feedback loop prevention**: Events during test runs are ignored

| Scenario | Recommendation |
|----------|---------------|
| Active development | `watch --mode assist` — get notified, run when ready |
| Debugging a specific issue | `watch --mode auto` — auto-verify after each fix |
| Pre-commit verification | Run `node tools/agentic-test-loop.js run` directly |
| CI/CD | Run the full test suite directly |

---

## Session Logs (Frontend + Backend Telemetry)

The dev logger captures all frontend interactions, network requests, console output, errors, navigation, and performance metrics to `tools/session-log.jsonl`.

```bash
node tools/agentic-test-loop.js logs --summary              # All events
node tools/agentic-test-loop.js logs --cat error,net --limit 20  # By category
node tools/agentic-test-loop.js logs --route /build --limit 30   # By route
node tools/agentic-test-loop.js logs --since 5m --cat error      # By time
node tools/agentic-test-loop.js logs-clear                       # Clear logs
```

| Failure Type | What to Check in Logs |
|-------------|----------------------|
| Element missing | `--cat nav` — did the route actually load? |
| Console error | `--cat console,error` — JS errors with stack traces |
| API error | `--cat net,req` — failed requests with status codes and timing |
| Blank page | `--cat nav,net` — route change + network requests |
| Timeout | `--cat perf` — long tasks blocking the main thread |
| React crash | `--cat error,console` — unhandled errors and rejections |

---

## Test Suite (~140 tests, 5 tiers)

| Tier | Project | Tests | Purpose | Runtime |
|------|---------|-------|---------|---------|
| **Smoke** | `--project=smoke` | 19 | Route loads + no crash — CI gate | ~1.5 min |
| **Features** | `--project=features` | 75 | Per-page functional tests (12 pages) | ~5 min |
| **Journeys** | `--project=journeys` | 8 | Cross-page workflow validation + persistence | ~1 min |
| **Edge Cases** | `--project=edge-cases` | 19 | API errors, empty states, concurrency, persistence | ~2 min |
| **Accessibility** | `--project=a11y` | 18 | WCAG 2.1 AA scan + keyboard nav (report-only) | ~1.5 min |
| **All** | (default) | ~140 | Full suite | ~11 min |

### e2e/ Infrastructure
- `mocks.ts` — API mock factory (route interception for error/empty/slow states)
- `pages/*.page.ts` — Page Objects for Home, MyStuff, Build, Preview, Settings
- `pages/index.ts` — Playwright fixture that injects POM instances
- `edge-cases.spec.ts` — Error handling, state persistence, concurrency tests
- `a11y.spec.ts` — axe-core WCAG scan + keyboard navigation tests

**After any frontend change**: `node tools/agentic-test-loop.js run --start-server`
**Quick check**: `node tools/agentic-test-loop.js run --feature <name>`
**GPT diagnosis**: `node tools/agentic-test-loop.js gpt-diagnose`

## Agentic Verification Commands (PR-1/2/3)

The loop now closes without human verification. Use these in order:

```bash
# Scenario oracle — semantic invariants, not just page loads (top 5 features)
node tools/agentic-test-loop.js oracle --feature auth
node tools/agentic-test-loop.js oracle --feature navigation
node tools/agentic-test-loop.js oracle --feature agent-management
node tools/agentic-test-loop.js oracle --feature build
node tools/agentic-test-loop.js oracle --feature evaluation

# MCP probe — executable exploratory checks from feature-map.json
node tools/agentic-test-loop.js mcp-probe --feature <name>

# Post-event dispatcher — after /mcs-eval, /mcs-build, etc.
node tools/agentic-test-loop.js after mcs-eval
node tools/agentic-test-loop.js after mcs-build
node tools/agentic-test-loop.js after frontend-deploy

# Bundle — collect all artifacts for one testRunId into a manifest
node tools/agentic-test-loop.js bundle <runId>  # omit runId for latest

# Auto-commit — opt in, requires 2 consecutive green runs and only touches safe paths
node tools/agentic-test-loop.js run --auto-commit --note "fixing X"
```

Correlation IDs: every run (mcp-probe / oracle / after / run) generates a `testRunId`
that stamps frontend `devLogger` events, backend `req` events, and test-log entries.
Use `bundle <runId>` to get a manifest referencing all artifacts in one place.

Test-guard: `tools/test-guard.js` blocks commits that modify e2e/** or
feature-map.json without `allow-test-change: <reason>` in the commit message.
Prevents the agentic loop from gaming greens by weakening assertions.

Perf budgets: `npx playwright test --project=perf` runs LCP/long-task checks
report-only by default; set `PERF_BUDGET_GATE=1` to make violations fail.

> **Note (2026-05-05)**: the `tools/perf-baseline.js` collector referenced
> in earlier revisions was removed in cleanup PR #21. Run perf samples
> manually via `npx playwright test --project=perf --reporter=json` and
> aggregate p50/p95 per route before flipping `PERF_BUDGET_GATE=1`. Only
> enable the gate if p95 < 2000ms LCP and < 400ms longest task on all
> critical routes.

Test-guard bypass audit: every use of `ALLOW_TEST_CHANGE` env or
`allow-test-change:` commit-message bypass appends a structured entry to
`tools/test-guard-audit.jsonl` (gitignored, local-only). Review periodically
to spot loop gaming patterns:
```bash
tail -5 tools/test-guard-audit.jsonl
```

## Key Route Markers (for assertions)

| Route | Expected Text | Notes |
|-------|--------------|-------|
| `/` | nav element visible | Dynamic content, check nav rail |
| `/mystuff` | "My Projects" | h1 heading |
| `/discover` | "Discover" | h1 heading |
| `/preview` | "Preview your agent" | h2 heading |
| `/evaluate` | "Data type" | Default create-evaluation view |
| `/distribute` | "Distribute" | h1 heading |
| `/snapshots` | "Snapshots" | h1 heading |
| `/components` | "Components" | h1 heading |

Conditional routes (`/build`, `/project`, `/settings`, `/monitor`, `/tools`, `/flows`) may need agent state or feature flags. Test only for "loads without crashing".

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

## Prerequisites

- Both servers must be running: backend on :8000 and frontend on :8080 (run `npm start` from project root)
- If not running, use `node tools/verify-ui.js --start-server`
- Playwright MCP server must be enabled in `.claude/settings.local.json`

## Port Cleanup (MANDATORY)

After any verification session that starts servers (manual `node app/server.js`, `npx vite`, or `node tools/verify-ui.js --start-server`), **always kill the processes before returning control to the user**. The user runs `npm start` manually — leftover processes cause EADDRINUSE crashes.

```bash
# Kill processes on ports 8000 and 8080
for pid in $(netstat -ano 2>/dev/null | grep ":8000.*LISTEN" | awk '{print $NF}' | sort -u); do taskkill //F //PID $pid 2>/dev/null; done
for pid in $(netstat -ano 2>/dev/null | grep ":8080.*LISTEN" | awk '{print $NF}' | sort -u); do taskkill //F //PID $pid 2>/dev/null; done
```

Run this cleanup:
- After the test-fix-iterate loop completes
- After any Playwright MCP visual verification session
- Before reporting a task as done (if servers were started)
- If a verification session is interrupted or errors out

**Never leave servers running** — the user's `npm start` will fail.

## What NOT to Do

- Never modify test files (`e2e/*.ts`) to make failing tests pass
- Never add `page.waitForTimeout()` or `sleep` as a fix
- Never ignore console errors — they indicate real issues
- Never skip the re-verify step after a fix
- Never batch multiple unrelated fixes — one fix per iteration for clean attribution
- Never auto-commit during the loop — commit only after green or on user request
- Never skip the broad regression run after a feature-focused fix
- **Never leave dev servers running after verification** — always kill ports 8000/8080
