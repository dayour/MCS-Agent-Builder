import { PROVISIONAL_SIGNALS } from '../provisionalSignals';
import { createPublishTestAgent as createAgent } from '../__tests__/helpers';
import { policyCheck } from './policyCheck';

describe('policyCheck', () => {
  test('fails on insecure custom api endpoints', async () => {
    const result = await policyCheck.run(
      createAgent({
        knowledge: {
          files: [],
          webSearch: false,
          specificSources: false,
          referenceOrgChart: false,
          customAPIs: [
            { id: 'api-1', name: 'CRM', endpoint: 'http://internal.test/crm', enabled: true },
          ],
        },
      }),
    );

    expect(result.status).toBe('failed');
    expect(result.summary).toBe('Policy review found 1 blocking issue that must be fixed before publishing.');
  });

  test('reports pending approval when trigger distribution is submitted but not approved', async () => {
    const result = await policyCheck.run(
      createAgent({
        triggerDistribution: {
          teams: { teammates: true, submitted: true, approved: false },
        },
      }),
    );

    expect(result.status).toBe('passed');
    expect(result.summary).toBe('Policy requirements met. This agent requires admin approval — it will enter a pending state after publishing.');
    expect(result.provenance?.provisionalSignals).toEqual([
      PROVISIONAL_SIGNALS.POLICY_CONNECTOR_REVIEW,
      PROVISIONAL_SIGNALS.POLICY_APPROVAL_STATE,
    ]);
  });

  test('reports approval required when org-wide distribution is selected but not yet submitted', async () => {
    const result = await policyCheck.run(
      createAgent({
        triggerDistribution: {
          teams: { everyone: true, submitted: false, approved: false },
        },
      }),
    );

    expect(result.status).toBe('passed');
    expect(result.summary).toBe('Policy requirements met. This agent requires admin approval — it will enter a pending state after publishing.');
    expect(result.completionState).toBe('submit-for-approval');
    expect(result.details.find(detail => detail.label === 'Admin approval')?.message).toContain('requires admin approval before going live');
  });

  test('does not leak provisional metadata into user-facing summary text', async () => {
    const result = await policyCheck.run(createAgent());

    expect(result.summary?.toLowerCase()).not.toContain('provisional');
    expect(result.summary?.toLowerCase()).not.toContain('simulated');
    expect(result.summary?.toLowerCase()).not.toContain('stub');
  });
});
