import React, { useRef, useState, useCallback, useEffect, useImperativeHandle } from 'react';
import { InstructionsEditor } from '../../../components/shared/InstructionsEditor';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { createPillElement, PillInputHandle, PillData } from '../../../components/ui/PillInput';
import { getConnectorIconSrc, ALL_STEPS } from './workflowConstants';
import {
  ArrowUndo20Regular, ArrowUndo20Filled,
  ArrowRedo20Regular, ArrowRedo20Filled,
  TextBulletListLtr20Regular, TextBulletListLtr20Filled,
  TextNumberListLtr20Regular, TextNumberListLtr20Filled,
  Sparkle20Regular,
  Add20Regular,
} from '@fluentui/react-icons';

interface WorkflowInstructionsEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Called on the first keypress inside the editor — used to auto-dismiss the bail banner */
  onFirstInput?: () => void;
  /** Called on every input event with the current text — fires immediately unlike onChange (which fires on blur) */
  onInputChange?: (text: string) => void;
  /** Hide the sticky header (title, tabs, + Add button). Useful when the editor is inside a modal that already has a title. */
  hideHeader?: boolean;
  /** Extra classes applied to the root wrapper (e.g. "flex-1" to stretch inside a flex container). */
  className?: string;
  /** Optional action rendered on the right side of the formatting toolbar (e.g. a model picker dropdown). */
  headerAction?: React.ReactNode;
  /** Called when the editor gains focus — used to register this editor for dynamic-value insertion. */
  onEditorFocus?: () => void;
}

/**
 * Lightweight wrapper around InstructionsEditor for use in workflow step panes.
 * Manages all the refs and state that InstructionsEditor needs internally,
 * and exposes a simple value/onChange API.
 *
 * Includes a formatting toolbar: Undo, Redo, Ordered List, Unordered List.
 */
export const WorkflowInstructionsEditor = React.forwardRef<PillInputHandle, WorkflowInstructionsEditorProps>(
function WorkflowInstructionsEditorInner({ value, onChange, placeholder, onFirstInput, onInputChange, hideHeader = false, className, headerAction, onEditorFocus }, ref) {
  const contentEditableRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const instructionsBoxRef = useRef<HTMLDivElement | null>(null);
  const addDropdownRef = useRef<HTMLDivElement | null>(null);
  const addInsertionRangeRef = useRef<Range | null>(null);
  const [contentEditableKey, setContentEditableKey] = useState(0);
  const [showHeaderBorder, setShowHeaderBorder] = useState(false);
  // Tracks content immediately on input so the placeholder hides as soon as the user starts typing
  // (value/onChange only sync on blur, so we can't rely on value for placeholder visibility)
  const [localEditableText, setLocalEditableText] = useState(value);

  /** Walk the contentEditable DOM and serialize pills as {{nodeLabel.output:connector}} tokens. */
  const serializeContent = useCallback(() => {
    const el = contentEditableRef.current;
    if (!el) return '';
    let result = '';
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent ?? '';
      } else if (node instanceof HTMLElement) {
        if (node.dataset.type === 'pill') {
          const connector = node.dataset.nodeConnector;
          result += connector
            ? `{{${node.dataset.node}.${node.dataset.output}:${connector}}}`
            : `{{${node.dataset.node}.${node.dataset.output}}}`;
        } else {
          // For block elements (div, p, br), add newlines
          const tag = node.tagName;
          if (tag === 'BR') { result += '\n'; return; }
          const isBlock = tag === 'DIV' || tag === 'P' || tag === 'LI';
          if (isBlock && result.length > 0 && !result.endsWith('\n')) result += '\n';
          node.childNodes.forEach(walk);
        }
      }
    };
    el.childNodes.forEach(walk);
    return result.trim();
  }, []);

  // Flag to skip DOM rebuild when the value change came from a pill insertion
  const pillInsertRef = useRef(false);

  // Expose insertPill so the expanded modal can insert rich pills into this editor
  const insertPillAtCursor = useCallback((pill: PillData) => {
    const el = contentEditableRef.current;
    if (!el) return;
    const pillEl = createPillElement(pill.nodeLabel, pill.output, pill.nodeConnector);
    const sel = window.getSelection();
    let inserted = false;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (el.contains(range.startContainer)) {
        range.collapse(false);
        range.insertNode(pillEl);
        range.setStartAfter(pillEl);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        inserted = true;
      }
    }
    if (!inserted) el.appendChild(pillEl);
    // Serialize including pill tokens and sync to parent — but skip the DOM rebuild
    const serialized = serializeContent();
    pillInsertRef.current = true;
    prevValueRef.current = serialized;
    setLocalEditableText(serialized);
    onChange(serialized);
    el.focus();
  }, [onChange, serializeContent]);

  useImperativeHandle(ref, () => ({ insertPill: insertPillAtCursor }), [insertPillAtCursor]);

  // Notify parent when this editor gains focus
  useEffect(() => {
    const el = contentEditableRef.current;
    if (!el || !onEditorFocus) return;
    const handler = () => onEditorFocus();
    el.addEventListener('focus', handler);
    return () => el.removeEventListener('focus', handler);
  }, [onEditorFocus, contentEditableKey]); // re-attach after key resets the DOM

  const firedFirstInput = useRef(false);

  // Reset the editor when value changes externally (e.g. node switches)
  const prevValueRef = useRef(value);
  useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      // Skip DOM rebuild if the value change came from our own pill insertion
      if (pillInsertRef.current) {
        pillInsertRef.current = false;
        return;
      }
      setContentEditableKey(k => k + 1);
      firedFirstInput.current = false;
      setLocalEditableText(value);
    }
  }, [value]);

  const handleBlur = useCallback(() => {
    const text = serializeContent();
    onChange(text);
  }, [onChange, serializeContent]);

  const handleInput = useCallback(() => {
    // Update local text immediately so placeholder disappears while typing
    const text = serializeContent();
    setLocalEditableText(text);
    onInputChange?.(text);
    if (!firedFirstInput.current) {
      firedFirstInput.current = true;
      onFirstInput?.();
    }
  }, [onFirstInput, onInputChange, serializeContent]);

  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      setShowHeaderBorder(scrollContainerRef.current.scrollTop > 0);
    }
  }, []);

  // ── Formatting toolbar state ──────────────────────────────────────────────
  const [formatState, setFormatState] = useState({
    canUndo: false,
    canRedo: false,
    isOL: false,
    isUL: false,
  });

  const updateFormatState = useCallback(() => {
    // Only meaningful when the contentEditable is focused
    // TODO: document.queryCommandEnabled/State and execCommand are deprecated browser APIs.
    // They still work in all major browsers but should be replaced with the Selection API
    // or a proper rich-text library (e.g. Tiptap) in a future iteration.
    try {
      setFormatState({
        canUndo: document.queryCommandEnabled('undo'),
        canRedo: document.queryCommandEnabled('redo'),
        isOL: document.queryCommandState('insertOrderedList'),
        isUL: document.queryCommandState('insertUnorderedList'),
      });
    } catch {
      // execCommand queries can throw in some environments
    }
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', updateFormatState);
    return () => document.removeEventListener('selectionchange', updateFormatState);
  }, [updateFormatState]);

  // Execute a formatting command without stealing focus from contentEditable
  const execFormat = useCallback((command: string) => {
    contentEditableRef.current?.focus();
    document.execCommand(command); // TODO: replace with Selection API (see note above)
    updateFormatState();
    // Read updated content and sync to state
    const text = contentEditableRef.current?.innerText ?? '';
    onChange(text.trim());
  }, [onChange, updateFormatState]);

  const formattingBar = (
    <div className="flex items-center gap-0.5 px-2 py-1 border-b border-gray-200">
      <CopilotButton
        variant="icon"
        size="sm"
        icon={<ArrowUndo20Regular />}
        iconFilled={<ArrowUndo20Filled />}
        disabled={!formatState.canUndo}
        className="!bg-transparent !border-transparent hover:!bg-gray-100"
        onMouseDown={e => { e.preventDefault(); execFormat('undo'); }}
        title="Undo"
      />
      <CopilotButton
        variant="icon"
        size="sm"
        icon={<ArrowRedo20Regular />}
        iconFilled={<ArrowRedo20Filled />}
        disabled={!formatState.canRedo}
        className="!bg-transparent !border-transparent hover:!bg-gray-100"
        onMouseDown={e => { e.preventDefault(); execFormat('redo'); }}
        title="Redo"
      />
      <div className="w-px h-4 bg-gray-200 mx-1 flex-shrink-0" />
      <CopilotButton
        variant={formatState.isOL ? 'secondary' : 'icon'}
        size="sm"
        icon={<TextNumberListLtr20Regular />}
        iconFilled={<TextNumberListLtr20Filled />}
        className={formatState.isOL ? '' : '!bg-transparent !border-transparent hover:!bg-gray-100'}
        onMouseDown={e => { e.preventDefault(); execFormat('insertOrderedList'); }}
        title="Numbered list"
      />
      <CopilotButton
        variant={formatState.isUL ? 'secondary' : 'icon'}
        size="sm"
        icon={<TextBulletListLtr20Regular />}
        iconFilled={<TextBulletListLtr20Filled />}
        className={formatState.isUL ? '' : '!bg-transparent !border-transparent hover:!bg-gray-100'}
        onMouseDown={e => { e.preventDefault(); execFormat('insertUnorderedList'); }}
        title="Bullet list"
      />
      <div className="flex-1" />
      {headerAction}
      <CopilotButton
        variant="ghost"
        size="sm"
        className="gap-1.5"
        title="Rewrite with Copilot"
        disabled
      >
        <Sparkle20Regular style={{ width: 20, height: 20, flexShrink: 0 }} />
        Rewrite with Copilot
      </CopilotButton>
    </div>
  );

  const footerBar = (
    <div className="flex items-center gap-3 px-3 py-2 border-t border-gray-200">
      <CopilotButton
        variant="outline"
        size="xs"
        className="border-dashed border-brand-purple text-brand-purple hover:bg-purple-50"
        onMouseDown={e => e.preventDefault()}
        icon={<Add20Regular />}
      >
        Add
      </CopilotButton>
    </div>
  );

  // Render the initial content, parsing {{nodeLabel.output}} or {{nodeLabel.output:connector}} tokens into pill React elements
  const renderLineWithPills = useCallback((line: string, lineKey: number) => {
    if (!line) return <div key={lineKey}><br /></div>;
    // Matches {{nodeLabel.output}} or {{nodeLabel.output:connector}}
    const pillRegex = /\{\{([^.}]+)\.([^}:]+?)(?::([^}]+))?\}\}/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pillRegex.exec(line)) !== null) {
      if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index));
      const nodeLabel = match[1];
      const output = match[2];
      const connector = match[3] || undefined;

      // Resolve icon: try connector icon, then step icon
      const connectorIconSrc = connector ? getConnectorIconSrc(connector) : null;
      const stepIcon = !connectorIconSrc ? ALL_STEPS.find(s => s.label === nodeLabel)?.icon : null;

      parts.push(
        <span
          key={`${lineKey}-${match.index}`}
          contentEditable={false}
          data-type="pill"
          data-node={nodeLabel}
          data-output={output}
          {...(connector ? { 'data-node-connector': connector } : {})}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, color: 'hsl(var(--primary))',
            border: '1px solid hsl(var(--stroke-default))', height: 24, boxSizing: 'border-box' as const,
            padding: '0 4px 0 12px', borderRadius: 20, fontSize: 13, fontWeight: 600,
            margin: '0 2px', verticalAlign: 'middle', userSelect: 'none' as const, whiteSpace: 'nowrap' as const,
          }}
          onMouseOver={e => (e.currentTarget.style.backgroundColor = '#F3F4F6')}
          onMouseOut={e => (e.currentTarget.style.backgroundColor = '')}
        >
          {connectorIconSrc && (
            <img src={connectorIconSrc} alt="" style={{ width: 13, height: 13, borderRadius: 2, flexShrink: 0, display: 'block' }} />
          )}
          {!connectorIconSrc && stepIcon && (
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 13, height: 13, flexShrink: 0 }}>
              <span style={{ transform: 'scale(0.54)', transformOrigin: 'center', display: 'flex', flexShrink: 0 }}>{stepIcon as React.ReactNode}</span>
            </span>
          )}
          <span>{output}</span>
          <button
            data-remove="true"
            type="button"
            style={{
              background: 'none', border: 'none', padding: 0, width: 13, height: 13,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'inherit', opacity: 0.45, marginLeft: 1, flexShrink: 0, borderRadius: 9999,
            }}
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{ pointerEvents: 'none' }}>
              <path d="M1.5 1.5l6 6M7.5 1.5l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </span>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) parts.push(line.slice(lastIndex));
    return <div key={lineKey}>{parts.length > 0 ? parts : line}</div>;
  }, []);

  const renderedInstructions = value
    ? value.split('\n').map((line, i) => renderLineWithPills(line, i))
    : null;

  // Drag-and-drop support for dynamic-value pills
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes('application/x-input-pill')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const raw = e.dataTransfer.getData('application/x-input-pill');
    if (!raw || !contentEditableRef.current) return;
    e.preventDefault();
    const pill = JSON.parse(raw) as PillData;
    const pillEl = createPillElement(pill.nodeLabel, pill.output, pill.nodeConnector);
    let range: Range | null = null;
    if ('caretRangeFromPoint' in document) {
      range = (document as Document & { caretRangeFromPoint: (x: number, y: number) => Range | null }).caretRangeFromPoint(e.clientX, e.clientY);
    } else if ('caretPositionFromPoint' in document) {
      // caretPositionFromPoint is a Firefox-only API not in TypeScript's lib.dom.d.ts
      const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
      if (pos) {
        const r = new Range();
        r.setStart(pos.offsetNode, pos.offset);
        r.collapse(true);
        range = r;
      }
    }
    if (range && contentEditableRef.current.contains(range.startContainer)) {
      range.insertNode(pillEl);
      range.setStartAfter(pillEl);
      range.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    } else {
      contentEditableRef.current.appendChild(pillEl);
    }
    const serialized = serializeContent();
    pillInsertRef.current = true;
    prevValueRef.current = serialized;
    setLocalEditableText(serialized);
    onChange(serialized);
  }, [onChange, serializeContent]);

  return (
    <div className={`relative border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 focus-within:border-brand-purple transition-[border-color] duration-200 flex flex-col${className ? ` ${className}` : ''}`}>
      <InstructionsEditor
        isEditing
        isStreaming={false}
        editableText={localEditableText}
        contentEditableKey={contentEditableKey}
        showHeaderBorder={showHeaderBorder}
        isNarrowPreview={false}
        contentEditableRef={contentEditableRef}
        scrollContainerRef={scrollContainerRef}
        instructionsBoxRef={instructionsBoxRef}
        addDropdownRef={addDropdownRef}
        addButtonMenuOpen={false}
        addInsertionRangeRef={addInsertionRangeRef}
        onAddButtonClick={() => {}}
        onBlur={handleBlur}
        onContentClick={(e: React.MouseEvent) => {
          const target = e.target as HTMLElement;
          if (target.dataset.remove === 'true') {
            const pill = target.closest('[data-type="pill"]') as HTMLElement;
            if (pill) {
              pill.remove();
              const text = serializeContent();
              prevValueRef.current = text;
              setLocalEditableText(text);
              onChange(text);
            }
          }
        }}
        onKeyDown={() => {}}
        onInput={handleInput}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onScroll={handleScroll}
        renderedInstructions={renderedInstructions}
        activePanel="instructions"
        onActivePanelChange={() => {}}
        componentsContent={<div />}
        hideHeader={hideHeader}
        placeholder={placeholder}
        formattingBar={formattingBar}
        footerBar={footerBar}
      />
    </div>
  );
});
