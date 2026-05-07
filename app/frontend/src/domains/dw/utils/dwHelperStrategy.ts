/**
 * dwHelperStrategy.ts
 *
 * DW (Digital Worker / AI Teammate) strategy implementation for HelperAgent.
 * ZERO React imports — pure TypeScript logic returning typed tokens and plain strings.
 * HelperAgent.tsx keeps all rendering; this file only returns data.
 */

import type { HelperAgentStrategy, HelperMessageToken, AgentDisplayConfig } from '../../../components/HelperAgent';
import { AgentConfig } from '../../../types';

// Default DW instructions streamed into the editor on Day-0 (justCreated === true)
const DW_TEAMMATE_INSTRUCTIONS = `## Role & Identity
• You are a digital team member with your own M365 identity — your own inbox, OneDrive, and presence. You're not a chatbot or help desk.
• People can @mention you in Teams, email you directly, add you to groups, and share documents with you — just like any coworker.
• Speak naturally, like a helpful colleague. Use first person ("I can look that up", "Let me help with that").
• Remember context from the conversation. If someone mentioned a project earlier, reference it naturally.

## How You Help
• Respond to emails in your inbox and @mentions in Teams channels and chats.
• Answer questions about company policies, processes, and documentation.
• Help draft messages, emails, and documents — and collaborate on shared files.
• Summarize long threads, meetings, or documents when asked.
• Proactively suggest next steps when a teammate seems stuck.
• Connect people — if you can't help, suggest who on the team can.

## Communication Style
• Be concise but warm. No walls of text — short paragraphs, bullet points when helpful.
• Match the team's energy. Casual question → casual answer. Detailed ask → thorough response.
• When you're unsure, say so honestly: "I'm not sure about that — you might want to check with [team/person]."
• Never make up facts. If you don't have the information, say so and suggest where to find it.

## Boundaries
• You CANNOT access or modify HR records, payroll, or personal employee data.
• You CANNOT approve requests, sign off on decisions, or act with authority.
• You CAN read and respond to emails, Teams messages, and shared documents.
• You CAN help draft content, but always let the human review before sending.`;

const DW_TEAMMATE_WELCOME = `Hey — I'm ready to get started. Here are a couple of things that would help me hit the ground running:\n\n- **Connect me to knowledge sources** so I can answer questions accurately (SharePoint sites, internal docs, etc.)\n- **Tell me what I should focus on** and I'll sharpen my instructions — e.g. "Help the sales team prep for client calls"\n\nWhat would you like to work on first?`;

export const dwHelperStrategy: HelperAgentStrategy = {
  /**
   * Returns the Day-0 welcome message for a newly-created DW agent.
   * Used as the content for the `teammate-welcome-*` and `dw-welcome-*` messages.
   */
  getWelcomeMessage(_agentConfig: AgentConfig): string {
    return DW_TEAMMATE_WELCOME;
  },

  /**
   * Returns the instructions string to stream into the editor on Day-0
   * (when the DW agent has justCreated === true).
   */
  getStreamingInstructions(_agentConfig: AgentConfig): string {
    return DW_TEAMMATE_INSTRUCTIONS;
  },

  /**
   * Returns the system-prompt additions (day0Prefix) for DW agents.
   * DW agents don't get a day0Prefix — they use the separate streaming-instructions flow.
   * The non-DW day0Prefix is handled by agentHelperStrategy.
   */
  getSystemPromptAdditions(_agentConfig: AgentConfig): string | null {
    return null;
  },

  /**
   * DW agents should not intercept messages at the strategy level.
   * Message interception logic (isDexterLive) remains inline in HelperAgent.tsx
   * because it depends on runtime state (isDexter, dexterWorkerId) from useDW().
   */
  shouldInterceptMessage(_text: string, _agentConfig: AgentConfig): boolean {
    return false;
  },

  /**
   * Returns the HelperMessageToken for DW agents.
   * Dexter live-chat routing is handled inline in HelperAgent.tsx (depends on isDexterLive
   * runtime state) — this method returns 'default' as the base DW token.
   * Phase-transition card rendering is also inline since it depends on dwStreamPhaseRef.
   */
  getMessageToken(_agentConfig: AgentConfig): HelperMessageToken {
    return 'default';
  },

  /**
   * Returns display config for DW agent messages (agentName, agentIcon path).
   * HelperAgent.tsx uses these to populate CopilotMessage's agentName / agentIcon props.
   */
  getAgentDisplayConfig(agentConfig: AgentConfig): AgentDisplayConfig {
    return {
      agentName: agentConfig.name || 'AI Teammate',
      systemColorIcon: agentConfig.systemColorIcon || 'agents',
    };
  },
};
