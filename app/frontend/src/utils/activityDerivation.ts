import type { ComponentType } from 'react';
import { LastStepType } from '../types';
import {
  CommentMultiple20Regular, Code20Regular, CursorHover20Regular, Flowchart20Regular,
  Prompt20Regular, TaskListLtr20Regular, Flash20Regular, Library20Regular,
  PlugConnected20Regular, BrainCircuit20Regular, Server20Regular,
  AppsList20Regular, WrenchScrewdriver20Regular, PeopleTeam20Regular,
} from '@fluentui/react-icons';

export const DA_NODE_TO_LAST_STEP: Record<string, LastStepType> = {
  topic: 'topic', knowledge: 'knowledgeSource', agent: 'multiAgent',
  skill: 'skill', flow: 'flow', connector: 'connector', prompt: 'prompt', tool: 'tool',
};

// Store component constructors (not live elements) so they are safe to share across renders.
export const LAST_STEP_ICONS: Record<LastStepType, ComponentType> = {
  topic:           CommentMultiple20Regular,
  codeResponse:    Code20Regular,
  cua:             CursorHover20Regular,
  flow:            Flowchart20Regular,
  prompt:          Prompt20Regular,
  task:            TaskListLtr20Regular,
  trigger:         Flash20Regular,
  knowledgeSource: Library20Regular,
  connector:       PlugConnected20Regular,
  deepReasoning:   BrainCircuit20Regular,
  mcp:             Server20Regular,
  skill:           AppsList20Regular,
  tool:            WrenchScrewdriver20Regular,
  multiAgent:      PeopleTeam20Regular,
};

interface SessionWithMessages {
  lastStep?: { type: LastStepType; name: string };
  stepsOrTurns?: number;
  messages?: Array<{ role?: string; metadata?: Record<string, any> }>;
}

export function deriveLastStep(session: SessionWithMessages): { type: LastStepType; name: string } | undefined {
  if (session.lastStep) return session.lastStep;
  const msgs = session.messages || [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const nodes = msgs[i]?.metadata?.cotNodes as Array<{ type: string; name: string }> | undefined;
    if (nodes?.length) {
      const last = nodes[nodes.length - 1];
      return { type: DA_NODE_TO_LAST_STEP[last.type] ?? 'tool', name: last.name };
    }
  }
  return undefined;
}

export function deriveStepsOrTurns(session: SessionWithMessages): number | undefined {
  if (session.stepsOrTurns != null) return session.stepsOrTurns;
  const msgs = session.messages || [];
  const userCount = msgs.filter(m => m?.role === 'user').length;
  return userCount || undefined;
}
