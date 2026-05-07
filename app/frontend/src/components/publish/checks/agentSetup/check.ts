/**
 * Agent Setup readiness check — orchestrator.
 *
 * Composes individual validators into a single PublishCheckResult.
 * Each validator is a pure function that inspects one aspect of the agent config.
 */

import { AgentConfig } from '../../../../types';
import { PublishCheck, PublishCheckResult, CheckDetail } from '../../types';
import {
  validateActivationMethod,
  validateAgentName,
  validateComponentConfiguration,
  validateInstructionCharacters,
  validateInstructionLength,
  validateInstructionPlaceholderText,
  validateInstructionPresence,
  validateInstructionReferences,
  validateInstructionSyntax,
} from './validators';

export const agentSetupCheck: PublishCheck = {
  id: 'agent-setup',
  label: 'Reviewing agent setup',

  run: async (agent: AgentConfig): Promise<PublishCheckResult> => {
    const details: CheckDetail[] = [
      validateAgentName(agent),
      validateActivationMethod(agent),
      validateComponentConfiguration(agent),
      validateInstructionPresence(agent),
      validateInstructionPlaceholderText(agent),
      validateInstructionCharacters(agent),
      validateInstructionSyntax(agent),
      validateInstructionReferences(agent),
      validateInstructionLength(agent),
    ];

    const hasFailed = details.some(d => d.status === 'failed');
    const hasWarning = details.some(d => d.status === 'warning');
    const status = hasFailed ? 'failed' : hasWarning ? 'warning' : 'passed';

    const failedItems = details.filter(d => d.status === 'failed');
    const warningItems = details.filter(d => d.status === 'warning');

    let summary: string;
    if (hasFailed) {
      const firstMessage = failedItems[0]?.message;
      summary = firstMessage
        ? `${firstMessage}. Update it and try again.`
        : 'Agent setup has a blocking issue. Update it and try again.';
    } else if (hasWarning) {
      const firstWarning = warningItems[0]?.message;
      summary = firstWarning
        ? `${firstWarning}. You can publish now or update it first.`
        : 'Agent setup is ready with a warning. You can publish now or update it first.';
    } else {
      summary = 'Agent setup is ready.';
    }

    return { status, label: 'Reviewed agent setup', details, summary };
  },
};
