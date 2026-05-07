import { useEffect, useRef, useCallback } from 'react';
import { saveToLocalStorage, type SavePayload, type SaveResult } from '../services/saveService';

export interface AutoSaveOptions {
  /** Debounce delay in ms (default: 2000) */
  delay?: number;
  /** Whether auto-save is active */
  enabled: boolean;
  /** Called just before the actual write (after debounce completes) */
  onSaving?: () => void;
  /** Called after each save attempt */
  onSave?: (result: SaveResult) => void;
}

/**
 * Debounced auto-save hook.
 *
 * When enabled, waits `delay` ms after the last call to `scheduleSave()`
 * before persisting the snapshot returned by `getPayload()`.
 *
 * Re-calling `scheduleSave()` within the window resets the timer
 * (trailing-edge debounce).
 */
export function useAutoSave(
  getPayload: () => SavePayload,
  options: AutoSaveOptions,
) {
  const { delay = 2000, enabled, onSaving, onSave } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const getPayloadRef = useRef(getPayload);
  const onSavingRef = useRef(onSaving);
  const onSaveRef = useRef(onSave);

  // Keep refs current without re-running effects
  useEffect(() => { getPayloadRef.current = getPayload; }, [getPayload]);
  useEffect(() => { onSavingRef.current = onSaving; }, [onSaving]);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flush = useCallback(() => {
    cancel();
    onSavingRef.current?.();
    const result = saveToLocalStorage(getPayloadRef.current());
    onSaveRef.current?.(result);
    return result;
  }, [cancel]);

  const scheduleSave = useCallback(() => {
    if (!enabled) return;
    cancel();
    timerRef.current = setTimeout(() => {
      onSavingRef.current?.();
      const result = saveToLocalStorage(getPayloadRef.current());
      onSaveRef.current?.(result);
    }, delay);
  }, [enabled, delay, cancel]);

  // Cancel pending timer when disabled or on unmount
  useEffect(() => {
    if (!enabled) cancel();
    return cancel;
  }, [enabled, cancel]);

  // Flush pending save before page unload.
  // NOTE: flush() must remain synchronous (localStorage) for beforeunload.
  // If migrating to a server backend, use navigator.sendBeacon() instead.
  useEffect(() => {
    if (!enabled) return;
    const handleBeforeUnload = () => {
      if (timerRef.current) flush();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled, flush]);

  return { scheduleSave, flush, cancel };
}
