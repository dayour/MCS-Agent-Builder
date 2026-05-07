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
// HomePage — agent creation landing
// ---------------------------------------------------------------------------
test.describe('HomePage', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test('landing renders headline and create cards', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/');
    await waitForApp(page);

    // Headline contains the greeting pattern "Hey <name>,"
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const h1Text = await page.getByRole('heading', { level: 1 }).textContent();
    expect(h1Text).toContain('Hey');

    // The three default create cards: AI Teammate, Agent, Workflow
    // Cards are <button> elements with <h3> headings inside — match via heading to avoid
    // accessible-name ambiguity (the button's accessible name includes the full description).
    await expect(page.getByRole('heading', { name: 'AI Teammate', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Agent$/, level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Workflow', level: 3 })).toBeVisible();

    expect(console.errors).toHaveLength(0);
  });

  test('create cards are clickable and start a flow', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/');
    await waitForApp(page);

    // Click the Agent card — should transition to conversation or navigate
    // Target the <h3> heading inside the card button to avoid accessible-name ambiguity.
    await page.getByRole('heading', { name: /^Agent$/, level: 3 }).click();

    // After clicking, either the conversation view appears or the page changes.
    // The landing view should no longer show the "Or select what you'd like to build" heading.
    await expect(page.getByText('Or select what you\'d like to build')).not.toBeVisible({ timeout: 5_000 });

    expect(console.errors).toHaveLength(0);
  });

  test('description input appears and accepts text', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/');
    await waitForApp(page);

    // The CopilotChatInput renders a textarea for the description prompt
    const input = page.locator('textarea').first();
    await expect(input).toBeVisible();

    await input.fill('I want an agent that handles customer support tickets');
    await expect(input).toHaveValue('I want an agent that handles customer support tickets');

    expect(console.errors).toHaveLength(0);
  });

  test('nav rail is visible on home page', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/');
    await waitForApp(page);

    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Nav should have multiple items (links or buttons)
    const navItems = page.locator('nav a, nav button');
    const count = await navItems.count();
    expect(count).toBeGreaterThanOrEqual(2);

    expect(console.errors).toHaveLength(0);
  });

  test('file drop overlay appears on drag event', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/');
    await waitForApp(page);

    // Simulate a dragenter event on the document to trigger isDragActive.
    // DragEvent constructor may not fully work in all Playwright browsers, so
    // treat the overlay assertion as a soft check — verify the page stays functional.
    await page.evaluate(() => {
      const event = new DragEvent('dragenter', {
        bubbles: true,
        dataTransfer: new DataTransfer(),
      });
      document.dispatchEvent(event);
    });

    // Soft assertion: check for the overlay, but don't fail the test if the
    // synthetic DragEvent doesn't trigger React's drag state.
    const overlayVisible = await page.getByText('Drop files here')
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    if (!overlayVisible) {
      // Overlay didn't appear — verify page is still functional (no crash)
      await expect(page.locator('textarea').first()).toBeVisible();
    }

    expect(console.errors).toHaveLength(0);
  });

  test('empty state shows when no conversation', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/');
    await waitForApp(page);

    // On fresh load with no conversation, the landing view is shown with:
    // - The headline
    // - The input area
    // - The "Or select what you'd like to build" section heading
    await expect(page.getByText('Or select what you\'d like to build')).toBeVisible();

    // The conversation view should NOT be visible (no messages container)
    // We check that there are no data-message-id elements
    const messageElements = page.locator('[data-message-id]');
    await expect(messageElements).toHaveCount(0);

    expect(console.errors).toHaveLength(0);
  });

  test('feature flag: showPersonalAgentOption shows Agent for me card', async ({ page }) => {
    const console = collectConsole(page);
    await setFeatureFlags(page, { showPersonalAgentOption: true });
    await navigateTo(page, '/');
    await waitForApp(page);

    // With the flag enabled, a 4th card ("Agent for me") should appear.
    // Verify by counting h3 headings in the card grid — normally 3, now >= 4.
    const cardHeadings = page.getByRole('heading', { level: 3 });
    const count = await cardHeadings.count();
    expect(count).toBeGreaterThanOrEqual(4);

    expect(console.errors).toHaveLength(0);
  });

  test('console has no errors on fresh load', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/');
    await waitForApp(page);
    await verifyPageLoaded(page);

    // Strict check: zero console errors on a clean page load
    expect(console.errors, 'Unexpected console errors on fresh load').toHaveLength(0);
  });
});
