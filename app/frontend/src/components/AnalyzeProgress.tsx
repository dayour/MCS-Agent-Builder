/**
 * AnalyzeProgress — Pipeline progress card for the CLI-backed analyze flow.
 *
 * Uses ChainOfThought + ChainOfThoughtItem (same pattern as PublishOrchestrator).
 * Designed to live inside a CopilotMessage in the HelperAgent chat sidebar.
 *
 * Shows 7 pipeline steps with animated status transitions:
 *   pending → running (LatencyLoader) → completed (green check) / failed (red X)
 */

import React from 'react';
import { ChainOfThought, ChainOfThoughtItem } from './ui/ChainOfThought';
import type { AnalyzeStep, PipelineStatus } from '../hooks/useAnalyzeJob';

interface AnalyzeProgressProps {
  steps: AnalyzeStep[];
  status: PipelineStatus;
  summary?: string | null;
  errors?: Array<{ step: string; error: string }>;
  onCancel?: () => void;
}

/** Map pipeline step status → ChainOfThoughtItem status */
function toCoTStatus(s: string): 'pending' | 'in-progress' | 'completed' | 'failed' {
  if (s === 'running') return 'in-progress';
  if (s === 'completed') return 'completed';
  if (s === 'failed') return 'failed';
  if (s === 'skipped') return 'pending';
  return 'pending';
}

/** Map pipeline status → ChainOfThought progress state */
function toProgressState(status: PipelineStatus): 'loading' | 'finished' | 'error' {
  if (status === 'running') return 'loading';
  if (status === 'failed') return 'error';
  return 'finished';
}

function getProgressMessage(status: PipelineStatus, steps: AnalyzeStep[]): string {
  if (status === 'idle') return 'Ready to analyze';
  if (status === 'completed') return 'Analysis complete';
  if (status === 'failed') return 'Analysis failed';

  const running = steps.find(s => s.status === 'running');
  if (running) return running.label + '...';
  return 'Analyzing...';
}

export const AnalyzeProgress: React.FC<AnalyzeProgressProps> = ({
  steps,
  status,
  summary,
  errors,
  onCancel,
}) => {
  const completedCount = steps.filter(s => s.status === 'completed').length;
  const progressMessage = getProgressMessage(status, steps);

  return (
    <div className="w-full">
      <ChainOfThought
        progressMessage={progressMessage}
        progressState={toProgressState(status)}
        defaultExpanded={true}
        expanded={status === 'running' ? true : undefined}
      >
        {steps.map((step) => (
          <ChainOfThoughtItem
            key={step.id}
            headerText={step.label}
            status={toCoTStatus(step.status)}
          >
            {step.detail && (
              <span className="text-[12px] text-[hsl(var(--text-subtle))]">
                {step.detail}
              </span>
            )}
          </ChainOfThoughtItem>
        ))}
      </ChainOfThought>

      {/* Summary line when complete */}
      {status === 'completed' && summary && (
        <p className="mt-2 text-[13px] text-[hsl(var(--text-secondary))] leading-5">
          {summary}
        </p>
      )}

      {/* Error details */}
      {status === 'failed' && errors && errors.length > 0 && (
        <div className="mt-2 text-[12px] text-red-600 space-y-1">
          {errors.map((e, i) => (
            <p key={i}><strong>{e.step}:</strong> {e.error}</p>
          ))}
        </div>
      )}

      {/* Progress counter + cancel */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[12px] text-[hsl(var(--text-subtle))]">
          {status === 'running'
            ? `${completedCount} of ${steps.length} steps`
            : status === 'completed'
              ? `${completedCount} steps completed`
              : ''}
        </span>
        {status === 'running' && onCancel && (
          <button
            onClick={onCancel}
            className="text-[12px] text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--text-primary))] transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

export default AnalyzeProgress;
