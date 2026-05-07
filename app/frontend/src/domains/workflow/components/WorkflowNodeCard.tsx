// ─── Workflow Node Card ────────────────────────────────────────────────────
// Renders a single node card on the canvas. Handles drag, selection, context menu.
// Extracted from WorkflowCanvas.tsx — pure refactor, no behavior changes.

import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import {
  Flash24Filled,
  Flash24Regular,
  MoreHorizontal32Filled,
  ChatBubblesQuestion20Regular,
  Copy20Regular,
  Delete20Regular,
  PlugDisconnected20Regular,
} from '@fluentui/react-icons';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotTooltip } from '../../../components/ui';
import { CopilotMenu } from '../../../components/ui/CopilotMenu';
import type { CopilotMenuPosition } from '../../../components/ui/CopilotMenu';
import { WorkflowNode, getBranchLabels } from '../../../types';
import {
  V1_TRIGGER_TYPES,
  V2_STEP_CAT,
  getConnectorIconSrc,
  connectorColor,
  getNodeErrors,
} from './workflowConstants';
import { CONNECTOR_COLOR, CONNECTOR_WIDTH, DOT_FILL, DOT_STROKE, DOT_FILL_END, DOT_STROKE_END, DOT_SIZE } from './workflowConstants';
import type { WorkflowCanvasState } from './useWorkflowCanvas';

// CSS border renders thinner than a solid div of the same width due to anti-aliasing.
// This compensates so card strokes visually match connector line thickness.
const CARD_BORDER_WIDTH = 1.5;
const CARD_BORDER_WIDTH_SELECTED = 2.5;

export interface EmptyBranchPill {
  branch: string;
  insertIdx: number;
  parentConditionId?: string;
  subbranch?: "true" | "false";
}

interface WorkflowNodeCardProps {
  node: WorkflowNode;
  ctx: WorkflowCanvasState;
  /** When set, renders per-pill + buttons extending to the right of the card (empty branch state) */
  emptyBranchPills?: EmptyBranchPill[] | null;
}

const ErrorBadge: React.FC<{ errors: string[] }> = ({ errors }) => (
  <CopilotTooltip content={errors.join(' · ')}>
    <div
      role="img"
      aria-label={`${errors.length} configuration error${errors.length > 1 ? 's' : ''}`}
      style={{
        position: 'absolute', top: -5, right: -5, zIndex: 10,
        minWidth: 18, height: 18, borderRadius: 9,
        background: 'hsl(var(--status-error))', border: '2px solid white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 3px',
        fontSize: 10, fontWeight: 700, color: 'white', lineHeight: 1,
        userSelect: 'none',
      }}
    >
      {errors.length === 1 ? '!' : errors.length}
    </div>
  </CopilotTooltip>
);

export const WorkflowNodeCard: React.FC<WorkflowNodeCardProps> = ({ node, ctx, emptyBranchPills }) => {
  const {
    selectedNode, setSelectedNode,
    nodeMenuOpen, setNodeMenuOpen,
    nodeCardRefs,
    canvasContainerRef,
    panX, panY, zoom,
    draggingNodeId, setDraggingNodeId,
    draggingOffsetRef,
    hasDraggedRef,
    closeAddStep,
    detachNode,
    deleteNode,
    isUnnamedStep,
    getNodeIcon,
    v1TriggerType,
    v1SelectedConnector,
    v1SelectedConnectorAction,
    v1RecurrenceRepeat,
    v1SlidingFreq,
    isStepTypeVisuals,
    canvasLayout,
  } = ctx;

  const NEEDS_CONFIG_DIALOG = (label: string) => ['MCP', 'Computer Use', 'Agent', 'Prompt'].includes(label);
  const isControlFlowNode = (n: WorkflowNode) => n.type === 'condition' || ['Function', 'Variable', 'Loop'].includes(n.label);
  const isSelected = (n: WorkflowNode) => selectedNode?.id === n.id;
  const nodeIconStyle = { color: 'hsl(var(--primary))' };
  const isHorizontalCard = isStepTypeVisuals && canvasLayout === 'horizontal';

  const errors = getNodeErrors(node);
  const hasErrors = errors.length > 0;
  const isDragging = draggingNodeId === node.id;

  const [isHovered, setIsHovered] = useState(false);

  const cardBoxShadow = (() => {
    if (isDragging)                      return '0 8px 28px -2px rgba(0,0,0,0.18), 0 4px 12px -4px rgba(0,0,0,0.12)';
    if (isHovered && !node.placeholder && !isSelected(node)) return 'var(--shadow-dropdown)';
    return 'none';
  })();

  // Fixed-position overflow menu — avoids being clipped by canvas overflow:hidden
  const [menuPos, setMenuPos] = useState<CopilotMenuPosition | null>(null);

  const openNodeMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (nodeMenuOpen === node.id) { setNodeMenuOpen(null); setMenuPos(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setNodeMenuOpen(node.id);
  };

  const closeMenu = () => { setNodeMenuOpen(null); setMenuPos(null); };

  const menuItems = [
    { label: 'Duplicate', icon: <Copy20Regular style={{ width: 16, height: 16 }} />, onClick: () => { closeMenu(); } },
    { label: 'Configure with AI', icon: <ChatBubblesQuestion20Regular style={{ width: 16, height: 16 }} />, onClick: () => { window.dispatchEvent(new CustomEvent('elevate:workflow-focus-node', { detail: { nodeId: node.id, nodeType: node.type, nodeLabel: node.label, nodeConnector: node.connector, nodeConfig: node.config } })); closeMenu(); } },
    ...(!ctx.floatingNodes.some(n => n.id === node.id) ? [{ label: 'Detach from workflow', icon: <PlugDisconnected20Regular style={{ width: 16, height: 16 }} />, onClick: () => { detachNode(node.id); closeMenu(); } }] : []),
    { label: 'Delete', icon: <Delete20Regular style={{ width: 16, height: 16 }} />, onClick: () => { closeMenu(); deleteNode(node.id); }, destructive: true, dividerAbove: true },
  ];
  const startDrag = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!canvasContainerRef.current) return;
      hasDraggedRef.current = false;
      const nodeRect = e.currentTarget.getBoundingClientRect();
      const containerRect = canvasContainerRef.current.getBoundingClientRect();
      // Node center in canvas content coords
      const nodeCX = (nodeRect.left + nodeRect.width / 2 - containerRect.left - containerRect.width / 2 - panX) / zoom;
      const nodeCY = (nodeRect.top + nodeRect.height / 2 - containerRect.top - containerRect.height / 2 - panY) / zoom;
      // Mouse in canvas content coords
      const mouseCX = (e.clientX - containerRect.left - containerRect.width / 2 - panX) / zoom;
      const mouseCY = (e.clientY - containerRect.top - containerRect.height / 2 - panY) / zoom;
      draggingOffsetRef.current = { dx: mouseCX - nodeCX, dy: mouseCY - nodeCY };
      setDraggingNodeId(node.id);
      e.stopPropagation(); // prevent canvas pan from starting
    };
    const isCFStyled = isStepTypeVisuals && isControlFlowNode(node);
    const isTriggerStyled = isStepTypeVisuals && node.type === 'trigger';

  // Portal-rendered menu — escapes canvas overflow:hidden so it's never clipped
  const menuDropdown = nodeMenuOpen === node.id && menuPos
    ? ReactDOM.createPortal(
        <CopilotMenu items={menuItems} position={menuPos} onClose={closeMenu} minWidth={180} />,
        document.body
      )
    : null;

  // ── Horizontal (portrait) card ─────────────────────────────────────────────
  if (isHorizontalCard) {
    // Derive title + subtitle
    let hTitle = node.label;
    let hSubtitle: string | null = null;

    if (node.placeholder) {
      hTitle = node.label;
    } else if (node.type === 'trigger') {
      const repeatLabels: Record<string, string> = { minutely: 'Minutely', hourly: 'Hourly', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
      if (v1TriggerType === 'recurrence') { hTitle = repeatLabels[v1RecurrenceRepeat] ?? 'Recurrence'; hSubtitle = 'Trigger · Recurrence'; }
      else if (v1TriggerType === 'sliding-window') { hTitle = repeatLabels[v1SlidingFreq] ?? 'Sliding Window'; hSubtitle = 'Trigger · Sliding Window'; }
      else if (v1TriggerType === 'http-request') { hTitle = node.label; hSubtitle = 'Trigger · HTTP Request'; }
      else if (v1TriggerType === 'http') { hTitle = node.label; hSubtitle = 'Trigger · HTTP'; }
      else if (v1TriggerType === 'http-webhook') { hTitle = node.label; hSubtitle = 'Trigger · HTTP Webhook'; }
      else if (v1TriggerType === 'connector' && v1SelectedConnector) { hTitle = v1SelectedConnectorAction ?? v1SelectedConnector; hSubtitle = 'Trigger'; }
      else { hTitle = V1_TRIGGER_TYPES.find(t => t.id === v1TriggerType)?.nodeLabel ?? node.label; hSubtitle = 'Trigger'; }
    } else if (node.config?.instanceName) {
      hTitle = node.config.instanceName;
      hSubtitle = node.config.stepTypeLabel ?? node.label;
    } else if (isUnnamedStep(node)) {
      hTitle = node.label;
    } else if (node.config?.stepTypeLabel || NEEDS_CONFIG_DIALOG(node.label)) {
      hTitle = node.config?.instanceName ?? node.label;
      hSubtitle = node.config?.stepTypeLabel ?? node.label;
    } else if (node.connector) {
      hTitle = node.label;
      hSubtitle = node.connector;
    }

    // Per-type visual treatment — mirrors vertical mode distinctions
    const isTrigger = node.type === 'trigger';
    const isCF = isControlFlowNode(node);
    const isAI = !isCF && !isTrigger && V2_STEP_CAT[node.label] === 'ai';

    // Width: trigger=140 (simpler content), control-flow=120 (compact), others=160
    const hWidth = isTrigger ? 140 : isCF ? 120 : 160;
    const hMinHeight = isCF ? 80 : 100;
    // Trigger needs extra top padding to clear the floating badge above the card
    const hPaddingTop = isTrigger ? 36 : 12;

    const cardBg = isTrigger ? '#eff6ff' : 'white';
    const cardBorder = hasErrors
      ? `${isSelected(node) ? CARD_BORDER_WIDTH_SELECTED : CARD_BORDER_WIDTH}px solid #ef4444`
      : isSelected(node)
        ? `${CARD_BORDER_WIDTH_SELECTED}px solid hsl(var(--primary))`
        : isTrigger
          ? `${CARD_BORDER_WIDTH}px solid hsl(var(--primary) / 0.35)`
          : `${CARD_BORDER_WIDTH}px solid ${CONNECTOR_COLOR}`;

    return (
      <div
        data-no-pan
        ref={(el) => { if (el) nodeCardRefs.current.set(node.id, el); else nodeCardRefs.current.delete(node.id); }}
        onMouseDown={node.placeholder ? undefined : startDrag}
        onClick={() => { if (!hasDraggedRef.current && !node.placeholder) { setSelectedNode(node); closeAddStep(); } }}
        className={`transition-all flex-shrink-0 select-none relative flex flex-col items-center pb-2`}
        style={{
          width: hWidth, minHeight: hMinHeight,
          paddingTop: hPaddingTop,
          borderRadius: 'var(--radius-3xl)',
          background: node.placeholder ? '#f9fafb' : cardBg,
          border: node.placeholder ? 'none' : cardBorder,
          boxShadow: cardBoxShadow,
          cursor: node.placeholder ? 'default' : isDragging ? 'grabbing' : 'grab',
          opacity: isDragging ? 0.92 : 1,
          overflow: 'visible',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {node.placeholder && (
          <svg style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} width={hWidth} height={hMinHeight}>
            <rect x="0.75" y="0.75" width={hWidth - 1.5} height={hMinHeight - 1.5} rx="16" ry="16" fill="none" stroke={CONNECTOR_COLOR} strokeWidth={CONNECTOR_WIDTH} strokeDasharray="6 6" />
          </svg>
        )}

        {/* Trigger: floating bolt badge above card (mirrors vertical mode) */}
        {isTrigger && !node.placeholder && (
          <div className="absolute left-1/2 -translate-x-1/2 w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0" style={{ top: -18, background: 'hsl(var(--primary))', zIndex: 1 }}>
            <Flash24Filled style={{ color: 'white', width: 18, height: 18 }} />
          </div>
        )}

        {/* Overflow menu — absolute top-right (not shown for trigger) */}
        {!node.placeholder && !isTrigger && (
          <div className="absolute top-1 right-1 flex-shrink-0">
            <CopilotButton
              variant="ghost"
              size="sm"
              className="!w-6 !h-6 !p-0 !text-gray-400 hover:!text-gray-700 hover:!bg-gray-100"
              onClick={openNodeMenu}
            >
              <MoreHorizontal32Filled style={{ width: 16, height: 16 }} />
            </CopilotButton>
            {menuDropdown}
          </div>
        )}

        {/* Icon — trigger uses the floating badge above; regular/CF/AI show inline */}
        {!isTrigger && (
          <div className="relative flex-shrink-0">
            <div className={`flex items-center justify-center flex-shrink-0 ${isAI ? 'w-9 h-9 rounded-xl bg-[#eff6ff]' : 'w-8 h-8'}`}>
              {node.placeholder ? <Flash24Regular className="text-gray-400" /> : getNodeIcon(node)}
            </div>
            {hasErrors && !node.placeholder && <ErrorBadge errors={errors} />}
          </div>
        )}

        {/* Title */}
        <div
          className="w-full px-2 mt-1 text-center font-semibold leading-tight text-gray-900"
          style={{ fontSize: 11, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}
        >
          {hTitle}
        </div>

        {/* Subtitle */}
        {hSubtitle && (
          <div className="w-full px-2 mt-0.5 text-center truncate text-gray-500" style={{ fontSize: 10 }}>
            {hSubtitle}
          </div>
        )}
      </div>
    );
  }

  // ── Vertical (landscape) card — existing layout below ─────────────────────
  // For !isStepTypeVisuals vertical condition cards, grow the card width with branch count
  const verticalBranchCardWidth = (!isStepTypeVisuals && canvasLayout !== 'horizontal' && node.type === 'condition')
    ? Math.max(352, 352 + ((node.config?.elseIfBranches?.length ?? 0)) * 140)
    : null;

    return (
    <div
      data-no-pan
      ref={(el) => { if (el) nodeCardRefs.current.set(node.id, el); else nodeCardRefs.current.delete(node.id); }}
      onMouseDown={node.placeholder ? undefined : startDrag}
      onClick={() => { if (!hasDraggedRef.current && !node.placeholder) { setSelectedNode(node); closeAddStep(); } }}
      className={`transition-all flex-shrink-0 select-none relative ${node.placeholder ? 'bg-gray-50' : `${isTriggerStyled ? 'bg-[#eff6ff]' : 'bg-white'}`}`}
      style={{ width: verticalBranchCardWidth ?? (isTriggerStyled ? 210 : isCFStyled ? 280 : isStepTypeVisuals ? 380 : 352), height: isCFStyled ? 48 : (!isStepTypeVisuals && node.type === 'condition' ? 'auto' : 68), borderRadius: isStepTypeVisuals ? 'var(--radius-2xl)' : 'var(--radius-3xl)', padding: isTriggerStyled ? '14px 12px 0' : (!isStepTypeVisuals && node.type === 'condition' ? '10px 12px 12px' : '0 12px'), overflow: 'visible', display: 'flex', flexDirection: (!isStepTypeVisuals && node.type === 'condition') ? 'column' : undefined, alignItems: isTriggerStyled ? 'flex-start' : 'center', border: node.placeholder ? 'none' : hasErrors ? `${isSelected(node) ? CARD_BORDER_WIDTH_SELECTED : CARD_BORDER_WIDTH}px solid #ef4444` : isSelected(node) ? `${CARD_BORDER_WIDTH_SELECTED}px solid hsl(var(--primary))` : isTriggerStyled ? `${CARD_BORDER_WIDTH}px solid hsl(var(--primary) / 0.35)` : `${CARD_BORDER_WIDTH}px solid ${CONNECTOR_COLOR}`, boxShadow: cardBoxShadow, cursor: node.placeholder ? 'default' : isDragging ? 'grabbing' : 'grab', opacity: isDragging ? 0.92 : 1 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {node.placeholder && (
        <svg style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} width={isStepTypeVisuals ? 380 : 352} height="68">
          <rect x="0.75" y="0.75" width={isStepTypeVisuals ? 378.5 : 350.5} height="66.5" rx={isStepTypeVisuals ? 16 : 24} ry={isStepTypeVisuals ? 16 : 24} fill="none" stroke={CONNECTOR_COLOR} strokeWidth={CONNECTOR_WIDTH} strokeDasharray="6 6" />
        </svg>
      )}
      <div className={isTriggerStyled ? 'flex flex-col items-center w-full' : 'flex items-center gap-2 w-full'}>
        {node.placeholder ? (
          <div className="w-8 h-8 flex items-center justify-center text-lg flex-shrink-0">
            <Flash24Regular className="text-gray-400" />
          </div>
        ) : node.type === 'trigger' ? (
          isTriggerStyled ? (
            <div className="absolute left-1/2 -translate-x-1/2 w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0" style={{ top: -18, background: 'hsl(var(--primary))', zIndex: 1 }}>
              <Flash24Filled style={{ color: 'white', width: 18, height: 18 }} />
            </div>
          ) : (
            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
              <Flash24Filled style={{ color: 'hsl(var(--status-success))' }} />
            </div>
          )
        ) : (
          <div className="relative flex-shrink-0">
            <div className={`flex items-center justify-center text-lg flex-shrink-0 ${isStepTypeVisuals && V2_STEP_CAT[node.label] === 'ai' ? 'w-10 h-10 rounded-xl bg-[#eff6ff]' : 'w-8 h-8'}`}>{getNodeIcon(node)}</div>
            {hasErrors && !node.placeholder && <ErrorBadge errors={errors} />}
          </div>
        )}
        <div className={isTriggerStyled ? 'w-full text-center' : 'flex-1 min-w-0'}>
          {node.placeholder ? (
            <div className={`text-body-1 truncate text-gray-400`}>{node.label}</div>
          ) : node.type === 'trigger' ? (() => {
            if (ctx.version !== 2) {
              return <div className="text-body-2-strong truncate leading-tight text-gray-900">Start</div>;
            }
            const repeatLabels: Record<string, string> = { minutely: 'Minutely', hourly: 'Hourly', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
            let cardTitle = V1_TRIGGER_TYPES.find(t => t.id === v1TriggerType)?.nodeLabel ?? node.label;
            let cardSubtitle = 'Trigger · Manual';
            if (v1TriggerType === 'recurrence') {
              cardTitle = repeatLabels[v1RecurrenceRepeat] ?? 'Recurrence';
              cardSubtitle = 'Trigger · Recurrence';
            } else if (v1TriggerType === 'sliding-window') {
              cardTitle = repeatLabels[v1SlidingFreq] ?? 'Sliding Window';
              cardSubtitle = 'Trigger · Sliding Window';
            } else if (v1TriggerType === 'http-request') {
              cardSubtitle = 'Trigger · HTTP Request';
            } else if (v1TriggerType === 'http') {
              cardSubtitle = 'Trigger · HTTP';
            } else if (v1TriggerType === 'http-webhook') {
              cardSubtitle = 'Trigger · HTTP Webhook';
            } else if (v1TriggerType === 'connector') {
              if (v1SelectedConnector && v1SelectedConnectorAction) {
                cardTitle = v1SelectedConnectorAction;
              } else if (v1SelectedConnector) {
                cardTitle = v1SelectedConnector;
              } else {
                cardTitle = 'Select a connector';
                cardSubtitle = 'Trigger · Connector';
              }
            }
            if (isStepTypeVisuals) cardSubtitle = 'Trigger';
            const connectorError = v1TriggerType === 'connector' && !v1SelectedConnector;
            const showConnectorIcon = v1TriggerType === 'connector' && !!v1SelectedConnector && !isStepTypeVisuals;
            const v1IconSrc = showConnectorIcon ? getConnectorIconSrc(v1SelectedConnector!) : null;
            const v1Initials = showConnectorIcon ? v1SelectedConnector!.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() : '';
            const v1Bg = showConnectorIcon ? connectorColor(v1SelectedConnector!) : '';
            return (
              <>
                <div className={`text-body-2-strong truncate leading-tight ${connectorError ? 'text-amber-600' : 'text-gray-900'}`}>
                  {connectorError && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="inline-block mr-1 mb-0.5 flex-shrink-0"><path d="M6 1L11 10H1L6 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M6 5v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><circle cx="6" cy="9" r="0.6" fill="currentColor"/></svg>
                  )}
                  {cardTitle}
                </div>
                {showConnectorIcon ? (
                  <div className={`flex items-center gap-1 text-caption-1 text-gray-500 mt-0.5 min-w-0 ${isStepTypeVisuals ? 'justify-center' : ''}`}>
                    <span className="flex-shrink-0">Trigger ·</span>
                    <span className="w-3.5 h-3.5 rounded flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ backgroundColor: v1IconSrc ? 'white' : v1Bg }}>
                      {v1IconSrc ? <img src={v1IconSrc} alt="" className="w-3.5 h-3.5" /> : <span style={{ color: 'white', fontSize: 6, fontWeight: 700 }}>{v1Initials}</span>}
                    </span>
                    <span className="truncate">{v1SelectedConnector}</span>
                  </div>
                ) : (
                  <div className="text-caption-1 text-gray-500 truncate mt-0.5">{cardSubtitle}</div>
                )}
              </>
            );
          })() : (node.config?.instanceName) ? (
            <>
              <div className="text-body-2-strong text-gray-900 truncate leading-tight">{node.config.instanceName}</div>
              {isStepTypeVisuals && <div className="text-caption-1 text-gray-500 truncate mt-0.5">{node.config?.stepTypeLabel ?? node.label}</div>}
            </>
          ) : isUnnamedStep(node) ? (
            <div className="text-body-2-strong text-gray-900 truncate leading-tight">{node.label}</div>
          ) : (node.config?.stepTypeLabel || NEEDS_CONFIG_DIALOG(node.label)) ? (
            <>
              <div className="text-body-2-strong text-gray-900 truncate leading-tight">{node.config?.instanceName ?? node.label}</div>
              {isStepTypeVisuals && <div className="text-caption-1 text-gray-500 truncate mt-0.5">{node.config?.stepTypeLabel ?? node.label}</div>}
            </>
          ) : node.connector ? (
            <>
              <div className="text-body-2-strong text-gray-900 truncate leading-tight">{node.label}</div>
              {isStepTypeVisuals && <div className="text-caption-1 text-gray-500 truncate mt-0.5">{node.connector}</div>}
            </>
          ) : (
            <div className="text-body-2-strong text-gray-900 truncate">{node.label}</div>
          )}
        </div>
        {!node.placeholder && node.type !== 'trigger' && (
          <div className="relative flex-shrink-0">
            <CopilotButton
              variant="ghost"
              size="sm"
              className="w-9 h-9 p-0 flex-shrink-0 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              onClick={openNodeMenu}
            >
              <MoreHorizontal32Filled style={{ width: 28, height: 28 }} />
            </CopilotButton>
            {menuDropdown}
          </div>
        )}
      </div>
      {/* ── Branch pills inside the card (only when isStepTypeVisuals is OFF) ── */}
      {!isStepTypeVisuals && node.type === 'condition' && (() => {
        const { positive, negative } = getBranchLabels(node.branchType);
        const elseIfBranches: Array<{ id: string; label?: string }> = node.config?.elseIfBranches ?? [];
        const isHorizontalCanvas = canvasLayout === 'horizontal';
        const plusIcon = (
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        );
        const pills = [
          { key: 'true', label: positive, bg: '#f3f4f6', border: '1px solid #d1d5db', textClass: 'text-gray-600' },
          ...elseIfBranches.map((b) => ({ key: b.id, label: `Else ${positive}`, bg: '#f3f4f6', border: '1px solid #d1d5db', textClass: 'text-gray-600' })),
          { key: 'false', label: negative, bg: '#f3f4f6', border: '1px solid #d1d5db', textClass: 'text-gray-600' },
        ];

        if (!isHorizontalCanvas) {
          // Vertical orientation: pills in a horizontal row, dot at bottom-center of each pill
          // for the downward connector line coming out of the card.
          const elseIfCount = elseIfBranches.length;
          const branchCount = 2 + elseIfCount;
          const cardW = Math.max(352, 352 + (branchCount - 2) * 140);
          return (
            <div className="flex flex-row gap-2 mt-3 w-full" style={{ overflow: 'visible', width: cardW - 24 }}>
              {pills.map((pill, i) => (
                <div key={pill.key} data-branch-pill={i} style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center justify-between rounded-full px-3 py-1.5 w-full" style={{ background: pill.bg, border: pill.border }}>
                    <span className={`text-body-2-strong ${pill.textClass} truncate`}>{pill.label}</span>
                    <div className="rounded-full flex-shrink-0" style={{ width: DOT_SIZE, height: DOT_SIZE, background: DOT_FILL, border: `${CONNECTOR_WIDTH}px solid ${DOT_STROKE}` }} />
                  </div>
                </div>
              ))}
            </div>
          );
        }

        // Horizontal orientation: pills stacked vertically.
        // In empty-branch state (hasConnector), the dot lives inside the pill-box and the
        // inline connector + add button extend to the right of the card.
        // In non-empty-branch state, the dot is omitted from the pill — the branch row's
        // HorizontalConnector renders the left dot right at the card edge instead.
        return (
          <div className="flex flex-col gap-1.5 mt-2 w-full" style={{ overflow: 'visible' }}>
            {pills.map((pill, i) => {
              const hasConnector = !!emptyBranchPills?.[i];
              return (
                <div
                  key={pill.key}
                  data-branch-pill={i}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    width: hasConnector ? 'calc(100% + 44px)' : '100%',
                    overflow: 'visible',
                  }}
                >
                  <div
                    className="flex items-center rounded-full px-4 py-1.5"
                    style={{ flex: 1, background: pill.bg, border: pill.border, minWidth: 0 }}
                  >
                    <span className={`text-body-2-strong ${pill.textClass}`}>{pill.label}</span>
                    {/* Dot always inside pill on the right side — start-style (gray fill, white stroke) since it's the line origin */}
                    <div className="rounded-full flex-shrink-0 ml-auto" style={{ width: DOT_SIZE, height: DOT_SIZE, background: DOT_FILL, border: `${CONNECTOR_WIDTH}px solid ${DOT_STROKE}` }} />
                  </div>
                  {hasConnector && (
                    <div
                      style={{ display: 'flex', alignItems: 'center', flexShrink: 0, width: 44 }}
                      onMouseDown={e => e.stopPropagation()}
                    >
                      <div style={{ width: 24, height: CONNECTOR_WIDTH, background: CONNECTOR_COLOR, flexShrink: 0 }} />
                      <CopilotButton
                        variant="ghost"
                        size="sm"
                        onClick={e => { e.stopPropagation(); const p = emptyBranchPills![i]; ctx.openAddStep(p.insertIdx, p.branch, p.parentConditionId, p.subbranch); }}
                        icon={plusIcon}
                        className="rounded-full border-2 bg-white transition-all hover:scale-110"
                        style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))', width: 20, height: 20, padding: 0, minWidth: 0 }}
                        title="Add step"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
};

/** Invisible same-size placeholder for displaced (dragged) nodes */
export const WorkflowFlowSlot: React.FC<WorkflowNodeCardProps> = ({ node, ctx, emptyBranchPills }) => {
  const isHoriz = ctx.isStepTypeVisuals && ctx.canvasLayout === 'horizontal';
  const isCF = ctx.isStepTypeVisuals && (node.type === 'condition' || ['Function', 'Variable', 'Loop'].includes(node.label));
  const isTrigger = node.type === 'trigger';
  const cardWidth = isHoriz
    ? (isTrigger ? 140 : isCF ? 120 : 160)
    : (ctx.isStepTypeVisuals && isTrigger ? 210 : isCF ? 280 : ctx.isStepTypeVisuals ? 380 : 352);
  const cardHeight = isHoriz ? (isCF ? 80 : 100) : (isCF ? 48 : 68);
  if (ctx.nodePositions[node.id]) {
    // Use the actual measured card height when available so the placeholder doesn't
    // cause surrounding nodes to reflow when a card (especially a tall condition card) is dragged.
    const measuredH = ctx.nodeCardRefs.current.get(node.id)?.offsetHeight;
    const placeholderH = measuredH ?? cardHeight;
    return <div style={{ width: cardWidth, height: placeholderH, flexShrink: 0, pointerEvents: 'none' }} />;
  }
  return <WorkflowNodeCard node={node} ctx={ctx} emptyBranchPills={emptyBranchPills} />;
};
