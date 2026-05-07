import React, { useState, useEffect } from 'react';
import { CheckmarkCircle16Filled } from '@fluentui/react-icons';
import { useAgent } from '../../context/AgentContext';
import { CopilotTooltip } from './CopilotTooltip';

/**
 * SaveIndicator — progressive save status for manual-save mode.
 *
 * States:
 * - Unsaved changes: "Unsaved changes" text (persistent until save)
 * - Saving: "Saving..." text
 * - Saved: checkmark circle + "Saved just now" animates out after 4s, collapses to icon only
 * - Checkmark hover: tooltip with "Last saved at <timestamp>"
 *
 * Auto-save status is rendered in Layout.tsx near the publish button.
 */
export function SaveIndicator() {
  const { savingState, isAutoSave, isManualSave, isManualSaveDirty, lastSavedAt } = useAgent();
  const [showSavedText, setShowSavedText] = useState(false);

  // Show "Saved just now" text for 3.5s after each save.
  // Must be shorter than the 4s savedTimerRef in AgentContext so the text
  // collapses before savingState transitions to 'idle'.
  useEffect(() => {
    if (!lastSavedAt) return;
    setShowSavedText(true);
    const timer = setTimeout(() => setShowSavedText(false), 3500);
    return () => clearTimeout(timer);
  }, [lastSavedAt]);

  // Auto-save status is rendered in Layout.tsx near the publish button
  if (!isManualSave || isAutoSave) return null;

  // Saving in progress
  if (savingState === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-500 select-none" aria-live="polite">
        Saving…
      </span>
    );
  }

  // Unsaved changes — supersedes saved/checkmark state
  if (isManualSaveDirty) {
    return (
      <span className="inline-flex items-center text-xs font-semibold text-gray-500 select-none" aria-live="polite">
        Unsaved changes
      </span>
    );
  }

  // Just saved — checkmark circle + text animates out, then icon only
  if (savingState === 'saved' || (savingState === 'idle' && lastSavedAt)) {
    const timestamp = lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString() : '';
    return (
      <CopilotTooltip content={`Last saved at ${timestamp}`} placement="bottom">
        <span className="inline-flex items-center gap-1 text-xs text-gray-900 select-none cursor-default" aria-live="polite">
          <CheckmarkCircle16Filled className="w-4 h-4 flex-shrink-0" />
          <span
            className="overflow-hidden whitespace-nowrap transition-all duration-500 ease-in-out"
            style={{
              maxWidth: showSavedText ? '120px' : '0px',
              opacity: showSavedText ? 1 : 0,
            }}
          >
            Saved just now
          </span>
        </span>
      </CopilotTooltip>
    );
  }

  return null;
}