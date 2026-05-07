import React from 'react';

export type CreationTaskStatus = 'done' | 'skipped' | 'active' | 'pending';

export interface CreationTask {
  id: string;
  label: string;
  status: CreationTaskStatus;
}

interface CreationTasksPanelProps {
  tasks: CreationTask[];
  intentType?: 'agent' | 'workflow' | null;
}

export const CreationTasksPanel: React.FC<CreationTasksPanelProps> = ({ tasks, intentType }) => {
  const title = intentType === 'workflow' ? 'Build your workflow' : 'Build your agent';
  if (tasks.length === 0) return null;

  return (
    <div className="w-full">
      {/* Header */}
      <p className="text-title-3 text-gray-900" style={{ fontWeight: 700 }}>{title}</p>

      <div className="mt-8 mb-5" />

      {/* Steps */}
      <div className="space-y-5">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-start gap-3">
            {/* Status icon */}
            {task.status === 'done' || task.status === 'skipped' ? (
              <div className="mt-[5px] w-[18px] h-[18px] rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                  <path d="M1 3.5L3.2 5.75L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            ) : task.status === 'active' ? (
              <div className="mt-[5px] w-[18px] h-[18px] rounded-full border-2 border-[hsl(var(--primary))] flex items-center justify-center flex-shrink-0">
                <div className="w-[8px] h-[8px] rounded-full bg-[hsl(var(--primary))]" />
              </div>
            ) : (
              <div
                className="mt-[5px] flex-shrink-0"
                style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px dashed hsl(var(--text-disabled))' }}
              />
            )}

            {/* Label + sub-description */}
            <div>
              <p className={`text-body-1-strong leading-snug transition-colors duration-300 ${
                task.status === 'active' ? 'text-gray-900' :
                'text-gray-700'
              }`}>
                {task.label}
              </p>
              <p className={`mt-0.5 transition-colors duration-300 ${
                task.status === 'active' ? 'text-caption-1-strong text-[hsl(var(--primary))]' :
                task.status === 'done' || task.status === 'skipped' ? 'text-caption-1-strong text-gray-500' :
                'text-body-3 text-gray-500'
              }`}>
                {task.status === 'done' ? 'Done' :
                 task.status === 'skipped' ? 'Skipped' :
                 task.status === 'active' ? 'In progress' :
                 'Not started'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
