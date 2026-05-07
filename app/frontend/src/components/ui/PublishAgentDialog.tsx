import React, { useState, useEffect } from 'react';
import { Dialog, DialogHeader, DialogFooter, DialogTitle } from './Dialog';
import { CopilotButton } from './CopilotButton';
import { CopilotTextarea } from './CopilotTextarea';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PublishAgentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the description text when the user confirms */
  onConfirm: (description: string) => void;
  agentName: string;
  /** Integer version string — e.g. "1", "2", "3" — displayed as "v1", "v2", etc. */
  version: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PublishAgentDialog({
  isOpen,
  onClose,
  onConfirm,
  agentName,
  version,
}: PublishAgentDialogProps) {
  const [description, setDescription] = useState('');

  // Reset description each time the dialog opens
  useEffect(() => {
    if (isOpen) setDescription('');
  }, [isOpen]);

  const handleConfirm = () => {
    onConfirm(description);
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} maxWidth="lg">
      <DialogHeader onClose={onClose}>
        <DialogTitle>
          Publish {agentName}
        </DialogTitle>
      </DialogHeader>

      <div className="px-6 pb-4">
        {/* Subtitle */}
        <p className="text-sm text-[var(--colorNeutralForeground3)] mb-6">
          Your current draft will become the live version and be available for others to use
        </p>

        {/* Metadata rows */}
        <div className="space-y-4 mb-6">
          {/* Version */}
          <div className="flex items-start gap-6">
            <span className="text-sm font-semibold text-[var(--colorNeutralForeground1)] w-28 flex-shrink-0 pt-0.5">
              Version
            </span>
            <span className="text-sm text-[var(--colorNeutralForeground1)]">
              v{version}
            </span>
          </div>

          {/* Available in */}
          <div className="flex items-start gap-6">
            <span className="text-sm font-semibold text-[var(--colorNeutralForeground1)] w-28 flex-shrink-0 pt-0.5">
              Available in
            </span>
            <div className="space-y-2.5">
              <div className="text-sm text-[var(--colorNeutralForeground1)]">Microsoft 365 Copilot</div>
              <div className="text-sm text-[var(--colorNeutralForeground1)]">Microsoft Teams</div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <p className="text-sm font-semibold text-[var(--colorNeutralForeground1)] mb-2">Description</p>
          <CopilotTextarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Add a description of what changed in this version..."
            rows={4}
            size="md"
            className="w-full"
          />
        </div>
      </div>

      <DialogFooter>
        <CopilotButton variant="secondary" size="md" onClick={onClose}>
          Cancel
        </CopilotButton>
        <CopilotButton variant="primary" size="md" onClick={handleConfirm}>
          Publish v{version}
        </CopilotButton>
      </DialogFooter>
    </Dialog>
  );
}

export default PublishAgentDialog;
