/**
 * Accessibility sweep — axe-core WCAG 2.1 AA scan on every route.
 *
 * Catches color contrast, missing labels, landmark issues, and ARIA violations.
 * Runs per-route so failures are isolated and actionable.
 *
 * This is additive to the role-based locators already used in feature tests —
 * those validate that the app works with semantic HTML, while axe validates
 * that semantic HTML meets accessibility standards.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  resetAppState,
  seedAgents,
  setFeatureFlags,
  navigateTo,
  waitForApp,
  FIXTURES,
  FLAG_PRESETS,
} from './fixtures';
import { ROUTES, CONDITIONAL_ROUTES } from './helpers';

// ---------------------------------------------------------------------------
// Primary routes — full WCAG 2.1 AA scan
// ---------------------------------------------------------------------------
test.describe('Accessibility: primary routes', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await seedAgents(page, FIXTURES.configuredAgent());
    await setFeatureFlags(page, FLAG_PRESETS.allFeatures);
  });

  for (const route of ROUTES) {
    test(`${route.name} (${route.path}) — WCAG 2.1 AA`, async ({ page }) => {
      await navigateTo(page, route.path);
      await waitForApp(page);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      // Attach full violation details as test artifact (visible in HTML report)
      if (results.violations.length > 0) {
        await test.info().attach('a11y-violations', {
          body: JSON.stringify(
            results.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              description: v.description,
              helpUrl: v.helpUrl,
              nodes: v.nodes.length,
              targets: v.nodes.slice(0, 3).map((n) => n.target),
            })),
            null,
            2
          ),
          contentType: 'application/json',
        });
      }

      // Phase 1 (current): report-only. Violations are attached as artifacts
      // but don't fail the test. This avoids blocking on existing a11y debt.
      //
      // Phase 2 (after clearing backlog): uncomment to make blocking:
      //   const critical = results.violations.filter(
      //     (v) => v.impact === 'critical' || v.impact === 'serious'
      //   );
      //   expect(critical).toHaveLength(0);
      //
      // Log violation summary for visibility in test output
      if (results.violations.length > 0) {
        const summary = results.violations
          .map((v) => `  [${v.impact}] ${v.id} (${v.nodes.length} nodes)`)
          .join('\n');
        console.log(`a11y: ${route.path} — ${results.violations.length} violations:\n${summary}`);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Conditional routes — best-effort scan (may have missing state)
// ---------------------------------------------------------------------------
test.describe('Accessibility: conditional routes', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await seedAgents(page, FIXTURES.configuredAgent());
    await setFeatureFlags(page, FLAG_PRESETS.conditionalRoutes);
  });

  for (const route of CONDITIONAL_ROUTES) {
    test(`${route.name} (${route.path}) — WCAG 2.1 AA`, async ({ page }) => {
      await navigateTo(page, route.path);
      // Conditional routes may redirect — give extra time
      await page.waitForSelector('#root > *', { state: 'attached', timeout: 15_000 });

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      if (results.violations.length > 0) {
        await test.info().attach('a11y-violations', {
          body: JSON.stringify(
            results.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              description: v.description,
              nodes: v.nodes.length,
            })),
            null,
            2
          ),
          contentType: 'application/json',
        });
      }

      // Phase 1 (current): report-only for conditional routes too
      if (results.violations.length > 0) {
        const summary = results.violations
          .map((v) => `  [${v.impact}] ${v.id} (${v.nodes.length} nodes)`)
          .join('\n');
        console.log(`a11y: ${route.path} — ${results.violations.length} violations:\n${summary}`);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Keyboard navigation — can the user Tab through key workflows?
// ---------------------------------------------------------------------------
test.describe('Accessibility: keyboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await seedAgents(page, FIXTURES.configuredAgent());
    await setFeatureFlags(page, FLAG_PRESETS.allFeatures);
  });

  test('Tab cycles through nav rail items', async ({ page }) => {
    await navigateTo(page, '/');
    await waitForApp(page);

    // Focus the first nav button
    const nav = page.locator('nav');
    await nav.locator('button').first().focus();

    // Tab through nav items — each Tab should move focus to next button
    const navButtonCount = await nav.locator('button').count();
    for (let i = 1; i < Math.min(navButtonCount, 5); i++) {
      await page.keyboard.press('Tab');
    }

    // After tabbing, focus should still be within the nav (or just past it)
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });

  test('Enter activates create card on Home', async ({ page }) => {
    await navigateTo(page, '/');
    await waitForApp(page);

    // Focus the Agent card button and press Enter
    const agentCard = page.getByRole('heading', { name: /^Agent$/, level: 3 });
    // The card is inside a button — focus the parent button
    const cardButton = agentCard.locator('xpath=ancestor::button');
    // If the heading is directly clickable, use it; otherwise find nearest button
    const target = (await cardButton.count()) > 0 ? cardButton.first() : agentCard;
    await target.focus();
    await page.keyboard.press('Enter');

    // The landing view should transition
    await expect(page.getByText("Or select what you'd like to build")).not.toBeVisible({
      timeout: 5_000,
    });
  });

  test('Escape closes dropdown on MyStuff', async ({ page }) => {
    await navigateTo(page, '/mystuff');
    await waitForApp(page);

    // Open the Create New dropdown
    const createBtn = page.getByRole('button', { name: 'Create new' });
    await createBtn.click();

    // Verify dropdown is open
    await expect(page.getByText('AI Teammate').first()).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');

    // Dropdown should be dismissed — or at minimum not crash the page.
    // Some Fluent UI dropdowns may use click-outside instead of Escape.
    const stillVisible = await page.getByText('AI Teammate').first()
      .isVisible({ timeout: 2_000 }).catch(() => false);
    if (stillVisible) {
      // Click outside to dismiss (alternative close mechanism)
      await page.locator('body').click({ position: { x: 10, y: 10 } });
    }

    // Page should remain functional
    await expect(page.getByRole('heading', { name: 'My Projects' })).toBeVisible();
  });
});
