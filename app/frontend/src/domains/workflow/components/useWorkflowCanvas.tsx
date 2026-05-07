// ─── Workflow Canvas Hook ──────────────────────────────────────────────────
// Contains all useState hooks, useRef declarations, useEffect/useLayoutEffect
// hooks, event handlers, and utility functions for the WorkflowCanvas.
// Extracted from WorkflowCanvas.tsx — pure refactor, no behavior changes.

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { useAgent } from '../../../context/AgentContext';
import { useWorkflow } from '../../../context/WorkflowContext';
import { WorkflowNode, HitlContact, WorkflowVersionEntry } from '../../../types';
import { getAgentStorage, setAgentStorage } from '../../../utils/agentStorage';
import { callModel } from '../../../utils/modelClient';
import { CopilotMenuPosition } from '../../../components/ui/CopilotMenu';
import { DANode } from '../../../components/ui/DAActivityCoT';
import {
  Flash24Filled,
  Agents24Filled,
  ArrowSplit24Filled,
} from '@fluentui/react-icons';
import {
  StepType,
  InstrSegment,
  V1TriggerTypeId,
  V2PreviewAction,
  PromptIcon,
  ALL_STEPS,
  isUnnamedStep,
  MOCK_MCPS,
  MOCK_CUAS,
  MOCK_AGENTS,
  MOCK_PROMPTS,
  MOCK_CLASSIFIERS,
  MOCK_GUARDRAILS,
  MOCK_EXTRACTORS,
  MOCK_M365_COPILOTS,
  getV2Suggestions,
  DEFAULT_NODES,
  AUTO_DESC_PLACEHOLDER,
  NEEDS_CONFIG_DIALOG,
  HUMAN_REVIEW_OPTIONS,
  getConnectorIconSrc,
  connectorColor,
  CONTROL_FLOW_COLOR,
} from './workflowConstants';

export function useWorkflowCanvas() {
  const { agentConfig, updateAgentConfig, updateWithHistory, isAgentGlobalUndo, updateWorkflowNodes, isWorkflowTestingV2, isStepTypeVisuals, userName, isHelperCollapsed } = useAgent();
  const { generatingWorkflowAgentId, workflowVersion: version, workflowVersionSaveCount, workflowVersionPublishCount } = useWorkflow();
  const isGeneratingWorkflow = generatingWorkflowAgentId === agentConfig.id &&
    (!agentConfig.workflowNodes || agentConfig.workflowNodes.length === 0);

  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [insertAtIndex, setInsertAtIndex] = useState<number | null>(null);
  const [nodeMenuOpen, setNodeMenuOpen] = useState<string | null>(null);
  const [displayedNode, setDisplayedNode] = useState<WorkflowNode | null>(null);
  const [zoom, setZoom] = useState(1);

  // Overview header editing
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [nameInputValue, setNameInputValue] = useState('');
  const [descInputValue, setDescInputValue] = useState('');
  const [showOverviewIconPicker, setShowOverviewIconPicker] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const startEditingHeader = () => {
    setNameInputValue(agentConfig.name);
    setDescInputValue(agentConfig.description || '');
    setIsEditingHeader(true);
  };
  const saveHeader = () => {
    const name = nameInputValue.trim();
    const description = descInputValue.trim();
    if (name) {
      const update = { name, description };
      isAgentGlobalUndo ? updateWithHistory(update) : updateAgentConfig(update);
    }
    setIsEditingHeader(false);
  };
  const cancelHeader = () => setIsEditingHeader(false);

  // HITL contact form state
  const [hitlAddOpen, setHitlAddOpen] = useState(false);
  const [hitlAddPhase, setHitlAddPhase] = useState<'search' | 'channel'>('search');
  const [hitlName, setHitlName] = useState('');
  const [hitlNotifyVia, setHitlNotifyVia] = useState<'teams' | 'email'>('email');
  const [hitlEmail, setHitlEmail] = useState('');
  const [hitlEditingId, setHitlEditingId] = useState<string | null>(null);
  const [hitlEditNotifyVia, setHitlEditNotifyVia] = useState<'teams' | 'email'>('email');
  const [hitlEditEmail, setHitlEditEmail] = useState('');
  const [hitlNotifyFrequency, setHitlNotifyFrequency] = useState<'immediately' | 'daily-recap'>('immediately');
  const [hitlNoResponse, setHitlNoResponse] = useState<'nothing' | 'reminder' | 'escalate'>('nothing');
  const [hitlNoResponseDelay, setHitlNoResponseDelay] = useState<'1h' | '4h' | '24h' | '48h' | '72h' | '1w'>('48h');
  const [hitlEscalateWarnVisible, setHitlEscalateWarnVisible] = useState(false);
  const [hitlEscalateContacts, setHitlEscalateContacts] = useState<HitlContact[]>([]);
  const [hitlEscalateAddOpen, setHitlEscalateAddOpen] = useState(false);
  const [hitlEscalateAddPhase, setHitlEscalateAddPhase] = useState<'search' | 'channel'>('search');
  const [hitlEscalateName, setHitlEscalateName] = useState('');
  const [hitlEscalateEmail, setHitlEscalateEmail] = useState('');
  const [hitlEscalateNotifyVia, setHitlEscalateNotifyVia] = useState<'teams' | 'email'>('email');
  const [hitlContactMenuId, setHitlContactMenuId] = useState<string | null>(null);
  const [hitlContactMenuPos, setHitlContactMenuPos] = useState<CopilotMenuPosition>({});
  const [hitlWhoDetailOpen, setHitlWhoDetailOpen] = useState(false);

  // CUA new-form state
  const [cuaMachineType, setCuaMachineType] = useState<'hosted-browser' | 'byom' | 'machine-pool'>('hosted-browser');
  const [cuaConnectionStatus, setCuaConnectionStatus] = useState<'connected' | 'connecting' | 'none'>('connected');
  const [cuaConnectionValue, setCuaConnectionValue] = useState('mona.kane@contoso.com');
  const [cuaMachineMenuOpen, setCuaMachineMenuOpen] = useState(false);
  const [cuaMachineMenuPos, setCuaMachineMenuPos] = useState<CopilotMenuPosition>({});

  // Step-level HITL form state (for node detail panel)
  const [stepHitlAddOpen, setStepHitlAddOpen] = useState(false);
  const [stepHitlAddPhase, setStepHitlAddPhase] = useState<'search' | 'channel'>('search');
  const [stepHitlName, setStepHitlName] = useState('');
  const [stepHitlEmail, setStepHitlEmail] = useState('');
  const [stepHitlNotifyVia, setStepHitlNotifyVia] = useState<'teams' | 'email'>('email');
  const [stepHitlEditingId, setStepHitlEditingId] = useState<string | null>(null);
  const [stepHitlEditNotifyVia, setStepHitlEditNotifyVia] = useState<'teams' | 'email'>('email');
  const [stepHitlEditEmail, setStepHitlEditEmail] = useState('');
  const [stepHitlDrillIn, setStepHitlDrillIn] = useState(false);
  const [dismissedHitlBanners, setDismissedHitlBanners] = useState<Set<string>>(new Set());
  const [stepHitlNoResponse, setStepHitlNoResponse] = useState<'nothing' | 'reminder' | 'escalate'>('nothing');
  const [stepHitlEscalateContacts, setStepHitlEscalateContacts] = useState<HitlContact[]>([]);
  const [stepHitlEscalateAddOpen, setStepHitlEscalateAddOpen] = useState(false);
  const [stepHitlEscalateAddPhase, setStepHitlEscalateAddPhase] = useState<'search' | 'channel'>('search');
  const [stepHitlEscalateName, setStepHitlEscalateName] = useState('');
  const [stepHitlEscalateEmail, setStepHitlEscalateEmail] = useState('');
  const [stepHitlEscalateNotifyVia, setStepHitlEscalateNotifyVia] = useState<'teams' | 'email'>('email');
  const [stepHitlContactMenuId, setStepHitlContactMenuId] = useState<string | null>(null);
  const [stepHitlContactMenuPos, setStepHitlContactMenuPos] = useState<CopilotMenuPosition>({});

  // V1 canvas orientation
  const [canvasLayout, setCanvasLayout] = useState<'vertical' | 'horizontal'>('vertical');

  // V1 floating nodes (dropped freely on canvas, not connected to the flow)
  // initRect captures the node's screen position at the moment of detach for FLIP animation
  const [floatingNodes, setFloatingNodes] = useState<Array<WorkflowNode & { x: number; y: number; initRect?: DOMRect }>>([]);

  // V1 node repositioning
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  // V1 drag state
  const [draggedStep, setDraggedStep] = useState<StepType | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ mouseX: 0, mouseY: 0, startPanX: 0, startPanY: 0 });


  const v1PaletteInputRef = useRef<HTMLInputElement>(null);
  const v2PaletteInputRef = useRef<HTMLInputElement>(null);
  const nodeMenuRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasContentRef = useRef<HTMLDivElement>(null);
  const rightPanelScrollRef = useRef<HTMLDivElement>(null);
  const draggingOffsetRef = useRef({ dx: 0, dy: 0 });
  const hasDraggedRef = useRef(false);
  const wheelHandlerRef = useRef<(e: WheelEvent) => void>(() => {});

  // Ref to the canvas transform div — used to suppress its CSS transition during detach
  // without going through React state (which would be too late to prevent the animation).
  const canvasTransformRef = useRef<HTMLDivElement>(null);
  // Snapshots of ALL remaining node positions taken just before detach.
  // The useLayoutEffect picks any node that moved and uses its delta to correct pan.
  const preDetachSnapshot = useRef<Array<{ id: string; left: number; top: number }>>([]);

  // Refs to all rendered node cards for dynamic SVG connector lines
  const nodeCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [nodeSvgPos, setNodeSvgPos] = useState<Record<string, { x: number; y: number; halfW: number; halfH: number }>>({});
  const containerHalfRef = useRef({ w: 0, h: 0 });
  // Refs to True/False badge elements so displaced branch nodes connect from the badge, not the condition
  const trueBadgeRef = useRef<HTMLElement | null>(null);
  const falseBadgeRef = useRef<HTMLElement | null>(null);
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(null);
  // Which drop-zone index is nearest the cursor while dragging a detached (V2) node back into the flow
  const [reattachDropIndex, setReattachDropIndex] = useState<number | null>(null);

  // Workflow undo history (delete actions only)

  // ── Workflow version history ──────────────────────────────────────────────
  const [workflowVersionHistory, setWorkflowVersionHistory] = useState<WorkflowVersionEntry[]>(() => {
    try {
      const stored = getAgentStorage(agentConfig.id, 'workflowVersionHistory');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Reload history when agent changes
  useEffect(() => {
    try {
      const stored = getAgentStorage(agentConfig.id, 'workflowVersionHistory');
      setWorkflowVersionHistory(stored ? JSON.parse(stored) : []);
    } catch { setWorkflowVersionHistory([]); }
  }, [agentConfig.id]);

  const generateVersionDescription = async (
    currentNodes: WorkflowNode[],
    prevNodes: WorkflowNode[] | undefined
  ): Promise<string> => {
    const label = (n: WorkflowNode) => n.config?.instanceName ?? n.label;
    const curr = currentNodes.filter(n => n.type !== 'trigger').map(label);
    const prev = prevNodes ? prevNodes.filter(n => n.type !== 'trigger').map(label) : [];

    if (!prevNodes) {
      return `Initial version — ${curr.length} step${curr.length !== 1 ? 's' : ''}`;
    }

    const added = curr.filter(l => !prev.includes(l));
    const removed = prev.filter(l => !curr.includes(l));
    const structural = [...(added.map(l => `Added ${l}`)), ...(removed.map(l => `Removed ${l}`))];

    if (structural.length > 0) return structural.join('; ');

    // No structural change — ask LLM for a smart summary
    try {
      const text = await callModel({
        model: 'fast',
        maxTokens: 60,
        messages: [{
          role: 'user',
          content: `Summarize what changed between two workflow versions in ≤8 words. Be specific.\nBefore: ${prev.join(' → ')}\nAfter: ${curr.join(' → ')}\nIf nothing obvious changed, say "Configuration updated".`,
        }],
      });
      return text.trim().replace(/^["']|["']$/g, '');
    } catch {
      return 'Configuration updated';
    }
  };

  // Helper to derive initials from a name string
  const getInitials = (name: string | null) => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Helper to push a new version entry and async-generate its description
  const pushVersionEntry = (
    nodes: WorkflowNode[],
    source: WorkflowVersionEntry['source'],
    prevEntry: WorkflowVersionEntry | undefined,
    historySnapshot: WorkflowVersionEntry[],
    changeCount?: number,
  ) => {
    const isUserTriggered = source === 'manual' || source === 'publish';
    const snapshot: WorkflowVersionEntry = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      nodes,
      description: '',
      source,
      ...(isUserTriggered ? { userInitials: getInitials(userName), userName: userName || undefined } : {}),
      ...(source === 'auto' && changeCount !== undefined ? { changeCount } : {}),
    };
    const updated = [snapshot, ...historySnapshot];
    setWorkflowVersionHistory(updated);
    setAgentStorage(agentConfig.id, 'workflowVersionHistory', JSON.stringify(updated));

    generateVersionDescription(nodes, prevEntry?.nodes).then(description => {
      setWorkflowVersionHistory(prev => {
        const patched = prev.map(v => v.id === snapshot.id ? { ...v, description } : v);
        setAgentStorage(agentConfig.id, 'workflowVersionHistory', JSON.stringify(patched));
        return patched;
      });
    });
  };

  // Manual save trigger
  useEffect(() => {
    if (workflowVersionSaveCount === 0) return;
    pushVersionEntry(workflowNodes, 'manual', workflowVersionHistory[0], workflowVersionHistory);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowVersionSaveCount]);

  // Publish trigger
  useEffect(() => {
    if (workflowVersionPublishCount === 0) return;
    pushVersionEntry(workflowNodes, 'publish', workflowVersionHistory[0], workflowVersionHistory);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowVersionPublishCount]);


  const revertToVersion = (versionId: string) => {
    const entry = workflowVersionHistory.find(v => v.id === versionId);
    if (!entry) return;
    updateWorkflowNodes(entry.nodes);
  };

  // Injects one 'publish' and one 'auto' example entry into the middle of the
  // version history — for demo/preview purposes only. Hides itself once used.
  const seedExampleVersionHistory = () => {
    if (workflowVersionHistory.length < 2) return;
    const midIndex = Math.floor(workflowVersionHistory.length / 2);
    const refNodes = workflowVersionHistory[midIndex]?.nodes ?? workflowNodes;
    const publishEntry: WorkflowVersionEntry = {
      id: crypto.randomUUID(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // yesterday
      nodes: refNodes,
      description: 'Published to Teams channel. Email step updated with priority flag.',
      source: 'publish',
      userInitials: getInitials(userName),
      userName: userName || undefined,
    };
    const autoEntry: WorkflowVersionEntry = {
      id: crypto.randomUUID(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
      nodes: refNodes,
      description: 'Added Condition step and SharePoint connector. Removed placeholder action.',
      source: 'auto',
      changeCount: 6,
    };
    const updated = [
      ...workflowVersionHistory.slice(0, midIndex),
      publishEntry,
      autoEntry,
      ...workflowVersionHistory.slice(midIndex),
    ];
    setWorkflowVersionHistory(updated);
    setAgentStorage(agentConfig.id, 'workflowVersionHistory', JSON.stringify(updated));
  };

  // When inserting via a displaced-connection + button, store the canvas midpoint
  // so the placeholder renders on the line rather than in the original flow position
  const [displacedInsert, setDisplacedInsert] = useState<{ midCanvasX: number; midCanvasY: number } | null>(null);

  // Which branch a pending insertion belongs to ('true', 'false', or else-if branch ID)
  const [insertBranch, setInsertBranch] = useState<string | null>(null);
  // For insertions into a nested condition's sub-branch
  const [insertParentConditionId, setInsertParentConditionId] = useState<string | null>(null);
  const [insertSubbranch, setInsertSubbranch] = useState<'true' | 'false' | null>(null);

  // V1 left panel navigation: root → connectors list → individual connector
  const [panelView, setPanelView] = useState<'root' | 'connectors' | 'connector-detail' | 'mcp-servers'>('root');
  const [v1PanelCollapsed, setV1PanelCollapsed] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);

  // V1 '+' click palette modal navigation
  const [v1PaletteView, setV1PaletteView] = useState<'root' | 'connector-detail' | 'm365-detail' | 'mcp-detail'>('root');
  const [v1PaletteConnector, setV1PaletteConnector] = useState<string | null>(null);
  const [v1PaletteQuery, setV1PaletteQuery] = useState('');
  const [v1PaletteConnectorOnly, setV1PaletteConnectorOnly] = useState(false);
  const [v1PaletteFavorites, setV1PaletteFavorites] = useState<Set<string>>(new Set(['Variable', 'Connector', 'Function']));
  const [v1PaletteCollapsed, setV1PaletteCollapsed] = useState<Set<string>>(new Set());

  // V1 trigger type selection
  const [v1TriggerType, setV1TriggerType] = useState<V1TriggerTypeId>('manual');
  const [v1TriggerPickerOpen, setV1TriggerPickerOpen] = useState(false);
  const [v1RecurrenceRepeat, setV1RecurrenceRepeat] = useState('daily');
  const [v1RecurrenceInterval, setV1RecurrenceInterval] = useState('1');
  const [v1RecurrenceEnd, setV1RecurrenceEnd] = useState('never');
  const [v1RecurrenceDays, setV1RecurrenceDays] = useState<number[]>([1]); // 0=Sun…6=Sat, default Mon
  const [v1RecurrenceTimes, setV1RecurrenceTimes] = useState<string[]>([]);
  const [v1RecurrenceMonthlyMode, setV1RecurrenceMonthlyMode] = useState<'day-of-month' | 'ordinal-weekday'>('day-of-month');
  const [v1RecurrenceMonthDay, setV1RecurrenceMonthDay] = useState('1');
  const [v1RecurrenceMonthOrdinal, setV1RecurrenceMonthOrdinal] = useState('first');
  const [v1RecurrenceMonthWeekday, setV1RecurrenceMonthWeekday] = useState('day');
  const [v1RecurrenceAdvanced, setV1RecurrenceAdvanced] = useState(false);
  const [v1SlidingFreq, setV1SlidingFreq] = useState('day');
  const [v1SlidingAdvanced, setV1SlidingAdvanced] = useState(false);
  const [v1SelectedConnector, setV1SelectedConnector] = useState<string | null>(null);
  const [v1SelectedConnectorAction, setV1SelectedConnectorAction] = useState<string | null>(null);
  const [v1ConnectorPickerOpen, setV1ConnectorPickerOpen] = useState(false);
  const [v1ConnectorPickerQuery, setV1ConnectorPickerQuery] = useState('');
  const [v1ConnectorPickerCategory, setV1ConnectorPickerCategory] = useState<'all' | 'microsoft' | 'favorites'>('all');
  const [v1FavoriteConnectors, setV1FavoriteConnectors] = useState<Set<string>>(new Set());
  const [v1MicrosoftGroup, setV1MicrosoftGroup] = useState<string | null>(null);
  const [v1ConnectorDetail, setV1ConnectorDetail] = useState<string | null>(null);
  const [v1PreviewAction, setV1PreviewAction] = useState<V2PreviewAction | null>(null);

  // V2 '+' click palette modal
  const [v2PaletteCategory, setV2PaletteCategory] = useState<'suggested' | 'all' | 'ai' | 'microsoft' | 'connectors' | 'control' | 'built-in' | 'utilities'>('all');
  const [v2PaletteQuery, setV2PaletteQuery] = useState('');
  const [v2BuiltinTool, setV2BuiltinTool] = useState<string | null>(null);
  const [v2MicrosoftGroup, setV2MicrosoftGroup] = useState<string | null>(null);
  const [v2ConnectorDetail, setV2ConnectorDetail] = useState<string | null>(null);
  const [v2McpDrillIn, setV2McpDrillIn] = useState(false);
  const [v2PreviewAction, setV2PreviewAction] = useState<V2PreviewAction | null>(null);

  // Right-panel active tab ('configure' | 'test') — only MCP uses 'test' for now
  const [rightPanelTab, setRightPanelTab] = useState<'configure' | 'test'>('configure');
  // Tracks which node IDs have had their "select existing" bail banner dismissed
  const [dismissedBailBanners, setDismissedBailBanners] = useState<Set<string>>(new Set());
  const dismissBailBanner = (nodeId: string) =>
    setDismissedBailBanners(prev => { const next = new Set(prev); next.add(nodeId); return next; });

  // V2 instructions edit modal
  const [instructionsModalNodeId, setInstructionsModalNodeId] = useState<string | null>(null);
  const [instructionsModalDraft, setInstructionsModalDraft] = useState('');
  const [instructionsModalLiveText, setInstructionsModalLiveText] = useState('');
  const [instructionsModalStepKind, setInstructionsModalStepKind] = useState('step');
  const openInstructionsModal = useCallback((node: WorkflowNode, stepKind?: string) => {
    const initial = node.config?.instructions || node.config?.task || '';
    setInstructionsModalNodeId(node.id);
    setInstructionsModalDraft(initial);
    setInstructionsModalLiveText(initial);
    const kind = stepKind ?? ALL_STEPS.find(s => s.label === node.label)?.label ?? 'step';
    setInstructionsModalStepKind(kind);
  }, []);
  const saveInstructionsModal = () => {
    if (!instructionsModalNodeId) return;
    const node = workflowNodes.find(n => n.id === instructionsModalNodeId)
      ?? (selectedNode?.id === instructionsModalNodeId ? selectedNode : null);
    if (node) patchNode(instructionsModalNodeId, { config: { ...node.config, instructions: instructionsModalDraft } });
    setInstructionsModalNodeId(null);
  };

  // Right-panel sub-view for MCP / Computer Use nodes: 'pick' | 'create' | <item-id>
  const [nodeConfigMode, setNodeConfigMode] = useState<string>('pick');
  // Per-node instructions text for MCP steps, keyed by node ID
  const [mcpSegments, setMcpSegments] = useState<Record<string, InstrSegment[]>>({});
  // Sample input values for MCP test tab, keyed by nodeId then by pill key
  const [mcpSampleInputs, setMcpSampleInputs] = useState<Record<string, Record<string, string>>>({});
  // Test run state for MCP test tab, keyed by nodeId
  const [mcpTestState, setMcpTestState] = useState<Record<string, { loading: boolean; nodes: DANode[]; response: string | null; success?: boolean }>>({});
  // Which results view is active ('steps' | 'schema')
  // Whether the sample inputs section is collapsed (auto-collapses when test starts)
  const [mcpSampleCollapsed, setMcpSampleCollapsed] = useState(false);
  const [mcpInputsExpanded, setMcpInputsExpanded] = useState(false);
  // Simulated test results (both success + fail scenarios shown as tabs)
  const [mcpSimResults, setMcpSimResults] = useState<{ success: { nodes: DANode[]; response: string }; fail: { nodes: DANode[] } } | null>(null);
  const [mcpSimTab, setMcpSimTab] = useState<'success' | 'fail'>('success');

  const [mcpInstructionsFlyout, setMcpInstructionsFlyout] = useState(false);
  const [mcpFlyoutView, setMcpFlyoutView] = useState<'root' | 'dynamic-value' | 'power-fx'>('root');
  // Power Fx panel state
  const [pfxAiMode, setPfxAiMode] = useState(false);
  const [pfxAiPrompt, setPfxAiPrompt] = useState('');
  const [pfxAiSuggestion, setPfxAiSuggestion] = useState<string | null>(null);
  const [pfxAiSuggestionIsOriginal, setPfxAiSuggestionIsOriginal] = useState(false);
  const [pfxAiLoading, setPfxAiLoading] = useState(false);
  const [pfxExpression, setPfxExpression] = useState('');
  const [pfxFnPickerOpen, setPfxFnPickerOpen] = useState(false);
  const [pfxDynPickerOpen, setPfxDynPickerOpen] = useState(false);
  const [pfxFnSearch, setPfxFnSearch] = useState('');
  const [pfxDynSearch, setPfxDynSearch] = useState('');
  // Flyout anchor position (fixed coords derived from + button bounding rect)
  const mcpFlyoutBtnRef = useRef<HTMLElement>(null);
  const [flyoutPos, setFlyoutPos] = useState<{ top?: number; bottom?: number; right: number; maxH: number }>({ bottom: 0, right: 0, maxH: 600 });
  // Per-node per-tool enabled state; absent key = enabled (true by default)
  const [mcpToolsEnabled, setMcpToolsEnabled] = useState<Record<string, Record<string, boolean>>>({});
  const [mcpToolsFilterEnabled, setMcpToolsFilterEnabled] = useState(false);
  const isMcpToolEnabled = (nodeId: string, toolId: string) => mcpToolsEnabled[nodeId]?.[toolId] ?? true;
  const clearMcpTestResults = (nodeId: string) => {
    setMcpSimResults(null);
    setMcpTestState(prev => { const next = { ...prev }; delete next[nodeId]; return next; });
    setMcpSampleCollapsed(false);
  };
  const toggleMcpTool = (nodeId: string, toolId: string) => {
    setMcpToolsEnabled(prev => ({ ...prev, [nodeId]: { ...prev[nodeId], [toolId]: !isMcpToolEnabled(nodeId, toolId) } }));
    clearMcpTestResults(nodeId);
  };
  // When confirmConfigDialog sets both selectedNode + nodeConfigMode in the same batch,
  // this ref tells the reset effect to leave nodeConfigMode alone for that one fire.
  const skipNodeConfigResetRef = useRef(false);

  // Modal shown immediately after adding a step that requires instance selection (MCP, CUA, …)
  const [configDialog, setConfigDialog] = useState<{
    pendingNode: WorkflowNode;
    insertIndex: number;
  } | null>(null);

  // FigJam-style handle-dragging to connect a floating node into the workflow
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [connectingSide, setConnectingSide] = useState<'top' | 'bottom' | null>(null);
  const [connectTargetIdx, setConnectTargetIdx] = useState<number | null>(null);
  const [connectLineEnd, setConnectLineEnd] = useState<{ x: number; y: number } | null>(null);

  // Dialog shown when inserting a condition in the middle of existing steps
  const [branchDialog, setBranchDialog] = useState<{
    pendingNode: WorkflowNode;
    insertIndex: number;
    afterNodes: WorkflowNode[];
  } | null>(null);

  // Dialog shown when deleting a condition that has steps in its branches
  const [deleteBranchDialog, setDeleteBranchDialog] = useState<{
    conditionId: string;
    trueNodes: WorkflowNode[];
    falseNodes: WorkflowNode[];
  } | null>(null);

  const handleZoomIn = () => setZoom(z => Math.min(parseFloat((z + 0.1).toFixed(1)), 2));
  const handleZoomOut = () => setZoom(z => Math.max(parseFloat((z - 0.1).toFixed(1)), 0.3));
  const handleFitToScreen = () => {
    if (!canvasContainerRef.current || !canvasContentRef.current) {
      setZoom(1); setPanX(0); setPanY(0);
      return;
    }
    const { width: cW, height: cH } = canvasContainerRef.current.getBoundingClientRect();
    const pad = 80;
    // Both right panels (overview + node details) are 380px at right-4 (16px) + 16px gap = 412px.
    // The overview panel is always visible in V1/V2; node details replaces it when a node is selected.
    const rightInset = (version === 1 || version === 2 || displayedNode) ? 412 : 0;
    // V1 has a floating left Steps panel: 240px expanded / 52px collapsed, at left-4 (16px) + 16px gap.
    const leftInset = version === 1 ? (v1PanelCollapsed ? 84 : 272) : 0;
    const effectiveCW = cW - leftInset - rightInset;

    let natW: number, natH: number, panYOffset: number;
    if (canvasLayout === 'horizontal') {
      // Horizontal: getBoundingClientRect is reliable (no w-full, no padding inflation).
      const { width: rawW, height: rawH } = canvasContentRef.current.getBoundingClientRect();
      natW = rawW / zoom;
      natH = rawH / zoom;
      panYOffset = 0;
    } else {
      // Vertical: canvasContentRef has paddingBottom:600 and is w-full, so we can't use it directly.
      // Use node cards for natW (tight horizontal bbox) and canvasContentRef minus padding for natH
      // (which includes connectors + final add button below the last card).
      const cardEls = Array.from(nodeCardRefs.current.values());
      const containerRect = canvasContainerRef.current.getBoundingClientRect();
      const contentRect = canvasContentRef.current.getBoundingClientRect();
      if (cardEls.length > 0) {
        // Width: tight bbox across all cards
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        for (const el of cardEls) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          minX = Math.min(minX, r.left);
          maxX = Math.max(maxX, r.right);
          minY = Math.min(minY, r.top);
          maxY = Math.max(maxY, r.bottom);
        }
        natW = (maxX - minX) / zoom;
        // Height: use content div height minus the 600px padding (scaled by zoom)
        const contentScreenH = contentRect.height - 600 * zoom;
        natH = contentScreenH / zoom;
        // Center Y: use content div top + half the real content height
        const contentTopScreen = contentRect.top;
        const screenContentCenterY = contentTopScreen + contentScreenH / 2;
        const containerCenterY = containerRect.top + cH / 2;
        const naturalCenterOffsetY = (screenContentCenterY - containerCenterY - panY) / zoom;
        panYOffset = naturalCenterOffsetY;
      } else {
        natW = isStepTypeVisuals ? 380 : 352;
        natH = 400;
        panYOffset = 0;
      }
    }

    // Expand the bounding box to include any floating (disconnected) nodes.
    // Floating node x/y are canvas coords (center of card). Convert to screen space
    // using the current zoom/pan, measure against the container, and grow natW/natH.
    if (floatingNodes.length > 0 && canvasContainerRef.current) {
      const containerRect = canvasContainerRef.current.getBoundingClientRect();
      const cx = containerRect.left + containerRect.width  / 2;
      const cy = containerRect.top  + containerRect.height / 2;
      const floatCardW = (isStepTypeVisuals ? 380 : 352) / 2;
      const floatCardH = 68 / 2;
      // Current screen bbox of the connected flow (before floating expansion)
      // expressed as screen coords so we can union with floating node screen coords.
      let screenMinX = cx - natW / 2 * zoom;
      let screenMaxX = cx + natW / 2 * zoom;
      let screenMinY = cy - natH / 2 * zoom + panYOffset * zoom;
      let screenMaxY = cy + natH / 2 * zoom + panYOffset * zoom;
      for (const fn of floatingNodes) {
        // Screen position of floating node center
        const sx = cx + (fn.x * zoom) + panX;
        const sy = cy + (fn.y * zoom) + panY;
        screenMinX = Math.min(screenMinX, sx - floatCardW * zoom);
        screenMaxX = Math.max(screenMaxX, sx + floatCardW * zoom);
        screenMinY = Math.min(screenMinY, sy - floatCardH * zoom);
        // +30 accounts for the "Not connected" label below the card
        screenMaxY = Math.max(screenMaxY, sy + floatCardH * zoom + 30 * zoom);
      }
      natW = (screenMaxX - screenMinX) / zoom;
      natH = (screenMaxY - screenMinY) / zoom;
      // Recompute panYOffset so the new center aligns correctly
      const newScreenCenterY = (screenMinY + screenMaxY) / 2;
      panYOffset = (newScreenCenterY - cy - panY) / zoom;
    }

    const newZoom = Math.max(parseFloat(Math.min((effectiveCW - pad) / natW, (cH - pad) / natH, 2).toFixed(2)), 0.3);
    const newPanY = canvasLayout === 'horizontal' ? 0 : -panYOffset * newZoom;
    setZoom(newZoom);
    // Shift panX to centre content in the visible area between the two panels.
    // V2 uses paddingRight + transformOrigin on the canvas wrapper to bake in the right-panel
    // offset — panX should be 0 so we don't double-compensate. V1 needs the explicit shift.
    setPanX(version === 2 ? 0 : (leftInset - rightInset) / 2);
    setPanY(newPanY);
  };

  const handleTidyUp = () => {
    // Reposition unconnected floating nodes neatly beside the flow without connecting them
    if (floatingNodes.length > 0) {
      const isHoriz = canvasLayout === 'horizontal';
      const cardW = isStepTypeVisuals ? 380 : 352;
      const colGap = 32; // gap between branch sub-columns (matches WorkflowCanvas)
      const cardH = 68;
      const vStep = cardH + 20; // card height + gap (vertical)
      const hStep = cardW + 20; // card width  + gap (horizontal)

      // Compute the flow's half-width from layout math rather than DOM measurement,
      // so branch columns (which aren't in nodeCardRefs) are accounted for.
      // When a condition node exists, the layout is two card-widths + colGap wide.
      const nodes = agentConfig.workflowNodes ?? [];
      const hasCondition = nodes.some(n => n.type === 'condition');
      // Half-width of the widest flow section (centered at x=0)
      const flowHalfW = hasCondition ? (cardW + colGap / 2 + cardW / 2) : (cardW / 2);
      // The disconnected column sits one full card-width + colGap to the right
      const disconnectedX = flowHalfW + colGap + cardW / 2;

      // Measure connected nodes using nodeCardRefs to find:
      //   vertical:   triggerCanvasY (top of trigger), flowBottomY
      //   horizontal: triggerCanvasX (left of trigger), flowBottomY
      let triggerCanvasY = 0;
      let triggerCanvasX = 0;
      let flowBottomY = 200; // fallback
      if (canvasContainerRef.current && nodeCardRefs.current.size > 0) {
        const containerRect = canvasContainerRef.current.getBoundingClientRect();
        const cy = containerRect.top  + containerRect.height / 2;
        const cx = containerRect.left + containerRect.width  / 2;
        const workflowNodeIds = new Set(nodes.map(n => n.id));
        let minTop = Infinity, maxBottom = -Infinity;
        let triggerLeft = 0;
        const triggerId = nodes.find(n => n.type === 'trigger')?.id;
        nodeCardRefs.current.forEach((el, id) => {
          if (!workflowNodeIds.has(id)) return;
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return;
          const top    = (r.top    - cy - panY) / zoom;
          const bottom = (r.bottom - cy - panY) / zoom;
          if (top    < minTop)    { minTop    = top; }
          if (bottom > maxBottom) { maxBottom = bottom; }
          if (id === triggerId) {
            triggerLeft = (r.left - cx - panX) / zoom;
          }
        });
        if (minTop !== Infinity)     { triggerCanvasY = minTop; }
        if (maxBottom !== -Infinity) { flowBottomY    = maxBottom; }
        triggerCanvasX = triggerLeft;
      }

      setFloatingNodes(prev => {
        return prev.map((n, i) => ({
          ...n,
          // Vertical:   column to the right of the widest flow section, stacked from trigger top
          // Horizontal: row below the flow, left-aligned to the trigger's left edge
          x: isHoriz ? triggerCanvasX + cardW / 2 + i * hStep : disconnectedX,
          // +11 shifts the group center down so the card top aligns with triggerCanvasY
          // (the "Detached" warning label below the card offsets the group's visual center)
          y: isHoriz ? flowBottomY + colGap + cardH / 2 + 11 : triggerCanvasY + cardH / 2 + 11 + i * vStep,
        }));
      });
    }
    // Snap all displaced flow nodes back to their default positions
    setNodePositions({});
    setDraggingNodeId(null);
  };

  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!draggedStep || !canvasContainerRef.current) return;
    e.preventDefault();
    const rect = canvasContainerRef.current.getBoundingClientRect();
    // Convert screen coords to canvas content coords (centered at 0,0)
    const x = (e.clientX - rect.left - rect.width / 2 - panX) / zoom;
    const y = (e.clientY - rect.top - rect.height / 2 - panY) / zoom;
    const newNode: WorkflowNode = {
      id: `${draggedStep.type}-${Date.now()}`,
      type: draggedStep.type,
      label: draggedStep.label,
      ...(draggedStep.connector ? { connector: draggedStep.connector } : {}),
    };
    setFloatingNodes(prev => [...prev, { ...newNode, x, y }]);
    setDraggedStep(null);
    setDragOverIndex(null);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, [data-no-pan]')) return;
    isPanningRef.current = true;
    setIsPanning(true);
    panStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, startPanX: panX, startPanY: panY };
    e.preventDefault();
  };
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (connectingFromId && canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect();
      setConnectLineEnd({
        x: (e.clientX - rect.left - rect.width / 2 - panX) / zoom,
        y: (e.clientY - rect.top - rect.height / 2 - panY) / zoom,
      });
      return;
    }
    if (draggingNodeId && canvasContainerRef.current) {
      hasDraggedRef.current = true;
      const rect = canvasContainerRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - rect.width / 2 - panX) / zoom;
      const mouseY = (e.clientY - rect.top - rect.height / 2 - panY) / zoom;
      const newX = mouseX - draggingOffsetRef.current.dx;
      const newY = mouseY - draggingOffsetRef.current.dy;
      if (floatingNodes.some(n => n.id === draggingNodeId)) {
        setFloatingNodes(prev => prev.map(n => n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n));
        // V2: compute nearest reattach drop zone while dragging a detached node (skip for notes)
        const isDraggingNote = floatingNodes.some(n => n.id === draggingNodeId && n.type === 'note');
        if (version === 2 && !isDraggingNote) {
          const rawNodes = agentConfig.workflowNodes || [];
          const condIdx = rawNodes.findIndex(n => n.type === 'condition');
          const preConNodes = condIdx >= 0 ? rawNodes.slice(0, condIdx) : rawNodes;
          if (preConNodes.length === 0) { setReattachDropIndex(1); return; }
          // Steps can never be inserted before the trigger (always at index 0)
          const minIdx = preConNodes[0]?.type === 'trigger' ? 1 : 0;
          // Horizontal layout: use X coords; vertical: use Y coords
          const firstEl = nodeCardRefs.current.get(preConNodes[0].id);
          if (firstEl) {
            const fr = firstEl.getBoundingClientRect();
            if (canvasLayout === 'horizontal') {
              if (e.clientY < fr.top - 24 || e.clientY > fr.bottom + 24) { setReattachDropIndex(null); return; }
            } else {
              if (e.clientX < fr.left - 24 || e.clientX > fr.right + 24) { setReattachDropIndex(null); return; }
            }
          }
          // Find which gap between node centres the cursor falls into
          const mids = preConNodes
            .map(n => { const el = nodeCardRefs.current.get(n.id); if (!el) return null; const r = el.getBoundingClientRect(); return canvasLayout === 'horizontal' ? (r.left + r.right) / 2 : (r.top + r.bottom) / 2; })
            .filter((m): m is number => m !== null);
          const cursor = canvasLayout === 'horizontal' ? e.clientX : e.clientY;
          if (mids.length === 0) { setReattachDropIndex(null); return; }
          if (cursor <= mids[0]) { setReattachDropIndex(minIdx); }
          else if (cursor >= mids[mids.length - 1]) { setReattachDropIndex(mids.length); }
          else {
            for (let i = 0; i < mids.length - 1; i++) {
              if (cursor >= mids[i] && cursor <= mids[i + 1]) { setReattachDropIndex(Math.max(minIdx, i + 1)); break; }
            }
          }
        }
        return;
      } else {
        setNodePositions(prev => ({ ...prev, [draggingNodeId]: { x: newX, y: newY } }));
      }
      return;
    }
    if (!isPanningRef.current) return;
    setPanX(panStartRef.current.startPanX + (e.clientX - panStartRef.current.mouseX));
    setPanY(panStartRef.current.startPanY + (e.clientY - panStartRef.current.mouseY));
  };
  const reattachNode = (nodeId: string, insertIndex: number) => {
    const floatNode = floatingNodes.find(n => n.id === nodeId);
    if (!floatNode) return;
    const { x: _x, y: _y, initRect: _r, ...node } = floatNode;
    const updated = [...workflowNodes];
    updated.splice(insertIndex, 0, node);
    setFloatingNodes(prev => prev.filter(n => n.id !== nodeId));
    setNodePositions(prev => { const { [nodeId]: _, ...rest } = prev; return rest; });
    updateWorkflowNodes(updated);
  };

  const handleCanvasStopPan = () => {
    isPanningRef.current = false;
    setIsPanning(false);
    // V2: if we were dragging a detached node over a drop zone, reattach it (notes are never reattachable)
    if (version === 2 && draggingNodeId && floatingNodes.some(n => n.id === draggingNodeId && n.type !== 'note') && reattachDropIndex !== null) {
      reattachNode(draggingNodeId, reattachDropIndex);
    }
    setReattachDropIndex(null);
    setDraggingNodeId(null);
    if (connectingFromId) stopConnecting(connectTargetIdx, floatingNodes, workflowNodes);
  };
  const handleClear = () => { updateWorkflowNodes([]); setSelectedNode(null); };

  const startConnecting = (nodeId: string, side: 'top' | 'bottom', e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setConnectingFromId(nodeId);
    setConnectingSide(side);
    if (canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect();
      setConnectLineEnd({
        x: (e.clientX - rect.left - rect.width / 2 - panX) / zoom,
        y: (e.clientY - rect.top - rect.height / 2 - panY) / zoom,
      });
    }
  };

  const stopConnecting = (targetIdx: number | null, nodes: typeof floatingNodes, wfNodes: typeof workflowNodes) => {
    if (targetIdx !== null) {
      const floating = nodes.find(n => n.id === connectingFromId);
      if (floating) {
        const { x: _x, y: _y, ...node } = floating;
        const updated = [...wfNodes];
        updated.splice(targetIdx, 0, node);
        updateWorkflowNodes(updated);
        setFloatingNodes(prev => prev.filter(n => n.id !== connectingFromId));
        setNodePositions(prev => { const { [floating.id]: _, ...rest } = prev; return rest; });
      }
    }
    setConnectingFromId(null);
    setConnectingSide(null);
    setConnectTargetIdx(null);
    setConnectLineEnd(null);
  };

  const applyBranchChoice = (branch: 'true' | 'false') => {
    if (!branchDialog) return;
    const { pendingNode, insertIndex, afterNodes } = branchDialog;
    const beforeNodes = workflowNodes.slice(0, insertIndex);
    // afterNodes extends to end of array so remaining is always empty
    const remaining = workflowNodes.slice(insertIndex + afterNodes.length);
    const taggedAfter = afterNodes.map(n => {
      // Nodes already explicitly assigned to another condition's branch stay unchanged
      if (n.parentConditionId) return n;
      // Tag main-flow nodes with the chosen branch of the new condition (V1 + V3 compat)
      return { ...n, branch, subbranch: branch, parentConditionId: pendingNode.id };
    });
    updateWorkflowNodes([...beforeNodes, pendingNode, ...taggedAfter, ...remaining]);
    setBranchDialog(null);
  };

  // Steps that need a "select existing or create new" dialog before being added


  // Resolve the display name for a chosen item so the canvas card can show it
  const resolveInstanceName = (label: string, mode: string): string | undefined => {
    if (mode === 'create') return undefined;
    if (label === 'MCP')          return MOCK_MCPS.find(m => m.id === mode)?.name;
    if (label === 'Computer Use') return MOCK_CUAS.find(c => c.id === mode)?.name;
    if (label === 'Agent')        return MOCK_AGENTS.find(a => a.id === mode)?.name;
    if (label === 'Prompt')       return MOCK_PROMPTS.find(p => p.id === mode)?.name;
    if (label === 'Classify')     return MOCK_CLASSIFIERS.find(c => c.id === mode)?.name;
    if (label === 'Guardrails')   return MOCK_GUARDRAILS.find(g => g.id === mode)?.name;
    if (label === 'Extract')       return MOCK_EXTRACTORS.find(e => e.id === mode)?.name;
    if (label === 'M365 Copilot') return MOCK_M365_COPILOTS.find(m => m.id === mode)?.name;
    if (label === 'Human Review') return HUMAN_REVIEW_OPTIONS.find(o => o.id === mode)?.name;
  };

  // Called when the user picks an existing item (mode = item id) or create new (mode = 'create')
  const confirmConfigDialog = (mode: string) => {
    if (!configDialog) return;
    const { pendingNode, insertIndex } = configDialog;
    const instanceName = resolveInstanceName(pendingNode.label, mode);
    // Persist instanceMode + instanceName in config so the card and panel can restore state
    const nodeToInsert: WorkflowNode = {
      ...pendingNode,
      config: { ...pendingNode.config, instanceMode: mode, instanceName, stepTypeLabel: pendingNode.label },
    };
    const updated = [...workflowNodes];
    updated.splice(insertIndex, 0, nodeToInsert);
    updateWorkflowNodes(updated);
    skipNodeConfigResetRef.current = true;
    setSelectedNode(nodeToInsert);
    setNodeConfigMode(mode);
    setConfigDialog(null);
  };

  // keepBranch: which branch's steps to promote back into the main flow.
  // 'none' discards both branches entirely.
  const applyDeleteBranch = (keepBranch: 'true' | 'false' | 'none') => {
    if (!deleteBranchDialog) return;
    const { conditionId, trueNodes: dTrue, falseNodes: dFalse } = deleteBranchDialog;
    const condIdx = workflowNodes.findIndex(n => n.id === conditionId);

    // Full position reset — structural change warrants clean slate
    setNodePositions({});
    closeAddStep();
    setHoveredConnection(null);

    const before = workflowNodes.slice(0, condIdx);
    // Nodes after the condition that belong to OTHER conditions (not this one) must be preserved.
    const allBranchIds = new Set([...dTrue, ...dFalse].map(n => n.id));
    const after = workflowNodes.slice(condIdx + 1).filter(n => !allBranchIds.has(n.id));
    let kept: WorkflowNode[] = [];
    if (keepBranch === 'true') {
      // Strip all branch-routing fields so promoted nodes become regular flow nodes
      kept = dTrue.map(({ branch: _b, parentConditionId: _p, subbranch: _s, ...rest }) => rest);
    } else if (keepBranch === 'false') {
      kept = dFalse.map(({ branch: _b, parentConditionId: _p, subbranch: _s, ...rest }) => rest);
    }

    updateWorkflowNodes([...before, ...kept, ...after]);
    setDeleteBranchDialog(null);
  };

  const openAddStep = (index: number, branch?: string, parentConditionId?: string, subbranch?: 'true' | 'false') => {
    setInsertAtIndex(index);
    setInsertBranch(branch ?? null);
    setInsertParentConditionId(parentConditionId ?? null);
    setInsertSubbranch(subbranch ?? null);
    setV1PaletteView('root');
    setV1PaletteConnector(null);
    setV1PaletteQuery('');
    const prevNode = index > 0 ? (workflowNodes[index - 1] ?? null) : (workflowNodes[0] ?? null);
    setV2PaletteCategory(getV2Suggestions(prevNode).length > 0 ? 'suggested' : 'all');
    setV2PaletteQuery('');
    setV2BuiltinTool(null);
    setV2MicrosoftGroup(null);
    setV2ConnectorDetail(null);
    setV2McpDrillIn(false);
    setV2PreviewAction(null);
    if (version !== 1) setSelectedNode(null);
  };
  const closeAddStep = () => { setInsertAtIndex(null); setInsertBranch(null); setDisplacedInsert(null); setInsertParentConditionId(null); setInsertSubbranch(null); };

  const addStep = (type: WorkflowNode['type'], label: string, connector?: string) => {
    if (insertAtIndex === null) return;
    const newNode: WorkflowNode = {
      id: `${type}-${Date.now()}`,
      type,
      label,
      ...(connector ? { connector } : {}),
      ...(insertParentConditionId
        ? { parentConditionId: insertParentConditionId, subbranch: insertSubbranch ?? 'true' }
        : insertBranch ? { branch: insertBranch } : {}),
    };
    // Steps that require "select existing or create new" — show config dialog first
    if (NEEDS_CONFIG_DIALOG(label)) {
      setConfigDialog({ pendingNode: newNode, insertIndex: insertAtIndex });
      setInsertAtIndex(null);
      setInsertBranch(null);
      setInsertParentConditionId(null);
      setInsertSubbranch(null);
      setDisplacedInsert(null);
      return;
    }
    // When inserting a condition in the middle of the main flow, ask which branch the
    // downstream steps should go on. Skip this when already inside a branch or sub-branch —
    // the new node already has its branch context and there are no main-flow nodes to reassign.
    if (type === 'condition' && !insertBranch && !insertParentConditionId) {
      const afterNodes = workflowNodes.slice(insertAtIndex);
      if (afterNodes.length > 0) {
        setBranchDialog({ pendingNode: newNode, insertIndex: insertAtIndex, afterNodes });
        setInsertAtIndex(null);
        setDisplacedInsert(null);
        return;
      }
    }
    const updated = [...workflowNodes];
    updated.splice(insertAtIndex, 0, newNode);
    updateWorkflowNodes(updated);
    setInsertAtIndex(null);
    setDisplacedInsert(null);
    setSelectedNode(newNode);
  };

  // Adds a pre-configured MCP node (bypasses the config dialog)
  const addMcpProductStep = (serverId: string) => {
    if (insertAtIndex === null) return;
    const mcp = MOCK_MCPS.find(m => m.id === serverId);
    const newNode: WorkflowNode = {
      id: `action-${Date.now()}`,
      type: 'action',
      label: 'MCP',
      config: { instanceMode: serverId, instanceName: mcp?.name, stepTypeLabel: 'MCP' },
      ...(insertBranch ? { branch: insertBranch } : {}),
    };
    const updated = [...workflowNodes];
    updated.splice(insertAtIndex, 0, newNode);
    updateWorkflowNodes(updated);
    skipNodeConfigResetRef.current = true;
    setSelectedNode(newNode);
    setNodeConfigMode(serverId);
    setInsertAtIndex(null);
    setDisplacedInsert(null);
  };

  const dropStep = (step: StepType, index: number) => {
    // Note step — always floats on canvas, never inserted into the flow
    if (step.type === 'note') {
      const existingNotes = floatingNodes.filter(n => n.type === 'note').length;
      const newNode: WorkflowNode = {
        id: `note-${Date.now()}`,
        type: 'note',
        label: 'Note',
      };
      setFloatingNodes(prev => [...prev, { ...newNode, x: 320 + existingNotes * 20, y: -80 + existingNotes * 20 }]);
      setDraggedStep(null);
      setDragOverIndex(null);
      return;
    }
    // MCP product item dropped — bypass config dialog and pre-configure
    if (step.mcpServerId) {
      const mcp = MOCK_MCPS.find(m => m.id === step.mcpServerId);
      const newNode: WorkflowNode = {
        id: `action-${Date.now()}`,
        type: 'action',
        label: 'MCP',
        config: { instanceMode: step.mcpServerId, instanceName: mcp?.name, stepTypeLabel: 'MCP' },
      };
      const updated = [...workflowNodes];
      updated.splice(index, 0, newNode);
      updateWorkflowNodes(updated);
      skipNodeConfigResetRef.current = true;
      setSelectedNode(newNode);
      setNodeConfigMode(step.mcpServerId);
      setDraggedStep(null);
      setDragOverIndex(null);
      return;
    }
    const newNode: WorkflowNode = {
      id: `${step.type}-${Date.now()}`,
      type: step.type,
      label: step.label,
      ...(step.connector ? { connector: step.connector } : {}),
    };
    if (NEEDS_CONFIG_DIALOG(step.label)) {
      setConfigDialog({ pendingNode: newNode, insertIndex: index });
      setDraggedStep(null);
      setDragOverIndex(null);
      return;
    }
    if (step.type === 'condition') {
      const afterNodes = workflowNodes.slice(index);
      if (afterNodes.length > 0) {
        setBranchDialog({ pendingNode: newNode, insertIndex: index, afterNodes });
        setDraggedStep(null);
        setDragOverIndex(null);
        return;
      }
    }
    const updated = [...workflowNodes];
    updated.splice(index, 0, newNode);
    updateWorkflowNodes(updated);
    setDraggedStep(null);
    setDragOverIndex(null);
  };

  useEffect(() => {
    if (version === 1 && insertAtIndex !== null) {
      setTimeout(() => v1PaletteInputRef.current?.focus(), 50);
    }
    if (version === 2 && insertAtIndex !== null) {
      setTimeout(() => v2PaletteInputRef.current?.focus(), 50);
    }
  }, [version, insertAtIndex]);

  useEffect(() => {
    if (selectedNode) {
      setDisplayedNode(selectedNode);
    } else {
      const t = setTimeout(() => setDisplayedNode(null), 250);
      return () => clearTimeout(t);
    }
  }, [selectedNode]);

  // When a different node is selected, restore its saved instanceMode (or default to 'pick').
  // Skip one cycle when confirmConfigDialog has already set the correct mode.
  useEffect(() => {
    if (skipNodeConfigResetRef.current) { skipNodeConfigResetRef.current = false; return; }
    setNodeConfigMode(selectedNode?.config?.instanceMode ?? 'pick');
    setRightPanelTab('configure');
    setStepHitlDrillIn(false);
    setStepHitlNoResponse('nothing');
    setStepHitlEscalateContacts([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode?.id]); // intentionally depends only on node ID — re-running on instanceMode change would cause a loop

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (nodeMenuRef.current && !nodeMenuRef.current.contains(e.target as Node)) setNodeMenuOpen(null);
    };
    if (nodeMenuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [nodeMenuOpen]);

  // Stop node dragging / cancel connecting even if mouse released outside canvas
  useEffect(() => {
    const stop = () => {
      setDraggingNodeId(null);
      // Cancel connection (no target); completion is handled by onMouseUp on canvas
      setConnectingFromId(null);
      setConnectingSide(null);
      setConnectTargetIdx(null);
      setConnectLineEnd(null);
    };
    document.addEventListener('mouseup', stop);
    return () => document.removeEventListener('mouseup', stop);
  }, []);

  // Trackpad pinch-to-zoom and scroll-to-pan. The ref pattern keeps the effect
  // stable (attached once) while the handler always reads the latest state values.
  wheelHandlerRef.current = (e: WheelEvent) => {
    e.preventDefault();
    if (!canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      // Pinch (trackpad) or Ctrl+scroll (mouse) → zoom centered at cursor
      const zoomFactor = Math.exp(-e.deltaY * 0.005);
      const newZoom = Math.max(0.3, Math.min(2, parseFloat((zoom * zoomFactor).toFixed(2))));
      const ratio = newZoom / zoom;
      const offsetX = e.clientX - rect.left - rect.width / 2;
      const offsetY = e.clientY - rect.top - rect.height / 2;
      setZoom(newZoom);
      setPanX(offsetX * (1 - ratio) + panX * ratio);
      setPanY(offsetY * (1 - ratio) + panY * ratio);
    } else {
      // Two-finger scroll (trackpad) or plain scroll (mouse) → pan
      setPanX(prev => prev - e.deltaX);
      setPanY(prev => prev - e.deltaY);
    }
  };
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => wheelHandlerRef.current(e);
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // Measure rendered node card centers in SVG pre-transform coords so displaced
  // connector lines can be drawn as SVG paths that track the moved cards.
  useLayoutEffect(() => {
    if (!canvasContainerRef.current) return;
    const cr = canvasContainerRef.current.getBoundingClientRect();
    const hw = cr.width / 2, hh = cr.height / 2;
    containerHalfRef.current = { w: hw, h: hh };
    const pos: Record<string, { x: number; y: number; halfW: number; halfH: number }> = {};
    nodeCardRefs.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      // Convert screen center → pre-transform SVG coordinate space inside the transform div
      pos[id] = {
        x: (r.left + r.width / 2 - cr.left - panX - hw) / zoom + hw,
        y: (r.top + r.height / 2 - cr.top - panY - hh) / zoom + hh,
        halfW: r.width / 2 / zoom,
        halfH: r.height / 2 / zoom,
      };
    });
    // Override x/y for displaced nodes so SVG lines track the displaced card,
    // not the visibility:hidden ghost left at the original inline position.
    // halfW/halfH are kept from the DOM measurement (same card dimensions either way).
    for (const [nodeId, dispPos] of Object.entries(nodePositions)) {
      if (pos[nodeId]) {
        pos[nodeId] = { ...pos[nodeId], x: dispPos.x + hw, y: dispPos.y + hh };
      }
    }
    // Measure badge/pill positions so displaced branch nodes connect from the correct exit point.
    if (canvasLayout === 'horizontal' && !isStepTypeVisuals) {
      // !isStepTypeVisuals horizontal: badges don't exist as separate DOM elements.
      // Instead, read pill dot positions directly from each condition card.
      const allConds = (agentConfig.workflowNodes ?? []).filter((n: { type: string }) => n.type === 'condition');
      for (const cond of allConds) {
        const cardEl = nodeCardRefs.current.get(cond.id);
        if (!cardEl) continue;
        const pills = Array.from(cardEl.querySelectorAll<HTMLElement>('[data-branch-pill]'))
          .sort((a, b) => Number(a.dataset.branchPill) - Number(b.dataset.branchPill));
        const pillKeys = [
          `__true_badge__${cond.id}__`,
          ...Array.from({ length: Math.max(0, pills.length - 2) }, (_, i) => `__ei_badge_${i}__${cond.id}__`),
          `__false_badge__${cond.id}__`,
        ];
        pills.forEach((pill, i) => {
          const pillBox = pill.firstElementChild as HTMLElement | null;
          const dotEl = pillBox ? pillBox.lastElementChild as HTMLElement | null : null;
          const target = dotEl ?? pill;
          const r = target.getBoundingClientRect();
          pos[pillKeys[i]] = {
            x: (r.right - cr.left - panX - hw) / zoom + hw,
            y: (r.top + r.height / 2 - cr.top - panY - hh) / zoom + hh,
            halfW: 0, halfH: 0,
          };
        });
      }
    } else {
      // isStepTypeVisuals or vertical: measure badge elements via refs (still first condition only — acceptable limitation).
      const firstCond = (agentConfig.workflowNodes ?? []).find((n: { type: string; parentConditionId?: string }) => n.type === 'condition' && !n.parentConditionId);
      for (const [ref, domKey] of [
        [trueBadgeRef.current, firstCond ? `__true_badge__${firstCond.id}__` : '__true_badge__'],
        [falseBadgeRef.current, firstCond ? `__false_badge__${firstCond.id}__` : '__false_badge__'],
      ] as const) {
        if (ref) {
          const r = (ref as HTMLElement).getBoundingClientRect();
          if (canvasLayout === 'horizontal') {
            // Horizontal mode: line exits from right edge of pill, at vertical center
            pos[domKey as string] = {
              x: (r.right - cr.left - panX - hw) / zoom + hw,
              y: (r.top + r.height / 2 - cr.top - panY - hh) / zoom + hh,
              halfW: 0, halfH: 0,
            };
          } else {
            // Vertical mode: line exits from bottom center of badge
            pos[domKey as string] = {
              x: (r.left + r.width / 2 - cr.left - panX - hw) / zoom + hw,
              y: (r.bottom - cr.top - panY - hh) / zoom + hh,
              halfW: 0, halfH: 0,
            };
          }
        }
      }
    }
    setNodeSvgPos(pos);
  }, [nodePositions, panX, panY, zoom, canvasLayout, agentConfig.workflowNodes, floatingNodes]);

  const defaultNodes = DEFAULT_NODES;

  // Patch stored nodes that are missing instanceName so canvas and overview always agree.
  // This handles stale localStorage state from before instanceName was added to defaultNodes.
  const workflowNodes: WorkflowNode[] = useMemo(() => (agentConfig.workflowNodes || defaultNodes).map(n => {
    if (n.id === 'cua-1' && !n.config?.instanceName) {
      return {
        ...n,
        config: { ...n.config, instanceName: 'Contoso Dev Environment', stepTypeLabel: 'Computer Use', instanceMode: 'dev-env' },
        hitlEnabled: true, hitlMode: 'custom' as const, hitlLocked: true,
        hitlContacts: [{ id: 'cua-hitl-1', name: 'Priya Nair', email: 'priya.nair@contoso.com', notifyVia: 'teams' as const }],
      };
    }
    if (n.id === 'agent-2' && !n.config?.instanceName) {
      return {
        ...n,
        config: { ...n.config, instanceName: 'Customer Support Agent', stepTypeLabel: 'Agent', instanceMode: 'create' },
        hitlEnabled: true, hitlMode: 'custom' as const, hitlLocked: false,
        hitlContacts: n.hitlContacts?.length ? n.hitlContacts : [{ id: 'wf-hitl-1', name: 'Marcus Webb', email: 'marcus.webb@contoso.com', notifyVia: 'email' as const }],
      };
    }
    return n;
  }), [agentConfig.workflowNodes, defaultNodes]);

  // Auto-version: track accumulated structural changes since last version
  // Score: +2 per added/removed node, +1 per config change. Threshold = 5.
  const autoVersionBaseRef = useRef<WorkflowNode[]>(workflowNodes);
  useEffect(() => {
    const base = autoVersionBaseRef.current;
    const baseIds = new Set(base.map(n => n.id));
    const currIds = new Set(workflowNodes.map(n => n.id));
    const added = workflowNodes.filter(n => !baseIds.has(n.id)).length;
    const removed = base.filter(n => !currIds.has(n.id)).length;
    const configChanged = workflowNodes.filter(n => {
      const prev = base.find(b => b.id === n.id);
      return prev && JSON.stringify(prev.config) !== JSON.stringify(n.config);
    }).length;
    const score = (added + removed) * 2 + configChanged;
    if (score >= 5) {
      autoVersionBaseRef.current = workflowNodes;
      pushVersionEntry(workflowNodes, 'auto', workflowVersionHistory[0], workflowVersionHistory, score);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowNodes]);

  // Auto fit-to-screen on initial load.
  // Wait until nodeCardRefs is populated (cards have mounted) before fitting.
  // Also re-fits when isHelperCollapsed changes during the initial load window, since the chat
  // panel collapses (expanding the canvas) in a sibling useEffect after cards first mount.
  const agentIdFitRef = useRef<string | null>(null);
  const initialFitDoneRef = useRef(false);
  useEffect(() => {
    if (workflowNodes.length === 0) return;

    // If the agent changed, reset so we fit again for the new workflow.
    if (agentIdFitRef.current !== agentConfig.id) {
      agentIdFitRef.current = agentConfig.id;
      initialFitDoneRef.current = false;
    }

    // Once the initial fit is done, don't re-fit on every isHelperCollapsed toggle.
    if (initialFitDoneRef.current) return;

    let fitted = false;
    const tryFit = () => {
      if (fitted) return;
      if (nodeCardRefs.current.size >= workflowNodes.length) {
        fitted = true;
        initialFitDoneRef.current = true;
        handleFitToScreen();
        ro.disconnect();
      }
    };

    // Poll via ResizeObserver on the container — fires whenever DOM changes size,
    // which happens as cards mount and the canvas layout settles.
    const ro = new ResizeObserver(tryFit);
    if (canvasContainerRef.current) ro.observe(canvasContainerRef.current);

    // Also try immediately and as a fallback timeout
    tryFit();
    const fallback = setTimeout(() => { if (!fitted) { fitted = true; initialFitDoneRef.current = true; handleFitToScreen(); ro.disconnect(); } }, 1000);
    return () => { ro.disconnect(); clearTimeout(fallback); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentConfig.id, workflowNodes.length, isHelperCollapsed]);

  // Auto-generate workflow description (V2 only) when nodes change.
  // Only fires if the description is empty or still the default placeholder.
  useEffect(() => {
    if (version !== 2) return;
    if (!workflowNodes.length) return;
    if (agentConfig.description && agentConfig.description !== AUTO_DESC_PLACEHOLDER) return;
    const timer = setTimeout(async () => {
      const stepSummary = workflowNodes.map(n => {
        const name = n.config?.instanceName || n.label;
        const type = n.config?.stepTypeLabel || n.type;
        return `${name} (${type})`;
      }).join(', ');
      try {
        const result = await callModel({
          model: 'fast',
          maxTokens: 60,
          system: 'You write one-sentence workflow descriptions. Be concise and specific — describe what the workflow does end-to-end based on its steps. No quotes. No punctuation at the end.',
          messages: [{ role: 'user', content: `Steps: ${stepSummary}` }],
        });
        updateAgentConfig({ description: result.trim() });
      } catch {
        // silently ignore — description stays as-is
      }
    }, 2000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowNodes, version]);

  // When a node reappears in workflowNodes (e.g. via undo), remove it from floatingNodes.
  // Depend on agentConfig.workflowNodes (stable state) not the derived `workflowNodes` array
  // to avoid an infinite loop from the new reference created by .map() on every render.
  useEffect(() => {
    if (floatingNodes.length === 0) return;
    const workflowIds = new Set((agentConfig.workflowNodes || []).map(n => n.id));
    setFloatingNodes(prev => {
      const next = prev.filter(n => !workflowIds.has(n.id));
      return next.length === prev.length ? prev : next; // bail out if nothing changed
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentConfig.workflowNodes]);


  const renameNode = (nodeId: string, newLabel: string) => {
    if (!newLabel.trim()) return;
    const updated = workflowNodes.map(n => n.id === nodeId ? { ...n, label: newLabel.trim() } : n);
    updateWorkflowNodes(updated);
    if (selectedNode?.id === nodeId) setSelectedNode({ ...selectedNode, label: newLabel.trim() });
  };

  // isUnnamedStep is imported from workflowConstants

  // A step is ready to test once the user has renamed it or added instructions
  const isStepConfigured = (node: WorkflowNode) =>
    node.label === 'MCP' || !isUnnamedStep(node) || !!node.config?.instructions;

  const patchNode = (nodeId: string, patch: Partial<WorkflowNode>) => {
    const updated = workflowNodes.map(n => n.id === nodeId ? { ...n, ...patch } : n);
    updateWorkflowNodes(updated);
    if (selectedNode?.id === nodeId) setSelectedNode({ ...selectedNode, ...patch });
  };

  // After workflowNodes shrinks from a detach, the flex-centered flow re-centers and
  // shifts all remaining nodes. This useLayoutEffect fires synchronously after the DOM
  // updates (before the browser paints), measures the actual shift via the anchor node,
  // and corrects panX/panY so nothing appears to move.
  // The CSS transition is suppressed directly on the DOM element (not via React state)
  // so it's guaranteed to be off before any paint happens.
  useLayoutEffect(() => {
    const snapshots = preDetachSnapshot.current;
    if (!snapshots.length) return;
    preDetachSnapshot.current = [];
    const restoreTransition = () => {
      if (canvasTransformRef.current) canvasTransformRef.current.style.transition = '';
    };
    // Find the snapshot with the largest actual movement — this is the node that shifted
    // most (nodes after the detached one move more than nodes before it in branch layouts).
    // Use that delta to correct pan so that node stays put; all nodes that shifted by the
    // same amount will also be corrected. Nodes that didn't shift are unaffected.
    let bestDx = 0, bestDy = 0;
    for (const { id, left: prevLeft, top: prevTop } of snapshots) {
      const el = nodeCardRefs.current.get(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const dx = r.left - prevLeft;
      const dy = r.top  - prevTop;

      if (Math.abs(dx) > Math.abs(bestDx)) bestDx = dx;
      if (Math.abs(dy) > Math.abs(bestDy)) bestDy = dy;
    }

    if (Math.abs(bestDx) > 0.5) setPanX(prev => prev - bestDx);
    if (Math.abs(bestDy) > 0.5) setPanY(prev => prev - bestDy);
    requestAnimationFrame(() => requestAnimationFrame(restoreTransition));
   
  }, [workflowNodes]);

  const detachNode = (nodeId: string) => {
    const node = workflowNodes.find(n => n.id === nodeId);
    if (!node) return;

    // Suppress the canvas transform CSS transition immediately via DOM ref,
    // before any React state updates, so the re-centering shift is invisible.
    if (canvasTransformRef.current) canvasTransformRef.current.style.transition = 'none';

    // Capture the detached node's screen position for the FLIP animation.
    const initRect = nodeCardRefs.current.get(nodeId)?.getBoundingClientRect();

    // Snapshot every remaining node's screen position. Different nodes may shift by
    // different amounts (branch layout re-centering is not uniform). The useLayoutEffect
    // picks the node with the largest actual movement and corrects pan based on that.
    const snapshots: Array<{ id: string; left: number; top: number }> = [];
    for (const n of workflowNodes) {
      if (n.id === nodeId) continue;
      const el = nodeCardRefs.current.get(n.id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      snapshots.push({ id: n.id, left: r.left, top: r.top });
    }
    preDetachSnapshot.current = snapshots;

    const existingDetached = floatingNodes.length;
    setFloatingNodes(prev => [...prev, { ...node, x: 500, y: existingDetached * 100, initRect }]);
    setNodePositions(prev => { const { [nodeId]: _, ...rest } = prev; return rest; });
    if (selectedNode?.id === nodeId) setSelectedNode(null);
    updateWorkflowNodes(workflowNodes.filter(n => n.id !== nodeId));
  };

  const deleteNode = (nodeId: string) => {
    if (floatingNodes.some(n => n.id === nodeId)) {
      setFloatingNodes(prev => prev.filter(n => n.id !== nodeId));
      if (selectedNode?.id === nodeId) setSelectedNode(null);
      return;
    }
    const node = workflowNodes.find(n => n.id === nodeId);
    if (!node) return;

    // If deleting a condition that has steps in its branches, ask what to do with them.
    if (node.type === 'condition') {
      const condIdx = workflowNodes.findIndex(n => n.id === nodeId);
      // Legacy detection: contiguous .branch nodes immediately after this condition,
      // but stop if we hit a node that explicitly belongs to a different condition.
      const legacyBranches: WorkflowNode[] = [];
      for (let i = condIdx + 1; i < workflowNodes.length; i++) {
        const candidate = workflowNodes[i];
        if (candidate.parentConditionId && candidate.parentConditionId !== nodeId) break;
        if (candidate.branch) legacyBranches.push(candidate);
        else break;
      }
      // Structural detection: any node whose parentConditionId points at this condition.
      const nestedBranches = workflowNodes.filter(n => n.parentConditionId === nodeId);
      // Merge and dedupe by id to get the full set of branch nodes for this condition.
      const branchById = new Map<string, WorkflowNode>();
      for (const b of [...legacyBranches, ...nestedBranches]) {
        if (!branchById.has(b.id)) branchById.set(b.id, b);
      }
      const allBranches = Array.from(branchById.values());
      const condTrueNodes = allBranches.filter(n => n.branch === 'true' || n.subbranch === 'true');
      const condFalseNodes = allBranches.filter(n => n.branch === 'false' || n.subbranch === 'false');
      if (condTrueNodes.length > 0 || condFalseNodes.length > 0) {
        if (selectedNode?.id === nodeId) setSelectedNode(null);
        setDeleteBranchDialog({ conditionId: nodeId, trueNodes: condTrueNodes, falseNodes: condFalseNodes });
        return;
      }
    }

    // Simple deletion (no branches, or condition with empty branches)
    setNodePositions(prev => { const { [nodeId]: _, ...rest } = prev; return rest; });
    if (selectedNode?.id === nodeId) setSelectedNode(null);
    updateWorkflowNodes(workflowNodes.filter(n => n.id !== nodeId));
  };

  const nodeIconStyle = { color: 'hsl(var(--primary))' };
  const getNodeIcon = (node: WorkflowNode) => {
    // Trigger nodes always get the lightning bolt regardless of connector type
    if (node.type === 'trigger') return <Flash24Filled style={version !== 2 ? { color: 'hsl(var(--status-success))' } : nodeIconStyle} />;
    // Match by label first so dragged/added steps show their exact palette icon
    const stepMatch = ALL_STEPS.find(s => s.label === node.label);
    if (stepMatch) return stepMatch.icon;
    // Connector actions — use the connector's product icon
    if (node.connector) {
      const iconSrc = getConnectorIconSrc(node.connector);
      if (iconSrc) return <img src={iconSrc} alt="" style={{ width: 20, height: 20, flexShrink: 0 }} />;
      const bg = connectorColor(node.connector);
      const initials = node.connector.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
      return <div style={{ width: 20, height: 20, borderRadius: 4, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ color: 'white', fontWeight: 700, fontSize: 8 }}>{initials}</span></div>;
    }
    // Fallback by type for default/renamed nodes
    switch (node.type) {
      case 'ai-action': return PromptIcon;
      case 'agent':     return <Agents24Filled style={nodeIconStyle} />;
      case 'condition': return <ArrowSplit24Filled style={{ color: CONTROL_FLOW_COLOR }} />;
      default:          return <Flash24Filled style={nodeIconStyle} />;
    }
  };


  // ─── Return everything the render sections need ──────────────────────────
  return {
    // Context values
    agentConfig,
    updateAgentConfig,
    updateWithHistory,
    isAgentGlobalUndo,
    updateWorkflowNodes,
    version,
    isGeneratingWorkflow,

    // Core selection / navigation state
    selectedNode, setSelectedNode,
    insertAtIndex, setInsertAtIndex,
    nodeMenuOpen, setNodeMenuOpen,
    displayedNode, setDisplayedNode,
    zoom, setZoom,

    // Overview header editing
    isEditingHeader, setIsEditingHeader,
    nameInputValue, setNameInputValue,
    descInputValue, setDescInputValue,
    showOverviewIconPicker, setShowOverviewIconPicker,
    nameInputRef,
    startEditingHeader,
    saveHeader,
    cancelHeader,

    // HITL contact form state (global)
    hitlAddOpen, setHitlAddOpen,
    hitlAddPhase, setHitlAddPhase,
    hitlName, setHitlName,
    hitlNotifyVia, setHitlNotifyVia,
    hitlEmail, setHitlEmail,
    hitlEditingId, setHitlEditingId,
    hitlEditNotifyVia, setHitlEditNotifyVia,
    hitlEditEmail, setHitlEditEmail,
    hitlNotifyFrequency, setHitlNotifyFrequency,
    hitlNoResponse, setHitlNoResponse,
    hitlNoResponseDelay, setHitlNoResponseDelay,
    hitlEscalateWarnVisible, setHitlEscalateWarnVisible,
    hitlEscalateContacts, setHitlEscalateContacts,
    hitlEscalateAddOpen, setHitlEscalateAddOpen,
    hitlEscalateAddPhase, setHitlEscalateAddPhase,
    hitlEscalateName, setHitlEscalateName,
    hitlEscalateEmail, setHitlEscalateEmail,
    hitlEscalateNotifyVia, setHitlEscalateNotifyVia,
    hitlContactMenuId, setHitlContactMenuId,
    hitlContactMenuPos, setHitlContactMenuPos,
    hitlWhoDetailOpen, setHitlWhoDetailOpen,

    // CUA state
    cuaMachineType, setCuaMachineType,
    cuaConnectionStatus, setCuaConnectionStatus,
    cuaConnectionValue, setCuaConnectionValue,
    cuaMachineMenuOpen, setCuaMachineMenuOpen,
    cuaMachineMenuPos, setCuaMachineMenuPos,

    // Step-level HITL
    stepHitlAddOpen, setStepHitlAddOpen,
    stepHitlAddPhase, setStepHitlAddPhase,
    stepHitlName, setStepHitlName,
    stepHitlEmail, setStepHitlEmail,
    stepHitlNotifyVia, setStepHitlNotifyVia,
    stepHitlEditingId, setStepHitlEditingId,
    stepHitlEditNotifyVia, setStepHitlEditNotifyVia,
    stepHitlEditEmail, setStepHitlEditEmail,
    stepHitlDrillIn, setStepHitlDrillIn,
    dismissedHitlBanners, setDismissedHitlBanners,
    stepHitlNoResponse, setStepHitlNoResponse,
    stepHitlEscalateContacts, setStepHitlEscalateContacts,
    stepHitlEscalateAddOpen, setStepHitlEscalateAddOpen,
    stepHitlEscalateAddPhase, setStepHitlEscalateAddPhase,
    stepHitlEscalateName, setStepHitlEscalateName,
    stepHitlEscalateEmail, setStepHitlEscalateEmail,
    stepHitlEscalateNotifyVia, setStepHitlEscalateNotifyVia,
    stepHitlContactMenuId, setStepHitlContactMenuId,
    stepHitlContactMenuPos, setStepHitlContactMenuPos,

    // Canvas layout + drag + pan
    canvasLayout, setCanvasLayout,
    floatingNodes, setFloatingNodes,
    nodePositions, setNodePositions,
    draggingNodeId, setDraggingNodeId,
    draggedStep, setDraggedStep,
    dragOverIndex, setDragOverIndex,
    panX, setPanX,
    panY, setPanY,
    isPanning, setIsPanning,
    canvasTransformRef,
    isPanningRef,
    panStartRef,

    // Refs
    v1PaletteInputRef,
    v2PaletteInputRef,
    nodeMenuRef,
    canvasContainerRef,
    canvasContentRef,
    rightPanelScrollRef,
    draggingOffsetRef,
    hasDraggedRef,
    wheelHandlerRef,
    nodeCardRefs,
    trueBadgeRef,
    falseBadgeRef,
    containerHalfRef,
    mcpFlyoutBtnRef,
    skipNodeConfigResetRef,

    // SVG positions
    nodeSvgPos, setNodeSvgPos,
    hoveredConnection, setHoveredConnection,

    // Displaced insert / branch
    displacedInsert, setDisplacedInsert,
    insertBranch, setInsertBranch,
    insertParentConditionId, insertSubbranch,

    // V1 panel navigation
    panelView, setPanelView,
    v1PanelCollapsed, setV1PanelCollapsed,
    selectedConnector, setSelectedConnector,

    // V1 palette modal
    v1PaletteView, setV1PaletteView,
    v1PaletteConnector, setV1PaletteConnector,
    v1PaletteQuery, setV1PaletteQuery,
    v1PaletteConnectorOnly, setV1PaletteConnectorOnly,
    v1PaletteFavorites, setV1PaletteFavorites,
    v1PaletteCollapsed, setV1PaletteCollapsed,

    // V1 trigger
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

    // V2 palette modal
    v2PaletteCategory, setV2PaletteCategory,
    v2PaletteQuery, setV2PaletteQuery,
    v2BuiltinTool, setV2BuiltinTool,
    v2MicrosoftGroup, setV2MicrosoftGroup,
    v2ConnectorDetail, setV2ConnectorDetail,
    v2McpDrillIn, setV2McpDrillIn,
    v2PreviewAction, setV2PreviewAction,

    // Right panel
    rightPanelTab, setRightPanelTab,
    dismissedBailBanners, setDismissedBailBanners,
    dismissBailBanner,

    // Instructions modal
    instructionsModalNodeId, setInstructionsModalNodeId,
    instructionsModalDraft, setInstructionsModalDraft,
    instructionsModalLiveText, setInstructionsModalLiveText,
    instructionsModalStepKind, setInstructionsModalStepKind,
    openInstructionsModal,
    saveInstructionsModal,

    // MCP / node config
    nodeConfigMode, setNodeConfigMode,
    mcpSegments, setMcpSegments,
    mcpSampleInputs, setMcpSampleInputs,
    mcpTestState, setMcpTestState,
    mcpSampleCollapsed, setMcpSampleCollapsed,
    mcpInputsExpanded, setMcpInputsExpanded,
    mcpSimResults, setMcpSimResults,
    mcpSimTab, setMcpSimTab,
    mcpInstructionsFlyout, setMcpInstructionsFlyout,
    mcpFlyoutView, setMcpFlyoutView,
    pfxAiMode, setPfxAiMode,
    pfxAiPrompt, setPfxAiPrompt,
    pfxAiSuggestion, setPfxAiSuggestion,
    pfxAiSuggestionIsOriginal, setPfxAiSuggestionIsOriginal,
    pfxAiLoading, setPfxAiLoading,
    pfxExpression, setPfxExpression,
    pfxFnPickerOpen, setPfxFnPickerOpen,
    pfxDynPickerOpen, setPfxDynPickerOpen,
    pfxFnSearch, setPfxFnSearch,
    pfxDynSearch, setPfxDynSearch,
    flyoutPos, setFlyoutPos,
    mcpToolsEnabled, setMcpToolsEnabled,
    mcpToolsFilterEnabled, setMcpToolsFilterEnabled,
    isMcpToolEnabled,
    clearMcpTestResults,
    toggleMcpTool,

    // Config / branch dialogs
    configDialog, setConfigDialog,
    connectingFromId, setConnectingFromId,
    connectingSide, setConnectingSide,
    connectTargetIdx, setConnectTargetIdx,
    connectLineEnd, setConnectLineEnd,
    branchDialog, setBranchDialog,
    deleteBranchDialog, setDeleteBranchDialog,

    // Handlers
    handleZoomIn,
    handleZoomOut,
    handleFitToScreen,
    handleTidyUp,
    handleCanvasDrop,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasStopPan,
    handleClear,
    startConnecting,
    stopConnecting,
    applyBranchChoice,
    confirmConfigDialog,
    applyDeleteBranch,
    openAddStep,
    closeAddStep,
    addStep,
    addMcpProductStep,
    dropStep,
    renameNode,
    patchNode,
    detachNode,
    reattachNode,
    reattachDropIndex,
    deleteNode,

    // Utilities
    isUnnamedStep,
    isStepConfigured,
    getNodeIcon,
    workflowNodes,

    // Version history
    workflowVersionHistory,
    revertToVersion,
    seedExampleVersionHistory,
    currentUserName: userName,

    // Granular workflow experiment flags
    isWorkflowTestingV2,
    isStepTypeVisuals,
  };
}

export type WorkflowCanvasState = ReturnType<typeof useWorkflowCanvas>;
