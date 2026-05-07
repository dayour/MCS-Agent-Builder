import { AgentConfig } from '../../../types';
import { PublishCheck, PublishCheckResult } from '../types';
import { createProvisionalProvenance, PROVISIONAL_SIGNALS } from '../provisionalSignals';
import {
  assessAdminApproval,
  assessConnectorPolicy,
  assessDataConnections,
  assessPermissions,
} from './policy/assessments';
import { POLICY_CHECK_PROVENANCE_NOTE } from './policy/constants';
import { buildPolicySummary } from './policy/summary';

/**
 * Checks policy / compliance requirements:
 * - DLP conflicts
 * - Restricted connectors
 * - Required permissions
 * - Admin approval
 */
export const policyCheck: PublishCheck = {
  id: 'policy',
  label: 'Verifying policy requirements',

  run: async (agent: AgentConfig): Promise<PublishCheckResult> => {
    const dataAssessment = assessDataConnections(agent);
    const approvalAssessment = assessAdminApproval(agent);

    const details: PublishCheckResult['details'] = [
      dataAssessment.detail,
      assessConnectorPolicy(agent),
      assessPermissions(),
      approvalAssessment.detail,
    ];

    const hasFailed = details.some(detail => detail.status === 'failed');
    const summary = buildPolicySummary(dataAssessment.blockingIssueCount, approvalAssessment.approvalRequiredChannels);

    return {
      status: hasFailed ? 'failed' : 'passed',
      label: 'Verified policy requirements',
      details,
      summary,
      completionState: approvalAssessment.approvalRequiredChannels.length > 0 ? 'submit-for-approval' : 'publish',
      provenance: createProvisionalProvenance(
        [PROVISIONAL_SIGNALS.POLICY_CONNECTOR_REVIEW, PROVISIONAL_SIGNALS.POLICY_APPROVAL_STATE],
        POLICY_CHECK_PROVENANCE_NOTE,
      ),
    };
  },
};
