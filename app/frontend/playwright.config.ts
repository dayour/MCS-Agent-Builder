import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'e2e/results.json' }],
  ],

  use: {
    baseURL: 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // Tier 1: Fast canary — runs in < 2 min, gates every change
    {
      name: 'smoke',
      testMatch: 'smoke.spec.ts',
      use: {
        ...devices['Desktop Edge'],
        viewport: { width: 1280, height: 720 },
        channel: 'msedge',
      },
    },
    // Tier 2: Per-page functional tests
    {
      name: 'features',
      testMatch: ['home.spec.ts', 'mystuff.spec.ts', 'discover.spec.ts', 'build.spec.ts',
        'preview.spec.ts', 'evaluate.spec.ts', 'settings.spec.ts', 'snapshots.spec.ts',
        'distribute.spec.ts', 'monitor.spec.ts', 'navigation.spec.ts', 'spec-debug.spec.ts'],
      use: {
        ...devices['Desktop Edge'],
        viewport: { width: 1280, height: 720 },
        channel: 'msedge',
      },
    },
    // Tier 3: Cross-page workflow journeys
    {
      name: 'journeys',
      testMatch: 'journeys.spec.ts',
      use: {
        ...devices['Desktop Edge'],
        viewport: { width: 1280, height: 720 },
        channel: 'msedge',
      },
    },
    // Tier 4: Edge cases & error states (mocked API — no backend needed)
    {
      name: 'edge-cases',
      testMatch: 'edge-cases.spec.ts',
      use: {
        ...devices['Desktop Edge'],
        viewport: { width: 1280, height: 720 },
        channel: 'msedge',
      },
    },
    // Tier 5: Accessibility — WCAG 2.1 AA + keyboard navigation
    {
      name: 'a11y',
      testMatch: 'a11y.spec.ts',
      use: {
        ...devices['Desktop Edge'],
        viewport: { width: 1280, height: 720 },
        channel: 'msedge',
      },
    },
    // Tier 6: MCP probe — data-driven exploratory checks from knowledge/feature-map.json
    {
      name: 'mcp-probe',
      testMatch: 'mcp-probe.spec.ts',
      use: {
        ...devices['Desktop Edge'],
        viewport: { width: 1280, height: 720 },
        channel: 'msedge',
      },
    },
    // Tier 7: Scenario oracles — semantic invariants for top features (not just page loads)
    {
      name: 'oracles',
      testMatch: 'oracles.spec.ts',
      use: {
        ...devices['Desktop Edge'],
        viewport: { width: 1280, height: 720 },
        channel: 'msedge',
      },
    },
    // Tier 8: Performance budgets — LCP + long-task assertions (report-only by default)
    {
      name: 'perf',
      testMatch: 'perf-budgets.spec.ts',
      use: {
        ...devices['Desktop Edge'],
        viewport: { width: 1280, height: 720 },
        channel: 'msedge',
      },
    },
    // Default: run everything (backward-compat with agentic loop)
    {
      name: 'msedge',
      use: {
        ...devices['Desktop Edge'],
        viewport: { width: 1280, height: 720 },
        channel: 'msedge',
      },
    },
  ],
});
