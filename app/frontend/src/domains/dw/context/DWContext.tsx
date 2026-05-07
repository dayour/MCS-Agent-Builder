import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import { DWTask, DWKnowledgeItem, AgentConfig } from '../../../types';
import { createDexterWorker, startPollingWorker, stopAllPolling, type AuthFetchFn } from '../services/dexterWorkerService';
import { getAgentStorage, setAgentStorage } from '../../../utils/agentStorage';
import { initFlag } from '../../../utils/featureFlagQuerySync';
import { wrapWithGlobalInstructions } from '../utils/dwGlobalInstructions';
import { useAgent } from '../../../context/AgentContext';

export type DwTabKey = 'overview' | 'tasks' | 'knowledge' | 'messages' | 'content' | 'details' | 'organization';

export interface DWContextType {
  dwTab: DwTabKey;
  setDwTab: (tab: DwTabKey) => void;
  dwTaskFilter: string | null;
  setDwTaskFilter: (filter: string | null) => void;
  dwMessageFilter: string | null;
  setDwMessageFilter: (filter: string | null) => void;
  dwTasks: Record<string, DWTask[]>;
  addDwTask: (agentId: string, task: DWTask) => void;
  removeDwTask: (agentId: string, taskName: string) => void;
  removeDwTaskById: (agentId: string, taskId: string) => void;
  updateDwTask: (agentId: string, taskName: string, updates: Partial<Omit<DWTask, 'id'>>) => void;
  updateDwTaskById: (agentId: string, taskId: string, updates: Partial<Omit<DWTask, 'id'>>) => void;
  clearDwTasks: (agentId: string) => void;
  dwKnowledge: Record<string, DWKnowledgeItem[]>;
  addDwKnowledge: (agentId: string, item: DWKnowledgeItem) => void;
  removeDwKnowledge: (agentId: string, itemName: string) => void;
  updateDwKnowledge: (agentId: string, itemName: string, updates: Partial<Omit<DWKnowledgeItem, 'id'>>) => void;
  clearDwKnowledge: (agentId: string) => void;
  dwAddedToTeam: boolean;
  setDwAddedToTeam: (value: boolean) => void;
  isDexter: boolean;
  setIsDexter: (value: boolean) => void;
  isDwConversationalDemo: boolean;
  isAiTeammateDay100: boolean;
  setIsAiTeammateDay100: (value: boolean) => void;
  day0AnimKey: number;
  resetDay0Anim: () => void;
  dexterAuthReady: boolean;
  setDexterAuthFetch: (fn: AuthFetchFn) => void;
  getDexterAuthFetch: () => AuthFetchFn | null;
  tenantDomain: string;
  setTenantDomain: (domain: string) => void;
  provisionDexterWorker: (agentId: string, payload: { name: string; description: string; instructions: string; email?: string }) => void;
  isDwCreateDialogOpen: boolean;
  openDwCreateDialog: (onCancel?: () => void) => void;
  closeDwCreateDialog: (triggerCancel?: boolean) => void;
}

export const DWContext = createContext<DWContextType | undefined>(undefined);

export const DWProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { agents, updateSpecificAgent } = useAgent();

  // ── Tab / filter state ──────────────────────────────────────────────────
  const [dwTab, setDwTab] = useState<DwTabKey>('overview');
  const [dwTaskFilter, setDwTaskFilter] = useState<string | null>(null);
  const [dwMessageFilter, setDwMessageFilter] = useState<string | null>(null);

  // ── DW Tasks ─────────────────────────────────────────────────────────────
  const [dwTasks, setDwTasks] = useState<Record<string, DWTask[]>>(() => {
    const result: Record<string, DWTask[]> = {};
    // Migrate from legacy single-key storage if present
    try {
      const legacy = localStorage.getItem('dwTasks');
      if (legacy) {
        const parsed = JSON.parse(legacy) as Record<string, DWTask[]>;
        for (const [agentId, tasks] of Object.entries(parsed)) {
          if (tasks.length > 0) {
            result[agentId] = tasks;
            setAgentStorage(agentId, 'dwTasks', JSON.stringify(tasks));
          }
        }
        localStorage.removeItem('dwTasks');
        return result;
      }
    } catch { /* ignore */ }
    // Load from per-agent storage
    try {
      const savedAgents = localStorage.getItem('agents');
      const agentList: Array<{ id: string }> = savedAgents ? JSON.parse(savedAgents) : [];
      for (const agent of agentList) {
        const saved = getAgentStorage(agent.id, 'dwTasks');
        if (saved) {
          try { result[agent.id] = JSON.parse(saved); } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
    return result;
  });

  const prevDwTasksRef = useRef(dwTasks);
  useEffect(() => {
    for (const [agentId, tasks] of Object.entries(dwTasks)) {
      if (tasks !== prevDwTasksRef.current[agentId]) {
        setAgentStorage(agentId, 'dwTasks', JSON.stringify(tasks));
      }
    }
    prevDwTasksRef.current = dwTasks;
  }, [dwTasks]);

  const addDwTask = useCallback((agentId: string, task: DWTask) => {
    setDwTasks(prev => ({ ...prev, [agentId]: [task, ...(prev[agentId] || [])] }));
  }, []);

  const clearDwTasks = useCallback((agentId: string) => {
    setDwTasks(prev => ({ ...prev, [agentId]: [] }));
  }, []);

  const removeDwTask = useCallback((agentId: string, taskName: string) => {
    setDwTasks(prev => ({
      ...prev,
      [agentId]: (prev[agentId] || []).filter(t => t.name.toLowerCase() !== taskName.toLowerCase()),
    }));
  }, []);

  const updateDwTask = useCallback((agentId: string, taskName: string, updates: Partial<Omit<DWTask, 'id'>>) => {
    setDwTasks(prev => ({
      ...prev,
      [agentId]: (prev[agentId] || []).map(t =>
        t.name.toLowerCase() === taskName.toLowerCase() ? { ...t, ...updates } : t
      ),
    }));
  }, []);

  const updateDwTaskById = useCallback((agentId: string, taskId: string, updates: Partial<Omit<DWTask, 'id'>>) => {
    setDwTasks(prev => ({
      ...prev,
      [agentId]: (prev[agentId] || []).map(t => t.id === taskId ? { ...t, ...updates } : t),
    }));
  }, []);

  const removeDwTaskById = useCallback((agentId: string, taskId: string) => {
    setDwTasks(prev => ({
      ...prev,
      [agentId]: (prev[agentId] || []).filter(t => t.id !== taskId),
    }));
  }, []);

  // ── DW Knowledge ──────────────────────────────────────────────────────────
  const [dwKnowledge, setDwKnowledge] = useState<Record<string, DWKnowledgeItem[]>>(() => {
    const result: Record<string, DWKnowledgeItem[]> = {};
    try {
      const savedAgents = localStorage.getItem('agents');
      const agentList: Array<{ id: string }> = savedAgents ? JSON.parse(savedAgents) : [];
      for (const agent of agentList) {
        const saved = getAgentStorage(agent.id, 'dwKnowledge');
        if (saved) {
          try { result[agent.id] = JSON.parse(saved); } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
    return result;
  });

  const prevDwKnowledgeRef = useRef(dwKnowledge);
  useEffect(() => {
    for (const [agentId, items] of Object.entries(dwKnowledge)) {
      if (items !== prevDwKnowledgeRef.current[agentId]) {
        setAgentStorage(agentId, 'dwKnowledge', JSON.stringify(items));
      }
    }
    prevDwKnowledgeRef.current = dwKnowledge;
  }, [dwKnowledge]);

  const addDwKnowledge = useCallback((agentId: string, item: DWKnowledgeItem) => {
    setDwKnowledge(prev => ({ ...prev, [agentId]: [item, ...(prev[agentId] || [])] }));
  }, []);

  const removeDwKnowledge = useCallback((agentId: string, itemName: string) => {
    setDwKnowledge(prev => ({
      ...prev,
      [agentId]: (prev[agentId] || []).filter(k => k.name.toLowerCase() !== itemName.toLowerCase()),
    }));
  }, []);

  const updateDwKnowledge = useCallback((agentId: string, itemName: string, updates: Partial<Omit<DWKnowledgeItem, 'id'>>) => {
    setDwKnowledge(prev => ({
      ...prev,
      [agentId]: (prev[agentId] || []).map(k =>
        k.name.toLowerCase() === itemName.toLowerCase() ? { ...k, ...updates } : k
      ),
    }));
  }, []);

  const clearDwKnowledge = useCallback((agentId: string) => {
    setDwKnowledge(prev => ({ ...prev, [agentId]: [] }));
  }, []);

  // ── DW Add-to-team state ───────────────────────────────────────────────────
  const [dwAddedToTeam, setDwAddedToTeam] = useState(false);

  // ── Dexter Control Plane toggle ────────────────────────────────────────────
  const [isDexter, setIsDexterState] = useState<boolean>(() => initFlag('isDexter'));
  const setIsDexter = useCallback((value: boolean) => {
    setIsDexterState(value);
    localStorage.setItem('isDexter', String(value));
  }, []);

  // DW conversational demo cards are always on when Dexter is enabled
  const isDwConversationalDemo = isDexter;

  // ── AI Teammate Day-100 ────────────────────────────────────────────────────
  const [isAiTeammateDay100, setIsAiTeammateDay100State] = useState<boolean>(() =>
    initFlag('isAiTeammateDay100')
  );
  const setIsAiTeammateDay100 = useCallback((value: boolean) => {
    setIsAiTeammateDay100State(value);
    localStorage.setItem('isAiTeammateDay100', String(value));
  }, []);

  // ── Day-0 animation key ────────────────────────────────────────────────────
  const [day0AnimKey, setDay0AnimKey] = useState(0);
  const resetDay0Anim = useCallback(() => setDay0AnimKey(k => k + 1), []);

  // ── Dexter auth fetch ref ──────────────────────────────────────────────────
  // dexterAuthReady is state (not just a ref) so effects re-run when auth becomes available.
  const dexterAuthFetchRef = useRef<AuthFetchFn | null>(null);
  const [dexterAuthReady, setDexterAuthReady] = useState(false);
  const setDexterAuthFetch = useCallback((fn: AuthFetchFn) => {
    dexterAuthFetchRef.current = fn;
    setDexterAuthReady(true);
  }, []);
  const getDexterAuthFetch = useCallback(() => dexterAuthFetchRef.current, []);

  // ── Tenant domain ──────────────────────────────────────────────────────────
  const [tenantDomain, setTenantDomain] = useState('contoso.com');

  // ── Dexter provisioning queue ──────────────────────────────────────────────
  interface DexterQueueEntry { agentId: string; name: string; description: string; instructions: string; email?: string; }
  const dexterQueueRef = useRef<DexterQueueEntry[]>([]);
  const [dexterQueueVersion, setDexterQueueVersion] = useState(0);

  const provisionDexterWorker = useCallback((agentId: string, payload: { name: string; description: string; instructions: string; email?: string }) => {
    dexterQueueRef.current.push({ agentId, ...payload });
    setDexterQueueVersion(v => v + 1);
  }, []);

  // ── DW Create Dialog ───────────────────────────────────────────────────────
  const [isDwCreateDialogOpen, setIsDwCreateDialogOpen] = useState(false);
  const dwCreateDialogCancelCallbackRef = useRef<(() => void) | null>(null);
  const openDwCreateDialog = useCallback((onCancel?: () => void) => {
    dwCreateDialogCancelCallbackRef.current = onCancel ?? null;
    setIsDwCreateDialogOpen(true);
  }, []);
  const closeDwCreateDialog = useCallback((triggerCancel = false) => {
    if (triggerCancel) {
      dwCreateDialogCancelCallbackRef.current?.();
    }
    dwCreateDialogCancelCallbackRef.current = null;
    setIsDwCreateDialogOpen(false);
  }, []);

  // ── Dexter: process queued worker creations (event-driven) ─────────────────
  useEffect(() => {
    if (!isDexter || !dexterAuthFetchRef.current) return;
    const authFetch = dexterAuthFetchRef.current;

    // Drain the queue atomically
    const queued = dexterQueueRef.current.splice(0);
    if (queued.length === 0) return;

    queued.forEach(entry => {
      const { agentId } = entry;
      (async () => {
        try {
          // Mark as provisioning
          updateSpecificAgent(agentId, { lifecycleStatus: 'provisioning' as const });

          // Look up the agent to get role for global instruction injection
          const agent = agents.find((a: AgentConfig) => a.id === agentId);
          const isDW = agent?.agentType === 'DW';
          const finalInstructions = isDW
            ? wrapWithGlobalInstructions(entry.instructions, entry.name, agent?.role)
            : entry.instructions;

          const result = await createDexterWorker(authFetch, {
            name: entry.name,
            description: entry.description,
            instructions: finalInstructions,
            ...(entry.email ? { email: entry.email } : {}),
          });

          updateSpecificAgent(agentId, {
            dexterWorkerId: result.id,
            lifecycleStatus: result.lifecycleStatus,
            lifecycleError: result.lifecycleError,
          });

          // Start polling if provisioning
          if (result.lifecycleStatus === 'provisioning') {
            startPollingWorker(authFetch, result.id, (update) => {
              updateSpecificAgent(agentId, {
                lifecycleStatus: update.lifecycleStatus,
                lifecycleError: update.lifecycleError,
              });
            });
          }
        } catch (err) {
          console.error('[Dexter] Failed to create worker for agent', agentId, err);
          updateSpecificAgent(agentId, {
            lifecycleStatus: 'failed' as const,
            lifecycleError: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      })();
    });
  }, [dexterQueueVersion, isDexter, dexterAuthReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dexter: resume polling for provisioning agents on mount ───────────────
  useEffect(() => {
    if (!isDexter || !dexterAuthFetchRef.current) return;
    const authFetch = dexterAuthFetchRef.current;

    agents.forEach((agent: AgentConfig) => {
      if (agent.lifecycleStatus === 'provisioning' && agent.dexterWorkerId) {
        startPollingWorker(authFetch, agent.dexterWorkerId, (update) => {
          updateSpecificAgent(agent.id, {
            lifecycleStatus: update.lifecycleStatus,
            lifecycleError: update.lifecycleError,
          });
        });
      }
    });
    // No cleanup here — stopAllPolling is handled by the unmount effect below
    // and by isDexter toggling off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDexter, dexterAuthReady]);

  // Stop all polling on unmount
  useEffect(() => {
    return () => { stopAllPolling(); };
  }, []);

  // Stop all polling when Dexter flag is toggled off
  useEffect(() => {
    if (!isDexter) stopAllPolling();
  }, [isDexter]);

  const value: DWContextType = useMemo(() => ({
    dwTab,
    setDwTab,
    dwTaskFilter,
    setDwTaskFilter,
    dwMessageFilter,
    setDwMessageFilter,
    dwTasks,
    addDwTask,
    removeDwTask,
    removeDwTaskById,
    updateDwTask,
    updateDwTaskById,
    clearDwTasks,
    dwKnowledge,
    addDwKnowledge,
    removeDwKnowledge,
    updateDwKnowledge,
    clearDwKnowledge,
    dwAddedToTeam,
    setDwAddedToTeam,
    isDexter,
    setIsDexter,
    isDwConversationalDemo,
    isAiTeammateDay100,
    setIsAiTeammateDay100,
    day0AnimKey,
    resetDay0Anim,
    dexterAuthReady,
    setDexterAuthFetch,
    getDexterAuthFetch,
    tenantDomain,
    setTenantDomain,
    provisionDexterWorker,
    isDwCreateDialogOpen,
    openDwCreateDialog,
    closeDwCreateDialog,
  // State values are deps; useCallback-wrapped functions are stable references
  }), [dwTab, dwTaskFilter, dwMessageFilter, dwTasks, dwKnowledge, dwAddedToTeam,
    isDexter, isDwConversationalDemo, isAiTeammateDay100, day0AnimKey, dexterAuthReady,
    tenantDomain, isDwCreateDialogOpen,
    setDwTab, setDwTaskFilter, setDwMessageFilter, addDwTask, removeDwTask, removeDwTaskById,
    updateDwTask, updateDwTaskById, clearDwTasks, addDwKnowledge, removeDwKnowledge,
    updateDwKnowledge, clearDwKnowledge, setDwAddedToTeam, setIsDexter, setIsAiTeammateDay100,
    resetDay0Anim, setDexterAuthFetch, getDexterAuthFetch, setTenantDomain, provisionDexterWorker,
    openDwCreateDialog, closeDwCreateDialog]);

  return <DWContext.Provider value={value}>{children}</DWContext.Provider>;
};

export const useDW = (): DWContextType => {
  const ctx = useContext(DWContext);
  if (!ctx) throw new Error('useDW must be used within DWProvider');
  return ctx;
};
