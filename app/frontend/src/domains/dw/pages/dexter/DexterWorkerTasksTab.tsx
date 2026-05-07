import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CopilotButton, CopilotTable, CopilotTextarea, CopilotBadge, type TableColumn } from '../../../../components/ui';
import {
  listDexterTasks,
  fetchDexterTask,
  type AuthFetchFn,
  type DexterTask,
  type DexterWorkerDetail,
} from '../../services/dexterWorkerService';
import { statusColor } from './dexterUtils';
import { DEXTER_CONFIG } from '../../../../config/dexterConfig';
import { useDexterRouterToken } from '../../../../auth/useDexterRouterToken';
import { useDexterChat } from '../../hooks/useDexterChat';

interface DexterWorkerTasksTabProps {
  workerId: string;
  worker: DexterWorkerDetail;
  authFetch: AuthFetchFn;
}

export function DexterWorkerTasksTab({ workerId, worker, authFetch }: DexterWorkerTasksTabProps) {
  const [tasks, setTasks] = useState<DexterTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<DexterTask | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // New task form
  const [showNewTask, setShowNewTask] = useState(false);
  const [taskPrompt, setTaskPrompt] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // WebSocket chat for sending tasks — reuses same protocol as Chat tab
  const getRouterToken = useDexterRouterToken();
  const { sendMessage, isConnected, isStreaming } = useDexterChat({
    routerUrl: DEXTER_CONFIG.routerUrl,
    workerId,
    getAccessToken: getRouterToken,
  });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDexterTasks(authFetch, workerId);
      setTasks(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [authFetch, workerId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleTaskClick = async (task: DexterTask) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const detail = await fetchDexterTask(authFetch, workerId, task.taskId);
      setSelectedTask(detail);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch task detail');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSubmitTask = () => {
    if (!taskPrompt.trim() || !isConnected) return;
    sendMessage(taskPrompt.trim());
    setSubmitSuccess('Task submitted. The worker is now processing it.');
    setTaskPrompt('');
    // Refresh task list after a delay to let Bobby process
    refreshTimerRef.current = setTimeout(() => fetchTasks(), 5000);
  };

  // Clean up refresh timer on unmount
  useEffect(() => () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); }, []);

  // Task detail view
  if (selectedTask) {
    return (
      <div className="flex flex-col gap-4 max-w-2xl">
        <CopilotButton variant="outline" size="sm" onClick={() => setSelectedTask(null)}>
          &larr; Back to tasks
        </CopilotButton>

        <div className="border border-neutral-200 rounded-lg p-4 bg-white">
          <div className="grid grid-cols-[140px_1fr] gap-y-3 gap-x-4 text-sm">
            <span className="text-neutral-500 font-medium">Task ID</span>
            <span className="font-mono text-xs text-neutral-600">{selectedTask.taskId}</span>

            <span className="text-neutral-500 font-medium">Session ID</span>
            <span className="font-mono text-xs text-neutral-600">{selectedTask.sessionId || '—'}</span>

            <span className="text-neutral-500 font-medium">Status</span>
            <span className={statusColor(selectedTask.status)}>{selectedTask.status ?? '—'}</span>

            <span className="text-neutral-500 font-medium">Result</span>
            <pre className="whitespace-pre-wrap text-xs bg-neutral-50 rounded p-2 overflow-x-auto">
              {selectedTask.result ?? '—'}
            </pre>

            {selectedTask.error ? (
              <>
                <span className="text-neutral-500 font-medium">Error</span>
                <span className="text-red-600 whitespace-pre-wrap">{selectedTask.error}</span>
              </>
            ) : null}

            <span className="text-neutral-500 font-medium">Created</span>
            <span>{selectedTask.createdAt ? new Date(selectedTask.createdAt).toLocaleString() : '—'}</span>

            <span className="text-neutral-500 font-medium">Completed</span>
            <span>{selectedTask.completedAt ? new Date(selectedTask.completedAt).toLocaleString() : '—'}</span>
          </div>
        </div>
      </div>
    );
  }

  const columns: TableColumn[] = [
    { key: 'taskId', label: 'Task ID', width: '30%',
      render: (value: string) => <span className="font-mono text-xs">{value}</span>,
    },
    { key: 'sessionId', label: 'Session ID', width: '25%',
      render: (value: string) => <span className="font-mono text-xs">{value || '—'}</span>,
    },
    { key: 'status', label: 'Status', width: '12%',
      render: (value: string) => <span className={statusColor(value)}>{value ?? '—'}</span>,
    },
    { key: 'createdAt', label: 'Created', width: '18%',
      render: (value: string) => value ? new Date(value).toLocaleString() : '—',
    },
    { key: 'completedAt', label: 'Completed', width: '18%',
      render: (value: string) => value ? new Date(value).toLocaleString() : '—',
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Action bar */}
      <div className="flex items-center gap-3">
        <CopilotButton variant="primary" size="sm" onClick={() => { setShowNewTask(!showNewTask); setSubmitSuccess(null); }}>
          {showNewTask ? 'Cancel' : 'New Task'}
        </CopilotButton>
        <CopilotButton variant="outline" size="sm" onClick={fetchTasks} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </CopilotButton>
        {tasks.length > 0 ? (
          <span className="text-sm text-neutral-500">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
        ) : null}
      </div>

      {/* New task form */}
      {showNewTask ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col gap-3 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-700">Send a task to this worker</span>
            <CopilotBadge color={isConnected ? 'success' : 'danger'} size="small">
              {isConnected ? 'Connected' : 'Connecting...'}
            </CopilotBadge>
          </div>
          <p className="text-xs text-neutral-500">
            Sends a message via WebSocket to the worker. Its Claude instance will process the prompt and create task steps automatically.
          </p>
          <CopilotTextarea
            value={taskPrompt}
            onChange={e => setTaskPrompt(e.target.value)}
            placeholder="Describe what you want the worker to do..."
            rows={4}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitTask(); } }}
          />
          <div className="flex items-center gap-3">
            <CopilotButton
              variant="primary"
              size="sm"
              onClick={handleSubmitTask}
              disabled={!isConnected || isStreaming || !taskPrompt.trim()}
            >
              {isStreaming ? 'Processing...' : 'Submit Task'}
            </CopilotButton>
            {submitSuccess ? (
              <span className="text-xs text-green-600">{submitSuccess}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {loadingDetail ? <p className="text-sm text-neutral-500">Loading task detail...</p> : null}

      {tasks.length > 0 ? (
        <CopilotTable
          columns={columns}
          data={tasks}
          size="sm"
          onRowClick={(row: DexterTask) => handleTaskClick(row)}
        />
      ) : !loading && !error ? (
        <p className="text-sm text-neutral-500">No tasks found for this worker.</p>
      ) : null}
    </div>
  );
}
