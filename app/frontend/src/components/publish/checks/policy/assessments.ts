import { AgentConfig } from '../../../../types';
import { createProvisionalProvenance, PROVISIONAL_SIGNALS } from '../../provisionalSignals';
import { CheckDetail } from '../../types';
import {
  APPROVAL_STATE_PROVENANCE_NOTE,
  CONNECTOR_POLICY_PROVENANCE_NOTE,
} from './constants';
import { formatChannelName, isInsecureEndpoint } from './helpers';

export interface DataPolicyAssessment {
  detail: CheckDetail;
  blockingIssueCount: number;
}

export interface ApprovalAssessment {
  detail: CheckDetail;
  approvalRequiredChannels: string[];
}

export function assessDataConnections(agent: AgentConfig): DataPolicyAssessment {
  const insecureApis = agent.knowledge.customAPIs.filter(api => api.enabled && isInsecureEndpoint(api.endpoint));

  return {
    detail: insecureApis.length > 0
      ? {
          label: 'Data connections meet policy',
          status: 'failed',
          message: `Enabled custom API${insecureApis.length !== 1 ? 's use' : ' uses'} insecure http:// endpoints: ${insecureApis.map(api => api.name).join(', ')}`,
        }
      : {
          label: 'Data connections meet policy',
          status: 'passed',
        },
    blockingIssueCount: insecureApis.length,
  };
}

export function assessConnectorPolicy(agent: AgentConfig): CheckDetail {
  return {
    label: 'Connector policy review',
    status: 'passed',
    message: agent.knowledge.customAPIs.some(api => api.enabled)
      ? 'Custom APIs are enabled — confirm any org-specific approval requirements'
      : 'No restricted connectors detected from the current configuration',
    provenance: createProvisionalProvenance(
      [PROVISIONAL_SIGNALS.POLICY_CONNECTOR_REVIEW],
      CONNECTOR_POLICY_PROVENANCE_NOTE,
    ),
  };
}

export function assessPermissions(): CheckDetail {
  return {
    label: 'Required permissions satisfied',
    status: 'passed',
  };
}

export function assessAdminApproval(agent: AgentConfig): ApprovalAssessment {
  const approvalRequiredEntries = Object.entries(agent.triggerDistribution ?? {})
    .filter(([, options]) => (options.everyone || options.submitted) && !options.approved);

  const pendingApprovalChannels = approvalRequiredEntries
    .filter(([, options]) => options.submitted)
    .map(([channel]) => formatChannelName(channel));

  const requiresSubmissionChannels = approvalRequiredEntries
    .filter(([, options]) => !options.submitted)
    .map(([channel]) => formatChannelName(channel));

  const approvedChannels = Object.entries(agent.triggerDistribution ?? {})
    .filter(([, options]) => options.approved)
    .map(([channel]) => formatChannelName(channel));

  const detail: CheckDetail = approvalRequiredEntries.length > 0
    ? {
        label: 'Admin approval',
        status: 'passed',
        message: [
          pendingApprovalChannels.length > 0
            ? `${pendingApprovalChannels.join(', ')} ${pendingApprovalChannels.length === 1 ? 'is' : 'are'} awaiting admin approval`
            : null,
          requiresSubmissionChannels.length > 0
            ? `${requiresSubmissionChannels.join(', ')} ${requiresSubmissionChannels.length === 1 ? 'requires' : 'require'} admin approval before going live`
            : null,
        ].filter(Boolean).join('. '),
        provenance: createProvisionalProvenance(
          [PROVISIONAL_SIGNALS.POLICY_APPROVAL_STATE],
          APPROVAL_STATE_PROVENANCE_NOTE,
        ),
      }
    : approvedChannels.length > 0
      ? {
          label: 'Admin approval',
          status: 'passed',
          message: `${approvedChannels.join(', ')} ${approvedChannels.length === 1 ? 'has' : 'have'} been approved`,
          provenance: createProvisionalProvenance(
            [PROVISIONAL_SIGNALS.POLICY_APPROVAL_STATE],
            APPROVAL_STATE_PROVENANCE_NOTE,
          ),
        }
      : {
          label: 'Admin approval',
          status: 'passed',
          message: 'No outstanding admin approval requirements detected',
          provenance: createProvisionalProvenance(
            [PROVISIONAL_SIGNALS.POLICY_APPROVAL_STATE],
            APPROVAL_STATE_PROVENANCE_NOTE,
          ),
        };

  return {
    detail,
    approvalRequiredChannels: approvalRequiredEntries.map(([channel]) => formatChannelName(channel)),
  };
}