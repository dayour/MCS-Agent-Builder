import React from 'react';
import { ErrorAnalysis } from '../utils/errorAnalysis';
import { ActivityErrorRun } from '../types';
import { CopilotButton } from './ui';
import { ErrorCircle20Filled, Warning20Regular } from '@fluentui/react-icons';

interface ErrorAnalysisCardProps {
  run: ActivityErrorRun;
  analysis?: ErrorAnalysis | null;
  isLoading?: boolean;
  onActionClick?: (actionType: 'fix' | 'navigate' | 'open', label: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  failed: 'Failed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  'auth-required': 'Auth required',
};

export const ErrorAnalysisCard: React.FC<ErrorAnalysisCardProps> = ({
  run,
  analysis,
  isLoading = false,
  onActionClick,
}) => {
  const isError = run.status === 'failed' || run.status === 'rejected';

  if (!isLoading && !analysis) return null;

  return (
    <div className={`rounded-xl border overflow-hidden text-sm ${isError ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
      {/* Header */}
      <div className={`flex items-start gap-2.5 px-3.5 py-2.5 border-b ${isError ? 'border-red-200' : 'border-amber-200'}`}>
        {isError
          ? <ErrorCircle20Filled className="text-red-600 w-4 h-4 shrink-0 mt-px" />
          : <Warning20Regular className="text-amber-600 w-4 h-4 shrink-0 mt-px" />
        }
        <div className="min-w-0">
          <p className="font-semibold text-text-primary text-[13px] leading-tight truncate">{run.description}</p>
          <p className={`text-[11px] mt-0.5 ${isError ? 'text-red-600' : 'text-amber-600'}`}>
            {STATUS_LABEL[run.status]}{run.error ? ` · ${run.error}` : ''}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-3.5 py-3 space-y-2.5">
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-full" />
            <div className="h-3 bg-gray-200 rounded w-5/6" />
            <div className="h-3 bg-gray-200 rounded w-4/6" />
          </div>
        ) : analysis ? (
          <>
            <p className="text-[13px] text-text-primary leading-relaxed">{analysis.summary}</p>

            <div>
              <p className="text-[10px] font-semibold text-text-disabled uppercase tracking-wider mb-1">Root cause</p>
              <p className="text-[12px] text-text-secondary leading-relaxed">{analysis.rootCause}</p>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-text-disabled uppercase tracking-wider mb-1">How to fix</p>
              <p className="text-[12px] text-text-secondary leading-relaxed">{analysis.resolution}</p>
            </div>

            {analysis.actionButtons.length > 0 && onActionClick && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {analysis.actionButtons.map((btn, i) => (
                  <CopilotButton
                    key={i}
                    variant="secondary"
                    size="sm"
                    onClick={() => onActionClick?.(btn.actionType, btn.label)}
                    className="!text-[11px]"
                  >
                    {btn.label}
                  </CopilotButton>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};
