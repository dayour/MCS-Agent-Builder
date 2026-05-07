import React, { useState } from 'react';
import { Dialog } from '../../../components/ui/Dialog';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { CopilotTextarea } from '../../../components/ui/CopilotTextarea';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { Skill } from '../../../types';

interface CreateSkillModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (skillData: Omit<Skill, 'id' | 'createdAt'>) => void;
  onBrowse?: () => void;
  agentId?: string;
}

export const CreateSkillModal: React.FC<CreateSkillModalProps> = ({ open, onClose, onSave, onBrowse, agentId }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState('');

  const NAME_MAX_LENGTH = 64;
  const nameError =
    name && name.length > NAME_MAX_LENGTH
      ? `${name.length}/${NAME_MAX_LENGTH} — too long`
      : name && !/^[a-z0-9-]+$/.test(name)
        ? 'Use lowercase letters, numbers, and hyphens only'
        : undefined;
  const descError = description.length > 200 ? `${description.length}/200 — too long` : undefined;
  const canSave = name.trim() && !nameError && description.trim() && !descError && body.trim();

  const handleSave = () => {
    if (!canSave) return;
    onSave({ name: name.trim(), description: description.trim(), body: body.trim(), agentId });
    setName('');
    setDescription('');
    setBody('');
    onClose();
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setBody('');
    onClose();
  };

  return (
    <Dialog isOpen={open} onClose={handleClose} maxWidth="xl">
      <div className="p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Create skill</h2>
          {onBrowse && (
            <CopilotButton variant="ghost" size="sm" onClick={onBrowse}>
              Browse skills
            </CopilotButton>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <CopilotInput
            size="md"
            placeholder="e.g. sprint-planner"
            value={name}
            onChange={e => setName(e.target.value.toLowerCase().replace(/\s/g, '-'))}
          />
          {nameError
            ? <p className="mt-1 text-xs text-red-500">{nameError}</p>
            : <p className="mt-1 text-xs text-gray-400">kebab-case only, max 64 chars</p>
          }
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <CopilotInput
            size="md"
            placeholder="What it does. Use when user asks to [trigger phrases]."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          {descError
            ? <p className="mt-1 text-xs text-red-500">{descError}</p>
            : <p className="mt-1 text-xs text-gray-400">{description.length}/200 — include what it does AND when to use it</p>
          }
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Instructions <span className="text-red-500">*</span>
          </label>
          <CopilotTextarea
            rows={8}
            placeholder={`# Skill Name\n\n## Instructions\n\n### Step 1: ...\nDescribe what to do.\n\n## Common Issues\n\n### Error handling\n...`}
            value={body}
            onChange={e => setBody(e.target.value)}
            className="font-mono"
          />
          <p className="mt-1 text-xs text-gray-400">Markdown instructions — use ## headers and • bullets</p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <CopilotButton variant="secondary" size="md" onClick={handleClose}>Cancel</CopilotButton>
          <CopilotButton variant="primary" size="md" onClick={handleSave} disabled={!canSave}>Create skill</CopilotButton>
        </div>
      </div>
    </Dialog>
  );
};
