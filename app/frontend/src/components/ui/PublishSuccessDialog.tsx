import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { useAgent } from '../../context/AgentContext';
import { CopilotButton } from './CopilotButton';
import { CopilotInput } from './CopilotInput';
import { Dismiss20Regular, Checkmark20Regular, Copy20Regular, People20Regular, LockClosed20Regular, Globe20Regular, CheckmarkCircle24Filled } from '@fluentui/react-icons';

export interface PublishSuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
  agentType: 'agent' | 'workflow';
  shareUrl: string;
  /** When true, hides share link and people with access (conversational triggers use distribution instead). */
  hasConversationalTriggers?: boolean;
  buttonRef: React.RefObject<HTMLDivElement | null>;
}

export const PublishSuccessDialog: React.FC<PublishSuccessDialogProps> = ({
  isOpen,
  onClose,
  agentName,
  agentType,
  shareUrl,
  hasConversationalTriggers,
  buttonRef
}) => {
  const [position, setPosition] = React.useState<{ top: number; right: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const { addToast } = useToast();
  const { isNewNotifications } = useAgent();
  const [accessLevel, setAccessLevel] = useState<'anyone' | 'anyone-with-link' | 'restricted'>('anyone-with-link');

  React.useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8, // 8px gap below button
        right: window.innerWidth - rect.right // right-align with button
      });
    }
  }, [isOpen, buttonRef]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        const dialogElement = document.getElementById('publish-success-dialog');
        if (dialogElement && !dialogElement.contains(event.target as Node)) {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose, buttonRef]);

  // Reset copied state when dialog closes
  React.useEffect(() => {
    if (!isOpen) {
      setCopied(false);
    }
  }, [isOpen]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      if (isNewNotifications) addToast({ variant: 'error', title: 'Copy failed', message: 'Could not copy link to clipboard.' });
    }
  };

  if (!isOpen || !position) return null;

  return (
    <div
      id="publish-success-dialog"
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200"
      style={{
        top: `${position.top}px`,
        right: `${position.right}px`,
        width: '380px'
      }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckmarkCircle24Filled className="text-green-600" />
            <h3 className="text-base font-semibold text-gray-900">
              {agentType === 'workflow' ? 'Workflow' : 'Agent'} published
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Dismiss20Regular />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          {hasConversationalTriggers
            ? `Your ${agentType === 'workflow' ? 'workflow' : 'agent'} is now live. Configure distribution in the trigger settings to make it available to users.`
            : `Your ${agentType === 'workflow' ? 'workflow' : 'agent'} is now live and ready to share.`}
        </p>

        {!hasConversationalTriggers && (
        <div className="space-y-4 mb-4">
          {/* Share Link Section */}
          <div>
            <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-2">
              Share link
            </label>
            <div className="flex items-stretch gap-2">
              <div className="flex-1">
                <CopilotInput
                  value={shareUrl}
                  onChange={() => {}}
                  readOnly
                  size="sm"
                  className="font-mono text-xs"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
              </div>
              <CopilotButton
                variant="secondary"
                size="sm"
                onClick={handleCopyLink}
                icon={copied ? <Checkmark20Regular /> : <Copy20Regular />}
              >
                {copied ? 'Copied' : 'Copy'}
              </CopilotButton>
            </div>
          </div>

          {/* Permissions Section */}
          <div>
            <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-3">
              People with access
            </label>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Anyone */}
              <label className="flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="access"
                  value="anyone"
                  checked={accessLevel === 'anyone'}
                  onChange={(e) => setAccessLevel(e.target.value as any)}
                  className="mt-0.5 w-4 h-4 text-brand-purple focus:ring-brand-purple"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <People20Regular className="text-gray-600" />
                    <span className="text-sm font-medium text-gray-900">Anyone</span>
                  </div>
                  <p className="text-xs text-gray-500">Anyone can discover and access this {agentType}</p>
                </div>
              </label>

              {/* Separator */}
              <div className="border-t border-gray-200" />

              {/* Anyone with the link */}
              <label className="flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="access"
                  value="anyone-with-link"
                  checked={accessLevel === 'anyone-with-link'}
                  onChange={(e) => setAccessLevel(e.target.value as any)}
                  className="mt-0.5 w-4 h-4 text-brand-purple focus:ring-brand-purple"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Globe20Regular className="text-gray-600" />
                    <span className="text-sm font-medium text-gray-900">Anyone with the link</span>
                  </div>
                  <p className="text-xs text-gray-500">Anyone with this link can view and use this {agentType}</p>
                </div>
              </label>

              {/* Separator */}
              <div className="border-t border-gray-200" />

              {/* Restricted */}
              <label className="flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="access"
                  value="restricted"
                  checked={accessLevel === 'restricted'}
                  onChange={(e) => setAccessLevel(e.target.value as any)}
                  className="mt-0.5 w-4 h-4 text-brand-purple focus:ring-brand-purple"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <LockClosed20Regular className="text-gray-600" />
                    <span className="text-sm font-medium text-gray-900">Restricted</span>
                  </div>
                  <p className="text-xs text-gray-500">Only people you specify can access</p>
                </div>
              </label>
            </div>
          </div>
        </div>
        )}

        <div className="flex gap-2 justify-end">
          <CopilotButton
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Done
          </CopilotButton>
        </div>
      </div>
    </div>
  );
};
