import React from 'react';

/**
 * CopilotFilterPill — interactive filter pill / chip
 *
 * Used for toggling filters in toolbars and filter bars.
 * Active state uses brand tint; inactive state is neutral with border.
 *
 * Sizes: xs (h-6), sm (h-8), md (h-9, default), lg (h-10)
 */

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export type FilterPillSize = 'xs' | 'sm' | 'md' | 'lg';

export interface CopilotFilterPillProps {
  /** Whether this pill is the currently active/selected filter */
  active: boolean;
  /** Display label */
  label: string;
  /** Click handler to toggle this filter */
  onClick: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  /** Optional leading icon */
  icon?: React.ReactNode;
  /** Optional trailing count */
  count?: number;
  /** Size variant — xs for compact lists, md default for page-level toolbars */
  size?: FilterPillSize;
  className?: string;
  /** Override the default brand-blue active style with custom Tailwind classes (e.g. status colors) */
  activeClassName?: string;
}

// ── Size tokens ──────────────────────────────────────────────────────────────
const sizeConfig: Record<FilterPillSize, { height: string; px: string; text: string; iconSize: string }> = {
  xs: { height: 'h-6',  px: 'px-2.5', text: 'text-[11px]', iconSize: 'w-3.5 h-3.5' },
  sm: { height: 'h-8',  px: 'px-3',   text: 'text-xs',     iconSize: 'w-4 h-4' },
  md: { height: 'h-9',  px: 'px-3.5', text: 'text-sm',     iconSize: 'w-5 h-5' },
  lg: { height: 'h-10', px: 'px-4',   text: 'text-sm',     iconSize: 'w-5 h-5' },
};

// ── Appearance tokens ────────────────────────────────────────────────────────
const activeStyle  = 'bg-[hsl(var(--brand-background))] text-[hsl(var(--action-brand-foreground))] border border-[hsl(var(--brand))]';
const defaultStyle = 'bg-[hsl(var(--secondary))] text-[hsl(var(--text-subtle))] border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary-hover))]';

export const CopilotFilterPill = React.forwardRef<HTMLButtonElement, CopilotFilterPillProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof CopilotFilterPillProps>>(({
  active,
  label,
  onClick,
  icon,
  count,
  size = 'md',
  className,
  activeClassName,
  ...rest
}, ref) => {
  const { height, px, text, iconSize } = sizeConfig[size];

  return (
    <button
      ref={ref}
      onClick={onClick}
      {...rest}
      className={cn(
        height,
        px,
        text,
        'rounded-full font-semibold transition-colors whitespace-nowrap inline-flex items-center gap-1.5',
        active ? (activeClassName ?? activeStyle) : defaultStyle,
        className,
      )}
    >
      {icon && (
        <span className={cn(iconSize, 'flex items-center justify-center flex-shrink-0')}>
          {icon}
        </span>
      )}
      {label}
      {count !== undefined && (
        <span className="ml-0.5 opacity-60">{count}</span>
      )}
    </button>
  );
});

CopilotFilterPill.displayName = 'CopilotFilterPill';

export default CopilotFilterPill;
