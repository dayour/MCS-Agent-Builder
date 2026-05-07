/**
 * Publish prompt composer.
 *
 * Assembles the full system prompt from the base prompt + step prompts.
 * Call `composePublishPrompt()` to get the complete prompt string,
 * or `composePromptForStep(stepId)` to get the base + one specific step.
 */

import { BASE_PUBLISH_PROMPT } from './basePrompt';
import { stepPrompts } from './registry';
import type { StepPromptId } from './types';

const SEPARATOR = '\n\n---\n\n';

/**
 * Returns the full system prompt: base + all step prompts sorted by order.
 */
export function composePublishPrompt(): string {
  const orderedSteps = [...stepPrompts].sort((a, b) => a.order - b.order);
  const stepTexts = orderedSteps.map(s => s.prompt);
  return [BASE_PUBLISH_PROMPT, ...stepTexts].join(SEPARATOR);
}

/**
 * Returns the base prompt + a single step's prompt.
 * Useful when running one check at a time.
 */
export function composePromptForStep(stepId: StepPromptId): string {
  const step = stepPrompts.find(s => s.id === stepId);
  if (!step) {
    throw new Error(`[publish-prompts] composePromptForStep received unknown step id: "${stepId}"`);
  }
  return [BASE_PUBLISH_PROMPT, step.prompt].join(SEPARATOR);
}
