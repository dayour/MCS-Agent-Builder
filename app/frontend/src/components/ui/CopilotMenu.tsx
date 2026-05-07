import React, { useRef, useEffect } from 'react';
import { ChevronRight16Regular } from '@fluentui/react-icons';

/**
 * CopilotMenu — fixed-position context/action menu.
 *
 * Renders a dropdown list of action items anchored to a position calculated
 * from the trigger element's getBoundingClientRect(). Handles its own
 * click-outside dismissal.
 *
 * Icon sizing:
 *   size='sm' (default) — icon wrapper is w-4 h-4. Pass icons with className="w-4 h-4".
 *   size='md'           — icon wrapper is w-5 h-5. Pass icons without explicit size
 *                         (Fluent 20px icons fill naturally).
 */

export interface CopilotMenuItem {
  label: string;
  icon?: React.ReactNode;
  iconFilled?: React.ReactNode;
  onClick?: () => void;
  destructive?: boolean;
  dividerAbove?: boolean;
  disabled?: boolean;
  /** When true, renders as a non-interactive bold section header. onClick is unused. */
  sectionLabel?: boolean;
  /** When set, renders a toggle row instead of a clickable action. onClick is unused. */
  toggle?: { checked: boolean; onChange: (checked: boolean) => void };
  /** When true, shows a right-pointing chevron and does not close the menu on click (hover-controlled). */
  hasSubMenu?: boolean;
  /** Called when the mouse enters this item row. */
  onMouseEnter?: () => void;
  /** Called when the mouse leaves this item row. */
  onMouseLeave?: () => void;
}

export interface CopilotMenuPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  maxHeight?: number;
}

export interface CopilotMenuProps {
  items: CopilotMenuItem[];
  position: CopilotMenuPosition;
  onClose: () => void;
  /** 'sm' = compact (px-3, w-4 icons). 'md' = standard (px-4, w-5 icons). Default: 'sm'. */
  size?: 'sm' | 'md';
  minWidth?: number;
  /** Optional header rendered above menu items — use for description text, component info, etc. */
  header?: React.ReactNode;
  /** Called when the mouse enters the menu container (used for submenu hover keep-alive). */
  onMouseEnter?: () => void;
  /** Called when the mouse leaves the menu container (used for submenu hover keep-alive). */
  onMouseLeave?: () => void;
}

export const CopilotMenu: React.FC<CopilotMenuProps> = ({
  items,
  position,
  onClose,
  size = 'sm',
  minWidth = 160,
  header,
  onMouseEnter,
  onMouseLeave,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  const positionStyle: React.CSSProperties = {
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    minWidth: `${minWidth}px`,
  };
  if (position.top !== undefined) positionStyle.top = position.top;
  if (position.bottom !== undefined) positionStyle.bottom = position.bottom;
  if (position.left !== undefined) positionStyle.left = position.left;
  if (position.right !== undefined) positionStyle.right = position.right;
  if (position.maxHeight !== undefined) {
    positionStyle.maxHeight = position.maxHeight;
    positionStyle.overflowY = 'auto';
  }

  const itemPadding = size === 'sm' ? 'px-3 py-2' : 'px-4 py-2';
  const iconWrapperClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <div
      ref={menuRef}
      className="fixed bg-white border border-gray-200 rounded-lg py-1 z-50 animate-scale-in"
      style={positionStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {header && (
        <>
          <div className="px-3 pt-2.5 pb-2 select-none" style={{ maxWidth: 280 }}>
            {header}
          </div>
          <div className="border-t border-[hsl(var(--stroke-default))] my-1" />
        </>
      )}
      {items.map((item) => (
        <React.Fragment key={item.label}>
          {item.dividerAbove && <div className="border-t border-[hsl(var(--stroke-default))] my-1" />}
          {item.sectionLabel ? (
            // Non-interactive section header
            <div className={`${itemPadding} text-xs font-semibold text-gray-500 select-none`}>
              {item.label}
            </div>
          ) : item.toggle ? (
            // Toggle row — stays open, does not close the menu
            <div
              role="menuitemcheckbox"
              aria-checked={item.toggle.checked}
              tabIndex={0}
              onClick={() => item.toggle!.onChange(!item.toggle!.checked)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  item.toggle!.onChange(!item.toggle!.checked);
                }
              }}
              className={`flex items-center justify-between ${itemPadding} cursor-pointer hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:bg-gray-50`}
            >
              <span className="text-sm text-gray-900">{item.label}</span>
              {/* Fluent-style toggle: 40×20 track, 16px thumb */}
              <div
                className="relative flex-shrink-0 rounded-full transition-colors duration-150"
                style={{
                  width: 40,
                  height: 20,
                  background: item.toggle.checked ? 'hsl(var(--brand))' : '#C8C8C8',
                }}
              >
                <div
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-150"
                  style={{ transform: item.toggle.checked ? 'translateX(22px)' : 'translateX(2px)' }}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                if (!item.disabled && !item.hasSubMenu) {
                  item.onClick?.();
                  onClose();
                }
              }}
              onMouseEnter={item.onMouseEnter}
              onMouseLeave={item.onMouseLeave}
              disabled={item.disabled}
              className={`group w-full flex items-center justify-start gap-2 ${itemPadding} text-sm text-left transition-colors ${
                item.disabled
                  ? 'text-gray-400 cursor-not-allowed opacity-50'
                  : item.destructive
                  ? 'text-[hsl(var(--status-error))] hover:bg-[#FDE7E9]'
                  : 'text-gray-900 hover:bg-gray-50'
              }`}
            >
              {(item.icon || item.iconFilled) && (
                <span className={`flex-shrink-0 relative ${iconWrapperClass} transition-colors ${
                  item.disabled ? '' : item.destructive ? 'text-[hsl(var(--status-error))]' : 'text-gray-500 group-hover:text-brand'
                }`}>
                  <span className="absolute inset-0 flex items-center justify-center group-hover:opacity-0 transition-opacity">
                    {item.icon}
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.iconFilled ?? item.icon}
                  </span>
                </span>
              )}
              {item.label}
              {item.hasSubMenu && (
                <ChevronRight16Regular className="ml-auto flex-shrink-0 text-gray-400" />
              )}
            </button>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
