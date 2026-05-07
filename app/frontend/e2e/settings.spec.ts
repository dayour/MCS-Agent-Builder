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
// AgentSettingsPage — settings categories, sections, and controls
// ---------------------------------------------------------------------------
test.describe('AgentSettingsPage', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await seedAgents(page, FIXTURES.configuredAgent());
    await setFeatureFlags(page, FLAG_PRESETS.allFeatures);
  });

  test('settings page loads with heading', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/settings');
    await waitForApp(page);

    // The settings page shows "Settings" as heading text
    await expect(page.getByText('Settings', { exact: false }).first()).toBeVisible({
      timeout: 10_000,
    });
    await verifyPageLoaded(page);
    expect(console.errors).toHaveLength(0);
  });

  test('settings category cards are visible', async ({ page }) => {
    const console = collectConsole(page);
    await setFeatureFlags(page, { ...FLAG_PRESETS.allFeatures });
    await navigateTo(page, '/settings');
    await waitForApp(page);

    // Simplified settings shows category card buttons (each has label + description in the accessible name)
    await expect(page.getByRole('button', { name: /General/ }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Security/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Languages/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Advanced/ }).first()).toBeVisible();

    expect(console.errors).toHaveLength(0);
  });

  test('clicking a category navigates to its detail view', async ({ page }) => {
    const console = collectConsole(page);
    await setFeatureFlags(page, { ...FLAG_PRESETS.allFeatures });
    await navigateTo(page, '/settings');
    await waitForApp(page);

    // Click the General category button
    const generalCard = page.getByRole('button', { name: /General/ }).first();
    await expect(generalCard).toBeVisible({ timeout: 10_000 });
    await generalCard.click();

    // After clicking, we should see section cards like "Orchestration", "Model", "Knowledge"
    await expect(page.getByText('Orchestration').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Model').first()).toBeVisible();
    await expect(page.getByText('Knowledge').first()).toBeVisible();

    expect(console.errors).toHaveLength(0);
  });

  test('toggle switches are interactive', async ({ page }) => {
    const console = collectConsole(page);
    await setFeatureFlags(page, { ...FLAG_PRESETS.allFeatures });
    await navigateTo(page, '/settings');
    await waitForApp(page);

    // Find any switch element on the page (Deep reasoning, General knowledge, etc.)
    const switches = page.locator('input[role="switch"]');
    await expect(switches.first()).toBeVisible({ timeout: 10_000 });
    const count = await switches.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Click the first switch and verify it toggles
    const firstSwitch = switches.first();
    const initialChecked = await firstSwitch.isChecked();
    await firstSwitch.click();
    const afterChecked = await firstSwitch.isChecked();
    expect(afterChecked).toBe(!initialChecked);

    expect(console.errors).toHaveLength(0);
  });

  test('search input is visible and functional on simplified settings', async ({ page }) => {
    const console = collectConsole(page);
    await setFeatureFlags(page, { ...FLAG_PRESETS.allFeatures });
    await navigateTo(page, '/settings');
    await waitForApp(page);

    // The search input should be visible (CopilotInput with placeholder "Search")
    const searchInput = page.getByPlaceholder('Search').first();
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    // Type a search query
    await searchInput.fill('moderation');

    // The matching section should appear in filtered results
    await expect(page.getByText('Moderation').first()).toBeVisible({ timeout: 5_000 });

    expect(console.errors).toHaveLength(0);
  });

  test('no console errors on settings page', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/settings');
    await waitForApp(page);
    await verifyPageLoaded(page);

    expect(console.errors, 'Unexpected console errors on settings page').toHaveLength(0);
  });
});
