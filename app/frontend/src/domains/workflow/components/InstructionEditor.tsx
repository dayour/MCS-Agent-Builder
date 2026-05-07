// ── Rich instruction editor ────────────────────────────────────────────────
// Extracted from WorkflowCanvas.tsx — self-contained contentEditable editor
// that renders inline pills for node references and Power Fx expressions.

import React, { useRef, useLayoutEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InstrSegment, ALL_STEPS, getConnectorIconSrc } from './workflowConstants';

const InstructionEditor: React.FC<{
  nodeId: string;
  segments: InstrSegment[];
  onSegmentsChange: (segs: InstrSegment[]) => void;
  placeholder?: string;
}> = ({ nodeId, segments, onSegmentsChange, placeholder }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const externalRef = useRef(segments);

  const buildDOM = (segs: InstrSegment[], container: HTMLDivElement) => {
    // Save cursor offset from end so we can restore after rebuild
    container.innerHTML = '';
    segs.forEach(seg => {
      if (seg.type === 'text') {
        container.appendChild(document.createTextNode(seg.value));
      } else if (seg.type === 'pill') {
        // Resolve icon: connector img takes priority, then step palette icon, then nothing
        let imgSrc: string | null = null;
        let svgHtml: string | null = null;
        if (seg.nodeConnector) {
          imgSrc = getConnectorIconSrc(seg.nodeConnector);
        }
        if (!imgSrc) {
          const stepMatch = ALL_STEPS.find(s => s.label === seg.nodeLabel);
          if (stepMatch?.icon) {
            try { svgHtml = renderToStaticMarkup(stepMatch.icon as React.ReactElement); } catch { /* skip */ }
          }
        }
        const hasIcon = !!(imgSrc || svgHtml);

        const pill = document.createElement('span');
        pill.contentEditable = 'false';
        pill.dataset.type = 'pill';
        pill.dataset.node = seg.nodeLabel;
        pill.dataset.output = seg.output;
        if (seg.nodeConnector) pill.dataset.nodeConnector = seg.nodeConnector;
        pill.style.cssText =
          `display:inline-flex;align-items:center;gap:3px;background:hsl(var(--primary)/.08);color:hsl(var(--primary));border:1px solid hsl(var(--primary)/.2);padding:1px 6px 1px ${hasIcon ? '4px' : '7px'};border-radius:9999px;font-size:11px;font-weight:500;margin:0 2px;vertical-align:middle;user-select:none;line-height:1.6;`;
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
        labelEl.textContent = seg.output;
        pill.appendChild(labelEl);
        const xBtn = document.createElement('button');
        xBtn.dataset.remove = 'true';
        xBtn.type = 'button';
        xBtn.style.cssText =
          'background:none;border:none;padding:0;cursor:pointer;display:flex;align-items:center;color:inherit;opacity:0.55;margin-left:1px;flex-shrink:0;';
        xBtn.innerHTML =
          '<svg width="9" height="9" viewBox="0 0 9 9" fill="none" style="pointer-events:none"><path d="M1.5 1.5l6 6M7.5 1.5l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
        pill.appendChild(xBtn);
        container.appendChild(pill);
      } else if (seg.type === 'power-fx-pill') {
        const pill = document.createElement('span');
        pill.contentEditable = 'false';
        pill.dataset.type = 'power-fx-pill';
        pill.dataset.expression = seg.expression;
        pill.dataset.label = seg.label;
        pill.style.cssText =
          'display:inline-flex;align-items:center;gap:3px;background:hsl(262 52% 50%/.1);color:hsl(262 52% 45%);border:1px solid hsl(262 52% 50%/.25);padding:1px 6px 1px 7px;border-radius:9999px;font-size:11px;font-weight:500;margin:0 2px;vertical-align:middle;user-select:none;line-height:1.6;font-family:monospace;';
        const labelEl = document.createElement('span');
        labelEl.textContent = `fx: ${seg.label}`;
        pill.appendChild(labelEl);
        const xBtn = document.createElement('button');
        xBtn.dataset.remove = 'true';
        xBtn.type = 'button';
        xBtn.style.cssText =
          'background:none;border:none;padding:0;cursor:pointer;display:flex;align-items:center;color:inherit;opacity:0.55;margin-left:1px;flex-shrink:0;';
        xBtn.innerHTML =
          '<svg width="9" height="9" viewBox="0 0 9 9" fill="none" style="pointer-events:none"><path d="M1.5 1.5l6 6M7.5 1.5l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
        pill.appendChild(xBtn);
        container.appendChild(pill);
      }
    });
  };

  // Populate DOM on initial mount
  useLayoutEffect(() => {
    if (divRef.current) buildDOM(segments, divRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync DOM → state only for externally-driven changes (pill insertions)
  useLayoutEffect(() => {
    if (!divRef.current) return;
    if (segments === externalRef.current) return;
    externalRef.current = segments;
    buildDOM(segments, divRef.current);
    // Place cursor at end
    const range = document.createRange();
    range.selectNodeContents(divRef.current);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    divRef.current.focus();
  }, [segments]);

  const parseDOM = (): InstrSegment[] => {
    const segs: InstrSegment[] = [];
    divRef.current?.childNodes.forEach(n => {
      if (n.nodeType === Node.TEXT_NODE) {
        segs.push({ type: 'text', value: n.textContent ?? '' });
      } else if (n instanceof HTMLElement && n.dataset.type === 'pill') {
        segs.push({ type: 'pill', nodeLabel: n.dataset.node ?? '', output: n.dataset.output ?? '', nodeConnector: n.dataset.nodeConnector || undefined });
      } else if (n instanceof HTMLElement && n.dataset.type === 'power-fx-pill') {
        segs.push({ type: 'power-fx-pill', expression: n.dataset.expression ?? '', label: n.dataset.label ?? '' });
      }
    });
    return segs;
  };

  const isEmpty = segments.every(s => s.type === 'text' && s.value === '');

  return (
    <div className="relative">
      <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">
        Instructions
      </label>
      <div
        ref={divRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          const segs = parseDOM();
          externalRef.current = segs;
          onSegmentsChange(segs);
        }}
        onClick={e => {
          const target = e.target as HTMLElement;
          if (target.dataset.remove === 'true') {
            const pill = target.closest('[data-type="pill"], [data-type="power-fx-pill"]') as HTMLElement;
            if (pill && divRef.current) {
              pill.remove();
              const segs = parseDOM();
              externalRef.current = segs;
              onSegmentsChange(segs);
            }
          }
        }}
        className="block w-full px-3.5 py-2 bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] border border-[hsl(var(--secondary-border))] rounded-lg transition-colors hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] text-sm leading-loose"
        style={{ minHeight: 120, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
      />
      {isEmpty && (
        <div className="absolute text-sm text-gray-400 pointer-events-none select-none" style={{ top: 'calc(1.5rem + 0.5rem + 0.5rem)', left: '0.875rem', right: '0.875rem' }}>
          {placeholder}
        </div>
      )}
    </div>
  );
};

export default InstructionEditor;
