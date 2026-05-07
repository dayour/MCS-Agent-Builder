/**
 * Types for the publish prompt system.
 */

/**
 * Valid step prompt identifiers.
 * These align with the publish check ids defined in the checks registry.
 * Update when adding/removing steps.
 */
export type StepPromptId =
  | 'agent-setup'
  | 'test-results'
  | 'deployment-apps'
  | 'policy';

/** A single step's prompt definition. */
export interface StepPrompt {
  /** Unique identifier — matches the check id where applicable */
  id: StepPromptId;
  /** Human-readable label */
  label: string;
  /** Display/execution order (lower = first) */
  order: number;
  /** The prompt text for this step */
  prompt: string;
}
