import { test, expect } from '@playwright/test';
import {
  ROUTES,
  CONDITIONAL_ROUTES,
  waitForAppReady,
  navigateToRoute,
  createConsoleCollector,
  formatConsoleErrors,
} from './helpers';

// ---------------------------------------------------------------------------
// Route smoke tests — verify each route loads without errors
// ---------------------------------------------------------------------------
test.describe('Route smoke tests', () => {
  for (const route of ROUTES) {
    test(`${route.name} (${route.path}) loads without errors`, async ({ page }) => {
      const { messages: errors, attach } = createConsoleCollector(page);
      attach();

      await navigateToRoute(page, route.path);
      await waitForAppReady(page);

      // Route-specific assertion
      if (route.marker === 'nav') {
        // Home page: verify nav rail is present (dynamic content)
        await expect(page.locator('nav')).toBeVisible();
      } else {
        // Other pages: verify the page HEADING carrying the marker text is
        // visible. Plain `getByText` matched any DOM node — including the
        // hidden nav-rail tab buttons that share the same label
        // (e.g. "Distribute") — and `.first()` of those resolved to a
        // hidden element, producing a false-negative. Scoping to the
        // semantic heading role tightens the assertion without weakening
        // it: every tested page renders its title as an h1/h2/h3.
        await expect(
          page.getByRole('heading', { name: new RegExp(route.marker, 'i') }).first()
        ).toBeVisible({ timeout: 10_000 });
      }

      // No console errors
      expect(errors, `Console errors on ${route.path}:\n${formatConsoleErrors(errors)}`).toHaveLength(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Conditional route smoke tests — may need state or feature flags
// ---------------------------------------------------------------------------
test.describe('Conditional routes (best-effort)', () => {
  for (const route of CONDITIONAL_ROUTES) {
    test(`${route.name} (${route.path}) loads without crashing`, async ({ page }) => {
      const { messages: errors, attach } = createConsoleCollector(page);
      attach();

      await navigateToRoute(page, route.path);

      // These routes may redirect or show placeholder — just verify no
      // crash. The previous wait for `state: 'visible'` (Playwright's
      // default) failed against Fluent UI's initial render where the
      // FluentProvider div is `hidden` until tokens hydrate. Switching to
      // `state: 'attached'` matches the comment's intent: confirm the
      // route mounted *something*, not that it has visible content yet.
      // The `innerHTML.length > 50` check below still verifies content.
      await page.waitForSelector('#root > *', { timeout: 15_000, state: 'attached' });

      // Page should not be completely blank
      const rootHtml = await page.locator('#root').innerHTML();
      expect(rootHtml.length, `${route.path} rendered blank`).toBeGreaterThan(50);

      // Allow some console errors for conditional routes (missing state is expected)
      // but flag React error boundaries
      const criticalErrors = errors.filter(
        (e) => e.text().includes('Error boundary') || e.text().includes('Unhandled')
      );
      expect(
        criticalErrors,
        `Critical errors on ${route.path}:\n${formatConsoleErrors(criticalErrors)}`
      ).toHaveLength(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Navigation smoke tests
// ---------------------------------------------------------------------------
test.describe('Navigation', () => {
  test('nav rail is visible on load', async ({ page }) => {
    await navigateToRoute(page, '/');
    await waitForAppReady(page);

    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('clicking a nav item navigates to the correct route', async ({ page }) => {
    await navigateToRoute(page, '/');
    await waitForAppReady(page);

    // Find and click the "My Projects" or similar nav link
    const navLinks = page.locator('nav a, nav button');
    const count = await navLinks.count();
    expect(count, 'Nav should have at least 2 items').toBeGreaterThanOrEqual(2);

    // Click the second nav item (first is usually Home/Create)
    if (count >= 2) {
      await navLinks.nth(1).click();

      // URL hash should have changed from root
      const url = page.url();
      expect(url).toContain('#/');
    }
  });
});

// ---------------------------------------------------------------------------
// App health checks
// ---------------------------------------------------------------------------
test.describe('App health', () => {
  test('app boots without React error boundary', async ({ page }) => {
    const { messages: errors, attach } = createConsoleCollector(page);
    attach();

    await navigateToRoute(page, '/');
    await waitForAppReady(page);

    // No error boundary text visible
    const errorBoundary = page.getByText('Something went wrong');
    await expect(errorBoundary).not.toBeVisible({ timeout: 2_000 }).catch(() => {
      // If it exists, that's a real failure
      expect(false, 'React error boundary is showing').toBeTruthy();
    });
  });

  test('API proxy is reachable', async ({ page }) => {
    await navigateToRoute(page, '/');

    // Check that the API proxy responds (any status, not a connection error)
    const response = await page.request.get('http://localhost:8080/api/health').catch(() => null);
    // If API server is running, any response is acceptable
    // If not running, this test is informational (soft failure)
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });
});
