import { AgentConfig } from '../types';

export interface DWAgentConfig extends AgentConfig {
  agentType: 'DW';
}

export interface WorkflowAgentConfig extends AgentConfig {
  type: 'workflow';
}

export const isDWAgent = (c: AgentConfig): c is DWAgentConfig => c.agentType === 'DW';
export const isWorkflowAgent = (c: AgentConfig): c is WorkflowAgentConfig => c.type === 'workflow';
