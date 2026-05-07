/**
 * API Mock Factory — centralized Playwright route interception.
 *
 * Provides deterministic responses for error states, empty states, and slow
 * responses that a live backend can't reliably produce. Use alongside live
 * backend tests (not as a replacement) for edge-case coverage.
 *
 * Usage:
 *   await applyMocks(page, mocks.agents.error500(), mocks.health.ok());
 *   await applyMocks(page, mocks.agents.empty());
 *   await applyMocks(page, mocks.agents.slow(3000));
 */
import { type Page, type Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// Core mock helper
// ---------------------------------------------------------------------------
export interface MockDef {
  pattern: string | RegExp;
  handler: (route: Route) => Promise<void> | void;
}

/** Apply one or more mocks to a page. Call BEFORE navigating. */
export async function applyMocks(page: Page, ...defs: MockDef[]): Promise<void> {
  for (const def of defs) {
    await page.route(def.pattern, def.handler);
  }
}

/** Remove all route overrides (restore live backend). */
export async function clearMocks(page: Page): Promise<void> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

// ---------------------------------------------------------------------------
// Unexpected network assertion — fail on unmocked external calls
// ---------------------------------------------------------------------------
export interface NetworkLog {
  requests: { url: string; method: string; status?: number }[];
}

/**
 * Start capturing network requests. Use with assertNoUnexpectedRequests()
 * to ensure tests don't silently hit real services.
 */
export function captureNetwork(page: Page): NetworkLog {
  const log: NetworkLog = { requests: [] };
  page.on('response', (resp) => {
    log.requests.push({
      url: resp.url(),
      method: resp.request().method(),
      status: resp.status(),
    });
  });
  return log;
}

/** Filter captured requests to only API calls (not static assets). */
export function apiRequests(log: NetworkLog): NetworkLog['requests'] {
  return log.requests.filter(
    (r) => r.url.includes('/api/') && !r.url.includes('/assets/')
  );
}

// ---------------------------------------------------------------------------
// Mock definitions by endpoint
// ---------------------------------------------------------------------------

function json(route: Route, status: number, body: unknown): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function delayed(ms: number, fn: (route: Route) => Promise<void>) {
  return async (route: Route) => {
    await new Promise((r) => setTimeout(r, ms));
    await fn(route);
  };
}

// ---- /api/health ----
export const health = {
  ok: (): MockDef => ({
    pattern: '**/api/health',
    handler: (route) => json(route, 200, { status: 'ok' }),
  }),
  down: (): MockDef => ({
    pattern: '**/api/health',
    handler: (route) => json(route, 503, { status: 'down', error: 'Service unavailable' }),
  }),
};

// ---- /api/projects ----
export const projects = {
  success: (data: unknown[] = []): MockDef => ({
    pattern: '**/api/projects',
    handler: (route) => json(route, 200, data),
  }),
  empty: (): MockDef => ({
    pattern: '**/api/projects',
    handler: (route) => json(route, 200, []),
  }),
  error500: (): MockDef => ({
    pattern: '**/api/projects',
    handler: (route) => json(route, 500, { error: 'Internal server error' }),
  }),
  error401: (): MockDef => ({
    pattern: '**/api/projects',
    handler: (route) => json(route, 401, { error: 'Unauthorized' }),
  }),
  slow: (ms = 5000): MockDef => ({
    pattern: '**/api/projects',
    handler: delayed(ms, (route) => json(route, 200, [])),
  }),
  malformed: (): MockDef => ({
    pattern: '**/api/projects',
    handler: (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"broken": ' }),
  }),
  timeout: (): MockDef => ({
    pattern: '**/api/projects',
    handler: (route) => route.abort('timedout'),
  }),
};

// ---- /api/readiness/* ----
export const readiness = {
  allGreen: (): MockDef => ({
    pattern: '**/api/readiness/**',
    handler: (route) =>
      json(route, 200, { ready: true, checks: { pac: true, az: true, claude: true } }),
  }),
  partial: (): MockDef => ({
    pattern: '**/api/readiness/**',
    handler: (route) =>
      json(route, 200, { ready: false, checks: { pac: true, az: false, claude: true } }),
  }),
  error500: (): MockDef => ({
    pattern: '**/api/readiness/**',
    handler: (route) => json(route, 500, { error: 'Readiness check failed' }),
  }),
};

// ---- /api/solutions ----
export const solutions = {
  success: (data: unknown[] = [
    { id: 's1', name: 'IT Help Desk', description: 'IT support agent', category: 'IT', industry: 'Technology' },
    { id: 's2', name: 'HR Assistant', description: 'HR policy agent', category: 'HR', industry: 'General' },
    { id: 's3', name: 'Sales Coach', description: 'Sales enablement', category: 'Sales', industry: 'Retail' },
  ]): MockDef => ({
    pattern: '**/api/solutions**',
    handler: (route) => json(route, 200, data),
  }),
  empty: (): MockDef => ({
    pattern: '**/api/solutions**',
    handler: (route) => json(route, 200, []),
  }),
  error500: (): MockDef => ({
    pattern: '**/api/solutions**',
    handler: (route) => json(route, 500, { error: 'Failed to fetch solutions' }),
  }),
  slow: (ms = 4000): MockDef => ({
    pattern: '**/api/solutions**',
    handler: delayed(ms, (route) =>
      json(route, 200, [{ id: 's1', name: 'IT Help Desk', description: 'IT support', category: 'IT' }])
    ),
  }),
};

// ---- /api/helper (chat) ----
export const helper = {
  reply: (text = 'I can help you with that!'): MockDef => ({
    pattern: '**/api/helper/**',
    handler: (route) => json(route, 200, { reply: text, model: 'mock' }),
  }),
  error500: (): MockDef => ({
    pattern: '**/api/helper/**',
    handler: (route) => json(route, 500, { error: 'Model unavailable' }),
  }),
  slow: (ms = 5000, text = 'Delayed response'): MockDef => ({
    pattern: '**/api/helper/**',
    handler: delayed(ms, (route) => json(route, 200, { reply: text, model: 'mock' })),
  }),
};

// ---- Catch-all: block unexpected API calls ----
export const blockAll = {
  /** Fail any /api/ call that isn't explicitly mocked. Useful for isolation. */
  api: (): MockDef => ({
    pattern: '**/api/**',
    handler: (route) =>
      json(route, 418, { error: 'Unmocked API call', url: route.request().url() }),
  }),
};

// ---- Convenience: namespace export ----
export const mocks = {
  health,
  projects,
  readiness,
  solutions,
  helper,
  blockAll,
};
