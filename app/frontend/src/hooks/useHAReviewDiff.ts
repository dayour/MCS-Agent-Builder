import { useMemo } from 'react';
import { useAgent } from '../context/AgentContext';
import { AgentConfig } from '../types';

// Primitive fields can be compared with === directly.
const PRIMITIVE_FIELDS: (keyof AgentConfig)[] = ['name', 'description', 'model', 'purpose', 'instructions', 'guidelines'];
// Object/array fields require deep comparison.
const OBJECT_FIELDS: (keyof AgentConfig)[] = ['capabilities', 'knowledge', 'workflowNodes', 'skills'];

/** All fields watched for review-state diffs. Re-exported so consumers (e.g. BuildPage fade watcher) stay in sync. */
export const DIFFABLE_FIELDS: (keyof AgentConfig)[] = [...PRIMITIVE_FIELDS, ...OBJECT_FIELDS];

export function useHAReviewDiff(): { changedFields: Set<keyof AgentConfig>; hasChanges: boolean } {
  const { helperAgentReviewSnapshot, agentConfig, isHAReviewUIEnabled } = useAgent();

  return useMemo(() => {
    if (!isHAReviewUIEnabled || !helperAgentReviewSnapshot) {
      return { changedFields: new Set<keyof AgentConfig>(), hasChanges: false };
    }

    const changedFields = new Set<keyof AgentConfig>();
    for (const field of PRIMITIVE_FIELDS) {
      if (helperAgentReviewSnapshot[field] !== agentConfig[field]) {
        changedFields.add(field);
      }
    }
    for (const field of OBJECT_FIELDS) {
      if (JSON.stringify(helperAgentReviewSnapshot[field]) !== JSON.stringify(agentConfig[field])) {
        changedFields.add(field);
      }
    }
    return { changedFields, hasChanges: changedFields.size > 0 };
  }, [helperAgentReviewSnapshot, agentConfig, isHAReviewUIEnabled]);
}
