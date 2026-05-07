import { useState } from 'react';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { CopilotTextarea } from '../../../components/ui/CopilotTextarea';
import { CopilotDropdown } from '../../../components/ui/CopilotDropdown';
import {
  ArrowLeft20Regular,
  Dismiss20Regular,
  ChevronDown16Regular,
  ChevronRight16Regular,
  Info16Regular,
} from '@fluentui/react-icons';
import { ComponentItem, getTriggerChannel, getTriggerTypeLabel, TRIGGER_PANEL_TITLES, CHANNEL_ICON_PATHS, CHANNEL_DISPLAY_NAMES } from '../../../utils/buildPageUtils';
import { ConnectionBadge } from './ConnectionBadge';
import { useAgent } from '../../../context/AgentContext';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../../../components/ui/Dialog';



const DETAILS_DESCRIPTION: Record<string, string> = {
  outlook:    'When a new email arrives in Outlook serves as the event trigger for initiating the agent\'s workflow based on the defined instructions.',
  sharepoint: 'When an item is created in SharePoint serves as the event trigger for initiating the agent\'s workflow based on the defined instructions.',
  onedrive:   'When a file changes in OneDrive serves as the event trigger for initiating the agent\'s workflow based on the defined instructions.',
  forms:      'When a form response is submitted serves as the event trigger for initiating the agent\'s workflow based on the defined instructions.',
  dataverse:  'When a Dataverse record changes serves as the event trigger for initiating the agent\'s workflow based on the defined instructions.',
  planner:    'When a Planner task is completed serves as the event trigger for initiating the agent\'s workflow based on the defined instructions.',
  recurrence: 'On a recurring schedule, the agent\'s workflow is initiated based on the defined instructions.',
};

const TRIGGER_OPTIONS_SUBHEAD: Record<string, string> = {
  outlook:    'These options alert the trigger that it\'s time to run. You can configure them here, or they can be added or changed by users.',
  sharepoint: 'These options specify the SharePoint site and list to monitor. You can configure them here, or they can be added or changed by users.',
  onedrive:   'These options specify the OneDrive folder to monitor. You can configure them here, or they can be added or changed by users.',
  forms:      'These options specify the form to monitor for responses. You can configure them here, or they can be added or changed by users.',
  dataverse:  'These options specify the Dataverse table and environment to monitor. You can configure them here, or they can be added or changed by users.',
  planner:    'These options specify the Planner plan and group to monitor. You can configure them here, or they can be added or changed by users.',
  recurrence: 'These options control how often the trigger fires. You can configure them here, or they can be added or changed by users.',
};

const ADVANCED_DESCRIPTION = 'This message is sent to the agent when the trigger activates, providing it with the necessary instructions.';

// ── Trigger field config ────────────────────────────────────────────────────

type FieldMode = 'adaptive-ai' | 'custom';

interface TriggerFieldConfig {
  id: string;
  label: string;
  /** Text input placeholder when mode = 'custom'. */
  placeholder?: string;
  /** Dropdown options when mode = 'custom'. Takes precedence over placeholder. */
  customOptions?: { value: string; label: string }[];
  /** Whether to show the Editable by dropdown alongside the input */
  showEditableDropdown?: boolean;
  defaultMode: FieldMode;
}

const FOLDER_OPTIONS = [
  { value: 'inbox',   label: 'Inbox' },
  { value: 'deleted', label: 'Deleted' },
  { value: 'drafts',  label: 'Drafts' },
  { value: 'archive', label: 'Archive' },
  { value: 'sent',    label: 'Sent' },
];

const IMPORTANCE_OPTIONS = [
  { value: 'any',    label: 'Any' },
  { value: 'low',    label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high',   label: 'High' },
];

const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no',  label: 'No' },
];

const NO_YES_OPTIONS = [
  { value: 'no',  label: 'No' },
  { value: 'yes', label: 'Yes' },
];

const TRIGGER_FIELDS: Record<string, TriggerFieldConfig[]> = {
  outlook: [
    { id: 'to',                   label: 'To',                    placeholder: 'Recipient email addresses',              showEditableDropdown: true,  defaultMode: 'custom' },
    { id: 'cc',                   label: 'CC',                    placeholder: 'CC recipients email addresses',          showEditableDropdown: true,  defaultMode: 'custom' },
    { id: 'toOrCc',               label: 'To or CC',              placeholder: 'To or CC recipients email addresses',    showEditableDropdown: true,  defaultMode: 'custom' },
    { id: 'from',                 label: 'From',                  placeholder: 'Sender email addresses',                 showEditableDropdown: true,  defaultMode: 'custom' },
    { id: 'includeAttachments',   label: 'Include attachments',   customOptions: YES_NO_OPTIONS,                         showEditableDropdown: false, defaultMode: 'adaptive-ai' },
    { id: 'subjectFilter',        label: 'Subject filter',        placeholder: 'Text to look for in the subject line',  showEditableDropdown: false, defaultMode: 'adaptive-ai' },
    { id: 'folder',               label: 'Folder',                customOptions: FOLDER_OPTIONS,                         showEditableDropdown: false, defaultMode: 'adaptive-ai' },
    { id: 'importance',           label: 'Importance',            customOptions: IMPORTANCE_OPTIONS,                     showEditableDropdown: false, defaultMode: 'adaptive-ai' },
    { id: 'onlyWithAttachments',  label: 'Only with attachments', customOptions: NO_YES_OPTIONS,                         showEditableDropdown: false, defaultMode: 'adaptive-ai' },
  ],
  sharepoint: [
    { id: 'siteAddress', label: 'Site Address',    placeholder: 'Enter SharePoint site URL',  showEditableDropdown: true, defaultMode: 'custom' },
    { id: 'listName',    label: 'List or library', placeholder: 'Enter list or library name', showEditableDropdown: true, defaultMode: 'custom' },
  ],
  onedrive: [
    { id: 'folder', label: 'Folder', placeholder: 'Enter folder path', showEditableDropdown: true, defaultMode: 'custom' },
  ],
  forms: [
    { id: 'formId', label: 'Form ID', placeholder: 'Select a form', showEditableDropdown: true, defaultMode: 'custom' },
  ],
  dataverse: [
    { id: 'environment', label: 'Environment', placeholder: 'Select environment', showEditableDropdown: true, defaultMode: 'custom' },
    { id: 'tableName',   label: 'Table name',   placeholder: 'Enter table name',  showEditableDropdown: true, defaultMode: 'custom' },
  ],
  planner: [
    { id: 'groupId', label: 'Group ID', placeholder: 'Select a group', showEditableDropdown: true, defaultMode: 'custom' },
    { id: 'planId',  label: 'Plan ID',  placeholder: 'Select a plan',  showEditableDropdown: true, defaultMode: 'custom' },
  ],
  recurrence: [
    { id: 'frequency', label: 'Frequency', placeholder: 'e.g. Day, Week, Month', showEditableDropdown: false, defaultMode: 'custom' },
    { id: 'interval',  label: 'Interval',  placeholder: 'e.g. 1',                showEditableDropdown: false, defaultMode: 'custom' },
    { id: 'startTime', label: 'Start time', placeholder: 'e.g. 9:00 AM',        showEditableDropdown: false, defaultMode: 'custom' },
  ],
};

const EDITABLE_BY_OPTIONS = [
  { value: 'creator-only', label: 'Creator only' },
  { value: 'end-users',    label: 'End users' },
];

const AUTH_OPTIONS = [
  { value: 'end-user',  label: 'Use end user sign in' },
  { value: 'connector', label: 'Use connector connection' },
];

const BODY_MESSAGE_MAX = 5000;
const BODY_MESSAGE_DEFAULT = '@{triggerBody()}';

// ── Component ────────────────────────────────────────────────────────────────

export interface EventTriggerDetailPanelProps {
  trigger: ComponentItem;
  onBack: () => void;
  onClose: () => void;
}

interface FieldState {
  mode: FieldMode;
  value: string;
  editability: string;
}

export function EventTriggerDetailPanel({
  trigger,
  onBack,
  onClose,
}: EventTriggerDetailPanelProps) {
  const { removeTriggerFromInstructions, softDeleteTrigger, restoreTrigger, agentConfig } = useAgent();
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const channel =
    getTriggerChannel(trigger.name) ??
    getTriggerChannel(trigger.source) ??
    null;

  const fields = (channel ? TRIGGER_FIELDS[channel] : null) ?? [];

  // Card open/close state
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [triggerOptionsOpen, setTriggerOptionsOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Details card state
  const [authMode, setAuthMode] = useState('end-user');

  // Advanced configuration state
  const [bodyMessage, setBodyMessage] = useState(BODY_MESSAGE_DEFAULT);

  // Trigger option field states
  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>(() => {
    const init: Record<string, FieldState> = {};
    fields.forEach(f => {
      init[f.id] = { mode: f.defaultMode, value: f.customOptions ? f.customOptions[0].value : '', editability: 'creator-only' };
    });
    return init;
  });

  const setFieldMode = (id: string, mode: FieldMode) =>
    setFieldStates(prev => ({ ...prev, [id]: { ...prev[id], mode } }));

  const setFieldValue = (id: string, value: string) =>
    setFieldStates(prev => ({ ...prev, [id]: { ...prev[id], value } }));

  const setFieldEditability = (id: string, editability: string) =>
    setFieldStates(prev => ({ ...prev, [id]: { ...prev[id], editability } }));

  const isSoftDeleted = agentConfig.softDeletedTriggers?.includes(trigger.name) ?? false;
  const normalizeChannel = (k: string) => k === 'm365' ? 'microsoft 365' : k;
  const isTriggerLive = !!agentConfig.published && !!agentConfig.publishedTriggers?.some(
    t => channel && normalizeChannel(t.iconKey) === channel
  );

  const iconPath = channel ? CHANNEL_ICON_PATHS[channel] : null;
  const channelDisplayName = channel ? (CHANNEL_DISPLAY_NAMES[channel] ?? trigger.source) : trigger.source;
  const panelTitle = channel ? (TRIGGER_PANEL_TITLES[channel] ?? trigger.name) : trigger.name;
  const detailsText = channel ? DETAILS_DESCRIPTION[channel] ?? '' : '';
  const triggerOptionsSubhead = channel ? TRIGGER_OPTIONS_SUBHEAD[channel] ?? '' : '';
  const advancedDescription = ADVANCED_DESCRIPTION;

  return (
    <div className="absolute inset-0 bg-white z-10 flex flex-col overflow-hidden">

      {/* Top navigation */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
        <CopilotButton
          variant="transparent"
          size="sm"
          icon={<ArrowLeft20Regular />}
          onClick={onBack}
        >
          Back to components
        </CopilotButton>
        <CopilotButton
          variant="transparent"
          size="sm"
          icon={<Dismiss20Regular />}
          onClick={onClose}
          aria-label="Close"
        />
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">

        {/* Trigger header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex-shrink-0 flex items-center justify-center">
            {iconPath ? (
              <img src={iconPath} alt={channelDisplayName} className="w-9 h-9" />
            ) : (
              <span className="text-2xl font-bold text-gray-400">{channelDisplayName[0]}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{panelTitle}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{getTriggerTypeLabel(channel)}</p>
          </div>

          {/* Connection status */}
          <ConnectionBadge />
        </div>

        <div className="flex justify-end mb-4">
          {isSoftDeleted ? (
            <CopilotButton size="sm" variant="primary" onClick={() => restoreTrigger(trigger.name)}>
              Restore trigger
            </CopilotButton>
          ) : (
            <CopilotButton size="sm" variant="outline" onClick={() => setShowRemoveDialog(true)} className="text-red-600 hover:text-red-700 hover:border-red-300">
              Remove trigger
            </CopilotButton>
          )}
        </div>

        {/* Soft-delete banner */}
        {isSoftDeleted && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-3">
            <p className="text-sm text-amber-900 flex-1">
              This trigger has been removed and will be permanently deleted on next publish.
            </p>
            <CopilotButton size="sm" variant="primary" onClick={() => restoreTrigger(trigger.name)}>
              Restore
            </CopilotButton>
          </div>
        )}

        <div className={`space-y-3 ${isSoftDeleted ? 'opacity-50 pointer-events-none' : ''}`}>

          {/* ── Details card ───────────────────────────────────────────── */}
          <div className="border border-gray-200 rounded-2xl">
            <CopilotButton
              variant="transparent"
              onClick={() => setDetailsOpen(v => !v)}
              className="w-full flex items-start gap-2 px-6 py-4 text-left"
              aria-expanded={detailsOpen}
              style={{ height: 'auto', borderRadius: 0, justifyContent: 'flex-start', minHeight: 0, borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}
            >
              <span className="mt-0.5 flex-shrink-0">
                {detailsOpen
                  ? <ChevronDown16Regular style={{ color: 'hsl(var(--text-secondary))' }} />
                  : <ChevronRight16Regular style={{ color: 'hsl(var(--text-secondary))' }} />}
              </span>
              <span>
                <span className="text-sm font-semibold text-gray-900">Details</span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  {detailsText}{' '}
                  <a href="#" className="text-blue-600 hover:underline" onClick={e => e.preventDefault()}>
                    Learn more
                  </a>
                </span>
              </span>
            </CopilotButton>

            {detailsOpen && (
              <div className="px-6 pb-6">
                <div className="border-t border-gray-100 mb-5" />

                {/* Authentication field */}
                <div>
                  <div className="flex items-baseline gap-1 mb-0.5">
                    <label className="text-sm font-medium text-gray-900">Authentication</label>
                    <span className="text-red-500 text-xs font-medium">*</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">What credentials will your trigger use?</p>
                  <div className="w-64">
                    <CopilotDropdown
                      options={AUTH_OPTIONS}
                      value={authMode}
                      onChange={setAuthMode}
                      size="sm"
                      variant="form-field"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Trigger options card ───────────────────────────────────── */}
          <div className="border border-gray-200 rounded-2xl">
            <CopilotButton
              variant="transparent"
              onClick={() => setTriggerOptionsOpen(v => !v)}
              className="w-full flex items-start gap-2 px-6 py-4 text-left"
              aria-expanded={triggerOptionsOpen}
              style={{ height: 'auto', borderRadius: 0, justifyContent: 'flex-start', minHeight: 0, borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}
            >
              <span className="mt-0.5 flex-shrink-0">
                {triggerOptionsOpen
                  ? <ChevronDown16Regular style={{ color: 'hsl(var(--text-secondary))' }} />
                  : <ChevronRight16Regular style={{ color: 'hsl(var(--text-secondary))' }} />}
              </span>
              <span>
                <span className="text-sm font-semibold text-gray-900">Trigger options</span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  {triggerOptionsSubhead}{' '}
                  <a href="#" className="text-blue-600 hover:underline" onClick={e => e.preventDefault()}>
                    Learn more about trigger options for this connector action
                  </a>
                </span>
              </span>
            </CopilotButton>

            {triggerOptionsOpen && (
              <div className="px-6 pb-6">
                <div className="border-t border-gray-100 mb-5" />

                {fields.length === 0 ? (
                  <p className="text-xs text-gray-400">No configurable options for this trigger.</p>
                ) : (
                  <div className="space-y-5">
                    {fields.map(field => {
                      const state = fieldStates[field.id] ?? { mode: field.defaultMode, value: '', editability: 'editable' };
                      const isAI = state.mode === 'adaptive-ai';

                      // ── AI mode row ──────────────────────────────────
                      if (isAI) {
                        return (
                          <div key={field.id} className="flex items-start gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{field.label}:</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                AI will fill this in for you, no action is needed
                              </p>
                            </div>
                            <ModeToggle
                              mode={state.mode}
                              onChange={mode => setFieldMode(field.id, mode)}
                            />
                          </div>
                        );
                      }

                      // ── Custom mode row ──────────────────────────────
                      return (
                        <div key={field.id}>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-sm font-medium text-gray-700">
                              {field.label}:
                            </label>
                            <ModeToggle
                              mode={state.mode}
                              onChange={mode => setFieldMode(field.id, mode)}
                            />
                          </div>
                          <div className="flex items-center gap-3">
                            {field.customOptions ? (
                              <div className="flex-1">
                                <CopilotDropdown
                                  options={field.customOptions}
                                  value={state.value}
                                  onChange={v => setFieldValue(field.id, v)}
                                  size="sm"
                                  variant="form-field"
                                />
                              </div>
                            ) : field.placeholder ? (
                              <div className="flex-1">
                                <CopilotInput
                                  appearance="outline"
                                  size="sm"
                                  value={state.value}
                                  onChange={e => setFieldValue(field.id, e.target.value)}
                                  placeholder={field.placeholder}
                                />
                              </div>
                            ) : null}
                            {field.showEditableDropdown && (
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs text-gray-500 whitespace-nowrap">Editable by</span>
                                <div className="w-36">
                                  <CopilotDropdown
                                    options={EDITABLE_BY_OPTIONS}
                                    value={state.editability}
                                    onChange={v => setFieldEditability(field.id, v)}
                                    size="sm"
                                    variant="form-field"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Advanced configuration card ────────────────────────────── */}
          <div className="border border-gray-200 rounded-2xl">
            <CopilotButton
              variant="transparent"
              onClick={() => setAdvancedOpen(v => !v)}
              className="w-full flex items-start gap-2 px-6 py-4 text-left"
              aria-expanded={advancedOpen}
              style={{ height: 'auto', borderRadius: 0, justifyContent: 'flex-start', minHeight: 0, borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}
            >
              <span className="mt-0.5 flex-shrink-0">
                {advancedOpen
                  ? <ChevronDown16Regular style={{ color: 'hsl(var(--text-secondary))' }} />
                  : <ChevronRight16Regular style={{ color: 'hsl(var(--text-secondary))' }} />}
              </span>
              <span>
                <span className="text-sm font-semibold text-gray-900">Advanced configuration</span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  {advancedDescription}
                </span>
              </span>
            </CopilotButton>

            {advancedOpen && (
              <div className="px-6 pb-6">
                <div className="border-t border-gray-100 mb-5" />

                {/* Body / Message field */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <label className="text-sm font-medium text-gray-900">Body/ Message</label>
                    <span className="text-red-500 text-xs font-medium">*</span>
                    <Info16Regular style={{ color: 'hsl(var(--text-secondary))', width: 14, height: 14 }} />
                  </div>
                  <CopilotTextarea
                    value={bodyMessage}
                    onChange={e => setBodyMessage(e.target.value.slice(0, BODY_MESSAGE_MAX))}
                    rows={3}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-400 text-right mt-1">
                    {bodyMessage.length}/{BODY_MESSAGE_MAX}
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Remove trigger confirmation dialog */}
      <Dialog isOpen={showRemoveDialog} onClose={() => setShowRemoveDialog(false)} maxWidth="md">
        <DialogHeader onClose={() => setShowRemoveDialog(false)}>
          <DialogTitle>Remove this trigger?</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p className="text-sm text-gray-600">
            {isTriggerLive
              ? <>This trigger is currently published. Removing it will take effect on next publish. You can restore it anytime before publishing.</>
              : <>This will remove <strong>{channelDisplayName}</strong> as a trigger for this agent and clear any channel-specific configuration.</>
            }
          </p>
        </DialogContent>
        <DialogFooter>
          <CopilotButton variant="secondary" onClick={() => setShowRemoveDialog(false)}>
            Cancel
          </CopilotButton>
          <CopilotButton
            variant="primary"
            className="bg-red-600 hover:bg-red-700 active:bg-red-800"
            onClick={() => {
              if (isTriggerLive) {
                softDeleteTrigger(trigger.name);
              } else {
                removeTriggerFromInstructions(trigger.name);
                onBack();
              }
              setShowRemoveDialog(false);
            }}
          >
            Remove
          </CopilotButton>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

// ── Mode toggle ───────────────────────────────────────────────────────────────

function ModeToggle({
  mode,
  onChange,
}: {
  mode: FieldMode;
  onChange: (mode: FieldMode) => void;
}) {
  return (
    <div className="flex items-center rounded-lg border border-gray-300 overflow-hidden flex-shrink-0">
      <CopilotButton
        variant="transparent"
        onClick={() => onChange('adaptive-ai')}
        style={{
          height: 'auto',
          borderRadius: 0,
          padding: '0.375rem 1rem',
          fontSize: '0.75rem',
          backgroundColor: mode === 'adaptive-ai' ? 'hsl(var(--background))' : 'hsl(var(--surface-tertiary))',
          color: mode === 'adaptive-ai' ? '#0078d4' : 'hsl(var(--text-secondary))',
          fontWeight: mode === 'adaptive-ai' ? 600 : 400,
        }}
      >
        Adaptive AI
      </CopilotButton>
      <div className="w-px self-stretch bg-gray-300 flex-shrink-0" />
      <CopilotButton
        variant="transparent"
        onClick={() => onChange('custom')}
        style={{
          height: 'auto',
          borderRadius: 0,
          padding: '0.375rem 1rem',
          fontSize: '0.75rem',
          backgroundColor: mode === 'custom' ? 'hsl(var(--background))' : 'hsl(var(--surface-tertiary))',
          color: mode === 'custom' ? '#0078d4' : 'hsl(var(--text-secondary))',
          fontWeight: mode === 'custom' ? 600 : 400,
        }}
      >
        Custom
      </CopilotButton>
    </div>
  );
}
