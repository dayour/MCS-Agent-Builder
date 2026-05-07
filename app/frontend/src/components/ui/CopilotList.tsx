import React from 'react';

/**
 * CopilotList - List component for displaying selectable items
 *
 * Based on the Coworker Design System.
 */

export interface ListItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  dividerAbove?: boolean;
}

export interface CopilotListProps {
  items: ListItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  size?: 'sm' | 'md' | 'lg';
  showCheckmark?: boolean;
  className?: string;
}

const sizeStyles = {
  sm: {
    item: "px-2 py-1.5 text-xs gap-2",
    icon: "w-3.5 h-3.5",
    checkmark: "w-3.5 h-3.5"
  },
  md: {
    item: "px-3 py-2 text-sm gap-2",
    icon: "w-4 h-4",
    checkmark: "w-4 h-4"
  },
  lg: {
    item: "px-4 py-3 text-sm gap-3",
    icon: "w-5 h-5",
    checkmark: "w-5 h-5"
  },
};

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export const CopilotList: React.FC<CopilotListProps> = ({
  items,
  selectedId,
  onSelect,
  size = 'md',
  showCheckmark = true,
  className,
}) => {
  const handleClick = (id: string, disabled?: boolean) => {
    if (!disabled && onSelect) {
      onSelect(id);
    }
  };

  return (
    <div className={cn("bg-white border border-[hsl(var(--stroke-default))] rounded-lg overflow-hidden", className)}>
      {items.map((item) => (
        <React.Fragment key={item.id}>
          {item.dividerAbove && <div className="border-t border-[hsl(var(--stroke-default))]" />}
          <button
            onClick={() => handleClick(item.id, item.disabled)}
            disabled={item.disabled}
            className={cn(
              "w-full flex items-start transition-colors",
              sizeStyles[size].item,
              item.disabled
                ? 'text-gray-400 cursor-not-allowed bg-gray-50'
                : item.id === selectedId
                ? 'bg-[#F5F5FF] text-brand-purple font-medium'
                : 'text-gray-900 hover:bg-gray-50'
            )}
          >
            {item.icon && (
              <span className={cn(
                "flex-shrink-0 flex items-center justify-center mt-0.5",
                sizeStyles[size].icon
              )}>
                {item.icon}
              </span>
            )}
            <div className="flex-1 text-left min-w-0">
              <div className={cn(
                size === 'sm' ? 'text-xs' : 'text-sm',
                'truncate'
              )}>
                {item.label}
              </div>
              {item.description && (
                <div className={cn(
                  size === 'lg' ? 'text-xs' : 'text-xs',
                  'text-gray-500 mt-0.5 line-clamp-2'
                )}>
                  {item.description}
                </div>
              )}
            </div>
            {showCheckmark && item.id === selectedId && !item.disabled && (
              <svg
                className={cn("flex-shrink-0 mt-0.5", sizeStyles[size].checkmark)}
                viewBox="0 0 16 16"
                fill="none"
              >
                <path
                  d="M13.5 4.5L6 12L2.5 8.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};

export default CopilotList;
