import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { CopilotButton } from './CopilotButton';

/**
 * CopilotDropdown - Dropdown menu component with elevation
 *
 * A dropdown button that opens a menu card with selectable options.
 * Based on the Coworker Design System.
 */

export interface DropdownOption {
  label: string;
  value: string;
  icon?: React.ReactNode;
  iconFilled?: React.ReactNode;
  description?: string;
  disabled?: boolean;
  dividerAbove?: boolean;
  destructive?: boolean;
}

export interface CopilotDropdownProps {
  options: DropdownOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  showSelectedIcon?: boolean;
  iconOnly?: boolean;
  triggerIcon?: React.ReactNode;
  triggerIconFilled?: React.ReactNode;
  variant?: 'dropdown' | 'ghost-dropdown' | 'form-field';
  hideChevron?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  fullWidth?: boolean;
  label?: string;
  required?: boolean;
  triggerClassName?: string;
}

export const CopilotDropdown: React.FC<CopilotDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select option',
  size = 'md',
  disabled = false,
  showSelectedIcon = false,
  iconOnly = false,
  triggerIcon,
  triggerIconFilled,
  variant = 'dropdown',
  hideChevron = false,
  isOpen: controlledIsOpen,
  onOpenChange,
  fullWidth = false,
  label,
  required,
  triggerClassName,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isTriggerHovered, setIsTriggerHovered] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Form-field variant automatically enables full width and shows selected icon
  const isFormField = variant === 'form-field';
  const isFullWidth = isFormField || fullWidth;
  const shouldShowIcon = isFormField || showSelectedIcon;

  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = useCallback((open: boolean) => {
    if (controlledIsOpen !== undefined && onOpenChange) {
      onOpenChange(open);
    } else {
      setInternalIsOpen(open);
    }
  }, [controlledIsOpen, onOpenChange]);

  // Get selected option label and icon
  const selectedOption = options.find(opt => opt.value === value);
  const displayLabel = selectedOption?.label || placeholder;
  const displayIcon = shouldShowIcon && selectedOption?.icon ? selectedOption.icon : undefined;

  // Close dropdown when clicking outside (checks both trigger and portal menu)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const inTrigger = triggerRef.current?.contains(target) ?? false;
      const inMenu = menuRef.current?.contains(target) ?? false;
      if (!inTrigger && !inMenu) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setIsOpen]);

  const handleSelect = (optionValue: string) => {
    onChange?.(optionValue);
    setIsOpen(false);
  };

  // Calculate fixed position from trigger rect so the menu escapes any overflow clipping
  useLayoutEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const spaceOnRight = viewportWidth - rect.right;
      const menuMinWidth = 220;
      const shouldAlignRight = !isFullWidth && spaceOnRight < menuMinWidth;
      setMenuStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        zIndex: 9999,
        ...(shouldAlignRight
          ? { right: viewportWidth - rect.right }
          : { left: rect.left }),
        ...(isFullWidth
          ? { width: rect.width }
          : { minWidth: Math.max(rect.width, 160) }),
      });
    }
  }, [isOpen, isFullWidth]);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
  };

  const menuNode = isOpen ? (
    <div
      ref={menuRef}
      className={`bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg py-1 overflow-hidden animate-scale-in`}
      style={{
        boxShadow: 'var(--shadow-dropdown)',
        ...menuStyle,
      }}
    >
      {options.map((option, index) => (
        <React.Fragment key={option.value}>
          {option.dividerAbove && <div className="border-t border-[hsl(var(--border))] my-1" />}
          <button
            onClick={() => !option.disabled && handleSelect(option.value)}
            disabled={option.disabled}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            className={`group w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors ${
              option.disabled
                ? 'text-[hsl(var(--text-disabled))] cursor-not-allowed'
                : option.destructive
                ? 'text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.08)]'
                : option.value === value
                ? 'bg-[hsl(var(--muted))] text-[hsl(var(--text-primary))] font-medium'
                : 'text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--secondary-hover))]'
            }`}
          >
            {option.icon && (
              <span className={`flex-shrink-0 flex items-center justify-center transition-colors ${
                option.disabled ? '' : option.destructive ? '' : 'group-hover:text-brand'
              }`}>
                {hoveredIndex === index && option.iconFilled && !option.disabled ? option.iconFilled : option.icon}
              </span>
            )}
            <div className="flex-1">
              <div className={`text-sm ${option.description ? 'font-semibold' : ''}`}>{option.label}</div>
              {option.description && (
                <div className="text-xs text-[hsl(var(--text-subtle))] mt-0.5">{option.description}</div>
              )}
            </div>
            {option.value === value && !option.destructive && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M13.5 4.5L6 12L2.5 8.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </React.Fragment>
      ))}
    </div>
  ) : null;

  return (
    <div className={isFullWidth ? 'block w-full' : 'inline-block'}>
    {label && (
      <label className="block text-body-2-strong text-foreground mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
    )}
    <div className={`relative ${isFullWidth ? 'block w-full' : 'inline-block'}`} ref={triggerRef}>
      {/* Dropdown Button */}
      {iconOnly ? (
        <button
          onClick={handleToggle}
          disabled={disabled}
          className={`p-2 rounded-lg text-[hsl(var(--text-subtle))] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isFullWidth ? 'w-full' : ''}`}
          onMouseEnter={() => triggerIconFilled && setIsTriggerHovered(true)}
          onMouseLeave={() => setIsTriggerHovered(false)}
        >
          {isTriggerHovered && triggerIconFilled ? (
            <span className="text-brand">{triggerIconFilled}</span>
          ) : triggerIcon}
        </button>
      ) : (
        <CopilotButton
          variant={isFormField ? 'dropdown' : variant}
          size={size}
          onClick={handleToggle}
          disabled={disabled}
          icon={displayIcon}
          iconPosition="left"
          hideChevron={hideChevron}
          className={[isFullWidth ? 'w-full' : '', triggerClassName].filter(Boolean).join(' ')}
        >
          {displayLabel}
        </CopilotButton>
      )}

      {/* Dropdown Menu — rendered via portal so it escapes overflow clipping */}
      {menuNode && ReactDOM.createPortal(menuNode, document.body)}
    </div>
    </div>
  );
};

export default CopilotDropdown;
