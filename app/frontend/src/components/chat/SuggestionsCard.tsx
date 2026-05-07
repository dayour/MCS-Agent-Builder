/**
 * SuggestionsCard — chip selector rendered when the chat brain emits an
 * action_requested event with action='suggest_options'. The user clicks
 * a chip; that chip's `value` is sent as a normal user message (no
 * pending-call token, no privileged side effect — just a quick reply).
 *
 * Lives next to ToolCallCard in the message stream. UnifiedChatPane
 * decides which to render based on the action name.
 */

import React, { useState } from 'react';

export interface SuggestionOption {
  label: string;
  value: string;
  hint?: string;
}

export interface SuggestionsCardProps {
  toolCallId: string;
  title: string;
  body?: string;
  options: SuggestionOption[];
  /** Disabled when the parent is mid-stream so duplicate clicks can't fire. */
  disabled?: boolean;
  /** Fired with the picked option's value (= what should be sent as the next user message). */
  onSelect: (value: string) => void;
}

export const SuggestionsCard: React.FC<SuggestionsCardProps> = ({
  title,
  body,
  options,
  disabled,
  onSelect,
}) => {
  const [picked, setPicked] = useState<string | null>(null);
  const isDisabled = disabled || !!picked;

  const handlePick = (value: string) => {
    if (isDisabled) return;
    setPicked(value);
    onSelect(value);
  };

  return (
    <div
      className="my-3 max-w-[640px] rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--card))] p-4"
      style={{ boxShadow: 'var(--shadow-card)' }}
      data-testid="suggestions-card"
    >
      <div className="text-[13px] font-semibold text-[hsl(var(--text-primary))]">{title}</div>
      {body && (
        <div className="mt-1 text-[12px] text-[hsl(var(--text-secondary))] leading-relaxed">{body}</div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((opt, i) => {
          const isPicked = picked === opt.value;
          const cls = isPicked
            ? 'bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]'
            : isDisabled
            ? 'bg-[hsl(var(--surface-hover))] text-[hsl(var(--text-disabled))] border-[hsl(var(--border-subtle))] cursor-not-allowed'
            : 'bg-[hsl(var(--card))] text-[hsl(var(--text-primary))] border-[hsl(var(--border-default))] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.04)] cursor-pointer';
          return (
            <button
              key={`${opt.value}-${i}`}
              type="button"
              onClick={() => handlePick(opt.value)}
              disabled={isDisabled}
              aria-pressed={isPicked}
              className={`inline-flex flex-col items-start gap-0.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${cls} ${opt.hint ? 'rounded-xl' : ''}`}
            >
              <span>{opt.label}</span>
              {opt.hint && (
                <span className={`text-[11px] font-normal ${isPicked ? 'text-white/85' : 'text-[hsl(var(--text-disabled))]'}`}>
                  {opt.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 text-[11px] text-[hsl(var(--text-disabled))]">
        Or type your own answer below.
      </div>
    </div>
  );
};

export default SuggestionsCard;
