import React from 'react';
import { LatencyLoader } from './StatusIcon';

// =============================================================================
// PLAN CARD WITH TASK LIST - From COMPONENT_PATTERNS.md
// =============================================================================

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

// Tool icon mapping from COMPONENT_PATTERNS.md
function getToolIcon(tool: string): string {
  const iconMap: Record<string, string> = {
    // Microsoft 365 Core
    "word": "/icons/word.svg",
    "excel": "/icons/excel.svg",
    "powerpoint": "/icons/powerpoint.svg",
    "outlook": "/icons/outlook.svg",
    "teams": "/icons/teams.svg",
    "onenote": "/icons/notebooks.svg",
    "onedrive": "/icons/onedrive.svg",
    "sharepoint": "/icons/sharepoint.svg",

    // AI & Copilot
    "copilot": "/icons/copilot-color.svg",
    "copilot (mono)": "/icons/copilot-monoline.svg",
    "coworker": "/icons/coworker-24.svg",
    "coworker (mono)": "/icons/coworker-monoline.svg",

    // Power Platform
    "power automate": "/icons/automate.svg",
    "power apps": "/icons/power-apps.svg",
    "power bi": "/icons/powerbi.svg",

    // Business Apps
    "dynamics 365": "/icons/d365-main.svg",
    "planner": "/icons/planner-24.svg",
    "defender": "/icons/defender-color.svg",

    // Agents
    "researcher": "/icons/researcher.svg",
    "analyst": "/icons/analyst-24.svg",
    "sales": "/icons/sales.svg",
  };

  return iconMap[tool.toLowerCase()] || "/icons/apps-color.svg";
}

export interface PlanTask {
  id: string;
  title: string;
  status: 'completed' | 'running' | 'pending';
  tools?: string[];
}

interface PlanCardProps {
  title?: string;
  tasks: PlanTask[];
  onSkip?: () => void;
  onEdit?: () => void;
  onRunAll?: () => void;
}

export const PlanCard: React.FC<PlanCardProps> = ({
  title = "Here's my plan",
  tasks,
  onSkip,
  onEdit,
  onRunAll,
}) => {
  return (
    <div className="rounded-xl border border-[hsl(var(--stroke-default))] p-4 max-w-[640px] bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-body-2-strong">{title}</h4>
        <div className="flex gap-2">
          <button
            onClick={onSkip}
            className="btn-tertiary px-3 py-1.5 text-sm rounded-lg"
          >
            Skip
          </button>
          <button
            onClick={onEdit}
            className="btn-secondary px-3 py-1.5 text-sm rounded-lg"
          >
            Edit
          </button>
          <button
            onClick={onRunAll}
            className="btn-secondary px-3 py-1.5 text-sm rounded-lg"
          >
            Run all
          </button>
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {tasks.map((task, index) => (
          <div
            key={task.id}
            className="flex items-center gap-3 py-2 animate-slide-up-fade"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            {/* Status icon */}
            <div className="flex-shrink-0 w-5 h-5">
              {task.status === "completed" ? (
                <svg width="20" height="20" viewBox="0 0 20 20" className="text-[hsl(var(--status-success))]">
                  <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M6.5 10L9 12.5L13.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              ) : task.status === "running" ? (
                <LatencyLoader />
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="8.5" stroke="#C4C4C4" strokeWidth="1.5" fill="none" />
                </svg>
              )}
            </div>

            {/* Task title */}
            <span className={cn(
              "flex-1 text-body-2",
              task.status === "pending" && "text-text-subtle"
            )}>
              {task.title}
            </span>

            {/* Tool icons */}
            {task.tools && (
              <div className="flex gap-1">
                {task.tools.map(tool => (
                  <img key={tool} src={getToolIcon(tool)} className="w-4 h-4" alt="" />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlanCard;
