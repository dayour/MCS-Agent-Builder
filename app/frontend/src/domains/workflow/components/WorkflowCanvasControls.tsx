// ─── Canvas Controls ───────────────────────────────────────────────────────
// Zoom, fit-to-screen, layout toggle, tidy-up, and clear buttons.
// Extracted from WorkflowCanvas.tsx — pure refactor, no behavior changes.

import React from 'react';
import {
  ZoomIn20Regular,
  ZoomOut20Regular,
  ArrowFit20Regular,
  Organization20Regular,
  Eraser20Regular,
  Note24Filled,
} from '@fluentui/react-icons';
import { CopilotButton } from '../../../components/ui';
import { canvasControlBtnClass } from './workflowConstants';
import type { WorkflowCanvasState } from './useWorkflowCanvas';

interface Props {
  ctx: WorkflowCanvasState;
}

/** V1: vertical bottom-left control bar */
export const V1CanvasControls: React.FC<Props> = ({ ctx }) => {
  const { handleZoomIn, handleZoomOut, handleFitToScreen, handleTidyUp, canvasLayout, setCanvasLayout } = ctx;
  const iconStyle = { width: 20, height: 20 } as const;
  return (
    <div className="absolute bottom-4 left-4 z-20 bg-white border border-gray-200 rounded-2xl flex flex-row items-center justify-around px-2 py-2" style={{ width: 240, boxShadow: 'var(--shadow-dropdown)' }}>
      <CopilotButton variant="ghost" size="sm" className={canvasControlBtnClass} title="Zoom in" onClick={handleZoomIn}>
        <span style={{ display: 'inline-flex' }}><ZoomIn20Regular style={iconStyle} /></span>
      </CopilotButton>
      <CopilotButton variant="ghost" size="sm" className={canvasControlBtnClass} title="Zoom out" onClick={handleZoomOut}>
        <span style={{ display: 'inline-flex' }}><ZoomOut20Regular style={iconStyle} /></span>
      </CopilotButton>
      <CopilotButton variant="ghost" size="sm" className={canvasControlBtnClass} title="Fit to canvas" onClick={handleFitToScreen}>
        <span style={{ display: 'inline-flex' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M2 6.5V2h4.5M13.5 2H18v4.5M18 13.5V18h-4.5M6.5 18H2v-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </CopilotButton>
      <CopilotButton
        variant="ghost"
        size="sm"
        className={canvasControlBtnClass}
        title={canvasLayout === 'vertical' ? 'Switch to horizontal layout' : 'Switch to vertical layout'}
        onClick={() => setCanvasLayout(l => l === 'vertical' ? 'horizontal' : 'vertical')}
      >
        <span style={{ display: 'inline-flex', transform: canvasLayout === 'horizontal' ? 'rotate(270deg)' : 'none' }}>
          <Organization20Regular style={iconStyle} />
        </span>
      </CopilotButton>
      <CopilotButton variant="ghost" size="sm" className={canvasControlBtnClass} title="Tidy up (clean up layout)" onClick={handleTidyUp}>
        <span style={{ display: 'inline-flex' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M14 3l3 3-9.5 9.5H4v-3.5L14 3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4 16H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </span>
      </CopilotButton>
    </div>
  );
};

/** V2: horizontal centered bottom, full V1 feature set */
export const V2CanvasControls: React.FC<Props> = ({ ctx }) => {
  const { handleZoomIn, handleZoomOut, handleFitToScreen, handleTidyUp, canvasLayout, setCanvasLayout, setDraggedStep, addStep } = ctx;
  const iconStyle = { width: 20, height: 20, flexShrink: 0 } as const;
  const zoomIconStyle = { width: 22, height: 22, flexShrink: 0 } as const;
  return (
    <div className="absolute bottom-4 z-20 bg-white border border-gray-200 rounded-2xl flex flex-row items-center py-1.5 px-1.5 gap-0.5" style={{ left: 'calc(50% - 198px)', transform: 'translateX(-50%)', boxShadow: 'var(--shadow-dropdown)' }}>
      <CopilotButton variant="ghost" size="sm" className={canvasControlBtnClass} title="Zoom out" onClick={handleZoomOut}><ZoomOut20Regular style={zoomIconStyle} /></CopilotButton>
      <CopilotButton variant="ghost" size="sm" className={canvasControlBtnClass} title="Zoom in" onClick={handleZoomIn}><ZoomIn20Regular style={zoomIconStyle} /></CopilotButton>
      <div className="w-px h-5 bg-gray-200 mx-0.5" />
      <CopilotButton variant="ghost" size="sm" className={canvasControlBtnClass} title="Fit to canvas" onClick={handleFitToScreen}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={iconStyle}>
          <path d="M2 6.5V2h4.5M13.5 2H18v4.5M18 13.5V18h-4.5M6.5 18H2v-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </CopilotButton>
      <CopilotButton
        variant="ghost"
        size="sm"
        className={canvasControlBtnClass}
        title={canvasLayout === 'vertical' ? 'Switch to horizontal layout' : 'Switch to vertical layout'}
        onClick={() => setCanvasLayout(l => l === 'vertical' ? 'horizontal' : 'vertical')}
      >
        <span style={{ display: 'inline-flex', transform: canvasLayout === 'horizontal' ? 'rotate(270deg)' : 'none' }}>
          <Organization20Regular style={iconStyle} />
        </span>
      </CopilotButton>
      <CopilotButton variant="ghost" size="sm" className={canvasControlBtnClass} title="Tidy up (clean up layout)" onClick={handleTidyUp}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={iconStyle}>
          <path d="M14 3l3 3-9.5 9.5H4v-3.5L14 3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M4 16H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </CopilotButton>
      <div className="w-px h-5 bg-gray-200 mx-0.5" />
      <div
        draggable
        title="Add a sticky note — drag onto canvas or click to add"
        onDragStart={e => { setDraggedStep({ type: 'note', label: 'Note', icon: null }); e.dataTransfer.effectAllowed = 'copy'; }}
        onDragEnd={() => setDraggedStep(null)}
        onClick={() => addStep('note', 'Note')}
        className={`${canvasControlBtnClass} cursor-grab active:cursor-grabbing flex items-center justify-center`}
      >
        <Note24Filled style={{ width: 20, height: 20, color: '#eab308', flexShrink: 0 }} />
      </div>
    </div>
  );
};

/** V3: simple horizontal centered bottom */
export const V3CanvasControls: React.FC<Props> = ({ ctx }) => {
  const { handleZoomIn, handleZoomOut, handleFitToScreen, handleClear, zoom } = ctx;
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-white border border-gray-200 rounded-2xl flex flex-row items-center py-1.5 px-1.5 gap-0.5" style={{ boxShadow: 'var(--shadow-dropdown)' }}>
      <CopilotButton variant="ghost" size="sm" className={canvasControlBtnClass} title="Zoom out" onClick={handleZoomOut}><ZoomOut20Regular /></CopilotButton>
      <CopilotButton variant="ghost" size="sm" className="px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors tabular-nums min-w-[3rem] text-center" title="Reset zoom" onClick={handleFitToScreen}>{Math.round(zoom * 100)}%</CopilotButton>
      <CopilotButton variant="ghost" size="sm" className={canvasControlBtnClass} title="Zoom in" onClick={handleZoomIn}><ZoomIn20Regular /></CopilotButton>
      <div className="w-px h-5 bg-gray-200 mx-0.5" />
      <CopilotButton variant="ghost" size="sm" className={canvasControlBtnClass} title="Fit to screen" onClick={handleFitToScreen}><ArrowFit20Regular /></CopilotButton>
      <CopilotButton variant="ghost" size="sm" className={canvasControlBtnClass} title="Auto-layout"><Organization20Regular /></CopilotButton>
      <CopilotButton variant="ghost" size="sm" className={canvasControlBtnClass} title="Clear canvas" onClick={handleClear}><Eraser20Regular /></CopilotButton>
    </div>
  );
};
