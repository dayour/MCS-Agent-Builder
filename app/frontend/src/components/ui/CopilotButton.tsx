import React, { useState } from 'react';
import { ChevronDown20Regular } from '@fluentui/react-icons';

/**
 * CopilotButton - Fluent 2 Button
 *
 * Appearances: primary, secondary (default), outline, transparent
 * Legacy aliases: ghost (= transparent), action, action-brand,
 *                 dropdown, dropdown-selected, icon, icon-subtle, card
 *
 * Props:
 *   checked    — toggle button: pressed/selected state
 */

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'transparent'
  | 'ghost' | 'ghost-dropdown'
  | 'action' | 'action-brand'
  | 'dropdown' | 'dropdown-selected'
  | 'icon' | 'icon-subtle'
  | 'card'
  | 'tab-pill';

export interface CopilotButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconFilled?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  hideChevron?: boolean;
  /** Toggle button — renders the button in a pressed/selected state */
  checked?: boolean;
}

// ── Appearance tokens ────────────────────────────────────────────────────────
const variantStyles: Record<ButtonVariant, string> = {
  // ── Fluent 2 named appearances ──────────────────────────────────────────
  primary:
    'bg-primary text-primary-foreground hover:bg-[hsl(var(--primary-hover))] active:bg-[hsl(var(--primary-active))]',
  secondary:
    'bg-[hsl(var(--secondary))] text-foreground border border-[hsl(var(--secondary-border))] hover:bg-[hsl(var(--secondary-hover))] active:bg-[hsl(var(--secondary-active))]',
  outline:
    'bg-transparent text-foreground border border-[hsl(var(--secondary-border))] hover:bg-[hsl(var(--secondary-hover))] active:bg-[hsl(var(--secondary-active))]',
  transparent:
    'bg-transparent text-foreground hover:text-brand active:text-brand',

  // ── Legacy aliases ───────────────────────────────────────────────────────
  ghost:
    'bg-transparent text-[hsl(var(--text-primary))] hover:text-brand active:text-[hsl(var(--text-subtle))]',
  'ghost-dropdown':
    'bg-transparent text-[hsl(var(--text-primary))] hover:text-brand active:text-[hsl(var(--text-subtle))]',
  action:
    'bg-[hsl(var(--action))] text-[hsl(var(--action-foreground))] border border-[hsl(var(--action-border))] hover:bg-[hsl(var(--action-hover))] active:bg-[hsl(var(--action-active))]',
  'action-brand':
    'bg-[hsl(var(--action-brand))] text-[hsl(var(--action-brand-foreground))] hover:bg-[hsl(var(--action-brand-hover))] active:bg-[hsl(var(--action-brand-active))]',
  dropdown:
    'bg-[hsl(var(--secondary))] text-foreground border border-[hsl(var(--secondary-border))] hover:bg-[hsl(var(--secondary-hover))] active:bg-[hsl(var(--secondary-active))] rounded-lg',
  'dropdown-selected':
    'bg-[hsl(var(--action))] text-[hsl(var(--action-foreground))] border border-[hsl(var(--action-border))] hover:bg-[hsl(var(--action-hover))] active:bg-[hsl(var(--action-active))] rounded-lg',
  icon:
    'bg-transparent text-foreground hover:bg-muted hover:text-brand active:bg-muted/80',
  'icon-subtle':
    'bg-transparent text-muted-foreground hover:text-brand hover:bg-muted/50',
  card:
    'bg-[hsl(var(--secondary))] text-foreground border border-[hsl(var(--secondary-border))] hover:bg-[hsl(var(--secondary-hover))] active:bg-[hsl(var(--secondary-active))] rounded-xl',
  'tab-pill':
    'bg-transparent text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--muted))] active:bg-[hsl(var(--muted))] border-b-2 border-b-transparent',
};

// Checked/selected override — applied when checked=true
const checkedStyles: Partial<Record<ButtonVariant, string>> = {
  primary:     'bg-brand-700 text-white hover:bg-brand-700 active:bg-brand-700',
  secondary:   'bg-[hsl(var(--secondary-active))] border-[hsl(var(--secondary-border))] hover:bg-[hsl(var(--secondary-active))]',
  outline:     'bg-[hsl(var(--secondary-active))] border-[hsl(var(--secondary-border))] hover:bg-[hsl(var(--secondary-active))]',
  transparent: 'bg-[hsl(var(--muted))] text-foreground hover:bg-[hsl(var(--muted))]',
  'tab-pill': 'bg-[hsl(var(--brand-background))] text-foreground hover:bg-[hsl(var(--brand-background))] border-b-2 border-b-[hsl(var(--brand))]',
};

// ── Size tokens ──────────────────────────────────────────────────────────────
const sizeStyles = {
  xs: { button: 'h-6 px-2 text-xs gap-1 !rounded-md', iconOnly: 'h-6 w-6 !rounded-md', icon: 'w-3 h-3' },
  sm: { button: 'h-8 px-3 text-xs gap-1.5',    iconOnly: 'h-8 w-8',   icon: 'w-4 h-4' },
  md: { button: 'h-9 px-3.5 text-sm gap-2',    iconOnly: 'h-9 w-9',   icon: 'w-5 h-5' },
  lg: { button: 'h-10 px-4 text-sm gap-2',     iconOnly: 'h-10 w-10', icon: 'w-5 h-5' },
};

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export const CopilotButton = React.forwardRef<HTMLButtonElement, CopilotButtonProps>(({
  variant = 'primary',
  size = 'md',
  icon,
  iconFilled,
  iconPosition = 'left',
  loading = false,
  hideChevron = false,
  checked,
  disabled,
  children,
  className,
  ...props
}, ref) => {
  const [isHovered, setIsHovered] = useState(false);
  const isCard = variant === 'card';
  const isDropdown = variant === 'dropdown' || variant === 'dropdown-selected' || variant === 'ghost-dropdown';
  const displayIcon = icon;
  const chevronIcon = isDropdown && !hideChevron
    ? <ChevronDown20Regular />
    : null;

  const isIconOnly = !children && icon && !chevronIcon && !isCard;

  const shouldJustifyBetween = chevronIcon && children;

  // Resolve appearance class, applying checked selected override
  const isSelected = checked;
  const baseVariantStyle = variantStyles[variant] ?? variantStyles['secondary'];
  const selectedOverride = isSelected ? (checkedStyles[variant] ?? '') : '';

  const baseStyles = cn(
    'group inline-flex transition-colors',
    isDropdown ? 'font-normal' : 'font-semibold',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
    isCard
      ? 'flex-col items-start justify-start text-left p-3.5 gap-2'
      : cn(
          'items-center',
          shouldJustifyBetween ? 'justify-between' : 'justify-center',
          !isDropdown && 'rounded-lg',
          isIconOnly ? sizeStyles[size].iconOnly : sizeStyles[size].button,
        ),
    (disabled || loading)
      ? 'bg-[hsl(var(--muted))] text-[hsl(var(--text-disabled))] cursor-not-allowed pointer-events-none border-[hsl(var(--muted))]'
      : cn(baseVariantStyle, selectedOverride),
    className,
  );

  const renderIcon = (pos: 'left' | 'right') => {
    if (!displayIcon) return null;
    if (pos !== iconPosition) return null;
    if (pos === 'right' && isDropdown) return null;

    const activeIcon = (isHovered || isSelected) && iconFilled ? iconFilled : displayIcon;
    const colorClass = iconFilled ? 'group-hover:text-brand' : '';

    return (
      <span className={cn(sizeStyles[size].icon, 'flex-shrink-0 inline-flex items-center justify-center', colorClass)}>
        {activeIcon}
      </span>
    );
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (iconFilled) setIsHovered(true);
    props.onMouseEnter?.(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    setIsHovered(false);
    props.onMouseLeave?.(e);
  };

  const { onMouseEnter: _, onMouseLeave: __, ...restProps } = props;

  return (
    <button
      ref={ref}
      {...restProps}
      className={baseStyles}
      disabled={disabled || loading}
      aria-pressed={checked !== undefined ? checked : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {loading ? (
        <LoadingSpinner className={sizeStyles[size].icon} />
      ) : (
        <>
          {shouldJustifyBetween ? (
            <>
              <span className="inline-flex items-center gap-2 min-w-0 truncate">
                {renderIcon('left')}
                <span className="truncate">{children}</span>
              </span>
              {chevronIcon && (
                <span className={cn(sizeStyles[size].icon, 'flex-shrink-0 inline-flex items-center justify-center')}>
                  {chevronIcon}
                </span>
              )}
            </>
          ) : (
            <>
              {renderIcon('left')}
              {children}
              {renderIcon('right')}
              {chevronIcon && (
                <span className={cn(sizeStyles[size].icon, 'flex-shrink-0 inline-flex items-center justify-center')}>
                  {chevronIcon}
                </span>
              )}
            </>
          )}
        </>
      )}
    </button>
  );
});

CopilotButton.displayName = 'CopilotButton';

const LoadingSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

export default CopilotButton;
