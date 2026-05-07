/**
 * Publish prompt registry.
 *
 * All step prompts are registered here. To add or remove a step:
 *   1. Create/delete the step file in this folder
 *   2. Add/remove the import and array entry below
 *   3. Update `StepPromptId` in `types.ts` if you introduce new `id` values.
 */

import { agentReadinessPrompt } from './agentReadiness';
import { validationReadinessPrompt } from './validationReadiness';
import { deploymentReadinessPrompt } from './deploymentReadiness';
import { policyReadinessPrompt } from './policyReadiness';
import type { StepPrompt } from './types';

/** Ordered list of all step prompts. */
export const stepPrompts: StepPrompt[] = [
  agentReadinessPrompt,
  validationReadinessPrompt,
  deploymentReadinessPrompt,
  policyReadinessPrompt,
];

// Guard: detect duplicate step ids (dev/test only — avoids crashing the app in production)
if (process.env.NODE_ENV !== 'production') {
  const ids = stepPrompts.map(s => s.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error(`[publish-prompts] Duplicate step prompt ids detected: ${ids.join(', ')}`);
  }
}
