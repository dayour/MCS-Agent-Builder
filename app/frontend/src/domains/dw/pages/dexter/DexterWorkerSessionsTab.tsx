import React, { useState, useEffect, useCallback } from 'react';
import { CopilotButton, CopilotTable, type TableColumn } from '../../../../components/ui';
import {
  listDexterWorkerSessions,
  fetchDexterSessionDetail,
  type AuthFetchFn,
  type DexterSession,
  type DexterSessionDetail,
} from '../../services/dexterWorkerService';

interface DexterWorkerSessionsTabProps {
  workerId: string;
  authFetch: AuthFetchFn;
}

export function DexterWorkerSessionsTab({ workerId, authFetch }: DexterWorkerSessionsTabProps) {
  const [sessions, setSessions] = useState<DexterSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<DexterSessionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDexterWorkerSessions(authFetch, workerId);
      setSessions(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  }, [authFetch, workerId]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleSessionClick = async (session: DexterSession) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const detail = await fetchDexterSessionDetail(authFetch, workerId, session.sessionId);
      setSelectedSession(detail);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch session detail');
    } finally {
      setLoadingDetail(false);
    }
  };

  if (selectedSession) {
    return (
      <div className="flex flex-col gap-4">
        <CopilotButton variant="outline" size="sm" onClick={() => setSelectedSession(null)}>
          &larr; Back to sessions
        </CopilotButton>

        <div className="text-sm">
          <div className="flex gap-4 mb-3 text-neutral-500">
            <span>Session: <span className="font-mono text-neutral-700">{selectedSession.sessionId}</span></span>
            <span>Status: <span className="text-neutral-700">{selectedSession.status ?? '—'}</span></span>
            <span>Messages: <span className="text-neutral-700">{selectedSession.messages.length}</span></span>
          </div>

          {selectedSession.messages.length === 0 ? (
            <p className="text-neutral-500">No messages in this session.</p>
          ) : (
            <div className="flex flex-col gap-2 max-w-3xl">
              {selectedSession.messages.map((msg, i) => (
                <div
                  key={i}
                  className={`rounded-lg px-4 py-3 text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-50 border border-blue-100'
                      : msg.role === 'assistant'
                        ? 'bg-neutral-50 border border-neutral-200'
                        : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-neutral-700 capitalize">{msg.role}</span>
                    {msg.timestamp && (
                      <span className="text-xs text-neutral-400">{new Date(msg.timestamp).toLocaleString()}</span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap text-neutral-800">{msg.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const columns: TableColumn[] = [
    { key: 'sessionId', label: 'Session ID', width: '35%',
      render: (value: string) => <span className="font-mono text-xs">{value}</span>,
    },
    { key: 'status', label: 'Status', width: '15%' },
    { key: 'createdAt', label: 'Created', width: '25%',
      render: (value: string) => value ? new Date(value).toLocaleString() : '—',
    },
    { key: 'messageCount', label: 'Messages', width: '15%',
      render: (value: number | null) => value ?? '—',
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <CopilotButton variant="outline" size="sm" onClick={fetchSessions} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </CopilotButton>
        {sessions.length > 0 && (
          <span className="text-sm text-neutral-500">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loadingDetail && (
        <p className="text-sm text-neutral-500">Loading session detail...</p>
      )}

      {sessions.length > 0 ? (
        <CopilotTable
          columns={columns}
          data={sessions}
          size="sm"
          onRowClick={(row: DexterSession) => handleSessionClick(row)}
        />
      ) : !loading && !error ? (
        <p className="text-sm text-neutral-500">No sessions found for this worker.</p>
      ) : null}
    </div>
  );
}
