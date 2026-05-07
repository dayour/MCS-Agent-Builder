// ─── Workflow Node Details ─────────────────────────────────────────────────
// Right-panel node configuration content. Handles MCP, CUA, Agent, Prompt,
// Condition, and generic Action node types.
// Extracted from WorkflowCanvas.tsx — pure refactor, no behavior changes.

import React, { useRef, useCallback } from 'react';
import { WorkflowNode, BranchType, getBranchLabels, BRANCH_TYPE_OPTIONS } from '../../../types';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { CopilotDropdown } from '../../../components/ui/CopilotDropdown';
import { CopilotTextarea } from '../../../components/ui/CopilotTextarea';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotMenu } from '../../../components/ui/CopilotMenu';
import { CopilotTooltip } from '../../../components/ui/CopilotTooltip';
import { CopilotToggle } from '../../../components/ui/CopilotToggle';

import { WorkflowInstructionsEditor } from './WorkflowInstructionsEditor';
import InstructionEditor from './InstructionEditor';
import McpTestResults from './McpTestResults';
import { PillInput, PillInputHandle } from '../../../components/ui/PillInput';
import {
  Add20Regular,
  Dismiss16Regular,
  Flash20Regular,
  Flash20Filled,
  MathFormula20Regular,
  MathFormula20Filled,
  Agents24Filled,
  MoreHorizontal32Filled,
  Delete20Regular,
  Sparkle20Regular,
  Open20Regular,
  Filter16Regular,
  Info20Regular,
  DocumentText20Regular,
  Database20Regular,
} from '@fluentui/react-icons';
import {
  ALL_STEPS,
  getNodeErrors,
  MOCK_MCPS,
  MCP_PRODUCTS,
  MOCK_CUAS,
  MOCK_AGENTS,
  MOCK_PROMPTS,
  PROMPT_MODEL_OPTIONS,
  POWER_FX_FUNCTIONS,
  InstrSegment,
  getConnectorIconSrc,
  connectorColor,
  CONNECTOR_ACTIONS,
  V2_CONNECTOR_ACTIONS,
  V2_ACTION_SUBTEXTS,
  CONTROL_FLOW_COLOR,
  HITL_COLORS,
  MOCK_DIRECTORY,
  getHitlInitials,
  V1_TRIGGER_TYPES,
  CONNECTORS,
  V2_CONNECTOR_DISPLAY_MERGE,
  V2_MERGED_CONNECTOR_NAMES,
  V1_CONNECTOR_TRIGGER_EVENTS,
  isMicrosoftConnector,
  MS_GROUPS,
  connInMsGroup,
  getMsGroupConnectors,
  shortenForGroup,
  MS_GROUP_ICONS,
  V2PreviewAction,
  getV2PreviewContent,
  PREVIEW_DESCRIPTIONS,
  TeamsIcon,
} from './workflowConstants';
import type { WorkflowCanvasState } from './useWorkflowCanvas';

interface Props {
  node: WorkflowNode;
  ctx: WorkflowCanvasState;
  renderStepHitl?: (node: WorkflowNode) => React.ReactNode;
  /** Called when a PillInput gains focus — the parent uses this to route dynamic-value clicks. */
  onPillInputFocus?: (handle: PillInputHandle) => void;
}

// ── Condition types (module-scoped so ConditionRow can reference them) ────────
export type Condition = { id: string; left: string; operator: string; right: string };
export type ElseIfBranch = { id: string; conditions: Condition[]; conditionLogic: Array<'and' | 'or'> };

export const OPERATOR_OPTIONS = [
  { label: 'is equal to', value: 'eq' },
  { label: 'is not equal to', value: 'neq' },
  { label: 'is greater than', value: 'gt' },
  { label: 'is less than', value: 'lt' },
  { label: 'contains', value: 'contains' },
  { label: 'does not contain', value: 'not-contains' },
  { label: 'is empty', value: 'empty' },
  { label: 'is not empty', value: 'not-empty' },
];

// ── ConditionRow — hoisted to module scope so its identity is stable across
// re-renders of WorkflowNodeDetails. Defining it inside the render function
// would create a new function reference each render, causing React to unmount
// and remount every row (resetting local state like menuOpen).
interface ConditionRowProps {
  cond: Condition;
  idx: number;
  canDelete: boolean;
  groupLogic: Array<'and' | 'or'>;
  operatorOptions: { label: string; value: string }[];
  onUpdate: (ci: number, field: keyof Condition, value: string) => void;
  onUpdateLogic: (li: number, value: 'and' | 'or') => void;
  onRemove: () => void;
  onPillInputFocus?: (handle: PillInputHandle) => void;
}
const ConditionRow: React.FC<ConditionRowProps> = ({ cond, idx, canDelete, groupLogic, operatorOptions, onUpdate, onUpdateLogic, onRemove, onPillInputFocus }) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const leftRef = React.useRef<PillInputHandle>(null);
  const rightRef = React.useRef<PillInputHandle>(null);
  React.useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-cond-menu]')) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);
  return (
    <>
      {idx > 0 && (
        /* AND/OR connector — pulled back to line position via negative margin */
        <div className="flex items-center py-2" style={{ marginLeft: -28 }}>
          <CopilotDropdown
            variant="dropdown" size="sm"
            options={[{ label: 'AND', value: 'and' }, { label: 'OR', value: 'or' }]}
            value={groupLogic[idx - 1] ?? 'and'}
            onChange={val => onUpdateLogic(idx - 1, val as 'and' | 'or')}
            placeholder="AND"
          />
        </div>
      )}
      {/* Condition content — circle is absolute on the line (left: -21 = container_left 28 - 7 = circle at x=7, center x=13) */}
      <div className="relative mb-4 z-10">
        <div className="absolute rounded-full bg-white" style={{ left: -20, top: 12, width: 12, height: 12, border: '1.5px solid #374151', zIndex: 1 }} />
        {/* Title row */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-caption-1-strong text-gray-700 flex-1">Condition {idx + 1}</span>
          <div className="relative" data-cond-menu>
            <CopilotButton
              variant="ghost" size="sm"
              onClick={() => setMenuOpen(o => !o)}
              className="w-9 h-9 p-0 flex-shrink-0 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              aria-label="Condition options"
            >
              <MoreHorizontal32Filled style={{ width: 28, height: 28 }} />
            </CopilotButton>
            {menuOpen && (
              <div role="menu" className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl z-50 overflow-hidden" style={{ boxShadow: 'var(--shadow-dropdown)', minWidth: 160 }}>
                <CopilotButton
                  role="menuitem"
                  variant="ghost" size="sm"
                  onClick={() => { if (canDelete) { setMenuOpen(false); onRemove(); } }}
                  className={`w-full !justify-start gap-2 px-3 ${canDelete ? '!text-[hsl(var(--status-error))] hover:!text-[hsl(var(--status-error))] hover:bg-[#FDE7E9]' : 'text-gray-300 cursor-not-allowed'}`}
                >
                  <Delete20Regular style={{ width: 16, height: 16 }} />
                  Delete condition
                </CopilotButton>
              </div>
            )}
          </div>
        </div>
        {/* Inputs */}
        <div className="space-y-2">
          <PillInput ref={leftRef} placeholder="Choose a value" singleLine value={cond.left} onChange={val => onUpdate(idx, 'left', val)} onFocus={() => onPillInputFocus?.(leftRef.current!)} />
          <CopilotDropdown variant="dropdown" size="md" options={operatorOptions} value={cond.operator} onChange={val => onUpdate(idx, 'operator', val)} placeholder="Select comparison" />
          <PillInput ref={rightRef} placeholder="Choose a value" singleLine value={cond.right} onChange={val => onUpdate(idx, 'right', val)} onFocus={() => onPillInputFocus?.(rightRef.current!)} />
        </div>
      </div>
    </>
  );
};

/** Shared panel chevron SVGs */
export const panelChevronLeft = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
    <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
export const panelChevronRight = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const WorkflowNodeDetails: React.FC<Props> = ({ node, ctx, renderStepHitl, onPillInputFocus }) => {
  const {
    agentConfig, updateAgentConfig, updateWithHistory, isAgentGlobalUndo, updateWorkflowNodes,
    selectedNode, setSelectedNode,
    version, isWorkflowTestingV2,
    workflowNodes,
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
    mcpFlyoutBtnRef,
    flyoutPos, setFlyoutPos,
    mcpToolsEnabled, setMcpToolsEnabled,
    mcpToolsFilterEnabled, setMcpToolsFilterEnabled,
    isMcpToolEnabled,
    clearMcpTestResults,
    toggleMcpTool,
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
    rightPanelTab, setRightPanelTab,
    dismissedBailBanners, dismissBailBanner,
    openInstructionsModal,
    patchNode,
    renameNode,
    isUnnamedStep,
    isStepConfigured,
    getNodeIcon,
    cuaMachineType, setCuaMachineType,
    cuaConnectionStatus, setCuaConnectionStatus,
    cuaConnectionValue, setCuaConnectionValue,
    cuaMachineMenuOpen, setCuaMachineMenuOpen,
    cuaMachineMenuPos, setCuaMachineMenuPos,
    v2PreviewAction, setV2PreviewAction,
    skipNodeConfigResetRef,
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
  } = ctx;

  // PillInput / WorkflowInstructionsEditor refs — so the expanded modal can route pill inserts
  const toRef = useRef<PillInputHandle>(null);
  const subjectRef = useRef<PillInputHandle>(null);
  const bodyRef = useRef<PillInputHandle>(null);
  const instructionsRef = useRef<PillInputHandle>(null);
  // Generic ref for misc PillInput fields — reused since only one can be focused at a time
  const miscPillRef = useRef<PillInputHandle>(null);
  // Individual refs for fields that are simultaneously visible
  const subscribeRef = useRef<PillInputHandle>(null);
  const unsubscribeRef = useRef<PillInputHandle>(null);
  const makePillFocus = useCallback((handle: PillInputHandle | null) => {
    if (handle && onPillInputFocus) onPillInputFocus(handle);
  }, [onPillInputFocus]);

  const v2RowCls = (label: string) =>
    `group/r flex items-stretch transition-colors ${v2PreviewAction?.label === label ? 'bg-gray-100' : 'hover:bg-gray-50'}`;
  const v2EyeBtn = (onClick: (e: React.MouseEvent) => void) => (
    <div className="opacity-0 group-hover/r:opacity-100 transition-opacity flex-shrink-0 flex items-center pr-4">
      <CopilotButton variant="secondary" size="sm" onClick={onClick}>
        Preview
      </CopilotButton>
    </div>
  );
  const toolCheckIcon = (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="flex-shrink-0 text-gray-400">
      <rect x="0.5" y="0.5" width="9" height="9" rx="1.5" stroke="currentColor"/>
      <path d="M3 5l1.5 1.5L7 3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  // TODO: WorkflowCanvas has a parallel getNodeOutputs returning NodeOutput[] with a type field.
  // Extract to a shared utility in workflowConstants.ts once the two shapes converge.
  const getNodeOutputs = (n: WorkflowNode): { name: string; description: string }[] => {
    if (n.type === 'trigger') return [
      { name: 'Event data',  description: 'Full payload of the triggering event' },
      { name: 'Timestamp',   description: 'Date and time the event occurred' },
      { name: 'User',        description: 'Identity of the user who triggered the event' },
      { name: 'Source',      description: 'Origin system or channel of the event' },
    ];
    if (n.type === 'condition') return [
      { name: 'Result',       description: 'Boolean outcome of the condition' },
      { name: 'True branch',  description: 'Value passed when condition is true' },
      { name: 'False branch', description: 'Value passed when condition is false' },
    ];
    if (n.label === 'MCP') {
      const mcp = MOCK_MCPS.find(m => m.id === n.config?.instanceMode);
      return mcp ? mcp.tools.map(t => ({ name: t.id, description: t.description })) : [{ name: 'Output', description: 'Result returned by the MCP tool' }];
    }
    if (n.type === 'ai-action') return [
      { name: 'Extracted data',   description: 'Structured output produced by the AI model' },
      { name: 'Confidence score', description: 'Model confidence in the extracted result' },
      { name: 'Raw text',         description: 'Unprocessed text from the source document' },
    ];
    if (n.type === 'agent') return [
      { name: 'Agent response', description: 'Final message or result returned by the agent' },
      { name: 'Actions taken',  description: 'List of actions the agent performed' },
      { name: 'Status',         description: 'Completion status of the agent run' },
    ];
    return [
      { name: 'Status',        description: 'HTTP status code or result code' },
      { name: 'Response body', description: 'Full response payload from the action' },
    ];
  };

  const getPreviousNodes = (currentNode: WorkflowNode): WorkflowNode[] => {
    const idx = workflowNodes.findIndex(n => n.id === currentNode.id);
    return idx > 0 ? workflowNodes.slice(0, idx) : [];
  };

  const renderNodeDetails = (node: WorkflowNode) => {
    const nodeErrors = getNodeErrors(node);
    const configKeys = node.config ? Object.keys(node.config) : [];
    const isTouched = configKeys.length > 0;
    const requiredError = (val: string | undefined | null): string | undefined =>
      isTouched && !val?.trim() ? 'This field is required' : undefined;

    const errorBanner = nodeErrors.length > 0 ? (
      <div className="mx-4 mb-3 px-3 py-2 rounded-lg" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
        <span style={{ color: '#dc2626', fontSize: 13, lineHeight: '20px' }}>
          {nodeErrors.length === 1
            ? nodeErrors[0]
            : `${nodeErrors.length} required fields are incomplete: ${nodeErrors.join(', ')}`}
        </span>
      </div>
    ) : null;

    // ── MCP node ──────────────────────────────────────────────────────────────
    if (node.label === 'MCP') {
      // Fall back to the first available MCP so tools always render
      const activeMCP = MOCK_MCPS.find(m => m.id === nodeConfigMode) ?? MOCK_MCPS[0];

      return (
        <div className="space-y-4">
          {errorBanner}
          <label className="text-body-2-strong text-foreground">Instructions</label>
          {isWorkflowTestingV2 ? (
            <div
              onClick={() => openInstructionsModal(node, 'MCP')}
              className="relative rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 min-h-[100px] text-sm text-gray-700 whitespace-pre-wrap cursor-pointer hover:border-gray-300 transition-colors"
            >
              {(mcpSegments[node.id] ?? []).map(s => s.type === 'text' ? s.value : s.type === 'pill' ? `{{${s.nodeLabel}.${s.output}}}` : `{{${s.label}}}`).join('') || <span className="text-gray-400 italic">Describe what this MCP step should do…</span>}
              <CopilotButton variant="secondary" size="sm" className="absolute bottom-2.5 right-2.5" onClick={e => { e.stopPropagation(); openInstructionsModal(node, 'MCP'); }}>Edit</CopilotButton>
            </div>
          ) : (
            <WorkflowInstructionsEditor
              ref={instructionsRef}
              key={node.id}
              value={node.config?.instructions ?? ''}
              onChange={val => patchNode(node.id, { config: { ...node.config, instructions: val } })}
              placeholder={`Describe what this MCP step should do. For example: "Search for open pull requests assigned to the current user and summarize their status."`}
              onFirstInput={() => dismissBailBanner(node.id)}
              onEditorFocus={() => makePillFocus(instructionsRef.current)}
              hideHeader
              className="min-h-[160px]"
            />
          )}
          {requiredError(node.config?.instructions) && (
            <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--status-error))' }}>This field is required</p>
          )}
          <div>
            <div className="mb-1">
              <p className="text-body-2-strong text-[hsl(var(--secondary-foreground))]">Tools</p>
            </div>
            <div className="flex items-center justify-end gap-2 mb-2" style={{ paddingRight: 13 }}>
              {activeMCP.docsUrl && (
                <a href={activeMCP.docsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-caption-1 text-[hsl(var(--primary))] hover:underline mr-auto">
                  Server documentation
                  <Open20Regular className="w-3.5 h-3.5" />
                </a>
              )}
              <CopilotButton
                variant="ghost"
                size="sm"
                onClick={() => setMcpToolsFilterEnabled(v => !v)}
                className={`group inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption-1 font-medium transition-colors ${mcpToolsFilterEnabled ? 'bg-[hsl(var(--primary))] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                <Filter16Regular className={`flex-shrink-0 transition-all ${mcpToolsFilterEnabled ? 'w-3 h-3 opacity-100' : 'w-0 h-3 opacity-0 group-hover:w-3 group-hover:opacity-100'}`} />
                {activeMCP.tools.filter(t => isMcpToolEnabled(node.id, t.id)).length}/{activeMCP.tools.length} enabled
              </CopilotButton>
              <CopilotButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  const allEnabled = activeMCP.tools.every(t => isMcpToolEnabled(node.id, t.id));
                  const next = Object.fromEntries(activeMCP.tools.map(t => [t.id, !allEnabled]));
                  setMcpToolsEnabled(prev => ({ ...prev, [node.id]: { ...prev[node.id], ...next } }));
                  clearMcpTestResults(node.id);
                }}
                className={`relative flex-shrink-0 rounded-full transition-colors focus:outline-none ${activeMCP.tools.every(t => isMcpToolEnabled(node.id, t.id)) ? 'bg-[hsl(var(--primary))]' : 'bg-gray-200'}`}
                style={{ height: 18, width: 32 }}
                title="Toggle all tools"
              >
                <span className="absolute bg-white rounded-full shadow transition-all" style={{ width: 14, height: 14, top: 2, left: activeMCP.tools.every(t => isMcpToolEnabled(node.id, t.id)) ? 16 : 2 }} />
              </CopilotButton>
            </div>
            <div className="rounded-lg border border-[hsl(var(--secondary-border))] divide-y divide-[hsl(var(--secondary-border))] overflow-hidden">
              {activeMCP.tools.filter(t => !mcpToolsFilterEnabled || isMcpToolEnabled(node.id, t.id)).map(tool => {
                const enabled = isMcpToolEnabled(node.id, tool.id);
                return (
                  <div key={tool.id} className={`flex items-start gap-2.5 px-3 py-2.5 transition-opacity ${enabled ? 'opacity-100' : 'opacity-40'}`}>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <span className="text-caption-1 font-mono text-gray-700 block">{tool.id}</span>
                      <span className="text-caption-1 text-gray-400 block mt-0.5">{tool.description}</span>
                    </div>
                    <CopilotButton
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleMcpTool(node.id, tool.id)}
                      className={`relative flex-shrink-0 rounded-full transition-colors mt-0.5 focus:outline-none ${enabled ? 'bg-[hsl(var(--primary))]' : 'bg-gray-200'}`}
                      style={{ height: 18, width: 32 }}
                      title={enabled ? 'Disable tool' : 'Enable tool'}
                    >
                      <span className="absolute bg-white rounded-full shadow transition-all" style={{ width: 14, height: 14, top: 2, left: enabled ? 16 : 2 }} />
                    </CopilotButton>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );

    }

    // ── Computer Use node ─────────────────────────────────────────────────────
    if (node.label === 'Computer Use') {
      const selectedCUA = MOCK_CUAS.find(c => c.id === nodeConfigMode);

      if (!selectedCUA) {
        const cuaInstructions = node.config?.instructions ?? '';
        return (
          <div className="-mx-4">
            {errorBanner}

            {/* ══ Details + Instructions ══ */}
            <div className="px-4 pt-3 pb-5 border-b border-gray-100 space-y-3">
              {version !== 1 && (
                <CopilotInput
                  label="Name"
                  placeholder="e.g. Marketing Browser Agent"
                  value={node.config?.instanceName ?? ''}
                  onChange={e => patchNode(node.id, { config: { ...node.config, instanceName: e.target.value, stepTypeLabel: 'Computer Use' } })}
                />
              )}
              <div className="flex items-center justify-between">
                <h4 className="text-body-2-strong text-gray-900">Instructions <span className="text-red-500 ml-0.5">*</span></h4>
                <CopilotDropdown
                  variant="dropdown"
                  size="sm"
                  options={PROMPT_MODEL_OPTIONS}
                  value={node.config?.model ?? 'claude-sonnet-4-6'}
                  onChange={val => patchNode(node.id, { config: { ...node.config, model: val } })}
                  showSelectedIcon
                />
              </div>
              <div>
                {isWorkflowTestingV2 ? (
                  <div
                    onClick={() => openInstructionsModal(node, 'Computer Use')}
                    className="relative rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 min-h-[100px] text-sm text-gray-700 whitespace-pre-wrap cursor-pointer hover:border-gray-300 transition-colors"
                  >
                    {cuaInstructions || <span className="text-gray-400 italic">Describe what this agent should do, which sites to visit, and how to handle errors…</span>}
                    <CopilotButton variant="secondary" size="sm" className="absolute bottom-2.5 right-2.5" onClick={e => { e.stopPropagation(); openInstructionsModal(node, 'Computer Use'); }}>Edit</CopilotButton>
                  </div>
                ) : (
                  <WorkflowInstructionsEditor
                    ref={instructionsRef}
                    key={node.id}
                    value={cuaInstructions}
                    onChange={val => patchNode(node.id, { config: { ...node.config, instructions: val } })}
                    placeholder="Describe what this agent should do, which sites to visit, and how to handle errors."
                    onFirstInput={() => dismissBailBanner(node.id)}
                    onEditorFocus={() => makePillFocus(instructionsRef.current)}
                    hideHeader
                    className="min-h-[160px]"
                  />
                )}
                {requiredError(node.config?.instructions) && (
                  <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--status-error))' }}>This field is required</p>
                )}
              </div>

            </div>

            {/* ══ Machines ══ */}
            <div className="px-4 py-5 border-b border-gray-100 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-body-2-strong text-[hsl(var(--secondary-foreground))]">Machine <span className="text-red-500">*</span></span>
                  <CopilotButton
                    variant="ghost"
                    size="sm"
                    className="p-0.5 -my-1 text-gray-400 hover:text-gray-700"
                    onClick={e => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setCuaMachineMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right }); setCuaMachineMenuOpen(true); }}
                  >
                    <MoreHorizontal32Filled style={{ width: 16, height: 16 }} />
                  </CopilotButton>
                </div>
                <CopilotDropdown
                  variant="dropdown"
                  size="md"
                  fullWidth
                  value={cuaMachineType}
                  onChange={val => {
                    setCuaMachineType(val as typeof cuaMachineType);
                    patchNode(node.id, { config: { ...node.config, machineType: val } });
                  }}
                  options={[
                    { label: 'Hosted browser', value: 'hosted-browser' },
                    { label: 'Bring your own machine', value: 'byom' },
                    { label: 'Machine pool', value: 'machine-pool' },
                  ]}
                />
                {cuaMachineMenuOpen && (
                  <CopilotMenu
                    position={cuaMachineMenuPos}
                    onClose={() => setCuaMachineMenuOpen(false)}
                    items={[
                      { label: 'Help me decide', icon: <Info20Regular style={{ width: 16, height: 16 }} />, onClick: () => setCuaMachineMenuOpen(false) },
                      { label: 'Manage machines', icon: <Open20Regular style={{ width: 16, height: 16 }} />, onClick: () => setCuaMachineMenuOpen(false) },
                    ]}
                  />
                )}
                {cuaMachineType === 'hosted-browser' && (
                  <p className="text-caption-1 text-gray-500 mt-1.5">Hosted browsers only support web tasks. To access both websites and desktop apps, select an existing machine or create a new one.</p>
                )}
                {cuaMachineType === 'byom' && (
                  <PillInput ref={miscPillRef} label="Connection URL" required placeholder="e.g. cua.contoso.com or ws://localhost:9222" className="mt-3" singleLine value={node.config?.connectionUrl ?? ''} onChange={val => patchNode(node.id, { config: { ...node.config, connectionUrl: val } })} onFocus={() => makePillFocus(miscPillRef.current)} />
                )}
              </div>
              <div>
                <p className="text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">Connection <span className="text-red-500">*</span></p>
                <CopilotDropdown
                  variant="dropdown"
                  size="md"
                  fullWidth
                  showSelectedIcon
                  value={cuaConnectionValue}
                  onChange={val => {
                    if (val === '__new__') {
                      setCuaConnectionStatus('connecting');
                      setTimeout(() => {
                        setCuaConnectionValue('new.user@contoso.com');
                        setCuaConnectionStatus('connected');
                        patchNode(node.id, { config: { ...node.config, connectionValue: 'new.user@contoso.com' } });
                      }, 2000);
                    } else {
                      setCuaConnectionValue(val);
                      patchNode(node.id, { config: { ...node.config, connectionValue: val } });
                      setCuaConnectionStatus('connecting');
                      setTimeout(() => setCuaConnectionStatus('connected'), 2000);
                    }
                  }}
                  options={[
                    {
                      label: 'mona.kane@contoso.com',
                      value: 'mona.kane@contoso.com',
                      icon: cuaConnectionStatus === 'connected' && cuaConnectionValue === 'mona.kane@contoso.com' ? (
                        <span className="flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: '#22863a' }}>
                          <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                      ) : cuaConnectionStatus === 'connecting' && cuaConnectionValue === 'mona.kane@contoso.com' ? (
                        <span className="flex items-center justify-center w-4 h-4 flex-shrink-0">
                          <svg className="animate-spin" width="12" height="12" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#d1d5db" strokeWidth="1.5"/><path d="M7 1.5A5.5 5.5 0 0112.5 7" stroke="#5B5FC7" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </span>
                      ) : undefined,
                    },
                    {
                      label: 'john.doe@contoso.com',
                      value: 'john.doe@contoso.com',
                      icon: cuaConnectionStatus === 'connected' && cuaConnectionValue === 'john.doe@contoso.com' ? (
                        <span className="flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: '#22863a' }}>
                          <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                      ) : cuaConnectionStatus === 'connecting' && cuaConnectionValue === 'john.doe@contoso.com' ? (
                        <span className="flex items-center justify-center w-4 h-4 flex-shrink-0">
                          <svg className="animate-spin" width="12" height="12" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#d1d5db" strokeWidth="1.5"/><path d="M7 1.5A5.5 5.5 0 0112.5 7" stroke="#5B5FC7" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </span>
                      ) : undefined,
                    },
                    { label: 'Create new connection', value: '__new__' },
                  ]}
                />
              </div>
            </div>

            {/* ══ Human review ══ */}
            <div className="px-4 py-5">
              {renderStepHitl?.(node)}
            </div>

          </div>
        );
      }

      if (selectedCUA) {
        return (
          <div className="space-y-4">
            <CopilotButton variant="ghost" size="sm" onClick={() => setNodeConfigMode('pick')} className="flex items-center gap-1.5 text-caption-1 text-gray-500 hover:text-gray-900 transition-colors -mt-1">
              {panelChevronLeft}<span>Change environment</span>
            </CopilotButton>
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl border border-green-200 bg-green-50">
              <img src="./cua-icon.svg" alt="Computer Use" className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-body-2-strong text-gray-900">{selectedCUA.name}</div>
                <div className="text-caption-1 text-green-600 mt-0.5 flex items-center gap-1.5">
                  <span style={{ fontSize: 7 }}>●</span><span>Connected</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-caption-1-strong text-gray-400 uppercase mb-1" style={{ fontSize: 10, letterSpacing: '0.06em' }}>Runtime</p>
                <p className="text-caption-1 text-gray-700">{selectedCUA.type}</p>
              </div>
              <div>
                <p className="text-caption-1-strong text-gray-400 uppercase mb-1" style={{ fontSize: 10, letterSpacing: '0.06em' }}>Status</p>
                <p className="text-caption-1 text-green-600">Active</p>
              </div>
            </div>
            <div>
              <p className="text-caption-1-strong text-gray-400 uppercase mb-1.5" style={{ fontSize: 10, letterSpacing: '0.06em' }}>Connection URL</p>
              <p className="text-caption-1 font-mono text-gray-700 bg-gray-50 px-2.5 py-2 rounded-lg border border-gray-100 break-all">{selectedCUA.url}</p>
            </div>
            <div>
              <p className="text-caption-1-strong text-gray-400 uppercase mb-2" style={{ fontSize: 10, letterSpacing: '0.06em' }}>Capabilities</p>
              <div className="space-y-1">
                {['Navigate web pages', 'Fill forms', 'Click elements', 'Take screenshots', 'Extract text'].map(cap => (
                  <div key={cap} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-100">
                    {toolCheckIcon}
                    <span className="text-caption-1 text-gray-700">{cap}</span>
                  </div>
                ))}
              </div>
            </div>
            {version === 2 && renderStepHitl?.(node)}
          </div>
        );
      }

    }

    // ── Shared agent config renderer ──────────────────────────────────────────
    // Used by the !selectedAgent early-return and the 'agent' switch arm to
    // avoid duplicating the Details + Instructions + Model layout block.
    const renderNewAgentConfig = (
      agentNode: WorkflowNode,
      options: { placeholder: string; showToolsAndWorkIQ: boolean },
    ) => {
      const instructions = agentNode.config?.instructions ?? '';
      return (
        <div className="-mx-4">
          {errorBanner}

          {/* ══ Details + Instructions ══ */}
          <div className="px-4 pt-3 pb-5 border-b border-gray-100 space-y-3">
            {version !== 1 && (
              <CopilotInput
                label="Name"
                placeholder={options.placeholder}
                value={agentNode.config?.instanceName ?? ''}
                onChange={e => patchNode(agentNode.id, { config: { ...agentNode.config, instanceName: e.target.value, stepTypeLabel: 'Agent' } })}
              />
            )}
            <div className="flex items-center justify-between">
              <h4 className="text-body-2-strong text-gray-900">Instructions <span className="text-red-500 ml-0.5">*</span></h4>
              <CopilotDropdown
                variant="dropdown"
                size="sm"
                options={PROMPT_MODEL_OPTIONS}
                value={agentNode.config?.model ?? 'claude-sonnet-4-6'}
                onChange={val => patchNode(agentNode.id, { config: { ...agentNode.config, model: val } })}
                showSelectedIcon
              />
            </div>
            <div>
              {isWorkflowTestingV2 ? (
                <div
                  onClick={() => openInstructionsModal(agentNode, 'Agent')}
                  className="relative rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 min-h-[100px] text-sm text-gray-700 whitespace-pre-wrap cursor-pointer hover:border-gray-300 transition-colors"
                >
                  {instructions || <span className="text-gray-400 italic">Describe what this agent should do…</span>}
                  <CopilotButton variant="secondary" size="sm" className="absolute bottom-2.5 right-2.5" onClick={e => { e.stopPropagation(); openInstructionsModal(agentNode, 'Agent'); }}>Edit</CopilotButton>
                </div>
              ) : (
                <WorkflowInstructionsEditor
                  ref={instructionsRef}
                  key={agentNode.id}
                  value={instructions}
                  onChange={val => patchNode(agentNode.id, { config: { ...agentNode.config, instructions: val } })}
                  placeholder="Describe what this agent should do."
                  onFirstInput={() => dismissBailBanner(agentNode.id)}
                  onEditorFocus={() => makePillFocus(instructionsRef.current)}
                  hideHeader
                  className="min-h-[160px]"
                />
              )}
              {requiredError(agentNode.config?.instructions) && (
                <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--status-error))' }}>This field is required</p>
              )}
            </div>
          </div>

          {/* ══ Tools ══ */}
          {options.showToolsAndWorkIQ && (
            <div className="px-4 py-5 border-b border-gray-100">
              <div className="flex items-center justify-between gap-3">
                <p className="text-body-2-strong text-gray-900">Tools</p>
                <CopilotButton
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1 text-[hsl(var(--primary))] hover:opacity-80"
                  onClick={() => { /* TODO: open tool picker */ }}
                >
                  <Add20Regular style={{ width: 14, height: 14 }} />
                  Add tools
                </CopilotButton>
              </div>
            </div>
          )}

          {/* ══ Work IQ ══ */}
          {options.showToolsAndWorkIQ && (
            <div className="px-4 py-5 border-b border-gray-100">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-body-2-strong text-gray-900">Work IQ</p>
                  <p className="text-caption-1 text-gray-500 mt-0.5">Use your work activity to provide more relevant responses</p>
                </div>
                <CopilotToggle
                  checked={agentNode.config?.workIqEnabled ?? false}
                  onChange={() => patchNode(agentNode.id, { config: { ...agentNode.config, workIqEnabled: !(agentNode.config?.workIqEnabled ?? false) } })}
                  aria-label={(agentNode.config?.workIqEnabled ?? false) ? 'Disable Work IQ' : 'Enable Work IQ'}
                />
              </div>
            </div>
          )}

          {/* ══ Human review ══ */}
          <div className="px-4 py-5">
            {renderStepHitl?.(agentNode)}
          </div>

        </div>
      );
    };

    // ── Agent node ─────────────────────────────────────────────────────────────
    if (node.label === 'Agent') {
      const selectedAgent = MOCK_AGENTS.find(a => a.id === nodeConfigMode);
      const MODEL_LABEL: Record<string, string> = { 'sonnet-4.5': 'Sonnet 4.5', 'opus-4.5': 'Opus 4.5', 'haiku-4.5': 'Haiku 4.5' };

      if (!selectedAgent) {
        return renderNewAgentConfig(node, { placeholder: 'e.g. Invoice Processing Agent', showToolsAndWorkIQ: true });
      }

      if (selectedAgent) {
        return (
          <div className="space-y-4">
            <CopilotButton variant="ghost" size="sm" onClick={() => setNodeConfigMode('pick')} className="flex items-center gap-1.5 text-caption-1 text-gray-500 hover:text-gray-900 transition-colors -mt-1">
              {panelChevronLeft}<span>Change agent</span>
            </CopilotButton>
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl border border-green-200 bg-green-50">
              <Agents24Filled style={{ color: 'hsl(var(--primary))', width: 20, height: 20, flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div className="text-body-2-strong text-gray-900 truncate">{selectedAgent.name}</div>
                <div className="text-caption-1 text-green-600 mt-0.5 flex items-center gap-1.5">
                  <span style={{ fontSize: 7 }}>●</span><span>Connected</span>
                </div>
              </div>
              <span className="text-caption-1 text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full flex-shrink-0">{MODEL_LABEL[selectedAgent.model] ?? selectedAgent.model}</span>
            </div>
            <div>
              <p className="text-caption-1-strong text-gray-400 uppercase mb-1.5" style={{ fontSize: 10, letterSpacing: '0.06em' }}>Description</p>
              <p className="text-caption-1 text-gray-700">{selectedAgent.description}</p>
            </div>
            <div className="pt-2 border-t border-gray-100">
              <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">Override instructions</label>
              <PillInput ref={miscPillRef} placeholder="Leave blank to use the agent's default instructions…" minHeight={72} value={node.config?.overrideInstructions ?? ''} onChange={val => patchNode(node.id, { config: { ...node.config, overrideInstructions: val } })} onFocus={() => makePillFocus(miscPillRef.current)} />
            </div>
            <div>
              <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">Response handling</label>
              <CopilotDropdown variant="dropdown" size="md"
                options={[{ label: 'Wait for response', value: 'wait' }, { label: 'Fire and forget', value: 'fire' }]}
                value={node.config?.responseHandling ?? 'wait'} onChange={val => patchNode(node.id, { config: { ...node.config, responseHandling: val } })} placeholder="Select response handling"
              />
            </div>
            {version === 2 && renderStepHitl?.(node)}
          </div>
        );
      }
    }

    // ── Prompt node ────────────────────────────────────────────────────────────
    if (node.label === 'Prompt') {
      const instructionsValue = node.config?.instructions || '';
      return (
        <div className="space-y-4">
          {errorBanner}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-body-2-strong text-foreground">Instructions <span className="text-red-500 ml-0.5">*</span></label>
              <CopilotDropdown
                variant="dropdown"
                size="sm"
                options={PROMPT_MODEL_OPTIONS}
                value={node.config?.model ?? 'claude-sonnet-4-6'}
                onChange={val => patchNode(node.id, { config: { ...node.config, model: val } })}
                showSelectedIcon
              />
            </div>
            {isWorkflowTestingV2 ? (
              <div
                onClick={() => openInstructionsModal(node, 'Prompt')}
                className="relative rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 min-h-[120px] text-sm text-gray-700 whitespace-pre-wrap cursor-pointer hover:border-gray-300 transition-colors group"
              >
                {instructionsValue || <span className="text-gray-400 italic">No instructions yet — click to add</span>}
                <CopilotButton
                  variant="secondary"
                  size="sm"
                  className="absolute bottom-2.5 right-2.5"
                  onClick={e => { e.stopPropagation(); openInstructionsModal(node, 'Prompt'); }}
                >Edit</CopilotButton>
              </div>
            ) : (
              <WorkflowInstructionsEditor
                ref={instructionsRef}
                key={node.id}
                value={instructionsValue}
                onChange={val => patchNode(node.id, { config: { ...node.config, instructions: val } })}
                placeholder="Write your prompt. Use {{variable}} syntax for dynamic inputs."
                onFirstInput={() => dismissBailBanner(node.id)}
                onEditorFocus={() => makePillFocus(instructionsRef.current)}
                hideHeader
                className="min-h-[240px]"
              />
            )}
            {requiredError(node.config?.instructions) && (
              <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--status-error))' }}>This field is required</p>
            )}
          </div>
          <CopilotDropdown
            label="Output"
            variant="dropdown"
            size="md"
            options={[{ label: 'Text', value: 'text' }, { label: 'JSON', value: 'json' }, { label: 'Markdown', value: 'markdown' }]}
            value={node.config?.outputFormat ?? 'text'}
            onChange={val => patchNode(node.id, { config: { ...node.config, outputFormat: val } })}
            placeholder="Select output format"
          />
        </div>
      );
    }

    switch (node.type) {
      case 'trigger':
        return (
          <div className="space-y-4">
            {/* Trigger type picker */}
            {(() => {
              const HTTP_IDS = new Set(['http-request', 'http', 'http-webhook']);
              const standardTypes = V1_TRIGGER_TYPES.filter(t => !HTTP_IDS.has(t.id));
              const httpTypes = V1_TRIGGER_TYPES.filter(t => HTTP_IDS.has(t.id));
              const selected = V1_TRIGGER_TYPES.find(t => t.id === v1TriggerType)!;
              const renderOption = (t: typeof V1_TRIGGER_TYPES[number]) => (
                <button
                  key={t.id}
                  onClick={() => { setV1TriggerType(t.id); setV1TriggerPickerOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-gray-50 ${v1TriggerType === t.id ? 'bg-blue-50' : ''}`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${v1TriggerType === t.id ? 'bg-[hsl(var(--primary))] text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {t.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-body-2-strong text-gray-900">{t.label}</div>
                    <div className="text-caption-1 text-gray-400">{t.description}</div>
                  </div>
                  {v1TriggerType === t.id && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 text-[hsl(var(--primary))]">
                      <path d="M12 3.5L5.5 10 2 6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              );
              return (
                <div>
                  <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">Type</label>
                  <div className="relative">
                    <button
                      onClick={() => setV1TriggerPickerOpen(o => !o)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-left transition-colors"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[hsl(var(--primary))] text-white flex items-center justify-center flex-shrink-0">
                        {selected.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-body-2-strong text-gray-900">{selected.label}</div>
                        <div className="text-caption-1 text-gray-400">{selected.description}</div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={`flex-shrink-0 text-gray-400 transition-transform ${v1TriggerPickerOpen ? 'rotate-180' : ''}`}>
                        <path d="M3 5.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    {v1TriggerPickerOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl z-50 overflow-hidden" style={{ boxShadow: 'var(--shadow-dropdown)' }}>
                        <div className="px-3 pt-2 pb-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Standard</p>
                        </div>
                        {standardTypes.map(t => renderOption(t))}
                        <div className="border-t border-gray-100 mx-3 mt-1" />
                        <div className="px-3 pt-2 pb-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">HTTP</p>
                        </div>
                        {httpTypes.map(t => renderOption(t))}
                        <div className="pb-1" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Per-type configuration */}
            {v1TriggerType === 'recurrence' && (() => {
              const repeatOpts = [
                { label: 'Minutely', value: 'minutely' },
                { label: 'Hourly',   value: 'hourly' },
                { label: 'Daily',    value: 'daily' },
                { label: 'Weekly',   value: 'weekly' },
                { label: 'Monthly',  value: 'monthly' },
                { label: 'Yearly',   value: 'yearly' },
              ];
              const unitLabel: Record<string, string> = {
                minutely: 'minute(s)', hourly: 'hour(s)', daily: 'day(s)',
                weekly: 'week(s)', monthly: 'month(s)', yearly: 'year(s)',
              };
              const endOpts = [
                { label: 'Never',               value: 'never' },
                { label: 'On this day',         value: 'on-date' },
                { label: 'After occurrences',   value: 'after-count' },
              ];
              const tzOpts = [
                { label: '(UTC) Coordinated Universal Time', value: 'utc' },
                { label: '(UTC-05:00) Eastern Time', value: 'america/new_york' },
                { label: '(UTC-06:00) Central Time', value: 'america/chicago' },
                { label: '(UTC-07:00) Mountain Time', value: 'america/denver' },
                { label: '(UTC-08:00) Pacific Time', value: 'america/los_angeles' },
              ];
              // Summary sentence
              const n = parseInt(v1RecurrenceInterval) || 1;
              const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
              const WEEKDAY_LABELS: Record<string, string> = { day: 'day', weekday: 'weekday', 'weekend-day': 'weekend day' };
              const freqPart = n === 1
                ? `every ${unitLabel[v1RecurrenceRepeat]?.replace('(s)', '')}`
                : `every ${n} ${unitLabel[v1RecurrenceRepeat]}`;
              let onPart = '';
              if (v1RecurrenceRepeat === 'weekly' && v1RecurrenceDays.length > 0) {
                const sorted = [...v1RecurrenceDays].sort((a, b) => a - b);
                onPart = ` on ${sorted.map(d => DAY_NAMES[d]).join(', ')}`;
              }
              if (v1RecurrenceRepeat === 'monthly') {
                if (v1RecurrenceMonthlyMode === 'day-of-month') {
                  onPart = ` on day ${v1RecurrenceMonthDay}`;
                } else {
                  const wdLabel = WEEKDAY_LABELS[v1RecurrenceMonthWeekday] ?? v1RecurrenceMonthWeekday;
                  onPart = ` on the ${v1RecurrenceMonthOrdinal} ${wdLabel}`;
                }
              }
              const timesPart = v1RecurrenceTimes.length > 0
                ? ` at ${v1RecurrenceTimes.join(', ')}`
                : '';
              const summary = `Occurs ${freqPart}${onPart}${timesPart}.`;
              return (
                <div className="space-y-3 pt-3 border-t border-gray-100">
                  {/* Start */}
                  <div>
                    <CopilotInput label="Start" type="date" placeholder="Select date" value={node.config?.startDate ?? ''} onChange={e => patchNode(node.id, { config: { ...node.config, startDate: e.target.value } })} />
                    <p className="text-caption-1 text-gray-400 mt-1">The workflow must be published before this date to run on schedule.</p>
                  </div>

                  {/* Repeat */}
                  <div>
                    <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">Repeat</label>
                    <CopilotDropdown variant="dropdown" size="md" fullWidth options={repeatOpts} value={v1RecurrenceRepeat} placeholder="Select frequency"
                      onChange={(v: string) => setV1RecurrenceRepeat(v)}
                    />
                  </div>

                  {/* Every N unit(s) */}
                  <div>
                    <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">Every</label>
                    <div className="flex items-center gap-2">
                      <div style={{ width: 72 }}>
                        <CopilotInput defaultValue={v1RecurrenceInterval}
                          onBlur={e => setV1RecurrenceInterval(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') setV1RecurrenceInterval((e.target as HTMLInputElement).value); }}
                        />
                      </div>
                      <span className="text-body-2 text-gray-500">{unitLabel[v1RecurrenceRepeat] ?? 'day(s)'}</span>
                    </div>
                  </div>

                  {/* On (day-of-week) — Weekly only */}
                  {v1RecurrenceRepeat === 'weekly' && (
                    <div>
                      <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">On</label>
                      <div className="flex gap-1.5">
                        {['S','M','T','W','T','F','S'].map((d, i) => {
                          const active = v1RecurrenceDays.includes(i);
                          return (
                            <CopilotButton
                              key={i}
                              variant="ghost"
                              size="sm"
                              onClick={() => setV1RecurrenceDays(prev =>
                                active && prev.length > 1 ? prev.filter(x => x !== i) : active ? prev : [...prev, i]
                              )}
                              className={`flex-1 h-9 rounded-lg text-body-2-strong transition-colors ${active ? 'bg-[hsl(var(--primary))] text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                            >
                              {d}
                            </CopilotButton>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* At — specific run times (Daily + Weekly) */}
                  {['daily', 'weekly'].includes(v1RecurrenceRepeat) && (
                    <div>
                      <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">
                        At
                        <span className="text-caption-1 font-normal text-gray-400 ml-1.5">optional</span>
                      </label>
                      <div className="space-y-2">
                        {v1RecurrenceTimes.map((t, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="flex-1">
                              <input
                                type="time"
                                value={t}
                                onChange={e => setV1RecurrenceTimes(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-body-2 text-gray-900 bg-white focus:outline-none focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
                              />
                            </div>
                            <CopilotButton
                              variant="ghost"
                              size="sm"
                              onClick={() => setV1RecurrenceTimes(prev => prev.filter((_, j) => j !== i))}
                              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                            </CopilotButton>
                          </div>
                        ))}
                        <CopilotButton
                          variant="ghost"
                          size="sm"
                          onClick={() => setV1RecurrenceTimes(prev => [...prev, '09:00'])}
                          className="flex items-center gap-1.5 text-body-2 text-[hsl(var(--primary))] hover:opacity-80 transition-opacity"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          Add time
                        </CopilotButton>
                      </div>
                    </div>
                  )}

                  {/* On — Monthly */}
                  {v1RecurrenceRepeat === 'monthly' && (() => {
                    const dayOpts = Array.from({ length: 31 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) }));
                    const ordinalOpts = [
                      { label: 'First',  value: 'first'  },
                      { label: 'Second', value: 'second' },
                      { label: 'Third',  value: 'third'  },
                      { label: 'Fourth', value: 'fourth' },
                      { label: 'Last',   value: 'last'   },
                    ];
                    const weekdayOpts = [
                      { label: 'Sunday',      value: 'sunday',      dividerAbove: false },
                      { label: 'Monday',      value: 'monday' },
                      { label: 'Tuesday',     value: 'tuesday' },
                      { label: 'Wednesday',   value: 'wednesday' },
                      { label: 'Thursday',    value: 'thursday' },
                      { label: 'Friday',      value: 'friday' },
                      { label: 'Saturday',    value: 'saturday' },
                      { label: 'Day',         value: 'day',         dividerAbove: true },
                      { label: 'Weekday',     value: 'weekday' },
                      { label: 'Weekend Day', value: 'weekend-day' },
                    ];
                    const radioBase = 'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors';
                    return (
                      <div>
                        <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-2">On</label>
                        <div className="space-y-2">
                          {/* Option 1: day of month */}
                          <div className="flex items-center gap-2">
                            <CopilotButton
                              variant="ghost"
                              size="sm"
                              onClick={() => setV1RecurrenceMonthlyMode('day-of-month')}
                              className={`${radioBase} ${v1RecurrenceMonthlyMode === 'day-of-month' ? 'border-[hsl(var(--primary))]' : 'border-gray-300'}`}
                            >
                              {v1RecurrenceMonthlyMode === 'day-of-month' && <div className="w-2 h-2 rounded-full bg-[hsl(var(--primary))]" />}
                            </CopilotButton>
                            <div style={{ width: 80 }}>
                              <CopilotDropdown variant="dropdown" size="md" fullWidth options={dayOpts} value={v1RecurrenceMonthDay}
                                onChange={(v: string) => { setV1RecurrenceMonthDay(v); setV1RecurrenceMonthlyMode('day-of-month'); }}
                              />
                            </div>
                            <span className="text-body-2 text-gray-500">day</span>
                          </div>
                          {/* Option 2: ordinal weekday */}
                          <div className="flex items-center gap-2">
                            <CopilotButton
                              variant="ghost"
                              size="sm"
                              onClick={() => setV1RecurrenceMonthlyMode('ordinal-weekday')}
                              className={`${radioBase} ${v1RecurrenceMonthlyMode === 'ordinal-weekday' ? 'border-[hsl(var(--primary))]' : 'border-gray-300'}`}
                            >
                              {v1RecurrenceMonthlyMode === 'ordinal-weekday' && <div className="w-2 h-2 rounded-full bg-[hsl(var(--primary))]" />}
                            </CopilotButton>
                            <div className="flex-1">
                              <CopilotDropdown variant="dropdown" size="md" fullWidth options={ordinalOpts} value={v1RecurrenceMonthOrdinal}
                                onChange={(v: string) => { setV1RecurrenceMonthOrdinal(v); setV1RecurrenceMonthlyMode('ordinal-weekday'); }}
                              />
                            </div>
                            <div className="flex-1">
                              <CopilotDropdown variant="dropdown" size="md" fullWidth options={weekdayOpts} value={v1RecurrenceMonthWeekday}
                                onChange={(v: string) => { setV1RecurrenceMonthWeekday(v); setV1RecurrenceMonthlyMode('ordinal-weekday'); }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* End */}
                  <div>
                    <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">End</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <CopilotDropdown variant="dropdown" size="md" fullWidth options={endOpts} value={v1RecurrenceEnd} placeholder="Select end"
                          onChange={(v: string) => setV1RecurrenceEnd(v)}
                        />
                      </div>
                      {v1RecurrenceEnd === 'on-date' && (
                        <div className="flex-1"><CopilotInput type="date" placeholder="Select date" value={node.config?.endDate ?? ''} onChange={e => patchNode(node.id, { config: { ...node.config, endDate: e.target.value } })} /></div>
                      )}
                      {v1RecurrenceEnd === 'after-count' && (
                        <div style={{ width: 100 }}><PillInput ref={miscPillRef} placeholder="10" singleLine value={node.config?.afterCount ?? ''} onChange={val => patchNode(node.id, { config: { ...node.config, afterCount: val } })} onFocus={() => makePillFocus(miscPillRef.current)} /></div>
                      )}
                    </div>
                  </div>

                  {/* Summary */}
                  <p className="text-body-2 text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{summary}</p>

                  {/* Advanced — timezone */}
                  <div>
                    <CopilotButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setV1RecurrenceAdvanced(o => !o)}
                      className="w-full flex items-center gap-2 text-caption-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="flex-shrink-0 flex items-center gap-1">
                        Advanced
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${v1RecurrenceAdvanced ? 'rotate-180' : ''}`}>
                          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </CopilotButton>
                    {v1RecurrenceAdvanced && (
                      <div className="mt-3">
                        <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">Time zone</label>
                        <CopilotDropdown variant="dropdown" size="md" fullWidth options={tzOpts} value={node.config?.timeZone ?? 'utc'} onChange={val => patchNode(node.id, { config: { ...node.config, timeZone: val } })} placeholder="Select time zone" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {v1TriggerType === 'sliding-window' && (() => {
              const showHours   = ['day', 'week', 'month'].includes(v1SlidingFreq);
              const showMinutes = ['hour', 'day', 'week', 'month'].includes(v1SlidingFreq);
              const freqOpts = [{ label: 'Second', value: 'second' }, { label: 'Minute', value: 'minute' }, { label: 'Hour', value: 'hour' }, { label: 'Day', value: 'day' }, { label: 'Week', value: 'week' }, { label: 'Month', value: 'month' }];
              const tzOpts = [{ label: '(UTC) Coordinated Universal Time', value: 'utc' }, { label: '(UTC-05:00) Eastern Time', value: 'america/new_york' }, { label: '(UTC-06:00) Central Time', value: 'america/chicago' }, { label: '(UTC-07:00) Mountain Time', value: 'america/denver' }, { label: '(UTC-08:00) Pacific Time', value: 'america/los_angeles' }];
              return (
                <div className="space-y-3 pt-3 border-t border-gray-100">
                  {/* Description */}
                  <p className="text-body-2 text-gray-500 leading-snug">
                    Runs on a recurring schedule with contiguous time windows. If an execution is delayed, it processes the missed window when it resumes.
                  </p>

                  {/* Frequency + Interval */}
                  <div className="flex gap-2">
                    <div className="flex-[2]">
                      <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">Frequency <span className="text-red-500">*</span></label>
                      <CopilotDropdown variant="dropdown" size="md" fullWidth options={freqOpts} value={v1SlidingFreq} placeholder="Frequency"
                        onChange={(v: string) => setV1SlidingFreq(v)}
                      />
                    </div>
                    <div className="flex-1">
                      <PillInput ref={miscPillRef} label="Interval *" singleLine value={node.config?.slidingInterval ?? '1'} onChange={val => patchNode(node.id, { config: { ...node.config, slidingInterval: val } })} onFocus={() => makePillFocus(miscPillRef.current)} />
                    </div>
                  </div>

                  {/* At these hours */}
                  {showHours && (
                    <div>
                      <PillInput ref={miscPillRef} label="At these hours" placeholder="9, 17" singleLine value={node.config?.slidingHours ?? ''} onChange={val => patchNode(node.id, { config: { ...node.config, slidingHours: val } })} onFocus={() => makePillFocus(miscPillRef.current)} />
                      <p className="text-caption-1 text-gray-400 mt-1">Enter hours (0–23) separated by commas (e.g., 9, 17)</p>
                    </div>
                  )}

                  {/* At these minutes */}
                  {showMinutes && (
                    <div>
                      <PillInput ref={miscPillRef} label="At these minutes" placeholder="0, 30" singleLine value={node.config?.slidingMinutes ?? ''} onChange={val => patchNode(node.id, { config: { ...node.config, slidingMinutes: val } })} onFocus={() => makePillFocus(miscPillRef.current)} />
                      <p className="text-caption-1 text-gray-400 mt-1">Enter minutes (0–59) separated by commas (e.g., 0, 30)</p>
                    </div>
                  )}

                  {/* Advanced collapsible */}
                  <div>
                    <CopilotButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setV1SlidingAdvanced(o => !o)}
                      className="w-full flex items-center gap-2 text-caption-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="flex-shrink-0 flex items-center gap-1">
                        Advanced
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${v1SlidingAdvanced ? 'rotate-180' : ''}`}>
                          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </CopilotButton>
                    {v1SlidingAdvanced && (
                      <div className="space-y-3 mt-3">
                        <div>
                          <PillInput ref={miscPillRef} label="Delay" placeholder="PT1H" singleLine value={node.config?.slidingDelay ?? ''} onChange={val => patchNode(node.id, { config: { ...node.config, slidingDelay: val } })} onFocus={() => makePillFocus(miscPillRef.current)} />
                          <p className="text-caption-1 text-gray-400 mt-1">ISO 8601 duration before processing each window (e.g., PT1H, PT30M)</p>
                        </div>
                        <div>
                          <PillInput ref={miscPillRef} label="Start time" singleLine value={node.config?.slidingStartTime ?? ''} onChange={val => patchNode(node.id, { config: { ...node.config, slidingStartTime: val } })} onFocus={() => makePillFocus(miscPillRef.current)} />
                          <p className="text-caption-1 text-gray-400 mt-1">When to start the schedule (ISO 8601 format)</p>
                        </div>
                        <div>
                          <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">Time zone</label>
                          <CopilotDropdown variant="dropdown" size="md" fullWidth options={tzOpts} value={node.config?.slidingTimeZone ?? 'utc'} onChange={val => patchNode(node.id, { config: { ...node.config, slidingTimeZone: val } })} placeholder="Select time zone" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {v1TriggerType === 'http-request' && (
              <div className="space-y-3 pt-3 border-t border-gray-100">
                <div>
                  <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">HTTP POST URL</label>
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
                    <span className="text-caption-1-strong text-gray-500 flex-shrink-0">POST</span>
                    <div className="w-px h-3.5 bg-gray-300 flex-shrink-0" />
                    <span className="text-[10px] text-gray-600 truncate flex-1 font-mono">https://prod-12.eastus.logic.azure.com/workflows/abc123/triggers/manual/run</span>
                    <CopilotButton variant="ghost" size="sm" className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors" title="Copy URL">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4.5" y="1" width="8.5" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.25"/><rect x="1" y="3.5" width="8.5" height="9.5" rx="1.5" fill="white" stroke="currentColor" strokeWidth="1.25"/></svg>
                    </CopilotButton>
                  </div>
                  <p className="text-caption-1 text-gray-500 mt-1.5">This URL is generated automatically. Share it with the service that should trigger this workflow.</p>
                </div>
              </div>
            )}

            {v1TriggerType === 'http' && (
              <div className="space-y-3 pt-3 border-t border-gray-100">
                <PillInput ref={miscPillRef} label="URL" required placeholder="https://api.example.com/data" singleLine value={node.config?.httpUrl ?? ''} onChange={val => patchNode(node.id, { config: { ...node.config, httpUrl: val } })} onFocus={() => makePillFocus(miscPillRef.current)} />
                <div>
                  <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">Method</label>
                  <CopilotDropdown variant="dropdown" size="md" fullWidth
                    options={[{ label: 'GET', value: 'GET' }, { label: 'POST', value: 'POST' }, { label: 'PUT', value: 'PUT' }, { label: 'PATCH', value: 'PATCH' }]}
                    value={node.config?.httpMethod ?? 'GET'} onChange={val => patchNode(node.id, { config: { ...node.config, httpMethod: val } })} placeholder="Select method"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1"><PillInput ref={miscPillRef} label="Polling interval" singleLine value={node.config?.pollingInterval ?? '5'} onChange={val => patchNode(node.id, { config: { ...node.config, pollingInterval: val } })} onFocus={() => makePillFocus(miscPillRef.current)} /></div>
                  <div className="flex-1">
                    <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">Interval unit</label>
                    <CopilotDropdown variant="dropdown" size="md" fullWidth
                      options={[{ label: 'Seconds', value: 'second' }, { label: 'Minutes', value: 'minute' }, { label: 'Hours', value: 'hour' }]}
                      value={node.config?.pollingUnit ?? 'minute'} onChange={val => patchNode(node.id, { config: { ...node.config, pollingUnit: val } })} placeholder="Unit"
                    />
                  </div>
                </div>
              </div>
            )}

            {v1TriggerType === 'http-webhook' && (
              <div className="space-y-3 pt-3 border-t border-gray-100">
                <div>
                  <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">Callback URL</label>
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
                    <span className="text-[10px] text-gray-600 truncate flex-1 font-mono">https://prod-12.eastus.logic.azure.com/workflows/abc123/triggers/webhook/run</span>
                    <CopilotButton variant="ghost" size="sm" className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors" title="Copy URL">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4.5" y="1" width="8.5" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.25"/><rect x="1" y="3.5" width="8.5" height="9.5" rx="1.5" fill="white" stroke="currentColor" strokeWidth="1.25"/></svg>
                    </CopilotButton>
                  </div>
                  <p className="text-caption-1 text-gray-500 mt-1.5">Register this URL as the webhook endpoint in the external service.</p>
                </div>
                <PillInput ref={subscribeRef} label="Subscribe endpoint" placeholder="https://api.example.com/webhooks/subscribe" singleLine value={node.config?.subscribeEndpoint ?? ''} onChange={val => patchNode(node.id, { config: { ...node.config, subscribeEndpoint: val } })} onFocus={() => makePillFocus(subscribeRef.current)} />
                <PillInput ref={unsubscribeRef} label="Unsubscribe endpoint" placeholder="https://api.example.com/webhooks/unsubscribe" singleLine value={node.config?.unsubscribeEndpoint ?? ''} onChange={val => patchNode(node.id, { config: { ...node.config, unsubscribeEndpoint: val } })} onFocus={() => makePillFocus(unsubscribeRef.current)} />
              </div>
            )}

            {v1TriggerType === 'connector' && (
              <div className="space-y-3 pt-3 border-t border-gray-100">
                <div>
                  <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">Connector</label>
                  {v1SelectedConnector ? (
                    <div className="flex items-center gap-2">
                      <CopilotButton
                        variant="ghost"
                        size="sm"
                        onClick={() => setV1ConnectorPickerOpen(true)}
                        className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 hover:border-[hsl(var(--primary))] bg-white text-left transition-colors group min-w-0"
                      >
                        {(() => {
                          const iconSrc = getConnectorIconSrc(v1SelectedConnector);
                          const initials = v1SelectedConnector.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
                          const bg = connectorColor(v1SelectedConnector);
                          return iconSrc ? (
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-white border border-gray-200">
                              <img src={iconSrc} alt="" className="w-5 h-5" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-semibold" style={{ backgroundColor: bg, fontSize: 10 }}>
                              {initials}
                            </div>
                          );
                        })()}
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-body-2-strong text-gray-900 truncate">{v1SelectedConnector}</span>
                          {v1SelectedConnectorAction && (
                            <span className="text-caption-1 text-gray-400 truncate">{v1SelectedConnectorAction}</span>
                          )}
                        </div>
                        <span className="text-caption-1 text-gray-400 group-hover:text-[hsl(var(--primary))] transition-colors flex-shrink-0">Change</span>
                      </CopilotButton>
                      <CopilotButton
                        variant="ghost"
                        size="sm"
                        onClick={() => { setV1SelectedConnector(null); setV1SelectedConnectorAction(null); }}
                        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        title="Remove connector"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </CopilotButton>
                    </div>
                  ) : (
                    <CopilotButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setV1ConnectorPickerOpen(true)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-4 rounded-xl border-2 border-dashed text-left transition-colors hover:bg-blue-50"
                      style={{ borderColor: 'hsl(var(--primary))' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: 'hsl(var(--primary))' }}>
                        <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      <span className="text-body-2-strong" style={{ color: 'hsl(var(--primary))' }}>Select a connector</span>
                    </CopilotButton>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      case 'ai-action': {
        const aiInstructionsValue = node.config?.instructions || node.config?.task || '';
        return (
          <div className="space-y-4">
            {errorBanner}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-body-2-strong text-foreground">Instructions <span className="text-red-500 ml-0.5">*</span></label>
                <CopilotDropdown
                  variant="dropdown"
                  size="sm"
                  options={PROMPT_MODEL_OPTIONS}
                  value={node.config?.model ?? 'claude-sonnet-4-6'}
                  onChange={val => patchNode(node.id, { config: { ...node.config, model: val } })}
                  showSelectedIcon
                />
              </div>
              {isWorkflowTestingV2 ? (
                <div
                  onClick={() => openInstructionsModal(node, ALL_STEPS.find(s => s.label === node.label)?.label ?? 'Prompt')}
                  className="relative rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 min-h-[120px] text-sm text-gray-700 whitespace-pre-wrap cursor-pointer hover:border-gray-300 transition-colors group"
                >
                  {aiInstructionsValue || <span className="text-gray-400 italic">No instructions yet — click to add</span>}
                  <CopilotButton
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-2.5 right-2.5"
                    onClick={e => { e.stopPropagation(); openInstructionsModal(node, ALL_STEPS.find(s => s.label === node.label)?.label ?? 'Prompt'); }}
                  >Edit</CopilotButton>
                </div>
              ) : (
                <WorkflowInstructionsEditor
                  ref={instructionsRef}
                  key={node.id}
                  value={aiInstructionsValue}
                  onChange={val => patchNode(node.id, { config: { ...node.config, instructions: val } })}
                  placeholder="Describe what this prompt should do…"
                  onFirstInput={() => dismissBailBanner(node.id)}
                  onEditorFocus={() => makePillFocus(instructionsRef.current)}
                  hideHeader
                  className="min-h-[240px]"
                />
              )}
              {requiredError(node.config?.instructions) && !node.config?.task?.trim() && (
                <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--status-error))' }}>This field is required</p>
              )}
            </div>
            <CopilotDropdown
              label="Output"
              variant="dropdown"
              size="md"
              options={[{ label: 'Text', value: 'text' }, { label: 'JSON', value: 'json' }]}
              value={node.config?.outputFormat ?? 'text'}
              onChange={val => patchNode(node.id, { config: { ...node.config, outputFormat: val } })}
              placeholder="Select output format"
            />
          </div>
        );
      }
      case 'agent':
        return renderNewAgentConfig(node, { placeholder: 'e.g. Invoice Validation Agent', showToolsAndWorkIQ: false });
      case 'condition': {
        const { positive, negative } = getBranchLabels(node.branchType);

        const conditions: Condition[] = node.config?.conditions ?? [
          { id: crypto.randomUUID(), left: node.config?.conditionLeft ?? '', operator: node.config?.conditionOperator ?? 'eq', right: node.config?.conditionRight ?? '' },
        ];
        const conditionLogic: Array<'and' | 'or'> = node.config?.conditionLogic ?? [];
        const elseIfBranches: ElseIfBranch[] = node.config?.elseIfBranches ?? [];

        // ── Main If helpers ──
        const updateCondition = (idx: number, field: keyof Condition, value: string) => {
          patchNode(node.id, { config: { ...node.config, conditions: conditions.map((c, i) => i === idx ? { ...c, [field]: value } : c) } });
        };
        const addCondition = () => {
          patchNode(node.id, { config: { ...node.config, conditions: [...conditions, { id: crypto.randomUUID(), left: '', operator: 'eq', right: '' }], conditionLogic: [...conditionLogic, 'and'] } });
        };
        const removeCondition = (idx: number) => {
          const logicRemoveIdx = idx === 0 ? 0 : idx - 1;
          patchNode(node.id, { config: { ...node.config, conditions: conditions.filter((_, i) => i !== idx), conditionLogic: conditionLogic.filter((_, li) => li !== logicRemoveIdx) } });
        };
        const updateLogic = (idx: number, value: 'and' | 'or') => {
          patchNode(node.id, { config: { ...node.config, conditionLogic: conditionLogic.map((l, i) => i === idx ? value : l) } });
        };

        // ── Else If helpers ──
        const addElseIfBranch = () => {
          patchNode(node.id, { config: { ...node.config, elseIfBranches: [...elseIfBranches, { id: crypto.randomUUID(), conditions: [{ id: crypto.randomUUID(), left: '', operator: 'eq', right: '' }], conditionLogic: [] }] } });
        };
        const removeElseIfBranch = (bi: number) => {
          patchNode(node.id, { config: { ...node.config, elseIfBranches: elseIfBranches.filter((_, i) => i !== bi) } });
        };
        const updateElseIfCondition = (bi: number, ci: number, field: keyof Condition, value: string) => {
          patchNode(node.id, { config: { ...node.config, elseIfBranches: elseIfBranches.map((br, i) => i === bi ? { ...br, conditions: br.conditions.map((c, j) => j === ci ? { ...c, [field]: value } : c) } : br) } });
        };
        const addElseIfCondition = (bi: number) => {
          patchNode(node.id, { config: { ...node.config, elseIfBranches: elseIfBranches.map((br, i) => i === bi ? { ...br, conditions: [...br.conditions, { id: crypto.randomUUID(), left: '', operator: 'eq', right: '' }], conditionLogic: [...br.conditionLogic, 'and' as const] } : br) } });
        };
        const removeElseIfCondition = (bi: number, ci: number) => {
          const logicRemoveIdx = ci === 0 ? 0 : ci - 1;
          patchNode(node.id, { config: { ...node.config, elseIfBranches: elseIfBranches.map((br, i) => i === bi ? { ...br, conditions: br.conditions.filter((_, j) => j !== ci), conditionLogic: br.conditionLogic.filter((_, li) => li !== logicRemoveIdx) } : br) } });
        };
        const updateElseIfLogic = (bi: number, li: number, value: 'and' | 'or') => {
          patchNode(node.id, { config: { ...node.config, elseIfBranches: elseIfBranches.map((br, i) => i === bi ? { ...br, conditionLogic: br.conditionLogic.map((l, j) => j === li ? value : l) } : br) } });
        };

        // ── Reusable condition group renderer ──
        // isMainIfGroup: true → first condition (idx=0) cannot be deleted
        // onRemoveGroup: when set, removing the last condition in the group removes the whole group
        const renderConditionGroup = (
          isMainIfGroup: boolean,
          groupConditions: Condition[],
          groupLogic: Array<'and' | 'or'>,
          onUpdate: (ci: number, field: keyof Condition, value: string) => void,
          onUpdateLogic: (li: number, value: 'and' | 'or') => void,
          onAdd: () => void,
          onRemove: (ci: number) => void,
          onRemoveGroup?: () => void,
        ) => (
          /* Container: pl-7 (28px) offsets content right of the line.
             Line: left=13px, circles centered on line at left=-21 from content. */
          <div className="relative" style={{ paddingLeft: 28 }}>
            {/* Continuous dark vertical line */}
            <div className="absolute" style={{ left: 13, top: 0, bottom: 24, width: 2, backgroundColor: '#111827', borderRadius: 1 }} />
            {groupConditions.map((cond, idx) => (
              <ConditionRow
                key={cond.id}
                cond={cond}
                idx={idx}
                canDelete={!(isMainIfGroup && groupConditions.length === 1)}
                groupLogic={groupLogic}
                operatorOptions={OPERATOR_OPTIONS}
                onUpdate={onUpdate}
                onUpdateLogic={onUpdateLogic}
                onRemove={() => {
                  if (groupConditions.length === 1 && onRemoveGroup) {
                    onRemoveGroup();
                  } else {
                    onRemove(idx);
                  }
                }}
                onPillInputFocus={onPillInputFocus}
              />
            ))}
            {/* Add condition row with circle on line */}
            <div className="relative flex items-center gap-1.5 z-10 mt-1">
              <div className="absolute rounded-full bg-white" style={{ left: -20, top: 8, width: 12, height: 12, border: '1.5px solid #374151', zIndex: 1 }} />
              <CopilotButton
                variant="ghost" size="sm" onClick={onAdd}
                className="flex items-center gap-1.5 text-caption-1 text-[hsl(var(--primary))] hover:opacity-80"
              >
                <Add20Regular style={{ width: 12, height: 12 }} />
                Add condition
              </CopilotButton>
            </div>
          </div>
        );

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-body-2-strong text-[hsl(var(--secondary-foreground))]">Type</span>
              <CopilotDropdown
                variant="dropdown" size="sm"
                options={BRANCH_TYPE_OPTIONS}
                value={node.branchType ?? 'if-else'}
                onChange={val => patchNode(node.id, { branchType: val as BranchType })}
                placeholder="Select branch type"
              />
            </div>
            <hr className="border-gray-200" />
            <div>
              <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1">Condition</label>
              <p className="text-caption-1 text-gray-500 mb-3">Configure the branching logic</p>
              <div className="border border-gray-200 rounded-xl p-4">

                {/* ── If group ── */}
                <div className="mb-1">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-caption-1-strong bg-gray-100 text-gray-600 border border-gray-300">{positive}</span>
                </div>
                {renderConditionGroup(true, conditions, conditionLogic, updateCondition, updateLogic, addCondition, removeCondition)}

                {/* ── Else If groups (if-else type only) ── */}
                {elseIfBranches.map((branch, bi) => (
                  <React.Fragment key={branch.id}>
                    <hr className="border-gray-200 my-4" />
                    <div className="flex items-center justify-between mb-1">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-caption-1-strong bg-gray-100 text-gray-600 border border-gray-300">Else {positive}</span>
                      <CopilotButton
                        variant="ghost" size="sm"
                        onClick={() => removeElseIfBranch(bi)}
                        className="w-6 h-6 p-0 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                        title="Remove Else If branch"
                        aria-label="Remove Else If branch"
                      >
                        <Dismiss16Regular style={{ width: 12, height: 12 }} />
                      </CopilotButton>
                    </div>
                    {renderConditionGroup(
                      false,
                      branch.conditions,
                      branch.conditionLogic,
                      (ci, field, value) => updateElseIfCondition(bi, ci, field, value),
                      (li, value) => updateElseIfLogic(bi, li, value),
                      () => addElseIfCondition(bi),
                      (ci) => removeElseIfCondition(bi, ci),
                      () => removeElseIfBranch(bi),
                    )}
                  </React.Fragment>
                ))}

                {/* ── Add Else If (if-else type only) ── */}
                {(node.branchType ?? 'if-else') === 'if-else' && (
                  <>
                    <hr className="border-gray-200 my-4" />
                    <CopilotButton
                      variant="secondary" size="md"
                      onClick={addElseIfBranch}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      <Add20Regular style={{ width: 12, height: 12 }} />
                      Add Else If branch
                    </CopilotButton>
                  </>
                )}

                <hr className="border-gray-200 my-4" />

                {/* ── Else footer ── */}
                <div className="flex items-start gap-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-caption-1-strong bg-gray-100 text-gray-600 flex-shrink-0 mt-0.5 border border-gray-300">{negative}</span>
                  <p className="text-body-2 text-gray-700">If this condition is not met, the workflow continues through {negative}.</p>
                </div>
              </div>
            </div>
          </div>
        );
      }
      case 'action':
        return (
          <div className="space-y-4">
            {node.connector === 'Outlook' && errorBanner}
            {node.connector === 'Outlook' && (
              <>
                <div>
                  <PillInput ref={toRef} label="To" required placeholder="Enter email address" singleLine value={node.config?.to ?? ''} onChange={val => patchNode(node.id, { config: { ...node.config, to: val } })} onFocus={() => makePillFocus(toRef.current)} />
                  {requiredError(node.config?.to) && (
                    <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--status-error))' }}>This field is required</p>
                  )}
                </div>
                <div>
                  <PillInput ref={subjectRef} label="Subject" required placeholder="Enter subject" singleLine value={node.config?.subject ?? ''} onChange={val => patchNode(node.id, { config: { ...node.config, subject: val } })} onFocus={() => makePillFocus(subjectRef.current)} />
                  {requiredError(node.config?.subject) && (
                    <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--status-error))' }}>This field is required</p>
                  )}
                </div>
                <div>
                  <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">Body <span className="text-red-500">*</span></label>
                  <div className="border border-[hsl(var(--secondary-border))] rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[hsl(var(--secondary-border))] bg-[hsl(var(--secondary))]">
                      <CopilotButton variant="ghost" size="sm" className="text-caption-1 text-gray-600">Normal</CopilotButton>
                      <CopilotButton variant="ghost" size="sm" className="text-caption-1 text-gray-600">Arial</CopilotButton>
                      <CopilotButton variant="ghost" size="sm" className="text-caption-1 text-gray-600">15px</CopilotButton>
                      <span className="text-[hsl(var(--secondary-border))]">|</span>
                      <CopilotButton variant="ghost" size="sm" className="text-caption-1 font-bold text-gray-600">B</CopilotButton>
                      <CopilotButton variant="ghost" size="sm" className="text-caption-1 italic text-gray-600">I</CopilotButton>
                      <CopilotButton variant="ghost" size="sm" className="text-caption-1 underline text-gray-600">U</CopilotButton>
                    </div>
                    <PillInput ref={bodyRef} placeholder="Type text here" minHeight={100} value={node.config?.body ?? ''} onChange={val => patchNode(node.id, { config: { ...node.config, body: val } })} onFocus={() => makePillFocus(bodyRef.current)} />
                  </div>
                  {requiredError(node.config?.body) && (
                    <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--status-error))' }}>This field is required</p>
                  )}
                </div>
                <div>
                  <CopilotButton variant="ghost" size="sm" className="text-caption-1 text-[hsl(var(--primary))] hover:opacity-80">Show all</CopilotButton>
                  <span className="text-caption-1 text-gray-500 ml-2">Showing 0 of 6</span>
                </div>
              </>
            )}
            {node.connector === 'Dataverse' && (
              <>
                <PillInput ref={miscPillRef} label="Environment" singleLine value={node.config?.environment ?? 'contoso.crm.dynamics.com'} onChange={val => patchNode(node.id, { config: { ...node.config, environment: val } })} onFocus={() => makePillFocus(miscPillRef.current)} />
                <div>
                  <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-1.5">Table name</label>
                  <CopilotDropdown variant="dropdown" size="md" options={[{ label: 'Invoices', value: 'invoices' }, { label: 'Contacts', value: 'contacts' }, { label: 'Accounts', value: 'accounts' }]} value={node.config?.tableName ?? 'invoices'} onChange={val => patchNode(node.id, { config: { ...node.config, tableName: val } })} placeholder="Select table" />
                </div>
                <PillInput ref={miscPillRef} label="Status" placeholder="Enter status value" singleLine value={node.config?.status ?? ''} onChange={val => patchNode(node.id, { config: { ...node.config, status: val } })} onFocus={() => makePillFocus(miscPillRef.current)} />
              </>
            )}
          </div>
        );
      default:
        return <div className="text-caption-1 text-gray-500">Select a node to view details</div>;
    }
  };

  return renderNodeDetails(node);
};
