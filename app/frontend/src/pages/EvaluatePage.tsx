import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAgent } from '../context/AgentContext';
import { MessageEval, EvalRating, WorkflowNode } from '../types';
import { computeConfigDiff } from '../utils/configDiff';
import { getAgentStorage, setAgentStorage } from '../utils/agentStorage';
import { CopilotButton } from '../components/ui/CopilotButton';
import { CopilotInput } from '../components/ui/CopilotInput';
import { CopilotDropdown } from '../components/ui/CopilotDropdown';
import { CopilotTextarea } from '../components/ui/CopilotTextarea';
import { CopilotBadge, CopilotTable, CopilotTabs, CopilotMenu, Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../components/ui';
import { ClaudeOpusIcon, ClaudeSonnetIcon, ClaudeHaikuIcon } from '../components/ui/ClaudeModelIcons';
import {
  Beaker20Regular,
  Play20Filled,
  Add20Regular,
  ArrowClockwise20Regular,
  Dismiss20Regular,
  ChevronDown20Regular,
  ChevronUp20Regular,
  Sparkle20Regular,
  ArrowDownload20Regular,
  Clock20Regular,
  CheckmarkCircle20Filled,
  DismissCircle20Filled,
  Flash24Filled,
  Agents24Filled,
  ArrowSplit24Filled,
  Send20Filled,
  DataTrending20Regular,
  BranchFork20Regular,
  ShieldTask20Regular,
  MoreHorizontal20Regular,
  Edit20Regular,
  Rocket20Regular,
} from '@fluentui/react-icons';
import {
  getConnectorIconSrc,
  connectorColor,
  ALL_STEPS,
  PromptIcon,
  CONTROL_FLOW_COLOR,
  CONNECTOR_COLOR,
  CONNECTOR_WIDTH,
  DOT_FILL,
  DOT_STROKE,
  DOT_FILL_END,
  DOT_STROKE_END,
  DOT_SIZE,
  DEFAULT_NODES,
  BG_STYLE,
} from '../components/workflow/workflowConstants';
// ─── Connector icon helper (re-exports workflowConstants version) ──────────────
const getConnectorIcon = getConnectorIconSrc;

// ─── Node icon helper — same logic as useWorkflowCanvas.getNodeIcon ────────────
const getEvalNodeIcon = (node: WorkflowNode): React.ReactNode => {
  if (node.type === 'trigger') return <Flash24Filled style={{ color: 'hsl(var(--status-success))', width: 18, height: 18 }} />;
  const stepMatch = ALL_STEPS.find(s => s.label === node.label);
  if (stepMatch) return stepMatch.icon;
  if (node.connector) {
    const iconSrc = getConnectorIconSrc(node.connector);
    if (iconSrc) return <img src={iconSrc} alt="" style={{ width: 18, height: 18, flexShrink: 0 }} />;
    const bg = connectorColor(node.connector);
    const initials = node.connector.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
    return <div style={{ width: 18, height: 18, borderRadius: 4, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'white', fontWeight: 700, fontSize: 8 }}>{initials}</span></div>;
  }
  switch (node.type) {
    case 'ai-action': return PromptIcon;
    case 'agent':     return <Agents24Filled style={{ color: 'hsl(var(--primary))', width: 18, height: 18 }} />;
    case 'condition': return <ArrowSplit24Filled style={{ color: CONTROL_FLOW_COLOR, width: 18, height: 18 }} />;
    default:          return <Flash24Filled style={{ color: 'hsl(var(--primary))', width: 18, height: 18 }} />;
  }
};


// ─── Agent Evaluate — eval-guide dashboard ──────────────────────────────────────

import { useEvalData } from './evaluate/useEvalData';
import { EvalDashboard } from './evaluate/EvalDashboard';
import { EvalEmptyState } from './evaluate/EvalEmptyState';
import { CreateEvalDialog } from './evaluate/CreateEvalDialog';
import { useAgent as useAgentForCreate } from '../context/AgentContext';

const AgentEvaluatePageNew: React.FC<{ isNarrowPreview: boolean }> = ({ isNarrowPreview }) => {
  const { hasEvalSets, evalSets } = useEvalData();
  const { updateAgentConfig, agentConfig } = useAgentForCreate();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  if (!hasEvalSets && !showCreateDialog) {
    return (
      <>
        <EvalEmptyState isNarrowPreview={isNarrowPreview} onCreateClick={() => setShowCreateDialog(true)} />
        <CreateEvalDialog
          isOpen={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onCreate={(evalSet) => {
            const existing = (agentConfig as any).evalSets ?? [];
            updateAgentConfig({ evalSets: [...existing, evalSet] } as any);
          }}
          existingBuckets={evalSets.map(s => s.name)}
        />
      </>
    );
  }

  return <EvalDashboard isNarrowPreview={isNarrowPreview} />;
};

// Legacy constants kept for backward compatibility with V1 eval results tabs
const EVAL_RATING_LABELS: Record<EvalRating, string> = { poor: 'Poor', ok: 'OK', good: 'Good' };
const EVAL_RATING_COLORS: Record<EvalRating, React.ComponentProps<typeof CopilotBadge>['color']> = {
  poor: 'danger',
  ok: 'warning',
  good: 'success',
};

const AgentEvaluatePageLegacy: React.FC<{ isNarrowPreview: boolean }> = ({ isNarrowPreview }) => {
  const { agentConfig, isEvalsV2 } = useAgent();
  const [view, setView] = useState<'create' | 'results'>('create');
  const [evalTab, setEvalTab] = useState<'run' | 'eval-results' | 'helper-evals'>('run');
  const [evalResults, setEvalResults] = useState<MessageEval[]>([]);
  const [evalResultsLoading, setEvalResultsLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Backward-compat split: records with explicit source take precedence;
  // old records (no source) fall back to agentName heuristic.
  const isHelperEval = useCallback(
    (r: MessageEval) =>
      r.source === 'helper-agent' || (!r.source && r.agentName === 'Copilot Studio'),
    []
  );

  const { previewEvals, helperEvals, previewDiffs, helperDiffs } = useMemo(() => {
    const previewEvalsLocal = evalResults.filter(r => !isHelperEval(r));
    const helperEvalsLocal = evalResults.filter(r => isHelperEval(r));

    const previewDiffsLocal = Object.fromEntries(
      previewEvalsLocal
        .filter(r => r.configBefore && r.configAfter)
        .map(r => [r.messageId, computeConfigDiff(r.configBefore!, r.configAfter!)])
    );

    const helperDiffsLocal = Object.fromEntries(
      helperEvalsLocal
        .filter(r => r.configBefore && r.configAfter)
        .map(r => [r.messageId, computeConfigDiff(r.configBefore!, r.configAfter!)])
    );

    return {
      previewEvals: previewEvalsLocal,
      helperEvals: helperEvalsLocal,
      previewDiffs: previewDiffsLocal,
      helperDiffs: helperDiffsLocal,
    };
  }, [evalResults, isHelperEval]);

  useEffect(() => {
    if (!isEvalsV2 && evalTab !== 'run') setEvalTab('run');
  }, [isEvalsV2, evalTab]);

  useEffect(() => {
    setExpandedRow(null);
  }, [evalTab]);

  useEffect(() => {
    if (evalTab !== 'eval-results' && evalTab !== 'helper-evals') return;
    setEvalResultsLoading(true);
    fetch('/api/evals')
      .then(r => { if (!r.ok) throw new Error(`Server error: ${r.status}`); return r.json(); })
      .then((data: MessageEval[]) => {
        setEvalResults(Array.isArray(data) ? data : []);
        setEvalResultsLoading(false);
      })
      .catch(() => setEvalResultsLoading(false));
  }, [evalTab]);

  const results = [
    { question: "What's the current status of our integration work between Woodgrove Bank's systems and th...", response: "The integration between Woodgrove Bank's core banking systems and th...", status: 'pass' as const, quality: 'General quality' },
    { question: "Can you highlight any risks in the Phoenix Roofing project that might d...", response: "There are two notable risks: Dependency delays: A few upstream 3am te...", status: 'fail' as const, quality: 'General quality' },
    { question: "How do the latest requirements from Nomoregoo Insurance impact our d...", response: "The added requirements introduce smart-call meaningful adjustments th...", status: 'pass' as const, quality: 'General quality' },
    { question: "What tasks are currently blocked, and who do I need to work with to un...", response: "Two tasks remain blocked: Data mapping approvals: DA cannot complete o...", status: 'pass' as const, quality: 'General quality' },
    { question: "Can you give me a summary of upcoming milestones for the Phoenix Roof...", response: "The next key milestones include: * Release final scope: Scheduled for early o...", status: 'pass' as const, quality: 'General quality' },
    { question: "Are there any dependencies on the Woodgrove Bank infrastructure team th...", response: "Yes, two key dependencies: * Integration testing: Completing the final round of...", status: 'pass' as const, quality: 'General quality' },
    { question: "What were the key decisions made in Billie Yeager's last steering meetin...", response: "Billie Iyari confirmed the latest adjustments and reaffirmed the...", status: 'fail' as const, quality: 'General quality' },
    { question: "Can you show me all tasks assigned to me that are due this week?", response: "This week you have: * Completing the final round of API tests...", status: 'pass' as const, quality: 'General quality' },
    { question: "Has Tomo Petrovac updated the project schedule based on the latest scop...", response: "Yes — Tomo has published an updated schedule that reflects the refined bl...", status: 'pass' as const, quality: 'General quality' },
    { question: "Which workstreams are most at risk of falling behind, and how can I help...", response: "Two workstreams require particular attention: * Integration testing: Compl...", status: 'pass' as const, quality: 'General quality' },
    { question: "What's the current status of our integration work between Woodgrove Bank...", response: "Experience the family Adventure package, which includes a delightful di...", status: 'fail' as const, quality: 'General quality' },
    { question: "What's the current status of our integration work between Woodgrove Bank...", response: "With the Family Adventure package, you got a lively statement, tasty tea...", status: 'pass' as const, quality: 'General quality' }
  ];
  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  const score = Math.round((passCount / results.length) * 100);

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${isNarrowPreview ? 'bg-[hsl(var(--surface-secondary))] px-8 pt-6 pb-6' : 'bg-white'}`}>
      {/* ── Top-level tab bar ── */}
      <div className={`${isNarrowPreview ? 'mb-4' : 'px-16 pt-4 pb-3'}`}>
        <CopilotTabs
          size="sm"
          value={evalTab}
          onChange={(v) => setEvalTab(v as typeof evalTab)}
          tabs={[
            { label: 'Run Evals', value: 'run' },
            ...(isEvalsV2 ? [
              { label: 'Eval Results', value: 'eval-results' },
              { label: 'Helper Agent Evals', value: 'helper-evals' },
            ] : []),
          ]}
        />
      </div>

      {evalTab === 'eval-results' ? (
        // ── Eval Results (MessageEval) View ─────────────────────────────────
        <div className={`flex-1 flex flex-col overflow-hidden ${isNarrowPreview ? '' : 'px-16 py-6'}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Eval Results</h2>
              <p className="text-sm text-text-subtle mt-0.5">Ratings collected from Preview chat sessions</p>
            </div>
            <CopilotButton
              variant="secondary"
              size="sm"
              icon={<ArrowDownload20Regular />}
              onClick={() => { window.open('/api/evals/export', '_blank'); }}
            >
              Export CSV
            </CopilotButton>
          </div>

          {evalResultsLoading ? (
            <div className="flex items-center justify-center flex-1">
              <Clock20Regular className="w-5 h-5 text-text-subtle animate-spin mr-2" />
              <span className="text-sm text-text-subtle">Loading…</span>
            </div>
          ) : previewEvals.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-2">
              <Beaker20Regular className="w-8 h-8 text-gray-300" />
              <p className="text-sm text-text-subtle">No eval results yet. Enable Eval Mode in Feature Toggles, then rate responses in Preview.</p>
            </div>
          ) : (
            <div className="overflow-auto flex-1 flex flex-col gap-3">
              <CopilotTable
                size="sm"
                columns={[
                  { key: 'agentName', label: 'Agent', width: '100px', render: (v: string) => <span className="text-text-subtle">{v || '—'}</span> },
                  { key: 'userPrompt', label: 'User Asked', width: '160px', render: (v: string) => <span className="line-clamp-2 whitespace-normal text-text-primary">{v || '—'}</span> },
                  { key: 'messageContent', label: 'Response', width: '200px', render: (v: string) => <span className="line-clamp-2 whitespace-normal text-text-subtle">{v}</span> },
                  { key: 'accuracy', label: 'Accuracy', width: '100px', render: (v: boolean | null) => v == null ? <>—</> : <CopilotBadge appearance="tint" color={v ? 'success' : 'danger'}>{v ? 'Accurate' : 'Inaccurate'}</CopilotBadge> },
                  { key: 'relevance', label: 'Relevance', width: '80px', render: (v: EvalRating | null) => v == null ? <>—</> : <CopilotBadge appearance="tint" color={EVAL_RATING_COLORS[v]}>{EVAL_RATING_LABELS[v]}</CopilotBadge> },
                  { key: 'completeness', label: 'Completeness', width: '100px', render: (v: EvalRating | null) => v == null ? <>—</> : <CopilotBadge appearance="tint" color={EVAL_RATING_COLORS[v]}>{EVAL_RATING_LABELS[v]}</CopilotBadge> },
                  { key: 'clarity', label: 'Clarity', width: '80px', render: (v: EvalRating | null) => v == null ? <>—</> : <CopilotBadge appearance="tint" color={EVAL_RATING_COLORS[v]}>{EVAL_RATING_LABELS[v]}</CopilotBadge> },
                  { key: 'actionCorrectness', label: 'Actions', width: '80px', render: (v: EvalRating | null) => v == null ? <>—</> : <CopilotBadge appearance="tint" color={EVAL_RATING_COLORS[v]}>{EVAL_RATING_LABELS[v]}</CopilotBadge> },
                  { key: 'comment', label: 'Comment', width: '160px', render: (v: string) => <span className="text-text-subtle">{v || '—'}</span> },
                  { key: 'evaluatedAt', label: 'Date', width: '90px', render: (v: string) => <span className="text-text-subtle text-xs">{v ? new Date(v).toLocaleDateString() : '—'}</span> },
                  { key: 'messageId', label: 'Config', width: '110px', render: (_v: string, row: MessageEval) => {
                    const hasBoth = !!(row.configBefore && row.configAfter);
                    if (!hasBoth) return <span className="text-text-subtle text-xs">—</span>;
                    const isExp = expandedRow === row.messageId;
                    const diff = previewDiffs[row.messageId] ?? [];
                    return (
                      <CopilotButton variant="ghost" size="sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); setExpandedRow(isExp ? null : row.messageId); }} className="text-xs px-2 py-0.5 h-auto">
                        {isExp ? '▲' : '▼'}&nbsp;{diff.length === 0 ? 'No changes' : `${diff.length} change${diff.length > 1 ? 's' : ''}`}
                      </CopilotButton>
                    );
                  }},
                ]}
                data={previewEvals}
              />
              {expandedRow && (() => {
                const row = previewEvals.find(r => r.messageId === expandedRow);
                if (!row || !row.configBefore || !row.configAfter) return null;
                const diff = previewDiffs[expandedRow] ?? [];
                return (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-6 py-4">
                    <div className="text-xs font-medium text-text-subtle mb-2 uppercase tracking-wide">Config snapshot — before vs after this turn</div>
                    {diff.length === 0 ? (
                      <p className="text-sm text-text-subtle">No configuration changes detected during this turn.</p>
                    ) : (
                      <CopilotTable
                        size="sm"
                        columns={[
                          { key: 'label', label: 'Field', width: '150px' },
                          { key: 'before', label: 'Before', render: (v: string) => <span className="line-clamp-3 bg-red-50 rounded px-1 text-danger">{v || '(empty)'}</span> },
                          { key: 'after', label: 'After', render: (v: string) => <span className="line-clamp-3 bg-green-50 rounded px-1 text-success">{v || '(empty)'}</span> },
                        ]}
                        data={diff}
                      />
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-text-subtle">
                      <div>
                        <span className="font-medium text-text-primary">Before (snapshot at send)</span>
                        <pre className="mt-1 p-2 bg-gray-100 rounded text-[11px] overflow-auto max-h-32 whitespace-pre-wrap">{JSON.stringify(row.configBefore, null, 2)}</pre>
                      </div>
                      <div>
                        <span className="font-medium text-text-primary">After (snapshot at rate)</span>
                        <pre className="mt-1 p-2 bg-gray-100 rounded text-[11px] overflow-auto max-h-32 whitespace-pre-wrap">{JSON.stringify(row.configAfter, null, 2)}</pre>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      ) : evalTab === 'helper-evals' ? (
        // ── Helper Agent Evals (Copilot Studio) View ────────────────────────
        <div className={`flex-1 flex flex-col overflow-hidden ${isNarrowPreview ? '' : 'px-16 py-6'}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Helper Agent Evals</h2>
              <p className="text-sm text-text-subtle mt-0.5">Ratings from Copilot Studio build sessions — includes config diff for each turn</p>
            </div>
            <CopilotButton
              variant="secondary"
              size="sm"
              icon={<ArrowDownload20Regular />}
              onClick={() => { window.open('/api/evals/export', '_blank'); }}
            >
              Export CSV
            </CopilotButton>
          </div>

          {evalResultsLoading ? (
            <div className="flex items-center justify-center flex-1">
              <Clock20Regular className="w-5 h-5 text-text-subtle animate-spin mr-2" />
              <span className="text-sm text-text-subtle">Loading…</span>
            </div>
          ) : helperEvals.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-2">
              <Beaker20Regular className="w-8 h-8 text-gray-300" />
              <p className="text-sm text-text-subtle">No Helper Agent evals yet. Enable Eval Mode, then rate Copilot Studio responses in the Build sidebar.</p>
            </div>
          ) : (
            <div className="overflow-auto flex-1 flex flex-col gap-3">
              <CopilotTable
                size="sm"
                columns={[
                  { key: 'userPrompt', label: 'User Asked', width: '160px', render: (v: string) => <span className="line-clamp-2 whitespace-normal text-text-primary">{v || '—'}</span> },
                  { key: 'messageContent', label: 'Response', width: '200px', render: (v: string) => <span className="line-clamp-2 whitespace-normal text-text-subtle">{v}</span> },
                  { key: 'accuracy', label: 'Accuracy', width: '100px', render: (v: boolean | null) => v == null ? <>—</> : <CopilotBadge appearance="tint" color={v ? 'success' : 'danger'}>{v ? 'Accurate' : 'Inaccurate'}</CopilotBadge> },
                  { key: 'relevance', label: 'Relevance', width: '80px', render: (v: EvalRating | null) => v == null ? <>—</> : <CopilotBadge appearance="tint" color={EVAL_RATING_COLORS[v]}>{EVAL_RATING_LABELS[v]}</CopilotBadge> },
                  { key: 'completeness', label: 'Completeness', width: '100px', render: (v: EvalRating | null) => v == null ? <>—</> : <CopilotBadge appearance="tint" color={EVAL_RATING_COLORS[v]}>{EVAL_RATING_LABELS[v]}</CopilotBadge> },
                  { key: 'clarity', label: 'Clarity', width: '80px', render: (v: EvalRating | null) => v == null ? <>—</> : <CopilotBadge appearance="tint" color={EVAL_RATING_COLORS[v]}>{EVAL_RATING_LABELS[v]}</CopilotBadge> },
                  { key: 'actionCorrectness', label: 'Actions', width: '80px', render: (v: EvalRating | null) => v == null ? <>—</> : <CopilotBadge appearance="tint" color={EVAL_RATING_COLORS[v]}>{EVAL_RATING_LABELS[v]}</CopilotBadge> },
                  { key: 'comment', label: 'Comment', width: '160px', render: (v: string) => <span className="text-text-subtle">{v || '—'}</span> },
                  { key: 'evaluatedAt', label: 'Date', width: '90px', render: (v: string) => <span className="text-text-subtle text-xs">{v ? new Date(v).toLocaleDateString() : '—'}</span> },
                  { key: 'messageId', label: 'Config', width: '110px', render: (_v: string, row: MessageEval) => {
                    const hasBoth = !!(row.configBefore && row.configAfter);
                    if (!hasBoth) return <span className="text-text-subtle text-xs">—</span>;
                    const isExp = expandedRow === row.messageId;
                    const diff = helperDiffs[row.messageId] ?? [];
                    return (
                      <CopilotButton variant="ghost" size="sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); setExpandedRow(isExp ? null : row.messageId); }} className="text-xs px-2 py-0.5 h-auto">
                        {isExp ? '▲' : '▼'}&nbsp;{diff.length === 0 ? 'No changes' : `${diff.length} change${diff.length > 1 ? 's' : ''}`}
                      </CopilotButton>
                    );
                  }},
                ]}
                data={helperEvals}
              />
              {expandedRow && (() => {
                const row = helperEvals.find(r => r.messageId === expandedRow);
                if (!row || !row.configBefore || !row.configAfter) return null;
                const diff = helperDiffs[expandedRow] ?? [];
                return (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-6 py-4">
                    <div className="text-xs font-medium text-text-subtle mb-2 uppercase tracking-wide">Config snapshot — before vs after this turn</div>
                    {diff.length === 0 ? (
                      <p className="text-sm text-text-subtle">No configuration changes detected during this turn.</p>
                    ) : (
                      <CopilotTable
                        size="sm"
                        columns={[
                          { key: 'label', label: 'Field', width: '150px' },
                          { key: 'before', label: 'Before', render: (v: string) => <span className="line-clamp-3 bg-red-50 rounded px-1 text-danger">{v || '(empty)'}</span> },
                          { key: 'after', label: 'After', render: (v: string) => <span className="line-clamp-3 bg-green-50 rounded px-1 text-success">{v || '(empty)'}</span> },
                        ]}
                        data={diff}
                      />
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-text-subtle">
                      <div>
                        <span className="font-medium text-text-primary">Before (snapshot at send)</span>
                        <pre className="mt-1 p-2 bg-gray-100 rounded text-[11px] overflow-auto max-h-32 whitespace-pre-wrap">{JSON.stringify(row.configBefore, null, 2)}</pre>
                      </div>
                      <div>
                        <span className="font-medium text-text-primary">After (snapshot at rate)</span>
                        <pre className="mt-1 p-2 bg-gray-100 rounded text-[11px] overflow-auto max-h-32 whitespace-pre-wrap">{JSON.stringify(row.configAfter, null, 2)}</pre>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      ) : view === 'create' ? (
        // Create Evaluation View
        <div className="flex-1 flex">
          {/* Main Panel */}
          <div className={`flex-1 ${isNarrowPreview ? 'py-0' : 'px-16 py-8 max-w-2xl mx-auto'}`}>
            <CopilotButton variant="ghost" className="flex items-center gap-2 mb-6">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" />
              </svg>
              <span className="text-sm">Create evaluation</span>
            </CopilotButton>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Data type</h3>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="radio" name="dataType" defaultChecked className="mt-1" />
                    <div>
                      <div className="font-medium text-sm text-gray-900">Single response</div>
                      <div className="text-xs text-gray-600 mt-1">
                        Check how your agent responds to a specific question. Best for targeted capability testing.
                      </div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="radio" name="dataType" className="mt-1" />
                    <div>
                      <div className="font-medium text-sm text-gray-900">Conversation</div>
                      <div className="text-xs text-gray-600 mt-1">
                        Check the quality of longer agent interactions with users. Best for general assessment.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Data source</h3>
                <p className="text-xs text-gray-600 mb-3">
                  Start by uploading some questions
                </p>
                <p className="text-xs text-gray-600 mb-4">
                  Use our template (CSV) to make sure that file contents and formatting are correct. <CopilotButton variant="ghost" size="sm" className="p-0 h-auto inline">Learn more</CopilotButton>

                </p>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-brand-purple transition-colors">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 4V20M4 12H20" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-900">Drag a file or browse (CSV)</p>
                    <p className="text-xs text-gray-600">You can still review and change things before starting the evaluation.</p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <h4 className="text-sm font-medium text-gray-700">More ways to start</h4>

                  <CopilotButton variant="secondary" className="w-full flex items-center gap-3 p-4 text-left bg-purple-50 border-purple-200 hover:bg-purple-100">
                    <div className="w-10 h-10 bg-purple-200 rounded-lg flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M4 8L10 14L16 8" stroke="#7C3AED" strokeWidth="2" />
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-gray-900">Quick question set</div>
                      <div className="text-xs text-gray-600">
                        Add your suggested prompts and generate 50 additional questions based on your agent's description.
                      </div>
                    </div>
                  </CopilotButton>

                  <CopilotButton variant="secondary" className="w-full flex items-center gap-3 p-4 text-left">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M10 4L14 8L10 12" stroke="#3B82F6" strokeWidth="2" />
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-gray-900">Full question set</div>
                      <div className="text-xs text-gray-600">
                        Gather the questions and responses from your current preview chat with the agent.
                      </div>
                    </div>
                  </CopilotButton>

                  <CopilotButton variant="secondary" className="w-full flex items-center gap-3 p-4 text-left">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M6 8H14M6 12H14" stroke="#6B7280" strokeWidth="2" />
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-gray-900">Use questions from test chat</div>
                      <div className="text-xs text-gray-600">
                        Gather the questions and responses from your current preview chat with the agent.
                      </div>
                    </div>
                  </CopilotButton>
                </div>

                <CopilotButton variant="ghost" className="p-0 h-auto mt-6">
                  Or, write some questions yourself
                </CopilotButton>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className={`border-b border-gray-200 ${isNarrowPreview ? 'pb-4 mb-4' : 'px-16 py-8'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <CopilotButton
                  variant="icon"
                  onClick={() => setView('create')}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M12 16L6 10L12 4" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </CopilotButton>
                <div>
                  <h1 className={`font-semibold text-gray-900 ${isNarrowPreview ? 'text-base' : 'text-xl'}`}>
                    {agentConfig.name || 'Project Manager Agent'} eval 110126_1345
                  </h1>
                  <div className={`flex items-center gap-4 mt-1 text-gray-600 ${isNarrowPreview ? 'text-xs flex-wrap' : 'text-sm'}`}>
                    <span>00:2:32</span>
                    <span>•</span>
                    <span>16 Cases</span>
                    <span>•</span>
                    <span>Evaluation</span>
                    <span>•</span>
                    <span>Data type: Single response</span>
                  </div>
                </div>
              </div>
              <CopilotButton variant="icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <circle cx="5" cy="10" r="2" />
                  <circle cx="10" cy="10" r="2" />
                  <circle cx="15" cy="10" r="2" />
                </svg>
              </CopilotButton>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <div className={`overflow-y-auto ${isNarrowPreview ? 'w-full' : 'w-2/3 border-r border-gray-200'}`}>
              {/* Tabs */}
              <div className={`flex gap-6 border-b border-gray-200 bg-white sticky top-0 ${isNarrowPreview ? 'px-0 py-2 text-xs' : 'px-16 py-4'}`}>
                <CopilotButton variant="ghost" className="font-medium text-brand-purple border-b-2 border-brand-purple pb-2">
                  All ({results.length})
                </CopilotButton>
                <CopilotButton variant="ghost" className="text-gray-600 hover:text-gray-900 pb-2">
                  Pass ({passCount})
                </CopilotButton>
                <CopilotButton variant="ghost" className="text-gray-600 hover:text-gray-900 pb-2">
                  Fail ({failCount})
                </CopilotButton>
              </div>

              {/* Results */}
              <div className={isNarrowPreview ? 'space-y-3 pt-3' : 'p-4 space-y-4'}>
                {results.map((result, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 mb-1">Question</p>
                        <p className="text-sm text-gray-600">{result.question}</p>
                      </div>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                        result.status === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {result.status === 'pass' ? 'Pass' : 'Fail'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-1">Agent response</p>
                      <p className="text-sm text-gray-600">{result.response}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-gray-500">{result.quality}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary Sidebar - Hide in narrow view */}
            {!isNarrowPreview && (
            <div className="w-1/3 bg-gray-50 px-4 py-8">
              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-700 mb-4">Evaluation summary</h3>

                <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Score</h4>
                  <div className="text-4xl font-bold text-gray-900 mb-3">{score}%</div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${(passCount / results.length) * 100}%` }}
                    />
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${(failCount / results.length) * 100}%`, marginTop: '-8px' }}
                    />
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-green-500 rounded-full" />
                      <span className="text-gray-600">Pass</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-red-500 rounded-full" />
                      <span className="text-gray-600">Fail</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration</span>
                    <span className="font-medium text-gray-900">00:2:32</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cases</span>
                    <span className="font-medium text-gray-900">16</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Evaluation</span>
                    <span className="font-medium text-gray-900">{agentConfig.name} eval</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Data type</span>
                    <span className="font-medium text-gray-900">Single response</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">User profile</span>
                    <span className="font-medium text-gray-900">daisy.phillips@contoso.com</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Run by</span>
                    <span className="font-medium text-gray-900">Mona Kane • 2 days ago</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Agent version</span>
                    <span className="font-medium text-gray-900">Draft • 9:50 AM today (UTC)</span>
                  </div>
                </div>
              </div>

              <CopilotButton
                onClick={() => setView('create')}
                variant="primary"
                className="w-full"
              >
                Run New Evaluation
              </CopilotButton>
            </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Workflow Evaluate ──────────────────────────────────────────────────────────


// ─── Grader-based Evaluate types ──────────────────────────────────────────────

interface Grader {
  id: string;
  name: string;
  prompt: string;
  isBuiltIn?: boolean;
  category?: 'accuracy' | 'routing' | 'performance' | 'custom';
}

interface RunAction {
  id: string;
  label: string;
  type: string;
  connector?: string;
  startMs: number;   // ms from run start
  durationMs: number;
  inputs: Record<string, string>;
  outputs: Record<string, string>;
  instructions?: string;
  status: 'pass' | 'fail' | 'skipped';
}

interface WorkflowRun {
  id: string;
  label: string;
  date: string;
  totalDurationMs: number;
  status: 'pass' | 'fail';
  actions: RunAction[];
}

interface GraderResult {
  verdict: 'pass' | 'fail';
  score: number;
  summary: string;
  failedActionId: string | null;
  /** Step IDs this grader assessed — used to highlight relevant steps in the trace */
  assessedActionIds: string[];
}

interface EvalResult {
  verdict: 'pass' | 'fail';
  score: number;          // 0–100
  summary: string;
  failedActionId: string | null;
  actionFeedback: Record<string, { verdict: 'pass' | 'fail'; note: string }>;
  graderResults: Record<string, GraderResult>; // keyed by graderId
}

// ─── Mock run metadata (actions are generated from live workflowNodes) ──────────

interface MockRunMeta {
  id: string;
  label: string;
  date: string;
  totalDurationMs: number;
  status: 'pass' | 'fail';
  /** Index of the node (in a flat all-nodes list) that should be marked as failed. null = all pass. */
  failNodeIndex: number | null;
  /** Index of the branch node to treat as "skipped" (the branch not taken). null = none skipped. */
  skipNodeIndex: number | null;
}

const MOCK_RUN_META: MockRunMeta[] = [
  { id: 'run-1',  label: 'INV-2024-0391 · Contoso Ltd.',        date: '2 hours ago',  totalDurationMs: 2340, status: 'pass', failNodeIndex: null, skipNodeIndex: null },
  { id: 'run-2',  label: 'INV-2024-0405 · Fabrikam Inc.',        date: '5 hours ago',  totalDurationMs: 1920, status: 'pass', failNodeIndex: null, skipNodeIndex: null },
  { id: 'run-3',  label: 'scan_blurry.pdf · Unknown vendor',     date: 'Yesterday',    totalDurationMs: 3140, status: 'fail', failNodeIndex: 1,    skipNodeIndex: null },
  { id: 'run-4',  label: 'INV-2024-0412 · Northwind Traders',    date: 'Yesterday',    totalDurationMs: 2100, status: 'pass', failNodeIndex: null, skipNodeIndex: null },
  { id: 'run-5',  label: 'INV-2024-0388 · Adventure Works',      date: '2 days ago',   totalDurationMs: 2780, status: 'pass', failNodeIndex: null, skipNodeIndex: null },
  { id: 'run-6',  label: 'receipt_0055.jpg · Trey Research',     date: '2 days ago',   totalDurationMs: 4200, status: 'fail', failNodeIndex: 1,    skipNodeIndex: null },
  { id: 'run-7',  label: 'INV-2024-0377 · Contoso Ltd.',         date: '3 days ago',   totalDurationMs: 1870, status: 'pass', failNodeIndex: null, skipNodeIndex: null },
  { id: 'run-8',  label: 'INV-2024-0369 · Fabrikam Inc.',        date: '3 days ago',   totalDurationMs: 2250, status: 'pass', failNodeIndex: null, skipNodeIndex: null },
  { id: 'run-9',  label: 'INV-2024-0361 · Woodgrove Bank',       date: '4 days ago',   totalDurationMs: 1990, status: 'pass', failNodeIndex: null, skipNodeIndex: null },
  { id: 'run-10', label: 'corrupted_scan.pdf · Unknown',         date: '4 days ago',   totalDurationMs: 5100, status: 'fail', failNodeIndex: 1,    skipNodeIndex: null },
  { id: 'run-11', label: 'INV-2024-0354 · Northwind Traders',    date: '5 days ago',   totalDurationMs: 2030, status: 'pass', failNodeIndex: null, skipNodeIndex: null },
  { id: 'run-12', label: 'INV-2024-0348 · Adventure Works',      date: '5 days ago',   totalDurationMs: 2410, status: 'pass', failNodeIndex: null, skipNodeIndex: null },
  { id: 'run-13', label: 'INV-2024-0340 · Contoso Ltd.',         date: '6 days ago',   totalDurationMs: 1760, status: 'pass', failNodeIndex: null, skipNodeIndex: null },
  { id: 'run-14', label: 'low_res_scan.png · Trey Research',     date: '6 days ago',   totalDurationMs: 3890, status: 'fail', failNodeIndex: 1,    skipNodeIndex: null },
  { id: 'run-15', label: 'INV-2024-0331 · Fabrikam Inc.',        date: '7 days ago',   totalDurationMs: 2140, status: 'pass', failNodeIndex: null, skipNodeIndex: null },
  { id: 'run-16', label: 'INV-2024-0325 · Woodgrove Bank',       date: '7 days ago',   totalDurationMs: 2560, status: 'pass', failNodeIndex: null, skipNodeIndex: null },
  { id: 'run-17', label: 'INV-2024-0318 · Northwind Traders',    date: '8 days ago',   totalDurationMs: 1880, status: 'pass', failNodeIndex: null, skipNodeIndex: null },
  { id: 'run-18', label: 'blank_page.pdf · Unknown vendor',      date: '8 days ago',   totalDurationMs: 6200, status: 'fail', failNodeIndex: 1,    skipNodeIndex: null },
  { id: 'run-19', label: 'INV-2024-0310 · Adventure Works',      date: '9 days ago',   totalDurationMs: 2090, status: 'pass', failNodeIndex: null, skipNodeIndex: null },
  { id: 'run-20', label: 'INV-2024-0302 · Contoso Ltd.',         date: '9 days ago',   totalDurationMs: 2320, status: 'pass', failNodeIndex: null, skipNodeIndex: null },
  { id: 'run-21', label: 'INV-2024-0297 · Fabrikam Inc.',        date: '10 days ago',  totalDurationMs: 1950, status: 'pass', failNodeIndex: null, skipNodeIndex: null },
  { id: 'run-22', label: 'duplicate_header.pdf · Unknown',       date: '10 days ago',  totalDurationMs: 4450, status: 'fail', failNodeIndex: 1,    skipNodeIndex: null },
  { id: 'run-23', label: 'INV-2024-0289 · Trey Research',        date: '11 days ago',  totalDurationMs: 2200, status: 'pass', failNodeIndex: null, skipNodeIndex: null },
  { id: 'run-24', label: 'INV-2024-0281 · Woodgrove Bank',       date: '11 days ago',  totalDurationMs: 1840, status: 'pass', failNodeIndex: null, skipNodeIndex: null },
  { id: 'run-25', label: 'INV-2024-0274 · Northwind Traders',    date: '12 days ago',  totalDurationMs: 2670, status: 'pass', failNodeIndex: null, skipNodeIndex: null },
  { id: 'run-26', label: 'handwritten_note.jpg · Unknown',       date: '12 days ago',  totalDurationMs: 5800, status: 'fail', failNodeIndex: 1,    skipNodeIndex: null },
  { id: 'run-27', label: 'INV-2024-0266 · Adventure Works',      date: '13 days ago',  totalDurationMs: 1990, status: 'pass', failNodeIndex: null, skipNodeIndex: null },
  { id: 'run-28', label: 'INV-2024-0259 · Contoso Ltd.',         date: '13 days ago',  totalDurationMs: 2180, status: 'pass', failNodeIndex: null, skipNodeIndex: null },
  { id: 'run-29', label: 'INV-2024-0251 · Fabrikam Inc.',        date: '14 days ago',  totalDurationMs: 2040, status: 'pass', failNodeIndex: null, skipNodeIndex: null },
  { id: 'run-30', label: 'multi_page_spread.pdf · Unknown',      date: '14 days ago',  totalDurationMs: 7100, status: 'fail', failNodeIndex: 1,    skipNodeIndex: null },
];

/** Generate plausible mock inputs/outputs for a node based on its type and run context. */
function mockNodeIO(node: WorkflowNode, isFailed: boolean, isSkipped: boolean, runLabel: string): { inputs: Record<string, string>; outputs: Record<string, string>; instructions?: string } {
  const vendor = runLabel.includes('Contoso') ? 'Contoso Ltd.' : runLabel.includes('Fabrikam') ? 'Fabrikam Inc.' : '[unreadable]';
  const amount = runLabel.includes('Contoso') ? '$12,450.00' : runLabel.includes('Fabrikam') ? '$8,200.00' : '$?.00';
  const po = runLabel.includes('Contoso') ? 'PO-8841' : runLabel.includes('Fabrikam') ? 'PO-0000' : '—';
  const file = runLabel.split('·')[0].trim();
  const confidence = isFailed ? '0.14' : runLabel.includes('Fabrikam') ? '0.95' : '0.97';

  switch (node.type) {
    case 'trigger':
      return {
        inputs: { file_name: file, modified_by: isFailed ? 'uploads@contoso.com' : `system@${vendor.toLowerCase().replace(/[^a-z]/g, '')}.com` },
        outputs: { file_name: file, file_path: `/Invoices/2024/${file}`, modified_date: '2024-01-15T09:12:00Z' },
      };
    case 'ai-action':
      return {
        inputs: { file_path: `/Invoices/2024/${file}` },
        outputs: isFailed
          ? { vendor_name: '[unreadable]', amount: '$?.00', po_number: '—', invoice_date: '—', confidence }
          : { vendor_name: vendor, amount, po_number: po, invoice_date: '2024-01-14', confidence },
        instructions: node.config?.task ?? 'Extract key fields from the document and return them with a confidence score.',
      };
    case 'agent':
      return {
        inputs: { vendor_name: vendor, amount, po_number: po },
        outputs: isFailed
          ? { validation_result: 'valid', validation_reason: 'Approved with partial data (confidence below threshold)', risk_score: '0.82' }
          : po === 'PO-0000'
            ? { validation_result: 'invalid', validation_reason: 'PO-0000 not found in system', risk_score: '0.91' }
            : { validation_result: 'valid', validation_reason: `All fields match ${po}`, risk_score: '0.04' },
        instructions: node.config?.instructions ?? 'Validate the extracted data against the purchase order database.',
      };
    case 'condition': {
      const branchTaken = po === 'PO-0000' ? 'false' : 'true';
      return {
        inputs: { validation_result: po === 'PO-0000' ? 'invalid' : 'valid' },
        outputs: { branch_taken: branchTaken },
      };
    }
    case 'action':
      if (isSkipped) return { inputs: {}, outputs: { status: 'skipped' } };
      if (node.branch === 'false' || (node.label ?? '').toLowerCase().includes('reject')) {
        return {
          inputs: { to: 'ap@contoso.com', subject: `Invoice ${file} rejected`, body: `${po} not found. Please resubmit.` },
          outputs: { status: 'sent', message_id: `msg_${Math.random().toString(36).slice(2, 8)}` },
        };
      }
      return {
        inputs: { to: 'finance@contoso.com', subject: `Invoice ${file} approved`, body: `Approved for payment of ${amount}` },
        outputs: { status: isFailed ? 'error' : 'sent', message_id: `msg_${Math.random().toString(36).slice(2, 8)}` },
      };
    default:
      return {
        inputs: { input: 'Received' },
        outputs: { output: isFailed ? 'Error' : 'Completed' },
      };
  }
}

/** Build a RunAction list from live workflow nodes for a given mock run. */
function buildRunActions(nodes: WorkflowNode[], meta: MockRunMeta, wfVersion: 1 | 2 = 1): RunAction[] {
  const total = meta.totalDurationMs;
  const durationPerNode = Math.floor(total / Math.max(nodes.length, 1));
  let cursor = 0;
  return nodes.map((node, idx) => {
    const duration = idx === nodes.length - 1
      ? total - cursor
      : durationPerNode + (node.type === 'ai-action' || node.type === 'agent' ? Math.floor(durationPerNode * 0.5) : 0);
    const isFailed = meta.failNodeIndex !== null && idx === meta.failNodeIndex;
    const isSkipped = meta.skipNodeIndex !== null && idx === meta.skipNodeIndex;
    const { inputs, outputs, instructions } = mockNodeIO(node, isFailed, isSkipped, meta.label);
    const action: RunAction = {
      id: node.id,
      label: node.type === 'trigger' && wfVersion !== 2 ? 'Start' : node.label,
      type: node.type,
      connector: node.connector,
      startMs: cursor,
      durationMs: Math.min(duration, total - cursor),
      status: isFailed ? 'fail' : isSkipped ? 'skipped' : 'pass',
      inputs,
      outputs,
      instructions,
    };
    cursor += action.durationMs;
    return action;
  });
}


// ─── Grader validation helper ──────────────────────────────────────────────────
function validateGraderPrompt(prompt: string): { valid: boolean; hint: string | null } {
  const trimmed = prompt.trim();
  if (!trimmed) return { valid: false, hint: null };
  if (!trimmed.endsWith('?')) return { valid: false, hint: 'Graders must be questions — try ending with "?".' };
  if (!/\b(did|does|is|was|were|has|have|can|should|will|would)\b/i.test(trimmed))
    return { valid: false, hint: 'Graders should be yes/no questions that can be answered pass or fail.' };
  return { valid: true, hint: null };
}

// ─── Grader library ────────────────────────────────────────────────────────────
const GRADER_POOL: Grader[] = [
  { id: 'pool-accuracy',    name: 'Data accuracy',         prompt: 'Did each step correctly process its input data without errors or data loss?',                isBuiltIn: true, category: 'accuracy' },
  { id: 'pool-routing',     name: 'Routing correctness',   prompt: 'Did the workflow take the correct branch at each decision point based on business logic?',    isBuiltIn: true, category: 'routing' },
  { id: 'pool-completion',  name: 'Run completion',        prompt: 'Did all required steps complete without being skipped or erroring?',                          isBuiltIn: true, category: 'performance' },
  { id: 'pool-output',      name: 'Output validity',       prompt: 'Did the final step produce a valid, non-empty output?',                                       isBuiltIn: true, category: 'accuracy' },
  { id: 'pool-latency',     name: 'Latency within SLA',    prompt: 'Did the total run duration stay within the expected time threshold?',                         isBuiltIn: true, category: 'performance' },
  { id: 'pool-escalation',  name: 'Correct escalation',    prompt: 'Were exceptions or failures correctly routed to a human review path?',                        isBuiltIn: true, category: 'routing' },
  { id: 'pool-retry',       name: 'No unexpected retries', prompt: 'Did the workflow complete without any unexpected retries or duplicate executions?',            isBuiltIn: true, category: 'performance' },
  { id: 'pool-pii',         name: 'PII not exposed',       prompt: 'Did the workflow avoid logging or surfacing any personally identifiable information?',         isBuiltIn: true, category: 'accuracy' },
  { id: 'pool-approval',    name: 'Approval triggered',    prompt: 'Did the workflow trigger an approval step when the business rules required one?',              isBuiltIn: true, category: 'routing' },
  { id: 'pool-notify',      name: 'Notification sent',     prompt: 'Was the appropriate notification or confirmation sent to the relevant recipient?',             isBuiltIn: true, category: 'accuracy' },
  { id: 'pool-idempotent',  name: 'Idempotent execution',  prompt: 'Did re-running the workflow with the same input produce the same output?',                    isBuiltIn: true, category: 'performance' },
  { id: 'pool-audit',       name: 'Audit trail complete',  prompt: 'Did each step produce a complete and accurate audit log entry?',                              isBuiltIn: true, category: 'accuracy' },
];

// Default graders — first 5 pre-added for a realistic initial state
const DEFAULT_GRADERS: Grader[] = GRADER_POOL.slice(0, 5);


const WorkflowEvaluatePage: React.FC = () => {
  const { agentConfig, isStepTypeVisuals, workflowVersion } = useAgent();

  // ─── State ────────────────────────────────────────────────────────────────
  const [graders, setGraders] = useState<Grader[]>(DEFAULT_GRADERS);
  const [selectedGraderIds, setSelectedGraderIds] = useState<Set<string>>(new Set([DEFAULT_GRADERS[0].id, DEFAULT_GRADERS[1].id]));
  const [showManageGraders, setShowManageGraders] = useState(false);
  const [editingGraderId, setEditingGraderId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [newGraderInput, setNewGraderInput] = useState('');
  const [expandedActionIds, setExpandedActionIds] = useState<Set<string>>(new Set());
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [graderPromptDraft, setGraderPromptDraft] = useState('');
  const [newGraderName, setNewGraderName] = useState('');
  const [addingGrader, setAddingGrader] = useState(false);
  const [graderDrawerOpen, setGraderDrawerOpen] = useState(false);
  const [addGraderPanelOpen, setAddGraderPanelOpen] = useState(false);
  const [newGraderInputHint, setNewGraderInputHint] = useState<string | null>(null);
  const [graderPromptDraftHint, setGraderPromptDraftHint] = useState<string | null>(null);
  // Per-grader model selection (graderId → model tier)
  const [graderModels, setGraderModels] = useState<Record<string, string>>({});
  // Overflow menu for grader cards
  const [graderMenuOpen, setGraderMenuOpen] = useState<{ id: string; top: number; left: number } | null>(null);
  // Inline edit panel for a single grader
  const [editingGraderInline, setEditingGraderInline] = useState<string | null>(null);
  type EvalTimelineItem =
    | { kind: 'eval'; runId: string; graderIds: string[]; result: EvalResult; runLabel: string; graderNames: string[]; timestamp: string }
    | { kind: 'publish'; label: string; timestamp: string };

  const [evalTimeline, setEvalTimeline] = useState<EvalTimelineItem[]>(() => {
    try {
      const raw = getAgentStorage(agentConfig.id, 'evalTimeline');
      if (raw) return JSON.parse(raw);
      // Migrate legacy pastEvals format if present
      const legacy = getAgentStorage(agentConfig.id, 'pastEvals');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        return parsed.map((e: any) => ({ kind: 'eval' as const, ...e }));
      }
      return [];
    } catch { return []; }
  });

  // Convenience: just the eval entries (for stats, grader lookup, etc.)
  const pastEvals = evalTimeline.filter((e): e is Extract<EvalTimelineItem, { kind: 'eval' }> => e.kind === 'eval');

  // Persist timeline
  const evalTimelineRef = useRef(evalTimeline);
  evalTimelineRef.current = evalTimeline;
  useEffect(() => {
    setAgentStorage(agentConfig.id, 'evalTimeline', JSON.stringify(evalTimeline));
  }, [agentConfig.id, evalTimeline]);

  // Insert a publish divider when published value changes between visits.
  // We persist the last-seen value in localStorage so a publish that happens while
  // the user is on the Build tab is detected when they return to Evaluate.
  const publishStorageKey = 'lastSeenPublished';
  useEffect(() => {
    const curr = agentConfig.published ? String(agentConfig.published) : '';
    const prev = getAgentStorage(agentConfig.id, publishStorageKey) ?? '';
    // Update persisted value immediately so future mounts compare correctly
    setAgentStorage(agentConfig.id, publishStorageKey, curr);
    // Insert divider only if published value is newly truthy and differs from last seen,
    // and there is at least one eval in the timeline to sit above the divider
    if (curr && curr !== prev && evalTimelineRef.current.some(e => e.kind === 'eval')) {
      const versionNum = evalTimelineRef.current.filter(e => e.kind === 'publish').length + 1;
      const label = `Published v${versionNum}.0`;
      setEvalTimeline(tl => [{ kind: 'publish', label, timestamp: 'Just now' }, ...tl]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentConfig.published]);

  // Which grader is "focused" in the results view (for step highlighting)
  const [focusedGraderId, setFocusedGraderId] = useState<string | null>(null);
  // Which fix suggestion is active in the Next Steps pane
  const [activeFixIdx, setActiveFixIdx] = useState(0);

  // Mirror useWorkflowCanvas exactly: fallback to DEFAULT_NODES, apply same config patches
  const workflowNodes: WorkflowNode[] = React.useMemo(() => {
    const raw: WorkflowNode[] = agentConfig.workflowNodes?.length ? agentConfig.workflowNodes : DEFAULT_NODES;
    return raw.map(n => {
      if (n.id === 'cua-1' && !n.config?.instanceName) {
        return { ...n, config: { ...n.config, instanceName: 'Contoso Dev Environment', stepTypeLabel: 'Computer Use', instanceMode: 'dev-env' } };
      }
      if (n.id === 'agent-2' && !n.config?.instanceName) {
        return { ...n, config: { ...n.config, instanceName: 'Customer Support Agent', stepTypeLabel: 'Agent', instanceMode: 'create' } };
      }
      return n;
    });
  }, [agentConfig.workflowNodes]);
  const mockRuns: WorkflowRun[] = React.useMemo(
    () => MOCK_RUN_META.map(meta => ({
      id: meta.id,
      label: meta.label,
      date: meta.date,
      totalDurationMs: meta.totalDurationMs,
      status: meta.status,
      actions: buildRunActions(workflowNodes, meta, workflowVersion),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(workflowNodes), workflowVersion]
  );

  // Derived
  const isPublished = !!agentConfig.published;
  const hasRuns = mockRuns.length > 0;
  const selectedGraders = graders.filter(g => selectedGraderIds.has(g.id));
  const selectedRun = mockRuns.find(r => r.id === selectedRunId) ?? null;
  const hasResult = !!evalResult;

  // Waterfall: compute percentages
  const totalMs = selectedRun?.totalDurationMs ?? 1;
  const getBarStyle = (action: RunAction) => ({
    left: `${(action.startMs / totalMs) * 100}%`,
    width: `${Math.max((action.durationMs / totalMs) * 100, 2)}%`,
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleEvaluate = () => {
    if (!selectedRun || selectedGraderIds.size === 0) return;
    setEvaluating(true);
    setEvalResult(null);
    setFocusedGraderId(null);
    // Simulate /api/evaluate call
    setTimeout(() => {
      // Generate per-grader results grounded in the actual run actions
      const failedAction = selectedRun.actions.find(a => a.status === 'fail') ?? null;
      const graderResults: Record<string, GraderResult> = {};
      const sortedGraderIds = Array.from(selectedGraderIds);
      sortedGraderIds.forEach((graderId, idx) => {
        const grader = graders.find(g => g.id === graderId);
        const category = grader?.category ?? 'custom';

        // Pick which steps this grader assesses based on its category
        const allActions = selectedRun.actions;
        let assessed: RunAction[];
        if (category === 'routing') {
          assessed = allActions.filter(a => a.type === 'condition' || a.type === 'trigger');
          if (assessed.length === 0) assessed = allActions.slice(0, 2);
        } else if (category === 'accuracy') {
          assessed = allActions.filter(a => a.type === 'ai-action' || a.type === 'agent' || a.type === 'action');
          if (assessed.length === 0) assessed = allActions.slice(1, 3);
        } else if (category === 'performance') {
          // Performance graders look at all steps
          assessed = allActions;
        } else {
          // Custom: random subset of 2–4 steps
          const shuffled = [...allActions].sort(() => Math.random() - 0.5);
          assessed = shuffled.slice(0, 2 + Math.floor(Math.random() * 3));
        }

        // The failed action for this grader — only if it's in the assessed set
        const relevantFail = failedAction && assessed.some(a => a.id === failedAction.id) ? failedAction : null;
        const graderFails = selectedRun.status === 'fail' && (idx === 0 || Math.random() < 0.4) && relevantFail !== null;

        graderResults[graderId] = graderFails
          ? { verdict: 'fail', score: 0, summary: `Step "${relevantFail!.label}" did not satisfy this check.`, failedActionId: relevantFail!.id, assessedActionIds: assessed.map(a => a.id) }
          : { verdict: 'pass', score: 100, summary: `All ${assessed.length} assessed step${assessed.length !== 1 ? 's' : ''} satisfied this check.`, failedActionId: null, assessedActionIds: assessed.map(a => a.id) };
      });
      const overallFail = Object.values(graderResults).some(r => r.verdict === 'fail');
      // Overall score = % of graders that passed
      const passCount = Object.values(graderResults).filter(r => r.verdict === 'pass').length;
      const overallScore = Math.round((passCount / sortedGraderIds.length) * 100);
      const failedGraderResult = Object.values(graderResults).find(r => r.failedActionId);

      const result: EvalResult = {
        verdict: overallFail ? 'fail' : 'pass',
        score: overallScore,
        summary: overallFail
          ? `${Object.values(graderResults).filter(r => r.verdict === 'fail').length} of ${sortedGraderIds.length} grader(s) failed. Review highlighted steps below.`
          : 'All graders passed. The run meets the evaluation criteria.',
        failedActionId: failedGraderResult?.failedActionId ?? null,
        actionFeedback: Object.fromEntries(selectedRun.actions.map(a => [
          a.id,
          a.status === 'fail'
            ? { verdict: 'fail' as const, note: 'This step failed during execution. Check inputs and configuration.' }
            : a.status === 'skipped'
            ? { verdict: 'fail' as const, note: 'Step was skipped — may indicate incorrect branching.' }
            : { verdict: 'pass' as const, note: 'Step completed successfully.' },
        ])),
        graderResults,
      };
      setEvalResult(result);
      setEvaluating(false);
      // Auto-focus first failing grader (or first grader) and expand its assessed steps
      const firstFail = sortedGraderIds.find(id => graderResults[id]?.verdict === 'fail');
      const autoFocusId = firstFail ?? sortedGraderIds[0] ?? null;
      setFocusedGraderId(autoFocusId);
      setActiveFixIdx(0);
      if (autoFocusId) {
        setExpandedActionIds(new Set(graderResults[autoFocusId]?.assessedActionIds ?? []));
      } else {
        const allAssessed = Object.values(graderResults).flatMap(r => r.assessedActionIds ?? []);
        setExpandedActionIds(new Set(allAssessed));
      }
      // Record in eval timeline
      const graderIdsKey = sortedGraderIds.slice().sort().join(',');
      const newEntry: EvalTimelineItem = { kind: 'eval', runId: selectedRun.id, graderIds: sortedGraderIds, result, runLabel: selectedRun.label, graderNames: selectedGraders.map(g => g.name), timestamp: 'Just now' };
      setEvalTimeline(prev => {
        const existingIdx = prev.findIndex(e => e.kind === 'eval' && e.runId === selectedRun.id && e.graderIds.slice().sort().join(',') === graderIdsKey);
        if (existingIdx !== -1) return prev.map((e, i) => i === existingIdx ? newEntry : e);
        return [newEntry, ...prev];
      });
    }, 2200);
  };

  const handleNewGraderSubmit = () => {
    if (!newGraderInput.trim()) return;
    const { valid, hint } = validateGraderPrompt(newGraderInput);
    if (!valid) { setNewGraderInputHint(hint); return; }
    const g: Grader = { id: `grader-${Date.now()}`, name: newGraderInput.trim().replace(/\?$/, '').slice(0, 50), prompt: newGraderInput.trim(), category: 'custom' };
    setGraders(prev => [...prev, g]);
    setSelectedGraderIds(prev => new Set(Array.from(prev).concat(g.id)));
    setNewGraderInput('');
    setNewGraderInputHint(null);
  };

  const handleAddGrader = () => {
    if (!newGraderName.trim()) return;
    const g: Grader = { id: `grader-${Date.now()}`, name: newGraderName.trim(), prompt: '', category: 'custom' };
    setGraders(prev => [...prev, g]);
    setSelectedGraderIds(prev => new Set(Array.from(prev).concat(g.id)));
    setEditingGraderId(g.id);
    setGraderPromptDraft('');
    setNewGraderName('');
    setAddingGrader(false);
  };

  const handleDeleteGrader = (id: string) => {
    setGraders(prev => prev.filter(g => g.id !== id));
    setSelectedGraderIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    if (editingGraderId === id) setEditingGraderId(null);
  };

  const handleSaveGraderPrompt = () => {
    const { valid, hint } = validateGraderPrompt(graderPromptDraft);
    if (!valid) { setGraderPromptDraftHint(hint); return; }
    setGraders(prev => prev.map(g => g.id === editingGraderId ? { ...g, prompt: graderPromptDraft } : g));
    setEditingGraderId(null);
    setGraderPromptDraftHint(null);
  };

  const startEditGrader = (g: Grader) => {
    setEditingGraderId(g.id);
    setGraderPromptDraft(g.prompt);
    setGraderPromptDraftHint(null);
  };

  // ─── Action type color ─────────────────────────────────────────────────────
  const actionTypeColor = (type: string, status: RunAction['status'], failed: boolean) => {
    if (failed) return 'bg-red-500';
    if (status === 'skipped') return 'bg-gray-300';
    const map: Record<string, string> = { trigger: 'bg-purple-400', 'ai-action': 'bg-blue-500', agent: 'bg-indigo-500', condition: 'bg-amber-400', action: 'bg-green-500' };
    return map[type] ?? 'bg-gray-400';
  };

  const actionTypeDot = (type: string) => {
    const map: Record<string, string> = { trigger: 'bg-purple-400', 'ai-action': 'bg-blue-500', agent: 'bg-indigo-500', condition: 'bg-amber-400', action: 'bg-green-500' };
    return map[type] ?? 'bg-gray-400';
  };

  // Icon per grader based on category/id
  const graderIcon = (g: Grader) => {
    if (g.category === 'routing' || g.id.includes('routing')) return <BranchFork20Regular className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />;
    if (g.category === 'accuracy' || g.id.includes('accuracy') || g.id.includes('output')) return <DataTrending20Regular className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />;
    return <ShieldTask20Regular className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />;
  };

  // Pool graders not yet added by the user
  const availablePoolGraders = GRADER_POOL.filter(pg => !graders.some(g => g.id === pg.id));

  // Model display helpers
  const MODEL_OPTIONS = [
    { value: 'balanced', label: 'Claude Sonnet', icon: <ClaudeSonnetIcon size={16} /> },
    { value: 'capable',  label: 'Claude Opus',   icon: <ClaudeOpusIcon size={16} /> },
    { value: 'fast',     label: 'Claude Haiku',  icon: <ClaudeHaikuIcon size={16} /> },
  ];
  const modelDisplay = (tier: string) => MODEL_OPTIONS.find(o => o.value === tier) ?? MODEL_OPTIONS[0];

  // ─── LAYOUT ────────────────────────────────────────────────────────────────

  // Published guard
  if (!isPublished) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="flex flex-col items-center text-center gap-4 max-w-sm px-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'hsl(var(--primary) / 0.08)' }}>
            <Beaker20Regular className="w-7 h-7" style={{ color: 'hsl(var(--primary))' }} />
          </div>
          <div>
            <h2 className="text-title-3 text-gray-900 mb-1">Publish to start evaluating</h2>
            <p className="text-body-2 text-gray-500">Evaluations require a published workflow. Once published, you can run evals against historical runs.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden relative">

      {/* ── NO RUNS EMPTY STATE ── */}
      {!hasRuns && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center text-center gap-4 max-w-sm px-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'hsl(var(--primary) / 0.08)' }}>
              <Clock20Regular className="w-7 h-7" style={{ color: 'hsl(var(--primary))' }} />
            </div>
            <div>
              <h2 className="text-title-3 text-gray-900 mb-1">No runs yet</h2>
              <p className="text-body-2 text-gray-500">This workflow hasn't been triggered yet. Activate a published trigger to generate your first run.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── SETUP VIEW — pick run + graders ── */}
      {hasRuns && !evaluating && !hasResult && (
        <div className="flex-1 flex overflow-hidden" style={{ animation: 'fadeInText 0.15s ease-out forwards' }}>

          {/* ── Main column ── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-8 py-8">

                <div className="mb-8">
                  <h1 className="text-title-2 text-gray-900">Evaluations</h1>
                  <p className="text-body-2 text-gray-500 mt-1">Select a run and graders, then run an evaluation to see results.</p>
                </div>

                {/* ── SECTION 1: Select a run ── */}
                <div className="mb-10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border-2" style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))', background: 'white' }}>1</div>
                    <h2 className="text-subtitle-1 text-gray-900">Select a run</h2>
                    <span className="text-body-2 font-semibold text-gray-500">{mockRuns.length}</span>
                    <div className="flex-1" />
                    <CopilotButton variant="ghost" size="sm" onClick={() => {}}>
                      <ArrowClockwise20Regular className="w-4 h-4 text-gray-600" />
                    </CopilotButton>
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto' }} className="rounded-xl border border-[hsl(var(--secondary-border))] overflow-hidden">
                    <CopilotTable
                      size="sm"
                      columns={[
                        {
                          key: 'select',
                          label: '',
                          width: '32px',
                          render: (_v, row) => {
                            const isSelected = row.id === selectedRunId;
                            return (
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]' : 'border-gray-300 bg-white'}`}>
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                            );
                          },
                        },
                        {
                          key: 'label',
                          label: 'Run',
                          sortable: true,
                          render: (v, row) => (
                            <span className={`truncate ${row.id === selectedRunId ? 'text-[hsl(var(--primary))] font-semibold' : 'text-gray-800'}`}>{v}</span>
                          ),
                        },
                        { key: 'date', label: 'Date', width: '110px', sortable: true },
                        {
                          key: 'steps',
                          label: 'Steps',
                          width: '60px',
                          render: (_v, row) => row.actions.length,
                        },
                        {
                          key: 'duration',
                          label: 'Duration',
                          width: '72px',
                          render: (_v, row) => `${(row.totalDurationMs / 1000).toFixed(1)}s`,
                        },
                        {
                          key: 'status',
                          label: 'Status',
                          width: '68px',
                          render: (_v, row) => (
                            <CopilotBadge appearance="tint" color={row.status === 'pass' ? 'success' : 'danger'} size="small">
                              {row.status === 'pass' ? 'Pass' : 'Fail'}
                            </CopilotBadge>
                          ),
                        },
                      ]}
                      data={mockRuns}
                      selectedRowIndex={mockRuns.findIndex(r => r.id === selectedRunId)}
                      onRowClick={row => setSelectedRunId(row.id)}
                    />
                  </div>
                </div>

                {/* ── SECTION 2: Select graders ── */}
                <div className="mb-6">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border-2" style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))', background: 'white' }}>2</div>
                      <h2 className="text-subtitle-1 text-gray-900">Select graders</h2>
                      <span className="text-body-2 font-semibold text-gray-500">{graders.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CopilotButton variant="ghost" size="sm" onClick={() => setShowManageGraders(true)}>Manage</CopilotButton>
                      <CopilotButton variant="secondary" size="sm" onClick={() => setAddGraderPanelOpen(true)}>
                        <Add20Regular className="w-3.5 h-3.5 mr-1" />
                        Add grader
                      </CopilotButton>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {graders.map(grader => {
                      const isSelected = selectedGraderIds.has(grader.id);
                      const model = modelDisplay(graderModels[grader.id] ?? 'balanced');
                      const isEditingThis = editingGraderInline === grader.id;
                      return (
                        <div
                          key={grader.id}
                          className={`rounded-2xl border transition-all ${isSelected ? 'border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.03)]' : 'border-[hsl(var(--secondary-border))] bg-white'}`}
                        >
                          {/* Row */}
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedGraderIds(prev => {
                              const n = new Set(prev);
                              n.has(grader.id) ? n.delete(grader.id) : n.add(grader.id);
                              return n;
                            })}
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                          >
                            {/* Checkbox */}
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]' : 'border-gray-300 bg-white'}`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            {/* Icon */}
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(var(--primary) / 0.08)' }}>
                              {graderIcon(grader)}
                            </div>
                            {/* Name + question */}
                            <div className="flex-1 min-w-0">
                              <div className="text-body-2-strong text-gray-900">{grader.name}</div>
                              <div className="text-caption-1 text-gray-400 truncate">{grader.prompt || 'No question configured yet.'}</div>
                            </div>
                            {/* Model pill — read only */}
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 flex-shrink-0" onClick={e => e.stopPropagation()}>
                              {model.icon}
                              <span className="text-caption-2 text-gray-600 whitespace-nowrap">{model.label}</span>
                            </div>
                            {/* Overflow menu trigger */}
                            <CopilotButton
                              variant="ghost" size="sm"
                              className="flex-shrink-0 -mr-1"
                              onClick={e => {
                                e.stopPropagation();
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setGraderMenuOpen(prev => prev?.id === grader.id ? null : { id: grader.id, top: rect.bottom + 4, left: rect.right - 140 });
                              }}
                            >
                              <MoreHorizontal20Regular className="w-4 h-4" />
                            </CopilotButton>
                          </div>

                          {/* Inline edit panel */}
                          {isEditingThis && (
                            <div className="border-t border-[hsl(var(--secondary-border))] px-4 pb-4 pt-3 space-y-3" onClick={e => e.stopPropagation()}>
                              <CopilotTextarea
                                value={graderPromptDraft}
                                onChange={e => { setGraderPromptDraft(e.target.value); if (graderPromptDraftHint) setGraderPromptDraftHint(null); }}
                                placeholder="Ask a yes/no question…"
                                rows={3}
                                size="sm"
                                autoFocus
                              />
                              {graderPromptDraftHint && <p className="text-caption-2 text-amber-600">{graderPromptDraftHint}</p>}
                              <div className="flex items-center gap-3">
                                <CopilotDropdown
                                  variant="form-field"
                                  size="sm"
                                  options={MODEL_OPTIONS.map(o => ({ label: o.label, value: o.value }))}
                                  value={graderModels[grader.id] ?? 'balanced'}
                                  onChange={v => setGraderModels(prev => ({ ...prev, [grader.id]: v }))}
                                />
                                <div className="flex-1" />
                                <CopilotButton variant="ghost" size="sm" onClick={() => { setEditingGraderInline(null); setGraderPromptDraftHint(null); }}>Cancel</CopilotButton>
                                <CopilotButton variant="primary" size="sm" onClick={() => {
                                  const { valid, hint } = validateGraderPrompt(graderPromptDraft);
                                  if (!valid) { setGraderPromptDraftHint(hint); return; }
                                  setGraders(prev => prev.map(g => g.id === grader.id ? { ...g, prompt: graderPromptDraft } : g));
                                  setEditingGraderInline(null);
                                  setGraderPromptDraftHint(null);
                                }} disabled={!graderPromptDraft.trim()}>Save</CopilotButton>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

            </div>

            {/* ── Footer CTA ── */}
            <div className="flex-shrink-0 border-t border-[hsl(var(--secondary-border))] px-8 py-4 bg-white flex items-center gap-4">
              <CopilotButton
                variant="primary" size="md"
                onClick={handleEvaluate}
                disabled={!selectedRunId || selectedGraderIds.size === 0}
              >
                <Play20Filled className="w-4 h-4 mr-1.5" />
                Run evaluation
              </CopilotButton>
              <span className="text-caption-1 text-gray-400">
                {!selectedRunId && selectedGraderIds.size === 0 ? 'Select a run and at least one grader' : !selectedRunId ? 'Select a run to continue' : selectedGraderIds.size === 0 ? 'Select at least one grader' : `${selectedGraders.length} grader${selectedGraders.length !== 1 ? 's' : ''} · ${selectedRun?.label ?? 'no run selected'}`}
              </span>
            </div>
          </div>

          {/* ── Past evaluations right pane ── */}
          <div className="w-[33%] min-w-[280px] max-w-[380px] flex-shrink-0 flex flex-col border-l border-[hsl(var(--secondary-border))] bg-gray-50/40 overflow-hidden">
            <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-[hsl(var(--secondary-border))]">
              <span className="text-body-2-strong text-gray-700">Past evaluations</span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {pastEvals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-3 text-center gap-2">
                  <Beaker20Regular className="w-6 h-6 text-gray-200" />
                  <p className="text-caption-2 text-gray-400">No evaluations yet. Run your first to see results here.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {evalTimeline.map((item, i) => (
                    item.kind === 'publish' ? (
                      <div key={i} className="flex items-center gap-2 px-1 py-1">
                        <div className="flex-1 h-px bg-[hsl(var(--primary)/0.15)]" />
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.04)]">
                          <Rocket20Regular className="w-3 h-3 flex-shrink-0" style={{ color: 'hsl(var(--primary))' }} />
                          <span className="text-caption-2 font-semibold whitespace-nowrap" style={{ color: 'hsl(var(--primary))' }}>{item.label}</span>
                        </div>
                        <div className="flex-1 h-px bg-[hsl(var(--primary)/0.15)]" />
                      </div>
                    ) : (
                      <div
                        key={i}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedRunId(item.runId);
                          setSelectedGraderIds(new Set(item.graderIds));
                          setEvalResult(item.result);
                          setFocusedGraderId(null);
                          // Expand all steps assessed by any grader
                          const allAssessed = Object.values(item.result.graderResults).flatMap(r => r.assessedActionIds ?? []);
                          setExpandedActionIds(new Set(allAssessed));
                        }}
                        className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-white border border-[hsl(var(--secondary-border))] hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {item.result.verdict === 'pass'
                            ? <CheckmarkCircle20Filled className="w-3.5 h-3.5 text-green-500" />
                            : <DismissCircle20Filled className="w-3.5 h-3.5 text-red-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-caption-1-strong text-gray-800 truncate">{item.runLabel}</div>
                          <div className="text-caption-2 text-gray-400 truncate">{item.graderNames.join(', ')}</div>
                          <div className="text-caption-2 text-gray-300">{item.timestamp}</div>
                        </div>
                        <span className={`text-caption-2 font-semibold flex-shrink-0 mt-0.5 ${item.result.verdict === 'pass' ? 'text-green-600' : 'text-red-500'}`}>{item.result.score}%</span>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ── GRADER OVERFLOW MENU ── */}
      {graderMenuOpen && (
        <CopilotMenu
          items={[
            {
              label: 'Edit grader',
              icon: <Edit20Regular className="w-4 h-4" />,
              onClick: () => {
                const g = graders.find(x => x.id === graderMenuOpen.id);
                if (g) { setEditingGraderInline(g.id); setGraderPromptDraft(g.prompt); setGraderPromptDraftHint(null); }
                setGraderMenuOpen(null);
              },
            },
            {
              label: 'Remove',
              onClick: () => { handleDeleteGrader(graderMenuOpen.id); setGraderMenuOpen(null); },
            },
          ]}
          position={{ top: graderMenuOpen.top, left: graderMenuOpen.left }}
          onClose={() => setGraderMenuOpen(null)}
          minWidth={140}
        />
      )}

      {/* ── ADD GRADER PANEL ── */}
      {addGraderPanelOpen && (
        <>
          <div className="absolute inset-0 bg-black/20 z-30" onClick={() => setAddGraderPanelOpen(false)} />
          <div className="absolute top-0 right-0 bottom-0 w-[400px] bg-white border-l border-[hsl(var(--secondary-border))] shadow-xl z-40 flex flex-col" style={{ animation: 'fadeInText 0.15s ease-out forwards' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--secondary-border))]">
              <h2 className="text-subtitle-2 text-gray-900">Add grader</h2>
              <CopilotButton variant="ghost" size="sm" onClick={() => setAddGraderPanelOpen(false)}>
                <Dismiss20Regular className="w-4 h-4" />
              </CopilotButton>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
              {/* Library — shown first */}
              {availablePoolGraders.length > 0 && (
                <div>
                  <div className="text-body-2-strong text-gray-700 mb-3">Suggested graders</div>
                  <div className="space-y-2">
                    {availablePoolGraders.map(pg => (
                      <div key={pg.id} className="flex items-start gap-3 px-4 py-3 rounded-xl border border-[hsl(var(--secondary-border))] bg-white hover:bg-gray-50 transition-colors">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'hsl(var(--primary) / 0.06)' }}>
                          {graderIcon(pg)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-caption-1-strong text-gray-700">{pg.name}</div>
                          <div className="text-caption-2 text-gray-400 mt-0.5">{pg.prompt}</div>
                        </div>
                        <CopilotButton
                          variant="ghost" size="sm"
                          className="flex-shrink-0 -mt-0.5"
                          onClick={() => {
                            setGraders(prev => [...prev, pg]);
                            setSelectedGraderIds(prev => new Set(Array.from(prev).concat(pg.id)));
                          }}
                        >
                          <Add20Regular className="w-3.5 h-3.5" />
                        </CopilotButton>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Create with NL — at the bottom as a fallback */}
              <div>
                <div className="text-body-2-strong text-gray-700 mb-3">Create a grader</div>
                <div className="flex items-start gap-2.5 px-3.5 py-3 mb-3 rounded-xl bg-[hsl(var(--primary)/0.04)] border border-[hsl(var(--primary)/0.15)]">
                  <Sparkle20Regular className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'hsl(var(--primary))' }} />
                  <p className="text-caption-1 text-gray-600 leading-relaxed">
                    Each grader evaluates a run by answering a single yes/no question — it will either <span className="font-semibold text-gray-800">pass</span> or <span className="font-semibold text-gray-800">fail</span>. Write your grader as a question that can be answered with yes or no.
                  </p>
                </div>
                <div className="rounded-2xl border border-[hsl(var(--secondary-border))] bg-gray-50/60 overflow-hidden focus-within:border-[hsl(var(--primary)/0.5)] focus-within:bg-white transition-colors">
                  <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                    <Sparkle20Regular className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--primary))' }} />
                    <span className="text-caption-1-strong text-gray-500">Write a yes/no question</span>
                  </div>
                  <CopilotTextarea
                    value={newGraderInput}
                    onChange={e => { setNewGraderInput(e.target.value); if (newGraderInputHint) setNewGraderInputHint(null); }}
                    placeholder="e.g. 'Did the approval email get sent for every valid invoice?'"
                    rows={3}
                    size="md"
                    className="border-none bg-transparent shadow-none focus:ring-0 px-4 resize-none"
                  />
                  {newGraderInputHint && (
                    <div className="px-4 pb-2">
                      <p className="text-caption-2 text-amber-600">{newGraderInputHint}</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-4 pb-4 pt-2">
                    <span className="text-caption-2 text-gray-400">Must end with a question mark</span>
                    <CopilotButton variant="primary" size="sm" onClick={() => { handleNewGraderSubmit(); if (!newGraderInputHint) setAddGraderPanelOpen(false); }} disabled={!newGraderInput.trim()}>
                      <Send20Filled className="w-3.5 h-3.5 mr-1.5" />
                      Add grader
                    </CopilotButton>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </>
      )}

      {/* ── RESULTS VIEW ── */}
      {hasRuns && (evaluating || hasResult) && (
        <div className="flex-1 flex flex-col overflow-hidden" style={{ animation: 'fadeInText 0.15s ease-out forwards' }}>

          {/* Page header — mirrors setup page */}
          <div className="flex-shrink-0 flex items-center gap-3 px-8 py-5 border-b border-[hsl(var(--secondary-border))]">
            <CopilotButton variant="ghost" size="sm" onClick={() => { setEvalResult(null); setExpandedActionIds(new Set()); setFocusedGraderId(null); }}>
              ← Back
            </CopilotButton>
            <div className="w-px h-4 bg-gray-200 flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-title-2 text-gray-900 leading-tight truncate">
                {selectedRun?.label ?? 'Evaluation results'}
              </h1>
              {selectedRun && (
                <p className="text-caption-1 text-gray-400 mt-0.5">
                  {new Date(selectedRun.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {selectedGraders.length} grader{selectedGraders.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            {!evaluating && evalResult && (() => {
              const passCount = Object.values(evalResult.graderResults).filter(r => r.verdict === 'pass').length;
              const failCount = Object.values(evalResult.graderResults).filter(r => r.verdict === 'fail').length;
              const isPass = evalResult.verdict === 'pass';
              return (
                <div className="ml-auto flex items-center gap-4 flex-shrink-0">
                  {/* Pass/fail counts — secondary */}
                  <div className="flex items-center gap-3 text-body-2 text-gray-500">
                    {failCount > 0 && (
                      <span className="flex items-center gap-1.5">
                        <DismissCircle20Filled className="w-4 h-4 text-red-400" />
                        {failCount} failed
                      </span>
                    )}
                    {passCount > 0 && (
                      <span className="flex items-center gap-1.5">
                        <CheckmarkCircle20Filled className="w-4 h-4 text-green-400" />
                        {passCount} passed
                      </span>
                    )}
                  </div>
                  {/* Primary verdict pill */}
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm ${isPass ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                    {isPass
                      ? <CheckmarkCircle20Filled className="w-4 h-4" />
                      : <DismissCircle20Filled className="w-4 h-4" />}
                    {isPass ? 'Passed' : 'Failed'}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Spinner while evaluating */}
          {evaluating && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-2 border-[hsl(var(--primary)/0.3)] border-t-[hsl(var(--primary))] rounded-full animate-spin" />
              <p className="text-body-2 text-gray-500">Evaluating {selectedGraders.length} grader{selectedGraders.length !== 1 ? 's' : ''}…</p>
              <p className="text-caption-1 text-gray-400">{selectedRun?.label}</p>
            </div>
          )}

          {/* Three-column results layout */}
          {!evaluating && hasResult && evalResult && (() => {
            const focusedGrader = focusedGraderId ? selectedGraders.find(g => g.id === focusedGraderId) ?? null : null;
            const focusedResult = focusedGrader ? evalResult.graderResults[focusedGrader.id] ?? null : null;

            // In "all graders" mode (no focused grader), compute aggregate per step
            const getAggregateStepStatus = (action: RunAction): 'fail' | 'pass' | 'none' => {
              const assessingGraders = selectedGraders.filter(g => evalResult.graderResults[g.id]?.assessedActionIds?.includes(action.id));
              if (assessingGraders.length === 0) return 'none';
              const anyFail = assessingGraders.some(g => evalResult.graderResults[g.id]?.failedActionId === action.id);
              return anyFail ? 'fail' : 'pass';
            };

            // In focused grader mode, classify each step
            const getFocusedStepStatus = (action: RunAction): 'fail' | 'pass' | 'not-assessed' => {
              if (!focusedResult) return 'not-assessed';
              const wasAssessed = focusedResult.assessedActionIds?.includes(action.id) ?? false;
              if (!wasAssessed) return 'not-assessed';
              if (focusedResult.failedActionId === action.id) return 'fail';
              return 'pass';
            };

            const failedAction = focusedResult?.failedActionId
              ? selectedRun?.actions.find(a => a.id === focusedResult.failedActionId) ?? null
              : null;

            return (
              <div className="flex-1 flex overflow-hidden" style={{ animation: 'fadeInText 0.2s ease-out forwards' }}>

                {/* ── LEFT: Grader list ── */}
                <div className="w-[360px] flex-shrink-0 flex flex-col border-r border-[hsl(var(--secondary-border))] overflow-hidden">
                  <div className="flex-shrink-0 px-5 pt-5 pb-3">
                    <span className="text-body-2-strong text-gray-700">Graders</span>
                  </div>
                  <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1.5">

                    {/* "All graders" summary row */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setFocusedGraderId(null)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${
                        focusedGraderId === null
                          ? 'border-[hsl(var(--primary)/0.35)] bg-[hsl(var(--primary)/0.04)]'
                          : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className={`text-body-2-strong ${focusedGraderId === null ? 'text-[hsl(var(--primary))]' : 'text-gray-800'}`}>All graders</div>
                      </div>
                      <div className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium border ${focusedGraderId === null ? 'border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.06)]' : 'border-gray-200 text-gray-500 bg-gray-50'}`}>
                        {selectedGraders.length}
                      </div>
                    </div>

                    <div className="border-t border-[hsl(var(--secondary-border))] mx-1 my-1" />

                    {selectedGraders.map(g => {
                      const gr = evalResult.graderResults[g.id];
                      if (!gr) return null;
                      const isFocused = focusedGraderId === g.id;
                      return (
                        <div
                          key={g.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            const newId = focusedGraderId === g.id ? null : g.id;
                            setFocusedGraderId(newId);
                            // Auto-expand assessed steps for the newly focused grader
                            if (newId) {
                              const assessed = evalResult.graderResults[newId]?.assessedActionIds ?? [];
                              setExpandedActionIds(new Set(assessed));
                            } else {
                              // "All graders" — expand every step assessed by any grader
                              const allAssessed = Object.values(evalResult.graderResults).flatMap(r => r.assessedActionIds ?? []);
                              setExpandedActionIds(new Set(allAssessed));
                            }
                          }}
                          className={`flex items-start gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all border ${
                            isFocused
                              ? 'border-[hsl(var(--primary)/0.35)] bg-[hsl(var(--primary)/0.04)]'
                              : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <div className={`text-body-2-strong truncate ${isFocused ? 'text-[hsl(var(--primary))]' : 'text-gray-800'}`}>{g.name}</div>
                              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 ${gr.verdict === 'pass' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                {gr.verdict === 'pass'
                                  ? <CheckmarkCircle20Filled className="w-3 h-3" />
                                  : <DismissCircle20Filled className="w-3 h-3" />}
                                {gr.verdict === 'pass' ? 'Pass' : 'Fail'}
                              </div>
                            </div>
                            <div className="text-caption-2 text-gray-500 leading-relaxed line-clamp-2 mb-1">
                              {g.prompt || <span className="italic text-gray-400">No question configured.</span>}
                            </div>
                            <div className="text-caption-1 text-gray-500 font-medium">
                              {gr.assessedActionIds?.length ?? 0} step{(gr.assessedActionIds?.length ?? 0) !== 1 ? 's' : ''} assessed
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── CENTER: Workflow step trace ── */}
                <div className="flex-1 flex flex-col overflow-hidden border-r border-[hsl(var(--secondary-border))]">
                  <div className="flex-shrink-0 px-6 pt-5 pb-3 flex items-center gap-2">
                    <span className="text-body-2-strong text-gray-700">Step trace</span>
                    {focusedGrader ? (
                      <span className="text-caption-1 text-gray-500">
                        — <span className="font-medium text-gray-700">{focusedGrader.name}</span>
                      </span>
                    ) : (
                      <span className="text-caption-1 text-gray-400">— all graders combined</span>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-0">
                    {(selectedRun?.actions ?? []).map((action, idx) => {
                      // Determine how this step looks
                      let dotColor: string;
                      let cardStyle: string;
                      let isNotAssessed = false;

                      if (focusedGrader && focusedResult) {
                        const status = getFocusedStepStatus(action);
                        isNotAssessed = status === 'not-assessed';
                        dotColor = status === 'fail' ? 'bg-red-500' : status === 'pass' ? 'bg-green-500' : 'bg-gray-200';
                        cardStyle = status === 'fail'
                          ? 'bg-red-50 border-red-300'
                          : status === 'pass'
                            ? 'bg-green-50 border-green-300'
                            : 'bg-gray-50 border-gray-200 opacity-60';
                      } else {
                        const agg = getAggregateStepStatus(action);
                        dotColor = agg === 'fail' ? 'bg-red-500' : agg === 'pass' ? 'bg-green-400' : 'bg-gray-300';
                        cardStyle = agg === 'fail'
                          ? 'bg-red-50 border-red-200'
                          : agg === 'pass'
                            ? 'bg-green-50/60 border-green-200'
                            : 'bg-white border-[hsl(var(--secondary-border))]';
                      }

                      return (
                        <div key={action.id} className="flex items-stretch gap-3">
                          {/* connector dot + line */}
                          <div className="flex flex-col items-center flex-shrink-0 w-5">
                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-[14px] transition-colors ${dotColor}`} />
                            {idx < (selectedRun?.actions.length ?? 1) - 1 && (
                              <div className="w-px flex-1 bg-gray-200" />
                            )}
                          </div>

                          {/* step card */}
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => !isNotAssessed && setExpandedActionIds(prev => { const n = new Set(prev); n.has(action.id) ? n.delete(action.id) : n.add(action.id); return n; })}
                            className={`flex-1 flex flex-col px-4 py-3 mb-1.5 rounded-xl border transition-all ${cardStyle} ${isNotAssessed ? 'cursor-default' : 'cursor-pointer hover:brightness-95'}`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`flex-shrink-0 ${isNotAssessed ? 'opacity-30' : 'opacity-80'}`}>
                                {getEvalNodeIcon({ id: action.id, type: action.type as any, label: action.label, connector: action.connector })}
                              </div>
                              <span className={`text-body-2-strong flex-1 min-w-0 truncate ${isNotAssessed ? 'text-gray-400' : focusedGrader && getFocusedStepStatus(action) === 'fail' ? 'text-red-700' : 'text-gray-800'}`}>
                                {action.label}
                              </span>
                              <span className="text-caption-2 text-gray-400 flex-shrink-0">
                                {action.durationMs >= 1000 ? `${(action.durationMs / 1000).toFixed(1)}s` : `${action.durationMs}ms`}
                              </span>
                              {isNotAssessed ? (
                                <span className="text-caption-2 text-gray-400 italic flex-shrink-0">Not assessed</span>
                              ) : (
                                expandedActionIds.has(action.id)
                                  ? <ChevronUp20Regular className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                  : <ChevronDown20Regular className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              )}
                            </div>

                            {/* Expanded: per-grader results for this step */}
                            {!isNotAssessed && expandedActionIds.has(action.id) && (
                              <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                                {(() => {
                                  // When a grader is focused, only show that grader's result; otherwise show all
                                  const gradersInScope = focusedGraderId
                                    ? selectedGraders.filter(g => g.id === focusedGraderId)
                                    : selectedGraders;
                                  const gradersForStep = gradersInScope.filter(g =>
                                    evalResult.graderResults[g.id]?.assessedActionIds?.includes(action.id)
                                  );
                                  if (gradersForStep.length === 0) return <span className="text-caption-2 text-gray-400 italic">No graders assessed this step.</span>;
                                  return gradersForStep.map(g => {
                                    const gr = evalResult.graderResults[g.id];
                                    if (!gr) return null;
                                    const stepFailed = gr.failedActionId === action.id;
                                    return (
                                      <div key={g.id} className="flex items-start gap-2">
                                        {stepFailed
                                          ? <DismissCircle20Filled className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                                          : <CheckmarkCircle20Filled className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />}
                                        <div className="text-caption-2 text-gray-500">
                                          <span className="font-semibold text-gray-700">{g.name}:</span>{' '}
                                          {stepFailed ? <span className="text-red-600">Failed — {gr.summary}</span> : <span className="text-green-600">Passed</span>}
                                        </div>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── RIGHT: Next steps ── */}
                {(() => {
                  const allPass = evalResult.verdict === 'pass';
                  // Collect all failing graders with their suggested fixes
                  const failingGraders = selectedGraders
                    .map(g => ({ grader: g, result: evalResult.graderResults[g.id] }))
                    .filter(({ result }) => result?.verdict === 'fail');

                  // Build suggestions per failing grader
                  const graderSuggestions = failingGraders.map(({ grader, result }) => {
                    const fa = result?.failedActionId ? selectedRun?.actions.find(a => a.id === result.failedActionId) ?? null : null;
                    const fixes = result?.failedActionId === 'agent-1' ? [
                      { title: 'Tighten validation instructions', description: 'Update the step to explicitly reject when confidence < 0.5.', cta: 'Edit step' },
                      { title: 'Add a confidence check branch', description: 'Insert a condition node that routes low-confidence results to a human review queue.', cta: 'Open workflow' },
                    ] : result?.failedActionId === 'condition-1' ? [
                      { title: 'Review branch condition logic', description: 'The condition node may be missing an error path for unreadable documents.', cta: 'Open workflow' },
                      { title: 'Update routing instructions', description: 'Clarify that missing data should always return "invalid".', cta: 'Edit step' },
                    ] : fa ? [
                      { title: `Fix "${fa.label}"`, description: `Inspect this step and update its instructions to handle the failing case.`, cta: 'Edit step' },
                    ] : [];
                    return { grader, result: result!, failedAction: fa, fixes };
                  });

                  // Flatten all fixes into a single ordered list with grader context
                  const allFixes = graderSuggestions.flatMap(({ grader, fixes }) =>
                    fixes.map(fix => ({ ...fix, graderName: grader.name }))
                  );
                  const activeFix = allFixes[activeFixIdx] ?? null;

                  return (
                    <div className="w-[320px] flex-shrink-0 flex flex-col border-l border-[hsl(var(--secondary-border))] overflow-hidden">
                      <div className="flex-shrink-0 px-6 pt-5 pb-3 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Sparkle20Regular className="w-4 h-4" style={{ color: 'hsl(var(--primary))' }} />
                          <span className="text-body-2-strong text-gray-700">Next steps</span>
                        </div>
                        {!allPass && allFixes.length > 0 && (
                          <span className="text-caption-1 text-gray-400">{activeFixIdx + 1} of {allFixes.length}</span>
                        )}
                      </div>

                      {allPass ? (
                        /* ── All passed ── */
                        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 gap-5 text-center">
                          <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center">
                            <CheckmarkCircle20Filled className="w-7 h-7 text-green-500" />
                          </div>
                          <div>
                            <div className="text-subtitle-2 text-gray-800 mb-1">All graders passed</div>
                            <p className="text-caption-1 text-gray-500 leading-relaxed">
                              This run meets all your evaluation criteria. Run another evaluation to monitor for regressions.
                            </p>
                          </div>
                          <CopilotButton variant="secondary" size="md" onClick={() => { setEvalResult(null); setExpandedActionIds(new Set()); setFocusedGraderId(null); }}>
                            Run again
                          </CopilotButton>
                        </div>
                      ) : activeFix ? (
                        /* ── Stepped fix view ── */
                        <div className="flex-1 flex flex-col overflow-hidden" style={{ animation: 'fadeInText 0.12s ease-out forwards' }}>
                          <div className="flex-1 overflow-y-auto px-5 pb-4">
                            {/* Grader context */}
                            <div className="text-caption-1 text-gray-400 mb-3">{activeFix.graderName}</div>

                            {/* Fix title */}
                            <div className="text-subtitle-2 text-gray-900 mb-2">{activeFix.title}</div>

                            {/* Detailed description */}
                            <p className="text-body-2 text-gray-600 leading-relaxed mb-4">{activeFix.description}</p>

                            {/* Extended guidance */}
                            <div className="rounded-xl bg-gray-50 border border-[hsl(var(--secondary-border))] px-4 py-3 space-y-2">
                              <div className="text-caption-1-strong text-gray-700">What to check</div>
                              <ul className="space-y-1.5">
                                <li className="flex items-start gap-2 text-caption-1 text-gray-600">
                                  <span className="mt-1 w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
                                  Review the step's current instructions for missing edge case handling.
                                </li>
                                <li className="flex items-start gap-2 text-caption-1 text-gray-600">
                                  <span className="mt-1 w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
                                  Check that input validation covers all expected formats.
                                </li>
                                <li className="flex items-start gap-2 text-caption-1 text-gray-600">
                                  <span className="mt-1 w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
                                  Re-run this evaluation after making changes to confirm the fix.
                                </li>
                              </ul>
                            </div>
                          </div>

                          {/* Action buttons pinned to bottom */}
                          <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-[hsl(var(--secondary-border))] space-y-2">
                            <CopilotButton variant="primary" size="md" className="w-full justify-center">
                              {activeFix.cta} →
                            </CopilotButton>
                            {allFixes.length > 1 && (
                              <CopilotButton
                                variant="ghost"
                                size="md"
                                className="w-full justify-center"
                                onClick={() => setActiveFixIdx(i => Math.min(i + 1, allFixes.length - 1))}
                                disabled={activeFixIdx >= allFixes.length - 1}
                              >
                                {activeFixIdx < allFixes.length - 1 ? `Next →` : 'No more suggestions'}
                              </CopilotButton>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center px-6 text-center">
                          <p className="text-caption-1 text-gray-400">No specific fixes available.</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

              </div>
            );
          })()}
        </div>
      )}

      {/* ── MANAGE GRADERS PAGE ── */}
      {showManageGraders && (
        <div className="absolute inset-0 bg-white z-20 flex flex-col overflow-hidden" style={{ animation: 'fadeInText 0.12s ease-out forwards' }}>
          {/* Header */}
          <div className="flex-shrink-0 flex items-center gap-3 px-6 py-4 border-b border-[hsl(var(--secondary-border))]">
            <CopilotButton variant="ghost" size="sm" onClick={() => { setShowManageGraders(false); setEditingGraderId(null); setGraderPromptDraftHint(null); }}>
              ← Back
            </CopilotButton>
            <div className="w-px h-4 bg-gray-200 flex-shrink-0" />
            <h1 className="text-title-2 text-gray-900">Graders</h1>
            <span className="text-caption-1 text-gray-400">{graders.length}</span>
            <div className="flex-1" />
            <CopilotButton variant="primary" size="sm" onClick={() => setAddGraderPanelOpen(true)}>
              <Add20Regular className="w-3.5 h-3.5 mr-1" />
              New grader
            </CopilotButton>
          </div>

          {/* Two-column body */}
          <div className="flex-1 flex overflow-hidden">

            {/* ── LEFT: Grader list with stats ── */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-3">
                {graders.map(g => {
                  // Derive stats from pastEvals
                  const evals = pastEvals.filter(e => e.graderIds.includes(g.id));
                  const totalRuns = evals.length;
                  const passCount = evals.filter(e => e.result.graderResults[g.id]?.verdict === 'pass').length;
                  const failCount = totalRuns - passCount;
                  const model = modelDisplay(graderModels[g.id] ?? 'balanced');

                  return (
                    <div key={g.id} className="border border-[hsl(var(--secondary-border))] rounded-2xl overflow-hidden bg-white">
                      <div className="flex items-start gap-3 px-5 py-4">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'hsl(var(--primary) / 0.08)' }}>
                          {graderIcon(g)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-body-2-strong text-gray-900 mb-1">{g.name}</div>
                          <div className="text-caption-1 text-gray-500 leading-relaxed mb-3">
                            {g.prompt || <span className="italic text-gray-400">No question configured yet.</span>}
                          </div>
                          {/* Stats row */}
                          <div className="flex items-center gap-4">
                            {totalRuns > 0 ? (
                              <>
                                <div className="flex items-center gap-1 text-caption-2 text-gray-500">
                                  <span className="text-gray-400">Used in</span>
                                  <span className="font-semibold text-gray-700">{totalRuns}</span>
                                  <span className="text-gray-400">eval{totalRuns !== 1 ? 's' : ''}</span>
                                </div>
                                {passCount > 0 && (
                                  <div className="flex items-center gap-1 text-caption-2">
                                    <CheckmarkCircle20Filled className="w-3 h-3 text-green-500" />
                                    <span className="text-green-600 font-semibold">{passCount} passed</span>
                                  </div>
                                )}
                                {failCount > 0 && (
                                  <div className="flex items-center gap-1 text-caption-2">
                                    <DismissCircle20Filled className="w-3 h-3 text-red-400" />
                                    <span className="text-red-500 font-semibold">{failCount} failed</span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-caption-2 text-gray-400 italic">Not used yet</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Model pill — right-aligned like in setup view */}
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100">
                            {model.icon}
                            <span className="text-caption-2 text-gray-600 whitespace-nowrap">{model.label}</span>
                          </div>
                          {editingGraderId !== g.id && (
                            <CopilotButton variant="ghost" size="sm" onClick={() => startEditGrader(g)}>
                              <Edit20Regular className="w-4 h-4" />
                            </CopilotButton>
                          )}
                          {!g.isBuiltIn && (
                            <CopilotButton variant="ghost" size="sm" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteGrader(g.id)}>
                              <Dismiss20Regular className="w-4 h-4" />
                            </CopilotButton>
                          )}
                        </div>
                      </div>
                      {editingGraderId === g.id && (
                        <div className="border-t border-[hsl(var(--secondary-border))] px-5 pb-4 pt-3 space-y-3 bg-gray-50/40">
                          <CopilotTextarea
                            value={graderPromptDraft}
                            onChange={e => { setGraderPromptDraft(e.target.value); if (graderPromptDraftHint) setGraderPromptDraftHint(null); }}
                            placeholder="Ask a yes/no question…"
                            rows={3}
                            size="sm"
                            autoFocus
                          />
                          {graderPromptDraftHint && <p className="text-caption-2 text-amber-600">{graderPromptDraftHint}</p>}
                          {graderPromptDraft.trim() && !graderPromptDraftHint && validateGraderPrompt(graderPromptDraft).valid && (
                            <p className="text-caption-2 text-green-600">Looks like a yes/no question ✓</p>
                          )}
                          <div className="flex items-center gap-3">
                            <CopilotDropdown
                              variant="form-field" size="sm"
                              options={MODEL_OPTIONS.map(o => ({ label: o.label, value: o.value }))}
                              value={graderModels[g.id] ?? 'balanced'}
                              onChange={v => setGraderModels(prev => ({ ...prev, [g.id]: v }))}
                            />
                            <div className="flex-1" />
                            <CopilotButton variant="ghost" size="sm" onClick={() => { setEditingGraderId(null); setGraderPromptDraftHint(null); }}>Cancel</CopilotButton>
                            <CopilotButton variant="primary" size="sm" onClick={handleSaveGraderPrompt} disabled={!graderPromptDraft.trim()}>Save</CopilotButton>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── RIGHT: Suggested graders from pool ── */}
            <div className="w-[320px] flex-shrink-0 flex flex-col border-l border-[hsl(var(--secondary-border))] bg-gray-50/40 overflow-hidden">
              <div className="flex-shrink-0 px-5 pt-5 pb-3">
                <div className="text-body-2-strong text-gray-700 mb-0.5">Suggested graders</div>
                <p className="text-caption-1 text-gray-500">From the built-in library — click to add.</p>
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
                {availablePoolGraders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                    <CheckmarkCircle20Filled className="w-7 h-7 text-green-400 mb-2" />
                    <p className="text-caption-1 text-gray-500">All suggested graders have been added.</p>
                  </div>
                ) : (
                  availablePoolGraders.map(pg => (
                    <div key={pg.id} className="flex items-start gap-3 px-3 py-3 bg-white rounded-xl border border-[hsl(var(--secondary-border))] hover:border-[hsl(var(--primary)/0.3)] hover:bg-[hsl(var(--primary)/0.02)] transition-all group">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'hsl(var(--primary) / 0.08)' }}>
                        {graderIcon(pg)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-caption-1-strong text-gray-800 mb-0.5">{pg.name}</div>
                        <div className="text-caption-2 text-gray-500 leading-relaxed line-clamp-2">{pg.prompt}</div>
                      </div>
                      <CopilotButton
                        variant="ghost"
                        size="sm"
                        className="flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setGraders(prev => [...prev, pg])}
                      >
                        <Add20Regular className="w-4 h-4" />
                      </CopilotButton>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main export ────────────────────────────────────────────────────────────────

export const EvaluatePage: React.FC = () => {
  const { agentConfig, isConversationalLayout } = useAgent();
  const isNarrowPreview = isConversationalLayout && agentConfig.type === 'agent';
  if (agentConfig.type === 'workflow') return <WorkflowEvaluatePage />;
  return <AgentEvaluatePageNew isNarrowPreview={isNarrowPreview} />;
};

// Re-export for ProjectModePage which renders evaluate inline
export const AgentEvaluatePage = AgentEvaluatePageNew;
