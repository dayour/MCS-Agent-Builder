/**
 * Page Object: PreviewPage — chat preview.
 */
import { type Page, type Locator, expect } from '@playwright/test';

export class PreviewPage {
  readonly heading: Locator;
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly activitySection: Locator;
  readonly messages: Locator;

  constructor(private page: Page) {
    this.heading = page.getByText('Preview', { exact: false }).first();
    this.chatInput = page.getByRole('textbox').first();
    this.sendButton = page.getByRole('button', { name: /send/i });
    this.activitySection = page.getByText(/activity|conversation/i).first();
    this.messages = page.locator('[data-message-id]');
  }

  // --- Actions ---

  /** Type a message in the chat input. */
  async typeMessage(text: string): Promise<void> {
    await this.chatInput.fill(text);
  }

  /** Type and send a message. */
  async sendMessage(text: string): Promise<void> {
    await this.chatInput.fill(text);
    // Send button may appear after text is typed
    await expect(this.sendButton).toBeVisible({ timeout: 3_000 });
    await this.sendButton.click();
  }

  // --- Assertions ---

  /** Assert chat is in empty state. */
  async expectEmpty(): Promise<void> {
    await expect(this.chatInput).toBeVisible();
    await expect(this.messages).toHaveCount(0);
  }

  /** Assert chat input has specific value. */
  async expectInputValue(text: string): Promise<void> {
    const value = await this.chatInput.inputValue().catch(() => this.chatInput.textContent());
    expect(value).toContain(text);
  }
}
