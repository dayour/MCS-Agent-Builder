import React from 'react';
import { ClipboardTextLtr20Regular, TargetArrow20Regular } from '@fluentui/react-icons';
import { CopilotButton } from './CopilotButton';

// Default color cycle for responsibility indicators
const DEFAULT_COLORS = ['#16a34a', '#2563eb', '#9333ea', '#ea580c', '#0d9488', '#ec4899'];

export interface DwInstructionsCardProps {
  title?: string;
  role: string;
  responsibilities: Array<{ text: string; color?: string }>;
  goal: string;
  onViewDetails?: () => void;
}

export const DwInstructionsCard: React.FC<DwInstructionsCardProps> = ({
  title = 'Instructions',
  role,
  responsibilities,
  goal,
  onViewDetails,
}) => {
  return (
    <div className="max-w-[400px] rounded-2xl border border-[hsl(var(--stroke-default))] bg-white p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <ClipboardTextLtr20Regular className="w-5 h-5 flex-shrink-0 text-green-600" />
        <span className="text-sm font-semibold text-gray-900">{title}</span>
      </div>

      {/* Role description */}
      <p className="text-sm text-[hsl(var(--text-secondary))] leading-relaxed mb-4">{role}</p>

      {/* Responsibilities */}
      <p className="text-xs font-semibold text-gray-700 mb-2">My responsibilities include:</p>
      <div className="flex flex-col gap-2 mb-4">
        {responsibilities.map((item, idx) => {
          const color = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
          return (
            <div key={idx} className="flex items-start gap-2.5">
              <span
                className="w-2 h-2 rounded-sm flex-shrink-0 mt-[5px]"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm text-[hsl(var(--text-secondary))] leading-relaxed">{item.text}</span>
            </div>
          );
        })}
      </div>

      {/* Goal */}
      <div className="flex items-start gap-2 mb-4">
        <TargetArrow20Regular className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-500" />
        <div>
          <span className="text-xs font-semibold text-gray-700">Goal: </span>
          <span className="text-sm text-[hsl(var(--text-secondary))] leading-relaxed">{goal}</span>
        </div>
      </div>

      {/* CTA */}
      {onViewDetails && (
        <CopilotButton variant="outline" size="sm" onClick={onViewDetails}>
          View full details
        </CopilotButton>
      )}
    </div>
  );
};
