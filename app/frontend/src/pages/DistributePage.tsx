import React, { useState } from 'react';
import { useAgent } from '../context/AgentContext';
import { CopilotButton } from '../components/ui/CopilotButton';
import { CopilotCheckbox } from '../components/ui/CopilotCheckbox';
import { DistributionSection } from '../domains/agent/components/DistributionSection';
import {
  Info16Regular,
  ArrowDownload20Regular,
  Globe20Regular,
  ChevronDown16Regular,
  ChevronRight16Regular,
} from '@fluentui/react-icons';
import { CHANNEL_DISPLAY_NAMES, CHANNEL_ICON_PATHS, CONVERSATIONAL_CHANNEL_KEYS, getTriggerChannel } from '../utils/buildPageUtils';

// Direct Line surfaces — require developer setup, not native triggers
const DIRECT_LINE_SURFACES = [
  { id: 'slack', name: 'Slack', icon: '/component-icons/Slack16.svg' },
  { id: 'telegram', name: 'Telegram', icon: '/component-icons/Telegram16.svg' },
  { id: 'twilio', name: 'Twilio', icon: '/component-icons/Twilio16.svg' },
  { id: 'line', name: 'Line', icon: '/component-icons/Line16.svg' },
  { id: 'groupme', name: 'GroupMe', icon: '/component-icons/GroupMe16.svg' },
  { id: 'directline-speech', name: 'Direct Line Speech', icon: '/component-icons/DirectLineSpeech16.svg' },
  { id: 'email', name: 'Email', icon: '/component-icons/Email16.svg' },
  { id: 'web-app', name: 'Web app', icon: '/component-icons/WebApp16.svg' },
  { id: 'native-app', name: 'Native app', icon: '/component-icons/NativeApp16.svg' },
];

/**
 * Distribute page — aggregates distribution options across all published triggers.
 * Accessible via the "Distribute" tab when the feature toggle is enabled.
 */
export const DistributePage: React.FC = () => {
  const { agentConfig } = useAgent();
  const [outlookEventOpen, setOutlookEventOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState<Record<string, boolean>>({});

  const publishedTriggers = agentConfig.publishedTriggers ?? [];
  const isPublished = !!agentConfig.published && publishedTriggers.length > 0;

  // Parse all configured triggers from instructions to find unpublished ones
  const allConfiguredChannels = React.useMemo(() => {
    const instructions = agentConfig.instructions || '';
    const wtaMatch = instructions.match(/^Where this agent works:(.*)$/m);
    if (!wtaMatch) return [];
    const re = /\{\{icon:([\w\s]+?)\}\}\s*\[\[([^\]]+)\]\]/g;
    const channels: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(wtaMatch[1])) !== null) {
      const iconKey = m[1].toLowerCase();
      const ch = iconKey === 'm365' ? 'microsoft 365' : iconKey;
      if (CONVERSATIONAL_CHANNEL_KEYS.has(ch) || ch === 'sharepoint') {
        if (!channels.includes(ch)) channels.push(ch);
      }
    }
    return channels;
  }, [agentConfig.instructions]);

  // Published channel keys (normalized)
  const publishedChannels = React.useMemo(() => {
    return publishedTriggers.map(t => {
      const ch = t.iconKey === 'm365' ? 'microsoft 365' : t.iconKey;
      return ch;
    }).filter((ch, i, arr) => arr.indexOf(ch) === i);
  }, [publishedTriggers]);

  // Unpublished = configured but not in publishedChannels
  const unpublishedChannels = allConfiguredChannels.filter(ch => !publishedChannels.includes(ch));

  // MOCK — replace with real App ID from agentConfig when available
  const appId = 'e948cba5-c068-480d-9e82-5eab5aeb62ff';

  return (
    <div className="h-full overflow-y-auto">
    <div className="max-w-[1024px] w-full mx-auto px-8 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Distribute</h1>
        <p className="text-sm text-gray-500 mt-2 max-w-[640px] leading-relaxed">
          Get your agent into the hands of users. Each trigger that activates your agent can also have its own distribution mechanisms to help your agent reach more users.
        </p>
      </div>

      {!isPublished ? (
        /* ── Empty state ─────────────────────────────────────────── */
        <div className="border border-gray-200 rounded-2xl px-8 py-16 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Globe20Regular className="text-gray-400" style={{ width: 28, height: 28 }} />
          </div>
          <p className="text-sm font-semibold text-gray-900">No published triggers yet</p>
          <p className="text-xs text-gray-500 mt-1 max-w-[400px] mx-auto leading-relaxed">
            Publish your agent with at least one trigger to see distribution options here. Go to the Build page to add triggers, then publish your agent.
          </p>
        </div>
      ) : (
        /* ── Published channel cards ─────────────────────────────── */
        <div className="space-y-4">
          {publishedChannels.map(ch => {
            const displayName = CHANNEL_DISPLAY_NAMES[ch] ?? ch;
            const iconPath = CHANNEL_ICON_PATHS[ch];
            const isTeamsOrM365 = ch === 'teams' || ch === 'microsoft 365';
            const isSharePoint = ch === 'sharepoint';
            const isWhatsApp = ch === 'whatsapp';
            const distState = agentConfig.triggerDistribution?.[ch];
            // Find the trigger label from publishedTriggers for this channel
            const triggerEntry = publishedTriggers.find(t => {
              const tCh = t.iconKey === 'm365' ? 'microsoft 365' : t.iconKey;
              return tCh === ch;
            });
            const triggerLabel = triggerEntry?.label;
            // Extract just the friendly part after " — " (e.g. "Teams — When a user messages in Teams" → "When a user messages in Teams")
            const friendlyName = triggerLabel?.includes(' — ') ? triggerLabel.split(' — ')[1] : null;

            const isOpen = cardOpen[ch] ?? false;
            return (
              <div key={ch} className="border border-gray-200 rounded-2xl">
                {/* Card header — collapsible */}
                <CopilotButton
                  variant="transparent"
                  onClick={() => setCardOpen(prev => ({ ...prev, [ch]: !isOpen }))}
                  className="w-full flex items-center gap-3 px-6 py-4 text-left"
                  aria-expanded={isOpen}
                  style={{ height: 'auto', borderRadius: '1rem', justifyContent: 'flex-start', minHeight: 0 }}
                >
                  <span className="flex-shrink-0">
                    {isOpen ? <ChevronDown16Regular style={{ color: 'hsl(var(--text-secondary))' }} /> : <ChevronRight16Regular style={{ color: 'hsl(var(--text-secondary))' }} />}
                  </span>
                  {iconPath && <img src={iconPath} alt="" className="w-6 h-6 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{displayName}{friendlyName ? ` — ${friendlyName}` : ''}</p>
                  </div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded border text-[hsl(var(--status-success))] border-[#BBF7D0] bg-[#F0FFF4] flex-shrink-0">
                    Live
                  </span>
                </CopilotButton>

                {/* Card body — channel-specific distribution content */}
                {isOpen && <div className="px-6 py-5 border-t border-gray-100">
                  {isTeamsOrM365 && (
                    <DistributionSection channel={ch} agentConfig={agentConfig} appId={appId} embedded />
                  )}

                  {isSharePoint && (() => {
                    // Map stored value back to display label
                    const SHAREPOINT_SITES: Record<string, string> = {
                      'abhijeet-raj': 'Abhijeet Raj', 'contoso-engineering': 'ContosoEngineering',
                      'contoso-hr': 'Contoso HR Site', 'contoso-sales': 'Contoso Sales Team',
                      'contoso-sales-collab': 'Contoso Sales Team Collaboration',
                      'copilot-avalon': 'Copilot Studio Avalon', 'delivery-drone': 'Delivery Drone Launch',
                    };
                    const siteValue = distState?.selectedSiteValue ?? '';
                    const siteLabel = SHAREPOINT_SITES[siteValue] ?? siteValue;
                    const siteUrl = `https://contoso.sharepoint.com/sites/${siteValue}`;
                    return (
                      <div className="space-y-3">
                        {siteValue && (
                          <div className="border border-gray-200 rounded-lg">
                            <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                              <p className="text-sm font-semibold text-gray-900">Deployment Status</p>
                            </div>
                            <div className="flex items-center px-4 py-3">
                              <img src="/component-icons/SharePoint16.svg" alt="" className="w-7 h-7 flex-shrink-0" />
                              <a
                                href={siteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-gray-900 ml-3 flex-1 min-w-0 truncate hover:underline"
                              >
                                {siteLabel}
                              </a>
                              <span className="text-xs font-medium px-2 py-0.5 rounded border text-[hsl(var(--status-success))] border-[#BBF7D0] bg-[#F0FFF4] flex-shrink-0">
                                Deployed
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2 p-3 bg-[#F0F4FF] rounded-lg">
                          <Info16Regular className="text-[hsl(var(--text-secondary))] flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-[hsl(var(--text-secondary))] leading-relaxed">
                            If you would like to make this agent easily discoverable to all users of the SharePoint site, please work with the site owner to mark its status as 'Approved'.{' '}
                            <a href="#" className="text-[hsl(var(--primary))] hover:underline" onClick={e => e.preventDefault()}>Learn more</a>
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {isWhatsApp && (() => {
                    const connectedPhone = distState?.whatsappPhoneNumber;
                    return (
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs text-gray-500 leading-relaxed">
                            This channel lets users chat with your agent on WhatsApp.{' '}
                            <a href="#" className="text-[hsl(var(--primary))] hover:underline" onClick={e => e.preventDefault()}>Learn more</a>
                          </p>
                          {connectedPhone && (
                            <p className="text-xs text-gray-500 mt-1">
                              Your agent is connected to the phone number: <strong className="text-gray-900">{connectedPhone}</strong>
                            </p>
                          )}
                        </div>

                        <div className="border border-gray-200 rounded-lg p-5">
                          <p className="text-sm font-semibold text-gray-900 mb-2">Connect to your agent in WhatsApp</p>
                          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                            Download this QR code and share it with your WhatsApp users. Once they've scanned it, they'll be able to start conversations with your agent in WhatsApp.
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
                            <CopilotButton size="sm" variant="outline" icon={<ArrowDownload20Regular />}>
                              Download
                            </CopilotButton>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>}
              </div>
            );
          })}

          {/* ── Event trigger distribution — only shown when an event trigger is published ── */}
          {/* TODO: derive event trigger display name and icon from publishedTriggers
              instead of hardcoding Outlook — currently any non-conversational trigger
              renders this card even if it's SharePoint, OneDrive, etc. */}
          {publishedChannels.some(ch => !CONVERSATIONAL_CHANNEL_KEYS.has(ch)) && (
            <div className="border border-gray-200 rounded-2xl">
              <CopilotButton
                variant="transparent"
                onClick={() => setOutlookEventOpen(v => !v)}
                className="w-full flex items-center gap-3 px-6 py-4 text-left"
                aria-expanded={outlookEventOpen}
                style={{ height: 'auto', borderRadius: '1rem', justifyContent: 'flex-start', minHeight: 0 }}
              >
                <span className="flex-shrink-0">
                  {outlookEventOpen ? <ChevronDown16Regular style={{ color: 'hsl(var(--text-secondary))' }} /> : <ChevronRight16Regular style={{ color: 'hsl(var(--text-secondary))' }} />}
                </span>
                <img src="/component-icons/Outlook16.svg" alt="" className="w-6 h-6 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Outlook — When a new email arrives</p>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded border text-[hsl(var(--status-success))] border-[#BBF7D0] bg-[#F0FFF4] flex-shrink-0">
                  Live
                </span>
              </CopilotButton>
              {outlookEventOpen && <div className="px-6 py-5 space-y-5 border-t border-gray-100">
                {/* Notifications */}
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">Notifications</p>
                  <p className="text-xs text-gray-500 mb-3">When this trigger fires and the agent acts, who gets notified?</p>
                  <div className="space-y-2">
                    <CopilotCheckbox
                      defaultChecked
                      label="Notify the email sender"
                      description="Let them know the agent is processing their request"
                      className="px-3 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50"
                    />
                    <CopilotCheckbox
                      label="Post a summary to a Teams channel"
                      description="Keep your team informed of agent activity"
                      className="px-3 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50"
                    />
                  </div>
                </div>

                {/* Subscriptions */}
                <div className="border-t border-gray-100 pt-5">
                  <p className="text-sm font-semibold text-gray-900 mb-1">Subscriptions</p>
                  <p className="text-xs text-gray-500 mb-3">Let users opt-in to receive updates from this agent.</p>
                  <CopilotCheckbox
                    label="Allow users to subscribe to activity digests"
                    description="Users can opt-in to receive weekly summaries of what this agent processed"
                    className="px-3 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50"
                  />
                </div>
              </div>}
            </div>
          )}

          {/* ── Unpublished triggers section ────────────────────────── */}
          {unpublishedChannels.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Not yet published</p>
              <div className="space-y-2">
                {unpublishedChannels.map(ch => {
                  const displayName = CHANNEL_DISPLAY_NAMES[ch] ?? ch;
                  const iconPath = CHANNEL_ICON_PATHS[ch];
                  return (
                    <div key={ch} className="flex items-center gap-3 border border-dashed border-gray-200 rounded-xl px-5 py-3">
                      {iconPath && <img src={iconPath} alt="" className="w-5 h-5 flex-shrink-0 opacity-50" />}
                      <span className="text-sm text-gray-500">{displayName}</span>
                      <span className="text-xs text-gray-400 ml-auto">Publish to enable distribution</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Extend to more surfaces (Direct Line channels) ──────── */}
          <div className="mt-8">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Extend to more surfaces</h2>
            <p className="text-xs text-gray-500 mb-4 max-w-[600px] leading-relaxed">
              Connect your agent to additional platforms via Direct Line. These integrations require developer setup — share the token endpoint with your team to integrate.{' '}
              <a href="#" className="text-[hsl(var(--primary))] hover:underline" onClick={e => e.preventDefault()}>Learn more about channel configuration</a>
            </p>

            {/* Shared token endpoint */}
            <div className="border border-gray-200 rounded-2xl px-6 py-5 mb-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">Get connected</p>
                <p className="text-xs text-gray-500 mb-2">
                  Copy and provide the information below to your developers so they can use our sample code to integrate with any of the surfaces below.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Token Endpoint</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 font-mono truncate">
                    https://7e09278d0ef1e55c9a713d08590842.1d.environment.api.powerplatform.com/powervirtualagents/botsbyschema/{agentConfig.id}/directline/token
                  </div>
                  <CopilotButton
                    size="sm"
                    variant="outline"
                    onClick={() => navigator.clipboard.writeText(`https://7e09278d0ef1e55c9a713d08590842.1d.environment.api.powerplatform.com/powervirtualagents/botsbyschema/${agentConfig.id}/directline/token`)}
                  >
                    Copy
                  </CopilotButton>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                By adding a channel, you consent to your data being shared with third party systems whose data and compliance standards may differ from Microsoft's.{' '}
                <a href="#" className="text-[hsl(var(--primary))] hover:underline" onClick={e => e.preventDefault()}>Learn more in the Microsoft Privacy Statement</a>.
              </p>
            </div>

            {/* Surface grid — MCS style */}
            <div className="grid grid-cols-4 gap-3">
              {DIRECT_LINE_SURFACES.map(surface => (
                <div key={surface.id} className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors">
                  <img src={surface.icon} alt="" className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm text-gray-900">{surface.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};
