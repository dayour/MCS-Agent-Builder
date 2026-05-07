import React from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from './Dialog';
import { CopilotButton } from './CopilotButton';

export interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDiscard: () => void;
  onSaveAndLeave: () => void;
}

export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  isOpen,
  onClose,
  onDiscard,
  onSaveAndLeave,
}) => (
  <Dialog isOpen={isOpen} onClose={onClose} maxWidth="md">
    <DialogHeader onClose={onClose}>
      <DialogTitle>Unsaved changes</DialogTitle>
    </DialogHeader>

    <DialogContent>
      <p className="text-body-1 text-text-secondary">
        You have unsaved changes. Do you want to save before leaving?
      </p>
    </DialogContent>

    <DialogFooter>
      <CopilotButton variant="secondary" onClick={onClose}>
        Cancel
      </CopilotButton>
      <CopilotButton variant="outline" onClick={onDiscard}>
        Discard
      </CopilotButton>
      <CopilotButton variant="primary" onClick={onSaveAndLeave}>
        Save and leave
      </CopilotButton>
    </DialogFooter>
  </Dialog>
);
