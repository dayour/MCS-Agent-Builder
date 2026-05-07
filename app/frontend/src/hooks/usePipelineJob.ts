/**
 * usePipelineJob — Drop-in replacement for useAnalyzeJob that uses the global
 * PipelineActivityContext. Same return type, same call pattern.
 *
 * Usage: const analyze = usePipelineJob('analyze');
 *        analyze.start(projectId, agentId);
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { usePipelineActivity } from '../context/PipelineActivityContext';
import type { AnalyzeStep, PipelineStatus, UseAnalyzeJobResult } from './useAnalyzeJob';

const EMPTY_STEPS: AnalyzeStep[] = [];
const EMPTY_ERRORS: Array<{ step: string; error: string }> = [];

export function usePipelineJob(skillType: string): UseAnalyzeJobResult {
  const { jobs, trackJob, dismissJob } = usePipelineActivity();
  const [localJobId, setLocalJobId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Find the most recent job matching this skillType + localJobId
  const job = useMemo(() => {
    if (localJobId) {
      return jobs.find(j => j.id === localJobId) ?? null;
    }
    return null;
  }, [jobs, localJobId]);

  const steps: AnalyzeStep[] = useMemo(() =>
    job?.steps?.map(s => ({
      id: s.id,
      label: s.label,
      status: s.status as AnalyzeStep['status'],
      detail: s.detail,
    })) ?? EMPTY_STEPS
  , [job?.steps]);

  const errors = useMemo(() => job?.errors ?? EMPTY_ERRORS, [job?.errors]);

  const status: PipelineStatus = job?.status === 'running' ? 'running'
    : job?.status === 'completed' ? 'completed'
    : job?.status === 'failed' ? 'failed'
    : 'idle';

  const start = useCallback(async (projectId: string, agentId?: string) => {
    // Cancel any existing local tracking
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/skill/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillType, projectId, agentId }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `Start failed: ${res.status}`);
      }

      const data = await res.json();
      const newJobId = data.jobId;
      if (!newJobId || typeof newJobId !== 'string') {
        throw new Error('Server returned invalid jobId');
      }
      setLocalJobId(newJobId);

      // Hand off to global tracker
      trackJob(newJobId, {
        skillType,
        projectId,
        agentId: agentId || '',
        projectName: projectId,
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // On failure, set a temporary failed state via localJobId = null
      setLocalJobId(null);
    }
  }, [skillType, trackJob]);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (localJobId) {
      dismissJob(localJobId);
    }
    setLocalJobId(null);
  }, [localJobId, dismissJob]);

  return {
    steps,
    status,
    jobId: localJobId,
    summary: job?.summary ?? null,
    errors,
    start,
    cancel,
  };
}
