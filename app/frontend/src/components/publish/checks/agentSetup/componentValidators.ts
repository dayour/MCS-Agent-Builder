import { AgentConfig } from '../../../../types';
import { CheckDetail } from '../../types';
import { DEFAULT_NAMES } from './constants';

function formatCount(count: number, noun: string): string {
  return `${count} ${noun}${count !== 1 ? 's' : ''}`;
}

export function validateAgentName(agent: AgentConfig): CheckDetail {
  const name = (agent.name ?? '').trim();

  if (!name) {
    return { label: 'Agent name', status: 'failed', message: 'Agent name is required' };
  }

  if (name.includes('<') || name.includes('>')) {
    return {
      label: 'Agent name',
      status: 'failed',
      message: 'Agent name cannot include < or >',
    };
  }

  if (DEFAULT_NAMES.includes(name.toLowerCase())) {
    return {
      label: 'Agent name',
      status: 'failed',
      message: 'Agent still has the default name — give it a unique name before publishing',
    };
  }

  return { label: 'Agent name', status: 'passed' };
}

export function validateActivationMethod(agent: AgentConfig): CheckDetail {
  const configuredTriggers = [
    ...(agent.capabilities ?? []).filter(capability => capability.type === 'trigger').map(capability => capability.name),
    ...(agent.workflowNodes ?? []).filter(node => node.type === 'trigger' && !node.placeholder).map(node => node.label),
  ];

  const activationPaths: string[] = [];
  if (agent.channel) activationPaths.push(`${agent.channel} app endpoint`);
  if (configuredTriggers.length > 0) activationPaths.push(formatCount(configuredTriggers.length, 'trigger'));

  if (activationPaths.length === 0) {
    return {
      label: 'Activation method',
      status: 'passed',
      message: 'No trigger configured — if this agent is called by another agent, that is fine',
    };
  }

  return {
    label: 'Activation method',
    status: 'passed',
    message: `Configured via ${activationPaths.join(', ')}`,
  };
}

export function validateComponentConfiguration(agent: AgentConfig): CheckDetail {
  const issues: string[] = [];

  if (agent.type === 'placeholder') {
    issues.push('Agent is still in placeholder state');
  }

  const invalidCapabilities = (agent.capabilities ?? []).filter(capability => !capability.name?.trim() || !capability.type);
  if (invalidCapabilities.length > 0) {
    issues.push(`${formatCount(invalidCapabilities.length, 'capability')} ${invalidCapabilities.length === 1 ? 'is' : 'are'} missing required fields`);
  }

  const invalidApis = agent.knowledge.customAPIs.filter(api => api.enabled && (!api.name?.trim() || !api.endpoint?.trim()));
  if (invalidApis.length > 0) {
    issues.push(`${formatCount(invalidApis.length, 'enabled API connection')} ${invalidApis.length === 1 ? 'is' : 'are'} missing a name or endpoint`);
  }

  const invalidNodes = (agent.workflowNodes ?? []).filter(node => !node.id?.trim() || !node.label?.trim() || !node.type);
  if (invalidNodes.length > 0) {
    issues.push(`${formatCount(invalidNodes.length, 'workflow node')} ${invalidNodes.length === 1 ? 'is' : 'are'} missing a required field`);
  }

  const placeholderTriggers = (agent.workflowNodes ?? []).filter(node => node.type === 'trigger' && node.placeholder);
  if (placeholderTriggers.length > 0) {
    issues.push('Workflow trigger is still a placeholder');
  }

  if (issues.length > 0) {
    return {
      label: 'Component configuration',
      status: 'failed',
      message: issues.join('; '),
    };
  }

  return { label: 'Component configuration', status: 'passed' };
}