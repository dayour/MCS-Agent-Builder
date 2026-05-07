/**
 * SnapshotEditor
 *
 * Full-canvas editor for AgentSnapshot content. Supports manual editing of all
 * snapshot fields plus per-section AI generation via generateSnapshotSection().
 *
 * Built-in snapshots: saving forks to a new local (user) snapshot.
 * User snapshots: saving updates in place.
 */

import React, { useState } from 'react';
import { AgentSnapshot, SnapshotLifecycleStage, Message, Evaluation, EvaluationQuestion, MonitoringData } from '../types';
import {
  CopilotButton,
  CopilotInput,
  CopilotTextarea,
  CopilotDropdown,
  CopilotCheckbox,
  CopilotToggle,
} from './ui';
import type { DropdownOption } from './ui/CopilotDropdown';
import {
  ArrowLeft20Regular,
  Add20Regular,
  Dismiss20Regular,
  Info20Regular,
} from '@fluentui/react-icons';
import { generateSnapshotSection, generateSnapshotNotes } from '../utils/snapshotContentGenerator';
import { TOGGLE_LABELS } from '../utils/toggleLabels';

// ── Static data ────────────────────────────────────────────────────────────────

const STAGE_OPTIONS: DropdownOption[] = [
  { value: 'day-zero',    label: 'Day Zero' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'published',   label: 'Published' },
  { value: 'bad-agent',   label: 'Bad Agent' },
  { value: 'custom',      label: 'Custom' },
];

const MODEL_OPTIONS: DropdownOption[] = [
  { value: 'opus-4.5',          label: 'Claude Opus 4.5' },
  { value: 'sonnet-4.5',        label: 'Claude Sonnet 4.5' },
  { value: 'haiku-4.5',         label: 'Claude Haiku 4.5' },
  { value: 'gpt-5.2-auto',      label: 'GPT Auto' },
  { value: 'gpt-5.2-instant',   label: 'GPT Instant' },
  { value: 'gpt-5.2-thinking',  label: 'GPT Thinking' },
];

const AUDIENCE_OPTIONS: DropdownOption[] = [
  { value: '',          label: '(none)' },
  { value: 'customers', label: 'Customers' },
  { value: 'employees', label: 'Employees' },
  { value: 'personal',  label: 'Personal' },
];

const RESULT_OPTIONS: DropdownOption[] = [
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
];

const ROLE_OPTIONS: DropdownOption[] = [
  { value: 'user',      label: 'User' },
  { value: 'assistant', label: 'Assistant' },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

interface AiGeneratePanelProps {
  placeholder?: string;
  onGenerate: (prompt: string) => Promise<void>;
  isGenerating: boolean;
  onCancel: () => void;
}

function AiGeneratePanel({ placeholder, onGenerate, isGenerating, onCancel }: AiGeneratePanelProps) {
  const [prompt, setPrompt] = useState('');
  return (
    <div className="mb-4 p-4 rounded-xl border border-[var(--colorBrandStroke2)] bg-[var(--colorBrandBackground2)] space-y-3">
      <p className="text-caption text-[var(--colorNeutralForeground2)]">✨ Describe what you want and AI will generate it for you</p>
      <CopilotTextarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder={placeholder ?? 'Describe what you want...'}
        size="sm"
        rows={2}
      />
      <div className="flex justify-end gap-2">
        <CopilotButton variant="secondary" size="sm" onClick={onCancel}>Cancel</CopilotButton>
        <CopilotButton
          variant="primary"
          size="sm"
          onClick={() => onGenerate(prompt)}
          disabled={isGenerating || !prompt.trim()}
        >
          {isGenerating ? 'Generating…' : 'Generate'}
        </CopilotButton>
      </div>
    </div>
  );
}

interface EditorSectionProps {
  title: string;
  aiPlaceholder?: string;
  onAiGenerate?: (prompt: string) => Promise<void>;
  generatingSection?: string | null;
  sectionKey?: string;
  children: React.ReactNode;
}

function EditorSection({ title, aiPlaceholder, onAiGenerate, generatingSection, sectionKey, children }: EditorSectionProps) {
  const [showAi, setShowAi] = useState(false);
  const isGenerating = generatingSection === sectionKey;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-[var(--colorNeutralForeground3)] uppercase tracking-wide">
          {title}
        </h3>
        {onAiGenerate && (
          <CopilotButton
            variant="ghost"
            size="sm"
            onClick={() => setShowAi(v => !v)}
          >
            ✨ Generate
          </CopilotButton>
        )}
      </div>
      {showAi && onAiGenerate && (
        <AiGeneratePanel
          placeholder={aiPlaceholder}
          isGenerating={isGenerating}
          onGenerate={async (prompt) => {
            await onAiGenerate(prompt);
            setShowAi(false);
          }}
          onCancel={() => setShowAi(false)}
        />
      )}
      {children}
    </div>
  );
}

interface StringListEditorProps {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}

function StringListEditor({ items, onChange, placeholder }: StringListEditorProps) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex-1">
            <CopilotInput
              value={item}
              onChange={e => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
              placeholder={placeholder}
              size="sm"
            />
          </div>
          <CopilotButton
            variant="transparent"
            size="sm"
            icon={<Dismiss20Regular />}
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <CopilotButton
        variant="ghost"
        size="sm"
        icon={<Add20Regular />}
        onClick={() => onChange([...items, ''])}
      >
        Add item
      </CopilotButton>
    </div>
  );
}

interface MessageListEditorProps {
  messages: Message[];
  onChange: (messages: Message[]) => void;
}

function MessageListEditor({ messages, onChange }: MessageListEditorProps) {
  const newMsg = (): Message => ({
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: 'user',
    content: '',
    timestamp: new Date(),
  });

  return (
    <div className="space-y-3">
      {messages.map((msg, i) => (
        <div key={msg.id} className="rounded-xl border border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground1)] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <CopilotDropdown
              options={ROLE_OPTIONS}
              value={msg.role}
              onChange={v => {
                const next = [...messages];
                next[i] = { ...msg, role: v as 'user' | 'assistant' };
                onChange(next);
              }}
              variant="form-field"
              size="sm"
            />
            <CopilotButton
              variant="transparent"
              size="sm"
              icon={<Dismiss20Regular />}
              onClick={() => onChange(messages.filter((_, j) => j !== i))}
            />
          </div>
          <CopilotTextarea
            value={msg.content}
            onChange={e => {
              const next = [...messages];
              next[i] = { ...msg, content: e.target.value };
              onChange(next);
            }}
            placeholder="Message content…"
            size="sm"
            rows={3}
          />
        </div>
      ))}
      <CopilotButton
        variant="ghost"
        size="sm"
        icon={<Add20Regular />}
        onClick={() => onChange([...messages, newMsg()])}
      >
        Add message
      </CopilotButton>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export interface SnapshotEditorProps {
  snapshot: AgentSnapshot;
  onSave: (snapshot: AgentSnapshot) => void;
  onCancel: () => void;
  saveLabel?: string;
}

export function SnapshotEditor({ snapshot, onSave, onCancel, saveLabel }: SnapshotEditorProps) {
  const [draft, setDraft] = useState<AgentSnapshot>(() => JSON.parse(JSON.stringify(snapshot, (_, v) => v instanceof Date ? v.toISOString() : v)) as AgentSnapshot);
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);
  const [generatingError, setGeneratingError] = useState<string | null>(null);

  const updateMeta = (updates: Partial<AgentSnapshot>) =>
    setDraft(d => ({ ...d, ...updates }));

  const updateConfig = (updates: Partial<AgentSnapshot['agentConfig']>) =>
    setDraft(d => ({ ...d, agentConfig: { ...d.agentConfig, ...updates } }));

  const aiGenerate = async (section: string, prompt: string) => {
    setGeneratingSection(section);
    setGeneratingError(null);
    try {
      if (section === 'notes') {
        const result = await generateSnapshotNotes(draft, prompt);
        updateMeta({ notes: result });
      } else {
        const result = await generateSnapshotSection(
          section as any,
          prompt,
          draft.agentConfig,
          draft.lifecycleStage,
        );
        switch (section) {
          case 'guidelines':
            updateConfig({ guidelines: result as string[] });
            break;
          case 'skills':
            updateConfig({ skills: result as string[] });
            break;
          case 'instructions':
            updateConfig({ instructions: result as string });
            break;
          case 'helperMessages':
            updateMeta({ helperMessages: result as Message[] });
            break;
          case 'previewMessages':
            updateMeta({ previewMessages: result as Message[] });
            break;
          case 'monitoringData':
            updateMeta({ monitoringData: result as MonitoringData });
            break;
          case 'evaluations':
            updateMeta({ evaluations: result as Evaluation[] });
            break;
        }
      }
    } catch (e) {
      setGeneratingError(`Generation failed. Please try again.`);
    } finally {
      setGeneratingSection(null);
    }
  };

  const cfg = draft.agentConfig;
  const toggleEntries = Object.entries(draft.toggleState ?? {});

  return (
    <div className="h-full flex flex-col">

      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-8 pt-5 pb-4 border-b border-[var(--colorNeutralStroke2)]">
        <div className="flex items-center gap-3">
          <CopilotButton variant="transparent" size="sm" icon={<ArrowLeft20Regular />} onClick={onCancel}>
            Back
          </CopilotButton>
          <span className="text-[var(--colorNeutralForeground4)]">/</span>
          <span className="text-body-1 font-semibold text-[var(--colorNeutralForeground1)]">{draft.name || 'Untitled Snapshot'}</span>
          <span className="text-body-2 text-[var(--colorNeutralForeground3)]">editing</span>
        </div>
        <div className="flex items-center gap-2">
          <CopilotButton variant="secondary" size="md" onClick={onCancel}>Cancel</CopilotButton>
          <CopilotButton variant="primary" size="md" onClick={() => onSave(draft)}>
            {saveLabel ?? (snapshot.isBuiltIn ? 'Save as local copy' : 'Save changes')}
          </CopilotButton>
        </div>
      </div>

      {/* Built-in info banner */}
      {snapshot.isBuiltIn && (
        <div className="shrink-0 flex items-start gap-3 px-8 py-3 bg-[var(--colorBrandBackground2)] border-b border-[var(--colorNeutralStroke2)]">
          <Info20Regular className="w-4 h-4 text-[var(--colorBrandForeground1)] shrink-0 mt-0.5" />
          <p className="text-body-2 text-[var(--colorNeutralForeground2)]">
            Built-in snapshots cannot be modified directly. Saving will create a new <strong>local copy</strong> in your browser.
            To update the built-in, use <strong>Download snapshot</strong> on the detail page and upload the <code className="text-caption font-mono bg-[var(--colorNeutralBackground3)] px-1 rounded">.json</code> file to <code className="text-caption font-mono bg-[var(--colorNeutralBackground3)] px-1 rounded">src/data/snapshots/</code> in the GitHub repo.
          </p>
        </div>
      )}

      {/* Error banner */}
      {generatingError && (
        <div className="shrink-0 flex items-center justify-between px-8 py-2 bg-[var(--colorStatusDangerBackground1)] border-b border-[var(--colorStatusDangerBorder1)]">
          <p className="text-caption text-[var(--colorStatusDangerForeground1)]">{generatingError}</p>
          <CopilotButton variant="transparent" size="sm" icon={<Dismiss20Regular />} onClick={() => setGeneratingError(null)} />
        </div>
      )}

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-3xl space-y-10">

          {/* ── Snapshot identity ─────────────────────────────────────── */}
          <EditorSection title="Snapshot identity">
            <div className="rounded-xl border border-[var(--colorNeutralStroke2)] overflow-hidden divide-y divide-[var(--colorNeutralStroke2)]">
              <div className="grid grid-cols-[160px_1fr] px-4 py-3 items-start gap-4">
                <span className="text-body-2 text-[var(--colorNeutralForeground3)] pt-2">Snapshot name</span>
                <CopilotInput
                  value={draft.name}
                  onChange={e => updateMeta({ name: e.target.value })}
                  placeholder="Snapshot name"
                  size="sm"
                />
              </div>
              <div className="grid grid-cols-[160px_1fr] px-4 py-3 items-start gap-4">
                <span className="text-body-2 text-[var(--colorNeutralForeground3)] pt-2">Description</span>
                <CopilotTextarea
                  value={draft.description}
                  onChange={e => updateMeta({ description: e.target.value })}
                  placeholder="What does this snapshot demonstrate?"
                  size="sm"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-[160px_1fr] px-4 py-3 items-center gap-4">
                <span className="text-body-2 text-[var(--colorNeutralForeground3)]">Lifecycle stage</span>
                <CopilotDropdown
                  options={STAGE_OPTIONS}
                  value={draft.lifecycleStage}
                  onChange={v => updateMeta({ lifecycleStage: v as SnapshotLifecycleStage })}
                  variant="form-field"
                  size="sm"
                  fullWidth
                />
              </div>
              <div className="grid grid-cols-[160px_1fr] px-4 py-3 items-center gap-4">
                <span className="text-body-2 text-[var(--colorNeutralForeground3)]">Agent variant</span>
                <div className="flex items-center gap-3">
                  <span className={`text-body-2 ${draft.agentVariant !== 'custom' ? 'font-medium text-[var(--colorNeutralForeground1)]' : 'text-[var(--colorNeutralForeground3)]'}`}>
                    Declarative
                  </span>
                  <CopilotToggle
                    checked={draft.agentVariant === 'custom'}
                    onChange={checked => updateMeta({ agentVariant: checked ? 'custom' : 'declarative' })}
                    aria-label="Agent variant"
                    size="sm"
                  />
                  <span className={`text-body-2 ${draft.agentVariant === 'custom' ? 'font-medium text-[var(--colorNeutralForeground1)]' : 'text-[var(--colorNeutralForeground3)]'}`}>
                    Custom
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-[160px_1fr] px-4 py-3 items-start gap-4">
                <span className="text-body-2 text-[var(--colorNeutralForeground3)] pt-2">Tags</span>
                <StringListEditor
                  items={draft.tags}
                  onChange={tags => updateMeta({ tags })}
                  placeholder="tag"
                />
              </div>
            </div>
          </EditorSection>

          {/* ── Notes ─────────────────────────────────────────────────── */}
          <EditorSection
            title="Notes"
            aiPlaceholder="Describe what to focus on, e.g. 'emphasise the toggle requirements' or leave blank to generate from the full config"
            onAiGenerate={prompt => aiGenerate('notes', prompt)}
            generatingSection={generatingSection}
            sectionKey="notes"
          >
            <CopilotTextarea
              value={draft.notes ?? ''}
              onChange={e => updateMeta({ notes: e.target.value })}
              placeholder="Describe the agent's current state and when to use this snapshot. This helps others decide if it suits their purpose."
              size="sm"
              rows={4}
            />
          </EditorSection>

          {/* ── Agent config ──────────────────────────────────────────── */}
          <EditorSection title="Agent configuration">
            <div className="rounded-xl border border-[var(--colorNeutralStroke2)] overflow-hidden divide-y divide-[var(--colorNeutralStroke2)]">
              <div className="grid grid-cols-[160px_1fr] px-4 py-3 items-start gap-4">
                <span className="text-body-2 text-[var(--colorNeutralForeground3)] pt-2">Agent name</span>
                <CopilotInput
                  value={cfg.name}
                  onChange={e => updateConfig({ name: e.target.value })}
                  placeholder="Agent name"
                  size="sm"
                />
              </div>
              <div className="grid grid-cols-[160px_1fr] px-4 py-3 items-start gap-4">
                <span className="text-body-2 text-[var(--colorNeutralForeground3)] pt-2">Description</span>
                <CopilotTextarea
                  value={cfg.description}
                  onChange={e => updateConfig({ description: e.target.value })}
                  placeholder="Agent description"
                  size="sm"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-[160px_1fr] px-4 py-3 items-start gap-4">
                <span className="text-body-2 text-[var(--colorNeutralForeground3)] pt-2">Purpose</span>
                <CopilotTextarea
                  value={cfg.purpose}
                  onChange={e => updateConfig({ purpose: e.target.value })}
                  placeholder="What does this agent do?"
                  size="sm"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-[160px_1fr] px-4 py-3 items-center gap-4">
                <span className="text-body-2 text-[var(--colorNeutralForeground3)]">Audience</span>
                <CopilotDropdown
                  options={AUDIENCE_OPTIONS}
                  value={cfg.audience ?? ''}
                  onChange={v => updateConfig({ audience: (v || null) as any })}
                  variant="form-field"
                  size="sm"
                  fullWidth
                />
              </div>
              <div className="grid grid-cols-[160px_1fr] px-4 py-3 items-center gap-4">
                <span className="text-body-2 text-[var(--colorNeutralForeground3)]">Model</span>
                <CopilotDropdown
                  options={MODEL_OPTIONS}
                  value={cfg.model}
                  onChange={v => updateConfig({ model: v as any })}
                  variant="form-field"
                  size="sm"
                  fullWidth
                />
              </div>
              <div className="grid grid-cols-[160px_1fr] px-4 py-3 items-center gap-4">
                <span className="text-body-2 text-[var(--colorNeutralForeground3)]">Published</span>
                <CopilotCheckbox
                  checked={cfg.published}
                  onChange={checked => updateConfig({ published: checked })}
                  label="Mark as published"
                />
              </div>
              <div className="grid grid-cols-[160px_1fr] px-4 py-3 items-center gap-4">
                <span className="text-body-2 text-[var(--colorNeutralForeground3)]">Version</span>
                <CopilotInput
                  value={cfg.version ?? ''}
                  onChange={e => updateConfig({ version: e.target.value || undefined })}
                  placeholder="e.g. 1.0"
                  size="sm"
                />
              </div>
            </div>
          </EditorSection>

          {/* ── Guidelines ────────────────────────────────────────────── */}
          <EditorSection
            title="Guidelines"
            sectionKey="guidelines"
            generatingSection={generatingSection}
            onAiGenerate={prompt => aiGenerate('guidelines', prompt)}
            aiPlaceholder="e.g. formal tone, always escalate billing issues, never promise refunds without confirmation"
          >
            <StringListEditor
              items={cfg.guidelines}
              onChange={guidelines => updateConfig({ guidelines })}
              placeholder="Guideline"
            />
          </EditorSection>

          {/* ── Instructions ─────────────────────────────────────────── */}
          <EditorSection
            title="Instructions"
            sectionKey="instructions"
            generatingSection={generatingSection}
            onAiGenerate={prompt => aiGenerate('instructions', prompt)}
            aiPlaceholder="e.g. customer support agent for e-commerce, handles returns and order status, polite tone"
          >
            <CopilotTextarea
              value={cfg.instructions}
              onChange={e => updateConfig({ instructions: e.target.value })}
              placeholder="Full agent instructions (markdown supported)"
              size="md"
              rows={12}
            />
          </EditorSection>

          {/* ── Skills ───────────────────────────────────────────────── */}
          <EditorSection
            title="Skills"
            sectionKey="skills"
            generatingSection={generatingSection}
            onAiGenerate={prompt => aiGenerate('skills', prompt)}
            aiPlaceholder="e.g. e-commerce customer support skills"
          >
            <StringListEditor
              items={cfg.skills}
              onChange={skills => updateConfig({ skills })}
              placeholder="Skill name"
            />
          </EditorSection>

          {/* ── Helper messages ───────────────────────────────────────── */}
          <EditorSection
            title="Helper messages"
            sectionKey="helperMessages"
            generatingSection={generatingSection}
            onAiGenerate={prompt => aiGenerate('helperMessages', prompt)}
            aiPlaceholder="e.g. user keeps changing requirements, show mid-build iteration"
          >
            <MessageListEditor
              messages={draft.helperMessages ?? []}
              onChange={helperMessages => updateMeta({ helperMessages })}
            />
          </EditorSection>

          {/* ── Preview messages ─────────────────────────────────────── */}
          <EditorSection
            title="Preview messages"
            sectionKey="previewMessages"
            generatingSection={generatingSection}
            onAiGenerate={prompt => aiGenerate('previewMessages', prompt)}
            aiPlaceholder="e.g. show a realistic order status lookup conversation"
          >
            <MessageListEditor
              messages={draft.previewMessages ?? []}
              onChange={previewMessages => updateMeta({ previewMessages })}
            />
          </EditorSection>

          {/* ── Monitoring data ───────────────────────────────────────── */}
          <EditorSection
            title="Monitoring data"
            sectionKey="monitoringData"
            generatingSection={generatingSection}
            onAiGenerate={prompt => aiGenerate('monitoringData', prompt)}
            aiPlaceholder="e.g. high volume published agent with great satisfaction scores"
          >
            <MonitoringEditor
              data={draft.monitoringData ?? null}
              onChange={monitoringData => updateMeta({ monitoringData: monitoringData ?? undefined })}
            />
          </EditorSection>

          {/* ── Evaluations ──────────────────────────────────────────── */}
          <EditorSection
            title="Evaluations"
            sectionKey="evaluations"
            generatingSection={generatingSection}
            onAiGenerate={prompt => aiGenerate('evaluations', prompt)}
            aiPlaceholder="e.g. include questions about escalation handling and tone"
          >
            <EvaluationEditor
              evaluations={draft.evaluations ?? []}
              onChange={evaluations => updateMeta({ evaluations })}
            />
          </EditorSection>

          {/* ── Toggle state ──────────────────────────────────────────── */}
          {toggleEntries.length > 0 && (
            <EditorSection title="Feature toggles">
              <div className="rounded-xl border border-[var(--colorNeutralStroke2)] overflow-hidden divide-y divide-[var(--colorNeutralStroke2)]">
                {toggleEntries.map(([id, value]) => (
                  <div key={id} className="grid grid-cols-[1fr_auto] px-4 py-3 items-center gap-4">
                    <span className="text-body-2 text-[var(--colorNeutralForeground1)]">
                      {TOGGLE_LABELS[id] ?? id}
                    </span>
                    {typeof value === 'boolean' ? (
                      <CopilotCheckbox
                        checked={value}
                        onChange={checked => updateMeta({
                          toggleState: { ...draft.toggleState, [id]: checked },
                        })}
                        label=""
                      />
                    ) : (
                      <CopilotInput
                        value={String(value)}
                        onChange={e => updateMeta({
                          toggleState: { ...draft.toggleState, [id]: e.target.value },
                        })}
                        size="sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            </EditorSection>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Monitoring editor sub-component ──────────────────────────────────────────

interface MonitoringEditorProps {
  data: MonitoringData | null;
  onChange: (data: MonitoringData | null) => void;
}

const DEFAULT_MONITORING: MonitoringData = {
  totalRuns: 0,
  failedRuns: 0,
  averageDuration: '0s',
  totalSessions: 0,
  engagement: 0,
  themes: [],
};

function MonitoringEditor({ data, onChange }: MonitoringEditorProps) {
  const d = data ?? DEFAULT_MONITORING;

  const update = (updates: Partial<MonitoringData>) => onChange({ ...d, ...updates });

  const updateTheme = (i: number, updates: Partial<MonitoringData['themes'][number]>) => {
    const themes = [...d.themes];
    themes[i] = { ...themes[i], ...updates };
    update({ themes });
  };

  const newTheme = () => ({
    name: '',
    totalQuestions: 0,
    answeredPercentage: 0,
    likes: 0,
    dislikes: 0,
  });

  if (!data) {
    return (
      <CopilotButton variant="ghost" size="sm" icon={<Add20Regular />} onClick={() => onChange(DEFAULT_MONITORING)}>
        Add monitoring data
      </CopilotButton>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--colorNeutralStroke2)] overflow-hidden divide-y divide-[var(--colorNeutralStroke2)]">
        {[
          { label: 'Total runs',      key: 'totalRuns',       type: 'number' },
          { label: 'Failed runs',     key: 'failedRuns',      type: 'number' },
          { label: 'Avg duration',    key: 'averageDuration', type: 'text' },
          { label: 'Total sessions',  key: 'totalSessions',   type: 'number' },
          { label: 'Engagement (%)',  key: 'engagement',      type: 'number' },
        ].map(({ label, key, type }) => (
          <div key={key} className="grid grid-cols-[160px_1fr] px-4 py-3 items-center gap-4">
            <span className="text-body-2 text-[var(--colorNeutralForeground3)]">{label}</span>
            <CopilotInput
              value={String((d as any)[key])}
              onChange={e => update({ [key]: type === 'number' ? Number(e.target.value) || 0 : e.target.value } as any)}
              size="sm"
              type={type === 'number' ? 'number' : 'text'}
            />
          </div>
        ))}
      </div>

      {/* Themes */}
      <div>
        <p className="text-caption text-[var(--colorNeutralForeground3)] mb-2">Themes</p>
        <div className="space-y-3">
          {d.themes.map((theme, i) => (
            <div key={i} className="rounded-xl border border-[var(--colorNeutralStroke2)] p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <CopilotInput
                  value={theme.name}
                  onChange={e => updateTheme(i, { name: e.target.value })}
                  placeholder="Theme name"
                  size="sm"
                />
                <CopilotButton
                  variant="transparent"
                  size="sm"
                  icon={<Dismiss20Regular />}
                  onClick={() => update({ themes: d.themes.filter((_, j) => j !== i) })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Questions', key: 'totalQuestions' },
                  { label: 'Answered %', key: 'answeredPercentage' },
                  { label: 'Likes', key: 'likes' },
                  { label: 'Dislikes', key: 'dislikes' },
                ].map(({ label, key }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-caption text-[var(--colorNeutralForeground3)] w-20 shrink-0">{label}</span>
                    <CopilotInput
                      value={String((theme as any)[key])}
                      onChange={e => updateTheme(i, { [key]: Number(e.target.value) || 0 } as any)}
                      size="sm"
                      type="number"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <CopilotButton variant="ghost" size="sm" icon={<Add20Regular />} onClick={() => update({ themes: [...d.themes, newTheme()] })}>
            Add theme
          </CopilotButton>
        </div>
      </div>

      <CopilotButton variant="ghost" size="sm" icon={<Dismiss20Regular />} onClick={() => onChange(null)}>
        Remove monitoring data
      </CopilotButton>
    </div>
  );
}

// ── Evaluation editor sub-component ──────────────────────────────────────────

interface EvaluationEditorProps {
  evaluations: Evaluation[];
  onChange: (evaluations: Evaluation[]) => void;
}

function EvaluationEditor({ evaluations, onChange }: EvaluationEditorProps) {
  const newEval = (): Evaluation => ({
    id: `eval-${Date.now()}`,
    name: 'New Evaluation',
    questions: [],
    score: 0,
    runDate: new Date(),
    duration: '0s',
  });

  const newQuestion = (): EvaluationQuestion => ({
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    question: '',
    expectedResponse: '',
    result: 'pass',
    actualResponse: '',
  });

  const updateEval = (i: number, updates: Partial<Evaluation>) => {
    const next = [...evaluations];
    next[i] = { ...next[i], ...updates };
    onChange(next);
  };

  const updateQuestion = (ei: number, qi: number, updates: Partial<EvaluationQuestion>) => {
    const nextEvals = [...evaluations];
    const questions = [...(nextEvals[ei].questions ?? [])];
    questions[qi] = { ...questions[qi], ...updates };
    nextEvals[ei] = { ...nextEvals[ei], questions };
    onChange(nextEvals);
  };

  if (evaluations.length === 0) {
    return (
      <CopilotButton variant="ghost" size="sm" icon={<Add20Regular />} onClick={() => onChange([newEval()])}>
        Add evaluation run
      </CopilotButton>
    );
  }

  return (
    <div className="space-y-6">
      {evaluations.map((ev, ei) => (
        <div key={ev.id} className="rounded-xl border border-[var(--colorNeutralStroke2)] overflow-hidden">
          {/* Eval metadata */}
          <div className="divide-y divide-[var(--colorNeutralStroke2)]">
            <div className="grid grid-cols-[160px_1fr] px-4 py-3 items-center gap-4">
              <span className="text-body-2 text-[var(--colorNeutralForeground3)]">Name</span>
              <CopilotInput
                value={ev.name}
                onChange={e => updateEval(ei, { name: e.target.value })}
                size="sm"
              />
            </div>
            <div className="grid grid-cols-[160px_1fr] px-4 py-3 items-center gap-4">
              <span className="text-body-2 text-[var(--colorNeutralForeground3)]">Score</span>
              <CopilotInput
                value={String(ev.score ?? 0)}
                onChange={e => updateEval(ei, { score: Number(e.target.value) || 0 })}
                size="sm"
                type="number"
              />
            </div>
            <div className="grid grid-cols-[160px_1fr] px-4 py-3 items-center gap-4">
              <span className="text-body-2 text-[var(--colorNeutralForeground3)]">Duration</span>
              <CopilotInput
                value={ev.duration ?? ''}
                onChange={e => updateEval(ei, { duration: e.target.value })}
                placeholder="e.g. 1m 23s"
                size="sm"
              />
            </div>
          </div>

          {/* Questions */}
          <div className="px-4 py-4 space-y-3 bg-[var(--colorNeutralBackground2)]">
            <p className="text-caption text-[var(--colorNeutralForeground3)]">Questions ({ev.questions?.length ?? 0})</p>
            {(ev.questions ?? []).map((q, qi) => (
              <div key={q.id} className="rounded-lg border border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground1)] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-2">
                    <CopilotInput
                      value={q.question}
                      onChange={e => updateQuestion(ei, qi, { question: e.target.value })}
                      placeholder="Question"
                      size="sm"
                    />
                    <CopilotInput
                      value={q.expectedResponse ?? ''}
                      onChange={e => updateQuestion(ei, qi, { expectedResponse: e.target.value })}
                      placeholder="Expected response"
                      size="sm"
                    />
                    <CopilotTextarea
                      value={q.actualResponse ?? ''}
                      onChange={e => updateQuestion(ei, qi, { actualResponse: e.target.value })}
                      placeholder="Actual response"
                      size="sm"
                      rows={2}
                    />
                  </div>
                  <CopilotButton
                    variant="transparent"
                    size="sm"
                    icon={<Dismiss20Regular />}
                    onClick={() => {
                      const questions = (ev.questions ?? []).filter((_, j) => j !== qi);
                      updateEval(ei, { questions });
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-caption text-[var(--colorNeutralForeground3)]">Result</span>
                  <CopilotDropdown
                    options={RESULT_OPTIONS}
                    value={q.result ?? 'pass'}
                    onChange={v => updateQuestion(ei, qi, { result: v as 'pass' | 'fail' })}
                    variant="form-field"
                    size="sm"
                  />
                </div>
              </div>
            ))}
            <CopilotButton
              variant="ghost"
              size="sm"
              icon={<Add20Regular />}
              onClick={() => {
                const questions = [...(ev.questions ?? []), newQuestion()];
                updateEval(ei, { questions });
              }}
            >
              Add question
            </CopilotButton>
          </div>

          {/* Remove eval */}
          <div className="px-4 py-3 border-t border-[var(--colorNeutralStroke2)]">
            <CopilotButton
              variant="ghost"
              size="sm"
              icon={<Dismiss20Regular />}
              onClick={() => onChange(evaluations.filter((_, j) => j !== ei))}
            >
              Remove evaluation
            </CopilotButton>
          </div>
        </div>
      ))}
      <CopilotButton variant="ghost" size="sm" icon={<Add20Regular />} onClick={() => onChange([...evaluations, newEval()])}>
        Add evaluation run
      </CopilotButton>
    </div>
  );
}
