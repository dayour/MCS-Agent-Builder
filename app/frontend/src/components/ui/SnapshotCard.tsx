import React from 'react';
import { AgentSnapshot, SnapshotLifecycleStage } from '../../types';
import { CopilotButton } from './CopilotButton';
import { CopilotBadge, BadgeColor } from './CopilotBadge';
import { CopilotFilterPill } from './CopilotFilterPill';
import { Delete20Regular } from '@fluentui/react-icons';

export interface SnapshotCardProps {
  snapshot: AgentSnapshot;
  onActivate: (snapshot: AgentSnapshot) => void;
  onDelete?: (snapshotId: string) => void;
  isActivating?: boolean;
}

const STAGE_BADGE_COLOR: Record<SnapshotLifecycleStage, BadgeColor> = {
  'day-zero':    'subtle',
  'in-progress': 'warning',
  'published':   'success',
  'bad-agent':   'danger',
  'custom':      'brand',
};

const STAGE_LABEL: Record<SnapshotLifecycleStage, string> = {
  'day-zero':    'Day Zero',
  'in-progress': 'In Progress',
  'published':   'Published',
  'bad-agent':   'Bad Agent',
  'custom':      'Custom',
};

export function SnapshotCard({ snapshot, onActivate, onDelete, isActivating }: SnapshotCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground1)] p-4 hover:border-[var(--colorNeutralStroke1)] transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-body-1 font-semibold text-[var(--colorNeutralForeground1)] truncate">{snapshot.name}</span>
          <CopilotBadge
            color={STAGE_BADGE_COLOR[snapshot.lifecycleStage]}
            appearance="tint"
            size="small"
            shape="rounded"
          >
            {STAGE_LABEL[snapshot.lifecycleStage]}
          </CopilotBadge>
          {snapshot.isBuiltIn && (
            <CopilotBadge appearance="ghost" color="subtle" size="small" shape="rounded">
              Built-in
            </CopilotBadge>
          )}
        </div>
        {!snapshot.isBuiltIn && onDelete && (
          <CopilotButton
            variant="transparent"
            size="sm"
            icon={<Delete20Regular />}
            onClick={() => onDelete(snapshot.id)}
            aria-label={`Delete snapshot "${snapshot.name}"`}
            className="shrink-0 text-[var(--colorNeutralForeground3)] hover:text-[var(--colorStatusDangerForeground1)]"
          />
        )}
      </div>

      {/* Description */}
      {snapshot.description && (
        <p className="text-body-2 text-[var(--colorNeutralForeground2)] line-clamp-2">
          {snapshot.description}
        </p>
      )}

      {/* Tags */}
      {snapshot.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {snapshot.tags.map(tag => (
            <CopilotFilterPill
              key={tag}
              active={false}
              label={tag}
              onClick={() => {}}
              size="xs"
            />
          ))}
        </div>
      )}

      {/* Footer: metadata + action */}
      <div className="flex items-center justify-between gap-2 mt-1">
        {!snapshot.isBuiltIn && snapshot.createdBy && (
          <span className="text-caption text-[var(--colorNeutralForeground3)] truncate">
            by {snapshot.createdBy}
          </span>
        )}
        <div className="ml-auto">
          <CopilotButton
            variant="primary"
            size="sm"
            onClick={() => onActivate(snapshot)}
            disabled={isActivating}
          >
            {isActivating ? 'Loading…' : 'Load Snapshot'}
          </CopilotButton>
        </div>
      </div>
    </div>
  );
}
