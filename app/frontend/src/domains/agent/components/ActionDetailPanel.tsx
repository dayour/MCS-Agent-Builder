import React, { useState } from 'react';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotTextarea } from '../../../components/ui/CopilotTextarea';
import {
  MoreHorizontal20Regular,
  ArrowLeft20Regular,
  ChevronDown16Regular,
  ChevronRight16Regular,
  Add16Regular,
  Person16Regular,
  Bookmark16Regular,
} from '@fluentui/react-icons';
import { ComponentItem } from '../../../utils/buildPageUtils';
import { getConnectorIcon } from '../../../utils/agentIcons';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActionDetailPanelProps {
  item: ComponentItem;
  onBack: () => void;
}

// ── Collapsible section card ──────────────────────────────────────────────────

interface AccordionCardProps {
  title: string;
  subtitle: string;
  subtitleLink?: string;
  defaultOpen?: boolean;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

const AccordionCard: React.FC<AccordionCardProps> = ({
  title,
  subtitle,
  subtitleLink,
  defaultOpen = true,
  headerAction,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
      {/* Header row */}
      <div
        role="button"
        tabIndex={0}
        className="w-full flex items-start justify-between px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer text-left"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(v => !v); } }}
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="mt-0.5 flex-shrink-0">
            {open
              ? <ChevronDown16Regular className="text-gray-500" />
              : <ChevronRight16Regular className="text-gray-500" />
            }
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              {subtitle}
              {subtitleLink && (
                <> <span className="text-brand-purple cursor-pointer hover:underline" onClick={e => e.stopPropagation()}>{subtitleLink}</span></>
              )}
            </p>
          </div>
        </div>
        {headerAction && (
          <div className="flex-shrink-0 ml-4 mt-0.5" onClick={e => e.stopPropagation()}>
            {headerAction}
          </div>
        )}
      </div>

      {/* Body */}
      {open && (
        <div className="border-t border-gray-100 px-5 py-5 bg-white">
          {children}
        </div>
      )}
    </div>
  );
};

// ── Section: Details ──────────────────────────────────────────────────────────

const DetailsSection: React.FC = () => {
  const [desc, setDesc] = useState('');

  return (
    <AccordionCard
      title="Details"
      subtitle="What it is, how it operates, and how the orchestrator identifies it."
      subtitleLink="Learn more"
    >
      {/* Description */}
      <div className="mb-5">
        <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-2">
          Description<span className="text-red-500">*</span>
        </label>
        <CopilotTextarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          maxLength={1024}
          rows={3}
          placeholder="Describe what this connector action does for the agent..."
          size="sm"
        />
        <p className="text-xs text-gray-400 text-right mt-1">{desc.length}/1024</p>
      </div>

      {/* Available to */}
      <div className="mb-1">
        <p className="text-sm font-semibold text-gray-900 mb-2">Available to</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 text-xs font-medium text-gray-700 bg-white">
            <Person16Regular className="w-3.5 h-3.5 text-gray-400" />
            Agent
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 text-xs font-medium text-gray-700 bg-white">
            <Bookmark16Regular className="w-3.5 h-3.5 text-gray-400" />
            3 topics
          </span>
        </div>
      </div>

      {/* Additional details */}
      <div className="mt-2.5">
        <CopilotButton
          variant="transparent"
          size="sm"
          icon={<ChevronRight16Regular className="text-gray-400" />}
          className="flex items-center gap-1.5 text-xs text-gray-500 px-0"
        >
          Additional details
        </CopilotButton>
      </div>
    </AccordionCard>
  );
};

// ── Section: Inputs ───────────────────────────────────────────────────────────

const InputsSection: React.FC = () => (
  <AccordionCard
    title="Inputs"
    subtitle="What the tool accepts in order to run. Inputs will be filled in the order shown."
    headerAction={
      <CopilotButton
        variant="transparent"
        size="sm"
        icon={<Add16Regular />}
        className="text-brand-purple"
      >
        Add input
      </CopilotButton>
    }
  >
    <p className="text-xs text-gray-400 italic">No inputs required for this action.</p>
  </AccordionCard>
);

// ── Section: Advanced ─────────────────────────────────────────────────────────

const AdvancedSection: React.FC = () => (
  <AccordionCard
    title="Advanced (optional)"
    subtitle="Specify what your agent does when it finishes using this tool."
    defaultOpen={false}
  >
    {/* collapsed by default — no body needed */}
    <></>
  </AccordionCard>
);

// ── Main component ────────────────────────────────────────────────────────────

export function ActionDetailPanel({
  item,
  onBack,
}: ActionDetailPanelProps) {
  const connectorIcon = getConnectorIcon(item.name.toLowerCase(), 'w-7 h-7')
    ?? (item.source ? getConnectorIcon(item.source.toLowerCase(), 'w-7 h-7') : null);

  return (
    <div className="absolute inset-0 bg-white z-10 flex flex-col overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="px-10 pt-4 pb-4 flex items-center gap-3 shrink-0">
        <CopilotButton
          variant="transparent"
          size="sm"
          icon={<ArrowLeft20Regular />}
          onClick={onBack}
          aria-label="Back"
          className="-ml-2"
        />
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
          {connectorIcon ?? (
            <span className="text-sm font-bold text-gray-500">
              {item.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-xl leading-7 text-[hsl(var(--text-primary))] truncate">{item.name}</p>
          <p className="text-xs text-[hsl(var(--text-secondary))] truncate">
            Connector · Action
          </p>
        </div>
        <CopilotButton
          variant="transparent"
          size="sm"
          icon={<MoreHorizontal20Regular />}
          onClick={() => {}}
          aria-label="More options"
        />
      </div>

      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1024px] w-full mx-auto px-7 py-6">
          <DetailsSection />
          <InputsSection />
          <AdvancedSection />
        </div>
      </div>
    </div>
  );
}
