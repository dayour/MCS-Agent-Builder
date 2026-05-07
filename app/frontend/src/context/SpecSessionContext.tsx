/**
 * SpecSessionContext — single source of truth for the unified spec chat.
 *
 * Backed by the server (Build-Guides/:projectId/session.json + agentspec.json +
 * spec-changelog.jsonl). The projectId is canonicalized in the URL as `?project=`
 * so refreshing, deep-linking, or bouncing between /, /spec, and /project all
 * point at the same session.
 *
 * Home page and /spec both consume this context — when chat patches the spec,
 * /spec reflects the update live; when /spec edits are wired (future), chat
 * sees them too.
 *
 * Hydration: on mount and whenever `project` query param changes, fetches
 *   GET /api/projects/:id/session
 *   → { messages, specData, changelog, updatedAt }
 *
 * Persistence: messages autosave on change (debounced). Spec patches go
 * through POST /api/projects/:id/spec which stamps the changelog server-side.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { consumeSSE } from '../lib/sseStream';
import {
  FIELD_TO_GENERATORS,
  ENRICHMENT_INPUT_FIELDS,
  type EnrichmentGenerator,
} from '../utils/enrichmentDependencies';

export interface SpecChangeEntry {
  changeId: string;
  ts: string;
  source: 'chat' | 'analyze';
  summary?: string;
  affectedPaths?: string[];
  turnId?: string | null;
}

export interface SpecSessionMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string | Date;
  attachedFileNames?: string[];
}

export interface SpecSessionStepEvent {
  kind: 'step' | 'error' | 'done';
  message?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
}

export interface EnrichmentWorkerState {
  /** ISO timestamp of last successful completion, or null if never run. */
  completedAt: string | null;
  /** True if the last run for this worker had errors. */
  hasErrors: boolean;
}

export interface EnrichmentState {
  /** ISO timestamp of the most recent enrichment-worker completion, or null. */
  lastEnrichedAt: string | null;
  /** Changelog entries from user chat since lastEnrichedAt (or since creation if never). */
  dirtyCount: number;
  /** No enrichment has ever run against this spec. */
  neverEnriched: boolean;
  /** At least one enrichment worker completed with errors last run. */
  hasErrors: boolean;
  /** Convenience: neverEnriched || dirtyCount > 0. */
  isStale: boolean;
  /** Per-worker state — keys are EnrichmentGenerator values. */
  workers: Record<EnrichmentGenerator, EnrichmentWorkerState>;
  /**
   * Per-input-field dirty counts. Each key is a top-level spec field that
   * feeds at least one generator; the value is how many chat-sourced edits
   * have landed on that field since the oldest dependent generator last ran.
   * Use to light up per-section stale pills.
   */
  fieldDirtyCounts: Record<string, number>;
}

interface SpecSessionContextValue {
  projectId: string | null;
  specData: any;
  messages: SpecSessionMessage[];
  changelog: SpecChangeEntry[];
  isHydrating: boolean;
  isAnalyzing: boolean;
  /** Derived freshness state of the enrichment auxiliary fields (instructions/evals/scoring/research). */
  enrichmentState: EnrichmentState;

  /** Re-fetch session (spec + changelog) from the server. Used after enrichment completes. */
  reloadSession: () => Promise<void>;

  /** Force-set the projectId (updates URL). Null clears the session. */
  setProjectId: (id: string | null) => void;

  /** Append a message; caller is responsible for providing a stable id. */
  addMessage: (msg: SpecSessionMessage) => void;

  /** Replace the messages array (used when restoring from server). */
  setMessages: (msgs: SpecSessionMessage[]) => void;

  /**
   * Directly kick off the analyze pipeline (used when we want to bypass the
   * orchestrator — e.g. first-turn when files were attached).
   */
  runAnalyze: (files: File[], projectName: string, onStepEvent?: (e: SpecSessionStepEvent) => void) => Promise<boolean>;

  /** Apply a spec patch from the client (used when the orchestrator returned APPLY_SPEC_UPDATE). */
  applyServerPatch: (patch: Record<string, any>, source: 'chat' | 'analyze', summary?: string, turnId?: string | null) => Promise<any>;
}

const SpecSessionContext = createContext<SpecSessionContextValue | null>(null);

const ANALYZE_STEP_LABELS: Record<string, string> = {
  process: 'Processing documents',
  classify: 'Classifying content',
  research: 'Researching MCS components',
  score: 'Scoring architecture',
  generate: 'Generating agent spec',
  evals: 'Creating eval sets',
  finalize: 'Finalizing',
};

function slugify(name: string): string {
  return name.replace(/ /g, '-').replace(/[^\w-]/g, '').slice(0, 60) || `project-${Date.now()}`;
}

export const SpecSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlProjectId = searchParams.get('project');

  const [projectId, setProjectIdState] = useState<string | null>(urlProjectId);
  const [specData, setSpecData] = useState<any>(null);
  const [messages, setMessagesState] = useState<SpecSessionMessage[]>([]);
  const [changelog, setChangelog] = useState<SpecChangeEntry[]>([]);
  const [isHydrating, setIsHydrating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoadedProjectRef = useRef<string | null>(null);
  // IDs of projects we created client-side this session. On hydration, if the
  // project is in this set we skip replacing local messages with the (empty)
  // server response — otherwise the initial user turn gets wiped between
  // ensureProject() and the session.json first write.
  const clientCreatedRef = useRef<Set<string>>(new Set());

  // Keep state in sync with URL project param
  useEffect(() => {
    if (urlProjectId !== projectId) setProjectIdState(urlProjectId);
  }, [urlProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const setProjectId = useCallback((id: string | null) => {
    setProjectIdState(id);
    const next = new URLSearchParams(searchParams);
    if (id) next.set('project', id); else next.delete('project');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Hydrate from server whenever projectId changes
  useEffect(() => {
    if (!projectId) {
      setSpecData(null);
      setMessagesState([]);
      setChangelog([]);
      lastLoadedProjectRef.current = null;
      return;
    }
    if (lastLoadedProjectRef.current === projectId) return;
    lastLoadedProjectRef.current = projectId;
    const wasClientCreated = clientCreatedRef.current.has(projectId);
    setIsHydrating(true);
    fetch(`/api/projects/${encodeURIComponent(projectId)}/session`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data) return;
        if (data.specData) setSpecData(data.specData);
        if (Array.isArray(data.changelog)) setChangelog(data.changelog);
        // Only replace local messages if the server has actual history.
        // Fresh client-created projects have an empty session.json — keeping
        // local state preserves the in-flight user turn.
        if (!wasClientCreated && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessagesState(data.messages);
        }
      })
      .catch(err => console.warn('[spec-session] hydrate failed:', err))
      .finally(() => setIsHydrating(false));
  }, [projectId]);

  // Debounced autosave of messages
  useEffect(() => {
    if (!projectId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fetch(`/api/projects/${encodeURIComponent(projectId)}/session`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      }).catch(err => console.warn('[spec-session] autosave failed:', err));
    }, 800);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [projectId, messages]);

  const addMessage = useCallback((msg: SpecSessionMessage) => {
    setMessagesState(prev => [...prev, msg]);
  }, []);

  const setMessages = useCallback((msgs: SpecSessionMessage[]) => {
    setMessagesState(msgs);
  }, []);

  const ensureProject = useCallback(async (name: string): Promise<string | null> => {
    if (projectId) return projectId;
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: slugify(name) }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      clientCreatedRef.current.add(data.id);
      setProjectId(data.id);
      return data.id as string;
    } catch { return null; }
  }, [projectId, setProjectId]);

  const applyServerPatch = useCallback(async (
    patch: Record<string, any>,
    source: 'chat' | 'analyze',
    summary?: string,
    turnId?: string | null,
  ): Promise<any> => {
    if (!projectId || !patch) return null;
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/spec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch, source, summary, turnId }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.spec) setSpecData(data.spec);
      if (data.change) setChangelog(prev => [...prev, data.change]);
      return data.spec;
    } catch (err) {
      console.warn('[spec-session] patch failed:', err);
      return null;
    }
  }, [projectId]);

  const uploadFiles = useCallback(async (pid: string, files: File[]) => {
    for (const file of files) {
      const form = new FormData();
      form.append('file', file);
      try {
        await fetch(`/api/projects/${encodeURIComponent(pid)}/upload`, { method: 'POST', body: form });
      } catch (err) {
        console.warn('[spec-session] upload failed for', file.name, err);
      }
    }
  }, []);

  const runAnalyze = useCallback(async (
    files: File[],
    projectName: string,
    onStepEvent?: (e: SpecSessionStepEvent) => void,
  ): Promise<boolean> => {
    if (isAnalyzing) return false;
    setIsAnalyzing(true);
    const turnId = `analyze-${Date.now()}`;
    try {
      const pid = projectId || await ensureProject(projectName);
      if (!pid) {
        onStepEvent?.({ kind: 'error', message: 'Could not create project on the server.' });
        return false;
      }

      if (files.length > 0) {
        onStepEvent?.({ kind: 'step', message: `Uploading ${files.length} file${files.length === 1 ? '' : 's'}`, status: 'running' });
        await uploadFiles(pid, files);
      }

      onStepEvent?.({ kind: 'step', message: 'Starting analysis', status: 'running' });

      const startRes = await fetch('/api/skill/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillType: 'analyze', projectId: pid }),
      });
      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({ error: startRes.statusText }));
        onStepEvent?.({ kind: 'error', message: `Could not start analysis: ${err.error || startRes.status}` });
        return false;
      }
      const { jobId } = await startRes.json();

      const ac = new AbortController();
      const sse = await fetch(`/api/skill/status/${jobId}`, { signal: ac.signal });
      if (!sse.ok) {
        onStepEvent?.({ kind: 'error', message: `SSE failed: ${sse.status}` });
        return false;
      }

      let success = false;
      await consumeSSE<any>(sse, (evt) => {
        if (!evt) return;
        if (evt.type === 'step') {
          const label = ANALYZE_STEP_LABELS[evt.step] || evt.step;
          onStepEvent?.({ kind: 'step', message: label, status: evt.status });
        } else if (evt.type === 'done') {
          success = evt.status === 'completed';
          ac.abort();
        }
      }, ac.signal).catch(() => { /* abort expected */ });

      if (success) {
        // Re-fetch session (spec + changelog) after the pipeline wrote to disk
        try {
          const res = await fetch(`/api/projects/${encodeURIComponent(pid)}/session`);
          if (res.ok) {
            const data = await res.json();
            if (data.specData) setSpecData(data.specData);
            if (Array.isArray(data.changelog)) setChangelog(data.changelog);
          }
        } catch { /* swallow */ }

        // Stamp a changelog entry ourselves so the provenance shows "analyze".
        // (The analyze pipeline writes the spec but doesn't hit our /spec endpoint.)
        await fetch(`/api/projects/${encodeURIComponent(pid)}/spec`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patch: {},
            source: 'analyze',
            summary: 'Spec generated from documents',
            turnId,
          }),
        }).catch(() => {});
      }
      onStepEvent?.({ kind: 'done', status: success ? 'completed' : 'failed' });
      return success;
    } finally {
      setIsAnalyzing(false);
    }
  }, [projectId, isAnalyzing, ensureProject, uploadFiles]);

const reloadSession = useCallback(async (): Promise<void> => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/session`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.specData) setSpecData(data.specData);
      if (Array.isArray(data.changelog)) setChangelog(data.changelog);
    } catch (err) {
      console.warn('[spec-session] reload failed:', err);
    }
  }, [projectId]);

  const enrichmentState = useMemo<EnrichmentState>(() => {
    const enrichment = specData?._enrichment;
    const allWorkers: EnrichmentGenerator[] = ['scoring', 'instructions', 'evals', 'research'];
    const workers: Record<EnrichmentGenerator, EnrichmentWorkerState> = {
      scoring:      { completedAt: null, hasErrors: false },
      instructions: { completedAt: null, hasErrors: false },
      evals:        { completedAt: null, hasErrors: false },
      research:     { completedAt: null, hasErrors: false },
    };
    const completedAts: number[] = [];
    let anyErrors = false;

    if (enrichment && typeof enrichment === 'object') {
      for (const key of allWorkers) {
        const block = (enrichment as Record<string, any>)[key];
        if (!block || typeof block !== 'object') continue;
        const ts = block.completedAt;
        if (typeof ts === 'string') {
          const ms = Date.parse(ts);
          if (!Number.isNaN(ms)) {
            workers[key].completedAt = new Date(ms).toISOString();
            completedAts.push(ms);
          }
        }
        const workerHasErrors =
          block.status === 'failed' ||
          !!block.error ||
          (Array.isArray(block.errors) && block.errors.length > 0);
        if (workerHasErrors) {
          workers[key].hasErrors = true;
          anyErrors = true;
        }
      }
    }

    const lastEnrichedMs = completedAts.length > 0 ? Math.max(...completedAts) : null;
    const lastEnrichedAt = lastEnrichedMs ? new Date(lastEnrichedMs).toISOString() : null;
    const neverEnriched = lastEnrichedMs === null;

    // Per-field staleness: for each input field, find the OLDEST completedAt
    // among generators that depend on it. An edit to that field after that
    // moment means at least one downstream output is stale. We use min() not
    // max() because a field can feed multiple generators; ANY stale generator
    // that depends on it is enough to consider the field dirty.
    const chatEntries = (changelog || []).filter(e => e.source === 'chat');
    const fieldDirtyCounts: Record<string, number> = {};
    for (const field of ENRICHMENT_INPUT_FIELDS) {
      const deps = FIELD_TO_GENERATORS[field] || [];
      const depCompletedAts: number[] = deps
        .map(d => workers[d].completedAt)
        .filter((v): v is string => !!v)
        .map(v => Date.parse(v))
        .filter(ms => !Number.isNaN(ms));
      // If ANY dependent generator has never run, the field is considered
      // stale from the beginning of time — count every chat edit. Otherwise
      // use the oldest of the dependent completedAts as the cutoff.
      const cutoff = depCompletedAts.length < deps.length
        ? 0
        : Math.min(...depCompletedAts);
      let count = 0;
      for (const entry of chatEntries) {
        const t = Date.parse(entry.ts);
        if (Number.isNaN(t)) continue;
        if (t <= cutoff) continue;
        const paths = entry.affectedPaths || [];
        if (paths.length === 0) continue;
        if (paths.includes(field)) count++;
      }
      if (count > 0) fieldDirtyCounts[field] = count;
    }

    // Overall dirty count: sum of chat edits across all tracked input fields,
    // de-duplicated per changelog entry (an entry touching two fields still
    // counts once in the top-line number).
    const dirtyChangeIds = new Set<string>();
    for (const entry of chatEntries) {
      const t = Date.parse(entry.ts);
      if (Number.isNaN(t)) continue;
      const paths = entry.affectedPaths || [];
      for (const p of paths) {
        const deps = FIELD_TO_GENERATORS[p];
        if (!deps) continue;
        // Use the same cutoff logic as per-field.
        const depCompletedAts: number[] = deps
          .map(d => workers[d].completedAt)
          .filter((v): v is string => !!v)
          .map(v => Date.parse(v))
          .filter(ms => !Number.isNaN(ms));
        const cutoff = depCompletedAts.length < deps.length
          ? 0
          : Math.min(...depCompletedAts);
        if (t > cutoff) {
          dirtyChangeIds.add(entry.changeId);
          break;
        }
      }
    }
    const dirtyCount = dirtyChangeIds.size;

    return {
      lastEnrichedAt,
      dirtyCount,
      neverEnriched,
      hasErrors: anyErrors,
      isStale: neverEnriched || dirtyCount > 0,
      workers,
      fieldDirtyCounts,
    };
  }, [specData, changelog]);

  const value = useMemo<SpecSessionContextValue>(() => ({
    projectId,
    specData,
    messages,
    changelog,
    isHydrating,
    isAnalyzing,
    enrichmentState,
    reloadSession,
    setProjectId,
    addMessage,
    setMessages,
    runAnalyze,
    applyServerPatch,
  }), [projectId, specData, messages, changelog, isHydrating, isAnalyzing, enrichmentState, reloadSession, setProjectId, addMessage, setMessages, runAnalyze, applyServerPatch]);

  return <SpecSessionContext.Provider value={value}>{children}</SpecSessionContext.Provider>;
};

export function useSpecSessionContext(): SpecSessionContextValue {
  const ctx = useContext(SpecSessionContext);
  if (!ctx) throw new Error('useSpecSessionContext must be used inside SpecSessionProvider');
  return ctx;
}
