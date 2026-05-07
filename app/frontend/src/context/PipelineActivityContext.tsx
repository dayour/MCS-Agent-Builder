/**
 * PipelineActivityContext — Global tracker for background pipeline jobs.
 *
 * Persists across route navigation, project/agent switches, and browser refresh.
 * On mount, rehydrates active job state from the server and reconnects SSE streams.
 * Stores tracked job IDs in localStorage so refresh can recover.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, ReactNode } from 'react';
import { consumeSSE } from '../lib/sseStream';

// ── Types ───────────────────────────────────────────────────────────────────

export type JobStatus = 'running' | 'completed' | 'failed';

export interface PipelineStep {
  id: string;
  label: string;
  status: string;
  detail: string | null;
}

export interface PipelineJob {
  id: string;
  skillType: string;
  projectId: string;
  agentId: string;
  status: JobStatus;
  steps: PipelineStep[];
  errors: Array<{ step: string; error: string }>;
  startedAt: string | null;
  completedAt: string | null;
  summary?: string | null;
  /** Client-side display label (e.g. project name) */
  projectName?: string;
  /** User manually dismissed this job */
  dismissed?: boolean;
  /** SSE status URL prefix for this job type. Default: /api/skill/status/. */
  statusUrlPrefix?: string;
}

export interface TrackJobMeta {
  skillType: string;
  projectId: string;
  agentId: string;
  projectName?: string;
  /**
   * Override for SSE status URL prefix. Default is /api/skill/status/.
   * Pass /api/enrichment/status/ for enrichment workers — they speak the same
   * {type, steps, status, errors} envelope but live under a different route.
   */
  statusUrlPrefix?: string;
}

interface PipelineActivityContextType {
  jobs: PipelineJob[];
  activeJobs: PipelineJob[];
  recentJobs: PipelineJob[];
  trackJob: (jobId: string, meta: TrackJobMeta) => void;
  dismissJob: (jobId: string) => void;
  clearCompleted: () => void;
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
}

// ── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'pipeline-active-jobs';
const AUTO_DISMISS_MS = 5 * 60 * 1000; // 5 minutes
const PRUNE_AGE_MS = 30 * 60 * 1000;   // 30 minutes
const MAX_TRACKED = 20;

// ── localStorage helpers ────────────────────────────────────────────────────

interface StoredJob {
  id: string;
  skillType: string;
  projectId: string;
  agentId: string;
  projectName?: string;
  statusUrlPrefix?: string;
  trackedAt: number;
}

function readStoredJobs(): StoredJob[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // Prune old entries
    const cutoff = Date.now() - PRUNE_AGE_MS;
    return arr.filter((j: StoredJob) => j.trackedAt > cutoff).slice(0, MAX_TRACKED);
  } catch { return []; }
}

function writeStoredJobs(jobs: StoredJob[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs.slice(0, MAX_TRACKED)));
  } catch { /* quota exceeded — silently ignore */ }
}

function addStoredJob(meta: StoredJob) {
  const existing = readStoredJobs().filter(j => j.id !== meta.id);
  writeStoredJobs([meta, ...existing]);
}

function removeStoredJob(jobId: string) {
  writeStoredJobs(readStoredJobs().filter(j => j.id !== jobId));
}

// ── SSE event types (mirror useAnalyzeJob) ──────────────────────────────────

interface SSEEvent {
  type: 'state' | 'step' | 'done' | 'draft' | 'grounded';
  steps?: PipelineStep[];
  status?: string;
  summary?: string | null;
  errors?: Array<{ step: string; error: string }>;
  [key: string]: unknown;
}

// ── Context ─────────────────────────────────────────────────────────────────

const PipelineActivityContext = createContext<PipelineActivityContextType | null>(null);

export const PipelineActivityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [jobMap, setJobMap] = useState<Map<string, PipelineJob>>(new Map());
  const [isExpanded, setIsExpanded] = useState(false);
  const abortRefs = useRef<Map<string, AbortController>>(new Map());
  const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const initialized = useRef(false);

  // ── Derived lists ──

  const jobs = useMemo(() => Array.from(jobMap.values()), [jobMap]);
  const activeJobs = useMemo(() => jobs.filter(j => j.status === 'running'), [jobs]);
  const recentJobs = useMemo(() => jobs.filter(j => j.status !== 'running' && !j.dismissed), [jobs]);

  // ── Update a single job in the map ──

  const updateJob = useCallback((jobId: string, updater: (prev: PipelineJob) => PipelineJob) => {
    setJobMap(prev => {
      const existing = prev.get(jobId);
      if (!existing) return prev;
      const next = new Map(prev);
      next.set(jobId, updater(existing));
      return next;
    });
  }, []);

  // ── Schedule auto-dismiss for completed jobs ──

  const scheduleAutoDismiss = useCallback((jobId: string) => {
    // Don't re-schedule if already scheduled
    if (dismissTimers.current.has(jobId)) return;
    const timer = setTimeout(() => {
      updateJob(jobId, j => ({ ...j, dismissed: true }));
      removeStoredJob(jobId);
      dismissTimers.current.delete(jobId);
    }, AUTO_DISMISS_MS);
    dismissTimers.current.set(jobId, timer);
  }, [updateJob]);

  // ── Connect SSE for a job ──

  const connectSSE = useCallback((jobId: string, statusUrlPrefix?: string) => {
    // Don't double-connect
    if (abortRefs.current.has(jobId)) return;

    const ac = new AbortController();
    abortRefs.current.set(jobId, ac);
    // Same-origin-only: reject anything that isn't a /api/ path. Keeps
    // caller mistakes and corrupted localStorage entries from pointing SSE
    // at a third-party host.
    const prefix = statusUrlPrefix && /^\/api\//.test(statusUrlPrefix)
      ? statusUrlPrefix
      : '/api/skill/status/';

    (async () => {
      try {
        const res = await fetch(`${prefix}${jobId}`, { signal: ac.signal });
        if (!res.ok) {
          // Job doesn't exist on server anymore — mark failed and remove
          updateJob(jobId, j => ({ ...j, status: 'failed' as JobStatus, completedAt: new Date().toISOString() }));
          removeStoredJob(jobId);
          abortRefs.current.delete(jobId);
          return;
        }

        await consumeSSE<SSEEvent>(res, (event) => {
          if (event.type === 'step') {
            // Step events: update step states only, NOT job status
            // (event.status is the step's status, not the job's)
            updateJob(jobId, j => ({
              ...j,
              steps: (event.steps || j.steps).map(s => ({ ...s })),
            }));
          }

          if (event.type === 'state') {
            // State events (on reconnect): update both steps and job status
            updateJob(jobId, j => ({
              ...j,
              steps: (event.steps || j.steps).map(s => ({ ...s })),
              status: (event.status === 'completed' || event.status === 'failed')
                ? event.status as JobStatus
                : j.status,
            }));
          }

          if (event.type === 'done') {
            const finalStatus = event.status === 'completed' ? 'completed' : 'failed';
            updateJob(jobId, j => ({
              ...j,
              steps: (event.steps || j.steps).map(s => ({ ...s })),
              status: finalStatus as JobStatus,
              errors: event.errors || j.errors,
              summary: event.summary ?? j.summary,
              completedAt: new Date().toISOString(),
            }));
            abortRefs.current.delete(jobId);

            // Auto-dismiss completed jobs (not failed — failed need attention)
            if (finalStatus === 'completed') {
              scheduleAutoDismiss(jobId);
            }
          }
        }, ac.signal);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // SSE failed — mark job as unknown state, don't remove
        abortRefs.current.delete(jobId);
      }
    })();
  }, [updateJob, scheduleAutoDismiss]);

  // ── Track a new job ──

  const trackJob = useCallback((jobId: string, meta: TrackJobMeta) => {
    // Write to localStorage synchronously (survives immediate refresh)
    addStoredJob({ id: jobId, ...meta, trackedAt: Date.now() });

    // Add to state
    setJobMap(prev => {
      const next = new Map(prev);
      next.set(jobId, {
        id: jobId,
        skillType: meta.skillType,
        projectId: meta.projectId,
        agentId: meta.agentId,
        status: 'running',
        steps: [],
        errors: [],
        startedAt: new Date().toISOString(),
        completedAt: null,
        projectName: meta.projectName,
        statusUrlPrefix: meta.statusUrlPrefix,
      });
      return next;
    });

    // Connect SSE
    connectSSE(jobId, meta.statusUrlPrefix);
  }, [connectSSE]);

  // ── Dismiss a job ──

  const dismissJob = useCallback((jobId: string) => {
    updateJob(jobId, j => ({ ...j, dismissed: true }));
    removeStoredJob(jobId);
    // Cancel SSE if still connected
    const ac = abortRefs.current.get(jobId);
    if (ac) { ac.abort(); abortRefs.current.delete(jobId); }
    // Cancel auto-dismiss timer
    const timer = dismissTimers.current.get(jobId);
    if (timer) { clearTimeout(timer); dismissTimers.current.delete(jobId); }
  }, [updateJob]);

  // ── Clear all completed/failed jobs ──

  const clearCompleted = useCallback(() => {
    setJobMap(prev => {
      const next = new Map(prev);
      for (const [id, job] of next) {
        if (job.status !== 'running') {
          next.delete(id);
          removeStoredJob(id);
          const timer = dismissTimers.current.get(id);
          if (timer) { clearTimeout(timer); dismissTimers.current.delete(id); }
        }
      }
      return next;
    });
  }, []);

  // ── Rehydrate on mount ──

  // Same-origin guard. Reject any persisted prefix that doesn't live under /api/
  // so a corrupted localStorage entry can't point us at an arbitrary URL.
  const sanitizePrefix = useCallback((prefix: string | undefined): string => {
    if (prefix && /^\/api\//.test(prefix)) return prefix;
    return '/api/skill/status/';
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const stored = readStoredJobs();
    if (stored.length === 0) return;

    // Split stored jobs by transport. The batch-status endpoint only knows
    // about /api/skill/* jobs (analyze pipeline, build, eval, fix). Enrichment
    // jobs live in a parallel registry — for those we skip the batch probe and
    // rely on the SSE endpoint which sends current state on connect.
    const skillJobs: StoredJob[] = [];
    const otherJobs: StoredJob[] = [];
    for (const s of stored) {
      const prefix = sanitizePrefix(s.statusUrlPrefix);
      if (prefix === '/api/skill/status/') skillJobs.push(s);
      else otherJobs.push({ ...s, statusUrlPrefix: prefix });
    }

    // Seed state for BOTH groups up front so the UI knows jobs are tracked even
    // if the batch probe is slow. We mark them running — SSE will correct it.
    const seedRunning = (s: StoredJob): PipelineJob => ({
      id: s.id,
      skillType: s.skillType,
      projectId: s.projectId,
      agentId: s.agentId,
      status: 'running',
      steps: [],
      errors: [],
      startedAt: null,
      completedAt: null,
      projectName: s.projectName,
      statusUrlPrefix: s.statusUrlPrefix,
    });

    if (otherJobs.length > 0) {
      setJobMap(prev => {
        const next = new Map(prev);
        for (const s of otherJobs) {
          if (!next.has(s.id)) next.set(s.id, seedRunning(s));
        }
        return next;
      });
      // Fire SSE for each. If the job is already finished the server sends a
      // done event immediately and we clean up; if expired the fetch 404s and
      // we strip the entry.
      for (const s of otherJobs) connectSSE(s.id, s.statusUrlPrefix);
    }

    if (skillJobs.length === 0) return;

    const ids = skillJobs.map(s => s.id);
    fetch(`/api/skill/jobs?ids=${ids.join(',')}`)
      .then(res => res.ok ? res.json() : { jobs: [] })
      .then(({ jobs: serverJobs }: { jobs: Array<{ id: string; skillType: string; projectId: string; agentId: string; status: string; steps: PipelineStep[]; errors: Array<{ step: string; error: string }>; startedAt: string | null; completedAt: string | null }> }) => {
        const serverMap = new Map(serverJobs.map((j: { id: string }) => [j.id, j]));

        setJobMap(prev => {
          const next = new Map(prev);
          for (const s of skillJobs) {
            const server = serverMap.get(s.id) as typeof serverJobs[number] | undefined;
            if (server) {
              next.set(s.id, {
                id: server.id,
                skillType: server.skillType,
                projectId: server.projectId,
                agentId: server.agentId,
                status: server.status as JobStatus,
                steps: server.steps || [],
                errors: server.errors || [],
                startedAt: server.startedAt,
                completedAt: server.completedAt,
                projectName: s.projectName,
              });
              // Reconnect SSE for running jobs
              if (server.status === 'running') {
                connectSSE(server.id);
              } else if (server.status === 'completed') {
                scheduleAutoDismiss(server.id);
              }
            } else {
              // Job not on server — it expired or server restarted. Remove from storage.
              removeStoredJob(s.id);
            }
          }
          return next;
        });
      })
      .catch(() => {
        // Server unreachable — keep stored entries, they'll rehydrate next time
      });
  }, [connectSSE, scheduleAutoDismiss, sanitizePrefix]);

  // ── Cleanup on unmount ──

  useEffect(() => {
    return () => {
      for (const ac of abortRefs.current.values()) ac.abort();
      for (const timer of dismissTimers.current.values()) clearTimeout(timer);
    };
  }, []);

  return (
    <PipelineActivityContext.Provider value={{
      jobs, activeJobs, recentJobs,
      trackJob, dismissJob, clearCompleted,
      isExpanded, setIsExpanded,
    }}>
      {children}
    </PipelineActivityContext.Provider>
  );
};

export const usePipelineActivity = (): PipelineActivityContextType => {
  const ctx = useContext(PipelineActivityContext);
  if (!ctx) throw new Error('usePipelineActivity must be used within PipelineActivityProvider');
  return ctx;
};
