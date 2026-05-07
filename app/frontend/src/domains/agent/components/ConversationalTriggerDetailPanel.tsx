import { useState, useRef } from 'react';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotTooltip } from '../../../components/ui/CopilotTooltip';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { CopilotTextarea } from '../../../components/ui/CopilotTextarea';
import { CopilotToggle } from '../../../components/ui/CopilotToggle';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../../../components/ui/Dialog';
import {
  ArrowLeft20Regular,
  Dismiss20Regular,
  Add24Regular,
  ChevronDown16Regular,
  ChevronRight16Regular,
  Color20Regular,
  Image20Regular,
  Open20Regular,
  Info16Regular,
  ArrowDownload20Regular,
} from '@fluentui/react-icons';
import { SquircleIcon } from '../../../components/ui/SquircleIcon';
import { ComponentItem, getTriggerChannel, TRIGGER_PANEL_TITLES, getTriggerTypeLabel, CHANNEL_ICON_PATHS, CHANNEL_DISPLAY_NAMES } from '../../../utils/buildPageUtils';
import { ConnectionBadge } from './ConnectionBadge';
import { getAgentIcon, getUniqueGradientCSS } from '../../../utils/agentIcons';
import { AgentConfig } from '../../../types';
import { useAgent } from '../../../context/AgentContext';
import { SharePointSiteSection } from './SharePointSiteSection';
import { DistributionSection } from './DistributionSection';
import { TeamsSettingsSection } from './TeamsSettingsSection';
import { WhatsAppSetupSection } from './WhatsAppSetupSection';


// ── Suggested prompts ────────────────────────────────────────────────────────

interface SuggestedPrompt {
  id: string;
  title: string;
  text: string;
}

function getSuggestedPrompts(agentConfig: AgentConfig): SuggestedPrompt[] {
  const combined = `${agentConfig.name ?? ''} ${agentConfig.purpose ?? ''} ${agentConfig.description ?? ''}`.toLowerCase();

  if (/\b(it|helpdesk|support|ticket|issue|error|problem|troubleshoot|password|device)\b/.test(combined)) {
    return [
      { id: 'p1', title: 'Outlook error', text: 'Seeing an error when opening Outlook.' },
      { id: 'p2', title: 'Sign in error', text: 'Unable to sign in to my account.' },
    ];
  }
  if (/\b(hr|human resources|onboarding|employee|leave|vacation|benefit|policy|hiring)\b/.test(combined)) {
    return [
      { id: 'p1', title: 'Time off request', text: 'How do I request time off?' },
      { id: 'p2', title: 'Benefits enrollment', text: 'Where can I find the benefits enrollment form?' },
    ];
  }
  if (/\b(sales|customer|crm|lead|deal|account|revenue|prospect|pipeline)\b/.test(combined)) {
    return [
      { id: 'p1', title: 'Deal status', text: 'What is the status of my latest deal?' },
      { id: 'p2', title: 'Open opportunities', text: 'Show me all open opportunities for this quarter.' },
    ];
  }
  if (/\b(finance|budget|expense|invoice|accounting|payroll|procurement)\b/.test(combined)) {
    return [
      { id: 'p1', title: 'Expense report', text: 'How do I submit an expense report?' },
      { id: 'p2', title: 'Budget approval', text: 'What is the approval process for budget requests?' },
    ];
  }
  return [
    { id: 'p1', title: 'Get help', text: 'How can you help me today?' },
    { id: 'p2', title: 'Capabilities', text: 'What can this agent do for me?' },
  ];
}

// ── Component ────────────────────────────────────────────────────────────────

export interface ConversationalTriggerDetailPanelProps {
  trigger: ComponentItem;
  agentConfig: AgentConfig;
  onBack: () => void;
  onClose: () => void;
}

export function ConversationalTriggerDetailPanel({
  trigger,
  agentConfig,
  onBack,
  onClose,
}: ConversationalTriggerDetailPanelProps) {
  const [prompts, setPrompts] = useState<SuggestedPrompt[]>(() =>
    getSuggestedPrompts(agentConfig)
  );
  const [suggestedPromptsOpen, setSuggestedPromptsOpen] = useState(true);
  const [agentPreviewOpen, setAgentPreviewOpen] = useState(true);
  const [shortDescription, setShortDescription] = useState(agentConfig.description ?? '');
  const [longDescription, setLongDescription] = useState(agentConfig.purpose ?? '');

  // M365 disclaimer toggle (M365 channel only)
  const [m365Disclaimer, setM365Disclaimer] = useState(false);

  // SharePoint Distribution section
  const [spDistributionOpen, setSpDistributionOpen] = useState(true);

  // WhatsApp Distribution section
  const [waDistributionOpen, setWaDistributionOpen] = useState(true);
  const waDistributionRef = useRef<HTMLDivElement>(null);

  // Static placeholder App ID for demo/prototype — replace with real agent config value when available
  const [appId] = useState('e948cba5-c068-480d-9e82-5eab5aeb62ff');

  const { removeTriggerFromInstructions, softDeleteTrigger, restoreTrigger } = useAgent();
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const channel =
    getTriggerChannel(trigger.name) ??
    getTriggerChannel(trigger.source) ??
    null;

  const iconPath = channel ? CHANNEL_ICON_PATHS[channel] : null;
  const panelTitle = channel === 'sharepoint'
    ? 'When a user messages on SharePoint'
    : channel ? (TRIGGER_PANEL_TITLES[channel] ?? trigger.name) : trigger.name;
  const channelDisplayName = channel
    ? (CHANNEL_DISPLAY_NAMES[channel] ?? trigger.source)
    : trigger.source;
  const triggerTypeLabel = channel === 'sharepoint'
    ? 'Agent will be available in SharePoint'
    : getTriggerTypeLabel(channel);

  // Button is only enabled when agent was published with this trigger in the snapshot.
  // Match on iconKey directly — more reliable than fuzzy label matching via getTriggerChannel.
  const normalizeChannel = (k: string) => k === 'm365' ? 'microsoft 365' : k;
  const isTriggerPublished = !!agentConfig.published && !!agentConfig.publishedTriggers?.some(
    t => channel && normalizeChannel(t.iconKey) === channel
  );

  const isSoftDeleted = agentConfig.softDeletedTriggers?.includes(trigger.name) ?? false;
  // A trigger is "live" if it was part of the last publish snapshot
  const isTriggerLive = isTriggerPublished;

  const updatePrompt = (id: string, field: 'title' | 'text', value: string) => {
    setPrompts(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const addPrompt = () => {
    setPrompts(prev => [
      ...prev,
      { id: `p${Date.now()}`, title: '', text: '' },
    ]);
  };

  return (
    <div className="absolute inset-0 bg-white z-10 flex flex-col overflow-hidden" style={{ minHeight: '100%' }}>
      {/* Top navigation */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
        <CopilotButton
          variant="transparent"
          size="sm"
          icon={<ArrowLeft20Regular />}
          onClick={onBack}
        >
          Back to components
        </CopilotButton>
        <CopilotButton
          variant="transparent"
          size="sm"
          icon={<Dismiss20Regular />}
          onClick={onClose}
          aria-label="Close"
        />
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-6 pb-8">

        {/* Trigger header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex-shrink-0 flex items-center justify-center">
            {iconPath ? (
              <img src={iconPath} alt={channelDisplayName} className="w-9 h-9" />
            ) : (
              <span className="text-2xl font-bold text-gray-400">{channelDisplayName[0]}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{panelTitle}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{triggerTypeLabel}</p>
          </div>

          {/* Connection status */}
          <ConnectionBadge />
        </div>

        <div className="flex items-center justify-between mb-4">
          <CopilotTooltip
            content={`Publish to make this agent available in ${channelDisplayName}`}
            placement="top"
            disabled={isTriggerPublished}
          >
            <span style={{ display: 'inline-block' }}>
              <CopilotButton
                size="sm"
                variant="outline"
                icon={iconPath ? <img src={iconPath} alt="" className="w-4 h-4" /> : <Open20Regular />}
                onClick={() => {
                  if (channel === 'whatsapp') {
                    // Scroll to Distribution section and expand it
                    setWaDistributionOpen(true);
                    setTimeout(() => waDistributionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
                  } else {
                    // TODO: replace with production deep-link format when available
                    window.open(channel === 'microsoft 365'
                      ? `https://m365.cloud.microsoft/chat?agent=${agentConfig.id}`
                      : `https://teams.microsoft.com/l/chat/0/0?agent=${agentConfig.id}`,
                      '_blank');
                  }
                }}
                disabled={channel === 'whatsapp' ? false : !isTriggerPublished}
              >
                {channel === 'microsoft 365' ? 'Chat with agent in Microsoft 365' : channel === 'sharepoint' ? 'Chat with agent on SharePoint' : channel === 'whatsapp' ? 'Chat with agent on WhatsApp' : 'Chat with agent in Teams'}
              </CopilotButton>
            </span>
          </CopilotTooltip>
          {isSoftDeleted ? (
            <CopilotButton size="sm" variant="primary" onClick={() => restoreTrigger(trigger.name)}>
              Restore trigger
            </CopilotButton>
          ) : (
            <CopilotButton size="sm" variant="outline" onClick={() => setShowRemoveDialog(true)} className="text-red-600 hover:text-red-700 hover:border-red-300">
              Remove trigger
            </CopilotButton>
          )}
        </div>

        {/* Soft-delete banner */}
        {isSoftDeleted && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-sm text-amber-900 flex-1">
              This trigger has been removed and will be permanently deleted on next publish.
            </p>
            <CopilotButton size="sm" variant="primary" onClick={() => restoreTrigger(trigger.name)}>
              Restore
            </CopilotButton>
          </div>
        )}

        <div className={`space-y-3 ${isSoftDeleted ? 'opacity-50 pointer-events-none' : ''}`}>

          {/* ── Agent Preview card (hidden for SharePoint & WhatsApp) ──── */}
          {channel !== 'sharepoint' && channel !== 'whatsapp' && <div className="border border-gray-200 rounded-2xl">
            <CopilotButton
              variant="transparent"
              onClick={() => setAgentPreviewOpen(v => !v)}
              className="w-full flex items-start gap-2 px-6 py-4 text-left"
              aria-expanded={agentPreviewOpen}
              style={{ height: 'auto', borderRadius: 0, justifyContent: 'flex-start', minHeight: 0, borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}
            >
              <span className="mt-0.5 flex-shrink-0">
                {agentPreviewOpen ? (
                  <ChevronDown16Regular style={{ color: 'hsl(var(--text-secondary))' }} />
                ) : (
                  <ChevronRight16Regular style={{ color: 'hsl(var(--text-secondary))' }} />
                )}
              </span>
              <span>
                <span className="text-sm font-semibold text-gray-900">Agent Preview</span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  How the agent will be seen by the end user.
                </span>
              </span>
            </CopilotButton>

            {agentPreviewOpen && (
              <div className="px-6 pb-6 space-y-5">

                {/* Name */}
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1">Name</p>
                  <p className="text-sm text-gray-900">{agentConfig.name || '—'}</p>
                </div>

                {/* Icon */}
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-2">Icon</p>
                  <div className="flex items-center gap-4">
                    <SquircleIcon
                      size={48}
                      cornerRadius={12}
                      gradient={getUniqueGradientCSS(agentConfig.id)}
                    >
                      {getAgentIcon(agentConfig.iconKey ?? 'generic', 28)}
                    </SquircleIcon>

                    <div className="w-px h-10 bg-gray-200 flex-shrink-0" />

                    <div className="flex flex-col gap-1.5">
                      <CopilotButton
                        variant="transparent"
                        size="sm"
                        icon={<Color20Regular />}
                      >
                        Change color
                      </CopilotButton>
                      <CopilotButton
                        variant="transparent"
                        size="sm"
                        icon={<Image20Regular />}
                      >
                        Change icon
                      </CopilotButton>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 mt-2 leading-relaxed max-w-lg">
                    Icons should be in PNG format and less than 30 KB in size. Use a white
                    transparent image that has no extra padding. Don't upload a confidential icon
                    as your agent's icon.{' '}
                    <a
                      href="#"
                      className="text-blue-600 hover:underline"
                      onClick={e => e.preventDefault()}
                    >
                      Learn more
                    </a>
                  </p>
                </div>

                {/* Short description */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Short description
                  </label>
                  <CopilotInput
                    appearance="outline"
                    size="sm"
                    value={shortDescription}
                    onChange={e => setShortDescription(e.target.value.slice(0, 80))}
                    placeholder="e.g. Built using Microsoft Copilot Studio"
                    className="w-full"
                  />
                  <p className="text-xs text-gray-400 mt-1">Up to 80 characters</p>
                </div>

                {/* Long description */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Long description
                  </label>
                  <CopilotTextarea
                    value={longDescription}
                    onChange={e => setLongDescription(e.target.value.slice(0, 3400))}
                    placeholder="Describe what your agent does in detail…"
                    rows={3}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-400 mt-1">Up to 3400 characters</p>
                </div>

              </div>
            )}
          </div>}

          {/* ── SharePoint Site Deployment card (SharePoint only) ─────── */}
          {channel === 'sharepoint' && <SharePointSiteSection />}

          {/* ── SharePoint Distribution card (SharePoint only) ────────── */}
          {channel === 'sharepoint' && (() => {
            const isSPPublished = !!agentConfig.published && !!agentConfig.publishedTriggers?.some(
              t => t.iconKey === 'sharepoint'
            );
            return (
              <div className="border border-gray-200 rounded-2xl">
                <CopilotButton
                  variant="transparent"
                  onClick={() => setSpDistributionOpen(v => !v)}
                  className="w-full flex items-start gap-2 px-6 py-4 text-left"
                  aria-expanded={spDistributionOpen}
                  style={{ height: 'auto', borderRadius: 0, justifyContent: 'flex-start', minHeight: 0, borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}
                >
                  <span className="mt-0.5 flex-shrink-0">
                    {spDistributionOpen ? (
                      <ChevronDown16Regular style={{ color: 'hsl(var(--text-secondary))' }} />
                    ) : (
                      <ChevronRight16Regular style={{ color: 'hsl(var(--text-secondary))' }} />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Distribution</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      Manage how users discover this agent on your SharePoint site.
                    </p>
                  </div>
                </CopilotButton>

                {spDistributionOpen && (
                  <div className="px-6 pb-5">
                    <div className="flex gap-2 p-3 bg-[#F0F4FF] rounded-lg">
                      <Info16Regular className="text-[hsl(var(--text-secondary))] flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-[hsl(var(--text-secondary))] leading-relaxed">
                        {isSPPublished ? (
                          <>
                            If you would like to make this agent easily discoverable to all users of the SharePoint site, please work with the site owner to mark its status as 'Approved'.{' '}
                            <a href="#" className="text-[hsl(var(--primary))] hover:underline" onClick={e => e.preventDefault()}>Learn more</a>
                          </>
                        ) : (
                          <>
                            Once you publish this agent to SharePoint, you can work with the site owner to mark its status as 'Approved' to make it easily discoverable to all users of the site.{' '}
                            <a href="#" className="text-[hsl(var(--primary))] hover:underline" onClick={e => e.preventDefault()}>Learn more</a>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Distribution Options card (Teams & M365 only) ────────── */}
          {(channel === 'teams' || channel === 'microsoft 365') && (
            <DistributionSection channel={channel} agentConfig={agentConfig} appId={appId} />
          )}

          {/* ── Suggested Prompts card (hidden for WhatsApp) ──────────── */}
          {channel !== 'whatsapp' && <div className="border border-gray-200 rounded-2xl">
            {/* Custom header to fit the + Add button */}
            <div className="flex items-start justify-between px-6 py-4">
              <CopilotButton
                variant="transparent"
                onClick={() => setSuggestedPromptsOpen(v => !v)}
                className="flex items-start gap-2 text-left"
                aria-expanded={suggestedPromptsOpen}
                style={{ height: 'auto', borderRadius: 0, justifyContent: 'flex-start', minHeight: 0, padding: 0 }}
              >
                <span className="mt-0.5 flex-shrink-0">
                  {suggestedPromptsOpen ? (
                    <ChevronDown16Regular style={{ color: 'hsl(var(--text-secondary))' }} />
                  ) : (
                    <ChevronRight16Regular style={{ color: 'hsl(var(--text-secondary))' }} />
                  )}
                </span>
                <span>
                  <span className="text-sm font-semibold text-gray-900">Suggested Prompts</span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    {channelDisplayName} serves as the conversation entry point for routing the agent to
                    appropriate knowledge, skills, and actions based on defined instructions.{' '}
                    <a
                      href="#"
                      className="text-blue-600 hover:underline"
                      onClick={e => e.preventDefault()}
                    >
                      Learn more
                    </a>
                  </span>
                </span>
              </CopilotButton>

              <CopilotButton
                variant="secondary"
                size="sm"
                icon={<Add24Regular />}
                onClick={addPrompt}
                className="flex-shrink-0 ml-4"
              >
                Add
              </CopilotButton>
            </div>

            {suggestedPromptsOpen && (
              <div className="px-6 pb-5">
                <div>
                  {prompts.map((prompt, idx) => (
                    <div key={prompt.id}>
                      {idx > 0 && <div className="border-t border-gray-100 my-3" />}

                      {/* Two-column: Title + Prompt */}
                      <div className="flex items-end gap-3">
                        {/* Title field (~1/3 width) */}
                        <div className="flex-[1]">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Title
                          </label>
                          <CopilotInput
                            appearance="outline"
                            size="sm"
                            value={prompt.title}
                            onChange={e => updatePrompt(prompt.id, 'title', e.target.value)}
                            placeholder="e.g. Outlook error"
                          />
                        </div>

                        {/* Prompt field (~2/3 width) */}
                        <div className="flex-[2]">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Prompt
                          </label>
                          <CopilotInput
                            appearance="outline"
                            size="sm"
                            value={prompt.text}
                            onChange={e => updatePrompt(prompt.id, 'text', e.target.value)}
                            placeholder="e.g. Seeing an error when opening Outlook."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>}

          {/* ── M365 Settings card (Microsoft 365 channel only) ──────── */}
          {channel === 'microsoft 365' && (
            <div className="border border-gray-200 rounded-2xl px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Show an agent disclaimer in M365 Copilot</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    Display a notice when the user launches or @mentions the agent in M365 Copilot to help them learn more about data and privacy policies.
                  </p>
                </div>
                <CopilotToggle
                  checked={m365Disclaimer}
                  onChange={setM365Disclaimer}
                  label={m365Disclaimer ? 'On' : 'Off'}
                  aria-label="Show an agent disclaimer in M365 Copilot"
                />
              </div>
            </div>
          )}

          {/* ── Teams Settings card (Teams channel only) ────────────── */}
          {channel === 'teams' && <TeamsSettingsSection appId={appId} />}

          {/* ── WhatsApp Setup card (WhatsApp channel only) ─────── */}
          {channel === 'whatsapp' && <WhatsAppSetupSection />}

          {/* ── WhatsApp Distribution card (WhatsApp only) ────────── */}
          {channel === 'whatsapp' && (() => {
            const waState = agentConfig.triggerDistribution?.whatsapp;
            const isWAPublished = !!agentConfig.published && !!agentConfig.publishedTriggers?.some(
              t => t.iconKey === 'whatsapp'
            );
            const connectedPhone = waState?.whatsappPhoneNumber;
            return (
              <div ref={waDistributionRef} className="border border-gray-200 rounded-2xl">
                <CopilotButton
                  variant="transparent"
                  onClick={() => setWaDistributionOpen(v => !v)}
                  className="w-full flex items-start gap-2 px-6 py-4 text-left"
                  aria-expanded={waDistributionOpen}
                  style={{ height: 'auto', borderRadius: 0, justifyContent: 'flex-start', minHeight: 0, borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}
                >
                  <span className="mt-0.5 flex-shrink-0">
                    {waDistributionOpen ? (
                      <ChevronDown16Regular style={{ color: 'hsl(var(--text-secondary))' }} />
                    ) : (
                      <ChevronRight16Regular style={{ color: 'hsl(var(--text-secondary))' }} />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Distribution</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      Connect to your agent in WhatsApp.
                    </p>
                  </div>
                </CopilotButton>

                {waDistributionOpen && (
                  <div className="px-6 pb-5 space-y-4">
                    {isWAPublished && connectedPhone ? (
                      <>
                        <div>
                          <p className="text-xs text-gray-500 leading-relaxed">
                            This channel lets users chat with your agent on WhatsApp.{' '}
                            <a href="#" className="text-[hsl(var(--primary))] hover:underline" onClick={e => e.preventDefault()}>Learn more</a>
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Your agent is connected to the phone number: <strong className="text-gray-900">{connectedPhone}</strong>
                          </p>
                        </div>

                        <div className="border border-gray-200 rounded-lg p-5">
                          <p className="text-sm font-semibold text-gray-900 mb-2">Connect to your agent in WhatsApp</p>
                          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                            Download this QR code and share it with your WhatsApp users. Once they've scanned it, they'll be able to start conversations with your agent in WhatsApp. You can also use this QR code to test your agent.
                          </p>
                          <div className="flex items-end justify-between">
                            <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect width="120" height="120" fill="white"/>
                              <rect x="8" y="8" width="32" height="32" rx="2" stroke="#1A1A2E" strokeWidth="4" fill="none"/>
                              <rect x="16" y="16" width="16" height="16" fill="#1A1A2E"/>
                              <rect x="80" y="8" width="32" height="32" rx="2" stroke="#1A1A2E" strokeWidth="4" fill="none"/>
                              <rect x="88" y="16" width="16" height="16" fill="#1A1A2E"/>
                              <rect x="8" y="80" width="32" height="32" rx="2" stroke="#1A1A2E" strokeWidth="4" fill="none"/>
                              <rect x="16" y="88" width="16" height="16" fill="#1A1A2E"/>
                              <rect x="48" y="8" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="56" y="16" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="64" y="8" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="48" y="24" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="64" y="24" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="48" y="48" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="56" y="56" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="64" y="48" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="48" y="64" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="64" y="64" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="80" y="48" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="88" y="56" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="96" y="48" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="80" y="64" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="96" y="64" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="104" y="80" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="80" y="88" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="96" y="96" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="8" y="48" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="16" y="56" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="24" y="48" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="8" y="64" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="24" y="64" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="48" y="80" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="56" y="88" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="48" y="96" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="64" y="80" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="64" y="96" width="8" height="8" fill="#1A1A2E"/>
                              <rect x="104" y="104" width="8" height="8" fill="#1A1A2E"/>
                            </svg>
                            <CopilotButton size="sm" variant="outline" icon={<ArrowDownload20Regular />}>
                              Download
                            </CopilotButton>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-[hsl(var(--text-secondary))] leading-relaxed">
                          We will create this QR code once you have published this agent on a WhatsApp number. Download this QR code and share it with your WhatsApp users.
                          Once they've scanned it, they'll be able to start conversations with your agent in WhatsApp. You can also use this QR code to test your agent.
                        </p>
                        {/* Blurred QR code placeholder */}
                        <div style={{ filter: 'blur(3px)', opacity: 0.7, pointerEvents: 'none', width: 120, height: 120 }}>
                          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect width="120" height="120" fill="white"/>
                            <rect x="8" y="8" width="32" height="32" rx="2" stroke="#1A1A2E" strokeWidth="4" fill="none"/>
                            <rect x="16" y="16" width="16" height="16" fill="#1A1A2E"/>
                            <rect x="80" y="8" width="32" height="32" rx="2" stroke="#1A1A2E" strokeWidth="4" fill="none"/>
                            <rect x="88" y="16" width="16" height="16" fill="#1A1A2E"/>
                            <rect x="8" y="80" width="32" height="32" rx="2" stroke="#1A1A2E" strokeWidth="4" fill="none"/>
                            <rect x="16" y="88" width="16" height="16" fill="#1A1A2E"/>
                            <rect x="48" y="8" width="8" height="8" fill="#1A1A2E"/>
                            <rect x="56" y="16" width="8" height="8" fill="#1A1A2E"/>
                            <rect x="64" y="8" width="8" height="8" fill="#1A1A2E"/>
                            <rect x="48" y="48" width="8" height="8" fill="#1A1A2E"/>
                            <rect x="56" y="56" width="8" height="8" fill="#1A1A2E"/>
                            <rect x="64" y="48" width="8" height="8" fill="#1A1A2E"/>
                            <rect x="80" y="48" width="8" height="8" fill="#1A1A2E"/>
                            <rect x="96" y="48" width="8" height="8" fill="#1A1A2E"/>
                            <rect x="104" y="80" width="8" height="8" fill="#1A1A2E"/>
                            <rect x="96" y="96" width="8" height="8" fill="#1A1A2E"/>
                            <rect x="8" y="48" width="8" height="8" fill="#1A1A2E"/>
                            <rect x="24" y="48" width="8" height="8" fill="#1A1A2E"/>
                            <rect x="48" y="80" width="8" height="8" fill="#1A1A2E"/>
                            <rect x="64" y="96" width="8" height="8" fill="#1A1A2E"/>
                            <rect x="104" y="104" width="8" height="8" fill="#1A1A2E"/>
                          </svg>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

        </div>
        </div>
      </div>

      {/* Remove trigger confirmation dialog */}
      <Dialog isOpen={showRemoveDialog} onClose={() => setShowRemoveDialog(false)} maxWidth="md">
        <DialogHeader onClose={() => setShowRemoveDialog(false)}>
          <DialogTitle>Remove this trigger?</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p className="text-sm text-gray-600">
            {isTriggerLive
              ? <>This trigger is currently published. Removing it will take effect on next publish. You can restore it anytime before publishing.</>
              : <>This will remove <strong>{channelDisplayName}</strong> as a trigger for this agent. Any distribution settings and channel-specific configuration will be cleared.</>
            }
          </p>
        </DialogContent>
        <DialogFooter>
          <CopilotButton variant="secondary" onClick={() => setShowRemoveDialog(false)}>
            Cancel
          </CopilotButton>
          <CopilotButton
            variant="primary"
            className="bg-red-600 hover:bg-red-700 active:bg-red-800"
            onClick={() => {
              if (isTriggerLive) {
                softDeleteTrigger(trigger.name);
              } else {
                removeTriggerFromInstructions(trigger.name);
                onBack();
              }
              setShowRemoveDialog(false);
            }}
          >
            Remove
          </CopilotButton>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
