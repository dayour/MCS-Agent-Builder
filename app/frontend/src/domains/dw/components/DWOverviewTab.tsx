import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { getAgentStorage, setAgentStorage } from '../../../utils/agentStorage';
import {
  TextBulletList20Regular,
  Apps20Regular,
  Board20Regular,
  CheckmarkCircle16Regular,
  ArrowSync16Regular, CalendarClock16Regular,
  ErrorCircle16Filled,
  ArrowRight16Regular,
  ArrowTrendingLines20Regular,
  CalendarLtr16Regular,
  Document16Regular,
  BriefcaseRegular,
  FlashRegular,
  DesktopCursorRegular,
  CodeRegular,
  ErrorCircle20Filled,
  MoreHorizontal20Regular,
  DocumentAdd16Regular,
  Edit16Regular,
  Comment16Regular,
  Open16Regular,
  TaskListAddRegular,
  Attach16Regular,
} from '@fluentui/react-icons';
import { useAgent } from '../../../context/AgentContext';
import { useDW } from '../context/DWContext';
import { LatencyLoader } from '../../../components/ui/StatusIcon';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotMenu, CopilotMenuPosition } from '../../../components/ui/CopilotMenu';
import { getConnectorIcon } from '../../../utils/agentIcons';
import { openTeamsChat } from '../../../utils/openTeamsChat';
import { openFileNatively, extToApp } from '../../../utils/openFileNatively';
import { ARTIFACTS, TaskArtifact, ArtifactType } from './DWArtifactDetailPanel';
import { DWTaskDetailPanel, TaskDetail, TASK_DETAILS } from './DWTaskDetailPanel';
import { useSharedDexterWorkerProfile } from '../../../context/DexterWorkerProfileContext';
import { updateDexterWorker, type DexterWorkspaceSkill } from '../services/dexterWorkerService';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../../../components/ui/Dialog';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { CopilotBadge } from '../../../components/ui/CopilotBadge';
import { CopilotTooltip } from '../../../components/ui/CopilotTooltip';
import { SKILL_CATALOG, SKILL_CATEGORIES, type SkillCatalogEntry } from '../../../data/skillCatalog';
import { DWAddTaskDialog } from './DWAddTaskDialog';

import { formatTaskDate, formatTaskDateShort } from '../utils/dwDateUtils';
export { formatTaskDate };
export { formatTaskDateShort };

// ── Animation constants ──────────────────────────────────────────────────────

const ANIM_STAGGER = 600;
const ANIM_ENTRY_DUR = 800;
const ANIM_PROCESS_OFFSET = 600;
const ANIM_TRANSITION_DUR = 400; // brief loader flash between states
const ANIM_PROCESS_DUR = 4500;
const ANIM_COMPLETING_DUR = 400; // brief loader flash before complete

export const STATUS_APPEAR_KEYFRAMES = `
@keyframes statusAppear {
  0%   { opacity: 0; transform: scale(0.6); }
  65%  { transform: scale(1.15); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes spinCW {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.status-icon-spinning {
  animation: spinCW 2s linear infinite;
  display: inline-flex;
}
`;

// ── Types ─────────────────────────────────────────────────────────────────────

export type TaskViewMode = 'list' | 'tile' | 'kanban';
export type Day100TaskStatus = 'complete' | 'in-progress' | 'incomplete' | 'upcoming';
// 'transitioning' = brief loader flash between states; 'processing' = in-progress state shown
type AnimPhase = 'hidden' | 'entering' | 'transitioning' | 'processing' | 'completing' | 'complete';


export interface Day100Task {
  id: string;
  name: string;
  subtitle: string;
  status: Day100TaskStatus;
  lastUpdated: string;
  date?: string; // ISO date for formatted display in table view
  connectors?: string[];
  category?: 'meeting';
  outputMeeting?: boolean; // task produced a meeting as an output
}

// ── Status config ─────────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<Day100TaskStatus, { label: string; icon: React.ReactNode; staticIcon?: React.ReactNode; textColor: string; bgColor: string; borderColor: string }> = {
  complete:      { label: 'Complete',    icon: <CheckmarkCircle16Regular style={{ fontSize: 18, width: 18, height: 18 }} />, textColor: 'text-green-600',  bgColor: 'bg-green-50',  borderColor: 'border-green-200' },
  'in-progress': { label: 'In progress', icon: <span className="status-icon-spinning"><ArrowSync16Regular style={{ fontSize: 18, width: 18, height: 18 }} /></span>, staticIcon: <ArrowSync16Regular style={{ fontSize: 18, width: 18, height: 18 }} />, textColor: 'text-orange-500', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
  incomplete:    { label: 'Incomplete',  icon: <ErrorCircle16Filled style={{ fontSize: 18, width: 18, height: 18 }} />,      textColor: 'text-red-500',    bgColor: 'bg-red-50',    borderColor: 'border-red-200' },
  upcoming:      { label: 'Upcoming',    icon: <CalendarClock16Regular style={{ fontSize: 18, width: 18, height: 18 }} />,  textColor: 'text-blue-500',   bgColor: 'bg-blue-50',   borderColor: 'border-blue-200' },
};


// ── File action icon map ──────────────────────────────────────────────────────

const FILE_ACTION_ICONS: Record<string, React.ReactNode> = {
  'Created':       <DocumentAdd16Regular className="w-3.5 h-3.5" />,
  'Edited':        <Edit16Regular className="w-3.5 h-3.5" />,
  'Commented':     <Comment16Regular className="w-3.5 h-3.5" />,
  'Opened':        <Open16Regular className="w-3.5 h-3.5" />,
  'Assigned task': <TaskListAddRegular className="w-3.5 h-3.5" />,
};

// ── Artifact chip metadata ────────────────────────────────────────────────────

const ARTIFACT_CHIP_META: Record<ArtifactType, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  word:       { icon: getConnectorIcon('word',       'w-3.5 h-3.5'), color: 'text-neutral-700', bg: 'bg-white', border: 'border-neutral-300' },
  excel:      { icon: getConnectorIcon('excel',      'w-3.5 h-3.5'), color: 'text-neutral-700', bg: 'bg-white', border: 'border-neutral-300' },
  powerpoint: { icon: getConnectorIcon('powerpoint', 'w-3.5 h-3.5'), color: 'text-neutral-700', bg: 'bg-white', border: 'border-neutral-300' },
  email:      { icon: getConnectorIcon('outlook',    'w-3.5 h-3.5'), color: 'text-neutral-700', bg: 'bg-white', border: 'border-neutral-300' },
  chat:       { icon: getConnectorIcon('teams',      'w-3.5 h-3.5'), color: 'text-neutral-700', bg: 'bg-white', border: 'border-neutral-300' },
  file:       { icon: <Document16Regular />,                         color: 'text-neutral-700', bg: 'bg-white', border: 'border-neutral-300' },
  sharepoint: { icon: getConnectorIcon('sharepoint', 'w-3.5 h-3.5'), color: 'text-neutral-700', bg: 'bg-white', border: 'border-neutral-300' },
};

// ── Skill families ────────────────────────────────────────────────────────────

export const SKILL_FAMILIES = [
  {
    icon: <BriefcaseRegular className="w-5 h-5" />,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    title: 'Use Work IQ intelligence',
    description: 'Leverage insights from Microsoft 365 to understand work patterns, surface relevant knowledge, and turn signals into actions.',
  },
  {
    icon: <img src={`${process.env.PUBLIC_URL || ''}/component-icons/PowerPlatform24.png`} alt="Power Platform" className="w-5 h-5 object-contain" />,
    iconBg: 'bg-teal-50',
    iconColor: '',
    title: 'Use Power Platform',
    description: 'Connect to Power Platform to automate workflows, orchestrate actions, and extend capabilities across Power Automate, Power Apps, and Dataverse.',
  },
  {
    icon: <img src={`${process.env.PUBLIC_URL || ''}/component-icons/Dynamics36524.png`} alt="Dynamics 365" className="w-5 h-5 object-contain" />,
    iconBg: 'bg-indigo-50',
    iconColor: '',
    title: 'Dynamics 365 integration',
    description: 'Work with Dynamics 365 data to retrieve, update, and act on customer and business information directly within your workflows.',
  },
  {
    icon: <img src={`${process.env.PUBLIC_URL || ''}/component-icons/Office24.svg`} alt="Microsoft Office" className="w-5 h-5" />,
    iconBg: 'bg-orange-50',
    iconColor: '',
    title: 'Use Microsoft Office',
    description: 'Create, read, update, and manage Word, Excel, PowerPoint, Outlook, and Teams content as part of everyday tasks and automated flows.',
  },
  {
    icon: <DesktopCursorRegular className="w-5 h-5" />,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    title: 'Interact with Computer Using Agent',
    description: 'Operate across desktop and web experiences by navigating interfaces, entering data, and completing tasks just like a human would.',
  },
  {
    icon: <CodeRegular className="w-5 h-5" />,
    iconBg: 'bg-neutral-100',
    iconColor: 'text-neutral-600',
    title: 'Can write and execute code',
    description: 'Generate, run, and iterate on code to perform advanced logic, data processing, integrations, and custom automation.',
  },
];

// ── Day 0 Teams preview placeholder ──────────────────────────────────────────

const TEAMS_PREVIEW_URL = 'https://www.figma.com/proto/ipxtSK0EXGE8EVGNVCW4c8/Digital-Worker--A365-?page-id=4222%3A56385&node-id=8902-46268&viewport=-1276%2C453%2C0.25&t=wJR9LDvczZ7aueVL-1&scaling=min-zoom&content-scaling=fixed&starting-point-node-id=8902%3A46268';

// ── Day 100 task data ─────────────────────────────────────────────────────────

export const DAY100_TASKS: Day100Task[] = [
  { id: 'h11', name: 'Create B2B campaign strategy deck for Contoso product launch',     subtitle: 'Marketing Campaign',          status: 'incomplete', lastUpdated: 'Just now',    date: '2026-03-26T09:00:00', connectors: ['sharepoint', 'word', 'excel'], outputMeeting: true },
  { id: 'h10', name: 'Refresh competitor landscape with latest market data',             subtitle: 'Competitive Analysis',        status: 'incomplete', lastUpdated: '4 days ago',  date: '2026-03-21T09:00:00', connectors: ['sharepoint'] },
  { id: 'h7',  name: 'Compare actuals vs forecast and flag budget anomalies',            subtitle: 'Budget Variance Analysis',    status: 'in-progress', lastUpdated: 'Just now',   date: '2026-03-25T11:58:00', connectors: ['sharepoint'], outputMeeting: true },
  { id: 'h12', name: 'Draft agenda and talking points for engineering all-hands',        subtitle: 'All-Hands Prep',              status: 'upcoming',   lastUpdated: 'Scheduled',   date: '2026-03-27T10:00:00', connectors: ['teams'], category: 'meeting' },
  { id: 'h13', name: 'Aggregate annual performance review scores and calibrate ranges',  subtitle: 'Performance Data Rollup',     status: 'upcoming',   lastUpdated: 'Scheduled',   date: '2026-03-28T14:00:00', connectors: ['outlook'] },
  { id: 'h9',  name: 'Compile weekly status updates across all active workstreams',      subtitle: 'Weekly Status Report',        status: 'complete',   lastUpdated: '1 hour ago',  date: '2026-03-25T11:00:00', connectors: ['outlook'], outputMeeting: true },
  { id: 'h8',  name: 'Incorporate stakeholder feedback into Q2 product roadmap',         subtitle: 'Product Roadmap Update',      status: 'complete',   lastUpdated: '30 min ago',  date: '2026-03-25T11:30:00', connectors: ['sharepoint'] },
  { id: 'h1',  name: 'Synthesize Q1 financials into executive summary brief',            subtitle: 'Quarterly Report',            status: 'complete',   lastUpdated: '2 hours ago', date: '2026-03-25T10:00:00', connectors: ['sharepoint'], outputMeeting: true },
  { id: 'h2',  name: 'Capture and distribute notes from team standup meeting',           subtitle: 'Standup Notes',               status: 'complete',   lastUpdated: 'Yesterday',   date: '2026-03-24T09:00:00', connectors: ['teams'], category: 'meeting' },
  { id: 'h3',  name: 'Review vendor contract and flag key clauses and risk items',       subtitle: 'Vendor Contract Review',      status: 'complete',   lastUpdated: '2 days ago',  date: '2026-03-23T10:00:00', connectors: ['sharepoint'] },
  { id: 'h4',  name: 'Compile weekly rollup of NPS scores and support ticket themes',    subtitle: 'Customer Feedback Digest',    status: 'complete',   lastUpdated: '3 days ago',  date: '2026-03-22T15:00:00', connectors: ['outlook'] },
  { id: 'h5',  name: 'Assemble new hire welcome document and onboarding checklist',      subtitle: 'New Hire Onboarding Pack',    status: 'complete',   lastUpdated: '5 days ago',  date: '2026-03-20T10:00:00', connectors: ['sharepoint'] },
  { id: 'h6',  name: 'Gather sprint retrospective feedback and compile action items',    subtitle: 'Sprint Retrospective',        status: 'complete',   lastUpdated: '1 week ago',  date: '2026-03-18T09:00:00', connectors: ['teams'], category: 'meeting' },
];

// ── Day 0 task factory (shared with DWTasksTab for sync) ─────────────────────

export function makeDay0Tasks(fullName: string): Day100Task[] {
  return [
    { id: 't1', name: `Send ${fullName} a welcome message in Teams`,                           subtitle: 'Introduce yourself',              status: 'upcoming', lastUpdated: 'Today', date: '2026-03-25T09:00:00', connectors: ['teams'] },
    { id: 't2', name: `Email ${fullName} to introduce yourself and ask about team priorities`,  subtitle: 'Send introduction email',         status: 'upcoming', lastUpdated: 'Today', date: '2026-03-25T09:00:00', connectors: ['outlook'] },
    { id: 't3', name: `Ask ${fullName} for your first task and complete it to achieve a skill`, subtitle: 'Complete first task',             status: 'upcoming', lastUpdated: 'Today', date: '2026-03-25T09:00:00' },
  ];
}

// ── Helpers ───────────────────────────────────────────────────────────────────


function Section({ title, titleBadge, headerRight, children }: { title: string; titleBadge?: React.ReactNode; headerRight?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl px-5 pt-5 pb-3">
      {title && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
            {titleBadge}
          </div>
          {headerRight}
        </div>
      )}
      {children}
    </div>
  );
}

interface SkillCard {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const DAY100_SKILL_CARDS: SkillCard[] = [
  {
    icon: <BriefcaseRegular className="w-5 h-5 text-[hsl(var(--text-secondary))] flex-shrink-0" />,
    title: 'Use Work IQ intelligence',
    description: 'Leverage insights from Microsoft 365 to understand work patterns, surface relevant knowledge, and turn signals into actions.',
  },
  {
    icon: <FlashRegular className="w-5 h-5 text-[hsl(var(--text-secondary))] flex-shrink-0" />,
    title: 'Use Power Platform',
    description: 'Connect to Power Platform to automate workflows, orchestrate actions, and extend capabilities across Power Automate, Power Apps, and Dataverse.',
  },
  {
    icon: <Apps20Regular className="w-5 h-5 text-[hsl(var(--text-secondary))] flex-shrink-0" />,
    title: 'Dynamics 365 integration',
    description: 'Work with Dynamics 365 data to retrieve, update, and act on customer and business information directly within your workflows.',
  },
  {
    icon: <Apps20Regular className="w-5 h-5 text-[hsl(var(--text-secondary))] flex-shrink-0" />,
    title: 'Use Microsoft Office',
    description: 'Create, read, update, and manage Word, Excel, PowerPoint, Outlook, and Teams content as part of everyday tasks and automated flows.',
  },
  {
    icon: <DesktopCursorRegular className="w-5 h-5 text-[hsl(var(--text-secondary))] flex-shrink-0" />,
    title: 'Interact with Computer Using Agent',
    description: 'Operate across desktop and web experiences by navigating interfaces, entering data, and completing tasks just like a human would.',
  },
  {
    icon: <CodeRegular className="w-5 h-5 text-[hsl(var(--text-secondary))] flex-shrink-0" />,
    title: 'Can write and execute code',
    description: 'Generate, run, and iterate on code to perform advanced logic, data processing, integrations, and custom automation.',
  },
];

// ── Connector deep-link helper ────────────────────────────────────────────────

function connectorOpenUrl(connector: string): string {
  switch (connector) {
    case 'teams':      return 'msteams://teams.microsoft.com/l/channel/19:general@thread.v2/General';
    case 'outlook':    return 'ms-outlook://';
    case 'sharepoint': return 'https://contoso.sharepoint.com/sites/Team/Shared%20Documents';
    case 'excel':      return 'ms-excel:ofe|u|https://contoso.sharepoint.com/sites/Finance/Shared%20Documents';
    case 'word':       return 'ms-word:ofe|u|https://contoso.sharepoint.com/sites/Team/Shared%20Documents';
    case 'powerpoint': return 'ms-powerpoint:ofe|u|https://contoso.sharepoint.com/sites/Product/Shared%20Documents';
    default:           return 'msteams://teams.microsoft.com/l/channel/19:general@thread.v2/General';
  }
}
// ── Artifact chip ─────────────────────────────────────────────────────────────

function ArtifactChip({ artifact, onClick }: { artifact: TaskArtifact; onClick: (e: React.MouseEvent) => void }) {
  const meta = ARTIFACT_CHIP_META[artifact.type];
  // For sharepoint artifacts with multiple shared files, show first + overflow count
  const extraCount = artifact.type === 'sharepoint' && artifact.sharedFiles && artifact.sharedFiles.length > 1
    ? artifact.sharedFiles.length - 1
    : 0;
  const displayName = artifact.type === 'sharepoint' && artifact.sharedFiles?.[0]
    ? artifact.sharedFiles[0].name
    : artifact.name;

  return (
    <div className="flex items-center gap-1.5 min-w-0" onClick={e => e.stopPropagation()}>
      <CopilotTooltip content={artifact.name} placement="top" appearance="normal">
        <div
          role="button"
          tabIndex={0}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-neutral-50 border border-neutral-200 text-xs text-[hsl(var(--text-secondary))] min-w-0 flex-1 cursor-pointer hover:border-neutral-300 hover:shadow-sm transition-all"
          onClick={onClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e as unknown as React.MouseEvent); } }}
        >
          <span className="flex items-center w-3.5 h-3.5 flex-shrink-0">{meta.icon}</span>
          <span className="truncate">{displayName}{artifact.status === 'awaiting' ? ' ⏳' : ''}</span>
        </div>
      </CopilotTooltip>
      {extraCount > 0 && (
        <span className="text-xs text-[hsl(var(--text-disabled))] font-medium flex-shrink-0">+{extraCount}</span>
      )}
    </div>
  );
}

// ── Task tile card ────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Day100Task;
  onTaskClick: (task: Day100Task) => void;
  onArtifactClick: (artifact: TaskArtifact) => void;
  animPhase?: AnimPhase;
  onConnectorClick?: (connector: string) => void;
  onDeleteClick?: (taskId: string) => void;
  tableStyle?: boolean;
  isLast?: boolean;
  showStatusCol?: boolean; // render status as a separate column (hides inline icon)
}

export function TaskTile({ task, onTaskClick, onArtifactClick, animPhase, onConnectorClick }: TaskCardProps) {
  const effectiveStatus = animPhase === 'complete' || animPhase === 'completing' ? 'complete'
    : animPhase === 'processing' ? 'in-progress'
    : task.status;
  const sc = STATUS_CONFIG[effectiveStatus];
  const artifact = ARTIFACTS[task.id];
  const handleClick = () => onTaskClick(task);

  const wrapperStyle: React.CSSProperties = animPhase === 'hidden'
    ? { pointerEvents: 'none' }
    : animPhase === 'entering'
    ? { animation: 'slide-up-fade 0.5s ease-out both' }
    : {};

  return (
    <div onClick={handleClick} style={wrapperStyle} className="flex flex-col gap-3 p-4 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-50 transition-colors cursor-pointer group min-h-[130px]">
      {/* Status badge */}
      {(animPhase === 'hidden' || animPhase === 'entering' || animPhase === 'transitioning' || animPhase === 'completing') ? (
        <div className="inline-flex items-center gap-1.5 self-start">
          <LatencyLoader size={20} />
        </div>
      ) : (
        <div className={`inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-full text-xs font-medium ${sc.textColor} ${sc.bgColor} border ${sc.borderColor}`} style={animPhase === 'complete' ? { animation: 'statusAppear 350ms ease-out' } : undefined}>
          {sc.icon}
          <span>{sc.label}</span>
        </div>
      )}

      {/* Name + subtitle */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-normal leading-snug ${effectiveStatus === 'complete' ? 'text-[hsl(var(--text-disabled))]' : 'text-[hsl(var(--text-primary))]'}`}>{task.name}</p>
        <p className="text-xs text-neutral-500 mt-0.5">{task.subtitle}</p>
      </div>

      {/* Artifact chip */}
      {artifact && (
        <div className="min-w-0" onClick={e => e.stopPropagation()}>
          <ArtifactChip artifact={artifact} onClick={(e) => { e.stopPropagation(); onArtifactClick(artifact); }} />
        </div>
      )}

      {/* Footer: connectors + meeting icon + last updated */}
      <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
        <div className="flex items-center gap-1.5">
          {task.connectors?.[0] && (onConnectorClick ? (
            <CopilotButton variant="icon-subtle" size="sm" className="!rounded-full hover:!bg-white hover:!border hover:!border-neutral-300 hover:!shadow-sm" onClick={e => { e.stopPropagation(); onConnectorClick(task.connectors![0]); }} icon={getConnectorIcon(task.connectors[0], 'w-5 h-5')} />
          ) : (
            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center">{getConnectorIcon(task.connectors[0], 'w-5 h-5')}</span>
          ))}
          {task.outputMeeting && task.status !== 'upcoming' && (
            <CopilotTooltip content="Meeting scheduled as output" placement="top" appearance="normal">
              <span className="text-neutral-400 cursor-pointer hover:text-neutral-600 transition-colors flex-shrink-0 flex items-center">
                <CalendarLtr16Regular className="w-3.5 h-3.5" />
              </span>
            </CopilotTooltip>
          )}
        </div>
        <span className="text-[11px] text-neutral-400">{task.lastUpdated}</span>
      </div>
    </div>
  );
}

// ── Task list row ─────────────────────────────────────────────────────────────

function AttachmentIcon({
  artifact,
  onArtifactClick,
  attachMenuOpen,
  setAttachMenuOpen,
  setAttachMenuPos,
}: {
  artifact: TaskArtifact;
  onArtifactClick: (a: TaskArtifact) => void;
  attachMenuOpen: boolean;
  setAttachMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAttachMenuPos: React.Dispatch<React.SetStateAction<CopilotMenuPosition>>;
}) {
  const files = artifact.sharedFiles && artifact.sharedFiles.length > 0 ? artifact.sharedFiles : null;
  const fileCount = files ? files.length : 1;
  const tooltipText = files
    ? files.map((f, i) => <React.Fragment key={i}>· {f.name}{i < files.length - 1 && <br />}</React.Fragment>)
    : artifact.name;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (files && files.length > 1) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setAttachMenuPos({ top: rect.bottom + 4, left: rect.left });
      setAttachMenuOpen(v => !v);
    } else {
      const file = files?.[0];
      if (file) {
        openFileNatively(extToApp(file.ext), file.url ?? artifact.url);
      } else {
        onArtifactClick(artifact);
      }
    }
  };

  return (
    <CopilotTooltip content={tooltipText} placement="top" appearance="normal">
      <span
        className="flex items-center gap-0.5 text-neutral-400 cursor-pointer hover:text-neutral-600 transition-colors flex-shrink-0"
        onClick={handleClick}
      >
        <Attach16Regular className="w-3.5 h-3.5 flex-shrink-0" />
        {fileCount > 1 && <span className="text-[11px] font-medium">{fileCount}</span>}
      </span>
    </CopilotTooltip>
  );
}

export function TaskRow({ task, onTaskClick, onArtifactClick, animPhase, onConnectorClick, onDeleteClick, tableStyle = false, isLast = false, showStatusCol = false }: TaskCardProps) {
  const effectiveStatus = animPhase === 'complete' || animPhase === 'completing' ? 'complete'
    : animPhase === 'processing' ? 'in-progress'
    : task.status;
  const sc = STATUS_CONFIG[effectiveStatus];
  const artifact = ARTIFACTS[task.id];
  const handleClick = () => onTaskClick(task);

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState<CopilotMenuPosition>({ top: 0, left: 0 });
  const [attachMenuOpen, setAttachMenuOpen] = React.useState(false);
  const [attachMenuPos, setAttachMenuPos] = React.useState<CopilotMenuPosition>({ top: 0, left: 0 });

  const rowStyle: React.CSSProperties = animPhase === 'hidden'
    ? { pointerEvents: 'none' }
    : animPhase === 'entering'
    ? { animation: 'slide-up-fade 0.5s ease-out both' }
    : {};

  const statusEl = (animPhase === 'hidden' || animPhase === 'entering' || animPhase === 'transitioning' || animPhase === 'completing') ? (
    <span className="flex-shrink-0"><LatencyLoader size={16} /></span>
  ) : (
    <span className={`flex-shrink-0 ${sc.textColor}`} style={animPhase === 'complete' ? { animation: 'statusAppear 350ms ease-out' } : undefined}>{sc.icon}</span>
  );

  const rowClass = tableStyle
    ? 'relative flex items-center gap-3 px-4 py-3.5 hover:bg-[hsl(var(--surface-secondary))] transition-colors group cursor-pointer'
    : 'flex items-center gap-3 px-3 py-3 rounded-lg border border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm transition-all group cursor-pointer';

  return (
    <>
      <div onClick={handleClick} style={rowStyle} className={rowClass}>
        {tableStyle && !isLast && <div className="absolute bottom-0 left-0 right-0 h-px bg-[hsl(var(--stroke-default))]" />}
        {/* Status — always first */}
        {showStatusCol ? (
          <div className="flex-shrink-0 flex items-center" style={{ width: 120 }}>
            {(animPhase === 'hidden' || animPhase === 'entering' || animPhase === 'transitioning' || animPhase === 'completing') ? (
              <LatencyLoader size={16} />
            ) : (
              <div className={`inline-flex items-center justify-start gap-1.5 pl-2 pr-3 py-0.5 rounded-full text-xs font-medium whitespace-nowrap w-[108px] ${sc.textColor} ${sc.bgColor} border ${sc.borderColor}`}>
                {sc.icon}<span>{sc.label}</span>
              </div>
            )}
          </div>
        ) : statusEl}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <span className={`text-sm font-normal leading-snug ${effectiveStatus === 'complete' ? 'text-[hsl(var(--text-disabled))]' : 'text-[hsl(var(--text-primary))]'} ${animPhase === 'hidden' ? 'opacity-0' : ''}`}>{task.name}</span>
          </div>
          {task.outputMeeting && task.status !== 'upcoming' && (
            <CopilotTooltip content="Meeting scheduled as output" placement="top" appearance="normal">
              <span className="text-neutral-400 cursor-pointer hover:text-neutral-600 transition-colors flex-shrink-0 flex items-center">
                <CalendarLtr16Regular className="w-3.5 h-3.5" />
              </span>
            </CopilotTooltip>
          )}
          {artifact && (
            <AttachmentIcon
              artifact={artifact}
              onArtifactClick={onArtifactClick}
              attachMenuOpen={attachMenuOpen}
              setAttachMenuOpen={setAttachMenuOpen}
              setAttachMenuPos={setAttachMenuPos}
            />
          )}
          {/* Hover-reveal action buttons */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1" onClick={e => e.stopPropagation()}>
            <CopilotButton
              variant="icon-subtle"
              size="xs"
              icon={<MoreHorizontal20Regular className="w-4 h-4" />}
              title="More options"
              onClick={(e) => {
                e.stopPropagation();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setMenuPos({ top: rect.bottom + 4, left: rect.left });
                setMenuOpen(v => !v);
              }}
            />
          </div>
        </div>
        {/* Date */}
        <span className={`flex-shrink-0 ${tableStyle ? 'text-sm text-[hsl(var(--text-primary))]' : 'text-xs text-neutral-400 text-right'}`} style={{ width: tableStyle ? 130 : 80 }}>
          {tableStyle && task.date ? formatTaskDateShort(task.date) : task.lastUpdated}
        </span>
        {/* Source */}
        <div className="flex items-center gap-1.5 flex-shrink-0 w-16 justify-end">
          {task.connectors?.slice(0, 2).map(c => (
            <span
              key={c}
              title={`Open in ${c}`}
              className="flex-shrink-0 cursor-pointer rounded-full p-0.5 hover:bg-neutral-100 transition-colors"
              onClick={e => { e.stopPropagation(); onConnectorClick ? onConnectorClick(c) : window.open(connectorOpenUrl(c), '_blank'); }}
            >
              {getConnectorIcon(c, 'w-4 h-4')}
            </span>
          ))}
        </div>
      </div>
      {menuOpen && ReactDOM.createPortal(
        <CopilotMenu
          position={menuPos}
          onClose={() => setMenuOpen(false)}
          minWidth={140}
          items={[
            { label: 'Delete', onClick: () => { setMenuOpen(false); onDeleteClick?.(task.id); }, destructive: true },
          ]}
        />,
        document.body,
      )}
      {attachMenuOpen && artifact?.sharedFiles && ReactDOM.createPortal(
        <CopilotMenu
          position={attachMenuPos}
          onClose={() => setAttachMenuOpen(false)}
          minWidth={220}
          items={artifact.sharedFiles.map(f => ({
            label: f.name,
            onClick: () => { setAttachMenuOpen(false); openFileNatively(extToApp(f.ext), f.url ?? artifact.url); },
          }))}
        />,
        document.body,
      )}
    </>
  );
}

// ── View toggle ───────────────────────────────────────────────────────────────

export function ViewToggle({ mode, onChange }: { mode: TaskViewMode; onChange: (m: TaskViewMode) => void }) {
  const btn = (m: TaskViewMode, title: string, iconEl: React.ReactNode) => (
    <CopilotButton
      variant={mode === m ? 'secondary' : 'transparent'}
      size="xs"
      onClick={() => onChange(m)}
      className={`!w-7 !h-7 !rounded-md ${mode === m ? '!bg-white !shadow-sm !text-neutral-900 !border-0' : '!text-neutral-400 hover:!text-neutral-600'}`}
      title={title}
      icon={iconEl}
    />
  );
  return (
    <div className="flex items-center gap-0.5 bg-neutral-100 rounded-lg p-0.5">
      {btn('list',   'List view',   <TextBulletList20Regular className="w-4 h-4" />)}
      {btn('tile',   'Tile view',   <Apps20Regular className="w-4 h-4" />)}
      {btn('kanban', 'Kanban view', <Board20Regular className="w-4 h-4" />)}
    </div>
  );
}

// ── Kanban board ──────────────────────────────────────────────────────────────

const KANBAN_COLUMNS: { status: Day100TaskStatus; label: string }[] = [
  { status: 'incomplete',  label: 'Incomplete' },
  { status: 'in-progress', label: 'In Progress' },
  { status: 'upcoming',    label: 'Upcoming' },
  { status: 'complete',    label: 'Complete' },
];

export function KanbanBoard({ tasks, onTaskClick, onArtifactClick }: {
  tasks: Day100Task[];
  onTaskClick: (task: Day100Task) => void;
  onArtifactClick: (artifact: TaskArtifact) => void;
}) {
  return (
    <div className="flex gap-3 px-1">
      {KANBAN_COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.status);
        const sc = STATUS_CONFIG[col.status];
        const isEmpty = colTasks.length === 0;
        return (
          <div key={col.status} className={`flex flex-col gap-2 transition-all duration-300 ${isEmpty ? 'flex-[0.4] min-w-[120px]' : 'flex-1 min-w-[170px]'}`}>
            {/* Column header */}
            <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg ${sc.bgColor} border ${sc.borderColor} sticky top-0 z-10`}>
              <span className={sc.textColor}>{sc.staticIcon ?? sc.icon}</span>
              <span className={`text-xs font-semibold ${sc.textColor}`}>{col.label}</span>
              <span className={`ml-auto text-[10px] font-medium ${sc.textColor} opacity-70`}>{colTasks.length}</span>
            </div>
            {/* Cards */}
            <div className="flex flex-col gap-2">
              {colTasks.map(task => (
                <TaskTile key={task.id} task={task} onTaskClick={onTaskClick} onArtifactClick={onArtifactClick} />
              ))}
              {colTasks.length === 0 && (
                <div className="flex items-center justify-center h-16 rounded-xl border border-dashed border-neutral-200 text-xs text-neutral-300">
                  No tasks
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Activity log data ─────────────────────────────────────────────────────────

type ActivityItemType = 'task' | 'email' | 'chat' | 'meeting';

interface ActivityLogItem {
  id: string;
  title: string;
  timestamp: string;
  type: ActivityItemType;
  status?: Day100TaskStatus;
}

const DAY100_ACTIVITY: ActivityLogItem[] = [
  // Tasks — mirrors real task statuses from DAY100_TASKS
  { id: 'tl1', type: 'task', status: 'complete',    title: 'Q1 compliance audit report submitted to legal',      timestamp: '2 hours ago' },
  { id: 'tl2', type: 'task', status: 'complete',    title: 'Vendor risk assessments complete — 2 items flagged', timestamp: '2 hours ago' },
  { id: 'tl3', type: 'task', status: 'in-progress', title: 'Security awareness training — 9 employees outstanding', timestamp: 'Yesterday' },
  { id: 'tl4', type: 'task', status: 'complete',    title: 'Onboarding package sent to Riley Chen',              timestamp: 'Yesterday, 4:32 PM' },
  { id: 'tl5', type: 'task', status: 'complete',    title: 'M365 Copilot adoption — March metrics drafted',      timestamp: '3 hours ago' },
  // Email — mirrors SAMPLE_MESSAGES email items
  { id: 'el1', type: 'email', title: 'Q1 compliance audit report submitted to legal',      timestamp: '2 minutes ago' },
  { id: 'el2', type: 'email', title: 'Vendor risk assessments — 2 items flagged',          timestamp: '2 hours ago' },
  { id: 'el3', type: 'email', title: 'Onboarding package sent to new hire — Riley Chen',   timestamp: 'Yesterday, 4:32 PM' },
  { id: 'el4', type: 'email', title: 'Stakeholder meeting follow-up — EMEA expansion approved', timestamp: 'Mar 20' },
  // Teams chats — mirrors SAMPLE_MESSAGES chat items
  { id: 'cl1', type: 'chat', title: 'Q2 roadmap priorities — alignment check with Lydia',  timestamp: '18 minutes ago' },
  { id: 'cl2', type: 'chat', title: 'M365 Copilot adoption — March metrics ready',         timestamp: '3 hours ago' },
  { id: 'cl3', type: 'chat', title: 'Security awareness training — 9 employees still outstanding', timestamp: 'Yesterday, 2:05 PM' },
  // Meetings — mirrors SAMPLE_MESSAGES meeting items
  { id: 'ml1', type: 'meeting', title: 'Weekly standup — March 23',                          timestamp: '1 hour ago' },
  { id: 'ml2', type: 'meeting', title: 'AI Teammate capability review with Lydia — Mar 21',  timestamp: 'Mar 21, 10:00 AM' },
];

// ── Main component ────────────────────────────────────────────────────────────

export const DWOverviewTab: React.FC = () => {
  const { userName, agentConfig } = useAgent();
  const { isAiTeammateDay100, day0AnimKey, setDwTab, setDwTaskFilter, setDwMessageFilter, dwTasks, isDexter, getDexterAuthFetch, removeDwTaskById } = useDW();
  const authFetch = getDexterAuthFetch();
  const dwProfile = useSharedDexterWorkerProfile();

  const [taskViewMode] = useState<TaskViewMode>('list');
  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null);
  const [animPhases, setAnimPhases] = useState<Record<string, AnimPhase>>({});
  const animTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [showSkillBrowser, setShowSkillBrowser] = useState(false);
  const [skillSearch, setSkillSearch] = useState('');
  const [skillCategoryFilter, setSkillCategoryFilter] = useState<string | null>(null);
  const [addingSkillId, setAddingSkillId] = useState<string | null>(null);
  const [skillError, setSkillError] = useState<string | null>(null);
  const [viewingSkill, setViewingSkill] = useState<{ skill: DexterWorkspaceSkill; name: string } | null>(null);

  // Worker skills from the Dexter API
  const workerSkills: DexterWorkspaceSkill[] = dwProfile.worker?.skills ?? [];

  // Chat-added tasks from shared context (persisted, synced with DWTasksTab)
  const extraTasks = (dwTasks[agentConfig.id] || []).map(t => ({
    id: t.id,
    name: t.name,
    subtitle: t.subtitle,
    status: (t.status === 'blocked' ? 'incomplete' : t.status) as Day100TaskStatus,
    lastUpdated: t.lastUpdated,
    date: t.date,
  }));

  // Filter the full skill catalog for the browse dialog
  const filteredCatalog = SKILL_CATALOG.filter(entry => {
    if (skillCategoryFilter && entry.category !== skillCategoryFilter) return false;
    if (skillSearch) {
      const q = skillSearch.toLowerCase();
      return entry.name.toLowerCase().includes(q) || entry.description.toLowerCase().includes(q);
    }
    return true;
  });

  // Add a catalog skill to the worker via PUT API
  const handleAddCatalogSkill = async (entry: SkillCatalogEntry) => {
    if (!isDexter || !authFetch || !dwProfile.worker || !agentConfig.dexterWorkerId) return;
    setAddingSkillId(entry.id);
    setSkillError(null);
    try {
      const updatedSkills = [...workerSkills, { ...entry.skill }];
      await updateDexterWorker(authFetch, agentConfig.dexterWorkerId, { skills: updatedSkills });
      dwProfile.refresh();
    } catch (err: unknown) {
      setSkillError(err instanceof Error ? err.message : 'Failed to add skill');
    } finally {
      setAddingSkillId(null);
    }
  };

  // Remove a worker skill via PUT API — matches by name to avoid stale-index bugs
  const handleRemoveWorkerSkill = async (skillName: string) => {
    if (!isDexter || !authFetch || !agentConfig.dexterWorkerId) return;
    setSkillError(null);
    try {
      const updatedSkills = workerSkills.filter(s => s.name !== skillName);
      await updateDexterWorker(authFetch, agentConfig.dexterWorkerId, { skills: updatedSkills });
      dwProfile.refresh();
    } catch (err: unknown) {
      setSkillError(err instanceof Error ? err.message : 'Failed to remove skill');
    }
  };

  const handleDay0ConnectorClick = (connector: string) => {
    if (connector === 'teams') {
      window.open(TEAMS_PREVIEW_URL || 'about:blank', '_blank');
    }
  };

  useEffect(() => {
    if (isAiTeammateDay100) return;
    const ids = ['t1', 't2', 't3'];
    animTimersRef.current.forEach(clearTimeout);
    animTimersRef.current = [];

    // Skip animation if we've already run it for this day0AnimKey (e.g. returning to tab)
    const lastDoneKey = parseInt(getAgentStorage(agentConfig.id, 'day0AnimDoneKey') ?? '-1', 10);
    if (lastDoneKey >= day0AnimKey) {
      setAnimPhases(Object.fromEntries(ids.map(id => [id, 'complete' as AnimPhase])));
      return;
    }

    // Mark immediately so a mid-animation tab-switch doesn't re-trigger on return
    setAgentStorage(agentConfig.id, 'day0AnimDoneKey', String(day0AnimKey));

    setAnimPhases(Object.fromEntries(ids.map(id => [id, 'hidden' as AnimPhase])));
    ids.forEach((id, i) => {
      const entryAt      = i * ANIM_STAGGER;
      const transAt      = entryAt + ANIM_ENTRY_DUR + ANIM_PROCESS_OFFSET;
      const procAt       = transAt + ANIM_TRANSITION_DUR;
      const completingAt = procAt + ANIM_PROCESS_DUR;
      const doneAt       = completingAt + ANIM_COMPLETING_DUR;
      animTimersRef.current.push(
        setTimeout(() => setAnimPhases(prev => ({ ...prev, [id]: 'entering' })),     entryAt),
        setTimeout(() => setAnimPhases(prev => ({ ...prev, [id]: 'transitioning' })), transAt),
        setTimeout(() => setAnimPhases(prev => ({ ...prev, [id]: 'processing' })),   procAt),
        setTimeout(() => setAnimPhases(prev => ({ ...prev, [id]: 'completing' })),   completingAt),
        setTimeout(() => setAnimPhases(prev => ({ ...prev, [id]: 'complete' })),     doneAt),
      );
    });
    return () => { animTimersRef.current.forEach(clearTimeout); };
  }, [day0AnimKey, isAiTeammateDay100, agentConfig.id]);  

  const fullName = userName || 'Avery Fuller';

  const handleOpenInTeams = () => openTeamsChat(dwProfile, agentConfig);

  const handleTaskClick = (task: Day100Task) => {
    const detail = TASK_DETAILS[task.id] ?? TASK_DETAILS.default;
    setSelectedTask({ id: task.id, name: task.name, subtitle: task.subtitle, status: task.status, lastUpdated: task.lastUpdated, date: task.date, ...detail });
  };

  const handleArtifactClick = (artifact: TaskArtifact) => {
    openFileNatively(artifact.appKey ?? artifact.type, artifact.url);
  };

  // ── Drill-in views ──────────────────────────────────────────────────────────

  if (selectedTask) {
    return <DWTaskDetailPanel task={selectedTask} onClose={() => setSelectedTask(null)} />;
  }

  // ── Day 0 data ──────────────────────────────────────────────────────────────

  const DAY0_TASKS = makeDay0Tasks(fullName);



  // ── Task filtering ──────────────────────────────────────────────────────────

  const STATUS_SORT_ORDER: Record<Day100TaskStatus, number> = {
    incomplete: 0,
    'in-progress': 1,
    upcoming: 2,
    complete: 3,
  };
  const sortTasks = (tasks: Day100Task[]) =>
    [...tasks].sort((a, b) => STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status]);

  const sortByDate = (tasks: Day100Task[]) =>
    [...tasks].sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0;
      const bTime = b.date ? new Date(b.date).getTime() : 0;
      return bTime - aTime;
    });

  // Build a visible slice that guarantees one task of each status, then fills by recency
  const buildVisibleWithCoverage = (tasks: Day100Task[], size: number): Day100Task[] => {
    const statuses: Day100TaskStatus[] = ['incomplete', 'in-progress', 'upcoming', 'complete'];
    const picked = new Set<string>();
    const guaranteed: Day100Task[] = [];
    for (const status of statuses) {
      const found = tasks.find(t => t.status === status && !picked.has(t.id));
      if (found) { guaranteed.push(found); picked.add(found.id); }
    }
    const remaining = tasks.filter(t => !picked.has(t.id));
    const combined = [...guaranteed, ...remaining.slice(0, Math.max(0, size - guaranteed.length))];
    return sortByDate(combined);
  };

  const allDay100Tasks = [...extraTasks, ...DAY100_TASKS];
  // Sort Day 100 by date descending (most recent first)
  const statusFilteredDay100 = sortByDate(allDay100Tasks);

  // Day 0: resolve effective status from animPhase so displayed status matches
  const allDay0Tasks = [...extraTasks, ...DAY0_TASKS].map(t => ({
    ...t,
    status: (animPhases[t.id] === 'complete' ? 'complete' : t.status) as Day100TaskStatus,
  }));
  const statusFilteredDay0 = allDay0Tasks; // preserve original order during Day 0 animation

  const isKanban = taskViewMode === 'kanban';
  const sliceSize = taskViewMode === 'tile' ? 6 : 5;
  // User-added tasks always appear first; fill remaining slots from static tasks via coverage logic
  const extraTaskIds = new Set(extraTasks.map(t => t.id));
  const staticDay100 = statusFilteredDay100.filter(t => !extraTaskIds.has(t.id));
  const staticSlots = Math.max(0, sliceSize - extraTasks.length);
  const day100VisibleTasks = [...sortByDate(extraTasks), ...buildVisibleWithCoverage(staticDay100, staticSlots)];
  const remainingCount = statusFilteredDay100.length - day100VisibleTasks.length;
  const day0VisibleTasks = [...extraTasks, ...statusFilteredDay0.filter(t => !extraTaskIds.has(t.id))].slice(0, sliceSize);
  const remainingDay0Count = statusFilteredDay0.length - day0VisibleTasks.length;

  const activeTasks = isAiTeammateDay100 ? statusFilteredDay100 : statusFilteredDay0;
  const incompleteCount = activeTasks.filter(t => t.status === 'incomplete').length;

  return (
    <>
    <style>{STATUS_APPEAR_KEYFRAMES}</style>
    <div className="flex flex-col gap-4">

      {/* ── Open in Teams + Recent Activity ──────────────────────────────── */}
      {(() => {
        // Build summarised category rows from real data counts
        type Category = { type: ActivityItemType; label: string; icon: React.ReactNode; summary: string; onClick: () => void };
        const categories: Category[] = [];

        if (isAiTeammateDay100) {
          const taskItems  = DAY100_ACTIVITY.filter(a => a.type === 'task');
          const complete   = taskItems.filter(i => i.status === 'complete').length;
          const inProgress = taskItems.filter(i => i.status === 'in-progress').length;
          const emailCount   = DAY100_ACTIVITY.filter(a => a.type === 'email').length;
          const chatCount    = DAY100_ACTIVITY.filter(a => a.type === 'chat').length;
          const meetingCount = DAY100_ACTIVITY.filter(a => a.type === 'meeting').length;
          categories.push({ type: 'task',    label: 'Tasks',    icon: <CheckmarkCircle16Regular className="w-3.5 h-3.5 text-green-600" />, summary: inProgress > 0 ? `${complete} completed · ${inProgress} in progress` : `${complete} completed`, onClick: () => { setDwTaskFilter('complete'); setDwTab('tasks'); } });
          categories.push({ type: 'email',   label: 'Email',    icon: getConnectorIcon('outlook', 'w-3.5 h-3.5'), summary: emailCount   > 0 ? `${emailCount} sent`        : '—', onClick: () => { setDwMessageFilter('email'); setDwTab('messages'); } });
          categories.push({ type: 'chat',    label: 'Teams',    icon: getConnectorIcon('teams',   'w-3.5 h-3.5'), summary: chatCount    > 0 ? `${chatCount} chats`        : '—', onClick: () => { setDwMessageFilter('chat'); setDwTab('messages'); } });
          categories.push({ type: 'meeting', label: 'Meetings', icon: <CalendarLtr16Regular className="w-3.5 h-3.5" style={{ color: '#165AD9' }} />, summary: meetingCount > 0 ? `${meetingCount} this week` : '—', onClick: () => { setDwTaskFilter('with-meeting'); setDwTab('tasks'); } });
        } else {
          const done = allDay0Tasks.filter(t => animPhases[t.id] === 'complete' || t.status === 'complete').length;
          categories.push({ type: 'task',    label: 'Tasks',    icon: <CheckmarkCircle16Regular className="w-3.5 h-3.5 text-green-600" />, summary: done > 0 ? `${done} completed today` : '—', onClick: () => { setDwTaskFilter('complete'); setDwTab('tasks'); } });
          categories.push({ type: 'email',   label: 'Email',    icon: getConnectorIcon('outlook', 'w-3.5 h-3.5'), summary: '—', onClick: () => { setDwMessageFilter('email'); setDwTab('messages'); } });
          categories.push({ type: 'chat',    label: 'Teams',    icon: getConnectorIcon('teams',   'w-3.5 h-3.5'), summary: '—', onClick: () => { setDwMessageFilter('chat'); setDwTab('messages'); } });
          categories.push({ type: 'meeting', label: 'Meetings', icon: <CalendarLtr16Regular className="w-3.5 h-3.5" style={{ color: '#165AD9' }} />, summary: '—', onClick: () => { setDwTaskFilter('with-meeting'); setDwTab('tasks'); } });
        }

        return (
          <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>

            {/* ── Recent Activity card ─────────────────────────────────────── */}
            <div className="rounded-xl border border-neutral-200 bg-white p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <TextBulletList20Regular className="w-4 h-4 text-neutral-500" />
                </div>
                <p className="text-sm font-semibold text-neutral-900">Recent Activity</p>
              </div>

              <div className="flex flex-col divide-y divide-neutral-100">
                {categories.map(cat => (
                  <div key={cat.type} className="flex items-center gap-2 py-1 first:pt-0 last:pb-0 cursor-pointer rounded hover:bg-neutral-50 -mx-1 px-1 transition-colors" onClick={cat.onClick}>
                    <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">{cat.icon}</span>
                    <span className="text-sm text-neutral-600 flex-1">{cat.label}</span>
                    <span className="text-sm text-neutral-400">{cat.summary}</span>
                  </div>
                ))}
              </div>

            </div>

            {/* ── Open in Teams card ───────────────────────────────────────── */}
            <div
              className="rounded-xl border border-[#C8C6F5] bg-[#F3F2FC] flex flex-col p-4 gap-3 cursor-pointer hover:bg-[#EBEBF8] transition-colors"
              onClick={handleOpenInTeams}
            >
              <div className="flex items-center justify-between gap-2 flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {getConnectorIcon('teams', 'w-5 h-5')}
                  </div>
                  <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">Chat & manage in Microsoft Teams</p>
                </div>
                {isDexter && (
                  <div className="flex-shrink-0">
                    {agentConfig.lifecycleStatus === 'failed' ? (
                      <CopilotTooltip content={agentConfig.lifecycleError || 'Unknown error'} placement="bottom">
                        <CopilotBadge appearance="tint" color="danger">Failed</CopilotBadge>
                      </CopilotTooltip>
                    ) : agentConfig.lifecycleStatus === 'provisioning' ? (
                      <CopilotBadge appearance="tint" color="informative">Provisioning…</CopilotBadge>
                    ) : agentConfig.lifecycleStatus === 'ready' ? (
                      <CopilotBadge appearance="tint" color="success">Ready</CopilotBadge>
                    ) : (
                      <CopilotBadge appearance="outline" color="danger">Not provisioned</CopilotBadge>
                    )}
                  </div>
                )}
              </div>
              <p className="text-sm text-[#6264A7] leading-relaxed">
                {agentConfig.name || 'Your AI Teammate'} is ready — chat, assign tasks, and collaborate directly in Teams.
              </p>
              <div className="mt-auto">
                <CopilotButton variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenInTeams(); }}>
                  Chat with {agentConfig.name}
                </CopilotButton>
              </div>
            </div>

          </div>
        );
      })()}

      {/* ── KPI tiles — only shown once there is real activity data ────────── */}
      {isAiTeammateDay100 && <div className="grid grid-cols-2 gap-4">

        {/* Tile 1 — Incomplete tasks */}
        <div
          className="flex flex-col gap-3 p-4 rounded-xl bg-neutral-50 hover:bg-neutral-100 transition-colors cursor-pointer"
          onClick={() => { setDwTaskFilter('attention'); setDwTab('tasks'); }}
        >
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <ErrorCircle20Filled className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-sm font-semibold text-neutral-900">Needs Attention</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-neutral-900">{incompleteCount}</p>
            <p className="text-xs text-neutral-500 mt-0.5">{incompleteCount === 0 ? 'All tasks on track' : 'Tasks incomplete or blocked'}</p>
          </div>
        </div>

        {/* Tile 2 — Time savings / ROI */}
        <div className="flex flex-col gap-3 p-4 rounded-xl bg-neutral-50 hover:bg-neutral-100 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <ArrowTrendingLines20Regular className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-sm font-semibold text-neutral-900">Time Saved</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-neutral-900">{isAiTeammateDay100 ? '14.2' : '—'}<span className="text-base font-medium text-neutral-500 ml-1">{isAiTeammateDay100 ? 'hrs' : ''}</span></p>
            <p className="text-xs text-neutral-500 mt-0.5">{isAiTeammateDay100 ? 'Saved this week vs. manual effort' : 'Time savings will appear once active'}</p>
          </div>
        </div>

      </div>}

      {/* ── Recent Tasks ──────────────────────────────────────────────────── */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-neutral-900">Recent Tasks</h2>
          <CopilotButton variant="outline" size="sm" onClick={() => setShowAddTaskDialog(true)}>
            Add task
          </CopilotButton>
        </div>

        {isAiTeammateDay100 ? (
          <>
            {isKanban ? (
              <div className="overflow-x-auto">
                <KanbanBoard tasks={statusFilteredDay100} onTaskClick={handleTaskClick} onArtifactClick={handleArtifactClick} />
              </div>
            ) : taskViewMode === 'tile' ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {day100VisibleTasks.map(task => (
                  <TaskTile key={task.id} task={task} onTaskClick={handleTaskClick} onArtifactClick={handleArtifactClick} />
                ))}
              </div>
            ) : (
              <div className="border border-[hsl(var(--stroke-default))] rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 text-xs font-semibold text-[hsl(var(--text-disabled))] border-b border-[hsl(var(--stroke-default))]">
                  <span className="flex-shrink-0" style={{ width: 120 }}>Status</span>
                  <span className="flex-1">Task</span>
                  <span className="flex-shrink-0" style={{ width: 130 }}>Date</span>
                  <span className="w-16 flex-shrink-0 text-right">Location</span>
                </div>
                {day100VisibleTasks.map((task, idx) => (
                  <TaskRow key={task.id} task={task} onTaskClick={handleTaskClick} onArtifactClick={handleArtifactClick} onDeleteClick={(id) => removeDwTaskById(agentConfig.id, id)} tableStyle showStatusCol isLast={idx === day100VisibleTasks.length - 1} />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {isKanban ? (
              <div className="overflow-x-auto">
                <KanbanBoard tasks={statusFilteredDay0.map(t => ({ ...t, status: 'complete' as Day100TaskStatus }))} onTaskClick={handleTaskClick} onArtifactClick={handleArtifactClick} />
              </div>
            ) : taskViewMode === 'tile' ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {day0VisibleTasks.map(task => (
                  <TaskTile key={task.id} task={task} onTaskClick={handleTaskClick} onArtifactClick={handleArtifactClick} animPhase={animPhases[task.id]} onConnectorClick={task.id === 't1' ? handleDay0ConnectorClick : undefined} />
                ))}
              </div>
            ) : (
              <div className="border border-[hsl(var(--stroke-default))] rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 text-xs font-semibold text-[hsl(var(--text-disabled))] border-b border-[hsl(var(--stroke-default))]">
                  <span className="flex-shrink-0" style={{ width: 120 }}>Status</span>
                  <span className="flex-1">Task</span>
                  <span className="flex-shrink-0" style={{ width: 130 }}>Date</span>
                  <span className="w-16 flex-shrink-0 text-right">Location</span>
                </div>
                {day0VisibleTasks.map((task, idx) => (
                  <TaskRow key={task.id} task={task} onTaskClick={handleTaskClick} onArtifactClick={handleArtifactClick} animPhase={animPhases[task.id]} onConnectorClick={task.id === 't1' ? handleDay0ConnectorClick : undefined} onDeleteClick={(id) => removeDwTaskById(agentConfig.id, id)} tableStyle showStatusCol isLast={idx === day0VisibleTasks.length - 1} />
                ))}
              </div>
            )}
          </>
        )}
        <CopilotButton
          variant="transparent"
          size="xs"
          onClick={() => setDwTab('tasks')}
          className="!text-neutral-400 hover:!text-brand !px-0 mt-2"
        >
          View all tasks
        </CopilotButton>
      </div>


      {/* Skill catalog browser dialog */}
      <Dialog isOpen={showSkillBrowser} onClose={() => { setShowSkillBrowser(false); setSkillSearch(''); setSkillCategoryFilter(null); }} maxWidth="xl">
        <DialogHeader onClose={() => { setShowSkillBrowser(false); setSkillSearch(''); setSkillCategoryFilter(null); }}>
          <DialogTitle>Add Skill to Worker</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="flex flex-col gap-4">
            <div className="flex gap-3 items-center">
              <CopilotInput
                value={skillSearch}
                onChange={e => setSkillSearch(e.target.value)}
                placeholder="Search skills..."
                size="md"
                className="flex-1"
              />
            </div>
            {/* Category filter pills */}
            <div className="flex flex-wrap gap-2">
              <CopilotButton
                variant={skillCategoryFilter === null ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setSkillCategoryFilter(null)}
              >
                All ({SKILL_CATALOG.length})
              </CopilotButton>
              {SKILL_CATEGORIES.map(cat => (
                <CopilotButton
                  key={cat}
                  variant={skillCategoryFilter === cat ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setSkillCategoryFilter(skillCategoryFilter === cat ? null : cat)}
                >
                  {cat} ({SKILL_CATALOG.filter(s => s.category === cat).length})
                </CopilotButton>
              ))}
            </div>
            {skillError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{skillError}</div>
            )}
            {filteredCatalog.length === 0 ? (
              <p className="text-sm text-neutral-500 py-4 text-center">No skills match your search.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
                {filteredCatalog.map(entry => {
                  const alreadyAdded = workerSkills.some(ws => ws.name === entry.skill.name);
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${alreadyAdded ? 'border-green-200 bg-green-50' : 'border-neutral-200 bg-white hover:shadow-sm hover:border-neutral-300'}`}
                    >
                      <div className={`w-8 h-8 rounded-lg ${entry.iconBg} ${entry.iconColor} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <FlashRegular className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-neutral-900 leading-snug">{entry.name}</p>
                        <p className="text-xs text-neutral-400 mb-0.5">{entry.category}</p>
                        <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2">{entry.description}</p>
                        {entry.skill.tools.length > 0 && (
                          <p className="text-xs text-neutral-400 mt-1">{entry.skill.tools.length} tool{entry.skill.tools.length !== 1 ? 's' : ''}</p>
                        )}
                      </div>
                      <CopilotButton
                        variant={alreadyAdded ? 'outline' : 'primary'}
                        size="sm"
                        disabled={alreadyAdded || addingSkillId === entry.id}
                        onClick={() => handleAddCatalogSkill(entry)}
                        className="flex-shrink-0"
                      >
                        {addingSkillId === entry.id ? '...' : alreadyAdded ? 'Added' : 'Add'}
                      </CopilotButton>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
        <DialogFooter>
          <CopilotButton variant="outline" size="md" onClick={() => { setShowSkillBrowser(false); setSkillSearch(''); setSkillCategoryFilter(null); }}>
            Done
          </CopilotButton>
        </DialogFooter>
      </Dialog>

      {/* Skill detail dialog — shows instructions/definition sent to the worker API */}
      <Dialog isOpen={!!viewingSkill} onClose={() => setViewingSkill(null)} maxWidth="lg">
        {viewingSkill && (
          <>
            <DialogHeader onClose={() => setViewingSkill(null)}>
              <DialogTitle>{viewingSkill.skill.name || 'Skill Detail'}</DialogTitle>
            </DialogHeader>
            <DialogContent>
              <div className="flex flex-col gap-4">
                {/* Metadata */}
                <div className="grid grid-cols-[120px_1fr] gap-y-2 gap-x-4 text-sm">
                  <span className="text-neutral-500 font-medium">Name</span>
                  <span className="font-mono text-xs">{viewingSkill.skill.name}</span>

                  <span className="text-neutral-500 font-medium">Enabled</span>
                  <span>{viewingSkill.skill.enabled ? 'Yes' : 'No'}</span>

                  {viewingSkill.skill.model ? (
                    <>
                      <span className="text-neutral-500 font-medium">Model</span>
                      <span>{viewingSkill.skill.model}</span>
                    </>
                  ) : null}

                  <span className="text-neutral-500 font-medium">Tools</span>
                  <span>
                    {viewingSkill.skill.tools.length > 0
                      ? viewingSkill.skill.tools.map((t, i) => (
                          <CopilotBadge key={i} color="subtle" size="small" className="mr-1 mb-1">
                            {t.type === 'http' ? (t.url || t.type) : t.type === 'stdio' ? (t.packageName || t.type) : (t.connectorName ?? t.type)}
                          </CopilotBadge>
                        ))
                      : <span className="text-neutral-400">None</span>}
                  </span>

                  <span className="text-neutral-500 font-medium">Knowledge</span>
                  <span>
                    {viewingSkill.skill.knowledge.length > 0
                      ? viewingSkill.skill.knowledge.map((k, i) => (
                          <CopilotBadge key={i} color="subtle" size="small" className="mr-1 mb-1">
                            {k.name || k.value}
                          </CopilotBadge>
                        ))
                      : <span className="text-neutral-400">None</span>}
                  </span>
                </div>

                {/* Description */}
                {viewingSkill.skill.description ? (
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-800 mb-1">Description</h4>
                    <p className="text-sm text-neutral-700">{viewingSkill.skill.description}</p>
                  </div>
                ) : null}

                {/* Instructions — the markdown definition sent to the worker */}
                <div>
                  <h4 className="text-sm font-semibold text-neutral-800 mb-1">Instructions (sent to worker)</h4>
                  {viewingSkill.skill.instructions ? (
                    <pre className="text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg p-4 whitespace-pre-wrap overflow-x-auto max-h-[400px] font-mono">
                      {viewingSkill.skill.instructions}
                    </pre>
                  ) : (
                    <p className="text-sm text-neutral-400 italic">No instructions defined.</p>
                  )}
                </div>
              </div>
            </DialogContent>
            <DialogFooter>
              <CopilotButton
                variant="outline"
                size="md"
                className="text-red-600 border-red-300 hover:bg-red-50"
                onClick={() => { handleRemoveWorkerSkill(viewingSkill.name); setViewingSkill(null); }}
              >
                Remove Skill
              </CopilotButton>
              <CopilotButton variant="outline" size="md" onClick={() => setViewingSkill(null)}>
                Close
              </CopilotButton>
            </DialogFooter>
          </>
        )}
      </Dialog>

      <DWAddTaskDialog open={showAddTaskDialog} onClose={() => setShowAddTaskDialog(false)} />

    </div>
    </>
  );
};
