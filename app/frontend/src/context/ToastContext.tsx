import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'progress';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  /** Duration in ms before auto-dismiss. 0 = persistent. Default: 4000 */
  duration?: number;
  action?: { label: string; onClick: () => void };
  agentId?: string;
  /** For 'progress' variant: 0–100. Omit for indeterminate spinner. */
  progress?: number;
  /** Optional label shown alongside the progress bar, e.g. "Uploading… 42%" */
  progressLabel?: string;
}

export interface NotificationRecord {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  timestamp: number;
  isRead: boolean;
  agentId?: string;
  action?: { label: string; onClick: () => void };
}

interface ToastContextType {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  updateToast: (id: string, updates: Partial<Omit<ToastItem, 'id'>>) => void;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
  notifications: NotificationRecord[];
  unreadCount: number;
  markAllRead: () => void;
  markAgentRead: (agentId: string) => void;
  clearNotifications: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const MAX_TOASTS = 5;
const MAX_NOTIFICATIONS = 50;

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>): string => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => {
      const next = [...prev, { ...toast, id }];
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });
    setNotifications(prev => {
      const record: NotificationRecord = {
        id,
        variant: toast.variant,
        title: toast.title,
        message: toast.message,
        timestamp: Date.now(),
        isRead: false,
        agentId: toast.agentId,
        action: toast.action,
      };
      const next = [record, ...prev];
      return next.length > MAX_NOTIFICATIONS ? next.slice(0, MAX_NOTIFICATIONS) : next;
    });
    return id;
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Omit<ToastItem, 'id'>>) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => setToasts([]), []);

  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

  const markAllRead = useCallback(() => setNotifications(prev => prev.map(n => ({ ...n, isRead: true }))), []);

  const markAgentRead = useCallback((agentId: string) =>
    setNotifications(prev => prev.map(n => n.agentId === agentId ? { ...n, isRead: true } : n)), []);

  const clearNotifications = useCallback(() => setNotifications([]), []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, updateToast, dismissToast, clearToasts, notifications, unreadCount, markAllRead, markAgentRead, clearNotifications }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
