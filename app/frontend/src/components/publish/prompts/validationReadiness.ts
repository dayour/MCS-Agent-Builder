/**
 * Step prompt: Validation Readiness
 *
 * Defines what the HA checks and how it communicates results
 * for test/evaluation readiness.
 */

import type { StepPrompt } from './types';

export const validationReadinessPrompt: StepPrompt = {
  id: 'test-results',
  label: 'Validation Readiness',
  order: 2,
  prompt: `## Step 2 — Validation Readiness

Ensure the agent has been tested recently.

### 2A. Determine whether testing is needed
Before checking test results, assess whether the changes since last publish actually require testing.

**Changes that likely need testing:**
- Knowledge sources added, removed, or modified
- Tools or actions added, removed, or reconfigured
- Triggers added or changed
- Sub-agents added or modified
- Instructions significantly rewritten or restructured

**Changes that likely do NOT need testing:**
- Minor content or wording tweaks
- Description or display name changes
- Cosmetic edits (icon, greeting message)

Think through this first. If the changes are low-risk content edits, note that testing may not be necessary but still report the current test status.

### 2B. Verify test and evaluation status
- **Recent preview results** — has the agent been previewed recently?
- **Evaluations** — have evaluations run successfully?
- **No blocking failures** — did the most recent test/eval session complete without failures or errors?
- **Freshness** — no major changes have been made to the agent after the last validation run.

### Blocking issues
- A previous test or evaluation run produced failures or errors that have not been addressed.

### Warn only (do not block)
- No test sessions have been run at all.
- Testing exists but appears outdated (significant changes were made after the last test).
- Evaluations have never been run.

### Informational
- If testing appears outdated or missing, suggest running a preview or evaluation before publishing. Frame it as a recommendation, not a requirement.

### How to communicate
- Start by briefly stating whether the recent changes appear to need testing.
- Then report test/eval status.
- If tests exist and are current: report "Validation looks good."
- If tests are missing or outdated: recommend running a preview or evaluation, but do not block.
- If failures/errors exist: block and list the specific failures.`,
};
