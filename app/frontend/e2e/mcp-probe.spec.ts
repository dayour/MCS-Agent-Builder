import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// MCP Probe — data-driven exploratory checks from knowledge/feature-map.json
//
// Invoked by tools/agentic-test-loop.js mcp-probe. Reads FEATURE env var,
// expands via feature-map, executes each mcp_check, writes structured results
// to e2e/mcp-probe-results.json. Honors TEST_RUN_ID for correlation.
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirnameLocal = path.dirname(__filename);

const FEATURE_MAP_PATH = path.resolve(__dirnameLocal, '..', '..', '..', 'knowledge', 'feature-map.json');
const RESULTS_PATH = path.resolve(__dirnameLocal, 'mcp-probe-results.json');

const FEATURE = process.env.FEATURE || '';
const TEST_RUN_ID = process.env.TEST_RUN_ID || `probe-${Date.now().toString(36)}`;
const ALLOWED_ACTIONS = new Set(['navigate', 'snapshot', 'verify_text', 'console', 'click']);
const SAFE_SELECTOR_RE = /^[\[\]a-zA-Z0-9_\-=:'" .#>,*()^$~|]+$/;
const DEFAULT_STEP_TIMEOUT = 10_000;

type Check = {
  action: string;
  route?: string;
  text?: string;
  selector?: string;
  expect?: string;
  expectText?: string;
  consoleAllow?: string[];
  description?: string;
  timeoutMs?: number;
  optional?: boolean;
};

type StepResult = {
  stepId: string;
  feature: string;
  featureTier: 'direct' | 'adjacent' | 'broad';
  action: string;
  route?: string;
  description?: string;
  status: 'pass' | 'fail' | 'skipped';
  durationMs: number;
  error?: string;
  artifacts: Array<{ kind: string; relativePath: string }>;
  timestamp: string;
};

type FeatureMapEntry = {
  aliases?: string[];
  description?: string;
  routes?: string[];
  related?: string[];
  tags?: string[];
  mcp_checks?: Check[];
};

type FeatureMap = { features: Record<string, FeatureMapEntry> };

function loadFeatureMap(): FeatureMap | null {
  try { return JSON.parse(fs.readFileSync(FEATURE_MAP_PATH, 'utf-8')); } catch { return null; }
}

function resolveFeatureKey(query: string, fm: FeatureMap): string | null {
  if (!query) return null;
  const q = query.toLowerCase().trim();
  if (fm.features[q]) return q;
  for (const [key, feat] of Object.entries(fm.features)) {
    if (feat.aliases?.some((a) => a.toLowerCase() === q)) return key;
  }
  for (const [key, feat] of Object.entries(fm.features)) {
    if (feat.aliases?.some((a) => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()))) return key;
  }
  return null;
}

type Expanded = { features: Array<{ key: string; tier: 'direct' | 'adjacent' | 'broad'; checks: Check[] }> };

function expand(primary: string, fm: FeatureMap): Expanded {
  const seen = new Set<string>();
  const out: Expanded['features'] = [];
  const primaryFeat = fm.features[primary];
  if (!primaryFeat) return { features: [] };
  seen.add(primary);
  out.push({ key: primary, tier: 'direct', checks: primaryFeat.mcp_checks || [] });

  for (const adj of primaryFeat.related || []) {
    if (seen.has(adj) || !fm.features[adj]) continue;
    seen.add(adj);
    out.push({ key: adj, tier: 'adjacent', checks: fm.features[adj].mcp_checks || [] });
    for (const broad of fm.features[adj].related || []) {
      if (seen.has(broad) || !fm.features[broad]) continue;
      seen.add(broad);
      out.push({ key: broad, tier: 'broad', checks: fm.features[broad].mcp_checks || [] });
    }
  }
  return { features: out };
}

function hashSelector(s: string): string {
  return crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);
}

async function navigateHash(page: Page, route: string): Promise<void> {
  const url = `http://localhost:8080/#${route}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#root > *', { state: 'attached', timeout: 15_000 });
}

async function runCheck(
  page: Page,
  check: Check,
  ctx: { feature: string; tier: 'direct' | 'adjacent' | 'broad' }
): Promise<StepResult> {
  const start = Date.now();
  const stepId = `${ctx.feature}-${check.action}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const base: Omit<StepResult, 'status' | 'durationMs' | 'error'> = {
    stepId,
    feature: ctx.feature,
    featureTier: ctx.tier,
    action: check.action,
    route: check.route,
    description: check.description,
    artifacts: [],
    timestamp: new Date().toISOString(),
  };
  const timeout = check.timeoutMs ?? DEFAULT_STEP_TIMEOUT;

  try {
    if (!ALLOWED_ACTIONS.has(check.action)) {
      throw new Error(`Disallowed action: ${check.action}`);
    }

    const collectedConsole: string[] = [];
    const consoleHandler = (msg: ConsoleMessage) => {
      if (msg.type() === 'error') collectedConsole.push(msg.text());
    };
    page.on('console', consoleHandler);

    try {
      switch (check.action) {
        case 'navigate': {
          if (!check.route) throw new Error('navigate requires route');
          await Promise.race([
            navigateHash(page, check.route),
            new Promise((_, rej) => setTimeout(() => rej(new Error('nav timeout')), timeout)),
          ]);
          break;
        }
        case 'snapshot': {
          if (!check.route) throw new Error('snapshot requires route');
          await navigateHash(page, check.route);
          await page.waitForSelector('nav', { timeout });
          const snapPath = path.resolve(__dirnameLocal, '..', 'test-results', `mcp-probe-${stepId}.png`);
          await page.screenshot({ path: snapPath, fullPage: false });
          base.artifacts.push({ kind: 'screenshot', relativePath: path.relative(path.resolve(__dirnameLocal, '..'), snapPath).replace(/\\/g, '/') });
          break;
        }
        case 'verify_text': {
          if (!check.route || !check.text) throw new Error('verify_text requires route + text');
          await navigateHash(page, check.route);
          if (check.text === 'nav') {
            await page.waitForSelector('nav', { timeout });
          } else {
            await expect(page.getByText(check.text, { exact: false }).first()).toBeVisible({ timeout });
          }
          break;
        }
        case 'console': {
          if (!check.route) throw new Error('console requires route');
          await navigateHash(page, check.route);
          await page.waitForSelector('nav', { timeout });
          await page.waitForTimeout(500);
          const allow = (check.consoleAllow || []).map((p) => new RegExp(p));
          const unfiltered = collectedConsole.filter((m) => !allow.some((r) => r.test(m)));
          if (unfiltered.length > 0) {
            throw new Error(`console errors: ${unfiltered.slice(0, 3).join(' | ')}`);
          }
          break;
        }
        case 'click': {
          if (!check.selector) throw new Error('click requires selector');
          if (!SAFE_SELECTOR_RE.test(check.selector)) {
            throw new Error(`selector failed safety check: ${hashSelector(check.selector)}`);
          }
          if (check.route) await navigateHash(page, check.route);
          await page.locator(check.selector).first().click({ timeout });
          if (check.expect) {
            await expect(page.locator(check.expect).first()).toBeVisible({ timeout });
          }
          if (check.expectText) {
            await expect(page.getByText(check.expectText, { exact: false }).first()).toBeVisible({ timeout });
          }
          break;
        }
      }
    } finally {
      page.off('console', consoleHandler);
    }

    return { ...base, status: 'pass', durationMs: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ...base,
      status: check.optional ? 'skipped' : 'fail',
      durationMs: Date.now() - start,
      error: msg.slice(0, 400),
    };
  }
}

test.describe('MCP Probe', () => {
  test.beforeAll(async () => {
    if (!FEATURE) {
      throw new Error('FEATURE env var required (e.g. FEATURE=auth npx playwright test --project=mcp-probe)');
    }
  });

  test(`probe: ${FEATURE || '(no feature)'}`, async ({ page, context }) => {
    const fm = loadFeatureMap();
    if (!fm) throw new Error(`feature-map not found at ${FEATURE_MAP_PATH}`);

    const key = resolveFeatureKey(FEATURE, fm);
    if (!key) throw new Error(`feature "${FEATURE}" not resolvable`);

    // Correlation ID: set before every page load via init script + extra headers.
    // addInitScript runs before any app code on every new document — covers reloads,
    // popups, and navigation. extraHTTPHeaders covers fetch/XHR from the page.
    await context.addInitScript((rid) => {
      (window as unknown as { __TEST_RUN_ID: string }).__TEST_RUN_ID = rid;
      try { localStorage.setItem('__TEST_RUN_ID', rid); } catch { /* private mode */ }
    }, TEST_RUN_ID);
    await context.setExtraHTTPHeaders({ 'X-Test-Run-Id': TEST_RUN_ID });

    const expanded = expand(key, fm);
    const results: StepResult[] = [];

    for (const feat of expanded.features) {
      for (const check of feat.checks) {
        const r = await runCheck(page, check, { feature: feat.key, tier: feat.tier });
        results.push(r);
         
        console.log(`[mcp-probe] ${r.status.padEnd(7)} ${r.feature}/${r.action} ${r.route || ''} ${r.error ? '— ' + r.error.slice(0, 80) : ''}`);
      }
    }

    const passed = results.filter((r) => r.status === 'pass').length;
    const failed = results.filter((r) => r.status === 'fail').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;

    const summary = {
      testRunId: TEST_RUN_ID,
      feature: key,
      resolvedFrom: FEATURE,
      expandedFeatures: expanded.features.map((f) => ({ key: f.key, tier: f.tier, checkCount: f.checks.length })),
      totals: { passed, failed, skipped, total: results.length },
      results,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(RESULTS_PATH, JSON.stringify(summary, null, 2));

    if (failed > 0) {
      const failureSummary = results
        .filter((r) => r.status === 'fail')
        .slice(0, 5)
        .map((r) => `  ${r.feature}/${r.action} ${r.route || ''}: ${r.error}`)
        .join('\n');
      throw new Error(`${failed} probe step(s) failed:\n${failureSummary}`);
    }
  });
});
