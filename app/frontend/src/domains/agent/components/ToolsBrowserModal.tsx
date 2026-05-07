import React, { useState, useMemo, useEffect } from 'react';
import {
  Add20Regular,
  Search20Regular,
  Dismiss20Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
  Info16Regular,
  Dismiss16Regular,
  Checkmark20Regular,
  CheckmarkCircle20Filled,
  PlugConnected20Regular,
  PlugDisconnected20Regular,
} from '@fluentui/react-icons';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { CopilotDropdown } from '../../../components/ui/CopilotDropdown';
import { CopilotTooltip } from '../../../components/ui/CopilotTooltip';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../../../components/ui/Dialog';
import { connectorIcons } from '../../../utils/agentIcons';

export interface ToolsBrowserModalProps {
  isOpen: boolean;
  /** Bounding rect of the trigger button — flyout anchors below/right of this */
  anchorRect?: DOMRect | null;
  onClose: () => void;
  onAdd: (tool: { key: string; label: string }) => void;
  onDisconnect: (tool: { key: string; label: string }) => void;
  /** Called when the user clicks "Manage tool" after connecting */
  onManage?: (tool: { key: string; label: string; isMcp: boolean; isMicrosoft: boolean }) => void;
  /** Set of tool labels that are already connected */
  connectedLabels?: Set<string>;
  /** Called when the user chooses to create a new MCP server */
  onOpenMcpForm?: () => void;
  /** Called when the user chooses to create a new REST API */
  onOpenRestApiForm?: () => void;
}

const TOOL_LIST = connectorIcons.filter(
  (c) => c.src && !['office', 'work iq', 'excel file', 'word file', 'powerpoint file', 'outlook', 'excel', 'word', 'm365', 'powerpoint', 'sharepoint', 'onedrive', 'website'].includes(c.key)
);

const MICROSOFT_KEYS = new Set([
  'teams', 'outlook', 'sharepoint', 'onedrive', 'excel', 'word', 'powerpoint',
  'dataverse', 'forms', 'planner', 'power bi', 'm365', 'website', 'azure devops',
]);

const WORK_IQ_ENTRY = { key: 'work iq', label: 'Work IQ', src: '' };

type FilterTab = 'all' | 'microsoft' | 'other';

interface ToolAction {
  key: string;
  label: string;
  description: string;
}

interface ToolMeta {
  shortDesc: string;
  description: string;
  bullets: string[];
  tools: string[];
  /** If set, the tool exposes discrete actions — user picks one before connecting */
  actions?: ToolAction[];
}

const TOOL_META: Record<string, ToolMeta> = {
  'work iq': {
    shortDesc: 'M365 context layer for smarter agent responses',
    description: 'Work IQ is the intelligence layer that personalizes this agent to you and your organization. It applies your Microsoft 365 context — emails, calendar, documents, and more — so the agent can reason across your organization\'s data and deliver relevant, context-aware responses.',
    bullets: ['Access your emails, calendar, and files', 'Understand your work context and priorities', 'Connect to SharePoint, Teams, and OneDrive data', 'Provide personalized, context-aware responses'],
    tools: ['getEmails', 'getCalendar', 'getFiles', 'getContacts', 'getTeamsMessages'],
  },
  teams: {
    shortDesc: 'Post messages and manage Microsoft Teams chats',
    description: 'The Teams tool enables your agent to interact directly with Microsoft Teams — post messages, manage chats, and trigger workflows from conversations.',
    bullets: ['Post messages to channels or group chats', 'Create new 1:1 or group conversations', 'List channels in a team', 'Create and update Planner tasks', 'Trigger on incoming Teams messages'],
    tools: ['postMessage', 'createChat', 'listChannels', 'listTeams', 'sendReply', 'createMeeting', 'listMembers'],
  },
  outlook: {
    shortDesc: 'Send and manage emails and calendar events',
    description: 'The Outlook tool lets your agent send, read, and manage emails and calendar events directly from Microsoft Outlook.',
    bullets: ['Compose and send emails to any recipient', 'Fetch inbox messages and apply filters', 'Reply to or forward existing threads', 'Create and update calendar events', 'Organize messages across folders'],
    tools: ['sendEmail', 'getEmails', 'replyToEmail', 'forwardEmail', 'createEvent', 'getEvents', 'moveEmail', 'flagEmail'],
  },
  sharepoint: {
    shortDesc: 'Read and write SharePoint lists and files',
    description: 'The SharePoint tool gives your agent read and write access to SharePoint lists, libraries, and files across your organization.',
    bullets: ['Get, create, update, or delete list items', 'Upload, download, copy, and delete files', 'Query sites, libraries, and folders', 'Call the SharePoint REST API directly'],
    tools: ['getItems', 'createItem', 'updateItem', 'deleteItem', 'getFileContent', 'createFile', 'copyFile', 'sendHttpRequest'],
  },
  onedrive: {
    shortDesc: 'Manage personal and shared files in OneDrive',
    description: 'The OneDrive tool allows your agent to manage personal and shared files in Microsoft OneDrive.',
    bullets: ['Browse folders and retrieve file metadata', 'Read and extract content from files', 'Write new content or update existing files', 'Copy and move files across storage'],
    tools: ['listFiles', 'getFileContent', 'createFile', 'updateFile', 'copyFile', 'deleteFile'],
  },
  excel: {
    shortDesc: 'Read and write Excel workbooks and tables',
    description: 'The Excel tool enables your agent to read from and write to Excel workbooks stored in OneDrive or SharePoint.',
    bullets: ['Retrieve rows from any table', 'Insert new data into a table', 'Modify existing table rows', 'Discover available tables in a workbook'],
    tools: ['getRow', 'listRows', 'addRow', 'updateRow', 'listTables', 'getWorksheet'],
  },
  word: {
    shortDesc: 'Generate and populate Word document templates',
    description: 'The Word tool lets your agent generate and populate Word documents using templates stored in OneDrive or SharePoint.',
    bullets: ['Fill Word templates with dynamic data', 'Convert documents to PDF or other formats'],
    tools: ['populateTemplate', 'convertDocument'],
  },
  powerpoint: {
    shortDesc: 'Create and export PowerPoint presentations',
    description: 'The PowerPoint tool allows your agent to create and modify PowerPoint presentations.',
    bullets: ['Insert content into slide templates', 'Export presentations to PDF or images'],
    tools: ['populateTemplate', 'exportPresentation'],
  },
  dataverse: {
    shortDesc: 'Query and write to Microsoft Dataverse tables',
    description: 'The Dataverse tool provides full CRUD access to Microsoft Dataverse tables — the data backbone of Power Platform.',
    bullets: ['Query table data with filters', 'Write new or modified records', 'Remove records from tables', 'Trigger Dataverse custom actions'],
    tools: ['listRows', 'getRow', 'createRow', 'updateRow', 'deleteRow', 'performAction', 'relateRows'],
  },
  slack: {
    shortDesc: 'Send messages and interact with Slack workspaces',
    description: 'The Slack tool lets your agent post messages and interact with Slack workspaces.',
    bullets: ['Send messages to channels or direct messages', 'React to incoming Slack messages'],
    tools: ['postMessage', 'sendDirectMessage', 'listChannels'],
  },
  jira: {
    shortDesc: 'Create and manage Jira issues and projects',
    description: 'The Jira tool lets your agent create, update, and query issues across Jira projects to streamline development and project tracking workflows.',
    bullets: ['Create and update issues, bugs, and tasks', 'Query issues by project, status, or assignee', 'Transition issues through workflow stages', 'Add comments and attachments to issues'],
    tools: ['createIssue', 'updateIssue', 'getIssue', 'searchIssues', 'transitionIssue', 'addComment'],
  },
  servicenow: {
    shortDesc: 'Create and manage ServiceNow incidents and tasks',
    description: 'The ServiceNow tool enables your agent to create and manage records in ServiceNow.',
    bullets: ['Open new incidents, tasks, or requests', 'Modify existing ServiceNow entries', 'Search across tables by field values'],
    tools: ['createRecord', 'updateRecord', 'getRecord', 'queryRecords'],
  },
  sap: {
    shortDesc: 'Read and write data across SAP business systems',
    description: 'The SAP tool enables your agent to interact with SAP ERP, S/4HANA, and other SAP systems to read and write business data.',
    bullets: ['Query SAP business objects and master data', 'Create and update ERP records', 'Trigger SAP workflows and functions', 'Access finance, HR, and supply chain data'],
    tools: ['getRecord', 'createRecord', 'updateRecord', 'executeFunction', 'queryTable'],
    actions: [
      { key: 'get-record',        label: 'Get business object',        description: 'Retrieve a specific SAP business object by key or ID' },
      { key: 'create-record',     label: 'Create business object',     description: 'Create a new record in an SAP business system' },
      { key: 'update-record',     label: 'Update business object',     description: 'Modify an existing SAP record by ID' },
      { key: 'execute-function',  label: 'Execute BAPI / RFC',         description: 'Run a remote-enabled SAP function module or BAPI' },
      { key: 'query-table',       label: 'Query table data',           description: 'Search and filter rows from an SAP transparent table' },
    ],
  },
  salesforce: {
    shortDesc: 'Read and write Salesforce CRM records',
    description: 'The Salesforce tool gives your agent read and write access to Salesforce CRM data.',
    bullets: ['Add leads, contacts, opportunities, or cases', 'Modify existing CRM entries', 'Retrieve CRM data by ID or query'],
    tools: ['createRecord', 'updateRecord', 'getRecord', 'queryRecords', 'deleteRecord'],
  },
  forms: {
    shortDesc: 'Read responses and react to new form submissions',
    description: 'The Microsoft Forms tool lets your agent read form responses and trigger on new submissions.',
    bullets: ['Retrieve answers from form submissions', 'React when a form is filled out'],
    tools: ['getResponseDetails', 'listResponses', 'onNewResponse'],
  },
  planner: {
    shortDesc: 'Create and manage tasks in Microsoft Planner',
    description: 'The Planner tool enables your agent to create, update, and manage tasks in Microsoft Planner.',
    bullets: ['Add new tasks to any plan', 'Modify task details, assignees, and due dates', 'Retrieve tasks across buckets and plans', 'Organize tasks into categories'],
    tools: ['createTask', 'updateTask', 'getTask', 'listTasks', 'listBuckets', 'createBucket'],
  },
  'power bi': {
    shortDesc: 'Refresh datasets and query Power BI reports',
    description: 'The Power BI tool lets your agent refresh datasets and run queries against Power BI reports.',
    bullets: ['Trigger data refresh for Power BI reports', 'Execute DAX queries against datasets'],
    tools: ['refreshDataset', 'runQuery', 'listDatasets'],
  },
  whatsapp: {
    shortDesc: 'Send and receive WhatsApp Business messages',
    description: 'The WhatsApp tool enables your agent to send and receive messages via WhatsApp Business.',
    bullets: ['Deliver text or template messages', 'React to incoming WhatsApp messages'],
    tools: ['sendMessage', 'onNewMessage'],
  },
  website: {
    shortDesc: 'Embed your agent as a chat widget on any site',
    description: 'The Website tool embeds your agent as a chat widget on any web page.',
    bullets: ['Add a conversational agent to any website', 'Start conversations based on user activity'],
    tools: ['onWebChatMessage', 'sendWebChatMessage'],
  },
  m365: {
    shortDesc: 'Access M365 user profiles, calendar, and content',
    description: 'The Microsoft 365 tool gives your agent access to the full suite of Microsoft 365 services and data.',
    bullets: ['Read user profiles, calendar, and contacts', 'Orchestrate actions across M365 apps'],
    tools: ['getUserProfile', 'listContacts', 'searchContent', 'getOrgChart'],
  },
  'azure devops': {
    shortDesc: 'Manage work items, pipelines, and repos in Azure DevOps',
    description: 'The Azure DevOps tool lets your agent interact with boards, pipelines, and repositories in Azure DevOps.',
    bullets: ['Create, update, and query work items', 'Trigger and monitor CI/CD pipelines', 'Browse repos, commits, and pull requests', 'Manage sprints and team backlogs'],
    tools: ['getWorkItem', 'createWorkItem', 'updateWorkItem', 'listPipelines', 'runPipeline', 'listRepos', 'getPullRequests'],
  },
  github: {
    shortDesc: 'Manage issues, PRs, and repos on GitHub',
    description: 'The GitHub tool enables your agent to interact with GitHub repositories — opening issues, reviewing pull requests, and querying code.',
    bullets: ['Create and update issues', 'List and review pull requests', 'Browse repositories and commits', 'Comment on PRs and issues'],
    tools: ['createIssue', 'updateIssue', 'listPullRequests', 'getPullRequest', 'createComment', 'listRepos', 'getCommit'],
  },
};

/** Returns true if the connector with the given label is MCP type (vs connector-action). */
export const isConnectorMcp = (label: string): boolean =>
  !TOOL_META[label.toLowerCase()]?.actions;

const DEFAULT_META: ToolMeta = {
  shortDesc: 'Connect your agent to this service and automate tasks',
  description: 'This tool enables your agent to interact with the service and automate tasks.',
  bullets: ['Read data — retrieve records and content', 'Write data — create and update entries'],
  tools: ['getData', 'createRecord', 'updateRecord'],
};

function highlight(text: string, query: string) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <strong className="font-semibold">{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </>
  );
}

export const ToolsBrowserModal: React.FC<ToolsBrowserModalProps> = ({
  isOpen,
  anchorRect,
  onClose,
  onAdd,
  onDisconnect,
  onManage,
  connectedLabels = new Set(),
  onOpenMcpForm,
  onOpenRestApiForm,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [detail, setDetail] = useState<typeof TOOL_LIST[0] | null>(null);
  const [customMenuOpen, setCustomMenuOpen] = useState(false);
  type FlowStep = 'detail' | 'oauth' | 'connecting' | 'connected';
  const [flowStep, setFlowStep] = useState<FlowStep>('detail');
  const [oauthEmail, setOauthEmail] = useState('');
  const [selectedAction, setSelectedAction] = useState<ToolAction | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<{ key: string; label: string } | null>(null);

  // Stable ref so the effect below doesn't re-fire when the inline onAdd arrow changes reference
  const onAddRef = React.useRef(onAdd);
  onAddRef.current = onAdd;

  // Auto-advance: connecting → connected after 1.8s, and immediately add the tool
  useEffect(() => {
    if (flowStep !== 'connecting') return;
    const t = setTimeout(() => {
      setFlowStep('connected');
      if (detail) {
        const label = selectedAction ? `${detail.label} - ${selectedAction.label}` : detail.label;
        onAddRef.current({ key: detail.key, label });
      }
    }, 1800);
    return () => clearTimeout(t);
  }, [flowStep, detail, selectedAction]);

  const handleOauthLogin = () => {
    setFlowStep('connecting');
  };

  type SearchResult =
    | { kind: 'tool'; tool: typeof TOOL_LIST[0] }
    | { kind: 'action'; tool: typeof TOOL_LIST[0]; action: ToolAction };

  const { filtered, flatResults } = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = TOOL_LIST;
    if (filter === 'microsoft') list = list.filter((c) => MICROSOFT_KEYS.has(c.key));
    if (filter === 'other') list = list.filter((c) => !MICROSOFT_KEYS.has(c.key));

    if (!q) return { filtered: list, flatResults: null };

    const results: SearchResult[] = [];
    for (const tool of list) {
      if (tool.label.toLowerCase().includes(q)) {
        results.push({ kind: 'tool', tool });
      } else {
        const actions = TOOL_META[tool.key]?.actions ?? [];
        for (const action of actions) {
          if (action.label.toLowerCase().includes(q) || action.description.toLowerCase().includes(q)) {
            results.push({ kind: 'action', tool, action });
          }
        }
      }
    }
    return { filtered: list, flatResults: results };
  }, [search, filter]);

  const microsoftList = filtered.filter((c) => MICROSOFT_KEYS.has(c.key));
  const otherList = filtered.filter((c) => !MICROSOFT_KEYS.has(c.key));

  // Work IQ is always first in the Microsoft section
  const showWorkIQ = filter !== 'other' && (!search.trim() || 'work iq'.includes(search.toLowerCase().trim()));

  const handleClose = () => {
    setDetail(null);
    setSearch('');
    setFilter('all');
    setCustomMenuOpen(false);
    setFlowStep('detail');
    setSelectedAction(null);
    onClose();
  };

  const handleBackFromDetail = () => {
    setDetail(null);
    setFlowStep('detail');
    setSelectedAction(null);
  };

  const handleConnected = () => {
    setDetail(null);
    setFlowStep('detail');
    setSelectedAction(null);
    setSearch('');
    onClose();
  };

  const meta = detail ? (TOOL_META[detail.key] ?? DEFAULT_META) : null;

  const flyoutWidth = 360;
  const flyoutMaxHeight = 520;
  const pos = anchorRect
    ? {
        top: anchorRect.bottom + 6,
        left: Math.max(8, Math.min(anchorRect.right - flyoutWidth, window.innerWidth - flyoutWidth - 8)),
      }
    : { top: 80, left: window.innerWidth - flyoutWidth - 16 };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[998]" onClick={handleClose} />

      {/* Flyout */}
      <div
        className="fixed z-[999] bg-white rounded-2xl flex flex-col overflow-hidden"
        style={{
          top: pos.top,
          left: pos.left,
          width: flyoutWidth,
          ...(detail ? { height: flyoutMaxHeight } : { maxHeight: flyoutMaxHeight }),
          boxShadow: '0 8px 32px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 flex-shrink-0">
          {detail && flowStep !== 'connected' && flowStep !== 'connecting' && (
            <CopilotButton
              variant="ghost"
              size="sm"
              icon={<ChevronLeft20Regular />}
              onClick={flowStep === 'oauth' ? (selectedAction ? () => { setSelectedAction(null); setFlowStep('detail'); } : () => setFlowStep('detail')) : handleBackFromDetail}
              aria-label="Back"
            />
          )}
          <span className="text-sm font-semibold text-gray-900 flex-1">
            {!detail ? 'Add tool'
              : flowStep === 'oauth' ? `Sign in to ${detail.label}`
              : flowStep === 'connecting' ? 'Connecting…'
              : flowStep === 'connected' ? 'Connected'
              : selectedAction ? `${detail.label} — ${selectedAction.label}`
              : detail.label}
          </span>
          <CopilotButton
            variant="ghost"
            size="sm"
            icon={<Dismiss16Regular />}
            onClick={handleClose}
            aria-label="Close"
          />
        </div>

        {detail ? (
          /* ── Detail / OAuth / Connecting / Connected ─── */
          <div className="flex-1 overflow-y-auto flex flex-col">

            {/* ── OAuth / Connecting / Connected ── */}
            {flowStep !== 'detail' && (
              <div className="flex flex-col flex-1 px-6">
                <div className="flex-1" />

                {/* Icon */}
                <div className="flex justify-center mb-5">
                  <div className="relative w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center shadow-sm">
                    <img
                      src={detail.key === 'work iq' ? '/component-icons/WorkIQ.svg' : detail.src}
                      alt="" aria-hidden
                      className={`w-9 h-9 transition-opacity duration-300 ${flowStep === 'connecting' ? 'opacity-60' : 'opacity-100'}`}
                    />
                    {flowStep === 'connecting' && (<>
                      <div className="absolute inset-[-8px] rounded-[24px] bg-blue-400 opacity-20 animate-ping" style={{ animationDuration: '1.4s' }} />
                      <div className="absolute inset-[-4px] rounded-[20px] border-2 border-dashed border-blue-400 animate-spin" style={{ animationDuration: '3s' }} />
                    </>)}
                    {flowStep === 'connected' && (
                      <CheckmarkCircle20Filled className="absolute -bottom-1 -right-1 text-green-500 w-5 h-5 bg-white rounded-full" />
                    )}
                  </div>
                </div>

                {/* Text */}
                <div className="text-center mb-5">
                  {flowStep === 'oauth' && (<>
                    <p className="text-sm font-semibold text-gray-900">Sign in to {detail.label}</p>
                    <p className="text-xs text-gray-400 mt-1">to continue to Copilot Agent</p>
                  </>)}
                  {flowStep === 'connecting' && (<>
                    <p className="text-sm text-gray-500">Connecting to {detail.label}…</p>
                    {(MICROSOFT_KEYS.has(detail.key) || detail.key === 'work iq') && (
                      <p className="text-xs text-gray-400 mt-1">Using your Microsoft account</p>
                    )}
                  </>)}
                  {flowStep === 'connected' && (<>
                    <p className="text-sm font-semibold text-gray-900">{detail.label} connected</p>
                    <p className="text-xs text-gray-400 mt-1">Your agent is now connected to {detail.label}. Click on it in the list to manage.</p>
                  </>)}
                </div>

                {/* Action */}
                {flowStep === 'oauth' && (<>
                  {(MICROSOFT_KEYS.has(detail.key) || detail.key === 'work iq') && (
                    <>
                      <CopilotButton variant="secondary" size="md" className="w-full" onClick={handleOauthLogin}>
                        <img src="/component-icons/MicrosoftLogo.svg" alt="" aria-hidden className="w-3 h-3 mr-1.5 flex-shrink-0" />
                        Sign in with Microsoft
                      </CopilotButton>
                      <div className="flex items-center gap-3 my-3 w-full">
                        <div className="flex-1 h-px bg-gray-100" />
                        <span className="text-[11px] text-gray-400">or</span>
                        <div className="flex-1 h-px bg-gray-100" />
                      </div>
                    </>
                  )}
                  <div className="w-full flex flex-col gap-2.5 mb-3">
                    <CopilotInput
                      type="email"
                      placeholder="Email or username"
                      value={oauthEmail}
                      onChange={(e) => setOauthEmail(e.target.value)}
                      size="md"
                      autoFocus
                    />
                    <CopilotInput
                      type="password"
                      placeholder="Password"
                      size="md"
                    />
                  </div>
                  <CopilotButton variant="primary" size="md" className="w-full" onClick={handleOauthLogin}>
                    Log in
                  </CopilotButton>
                  <p className="text-[11px] text-gray-400 text-center mt-3 leading-relaxed">
                    By logging in you allow Copilot Agent to access your {detail.label} account.
                  </p>
                </>)}
                {flowStep === 'connected' && (<div className="w-full flex flex-col gap-2">
                  <CopilotButton variant="primary" size="md" className="w-full" onClick={() => {
                    if (!detail) return;
                    onManage?.({ key: detail.key, label: detail.label, isMcp: !TOOL_META[detail.key]?.actions, isMicrosoft: MICROSOFT_KEYS.has(detail.key) });
                    setDetail(null);
                    setFlowStep('detail');
                    setSearch('');
                    onClose();
                  }}>
                    Manage tool
                  </CopilotButton>
                  <CopilotButton variant="secondary" size="md" className="w-full" onClick={() => {
                    setDetail(null);
                    setFlowStep('detail');
                    setSearch('');
                  }}>
                    Add another
                  </CopilotButton>
                </div>)}

                <div className="flex-1" />
              </div>
            )}

            {/* ── Detail view ── */}
            {flowStep === 'detail' && (<>
            {/* Header row — always shown */}
            {(() => {
              const isConnected = connectedLabels.has(detail.label);
              return (
                <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <img src={detail.key === 'work iq' ? '/component-icons/WorkIQ.svg' : detail.src} alt="" aria-hidden className="w-6 h-6" />
                      {isConnected && (
                        <CheckmarkCircle20Filled className="absolute -bottom-1 -right-1 text-green-500 w-4 h-4 bg-white rounded-full" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{detail.label}</p>
                      <p className="text-xs text-gray-400">{isConnected ? 'Connected' : detail.key === 'work iq' ? 'Built-in intelligence' : meta?.actions ? 'Connector' : 'MCP'}</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {isConnected ? (
                      <CopilotButton
                        variant="secondary"
                        size="sm"
                        onClick={() => setDisconnectTarget({ key: detail.key, label: detail.label })}
                      >
                        Disconnect
                      </CopilotButton>
                    ) : !meta?.actions && (
                      <CopilotButton variant="primary" size="sm" onClick={() => setFlowStep(MICROSOFT_KEYS.has(detail.key) || detail.key === 'work iq' ? 'connecting' : 'oauth')}>
                        Connect
                      </CopilotButton>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Actions-based tool (e.g. SAP) — show actions list only, skip overview */}
            {meta!.actions && !connectedLabels.has(detail.label) ? (
              <div>
                <p className="px-4 pt-3 pb-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  Actions
                </p>
                {meta!.actions.map((action) => (
                  <div
                    key={action.key}
                    role="button"
                    tabIndex={0}
                    onClick={() => { setSelectedAction(action); setFlowStep('oauth'); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSelectedAction(action); setFlowStep('oauth'); } }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <PlugConnected20Regular className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{action.label}</p>
                      <p className="text-[11px] text-gray-400 leading-snug mt-0.5">{action.description}</p>
                    </div>
                    <ChevronRight20Regular className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              /* Overview + tools — for non-action tools */
              <div className="flex flex-col gap-4 p-4">
                <div className="rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-gray-900">Overview</span>
                    <Info16Regular className="text-gray-400 w-3.5 h-3.5" />
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {meta!.description}{' '}
                    {detail.key === 'work iq' && (
                      <a href="#" className="text-blue-600 hover:underline" onClick={(e) => e.preventDefault()}>Learn more</a>
                    )}
                  </p>
                  {detail.key === 'work iq' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { src: '/component-icons/Outlook24.svg', label: 'Outlook' },
                        { src: '/component-icons/SharePoint24.svg', label: 'SharePoint' },
                        { src: '/component-icons/OneDrive24.svg', label: 'OneDrive' },
                        { src: '/component-icons/Teams24.svg', label: 'Teams' },
                        { src: '/component-icons/Excel24.svg', label: 'Excel' },
                        { src: '/component-icons/Word24.svg', label: 'Word' },
                      ].map(({ src, label }) => (
                        <div key={label} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-50 border border-gray-100">
                          <img src={src} alt="" aria-hidden className="w-4 h-4 flex-shrink-0" />
                          <span className="text-[11px] text-gray-600 font-medium">{label}</span>
                        </div>
                      ))}
                      <span className="text-[11px] text-gray-400 font-medium">+3 more</span>
                    </div>
                  )}
                  <ul className="flex flex-col gap-1.5">
                    {meta!.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-gray-900">Tools ({meta!.tools.length})</span>
                    <Info16Regular className="text-gray-400 w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {meta!.tools.map((tool) => (
                      <span key={tool} className="px-2 py-0.5 rounded-full bg-gray-100 text-[11px] text-gray-700 font-mono">
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
            </>)}
          </div>
        ) : (
          /* ── List view ── */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Search + filter tabs */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-3 flex-shrink-0">
              <div className="flex-1">
                <CopilotInput
                  placeholder="Search tools..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  size="sm"
                  appearance="filled-darker"
                  contentBefore={<Search20Regular className="text-gray-400" />}
                  contentAfter={search ? (
                    <CopilotButton
                      variant="transparent"
                      size="sm"
                      icon={<Dismiss20Regular />}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setSearch('')}
                      aria-label="Clear search"
                    />
                  ) : undefined}
                  className="w-full"
                />
              </div>
              {/* Filter dropdown */}
              <CopilotDropdown
                size="sm"
                variant="dropdown"
                value={filter}
                onChange={(v) => setFilter(v as FilterTab)}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'microsoft', label: 'By Microsoft' },
                  { value: 'other', label: 'Other' },
                ]}
              />
            </div>

            {/* Tool list */}
            <div className="flex-1 overflow-y-auto">
              {flatResults !== null && flatResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <p className="text-sm text-gray-500">No tools match "{search}"</p>
                </div>
              ) : flatResults !== null ? (
                /* ── Flat search results ── */
                <div>
                  {flatResults.map((result, i) => {
                    if (result.kind === 'tool') {
                      const { tool } = result;
                      const isConnected = connectedLabels.has(tool.label);
                      return (
                        <div
                          key={`tool-${tool.key}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => setDetail(tool)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setDetail(tool); }}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <div className="relative w-6 h-6 flex-shrink-0">
                            <img src={tool.src} alt="" aria-hidden className="w-6 h-6" />
                            {isConnected && (
                              <CheckmarkCircle20Filled className="absolute -bottom-0.5 -right-0.5 text-green-500 w-3.5 h-3.5 bg-white rounded-full" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="text-sm text-gray-800 truncate">{highlight(tool.label, search)}</span>
                          </div>
                          <ChevronRight20Regular className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        </div>
                      );
                    } else {
                      const { tool, action } = result;
                      return (
                        <div
                          key={`action-${tool.key}-${action.key}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => { setDetail(tool); setSelectedAction(action); setFlowStep('oauth'); }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setDetail(tool); setSelectedAction(action); setFlowStep('oauth'); } }}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <PlugConnected20Regular className="w-4 h-4 text-gray-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 truncate">{highlight(action.label, search)}</p>
                            <p className="text-[11px] text-gray-400 truncate">{tool.label}</p>
                          </div>
                          <ChevronRight20Regular className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        </div>
                      );
                    }
                  })}
                </div>
              ) : (
                <>
                  {/* By Microsoft section */}
                  {(microsoftList.length > 0 || showWorkIQ) && (
                    <div className="mb-2">
                      {filter === 'all' && (
                        <p className="px-4 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                          By Microsoft
                        </p>
                      )}
                      {/* Work IQ — featured card at top */}
                        {showWorkIQ && (() => {
                          const isConnected = connectedLabels.has(WORK_IQ_ENTRY.label);
                          return (
                            <div
                              key="work iq"
                              role="button"
                              tabIndex={0}
                              onClick={() => setDetail(WORK_IQ_ENTRY)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setDetail(WORK_IQ_ENTRY); }}
                              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                              <div className="relative w-6 h-6 flex-shrink-0">
                                <img src="/component-icons/WorkIQ.svg" alt="" aria-hidden className="w-6 h-6" />
                                {isConnected && (
                                  <CheckmarkCircle20Filled className="absolute -bottom-0.5 -right-0.5 text-green-500 w-3.5 h-3.5 bg-white rounded-full" />
                                )}
                              </div>
                              <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{highlight('Work IQ', search)}</span>
                              <ChevronRight20Regular className="w-4 h-4 text-gray-300 flex-shrink-0" />
                            </div>
                          );
                        })()}
                        {/* Microsoft tools — list rows */}
                        {microsoftList.map((tool) => {
                          const isConnected = connectedLabels.has(tool.label);
                          return (
                            <div
                              key={tool.key}
                              role="button"
                              tabIndex={0}
                              onClick={() => setDetail(tool)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setDetail(tool); }}
                              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                              <div className="relative w-6 h-6 flex-shrink-0">
                                <img src={tool.src} alt="" aria-hidden className="w-6 h-6" />
                                {isConnected && (
                                  <CheckmarkCircle20Filled className="absolute -bottom-0.5 -right-0.5 text-green-500 w-3.5 h-3.5 bg-white rounded-full" />
                                )}
                              </div>
                              <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{tool.label}</span>
                              <ChevronRight20Regular className="w-4 h-4 text-gray-300 flex-shrink-0" />
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* Other section */}
                  {otherList.length > 0 && (
                    <div>
                      {filter === 'all' && (
                        <p className="px-4 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                          Other
                        </p>
                      )}
                        {otherList.map((tool) => {
                          const isConnected = connectedLabels.has(tool.label);
                          return (
                            <div
                              key={tool.key}
                              role="button"
                              tabIndex={0}
                              onClick={() => setDetail(tool)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setDetail(tool); }}
                              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                              <div className="relative w-6 h-6 flex-shrink-0">
                                <img src={tool.src} alt="" aria-hidden className="w-6 h-6" />
                                {isConnected && (
                                  <CheckmarkCircle20Filled className="absolute -bottom-0.5 -right-0.5 text-green-500 w-3.5 h-3.5 bg-white rounded-full" />
                                )}
                              </div>
                              <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{tool.label}</span>
                              <ChevronRight20Regular className="w-4 h-4 text-gray-300 flex-shrink-0" />
                            </div>
                          );
                        })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer — custom tool */}
            <div className="flex-shrink-0 border-t border-gray-100 px-4 py-2 relative">
              {/* Options menu — pops up above the button */}
              {customMenuOpen && (
                <div className="absolute bottom-full left-4 right-4 mb-1 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-lg z-10">
                  {[
                    { label: 'MCP server', desc: 'Connect via Model Context Protocol' },
                    { label: 'REST API', desc: 'Connect via HTTP REST endpoints' },
                  ].map(({ label, desc }) => (
                    <div
                      key={label}
                      role="button"
                      tabIndex={0}
                      onClick={() => { setCustomMenuOpen(false); if (label === 'MCP server') { onClose(); onOpenMcpForm?.(); } else if (label === 'REST API') { onClose(); onOpenRestApiForm?.(); } }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setCustomMenuOpen(false); if (label === 'MCP server') { onClose(); onOpenMcpForm?.(); } else if (label === 'REST API') { onClose(); onOpenRestApiForm?.(); } } }}
                      className="flex items-center gap-3 px-3 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800">{label}</p>
                        <p className="text-[11px] text-gray-400">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <CopilotButton
                variant="ghost"
                size="sm"
                icon={<Add20Regular />}
                onClick={() => setCustomMenuOpen((o) => !o)}
              >
                Add custom
              </CopilotButton>
            </div>
          </div>
        )}
      </div>

      {/* Disconnect confirmation dialog */}
      <Dialog isOpen={!!disconnectTarget} onClose={() => setDisconnectTarget(null)} maxWidth="sm">
        <DialogHeader onClose={() => setDisconnectTarget(null)}>
          <DialogTitle>Disconnect {disconnectTarget?.label}?</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p className="text-sm text-gray-600">
            Disconnecting <strong>{disconnectTarget?.label}</strong> won't affect your agent right away — it will continue working as-is until you publish. After publishing, the agent will no longer have access to this tool.
          </p>
        </DialogContent>
        <DialogFooter>
          <CopilotButton variant="secondary" onClick={() => setDisconnectTarget(null)}>
            Cancel
          </CopilotButton>
          <CopilotButton
            variant="primary"
            icon={<PlugDisconnected20Regular />}
            className="bg-red-600 hover:bg-red-700 active:bg-red-800"
            onClick={() => {
              if (disconnectTarget) {
                onDisconnect(disconnectTarget);
                setDisconnectTarget(null);
                setDetail(null);
              }
            }}
          >
            Disconnect
          </CopilotButton>
        </DialogFooter>
      </Dialog>

    </>
  );
};
