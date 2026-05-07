import { AgentConfig, Evaluation } from '../../../types';
import { createProvisionalProvenance, PROVISIONAL_SIGNALS } from '../provisionalSignals';
import { PublishCheck, PublishCheckContext, PublishCheckResult, ValidationChangeAssessment } from '../types';
import { getLatestDate, toDate } from '../utils/date';

function countFailedEvaluationQuestions(evaluations: Evaluation[]): number {
  return evaluations.reduce(
    (count, evaluation) => count + evaluation.questions.filter(question => question.result === 'fail').length,
    0,
  );
}

function getBehaviorChangeAreas(agent: AgentConfig): string[] {
  const changedAreas: string[] = [];

  if ((agent.instructions ?? '').trim()) changedAreas.push('instructions');
  if ((agent.capabilities ?? []).length > 0) changedAreas.push('components');
  if ((agent.workflowNodes ?? []).some(node => !node.placeholder)) changedAreas.push('workflow');
  if ((agent.skills ?? []).length > 0) changedAreas.push('skills');
  if (
    agent.knowledge.files.length > 0
    || agent.knowledge.customAPIs.length > 0
    || agent.knowledge.webSearch
    || agent.knowledge.specificSources
    || agent.knowledge.referenceOrgChart
  ) {
    changedAreas.push('knowledge');
  }

  return changedAreas;
}

function getDefaultValidationAssessment(agent: AgentConfig): ValidationChangeAssessment {
  // Fallback only: this is not true since-last-publish diffing.
  // Leave the real comparison for when publish baselines and change tracking exist.
  const changedAreas = getBehaviorChangeAreas(agent);

  if (changedAreas.length === 0) {
    return {
      requiresEvaluation: false,
      summary: 'No behavior changes were found that require an eval before publishing.',
      changedAreas,
      verified: false,
    };
  }

  if (!agent.lastPublishedAt) {
    return {
      requiresEvaluation: true,
      summary: 'This agent has not been published yet, so behavior-affecting changes should be covered by an eval before publishing.',
      changedAreas,
      verified: false,
    };
  }

  return {
    requiresEvaluation: true,
    summary: `Current ${changedAreas.join(', ')} changes can affect agent behavior and should be covered by an eval before publishing.`,
    changedAreas,
    verified: false,
  };
}

function getRelevantEvaluations(evaluations: Evaluation[], lastPublishedAt?: Date): Evaluation[] {
  if (!lastPublishedAt) return evaluations;

  return evaluations.filter(evaluation => {
    const runDate = toDate(evaluation.runDate);
    return runDate != null && runDate >= lastPublishedAt;
  });
}

/**
 * Checks recent test / evaluation results:
 * - Has the maker tested recently?
 * - Eval results meet thresholds
 * - No blocking failures
 */
export const testResultsCheck: PublishCheck = {
  id: 'test-results',
  label: 'Checking recent test results',

  run: async (agent: AgentConfig, context: PublishCheckContext = {}): Promise<PublishCheckResult> => {
    const evaluations = context.evaluations ?? [];
    const changeAssessment = context.validationChangeAssessment ?? getDefaultValidationAssessment(agent);
    const relevantEvaluations = getRelevantEvaluations(evaluations, agent.lastPublishedAt);
    const failedQuestionCount = countFailedEvaluationQuestions(relevantEvaluations);
    const hasRelevantEvaluation = relevantEvaluations.length > 0;
    const latestRelevantEvaluationAt = getLatestDate(relevantEvaluations.map(evaluation => evaluation.runDate));

    const changeDetail = {
      label: 'Changes require validation',
      status: 'passed' as const,
      message: changeAssessment.requiresEvaluation
        ? changeAssessment.summary
        : 'No behavior changes were found that require an eval before publishing',
    };

    const evaluationDetail = changeAssessment.requiresEvaluation
      ? hasRelevantEvaluation
        ? {
            label: 'Relevant evaluations',
            status: failedQuestionCount > 0 ? 'failed' as const : 'passed' as const,
            message: failedQuestionCount > 0
              ? `${failedQuestionCount} relevant evaluation check${failedQuestionCount !== 1 ? 's failed' : ' failed'}`
              : `${relevantEvaluations.length} relevant evaluation run${relevantEvaluations.length !== 1 ? 's' : ''} recorded`,
          }
        : {
            label: 'Relevant evaluations',
            status: 'warning' as const,
            message: 'No relevant eval has run after the latest behavior changes',
            provenance: createProvisionalProvenance(
              [PROVISIONAL_SIGNALS.VALIDATION_EVALUATION_EVIDENCE],
              'Replace this fallback when publish checks can match behavior changes to real eval coverage.',
            ),
          }
      : {
          label: 'Relevant evaluations',
          status: 'passed' as const,
          message: 'No publish-time eval is needed for the current changes',
        };

    const failureDetail = changeAssessment.requiresEvaluation && hasRelevantEvaluation && failedQuestionCount > 0
      ? {
          label: 'No blocking failures',
          status: 'failed' as const,
          message: 'Resolve failing evaluation results before publishing',
        }
      : {
          label: 'No blocking failures',
          status: 'passed' as const,
        };

    const freshnessDetail = changeAssessment.requiresEvaluation
      ? hasRelevantEvaluation && latestRelevantEvaluationAt != null
        ? {
            label: 'Evaluation freshness',
            status: 'passed' as const,
            message: 'A relevant eval was run after the latest publish point',
          }
        : {
            label: 'Evaluation freshness',
            status: 'warning' as const,
            message: 'No relevant eval has run after the latest publish point',
            provenance: createProvisionalProvenance(
              [PROVISIONAL_SIGNALS.VALIDATION_FRESHNESS],
              'Replace this fallback when publish checks can compare behavior changes to the precise last eval coverage point.',
            ),
          }
      : {
          label: 'Evaluation freshness',
          status: 'passed' as const,
          message: 'No eval freshness check is needed for the current changes',
        };

    const details: PublishCheckResult['details'] = [
      changeDetail,
      evaluationDetail,
      failureDetail,
      freshnessDetail,
    ];

    const hasFailed = details.some(detail => detail.status === 'failed');
    const hasWarning = details.some(detail => detail.status === 'warning');
    const shouldAskToRunEval = changeAssessment.requiresEvaluation && !hasRelevantEvaluation && context.validationDecision !== 'skip-eval';

    let summary: string;
    if (hasFailed) {
      summary = `Validation uncovered ${failedQuestionCount} failing evaluation check${failedQuestionCount !== 1 ? 's' : ''} that should be resolved before publishing.`;
    } else if (!changeAssessment.requiresEvaluation) {
      summary = 'No behavior changes were found that require an eval before publishing.';
    } else if (hasRelevantEvaluation) {
      summary = 'Validation looks good. Relevant eval results do not show blocking issues.';
    } else if (context.validationDecision === 'skip-eval') {
      summary = 'Validation is not blocking publish. No relevant eval has run after the latest behavior changes.';
    } else if (!hasWarning) {
      summary = 'Validation looks good. Relevant eval results do not show blocking issues.';
    } else {
      summary = 'I found behavior changes that should be validated, but I do not see a relevant eval covering them yet.';
    }

    return {
      status: hasFailed ? 'failed' : hasWarning ? 'warning' : 'passed',
      label: 'Checked recent test results',
      details,
      summary,
      provenance: createProvisionalProvenance(
        [
          PROVISIONAL_SIGNALS.VALIDATION_EVALUATION_EVIDENCE,
          PROVISIONAL_SIGNALS.VALIDATION_FRESHNESS,
        ],
        'Replace the validation-readiness fallbacks as change tracking and eval coverage hooks become available.',
      ),
      nextAction: shouldAskToRunEval
        ? {
            type: 'ask-run-eval',
            prompt: 'I can run a quick eval now — it usually takes 1 to 3 minutes depending on the agent.\n\nWould you like me to run it, or skip and continue publishing?',
            estimatedDuration: '1 to 3 minutes',
            options: [
              { id: 'run-eval-now', label: 'Run eval now' },
              { id: 'skip-eval', label: 'Skip and continue' },
            ],
          }
        : undefined,
    };
  },
};
