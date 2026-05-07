import { createPublishTestAgent as createAgent } from './__tests__/helpers';
import { runPublishChecklist } from './publishChecklistRunner';

describe('runPublishChecklist', () => {
  const originalRandom = Math.random;
  const originalCrypto = global.crypto;

  beforeEach(() => {
    localStorage.setItem('publishFastMode', 'true');
    Math.random = jest.fn(() => 0);
    Object.defineProperty(global, 'crypto', {
      value: { randomUUID: () => 'test-message-id' },
      configurable: true,
    });
  });

  afterEach(() => {
    localStorage.removeItem('publishFastMode');
    Math.random = originalRandom;
    Object.defineProperty(global, 'crypto', {
      value: originalCrypto,
      configurable: true,
    });
  });

  test('continues automatically after warnings and still publishes', async () => {
    const addMessage = jest.fn();
    const updateMessage = jest.fn();
    const markPublished = jest.fn();

    const result = await runPublishChecklist(
      createAgent(),
      'agent-1',
      'partial-warnings',
      {
        addMessage,
        updateMessage,
        markPublished,
      },
    );

    expect(result.success).toBe(true);
    expect(markPublished).toHaveBeenCalledTimes(1);
    expect(result.steps.some(step => step.status === 'warning')).toBe(true);
    expect(result.steps.every(step => step.status !== 'skipped')).toBe(true);
  });

  test('stops only when a check fails', async () => {
    const addMessage = jest.fn();
    const updateMessage = jest.fn();
    const markPublished = jest.fn();

    const result = await runPublishChecklist(
      createAgent(),
      'agent-1',
      'blocking-failure',
      {
        addMessage,
        updateMessage,
        markPublished,
      },
    );

    expect(result.success).toBe(false);
    expect(markPublished).not.toHaveBeenCalled();
    expect(result.steps.some(step => step.status === 'failed')).toBe(true);
    expect(result.steps.some(step => step.status === 'skipped')).toBe(true);
  });

  test('pauses to ask about running an eval when validation needs coverage', async () => {
    const addMessage = jest.fn();
    const updateMessage = jest.fn();
    const markPublished = jest.fn();

    const result = await runPublishChecklist(
      createAgent(),
      'agent-1',
      'custom',
      {
        addMessage,
        updateMessage,
        markPublished,
      },
      {
        validationChangeAssessment: {
          requiresEvaluation: true,
          summary: 'Instructions changed since the last publish.',
          changedAreas: ['instructions'],
          verified: true,
        },
      },
    );

    expect(result.success).toBe(false);
    expect(result.paused).toBe(true);
    expect(result.pendingAction?.type).toBe('ask-run-eval');
    expect(markPublished).not.toHaveBeenCalled();
  });

  test('submits for approval instead of publishing immediately when policy requires it', async () => {
    const addMessage = jest.fn();
    const updateMessage = jest.fn();
    const markPublished = jest.fn();
    const markPendingApproval = jest.fn();

    const result = await runPublishChecklist(
      createAgent({
        triggerDistribution: {
          teams: { everyone: true, submitted: false, approved: false },
        },
      }),
      'agent-1',
      'custom',
      {
        addMessage,
        updateMessage,
        markPublished,
        markPendingApproval,
      },
      {
        validationChangeAssessment: {
          requiresEvaluation: false,
          summary: 'Only display copy changed.',
          changedAreas: [],
          verified: true,
        },
      },
    );

    expect(result.success).toBe(true);
    expect(markPublished).not.toHaveBeenCalled();
    expect(markPendingApproval).toHaveBeenCalledTimes(1);
  });
});
