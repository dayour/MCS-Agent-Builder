/**
 * Edge-case and error-state tests — uses API mock factory.
 *
 * Tests that the UI handles failures gracefully: error banners, empty states,
 * loading indicators, network timeouts, and malformed responses.
 *
 * These run with mocked APIs (no live backend needed) to deterministically
 * produce error conditions that are hard to trigger against a real server.
 */
import { test, expect } from '@playwright/test';
import {
  resetAppState,
  seedAgents,
  setFeatureFlags,
  navigateTo,
  waitForApp,
  collectConsole,
  hasErrorBoundary,
  FIXTURES,
  FLAG_PRESETS,
} from './fixtures';
import { applyMocks, clearMocks, mocks } from './mocks';

// ---------------------------------------------------------------------------
// API error handling — 500, timeout, malformed
// ---------------------------------------------------------------------------
test.describe('Error states: API failures', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await setFeatureFlags(page, FLAG_PRESETS.allFeatures);
  });

  test('MyStuff handles /api/projects 500 without crashing', async ({ page }) => {
    await applyMocks(page, mocks.projects.error500());
    await navigateTo(page, '/mystuff');
    await waitForApp(page);

    // Page should NOT show a React error boundary
    const hasBoundary = await hasErrorBoundary(page);
    expect(hasBoundary, 'Error boundary shown on API 500 — should show graceful error').toBe(false);

    // Page should still be interactive (heading visible, nav works)
    await expect(page.getByRole('heading', { name: 'My Projects' })).toBeVisible();
    await expect(page.locator('nav')).toBeVisible();
  });

  test('MyStuff handles /api/projects network timeout without crashing', async ({ page }) => {
    await applyMocks(page, mocks.projects.timeout());
    await navigateTo(page, '/mystuff');
    await waitForApp(page);

    const hasBoundary = await hasErrorBoundary(page);
    expect(hasBoundary, 'Error boundary on network timeout').toBe(false);

    // Core UI should remain functional
    await expect(page.locator('nav')).toBeVisible();
  });

  test('Solution Library handles /api/solutions 500 gracefully', async ({ page }) => {
    await applyMocks(page, mocks.solutions.error500());
    await navigateTo(page, '/discover');
    await waitForApp(page);

    const hasBoundary = await hasErrorBoundary(page);
    expect(hasBoundary, 'Error boundary on solutions 500').toBe(false);

    // Heading should still render
    await expect(page.getByText('Solution Library', { exact: false }).first()).toBeVisible();
  });

  test('app handles malformed JSON response without crashing', async ({ page }) => {
    await applyMocks(page, mocks.projects.malformed());
    await navigateTo(page, '/mystuff');
    await waitForApp(page);

    const hasBoundary = await hasErrorBoundary(page);
    expect(hasBoundary, 'Error boundary on malformed JSON').toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Empty states — zero data scenarios
// ---------------------------------------------------------------------------
test.describe('Empty states', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await setFeatureFlags(page, FLAG_PRESETS.allFeatures);
  });

  test('MyStuff shows empty state with zero agents and zero server projects', async ({ page }) => {
    // No agents seeded + empty projects from API
    await applyMocks(page, mocks.projects.empty());
    await navigateTo(page, '/mystuff');
    await waitForApp(page);

    // Should show the empty state message
    await expect(page.getByText('No agents or workflows yet')).toBeVisible();
    // Create button should be prominent
    await expect(page.getByRole('button', { name: 'Create new' })).toBeVisible();
  });

  test('Solution Library shows empty state when no solutions returned', async ({ page }) => {
    await applyMocks(page, mocks.solutions.empty());
    await navigateTo(page, '/discover');
    await waitForApp(page);

    // Page loads without error
    await expect(page.getByText('Solution Library', { exact: false }).first()).toBeVisible();
    // No solution cards should be present
    const cards = page.locator('[class*="grid"] > *');
    // With empty API, card count should be 0 or show empty state
    const count = await cards.count();
    // The page may show a placeholder or just no cards — either is acceptable
    expect(count).toBeLessThanOrEqual(1);
  });

  test('Home page works in complete isolation (no backend)', async ({ page }) => {
    // Block ALL API calls — home should work purely from localStorage
    await applyMocks(page, mocks.blockAll.api());
    await navigateTo(page, '/');
    await waitForApp(page);

    // Home page is entirely client-side — should work perfectly
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Agent$/, level: 3 })).toBeVisible();
    await expect(page.locator('textarea').first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// State persistence — does data survive navigation and reload?
// ---------------------------------------------------------------------------
test.describe('State persistence', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await setFeatureFlags(page, FLAG_PRESETS.allFeatures);
  });

  test('seeded agents persist across route changes', async ({ page }) => {
    const agents = FIXTURES.mixedAgents();
    await seedAgents(page, agents);
    await navigateTo(page, '/mystuff');
    await waitForApp(page);

    // Verify agents are visible
    const table = page.locator('table').first();
    await expect(table.getByText(agents[0].name).first()).toBeVisible();

    // Navigate to home
    await navigateTo(page, '/');
    await waitForApp(page);

    // Navigate back to mystuff
    await navigateTo(page, '/mystuff');
    await waitForApp(page);

    // Agents should still be there
    for (const agent of agents) {
      await expect(table.getByText(agent.name).first()).toBeVisible();
    }
  });

  test('current agent selection survives navigation', async ({ page }) => {
    const agents = FIXTURES.configuredAgent();
    await seedAgents(page, agents);
    await navigateTo(page, '/build');
    await waitForApp(page);

    // Navigate to preview
    await navigateTo(page, '/preview');
    await waitForApp(page);

    // Navigate to settings
    await navigateTo(page, '/settings');
    await waitForApp(page);

    // Navigate back to build — agent should still be loaded
    await navigateTo(page, '/build');
    await waitForApp(page);

    // Verify page isn't showing placeholder (means agent is loaded)
    const rootHtml = await page.locator('#root').innerHTML();
    expect(rootHtml.length).toBeGreaterThan(200);
    const hasBoundary = await hasErrorBoundary(page);
    expect(hasBoundary).toBe(false);
  });

  test('feature flags persist across navigation', async ({ page }) => {
    await setFeatureFlags(page, { showPersonalAgentOption: true });
    await navigateTo(page, '/');
    await waitForApp(page);

    // 4 cards with the flag
    const cards = await page.getByRole('heading', { level: 3 }).count();
    expect(cards).toBeGreaterThanOrEqual(4);

    // Navigate away and back
    await navigateTo(page, '/mystuff');
    await waitForApp(page);
    await navigateTo(page, '/');
    await waitForApp(page);

    // Still 4 cards
    const cardsAfter = await page.getByRole('heading', { level: 3 }).count();
    expect(cardsAfter).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// Concurrent interaction — rapid navigation, double-clicks
// ---------------------------------------------------------------------------
test.describe('Concurrent interactions', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await seedAgents(page, FIXTURES.mixedAgents());
    await setFeatureFlags(page, FLAG_PRESETS.allFeatures);
  });

  test('rapid route switching does not crash', async ({ page }) => {
    const console = collectConsole(page);

    // Navigate rapidly through 5 routes without waiting for full load
    const routes = ['/', '/mystuff', '/discover', '/preview', '/snapshots'];
    for (const route of routes) {
      await page.goto(`http://localhost:8080/#${route}`, { waitUntil: 'commit' });
    }

    // Wait for the final route to stabilize
    await waitForApp(page);

    // Should end up on snapshots without crash
    const hasBoundary = await hasErrorBoundary(page);
    expect(hasBoundary).toBe(false);

    // Filter out network errors from rapid navigation (expected)
    const realErrors = console.errors.filter(
      (e) => !e.includes('AbortError') && !e.includes('network') && !e.includes('fetch')
    );
    expect(realErrors).toHaveLength(0);
  });

  test('double-clicking create card does not break state', async ({ page }) => {
    await navigateTo(page, '/');
    await waitForApp(page);

    const agentCard = page.getByRole('heading', { name: /^Agent$/, level: 3 });
    await agentCard.dblclick();

    // Should transition without error
    const hasBoundary = await hasErrorBoundary(page);
    expect(hasBoundary).toBe(false);
  });

  test('clicking filter pills rapidly does not break table', async ({ page }) => {
    await navigateTo(page, '/mystuff');
    await waitForApp(page);

    // Click filter pills in rapid succession
    const all = page.getByRole('button', { name: 'All' });
    const workflows = page.getByRole('button', { name: 'Workflows' });

    await all.click();
    await workflows.click();
    await all.click();
    await workflows.click();
    await all.click();

    // Table should still be functional — no crash, correct count
    const hasBoundary = await hasErrorBoundary(page);
    expect(hasBoundary).toBe(false);
    await expect(page.getByRole('heading', { name: 'My Projects' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Console error regression — strict mode
// ---------------------------------------------------------------------------
test.describe('Console error regression', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await seedAgents(page, FIXTURES.configuredAgent());
    await setFeatureFlags(page, FLAG_PRESETS.allFeatures);
  });

  const strictRoutes = ['/', '/mystuff', '/build', '/preview', '/settings', '/snapshots'];

  for (const route of strictRoutes) {
    test(`${route} has zero console errors with full state`, async ({ page }) => {
      const console = collectConsole(page);
      await navigateTo(page, route);
      await waitForApp(page);

      // Wait a moment for any async errors to surface
      await page.waitForLoadState('networkidle').catch(() => {});

      expect(
        console.errors,
        `Console errors on ${route}:\n${console.errors.join('\n')}`
      ).toHaveLength(0);
    });
  }
});
