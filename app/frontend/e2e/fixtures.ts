/**
 * Test fixtures: state seeding, localStorage management, agent factories.
 *
 * Every test starts with a clean slate. Use seedAgents() to populate
 * localStorage with known test data before navigating.
 */
import { type Page, type BrowserContext } from '@playwright/test';

// ---------------------------------------------------------------------------
// Agent factory — minimal AgentConfig objects that the app will accept
// ---------------------------------------------------------------------------
export interface TestAgent {
  id: string;
  type: 'agent' | 'workflow';
  name: string;
  icon: string;
  iconKey?: string;
  gradientKey?: string;
  description: string;
  purpose: string;
  audience: 'employees' | 'customers';
  guidelines: string[];
  skills: string[];
  model: string;
  knowledge: { files: any[]; webSearch: boolean; specificSources: boolean; referenceOrgChart: boolean; customAPIs: any[] };
  instructions: string;
  capabilities: { name: string; type: string }[];
  published: boolean;
  createdAt: string;
  justCreated?: boolean;
  agentType?: string;
  channel?: string;
  publishedTriggers?: any[];
  version?: string;
}

let idCounter = 0;
export function createTestAgent(overrides: Partial<TestAgent> = {}): TestAgent {
  idCounter += 1;
  return {
    id: `test-agent-${idCounter}-${Date.now()}`,
    type: 'agent',
    name: `Test Agent ${idCounter}`,
    icon: '🤖',
    iconKey: 'robot',
    gradientKey: 'cerulean',
    description: `Test agent ${idCounter} description`,
    purpose: `Test agent ${idCounter} purpose`,
    audience: 'employees',
    guidelines: ['Be helpful', 'Be concise'],
    skills: ['General assistance'],
    model: 'opus-4.5',
    knowledge: { files: [], webSearch: false, specificSources: false, referenceOrgChart: false, customAPIs: [] },
    instructions: `You are Test Agent ${idCounter}. Help the user.`,
    capabilities: [{ name: 'General assistance', type: 'knowledge' }],
    published: false,
    createdAt: new Date(Date.now() - idCounter * 86400000).toISOString(),
    justCreated: false,
    ...overrides,
  };
}

export function createTestWorkflow(overrides: Partial<TestAgent> = {}): TestAgent {
  return createTestAgent({ type: 'workflow', name: `Test Workflow ${idCounter}`, icon: '⚡', ...overrides });
}

// Pre-built fixtures for common scenarios
export const FIXTURES = {
  /** Single unpublished agent */
  singleAgent: () => [createTestAgent({ name: 'Alpha Agent', description: 'First test agent' })],

  /** Multiple agents of different types for filtering tests */
  mixedAgents: () => [
    createTestAgent({ name: 'Support Bot', audience: 'customers', description: 'Customer support agent' }),
    createTestAgent({ name: 'Policy Advisor', audience: 'employees', description: 'Internal policy assistant' }),
    createTestWorkflow({ name: 'Onboarding Flow', description: 'Employee onboarding workflow' }),
    createTestAgent({ name: 'IT Desk', audience: 'employees', published: true, description: 'IT help desk agent' }),
  ],

  /** Agent with full configuration for build/settings tests */
  configuredAgent: () => [createTestAgent({
    name: 'Configured Agent',
    description: 'Fully configured for testing',
    instructions: 'You are a configured test agent.\n\n## Rules\n- Be precise\n- Use structured responses',
    capabilities: [
      { name: 'Knowledge Base', type: 'knowledge' },
      { name: 'Email Sending', type: 'action' },
      { name: 'CRM Connector', type: 'connector' },
    ],
    guidelines: ['Always verify before acting', 'Escalate unknowns', 'Log all actions'],
    skills: ['Email management', 'CRM lookups', 'Knowledge search'],
    published: true,
    channel: 'teams',
    publishedTriggers: [{ channel: 'teams', url: 'https://teams.example.com/bot' }],
  })],
};

// ---------------------------------------------------------------------------
// State seeding — write agents and flags to localStorage before page load
// ---------------------------------------------------------------------------

/**
 * Reset all app state in localStorage. Call in beforeEach.
 */
export async function resetAppState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.clear();
  });
}

/**
 * Seed agents into localStorage so the app renders them on load.
 * Must be called BEFORE navigating to the page.
 */
export async function seedAgents(page: Page, agents: TestAgent[]): Promise<void> {
  await page.addInitScript((data) => {
    localStorage.setItem('agents', JSON.stringify(data));
    // Set the first agent as current
    if (data.length > 0) {
      localStorage.setItem('currentAgentId', data[0].id);
    }
  }, agents);
}

/**
 * Set feature flags before page load. Pass an object of flag names to booleans.
 */
export async function setFeatureFlags(page: Page, flags: Record<string, boolean | string>): Promise<void> {
  await page.addInitScript((flagData) => {
    for (const [key, value] of Object.entries(flagData)) {
      localStorage.setItem(key, String(value));
    }
  }, flags);
}

/** Common flag presets */
export const FLAG_PRESETS = {
  /** Minimal flags — just what's needed for basic rendering */
  minimal: {
    isBuildTabsEnabled: true,
    isPillContextMenu: true,
    isNewNotifications: true,
    showVersionMilestones: true,
    showDraftCheckpoints: true,
    isPublishHAEnabled: true,
  } as Record<string, boolean>,

  /** Full features enabled */
  allFeatures: {
    isBuildTabsEnabled: true,
    isPillContextMenu: true,
    isNewNotifications: true,
    isPublishHAEnabled: true,
    isEvalMode: true,
    isInterviewMode: true,
    isPlanMode: true,
    isWorkIQEnabled: true,
    isSkillsEnabled: true,
    isTriggersEnabled: true,
    isDistributeEnabled: true,
    isMonitorV2: true,
    isToolsDA: true,
    isToolsCA: true,
    isVersionHistory: true,
    showVersionMilestones: true,
    showDraftCheckpoints: true,
    showPersonalAgentOption: true,
    isEvalsV2: true,
  } as Record<string, boolean>,

  /** Flags needed for conditional routes */
  conditionalRoutes: {
    isBuildTabsEnabled: true,
    isMonitorV2: true,
    isL1NavJuneProposal: true,
    isToolsDA: true,
    isDistributeEnabled: true,
  } as Record<string, boolean>,
};

// ---------------------------------------------------------------------------
// Navigation helpers (HashRouter-aware)
// ---------------------------------------------------------------------------
const BASE_URL = 'http://localhost:8080';

export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}/#${path}`, { waitUntil: 'domcontentloaded' });
  // Wait for React to mount — use 'attached' instead of 'visible' because some
  // pages render a hidden FluentProvider wrapper as #root > *:first-child
  await page.waitForSelector('#root > *', { state: 'attached', timeout: 15_000 });
}

export async function waitForApp(page: Page): Promise<void> {
  await page.waitForSelector('#root > *', { state: 'attached', timeout: 15_000 });
  // Wait for either nav (normal layout) or main content
  await page.waitForSelector('nav, main, [role="main"]', { state: 'attached', timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Console error collection (enhanced)
// ---------------------------------------------------------------------------
const NOISE_PATTERNS = [
  /favicon/i,
  /chrome-extension/i,
  /ResizeObserver loop/i,
  /Loading chunk/i,
  /Download the React DevTools/i,
  /manifest\.json/i,
  /service-worker/i,
  /Manifest:/i,
  /unique.*key.*prop/i,
];

export interface ConsoleErrors {
  errors: string[];
  warnings: string[];
}

export function collectConsole(page: Page): ConsoleErrors {
  const result: ConsoleErrors = { errors: [], warnings: [] };

  page.on('console', (msg) => {
    const text = msg.text();
    const isNoise = NOISE_PATTERNS.some((p) => p.test(text));
    if (isNoise) return;

    if (msg.type() === 'error') result.errors.push(text);
    if (msg.type() === 'warning') result.warnings.push(text);
  });

  return result;
}

/**
 * Check for React error boundaries in the page.
 */
export async function hasErrorBoundary(page: Page): Promise<boolean> {
  const errorTexts = ['Something went wrong', 'Error boundary', 'Uncaught Error'];
  for (const text of errorTexts) {
    const el = page.getByText(text, { exact: false });
    if (await el.isVisible({ timeout: 500 }).catch(() => false)) return true;
  }
  return false;
}

/**
 * Verify a page loaded real content (not blank/error).
 */
export async function verifyPageLoaded(page: Page): Promise<void> {
  const html = await page.locator('#root').innerHTML();
  if (html.length < 50) throw new Error('Page appears blank (root innerHTML < 50 chars)');
  const hasBoundary = await hasErrorBoundary(page);
  if (hasBoundary) throw new Error('React error boundary detected');
}
