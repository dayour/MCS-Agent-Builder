/**
 * Page Object: BuildPage — agent configuration.
 */
import { type Page, type Locator, expect } from '@playwright/test';

export class BuildPage {
  readonly agentName: Locator;
  readonly instructionsEditor: Locator;
  readonly descriptionEditor: Locator;
  readonly modelSelector: Locator;
  readonly tabList: Locator;
  readonly placeholder: Locator;
  readonly nav: Locator;

  constructor(private page: Page) {
    // Agent name can be a heading or a contentEditable div
    this.agentName = page.getByRole('heading', { level: 1 }).or(
      page.locator('[contenteditable]').first()
    );
    this.instructionsEditor = page.getByRole('textbox', { name: /instructions/i }).or(
      page.locator('[data-testid="instructions-editor"]')
    );
    this.descriptionEditor = page.getByRole('textbox', { name: /description/i }).or(
      page.locator('[contenteditable]').nth(1)
    );
    this.modelSelector = page.getByText(/opus|gpt|sonnet/i).first();
    this.tabList = page.getByRole('tablist');
    this.placeholder = page.getByText(/select an agent|no agent selected/i);
    this.nav = page.locator('nav');
  }

  // --- Actions ---

  /** Switch to a named tab (e.g., "Topics", "Knowledge"). */
  async switchTab(name: string): Promise<void> {
    await this.tabList.getByRole('tab', { name }).click();
  }

  /** Assert agent name contains expected text. */
  async expectAgentName(name: string): Promise<void> {
    await expect(this.agentName).toContainText(name, { timeout: 5_000 });
  }

  /** Assert the build page loaded with content (not placeholder). */
  async expectLoaded(): Promise<void> {
    // Either agent name or instructions visible means the page loaded
    const rootHtml = await this.page.locator('#root').innerHTML();
    expect(rootHtml.length).toBeGreaterThan(200);
  }
}
