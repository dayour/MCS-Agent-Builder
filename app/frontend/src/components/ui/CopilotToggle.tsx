import React from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CopilotToggleProps {
  /** Whether the toggle is on. */
  checked: boolean;
  /** Called when the user toggles the switch. */
  onChange: (checked: boolean) => void;
  /** Accessible label for screen readers. */
  'aria-label'?: string;
  /** Optional label text displayed next to the toggle. */
  label?: string;
  /** Toggle size variant. */
  size?: 'sm' | 'md';
  /** Whether the toggle is disabled. */
  disabled?: boolean;
  /** Optional className for the outer wrapper. */
  className?: string;
}

// ── Design tokens ──────────────────────────────────────────────────────────────

const TOKENS = {
  sm: { track: { width: 32, height: 18 }, knob: 14, translateOn: 15, translateOff: 2 },
  md: { track: { width: 36, height: 20 }, knob: 16, translateOn: 18, translateOff: 3 },
} as const;

const COLOR_ON  = 'hsl(var(--brand))';
const COLOR_OFF = 'hsl(var(--stroke-default))';
const COLOR_ON_DISABLED  = '#a5a7d6';
const COLOR_OFF_DISABLED = '#e5e7eb';

// ── Component ──────────────────────────────────────────────────────────────────

export const CopilotToggle: React.FC<CopilotToggleProps> = ({
  checked,
  onChange,
  'aria-label': ariaLabel,
  label,
  size = 'sm',
  disabled = false,
  className,
}) => {
  const t = TOKENS[size];

  const trackColor = checked
    ? (disabled ? COLOR_ON_DISABLED : COLOR_ON)
    : (disabled ? COLOR_OFF_DISABLED : COLOR_OFF);

  const toggle = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex items-center rounded-full transition-colors flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#5B5FC7] ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
      style={{ width: t.track.width, height: t.track.height, backgroundColor: trackColor }}
    >
      <span
        className="inline-block rounded-full bg-white shadow transition-transform"
        style={{
          width: t.knob,
          height: t.knob,
          transform: checked ? `translateX(${t.translateOn}px)` : `translateX(${t.translateOff}px)`,
        }}
      />
    </button>
  );

  if (!label) {
    return className ? <span className={className}>{toggle}</span> : toggle;
  }

  return (
    <label className={`inline-flex items-center gap-2 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${className ?? ''}`}>
      {toggle}
      <span className="text-sm text-gray-700 select-none">{label}</span>
    </label>
  );
};
