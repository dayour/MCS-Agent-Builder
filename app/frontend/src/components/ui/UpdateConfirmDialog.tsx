import React, { useState } from 'react';
import { CopilotButton } from './CopilotButton';
import { CopilotTextarea } from './CopilotTextarea';
import { ArrowRight20Regular, Dismiss20Regular, Warning20Regular, Flash20Regular } from '@fluentui/react-icons';
import { getConnectorIcon } from '../../utils/agentIcons';
import { TriggerSummary } from './PublishConfirmDialog';
import { getTriggerChannel } from '../../utils/buildPageUtils';

export interface UpdateConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (changeNotes?: string) => void;
  onUnpublish?: () => void;
  agentName: string;
  agentType: 'agent' | 'workflow';
  currentVersion: string;
  newVersion: string;
  lastPublishedAt?: Date;
  channel?: string;
  /** Current triggers parsed from instructions */
  triggers?: TriggerSummary[];
  /** Triggers snapshot from last publish — used to compute NEW/REMOVED badges */
  publishedTriggers?: TriggerSummary[];
  /** Trigger names pending soft-delete — shown with REMOVING badge */
  softDeletedTriggers?: string[];
  buttonRef: React.RefObject<HTMLDivElement | null>;
}

export const UpdateConfirmDialog: React.FC<UpdateConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onUnpublish,
  agentName,
  agentType,
  currentVersion,
  newVersion,
  lastPublishedAt,
  channel,
  triggers,
  publishedTriggers,
  softDeletedTriggers,
  buttonRef
}) => {
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const DIALOG_WIDTH = 400;
  const [changeNotes, setChangeNotes] = useState('');
  const dialogRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const estimatedHeight = 420;
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

  // Pre-populate change notes when dialog opens
  React.useEffect(() => {
    if (isOpen && !changeNotes) {
      const suggestions = [
        'Updated instructions and improved response quality',
        'Enhanced capabilities and refined behavior',
        'Improved instructions for better accuracy',
        'Updated knowledge and refined responses'
      ];
      const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
      setChangeNotes(randomSuggestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        const dialogElement = document.getElementById('update-confirm-dialog');
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

  const handleConfirm = () => {
    onConfirm(changeNotes || undefined);
    setChangeNotes('');
  };

  const handleClose = () => {
    setChangeNotes('');
    onClose();
  };

  if (!isOpen || !position) return null;

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div
      ref={dialogRef}
      id="update-confirm-dialog"
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${DIALOG_WIDTH}px`
      }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">
            Update {agentType === 'workflow' ? 'workflow' : 'agent'}?
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Dismiss20Regular />
          </button>
        </div>

        <div className="space-y-3 mb-4">
          {/* Version Information */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-body-2-strong text-[hsl(var(--secondary-foreground))]">Current version</p>
                <p className="text-sm font-medium text-gray-900">v{currentVersion}</p>
              </div>
              <div className="text-gray-400">
                <ArrowRight20Regular />
              </div>
              <div>
                <p className="text-body-2-strong text-[hsl(var(--secondary-foreground))]">New version</p>
                <p className="text-sm font-medium text-blue-600">v{newVersion}</p>
              </div>
            </div>
            {lastPublishedAt && (
              <p className="text-xs text-gray-500">
                Last published {formatDate(lastPublishedAt)}
              </p>
            )}
          </div>

          {/* Trigger diff */}
          {(() => {
            const currentTriggers = triggers ?? [];
            const prevTriggers = publishedTriggers ?? [];
            const publishedLabels = new Set(prevTriggers.map(t => t.label));
            const currentLabels = new Set(currentTriggers.map(t => t.label));
            const removedTriggers = prevTriggers.filter(t => !currentLabels.has(t.label));
            // Show section if there are any current or removed triggers
            if (currentTriggers.length === 0 && removedTriggers.length === 0) return null;
            return (
              <div>
                <p className="text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">
                  {currentTriggers.length > 0 ? 'Your agent will run when:' : 'Triggers removed:'}
                </p>
                <div className="space-y-1.5">
                  {currentTriggers.map((t, i) => {
                    const isNew = !publishedLabels.has(t.label);
                    const isSoftDeleted = (softDeletedTriggers ?? []).some(sd => {
                      const sdCh = getTriggerChannel(sd);
                      const tCh = getTriggerChannel(t.label) || t.iconKey;
                      return sdCh && tCh && sdCh === tCh;
                    });
                    if (isSoftDeleted) {
                      return (
                        <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-red-200 bg-red-50 opacity-60">
                          {getConnectorIcon(t.iconKey, 'w-5 h-5') || <Flash20Regular style={{ width: 20, height: 20, color: 'hsl(var(--text-secondary))' }} />}
                          <span className="text-sm text-gray-500 flex-1 line-through">{t.label}</span>
                          <span className="text-xs font-medium text-red-700 bg-red-100 px-1.5 py-0.5 rounded">REMOVING</span>
                        </div>
                      );
                    }
                    return (
                      <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${isNew ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                        {getConnectorIcon(t.iconKey, 'w-5 h-5') || <Flash20Regular style={{ width: 20, height: 20, color: 'hsl(var(--text-secondary))' }} />}
                        <span className="text-sm text-gray-900 flex-1">{t.label}</span>
                        {isNew && <span className="text-xs font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded">NEW</span>}
                      </div>
                    );
                  })}
                  {removedTriggers.map((t, i) => (
                    <div key={`rm-${i}`} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-red-200 bg-red-50 opacity-60">
                      {getConnectorIcon(t.iconKey, 'w-5 h-5') || <Flash20Regular style={{ width: 20, height: 20, color: 'hsl(var(--text-secondary))' }} />}
                      <span className="text-sm text-gray-500 flex-1 line-through">{t.label}</span>
                      <span className="text-xs font-medium text-red-700 bg-red-100 px-1.5 py-0.5 rounded">REMOVED</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Change Notes */}
          <div>
            <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">
              What changed?
            </label>
            <CopilotTextarea
              value={changeNotes}
              onChange={(e) => setChangeNotes(e.target.value)}
              placeholder="e.g., Updated instructions, added new capabilities..."
              rows={3}
              size="sm"
            />
          </div>

          {/* Impact Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <div className="text-amber-600 mt-0.5">
                <Warning20Regular />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-900 mb-1">Updates are immediate</p>
                <p className="text-xs text-amber-800">
                  Changes will be live instantly for all users
                  {channel && ` on ${channel}`}. Make sure you've tested your updates.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-between">
          {onUnpublish && (
            <CopilotButton
              variant="secondary"
              size="sm"
              onClick={() => {
                onUnpublish();
                handleClose();
              }}
            >
              Unpublish
            </CopilotButton>
          )}
          <div className="flex gap-2 ml-auto">
            <CopilotButton
              variant="secondary"
              size="sm"
              onClick={handleClose}
            >
              Cancel
            </CopilotButton>
            <CopilotButton
              variant="primary"
              size="sm"
              onClick={handleConfirm}
            >
              Update
            </CopilotButton>
          </div>
        </div>
      </div>
    </div>
  );
};
