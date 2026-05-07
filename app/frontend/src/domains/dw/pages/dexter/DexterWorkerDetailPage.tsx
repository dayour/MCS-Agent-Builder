import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDW } from '../../context/DWContext';
import { useDexterAuthFetch } from '../../../../auth/useDexterAuthFetch';
import { fetchDexterWorkerDetail, type DexterWorkerDetail } from '../../services/dexterWorkerService';
import { CopilotButton, CopilotTabs, CopilotBadge } from '../../../../components/ui';
import { DexterWorkerOverviewTab } from './DexterWorkerOverviewTab';
import { DexterWorkerSessionsTab } from './DexterWorkerSessionsTab';
import { DexterWorkerTasksTab } from './DexterWorkerTasksTab';
import { DexterWorkerMemoryTab } from './DexterWorkerMemoryTab';
import { DexterWorkerReachoutTab } from './DexterWorkerReachoutTab';
import { DexterWorkerChatTab } from './DexterWorkerChatTab';
import { DexterWorkerMessagesTab } from './DexterWorkerMessagesTab';
import { badgeColor } from './dexterUtils';
import { useDexterWorkerProfile } from '../../hooks/useDexterWorkerProfile';

const TABS = [
  { label: 'Overview', value: 'overview' },
  { label: 'Messages', value: 'messages' },
  { label: 'Chat', value: 'chat' },
  { label: 'Sessions', value: 'sessions' },
  { label: 'Tasks', value: 'tasks' },
  { label: 'Memory', value: 'memory' },
  { label: 'Reachout', value: 'reachout' },
];

function DexterWorkerDetailInner() {
  const { workerId } = useParams<{ workerId: string }>();
  const navigate = useNavigate();
  const authFetch = useDexterAuthFetch();
  const [worker, setWorker] = useState<DexterWorkerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const dwProfile = useDexterWorkerProfile(true, workerId);

  const loadWorker = useCallback(async () => {
    if (!workerId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDexterWorkerDetail(authFetch, workerId);
      setWorker(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch worker');
    } finally {
      setLoading(false);
    }
  }, [authFetch, workerId]);

  useEffect(() => { loadWorker(); }, [loadWorker]);

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading worker...</p>;
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <CopilotButton variant="outline" size="sm" onClick={() => navigate('/dexter-machines')}>
          &larr; Back to workers
        </CopilotButton>
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  if (!worker || !workerId) {
    return (
      <div className="flex flex-col gap-4">
        <CopilotButton variant="outline" size="sm" onClick={() => navigate('/dexter-machines')}>
          &larr; Back to workers
        </CopilotButton>
        <p className="text-sm text-neutral-500">Worker not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <CopilotButton variant="outline" size="sm" onClick={() => navigate('/dexter-machines')}>
          &larr; Back
        </CopilotButton>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-neutral-900">{worker.name || worker.id}</h2>
          {worker.status && <CopilotBadge color={badgeColor(worker.status)}>{worker.status}</CopilotBadge>}
          {worker.lifecycleStatus && (
            <CopilotBadge color={badgeColor(worker.lifecycleStatus)}>{worker.lifecycleStatus}</CopilotBadge>
          )}
        </div>
      </div>

      {/* Tabs */}
      <CopilotTabs tabs={TABS} value={activeTab} onChange={setActiveTab} size="md" />

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && (
          <DexterWorkerOverviewTab
            worker={worker}
            authFetch={authFetch}
            onWorkerUpdated={setWorker}
            onWorkerDeleted={() => navigate('/dexter-machines')}
            onNavigateToChat={() => setActiveTab('chat')}
            dwProfile={dwProfile}
          />
        )}
        {activeTab === 'messages' && <DexterWorkerMessagesTab />}
        {activeTab === 'chat' && (
          <DexterWorkerChatTab workerId={workerId} workerName={worker.name || workerId} />
        )}
        {activeTab === 'sessions' && (
          <DexterWorkerSessionsTab workerId={workerId} authFetch={authFetch} />
        )}
        {activeTab === 'tasks' && (
          <DexterWorkerTasksTab workerId={workerId} worker={worker} authFetch={authFetch} />
        )}
        {activeTab === 'memory' && (
          <DexterWorkerMemoryTab workerId={workerId} authFetch={authFetch} />
        )}
        {activeTab === 'reachout' && (
          <DexterWorkerReachoutTab workerId={workerId} authFetch={authFetch} />
        )}
      </div>
    </div>
  );
}

/**
 * Standalone detail page for a single Dexter worker.
 * Access via /#/dexter-machines/{workerId}.
 */
export function DexterWorkerDetailPage() {
  const { isDexter } = useDW();

  return (
    <div className="h-screen bg-neutral-50 p-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        {!isDexter ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            The Dexter feature toggle is off. Enable it in the Feature Toggles panel (bottom-left "i" icon) to use this page.
          </div>
        ) : (
          <DexterWorkerDetailInner />
        )}
      </div>
    </div>
  );
}
