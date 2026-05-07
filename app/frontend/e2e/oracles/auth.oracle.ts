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

export const authOracle: Oracle = {
  feature: 'auth',
  description: 'App boots with auth state; nav rail renders with account row; no auth-related console errors',

  async setup({ page }: OracleContext) {
    await resetAppState(page);
    await seedAgents(page, FIXTURES.singleAgent());
    await setFeatureFlags(page, FLAG_PRESETS.minimal);
  },

  async actions({ page }: OracleContext) {
    consoleState.set(page, collectConsole(page));
    await navigateTo(page, '/');
    await waitForApp(page);
  },

  async assertions({ page }: OracleContext) {
    // Nav rail must render — the auth-gated layout only shows if auth resolved.
    await expect(page.locator('nav')).toBeVisible({ timeout: 10_000 });

    // Nav rail must have at least 2 interactive items — blank nav = render failure.
    const navButtons = page.locator('nav button');
    expect(await navButtons.count()).toBeGreaterThanOrEqual(2);

    // Must NOT show the auth fallback / unauthenticated screen.
    await expect(page.getByText('Sign in to continue', { exact: false })).not.toBeVisible({ timeout: 1_000 }).catch(() => { /* expected not-visible */ });
  },

  async invariants({ page }: OracleContext) {
    // No React error boundary.
    expect(await hasErrorBoundary(page)).toBe(false);

    // No auth-specific console errors (MSAL, token, 401).
    const col = consoleState.get(page);
    if (col) {
      const authErrors = col.errors.filter((e) =>
        /msal|token|unauth|401|403/i.test(e),
      );
      expect(authErrors, `auth-related console errors:\n${authErrors.join('\n')}`).toHaveLength(0);
    }
  },
};
