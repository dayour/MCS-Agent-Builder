import { PROVISIONAL_SIGNALS } from '../provisionalSignals';
import { createPublishTestAgent as createAgent } from '../__tests__/helpers';
import { deploymentAppsCheck } from './deploymentAppsCheck';

describe('deploymentAppsCheck', () => {
  test('skips when no endpoint app is selected', async () => {
    const result = await deploymentAppsCheck.run(createAgent({ channel: undefined }));

    expect(result.status).toBe('passed');
    expect(result.summary).toBe('No endpoint app selected — skipping deployment check.');
  });

  test('passes direct deployment targets with a known publish path', async () => {
    const result = await deploymentAppsCheck.run(createAgent({ channel: 'teams' }));

    expect(result.status).toBe('passed');
    expect(result.summary).toBe('Deployment path is ready for Microsoft Teams.');
    expect(result.provenance?.provisionalSignals).toEqual([
      PROVISIONAL_SIGNALS.DEPLOYMENT_AUTHENTICATION,
      PROVISIONAL_SIGNALS.DEPLOYMENT_CONNECTIVITY,
    ]);
  });

  test('includes post-publish guidance for Slack', async () => {
    const result = await deploymentAppsCheck.run(createAgent({ channel: 'slack' }));

    expect(result.status).toBe('passed');
    expect(result.summary).toContain('Deployment path is ready for Slack.');
    expect(result.summary).toContain('Connect the Slack app credentials');
    expect(result.provenance?.provisionalSignals).toEqual([
      PROVISIONAL_SIGNALS.DEPLOYMENT_AUTHENTICATION,
      PROVISIONAL_SIGNALS.DEPLOYMENT_CONNECTIVITY,
    ]);
  });

  test('passes known pre-publish apps without post-publish guidance', async () => {
    const result = await deploymentAppsCheck.run(createAgent({ channel: 'website' }));

    expect(result.status).toBe('passed');
    expect(result.summary).toBe('Deployment path is ready for Demo website.');
    expect(result.summary).not.toContain('Next step after publishing');
    expect(result.details.some(detail => detail.label === 'Pre-publish setup')).toBe(true);
  });

  test('fails when no deployment path is defined for the selected app', async () => {
    const result = await deploymentAppsCheck.run(createAgent({ channel: 'unknown-channel' }));

    expect(result.status).toBe('failed');
    expect(result.summary).toBe('Deployment to unknown-channel is blocked because no deployment path is defined yet.');
  });
});
