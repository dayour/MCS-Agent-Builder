import { test, expect } from '@playwright/test';
import {
  resetAppState,
  seedAgents,
  setFeatureFlags,
  navigateTo,
  waitForApp,
  collectConsole,
  verifyPageLoaded,
  createTestAgent,
  FIXTURES,
  FLAG_PRESETS,
} from './fixtures';

// ---------------------------------------------------------------------------
// DistributePage — channel distribution for published agents
// ---------------------------------------------------------------------------
test.describe('DistributePage', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await setFeatureFlags(page, FLAG_PRESETS.allFeatures);
  });

  test('distribute page loads with heading', async ({ page }) => {
    const console = collectConsole(page);
    await seedAgents(page, FIXTURES.configuredAgent());
    await navigateTo(page, '/distribute');
    await waitForApp(page);

    await expect(page.getByRole('heading', { name: 'Distribute' })).toBeVisible({
      timeout: 10_000,
    });
    await verifyPageLoaded(page);
    expect(console.errors).toHaveLength(0);
  });

  test('published agent shows channel cards', async ({ page }) => {
    const console = collectConsole(page);
    // Seed a published agent with triggers (using configuredAgent which has published: true)
    await seedAgents(page, FIXTURES.configuredAgent());
    await navigateTo(page, '/distribute');
    await waitForApp(page);

    // Published agent shows "Live" badges on channel cards
    const liveBadges = page.getByText('Live');
    await expect(liveBadges.first()).toBeVisible({ timeout: 10_000 });

    expect(console.errors).toHaveLength(0);
  });

  test('unpublished agent shows empty state', async ({ page }) => {
    const console = collectConsole(page);
    // Seed an unpublished agent with no triggers
    const unpublishedAgent = createTestAgent({
      name: 'Unpublished Agent',
      published: false,
      publishedTriggers: [],
    });
    await seedAgents(page, [unpublishedAgent]);
    await navigateTo(page, '/distribute');
    await waitForApp(page);

    // Empty state should show "No published triggers yet"
    await expect(page.getByText('No published triggers yet')).toBeVisible({
      timeout: 10_000,
    });

    expect(console.errors).toHaveLength(0);
  });

  test('distribute page shows Direct Line surfaces section', async ({ page }) => {
    const console = collectConsole(page);
    await seedAgents(page, FIXTURES.configuredAgent());
    await navigateTo(page, '/distribute');
    await waitForApp(page);

    // The "Extend to more surfaces" section shows Direct Line channels
    await expect(page.getByText('Extend to more surfaces')).toBeVisible({
      timeout: 10_000,
    });

    // Direct Line surface names should be listed
    await expect(page.getByText('Slack').first()).toBeVisible();
    await expect(page.getByText('Telegram').first()).toBeVisible();
    await expect(page.getByText('Email').first()).toBeVisible();

    expect(console.errors).toHaveLength(0);
  });

  test('no console errors on distribute page', async ({ page }) => {
    const console = collectConsole(page);
    await seedAgents(page, FIXTURES.configuredAgent());
    await navigateTo(page, '/distribute');
    await waitForApp(page);
    await verifyPageLoaded(page);

    expect(console.errors, 'Unexpected console errors on distribute page').toHaveLength(0);
  });
});
