import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { getQueryParam } from '../utils/featureFlagQuerySync';

export interface WorkflowContextType {
  workflowVersion: 1 | 2;
  setWorkflowVersion: (v: 1 | 2) => void;
  workflowVersionSaveCount: number;
  requestWorkflowSave: () => void;
  workflowVersionPublishCount: number;
  requestWorkflowPublishVersion: () => void;
  generatingWorkflowAgentId: string | null;
  setGeneratingWorkflowAgentId: (id: string | null) => void;
}

export const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export const useWorkflow = (): WorkflowContextType => {
  const ctx = useContext(WorkflowContext);
  if (!ctx) throw new Error('useWorkflow must be used within WorkflowProvider');
  return ctx;
};

export const WorkflowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [workflowVersion, setWorkflowVersionState] = useState<1 | 2>(() => {
    const urlParam = getQueryParam('workflowVersion');
    if (urlParam !== null && Number(urlParam) === 2) return 2;
    const stored = Number(localStorage.getItem('workflowVersion') || 1);
    return (stored === 2 ? 2 : 1) as 1 | 2;
  });

  const setWorkflowVersion = useCallback((v: 1 | 2) => {
    setWorkflowVersionState(v);
    localStorage.setItem('workflowVersion', String(v));
  }, []);

  const [workflowVersionSaveCount, setWorkflowVersionSaveCount] = useState(0);
  const requestWorkflowSave = useCallback(() => setWorkflowVersionSaveCount(n => n + 1), []);

  const [workflowVersionPublishCount, setWorkflowVersionPublishCount] = useState(0);
  const requestWorkflowPublishVersion = useCallback(() => setWorkflowVersionPublishCount(n => n + 1), []);

  const [generatingWorkflowAgentId, setGeneratingWorkflowAgentId] = useState<string | null>(null);

  const value = useMemo(() => ({
    workflowVersion,
    setWorkflowVersion,
    workflowVersionSaveCount,
    requestWorkflowSave,
    workflowVersionPublishCount,
    requestWorkflowPublishVersion,
    generatingWorkflowAgentId,
    setGeneratingWorkflowAgentId,
  }), [
    workflowVersion,
    setWorkflowVersion,
    workflowVersionSaveCount,
    requestWorkflowSave,
    workflowVersionPublishCount,
    requestWorkflowPublishVersion,
    generatingWorkflowAgentId,
  ]);

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
};
