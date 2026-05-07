import React, { useEffect, useState } from 'react';

/**
 * CopilotUnderlineTabs — underline-style tab bar (Fluent 2 horizontal nav pattern).
 *
 * Active tab has a brand-color pill underline indicator.
 * A subtle grey border fades in beneath the tabs when content scrolls behind them.
 * Use for page-level navigation within a section (e.g. DW detail tabs).
 */

export interface UnderlineTabOption {
  label: string;
  value: string;
  icon?: React.ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
}

export interface CopilotUnderlineTabsProps {
  tabs: UnderlineTabOption[];
  value: string;
  onChange: (value: string) => void;
  appearance?: 'subtle' | 'transparent';
  size?: 'sm' | 'md' | 'small' | 'medium';
  /** Extra content (e.g. a collapse button) rendered at the far right via ml-auto */
  trailing?: React.ReactNode;
  /** CSS selector for the scroll container to observe. Defaults to #elevate-right-content .overflow-y-auto */
  scrollSelector?: string;
  className?: string;
}

const sizeStyles = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-11 px-3 text-sm',
};

export const CopilotUnderlineTabs: React.FC<CopilotUnderlineTabsProps> = ({
  tabs,
  value,
  onChange,
  appearance = 'subtle',
  size = 'md',
  trailing,
  scrollSelector,
  className = '',
}) => {
  const [scrolled, setScrolled] = useState(false);
  const resolvedSize = size === 'small' ? 'sm' : size === 'medium' ? 'md' : size;

  // `value` is intentionally in the dep array — the scroll container element changes
  // when the active tab switches (each DW tab renders its own overflow-y-auto div).
  useEffect(() => {
    const findScrollEl = () => {
      if (scrollSelector) return document.querySelector(scrollSelector);
      const root = document.getElementById('elevate-right-content');
      return root?.querySelector('.overflow-y-auto') ?? null;
    };

    const scrollEl = findScrollEl();
    if (!scrollEl) return;

    const onScroll = () => setScrolled(scrollEl.scrollTop > 16);
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => scrollEl.removeEventListener('scroll', onScroll);
  }, [scrollSelector, value]);

  return (
    <div className={`relative flex items-center gap-2 ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => !tab.disabled && onChange(tab.value)}
          disabled={tab.disabled}
          aria-label={tab.ariaLabel || tab.label}
          className={`group/tab relative inline-flex items-center justify-center rounded-[8px] ${sizeStyles[resolvedSize]} font-medium whitespace-nowrap transition-colors duration-150
            ${tab.disabled ? 'text-[hsl(var(--text-disabled))] cursor-not-allowed' : 'cursor-pointer'}
            ${appearance === 'subtle'
              ? value === tab.value
                ? 'bg-transparent text-[hsl(var(--text-primary))] font-semibold hover:bg-[hsl(var(--surface-tertiary))]'
                : tab.disabled
                  ? 'bg-transparent'
                  : 'bg-transparent text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-tertiary))] hover:text-[hsl(var(--text-primary))]'
              : value === tab.value
                ? 'text-[hsl(var(--text-primary))] font-semibold'
                : tab.disabled
                  ? 'text-[hsl(var(--text-disabled))]'
                  : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]'
            }`}
        >
          <span className="relative inline-flex h-full items-center gap-1.5">
            {tab.icon && <span aria-hidden="true" className="inline-flex items-center justify-center">{tab.icon}</span>}
            <span className="relative inline-flex flex-col items-center">
              <span className="font-semibold invisible h-0 overflow-hidden" aria-hidden="true">{tab.label}</span>
              {tab.label && <span>{tab.label}</span>}
            </span>
            <span className={`absolute bottom-0 left-0 right-0 h-[3px] rounded-full transition-colors ${
              value === tab.value
                ? 'bg-[hsl(var(--brand))]'
                : tab.disabled
                  ? 'bg-transparent'
                  : 'bg-transparent group-hover/tab:bg-gray-300'
            }`} />
          </span>
        </button>
      ))}
      {trailing && <div className="ml-auto">{trailing}</div>}
      {/* Scroll-aware bottom border */}
      <span
        className="absolute -bottom-px left-0 right-0 h-px bg-gray-200 transition-opacity duration-200"
        style={{ opacity: scrolled ? 1 : 0 }}
      />
    </div>
  );
};

