import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  Add16Regular,
  ChevronRight16Regular,
  ChevronDown16Regular,
  Settings16Regular,
  Person16Regular,
  BookmarkMultiple16Regular,
  CheckmarkCircle16Filled,
  Link16Regular,
} from '@fluentui/react-icons';
import { PillConfig } from '../../types';
import { CopilotButton } from './CopilotButton';
import { CopilotTextarea } from './CopilotTextarea';
import { CopilotDropdown } from './CopilotDropdown';
import { CopilotCheckbox } from './CopilotCheckbox';
import { SubHeader } from './SubHeader';
import { resolveComponentIcon } from '../../utils/buildPageUtils';

export interface PillConfigPanelProps {
  pill: PillConfig | null;
  visible: boolean;
  inputs: Record<string, 'adaptive-ai' | 'custom' | null>;
  onInputChange: (inputName: string, mode: 'adaptive-ai' | 'custom') => void;
  onClose: () => void;
  /** Pre-filled description from the component descriptions registry. */
  initialDescription?: string;
}

// ────────────────────────────────────────────────────────────
// Collapsible section card
// ────────────────────────────────────────────────────────────
function SectionCard({
  title,
  subtitle,
  defaultOpen = false,
  headerRight,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  defaultOpen?: boolean;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } }}
        className="w-full flex items-start justify-between px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer text-left"
        aria-expanded={open}
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
            {subtitle && (
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{subtitle}</p>
            )}
          </div>
        </div>
        {headerRight && (
          <div className="flex-shrink-0 ml-4 mt-0.5" onClick={(e) => e.stopPropagation()}>
            {headerRight}
          </div>
        )}
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
// Inline additional-details expander
// ────────────────────────────────────────────────────────────
function AdditionalDetails({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2.5">
      <CopilotButton
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-gray-500 px-0"
      >
        {open ? <ChevronDown16Regular className="text-gray-400" /> : <ChevronRight16Regular className="text-gray-400" />}
        <span>Additional details</span>
      </CopilotButton>
      {open && <div className="mt-3 space-y-4 pl-5">{children}</div>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Adaptive AI / Custom segmented toggle
// ────────────────────────────────────────────────────────────
function InputModeToggle({
  value,
  onChange,
  inputName,
}: {
  value: 'adaptive-ai' | 'custom';
  onChange: (v: 'adaptive-ai' | 'custom') => void;
  inputName: string;
}) {
  return (
    <div className="flex items-stretch rounded-lg border border-gray-300 overflow-hidden flex-shrink-0 h-8" role="group" aria-label={`Input mode for ${inputName}`}>
      <CopilotButton
        variant="ghost"
        onClick={() => onChange('adaptive-ai')}
        className={`px-3 text-xs font-semibold rounded-none whitespace-nowrap border-0 h-full ${
          value === 'adaptive-ai' ? 'text-brand-purple' : 'text-gray-500'
        }`}
        aria-pressed={value === 'adaptive-ai'}
      >
        Adaptive AI
      </CopilotButton>
      <div className="w-px bg-gray-300 flex-shrink-0" aria-hidden="true" />
      <CopilotButton
        variant="ghost"
        onClick={() => onChange('custom')}
        className={`px-3 text-xs font-semibold rounded-none whitespace-nowrap border-0 h-full ${
          value === 'custom' ? 'text-brand-purple' : 'text-gray-500'
        }`}
        aria-pressed={value === 'custom'}
      >
        Custom
      </CopilotButton>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Resolve pill type label
// ────────────────────────────────────────────────────────────
function getPillTypeLabel(type: PillConfig['type']): string {
  switch (type) {
    case 'connector': return 'Connector';
    case 'knowledge': return 'Knowledge';
    case 'trigger': return 'Trigger';
    default: return 'Component';
  }
}

// ────────────────────────────────────────────────────────────
// Main export
// ────────────────────────────────────────────────────────────
export const PillConfigPanel: React.FC<PillConfigPanelProps> = ({
  pill,
  visible,
  inputs,
  onInputChange,
  onClose,
  initialDescription,
}) => {
  const [description, setDescription] = useState(initialDescription || '');
  const [allowDynamic, setAllowDynamic] = useState(true);
  const [askBefore, setAskBefore] = useState('No');
  const [authentication, setAuthentication] = useState('Yes (default)');
  const [afterRunning, setAfterRunning] = useState('Write the response with generative AI (default)');
  const [outputsScope, setOutputsScope] = useState('Specific');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  // Reset scroll and description when the active pill changes
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setDescription(initialDescription || '');
  }, [pill?.id, initialDescription]);

  // Lock scrolling on the portal target when the panel is visible and reset scroll position
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

  if (!pill) return null;

  // Portal into the content area below the global header so the header stays visible.
  // Falls back to the full right pane if the content target isn't available.
  const portalTarget = document.getElementById('elevate-right-content') || document.getElementById('elevate-right-pane');
  if (!portalTarget) return null;

  // Resolve icon using the same system as pills and component tiles.
  // Use fullName (with service prefix) when available for accurate icon matching.
  const iconName = pill.fullName || pill.label;
  const iconType = pill.type === 'connector' ? 'action' : pill.type;

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
        title={pill.label}
        subtitle={getPillTypeLabel(pill.type)}
        onBack={onClose}
        className="max-w-[1024px] w-full mx-auto px-7 pt-6 pb-4"
        icon={resolveComponentIcon(iconName, iconType, 'w-7 h-7') || <Settings16Regular className="w-7 h-7 text-gray-500" />}
        actions={
          <CopilotButton
            variant="outline"
            size="sm"
            className="flex items-center gap-2 flex-shrink-0"
            aria-label="Connection status: connected as Mona.Kane@contoso.com"
          >
            <Link16Regular className="text-gray-400 flex-shrink-0 w-4 h-4" />
            <span className="text-xs">Mona.Kane@contoso.com</span>
            <CheckmarkCircle16Filled className="text-green-500 flex-shrink-0 w-4 h-4" />
            <ChevronDown16Regular className="text-gray-400 flex-shrink-0 w-4 h-4" />
          </CopilotButton>
        }
      />

      {/* ── Scrollable body ──────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-[1024px] w-full mx-auto px-7 py-6">

          {/* ── Details — collapsed ─────────────────────────── */}
          <SectionCard
            title="Details"
            subtitle={<>What it is, how it operates, and how the orchestrator identifies it. <span className="text-brand-purple cursor-pointer hover:underline">Learn more</span></>}
            defaultOpen={true}
          >
            <div className="mb-5">
              <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-2">
                Description
                <span className="text-red-500">*</span>
              </label>
              <CopilotTextarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this connector action does for the agent..."
                rows={3}
              />
              <p className="text-xs text-gray-400 text-right mt-1">{description.length}/1024</p>
            </div>

            <div className="mb-1">
              <p className="text-sm font-semibold text-gray-900 mb-2">Available to</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 text-xs font-medium text-gray-700 bg-white">
                  <Person16Regular className="w-3.5 h-3.5 text-gray-400" />
                  Agent
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 text-xs font-medium text-gray-700 bg-white">
                  <BookmarkMultiple16Regular className="w-3.5 h-3.5 text-gray-400" />
                  3 topics
                </span>
              </div>
            </div>

            <AdditionalDetails>
              <CopilotCheckbox
                checked={allowDynamic}
                onChange={setAllowDynamic}
                label="Allow agent to decide dynamically when to use this tool"
                description="If unchecked, it can only be used when explicitly referenced by an agent or a topic"
              />

              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">Ask the user before running</p>
                <p className="text-xs text-gray-500 mb-2">
                  Recommended for sensitive or regulated domains or when making changes for the user
                </p>
                <CopilotDropdown
                  value={askBefore}
                  onChange={setAskBefore}
                  options={[{ value: 'No', label: 'No' }, { value: 'Yes', label: 'Yes' }]}
                />
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">Authentication</p>
                <p className="text-xs text-gray-500 mb-2">
                  Have end users sign in with their own credentials
                </p>
                <CopilotDropdown
                  value={authentication}
                  onChange={setAuthentication}
                  options={[{ value: 'Yes (default)', label: 'Yes (default)' }, { value: 'No', label: 'No' }]}
                />
              </div>
            </AdditionalDetails>
          </SectionCard>

          {/* ── Inputs — open by default ─────────────────────── */}
          <SectionCard
            title="Inputs"
            subtitle="What the tool accepts in order to run. Inputs will be filled in the order shown."
            defaultOpen={true}
            headerRight={
              <CopilotButton variant="ghost" size="sm" className="flex items-center gap-1.5 text-brand-purple">
                <Add16Regular />
                <span className="text-xs font-semibold">Add input</span>
              </CopilotButton>
            }
          >
            {pill.inputs.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No inputs required for this action.</p>
            ) : (
              <div className="space-y-5">
                {pill.inputs.map((input) => {
                  const mode = inputs[input.name] ?? 'adaptive-ai';
                  return (
                    <div key={input.name}>
                      <div className="flex items-start justify-between gap-6">
                        <div className="min-w-0 pt-0.5 flex-1">
                          <p className="text-sm font-semibold text-gray-900">
                            {input.name}
                            {input.required && <span className="text-red-500 ml-0.5">*</span>}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                            {mode === 'custom'
                              ? 'You will provide a custom value for this input'
                              : 'AI will fill this in for you, no action needed'}
                          </p>
                        </div>
                        <InputModeToggle
                          value={mode as 'adaptive-ai' | 'custom'}
                          onChange={(v) => onInputChange(input.name, v)}
                          inputName={input.name}
                        />
                      </div>
                      {mode === 'custom' && (
                        <div className="mt-2.5">
                          <CopilotTextarea
                            value={customValues[input.name] ?? ''}
                            onChange={(e) => setCustomValues(prev => ({ ...prev, [input.name]: e.target.value }))}
                            placeholder={`Enter a value for ${input.name}…`}
                            rows={2}
                          />
                        </div>
                      )}
                      <AdditionalDetails>
                        <p className="text-xs text-gray-500">
                          {input.description || 'No additional configuration required for this input.'}
                        </p>
                      </AdditionalDetails>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* ── Advanced — collapsed ─────────────────────────── */}
          <SectionCard
            title="Advanced (optional)"
            subtitle="Specify what your agent does when it finishes using this tool."
            defaultOpen={false}
          >
            <div className="mb-5">
              <p className="text-sm font-semibold text-gray-900 mb-2">After running:</p>
              <CopilotDropdown
                value={afterRunning}
                onChange={setAfterRunning}
                options={[
                  { value: 'Write the response with generative AI (default)', label: 'Write the response with generative AI (default)' },
                  { value: 'Return raw output', label: 'Return raw output' },
                  { value: 'Do nothing', label: 'Do nothing' },
                ]}
              />
            </div>

            <div className="mb-5">
              <p className="text-sm font-semibold text-gray-900 mb-2">
                Outputs available to the agent and other tools
              </p>
              <CopilotDropdown
                value={outputsScope}
                onChange={setOutputsScope}
                options={[
                  { value: 'Specific', label: 'Specific' },
                  { value: 'All', label: 'All' },
                  { value: 'None', label: 'None' },
                ]}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-900">Outputs</p>
                <CopilotButton variant="ghost" size="sm" className="flex items-center gap-1.5 text-brand-purple">
                  <Add16Regular />
                  <span className="text-xs font-semibold">Add output</span>
                </CopilotButton>
              </div>
              <div className="space-y-2">
                {['Response', 'Status'].map((output) => (
                  <div
                    key={output}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm text-gray-900">{output}</span>
                    <CopilotButton variant="ghost" size="sm" aria-label={`Configure ${output}`}>
                      <Settings16Regular className="w-4 h-4 text-gray-400" />
                    </CopilotButton>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

        </div>
      </div>


    </div>
  );

  return ReactDOM.createPortal(content, portalTarget);
};

export default PillConfigPanel;
