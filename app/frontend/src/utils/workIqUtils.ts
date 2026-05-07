/**
 * Work IQ utility — MCP server registry and mocked context query.
 *
 * Work IQ is the intelligence layer that provides situational awareness of a
 * user's Microsoft 365 work context (emails, meetings, Teams messages,
 * documents, and people/org signals). These utilities are prototype-only;
 * no real backend calls are made.
 */

// ── Design tokens ─────────────────────────────────────────────────────────────
// Consolidated here so WorkIQCard and WorkIQDetailPanel share the same values.

/** Fluent M365 brand / colorBrandForeground1 */
export const WORK_IQ_BRAND_COLOR = '#464feb';
/** M365 brand border (Global.Color.Brand.M365.150) */
export const WORK_IQ_BORDER_COLOR = '#ccd6ff';
/** Success tint background */
export const WORK_IQ_ENABLED_BG = '#e6f4ea';
/** Success text color */
export const WORK_IQ_ENABLED_TEXT = '#1a7f37';

// ── Constants ─────────────────────────────────────────────────────────────────

export const WORK_IQ_MCP_SERVERS: string[] = [
  'Microsoft Admin Center MCP Server',
  'Mail MCP Server',
  'Calendar MCP Server',
  'Word MCP Server',
  'Teams MCP Server',
  'ODSP MCP Server',
  'User Profile MCP Server',
  'M365Copilot MCP Server',
  'SharePoint Lists MCP Server',
];

/** The only server enabled when Work IQ is first turned on. */
export const WORK_IQ_DEFAULT_SERVERS: string[] = ['M365Copilot MCP Server'];

/** Short display icon path per server key (best-effort match). */
export const WORK_IQ_SERVER_ICON: Record<string, string> = {
  'Microsoft Admin Center MCP Server': '/component-icons/Microsoft36524.svg',
  'Mail MCP Server':                   '/component-icons/Outlook24.svg',
  'Calendar MCP Server':               '/component-icons/Outlook24.svg',
  'Word MCP Server':                   '/component-icons/Word24.svg',
  'Teams MCP Server':                  '/component-icons/Teams24.svg',
  'ODSP MCP Server':                   '/component-icons/OneDrive24.svg',
  'User Profile MCP Server':           '/component-icons/Microsoft36524.svg',
  'M365Copilot MCP Server':            '/component-icons/Microsoft36524.svg',
  'SharePoint Lists MCP Server':       '/component-icons/SharePoint24.svg',
};

/**
 * Tab strip label per server — slightly longer than pill label to match Figma tab strip.
 * Falls back to name.replace(' Server', '') for unlisted servers.
 */
export const WORK_IQ_TAB_LABEL: Record<string, string> = {
  'M365Copilot MCP Server': 'M365 Copilot Search MCP',
};

/** Helper: get the tab strip label for a server. */
export function getWorkIQTabLabel(name: string): string {
  return WORK_IQ_TAB_LABEL[name] ?? name.replace(' Server', '');
}

/** Compact pill/tab label per server (matches Figma). */
export const WORK_IQ_PILL_LABEL: Record<string, string> = {
  'Microsoft Admin Center MCP Server': 'Admin Center MCP',
  'Mail MCP Server':                   'Outlook Mail MCP',
  'Calendar MCP Server':               'Calendar MCP',
  'Word MCP Server':                   'Word MCP',
  'Teams MCP Server':                  'Teams MCP',
  'ODSP MCP Server':                   'ODSP MCP',
  'User Profile MCP Server':           'User Profile MCP',
  'M365Copilot MCP Server':            'M365 Copilot Search MCP',
  'SharePoint Lists MCP Server':       'SharePoint MCP',
};

/** One-paragraph description shown in the Overview tab of each MCP server. */
export const WORK_IQ_SERVER_DESCRIPTION: Record<string, string> = {
  'Microsoft Admin Center MCP Server': 'Provides access to Microsoft 365 admin capabilities, including user management, license assignment, and tenant configuration.',
  'Mail MCP Server':                   'Connects to Outlook to read, search, and send emails on behalf of the signed-in user, respecting permissions and policies.',
  'Calendar MCP Server':               'Access and manage calendar events, check availability, and schedule meetings in Outlook on behalf of the user.',
  'Word MCP Server':                   'Read and edit Microsoft Word documents stored in OneDrive or SharePoint, with full respect for file permissions.',
  'Teams MCP Server':                  'Send and receive messages in Microsoft Teams channels and direct chats, enabling conversational context from the user\'s workspace.',
  'ODSP MCP Server':                   'Browse, read, and upload files in OneDrive for Business and SharePoint document libraries, scoped to user permissions.',
  'User Profile MCP Server':           'Retrieve user profiles, organizational hierarchy, and people-search results from the Microsoft 365 directory.',
  'M365Copilot MCP Server':            'Semantic enterprise search powered by Microsoft 365 Copilot, surfacing relevant emails, meetings, files, and people signals for grounded answers.',
  'SharePoint Lists MCP Server':       'Read and write items in SharePoint Lists to access structured, tabular data from across the organization.',
};

/** Mock tools exposed by each MCP server. */
export interface WorkIQTool {
  name: string;
  description: string;
}

export const WORK_IQ_SERVER_TOOLS: Record<string, WorkIQTool[]> = {
  'Microsoft Admin Center MCP Server': [
    { name: 'List users',       description: 'List all users in the tenant' },
    { name: 'Get user details', description: 'Retrieve details for a specific user' },
    { name: 'Update license',   description: 'Update a user\'s license assignment' },
  ],
  'Mail MCP Server': [
    { name: 'Read emails',  description: 'Read emails from the Outlook inbox' },
    { name: 'Send email',   description: 'Send an email on behalf of the signed-in user' },
    { name: 'Search email', description: 'Search emails by keyword, sender, or date range' },
  ],
  'Calendar MCP Server': [
    { name: 'Get events',       description: 'Retrieve upcoming calendar events' },
    { name: 'Create event',     description: 'Create a new calendar event for the user' },
    { name: 'Find availability', description: 'Find free/busy time slots for one or more users' },
  ],
  'Word MCP Server': [
    { name: 'Read document', description: 'Read the content of a Word document' },
    { name: 'Edit document', description: 'Apply edits to a Word document' },
  ],
  'Teams MCP Server': [
    { name: 'Send message',  description: 'Send a message to a Teams channel or chat' },
    { name: 'Read messages', description: 'Read messages from a Teams channel or chat' },
    { name: 'List channels', description: 'List channels available in a Teams workspace' },
  ],
  'ODSP MCP Server': [
    { name: 'List files',   description: 'List files and folders in OneDrive or SharePoint' },
    { name: 'Read file',    description: 'Read the content of a file' },
    { name: 'Upload file',  description: 'Upload a file to OneDrive or SharePoint' },
  ],
  'User Profile MCP Server': [
    { name: 'Get profile',   description: "Retrieve a user's Microsoft 365 profile" },
    { name: 'Get org chart', description: 'Retrieve the organizational hierarchy' },
    { name: 'Search people', description: 'Search for people across the organization' },
  ],
  'M365Copilot MCP Server': [
    { name: 'Enterprise search',       description: 'Search across Microsoft 365 for relevant content' },
    { name: 'Get meeting insights',    description: 'Retrieve insights and summaries from recent meetings' },
    { name: 'Content recommendations', description: 'Get personalized content recommendations' },
  ],
  'SharePoint Lists MCP Server': [
    { name: 'Get list items',    description: 'Retrieve items from a SharePoint list' },
    { name: 'Create list item',  description: 'Add a new item to a SharePoint list' },
    { name: 'Update list item',  description: 'Update an existing item in a SharePoint list' },
  ],
};

/** Two-paragraph overview per server — matches Figma Overview card. */
export const WORK_IQ_SERVER_OVERVIEW: Record<string, [string, string]> = {
  'Microsoft Admin Center MCP Server': [
    'The Microsoft Admin Center MCP server is a Microsoft-built Model Context Protocol (MCP) server that gives your agent direct access to Microsoft 365 tenant administration capabilities, including user management, license assignments, and service health.',
    'It enables your agent to look up user accounts, manage licenses, reset passwords, and monitor service status—all while respecting role-based access controls and admin policies configured in your Microsoft 365 tenant.',
  ],
  'Mail MCP Server': [
    'The Mail MCP server is a Microsoft-built Model Context Protocol (MCP) server that connects your agent to Microsoft Outlook, enabling it to read, search, and compose email on behalf of the signed-in user.',
    'Your agent can retrieve recent messages, search by sender or keyword, draft replies, and send emails—while fully respecting the user\'s mailbox permissions, organizational policies, and data-loss prevention rules.',
  ],
  'Calendar MCP Server': [
    'The Calendar MCP server is a Microsoft-built Model Context Protocol (MCP) server that gives your agent access to the signed-in user\'s Outlook calendar, including events, availability, and meeting details.',
    'Your agent can retrieve upcoming events, check free/busy windows for scheduling, create new meetings, and update existing appointments—respecting calendar sharing permissions and organizational scheduling policies.',
  ],
  'Word MCP Server': [
    'The Word MCP server is a Microsoft-built Model Context Protocol (MCP) server that enables your agent to read and edit Microsoft Word documents stored in OneDrive or SharePoint.',
    'Your agent can extract text, tables, and structured content from .docx files, apply tracked changes, and save updated documents—all while respecting the file permissions and document-protection settings configured by the document owner.',
  ],
  'Teams MCP Server': [
    'The Teams MCP server is a Microsoft-built Model Context Protocol (MCP) server that connects your agent to Microsoft Teams, giving it access to messages, channels, and chat conversations.',
    'Your agent can read channel messages, send replies, list members, and surface relevant discussions from the user\'s workspace—respecting Teams policies, message-retention rules, and channel permissions.',
  ],
  'ODSP MCP Server': [
    'The OneDrive and SharePoint (ODSP) MCP server is a Microsoft-built Model Context Protocol (MCP) server that gives your agent access to files and document libraries stored in OneDrive for Business and SharePoint.',
    'Your agent can browse folder structures, retrieve file content, upload documents, and manage version history—scoped to the permissions granted to the signed-in user and governed by SharePoint information-protection policies.',
  ],
  'User Profile MCP Server': [
    'The User Profile MCP server is a Microsoft-built Model Context Protocol (MCP) server that exposes organizational people data from Microsoft Entra ID (Azure AD), including profile details, reporting relationships, and presence.',
    'Your agent can look up colleagues by name or role, retrieve org-chart hierarchies, and surface contact information and expertise—helping it answer questions that depend on knowing who people are and how they relate to each other.',
  ],
  'M365Copilot MCP Server': [
    'The Microsoft 365 Copilot Search MCP server is a Microsoft-built Model Context Protocol (MCP) server that gives your agent direct access to Microsoft 365 Copilot\'s enterprise search and reasoning capabilities.',
    'It lets your agent search, discover, and reason across all Microsoft 365 content—including files, emails, meetings, chats, sites, and reports—using the same intelligence that powers Microsoft 365 Copilot. The server exposes this capability as a deterministic, auditable search tool, enabling multi-turn, grounded conversations over organizational data while respecting Microsoft 365 permissions and admin policies.',
  ],
  'SharePoint Lists MCP Server': [
    'The SharePoint Lists MCP server is a Microsoft-built Model Context Protocol (MCP) server that gives your agent read and write access to structured list data stored in SharePoint.',
    'Your agent can query list items, create new entries, update existing records, and filter by column values—enabling it to interact with tabular business data such as project trackers, asset inventories, and approval queues while respecting item-level permissions.',
  ],
};

/** Mock resources exposed by each MCP server (simulates MCP Resource protocol). */
export interface WorkIQResource {
  name: string;
  description: string;
}

export const WORK_IQ_SERVER_RESOURCES: Record<string, WorkIQResource[]> = {
  'Microsoft Admin Center MCP Server': [
    { name: 'Tenant_User_Report',     description: 'Summary of all active and licensed users in the M365 tenant, including sign-in status and assigned products.' },
    { name: 'License_Usage_Summary',  description: 'Breakdown of license consumption across SKUs, including available seats and expiration dates.' },
    { name: 'Service_Health_Status',  description: 'Current and historical health incidents for Microsoft 365 services affecting the tenant.' },
    { name: 'Admin_Audit_Log',        description: 'Recent admin activity log including role changes, policy updates, and configuration modifications.' },
  ],
  'Mail MCP Server': [
    { name: 'Inbox_Recent_Emails',    description: 'The 50 most recent emails in the signed-in user\'s Outlook inbox, including sender, subject, and snippets.' },
    { name: 'Sent_Items_Last30Days',  description: 'Emails sent by the user in the past 30 days, sorted by date.' },
    { name: 'Flagged_Messages',       description: 'All messages the user has flagged for follow-up, with due dates where set.' },
    { name: 'Email_Search_Index',     description: 'Full-text search index over the user\'s mailbox, used for keyword-based retrieval.' },
  ],
  'Calendar MCP Server': [
    { name: 'Upcoming_Events_7d',     description: 'All calendar events scheduled in the next 7 days for the signed-in user.' },
    { name: 'Recurring_Meetings',     description: 'List of all recurring meeting series the user participates in, with frequency and attendees.' },
    { name: 'Room_Availability',      description: 'Real-time availability of meeting rooms and shared resources in the tenant.' },
    { name: 'Out_of_Office_Settings', description: 'Current automatic-reply and out-of-office configuration for the signed-in user.' },
  ],
  'Word MCP Server': [
    { name: 'Recent_Documents',       description: 'The 20 most recently opened or edited Word documents from OneDrive and SharePoint.' },
    { name: 'Shared_With_Me_Docs',    description: 'Word documents shared directly with the signed-in user from other colleagues.' },
    { name: 'Template_Library',       description: 'Organizational Word templates available for the tenant, including approved branding assets.' },
  ],
  'Teams MCP Server': [
    { name: 'My_Teams_Channels',      description: 'List of all Teams and channels the signed-in user is a member of, with activity status.' },
    { name: 'Recent_Messages',        description: 'The 100 most recent messages across all channels and chats the user participates in.' },
    { name: 'Pinned_Messages',        description: 'Messages pinned by the user or channel owners across relevant channels.' },
    { name: 'Unread_Activity_Feed',   description: 'Unread mentions, replies, and reactions from the user\'s Teams activity feed.' },
  ],
  'ODSP MCP Server': [
    { name: 'Q1_Financial_Snapshot',        description: 'Summary of key financial metrics for Q1 2025 including revenue, operating margin, and regional performance breakdowns.' },
    { name: 'Q2_2025_Performance',          description: 'Comparative analysis of retail and tech sectors based on Q2 earnings, growth rates, and cost structures.' },
    { name: 'Scenario_Stress_Testing',      description: 'Simulated financial outcomes under various stress scenarios including interest rate hikes and supply chain disruptions.' },
    { name: 'Pre_vs_Post_Merger_Financials', description: 'A side-by-side comparison of Contoso\'s financials before and after its merger with Fabrikam.' },
  ],
  'User Profile MCP Server': [
    { name: 'Org_Chart_Hierarchy',    description: 'Full organizational chart for the tenant, including reporting lines and department structures.' },
    { name: 'People_Directory',       description: 'Searchable directory of all employees with profile photos, titles, and contact info.' },
    { name: 'Skills_Expertise_Index', description: 'Aggregated skills and expertise tags from user profiles across the organization.' },
    { name: 'Manager_Chains',         description: 'Manager-to-direct-report chains for relevant users, up to the C-suite level.' },
  ],
  'M365Copilot MCP Server': [
    { name: 'Q1_Financial_Snapshot',        description: 'Summary of key financial metrics for Q1 2025 including revenue, operating margin, and regional performance breakdowns.' },
    { name: 'Q2_2025_Performance',          description: 'Comparative analysis of retail and tech sectors based on Q2 earnings, growth rates, and cost structures.' },
    { name: 'Scenario_Stress_Testing',      description: 'Simulated financial outcomes under various stress scenarios including interest rate hikes and supply chain disruptions.' },
    { name: 'Pre_vs_Post_Merger_Financials', description: 'A side-by-side comparison of Contoso\'s financials before and after its merger with Fabrikam.' },
  ],
  'SharePoint Lists MCP Server': [
    { name: 'Project_Tracker_List',   description: 'Active project status entries including owners, milestones, RAG status, and target completion dates.' },
    { name: 'Asset_Inventory_List',   description: 'IT asset registry with device assignments, purchase dates, warranty status, and locations.' },
    { name: 'Approval_Queue_List',    description: 'Pending approval requests from across the organization, with requestor, type, and priority.' },
    { name: 'HR_Policy_Library_List', description: 'Structured list of HR policies with version numbers, effective dates, and owning departments.' },
  ],
};

// ── Types ─────────────────────────────────────────────────────────────────────

export type WorkIQResultType = 'email' | 'meeting' | 'chat' | 'file';

export interface WorkIQResult {
  type: WorkIQResultType;
  title: string;
  snippet: string;
}

export interface WorkIQQueryResponse {
  results: WorkIQResult[];
  empty: boolean;
}

// ── Mocked query ──────────────────────────────────────────────────────────────

const MOCK_RESULTS: WorkIQResult[] = [
  {
    type: 'email',
    title: 'RE: Q3 Project Kickoff',
    snippet: 'Sarah mentioned the deadline is end of next month and we need the agent to handle routing to Tier 2 support.',
  },
  {
    type: 'meeting',
    title: 'Weekly Agent Design Sync — yesterday',
    snippet: 'Team aligned on using SharePoint as the primary knowledge source; Teams channel is the preferred deployment target.',
  },
  {
    type: 'file',
    title: 'Agent-Requirements-v3.docx',
    snippet: 'Contains acceptance criteria, persona definitions, and a list of approved data sources for the agent.',
  },
  {
    type: 'chat',
    title: 'Teams channel: AI Agents CoE',
    snippet: 'Multiple team members asking for an FAQ agent that covers HR policies and IT helpdesk tickets.',
  },
];

// ── Auto-enable heuristic ─────────────────────────────────────────────────────

const M365_KEYWORDS = [
  'email', 'emails', 'outlook', 'mail',
  'teams', 'meeting', 'meetings', 'calendar', 'schedule',
  'sharepoint', 'onedrive', 'document', 'documents', 'word', 'excel',
  'microsoft 365', 'm365', 'copilot',
  'chat', 'channel', 'colleague',
  'org chart', 'org', 'directory', 'people', 'employee', 'employees',
  'planner', 'task', 'project',
];

const M365_CHANNELS = new Set([
  'teams', 'outlook', 'email', 'sharepoint', 'onedrive',
  'microsoft 365', 'm365', 'planner', 'forms', 'dataverse',
]);

/**
 * Returns true when the agent config has enough M365/work signals that
 * Work IQ would meaningfully improve answer quality.
 */
export function shouldAutoEnableWorkIQ(agent: {
  name?: string;
  description?: string;
  instructions?: string;
  channel?: string;
  audience?: string | null;
}): boolean {
  // Employees-facing agents almost always benefit from Work IQ
  if (agent.audience === 'employees') return true;

  // M365-specific deployment channels
  if (agent.channel && M365_CHANNELS.has(agent.channel.toLowerCase())) return true;

  // Keyword scan across name + description + instructions
  const text = [agent.name, agent.description, agent.instructions]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const matchCount = M365_KEYWORDS.filter(kw => text.includes(kw)).length;
  // Require at least 2 distinct keyword hits to avoid false positives
  return matchCount >= 2;
}

// ── Mocked query ──────────────────────────────────────────────────────────────

/**
 * Mocked Work IQ query. Simulates a context fetch against the user's M365 data.
 * Pass `empty: true` to get the empty-results fixture for demo purposes.
 */
export async function mockedWorkIqQuery(
  _agentDescription: string,
  options: { empty?: boolean } = {}
): Promise<WorkIQQueryResponse> {
  // Simulate a short network round-trip
  await new Promise(resolve => setTimeout(resolve, 600));

  if (options.empty) {
    return { results: [], empty: true };
  }

  return { results: MOCK_RESULTS.slice(0, 3), empty: false };
}

/** Build a plain-English summary of Work IQ results to include in a chat message. */
export function summariseWorkIQResults(response: WorkIQQueryResponse): string {
  if (response.empty || response.results.length === 0) {
    return "Work IQ didn't find any directly relevant emails, meetings, or documents for this context. I'll proceed with general best practices.";
  }

  const lines = response.results.map(r => {
    const label = r.type === 'email' ? '📧' : r.type === 'meeting' ? '📅' : r.type === 'file' ? '📄' : '💬';
    return `- ${label} **${r.title}**: ${r.snippet}`;
  });

  return `Work IQ found the following relevant context:\n\n${lines.join('\n')}`;
}
