import type { CheckProvenance } from './types';

export const PROVISIONAL_SIGNALS = {
  VALIDATION_PREVIEW_EVIDENCE: 'validation-preview-evidence',
  VALIDATION_EVALUATION_EVIDENCE: 'validation-evaluation-evidence',
  VALIDATION_FRESHNESS: 'validation-freshness',
  DEPLOYMENT_AUTHENTICATION: 'deployment-authentication',
  DEPLOYMENT_CONNECTIVITY: 'deployment-connectivity',
  POLICY_CONNECTOR_REVIEW: 'policy-connector-review',
  POLICY_APPROVAL_STATE: 'policy-approval-state',
} as const;

export type ProvisionalSignalTag = typeof PROVISIONAL_SIGNALS[keyof typeof PROVISIONAL_SIGNALS];

export function createProvisionalProvenance(
  provisionalSignals: ProvisionalSignalTag[],
  cleanupNote: string,
): CheckProvenance {
  return {
    evidenceSource: 'provisional',
    provisionalSignals,
    cleanupNote,
  };
}