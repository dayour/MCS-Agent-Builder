import { callModel } from './modelClient';
import { ActivityErrorRun } from '../types';

export interface ErrorAnalysis {
  summary: string;
  rootCause: string;
  resolution: string;
  actionButtons: Array<{ label: string; actionType: 'navigate' | 'fix' | 'open' }>;
}

export async function analyzeActivityError(run: ActivityErrorRun, agentName: string): Promise<ErrorAnalysis> {
  const systemPrompt = `You are an AI assistant helping developers debug their AI agents in Copilot Studio.
When given information about a failed agent run, analyze the error and provide diagnostic information.

Respond ONLY with valid JSON matching this exact schema:
{
  "summary": "1-2 sentence summary of what went wrong",
  "rootCause": "Specific technical cause of the failure",
  "resolution": "Clear actionable fix the developer should take",
  "actionButtons": [
    { "label": "Short action label", "actionType": "fix" }
  ]
}

actionType must be one of: "fix", "navigate", "open"
Provide 2-3 action buttons maximum. Keep all text concise.`;

  const statusDescriptions: Record<string, string> = {
    failed: 'The run failed with an error',
    rejected: 'The run was rejected (approval or policy issue)',
    cancelled: 'The run was cancelled (missing inputs or user cancellation)',
    'auth-required': 'Authentication token expired or missing permissions',
  };

  const userMessage = `Analyze this failed agent run:
- Agent: ${agentName}
- Task description: "${run.description}"
- Status: ${run.status} — ${statusDescriptions[run.status] || run.status}
- Error message: ${run.error || 'None provided'}
- Channel: ${run.channel || 'Unknown'}
- Run type: ${run.type || 'Unknown'}

Provide your JSON diagnostic response.`;

  const response = await callModel({
    model: 'balanced',
    maxTokens: 600,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    temperature: 0.3,
  });

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed.summary !== 'string' || typeof parsed.rootCause !== 'string' || typeof parsed.resolution !== 'string' || !Array.isArray(parsed.actionButtons)) {
      throw new Error('Unexpected response shape from model');
    }
    return parsed as ErrorAnalysis;
  } catch {
    return {
      summary: `This run ${run.status === 'auth-required' ? 'failed because authentication is required' : `failed: ${run.error || 'an unexpected error occurred'}`}.`,
      rootCause: run.error || 'The agent encountered an error during execution.',
      resolution: 'Review the agent configuration and check connector permissions, then retry the run.',
      actionButtons: [
        { label: 'Review agent settings', actionType: 'navigate' },
        { label: 'Check connector permissions', actionType: 'fix' },
      ],
    };
  }
}
