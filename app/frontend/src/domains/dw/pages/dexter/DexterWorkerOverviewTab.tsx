import React, { useState, useRef } from 'react';
import { useAgent } from '../../../../context/AgentContext';
import {
  CopilotButton,
  CopilotInput,
  CopilotTextarea,
  CopilotDropdown,
  CopilotBadge,
  DeleteConfirmDialog,
  CopilotTooltip,
  CollapsibleSection,
} from '../../../../components/ui';
import {
  updateDexterWorker,
  deleteDexterWorker,
  type AuthFetchFn,
  type DexterWorkerDetail,
  type DexterWorkspaceSkill,
} from '../../services/dexterWorkerService';
import { isAuthDisabled } from '../../../../auth/authConfig';
import { type DexterWorkerProfile } from '../../hooks/useDexterWorkerProfile';
import { badgeColor, MODEL_OPTIONS, PROVIDER_OPTIONS, STATUS_OPTIONS } from './dexterUtils';
import { buildTier1Instructions, buildTier2Instructions } from '../../utils/dwGlobalInstructions';

// Extract the user-authored (Tier 2) portion from the full combined instructions stored on the worker.
// The combined format ends with: "# Role-Specific Instructions\n\n{userInstructions}"
function extractUserInstructions(full: string | null): string | null {
  if (!full) return null;
  const marker = '\n\n# Role-Specific Instructions\n\n';
  const idx = full.indexOf(marker);
  if (idx === -1) return null;
  return full.slice(idx + marker.length).trim() || null;
}

interface DexterWorkerOverviewTabProps {
  worker: DexterWorkerDetail;
  authFetch: AuthFetchFn;
  onWorkerUpdated: (worker: DexterWorkerDetail) => void;
  onWorkerDeleted: () => void;
  onNavigateToChat: () => void;
  /** Shared worker profile from context — provides Entra photo, email, and uploadPhoto. */
  dwProfile?: DexterWorkerProfile;
}

/** Copies text to clipboard and briefly shows "Copied!" feedback. */
function CopyableField({ value, mono }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).catch(() => { /* clipboard unavailable */ });
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <span className="inline-flex items-center gap-1.5 group">
      <span className={mono ? 'font-mono text-xs text-neutral-600' : ''}>{value}</span>
      <CopilotTooltip content={copied ? 'Copied!' : 'Copy'}>
        <CopilotButton
          variant="transparent"
          size="sm"
          onClick={handleCopy}
          aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
          className="opacity-0 group-hover:opacity-100 transition-opacity !p-0 !h-auto !min-h-0"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 4V1.5A1.5 1.5 0 015.5 0h9A1.5 1.5 0 0116 1.5v9a1.5 1.5 0 01-1.5 1.5H12v2.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 010 14.5v-9A1.5 1.5 0 011.5 4H4zm1 0h5.5A1.5 1.5 0 0112 5.5V11h2.5a.5.5 0 00.5-.5v-9a.5.5 0 00-.5-.5h-9a.5.5 0 00-.5.5V4zm-3.5 1a.5.5 0 00-.5.5v9a.5.5 0 00.5.5h9a.5.5 0 00.5-.5v-9a.5.5 0 00-.5-.5h-9z"/></svg>
        </CopilotButton>
      </CopilotTooltip>
    </span>
  );
}

function ProfileCard({ worker, onNavigateToChat, dwProfile }: {
  worker: DexterWorkerDetail;
  onNavigateToChat: () => void;
  dwProfile?: DexterWorkerProfile;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const initial = (worker.name || '?')[0].toUpperCase();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prefer Entra email from shared profile, fall back to worker.email
  const email = dwProfile?.email || worker.email;
  const photoUrl = dwProfile?.photoUrl ?? null;

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !dwProfile) return;
    setUploading(true);
    setUploadError(null);
    try {
      await dwProfile.uploadPhoto(file, file.type);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      setUploading(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canUploadPhoto = !!dwProfile?.worker?.agenticUserId && !isAuthDisabled;

  return (
    <div className="flex items-start gap-5 bg-white border border-neutral-200 rounded-xl p-5">
      {/* Avatar — clickable to upload new photo */}
      <div className="flex-shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={handlePhotoSelect}
        />
        <CopilotTooltip content={canUploadPhoto ? 'Click to change photo' : 'No agent user ID — cannot update photo'}>
          <div
            className={`relative group ${canUploadPhoto ? 'cursor-pointer' : ''}`}
            role={canUploadPhoto ? 'button' : undefined}
            tabIndex={canUploadPhoto ? 0 : undefined}
            onClick={() => canUploadPhoto && fileInputRef.current?.click()}
            onKeyDown={canUploadPhoto ? (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } } : undefined}
          >
            {photoUrl ? (
              <img src={photoUrl} alt={worker.name} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-semibold">
                {initial}
              </div>
            )}
            {/* Hover overlay */}
            {canUploadPhoto ? (
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading ? (
                  <span className="text-white text-xs animate-pulse">...</span>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="white"><path d="M4 15.5V17h12v-1.5H4zm5.5-12v8h1v-8h3L10 0 6.5 3.5h3z"/></svg>
                )}
              </div>
            ) : null}
          </div>
        </CopilotTooltip>
        {uploadError ? (
          <p className="text-xs text-red-500 mt-1 max-w-[80px] truncate" title={uploadError}>Upload failed</p>
        ) : null}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-lg font-semibold text-neutral-900 truncate">{worker.name}</h3>
        {email ? (
          <a href={`mailto:${email}`} className="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate block">
            {email}
          </a>
        ) : (
          <p className="text-sm text-neutral-400 italic">No email available</p>
        )}
        {/* Entra profile extras */}
        {(dwProfile?.jobTitle || dwProfile?.department) ? (
          <p className="text-xs text-neutral-500 mt-0.5">
            {[dwProfile.jobTitle, dwProfile.department].filter(Boolean).join(' · ')}
          </p>
        ) : null}
        <div className="flex items-center gap-2 mt-2">
          <CopilotBadge color={badgeColor(worker.status)}>{worker.status ?? 'unknown'}</CopilotBadge>
          <CopilotBadge color={badgeColor(worker.lifecycleStatus)}>{worker.lifecycleStatus ?? 'unknown'}</CopilotBadge>
          {worker.lifecycleError ? (
            <span className="text-xs text-red-600">{worker.lifecycleError}</span>
          ) : null}
        </div>
        {/* Metrics */}
        <div className="flex gap-6 mt-3 text-sm text-neutral-600">
          <div><span className="font-semibold text-neutral-900">{worker.tasksCompleted}</span> tasks completed</div>
          <div><span className="font-semibold text-neutral-900">{worker.successRate > 0 ? `${Math.round(worker.successRate)}%` : '—'}</span> success rate</div>
          <div><span className="font-semibold text-neutral-900">{worker.skillsCount}</span> skills</div>
        </div>
        {/* Quick actions */}
        <div className="flex gap-2 mt-3">
          <CopilotButton variant="outline" size="sm" onClick={onNavigateToChat}>
            Chat with worker
          </CopilotButton>
          <CopilotButton variant="outline" size="sm" onClick={() => window.open(`#/teams-chat/${worker.id}`, '_blank')}>
            Open in Teams
          </CopilotButton>
          {email ? (
            <CopilotButton variant="outline" size="sm" onClick={() => window.open(`mailto:${email}`, '_blank')}>
              Send email
            </CopilotButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function IdentitySection({ worker }: { worker: DexterWorkerDetail }) {
  const hasIdentity = worker.agenticAppId || worker.agenticUserId || worker.tenantId;
  if (!hasIdentity) {
    return (
      <div className="text-sm text-neutral-500">
        No Entra identity provisioned for this worker.
      </div>
    );
  }

  const entraUrl = worker.agenticAppId
    ? `https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/AgentIdentity.MenuView/~/overview/objectId/${worker.agenticAppId}/menuId/overview`
    : null;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-neutral-800">Entra Identity</h4>
        {entraUrl ? (
          <a
            href={entraUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            Open in Entra &rarr;
          </a>
        ) : null}
      </div>
      <div className="grid grid-cols-[160px_1fr] gap-y-2 gap-x-4 text-sm">
        {worker.tenantId ? (
          <>
            <span className="text-neutral-500 font-medium">Tenant ID</span>
            <CopyableField value={worker.tenantId} mono />
          </>
        ) : null}
        {worker.agenticAppId ? (
          <>
            <span className="text-neutral-500 font-medium">Agent Identity ID</span>
            <CopyableField value={worker.agenticAppId} mono />
          </>
        ) : null}
        {worker.agenticUserId ? (
          <>
            <span className="text-neutral-500 font-medium">Agent User ID</span>
            <CopyableField value={worker.agenticUserId} mono />
          </>
        ) : null}
      </div>
    </div>
  );
}

function SectionHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-sm font-semibold text-neutral-800">{children}</h4>
      {action ?? null}
    </div>
  );
}

/** Read-only display of a single skill. */
function SkillCard({ skill }: { skill: DexterWorkspaceSkill }) {
  return (
    <div className={`border rounded-lg p-4 ${skill.enabled ? 'border-neutral-200 bg-white' : 'border-neutral-100 bg-neutral-50 opacity-60'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="font-medium text-sm text-neutral-900">{skill.name || 'Unnamed skill'}</span>
        {!skill.enabled ? <CopilotBadge color="subtle" size="small">Disabled</CopilotBadge> : null}
        {skill.model ? <CopilotBadge color="informative" size="small">{skill.model}</CopilotBadge> : null}
      </div>
      {skill.description ? <p className="text-xs text-neutral-500 mb-2">{skill.description}</p> : null}
      {skill.instructions ? (
        <pre className="text-xs text-neutral-600 bg-neutral-50 rounded p-2 whitespace-pre-wrap overflow-x-auto max-h-32 mb-2">
          {skill.instructions}
        </pre>
      ) : null}
      <div className="flex gap-4 text-xs text-neutral-400">
        {skill.tools.length > 0 ? <span>{skill.tools.length} tool{skill.tools.length !== 1 ? 's' : ''}</span> : null}
        {skill.knowledge.length > 0 ? <span>{skill.knowledge.length} knowledge source{skill.knowledge.length !== 1 ? 's' : ''}</span> : null}
      </div>
      {skill.tools.length > 0 ? (
        <div className="flex flex-wrap gap-1 mt-2">
          {skill.tools.map((t, i) => (
            <CopilotBadge key={i} color="subtle" size="small">
              {t.type === 'http' ? (t.url || t.type) : t.type === 'stdio' ? (t.packageName || t.type) : (t.connectorName ?? t.type)}
            </CopilotBadge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Editable skill row in the edit form. */
function SkillEditor({
  skill,
  index,
  onChange,
  onRemove,
}: {
  skill: DexterWorkspaceSkill;
  index: number;
  onChange: (index: number, updated: DexterWorkspaceSkill) => void;
  onRemove: (index: number) => void;
}) {
  const update = (partial: Partial<DexterWorkspaceSkill>) => onChange(index, { ...skill, ...partial });
  return (
    <div className="border border-neutral-200 rounded-lg p-4 flex flex-col gap-3 bg-white">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-700">Skill {index + 1}</span>
        <CopilotButton
          variant="transparent"
          size="sm"
          className="text-red-500 hover:text-red-700"
          onClick={() => onRemove(index)}
        >
          Remove
        </CopilotButton>
      </div>
      <div className="flex gap-3">
        <label className="flex flex-col gap-1 flex-1">
          <span className="text-xs text-neutral-500">Name</span>
          <CopilotInput value={skill.name} onChange={e => update({ name: e.target.value })} size="sm" />
        </label>
        <label className="flex flex-col gap-1 w-24">
          <span className="text-xs text-neutral-500">Enabled</span>
          <CopilotDropdown
            options={[{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }]}
            value={String(skill.enabled)}
            onChange={v => update({ enabled: v === 'true' })}
            variant="dropdown"
            size="sm"
            fullWidth
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500">Description</span>
        <CopilotInput value={skill.description} onChange={e => update({ description: e.target.value })} size="sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500">Instructions</span>
        <CopilotTextarea value={skill.instructions} onChange={e => update({ instructions: e.target.value })} rows={3} />
      </label>
    </div>
  );
}

export function DexterWorkerOverviewTab({ worker, authFetch, onWorkerUpdated, onWorkerDeleted, onNavigateToChat, dwProfile }: DexterWorkerOverviewTabProps) {
  const { agents } = useAgent();
  const localAgent = agents.find(a => a.dexterWorkerId === worker.id);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(worker.name);
  const [description, setDescription] = useState(worker.description ?? '');
  const [instructions, setInstructions] = useState(worker.instructions ?? '');
  const [model, setModel] = useState(worker.model ?? 'claude-opus-4-7');
  const [provider, setProvider] = useState(worker.provider ?? 'claude');
  const [status, setStatus] = useState(worker.status ?? '');
  const [skills, setSkills] = useState<DexterWorkspaceSkill[]>(worker.skills);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleEdit = () => {
    setName(worker.name);
    setDescription(worker.description ?? '');
    setInstructions(worker.instructions ?? '');
    setModel(worker.model ?? 'claude-opus-4-7');
    setProvider(worker.provider ?? 'claude');
    setStatus(worker.status ?? '');
    setSkills(worker.skills.map(s => ({ ...s })));
    setEditing(true);
    setError(null);
  };

  const handleCancel = () => {
    setEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateDexterWorker(authFetch, worker.id, {
        name, description, instructions, model, provider, skills,
        ...(status ? { status } : {}),
      });
      onWorkerUpdated(updated);
      setEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update worker');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setShowDelete(false);
    setDeleting(true);
    setError(null);
    try {
      await deleteDexterWorker(authFetch, worker.id);
      onWorkerDeleted();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete worker');
      setDeleting(false);
    }
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-4 max-w-2xl">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-neutral-700">Name</span>
          <CopilotInput value={name} onChange={e => setName(e.target.value)} size="md" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-neutral-700">Description</span>
          <CopilotTextarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-neutral-700">Instructions</span>
          <CopilotTextarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={4} />
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
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-neutral-700">Status</span>
          <CopilotDropdown options={STATUS_OPTIONS} value={status} onChange={setStatus} variant="dropdown" size="md" />
        </label>

        {/* Skills editor */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-700">Skills ({skills.length})</span>
            <CopilotButton
              variant="outline"
              size="sm"
              onClick={() => setSkills(prev => [...prev, { name: '', description: '', instructions: '', tools: [], knowledge: [], enabled: true }])}
            >
              Add Skill
            </CopilotButton>
          </div>
          {skills.map((skill, i) => (
            <SkillEditor
              key={i}
              skill={skill}
              index={i}
              onChange={(idx, updated) => setSkills(prev => prev.map((s, j) => j === idx ? updated : s))}
              onRemove={(idx) => setSkills(prev => prev.filter((_, j) => j !== idx))}
            />
          ))}
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}
        <div className="flex gap-2">
          <CopilotButton variant="primary" size="md" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Saving...' : 'Save'}
          </CopilotButton>
          <CopilotButton variant="outline" size="md" onClick={handleCancel} disabled={saving}>
            Cancel
          </CopilotButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <DeleteConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete worker"
        message={`This will deprovision worker "${worker.name || worker.id}" and its underlying VM. This cannot be undone.`}
      />

      {/* Action buttons */}
      <div className="flex gap-2">
        <CopilotButton variant="outline" size="sm" onClick={handleEdit}>Edit</CopilotButton>
        <CopilotButton
          variant="outline"
          size="sm"
          className="text-red-600 border-red-300 hover:bg-red-50"
          onClick={() => setShowDelete(true)}
          disabled={deleting}
        >
          {deleting ? 'Deleting...' : 'Delete Worker'}
        </CopilotButton>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {/* Profile card */}
      <ProfileCard worker={worker} onNavigateToChat={onNavigateToChat} dwProfile={dwProfile} />

      {/* Entra identity */}
      <IdentitySection worker={worker} />

      {/* Configuration details */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5">
        <SectionHeader>Configuration</SectionHeader>
        <div className="grid grid-cols-[160px_1fr] gap-y-3 gap-x-4 text-sm">
          <span className="text-neutral-500 font-medium">Worker ID</span>
          <CopyableField value={worker.id} mono />

          <span className="text-neutral-500 font-medium">Model</span>
          <span>{worker.model || '—'}</span>

          <span className="text-neutral-500 font-medium">Provider</span>
          <span>{worker.provider || '—'}</span>

          <span className="text-neutral-500 font-medium">Created</span>
          <span>{worker.createdAt ? new Date(worker.createdAt).toLocaleString() : '—'}</span>

          <span className="text-neutral-500 font-medium">Updated</span>
          <span>{worker.updatedAt ? new Date(worker.updatedAt).toLocaleString() : '—'}</span>
        </div>
      </div>

      {/* Description */}
      {worker.description ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <SectionHeader>Description</SectionHeader>
          <p className="text-sm text-neutral-700 whitespace-pre-wrap">{worker.description}</p>
        </div>
      ) : null}

      {/* ── Custom Instructions (matches editable section on Expertise tab) ─── */}
      {(() => {
        const customInstructions = localAgent?.instructions || extractUserInstructions(worker.instructions);
        return (
          <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
            <CollapsibleSection title="Custom Instructions" defaultOpen={!!customInstructions}>
              {customInstructions ? (
                <pre className="text-xs text-neutral-700 bg-neutral-50 border-t border-neutral-200 p-4 whitespace-pre-wrap overflow-x-auto max-h-[320px] font-mono leading-relaxed">
                  {customInstructions}
                </pre>
              ) : (
                <p className="text-sm text-neutral-400 italic bg-neutral-50 border-t border-neutral-200 p-4">
                  No custom instructions configured.
                </p>
              )}
            </CollapsibleSection>
          </div>
        );
      })()}

      {/* ── Tier 1: Global instructions (read-only) ─── */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <CollapsibleSection title="Global Instructions (Tier 1)" defaultOpen={false}>
          <pre className="text-xs text-neutral-700 bg-neutral-50 border-t border-neutral-200 p-4 whitespace-pre-wrap overflow-x-auto max-h-[320px] font-mono leading-relaxed">
            {buildTier1Instructions()}
          </pre>
        </CollapsibleSection>
      </div>

      {/* ── Custom Instructions (Tier 2) — identity + role-specific instructions ─── */}
      {(() => {
        const userInstructions = localAgent?.instructions || extractUserInstructions(worker.instructions);
        return (
          <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
            <CollapsibleSection title="Custom Instructions (Tier 2)" defaultOpen={false}>
              <pre className="text-xs text-neutral-700 bg-neutral-50 border-t border-neutral-200 p-4 whitespace-pre-wrap overflow-x-auto max-h-[320px] font-mono leading-relaxed">
                {buildTier2Instructions(worker.name, undefined)}
              </pre>
            </CollapsibleSection>
          </div>
        );
      })()}

      {/* Skills */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5">
        <SectionHeader
          action={
            <span className="text-xs text-neutral-400">{worker.skills.length} skill{worker.skills.length !== 1 ? 's' : ''}</span>
          }
        >
          Skills
        </SectionHeader>
        {worker.skills.length > 0 ? (
          <div className="flex flex-col gap-3">
            {worker.skills.map((skill, i) => (
              <SkillCard key={i} skill={skill} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">No skills configured.</p>
        )}
      </div>
    </div>
  );
}
