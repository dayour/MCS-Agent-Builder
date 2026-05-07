import React, { useState, useRef, useEffect } from 'react';

interface UseAgentDragOptions {
  agentListRef: React.RefObject<HTMLDivElement | null>;
  onReorder: (ids: string[]) => void;
  visibleAgentIdsRef: React.MutableRefObject<string[]>;
}

/**
 * Drag-to-reorder logic for the agent list.
 * Supports mouse and touch; uses a 300ms long-press to activate.
 */
export function useAgentDrag({ agentListRef, onReorder, visibleAgentIdsRef }: UseAgentDragOptions) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartYRef = useRef(0);
  const dragActiveRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const dragInfoRef = useRef<{ agentId: string; dropIndex: number } | null>(null);
  const itemHeightRef = useRef(52);

  useEffect(() => {
    if (draggingId !== null && dropIndex !== null) {
      dragInfoRef.current = { agentId: draggingId, dropIndex };
    }
  }, [draggingId, dropIndex]);

  useEffect(() => {
    if (!draggingId) return;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    const updateDropPosition = (clientY: number) => {
      setDragY(clientY);
      if (agentListRef.current) {
        const items = agentListRef.current.querySelectorAll('[data-drag-id]');
        let newIdx = items.length;
        for (let i = 0; i < items.length; i++) {
          const rect = (items[i] as HTMLElement).getBoundingClientRect();
          if (clientY < rect.top + rect.height / 2) { newIdx = i; break; }
        }
        setDropIndex(newIdx);
      }
    };

    const commitDrop = () => {
      if (dragInfoRef.current) {
        const { agentId, dropIndex: dIdx } = dragInfoRef.current;
        const ids = [...visibleAgentIdsRef.current];
        const fromIndex = ids.indexOf(agentId);
        if (fromIndex !== -1 && dIdx !== fromIndex && dIdx !== fromIndex + 1) {
          const newIds = [...ids];
          newIds.splice(fromIndex, 1);
          const adjustedTarget = dIdx > fromIndex ? dIdx - 1 : dIdx;
          newIds.splice(adjustedTarget, 0, agentId);
          onReorder(newIds);
        }
      }
      dragActiveRef.current = false;
      setDraggingId(null);
      setDropIndex(null);
      dragInfoRef.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      setTimeout(() => { suppressNextClickRef.current = false; }, 50);
    };

    const handleMouseMove = (e: MouseEvent) => updateDropPosition(e.clientY);
    const handleMouseUp = () => commitDrop();
    const handleTouchMove = (e: TouchEvent) => { e.preventDefault(); updateDropPosition(e.touches[0].clientY); };
    const handleTouchEnd = () => commitDrop();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [draggingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const makeDragHandlers = (agentId: string, index: number) => ({
    onMouseDown: (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      dragStartYRef.current = e.clientY;
      longPressTimerRef.current = setTimeout(() => {
        if (agentListRef.current) {
          const items = agentListRef.current.querySelectorAll('[data-drag-id]');
          if (items.length >= 2) { const r0 = (items[0] as HTMLElement).getBoundingClientRect(); const r1 = (items[1] as HTMLElement).getBoundingClientRect(); itemHeightRef.current = r1.top - r0.top; }
          else if (items.length === 1) { itemHeightRef.current = (items[0] as HTMLElement).getBoundingClientRect().height + 4; }
        }
        dragActiveRef.current = true; suppressNextClickRef.current = true;
        setDraggingId(agentId); setDragY(e.clientY); setDropIndex(index);
      }, 300);
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (longPressTimerRef.current && Math.abs(e.clientY - dragStartYRef.current) > 8) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
    },
    onMouseUp: () => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } },
    onTouchStart: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      dragStartYRef.current = touch.clientY;
      longPressTimerRef.current = setTimeout(() => {
        if (agentListRef.current) {
          const items = agentListRef.current.querySelectorAll('[data-drag-id]');
          if (items.length >= 2) { const r0 = (items[0] as HTMLElement).getBoundingClientRect(); const r1 = (items[1] as HTMLElement).getBoundingClientRect(); itemHeightRef.current = r1.top - r0.top; }
          else if (items.length === 1) { itemHeightRef.current = (items[0] as HTMLElement).getBoundingClientRect().height + 4; }
        }
        dragActiveRef.current = true; suppressNextClickRef.current = true;
        setDraggingId(agentId); setDragY(touch.clientY); setDropIndex(index);
      }, 300);
    },
    onTouchMove: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (longPressTimerRef.current && Math.abs(touch.clientY - dragStartYRef.current) > 8) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
    },
    onTouchEnd: () => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } },
  });

  const getTranslateY = (itemIndex: number, draggingIdx: number): number => {
    if (!draggingId || dropIndex === null || itemIndex === draggingIdx) return 0;
    const h = itemHeightRef.current;
    if (dropIndex <= draggingIdx) {
      if (itemIndex >= dropIndex && itemIndex < draggingIdx) return h;
    } else {
      if (itemIndex > draggingIdx && itemIndex < dropIndex) return -h;
    }
    return 0;
  };

  const isSuppressingClick = () => suppressNextClickRef.current;

  return {
    draggingId,
    dragY,
    dropIndex,
    itemHeightRef,
    makeDragHandlers,
    getTranslateY,
    isSuppressingClick,
    clearSuppressClick: () => { suppressNextClickRef.current = false; },
  };
}
