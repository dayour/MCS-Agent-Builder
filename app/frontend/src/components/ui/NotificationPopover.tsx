import React, { useEffect, useRef } from 'react';
import { Dismiss20Regular, AlertOff20Regular } from '@fluentui/react-icons';
import { useToast, NotificationRecord, ToastVariant } from '../../context/ToastContext';
import { VariantIcon } from './CopilotToast';
import { CopilotButton } from './CopilotButton';

export interface NotificationPopoverProps {
  /** Bounding rect of the bell button — used to position the popover. */
  anchorRect: DOMRect | null;
  onClose: () => void;
  /** When provided, only shows notifications for this agent and marks them read on open. */
  agentId?: string;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const variantBg: Record<ToastVariant, string> = {
  success:  'bg-green-50',
  error:    'bg-red-50',
  warning:  'bg-amber-50',
  info:     'bg-blue-50',
  progress: 'bg-blue-50',
};

const NotificationItem: React.FC<{ notification: NotificationRecord; onAction?: () => void }> = ({ notification, onAction }) => (
  <div className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-l-2 ${notification.isRead ? 'border-transparent' : 'border-blue-500'}`}>
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${variantBg[notification.variant]}`}>
      <VariantIcon variant={notification.variant} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 leading-snug">{notification.title}</p>
      {notification.message && (
        <p className="text-xs text-gray-500 mt-0.5 leading-snug">{notification.message}</p>
      )}
      <div className="flex items-center gap-3 mt-1">
        <p className="text-xs text-gray-400">{timeAgo(notification.timestamp)}</p>
        {notification.action && (
          <CopilotButton
            variant="transparent"
            size="sm"
            className="!text-xs !font-medium !text-blue-600 hover:!text-blue-700 !p-0 !h-auto"
            onClick={() => { notification.action!.onClick(); onAction?.(); }}
          >
            {notification.action.label}
          </CopilotButton>
        )}
      </div>
    </div>
    {!notification.isRead && (
      <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
    )}
  </div>
);

export const NotificationPopover: React.FC<NotificationPopoverProps> = ({ anchorRect, onClose, agentId }) => {
  const { notifications, clearNotifications, markAgentRead } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);

  // Mark agent notifications as read when popover opens.
  // markAgentRead is stable (wrapped in useCallback in ToastContext).
  useEffect(() => {
    if (agentId) markAgentRead(agentId);
  }, [agentId, markAgentRead]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const visibleNotifications = agentId
    ? notifications.filter(n => n.agentId === agentId)
    : notifications;

  const PANEL_WIDTH = 320;
  const PANEL_MAX_HEIGHT = Math.round(window.innerHeight * 0.75);
  const top = anchorRect ? Math.min(anchorRect.bottom + 8, window.innerHeight - PANEL_MAX_HEIGHT - 8) : 80;
  const left = anchorRect ? Math.max(8, anchorRect.right - PANEL_WIDTH) : 72;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      className="fixed z-[60] bg-white rounded-xl border border-gray-200 flex flex-col animate-popover-in origin-top-right"
      style={{
        top,
        left,
        width: PANEL_WIDTH,
        maxHeight: PANEL_MAX_HEIGHT,
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <span className="text-sm font-semibold text-gray-900">Notifications</span>
        <div className="flex items-center gap-1">
          {visibleNotifications.length > 0 && (
            <CopilotButton variant="ghost" size="sm" onClick={agentId ? () => markAgentRead(agentId) : clearNotifications}>
              Clear all
            </CopilotButton>
          )}
          <CopilotButton variant="ghost" size="sm" onClick={onClose} aria-label="Close notifications">
            <Dismiss20Regular className="w-4 h-4" />
          </CopilotButton>
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1">
        {visibleNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
            <AlertOff20Regular className="w-8 h-8" />
            <p className="text-sm">All caught up</p>
          </div>
        ) : (
          <div className="py-1">
            {visibleNotifications.map(n => (
              <NotificationItem key={n.id} notification={n} onAction={onClose} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
