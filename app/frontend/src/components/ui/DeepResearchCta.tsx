/**
 * DeepResearchCta — inline chat card that starts the analyze pipeline.
 *
 * Rendered when a chat message carries metadata.type === 'deep-research-cta'.
 * The card is self-contained:
 *   - Button when no matching job is running → fires POST /api/skill/start,
 *     registers the job with PipelineActivityContext so the global ActivityBar
 *     picks it up, and flips to a running pill.
 *   - Progress pill + percent while the job is active.
 *   - Completion link to the Spec page when done.
 *
 * Idempotency: before POSTing we scan activeJobs for a match on
 * (projectId, agentId, skillType='analyze'). If one exists we adopt it
 * instead of starting a new run — prevents double-click duplication and
 * recovers state after page refresh.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePipelineActivity } from '../../context/PipelineActivityContext';
import { CopilotButton } from './CopilotButton';
import { CopilotBadge } from './CopilotBadge';
import { Sparkle20Regular, ArrowRight20Regular, CheckmarkCircle16Regular } from '@fluentui/react-icons';

export interface DeepResearchCtaProps {
  projectId: string;
  agentId: string;
  /** Optional label override — defaults to "Run Deep Research". */
  label?: string;
}

export const DeepResearchCta: React.FC<DeepResearchCtaProps> = ({
  projectId,
  agentId,
  label = 'Run Deep Research',
}) => {
  const navigate = useNavigate();
  const { jobs, trackJob } = usePipelineActivity();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Find any existing analyze job for this project+agent. We look across all
  // jobs (running OR recently completed) so the CTA reflects reality after
  // refresh without double-firing.
  const match = useMemo(() => {
    return jobs.find(
      (j) =>
        j.skillType === 'analyze' &&
        j.projectId === projectId &&
        j.agentId === agentId,
    );
  }, [jobs, projectId, agentId]);

  const onStart = useCallback(async () => {
    if (starting) return;
    if (match && match.status === 'running') return;
    setStarting(true);
    setStartError(null);
    try {
      const res = await fetch('/api/skill/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillType: 'analyze', projectId, agentId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const { jobId } = (await res.json()) as { jobId: string };
      trackJob(jobId, { skillType: 'analyze', projectId, agentId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[DeepResearchCta] start failed:', msg);
      setStartError(msg);
    } finally {
      setStarting(false);
    }
  }, [starting, match, projectId, agentId, trackJob]);

  // ── Render states ────────────────────────────────────────────────────────

  // Completed: show a subtle success link to the spec page.
  if (match?.status === 'completed') {
    return (
      <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-100 bg-emerald-50">
        <CheckmarkCircle16Regular className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span className="text-[13px] text-emerald-900">Deep Research complete.</span>
        <button
          className="text-[13px] font-medium text-[hsl(var(--primary))] hover:underline inline-flex items-center gap-1"
          onClick={() => navigate('/spec')}
        >
          View spec
          <ArrowRight20Regular className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Failed: surface the error and allow retry.
  if (match?.status === 'failed') {
    return (
      <div className="mt-3 flex items-center gap-2">
        <CopilotBadge appearance="tint" color="danger" size="small">Analysis failed</CopilotBadge>
        <CopilotButton variant="subtle" size="sm" onClick={onStart} disabled={starting}>
          Retry
        </CopilotButton>
      </div>
    );
  }

  // Running: show progress badge.
  if (match?.status === 'running') {
    const running = match.steps.filter((s) => s.status === 'completed' || s.status === 'success').length;
    const total = match.steps.length || 1;
    const pct = Math.min(100, Math.round((running / total) * 100));
    return (
      <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[hsl(var(--primary)/0.2)] bg-[hsl(var(--primary)/0.04)]">
        <Sparkle20Regular className="w-4 h-4 text-[hsl(var(--primary))] animate-pulse flex-shrink-0" />
        <span className="text-[13px] text-gray-700">Deep Research running…</span>
        <span className="text-[12px] font-medium text-[hsl(var(--primary))] tabular-nums">{pct}%</span>
      </div>
    );
  }

  // Idle: show the start button.
  return (
    <div className="mt-3 space-y-1.5">
      <CopilotButton
        variant="primary"
        size="sm"
        onClick={onStart}
        disabled={starting}
        icon={<Sparkle20Regular />}
      >
        {starting ? 'Starting…' : label}
      </CopilotButton>
      {startError && (
        <p className="text-[12px] text-red-600">Couldn't start Deep Research: {startError}</p>
      )}
    </div>
  );
};
