import { type Page, type ConsoleMessage, type BrowserContext } from '@playwright/test';

// ---------------------------------------------------------------------------
// Route map — the test oracle for smoke tests
// Each entry has a HashRouter path and a text marker that should be visible.
// ---------------------------------------------------------------------------
export const ROUTES = [
  { path: '/',           name: 'Home',        marker: 'nav',                   tags: ['auth', 'navigation', 'agent-management', 'app-health'] },
  { path: '/mystuff',    name: 'My Stuff',    marker: 'My Projects',           tags: ['agent-management', 'distribution'] },
  { path: '/discover',   name: 'Solution Library', marker: 'Solution Library',  tags: ['discover'] },
  { path: '/preview',    name: 'Preview',     marker: 'Preview your agent',    tags: ['preview', 'evaluation'] },
  { path: '/distribute', name: 'Distribute',  marker: 'Distribute',            tags: ['distribution'] },
  { path: '/snapshots',  name: 'Snapshots',   marker: 'Snapshots',             tags: ['snapshots'] },
  { path: '/components', name: 'Components',  marker: 'Components',            tags: ['components-showcase'] },
] as const;

// Routes that depend on agent state or feature flags — test separately
export const CONDITIONAL_ROUTES = [
  { path: '/spec',     name: 'Spec',     note: 'Agent design brief (reads agentConfig.specData)', tags: ['spec', 'agent-config'] },
  { path: '/build',    name: 'Build',    note: 'Needs agent selected',     tags: ['build', 'agent-config'] },
  { path: '/evaluate', name: 'Evaluate', note: 'Needs agent selected',     tags: ['evaluation', 'agent-config'] },
  { path: '/project',  name: 'Project',  note: 'Shares EvaluatePage',      tags: ['evaluation'] },
  { path: '/settings', name: 'Settings', note: 'Needs agent selected',     tags: ['auth', 'agent-config', 'environment'] },
  { path: '/monitor',  name: 'Monitor',  note: 'Lazy-loaded',             tags: ['monitoring'] },
  { path: '/tools',    name: 'Tools',    note: 'Feature-flag gated',      tags: ['build', 'feature-flags'] },
  { path: '/flows',    name: 'Flows',    note: 'Feature-flag gated',      tags: ['build', 'feature-flags'] },
] as const;

// ---------------------------------------------------------------------------
// waitForAppReady — wait for React to mount and layout to render
// ---------------------------------------------------------------------------
export async function waitForAppReady(page: Page): Promise<void> {
  // Wait for React root to have children (app has mounted)
  await page.waitForSelector('#root > *', { timeout: 15_000 });
  // Wait for the navigation rail to be visible (layout is rendered)
  await page.waitForSelector('nav', { timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// navigateToRoute — HashRouter-aware navigation
// ---------------------------------------------------------------------------
export async function navigateToRoute(page: Page, path: string): Promise<void> {
  const url = `http://localhost:8080/#${path}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Wait for React to mount instead of arbitrary timeout
  await page.waitForSelector('#root > *', { state: 'attached', timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Correlation: attach a testRunId to a BrowserContext so every page navigation,
// fetch, and XHR carries X-Test-Run-Id and window.__TEST_RUN_ID.
//
// Call once in test.beforeEach with `context`. Safe to call multiple times —
// later calls overwrite the ID. Run IDs MUST match /^[a-zA-Z0-9_-]{1,64}$/ so
// they can't be used for path traversal or header injection.
// ---------------------------------------------------------------------------
export const TEST_RUN_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export function generateTestRunId(prefix = 'run'): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${ts}-${rand}`;
}

export async function attachTestRunId(context: BrowserContext, runId: string): Promise<void> {
  if (!TEST_RUN_ID_RE.test(runId)) {
    throw new Error(`invalid test run id: must match ${TEST_RUN_ID_RE}`);
  }
  await context.addInitScript((rid: string) => {
    (window as unknown as { __TEST_RUN_ID: string }).__TEST_RUN_ID = rid;
    try { localStorage.setItem('__TEST_RUN_ID', rid); } catch { /* private mode */ }
  }, runId);
  await context.setExtraHTTPHeaders({ 'X-Test-Run-Id': runId });
}

// ---------------------------------------------------------------------------
// Console error collection
// ---------------------------------------------------------------------------
export interface CollectedErrors {
  messages: ConsoleMessage[];
  attach: () => void;
}

// Known noise patterns to ignore
// Known noise patterns to ignore. Matched against BOTH the message text
// AND the message's source URL (where applicable) — Chromium emits
// `Failed to load resource: net::ERR_FAILED` as a separate event from the
// descriptive CORS message; the bare line carries its URL only in
// msg.location().url. Anchoring to URL keeps the filter narrow (real
// `net::ERR_FAILED` on app routes still trips assertions) while
// suppressing the SharePoint font CDN preflight redirect that Fluent UI's
// Segoe UI loader produces on every page.
const IGNORE_PATTERNS = [
  /favicon/i,
  /chrome-extension/i,
  /ResizeObserver loop/i,
  /Loading chunk/i,
  /Download the React DevTools/i,
  /static2\.sharepointonline\.com/i,
  /segoeui-westeuropean/i,
  /segoeui.*\.woff2/i,
];

export function createConsoleCollector(page: Page): CollectedErrors {
  const messages: ConsoleMessage[] = [];

  const attach = () => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        const url = (() => {
          try { return msg.location()?.url || ''; } catch { return ''; }
        })();
        const haystack = `${text}\n${url}`;
        const isNoise = IGNORE_PATTERNS.some((p) => p.test(haystack));
        if (!isNoise) messages.push(msg);
      }
    });
  };

  return { messages, attach };
}

export function formatConsoleErrors(errors: ConsoleMessage[]): string {
  return errors.map((e) => `  [console.error] ${e.text()}`).join('\n');
}
