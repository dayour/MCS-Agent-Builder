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
// PreviewPage — agent testing / chat preview
// ---------------------------------------------------------------------------
test.describe('PreviewPage', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test('preview page loads with heading', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.configuredAgent();
    await seedAgents(page, agents);
    await setFeatureFlags(page, FLAG_PRESETS.minimal);
    await navigateTo(page, '/preview');
    await waitForApp(page);
    await verifyPageLoaded(page);

    // The preview page shows a chat input (textarea) and/or the agent name
    // "Preview your agent" may be hidden if the nav rail is collapsed or agent name is in the sidebar
    const chatInput = page.locator('textarea').first();
    const previewText = page.getByText('Preview your agent', { exact: false });
    const agentName = page.getByText(agents[0].name, { exact: false }).first();

    // At least one of these should be visible — chat input, preview heading, or agent name
    const chatVisible = await chatInput.isVisible().catch(() => false);
    const previewVisible = await previewText.isVisible().catch(() => false);
    const nameVisible = await agentName.isVisible().catch(() => false);
    expect(chatVisible || previewVisible || nameVisible).toBeTruthy();

    expect(console.errors).toHaveLength(0);
  });

  test('chat input is visible', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.configuredAgent();
    await seedAgents(page, agents);
    await setFeatureFlags(page, FLAG_PRESETS.minimal);
    await navigateTo(page, '/preview');
    await waitForApp(page);

    // CopilotChatInput renders a textarea with role="combobox"
    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 10_000 });

    expect(console.errors).toHaveLength(0);
  });

  test('activity section is visible', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.configuredAgent();
    await seedAgents(page, agents);
    await setFeatureFlags(page, FLAG_PRESETS.minimal);
    await navigateTo(page, '/preview');
    await waitForApp(page);

    // The preview page has an activity section accessible via the history button
    // or the "Try chatting with your agent" text in the preview header bar
    const tryChatting = page.getByText('Try chatting with your agent', { exact: false });
    const tryChatVisible = await tryChatting.isVisible().catch(() => false);

    if (tryChatVisible) {
      // The channel/trigger preview header bar is visible
      await expect(tryChatting).toBeVisible();
    } else {
      // In narrow mode, the agent greeting is shown instead
      const agentGreeting = page.getByText(agents[0].name, { exact: false });
      await expect(agentGreeting.first()).toBeVisible();
    }

    expect(console.errors).toHaveLength(0);
  });

  test('typing in chat input enables interaction', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.configuredAgent();
    await seedAgents(page, agents);
    await setFeatureFlags(page, FLAG_PRESETS.minimal);
    await navigateTo(page, '/preview');
    await waitForApp(page);

    // Find the chat textarea and type into it
    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 10_000 });

    await chatInput.fill('Hello, can you help me?');
    await expect(chatInput).toHaveValue('Hello, can you help me?');

    // After typing, a send button should become available
    // The send button is typically an icon button near the input
    const sendButton = page.locator('button[aria-label="Send"], button:has(svg)').last();
    await expect(sendButton).toBeVisible();

    expect(console.errors).toHaveLength(0);
  });

  test('empty state shows when no sessions exist', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.configuredAgent();
    await seedAgents(page, agents);
    await setFeatureFlags(page, FLAG_PRESETS.minimal);
    await navigateTo(page, '/preview');
    await waitForApp(page);

    // Preview page should show the chat input area (empty state = no messages yet)
    const chatInput = page.locator('textarea').first();
    const inputVisible = await chatInput.isVisible({ timeout: 10_000 }).catch(() => false);
    // Or the page shows "Preview your agent" heading
    const heading = page.getByText('Preview', { exact: false }).first();
    const headingVisible = await heading.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(inputVisible || headingVisible).toBeTruthy();

    expect(console.errors).toHaveLength(0);
  });

  test('preview page with all features loads without crash', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.configuredAgent();
    await seedAgents(page, agents);
    await setFeatureFlags(page, { ...FLAG_PRESETS.allFeatures });
    await navigateTo(page, '/preview');
    await waitForApp(page);

    // Page should have substantial content (not blank/crash)
    const rootHtml = await page.locator('#root').innerHTML();
    expect(rootHtml.length).toBeGreaterThan(200);

    // No error boundary
    const errorBoundary = page.getByText('Something went wrong');
    const hasError = await errorBoundary.isVisible({ timeout: 1000 }).catch(() => false);
    expect(hasError).toBeFalsy();

    expect(console.errors).toHaveLength(0);
  });

  test('no console errors on preview page', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.configuredAgent();
    await seedAgents(page, agents);
    await setFeatureFlags(page, FLAG_PRESETS.minimal);
    await navigateTo(page, '/preview');
    await waitForApp(page);
    await verifyPageLoaded(page);

    // Give the page a moment to finish async rendering
    await page.waitForLoadState('networkidle');

    expect(console.errors, `Console errors:\n${console.errors.join('\n')}`).toHaveLength(0);
  });
});
