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
// EvaluatePage — agent evaluation and test sets
// ---------------------------------------------------------------------------
test.describe('EvaluatePage', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test('evaluate page loads with Data type text', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.configuredAgent();
    await seedAgents(page, agents);
    await setFeatureFlags(page, FLAG_PRESETS.minimal);
    await navigateTo(page, '/evaluate');
    await waitForApp(page);
    await verifyPageLoaded(page);

    // The create evaluation view shows "Data type" as a section heading
    await expect(page.getByText('Data type', { exact: false }).first()).toBeVisible({
      timeout: 10_000,
    });

    expect(console.errors).toHaveLength(0);
  });

  test('create evaluation button is accessible', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.configuredAgent();
    await seedAgents(page, agents);
    await setFeatureFlags(page, FLAG_PRESETS.minimal);
    await navigateTo(page, '/evaluate');
    await waitForApp(page);

    // The "Create evaluation" text appears as a navigation breadcrumb/button
    await expect(page.getByText('Create evaluation', { exact: false })).toBeVisible({
      timeout: 10_000,
    });

    expect(console.errors).toHaveLength(0);
  });

  test('dataset list area renders', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.configuredAgent();
    await seedAgents(page, agents);
    await setFeatureFlags(page, FLAG_PRESETS.minimal);
    await navigateTo(page, '/evaluate');
    await waitForApp(page);

    // The create evaluation view shows data type options: "Single response" and "Conversation"
    await expect(page.getByText('Single response', { exact: false })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Conversation', { exact: false })).toBeVisible();

    // The data source section with upload area should be present
    await expect(page.getByText('Data source', { exact: false })).toBeVisible();

    expect(console.errors).toHaveLength(0);
  });

  test('evaluate page with evals V2 flag loads content', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.configuredAgent();
    await seedAgents(page, agents);
    await setFeatureFlags(page, { ...FLAG_PRESETS.minimal, isEvalsV2: true });
    await navigateTo(page, '/evaluate');
    await waitForApp(page);

    // Page should render substantial content with the evals V2 flag
    const rootHtml = await page.locator('#root').innerHTML();
    expect(rootHtml.length).toBeGreaterThan(200);

    // Should have interactive elements (buttons, inputs)
    const buttons = page.getByRole('button');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThanOrEqual(3);

    // No error boundary
    const errorBoundary = page.getByText('Something went wrong');
    const hasError = await errorBoundary.isVisible({ timeout: 1000 }).catch(() => false);
    expect(hasError).toBeFalsy();

    expect(console.errors).toHaveLength(0);
  });

  test('no console errors on evaluate page', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.configuredAgent();
    await seedAgents(page, agents);
    await setFeatureFlags(page, FLAG_PRESETS.minimal);
    await navigateTo(page, '/evaluate');
    await waitForApp(page);
    await verifyPageLoaded(page);

    // Give the page a moment to finish async rendering
    await page.waitForLoadState('networkidle');

    expect(console.errors, `Console errors:\n${console.errors.join('\n')}`).toHaveLength(0);
  });
});
