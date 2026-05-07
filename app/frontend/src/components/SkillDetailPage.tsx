import React, { useState, useRef, useLayoutEffect } from 'react';
import {
  ChevronLeft20Regular,
  ChevronDown16Regular,
  ChevronRight16Regular,
  Code20Regular,
  Document20Regular,
  FlashRegular,
} from '@fluentui/react-icons';
import { CopilotButton } from './ui/CopilotButton';
import { CopilotInput } from './ui/CopilotInput';
import { CopilotTextarea } from './ui/CopilotTextarea';
import { DeleteConfirmDialog } from './ui/DeleteConfirmDialog';
import { Skill } from '../types';
import { useAgent } from '../context/AgentContext';

const DESCRIPTION_MAX = 200;

const textareaAutoResizeStyle: React.CSSProperties = { overflow: 'hidden', minHeight: 80, resize: 'none' };

interface SectionCardProps {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function SectionCard({ title, subtitle, children, defaultOpen = true }: SectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-neutral-200 rounded-3xl p-6 flex flex-col gap-3">
      <div>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-label={`${title} section`}
          className="flex items-center gap-2 w-full cursor-pointer select-none"
          onClick={() => setOpen(v => !v)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(v => !v); } }}
        >
          {open
            ? <ChevronDown16Regular className="w-4 h-4 text-neutral-500 flex-shrink-0" />
            : <ChevronRight16Regular className="w-4 h-4 text-neutral-500 flex-shrink-0" />
          }
          <span className="text-base font-bold text-neutral-900">{title}</span>
        </div>
        {subtitle && <p className="text-xs text-neutral-500 mt-1 ml-6">{subtitle}</p>}
      </div>
      {open && children}
    </div>
  );
}

interface SkillDetailPageProps {
  skill: Skill;
  onBack: () => void;
}

export const SkillDetailPage: React.FC<SkillDetailPageProps> = ({ skill, onBack }) => {
  const { updateSkill, deleteSkill } = useAgent();
  const [name, setName] = useState(skill.name);
  const [description, setDescription] = useState(skill.description);
  const [body, setBody] = useState(skill.body);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const isDirty = name !== skill.name || description !== skill.description || body !== skill.body;

  useLayoutEffect(() => {
    for (const ref of [descriptionRef, bodyRef]) {
      const el = ref.current;
      if (!el) continue;
      el.style.height = '0px';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [description, body]);

  const handleSave = () => {
    updateSkill(skill.id, { name, description, body });
    onBack();
  };

  const handleDelete = () => {
    deleteSkill(skill.id);
    onBack();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <CopilotButton
            variant="transparent"
            size="sm"
            icon={<ChevronLeft20Regular className="w-5 h-5" />}
            onClick={onBack}
            title="Back to skills"
          />
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
            <FlashRegular className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900 truncate">
            {name || 'New skill'}
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-6">
          <CopilotButton
            variant="transparent"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete
          </CopilotButton>
          <CopilotButton
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!isDirty}
          >
            Save
          </CopilotButton>
        </div>
      </div>

      {/* Details card */}
      <SectionCard
        title="Details"
        subtitle="The name and description used by the agent to identify and invoke this skill."
      >
        <div className="flex flex-col gap-3">
          <CopilotInput
            label="Name"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            size="md"
          />
          <div className="flex flex-col gap-1">
            <CopilotTextarea
              ref={descriptionRef}
              label="Description"
              required
              value={description}
              onChange={e => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
              size="md"
              style={textareaAutoResizeStyle}
            />
            <p className="text-xs text-neutral-400 text-right">
              {description.length}/{DESCRIPTION_MAX}
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Instructions card */}
      <SectionCard
        title="Instructions"
        subtitle={
          <>
            Markdown instructions passed to the agent when this skill is active.{' '}
            <a href="https://fluent2.microsoft.design" className="text-brand underline" target="_blank" rel="noreferrer">
              Learn more
            </a>
          </>
        }
      >
        <CopilotTextarea
          ref={bodyRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Write skill instructions in markdown..."
          style={textareaAutoResizeStyle}
        />
      </SectionCard>

      {/* Skill structure card */}
      <SectionCard
        title="Skill structure (advanced)"
        subtitle="Scripts and reference files available to this skill at runtime."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code20Regular className="w-4 h-4 text-neutral-500" />
                <span className="text-sm font-semibold text-neutral-900">Scripts</span>
              </div>
              <CopilotButton variant="transparent" size="xs" disabled>
                + Add script
              </CopilotButton>
            </div>
            <p className="text-xs text-neutral-400 italic ml-6">
              No scripts attached. Script support coming in a future release.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Document20Regular className="w-4 h-4 text-neutral-500" />
                <span className="text-sm font-semibold text-neutral-900">Reference files</span>
              </div>
              <CopilotButton variant="transparent" size="xs" disabled>
                + Add file
              </CopilotButton>
            </div>
            <p className="text-xs text-neutral-400 italic ml-6">
              No reference files attached. File support coming in a future release.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* itemType omitted intentionally — 'skill' is not in the union type; title+message override the defaults */}
      <DeleteConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        itemName={skill.name}
        title={`Delete "${skill.name}"?`}
        message="This skill will be permanently removed and can't be recovered."
      />
    </div>
  );
};
