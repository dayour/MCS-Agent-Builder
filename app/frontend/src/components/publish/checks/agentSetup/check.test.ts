import { agentSetupCheck } from './check';
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
import { createPublishTestAgent as createAgent } from '../../__tests__/helpers';

describe('agent setup validators', () => {
  test('fails missing or default names', () => {
    expect(validateAgentName(createAgent({ name: '' }))).toMatchObject({
      label: 'Agent name',
      status: 'failed',
    });

    expect(validateAgentName(createAgent({ name: 'Support <Copilot>' }))).toEqual({
      label: 'Agent name',
      status: 'failed',
      message: 'Agent name cannot include < or >',
    });

    expect(validateAgentName(createAgent({ name: 'New Agent' }))).toEqual({
      label: 'Agent name',
      status: 'failed',
      message: 'Agent still has the default name — give it a unique name before publishing',
    });
  });

  test('fails when instructions are empty', () => {
    expect(validateInstructionPresence(createAgent({ instructions: '' }))).toEqual({
      label: 'Instructions present',
      status: 'failed',
      message: 'Instructions are empty — add operating instructions before publishing',
    });
  });

  test('warns on placeholder instructions only', () => {
    expect(validateInstructionPlaceholderText(createAgent({ instructions: 'Enter your instructions here' }))).toEqual({
      label: 'Instruction content',
      status: 'warning',
      message: 'Instructions appear to contain placeholder or accidental text',
    });
  });

  test('detects unsupported characters and malformed syntax in instructions', () => {
    expect(validateInstructionCharacters(createAgent({ instructions: 'Use <html> tags' }))).toEqual({
      label: 'Instruction characters',
      status: 'failed',
      message: 'Instructions contain unsupported HTML-like tags',
    });

    expect(validateInstructionCharacters(createAgent({ instructions: 'Escalate when values > 100 or < 0.' }))).toEqual({
      label: 'Instruction characters',
      status: 'passed',
    });

    expect(validateInstructionSyntax(createAgent({ instructions: '{{icon:teams} [[Teams - When a message is received]]' }))).toEqual({
      label: 'Instruction syntax',
      status: 'failed',
      message: 'Instructions contain unclosed curly braces',
    });
  });

  test('detects missing instruction references', () => {
    expect(validateInstructionReferences(createAgent({ instructions: 'Use [[Tool: Outlook - Send an email]] to reply.' }))).toEqual({
      label: 'Instruction references',
      status: 'failed',
      message: 'Instructions reference components that are not configured: Outlook - Send an email',
    });

    expect(
      validateInstructionReferences(
        createAgent({
          instructions: 'Use [[Tool: Outlook - Send an email]] to reply.',
          capabilities: [{ name: 'Outlook - Send an email', type: 'action' }],
        }),
      ),
    ).toEqual({
      label: 'Instruction references',
      status: 'passed',
    });
  });

  test('skips trigger reference validation when a placeholder trigger is pending', () => {
    // The trigger label in instructions cannot match until the channel is confirmed —
    // validateComponentConfiguration already flags the placeholder, so this check should pass.
    expect(
      validateInstructionReferences(
        createAgent({
          instructions: '{{icon:teams}} [[Teams - When a message is received]]',
          workflowNodes: [{ id: 'trigger-placeholder', type: 'trigger', label: 'Add a trigger', placeholder: true }],
        }),
      ),
    ).toEqual({
      label: 'Instruction references',
      status: 'passed',
    });

    // Tool references (not trigger) should still be validated even with a placeholder trigger.
    expect(
      validateInstructionReferences(
        createAgent({
          instructions: '{{icon:teams}} [[Teams - When a message is received]]\n\nUse [[Tool: Outlook - Send an email]].',
          workflowNodes: [{ id: 'trigger-placeholder', type: 'trigger', label: 'Add a trigger', placeholder: true }],
        }),
      ),
    ).toEqual({
      label: 'Instruction references',
      status: 'failed',
      // Trigger ref is excused; only the missing tool ref is reported.
      message: 'Instructions reference components that are not configured: Outlook - Send an email',
    });

    // Non-trigger capability references (knowledge, actions) should still be caught
    // even when a placeholder trigger is pending — the placeholder only excuses unresolvable
    // trigger names, not genuinely missing capabilities.
    expect(
      validateInstructionReferences(
        createAgent({
          instructions: '{{icon:teams}} [[Teams - When a message is received]]\n\nSummarise [[Company Wiki]].',
          capabilities: [],
          workflowNodes: [{ id: 'trigger-placeholder', type: 'trigger', label: 'Add a trigger', placeholder: true }],
        }),
      ),
    ).toEqual({
      label: 'Instruction references',
      status: 'failed',
      message: 'Instructions reference components that are not configured: Company Wiki',
    });
  });

  test('evaluates activation paths neutrally when no trigger exists', () => {
    expect(validateActivationMethod(createAgent())).toEqual({
      label: 'Activation method',
      status: 'passed',
      message: 'No trigger configured — if this agent is called by another agent, that is fine',
    });

    expect(
      validateActivationMethod(
        createAgent({
          channel: 'teams',
          capabilities: [{ name: 'Teams - When a message is received', type: 'trigger' }],
        }),
      ),
    ).toEqual({
      label: 'Activation method',
      status: 'passed',
      message: 'Configured via teams app endpoint, 1 trigger',
    });
  });

  test('fails on structural component configuration issues', () => {
    expect(
      validateComponentConfiguration(
        createAgent({
          knowledge: {
            files: [],
            webSearch: false,
            specificSources: false,
            referenceOrgChart: false,
            customAPIs: [
              { id: 'api-1', name: '', endpoint: '', enabled: true },
            ],
          },
          workflowNodes: [{ id: 'trigger-1', type: 'trigger', label: 'Add a trigger', placeholder: true }],
        }),
      ),
    ).toEqual({
      label: 'Component configuration',
      status: 'failed',
      message: '1 enabled API connection is missing a name or endpoint; Workflow trigger is still a placeholder',
    });
  });

  test('fails when instructions exceed the local safety limit', () => {
    expect(validateInstructionLength(createAgent({ instructions: 'a'.repeat(8001) }))).toEqual({
      label: 'Instruction length',
      status: 'failed',
      message: 'Instructions exceed the publish safety limit of 8000 characters',
    });
  });
});


describe('agentSetupCheck', () => {
  test('summarizes blocking structural issues', async () => {
    const result = await agentSetupCheck.run(
      createAgent({
        instructions: 'Use [[Tool: Outlook - Send an email]] to reply.',
      }),
    );

    expect(result.status).toBe('failed');
    expect(result.summary).toBe('Instructions reference components that are not configured: Outlook - Send an email. Update it and try again.');
  });

  test('summarizes warning count when readiness is preserved', async () => {
    const result = await agentSetupCheck.run(
      createAgent({
        instructions: 'TODO',
      }),
    );

    expect(result.status).toBe('warning');
    expect(result.summary).toBe('Instructions appear to contain placeholder or accidental text. You can publish now or update it first.');
  });

  test('returns ready summary when all structural checks pass', async () => {
    const result = await agentSetupCheck.run(
      createAgent({
        channel: 'teams',
        capabilities: [
          { name: 'Teams - When a message is received', type: 'trigger' },
          { name: 'Outlook - Send an email', type: 'action' },
        ],
        instructions:
          'Where this agent works: {{icon:teams}} [[Teams - When a message is received]]\n\nUse [[Tool: Outlook - Send an email]] when a follow-up is needed.',
      }),
    );

    expect(result.status).toBe('passed');
    expect(result.summary).toBe('Agent setup is ready.');
  });
});
