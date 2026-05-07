import React from 'react';
import { PillInput, PillInputHandle } from './PillInput';
export type { PillInputHandle };

/**
 * CopilotInput — Fluent 2 Input
 *
 * Implements the Fluent 2 Input component spec:
 * https://fluent2.microsoft.design/components/web/react/core/input
 *
 * Appearances: outline (default), underline, filled-lighter, filled-darker
 * Sizes: sm (h-8), md (h-9, default), lg (h-10)
 *
 * Key tokens from Figma / node_modules/@fluentui/react-input:
 *   outline:        bg-white, border #D1D1D1 → hover #C7C7C7 → focus #B3B3B3
 *   underline:      transparent bg, bottom border only, no radius
 *   filled-lighter: bg-white, transparent border
 *   filled-darker:  bg-[#F5F5F5], transparent border
 *   Focus bar:      2px brand-colored bottom indicator, scaleX 0→1 on focus-within
 *   Disabled:       transparent bg, #E0E0E0 border, #BDBDBD text
 *   Error:          red border when error prop is set
 *
 * Slots:
 *   contentBefore — leading slot (icon, button, prefix text, etc.)
 *   contentAfter  — trailing slot (icon, button, suffix text, etc.)
 *   icon          — legacy alias for contentBefore (still supported)
 */

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export type InputAppearance = 'outline' | 'underline' | 'filled-lighter' | 'filled-darker';
export type InputSize = 'sm' | 'md' | 'lg';

export interface CopilotInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  required?: boolean;
  error?: string;
  size?: InputSize;
  appearance?: InputAppearance;
  /** Leading slot — icon, prefix text, or any ReactNode placed before the input */
  contentBefore?: React.ReactNode;
  /** Trailing slot — icon, suffix text, or any ReactNode placed after the input */
  contentAfter?: React.ReactNode;
  /** Legacy alias for contentBefore — still supported */
  icon?: React.ReactNode;
  /**
   * When set to `"pill"`, renders a contentEditable PillInput that supports
   * dynamic-value pill insertion (click-to-insert and drag-and-drop).
   * Use `onPillChange` for the string callback and `onPillFocus` for focus routing.
   */
  variant?: 'default' | 'pill';
  /** String change callback for pill mode. Only applies when variant="pill". */
  onPillChange?: (value: string) => void;
  /** Called when the pill editor gains focus. Only applies when variant="pill". */
  onPillFocus?: () => void;
}

// ── Size tokens ──────────────────────────────────────────────────────────────
// Matches project sizing: sm=h-8, md=h-9, lg=h-10
const sizeConfig: Record<InputSize, {
  height: string;
  text: string;
  px: string;       // side padding on wrapper
  label: string;
  slotIcon: string; // icon slot sizing class
}> = {
  sm: { height: 'h-8',  text: 'text-xs', px: 'px-2.5', label: 'text-body-2-strong',  slotIcon: 'w-4 h-4' },
  md: { height: 'h-9',  text: 'text-sm', px: 'px-3',   label: 'text-body-2-strong',  slotIcon: 'w-4 h-4' },
  lg: { height: 'h-10', text: 'text-sm', px: 'px-3.5', label: 'text-body-2-strong',  slotIcon: 'w-5 h-5' },
};

// ── Appearance tokens ────────────────────────────────────────────────────────
const appearanceClass: Record<InputAppearance, string> = {
  outline:
    'bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg hover:border-[hsl(var(--text-disabled))] focus-within:border-[hsl(var(--text-subtle))]',
  underline:
    'bg-transparent border-b border-[hsl(var(--text-subtle))] rounded-none focus-within:border-b-transparent',
  'filled-lighter':
    'bg-[hsl(var(--background))] border border-transparent rounded-lg hover:bg-[hsl(var(--muted))] focus-within:bg-[hsl(var(--muted))]',
  'filled-darker':
    'bg-[hsl(var(--muted))] border border-transparent rounded-lg',
};

const disabledClass: Record<InputAppearance, string> = {
  outline:        'bg-transparent border border-[hsl(var(--border))] rounded-lg',
  underline:      'bg-transparent border-b border-[hsl(var(--border))]',
  'filled-lighter': 'bg-transparent border border-transparent rounded-lg',
  'filled-darker':  'bg-transparent border border-transparent rounded-lg',
};

const errorClass: Record<InputAppearance, string> = {
  outline:          'border-2 border-[hsl(var(--destructive))] hover:border-[hsl(var(--destructive))] focus-within:border-[hsl(var(--destructive))]',
  underline:        'border-b-2 border-b-[hsl(var(--destructive))] hover:border-b-[hsl(var(--destructive))] focus-within:border-b-[hsl(var(--destructive))]',
  'filled-lighter': 'border-2 border-[hsl(var(--destructive))]',
  'filled-darker':  'border-2 border-[hsl(var(--destructive))]',
};

export const CopilotInput = React.forwardRef<HTMLInputElement | PillInputHandle, CopilotInputProps>(({
  label,
  required,
  error,
  size = 'md',
  appearance = 'outline',
  contentBefore,
  contentAfter,
  icon,
  className,
  disabled,
  variant = 'default',
  onPillChange,
  onPillFocus,
  ...props
}, ref) => {
  // ── Pill variant — delegate to PillInput ──
  if (variant === 'pill') {
    return (
      <PillInput
        ref={ref as React.Ref<PillInputHandle>}
        label={label}
        required={required}
        placeholder={props.placeholder}
        value={props.value as string | undefined}
        onChange={onPillChange}
        onFocus={onPillFocus}
        className={className}
        singleLine
      />
    );
  }

  // ── Default variant — plain <input> ──
  const { height, text, px, label: labelSize } = sizeConfig[size];

  // icon is a legacy alias for contentBefore
  const leading = contentBefore ?? icon;

  const wrapperClass = cn(
    'group relative flex items-center w-full transition-colors overflow-hidden',
    height,
    disabled
      ? cn(disabledClass[appearance], 'opacity-50 cursor-not-allowed')
      : error
        ? cn(appearanceClass[appearance], errorClass[appearance])
        : appearanceClass[appearance],
  );

  return (
    <div className={className}>
      {label && (
        <label className={cn('block text-foreground mb-1.5', labelSize)}>
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <div className={wrapperClass}>
        {/* Leading content slot */}
        {leading && (
          <span className={cn(
            'flex-shrink-0 flex items-center justify-center',
            'pl-2.5 pr-1',
            disabled ? 'text-[hsl(var(--text-disabled))]' : 'text-[hsl(var(--text-subtle))]',
          )}>
            {leading}
          </span>
        )}

        {/* Input */}
        <input
          ref={ref as React.Ref<HTMLInputElement>}
          disabled={disabled}
          className={cn(
            'flex-1 min-w-0 bg-transparent outline-none',
            text,
            leading ? 'pl-1' : px.replace('px-', 'pl-'),
            contentAfter ? 'pr-1' : px.replace('px-', 'pr-'),
            disabled
              ? 'text-[hsl(var(--text-disabled))] placeholder:text-[hsl(var(--text-disabled))] cursor-not-allowed'
              : 'text-foreground placeholder:text-[hsl(var(--text-placeholder))]',
          )}
          {...props}
        />

        {/* Trailing content slot */}
        {contentAfter && (
          <span className={cn(
            'flex-shrink-0 flex items-center justify-center',
            'pr-2.5 pl-1',
            disabled ? 'text-[hsl(var(--text-disabled))]' : 'text-[hsl(var(--text-subtle))]',
          )}>
            {contentAfter}
          </span>
        )}

        {/* Animated focus bar — brand color, hidden in error state */}
        {!disabled && !error && (
          <span className={cn(
            'absolute bottom-0 left-0 right-0 h-0.5 pointer-events-none',
            'bg-[hsl(var(--brand))]',
            'scale-x-0 group-focus-within:scale-x-100',
            'transition-transform duration-200',
            'origin-center',
            appearance === 'underline' ? 'rounded-none' : 'rounded-full',
          )} />
        )}
      </div>

      {error && (
        <p className="text-xs text-[hsl(var(--destructive))] mt-1">{error}</p>
      )}
    </div>
  );
});

CopilotInput.displayName = 'CopilotInput';

export default CopilotInput;
