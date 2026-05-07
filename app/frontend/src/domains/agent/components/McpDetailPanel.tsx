import React, { useState } from 'react';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotToggle } from '../../../components/ui/CopilotToggle';
import { CopilotCheckbox } from '../../../components/ui/CopilotCheckbox';
import { CopilotDropdown } from '../../../components/ui/CopilotDropdown';
import { CopilotTextarea } from '../../../components/ui/CopilotTextarea';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import {
  MoreHorizontal20Regular,
  InfoRegular,
  ArrowSort20Regular,
  Search20Regular,
  ArrowClockwise16Regular,
  Settings16Regular,
  ArrowLeft20Regular,
  Wrench16Regular,
  ArrowSync20Regular,
} from '@fluentui/react-icons';
import { ComponentItem } from '../../../utils/buildPageUtils';
import { getConnectorIcon } from '../../../utils/agentIcons';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface McpDetailPanelProps {
  item: ComponentItem;
  onBack: () => void;
  onClose: () => void;
}

// ── Mock data ─────────────────────────────────────────────────────────────────

interface MockTool {
  name: string;
  description: string;
}

const MOCK_TOOLS: Record<string, MockTool[]> = {
  jira: [
    { name: 'GetIssue',     description: 'Retrieve a specific issue by ID' },
    { name: 'CreateIssue',  description: 'Create a new issue in a project' },
    { name: 'UpdateIssue',  description: 'Update fields of an existing issue' },
    { name: 'SearchIssues', description: 'Search issues using JQL queries' },
    { name: 'AddComment',   description: 'Add a comment to an issue' },
  ],
  sap: [
    { name: 'GetCustomer',     description: 'Retrieve customer master data' },
    { name: 'CreateSalesOrder', description: 'Create a new sales order' },
    { name: 'GetInventory',    description: 'Get inventory level for a material' },
    { name: 'PostInvoice',     description: 'Post an invoice document' },
  ],
  outlook: [
    { name: 'GetContactFolders',    description: 'Get contact folders' },
    { name: 'GetContact',           description: 'Get a contact' },
    { name: 'CreateContact',        description: 'Create a contact in a contacts folder' },
    { name: 'UpdateContact',        description: 'Update a contact in a contacts folder' },
    { name: 'ListContactsFromFolder', description: 'Lists contacts from a contacts folder' },
  ],
  default: [
    { name: 'ListItems',   description: 'List items from the service' },
    { name: 'GetItem',     description: 'Get a specific item by ID' },
    { name: 'CreateItem',  description: 'Create a new item in the service' },
    { name: 'UpdateItem',  description: 'Update an existing item' },
    { name: 'DeleteItem',  description: 'Delete an item from the service' },
  ],
};

const MOCK_OVERVIEW: Record<string, [string, string]> = {
  jira: [
    'The Jira MCP server is an Atlassian-built connector that gives your agent governed access to Jira projects, issues, and comments, enabling it to take deterministic actions on a user\'s behalf.',
    'It exposes Jira capabilities as structured, auditable tools that your agent can reason over and invoke through Copilot Studio, while respecting Atlassian permissions and policies.',
  ],
  sap: [
    'The SAP MCP server is a connector that gives your agent secure, governed access to SAP enterprise data and the ability to take deterministic actions on a user\'s behalf.',
    'It exposes SAP capabilities as structured, auditable tools your agent can reason over and invoke through Copilot Studio, while respecting enterprise permissions, compliance, and admin policies.',
  ],
  default: [
    'This MCP server is a connector that gives your agent secure, governed access to service data and the ability to take deterministic actions on a user\'s behalf.',
    'It exposes service capabilities as structured, auditable tools that your agent can reason over and invoke through Copilot Studio, while respecting service permissions and policies.',
  ],
};

const getToolsFor   = (name: string) => MOCK_TOOLS[name.toLowerCase()]   ?? MOCK_TOOLS.default;
const getOverviewFor = (name: string) => MOCK_OVERVIEW[name.toLowerCase()] ?? MOCK_OVERVIEW.default;

// ── Small shared primitives ───────────────────────────────────────────────────

const SectionCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-2xl border border-[hsl(var(--stroke-default))] overflow-hidden">{children}</div>
);

const SectionHeading: React.FC<{ title: string; actions?: React.ReactNode }> = ({ title, actions }) => (
  <div className="flex items-center justify-between px-5 py-4">
    <div className="flex items-center gap-1.5">
      <span className="font-bold text-base leading-5 text-[hsl(var(--text-primary))]">{title}</span>
      <InfoRegular style={{ width: 16, height: 16, color: 'hsl(var(--text-disabled))' }} />
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);

const Divider = () => <div className="w-full h-px bg-[hsl(var(--stroke-default))]" />;

/** Copilot-branded tool name pill. */
const ToolPill: React.FC<{ name: string }> = ({ name }) => (
  <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full border border-primary text-primary text-[11px] font-medium whitespace-nowrap shrink-0 w-fit">
    <Wrench16Regular style={{ width: 11, height: 11 }} />
    {name}
  </span>
);

/** Inline mini toggle (On/Off) — matches the per-tool toggles in the screenshot. */
const MiniToggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; toolName: string }> = ({ checked, onChange, toolName }) => (
  <div className="flex items-center gap-1.5 shrink-0">
    <span className="text-xs text-[hsl(var(--text-secondary))]">{checked ? 'On' : 'Off'}</span>
    <CopilotToggle
      size="sm"
      checked={checked}
      onChange={onChange}
      aria-label={`${checked ? 'Disable' : 'Enable'} ${toolName}`}
    />
  </div>
);

// ── Section: Overview ─────────────────────────────────────────────────────────

const OverviewSection: React.FC<{ connectorName: string }> = ({ connectorName }) => {
  const [p1, p2] = getOverviewFor(connectorName);
  return (
    <SectionCard>
      <SectionHeading title="Overview" />
      <div className="px-5 pb-5 space-y-2">
        <p className="text-sm text-[hsl(var(--text-primary))] leading-relaxed">{p1}</p>
        <p className="text-sm text-[hsl(var(--text-primary))] leading-relaxed">
          {p2}{' '}
          <span className="text-[hsl(var(--brand-700))] underline cursor-pointer text-sm">Learn more</span>
        </p>
      </div>
    </SectionCard>
  );
};

// ── Section: Tools ────────────────────────────────────────────────────────────

const ToolsSection: React.FC<{ connectorName: string }> = ({ connectorName }) => {
  const tools = getToolsFor(connectorName);
  const [allowAll, setAllowAll] = useState(false);
  const [toolToggles, setToolToggles] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(tools.map(t => [t.name, false]))
  );

  const setTool = (name: string, val: boolean) =>
    setToolToggles(prev => ({ ...prev, [name]: val }));

  return (
    <SectionCard>
      <SectionHeading
        title="Tools"
        actions={
          <div className="flex items-center gap-2">
            <CopilotButton variant="transparent" size="sm" icon={<ArrowSort20Regular />} onClick={() => {}} aria-label="Sort tools" />
            <CopilotButton variant="transparent" size="sm" icon={<Search20Regular />} onClick={() => {}} aria-label="Search tools" />
            <span className="text-xs text-[hsl(var(--text-secondary))]">Allow all</span>
            <CopilotToggle
              size="sm"
              checked={allowAll}
              onChange={(next) => {
                setAllowAll(next);
                setToolToggles(Object.fromEntries(tools.map(t => [t.name, next])));
              }}
              aria-label={allowAll ? 'Disable all tools' : 'Enable all tools'}
            />
            <CopilotButton variant="transparent" size="sm" icon={<ArrowSync20Regular />} onClick={() => {}} aria-label="Refresh tools" />
          </div>
        }
      />

      {/* Table header */}
      <div className="flex items-center gap-3 px-5 py-2 border-t border-b border-[hsl(var(--stroke-default))] bg-[hsl(var(--surface-secondary))]">
        <span className="text-xs font-semibold text-[hsl(var(--text-secondary))] flex-1">Name</span>
        <span className="text-xs font-semibold text-[hsl(var(--text-secondary))] w-40 shrink-0 hidden sm:block">Description</span>
      </div>

      {/* Tool rows */}
      <div className="divide-y divide-[hsl(var(--surface-quaternary))]">
        {tools.map(tool => (
          <div key={tool.name} className="flex items-center gap-3 px-5 py-3">
            <ToolPill name={tool.name} />
            <span className="text-xs text-[hsl(var(--text-secondary))] leading-4 truncate flex-1">{tool.description}</span>
            <MiniToggle
              checked={toolToggles[tool.name] ?? false}
              onChange={v => setTool(tool.name, v)}
              toolName={tool.name}
            />
            <CopilotButton
              variant="transparent"
              size="sm"
              icon={<Settings16Regular />}
              onClick={() => {}}
              aria-label={`Settings for ${tool.name}`}
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1.5 px-5 py-3 border-t border-[hsl(var(--stroke-default))]">
        <ArrowClockwise16Regular style={{ width: 12, height: 12, color: 'hsl(var(--text-disabled))' }} />
        <span className="text-xs text-[hsl(var(--text-disabled))]">
          Last refreshed 1 minute ago. The information is updated dynamically and supported by specialized servers using the Model Context Protocol.
        </span>
      </div>
    </SectionCard>
  );
};

// ── Section: Details ──────────────────────────────────────────────────────────

const askOptions  = [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }];
const authOptions = [{ value: 'yes-default', label: 'Yes (default)' }, { value: 'no', label: 'No' }, { value: 'optional', label: 'Optional' }];

const DetailsSection: React.FC<{ connectorName: string }> = ({ connectorName }) => {
  const [name, setName]               = useState(connectorName);
  const [allowDynamic, setAllowDynamic] = useState(true);
  const [askUser, setAskUser]         = useState('no');
  const [auth, setAuth]               = useState('yes-default');
  const [desc, setDesc]               = useState('');
  const [allowInstr, setAllowInstr]   = useState(true);
  const maxName = 64;

  return (
    <SectionCard>
      <SectionHeading title="Details" />
      <div className="px-5 pb-5 space-y-4">

        {/* Name */}
        <div>
          <p className="text-sm font-semibold text-[hsl(var(--text-primary))] mb-1.5">
            Name <span className="text-red-500">*</span>
          </p>
          <CopilotInput
            value={name}
            onChange={e => setName(e.target.value.slice(0, maxName))}
            maxLength={maxName}
            size="sm"
            className="w-full"
          />
          <div className="text-right text-xs text-[hsl(var(--text-disabled))] mt-0.5">{name.length}/{maxName}</div>
        </div>

        <Divider />

        <CopilotCheckbox
          checked={allowDynamic}
          onChange={setAllowDynamic}
          label="Allow agent to decide dynamically when to use this tool"
          description="If unchecked, it can only be used when explicitly referenced by an agent or a topic"
        />

        <Divider />

        <div>
          <p className="text-sm font-semibold text-[hsl(var(--text-primary))] mb-0.5">Ask the user before running</p>
          <p className="text-xs text-[hsl(var(--text-secondary))] mb-2">
            Recommended for sensitive or regulated domains or when making changes for the user
          </p>
          <CopilotDropdown value={askUser} options={askOptions} onChange={setAskUser} size="sm" />
        </div>

        <Divider />

        <div>
          <p className="text-sm font-semibold text-[hsl(var(--text-primary))] mb-0.5">Authentication</p>
          <p className="text-xs text-[hsl(var(--text-secondary))] mb-2">Have end users sign in with their own credentials</p>
          <CopilotDropdown value={auth} options={authOptions} onChange={setAuth} size="sm" />
        </div>

        <Divider />

        <div>
          <p className="text-sm font-semibold text-[hsl(var(--text-primary))] mb-1.5">Description</p>
          <CopilotTextarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            maxLength={1024}
            rows={3}
            placeholder={`Describe what this does so the user knows why they're being asked to authenticate. For example, "Please log in to ..."`}
            size="sm"
          />
          <div className="text-right text-xs text-[hsl(var(--text-disabled))] mt-0.5">{desc.length}/1024</div>
        </div>

        <Divider />

        <CopilotCheckbox
          checked={allowInstr}
          onChange={setAllowInstr}
          label="Allow agent to use MCP server instructions"
          description="If unchecked, any instructions provided by the MCP server (e.g. tone, formatting, domain-specific guidance) will be ignored"
        />
      </div>
    </SectionCard>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

export function McpDetailPanel({
  item,
  onBack,
  onClose,
}: McpDetailPanelProps) {
  const connectorIcon = getConnectorIcon(item.name.toLowerCase(), 'w-7 h-7')
    ?? (item.source ? getConnectorIcon(item.source.toLowerCase(), 'w-7 h-7') : null);

  return (
    <div className="absolute inset-0 bg-white z-10 flex flex-col overflow-hidden">

      {/* ── Header: back + connector identity + actions ───────────────────── */}
      <div className="px-10 pt-4 pb-4 flex items-center gap-3 shrink-0">
        <CopilotButton
          variant="transparent"
          size="sm"
          icon={<ArrowLeft20Regular />}
          onClick={onBack}
          aria-label="Back"
          className="-ml-2"
        />
        {/* Connector icon */}
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
          {connectorIcon ?? (
            <span className="text-sm font-bold text-gray-500">
              {item.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        {/* Name + subtitle */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-xl leading-7 text-[hsl(var(--text-primary))] truncate">{item.name}</p>
          <p className="text-xs text-[hsl(var(--text-secondary))] truncate">Connector · MCP</p>
        </div>
        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <CopilotButton variant="transparent" size="sm" icon={<MoreHorizontal20Regular />} onClick={() => {}} aria-label="More options" />
        </div>
      </div>

      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-10 pb-10 space-y-4">
          <OverviewSection connectorName={item.name} />
          <ToolsSection connectorName={item.name} />
          <DetailsSection connectorName={item.name} />
        </div>
      </div>
    </div>
  );
}
