/**
 * Playwright fixtures that inject Page Object instances into tests.
 *
 * Usage in test files:
 *   import { test, expect } from '../pages';
 *   test('example', async ({ page, homePage, myStuffPage }) => { ... });
 *
 * This pattern centralizes locators in page objects while keeping
 * assertions visible in test files (not hidden behind POM methods).
 */
import { test as base, expect } from '@playwright/test';
import { HomePage } from './home.page';
import { MyStuffPage } from './mystuff.page';
import { BuildPage } from './build.page';
import { PreviewPage } from './preview.page';
import { SettingsPage } from './settings.page';

type AppFixtures = {
  homePage: HomePage;
  myStuffPage: MyStuffPage;
  buildPage: BuildPage;
  previewPage: PreviewPage;
  settingsPage: SettingsPage;
};

export const test = base.extend<AppFixtures>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  myStuffPage: async ({ page }, use) => {
    await use(new MyStuffPage(page));
  },
  buildPage: async ({ page }, use) => {
    await use(new BuildPage(page));
  },
  previewPage: async ({ page }, use) => {
    await use(new PreviewPage(page));
  },
  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },
});

export { expect };

// Re-export page classes for direct use
export { HomePage } from './home.page';
export { MyStuffPage } from './mystuff.page';
export { BuildPage } from './build.page';
export { PreviewPage } from './preview.page';
export { SettingsPage } from './settings.page';
