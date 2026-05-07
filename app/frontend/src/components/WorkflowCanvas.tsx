// ─── Workflow Canvas (Orchestrator) ────────────────────────────────────────
// Slim orchestrator that composes sub-modules extracted from the original
// monolithic WorkflowCanvas.tsx. Pure refactor — no behavior changes.

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { WorkflowNode, HitlContact, getBranchLabels } from '../types';
import { CopilotInput } from './ui/CopilotInput';
import { SquircleIcon } from './ui/SquircleIcon';
import { getAgentIcon, getUniqueGradientCSS, getGradientByKey } from '../utils/agentIcons';
import { IconPickerDialog } from './ui/IconPickerDialog';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from './ui/Dialog';
import { CopilotDropdown } from './ui/CopilotDropdown';
import { CopilotTextarea } from './ui/CopilotTextarea';
import { CopilotButton } from './ui/CopilotButton';
import { CopilotTable } from './ui';
import { CopilotMenu, CopilotMenuPosition } from './ui/CopilotMenu';
import { CopilotTooltip } from './ui/CopilotTooltip';
import { WorkflowInstructionsEditor } from './workflow/WorkflowInstructionsEditor';
import { McpExpandedModal, InstructionEditorHandle, NodeOutput } from './workflow/McpExpandedModal';
import {
  Flash20Regular,
  Flash20Filled,
  MathFormula20Regular,
  MathFormula20Filled,
  Flash24Filled,
  Flash24Regular,
  Agents24Filled,
  ArrowSplit24Filled,
  Tag24Filled,
  Shield24Filled,
  DocumentTextExtract24Filled,
  Apps24Filled,
  Code24Filled,
  BracesVariable24Filled,
  ArrowSwap24Filled,
  ArrowRepeatAll24Filled,
  ArrowClockwise24Filled,
  LayerDiagonal24Filled,
  RecordStop24Filled,
  Timer24Filled,
  CalendarClock24Filled,
  Note24Filled,
  DocumentText20Regular,
  Database20Regular,
  MoreHorizontal24Regular,
  MoreHorizontal32Filled,
  Info20Regular,
  Delete20Regular,
  Edit20Regular,
  Copy20Regular,
  Dismiss20Regular,
  ZoomIn20Regular,
  ZoomOut20Regular,
  ArrowFit20Regular,
  Organization20Regular,
  Eraser20Regular,
  PanelLeft20Regular,
  Sparkle20Regular,
  Open20Regular,
  Filter16Regular,
  Add20Regular,
  Person20Regular,
  Mail20Regular,
  Checkmark20Regular,
  ArrowMaximize20Regular,
} from '@fluentui/react-icons';
import { Skeleton, SkeletonItem } from '@fluentui/react-components';
import type { DANode } from './ui/DAActivityCoT';

// Extracted sub-modules
import { useWorkflowCanvas } from './workflow/useWorkflowCanvas';
import { useAgent } from '../context/AgentContext';
import {
  TeamsIcon,
  CONTROL_FLOW_COLOR,
  HITL_COLORS,
  BG_STYLE,
  MOCK_DIRECTORY,
  getHitlInitials,
  StepType,
  STEP_TYPES,
  ALL_STEPS,
  STEPS_WITH_EXISTING,
  CONNECTORS,
  CONNECTOR_ACTIONS,
  V1_TRIGGER_TYPES,
  V1TriggerTypeId,
  MOCK_MCPS,
  MCP_PRODUCTS,
  MOCK_CUAS,
  MOCK_AGENTS,
  MOCK_PROMPTS,
  MOCK_CLASSIFIERS,
  MOCK_GUARDRAILS,
  MOCK_EXTRACTORS,
  MOCK_M365_COPILOTS,
  M365_COPILOT_SVG_PATH,
  getV2Suggestions,
  isMicrosoftConnector,
  MS_GROUPS,
  connInMsGroup,
  getMsGroupConnectors,
  shortenForGroup,
  MS_GROUP_ICONS,
  getConnectorIconSrc,
  connectorColor,
  V2PreviewAction,
  getV2PreviewContent,
  PREVIEW_DESCRIPTIONS,
  V2_CONNECTOR_ACTIONS,
  V2_ACTION_SUBTEXTS,
  V2_CONNECTOR_DISPLAY_MERGE,
  V2_MERGED_CONNECTOR_NAMES,
  V1_CONNECTOR_TRIGGER_EVENTS,
  V2_STEP_CAT,
  V2_BUILTIN_TOOLS,
  PROMPT_MODEL_OPTIONS,
  NEEDS_CONFIG_DIALOG,
  POWER_FX_FUNCTIONS,
  InstrSegment,
  AUTO_DESC_PLACEHOLDER,
  DEFAULT_NODES,
  canvasControlBtnClass,
  HUMAN_REVIEW_OPTIONS,
  CONNECTOR_COLOR,
  CONNECTOR_WIDTH,
  DOT_FILL,
  DOT_STROKE,
  DOT_FILL_END,
  DOT_STROKE_END,
  DOT_SIZE,
} from './workflow/workflowConstants';
import { WorkflowNodeCard, WorkflowFlowSlot } from './workflow/WorkflowNodeCard';
import type { EmptyBranchPill } from './workflow/WorkflowNodeCard';
import { WorkflowNoteCard } from './workflow/WorkflowNoteCard';
import { WorkflowNodeDetails, ElseIfBranch, panelChevronLeft, panelChevronRight } from './workflow/WorkflowNodeDetails';
import { useWorkflowHitlHelpers } from './workflow/WorkflowHitlPanel';
import McpTestResults from './workflow/McpTestResults';
import { WorkflowOverviewPanel } from './workflow/WorkflowOverviewPanel';
import { useWorkflowPalettes } from './workflow/WorkflowPalette';
import { V1CanvasControls, V2CanvasControls, V3CanvasControls } from './workflow/WorkflowCanvasControls';

// ─── Shared connector segment primitives ─────────────────────────────────────
// These are the single source of truth for how connector lines and dots render.
// All isLast and between-nodes connectors (vertical + horizontal) use these.

/** Vertical connector: 32px tall line with dots overlapping the cards above and below. */
const VerticalConnector = ({ topDot = true, bottomDot = true }: { topDot?: boolean; bottomDot?: boolean }) => (
  <div className="relative w-full flex justify-center flex-shrink-0" style={{ height: 32 }}>
    <div className="absolute inset-y-0" style={{ width: CONNECTOR_WIDTH, backgroundColor: CONNECTOR_COLOR, left: `calc(50% - ${CONNECTOR_WIDTH / 2}px)` }} />
    {topDot && <div className="absolute rounded-full" style={{ width: DOT_SIZE, height: DOT_SIZE, top: -DOT_SIZE / 2, left: `calc(50% - ${DOT_SIZE / 2}px)`, background: DOT_FILL, border: `${CONNECTOR_WIDTH}px solid ${DOT_STROKE}` }} />}
    {bottomDot && <div className="absolute rounded-full" style={{ width: DOT_SIZE, height: DOT_SIZE, bottom: -DOT_SIZE / 2, left: `calc(50% - ${DOT_SIZE / 2}px)`, background: DOT_FILL_END, border: `${CONNECTOR_WIDTH}px solid ${DOT_STROKE_END}` }} />}
  </div>
);

/** Horizontal connector: 28px wide line with dots overlapping the cards to left and right. */
const HorizontalConnector = ({ leftDot = true, rightDot = true }: { leftDot?: boolean; rightDot?: boolean }) => (
  <div className="relative flex-shrink-0 flex items-center" style={{ width: 28, height: '100%' }}>
    <div className="absolute inset-x-0" style={{ height: CONNECTOR_WIDTH, top: '50%', transform: 'translateY(-50%)', backgroundColor: CONNECTOR_COLOR }} />
    {leftDot && <div className="absolute rounded-full" style={{ width: DOT_SIZE, height: DOT_SIZE, left: -DOT_SIZE / 2, top: '50%', transform: 'translateY(-50%)', background: DOT_FILL, border: `${CONNECTOR_WIDTH}px solid ${DOT_STROKE}` }} />}
    {rightDot && <div className="absolute rounded-full" style={{ width: DOT_SIZE, height: DOT_SIZE, right: -DOT_SIZE / 2, top: '50%', transform: 'translateY(-50%)', background: DOT_FILL_END, border: `${CONNECTOR_WIDTH}px solid ${DOT_STROKE_END}` }} />}
  </div>
);

// ─── FLIP wrapper for detached nodes ─────────────────────────────────────────
// Mounts at the target (final) position, then instantly offsets back to the
// node's pre-detach screen position, then transitions to the final position.
interface DetachedNodeWrapperProps {
  x: number;
  y: number;
  initRect?: DOMRect;
  zoom: number;
  children: React.ReactNode;
}
const DetachedNodeWrapper: React.FC<DetachedNodeWrapperProps> = ({ x, y, initRect, zoom, children }) => {
  const innerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el || !initRect) return;
    const finalRect = el.getBoundingClientRect();
    // Delta in screen space → convert to canvas-local space by dividing by zoom
    const dx = (initRect.left - finalRect.left) / zoom;
    const dy = (initRect.top - finalRect.top) / zoom;
    // Jump to origin instantly (no transition)
    el.style.transition = 'none';
    el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    // Force reflow so the browser registers the jump before the next paint
    void el.offsetHeight;
    // Animate to final resting position with a spring-like ease
    el.style.transition = 'transform 0.45s cubic-bezier(0.34, 1.15, 0.64, 1)';
    el.style.transform = 'translate(-50%, -50%)';
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div data-no-pan style={{ position: 'absolute', left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)` }}>
      <div ref={innerRef} style={{ transform: 'translate(-50%, -50%)' }}>
        {children}
      </div>
    </div>
  );
};

export const WorkflowCanvas: React.FC = () => {
  const { setPendingHelperQuote } = useAgent();
  const ctx = useWorkflowCanvas();
  const {
    agentConfig, updateAgentConfig, updateWithHistory, isAgentGlobalUndo, updateWorkflowNodes,
    version, isGeneratingWorkflow, isStepTypeVisuals,
    selectedNode, setSelectedNode,
    insertAtIndex, setInsertAtIndex,
    nodeMenuOpen, setNodeMenuOpen,
    displayedNode, setDisplayedNode,
    zoom, setZoom,
    workflowNodes,
    canvasLayout, setCanvasLayout,
    floatingNodes, setFloatingNodes,
    nodePositions, setNodePositions,
    draggingNodeId, setDraggingNodeId,
    draggedStep, setDraggedStep,
    dragOverIndex, setDragOverIndex,
    panX, setPanX, panY, setPanY,
    isPanning, setIsPanning,
    canvasTransformRef,
    isPanningRef, panStartRef,
    canvasContainerRef, canvasContentRef, rightPanelScrollRef,
    nodeCardRefs, trueBadgeRef, falseBadgeRef, containerHalfRef,
    nodeSvgPos, setNodeSvgPos,
    hoveredConnection, setHoveredConnection,
    displacedInsert, setDisplacedInsert,
    insertBranch, setInsertBranch,
    insertParentConditionId, insertSubbranch,
    connectingFromId, setConnectingFromId,
    connectingSide, setConnectingSide,
    connectTargetIdx, setConnectTargetIdx,
    connectLineEnd, setConnectLineEnd,
    handleZoomIn, handleZoomOut, handleFitToScreen, handleTidyUp,
    handleCanvasDrop, handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasStopPan,
    handleClear,
    startConnecting, stopConnecting,
    openAddStep, closeAddStep, addStep,
    renameNode, patchNode, detachNode, reattachNode, reattachDropIndex, deleteNode,
    isUnnamedStep, isStepConfigured, getNodeIcon,
    configDialog, setConfigDialog,
    confirmConfigDialog,
    branchDialog, setBranchDialog,
    applyBranchChoice,
    deleteBranchDialog, setDeleteBranchDialog,
    applyDeleteBranch,
    instructionsModalNodeId, setInstructionsModalNodeId,
    instructionsModalDraft, setInstructionsModalDraft,
    instructionsModalLiveText, setInstructionsModalLiveText,
    instructionsModalStepKind,
    openInstructionsModal, saveInstructionsModal,
    rightPanelTab, setRightPanelTab,
    stepHitlDrillIn, setStepHitlDrillIn,
    nodeConfigMode, setNodeConfigMode,
    v1TriggerType, setV1TriggerType,
    v1TriggerPickerOpen, setV1TriggerPickerOpen,
    v1RecurrenceRepeat, setV1RecurrenceRepeat,
    v1RecurrenceInterval, setV1RecurrenceInterval,
    v1RecurrenceEnd, setV1RecurrenceEnd,
    v1RecurrenceDays, setV1RecurrenceDays,
    v1RecurrenceTimes, setV1RecurrenceTimes,
    v1RecurrenceMonthlyMode, setV1RecurrenceMonthlyMode,
    v1RecurrenceMonthDay, setV1RecurrenceMonthDay,
    v1RecurrenceMonthOrdinal, setV1RecurrenceMonthOrdinal,
    v1RecurrenceMonthWeekday, setV1RecurrenceMonthWeekday,
    v1RecurrenceAdvanced, setV1RecurrenceAdvanced,
    v1SlidingFreq, setV1SlidingFreq,
    v1SlidingAdvanced, setV1SlidingAdvanced,
    v1SelectedConnector, setV1SelectedConnector,
    v1SelectedConnectorAction, setV1SelectedConnectorAction,
    v1ConnectorPickerOpen, setV1ConnectorPickerOpen,
    v1ConnectorPickerQuery, setV1ConnectorPickerQuery,
    v1ConnectorPickerCategory, setV1ConnectorPickerCategory,
    v1FavoriteConnectors, setV1FavoriteConnectors,
    v1MicrosoftGroup, setV1MicrosoftGroup,
    v1ConnectorDetail, setV1ConnectorDetail,
    v1PreviewAction, setV1PreviewAction,
    dropStep,
    dismissedHitlBanners, setDismissedHitlBanners,
    hitlWhoDetailOpen, setHitlWhoDetailOpen,
    stepHitlContactMenuId, setStepHitlContactMenuId,
    stepHitlContactMenuPos, setStepHitlContactMenuPos,
    stepHitlAddOpen, setStepHitlAddOpen,
    stepHitlAddPhase, setStepHitlAddPhase,
    stepHitlName, setStepHitlName,
    stepHitlEmail, setStepHitlEmail,
    stepHitlNotifyVia, setStepHitlNotifyVia,
    stepHitlEditingId, setStepHitlEditingId,
    stepHitlEditNotifyVia, setStepHitlEditNotifyVia,
    stepHitlEditEmail, setStepHitlEditEmail,
    stepHitlNoResponse, setStepHitlNoResponse,
    stepHitlEscalateContacts, setStepHitlEscalateContacts,
    stepHitlEscalateAddOpen, setStepHitlEscalateAddOpen,
    stepHitlEscalateAddPhase, setStepHitlEscalateAddPhase,
    stepHitlEscalateName, setStepHitlEscalateName,
    stepHitlEscalateEmail, setStepHitlEscalateEmail,
    stepHitlEscalateNotifyVia, setStepHitlEscalateNotifyVia,
    dismissedBailBanners,
    dismissBailBanner,
    hitlNoResponse,
    hitlEscalateContacts,
    hitlEscalateWarnVisible, setHitlEscalateWarnVisible,
    mcpSegments,
    mcpSampleInputs, setMcpSampleInputs,
    mcpTestState, setMcpTestState,
    mcpSampleCollapsed, setMcpSampleCollapsed,
    mcpInputsExpanded, setMcpInputsExpanded,
    mcpSimResults, setMcpSimResults,
    mcpSimTab, setMcpSimTab,
  } = ctx;

  const [mcpPanelExpanded, setMcpPanelExpanded] = useState(false);
  const openMcpModal = () => { setMcpPanelExpanded(true); };
  const closeMcpModal = () => { setMcpPanelExpanded(false); };
  const mcpInstructionEditorRef = useRef<InstructionEditorHandle>(null);

  // TODO: WorkflowNodeDetails has a parallel getNodeOutputs returning { name; description }[] without type.
  // Extract to a shared utility in workflowConstants.ts once the two shapes converge.
  const getNodeOutputs = (n: WorkflowNode): NodeOutput[] => {
    if (n.type === 'trigger') return [
      { name: 'Event data',  description: 'Full payload of the triggering event', type: 'object' },
      { name: 'Timestamp',   description: 'Date and time the event occurred', type: 'datetime' },
      { name: 'User',        description: 'Identity of the user who triggered the event', type: 'text' },
      { name: 'Source',      description: 'Origin system or channel of the event', type: 'text' },
    ];
    if (n.type === 'condition') return [
      { name: 'Result',       description: 'Boolean outcome of the condition', type: 'boolean' },
      { name: 'True branch',  description: 'Value passed when condition is true', type: 'text' },
      { name: 'False branch', description: 'Value passed when condition is false', type: 'text' },
    ];
    if (n.label === 'MCP') {
      const mcp = MOCK_MCPS.find(m => m.id === n.config?.instanceMode);
      return mcp ? mcp.tools.map(t => ({ name: t.id, description: t.description, type: 'object' as const })) : [{ name: 'Output', description: 'Result returned by the MCP tool', type: 'object' as const }];
    }
    if (n.type === 'ai-action') return [
      { name: 'Extracted data',   description: 'Structured output produced by the AI model', type: 'object' },
      { name: 'Confidence score', description: 'Model confidence in the extracted result', type: 'number' },
      { name: 'Raw text',         description: 'Unprocessed text from the source document', type: 'text' },
    ];
    if (n.type === 'agent') return [
      { name: 'Agent response', description: 'Final message or result returned by the agent', type: 'text' },
      { name: 'Actions taken',  description: 'List of actions the agent performed', type: 'list' },
      { name: 'Status',         description: 'Completion status of the agent run', type: 'text' },
    ];
    return [
      { name: 'Status',        description: 'HTTP status code or result code', type: 'number' },
      { name: 'Response body', description: 'Full response payload from the action', type: 'object' },
    ];
  };

  const getPreviousNodes = (currentNode: WorkflowNode): WorkflowNode[] => {
    const idx = workflowNodes.findIndex(n => n.id === currentNode.id);
    return idx > 0 ? workflowNodes.slice(0, idx) : [];
  };

  const handleNodeAsk = useCallback((node: DANode) => {
    const shortQuestion = (node.errorTitle || node.error) ? 'How do I fix this?' : 'What does this step do?';
    setPendingHelperQuote({ label: node.name, type: node.type, errorTitle: node.errorTitle, error: node.error, shortQuestion });
  }, [setPendingHelperQuote]);

  const hitlHelpers = useWorkflowHitlHelpers(ctx);
  const { renderStepHitl, advanceHitlToChannel, addHitlContact, removeHitlContact, cancelHitlAdd, startHitlEdit, saveHitlEdit, cancelHitlEdit, addStepHitlContact, removeStepHitlContact, saveStepHitlEdit } = hitlHelpers;
  const { v1FloatingLeftPanel, v1PaletteModal, v2PaletteModal } = useWorkflowPalettes(ctx);

  // V1: inline-editable panel title state
  const [isEditingPanelTitle, setIsEditingPanelTitle] = useState(false);
  const [panelTitleValue, setPanelTitleValue] = useState('');
  useEffect(() => { setIsEditingPanelTitle(false); }, [displayedNode?.id]);

  // Outer fork SVG: dynamic endpoint computation via DOM measurement so that
  // unequal-width branches (True wider due to nested conditions) connect correctly.
  const outerForkContainerRef = useRef<HTMLDivElement | null>(null);
  const outerTrueBadgeRef = useRef<HTMLElement | null>(null);
  const outerFalseBadgeRef = useRef<HTMLElement | null>(null);
  const cancelByEscapeRef = useRef(false);

  // Nested fork SVG: same dynamic measurement per conditionId
  const nestedForkContainerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const nestedTrueBadgeRefs = useRef<Map<string, HTMLElement>>(new Map());
  const nestedFalseBadgeRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [nestedForkPcts, setNestedForkPcts] = useState<Map<string, { t: number; f: number }>>(new Map());

  // ── Horizontal branch rows: measure actual row heights so SVG bezier endpoints
  // land at the visual centre of each row even when cards make rows taller than the
  // default.  Updated via ResizeObserver whenever the container or its children resize.
  const hBranchRowsRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [hBranchRowHeightsMap, setHBranchRowHeightsMap] = useState<Map<string, number[]>>(new Map());
  const branchNodesKey = workflowNodes.filter(n => n.branch).map(n => n.id).join(',');
  useEffect(() => {
    const observers: ResizeObserver[] = [];
    hBranchRowsRefs.current.forEach((container, condId) => {
      const measure = () => {
        const heights = Array.from(container.children).map(el => (el as HTMLElement).offsetHeight);
        setHBranchRowHeightsMap(prev => { const next = new Map(prev); next.set(condId, heights); return next; });
      };
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(container);
      observers.push(ro);
    });
    return () => observers.forEach(ro => ro.disconnect());
   
  }, [branchNodesKey, canvasLayout]);

  const commitEditRef = useRef<((value: string) => void) | null>(null);
  const outerElseIfBadgeRefs = useRef<(HTMLElement | null)[]>([]);
  const [outerForkPct, setOuterForkPct] = useState({ t: 25, f: 75, ei: [] as number[] });

  // Per-pill connecting SVG paths (used when !isStepTypeVisuals, vertical layout)
  const pillConnectContainerRef = useRef<HTMLDivElement | null>(null);
  const [pillConnectPaths, setPillConnectPaths] = useState<string[]>([]);
  const [pillConnectDots, setPillConnectDots] = useState<Array<{ x: number; y: number }>>([]);
  const [pillConnectEndDots, setPillConnectEndDots] = useState<Array<{ x: number; y: number }>>([]);
  // Per-path metadata for interactive hover (insertIdx, branch, bezier midpoint)
  const [pillConnectMeta, setPillConnectMeta] = useState<Array<{ insertIdx: number; branch: string; mx: number; my: number } | null>>([]);
  const [hoveredPillPath, setHoveredPillPath] = useState<number | null>(null);
  // First node ID per branch column — used to target card top edge for bezier endpoints
  const branchFirstNodeIdsRef = useRef<(string | null)[]>([]);
  // Per-pill Y/X origins for horizontal layout (SVG CSS-pixel coordinates relative to fork container)
  // Used to draw bezier curves from pill dots to branch rows, and to align endpoints in partially-empty rows.
  const [pillOriginYsMap, setPillOriginYsMap] = useState<Map<string, number[]>>(new Map());
  const [pillOriginXsMap, setPillOriginXsMap] = useState<Map<string, number[]>>(new Map());
  const hForkContainerRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useLayoutEffect(() => {
    const recomputeForkPct = () => {
      const container = outerForkContainerRef.current;
      const tb = outerTrueBadgeRef.current;
      const fb = outerFalseBadgeRef.current;
      if (!container || !tb || !fb) return;
      const cr = container.getBoundingClientRect();
      if (cr.width === 0) return;
      const tr = tb.getBoundingClientRect();
      const fr = fb.getBoundingClientRect();
      const t = ((tr.left + tr.width / 2 - cr.left) / cr.width) * 100;
      const f = ((fr.left + fr.width / 2 - cr.left) / cr.width) * 100;
      const ei = outerElseIfBadgeRefs.current
        .filter(Boolean)
        .map(el => ((el!.getBoundingClientRect().left + el!.getBoundingClientRect().width / 2 - cr.left) / cr.width) * 100);
      setOuterForkPct(prev => {
        const eiChanged = ei.length !== prev.ei.length || ei.some((v, i) => Math.abs(v - (prev.ei[i] ?? 0)) > 0.1);
        if (Math.abs(t - prev.t) > 0.1 || Math.abs(f - prev.f) > 0.1 || eiChanged) {
          return { t, f, ei };
        }
        return prev;
      });
    };

    // Run once on mount to initialize positions
    recomputeForkPct();

    const container = outerForkContainerRef.current;
    let resizeObserver: ResizeObserver | null = null;
    if (container && typeof window !== 'undefined' && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => { recomputeForkPct(); });
      resizeObserver.observe(container);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', recomputeForkPct);
    }

    return () => {
      if (resizeObserver && container) {
        resizeObserver.unobserve(container);
        resizeObserver.disconnect();
      } else if (typeof window !== 'undefined') {
        window.removeEventListener('resize', recomputeForkPct);
      }
    };
  }, []);

  // Nested fork SVG: measure badge positions the same way as outer fork
  const allConditionIds = workflowNodes.filter(n => n.type === 'condition').map(n => n.id).join(',');
  useLayoutEffect(() => {
    const recomputeAll = () => {
      const updates: Map<string, { t: number; f: number }> = new Map();
      nestedForkContainerRefs.current.forEach((container, condId) => {
        const tb = nestedTrueBadgeRefs.current.get(condId);
        const fb = nestedFalseBadgeRefs.current.get(condId);
        if (!container || !tb || !fb) return;
        const cr = container.getBoundingClientRect();
        if (cr.width === 0) return;
        const t = ((tb.getBoundingClientRect().left + tb.getBoundingClientRect().width / 2 - cr.left) / cr.width) * 100;
        const f = ((fb.getBoundingClientRect().left + fb.getBoundingClientRect().width / 2 - cr.left) / cr.width) * 100;
        updates.set(condId, { t, f });
      });
      if (updates.size > 0) {
        setNestedForkPcts(prev => {
          let changed = false;
          updates.forEach((val, key) => {
            const prev_ = prev.get(key);
            if (!prev_ || Math.abs(val.t - prev_.t) > 0.1 || Math.abs(val.f - prev_.f) > 0.1) changed = true;
          });
          if (!changed) return prev;
          const next = new Map(prev);
          updates.forEach((val, key) => next.set(key, val));
          return next;
        });
      }
    };
    recomputeAll();
    const observers: ResizeObserver[] = [];
    nestedForkContainerRefs.current.forEach(container => {
      if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
        const ro = new ResizeObserver(recomputeAll);
        ro.observe(container);
        observers.push(ro);
      }
    });
    return () => observers.forEach(ro => ro.disconnect());
   
  }, [allConditionIds]);

  // Wrapper functions that bridge old inline calls to extracted components
  const renderNodeCard = (node: WorkflowNode) => <WorkflowNodeCard node={node} ctx={ctx} />;
  const renderFlowSlot = (node: WorkflowNode) => {
    // Horizontal layout only: for nested condition nodes with all-empty branches, pass
    // emptyBranchPills so the card renders inline connectors + buttons to the right of each pill,
    // matching the top-level behavior. Vertical layout is handled by renderNestedBranchSection.
    if (isHorizontal && node.type === 'condition') {
      const nestedElseIf = node.config?.elseIfBranches ?? [];
      const nestedAllEmpty =
        workflowNodes.filter(n => n.branch === 'true' && n.parentConditionId === node.id).length === 0 &&
        workflowNodes.filter(n => n.branch === 'false' && n.parentConditionId === node.id).length === 0 &&
        nestedElseIf.every((b: any) => workflowNodes.filter((n: WorkflowNode) => n.branch === b.id && (!n.parentConditionId || n.parentConditionId === node.id)).length === 0);
      if (nestedAllEmpty) {
        const nodeIdx = workflowNodes.indexOf(node);
        const pills: EmptyBranchPill[] = [
          { branch: 'true', insertIdx: nodeIdx + 1 },
          ...nestedElseIf.map((b: any) => ({ branch: b.id, insertIdx: workflowNodes.length })),
          { branch: 'false', insertIdx: workflowNodes.length },
        ];
        return <WorkflowFlowSlot node={node} ctx={ctx} emptyBranchPills={pills} />;
      }
    }
    return <WorkflowFlowSlot node={node} ctx={ctx} />;
  };
  const renderNodeDetails = (node: WorkflowNode, onPillInputFocus?: (handle: import('./ui/PillInput').PillInputHandle) => void) =>
    <WorkflowNodeDetails node={node} ctx={ctx} renderStepHitl={renderStepHitl} onPillInputFocus={onPillInputFocus} />;
  const v2OverviewPanel = <WorkflowOverviewPanel ctx={ctx} hitlHelpers={{ advanceHitlToChannel, addHitlContact, removeHitlContact, cancelHitlAdd, startHitlEdit, saveHitlEdit, cancelHitlEdit }} />;
  const v1CanvasControls = <V1CanvasControls ctx={ctx} />;
  const v2CanvasControls = <V2CanvasControls ctx={ctx} />;
  const canvasControls = <V3CanvasControls ctx={ctx} />;
  // ─── Branch connector (between / after branch nodes) ─────────────────────
  // Renders an interactive connector inside a True or False branch column.
  // insertIdx  — workflowNodes index at which a new node would be spliced
  // branch     — 'true' | 'false' so the new node gets the right branch tag
  // isLast     — when true shows a persistent + below the final node
  // hideLine   — suppress the CSS line when the SVG overlay is handling it (displaced node)
  const renderBranchConnector = (insertIdx: number, branch: string, isLast = false, hideLine = false, hideTopDot = false, hideButton = false, preserveSpace = false) => {
    const isActive = insertAtIndex === insertIdx && insertBranch === branch;
    const plusIcon = (
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
        <path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );

    if (isActive) {
      return (
        <>
          <div className="w-0.5 h-3" style={{ backgroundColor: 'hsl(var(--primary))' }} />
          <div className="relative flex items-center justify-center rounded-2xl border-2 border-dashed w-full" style={{ height: 52, borderColor: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--primary) / 0.04)' }}>
            <span className="text-caption-1" style={{ color: 'hsl(var(--primary))' }}>Select a step from the panel →</span>
            <CopilotButton variant="ghost" size="sm" onClick={closeAddStep} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors p-0 min-w-0" style={{ color: 'hsl(var(--primary))' }} title="Cancel">
              <Dismiss20Regular style={{ width: 14, height: 14 }} />
            </CopilotButton>
          </div>
          {!isLast && <div className="w-0.5 h-3" style={{ backgroundColor: 'hsl(var(--primary))' }} />}
        </>
      );
    }

    if (isLast) {
      // When preserveSpace=true (adjacent node displaced): render an invisible ghost of the full
      // isLast element so the branch column keeps exactly the same height. The real floating
      // connector + dot + + button renders near the displaced card via nodeSvgPos below.
      if (hideLine && preserveSpace) {
        return (
          <div className="flex flex-col items-center" style={{ visibility: 'hidden', pointerEvents: 'none' }}>
            <VerticalConnector topDot={!hideTopDot} />
            <div style={{ width: 20, height: 20, marginTop: DOT_SIZE / 2 + 4 }} />
          </div>
        );
      }
      return (
        <div className="flex flex-col items-center">
          {!hideLine && <VerticalConnector topDot={!hideTopDot} />}
          <CopilotButton
            variant="ghost"
            size="sm"
            onClick={() => openAddStep(insertIdx, branch)}
            icon={plusIcon}
            className="rounded-full border-2 bg-white transition-all hover:scale-110"
            style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))', width: 20, height: 20, padding: 0, minWidth: 0, marginTop: hideLine ? 0 : DOT_SIZE / 2 + 4 }}
            title="Add step"
          />
        </div>
      );
    }

    return (
      <div className="group relative w-full" style={{ zIndex: 1 }}>
        {hideLine ? <div style={{ height: hideButton ? 0 : 32 }} /> : <VerticalConnector topDot={!hideTopDot} />}
        {!hideButton && (
          <CopilotButton
            variant="ghost"
            size="sm"
            onClick={() => openAddStep(insertIdx, branch)}
            icon={plusIcon}
            className="absolute inset-0 m-auto rounded-full border-2 bg-white transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
            style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))', width: 20, height: 20, padding: 0, minWidth: 0 }}
            title="Add step"
          />
        )}
      </div>
    );
  };

  // ─── Nested sub-branch helpers ────────────────────────────────────────────
  const getSubbranchNodes = (conditionId: string, sub: 'true' | 'false') =>
    workflowNodes.filter(n => n.parentConditionId === conditionId && n.subbranch === sub);

  const renderNestedBranchConnector = (parentConditionId: string, sub: 'true' | 'false', insertIdx: number, isLast = false, hideTopDot = false) => {
    const isActive = insertAtIndex === insertIdx && insertParentConditionId === parentConditionId && insertSubbranch === sub;
    const plusIcon = (
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
        <path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );
    if (isActive) {
      return (
        <>
          <div className="w-0.5 h-3" style={{ backgroundColor: 'hsl(var(--primary))' }} />
          <div className="relative flex items-center justify-center rounded-2xl border-2 border-dashed w-full" style={{ height: 48, borderColor: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--primary) / 0.04)' }}>
            <span className="text-caption-1" style={{ color: 'hsl(var(--primary))' }}>Select a step →</span>
            <CopilotButton variant="ghost" size="sm" onClick={closeAddStep} className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors p-0 min-w-0" style={{ color: 'hsl(var(--primary))' }} title="Cancel">
              <Dismiss20Regular style={{ width: 14, height: 14 }} />
            </CopilotButton>
          </div>
          {!isLast && <div className="w-0.5 h-3" style={{ backgroundColor: 'hsl(var(--primary))' }} />}
        </>
      );
    }
    if (isLast) {
      return (
        <div className="flex flex-col items-center">
          <VerticalConnector topDot={!hideTopDot} />
          <CopilotButton
            variant="ghost" size="sm"
            onClick={() => openAddStep(insertIdx, undefined, parentConditionId, sub)}
            icon={plusIcon}
            className="rounded-full border-2 bg-white transition-all hover:scale-110"
            style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))', width: 20, height: 20, padding: 0, minWidth: 0, marginTop: DOT_SIZE / 2 + 4 }}
            title="Add step"
          />
        </div>
      );
    }
    return (
      <div className="group relative w-full" style={{ zIndex: 1 }}>
        <VerticalConnector topDot={!hideTopDot} />
        <CopilotButton
          variant="ghost" size="sm"
          onClick={() => openAddStep(insertIdx, undefined, parentConditionId, sub)}
          icon={plusIcon}
          className="absolute inset-0 m-auto rounded-full border-2 bg-white transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
          style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))', width: 20, height: 20, padding: 0, minWidth: 0 }}
          title="Add step"
        />
      </div>
    );
  };

  // Renders the True/False sub-branch split below a nested condition node
  const renderNestedBranchSection = (conditionId: string) => {
    const isDisplaced = !!nodePositions[conditionId];
    // When displaced: keep the element in the layout (preserves height so the canvas
    // doesn't reflow and shift other nodes) but make it invisible and non-interactive.
    // A floating copy positioned alongside the dragged card shows the actual content.

    const subTrueNodes = getSubbranchNodes(conditionId, 'true');
    const subFalseNodes = getSubbranchNodes(conditionId, 'false');

    const conditionIdx = workflowNodes.findIndex(n => n.id === conditionId);
    const nestedCondNode = workflowNodes[conditionIdx];
    const { positive: nestedPositive, negative: nestedNegative } = getBranchLabels(nestedCondNode?.branchType);
    const insertIdxSubTrue = subTrueNodes.length > 0
      ? workflowNodes.indexOf(subTrueNodes[subTrueNodes.length - 1]) + 1
      : conditionIdx + 1;
    const insertIdxSubFalse = subFalseNodes.length > 0
      ? workflowNodes.indexOf(subFalseNodes[subFalseNodes.length - 1]) + 1
      : conditionIdx + 1;


    // NODE CARDS are fixed width=300px (or 380px when isStepTypeVisuals). Both the
    // fork SVG and sub-column container use the same fixed width so path endpoints
    // always land on sub-column centers.
    const CARD_W = isStepTypeVisuals ? 380 : 300;
    const SUB_GAP = 32; // gap between sub-columns
    const nestedW = CARD_W * 2 + SUB_GAP; // 720
    const subColStyle: React.CSSProperties = { width: CARD_W };
    const subColClass = 'flex flex-col items-center';

    // Use dynamically measured badge positions (same as outer fork). Fall back to
    // math-based values on first render before the layout effect runs.
    const measuredPcts = nestedForkPcts.get(conditionId);
    const truePctNum = measuredPcts?.t ?? (CARD_W / 2 / nestedW * 100);
    const falsePctNum = measuredPcts?.f ?? ((CARD_W + SUB_GAP + CARD_W / 2) / nestedW * 100);

    const nestedForkPath = (pct: number) => {
      if (Math.abs(pct - 50) < 0.5) return `M 50 30 L ${pct.toFixed(2)} 56`;
      if (pct < 50) return `M 50 30 L ${(pct + 1.7).toFixed(2)} 30 A 1.7 12 0 0 0 ${pct.toFixed(2)} 42 L ${pct.toFixed(2)} 56`;
      return `M 50 30 L ${(pct - 1.7).toFixed(2)} 30 A 1.7 12 0 0 1 ${pct.toFixed(2)} 42 L ${pct.toFixed(2)} 56`;
    };

    return (
      <div className="flex flex-col items-center" style={isDisplaced ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}>
        {/* Fixed-width container: fork SVG and sub-columns share the same width */}
        <div
          ref={isDisplaced ? undefined : el => { if (el) nestedForkContainerRefs.current.set(conditionId, el); else nestedForkContainerRefs.current.delete(conditionId); }}
          style={{ width: nestedW }}
        >
          {isStepTypeVisuals && (
            <div className="relative w-full" style={{ height: 56 }}>
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 56" preserveAspectRatio="none">
                {/* Vertical stem */}
                <line x1="50" y1="0" x2="50" y2="30" stroke={CONNECTOR_COLOR} strokeWidth={CONNECTOR_WIDTH} vectorEffect="non-scaling-stroke" />
                {/* True branch: dynamic percentage measured from actual badge position */}
                <path d={nestedForkPath(truePctNum)} stroke={CONNECTOR_COLOR} strokeWidth={CONNECTOR_WIDTH} fill="none" vectorEffect="non-scaling-stroke" />
                {/* False branch: dynamic percentage measured from actual badge position */}
                <path d={nestedForkPath(falsePctNum)} stroke={CONNECTOR_COLOR} strokeWidth={CONNECTOR_WIDTH} fill="none" vectorEffect="non-scaling-stroke" />
              </svg>
              {/* CSS dot — not in SVG to avoid distortion from preserveAspectRatio="none" */}
              <div className="absolute rounded-full" style={{ width: DOT_SIZE, height: DOT_SIZE, top: -DOT_SIZE / 2, left: `calc(50% - ${DOT_SIZE / 2}px)`, background: DOT_FILL, border: `${CONNECTOR_WIDTH}px solid ${DOT_STROKE}` }} />
            </div>
          )}
          {!isStepTypeVisuals && <div style={{ height: 48 }} />}
          <div style={{ display: 'flex', gap: SUB_GAP }}>
            {/* Sub-True */}
            <div className={subColClass} style={subColStyle}>
              {isStepTypeVisuals && (
                <span
                  ref={isDisplaced ? undefined : el => { if (el) nestedTrueBadgeRefs.current.set(conditionId, el); else nestedTrueBadgeRefs.current.delete(conditionId); }}
                  className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-caption-1-strong rounded-full border border-gray-300"
                >{nestedPositive}</span>
              )}
              {!isStepTypeVisuals && <span ref={isDisplaced ? undefined : el => { if (el) nestedTrueBadgeRefs.current.set(conditionId, el); else nestedTrueBadgeRefs.current.delete(conditionId); }} />}
              {subTrueNodes.length === 0
                ? renderNestedBranchConnector(conditionId, 'true', insertIdxSubTrue, true)
                : renderNestedBranchConnector(conditionId, 'true', workflowNodes.indexOf(subTrueNodes[0]), false, true)
              }
              {subTrueNodes.map((node, i) => (
                <React.Fragment key={node.id}>
                  {i > 0 && renderNestedBranchConnector(conditionId, 'true', workflowNodes.indexOf(node), false)}
                  {renderFlowSlot(node)}
                  {node.type === 'condition' && renderNestedBranchSection(node.id)}
                </React.Fragment>
              ))}
              {subTrueNodes.length > 0 && renderNestedBranchConnector(conditionId, 'true', insertIdxSubTrue, true)}
            </div>
            {/* Sub-False */}
            <div className={subColClass} style={subColStyle}>
              {isStepTypeVisuals && (
                <span
                  ref={isDisplaced ? undefined : el => { if (el) nestedFalseBadgeRefs.current.set(conditionId, el); else nestedFalseBadgeRefs.current.delete(conditionId); }}
                  className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-caption-1-strong rounded-full border border-gray-300"
                >{nestedNegative}</span>
              )}
              {!isStepTypeVisuals && <span ref={isDisplaced ? undefined : el => { if (el) nestedFalseBadgeRefs.current.set(conditionId, el); else nestedFalseBadgeRefs.current.delete(conditionId); }} />}
              {subFalseNodes.length === 0
                ? renderNestedBranchConnector(conditionId, 'false', insertIdxSubFalse, true)
                : renderNestedBranchConnector(conditionId, 'false', workflowNodes.indexOf(subFalseNodes[0]), false, true)
              }
              {subFalseNodes.map((node, i) => (
                <React.Fragment key={node.id}>
                  {i > 0 && renderNestedBranchConnector(conditionId, 'false', workflowNodes.indexOf(node), false)}
                  {renderFlowSlot(node)}
                  {node.type === 'condition' && renderNestedBranchSection(node.id)}
                </React.Fragment>
              ))}
              {subFalseNodes.length > 0 && renderNestedBranchConnector(conditionId, 'false', insertIdxSubFalse, true)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Outer branch columns (fork SVG + True / Else If / False columns) ───────
  // Shared between the inline (hidden-when-displaced) layout and the displaced
  // floating layout. Pass `isDisplaced = true` to omit ref attachments that only
  // the inline version needs for outerForkPct measurement.
  const renderBranchColumns = (isDisplaced: boolean, overrideCondNode?: typeof conditionNode) => {
    const activeCondNode = overrideCondNode ?? conditionNode;
    if (!activeCondNode) return null;
    const activeTrueNodes = overrideCondNode
      ? workflowNodes.filter(n => n.branch === 'true' && (!n.parentConditionId || n.parentConditionId === overrideCondNode.id))
      : trueNodes;
    const activeFalseNodes = overrideCondNode
      ? workflowNodes.filter(n => n.branch === 'false' && (!n.parentConditionId || n.parentConditionId === overrideCondNode.id))
      : falseNodes;
    const elseIfBranches = activeCondNode.config?.elseIfBranches ?? [];
    const elseIfCount = elseIfBranches.length;
    const colW = isStepTypeVisuals ? 380 : 352;
    const colGap = 32;
    const nestedColW = colW * 2 + colGap;
    const trueColW = activeTrueNodes.some(n => n.type === 'condition') ? nestedColW : colW;
    const falseColW = activeFalseNodes.some(n => n.type === 'condition') ? nestedColW : colW;
    const gridCols = [`${trueColW}px`, ...Array(elseIfCount).fill(`${colW}px`), `${falseColW}px`].join(' ');
    const { positive, negative } = getBranchLabels(activeCondNode.branchType);
    // Keep first-node IDs in sync so the bezier path calculation can target card tops
    if (!isStepTypeVisuals) {
      const eiFirstIds = elseIfBranches.map((b: any) => {
        const nodes = workflowNodes.filter(n => n.branch === b.id && (!n.parentConditionId || n.parentConditionId === activeCondNode.id));
        return nodes.length > 0 ? nodes[0].id : null;
      });
      branchFirstNodeIdsRef.current = [
        activeTrueNodes.length > 0 ? activeTrueNodes[0].id : null,
        ...eiFirstIds,
        activeFalseNodes.length > 0 ? activeFalseNodes[0].id : null,
      ];
    }
    const forkPath = (pct: number) => {
      if (Math.abs(pct - 50) < 0.5) return `M 50 30 L ${pct.toFixed(2)} 56`;
      if (pct < 50) return `M 50 30 L ${(pct + 1.7).toFixed(2)} 30 A 1.7 12 0 0 0 ${pct.toFixed(2)} 42 L ${pct.toFixed(2)} 56`;
      return `M 50 30 L ${(pct - 1.7).toFixed(2)} 30 A 1.7 12 0 0 1 ${pct.toFixed(2)} 42 L ${pct.toFixed(2)} 56`;
    };
    return (
      <>
        {/* Fork SVG only needed when isStepTypeVisuals is ON — when OFF, branch labels live inside the card */}
        {isStepTypeVisuals && !overrideCondNode && (
          <div
            ref={isDisplaced ? undefined : outerForkContainerRef}
            className="relative w-full"
            style={{ height: 56 }}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 56" preserveAspectRatio="none">
              <line x1="50" y1="0" x2="50" y2="30" stroke={CONNECTOR_COLOR} strokeWidth={CONNECTOR_WIDTH} vectorEffect="non-scaling-stroke" />
              <path d={forkPath(outerForkPct.t)} stroke={CONNECTOR_COLOR} strokeWidth={CONNECTOR_WIDTH} fill="none" vectorEffect="non-scaling-stroke" />
              {outerForkPct.ei.map((pct, i) => (
                <path key={i} d={forkPath(pct)} stroke={CONNECTOR_COLOR} strokeWidth={CONNECTOR_WIDTH} fill="none" vectorEffect="non-scaling-stroke" />
              ))}
              <path d={forkPath(outerForkPct.f)} stroke={CONNECTOR_COLOR} strokeWidth={CONNECTOR_WIDTH} fill="none" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="absolute rounded-full" style={{ width: DOT_SIZE, height: DOT_SIZE, top: -DOT_SIZE / 2, left: `calc(50% - ${DOT_SIZE / 2}px)`, background: DOT_FILL, border: `${CONNECTOR_WIDTH}px solid ${DOT_STROKE}` }} />
          </div>
        )}
        {!isStepTypeVisuals && (
          /* Spacer that gives the connecting SVG room to curve from pills to column tops */
          <div style={{ height: 48 }} />
        )}
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: colGap }}>
          {/* ── True branch ── */}
          <div className="flex flex-col items-center">
            {isStepTypeVisuals && <span
              ref={isDisplaced ? undefined : (el => { trueBadgeRef.current = el; outerTrueBadgeRef.current = el; })}
              className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-caption-1-strong rounded-full border border-gray-300"
            >{positive}</span>}
            {!isStepTypeVisuals && <span ref={isDisplaced ? undefined : (el => { trueBadgeRef.current = el; outerTrueBadgeRef.current = el; })} />}
            {activeTrueNodes.length === 0
              ? renderBranchConnector(workflowNodes.indexOf(activeCondNode) + 1, 'true', true, !isStepTypeVisuals, !isStepTypeVisuals)
              // !isStepTypeVisuals + condition first node: skip the before-connector — the nested card's own pills handle insertion
              : (!isStepTypeVisuals && activeTrueNodes[0].type === 'condition') ? null
              : renderBranchConnector(workflowNodes.indexOf(activeTrueNodes[0]), 'true', false, !isStepTypeVisuals || !!nodePositions[activeTrueNodes[0].id], !isStepTypeVisuals, !isStepTypeVisuals)
            }
            {activeTrueNodes.map((node, i) => (
              <React.Fragment key={node.id}>
                {i > 0 && renderBranchConnector(workflowNodes.indexOf(node), 'true', false, !!nodePositions[activeTrueNodes[i - 1].id] || !!nodePositions[node.id])}
                {renderFlowSlot(node)}
                {node.type === 'condition' && renderNestedBranchSection(node.id)}
              </React.Fragment>
            ))}
            {activeTrueNodes.length > 0 && activeTrueNodes[activeTrueNodes.length - 1].type !== 'condition' && renderBranchConnector(workflowNodes.indexOf(activeTrueNodes[activeTrueNodes.length - 1]) + 1, 'true', true, !!nodePositions[activeTrueNodes[activeTrueNodes.length - 1].id], false, false, !!nodePositions[activeTrueNodes[activeTrueNodes.length - 1].id])}
          </div>
          {/* ── Else If branches ── */}
          {elseIfBranches.map((branch: ElseIfBranch, bi: number) => {
            const eiNodes = workflowNodes.filter(n => n.branch === branch.id && (!n.parentConditionId || n.parentConditionId === activeCondNode.id));
            return (
              <div key={branch.id} className="flex flex-col items-center">
                {isStepTypeVisuals && <span
                  ref={isDisplaced ? undefined : (el => { outerElseIfBadgeRefs.current[bi] = el; })}
                  className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-caption-1-strong rounded-full border border-gray-300"
                >Else {positive}</span>}
                {!isStepTypeVisuals && <span ref={isDisplaced ? undefined : (el => { outerElseIfBadgeRefs.current[bi] = el; })} />}
                {eiNodes.length === 0
                  ? renderBranchConnector(workflowNodes.length, branch.id, true, !isStepTypeVisuals, !isStepTypeVisuals)
                  : (!isStepTypeVisuals && eiNodes[0].type === 'condition') ? null
                  : renderBranchConnector(workflowNodes.indexOf(eiNodes[0]), branch.id, false, !isStepTypeVisuals || !!nodePositions[eiNodes[0].id], !isStepTypeVisuals, !isStepTypeVisuals)
                }
                {eiNodes.map((node, i) => (
                  <React.Fragment key={node.id}>
                    {i > 0 && renderBranchConnector(workflowNodes.indexOf(node), branch.id, false, !!nodePositions[eiNodes[i - 1].id] || !!nodePositions[node.id])}
                    {renderFlowSlot(node)}
                    {node.type === 'condition' && renderNestedBranchSection(node.id)}
                  </React.Fragment>
                ))}
                {eiNodes.length > 0 && eiNodes[eiNodes.length - 1].type !== 'condition' && renderBranchConnector(workflowNodes.indexOf(eiNodes[eiNodes.length - 1]) + 1, branch.id, true, !!nodePositions[eiNodes[eiNodes.length - 1].id], false, false, !!nodePositions[eiNodes[eiNodes.length - 1].id])}
              </div>
            );
          })}
          {/* ── False branch ── */}
          <div className="flex flex-col items-center" style={{ minWidth: colW }}>
            {isStepTypeVisuals && <span
              ref={isDisplaced ? undefined : (el => { falseBadgeRef.current = el; outerFalseBadgeRef.current = el; })}
              className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-caption-1-strong rounded-full border border-gray-300"
            >{negative}</span>}
            {!isStepTypeVisuals && <span ref={isDisplaced ? undefined : (el => { falseBadgeRef.current = el; outerFalseBadgeRef.current = el; })} />}
            {activeFalseNodes.length === 0
              ? renderBranchConnector(workflowNodes.length, 'false', true, !isStepTypeVisuals, !isStepTypeVisuals)
              : (!isStepTypeVisuals && activeFalseNodes[0].type === 'condition') ? null
              : renderBranchConnector(workflowNodes.indexOf(activeFalseNodes[0]), 'false', false, !isStepTypeVisuals || !!nodePositions[activeFalseNodes[0].id], !isStepTypeVisuals, !isStepTypeVisuals)
            }
            {activeFalseNodes.map((node, i) => (
              <React.Fragment key={node.id}>
                {i > 0 && renderBranchConnector(workflowNodes.indexOf(node), 'false', false, !!nodePositions[activeFalseNodes[i - 1].id] || !!nodePositions[node.id])}
                {renderFlowSlot(node)}
                {node.type === 'condition' && renderNestedBranchSection(node.id)}
              </React.Fragment>
            ))}
            {activeFalseNodes.length > 0 && activeFalseNodes[activeFalseNodes.length - 1].type !== 'condition' && renderBranchConnector(workflowNodes.indexOf(activeFalseNodes[activeFalseNodes.length - 1]) + 1, 'false', true, !!nodePositions[activeFalseNodes[activeFalseNodes.length - 1].id], false, false, !!nodePositions[activeFalseNodes[activeFalseNodes.length - 1].id])}
          </div>
        </div>
      </>
    );
  };

  // ─── Branch connector (horizontal orientation) ────────────────────────────
  const renderBranchConnectorH = (insertIdx: number, branch: string, isLast = false, hideLine = false, hideLeftDot = false, preserveSpace = false) => {
    const isActive = insertAtIndex === insertIdx && insertBranch === branch;
    const plusIcon = (
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
        <path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );

    if (isActive) {
      return (
        <>
          <div className="h-0.5 w-3 flex-shrink-0" style={{ backgroundColor: 'hsl(var(--primary))' }} />
          <div className="relative flex items-center justify-center rounded-2xl border-2 border-dashed flex-shrink-0" style={{ width: 68, height: 68, borderColor: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--primary) / 0.04)' }}>
            <span className="text-caption-1" style={{ color: 'hsl(var(--primary))', writingMode: 'vertical-rl' }}>Select a step →</span>
            <CopilotButton variant="ghost" size="sm" onClick={closeAddStep} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors p-0 min-w-0" style={{ color: 'hsl(var(--primary))' }} title="Cancel">
              <Dismiss20Regular style={{ width: 14, height: 14 }} />
            </CopilotButton>
          </div>
          {!isLast && <div className="h-0.5 w-3 flex-shrink-0" style={{ backgroundColor: 'hsl(var(--primary))' }} />}
        </>
      );
    }

    if (isLast) {
      // When preserveSpace=true (adjacent node displaced): invisible ghost preserves exact row width.
      // The real floating connector + button renders near the displaced card via nodeSvgPos.
      if (hideLine && preserveSpace) {
        return (
          <div className="flex flex-row items-center flex-shrink-0" style={{ visibility: 'hidden', pointerEvents: 'none' }}>
            <HorizontalConnector leftDot={!hideLeftDot} rightDot />
            <div style={{ width: 20, height: 20, marginLeft: 10 }} />
          </div>
        );
      }
      return (
        <div className="flex flex-row items-center flex-shrink-0">
          {!hideLine && <HorizontalConnector leftDot={!hideLeftDot} rightDot />}
          <CopilotButton
            variant="ghost"
            size="sm"
            onClick={() => openAddStep(insertIdx, branch)}
            icon={plusIcon}
            className="rounded-full border-2 bg-white transition-all hover:scale-110 flex-shrink-0"
            style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))', width: 20, height: 20, padding: 0, minWidth: 0, marginLeft: hideLine ? 0 : 10 }}
            title="Add step"
          />
        </div>
      );
    }

    return (
      <div className="group relative flex-shrink-0" style={{ zIndex: 1 }}>
        {hideLine ? <div style={{ width: 28, height: '100%', flexShrink: 0 }} /> : <HorizontalConnector leftDot={!hideLeftDot} />}
        <CopilotButton
          variant="ghost"
          size="sm"
          onClick={() => openAddStep(insertIdx, branch)}
          icon={plusIcon}
          className="absolute inset-0 m-auto rounded-full border-2 bg-white transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
          style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))', width: 20, height: 20, padding: 0, minWidth: 0 }}
          title="Add step"
        />
      </div>
    );
  };

  // ─── Connector with + button ──────────────────────────────────────────────
  const renderAddConnector = (insertIndex: number, isLast = false, hideLine = false) => {
    const isActive = insertAtIndex === insertIndex;
    const isNoteBeingDragged = draggedStep?.type === 'note';
    const isDragTarget = dragOverIndex === insertIndex && !isNoteBeingDragged;

    if (version === 1 || version === 2) {
      // ── V1 horizontal connector ─────────────────────────────────────────
      if (isHorizontal) {
        return (
          <div
            className="group flex flex-row items-center"
            onDragOver={e => { if (isNoteBeingDragged) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOverIndex(insertIndex); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverIndex(null); }}
            onDrop={e => { e.preventDefault(); e.stopPropagation(); if (draggedStep && !isNoteBeingDragged) dropStep(draggedStep, insertIndex); }}
          >
            {isDragTarget && !isActive ? (
              <>
                <div className="w-3 h-0.5" style={{ backgroundColor: 'hsl(var(--primary))' }} />
                <div className="flex items-center justify-center rounded-2xl border-2 border-dashed" style={{ width: 68, height: 68, borderColor: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--primary) / 0.06)' }}>
                  <span className="text-caption-1" style={{ color: 'hsl(var(--primary))', writingMode: 'vertical-rl' }}>Drop</span>
                </div>
                <div className="w-3 h-0.5" style={{ backgroundColor: 'hsl(var(--primary))' }} />
              </>
            ) : isActive ? (
              <>
                <div className="w-3 h-0.5" style={{ backgroundColor: 'hsl(var(--primary))' }} />
                <div className="flex items-center justify-center rounded-2xl border-2 border-dashed" style={{ width: 68, height: 68, borderColor: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--primary) / 0.04)' }}>
                  <span className="text-caption-1" style={{ color: 'hsl(var(--primary))', writingMode: 'vertical-rl' }}>+ Step</span>
                </div>
                {!isLast && <div className="w-3 h-0.5" style={{ backgroundColor: 'hsl(var(--primary))' }} />}
              </>
            ) : isLast ? (
              // Preserve space when adjacent node is displaced (floating + rendered near displaced card)
              hideLine ? (
                <div className="flex flex-row items-center" style={{ visibility: 'hidden', pointerEvents: 'none' }}>
                  <HorizontalConnector leftDot rightDot />
                  <div style={{ width: 20, height: 20, marginLeft: 10 }} />
                </div>
              ) : (
              <div className="flex flex-row items-center">
                <HorizontalConnector leftDot rightDot />
                <CopilotButton
                  variant="ghost"
                  size="sm"
                  onClick={() => openAddStep(insertIndex)}
                  icon={<svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                  className="rounded-full border-2 bg-white transition-all hover:scale-110 flex-shrink-0"
                  style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))', width: 20, height: 20, padding: 0, minWidth: 0, marginLeft: 10 }}
                  title="Add step"
                />
              </div>
              )
            ) : (
              <div className="group relative flex-shrink-0" style={{ zIndex: 1 }}>
                {hideLine ? <div style={{ width: 28, height: '100%', flexShrink: 0 }} /> : <HorizontalConnector />}
                <CopilotButton
                  variant="ghost"
                  size="sm"
                  onClick={() => openAddStep(insertIndex)}
                  icon={<svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                  className="absolute inset-0 m-auto rounded-full border-2 bg-white transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
                  style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))', width: 20, height: 20, padding: 0, minWidth: 0 }}
                  title="Add step"
                />
              </div>
            )}
          </div>
        );
      }

      // ── V1/V2 vertical connector ────────────────────────────────────────
      // In connecting mode: show a drop zone so user can connect a floating node here
      if (connectingFromId) {
        const isTarget = connectTargetIdx === insertIndex;
        return (
          <div
            style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '8px 0' }}
            onMouseEnter={() => setConnectTargetIdx(insertIndex)}
            onMouseLeave={() => setConnectTargetIdx(null)}
          >
            <div
              className="w-full flex items-center justify-center rounded-xl border-2 border-dashed transition-all"
              style={{
                height: 28,
                borderColor: isTarget ? 'hsl(var(--primary))' : CONNECTOR_COLOR,
                backgroundColor: isTarget ? 'hsl(var(--primary) / 0.08)' : 'transparent',
              }}
            >
              {isTarget && <span className="text-caption-1" style={{ color: 'hsl(var(--primary))' }}>Connect here</span>}
            </div>
          </div>
        );
      }

      return (
        <div
          className="group flex flex-col items-center w-full"
          onDragOver={e => { if (isNoteBeingDragged) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOverIndex(insertIndex); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverIndex(null); }}
          onDrop={e => { e.preventDefault(); e.stopPropagation(); if (draggedStep && !isNoteBeingDragged) dropStep(draggedStep, insertIndex); }}
        >
          {isDragTarget && !isActive ? (
            // Drag-over: show a highlighted drop zone with lines
            <>
              <div className="w-0.5 h-3" style={{ backgroundColor: 'hsl(var(--primary))' }} />
              <div className="flex items-center justify-center rounded-2xl border-2 border-dashed" style={{ width: 352, height: 52, borderColor: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--primary) / 0.06)' }}>
                <span className="text-caption-1" style={{ color: 'hsl(var(--primary))' }}>Drop here</span>
              </div>
              <div className="w-0.5 h-3" style={{ backgroundColor: 'hsl(var(--primary))' }} />
            </>
          ) : isActive ? (
            // Clicked +: if displaced connection, suppress here (placeholder shown at line midpoint)
            // Otherwise show placeholder inline in the flow
            hideLine ? null : (
              <>
                <div className="w-0.5 h-3" style={{ backgroundColor: 'hsl(var(--primary))' }} />
                <div className="relative flex items-center justify-center rounded-2xl border-2 border-dashed" style={{ width: 352, height: 64, borderColor: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--primary) / 0.04)' }}>
                  <span className="text-caption-1" style={{ color: 'hsl(var(--primary))' }}>Select a step from the panel →</span>
                  <CopilotButton variant="ghost" size="sm" onClick={closeAddStep} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors p-0 min-w-0" style={{ color: 'hsl(var(--primary))' }} title="Cancel">
                    <Dismiss20Regular style={{ width: 14, height: 14 }} />
                  </CopilotButton>
                </div>
                {!isLast && <div className="w-0.5 h-3" style={{ backgroundColor: 'hsl(var(--primary))' }} />}
              </>
            )
          ) : isLast ? (
            // Last connector: preserve space when adjacent node is displaced (floating + rendered near displaced card)
            hideLine ? <div style={{ height: 32, flexShrink: 0 }} /> : (
            <div className="flex flex-col items-center">
              <VerticalConnector />
              <CopilotButton
                variant="ghost"
                size="sm"
                onClick={() => openAddStep(insertIndex)}
                icon={<svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                className="rounded-full border-2 bg-white transition-all hover:scale-110"
                style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))', width: 20, height: 20, padding: 0, minWidth: 0, marginTop: DOT_SIZE / 2 + 4 }}
                title="Add step"
              />
            </div>
            )
          ) : hideLine ? <div style={{ height: 32, flexShrink: 0 }} /> : (
            // Between nodes: continuous line, + button overlaid on hover
            <div className="group relative w-full" style={{ zIndex: 1 }}>
              <VerticalConnector />
              <CopilotButton
                variant="ghost"
                size="sm"
                onClick={() => openAddStep(insertIndex)}
                icon={<svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                className="absolute inset-0 m-auto rounded-full border-2 bg-white transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
                style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))', width: 20, height: 20, padding: 0, minWidth: 0 }}
                title="Add step"
              />
            </div>
          )}
        </div>
      );
    }

    // V2 / V3 connector
    const isActiveV23 = insertAtIndex === insertIndex;
    return (
      <div className="flex flex-col items-center">
        <div className="w-px h-2.5 bg-gray-300" />
        <CopilotButton
          variant="ghost"
          size="sm"
          onClick={() => isActiveV23 ? closeAddStep() : openAddStep(insertIndex)}
          icon={<svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          className="rounded-full border-2 bg-white transition-all hover:scale-110"
          style={{
            borderColor: 'hsl(var(--primary))',
            color: 'hsl(var(--primary))',
            boxShadow: isActiveV23 ? '0 0 0 3px hsl(var(--primary) / 0.12)' : 'none',
            width: 20, height: 20, padding: 0, minWidth: 0,
          }}
          title="Add step"
        />
        <div className="w-px h-2.5 bg-gray-300" />
      </div>
    );
  };


  const conditionIndex = workflowNodes.findIndex(n => n.type === 'condition' && !n.parentConditionId);
  const preConditionNodes = conditionIndex >= 0 ? workflowNodes.slice(0, conditionIndex) : workflowNodes;
  const conditionNode = conditionIndex >= 0 ? workflowNodes[conditionIndex] : null;

  const trueNodes = workflowNodes.filter(n => n.branch === 'true' && (!n.parentConditionId || n.parentConditionId === conditionNode?.id));
  const falseNodes = workflowNodes.filter(n => n.branch === 'false' && (!n.parentConditionId || n.parentConditionId === conditionNode?.id));

  // emptyBranchPills: passed to the condition card (static or displaced) so pill connector lines + add buttons render.
  // Only set when !isStepTypeVisuals and ALL branches are empty — otherwise the fork+rows section handles add actions.
  const cbElseIfBranchesTop = conditionNode?.config?.elseIfBranches ?? [];
  const cbAllEmptyTop = !isStepTypeVisuals && !!conditionNode && trueNodes.length === 0 && falseNodes.length === 0 &&
    cbElseIfBranchesTop.every((b: any) => workflowNodes.filter((n: WorkflowNode) => n.branch === b.id && (!n.parentConditionId || n.parentConditionId === conditionNode?.id)).length === 0);

  // Per-pill connecting SVG — must be after conditionNode declaration
   
  useLayoutEffect(() => {
    if (isStepTypeVisuals) return;
    const allConditionNodes = workflowNodes.filter(n => n.type === 'condition');
    if (allConditionNodes.length === 0) return;
    const recompute = () => {
      // Vertical layout: only measure the first (top-level) condition for pill connect paths
      if (canvasLayout !== 'horizontal') {
        if (!conditionNode) return;
        const cardEl = nodeCardRefs.current.get(conditionNode.id);
        if (!cardEl) return;
        const pills = Array.from(cardEl.querySelectorAll<HTMLElement>('[data-branch-pill]'))
          .sort((a, b) => Number(a.dataset.branchPill) - Number(b.dataset.branchPill));
        if (pills.length === 0) return;
        // When all branches are empty the card handles its own pill dots — skip SVG overlay to avoid duplicates
        if (cbAllEmptyTop) {
          setPillConnectPaths([]);
          setPillConnectDots([]);
          setPillConnectEndDots([]);
          setPillConnectMeta([]);
          return;
        }
        const container = pillConnectContainerRef.current;
        if (!container) return;
        const cr = container.getBoundingClientRect();
        if (cr.width === 0 || cr.height === 0) return;
        const crCssW = container.offsetWidth;
        const crCssH = container.offsetHeight;
        const colEls = [
          outerTrueBadgeRef.current,
          ...outerElseIfBadgeRefs.current.filter(Boolean),
          outerFalseBadgeRef.current,
        ].filter(Boolean) as HTMLElement[];
        if (pills.length !== colEls.length) return;
        const dotCenters: Array<{ x: number; y: number }> = [];
        const endDotCenters: Array<{ x: number; y: number }> = [];
        // Branch order: true, ...elseIfs, false — matches data-branch-pill index order
        const elseIfBranchIds = (conditionNode.config?.elseIfBranches ?? []).map((b: any) => b.id as string);
        const branchKeys = ['true', ...elseIfBranchIds, 'false'];
        const metaList: Array<{ insertIdx: number; branch: string; mx: number; my: number } | null> = [];
        const paths = pills.map((pill, i) => {
          const pillBox = pill.firstElementChild as HTMLElement | null;
          const dotEl = pillBox ? pillBox.lastElementChild as HTMLElement | null : null;
          const dotR = (dotEl ?? pill).getBoundingClientRect();
          const x1 = ((dotR.left + dotR.width / 2 - cr.left) / cr.width) * crCssW;
          const y1 = ((dotR.top + dotR.height / 2 - cr.top) / cr.height) * crCssH;
          dotCenters.push({ x: x1, y: y1 });
          // Prefer targeting the first card's top edge so the bezier lands directly on the card.
          // When the first branch node is displaced, nodeCardRefs still points to the floating card's
          // DOM element — getBoundingClientRect() returns its actual screen position, so the bezier
          // tracks the card as it's dragged. No need to skip; just measure the displaced card directly.
          const firstNodeId = branchFirstNodeIdsRef.current[i];
          const firstCardEl = firstNodeId ? nodeCardRefs.current.get(firstNodeId) : null;
          const targetEl = firstCardEl ?? colEls[i];
          const targetR = targetEl.getBoundingClientRect();
          const x2 = ((targetR.left + targetR.width / 2 - cr.left) / cr.width) * crCssW;
          const y2 = ((targetR.top - cr.top) / cr.height) * crCssH;
          // Card-top endpoint is an arrival dot — tracked separately for end-dot styling
          if (firstCardEl) endDotCenters.push({ x: x2, y: y2 });
          const dy = y2 - y1;
          // Only make the path interactive when it connects to an actual card (branch has nodes).
          // Empty branches already have their own isLast + button — no hover needed on the bezier.
          if (firstCardEl) {
            // Cubic bezier midpoint at t=0.5: B(0.5) = 0.125*P0 + 0.375*CP1 + 0.375*CP2 + 0.125*P3
            // CP1=(x1, y1+dy*0.5), CP2=(x2, y2-dy*0.5)
            const mx = 0.125 * x1 + 0.375 * x1 + 0.375 * x2 + 0.125 * x2;
            const my = 0.125 * y1 + 0.375 * (y1 + dy * 0.5) + 0.375 * (y2 - dy * 0.5) + 0.125 * y2;
            const branch = branchKeys[i] ?? 'true';
            const branchNodes = workflowNodes.filter(n => n.branch === branch && (!n.parentConditionId || n.parentConditionId === conditionNode.id));
            const insertIdx = branchNodes.length > 0
              ? workflowNodes.indexOf(branchNodes[0])
              : workflowNodes.indexOf(conditionNode) + 1;
            metaList.push({ insertIdx, branch, mx, my });
          } else {
            // No interactive meta for empty-branch paths
            metaList.push(null);
          }
          return `M ${x1} ${y1} C ${x1} ${y1 + dy * 0.5}, ${x2} ${y2 - dy * 0.5}, ${x2} ${y2}`;
        });
        setPillConnectPaths(paths.filter(Boolean) as string[]);
        setPillConnectDots(dotCenters);
        setPillConnectEndDots(endDotCenters);
        setPillConnectMeta(metaList);
      } else {
        // Horizontal: measure pill dot positions for ALL condition nodes
        for (const cNode of allConditionNodes) {
          const cardEl = nodeCardRefs.current.get(cNode.id);
          if (!cardEl) continue;
          const pills = Array.from(cardEl.querySelectorAll<HTMLElement>('[data-branch-pill]'))
            .sort((a, b) => Number(a.dataset.branchPill) - Number(b.dataset.branchPill));
          if (pills.length === 0) continue;
          const forkEl = hForkContainerRefs.current.get(cNode.id);
          if (!forkEl) continue;
          const forkR = forkEl.getBoundingClientRect();
          if (forkR.height === 0 || forkR.width === 0) continue;
          const forkCssH = forkEl.offsetHeight;
          const forkCssW = forkEl.offsetWidth;
          const ys = pills.map(pill => {
            // Dot is always inside the pill box (pill.firstElementChild.lastElementChild)
            const dotEl = (pill.firstElementChild as HTMLElement | null)?.lastElementChild as HTMLElement | null ?? pill;
            const r = dotEl.getBoundingClientRect();
            return ((r.top + r.height / 2 - forkR.top) / forkR.height) * forkCssH;
          });
          const xs = pills.map(pill => {
            const dotEl = (pill.firstElementChild as HTMLElement | null)?.lastElementChild as HTMLElement | null ?? pill;
            const r = dotEl.getBoundingClientRect();
            return ((r.right - forkR.left) / forkR.width) * forkCssW;
          });
          setPillOriginYsMap(prev => { const next = new Map(prev); next.set(cNode.id, ys); return next; });
          setPillOriginXsMap(prev => { const next = new Map(prev); next.set(cNode.id, xs); return next; });
        }
      }
    };
    recompute();
    // Observe all fork containers and condition cards
    const observers: ResizeObserver[] = [];
    if (canvasLayout !== 'horizontal' && pillConnectContainerRef.current) {
      const ro = new ResizeObserver(recompute);
      ro.observe(pillConnectContainerRef.current);
      observers.push(ro);
    }
    if (canvasLayout === 'horizontal') {
      hForkContainerRefs.current.forEach((el) => {
        const ro = new ResizeObserver(recompute);
        ro.observe(el);
        observers.push(ro);
      });
    }
    allConditionNodes.forEach(cNode => {
      const cardEl = nodeCardRefs.current.get(cNode.id);
      if (cardEl) {
        const ro = new ResizeObserver(recompute);
        ro.observe(cardEl);
        observers.push(ro);
      }
    });
    return () => observers.forEach(ro => ro.disconnect());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStepTypeVisuals, conditionNode?.id, branchNodesKey, canvasLayout, hBranchRowHeightsMap, cbAllEmptyTop, nodePositions]);

  const endInsertIndex = conditionIndex >= 0 ? conditionIndex : workflowNodes.length;

  const conditionEmptyBranchPills: EmptyBranchPill[] | null = (cbAllEmptyTop && conditionNode) ? [
    { branch: 'true', insertIdx: workflowNodes.indexOf(conditionNode) + 1 },
    ...cbElseIfBranchesTop.map((b: any) => ({ branch: b.id, insertIdx: workflowNodes.length })),
    { branch: 'false', insertIdx: workflowNodes.length },
  ] : null;

  // Build ordered connection pairs for SVG line rendering
  const connections: Array<{ fromId: string; toId: string }> = [];
  for (let i = 0; i < preConditionNodes.length - 1; i++) {
    connections.push({ fromId: preConditionNodes[i].id, toId: preConditionNodes[i + 1].id });
  }
  if (conditionNode) {
    if (preConditionNodes.length > 0) {
      connections.push({ fromId: preConditionNodes[preConditionNodes.length - 1].id, toId: conditionNode.id });
    }
    const trueBadgeKey = `__true_badge__${conditionNode.id}__`;
    const falseBadgeKey = `__false_badge__${conditionNode.id}__`;
    // Both orientations: add badge→branch and branch sibling connections.
    // The SVG filter draws these only when a node is displaced; inline rendering handles the rest.
    if (trueNodes.length > 0) {
      connections.push({ fromId: trueBadgeKey, toId: trueNodes[0].id });
      for (let i = 0; i < trueNodes.length - 1; i++) connections.push({ fromId: trueNodes[i].id, toId: trueNodes[i + 1].id });
    }
    if (falseNodes.length > 0) {
      connections.push({ fromId: falseBadgeKey, toId: falseNodes[0].id });
      for (let i = 0; i < falseNodes.length - 1; i++) connections.push({ fromId: falseNodes[i].id, toId: falseNodes[i + 1].id });
    }
    // ElseIf branches
    const topElseIfs = conditionNode.config?.elseIfBranches ?? [];
    for (const b of topElseIfs) {
      const eiNodes = workflowNodes.filter(n => n.branch === b.id && (!n.parentConditionId || n.parentConditionId === conditionNode.id));
      const eiBadgeKey = `__ei_badge_${topElseIfs.indexOf(b)}__${conditionNode.id}__`;
      if (eiNodes.length > 0) {
        connections.push({ fromId: eiBadgeKey, toId: eiNodes[0].id });
        for (let i = 0; i < eiNodes.length - 1; i++) connections.push({ fromId: eiNodes[i].id, toId: eiNodes[i + 1].id });
      }
    }
  }
  // Add badge→branch connections for all OTHER condition nodes (both orientations).
  const allConditionNodes = workflowNodes.filter(n => n.type === 'condition');
  for (const cNode of allConditionNodes) {
    if (cNode.id === conditionNode?.id) continue; // already handled above
    const cTrueNodes = workflowNodes.filter(n => n.branch === 'true' && (!n.parentConditionId || n.parentConditionId === cNode.id));
    const cFalseNodes = workflowNodes.filter(n => n.branch === 'false' && (!n.parentConditionId || n.parentConditionId === cNode.id));
    const cTrueBadgeKey = `__true_badge__${cNode.id}__`;
    const cFalseBadgeKey = `__false_badge__${cNode.id}__`;
    if (cTrueNodes.length > 0) {
      connections.push({ fromId: cTrueBadgeKey, toId: cTrueNodes[0].id });
      for (let i = 0; i < cTrueNodes.length - 1; i++) connections.push({ fromId: cTrueNodes[i].id, toId: cTrueNodes[i + 1].id });
    }
    if (cFalseNodes.length > 0) {
      connections.push({ fromId: cFalseBadgeKey, toId: cFalseNodes[0].id });
      for (let i = 0; i < cFalseNodes.length - 1; i++) connections.push({ fromId: cFalseNodes[i].id, toId: cFalseNodes[i + 1].id });
    }
    const cElseIfs = cNode.config?.elseIfBranches ?? [];
    for (const b of cElseIfs) {
      const eiNodes = workflowNodes.filter(n => n.branch === b.id && (!n.parentConditionId || n.parentConditionId === cNode.id));
      const eiBadgeKey = `__ei_badge_${cElseIfs.indexOf(b)}__${cNode.id}__`;
      if (eiNodes.length > 0) {
        connections.push({ fromId: eiBadgeKey, toId: eiNodes[0].id });
        for (let i = 0; i < eiNodes.length - 1; i++) connections.push({ fromId: eiNodes[i].id, toId: eiNodes[i + 1].id });
      }
    }
  }

  // ─── Config-selection dialog (MCP, Computer Use, …) ──────────────────────
  const configDialogMeta = configDialog ? (() => {
    const label = configDialog.pendingNode.label;
    if (label === 'MCP') return {
      title: 'Add MCP',
      subtitle: 'Choose an MCP server to connect.',
      existingLabel: 'Existing MCP servers',
      sectionLabel: 'Select which MCP to add',
      items: MOCK_MCPS.slice(0, 3).map(m => ({ id: m.id, name: m.name, description: m.description, icon: <img src="./mcp-icon.svg" alt="MCP" className="w-5 h-5 flex-shrink-0" /> })),
      createLabel: null,
    };
    if (label === 'Computer Use') return {
      title: 'Add Computer Use',
      subtitle: 'Empower your workflow to directly use web and desktop apps.',
      existingLabel: 'Existing environments',
      items: MOCK_CUAS.map(c => ({ id: c.id, name: c.name, description: c.description, icon: <img src="./cua-icon.svg" alt="Computer Use" className="w-5 h-5 flex-shrink-0" /> })),
      createLabel: 'Create new',
    };
    if (label === 'Agent') return {
      title: 'Add Agent',
      subtitle: 'Select an existing agent from your workspace, or create a new one.',
      existingLabel: 'Existing agents',
      items: MOCK_AGENTS.map(a => ({ id: a.id, name: a.name, description: a.description, icon: <Agents24Filled style={{ color: 'hsl(var(--primary))', width: 20, height: 20, flexShrink: 0 }} /> })),
      createLabel: 'Create new',
    };
    if (label === 'Prompt') return {
      title: 'Add Prompt',
      subtitle: 'Select a saved prompt template, or write a new one.',
      existingLabel: 'Existing prompts',
      items: MOCK_PROMPTS.map(p => ({
        id: p.id, name: p.name,
        description: `${p.description}`,
        icon: (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, color: 'hsl(var(--primary))' }}>
            <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M6 7h8M6 10h8M6 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        ),
      })),
      createLabel: 'Create new',
    };
    if (label === 'Classify') return {
      title: 'Add Classifier',
      subtitle: 'Select a saved classifier, or configure a new one.',
      existingLabel: 'Existing classifiers',
      items: MOCK_CLASSIFIERS.map(c => ({ id: c.id, name: c.name, description: c.description, icon: <Tag24Filled style={{ color: 'hsl(var(--primary))', width: 20, height: 20, flexShrink: 0 }} /> })),
      createLabel: 'Create new',
    };
    if (label === 'Guardrails') return {
      title: 'Add Guardrails',
      subtitle: 'Select a saved guardrail policy, or configure a new one.',
      existingLabel: 'Existing guardrails',
      items: MOCK_GUARDRAILS.map(g => ({ id: g.id, name: g.name, description: g.description, icon: <Shield24Filled style={{ color: 'hsl(var(--primary))', width: 20, height: 20, flexShrink: 0 }} /> })),
      createLabel: 'Create new',
    };
    if (label === 'Extract') return {
      title: 'Add Extractor',
      subtitle: 'Select a saved extraction template, or configure a new one.',
      existingLabel: 'Existing extractors',
      items: MOCK_EXTRACTORS.map(e => ({ id: e.id, name: e.name, description: e.description, icon: <DocumentTextExtract24Filled style={{ color: 'hsl(var(--primary))', width: 20, height: 20, flexShrink: 0 }} /> })),
      createLabel: 'Create new',
    };
    if (label === 'Human Review') return {
      title: 'Add Human review',
      subtitle: 'Select a human review action to pause the workflow and wait for a human response.',
      sectionLabel: 'Select which action to add',
      items: HUMAN_REVIEW_OPTIONS.map(o => ({ id: o.id, name: o.name, description: o.description, icon: o.icon })),
      createLabel: null,
    };
    return null;
  })() : null;

  const v1ConnectorPickerModal = v1ConnectorPickerOpen && (() => {
    const msCount = CONNECTORS.filter(isMicrosoftConnector).length;
    const favCount = v1FavoriteConnectors.size;
    const V1_CONN_CATS = [
      { id: 'all' as const, label: 'All', count: CONNECTORS.length },
      { id: 'microsoft' as const, label: 'Microsoft', count: msCount },
      { id: 'favorites' as const, label: 'Favorites', count: favCount },
    ];
    const closeModal = () => { setV1ConnectorPickerOpen(false); setV1ConnectorPickerQuery(''); setV1MicrosoftGroup(null); setV1ConnectorDetail(null); setV1PreviewAction(null); };
    const v1RowCls = (label: string) => `group/r flex items-stretch transition-colors ${v1PreviewAction?.label === label ? 'bg-gray-100' : 'hover:bg-gray-50'}`;
    const v1PreviewBtn = (onClick: (e: React.MouseEvent) => void) => (
      <CopilotButton variant="ghost" size="sm" onClick={onClick} className="opacity-0 group-hover/r:opacity-100 transition-opacity flex-shrink-0 flex items-center pr-4 text-caption-1 font-medium text-gray-400 hover:text-gray-700">Preview</CopilotButton>
    );
    const chevronRight = (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0 text-gray-300">
        <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={closeModal}>
        <div className="bg-white rounded-2xl overflow-hidden flex flex-col" style={{ width: 860, height: 580, boxShadow: '0 24px 80px rgba(0,0,0,0.2)', border: '1px solid hsl(var(--stroke-default))' }} onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <div>
              <h3 className="text-body-1-strong text-gray-900">Select a connector</h3>
              <p className="text-caption-1 text-gray-500 mt-0.5">Choose the connector that will trigger this workflow.</p>
            </div>
            <CopilotButton variant="ghost" size="sm" onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5 p-0 min-w-0 w-auto h-auto">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </CopilotButton>
          </div>

          {/* Body: sidebar + main */}
          <div className="flex flex-1 min-h-0">
            {/* Sidebar */}
            <div className="flex flex-col gap-0.5 p-3 border-r border-gray-100 flex-shrink-0" style={{ width: 200 }}>
              {V1_CONN_CATS.map(cat => (
                <CopilotButton
                  key={cat.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => { setV1ConnectorPickerCategory(cat.id); setV1ConnectorPickerQuery(''); setV1MicrosoftGroup(null); setV1ConnectorDetail(null); setV1PreviewAction(null); }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors w-full ${v1ConnectorPickerCategory === cat.id ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}
                >
                  <span className="text-body-2 flex-1">{cat.label}</span>
                  <span className="text-caption-1 text-gray-400 tabular-nums">{cat.count.toLocaleString()}</span>
                </CopilotButton>
              ))}
            </div>

            {/* Main: search + list */}
            <div className="flex flex-col flex-1 min-w-0">
              {/* Search */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-gray-400">
                  <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <CopilotInput
                  autoFocus
                  size="sm"
                  value={v1ConnectorPickerQuery}
                  onChange={e => { setV1ConnectorPickerQuery(e.target.value); if (e.target.value) { setV1ConnectorDetail(null); setV1PreviewAction(null); } }}
                  placeholder="Search connectors…"
                  className="flex-1 border-0 bg-transparent shadow-none px-0"
                />
                {v1ConnectorPickerQuery && (
                  <CopilotButton variant="ghost" size="sm" onClick={() => setV1ConnectorPickerQuery('')} className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-0 min-w-0 w-auto h-auto">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </CopilotButton>
                )}
              </div>

              {/* Connector list */}
              <div className="overflow-y-auto flex-1">
                {(() => {
                  // ── Microsoft: group list (no group selected, not searching) ──
                  if (v1ConnectorPickerCategory === 'microsoft' && !v1MicrosoftGroup && !v1ConnectorPickerQuery) {
                    const msAll = CONNECTORS.filter(isMicrosoftConnector);
                    const msGroupRows = [
                      ...MS_GROUPS.map(g => ({ id: g.id, label: g.label, count: msAll.filter(n => connInMsGroup(n, g)).length })),
                      { id: 'ms-other', label: 'Other Microsoft', count: msAll.filter(n => !MS_GROUPS.some(g => connInMsGroup(n, g))).length },
                    ].filter(row => row.count > 0);
                    return (
                      <div className="py-1.5">
                        {msGroupRows.map(row => {
                          const gi = MS_GROUP_ICONS[row.id];
                          const preview = (() => {
                            const names = getMsGroupConnectors(row.id);
                            const shown = names.slice(0, 4).map(n => shortenForGroup(n, row.id));
                            return shown.join(', ') + (names.length > 4 ? ', etc.' : '');
                          })();
                          return (
                            <CopilotButton
                              key={row.id}
                              variant="ghost"
                              size="sm"
                              onClick={() => setV1MicrosoftGroup(row.id)}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors"
                            >
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: gi?.bg ?? '#f3f4f6' }}>
                                {gi?.icon}
                              </div>
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-body-2 font-medium text-gray-900">{row.label}</span>
                                <span className="text-caption-1 text-gray-400 truncate">{preview}</span>
                              </div>
                              <span className="bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 text-caption-1 flex-shrink-0 mr-1" style={{ fontSize: 10 }}>{row.count}</span>
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0 text-gray-300">
                                <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </CopilotButton>
                          );
                        })}
                      </div>
                    );
                  }

                  // ── Microsoft: merged connector rows for a group (group selected, no connector detail, no search) ──
                  if (v1ConnectorPickerCategory === 'microsoft' && v1MicrosoftGroup && !v1ConnectorDetail && !v1ConnectorPickerQuery) {
                    const msGroupLabel = MS_GROUPS.find(g => g.id === v1MicrosoftGroup)?.label ?? 'Other Microsoft';
                    const groupConnectors = getMsGroupConnectors(v1MicrosoftGroup);
                    const renderedMergeKeys = new Set<string>();
                    const displayRows: Array<{ key: string; displayName: string }> = [];
                    for (const name of groupConnectors) {
                      if (V2_MERGED_CONNECTOR_NAMES.has(name)) {
                        const mergeKey = Object.keys(V2_CONNECTOR_DISPLAY_MERGE).find(k => V2_CONNECTOR_DISPLAY_MERGE[k].includes(name))!;
                        if (!renderedMergeKeys.has(mergeKey)) { renderedMergeKeys.add(mergeKey); displayRows.push({ key: mergeKey, displayName: mergeKey }); }
                      } else {
                        displayRows.push({ key: name, displayName: name });
                      }
                    }
                    return (
                      <>
                        <div className="flex items-center gap-1 px-4 py-2.5 border-b border-gray-100">
                          <CopilotButton variant="ghost" size="sm" onClick={() => { setV1MicrosoftGroup(null); setV1PreviewAction(null); }} className="text-caption-1 text-gray-500 hover:text-gray-900 transition-colors p-0 h-auto min-w-0">Microsoft</CopilotButton>
                          {chevronRight}
                          <span className="text-caption-1 text-gray-900 font-medium">{msGroupLabel}</span>
                        </div>
                        <div className="py-1.5">
                          {displayRows.map(({ key, displayName }) => {
                            const iconSrc = getConnectorIconSrc(displayName);
                            const initials = displayName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
                            const bg = connectorColor(displayName);
                            const hasTriggers = !!(V1_CONNECTOR_TRIGGER_EVENTS[displayName] ?? V2_CONNECTOR_ACTIONS[displayName]);
                            return (
                              <CopilotButton
                                key={key}
                                variant="ghost"
                                size="sm"
                                onClick={() => hasTriggers ? setV1ConnectorDetail(displayName) : (setV1SelectedConnector(displayName), closeModal())}
                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition-colors"
                              >
                                {iconSrc ? (
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-white border border-gray-100"><img src={iconSrc} alt="" className="w-5 h-5" /></div>
                                ) : (
                                  <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-semibold" style={{ backgroundColor: bg, fontSize: 10 }}>{initials}</div>
                                )}
                                <span className="text-body-2 text-gray-900 flex-1 truncate">{displayName}</span>
                                {hasTriggers && chevronRight}
                              </CopilotButton>
                            );
                          })}
                        </div>
                      </>
                    );
                  }

                  // ── Microsoft: connector trigger events (connector detail selected, no search) ──
                  if (v1ConnectorPickerCategory === 'microsoft' && v1MicrosoftGroup && v1ConnectorDetail && !v1ConnectorPickerQuery) {
                    const msGroupLabel = MS_GROUPS.find(g => g.id === v1MicrosoftGroup)?.label ?? 'Other Microsoft';
                    const triggerEvents = V1_CONNECTOR_TRIGGER_EVENTS[v1ConnectorDetail] ?? V2_CONNECTOR_ACTIONS[v1ConnectorDetail] ?? [];
                    const iconSrc = getConnectorIconSrc(v1ConnectorDetail);
                    const initials = v1ConnectorDetail.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
                    const bg = connectorColor(v1ConnectorDetail);
                    const connIconNode = iconSrc
                      ? <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-white border border-gray-100"><img src={iconSrc} alt="" className="w-5 h-5" /></div>
                      : <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-semibold" style={{ backgroundColor: bg, fontSize: 10 }}>{initials}</div>;
                    return (
                      <>
                        <div className="flex items-center gap-1 px-4 py-2.5 border-b border-gray-100">
                          <CopilotButton variant="ghost" size="sm" onClick={() => { setV1MicrosoftGroup(null); setV1ConnectorDetail(null); setV1PreviewAction(null); }} className="text-caption-1 text-gray-500 hover:text-gray-900 transition-colors p-0 h-auto min-w-0">Microsoft</CopilotButton>
                          {chevronRight}
                          <CopilotButton variant="ghost" size="sm" onClick={() => { setV1ConnectorDetail(null); setV1PreviewAction(null); }} className="text-caption-1 text-gray-500 hover:text-gray-900 transition-colors p-0 h-auto min-w-0">{msGroupLabel}</CopilotButton>
                          {chevronRight}
                          <span className="text-caption-1 text-gray-900 font-medium">{v1ConnectorDetail}</span>
                        </div>
                        <div className="py-1.5">
                          {triggerEvents.map(event => (
                            <div key={event} className={v1RowCls(event)}>
                              <CopilotButton
                                variant="ghost"
                                size="sm"
                                onClick={() => { setV1SelectedConnector(v1ConnectorDetail!); setV1SelectedConnectorAction(event); closeModal(); }}
                                className="flex items-center gap-3 px-4 py-2 text-left flex-1 min-w-0"
                              >
                                {connIconNode}
                                <span className="text-body-2 text-gray-900 flex-1 truncate">{event}</span>
                              </CopilotButton>
                              {v1PreviewBtn(e => { e.stopPropagation(); setV1PreviewAction({ label: event, type: 'trigger', connector: v1ConnectorDetail!, parentLabel: v1ConnectorDetail!, iconNode: connIconNode }); })}
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  }

                  // ── Flat list (All/Favorites, or Microsoft when searching) ──
                  const baseList = v1ConnectorPickerCategory === 'microsoft'
                    ? (v1MicrosoftGroup ? getMsGroupConnectors(v1MicrosoftGroup) : CONNECTORS.filter(isMicrosoftConnector))
                    : v1ConnectorPickerCategory === 'favorites'
                    ? CONNECTORS.filter(c => v1FavoriteConnectors.has(c))
                    : CONNECTORS;
                  const filtered = baseList.filter(c => c.toLowerCase().includes(v1ConnectorPickerQuery.toLowerCase()));

                  const renderConnectorRow = (c: string) => {
                    const iconSrc = getConnectorIconSrc(c);
                    const initials = c.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
                    const bgColor = connectorColor(c);
                    const isFav = v1FavoriteConnectors.has(c);
                    return (
                      <div key={c} className={`group flex items-center gap-3 px-4 hover:bg-gray-50 transition-colors ${v1SelectedConnector === c ? 'bg-blue-50' : ''}`}>
                        <CopilotButton
                          variant="ghost"
                          size="sm"
                          onClick={() => { setV1SelectedConnector(c); closeModal(); }}
                          className="flex items-center gap-3 py-2.5 text-left flex-1 min-w-0"
                        >
                          {iconSrc ? (
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-white border border-gray-100"><img src={iconSrc} alt="" className="w-5 h-5" /></div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-semibold" style={{ backgroundColor: bgColor, fontSize: 10 }}>{initials}</div>
                          )}
                          <span className="flex-1 text-body-2 text-gray-900 truncate">{c}</span>
                          {v1SelectedConnector === c && (
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 text-[hsl(var(--primary))]">
                              <path d="M12 3.5L5.5 10 2 6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </CopilotButton>
                        <CopilotButton
                          variant="ghost"
                          size="sm"
                          onClick={e => { e.stopPropagation(); setV1FavoriteConnectors(prev => { const next = new Set(prev); isFav ? next.delete(c) : next.add(c); return next; }); }}
                          className={`flex-shrink-0 transition-colors p-1 rounded ${isFav ? 'text-amber-400 hover:text-amber-500' : 'text-gray-200 hover:text-gray-400 opacity-0 group-hover:opacity-100'}`}
                          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill={isFav ? 'currentColor' : 'none'}>
                            <path d="M8 1.5l1.854 3.756 4.146.603-3 2.924.708 4.129L8 10.77l-3.708 1.954.708-4.13L2 5.86l4.146-.603L8 1.5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
                          </svg>
                        </CopilotButton>
                      </div>
                    );
                  };

                  return (
                    <>
                      {v1ConnectorPickerCategory === 'microsoft' && v1MicrosoftGroup && (
                        <div className="flex items-center gap-1 px-4 py-2.5 border-b border-gray-100">
                          <CopilotButton variant="ghost" size="sm" onClick={() => { setV1MicrosoftGroup(null); setV1ConnectorDetail(null); setV1PreviewAction(null); }} className="text-caption-1 text-gray-500 hover:text-gray-900 transition-colors p-0 h-auto min-w-0">Microsoft</CopilotButton>
                          {chevronRight}
                          <span className="text-caption-1 text-gray-900 font-medium">{MS_GROUPS.find(g => g.id === v1MicrosoftGroup)?.label ?? 'Other Microsoft'}</span>
                        </div>
                      )}
                      <div className="py-1.5">
                        {filtered.map(renderConnectorRow)}
                        {filtered.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            {v1ConnectorPickerCategory === 'favorites' ? (
                              <>
                                <svg width="28" height="28" viewBox="0 0 16 16" fill="none" className="text-gray-200 mb-3">
                                  <path d="M8 1.5l1.854 3.756 4.146.603-3 2.924.708 4.129L8 10.77l-3.708 1.954.708-4.13L2 5.86l4.146-.603L8 1.5z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
                                </svg>
                                <p className="text-body-2 text-gray-400">No favorites yet</p>
                                <p className="text-caption-1 text-gray-300 mt-1">Star a connector to add it here</p>
                              </>
                            ) : (
                              <p className="text-body-2 text-gray-400">No connectors found</p>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Preview panel — slides in from right */}
            <div
              className="border-l border-gray-100 flex-shrink-0 overflow-hidden transition-all duration-200 flex flex-col"
              style={{ width: v1PreviewAction ? 280 : 0 }}
            >
              {v1PreviewAction && (() => {
                const pc = getV2PreviewContent(v1PreviewAction.label);
                return (
                  <div className="flex flex-col h-full" style={{ width: 280 }}>
                    {/* Preview header */}
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          {v1PreviewAction.iconNode}
                          <div className="flex flex-col min-w-0 pt-0.5">
                            <span className="text-body-2-strong text-gray-900 leading-tight">{v1PreviewAction.label}</span>
                            {v1PreviewAction.parentLabel && (
                              <span className="text-caption-1 text-gray-400 mt-0.5">{v1PreviewAction.parentLabel}</span>
                            )}
                          </div>
                        </div>
                        <CopilotButton variant="ghost" size="sm" onClick={() => setV1PreviewAction(null)} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 mt-0.5 p-0 min-w-0 w-auto h-auto">
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </CopilotButton>
                      </div>
                    </div>
                    {/* Preview body */}
                    <div className="flex-1 overflow-auto px-4 py-3 flex flex-col gap-4">
                      <p className="text-caption-1 text-gray-600 leading-relaxed">{pc.description}</p>
                      {pc.inputs.length > 0 && (
                        <div>
                          <div className="text-gray-400 font-semibold uppercase tracking-wider mb-1.5" style={{ fontSize: 10 }}>Inputs</div>
                          <div className="flex flex-col gap-1">
                            {pc.inputs.map(i => (
                              <div key={i} className="flex items-center gap-1.5 text-caption-1 text-gray-700">
                                <div className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />
                                {i}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {pc.outputs.length > 0 && (
                        <div>
                          <div className="text-gray-400 font-semibold uppercase tracking-wider mb-1.5" style={{ fontSize: 10 }}>Outputs</div>
                          <div className="flex flex-col gap-1">
                            {pc.outputs.map(o => (
                              <div key={o} className="flex items-center gap-1.5 text-caption-1 text-gray-700">
                                <div className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />
                                {o}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* CTA */}
                    <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
                      <CopilotButton
                        variant="primary"
                        size="md"
                        onClick={() => { setV1SelectedConnector(v1PreviewAction.connector ?? null); setV1SelectedConnectorAction(v1PreviewAction.label); closeModal(); }}
                        className="w-full justify-center"
                      >
                        Select connector
                      </CopilotButton>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    );
  })();

  const mcpExpandedModal = mcpPanelExpanded && displayedNode && (
    <McpExpandedModal
      isOpen={mcpPanelExpanded}
      onClose={closeMcpModal}
      displayedNode={displayedNode}
      getNodeIcon={getNodeIcon}
      getPreviousNodes={getPreviousNodes}
      getNodeOutputs={getNodeOutputs}
      getConnectorIconSrc={getConnectorIconSrc}
      renderNodeDetails={renderNodeDetails}
      allSteps={ALL_STEPS}
      mcpSegments={mcpSegments}
      mcpSampleInputs={mcpSampleInputs}
      setMcpSampleInputs={setMcpSampleInputs}
      mcpTestState={mcpTestState}
      setMcpTestState={setMcpTestState}
      mcpSampleCollapsed={mcpSampleCollapsed}
      setMcpSampleCollapsed={setMcpSampleCollapsed}
      mcpInputsExpanded={mcpInputsExpanded}
      setMcpInputsExpanded={setMcpInputsExpanded}
      mcpSimResults={mcpSimResults}
      setMcpSimResults={setMcpSimResults}
      mcpSimTab={mcpSimTab}
      setMcpSimTab={setMcpSimTab}
      mcpInstructionEditorRef={mcpInstructionEditorRef}
    />
  );

  // V1: matches v1PaletteModal dimensions (680×720, rounded-3xl)
  // V2: matches v2PaletteModal dimensions (980×620, rounded-2xl, sidebar+main layout)
  const configDialogModal = configDialog && configDialogMeta && (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: version === 2 ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.45)' }} onClick={() => setConfigDialog(null)}>
      {version === 2 ? (
        /* ── V2 layout: 980×620, sidebar + main (mirrors v2PaletteModal) ── */
        <div
          className="bg-white rounded-2xl overflow-hidden flex flex-col"
          style={{ width: 980, height: 620, boxShadow: '0 24px 80px rgba(0,0,0,0.2)', border: '1px solid hsl(var(--stroke-default))' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <span className="text-body-1-strong text-gray-900">{configDialogMeta.title}</span>
            <CopilotButton variant="ghost" size="sm" onClick={() => setConfigDialog(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <Dismiss20Regular style={{ width: 18, height: 18 }} />
            </CopilotButton>
          </div>

          {/* Body: sidebar + main */}
          <div className="flex flex-1 min-h-0">
            {/* Sidebar: step type description */}
            <div className="flex flex-col p-6 border-r border-gray-100 flex-shrink-0" style={{ width: 280 }}>
              <p className="text-body-2 text-gray-500 leading-relaxed">{configDialogMeta.subtitle}</p>
            </div>

            {/* Main: create button + item list */}
            <div className="flex flex-col flex-1 min-w-0 min-h-0">
              {/* Create new — primary, top right */}
              {configDialogMeta.createLabel && <div className="flex items-center justify-end px-6 py-4 border-b border-gray-100 flex-shrink-0">
                <CopilotButton variant="primary" size="sm" onClick={() => confirmConfigDialog('create')}>
                  {configDialogMeta.createLabel}
                </CopilotButton>
              </div>}
              {/* Item list */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {configDialogMeta.items.map(item => (
                  <div key={item.id} className="flex items-center gap-4 px-4 py-4 rounded-xl border border-gray-200 hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.02)] transition-colors group">
                    {item.icon}
                    <div className="flex-1 min-w-0">
                      <div className="text-body-2-strong text-gray-900">{item.name}</div>
                      <div className="text-caption-1 text-gray-500 mt-0.5">{item.description}</div>
                    </div>
                    <CopilotButton variant="secondary" size="sm" onClick={() => confirmConfigDialog(item.id)} className="flex-shrink-0">Add</CopilotButton>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : ('layout' in configDialogMeta && configDialogMeta.layout === 'grid') ? (
        /* ── Grid layout: Human Review picker ── */
        <div
          className="bg-white rounded-3xl overflow-hidden flex flex-col"
          style={{ width: 680, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: '1px solid hsl(var(--stroke-default))' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Breadcrumb header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0">
            <h2 className="text-title-2 text-gray-900 flex items-center gap-2">
              <span className="text-gray-400">Add</span>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-gray-300 flex-shrink-0"><path d="M5 2l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span>{configDialogMeta.title}</span>
            </h2>
            <CopilotButton variant="ghost" size="sm" onClick={() => setConfigDialog(null)} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close dialog" title="Close">
              <Dismiss20Regular style={{ width: 18, height: 18 }} />
            </CopilotButton>
          </div>

          {/* 2-column grid */}
          <div className="px-6 pb-6 grid grid-cols-2 gap-3">
            {configDialogMeta.items.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-4 rounded-xl border border-gray-200 hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.03)] transition-colors cursor-pointer"
                onClick={() => confirmConfigDialog(item.id)}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(var(--primary)/0.08)' }}>
                  {item.icon}
                </div>
                <span className="text-body-2-strong text-gray-900 leading-tight">{item.name}</span>
              </div>
            ))}
          </div>

        </div>
      ) : (
        /* ── V1 / V3 layout: 680×720, rounded-3xl (mirrors v1PaletteModal) ── */
        <div
          className="bg-white rounded-3xl overflow-hidden flex flex-col"
          style={{ width: 680, height: 720, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: '1px solid hsl(var(--stroke-default))' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-1 flex-shrink-0">
            <h2 className="text-title-2 text-gray-900">{configDialogMeta.title}</h2>
            <CopilotButton variant="ghost" size="sm" onClick={() => setConfigDialog(null)} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close dialog" title="Close">
              <Dismiss20Regular style={{ width: 18, height: 18 }} />
            </CopilotButton>
          </div>

          {/* Subtitle — close to title */}
          <p className="px-6 pb-5 text-body-2 text-gray-500 flex-shrink-0">{configDialogMeta.subtitle}</p>

          {/* Section row: "Existing ___" + count badge + optional Create new button */}
          <div className="flex items-center justify-between px-6 pb-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              {'sectionLabel' in configDialogMeta && configDialogMeta.sectionLabel
                ? <span className="text-body-2-strong text-gray-700">{configDialogMeta.sectionLabel}</span>
                : <><span className="text-body-2-strong text-gray-700">Existing</span><span className="inline-flex items-center justify-center bg-gray-100 text-gray-500 text-caption-1 font-medium rounded-full px-2 py-0.5 min-w-[20px]">{configDialogMeta.items.length}</span></>
              }
            </div>
            {configDialogMeta.createLabel && <CopilotButton variant="primary" size="sm" onClick={() => confirmConfigDialog('create')} className="flex-shrink-0">
              {configDialogMeta.createLabel}
            </CopilotButton>}
          </div>
          <div className="mx-6 border-t border-gray-200 mb-4 flex-shrink-0" />

          {/* Scrollable list */}
          <div className="px-6 pb-2 flex-1 overflow-y-auto space-y-3">
            {configDialogMeta.items.map(item => (
              <div key={item.id} className="flex items-center gap-4 px-4 py-5 rounded-xl border border-gray-200 hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.02)] transition-colors group">
                {item.icon}
                <div className="flex-1 min-w-0">
                  <div className="text-body-2-strong text-gray-900">{item.name}</div>
                  <div className="text-caption-1 text-gray-500 mt-1">{item.description}</div>
                </div>
                <CopilotButton variant="secondary" size="sm" onClick={() => confirmConfigDialog(item.id)} className="flex-shrink-0">Add</CopilotButton>
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );

  // ─── Branch-choice dialog ─────────────────────────────────────────────────
  const branchDialogModal = branchDialog && (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}>
      <div className="bg-white rounded-2xl p-6" style={{ width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', border: '1px solid hsl(var(--stroke-default))' }} onClick={e => e.stopPropagation()}>
        <h3 className="text-body-1-strong text-gray-900 mb-1">Add If / Else</h3>
        <p className="text-body-2 text-gray-500 mb-4">
          {branchDialog.afterNodes.length} step{branchDialog.afterNodes.length !== 1 ? 's' : ''} already follow this point. Which branch should they go on?
        </p>
        <div className="space-y-1.5 mb-5">
          {branchDialog.afterNodes.slice(0, 4).map(n => (
            <div key={n.id} className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0" style={{ transform: 'scale(0.75)', transformOrigin: 'left center' }}>{getNodeIcon(n)}</div>
              <span className="text-caption-1 text-gray-700 truncate">{n.label}</span>
            </div>
          ))}
          {branchDialog.afterNodes.length > 4 && (
            <p className="text-caption-1 text-gray-400 pl-3">+{branchDialog.afterNodes.length - 4} more</p>
          )}
        </div>
        <div className="flex gap-3 mb-3">
          <CopilotButton
            variant="ghost"
            size="sm"
            onClick={() => applyBranchChoice('true')}
            className="flex-1 px-4 py-3 rounded-xl border-2 text-caption-1-strong transition-colors bg-green-50 hover:bg-green-100 text-green-700"
            style={{ borderColor: 'hsl(var(--status-success))' }}
          >
            If branch (True)
          </CopilotButton>
          <CopilotButton
            variant="ghost"
            size="sm"
            onClick={() => applyBranchChoice('false')}
            className="flex-1 px-4 py-3 rounded-xl border-2 text-caption-1-strong transition-colors bg-red-50 hover:bg-red-100 text-red-600"
            style={{ borderColor: 'hsl(var(--status-error))' }}
          >
            Else branch (False)
          </CopilotButton>
        </div>
        <CopilotButton
          variant="ghost"
          size="sm"
          onClick={() => setBranchDialog(null)}
          className="w-full text-caption-1 text-gray-400 hover:text-gray-600 py-1.5 transition-colors"
        >
          Cancel
        </CopilotButton>
      </div>
    </div>
  );

  // ─── Delete-branch dialog ─────────────────────────────────────────────────
  const deleteBranchDialogModal = deleteBranchDialog && (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}>
      <div className="bg-white rounded-2xl p-6" style={{ width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', border: '1px solid hsl(var(--stroke-default))' }} onClick={e => e.stopPropagation()}>
        <h3 className="text-body-1-strong text-gray-900 mb-1">Delete If / Else</h3>
        <p className="text-body-2 text-gray-500 mb-5">
          What should happen to the steps inside its branches?
        </p>
        <div className="space-y-2 mb-3">
          {deleteBranchDialog.trueNodes.length > 0 && (
            <CopilotButton
              variant="ghost"
              size="sm"
              onClick={() => applyDeleteBranch('true')}
              className="!h-auto w-full px-4 py-3 rounded-xl border-2 text-left transition-colors bg-green-50 hover:bg-green-100 flex items-center gap-3"
              style={{ borderColor: 'hsl(var(--status-success))' }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-caption-1-strong text-green-700">Keep If branch (True) steps</div>
                <div className="text-caption-1 text-gray-500 truncate mt-0.5">
                  {deleteBranchDialog.trueNodes.slice(0, 3).map(n => n.label).join(' · ')}
                  {deleteBranchDialog.trueNodes.length > 3 ? ` +${deleteBranchDialog.trueNodes.length - 3} more` : ''}
                </div>
              </div>
              <span className="flex-shrink-0 px-2 py-0.5 bg-green-100 text-green-700 text-caption-1-strong rounded-full">
                {deleteBranchDialog.trueNodes.length}
              </span>
            </CopilotButton>
          )}
          {deleteBranchDialog.falseNodes.length > 0 && (
            <CopilotButton
              variant="ghost"
              size="sm"
              onClick={() => applyDeleteBranch('false')}
              className="!h-auto w-full px-4 py-3 rounded-xl border-2 text-left transition-colors bg-red-50 hover:bg-red-100 flex items-center gap-3"
              style={{ borderColor: 'hsl(var(--status-error))' }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-caption-1-strong text-red-600">Keep Else branch (False) steps</div>
                <div className="text-caption-1 text-gray-500 truncate mt-0.5">
                  {deleteBranchDialog.falseNodes.slice(0, 3).map(n => n.label).join(' · ')}
                  {deleteBranchDialog.falseNodes.length > 3 ? ` +${deleteBranchDialog.falseNodes.length - 3} more` : ''}
                </div>
              </div>
              <span className="flex-shrink-0 px-2 py-0.5 bg-red-100 text-red-600 text-caption-1-strong rounded-full">
                {deleteBranchDialog.falseNodes.length}
              </span>
            </CopilotButton>
          )}
          <CopilotButton
            variant="ghost"
            size="sm"
            onClick={() => applyDeleteBranch('none')}
            className="!h-auto w-full px-4 py-3 rounded-xl border border-gray-200 text-caption-1-strong text-left transition-colors bg-gray-50 hover:bg-gray-100 text-gray-700"
          >
            Delete the If / Else and all its steps
          </CopilotButton>
        </div>
        <CopilotButton
          variant="ghost"
          size="sm"
          onClick={() => setDeleteBranchDialog(null)}
          className="w-full text-caption-1 text-gray-400 hover:text-gray-600 py-1.5 transition-colors"
        >
          Cancel
        </CopilotButton>
      </div>
    </div>
  );


  const instructionsModal = (
    <Dialog
      isOpen={!!instructionsModalNodeId}
      onClose={() => setInstructionsModalNodeId(null)}
      maxWidth="4xl"
      height="75vh"
      maxHeight="90vh"
    >
      <DialogHeader>
        <div>
          <DialogTitle>Instructions</DialogTitle>
          <p className="text-body-2 text-text-secondary mt-0.5">What would you like this {instructionsModalStepKind.toLowerCase()} to do?</p>
        </div>
      </DialogHeader>
      <DialogContent>
        <WorkflowInstructionsEditor
          key={instructionsModalNodeId ?? ''}
          value={instructionsModalDraft}
          onChange={setInstructionsModalDraft}
          onInputChange={text => setInstructionsModalLiveText(text)}
          placeholder="Write your instructions. Use {{variable}} syntax for dynamic inputs."
          hideHeader
          className="flex-1 min-h-0"
        />
      </DialogContent>
      <DialogFooter>
        <CopilotButton variant="ghost" size="md" onClick={() => setInstructionsModalNodeId(null)}>Cancel</CopilotButton>
        <CopilotButton
          variant="primary"
          size="md"
          onClick={saveInstructionsModal}
          disabled={!instructionsModalLiveText.trim()}
        >Done</CopilotButton>
      </DialogFooter>
    </Dialog>
  );

  const canvasControlBtn = "w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors";

  const isHorizontal = canvasLayout === 'horizontal' && (version === 1 || version === 2 || isStepTypeVisuals);

  // Half-width of a node card in horizontal mode (for connection endpoint offsets)
  const hCardHalfW = (nodeId: string): number => {
    const n = workflowNodes.find(w => w.id === nodeId);
    if (!n) return 80;
    if (n.type === 'trigger') return 70; // 140 / 2
    if (n.type === 'condition' || ['Function', 'Variable', 'Loop'].includes(n.label)) return 60; // 120 / 2
    return 80; // 160 / 2
  };

  // Pre-compute branch section total height for displaced horizontal branch positioning
  const hElseIfBranchCount = conditionNode?.config?.elseIfBranches?.length ?? 0;
  const hTotalBranches = 2 + hElseIfBranchCount;
  const hDefaultRowH = 180;
  const hBranchSvgH = (() => {
    const condRowHeights = conditionNode ? (hBranchRowHeightsMap.get(conditionNode.id) ?? []) : [];
    const rh = condRowHeights.length === hTotalBranches
      ? condRowHeights
      : Array(hTotalBranches).fill(hDefaultRowH);
    return rh.reduce((a: number, b: number) => a + b, 0);
  })();

  // True while a detached (floating) V2 node is being dragged back toward the flow
  // Exclude note cards — they are never reattachable as steps
  const isReattachDragging = version === 2 && !!draggingNodeId && floatingNodes.some(n => n.id === draggingNodeId && n.type !== 'note');

  // Renders a landing zone between flow steps during reattach drag
  const renderReattachDropZone = (index: number) => isHorizontal ? (
    <div key={`dz-${index}`} style={{ height: 100 }} className="flex items-center justify-center px-0.5">
      <div
        className={`h-full flex items-center justify-center rounded-xl border-2 border-dashed transition-all duration-150 ${
          reattachDropIndex === index
            ? 'w-14 border-primary bg-primary/10'
            : 'w-7 border-gray-200 bg-gray-50/60'
        }`}
      >
        {reattachDropIndex === index && (
          <span className="text-caption-1-strong animate-slide-up-fade" style={{ color: 'hsl(var(--primary))', animationDuration: '0.15s', writingMode: 'vertical-rl' }}>
            Drop to reattach
          </span>
        )}
      </div>
    </div>
  ) : (
    <div key={`dz-${index}`} style={{ width: 352 }} className="flex items-center justify-center py-0.5">
      <div
        className={`w-full flex items-center justify-center rounded-xl border-2 border-dashed transition-all duration-150 ${
          reattachDropIndex === index
            ? 'h-14 border-primary bg-primary/10'
            : 'h-7 border-gray-200 bg-gray-50/60'
        }`}
      >
        {reattachDropIndex === index && (
          <span className="text-caption-1-strong animate-slide-up-fade" style={{ color: 'hsl(var(--primary))', animationDuration: '0.15s' }}>
            Drop to reattach
          </span>
        )}
      </div>
    </div>
  );

  // ─── Shared canvas content ────────────────────────────────────────────────
  const canvasNodes = (
    <div ref={canvasContentRef} className={isHorizontal ? '' : 'w-full'} style={isHorizontal ? undefined : { paddingBottom: 600 }}>
      {isGeneratingWorkflow ? (
        <div className="mx-auto" style={{ width: 352 }}>
          {[0, 1, 2].map(i => (
            <div key={i}>
              {i > 0 && <div className="flex justify-center"><div className="w-0.5 h-5 bg-gray-400" /></div>}
              <Skeleton><SkeletonItem style={{ width: 352, height: 68, borderRadius: 'var(--radius-2xl)' }} /></Skeleton>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Pre-condition nodes + condition node share the same centered column
              so the connector between the last pre-condition node and the condition
              card has a continuous line and a hover-only + button. */}
          <div className={`mx-auto flex items-center ${isHorizontal ? 'flex-row' : 'flex-col'}`} style={isHorizontal ? {} : { width: isStepTypeVisuals ? 380 : 352 }}>
            {/* Never allow inserting before the trigger */}
            {isReattachDragging && preConditionNodes[0]?.type !== 'trigger' && renderReattachDropZone(0)}
            {preConditionNodes.map((node, index) => (
              <React.Fragment key={node.id}>
                {index > 0 && (isReattachDragging
                  ? renderReattachDropZone(index)
                  : renderAddConnector(index, false, !!nodePositions[preConditionNodes[index - 1].id] || !!nodePositions[node.id])
                )}
                {renderFlowSlot(node)}
              </React.Fragment>
            ))}
            {conditionNode ? (
              <>
                {/* Non-last connector before condition: continuous line, hover-only + */}
                {preConditionNodes.length > 0 && renderAddConnector(
                  endInsertIndex,
                  false,
                  !!nodePositions[preConditionNodes[preConditionNodes.length - 1].id] || !!nodePositions[conditionNode.id]
                )}
                {(() => {
                  // Compute empty-branch state for per-pill + buttons on the card.
                  // When all branches are empty (!isStepTypeVisuals), the card renders pills with
                  // inline connector lines + add buttons — both in vertical AND horizontal mode.
                  // In horizontal mode we then skip the fork SVG + branch rows entirely.
                  const cbElseIfBranches = conditionNode.config?.elseIfBranches ?? [];
                  const cbAllEmpty = !isStepTypeVisuals && trueNodes.length === 0 && falseNodes.length === 0 &&
                    cbElseIfBranches.every((b: any) => workflowNodes.filter((n: WorkflowNode) => n.branch === b.id && (!n.parentConditionId || n.parentConditionId === conditionNode.id)).length === 0);
                  const cbEmptyPills: EmptyBranchPill[] | null = cbAllEmpty ? [
                    { branch: 'true', insertIdx: workflowNodes.indexOf(conditionNode) + 1 },
                    ...cbElseIfBranches.map((b: any) => ({ branch: b.id, insertIdx: workflowNodes.length })),
                    { branch: 'false', insertIdx: workflowNodes.length },
                  ] : null;
                  // In horizontal mode, hide the inline condition card when displaced — the card is
                  // re-rendered at the displaced position via Object.entries(nodePositions). Keep it
                  // in the DOM (visibility:hidden) so nodeCardRefs can still be overwritten by the
                  // displaced card's ref and pill origins remain measurable.
                  const isCondDisplacedInline = isHorizontal && !!nodePositions[conditionNode.id];
                  return (
                    <>
                      <div style={isCondDisplacedInline ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}>
                      <WorkflowFlowSlot node={conditionNode} ctx={ctx} emptyBranchPills={cbEmptyPills} />
                      </div>
                      {/* ── Horizontal branch rows (inline to the right of condition) ── */}
                      {/* Skipped when cbAllEmpty: card pills + buttons handle the empty state */}
                      {isHorizontal && !cbAllEmpty && (() => {
                  const hElseIfBranches: ElseIfBranch[] = conditionNode.config?.elseIfBranches ?? [];
                  const { positive: hPositive, negative: hNegative } = getBranchLabels(conditionNode.branchType);
                  const totalBranches = 2 + hElseIfBranches.length;
                  /*
                   * Dynamic-height layout: each branch row is `minHeight: defaultRowH` so it
                   * can grow to fit cards. A ResizeObserver (hBranchRowsRefs / hBranchRowHeightsMap)
                   * measures the actual rendered height of each row and feeds back into the SVG
                   * so bezier endpoints always land at the visual centre of their row.
                   *
                   * defaultRowH: minimum row height, large enough to comfortably contain a
                   *              horizontal card (hMinHeight=100) with breathing room.
                   * svgH / epy: derived from measured heights (or defaultRowH before first measure).
                   */
                  const defaultRowH = 180;
                  const condRowHeights = hBranchRowHeightsMap.get(conditionNode.id) ?? [];
                  const rowHeights = condRowHeights.length === totalBranches
                    ? condRowHeights
                    : Array(totalBranches).fill(defaultRowH);
                  const svgH = rowHeights.reduce((a: number, b: number) => a + b, 0);
                  const originY = svgH / 2;
                  const rowStartY = (i: number) => rowHeights.slice(0, i).reduce((a: number, b: number) => a + b, 0);
                  const branchNodeCounts = [
                    trueNodes.length,
                    ...hElseIfBranches.map((b: ElseIfBranch) => workflowNodes.filter(n => n.branch === b.id && (!n.parentConditionId || n.parentConditionId === conditionNode.id)).length),
                    falseNodes.length,
                  ];
                  const condPillOriginYs = pillOriginYsMap.get(conditionNode.id) ?? [];
                  const condPillOriginXs = pillOriginXsMap.get(conditionNode.id) ?? [];
                  const isEmptyAligned = !isStepTypeVisuals && condPillOriginYs.length === totalBranches;
                  const epy = (i: number) => {
                    if (isEmptyAligned && branchNodeCounts[i] === 0) return condPillOriginYs[i];
                    return rowStartY(i) + rowHeights[i] / 2;
                  };

                  const allBranchesEmpty = branchNodeCounts.every(c => c === 0);

                  // First node id for each branch row (true, ...elseifs, false), used to suppress
                  // the inline fork path when that branch's first node is displaced (SVG overlay takes over).
                  const branchFirstNodeIds = [
                    trueNodes[0]?.id,
                    ...hElseIfBranches.map((b: ElseIfBranch) => workflowNodes.find(n => n.branch === b.id && (!n.parentConditionId || n.parentConditionId === conditionNode.id))?.id),
                    falseNodes[0]?.id,
                  ];

                  const isCondDisplaced = !!nodePositions[conditionNode.id];
                  // Hide inline fork+rows when displaced — the displaced section renders them next to the moved card.
                  const hiddenStyle = isCondDisplaced ? { visibility: 'hidden' as const, pointerEvents: 'none' as const } : {};
                  return (
                    <>
                      {/* Fork SVG — isStepTypeVisuals only.
                          For !isStepTypeVisuals: branch rows sit flush against the card (no fork
                          container). Each row's HorizontalConnector renders the left dot at the
                          card boundary. A zero-width ref anchor is kept so the ResizeObserver
                          attachment code (which guards on forkEl existence) doesn't break. */}
                      {isStepTypeVisuals ? (
                        <div style={{ position: 'relative', width: 60, height: svgH, flexShrink: 0, ...hiddenStyle }}>
                          <svg
                            width={60}
                            height={svgH}
                            viewBox={`0 0 60 ${svgH}`}
                            style={{ display: 'block', overflow: 'visible' }}
                          >
                            <line x1="4" y1={originY} x2="16" y2={originY} stroke={CONNECTOR_COLOR} strokeWidth={CONNECTOR_WIDTH} strokeLinecap="round" />
                            {Array.from({ length: totalBranches }, (_, i) => {
                              if (branchFirstNodeIds[i] && nodePositions[branchFirstNodeIds[i]!]) return null;
                              return (
                                <path key={i}
                                  d={`M 0 ${originY} C 40 ${originY}, 20 ${epy(i)}, 60 ${epy(i)}`}
                                  stroke={CONNECTOR_COLOR} strokeWidth={CONNECTOR_WIDTH} fill="none"
                                />
                              );
                            })}
                            {Array.from({ length: totalBranches }, (_, i) => {
                              if (branchFirstNodeIds[i] && nodePositions[branchFirstNodeIds[i]!]) return null;
                              return <circle key={i} cx={60} cy={epy(i)} r={DOT_SIZE / 2} fill={DOT_FILL_END} stroke={DOT_STROKE_END} strokeWidth={CONNECTOR_WIDTH} />;
                            })}
                          </svg>
                          <div style={{
                            position: 'absolute', left: 4, top: originY,
                            transform: 'translate(-50%, -50%)',
                            width: 8, height: 8, borderRadius: '50%',
                            background: DOT_FILL, border: `${CONNECTOR_WIDTH}px solid ${DOT_STROKE}`, zIndex: 1,
                          }} />
                        </div>
                      ) : (
                        <div ref={(el: HTMLDivElement | null) => { if (el) hForkContainerRefs.current.set(conditionNode.id, el); else hForkContainerRefs.current.delete(conditionNode.id); }} style={{ position: 'relative', width: 60, height: svgH, flexShrink: 0, ...hiddenStyle }}>
                          <svg width={60} height={svgH} viewBox={`0 0 60 ${svgH}`} style={{ display: 'block', overflow: 'visible' }}>
                            {Array.from({ length: totalBranches }, (_, i) => {
                              if (branchFirstNodeIds[i] && nodePositions[branchFirstNodeIds[i]!]) return null;
                              const oy = condPillOriginYs.length === totalBranches ? condPillOriginYs[i] : originY;
                              const ox = condPillOriginXs.length === totalBranches ? condPillOriginXs[i] : 0;
                              return (
                                <path key={i}
                                  d={`M ${ox} ${oy} C ${ox + 40} ${oy}, 30 ${epy(i)}, 60 ${epy(i)}`}
                                  stroke={CONNECTOR_COLOR} strokeWidth={CONNECTOR_WIDTH} fill="none"
                                />
                              );
                            })}
                          </svg>
                        </div>
                      )}

                      {/* Branch rows — minHeight so they can grow to fit cards; ResizeObserver feeds heights back into SVG */}
                      <div ref={(el: HTMLDivElement | null) => { if (el) hBranchRowsRefs.current.set(conditionNode.id, el); else hBranchRowsRefs.current.delete(conditionNode.id); }} style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, ...hiddenStyle }}>
                        {/* True (positive) row */}
                        {(() => {
                          const trueEmpty = isEmptyAligned && trueNodes.length === 0;
                          const trueSpacer = trueEmpty ? Math.max(0, condPillOriginYs[0] - 10) : 0;
                          return trueEmpty ? (
                            <div style={{ minHeight: defaultRowH, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                              <div style={{ height: trueSpacer, flexShrink: 0 }} />
                              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                                {isStepTypeVisuals && <div style={{ width: 8, height: CONNECTOR_WIDTH, background: CONNECTOR_COLOR, flexShrink: 0 }} />}
                                {renderBranchConnectorH(workflowNodes.indexOf(conditionNode) + 1, 'true', true, false, true)}
                              </div>
                            </div>
                          ) : (
                            <div style={{ minHeight: defaultRowH, display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                              {isStepTypeVisuals && <div style={{ width: 8, height: CONNECTOR_WIDTH, background: CONNECTOR_COLOR, flexShrink: 0 }} />}
                              {isStepTypeVisuals && <span ref={el => { trueBadgeRef.current = el; }} className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-caption-1-strong rounded-full flex-shrink-0 border border-gray-300" style={{ minWidth: 80, textAlign: 'center' }}>{hPositive}</span>}
                              {trueNodes.length === 0
                                ? renderBranchConnectorH(workflowNodes.indexOf(conditionNode) + 1, 'true', true, false, true)
                                : renderBranchConnectorH(workflowNodes.indexOf(trueNodes[0]), 'true', false, !!nodePositions[trueNodes[0].id], !isStepTypeVisuals)
                              }
                              {trueNodes.map((node, i) => (
                                <React.Fragment key={node.id}>
                                  {i > 0 && renderBranchConnectorH(workflowNodes.indexOf(node), 'true', false, !!nodePositions[trueNodes[i - 1].id] || !!nodePositions[node.id])}
                                  <div className="flex-shrink-0" style={nodePositions[node.id] ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}>{renderFlowSlot(node)}</div>
                                </React.Fragment>
                              ))}
                              {trueNodes.length > 0 && trueNodes[trueNodes.length - 1].type !== 'condition' && renderBranchConnectorH(workflowNodes.indexOf(trueNodes[trueNodes.length - 1]) + 1, 'true', true, !!nodePositions[trueNodes[trueNodes.length - 1].id], false, !!nodePositions[trueNodes[trueNodes.length - 1].id])}
                            </div>
                          );
                        })()}

                        {/* Else If rows */}
                        {hElseIfBranches.map((branch: ElseIfBranch, eiMapIdx: number) => {
                          const eiNodes = workflowNodes.filter(n => n.branch === branch.id && (!n.parentConditionId || n.parentConditionId === conditionNode.id));
                          const eiRowIdx = 1 + eiMapIdx;
                          const eiEmpty = isEmptyAligned && eiNodes.length === 0;
                          const eiSpacer = eiEmpty ? Math.max(0, condPillOriginYs[eiRowIdx] - rowStartY(eiRowIdx) - 10) : 0;
                          return eiEmpty ? (
                            <div key={branch.id} style={{ minHeight: defaultRowH, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                              <div style={{ height: eiSpacer, flexShrink: 0 }} />
                              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                                {isStepTypeVisuals && <div style={{ width: 8, height: CONNECTOR_WIDTH, background: CONNECTOR_COLOR, flexShrink: 0 }} />}
                                {renderBranchConnectorH(workflowNodes.length, branch.id, true, false, true)}
                              </div>
                            </div>
                          ) : (
                            <div key={branch.id} style={{ minHeight: defaultRowH, display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                              {isStepTypeVisuals && <div style={{ width: 8, height: CONNECTOR_WIDTH, background: CONNECTOR_COLOR, flexShrink: 0 }} />}
                              {isStepTypeVisuals && <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-caption-1-strong rounded-full flex-shrink-0 border border-gray-300" style={{ minWidth: 80, textAlign: 'center' }}>{'Else ' + hPositive}</span>}
                              {eiNodes.length === 0
                                ? renderBranchConnectorH(workflowNodes.length, branch.id, true, false, true)
                                : renderBranchConnectorH(workflowNodes.indexOf(eiNodes[0]), branch.id, false, !!nodePositions[eiNodes[0].id], !isStepTypeVisuals)
                              }
                              {eiNodes.map((node, i) => (
                                <React.Fragment key={node.id}>
                                  {i > 0 && renderBranchConnectorH(workflowNodes.indexOf(node), branch.id, false, !!nodePositions[eiNodes[i - 1].id] || !!nodePositions[node.id])}
                                  <div className="flex-shrink-0" style={nodePositions[node.id] ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}>{renderFlowSlot(node)}</div>
                                </React.Fragment>
                              ))}
                              {eiNodes.length > 0 && eiNodes[eiNodes.length - 1].type !== 'condition' && renderBranchConnectorH(workflowNodes.indexOf(eiNodes[eiNodes.length - 1]) + 1, branch.id, true, !!nodePositions[eiNodes[eiNodes.length - 1].id], false, !!nodePositions[eiNodes[eiNodes.length - 1].id])}
                            </div>
                          );
                        })}

                        {/* False (negative) row */}
                        {(() => {
                          const falseRowIdx = totalBranches - 1;
                          const falseEmpty = isEmptyAligned && falseNodes.length === 0;
                          const falseSpacer = falseEmpty ? Math.max(0, condPillOriginYs[falseRowIdx] - rowStartY(falseRowIdx) - 10) : 0;
                          return falseEmpty ? (
                            <div style={{ minHeight: defaultRowH, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                              <div style={{ height: falseSpacer, flexShrink: 0 }} />
                              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                                {isStepTypeVisuals && <div style={{ width: 8, height: CONNECTOR_WIDTH, background: CONNECTOR_COLOR, flexShrink: 0 }} />}
                                {renderBranchConnectorH(workflowNodes.length, 'false', true, false, true)}
                              </div>
                            </div>
                          ) : (
                            <div style={{ minHeight: defaultRowH, display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                              {isStepTypeVisuals && <div style={{ width: 8, height: CONNECTOR_WIDTH, background: CONNECTOR_COLOR, flexShrink: 0 }} />}
                              {isStepTypeVisuals && <span ref={el => { falseBadgeRef.current = el; }} className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-caption-1-strong rounded-full flex-shrink-0 border border-gray-300" style={{ minWidth: 80, textAlign: 'center' }}>{hNegative}</span>}
                              {falseNodes.length === 0
                                ? renderBranchConnectorH(workflowNodes.length, 'false', true, false, true)
                                : renderBranchConnectorH(workflowNodes.indexOf(falseNodes[0]), 'false', false, !!nodePositions[falseNodes[0].id], !isStepTypeVisuals)
                              }
                              {falseNodes.map((node, i) => (
                                <React.Fragment key={node.id}>
                                  {i > 0 && renderBranchConnectorH(workflowNodes.indexOf(node), 'false', false, !!nodePositions[falseNodes[i - 1].id] || !!nodePositions[node.id])}
                                  <div className="flex-shrink-0" style={nodePositions[node.id] ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}>{renderFlowSlot(node)}</div>
                                </React.Fragment>
                              ))}
                              {falseNodes.length > 0 && falseNodes[falseNodes.length - 1].type !== 'condition' && renderBranchConnectorH(workflowNodes.indexOf(falseNodes[falseNodes.length - 1]) + 1, 'false', true, !!nodePositions[falseNodes[falseNodes.length - 1].id], false, !!nodePositions[falseNodes[falseNodes.length - 1].id])}
                            </div>
                          );
                        })()}
                      </div>
                    </>
                      );
                      })()}
                    </>
                  );
                })()}
              </>
            ) : (
              isReattachDragging
                ? renderReattachDropZone(preConditionNodes.length)
                : renderAddConnector(
                    endInsertIndex,
                    true,
                    preConditionNodes.length > 0 && !!nodePositions[preConditionNodes[preConditionNodes.length - 1].id]
                  )
            )}
          </div>
          {/* ── Vertical branch section (only in vertical layout) ── */}
          {!isHorizontal && conditionNode && (
            <>
              {/* Branching lines + columns — hidden when condition node is displaced, or when
                  !isStepTypeVisuals + all branches empty (card handles per-pill + buttons directly).
                  Uses left:50% + translateX(-50%) rather than mx-auto so it always centres on the
                  canvas midpoint even when the fork section is wider than the viewport. */}
              {!((!isStepTypeVisuals) && trueNodes.length === 0 && falseNodes.length === 0 &&
                (conditionNode.config?.elseIfBranches ?? []).every((b: any) => workflowNodes.filter((n: WorkflowNode) => n.branch === b.id && (!n.parentConditionId || n.parentConditionId === conditionNode.id)).length === 0)
              ) && (
                <div
                  ref={!isStepTypeVisuals ? pillConnectContainerRef : undefined}
                  className="flex flex-col relative"
                  style={{ position: 'relative', left: '50%', transform: 'translateX(-50%)', width: 'fit-content', zIndex: 20 }}
                >
                  {/* Per-pill connecting lines overlay — only for !isStepTypeVisuals vertical */}
                  {!isStepTypeVisuals && pillConnectPaths.length > 0 && (
                    <svg
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 20 }}
                      overflow="visible"
                    >
                      {/* Visible connector lines — hovered path turns brand colour */}
                      {pillConnectPaths.map((d, i) => (
                        <path key={i} d={d} stroke={hoveredPillPath === i ? 'hsl(var(--primary))' : CONNECTOR_COLOR} strokeWidth={CONNECTOR_WIDTH} fill="none" strokeLinecap="round" />
                      ))}
                      {/* Start dots are rendered by the HTML pill element itself (DOT_FILL style) */}
                      {pillConnectEndDots.map((dot, i) => (
                        <circle key={i} cx={dot.x} cy={dot.y} r={DOT_SIZE / 2} fill={DOT_FILL_END} stroke={DOT_STROKE_END} strokeWidth={CONNECTOR_WIDTH} />
                      ))}
                    </svg>
                  )}
                  {/* Invisible wide hit-area paths for hover detection on bezier curves */}
                  {!isStepTypeVisuals && pillConnectPaths.length > 0 && (
                    <svg
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 21 }}
                      overflow="visible"
                    >
                      {pillConnectPaths.map((d, i) => {
                        if (!pillConnectMeta[i]) return null;
                        return (
                          <path
                            key={i}
                            d={d}
                            stroke="transparent"
                            strokeWidth={20}
                            fill="none"
                            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                            onMouseEnter={() => setHoveredPillPath(i)}
                            onMouseLeave={() => setHoveredPillPath(null)}
                            onClick={() => {
                              const meta = pillConnectMeta[i];
                              if (meta) openAddStep(meta.insertIdx, meta.branch);
                            }}
                          />
                        );
                      })}
                    </svg>
                  )}
                  {/* Plus button at bezier midpoint when a pill path is hovered */}
                  {!isStepTypeVisuals && hoveredPillPath !== null && pillConnectMeta[hoveredPillPath] != null && (() => {
                    const meta = pillConnectMeta[hoveredPillPath]!;
                    const plusIcon = <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
                    return (
                      <div
                        style={{ position: 'absolute', left: meta.mx, top: meta.my, transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 22 }}
                        onMouseEnter={() => setHoveredPillPath(hoveredPillPath)}
                      >
                        <CopilotButton
                          variant="ghost"
                          size="sm"
                          onClick={() => openAddStep(meta.insertIdx, meta.branch)}
                          icon={plusIcon}
                          className="rounded-full border-2 bg-white transition-all hover:scale-110"
                          style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))', width: 20, height: 20, padding: 0, minWidth: 0, pointerEvents: 'auto' }}
                          title="Add step"
                        />
                      </div>
                    );
                  })()}
                  {renderBranchColumns(false)}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );


  const v23RightPanel = displayedNode && (
    <div className="absolute right-4 top-4 bottom-4 bg-white overflow-hidden z-10 flex flex-col" style={{ width: 380, borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-dropdown)', border: '1px solid hsl(var(--stroke-default))', transition: 'opacity 0.3s ease-out, transform 0.3s ease-out', transitionDelay: mcpPanelExpanded ? '0s' : '0.25s', opacity: mcpPanelExpanded ? 0 : 1, transform: mcpPanelExpanded ? 'translateX(24px)' : 'translateX(0)', pointerEvents: mcpPanelExpanded ? 'none' : undefined }}>
        <div className="flex-shrink-0 bg-white" style={{ padding: '12px 16px' }}>
          {stepHitlDrillIn ? (
            /* ── "Who to notify" drill-in header ── */
            <div className="flex items-center gap-2 mb-3">
              <CopilotButton variant="ghost" size="sm" className="p-1 flex-shrink-0 text-gray-500 hover:text-gray-900" onClick={() => { setStepHitlDrillIn(false); setStepHitlAddOpen(false); setStepHitlEditingId(null); }}>
                {panelChevronLeft}
              </CopilotButton>
              <h2 className="text-body-1-strong text-gray-900 flex-1">Who to notify</h2>
              <CopilotButton variant="ghost" size="sm" onClick={() => setSelectedNode(null)} className="text-gray-600 hover:text-gray-900 p-2"><Dismiss20Regular /></CopilotButton>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="flex-shrink-0">{getNodeIcon(displayedNode)}</div>
                  {version === 1 && displayedNode.type !== 'trigger' ? (
                    (() => {
                      // For Agent/CUA/MCP nodes the user-given name lives in config.instanceName;
                      // for all other nodes it lives in node.label.
                      const hasInstanceName = !!displayedNode.config?.stepTypeLabel;
                      const currentName = hasInstanceName
                        ? (displayedNode.config?.instanceName ?? '')
                        : displayedNode.label;
                      const placeholder = displayedNode.config?.stepTypeLabel ?? displayedNode.label;

                      const commitEdit = (value: string) => {
                        if (cancelByEscapeRef.current) { cancelByEscapeRef.current = false; return; }
                        const trimmed = value.trim();
                        // Fall back to currentName then placeholder to avoid persisting an empty string.
                        const effectiveName = trimmed || currentName || placeholder;
                        if (hasInstanceName) {
                          patchNode(displayedNode.id, { config: { ...displayedNode.config, instanceName: effectiveName } });
                        } else {
                          renameNode(displayedNode.id, effectiveName);
                        }
                        setIsEditingPanelTitle(false);
                      };
                      commitEditRef.current = commitEdit;

                      return isEditingPanelTitle ? (
                        <CopilotInput
                          autoFocus
                          appearance="underline"
                          size="sm"
                          className="flex-1 min-w-0"
                          value={panelTitleValue}
                          placeholder={placeholder}
                          onChange={e => setPanelTitleValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              commitEdit(panelTitleValue);
                            } else if (e.key === 'Escape') {
                              // Mark as cancelled so the subsequent blur does not commit.
                              cancelByEscapeRef.current = true;
                              e.preventDefault();
                              setIsEditingPanelTitle(false);
                            }
                          }}
                          onBlur={() => commitEdit(panelTitleValue)}
                        />
                      ) : (
                        <h2
                          className="text-body-2-strong text-gray-900 cursor-text truncate hover:text-gray-600 transition-colors"
                          title="Click to rename"
                          role="button"
                          tabIndex={0}
                          aria-label={currentName ? `Rename step title ${currentName}` : 'Rename step title'}
                          onClick={() => { setPanelTitleValue(currentName); setIsEditingPanelTitle(true); }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setPanelTitleValue(currentName);
                              setIsEditingPanelTitle(true);
                            }
                          }}
                        >
                          {currentName || placeholder}
                        </h2>
                      );
                    })()
                  ) : (
                    <h2 className="text-body-1-strong text-gray-900 truncate">
                      {displayedNode.config?.stepTypeLabel ?? displayedNode.label}
                    </h2>
                  )}
                </div>
                <div className="flex items-center gap-0">
                  {isEditingPanelTitle ? (
                    <CopilotButton variant="ghost" size="sm" onMouseDown={e => e.preventDefault()} onClick={() => commitEditRef.current?.(panelTitleValue)} className="text-gray-600 hover:text-gray-900 p-2 flex-shrink-0"><Checkmark20Regular /></CopilotButton>
                  ) : (
                    <>
                      <CopilotButton variant="ghost" size="sm" onClick={openMcpModal} className="text-gray-400 hover:text-gray-700 p-2" title="Expand"><ArrowMaximize20Regular /></CopilotButton>
                      <CopilotButton variant="ghost" size="sm" onClick={() => setSelectedNode(null)} className="text-gray-600 hover:text-gray-900 p-2 flex-shrink-0"><Dismiss20Regular /></CopilotButton>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="flex gap-2">
                  <CopilotButton variant={rightPanelTab === 'configure' ? 'secondary' : 'ghost'} size="sm" onClick={() => setRightPanelTab('configure')} className={`px-3 py-1.5 rounded-full text-caption-1-strong ${rightPanelTab !== 'configure' ? 'text-gray-500 hover:text-gray-700 transition-colors' : ''}`}>Configure</CopilotButton>
                  <CopilotTooltip content="You can test once you finish configuring the step" placement="bottom" disabled={isStepConfigured(displayedNode)}>
                    <CopilotButton variant={rightPanelTab === 'test' ? 'secondary' : 'ghost'} size="sm" onClick={() => { if (isStepConfigured(displayedNode)) setRightPanelTab('test'); }} disabled={!isStepConfigured(displayedNode)} className={`px-3 py-1.5 rounded-full text-caption-1-strong ${rightPanelTab !== 'test' ? 'text-gray-500 hover:text-gray-700 transition-colors' : ''}`}>Test</CopilotButton>
                  </CopilotTooltip>
                </div>
            {rightPanelTab === 'test' && mcpSimResults && (
              <div className="flex items-center bg-gray-100 rounded-md p-0.5 animate-slide-up-fade">
                <CopilotButton variant="ghost" size="sm" onClick={() => setMcpSimTab('success')} className={`flex items-center gap-1.5 text-caption-1 px-2.5 py-1 rounded transition-colors ${mcpSimTab === 'success' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4.5" fill={mcpSimTab === 'success' ? '#16a34a' : '#d1d5db'}/><path d="M2.5 5.5l1.5 1.5 3-3" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Success
                </CopilotButton>
                <CopilotButton variant="ghost" size="sm" onClick={() => setMcpSimTab('fail')} className={`flex items-center gap-1.5 text-caption-1 px-2.5 py-1 rounded transition-colors ${mcpSimTab === 'fail' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4.5" fill={mcpSimTab === 'fail' ? '#dc2626' : '#d1d5db'}/><path d="M3 3l4 4M7 3l-4 4" stroke="white" strokeWidth="1.3" strokeLinecap="round"/></svg>
                  Fail
                </CopilotButton>
              </div>
            )}
              </div>
            </>
          )}
          <div className="border-b border-gray-200 -mx-4 mt-3" />
        </div>
        {/* Scrollable body */}
        <div ref={rightPanelScrollRef} className="overflow-y-auto overflow-x-hidden flex-1" style={{ padding: '16px 16px 24px' }}>
          {stepHitlDrillIn ? (
            /* ── Who to notify drill-in body ── */
            <div className="space-y-2">
              {/* Contact list */}
              {(displayedNode.hitlContacts ?? []).length === 0 && !stepHitlAddOpen && (
                <p className="text-caption-1 text-gray-400 py-2">No contacts added yet.</p>
              )}
              {(displayedNode.hitlContacts ?? []).map((c, i) => (
                <div key={c.id} className="rounded-2xl border border-gray-200 overflow-hidden">
                  {stepHitlEditingId === c.id ? (
                    <div className="px-3 py-3 space-y-2">
                      <p className="text-body-2-strong text-gray-900">{c.name}</p>
                      <div className="flex items-center gap-2">
                        <CopilotButton variant="ghost" size="sm" onClick={() => setStepHitlEditNotifyVia('email')} className={`gap-1.5 border text-caption-1 ${stepHitlEditNotifyVia === 'email' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}><Mail20Regular style={{ width: 14, height: 14 }} />Email</CopilotButton>
                        <CopilotButton variant="ghost" size="sm" onClick={() => setStepHitlEditNotifyVia('teams')} className={`gap-1.5 border text-caption-1 ${stepHitlEditNotifyVia === 'teams' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}><img src="/component-icons/Teams16.svg" alt="Teams" style={{ width: 14, height: 14 }} />Teams</CopilotButton>
                      </div>
                      {stepHitlEditNotifyVia === 'email' && <CopilotInput size="sm" placeholder="email@contoso.com" value={stepHitlEditEmail} onChange={e => setStepHitlEditEmail(e.target.value)} />}
                      <div className="flex gap-2 justify-end">
                        <CopilotButton variant="secondary" size="sm" onClick={() => setStepHitlEditingId(null)}>Cancel</CopilotButton>
                        <CopilotButton variant="primary" size="sm" onClick={() => saveStepHitlEdit(displayedNode.id, c.id)}>Save</CopilotButton>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: HITL_COLORS[i % HITL_COLORS.length] }}>
                        <span className="text-white font-semibold" style={{ fontSize: 11 }}>{getHitlInitials(c.name)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-body-2-strong text-gray-900 truncate">{c.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {c.notifyVia === 'teams' ? (
                            <><img src="/component-icons/Teams16.svg" alt="Teams" style={{ width: 16, height: 16, flexShrink: 0 }} /><span className="text-caption-1 truncate" style={{ color: '#5B5FC7' }}>{c.email ? c.email.split('@')[0] : c.name.toLowerCase().replace(/\s+/g, '.')}</span></>
                          ) : (
                            <><Mail20Regular style={{ width: 12, height: 12, color: '#6b7280', flexShrink: 0 }} /><span className="text-caption-1 truncate" style={{ color: '#5B5FC7' }}>{c.email ?? c.name.toLowerCase().replace(/\s+/g, '.') + '@contoso.com'}</span></>
                          )}
                        </div>
                      </div>
                      <CopilotButton variant="ghost" size="sm" className="w-9 h-9 p-0 flex-shrink-0 text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="More options"
                        onClick={e => { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); setStepHitlContactMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right }); setStepHitlContactMenuId(c.id); }}>
                        <MoreHorizontal32Filled style={{ width: 28, height: 28 }} />
                      </CopilotButton>
                    </div>
                  )}
                </div>
              ))}

              {/* Overflow menu for contact actions */}
              {stepHitlContactMenuId && (
                <CopilotMenu
                  position={stepHitlContactMenuPos}
                  onClose={() => setStepHitlContactMenuId(null)}
                  items={[
                    { label: 'Edit', icon: <Edit20Regular style={{ width: 16, height: 16 }} />, onClick: () => { const c = (displayedNode.hitlContacts ?? []).find(x => x.id === stepHitlContactMenuId); if (c) { setStepHitlEditingId(c.id); setStepHitlEditNotifyVia(c.notifyVia); setStepHitlEditEmail(c.email ?? ''); } setStepHitlContactMenuId(null); } },
                    { label: 'Delete', icon: <Delete20Regular style={{ width: 16, height: 16 }} />, destructive: true, dividerAbove: true, onClick: () => { removeStepHitlContact(displayedNode.id, stepHitlContactMenuId); setStepHitlContactMenuId(null); } },
                  ]}
                />
              )}

              {/* Add person form */}
              {stepHitlAddOpen ? (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/30 px-3 py-3 space-y-2 mt-1">
                  {stepHitlAddPhase === 'search' ? (
                    <>
                      <p className="text-caption-1-strong text-gray-700">Add person</p>
                      <div className="relative">
                        <CopilotInput size="sm" placeholder="Search by name…" value={stepHitlName}
                          onChange={e => setStepHitlName(e.target.value)} autoFocus />
                        {stepHitlName.trim().length > 0 && MOCK_DIRECTORY.filter(d => d.name.toLowerCase().includes(stepHitlName.toLowerCase().trim())).length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                            {MOCK_DIRECTORY.filter(d => d.name.toLowerCase().includes(stepHitlName.toLowerCase().trim())).map(d => (
                              <div key={d.name} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2.5"
                                onMouseDown={e => { e.preventDefault(); setStepHitlName(d.name); setStepHitlEmail(d.email ?? ''); setStepHitlAddPhase('channel'); }}>
                                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'hsl(var(--primary)/0.12)' }}>
                                  <span className="font-semibold" style={{ fontSize: 9, color: 'hsl(var(--primary))' }}>{getHitlInitials(d.name)}</span>
                                </div>
                                <span className="text-body-2 text-gray-900">{d.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 justify-end">
                        <CopilotButton variant="secondary" size="sm" onClick={() => { setStepHitlAddOpen(false); setStepHitlName(''); setStepHitlEmail(''); setStepHitlAddPhase('search'); }}>Cancel</CopilotButton>
                        <CopilotButton variant="primary" size="sm" disabled={!stepHitlName.trim()} onClick={() => { const found = MOCK_DIRECTORY.find(d => d.name.toLowerCase() === stepHitlName.trim().toLowerCase()); setStepHitlEmail(found?.email ?? ''); setStepHitlAddPhase('channel'); }}>Next</CopilotButton>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-caption-1-strong text-gray-700">Notify via</p>
                      <div className="flex items-center gap-2">
                        <CopilotButton variant="ghost" size="sm" onClick={() => setStepHitlNotifyVia('email')} className={`gap-1.5 border text-caption-1 ${stepHitlNotifyVia === 'email' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}><Mail20Regular style={{ width: 14, height: 14 }} />Email</CopilotButton>
                        <CopilotButton variant="ghost" size="sm" onClick={() => setStepHitlNotifyVia('teams')} className={`gap-1.5 border text-caption-1 ${stepHitlNotifyVia === 'teams' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}><img src="/component-icons/Teams16.svg" alt="Teams" style={{ width: 14, height: 14 }} />Teams</CopilotButton>
                      </div>
                      {stepHitlNotifyVia === 'email' && <CopilotInput size="sm" placeholder="email@contoso.com" value={stepHitlEmail} onChange={e => setStepHitlEmail(e.target.value)} />}
                      <div className="flex gap-2 justify-end">
                        <CopilotButton variant="secondary" size="sm" onClick={() => setStepHitlAddPhase('search')}>Back</CopilotButton>
                        <CopilotButton variant="primary" size="sm" onClick={() => addStepHitlContact(displayedNode.id)}>Add</CopilotButton>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <CopilotButton variant="secondary" size="sm" className="w-full mt-1" onClick={() => { setStepHitlAddOpen(true); setStepHitlAddPhase('search'); }}>
                  <Add20Regular style={{ width: 16, height: 16 }} />
                  Add person
                </CopilotButton>
              )}

              {/* If no response */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p id="step-hitl-no-response-label" className="text-caption-1-strong text-gray-700 mb-3">If no response</p>
                <div className="space-y-2" role="radiogroup" aria-labelledby="step-hitl-no-response-label">
                  {([
                    { value: 'nothing', label: 'Do nothing', description: 'Keep waiting until someone responds' },
                    { value: 'reminder', label: 'Send a reminder', description: 'Ping the same contacts again' },
                    { value: 'escalate', label: 'Notify someone else', description: 'Escalate to a backup contact' },
                  ] as const).map(opt => (
                    <div key={opt.value}>
                      <div
                        role="radio"
                        tabIndex={0}
                        aria-checked={stepHitlNoResponse === opt.value}
                        onClick={() => setStepHitlNoResponse(opt.value)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); setStepHitlNoResponse(opt.value); } }}
                        className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-2xl border cursor-pointer transition-colors ${stepHitlNoResponse === opt.value ? 'border-indigo-500 bg-indigo-50/40' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${stepHitlNoResponse === opt.value ? 'border-indigo-500' : 'border-gray-300'}`}>
                          {stepHitlNoResponse === opt.value && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                        </div>
                        <div>
                          <p className="text-body-2-strong text-gray-900">{opt.label}</p>
                          <p className="text-caption-1 text-gray-400 mt-0.5">{opt.description}</p>
                        </div>
                      </div>
                      {opt.value === 'escalate' && stepHitlNoResponse === 'escalate' && (
                        <div className="mt-2 space-y-2">
                          {stepHitlEscalateContacts.map((c, i) => (
                            <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-gray-200">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: HITL_COLORS[i % HITL_COLORS.length] }}>
                                <span className="text-white font-semibold" style={{ fontSize: 10 }}>{getHitlInitials(c.name)}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-body-2-strong text-gray-900 truncate">{c.name}</p>
                                <p className="text-caption-1 text-gray-400 truncate">{c.notifyVia === 'teams' ? 'via Teams' : c.email ?? 'via Email'}</p>
                              </div>
                              <CopilotButton variant="ghost" size="sm" className="p-1 text-gray-400 hover:text-red-500" onClick={() => setStepHitlEscalateContacts(prev => prev.filter(x => x.id !== c.id))} title="Remove"><Delete20Regular style={{ width: 14, height: 14 }} /></CopilotButton>
                            </div>
                          ))}
                          {stepHitlEscalateAddOpen ? (
                            <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 px-3 py-3 space-y-2">
                              {stepHitlEscalateAddPhase === 'search' ? (
                                <>
                                  <div className="relative">
                                    <CopilotInput size="sm" placeholder="Search by name…" value={stepHitlEscalateName} onChange={e => setStepHitlEscalateName(e.target.value)} autoFocus />
                                    {stepHitlEscalateName.trim().length > 0 && MOCK_DIRECTORY.filter(d => d.name.toLowerCase().includes(stepHitlEscalateName.toLowerCase().trim())).length > 0 && (
                                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                                        {MOCK_DIRECTORY.filter(d => d.name.toLowerCase().includes(stepHitlEscalateName.toLowerCase().trim())).map(d => (
                                          <div key={d.name} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2.5"
                                            onMouseDown={e => { e.preventDefault(); setStepHitlEscalateName(d.name); setStepHitlEscalateEmail(d.email ?? ''); setStepHitlEscalateAddPhase('channel'); }}>
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'hsl(var(--primary)/0.12)' }}>
                                              <span className="font-semibold" style={{ fontSize: 9, color: 'hsl(var(--primary))' }}>{getHitlInitials(d.name)}</span>
                                            </div>
                                            <span className="text-body-2 text-gray-900">{d.name}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <CopilotButton variant="secondary" size="sm" onClick={() => { setStepHitlEscalateAddOpen(false); setStepHitlEscalateName(''); setStepHitlEscalateAddPhase('search'); }}>Cancel</CopilotButton>
                                    <CopilotButton variant="primary" size="sm" disabled={!stepHitlEscalateName.trim()} onClick={() => { const found = MOCK_DIRECTORY.find(d => d.name.toLowerCase() === stepHitlEscalateName.trim().toLowerCase()); setStepHitlEscalateEmail(found?.email ?? ''); setStepHitlEscalateAddPhase('channel'); }}>Next</CopilotButton>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <p className="text-caption-1-strong text-gray-700">Notify via</p>
                                  <div className="flex items-center gap-2">
                                    <CopilotButton variant="ghost" size="sm" onClick={() => setStepHitlEscalateNotifyVia('email')} className={`gap-1.5 border text-caption-1 ${stepHitlEscalateNotifyVia === 'email' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}><Mail20Regular style={{ width: 14, height: 14 }} />Email</CopilotButton>
                                    <CopilotButton variant="ghost" size="sm" onClick={() => setStepHitlEscalateNotifyVia('teams')} className={`gap-1.5 border text-caption-1 ${stepHitlEscalateNotifyVia === 'teams' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}><img src="/component-icons/Teams16.svg" alt="Teams" style={{ width: 14, height: 14 }} />Teams</CopilotButton>
                                  </div>
                                  {stepHitlEscalateNotifyVia === 'email' && <CopilotInput size="sm" placeholder="email@contoso.com" value={stepHitlEscalateEmail} onChange={e => setStepHitlEscalateEmail(e.target.value)} />}
                                  <div className="flex gap-2 justify-end">
                                    <CopilotButton variant="secondary" size="sm" onClick={() => setStepHitlEscalateAddPhase('search')}>Back</CopilotButton>
                                    <CopilotButton variant="primary" size="sm" onClick={() => { if (!stepHitlEscalateName.trim()) return; setStepHitlEscalateContacts(prev => [...prev, { id: `step-esc-${Date.now()}`, name: stepHitlEscalateName.trim(), email: stepHitlEscalateEmail || undefined, notifyVia: stepHitlEscalateNotifyVia }]); setStepHitlEscalateAddOpen(false); setStepHitlEscalateName(''); setStepHitlEscalateEmail(''); setStepHitlEscalateAddPhase('search'); }}>Add</CopilotButton>
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            <CopilotButton variant="secondary" size="sm" className="w-full" onClick={() => { setStepHitlEscalateAddOpen(true); setStepHitlEscalateAddPhase('search'); }}>
                              <Add20Regular style={{ width: 16, height: 16 }} />
                              Add backup contact
                            </CopilotButton>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : rightPanelTab === 'configure' && (<>
            {version !== 1 && displayedNode.type !== 'trigger' && displayedNode.label !== 'MCP' && displayedNode.label !== 'Computer Use' && displayedNode.label !== 'Agent' && (
              <CopilotInput label="Name" defaultValue={displayedNode.label} key={displayedNode.id}
                onKeyDown={e => { if (e.key === 'Enter') { renameNode(displayedNode.id, (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).blur(); } else { dismissBailBanner(displayedNode.id); } }}
                onBlur={e => renameNode(displayedNode.id, e.target.value)} className="mb-4"
              />
            )}
            {renderNodeDetails(displayedNode)}
          </>)}
          {rightPanelTab === 'test' && displayedNode.label !== 'MCP' && (
            <div className="flex flex-col items-center text-center gap-4 py-8">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <Flash24Filled style={{ width: 20, height: 20, color: '#9ca3af' }} />
              </div>
              <div>
                <p className="text-body-2-strong text-gray-800 mb-1">Test this step</p>
                <p className="text-caption-1 text-gray-400">Provide sample inputs and run a test to see how this step performs.</p>
              </div>
              <CopilotButton variant="action-brand" size="md" className="w-full justify-center" disabled>Run test</CopilotButton>
            </div>
          )}
          {rightPanelTab === 'test' && displayedNode.label === 'MCP' && (() => {
            const segs = mcpSegments[displayedNode.id] ?? [];
            const pills = segs.flatMap(s => {
              if (s.type === 'pill') return [{ key: `pill::${s.nodeLabel}::${s.output}`, label: s.output, nodeLabel: s.nodeLabel, nodeConnector: s.nodeConnector }];
              if (s.type === 'power-fx-pill') return [{ key: `fx::${s.label}`, label: `fx: ${s.label}`, nodeLabel: null as string | null, nodeConnector: undefined as string | undefined }];
              return [];
            }).filter((p, i, arr) => arr.findIndex(x => x.key === p.key) === i);
            const sampleInputs = mcpSampleInputs[displayedNode.id] ?? {};
            const setSampleInput = (key: string, value: string) =>
              setMcpSampleInputs(prev => ({ ...prev, [displayedNode.id]: { ...(prev[displayedNode.id] ?? {}), [key]: value } }));

            const handleMcpTest = async () => {
              const nodeId = displayedNode.id;
              const mcpName = displayedNode.label ?? 'MCP';

              const successSteps = [
                { title: 'Authenticating with Microsoft Outlook' },
                { title: 'Resolving recipient', description: 'alex.turner@contoso.com — mailbox verified ✓' },
                { title: 'Composing email', description: 'Subject: Q3 Budget Review — Action Required\nTo: alex.turner@contoso.com\nBody: 312 characters' },
                { title: 'Sending via Microsoft Graph API' },
                { title: 'Delivery confirmed', description: 'Message ID: MSG-20240311-7842 · Delivered in 284ms' },
              ];

              // Use same node ID as success so DACoTNodeRow stays mounted
              // and transitions in-place from loading→completed without a remount
              const loadingNode: DANode = {
                id: 'mcp-outlook-success',
                type: 'agent',
                name: mcpName,
                status: 'loading',
                steps: successSteps,
              };
              setMcpTestState(prev => ({ ...prev, [nodeId]: { loading: true, nodes: [loadingNode], response: null } }));
              setMcpSimResults(null);
              setMcpSimTab('success');

              setMcpSampleCollapsed(true);
              setMcpInputsExpanded(false);

              // Delay long enough for all 5 steps to animate through
              setTimeout(() => {
                const successNodes: DANode[] = [{
                  id: 'mcp-outlook-success',
                  type: 'agent',
                  name: mcpName,
                  status: 'completed',
                  steps: successSteps,
                }];
                const failNodes: DANode[] = [{
                  id: 'mcp-outlook-fail',
                  type: 'agent',
                  name: mcpName,
                  status: 'completed',
                  steps: [
                    { title: 'Authenticating with Microsoft Outlook' },
                    { title: 'Resolving recipient', description: 'finance-all@contoso.com — distribution list' },
                    { title: 'Composing email', description: 'Subject: Q3 Budget Review — Action Required' },
                    { title: 'Sending via Microsoft Graph API' },
                    { title: 'Delivery failed — Error 550', description: 'Recipient mailbox quota exceeded (50 GB limit). The message could not be delivered to finance-all@contoso.com. Please contact the mailbox owner or try again later.' },
                  ],
                }];
                const successResponse = JSON.stringify({
                  status: 'sent',
                  messageId: 'MSG-20240311-7842',
                  recipient: 'alex.turner@contoso.com',
                  subject: 'Q3 Budget Review — Action Required',
                  deliveredAt: '2024-03-11T14:23:07Z',
                  latencyMs: 284,
                }, null, 2);
                setMcpTestState(prev => ({ ...prev, [nodeId]: { loading: false, nodes: successNodes, response: successResponse, success: true } }));
                setMcpSimResults({ success: { nodes: successNodes, response: successResponse }, fail: { nodes: failNodes } });
              }, 3500);
            };

            const testState = mcpTestState[displayedNode.id];

            // Single display state: during loading use testState, after done use sim tab state.
            // This keeps one McpTestResults instance mounted throughout so DACoTNodeRow
            // transitions in-place (loading→completed) without a jarring remount.
            const activeTestState = testState && (mcpSimResults
              ? (mcpSimTab === 'success'
                  ? { loading: false, nodes: mcpSimResults.success.nodes, response: mcpSimResults.success.response, success: true }
                  : { loading: false, nodes: mcpSimResults.fail.nodes, response: null, success: false })
              : testState);

            if (pills.length === 0) {
              return (
                <div className="flex flex-col gap-4">
                  {activeTestState && (
                    <McpTestResults
                      testState={activeTestState}
                      agentName={displayedNode.label ?? 'MCP'}
                      onNodeAsk={handleNodeAsk}
                    />
                  )}
                  {!testState?.loading && (
                    <CopilotButton variant="action-brand" size="md" onClick={handleMcpTest} className="w-full justify-center">
                      Run test
                    </CopilotButton>
                  )}
                </div>
              );
            }
            const pillsEl = (expanded: boolean) => pills.map(pill => {
                const iconSrc = pill.nodeConnector ? getConnectorIconSrc(pill.nodeConnector) : null;
                const stepIcon = !iconSrc && pill.nodeLabel ? ALL_STEPS.find(s => s.label === pill.nodeLabel)?.icon : null;
                const hasIcon = !!(iconSrc || stepIcon);
                const pillBadge = (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'hsl(var(--primary)/.08)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary)/.2)', padding: `1px 6px 1px ${hasIcon ? '4px' : '7px'}`, borderRadius: 9999, fontSize: 11, fontWeight: 500, lineHeight: 1.6, userSelect: 'none', flexShrink: 0 }}>
                    {iconSrc && <img src={iconSrc} style={{ width: 13, height: 13, borderRadius: 2, flexShrink: 0, display: 'block' }} alt="" />}
                    {!iconSrc && stepIcon && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', width: 13, height: 13, flexShrink: 0, overflow: 'hidden' }}>
                        <span style={{ transform: 'scale(0.54)', transformOrigin: 'center', display: 'flex', flexShrink: 0 }}>{stepIcon as React.ReactNode}</span>
                      </span>
                    )}
                    <span>{pill.label}</span>
                  </span>
                );
                if (!expanded) return <React.Fragment key={pill.key}>{pillBadge}</React.Fragment>;
                return (
                  <div key={pill.key} className="flex flex-col gap-1.5">
                    <div className="self-start">{pillBadge}</div>
                    <CopilotTextarea
                      placeholder="Enter sample value…"
                      value={sampleInputs[pill.key] ?? ''}
                      onChange={e => setSampleInput(pill.key, (e.target as HTMLTextAreaElement).value)}
                      style={{ resize: 'vertical', minHeight: 72 }}
                    />
                  </div>
                );
              });

            const inputsTableEl = (
              <div>
                <CopilotButton
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1.5 mb-2 group p-0 h-auto min-w-0"
                  onClick={() => setMcpInputsExpanded(v => !v)}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`text-gray-400 transition-transform flex-shrink-0 ${mcpInputsExpanded ? 'rotate-90' : ''}`}>
                    <path d="M4 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-caption-1-strong text-gray-500 group-hover:text-gray-700 transition-colors">Inputs</span>
                </CopilotButton>
                {mcpInputsExpanded && <CopilotTable
                  size="sm"
                  className="w-full text-caption-1"
                  columns={[
                    {
                      key: 'pill',
                      label: 'Name',
                      width: '50%',
                      render: (_val, row) => {
                        const iconSrc = row.nodeConnector ? getConnectorIconSrc(row.nodeConnector) : null;
                        const stepIcon = !iconSrc && row.nodeLabel ? ALL_STEPS.find(s => s.label === row.nodeLabel)?.icon : null;
                        const hasIcon = !!(iconSrc || stepIcon);
                        return (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'hsl(var(--primary)/.08)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary)/.2)', padding: `1px 6px 1px ${hasIcon ? '4px' : '7px'}`, borderRadius: 9999, fontSize: 11, fontWeight: 500, lineHeight: 1.6, userSelect: 'none' }}>
                            {iconSrc && <img src={iconSrc} style={{ width: 13, height: 13, borderRadius: 2, flexShrink: 0, display: 'block' }} alt="" />}
                            {!iconSrc && stepIcon && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', width: 13, height: 13, flexShrink: 0, overflow: 'hidden' }}>
                                <span style={{ transform: 'scale(0.54)', transformOrigin: 'center', display: 'flex', flexShrink: 0 }}>{stepIcon as React.ReactNode}</span>
                              </span>
                            )}
                            <span>{row.label}</span>
                          </span>
                        );
                      },
                    },
                    {
                      key: 'value',
                      label: 'Value',
                      render: (_val, row) => (
                        <span className="font-mono text-gray-700 break-all">
                          {sampleInputs[row.key] ?? <span className="text-gray-300 italic">—</span>}
                        </span>
                      ),
                    },
                  ]}
                  data={pills}
                />}
              </div>
            );

            return (
              <div className="flex flex-col gap-4">
                {/* Sample inputs — full form before test, collapsed table after */}
                {!mcpSampleCollapsed ? (
                  <>
                    <div>
                      <p className="text-body-2-strong text-gray-900 mb-1">Sample inputs</p>
                      <p className="text-caption-1 text-gray-400">Provide values for each dynamic value in your instructions.</p>
                    </div>
                    <div className="flex flex-col gap-3">{pillsEl(true)}</div>
                    <CopilotButton variant="action-brand" size="md" className="w-full justify-center" onClick={handleMcpTest}>
                      Run test
                    </CopilotButton>
                  </>
                ) : (
                  inputsTableEl
                )}
                {activeTestState && (
                  <McpTestResults testState={activeTestState} agentName={displayedNode.label ?? 'MCP'} />
                )}
                {mcpSampleCollapsed && !testState?.loading && (
                  <CopilotButton variant="action-brand" size="md" className="w-full justify-center" onClick={() => {
                    setMcpSampleCollapsed(false);
                    setMcpSimResults(null);
                    setMcpTestState(prev => { const next = { ...prev }; delete next[displayedNode.id]; return next; });
                  }}>
                    Test again
                  </CopilotButton>
                )}
              </div>
            );
          })()}
        </div>
    </div>
  );

  // Show escalation warning after a short delay so it doesn't feel immediate
  useEffect(() => {
    if (hitlNoResponse === 'escalate' && hitlEscalateContacts.length === 0) {
      const t = setTimeout(() => setHitlEscalateWarnVisible(true), 2500);
      return () => clearTimeout(t);
    } else {
      setHitlEscalateWarnVisible(false);
    }
  }, [hitlNoResponse, hitlEscalateContacts]);


  // ─── Render ───────────────────────────────────────────────────────────────
  if (version === 1 || version === 2) {
    return (
      <div className="relative h-full overflow-hidden" style={BG_STYLE}>
        {/* V2: backdrop handled by v2PaletteModal overlay */}
        {/* Canvas */}
        <div
          ref={canvasContainerRef}
          className="absolute inset-0 overflow-hidden"
          style={{ cursor: connectingFromId ? 'crosshair' : isPanning || draggingNodeId ? 'grabbing' : 'grab' }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasStopPan}
          onMouseLeave={handleCanvasStopPan}
          onDragOver={e => { if (draggedStep) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
          onDrop={handleCanvasDrop}
        >
          <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, transformOrigin: version === 2 ? 'calc(50% - 198px) center' : 'center center', paddingRight: version === 2 ? 396 : undefined, transition: isPanning || draggingNodeId ? 'none' : 'transform 0.15s ease-out' }} ref={canvasTransformRef}>
            {/* SVG overlay for dynamic connector lines + live connection drag line */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
              {/* Live dashed line while dragging a connection handle (V1 only) */}
              {version === 1 && connectingFromId && connectLineEnd && (() => {
                const floatingNode = floatingNodes.find(n => n.id === connectingFromId);
                if (!floatingNode) return null;
                const hw = containerHalfRef.current.w, hh = containerHalfRef.current.h;
                const startCanvasY = floatingNode.y + (connectingSide === 'bottom' ? 34 : -34);
                const x1 = floatingNode.x + hw, y1 = startCanvasY + hh;
                const x2 = connectLineEnd.x + hw, y2 = connectLineEnd.y + hh;
                const cy = Math.max(40, Math.abs(y2 - y1) * 0.4);
                return (
                  <path
                    d={`M ${x1} ${y1} C ${x1} ${y1 + cy}, ${x2} ${y2 - cy}, ${x2} ${y2}`}
                    stroke="hsl(var(--primary))"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                    fill="none"
                   
                  />
                );
              })()}
            </svg>
            {canvasNodes}
            {/* SVG overlay for displaced connector beziers — rendered AFTER canvasNodes so lines
                appear on top of all cards (including the branch step card whose pill is the source). */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', zIndex: 20 }}>
              {connections
                .filter(({ fromId, toId }) => {
                  // Badge→branch connections: check these first before the generic displaced check
                  // so we can suppress the vertical case where pill SVG handles it.
                  const badgeMatch = fromId.match(/^__(?:true_badge|false_badge|ei_badge_\d+)__(.+)__$/);
                  if (badgeMatch) {
                    const owningCondId = badgeMatch[1];
                    // When condition itself is displaced: vertical uses floating branch-columns div,
                    // horizontal uses SVG overlay.
                    if (nodePositions[owningCondId]) return isHorizontal;
                    // When first branch node is displaced: vertical uses pill SVG overlay (tracks card live);
                    // horizontal uses the main SVG overlay.
                    if (nodePositions[toId]) return isHorizontal;
                    return false;
                  }
                  // Draw SVG overlay when either end is displaced (non-badge connections).
                  if (nodePositions[fromId] || nodePositions[toId]) return true;
                  return false;
                })
                .map(({ fromId, toId }) => {
                  const from = nodeSvgPos[fromId];
                  const to = nodeSvgPos[toId];
                  if (!from || !to) return null;
                  let d: string;
                  if (isHorizontal) {
                    // Horizontal: lines go left-to-right; exit right edge of source, enter left edge of dest
                    const x1 = from.x + from.halfW;
                    const y1 = from.y;
                    const x2 = to.x - to.halfW;
                    const y2 = to.y;
                    const cx = Math.max(40, Math.abs(x2 - x1) * 0.4);
                    d = `M ${x1} ${y1} C ${x1 + cx} ${y1}, ${x2 - cx} ${y2}, ${x2} ${y2}`;
                  } else {
                    // Vertical: lines go top-to-bottom; exit bottom of source, enter top of dest
                    const x1 = from.x, y1 = from.y + from.halfH;
                    const x2 = to.x,   y2 = to.y - to.halfH;
                    const cy = Math.max(40, Math.abs(y2 - y1) * 0.4);
                    d = `M ${x1} ${y1} C ${x1} ${y1 + cy}, ${x2} ${y2 - cy}, ${x2} ${y2}`;
                  }
                  const key = `${fromId}-${toId}`;
                  const isHovered = hoveredConnection === key;
                  return (
                    <g key={key} style={{ pointerEvents: nodeMenuOpen ? 'none' : 'stroke' }}>
                      {/* Thick transparent path for easy hover detection */}
                      <path d={d} stroke="transparent" strokeWidth="16" fill="none"
                        style={{ pointerEvents: nodeMenuOpen ? 'none' : 'stroke', cursor: 'default' }}
                        onMouseEnter={() => setHoveredConnection(key)}
                        onMouseLeave={() => setHoveredConnection(null)}
                      />
                      <path d={d} stroke={isHovered ? 'hsl(var(--primary))' : CONNECTOR_COLOR}
                        strokeWidth={CONNECTOR_WIDTH} fill="none"
                        style={{ pointerEvents: 'none' }}
                      />
                    </g>
                  );
                })}
            </svg>
            {/* + buttons at midpoint of each displaced connection line */}
            {connections
              .filter(({ fromId, toId }) => {
                const badgeMatch = fromId.match(/^__(?:true_badge|false_badge|ei_badge_\d+)__(.+)__$/);
                if (badgeMatch) {
                  const owningCondId = badgeMatch[1];
                  if (nodePositions[owningCondId]) return isHorizontal;
                  // Vertical: pill SVG handles the line; no midpoint + needed here.
                  if (nodePositions[toId]) return isHorizontal;
                  return false;
                }
                if (nodePositions[fromId] || nodePositions[toId]) return true;
                return false;
              })
              .map(({ fromId, toId }) => {
                if (hoveredConnection !== `${fromId}-${toId}`) return null;
                const from = nodeSvgPos[fromId];
                const to = nodeSvgPos[toId];
                if (!from || !to) return null;
                let midCanvasX: number, midCanvasY: number;
                if (isHorizontal) {
                  midCanvasX = ((from.x + from.halfW) + (to.x - to.halfW)) / 2 - containerHalfRef.current.w;
                  midCanvasY = (from.y + to.y) / 2 - containerHalfRef.current.h;
                } else {
                  midCanvasX = (from.x + to.x) / 2 - containerHalfRef.current.w;
                  midCanvasY = ((from.y + from.halfH) + (to.y - to.halfH)) / 2 - containerHalfRef.current.h;
                }
                // Insert index = index of toId in workflowNodes
                const insertIdx = workflowNodes.findIndex(n => n.id === toId);
                return (
                  <div
                    key={`plus-${fromId}-${toId}`}
                    data-no-pan
                    style={{ position: 'absolute', left: `calc(50% + ${midCanvasX}px)`, top: `calc(50% + ${midCanvasY}px)`, transform: 'translate(-50%, -50%)', zIndex: 20, pointerEvents: nodeMenuOpen ? 'none' : 'auto' }}
                    onMouseEnter={() => setHoveredConnection(`${fromId}-${toId}`)}
                    onMouseLeave={() => setHoveredConnection(null)}
                  >
                    <CopilotButton
                      variant="ghost"
                      size="sm"
                      onClick={() => { setDisplacedInsert({ midCanvasX, midCanvasY }); openAddStep(insertIdx >= 0 ? insertIdx : workflowNodes.length); }}
                      icon={<svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                      className="rounded-full border-2 bg-white hover:scale-110 transition-all"
                      style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))', boxShadow: '0 1px 4px rgba(0,0,0,0.12)', width: 20, height: 20, padding: 0, minWidth: 0 }}
                      title="Add step here"
                    />
                  </div>
                );
              })}
            {/* Placeholder for inserting a step on a displaced connection line (V1 only — V2 uses the palette modal) */}
            {version === 1 && displacedInsert && insertAtIndex !== null && (
              <div data-no-pan style={{ position: 'absolute', left: `calc(50% + ${displacedInsert.midCanvasX}px)`, top: `calc(50% + ${displacedInsert.midCanvasY}px)`, transform: 'translate(-50%, -50%)', zIndex: 15 }}>
                <div className="relative flex items-center justify-center rounded-2xl border-2 border-dashed" style={{ width: 352, height: 64, borderColor: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--primary) / 0.04)' }}>
                  <span className="text-caption-1" style={{ color: 'hsl(var(--primary))' }}>Select a step from the panel →</span>
                  <CopilotButton variant="ghost" size="sm" onClick={closeAddStep} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors p-0 min-w-0" style={{ color: 'hsl(var(--primary))' }} title="Cancel">
                    <Dismiss20Regular style={{ width: 14, height: 14 }} />
                  </CopilotButton>
                </div>
              </div>
            )}
            {/* Displaced flow nodes — dragged out of the flow, still in workflow */}
            {Object.entries(nodePositions).map(([nodeId, pos]) => {
              const node = workflowNodes.find(n => n.id === nodeId);
              if (!node) return null;
              // Compute per-node empty-branch pills for condition nodes (not just the first condition).
              let displacedPills: EmptyBranchPill[] | null = null;
              if (node.type === 'condition' && !isStepTypeVisuals) {
                // Exclude the node itself and require parentConditionId === nodeId for parentless legacy nodes
                // to avoid sibling branch nodes (e.g. another condition in the same branch) being counted as children.
                const dTrueNodes = workflowNodes.filter(n => n.id !== nodeId && n.branch === 'true' && (!n.parentConditionId || n.parentConditionId === nodeId));
                const dFalseNodes = workflowNodes.filter(n => n.id !== nodeId && n.branch === 'false' && (!n.parentConditionId || n.parentConditionId === nodeId));
                const dElseIfBrs: ElseIfBranch[] = node.config?.elseIfBranches ?? [];
                const dAllEmpty = dTrueNodes.length === 0 && dFalseNodes.length === 0 &&
                  dElseIfBrs.every((b: ElseIfBranch) => workflowNodes.filter((n: WorkflowNode) => n.branch === b.id && (!n.parentConditionId || n.parentConditionId === nodeId)).length === 0);
                if (dAllEmpty) {
                  displacedPills = [
                    { branch: 'true', insertIdx: workflowNodes.indexOf(node) + 1 },
                    ...dElseIfBrs.map((b: ElseIfBranch) => ({ branch: b.id, insertIdx: workflowNodes.length })),
                    { branch: 'false', insertIdx: workflowNodes.length },
                  ];
                }
              }
              return (
                <div key={nodeId} data-no-pan style={{ position: 'absolute', left: `calc(50% + ${pos.x}px)`, top: `calc(50% + ${pos.y}px)`, transform: 'translate(-50%, -50%)', zIndex: 10 }}>
                  <WorkflowNodeCard node={node} ctx={ctx} emptyBranchPills={displacedPills} />
                </div>
              );
            })}
            {/* Floating + button for the last node when displaced — follows the card using nodeSvgPos.
                Handles two cases: last pre-condition node displaced with no condition, and last pre-condition
                node displaced when a condition exists (connector goes to the branch step). */}
            {(() => {
              const lastPreNode = preConditionNodes.length > 0 ? preConditionNodes[preConditionNodes.length - 1] : null;
              // Show when: last pre-condition node is displaced AND either there's no condition (end-of-flow +)
              // or there is a condition (the connector to the branch step is floating).
              if (!lastPreNode || !nodePositions[lastPreNode.id]) return null;
              // When a condition exists, the connector leads to the branch step — don't show a + button,
              // just render the floating line + dot so the connection looks correct.
              // When no condition, show the + button for end-of-flow insertion.
              const svgPos = nodeSvgPos[lastPreNode.id];
              if (!svgPos) return null;
              const hw = containerHalfRef.current.w, hh = containerHalfRef.current.h;
              const plusIcon = <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
              if (isHorizontal) {
                // When a condition exists, the SVG overlay draws the line to the condition card — skip the floating + here.
                if (conditionNode) return null;
                // Position to the right of the card's right edge, vertically centered
                const cx = svgPos.x + svgPos.halfW - hw;
                const cy = svgPos.y - hh;
                return (
                  <div data-no-pan style={{ position: 'absolute', left: `calc(50% + ${cx}px)`, top: `calc(50% + ${cy}px)`, transform: 'translate(0, -50%)', display: 'flex', flexDirection: 'row', alignItems: 'center', zIndex: 2 }}>
                    <div className="rounded-full flex-shrink-0" style={{ width: DOT_SIZE, height: DOT_SIZE, background: DOT_FILL, border: `${CONNECTOR_WIDTH}px solid ${DOT_STROKE}`, marginLeft: -DOT_SIZE / 2 }} />
                    <div style={{ width: 16, height: CONNECTOR_WIDTH, background: CONNECTOR_COLOR, flexShrink: 0 }} />
                    <CopilotButton variant="ghost" size="sm" onClick={() => openAddStep(endInsertIndex)} icon={plusIcon} className="rounded-full border-2 bg-white transition-all hover:scale-110" style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))', width: 20, height: 20, padding: 0, minWidth: 0, marginLeft: DOT_SIZE / 2 + 4 }} title="Add step" />
                  </div>
                );
              }
              // When a condition exists, the bezier SVG handles the connector — skip the floating + here.
              if (conditionNode) return null;
              // Position below the card's bottom edge, horizontally centered
              const cx = svgPos.x - hw;
              const cy = svgPos.y + svgPos.halfH - hh;
              return (
                <div data-no-pan style={{ position: 'absolute', left: `calc(50% + ${cx}px)`, top: `calc(50% + ${cy}px)`, transform: 'translate(-50%, 0)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                  <div className="rounded-full" style={{ width: DOT_SIZE, height: DOT_SIZE, background: DOT_FILL, border: `${CONNECTOR_WIDTH}px solid ${DOT_STROKE}`, marginTop: -DOT_SIZE / 2 }} />
                  <div style={{ width: CONNECTOR_WIDTH, height: 12, background: CONNECTOR_COLOR }} />
                  <CopilotButton variant="ghost" size="sm" onClick={() => openAddStep(endInsertIndex)} icon={plusIcon} className="rounded-full border-2 bg-white transition-all hover:scale-110" style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))', width: 20, height: 20, padding: 0, minWidth: 0 }} title="Add step" />
                </div>
              );
            })()}
            {/* Floating connector+dot++ for displaced LAST branch nodes — mirrors isLast renderBranchConnector.
                Renders below the displaced card so the add-step affordance follows it around the canvas. */}
            {!isHorizontal && conditionNode && (() => {
              // Collect all (branch, insertIdx) pairs for last-nodes-in-branch that are displaced.
              const hw = containerHalfRef.current.w, hh = containerHalfRef.current.h;
              const plusIcon = <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
              const elseIfBranches: ElseIfBranch[] = conditionNode.config?.elseIfBranches ?? [];
              type BranchEntry = { nodeId: string; branch: string; insertIdx: number };
              const entries: BranchEntry[] = [];
              const checkBranch = (nodes: WorkflowNode[], branchId: string) => {
                if (nodes.length === 0) return;
                const last = nodes[nodes.length - 1];
                if (last.type === 'condition') return; // nested condition handles its own
                if (nodePositions[last.id]) {
                  entries.push({ nodeId: last.id, branch: branchId, insertIdx: workflowNodes.indexOf(last) + 1 });
                }
              };
              checkBranch(trueNodes, 'true');
              elseIfBranches.forEach((b: ElseIfBranch) => {
                const eiNodes = workflowNodes.filter(n => n.branch === b.id && (!n.parentConditionId || n.parentConditionId === conditionNode.id));
                checkBranch(eiNodes, b.id);
              });
              checkBranch(falseNodes, 'false');
              if (entries.length === 0) return null;
              return entries.map(({ nodeId, branch, insertIdx }) => {
                const svgPos = nodeSvgPos[nodeId];
                if (!svgPos) return null;
                const cx = svgPos.x - hw;
                const cy = svgPos.y + svgPos.halfH - hh;
                return (
                  <div key={`branch-last-float-${nodeId}`} data-no-pan style={{ position: 'absolute', left: `calc(50% + ${cx}px)`, top: `calc(50% + ${cy}px)`, transform: 'translate(-50%, 0)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 26 }}>
                    {/* Mirrors VerticalConnector (topDot=true, bottomDot=true) + isLast button */}
                    <div className="relative flex justify-center flex-shrink-0" style={{ width: '100%', height: 32 }}>
                      <div style={{ width: CONNECTOR_WIDTH, height: '100%', backgroundColor: CONNECTOR_COLOR }} />
                      <div className="absolute rounded-full" style={{ width: DOT_SIZE, height: DOT_SIZE, top: -DOT_SIZE / 2, left: `calc(50% - ${DOT_SIZE / 2}px)`, background: DOT_FILL, border: `${CONNECTOR_WIDTH}px solid ${DOT_STROKE}` }} />
                      <div className="absolute rounded-full" style={{ width: DOT_SIZE, height: DOT_SIZE, bottom: -DOT_SIZE / 2, left: `calc(50% - ${DOT_SIZE / 2}px)`, background: DOT_FILL_END, border: `${CONNECTOR_WIDTH}px solid ${DOT_STROKE_END}` }} />
                    </div>
                    <CopilotButton variant="ghost" size="sm" onClick={() => openAddStep(insertIdx, branch)} icon={plusIcon} className="rounded-full border-2 bg-white transition-all hover:scale-110" style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))', width: 20, height: 20, padding: 0, minWidth: 0, marginTop: DOT_SIZE / 2 + 4 }} title="Add step" />
                  </div>
                );
              });
            })()}
            {/* Floating connector+dot+button for displaced LAST horizontal branch nodes — mirrors isLast renderBranchConnectorH.
                Renders to the RIGHT of the displaced card so the add-step affordance follows it around the canvas. */}
            {isHorizontal && conditionNode && (() => {
              const hw = containerHalfRef.current.w, hh = containerHalfRef.current.h;
              const plusIcon = <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
              const elseIfBranches: ElseIfBranch[] = conditionNode.config?.elseIfBranches ?? [];
              type BranchEntryH = { nodeId: string; branch: string; insertIdx: number };
              const entries: BranchEntryH[] = [];
              const checkBranch = (nodes: WorkflowNode[], branchId: string) => {
                if (nodes.length === 0) return;
                const last = nodes[nodes.length - 1];
                if (last.type === 'condition') return;
                if (nodePositions[last.id]) {
                  entries.push({ nodeId: last.id, branch: branchId, insertIdx: workflowNodes.indexOf(last) + 1 });
                }
              };
              checkBranch(trueNodes, 'true');
              elseIfBranches.forEach((b: ElseIfBranch) => {
                const eiNodesList = workflowNodes.filter(n => n.branch === b.id && (!n.parentConditionId || n.parentConditionId === conditionNode.id));
                checkBranch(eiNodesList, b.id);
              });
              checkBranch(falseNodes, 'false');
              if (entries.length === 0) return null;
              return entries.map(({ nodeId, branch, insertIdx }) => {
                const svgPos = nodeSvgPos[nodeId];
                if (!svgPos) return null;
                // Position to the right of the card's right edge, vertically centered
                const cx = svgPos.x + svgPos.halfW - hw;
                const cy = svgPos.y - hh;
                return (
                  <div key={`branch-last-float-h-${nodeId}`} data-no-pan style={{ position: 'absolute', left: `calc(50% + ${cx}px)`, top: `calc(50% + ${cy}px)`, transform: 'translate(0, -50%)', display: 'flex', flexDirection: 'row', alignItems: 'center', zIndex: 26 }}>
                    {/* Mirrors HorizontalConnector (leftDot=true, rightDot=true) + isLast button */}
                    <div className="relative flex items-center flex-shrink-0" style={{ height: '100%', width: 28 }}>
                      <div style={{ height: CONNECTOR_WIDTH, width: '100%', backgroundColor: CONNECTOR_COLOR }} />
                      <div className="absolute rounded-full" style={{ width: DOT_SIZE, height: DOT_SIZE, left: -DOT_SIZE / 2, top: '50%', transform: 'translateY(-50%)', background: DOT_FILL, border: `${CONNECTOR_WIDTH}px solid ${DOT_STROKE}` }} />
                      <div className="absolute rounded-full" style={{ width: DOT_SIZE, height: DOT_SIZE, right: -DOT_SIZE / 2, top: '50%', transform: 'translateY(-50%)', background: DOT_FILL_END, border: `${CONNECTOR_WIDTH}px solid ${DOT_STROKE_END}` }} />
                    </div>
                    <CopilotButton variant="ghost" size="sm" onClick={() => openAddStep(insertIdx, branch)} icon={plusIcon} className="rounded-full border-2 bg-white transition-all hover:scale-110" style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))', width: 20, height: 20, padding: 0, minWidth: 0, marginLeft: DOT_SIZE / 2 + 4 }} title="Add step" />
                  </div>
                );
              });
            })()}
            {/* Displaced horizontal branch section — fork SVG + branch rows follow each displaced condition card.
                Loops over ALL displaced condition nodes (not just the first) so that multiple consecutive
                branch steps each get their own fork + rows when moved.
                Branch nodes inside rows are rendered as placeholders (correct dimensions, no duplicate card) —
                actual cards remain in the inline hidden rows at their original positions. */}
            {isHorizontal && Object.entries(nodePositions).map(([dispNodeId, pos]) => {
              const dispCondNode = workflowNodes.find(n => n.id === dispNodeId && n.type === 'condition');
              if (!dispCondNode) return null;

              // Exclude the node itself to avoid a branch-tagged condition counting itself as its own child.
              const dispTrueNodes = workflowNodes.filter(n => n.id !== dispNodeId && n.branch === 'true' && (!n.parentConditionId || n.parentConditionId === dispNodeId));
              const dispFalseNodes = workflowNodes.filter(n => n.id !== dispNodeId && n.branch === 'false' && (!n.parentConditionId || n.parentConditionId === dispNodeId));
              const dispElseIfBrs: ElseIfBranch[] = dispCondNode.config?.elseIfBranches ?? [];

              // When all branches are empty in !isStepTypeVisuals mode, the card's pills handle
              // the add buttons inline — no fork/branch rows to show in the displaced section.
              const dispAllEmpty = !isStepTypeVisuals && dispTrueNodes.length === 0 && dispFalseNodes.length === 0 &&
                dispElseIfBrs.every((b: ElseIfBranch) => workflowNodes.filter((n: WorkflowNode) => n.branch === b.id && (!n.parentConditionId || n.parentConditionId === dispNodeId)).length === 0);
              if (dispAllEmpty) return null;

              // In isStepTypeVisuals mode, the condition card is 120px wide (horizontal card).
              // In !isStepTypeVisuals mode, the card uses the vertical renderer at 300px wide.
              const cfHalfW = isStepTypeVisuals ? 60 : 150;
              const { positive: hPositiveD, negative: hNegativeD } = getBranchLabels(dispCondNode.branchType);
              const totalBrs = 2 + dispElseIfBrs.length;
              // Use measured row heights from the per-condition map.
              const condRowHeights = hBranchRowHeightsMap.get(dispNodeId) ?? [];
              const rh = condRowHeights.length === totalBrs
                ? condRowHeights
                : Array(totalBrs).fill(hDefaultRowH);
              const svgHd = rh.reduce((a: number, b: number) => a + b, 0);
              const originYd = svgHd / 2;
              const epyd = (i: number) => {
                let y = 0;
                for (let j = 0; j < i; j++) y += rh[j];
                return y + rh[i] / 2;
              };
              // For !isStepTypeVisuals, bezier curves originate from pill dot positions on the displaced card.
              const condPillOriginYs = pillOriginYsMap.get(dispNodeId) ?? [];
              const condPillOriginXs = pillOriginXsMap.get(dispNodeId) ?? [];
              const usePillOrigins = !isStepTypeVisuals && condPillOriginYs.length === totalBrs && condPillOriginXs.length === totalBrs;

              // Helper: render a placeholder div matching the card's dimensions for non-displaced branch nodes.
              // Actual cards stay in the inline hidden rows; we just need the right width for connector spacing.
              // For !isStepTypeVisuals, branch node cards use the vertical renderer (300px wide).
              const renderBranchNodePlaceholder = (n: WorkflowNode, rowHeight: number) => {
                const isCFNode = n.type === 'condition' || ['Function', 'Variable', 'Loop'].includes(n.label);
                const w = isStepTypeVisuals ? (isCFNode ? 120 : 160) : 300;
                const h = isStepTypeVisuals ? (isCFNode ? 80 : 100) : rowHeight;
                return <div key={n.id} style={{ width: w, height: h, flexShrink: 0 }} />;
              };

              return (
                <div
                  key={`displaced-horizontal-branch-${dispNodeId}`}
                  data-no-pan
                  style={{
                    position: 'absolute',
                    left: `calc(50% + ${pos.x + cfHalfW}px)`,
                    top: `calc(50% + ${pos.y - svgHd / 2}px)`,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                  }}
                >
                  {/* Fork SVG — for !isStepTypeVisuals, bezier origins come from pill dot positions */}
                  <div style={{ position: 'relative', width: 60, height: svgHd, flexShrink: 0 }}>
                    <svg width={60} height={svgHd} viewBox={`0 0 60 ${svgHd}`} style={{ display: 'block', overflow: 'visible' }}>
                      {isStepTypeVisuals && (
                        <line x1="4" y1={originYd} x2="16" y2={originYd} stroke={CONNECTOR_COLOR} strokeWidth={CONNECTOR_WIDTH} strokeLinecap="round" />
                      )}
                      {Array.from({ length: totalBrs }, (_, i) => {
                        const oy = usePillOrigins ? condPillOriginYs[i] : originYd;
                        const ox = usePillOrigins ? condPillOriginXs[i] : (isStepTypeVisuals ? 16 : 0);
                        const cpx1 = usePillOrigins ? ox + 40 : (isStepTypeVisuals ? 46 : 40);
                        return (
                          <React.Fragment key={i}>
                            <path d={`M ${ox} ${oy} C ${cpx1} ${oy}, 30 ${epyd(i)}, 60 ${epyd(i)}`} stroke={CONNECTOR_COLOR} strokeWidth={CONNECTOR_WIDTH} fill="none" />
                            {isStepTypeVisuals && <circle cx={60} cy={epyd(i)} r={DOT_SIZE / 2} fill={DOT_FILL_END} stroke={DOT_STROKE_END} strokeWidth={CONNECTOR_WIDTH} />}
                          </React.Fragment>
                        );
                      })}
                    </svg>
                    {isStepTypeVisuals && (
                      <div style={{ position: 'absolute', left: 4, top: originYd, transform: 'translate(-50%, -50%)', width: DOT_SIZE, height: DOT_SIZE, borderRadius: '50%', background: DOT_FILL, border: `${CONNECTOR_WIDTH}px solid ${DOT_STROKE}`, zIndex: 1 }} />
                    )}
                  </div>
                  {/* Branch rows — nodes rendered as placeholders (actual cards are in the inline hidden rows) */}
                  <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    {/* True row */}
                    <div style={{ height: rh[0], display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                      <div style={{ width: 8, height: CONNECTOR_WIDTH, background: CONNECTOR_COLOR, flexShrink: 0 }} />
                      {isStepTypeVisuals && <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-caption-1-strong rounded-full flex-shrink-0 border border-gray-300" style={{ minWidth: 80, textAlign: 'center' }}>{hPositiveD}</span>}
                      {dispTrueNodes.length === 0
                        ? renderBranchConnectorH(workflowNodes.indexOf(dispCondNode) + 1, 'true', true, false, true)
                        : <div style={{ width: 8, height: CONNECTOR_WIDTH, background: CONNECTOR_COLOR, flexShrink: 0 }} />
                      }
                      {dispTrueNodes.map(n => renderBranchNodePlaceholder(n, rh[0]))}
                      {dispTrueNodes.length > 0 && dispTrueNodes[dispTrueNodes.length - 1].type !== 'condition' && renderBranchConnectorH(workflowNodes.indexOf(dispTrueNodes[dispTrueNodes.length - 1]) + 1, 'true', true)}
                    </div>
                    {/* Else If rows */}
                    {dispElseIfBrs.map((branch: ElseIfBranch, brIdx: number) => {
                      const eiNodes = workflowNodes.filter(n => n.branch === branch.id && (!n.parentConditionId || n.parentConditionId === dispNodeId));
                      const eiRowH = rh[brIdx + 1];
                      return (
                        <div key={branch.id} style={{ height: eiRowH, display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                          <div style={{ width: 8, height: CONNECTOR_WIDTH, background: CONNECTOR_COLOR, flexShrink: 0 }} />
                          {isStepTypeVisuals && <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-caption-1-strong rounded-full flex-shrink-0 border border-gray-300" style={{ minWidth: 80, textAlign: 'center' }}>{'Else ' + hPositiveD}</span>}
                          {eiNodes.length === 0
                            ? renderBranchConnectorH(workflowNodes.length, branch.id, true, false, true)
                            : <div style={{ width: 8, height: CONNECTOR_WIDTH, background: CONNECTOR_COLOR, flexShrink: 0 }} />
                          }
                          {eiNodes.map(n => renderBranchNodePlaceholder(n, eiRowH))}
                          {eiNodes.length > 0 && eiNodes[eiNodes.length - 1].type !== 'condition' && renderBranchConnectorH(workflowNodes.indexOf(eiNodes[eiNodes.length - 1]) + 1, branch.id, true)}
                        </div>
                      );
                    })}
                    {/* False row */}
                    <div style={{ height: rh[totalBrs - 1], display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                      <div style={{ width: 8, height: CONNECTOR_WIDTH, background: CONNECTOR_COLOR, flexShrink: 0 }} />
                      {isStepTypeVisuals && <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-caption-1-strong rounded-full flex-shrink-0 border border-gray-300" style={{ minWidth: 80, textAlign: 'center' }}>{hNegativeD}</span>}
                      {dispFalseNodes.length === 0
                        ? renderBranchConnectorH(workflowNodes.length, 'false', true, false, true)
                        : <div style={{ width: 8, height: CONNECTOR_WIDTH, background: CONNECTOR_COLOR, flexShrink: 0 }} />
                      }
                      {dispFalseNodes.map(n => renderBranchNodePlaceholder(n, rh[totalBrs - 1]))}
                      {dispFalseNodes.length > 0 && dispFalseNodes[dispFalseNodes.length - 1].type !== 'condition' && renderBranchConnectorH(workflowNodes.indexOf(dispFalseNodes[dispFalseNodes.length - 1]) + 1, 'false', true)}
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Note: when a condition node is displaced, its branch columns stay in-place in the
                inline layout. Only the Branch card itself floats with the drag. */}
            {/* Displaced nested branch sections — nested condition nodes that are being dragged.
                renderNestedBranchSection keeps the inline section in the layout but hidden
                (placeholder), so we render a separate floating fork + sub-columns here
                positioned relative to the dragged card. */}
            {!isHorizontal && workflowNodes
              .filter(n => nodePositions[n.id] && n.type === 'condition' && (n.branch === 'true' || n.branch === 'false'))
              .map(nestedCond => {
                const pos = nodePositions[nestedCond.id];
                const CARD_W = isStepTypeVisuals ? 380 : 300;
                const SUB_GAP = 32;
                const nestedW = CARD_W * 2 + SUB_GAP;
                const truePct = (CARD_W / 2 / nestedW * 100).toFixed(2);
                const falsePct = ((CARD_W + SUB_GAP + CARD_W / 2) / nestedW * 100).toFixed(2);
                const subTrueNodes = getSubbranchNodes(nestedCond.id, 'true');
                const subFalseNodes = getSubbranchNodes(nestedCond.id, 'false');
                const conditionIdx = workflowNodes.findIndex(n => n.id === nestedCond.id);
                const insertIdxSubTrue = subTrueNodes.length > 0 ? workflowNodes.indexOf(subTrueNodes[subTrueNodes.length - 1]) + 1 : conditionIdx + 1;
                const insertIdxSubFalse = subFalseNodes.length > 0 ? workflowNodes.indexOf(subFalseNodes[subFalseNodes.length - 1]) + 1 : conditionIdx + 1;
                return (
                  <div key={`displaced-nested-${nestedCond.id}`} data-no-pan style={{ position: 'absolute', left: `calc(50% + ${pos.x}px)`, top: `calc(50% + ${pos.y + 34}px)`, transform: 'translate(-50%, 0)', width: nestedW }}>
                    <div className="relative w-full" style={{ height: 56 }}>
                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 56" preserveAspectRatio="none">
                        <line x1="50" y1="0" x2="50" y2="30" stroke={CONNECTOR_COLOR} strokeWidth={CONNECTOR_WIDTH} vectorEffect="non-scaling-stroke" />
                        <path d={`M 50 30 L ${(parseFloat(truePct) + 1.7).toFixed(2)} 30 A 1.7 12 0 0 0 ${truePct} 42 L ${truePct} 56`} stroke={CONNECTOR_COLOR} strokeWidth={CONNECTOR_WIDTH} fill="none" vectorEffect="non-scaling-stroke" />
                        <path d={`M 50 30 L ${(parseFloat(falsePct) - 1.7).toFixed(2)} 30 A 1.7 12 0 0 1 ${falsePct} 42 L ${falsePct} 56`} stroke={CONNECTOR_COLOR} strokeWidth={CONNECTOR_WIDTH} fill="none" vectorEffect="non-scaling-stroke" />
                      </svg>
                      <div className="absolute rounded-full" style={{ width: DOT_SIZE, height: DOT_SIZE, top: -DOT_SIZE / 2, left: `calc(50% - ${DOT_SIZE / 2}px)`, background: DOT_FILL, border: `${CONNECTOR_WIDTH}px solid ${DOT_STROKE}` }} />
                    </div>
                    <div style={{ display: 'flex', gap: SUB_GAP }}>
                      <div className="flex flex-col items-center" style={{ width: CARD_W }}>
                        <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold border border-gray-300">{getBranchLabels(nestedCond.branchType).positive}</span>
                        {subTrueNodes.length === 0
                          ? renderNestedBranchConnector(nestedCond.id, 'true', insertIdxSubTrue, true)
                          : renderNestedBranchConnector(nestedCond.id, 'true', workflowNodes.indexOf(subTrueNodes[0]), false, true)
                        }
                        {subTrueNodes.map((node, i) => (
                          <React.Fragment key={node.id}>
                            {i > 0 && renderNestedBranchConnector(nestedCond.id, 'true', workflowNodes.indexOf(node), false)}
                            {renderFlowSlot(node)}
                          </React.Fragment>
                        ))}
                        {subTrueNodes.length > 0 && renderNestedBranchConnector(nestedCond.id, 'true', insertIdxSubTrue, true)}
                      </div>
                      <div className="flex flex-col items-center" style={{ width: CARD_W }}>
                        <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold border border-gray-300">{getBranchLabels(nestedCond.branchType).negative}</span>
                        {subFalseNodes.length === 0
                          ? renderNestedBranchConnector(nestedCond.id, 'false', insertIdxSubFalse, true)
                          : renderNestedBranchConnector(nestedCond.id, 'false', workflowNodes.indexOf(subFalseNodes[0]), false, true)
                        }
                        {subFalseNodes.map((node, i) => (
                          <React.Fragment key={node.id}>
                            {i > 0 && renderNestedBranchConnector(nestedCond.id, 'false', workflowNodes.indexOf(node), false)}
                            {renderFlowSlot(node)}
                          </React.Fragment>
                        ))}
                        {subFalseNodes.length > 0 && renderNestedBranchConnector(nestedCond.id, 'false', insertIdxSubFalse, true)}
                      </div>
                    </div>
                  </div>
                );
              })
            }
            {/* Detached nodes — removed from flow but kept on canvas (V2 only) */}
            {version === 2 && floatingNodes.map(node =>
              node.type === 'note' ? (
                <div key={node.id} data-no-pan style={{ position: 'absolute', left: `calc(50% + ${node.x}px)`, top: `calc(50% + ${node.y}px)`, transform: 'translate(-50%, -50%)', zIndex: draggingNodeId === node.id ? 200 : 100 }}>
                  <WorkflowNoteCard node={node} ctx={ctx} />
                </div>
              ) : (
              <DetachedNodeWrapper key={node.id} x={node.x} y={node.y} initRect={node.initRect} zoom={zoom}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  {renderNodeCard(node)}
                  <div
                    title="Disconnected from workflow"
                    style={{
                      position: 'absolute', bottom: -5, left: -5, zIndex: 10,
                      width: 16, height: 16, borderRadius: '50%',
                      background: '#f59e0b', border: '2px solid white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700, color: 'white',
                    }}
                  >
                    !
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 animate-slide-up-fade" style={{ paddingLeft: 12, animationDelay: '400ms', animationFillMode: 'both' }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M6.5 1.5L11.5 10.5H1.5L6.5 1.5Z" stroke="#f59e0b" strokeWidth="1.3" strokeLinejoin="round"/>
                    <path d="M6.5 5.5v2" stroke="#f59e0b" strokeWidth="1.3" strokeLinecap="round"/>
                    <circle cx="6.5" cy="9" r="0.65" fill="#f59e0b"/>
                  </svg>
                  <span className="text-caption-1" style={{ color: '#b45309' }}>Detached from workflow</span>
                </div>
              </DetachedNodeWrapper>
              )
            )}
            {/* Floating nodes — dropped from sidebar, not yet connected (V1 only) */}
            {version === 1 && floatingNodes.map(node =>
              node.type === 'note' ? (
                <div key={node.id} data-no-pan style={{ position: 'absolute', left: `calc(50% + ${node.x}px)`, top: `calc(50% + ${node.y}px)`, transform: 'translate(-50%, -50%)', zIndex: draggingNodeId === node.id ? 200 : 100 }}>
                  <WorkflowNoteCard node={node} ctx={ctx} />
                </div>
              ) : (
              <div key={node.id} data-no-pan className="group/float" style={{ position: 'absolute', left: `calc(50% + ${node.x}px)`, top: `calc(50% + ${node.y}px)`, transform: 'translate(-50%, -50%)' }}>
                <div className="relative">
                  {/* Top connection handle */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 -top-3 z-10 opacity-0 group-hover/float:opacity-100 transition-opacity"
                    style={{ cursor: 'crosshair' }}
                    onMouseDown={e => startConnecting(node.id, 'top', e)}
                  >
                    <div className="w-4 h-4 rounded-full bg-white border-2 flex items-center justify-center" style={{ borderColor: 'hsl(var(--primary))', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--primary))' }} />
                    </div>
                  </div>
                  {renderNodeCard(node)}
                  {/* Bottom connection handle */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 -bottom-3 z-10 opacity-0 group-hover/float:opacity-100 transition-opacity"
                    style={{ cursor: 'crosshair' }}
                    onMouseDown={e => startConnecting(node.id, 'bottom', e)}
                  >
                    <div className="w-4 h-4 rounded-full bg-white border-2 flex items-center justify-center" style={{ borderColor: 'hsl(var(--primary))', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--primary))' }} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5" style={{ paddingLeft: 12 }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M6.5 1.5L11.5 10.5H1.5L6.5 1.5Z" stroke="#f59e0b" strokeWidth="1.3" strokeLinejoin="round"/>
                    <path d="M6.5 5.5v2" stroke="#f59e0b" strokeWidth="1.3" strokeLinecap="round"/>
                    <circle cx="6.5" cy="9" r="0.65" fill="#f59e0b"/>
                  </svg>
                  <span className="text-caption-1" style={{ color: '#b45309' }}>Not connected to workflow</span>
                </div>
              </div>
              )
            )}
            {/* SVG overlay for displaced connection endpoint dots — last so dots render on top of all nodes */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', zIndex: 25 }}>
              {connections
                .filter(({ fromId, toId }) => {
                  const isBadgeTo = toId.startsWith('__true_badge__') || toId.startsWith('__false_badge__') || toId.startsWith('__ei_badge_');
                  if (!((nodePositions[fromId] || nodePositions[toId]) && !isBadgeTo)) return false;
                  // Badge→displaced-first-branch: vertical pill SVG handles the line+dots; skip here.
                  const isBadgeFrom = fromId.startsWith('__true_badge__') || fromId.startsWith('__false_badge__') || fromId.startsWith('__ei_badge_');
                  if (isBadgeFrom && nodePositions[toId] && !isHorizontal) return false;
                  return true;
                })
                .map(({ fromId, toId }) => {
                  const from = nodeSvgPos[fromId];
                  const to = nodeSvgPos[toId];
                  if (!from || !to) return null;
                  const isBadge = fromId.startsWith('__true_badge__') || fromId.startsWith('__false_badge__') || fromId.startsWith('__ei_badge_');
                  let dx1: number, dy1: number, dx2: number, dy2: number;
                  if (isHorizontal) {
                    // Exit right edge of source, enter left edge of dest
                    dx1 = from.x + from.halfW; dy1 = from.y;
                    dx2 = to.x - to.halfW;     dy2 = to.y;
                  } else {
                    // Exit bottom of source, enter top of dest
                    dx1 = from.x; dy1 = from.y + from.halfH;
                    dx2 = to.x;   dy2 = to.y - to.halfH;
                  }
                  return (
                    <g key={`dots-${fromId}-${toId}`}>
                      {/* Skip dx1 dot for badge (pill) sources — the pill card renders its own dot */}
                      {!isBadge && <circle cx={dx1} cy={dy1} r={DOT_SIZE / 2} fill={DOT_FILL} stroke={DOT_STROKE} strokeWidth={CONNECTOR_WIDTH} />}
                      <circle cx={dx2} cy={dy2} r={DOT_SIZE / 2} fill={DOT_FILL_END} stroke={DOT_STROKE_END} strokeWidth={CONNECTOR_WIDTH} />
                    </g>
                  );
                })}
            </svg>
          </div>
        </div>
        {/* Floating persistent left Steps panel (V1 only) */}
        {version === 1 && v1FloatingLeftPanel}
        {/* V1/V2: workflow overview (no selection) or step details (node selected) */}
        {selectedNode ? v23RightPanel : v2OverviewPanel}
        {/* Canvas controls */}
        {version === 1 ? v1CanvasControls : v2CanvasControls}
        {/* V1: step selection palette modal (opens when + is clicked) */}
        {version === 1 && v1PaletteModal}
        {/* V1: connector picker for Connector trigger type */}
        {version === 1 && v1ConnectorPickerModal}
        {/* V2: step selection palette modal (opens when + is clicked) */}
        {version === 2 && v2PaletteModal}
        {/* MCP panel expanded modal */}
        {mcpExpandedModal}
        {/* Config-selection dialog (MCP, Computer Use, …) */}
        {configDialogModal}
        {/* Branch-choice dialog when inserting If/Else into middle of existing steps */}
        {branchDialogModal}
        {/* Delete-branch dialog when deleting an If/Else that has steps in its branches */}
        {deleteBranchDialogModal}
        {/* Step instructions edit modal (V2) */}
        {instructionsModal}
      </div>
    );
  }

  // V2 / V3
  return (
    <div className="relative h-full overflow-hidden" style={BG_STYLE}>
      <div
        ref={canvasContainerRef}
        className="absolute inset-0 overflow-hidden"
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasStopPan}
        onMouseLeave={handleCanvasStopPan}
      >
        <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, transformOrigin: 'center center', transition: isPanning ? 'none' : 'transform 0.15s ease-out' }}>
          {canvasNodes}
        </div>
      </div>
      {canvasControls}
      {v23RightPanel}
      {mcpExpandedModal}
      {configDialogModal}
      {branchDialogModal}
      {deleteBranchDialogModal}
      {/* Step instructions edit modal (V2) */}
      {instructionsModal}
    </div>
  );
};
