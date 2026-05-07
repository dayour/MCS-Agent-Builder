import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgentSnapshot, SnapshotLifecycleStage } from '../types';
import { useAgent } from '../context/AgentContext';
import { useDW } from '../domains/dw/context/DWContext';
import { getBuiltInSnapshots } from '../data/agentSnapshots';
import {
  CopilotButton,
  CopilotInput,
  CopilotBadge,
  CopilotFilterPill,
  CopilotMenu,
  CopilotTooltip,
} from '../components/ui';
import { SaveSnapshotDialog } from '../components/SaveSnapshotDialog';
import { SnapshotToggleDialog } from '../components/SnapshotToggleDialog';
import { SnapshotEditor } from '../components/SnapshotEditor';
import { GenerateSnapshotDialog } from '../components/GenerateSnapshotDialog';
import { TOGGLE_LABELS } from '../utils/toggleLabels';
import {
  Add20Regular,
  Sparkle20Regular,
  MoreHorizontal20Regular,
  Copy20Regular,
  Delete20Regular,
  ArrowDownload20Regular,
  Open20Regular,
  Warning20Regular,
  ArrowLeft20Regular,
  Info20Regular,
  Dismiss20Regular,
  Edit20Regular,
} from '@fluentui/react-icons';

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGE_BADGE_COLOR: Record<SnapshotLifecycleStage, 'subtle' | 'warning' | 'success' | 'danger' | 'brand'> = {
  'day-zero':    'subtle',
  'in-progress': 'warning',
  'published':   'success',
  'bad-agent':   'danger',
  'custom':      'brand',
};

const STAGE_LABEL: Record<SnapshotLifecycleStage, string> = {
  'day-zero':    'Day Zero',
  'in-progress': 'In Progress',
  'published':   'Published',
  'bad-agent':   'Bad Agent',
  'custom':      'Custom',
};

const STAGE_FILTERS: { label: string; value: SnapshotLifecycleStage | 'all' }[] = [
  { label: 'All',         value: 'all' },
  { label: 'Day Zero',    value: 'day-zero' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Published',   value: 'published' },
  { label: 'Bad Agent',   value: 'bad-agent' },
  { label: 'Custom',      value: 'custom' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1)  return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24)   return `${hours}h ago`;
  if (days < 30)    return `${days}d ago`;
  return date.toLocaleDateString();
}

function getModelLabel(model: string): string {
  const labels: Record<string, string> = {
    'opus-4.5': 'Opus 4.5', 'sonnet-4.5': 'Sonnet 4.5', 'haiku-4.5': 'Haiku 4.5',
    'gpt-5.2-auto': 'GPT Auto', 'gpt-5.2-instant': 'GPT Instant', 'gpt-5.2-thinking': 'GPT Thinking',
  };
  return labels[model] ?? model;
}

function formatToggleValue(v: boolean | string): string {
  if (typeof v === 'boolean') return v ? 'On' : 'Off';
  return String(v);
}

// ── JSON download ─────────────────────────────────────────────────────────────

function downloadSnapshot(snapshot: AgentSnapshot) {
  const fileData = { _notes: '', ...snapshot };
  const blob = new Blob([JSON.stringify(fileData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${snapshot.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Detail Section helper ─────────────────────────────────────────────────────

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold text-[var(--colorNeutralForeground3)] uppercase tracking-wider mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-1 sm:gap-4 px-4 py-3 border-b border-[var(--colorNeutralStroke2)] last:border-b-0">
      <span className="text-body-2 font-medium text-[var(--colorNeutralForeground3)] sm:self-start sm:pt-px">{label}</span>
      <span className="text-body-2 text-[var(--colorNeutralForeground1)]">{value}</span>
    </div>
  );
}

// ── Snapshot Detail Page ───────────────────────────────────────────────────────

interface SnapshotDetailProps {
  snapshot: AgentSnapshot;
  onBack: () => void;
  onLoad: (snapshot: AgentSnapshot) => void;
  onEdit: (snapshot: AgentSnapshot) => void;
  onDelete?: (snapshotId: string) => void;
  isLoading: boolean;
  activeToggles: Set<string>;
}

function SnapshotDetail({ snapshot, onBack, onLoad, onEdit, onDelete, isLoading, activeToggles }: SnapshotDetailProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const cfg = snapshot.agentConfig;
  const missingToggles = (snapshot.requiredToggles ?? []).filter(t => !activeToggles.has(t));
  const toggleEntries = Object.entries(snapshot.toggleState ?? {});

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-4 sm:px-8 h-14 border-b border-[var(--colorNeutralStroke2)]">
        <div className="flex items-center gap-2 min-w-0">
          <CopilotButton variant="transparent" size="sm" icon={<ArrowLeft20Regular />} onClick={onBack}>
            Snapshots
          </CopilotButton>
          <span className="text-[var(--colorNeutralStroke1)]">/</span>
          <span className="text-body-1 font-semibold text-[var(--colorNeutralForeground1)] truncate">{snapshot.name}</span>
          <CopilotBadge color={STAGE_BADGE_COLOR[snapshot.lifecycleStage]} appearance="tint" size="small" shape="rounded">
            {STAGE_LABEL[snapshot.lifecycleStage]}
          </CopilotBadge>
          {snapshot.isBuiltIn && (
            <CopilotBadge appearance="ghost" color="subtle" size="small" shape="rounded">Built-in</CopilotBadge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CopilotButton
            variant="transparent"
            size="sm"
            icon={<ArrowDownload20Regular />}
            onClick={() => downloadSnapshot(snapshot)}
          >
            Download
          </CopilotButton>
          <CopilotButton
            variant="secondary"
            size="sm"
            icon={<Edit20Regular />}
            onClick={() => onEdit(snapshot)}
          >
            Edit
          </CopilotButton>
          <div className="w-px h-5 bg-[var(--colorNeutralStroke2)] mx-0.5" />
          <CopilotButton
            variant="primary"
            size="sm"
            icon={<Open20Regular />}
            onClick={() => onLoad(snapshot)}
            disabled={isLoading}
          >
            {isLoading ? 'Loading…' : 'Load Snapshot'}
          </CopilotButton>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 pt-8 pb-16">
        <div className="max-w-3xl mx-auto w-full space-y-8">

          {/* Agent identity header */}
          <div className="pb-6 border-b border-[var(--colorNeutralStroke2)]">
            <h2 className="text-xl font-semibold text-[var(--colorNeutralForeground1)] leading-snug">{cfg.name}</h2>
            {cfg.description && (
              <p className="text-body-1 text-[var(--colorNeutralForeground2)] mt-2 leading-relaxed">{cfg.description}</p>
            )}
          </div>

          {/* Notes */}
          {snapshot.notes && (
            <DetailSection title="Notes">
              <p className="text-body-2 text-[var(--colorNeutralForeground2)] leading-relaxed whitespace-pre-wrap">{snapshot.notes}</p>
            </DetailSection>
          )}

          {/* Overview */}
          <DetailSection title="Overview">
            <div className="rounded-xl border border-[var(--colorNeutralStroke2)] overflow-hidden">
              {cfg.type && <DetailRow label="Type" value={cfg.type === 'workflow' ? 'Workflow' : 'Agent'} />}
              <DetailRow label="Agent variant" value={snapshot.agentVariant === 'custom' ? 'Custom' : 'Declarative'} />
              {cfg.agentType && <DetailRow label="Agent type" value={cfg.agentType} />}
              {cfg.model && <DetailRow label="Model" value={getModelLabel(cfg.model)} />}
              {cfg.audience && <DetailRow label="Audience" value={cfg.audience} />}
              {cfg.channel && <DetailRow label="Channel" value={cfg.channel} />}
              <DetailRow label="Published" value={cfg.published ? 'Yes' : 'No'} />
              {cfg.version && <DetailRow label="Version" value={cfg.version} />}
              {!snapshot.isBuiltIn && snapshot.createdAt && (
                <DetailRow label="Created" value={formatRelativeTime(snapshot.createdAt)} />
              )}
              {snapshot.createdBy && <DetailRow label="Created by" value={snapshot.createdBy} />}
            </div>
          </DetailSection>

          {/* Agent configuration */}
          {(cfg.instructions || (cfg.guidelines?.length ?? 0) > 0 || (cfg.skills?.length ?? 0) > 0) && (
            <DetailSection title="Agent configuration">
              <div className="rounded-xl border border-[var(--colorNeutralStroke2)] overflow-hidden">
                {cfg.guidelines?.length ? (
                  <DetailRow label={`Guidelines (${cfg.guidelines.length})`} value={
                    <ul className="space-y-1">
                      {cfg.guidelines.map((g, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-[var(--colorNeutralForeground3)] shrink-0" />
                          {g}
                        </li>
                      ))}
                    </ul>
                  } />
                ) : null}
                {cfg.skills?.length ? (
                  <DetailRow label={`Skills (${cfg.skills.length})`} value={cfg.skills.join(', ')} />
                ) : null}
                {cfg.capabilities?.length ? (
                  <DetailRow label={`Capabilities (${cfg.capabilities.length})`} value={
                    cfg.capabilities.map(c => c.name).join(', ')
                  } />
                ) : null}
                {cfg.instructions && (
                  <DetailRow label="Instructions" value={
                    <pre className="text-body-2 font-sans whitespace-pre-wrap leading-relaxed line-clamp-6 text-[var(--colorNeutralForeground2)]">
                      {cfg.instructions.slice(0, 600)}{cfg.instructions.length > 600 ? '…' : ''}
                    </pre>
                  } />
                )}
              </div>
            </DetailSection>
          )}

          {/* Feature toggles */}
          {(missingToggles.length > 0 || toggleEntries.length > 0) && (
            <DetailSection title="Feature toggles">
              {missingToggles.length > 0 && (
                <div className="flex items-start gap-2.5 mb-3 px-4 py-3 rounded-xl bg-[var(--colorStatusWarningBackground1)] border border-[var(--colorStatusWarningBorder1)]">
                  <Warning20Regular className="w-4 h-4 mt-0.5 text-[var(--colorStatusWarningForeground1)] shrink-0" />
                  <span className="text-body-2 text-[var(--colorStatusWarningForeground1)] leading-relaxed">
                    Required toggles not active: <strong>{missingToggles.map(t => TOGGLE_LABELS[t] ?? t).join(', ')}</strong>
                  </span>
                </div>
              )}
              {toggleEntries.length > 0 && (
                <div className="rounded-xl border border-[var(--colorNeutralStroke2)] overflow-hidden">
                  {toggleEntries.map(([id, value]) => (
                    <div
                      key={id}
                      className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-2.5 border-b border-[var(--colorNeutralStroke2)] last:border-b-0"
                    >
                      <span className="text-body-2 text-[var(--colorNeutralForeground1)]">
                        {TOGGLE_LABELS[id] ?? id}
                      </span>
                      {typeof value === 'boolean' ? (
                        <span className={`inline-flex items-center gap-1.5 text-body-2 font-medium ${value ? 'text-[var(--colorStatusSuccessForeground1)]' : 'text-[var(--colorNeutralForeground4)]'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${value ? 'bg-[var(--colorStatusSuccessForeground1)]' : 'bg-[var(--colorNeutralForeground4)]'}`} />
                          {value ? 'On' : 'Off'}
                        </span>
                      ) : (
                        <span className="text-body-2 font-medium text-[var(--colorNeutralForeground2)]">
                          {String(value)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </DetailSection>
          )}

          {/* Rich data */}
          {(snapshot.helperMessages?.length || snapshot.previewMessages?.length || snapshot.evaluations?.length || snapshot.monitoringData || snapshot.generateOnLoad) && (
            <DetailSection title="Included data">
              <div className="rounded-xl border border-[var(--colorNeutralStroke2)] overflow-hidden">
                {snapshot.generateOnLoad ? (
                  <DetailRow label="Content" value={
                    <span className="inline-flex items-center gap-2 text-body-2 font-medium text-[var(--colorBrandForeground1)]">
                      <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[var(--colorBrandBackground2)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--colorBrandForeground1)]" />
                      </span>
                      Generated on first load
                    </span>
                  } />
                ) : null}
                {snapshot.helperMessages?.length ? (
                  <DetailRow label="Helper messages" value={`${snapshot.helperMessages.length} messages`} />
                ) : null}
                {snapshot.previewMessages?.length ? (
                  <DetailRow label="Preview messages" value={`${snapshot.previewMessages.length} messages`} />
                ) : null}
                {snapshot.evaluations?.length ? (
                  <DetailRow label="Evaluations" value={`${snapshot.evaluations.length} eval run${snapshot.evaluations.length !== 1 ? 's' : ''}`} />
                ) : null}
                {snapshot.monitoringData ? (
                  <DetailRow label="Monitoring data" value={`${snapshot.monitoringData.totalRuns} runs, ${snapshot.monitoringData.totalSessions} sessions`} />
                ) : null}
              </div>
            </DetailSection>
          )}

          {/* Tags */}
          {snapshot.tags.length > 0 && (
            <DetailSection title="Tags">
              <div className="flex flex-wrap gap-2">
                {snapshot.tags.map(tag => (
                  <CopilotFilterPill key={tag} active={false} label={tag} onClick={() => {}} size="sm" />
                ))}
              </div>
            </DetailSection>
          )}

          {/* Promote to repo */}
          <DetailSection title="Share with team">
            <div className="rounded-xl border border-[var(--colorNeutralStroke2)] p-5 space-y-4">
              <p className="text-body-2 text-[var(--colorNeutralForeground2)] leading-relaxed">
                To add this snapshot to the built-in library for everyone on the team:
              </p>
              <ol className="text-body-2 text-[var(--colorNeutralForeground2)] space-y-2.5 list-none pl-0">
                <li className="flex gap-3">
                  <span className="shrink-0 flex items-center justify-center w-5 h-5 mt-0.5 rounded-full bg-[var(--colorNeutralBackground3)] text-[11px] font-semibold text-[var(--colorNeutralForeground3)]">1</span>
                  <span>Click <strong className="text-[var(--colorNeutralForeground1)]">Download</strong> to save this snapshot as a <code className="text-caption font-mono bg-[var(--colorNeutralBackground3)] text-[var(--colorNeutralForeground2)] px-1.5 py-0.5 rounded border border-[var(--colorNeutralStroke2)]">.json</code> file. Add notes in the <code className="text-caption font-mono bg-[var(--colorNeutralBackground3)] text-[var(--colorNeutralForeground2)] px-1.5 py-0.5 rounded border border-[var(--colorNeutralStroke2)]">_notes</code> field if helpful.</span>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 flex items-center justify-center w-5 h-5 mt-0.5 rounded-full bg-[var(--colorNeutralBackground3)] text-[11px] font-semibold text-[var(--colorNeutralForeground3)]">2</span>
                  <span>Upload the file to <code className="text-caption font-mono bg-[var(--colorNeutralBackground3)] text-[var(--colorNeutralForeground2)] px-1.5 py-0.5 rounded border border-[var(--colorNeutralStroke2)]">src/data/snapshots/</code> in the GitHub repo and commit.</span>
                </li>
              </ol>
              <CopilotButton
                variant="secondary"
                size="sm"
                icon={<ArrowDownload20Regular />}
                onClick={() => downloadSnapshot(snapshot)}
              >
                Download snapshot
              </CopilotButton>
            </div>
          </DetailSection>

          {/* Danger zone — user snapshots only */}
          {onDelete && (
            <DetailSection title="Danger zone">
              <div className="rounded-xl border border-[var(--colorStatusDangerBorder1)] bg-[var(--colorStatusDangerBackground1)] p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-body-2 font-semibold text-[var(--colorNeutralForeground1)]">Delete this snapshot</p>
                  <p className="text-caption text-[var(--colorNeutralForeground3)] mt-1">This action cannot be undone.</p>
                </div>
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-body-2 text-[var(--colorNeutralForeground2)] mr-1">Are you sure?</span>
                    <CopilotButton variant="primary" size="sm" icon={<Delete20Regular />} onClick={() => onDelete(snapshot.id)}>
                      Delete
                    </CopilotButton>
                    <CopilotButton variant="transparent" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                      Cancel
                    </CopilotButton>
                  </div>
                ) : (
                  <CopilotButton variant="outline" size="sm" icon={<Delete20Regular />} onClick={() => setShowDeleteConfirm(true)}>
                    Delete
                  </CopilotButton>
                )}
              </div>
            </DetailSection>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Snapshot Card ─────────────────────────────────────────────────────────────

interface SnapshotPageCardProps {
  snapshot: AgentSnapshot;
  onLoad: (snapshot: AgentSnapshot) => void;
  onEdit: (snapshot: AgentSnapshot) => void;
  onDuplicate: (snapshot: AgentSnapshot) => void;
  isLoading?: boolean;
  isGenerating?: boolean;
  activeToggles: Set<string>;
}

function SnapshotPageCard({ snapshot, onLoad, onEdit, onDuplicate, isLoading, isGenerating, activeToggles }: SnapshotPageCardProps) {
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  const missingToggles = (snapshot.requiredToggles ?? []).filter(t => !activeToggles.has(t));
  const agentType = snapshot.agentConfig.agentType;
  const isWorkflow = snapshot.agentConfig.type === 'workflow';

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  };

  const menuItems = [
    {
      label: 'Duplicate',
      icon: <Copy20Regular className="w-4 h-4" />,
      onClick: () => { onDuplicate(snapshot); setMenuPos(null); },
    },
    {
      label: 'Download snapshot',
      icon: <ArrowDownload20Regular className="w-4 h-4" />,
      onClick: () => { downloadSnapshot(snapshot); setMenuPos(null); },
      dividerAbove: true,
    },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground1)] p-5 hover:border-[var(--colorNeutralStroke1)] hover:shadow-sm transition-all">

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-body-1 font-semibold text-[var(--colorNeutralForeground1)] truncate">{snapshot.name}</span>
          <CopilotBadge color={STAGE_BADGE_COLOR[snapshot.lifecycleStage]} appearance="tint" size="small" shape="rounded">
            {STAGE_LABEL[snapshot.lifecycleStage]}
          </CopilotBadge>
        </div>
        <CopilotButton
          variant="transparent"
          size="sm"
          icon={<MoreHorizontal20Regular />}
          onClick={handleMenuClick}
          aria-label="Snapshot options"
        />
      </div>

      {/* Description */}
      {snapshot.description && (
        <p className="text-body-2 text-[var(--colorNeutralForeground2)] line-clamp-2 leading-relaxed">
          {snapshot.description}
        </p>
      )}

      {/* Metadata row */}
      {(isWorkflow || agentType || (!snapshot.isBuiltIn && snapshot.createdAt) || snapshot.createdBy) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-[var(--colorNeutralForeground3)]">
          {isWorkflow && <span>Workflow</span>}
          {agentType && <span>{agentType}</span>}
          {!snapshot.isBuiltIn && snapshot.createdAt && (
            <span className="flex items-center gap-1">
              {(isWorkflow || agentType) && <span className="w-1 h-1 rounded-full bg-[var(--colorNeutralForeground4)] inline-block" />}
              {formatRelativeTime(snapshot.createdAt)}
            </span>
          )}
          {snapshot.createdBy && (
            <span className="flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-[var(--colorNeutralForeground4)] inline-block" />
              by {snapshot.createdBy}
            </span>
          )}
        </div>
      )}

      {/* Required toggles warning */}
      {missingToggles.length > 0 && (
        <div className="flex items-center gap-1.5 text-caption text-[var(--colorStatusWarningForeground1)]">
          <Warning20Regular className="w-4 h-4 shrink-0" />
          <span>Requires: {missingToggles.map(t => TOGGLE_LABELS[t] ?? t).join(', ')}</span>
        </div>
      )}

      {/* Generating content indicator */}
      {isGenerating && (
        <div className="flex items-center gap-1.5 text-caption text-[var(--colorNeutralForeground3)]">
          <span className="w-3 h-3 rounded-full border-2 border-[var(--colorBrandForeground1)] border-t-transparent animate-spin shrink-0" />
          <span>Generating content…</span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto pt-1 flex items-center gap-2">
        <CopilotButton
          variant="primary"
          size="sm"
          icon={<Open20Regular />}
          onClick={() => onLoad(snapshot)}
          disabled={isLoading}
        >
          {isLoading ? 'Loading…' : 'Load Snapshot'}
        </CopilotButton>
        <CopilotButton
          variant="secondary"
          size="sm"
          icon={<Info20Regular />}
          onClick={() => onEdit(snapshot)}
        >
          Details
        </CopilotButton>
      </div>

      {/* Context menu */}
      {menuPos && (
        <CopilotMenu
          items={menuItems}
          position={menuPos}
          onClose={() => setMenuPos(null)}
        />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SnapshotsPage() {
  const navigate = useNavigate();
  const {
    userSnapshots,
    agents,
    activateSnapshot,
    duplicateSnapshot,
    deleteUserSnapshot,
    updateUserSnapshot,
    addUserSnapshot,
    buildAgentSnapshot,
    agentConfig,
    userName,
    isEvalMode, isSkillsEnabled, isFlowCaptureEnabled,
    isAgentGlobalUndo, isWorkIQEnabled,
  } = useAgent();

  const { isDexter } = useDW();

  const [stageFilter, setStageFilter] = useState<SnapshotLifecycleStage | 'all'>('all');
  const [search, setSearch]           = useState('');
  const [loadingId, setLoadingId]     = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [pendingSnapshot, setPendingSnapshot] = useState<AgentSnapshot | null>(null);
  const [detailSnapshot, setDetailSnapshot] = useState<AgentSnapshot | null>(null);
  const [generatingSnapshotIds, setGeneratingSnapshotIds] = useState<Set<string>>(new Set());
  const [editingSnapshot, setEditingSnapshot] = useState<AgentSnapshot | null>(null);

  const builtInSnapshots = useMemo(() => getBuiltInSnapshots(), []);

  const activeToggles = useMemo<Set<string>>(() => new Set([
    ...(isEvalMode          ? ['isEvalMode']          : []),
    ...(isDexter            ? ['isDexter']            : []),
    ...(isSkillsEnabled     ? ['isSkillsEnabled']     : []),
    ...(isFlowCaptureEnabled? ['isFlowCaptureEnabled']: []),
    ...(isAgentGlobalUndo   ? ['isAgentGlobalUndo']   : []),
    ...(isWorkIQEnabled     ? ['isWorkIQEnabled']     : []),
  ]), [isEvalMode, isDexter, isSkillsEnabled, isFlowCaptureEnabled, isAgentGlobalUndo, isWorkIQEnabled]);

  const filterFn = (s: AgentSnapshot) => {
    if (stageFilter !== 'all' && s.lifecycleStage !== stageFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.tags.some(t => t.toLowerCase().includes(q));
    }
    return true;
  };

  const filteredBuiltIns = useMemo(() => builtInSnapshots.filter(filterFn), [builtInSnapshots, stageFilter, search]); // eslint-disable-line react-hooks/exhaustive-deps
  const filteredUser     = useMemo(() => userSnapshots.filter(filterFn),     [userSnapshots, stageFilter, search]);     // eslint-disable-line react-hooks/exhaustive-deps

  const doActivate = (snapshot: AgentSnapshot) => {
    setLoadingId(snapshot.id);
    try {
      activateSnapshot(snapshot);
      if (snapshot.generateOnLoad) {
        setGeneratingSnapshotIds(prev => new Set(prev).add(snapshot.id));
        setTimeout(() => {
          setGeneratingSnapshotIds(prev => { const n = new Set(prev); n.delete(snapshot.id); return n; });
        }, 15000);
      }
      navigate('/build');
    } finally {
      setLoadingId(null);
    }
  };

  const handleLoad = (snapshot: AgentSnapshot) => {
    if (snapshot.toggleState && Object.keys(snapshot.toggleState).length > 0) {
      setPendingSnapshot(snapshot);
    } else {
      doActivate(snapshot);
    }
  };

  const handleDelete = (snapshotId: string) => {
    deleteUserSnapshot(snapshotId);
    setDetailSnapshot(null);
  };

  const handleSaveEdit = (updated: AgentSnapshot) => {
    if (updated.isBuiltIn) {
      const forked: AgentSnapshot = {
        ...updated,
        id: `snapshot-user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        isBuiltIn: false,
        createdAt: new Date().toISOString(),
        createdBy: userName || undefined,
      };
      addUserSnapshot(forked);
      setDetailSnapshot(forked);
    } else {
      const exists = userSnapshots.some(s => s.id === updated.id);
      if (exists) {
        updateUserSnapshot(updated.id, updated);
        setDetailSnapshot(updated);
      } else {
        // Brand-new snapshot (draft from agent picker) — save for the first time
        addUserSnapshot(updated);
        setDetailSnapshot(updated);
      }
    }
    setEditingSnapshot(null);
  };

  const handleSelectAgent = (agentId: string) => {
    try {
      const draft = buildAgentSnapshot(agentId);
      setEditingSnapshot(draft);
    } catch (e) {
      console.error('[SnapshotsPage] Failed to build snapshot from agent', e);
    }
  };

  // If editing a snapshot, render the editor
  const isNewDraft = editingSnapshot?.id.startsWith('snapshot-draft-') ?? false;

  if (editingSnapshot) {
    return (
      <SnapshotEditor
        snapshot={editingSnapshot}
        onSave={handleSaveEdit}
        onCancel={() => setEditingSnapshot(null)}
        saveLabel={isNewDraft ? 'Save Snapshot' : undefined}
      />
    );
  }

  // If showing detail view, render it full-canvas
  if (detailSnapshot) {
    // Resolve to latest version (user may have modified it)
    const live = userSnapshots.find(s => s.id === detailSnapshot.id) ?? detailSnapshot;
    const isUserSnapshot = !live.isBuiltIn;
    return (
      <>
        <SnapshotDetail
          snapshot={live}
          onBack={() => setDetailSnapshot(null)}
          onLoad={handleLoad}
          onEdit={s => setEditingSnapshot(s)}
          onDelete={isUserSnapshot ? handleDelete : undefined}
          isLoading={loadingId === live.id}
          activeToggles={activeToggles}
        />
        {pendingSnapshot && (
          <SnapshotToggleDialog
            isOpen={true}
            snapshot={pendingSnapshot}
            onApplyAndLoad={() => { doActivate(pendingSnapshot); setPendingSnapshot(null); }}
            onLoadAnyway={() => { doActivate(pendingSnapshot); setPendingSnapshot(null); }}
            onCancel={() => setPendingSnapshot(null)}
          />
        )}
      </>
    );
  }

  return (
    <div className="h-full flex flex-col">

      {/* Header */}
      <div className="shrink-0 px-8 pt-6 pb-4 border-b border-[var(--colorNeutralStroke2)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-title-2 font-semibold text-[var(--colorNeutralForeground1)]">Snapshots</h1>
            <p className="text-body-2 text-[var(--colorNeutralForeground3)] mt-0.5">
              Preconfigured agent states — load any snapshot to instantly reach a meaningful point in the agent lifecycle.
            </p>
          </div>
          <div className="flex items-center gap-2">
          <CopilotButton
            variant="secondary"
            size="md"
            icon={<Sparkle20Regular />}
            onClick={() => setShowGenerateDialog(true)}
          >
            Generate with AI
          </CopilotButton>
          <CopilotTooltip
            content={agents.filter(a => a.type === 'agent').length === 0 ? 'No agents to snapshot — create an agent first' : 'Save an agent as a snapshot'}
            placement="left"
          >
            <CopilotButton
              variant="primary"
              size="md"
              icon={<Add20Regular />}
              onClick={() => setShowSaveDialog(true)}
              disabled={agents.filter(a => a.type === 'agent').length === 0}
            >
              New Snapshot
            </CopilotButton>
          </CopilotTooltip>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mt-4">
          <div className="w-64">
            <CopilotInput
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search snapshots…"
              size="sm"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STAGE_FILTERS.map(f => (
              <CopilotFilterPill
                key={f.value}
                active={stageFilter === f.value}
                label={f.label}
                onClick={() => setStageFilter(f.value)}
                size="sm"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">

        {/* Built-in snapshots */}
        <section>
          <h2 className="text-body-1 font-semibold text-[var(--colorNeutralForeground1)] mb-3">Built-in</h2>
          {filteredBuiltIns.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredBuiltIns.map(snapshot => (
                <SnapshotPageCard
                  key={snapshot.id}
                  snapshot={snapshot}
                  onLoad={handleLoad}
                  onEdit={setDetailSnapshot}
                  onDuplicate={s => duplicateSnapshot(s)}
                  isLoading={loadingId === snapshot.id}
                  isGenerating={generatingSnapshotIds.has(snapshot.id)}
                  activeToggles={activeToggles}
                />
              ))}
            </div>
          ) : (
            <p className="text-body-2 text-[var(--colorNeutralForeground3)] py-4">No built-in snapshots match your filters.</p>
          )}
        </section>

        {/* User snapshots */}
        <section>
          <div className="flex items-baseline gap-3 mb-3">
            <h2 className="text-body-1 font-semibold text-[var(--colorNeutralForeground1)]">Local Snapshots</h2>
            <span className="text-caption text-[var(--colorNeutralForeground3)]">Stored in your browser only — use "Download snapshot" to share with the team</span>
          </div>
          {filteredUser.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredUser.map(snapshot => (
                <SnapshotPageCard
                  key={snapshot.id}
                  snapshot={snapshot}
                  onLoad={handleLoad}
                  onEdit={setDetailSnapshot}
                  onDuplicate={s => duplicateSnapshot(s)}
                  isLoading={loadingId === snapshot.id}
                  isGenerating={generatingSnapshotIds.has(snapshot.id)}
                  activeToggles={activeToggles}
                />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-[var(--colorNeutralForeground3)]">
              <p className="text-body-2 mb-1">No saved snapshots yet.</p>
              <p className="text-caption">Select an agent and click <strong>New Snapshot</strong> to capture its current state.</p>
            </div>
          )}
        </section>
      </div>

      {/* Agent picker dialog for new snapshots */}
      <SaveSnapshotDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSelectAgent={handleSelectAgent}
      />
      <GenerateSnapshotDialog isOpen={showGenerateDialog} onClose={() => setShowGenerateDialog(false)} />

      {/* Toggle configuration dialog */}
      {pendingSnapshot && (
        <SnapshotToggleDialog
          isOpen={true}
          snapshot={pendingSnapshot}
          onApplyAndLoad={() => { doActivate(pendingSnapshot); setPendingSnapshot(null); }}
          onLoadAnyway={() => { doActivate(pendingSnapshot); setPendingSnapshot(null); }}
          onCancel={() => setPendingSnapshot(null)}
        />
      )}
    </div>
  );
}
