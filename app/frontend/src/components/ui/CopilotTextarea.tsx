import React from 'react';
import { PillInput, PillInputHandle } from './PillInput';
export type { PillInputHandle };

/**
 * CopilotTextarea - M365 Copilot-style textarea component
 *
 * Based on the Coworker Design System.
 * Uses the same border, background, and type ramp tokens as CopilotButton secondary.
 *
 * Set `variant="pill"` to render a contentEditable PillInput that supports
 * dynamic-value pill insertion (click-to-insert and drag-and-drop).
 */

export interface CopilotTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  required?: boolean;
  error?: string;
  size?: 'sm' | 'md' | 'lg';
  /** When `"pill"`, renders a PillInput (multi-line) instead of a plain textarea. */
  variant?: 'default' | 'pill';
  /** String change callback for pill mode. Only applies when variant="pill". */
  onPillChange?: (value: string) => void;
  /** Called when the pill editor gains focus. Only applies in pill mode. */
  onPillFocus?: () => void;
  /** Min height for the pill editor. Only applies in pill mode. */
  minHeight?: number;
}

const sizeStyles = {
  sm: {
    textarea: 'px-3 py-1.5 text-xs',
    label: 'text-body-2-strong',
  },
  md: {
    textarea: 'px-3.5 py-2 text-sm',
    label: 'text-body-2-strong',
  },
  lg: {
    textarea: 'px-4 py-2.5 text-sm',
    label: 'text-body-2-strong',
  },
};

export const CopilotTextarea = React.forwardRef<HTMLTextAreaElement | PillInputHandle, CopilotTextareaProps>(({
  label,
  required,
  error,
  size = 'md',
  className,
  disabled,
  variant = 'default',
  onPillChange,
  onPillFocus,
  minHeight,
  ...props
}, ref) => {
  // ── Pill variant — delegate to PillInput (multi-line) ──
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
        minHeight={minHeight}
      />
    );
  }

  // ── Default variant — plain <textarea> ──
  const styles = sizeStyles[size];

  return (
    <div className={className}>
      {label && (
        <label className={`block ${styles.label} text-[hsl(var(--secondary-foreground))] mb-1.5`}>
          {label}{required && ' *'}
        </label>
      )}
      <textarea
        ref={ref as React.Ref<HTMLTextAreaElement>}
        className={`block w-full ${styles.textarea} bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] border border-[hsl(var(--secondary-border))] rounded-lg transition-colors hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] disabled:opacity-50 disabled:cursor-not-allowed resize-none ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
        disabled={disabled}
        {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
      />
      {error && (
        <p className="text-caption-1 text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
});

export default CopilotTextarea;
