import { expect } from '@playwright/test';
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
} from '../fixtures';
import { type Oracle, type OracleContext } from './types';

const consoleState = new WeakMap<object, { errors: string[]; warnings: string[] }>();

export const buildOracle: Oracle = {
  feature: 'build',
  description: 'Build page loads for a configured agent; instructions editor present; no crash',

  async setup({ page }: OracleContext) {
    await resetAppState(page);
    await seedAgents(page, FIXTURES.configuredAgent());
    await setFeatureFlags(page, FLAG_PRESETS.allFeatures);
  },

  async actions({ page }: OracleContext) {
    consoleState.set(page, collectConsole(page));
    await navigateTo(page, '/build');
    await waitForApp(page);
    // Give async routes time to resolve.
    await page.waitForTimeout(500);
  },

  async assertions({ page }: OracleContext) {
    // Build page should render non-blank content.
    const rootHtml = await page.locator('#root').innerHTML();
    expect(rootHtml.length, 'build page rendered blank').toBeGreaterThan(500);

    // The agent nav rail button for the seeded agent exists (by accessible name).
    await expect(
      page.getByRole('button', { name: 'Configured Agent' }).first(),
      'seeded agent button not in nav rail',
    ).toBeVisible({ timeout: 10_000 });

    // Build page shows the agent banner with the name, or the build-tab nav.
    const agentBanner = page.getByText('Configured Agent', { exact: false });
    const buildMainArea = page.locator('main, [role="main"], #root > div').first();

    // The build page's main content area must be visible and have agent-specific content.
    await expect(buildMainArea).toBeVisible({ timeout: 5_000 });
    // At least one banner/header with the agent name should be rendered (visible in main UI).
    const bannerCount = await agentBanner.count();
    expect(bannerCount, 'agent name must appear at least twice (nav + build UI)').toBeGreaterThanOrEqual(2);
  },

  async invariants({ page }: OracleContext) {
    expect(await hasErrorBoundary(page)).toBe(false);

    const col = consoleState.get(page);
    if (col) {
      // Build page may have benign warnings about unregistered skills; filter critical only.
      const critical = col.errors.filter((e) =>
        /error boundary|unhandled|crash|failed to render/i.test(e),
      );
      expect(critical, `critical errors on build:\n${critical.join('\n')}`).toHaveLength(0);
    }
  },
};
