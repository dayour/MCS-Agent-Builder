import { AgentConfig, Evaluation } from '../../../types';

export function createPublishTestAgent(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    id: 'agent-1',
    type: 'agent',
    name: 'Support Copilot',
    description: 'Helps internal teams handle common support requests.',
    purpose: 'Support',
    guidelines: [],
    skills: [],
    model: 'gpt-5.2-auto',
    knowledge: {
      files: [],
      webSearch: false,
      specificSources: false,
      referenceOrgChart: false,
      customAPIs: [],
    },
    instructions:
      'Help employees resolve support issues, escalate when needed, and keep responses concise and accurate.',
    capabilities: [],
    workflowNodes: [],
    published: false,
    createdAt: new Date('2026-03-26T00:00:00.000Z'),
    ...overrides,
  };
}

export function createPublishTestEvaluation(overrides: Partial<Evaluation> = {}): Evaluation {
  return {
    id: 'eval-1',
    name: 'Preview regression',
    questions: [{ id: 'q1', question: 'Respond correctly?', result: 'pass' }],
    score: 100,
    runDate: new Date('2026-03-26T00:00:00.000Z'),
    duration: '30s',
    ...overrides,
  };
}