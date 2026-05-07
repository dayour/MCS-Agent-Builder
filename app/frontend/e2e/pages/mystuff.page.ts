/**
 * Page Object: MyStuffPage — agent list, filtering, sorting.
 */
import { type Page, type Locator, expect } from '@playwright/test';

export class MyStuffPage {
  readonly heading: Locator;
  readonly table: Locator;
  readonly emptyState: Locator;
  readonly createButton: Locator;
  readonly filterAll: Locator;
  readonly filterWorkflows: Locator;
  readonly itemCount: Locator;
  readonly searchInput: Locator;
  readonly nameHeader: Locator;

  constructor(private page: Page) {
    this.heading = page.getByRole('heading', { name: 'My Projects' });
    this.table = page.locator('table').first();
    this.emptyState = page.getByText('No agents or workflows yet');
    this.createButton = page.getByRole('button', { name: 'Create new' });
    this.filterAll = page.getByRole('button', { name: 'All' });
    this.filterWorkflows = page.getByRole('button', { name: 'Workflows' });
    this.itemCount = page.locator('text=/\\d+ items?/');
    this.searchInput = page.getByPlaceholder(/search/i);
    this.nameHeader = page.getByRole('columnheader', { name: /Name/i });
  }

  // --- Actions ---

  /** Click a filter pill by name. */
  async filter(name: string): Promise<void> {
    await this.page.getByRole('button', { name }).click();
  }

  /** Click the Name column header to sort. */
  async sortByName(): Promise<void> {
    await this.nameHeader.click();
  }

  /** Click an agent row by name (scoped to table). */
  async clickAgent(name: string): Promise<void> {
    await this.table.getByText(name).first().click();
  }

  /** Hover over an agent row by name. */
  async hoverAgent(name: string): Promise<void> {
    const row = this.page.getByRole('row').filter({ hasText: name });
    await row.hover();
  }

  /** Open the Create New dropdown. */
  async openCreateDropdown(): Promise<void> {
    await this.createButton.click();
  }

  /** Get the displayed item count text (e.g., "4 items"). */
  async getItemCountText(): Promise<string> {
    return (await this.itemCount.textContent()) || '';
  }

  // --- Assertions ---

  /** Assert agent names are visible in the table. */
  async expectAgentsVisible(names: string[]): Promise<void> {
    for (const name of names) {
      await expect(this.table.getByText(name).first()).toBeVisible();
    }
  }

  /** Assert the page is in empty state. */
  async expectEmpty(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.emptyState).toBeVisible();
    await expect(this.createButton).toBeVisible();
  }

  /** Assert published/draft badges. */
  async expectStatus(name: string, status: 'Published' | 'Draft'): Promise<void> {
    const row = this.page.getByRole('row').filter({ hasText: name });
    await expect(row.getByText(status).first()).toBeVisible();
  }
}
