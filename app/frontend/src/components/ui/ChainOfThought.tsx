import React, { useState } from 'react';
import {
  CheckmarkCircle16Filled,
  ChevronDown20Regular,
  ChevronRight20Regular,
  ChevronUp20Regular,
  Circle16Regular,
  ErrorCircle16Filled,
} from '@fluentui/react-icons';
import { LatencyLoader } from './StatusIcon';

// ─── ChainOfThoughtItem ────────────────────────────────────────────────────────

export interface ChainOfThoughtItemProps {
  headerText: React.ReactNode;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  children?: React.ReactNode;
  active?: boolean;
  defaultExpanded?: boolean;
}

/**
 * Individual reasoning step inside a ChainOfThought.
 *
 * Four-state rendering driven by `status`:
 * - `in-progress` (or `active={true}`) — LatencyLoader on the left, auto-expands
 * - `completed`                        — green checkmark on the left, collapsible
 * - `failed`                           — red error circle on the left, collapsible
 * - `pending`                          — empty circle on the left, non-interactive
 *
 * `active` overrides `status` to `in-progress` for backward compatibility.
 * `headerText` accepts `React.ReactNode` so inline tags/pills can be embedded.
 */
export const ChainOfThoughtItem: React.FC<ChainOfThoughtItemProps> = ({
  headerText,
  status,
  active = false,
  children,
  defaultExpanded,
}) => {
  const hasContent = !!children;
  const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? false);
  const isActive = active || status === 'in-progress';
  // Active items always show content
  const actualExpanded = isActive || isExpanded;

  return (
    <div className="py-2">
      <button
        className="w-full flex items-center justify-between gap-2 text-left"
        onClick={() => !isActive && hasContent && setIsExpanded(v => !v)}
        disabled={isActive || !hasContent}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isActive && (
            <span className="shrink-0">
              <LatencyLoader size={14} />
            </span>
          )}
          {!isActive && status === 'completed' && (
            <span className="shrink-0 text-green-600">
              <CheckmarkCircle16Filled />
            </span>
          )}
          {!isActive && status === 'failed' && (
            <span className="shrink-0 text-red-500">
              <ErrorCircle16Filled />
            </span>
          )}
          {!isActive && status === 'pending' && (
            <span className="shrink-0 text-gray-300">
              <Circle16Regular />
            </span>
          )}
          <span className={`text-[14px] font-semibold leading-snug ${isActive ? 'text-[hsl(var(--text-primary))]' : 'text-[hsl(var(--text-secondary))]'}`}>
            {headerText}
          </span>
        </div>
        {hasContent && !isActive && (
          actualExpanded
            ? <ChevronDown20Regular className="w-4 h-4 text-text-subtle shrink-0" />
            : <ChevronRight20Regular className="w-4 h-4 text-text-subtle shrink-0" />
        )}
        {!hasContent && !isActive && (
          <ChevronRight20Regular className="w-4 h-4 text-text-subtle shrink-0 opacity-40" />
        )}
      </button>
      {actualExpanded && hasContent && (
        <div className="mt-1.5 text-[13px] text-text-subtle leading-5">
          {children}
        </div>
      )}
    </div>
  );
};

// ─── ChainOfThought ────────────────────────────────────────────────────────────

export interface ChainOfThoughtProps {
  progressMessage?: string;
  progressState?: 'loading' | 'finished' | 'error';
  expanded?: boolean;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Collapsible reasoning panel.
 *
 * Collapsed (loading or finished) → borderless row: [dot?] text [chevron]
 *   - loading:  animated dot on the LEFT of the text
 *   - finished: no dot, muted text color
 * Expanded (any state)            → bordered box with items inside.
 */
export const ChainOfThought: React.FC<ChainOfThoughtProps> = ({
  progressMessage = 'Thinking...',
  progressState = 'loading',
  expanded,
  defaultExpanded = false,
  children,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(expanded ?? defaultExpanded);
  const actualExpanded = expanded !== undefined ? expanded : isExpanded;
  const toggle = () => { if (expanded === undefined) setIsExpanded(v => !v); };

  // ── Collapsed: no border box ──
  if (!actualExpanded) {
    return (
      <button
        onClick={toggle}
        className={`w-full flex items-center justify-between gap-1.5 text-[14px] font-semibold transition-colors ${
          progressState === 'error' ? 'text-red-600' :
          progressState === 'loading' ? 'text-[hsl(var(--text-primary))]' : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-secondary))]'
        } ${className}`}
      >
        <span className="flex items-center gap-1.5">
          {progressState === 'loading' && <LatencyLoader size={14} />}
          {progressState === 'error' && <span className="shrink-0 text-red-500"><ErrorCircle16Filled /></span>}
          <span>{progressMessage}</span>
        </span>
        <ChevronDown20Regular className="w-4 h-4 text-[hsl(var(--text-secondary))] shrink-0" />
      </button>
    );
  }

  // ── Expanded: title outside, bordered box for items ──
  return (
    <div className={className}>
      {/* Title row — outside the box */}
      <button
        onClick={toggle}
        className={`w-full flex items-center justify-between gap-1.5 text-[14px] font-semibold hover:text-[hsl(var(--text-secondary))] transition-colors mb-2 ${
          progressState === 'error' ? 'text-red-600' : 'text-[hsl(var(--text-primary))]'
        }`}
      >
        <span className="flex items-center gap-1.5">
          {progressState === 'loading' && <LatencyLoader size={14} />}
          {progressState === 'error' && <span className="shrink-0 text-red-500"><ErrorCircle16Filled /></span>}
          <span>{progressMessage}</span>
        </span>
        <ChevronUp20Regular className="w-4 h-4 text-[hsl(var(--text-secondary))] shrink-0" />
      </button>

      {/* Items box */}
      <div className="rounded-xl bg-[hsl(var(--surface-tertiary))] px-4 py-1">
        {children}
      </div>
    </div>
  );
};

export default ChainOfThought;
