import React from 'react';

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type BadgeAppearance = 'filled' | 'tint' | 'outline' | 'ghost';
export type BadgeColor =
  | 'brand'
  | 'subtle'
  | 'success'
  | 'warning'
  | 'danger'
  | 'important'
  | 'informative'
  | 'severe';
export type BadgeSize = 'small' | 'medium' | 'large';
export type BadgeShape = 'circular' | 'rounded' | 'square';

export interface CopilotBadgeProps {
  /** Badge label */
  children: React.ReactNode;

  /** Visual style — filled, tint, outline, or ghost. Defaults to tint. */
  appearance?: BadgeAppearance;

  /** Semantic color. Defaults to subtle. */
  color?: BadgeColor;

  /** Height / font size. Defaults to medium. */
  size?: BadgeSize;

  /** Border radius style. Defaults to circular. */
  shape?: BadgeShape;

  /** Optional leading icon */
  icon?: React.ReactNode;

  /** Additional Tailwind classes */
  className?: string;
}

// ─── Design tokens (Fluent 2 Badge — tint / filled / outline / ghost) ─────────
// Source: fluent2.microsoft.design/components/web/react/core/badge
// Figma: Fluent-2-web, node 325253-9096

const colorStyles: Record<BadgeAppearance, Record<BadgeColor, string>> = {
  tint: {
    brand:       'bg-[#EBF3FC] text-[#0F6CBD] ring-1 ring-inset ring-[#0078D4]',
    subtle:      'bg-[hsl(var(--surface-tertiary))] text-[hsl(var(--text-secondary))] ring-1 ring-inset ring-[hsl(var(--stroke-default))]',
    success:     'bg-[#DFF6DD] text-[hsl(var(--status-success))] ring-1 ring-inset ring-[hsl(var(--status-success))]',
    warning:     'bg-[#FFF4CE] text-[#7A4100] ring-1 ring-inset ring-[#F7630C]',
    danger:      'bg-[#FDE7E9] text-[hsl(var(--status-error))] ring-1 ring-inset ring-[hsl(var(--status-error))]',
    important:   'bg-[hsl(var(--surface-tertiary))] text-[#1A1A1A] ring-1 ring-inset ring-[hsl(var(--text-secondary))]',
    informative: 'bg-[#EFF6FC] text-[#0072C6] ring-1 ring-inset ring-[#0072C6]',
    severe:      'bg-[#FEF0E1] text-[#7A3B1E] ring-1 ring-inset ring-[#E27A24]',
  },
  filled: {
    brand:       'bg-[#0078D4] text-white',
    subtle:      'bg-[hsl(var(--stroke-default))] text-[#1A1A1A]',
    success:     'bg-[hsl(var(--status-success))] text-white',
    warning:     'bg-[#F7630C] text-white',
    danger:      'bg-[hsl(var(--status-error))] text-white',
    important:   'bg-[#1A1A1A] text-white',
    informative: 'bg-[#0072C6] text-white',
    severe:      'bg-[#E27A24] text-white',
  },
  outline: {
    brand:       'bg-transparent text-[#0F6CBD] ring-1 ring-inset ring-[#0078D4]',
    subtle:      'bg-transparent text-[hsl(var(--text-secondary))] ring-1 ring-inset ring-[hsl(var(--stroke-default))]',
    success:     'bg-transparent text-[hsl(var(--status-success))] ring-1 ring-inset ring-[hsl(var(--status-success))]',
    warning:     'bg-transparent text-[#7A4100] ring-1 ring-inset ring-[#F7630C]',
    danger:      'bg-transparent text-[hsl(var(--status-error))] ring-1 ring-inset ring-[hsl(var(--status-error))]',
    important:   'bg-transparent text-[#1A1A1A] ring-1 ring-inset ring-[hsl(var(--text-secondary))]',
    informative: 'bg-transparent text-[#0072C6] ring-1 ring-inset ring-[#0072C6]',
    severe:      'bg-transparent text-[#7A3B1E] ring-1 ring-inset ring-[#E27A24]',
  },
  ghost: {
    brand:       'bg-transparent text-[#0F6CBD]',
    subtle:      'bg-transparent text-[hsl(var(--text-secondary))]',
    success:     'bg-transparent text-[hsl(var(--status-success))]',
    warning:     'bg-transparent text-[#7A4100]',
    danger:      'bg-transparent text-[hsl(var(--status-error))]',
    important:   'bg-transparent text-[#1A1A1A]',
    informative: 'bg-transparent text-[#0072C6]',
    severe:      'bg-transparent text-[#7A3B1E]',
  },
};

// Fluent 2 sizes: small=20px, medium=24px, large=28px
const sizeStyles: Record<BadgeSize, string> = {
  small:  'h-5 text-[11px] leading-[20px] px-2.5',
  medium: 'h-6 text-xs     leading-[24px] px-2',
  large:  'h-7 text-sm     leading-[28px] px-2.5',
};

const shapeStyles: Record<BadgeShape, string> = {
  circular: 'rounded-full',
  rounded:  'rounded',
  square:   'rounded-none',
};

// ─── Component ────────────────────────────────────────────────────────────────

export const CopilotBadge: React.FC<CopilotBadgeProps> = ({
  children,
  appearance = 'tint',
  color = 'subtle',
  size = 'medium',
  shape = 'circular',
  icon,
  className,
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium whitespace-nowrap flex-shrink-0',
        sizeStyles[size],
        shapeStyles[shape],
        colorStyles[appearance][color],
        className,
      )}
    >
      {icon && <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">{icon}</span>}
      <span style={{ transform: 'translateY(-1px)' }}>{children}</span>
    </span>
  );
};
