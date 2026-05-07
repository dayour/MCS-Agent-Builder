import React, { useState, useRef, useCallback } from 'react';
import type { PillInputHandle } from '../../../components/ui/PillInput';
import { WorkflowNode } from '../../../types';
import { Dialog, DialogHeader, DialogTitle } from '../../../components/ui/Dialog';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { CopilotTextarea } from '../../../components/ui/CopilotTextarea';
import { CopilotTabs } from '../../../components/ui/CopilotTabs';
import { CopilotTable } from '../../../components/ui/CopilotTable';
import { DAActivityCoT, DANode } from '../../../components/ui/DAActivityCoT';
import {
  ArrowMinimize20Regular,
  Search20Regular,
  Dismiss20Regular,
} from '@fluentui/react-icons';

// ── Types mirrored from WorkflowCanvas (not exported from there) ──────────────

export type InstrSegment =
  | { type: 'text'; value: string }
  | { type: 'pill'; nodeLabel: string; output: string; nodeConnector?: string }
  | { type: 'power-fx-pill'; expression: string; label: string };

export type InstructionEditorHandle = { insertPill: (inp: { nodeLabel: string; output: string; nodeConnector?: string }) => void };

export type NodeOutputType = 'number' | 'date' | 'datetime' | 'list' | 'text' | 'object' | 'boolean' | 'link' | 'code';
export type NodeOutput = { name: string; description: string; type: NodeOutputType; sample?: string };

// ── Internal sub-components (output view renderers) ───────────────────────────

type OutputViewType = 'schema' | 'table' | 'json';

const renderOutputValue = (val: unknown): React.ReactNode => {
  if (val === null) return <span className="text-gray-400 italic">null</span>;
  if (typeof val === 'boolean') return <span className={val ? 'text-green-600' : 'text-red-500'}>{String(val)}</span>;
  if (typeof val === 'number') return <span className="text-blue-600">{String(val)}</span>;
  if (typeof val === 'string') return <span className="text-gray-800">{val}</span>;
  if (Array.isArray(val)) return <span className="text-gray-500 italic">[{val.length} items]</span>;
  if (typeof val === 'object') return <span className="text-gray-500 italic">{'{ object }'}</span>;
  return <span>{String(val)}</span>;
};

const getTypeName = (val: unknown): string => {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  return typeof val;
};

const SchemaView: React.FC<{ response: string }> = ({ response }) => {
  let parsed: unknown = null;
  try { parsed = JSON.parse(response); } catch { /* not JSON */ }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const entries = Object.entries(parsed as Record<string, unknown>);
    return (
      <div className="rounded-lg border border-gray-100 overflow-hidden divide-y divide-gray-50">
        {entries.map(([key, val]) => (
          <div key={key} className="flex items-start gap-3 px-3 py-2 bg-white hover:bg-gray-50 transition-colors">
            <span className="text-caption-1 font-mono text-gray-400 flex-shrink-0 pt-px min-w-[80px]">{key}</span>
            <span className="text-caption-1 font-mono break-all">{renderOutputValue(val)}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-100 p-3 bg-white">
      <pre className="text-caption-1 font-mono text-gray-700 whitespace-pre-wrap break-all">{response}</pre>
    </div>
  );
};

const TableView: React.FC<{ response: string }> = ({ response }) => {
  let parsed: unknown = null;
  try { parsed = JSON.parse(response); } catch { /* not JSON */ }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const entries = Object.entries(parsed as Record<string, unknown>);
    return (
      <div className="rounded-lg border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-[1fr_2fr_64px] bg-gray-50 border-b border-gray-100">
          <span className="px-3 py-1.5 text-caption-1 font-mono text-gray-400">Key</span>
          <span className="px-3 py-1.5 text-caption-1 font-mono text-gray-400">Value</span>
          <span className="px-3 py-1.5 text-caption-1 font-mono text-gray-400">Type</span>
        </div>
        <div className="divide-y divide-gray-50">
          {entries.map(([key, val]) => (
            <div key={key} className="grid grid-cols-[1fr_2fr_64px] bg-white hover:bg-gray-50 transition-colors">
              <span className="px-3 py-2 text-caption-1 font-mono text-gray-500">{key}</span>
              <span className="px-3 py-2 text-caption-1 font-mono break-all">{renderOutputValue(val)}</span>
              <span className="px-3 py-2 text-caption-1 font-mono text-gray-400">{getTypeName(val)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-100 p-3 bg-white">
      <pre className="text-caption-1 font-mono text-gray-700 whitespace-pre-wrap break-all">{response}</pre>
    </div>
  );
};

const JsonView: React.FC<{ response: string }> = ({ response }) => {
  let formatted = response;
  try { formatted = JSON.stringify(JSON.parse(response), null, 2); } catch { /* use raw */ }

  const lines = formatted.split('\n');
  const renderLine = (line: string, idx: number) => {
    const keyValueMatch = line.match(/^(\s*)("[\w-]+")\s*:\s*(.+)$/);
    if (keyValueMatch) {
      const [, indent, key, rest] = keyValueMatch;
      const strMatch = rest.match(/^(".*?")(,?)$/);
      const primMatch = rest.match(/^(true|false|null|\d[\d.]*)(,?)$/);
      return (
        <div key={idx}>
          {indent}
          <span className="text-purple-600">{key}</span>
          {': '}
          {strMatch
            ? <><span className="text-green-700">{strMatch[1]}</span>{strMatch[2]}</>
            : primMatch
              ? <><span className="text-blue-600">{primMatch[1]}</span>{primMatch[2]}</>
              : rest}
        </div>
      );
    }
    return <div key={idx}>{line}</div>;
  };

  return (
    <div className="rounded-lg border border-gray-100 p-3 bg-white overflow-x-auto">
      <pre className="text-caption-1 font-mono text-gray-700 whitespace-pre leading-relaxed">
        {lines.map(renderLine)}
      </pre>
    </div>
  );
};

export interface McpTestResultsProps {
  testState: { loading: boolean; nodes: DANode[]; response: string | null; success?: boolean };
  agentName: string;
}

export const McpTestResults: React.FC<McpTestResultsProps> = ({ testState, agentName }) => {
  const isDone = !testState.loading && (testState.response !== null || testState.success === false);
  const isSuccess = testState.success === true;
  const [outputView, setOutputView] = React.useState<OutputViewType>('schema');
  const [reasoningExpanded, setReasoningExpanded] = React.useState(true);
  const [outputExpanded, setOutputExpanded] = React.useState(true);

  const outputViews: { id: OutputViewType; label: string }[] = [
    { id: 'schema', label: 'Schema' },
    { id: 'json', label: 'JSON' },
  ];

  const sectionToggle = (label: string, expanded: boolean, onToggle: () => void, right?: React.ReactNode) => (
    <CopilotButton variant="ghost" className="flex items-center justify-between w-full group mb-2" onClick={onToggle}>
      <div className="flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''}`}>
          <path d="M4 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-caption-1-strong text-gray-500 group-hover:text-gray-700 transition-colors">{label}</span>
      </div>
      {right}
    </CopilotButton>
  );

  return (
    <div className="flex flex-col gap-5 mt-2">
      {/* Reasoning */}
      <div>
        {sectionToggle('Reasoning', reasoningExpanded, () => setReasoningExpanded(v => !v))}
        {reasoningExpanded && (
          <div className="rounded-lg border border-gray-100 overflow-hidden">
            <DAActivityCoT nodes={testState.nodes} agentName={agentName} showTrigger={false} />
          </div>
        )}
      </div>

      {/* Output — with Schema / Table / JSON view switcher */}
      {isDone && isSuccess && testState.response && (
        <div className="animate-slide-up-fade">
          {sectionToggle('Output', outputExpanded, () => setOutputExpanded(v => !v),
            outputExpanded && (
              <div onClick={e => e.stopPropagation()}>
                <CopilotTabs
                  tabs={outputViews.map(v => ({ value: v.id, label: v.label }))}
                  value={outputView}
                  onChange={id => setOutputView(id as OutputViewType)}
                  size="sm"
                />
              </div>
            )
          )}
          {outputExpanded && (
            <>
              {outputView === 'schema' && <SchemaView response={testState.response} />}
              {outputView === 'table' && <TableView response={testState.response} />}
              {outputView === 'json' && <JsonView response={testState.response} />}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ── Step shape needed to look up icons for pill badges ────────────────────────

interface StepWithIcon {
  label: string;
  icon?: React.ReactNode;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface McpExpandedModalProps {
  isOpen: boolean;
  onClose: () => void;
  displayedNode: WorkflowNode;
  getNodeIcon: (node: WorkflowNode) => React.ReactNode;
  getPreviousNodes: (currentNode: WorkflowNode) => WorkflowNode[];
  getNodeOutputs: (n: WorkflowNode) => NodeOutput[];
  getConnectorIconSrc: (name: string) => string | null;
  renderNodeDetails: (node: WorkflowNode, onPillInputFocus?: (handle: PillInputHandle) => void) => React.ReactNode;
  allSteps: StepWithIcon[];
  // Shared state passed down from WorkflowCanvas
  mcpSegments: Record<string, InstrSegment[]>;
  mcpSampleInputs: Record<string, Record<string, string>>;
  setMcpSampleInputs: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
  mcpTestState: Record<string, { loading: boolean; nodes: DANode[]; response: string | null; success?: boolean }>;
  setMcpTestState: React.Dispatch<React.SetStateAction<Record<string, { loading: boolean; nodes: DANode[]; response: string | null; success?: boolean }>>>;
  mcpSampleCollapsed: boolean;
  setMcpSampleCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  mcpInputsExpanded: boolean;
  setMcpInputsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  mcpSimResults: { success: { nodes: DANode[]; response: string }; fail: { nodes: DANode[] } } | null;
  setMcpSimResults: React.Dispatch<React.SetStateAction<{ success: { nodes: DANode[]; response: string }; fail: { nodes: DANode[] } } | null>>;
  mcpSimTab: 'success' | 'fail';
  setMcpSimTab: React.Dispatch<React.SetStateAction<'success' | 'fail'>>;
  mcpInstructionEditorRef: React.RefObject<InstructionEditorHandle | null>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const McpExpandedModal: React.FC<McpExpandedModalProps> = ({
  isOpen,
  onClose,
  displayedNode,
  getNodeIcon,
  getPreviousNodes,
  getNodeOutputs,
  getConnectorIconSrc,
  renderNodeDetails,
  allSteps,
  mcpSegments,
  mcpSampleInputs,
  setMcpSampleInputs,
  mcpTestState,
  setMcpTestState,
  mcpSampleCollapsed,
  setMcpSampleCollapsed,
  mcpInputsExpanded,
  setMcpInputsExpanded,
  mcpSimResults,
  setMcpSimResults,
  mcpSimTab,
  setMcpSimTab,
  mcpInstructionEditorRef,
}) => {
  // State that is only used inside the expanded modal
  const [expandedInputGroups, setExpandedInputGroups] = useState<Record<string, boolean>>({});
  const [inputSearch, setInputSearch] = useState('');
  const [inputsTab, setInputsTab] = useState<'dynamic' | 'powerfx'>('dynamic');

  // Track the last focused PillInput so dynamic-value clicks route to the right field.
  // Defaults to the instructions editor; updates when any PillInput in the configure column gains focus.
  const activePillEditorRef = useRef<PillInputHandle | null>(null);

  const handlePillInputFocus = useCallback((handle: PillInputHandle) => {
    activePillEditorRef.current = handle;
  }, []);

  /** Route a dynamic-value insert to the active PillInput editor,
   *  falling back to the instructions editor if nothing else was focused. */
  const insertDynamicValue = useCallback((pill: { nodeLabel: string; output: string; nodeConnector?: string }) => {
    if (activePillEditorRef.current) {
      activePillEditorRef.current.insertPill(pill);
      return;
    }
    mcpInstructionEditorRef.current?.insertPill(pill);
  }, [mcpInstructionEditorRef]);

  return (
    <Dialog isOpen={isOpen} onClose={onClose} maxWidth="5xl" containerStyle={{ maxWidth: 1350, height: 760, background: 'linear-gradient(to bottom right, #fbfcfd, #f5f8ff)' }}>
      <DialogHeader>
        <div className="flex items-center gap-2.5 flex-1">
          <div className="flex-shrink-0">{getNodeIcon(displayedNode)}</div>
          <DialogTitle>{displayedNode.config?.stepTypeLabel ?? displayedNode.label}</DialogTitle>
        </div>
        <CopilotButton variant="ghost" size="sm" onClick={onClose} className="!p-1.5" title="Minimize"><ArrowMinimize20Regular className="w-4 h-4" /></CopilotButton>
      </DialogHeader>
      {/* flex-1 min-h-0 gives a definite height so h-full works on grid children */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="grid grid-cols-7 h-full gap-3 px-4 pt-3 pb-6">
          {/* Left column — Inputs */}
          <div className="overflow-hidden col-span-2 flex flex-col">

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden relative">
            <div className="flex-1 overflow-y-auto px-6 py-5">
            <label className="text-body-2-strong text-[hsl(var(--secondary-foreground))] block mb-2">Inputs</label>
            <div className="mb-3">
              <CopilotTabs
                tabs={[
                  { value: 'dynamic', label: 'Dynamic values' },
                  { value: 'powerfx', label: 'Power Fx' },
                ]}
                value={inputsTab}
                onChange={(v) => setInputsTab(v as 'dynamic' | 'powerfx')}
                size="sm"
                fullWidth
              />
            </div>
            {inputsTab === 'dynamic' && (
              <CopilotInput
                size="sm"
                placeholder="Search…"
                contentBefore={<Search20Regular />}
                contentAfter={inputSearch.length > 0 ? (
                  <CopilotButton variant="ghost" size="sm" className="!p-0.5" tabIndex={-1} onMouseDown={e => { e.preventDefault(); setInputSearch(''); }} aria-label="Clear search"><Dismiss20Regular /></CopilotButton>
                ) : undefined}
                value={inputSearch}
                onChange={e => setInputSearch(e.target.value)}
                className="mb-3"
              />
            )}
            {inputsTab === 'powerfx' && (
              <div className="flex flex-col items-center justify-center gap-2 pt-10 text-center">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M10 4l6 6-6 6" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <p className="text-sm text-gray-400">Power Fx coming soon</p>
                <p className="text-xs text-gray-300">Write expressions to transform and combine values</p>
              </div>
            )}
            {inputsTab === 'dynamic' && (() => {
              const prevNodes = getPreviousNodes(displayedNode);
              if (prevNodes.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center gap-2 pt-10 text-center">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </div>
                    <p className="text-sm text-gray-400">No upstream steps yet</p>
                    <p className="text-xs text-gray-300">Add steps before this node to see available inputs</p>
                  </div>
                );
              }

              // Type badge: small pill showing the data type with an icon
              const typeMeta: Record<string, { label: string; bg: string; fg: string; icon: React.ReactNode }> = {
                number:   { label: 'num',  bg: 'bg-violet-50',  fg: 'text-violet-600', icon: <svg width="14" height="14" viewBox="0 0 10 10" fill="none"><path d="M3.5 1.5l-1 7M7.5 1.5l-1 7M1.5 4h7M1.5 6.5h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> },
                date:     { label: 'date', bg: 'bg-blue-50',    fg: 'text-blue-500',   icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 1v4M11 1v4M2 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
                datetime: { label: 'dt',   bg: 'bg-indigo-50',  fg: 'text-indigo-500', icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M4 1v4M8 1v4M1 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="13" cy="11" r="3" stroke="currentColor" strokeWidth="1.4"/><path d="M13 9.5V11l1 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                list:     { label: 'list', bg: 'bg-amber-50',   fg: 'text-amber-600',  icon: <svg width="14" height="14" viewBox="0 0 10 10" fill="none"><path d="M3.5 2H2v6h1.5M6.5 2H8v6H6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                text:     { label: 'str',  bg: 'bg-gray-100',   fg: 'text-gray-500',   icon: <svg width="14" height="14" viewBox="0 0 10 10" fill="none"><path d="M2 2.5h6M5 2.5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
                object:   { label: 'obj',  bg: 'bg-teal-50',    fg: 'text-teal-600',   icon: <svg width="14" height="14" viewBox="0 0 10 10" fill="none"><path d="M4 2c-1 0-1.5.5-1.5 1.5V5l-1 .5 1 .5V7.5C2.5 8.5 3 9 4 9M6 2c1 0 1.5.5 1.5 1.5V5l1 .5-1 .5V7.5C7.5 8.5 7 9 6 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                boolean:  { label: 'bool', bg: 'bg-green-50',   fg: 'text-green-600',  icon: <svg width="14" height="14" viewBox="0 0 10 10" fill="none"><rect x="1" y="3.5" width="8" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="7" cy="5" r="1" fill="currentColor"/></svg> },
                link:     { label: 'url',  bg: 'bg-sky-50',     fg: 'text-sky-500',    icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6.5 9.5a3.536 3.536 0 0 0 5 0l2-2a3.536 3.536 0 0 0-5-5l-1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M9.5 6.5a3.536 3.536 0 0 0-5 0l-2 2a3.536 3.536 0 0 0 5 5l1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
                code:     { label: 'code', bg: 'bg-orange-50',  fg: 'text-orange-600', icon: <svg width="14" height="14" viewBox="0 0 10 10" fill="none"><path d="M3.5 3L1.5 5l2 2M6.5 3L8.5 5l-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
              };

              return (
                <div className="space-y-1.5">
                  {prevNodes.map(prevNode => {
                    const allOutputs = getNodeOutputs(prevNode);
                    const q = inputSearch.toLowerCase();
                    const outputs = q ? allOutputs.filter(o => o.name.toLowerCase().includes(q) || prevNode.label.toLowerCase().includes(q)) : allOutputs;
                    if (outputs.length === 0 && q) return null;
                    const iconSrc = prevNode.type !== 'trigger' && prevNode.connector ? getConnectorIconSrc(prevNode.connector) : null;
                    const isExpanded = expandedInputGroups[prevNode.id] !== false; // default open
                    const toggle = () => setExpandedInputGroups(prev => ({ ...prev, [prevNode.id]: !isExpanded }));
                    return (
                      <div key={prevNode.id} className="rounded-xl border border-gray-100 overflow-hidden">
                        {/* Group header */}
                        <div
                          onClick={toggle}
                          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggle()}
                          role="button"
                          tabIndex={0}
                          aria-expanded={isExpanded}
                          className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer text-left"
                        >
                          <svg
                            width="12" height="12" viewBox="0 0 12 12" fill="none"
                            className={`flex-shrink-0 text-gray-400 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                          >
                            <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          {iconSrc
                            ? <img src={iconSrc} className="w-4 h-4 flex-shrink-0" />
                            : <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center" style={{ transform: 'scale(0.7)', transformOrigin: 'center' }}>{getNodeIcon(prevNode)}</span>
                          }
                          <span className="flex-1 text-sm font-medium text-gray-800 truncate">{prevNode.label}</span>
                          <span className="flex-shrink-0 text-xs text-gray-500">{allOutputs.length} items</span>
                        </div>
                        {/* Output rows */}
                        {isExpanded && (
                          <div className="flex flex-col gap-1.5 px-3 py-2.5 items-start">
                            {outputs.map(output => {
                              const meta = typeMeta[output.type] ?? typeMeta.text;
                              return (
                                <div
                                  key={output.name}
                                  title={output.description}
                                  className="group flex items-center gap-2 w-full cursor-grab active:cursor-grabbing"
                                  draggable
                                  onDragStart={e => {
                                    e.dataTransfer.effectAllowed = 'copy';
                                    e.dataTransfer.setData('application/x-input-pill', JSON.stringify({
                                      nodeLabel: prevNode.label,
                                      output: output.name,
                                      nodeConnector: prevNode.connector,
                                    }));
                                  }}
                                >
                                  <span
                                    className="inline-flex items-center font-medium border border-gray-300 text-gray-600 pl-3 pr-3 group-hover:pr-1 hover:bg-gray-100 transition-all flex-shrink-0 cursor-pointer"
                                    style={{ borderRadius: 20, fontSize: 13, height: 24, boxSizing: 'border-box' }}
                                    onClick={() => insertDynamicValue({ nodeLabel: prevNode.label, output: output.name, nodeConnector: prevNode.connector })}
                                  >
                                    {output.name}
                                    <span className="w-0 overflow-hidden group-hover:w-[18px] transition-all duration-150 flex items-center justify-center flex-shrink-0">
                                      <CopilotButton
                                        variant="ghost"
                                        size="sm"
                                        className="!p-0 !w-4 !h-4 rounded-full text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)_/_0.1)] flex-shrink-0"
                                        title="Insert into instructions"
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={e => { e.stopPropagation(); insertDynamicValue({ nodeLabel: prevNode.label, output: output.name, nodeConnector: prevNode.connector }); }}
                                      >
                                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                          <path d="M4 1v6M1 4h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                        </svg>
                                      </CopilotButton>
                                    </span>
                                  </span>
                                  <span className="font-mono text-[10px] text-gray-400 truncate min-w-0 flex-1 text-right">{output.type === 'text' ? 'string' : output.type}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white/60 to-transparent pointer-events-none rounded-b-2xl" />
            </div>
          </div>
          {/* Middle column — Configure */}
          <div className="overflow-hidden col-span-3 flex flex-col">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden relative">
            <div className="flex-1 overflow-y-auto px-6 py-5">
            {renderNodeDetails(displayedNode, handlePillInputFocus)}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white/60 to-transparent pointer-events-none rounded-b-2xl" />
            </div>
          </div>
          {/* Right column — Test */}
          <div className="overflow-hidden col-span-2 flex flex-col">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden relative">
            <div className="flex-1 overflow-y-auto px-6 py-5">
            {mcpTestState[displayedNode.id] && (
              <label className="block text-body-2-strong text-[hsl(var(--secondary-foreground))] mb-4">Test results</label>
            )}
            {displayedNode.label === 'MCP' && (() => {
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
                const loadingNode: DANode = { id: 'mcp-outlook-success', type: 'agent', name: mcpName, status: 'loading', steps: successSteps };
                setMcpTestState(prev => ({ ...prev, [nodeId]: { loading: true, nodes: [loadingNode], response: null } }));
                setMcpSimResults(null);
                setMcpSimTab('success');
                setMcpSampleCollapsed(true);
                setMcpInputsExpanded(false);
                setTimeout(() => {
                  const successNodes: DANode[] = [{ id: 'mcp-outlook-success', type: 'agent', name: mcpName, status: 'completed', steps: successSteps }];
                  const failNodes: DANode[] = [{ id: 'mcp-outlook-fail', type: 'agent', name: mcpName, status: 'completed', steps: [
                    { title: 'Authenticating with Microsoft Outlook' },
                    { title: 'Resolving recipient', description: 'finance-all@contoso.com — distribution list' },
                    { title: 'Composing email', description: 'Subject: Q3 Budget Review — Action Required' },
                    { title: 'Sending via Microsoft Graph API' },
                    { title: 'Delivery failed — Error 550', description: 'Recipient mailbox quota exceeded (50 GB limit). The message could not be delivered to finance-all@contoso.com. Please contact the mailbox owner or try again later.' },
                  ] }];
                  const successResponse = JSON.stringify({ status: 'sent', messageId: 'MSG-20240311-7842', recipient: 'alex.turner@contoso.com', subject: 'Q3 Budget Review — Action Required', deliveredAt: '2024-03-11T14:23:07Z', latencyMs: 284 }, null, 2);
                  setMcpTestState(prev => ({ ...prev, [nodeId]: { loading: false, nodes: successNodes, response: successResponse, success: true } }));
                  setMcpSimResults({ success: { nodes: successNodes, response: successResponse }, fail: { nodes: failNodes } });
                }, 3500);
              };

              const testState = mcpTestState[displayedNode.id];
              const activeTestState = testState && (mcpSimResults
                ? (mcpSimTab === 'success'
                    ? { loading: false, nodes: mcpSimResults.success.nodes, response: mcpSimResults.success.response, success: true }
                    : { loading: false, nodes: mcpSimResults.fail.nodes, response: null, success: false })
                : testState);

              const pillsEl = (expanded: boolean) => pills.map(pill => {
                const iconSrc = pill.nodeConnector ? getConnectorIconSrc(pill.nodeConnector) : null;
                const stepIcon = !iconSrc && pill.nodeLabel ? allSteps.find(s => s.label === pill.nodeLabel)?.icon : null;
                const hasIcon = !!(iconSrc || stepIcon);
                const pillBadge = (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'hsl(var(--primary))', border: '1px solid hsl(var(--stroke-default))', height: 24, boxSizing: 'border-box', padding: '0 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, userSelect: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {iconSrc && <img src={iconSrc} style={{ width: 14, height: 14, borderRadius: 2, flexShrink: 0, display: 'block', marginTop: '-1px' }} alt="" />}
                    {!iconSrc && stepIcon && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', width: 14, height: 14, flexShrink: 0, marginTop: '-1px' }}>
                        <span style={{ transform: 'scale(0.58)', transformOrigin: 'center', display: 'flex', flexShrink: 0 }}>{stepIcon as React.ReactNode}</span>
                      </span>
                    )}
                    <span>{pill.label}</span>
                  </span>
                );
                if (!expanded) return <React.Fragment key={pill.key}>{pillBadge}</React.Fragment>;
                return (
                  <div key={pill.key} className="flex flex-col gap-1.5">
                    <div className="self-start">{pillBadge}</div>
                    <CopilotTextarea placeholder="Enter sample value…" value={sampleInputs[pill.key] ?? ''} onChange={e => setSampleInput(pill.key, (e.target as HTMLTextAreaElement).value)} style={{ resize: 'vertical', minHeight: 72 }} />
                  </div>
                );
              });

              if (pills.length === 0) {
                return (
                  <div className="flex flex-col gap-3">
                    {activeTestState && <McpTestResults testState={activeTestState} agentName={displayedNode.label ?? 'MCP'} />}
                    {!testState?.loading && (
                      <CopilotButton variant="action-brand" size="md" onClick={handleMcpTest} className="w-full justify-center">Run test</CopilotButton>
                    )}
                  </div>
                );
              }

              return (
                <div className="flex flex-col gap-3">
                  {!mcpSampleCollapsed ? (
                    <>
                      <div>
                        <p className="text-body-2-strong text-gray-900 mb-1">Sample inputs</p>
                        <p className="text-caption-1 text-gray-400">Provide values for each dynamic value in your instructions.</p>
                      </div>
                      <div className="flex flex-col gap-3">{pillsEl(true)}</div>
                      <CopilotButton variant="action-brand" size="md" className="w-full justify-center" onClick={handleMcpTest}>Run test</CopilotButton>
                    </>
                  ) : (
                    <div>
                      <CopilotButton variant="ghost" className="flex items-center gap-1.5 mb-2 group" onClick={() => setMcpInputsExpanded(v => !v)}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`text-gray-400 transition-transform flex-shrink-0 ${mcpInputsExpanded ? 'rotate-90' : ''}`}><path d="M4 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span className="text-caption-1-strong text-gray-500 group-hover:text-gray-700 transition-colors">Inputs</span>
                      </CopilotButton>
                      {mcpInputsExpanded && (
                        <div className="rounded-lg border border-gray-100 overflow-hidden">
                          <div className="divide-y divide-gray-50">
                            {pills.map(pill => {
                              const iconSrc = pill.nodeConnector ? getConnectorIconSrc(pill.nodeConnector) : null;
                              const stepIcon = !iconSrc && pill.nodeLabel ? allSteps.find(s => s.label === pill.nodeLabel)?.icon : null;
                              const hasIcon = !!(iconSrc || stepIcon);
                              return (
                                <div key={pill.key} className="grid grid-cols-2 items-center bg-white hover:bg-gray-50 transition-colors px-3 py-2">
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'hsl(var(--primary)/.08)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary)/.2)', padding: `1px 6px 1px ${hasIcon ? '4px' : '7px'}`, borderRadius: 9999, fontSize: 11, fontWeight: 500, lineHeight: 1.6, userSelect: 'none', width: 'fit-content' }}>
                                    {iconSrc && <img src={iconSrc} style={{ width: 13, height: 13, borderRadius: 2, flexShrink: 0, display: 'block' }} alt="" />}
                                    {!iconSrc && stepIcon && (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', width: 13, height: 13, flexShrink: 0, overflow: 'hidden' }}>
                                        <span style={{ transform: 'scale(0.54)', transformOrigin: 'center', display: 'flex', flexShrink: 0 }}>{stepIcon as React.ReactNode}</span>
                                      </span>
                                    )}
                                    <span>{pill.label}</span>
                                  </span>
                                  <span className="text-caption-1 font-mono text-gray-500 break-all">
                                    {sampleInputs[pill.key] ?? <span className="text-gray-300 italic">—</span>}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {activeTestState && <McpTestResults testState={activeTestState} agentName={displayedNode.label ?? 'MCP'} />}
                  {mcpSampleCollapsed && !testState?.loading && (
                    <CopilotButton variant="action-brand" size="md" className="w-full justify-center" onClick={() => {
                      setMcpSampleCollapsed(false);
                      setMcpSimResults(null);
                      setMcpTestState(prev => { const next = { ...prev }; delete next[displayedNode.id]; return next; });
                    }}>Test again</CopilotButton>
                  )}
                </div>
              );
            })()}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white/60 to-transparent pointer-events-none rounded-b-2xl" />
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
