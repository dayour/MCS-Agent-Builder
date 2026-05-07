import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AgentConfig } from '../types';
import { useAgent } from '../context/AgentContext';
import { KNOWN_TRIGGERS } from '../utils/agentCatalog';
import { getConnectorIcon } from '../utils/agentIcons';
import { parseSysColorKey } from '../utils/systemColorIcons';
import {
  Capability,
  ComponentItem,
  pillIconClass,
  pillSpanStyle,
  getTriggerFriendlyName,
  getTriggerChannel,
  formatActionDisplayName,
  getServiceShortLabel,
  getServiceIconForLabel,
  getTriggerPillIcon,
  getPillCapabilityIcon,
  getChannelIcon,
  getPillContextMenuItems,
  stripAllPrefixes,
  CONVERSATIONAL_CHANNEL_KEYS,
} from '../utils/buildPageUtils';
import { ComponentPill } from '../components/ui/ComponentPill';
import { CopilotMenu, CopilotMenuPosition } from '../components/ui/CopilotMenu';
import { DiffLine, CharSegment, computeInstructionsDiff, buildStreamingDiff } from '../utils/instructionsDiff';
import { SIMULATED_ERRORS } from '../data/simulatedAgentErrors';
import { Info16Regular } from '@fluentui/react-icons';
import { Tooltip } from '@fluentui/react-components';

// ── Hook interface ─────────────────────────────────────────────────────────────

export interface UseBuildPageEditorParams {
  agentConfig: AgentConfig;
  updateAgentConfig: (updates: Partial<AgentConfig>) => void;
  updateSpecificAgent: (id: string, updates: Partial<AgentConfig>) => void;
  clearStreamingInstructions: () => void;
  streamingInstructionsData: { agentId: string; targetInstructions: string } | null;
  isNarrowPreview: boolean;
  capabilities: Capability[];
  isSlashInsertingRef: React.MutableRefObject<boolean>;
  urlInputActiveRef: React.MutableRefObject<boolean>;
  onBlurResetSlash: () => void;
  componentToggles: Record<string, boolean>;
  setComponentToggles: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  isPillContextMenu: boolean;
  derivedComponentItems: ComponentItem[];
  componentDescriptions: Record<string, string>;
  registerInstructionsReader: (agentId: string, reader: () => string) => void;
  unregisterInstructionsReader: (agentId: string) => void;
  onPillConfigure?: (editText: string, label: string, capType: 'knowledge' | 'action' | 'connector' | 'trigger') => void;
  reviewSnapshotInstructions?: string;
  onOpenTrigger?: (item: ComponentItem) => void;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useBuildPageEditor({
  agentConfig,
  updateAgentConfig,
  updateSpecificAgent,
  clearStreamingInstructions,
  streamingInstructionsData,
  isNarrowPreview,
  capabilities,
  isSlashInsertingRef,
  urlInputActiveRef,
  onBlurResetSlash,
  componentToggles,
  setComponentToggles,
  isPillContextMenu,
  derivedComponentItems,
  componentDescriptions,
  registerInstructionsReader,
  unregisterInstructionsReader,
  onPillConfigure,
  reviewSnapshotInstructions,
  onOpenTrigger,
}: UseBuildPageEditorParams) {

  const {
    updateWithHistory, undo, redo, isAgentGlobalUndo, markManualDirty, commitSave,
    isAgentErrorSimulation, resolvedErrorIds, setPendingHelperQuote, setIsHelperCollapsed,
  } = useAgent();

  // ── State ────────────────────────────────────────────────────────────────────

  const [isEditing, setIsEditing] = useState(false);
  const [editableText, setEditableText] = useState(agentConfig.instructions || '');
  const [contentEditableKey, setContentEditableKey] = useState(0);
  const [showHeaderBorder, setShowHeaderBorder] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [editableName, setEditableName] = useState(agentConfig.name || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingNameLarge, setIsEditingNameLarge] = useState(false);
  const [editableDescription, setEditableDescription] = useState(agentConfig.description || '');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isEditingDescriptionLarge, setIsEditingDescriptionLarge] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [showDescriptionTooltip, setShowDescriptionTooltip] = useState(false);

  // ── Errored pill labels (instruction misconfiguration simulation) ────────────
  // Set of affectedResource labels that have an active instruction-source error.
  // Pills whose label matches will render in the error state (red border/text).
  const activePillErrorLabels = React.useMemo(() => {
    if (!isAgentErrorSimulation) return new Set<string>();
    return new Set(
      SIMULATED_ERRORS
        .filter(e => e.errorSource === 'instruction' && !resolvedErrorIds.includes(e.id))
        .map(e => e.affectedResource)
    );
  }, [isAgentErrorSimulation, resolvedErrorIds]);

  // ── Pill context menu state ─────────────────────────────────────────────────
  const [pillMenuState, setPillMenuState] = useState<{
    editText: string;
    label: string;
    capType: 'knowledge' | 'action' | 'connector' | 'trigger';
    position: CopilotMenuPosition;
  } | null>(null);

  // Guard ref: when true, handleBlur suppresses setIsEditing(false) so the
  // contentEditable doesn't remount while the pill context menu is opening.
  const isPillClickingRef = useRef(false);

  /** Opens the context menu on mousedown — fires before click so the menu
   *  position is captured before any CopilotMenu close → re-render race. */
  const handlePillMouseDown = useCallback((
    editText: string,
    label: string,
    capType: 'knowledge' | 'action' | 'connector' | 'trigger',
    e: React.MouseEvent<HTMLSpanElement>
  ) => {
    isPillClickingRef.current = true;
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const menuHeight = capType === 'trigger' ? 120 : 180;
    const spaceBelow = window.innerHeight - rect.bottom;
    const pos: CopilotMenuPosition = spaceBelow >= menuHeight
      ? { top: rect.bottom + 4, left: rect.left }
      : { bottom: window.innerHeight - rect.top + 4, left: rect.left };
    setPillMenuState({ editText, label, capType, position: pos });
  }, []);

  /** Click handler — menu is already opened by mousedown; just stopPropagation. */
  const handlePillClick = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    isPillClickingRef.current = false;
    e.stopPropagation();
  }, []);

  const closePillMenu = useCallback(() => setPillMenuState(null), []);

  const handlePillDelete = useCallback((editText: string) => {
    const current = editableText;
    // Remove the editText and any surrounding [[]] markup
    let updated = current;
    const bracketWrapped = `[[${editText}]]`;
    if (updated.includes(bracketWrapped)) {
      updated = updated.replace(bracketWrapped, '');
    } else {
      updated = updated.replace(editText, '');
    }
    // Clean up extra whitespace left behind
    updated = updated.replace(/  +/g, ' ').replace(/\n /g, '\n').trim();
    setEditableText(updated);
    setContentEditableKey(prev => prev + 1);
    updateWithHistory({ instructions: updated });
  }, [editableText, setEditableText, setContentEditableKey, updateWithHistory]);

  // ── Refs ─────────────────────────────────────────────────────────────────────

  const contentEditableRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const instructionsBoxRef = useRef<HTMLDivElement>(null);
  const nameEditRef = useRef<HTMLInputElement>(null);
  const nameEditLargeRef = useRef<HTMLDivElement>(null);
  const descriptionEditRef = useRef<HTMLDivElement>(null);
  const descriptionEditLargeRef = useRef<HTMLDivElement>(null);
  const descriptionDisplayRef = useRef<HTMLParagraphElement>(null);
  const previousInstructionsLength = useRef(agentConfig.instructions?.length || 0);
  const streamingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousConfig = useRef(agentConfig);
  const draftTextRef = useRef<string | null>(null);
  // Initialised to the same value as editableText so the live reader always
  // returns a valid string, even if called before the first render commits.
  const latestEditableTextRef = useRef<string>(editableText);

  // ── Effects ───────────────────────────────────────────────────────────────────

  // Reset all ephemeral state when the selected agent changes.
  // This fires before the narrower sync effects below, ensuring:
  //   - contentEditable DOM remounts (via key increment) to discard stale rendered pills
  //   - Empty-instructions agents correctly clear the editor (the sync effect at line ~149
  //     has an `agentConfig.instructions &&` guard that would silently skip the clear)
  //   - Any in-progress edit state is cancelled so the sync effects' `!isEditing` guards pass
  useEffect(() => {
    setEditableText(agentConfig.instructions || '');
    setEditableName(agentConfig.name || '');
    setEditableDescription(agentConfig.description || '');
    setContentEditableKey(k => k + 1);
    setIsEditing(false);
    setIsEditingName(false);
    setIsEditingNameLarge(false);
    setIsEditingDescription(false);
    setIsEditingDescriptionLarge(false);
    draftTextRef.current = null;
    previousConfig.current = agentConfig;
  }, [agentConfig.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep latestEditableTextRef current so the live reader never has a stale closure.
  useEffect(() => {
    latestEditableTextRef.current = editableText;
  }, [editableText]);

  // Register a live-reader for this agent so the helper agent can read the current
  // draft (including un-flushed keystrokes) rather than the last-committed context value.
  useEffect(() => {
    const agentId = agentConfig.id;
    const reader = () => draftTextRef.current ?? latestEditableTextRef.current;
    registerInstructionsReader(agentId, reader);
    return () => { unregisterInstructionsReader(agentId); };
  }, [agentConfig.id, registerInstructionsReader, unregisterInstructionsReader]);

  // Handle streaming instructions animation
  useEffect(() => {
    if (streamingInstructionsData && streamingInstructionsData.agentId === agentConfig.id) {
      const targetInstructions = streamingInstructionsData.targetInstructions;

      // Capture the animation start point from the live draft before flushing.
      // Must happen first: the flush below clears draftTextRef.
      const startText = draftTextRef.current ?? latestEditableTextRef.current;

      // Commit any un-flushed draft before streaming so the editor and context
      // agree on the base state before the helper's changes are applied.
      // Note: we skip pushHistory here — the streaming-complete block below will
      // push the final result, giving undo a single clean revert target instead of
      // an intermediate draft the user never explicitly committed.
      // Re-entry safety: the guard (draftTextRef.current !== null) prevents loops
      // because we null-out the ref before the state updates that re-trigger this effect.
      if (draftTextRef.current !== null && draftTextRef.current !== editableText) {
        const draft = draftTextRef.current;
        draftTextRef.current = null;
        setEditableText(draft);
        updateAgentConfig({ instructions: draft });
        setContentEditableKey(k => k + 1);
        latestEditableTextRef.current = draft; // sync ref immediately, can't wait for effect
      }
      const charsToAdd = targetInstructions.length - startText.length;

      if (streamingTimeoutRef.current) {
        clearTimeout(streamingTimeoutRef.current);
      }

      setIsStreaming(true);

      if (isNarrowPreview && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      } else if (!isNarrowPreview) {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }

      setTimeout(() => {
        let currentIndex = 0;
        const streamChars = () => {
          if (currentIndex < charsToAdd) {
            const newText = startText + targetInstructions.slice(startText.length, startText.length + currentIndex + 1);
            setEditableText(newText);

            // MainContentEditable is permanently memoized, so React state updates
            // don't reach the DOM. Render formatted HTML directly for visual streaming.
            if (contentEditableRef.current) {
              // Highlight everything beyond startText.length as new — no LCS needed.
              // The proper word-level diff (vs the HA baseline) replaces this when
              // streaming completes via setContentEditableKey remount.
              const streamingDiff = reviewSnapshotInstructions != null
                ? buildStreamingDiff(startText, newText)
                : undefined;
              contentEditableRef.current.innerHTML = renderToStaticMarkup(renderInstructionsWithFormatting(newText, streamingDiff, undefined, true));
            }

            if (isNarrowPreview && scrollContainerRef.current) {
              scrollContainerRef.current.scrollTo({
                top: scrollContainerRef.current.scrollHeight,
                behavior: 'auto',
              });
            } else if (!isNarrowPreview) {
              window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
            }

            currentIndex += 15;
            streamingTimeoutRef.current = setTimeout(streamChars, 30);
          } else {
            setIsStreaming(false);
            streamingTimeoutRef.current = null;
            // Use updateAgentConfig (no history) — HelperAgent.tsx calls takeSnapshot
            // before initiating streaming, so the undo entry is already captured.
            updateAgentConfig({ instructions: targetInstructions });
            // When a review is active, skip the re-key here. The review activation
            // effect will fire (because agentConfig.instructions just changed), set
            // reviewRenderedInstructions, then re-key — so the remount goes straight
            // to the final diff without a plain-text frame in between (no flicker).
            if (reviewSnapshotInstructions == null) {
              setContentEditableKey(k => k + 1);
            }
            clearStreamingInstructions();
          }
        };
        streamChars();
      }, 300);
    }

    return () => {
      if (streamingTimeoutRef.current) {
        clearTimeout(streamingTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamingInstructionsData, agentConfig.id]);

  // Sync editableText with agentConfig.instructions
  useEffect(() => {
    const isStreamingActive = streamingInstructionsData && streamingInstructionsData.agentId === agentConfig.id;

    if (agentConfig.instructions && !isEditing && !isStreamingActive && !isStreaming) {
      const newInstructions = agentConfig.instructions;
      const agentChanged = previousConfig.current.id !== agentConfig.id;
      const instructionsChanged = newInstructions !== previousConfig.current.instructions;
      const publishChanged = agentConfig.published !== previousConfig.current.published;
      const distributionChanged = JSON.stringify(agentConfig.triggerDistribution) !== JSON.stringify(previousConfig.current.triggerDistribution);
      const softDeleteChanged = JSON.stringify(agentConfig.softDeletedTriggers ?? []) !== JSON.stringify(previousConfig.current.softDeletedTriggers ?? []);

      if (agentChanged || instructionsChanged || publishChanged || distributionChanged || softDeleteChanged) {
        setEditableText(newInstructions);
        // Force MainContentEditable to remount with fresh children.
        // The memo'd component never re-renders, so a key change is the
        // only way to pick up new content from an external config update
        // (e.g. placeholder → agent transition during fuzzy create,
        // publish state change affecting pill nudges, soft-deleted triggers).
        if (instructionsChanged || publishChanged || distributionChanged || softDeleteChanged) {
          setContentEditableKey(k => k + 1);
        }
        previousConfig.current = agentConfig;
      }

      previousInstructionsLength.current = newInstructions.length;
    }
  }, [agentConfig, isEditing, streamingInstructionsData, isStreaming]);

  // Sync editableDescription with agentConfig.description
  useEffect(() => {
    if (agentConfig.description && !isEditingDescription && !isEditingDescriptionLarge) {
      setEditableDescription(agentConfig.description);
    }
  }, [agentConfig.description, isEditingDescription, isEditingDescriptionLarge]);

  // Sync editableName with agentConfig.name
  useEffect(() => {
    if (agentConfig.name && !isEditingName && !isEditingNameLarge) {
      setEditableName(agentConfig.name);
    }
  }, [agentConfig.name, isEditingName, isEditingNameLarge]);

  // Focus the large name div when editing starts and restore content
  useLayoutEffect(() => {
    if (isEditingNameLarge && nameEditLargeRef.current) {
      nameEditLargeRef.current.innerText = agentConfig.name || '';
      nameEditLargeRef.current.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(nameEditLargeRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [isEditingNameLarge]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus the large description div when editing starts and restore content
  useLayoutEffect(() => {
    if (isEditingDescriptionLarge && descriptionEditLargeRef.current) {
      descriptionEditLargeRef.current.innerText = agentConfig.description || '';
      descriptionEditLargeRef.current.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(descriptionEditLargeRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [isEditingDescriptionLarge]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check if description is truncated on mount and when description changes
  useEffect(() => {
    if (!isEditingDescriptionLarge && descriptionEditLargeRef.current) {
      const isTrunc = descriptionEditLargeRef.current.scrollHeight > descriptionEditLargeRef.current.clientHeight;
      setIsTruncated(isTrunc);
    }
  }, [agentConfig.description, isEditingDescriptionLarge]);

  // ── Undo/redo handlers (keyboard shortcuts in instructions textarea) ──────
  // Delegates to the unified context history. setIsEditing(false) ensures the
  // sync effect (which guards on !isEditing) picks up the restored state.

  const handleUndo = () => {
    setIsEditing(false);
    undo();
  };

  const handleRedo = () => {
    setIsEditing(false);
    redo();
  };

  // ── DOM ↔ editableText reconstruction ─────────────────────────────────────

  const readDOMIntoEditableText = (el: HTMLElement): string => {
    let result = '';

    const walkNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent || '';
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const elem = node as HTMLElement;

      // Skip elements marked as non-content (placeholders, deleted review text, etc.)
      if (elem.hasAttribute('data-skip-read')) return;
      if (elem.hasAttribute('data-review-deleted')) return;

      // Pill spans with data-edit-text reconstruct original markup
      if (elem.hasAttribute('data-edit-text')) {
        result += elem.getAttribute('data-edit-text') || '';
        return;
      }

      const tag = elem.tagName.toLowerCase();

      if (tag === 'h2') {
        result += '## ';
        Array.from(elem.childNodes).forEach(walkNode);
        result += '\n';
      } else if (tag === 'h3') {
        result += '### ';
        Array.from(elem.childNodes).forEach(walkNode);
        result += '\n';
      } else if (tag === 'ul') {
        Array.from(elem.childNodes).forEach(walkNode);
      } else if (tag === 'li') {
        const children = Array.from(elem.childNodes);
        let prefix = '• ';
        let contentStart = 0;
        if (children.length >= 1 && children[0].nodeType === Node.ELEMENT_NODE) {
          const markerText = (children[0] as HTMLElement).textContent?.trim() || '';
          if (markerText === '•') {
            contentStart = 1; // skip our rendered bullet marker span
          } else if (markerText === '−' || markerText === '-') {
            prefix = '- ';
            contentStart = 1; // skip our rendered dash marker span
          }
          // Otherwise first child is not a marker span (browser-split li) — walk from 0
        }
        result += prefix;
        for (let i = contentStart; i < children.length; i++) walkNode(children[i]);
        result += '\n';
      } else if (tag === 'p') {
        Array.from(elem.childNodes).forEach(walkNode);
        result += '\n';
      } else if (tag === 'br') {
        result += '\n';
      } else if (tag === 'div') {
        Array.from(elem.childNodes).forEach(walkNode);
        result += '\n';
      } else {
        // Skip deleted review spans — their text is not part of editable content.
        if (elem.hasAttribute('data-review-deleted')) return;
        // span or any other inline element — just walk children
        Array.from(elem.childNodes).forEach(walkNode);
      }
    };

    Array.from(el.childNodes).forEach(walkNode);
    return result.replace(/\u200b/g, '').replace(/\n+$/, '');
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleModelChange = (model: AgentConfig['model']) => {
    if (model === agentConfig.model) return;
    if (isAgentGlobalUndo) { updateWithHistory({ model }); } else { updateAgentConfig({ model }); markManualDirty(); }
    commitSave();
  };

  const handleIconSelect = (rawIconKey: string, gradientKey: string, imageData?: string) => {
    const { systemColorIcon, iconKey } = parseSysColorKey(rawIconKey);
    const update: Partial<AgentConfig> = {
      iconKey: iconKey || undefined,
      gradientKey,
      systemColorIcon: systemColorIcon || undefined,
      iconImageData: imageData || undefined,
    };
    if (isAgentGlobalUndo) { updateWithHistory(update); } else { updateAgentConfig(update); markManualDirty(); }
    commitSave();
  };

  const handleNameLargeClick = () => {
    setIsEditingNameLarge(true);
    setEditableName(agentConfig.name || '');
  };

  const handleNameInput = (e: React.FormEvent<HTMLDivElement>) => {
    setEditableName(e.currentTarget.innerText);
  };

  const handleNameLargeBlur = () => {
    // Read DOM *before* exiting edit mode — setIsEditingNameLarge(false) triggers
    // a re-render that replaces innerText with React children, clobbering the value.
    const newValue = nameEditLargeRef.current?.innerText.trim() ?? editableName;
    const isDefault = newValue === '' || newValue === 'New agent';
    const finalValue = isDefault ? (agentConfig.name || '') : newValue;
    setEditableName(finalValue);
    if (finalValue !== agentConfig.name) {
      if (isAgentGlobalUndo) { updateWithHistory({ name: finalValue }); } else { updateAgentConfig({ name: finalValue }); markManualDirty(); }
      commitSave();
    }
    // Exit edit mode *after* the config update so React children render the new value
    setIsEditingNameLarge(false);
  };

  const handleNameLargeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nameEditLargeRef.current?.blur();
    } else if (e.key === 'Escape') {
      // Reset DOM content before exiting edit mode
      if (nameEditLargeRef.current) {
        nameEditLargeRef.current.innerText = agentConfig.name || 'New agent';
      }
      setEditableName(agentConfig.name || '');
      setIsEditingNameLarge(false);
    }
  };

  const handleDescriptionLargeClick = () => {
    setIsEditingDescriptionLarge(true);
    setEditableDescription(agentConfig.description || '');
  };

  const handleDescriptionLargeBlur = () => {
    // Read DOM *before* exiting edit mode — setIsEditingDescriptionLarge(false) triggers
    // a re-render that replaces innerText with React children, clobbering the value.
    const rawValue = descriptionEditLargeRef.current?.innerText.trim() ?? editableDescription;
    // 600-char limit matches backend validation — silently truncates on save
    const newValue = rawValue.length > 600 ? rawValue.slice(0, 600) : rawValue;
    const isDefault = newValue === '' || newValue === 'Description of what this does.';
    const finalValue = isDefault ? (agentConfig.description || '') : newValue;
    setEditableDescription(finalValue);
    if (finalValue !== agentConfig.description) {
      if (isAgentGlobalUndo) { updateWithHistory({ description: finalValue }); } else { updateAgentConfig({ description: finalValue }); markManualDirty(); }
      commitSave();
    }
    // Exit edit mode *after* the config update so React children render the new value
    setIsEditingDescriptionLarge(false);
    // Check if text is truncated after blur
    setTimeout(() => {
      if (descriptionEditLargeRef.current) {
        const isTrunc = descriptionEditLargeRef.current.scrollHeight > descriptionEditLargeRef.current.clientHeight;
        setIsTruncated(isTrunc);
      }
    }, 100);
  };

  const handleDescriptionLargeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      descriptionEditLargeRef.current?.blur();
    } else if (e.key === 'Escape') {
      // Reset DOM content before exiting edit mode
      if (descriptionEditLargeRef.current) {
        descriptionEditLargeRef.current.innerText = agentConfig.description || 'Description of what this does.';
      }
      setEditableDescription(agentConfig.description || '');
      setIsEditingDescriptionLarge(false);
    }
  };

  const handleDescriptionInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newValue = e.currentTarget.innerText;
    if (newValue.length <= 600) {
      setEditableDescription(newValue);
    } else {
      // Clamp DOM content to 600 characters to prevent exceeding the limit
      const clamped = newValue.slice(0, 600);
      e.currentTarget.innerText = clamped;
      setEditableDescription(clamped);
      // Move cursor to end after clamping
      const sel = window.getSelection();
      if (sel && e.currentTarget.childNodes.length > 0) {
        const range = document.createRange();
        range.selectNodeContents(e.currentTarget);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  };

  const handleDescriptionClick = (_e: React.MouseEvent) => {
    if (!isEditingDescription) {
      setIsEditingDescription(true);
      setTimeout(() => {
        descriptionEditRef.current?.focus();
      }, 0);
    }
  };

  const handleDescriptionBlur = () => {
    setIsEditingDescription(false);
    const newDescription = descriptionEditRef.current?.textContent || '';
    if (newDescription !== agentConfig.description) {
      if (isAgentGlobalUndo) { updateWithHistory({ description: newDescription }); } else { updateAgentConfig({ description: newDescription }); markManualDirty(); }
      setEditableDescription(newDescription);
      commitSave();
    }
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      descriptionEditRef.current?.blur();
    }
  };

  const handleContentClick = (_e: React.MouseEvent) => {
    if (!isEditing) {
      setIsEditing(true);
      setTimeout(() => {
        contentEditableRef.current?.focus();
      }, 0);
    }
  };

  const handleBlur = () => {
    // Suppress blur during our own setIsEditing(false) → setIsEditing(true) cycle
    // Also suppress when the URL input inside the slash menu grabs focus,
    // or when a pill context menu is being opened (mousedown steals focus).
    if (isSlashInsertingRef.current || urlInputActiveRef.current || isPillClickingRef.current) return;
    // Remove temporary bottom padding added by the "no active cursor" + Add path.
    if (contentEditableRef.current) contentEditableRef.current.style.paddingBottom = '';
    setIsEditing(false);
    onBlurResetSlash();
    // Use the draft text accumulated by onInput events rather than re-reading
    // the DOM here. At blur time the DOM may be partially updated by React's
    // pending re-render, making a fresh DOM read unreliable. The onInput draft
    // is always read right after each keystroke when the DOM is consistent.
    const draft = draftTextRef.current;
    draftTextRef.current = null;
    if (draft !== null && draft !== editableText) {
      setEditableText(draft);
      updateWithHistory({ instructions: draft });
      commitSave();
      // Force remount so React renders fresh DOM from the new editableText
      // rather than diffing the stale virtual DOM against it (which would
      // insert the typed text a second time, duplicating content).
      setContentEditableKey(k => k + 1);
    }
  };

  const flushDraft = useCallback(() => {
    // Use draftTextRef (set by onInput events) rather than reading the DOM directly.
    // DOM reads can produce false positives due to whitespace/formatting normalization
    // differences, triggering spurious history entries when the user hasn't typed anything.
    const draft = draftTextRef.current;
    draftTextRef.current = null;
    if (draft !== null && draft !== editableText) {
      setEditableText(draft);
      updateWithHistory({ instructions: draft });
    }
  }, [editableText, updateWithHistory]);

  // Wide layout: track page scroll for header border separator
  useEffect(() => {
    if (isNarrowPreview) return;
    const handler = () => setShowHeaderBorder(window.scrollY > 10);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [isNarrowPreview]);

  const handleScroll = () => {
    // Narrow preview only — wide layout uses window scroll (above)
    if (!isNarrowPreview) return;
    if (scrollContainerRef.current) {
      const scrollTop = scrollContainerRef.current.scrollTop;
      setShowHeaderBorder(scrollTop > 10);
    }
  };

  // ── Render functions ────────────────────────────────────────────────────────

  const renderLineWithPills = (text: string, lineIndex: number): React.ReactNode => {
    let partIndex = 0;

    interface PillMatch { start: number; end: number; node: React.ReactElement; }
    const pillMatches: PillMatch[] = [];

    const overlaps = (s: number, e: number) =>
      pillMatches.some(m => s < m.end && e > m.start);

    // 1. {{icon:channel}} [[trigger]] tokens
    const iconTriggerRe = /\{\{icon:([\w\s]+?)\}\}\s*\[\[([^\]]+)\]\]/g;
    let m: RegExpExecArray | null;
    while ((m = iconTriggerRe.exec(text)) !== null) {
      const channel = m[1], triggerText = m[2];
      if (channel?.trim() && triggerText?.trim() && !overlaps(m.index, m.index + m[0].length)) {
        const capturedi = partIndex++;
        const triggerEditText = `{{icon:${channel}}} [[${triggerText}]]`;
        pillMatches.push({
          start: m.index, end: m.index + m[0].length,
          node: isPillContextMenu
            ? React.createElement(ComponentPill, {
                key: `trigger-${lineIndex}-${capturedi}`,
                editText: triggerEditText,
                label: getTriggerFriendlyName(triggerText),
                icon: getConnectorIcon(channel, pillIconClass) || getPillCapabilityIcon('trigger'),
                selected: pillMenuState?.editText === triggerEditText,
                onMouseDown: (e: React.MouseEvent<HTMLSpanElement>) => handlePillMouseDown(triggerEditText, getTriggerFriendlyName(triggerText), 'trigger', e),
                onClick: handlePillClick,
              })
            : React.createElement(
                'span',
                {
                  key: `trigger-${lineIndex}-${capturedi}`,
                  'data-edit-text': triggerEditText,
                  contentEditable: false,
                  style: pillSpanStyle,
                  className: 'bg-gray-50 transition-colors hover:bg-gray-100',
                },
                (getConnectorIcon(channel, pillIconClass) || getPillCapabilityIcon('trigger')) && React.createElement(
                  'span',
                  { style: { display: 'flex', alignItems: 'center', flexShrink: 0 } },
                  getConnectorIcon(channel, pillIconClass) || getPillCapabilityIcon('trigger')
                ),
                getTriggerFriendlyName(triggerText)
              ),
        });
      }
    }

    // 2. Standalone [[...]] badge tokens (skip those already covered by iconTriggerRe)
    const badgeRe = /\[\[([^\]]+)\]\]/g;
    while ((m = badgeRe.exec(text)) !== null) {
      if (overlaps(m.index, m.index + m[0].length)) continue;
      const isTool = m[1].startsWith('Tool: ');
      const badgeText = isTool ? m[1].substring(6) : m[1];
      if (badgeText?.trim()) {
        // "Add a trigger" renders as plain disabled placeholder text, not a pill
        if (badgeText.trim() === 'Add a trigger') {
          const capturedi = partIndex++;
          pillMatches.push({
            start: m.index, end: m.index + m[0].length,
            node: React.createElement(
              'span',
              {
                key: `add-trigger-${lineIndex}-${capturedi}`,
                'data-edit-text': m[0],
                'data-placeholder': 'true',
                contentEditable: false,
                className: 'text-gray-400',
              },
              'Add a trigger'
            ),
          });
          continue;
        }
        const editText = m[0];
        const badgeType: 'knowledge' | 'action' | 'connector' | 'trigger' =
          isTool ? 'action' :
          capabilities.find(cap => cap.label === badgeText || getServiceShortLabel(cap.label) === badgeText)?.type ??
          (KNOWN_TRIGGERS.includes(badgeText) ? 'trigger' : 'knowledge');
        const pillIcon = badgeType === 'trigger'
          ? getTriggerPillIcon(badgeText)
          : getServiceIconForLabel(badgeText, badgeType);
        const pillLabel = isTool ? formatActionDisplayName(badgeText)
          : badgeType === 'trigger' ? getTriggerFriendlyName(badgeText)
          : badgeType === 'knowledge'
            ? getServiceShortLabel(badgeText).replace(/\s*\([Vv]\d+\)$|\s+[Vv]\d+$/i, '').trim()
            : formatActionDisplayName(badgeText).replace(/\s*\([Vv]\d+\)$|\s+[Vv]\d+$/i, '').trim();
        const pillLabelStripped = isPillContextMenu
          ? (isTool ? formatActionDisplayName(badgeText)
              : badgeType === 'trigger' ? getTriggerFriendlyName(badgeText)
              : stripAllPrefixes(badgeText).replace(/\s*\([Vv]\d+\)$|\s+[Vv]\d+$/i, '').trim())
          : pillLabel;
        const capturedi = partIndex++;
        const isPillErrored = activePillErrorLabels.has(badgeText) || activePillErrorLabels.has(pillLabelStripped);
        // Errored pills always render as ComponentPill so the error state (red border/text) is visible,
        // regardless of the isPillContextMenu feature toggle.
        const useComponentPill = isPillContextMenu || isPillErrored;
        pillMatches.push({
          start: m.index, end: m.index + m[0].length,
          node: useComponentPill
            ? React.createElement(ComponentPill, {
                key: `badge-${lineIndex}-${capturedi}`,
                editText,
                label: pillLabelStripped,
                icon: pillIcon || undefined,
                selected: !isPillErrored && pillMenuState?.editText === editText,
                error: isPillErrored,
                onMouseDown: isPillErrored
                  ? undefined
                  : (e: React.MouseEvent<HTMLSpanElement>) => handlePillMouseDown(editText, pillLabelStripped, badgeType, e),
                onClick: isPillErrored
                  ? () => {
                      const err = SIMULATED_ERRORS.find(e => e.affectedResource === badgeText || e.affectedResource === pillLabelStripped);
                      if (err) {
                        setPendingHelperQuote({
                          label: err.affectedResource,
                          type: 'instruction',
                          errorTitle: err.errorCode,
                          error: err.errorMessage,
                          shortQuestion: `What's wrong with the ${err.affectedResource} step, and how do I fix it?`,
                          context: err.errorMessage,
                        });
                        setIsHelperCollapsed(false);
                      }
                    }
                  : handlePillClick,
              })
            : React.createElement(
                'span',
                {
                  key: `badge-${lineIndex}-${capturedi}`,
                  'data-edit-text': editText,
                  contentEditable: false,
                  style: pillSpanStyle,
                  className: 'bg-gray-50 transition-colors hover:bg-gray-100',
                },
                pillIcon && React.createElement(
                  'span',
                  { style: { display: 'flex', alignItems: 'center', flexShrink: 0 } },
                  pillIcon
                ),
                pillLabel
              ),
        });
      }
    }

    // 3. Capability name matches (plain text, from agentConfig.capabilities)
    capabilities.forEach(cap => {
      const capName = cap.label;
      const shortLabel = getServiceShortLabel(capName);
      const labelsToMatch = shortLabel !== capName ? [capName, shortLabel] : [capName];
      labelsToMatch.forEach(matchLabel => {
        let from = 0;
        while (from < text.length) {
          const idx = text.indexOf(matchLabel, from);
          if (idx === -1) break;
          const end = idx + matchLabel.length;
          if (!overlaps(idx, end)) {
            const capturedi = partIndex++;
            const capPillLabel = (cap.type === 'action' || cap.type === 'connector')
              ? formatActionDisplayName(cap.label)
              : shortLabel.replace(/\s*\([Vv]\d+\)$|\s+[Vv]\d+$/i, '').trim();
            const capPillLabelStripped = isPillContextMenu
              ? ((cap.type === 'action' || cap.type === 'connector')
                  ? formatActionDisplayName(cap.label)
                  : stripAllPrefixes(cap.label).replace(/\s*\([Vv]\d+\)$|\s+[Vv]\d+$/i, '').trim())
              : capPillLabel;
            pillMatches.push({
              start: idx, end,
              node: isPillContextMenu
                ? React.createElement(ComponentPill, {
                    key: `cap-${lineIndex}-${cap.id}-${matchLabel}-${capturedi}`,
                    editText: capName,
                    label: capPillLabelStripped,
                    icon: getServiceIconForLabel(cap.label, cap.type) || undefined,
                    selected: pillMenuState?.editText === capName,
                    onMouseDown: (e: React.MouseEvent<HTMLSpanElement>) => handlePillMouseDown(capName, capPillLabelStripped, cap.type, e),
                    onClick: handlePillClick,
                  })
                : React.createElement(
                    'span',
                    {
                      key: `cap-${lineIndex}-${cap.id}-${matchLabel}-${capturedi}`,
                      'data-edit-text': capName,
                      contentEditable: false,
                      style: pillSpanStyle,
                      className: 'bg-gray-50 transition-colors hover:bg-gray-100',
                    },
                    getServiceIconForLabel(cap.label, cap.type) && React.createElement(
                      'span',
                      { style: { display: 'flex', alignItems: 'center', flexShrink: 0 } },
                      getServiceIconForLabel(cap.label, cap.type)
                    ),
                    capPillLabel
                  ),
            });
          }
          from = idx + 1;
        }
      });
    });

    // 4. KNOWN_TRIGGERS plain-text fallback (for triggers referenced without markup)
    for (const triggerName of KNOWN_TRIGGERS) {
      let from = 0;
      while (from < text.length) {
        const idx = text.indexOf(triggerName, from);
        if (idx === -1) break;
        const end = idx + triggerName.length;
        if (!overlaps(idx, end)) {
          const capturedi = partIndex++;
          pillMatches.push({
            start: idx, end,
            node: isPillContextMenu
              ? React.createElement(ComponentPill, {
                  key: `trigger-plain-${lineIndex}-${capturedi}`,
                  editText: triggerName,
                  label: getTriggerFriendlyName(triggerName),
                  icon: getServiceIconForLabel(triggerName, 'trigger') || undefined,
                  selected: pillMenuState?.editText === triggerName,
                  onMouseDown: (e: React.MouseEvent<HTMLSpanElement>) => handlePillMouseDown(triggerName, getTriggerFriendlyName(triggerName), 'trigger', e),
                  onClick: handlePillClick,
                })
              : React.createElement(
                  'span',
                  {
                    key: `trigger-plain-${lineIndex}-${capturedi}`,
                    'data-edit-text': triggerName,
                    contentEditable: false,
                    style: pillSpanStyle,
                    className: 'bg-gray-50 transition-colors hover:bg-gray-100',
                  },
                  getServiceIconForLabel(triggerName, 'trigger') && React.createElement(
                    'span',
                    { style: { display: 'flex', alignItems: 'center', flexShrink: 0 } },
                    getServiceIconForLabel(triggerName, 'trigger')
                  ),
                  getTriggerFriendlyName(triggerName)
                ),
          });
        }
        from = idx + 1;
      }
    }

    // Render **bold** markdown in a text string
    const renderBold = (str: string): React.ReactNode => {
      const boldParts = str.split(/(\*\*[^*]+\*\*)/g);
      if (boldParts.length === 1) return str;
      return boldParts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return React.createElement('strong', { key: i }, part.slice(2, -2));
        }
        return part;
      });
    };

    if (pillMatches.length === 0) return renderBold(text);

    // Sort by start position and build the output
    pillMatches.sort((a, b) => a.start - b.start);
    const parts: (string | React.ReactNode)[] = [];
    let lastEnd = 0;
    for (const pill of pillMatches) {
      if (pill.start < lastEnd) continue; // skip any remaining overlaps
      if (pill.start > lastEnd) parts.push(renderBold(text.substring(lastEnd, pill.start)));
      parts.push(pill.node);
      lastEnd = pill.end;
    }
    if (lastEnd < text.length) parts.push(renderBold(text.substring(lastEnd)));
    return parts;
  };

  const renderInstructionsWithFormatting = (text: string, diffLines?: DiffLine[], highlightAllChanges?: boolean, isStatic?: boolean): React.ReactElement => {
    // Pre-process diffLines into lookup structures so the existing per-line
    // rendering logic can stay mostly unchanged.
    let addLineSet: Set<number> | null = null;
    let charSegmentMap: Map<number, CharSegment[]> | null = null;
    // Maps newLineIndex → del texts to render (as strikethrough) before that line.
    // Key === lines.length means "after the last visible line".
    let delLinesMap: Map<number, string[]> | null = null;

    if (diffLines) {
      addLineSet = new Set<number>();
      charSegmentMap = new Map<number, CharSegment[]>();
      delLinesMap = new Map<number, string[]>();
      let newIdx = 0;
      let pendingDels: string[] = [];
      for (const dl of diffLines) {
        if (dl.type === 'del') {
          pendingDels.push(dl.text);
        } else {
          if (pendingDels.length > 0) {
            delLinesMap.set(newIdx, [...pendingDels]);
            pendingDels = [];
          }
          if (dl.type === 'add' && dl.charSegments) {
            charSegmentMap.set(newIdx, dl.charSegments);
          } else if (dl.type === 'add') {
            addLineSet.add(newIdx);
          }
          newIdx++;
        }
      }
      if (pendingDels.length > 0) {
        delLinesMap.set(newIdx, pendingDels);
      }
    }

    const hlWrap = (i: number, content: React.ReactNode): React.ReactNode =>
      addLineSet?.has(i)
        ? React.createElement('span', { 'data-review-highlight': 'true', className: 'rounded px-[1px] pt-[1px] pb-[2px] -mx-[1px]' }, content)
        : content;

    const lines = text.split('\n');
    const elements: React.ReactElement[] = [];
    const isChangedArr: boolean[] = [];
    let currentList: React.ReactElement[] = [];
    let currentListChanged: boolean[] = [];
    let currentListType: 'bullet' | 'dash' | null = null;

    const flushList = () => {
      if (currentList.length > 0) {
        const processedList = currentList.map((el, i) => {
          if (!currentListChanged[i]) return el;
          const prevChanged = i > 0 && currentListChanged[i - 1];
          const nextChanged = i < currentList.length - 1 && currentListChanged[i + 1];
          if (!prevChanged && !nextChanged) return el;
          const pos = prevChanged && nextChanged ? 'middle' : prevChanged ? 'last' : 'first';
          return React.cloneElement(el, { 'data-bar-pos': pos } as React.HTMLAttributes<HTMLElement>);
        });
        elements.push(
          React.createElement(
            'ul',
            { key: `list-${elements.length}`, className: isNarrowPreview ? 'space-y-1 my-2' : 'space-y-1.5 my-3' },
            ...processedList
          )
        );
        isChangedArr.push(currentListChanged.some(c => c));
        currentList = [];
        currentListChanged = [];
        currentListType = null;
      }
    };

    // Helper: render a single line with full markdown formatting, using a provided wrap function.
    const renderFormattedLineElement = (
      text: string,
      key: string | number,
      wrap: (content: React.ReactNode) => React.ReactNode
    ): React.ReactElement => {
      const trimmed = text.trim();
      const lineIdx = typeof key === 'number' ? key : 0;
      if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
        return React.createElement('h1', { key, style: { fontWeight: 700 }, className: `text-gray-900 leading-relaxed ${isNarrowPreview ? 'text-body-1-strong mt-4 mb-2' : 'text-subtitle-2 mt-6 mb-3'}` },
          wrap(renderLineWithPills(trimmed.substring(2), lineIdx)));
      } else if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
        return React.createElement('h2', { key, style: { fontWeight: 600 }, className: `text-gray-900 leading-relaxed ${isNarrowPreview ? 'text-body-2-strong mt-3 mb-1.5' : 'text-body-1-strong mt-6 mb-3'}` },
          wrap(renderLineWithPills(trimmed.substring(3), lineIdx)));
      } else if (trimmed.startsWith('### ')) {
        return React.createElement('h3', { key, style: { fontWeight: 600 }, className: `text-gray-900 leading-relaxed ${isNarrowPreview ? 'text-caption-1-strong mt-2 mb-1' : 'text-body-2-strong mt-4 mb-2'}` },
          wrap(renderLineWithPills(trimmed.substring(4), lineIdx)));
      } else if (trimmed.startsWith('• ') || trimmed === '•') {
        const itemText = trimmed.length > 2 ? trimmed.substring(2) : '';
        return React.createElement('div', { key, className: `flex items-start ${isNarrowPreview ? 'gap-1 my-1.5' : 'gap-2 my-2'} leading-relaxed` },
          React.createElement('span', { className: 'text-gray-400 mt-0.5 flex-shrink-0', contentEditable: false }, '•'),
          React.createElement('span', { className: 'flex-1 min-w-0 text-gray-900' }, wrap(renderLineWithPills(itemText, lineIdx))));
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed === '-' || trimmed === '−') {
        const itemText = (trimmed === '-' || trimmed === '−') ? '' : trimmed.substring(2);
        return React.createElement('div', { key, className: `flex items-start ${isNarrowPreview ? 'gap-1 my-1.5' : 'gap-2 my-2'} leading-relaxed` },
          React.createElement('span', { className: 'text-gray-400 mt-0.5 flex-shrink-0', contentEditable: false }, '−'),
          React.createElement('span', { className: 'flex-1 min-w-0 text-gray-900' }, wrap(renderLineWithPills(itemText, lineIdx))));
      } else {
        return React.createElement('div', { key, className: `${isNarrowPreview ? 'my-1.5 leading-relaxed' : 'my-2 leading-relaxed'}` },
          wrap(renderLineWithPills(trimmed, lineIdx)));
      }
    };

    // Helper: render any pending del lines before a given visible line index.
    // Intentional: deleted lines (and inline del segments below) are only rendered when
    // highlightAllChanges is true. Added text is always highlighted regardless of the toggle.
    // This matches the Components panel: added capabilities are always shown with brand highlight;
    // removed capabilities are hidden until the user enables "Show all changes".
    const insertDelLines = (idx: number) => {
      if (!delLinesMap || !highlightAllChanges) return;
      const dels = delLinesMap.get(idx);
      if (!dels) return;
      dels.forEach((delText, di) => {
        const trimmedDel = delText.trim();
        const delWrap = (content: React.ReactNode) =>
          React.createElement('span', { 'data-review-deleted': 'true', className: 'rounded px-[1px] pt-[1px] pb-[2px] -mx-[1px]' }, content);
        const isBulletDel = trimmedDel.startsWith('• ') || trimmedDel === '•';
        const isDashDel = trimmedDel.startsWith('- ') || trimmedDel.startsWith('* ') || trimmedDel === '-' || trimmedDel === '−';
        // If the deleted line is a list item matching the current (or about-to-start) list type,
        // keep it inside the list as an <li> so adjacent bars can merge across del/add pairs.
        if (isBulletDel && (currentListType === 'bullet' || currentListType === null)) {
          if (currentListType === null) currentListType = 'bullet';
          const itemText = trimmedDel.length > 2 ? trimmedDel.substring(2) : '';
          currentList.push(
            React.createElement(
              'li',
              { key: `del-${idx}-${di}`, className: `flex items-start ${isNarrowPreview ? 'gap-1' : 'gap-2'}` },
              React.createElement('span', { className: 'text-gray-400 mt-0.5 flex-shrink-0', contentEditable: false }, '•'),
              React.createElement('span', { className: 'flex-1 min-w-0 text-gray-900' }, delWrap(renderLineWithPills(itemText, -1)))
            )
          );
          currentListChanged.push(true);
        } else if (isDashDel && (currentListType === 'dash' || currentListType === null)) {
          if (currentListType === null) currentListType = 'dash';
          const itemText = (trimmedDel === '-' || trimmedDel === '−') ? '' : trimmedDel.substring(2);
          currentList.push(
            React.createElement(
              'li',
              { key: `del-${idx}-${di}`, className: `flex items-start ${isNarrowPreview ? 'gap-1' : 'gap-2'}` },
              React.createElement('span', { className: 'text-gray-400 mt-0.5 flex-shrink-0', contentEditable: false }, '−'),
              React.createElement('span', { className: 'flex-1 min-w-0 text-gray-900' }, delWrap(renderLineWithPills(itemText, -1)))
            )
          );
          currentListChanged.push(true);
        } else {
          // Non-list del line or type mismatch — flush and add as a standalone div.
          flushList();
          elements.push(renderFormattedLineElement(delText, `del-${idx}-${di}`, delWrap));
          isChangedArr.push(true);
        }
      });
    };

    lines.forEach((line, lineIndex) => {
      // Insert any del lines that belong before this visible line.
      insertDelLines(lineIndex);

      // Char-diff line: render with per-segment wrapping, respecting line type.
      if (charSegmentMap?.has(lineIndex)) {
        const segs = charSegmentMap.get(lineIndex)!;
        const trimmedForKind = line.trim();

        // Detect structural type from the new line text (same logic as normal path).
        type LineKind = 'h1' | 'h2' | 'h3' | 'bullet' | 'dash' | 'div';
        let lineKind: LineKind = 'div';
        let structPrefix = '';
        if (trimmedForKind.startsWith('### ')) { lineKind = 'h3'; structPrefix = '### '; }
        else if (trimmedForKind.startsWith('## ')) { lineKind = 'h2'; structPrefix = '## '; }
        else if (trimmedForKind.startsWith('# ')) { lineKind = 'h1'; structPrefix = '# '; }
        else if (trimmedForKind.startsWith('• ') || trimmedForKind === '•') { lineKind = 'bullet'; structPrefix = '• '; }
        else if (trimmedForKind.startsWith('- ')) { lineKind = 'dash'; structPrefix = '- '; }
        else if (trimmedForKind.startsWith('* ')) { lineKind = 'dash'; structPrefix = '* '; }

        if (lineKind !== 'bullet' && lineKind !== 'dash') flushList();

        // Strip the structural prefix from the first non-del segment(s) so it isn't
        // rendered as visible text (the element type conveys structure instead).
        let prefixLeft = structPrefix;
        const strippedSegs = segs.map(seg => {
          if (!prefixLeft || seg.type === 'del') return seg;
          if (seg.text.startsWith(prefixLeft)) {
            const result = { ...seg, text: seg.text.substring(prefixLeft.length) };
            prefixLeft = '';
            return result;
          }
          if (prefixLeft.startsWith(seg.text)) {
            prefixLeft = prefixLeft.substring(seg.text.length);
            return { ...seg, text: '' };
          }
          return seg;
        });

        const segEls: React.ReactNode[] = [];
        strippedSegs.forEach((seg, sIdx) => {
          if (!seg.text && seg.type !== 'del') return;
          const rendered = renderLineWithPills(seg.text, lineIndex * 1000 + sIdx);
          if (seg.type === 'add') {
            segEls.push(React.createElement('span', { key: sIdx, 'data-review-highlight': 'true', className: 'rounded px-[1px] pt-[1px] pb-[2px] -mx-[1px]' }, rendered));
          } else if (seg.type === 'del') {
            if (highlightAllChanges) segEls.push(React.createElement('span', { key: sIdx, 'data-review-deleted': 'true', className: 'rounded px-[1px] pt-[1px] pb-[2px] -mx-[1px]' }, rendered));
          } else {
            segEls.push(React.createElement('span', { key: sIdx }, rendered));
          }
        });

        if (lineKind === 'h1' || lineKind === 'h2' || lineKind === 'h3') {
          const headingCls =
            lineKind === 'h1' ? `text-gray-900 leading-relaxed ${isNarrowPreview ? 'text-body-1-strong mt-4 mb-2' : 'text-subtitle-2 mt-6 mb-3'}`
            : lineKind === 'h2' ? `text-gray-900 leading-relaxed ${isNarrowPreview ? 'text-body-2-strong mt-3 mb-1.5' : 'text-body-1-strong mt-6 mb-3'}`
            : `text-gray-900 leading-relaxed ${isNarrowPreview ? 'text-caption-1-strong mt-2 mb-1' : 'text-body-2-strong mt-4 mb-2'}`;
          const headingStyle = lineKind === 'h1' ? { fontWeight: 700 } : { fontWeight: 600 };
          elements.push(React.createElement(lineKind, { key: lineIndex, style: headingStyle, className: headingCls }, segEls));
          isChangedArr.push(true);
        } else if (lineKind === 'bullet' || lineKind === 'dash') {
          const icon = lineKind === 'bullet' ? '•' : '−';
          if (currentListType !== lineKind) { flushList(); currentListType = lineKind; }
          currentList.push(
            React.createElement('li', { key: lineIndex, className: `flex items-start ${isNarrowPreview ? 'gap-1' : 'gap-2'}` },
              React.createElement('span', { className: 'text-gray-400 mt-0.5 flex-shrink-0', contentEditable: false }, icon),
              React.createElement('span', { className: 'flex-1 min-w-0 text-gray-900' }, segEls)
            )
          );
          currentListChanged.push(true);
        } else {
          elements.push(
            React.createElement('div', {
              key: lineIndex,
              className: `${isNarrowPreview ? 'my-1.5 leading-relaxed' : 'my-2 leading-relaxed'}`,
            }, segEls)
          );
          isChangedArr.push(true);
        }
        return; // skip the normal line rendering below
      }

      const trimmed = line.trim();

      if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
        flushList();
        const headerText = trimmed.substring(2);
        elements.push(
          React.createElement(
            'h1',
            {
              key: lineIndex,
              style: { fontWeight: 700 },
              className: `text-gray-900 leading-relaxed ${isNarrowPreview ? 'text-body-1-strong mt-4 mb-2' : 'text-subtitle-2 mt-6 mb-3'}`,
            },
            hlWrap(lineIndex, renderLineWithPills(headerText, lineIndex))
          )
        );
        isChangedArr.push(addLineSet?.has(lineIndex) ?? false);
      } else if (trimmed.startsWith('## ')) {
        flushList();
        const headerText = trimmed.substring(3);
        elements.push(
          React.createElement(
            'h2',
            {
              key: lineIndex,
              style: { fontWeight: 600 },
              className: `text-gray-900 leading-relaxed ${isNarrowPreview ? 'text-body-2-strong mt-3 mb-1.5' : 'text-body-1-strong mt-6 mb-3'}`,
            },
            hlWrap(lineIndex, renderLineWithPills(headerText, lineIndex))
          )
        );
        isChangedArr.push(addLineSet?.has(lineIndex) ?? false);
      } else if (trimmed.startsWith('### ')) {
        flushList();
        const headerText = trimmed.substring(4);
        elements.push(
          React.createElement(
            'h3',
            {
              key: lineIndex,
              style: { fontWeight: 600 },
              className: `text-gray-900 leading-relaxed ${isNarrowPreview ? 'text-caption-1-strong mt-2 mb-1' : 'text-body-2-strong mt-4 mb-2'}`,
            },
            hlWrap(lineIndex, renderLineWithPills(headerText, lineIndex))
          )
        );
        isChangedArr.push(addLineSet?.has(lineIndex) ?? false);
      } else if (trimmed.startsWith('• ') || trimmed === '•') {
        if (currentListType !== 'bullet') {
          flushList();
          currentListType = 'bullet';
        }
        const itemText = trimmed.length > 2 ? trimmed.substring(2) : '';
        currentList.push(
          React.createElement(
            'li',
            { key: lineIndex, className: `flex items-start ${isNarrowPreview ? 'gap-1' : 'gap-2'}` },
            React.createElement('span', { className: 'text-gray-400 mt-0.5 flex-shrink-0', contentEditable: false }, '•'),
            React.createElement('span', { className: 'flex-1 min-w-0 text-gray-900' }, hlWrap(lineIndex, renderLineWithPills(itemText, lineIndex)))
          )
        );
        currentListChanged.push(addLineSet?.has(lineIndex) ?? false);
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed === '-' || trimmed === '−') {
        if (currentListType !== 'dash') {
          flushList();
          currentListType = 'dash';
        }
        const itemText = trimmed.length > 2 ? trimmed.substring(2) : '';
        currentList.push(
          React.createElement(
            'li',
            { key: lineIndex, className: `flex items-start ${isNarrowPreview ? 'gap-1' : 'gap-2'}` },
            React.createElement('span', { className: 'text-gray-400 mt-0.5 flex-shrink-0', contentEditable: false }, '−'),
            React.createElement('span', { className: 'flex-1 min-w-0 text-gray-900' }, hlWrap(lineIndex, renderLineWithPills(itemText, lineIndex)))
          )
        );
        currentListChanged.push(addLineSet?.has(lineIndex) ?? false);
      } else if (trimmed === '') {
        flushList();
      } else if (/^\[(?!\[)[^\]]+\]/.test(trimmed) || KNOWN_TRIGGERS.some(t => trimmed.startsWith(t))) {
        // Determine trigger name and trailing description from either format:
        //   [Teams - AtMention] description   (LLM wraps in single brackets)
        //   Teams - AtMention description     (LLM omits brackets)
        // Note: double-bracket [[...]] lines are intentionally excluded here — they go to renderLineWithPills → badgeRe.
        let triggerName: string;
        let description: string;
        const bracketMatch = trimmed.match(/^\[([^\]]+)\]\s*(.*)/);
        if (bracketMatch) {
          triggerName = bracketMatch[1];
          description = bracketMatch[2];
        } else {
          const matched = KNOWN_TRIGGERS.find(t => trimmed.startsWith(t))!;
          triggerName = matched;
          description = trimmed.substring(matched.length).trim();
        }

        const dashIdx = triggerName.indexOf(' - ');
        const serviceKey = dashIdx !== -1 ? triggerName.substring(0, dashIdx).toLowerCase() : null;
        const serviceIcon = serviceKey ? getChannelIcon(serviceKey, pillIconClass) : getServiceIconForLabel(triggerName);

        flushList();
        elements.push(
          React.createElement(
            'div',
            { key: lineIndex, className: `${isNarrowPreview ? 'my-1.5 leading-relaxed' : 'my-2 leading-relaxed'}` },
            hlWrap(lineIndex, [
              isPillContextMenu
                ? React.createElement(ComponentPill, {
                    key: 'pill',
                    editText: triggerName,
                    label: getTriggerFriendlyName(triggerName),
                    icon: serviceIcon || getPillCapabilityIcon('trigger'),
                    selected: pillMenuState?.editText === triggerName,
                    onMouseDown: (e: React.MouseEvent<HTMLSpanElement>) => handlePillMouseDown(triggerName, getTriggerFriendlyName(triggerName), 'trigger', e),
                    onClick: handlePillClick,
                  })
                : React.createElement(
                    'span',
                    { key: 'pill', style: pillSpanStyle, className: 'bg-gray-50 transition-colors hover:bg-gray-100 cursor-pointer' },
                    (serviceIcon || getPillCapabilityIcon('trigger')) && React.createElement(
                      'span',
                      { style: { display: 'flex', alignItems: 'center', flexShrink: 0 } },
                      serviceIcon || getPillCapabilityIcon('trigger')
                    ),
                    getTriggerFriendlyName(triggerName)
                  ),
              description && React.createElement('span', { key: 'desc', className: 'ml-2' }, description),
            ])
          )
        );
        isChangedArr.push(addLineSet?.has(lineIndex) ?? false);
      } else if (trimmed.startsWith('Where this agent works:')) {
        flushList();
        const content = trimmed.substring('Where this agent works:'.length).trim();
        type WtaToken = { iconKey: string | null; triggerName: string; isConversational: boolean; editText: string; };
        const conversationalTokens: WtaToken[] = [];
        const eventTokens: WtaToken[] = [];

        // Parse {{icon:key}} [[TriggerName]] tokens first
        const wtaIconRe = /\{\{icon:([\w\s]+?)\}\}\s*\[\[([^\]]+)\]\]/g;
        let wtaM: RegExpExecArray | null;
        const coveredIndices = new Set<number>();
        while ((wtaM = wtaIconRe.exec(content)) !== null) {
          for (let i = wtaM.index; i < wtaM.index + wtaM[0].length; i++) coveredIndices.add(i);
          const iconKey = wtaM[1].toLowerCase();
          const triggerName = wtaM[2];
          const isConversational = CONVERSATIONAL_CHANNEL_KEYS.has(iconKey)
            || (iconKey === 'sharepoint' && triggerName.toLowerCase().includes('chats'));
          (isConversational ? conversationalTokens : eventTokens).push({ iconKey, triggerName, isConversational, editText: wtaM[0] });
        }

        // Then parse standalone [[TriggerName]] tokens not already covered
        const wtaBadgeRe = /\[\[([^\]]+)\]\]/g;
        while ((wtaM = wtaBadgeRe.exec(content)) !== null) {
          if (coveredIndices.has(wtaM.index)) continue;
          const triggerName = wtaM[1];
          if (triggerName.trim() === 'Add a trigger') continue; // handled by fallback
          const ch = getTriggerChannel(triggerName)?.toLowerCase() ?? '';
          const isConversational = CONVERSATIONAL_CHANNEL_KEYS.has(ch)
            || (ch === 'sharepoint' && triggerName.toLowerCase().includes('chats'));
          (isConversational ? conversationalTokens : eventTokens).push({ iconKey: ch || null, triggerName, isConversational, editText: wtaM[0] });
        }

        const softDeletedNames = agentConfig.softDeletedTriggers ?? [];

        const makeWtaPill = (token: WtaToken, keyPrefix: string, idx: number): React.ReactElement => {
          const iconNode = token.iconKey
            ? (getConnectorIcon(token.iconKey, pillIconClass) || getPillCapabilityIcon('trigger'))
            : getPillCapabilityIcon('trigger');
          const di = token.triggerName.indexOf(' - ');
          const label = getTriggerFriendlyName(token.triggerName);
          const handleClick = onOpenTrigger ? (e: MouseEvent) => {
            e.stopPropagation();
            const source = di !== -1 ? token.triggerName.substring(0, di) : (token.iconKey ?? 'Others');
            onOpenTrigger({ id: `trigger-${token.triggerName}`, name: token.triggerName, description: '', type: 'trigger', source });
          } : undefined;

          // Soft-deleted pill — grayed out with "Removed" badge
          // Match by exact name or by channel (softDeletedTriggers stores raw trigger names,
          // token.triggerName is parsed from instructions — they may differ)
          const tokenChannel = token.iconKey || getTriggerChannel(token.triggerName);
          const isSoftDeleted = softDeletedNames.some(sd =>
            sd === token.triggerName || (tokenChannel && getTriggerChannel(sd) === tokenChannel)
          );
          if (isSoftDeleted) {
            const softDeletedStyle = { ...pillSpanStyle, borderStyle: 'dashed' as const, borderColor: '#D1D5DB' };
            return React.createElement(
              'span',
              { key: `${keyPrefix}-${idx}`, 'data-edit-text': token.editText, contentEditable: false, style: softDeletedStyle, className: 'bg-gray-100 transition-colors hover:bg-gray-200 cursor-pointer', onClick: handleClick },
              iconNode && React.createElement('span', { style: { display: 'flex', alignItems: 'center', flexShrink: 0, filter: 'grayscale(100%)', opacity: 0.5 } }, iconNode),
              React.createElement('span', { style: { textDecoration: 'line-through', color: '#9CA3AF' } }, label),
              React.createElement('span', { style: { fontSize: '0.625rem', fontWeight: 600, color: '#DC2626', marginLeft: '4px', backgroundColor: '#FEE2E2', padding: '0 4px', borderRadius: '4px', lineHeight: '1.4' } }, 'Removed'),
            );
          }

          // Show contextual nudge on Teams/M365 pills based on publish + distribution state
          const distKey = token.iconKey;
          // iconKey is 'm365' but triggerDistribution is keyed by 'microsoft 365'
          const distChannel = distKey === 'm365' ? 'microsoft 365' : distKey;
          const isTeamsOrM365 = distKey === 'teams' || distKey === 'm365' || distKey === 'microsoft 365';
          const isSharePoint = distKey === 'sharepoint';
          const distState = agentConfig.triggerDistribution?.[distChannel ?? ''];
          const isFullyDistributed = distState?.everyone && distState?.approved;
          const isWaitingApproval = distState?.submitted && !distState?.approved;
          const channelLabel = distKey === 'teams' ? 'Teams' : distKey === 'sharepoint' ? 'SharePoint' : 'M365';
          // Check if THIS specific trigger was part of the last publish (not just any trigger).
          // Match on iconKey directly — more reliable than fuzzy label matching via getTriggerChannel.
          const isTriggerPublished = !!agentConfig.published && !!agentConfig.publishedTriggers?.some(
            t => {
              const pubChannel = t.iconKey === 'm365' ? 'microsoft 365' : t.iconKey;
              return distChannel && pubChannel === distChannel;
            }
          );
          let nudgeText: string | null = null;
          if (isTeamsOrM365) {
            nudgeText = isFullyDistributed
              ? null
              : isWaitingApproval
              ? 'Waiting for admin approval'
              : isTriggerPublished
              ? 'Not yet available to everyone in your org'
              : `Publish to make this agent available in ${channelLabel}`;
          } else if (isSharePoint) {
            nudgeText = !distState?.siteSelected
              ? 'Select a SharePoint site in the config panel'
              : !isTriggerPublished
              ? 'Publish to make this agent available in SharePoint'
              : null;
          } else if (distKey === 'whatsapp') {
            const waState = agentConfig.triggerDistribution?.whatsapp;
            nudgeText = !(waState?.whatsappSubscription && waState?.whatsappAcsResource && waState?.whatsappPhoneNumber)
              ? 'Select a phone number to connect your agent to WhatsApp'
              : !isTriggerPublished
              ? 'Publish to make this agent available in WhatsApp'
              : null;
          }
          const showNudge = distChannel != null && (isTeamsOrM365 || isSharePoint || distKey === 'whatsapp') && nudgeText != null;
          const showDistNudge = distChannel != null && isTriggerPublished && !isFullyDistributed;
          const nudgePillStyle = showNudge
            ? { ...pillSpanStyle, borderStyle: 'dashed', borderColor: 'hsl(var(--primary))' }
            : pillSpanStyle;
          const pill = React.createElement(
            'span',
            { key: `${keyPrefix}-${idx}`, 'data-edit-text': token.editText, contentEditable: false, style: nudgePillStyle, className: `${showNudge ? 'bg-[hsl(237_81%_96%)]' : 'bg-gray-50'} transition-colors hover:bg-gray-100 ${handleClick ? 'cursor-pointer' : ''}`, onClick: handleClick },
            iconNode && React.createElement('span', { style: { display: 'flex', alignItems: 'center', flexShrink: 0 } }, iconNode),
            label,
            showDistNudge && (isStatic
              ? React.createElement(Info16Regular, { style: { width: 12, height: 12, color: '#9CA3AF', marginLeft: 2, flexShrink: 0 } })
              : React.createElement(
                  Tooltip,
                  { content: 'Not yet available to everyone in your org', relationship: 'description' as const, positioning: 'above' as const, appearance: 'inverted' as const },
                  React.createElement(Info16Regular, { style: { width: 12, height: 12, color: '#9CA3AF', marginLeft: 2, cursor: 'help', flexShrink: 0 } })
                )
            )
          );
          return showNudge && !isStatic
            ? React.createElement(Tooltip, { key: `${keyPrefix}-${idx}-tip`, content: nudgeText ?? '', relationship: 'description' as const, positioning: 'above' as const, appearance: 'inverted' as const }, pill)
            : pill;
        };

        if (conversationalTokens.length === 0 && eventTokens.length === 0) {
          // No real trigger tokens found — fall back to plain rendering
          elements.push(React.createElement('div', { key: lineIndex, className: isNarrowPreview ? 'my-1.5 leading-relaxed' : 'my-2 leading-relaxed' }, renderLineWithPills(trimmed, lineIndex)));
        } else {
          const headingClass = `text-gray-900 ${isNarrowPreview ? 'text-body-1-strong mt-3 mb-1.5' : 'text-title-3 mt-6 mb-3'}`;
          const pillsClass = isNarrowPreview ? 'my-1.5 leading-relaxed' : 'my-2 leading-relaxed';
          elements.push(React.createElement('h2', { key: `${lineIndex}-h`, style: { fontWeight: 600 }, className: headingClass }, 'Runs when'));
          const allTokens = [...conversationalTokens, ...eventTokens];
          const inlineChildren: React.ReactNode[] = [];
          allTokens.forEach((token, i) => {
            if (i > 0) inlineChildren.push(React.createElement('span', { key: `sep-${i}` }, ', '));
            inlineChildren.push(makeWtaPill(token, 'trigger', i));
          });
          elements.push(React.createElement('div', { key: `${lineIndex}-pills`, className: pillsClass }, ...inlineChildren));
        }
        isChangedArr.push(addLineSet?.has(lineIndex) ?? false);
      } else if (trimmed.length > 0) {
        flushList();
        elements.push(
          React.createElement(
            'div',
            { key: lineIndex, className: `${isNarrowPreview ? 'my-1.5 leading-relaxed' : 'my-2 leading-relaxed'}` },
            hlWrap(lineIndex, renderLineWithPills(trimmed, lineIndex))
          )
        );
        isChangedArr.push(addLineSet?.has(lineIndex) ?? false);
      }
    });

    // Insert any del lines that appear after all visible content.
    insertDelLines(lines.length);

    flushList();

    // Add data-bar-pos to mark runs of adjacent changed lines for bar merging in CSS.
    // For <ul> elements, we propagate the position to boundary <li> children so that
    // bars can merge across separate <ul> elements (e.g. del-only lists split by empty lines).
    const finalElements = elements.map((el, i) => {
      if (!isChangedArr[i]) return el;
      // Headings are always isolated — their spacing prevents visual bar connection.
      if (el.type === 'h1' || el.type === 'h2' || el.type === 'h3') return el;
      const isHeading = (e: React.ReactElement) => e.type === 'h1' || e.type === 'h2' || e.type === 'h3';
      // A heading predecessor/successor breaks the run — don't extend toward it.
      const prevChanged = i > 0 && isChangedArr[i - 1] && !isHeading(elements[i - 1]);
      const nextChanged = i < elements.length - 1 && isChangedArr[i + 1] && !isHeading(elements[i + 1]);
      if (!prevChanged && !nextChanged) return el; // solo — no merging needed
      const pos = prevChanged && nextChanged ? 'middle' : prevChanged ? 'last' : 'first';

      // For <ul>: modify the boundary <li> children rather than the <ul> itself.
      if (el.type === 'ul') {
        const elAny = el as React.ReactElement<any>;
        const children = React.Children.toArray(elAny.props.children) as React.ReactElement<any>[];
        if (children.length === 0) return el;
        const updated = [...children];
        if (prevChanged) {
          const ep = updated[0].props['data-bar-pos'] as string | undefined;
          const np = ep === 'first' ? 'middle' : !ep ? 'last' : ep;
          if (np !== ep) updated[0] = React.cloneElement(updated[0], { 'data-bar-pos': np } as React.HTMLAttributes<HTMLElement>);
        }
        if (nextChanged) {
          const li = updated.length - 1;
          const ep = updated[li].props['data-bar-pos'] as string | undefined;
          const np = ep === 'last' ? 'middle' : !ep ? 'first' : ep;
          if (np !== ep) updated[li] = React.cloneElement(updated[li], { 'data-bar-pos': np } as React.HTMLAttributes<HTMLElement>);
        }
        return React.cloneElement(elAny, {}, ...updated);
      }

      return React.cloneElement(el, { 'data-bar-pos': pos } as React.HTMLAttributes<HTMLElement>);
    });

    return React.createElement(React.Fragment, null, ...finalElements);
  };

  // ── Pill menu helpers ────────────────────────────────────────────────────

  /** Find the ComponentItem that corresponds to a pill's editText. */
  const findComponentByEditText = (editText: string): ComponentItem | undefined => {
    // Direct name match
    let found = derivedComponentItems.find(item => item.name === editText || item.id === editText);
    if (found) return found;
    // Match short label against item name
    const short = getServiceShortLabel(editText);
    found = derivedComponentItems.find(item => item.name === short);
    if (found) return found;
    // Match [[Token]] against tool/trig/ref IDs
    if (editText.startsWith('[[') && editText.endsWith(']]')) {
      const token = editText.slice(2, -2);
      found = derivedComponentItems.find(item =>
        item.id === `tool-${token}` || item.id === `trig-${token}` || item.id === `ref-${token}`
      );
      if (found) return found;
      // Also try matching the inner token as a name
      found = derivedComponentItems.find(item => item.name === token || item.name === getServiceShortLabel(token));
      if (found) return found;
    }
    return undefined;
  };

  const typeLabels: Record<string, string> = {
    knowledge: 'Knowledge',
    action: 'Action',
    connector: 'Connector',
    trigger: 'Trigger',
    tool: 'Tool',
    agent: 'Agent',
  };

  // ── Pill menu element ────────────────────────────────────────────────────
  const pillMenuHeader = (() => {
    if (!pillMenuState) return null;
    const item = findComponentByEditText(pillMenuState.editText);
    const desc = item ? (componentDescriptions[item.id] || item.description) : undefined;
    const typeLabel = typeLabels[item?.type ?? pillMenuState.capType] ?? pillMenuState.capType;
    return React.createElement('div', null,
      React.createElement('div', { className: 'text-sm font-semibold text-gray-900' }, pillMenuState.label),
      React.createElement('span', { className: 'text-xs text-gray-500' }, typeLabel),
      desc ? React.createElement('p', { className: 'text-sm text-gray-900 mt-1.5 font-normal leading-snug' }, desc) : null,
    );
  })();

  const pillMenuElement = (isPillContextMenu && pillMenuState)
    ? React.createElement(CopilotMenu, {
        header: pillMenuHeader,
        items: getPillContextMenuItems(pillMenuState.editText, pillMenuState.capType, {
          onConfigure: (et: string) => { onPillConfigure?.(et, pillMenuState.label, pillMenuState.capType); closePillMenu(); },
          onDelete: (et: string) => { handlePillDelete(et); closePillMenu(); },
          componentToggles,
          setComponentToggles,
        }),
        position: pillMenuState.position,
        onClose: closePillMenu,
        minWidth: 160,
      })
    : null;

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    // State
    isEditing,
    setIsEditing,
    editableText,
    setEditableText,
    contentEditableKey,
    setContentEditableKey,
    showHeaderBorder,
    isStreaming,
    editableName,
    setEditableName,
    isEditingName,
    setIsEditingName,
    isEditingNameLarge,
    setIsEditingNameLarge,
    editableDescription,
    setEditableDescription,
    isEditingDescription,
    setIsEditingDescription,
    isEditingDescriptionLarge,
    setIsEditingDescriptionLarge,
    isTruncated,
    showDescriptionTooltip,
    setShowDescriptionTooltip,

    // Refs
    contentEditableRef,
    scrollContainerRef,
    instructionsBoxRef,
    nameEditRef,
    nameEditLargeRef,
    descriptionEditRef,
    descriptionEditLargeRef,
    descriptionDisplayRef,
    previousInstructionsLength,
    streamingTimeoutRef,
    previousConfig,
    draftTextRef,

    // Handlers
    handleUndo,
    handleRedo,
    readDOMIntoEditableText,
    handleBlur,
    handleContentClick,
    handleScroll,
    handleNameLargeClick,
    handleNameLargeBlur,
    handleNameLargeKeyDown,
    handleNameInput,
    handleDescriptionLargeClick,
    handleDescriptionInput,
    handleDescriptionLargeBlur,
    handleDescriptionLargeKeyDown,
    handleDescriptionClick,
    handleDescriptionBlur,
    handleDescriptionKeyDown,
    handleModelChange,
    handleIconSelect,
    flushDraft,

    // Render functions
    renderInstructionsWithFormatting,
    renderLineWithPills,

    // Pill context menu
    pillMenuElement,
  };
}
