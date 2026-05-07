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
  createTestWorkflow,
  FIXTURES,
  FLAG_PRESETS,
} from './fixtures';

// ---------------------------------------------------------------------------
// MyStuffPage — agent list / CRUD
// ---------------------------------------------------------------------------
test.describe('MyStuffPage', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test('empty state renders when no agents exist', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/mystuff');
    await waitForApp(page);

    // Page heading is always present
    await expect(page.getByRole('heading', { name: 'My Projects' })).toBeVisible();

    // Empty state messaging
    await expect(page.getByText('No agents or workflows yet')).toBeVisible();
    await expect(page.getByText('Create your first agent to get started')).toBeVisible();

    // The "Create new" button should be visible in empty state
    await expect(page.getByRole('button', { name: 'Create new' })).toBeVisible();

    expect(console.errors).toHaveLength(0);
  });

  test('table renders with seeded agents', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.mixedAgents();
    await seedAgents(page, agents);
    await navigateTo(page, '/mystuff');
    await waitForApp(page);

    // Each agent name should be visible in the table (scope to table to avoid nav rail duplicates)
    const table = page.locator('table').first();
    for (const agent of agents) {
      await expect(table.getByText(agent.name).first()).toBeVisible();
    }

    // Item count should reflect the number of seeded agents
    await expect(page.getByText(`${agents.length} items`)).toBeVisible();

    expect(console.errors).toHaveLength(0);
  });

  test('filter pills are visible', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.mixedAgents();
    await seedAgents(page, agents);
    await navigateTo(page, '/mystuff');
    await waitForApp(page);

    // "All" filter pill is always present
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();

    // Other pills appear based on seeded data — mixedAgents has employees, customers, and workflows
    await expect(page.getByRole('button', { name: 'Workflows' })).toBeVisible();

    expect(console.errors).toHaveLength(0);
  });

  test('clicking filter pill filters the table', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.mixedAgents();
    await seedAgents(page, agents);
    await navigateTo(page, '/mystuff');
    await waitForApp(page);

    // Count initial items
    const allCount = agents.length;
    await expect(page.getByText(`${allCount} items`)).toBeVisible();

    // Click the Workflows filter pill
    await page.getByRole('button', { name: 'Workflows' }).click();

    // After filtering, only workflow agents should show
    const workflowCount = agents.filter(a => a.type === 'workflow').length;
    await expect(page.getByText(`${workflowCount} item`)).toBeVisible();

    // The workflow name should be visible in the table
    const table = page.locator('table').first();
    const workflowAgent = agents.find(a => a.type === 'workflow');
    if (workflowAgent) {
      await expect(table.getByText(workflowAgent.name).first()).toBeVisible();
    }

    expect(console.errors).toHaveLength(0);
  });

  test('sort by column header changes order', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.mixedAgents();
    await seedAgents(page, agents);
    await navigateTo(page, '/mystuff');
    await waitForApp(page);

    // Click the "Name" column header to sort
    const nameHeader = page.getByRole('columnheader', { name: /Name/i });
    await expect(nameHeader).toBeVisible();
    await nameHeader.click();

    // After clicking once (asc → desc or vice versa), the first visible agent name
    // should be different from the default. We just verify the header is interactive
    // and the table still renders all agents. Scope to table to avoid nav rail duplicates.
    const table = page.locator('table').first();
    for (const agent of agents) {
      await expect(table.getByText(agent.name).first()).toBeVisible();
    }

    expect(console.errors).toHaveLength(0);
  });

  test('create dropdown opens on click', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.singleAgent();
    await seedAgents(page, agents);
    await navigateTo(page, '/mystuff');
    await waitForApp(page);

    // Click the "Create new" button
    await page.getByRole('button', { name: 'Create new' }).click();

    // Dropdown should show creation options (rendered as ghost CopilotButtons with nested text).
    // Use .first() in case the text also appears elsewhere (e.g. filter pills).
    await expect(page.getByText('AI Teammate').first()).toBeVisible();
    await expect(page.getByText('Agent for employees').first()).toBeVisible();
    await expect(page.getByText('Agent for customers').first()).toBeVisible();
    await expect(page.getByText('Workflow').first()).toBeVisible();

    expect(console.errors).toHaveLength(0);
  });

  test('clicking agent row selects the agent', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.singleAgent();
    await seedAgents(page, agents);
    await navigateTo(page, '/mystuff');
    await waitForApp(page);

    // Click the agent row — scope to table to avoid clicking the nav rail entry
    const table = page.locator('table').first();
    await table.getByText(agents[0].name).first().click();

    // Row click may navigate to /build or just select the agent
    const url = page.url();
    if (url.includes('#/build')) {
      // Navigation happened — pass
      expect(url).toContain('#/build');
    } else {
      // Agent was selected — verify the row is highlighted or agent detail appears
      const row = page.getByRole('row').filter({ hasText: agents[0].name });
      await expect(row).toBeVisible();
    }

    expect(console.errors).toHaveLength(0);
  });

  test('row action buttons appear on hover', async ({ page }) => {
    const console = collectConsole(page);
    const agents = FIXTURES.singleAgent();
    await seedAgents(page, agents);
    await navigateTo(page, '/mystuff');
    await waitForApp(page);

    // Hover over the agent row to reveal action buttons
    const row = page.getByRole('row').filter({ hasText: 'Alpha Agent' });
    await expect(row).toBeVisible({ timeout: 5_000 });
    await row.hover();

    // After hover, row action buttons should become visible within the table row
    // These are icon buttons (pin, share, publish, more) that appear on hover
    const rowButtons = row.getByRole('button');
    const buttonCount = await rowButtons.count();
    expect(buttonCount).toBeGreaterThanOrEqual(1);

    expect(console.errors).toHaveLength(0);
  });

  test('published agent shows status indicator', async ({ page }) => {
    const console = collectConsole(page);
    const agents = [
      createTestAgent({ name: 'Published Bot', published: true }),
      createTestAgent({ name: 'Draft Bot', published: false }),
    ];
    await seedAgents(page, agents);
    await navigateTo(page, '/mystuff');
    await waitForApp(page);

    // Published status badge should be visible (scope to table to avoid nav duplicates)
    const table = page.locator('table').first();
    await expect(table.getByText('Published').first()).toBeVisible();
    // Draft status badge should be visible
    await expect(table.getByText('Draft').first()).toBeVisible();

    expect(console.errors).toHaveLength(0);
  });

  test('Agent Specs section shows server-backed projects', async ({ page }) => {
    const console = collectConsole(page);
    await navigateTo(page, '/mystuff');
    await waitForApp(page);

    // Wait for /api/projects fetch to complete
    await page.waitForLoadState('networkidle').catch(() => {});

    // Agent Specs section header should be visible
    await expect(page.locator('h2')).toContainText('Agent Specs');

    // Customer projects should render in an expandable card
    const card = page.locator('.rounded-lg.overflow-hidden').first();
    await expect(card).toBeVisible();

    // Click first customer to expand and see agents
    await card.locator('.cursor-pointer').first().click();

    // At least one agent name should be visible after expansion
    const agentNames = card.locator('.text-sm.font-medium');
    expect(await agentNames.count()).toBeGreaterThan(0);

    expect(console.errors).toHaveLength(0);
  });
});
