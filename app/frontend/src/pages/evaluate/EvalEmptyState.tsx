import React from 'react';
import { Beaker20Regular, Add20Regular } from '@fluentui/react-icons';
import { CopilotButton } from '../../components/ui/CopilotButton';

interface EvalEmptyStateProps {
  isNarrowPreview: boolean;
  onCreateClick: () => void;
}

export const EvalEmptyState: React.FC<EvalEmptyStateProps> = ({ isNarrowPreview, onCreateClick }) => {
  return (
    <div className={`h-full flex flex-col ${isNarrowPreview ? 'bg-[hsl(var(--surface-secondary))]' : 'bg-[hsl(var(--background))]'}`}>
      <div className="flex-1 flex flex-col items-center justify-center gap-5 pb-24 px-8">
        {/* Illustration */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[hsl(var(--brand-background))] opacity-50" />
          <Beaker20Regular className="w-10 h-10 text-[hsl(var(--primary))] relative z-10" />
        </div>

        {/* Text */}
        <div className="flex flex-col items-center gap-2 text-center max-w-md">
          <h2 className="text-xl font-semibold text-gray-900">Evaluate your agent</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Create an eval suite to test your agent's safety, quality, and edge-case handling.
            Tests are organized into three buckets with pass/fail thresholds that determine
            whether your agent is ready to ship.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3">
          <CopilotButton
            variant="primary"
            size="md"
            icon={<Add20Regular />}
            onClick={onCreateClick}
          >
            Create eval suite
          </CopilotButton>
          <p className="text-xs text-gray-400">
            Or use <span className="font-mono">/mcs-research</span> to auto-generate evals from your agent spec
          </p>
        </div>
      </div>
    </div>
  );
};
