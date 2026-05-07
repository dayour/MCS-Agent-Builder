import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogHeader, DialogContent, DialogTitle } from './ui/Dialog';
import { CopilotButton } from './ui/CopilotButton';
import { CopilotTextarea } from './ui/CopilotTextarea';
import type { PillInputHandle } from './ui/index';
import { Add16Regular } from '@fluentui/react-icons';
import { initials, avatarColor } from '../utils/avatarUtils';
import type { AgentVersionEntry } from '../types';

export interface VersionHistorySheetProps {
  isOpen: boolean;
  onClose: () => void;
  entries: AgentVersionEntry[];
  onRestore: (entryId: string) => void;
  onSaveMilestone?: (description?: string) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function TimelineDot({ isCurrent, isPublished }: { isCurrent: boolean; isPublished: boolean }) {
  const dotStyle = isPublished
    ? 'bg-[hsl(var(--primary))] border-[hsl(var(--primary))]'
    : isCurrent
      ? 'bg-gray-800 border-gray-800'
      : 'bg-white border-gray-400';
  return (
    <div
      className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 border-2 relative z-10 ${dotStyle}`}
      style={{ marginLeft: 4 }}
    />
  );
}

function VersionEntryRow({
  entry,
  isCurrent,
  isLive,
  isLast,
  onRestore,
}: {
  entry: AgentVersionEntry;
  isCurrent: boolean;
  isLive: boolean;
  isLast: boolean;
  onRestore: () => void;
}) {
  const isMilestone = entry.versionType === 'milestone';
  const versionLabel = isMilestone
    ? 'Milestone'
    : entry.versionType === 'draft-restored'
      ? 'Restored draft'
      : entry.versionType === 'draft'
        ? 'Draft checkpoint'
        : `v${entry.version}`;

  return (
    <div className="flex items-start gap-3 py-3 relative">
      {/* Connector above dot — runs from top of entry (through top padding) to dot center */}
      {!isCurrent && <div className="absolute left-[10px] top-0 h-[22px] w-px bg-gray-200 z-0" />}
      {/* Connector below dot — runs from dot center to bottom of entry (through bottom padding) */}
      {!isLast && <div className="absolute left-[10px] top-[22px] bottom-0 w-px bg-gray-200 z-0" />}

      <TimelineDot isCurrent={isCurrent} isPublished={entry.versionType === 'published'} />

      <div className="flex-1 min-w-0">
        {/* Row 1: version label + badges + restore button */}
        <div className="flex items-start gap-1 min-w-0">
          <span className={`text-subtitle-2 ${isCurrent ? 'text-gray-900' : 'text-gray-700'}`}>
            {versionLabel}
          </span>
          {isLive && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded">Live</span>
          )}
          {isCurrent && !isLive && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded">Current</span>
          )}
          <div className="flex-1" />
          {!isCurrent && (
            <CopilotButton
              variant="ghost"
              size="sm"
              className="text-xs text-indigo-600 hover:text-indigo-800 flex-shrink-0 px-2"
              onClick={onRestore}
            >
              Restore
            </CopilotButton>
          )}
        </div>

        {/* Row 2: avatar + name */}
        {entry.createdBy && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <div
              className={`${avatarColor(entry.createdBy)} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}
              style={{ width: 16, height: 16, fontSize: 7 }}
            >
              {initials(entry.createdBy)}
            </div>
            <span className="text-caption-1 text-gray-400">{entry.createdBy}</span>
          </div>
        )}

        {/* Row 3: timestamp */}
        <p className="text-caption-1 text-gray-400 mt-0.5">{formatDate(entry.createdAt)}</p>

        {/* Row 4: change notes */}
        {entry.changeNotes && (
          <p className="text-caption-1 text-gray-400 mt-0.5 leading-snug">
            {entry.changeNotes}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Save milestone inline form ───────────────────────────────────────────────

function SaveMilestoneForm({ onSave, onCancel }: { onSave: (desc?: string) => void; onCancel: () => void }) {
  const [description, setDescription] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | PillInputHandle>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el && 'focus' in el) (el as HTMLTextAreaElement).focus();
  }, []);

  return (
    <div className="mb-4 border border-[hsl(var(--stroke-default))] rounded-xl p-3 bg-[hsl(var(--surface-secondary))]">
      <p className="text-body-2-strong text-[hsl(var(--text-primary))] mb-2">New milestone</p>
      <CopilotTextarea
        ref={textareaRef}
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Add a description (optional)"
        size="sm"
        rows={2}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { onSave(description || undefined); }
          if (e.key === 'Escape') { onCancel(); }
        }}
      />
      <div className="flex items-center justify-end gap-2 mt-2">
        <CopilotButton
          variant="primary"
          size="sm"
          onClick={() => onSave(description || undefined)}
        >
          Save
        </CopilotButton>
        <CopilotButton variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </CopilotButton>
      </div>
    </div>
  );
}

// ─── Main sheet ───────────────────────────────────────────────────────────────

export function VersionHistorySheet({ isOpen, onClose, entries, onRestore, onSaveMilestone }: VersionHistorySheetProps) {
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);

  function handleSave(description?: string) {
    onSaveMilestone?.(description);
    setShowMilestoneForm(false);
  }

  // Reset form state when dialog closes
  useEffect(() => {
    if (!isOpen) setShowMilestoneForm(false);
  }, [isOpen]);

  const liveIndex = entries.findIndex(e => e.versionType === 'published');

  return (
    <Dialog isOpen={isOpen} onClose={onClose} maxWidth="lg" height="85vh">
      <DialogHeader onClose={onClose}>
        <DialogTitle>Version history</DialogTitle>
      </DialogHeader>
      <DialogContent>
        {/* Save milestone button / inline form — only shown when milestone feature is on */}
        {onSaveMilestone && (showMilestoneForm ? (
          <SaveMilestoneForm
            onSave={handleSave}
            onCancel={() => setShowMilestoneForm(false)}
          />
        ) : (
          <div className="mb-2">
            <CopilotButton
              variant="secondary"
              size="sm"
              onClick={() => setShowMilestoneForm(true)}
            >
              <Add16Regular className="mr-1.5" />
              Save milestone
            </CopilotButton>
          </div>
        ))}

        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center py-12">
            <p className="text-sm font-medium text-gray-900">No versions yet</p>
            <p className="text-sm text-gray-400 max-w-xs">
              Versions are saved automatically each time you publish this agent.
            </p>
          </div>
        ) : (
          entries.map((entry, index) => (
            <VersionEntryRow
              key={entry.id}
              entry={entry}
              isCurrent={index === 0}
              isLive={index === liveIndex}
              isLast={index === entries.length - 1}
              onRestore={() => onRestore(entry.id)}
            />
          ))
        )}
      </DialogContent>
    </Dialog>
  );
}
