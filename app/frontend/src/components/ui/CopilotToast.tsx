import React, { useEffect, useState } from 'react';
import {
  CheckmarkCircle20Filled,
  ErrorCircle20Filled,
  Warning20Filled,
  Info20Filled,
  Dismiss20Regular,
} from '@fluentui/react-icons';
import { ToastItem, ToastVariant, useToast } from '../../context/ToastContext';
import { CopilotButton } from './CopilotButton';

// Fluent 2 intent colors — light mode (matches colorStatus* design tokens)
const iconColor: Record<ToastVariant, string> = {
  success:  'text-[hsl(var(--status-success))]',
  error:    'text-[hsl(var(--status-error))]',
  warning:  'text-[#F7630C]',
  info:     'text-[#0078D4]',
  progress: 'text-[#0078D4]',
};

// Dark mode icon colors — reserved for future dark theme
// const iconColorDark: Record<ToastVariant, string> = {
//   success:  'text-[#54B054]',
//   error:    'text-[#DC626D]',
//   warning:  'text-[#D6D6D6]',
//   info:     'text-[#479EF5]',
//   progress: 'text-[#479EF5]',
// };

export const VariantIcon: React.FC<{ variant: ToastVariant; progress?: number }> = ({ variant, progress }) => {
  const cls = `w-5 h-5 flex-shrink-0 ${iconColor[variant]}`;
  switch (variant) {
    case 'success':  return <CheckmarkCircle20Filled className={cls} />;
    case 'error':    return <ErrorCircle20Filled className={cls} />;
    case 'warning':  return <Warning20Filled className={cls} />;
    case 'info':     return <Info20Filled className={cls} />;
    case 'progress':
      if (typeof progress === 'number' && progress >= 100) {
        return <CheckmarkCircle20Filled className={cls} />;
      }
      return (
        <span className={`w-5 h-5 flex-shrink-0 flex items-center justify-center ${iconColor.progress}`}>
          <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin block" />
        </span>
      );
  }
};

export interface CopilotToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

export const CopilotToast: React.FC<CopilotToastProps> = ({ toast, onDismiss }) => {
  const [exiting, setExiting] = useState(false);

  const dismiss = () => setExiting(true);

  const isProgress = toast.variant === 'progress';
  const isIndeterminate = isProgress && typeof toast.progress !== 'number';
  const isComplete = isProgress && typeof toast.progress === 'number' && toast.progress >= 100;
  // Hide dismiss while progress is actively running (not yet complete)
  const hideDismiss = isProgress && !isComplete;

  // Auto-dismiss: progress toasts auto-dismiss 2s after reaching 100%, others use duration
  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => setExiting(true), 2000);
      return () => clearTimeout(timer);
    }
    if (isProgress && !isComplete) return; // persist while in progress
    const duration = toast.duration ?? 4000;
    if (duration === 0) return;
    const timer = setTimeout(() => setExiting(true), duration);
    return () => clearTimeout(timer);
  }, [toast.duration, isProgress, isComplete]);

  const handleAnimationEnd = () => {
    if (exiting) onDismiss(toast.id);
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      onAnimationEnd={handleAnimationEnd}
      className={[
        'flex flex-col w-80 rounded-xl bg-white',
        // dark mode: 'flex flex-col w-80 rounded-xl bg-[#292929] shadow-[0_8px_16px_rgba(0,0,0,0.24),0_0_2px_rgba(0,0,0,0.2)]'
        'shadow-[0_4px_8px_rgba(0,0,0,0.14),0_0_2px_rgba(0,0,0,0.12)]',
        'border border-[hsl(var(--stroke-default))]',
        'overflow-hidden',
        exiting ? 'animate-slide-out-right' : 'animate-slide-in-right',
      ].join(' ')}
    >
      {/* ToastTitle row: icon + title + action slot + dismiss */}
      <div className="flex items-start gap-2.5 px-3 pt-3 pb-1">
        <VariantIcon variant={toast.variant} progress={toast.progress} />

        {/* Title + action slot (right-aligned per Fluent ToastTitle anatomy) */}
        <div className="flex items-start justify-between gap-2 flex-1 min-w-0">
          {/* dark mode: text-white */}
          <p className="text-sm font-semibold leading-snug text-[hsl(var(--text-primary))] flex-1 min-w-0">
            {toast.title}
          </p>
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Action — ToastTitle action slot, dark mode: text-[#479EF5] */}
            {toast.action && (
              <CopilotButton
                variant="transparent"
                size="sm"
                onClick={() => { toast.action!.onClick(); dismiss(); }}
                className="!text-xs !font-semibold !text-[#0078D4] hover:!text-[#106EBE] !p-0 !h-auto whitespace-nowrap"
              >
                {toast.action.label}
              </CopilotButton>
            )}
            {/* Dismiss — hidden while progress is running, dark mode: text-white/50 */}
            {!hideDismiss && (
              <CopilotButton
                variant="ghost"
                size="sm"
                onClick={dismiss}
                aria-label="Dismiss notification"
                className="!p-0.5 !h-auto flex-shrink-0 text-[hsl(var(--text-secondary))]"
              >
                <Dismiss20Regular className="w-4 h-4" />
              </CopilotButton>
            )}
          </div>
        </div>
      </div>

      {/* ToastBody: message subtitle + progress label */}
      {(toast.message || (isProgress && toast.progressLabel)) && (
        <div className="px-3 pb-3 pl-[2.875rem]">
          {/* dark mode: text-white/60 */}
          {toast.message && (
            <p className="text-xs leading-snug text-[hsl(var(--text-secondary))]">{toast.message}</p>
          )}
          {isProgress && toast.progressLabel && (
            <p className="text-xs leading-snug text-[hsl(var(--text-secondary))] mt-0.5">{toast.progressLabel}</p>
          )}
        </div>
      )}

      {/* Determinate progress bar */}
      {/* dark mode track: bg-white/10, fill: bg-[#479EF5] */}
      {isProgress && !isIndeterminate && (
        <div className="h-1 w-full bg-[hsl(var(--stroke-default))]">
          <div
            className="h-full bg-[#0078D4] transition-all duration-300 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, toast.progress ?? 0))}%` }}
          />
        </div>
      )}
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-50 flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <CopilotToast toast={toast} onDismiss={dismissToast} />
        </div>
      ))}
    </div>
  );
};
