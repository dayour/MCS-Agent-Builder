import React from 'react';
import { TaskListLtr20Regular, CheckmarkCircle20Filled } from '@fluentui/react-icons';
import { CopilotButton } from './CopilotButton';

// Map connector names to icon paths
const CONNECTOR_ICON: Record<string, string> = {
  teams:       '/component-icons/Teams24.svg',
  outlook:     '/component-icons/Outlook24.svg',
  sharepoint:  '/component-icons/SharePoint24.svg',
  excel:       '/component-icons/Excel24.svg',
  onedrive:    '/component-icons/OneDrive24.svg',
  planner:     '/component-icons/Planner24.svg',
  word:        '/component-icons/Word24.svg',
  slack:       '/component-icons/Slack24.svg',
  forms:       '/component-icons/Forms24.svg',
  salesforce:  '/component-icons/Salesforce24.svg',
  dataverse:   '/component-icons/Dataverse24.svg',
};

export interface DwTaskListTask {
  name: string;
  subtitle?: string;
  status: 'running' | 'complete' | 'pending' | 'upcoming';
  connectors?: string[];
  time?: string;
}

export interface DwTaskListCardProps {
  tasks: DwTaskListTask[];
  onOpenInStudio?: () => void;
}

/** Status indicator dot/icon for each task status */
const StatusIndicator: React.FC<{ status: DwTaskListTask['status'] }> = ({ status }) => {
  switch (status) {
    case 'complete':
      return <CheckmarkCircle20Filled className="w-5 h-5 flex-shrink-0 text-green-600" />;
    case 'running':
      return (
        <span className="relative flex h-3 w-3 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
        </span>
      );
    case 'pending':
    case 'upcoming':
    default:
      return (
        <span className="w-3 h-3 rounded-full bg-gray-300 flex-shrink-0" />
      );
  }
};

export const DwTaskListCard: React.FC<DwTaskListCardProps> = ({
  tasks,
  onOpenInStudio,
}) => {
  return (
    <div className="max-w-[400px] rounded-2xl border border-[hsl(var(--stroke-default))] bg-white p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <TaskListLtr20Regular className="w-5 h-5 flex-shrink-0 text-amber-600" />
        <span className="text-sm font-semibold text-gray-900">Tasks</span>
      </div>

      {/* Task list */}
      <div className="flex flex-col">
        {tasks.map((task, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <div className="border-t border-[hsl(var(--surface-quaternary))] my-0.5" />}
            <div className="flex items-center gap-3 py-2">
              {/* Status indicator */}
              <div className="flex items-center justify-center w-5 h-5">
                <StatusIndicator status={task.status} />
              </div>

              {/* Task info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{task.name}</p>
                {task.subtitle && (
                  <p className="text-xs text-[hsl(var(--text-disabled))] truncate">{task.subtitle}</p>
                )}
              </div>

              {/* Right side: connectors + time */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {task.connectors?.map((connector) => {
                  const iconPath = CONNECTOR_ICON[connector.toLowerCase()];
                  if (!iconPath) return null;
                  return (
                    <img
                      key={connector}
                      src={iconPath}
                      alt={connector}
                      className="w-4 h-4"
                    />
                  );
                })}
                {task.time && (
                  <span className="text-xs text-[hsl(var(--text-disabled))] whitespace-nowrap ml-1">{task.time}</span>
                )}
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* CTA */}
      {onOpenInStudio && (
        <div className="mt-3">
          <CopilotButton variant="outline" size="sm" onClick={onOpenInStudio}>
            Open in Copilot Studio
          </CopilotButton>
        </div>
      )}
    </div>
  );
};
