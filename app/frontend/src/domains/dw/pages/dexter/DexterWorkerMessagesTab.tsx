import React, { useState } from 'react';
import { LockClosed20Regular } from '@fluentui/react-icons';
import { getConnectorIcon } from '../../../../utils/agentIcons';
import { DWMessageDetailPanel, MessageDetail, MessageDetailType } from '../../components/DWMessageDetailPanel';
import { CopilotFilterPill } from '../../../../components/ui/CopilotFilterPill';

// ── Types ─────────────────────────────────────────────────────────────────────

type MessageType = 'chat' | 'email' | 'meeting';

interface MessageItem {
  id: string;
  personName: string;
  personInitials: string;
  personColor: string;
  /** e.g. "in chat", "via email", "in meeting" */
  contextLabel: string;
  timestamp: string;
  /** connector key for icon: 'teams' | 'outlook' */
  sourceKey: string;
  /** e.g. "Teams · Conversation in Agent Schema future meeting" */
  sourceContext: string;
  /** short preview of the message text */
  preview: string;
  detailType: MessageDetailType;
  type: MessageType;
}

// ── Sample data ───────────────────────────────────────────────────────────────

const SAMPLE_MESSAGES: MessageItem[] = [
  {
    id: 'm1',
    personName: 'Sarah Critchley',
    personInitials: 'SC',
    personColor: '#0F6CBD',
    contextLabel: 'in chat',
    timestamp: '48 minutes ago',
    sourceKey: 'teams',
    sourceContext: 'Teams · Conversation in Agent Schema future meeting',
    preview: 'Could you drop the deck in Foundry Copilot Studio Cohort_Accelerator...',
    detailType: 'chat',
    type: 'chat',
  },
  {
    id: 'm2',
    personName: 'Soufiane Loukili',
    personInitials: 'SL',
    personColor: '#107954',
    contextLabel: 'in chat',
    timestamp: 'Yesterday',
    sourceKey: 'teams',
    sourceContext: 'Teams · Conversation with Soufiane Loukili, Zubeir Mohamed +1 others',
    preview: 'Mads Bolaris Soufiane script.docx — script',
    detailType: 'chat',
    type: 'chat',
  },
  {
    id: 'm3',
    personName: 'Erika Fuller',
    personInitials: 'EF',
    personColor: '#C43E1C',
    contextLabel: 'via email',
    timestamp: '5 hours ago',
    sourceKey: 'outlook',
    sourceContext: 'Teams · IDNA App Platform & Friends · Updated Auth Flows for MCS Agents',
    preview: 'I love this. Add a "learn more" link and then I\'d think it\'d be perfect',
    detailType: 'email',
    type: 'email',
  },
  {
    id: 'm4',
    personName: 'Allan Deyoung',
    personInitials: 'AD',
    personColor: '#8764B8',
    contextLabel: 'in meeting',
    timestamp: 'Yesterday',
    sourceKey: 'teams',
    sourceContext: 'Teams · Woodgrove Bank Integration Sync — Weekly Standup',
    preview: 'Thank you everyone for joining today. We\'ll start in a moment.',
    detailType: 'meeting',
    type: 'meeting',
  },
  {
    id: 'm5',
    personName: 'Charlotte de Crum',
    personInitials: 'CC',
    personColor: '#CA5010',
    contextLabel: 'via email',
    timestamp: '2 days ago',
    sourceKey: 'outlook',
    sourceContext: 'Outlook · Re: First Time Buyers — Q&A Infographic Request',
    preview: 'Can you create an infographic that summarises the First Time Buyer eligibility criteria?',
    detailType: 'email',
    type: 'email',
  },
  {
    id: 'm6',
    personName: 'Alex Wilber',
    personInitials: 'AW',
    personColor: '#498205',
    contextLabel: 'in meeting',
    timestamp: '3 days ago',
    sourceKey: 'teams',
    sourceContext: 'Teams · Virtual Fences Feature Review — Sprint 24',
    preview: 'I have one — what have we changed about virtual fences?',
    detailType: 'meeting',
    type: 'meeting',
  },
  {
    id: 'm7',
    personName: 'Zubeir Mohamed',
    personInitials: 'ZM',
    personColor: '#038387',
    contextLabel: 'in chat',
    timestamp: '4 days ago',
    sourceKey: 'teams',
    sourceContext: 'Teams · IDNA App Platform & Friends',
    preview: 'Can you pull the latest supplier list from SharePoint and flag any with expiring contracts?',
    detailType: 'chat',
    type: 'chat',
  },
];

// ── Filter config ─────────────────────────────────────────────────────────────

const TYPE_FILTERS: { label: string; value: MessageType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Group chats', value: 'chat' },
  { label: 'Email threads', value: 'email' },
  { label: 'Meeting transcripts', value: 'meeting' },
];

// ── Person avatar ─────────────────────────────────────────────────────────────

const PersonAvatar: React.FC<{ initials: string; color: string }> = ({ initials, color }) => (
  <div
    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
    style={{ backgroundColor: color }}
  >
    {initials}
  </div>
);

// ── Message row ───────────────────────────────────────────────────────────────

const MessageRow: React.FC<{ msg: MessageItem; onClick: () => void }> = ({ msg, onClick }) => (
  <div
    onClick={onClick}
    className="flex items-start gap-3 px-3 py-3.5 rounded-lg hover:bg-[hsl(var(--surface-tertiary))] transition-colors cursor-pointer"
  >
    <PersonAvatar initials={msg.personInitials} color={msg.personColor} />

    <div className="flex-1 min-w-0">
      {/* Name + context label + timestamp */}
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-sm font-semibold text-[#0F6CBD]">
          {msg.personName} {msg.contextLabel}
        </span>
        <span className="text-sm text-[hsl(var(--text-secondary))]">{msg.timestamp}</span>
      </div>

      {/* Source icon + context */}
      <div className="flex items-center gap-1.5 mt-0.5">
        {getConnectorIcon(msg.sourceKey, 'w-3.5 h-3.5')}
        <span className="text-xs text-[hsl(var(--text-secondary))] truncate">{msg.sourceContext}</span>
      </div>

      {/* Preview */}
      <p className="text-sm text-[hsl(var(--text-secondary))] mt-1 truncate">{msg.preview}</p>
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

export const DexterWorkerMessagesTab: React.FC = () => {
  const [activeType, setActiveType] = useState<MessageType | 'all'>('all');
  const [selected, setSelected] = useState<MessageDetail | null>(null);

  if (selected) {
    return <DWMessageDetailPanel message={selected} onBack={() => setSelected(null)} />;
  }

  const filtered =
    activeType === 'all' ? SAMPLE_MESSAGES : SAMPLE_MESSAGES.filter((m) => m.type === activeType);

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-3 flex-wrap">
        <span className="text-sm text-[hsl(var(--text-secondary))] mr-1">Filters</span>
        {TYPE_FILTERS.map((f) => (
          <CopilotFilterPill
            key={f.value}
            label={f.label}
            active={activeType === f.value}
            onClick={() => setActiveType(f.value)}
            size="sm"
          />
        ))}
      </div>

      {/* Access notice */}
      <div className="flex items-center gap-1.5 px-3">
        <LockClosed20Regular className="w-4 h-4 text-[hsl(var(--text-secondary))] flex-shrink-0" />
        <span className="text-xs text-[hsl(var(--text-secondary))]">
          Only including results you can access.{' '}
          <span className="text-[#0F6CBD] cursor-pointer hover:underline">Learn more</span>
        </span>
      </div>

      {/* Message list */}
      <div>
        {filtered.length === 0 ? (
          <p className="text-sm text-[hsl(var(--text-secondary))] px-3 py-6 text-center">No messages of this type yet.</p>
        ) : (
          filtered.map((msg) => (
            <MessageRow
              key={msg.id}
              msg={msg}
              onClick={() =>
                setSelected({
                  id: msg.id,
                  title: `${msg.personName} ${msg.contextLabel}`,
                  subtitle: msg.sourceContext,
                  source: msg.sourceKey,
                  timestamp: msg.timestamp,
                  detailType: msg.detailType,
                })
              }
            />
          ))
        )}
      </div>
    </div>
  );
};
