import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  MoreHorizontal20Regular,
  DocumentText20Regular,
  Search20Regular,
  Dismiss20Regular,
  Folder20Regular,
  DocumentPdf20Regular,
  Notebook20Regular,
  Checkmark20Regular,
  ChevronDown20Regular,
} from '@fluentui/react-icons';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotFilterPill } from '../../../components/ui/CopilotFilterPill';
import { CopilotMenu, CopilotMenuPosition } from '../../../components/ui/CopilotMenu';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { getConnectorIcon } from '../../../utils/agentIcons';
import { AVATAR_COLORS, initials, avatarColor } from '../../../utils/avatarUtils';
import { useAgent } from '../../../context/AgentContext';
import { useDW } from '../context/DWContext';
import { ARTIFACTS } from '../data/dwArtifactData';
import { openFileNatively } from '../../../utils/openFileNatively';
import { formatDwDate, formatDwActivityDate } from '../utils/dwDateUtils';
import { DWSortIcon } from './DWSortIcon';
import { DWNotebooksView, getNotebooks } from './DWNotebooksView';
import { DWAddFilesDialog } from './DWAddFilesDialog';

// ── Types ─────────────────────────────────────────────────────────────────────

type DeliverableType = 'document' | 'spreadsheet' | 'presentation' | 'note' | 'report';
type FileAction = 'created' | 'edited' | 'commented' | 'viewed' | 'assigned';
type AppFilter = 'all' | 'folder' | 'notes' | 'word' | 'excel' | 'powerpoint' | 'pdf';
type SortCol = 'name' | 'date' | 'sharedBy';
type SortDir = 'asc' | 'desc';

export interface Deliverable {
  id: string;
  name: string;
  type: DeliverableType;
  app: string; // connector key for icon (word, excel, powerpoint, onenote)
  location: string;
  action: FileAction;
  actionText: string;
  /** Short activity reason shown in overview pills and file list (e.g. 'Edited', 'Left a comment') */
  reason: string;
  owner?: string;
  date: string; // ISO for sort
  url?: string; // native open URL
  /** Links back to the originating TaskArtifact so the detail panel can be opened */
  artifactId?: string;
  /** Display name of the task that produced this file */
  taskName?: string;
  /** Notebook id to navigate to when row is clicked (note-type entries) */
  notebookId?: string;
  /** Page id within the notebook to open (undefined = overview) */
  notebookPageId?: string;
  /** True for note-type entries created/maintained by the AI Teammate */
  isAgentNote?: boolean;
}

// ── Static file data ───────────────────────────────────────────────────────────

export const DELIVERABLES: Deliverable[] = [
  {
    id: 'd1',
    name: '[Internal] M365 Companion - Copilot Value Walking Deck',
    type: 'presentation',
    app: 'powerpoint',
    location: 'OneDrive',
    action: 'created',
    reason: 'Created',
    actionText: 'Created 5 hours ago',
    date: '2026-03-19T14:00:00',
    url: '/demo-files/copilot-value-deck.pptx',
  },
  {
    id: 'd2',
    name: 'Q2 Budget Summary',
    type: 'spreadsheet',
    app: 'excel',
    location: 'SharePoint',
    action: 'assigned',
    reason: 'Assigned task',
    actionText: 'Assigned yesterday',
    date: '2026-03-18T09:00:00',
    url: '/demo-files/q2-budget-summary.xlsx',
  },
  {
    id: 'd3',
    name: 'Accessibility Requirements',
    type: 'document',
    app: 'word',
    location: 'SharePoint',
    action: 'edited',
    reason: 'Edited',
    actionText: 'Edited · owned by Sarah Chen',
    owner: 'Sarah Chen',
    date: '2026-03-18T11:30:00',
    url: '/demo-files/accessibility-reqs.docx',
  },
  {
    id: 'd4',
    name: 'CEO Townhall — July Cut',
    type: 'presentation',
    app: 'powerpoint',
    location: 'SharePoint',
    action: 'commented',
    reason: 'Commented',
    actionText: 'Commented yesterday · owned by Lydia Barnes',
    owner: 'Lydia Barnes',
    date: '2026-03-17T16:00:00',
    url: '/demo-files/ceo-townhall.pptx',
  },
  {
    id: 'd5',
    name: 'Weekly Status Report — Week 28',
    type: 'report',
    app: 'word',
    location: 'OneDrive',
    action: 'created',
    reason: 'Created',
    actionText: 'Created on March 16',
    date: '2026-03-16T08:00:00',
    url: '/demo-files/weekly-status-report.docx',
  },
  {
    id: 'd6',
    name: 'Compliance Audit Checklist',
    type: 'spreadsheet',
    app: 'excel',
    location: 'OneDrive',
    action: 'viewed',
    reason: 'Opened',
    actionText: 'Viewed yesterday · owned by Priya Nair',
    owner: 'Priya Nair',
    date: '2026-03-17T10:00:00',
    url: '/demo-files/compliance-checklist.xlsx',
  },
  {
    id: 'd7',
    name: 'Project Timeline Tracker',
    type: 'spreadsheet',
    app: 'excel',
    location: 'SharePoint',
    action: 'edited',
    reason: 'Edited',
    actionText: 'Edited on March 15 · owned by James Okafor',
    owner: 'James Okafor',
    date: '2026-03-15T13:00:00',
    url: '/demo-files/project-timeline.xlsx',
  },
  {
    id: 'd8',
    name: 'Onboarding Checklist — New Hire',
    type: 'document',
    app: 'word',
    location: 'SharePoint',
    action: 'assigned',
    reason: 'Assigned task',
    actionText: 'Assigned on March 14',
    date: '2026-03-14T09:00:00',
    url: '/demo-files/onboarding-checklist.docx',
  },
  {
    id: 'd9',
    name: 'Employee Coworkers Notebook',
    type: 'note',
    app: 'onenote',
    location: 'OneNote',
    action: 'edited',
    reason: 'Updated',
    actionText: 'Updated March 13',
    date: '2026-03-13T15:00:00',
    notebookId: 'coworkers',
    notebookPageId: 'ana',
    isAgentNote: true,
  },
  {
    id: 'd10',
    name: 'Launch Event Highlights',
    type: 'presentation',
    app: 'powerpoint',
    location: 'SharePoint',
    action: 'edited',
    reason: 'Edited',
    actionText: 'Edited on March 17 · owned by Marcus Webb',
    owner: 'Marcus Webb',
    date: '2026-03-17T14:00:00',
    url: '/demo-files/launch-highlights.pptx',
  },
  {
    id: 'd11',
    name: 'Q1 Retrospective Summary',
    type: 'report',
    app: 'word',
    location: 'SharePoint',
    action: 'created',
    reason: 'Created',
    actionText: 'Created on March 12',
    date: '2026-03-12T10:00:00',
    url: '/demo-files/weekly-status-report.docx',
  },
  {
    id: 'd12',
    name: 'Daily Notebook',
    type: 'note',
    app: 'onenote',
    location: 'OneNote',
    action: 'edited',
    reason: 'Updated',
    actionText: 'Updated March 10',
    date: '2026-03-10T11:00:00',
    notebookId: 'daily',
    notebookPageId: 'march-29',
    isAgentNote: true,
  },
];

// ── Task-derived files ────────────────────────────────────────────────────────
// Files produced by or associated with tasks via ARTIFACTS.
// Artifact types 'email' and 'chat' are not files — excluded.

const FILE_ARTIFACT_TYPES = new Set(['word', 'excel', 'powerpoint', 'file', 'sharepoint']);

const ARTIFACT_TYPE_MAP: Record<string, DeliverableType> = {
  word: 'document',
  excel: 'spreadsheet',
  powerpoint: 'presentation',
  file: 'document',
  sharepoint: 'document',
};

const SHAREPOINT_EXT_TYPE: Record<string, DeliverableType> = {
  docx: 'document', doc: 'document',
  xlsx: 'spreadsheet', xls: 'spreadsheet', csv: 'report',
  pptx: 'presentation', ppt: 'presentation',
  pdf: 'report',
};

// Task names keyed by artifact ID — covers all file-producing artifacts in DAY100_TASKS
const ARTIFACT_TASK_NAMES: Record<string, string> = {
  h1:  'Quarterly report summary',
  h2:  'Team standup notes',
  h3:  'Vendor contract review',
  h5:  'New hire onboarding pack',
  h7:  'Budget variance analysis',
  h8:  'Product roadmap update',
  h10: 'Competitor landscape refresh',
  h11: 'Compliance audit',
};

// Activity reason per artifact — shown in overview pills and file list
const ARTIFACT_REASONS: Record<string, string> = {
  h1:  'Created',
  h2:  'Edited',
  h3:  'Commented',
  h5:  'Created',
  h7:  'Edited',
  h8:  'Assigned task',
  h10: 'Opened',
  h11: 'Commented',
};

// Approximate dates based on task lastUpdated values in DAY100_TASKS
const ARTIFACT_DATES: Record<string, string> = {
  h1:  '2026-03-23T10:00:00',
  h2:  '2026-03-22T09:00:00',
  h3:  '2026-03-21T10:00:00',
  h5:  '2026-03-18T10:00:00',
  h7:  '2026-03-19T09:45:00',
  h8:  '2026-03-19T09:30:00',
  h10: '2026-03-15T08:00:00',
  h11: '2026-03-11T10:00:00',
};

export const TASK_FILES: Deliverable[] = Object.values(ARTIFACTS)
  .filter(a => FILE_ARTIFACT_TYPES.has(a.type))
  .flatMap((a): Deliverable[] => {
    const taskName = ARTIFACT_TASK_NAMES[a.id] ?? 'Task';
    const date = ARTIFACT_DATES[a.id] ?? '2026-03-15T00:00:00';
    const reason = ARTIFACT_REASONS[a.id] ?? 'Drafted by teammate';
    const actionText = `Created by ${taskName}`;

    if (a.type === 'sharepoint' && 'sharedFiles' in a && a.sharedFiles) {
      return a.sharedFiles.map((f, i): Deliverable => {
        const ext = f.ext.toLowerCase();
        const type: DeliverableType = SHAREPOINT_EXT_TYPE[ext] ?? 'document';
        const app = ext === 'xlsx' || ext === 'csv' ? 'excel'
          : ext === 'pptx' ? 'powerpoint'
          : ext === 'docx' ? 'word'
          : 'sharepoint';
        return {
          id: `${a.id}-${i}`,
          name: f.name,
          type,
          app,
          url: a.url,
          location: 'SharePoint',
          action: 'created',
          reason,
          actionText: `${taskName} · ${f.sharedAt}`,
          date: new Date(new Date(date).getTime() - i * 3_600_000).toISOString(),
          artifactId: a.id,
          taskName,
        };
      });
    }

    return [{
      id: a.id,
      name: a.name,
      type: ARTIFACT_TYPE_MAP[a.type] ?? 'document',
      app: a.appKey ?? a.type,
      url: a.url,
      location: a.appLabel ?? 'OneDrive',
      action: 'created',
      reason,
      actionText,
      date,
      artifactId: a.id,
      taskName,
    }];
  });

// ── Unified file list for Day 100 (task files + deliverables, deduped by name) ──
export const ALL_FILES: Deliverable[] = (() => {
  const seen = new Set<string>();
  return [...TASK_FILES, ...DELIVERABLES].filter(f => {
    if (seen.has(f.name)) return false;
    seen.add(f.name);
    return true;
  });
})();

// ── Shared zero-state copy (used by DWContentTab + DWOverviewTab) ─────────────

export const FILES_EMPTY_DESCRIPTION = "As your AI Teammate gets to work, the files, reports, and assets they create will be collected and organized here.";

// ── App-based filter config ───────────────────────────────────────────────────

const APP_TO_FILTER: Record<string, AppFilter> = {
  word: 'word',
  excel: 'excel',
  powerpoint: 'powerpoint',
  onenote: 'notes',
  sharepoint: 'folder',
  file: 'folder',
};

// ── File icon ─────────────────────────────────────────────────────────────────

export function DeliverableIcon({ app }: { app: string }) {
  const icon = getConnectorIcon(app, 'w-8 h-8');
  return (
    <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
      {icon ?? <DocumentText20Regular className="w-8 h-8 text-neutral-400" />}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Files attributed to the AI Teammate: task-derived (has artifactId), created with no owner, or agent-maintained notes
function isTeammateFile(item: Deliverable): boolean {
  return !!item.artifactId || (item.action === 'created' && !item.owner) || !!item.isAgentNote;
}

function getSharedBy(item: Deliverable, agentName: string): string {
  if (item.owner) return item.owner;
  if (isTeammateFile(item)) return agentName;
  return 'Avery Fuller';
}

function getLocationLabel(item: Deliverable, agentName: string): string {
  return `${getSharedBy(item, agentName)}'s Files`;
}

interface ActivityInfo { person: string; text: string }

function getActivityInfo(item: Deliverable, agentName: string): ActivityInfo | null {
  const dateStr = formatDwActivityDate(item.date);
  const person = item.owner ?? (isTeammateFile(item) ? agentName : 'Avery Fuller');
  switch (item.action) {
    case 'created':   return { person, text: `shared this in a Teams chat · ${dateStr}` };
    case 'edited':    return { person, text: `shared this in a Teams chat · ${dateStr}` };
    case 'commented': return { person, text: `left a comment · ${dateStr}` };
    case 'viewed':    return { person: 'You', text: `opened this · ${dateStr}` };
    case 'assigned':  return null;
    default:          return null;
  }
}

// Avatar circle with initials

function PersonAvatar({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <div
      className={`${avatarColor(name)} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initials(name)}
    </div>
  );
}

// ── Grid column layout ────────────────────────────────────────────────────────
const CONTENT_COLS = '1fr 200px 160px 280px';

// ── Main component ────────────────────────────────────────────────────────────

export const DWContentTab: React.FC = () => {
  const { agentConfig } = useAgent();
  const { isAiTeammateDay100 } = useDW();
  const agentName = agentConfig?.name ?? 'AI Teammate';
  const [appFilter, setAppFilter] = useState<AppFilter>('all');
  const [noteTarget, setNoteTarget] = useState<{ notebookId: string; pageId: string | null } | null>(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<CopilotMenuPosition>({ top: 0, left: 0 });
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [moreMenuPos, setMoreMenuPos] = useState<CopilotMenuPosition>({ top: 0, left: 0 });
  const moreButtonRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showAddFilesDialog, setShowAddFilesDialog] = useState(false);
  const [addedFiles, setAddedFiles] = useState<Deliverable[]>([]);

  const sourceFiles = isAiTeammateDay100 ? [...ALL_FILES, ...addedFiles] : [];

  // App-based counts
  const appCounts: Record<AppFilter, number> = {
    all:         sourceFiles.length,
    folder:      sourceFiles.filter(d => ['sharepoint', 'file'].includes(d.app)).length,
    notes:       getNotebooks().length,
    word:        sourceFiles.filter(d => d.app === 'word').length,
    excel:       sourceFiles.filter(d => d.app === 'excel').length,
    powerpoint:  sourceFiles.filter(d => d.app === 'powerpoint').length,
    pdf:         0,
  };

  const q = search.trim().toLowerCase();
  const filtered = sourceFiles
    .filter(d => {
      if (appFilter === 'all') return true;
      if (appFilter === 'pdf') return false;
      return (APP_TO_FILTER[d.app] ?? 'folder') === appFilter;
    })
    .filter(d => !q || d.name.toLowerCase().includes(q) || getSharedBy(d, agentName).toLowerCase().includes(q) || d.location.toLowerCase().includes(q))
    .sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'name')     cmp = a.name.localeCompare(b.name);
      if (sortCol === 'sharedBy') cmp = getSharedBy(a, agentName).localeCompare(getSharedBy(b, agentName));
      if (sortCol === 'date')     cmp = new Date(b.date).getTime() - new Date(a.date).getTime();
      // date: desc=newest first (cmp already inverted above), flip for asc
      if (sortCol === 'date') return sortDir === 'desc' ? cmp : -cmp;
      return sortDir === 'asc' ? cmp : -cmp;
    });

  function handleColSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir(col === 'date' ? 'desc' : 'asc'); }
  }

  const handleFileClick = (item: Deliverable) => {
    if (item.notebookId) {
      setNoteTarget({ notebookId: item.notebookId, pageId: item.notebookPageId ?? null });
      setAppFilter('notes');
      return;
    }
    const artifact = item.artifactId ? ARTIFACTS[item.artifactId] : undefined;
    const url = item.url ?? artifact?.url;
    openFileNatively(item.app, url);
  };

  if (!isAiTeammateDay100) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
        <p className="text-sm font-semibold text-[hsl(var(--text-primary))] mb-1">No files yet</p>
        <p className="text-sm text-[hsl(var(--text-secondary))] max-w-xs">{FILES_EMPTY_DESCRIPTION}</p>
      </div>
    );
  }

  // Filter pill icon helpers (small, inline with label)
  const wordIcon    = getConnectorIcon('word',       'w-4 h-4');
  const excelIcon   = getConnectorIcon('excel',      'w-4 h-4');
  const pptIcon     = getConnectorIcon('powerpoint', 'w-4 h-4');

  const moreFilters: AppFilter[] = ['notes', 'folder', 'pdf'];
  const moreActive = moreFilters.includes(appFilter);

  function openMoreMenu() {
    if (!moreButtonRef.current) return;
    const rect = moreButtonRef.current.getBoundingClientRect();
    setMoreMenuPos({ top: rect.bottom + 4, left: rect.left });
    setMoreMenuOpen(true);
  }

  const moreMenuItems = [
    {
      label: `Notes${appCounts.notes > 0 ? ` (${appCounts.notes})` : ''}`,
      icon: appFilter === 'notes'
        ? <Checkmark20Regular className="w-4 h-4 text-[#484FE3]" />
        : <Notebook20Regular className="w-4 h-4" />,
      onClick: () => setAppFilter(appFilter === 'notes' ? 'all' : 'notes'),
    },
    {
      label: `Folder${appCounts.folder > 0 ? ` (${appCounts.folder})` : ''}`,
      icon: appFilter === 'folder'
        ? <Checkmark20Regular className="w-4 h-4 text-[#484FE3]" />
        : <Folder20Regular className="w-4 h-4" />,
      onClick: () => setAppFilter(appFilter === 'folder' ? 'all' : 'folder'),
    },
    {
      label: `PDF${appCounts.pdf > 0 ? ` (${appCounts.pdf})` : ''}`,
      icon: appFilter === 'pdf'
        ? <Checkmark20Regular className="w-4 h-4 text-[#484FE3]" />
        : <DocumentPdf20Regular className="w-4 h-4" />,
      onClick: () => setAppFilter(appFilter === 'pdf' ? 'all' : 'pdf'),
    },
  ];

  return (
    <>
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* ── Filter pills + search + Teams button ─────────────────────────── */}
      {appFilter !== 'notes' && <div className="flex items-center gap-3 flex-wrap">
        {/* App filter pills */}
        <div className="flex items-center gap-1.5 flex-1 flex-wrap min-w-0">
          <CopilotFilterPill
            label="All"
            count={appCounts.all}
            active={appFilter === 'all'}
            onClick={() => setAppFilter('all')}
            size="sm"
          />
          {wordIcon && (
            <CopilotFilterPill
              label="Word"
              count={appCounts.word}
              active={appFilter === 'word'}
              onClick={() => setAppFilter(appFilter === 'word' ? 'all' : 'word')}
              size="sm"
              icon={wordIcon}
            />
          )}
          {excelIcon && (
            <CopilotFilterPill
              label="Excel"
              count={appCounts.excel}
              active={appFilter === 'excel'}
              onClick={() => setAppFilter(appFilter === 'excel' ? 'all' : 'excel')}
              size="sm"
              icon={excelIcon}
            />
          )}
          {pptIcon && (
            <CopilotFilterPill
              label="PowerPoint"
              count={appCounts.powerpoint}
              active={appFilter === 'powerpoint'}
              onClick={() => setAppFilter(appFilter === 'powerpoint' ? 'all' : 'powerpoint')}
              size="sm"
              icon={pptIcon}
            />
          )}
          {/* Notes pill is always rendered as inactive — clicking navigates into the notebooks
              view (like the Tasks tab), so the pill is never a true toggle filter. */}
          <CopilotFilterPill
            label="Notes"
            count={appCounts.notes}
            active={false}
            onClick={() => { setNoteTarget(null); setAppFilter('notes'); }}
            size="sm"
            icon={<Notebook20Regular className="w-4 h-4" />}
          />
          <div ref={moreButtonRef}>
            <CopilotFilterPill
              label="More"
              active={moreActive}
              onClick={openMoreMenu}
              size="sm"
              icon={<ChevronDown20Regular className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* Collapsible search */}
        {searchOpen ? (
          <CopilotInput
            ref={searchInputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onBlur={() => { if (!search) setSearchOpen(false); }}
            onKeyDown={e => { if (e.key === 'Escape') { setSearch(''); setSearchOpen(false); } }}
            placeholder="Filter by name or person"
            size="sm"
            contentBefore={<Search20Regular className="w-4 h-4 text-neutral-400" />}
            contentAfter={search ? <CopilotButton variant="icon" size="sm" icon={<Dismiss20Regular className="w-4 h-4" />} onClick={() => { setSearch(''); setSearchOpen(false); }} aria-label="Clear search" /> : undefined}
            className="w-56 flex-shrink-0"
            autoFocus
          />
        ) : (
          <CopilotButton
            variant="icon"
            size="sm"
            icon={<Search20Regular />}
            aria-label="Search files"
            onClick={() => setSearchOpen(true)}
            className="flex-shrink-0"
          />
        )}

        {/* Add files button */}
        <CopilotButton variant="outline" size="sm" onClick={() => setShowAddFilesDialog(true)}>
          Add files
        </CopilotButton>
      </div>}

      {/* ── Notes / Notebooks view ─────────────────────────────────────────── */}
      {appFilter === 'notes' && (
        <DWNotebooksView
          onBack={() => { setAppFilter('all'); setNoteTarget(null); }}
          defaultNotebookId={noteTarget?.notebookId}
          defaultPageId={noteTarget?.pageId ?? undefined}
        />
      )}

      {/* ── More filter menu ───────────────────────────────────────────────── */}
      {moreMenuOpen && (
        <CopilotMenu
          items={moreMenuItems}
          position={moreMenuPos}
          onClose={() => setMoreMenuOpen(false)}
          minWidth={160}
        />
      )}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      {appFilter !== 'notes' && (
      <div className="w-full border border-[hsl(var(--stroke-default))] rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
        {/* Column headers */}
        <div
          className="grid text-xs font-semibold text-[hsl(var(--text-secondary))] border-b border-[hsl(var(--stroke-default))] py-3.5 flex-shrink-0"
          style={{ gridTemplateColumns: CONTENT_COLS }}
        >
          {/* Name — left-pad to align with file name text (icon w-9 + gap-3 + px-4) */}
          <CopilotButton
            variant="transparent"
            size="sm"
            className="w-full !h-auto !pl-[64px] !pr-3 !rounded-none !justify-start !text-xs !text-[hsl(var(--text-secondary))] hover:!text-[hsl(var(--text-primary))]"
            onClick={() => handleColSort('name')}
          >
            Name
            <DWSortIcon col="name" sortCol={sortCol} sortDir={sortDir} />
          </CopilotButton>
          <CopilotButton
            variant="transparent"
            size="sm"
            className="w-full !h-auto !px-3 !rounded-none !justify-start !text-xs !text-[hsl(var(--text-secondary))] hover:!text-[hsl(var(--text-primary))]"
            onClick={() => handleColSort('date')}
          >
            Date shared
            <DWSortIcon col="date" sortCol={sortCol} sortDir={sortDir} />
          </CopilotButton>
          <CopilotButton
            variant="transparent"
            size="sm"
            className="w-full !h-auto !px-3 !rounded-none !justify-start !text-xs !text-[hsl(var(--text-secondary))] hover:!text-[hsl(var(--text-primary))]"
            onClick={() => handleColSort('sharedBy')}
          >
            Shared by
            <DWSortIcon col="sharedBy" sortCol={sortCol} sortDir={sortDir} />
          </CopilotButton>
          <div className="px-3">Activity</div>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-[hsl(var(--text-secondary))]">No files found</p>
          </div>
        ) : (
          filtered.map((item, idx) => {
            const activity = getActivityInfo(item, agentName);
            const sharedBy = getSharedBy(item, agentName);
            const isLast = idx === filtered.length - 1;
            return (
              <div
                key={item.id}
                className="group grid hover:bg-[hsl(var(--surface-secondary))] transition-colors cursor-pointer relative"
                style={{ gridTemplateColumns: CONTENT_COLS }}
                onClick={() => handleFileClick(item)}
              >
                {!isLast && <div className="absolute bottom-0 left-0 right-0 h-px bg-[hsl(var(--stroke-default))]" />}
                {/* Name + location */}
                <div className="flex items-center gap-3 px-4 py-3.5 min-w-0">
                  <DeliverableIcon app={item.app} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[hsl(var(--text-primary))] truncate">{item.name}</p>
                    <p className="text-xs text-[hsl(var(--text-secondary))] truncate mt-0.5">{getLocationLabel(item, agentName)}</p>
                  </div>
                </div>

                {/* Date shared */}
                <div className="flex items-center px-3 py-3">
                  <span className="text-sm text-[hsl(var(--text-primary))]">{formatDwDate(item.date)}</span>
                </div>

                {/* Shared by */}
                <div className="flex items-center px-3 py-3">
                  <span className="text-sm text-[hsl(var(--text-primary))]">{sharedBy}</span>
                </div>

                {/* Activity */}
                <div className="flex items-center gap-2 px-3 py-3 min-w-0">
                  {activity && (
                    <>
                      <PersonAvatar name={activity.person} size={20} />
                      <p className="text-sm text-[hsl(var(--text-primary))] truncate">
                        <span className="font-semibold">{activity.person}</span>
                        {' '}{activity.text}
                      </p>
                    </>
                  )}

                  {/* More button — shows on hover, positioned at far right */}
                  <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <CopilotButton
                      variant="transparent"
                      size="sm"
                      icon={<MoreHorizontal20Regular />}
                      aria-label="More options"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (openMenuId === item.id) { setOpenMenuId(null); return; }
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setMenuPos({ top: rect.bottom + 4, left: rect.right - 160 });
                        setOpenMenuId(item.id);
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
        </div>
      </div>
      )}

      {/* Item context menu */}
      {appFilter !== 'notes' && openMenuId && ReactDOM.createPortal(
        <CopilotMenu
          position={menuPos}
          onClose={() => setOpenMenuId(null)}
          minWidth={160}
          items={[
            { label: 'Open',      onClick: () => { const item = filtered.find(f => f.id === openMenuId); if (item) handleFileClick(item); setOpenMenuId(null); } },
            { label: 'Copy link', onClick: () => setOpenMenuId(null) },
            { label: 'Remove',    onClick: () => setOpenMenuId(null) },
          ]}
        />,
        document.body,
      )}
    </div>
    <DWAddFilesDialog
      open={showAddFilesDialog}
      onClose={() => setShowAddFilesDialog(false)}
      onAdd={files => setAddedFiles(prev => [...prev, ...files.filter(f => !prev.some(p => p.id === f.id) && !ALL_FILES.some(a => a.id === f.id))])}
    />
    </>
  );
};
