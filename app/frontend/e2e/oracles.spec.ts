import { test } from '@playwright/test';
import { ORACLES } from './oracles';
import { attachTestRunId } from './helpers';

// ---------------------------------------------------------------------------
// Scenario oracle runner — each oracle defines setup/actions/assertions/invariants
// for a feature. Unlike smoke tests which check "page loads", oracles verify
// business outcomes and invariants.
// ---------------------------------------------------------------------------

const TEST_RUN_ID = process.env.TEST_RUN_ID;
const ORACLE_FILTER = process.env.ORACLE || ''; // comma-separated feature keys, empty = all

test.describe('Scenario oracles', () => {
  const keys = ORACLE_FILTER
    ? ORACLE_FILTER.split(',').map((k) => k.trim()).filter(Boolean)
    : Object.keys(ORACLES);

  for (const key of keys) {
    const oracle = ORACLES[key];
    if (!oracle) {
      test(`(missing oracle: ${key})`, async () => {
        throw new Error(`Oracle not found for feature "${key}". Available: ${Object.keys(ORACLES).join(', ')}`);
      });
      continue;
    }

    test(`oracle: ${oracle.feature} — ${oracle.description}`, async ({ page, context }) => {
      if (TEST_RUN_ID) await attachTestRunId(context, TEST_RUN_ID);
      const ctx = { page, testRunId: TEST_RUN_ID };

      await oracle.setup(ctx);
      await oracle.actions(ctx);
      await oracle.assertions(ctx);
      await oracle.invariants(ctx);
      if (oracle.cleanup) await oracle.cleanup(ctx);
    });
  }
});
