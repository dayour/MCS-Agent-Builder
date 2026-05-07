/**
 * RefreshRecommendationsButton — re-runs the enrichment workers (scoring,
 * instructions, evals, research) against the current agent spec.
 *
 * Tracks enrichment jobs through PipelineActivityContext so the global
 * ActivityBar can surface progress. On completion the spec is re-fetched via
 * session.reloadSession() so editors reflect the new values without a manual
 * reload.
 *
 * Idempotency: before POSTing we scan activeJobs for an in-flight enrichment
 * on this projectId+agentId. If one exists we adopt it instead of starting
 * another run — prevents double-click duplication and survives tab switches.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePipelineActivity } from '../../context/PipelineActivityContext';
import { useSpecSessionContext } from '../../context/SpecSessionContext';
import { CopilotButton } from '../ui/CopilotButton';
import { CopilotTooltip } from '../ui/CopilotTooltip';
import {
  Sparkle20Regular,
  CheckmarkCircle16Regular,
  Warning16Regular,
} from '@fluentui/react-icons';

const ENRICHMENT_STATUS_PREFIX = '/api/enrichment/status/';

export interface RefreshRecommendationsButtonProps {
  projectId: string | null;
  /** Dataverse-style agent slug. Session-backed projects always use 'default'. */
  agentId?: string;
  /** Visual density. 'compact' is for tight sidebars; 'default' for page headers. */
  density?: 'default' | 'compact';
  /** Optional label override for the idle-but-stale primary state. */
  label?: string;
}

function formatAgo(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

/** Titlecased label for each enrichment worker. Order matters for the tooltip. */
const WORKER_LABELS: ReadonlyArray<{ key: 'instructions' | 'evals' | 'scoring' | 'research'; label: string }> = [
  { key: 'instructions', label: 'Instructions' },
  { key: 'evals',        label: 'Evals' },
  { key: 'scoring',      label: 'Architecture score' },
  { key: 'research',     label: 'Component research' },
];

/**
 * Build a one-line-per-worker tooltip body. Each row: label · age (or never) · error flag.
 * Kept as plain text so the tooltip primitive doesn't need ReactNode handling.
 */
function buildWorkerTooltip(
  workers: Record<'scoring' | 'instructions' | 'evals' | 'research', { completedAt: string | null; hasErrors: boolean }>,
): string {
  const lines = WORKER_LABELS.map(({ key, label }) => {
    const w = workers[key];
    if (!w.completedAt) return `${label}: never`;
    const age = formatAgo(w.completedAt);
    return `${label}: ${age}${w.hasErrors ? ' (errors)' : ''}`;
  });
  return lines.join('\n');
}

export const RefreshRecommendationsButton: React.FC<RefreshRecommendationsButtonProps> = ({
  projectId,
  agentId = 'default',
  density = 'default',
  label,
}) => {
  const { enrichmentState, reloadSession } = useSpecSessionContext();
  const { jobs, trackJob } = usePipelineActivity();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const reloadedForJobRef = useRef<Set<string>>(new Set());

  // Match any enrichment job (running OR recently completed) for this target.
  const match = useMemo(() => {
    return jobs.find(
      (j) =>
        j.skillType === 'enrichment' &&
        j.projectId === projectId &&
        j.agentId === agentId,
    );
  }, [jobs, projectId, agentId]);

  // When an enrichment job completes, refresh the session once so editors pick
  // up the new instructions/evals/scoring/research fields. We key by jobId so
  // the reload fires at most once per job even as the memoized `match` churns.
  useEffect(() => {
    if (!match) return;
    if (match.status !== 'completed') return;
    if (reloadedForJobRef.current.has(match.id)) return;
    reloadedForJobRef.current.add(match.id);
    reloadSession();
  }, [match?.id, match?.status, reloadSession]);

  const onStart = useCallback(async () => {
    if (!projectId) return;
    if (starting) return;
    if (match && match.status === 'running') return;
    setStarting(true);
    setStartError(null);
    try {
      const res = await fetch('/api/enrichment/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, agentId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const { jobId } = (await res.json()) as { jobId: string };
      trackJob(jobId, {
        skillType: 'enrichment',
        projectId,
        agentId,
        statusUrlPrefix: ENRICHMENT_STATUS_PREFIX,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[RefreshRecommendationsButton] start failed:', msg);
      setStartError(msg);
    } finally {
      setStarting(false);
    }
  }, [projectId, agentId, starting, match, trackJob]);

  const { neverEnriched, dirtyCount, isStale, lastEnrichedAt, hasErrors, workers } = enrichmentState;
  const workersBody = buildWorkerTooltip(workers);

  // Progress for running state: ratio of completed/failed/skipped to total.
  const progressPct = useMemo(() => {
    if (!match || match.status !== 'running') return 0;
    const total = match.steps.length || 1;
    const done = match.steps.filter((s) => s.status === 'completed' || s.status === 'failed' || s.status === 'skipped').length;
    return Math.min(100, Math.round((done / total) * 100));
  }, [match]);

  if (!projectId) return null;

  const size = density === 'compact' ? 'xs' : 'sm';

  // Running — show progress pill (no click target; ActivityBar owns interaction)
  if (match && match.status === 'running') {
    return (
      <div
        className={
          density === 'compact'
            ? 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[hsl(var(--primary)/0.2)] bg-[hsl(var(--primary)/0.04)] text-[11px]'
            : 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[hsl(var(--primary)/0.2)] bg-[hsl(var(--primary)/0.04)] text-[12px]'
        }
      >
        <Sparkle20Regular className={density === 'compact' ? 'w-3 h-3 text-[hsl(var(--primary))] animate-pulse' : 'w-3.5 h-3.5 text-[hsl(var(--primary))] animate-pulse'} />
        <span className="text-gray-700">Refreshing recommendations</span>
        <span className="text-[hsl(var(--primary))] font-medium tabular-nums">{progressPct}%</span>
      </div>
    );
  }

  // Failed — allow retry
  if (match && match.status === 'failed') {
    return (
      <div className="inline-flex items-center gap-2">
        <CopilotButton
          variant="outline"
          size={size}
          onClick={onStart}
          disabled={starting}
          icon={<Warning16Regular className="text-red-600" />}
        >
          Refresh failed — retry
        </CopilotButton>
      </div>
    );
  }

  // Stale (includes never-enriched) — primary CTA
  if (isStale) {
    const defaultLabel = neverEnriched
      ? 'Run research'
      : dirtyCount > 0
        ? `Refresh recommendations · ${dirtyCount} change${dirtyCount === 1 ? '' : 's'}`
        : 'Refresh recommendations';
    const header = neverEnriched
      ? 'Generate instructions, evals, architecture score, and component research from the current spec.'
      : `Spec has changed since last refresh${lastEnrichedAt ? ` (${formatAgo(lastEnrichedAt)})` : ''}. Re-runs all four workers.`;
    const tooltip = `${header}\n\n${workersBody}`;
    return (
      <div className="inline-flex flex-col items-start gap-1">
        <CopilotTooltip content={<span className="whitespace-pre-line">{tooltip}</span>}>
          <CopilotButton
            variant="primary"
            size={size}
            onClick={onStart}
            disabled={starting}
            icon={<Sparkle20Regular />}
          >
            {starting ? 'Starting…' : (label || defaultLabel)}
          </CopilotButton>
        </CopilotTooltip>
        {startError && (
          <span className="text-[11px] text-red-600">Couldn't start refresh: {startError}</span>
        )}
      </div>
    );
  }

  // Fresh — subtle success state, click to force-refresh anyway
  const freshHeader = `Recommendations up to date${lastEnrichedAt ? ` · last run ${formatAgo(lastEnrichedAt)}` : ''}${hasErrors ? ' (last run had errors)' : ''}. Click to refresh anyway.`;
  const freshTooltip = `${freshHeader}\n\n${workersBody}`;
  return (
    <CopilotTooltip content={<span className="whitespace-pre-line">{freshTooltip}</span>}>
      <CopilotButton
        variant="outline"
        size={size}
        onClick={onStart}
        disabled={starting}
        icon={hasErrors ? <Warning16Regular className="text-amber-500" /> : <CheckmarkCircle16Regular className="text-emerald-600" />}
      >
        Up to date
      </CopilotButton>
    </CopilotTooltip>
  );
};
