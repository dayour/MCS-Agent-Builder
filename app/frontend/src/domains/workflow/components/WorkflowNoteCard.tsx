// ─── Workflow Note Card ─────────────────────────────────────────────────────
// Sticky-note overlay for the canvas. Note nodes always live in floatingNodes
// (never in the workflow flow) and are purely for builder annotations.

import React, { useState, useRef, useEffect } from 'react';
import { Note24Filled, MoreVertical20Regular, Delete20Regular } from '@fluentui/react-icons';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotTextarea } from '../../../components/ui/CopilotTextarea';
import { WorkflowNode } from '../../../types';
import type { WorkflowCanvasState } from './useWorkflowCanvas';

type NoteColor = 'yellow' | 'blue' | 'green' | 'purple' | 'red' | 'orange';

const COLOR_THEMES: Record<NoteColor, { bg: string; border: string; borderActive: string; divider: string; accent: string; label: string; dot: string }> = {
  yellow: { bg: '#fef9c3', border: '#fde68a', borderActive: '#eab308', divider: '#fde68a', accent: '#ca8a04', label: '#a16207', dot: '#eab308' },
  blue:   { bg: '#dbeafe', border: '#93c5fd', borderActive: '#3b82f6', divider: '#93c5fd', accent: '#1d4ed8', label: '#1e40af', dot: '#3b82f6' },
  green:  { bg: '#dcfce7', border: '#86efac', borderActive: '#22c55e', divider: '#86efac', accent: '#15803d', label: '#166534', dot: '#22c55e' },
  purple: { bg: '#f3e8ff', border: '#d8b4fe', borderActive: '#a855f7', divider: '#d8b4fe', accent: '#7c3aed', label: '#6d28d9', dot: '#a855f7' },
  red:    { bg: '#fee2e2', border: '#fca5a5', borderActive: '#ef4444', divider: '#fca5a5', accent: '#dc2626', label: '#b91c1c', dot: '#ef4444' },
  orange: { bg: '#ffedd5', border: '#fdba74', borderActive: '#f97316', divider: '#fdba74', accent: '#ea580c', label: '#c2410c', dot: '#f97316' },
};

const COLOR_ORDER: NoteColor[] = ['yellow', 'blue', 'green', 'purple', 'red', 'orange'];

interface WorkflowNoteCardProps {
  node: WorkflowNode;
  ctx: WorkflowCanvasState;
}

export const WorkflowNoteCard: React.FC<WorkflowNoteCardProps> = ({ node, ctx }) => {
  const {
    deleteNode,
    setFloatingNodes,
    draggingNodeId, setDraggingNodeId,
    draggingOffsetRef,
    hasDraggedRef,
    canvasContainerRef,
    panX, panY, zoom,
  } = ctx;

  const color: NoteColor = node.noteColor ?? 'yellow';
  const theme = COLOR_THEMES[color];

  const [text, setText] = useState(node.noteText ?? '');
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isDragging = draggingNodeId === node.id;

  useEffect(() => {
    if (!colorPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setColorPickerOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colorPickerOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const startDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasContainerRef.current) return;
    hasDraggedRef.current = false;
    const nodeRect = e.currentTarget.getBoundingClientRect();
    const containerRect = canvasContainerRef.current.getBoundingClientRect();
    const nodeCX = (nodeRect.left + nodeRect.width / 2 - containerRect.left - containerRect.width / 2 - panX) / zoom;
    const nodeCY = (nodeRect.top + nodeRect.height / 2 - containerRect.top - containerRect.height / 2 - panY) / zoom;
    const mouseCX = (e.clientX - containerRect.left - containerRect.width / 2 - panX) / zoom;
    const mouseCY = (e.clientY - containerRect.top - containerRect.height / 2 - panY) / zoom;
    draggingOffsetRef.current = { dx: mouseCX - nodeCX, dy: mouseCY - nodeCY };
    setDraggingNodeId(node.id);
    e.stopPropagation();
  };

  const patch = (updates: Partial<WorkflowNode>) => {
    setFloatingNodes(prev => prev.map(n => n.id === node.id ? { ...n, ...updates } : n));
  };

  return (
    // Outer wrapper — position:relative so the color picker can be anchored above the card
    <div
      ref={wrapperRef}
      data-no-pan
      style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column' }}
    >
      {/* Color picker — floats above the card */}
      {colorPickerOpen && (
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'white',
            border: '1px solid hsl(var(--stroke-default))',
            borderRadius: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.13)',
            padding: '7px 10px',
            display: 'flex',
            gap: 7,
            zIndex: 200,
          }}
        >
          {COLOR_ORDER.map(c => (
            <CopilotButton
              key={c}
              variant="ghost"
              size="sm"
              onClick={e => { e.stopPropagation(); patch({ noteColor: c }); setColorPickerOpen(false); }}
              style={{
                width: 18, height: 18,
                minWidth: 0,
                padding: 0,
                borderRadius: '50%',
                background: COLOR_THEMES[c].dot,
                border: c === color ? '2.5px solid #374151' : '1.5px solid rgba(0,0,0,0.15)',
              }}
              title={c.charAt(0).toUpperCase() + c.slice(1)}
            />
          ))}
        </div>
      )}

      {/* The card */}
      <div
        onMouseDown={startDrag}
        className="select-none flex flex-col"
        style={{
          width: 220,
          minHeight: 160,
          background: theme.bg,
          border: `1.5px solid ${isDragging ? theme.borderActive : theme.border}`,
          borderRadius: 8,
          boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : '2px 3px 10px rgba(0,0,0,0.10)',
          cursor: isDragging ? 'grabbing' : 'grab',
          padding: '8px 10px 10px',
          opacity: isDragging ? 0.9 : 1,
          transition: 'box-shadow 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => { if (!isDragging) (e.currentTarget as HTMLDivElement).style.boxShadow = '2px 4px 14px rgba(0,0,0,0.14)'; }}
        onMouseLeave={e => { if (!isDragging) (e.currentTarget as HTMLDivElement).style.boxShadow = '2px 3px 10px rgba(0,0,0,0.10)'; }}
      >
        {/* Header */}
        <div className="flex items-center gap-1 mb-2 flex-shrink-0" style={{ minHeight: 22 }}>
          <Note24Filled style={{ color: theme.accent, width: 13, height: 13, flexShrink: 0 }} />

          <span className="flex-1 font-semibold truncate min-w-0" style={{ color: theme.label, fontSize: 11, lineHeight: '1' }}>
            Note
          </span>

          {/* Color dot trigger */}
          <CopilotButton
            variant="ghost"
            size="sm"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); setColorPickerOpen(v => !v); setMenuOpen(false); }}
            style={{
              width: 13, height: 13,
              minWidth: 0,
              padding: 0,
              borderRadius: '50%',
              background: theme.dot,
              border: '1.5px solid rgba(0,0,0,0.18)',
              flexShrink: 0,
            }}
            title="Change color"
          />

          {/* Overflow menu */}
          <div className="relative flex-shrink-0" ref={menuRef}>
            <CopilotButton
              variant="ghost"
              size="sm"
              className="!w-6 !h-6 !p-0 !text-gray-500 hover:!text-gray-900 hover:!bg-black/10"
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); setColorPickerOpen(false); }}
              title="More options"
            >
              <MoreVertical20Regular style={{ width: 16, height: 16 }} />
            </CopilotButton>
            {menuOpen && (
              <div
                className="absolute right-0 z-[200] py-1"
                style={{
                  top: 'calc(100% + 2px)',
                  background: 'white',
                  border: '1px solid hsl(var(--stroke-default))',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-dropdown)',
                  minWidth: 140,
                }}
                onMouseDown={e => e.stopPropagation()}
              >
                <CopilotButton
                  variant="ghost"
                  size="sm"
                  className="w-full !justify-start gap-2 px-3 !text-[hsl(var(--status-error))] hover:!text-[hsl(var(--status-error))] hover:bg-[#FDE7E9]"
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); deleteNode(node.id); }}
                >
                  <Delete20Regular style={{ width: 15, height: 15 }} />
                  Delete
                </CopilotButton>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: theme.divider, marginBottom: 8, flexShrink: 0 }} />

        {/* Editable text area — strip CopilotTextarea's default border/bg via child selectors */}
        <CopilotTextarea
          className="flex-1 [&_textarea]:!bg-transparent [&_textarea]:!border-0 [&_textarea]:!shadow-none [&_textarea]:!ring-0 [&_textarea]:!outline-none [&_textarea]:!resize-none [&_textarea]:!rounded-none [&_textarea]:!p-0 [&_textarea]:!text-[13px] [&_textarea]:!leading-relaxed [&_textarea]:!text-[#44403c] [&_textarea]:cursor-text [&_textarea]:!min-h-[100px]"
          placeholder="Add text"
          value={text}
          onMouseDown={e => e.stopPropagation()}
          onChange={e => setText(e.target.value)}
          onBlur={() => patch({ noteText: text })}
        />
      </div>
    </div>
  );
};
