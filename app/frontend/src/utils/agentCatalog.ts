/**
 * Canonical catalog of available triggers and tools for the Elevate platform.
 *
 * Single source of truth — imported by BuildPage, agentCreation, and helperAgent.
 * Update this file when adding new connectors; changes propagate everywhere automatically.
 */

// ── Triggers ────────────────────────────────────────────────────────────────

export const KNOWN_TRIGGERS: string[] = [
  // ── Conversational channel triggers ────────────────────────────────────────
  'Teams - When a user messages in Teams',
  'Teams - On New Channel Message',
  'Teams - On New Chat Message',
  'Teams - At Mention',
  'Microsoft 365 - When a user messages in Microsoft 365',
  'Website - When a user messages on Website',
  'Slack - When a user messages in Slack',
  'WhatsApp - When a user messages in WhatsApp',
  'SharePoint - When a user messages in SharePoint',
  // ── Email ──────────────────────────────────────────────────────────────────
  'Outlook - On New Email',
  'Outlook - On Flagged Email',
  // ── SharePoint / OneDrive ──────────────────────────────────────────────────
  'SharePoint - On New Items',
  'SharePoint - On New File',
  'SharePoint - On Updated Items',
  'SharePoint - On Changed Items',
  'SharePoint - On Updated File',
  'OneDrive - On New File',
  'OneDrive - On Updated File',
  // ── Scheduled ─────────────────────────────────────────────────────────────
  'Recurrence',
  // ── Other event triggers ──────────────────────────────────────────────────
  'Forms - On New Form Submission',
  'Dataverse - On Webhook',
  'Planner - On Completed Task',
];

// ── Connectors ──────────────────────────────────────────────────────────────

export const KNOWN_CONNECTORS: string[] = [
  'Work IQ',
];

// ── Actions / tools ──────────────────────────────────────────────────────────

export const KNOWN_TOOLS: string[] = [
  // ── Copilot ────────────────────────────────────────────────────────────────
  'Copilot - Generate text',
  'Copilot - Analyze an image',
  'Copilot - Generate images',
  // ── Microsoft 365 ──────────────────────────────────────────────────────────
  // Outlook
  'Outlook - Send an email',
  'Outlook - Get emails',
  'Outlook - Reply to an email',
  'Outlook - Forward an email',
  'Outlook - Move email',
  'Outlook - Flag an email',
  'Outlook - Get Calendar View of Events',
  'Outlook - Create an Event',
  // Teams
  'Teams - Post message in a chat or channel',
  'Teams - Post adaptive card in a chat or channel',
  'Teams - Create a chat',
  'Teams - Get a Message',
  'Teams - List Messages',
  'Teams - Get Channel',
  'Teams - List Channels',
  'Teams - Get @mention token for a user',
  // SharePoint
  'SharePoint - Get items',
  'SharePoint - Create item',
  'SharePoint - Update item',
  'SharePoint - Delete item',
  'SharePoint - Get file content',
  'SharePoint - Create file',
  'SharePoint - Copy file',
  'SharePoint - Get files',
  // OneDrive
  'OneDrive - Get file content',
  'OneDrive - Create file',
  'OneDrive - Update file',
  'OneDrive - Copy file',
  'OneDrive - List files in folder',
  // Excel Online
  'Excel Online - Get a row',
  'Excel Online - List rows in a table',
  'Excel Online - Add a row',
  'Excel Online - Update a row',
  // Word Online
  'Word Online - Populate a template',
  // Planner
  'Planner - Create a task',
  'Planner - List my tasks',
  'Planner - Get a task',
  'Planner - Update a task',
  'Planner - List buckets',
  // Forms
  'Forms - Get response details',
  'Forms - List responses',
  // ── Microsoft data / platform ──────────────────────────────────────────────
  'Dataverse - List rows',
  'Dataverse - Get a row',
  'Dataverse - Add a new row',
  'Dataverse - Update a row',
  'Dataverse - Delete a row',
  'Dataverse - Relate rows',
  'Dataverse - Perform a bound action',
  'Dataverse - Perform an unbound action',
  'Power BI - Refresh a dataset',
  'Power BI - Run a query',
  'Approvals - Create an approval',
  'Approvals - Wait for an approval',
  'Approvals - Start and wait for an approval',
  'Azure DevOps - Create a work item',
  'Azure DevOps - Update a work item',
  'Azure DevOps - Get work item details',
  // ── AI / intelligence ──────────────────────────────────────────────────────
  'Azure AI - Analyze text sentiment',
  'Azure AI - Translate text',
  'Azure AI - Recognize entities',
  // ── Utilities ─────────────────────────────────────────────────────────────
  'HTTP - Make a request',
  'HTTP - Webhook',
  'Variable - Initialize variable',
  'Variable - Set variable',
  'Variable - Append to array',
  'Variable - Increment variable',
  'Control - Condition',
  'Control - Apply to each',
  'Control - Do until',
  'Control - Switch',
  'Control - Scope',
  'Control - Terminate',
  'Data Operation - Compose',
  'Data Operation - Filter array',
  'Data Operation - Select',
  'Data Operation - Parse JSON',
  'Data Operation - Join',
  'Data Operation - Create CSV table',
  'Data Operation - Create HTML table',
  // ── Third-party ────────────────────────────────────────────────────────────
  'Salesforce - Create record',
  'Salesforce - Update record',
  'Salesforce - Get record',
  'ServiceNow - Create Record',
  'ServiceNow - Update Record',
  'Slack - Post message',
  'Notifications - Send email notification',
  'Notifications - Send mobile notification',
  'RSS - List feed items',
  'PDF - Extract text',
  'Adobe PDF - Convert to PDF',
  'Computer Operator - Computer use',
  // ── Work IQ ──────────────────────────────────────────────────────────────
  'Work IQ - Analyze work patterns',
  'Work IQ - Get collaboration insights',
  'Work IQ - Summarize meeting trends',
  // ── Weather ────────────────────────────────────────────────────────────────
  'MSN Weather - Get current weather',
  'MSN Weather - Get forecast for today',
  'MSN Weather - Get forecast for tomorrow',
];
