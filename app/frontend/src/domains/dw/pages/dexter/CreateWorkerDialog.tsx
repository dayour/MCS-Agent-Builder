import React, { useState } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
  CopilotButton,
  CopilotInput,
  CopilotTextarea,
  CopilotDropdown,
  CopilotBadge,
} from '../../../../components/ui';
import {
  createDexterWorker,
  type AuthFetchFn,
  type DexterWorkspaceSkill,
  type DexterKnowledgeItem,
  type DexterToolConfig,
} from '../../services/dexterWorkerService';
import { MODEL_OPTIONS, PROVIDER_OPTIONS } from './dexterUtils';

const KNOWLEDGE_TYPE_OPTIONS = [
  { label: 'URI', value: 'uri' },
  { label: 'File', value: 'file' },
  { label: 'Database', value: 'database' },
];

const TOOL_TYPE_OPTIONS = [
  { label: 'MCP Server (HTTP)', value: 'http' },
  { label: 'Local Package (stdio)', value: 'stdio' },
  { label: 'Connector', value: 'connector' },
];

interface CreateWorkerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  authFetch: AuthFetchFn;
  onCreated: () => void;
}

function emptySkill(): DexterWorkspaceSkill {
  return { name: '', description: '', instructions: '', tools: [], knowledge: [], enabled: true };
}

function emptyKnowledge(): DexterKnowledgeItem {
  return { type: 'uri', value: '', name: '' };
}

function emptyTool(): DexterToolConfig {
  return { type: 'http' };
}

/** Inline editor for a single tool config. */
function ToolEditor({ tool, onChange, onRemove }: {
  tool: DexterToolConfig;
  onChange: (t: DexterToolConfig) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-2 bg-neutral-50 rounded p-2">
      <CopilotDropdown
        options={TOOL_TYPE_OPTIONS}
        value={tool.type}
        onChange={v => onChange({ ...tool, type: v })}
        variant="dropdown"
        size="sm"
      />
      {tool.type === 'http' ? (
        <CopilotInput
          value={tool.url ?? ''}
          onChange={e => onChange({ ...tool, url: e.target.value })}
          placeholder="https://mcp-server-url..."
          size="sm"
          className="flex-1"
        />
      ) : tool.type === 'stdio' ? (
        <CopilotInput
          value={tool.packageName ?? ''}
          onChange={e => onChange({ ...tool, packageName: e.target.value })}
          placeholder="Package name"
          size="sm"
          className="flex-1"
        />
      ) : (
        <CopilotInput
          value={tool.connectorName ?? ''}
          onChange={e => onChange({ ...tool, connectorName: e.target.value })}
          placeholder="Connector name"
          size="sm"
          className="flex-1"
        />
      )}
      <CopilotButton variant="transparent" size="sm" className="text-red-500 shrink-0" onClick={onRemove}>
        &times;
      </CopilotButton>
    </div>
  );
}

/** Inline editor for a single knowledge item. */
function KnowledgeEditor({ item, onChange, onRemove }: {
  item: DexterKnowledgeItem;
  onChange: (k: DexterKnowledgeItem) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-2 bg-neutral-50 rounded p-2">
      <CopilotDropdown
        options={KNOWLEDGE_TYPE_OPTIONS}
        value={item.type}
        onChange={v => onChange({ ...item, type: v })}
        variant="dropdown"
        size="sm"
      />
      <CopilotInput
        value={item.value}
        onChange={e => onChange({ ...item, value: e.target.value })}
        placeholder={item.type === 'uri' ? 'https://...' : item.type === 'file' ? '/path/to/file' : 'connection string'}
        size="sm"
        className="flex-1"
      />
      <CopilotInput
        value={item.name ?? ''}
        onChange={e => onChange({ ...item, name: e.target.value || undefined })}
        placeholder="Display name"
        size="sm"
        className="w-32"
      />
      <CopilotButton variant="transparent" size="sm" className="text-red-500 shrink-0" onClick={onRemove}>
        &times;
      </CopilotButton>
    </div>
  );
}

/** Inline editor for a single skill. */
function SkillBlock({ skill, onChange, onRemove }: {
  skill: DexterWorkspaceSkill;
  onChange: (s: DexterWorkspaceSkill) => void;
  onRemove: () => void;
}) {
  const updateTool = (i: number, t: DexterToolConfig) => onChange({ ...skill, tools: skill.tools.map((x, j) => j === i ? t : x) });
  const removeTool = (i: number) => onChange({ ...skill, tools: skill.tools.filter((_, j) => j !== i) });
  const updateKnowledge = (i: number, k: DexterKnowledgeItem) => onChange({ ...skill, knowledge: skill.knowledge.map((x, j) => j === i ? k : x) });
  const removeKnowledge = (i: number) => onChange({ ...skill, knowledge: skill.knowledge.filter((_, j) => j !== i) });

  return (
    <div className="border border-neutral-200 rounded-lg p-3 flex flex-col gap-2 bg-white">
      <div className="flex items-center justify-between">
        <CopilotBadge color="informative" size="small">Skill</CopilotBadge>
        <CopilotButton variant="transparent" size="sm" className="text-red-500" onClick={onRemove}>Remove</CopilotButton>
      </div>
      <div className="flex gap-2">
        <CopilotInput value={skill.name} onChange={e => onChange({ ...skill, name: e.target.value })} placeholder="Skill name" size="sm" className="flex-1" />
        <CopilotDropdown
          options={[{ label: 'Enabled', value: 'true' }, { label: 'Disabled', value: 'false' }]}
          value={String(skill.enabled)}
          onChange={v => onChange({ ...skill, enabled: v === 'true' })}
          variant="dropdown"
          size="sm"
        />
      </div>
      <CopilotInput value={skill.description} onChange={e => onChange({ ...skill, description: e.target.value })} placeholder="Description" size="sm" />
      <CopilotTextarea value={skill.instructions} onChange={e => onChange({ ...skill, instructions: e.target.value })} placeholder="Skill instructions..." rows={2} />
      {/* Skill model override */}
      <CopilotDropdown
        options={[{ label: 'Inherit from worker', value: '' }, ...MODEL_OPTIONS]}
        value={skill.model ?? ''}
        onChange={v => onChange({ ...skill, model: v || null })}
        variant="dropdown"
        size="sm"
        fullWidth
      />
      {/* Skill tools */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-500 font-medium">Tools ({skill.tools.length})</span>
          <CopilotButton variant="transparent" size="sm" onClick={() => onChange({ ...skill, tools: [...skill.tools, emptyTool()] })}>+ Add</CopilotButton>
        </div>
        {skill.tools.map((t, i) => (
          <ToolEditor key={i} tool={t} onChange={u => updateTool(i, u)} onRemove={() => removeTool(i)} />
        ))}
      </div>
      {/* Skill knowledge */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-500 font-medium">Knowledge ({skill.knowledge.length})</span>
          <CopilotButton variant="transparent" size="sm" onClick={() => onChange({ ...skill, knowledge: [...skill.knowledge, emptyKnowledge()] })}>+ Add</CopilotButton>
        </div>
        {skill.knowledge.map((k, i) => (
          <KnowledgeEditor key={i} item={k} onChange={u => updateKnowledge(i, u)} onRemove={() => removeKnowledge(i)} />
        ))}
      </div>
    </div>
  );
}

export function CreateWorkerDialog({ isOpen, onClose, authFetch, onCreated }: CreateWorkerDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [instructions, setInstructions] = useState('');
  const [model, setModel] = useState('claude-opus-4-7');
  const [provider, setProvider] = useState('claude');
  const [skills, setSkills] = useState<DexterWorkspaceSkill[]>([]);
  const [knowledge, setKnowledge] = useState<DexterKnowledgeItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setDescription('');
    setEmail('');
    setInstructions('');
    setModel('claude-opus-4-7');
    setProvider('claude');
    setSkills([]);
    setKnowledge([]);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createDexterWorker(authFetch, {
        name: name.trim(),
        description,
        instructions,
        model,
        provider,
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(skills.length > 0 ? { skills } : {}),
        ...(knowledge.length > 0 ? { knowledge } : {}),
      });
      resetForm();
      onCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create worker');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} maxWidth="lg">
      <DialogHeader onClose={handleClose}>
        <DialogTitle>Create Worker</DialogTitle>
      </DialogHeader>
      <DialogContent>
        <div className="flex flex-col gap-4">
          {/* Basic fields */}
          <div className="flex gap-4">
            <label className="flex flex-col gap-1 flex-1">
              <span className="text-sm font-medium text-neutral-700">Name *</span>
              <CopilotInput value={name} onChange={e => setName(e.target.value)} placeholder="Worker name" size="md" />
            </label>
            <label className="flex flex-col gap-1 flex-1">
              <span className="text-sm font-medium text-neutral-700">Email</span>
              <CopilotInput value={email} onChange={e => setEmail(e.target.value)} placeholder="worker@contoso.com" size="md" />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-neutral-700">Description</span>
            <CopilotTextarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this worker do?" rows={2} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-neutral-700">Instructions</span>
            <CopilotTextarea value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="System instructions for the worker..." rows={3} />
          </label>
          <div className="flex gap-4">
            <label className="flex flex-col gap-1 flex-1">
              <span className="text-sm font-medium text-neutral-700">Model</span>
              <CopilotDropdown options={MODEL_OPTIONS} value={model} onChange={setModel} variant="dropdown" size="md" fullWidth />
            </label>
            <label className="flex flex-col gap-1 flex-1">
              <span className="text-sm font-medium text-neutral-700">Provider</span>
              <CopilotDropdown options={PROVIDER_OPTIONS} value={provider} onChange={setProvider} variant="dropdown" size="md" fullWidth />
            </label>
          </div>

          {/* Skills */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-700">Skills ({skills.length})</span>
              <CopilotButton variant="outline" size="sm" onClick={() => setSkills(prev => [...prev, emptySkill()])}>Add Skill</CopilotButton>
            </div>
            {skills.map((s, i) => (
              <SkillBlock
                key={i}
                skill={s}
                onChange={u => setSkills(prev => prev.map((x, j) => j === i ? u : x))}
                onRemove={() => setSkills(prev => prev.filter((_, j) => j !== i))}
              />
            ))}
          </div>

          {/* Worker-level knowledge */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-700">Knowledge ({knowledge.length})</span>
              <CopilotButton variant="outline" size="sm" onClick={() => setKnowledge(prev => [...prev, emptyKnowledge()])}>Add Source</CopilotButton>
            </div>
            {knowledge.map((k, i) => (
              <KnowledgeEditor
                key={i}
                item={k}
                onChange={u => setKnowledge(prev => prev.map((x, j) => j === i ? u : x))}
                onRemove={() => setKnowledge(prev => prev.filter((_, j) => j !== i))}
              />
            ))}
          </div>

          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}
        </div>
      </DialogContent>
      <DialogFooter>
        <CopilotButton variant="outline" size="md" onClick={handleClose} disabled={saving}>
          Cancel
        </CopilotButton>
        <CopilotButton variant="primary" size="md" onClick={handleSubmit} disabled={saving || !name.trim()}>
          {saving ? 'Creating...' : 'Create Worker'}
        </CopilotButton>
      </DialogFooter>
    </Dialog>
  );
}
