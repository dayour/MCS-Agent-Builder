import React, { ReactNode, useRef, useState, useLayoutEffect, useCallback } from 'react';
import { AddRegular, Checkmark16Regular } from '@fluentui/react-icons';
import { Tooltip } from '@fluentui/react-components';

/**
 * EnhancedInputSuggestion — single suggestion chip / list item
 *
 * Used in HelperAgent chat input flows for inline suggestion and multi-select UIs.
 *
 * `fill` is a controlled prop from the parent (typically `true` in `single` and `multi` modes,
 * `false` in `text` mode). When `fill` is true the item renders full-width with text truncation
 * and tooltip support. When `fill` is false the item is auto-width so it wraps in a flex row.
 *
 * Selectable state shows a +/✓ indicator on the right side.
 */

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export interface EnhancedInputItem {
  id: string;
  label: string;
  description?: string;  // when present → full-width item
  icon?: string | ReactNode;  // image URL or React element (e.g. Fluent icon)
}

export interface EnhancedInputSuggestionProps {
  item: EnhancedInputItem;
  selectable?: boolean;  // show +/✓ indicator on right side
  selected?: boolean;
  disabled?: boolean;
  fill?: boolean;        // force full-width; otherwise hugs text
  onSelect: (item: EnhancedInputItem) => void;
}

export const EnhancedInputSuggestion = React.forwardRef<HTMLButtonElement, EnhancedInputSuggestionProps>(({
  item,
  selectable = false,
  selected = false,
  disabled = false,
  fill = false,
  onSelect,
}, ref) => {
  const labelRef = useRef<HTMLSpanElement>(null);
  const descriptionRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Checks both label and description spans — tooltip shows if either is truncated.
  const checkTruncation = useCallback(() => {
    if (!fill) return;
    const labelTruncated = !!labelRef.current && labelRef.current.scrollWidth > labelRef.current.offsetWidth;
    const descTruncated = !!descriptionRef.current && descriptionRef.current.scrollWidth > descriptionRef.current.offsetWidth;
    setIsTruncated(labelTruncated || descTruncated);
  }, [fill]);

  // Initial truncation check before first hover; re-runs when label/description text changes.
  useLayoutEffect(() => {
    checkTruncation();
  }, [checkTruncation, item.label, item.description]);

  const tooltipContent = [item.label, item.description].filter(Boolean).join(' — ');

  const button = (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      aria-pressed={selectable ? selected : undefined}
      onMouseEnter={() => { checkTruncation(); setIsHovering(true); }}
      onMouseLeave={() => setIsHovering(false)}
      onClick={() => !disabled && onSelect(item)}
      className={cn(
        // Shape & layout
        'rounded-xl px-3 py-1.5 flex flex-row items-center gap-1 text-left',
        'transition-colors',
        // Width — full when fill prop set, auto otherwise
        fill ? 'w-full' : 'w-auto self-start',
        // Disabled
        disabled && 'opacity-50 pointer-events-none',
        // Selected state
        selected
          ? cn(
              'bg-[var(--colorNeutralBackground3)] border border-[var(--colorNeutralStroke1)]',
              'hover:bg-[var(--colorNeutralBackground5)] hover:border-[var(--colorNeutralStroke1Hover)]',
              'active:bg-[var(--colorNeutralBackground3Pressed)] active:border-[var(--colorNeutralStroke1Pressed)]',
            )
          : cn(
              'bg-[var(--colorNeutralBackground1)] border border-[var(--colorNeutralStroke1)]',
              'hover:bg-[var(--colorNeutralBackground3)] hover:border-[var(--colorNeutralStroke1Hover)]',
              'active:bg-[var(--colorNeutralBackground1Pressed)] active:border-[var(--colorNeutralStroke1Pressed)]',
            ),
      )}
    >
      {/* Optional icon */}
      {item.icon && (
        typeof item.icon === 'string'
          ? <img src={item.icon} alt="" className="w-6 h-6 flex-shrink-0 rounded" />
          : <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center">{item.icon}</span>
      )}

      {/* Text column */}
      <span className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span
          ref={labelRef}
          className={cn('text-sm leading-snug text-[var(--colorNeutralForeground2)]', fill ? 'truncate' : 'whitespace-normal')}
        >
          {item.label}
        </span>
        {item.description && (
          <span
            ref={descriptionRef}
            className={cn('text-xs leading-snug text-[var(--colorNeutralForeground3)]', fill ? 'truncate' : 'whitespace-normal')}
          >
            {item.description}
          </span>
        )}
      </span>

      {/* Selection indicator */}
      {selectable && (
        <span className="flex-shrink-0 ml-1 flex items-center">
          {selected
            ? <Checkmark16Regular style={{ width: 16, height: 16, color: 'var(--colorNeutralForeground2)' }} />
            : <AddRegular style={{ width: 16, height: 16, color: 'var(--colorNeutralForeground3)' }} />
          }
        </span>
      )}
    </button>
  );

  if (!fill) return button;

  // Always keep Fluent's Tooltip mounted so its pointerenter listener is attached
  // before hover events fire. We control visibility explicitly via the `visible` prop
  // so the tooltip only shows when isTruncated && isHovering are both true.
  // `onMouseEnter` re-checks truncation on every hover so resize changes are picked up.
  return (
    <Tooltip
      content={tooltipContent}
      positioning="above"
      relationship="description"
      appearance="inverted"
      showDelay={250}
      hideDelay={200}
      visible={isTruncated && isHovering}
      onVisibleChange={(_, data) => { if (!data.visible) setIsHovering(false); }}
    >
      {button}
    </Tooltip>
  );
});

EnhancedInputSuggestion.displayName = 'EnhancedInputSuggestion';

export default EnhancedInputSuggestion;
