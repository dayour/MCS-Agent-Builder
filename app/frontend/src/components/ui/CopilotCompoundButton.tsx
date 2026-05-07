import React, { useState } from 'react';

/**
 * CopilotCompoundButton — Fluent 2 Compound Button
 *
 * A button with two lines of text: a primary label and a secondary description.
 * Icons are 40×40px (larger than regular button icons).
 * Height is auto (grows with content).
 *
 * Appearances: primary, secondary (default), outline, transparent
 * Sizes: sm, md (default), lg
 */

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export type CompoundButtonAppearance = 'primary' | 'secondary' | 'outline' | 'transparent';
export type CompoundButtonSize = 'sm' | 'md' | 'lg';

export interface CopilotCompoundButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  appearance?: CompoundButtonAppearance;
  size?: CompoundButtonSize;
  icon?: React.ReactNode;
  iconFilled?: React.ReactNode;
  iconPosition?: 'before' | 'after';
  /** Primary label */
  children?: React.ReactNode;
  /** Secondary description text below the primary label */
  secondaryContent?: React.ReactNode;
  /** Toggle/checked state */
  checked?: boolean;
}

// ── Size tokens ──────────────────────────────────────────────────────────────
const sizeConfig: Record<CompoundButtonSize, {
  padding: string;
  primaryText: string;
  secondaryText: string;
  gap: string;
}> = {
  sm: { padding: 'py-2 px-2',              primaryText: 'text-sm font-semibold',  secondaryText: 'text-xs font-normal', gap: 'gap-3' },
  md: { padding: 'pt-[14px] px-3 pb-4',   primaryText: 'text-sm font-semibold',  secondaryText: 'text-xs font-normal', gap: 'gap-4' },
  lg: { padding: 'pt-[18px] px-4 pb-5',   primaryText: 'text-base font-semibold', secondaryText: 'text-sm font-normal', gap: 'gap-4' },
};

// ── Appearance tokens ────────────────────────────────────────────────────────
const appearanceStyles: Record<CompoundButtonAppearance, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-[hsl(var(--primary-hover))] active:bg-[hsl(var(--primary-active))]',
  secondary:
    'bg-[hsl(var(--secondary))] text-foreground border border-[hsl(var(--secondary-border))] hover:bg-[hsl(var(--secondary-hover))] active:bg-[hsl(var(--secondary-active))]',
  outline:
    'bg-transparent text-[hsl(var(--text-primary))] border border-[hsl(var(--secondary-border))] hover:bg-[hsl(var(--secondary-hover))] active:bg-[hsl(var(--secondary-active))]',
  transparent:
    'bg-transparent text-[hsl(var(--text-secondary))] hover:text-brand active:text-brand',
};

const checkedStyles: Partial<Record<CompoundButtonAppearance, string>> = {
  primary:     'bg-brand-700 text-white hover:bg-brand-700',
  secondary:   'bg-[hsl(var(--secondary-active))] hover:bg-[hsl(var(--secondary-active))]',
  outline:     'bg-[hsl(var(--secondary-active))] hover:bg-[hsl(var(--secondary-active))]',
  transparent: 'bg-[hsl(var(--muted))] text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--muted))]',
};

// Secondary content (description) color by appearance
const secondaryContentColor: Record<CompoundButtonAppearance, string> = {
  primary:     'text-primary-foreground/80',
  secondary:   'text-[hsl(var(--text-secondary))]',
  outline:     'text-[hsl(var(--text-secondary))]',
  transparent: 'text-[hsl(var(--text-secondary))] group-hover:text-brand/80',
};

const disabledClass =
  'bg-[hsl(var(--muted))] text-[hsl(var(--text-disabled))] cursor-not-allowed pointer-events-none border-[hsl(var(--muted))]';

export const CopilotCompoundButton: React.FC<CopilotCompoundButtonProps> = ({
  appearance = 'secondary',
  size = 'md',
  icon,
  iconFilled,
  iconPosition = 'before',
  children,
  secondaryContent,
  checked,
  disabled,
  className,
  ...props
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const { padding, primaryText, secondaryText, gap } = sizeConfig[size];

  const isSelected = checked;
  const appearanceClass = disabled
    ? disabledClass
    : cn(
        appearanceStyles[appearance],
        isSelected ? checkedStyles[appearance] : '',
      );

  const activeIcon = (isHovered || isSelected) && iconFilled ? iconFilled : icon;

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (iconFilled) setIsHovered(true);
    props.onMouseEnter?.(e);
  };
  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    setIsHovered(false);
    props.onMouseLeave?.(e);
  };

  const { onMouseEnter: _, onMouseLeave: __, ...restProps } = props;

  const textContent = (
    <span className="flex flex-col text-left gap-0.5">
      <span className={primaryText}>{children}</span>
      {secondaryContent && (
        <span className={cn(secondaryText, disabled ? 'text-[hsl(var(--text-disabled))]' : secondaryContentColor[appearance])}>
          {secondaryContent}
        </span>
      )}
    </span>
  );

  const iconEl = icon ? (
    <span className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10">
      {activeIcon}
    </span>
  ) : null;

  return (
    <button
      {...restProps}
      disabled={disabled}
      aria-pressed={checked !== undefined ? checked : undefined}
      className={cn(
        'group inline-flex items-center rounded-lg font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
        padding, gap,
        appearanceClass,
        className,
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {iconPosition === 'before' && iconEl}
      {textContent}
      {iconPosition === 'after' && iconEl}
    </button>
  );
};

export default CopilotCompoundButton;
