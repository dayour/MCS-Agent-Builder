import { PublishScenario } from './types';

/**
 * Pre-built scenarios for testing publish flow behavior.
 *
 * Select the active scenario via the feature flag dropdown in NavigationRail.
 * Each scenario can override individual check results to simulate different states.
 */
export const publishScenarios: PublishScenario[] = [
  {
    id: 'happy-path',
    label: 'Happy Path',
    description: 'All checks pass — agent publishes successfully',
    overrides: [],
  },
  {
    id: 'partial-warnings',
    label: 'Partial Warnings',
    description: 'Some checks return warnings but publish proceeds',
    overrides: [
      {
        checkId: 'agent-setup',
        result: {
          status: 'warning',
          label: 'Reviewed agent setup',
          details: [
            { label: 'Agent name', status: 'passed' },
            { label: 'Activation method', status: 'passed', message: 'No trigger configured — if this agent is called by another agent, that is fine' },
            { label: 'Component configuration', status: 'passed' },
            { label: 'Instructions present', status: 'passed' },
            { label: 'Instruction content', status: 'warning', message: 'Instructions appear to contain placeholder or accidental text' },
            { label: 'Instruction characters', status: 'passed' },
            { label: 'Instruction syntax', status: 'passed' },
            { label: 'Instruction references', status: 'passed' },
            { label: 'Instruction length', status: 'passed' },
          ],
          summary: 'Instructions appear to contain placeholder or accidental text. You can publish now or update it first.',
        },
      },
      {
        checkId: 'test-results',
        result: {
          status: 'warning',
          label: 'Checked recent test results',
          details: [
            { label: 'Recent preview session', status: 'passed', message: '1 preview exchange recorded' },
            { label: 'Formal evaluations', status: 'warning', message: 'Evaluations have not been run yet' },
            { label: 'No blocking failures', status: 'passed' },
            { label: 'Validation freshness', status: 'warning', message: 'Last validation activity was 7 days ago' },
          ],
          summary: 'Validation is not blocking publish, but I recommend you run an evaluation and refresh the existing validation results first.',
        },
      },
    ],
  },
  {
    id: 'blocking-failure',
    label: 'Blocking Failure',
    description: 'Critical check fails — publish is blocked',
    overrides: [
      {
        checkId: 'agent-setup',
        result: {
          status: 'failed',
          label: 'Reviewed agent setup',
          details: [
            { label: 'Agent name', status: 'passed' },
            { label: 'Activation method', status: 'passed', message: 'Configured via 1 trigger' },
            { label: 'Component configuration', status: 'passed' },
            { label: 'Instructions present', status: 'passed' },
            { label: 'Instruction content', status: 'passed' },
            { label: 'Instruction characters', status: 'passed' },
            { label: 'Instruction syntax', status: 'passed' },
            { label: 'Instruction references', status: 'failed', message: 'Instructions reference components that are not configured: Outlook - Send an email' },
            { label: 'Instruction length', status: 'passed' },
          ],
          summary: 'Instructions reference components that are not configured: Outlook - Send an email. Update it and try again.',
        },
      },
    ],
  },
  {
    id: 'custom',
    label: 'Custom (Live)',
    description: 'Runs real checks against current agent state',
    overrides: [],
  },
];

/**
 * Get a scenario by ID. Falls back to happy-path.
 */
export function getScenario(id: string): PublishScenario {
  return publishScenarios.find(s => s.id === id) || publishScenarios[0];
}
