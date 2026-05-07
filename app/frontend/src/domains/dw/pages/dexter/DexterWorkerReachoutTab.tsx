import React, { useState, useEffect, useCallback } from 'react';
import { CopilotButton, CopilotTable, DeleteConfirmDialog, type TableColumn } from '../../../../components/ui';
import {
  listDexterReachoutSignals,
  fetchDexterReachoutSignal,
  cancelDexterReachoutSignal,
  type AuthFetchFn,
  type DexterReachoutSignal,
} from '../../services/dexterWorkerService';
import { statusColor } from './dexterUtils';

interface DexterWorkerReachoutTabProps {
  workerId: string;
  authFetch: AuthFetchFn;
}

export function DexterWorkerReachoutTab({ workerId, authFetch }: DexterWorkerReachoutTabProps) {
  const [signals, setSignals] = useState<DexterReachoutSignal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<DexterReachoutSignal | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<DexterReachoutSignal | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDexterReachoutSignals(authFetch, workerId);
      setSignals(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch reachout signals');
    } finally {
      setLoading(false);
    }
  }, [authFetch, workerId]);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  const handleSignalClick = async (signal: DexterReachoutSignal) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const detail = await fetchDexterReachoutSignal(authFetch, workerId, signal.signalId);
      setSelectedSignal(detail);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch signal detail');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCancel = async () => {
    if (!pendingCancel) return;
    const signalId = pendingCancel.signalId;
    setPendingCancel(null);
    setCancelling(true);
    setError(null);
    try {
      await cancelDexterReachoutSignal(authFetch, workerId, signalId);
      await fetchSignals();
      if (selectedSignal?.signalId === signalId) {
        setSelectedSignal(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel signal');
    } finally {
      setCancelling(false);
    }
  };

  if (selectedSignal) {
    // Render all fields from the signal as key-value pairs
    const entries = Object.entries(selectedSignal).filter(([k]) => k !== 'signalId');
    return (
      <div className="flex flex-col gap-4 max-w-2xl">
        <div className="flex items-center gap-3">
          <CopilotButton variant="outline" size="sm" onClick={() => setSelectedSignal(null)}>
            &larr; Back to signals
          </CopilotButton>
          <CopilotButton
            variant="outline"
            size="sm"
            className="text-red-600 border-red-300 hover:bg-red-50"
            onClick={() => setPendingCancel(selectedSignal)}
            disabled={cancelling}
          >
            Cancel Signal
          </CopilotButton>
        </div>

        <div className="border border-neutral-200 rounded-lg p-4 bg-white">
          <div className="grid grid-cols-[160px_1fr] gap-y-3 gap-x-4 text-sm">
            <span className="text-neutral-500 font-medium">Signal ID</span>
            <span className="font-mono text-xs text-neutral-600">{selectedSignal.signalId}</span>
            {entries.map(([key, value]) => (
              <React.Fragment key={key}>
                <span className="text-neutral-500 font-medium">{key}</span>
                <span className="whitespace-pre-wrap break-all text-sm">
                  {value === null || value === undefined
                    ? '—'
                    : typeof value === 'object'
                      ? <pre className="text-xs bg-neutral-50 rounded p-2">{JSON.stringify(value, null, 2)}</pre>
                      : String(value)}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const columns: TableColumn[] = [
    { key: 'signalId', label: 'Signal ID', width: '35%',
      render: (value: string) => <span className="font-mono text-xs">{value}</span>,
    },
    { key: 'status', label: 'Status', width: '15%',
      render: (value: string) => <span className={statusColor(value)}>{value ?? '—'}</span>,
    },
    { key: 'createdAt', label: 'Created', width: '25%',
      render: (value: string) => value ? new Date(value).toLocaleString() : '—',
    },
    { key: 'actions', label: '', width: '15%',
      render: (_: unknown, row: DexterReachoutSignal) => (
        <CopilotButton
          variant="outline"
          size="sm"
          className="text-red-600 border-red-300 hover:bg-red-50"
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); setPendingCancel(row); }}
          disabled={cancelling}
        >
          Cancel
        </CopilotButton>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <DeleteConfirmDialog
        isOpen={!!pendingCancel}
        onClose={() => setPendingCancel(null)}
        onConfirm={handleCancel}
        title="Cancel reachout signal"
        message={`Cancel signal "${pendingCancel?.signalId}"? This cannot be undone.`}
      />

      <div className="flex items-center gap-3">
        <CopilotButton variant="outline" size="sm" onClick={fetchSignals} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </CopilotButton>
        {signals.length > 0 && (
          <span className="text-sm text-neutral-500">{signals.length} signal{signals.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loadingDetail && <p className="text-sm text-neutral-500">Loading signal detail...</p>}

      {signals.length > 0 ? (
        <CopilotTable
          columns={columns}
          data={signals}
          size="sm"
          onRowClick={(row: DexterReachoutSignal) => handleSignalClick(row)}
        />
      ) : !loading && !error ? (
        <p className="text-sm text-neutral-500">No reachout signals found for this worker.</p>
      ) : null}
    </div>
  );
}
