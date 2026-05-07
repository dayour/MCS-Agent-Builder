/**
 * workflowHelperStrategy.ts
 *
 * Workflow strategy implementation for HelperAgent.
 * Workflow agents participate in HelperAgent for their build-page chat
 * (welcome messages, canvas-to-chat events, loading copy).
 * This is a minimal strategy — most workflow logic remains inline in
 * HelperAgent.tsx because it depends on internal state (workflowNodes, etc.).
 * ZERO React imports — pure TypeScript logic only.
 */

import type { HelperAgentStrategy, HelperMessageToken, AgentDisplayConfig } from '../../../components/HelperAgent';
import { AgentConfig } from '../../../types';

export const workflowHelperStrategy: HelperAgentStrategy = {
  /**
   * Workflow agents do not have a fixed welcome message from the strategy.
   * Their welcome is generated dynamically in HelperAgent.tsx based on
   * whether the workflow is new or returning (workflowNodes state).
   */
  getWelcomeMessage(_agentConfig: AgentConfig): string | null {
    return null;
  },

  /**
   * Workflows do not stream a fixed instructions template.
   */
  getStreamingInstructions(_agentConfig: AgentConfig): string | null {
    return null;
  },

  /**
   * Workflows do not add system-prompt additions via the strategy.
   * The day0Prefix for new workflows is built inline in HelperAgent.tsx.
   */
  getSystemPromptAdditions(_agentConfig: AgentConfig): string | null {
    return null;
  },

  /**
   * Workflow agents do not intercept messages at the strategy level.
   */
  shouldInterceptMessage(_text: string, _agentConfig: AgentConfig): boolean {
    return false;
  },

  /**
   * Workflow agents use the default message token.
   */
  getMessageToken(_agentConfig: AgentConfig): HelperMessageToken {
    return 'default';
  },

  /**
   * Workflow agents do not show a custom agentName or agentIcon in messages.
   */
  getAgentDisplayConfig(_agentConfig: AgentConfig): AgentDisplayConfig {
    return {
      agentName: undefined,
      systemColorIcon: undefined,
    };
  },
};
