import React from 'react';
import {
  ArrowLeft20Regular,
  ArrowReply20Regular,
  ArrowReplyAll20Regular,
  ArrowForward20Regular,
  Search20Regular,
  Record20Regular,
  Info20Regular,
  MoreHorizontal20Regular,
  Delete20Regular,
  Archive20Regular,
  Flag20Regular,
  Sparkle20Regular,
  Document16Regular,
} from '@fluentui/react-icons';
import { getConnectorIcon } from '../../../utils/agentIcons';
import { openFileNatively } from '../../../utils/openFileNatively';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { DeliverableFileProp } from './DWArtifactDetailPanel';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MessageDetailType = 'chat' | 'email' | 'meeting';

export interface MessageDetail {
  id: string;
  title: string;
  subtitle: string;
  source: string;
  timestamp: string;
  detailType: MessageDetailType;
  files?: DeliverableFileProp[];
}

// ── File chip ─────────────────────────────────────────────────────────────────

export function FileTypeIcon({ type, app }: { type: DeliverableFileProp['type']; app?: string }) {
  // Prefer app-specific icon when available
  if (app) {
    const icon = getConnectorIcon(app, 'w-3.5 h-3.5');
    if (icon) return <>{icon}</>;
  }
  if (type === 'document')     return <>{getConnectorIcon('word',       'w-3.5 h-3.5')}</>;
  if (type === 'spreadsheet')  return <>{getConnectorIcon('excel',      'w-3.5 h-3.5')}</>;
  if (type === 'presentation') return <>{getConnectorIcon('powerpoint', 'w-3.5 h-3.5')}</>;
  return                              <Document16Regular className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />;
}

const FileChip: React.FC<{ file: DeliverableFileProp; onClick: () => void }> = ({ file, onClick }) => (
  <CopilotButton
    variant="secondary"
    size="sm"
    onClick={onClick}
    icon={<FileTypeIcon type={file.type} app={file.app} />}
    className="!rounded-lg !text-xs !text-[hsl(var(--text-secondary))] !max-w-[220px] !bg-white"
  >
    <span className="truncate">{file.name}</span>
  </CopilotButton>
);

// ── Per-message content ────────────────────────────────────────────────────────

interface ChatMessage {
  initials: string;
  color: string;
  name: string;
  time: string;
  text: string;
  isAI?: boolean;
}

interface ChatContent {
  channel: string;
  channelType: 'channel' | 'chat';
  summary: string;
  messages: ChatMessage[];
}

const CHAT_CONTENT: Record<string, ChatContent> = {
  m2: {
    channel: '#product-strategy',
    channelType: 'channel',
    summary: 'Lydia Barnes requested a Q2 roadmap summary ahead of the leadership sync. The AI Teammate identified three open items requiring input before EOW — EMEA expansion scope, the eval reporting feature, and the April compliance milestone — and drafted a pre-read document with EMEA as the lead item.',
    messages: [
      { initials: 'LB', color: '#CA5010', name: 'Lydia Barnes', time: '10:02 AM', text: "Hey team — can you pull together a summary of what's still open on the Q2 roadmap before tomorrow's leadership sync? Two or three decision items at most." },
      { initials: 'AI', color: '#6264A7', name: 'AI Teammate', time: '10:02 AM', isAI: true, text: "On it. I've reviewed the roadmap board and found three open items that need input before EOW. Summarizing now…" },
      { initials: 'AI', color: '#6264A7', name: 'AI Teammate', time: '10:03 AM', isAI: true, text: "Here's the summary:\n\n1. EMEA expansion scope — budget confirmation needed from Lydia (due Mar 25)\n2. Eval reporting feature — James to scope for next sprint\n3. Compliance milestone — legal sign-off required by Apr 15\n\nShould I draft a pre-read doc for tomorrow's sync?" },
      { initials: 'LB', color: '#CA5010', name: 'Lydia Barnes', time: '10:04 AM', text: 'Yes please — send it to me before noon.' },
      { initials: 'MW', color: '#107954', name: 'Marcus Webb', time: '10:05 AM', text: '+1, also flag the EMEA one as the top priority for discussion.' },
      { initials: 'AI', color: '#6264A7', name: 'AI Teammate', time: '10:05 AM', isAI: true, text: 'Done. Pre-read is drafted with EMEA expansion as the lead item. Sending to Lydia now.' },
    ],
  },
  m5: {
    channel: 'M365 Copilot Rollout',
    channelType: 'chat',
    summary: 'Marcus Webb requested March Copilot adoption metrics for the Thursday all-hands. The AI Teammate pulled data showing 18% WoW growth to 3,821 active users, with Teams meeting summaries as the top feature. A leadership summary broken down by department was prepared at Sophie\'s request.',
    messages: [
      { initials: 'MW', color: '#107954', name: 'Marcus Webb', time: '9:15 AM', text: 'Do we have the March adoption numbers for the Copilot rollout? Leadership wants a summary for the all-hands on Thursday.' },
      { initials: 'AI', color: '#6264A7', name: 'AI Teammate', time: '9:15 AM', isAI: true, text: 'Pulling from the M365 admin dashboard now…' },
      { initials: 'AI', color: '#6264A7', name: 'AI Teammate', time: '9:16 AM', isAI: true, text: "March metrics are ready. Usage is up 18% WoW — 3,821 active users vs 3,240 in Feb.\n\nTop features:\n• Teams meeting summaries — 42%\n• Outlook draft suggestions — 31%\n• Word rewrite — 18%\n• Excel insights — 9%\n\nI've drafted a one-page summary for the leadership update. Want me to share it here?" },
      { initials: 'SL', color: '#498205', name: 'Sophie Laurent', time: '9:17 AM', text: "That's great — can you add the comparison to the Feb baseline and break it down by department?" },
      { initials: 'AI', color: '#6264A7', name: 'AI Teammate', time: '9:18 AM', isAI: true, text: 'Done. Feb baseline added and department breakdown included — Engineering leads at 94% adoption, followed by Product at 87%. Summary updated and ready to share.' },
    ],
  },
  m7: {
    channel: '#compliance-updates',
    channelType: 'channel',
    summary: 'Nine employees remained outstanding on the Q1 security awareness training with a March 31 deadline. The AI Teammate sent personalized reminders to each and received approval from Priya Nair to escalate to their managers on March 28 for anyone still incomplete.',
    messages: [
      { initials: 'MR', color: '#C43E1C', name: 'Marco Rossi', time: '2:00 PM', text: "Priya flagged that 9 employees haven't completed the security awareness training yet. Deadline is March 31 — can you send reminders?" },
      { initials: 'AI', color: '#6264A7', name: 'AI Teammate', time: '2:01 PM', isAI: true, text: "I've identified the 9 outstanding employees and sent each of them a personal reminder with the training link and March 31 deadline noted. Do you want me to escalate to their managers if they haven't completed by March 28?" },
      { initials: 'PN', color: '#8764B8', name: 'Priya Nair', time: '2:03 PM', text: 'Yes — escalate to managers on the 28th for anyone still pending. Keep me in the loop.' },
      { initials: 'AI', color: '#6264A7', name: 'AI Teammate', time: '2:03 PM', isAI: true, text: "Understood. I'll follow up with managers on March 28 for any remaining cases and copy you on each message. I'll also update the Training Completion Report as completions come in." },
    ],
  },
};

interface EmailContent {
  from: string;
  fromEmail: string;
  to: string;
  cc?: string;
  subject: string;
  date: string;
  summary: string;
  body: string[];
}

const EMAIL_CONTENT: Record<string, EmailContent> = {
  m1: {
    from: 'AI Teammate',
    fromEmail: 'aiteammate@contoso.com',
    to: 'Priya Nair; James Okafor',
    cc: 'Lydia Barnes',
    subject: 'Q1 Compliance Audit Report — Ready for Legal Review',
    date: 'March 23, 2026 at 9:58 AM',
    summary: 'The AI Teammate compiled and submitted the complete Q1 compliance audit package to Priya Nair and James Okafor. All three evidence documents are attached. All High and Critical findings have been remediated ahead of the June SOC 2 readiness review.',
    body: [
      'Hi Priya and James,',
      'Please find attached the Q1 compliance audit package for legal review. All three evidence documents are included:',
      '• Data Handling Policy v3.2.docx\n• Compliance Checklist Q1 2026.xlsx\n• Audit Evidence — Access Controls.pdf',
      'The checklist reflects 8 control areas reviewed this quarter. All High and Critical findings have been remediated. Two Low findings are documented with confirmed closure dates.',
      'Please confirm receipt and let me know if you need any additional documentation before the SOC 2 readiness review in June.',
      'AI Teammate',
    ],
  },
  m4: {
    from: 'AI Teammate',
    fromEmail: 'aiteammate@contoso.com',
    to: 'James Okafor',
    cc: 'Priya Nair',
    subject: 'Vendor Risk Assessments Complete — 2 Items Require Sign-Off',
    date: 'March 23, 2026 at 9:44 AM',
    summary: 'The AI Teammate completed all Q1 vendor risk assessments across 8 vendors. Two items — Zoom and Jira — require James Okafor\'s sign-off due to a pending DPA confirmation and an open data residency clause respectively. The updated Vendor Risk Matrix is attached.',
    body: [
      'Hi James,',
      "I've completed the vendor risk assessment cycle for Q1. All 8 vendors in the matrix have been reviewed. Two items require your sign-off:",
      '1. Zoom (conferencing) — Tier 3 Medium: Annual assessment due; awaiting DPA confirmation\n2. Jira (project tracking) — Tier 3 Medium: Data residency clause under review by legal',
      "The updated Vendor Risk Matrix is attached. I'll follow up with both vendors for outstanding documentation.",
      'Please review and sign off at your earliest convenience.',
      'AI Teammate',
    ],
  },
  m6: {
    from: 'AI Teammate',
    fromEmail: 'aiteammate@contoso.com',
    to: 'Riley Chen',
    cc: 'Sophie Laurent',
    subject: "Welcome to the Team, Riley! Here's Everything You Need for Day 1",
    date: 'March 22, 2026 at 4:32 PM',
    summary: "The AI Teammate assembled and delivered a complete onboarding package to new hire Riley Chen — including a Day 1 checklist, pre-filled IT access request, and team handbook. Riley's Day 1 logistics were confirmed including Entra ID setup, equipment at reception, and a 10 AM welcome call with Lydia.",
    body: [
      'Hi Riley,',
      "Welcome to Contoso! I'm the AI Teammate supporting the team — I'm here to help you get settled in quickly.",
      'Attached is your onboarding package, which includes:\n\n• Day 1 checklist — your schedule, key contacts, and where to find things\n• IT access request form — pre-filled with your role and equipment needs\n• Team handbook — working norms, communication tools, and escalation paths',
      'A few things to know for Day 1:\n• Your Entra ID is set up — sign in at portal.microsoft.com\n• Your laptop will be ready at reception\n• Lydia has blocked 30 minutes at 10 AM for a welcome call',
      'Feel free to reply if you have any questions before Monday. Looking forward to working with you.',
      'AI Teammate',
    ],
  },
  m9: {
    from: 'AI Teammate',
    fromEmail: 'aiteammate@contoso.com',
    to: 'Lydia Barnes; James Okafor; Marcus Webb',
    cc: 'Contoso CSM',
    subject: 'Follow-Up: Stakeholder Meeting — March 20 | EMEA Expansion Approved',
    date: 'March 20, 2026 at 3:15 PM',
    summary: "Following the March 20 stakeholder meeting, the AI Teammate circulated a full summary to all attendees. Key outcomes: EMEA expansion budget approved in principle, Q2 roadmap aligned, and June compliance milestone confirmed. Four next steps were assigned across the team with a follow-up meeting set for April 5.",
    body: [
      'Hi all,',
      "Thank you for a productive session today. Here's a summary of key decisions and next steps.",
      'Decisions made:\n• EMEA expansion budget approved in principle — formal sign-off by March 25\n• Q2 roadmap priorities confirmed and aligned\n• Compliance milestone confirmed for June — legal sign-off required by April 15',
      'Next steps:\n• Avery to circulate updated roadmap — ✓ Completed\n• Lydia to confirm legal review timeline for compliance milestone\n• James to scope evaluation reporting feature for next sprint\n• Follow-up meeting scheduled for April 5',
      'The updated roadmap and meeting notes are attached for your reference.',
      'AI Teammate',
    ],
  },
};

// ── Meeting transcript ─────────────────────────────────────────────────────────

interface TranscriptLine {
  name: string;
  initials: string;
  color: string;
  time: string;
  text: string;
}

const MEETING_TRANSCRIPTS: Record<string, { title: string; host: string; summary: string; lines: TranscriptLine[] }> = {
  m3: {
    title: 'Weekly Standup — March 23',
    host: 'Avery Fuller',
    summary: 'The March 23 weekly standup covered sprint progress and upcoming blockers. Marco confirmed the Dexter API integration is on track, Sophie\'s design handoff is ready, and James flagged a compliance sign-off deadline. Five action items were captured and will be distributed by the AI Teammate.',
    lines: [
      { name: 'Avery Fuller',   initials: 'AF', color: '#0F6CBD', time: '9:01', text: "Good morning everyone — let's keep this to 15 minutes. Who wants to start with blockers?" },
      { name: 'Marco Rossi',    initials: 'MR', color: '#C43E1C', time: '9:02', text: "I'm unblocked on the Dexter API work, should have the integration test suite done by EOD today." },
      { name: 'Sophie Laurent', initials: 'SL', color: '#498205', time: '9:03', text: "Design for the new onboarding flow is ready for handoff — I'll drop the Figma link in #engineering after this." },
      { name: 'James Okafor',   initials: 'JO', color: '#8764B8', time: '9:04', text: "One thing — the vendor risk sign-offs need to happen before March 28 or we miss the compliance window. AI Teammate is tracking but I wanted to flag it here." },
      { name: 'AI Teammate',    initials: 'AI', color: '#6264A7', time: '9:04', text: "Confirmed — I'll send the sign-off reminders to James and Priya this afternoon with the relevant documents attached." },
      { name: 'Avery Fuller',   initials: 'AF', color: '#0F6CBD', time: '9:05', text: "Perfect. Five action items captured — AI Teammate will distribute notes after the call. Anything else before we close?" },
    ],
  },
  m8: {
    title: 'AI Teammate Capability Review — March 21',
    host: 'Lydia Barnes',
    summary: "Lydia Barnes led the 100-day AI Teammate capability review with Marcus Webb. The AI Teammate reported 47 tasks completed, 14.2 hrs/week of estimated team time saved, and zero compliance violations. Q2 expansion was agreed to focus on financial reporting, with Marcus scoping data access requirements.",
    lines: [
      { name: 'Lydia Barnes', initials: 'LB', color: '#CA5010', time: '10:01', text: "Thanks for joining. Today I want to review the AI Teammate's first 100 days and talk about where we want to take this in Q2." },
      { name: 'Marcus Webb',  initials: 'MW', color: '#107954', time: '10:02', text: "From an engineering perspective the Dexter integration has been solid. The task orchestration is working well — I think we're ready to expand the skill set." },
      { name: 'AI Teammate',  initials: 'AI', color: '#6264A7', time: '10:03', text: "I've prepared a summary of the last 100 days: 47 tasks completed, 14.2 hours of estimated team time saved per week, and 0 compliance violations. Three areas where I could do more: vendor management, financial reporting, and cross-team communication." },
      { name: 'Lydia Barnes', initials: 'LB', color: '#CA5010', time: '10:04', text: "That's a strong baseline. For Q2 I want to prioritize the financial reporting capability — can we scope that out?" },
      { name: 'Marcus Webb',  initials: 'MW', color: '#107954', time: '10:05', text: "I can have a scope doc ready by end of next week. We'll need read access to the finance SharePoint and the Excel workbooks." },
      { name: 'AI Teammate',  initials: 'AI', color: '#6264A7', time: '10:06', text: "I'll prepare a data access requirements document and send it to Marcus before Thursday. I can also draft the capability spec if that's helpful." },
    ],
  },
};

// ── AI Summary block ───────────────────────────────────────────────────────────

const AISummary: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-start gap-2.5 px-4 py-3 bg-[#F5F5FA] rounded-xl border border-[#E0E0F0]">
    <Sparkle20Regular className="w-4 h-4 text-[#6264A7] flex-shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-semibold text-[#6264A7] uppercase tracking-wide mb-1">AI Summary</p>
      <p className="text-sm text-[hsl(var(--text-secondary))] leading-relaxed">{text}</p>
    </div>
  </div>
);

// ── Attachments block ──────────────────────────────────────────────────────────

const AttachmentsBlock: React.FC<{ files: DeliverableFileProp[]; onFileClick: (f: DeliverableFileProp) => void }> = ({ files, onFileClick }) => (
  <div className="space-y-1.5">
    <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Attachments</p>
    <div className="flex flex-wrap gap-2">
      {files.map(f => <FileChip key={f.id} file={f} onClick={() => onFileClick(f)} />)}
    </div>
  </div>
);

// ── Teams Chat UI ──────────────────────────────────────────────────────────────

const TeamsAvatar: React.FC<{ initials: string; color: string; isAI?: boolean }> = ({ initials, color, isAI }) => {
  if (isAI) {
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6264A7] to-[hsl(var(--primary))] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
        AI
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0" style={{ backgroundColor: color }}>
      {initials}
    </div>
  );
};

const ChatDetail: React.FC<{ message: MessageDetail; onBack: () => void; onFileClick: (f: DeliverableFileProp) => void }> = ({ message, onBack, onFileClick }) => {
  const content = CHAT_CONTENT[message.id];

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      <div className="px-5 pt-4 pb-2 flex-shrink-0 space-y-3">
        <CopilotButton variant="transparent" size="sm" icon={<ArrowLeft20Regular className="w-4 h-4" />} onClick={onBack} className="!px-0 !text-[hsl(var(--text-secondary))] hover:!text-[hsl(var(--text-primary))]">
          Messages
        </CopilotButton>
        {content && <AISummary text={content.summary} />}
        {message.files && message.files.length > 0 && (
          <AttachmentsBlock files={message.files} onFileClick={onFileClick} />
        )}
      </div>

      <div className="flex flex-col flex-1 min-h-0 mx-5 mb-5 rounded-xl overflow-hidden border border-neutral-200 shadow-sm">
        {/* Teams header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-neutral-200 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#F3F2FC] flex items-center justify-center flex-shrink-0">
            {getConnectorIcon('teams', 'w-5 h-5')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              {content?.channelType === 'channel' && <span className="text-xs font-bold text-[#6264A7]">#</span>}
              <span className="text-sm font-semibold text-[hsl(var(--text-primary))] truncate">{content ? content.channel : message.title}</span>
            </div>
            <p className="text-xs text-[hsl(var(--text-secondary))]">{content?.channelType === 'channel' ? 'Channel' : 'Group chat'}</p>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <CopilotButton variant="icon-subtle" size="xs" icon={<Search20Regular className="w-3.5 h-3.5 text-[hsl(var(--text-secondary))]" />} title="Search" />
            <CopilotButton variant="icon-subtle" size="xs" icon={<MoreHorizontal20Regular className="w-3.5 h-3.5 text-[hsl(var(--text-secondary))]" />} title="More" />
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-white">
          {content ? content.messages.map((msg, i) => (
            <div key={i} className="flex gap-3">
              <TeamsAvatar initials={msg.initials} color={msg.color} isAI={msg.isAI} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className={`text-sm font-semibold ${msg.isAI ? 'text-[#6264A7]' : 'text-[hsl(var(--text-primary))]'}`}>{msg.name}</span>
                  <span className="text-[11px] text-[hsl(var(--text-disabled))]">{msg.time}</span>
                </div>
                <p className="text-sm text-[hsl(var(--text-primary))] leading-6 whitespace-pre-line">{msg.text}</p>
              </div>
            </div>
          )) : <p className="text-sm text-neutral-400 italic">No messages to display.</p>}
        </div>

        {/* Reply bar */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-neutral-200 bg-[hsl(var(--surface-secondary))] flex-shrink-0">
          <div className="flex-1 h-8 rounded-md bg-white border border-neutral-200 px-3 flex items-center">
            <span className="text-xs text-neutral-400">Reply…</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Outlook Email UI ───────────────────────────────────────────────────────────

const EmailDetail: React.FC<{ message: MessageDetail; onBack: () => void; onFileClick: (f: DeliverableFileProp) => void }> = ({ message, onBack, onFileClick }) => {
  const content = EMAIL_CONTENT[message.id];

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      <div className="px-5 pt-4 pb-2 flex-shrink-0 space-y-3">
        <CopilotButton variant="transparent" size="sm" icon={<ArrowLeft20Regular className="w-4 h-4" />} onClick={onBack} className="!px-0 !text-[hsl(var(--text-secondary))] hover:!text-[hsl(var(--text-primary))]">
          Messages
        </CopilotButton>
        {content && <AISummary text={content.summary} />}
      </div>

      <div className="flex flex-col flex-1 min-h-0 mx-5 mb-5 rounded-xl overflow-hidden border border-neutral-200 shadow-sm">
        {/* Outlook header */}
        <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-neutral-200 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#EFF6FC] flex items-center justify-center flex-shrink-0">
            {getConnectorIcon('outlook', 'w-5 h-5')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">Inbox</p>
            <p className="text-xs text-[#0078D4]">Microsoft Outlook</p>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <CopilotButton variant="icon-subtle" size="xs" icon={<ArrowReply20Regular className="w-3.5 h-3.5 text-[#0078D4]" />} title="Reply" />
            <CopilotButton variant="icon-subtle" size="xs" icon={<ArrowReplyAll20Regular className="w-3.5 h-3.5 text-[#0078D4]" />} title="Reply All" />
            <CopilotButton variant="icon-subtle" size="xs" icon={<ArrowForward20Regular className="w-3.5 h-3.5 text-[#0078D4]" />} title="Forward" />
            <div className="w-px h-4 bg-neutral-200 mx-1" />
            <CopilotButton variant="icon-subtle" size="xs" icon={<Archive20Regular className="w-3.5 h-3.5 text-[hsl(var(--text-secondary))]" />} title="Archive" />
            <CopilotButton variant="icon-subtle" size="xs" icon={<Delete20Regular className="w-3.5 h-3.5 text-[hsl(var(--text-secondary))]" />} title="Delete" />
            <CopilotButton variant="icon-subtle" size="xs" icon={<Flag20Regular className="w-3.5 h-3.5 text-[hsl(var(--text-secondary))]" />} title="Flag" />
          </div>
        </div>

        {/* Email body */}
        <div className="flex-1 overflow-y-auto bg-white">
          {content ? (
            <div className="px-6 py-5 space-y-4">
              <h2 className="text-lg font-bold text-[hsl(var(--text-primary))] leading-tight">{content.subject}</h2>

              {/* Metadata */}
              <div className="space-y-1 text-xs text-[hsl(var(--text-secondary))] pb-4 border-b border-neutral-100">
                <div className="flex gap-2">
                  <span className="font-semibold text-[hsl(var(--text-secondary))] w-8 flex-shrink-0">From</span>
                  <span>{content.from} <span className="text-[hsl(var(--text-disabled))]">&lt;{content.fromEmail}&gt;</span></span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold text-[hsl(var(--text-secondary))] w-8 flex-shrink-0">To</span>
                  <span>{content.to} <span className="ml-1.5 bg-[#EFF6FC] text-[#0078D4] text-[10px] font-medium px-1.5 py-0.5 rounded">AI agent</span></span>
                </div>
                {content.cc && (
                  <div className="flex gap-2">
                    <span className="font-semibold text-[hsl(var(--text-secondary))] w-8 flex-shrink-0">CC</span>
                    <span>{content.cc}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="font-semibold text-[hsl(var(--text-secondary))] w-8 flex-shrink-0">Date</span>
                  <span>{content.date}</span>
                </div>
              </div>

              {/* Attachments (inside email body) */}
              {message.files && message.files.length > 0 && (
                <div className="pb-2 border-b border-neutral-100">
                  <AttachmentsBlock files={message.files} onFileClick={onFileClick} />
                </div>
              )}

              {/* Body paragraphs */}
              <div className="space-y-3 text-sm text-[hsl(var(--text-primary))] leading-6">
                {content.body.map((para, i) => (
                  <p key={i} className="whitespace-pre-line">{para}</p>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-6 py-5">
              <h2 className="text-lg font-bold text-[hsl(var(--text-primary))] mb-4">{message.title}</h2>
              <p className="text-sm text-neutral-400 italic">Email content not available.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Meeting transcript detail ─────────────────────────────────────────────────

const MeetingDetail: React.FC<{ message: MessageDetail; onBack: () => void }> = ({ message, onBack }) => {
  const content = MEETING_TRANSCRIPTS[message.id];

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      <div className="px-5 pt-4 pb-2 flex-shrink-0 space-y-3">
        <CopilotButton variant="transparent" size="sm" icon={<ArrowLeft20Regular className="w-4 h-4" />} onClick={onBack} className="!px-0 !text-[hsl(var(--text-secondary))] hover:!text-[hsl(var(--text-primary))]">
          Messages
        </CopilotButton>
        {content && <AISummary text={content.summary} />}
      </div>

      <div className="flex flex-col flex-1 min-h-0 mx-5 mb-5 rounded-xl overflow-hidden border border-neutral-200 shadow-sm">
        {/* Teams meeting header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-neutral-200 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#F3F2FC] flex items-center justify-center flex-shrink-0">
            {getConnectorIcon('teams', 'w-5 h-5')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[hsl(var(--text-primary))] truncate">{content?.title ?? message.title}</p>
            <p className="text-xs text-[#6264A7]">Meeting transcript</p>
          </div>
        </div>

        {/* Search + disclaimer */}
        <div className="px-4 pt-3 pb-2 border-b border-neutral-100 space-y-2 bg-white flex-shrink-0">
          <CopilotInput appearance="filled-darker" size="sm" placeholder="Search people and keywords" contentBefore={<Search20Regular className="w-4 h-4" />} className="max-w-full" />
          <div className="flex items-center gap-1.5">
            <Info20Regular className="w-3.5 h-3.5 text-[hsl(var(--text-secondary))] flex-shrink-0" />
            <span className="text-xs text-[hsl(var(--text-secondary))]">AI-generated content may be incorrect</span>
          </div>
        </div>

        {/* Transcript */}
        <div className="flex-1 overflow-y-auto px-4 py-4 bg-white">
          {content ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-[hsl(var(--text-secondary))] mb-4">
                <Record20Regular className="w-3.5 h-3.5 text-[#6264A7] flex-shrink-0" />
                <span>{content.host} started transcribing</span>
              </div>
              {content.lines.map((line, i) => (
                <div key={i} className="flex gap-3 py-1.5">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0 ${line.initials === 'AI' ? 'bg-gradient-to-br from-[#6264A7] to-[hsl(var(--primary))]' : ''}`}
                    style={line.initials !== 'AI' ? { backgroundColor: line.color } : undefined}
                  >
                    {line.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className={`text-sm font-semibold ${line.initials === 'AI' ? 'text-[#6264A7]' : 'text-[hsl(var(--text-primary))]'}`}>{line.name}</span>
                      <span className="text-[11px] text-[hsl(var(--text-disabled))]">{line.time}</span>
                    </div>
                    <p className="text-sm text-[hsl(var(--text-secondary))] leading-6">{line.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-400 italic">Transcript not available.</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main export ───────────────────────────────────────────────────────────────

interface DWMessageDetailPanelProps {
  message: MessageDetail;
  onBack: () => void;
}

export const DWMessageDetailPanel: React.FC<DWMessageDetailPanelProps> = ({ message, onBack }) => {
  const handleFileClick = (file: DeliverableFileProp) => openFileNatively(file.app, file.url);

  return (
    <div className="h-full flex flex-col bg-white">
      {message.detailType === 'chat'    && <ChatDetail    message={message} onBack={onBack} onFileClick={handleFileClick} />}
      {message.detailType === 'email'   && <EmailDetail   message={message} onBack={onBack} onFileClick={handleFileClick} />}
      {message.detailType === 'meeting' && <MeetingDetail message={message} onBack={onBack} />}
    </div>
  );
};
