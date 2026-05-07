import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ErrorCircle20Filled, ErrorCircle20Regular, CheckmarkCircle20Regular,
  ArrowSync20Regular, CalendarClock20Regular,
} from '@fluentui/react-icons';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotFilterPill } from '../../../components/ui/CopilotFilterPill';
import { DWSortIcon } from './DWSortIcon';
import { useAgent } from '../../../context/AgentContext';
import { useDW } from '../context/DWContext';
import { DWTaskDetailPanel, TaskDetail, TASK_DETAILS } from './DWTaskDetailPanel';
import { ARTIFACTS, TaskArtifact } from '../data/dwArtifactData';
import { openFileNatively } from '../../../utils/openFileNatively';
import { getConnectorIcon } from '../../../utils/agentIcons';
import { TaskTile, TaskRow, KanbanBoard, ViewToggle, Day100Task, Day100TaskStatus, TaskViewMode, DAY100_TASKS as DAY100_TASKS_BASE, makeDay0Tasks, STATUS_APPEAR_KEYFRAMES } from './DWOverviewTab';
import { DWAddTaskDialog } from './DWAddTaskDialog';
// Session-scoped set — clears on every app reload, so animation always plays on first visit per key
const _animatedTasksKeys = new Set<string>();

// ── Types ─────────────────────────────────────────────────────────────────────

type TaskStatus = 'incomplete' | 'blocked' | 'in-progress' | 'complete' | 'upcoming';
type TaskFilter = 'all' | 'incomplete' | 'in-progress' | 'upcoming' | 'complete' | 'attention' | 'with-meeting';

interface Task {
  id: string;
  name: string;
  subtitle: string;
  status: TaskStatus;
  lastUpdated: string;
  date?: string;        // ISO date for sorting
  knowledge?: string;   // connector icon key
  messages?: string;    // connector icon key
  content?: string;     // connector icon key
  timeSavedHrs?: number; // realized (complete) or estimated (other statuses)
  when?: string;
  objective?: string;
  steps?: string[];
  category?: 'meeting';
  outputMeeting?: boolean;
}


// ── Filter mapping ────────────────────────────────────────────────────────────

// 'attention' and 'with-meeting' are special filters — handled separately
const FILTER_TO_STATUS: Record<Exclude<TaskFilter, 'attention' | 'with-meeting'>, TaskStatus | null> = {
  all: null,
  incomplete: 'incomplete',
  'in-progress': 'in-progress',
  upcoming: 'upcoming',
  complete: 'complete',
};

// ── Convert local Task → Day100Task for shared tile/row/kanban components ────

type TaskSortCol = 'name' | 'date' | 'status';

const TASK_STATUS_ORDER: Record<string, number> = { incomplete: 0, blocked: 0, 'in-progress': 1, upcoming: 2, complete: 3 };


function toDay100Task(t: Task): Day100Task {
  return {
    id: t.id,
    name: t.name,
    subtitle: t.subtitle,
    status: (t.status === 'blocked' ? 'incomplete' : t.status) as Day100TaskStatus,
    lastUpdated: t.lastUpdated,
    date: t.date,
    connectors: [t.knowledge, t.messages, t.content].filter(Boolean) as string[],
    outputMeeting: t.outputMeeting,
  };
}

// Convert lastUpdated display strings to relative timestamps for sort fallback.
// Defined at module level (outside component) so it can be safely referenced
// inside useMemo without a stale-closure risk.
function lastUpdatedToMs(s: string, now: number): number {
  if (s === 'Just now' || s === 'Scheduled') return now;
  const m = s.match(/^(\d+)\s+(min|hour|day|week)s?\s+ago$/i);
  if (m) {
    const n = parseInt(m[1], 10);
    const unit: Record<string, number> = { min: 60_000, hour: 3_600_000, day: 86_400_000, week: 604_800_000 };
    return now - n * (unit[m[2].toLowerCase()] ?? 0);
  }
  if (s === 'Yesterday') return now - 86_400_000;
  return 0;
}

// ── Main component ────────────────────────────────────────────────────────────

export const DWTasksTab: React.FC = () => {
  const { userName, agentConfig } = useAgent();
  const { isAiTeammateDay100, day0AnimKey, dwTaskFilter, setDwTaskFilter, dwTasks, removeDwTaskById } = useDW();
  const [activeFilter, setActiveFilter] = useState<TaskFilter>('all');
  const [taskViewMode, setTaskViewMode] = useState<TaskViewMode>('list');
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);

  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null);
  const [sortCol, setSortCol] = useState<TaskSortCol>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function handleSort(col: TaskSortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir(col === 'date' ? 'desc' : 'asc'); }
  }
  const [day0AnimPhases, setDay0AnimPhases] = useState<Record<string, 'hidden' | 'entering' | 'transitioning' | 'processing' | 'completing' | 'complete'>>({});
  const animTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!dwTaskFilter) return;
    setActiveFilter(dwTaskFilter as TaskFilter);
    setDwTaskFilter(null);
  }, [dwTaskFilter, setDwTaskFilter]);

  // Day 0 staggered entrance animation — mirrors DWOverviewTab pattern
  // Uses a module-level Set (session-scoped) to avoid the localStorage stale-key bug:
  // day0AnimKey resets to 0 on every app load but localStorage persists, so we'd always skip.
  useEffect(() => {
    if (isAiTeammateDay100) return;
    const ids = ['t1', 't2', 't3'];
    animTimersRef.current.forEach(clearTimeout);
    animTimersRef.current = [];

    const sessionKey = `${agentConfig.id}-${day0AnimKey}`;
    if (_animatedTasksKeys.has(sessionKey)) {
      // Already animated in this session — restore final state without re-animating
      setDay0AnimPhases(Object.fromEntries(ids.map(id => [id, 'complete' as const])));
      return;
    }
    _animatedTasksKeys.add(sessionKey);

    setDay0AnimPhases(Object.fromEntries(ids.map(id => [id, 'hidden' as const])));
    ids.forEach((id, i) => {
      const entryAt      = i * 600;
      const transAt      = entryAt + 800 + 600;
      const procAt       = transAt + 400;
      const completingAt = procAt + 4500;
      const doneAt       = completingAt + 400;
      animTimersRef.current.push(
        setTimeout(() => setDay0AnimPhases(prev => ({ ...prev, [id]: 'entering' })),      entryAt),
        setTimeout(() => setDay0AnimPhases(prev => ({ ...prev, [id]: 'transitioning' })), transAt),
        setTimeout(() => setDay0AnimPhases(prev => ({ ...prev, [id]: 'processing' })),    procAt),
        setTimeout(() => setDay0AnimPhases(prev => ({ ...prev, [id]: 'completing' })),    completingAt),
        setTimeout(() => setDay0AnimPhases(prev => ({ ...prev, [id]: 'complete' })),      doneAt),
      );
    });
    return () => { animTimersRef.current.forEach(clearTimeout); };
  }, [day0AnimKey, isAiTeammateDay100, agentConfig.id]);  

  const fullName = userName || 'Avery Fuller';

  // Day 0 tasks — shared with DWOverviewTab via makeDay0Tasks to stay in sync
  const DAY0_TASKS: Task[] = makeDay0Tasks(fullName).map(t => ({
    id: t.id,
    name: t.name,
    subtitle: t.subtitle,
    status: t.status as TaskStatus,
    lastUpdated: t.lastUpdated,
    date: t.date,
    messages: (t.connectors ?? []).find(c => c === 'teams' || c === 'outlook'),
    knowledge: (t.connectors ?? []).find(c => c === 'sharepoint'),
  }));

  // Day 100 tasks — derived from shared DAY100_TASKS_BASE in DWOverviewTab
  // timeSavedHrs: realized hours for complete tasks, estimated for others
  const KNOWLEDGE_CONNECTORS = new Set(['sharepoint']);
  const MESSAGES_CONNECTORS = new Set(['outlook', 'teams']);
  // Everything else (excel, powerpoint, word) is treated as content
  const TIME_SAVED: Record<string, number> = { h11: 2.0, h10: 3.5, h7: 2.0, h12: 2.5, h13: 4.0, h9: 2.5, h8: 3.0, h1: 3.5, h2: 1.5, h3: 1.5, h4: 0.7, h5: 1.0, h6: 0.5 };
  const DAY100_TASKS: Task[] = DAY100_TASKS_BASE.map(t => ({
    id: t.id,
    name: t.name,
    subtitle: t.subtitle,
    status: t.status as TaskStatus,
    lastUpdated: t.lastUpdated,
    date: t.date,
    knowledge: (t.connectors ?? []).find(c => KNOWLEDGE_CONNECTORS.has(c)),
    messages: (t.connectors ?? []).find(c => MESSAGES_CONNECTORS.has(c)),
    content: (t.connectors ?? []).find(c => !KNOWLEDGE_CONNECTORS.has(c) && !MESSAGES_CONNECTORS.has(c)),
    timeSavedHrs: TIME_SAVED[t.id] ?? 0,
    category: t.category,
    outputMeeting: t.outputMeeting,
  }));

  const handleTaskClick = (task: Task) => {
    const detail = TASK_DETAILS[task.id] ?? TASK_DETAILS.default;
    setSelectedTask({
      id: task.id,
      name: task.name,
      subtitle: task.subtitle,
      status: task.status,
      lastUpdated: task.lastUpdated,
      date: task.date,
      when: task.when,
      objective: task.objective,
      steps: task.steps,
      ...detail,
    });
  };

  const STATUS_FILTERS: { value: TaskFilter; label: string; icon?: React.ReactNode; activeClassName?: string }[] = [
    { value: 'all',         label: 'All' },
    { value: 'incomplete',  label: 'Incomplete',  icon: (activeFilter === 'incomplete' || activeFilter === 'attention') ? <ErrorCircle20Filled className="w-4 h-4 text-red-500" /> : <ErrorCircle20Regular className="w-4 h-4" />, activeClassName: 'bg-red-50 text-red-600 border border-red-300' },
    { value: 'in-progress', label: 'In Progress', icon: <ArrowSync20Regular className="w-4 h-4" />,       activeClassName: 'bg-orange-50 text-orange-600 border border-orange-300' },
    { value: 'upcoming',    label: 'Upcoming',    icon: <CalendarClock20Regular className="w-4 h-4" />,   activeClassName: 'bg-blue-50 text-blue-600 border border-blue-300' },
    { value: 'complete',    label: 'Complete',    icon: <CheckmarkCircle20Regular className="w-4 h-4" />, activeClassName: 'bg-green-50 text-green-700 border border-green-300' },
  ];

  const chatTasks: Task[] = (dwTasks[agentConfig.id] || []).map(t => ({
    ...t,
    status: (t.status === 'blocked' ? 'blocked' : t.status) as TaskStatus,
  }));
  const baseTasks = isAiTeammateDay100 ? DAY100_TASKS : DAY0_TASKS;
  // Resolve Day 0 animation phases into the status field so all views (list, tile, kanban)
  // show consistent status rather than relying on each view to interpret animPhase separately.
  const allTasks = [...chatTasks, ...baseTasks].map(t => ({
    ...t,
    status: (!isAiTeammateDay100 && day0AnimPhases[t.id] === 'complete'
      ? 'complete'
      : t.status) as TaskStatus,
  }));

  const filterCounts: Record<TaskFilter, number> = {
    all:           allTasks.length,
    incomplete:    allTasks.filter(t => t.status === 'incomplete' || t.status === 'blocked').length,
    'in-progress': allTasks.filter(t => t.status === 'in-progress').length,
    upcoming:      allTasks.filter(t => t.status === 'upcoming').length,
    complete:      allTasks.filter(t => t.status === 'complete').length,
    attention:      allTasks.filter(t => t.status === 'incomplete' || t.status === 'blocked').length,
    'with-meeting': allTasks.filter(t => !!t.outputMeeting && t.status !== 'upcoming').length,
  };

  const filteredTasks = allTasks.filter(t => {
    if (activeFilter === 'attention') return t.status === 'incomplete' || t.status === 'blocked';
    if (activeFilter === 'with-meeting') return !!t.outputMeeting && t.status !== 'upcoming';
    const requiredStatus = FILTER_TO_STATUS[activeFilter as Exclude<TaskFilter, 'attention' | 'with-meeting'>];
    return !requiredStatus || t.status === requiredStatus;
  });


  const day100Tasks = useMemo(() => filteredTasks.map(toDay100Task), [filteredTasks]);

  const sortedListTasks = useMemo(() => {
    // Preserve original order during Day 0 animation to prevent reordering on status change
    if (!isAiTeammateDay100) return day100Tasks;
    const now = Date.now();
    return [...day100Tasks].sort((a, b) => {
      if (sortCol === 'date') {
        const aTime = a.date ? new Date(a.date).getTime() : lastUpdatedToMs(a.lastUpdated, now);
        const bTime = b.date ? new Date(b.date).getTime() : lastUpdatedToMs(b.lastUpdated, now);
        return sortDir === 'desc' ? bTime - aTime : aTime - bTime;
      }
      if (sortCol === 'status') {
        const cmp = (TASK_STATUS_ORDER[a.status] ?? 5) - (TASK_STATUS_ORDER[b.status] ?? 5);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const cmp = a.name.localeCompare(b.name);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [day100Tasks, sortCol, sortDir, isAiTeammateDay100]);

  if (selectedTask) {
    return (
      <div className="flex-1 overflow-y-auto">
        <DWTaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <style>{STATUS_APPEAR_KEYFRAMES}</style>

      {/* Filter pills + view toggle */}
      <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
            {STATUS_FILTERS.map(f => (
              <CopilotFilterPill
                key={f.value}
                active={activeFilter === f.value || (f.value === 'incomplete' && activeFilter === 'attention')}
                label={f.label}
                count={filterCounts[f.value]}
                size="sm"
                icon={f.icon}
                activeClassName={f.activeClassName}
                onClick={() => { setActiveFilter(f.value); }}
              />
            ))}
          </div>
          <ViewToggle mode={taskViewMode} onChange={(m) => { setTaskViewMode(m); }} />
          <CopilotButton variant="outline" size="sm" onClick={() => setShowAddTaskDialog(true)}>
            Add task
          </CopilotButton>
        </div>

        {/* Task views */}
        {(() => {
          const onTaskClick = (t: Day100Task) => { const found = allTasks.find(x => x.id === t.id); if (found) handleTaskClick(found); };
          const onArtifactClick = (artifact: TaskArtifact) => openFileNatively(artifact.appKey ?? artifact.type, artifact.url);
          const getAnimPhase = (t: Day100Task) => !isAiTeammateDay100 ? (day0AnimPhases[t.id] as 'hidden' | 'entering' | 'transitioning' | 'processing' | 'completing' | 'complete' | undefined) : undefined;

          if (taskViewMode === 'kanban') {
            return (
              <div className="flex-1 min-h-0 overflow-auto">
                <KanbanBoard tasks={day100Tasks} onTaskClick={onTaskClick} onArtifactClick={onArtifactClick} />
              </div>
            );
          }

          if (taskViewMode === 'tile') {
            return (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {day100Tasks.map(t => (
                    <TaskTile key={t.id} task={t} onTaskClick={onTaskClick} onArtifactClick={onArtifactClick} animPhase={getAnimPhase(t)} />
                  ))}
                </div>
              </div>
            );
          }

          return (
            <div className="border border-[hsl(var(--stroke-default))] rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
              <div className="flex items-center gap-3 px-4 py-3.5 text-xs font-semibold text-[hsl(var(--text-secondary))] border-b border-[hsl(var(--stroke-default))] flex-shrink-0">
                <CopilotButton variant="transparent" size="sm" className="flex-shrink-0 !h-auto !pl-0 !pr-0 !rounded-none !justify-start !text-xs !text-[hsl(var(--text-secondary))] hover:!text-[hsl(var(--text-primary))]" style={{ width: 120 }} onClick={() => handleSort('status')}>
                  Status<DWSortIcon col="status" sortCol={sortCol} sortDir={sortDir} />
                </CopilotButton>
                <CopilotButton variant="transparent" size="sm" className="flex-1 !h-auto !pl-0 !pr-0 !rounded-none !justify-start !text-xs !text-[hsl(var(--text-secondary))] hover:!text-[hsl(var(--text-primary))]" onClick={() => handleSort('name')}>
                  Task<DWSortIcon col="name" sortCol={sortCol} sortDir={sortDir} />
                </CopilotButton>
                <CopilotButton variant="transparent" size="sm" className="flex-shrink-0 !h-auto !pl-0 !pr-0 !rounded-none !justify-start !text-xs !text-[hsl(var(--text-secondary))] hover:!text-[hsl(var(--text-primary))]" style={{ width: 130 }} onClick={() => handleSort('date')}>
                  Date<DWSortIcon col="date" sortCol={sortCol} sortDir={sortDir} />
                </CopilotButton>
                <span className="w-16 flex-shrink-0 text-right">Location</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {sortedListTasks.map((t, idx) => (
                  <TaskRow key={t.id} task={t} onTaskClick={onTaskClick} onArtifactClick={onArtifactClick} animPhase={getAnimPhase(t)} onDeleteClick={(id) => removeDwTaskById(agentConfig.id, id)} tableStyle showStatusCol isLast={idx === sortedListTasks.length - 1} />
                ))}
              </div>
            </div>
          );
        })()}

    </div>
    <DWAddTaskDialog open={showAddTaskDialog} onClose={() => setShowAddTaskDialog(false)} />
    </>
  );
};
