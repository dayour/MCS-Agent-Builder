/**
 * SnapshotToggleDialog
 *
 * Shows when loading a snapshot that has a `toggleState` that differs from the
 * current Elevate environment. Allows users to apply the snapshot's recommended
 * toggle configuration before loading, skip it, or cancel.
 */

import React, { useMemo } from 'react';
import { AgentSnapshot } from '../types';
import { useAgent } from '../context/AgentContext';
import { useDW } from '../domains/dw/context/DWContext';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
  CopilotButton,
  CopilotBadge,
} from './ui';

import { TOGGLE_META, CATEGORY_ORDER } from '../utils/toggleLabels';
import type { FlagCategory, ToggleMeta } from '../utils/toggleLabels';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ToggleDiff {
  id: string;
  label: string;
  category: FlagCategory;
  currentValue: boolean | string;
  newValue: boolean | string;
}

interface Props {
  isOpen: boolean;
  snapshot: AgentSnapshot;
  onApplyAndLoad: () => void;
  onLoadAnyway: () => void;
  onCancel: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatValue(v: boolean | string): string {
  if (typeof v === 'boolean') return v ? 'On' : 'Off';
  return String(v);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SnapshotToggleDialog({ isOpen, snapshot, onApplyAndLoad, onLoadAnyway, onCancel }: Props) {
  const {
    isEvalMode, showEvalResults, isAiAutocomplete, isAgentTypeBadge,
    showConversationalLayoutFeature, isInterviewMode, showPersonalAgentOption,
    isComponentDrawer, isPillContextMenu, isBuildTabsEnabled,
    isPublishHAEnabled, publishScenario, isL1NavJuneProposal,
    isSkillsEnabled, isFlowCaptureEnabled, isAgentGlobalUndo,
    isAutoSave, isManualSave, isEvalsV2, isWorkIQEnabled,

    setIsEvalMode, setShowEvalResults, setIsAiAutocomplete, setIsAgentTypeBadge,
    setShowConversationalLayoutFeature, setIsInterviewMode, setShowPersonalAgentOption,
    setIsComponentDrawer, setIsPillContextMenu, setIsBuildTabsEnabled,
    setIsPublishHAEnabled, setPublishScenario, setIsL1NavJuneProposal,
    setIsSkillsEnabled, setIsFlowCaptureEnabled, setIsAgentGlobalUndo,
    setIsAutoSave, setIsManualSave, setIsEvalsV2, setIsWorkIQEnabled,
  } = useAgent();

  const { isDexter, setIsDexter } = useDW();

  // Current toggle values keyed by toggle ID
  const currentValues: Record<string, boolean | string> = useMemo(() => ({
    isEvalMode, showEvalResults, isAiAutocomplete, isAgentTypeBadge,
    showConversationalLayoutFeature, isInterviewMode, showPersonalAgentOption,
    isComponentDrawer, isPillContextMenu, isBuildTabsEnabled,
    isPublishHAEnabled, publishScenario, isL1NavJuneProposal,
    isSkillsEnabled, isFlowCaptureEnabled, isAgentGlobalUndo,
    isAutoSave, isManualSave, isDexter, isEvalsV2, isWorkIQEnabled,
  }), [
    isEvalMode, showEvalResults, isAiAutocomplete, isAgentTypeBadge,
    showConversationalLayoutFeature, isInterviewMode, showPersonalAgentOption,
    isComponentDrawer, isPillContextMenu, isBuildTabsEnabled,
    isPublishHAEnabled, publishScenario, isL1NavJuneProposal,
    isSkillsEnabled, isFlowCaptureEnabled, isAgentGlobalUndo,
    isAutoSave, isManualSave, isDexter, isEvalsV2, isWorkIQEnabled,
  ]);

  // Setter lookup table
  const setters: Record<string, (v: any) => void> = useMemo(() => ({
    isEvalMode: setIsEvalMode, showEvalResults: setShowEvalResults,
    isAiAutocomplete: setIsAiAutocomplete, isAgentTypeBadge: setIsAgentTypeBadge,
    showConversationalLayoutFeature: setShowConversationalLayoutFeature,
    isInterviewMode: setIsInterviewMode, showPersonalAgentOption: setShowPersonalAgentOption,
    isComponentDrawer: setIsComponentDrawer, isPillContextMenu: setIsPillContextMenu,
    isBuildTabsEnabled: setIsBuildTabsEnabled,
    isPublishHAEnabled: setIsPublishHAEnabled, publishScenario: setPublishScenario,
    isL1NavJuneProposal: setIsL1NavJuneProposal,
    isSkillsEnabled: setIsSkillsEnabled,
    isFlowCaptureEnabled: setIsFlowCaptureEnabled, isAgentGlobalUndo: setIsAgentGlobalUndo,
    isAutoSave: setIsAutoSave, isManualSave: setIsManualSave,
    isDexter: setIsDexter, isEvalsV2: setIsEvalsV2, isWorkIQEnabled: setIsWorkIQEnabled,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute diff between snapshot toggleState and current values
  const diffs = useMemo<ToggleDiff[]>(() => {
    const ts = snapshot.toggleState;
    if (!ts) return [];
    return Object.entries(ts)
      .filter(([id, newVal]) => {
        const curr = currentValues[id];
        return curr !== undefined && curr !== newVal;
      })
      .map(([id, newVal]) => {
        const meta = TOGGLE_META[id] ?? { label: id, category: 'Experimental' as FlagCategory };
        return {
          id,
          label: meta.label,
          category: meta.category,
          currentValue: currentValues[id],
          newValue: newVal,
        };
      });
  }, [snapshot.toggleState, currentValues]);

  // Group diffs by category in display order
  const byCategory = useMemo(() => {
    const map = new Map<FlagCategory, ToggleDiff[]>();
    for (const cat of CATEGORY_ORDER) {
      const items = diffs.filter(d => d.category === cat);
      if (items.length) map.set(cat, items);
    }
    return map;
  }, [diffs]);

  const applyAll = () => {
    const ts = snapshot.toggleState;
    if (!ts) return;
    for (const [id, value] of Object.entries(ts)) {
      const setter = setters[id];
      if (setter) setter(value);
    }
    onApplyAndLoad();
  };

  return (
    <Dialog isOpen={isOpen} onClose={onCancel} maxWidth="lg">
      <DialogHeader onClose={onCancel}>
        <div className="flex items-center gap-3">
          <DialogTitle>Recommended toggle configuration</DialogTitle>
          {diffs.length > 0 && (
            <CopilotBadge color="brand" appearance="tint" size="small" shape="rounded">
              {diffs.length} change{diffs.length !== 1 ? 's' : ''}
            </CopilotBadge>
          )}
        </div>
      </DialogHeader>

      <DialogContent>
        <p className="text-body-2 text-[var(--colorNeutralForeground3)] mb-4">
          <strong className="text-[var(--colorNeutralForeground1)]">{snapshot.name}</strong> was designed
          with a specific Elevate configuration. Apply the changes below to get the intended experience,
          or load without changing your current settings.
        </p>

        {diffs.length === 0 ? (
          <p className="text-body-2 text-[var(--colorNeutralForeground3)] py-2">
            Your current toggle settings already match this snapshot's configuration.
          </p>
        ) : (
          <div className="space-y-4">
            {Array.from(byCategory.entries()).map(([cat, items]) => (
              <div key={cat}>
                <p className="text-caption font-semibold text-[var(--colorNeutralForeground3)] uppercase tracking-wide mb-2">
                  {cat}
                </p>
                <div className="rounded-lg border border-[var(--colorNeutralStroke2)] overflow-hidden">
                  {items.map((diff, i) => (
                    <div
                      key={diff.id}
                      className={`flex items-center justify-between px-4 py-2.5 ${
                        i < items.length - 1 ? 'border-b border-[var(--colorNeutralStroke2)]' : ''
                      }`}
                    >
                      <span className="text-body-2 text-[var(--colorNeutralForeground1)]">{diff.label}</span>
                      <div className="flex items-center gap-2 text-caption">
                        <span className="text-[var(--colorNeutralForeground3)]">
                          {formatValue(diff.currentValue)}
                        </span>
                        <span className="text-[var(--colorNeutralForeground4)]">→</span>
                        <span className="font-semibold text-[var(--colorBrandForeground1)]">
                          {formatValue(diff.newValue)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>

      <DialogFooter>
        <CopilotButton variant="transparent" size="md" onClick={onCancel}>
          Cancel
        </CopilotButton>
        <CopilotButton variant="secondary" size="md" onClick={onLoadAnyway}>
          Load Anyway
        </CopilotButton>
        <CopilotButton variant="primary" size="md" onClick={applyAll}>
          Apply &amp; Load
        </CopilotButton>
      </DialogFooter>
    </Dialog>
  );
}
