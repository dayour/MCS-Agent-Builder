/**
 * useAnalyzeJob — React hook for the CLI-backed analyze pipeline.
 *
 * Starts the pipeline via POST /api/skill/start { skillType: "analyze" },
 * subscribes to SSE progress via GET /api/skill/status/:jobId,
 * and manages step states for the AnalyzeProgress component.
 */

import { useState, useCallback, useRef } from 'react';
import { consumeSSE } from '../lib/sseStream';

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface AnalyzeStep {
  id: string;
  label: string;
  status: StepStatus;
  detail: string | null;
}

export type PipelineStatus = 'idle' | 'running' | 'completed' | 'failed';

interface SSEStepEvent {
  type: 'step';
  step: string;
  status: string;
  detail: string | null;
  steps: AnalyzeStep[];
}

interface SSEStateEvent {
  type: 'state';
  steps: AnalyzeStep[];
  status: string;
}

interface SSEDoneEvent {
  type: 'done';
  status: string;
  summary: string | null;
  errors: Array<{ step: string; error: string }>;
  steps: AnalyzeStep[];
}

type SSEEvent = SSEStepEvent | SSEStateEvent | SSEDoneEvent;

export interface UseAnalyzeJobResult {
  steps: AnalyzeStep[];
  status: PipelineStatus;
  jobId: string | null;
  summary: string | null;
  errors: Array<{ step: string; error: string }>;
  start: (projectId: string, agentId?: string) => Promise<void>;
  cancel: () => void;
}

export function useAnalyzeJob(): UseAnalyzeJobResult {
  const [steps, setSteps] = useState<AnalyzeStep[]>([]);
  const [status, setStatus] = useState<PipelineStatus>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [errors, setErrors] = useState<Array<{ step: string; error: string }>>([]);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (projectId: string, agentId?: string) => {
    // Cancel any existing run
    if (abortRef.current) {
      abortRef.current.abort();
    }

    setStatus('running');
    setSummary(null);
    setErrors([]);
    setJobId(null);

    try {
      // Start the pipeline
      const res = await fetch('/api/skill/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillType: 'analyze', projectId, agentId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `Start failed: ${res.status}`);
      }

      const { jobId: newJobId } = await res.json();
      setJobId(newJobId);

      // Subscribe to SSE progress
      const ac = new AbortController();
      abortRef.current = ac;

      const sseRes = await fetch(`/api/skill/status/${newJobId}`, {
        signal: ac.signal,
      });

      if (!sseRes.ok) {
        throw new Error(`SSE subscribe failed: ${sseRes.status}`);
      }

      await consumeSSE<SSEEvent>(sseRes, (event) => {
        if (event.type === 'state' || event.type === 'step') {
          setSteps(event.steps.map(s => ({ ...s })));
        }

        if (event.type === 'done') {
          setSteps(event.steps.map(s => ({ ...s })));
          setStatus(event.status === 'completed' ? 'completed' : 'failed');
          setSummary(event.summary);
          setErrors(event.errors || []);
          abortRef.current = null;
        }
      }, ac.signal);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Cancelled — don't update status
        return;
      }
      setStatus('failed');
      setSummary(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStatus('idle');
  }, []);

  return { steps, status, jobId, summary, errors, start, cancel };
}
