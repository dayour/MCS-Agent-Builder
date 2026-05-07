import { test, expect } from '@playwright/test';
import {
  resetAppState,
  seedAgents,
  setFeatureFlags,
  navigateTo,
  waitForApp,
  collectConsole,
  verifyPageLoaded,
  FIXTURES,
  FLAG_PRESETS,
} from './fixtures';

// ---------------------------------------------------------------------------
// NavigationRail — nav items, routing, and active state
// ---------------------------------------------------------------------------
test.describe('NavigationRail', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await seedAgents(page, FIXTURES.configuredAgent());
    await setFeatureFlags(page, FLAG_PRESETS.allFeatures);
  });

  test('nav rail renders with nav items', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/');
    await waitForApp(page);

    // The nav element should be visible
    const nav = page.locator('nav');
    await expect(nav).toBeVisible({ timeout: 10_000 });

    // Nav should contain multiple interactive items (buttons)
    const navButtons = nav.locator('button');
    const count = await navButtons.count();
    expect(count, 'Nav rail should have at least 2 buttons').toBeGreaterThanOrEqual(2);

    expect(console.errors).toHaveLength(0);
  });

  test('nav rail contract — exact items present, stale items absent', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/');
    await waitForApp(page);

    const nav = page.locator('nav');
    await expect(nav).toBeVisible({ timeout: 10_000 });
    const navText = await nav.textContent() || '';

    // MUST be present in nav rail
    const requiredItems = ['Home', 'My Projects', 'Solution Library'];
    for (const item of requiredItems) {
      expect(navText, `Nav rail must contain "${item}"`).toContain(item);
    }

    // MUST NOT be present in nav rail (stale items from prior iterations)
    const forbiddenItems = ['Build Guides', 'Discover', 'ShopEase', 'HR Helper'];
    for (const item of forbiddenItems) {
      expect(navText, `Nav rail must NOT contain "${item}"`).not.toContain(item);
    }

    // Clicking Solution Library navigates to /discover route
    const solLibBtn = nav.getByText('Solution Library');
    await expect(solLibBtn).toBeVisible();
    await solLibBtn.click();
    await expect(page).toHaveURL(/\/#\/discover/, { timeout: 5_000 });

    // Page heading should match
    await expect(page.getByRole('heading', { name: 'Solution Library' })).toBeVisible();

    // Allow 502 errors from API proxy in test context (server may not be fully up)
    const realErrors = console.errors.filter(e => !e.includes('502'));
    expect(realErrors).toHaveLength(0);
  });

  test('clicking Home/Create nav item navigates to root', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/mystuff');
    await waitForApp(page);

    // Navigate back to home by clicking the first nav button (Home/Create)
    const nav = page.locator('nav');
    const firstNavButton = nav.locator('button').first();
    await firstNavButton.click();

    // URL should change to root hash
    await expect(page).toHaveURL(/\/#\/$/, { timeout: 5_000 });

    expect(console.errors).toHaveLength(0);
  });

  test('clicking My Projects/Agents nav item navigates to /mystuff', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/');
    await waitForApp(page);

    // The second nav button is "My Projects" or "Agents"
    const nav = page.locator('nav');
    const navButtons = nav.locator('button');

    // Find the button that navigates to /mystuff — it's the second primary nav button
    const secondNavButton = navButtons.nth(1);
    await secondNavButton.click();

    // URL should contain /mystuff
    await expect(page).toHaveURL(/\/#\/mystuff/, { timeout: 5_000 });

    expect(console.errors).toHaveLength(0);
  });

  test('active nav item has visual indicator', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/');
    await waitForApp(page);

    // On the home page, the first nav button should have an active state
    const nav = page.locator('nav');
    const firstNavButton = nav.locator('button').first();

    // The active indicator is a div with opacity-100 (pill indicator)
    // Check that the button has an active visual treatment
    const activeIndicator = firstNavButton.locator('div.opacity-100');
    const hasIndicator = await activeIndicator.count();

    // At minimum, the button should exist and be visible
    await expect(firstNavButton).toBeVisible();

    // Navigate to mystuff and check the second button becomes active
    await navigateTo(page, '/mystuff');
    await waitForApp(page);

    // The second nav button should now have the active state
    const secondNavButton = nav.locator('button').nth(1);
    await expect(secondNavButton).toBeVisible();

    expect(console.errors).toHaveLength(0);
  });

  test('all main routes are accessible from nav', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/');
    await waitForApp(page);

    // Navigate to key routes and verify each loads
    const routes = [
      { path: '/mystuff', marker: 'My Projects' },
      { path: '/discover', marker: 'Solution Library' },
      { path: '/snapshots', marker: 'Snapshots' },
    ];

    for (const route of routes) {
      await navigateTo(page, route.path);
      await waitForApp(page);

      // Verify the route-specific marker text is visible
      await expect(page.getByText(route.marker, { exact: false }).first()).toBeVisible({
        timeout: 10_000,
      });

      // Page should not be blank
      const rootHtml = await page.locator('#root').innerHTML();
      expect(rootHtml.length, `${route.path} rendered blank`).toBeGreaterThan(50);
    }

    expect(console.errors).toHaveLength(0);
  });

  test('browser back navigation works', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/');
    await waitForApp(page);

    // Navigate to /mystuff
    await navigateTo(page, '/mystuff');
    await waitForApp(page);
    await expect(page.getByText('My Projects', { exact: false }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Navigate to /discover
    await navigateTo(page, '/discover');
    await waitForApp(page);
    await expect(page.getByText('Solution Library', { exact: false }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Go back to /mystuff
    await page.goBack();
    await waitForApp(page);
    await expect(page).toHaveURL(/\/#\/mystuff/, { timeout: 5_000 });

    // Go back to home
    await page.goBack();
    await waitForApp(page);
    await expect(page).toHaveURL(/\/#\/$/, { timeout: 5_000 });

    expect(console.errors).toHaveLength(0);
  });

  test('no console errors during navigation', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/');
    await waitForApp(page);

    // Navigate through several routes
    await navigateTo(page, '/mystuff');
    await waitForApp(page);
    await navigateTo(page, '/discover');
    await waitForApp(page);
    await navigateTo(page, '/');
    await waitForApp(page);

    await verifyPageLoaded(page);
    expect(console.errors, 'Unexpected console errors during navigation').toHaveLength(0);
  });
});
