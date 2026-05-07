import React from 'react';
import {
  ShieldTask20Regular,
  DataTrending20Regular,
  BranchFork20Regular,
  Beaker20Regular,
  CheckmarkCircle16Filled,
  DismissCircle16Filled,
} from '@fluentui/react-icons';
import { CopilotBadge } from '../../components/ui/CopilotBadge';
import { BucketStats } from './types';
import { BUCKET_CONFIG, METHOD_LABELS } from './constants';

interface BucketCardProps {
  stats: BucketStats;
  isSelected: boolean;
  onClick: () => void;
}

const BUCKET_ICONS: Record<string, React.ReactNode> = {
  boundaries: <ShieldTask20Regular className="w-4 h-4" />,
  quality: <DataTrending20Regular className="w-4 h-4" />,
  'edge-cases': <BranchFork20Regular className="w-4 h-4" />,
};

function getBarColor(rate: number, threshold: number): string {
  if (rate >= threshold) return 'bg-[hsl(var(--status-success))]';
  if (rate >= 50) return 'bg-[hsl(var(--status-warning))]';
  return 'bg-[hsl(var(--status-error))]';
}

export const BucketCard: React.FC<BucketCardProps> = ({ stats, isSelected, onClick }) => {
  const config = BUCKET_CONFIG[stats.name];
  const icon = BUCKET_ICONS[stats.name] ?? <Beaker20Regular className="w-4 h-4" />;
  const label = config?.label ?? stats.name;
  const hasResults = stats.testedCount > 0;

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left rounded-xl border px-4 py-3 transition-all cursor-pointer
        hover:shadow-[var(--shadow-sm)]
        ${isSelected
          ? 'border-[hsl(var(--primary))] shadow-[0_0_0_1px_hsl(var(--primary))] bg-[hsl(var(--brand-background))]/30'
          : 'border-gray-200 hover:border-gray-300'}
      `}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500">{icon}</span>
          <span className="text-[13px] font-semibold text-gray-900">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {hasResults && (
            stats.meetsThreshold ? (
              <CheckmarkCircle16Filled className="w-3.5 h-3.5 text-[hsl(var(--status-success))]" />
            ) : (
              <DismissCircle16Filled className="w-3.5 h-3.5 text-[hsl(var(--status-error))]" />
            )
          )}
          <span className="text-[10px] text-gray-400 tabular-nums">&ge;{stats.passThreshold}%</span>
        </div>
      </div>

      {/* Progress bar + stats */}
      {hasResults ? (
        <>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getBarColor(stats.passRate, stats.passThreshold)}`}
                style={{ width: `${Math.max(stats.passRate, 2)}%` }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-gray-800 w-9 text-right">{stats.passRate}%</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <span>{stats.passCount}/{stats.testedCount} pass</span>
            {stats.failCount > 0 && (
              <span className="text-[hsl(var(--status-error))]">{stats.failCount} fail</span>
            )}
          </div>
        </>
      ) : (
        <div className="text-[11px] text-gray-400 mt-1">
          {stats.totalTests} tests &middot; not run
        </div>
      )}

      {/* Method pills */}
      <div className="flex flex-wrap gap-1 mt-2">
        {stats.methods.map((m, i) => (
          <span
            key={i}
            className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 leading-tight"
          >
            {METHOD_LABELS[m.type] ?? m.type}
          </span>
        ))}
      </div>
    </button>
  );
};
