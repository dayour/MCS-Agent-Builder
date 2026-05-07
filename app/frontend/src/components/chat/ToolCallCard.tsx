import React from 'react';
import { CopilotButton } from '../ui';

/**
 * ToolCallCard — inline card rendered when the server emits an
 * action_requested event. Currently supports the three Phase 1 confirmation
 * actions; Phase 3 will lift the existing DisambiguationCard, channel
 * picker, knowledge picker, and plan-approve UIs into this registry.
 */

export interface ToolCallCardProps {
  toolCallId: string;
  action: 'confirm_deep_research' | 'confirm_mcs_build' | 'confirm_cancel_job' | string;
  title: string;
  body: string;
  confirmLabel?: string;
  declineLabel?: string;
  expiresAt?: number;
  onRespond: (decision: 'confirm' | 'decline') => void;
  disabled?: boolean;
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({
  action,
  title,
  body,
  confirmLabel = 'Run it',
  declineLabel = 'Stay interactive',
  expiresAt,
  onRespond,
  disabled,
}) => {
  const expired = !!expiresAt && Date.now() > expiresAt;
  const accent = action === 'confirm_cancel_job' ? '#EF4444' : '#464FEB';

  return (
    <div
      className="my-3 max-w-[640px] rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--card))] p-4"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-1 h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: accent }}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[hsl(var(--text-primary))]">
            {title}
          </div>
          <div className="mt-1 text-sm text-[hsl(var(--text-secondary))] whitespace-pre-wrap">
            {body}
          </div>
          {expired && (
            <div className="mt-2 text-xs text-[hsl(var(--text-disabled))]">
              This request has expired. Ask again to retry.
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <CopilotButton
          variant="ghost"
          size="sm"
          onClick={() => onRespond('decline')}
          disabled={disabled || expired}
        >
          {declineLabel}
        </CopilotButton>
        <CopilotButton
          variant="primary"
          size="sm"
          onClick={() => onRespond('confirm')}
          disabled={disabled || expired}
        >
          {confirmLabel}
        </CopilotButton>
      </div>
    </div>
  );
};

export default ToolCallCard;
