import React from 'react';
import { LatencyLoader } from './StatusIcon';

// =============================================================================
// PROGRESS TIMELINE (TASK PANEL) - From COMPONENT_PATTERNS.md
// =============================================================================

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export interface ProgressItem {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed';
}

interface ProgressTimelineProps {
  items: ProgressItem[];
}

export const ProgressTimeline: React.FC<ProgressTimelineProps> = ({ items }) => {
  return (
    <div className="relative">
      {/* Vertical connecting line */}
      <div
        className="absolute left-[9px] top-[18px] w-[1.5px] bg-[hsl(var(--stroke-default))]"
        style={{ height: `calc(100% - 36px)` }}
      />

      {/* Items */}
      <div className="space-y-0">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="flex items-start gap-3 py-2 animate-fade-in relative"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Status icon container */}
            <div className="flex-shrink-0 relative z-10 bg-white w-5 h-5">
              {item.status === "completed" && (
                <svg width="20" height="20" viewBox="0 0 20 20" className="text-[hsl(var(--status-success))]">
                  <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M6.5 10L9 12.5L13.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {item.status === "in-progress" && <LatencyLoader />}
              {item.status === "pending" && (
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="8.5" stroke="#C4C4C4" strokeWidth="1.5" fill="none" />
                </svg>
              )}
            </div>

            {/* Label */}
            <span className={cn(
              "text-sm transition-all duration-300",
              item.status === "completed" && "text-text-primary",
              item.status === "in-progress" && "text-text-primary font-medium",
              item.status === "pending" && "text-text-primary/60"
            )}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgressTimeline;
