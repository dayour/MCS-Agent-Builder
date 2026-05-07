import React, { useState } from 'react';
import { useAgent } from '../../../context/AgentContext';
import { useDW, type DwTabKey } from '../context/DWContext';
import { useSharedDexterWorkerProfile } from '../../../context/DexterWorkerProfileContext';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { CopilotBadge } from '../../../components/ui/CopilotBadge';
import { CopilotMenu, CopilotMenuPosition } from '../../../components/ui/CopilotMenu';
import { CopilotUnderlineTabs } from '../../../components/ui/CopilotUnderlineTabs';
import { AgentIcon } from '../../../components/ui/AgentIcon';
import { EditableIcon } from '../../../components/ui/EditableIcon';
import { ClaudeOpusIcon, ClaudeSonnetIcon, ClaudeHaikuIcon } from '../../../components/ui/ClaudeModelIcons';
import { openTeamsChat } from '../../../utils/openTeamsChat';
import {
  Chat20Regular,
  Chat20Filled,
  Mail20Regular,
  Mail20Filled,
  Share20Regular,
  Share20Filled,
  MoreHorizontal20Regular,
  MoreHorizontal20Filled,
  PanelLeftContract24Regular,
  PanelLeftExpand24Regular,
  Settings20Regular,
  Delete20Regular,
  ArrowReset20Regular,
  ShieldTask20Regular,
} from '@fluentui/react-icons';

const DW_TABS: { label: string; value: DwTabKey }[] = [
  { label: 'Overview', value: 'overview' },
  { label: 'Tasks', value: 'tasks' },
  { label: 'Files', value: 'content' },
  { label: 'Messages', value: 'messages' },
  { label: 'Expertise', value: 'knowledge' },
  { label: 'Organization', value: 'organization' },
];

export interface DWBuildHeaderProps {
  /** Called when user clicks the icon edit button */
  onEditIcon: () => void;
  /** Called when user selects Settings from the more menu */
  onSettings: () => void;
  /** Called when user selects Delete from the more menu */
  onDelete: () => void;
  /** Called when user selects Reset to Day 0 from the more menu */
  onResetDay0: () => void;
}

export const DWBuildHeader: React.FC<DWBuildHeaderProps> = ({
  onEditIcon,
  onSettings,
  onDelete,
  onResetDay0,
}) => {
  const {
    agentConfig,
    updateAgentConfig,
    updateWithHistory,
    markManualDirty,
    isAgentGlobalUndo,
    isHelperCollapsed,
    toggleHelperCollapsed,
  } = useAgent();
  const { dwTab, setDwTab, isDexter, tenantDomain } = useDW();
  const dwProfile = useSharedDexterWorkerProfile();

  const [isEditingDwName, setIsEditingDwName] = useState(false);
  const [dwNameDraft, setDwNameDraft] = useState('');
  const [dwMoreMenuPos, setDwMoreMenuPos] = useState<CopilotMenuPosition | null>(null);

  return (
    <div className="bg-white flex-shrink-0">
      {/* Metadata row */}
      <div className="max-w-[1024px] w-full mx-auto flex items-start justify-between gap-6 px-8 pt-7 pb-1">
        {/* Left: icon + info */}
        <div className="flex items-start gap-5">
          <EditableIcon size={88} rounded onEdit={onEditIcon}>
            <AgentIcon agent={agentConfig} size={88} rounded />
          </EditableIcon>
          <div className="flex flex-col gap-1 min-w-0 flex-1 -mt-1">
            {isEditingDwName ? (
              <CopilotInput
                value={dwNameDraft}
                onChange={e => setDwNameDraft(e.target.value)}
                onBlur={() => {
                  const trimmed = dwNameDraft.trim();
                  if (trimmed && trimmed !== agentConfig.name) {
                    if (isAgentGlobalUndo) {
                      updateWithHistory({ name: trimmed });
                    } else {
                      updateAgentConfig({ name: trimmed });
                      markManualDirty();
                    }
                  }
                  setIsEditingDwName(false);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') { setIsEditingDwName(false); }
                }}
                size="lg"
                autoFocus
                className="text-2xl font-bold w-64"
              />
            ) : (
              <h1
                className="text-2xl font-bold text-gray-900 leading-8 cursor-pointer hover:text-[#0F6CBD] transition-colors"
                onClick={() => { setDwNameDraft(agentConfig.name || ''); setIsEditingDwName(true); }}
                title="Click to rename"
              >
                {agentConfig.name || 'AI Teammate'}
              </h1>
            )}
            {/* Role + email subtitle */}
            <p className="text-sm text-gray-500 truncate max-w-full min-h-[20px] mt-1">
              {(dwProfile.jobTitle || agentConfig.role) && (
                <>{dwProfile.jobTitle || agentConfig.role}{' '}<span className="font-bold">·</span>{' '}</>
              )}
              {(() => {
                const email = dwProfile.email || `${(agentConfig.name || 'ai.teammate').toLowerCase().replace(/\s+/g, '.')}@${tenantDomain}`;
                return (
                  <a
                    href={`https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(email)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline hover:text-[#0F6CBD] transition-colors"
                  >
                    {email}
                  </a>
                );
              })()}
            </p>
            {/* Action row */}
            <div className="flex items-center gap-1 -ml-2">
              <div className="group">
                <CopilotButton
                  variant="transparent"
                  size="md"
                  icon={<Chat20Regular />}
                  iconFilled={<Chat20Filled />}
                  onClick={() => openTeamsChat(dwProfile, agentConfig)}
                  aria-label="Chat in Teams"
                />
              </div>
              <CopilotButton
                variant="transparent"
                size="md"
                icon={<Mail20Regular />}
                iconFilled={<Mail20Filled />}
                onClick={() => {
                  const email = dwProfile.email || `${agentConfig.name?.toLowerCase().replace(/\s+/g, '.')}@${tenantDomain}`;
                  window.open(`https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(email)}`, '_blank');
                }}
                aria-label="Email"
              />
              <CopilotButton
                variant="transparent"
                size="md"
                icon={<Share20Regular />}
                iconFilled={<Share20Filled />}
                aria-label="Share"
              />
              <CopilotButton
                variant="transparent"
                size="md"
                icon={<MoreHorizontal20Regular />}
                iconFilled={<MoreHorizontal20Filled />}
                aria-label="More options"
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setDwMoreMenuPos({ top: rect.bottom + 6, left: rect.left });
                }}
              />
              {dwMoreMenuPos && (
                <CopilotMenu
                  position={dwMoreMenuPos}
                  onClose={() => setDwMoreMenuPos(null)}
                  items={[
                    {
                      label: isHelperCollapsed ? 'Show chat' : 'Hide chat',
                      icon: isHelperCollapsed
                        ? <PanelLeftExpand24Regular className="w-4 h-4" />
                        : <PanelLeftContract24Regular className="w-4 h-4" />,
                      onClick: () => { toggleHelperCollapsed(); setDwMoreMenuPos(null); },
                    },
                    ...(isDexter && agentConfig.dexterWorkerId ? [{
                      label: 'Admin view',
                      icon: <ShieldTask20Regular className="w-4 h-4" />,
                      onClick: () => {
                        window.open(`#/dexter-machines/${agentConfig.dexterWorkerId}`, '_blank');
                        setDwMoreMenuPos(null);
                      },
                    }] : []),
                    {
                      label: 'Settings',
                      icon: <Settings20Regular className="w-4 h-4" />,
                      onClick: () => { onSettings(); setDwMoreMenuPos(null); },
                    },
                    {
                      label: 'Reset to Day 0',
                      icon: <ArrowReset20Regular />,
                      onClick: () => { onResetDay0(); setDwMoreMenuPos(null); },
                    },
                    {
                      label: 'Delete',
                      icon: <Delete20Regular className="w-4 h-4" />,
                      onClick: () => { onDelete(); setDwMoreMenuPos(null); },
                      destructive: true,
                    },
                  ]}
                />
              )}
            </div>
          </div>
        </div>
        {/* Right: model tag */}
        <div className="flex items-center gap-2 flex-shrink-0 pt-1">
          <CopilotBadge
            appearance="outline"
            color="subtle"
            icon={
              agentConfig.model?.includes('opus')
                ? <ClaudeOpusIcon size={14} />
                : agentConfig.model?.includes('haiku')
                ? <ClaudeHaikuIcon size={14} />
                : <ClaudeSonnetIcon size={14} />
            }
          >
            {agentConfig.model?.includes('opus')
              ? 'Claude Opus 4.5'
              : agentConfig.model?.includes('haiku')
              ? 'Claude Haiku 4.5'
              : 'Claude Sonnet 4.5'}
          </CopilotBadge>
        </div>
      </div>
      {/* Tab bar */}
      <div className="max-w-[1024px] w-full mx-auto px-8 relative z-10">
        <CopilotUnderlineTabs
          tabs={DW_TABS}
          value={dwTab}
          onChange={(v) => setDwTab(v as DwTabKey)}
          className="-ml-[10px]"
        />
      </div>
    </div>
  );
};
