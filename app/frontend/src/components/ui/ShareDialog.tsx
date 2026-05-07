import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { useAgent } from '../../context/AgentContext';
import { CopilotButton } from './CopilotButton';
import { CopilotInput } from './CopilotInput';
import { Dismiss20Regular, Link20Regular, Edit20Regular, PersonCircle20Regular } from '@fluentui/react-icons';

export interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
  shareUrl: string;
  buttonRef: React.RefObject<HTMLDivElement | null>;
}

interface ShareUser {
  email: string;
  role: 'Owner' | 'Editor' | 'Viewer';
}

export const ShareDialog: React.FC<ShareDialogProps> = ({
  isOpen,
  onClose,
  agentName,
  shareUrl,
  buttonRef
}) => {
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const DIALOG_WIDTH = 420;
  const [addInput, setAddInput] = useState('');
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const { userName } = useAgent();
  const { addToast } = useToast();

  const [users] = useState<ShareUser[]>([
    { email: '', role: 'Owner' },
  ]);

  const displayName = userName || 'You';

  React.useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const estimatedHeight = 340;
      const gap = 8;
      const margin = 16;
      const topBelow = rect.bottom + gap;
      const fitsBelow = topBelow + estimatedHeight <= viewportHeight - margin;
      const left = Math.max(margin, Math.min(rect.left, viewportWidth - DIALOG_WIDTH - margin));
      setPosition({
        top: fitsBelow ? topBelow : Math.max(margin, rect.top - estimatedHeight - gap),
        left,
      });
    }
  }, [isOpen, buttonRef]);

  React.useLayoutEffect(() => {
    if (isOpen && position && dialogRef.current && buttonRef.current) {
      const dialogHeight = dialogRef.current.getBoundingClientRect().height;
      const viewportHeight = window.innerHeight;
      if (position.top + dialogHeight > viewportHeight - 16) {
        const rect = buttonRef.current.getBoundingClientRect();
        setPosition(prev => prev ? {
          ...prev,
          top: Math.max(16, rect.top - dialogHeight - 8)
        } : prev);
      }
    }
  }, [isOpen, position, buttonRef]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        const dialogElement = document.getElementById('share-dialog');
        if (dialogElement && !dialogElement.contains(event.target as Node)) {
          onClose();
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, buttonRef]);

  const handleCopyChatLink = async () => {
    try {
      await navigator.clipboard.writeText(`${shareUrl}?mode=chat`);
    } catch {
      addToast({ variant: 'error', title: 'Copy failed', message: 'Could not copy link to clipboard.' });
    }
  };

  const handleCopyEditLink = async () => {
    try {
      await navigator.clipboard.writeText(`${shareUrl}?mode=edit`);
    } catch {
      addToast({ variant: 'error', title: 'Copy failed', message: 'Could not copy link to clipboard.' });
    }
  };

  if (!isOpen || !position) return null;

  return (
    <div
      ref={dialogRef}
      id="share-dialog"
      className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${DIALOG_WIDTH}px`
      }}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">
            Share &ldquo;{agentName}&rdquo;
          </h3>
          <CopilotButton variant="transparent" size="sm" icon={<Dismiss20Regular />} aria-label="Close" onClick={onClose} />
        </div>

        {/* Add people input */}
        <div className="mb-4">
          <CopilotInput
            value={addInput}
            onChange={e => setAddInput(e.target.value)}
            placeholder="Add name, group or email (coming soon)"
            size="md"
            disabled
          />
        </div>

        {/* Users with access */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
            People with access
          </label>
          <div className="space-y-1">
            {users.map((user) => (
              <div key={user.email || displayName} className="flex items-center justify-between py-2 px-1">
                <div className="flex items-center gap-2.5">
                  <PersonCircle20Regular className="text-gray-400 w-6 h-6" />
                  <span className="text-sm text-gray-900">{user.role === 'Owner' ? displayName : user.email}</span>
                </div>
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {user.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <CopilotButton
            variant="primary"
            size="sm"
            icon={<Link20Regular />}
            onClick={handleCopyChatLink}
          >
            Copy chat link
          </CopilotButton>
          <CopilotButton
            variant="secondary"
            size="sm"
            icon={<Edit20Regular />}
            onClick={handleCopyEditLink}
          >
            Copy edit link
          </CopilotButton>
          <div className="flex-1" />
          <CopilotButton
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Cancel
          </CopilotButton>
        </div>
      </div>
    </div>
  );
};
