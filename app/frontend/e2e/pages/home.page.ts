/**
 * Page Object: HomePage — agent creation landing.
 *
 * Centralizes locators and common interactions so test files stay
 * focused on assertions. Locators use role-based queries (survive refactors,
 * work with screen readers).
 */
import { type Page, type Locator, expect } from '@playwright/test';

export class HomePage {
  // --- Locators ---
  readonly headline: Locator;
  readonly chatInput: Locator;
  readonly buildPrompt: Locator;
  readonly cardGrid: Locator;
  readonly agentCard: Locator;
  readonly teammateCard: Locator;
  readonly workflowCard: Locator;
  readonly nav: Locator;

  constructor(private page: Page) {
    this.headline = page.getByRole('heading', { level: 1 });
    this.chatInput = page.locator('textarea').first();
    this.buildPrompt = page.getByText("Or select what you'd like to build");
    this.cardGrid = page.locator('[class*="grid"]').first();
    this.agentCard = page.getByRole('heading', { name: /^Agent$/, level: 3 });
    this.teammateCard = page.getByRole('heading', { name: 'AI Teammate', level: 3 });
    this.workflowCard = page.getByRole('heading', { name: 'Workflow', level: 3 });
    this.nav = page.locator('nav');
  }

  // --- Actions ---

  /** Type a description into the chat input. */
  async describe(text: string): Promise<void> {
    await this.chatInput.fill(text);
  }

  /** Click a create card by type. Returns true if navigation/transition occurred. */
  async clickCreateCard(type: 'agent' | 'teammate' | 'workflow'): Promise<void> {
    const card = type === 'agent' ? this.agentCard
      : type === 'teammate' ? this.teammateCard
      : this.workflowCard;
    await card.click();
    // Wait for the landing view to transition away
    await expect(this.buildPrompt).not.toBeVisible({ timeout: 5_000 });
  }

  /** Assert the landing page is in its initial empty state. */
  async expectEmptyState(): Promise<void> {
    await expect(this.headline).toBeVisible();
    await expect(this.buildPrompt).toBeVisible();
    await expect(this.chatInput).toBeVisible();
    await expect(this.agentCard).toBeVisible();
    await expect(this.teammateCard).toBeVisible();
    await expect(this.workflowCard).toBeVisible();
  }

  /** Count create cards visible (default 3, 4 with personalAgent flag). */
  async cardCount(): Promise<number> {
    return this.page.getByRole('heading', { level: 3 }).count();
  }
}
