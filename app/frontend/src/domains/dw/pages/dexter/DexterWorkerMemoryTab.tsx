import React, { useState, useEffect, useCallback } from 'react';
import { CopilotButton, CopilotTabs } from '../../../../components/ui';
import {
  fetchDexterSharedMemory,
  listDexterShortTermMemoryFiles,
  fetchDexterShortTermMemory,
  fetchDexterLongTermMemory,
  type AuthFetchFn,
} from '../../services/dexterWorkerService';

interface DexterWorkerMemoryTabProps {
  workerId: string;
  authFetch: AuthFetchFn;
}

const MEMORY_TABS = [
  { label: 'Shared', value: 'shared' },
  { label: 'Short-term', value: 'short-term' },
  { label: 'Long-term', value: 'long-term' },
];

/** Render any JSON payload in a readable <pre> block. */
function JsonBlock({ data, label }: { data: unknown; label?: string }) {
  if (data === null || data === undefined) return <p className="text-sm text-neutral-500">No data.</p>;
  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs font-medium text-neutral-500">{label}</span>}
      <pre className="bg-neutral-100 border border-neutral-200 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap max-h-[60vh]">
        {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function SharedMemorySection({ workerId, authFetch }: { workerId: string; authFetch: AuthFetchFn }) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchDexterSharedMemory(authFetch, workerId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch shared memory');
    } finally {
      setLoading(false);
    }
  }, [authFetch, workerId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-3">
      <CopilotButton variant="outline" size="sm" onClick={load} disabled={loading}>
        {loading ? 'Loading...' : 'Refresh'}
      </CopilotButton>
      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}
      <JsonBlock data={data} />
    </div>
  );
}

/** Extract date strings (YYYY-MM-DD) from the files list response. */
function parseDateFiles(data: unknown): string[] {
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  const files = Array.isArray(obj.files) ? obj.files : [];
  return files
    .map((f: unknown) => typeof f === 'string' ? f.replace(/\.md$/, '') : '')
    .filter(Boolean)
    .sort()
    .reverse(); // newest first
}

function ShortTermMemorySection({ workerId, authFetch }: { workerId: string; authFetch: AuthFetchFn }) {
  const [filesRaw, setFilesRaw] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateData, setDateData] = useState<unknown>(null);
  const [loadingDate, setLoadingDate] = useState(false);

  const dateFiles = parseDateFiles(filesRaw);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFilesRaw(await listDexterShortTermMemoryFiles(authFetch, workerId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to list short-term files');
    } finally {
      setLoading(false);
    }
  }, [authFetch, workerId]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const loadDate = useCallback(async (date: string) => {
    setSelectedDate(date);
    setLoadingDate(true);
    setError(null);
    setDateData(null);
    try {
      setDateData(await fetchDexterShortTermMemory(authFetch, workerId, date));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch short-term memory for date');
    } finally {
      setLoadingDate(false);
    }
  }, [authFetch, workerId]);

  if (selectedDate) {
    return (
      <div className="flex flex-col gap-3">
        <CopilotButton variant="outline" size="sm" onClick={() => { setSelectedDate(null); setDateData(null); }}>
          &larr; Back to file list
        </CopilotButton>
        <span className="text-sm font-medium text-neutral-700">Short-term memory for {selectedDate}</span>
        {loadingDate ? (
          <p className="text-sm text-neutral-500">Loading...</p>
        ) : (
          <JsonBlock data={dateData} />
        )}
        {error ? <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <CopilotButton variant="outline" size="sm" onClick={loadFiles} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </CopilotButton>
        {dateFiles.length > 0 ? (
          <span className="text-sm text-neutral-500">{dateFiles.length} file{dateFiles.length !== 1 ? 's' : ''}</span>
        ) : null}
      </div>

      {error ? <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {dateFiles.length > 0 ? (
        <div className="flex flex-col gap-1">
          {dateFiles.map(d => (
            <CopilotButton
              key={d}
              variant="transparent"
              size="sm"
              onClick={() => loadDate(d)}
              className="justify-start gap-2 font-normal"
            >
              <span className="text-neutral-400">&#128196;</span>
              <span className="font-mono text-neutral-700">{d}.md</span>
            </CopilotButton>
          ))}
        </div>
      ) : !loading && !error ? (
        <p className="text-sm text-neutral-500">No short-term memory files found.</p>
      ) : null}
    </div>
  );
}

function LongTermMemorySection({ workerId, authFetch }: { workerId: string; authFetch: AuthFetchFn }) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchDexterLongTermMemory(authFetch, workerId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch long-term memory');
    } finally {
      setLoading(false);
    }
  }, [authFetch, workerId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-3">
      <CopilotButton variant="outline" size="sm" onClick={load} disabled={loading}>
        {loading ? 'Loading...' : 'Refresh'}
      </CopilotButton>
      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}
      <JsonBlock data={data} />
    </div>
  );
}

export function DexterWorkerMemoryTab({ workerId, authFetch }: DexterWorkerMemoryTabProps) {
  const [subTab, setSubTab] = useState('shared');

  return (
    <div className="flex flex-col gap-4">
      <CopilotTabs tabs={MEMORY_TABS} value={subTab} onChange={setSubTab} size="sm" />
      {subTab === 'shared' && <SharedMemorySection workerId={workerId} authFetch={authFetch} />}
      {subTab === 'short-term' && <ShortTermMemorySection workerId={workerId} authFetch={authFetch} />}
      {subTab === 'long-term' && <LongTermMemorySection workerId={workerId} authFetch={authFetch} />}
    </div>
  );
}
