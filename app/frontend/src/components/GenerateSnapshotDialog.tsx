import React, { useState } from 'react';
import { Warning20Regular } from '@fluentui/react-icons';
import {
  Dialog,
  CopilotButton,
  CopilotTextarea,
  CopilotDropdown,
  CopilotInput,
  CopilotBadge,
} from './ui';
import { useAgent } from '../context/AgentContext';
import { generateFullSnapshot, GeneratedSnapshotData } from '../utils/snapshotContentGenerator';
import { AgentSnapshot, SnapshotLifecycleStage } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const STAGE_OPTIONS: { value: SnapshotLifecycleStage; label: string }[] = [
  { value: 'day-zero',    label: 'Day Zero' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'published',   label: 'Published' },
  { value: 'bad-agent',   label: 'Bad Agent (misconfigured)' },
];

const STAGE_BADGE_COLOR: Record<SnapshotLifecycleStage, 'subtle' | 'warning' | 'success' | 'danger' | 'brand'> = {
  'day-zero':    'subtle',
  'in-progress': 'warning',
  'published':   'success',
  'bad-agent':   'danger',
  'custom':      'brand',
};

export const GenerateSnapshotDialog: React.FC<Props> = ({ isOpen, onClose }) => {
  const { addUserSnapshot } = useAgent();

  // Step 1 state
  const [description, setDescription] = useState('');
  const [stage, setStage] = useState<SnapshotLifecycleStage>('in-progress');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2 state
  const [generated, setGenerated] = useState<GeneratedSnapshotData | null>(null);
  const [snapshotName, setSnapshotName] = useState('');

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const data = await generateFullSnapshot(description.trim(), stage);
      setGenerated(data);
      setSnapshotName(data.agentConfig.name);
    } catch (err) {
      setError('Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!generated) return;
    const snapshot: AgentSnapshot = {
      id: `user-gen-${Date.now()}`,
      name: snapshotName.trim() || generated.agentConfig.name,
      description: generated.description,
      tags: generated.tags,
      lifecycleStage: generated.lifecycleStage,
      agentConfig: generated.agentConfig,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      helperMessages: generated.helperMessages,
      previewMessages: generated.previewMessages,
      monitoringData: generated.monitoringData,
      evaluations: generated.evaluations,
    };
    addUserSnapshot(snapshot);
    handleClose();
  };

  const handleBack = () => {
    setGenerated(null);
    setError(null);
  };

  const handleClose = () => {
    setDescription('');
    setStage('in-progress');
    setIsGenerating(false);
    setError(null);
    setGenerated(null);
    setSnapshotName('');
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} maxWidth="lg">
      <div className="p-6 flex flex-col gap-5">
        {/* Header */}
        <div>
          <h2 className="text-subtitle-1 font-semibold text-[var(--colorNeutralForeground1)]">
            Generate Snapshot with AI
          </h2>
          <p className="text-body-2 text-[var(--colorNeutralForeground2)] mt-1">
            {generated
              ? 'Review the generated snapshot, then save it to your collection.'
              : 'Describe an agent and pick a lifecycle stage — AI will build a complete snapshot.'}
          </p>
        </div>

        {/* Step 1 — Describe */}
        {!generated && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-body-2 font-medium text-[var(--colorNeutralForeground1)]">
                Agent description
              </label>
              <CopilotTextarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. IT helpdesk agent for employee ticket triage, day 5, partially configured"
                size="sm"
                rows={3}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-body-2 font-medium text-[var(--colorNeutralForeground1)]">
                Lifecycle stage
              </label>
              <CopilotDropdown
                variant="dropdown"
                size="sm"
                value={stage}
                onChange={val => setStage(val as SnapshotLifecycleStage)}
                options={STAGE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-body-2 text-[var(--colorStatusDangerForeground1)]">
                <Warning20Regular className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <CopilotButton variant="secondary" size="sm" onClick={handleClose}>
                Cancel
              </CopilotButton>
              <CopilotButton
                variant="primary"
                size="sm"
                onClick={handleGenerate}
                disabled={!description.trim() || isGenerating}
                loading={isGenerating}
              >
                {isGenerating ? 'Generating…' : 'Generate'}
              </CopilotButton>
            </div>
          </>
        )}

        {/* Step 2 — Review & Save */}
        {generated && (
          <>
            {/* Agent preview */}
            <div className="rounded-lg border border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground2)] p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {generated.agentConfig.icon && (
                  <span className="text-2xl leading-none">{generated.agentConfig.icon}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-body-1 font-semibold text-[var(--colorNeutralForeground1)] truncate">
                    {generated.agentConfig.name}
                  </p>
                  {generated.agentConfig.description && (
                    <p className="text-body-2 text-[var(--colorNeutralForeground2)] mt-0.5 line-clamp-2">
                      {generated.agentConfig.description}
                    </p>
                  )}
                </div>
                <CopilotBadge
                  appearance="tint"
                  color={STAGE_BADGE_COLOR[generated.lifecycleStage]}
                >
                  {STAGE_OPTIONS.find(o => o.value === generated.lifecycleStage)?.label ?? generated.lifecycleStage}
                </CopilotBadge>
              </div>

              <div className="text-caption text-[var(--colorNeutralForeground3)] flex gap-3 flex-wrap pt-1">
                {generated.helperMessages.length > 0 && (
                  <span>{generated.helperMessages.length} helper messages</span>
                )}
                {generated.previewMessages.length > 0 && (
                  <span>{generated.previewMessages.length} preview messages</span>
                )}
                {generated.evaluations.length > 0 && (
                  <span>{generated.evaluations.length} evaluation{generated.evaluations.length !== 1 ? 's' : ''}</span>
                )}
                {generated.monitoringData && (
                  <span>{generated.monitoringData.totalRuns} monitoring runs</span>
                )}
              </div>
            </div>

            {/* Snapshot name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-body-2 font-medium text-[var(--colorNeutralForeground1)]">
                Snapshot name
              </label>
              <CopilotInput
                value={snapshotName}
                onChange={e => setSnapshotName(e.target.value)}
                placeholder="Snapshot name"
                size="sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <CopilotButton variant="secondary" size="sm" onClick={handleBack}>
                Back
              </CopilotButton>
              <CopilotButton
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={!snapshotName.trim()}
              >
                Save Snapshot
              </CopilotButton>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
};
