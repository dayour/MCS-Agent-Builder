import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CopilotButton } from '../ui/CopilotButton';
import { CopilotFilterPill } from '../ui/CopilotFilterPill';
import { CopilotUnderlineTabs } from '../ui/CopilotUnderlineTabs';
import { CopilotTooltip } from '../ui/CopilotTooltip';
import { useAgent } from '../../context/AgentContext';
import {
  Add20Regular,
  Add20Filled,
  Add16Regular,
  TextAlignLeft20Regular,
  TextAlignLeft20Filled,
  Apps20Regular,
  Apps20Filled,
  PuzzlePiece20Regular,
  PuzzlePiece20Filled,
  ChevronUp20Regular,
  ChevronDown20Regular,
  ArrowUndo20Regular,
  ArrowUndo20Filled,
  ArrowRedo20Regular,
  ArrowRedo20Filled,
} from '@fluentui/react-icons';

const COMPONENT_FILTER_TABS = ['All', 'Skills', 'Triggers', 'Knowledge', 'Tools', 'Topics', 'Agents'] as const;
export type ComponentFilterTab = (typeof COMPONENT_FILTER_TABS)[number];

// ── MainContentEditable ───────────────────────────────────────────────────────
// Permanently memoized to prevent React reconciliation crashes.
// When the user types, the browser modifies the contentEditable DOM. Any React
// re-render that tries to reconcile children against that modified DOM will
// throw a "removeChild" error. By using `() => true`, React never re-renders
// this component — it only remounts when the parent changes the `key` prop
// (via contentEditableKey), at which point fresh children are applied cleanly.

const MainContentEditable = React.memo(
  function MainContentEditableInner({ onBlur, onClick, onKeyDown, onInput, onDragOver, onDrop, children, contentRef, isEditing, isStreaming, isNarrowPreview }: {
    onBlur: (e: React.FocusEvent<HTMLDivElement>) => void;
    onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
    onInput: (e: React.FormEvent<HTMLDivElement>) => void;
    onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
    onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
    children: React.ReactNode;
    contentRef: React.RefObject<HTMLDivElement | null>;
    isEditing: boolean;
    isStreaming: boolean;
    isNarrowPreview: boolean;
  }) {
    return (
      <div
        ref={contentRef}
        contentEditable={isEditing && !isStreaming}
        suppressContentEditableWarning
        onBlur={onBlur}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onInput={onInput}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`text-gray-900 text-sm outline-none cursor-text break-words [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-sm [&_h4]:text-sm [&_h5]:text-sm [&_h6]:text-sm [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold ${
          isStreaming ? 'pointer-events-none opacity-90' : ''
        } ${isNarrowPreview ? 'px-4 pb-2 pt-2' : 'px-5 pb-3 pt-0'}`}
      >
        {children}
      </div>
    );
  },
  () => true, // never re-render; only remount via key change
);

// ── InstructionsEditor ───────────────────────────────────────────────────────

export interface InstructionsEditorProps {
  isEditing: boolean;
  isStreaming: boolean;
  editableText: string;
  contentEditableKey: number;
  showHeaderBorder: boolean;
  isNarrowPreview: boolean;
  contentEditableRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  instructionsBoxRef: React.RefObject<HTMLDivElement | null>;
  addDropdownRef: React.RefObject<HTMLDivElement | null>;
  addButtonMenuOpen: boolean;
  addInsertionRangeRef: React.MutableRefObject<Range | null>;
  onAddButtonClick: () => void;
  onLineInsertClick?: (e: React.MouseEvent<HTMLButtonElement>, insertionRange: Range) => void;
  onBlur: () => void;
  onContentClick: (e: React.MouseEvent) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onInput: () => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  onScroll: () => void;
  renderedInstructions: React.ReactNode;
  slashMenuComponent?: React.ReactNode;
  activePanel: 'instructions' | 'components';
  onActivePanelChange: (panel: 'instructions' | 'components') => void;
  activeComponentFilter?: ComponentFilterTab;
  onComponentFilterChange?: (filter: ComponentFilterTab) => void;
  componentsContent: React.ReactNode;
  componentsHeaderActions?: React.ReactNode;
  isSkillsEnabled?: boolean;
  /** Number of components to display in the drawer bar */
  componentCount?: number;
  /** Called whenever the sticky header stuck state changes (wide layout only). Used by Layout to show/hide the agent icon. */
  onIsStuckChange?: (stuck: boolean) => void;
  /** Called on mousedown of a panel tab button — fires before blur so the DOM can be read while still intact. */
  onFlushDraft?: () => void;
  /** Hide the empty-instructions placeholder (e.g. during DW create when instructions will stream in) */
  hidePlaceholder?: boolean;
  /** When true, the sticky header (title, tabs, + Add button) is not rendered. */
  hideHeader?: boolean;
  /** Custom placeholder shown when editableText is empty. When provided, replaces the default agent-instructions placeholder. */
  placeholder?: string;
  /** Optional toolbar rendered between the header (or top of container) and the editable content area. */
  formattingBar?: React.ReactNode;
  /** Optional bar rendered at the bottom of the editor, inside the border. */
  footerBar?: React.ReactNode;
  /** When true, review highlights are active (adds data-review-state="active" to the content wrapper). */
  reviewHighlightActive?: boolean;
  /** When true, adds data-highlight-all="true" to enable left-margin change bars. */
  highlightAllChanges?: boolean;
}

export function InstructionsEditor({
  isEditing,
  isStreaming,
  editableText,
  contentEditableKey,
  showHeaderBorder,
  isNarrowPreview,
  contentEditableRef,
  scrollContainerRef,
  instructionsBoxRef,
  addDropdownRef,
  addButtonMenuOpen,
  addInsertionRangeRef,
  onAddButtonClick,
  onLineInsertClick,
  onBlur,
  onContentClick,
  onKeyDown,
  onInput,
  onDragOver,
  onDrop,
  onScroll,
  renderedInstructions,
  slashMenuComponent,
  activePanel,
  onActivePanelChange,
  activeComponentFilter,
  onComponentFilterChange,
  componentsContent,
  componentsHeaderActions,
  isSkillsEnabled = false,
  componentCount = 0,
  onIsStuckChange,
  onFlushDraft,
  hidePlaceholder,
  hideHeader = false,
  placeholder,
  formattingBar,
  footerBar,
  reviewHighlightActive,
  highlightAllChanges,
}: InstructionsEditorProps) {
  const { isBuildTabsEnabled, isInsertComponents, isComponentDrawer, isAgentGlobalUndo, undo, redo, canUndo, canRedo, isToolsDA } = useAgent();
  const componentFilterTabs = COMPONENT_FILTER_TABS.filter((tab) => {
    if (!isSkillsEnabled && tab === 'Skills') return false;
    if (isToolsDA && (tab === 'Triggers' || tab === 'Agents')) return false;
    return true;
  });

  useEffect(() => {
    if (!isSkillsEnabled && activeComponentFilter === 'Skills') {
      onComponentFilterChange?.('All');
    }
  }, [isSkillsEnabled, activeComponentFilter, onComponentFilterChange]);

  // ── Line hover insert button (isInsertComponents only) ─────────────────────
  const [lineHoverPos, setLineHoverPos] = useState<{ top: number; left: number } | null>(null);
  const hoveredLineElRef = useRef<Element | null>(null);
  const lineButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastVisualLineTopRef = useRef<number | null>(null);

  const handleEditorMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isInsertComponents || isNarrowPreview || !contentEditableRef.current) return;
    const ce = contentEditableRef.current;

    // Ignore the button itself
    if (lineButtonRef.current?.contains(e.target as Node)) return;

    // Only show while hovering inside the contentEditable bounds
    const ceRect = ce.getBoundingClientRect();
    if (
      e.clientX < ceRect.left || e.clientX > ceRect.right ||
      e.clientY < ceRect.top  || e.clientY > ceRect.bottom
    ) {
      setLineHoverPos(null);
      hoveredLineElRef.current = null;
      lastVisualLineTopRef.current = null;
      return;
    }

    // Find the block element (direct child of ce) the cursor is over — used by click handler
    let matchEl: Element | null = null;
    for (const child of Array.from(ce.children)) {
      const r = child.getBoundingClientRect();
      if (e.clientY >= r.top && e.clientY <= r.bottom) { matchEl = child; break; }
    }
    if (!matchEl) {
      setLineHoverPos(null);
      hoveredLineElRef.current = null;
      lastVisualLineTopRef.current = null;
      return;
    }
    hoveredLineElRef.current = matchEl;

    // Use caretRangeFromPoint to get the exact visual line rect at the cursor.
    // This handles multi-line paragraphs: each wrapped line gets its own rect.
    const caretRange = document.caretRangeFromPoint(e.clientX, e.clientY);
    let lineTop = e.clientY;
    let lineHeight = 22; // fallback estimate
    if (caretRange && caretRange.startContainer.nodeType === Node.TEXT_NODE) {
      const r = caretRange.cloneRange();
      const len = (caretRange.startContainer as Text).length;
      if (caretRange.startOffset < len) {
        r.setEnd(caretRange.startContainer, caretRange.startOffset + 1);
      }
      const rects = r.getClientRects();
      if (rects.length > 0) {
        lineTop = rects[0].top;
        lineHeight = rects[0].height;
      }
    }

    // Only reposition when the cursor enters a DIFFERENT visual line
    const lineTopRounded = Math.round(lineTop);
    if (lineTopRounded === lastVisualLineTopRef.current) return;
    lastVisualLineTopRef.current = lineTopRounded;

    const containerRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setLineHoverPos({
      top: lineTop - containerRect.top + lineHeight / 2 - 10,
      left: ceRect.left - containerRect.left - 18,
    });
  }, [isInsertComponents, isNarrowPreview, contentEditableRef]);

  const handleEditorMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const nextTarget = e.relatedTarget;
    if (nextTarget instanceof Node && lineButtonRef.current?.contains(nextTarget)) return;
    setLineHoverPos(null);
    hoveredLineElRef.current = null;
    lastVisualLineTopRef.current = null;
  }, []);

  const handleLineButtonClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const ce = contentEditableRef.current;
    const lineEl = hoveredLineElRef.current;
    if (!ce || !lineEl) return;

    const sel = window.getSelection();
    let insertRange: Range | null = null;

    // If the cursor is already inside the contentEditable, use that position
    if (sel && sel.rangeCount > 0) {
      const existing = sel.getRangeAt(0);
      if (ce.contains(existing.startContainer)) {
        insertRange = existing.cloneRange();
        insertRange.collapse(true);
      }
    }

    if (!insertRange) {
      // No cursor in editor — place at end of hovered line, or beginning if line is empty
      const range = document.createRange();
      const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          let el = node.parentElement;
          while (el && el !== lineEl) {
            if (el.contentEditable === 'false') return NodeFilter.FILTER_REJECT;
            el = el.parentElement;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      let lastText: Text | null = null;
      while (walker.nextNode()) lastText = walker.currentNode as Text;
      if (lastText) {
        range.setStart(lastText, lastText.length);
        range.collapse(true);
      } else {
        // Empty line — insert at the beginning
        range.selectNodeContents(lineEl);
        range.collapse(true);
      }
      insertRange = range;
    }

    ce.focus();
    sel?.removeAllRanges();
    sel?.addRange(insertRange);
    onLineInsertClick?.(e, insertRange.cloneRange());
  }, [contentEditableRef, onLineInsertClick]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<'instructions' | 'components'>('instructions');
  const [drawerHeight, setDrawerHeight] = useState(360);
  const [isDragging, setIsDragging] = useState(false);
  
  // ── Component filter tabs ──────────────────────────────────────────────────
  const [localActiveComponentFilter, setLocalActiveComponentFilter] = useState<ComponentFilterTab>('All');
  const selectedComponentFilter = activeComponentFilter ?? localActiveComponentFilter;
  const handleComponentFilterChange = useCallback((tab: ComponentFilterTab) => {
    setLocalActiveComponentFilter(tab);
    onComponentFilterChange?.(tab);
  }, [onComponentFilterChange]);
  
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(0);
  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = drawerHeight;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [drawerHeight]);

  const handleResizePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const delta = dragStartYRef.current - e.clientY;
    const newHeight = Math.max(120, Math.min(800, dragStartHeightRef.current + delta));
    setDrawerHeight(newHeight);
  }, [isDragging]);

  const handleResizePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Stable handler refs for MainContentEditable — update on every render so
  // the stable useCallback wrappers always delegate to the latest handler.
  const onBlurRef = useRef(onBlur);
  const onContentClickRef = useRef(onContentClick);
  const onKeyDownRef = useRef(onKeyDown);
  const onInputRef = useRef(onInput);
  onBlurRef.current = onBlur;
  onContentClickRef.current = onContentClick;
  onKeyDownRef.current = onKeyDown;
  onInputRef.current = onInput;
  const stableOnBlur = useCallback((_e: React.FocusEvent<HTMLDivElement>) => onBlurRef.current(), []);  
  const stableOnContentClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => onContentClickRef.current(e), []);  
  const stableOnKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => onKeyDownRef.current(e), []);  
  const stableOnInput = useCallback((_e: React.FormEvent<HTMLDivElement>) => onInputRef.current(), []);  

  // Imperatively sync contentEditable on the DOM element.
  // MainContentEditable is permanently memoized (never re-renders), so prop
  // changes to `isEditing` / `isStreaming` won't reach the DOM. We must set
  // the attribute directly via the ref.
  useEffect(() => {
    if (contentEditableRef.current) {
      contentEditableRef.current.contentEditable = String(isEditing && !isStreaming);
    }
  }, [isEditing, isStreaming, contentEditableRef]);

  // Sentinel-based sticky detection for the header border (wide layout only)
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    if (isNarrowPreview) { setIsStuck(false); return; }
    const el = sentinelRef.current;
    if (!el) return;

    // Walk up the DOM to find the nearest overflow-y-auto ancestor
    let scrollRoot: Element | null = el.parentElement;
    while (scrollRoot && scrollRoot !== document.documentElement) {
      const overflow = getComputedStyle(scrollRoot).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') break;
      scrollRoot = scrollRoot.parentElement;
    }
    if (!scrollRoot || scrollRoot === document.documentElement) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsStuck(!entry.isIntersecting),
      { root: scrollRoot, threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isNarrowPreview]);

  // Notify parent when stuck state changes (used by Layout to show/hide icon in the main header)
  useEffect(() => {
    onIsStuckChange?.(isStuck);
  }, [isStuck, onIsStuckChange]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Instructions Display/Edit with embedded pills */}
      <div
        ref={(el) => {
          (scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          (instructionsBoxRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        onScroll={isNarrowPreview ? onScroll : undefined}
        className={`flex flex-col relative ${
          isNarrowPreview
            ? `flex-1 overflow-y-auto bg-white transition-[border-color,box-shadow] duration-300 ${
                isStreaming || isEditing
                  ? 'border border-brand-purple shadow-[0_0_0_3px_rgba(98,70,234,0.1)]'
                  : 'border border-gray-300 hover:border-gray-400'
              }`
            : (isComponentDrawer && drawerView === 'instructions' ? 'min-h-0 overflow-y-auto' : 'flex-1')
        } ${isNarrowPreview ? 'text-sm' : ''}`}
        style={{
          borderRadius: isNarrowPreview ? 'var(--radius-xl)' : undefined,
          scrollBehavior: isNarrowPreview ? 'smooth' : undefined,
        }}
      >
        {/* Sentinel: 0-height div just before the sticky header.
            When it scrolls out of view, isStuck becomes true → show border. */}
        <div ref={sentinelRef} style={{ height: 0 }} />

        {/* Header — sticky at top of scroll container in both layouts */}
        {!hideHeader && <div className="sticky top-0 bg-white z-10">
        <div
          className={`flex items-center justify-between border-b transition-[border-color] duration-200 ${
            (isNarrowPreview ? showHeaderBorder : isStuck) ? 'border-gray-200' : 'border-transparent'
          } ${isNarrowPreview ? 'px-4 py-2 pb-0' : 'px-5 py-2 pb-0'}`}
          style={{
            borderTopLeftRadius: isNarrowPreview ? 'var(--radius-xl)' : undefined,
            borderTopRightRadius: isNarrowPreview ? 'var(--radius-xl)' : undefined,
          }}
        >
          <div className="flex items-center gap-2">
            {isBuildTabsEnabled ? (<>
              <CopilotUnderlineTabs
                tabs={[
                  {
                    label: 'Instructions',
                    value: 'instructions',
                    ariaLabel: 'Instructions view',
                  },
                  {
                    label: 'Components',
                    value: 'components',
                    ariaLabel: 'Components view',
                  },
                ]}
                value={activePanel}
                onChange={(panel) => {
                  onFlushDraft?.();
                  onActivePanelChange(panel as 'instructions' | 'components');
                }}
                appearance="subtle"
                size="medium"
              />
            </>) : (
              <h2 className={`font-bold text-gray-900 ${isNarrowPreview ? 'text-body-1-strong' : 'text-lg'}`}>
                Instructions
              </h2>
            )}
          </div>
          {!isNarrowPreview && (
            <div className="flex items-center">
              {(!isBuildTabsEnabled || activePanel === 'instructions') ? (
                <>
                  {isComponentDrawer && (
                    <>
                      <div className="w-px h-5 bg-gray-200 mx-1.5" />
                      <CopilotTooltip content="Instructions view" placement="bottom" askContext="Instructions view — Switches back to the Instructions panel where you write the agent's behavior in natural language. This defines how the agent thinks and responds to users.">
                        <CopilotButton
                          variant="transparent"
                          size="sm"
                          aria-label="Instructions view"
                          data-ask-context="Instructions view — Switches back to the Instructions panel where you write the agent's behavior in natural language. This defines how the agent thinks and responds to users."
                          icon={drawerView === 'instructions'
                            ? <TextAlignLeft20Filled className="text-brand-purple" />
                            : <TextAlignLeft20Regular className="text-gray-500" />
                          }
                          onClick={() => setDrawerView('instructions')}
                        />
                      </CopilotTooltip>
                      <CopilotTooltip content="Components view" placement="bottom" askContext="Components view — Switches to the Components panel, which lists skills and connectors you can add to the agent's instructions. Components give the agent specific capabilities such as generating text, analyzing images, searching documents, or integrating with external services.">
                        <CopilotButton
                          variant="transparent"
                          size="sm"
                          aria-label="Components view"
                          data-ask-context="Components view — Switches to the Components panel, which lists skills and connectors you can add to the agent's instructions. Components give the agent specific capabilities such as generating text, analyzing images, searching documents, or integrating with external services."
                          icon={drawerView === 'components'
                            ? <Apps20Filled className="text-brand-purple" />
                            : <Apps20Regular className="text-gray-500" />
                          }
                          onClick={() => setDrawerView('components')}
                        />
                      </CopilotTooltip>
                    </>
                  )}
                  {!isAgentGlobalUndo && (
                    <div className="flex items-center gap-1 mr-1">
                      <CopilotTooltip content="Undo" placement="bottom">
                        <CopilotButton variant="icon" size="sm" icon={<ArrowUndo20Regular />} iconFilled={<ArrowUndo20Filled />} onClick={undo} disabled={!canUndo} className="!bg-transparent !border-transparent hover:!bg-transparent" />
                      </CopilotTooltip>
                      <CopilotTooltip content="Redo" placement="bottom">
                        <CopilotButton variant="icon" size="sm" icon={<ArrowRedo20Regular />} iconFilled={<ArrowRedo20Filled />} onClick={redo} disabled={!canRedo} className="!bg-transparent !border-transparent hover:!bg-transparent" />
                      </CopilotTooltip>
                    </div>
                  )}
                  <div className="w-1" />
                  {!isInsertComponents && (
                  <div
                    className="relative"
                    ref={addDropdownRef}
                    onMouseDown={() => {
                      // Save cursor before the button click steals focus
                      const sel = window.getSelection();
                      if (sel && sel.rangeCount > 0 && contentEditableRef.current?.contains(sel.anchorNode)) {
                        addInsertionRangeRef.current = sel.getRangeAt(0).cloneRange();
                      } else {
                        addInsertionRangeRef.current = null;
                      }
                    }}
                  >
                    <CopilotTooltip content="Add component" placement="bottom" askContext="Add component — Inserts a skill or connector reference into the agent's instructions. Components tell the agent it has access to a specific capability, like generating text or calling an API.">
                      <CopilotButton
                        variant="secondary"
                        size="sm"
                        icon={<Add20Regular />}
                        iconFilled={<Add20Filled />}
                        className={`focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!shadow-none ${addButtonMenuOpen ? '!text-brand' : ''}`}
                        onClick={onAddButtonClick}
                      >
                        Add
                      </CopilotButton>
                    </CopilotTooltip>
                  </div>
                  )}
                </>
              ) : (
                componentsHeaderActions
              )}
            </div>
          )}
        </div>
        </div>}

        {formattingBar}
        {!isBuildTabsEnabled && (
          <div className={`h-px bg-gray-200 ${isNarrowPreview ? 'mx-4' : 'mx-5'}`} />
        )}

        <div key={isBuildTabsEnabled ? activePanel : (isComponentDrawer ? drawerView : 'instructions')} className={isBuildTabsEnabled || (isComponentDrawer && drawerView) ? 'animate-panel-enter' : ''}>
          {/* Component drawer "components" view — full-height components list */}
          {isComponentDrawer && drawerView === 'components' && (!isBuildTabsEnabled || activePanel === 'instructions') ? (
            <div className="flex-1 min-h-0">
              {componentsContent}
            </div>
          ) : (!isBuildTabsEnabled || activePanel === 'instructions') ? (
            <>
              <div className={`relative pt-5 ${isNarrowPreview ? '' : 'min-h-[160px]'}`} onClick={onContentClick} data-review-state={reviewHighlightActive ? 'active' : undefined} data-highlight-all={highlightAllChanges ? 'true' : undefined} onMouseMove={handleEditorMouseMove} onMouseLeave={handleEditorMouseLeave}>
                {!editableText && !isStreaming && !hidePlaceholder && !isEditing && (
                  <div className={`absolute inset-0 pointer-events-none ${
                    isNarrowPreview ? 'px-4 pt-7 pb-2 text-sm' : `px-5 ${hideHeader ? 'pt-9' : 'pt-5'} pb-3 text-sm`
                  } text-gray-500`}>
                    {placeholder ? (
                      <p>{placeholder}</p>
                    ) : (
                      <>
                        <p className="mb-3">Tell your agent how to do its job using clear and specific goals. Use a well-structured and labeled format for best results. Consider sections like General guidelines, Skills, and Step-by-step instructions. Include examples of good responses for clarity.</p>
                        {!isNarrowPreview && (
                          <p>Use / to add tools, topics, and more.</p>
                        )}
                      </>
                    )}
                  </div>
                )}
                {hideHeader && !isNarrowPreview && <div style={{ height: 16 }} />}
                <MainContentEditable
                  key={contentEditableKey}
                  contentRef={contentEditableRef}
                  onBlur={stableOnBlur}
                  onClick={stableOnContentClick}
                  onKeyDown={stableOnKeyDown}
                  onInput={stableOnInput}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  isEditing={isEditing}
                  isStreaming={isStreaming}
                  isNarrowPreview={isNarrowPreview}
                >
                  {renderedInstructions}
                </MainContentEditable>
                {/* Line hover insert button */}
                {isInsertComponents && lineHoverPos && (
                  <CopilotButton
                    ref={lineButtonRef}
                    variant="transparent"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseLeave={(e) => {
                      const nextTarget = e.relatedTarget;
                      if (!(nextTarget instanceof Node) || !contentEditableRef.current?.contains(nextTarget)) {
                        setLineHoverPos(null);
                        hoveredLineElRef.current = null;
                      }
                    }}
                    onClick={handleLineButtonClick}
                    className="absolute z-[100] !w-5 !h-5 !rounded-md !bg-gray-100 hover:!bg-gray-200 text-[hsl(var(--brand))] transition-colors !p-0 !min-w-0"
                    style={{ top: lineHoverPos.top, left: lineHoverPos.left }}
                    aria-label="Insert component"
                    icon={<Add16Regular />}
                  />
                )}
              </div>

              {/* When drawer flag is off and build tabs are off, show components inline below instructions */}
              {!isComponentDrawer && !isBuildTabsEnabled && (
                <div className="flex-1 min-h-0 pb-8">
                  <div className={`flex items-center gap-3 ${isNarrowPreview ? 'px-4 pt-6 pb-2' : 'px-5 pt-4 pb-3'}`}>
                    <h2 className={`font-bold text-gray-900 flex-shrink-0 ${isNarrowPreview ? 'text-sm' : 'text-lg'}`}>Components</h2>
                    <div className="flex items-center gap-1 ml-auto">
                      {componentsHeaderActions}
                    </div>
                  </div>
                  <div className={`h-px bg-gray-200 ${isNarrowPreview ? 'mx-4' : 'mx-5'}`} />
                  {componentsContent}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Component filter tab pills */}
              <div className={`flex items-center gap-2 flex-wrap ${isNarrowPreview ? 'px-4 py-5' : 'px-5 py-5'}`}>
                {componentFilterTabs.map((tab) => (
                  <CopilotFilterPill
                    key={tab}
                    label={isToolsDA && tab === 'Tools' ? 'Tools/Connectors' : tab}
                    size="sm"
                    active={selectedComponentFilter === tab}
                    onClick={() => handleComponentFilterChange(tab)}
                  />
                ))}
              </div>
              <div className="flex-1 min-h-0">
                {componentsContent}
              </div>
            </div>
          )}
        </div>

        {/* Slash command menu — always mounted so portal renders regardless of active panel */}
        {slashMenuComponent}

      </div>

      {footerBar}

      {/* Component Drawer — sits below instructions, outside scroll container */}
      {isComponentDrawer && drawerView === 'instructions' && (!isBuildTabsEnabled || activePanel === 'instructions') && (
        <div
          className="mx-4 bg-white border border-gray-200 rounded-xl flex flex-col flex-shrink-0"
          style={{ boxShadow: drawerOpen ? '0 -4px 12px rgba(0,0,0,0.08)' : '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          {/* Resize handle — visible only when drawer is open */}
          {drawerOpen && (
            <div
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              className="flex items-center justify-center h-3 cursor-ns-resize group rounded-t-xl touch-none"
            >
              <div className="w-8 h-1 rounded-full bg-gray-300 group-hover:bg-gray-400 transition-colors" />
            </div>
          )}

          {/* Collapsed bar — always visible */}
          <CopilotButton
            variant="transparent"
            onClick={() => setDrawerOpen(prev => !prev)}
            className={`!w-full !justify-between !h-auto !rounded-none px-5 py-4 text-sm !font-normal !text-gray-600 hover:!bg-gray-50 hover:!text-gray-600 active:!text-gray-600 transition-colors ${
              !drawerOpen ? '!rounded-xl' : ''
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="text-gray-600 text-xs font-medium tabular-nums">
                {componentCount}
              </span>
              <span className="font-medium text-gray-700">Components</span>
            </span>
            {drawerOpen
              ? <ChevronDown20Regular className="text-gray-400" />
              : <ChevronUp20Regular className="text-gray-400" />
            }
          </CopilotButton>

          {/* Expanded drawer content */}
          <div
            className={`overflow-hidden rounded-b-xl ${isDragging ? '' : 'transition-[height] duration-300 ease-in-out'}`}
            style={{ height: drawerOpen ? `${drawerHeight}px` : '0px' }}
          >
            <div className="overflow-y-auto border-t border-gray-100 h-full">
              {componentsContent}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
