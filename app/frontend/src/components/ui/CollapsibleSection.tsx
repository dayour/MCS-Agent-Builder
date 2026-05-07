import React, { useState } from 'react';

// =============================================================================
// COLLAPSIBLE SECTION - From COMPONENT_PATTERNS.md
// =============================================================================

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

// Placeholder icons - replace with actual icons from /icons/ folder
const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface CollapsibleSectionProps {
  title: string;
  badge?: string | number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  badge,
  defaultOpen = true,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = `collapsible-content-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <span className="text-sm font-semibold text-text-primary">{title}</span>
        <div className="flex items-center gap-2">
          {badge !== undefined && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-text-primary/70">
              {badge}
            </span>
          )}
          {isOpen ? (
            <ChevronDownIcon className="h-4 w-4 text-text-primary/60" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 text-text-primary/60" />
          )}
        </div>
      </button>

      <div 
        id={contentId}
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isOpen ? "opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-4 pb-3">
          {children}
        </div>
      </div>
    </div>
  );
};

export default CollapsibleSection;
