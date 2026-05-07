/**
 * Simulated error dataset for the Agent Error Simulation feature toggle.
 *
 * Represents the kind of multi-error state a real agent might accumulate —
 * based on the debugging scenario types in the Helper Agent partner onboarding spec:
 * action execution failures, unreachable knowledge connectors, test session failures,
 * and publish blockers.
 *
 * Used in two places:
 *  1. BuildPage  — visual error indicators on affected capabilities
 *  2. HelperAgent — injected into system prompt as `additional_context` so the
 *     Helper Agent can answer debugging questions grounded in these specifics.
 */

export interface SimulatedAgentError {
  id: string;
  errorCode: string;
  errorSource: 'action' | 'knowledge' | 'test_session' | 'publish' | 'instruction';
  errorMessage: string;
  /** Display name of the affected resource (capability, connector, knowledge source) */
  affectedResource: string;
  /** The user input that triggered the failure (for test_session errors) */
  testInput?: string;
  /**
   * For instruction-source errors: a deterministic text replacement that fixes the error.
   * Applied programmatically (via setStreamingInstructions) when the Helper Agent resolves it.
   * `inject` is appended to the agent's instructions when the simulation starts so the
   * broken text is actually present and the fix has something to stream in.
   */
  fix?: {
    type: 'instruction_replace';
    /** Text appended to instructions when the simulation is first enabled. */
    inject?: string;
    find: string;
    replace: string;
  };
}

export const SIMULATED_ERRORS: SimulatedAgentError[] = [
  {
    id: 'err-1',
    errorCode: 'ActionExecutionFailed',
    errorSource: 'action',
    errorMessage:
      "CreateHRTicket can't run — your instructions don't ask for the user's email before calling this action. Add a step to collect it first.",
    affectedResource: 'CreateHRTicket',
    testInput: 'Open an HR ticket for me.',
  },
  {
    id: 'err-2',
    errorCode: 'ConnectorUnreachable',
    errorSource: 'knowledge',
    errorMessage:
      "Can't reach HR SharePoint Playbook. The site may have moved, permissions may have changed, or the connection needs to be refreshed.",
    affectedResource: 'HR SharePoint Playbook',
  },
  {
    id: 'err-3',
    errorCode: 'EmptyResponse',
    errorSource: 'test_session',
    errorMessage:
      "Your agent gave a blank response when asked about the return policy — no knowledge sources were searched. Check that your FAQ document is indexed and covers return policy topics.",
    affectedResource: 'FAQ knowledge source',
    testInput: "What's our return policy?",
  },
  {
    id: 'err-4',
    errorCode: 'WrongToolSelected',
    errorSource: 'test_session',
    errorMessage:
      "Your agent used Send email when it should've used Create calendar event for scheduling. Update your instructions to explain the difference between booking a meeting and sending a plain email.",
    affectedResource: 'CreateCalendarEvent',
    testInput: 'Schedule a meeting with John tomorrow at 3pm.',
  },
  {
    id: 'err-5',
    errorCode: 'PublishBlocked',
    errorSource: 'publish',
    errorMessage:
      "Can't publish yet — your agent doesn't have a channel set up, and the Teams app is missing required redirect URIs. Fix the app registration in Azure to unblock this.",
    affectedResource: 'Teams channel publish',
  },
  {
    id: 'err-6',
    errorCode: 'ComponentMisconfigured',
    errorSource: 'instruction',
    errorMessage:
      "The Send an email step uses {{requester.email}}, which isn't available in the Message received trigger. Switch to {{conversation.user.email}} to fix this.",
    affectedResource: 'Send an email',
    testInput: 'Please send me a booking confirmation',
    fix: {
      type: 'instruction_replace',
      inject: '\n\n## Booking confirmations\nAfter confirming a booking, send a summary to the customer using [[Send an email]]. Address it to {{requester.email}}.',
      find: '{{requester.email}}',
      replace: '{{conversation.user.email}}',
    },
  },
];

/**
 * The `additional_context` shape injected into the Helper Agent system prompt —
 * mirrors the partner onboarding spec's `error_context` + `agent_activity` format.
 */
export function buildSimulatedErrorContext(activeErrors: SimulatedAgentError[] = SIMULATED_ERRORS): Record<string, unknown> {
  const counts = activeErrors.reduce<Record<string, number>>((acc, e) => {
    acc[e.errorSource] = (acc[e.errorSource] ?? 0) + 1;
    return acc;
  }, {});
  const summaryParts = [
    counts['action'] && `${counts['action']} action execution failure`,
    counts['knowledge'] && `${counts['knowledge']} unreachable knowledge connector`,
    counts['test_session'] && `${counts['test_session']} test session failure${counts['test_session'] > 1 ? 's' : ''}`,
    counts['publish'] && `${counts['publish']} publish blocker`,
    counts['instruction'] && `${counts['instruction']} instruction misconfiguration`,
  ].filter(Boolean).join(', ');

  return {
    error_context: {
      active_errors: activeErrors.map(e => ({
        error_id: e.id,
        error_code: e.errorCode,
        error_source: e.errorSource,
        affected_resource: e.affectedResource,
        error_message: e.errorMessage,
        ...(e.testInput ? { test_input: e.testInput } : {}),
      })),
      summary: activeErrors.length === 0
        ? 'No active errors.'
        : `${activeErrors.length} active error${activeErrors.length > 1 ? 's' : ''}: ${summaryParts}.`,
    },
    agent_activity: {
      resolution_rate: 0.31,
      escalation_rate: 0.42,
      top_failing_topics: ['Return policy', 'HR ticket creation', 'Meeting scheduling'],
      knowledge_source_health: {
        'HR SharePoint Playbook': 'unreachable',
        'FAQ website': 'degraded — 0 chunks matched in last 24 queries',
        'Web search': 'ok',
      },
    },
  };
}
