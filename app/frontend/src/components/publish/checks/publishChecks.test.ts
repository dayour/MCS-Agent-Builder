import { PROVISIONAL_SIGNALS } from '../provisionalSignals';
import {
  createPublishTestAgent as createAgent,
  createPublishTestEvaluation as createEvaluation,
} from '../__tests__/helpers';
import { testResultsCheck } from './testResultsCheck';

describe('testResultsCheck', () => {
  test('asks to run an eval when behavior changes need validation and none has run', async () => {
    const result = await testResultsCheck.run(createAgent(), {
      validationChangeAssessment: {
        requiresEvaluation: true,
        summary: 'Instructions and tools changed since the last publish.',
        changedAreas: ['instructions', 'components'],
        verified: true,
      },
    });

    expect(result.status).toBe('warning');
    expect(result.summary).toBe('I found behavior changes that should be validated, but I do not see a relevant eval covering them yet.');
    expect(result.nextAction?.type).toBe('ask-run-eval');
    expect(result.nextAction?.options.map(option => option.label)).toEqual(['Run eval now', 'Skip and continue']);
    expect(result.provenance).toEqual({
      evidenceSource: 'provisional',
      provisionalSignals: [
        PROVISIONAL_SIGNALS.VALIDATION_EVALUATION_EVIDENCE,
        PROVISIONAL_SIGNALS.VALIDATION_FRESHNESS,
      ],
      cleanupNote: 'Replace the validation-readiness fallbacks as change tracking and eval coverage hooks become available.',
    });
  });

  test('passes when behavior changes have a passing relevant eval', async () => {
    const result = await testResultsCheck.run(createAgent(), {
      evaluations: [createEvaluation()],
      validationChangeAssessment: {
        requiresEvaluation: true,
        summary: 'Instructions changed since the last publish.',
        changedAreas: ['instructions'],
        verified: true,
      },
    });

    expect(result.status).toBe('passed');
    expect(result.summary).toBe('Validation looks good. Relevant eval results do not show blocking issues.');
  });

  test('fails when relevant evaluation questions have failing results', async () => {
    const result = await testResultsCheck.run(createAgent(), {
      evaluations: [createEvaluation({ questions: [{ id: 'q1', question: 'Respond correctly?', result: 'fail' }] })],
      validationChangeAssessment: {
        requiresEvaluation: true,
        summary: 'Knowledge changed since the last publish.',
        changedAreas: ['knowledge'],
        verified: true,
      },
    });

    expect(result.status).toBe('failed');
    expect(result.summary).toBe('Validation uncovered 1 failing evaluation check that should be resolved before publishing.');
  });

  test('passes immediately when changes do not require eval coverage', async () => {
    const result = await testResultsCheck.run(createAgent(), {
      validationChangeAssessment: {
        requiresEvaluation: false,
        summary: 'Only spelling and display-copy changes were made.',
        changedAreas: [],
        verified: true,
      },
    });

    expect(result.status).toBe('passed');
    expect(result.summary).toBe('No behavior changes were found that require an eval before publishing.');
    expect(result.nextAction).toBeUndefined();
  });

  test('continues without pausing after the maker chooses to skip eval', async () => {
    const result = await testResultsCheck.run(createAgent(), {
      validationChangeAssessment: {
        requiresEvaluation: true,
        summary: 'Instructions changed since the last publish.',
        changedAreas: ['instructions'],
        verified: true,
      },
      validationDecision: 'skip-eval',
    });

    expect(result.status).toBe('warning');
    expect(result.summary).toBe('Validation is not blocking publish. No relevant eval has run after the latest behavior changes.');
    expect(result.nextAction).toBeUndefined();
  });
});
