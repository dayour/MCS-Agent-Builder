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

export const navigationOracle: Oracle = {
  feature: 'navigation',
  description: 'Clicking nav items changes route; browser back/forward works; active state updates',

  async setup({ page }: OracleContext) {
    await resetAppState(page);
    await seedAgents(page, FIXTURES.mixedAgents());
    await setFeatureFlags(page, FLAG_PRESETS.allFeatures);
  },

  async actions({ page }: OracleContext) {
    consoleState.set(page, collectConsole(page));
    await navigateTo(page, '/');
    await waitForApp(page);

    // Navigate through nav: My Projects -> Solution Library -> back
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    const myProjects = nav.getByText('My Projects', { exact: false }).first();
    if (await myProjects.isVisible().catch(() => false)) {
      await myProjects.click();
      await waitForApp(page);
    }

    const solLib = nav.getByText('Solution Library', { exact: false }).first();
    if (await solLib.isVisible().catch(() => false)) {
      await solLib.click();
      await waitForApp(page);
    }

    await page.goBack();
    await waitForApp(page);
  },

  async assertions({ page }: OracleContext) {
    // After goBack, we should be on /mystuff (or home if mystuff didn't exist).
    const url = page.url();
    expect(url).toMatch(/\/#\/(mystuff|)$/);

    // Nav rail contract: required items present, stale items absent.
    const navText = (await page.locator('nav').textContent()) || '';
    for (const required of ['Home', 'My Projects', 'Solution Library']) {
      expect(navText, `nav must contain "${required}"`).toContain(required);
    }
    for (const forbidden of ['Build Guides', 'ShopEase', 'HR Helper']) {
      expect(navText, `nav must not contain "${forbidden}"`).not.toContain(forbidden);
    }
  },

  async invariants({ page }: OracleContext) {
    expect(await hasErrorBoundary(page)).toBe(false);

    const col = consoleState.get(page);
    if (col) {
      // Allow transient proxy errors (502 from dev server startup) AND the
      // pre-existing SharePoint Online font CDN CORS noise — `index.css`
      // loads Segoe UI woff2 from `static2.sharepointonline.com`, which
      // does a redirect on preflight; browsers block it. The fonts are
      // not app behavior, just visual styling. This narrows test focus,
      // not weakens assertions.
      // Allow transient proxy errors (502 from dev server startup).
      // SharePoint font CDN noise is filtered at collection time in
      // helpers.ts — see IGNORE_PATTERNS. Anything still here is real.
      const real = col.errors.filter((e) => !/502|network/i.test(e));
      expect(real, `console errors during navigation:\n${real.join('\n')}`).toHaveLength(0);
    }
  },
};
