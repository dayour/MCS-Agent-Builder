import React, { useState, useEffect } from 'react';
import { Attach16Regular } from '@fluentui/react-icons';
import { getConnectorIcon } from '../../../utils/agentIcons';
import { openTeamsChat } from '../../../utils/openTeamsChat';
import { useAgent } from '../../../context/AgentContext';
import { useDW } from '../context/DWContext';
import { useSharedDexterWorkerProfile } from '../../../context/DexterWorkerProfileContext';
import { CopilotFilterPill } from '../../../components/ui/CopilotFilterPill';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotTooltip } from '../../../components/ui/CopilotTooltip';
import { formatDwDate } from '../utils/dwDateUtils';
import { DWSortIcon } from './DWSortIcon';
import { DWMessageDetailPanel, MessageDetail, MessageDetailType, FileTypeIcon } from './DWMessageDetailPanel';
import { DeliverableFileProp } from './DWArtifactDetailPanel';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Avatar {
  initials: string;
  color: string;
}

interface MessageItem {
  id: string;
  title: string;
  subtitle: string;
  source: string;
  timestamp: string;
  date: string; // ISO for sorting
  avatars: Avatar[];
  overflow?: number;
  detailType: MessageDetailType;
  files?: DeliverableFileProp[];
}

// ── Sample data ───────────────────────────────────────────────────────────────

const SAMPLE_MESSAGES: MessageItem[] = [
  {
    id: 'm1',
    title: 'Q1 compliance audit report submitted to legal.',
    subtitle: 'All evidence packages are attached and ready for review.',
    source: 'outlook',
    timestamp: '2 minutes ago',
    date: '2026-03-25T11:58:00',
    avatars: [
      { initials: 'PN', color: '#8764B8' },
      { initials: 'JO', color: '#0F6CBD' },
    ],
    detailType: 'email',
    files: [
      { id: 'h11-0', name: 'Data Handling Policy v3.2.docx',       type: 'document',    app: 'word',       location: 'Compliance > Policies',    actionText: 'Open in Word',       owner: 'Priya Nair',   url: '/demo-files/sample-document.docx' },
      { id: 'h11-1', name: 'Compliance Checklist Q1 2026.xlsx',    type: 'spreadsheet', app: 'excel',      location: 'Compliance > Checklists',  actionText: 'Open in Excel',      owner: 'Priya Nair',   url: '/demo-files/compliance-checklist.xlsx' },
      { id: 'h11-2', name: 'Audit Evidence — Access Controls.pdf', type: 'document',    app: 'sharepoint', location: 'Compliance > Evidence',    actionText: 'View in SharePoint', owner: 'James Okafor', url: '/demo-files/audit-evidence.pdf' },
    ],
  },
  {
    id: 'm2',
    title: 'Q2 roadmap priorities — alignment check with Lydia.',
    subtitle: 'Summarized open items and flagged two decisions needed by EOW.',
    source: 'teams',
    timestamp: '18 minutes ago',
    date: '2026-03-25T11:42:00',
    avatars: [
      { initials: 'LB', color: '#CA5010' },
      { initials: 'MW', color: '#107954' },
    ],
    detailType: 'chat',
  },
  {
    id: 'm3',
    title: 'Weekly standup — March 23',
    subtitle: 'Transcript and action items captured from this morning\'s standup.',
    source: 'teams',
    timestamp: '1 hour ago',
    date: '2026-03-25T11:00:00',
    avatars: [
      { initials: 'SL', color: '#498205' },
      { initials: 'MR', color: '#C43E1C' },
      { initials: 'JO', color: '#0F6CBD' },
    ],
    overflow: 2,
    detailType: 'meeting',
  },
  {
    id: 'm4',
    title: 'Vendor risk assessments complete — 2 items flagged.',
    subtitle: 'Zoom and Jira reviews finished; findings sent to James for sign-off.',
    source: 'outlook',
    timestamp: '2 hours ago',
    date: '2026-03-25T10:00:00',
    avatars: [
      { initials: 'JO', color: '#0F6CBD' },
      { initials: 'PN', color: '#8764B8' },
    ],
    detailType: 'email',
    files: [
      { id: 'h11-4', name: 'Vendor Risk Matrix.xlsx', type: 'spreadsheet', app: 'excel', location: 'Compliance > Risk', actionText: 'Open in Excel', owner: 'James Okafor', url: '/demo-files/vendor-risk-matrix.xlsx' },
    ],
  },
  {
    id: 'm5',
    title: 'M365 Copilot adoption — March metrics ready.',
    subtitle: 'Usage up 18% WoW. Drafted a summary for the leadership update.',
    source: 'teams',
    timestamp: '3 hours ago',
    date: '2026-03-25T09:00:00',
    avatars: [
      { initials: 'LB', color: '#CA5010' },
      { initials: 'MW', color: '#107954' },
      { initials: 'SL', color: '#498205' },
    ],
    detailType: 'chat',
  },
  {
    id: 'm6',
    title: 'Onboarding package sent to new hire — Riley Chen.',
    subtitle: 'Day 1 checklist, tool access requests, and welcome note delivered.',
    source: 'outlook',
    timestamp: 'Yesterday, 4:32 PM',
    date: '2026-03-24T09:30:00',
    avatars: [
      { initials: 'RC', color: '#038387' },
      { initials: 'SL', color: '#498205' },
    ],
    detailType: 'email',
    files: [
      { id: 'd8', name: 'Onboarding Checklist.docx', type: 'document', app: 'word', location: 'HR > Onboarding', actionText: 'Open in Word', owner: 'Sophie Laurent', url: '/demo-files/onboarding-checklist.docx' },
    ],
  },
  {
    id: 'm7',
    title: 'Security awareness training — 9 employees still outstanding.',
    subtitle: 'Sent reminders to all 9 with a March 31 deadline noted.',
    source: 'teams',
    timestamp: 'Yesterday, 2:05 PM',
    date: '2026-03-24T08:00:00',
    avatars: [
      { initials: 'MR', color: '#C43E1C' },
      { initials: 'PN', color: '#8764B8' },
    ],
    detailType: 'chat',
    files: [
      { id: 'h11-5', name: 'Training Completion Report.csv', type: 'spreadsheet', app: 'excel', location: 'Compliance > Training', actionText: 'Open in Excel', owner: 'Sophie Laurent', url: '/demo-files/training-completion.csv' },
    ],
  },
  {
    id: 'm8',
    title: 'AI Teammate capability review with Lydia — Mar 21',
    subtitle: 'Reviewed 100-day progress. Three expansion areas scoped for Q2.',
    source: 'teams',
    timestamp: 'Mar 21, 10:00 AM',
    date: '2026-03-21T10:00:00',
    avatars: [
      { initials: 'LB', color: '#CA5010' },
      { initials: 'MW', color: '#107954' },
    ],
    detailType: 'meeting',
  },
  {
    id: 'm9',
    title: 'Stakeholder meeting follow-up — EMEA expansion approved.',
    subtitle: 'Circulated updated roadmap and next-steps summary to all attendees.',
    source: 'outlook',
    timestamp: 'Mar 20, 3:15 PM',
    date: '2026-03-20T15:15:00',
    avatars: [
      { initials: 'LB', color: '#CA5010' },
      { initials: 'JO', color: '#0F6CBD' },
    ],
    detailType: 'email',
    files: [
      { id: 'd12', name: 'Stakeholder Meeting Notes — Mar 10.docx',                     type: 'document',     app: 'word',       location: 'Strategy > Meetings', actionText: 'Open in Word',       owner: 'Avery Fuller', url: '/demo-files/stakeholder-notes.docx' },
      { id: 'd1',  name: '[Internal] M365 Companion — Copilot Value Walking Deck.pptx', type: 'presentation', app: 'powerpoint', location: 'Strategy > Decks',    actionText: 'Open in PowerPoint', owner: 'Avery Fuller', url: '/demo-files/copilot-value-deck.pptx' },
    ],
  },
];

// ── Stacked avatars ───────────────────────────────────────────────────────────

const AvatarStack: React.FC<{ avatars: Avatar[]; overflow?: number }> = ({ avatars, overflow }) => {
  const visible = avatars.slice(0, 3);
  const total = visible.length + (overflow ? 1 : 0);
  return (
    <div className="flex items-center" style={{ width: total * 20 + 8 }}>
      {visible.map((av, i) => (
        <div
          key={i}
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold border-2 border-white flex-shrink-0"
          style={{ backgroundColor: av.color, marginLeft: i === 0 ? 0 : -8, zIndex: visible.length - i }}
        >
          {av.initials}
        </div>
      ))}
      {overflow !== undefined && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center bg-[hsl(var(--surface-quaternary))] text-[hsl(var(--text-secondary))] text-[10px] font-semibold border-2 border-white flex-shrink-0"
          style={{ marginLeft: -8, zIndex: 0 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
};

// ── Sort column type ──────────────────────────────────────────────────────────

type MsgSortCol = 'title' | 'date' | 'source';

// ── Filter counts (hoisted — SAMPLE_MESSAGES is a constant) ──────────────────

const MSG_COUNT_ALL   = SAMPLE_MESSAGES.length;
const MSG_COUNT_EMAIL = SAMPLE_MESSAGES.filter(m => m.source === 'outlook').length;
const MSG_COUNT_TEAMS = SAMPLE_MESSAGES.filter(m => m.source === 'teams').length;

// ── Main component ────────────────────────────────────────────────────────────

type MessageFilter = 'all' | 'email' | 'chat';

export const DWMessagesTab: React.FC = () => {

  const { agentConfig } = useAgent();
  const { isAiTeammateDay100, dwMessageFilter, setDwMessageFilter } = useDW();
  const dwProfile = useSharedDexterWorkerProfile();
  const [selected, setSelected] = useState<MessageDetail | null>(null);
  const [activeFilter, setActiveFilter] = useState<MessageFilter>('all');
  const [sortCol, setSortCol] = useState<MsgSortCol>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function handleSort(col: MsgSortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir(col === 'date' ? 'desc' : 'asc'); }
  }

  const handleOpenInTeams = () => openTeamsChat(dwProfile, agentConfig);

  useEffect(() => {
    if (!dwMessageFilter) return;
    setActiveFilter(dwMessageFilter as MessageFilter);
    setDwMessageFilter(null);
  }, [dwMessageFilter, setDwMessageFilter]);

  if (!isAiTeammateDay100) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
        <p className="text-sm font-semibold text-[hsl(var(--text-primary))] mb-1">No messages yet</p>
        <p className="text-sm text-[hsl(var(--text-secondary))] max-w-xs">Add this AI Teammate to your team to start seeing emails, chats, and channel messages here.</p>
      </div>
    );
  }

  if (selected) {
    return (
      <div className="flex-1 overflow-y-auto">
        <DWMessageDetailPanel message={selected} onBack={() => setSelected(null)} />
      </div>
    );
  }

  const filteredMessages = SAMPLE_MESSAGES.filter(msg => {
    if (activeFilter === 'email') return msg.source === 'outlook';
    if (activeFilter === 'chat') return msg.source === 'teams';
    return true;
  });

  const sortedMessages = [...filteredMessages].sort((a, b) => {
    if (sortCol === 'date') {
      const cmp = new Date(b.date).getTime() - new Date(a.date).getTime();
      return sortDir === 'desc' ? cmp : -cmp;
    }
    if (sortCol === 'source') {
      const cmp = a.source.localeCompare(b.source);
      return sortDir === 'asc' ? cmp : -cmp;
    }
    const cmp = a.title.localeCompare(b.title);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          <CopilotFilterPill label="All" count={MSG_COUNT_ALL} active={activeFilter === 'all'} onClick={() => setActiveFilter('all')} size="sm" />
          <CopilotFilterPill label="Email" count={MSG_COUNT_EMAIL} active={activeFilter === 'email'} onClick={() => setActiveFilter('email')} size="sm" icon={getConnectorIcon('outlook', 'w-4 h-4') ?? undefined} activeClassName="bg-[#EFF6FC] text-[#0072C6] border border-[#0072C6]" />
          <CopilotFilterPill label="Teams" count={MSG_COUNT_TEAMS} active={activeFilter === 'chat'} onClick={() => setActiveFilter('chat')} size="sm" icon={getConnectorIcon('teams', 'w-4 h-4') ?? undefined} activeClassName="bg-[#F3F2FC] text-[#6264A7] border border-[#6264A7]" />
        </div>
        <CopilotButton variant="outline" size="sm" icon={getConnectorIcon('teams', 'w-4 h-4') ?? undefined} onClick={handleOpenInTeams}>
          Chat with {agentConfig.name?.split(' ')[0] || agentConfig.name}
        </CopilotButton>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="w-full border border-[hsl(var(--stroke-default))] rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
        {/* Column headers */}
        <div
          className="grid text-xs font-semibold text-[hsl(var(--text-secondary))] border-b border-[hsl(var(--stroke-default))] py-3.5 flex-shrink-0"
          style={{ gridTemplateColumns: '1fr 200px 130px 140px' }}
        >
          <CopilotButton variant="transparent" size="sm" className="w-full !h-auto !pl-[52px] !pr-3 !rounded-none !justify-start !text-xs !text-[hsl(var(--text-secondary))] hover:!text-[hsl(var(--text-primary))]" onClick={() => handleSort('title')}>
            Message<DWSortIcon col="title" sortCol={sortCol} sortDir={sortDir} />
          </CopilotButton>
          <CopilotButton variant="transparent" size="sm" className="w-full !h-auto !px-3 !rounded-none !justify-start !text-xs !text-[hsl(var(--text-secondary))] hover:!text-[hsl(var(--text-primary))]" onClick={() => handleSort('date')}>
            Date<DWSortIcon col="date" sortCol={sortCol} sortDir={sortDir} />
          </CopilotButton>
          <CopilotButton variant="transparent" size="sm" className="w-full !h-auto !px-3 !rounded-none !justify-start !text-xs !text-[hsl(var(--text-secondary))] hover:!text-[hsl(var(--text-primary))]" onClick={() => handleSort('source')}>
            Source<DWSortIcon col="source" sortCol={sortCol} sortDir={sortDir} />
          </CopilotButton>
          <div className="px-3 pr-6">People</div>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto">
        {sortedMessages.map((msg, idx) => {
          const isLast = idx === sortedMessages.length - 1;
          return (
            <div
              key={msg.id}
              onClick={() => setSelected({ id: msg.id, title: msg.title, subtitle: msg.subtitle, source: msg.source, timestamp: msg.timestamp, detailType: msg.detailType, files: msg.files })}
              className="group grid hover:bg-[hsl(var(--surface-secondary))] transition-colors cursor-pointer relative"
              style={{ gridTemplateColumns: '1fr 200px 130px 140px' }}
            >
              {!isLast && <div className="absolute bottom-0 left-0 right-0 h-px bg-[hsl(var(--stroke-default))]" />}

              {/* Message — icon + title + subtitle + optional file chip */}
              <div className="flex items-center gap-3 px-4 py-3.5 min-w-0">
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  {getConnectorIcon(msg.source, 'w-8 h-8')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[hsl(var(--text-primary))] truncate">{msg.title}</p>
                  <p className="text-xs text-[hsl(var(--text-secondary))] truncate mt-0.5">{msg.subtitle}</p>
                </div>
                {msg.files && msg.files.length > 0 && (
                  <CopilotTooltip content={`${msg.files.length} attachment${msg.files.length > 1 ? 's' : ''}`} placement="top" appearance="normal">
                    <span className="flex-shrink-0 text-neutral-400 flex items-center">
                      <Attach16Regular className="w-3.5 h-3.5" />
                    </span>
                  </CopilotTooltip>
                )}
              </div>

              {/* Date */}
              <div className="flex items-center px-3 py-3">
                <span className="text-sm text-[hsl(var(--text-primary))]">{formatDwDate(msg.date)}</span>
              </div>

              {/* Source */}
              <div className="flex items-center gap-2 px-3 py-3">
                <span className="flex-shrink-0">{getConnectorIcon(msg.source, 'w-4 h-4')}</span>
                <span className="text-sm text-[hsl(var(--text-primary))]">{msg.source === 'outlook' ? 'Email' : 'Teams'}</span>
              </div>

              {/* People */}
              <div className="flex items-center px-3 pr-6 py-3">
                <AvatarStack avatars={msg.avatars} overflow={msg.overflow} />
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
};
