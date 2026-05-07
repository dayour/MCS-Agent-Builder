import React from 'react';
import { ClipboardTextLtr20Regular } from '@fluentui/react-icons';
import { CopilotButton } from './CopilotButton';

export interface DwSkillCardProps {
  name: string;
  description: string;
  capabilities: string[];
  optimizedFor?: string;
  onViewInSkills?: () => void;
}

export const DwSkillCard: React.FC<DwSkillCardProps> = ({
  name,
  description,
  capabilities,
  optimizedFor,
  onViewInSkills,
}) => {
  return (
    <div className="max-w-[400px] rounded-2xl border border-[hsl(var(--stroke-default))] bg-white p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <ClipboardTextLtr20Regular className="w-5 h-5 flex-shrink-0 text-purple-600" />
        <span className="text-sm font-semibold text-gray-900">{name}</span>
      </div>

      {/* Description */}
      <p className="text-xs font-semibold text-gray-700 mb-1">Description</p>
      <p className="text-sm text-[hsl(var(--text-secondary))] leading-relaxed mb-3">{description}</p>

      {/* Capabilities */}
      {capabilities.length > 0 && (
        <ul className="mb-3 space-y-1.5 pl-4">
          {capabilities.map((cap, idx) => (
            <li key={idx} className="text-sm text-[hsl(var(--text-secondary))] leading-relaxed list-disc">
              {cap}
            </li>
          ))}
        </ul>
      )}

      {/* Optimized for */}
      {optimizedFor && (
        <p className="text-xs text-[hsl(var(--text-disabled))] italic mb-4">{optimizedFor}</p>
      )}

      {/* CTA */}
      {onViewInSkills && (
        <CopilotButton variant="outline" size="sm" onClick={onViewInSkills}>
          View in skills
        </CopilotButton>
      )}
    </div>
  );
};
