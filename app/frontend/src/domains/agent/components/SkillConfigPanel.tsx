import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  BookStar20Regular,
  ChevronRight16Regular,
  ChevronDown16Regular,
  Add16Regular,
  Code16Regular,
  DocumentBulletList16Regular,
} from '@fluentui/react-icons';
import { Skill } from '../../../types';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { CopilotTextarea } from '../../../components/ui/CopilotTextarea';
import { SubHeader } from '../../../components/ui/SubHeader';
import { toSentenceCase } from '../../../utils/skillUtils';

export interface SkillConfigPanelProps {
  skill: Skill | null;
  visible: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Pick<Skill, 'name' | 'description' | 'body'>>) => void;
}

// ────────────────────────────────────────────────────────────
// Collapsible section card (mirrors PillConfigPanel pattern)
// ────────────────────────────────────────────────────────────
function SectionCard({
  title,
  subtitle,
  defaultOpen = false,
  required,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  required?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } }}
        className="w-full flex items-start gap-3 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer text-left"
        aria-expanded={open}
      >
        <div className="mt-0.5 flex-shrink-0">
          {open
            ? <ChevronDown16Regular className="text-gray-500" />
            : <ChevronRight16Regular className="text-gray-500" />
          }
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {title}{required && <span className="text-red-500 ml-0.5">*</span>}
          </p>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{subtitle}</p>}
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 px-5 py-5 bg-white">
          {children}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main export
// ────────────────────────────────────────────────────────────
export const SkillConfigPanel: React.FC<SkillConfigPanelProps> = ({
  skill,
  visible,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync local state when skill changes
  useEffect(() => {
    if (!skill) return;
    setName(skill.name);
    setDescription(skill.description);
    setBody(skill.body);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [skill?.id]);

  // Lock scroll on portal target while visible
  useEffect(() => {
    const target = document.getElementById('elevate-right-content');
    if (!target) return;
    if (visible) {
      target.scrollTop = 0;
      target.style.overflow = 'hidden';
    } else {
      target.style.overflow = '';
    }
    return () => { target.style.overflow = ''; };
  }, [visible]);

  if (!skill) return null;

  const portalTarget = document.getElementById('elevate-right-content') || document.getElementById('elevate-right-pane');
  if (!portalTarget) return null;

  const NAME_MAX = 64;
  const nameError = name && name.length > NAME_MAX
    ? `${name.length}/${NAME_MAX} — too long`
    : name && !/^[a-z0-9-]+$/.test(name)
      ? 'Use lowercase letters, numbers, and hyphens only'
      : undefined;
  const descError = description.length > 200 ? `${description.length}/200 — too long` : undefined;
  const isValid = name.trim() && !nameError && description.trim() && !descError && body.trim();

  const handleBack = () => {
    if (isValid) {
      onSave(skill.id, { name: name.trim(), description: description.trim(), body: body.trim() });
    }
    onClose();
  };

  const content = (
    <div
      className="absolute inset-0 z-50 bg-white flex flex-col overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(6px)',
        transition: 'opacity 180ms ease, transform 180ms ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <SubHeader
        title={toSentenceCase(skill.name)}
        subtitle="Skill"
        onBack={handleBack}
        className="px-7 pt-6 pb-4"
        noIconWrap
        icon={
          <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
            <BookStar20Regular style={{ width: 18, height: 18, color: '#7C3AED' }} />
          </div>
        }
      />

      {/* Scrollable body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="px-7 py-6">

          {/* Details */}
          <SectionCard
            title="Details"
            subtitle="The name and description used by the agent to identify and invoke this skill."
            defaultOpen={true}
          >
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                Name <span className="text-red-500">*</span>
              </label>
              <CopilotInput
                size="md"
                value={name}
                onChange={e => setName(e.target.value.toLowerCase().replace(/\s/g, '-'))}
              />
              {nameError
                ? <p className="mt-1 text-xs text-red-500">{nameError}</p>
                : <p className="mt-1 text-xs text-gray-400">kebab-case only, max 64 chars</p>
              }
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                Description <span className="text-red-500">*</span>
              </label>
              <CopilotInput
                size="md"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
              {descError
                ? <p className="mt-1 text-xs text-red-500">{descError}</p>
                : <p className="mt-1 text-xs text-gray-400">{description.length}/200</p>
              }
            </div>
          </SectionCard>

          {/* Instructions */}
          <SectionCard
            title="Instructions"
            subtitle="Markdown instructions passed to the agent when this skill is active."
            defaultOpen={true}
            required
          >
            <CopilotTextarea
              rows={16}
              value={body}
              onChange={e => setBody(e.target.value)}
              className="font-mono text-xs"
            />
          </SectionCard>

          {/* Advanced */}
          <SectionCard
            title="Advanced (optional)"
            subtitle="Scripts and reference files available to this skill at runtime."
            defaultOpen={false}
          >
            {/* Scripts */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Code16Regular className="text-gray-400 w-4 h-4" />
                  <p className="text-sm font-semibold text-gray-900">Scripts</p>
                </div>
                <CopilotButton
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1.5 text-brand-purple opacity-50 cursor-not-allowed"
                  disabled
                  aria-label="Add script — coming in a future release"
                >
                  <Add16Regular />
                  <span className="text-xs font-semibold">Add script</span>
                </CopilotButton>
              </div>
              <p className="text-xs text-gray-400 italic">
                No scripts attached. Script support coming in a future release.
              </p>
            </div>

            {/* Reference files */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <DocumentBulletList16Regular className="text-gray-400 w-4 h-4" />
                  <p className="text-sm font-semibold text-gray-900">Reference files</p>
                </div>
                <CopilotButton
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1.5 text-brand-purple opacity-50 cursor-not-allowed"
                  disabled
                  aria-label="Add reference file — coming in a future release"
                >
                  <Add16Regular />
                  <span className="text-xs font-semibold">Add file</span>
                </CopilotButton>
              </div>
              <p className="text-xs text-gray-400 italic">
                No reference files attached. File support coming in a future release.
              </p>
            </div>
          </SectionCard>

        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, portalTarget);
};
