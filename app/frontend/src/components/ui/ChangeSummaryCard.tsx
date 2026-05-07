import React from 'react';
import {
  Delete20Regular,
  Drafts20Regular,
  PuzzlePiece20Regular,
  Settings20Regular,
  ChevronRight20Regular,
} from '@fluentui/react-icons';
import { ChangeSummary, ChangeSummaryBullet } from '../../types';

const ICON_MAP = {
  drafts: Drafts20Regular,
  puzzle: PuzzlePiece20Regular,
  delete: Delete20Regular,
  settings: Settings20Regular,
} as const;

export interface ChangeSummaryCardProps {
  summary: ChangeSummary;
  onNavigate?: (target: string) => void;
}

export const ChangeSummaryCard: React.FC<ChangeSummaryCardProps> = ({ summary, onNavigate }) => {
  return (
    <div className="mt-3 space-y-0.5">
      {summary.bullets.map((bullet: ChangeSummaryBullet, i: number) => {
        const Icon = ICON_MAP[bullet.icon] ?? Drafts20Regular;
        const isClickable = !!bullet.navigate;
        return (
          <div
            key={i}
            className={
              isClickable
                ? 'flex items-center gap-2.5 py-1.5 cursor-pointer group transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
                : 'flex items-center gap-2.5 py-1.5'
            }
            onClick={isClickable ? () => onNavigate?.(bullet.navigate!) : undefined}
            role={isClickable ? 'button' : undefined}
            aria-label={isClickable ? bullet.text : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={
              isClickable
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onNavigate?.(bullet.navigate!);
                    }
                  }
                : undefined
            }
          >
            <Icon className={`shrink-0 transition-colors ${isClickable ? 'text-text-disabled group-hover:text-text-subtle' : 'text-text-disabled'}`} />
            <span className={`text-sm flex-1 transition-colors ${isClickable ? 'text-text-subtle group-hover:text-text-primary' : 'text-text-subtle'}`}>
              {bullet.text}
            </span>
            {isClickable && (
              <ChevronRight20Regular className="shrink-0 text-text-subtle opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        );
      })}
    </div>
  );
};
