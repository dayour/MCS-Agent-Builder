import React, { useState } from 'react';
import { CopilotButton } from './CopilotButton';
import { CopilotDropdown } from './CopilotDropdown';
import { Dismiss20Regular, Globe20Regular } from '@fluentui/react-icons';
import { M365Icon, SlackIcon, SharePointIcon, WhatsAppIcon } from './ChannelIcons';
import { getConnectorIcon } from '../../utils/agentIcons';
import { Flash20Regular } from '@fluentui/react-icons';
import { getTriggerChannel } from '../../utils/buildPageUtils';

export interface TriggerSummary {
  iconKey: string;
  label: string;
}

export interface PublishConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedChannel?: string) => void;
  agentName: string;
  agentType: 'agent' | 'workflow';
  /** When true, restricts publish channels to Microsoft 365 only (AI Teammates). */
  isDigitalWorker?: boolean;
  channel?: string;
  /** Triggers parsed from the agent's instructions — displayed as "Your agent will run when..." */
  triggers?: TriggerSummary[];
  /** Trigger names pending soft-delete — shown with REMOVING badge */
  softDeletedTriggers?: string[];
  buttonRef: React.RefObject<HTMLDivElement | null>;
}

export const PublishConfirmDialog: React.FC<PublishConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  agentName,
  agentType,
  isDigitalWorker,
  channel,
  triggers,
  softDeletedTriggers,
  buttonRef
}) => {
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const DIALOG_WIDTH = 360;
  const [selectedChannel, setSelectedChannel] = useState(channel || 'Microsoft 365');

  // Sync selectedChannel with channel prop when dialog opens or channel changes
  React.useEffect(() => {
    if (isOpen && channel) {
      setSelectedChannel(channel);
    }
  }, [isOpen, channel]);

  const allChannelOptions = [
    {
      label: 'Microsoft 365',
      value: 'Microsoft 365',
      icon: <M365Icon />,
      description: 'Available in Copilot and Teams chats'
    },
    {
      label: 'Web',
      value: 'Web',
      icon: <Globe20Regular />,
      description: 'Shareable web link for anyone to use'
    },
    {
      label: 'Slack',
      value: 'Slack',
      icon: <SlackIcon />,
      description: 'Chat in Slack channels and DMs'
    },
    {
      label: 'SharePoint',
      value: 'SharePoint',
      icon: <SharePointIcon />,
      description: 'Embed in SharePoint pages and portals'
    },
    {
      label: 'WhatsApp',
      value: 'WhatsApp',
      icon: <WhatsAppIcon />,
      description: 'Message customers via WhatsApp'
    }
  ];

  const channelOptions = isDigitalWorker
    ? allChannelOptions.filter(o => o.value === 'Microsoft 365')
    : allChannelOptions;

  const dialogRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const estimatedHeight = 320;
      const gap = 8;
      const margin = 16;
      const topBelow = rect.bottom + gap;
      const fitsBelow = topBelow + estimatedHeight <= viewportHeight - margin;
      const left = Math.max(margin, Math.min(rect.left, viewportWidth - DIALOG_WIDTH - margin));
      setPosition({
        top: fitsBelow ? topBelow : Math.max(margin, rect.top - estimatedHeight - gap),
        left,
      });
    }
  }, [isOpen, buttonRef]);

  // Refine position after render using actual dialog height (one-shot to prevent infinite loop)
  const refinedRef = React.useRef(false);
  React.useLayoutEffect(() => {
    if (isOpen && position && dialogRef.current && buttonRef.current && !refinedRef.current) {
      const dialogHeight = dialogRef.current.getBoundingClientRect().height;
      const viewportHeight = window.innerHeight;
      if (position.top + dialogHeight > viewportHeight - 16) {
        refinedRef.current = true;
        const rect = buttonRef.current.getBoundingClientRect();
        setPosition(prev => prev ? {
          ...prev,
          top: Math.max(16, rect.top - dialogHeight - 8)
        } : prev);
      }
    }
    if (!isOpen) refinedRef.current = false;
  }, [isOpen, position, buttonRef]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        const dialogElement = document.getElementById('publish-confirm-dialog');
        if (dialogElement && !dialogElement.contains(event.target as Node)) {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose, buttonRef]);

  if (!isOpen || !position) return null;

  return (
    <div
      ref={dialogRef}
      id="publish-confirm-dialog"
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${DIALOG_WIDTH}px`
      }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">
            Publish {agentType === 'workflow' ? 'workflow' : 'agent'}?
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Dismiss20Regular />
          </button>
        </div>

        <div className="space-y-3 mb-4">
          <p className="text-sm text-gray-600">
            You're about to publish <span className="font-semibold text-gray-900">{agentName}</span>.
            {triggers && triggers.length > 0
              ? ' Once published, your agent will run when:'
              : ' Once published, it will be live and available for use.'}
          </p>

          {/* Trigger list */}
          {triggers && triggers.length > 0 ? (
            <div className="space-y-1.5">
              {triggers.map((t, i) => {
                const isSoftDeleted = (softDeletedTriggers ?? []).some(sd => {
                  const sdCh = getTriggerChannel(sd);
                  const tCh = getTriggerChannel(t.label) || t.iconKey;
                  return sdCh && tCh && sdCh === tCh;
                });
                if (isSoftDeleted) {
                  return (
                    <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-red-200 bg-red-50 opacity-60">
                      {getConnectorIcon(t.iconKey, 'w-5 h-5') || <Flash20Regular style={{ width: 20, height: 20, color: 'hsl(var(--text-secondary))' }} />}
                      <span className="text-sm text-gray-500 flex-1 line-through">{t.label}</span>
                      <span className="text-xs font-medium text-red-700 bg-red-100 px-1.5 py-0.5 rounded">REMOVING</span>
                    </div>
                  );
                }
                return (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50">
                    {getConnectorIcon(t.iconKey, 'w-5 h-5') || <Flash20Regular style={{ width: 20, height: 20, color: 'hsl(var(--text-secondary))' }} />}
                    <span className="text-sm text-gray-900">{t.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Fallback: Channel Selector (no triggers parsed) */
            <div>
              <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">
                Publish to
              </label>
              {isDigitalWorker ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50">
                  <M365Icon />
                  <div>
                    <div className="text-sm text-gray-900">Microsoft 365</div>
                    <div className="text-xs text-gray-500">Available in Copilot and Teams chats</div>
                  </div>
                </div>
              ) : (
                <CopilotDropdown
                  options={channelOptions}
                  value={selectedChannel}
                  onChange={setSelectedChannel}
                  size="md"
                  variant="form-field"
                />
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <CopilotButton
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Cancel
          </CopilotButton>
          <CopilotButton
            variant="primary"
            size="sm"
            onClick={() => onConfirm(isDigitalWorker ? 'Microsoft 365' : selectedChannel)}
          >
            Publish
          </CopilotButton>
        </div>
      </div>
    </div>
  );
};
