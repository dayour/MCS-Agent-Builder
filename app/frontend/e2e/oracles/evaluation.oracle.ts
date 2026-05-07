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

export const evaluationOracle: Oracle = {
  feature: 'evaluation',
  description: 'Evaluate page renders the create-eval or results view; no crash',

  async setup({ page }: OracleContext) {
    await resetAppState(page);
    await seedAgents(page, FIXTURES.configuredAgent());
    await setFeatureFlags(page, FLAG_PRESETS.allFeatures);
  },

  async actions({ page }: OracleContext) {
    consoleState.set(page, collectConsole(page));
    await navigateTo(page, '/evaluate');
    await waitForApp(page);
  },

  async assertions({ page }: OracleContext) {
    // The Evaluate page must show the "Evaluate" h1 heading — stable semantic anchor.
    await expect(
      page.getByRole('heading', { name: 'Evaluate', level: 1 }),
      '"Evaluate" h1 heading not visible',
    ).toBeVisible({ timeout: 10_000 });

    // Page must render at least one eval control — matches either
    // the create-eval flow OR the results/dashboard view.
    const controls = page.getByRole('button', {
      name: /Data type|Add eval set|Run all tests|Export CSV|New evaluation/i,
    });
    const controlCount = await controls.count();
    expect(controlCount, 'no eval-page controls visible (create or dashboard)').toBeGreaterThanOrEqual(1);

    const rootHtml = await page.locator('#root').innerHTML();
    expect(rootHtml.length).toBeGreaterThan(500);
  },

  async invariants({ page }: OracleContext) {
    expect(await hasErrorBoundary(page)).toBe(false);

    const col = consoleState.get(page);
    if (col) {
      const critical = col.errors.filter((e) =>
        /error boundary|unhandled|crash/i.test(e),
      );
      expect(critical, `critical errors on evaluate:\n${critical.join('\n')}`).toHaveLength(0);
    }
  },
};
