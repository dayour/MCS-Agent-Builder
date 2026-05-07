/**
 * JobProgressCard — inline chat card that renders live progress for a
 * server-side pipeline job (deep research, build, etc.).
 *
 * Reads from PipelineActivityContext rather than holding its own SSE
 * connection — the context already subscribes to /api/skill/status/:jobId
 * and keeps the job state up to date for every consumer. Wiring is in
 * HomePage (and any other chat surface) which calls trackJob(jobId, meta)
 * when UnifiedChatPane fires onJobStarted.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkle20Regular,
  ArrowRight20Regular,
  CheckmarkCircle16Regular,
  ErrorCircle16Regular,
} from '@fluentui/react-icons';
import { usePipelineActivity, type PipelineStep } from '../../context/PipelineActivityContext';

export interface JobProgressCardProps {
  jobId: string;
  kind?: string;
  scope?: string;
  projectId?: string;
  /**
   * Fired when the user clicks "Review with me" on a completed job.
   * Caller (typically UnifiedChatPane) fires a chat turn that asks the
   * brain to walk the user through the freshly-generated spec.
   */
  onReview?: () => void;
}

// 'analyze' is the canonical kind chat now emits; 'research' is the legacy
// label kept for any in-flight jobs from before the CLI swap. Both display
// as "Deep Research" to the user — the difference is internal.
const TITLE_BY_KIND: Record<string, string> = {
  analyze: 'Deep Research',
  research: 'Deep Research',
  preview: 'Deep Research (preview)',
  build: 'Build',
  eval: 'Evaluation',
  fix: 'Fix',
};

function isStepDone(s: PipelineStep): boolean {
  return s.status === 'completed' || s.status === 'success' || s.status === 'skipped';
}

function isStepActive(s: PipelineStep): boolean {
  return s.status === 'running';
}

function isStepFailed(s: PipelineStep): boolean {
  return s.status === 'failed';
}

export const JobProgressCard: React.FC<JobProgressCardProps> = ({ jobId, kind = 'research', scope, projectId, onReview }) => {
  const navigate = useNavigate();
  const { jobs } = usePipelineActivity();
  const [reviewClicked, setReviewClicked] = React.useState(false);
  const job = jobs.find((j) => j.id === jobId);
  const title = TITLE_BY_KIND[kind] || 'Job';

  // Race: server emits job_started, parent calls trackJob, this re-renders.
  // Until trackJob lands the job in context we show a spinner placeholder.
  if (!job) {
    return (
      <div className="my-3 max-w-[640px] rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--card))] p-4 inline-flex items-center gap-2">
        <Sparkle20Regular className="w-4 h-4 text-[hsl(var(--primary))] animate-pulse flex-shrink-0" />
        <span className="text-[13px] text-[hsl(var(--text-secondary))]">Starting {title.toLowerCase()}…</span>
      </div>
    );
  }

  const totalSteps = Math.max(job.steps.length, 1);
  const doneSteps = job.steps.filter(isStepDone).length;
  const activeStep = job.steps.find(isStepActive);
  const pct = Math.min(100, Math.round((doneSteps / totalSteps) * 100));

  // ── Completed ──
  if (job.status === 'completed') {
    return (
      <div className="my-3 max-w-[640px] rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <div className="flex items-center gap-2">
          <CheckmarkCircle16Regular className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="text-[13px] font-medium text-emerald-900">{title} complete.</span>
          {projectId && (
            <button
              className="ml-auto text-[13px] font-medium text-[hsl(var(--primary))] hover:underline inline-flex items-center gap-1"
              onClick={() => {
                // Use the router to set the query param — direct hash
                // manipulation in HashRouter is brittle and doesn't always
                // wake up react-router's listeners.
                navigate(`/?project=${encodeURIComponent(projectId)}`);
                // Best-effort scroll the spec doc into view on the canvas.
                requestAnimationFrame(() => {
                  document.querySelector('[data-testid="spec-canvas-document"]')
                    ?.scrollIntoView({ behavior: 'smooth' });
                });
              }}
            >
              Jump to spec
              <ArrowRight20Regular className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {job.summary && (
          <div className="mt-1.5 text-[12px] text-emerald-900/80">{job.summary}</div>
        )}
        {onReview && !reviewClicked && (
          <button
            onClick={() => { setReviewClicked(true); onReview(); }}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[13px] font-medium hover:bg-emerald-700 transition-colors"
          >
            <Sparkle20Regular className="w-3.5 h-3.5" />
            Review the spec with me
          </button>
        )}
      </div>
    );
  }

  // ── Failed ──
  if (job.status === 'failed') {
    const firstError = job.errors[0]?.error || 'unknown error';
    return (
      <div className="my-3 max-w-[640px] rounded-2xl border border-red-100 bg-red-50 p-4">
        <div className="flex items-start gap-2">
          <ErrorCircle16Regular className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-red-900">{title} failed.</div>
            <div className="mt-1 text-[12px] text-red-900/80 break-words">{firstError}</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Running ──
  return (
    <div
      className="my-3 max-w-[640px] rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--card))] p-4"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center gap-2">
        <Sparkle20Regular className="w-4 h-4 text-[hsl(var(--primary))] animate-pulse flex-shrink-0" />
        <span className="text-[13px] font-medium text-[hsl(var(--text-primary))]">
          {title} running{scope === 'preview' ? ' (preview)' : ''}…
        </span>
        <span className="ml-auto text-[12px] font-medium text-[hsl(var(--primary))] tabular-nums">{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="mt-2.5 h-1.5 w-full rounded-full bg-[hsl(var(--primary)/0.08)] overflow-hidden">
        <div
          className="h-full bg-[hsl(var(--primary))] transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Active step */}
      {activeStep && (
        <div className="mt-2 text-[12px] text-[hsl(var(--text-secondary))]">
          <span className="font-medium">{activeStep.label}</span>
          {activeStep.detail && <span className="text-[hsl(var(--text-disabled))]"> — {activeStep.detail}</span>}
        </div>
      )}

      {/* Step list — collapsed view: dot per step */}
      {job.steps.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Pipeline steps">
          {job.steps.map((s) => {
            const cls = isStepDone(s)
              ? 'bg-[hsl(var(--primary))]'
              : isStepActive(s)
              ? 'bg-[hsl(var(--primary))] animate-pulse ring-2 ring-[hsl(var(--primary)/0.25)]'
              : isStepFailed(s)
              ? 'bg-red-500'
              : 'bg-[hsl(var(--border-strong))]';
            return (
              <span
                key={s.id}
                className={`inline-block w-2 h-2 rounded-full ${cls}`}
                title={`${s.label} — ${s.status}`}
              />
            );
          })}
          <span className="ml-auto text-[11px] text-[hsl(var(--text-disabled))] tabular-nums">
            {doneSteps}/{totalSteps}
          </span>
        </div>
      )}

      {/* Error chips while still running (some steps might have failed but pipeline continues) */}
      {job.errors.length > 0 && (
        <div className="mt-2 text-[11px] text-red-700/90">
          {job.errors.length} step error{job.errors.length === 1 ? '' : 's'} so far.
        </div>
      )}
    </div>
  );
};

export default JobProgressCard;
