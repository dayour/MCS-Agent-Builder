/**
 * Page Object: SettingsPage — agent settings.
 */
import { type Page, type Locator, expect } from '@playwright/test';

export class SettingsPage {
  readonly heading: Locator;
  readonly categoryCards: Locator;
  readonly searchInput: Locator;
  readonly tabs: Locator;

  constructor(private page: Page) {
    this.heading = page.getByRole('heading', { name: /settings/i });
    this.categoryCards = page.locator('[class*="card"], [class*="Card"]');
    this.searchInput = page.getByPlaceholder(/search/i);
    this.tabs = page.getByRole('tablist');
  }

  // --- Actions ---

  /** Click a tab by name. */
  async switchTab(name: string): Promise<void> {
    await this.tabs.getByRole('tab', { name }).click();
  }

  /** Search settings. */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
  }

  /** Toggle a switch by its label text. Returns the new checked state. */
  async toggleSwitch(label: string): Promise<boolean> {
    const toggle = this.page.getByRole('switch', { name: new RegExp(label, 'i') });
    await toggle.click();
    return toggle.isChecked();
  }
}
