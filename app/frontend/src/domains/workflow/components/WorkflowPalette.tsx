// ─── Workflow Palette ──────────────────────────────────────────────────────
// V1 floating left panel (steps palette), V1 and V2 add-step modal dialogs.
// Extracted from WorkflowCanvas.tsx — pure refactor, no behavior changes.

import React from 'react';
import { WorkflowNode } from '../../../types';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotTooltip } from '../../../components/ui/CopilotTooltip';
import { SubHeader } from '../../../components/ui/SubHeader';
import {
  PanelLeft20Regular,
  Dismiss20Regular,
  Add20Regular,
  Sparkle20Regular,
  Open20Regular,
  Flash24Filled,
  Apps24Filled,
  Agents24Filled,
  ArrowSplit24Filled,
  Note24Filled,
  ChevronLeft20Regular,
} from '@fluentui/react-icons';
import {
  StepType,
  StepItem,
  StepDivider,
  ALL_STEPS,
  STEPS_WITH_EXISTING,
  STEP_TYPES,
  V2_STEP_CAT,
  V2_BUILTIN_TOOLS,
  CONNECTORS,
  CONNECTOR_ACTIONS,
  M365_COPILOT_ACTIONS,
  V2_CONNECTOR_ACTIONS,
  V2_ACTION_SUBTEXTS,
  V2_CONNECTOR_DISPLAY_MERGE,
  V2_MERGED_CONNECTOR_NAMES,
  V1_CONNECTOR_TRIGGER_EVENTS,
  MCP_PRODUCTS,
  MOCK_MCPS,
  getV2Suggestions,
  isMicrosoftConnector,
  MS_GROUPS,
  MsGroup,
  connInMsGroup,
  getMsGroupConnectors,
  shortenForGroup,
  MS_GROUP_ICONS,
  getConnectorIconSrc,
  connectorColor,
  V2PreviewAction,
  getV2PreviewContent,
  PREVIEW_DESCRIPTIONS,
  CONTROL_FLOW_COLOR,
  CONTROL_ACTION_ICONS,
  M365_COPILOT_SVG_PATH,
} from './workflowConstants';
import type { WorkflowCanvasState } from './useWorkflowCanvas';

interface Props {
  ctx: WorkflowCanvasState;
}

/** Produces all three palette sections as JSX variables */
export function useWorkflowPalettes(ctx: WorkflowCanvasState) {
  const {
    version,
    workflowNodes,
    insertAtIndex, setInsertAtIndex,
    insertBranch,
    closeAddStep,
    addStep,
    addMcpProductStep,
    dropStep,
    draggedStep, setDraggedStep,
    dragOverIndex, setDragOverIndex,
    openAddStep,
    panelView, setPanelView,
    v1PanelCollapsed, setV1PanelCollapsed,
    selectedConnector, setSelectedConnector,
    v1PaletteView, setV1PaletteView,
    v1PaletteConnector, setV1PaletteConnector,
    v1PaletteQuery, setV1PaletteQuery,
    v1PaletteConnectorOnly, setV1PaletteConnectorOnly,
    v1PaletteFavorites, setV1PaletteFavorites,
    v1PaletteCollapsed, setV1PaletteCollapsed,
    v1PaletteInputRef,
    v2PaletteInputRef,
    v2PaletteCategory, setV2PaletteCategory,
    v2PaletteQuery, setV2PaletteQuery,
    v2BuiltinTool, setV2BuiltinTool,
    v2MicrosoftGroup, setV2MicrosoftGroup,
    v2ConnectorDetail, setV2ConnectorDetail,
    v2McpDrillIn, setV2McpDrillIn,
    v2PreviewAction, setV2PreviewAction,
    v1ConnectorPickerOpen, setV1ConnectorPickerOpen,
    v1ConnectorPickerQuery, setV1ConnectorPickerQuery,
    v1ConnectorPickerCategory, setV1ConnectorPickerCategory,
    v1FavoriteConnectors, setV1FavoriteConnectors,
    v1MicrosoftGroup, setV1MicrosoftGroup,
    v1ConnectorDetail, setV1ConnectorDetail,
    v1PreviewAction, setV1PreviewAction,
    displacedInsert, setDisplacedInsert,
    getNodeIcon,
    nodeConfigMode, setNodeConfigMode,
    selectedNode, setSelectedNode,
    skipNodeConfigResetRef,
  } = ctx;

  const copilotBlueSvg = (size: number) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0" style={{ color: 'hsl(var(--primary))' }}>
      <path d={M365_COPILOT_SVG_PATH} fill="currentColor"/>
    </svg>
  );

  // Steps hidden from the left pane but still available in the add modal
  const HIDDEN_FROM_LEFT_PANE = new Set(['Guardrails', 'Extract', 'MCP']);

  // ─── V1 floating persistent left panel ─────────────────────────────────
  // ─── V1 floating persistent left panel (always-visible Steps palette) ────────
  const panelChevronRight = (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0 text-gray-300">
      <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const v2RowCls = (label: string) =>
    `group/r flex items-stretch transition-colors border-b border-gray-50 last:border-b-0 ${v2PreviewAction?.label === label ? 'bg-gray-100' : 'hover:bg-gray-50'}`;
  // Shared className for row buttons — w-full + !justify-start overrides CopilotButton's justify-center
  // !h-auto overrides the h-8 fixed height from CopilotButton size="sm" so py-* controls height
  const v2RowBtnCls = (extra = '') =>
    `w-full !h-auto !justify-start flex items-center gap-4 px-5 text-left flex-1 min-w-0 ${extra}`;
  const v2EyeBtn = (onClick: (e: React.MouseEvent) => void) => (
    <div className="opacity-0 group-hover/r:opacity-100 transition-opacity flex-shrink-0 flex items-center pr-4">
      <CopilotButton variant="secondary" size="sm" onClick={onClick}>
        Preview
      </CopilotButton>
    </div>
  );

  const PREVIEW_VISUALS: Record<string, React.ReactNode> = {
    'Condition': (
      <div className="w-full rounded-xl bg-gray-50 border border-gray-100 py-4 px-3">
        <svg viewBox="0 0 264 112" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
          <rect x="82" y="2" width="100" height="30" rx="7" fill="white" stroke="#d1d5db" strokeWidth="1.5"/>
          <text x="132" y="21" textAnchor="middle" fill="#374151" fontSize="11" fontFamily="system-ui,-apple-system,sans-serif" fontWeight="500">If condition</text>
          <line x1="132" y1="32" x2="132" y2="50" stroke="#d1d5db" strokeWidth="1.5"/>
          <line x1="50" y1="50" x2="214" y2="50" stroke="#d1d5db" strokeWidth="1.5"/>
          <text x="50" y="46" textAnchor="middle" fill="#86efac" fontSize="9" fontFamily="system-ui,-apple-system,sans-serif" fontWeight="600">TRUE</text>
          <line x1="50" y1="50" x2="50" y2="68" stroke="#86efac" strokeWidth="1.5"/>
          <rect x="4" y="68" width="92" height="30" rx="7" fill="#f0fdf4" stroke="#86efac" strokeWidth="1.5"/>
          <text x="50" y="87" textAnchor="middle" fill="#16a34a" fontSize="11" fontFamily="system-ui,-apple-system,sans-serif">Actions</text>
          <text x="214" y="46" textAnchor="middle" fill="#d1d5db" fontSize="9" fontFamily="system-ui,-apple-system,sans-serif" fontWeight="600">FALSE</text>
          <line x1="214" y1="50" x2="214" y2="68" stroke="#d1d5db" strokeWidth="1.5"/>
          <rect x="168" y="68" width="92" height="30" rx="7" fill="white" stroke="#d1d5db" strokeWidth="1.5"/>
          <text x="214" y="87" textAnchor="middle" fill="#9ca3af" fontSize="11" fontFamily="system-ui,-apple-system,sans-serif">Actions</text>
        </svg>
      </div>
    ),
  };

  const v1FloatingLeftPanel = (
    <div className="absolute left-4 top-4 bg-white z-20 flex flex-col overflow-hidden" style={{ width: v1PanelCollapsed ? 52 : 240, maxHeight: 'calc(100% - 244px)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-dropdown)', border: '1px solid #e5e7eb', transition: 'width 0.2s ease' }}>

      {/* ── Root view: main step types ── */}
      {panelView === 'root' && (<>
        <div className={`pt-3 pb-2.5 border-b border-gray-100 flex-shrink-0 flex items-center ${v1PanelCollapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
          {!v1PanelCollapsed && <h3 className="text-body-1-strong text-gray-900">Steps</h3>}
          <CopilotButton
            variant="ghost"
            size="sm"
            onClick={() => setV1PanelCollapsed(c => !c)}
            icon={<PanelLeft20Regular />}
            aria-label={v1PanelCollapsed ? 'Expand steps panel' : 'Collapse steps panel'}
            title={v1PanelCollapsed ? 'Expand steps panel' : 'Collapse steps panel'}
          />
        </div>
        <div className="py-1 flex-1 min-h-0 overflow-y-auto" onDragOver={e => e.preventDefault()}>
          {STEP_TYPES.filter(item => !('label' in item) || !HIDDEN_FROM_LEFT_PANE.has((item as StepType).label)).map((item, i) => {
            if ('divider' in item && item.divider) return <div key={`d-${i}`} className="my-1 border-t border-gray-100" />;
            const step = item as StepType;
            return (
              <div
                key={step.label}
                draggable={!step.hasChevron}
                onDragStart={step.hasChevron ? undefined : e => { setDraggedStep(step); e.dataTransfer.effectAllowed = 'copy'; }}
                onDragEnd={step.hasChevron ? undefined : () => { setDraggedStep(null); setDragOverIndex(null); }}
                onClick={() => {
                  if (step.hasChevron) {
                    if (version === 2) { setV1ConnectorPickerOpen(true); }
                    else { setV1PaletteConnectorOnly(true); openAddStep(insertAtIndex !== null ? insertAtIndex : workflowNodes.length); }
                  } else if (insertAtIndex !== null) { addStep(step.type, step.label, step.connector); }
                }}
                className={`flex items-center hover:bg-gray-50 text-left transition-colors select-none ${v1PanelCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-5 py-2.5'}`}
                style={{ opacity: draggedStep === step ? 0.4 : 1, cursor: step.hasChevron ? 'pointer' : 'grab' }}
                title={step.hasChevron ? `Browse ${step.label}s` : insertAtIndex !== null ? `Insert "${step.label}"` : 'Drag onto canvas or click a + to place'}
              >
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">{step.icon}</div>
                {!v1PanelCollapsed && <span className="text-body-2 text-gray-900 flex-1">{step.label}</span>}
              </div>
            );
          })}
        </div>
      </>)}

      {/* ── Connectors list ── */}
      {panelView === 'connectors' && (<>
        <SubHeader title="Connectors" onBack={() => setPanelView('root')} className="px-4 pt-3 pb-2" />
        <p className="px-4 pt-1.5 pb-1 text-caption-1 text-gray-400 flex-shrink-0">Click or drag onto canvas</p>
        <div className="py-1 flex-1 min-h-0 overflow-y-auto" onDragOver={e => e.preventDefault()}>
          {CONNECTORS.map(name => {
            const initials = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
            const bg = connectorColor(name);
            return (
              <div
                key={name}
                draggable
                onDragStart={e => { setDraggedStep({ type: 'action', label: name, icon: null, connector: name }); e.dataTransfer.effectAllowed = 'copy'; }}
                onDragEnd={() => { setDraggedStep(null); setDragOverIndex(null); }}
                onClick={() => { setSelectedConnector(name); setV1PanelCollapsed(false); setPanelView('connector-detail'); }}
                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors cursor-pointer select-none"
                style={{ opacity: draggedStep?.label === name ? 0.4 : 1 }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
                  <span className="text-white font-bold" style={{ fontSize: 10 }}>{initials}</span>
                </div>
                <span className="text-body-2 text-gray-900 flex-1 truncate">{name}</span>
                {panelChevronRight}
              </div>
            );
          })}
        </div>
      </>)}

      {/* ── MCP products submenu ── */}
      {panelView === 'mcp-servers' && (<>
        <SubHeader title="MCP" onBack={() => setPanelView('root')} className="px-4 pt-3 pb-2" />
        <p className="px-4 pt-1.5 pb-1 text-caption-1 text-gray-400 flex-shrink-0">Click or drag onto canvas</p>
        <div className="py-1 flex-1 min-h-0 overflow-y-auto" onDragOver={e => e.preventDefault()}>
          {MCP_PRODUCTS.map(product => (
            <div
              key={product.id}
              draggable
              onDragStart={e => { setDraggedStep({ type: 'action', label: 'MCP', icon: null, mcpServerId: product.id }); e.dataTransfer.effectAllowed = 'copy'; }}
              onDragEnd={() => { setDraggedStep(null); setDragOverIndex(null); }}
              onClick={() => { if (insertAtIndex !== null) addMcpProductStep(product.id); }}
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors cursor-pointer select-none"
              style={{ opacity: draggedStep?.mcpServerId === product.id ? 0.4 : 1 }}
              title={insertAtIndex !== null ? `Insert "${product.label} MCP"` : 'Drag onto canvas or click a + to place'}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: product.color }}>
                <span className="text-white font-bold" style={{ fontSize: 10 }}>{product.initials}</span>
              </div>
              <span className="text-body-2 text-gray-900 flex-1 truncate">{product.label}</span>
            </div>
          ))}
        </div>
      </>)}

      {/* ── Connector detail: individual connector actions ── */}
      {panelView === 'connector-detail' && selectedConnector && (<>
        <SubHeader
          title={selectedConnector}
          noIconWrap
          icon={
            <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: connectorColor(selectedConnector) }}>
              <span className="text-white font-bold" style={{ fontSize: 9 }}>
                {selectedConnector.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase()}
              </span>
            </div>
          }
          onBack={() => setPanelView('connectors')}
          className="px-4 pt-3 pb-2"
        />
        <div className="py-1 flex-1 min-h-0 overflow-y-auto" onDragOver={e => e.preventDefault()}>
          {CONNECTOR_ACTIONS.map(action => {
            const isTrigger = action.type === 'trigger';
            return (
              <div
                key={action.label}
                draggable
                onDragStart={e => { setDraggedStep({ type: action.type, label: action.label, icon: null, connector: selectedConnector }); e.dataTransfer.effectAllowed = 'copy'; }}
                onDragEnd={() => { setDraggedStep(null); setDragOverIndex(null); }}
                onClick={() => { if (insertAtIndex !== null) addStep(action.type, action.label, selectedConnector); }}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors cursor-grab active:cursor-grabbing select-none"
                style={{ opacity: draggedStep?.label === action.label ? 0.4 : 1 }}
                title={insertAtIndex !== null ? `Insert "${action.label}"` : 'Drag onto canvas or click a + to place'}
              >
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                  {isTrigger
                    ? <Flash24Filled style={{ color: '#f97316' }} />
                    : <Apps24Filled style={{ color: 'hsl(var(--primary))' }} />
                  }
                </div>
                <span className="text-body-2 text-gray-900 flex-1">{action.label}</span>
              </div>
            );
          })}
        </div>
      </>)}

    </div>
  );


  // ─── V1 '+' click step palette modal ─────────────────────────────────────
  const v1PaletteQuery_lc = v1PaletteQuery.trim().toLowerCase();
  const v1PaletteFilteredSteps = v1PaletteQuery_lc
    ? ALL_STEPS.filter(s => s.label !== 'Connector' && s.label.toLowerCase().includes(v1PaletteQuery_lc))
    : null;
  const v1PaletteFilteredConnectors = v1PaletteQuery_lc
    ? CONNECTORS.filter(name => name.toLowerCase().includes(v1PaletteQuery_lc))
    : null;
  const v1PaletteFiltered = v1PaletteQuery_lc
    ? { steps: v1PaletteFilteredSteps!, connectors: v1PaletteFilteredConnectors! }
    : null;

  const AI_STEP_LABELS = new Set(['Agent', 'Prompt', 'Classify', 'Guardrails', 'Extract', 'M365 Copilot', 'MCP', 'Computer Use', 'Human Review']);
  const CONTROL_STEP_LABELS = new Set(['Function', 'Variable', 'Branch', 'Switch', 'Loop']);

  const togglePaletteFavorite = (label: string, e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setV1PaletteFavorites(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };
  const togglePaletteSection = (id: string) => setV1PaletteCollapsed(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const starIcon = (filled: boolean) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill={filled ? '#ca8a04' : 'none'} className="flex-shrink-0 transition-colors" style={{ color: filled ? '#ca8a04' : '#d1d5db' }}>
      <path d="M8 1l1.85 3.75L14 5.5l-3 2.92.71 4.13L8 10.5l-3.71 1.95L5 8.42 2 5.5l4.15-.75L8 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  );

  const renderPaletteCard = (step: StepType) => (
    <CopilotButton
      key={step.label}
      variant="ghost"
      size="sm"
      onClick={() => { addStep(step.type, step.label, step.connector); }}
      className="flex items-center gap-2 px-3 py-5 rounded-full border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-left transition-all"
    >
      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">{step.icon}</div>
      <span className="text-body-2 text-gray-900 flex-1 truncate">{step.label}</span>
      <span
        role="button"
        tabIndex={0}
        onClick={e => togglePaletteFavorite(step.label, e)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePaletteFavorite(step.label, e); } }}
        className="hover:scale-110 transition-transform cursor-pointer flex-shrink-0"
        aria-label={v1PaletteFavorites.has(step.label) ? `Remove ${step.label} from favorites` : `Add ${step.label} to favorites`}
        aria-pressed={v1PaletteFavorites.has(step.label)}
      >{starIcon(v1PaletteFavorites.has(step.label))}</span>
      {step.hasChevron && <span className="text-gray-400 flex-shrink-0">{panelChevronRight}</span>}
    </CopilotButton>
  );

  const renderConnectorsSection = () => {
    const collapsed = v1PaletteCollapsed.has('connectors');
    const sectionContentId = 'palette-section-connectors';
    return (
      <div>
        <CopilotButton
          variant="ghost"
          onClick={() => togglePaletteSection('connectors')}
          className="flex items-center gap-1.5 w-full mb-2 hover:opacity-70 transition-opacity !px-0 !justify-start"
          aria-expanded={!collapsed}
          aria-controls={sectionContentId}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`flex-shrink-0 text-gray-400 transition-transform ${collapsed ? '-rotate-90' : ''}`}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-body-1-strong text-gray-900">Connectors</span>
        </CopilotButton>
        {!collapsed && (
          <div id={sectionContentId} className="grid grid-cols-2 gap-2 mb-4">
            {CONNECTORS.map(name => {
              const iconSrc = getConnectorIconSrc(name);
              const initials = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
              const bg = connectorColor(name);
              return (
                <CopilotButton
                  key={name}
                  variant="ghost"
                  size="sm"
                  onClick={() => { setV1PaletteConnector(name); setV1PaletteView('connector-detail'); }}
                  className="flex items-center gap-2 px-3 py-5 rounded-full border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-left transition-all"
                >
                  {iconSrc
                    ? <img src={iconSrc} alt="" className="w-8 h-8 rounded flex-shrink-0" />
                    : <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}><span className="text-white font-bold" style={{ fontSize: 11 }}>{initials}</span></div>
                  }
                  <span className="text-body-2 text-gray-900 flex-1 truncate">{name}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={e => togglePaletteFavorite(name, e)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePaletteFavorite(name, e); } }}
                    className="hover:scale-110 transition-transform cursor-pointer flex-shrink-0"
                    aria-label={v1PaletteFavorites.has(name) ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
                    aria-pressed={v1PaletteFavorites.has(name)}
                  >{starIcon(v1PaletteFavorites.has(name))}</span>
                  {panelChevronRight}
                </CopilotButton>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderPaletteSection = (title: string, id: string, steps: StepType[]) => {
    if (steps.length === 0) return null;
    const collapsed = v1PaletteCollapsed.has(id);
    const sectionContentId = `palette-section-${id}`;
    return (
      <div key={id}>
        <CopilotButton
          variant="ghost"
          onClick={() => togglePaletteSection(id)}
          className="flex items-center gap-1.5 w-full mb-2 hover:opacity-70 transition-opacity !px-0 !justify-start"
          aria-expanded={!collapsed}
          aria-controls={sectionContentId}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`flex-shrink-0 text-gray-400 transition-transform ${collapsed ? '-rotate-90' : ''}`}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-body-1-strong text-gray-900">{title}</span>
        </CopilotButton>
        {!collapsed && <div id={sectionContentId} className="grid grid-cols-2 gap-2 mb-4">{steps.map(renderPaletteCard)}</div>}
      </div>
    );
  };

  const closeV1Palette = () => { closeAddStep(); setV1PaletteConnectorOnly(false); };

  const v1PaletteModal = version === 1 && insertAtIndex !== null && (
    <div className="absolute inset-0 flex items-center justify-center z-30" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={closeV1Palette}>
      <div
        className="bg-white rounded-3xl overflow-hidden flex flex-col"
        style={{ width: 680, height: 720, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header (root only) ── */}
        {v1PaletteView === 'root' && (
          <div className="flex items-center justify-between px-6 py-5 flex-shrink-0">
            <h2 className="text-title-2 text-gray-900">Add</h2>
            <CopilotButton variant="ghost" size="sm" onClick={closeV1Palette} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close dialog" title="Close">
              <Dismiss20Regular style={{ width: 18, height: 18 }} />
            </CopilotButton>
          </div>
        )}

        {/* ── Root view ── */}
        {v1PaletteView === 'root' && (<>
          <div className="px-6 pb-4 flex-shrink-0">
            <CopilotInput
              ref={v1PaletteInputRef}
              size="md"
              value={v1PaletteQuery}
              onChange={e => setV1PaletteQuery(e.target.value)}
              placeholder="Search"
              className="w-full"
              contentBefore={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-gray-400"><circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/><path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
              contentAfter={v1PaletteQuery ? <CopilotButton variant="ghost" size="sm" onClick={() => setV1PaletteQuery('')} className="text-gray-400 hover:text-gray-600 p-0 min-w-0 w-5 h-5" aria-label="Clear search" title="Clear search"><Dismiss20Regular style={{ width: 14, height: 14 }} /></CopilotButton> : undefined}
              onKeyDown={e => { if (e.key === 'Escape') closeV1Palette(); }}
            />
          </div>
          <div className="overflow-auto flex-1 px-6 pb-6">
            {v1PaletteFiltered ? (
              (v1PaletteFiltered.steps.length === 0 && v1PaletteFiltered.connectors.length === 0)
                ? <div className="py-8 text-center text-caption-1 text-gray-400">No steps match "{v1PaletteQuery}"</div>
                : <div className="grid grid-cols-2 gap-2">
                    {v1PaletteFiltered.steps.map(renderPaletteCard)}
                    {v1PaletteFiltered.connectors.map(name => {
                      const iconSrc = getConnectorIconSrc(name);
                      const initials = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
                      const bg = connectorColor(name);
                      return (
                        <CopilotButton
                          key={name}
                          variant="ghost"
                          size="sm"
                          onClick={() => { setV1PaletteConnector(name); setV1PaletteView('connector-detail'); }}
                          className="flex items-center gap-2 px-3 py-5 rounded-full border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-left transition-all"
                        >
                          {iconSrc
                            ? <img src={iconSrc} alt="" className="w-8 h-8 rounded flex-shrink-0" />
                            : <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}><span className="text-white font-bold" style={{ fontSize: 11 }}>{initials}</span></div>
                          }
                          <span className="text-body-2 text-gray-900 flex-1 truncate">{name}</span>
                          <span
                            role="button" tabIndex={0}
                            onClick={e => togglePaletteFavorite(name, e)}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePaletteFavorite(name, e); } }}
                            className="hover:scale-110 transition-transform cursor-pointer flex-shrink-0"
                            aria-pressed={v1PaletteFavorites.has(name)}
                          >{starIcon(v1PaletteFavorites.has(name))}</span>
                          {panelChevronRight}
                        </CopilotButton>
                      );
                    })}
                  </div>
            ) : (<>
              {!v1PaletteConnectorOnly && renderPaletteSection('Favorites', 'favorites', ALL_STEPS.filter(s => v1PaletteFavorites.has(s.label) && !s.hasChevron))}
              {!v1PaletteConnectorOnly && renderPaletteSection('AI capabilities', 'ai', ALL_STEPS.filter(s => AI_STEP_LABELS.has(s.label)))}
              {!v1PaletteConnectorOnly && renderPaletteSection('Control Flow', 'control', ALL_STEPS.filter(s => CONTROL_STEP_LABELS.has(s.label)))}
              {renderConnectorsSection()}
            </>)}
          </div>
        </>)}


        {/* ── M365 Copilot detail ── */}
        {v1PaletteView === 'm365-detail' && (<>
          <div className="flex items-center justify-between px-6 py-5 flex-shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <CopilotButton variant="ghost" onClick={() => setV1PaletteView('root')} className="text-title-2 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0 !px-0">Add</CopilotButton>
              <span className="text-title-2 text-gray-400 flex-shrink-0">&gt;</span>
              <h2 className="text-title-2 text-gray-900 truncate">M365 Copilot</h2>
            </div>
            <CopilotButton variant="ghost" size="sm" onClick={closeAddStep} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0" aria-label="Close dialog" title="Close">
              <Dismiss20Regular style={{ width: 18, height: 18 }} />
            </CopilotButton>
          </div>
          <div className="px-6 pb-3 flex-shrink-0 flex items-center gap-2">
            {copilotBlueSvg(24)}
            <span className="text-body-1-strong text-gray-900">M365 Copilot</span>
            <span
              role="button" tabIndex={0}
              onClick={e => togglePaletteFavorite('M365 Copilot', e)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePaletteFavorite('M365 Copilot', e as any); } }}
              className="hover:scale-110 transition-transform cursor-pointer flex-shrink-0 ml-0.5"
              aria-label={v1PaletteFavorites.has('M365 Copilot') ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={v1PaletteFavorites.has('M365 Copilot')}
            >{starIcon(v1PaletteFavorites.has('M365 Copilot'))}</span>
          </div>
          <div className="px-6 pb-2 flex-shrink-0">
            <span className="text-body-1-strong text-gray-900">Actions</span>
          </div>
          <div className="overflow-auto flex-1 px-6 pb-6">
            <div className="grid grid-cols-2 gap-2">
              {M365_COPILOT_ACTIONS.map(action => {
                const actionKey = `M365 Copilot::${action.label}`;
                return (
                  <CopilotButton
                    key={action.label}
                    variant="ghost"
                    size="sm"
                    onClick={() => addStep(action.type, action.label, 'M365 Copilot')}
                    className="flex items-center gap-2 px-3 py-5 rounded-full border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-left transition-all"
                  >
                    {copilotBlueSvg(32)}
                    <span className="text-body-2 text-gray-900 flex-1 truncate">{action.label}</span>
                    <span
                      role="button" tabIndex={0}
                      onClick={e => togglePaletteFavorite(actionKey, e)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePaletteFavorite(actionKey, e as any); } }}
                      className="hover:scale-110 transition-transform cursor-pointer flex-shrink-0"
                      aria-pressed={v1PaletteFavorites.has(actionKey)}
                    >{starIcon(v1PaletteFavorites.has(actionKey))}</span>
                  </CopilotButton>
                );
              })}
            </div>
          </div>
        </>)}

        {/* ── MCP product selection ── */}
        {v1PaletteView === 'mcp-detail' && (<>
          <div className="flex items-center justify-between px-6 py-5 flex-shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <CopilotButton variant="ghost" onClick={() => setV1PaletteView('root')} className="text-title-2 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0 !px-0">Add</CopilotButton>
              <span className="text-title-2 text-gray-400 flex-shrink-0">&gt;</span>
              <h2 className="text-title-2 text-gray-900 truncate">MCP</h2>
            </div>
            <CopilotButton variant="ghost" size="sm" onClick={closeAddStep} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0" aria-label="Close dialog" title="Close">
              <Dismiss20Regular style={{ width: 18, height: 18 }} />
            </CopilotButton>
          </div>
          <div className="px-6 pb-3 flex-shrink-0">
            <p className="text-body-2 text-gray-500">Select an MCP server to connect to this workflow step.</p>
          </div>
          <div className="overflow-auto flex-1 px-6 pb-6">
            <div className="grid grid-cols-2 gap-2">
              {MCP_PRODUCTS.map(product => (
                <CopilotButton
                  key={product.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => addMcpProductStep(product.id)}
                  className="flex items-center gap-2 px-3 py-5 rounded-full border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-left transition-all"
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: product.color }}>
                    <span className="text-white font-bold" style={{ fontSize: 11 }}>{product.initials}</span>
                  </div>
                  <span className="text-body-2 text-gray-900 flex-1 truncate">{product.label}</span>
                </CopilotButton>
              ))}
            </div>
          </div>
        </>)}

        {/* ── Connector detail ── */}
        {v1PaletteView === 'connector-detail' && v1PaletteConnector && (<>
          {/* Breadcrumb header */}
          <div className="flex items-center justify-between px-6 py-5 flex-shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <CopilotButton
                variant="ghost"
                onClick={() => setV1PaletteView('root')}
                className="text-title-2 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0 !px-0"
              >Add</CopilotButton>
              <span className="text-title-2 text-gray-400 flex-shrink-0">&gt;</span>
              <h2 className="text-title-2 text-gray-900 truncate">{v1PaletteConnector}</h2>
            </div>
            <CopilotButton variant="ghost" size="sm" onClick={closeAddStep} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0" aria-label="Close dialog" title="Close">
              <Dismiss20Regular style={{ width: 18, height: 18 }} />
            </CopilotButton>
          </div>
          {/* Connector name + star */}
          <div className="px-6 pb-3 flex-shrink-0 flex items-center gap-2">
            {(() => {
              const iconSrc = getConnectorIconSrc(v1PaletteConnector);
              const initials = v1PaletteConnector.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
              const bg = connectorColor(v1PaletteConnector);
              return iconSrc
                ? <img src={iconSrc} alt="" className="w-6 h-6 rounded flex-shrink-0" />
                : <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}><span className="text-white font-bold" style={{ fontSize: 9 }}>{initials}</span></div>;
            })()}
            <span className="text-body-1-strong text-gray-900">{v1PaletteConnector}</span>
            <span
              role="button"
              tabIndex={0}
              onClick={e => togglePaletteFavorite(v1PaletteConnector!, e)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePaletteFavorite(v1PaletteConnector!, e as any); } }}
              className="hover:scale-110 transition-transform cursor-pointer flex-shrink-0 ml-0.5"
              aria-label={v1PaletteFavorites.has(v1PaletteConnector) ? `Remove ${v1PaletteConnector} from favorites` : `Add ${v1PaletteConnector} to favorites`}
              aria-pressed={v1PaletteFavorites.has(v1PaletteConnector)}
            >{starIcon(v1PaletteFavorites.has(v1PaletteConnector))}</span>
          </div>
          <div className="px-6 pb-2 flex-shrink-0">
            <span className="text-body-1-strong text-gray-900">Actions</span>
          </div>
          <div className="overflow-auto flex-1 px-6 pb-6">
            <div className="grid grid-cols-2 gap-2">
              {(() => {
                const specificActions = V2_CONNECTOR_ACTIONS[v1PaletteConnector];
                const actions = specificActions
                  ? specificActions.map(label => ({ label, type: 'action' as const }))
                  : CONNECTOR_ACTIONS;
                const iconSrc = getConnectorIconSrc(v1PaletteConnector);
                const initials = v1PaletteConnector.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
                const bg = connectorColor(v1PaletteConnector);
                return actions.map(action => {
                const actionKey = `${v1PaletteConnector}::${action.label}`;
                return (
                  <CopilotButton
                    key={action.label}
                    variant="ghost"
                    size="sm"
                    onClick={() => addStep(action.type, action.label, v1PaletteConnector)}
                    className="flex items-center gap-2 px-3 py-5 rounded-full border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-left transition-all"
                  >
                    {iconSrc
                      ? <img src={iconSrc} alt="" className="w-8 h-8 rounded flex-shrink-0" />
                      : <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}><span className="text-white font-bold" style={{ fontSize: 11 }}>{initials}</span></div>
                    }
                    <span className="text-body-2 text-gray-900 flex-1 truncate">{action.label}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={e => togglePaletteFavorite(actionKey, e)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePaletteFavorite(actionKey, e as any); } }}
                      className="hover:scale-110 transition-transform cursor-pointer flex-shrink-0"
                      aria-label={v1PaletteFavorites.has(actionKey) ? `Remove from favorites` : `Add to favorites`}
                      aria-pressed={v1PaletteFavorites.has(actionKey)}
                    >{starIcon(v1PaletteFavorites.has(actionKey))}</span>
                  </CopilotButton>
                );
                });
              })()}
            </div>
          </div>
        </>)}

      </div>
    </div>
  );

  // ─── V2 '+' click step palette modal ─────────────────────────────────────
  // Context-aware suggestions: look at the node immediately before the insertion point
  const v2PrevNode = (insertAtIndex !== null && insertAtIndex > 0)
    ? (workflowNodes[insertAtIndex - 1] ?? null)
    : (workflowNodes[0] ?? null);
  const v2Suggestions = getV2Suggestions(v2PrevNode);

  const MS_CONNECTOR_COUNT = CONNECTORS.filter(isMicrosoftConnector).length;
  const V2_CONTROL_TOOL_IDS = ['control', 'schedule'];
  // Tools shown under the Tools category — excludes anything that lives in Control
  const V2_BUILTIN_ONLY = V2_BUILTIN_TOOLS.filter(t => !V2_CONTROL_TOOL_IDS.includes(t.id));
  const V2_AI_COUNT = ALL_STEPS.filter(s => V2_STEP_CAT[s.label] === 'ai').length;
  const V2_CONTROL_COUNT = V2_BUILTIN_TOOLS.filter(t => V2_CONTROL_TOOL_IDS.includes(t.id)).reduce((n, t) => n + t.actions.length, 0);
  const V2_CATS: { id: string; label: string; count?: number; icon: React.ReactNode }[] = [
    { id: 'all',       label: 'All',        icon: <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor"/></svg> },
    ...(v2Suggestions.length > 0 ? [{ id: 'suggested', label: 'Suggested', count: v2Suggestions.length, icon: <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M8 1l1.8 3.6L14 5.6l-3 2.9.7 4.1L8 10.4l-3.7 2.2.7-4.1-3-2.9 4.2-.9L8 1z" fill="#f59e0b"/></svg> }] : []),
    { id: 'ai',        label: 'AI',         count: V2_AI_COUNT,          icon: <Agents24Filled style={{ width: 20, height: 20, color: 'hsl(var(--primary))' }} /> },
    { id: 'microsoft', label: 'Microsoft',  count: MS_CONNECTOR_COUNT,   icon: <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><rect x="0" y="0" width="7" height="7" fill="#F25022"/><rect x="9" y="0" width="7" height="7" fill="#7FBA00"/><rect x="0" y="9" width="7" height="7" fill="#00A4EF"/><rect x="9" y="9" width="7" height="7" fill="#FFB900"/></svg> },
    { id: 'connectors',label: 'Connectors', count: CONNECTORS.length,    icon: <Apps24Filled style={{ width: 20, height: 20, color: 'hsl(var(--primary))' }} /> },
    { id: 'control',   label: 'Controls',   count: V2_CONTROL_COUNT,     icon: <ArrowSplit24Filled style={{ width: 20, height: 20, color: CONTROL_FLOW_COLOR }} /> },
    { id: 'built-in',  label: 'Tools',      count: V2_BUILTIN_ONLY.reduce((n, t) => n + t.actions.length, 0), icon: <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M6.5 1a1 1 0 0 0-1 1v1.09A5.002 5.002 0 0 0 3.09 5.5H2a1 1 0 0 0 0 2h1.09A5.002 5.002 0 0 0 5.5 9.91V11a1 1 0 0 0 2 0V9.91A5.002 5.002 0 0 0 9.91 7.5H11a1 1 0 0 0 0-2H9.91A5.002 5.002 0 0 0 7.5 3.09V2a1 1 0 0 0-1-1zm0 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" fill="#6b7280"/></svg> },
  ];

  // Steps in current category (excludes 'Connector' item and old control-flow items now in Built-in)
  const V2_LEGACY_CF = ['Function', 'Variable', 'Branch', 'Switch', 'Loop'];
  const v2CategorySteps = ALL_STEPS.filter(s =>
    s.label !== 'Connector' &&
    !V2_LEGACY_CF.includes(s.label) &&
    (v2PaletteCategory === 'all' || V2_STEP_CAT[s.label] === v2PaletteCategory)
  );
  const v2ShowConnectors = v2PaletteCategory === 'all' || v2PaletteCategory === 'connectors' || v2PaletteCategory === 'microsoft';
  const v2ShowBuiltin = v2PaletteCategory === 'all' || v2PaletteCategory === 'built-in';
  const v2Q = v2PaletteQuery.toLowerCase().trim();
  const v2FilteredSteps = v2Q ? v2CategorySteps.filter(s => s.label.toLowerCase().includes(v2Q)) : v2CategorySteps;
  // Microsoft category: narrow pool to selected group when one is active; otherwise all MS connectors
  const v2ConnectorPool = v2PaletteCategory === 'microsoft'
    ? (v2MicrosoftGroup ? getMsGroupConnectors(v2MicrosoftGroup) : CONNECTORS.filter(isMicrosoftConnector))
    : CONNECTORS;
  const v2FilteredConnectors = v2ShowConnectors
    ? (v2Q ? v2ConnectorPool.filter(c => c.toLowerCase().includes(v2Q)) : v2ConnectorPool)
    : [];
  // Built-in / Control search: flatten tool actions filtered to the relevant tool set
  const v2BuiltinToolsForSearch = v2PaletteCategory === 'control'
    ? V2_BUILTIN_TOOLS.filter(t => V2_CONTROL_TOOL_IDS.includes(t.id))
    : V2_BUILTIN_ONLY;
  const v2BuiltinSearchResults: Array<{ tool: typeof V2_BUILTIN_TOOLS[number]; action: string }> =
    v2Q && (v2ShowBuiltin || v2PaletteCategory === 'control')
      ? v2BuiltinToolsForSearch.flatMap(tool => tool.actions.filter(a => a.toLowerCase().includes(v2Q)).map(action => ({ tool, action })))
      : [];
  const v2BuiltinToolDetail = V2_BUILTIN_TOOLS.find(t => t.id === v2BuiltinTool) ?? null;

  const v2PaletteModal = version === 2 && insertAtIndex !== null && (
    <div className="absolute inset-0 flex items-center justify-center z-30 p-6" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={closeAddStep}>
      <div
        className="bg-white rounded-2xl overflow-hidden flex flex-col w-full h-full"
        style={{ maxWidth: 1100, minWidth: 560, maxHeight: 740, minHeight: 420, boxShadow: '0 24px 80px rgba(0,0,0,0.2)', border: '1px solid #e5e7eb' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2 text-body-1-strong text-gray-900">
            <span>Add a step</span>
          </div>
          <CopilotButton variant="ghost" size="sm" onClick={closeAddStep} className="text-gray-400 hover:text-gray-600 transition-colors">
            <Dismiss20Regular style={{ width: 18, height: 18 }} />
          </CopilotButton>
        </div>

        {/* Body: sidebar + main */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="flex flex-col gap-0.5 p-3 flex-shrink-0" style={{ width: 'clamp(180px, 22%, 240px)', background: '#f5f6f8' }}>
            {V2_CATS.map(cat => (
              <CopilotButton
                key={cat.id}
                variant="ghost"
                size="sm"
                onClick={() => { setV2PaletteCategory(cat.id as typeof v2PaletteCategory); setV2PaletteQuery(''); setV2BuiltinTool(null); setV2MicrosoftGroup(null); setV2ConnectorDetail(null); setV2McpDrillIn(false); setV2PreviewAction(null); }}
                className={`!h-auto flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all w-full ${v2PaletteCategory === cat.id ? 'bg-white text-gray-900 font-medium shadow-sm border border-gray-200' : 'text-gray-500 hover:bg-white/60 hover:text-gray-800'}`}
              >
                <span className="flex-shrink-0">{cat.icon}</span>
                <span className="text-body-2 flex-1">{cat.label}</span>
                {cat.count !== undefined && (
                  <span className={`text-body-2 tabular-nums text-gray-400`}>{cat.count.toLocaleString()}</span>
                )}
              </CopilotButton>
            ))}
          </div>

          {/* Main: search + list */}
          <div className="flex flex-col flex-1 min-w-0">
            {/* Search */}
            <div className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0${['suggested', 'ai', 'utilities'].includes(v2PaletteCategory) ? ' hidden' : ''}`}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-gray-400">
                <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <CopilotInput
                ref={v2PaletteInputRef}
                size="sm"
                value={v2PaletteQuery}
                onChange={e => { setV2PaletteQuery(e.target.value); if (e.target.value) { setV2BuiltinTool(null); setV2MicrosoftGroup(null); setV2ConnectorDetail(null); setV2McpDrillIn(false); setV2PreviewAction(null); } }}
                placeholder={
                  v2PaletteCategory === 'connectors' ? 'Search connectors…' :
                  v2PaletteCategory === 'microsoft'  ? 'Search Microsoft…' :
                  v2PaletteCategory === 'built-in'   ? 'Search tools…' :
                  v2PaletteCategory === 'control'    ? 'Search controls…' :
                  v2PaletteCategory === 'ai'         ? 'Search AI steps…' :
                  v2PaletteCategory === 'utilities'  ? 'Search utilities…' :
                  'Search steps…'
                }
                className="flex-1 border-0 bg-transparent shadow-none px-0"
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    if (v2McpDrillIn) { setV2McpDrillIn(false); }
                    else if (v2BuiltinTool) { setV2BuiltinTool(null); }
                    else if (v2ConnectorDetail) { setV2ConnectorDetail(null); }
                    else if (v2MicrosoftGroup) { setV2MicrosoftGroup(null); }
                    else { closeAddStep(); }
                  }
                }}
              />
              {v2PaletteQuery && (
                <CopilotButton variant="ghost" size="sm" onClick={() => setV2PaletteQuery('')} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                  <Dismiss20Regular style={{ width: 14, height: 14 }} />
                </CopilotButton>
              )}
            </div>

            {/* Items */}
            <div className="overflow-auto flex-1">
              {(() => {
                // ── MCP product drill-in (AI category) ──
                if (v2McpDrillIn && v2PaletteCategory === 'ai') {
                  return (
                    <div className="py-1.5">
                      {/* Breadcrumb — sticky so it stays visible while scrolling */}
                      <div className="sticky top-0 z-10 bg-white flex items-center gap-2 px-3 py-2 border-b border-gray-100 mb-1">
                        <CopilotButton variant="ghost" size="sm" onClick={() => setV2McpDrillIn(false)} className="text-gray-400 hover:text-gray-700 !px-1.5" title="Back"><ChevronLeft20Regular /></CopilotButton>
                        <div className="w-px h-4 bg-gray-200 flex-shrink-0" />
                        <CopilotButton variant="ghost" size="sm" onClick={() => setV2McpDrillIn(false)} className="text-body-2 text-gray-500 hover:text-gray-900 transition-colors !px-0">AI</CopilotButton>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-gray-300"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span className="text-body-2 text-gray-900 font-semibold">MCP</span>
                      </div>
                      {MCP_PRODUCTS.map(product => {
                        const mcpIconNode = (
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: product.color }}>
                            <span className="text-white font-bold" style={{ fontSize: 10 }}>{product.initials}</span>
                          </div>
                        );
                        return (
                          <div key={product.id} className={v2RowCls(product.label)}>
                            <CopilotButton variant="ghost" size="sm" onClick={() => addMcpProductStep(product.id)} className={v2RowBtnCls('py-2.5')}>
                              {mcpIconNode}
                              <span className="text-body-2 font-medium text-gray-900">{product.label}</span>
                            </CopilotButton>
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // ── Suggested ──
                if (v2PaletteCategory === 'suggested') {
                  return (
                    <div className="py-1.5">
                      {v2Suggestions.map(s => {
                        const stepType = ALL_STEPS.find(st => st.label === s.label);
                        const builtinTool = V2_BUILTIN_TOOLS.find(t => t.actions.includes(s.label));
                        const connName = s.connector ?? s.label;
                        const connInitials = connName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
                        const connBg = connectorColor(connName);
                        const connIconSrc = getConnectorIconSrc(connName);
                        const sIconNode = stepType ? (
                          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">{stepType.icon}</div>
                        ) : builtinTool ? (
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: builtinTool.iconBg }}>
                            {builtinTool.icon ?? <span className="text-white font-bold" style={{ fontSize: 9 }}>{builtinTool.iconLabel}</span>}
                          </div>
                        ) : connIconSrc ? (
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white border border-gray-100"><img src={connIconSrc} alt="" className="w-5 h-5" /></div>
                        ) : (
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: connBg }}>
                            <span className="text-white font-bold" style={{ fontSize: 10 }}>{connInitials}</span>
                          </div>
                        );
                        return (
                          <div key={s.label} className={v2RowCls(s.label)}>
                            <CopilotButton variant="ghost" size="sm" onClick={() => addStep(s.type, s.label, s.connector)} className={v2RowBtnCls('py-2.5')}>
                              {sIconNode}
                              <div className="flex flex-col min-w-0">
                                <span className="text-body-2 text-gray-900">{s.label}</span>
                                <span className="text-caption-1 text-gray-400 truncate">{s.subtitle}</span>
                              </div>
                            </CopilotButton>
                            {v2EyeBtn(e => { e.stopPropagation(); setV2PreviewAction({ label: s.label, type: s.type, connector: s.connector, iconNode: sIconNode }); })}
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // ── Built-in: tool detail view (not searching) ──
                if (v2PaletteCategory === 'built-in' && v2BuiltinToolDetail && !v2Q) {
                  return (
                    <div className="py-1.5">
                      {/* Inline breadcrumb — sticky */}
                      <div className="sticky top-0 z-10 bg-white flex items-center gap-2 px-3 py-2 border-b border-gray-100 mb-1">
                        <CopilotButton variant="ghost" size="sm" onClick={() => setV2BuiltinTool(null)} className="text-gray-400 hover:text-gray-700 !px-1.5" title="Back"><ChevronLeft20Regular /></CopilotButton>
                        <div className="w-px h-4 bg-gray-200 flex-shrink-0" />
                        <CopilotButton variant="ghost" size="sm" onClick={() => setV2BuiltinTool(null)} className="text-body-2 text-gray-500 hover:text-gray-900 transition-colors !px-0">Tools</CopilotButton>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-gray-300"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span className="text-body-2 text-gray-900 font-semibold">{v2BuiltinToolDetail.label}</span>
                      </div>
                      {v2BuiltinToolDetail.actions.map(action => {
                        const btCtData = CONTROL_ACTION_ICONS[action];
                        const btIconNode = btCtData
                          ? <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: btCtData.bg }}>{btCtData.icon}</div>
                          : <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: v2BuiltinToolDetail.iconBg }}>{v2BuiltinToolDetail.icon ?? <span className="text-white font-bold" style={{ fontSize: 9 }}>{v2BuiltinToolDetail.iconLabel}</span>}</div>;
                        return (
                          <div key={action} className={v2RowCls(action)}>
                            <CopilotButton variant="ghost" size="sm" onClick={() => addStep('action', action)} className={v2RowBtnCls('py-2.5')}>
                              {btIconNode}
                              <span className="text-body-2 text-gray-900">{action}</span>
                            </CopilotButton>
                            {v2EyeBtn(e => { e.stopPropagation(); setV2PreviewAction({ label: action, type: 'action', parentLabel: v2BuiltinToolDetail.label, iconNode: btIconNode }); })}
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // ── Built-in: tool category list (not searching) ──
                if (v2PaletteCategory === 'built-in' && !v2Q) {
                  return (
                    <div className="py-1.5">
                      {V2_BUILTIN_ONLY.map(tool => {
                        const toolPreview = tool.actions.slice(0, 4).join(', ') + (tool.actions.length > 4 ? ', etc.' : '');
                        const single = tool.actions.length === 1;
                        const toolIconNode = <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: tool.iconBg }}>{tool.icon ?? <span className="text-white font-bold" style={{ fontSize: 9 }}>{tool.iconLabel}</span>}</div>;
                        if (single) {
                          return (
                            <div key={tool.id} className={v2RowCls(tool.actions[0])}>
                              <CopilotButton variant="ghost" size="sm" onClick={() => addStep('action', tool.actions[0])} className={v2RowBtnCls('py-2.5')}>
                                {toolIconNode}
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="text-body-2 font-medium text-gray-900">{tool.label}</span>
                                  <span className="text-caption-1 text-gray-400 truncate">{toolPreview}</span>
                                </div>
                              </CopilotButton>
                              {v2EyeBtn(e => { e.stopPropagation(); setV2PreviewAction({ label: tool.actions[0], type: 'action', parentLabel: tool.label, iconNode: toolIconNode }); })}
                            </div>
                          );
                        }
                        return (
                          <CopilotButton
                            key={tool.id}
                            variant="ghost"
                            size="sm"
                            onClick={() => setV2BuiltinTool(tool.id)}
                            className={v2RowBtnCls('py-2.5 hover:bg-gray-50 !w-full transition-colors')}
                          >
                            {toolIconNode}
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-body-2 font-medium text-gray-900">{tool.label}</span>
                              <span className="text-caption-1 text-gray-400 truncate">{toolPreview}</span>
                            </div>
                            <span className="bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 text-caption-1 flex-shrink-0 mr-1">{tool.actions.length}</span>
                            {panelChevronRight}
                          </CopilotButton>
                        );
                      })}
                    </div>
                  );
                }

                // ── Control: flat action list (not searching) ──
                if (v2PaletteCategory === 'control' && !v2Q) {
                  const controlActions = V2_BUILTIN_TOOLS
                    .filter(t => V2_CONTROL_TOOL_IDS.includes(t.id))
                    .flatMap(t => t.actions.map(a => ({ tool: t, action: a })))
                    .sort((a, b) => a.action.localeCompare(b.action));
                  return (
                    <div className="py-1.5">
                      {controlActions.map(({ tool, action }) => {
                        const ctData = CONTROL_ACTION_ICONS[action];
                        const ctIconNode = ctData
                          ? <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ctData.bg }}>{ctData.icon}</div>
                          : <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: tool.iconBg }}>{tool.icon ?? <span className="text-white font-bold" style={{ fontSize: 9 }}>{tool.iconLabel}</span>}</div>;
                        return (
                          <div key={action} className={v2RowCls(action)}>
                            <CopilotButton variant="ghost" size="sm" onClick={() => addStep('action', action)} className={v2RowBtnCls('py-2.5')}>
                              {ctIconNode}
                              <span className="text-body-2 text-gray-900">{action}</span>
                            </CopilotButton>
                            {v2EyeBtn(e => { e.stopPropagation(); setV2PreviewAction({ label: action, type: 'action', parentLabel: tool.label, iconNode: ctIconNode }); })}
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // ── Microsoft: connector action detail view (3rd level, not searching) ──
                if (v2PaletteCategory === 'microsoft' && v2MicrosoftGroup && v2ConnectorDetail && !v2Q) {
                  const connActions = V2_CONNECTOR_ACTIONS[v2ConnectorDetail] ?? [];
                  const msGroupLabel = (() => { const g = MS_GROUPS.find(g => g.id === v2MicrosoftGroup); return g ? g.label : 'Other Microsoft'; })();
                  const iconSrc = getConnectorIconSrc(v2ConnectorDetail);
                  const initials = v2ConnectorDetail.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
                  const bg = connectorColor(v2ConnectorDetail);
                  const connIconNode = iconSrc
                    ? <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white border border-gray-100"><img src={iconSrc} alt="" className="w-6 h-6" /></div>
                    : <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}><span className="text-white font-bold" style={{ fontSize: 10 }}>{initials}</span></div>;
                  return (
                    <div className="py-1.5">
                      {/* Inline breadcrumb: Microsoft > [Group] > [Connector] — sticky */}
                      <div className="sticky top-0 z-10 bg-white flex items-center gap-2 px-3 py-2 border-b border-gray-100 mb-1">
                        <CopilotButton variant="ghost" size="sm" onClick={() => setV2ConnectorDetail(null)} className="text-gray-400 hover:text-gray-700 !px-1.5" title="Back"><ChevronLeft20Regular /></CopilotButton>
                        <div className="w-px h-4 bg-gray-200 flex-shrink-0" />
                        <CopilotButton variant="ghost" size="sm" onClick={() => { setV2MicrosoftGroup(null); setV2ConnectorDetail(null); }} className="text-body-2 text-gray-500 hover:text-gray-900 transition-colors !px-0">Microsoft</CopilotButton>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-gray-300"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <CopilotButton variant="ghost" size="sm" onClick={() => setV2ConnectorDetail(null)} className="text-body-2 text-gray-500 hover:text-gray-900 transition-colors !px-0">{msGroupLabel}</CopilotButton>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-gray-300"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span className="text-body-2 text-gray-900 font-semibold">{v2ConnectorDetail}</span>
                      </div>
                      {connActions.map(action => {
                        const variantSubtext = V2_ACTION_SUBTEXTS[v2ConnectorDetail]?.[action];
                        return (
                          <div key={action} className={v2RowCls(action)}>
                            <CopilotButton variant="ghost" size="sm" onClick={() => addStep('action', action, v2ConnectorDetail)} className={v2RowBtnCls('py-2.5')}>
                              {connIconNode}
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-body-2 text-gray-900 truncate">{action}</span>
                                {variantSubtext && <span className="text-caption-1 text-gray-400">{variantSubtext}</span>}
                              </div>
                            </CopilotButton>
                            {v2EyeBtn(e => { e.stopPropagation(); setV2PreviewAction({ label: action, type: 'action', connector: v2ConnectorDetail, parentLabel: v2ConnectorDetail, iconNode: connIconNode }); })}
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // ── Microsoft: group detail view (not searching) ──
                if (v2PaletteCategory === 'microsoft' && v2MicrosoftGroup && !v2ConnectorDetail && !v2Q) {
                  const groupConnectors = getMsGroupConnectors(v2MicrosoftGroup);
                  const msGroupLabel = (() => { const g = MS_GROUPS.find(g => g.id === v2MicrosoftGroup); return g ? g.label : 'Other Microsoft'; })();
                  // Build display rows: merged display entries first (deduplicated), then individual connectors not part of any merge group
                  const renderedMergeKeys = new Set<string>();
                  const displayRows: Array<{ key: string; displayName: string; isMerged: boolean; mergedCount?: number }> = [];
                  for (const name of groupConnectors) {
                    if (V2_MERGED_CONNECTOR_NAMES.has(name)) {
                      const mergeKey = Object.keys(V2_CONNECTOR_DISPLAY_MERGE).find(k => V2_CONNECTOR_DISPLAY_MERGE[k].includes(name))!;
                      if (!renderedMergeKeys.has(mergeKey)) {
                        renderedMergeKeys.add(mergeKey);
                        const mergedCount = V2_CONNECTOR_ACTIONS[mergeKey] ? V2_CONNECTOR_ACTIONS[mergeKey].length : undefined;
                        displayRows.push({ key: mergeKey, displayName: mergeKey, isMerged: true, mergedCount });
                      }
                    } else {
                      displayRows.push({ key: name, displayName: name, isMerged: false });
                    }
                  }
                  displayRows.sort((a, b) => shortenForGroup(a.displayName, v2MicrosoftGroup!).localeCompare(shortenForGroup(b.displayName, v2MicrosoftGroup!)));
                  return (
                    <div className="py-1.5">
                      {/* Inline breadcrumb — sticky */}
                      <div className="sticky top-0 z-10 bg-white flex items-center gap-2 px-3 py-2 border-b border-gray-100 mb-1">
                        <CopilotButton variant="ghost" size="sm" onClick={() => setV2MicrosoftGroup(null)} className="text-gray-400 hover:text-gray-700 !px-1.5" title="Back"><ChevronLeft20Regular /></CopilotButton>
                        <div className="w-px h-4 bg-gray-200 flex-shrink-0" />
                        <CopilotButton variant="ghost" size="sm" onClick={() => setV2MicrosoftGroup(null)} className="text-body-2 text-gray-500 hover:text-gray-900 transition-colors !px-0">Microsoft</CopilotButton>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-gray-300"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span className="text-body-2 text-gray-900 font-semibold">{msGroupLabel}</span>
                      </div>
                      {displayRows.map(({ key, displayName, mergedCount }) => {
                        const rowLabel = shortenForGroup(displayName, v2MicrosoftGroup!);
                        const initials = displayName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
                        const bg = connectorColor(displayName);
                        const iconSrc = getConnectorIconSrc(displayName);
                        const actionCount = V2_CONNECTOR_ACTIONS[displayName]?.length ?? mergedCount;
                        const hasActions = !!actionCount;
                        const msIconNode = iconSrc
                          ? <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white border border-gray-100"><img src={iconSrc} alt="" className="w-6 h-6" /></div>
                          : <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}><span className="text-white font-bold" style={{ fontSize: 10 }}>{initials}</span></div>;
                        return (
                          <div key={key} className={v2RowCls(displayName)}>
                            <CopilotButton
                              variant="ghost"
                              size="sm"
                              onClick={() => hasActions ? setV2ConnectorDetail(displayName) : addStep('action', displayName, displayName)}
                              className={v2RowBtnCls('py-2.5')}
                            >
                              {msIconNode}
                              <span className="text-body-2 font-medium text-gray-900 flex-1 truncate">{rowLabel}</span>
                              {hasActions && <span className="bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 text-caption-1 flex-shrink-0 mr-1">{actionCount}</span>}
                              {hasActions && panelChevronRight}
                            </CopilotButton>
                            {!hasActions && v2EyeBtn(e => { e.stopPropagation(); setV2PreviewAction({ label: displayName, type: 'action', connector: displayName, parentLabel: msGroupLabel, iconNode: msIconNode }); })}
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // ── Microsoft: group list (not searching) ──
                if (v2PaletteCategory === 'microsoft' && !v2MicrosoftGroup && !v2Q) {
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
                            onClick={() => setV2MicrosoftGroup(row.id)}
                            className={v2RowBtnCls('py-2.5 hover:bg-gray-50 !w-full transition-colors')}
                          >
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: gi?.bg ?? '#f3f4f6' }}>
                              {gi?.icon}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-body-2 font-medium text-gray-900">{row.label}</span>
                              <span className="text-caption-1 text-gray-400 truncate">{preview}</span>
                            </div>
                            <span className="bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 text-caption-1 flex-shrink-0 mr-1">{row.count}</span>
                            {panelChevronRight}
                          </CopilotButton>
                        );
                      })}
                    </div>
                  );
                }

                // ── All: ordered browse view (not searching) ──
                if (v2PaletteCategory === 'all' && !v2Q) {
                  const aiSteps = v2CategorySteps.filter(s => V2_STEP_CAT[s.label] === 'ai');
                  const msAll = CONNECTORS.filter(isMicrosoftConnector);
                  const msGroupRows = [
                    ...MS_GROUPS.map(g => ({ id: g.id, label: g.label, count: msAll.filter(n => connInMsGroup(n, g)).length })),
                    { id: 'ms-other', label: 'Other Microsoft', count: msAll.filter(n => !MS_GROUPS.some(g => connInMsGroup(n, g))).length },
                  ].filter(row => row.count > 0);
                  const nonMsConnectors = CONNECTORS.filter(c => !isMicrosoftConnector(c));
                  const allControlActions = V2_BUILTIN_TOOLS
                    .filter(t => V2_CONTROL_TOOL_IDS.includes(t.id))
                    .flatMap(t => t.actions.map(a => ({ tool: t, action: a })));
                  const sectionHdr = (label: string, count: number) => (
                    <div className="px-4 pt-4 pb-1.5 flex items-center gap-2">
                      <span className="text-body-2-strong text-gray-500">{label}</span>
                      <span className="text-caption-1 text-gray-400">{count.toLocaleString()}</span>
                    </div>
                  );
                  return (
                    <div className="py-1.5">
                      {/* AI */}
                      {aiSteps.length > 0 && <>{sectionHdr('AI', aiSteps.length)}{aiSteps.map(step => {
                        const isMcp = step.label === 'MCP';
                        const stIconNode = <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">{step.icon}</div>;
                        return (
                          <div key={step.label} className={v2RowCls(step.label)}>
                            <CopilotButton variant="ghost" size="sm" onClick={() => { if (isMcp) { setV2PaletteCategory('ai'); setV2McpDrillIn(true); } else addStep(step.type, step.label, step.connector); }} className={v2RowBtnCls('py-2.5')}>
                              {stIconNode}<span className="text-body-2 text-gray-900 flex-1">{step.label}</span>
                              {isMcp && <span className="bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 text-caption-1 flex-shrink-0 mr-1">{MCP_PRODUCTS.length}</span>}
                              {isMcp && panelChevronRight}
                            </CopilotButton>
                            {!isMcp && v2EyeBtn(e => { e.stopPropagation(); setV2PreviewAction({ label: step.label, type: step.type, connector: step.connector, iconNode: stIconNode }); })}
                          </div>
                        );
                      })}</>}
                      {/* Microsoft */}
                      {msGroupRows.length > 0 && <>{sectionHdr('Microsoft', msAll.length)}{msGroupRows.map(row => {
                        const gi = MS_GROUP_ICONS[row.id];
                        const preview = (() => { const names = getMsGroupConnectors(row.id); const shown = names.slice(0, 4).map(n => shortenForGroup(n, row.id)); return shown.join(', ') + (names.length > 4 ? ', etc.' : ''); })();
                        return (
                          <CopilotButton key={row.id} variant="ghost" size="sm" onClick={() => { setV2PaletteCategory('microsoft'); setV2MicrosoftGroup(row.id); }} className={v2RowBtnCls('py-2.5 hover:bg-gray-50 !w-full transition-colors')}>
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: gi?.bg ?? '#f3f4f6' }}>{gi?.icon}</div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-body-2 font-medium text-gray-900">{row.label}</span>
                              <span className="text-caption-1 text-gray-400 truncate">{preview}</span>
                            </div>
                            <span className="bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 text-caption-1 flex-shrink-0 mr-1">{row.count}</span>
                            {panelChevronRight}
                          </CopilotButton>
                        );
                      })}</>}
                      {/* Connectors (non-Microsoft only) */}
                      {nonMsConnectors.length > 0 && <>{sectionHdr('Connectors', nonMsConnectors.length)}{nonMsConnectors.map(name => {
                        const initials = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
                        const bg = connectorColor(name);
                        const iconSrc = getConnectorIconSrc(name);
                        const connIconNode = iconSrc
                          ? <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white border border-gray-100"><img src={iconSrc} alt="" className="w-6 h-6" /></div>
                          : <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}><span className="text-white font-bold" style={{ fontSize: 10 }}>{initials}</span></div>;
                        return (
                          <div key={name} className={v2RowCls(name)}>
                            <CopilotButton variant="ghost" size="sm" onClick={() => addStep('action', name, name)} className={v2RowBtnCls('py-2.5')}>
                              {connIconNode}<span className="text-body-2 text-gray-900 flex-1 truncate">{name}</span>
                            </CopilotButton>
                            {v2EyeBtn(e => { e.stopPropagation(); setV2PreviewAction({ label: name, type: 'action', connector: name, iconNode: connIconNode }); })}
                          </div>
                        );
                      })}</>}
                      {/* Controls */}
                      {allControlActions.length > 0 && <>{sectionHdr('Controls', allControlActions.length)}{allControlActions.map(({ tool, action }) => {
                        const ctData = CONTROL_ACTION_ICONS[action];
                        const ctIconNode = ctData
                          ? <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ctData.bg }}>{ctData.icon}</div>
                          : <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: tool.iconBg }}>{tool.icon ?? <span className="text-white font-bold" style={{ fontSize: 9 }}>{tool.iconLabel}</span>}</div>;
                        return (
                          <div key={action} className={v2RowCls(action)}>
                            <CopilotButton variant="ghost" size="sm" onClick={() => addStep('action', action)} className={v2RowBtnCls('py-2.5')}>
                              {ctIconNode}<span className="text-body-2 text-gray-900">{action}</span>
                            </CopilotButton>
                            {v2EyeBtn(e => { e.stopPropagation(); setV2PreviewAction({ label: action, type: 'action', parentLabel: tool.label, iconNode: ctIconNode }); })}
                          </div>
                        );
                      })}</>}
                      {/* Tools */}
                      {V2_BUILTIN_ONLY.length > 0 && <>{sectionHdr('Tools', V2_BUILTIN_ONLY.length)}{V2_BUILTIN_ONLY.map(tool => {
                        const toolPreview = tool.actions.slice(0, 4).join(', ') + (tool.actions.length > 4 ? ', etc.' : '');
                        const single = tool.actions.length === 1;
                        const toolIconNode = <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: tool.iconBg }}>{tool.icon ?? <span className="text-white font-bold" style={{ fontSize: 9 }}>{tool.iconLabel}</span>}</div>;
                        if (single) return (
                          <div key={tool.id} className={v2RowCls(tool.actions[0])}>
                            <CopilotButton variant="ghost" size="sm" onClick={() => addStep('action', tool.actions[0])} className={v2RowBtnCls('py-2.5')}>
                              {toolIconNode}
                              <div className="flex flex-col min-w-0 flex-1"><span className="text-body-2 font-medium text-gray-900">{tool.label}</span><span className="text-caption-1 text-gray-400 truncate">{toolPreview}</span></div>
                            </CopilotButton>
                            {v2EyeBtn(e => { e.stopPropagation(); setV2PreviewAction({ label: tool.actions[0], type: 'action', parentLabel: tool.label, iconNode: toolIconNode }); })}
                          </div>
                        );
                        return (
                          <CopilotButton key={tool.id} variant="ghost" size="sm" onClick={() => { setV2PaletteCategory('built-in'); setV2BuiltinTool(tool.id); }} className={v2RowBtnCls('py-2.5 hover:bg-gray-50 !w-full transition-colors')}>
                            {toolIconNode}
                            <div className="flex flex-col min-w-0 flex-1"><span className="text-body-2 font-medium text-gray-900">{tool.label}</span><span className="text-caption-1 text-gray-400 truncate">{toolPreview}</span></div>
                            <span className="bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 text-caption-1 flex-shrink-0 mr-1">{tool.actions.length}</span>
                            {panelChevronRight}
                          </CopilotButton>
                        );
                      })}</>}
                    </div>
                  );
                }

                // ── No results ──
                const totalResults = v2FilteredSteps.length + v2FilteredConnectors.length + v2BuiltinSearchResults.length;
                if (v2Q && totalResults === 0) {
                  return <div className="px-6 py-10 text-center text-body-2 text-gray-400">No results for "{v2PaletteQuery}"</div>;
                }

                // ── Standard list (ai/connectors/control/tools/utilities + searching) ──
                return (
                  <div className="py-1.5">
                    {/* Step type items */}
                    {v2FilteredSteps.length > 0 && (
                      <>
                        {v2Q && (v2FilteredConnectors.length > 0 || v2BuiltinSearchResults.length > 0) && (
                          <div className="px-4 pt-2 pb-1"><span className="text-caption-1-strong text-gray-400 uppercase tracking-wider">Steps</span></div>
                        )}
                        {v2FilteredSteps.map(step => {
                          const isMcp = step.label === 'MCP';
                          const stIconNode = <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">{step.icon}</div>;
                          return (
                            <div key={step.label} className={v2RowCls(step.label)}>
                              <CopilotButton variant="ghost" size="sm" onClick={() => { if (isMcp) { setV2PaletteCategory('ai'); setV2McpDrillIn(true); } else addStep(step.type, step.label, step.connector); }} className={v2RowBtnCls('py-2.5')}>
                                {stIconNode}
                                <span className="text-body-2 text-gray-900 flex-1">{step.label}</span>
                                {isMcp && panelChevronRight}
                              </CopilotButton>
                              {!isMcp && v2EyeBtn(e => { e.stopPropagation(); setV2PreviewAction({ label: step.label, type: step.type, connector: step.connector, iconNode: stIconNode }); })}
                            </div>
                          );
                        })}
                      </>
                    )}

                    {/* Built-in tool category rows (All view, no search) */}
                    {v2ShowBuiltin && !v2Q && v2PaletteCategory === 'all' && (
                      <>
                        <div className="px-4 pt-4 pb-1.5 flex items-center gap-2">
                          <span className="text-body-2-strong text-gray-700">Tools</span>
                          <span className="text-caption-1 text-gray-400">{V2_BUILTIN_ONLY.length}</span>
                        </div>
                        {V2_BUILTIN_ONLY.map(tool => {
                          const toolPreview = tool.actions.slice(0, 4).join(', ') + (tool.actions.length > 4 ? ', etc.' : '');
                          const single = tool.actions.length === 1;
                          const toolIconNode = <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: tool.iconBg }}>{tool.icon ?? <span className="text-white font-bold" style={{ fontSize: 9 }}>{tool.iconLabel}</span>}</div>;
                          if (single) {
                            return (
                              <div key={tool.id} className={v2RowCls(tool.actions[0])}>
                                <CopilotButton variant="ghost" size="sm" onClick={() => addStep('action', tool.actions[0])} className={v2RowBtnCls('py-2.5')}>
                                  {toolIconNode}
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-body-2 font-medium text-gray-900">{tool.label}</span>
                                    <span className="text-body-2 text-gray-400 truncate">{toolPreview}</span>
                                  </div>
                                </CopilotButton>
                                {v2EyeBtn(e => { e.stopPropagation(); setV2PreviewAction({ label: tool.actions[0], type: 'action', parentLabel: tool.label, iconNode: toolIconNode }); })}
                              </div>
                            );
                          }
                          return (
                            <CopilotButton
                              key={tool.id}
                              variant="ghost"
                              size="sm"
                              onClick={() => { setV2PaletteCategory('built-in'); setV2BuiltinTool(tool.id); }}
                              className={v2RowBtnCls('py-2.5 hover:bg-gray-50 !w-full transition-colors')}
                            >
                              {toolIconNode}
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-body-2 font-medium text-gray-900">{tool.label}</span>
                                <span className="text-body-2 text-gray-400 truncate">{toolPreview}</span>
                              </div>
                              <span className="bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 text-caption-1 flex-shrink-0 mr-1">{tool.actions.length}</span>
                              {panelChevronRight}
                            </CopilotButton>
                          );
                        })}
                      </>
                    )}

                    {/* Built-in search results */}
                    {v2BuiltinSearchResults.length > 0 && (
                      <>
                        {(v2FilteredSteps.length > 0 || v2FilteredConnectors.length > 0) && (
                          <div className="px-4 pt-3 pb-1"><span className="text-caption-1-strong text-gray-400 uppercase tracking-wider">Built-in</span></div>
                        )}
                        {v2BuiltinSearchResults.map(({ tool, action }) => (
                          (() => {
                            const srCtData = CONTROL_ACTION_ICONS[action];
                            const srIconNode = srCtData
                              ? <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: srCtData.bg }}>{srCtData.icon}</div>
                              : <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: tool.iconBg }}>{tool.icon ?? <span className="text-white font-bold" style={{ fontSize: 9 }}>{tool.iconLabel}</span>}</div>;
                            return (
                              <div key={`${tool.id}-${action}`} className={v2RowCls(action)}>
                                <CopilotButton variant="ghost" size="sm" onClick={() => addStep('action', action)} className={v2RowBtnCls('py-2.5')}>
                                  {srIconNode}
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-body-2 text-gray-900">{action}</span>
                                    <span className="text-caption-1 text-gray-400">{tool.label}</span>
                                  </div>
                                </CopilotButton>
                                {v2EyeBtn(e => { e.stopPropagation(); setV2PreviewAction({ label: action, type: 'action', parentLabel: tool.label, iconNode: srIconNode }); })}
                              </div>
                            );
                          })()
                        ))}
                      </>
                    )}

                    {/* Connector items */}
                    {v2FilteredConnectors.length > 0 && (
                      <>
                        {(v2PaletteCategory === 'all' && !v2Q) && (
                          <div className="px-4 pt-4 pb-1.5 flex items-center gap-2">
                            <span className="text-body-2-strong text-gray-700">Connectors</span>
                            <span className="text-caption-1 text-gray-400">{CONNECTORS.length.toLocaleString()}</span>
                          </div>
                        )}
                        {v2Q && (v2FilteredSteps.length > 0 || v2BuiltinSearchResults.length > 0) && (
                          <div className="px-4 pt-3 pb-1"><span className="text-caption-1-strong text-gray-400 uppercase tracking-wider">Connectors</span></div>
                        )}
                        {v2FilteredConnectors.map(name => {
                          const initials = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
                          const bg = connectorColor(name);
                          const iconSrc = getConnectorIconSrc(name);
                          const connIconNode = iconSrc
                            ? <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white border border-gray-100"><img src={iconSrc} alt="" className="w-6 h-6" /></div>
                            : <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}><span className="text-white font-bold" style={{ fontSize: 10 }}>{initials}</span></div>;
                          return (
                            <div key={name} className={v2RowCls(name)}>
                              <CopilotButton variant="ghost" size="sm" onClick={() => addStep('action', name, name)} className={v2RowBtnCls('py-2.5')}>
                                {connIconNode}
                                <span className="text-body-2 text-gray-900 flex-1 truncate">{name}</span>
                              </CopilotButton>
                              {v2EyeBtn(e => { e.stopPropagation(); setV2PreviewAction({ label: name, type: 'action', connector: name, iconNode: connIconNode }); })}
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Preview panel — slides in from right */}
          <div
            className="border-l border-gray-100 flex-shrink-0 overflow-hidden transition-all duration-200 flex flex-col"
            style={{ width: v2PreviewAction ? 320 : 0 }}
          >
            {v2PreviewAction && (() => {
              const pc = getV2PreviewContent(v2PreviewAction.label);
              return (
                <div className="flex flex-col h-full" style={{ width: 320 }}>
                  {/* Preview header */}
                  <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        {v2PreviewAction.iconNode}
                        <div className="flex flex-col min-w-0 pt-0.5">
                          <span className="text-body-2-strong text-gray-900 leading-tight">{v2PreviewAction.label}</span>
                          {v2PreviewAction.parentLabel && (
                            <span className="text-caption-1 text-gray-400 mt-0.5">{v2PreviewAction.parentLabel}</span>
                          )}
                        </div>
                      </div>
                      <CopilotButton variant="ghost" size="sm" onClick={() => setV2PreviewAction(null)} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 mt-0.5">
                        <Dismiss20Regular style={{ width: 16, height: 16 }} />
                      </CopilotButton>
                    </div>
                  </div>
                  {/* Preview body */}
                  <div className="flex-1 overflow-auto px-4 py-3 flex flex-col gap-4">
                    <p className="text-caption-1 text-gray-600 leading-relaxed">{pc.description}</p>
                    {PREVIEW_VISUALS[v2PreviewAction.label]}
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
                  {/* Add step CTA */}
                  <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
                    <CopilotButton
                      variant="ghost"
                      size="sm"
                      onClick={() => addStep(v2PreviewAction.type, v2PreviewAction.label, v2PreviewAction.connector)}
                      className="w-full py-2 px-4 rounded-lg text-body-2-strong text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: 'hsl(var(--primary))' }}
                    >
                      Add step
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


  return {
    v1FloatingLeftPanel,
    v1PaletteModal,
    v2PaletteModal,
  };
}
