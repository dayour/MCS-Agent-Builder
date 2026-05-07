import { test, expect, type Page } from '@playwright/test';
import {
  resetAppState,
  seedAgents,
  setFeatureFlags,
  navigateTo,
  waitForApp,
  FIXTURES,
  FLAG_PRESETS,
} from './fixtures';
import { attachTestRunId } from './helpers';

// ---------------------------------------------------------------------------
// Performance budgets — LCP, long-task, and TTI thresholds on critical routes.
//
// Behavior:
//   PERF_BUDGET_GATE=0 (default) — report violations in test output but do not fail
//   PERF_BUDGET_GATE=1           — fail the test on violation
//
// Rationale: report-only for 1 session to collect baseline, then flip to gate.
// ---------------------------------------------------------------------------

const GATE = process.env.PERF_BUDGET_GATE === '1';
const TEST_RUN_ID = process.env.TEST_RUN_ID;

// Budgets (ms). Tuned to Edge on a dev machine — adjust after baseline collection.
const BUDGETS = {
  lcp: 2500,         // Largest Contentful Paint
  longTaskMax: 500,  // Any single long task over this = problem
  totalLongTaskMs: 1500, // Sum of all long-tasks on the route
};

type PerfSample = {
  route: string;
  lcp: number | null;
  longTaskCount: number;
  longTaskMax: number;
  longTaskSum: number;
  violations: string[];
};

async function capturePerfMetrics(page: Page, route: string): Promise<PerfSample> {
  // Install observer BEFORE navigation — observers buffered via { buffered: true }.
  await page.addInitScript(() => {
    const w = window as unknown as {
      __perfSamples?: { longTasks: Array<{ startTime: number; duration: number }>; lcp: number | null };
    };
    w.__perfSamples = { longTasks: [], lcp: null };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          w.__perfSamples!.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch { /* not supported */ }
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) {
          const lcpEntry = last as unknown as { renderTime?: number; loadTime?: number };
          w.__perfSamples!.lcp = lcpEntry.renderTime || lcpEntry.loadTime || null;
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch { /* not supported */ }
  });

  await navigateTo(page, route);
  await waitForApp(page);
  // Give LCP and long-tasks time to settle after hydration.
  await page.waitForTimeout(1200);

  const samples = await page.evaluate(() => {
    const w = window as unknown as {
      __perfSamples?: { longTasks: Array<{ startTime: number; duration: number }>; lcp: number | null };
    };
    return w.__perfSamples || { longTasks: [], lcp: null };
  });

  const longTaskDurations = samples.longTasks.map((t) => Math.round(t.duration));
  const longTaskMax = longTaskDurations.length > 0 ? Math.max(...longTaskDurations) : 0;
  const longTaskSum = longTaskDurations.reduce((a, b) => a + b, 0);
  const lcp = samples.lcp ? Math.round(samples.lcp) : null;

  const violations: string[] = [];
  if (lcp !== null && lcp > BUDGETS.lcp) {
    violations.push(`LCP ${lcp}ms > budget ${BUDGETS.lcp}ms`);
  }
  if (longTaskMax > BUDGETS.longTaskMax) {
    violations.push(`longest task ${longTaskMax}ms > budget ${BUDGETS.longTaskMax}ms`);
  }
  if (longTaskSum > BUDGETS.totalLongTaskMs) {
    violations.push(`total long-task ${longTaskSum}ms > budget ${BUDGETS.totalLongTaskMs}ms`);
  }

  return {
    route,
    lcp,
    longTaskCount: samples.longTasks.length,
    longTaskMax,
    longTaskSum,
    violations,
  };
}

const CRITICAL_ROUTES = [
  { path: '/', name: 'Home' },
  { path: '/mystuff', name: 'My Projects' },
  { path: '/discover', name: 'Solution Library' },
];

test.describe('Performance budgets', () => {
  test.beforeEach(async ({ page, context }) => {
    if (TEST_RUN_ID) await attachTestRunId(context, TEST_RUN_ID);
    await resetAppState(page);
    await seedAgents(page, FIXTURES.mixedAgents());
    await setFeatureFlags(page, FLAG_PRESETS.allFeatures);
  });

  for (const route of CRITICAL_ROUTES) {
    test(`${route.name} (${route.path}) performance`, async ({ page }, testInfo) => {
      const sample = await capturePerfMetrics(page, route.path);

      // Always attach the sample for visibility — pass or fail.
      await testInfo.attach(`perf-${route.name.replace(/\s+/g, '-').toLowerCase()}.json`, {
        body: JSON.stringify(sample, null, 2),
        contentType: 'application/json',
      });

      if (sample.violations.length > 0) {
        const msg = `Perf budget violations on ${route.path}:\n  ${sample.violations.join('\n  ')}`;
        if (GATE) {
          expect(sample.violations, msg).toHaveLength(0);
        } else {
          // Report-only — log and annotate, but don't fail.
           
          console.warn(`[perf-budget report-only] ${msg}`);
          testInfo.annotations.push({ type: 'perf-warning', description: msg });
        }
      }
    });
  }
});
