import React from 'react';

/**
 * ComponentPill — Inline pill for rendering component references in instructions.
 *
 * Renders a rounded capsule with an optional icon and label, designed to sit
 * inline with text inside contentEditable regions. Uses `contentEditable={false}`
 * to behave as an atomic, non-editable token.
 *
 * The `disabled` prop dims the pill to indicate the component is toggled off.
 */

export interface ComponentPillProps {
  /** Display label for the pill */
  label: string;
  /** Raw edit-text stored in data-edit-text for DOM round-tripping */
  editText: string;
  /** Optional leading icon element */
  icon?: React.ReactNode;
  /** When true, renders pill in a dimmed/disabled visual state */
  disabled?: boolean;
  /** When true, renders pill with brand stroke and light brand background (menu open state) */
  selected?: boolean;
  /** When true, renders pill with red stroke and red background — connector not connected */
  error?: boolean;
  /** When true, renders pill with amber stroke and amber background — connector needs configuration */
  warning?: boolean;
  /** When true, renders pill with border stroke and review-deleted background — deleted/removed state */
  deleted?: boolean;
  /** Click handler — receives the mouse event for positioning menus */
  onClick?: (e: React.MouseEvent<HTMLSpanElement>) => void;
  /** MouseDown handler — fires before click; use to open menus before blur/re-render races */
  onMouseDown?: (e: React.MouseEvent<HTMLSpanElement>) => void;
  /** Additional CSS class names */
  className?: string;
}

/** Shared inline style for pill <span> elements. */
const pillSpanBaseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  border: '1px solid hsl(var(--stroke-default))',
  borderRadius: '9999px',
  color: 'hsl(var(--text-primary))',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  fontWeight: 400,
  paddingLeft: '7px',
  paddingRight: '7px',
  paddingTop: '0px',
  paddingBottom: '0px',
  verticalAlign: 'middle',
  position: 'relative',
  top: '-0.1em',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const disabledOverrides: React.CSSProperties = {
  cursor: 'default',
  borderColor: 'hsl(var(--stroke-default))',
  color: 'hsl(var(--text-secondary))', // gray-500 — legible disabled text
};

const selectedOverrides: React.CSSProperties = {
  borderColor: 'hsl(237 81% 60%)', // --brand
};

const errorOverrides: React.CSSProperties = {
  borderColor: '#FCA5A5', // red-300
  color: '#DC2626',       // red-600
};

const warningOverrides: React.CSSProperties = {
  borderColor: '#FCD34D', // amber-300
  color: '#B45309',       // amber-700
};

const deletedOverrides: React.CSSProperties = {
  borderColor: 'hsl(var(--border))',
  color: 'hsl(var(--foreground))',
  cursor: 'default',
  pointerEvents: 'none',
};

export const ComponentPill: React.FC<ComponentPillProps> = ({
  label,
  editText,
  icon,
  disabled = false,
  selected = false,
  error = false,
  warning = false,
  deleted = false,
  onClick,
  onMouseDown,
  className,
}) => {
  const style: React.CSSProperties = deleted
    ? { ...pillSpanBaseStyle, ...deletedOverrides }
    : error
    ? { ...pillSpanBaseStyle, ...errorOverrides }
    : warning
    ? { ...pillSpanBaseStyle, ...warningOverrides }
    : disabled
    ? { ...pillSpanBaseStyle, ...disabledOverrides }
    : selected
    ? { ...pillSpanBaseStyle, ...selectedOverrides }
    : pillSpanBaseStyle;

  const bgClass = deleted
    ? 'bg-[hsl(var(--review-deleted-bg))]'
    : error
    ? 'bg-red-50'
    : warning
    ? 'bg-amber-50'
    : disabled
    ? 'bg-gray-100'
    : selected
    ? 'bg-[hsl(237_81%_96%)] transition-colors'
    : 'bg-gray-50 transition-colors hover:bg-gray-100';

  return (
    <span
      data-edit-text={editText}
      contentEditable={false}
      role={!disabled && onClick ? 'button' : undefined}
      tabIndex={!disabled && onClick ? 0 : -1}
      style={style}
      className={`${bgClass} ${className || ''}`}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onKeyDown={(e) => {
        if (!disabled && onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          (e.currentTarget as HTMLElement).click();
        }
      }}
    >
      {icon && (
        <span style={{
          display: 'flex', alignItems: 'center', flexShrink: 0,
          ...(disabled ? { filter: 'grayscale(100%)', opacity: 0.7 } : {}),
        }}>
          {icon}
        </span>
      )}
      {label}
    </span>
  );
};

export default ComponentPill;
