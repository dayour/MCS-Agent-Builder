import React from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from './Dialog';
import { CopilotButton } from './CopilotButton';
import { Delete20Regular, Dismiss20Regular } from '@fluentui/react-icons';

export interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  itemName?: string;
  itemType?: 'agent' | 'workflow' | 'all';
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
  itemType = 'agent',
}) => {
  const defaultTitle = itemType === 'all'
    ? 'Delete all agents and workflows?'
    : `Delete "${itemName}"?`;

  const defaultMessage = itemType === 'all'
    ? 'This will permanently delete all agents and workflows. This action cannot be undone.'
    : `Are you sure you want to delete this ${itemType}? This action cannot be undone.`;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} maxWidth="md">
      <DialogHeader onClose={onClose}>
        <DialogTitle>{title || defaultTitle}</DialogTitle>
      </DialogHeader>

      <DialogContent>
        <p className="text-body-1 text-text-secondary">
          {message || defaultMessage}
        </p>
      </DialogContent>

      <DialogFooter>
        <CopilotButton
          variant="secondary"
          onClick={onClose}
          icon={<Dismiss20Regular />}
        >
          Cancel
        </CopilotButton>
        <CopilotButton
          variant="primary"
          onClick={handleConfirm}
          icon={<Delete20Regular />}
          className="bg-red-600 hover:bg-red-700 active:bg-red-800"
        >
          Delete
        </CopilotButton>
      </DialogFooter>
    </Dialog>
  );
};

export default DeleteConfirmDialog;
