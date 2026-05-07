/**
 * SpecSectionEditors — reusable per-section editors used by both /spec and
 * the home SpecSidePanel. Each editor owns its own add/edit/delete UI state,
 * and writes through a single onPatch(patch, summary) callback. Arrays are
 * sent in full since spec-patch semantics REPLACE arrays on merge.
 */

import React, { useState } from 'react';
import {
  Add20Regular,
  Edit20Regular,
  Delete20Regular,
  Warning16Regular,
  ChevronDown20Regular,
  ChevronRight20Regular,
  CheckmarkCircle16Regular,
  Checkmark20Regular,
  Star16Filled,
} from '@fluentui/react-icons';
import { CopilotBadge } from '../ui/CopilotBadge';
import { CopilotButton } from '../ui/CopilotButton';

// ── Primitives ────────────────────────────────────────────────────────────────

export type Phase = 'mvp' | 'future';

export const InlineEditForm: React.FC<{
  initialText?: string;
  initialDetail?: string;
  placeholder: string;
  detailPlaceholder?: string;
  onSave: (text: string, detail?: string) => void;
  onCancel: () => void;
}> = ({ initialText = '', initialDetail = '', placeholder, detailPlaceholder = 'Details (optional)', onSave, onCancel }) => {
  const [text, setText] = useState(initialText);
  const [detail, setDetail] = useState(initialDetail);
  const submit = () => { if (text.trim()) onSave(text.trim(), detail.trim() || undefined); };
  return (
    <div className="p-3 rounded-xl border border-[hsl(var(--primary)/0.2)] bg-[hsl(var(--primary)/0.02)]">
      <div className="space-y-2">
        <input
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
          placeholder={placeholder}
          className="w-full text-[13px] px-3 py-2 rounded-lg border border-gray-200 focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.1)] bg-white"
        />
        <input
          value={detail}
          onChange={e => setDetail(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
          placeholder={detailPlaceholder}
          className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-200 focus:border-[hsl(var(--primary))] focus:outline-none bg-white"
        />
      </div>
      <div className="flex justify-end gap-1.5 mt-2">
        <CopilotButton variant="subtle" size="sm" onClick={onCancel}>Cancel</CopilotButton>
        <CopilotButton variant="primary" size="sm" onClick={submit} disabled={!text.trim()}>Save</CopilotButton>
      </div>
    </div>
  );
};

const RowCard: React.FC<{
  title: string;
  detail?: string;
  phaseBadge?: Phase;
  iconColor?: string;
  onTogglePhase?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ title, detail, phaseBadge, iconColor, onTogglePhase, onEdit, onDelete }) => (
  <div className="group flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 bg-white hover:shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition-all">
    {phaseBadge && (
      <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${phaseBadge === 'mvp' ? 'bg-emerald-400' : 'bg-amber-300'}`} />
    )}
    {!phaseBadge && iconColor && (
      <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${iconColor}12`, color: iconColor }}>
        <Warning16Regular className="w-3.5 h-3.5" />
      </div>
    )}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-medium text-gray-900 truncate">{title}</span>
        {phaseBadge && onTogglePhase && (
          <button onClick={onTogglePhase} className="flex-shrink-0">
            <CopilotBadge appearance="tint" color={phaseBadge === 'mvp' ? 'success' : 'warning'} size="small">
              {phaseBadge === 'mvp' ? 'MVP' : 'Future'}
            </CopilotBadge>
          </button>
        )}
      </div>
      {detail && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{detail}</p>}
    </div>
    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
      <button aria-label={`Edit ${title}`} onClick={onEdit} className="p-1 rounded-md hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors"><Edit20Regular className="w-3.5 h-3.5" /></button>
      <button aria-label={`Delete ${title}`} onClick={onDelete} className="p-1 rounded-md hover:bg-gray-100 text-gray-300 hover:text-red-400 transition-colors"><Delete20Regular className="w-3.5 h-3.5" /></button>
    </div>
  </div>
);

const AddButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 w-full p-3 rounded-xl border border-dashed border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50/50 transition-all text-[13px]"
  >
    <Add20Regular className="w-4 h-4" /> {label}
  </button>
);

// ── Section editors ──────────────────────────────────────────────────────────

export interface SectionEditorProps {
  spec: any;
  onPatch: (patch: Record<string, any>, summary: string) => void;
  readOnly?: boolean;
}

export const CapabilitiesEditor: React.FC<SectionEditorProps> = ({ spec, onPatch, readOnly }) => {
  const items: any[] = Array.isArray(spec?.capabilities) ? spec.capabilities : [];
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const put = (next: any[], summary: string) => onPatch({ capabilities: next }, summary);

  return (
    <div className="space-y-2">
      {items.map((c, i) =>
        editingIdx === i ? (
          <InlineEditForm
            key={i}
            initialText={c.name}
            initialDetail={c.description}
            placeholder="Capability name"
            detailPlaceholder="Description"
            onSave={(t, d) => {
              const next = [...items];
              next[i] = { ...c, name: t, description: d };
              put(next, `edited capability "${t}"`);
              setEditingIdx(null);
            }}
            onCancel={() => setEditingIdx(null)}
          />
        ) : (
          <RowCard
            key={i}
            title={c.name || '(unnamed)'}
            detail={c.description}
            phaseBadge={(c.phase || 'mvp') as Phase}
            onTogglePhase={readOnly ? undefined : () => {
              const next = [...items];
              next[i] = { ...c, phase: (c.phase === 'mvp' ? 'future' : 'mvp') };
              put(next, `toggled phase on "${c.name}"`);
            }}
            onEdit={() => !readOnly && setEditingIdx(i)}
            onDelete={() => {
              const next = items.filter((_, idx) => idx !== i);
              put(next, `removed capability "${c.name}"`);
            }}
          />
        )
      )}
      {!readOnly && (adding ? (
        <InlineEditForm
          placeholder="Capability name"
          detailPlaceholder="Description"
          onSave={(t, d) => {
            put([...items, { name: t, description: d, phase: 'mvp' }], `added capability "${t}"`);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <AddButton label="Add capability" onClick={() => setAdding(true)} />
      ))}
    </div>
  );
};

export const IntegrationsEditor: React.FC<SectionEditorProps> = ({ spec, onPatch, readOnly }) => {
  const items: any[] = Array.isArray(spec?.integrations) ? spec.integrations : [];
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const put = (next: any[], summary: string) => onPatch({ integrations: next }, summary);

  return (
    <div className="space-y-2">
      {items.map((c, i) =>
        editingIdx === i ? (
          <InlineEditForm
            key={i}
            initialText={c.name}
            initialDetail={c.purpose}
            placeholder="Integration name"
            detailPlaceholder="Purpose"
            onSave={(t, d) => {
              const next = [...items];
              next[i] = { ...c, name: t, purpose: d };
              put(next, `edited integration "${t}"`);
              setEditingIdx(null);
            }}
            onCancel={() => setEditingIdx(null)}
          />
        ) : (
          <RowCard
            key={i}
            title={c.name || '(unnamed)'}
            detail={c.purpose || c.type}
            iconColor="#2563eb"
            onEdit={() => !readOnly && setEditingIdx(i)}
            onDelete={() => put(items.filter((_, idx) => idx !== i), `removed integration "${c.name}"`)}
          />
        )
      )}
      {!readOnly && (adding ? (
        <InlineEditForm
          placeholder="Integration name"
          detailPlaceholder="Purpose"
          onSave={(t, d) => {
            put([...items, { name: t, purpose: d, type: 'connector' }], `added integration "${t}"`);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <AddButton label="Add integration" onClick={() => setAdding(true)} />
      ))}
    </div>
  );
};

export const KnowledgeEditor: React.FC<SectionEditorProps> = ({ spec, onPatch, readOnly }) => {
  const items: any[] = Array.isArray(spec?.knowledge) ? spec.knowledge : [];
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const put = (next: any[], summary: string) => onPatch({ knowledge: next }, summary);

  return (
    <div className="space-y-2">
      {items.map((c, i) =>
        editingIdx === i ? (
          <InlineEditForm
            key={i}
            initialText={c.name}
            initialDetail={c.purpose}
            placeholder="Knowledge source name"
            detailPlaceholder="Purpose / scope"
            onSave={(t, d) => {
              const next = [...items];
              next[i] = { ...c, name: t, purpose: d };
              put(next, `edited knowledge "${t}"`);
              setEditingIdx(null);
            }}
            onCancel={() => setEditingIdx(null)}
          />
        ) : (
          <RowCard
            key={i}
            title={c.name || '(unnamed)'}
            detail={c.purpose || c.type}
            iconColor="#d97706"
            onEdit={() => !readOnly && setEditingIdx(i)}
            onDelete={() => put(items.filter((_, idx) => idx !== i), `removed knowledge "${c.name}"`)}
          />
        )
      )}
      {!readOnly && (adding ? (
        <InlineEditForm
          placeholder="Knowledge source name"
          detailPlaceholder="Purpose / scope"
          onSave={(t, d) => {
            put([...items, { name: t, purpose: d, type: 'SharePoint' }], `added knowledge "${t}"`);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <AddButton label="Add knowledge source" onClick={() => setAdding(true)} />
      ))}
    </div>
  );
};

export const TopicsEditor: React.FC<SectionEditorProps> = ({ spec, onPatch, readOnly }) => {
  const topics: any[] = Array.isArray(spec?.conversations?.topics) ? spec.conversations.topics : [];
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const put = (next: any[], summary: string) => onPatch({ conversations: { topics: next } }, summary);

  return (
    <div className="space-y-2">
      {topics.map((t, i) =>
        editingIdx === i ? (
          <InlineEditForm
            key={i}
            initialText={t.name}
            initialDetail={t.description}
            placeholder="Topic name"
            detailPlaceholder="Description"
            onSave={(name, d) => {
              const next = [...topics];
              next[i] = { ...t, name, description: d };
              put(next, `edited topic "${name}"`);
              setEditingIdx(null);
            }}
            onCancel={() => setEditingIdx(null)}
          />
        ) : (
          <RowCard
            key={i}
            title={t.name || '(unnamed)'}
            detail={t.description}
            iconColor="#7c3aed"
            onEdit={() => !readOnly && setEditingIdx(i)}
            onDelete={() => put(topics.filter((_, idx) => idx !== i), `removed topic "${t.name}"`)}
          />
        )
      )}
      {!readOnly && (adding ? (
        <InlineEditForm
          placeholder="Topic name"
          detailPlaceholder="Description"
          onSave={(name, d) => {
            put([...topics, { name, description: d, triggerType: 'phrase', triggerPhrases: [] }], `added topic "${name}"`);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <AddButton label="Add topic" onClick={() => setAdding(true)} />
      ))}
    </div>
  );
};

export const OpenQuestionsEditor: React.FC<SectionEditorProps> = ({ spec, onPatch, readOnly }) => {
  const items: any[] = Array.isArray(spec?.openQuestions) ? spec.openQuestions : [];
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const put = (next: any[], summary: string) => onPatch({ openQuestions: next }, summary);

  if (items.length === 0 && !adding) {
    return (
      <div>
        <div className="text-center py-4 text-gray-400">
          <CheckmarkCircle16Regular className="w-6 h-6 mx-auto mb-1 text-gray-300" />
          <p className="text-[12px]">No open questions.</p>
        </div>
        {!readOnly && <AddButton label="Add question" onClick={() => setAdding(true)} />}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((q, i) =>
        editingIdx === i ? (
          <InlineEditForm
            key={i}
            initialText={q.question}
            initialDetail={q.impact || q.context || ''}
            placeholder="Question"
            detailPlaceholder="Impact / context"
            onSave={(t, d) => {
              const next = [...items];
              next[i] = { ...q, question: t, impact: d };
              put(next, `edited question "${t}"`);
              setEditingIdx(null);
            }}
            onCancel={() => setEditingIdx(null)}
          />
        ) : (
          <RowCard
            key={i}
            title={q.question || '(empty)'}
            detail={q.impact || q.suggestedDefault}
            iconColor="#7c3aed"
            onEdit={() => !readOnly && setEditingIdx(i)}
            onDelete={() => put(items.filter((_, idx) => idx !== i), `removed question`)}
          />
        )
      )}
      {!readOnly && (adding ? (
        <InlineEditForm
          placeholder="Question"
          detailPlaceholder="Impact / context"
          onSave={(t, d) => {
            put([...items, { question: t, impact: d, source: 'user-added' }], `added question`);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <AddButton label="Add question" onClick={() => setAdding(true)} />
      ))}
    </div>
  );
};

// ── Decision card (read-only-ish: expand + choose option, no creation) ──────

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  confirmed: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Confirmed' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending' },
  overridden: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Overridden' },
};

const CONFIDENCE_DOTS: Record<string, { color: string; label: string }> = {
  high: { color: 'bg-emerald-400', label: 'High' },
  medium: { color: 'bg-amber-400', label: 'Medium' },
  low: { color: 'bg-red-400', label: 'Low' },
};

export const DecisionCard: React.FC<{
  decision: any;
  onConfirm: (optionId: string) => void;
  defaultExpanded?: boolean;
}> = ({ decision, onConfirm, defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const status = STATUS_COLORS[decision.status] || STATUS_COLORS.pending;
  const options = decision.options || [];
  const selectedId = decision.selectedOptionId || decision.recommendedOptionId;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-gray-50/50 transition-colors"
      >
        <div className="mt-0.5 text-gray-400">
          {expanded ? <ChevronDown20Regular className="w-4 h-4" /> : <ChevronRight20Regular className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[13px] font-semibold text-gray-900">{decision.title}</span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${status.bg} ${status.text}`}>{status.label}</span>
            {decision.category && <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{decision.category}</span>}
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">{decision.context}</p>
        </div>
      </button>
      {expanded && options.length > 0 && (
        <div className="border-t border-gray-100 px-3 pb-3 pt-2 space-y-2">
          {options.map((opt: any) => {
            const isSelected = opt.id === selectedId;
            const isRecommended = opt.id === decision.recommendedOptionId;
            const conf = CONFIDENCE_DOTS[opt.confidence] || CONFIDENCE_DOTS.medium;
            return (
              <div
                key={opt.id}
                className={`rounded-lg border p-2.5 transition-all ${isSelected ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.02)]' : 'border-gray-150 hover:border-gray-250'}`}
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onConfirm(opt.id)}
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]' : 'border-gray-300 hover:border-gray-400'}`}
                  >
                    {isSelected && <Checkmark20Regular className="w-2.5 h-2.5 text-white" />}
                  </button>
                  <span className={`text-[12px] font-medium ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>{opt.label}</span>
                  {isRecommended && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                      <Star16Filled className="w-2.5 h-2.5" /> Recommended
                    </span>
                  )}
                  <div className="flex items-center gap-1 ml-auto">
                    <span className={`w-1.5 h-1.5 rounded-full ${conf.color}`} />
                    <span className="text-[10px] text-gray-400">{conf.label}</span>
                  </div>
                </div>
                {opt.summary && <p className="text-[11px] text-gray-500 mt-1.5 ml-6">{opt.summary}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const DecisionsEditor: React.FC<SectionEditorProps> = ({ spec, onPatch, readOnly }) => {
  const items: any[] = Array.isArray(spec?.decisions) ? spec.decisions : [];
  if (items.length === 0) {
    return (
      <div className="text-center py-4 text-gray-400">
        <CheckmarkCircle16Regular className="w-6 h-6 mx-auto mb-1 text-gray-300" />
        <p className="text-[12px]">No decisions yet.</p>
        <p className="text-[10px] mt-0.5">Decisions appear when research surfaces trade-offs.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((d: any, i: number) => (
        <DecisionCard
          key={d.id || i}
          decision={d}
          onConfirm={(optionId) => {
            if (readOnly) return;
            const next = [...items];
            next[i] = {
              ...d,
              selectedOptionId: optionId,
              status: 'confirmed',
              resolvedAt: new Date().toISOString(),
              resolvedBy: 'user',
            };
            onPatch({ decisions: next }, `confirmed decision "${d.title}"`);
          }}
        />
      ))}
    </div>
  );
};

// ── Agent identity (small fields) ────────────────────────────────────────────

export const AgentIdentityEditor: React.FC<SectionEditorProps> = ({ spec, onPatch, readOnly }) => {
  const agent = spec?.agent || {};
  const [editing, setEditing] = useState(false);

  if (editing && !readOnly) {
    return (
      <InlineEditForm
        initialText={agent.name || ''}
        initialDetail={agent.description || ''}
        placeholder="Agent name"
        detailPlaceholder="Short description"
        onSave={(name, description) => {
          onPatch({ agent: { name, description } }, `renamed agent to "${name}"`);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="group flex items-start gap-2 p-3 rounded-xl border border-gray-100 hover:border-gray-200 bg-white">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-gray-900 truncate">{agent.name || 'Untitled agent'}</div>
        {agent.description && <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-3 leading-relaxed">{agent.description}</div>}
        {agent.primaryUsers && <div className="text-[11px] text-gray-400 mt-1">Users: {agent.primaryUsers}</div>}
      </div>
      {!readOnly && (
        <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-gray-100 text-gray-400">
          <Edit20Regular className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
