import React, { useState } from 'react';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotDropdown } from '../../../components/ui/CopilotDropdown';
import { CopilotCheckbox } from '../../../components/ui/CopilotCheckbox';
import { CopilotTextarea } from '../../../components/ui/CopilotTextarea';
import { SubHeader } from '../../../components/ui/SubHeader';
import {
  Dismiss20Regular,
  InfoRegular,
  ChevronRight16Regular,
} from '@fluentui/react-icons';
import { AgentConfig } from '../../../types';
import {
  WORK_IQ_MCP_SERVERS,
  WORK_IQ_DEFAULT_SERVERS,
  WORK_IQ_SERVER_ICON,
  WORK_IQ_SERVER_OVERVIEW,
  WORK_IQ_SERVER_TOOLS,
  WORK_IQ_SERVER_RESOURCES,
  getWorkIQTabLabel,
  WORK_IQ_BRAND_COLOR,
  WORK_IQ_ENABLED_BG,
  WORK_IQ_ENABLED_TEXT,
} from '../../../utils/workIqUtils';

// ── Design tokens ─────────────────────────────────────────────────────────────
const BRAND        = WORK_IQ_BRAND_COLOR;
const ENABLED_BG   = WORK_IQ_ENABLED_BG;
const ENABLED_TEXT = WORK_IQ_ENABLED_TEXT;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkIQDetailPanelProps {
  agentConfig: AgentConfig;
  onBack: () => void;
  onClose: () => void;
  onServersChange: (servers: string[]) => void;
}

// ── Small shared primitives ───────────────────────────────────────────────────

/** Section card wrapper. */
const SectionCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-2xl border border-gray-200 overflow-hidden">{children}</div>
);

/** Section header row: bold title + info icon, optional right-side action buttons. */
const SectionHeader: React.FC<{
  title: string;
  actions?: React.ReactNode;
}> = ({ title, actions }) => (
  <div className="flex items-center justify-between px-4 pt-4 pb-3">
    <div className="flex items-center gap-1.5">
      <span className="text-sm font-semibold text-gray-900">{title}</span>
      <InfoRegular className="w-3.5 h-3.5 text-gray-400" />
    </div>
    {actions && <div className="flex items-center gap-0.5">{actions}</div>}
  </div>
);

// ── Section: Tools ────────────────────────────────────────────────────────────

const ToolsSection: React.FC<{ serverName: string; serverEnabled: boolean }> = ({
  serverName,
  serverEnabled,
}) => {
  const tools = WORK_IQ_SERVER_TOOLS[serverName] ?? [];
  const [allowAll, setAllowAll] = useState(true);

  return (
    <SectionCard>
      <SectionHeader
        title="Tools"
        actions={
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-600">Allow all</span>
            <button
              type="button"
              role="switch"
              aria-checked={allowAll}
              aria-label={allowAll ? 'Disable all tools' : 'Enable all tools'}
              onClick={() => setAllowAll(v => !v)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors cursor-pointer ${
                allowAll ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`pointer-events-none absolute top-0.5 inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  allowAll ? 'translate-x-[18px]' : 'translate-x-[3px]'
                }`}
              />
            </button>
          </div>
        }
      />

      <div className={`divide-y divide-gray-100 ${!serverEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
        {tools.length === 0 ? (
          <p className="px-4 py-3 text-xs text-gray-400 italic">No tools available.</p>
        ) : (
          tools.map(tool => (
            <div key={tool.name} className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{tool.name}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{tool.description}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </SectionCard>
  );
};

// ── Section: Resources ────────────────────────────────────────────────────────

const ResourcesSection: React.FC<{ serverName: string; serverEnabled: boolean }> = ({
  serverName,
  serverEnabled,
}) => {
  const resources = WORK_IQ_SERVER_RESOURCES[serverName] ?? [];

  return (
    <SectionCard>
      <SectionHeader title="Resources" />

      <div className={`divide-y divide-gray-100 ${!serverEnabled ? 'opacity-40' : ''}`}>
        {resources.length === 0 ? (
          <p className="px-4 py-3 text-xs text-gray-400 italic">No resources available.</p>
        ) : (
          resources.map(resource => (
            <div key={resource.name} className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{resource.name}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{resource.description}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </SectionCard>
  );
};

// ── Section: Details ──────────────────────────────────────────────────────────

const askOptions = [
  { value: 'no',  label: 'No' },
  { value: 'yes', label: 'Yes' },
];

const authOptions = [
  { value: 'yes-default', label: 'Yes (default)' },
  { value: 'no',          label: 'No' },
  { value: 'optional',    label: 'Optional' },
];

const DetailsSection: React.FC<{ serverName: string }> = ({ serverName }) => {
  // TODO: wire these fields to agentConfig.workIq — currently prototype scaffolding only
  const [askUser, setAskUser] = useState('no');
  const [auth, setAuth] = useState('yes-default');
  const [desc, setDesc] = useState('');
  const [allowDynamic, setAllowDynamic] = useState(true);
  const [allowInstructions, setAllowInstructions] = useState(true);
  const overview = WORK_IQ_SERVER_OVERVIEW[serverName];
  const [p1, p2] = overview ?? ['Overview information for this server is not yet available.', ''];

  return (
    <SectionCard>
      <SectionHeader title="Details" />
      <div className="px-4 pt-1 pb-3 space-y-1 border-b border-gray-100">
        <p className="text-sm text-gray-700 leading-relaxed">{p1}</p>
        {p2 && (
          <div className="text-sm text-gray-700 leading-relaxed">
            {p2}{' '}
            <CopilotButton variant="ghost" size="sm" className="text-blue-600 hover:underline p-0 h-auto text-sm font-normal" onClick={() => {}}>
              Learn more
            </CopilotButton>
          </div>
        )}
      </div>
      <div className="px-4 pb-4 space-y-4">
        {/* TODO: wire to agentConfig */}
        <CopilotCheckbox
          checked={allowDynamic}
          onChange={setAllowDynamic}
          label="Allow agent to decide dynamically when to use this tool"
          description="If unchecked, it can only be used when explicitly referenced by an agent or a topic"
        />

        <div>
          <p className="text-sm font-semibold text-gray-900 mb-0.5">Ask the user before running</p>
          <p className="text-xs text-gray-500 mb-2">
            Recommended for sensitive or regulated domains or when making changes for the user
          </p>
          {/* TODO: wire to agentConfig */}
          <CopilotDropdown
            value={askUser}
            options={askOptions}
            onChange={setAskUser}
            size="sm"
          />
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-900 mb-0.5">Authentication</p>
          <p className="text-xs text-gray-500 mb-2">Have end users sign in with their own credentials</p>
          {/* TODO: wire to agentConfig */}
          <CopilotDropdown
            value={auth}
            options={authOptions}
            onChange={setAuth}
            size="sm"
          />
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-900 mb-1.5">Description</p>
          {/* TODO: wire to agentConfig */}
          <CopilotTextarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            maxLength={1024}
            rows={3}
            placeholder={`Describe what this does so the user knows why they're being asked to authenticate. For example, "Please log in to ..."`}
            size="sm"
          />
          <div className="text-right text-xs text-gray-400 mt-0.5">{desc.length}/1024</div>
        </div>

        {/* TODO: wire to agentConfig */}
        <CopilotCheckbox
          checked={allowInstructions}
          onChange={setAllowInstructions}
          label="Allow agent to use MCP server instructions"
          description="If unchecked, any instructions provided by the MCP server (e.g. tone, formatting, domain-specific guidance) will be ignored"
        />
      </div>
    </SectionCard>
  );
};

// ── MCP Server list card ──────────────────────────────────────────────────────

const McpServerCard: React.FC<{
  name: string;
  isEnabled: boolean;
  onToggle: () => void;
  onSelect: () => void;
}> = ({ name, isEnabled, onToggle, onSelect }) => {
  const icon = WORK_IQ_SERVER_ICON[name];
  const label = getWorkIQTabLabel(name);
  return (
    <div
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => { if (e.key === 'Enter') onSelect(); }}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left cursor-pointer"
    >
      {/* Server icon */}
      <div className="flex-shrink-0 w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center">
        {icon
          ? <img src={icon} alt="" aria-hidden className="w-5 h-5" />
          : <span className="text-[10px] font-bold text-gray-400">{label.slice(0, 2).toUpperCase()}</span>
        }
      </div>

      {/* Name */}
      <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">{label}</span>

      {/* Toggle — stop propagation so clicking it doesn't navigate */}
      <div
        className="flex items-center gap-1.5 flex-shrink-0"
        onClick={e => { e.stopPropagation(); onToggle(); }}
      >
        <span className="text-xs text-gray-400">{isEnabled ? 'On' : 'Off'}</span>
        <span
          role="switch"
          aria-checked={isEnabled}
          aria-label={`${isEnabled ? 'Disable' : 'Enable'} ${label}`}
          tabIndex={0}
          onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.stopPropagation(); onToggle(); } }}
          className="relative inline-flex h-5 w-9 rounded-full transition-colors cursor-pointer flex-shrink-0"
          style={{ backgroundColor: isEnabled ? BRAND : '#D1D1D1' }}
        >
          <span
            className={`pointer-events-none absolute top-0.5 inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              isEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
            }`}
          />
        </span>
      </div>

      {/* Chevron */}
      <ChevronRight16Regular className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

export function WorkIQDetailPanel({
  agentConfig,
  onBack,
  onClose,
  onServersChange,
}: WorkIQDetailPanelProps) {
  const enabledServers = agentConfig.workIq?.enabledServers ?? WORK_IQ_DEFAULT_SERVERS;
  const [enabledSet, setEnabledSet] = useState<Set<string>>(() => new Set(enabledServers));

  // null = list view, string = detail view for that server
  const [selectedServer, setSelectedServer] = useState<string | null>(null);

  const toggleServer = (name: string) => {
    const next = new Set(enabledSet);
    if (next.has(name)) next.delete(name); else next.add(name);
    setEnabledSet(next);
    onServersChange(WORK_IQ_MCP_SERVERS.filter(s => next.has(s)));
  };

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (selectedServer) {
    const serverEnabled = enabledSet.has(selectedServer);
    const label = getWorkIQTabLabel(selectedServer);
    const serverIcon = WORK_IQ_SERVER_ICON[selectedServer];
    return (
      <div className="absolute inset-0 bg-white z-10 flex flex-col overflow-hidden">
        <SubHeader
          title={label}
          subtitle="Work IQ"
          onBack={() => setSelectedServer(null)}
          className="px-4 pt-4 pb-3"
          noIconWrap
          icon={
            serverIcon
              ? <img src={serverIcon} alt="" aria-hidden className="w-7 h-7" />
              : <img src="/copilot-color-icon.svg" alt="" aria-hidden className="w-7 h-7" />
          }
          actions={
            <>
              <span className="text-xs text-gray-500">{serverEnabled ? 'Enabled' : 'Disabled'}</span>
              <button
                type="button"
                role="switch"
                aria-checked={serverEnabled}
                aria-label={`${serverEnabled ? 'Disable' : 'Enable'} ${label}`}
                onClick={() => toggleServer(selectedServer)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors cursor-pointer ${
                  serverEnabled ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none absolute top-0.5 inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    serverEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  }`}
                />
              </button>
              <CopilotButton
                variant="ghost"
                size="sm"
                icon={<Dismiss20Regular />}
                aria-label="Close panel"
                onClick={onClose}
              />
            </>
          }
        />

        {/* Content sections */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-4 space-y-4 pb-10">
            <DetailsSection serverName={selectedServer} />
            <ToolsSection serverName={selectedServer} serverEnabled={serverEnabled} />
            <ResourcesSection serverName={selectedServer} serverEnabled={serverEnabled} />
          </div>
        </div>
      </div>
    );
  }

  // ── List view ───────────────────────────────────────────────────────────────
  return (
    <div className="absolute inset-0 bg-white z-10 flex flex-col overflow-hidden">
      <SubHeader
        title="Work IQ"
        subtitle="Tool"
        onBack={onBack}
        className="px-4 pt-4 pb-3"
        noIconWrap
        icon={<img src="/copilot-color-icon.svg" alt="Work IQ" className="w-7 h-7" />}
        badge={
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ml-1"
            style={{ background: ENABLED_BG, color: ENABLED_TEXT }}
          >
            Enabled
          </span>
        }
        actions={
          <CopilotButton
            variant="ghost"
            size="sm"
            icon={<Dismiss20Regular />}
            aria-label="Close panel"
            onClick={onClose}
          />
        }
      />

      {/* MCP server list */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-3 pb-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">MCP Servers</p>
        </div>
        <div className="divide-y divide-gray-100">
          {WORK_IQ_MCP_SERVERS.map(server => (
            <McpServerCard
              key={server}
              name={server}
              isEnabled={enabledSet.has(server)}
              onToggle={() => toggleServer(server)}
              onSelect={() => setSelectedServer(server)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
