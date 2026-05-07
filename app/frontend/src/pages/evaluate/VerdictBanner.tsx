import React from 'react';
import {
  CheckmarkCircle20Filled,
  Warning20Filled,
  ArrowSync20Regular,
  ShieldTask20Filled,
} from '@fluentui/react-icons';
import { CopilotBadge } from '../../components/ui/CopilotBadge';
import { EvalVerdict } from './types';
import { VERDICT_CONFIG, VerdictKey } from './constants';

interface VerdictBannerProps {
  verdict: EvalVerdict;
  lastVerdictAt: string | null;
}

const VERDICT_ICONS: Record<string, React.ReactNode> = {
  checkmark: <CheckmarkCircle20Filled className="w-5 h-5" />,
  warning: <Warning20Filled className="w-5 h-5" />,
  sync: <ArrowSync20Regular className="w-5 h-5" />,
  shield: <ShieldTask20Filled className="w-5 h-5" />,
};

export const VerdictBanner: React.FC<VerdictBannerProps> = ({ verdict, lastVerdictAt }) => {
  const config = VERDICT_CONFIG[verdict.verdict as VerdictKey] ?? VERDICT_CONFIG.ITERATE;
  const icon = VERDICT_ICONS[config.icon];

  const timeAgo = lastVerdictAt ? formatTimeAgo(lastVerdictAt) : null;

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-5 mb-6`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className={config.text}>{icon}</span>
            <CopilotBadge appearance="filled" color={config.color} size="medium">
              {config.label}
            </CopilotBadge>
          </div>
          <p className={`text-sm ${config.text} opacity-80`}>{verdict.reason}</p>
        </div>

        <div className="flex-shrink-0 text-right">
          <div className={`text-2xl font-semibold tabular-nums ${config.text}`}>
            {verdict.overallRate}%
          </div>
          <div className="text-xs text-gray-500 mt-0.5">overall pass rate</div>
          {timeAgo && (
            <div className="text-xs text-gray-400 mt-1">Last run {timeAgo}</div>
          )}
        </div>
      </div>

      {verdict.perSet.length > 0 && (
        <div className="flex gap-4 mt-4 pt-3 border-t border-black/5">
          {verdict.perSet.map(s => (
            <div key={s.name} className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 capitalize">{s.name}:</span>
              <span className={`font-medium tabular-nums ${config.text}`}>{s.rate}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
