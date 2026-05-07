import React from 'react';
import { ClipboardTextLtr20Regular, Clock20Regular, Timer20Regular } from '@fluentui/react-icons';
import { CopilotButton } from './CopilotButton';

export interface DwTaskCardProps {
  name: string;
  description: string;
  bullets?: string[];
  recurrence?: string;
  timeSaved?: string;
  onManageTask?: () => void;
}

export const DwTaskCard: React.FC<DwTaskCardProps> = ({
  name,
  description,
  bullets,
  recurrence,
  timeSaved,
  onManageTask,
}) => {
  const hasMetadata = recurrence || timeSaved;

  return (
    <div className="max-w-[400px] rounded-2xl border border-[hsl(var(--stroke-default))] bg-white p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <ClipboardTextLtr20Regular className="w-5 h-5 flex-shrink-0 text-blue-600" />
        <span className="text-sm font-semibold text-gray-900">{name}</span>
      </div>

      {/* Description */}
      <p className="text-sm text-[hsl(var(--text-secondary))] leading-relaxed mb-3">{description}</p>

      {/* Bullet list */}
      {bullets && bullets.length > 0 && (
        <ul className="mb-3 space-y-1.5 pl-4">
          {bullets.map((bullet, idx) => (
            <li key={idx} className="text-sm text-[hsl(var(--text-secondary))] leading-relaxed list-disc">
              {bullet}
            </li>
          ))}
        </ul>
      )}

      {/* Divider + metadata */}
      {hasMetadata && (
        <>
          <div className="border-t border-[hsl(var(--stroke-default))] my-3" />

          {recurrence && (
            <div className="flex items-center gap-2 mb-2">
              <Clock20Regular className="w-4 h-4 flex-shrink-0 text-gray-500" />
              <span className="text-xs text-gray-700">
                <span className="font-semibold">Recurrence:</span>{' '}
                <span className="text-[hsl(var(--text-secondary))]">{recurrence}</span>
              </span>
            </div>
          )}

          {timeSaved && (
            <div className="flex items-center gap-2 mb-3">
              <Timer20Regular className="w-4 h-4 flex-shrink-0 text-gray-500" />
              <span className="text-xs text-gray-700">
                <span className="font-semibold">Time saved:</span>{' '}
                <span className="text-[hsl(var(--text-secondary))]">approximately {timeSaved}</span>
              </span>
            </div>
          )}
        </>
      )}

      {/* CTA */}
      {onManageTask && (
        <CopilotButton variant="outline" size="sm" onClick={onManageTask}>
          Manage task
        </CopilotButton>
      )}
    </div>
  );
};
