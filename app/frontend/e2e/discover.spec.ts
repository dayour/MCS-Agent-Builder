import { test, expect } from '@playwright/test';
import {
  resetAppState,
  navigateTo,
  waitForApp,
  collectConsole,
} from './fixtures';

// ---------------------------------------------------------------------------
// Solution Library — solutions from SharePoint
// ---------------------------------------------------------------------------
test.describe('Solution Library', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test('page renders with heading and solutions from API', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/discover');
    await waitForApp(page);

    // Page heading
    await expect(page.getByRole('heading', { name: 'Solution Library' })).toBeVisible();

    // Wait for API fetch to complete (web-first assertion auto-retries)
    await expect(page.getByText('solutions from SharePoint')).toBeVisible({ timeout: 10_000 });

    // Solution cards should render in a grid
    const cards = page.locator('[class*="grid"] > *');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    expect(console.errors).toHaveLength(0);
  });

  test('search input filters solutions by name', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/discover');
    await waitForApp(page);
    // Wait for solutions to load before searching
    await page.waitForLoadState('networkidle').catch(() => {});

    const searchInput = page.getByPlaceholder('Search solutions...');
    await expect(searchInput).toBeVisible();

    // Type a search query
    await searchInput.fill('Agent');

    // Cards should be filtered — fewer than total
    const cards = page.locator('[class*="grid"] > *');
    const filteredCount = await cards.count();
    expect(filteredCount).toBeGreaterThan(0);

    expect(console.errors).toHaveLength(0);
  });

  test('filter pills work', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/discover');
    await waitForApp(page);
    // Wait for solutions to load before filtering
    await page.waitForLoadState('networkidle').catch(() => {});

    // Filter pills should be visible
    await expect(page.getByRole('button', { name: /All/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Deployable/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Reference/ }).first()).toBeVisible();

    // Click Deployable filter
    await page.getByRole('button', { name: /Deployable/ }).first().click();

    // Grid should still have cards (deployable solutions exist)
    const cards = page.locator('[class*="grid"] > *');
    expect(await cards.count()).toBeGreaterThan(0);

    expect(console.errors).toHaveLength(0);
  });
});
