import { APPROVAL_PENDING_SUMMARY } from './constants';

export function buildPolicySummary(blockingIssueCount: number, approvalRequiredChannels: string[]): string {
  if (blockingIssueCount > 0) {
    return `Policy review found ${blockingIssueCount} blocking issue${blockingIssueCount !== 1 ? 's' : ''} that must be fixed before publishing.`;
  }

  if (approvalRequiredChannels.length > 0) {
    return APPROVAL_PENDING_SUMMARY;
  }

  return 'Policy requirements met.';
}