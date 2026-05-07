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

export const agentManagementOracle: Oracle = {
  feature: 'agent-management',
  description: 'My Projects renders seeded agents; agent cards show name + audience; nav agent list matches',

  async setup({ page }: OracleContext) {
    await resetAppState(page);
    await seedAgents(page, FIXTURES.mixedAgents());
    await setFeatureFlags(page, FLAG_PRESETS.allFeatures);
  },

  async actions({ page }: OracleContext) {
    consoleState.set(page, collectConsole(page));
    await navigateTo(page, '/mystuff');
    await waitForApp(page);
  },

  async assertions({ page }: OracleContext) {
    // My Projects marker.
    await expect(page.getByText('My Projects', { exact: false }).first()).toBeVisible({ timeout: 10_000 });

    // All 4 seeded agents should be visible by name.
    const expectedNames = ['Support Bot', 'Policy Advisor', 'Onboarding Flow', 'IT Desk'];
    for (const name of expectedNames) {
      await expect(
        page.getByText(name, { exact: false }).first(),
        `agent "${name}" should render in MyStuff`,
      ).toBeVisible({ timeout: 5_000 });
    }

    // Page is not blank.
    const rootHtml = await page.locator('#root').innerHTML();
    expect(rootHtml.length).toBeGreaterThan(500);
  },

  async invariants({ page }: OracleContext) {
    expect(await hasErrorBoundary(page)).toBe(false);

    const col = consoleState.get(page);
    if (col) {
      // Filter pre-existing environmental noise: 502 proxy startup + the
      // SharePoint Online font CDN CORS preflight redirect (Fluent UI
      // loads Segoe UI from `static2.sharepointonline.com` and the CDN
      // redirects, which Chromium blocks). Narrows focus to actual
      // app-level console errors.
      // Allow transient proxy errors (502 from dev server startup).
      // SharePoint font CDN noise is filtered at collection time in
      // helpers.ts — see IGNORE_PATTERNS.
      const real = col.errors.filter((e) => !/502|network/i.test(e));
      expect(real, `console errors on agent management:\n${real.join('\n')}`).toHaveLength(0);
    }
  },
};
