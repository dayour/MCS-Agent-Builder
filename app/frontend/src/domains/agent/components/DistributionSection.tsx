import { useState, useRef, useEffect } from 'react';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import {
  ChevronDown16Regular,
  ChevronRight16Regular,
  Link20Regular,
  ArrowDownload20Regular,
  Info16Regular,
  Clock16Regular,
  CheckmarkCircle16Regular,
} from '@fluentui/react-icons';
import { LatencyLoader } from '../../../components/ui/StatusIcon';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../../../components/ui/Dialog';
import { AgentConfig } from '../../../types';
import { useAgent } from '../../../context/AgentContext';
import { ReadinessGuidance } from './ReadinessGuidance';

export interface DistributionSectionProps {
  channel: string;
  agentConfig: AgentConfig;
  appId: string;
  /** When true, renders content without the outer collapsible card wrapper. Use when embedded inside another card. */
  embedded?: boolean;
}

/**
 * Distribution Options card — Teams and M365 channels.
 * Owns its own open/close, approval submission, and distribution option state
 * while reading/writing triggerDistribution via AgentContext.
 */
export function DistributionSection({ channel, agentConfig, appId, embedded }: DistributionSectionProps) {
  const { updateWithHistory, updateAgentConfig, isAgentGlobalUndo } = useAgent();
  const [distributionOpen, setDistributionOpen] = useState(true);
  const [showAdminApprovalDialog, setShowAdminApprovalDialog] = useState(false);
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const approvalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (approvalTimerRef.current) clearTimeout(approvalTimerRef.current); }, []);

  const distOptions = agentConfig.triggerDistribution?.[channel] ?? {};

  const updateDistOptions = (patch: Record<string, boolean>) => {
    const current = agentConfig.triggerDistribution?.[channel] ?? {};
    const updated = {
      triggerDistribution: { ...(agentConfig.triggerDistribution ?? {}), [channel]: { ...current, ...patch } },
    };
    isAgentGlobalUndo ? updateWithHistory(updated) : updateAgentConfig(updated);
  };

  const toggleDistOption = (key: 'teammates' | 'everyone') => {
    updateDistOptions({ [key]: !distOptions[key] });
  };

  const handleAdminApprovalConfirm = () => {
    setShowAdminApprovalDialog(false);
    setSubmittingApproval(true);
    approvalTimerRef.current = setTimeout(() => {
      updateDistOptions({ everyone: true, submitted: true });
      setSubmittingApproval(false);
    }, 2500);
  };

  const handleApprovalRefresh = () => {
    const updated = {
      triggerDistribution: {
        ...(agentConfig.triggerDistribution ?? {}),
        [channel]: {
          ...(agentConfig.triggerDistribution?.[channel] ?? {}),
          approved: true,
          submitted: true,
        },
      },
      published: true,
      lastPublishedAt: new Date(),
    };

    isAgentGlobalUndo ? updateWithHistory(updated) : updateAgentConfig(updated);
  };

  const channelLabel = channel === 'teams' ? 'Microsoft Teams' : 'Microsoft 365 Copilot';
  const channelShort = channel === 'teams' ? 'Microsoft Teams' : 'Microsoft 365';

  const contentBody = (
          <div className={embedded ? 'space-y-5' : 'px-6 pb-5 space-y-5'}>

            {/* Get a link -- always visible */}
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">Get a link</p>
              <p className="text-xs text-gray-500 mb-3">
                Users you select can open your agent in {channelLabel} with this link.
              </p>
              <div className="flex items-center gap-3">
                <CopilotButton size="sm" variant="outline" icon={<Link20Regular />}>Copy link</CopilotButton>
                <a href="#" className="text-xs text-[hsl(var(--primary))] hover:underline" onClick={e => e.preventDefault()}>Manage sharing</a>
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* Download a file -- always visible */}
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">Download a file</p>
              <p className="text-xs text-gray-500 mb-3">
                Use your downloaded file to add your agent to the {channelShort} store.
              </p>
              <div className="flex items-center gap-3">
                <CopilotButton size="sm" variant="outline" icon={<ArrowDownload20Regular />}>Download .zip</CopilotButton>
                <a href="#" className="text-xs text-[hsl(var(--primary))] hover:underline" onClick={e => e.preventDefault()}>Learn more</a>
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* Show in the store -- always visible */}
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">Show in the store</p>
              <p className="text-xs text-gray-500 mb-3">Decide who you want to show your agent to:</p>
              <div className="space-y-2">
                <div
                  onClick={() => toggleDistOption('teammates')}
                  className={`border rounded-lg px-4 py-3 cursor-pointer transition-colors ${
                    distOptions.teammates ? 'border-[hsl(var(--primary))] bg-[hsl(237_81%_96%)]' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm text-gray-900">Show to my teammates and shared users</p>
                  <p className="text-xs text-gray-500 mt-0.5">Appears in <strong>Built with Power Platform</strong></p>
                </div>
                <div
                  onClick={!distOptions.submitted ? () => toggleDistOption('everyone') : undefined}
                  className={`border rounded-lg px-4 py-3 transition-colors ${
                    distOptions.everyone || distOptions.submitted
                      ? 'border-[hsl(var(--primary))] bg-[hsl(237_81%_96%)]'
                      : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                  } ${!distOptions.submitted ? 'cursor-pointer' : ''}`}
                >
                  <p className="text-sm text-gray-900">Show to everyone in my org</p>
                  <p className="text-xs text-gray-500 mt-0.5">Appears in <strong>Built by your org</strong> after admin approval</p>
                </div>
              </div>

              {/* "Show to everyone" expanded area -- three states */}

              {/* Submitting: spinner */}
              {submittingApproval && (
                <div className="flex flex-col items-center justify-center py-10">
                  <LatencyLoader size={32} />
                  <p className="text-sm text-[hsl(var(--primary))] mt-4">Sending the agent to your admin ...</p>
                </div>
              )}

              {/* Submitted: confirmation with status */}
              {!submittingApproval && distOptions.submitted && (
                <div className="mt-4 space-y-4">
                  <hr className="border-gray-200" />

                  {/* Info banner */}
                  {distOptions.approved ? (
                    <div className="flex items-center gap-3 bg-[#F0FFF4] border border-[#BBF7D0] rounded-lg px-4 py-3">
                      <CheckmarkCircle16Regular className="text-[hsl(var(--status-success))] flex-shrink-0" />
                      <p className="text-xs text-gray-700 flex-1">Your request completed successfully. Your agent is now available to everyone in your org.</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 bg-[#F0F9FF] border border-[#BAE6FD] rounded-lg px-4 py-3">
                      <Info16Regular className="text-[#0284C7] flex-shrink-0" />
                      <p className="text-xs text-gray-700 flex-1">Your agent is submitted and waiting for approval from your {channel === 'teams' ? 'Teams' : 'M365'} admin.</p>
                      <CopilotButton size="sm" variant="outline" onClick={handleApprovalRefresh}>Refresh</CopilotButton>
                    </div>
                  )}

                  {/* Submission status */}
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-2">{channelShort} — submission status</p>
                    <div className={`flex items-start gap-3 border-l-2 ${distOptions.approved ? 'border-[hsl(var(--status-success))]' : 'border-[hsl(var(--primary))]'} pl-3 py-1`}>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{agentConfig.name || 'Agent'}</p>
                        <p className="text-xs text-gray-500">Version {agentConfig.version || '1.0'}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {distOptions.approved ? (
                            <>
                              <CheckmarkCircle16Regular className="text-[hsl(var(--status-success))]" style={{ width: 12, height: 12 }} />
                              <span className="text-xs text-[hsl(var(--status-success))]">Approved</span>
                            </>
                          ) : (
                            <>
                              <Clock16Regular className="text-gray-400" style={{ width: 12, height: 12 }} />
                              <span className="text-xs text-gray-500">Waiting for approval</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <hr className="border-gray-200" />

                  <ReadinessGuidance channel={channel} appId={appId} submitDisabled onSubmit={undefined} />
                </div>
              )}

              {/* Default: pre-submit detail when "everyone" is selected */}
              {!submittingApproval && !distOptions.submitted && distOptions.everyone && (
                <div className="mt-4 space-y-4">
                  <hr className="border-gray-200" />
                  <ReadinessGuidance channel={channel} appId={appId} submitDisabled={false} onSubmit={() => setShowAdminApprovalDialog(true)} />
                </div>
              )}
            </div>

          </div>
  );

  const adminDialog = (
      <Dialog isOpen={showAdminApprovalDialog} onClose={() => setShowAdminApprovalDialog(false)} maxWidth="md">
        <DialogHeader onClose={() => setShowAdminApprovalDialog(false)}>
          <DialogTitle>Give everyone access to this agent?</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p className="text-sm text-gray-600">
            Sharing your agent with your organization requires you to give everyone access to the agent. Do you want to do this?
          </p>
          <a href="#" className="text-sm text-[hsl(var(--primary))] hover:underline mt-3 inline-block" onClick={e => e.preventDefault()}>
            Learn more
          </a>
        </DialogContent>
        <DialogFooter>
          <CopilotButton variant="secondary" onClick={() => setShowAdminApprovalDialog(false)}>
            Cancel
          </CopilotButton>
          <CopilotButton
            variant="primary"
            onClick={handleAdminApprovalConfirm}
          >
            Yes
          </CopilotButton>
        </DialogFooter>
      </Dialog>
  );

  if (embedded) {
    return <>{contentBody}{adminDialog}</>;
  }

  return (
    <>
      <div className="border border-gray-200 rounded-2xl">
        <CopilotButton
          variant="transparent"
          onClick={() => setDistributionOpen(v => !v)}
          className="w-full flex items-start gap-2 px-6 py-4 text-left"
          aria-expanded={distributionOpen}
          style={{ height: 'auto', borderRadius: 0, justifyContent: 'flex-start', minHeight: 0, borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}
        >
          <span className="mt-0.5 flex-shrink-0">
            {distributionOpen ? (
              <ChevronDown16Regular style={{ color: 'hsl(var(--text-secondary))' }} />
            ) : (
              <ChevronRight16Regular style={{ color: 'hsl(var(--text-secondary))' }} />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Distribution</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Control how users discover and access your agent on {channelLabel}.
            </p>
          </div>
        </CopilotButton>

        {distributionOpen && (
          <div className="px-6 pb-5">
            {contentBody}
          </div>
        )}
      </div>
      {adminDialog}
    </>
  );
}
