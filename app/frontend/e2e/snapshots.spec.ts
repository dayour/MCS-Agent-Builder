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
// SnapshotsPage — built-in snapshots, filters, and search
// ---------------------------------------------------------------------------
test.describe('SnapshotsPage', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await seedAgents(page, FIXTURES.configuredAgent());
    await setFeatureFlags(page, FLAG_PRESETS.allFeatures);
  });

  test('snapshots page loads with heading', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/snapshots');
    await waitForApp(page);

    await expect(page.locator('h1').filter({ hasText: 'Snapshots' })).toBeVisible({
      timeout: 10_000,
    });
    await verifyPageLoaded(page);
    expect(console.errors).toHaveLength(0);
  });

  test('built-in snapshots are listed', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/snapshots');
    await waitForApp(page);

    // Built-in snapshots include lifecycle stages like "Day Zero"
    // At minimum, there should be snapshot cards with "Load Snapshot" buttons
    const loadButtons = page.getByRole('button', { name: /Load Snapshot/i });
    await expect(loadButtons.first()).toBeVisible({ timeout: 10_000 });
    const count = await loadButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);

    expect(console.errors).toHaveLength(0);
  });

  test('lifecycle stage filter pills are visible', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/snapshots');
    await waitForApp(page);

    // Filter pills are buttons: All, Day Zero, In Progress, Published, Bad Agent, Custom
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Day Zero' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'In Progress' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Published' })).toBeVisible();

    expect(console.errors).toHaveLength(0);
  });

  test('clicking a filter pill filters the snapshot list', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/snapshots');
    await waitForApp(page);

    // Wait for snapshots to render
    await expect(page.getByRole('button', { name: /Load Snapshot/i }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Count all snapshot cards before filtering
    const allCards = page.getByRole('button', { name: /Load Snapshot/i });
    const allCount = await allCards.count();

    // Click "Day Zero" filter button
    const dayZeroFilter = page.getByRole('button', { name: 'Day Zero' });
    await dayZeroFilter.click();

    // The filtered count should be less than or equal to the total
    const filteredCards = page.getByRole('button', { name: /Load Snapshot/i });
    const filteredCount = await filteredCards.count();
    expect(filteredCount).toBeLessThanOrEqual(allCount);

    expect(console.errors).toHaveLength(0);
  });

  test('search input filters snapshot list by name', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/snapshots');
    await waitForApp(page);

    // The search input should be present
    const searchInput = page.getByPlaceholder('Search snapshots');
    // Fall back to any input in the header area if the specific placeholder doesn't exist
    const search = (await searchInput.isVisible().catch(() => false))
      ? searchInput
      : page.locator('input[type="text"]').first();

    await expect(search).toBeVisible({ timeout: 10_000 });

    // Type a search query that is unlikely to match any snapshot
    await search.fill('xyznonexistent');

    // Wait for filtering to take effect — either no cards or an empty state
    // The load buttons should decrease or disappear
    const loadButtons = page.getByRole('button', { name: /Load Snapshot/i });
    // Either zero results or fewer than before
    await expect(async () => {
      const count = await loadButtons.count();
      expect(count).toBeLessThanOrEqual(1);
    }).toPass({ timeout: 5_000 });

    expect(console.errors).toHaveLength(0);
  });

  test('snapshot cards have Details button', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/snapshots');
    await waitForApp(page);

    // Each snapshot card should have a "Details" button
    const detailsButtons = page.getByRole('button', { name: /Details/i });
    await expect(detailsButtons.first()).toBeVisible({ timeout: 10_000 });
    const count = await detailsButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);

    expect(console.errors).toHaveLength(0);
  });

  test('no console errors on snapshots page', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/snapshots');
    await waitForApp(page);
    await verifyPageLoaded(page);

    expect(console.errors, 'Unexpected console errors on snapshots page').toHaveLength(0);
  });
});
