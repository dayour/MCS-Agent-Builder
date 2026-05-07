import React, { useState } from 'react';
import { ChevronDown20Regular } from '@fluentui/react-icons';

/**
 * CopilotSplitButton — Fluent 2 Split Button
 *
 * Two joined buttons: a primary action (left) and a menu trigger (right),
 * separated by a 1px divider. The left part has a flat right edge and the
 * right part has a flat left edge.
 *
 * Appearances: primary, secondary (default), outline, transparent
 * Sizes: sm (h-8), md (h-9, default), lg (h-10)
 */

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export type SplitButtonAppearance = 'primary' | 'secondary' | 'outline' | 'transparent';
export type SplitButtonSize = 'sm' | 'md' | 'lg';

export interface CopilotSplitButtonProps {
  appearance?: SplitButtonAppearance;
  size?: SplitButtonSize;
  icon?: React.ReactNode;
  iconFilled?: React.ReactNode;
  children?: React.ReactNode;
  disabled?: boolean;
  /** Called when the main action part is clicked */
  onClick?: () => void;
  /** Called when the menu chevron part is clicked */
  onMenuClick?: () => void;
  /** Whether the menu is currently open (applies selected styling to menu trigger) */
  menuOpen?: boolean;
  className?: string;
  /** Accessible name for the button group */
  'aria-label'?: string;
  /** aria-label for the chevron/menu trigger button. Defaults to "More options" */
  menuTriggerAriaLabel?: string;
}

// ── Size tokens ──────────────────────────────────────────────────────────────
const sizeConfig: Record<SplitButtonSize, {
  height: string;
  px: string;
  text: string;
  gap: string;
  menuWidth: string;
  icon: string;
}> = {
  sm: { height: 'h-8',  px: 'px-3',   text: 'text-xs',  gap: 'gap-1.5', menuWidth: 'w-8',  icon: 'w-4 h-4' },
  md: { height: 'h-9',  px: 'px-3.5', text: 'text-sm',  gap: 'gap-2',   menuWidth: 'w-9',  icon: 'w-5 h-5' },
  lg: { height: 'h-10', px: 'px-4',   text: 'text-sm',  gap: 'gap-2',   menuWidth: 'w-10', icon: 'w-5 h-5' },
};

// ── Appearance tokens ────────────────────────────────────────────────────────
interface AppearanceTokens {
  base: string;        // shared bg/text/border
  divider: string;     // 1px separator between action + menu
  hover: string;
  active: string;
}

const appearanceTokens: Record<SplitButtonAppearance, AppearanceTokens> = {
  primary: {
    base:    'bg-primary text-primary-foreground',
    divider: 'bg-white/40',
    hover:   'hover:bg-[hsl(var(--primary-hover))]',
    active:  'active:bg-[hsl(var(--primary-active))]',
  },
  secondary: {
    base:    'bg-[hsl(var(--secondary))] text-foreground border border-[hsl(var(--secondary-border))]',
    divider: 'bg-[hsl(var(--secondary-border))]',
    hover:   'hover:bg-[hsl(var(--secondary-hover))]',
    active:  'active:bg-[hsl(var(--secondary-active))]',
  },
  outline: {
    base:    'bg-transparent text-[hsl(var(--text-primary))] border border-[hsl(var(--secondary-border))]',
    divider: 'bg-[hsl(var(--secondary-border))]',
    hover:   'hover:bg-[hsl(var(--secondary-hover))]',
    active:  'active:bg-[hsl(var(--secondary-active))]',
  },
  transparent: {
    base:    'bg-transparent text-[hsl(var(--text-secondary))]',
    divider: 'bg-[hsl(var(--stroke-default))]',
    hover:   'hover:text-brand',
    active:  'active:text-brand',
  },
};

const disabledClass =
  'bg-[hsl(var(--muted))] text-[hsl(var(--text-disabled))] cursor-not-allowed pointer-events-none border-[hsl(var(--muted))]';

export const CopilotSplitButton: React.FC<CopilotSplitButtonProps> = ({
  appearance = 'secondary',
  size = 'md',
  icon,
  iconFilled,
  children,
  disabled,
  onClick,
  onMenuClick,
  menuOpen = false,
  className,
  'aria-label': ariaLabel,
  menuTriggerAriaLabel,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const { height, px, text, gap, menuWidth, icon: iconSize } = sizeConfig[size];
  const tokens = appearanceTokens[appearance];

  const sharedBase = cn(
    'inline-flex items-center justify-center font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1',
    height, text,
    disabled ? disabledClass : cn(tokens.base, tokens.hover, tokens.active),
  );

  const activeIcon = isHovered && iconFilled ? iconFilled : icon;

  return (
    <div className={cn('inline-flex items-stretch', className)} role="group" aria-label={ariaLabel}>
      {/* Primary action */}
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        onMouseEnter={() => { if (iconFilled) setIsHovered(true); }}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(sharedBase, px, gap, 'group rounded-l-lg rounded-r-none',
          // remove right border for non-bordered appearances to avoid double border with divider
          (appearance === 'secondary' || appearance === 'outline') ? 'border-r-0' : '',
        )}
      >
        {icon && (
          <span aria-hidden="true" className={cn(iconSize, 'flex-shrink-0 inline-flex items-center justify-center', iconFilled ? 'group-hover:text-brand' : '')}>
            {activeIcon}
          </span>
        )}
        {children}
      </button>

      {/* Divider */}
      <div
        aria-hidden
        className={cn(
          'self-stretch w-px flex-shrink-0 my-1',
          disabled ? 'bg-[hsl(var(--secondary-border))]' : tokens.divider,
        )}
      />

      {/* Menu trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={onMenuClick}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label={menuTriggerAriaLabel ?? 'More options'}
        className={cn(
          sharedBase,
          menuWidth,
          'rounded-r-lg rounded-l-none',
          (appearance === 'secondary' || appearance === 'outline') ? 'border-l-0' : '',
          !disabled && menuOpen
            ? appearance === 'primary'
              ? 'bg-[hsl(var(--primary-active))]'
              : 'bg-[hsl(var(--secondary-active))]'
            : '',
        )}
      >
        <span className={cn(iconSize, 'flex-shrink-0 inline-flex items-center justify-center')}>
          <ChevronDown20Regular />
        </span>
      </button>
    </div>
  );
};

export default CopilotSplitButton;
