import { useEffect, useCallback, useRef } from 'react';
import { saveToLocalStorage, type SavePayload, type SaveResult } from '../services/saveService';

export interface ManualSaveOptions {
  /** Whether manual save (Ctrl+S) is active */
  enabled: boolean;
  /** Called before each save (e.g. to set saving state) */
  onBeforeSave?: () => void;
  /** Called after each save attempt */
  onSave?: (result: SaveResult) => void;
}

/**
 * Manual-save hook — exposes `saveNow()` and binds Ctrl+S / Cmd+S.
 *
 * When enabled, pressing Ctrl+S (or Cmd+S on Mac) calls `saveNow()`
 * which persists the current payload via the save service.
 */
export function useManualSave(
  getPayload: () => SavePayload,
  options: ManualSaveOptions,
) {
  const { enabled, onBeforeSave, onSave } = options;
  const getPayloadRef = useRef(getPayload);
  const onBeforeSaveRef = useRef(onBeforeSave);
  const onSaveRef = useRef(onSave);

  useEffect(() => { getPayloadRef.current = getPayload; }, [getPayload]);
  useEffect(() => { onBeforeSaveRef.current = onBeforeSave; }, [onBeforeSave]);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  const saveNow = useCallback((): SaveResult => {
    onBeforeSaveRef.current?.();
    const result = saveToLocalStorage(getPayloadRef.current());
    onSaveRef.current?.(result);
    return result;
  }, []);

  // Bind Ctrl+S / Cmd+S
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveNow();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, saveNow]);

  return { saveNow };
}
