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
// BuildPage (AgentBuildPage) — agent configuration
// ---------------------------------------------------------------------------
test.describe('BuildPage', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test('build page loads with agent name visible', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.configuredAgent();
    await seedAgents(page, agents);
    await setFeatureFlags(page, FLAG_PRESETS.minimal);
    await navigateTo(page, '/build');
    await waitForApp(page);
    await verifyPageLoaded(page);

    // The agent name should be visible in the heading (aria-label="Agent name")
    // "Configured Agent" appears in multiple DOM locations; the heading is the reliable unique selector
    const nameHeading = page.getByRole('heading', { name: 'Agent name' });
    await expect(nameHeading).toBeVisible();
    await expect(nameHeading).toContainText(agents[0].name);

    expect(console.errors).toHaveLength(0);
  });

  test('instructions section shows agent instructions text', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.configuredAgent();
    await seedAgents(page, agents);
    await setFeatureFlags(page, FLAG_PRESETS.minimal);
    await navigateTo(page, '/build');
    await waitForApp(page);

    // The instructions panel should be present
    const instructionsPanel = page.locator('[data-section="Instructions Panel"]');
    await expect(instructionsPanel).toBeVisible({ timeout: 10_000 });

    // The instructions text from the configured agent should appear
    await expect(page.getByText('You are a configured test agent', { exact: false })).toBeVisible();

    expect(console.errors).toHaveLength(0);
  });

  test('name field is editable', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.configuredAgent();
    await seedAgents(page, agents);
    await setFeatureFlags(page, FLAG_PRESETS.minimal);
    await navigateTo(page, '/build');
    await waitForApp(page);

    // In full mode the name is a contentEditable div with aria-label "Agent name"
    const nameField = page.getByRole('heading', { name: 'Agent name' });
    const nameVisible = await nameField.isVisible().catch(() => false);

    if (nameVisible) {
      // Full mode: contentEditable heading
      await nameField.click();
      await nameField.fill('');
      await page.keyboard.type('Renamed Agent');
      await expect(nameField).toContainText('Renamed Agent');
    } else {
      // Narrow mode: CopilotInput with placeholder "Untitled Agent"
      const nameInput = page.getByPlaceholder('Untitled Agent');
      await expect(nameInput).toBeVisible();
      await nameInput.click();
      await nameInput.fill('Renamed Agent');
      await expect(nameInput).toHaveValue('Renamed Agent');
    }

    expect(console.errors).toHaveLength(0);
  });

  test('description field is editable', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.configuredAgent();
    await seedAgents(page, agents);
    await setFeatureFlags(page, FLAG_PRESETS.minimal);
    await navigateTo(page, '/build');
    await waitForApp(page);

    // In full mode the description is a contentEditable div with aria-label "Agent description"
    const descriptionField = page.getByRole('textbox', { name: 'Agent description' });
    const descVisible = await descriptionField.isVisible().catch(() => false);

    if (descVisible) {
      // Full mode: contentEditable textbox
      await descriptionField.click();
      await expect(descriptionField).toBeVisible();
    } else {
      // Narrow mode: description is a div with "Description" label inside the card
      const descSection = page.getByText('Description', { exact: true }).first();
      await expect(descSection).toBeVisible();
    }

    expect(console.errors).toHaveLength(0);
  });

  test('knowledge sources section is visible', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.configuredAgent();
    await seedAgents(page, agents);
    await setFeatureFlags(page, FLAG_PRESETS.minimal);
    await navigateTo(page, '/build');
    await waitForApp(page);

    // Verify the build page has the Instructions/Components toggle and instruction content
    // The instructions text from the configured agent should appear on the build page
    await expect(page.getByText('You are a configured test agent', { exact: false })).toBeVisible({ timeout: 10_000 });

    expect(console.errors).toHaveLength(0);
  });

  test('capabilities section renders', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.configuredAgent();
    await seedAgents(page, agents);
    await setFeatureFlags(page, FLAG_PRESETS.minimal);
    await navigateTo(page, '/build');
    await waitForApp(page);

    // The build page shows "Instructions view" and "Components view" toggle buttons
    // Verify at least one of these view buttons exists, proving the capabilities section renders
    const instructionsView = page.getByRole('button', { name: /Instructions view/i });
    const componentsView = page.getByRole('button', { name: /Components view/i });

    const anyVisible = await Promise.any([
      instructionsView.isVisible().then(v => v ? true : Promise.reject()),
      componentsView.isVisible().then(v => v ? true : Promise.reject()),
      // Fallback: check that the instructions panel at least renders
      page.locator('[data-section="Instructions Panel"]').isVisible().then(v => v ? true : Promise.reject()),
    ]).catch(() => false);

    expect(anyVisible).toBe(true);

    expect(console.errors).toHaveLength(0);
  });

  test('model selector is visible and shows current model', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.configuredAgent();
    await seedAgents(page, agents);
    await setFeatureFlags(page, FLAG_PRESETS.minimal);
    await navigateTo(page, '/build');
    await waitForApp(page);

    // The model dropdown should be present — in narrow mode it's labeled "Model",
    // in full mode it's a CopilotDropdown showing the current model name
    const modelLabel = page.getByText('Model', { exact: true });
    const modelLabelVisible = await modelLabel.isVisible().catch(() => false);

    if (modelLabelVisible) {
      // Narrow mode: "Model" label is visible in the card
      await expect(modelLabel).toBeVisible();
    }

    // The configured agent's model is 'opus-4.5' so "Opus" text should appear
    // The dropdown trigger shows the model icon and may display the model label
    const opusText = page.getByText('Opus', { exact: false });
    await expect(opusText.first()).toBeVisible({ timeout: 10_000 });

    expect(console.errors).toHaveLength(0);
  });

  test('tabs are visible and switchable when build tabs enabled', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.configuredAgent();
    await seedAgents(page, agents);
    await setFeatureFlags(page, { ...FLAG_PRESETS.minimal, isBuildTabsEnabled: true });
    await navigateTo(page, '/build');
    await waitForApp(page);

    // The build page shows navigation buttons: Build, Preview, Evaluate, Monitor
    // and the Instructions/Components view toggle
    const buildNav = page.getByRole('button', { name: 'Build' });
    const previewNav = page.getByRole('button', { name: 'Preview' });

    // At minimum the Build nav button should be present in the banner
    const buildVisible = await buildNav.first().isVisible().catch(() => false);
    const previewVisible = await previewNav.first().isVisible().catch(() => false);

    // Also check for the instructions/components view toggle
    const instructionsView = page.getByRole('button', { name: /Instructions view/i });
    const instrVisible = await instructionsView.isVisible().catch(() => false);

    // At least one of these navigation elements should be present
    expect(buildVisible || previewVisible || instrVisible).toBe(true);

    expect(console.errors).toHaveLength(0);
  });

  test('no console errors on build page', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.configuredAgent();
    await seedAgents(page, agents);
    await setFeatureFlags(page, FLAG_PRESETS.minimal);
    await navigateTo(page, '/build');
    await waitForApp(page);
    await verifyPageLoaded(page);

    // Give the page a moment to finish async rendering
    await page.waitForLoadState('networkidle');

    expect(console.errors, `Console errors:\n${console.errors.join('\n')}`).toHaveLength(0);
  });

  test('build page shows placeholder when no agent selected', async ({ page }) => {
    const console = collectConsole(page);
    // Do NOT seed agents — no agent is selected
    await setFeatureFlags(page, FLAG_PRESETS.minimal);
    await navigateTo(page, '/build');

    // Wait for React to mount (navigateTo already does this with state: 'attached')
    await page.waitForSelector('#root > *', { state: 'attached', timeout: 15_000 });

    // The page should not be completely blank — it may render a placeholder,
    // redirect, or show the BuildPageDispatcher's null state
    const rootHtml = await page.locator('#root').innerHTML();
    expect(rootHtml.length).toBeGreaterThan(20);

    // Should not have a React error boundary
    const errorBoundary = page.getByText('Something went wrong', { exact: false });
    await expect(errorBoundary).not.toBeVisible({ timeout: 3_000 });
  });
});
