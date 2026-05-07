import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDW } from '../../context/DWContext';
import { useDexterAuthFetch } from '../../../../auth/useDexterAuthFetch';
import { listDexterWorkers, deleteDexterWorker, type DexterWorker } from '../../services/dexterWorkerService';
import { CopilotButton, CopilotTable, DeleteConfirmDialog, type TableColumn } from '../../../../components/ui';
import { CreateWorkerDialog } from './CreateWorkerDialog';

/**
 * Inner component that uses useDexterAuthFetch (requires MsalProvider).
 * Only rendered when isDexter is on, so MsalProvider is guaranteed.
 */
function DexterWorkersInner() {
  const authFetch = useDexterAuthFetch();
  const navigate = useNavigate();
  const [workers, setWorkers] = useState<DexterWorker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteWorker, setPendingDeleteWorker] = useState<DexterWorker | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDexterWorkers(authFetch);
      setWorkers(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workers');
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  // Auto-fetch on mount
  useEffect(() => { handleFetch(); }, [handleFetch]);

  const handleDelete = useCallback(async (workerId: string) => {
    setPendingDeleteWorker(null);
    setDeletingId(workerId);
    setError(null);
    try {
      await deleteDexterWorker(authFetch, workerId);
      setWorkers(prev => prev.filter(w => w.id !== workerId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete worker');
    } finally {
      setDeletingId(null);
    }
  }, [authFetch]);

  const statusColor = (value: string | null) => {
    if (!value) return 'text-neutral-500';
    const v = String(value).toLowerCase();
    if (v === 'ready' || v === 'active' || v === 'succeeded') return 'text-green-600';
    if (v === 'provisioning' || v === 'creating') return 'text-blue-500';
    if (v === 'failed' || v === 'error') return 'text-red-500';
    if (v === 'offline') return 'text-amber-500';
    return 'text-neutral-600';
  };

  const columns: TableColumn[] = [
    { key: 'name', label: 'Name', width: '18%' },
    { key: 'id', label: 'ID', width: '14%',
      render: (value: string) => (
        <span className="font-mono text-xs text-neutral-500">{value ?? '—'}</span>
      ),
    },
    { key: 'status', label: 'Status', width: '10%',
      render: (value: string) => <span className={statusColor(value)}>{value ?? '—'}</span>,
    },
    { key: 'lifecycleStatus', label: 'Lifecycle', width: '10%',
      render: (value: string) => <span className={statusColor(value)}>{value ?? '—'}</span>,
    },
    { key: 'model', label: 'Model', width: '12%' },
    { key: 'createdAt', label: 'Created', width: '12%',
      render: (value: string) => value ? new Date(value).toLocaleString() : '—',
    },
    { key: 'actions', label: '', width: '12%',
      render: (_: unknown, row: DexterWorker) => (
        <CopilotButton
          variant="outline"
          size="sm"
          className="text-red-600 border-red-300 hover:bg-red-50"
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); setPendingDeleteWorker(row); }}
          disabled={deletingId === row.id}
        >
          {deletingId === row.id ? 'Deleting...' : 'Delete'}
        </CopilotButton>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <DeleteConfirmDialog
        isOpen={!!pendingDeleteWorker}
        onClose={() => setPendingDeleteWorker(null)}
        onConfirm={() => pendingDeleteWorker && handleDelete(pendingDeleteWorker.id)}
        title="Delete worker"
        message={`This will deprovision worker "${pendingDeleteWorker?.name || pendingDeleteWorker?.id}" and its underlying VM. This cannot be undone.`}
      />

      <CreateWorkerDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        authFetch={authFetch}
        onCreated={handleFetch}
      />

      <div className="flex items-center gap-3">
        <CopilotButton
          variant="primary"
          size="md"
          onClick={() => setShowCreateDialog(true)}
        >
          Create Worker
        </CopilotButton>
        <CopilotButton
          variant="outline"
          size="md"
          onClick={handleFetch}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </CopilotButton>
        {workers.length > 0 && (
          <span className="text-sm text-neutral-500">{workers.length} worker{workers.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {workers.length > 0 && (
        <CopilotTable
          columns={columns}
          data={workers}
          size="sm"
          onRowClick={(row: DexterWorker) => navigate(`/dexter-machines/${row.id}`)}
        />
      )}

      {!loading && !error && workers.length === 0 && (
        <p className="text-sm text-neutral-500">No workers found. Create one to get started.</p>
      )}
    </div>
  );
}

/**
 * Standalone admin page for viewing and managing Dexter workers.
 * Access via /#/dexter-machines — not linked from the main nav.
 */
export function DexterMachinesPage() {
  const { isDexter } = useDW();

  return (
    <div className="min-h-screen bg-neutral-50 p-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-1">Dexter Workers</h1>
        <p className="text-sm text-neutral-500 mb-6">Admin view — manage workers for your tenant. Click a row to view details.</p>

        {!isDexter ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            The Dexter feature toggle is off. Enable it in the Feature Toggles panel (bottom-left "i" icon) to use this page.
          </div>
        ) : (
          <DexterWorkersInner />
        )}
      </div>
    </div>
  );
}
