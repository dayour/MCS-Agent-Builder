import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAgent } from '../context/AgentContext';
import { isDWAgent, isWorkflowAgent } from '../utils/agentTypeGuards';
import { DWBuildPage } from '../domains/dw/pages/DWBuildPage';
import { WorkflowBuildPage } from '../domains/workflow/pages/WorkflowBuildPage';
import { AgentBuildPage } from '../domains/agent/pages/AgentBuildPage';
import { PlaceholderCanvas } from '../components/PlaceholderCanvas';
import { LoaderCanvas } from '../components/LoaderCanvas';

export const BuildPageDispatcher: React.FC = () => {
  const { agentConfig, helperMessages, loadSpecAgent } = useAgent();
  const [searchParams] = useSearchParams();
  const [specLoading, setSpecLoading] = useState(false);
  const [specError, setSpecError] = useState<string | null>(null);

  // ── Load spec-backed agent from URL params ──
  const specProject = searchParams.get('project');
  const specAgent = searchParams.get('agent');

  useEffect(() => {
    if (!specProject || !specAgent) return;
    // Already loaded this spec agent
    if (agentConfig?.projectId === specProject && agentConfig?.specAgentId === specAgent) return;

    setSpecLoading(true);
    setSpecError(null);
    loadSpecAgent(specProject, specAgent)
      .catch(err => {
        console.error('[BuildPageDispatcher] Failed to load spec agent:', err);
        setSpecError(err.message);
      })
      .finally(() => setSpecLoading(false));
  }, [specProject, specAgent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Loading state for spec-backed agents
  if (specLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[hsl(var(--text-subtle))]">Loading agent spec...</span>
        </div>
      </div>
    );
  }

  if (specError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <div className="w-10 h-10 rounded-full bg-[hsl(var(--destructive)/0.1)] flex items-center justify-center">
            <span className="text-lg">!</span>
          </div>
          <p className="text-sm text-[hsl(var(--destructive))]">Failed to load agent spec</p>
          <p className="text-xs text-[hsl(var(--text-subtle))] max-w-xs">{specError}</p>
        </div>
      </div>
    );
  }

  if (!agentConfig) return null;

  if (isWorkflowAgent(agentConfig)) return <WorkflowBuildPage />;
  if (isDWAgent(agentConfig)) return <DWBuildPage />;

  const agentWasCreatedInPlanMode = agentConfig.createdWithPlanMode ?? false;
  if (
    !agentWasCreatedInPlanMode &&
    agentConfig.type === 'placeholder' &&
    !helperMessages.some(m => m.role === 'assistant' && !m.streaming)
  ) {
    return <LoaderCanvas />;
  }
  if (agentConfig.type === 'placeholder') return <PlaceholderCanvas />;

  return <AgentBuildPage />;
};
