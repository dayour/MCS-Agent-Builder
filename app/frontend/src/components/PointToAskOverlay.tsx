import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';

interface PointToAskOverlayProps {
  onSelect: (result: { label: string; elementType: string; sectionContext: { section: string; sectionDesc: string } | null; askContext: string | null }) => void;
  onCancel: () => void;
}

interface HighlightRect {
  top: number; left: number; width: number; height: number;
}

function isMeaningful(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute('role') || '';
  const meaningfulTags = ['button', 'input', 'select', 'textarea', 'a'];
  const meaningfulRoles = ['button', 'tab', 'menuitem', 'checkbox', 'switch', 'link', 'option'];
  return (
    meaningfulTags.includes(tag) ||
    meaningfulRoles.includes(role) ||
    el.hasAttribute('data-ask-context') ||
    el.hasAttribute('data-section')
  );
}

function findBestTarget(el: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = el;
  let levels = 0;
  while (current && current !== document.body && levels < 8) {
    if (isMeaningful(current)) return current;
    current = current.parentElement;
    levels++;
  }
  return null;
}

function findSectionContext(el: HTMLElement): { section: string; sectionDesc: string } | null {
  let current: HTMLElement | null = el.parentElement;
  while (current && current !== document.body) {
    if (current.hasAttribute('data-section')) {
      return {
        section: current.getAttribute('data-section')!,
        sectionDesc: current.getAttribute('data-section-description') || '',
      };
    }
    current = current.parentElement;
  }
  return null;
}

function extractElementLabel(el: HTMLElement): { label: string; elementType: string; sectionContext: { section: string; sectionDesc: string } | null; askContext: string | null } {
  const elementType = el.getAttribute('data-component') || el.tagName.toLowerCase();
  const sectionContext = findSectionContext(el);
  const askContext = el.getAttribute('data-ask-context') || null;

  // priority: data-ask-context > aria-label > title > data-name > innerText > role fallback
  // When data-ask-context is present, use the part before " — " (if any) as the short label
  // for the quote chip, while the full string is passed as askContext to the LLM.
  if (askContext) {
    const dashIdx = askContext.indexOf(' \u2014 ');
    const shortLabel = dashIdx !== -1 ? askContext.slice(0, dashIdx) : askContext;
    return { label: shortLabel, elementType, sectionContext, askContext };
  }
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel?.trim()) return { label: ariaLabel.trim(), elementType, sectionContext, askContext };
  const title = el.getAttribute('title');
  if (title?.trim()) return { label: title.trim(), elementType, sectionContext, askContext };
  const dataName = el.getAttribute('data-name') || el.getAttribute('data-component');
  if (dataName?.trim()) return { label: dataName.trim(), elementType, sectionContext, askContext };
  const text = el.innerText?.trim().replace(/\s+/g, ' ').slice(0, 50);
  if (text) return { label: text, elementType, sectionContext, askContext };
  const role = el.getAttribute('role') || el.tagName.toLowerCase();
  return { label: `${role} element`, elementType, sectionContext, askContext };
}

export function PointToAskOverlay({ onSelect, onCancel }: PointToAskOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const hoveredElementRef = useRef<HTMLElement | null>(null);
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const x = e.clientX;
    const y = e.clientY;
    setMousePos({ x, y });

    if (overlayRef.current) {
      overlayRef.current.style.pointerEvents = 'none';
    }
    const elements = document.elementsFromPoint(x, y);
    if (overlayRef.current) {
      overlayRef.current.style.pointerEvents = 'auto';
    }

    const rawTarget = elements.find(el => {
      if (el === overlayRef.current) return false;
      if (el === document.documentElement || el === document.body) return false;
      const rect = (el as HTMLElement).getBoundingClientRect();
      if (rect.width > window.innerWidth * 0.8 && rect.height > window.innerHeight * 0.8) return false;
      if (rect.width === 0 || rect.height === 0) return false;
      if (window.getComputedStyle(el as HTMLElement).pointerEvents === 'none') return false;
      return true;
    }) as HTMLElement | undefined;

    const target = rawTarget ? findBestTarget(rawTarget) : null;

    if (target) {
      const rect = target.getBoundingClientRect();
      setHighlightRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      hoveredElementRef.current = target;
    } else {
      setHighlightRect(null);
      hoveredElementRef.current = null;
    }
  }, []);

  const handleClick = useCallback((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hoveredElementRef.current) {
      const result = extractElementLabel(hoveredElementRef.current);
      onSelect(result);
    } else {
      onCancel();
    }
  }, [onSelect, onCancel]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, [onCancel]);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleMouseMove, handleClick, handleKeyDown]);

  if (!mounted) return null;
  return ReactDOM.createPortal(
    <>
      <div
        ref={overlayRef}
        role="application"
        aria-label="UI inspection mode — press Escape to cancel"
        className="fixed inset-0 z-[9999]"
        style={{ cursor: 'crosshair' }}
      />
      {highlightRect && (
        <div
          className="fixed pointer-events-none z-[9999] border-2 border-[#0078D4] rounded"
          style={{
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
            background: 'rgba(0,120,212,0.08)',
            transition: 'top 40ms ease-out, left 40ms ease-out, width 40ms ease-out, height 40ms ease-out',
          }}
        />
      )}
      {mousePos && (
        <div
          className="fixed pointer-events-none z-[9999] bg-gray-900 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap shadow-md"
          style={{ top: mousePos.y + 16, left: mousePos.x + 12, opacity: highlightRect ? 1 : 0.6 }}
        >
          {highlightRect ? 'Click to ask about this' : 'Move to a UI element'}
        </div>
      )}
    </>,
    document.body
  );
}
