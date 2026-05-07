import React, { useRef, useState, useEffect } from 'react';
import { ChevronDown20Regular } from '@fluentui/react-icons';
import { CopilotMenu } from './CopilotMenu';
import { CopilotTooltip } from './CopilotTooltip';

/**
 * CopilotTabs - M365 Copilot-style tabs component
 *
 * Provides consistent tab styling that matches button heights
 * Based on the Coworker Design System.
 *
 * When `collapsible` is true, three responsive states:
 *   1. Full: all tabs visible side by side
 *   2. Stacked: active tab + "+N" overflow button
 *   3. Ultra-compact: single button with active tab name + chevron dropdown
 */

export interface TabOption {
  label: string;
  value: string;
  disabled?: boolean;
  /** Tooltip shown on hover when the tab is disabled */
  disabledTooltip?: string;
}

export interface CopilotTabsProps {
  tabs: TabOption[];
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  /**
   * When true, monitors available width and progressively collapses tabs:
   * full → stacked (active + "+N") → ultra-compact (single tab + chevron dropdown).
   */
  collapsible?: boolean;
  /**
   * External available width (in px) for the tabs to fit within.
   * When provided, the component uses this instead of measuring its own container.
   * Useful when the tabs are in a CSS grid auto-sized column where the container
   * width depends on the content (circular dependency).
   */
  availableWidth?: number;
}

/** Minimum width passed to CopilotMenu; used to derive the centering offset in openMenu(). */
const MENU_MIN_WIDTH = 140;

const sizeStyles = {
  sm: {
    tab: "h-7 px-3 text-xs",
  },
  md: {
    tab: "h-8 px-4 text-sm",
  },
  lg: {
    tab: "h-10 px-5 text-sm",
  },
};

const TabNav: React.FC<{
  tabs: TabOption[];
  value: string;
  onChange: (value: string) => void;
  size: 'sm' | 'md' | 'lg';
  fullWidth: boolean;
}> = ({ tabs, value, onChange, size, fullWidth }) => (
  <nav className={`${fullWidth ? 'flex' : 'inline-flex'} border border-[hsl(var(--stroke-default))] divide-x divide-[hsl(var(--stroke-default))] rounded-lg overflow-hidden`}>
    {tabs.map((tab) => {
      const btn = (
        <button
          key={tab.value}
          onClick={() => !tab.disabled && onChange(tab.value)}
          disabled={tab.disabled}
          className={`${sizeStyles[size].tab} relative flex items-center justify-center transition-colors whitespace-nowrap ${
            value === tab.value
              ? 'bg-white text-brand-purple font-bold'
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium'
          } ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{ flex: '1 1 auto' }}
        >
          {/* Hidden bold text to reserve space and prevent width shift on active */}
          <span className="font-bold invisible" aria-hidden="true">{tab.label}</span>
          <span className="absolute inset-0 flex items-center justify-center">{tab.label}</span>
        </button>
      );
      if (tab.disabled && tab.disabledTooltip) {
        return (
          <CopilotTooltip key={tab.value} content={tab.disabledTooltip} placement="bottom">
            {btn}
          </CopilotTooltip>
        );
      }
      return btn;
    })}
  </nav>
);

export const CopilotTabs: React.FC<CopilotTabsProps> = ({
  tabs,
  value,
  onChange,
  size = 'md',
  fullWidth = false,
  collapsible = false,
  availableWidth: externalWidth,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const measureNavRef = useRef<HTMLElement>(null);
  const measureStackedRef = useRef<HTMLElement>(null);
  const overflowBtnRef = useRef<HTMLButtonElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isUltraCompact, setIsUltraCompact] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const activeTab = tabs.find((t) => t.value === value) ?? tabs[0];
  const overflowTabs = tabs.filter((t) => t.value !== value);
  const tabLabelsKey = tabs.map((t) => t.label).join('|');

  // When externalWidth is provided, use it directly instead of ResizeObserver.
  // Re-runs when value/size change because the stacked measurement uses activeTab.label.
  useEffect(() => {
    if (!collapsible || externalWidth == null) return;
    const measureNav = measureNavRef.current;
    const measureStacked = measureStackedRef.current;
    if (!measureNav || !measureStacked) return;
    const fullW = measureNav.getBoundingClientRect().width;
    const stackedW = measureStacked.getBoundingClientRect().width;
    setIsOverflowing(fullW > externalWidth);
    setIsUltraCompact(stackedW > externalWidth);
  }, [collapsible, externalWidth, tabs.length, tabLabelsKey, value, size]);

  // Fallback: ResizeObserver when no externalWidth is provided (e.g. showcase demo).
  // The observer is kept stable; a separate effect re-runs measurements when
  // value/size/tab labels change (stacked layout uses activeTab.label).
  useEffect(() => {
    if (!collapsible || externalWidth != null) return;
    const wrapper = wrapperRef.current;
    const measureNav = measureNavRef.current;
    const measureStacked = measureStackedRef.current;
    if (!wrapper || !measureNav || !measureStacked) return;

    const check = () => {
      const w = wrapper.clientWidth;
      const fullW = measureNav.getBoundingClientRect().width;
      const stackedW = measureStacked.getBoundingClientRect().width;
      setIsOverflowing(fullW > w);
      setIsUltraCompact(stackedW > w);
    };

    const observer = new ResizeObserver(check);
    observer.observe(wrapper);
    check();
    return () => observer.disconnect();
  }, [collapsible, externalWidth]);

  // Re-run measurements when active tab or size changes in the ResizeObserver path.
  useEffect(() => {
    if (!collapsible || externalWidth != null) return;
    const wrapper = wrapperRef.current;
    const measureNav = measureNavRef.current;
    const measureStacked = measureStackedRef.current;
    if (!wrapper || !measureNav || !measureStacked) return;
    const w = wrapper.clientWidth;
    const fullW = measureNav.getBoundingClientRect().width;
    const stackedW = measureStacked.getBoundingClientRect().width;
    setIsOverflowing(fullW > w);
    setIsUltraCompact(stackedW > w);
  }, [collapsible, externalWidth, value, size, tabLabelsKey]);

  // Close the overflow menu when tabs are no longer overflowing.
  useEffect(() => {
    if (!isOverflowing && menuOpen) {
      setMenuOpen(false);
    }
  }, [isOverflowing, menuOpen]);

  // Close the overflow menu whenever the active tab changes.
  useEffect(() => {
    setMenuOpen(false);
   
  }, [value]);

  const openMenu = () => {
    const btn = overflowBtnRef.current;
    if (!btn) return;
    if (menuOpen) {
      setMenuOpen(false);
    } else {
      const rect = btn.getBoundingClientRect();
      // Center the menu under the button. Half of MENU_MIN_WIDTH keeps offset
      // in sync if minWidth is ever changed.
      setMenuPos({ top: rect.bottom + 4, left: rect.left + rect.width / 2 - MENU_MIN_WIDTH / 2 });
      setMenuOpen(true);
    }
  };

  if (!collapsible) {
    return <TabNav tabs={tabs} value={value} onChange={onChange} size={size} fullWidth={fullWidth} />;
  }

  return (
    <div ref={wrapperRef} className="relative w-full overflow-hidden text-center">
      {/* Hidden measurement nav — full width of all tabs */}
      <nav
        ref={measureNavRef as React.RefObject<HTMLElement>}
        className="invisible absolute pointer-events-none inline-flex border border-[hsl(var(--stroke-default))] divide-x divide-[hsl(var(--stroke-default))] rounded-lg"
        aria-hidden="true"
      >
        {tabs.map((tab) => (
          <button key={tab.value} className={`${sizeStyles[size].tab} whitespace-nowrap font-bold`} tabIndex={-1}>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Hidden measurement nav — stacked width (active tab + "+N" button) */}
      <nav
        ref={measureStackedRef as React.RefObject<HTMLElement>}
        className="invisible absolute pointer-events-none inline-flex border border-[hsl(var(--stroke-default))] divide-x divide-[hsl(var(--stroke-default))] rounded-lg"
        aria-hidden="true"
      >
        <button className={`${sizeStyles[size].tab} whitespace-nowrap font-bold`} tabIndex={-1}>
          {activeTab?.label}
        </button>
        <button className={`${sizeStyles[size].tab} whitespace-nowrap font-medium`} tabIndex={-1}>
          +{overflowTabs.length}
        </button>
      </nav>

      {isUltraCompact ? (
        <>
          {/* Ultra-compact: single tab with chevron, dropdown shows all tabs */}
          <button
            ref={overflowBtnRef}
            onClick={openMenu}
            className={`${sizeStyles[size].tab} inline-flex items-center gap-1.5 border border-[hsl(var(--stroke-default))] rounded-lg bg-white text-brand-purple font-bold whitespace-nowrap transition-colors hover:bg-gray-50`}
            aria-label={`${activeTab?.label} — open tab menu`}
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            {activeTab?.label}
            <ChevronDown20Regular className={`w-4 h-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
          {menuOpen && (
            <CopilotMenu
              items={tabs.map((tab) => ({
                label: tab.label,
                disabled: tab.disabled || tab.value === value,
                onClick: () => {
                  onChange(tab.value);
                  setMenuOpen(false);
                },
              }))}
              position={{ top: menuPos.top, left: menuPos.left }}
              onClose={() => setMenuOpen(false)}
              minWidth={MENU_MIN_WIDTH}
            />
          )}
        </>
      ) : isOverflowing ? (
        <>
          {/* Stacked: active tab + overflow "+N" button */}
          <nav className="inline-flex border border-[hsl(var(--stroke-default))] divide-x divide-[hsl(var(--stroke-default))] rounded-lg overflow-hidden">
            <div
              className={`${sizeStyles[size].tab} relative flex items-center justify-center whitespace-nowrap bg-white text-brand-purple font-bold`}
              style={{ flex: '1 1 auto' }}
            >
              <span className="font-bold invisible" aria-hidden="true">{activeTab?.label}</span>
              <span className="absolute inset-0 flex items-center justify-center">{activeTab?.label}</span>
            </div>
            <button
              ref={overflowBtnRef}
              onClick={openMenu}
              className={`${sizeStyles[size].tab} flex items-center justify-center whitespace-nowrap bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium transition-colors`}
              style={{ flex: '0 0 auto' }}
              aria-label={`More tabs, ${overflowTabs.length} hidden`}
              aria-haspopup="true"
              aria-expanded={menuOpen}
            >
              +{overflowTabs.length}
            </button>
          </nav>
          {menuOpen && (
            <CopilotMenu
              items={overflowTabs.map((tab) => ({
                label: tab.label,
                disabled: tab.disabled,
                onClick: () => {
                  onChange(tab.value);
                  setMenuOpen(false);
                },
              }))}
              position={{ top: menuPos.top, left: menuPos.left }}
              onClose={() => setMenuOpen(false)}
              minWidth={MENU_MIN_WIDTH}
            />
          )}
        </>
      ) : (
        <TabNav tabs={tabs} value={value} onChange={onChange} size={size} fullWidth={fullWidth} />
      )}
    </div>
  );
};

export default CopilotTabs;
