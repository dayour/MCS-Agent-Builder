import React, { useState, useRef } from 'react';
import {
  CheckmarkCircle16Filled,
  ArrowUpload16Regular,
  ArrowSync16Regular,
  Person16Regular,
  MoreHorizontal20Regular,
  ArrowCounterclockwise16Regular,
} from '@fluentui/react-icons';
import { CopilotBadge } from './CopilotBadge';
import { CopilotButton } from './CopilotButton';
import { CopilotMenu } from './CopilotMenu';

// ─── VersionHistoryItem ────────────────────────────────────────────────────────

export type VersionHistorySource = 'manual' | 'auto' | 'publish';

export interface VersionHistoryItemProps {
  /** Primary label, e.g. a formatted date/time string */
  versionLabel: string;
  /**
   * Whether this is the current working version (always the top/newest entry).
   * Renders a "Current" badge in brand tint.
   */
  isCurrent?: boolean;
  /**
   * Whether this is the current published/live version.
   * Renders a filled blue dot + "Live" badge.
   * In the panel, set this on the most recent `source === 'publish'` entry,
   * not necessarily `i === 0`.
   */
  isLive?: boolean;
  /**
   * Whether this entry is a draft that hasn't been published yet
   * (i.e. it was saved after the last publish).
   * Renders a hollow blue outlined circle and a dashed connector.
   */
  isDraft?: boolean;
  /**
   * Whether this is an older publish that is no longer the live version.
   * Renders a gray filled checkmark.
   */
  isPreviousPublish?: boolean;
  /** Source of the version — controls metadata row rendered */
  source?: VersionHistorySource;
  /** Short description of what changed */
  description?: string;
  /** User initials shown as avatar for manual/publish versions */
  userInitials?: string;
  /** Full display name shown next to avatar for manual/publish versions */
  userName?: string;
  /** Number of scored changes that triggered an auto-save version */
  changeCount?: number;
  /** Suppress the connector line after this item (use for the last item) */
  isLast?: boolean;
  /** When provided, a Restore option appears in the overflow menu */
  onRestore?: () => void;
  className?: string;
}

/**
 * Individual entry in a VersionHistory list.
 *
 * Four visual states for the left-column indicator:
 * - `isDraft`           → hollow blue ring, dashed connector
 * - `isLive`            → filled blue checkmark (most recent publish)
 * - `isPreviousPublish` → gray filled checkmark (older publishes)
 * - default             → solid small blue dot (regular saves older than last publish)
 */
export const VersionHistoryItem: React.FC<VersionHistoryItemProps> = ({
  versionLabel,
  isCurrent = false,
  isLive = false,
  isDraft = false,
  isPreviousPublish = false,
  source = 'manual',
  description,
  userInitials,
  userName,
  changeCount,
  isLast = false,
  onRestore,
  className = '',
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const overflowRef = useRef<HTMLButtonElement>(null);

  const openMenu = () => {
    if (!overflowRef.current) return;
    const rect = overflowRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setMenuOpen(true);
  };

  return (
    <div className={`flex gap-3 ${className}`}>
      {/* ── Left column: status indicator + vertical connector ── */}
      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 20 }}>
        {/* Circle wrapper — h-6 matches the title row height so the circle centers with the title text */}
        {/* overflow:visible lets the checkmark SVG render at 20px without clipping */}
        <div className="h-6 w-4 flex items-center justify-center flex-shrink-0" style={{ overflow: 'visible' }}>
          {isDraft ? (
            /* 1. Hollow blue ring — unpublished drafts (since last publish) */
            <div
              className="w-4 h-4 rounded-full bg-white"
              style={{ border: '2px solid hsl(var(--primary))' }}
            />
          ) : isLive ? (
            /* 2. Filled blue circle + white checkmark — most recent published (live) version */
            <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(var(--primary))' }}>
              <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          ) : isPreviousPublish ? (
            /* 3. Gray filled circle + white checkmark — older published versions */
            <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(var(--text-disabled))' }}>
              <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          ) : (
            /* 4. Solid blue dot — regular saves older than last publish */
            <div
              className="w-4 h-4 rounded-full"
              style={{ background: 'hsl(var(--primary))' }}
            />
          )}
        </div>
        {!isLast && (
          isDraft ? (
            /* Dashed connector for draft entries — wider gaps via gradient */
            <div
              className="flex-1 min-h-[8px]"
              style={{
                width: 1,
                background: 'repeating-linear-gradient(to bottom, hsl(var(--stroke-default)) 0px, hsl(var(--stroke-default)) 6px, transparent 6px, transparent 12px)',
              }}
            />
          ) : (
            /* Solid connector for published/older entries */
            <div className="w-px flex-1 bg-gray-200 min-h-[8px]" />
          )
        )}
      </div>

      {/* ── Right column: content ── */}
      <div className={`flex-1 min-w-0 ${isLast ? 'pb-1' : 'pb-6'}`}>
        {/* Title row: action text + badges on left, overflow menu on right */}
        <div className="flex items-center justify-between gap-2" style={{ minHeight: 20 }}>
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {/* Avatar / icon inline with title */}
            {source === 'manual' && (
              userInitials ? (
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-semibold" style={{ fontSize: 8 }}>{userInitials}</span>
                </div>
              ) : (
                <Person16Regular className="text-gray-400 flex-shrink-0" />
              )
            )}
            {source === 'publish' && (
              userInitials ? (
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-semibold" style={{ fontSize: 8 }}>{userInitials}</span>
                </div>
              ) : (
                <ArrowUpload16Regular className="text-[hsl(var(--primary))] flex-shrink-0" />
              )
            )}
            {source === 'auto' && (
              <ArrowSync16Regular className="text-gray-400 flex-shrink-0" />
            )}
            {/* Action label */}
            <span className="text-body-2-strong text-gray-900">
              {source === 'manual' && <>Saved by {userName || 'you'}</>}
              {source === 'publish' && <>Published{userName ? ` by ${userName}` : ''}</>}
              {source === 'auto' && <>Auto-generated</>}
            </span>
            {isCurrent && (
              <CopilotBadge appearance="tint" color="brand" size="small">
                Current
              </CopilotBadge>
            )}
            {isLive && (
              <CopilotBadge appearance="outline" color="success" size="small">
                Live
              </CopilotBadge>
            )}
          </div>
          {onRestore && (
            <button
              ref={overflowRef}
              onClick={openMenu}
              aria-label="Version options"
              className="flex-shrink-0 flex items-center justify-center p-0.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              style={{ lineHeight: 0 }}
            >
              <MoreHorizontal20Regular style={{ width: 20, height: 20, display: 'block' }} />
            </button>
          )}
        </div>

        {/* Date + extra metadata */}
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-caption-1 text-gray-400">{versionLabel}</span>
          {source === 'auto' && changeCount !== undefined && (
            <span className="text-caption-1 text-gray-400">
              · {changeCount} {changeCount === 1 ? 'change' : 'changes'}
            </span>
          )}
        </div>

        {/* Description */}
        {description ? (
          <p className="text-caption-1 text-gray-500 mt-0.5 leading-snug">{description}</p>
        ) : (
          <p className="text-caption-1 text-gray-400 italic mt-0.5 leading-snug">
            Generating description…
          </p>
        )}
      </div>

      {/* Overflow menu */}
      {menuOpen && onRestore && (
        <CopilotMenu
          position={{ top: menuPos.top, right: menuPos.right }}
          onClose={() => setMenuOpen(false)}
          items={[
            {
              label: 'Restore',
              icon: <ArrowCounterclockwise16Regular />,
              onClick: () => { setMenuOpen(false); onRestore(); },
            },
          ]}
        />
      )}
    </div>
  );
};

// ─── VersionHistory ─────────────────────────────────────────────────────────

export interface VersionHistoryProps {
  /** `VersionHistoryItem` children */
  children?: React.ReactNode;
  /** Shown when there are no children */
  emptyMessage?: string;
  className?: string;
}

/**
 * Vertical timeline for displaying workflow or agent version history.
 *
 * Renders a list of `VersionHistoryItem` entries connected by lines.
 * The line is always centered under the dot via the flex-col approach
 * (no absolute positioning).
 *
 * Pass `isLive` on the most recent `source === 'publish'` entry (not necessarily
 * the first item). Pass `isDraft` on all entries newer than that published entry.
 *
 * ```tsx
 * const liveIdx = entries.findIndex(v => v.source === 'publish');
 * const effectiveLiveIdx = liveIdx === -1 ? 0 : liveIdx;
 *
 * <VersionHistory>
 *   {entries.map((v, i) => (
 *     <VersionHistoryItem
 *       key={v.id}
 *       versionLabel={fmt(v.createdAt)}
 *       isLive={i === effectiveLiveIdx}
 *       isDraft={liveIdx !== -1 && i < liveIdx}
 *       source={v.source}
 *       description={v.description}
 *       userInitials={v.userInitials}
 *       userName={v.userName}
 *       changeCount={v.changeCount}
 *       isLast={i === entries.length - 1}
 *       onRestore={i === effectiveLiveIdx ? undefined : () => restore(v.id)}
 *     />
 *   ))}
 * </VersionHistory>
 * ```
 */
export const VersionHistory: React.FC<VersionHistoryProps> = ({
  children,
  emptyMessage = 'No saved versions yet.',
  className = '',
}) => {
  const hasChildren = React.Children.count(children) > 0;

  return (
    <div className={className}>
      {hasChildren ? (
        children
      ) : (
        <p className="text-caption-1 text-gray-400 py-2">{emptyMessage}</p>
      )}
    </div>
  );
};

export default VersionHistory;
