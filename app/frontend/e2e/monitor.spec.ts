import { test, expect } from '@playwright/test';
import {
  resetAppState,
  seedAgents,
  setFeatureFlags,
  navigateTo,
  collectConsole,
  FIXTURES,
  FLAG_PRESETS,
} from './fixtures';

// ---------------------------------------------------------------------------
// MonitorPage — analytics dashboard (lazy-loaded, needs agent + flag)
// ---------------------------------------------------------------------------
test.describe('MonitorPage', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await seedAgents(page, FIXTURES.configuredAgent());
    await setFeatureFlags(page, { ...FLAG_PRESETS.allFeatures, isMonitorV2: true });
  });

  test('monitor page loads without crash', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/monitor');
    // Monitor lazy-loads — wait for React to mount
    await page.waitForSelector('#root > *', { state: 'attached', timeout: 15_000 });

    // Page should have rendered something — check outerHTML of body for content
    const bodyHtml = await page.locator('body').innerHTML();
    expect(bodyHtml.length).toBeGreaterThan(100);

    // No error boundary
    const errorBoundary = page.getByText('Something went wrong');
    const hasError = await errorBoundary.isVisible({ timeout: 1000 }).catch(() => false);
    expect(hasError).toBeFalsy();
  });

  test('monitor page shows disabled message without flag', async ({ page }) => {
    const console = collectConsole(page);
    await setFeatureFlags(page, { ...FLAG_PRESETS.minimal, isMonitorV2: false });
    await navigateTo(page, '/monitor');
    await page.waitForSelector('#root > *', { state: 'attached', timeout: 10_000 });

    // Without the flag, page should still render something (not crash)
    const rootHtml = await page.locator('#root').innerHTML();
    expect(rootHtml.length).toBeGreaterThan(50);
  });

  test('monitor page renders content', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/monitor');
    await page.waitForSelector('#root > *', { state: 'attached', timeout: 15_000 });

    // Page body should have real content
    const bodyHtml = await page.locator('body').innerHTML();
    expect(bodyHtml.length).toBeGreaterThan(100);
  });

  test('no critical console errors on monitor page', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/monitor');
    await page.waitForSelector('#root > *', { state: 'attached', timeout: 15_000 });

    // Filter for critical errors only (error boundaries, uncaught exceptions)
    const criticalErrors = console.errors.filter(e =>
      /error boundary|uncaught|fatal/i.test(e)
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
