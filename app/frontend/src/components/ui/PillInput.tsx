// ─── PillInput ────────────────────────────────────────────────────────────────
// A contentEditable input that renders dynamic-value pills inline.
// Extracted from the InstructionEditor on mcp-node-workflows, minus the
// @mention autocomplete (that's instruction-specific).
//
// Supports:
// - Rich pill rendering via createPillElement (styled, non-editable spans)
// - Click-to-insert via insertPill (exposed through useImperativeHandle)
// - Drag-and-drop receiving of application/x-input-pill data
// - Pill removal via the × button on each pill
// - onFocus callback so the parent can track which editor is active

import React, { useRef, useEffect, useLayoutEffect, useImperativeHandle, useCallback } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getConnectorIconSrc, ALL_STEPS } from '../workflow/workflowConstants';

export type PillData = { nodeLabel: string; output: string; nodeConnector?: string };
export type PillInputHandle = { insertPill: (pill: PillData) => void; };

interface PillInputProps {
  /** Label shown above the field. */
  label?: string;
  /** Show a red asterisk after the label. */
  required?: boolean;
  /** Placeholder text shown when empty. */
  placeholder?: string;
  /** Controlled value — may contain pill tokens like {{nodeLabel.output:connector}}. */
  value?: string;
  /** Called whenever the rich content changes (plain text + pill tokens). */
  onChange?: (value: string) => void;
  /** Called when the field gains focus — used by McpExpandedModal to track the active editor. */
  onFocus?: () => void;
  /** Extra classes on the outer wrapper. */
  className?: string;
  /** If true, render as a single-line input (no line breaks). */
  singleLine?: boolean;
  /** CSS min-height for the editable area (defaults to auto for single-line, 120 for multi). */
  minHeight?: number;
}

/** Serialize the contentEditable DOM back to a string (plain text with pill tokens). */
function serializeContent(container: HTMLDivElement): string {
  let text = '';
  container.childNodes.forEach(n => {
    if (n.nodeType === Node.TEXT_NODE) {
      text += n.textContent ?? '';
    } else if (n instanceof HTMLElement && n.dataset.type === 'pill') {
      const connector = n.dataset.nodeConnector;
      text += connector
        ? `{{${n.dataset.node}.${n.dataset.output}:${connector}}}`
        : `{{${n.dataset.node}.${n.dataset.output}}}`;
    }
  });
  return text;
}

export function createPillElement(nodeLabel: string, output: string, nodeConnector?: string): HTMLSpanElement {
  let imgSrc: string | null = null;
  let svgHtml: string | null = null;
  if (nodeConnector) imgSrc = getConnectorIconSrc(nodeConnector);
  if (!imgSrc) {
    const stepMatch = ALL_STEPS.find(s => s.label === nodeLabel);
    if (stepMatch?.icon) {
      try { svgHtml = renderToStaticMarkup(stepMatch.icon as React.ReactElement); } catch { /* skip */ }
    }
  }
  const pill = document.createElement('span');
  pill.contentEditable = 'false';
  pill.dataset.type = 'pill';
  pill.dataset.node = nodeLabel;
  pill.dataset.output = output;
  if (nodeConnector) pill.dataset.nodeConnector = nodeConnector;
  pill.style.cssText =
    'display:inline-flex;align-items:center;gap:4px;color:hsl(var(--primary));border:1px solid hsl(var(--stroke-default));height:24px;box-sizing:border-box;padding:0 4px 0 12px;border-radius:20px;font-size:13px;font-weight:600;margin:0 2px;vertical-align:middle;user-select:none;white-space:nowrap;';
  if (imgSrc) {
    const iconEl = document.createElement('img');
    iconEl.src = imgSrc;
    iconEl.alt = '';
    iconEl.style.cssText = 'width:13px;height:13px;border-radius:2px;flex-shrink:0;display:block;';
    pill.appendChild(iconEl);
  } else if (svgHtml) {
    const wrapper = document.createElement('span');
    wrapper.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;flex-shrink:0;';
    wrapper.innerHTML = svgHtml;
    const svg = wrapper.querySelector('svg');
    if (svg) { svg.setAttribute('width', '13'); svg.setAttribute('height', '13'); }
    pill.appendChild(wrapper);
  }
  const labelEl = document.createElement('span');
  labelEl.textContent = output;
  pill.appendChild(labelEl);
  const xBtn = document.createElement('button');
  xBtn.dataset.remove = 'true';
  xBtn.type = 'button';
  xBtn.style.cssText = 'background:none;border:none;padding:0;width:13px;height:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:inherit;opacity:0.45;margin-left:1px;flex-shrink:0;border-radius:9999px;';
  xBtn.innerHTML = '<svg width="9" height="9" viewBox="0 0 9 9" fill="none" style="pointer-events:none"><path d="M1.5 1.5l6 6M7.5 1.5l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  pill.appendChild(xBtn);
  pill.addEventListener('mouseover', () => { pill.style.backgroundColor = '#F3F4F6'; });
  pill.addEventListener('mouseout', () => { pill.style.backgroundColor = ''; });
  return pill;
}

/** Build DOM content from a value string, parsing {{nodeLabel.output:connector}} tokens into pill elements. */
function buildDOMFromValue(container: HTMLDivElement, val: string) {
  container.innerHTML = '';
  const regex = /\{\{([^.}]+)\.([^}:]+?)(?::([^}]+))?\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(val)) !== null) {
    if (match.index > lastIndex) container.appendChild(document.createTextNode(val.slice(lastIndex, match.index)));
    container.appendChild(createPillElement(match[1], match[2], match[3] || undefined));
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < val.length) container.appendChild(document.createTextNode(val.slice(lastIndex)));
}

export const PillInput = React.forwardRef<PillInputHandle, PillInputProps>(
  ({ label, required, placeholder, value, onChange, onFocus, className, singleLine, minHeight }, ref) => {
    const divRef = useRef<HTMLDivElement>(null);
    const isEmptyRef = useRef(true);
    const prevValueRef = useRef(value ?? '');
    const pillInsertRef = useRef(false);

    // Keep track of empty state for placeholder rendering
    const checkEmpty = useCallback(() => {
      if (!divRef.current) return;
      const empty = divRef.current.textContent?.trim() === '' && !divRef.current.querySelector('[data-type="pill"]');
      isEmptyRef.current = empty;
      const ph = divRef.current.parentElement?.querySelector('[data-pill-placeholder]') as HTMLElement | null;
      if (ph) ph.style.display = empty ? '' : 'none';
    }, []);

    // Initialize DOM from value on mount
    useLayoutEffect(() => {
      if (divRef.current && value) buildDOMFromValue(divRef.current, value);
      checkEmpty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync DOM when value changes externally (not from our own edits)
    useEffect(() => {
      if (value === undefined || value === prevValueRef.current) return;
      prevValueRef.current = value;
      if (pillInsertRef.current) { pillInsertRef.current = false; return; }
      if (divRef.current) buildDOMFromValue(divRef.current, value);
      checkEmpty();
    }, [value, checkEmpty]);

    const fireChange = useCallback(() => {
      if (!divRef.current || !onChange) return;
      const serialized = serializeContent(divRef.current);
      prevValueRef.current = serialized;
      pillInsertRef.current = true;
      onChange(serialized);
    }, [onChange]);

    const insertPillAtCursor = useCallback((pill: PillData) => {
      if (!divRef.current) return;
      const pillEl = createPillElement(pill.nodeLabel, pill.output, pill.nodeConnector);
      const sel = window.getSelection();
      let inserted = false;
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (divRef.current.contains(range.startContainer)) {
          range.collapse(false);
          range.insertNode(pillEl);
          range.setStartAfter(pillEl);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          inserted = true;
        }
      }
      if (!inserted) divRef.current.appendChild(pillEl);
      fireChange();
      checkEmpty();
      divRef.current.focus();
    }, [fireChange, checkEmpty]);

    useImperativeHandle(ref, () => ({ insertPill: insertPillAtCursor }), [insertPillAtCursor]);

    const resolvedMinHeight = minHeight ?? (singleLine ? undefined : 120);

    return (
      <div className={`relative ${className ?? ''}`}>
        {label && (
          <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">
            {label}{required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          <div
            ref={divRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline={!singleLine}
            aria-label={label}
            onFocus={onFocus}
            onInput={() => { fireChange(); checkEmpty(); }}
            onPaste={e => {
              e.preventDefault();
              const text = e.clipboardData.getData('text/plain');
              if (!text) return;
              const sel = window.getSelection();
              if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                range.insertNode(document.createTextNode(text));
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
              }
              fireChange();
              checkEmpty();
            }}
            onKeyDown={singleLine ? e => { if (e.key === 'Enter') e.preventDefault(); } : undefined}
            onClick={e => {
              const target = e.target as HTMLElement;
              if (target.dataset.remove === 'true') {
                const pill = target.closest('[data-type="pill"]') as HTMLElement;
                if (pill && divRef.current) {
                  pill.remove();
                  fireChange();
                  checkEmpty();
                }
              }
            }}
            onDragOver={e => {
              if (e.dataTransfer.types.includes('application/x-input-pill')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }
            }}
            onDrop={e => {
              const raw = e.dataTransfer.getData('application/x-input-pill');
              if (!raw || !divRef.current) return;
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
              if (range && divRef.current.contains(range.startContainer)) {
                range.insertNode(pillEl);
                range.setStartAfter(pillEl);
                range.collapse(true);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
              } else {
                divRef.current.appendChild(pillEl);
              }
              fireChange();
              checkEmpty();
            }}
            className="block w-full px-3.5 py-2 bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] border border-[hsl(var(--secondary-border))] rounded-lg transition-colors hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] text-sm leading-loose"
            style={{ minHeight: resolvedMinHeight, wordBreak: 'break-word', whiteSpace: singleLine ? 'nowrap' : 'pre-wrap', overflow: singleLine ? 'hidden' : undefined }}
          />
          <div
            data-pill-placeholder
            className="absolute text-sm text-gray-400 pointer-events-none select-none"
            style={{ top: label ? 8 : 8, left: 14, right: 14 }}
          >
            {placeholder}
          </div>
        </div>
      </div>
    );
  },
);

PillInput.displayName = 'PillInput';
