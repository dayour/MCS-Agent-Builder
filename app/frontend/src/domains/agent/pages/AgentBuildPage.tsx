import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useOutletContext } from 'react-router-dom';
import type { BuildOutletContext } from '../../../components/Layout';
import { AgentConfig, PillConfig, AgentCapability } from '../../../types';
import { useAgent } from '../../../context/AgentContext';
import { FeedbackSection, FeedbackStatus } from '../../../components/FeedbackSection';
import { generateComponentDescriptions } from '../../../utils/agentCreation';
import { KNOWN_TRIGGERS, KNOWN_TOOLS } from '../../../utils/agentCatalog';
import { useBuildPageEditor } from '../../../hooks/useBuildPageEditor';
import { useHAReviewDiff, DIFFABLE_FIELDS } from '../../../hooks/useHAReviewDiff';
import { computeInstructionsDiff } from '../../../utils/instructionsDiff';
import { saveCursorOffset, restoreCursorOffset } from '../../../utils/reviewCursor';
import { useSlashMenu, INSTRUCTIONS_UNDO_DEBOUNCE_MS } from '../../../hooks/useSlashMenu';
import { useComponentsPanel } from '../../../hooks/useComponentsPanel';
import { BuildPageHeader, InstructionsEditor, SlashCommandMenu, ComponentsPanel, CreateSkillModal, SkillBrowserModal, SkillConfigPanel, WorkIQDetailPanel, ConversationalTriggerDetailPanel, EventTriggerDetailPanel, McpDetailPanel, ActionDetailPanel } from '../../../components/build';
import { ToolsBrowserModal, isConnectorMcp } from '../components/ToolsBrowserModal';
import { NewMcpServerPanel } from '../components/NewMcpServerPanel';
import { NewRestApiPanel } from '../components/NewRestApiPanel';
// SpecPanel removed — Spec is now its own page at /spec
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { CopilotMenu, CopilotMenuPosition } from '../../../components/ui/CopilotMenu';
import { PillConfigPanel } from '../../../components/ui/PillConfigPanel';
import { AddComponentModal } from '../../../components/modals/AddComponentModal';
import type { SearchResult } from '../../../components/modals/AddComponentModalTypes';
import { useToast } from '../../../context/ToastContext';
import {
  ArrowSort24Regular,
  Search24Regular,
  Dismiss20Regular,
  Add24Regular,
  BookStar20Regular,
  Library20Regular,
  WrenchRegular,
  PlugDisconnected20Regular,
} from '@fluentui/react-icons';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../../../components/ui';
import {
  AGENT_TYPE_OPTIONS,
  getAgentTypeValue,
  getCapabilityIcon,
  ComponentItem,
  getTriggerFriendlyName,
  getTriggerChannel,
  TRIGGER_PANEL_TITLES,
  getTriggerTypeLabel,
  CONVERSATIONAL_CHANNEL_KEYS,
  CHANNEL_TO_TRIGGER,
} from '../../../utils/buildPageUtils';

type ComponentTab = 'all' | 'knowledge' | 'tools' | 'topics' | 'agents' | 'triggers' | 'skills';
type ComponentFilterLabel = 'All' | 'Knowledge' | 'Tools' | 'Topics' | 'Agents' | 'Triggers' | 'Skills';

const COMPONENT_TAB_TO_FILTER_LABEL: Record<ComponentTab, ComponentFilterLabel> = {
  all: 'All',
  knowledge: 'Knowledge',
  tools: 'Tools',
  topics: 'Topics',
  agents: 'Agents',
  triggers: 'Triggers',
  skills: 'Skills',
};

const FILTER_LABEL_TO_COMPONENT_TAB: Record<ComponentFilterLabel, ComponentTab> = {
  All: 'all',
  Knowledge: 'knowledge',
  Tools: 'tools',
  Topics: 'topics',
  Agents: 'agents',
  Triggers: 'triggers',
  Skills: 'skills',
};

// Auto-detect the service channel from a tool/connector label prefix.
function getToolChannel(label: string): string | undefined {
  const l = label.toLowerCase();
  if (l.startsWith('office365') || l.startsWith('outlook')) return 'outlook';
  if (l.startsWith('teams') || l.startsWith('planner') || l.startsWith('approvals')) return 'teams';
  if (l.startsWith('sharepoint')) return 'sharepoint';
  if (l.startsWith('onedrive')) return 'onedrive';
  if (l.startsWith('dataverse')) return 'dataverse';
  if (l.startsWith('excel')) return 'excel';
  if (l.startsWith('word')) return 'word';
  if (l.startsWith('servicenow')) return 'servicenow';
  if (l.startsWith('slack')) return 'slack';
  return undefined;
}

// Static registry mapping pill labels → their config (inputs, type, channel).
const PILL_CONFIGS: Record<string, Omit<PillConfig, 'id'>> = {
  // ── Office 365 / Outlook ──────────────────────────────────────────────────
  'Office365 - Send an email (V2)': { type: 'connector', label: 'Office365 - Send an email (V2)', channel: 'outlook', description: 'Sends an email from an Office 365 mailbox.', inputs: [{ name: 'To', required: true }, { name: 'Subject', required: true }, { name: 'Body', required: true }] },
  'Office365 - Get emails (V3)': { type: 'connector', label: 'Office365 - Get emails (V3)', channel: 'outlook', description: 'Retrieves emails from a mailbox folder.', inputs: [{ name: 'Folder', required: true }, { name: 'Top', required: false, description: 'Number of emails to retrieve (default 10)' }] },
  'Office365 - Reply to an email (V3)': { type: 'connector', label: 'Office365 - Reply to an email (V3)', channel: 'outlook', description: 'Sends a reply to an email message.', inputs: [{ name: 'Message Id', required: true }, { name: 'Body', required: true }, { name: 'Reply All', required: false }] },
  'Office365 - Forward an email (V2)': { type: 'connector', label: 'Office365 - Forward an email (V2)', channel: 'outlook', description: 'Forwards an email to one or more recipients.', inputs: [{ name: 'Message Id', required: true }, { name: 'To', required: true }, { name: 'Comment', required: false }] },
  'Office365 - Move email (V2)': { type: 'connector', label: 'Office365 - Move email (V2)', channel: 'outlook', description: 'Moves an email to a specified folder.', inputs: [{ name: 'Message Id', required: true }, { name: 'Folder', required: true }] },
  'Office365 - Flag an email (V2)': { type: 'connector', label: 'Office365 - Flag an email (V2)', channel: 'outlook', description: 'Flags an email for follow-up.', inputs: [{ name: 'Message Id', required: true }] },
  'Office365 - Get Calendar View of Events (V3)': { type: 'connector', label: 'Office365 - Get Calendar View of Events (V3)', channel: 'outlook', description: 'Retrieves calendar events within a time range.', inputs: [{ name: 'Calendar Id', required: true }, { name: 'Start Time', required: true }, { name: 'End Time', required: true }] },
  'Office365 - Create an Event (V4)': { type: 'connector', label: 'Office365 - Create an Event (V4)', channel: 'outlook', description: 'Creates a new calendar event.', inputs: [{ name: 'Calendar Id', required: true }, { name: 'Subject', required: true }, { name: 'Start', required: true }, { name: 'End', required: true }, { name: 'Body', required: false }, { name: 'Attendees', required: false }] },
  'Outlook - Send an email (V2)': { type: 'connector', label: 'Outlook - Send an email (V2)', channel: 'outlook', description: 'Sends an email from an Outlook mailbox.', inputs: [{ name: 'To', required: true }, { name: 'Subject', required: true }, { name: 'Body', required: true }] },
  'Outlook - Get emails (V3)': { type: 'connector', label: 'Outlook - Get emails (V3)', channel: 'outlook', description: 'Retrieves emails from an Outlook mailbox.', inputs: [{ name: 'Folder', required: true }, { name: 'Top', required: false }] },
  'Outlook - Reply to an email (V3)': { type: 'connector', label: 'Outlook - Reply to an email (V3)', channel: 'outlook', description: 'Sends a reply to an Outlook email.', inputs: [{ name: 'Message Id', required: true }, { name: 'Body', required: true }] },
  // Short aliases
  'Send an email (V2)': { type: 'connector', label: 'Send an email (V2)', channel: 'outlook', description: 'Sends an email from an Outlook mailbox.', inputs: [{ name: 'To', required: true }, { name: 'Subject', required: true }, { name: 'Body', required: true }] },
  'Send email': { type: 'connector', label: 'Send email', channel: 'outlook', description: 'Sends an email via Outlook.', inputs: [{ name: 'To', required: true }, { name: 'Subject', required: true }, { name: 'Body', required: true }] },
  'Reply to an email (V3)': { type: 'connector', label: 'Reply to an email (V3)', channel: 'outlook', description: 'Sends a reply to an email message.', inputs: [{ name: 'Message Id', required: true }, { name: 'Body', required: true }] },
  'Forward an email (V2)': { type: 'connector', label: 'Forward an email (V2)', channel: 'outlook', description: 'Forwards an email to recipients.', inputs: [{ name: 'Message Id', required: true }, { name: 'To', required: true }] },

  // ── Microsoft Teams ───────────────────────────────────────────────────────
  'Teams - Post message in a chat or channel': { type: 'connector', label: 'Teams - Post message in a chat or channel', channel: 'teams', description: 'Posts a message to a Teams channel or chat.', inputs: [{ name: 'Team or group chat', required: true }, { name: 'Channel or chat', required: true }, { name: 'Message', required: true }] },
  'Teams - Get a Message': { type: 'connector', label: 'Teams - Get a Message', channel: 'teams', description: 'Retrieves a specific message from a Teams channel.', inputs: [{ name: 'Team Id', required: true }, { name: 'Channel Id', required: true }, { name: 'Message Id', required: true }] },
  'Teams - List Messages': { type: 'connector', label: 'Teams - List Messages', channel: 'teams', description: 'Lists messages in a Teams channel.', inputs: [{ name: 'Team Id', required: true }, { name: 'Channel Id', required: true }] },
  'Teams - Create a chat': { type: 'connector', label: 'Teams - Create a chat', channel: 'teams', description: 'Creates a new Teams chat.', inputs: [{ name: 'Member(s)', required: true }, { name: 'Chat type', required: false }] },
  'Teams - Get Channel': { type: 'connector', label: 'Teams - Get Channel', channel: 'teams', description: 'Retrieves details for a Teams channel.', inputs: [{ name: 'Team Id', required: true }, { name: 'Channel Id', required: true }] },
  'Teams - List Channels': { type: 'connector', label: 'Teams - List Channels', channel: 'teams', description: 'Lists all channels in a Teams team.', inputs: [{ name: 'Team Id', required: true }] },
  'Teams - Post adaptive card in a chat or channel': { type: 'connector', label: 'Teams - Post adaptive card in a chat or channel', channel: 'teams', description: 'Posts an adaptive card to a Teams channel or chat.', inputs: [{ name: 'Team or group chat', required: true }, { name: 'Adaptive card', required: true }] },
  'Teams - Get @mention token for a user': { type: 'connector', label: 'Teams - Get @mention token for a user', channel: 'teams', description: 'Gets a mention token for a Teams user.', inputs: [{ name: 'User', required: true }] },
  // Short aliases
  'Post message in a chat or channel': { type: 'connector', label: 'Post message in a chat or channel', channel: 'teams', description: 'Posts a message to a Teams channel or chat.', inputs: [{ name: 'Team or group chat', required: true }, { name: 'Message', required: true }] },
  'Post adaptive card in a chat or channel': { type: 'connector', label: 'Post adaptive card in a chat or channel', channel: 'teams', inputs: [{ name: 'Team or group chat', required: true }, { name: 'Adaptive card', required: true }] },

  // ── SharePoint ────────────────────────────────────────────────────────────
  'SharePoint - Get items': { type: 'connector', label: 'SharePoint - Get items', channel: 'sharepoint', description: 'Retrieves items from a SharePoint list.', inputs: [{ name: 'Site Address', required: true }, { name: 'List Name', required: true }, { name: 'Filter Query', required: false }] },
  'SharePoint - Create item': { type: 'connector', label: 'SharePoint - Create item', channel: 'sharepoint', description: 'Creates a new item in a SharePoint list.', inputs: [{ name: 'Site Address', required: true }, { name: 'List Name', required: true }] },
  'SharePoint - Update item': { type: 'connector', label: 'SharePoint - Update item', channel: 'sharepoint', description: 'Updates an existing SharePoint list item.', inputs: [{ name: 'Site Address', required: true }, { name: 'List Name', required: true }, { name: 'Id', required: true }] },
  'SharePoint - Delete item': { type: 'connector', label: 'SharePoint - Delete item', channel: 'sharepoint', description: 'Deletes an item from a SharePoint list.', inputs: [{ name: 'Site Address', required: true }, { name: 'List Name', required: true }, { name: 'Id', required: true }] },
  'SharePoint - Get file content': { type: 'connector', label: 'SharePoint - Get file content', channel: 'sharepoint', description: 'Gets the content of a file from SharePoint.', inputs: [{ name: 'Site Address', required: true }, { name: 'File Identifier', required: true }] },
  'SharePoint - Create file': { type: 'connector', label: 'SharePoint - Create file', channel: 'sharepoint', description: 'Creates a new file in SharePoint.', inputs: [{ name: 'Site Address', required: true }, { name: 'Folder Path', required: true }, { name: 'File Name', required: true }, { name: 'File Content', required: true }] },
  'SharePoint - Copy file': { type: 'connector', label: 'SharePoint - Copy file', channel: 'sharepoint', description: 'Copies a file to another SharePoint location.', inputs: [{ name: 'Current file path', required: true }, { name: 'Destination file path', required: true }] },
  'SharePoint - Get files (properties only)': { type: 'connector', label: 'SharePoint - Get files (properties only)', channel: 'sharepoint', description: 'Lists files in a SharePoint folder.', inputs: [{ name: 'Site Address', required: true }, { name: 'Folder Path', required: true }] },
  'SharePoint - Send an HTTP request to SharePoint': { type: 'connector', label: 'SharePoint - Send an HTTP request to SharePoint', channel: 'sharepoint', description: 'Sends a custom HTTP request to SharePoint REST API.', inputs: [{ name: 'Site Address', required: true }, { name: 'Method', required: true }, { name: 'Uri', required: true }] },
  // Short aliases
  'Get items': { type: 'connector', label: 'Get items', channel: 'sharepoint', description: 'Retrieves items from a SharePoint list.', inputs: [{ name: 'Site Address', required: true }, { name: 'List Name', required: true }] },
  'Create item': { type: 'connector', label: 'Create item', channel: 'sharepoint', inputs: [{ name: 'Site Address', required: true }, { name: 'List Name', required: true }] },
  'Update item': { type: 'connector', label: 'Update item', channel: 'sharepoint', inputs: [{ name: 'Site Address', required: true }, { name: 'List Name', required: true }, { name: 'Id', required: true }] },
  'Get file content': { type: 'connector', label: 'Get file content', channel: 'sharepoint', inputs: [{ name: 'Site Address', required: true }, { name: 'File Identifier', required: true }] },

  // ── OneDrive ──────────────────────────────────────────────────────────────
  'OneDrive - Get file content': { type: 'connector', label: 'OneDrive - Get file content', channel: 'onedrive', description: 'Gets the content of a file from OneDrive.', inputs: [{ name: 'File', required: true }] },
  'OneDrive - Create file': { type: 'connector', label: 'OneDrive - Create file', channel: 'onedrive', description: 'Creates a new file in OneDrive.', inputs: [{ name: 'Folder Path', required: true }, { name: 'File Name', required: true }, { name: 'File Content', required: true }] },
  'OneDrive - Update file': { type: 'connector', label: 'OneDrive - Update file', channel: 'onedrive', description: 'Updates an existing file in OneDrive.', inputs: [{ name: 'File', required: true }, { name: 'File Content', required: true }] },
  'OneDrive - Copy file': { type: 'connector', label: 'OneDrive - Copy file', channel: 'onedrive', description: 'Copies a file to another OneDrive location.', inputs: [{ name: 'File', required: true }, { name: 'Destination folder path', required: true }] },
  'OneDrive - List files in folder': { type: 'connector', label: 'OneDrive - List files in folder', channel: 'onedrive', description: 'Lists files in a OneDrive folder.', inputs: [{ name: 'Folder', required: true }] },

  // ── Dataverse ─────────────────────────────────────────────────────────────
  'Dataverse - List rows': { type: 'connector', label: 'Dataverse - List rows', channel: 'dataverse', description: 'Retrieves rows from a Dataverse table.', inputs: [{ name: 'Table name', required: true }, { name: 'Filter rows', required: false }, { name: 'Top count', required: false }] },
  'Dataverse - Get a row by ID': { type: 'connector', label: 'Dataverse - Get a row by ID', channel: 'dataverse', description: 'Retrieves a single Dataverse row by its ID.', inputs: [{ name: 'Table name', required: true }, { name: 'Row ID', required: true }] },
  'Dataverse - Add a new row': { type: 'connector', label: 'Dataverse - Add a new row', channel: 'dataverse', description: 'Creates a new row in a Dataverse table.', inputs: [{ name: 'Table name', required: true }] },
  'Dataverse - Update a row': { type: 'connector', label: 'Dataverse - Update a row', channel: 'dataverse', description: 'Updates an existing Dataverse row.', inputs: [{ name: 'Table name', required: true }, { name: 'Row ID', required: true }] },
  'Dataverse - Delete a row': { type: 'connector', label: 'Dataverse - Delete a row', channel: 'dataverse', description: 'Deletes a row from a Dataverse table.', inputs: [{ name: 'Table name', required: true }, { name: 'Row ID', required: true }] },
  'Dataverse - Relate rows': { type: 'connector', label: 'Dataverse - Relate rows', channel: 'dataverse', description: 'Creates a relationship between two Dataverse rows.', inputs: [{ name: 'Table name', required: true }, { name: 'Row ID', required: true }, { name: 'Relationship', required: true }] },
  'Dataverse - Perform a bound action': { type: 'connector', label: 'Dataverse - Perform a bound action', channel: 'dataverse', description: 'Performs a bound action on a Dataverse record.', inputs: [{ name: 'Table name', required: true }, { name: 'Row ID', required: true }, { name: 'Action name', required: true }] },
  'Dataverse - Perform an unbound action': { type: 'connector', label: 'Dataverse - Perform an unbound action', channel: 'dataverse', description: 'Performs a global Dataverse action.', inputs: [{ name: 'Action name', required: true }] },
  // Short aliases
  'List rows': { type: 'connector', label: 'List rows', channel: 'dataverse', inputs: [{ name: 'Table name', required: true }] },
  'Add a new row': { type: 'connector', label: 'Add a new row', channel: 'dataverse', inputs: [{ name: 'Table name', required: true }] },
  'Update a row': { type: 'connector', label: 'Update a row', channel: 'dataverse', inputs: [{ name: 'Table name', required: true }, { name: 'Row ID', required: true }] },

  // ── Planner ───────────────────────────────────────────────────────────────
  'Planner - Create a task': { type: 'connector', label: 'Planner - Create a task', channel: 'teams', description: 'Creates a new Planner task.', inputs: [{ name: 'Plan Id', required: true }, { name: 'Title', required: true }, { name: 'Bucket Id', required: false }, { name: 'Assigned to', required: false }] },
  'Planner - List my tasks': { type: 'connector', label: 'Planner - List my tasks', channel: 'teams', description: 'Lists all Planner tasks assigned to the current user.', inputs: [] },
  'Planner - Get a task': { type: 'connector', label: 'Planner - Get a task', channel: 'teams', description: 'Retrieves details of a specific Planner task.', inputs: [{ name: 'Task Id', required: true }] },
  'Planner - Update a task': { type: 'connector', label: 'Planner - Update a task', channel: 'teams', description: 'Updates an existing Planner task.', inputs: [{ name: 'Task Id', required: true }] },
  'Planner - List buckets': { type: 'connector', label: 'Planner - List buckets', channel: 'teams', description: 'Lists all buckets in a Planner plan.', inputs: [{ name: 'Plan Id', required: true }] },
  // Short alias
  'Create a task': { type: 'connector', label: 'Create a task', channel: 'teams', inputs: [{ name: 'Plan Id', required: true }, { name: 'Title', required: true }] },

  // ── Approvals ─────────────────────────────────────────────────────────────
  'Approvals - Create an approval': { type: 'connector', label: 'Approvals - Create an approval', channel: 'teams', description: 'Creates an approval request.', inputs: [{ name: 'Approval type', required: true }, { name: 'Title', required: true }, { name: 'Assigned to', required: true }, { name: 'Details', required: false }] },
  'Approvals - Wait for an approval': { type: 'connector', label: 'Approvals - Wait for an approval', channel: 'teams', description: 'Waits for an approval to complete.', inputs: [{ name: 'Approval Id', required: true }] },
  'Approvals - Start and wait for an approval': { type: 'connector', label: 'Approvals - Start and wait for an approval', channel: 'teams', description: 'Creates an approval and waits for the response.', inputs: [{ name: 'Approval type', required: true }, { name: 'Title', required: true }, { name: 'Assigned to', required: true }] },
  // Short alias
  'Start and wait for an approval': { type: 'connector', label: 'Start and wait for an approval', channel: 'teams', inputs: [{ name: 'Approval type', required: true }, { name: 'Title', required: true }, { name: 'Assigned to', required: true }] },

  // ── Excel Online ──────────────────────────────────────────────────────────
  'Excel Online - Get a row': { type: 'connector', label: 'Excel Online - Get a row', channel: 'excel', description: 'Gets a row from an Excel table.', inputs: [{ name: 'Location', required: true }, { name: 'Document Library', required: true }, { name: 'File', required: true }, { name: 'Table', required: true }, { name: 'Row Id', required: true }] },
  'Excel Online - List rows present in a table': { type: 'connector', label: 'Excel Online - List rows present in a table', channel: 'excel', description: 'Lists rows in an Excel table.', inputs: [{ name: 'Location', required: true }, { name: 'Document Library', required: true }, { name: 'File', required: true }, { name: 'Table', required: true }] },
  'Excel Online - Add a row into a table': { type: 'connector', label: 'Excel Online - Add a row into a table', channel: 'excel', description: 'Adds a new row to an Excel table.', inputs: [{ name: 'Location', required: true }, { name: 'Document Library', required: true }, { name: 'File', required: true }, { name: 'Table', required: true }] },
  'Excel Online - Update a row': { type: 'connector', label: 'Excel Online - Update a row', channel: 'excel', description: 'Updates a row in an Excel table.', inputs: [{ name: 'Location', required: true }, { name: 'Document Library', required: true }, { name: 'File', required: true }, { name: 'Table', required: true }, { name: 'Key Column', required: true }, { name: 'Key Value', required: true }] },
  // Short aliases
  'Add a row into a table': { type: 'connector', label: 'Add a row into a table', channel: 'excel', inputs: [{ name: 'Location', required: true }, { name: 'Document Library', required: true }, { name: 'File', required: true }, { name: 'Table', required: true }] },
  'List rows present in a table': { type: 'connector', label: 'List rows present in a table', channel: 'excel', inputs: [{ name: 'Location', required: true }, { name: 'Document Library', required: true }, { name: 'File', required: true }, { name: 'Table', required: true }] },

  // ── Word Online ───────────────────────────────────────────────────────────
  'Word Online - Populate a Microsoft Word template': { type: 'connector', label: 'Word Online - Populate a Microsoft Word template', channel: 'word', description: 'Fills placeholders in a Word template with dynamic values.', inputs: [{ name: 'Location', required: true }, { name: 'Document Library', required: true }, { name: 'File', required: true }] },
  // Short alias
  'Populate a Microsoft Word template': { type: 'connector', label: 'Populate a Microsoft Word template', channel: 'word', description: 'Populates placeholders in a Word template document.', inputs: [{ name: 'Location', required: true }, { name: 'Document Library', required: true }, { name: 'File', required: true }] },

  // ── ServiceNow ────────────────────────────────────────────────────────────
  'ServiceNow - Create Record': { type: 'connector', label: 'ServiceNow - Create Record', channel: 'servicenow', description: 'Creates a new record in a ServiceNow table.', inputs: [{ name: 'Table name', required: true }] },
  'ServiceNow - Update Record': { type: 'connector', label: 'ServiceNow - Update Record', channel: 'servicenow', description: 'Updates an existing ServiceNow record.', inputs: [{ name: 'Table name', required: true }, { name: 'Sys ID', required: true }] },
  // Short aliases
  'Create Record': { type: 'connector', label: 'Create Record', channel: 'servicenow', inputs: [{ name: 'Table name', required: true }] },
  'Update Record': { type: 'connector', label: 'Update Record', channel: 'servicenow', inputs: [{ name: 'Table name', required: true }, { name: 'Sys ID', required: true }] },

  // ── Salesforce ────────────────────────────────────────────────────────────
  'Salesforce - Create record': { type: 'connector', label: 'Salesforce - Create record', channel: 'salesforce', description: 'Creates a new record in Salesforce.', inputs: [{ name: 'Object Type', required: true }] },
  'Salesforce - Update record': { type: 'connector', label: 'Salesforce - Update record', channel: 'salesforce', description: 'Updates an existing Salesforce record.', inputs: [{ name: 'Object Type', required: true }, { name: 'Record ID', required: true }] },
  'Salesforce - Get record': { type: 'connector', label: 'Salesforce - Get record', channel: 'salesforce', description: 'Retrieves a record from Salesforce.', inputs: [{ name: 'Object Type', required: true }, { name: 'Record ID', required: true }] },

  // ── Slack ─────────────────────────────────────────────────────────────────
  'Slack - Post message': { type: 'connector', label: 'Slack - Post message', channel: 'slack', description: 'Posts a message to a Slack channel.', inputs: [{ name: 'Channel Name', required: true }, { name: 'Message Text', required: true }] },
  'Post message': { type: 'connector', label: 'Post message', channel: 'slack', description: 'Posts a message to a Slack channel.', inputs: [{ name: 'Channel Name', required: true }, { name: 'Message Text', required: true }] },

  // ── Power BI ──────────────────────────────────────────────────────────────
  'Power BI - Refresh a dataset': { type: 'connector', label: 'Power BI - Refresh a dataset', channel: 'powerbi', description: 'Triggers a refresh of a Power BI dataset.', inputs: [{ name: 'Workspace', required: true }, { name: 'Dataset', required: true }] },
  'Power BI - Run a query against a dataset': { type: 'connector', label: 'Power BI - Run a query against a dataset', channel: 'powerbi', description: 'Runs a DAX query against a Power BI dataset.', inputs: [{ name: 'Workspace', required: true }, { name: 'Dataset', required: true }, { name: 'Query', required: true }] },

  // ── Azure AI ──────────────────────────────────────────────────────────────
  'Azure AI - Analyze text sentiment': { type: 'connector', label: 'Azure AI - Analyze text sentiment', channel: 'azure', description: 'Analyzes the sentiment of provided text.', inputs: [{ name: 'Text', required: true }, { name: 'Language', required: false }] },
  'Azure AI - Translate text': { type: 'connector', label: 'Azure AI - Translate text', channel: 'azure', description: 'Translates text into a target language.', inputs: [{ name: 'Text', required: true }, { name: 'Target Language', required: true }] },
  'Azure AI - Recognize entities in text': { type: 'connector', label: 'Azure AI - Recognize entities in text', channel: 'azure', description: 'Extracts named entities from text.', inputs: [{ name: 'Text', required: true }] },

  // ── Copilot / AI Builder ──────────────────────────────────────────────────
  'Copilot - Generate text with GPT': { type: 'connector', label: 'Copilot - Generate text with GPT', channel: 'copilot', description: 'Generates text using a GPT model.', inputs: [{ name: 'Prompt', required: true }, { name: 'Model', required: false }] },
  'Copilot - Analyze an image': { type: 'connector', label: 'Copilot - Analyze an image', channel: 'copilot', description: 'Analyzes image content using AI.', inputs: [{ name: 'Image', required: true }, { name: 'Prompt', required: true }] },
  'Copilot - Generate images with DALL-E': { type: 'connector', label: 'Copilot - Generate images with DALL-E', channel: 'copilot', description: 'Generates images from a text prompt using DALL-E.', inputs: [{ name: 'Prompt', required: true }, { name: 'Image size', required: false }] },

  // ── Notifications ─────────────────────────────────────────────────────────
  'Notifications - Send me an email notification': { type: 'connector', label: 'Notifications - Send me an email notification', channel: 'outlook', description: 'Sends an email notification to the flow owner.', inputs: [{ name: 'Subject', required: true }, { name: 'Body', required: true }] },
  'Notifications - Send me a mobile notification': { type: 'connector', label: 'Notifications - Send me a mobile notification', channel: 'mobile', description: 'Sends a push notification to the flow owner\'s mobile device.', inputs: [{ name: 'Text', required: true }, { name: 'Link', required: false }] },

  // ── Forms ─────────────────────────────────────────────────────────────────
  'Forms - Get response details': { type: 'connector', label: 'Forms - Get response details', channel: 'forms', description: 'Gets the details of a specific form response.', inputs: [{ name: 'Form Id', required: true }, { name: 'Response Id', required: true }] },
  'Forms - List responses': { type: 'connector', label: 'Forms - List responses', channel: 'forms', description: 'Lists all responses for a form.', inputs: [{ name: 'Form Id', required: true }] },

  // ── Azure DevOps ──────────────────────────────────────────────────────────
  'Azure DevOps - Create a work item': { type: 'connector', label: 'Azure DevOps - Create a work item', channel: 'devops', description: 'Creates a new work item in Azure DevOps.', inputs: [{ name: 'Organization', required: true }, { name: 'Project', required: true }, { name: 'Work item type', required: true }, { name: 'Title', required: true }] },
  'Azure DevOps - Update a work item': { type: 'connector', label: 'Azure DevOps - Update a work item', channel: 'devops', description: 'Updates an existing Azure DevOps work item.', inputs: [{ name: 'Organization', required: true }, { name: 'Project', required: true }, { name: 'Id', required: true }] },
  'Azure DevOps - Get work item details': { type: 'connector', label: 'Azure DevOps - Get work item details', channel: 'devops', description: 'Retrieves details of an Azure DevOps work item.', inputs: [{ name: 'Organization', required: true }, { name: 'Project', required: true }, { name: 'Id', required: true }] },

  // ── PDF / Adobe ───────────────────────────────────────────────────────────
  'PDF - Extract text from PDF': { type: 'connector', label: 'PDF - Extract text from PDF', channel: 'pdf', description: 'Extracts text content from a PDF document.', inputs: [{ name: 'PDF content', required: true }] },
  'Adobe PDF - Convert to PDF': { type: 'connector', label: 'Adobe PDF - Convert to PDF', channel: 'pdf', description: 'Converts a document to PDF format.', inputs: [{ name: 'File content', required: true }, { name: 'File name', required: true }] },

  // ── HTTP ──────────────────────────────────────────────────────────────────
  'HTTP - HTTP': { type: 'connector', label: 'HTTP - HTTP', channel: 'http', description: 'Sends an HTTP request to a URL.', inputs: [{ name: 'Method', required: true }, { name: 'URI', required: true }, { name: 'Headers', required: false }, { name: 'Body', required: false }] },
  'HTTP - HTTP Webhook': { type: 'connector', label: 'HTTP - HTTP Webhook', channel: 'http', description: 'Sends a webhook HTTP request.', inputs: [{ name: 'Subscribe Method', required: true }, { name: 'Subscribe URI', required: true }] },

  // ── RSS ───────────────────────────────────────────────────────────────────
  'RSS - List all RSS feed items': { type: 'connector', label: 'RSS - List all RSS feed items', channel: 'rss', description: 'Lists items from an RSS feed.', inputs: [{ name: 'RSS feed URL', required: true }] },
};

// Fields compared when watching for user edits that should fade review highlights.
// Imported from useHAReviewDiff to stay in sync with the diff hook's field list.
const FADE_WATCH_FIELDS = DIFFABLE_FIELDS;

// Derive a PillConfig for any pill label, falling back to channel detection + empty inputs
function resolvePillConfig(label: string, inferredType: PillConfig['type'], channel?: string): PillConfig {
  const base = PILL_CONFIGS[label];
  if (base) return { ...base, id: label };
  // Auto-detect channel from label prefix for unknown connectors
  const detectedChannel = channel || getToolChannel(label);
  return { id: label, type: inferredType, label, channel: detectedChannel, inputs: [] };
}

export const AgentBuildPage: React.FC = () => {
  const location = useLocation();
  const {
    agentConfig,
    updateAgentConfig,
    updateWithHistory,
    isConversationalLayout,
    streamingInstructionsData,
    updateSpecificAgent,
    clearStreamingInstructions,
    isEvalMode,
    helperMessages,
    setIsInstructionsHeaderStuck,
    isPillContextMenu,
    registerInstructionsReader,
    unregisterInstructionsReader,
    skills,
    addSkill,
    updateSkill,
    deleteSkill,
    isSkillsEnabled,
    currentAgentId,
    isAgentGlobalUndo,
    markManualDirty,
    helperAgentReviewSnapshot,
    clearHelperAgentReview,
    highlightAllChanges,
    isHAReviewUIEnabled,
    isWorkIQEnabled,
    commitSave,
    isTriggersEnabled,
    isInsertComponents,
    pendingScrollTarget,
    setPendingScrollTarget,
    isToolsDA,
  } = useAgent();

  const { changedFields } = useHAReviewDiff();
  const [reviewRenderedInstructions, setReviewRenderedInstructions] = useState<React.ReactNode | null>(null);
  // Separate from reviewRenderedInstructions so we can fade highlights out BEFORE removing elements.
  const [reviewHighlightActive, setReviewHighlightActive] = useState(false);
  const reviewFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showWorkIQDetail, setShowWorkIQDetail] = useState(false);
  const [disconnectConfirmItem, setDisconnectConfirmItem] = useState<ComponentItem | null>(null);
  // Spec panel state removed — Spec is now its own page

  // Listen for HelperAgent signalling "See added tools" click
  useEffect(() => {
    const handler = () => setShowWorkIQDetail(true);
    window.addEventListener('workiq:view-tools', handler);
    return () => window.removeEventListener('workiq:view-tools', handler);
  }, []);

  const [pendingComponentScrollName, setPendingComponentScrollName] = useState<string | null>(null);

  // Scroll to a section or component when pendingScrollTarget is set
  useEffect(() => {
    if (!pendingScrollTarget) return;
    const timer = setTimeout(() => {
      let el: Element | null = null;
      if (pendingScrollTarget === 'instructions') {
        setActivePanel('instructions');
        el = document.querySelector('[data-section="Instructions Panel"]');
      } else if (pendingScrollTarget === 'name' || pendingScrollTarget === 'description') {
        el = document.querySelector('[data-section="Agent Header"]');
      } else if (pendingScrollTarget === 'model') {
        el = document.querySelector('[data-section="Agent Header"]');
        setIsModelDropdownOpen(true);
      } else if (pendingScrollTarget.startsWith('component:')) {
        const fullName = pendingScrollTarget.slice('component:'.length);
        const dashIdx = fullName.indexOf(' - ');
        const shortName = dashIdx !== -1 ? fullName.slice(dashIdx + 3) : fullName;
        setActivePanel('components');
        setPendingComponentScrollName(shortName);
        setPendingScrollTarget(null);
        return;
      }
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setPendingScrollTarget(null);
    }, 150);
    return () => {
      clearTimeout(timer);
      setPendingScrollTarget(null);
    };
    // setActivePanel, setIsModelDropdownOpen, setPendingScrollTarget are stable useState setters — safe to omit
  }, [pendingScrollTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  // Second-pass scroll: fires after panel switch has re-rendered
  useEffect(() => {
    if (!pendingComponentScrollName) return;
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-component-name="${CSS.escape(pendingComponentScrollName)}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setPendingComponentScrollName(null);
    }, 50);
    return () => clearTimeout(timer);
    // setPendingComponentScrollName is a stable useState setter — safe to omit
  }, [pendingComponentScrollName]);  

  const isNarrowPreview = isConversationalLayout && agentConfig.type === 'agent';
  const agentWasCreatedInPlanMode = agentConfig.createdWithPlanMode ?? false;

  // ── Shared refs (break circular hook dependency) ────────────────────────────
  const isSlashInsertingRef = useRef(false);
  const urlInputActiveRef = useRef(false);
  const resetSlashFnRef = useRef<() => void>(() => {});
  const instructionsHistoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up instructions debounce timer on unmount.
  useEffect(() => {
    return () => {
      if (instructionsHistoryTimerRef.current) {
        clearTimeout(instructionsHistoryTimerRef.current);
      }
    };
  }, []);

  // ── HA Review: reset review state when agent changes ────────────────────────
  const prevAgentIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const prev = prevAgentIdRef.current;
    prevAgentIdRef.current = agentConfig.id;
    if (prev === undefined || prev === agentConfig.id) return;
    // Actual agent switch — clear everything.
    setReviewRenderedInstructions(null);
    setReviewHighlightActive(false);
    clearHelperAgentReview();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only re-run when agent identity changes, not on every config field update
  }, [agentConfig.id]);

  // ── HA Review: clear-with-fade helper ───────────────────────────────────────
  const clearReviewWithFade = useCallback(() => {
    setReviewHighlightActive(false);
    if (reviewFadeTimerRef.current) clearTimeout(reviewFadeTimerRef.current);
    reviewFadeTimerRef.current = setTimeout(() => {
      setReviewRenderedInstructions(null);
      clearHelperAgentReview();
    }, 220);
  }, [clearHelperAgentReview]);

  // ── HA Review: compute diff-highlighted instructions on snapshot change ──────
  const reviewBaselineRef = useRef<AgentConfig | null>(null);
  const pendingCursorRestoreRef = useRef<number | null>(null);

  useEffect(() => {
    const isStreamingActive = streamingInstructionsData?.agentId === agentConfig.id;
    if (!isHAReviewUIEnabled || !helperAgentReviewSnapshot || (!changedFields.has('instructions') && !isStreamingActive)) {
      if (reviewFadeTimerRef.current) clearTimeout(reviewFadeTimerRef.current);
      setReviewRenderedInstructions(null);
      setReviewHighlightActive(false);
      reviewBaselineRef.current = null;
      return;
    }
    const oldText = helperAgentReviewSnapshot.instructions ?? '';
    const newText = agentConfig.instructions ?? '';
    if (oldText === newText) {
      if (isStreamingActive) {
        setReviewHighlightActive(true);
        reviewBaselineRef.current = agentConfig;
        return;
      }
      if (reviewFadeTimerRef.current) clearTimeout(reviewFadeTimerRef.current);
      setReviewRenderedInstructions(null);
      setReviewHighlightActive(false);
      reviewBaselineRef.current = null;
      return;
    }
    if (reviewFadeTimerRef.current) clearTimeout(reviewFadeTimerRef.current);
    const diffLines = computeInstructionsDiff(oldText, newText);
    setReviewRenderedInstructions(editor.renderInstructionsWithFormatting(newText, diffLines, highlightAllChanges));
    setReviewHighlightActive(true);
    reviewBaselineRef.current = agentConfig;
    if (!isStreamingActive) {
      if (editor.contentEditableRef.current) {
        pendingCursorRestoreRef.current = saveCursorOffset(editor.contentEditableRef.current);
      }
      editor.setContentEditableKey(k => k + 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- editor/clearReviewWithFade are stable refs; adding them would cause infinite loops
  }, [isHAReviewUIEnabled, helperAgentReviewSnapshot, agentConfig.instructions, highlightAllChanges, streamingInstructionsData]);

  // Fade out when the user actually mutates agentConfig
  useEffect(() => {
    if (!reviewHighlightActive || !reviewBaselineRef.current) return;
    const baseline = reviewBaselineRef.current;
    const changed = FADE_WATCH_FIELDS.some(
      f => JSON.stringify(baseline[f]) !== JSON.stringify(agentConfig[f])
    );
    if (changed) clearReviewWithFade();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- FADE_WATCH_FIELDS is a module-level constant; clearReviewWithFade is a stable useCallback
  }, [agentConfig]);

  // ── Local UI state ──────────────────────────────────────────────────────────
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const { buildActivePanel: activePanel, setBuildActivePanel: setActivePanel } = useOutletContext<BuildOutletContext>();

  const { addToast } = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Pill config panel state
  const [selectedPill, setSelectedPill] = useState<PillConfig | null>(null);
  const [pillPanelVisible, setPillPanelVisible] = useState(false);
  const [pillInputStates, setPillInputStates] = useState<Record<string, Record<string, 'adaptive-ai' | 'custom' | null>>>({});

  const handlePillClick = (config: PillConfig) => {
    setSelectedPill(config);
    setPillPanelVisible(true);
  };

  const handlePillPanelClose = () => {
    setPillPanelVisible(false);
    setTimeout(() => setSelectedPill(null), 300);
  };

  // Auto-open component detail panel when navigated from Preview with a pill/source target
  useEffect(() => {
    const openPill = (location.state as any)?.openPill as { label: string; type: PillConfig['type'] } | undefined;
    if (!openPill) return;
    const config = resolvePillConfig(openPill.label, openPill.type, getToolChannel(openPill.label));
    handlePillClick(config);
    window.history.replaceState({ ...window.history.state, usr: { ...((window.history.state as any)?.usr ?? {}), openPill: undefined } }, '');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run once on mount to consume navigation state
  }, []);

  const handlePillInputChange = (inputName: string, mode: 'adaptive-ai' | 'custom') => {
    if (!selectedPill) return;
    const id = selectedPill.id;
    setPillInputStates(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [inputName]: mode },
    }));
  };

  const [activeTriggerDetail, setActiveTriggerDetail] = useState<ComponentItem | null>(null);

  // ── Eval mode state ─────────────────────────────────────────────────────────
  const originalValuesRef = useRef<Record<string, string>>({});
  const [sectionStatuses, setSectionStatuses] = useState<Record<string, FeedbackStatus>>({});

  // ── capabilities (passed to editor for pill rendering) ─────────────────────
  const capabilities = React.useMemo(() => {
    const agentCaps = agentConfig.capabilities || [];
    return agentCaps.map((cap, index) => ({
      id: index + 1,
      type: cap.type as 'knowledge' | 'action' | 'connector' | 'trigger',
      label: cap.name,
      icon: getCapabilityIcon(cap.type),
      color: 'text-brand-purple border-gray-300',
    }));
  }, [agentConfig.capabilities]);

  // ── Hooks ───────────────────────────────────────────────────────────────────
  const panel = useComponentsPanel();
  const [createSkillModalOpen, setCreateSkillModalOpen] = React.useState(false);
  const [skillBrowserOpen, setSkillBrowserOpen] = React.useState(false);
  const [selectedSkillId, setSelectedSkillId] = React.useState<string | null>(null);
  const [toolsBrowserOpen, setToolsBrowserOpen] = React.useState(false);
  const [toolsBrowserAnchorRect, setToolsBrowserAnchorRect] = React.useState<DOMRect | null>(null);
  const [activeConnectorDetail, setActiveConnectorDetail] = React.useState<{ item: ComponentItem; isMcp: boolean } | null>(null);
  const [mcpFormOpen, setMcpFormOpen] = React.useState(false);
  const [restApiFormOpen, setRestApiFormOpen] = React.useState(false);
  const [connectingCapNames, setConnectingCapNames] = React.useState<Set<string>>(new Set());
  const [connectedCapNames, setConnectedCapNames] = React.useState<Set<string>>(new Set());
  const connectTimerIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [addTypeMenuOpen, setAddTypeMenuOpen] = React.useState(false);
  const [addTypeMenuPos, setAddTypeMenuPos] = React.useState<CopilotMenuPosition>({ top: 0, left: 0 });
  const [newlyAddedCapNames, setNewlyAddedCapNames] = React.useState<Set<string>>(new Set());
  const selectedSkill = skills.find(s => s.id === selectedSkillId) ?? null;

  // ── Derive ComponentItem[] from real capabilities + triggers in instructions ─
  const derivedComponentItems = React.useMemo<ComponentItem[]>(() => {
    const items: ComponentItem[] = [];

    const snapshotCapsEarly: AgentCapability[] = (isHAReviewUIEnabled && helperAgentReviewSnapshot)
      ? (helperAgentReviewSnapshot.capabilities ?? [])
      : [];
    const snapshotNamesEarly = snapshotCapsEarly.length ? new Set(snapshotCapsEarly.map(c => c.name)) : null;

    (agentConfig.capabilities ?? []).forEach((cap, idx) => {
      const capName = cap.name.startsWith('Tool: ') ? cap.name.substring(6) : cap.name;
      const dashIdx = capName.indexOf(' - ');
      const hasPrefix = dashIdx !== -1;
      const source = cap.source || (hasPrefix ? capName.substring(0, dashIdx) : 'Others');
      const shortName = hasPrefix ? capName.substring(dashIdx + 3) : capName;
      const itemType: ComponentItem['type'] =
        cap.type === 'knowledge' ? 'knowledge' :
        cap.type === 'trigger'   ? 'trigger'   :
        cap.type === 'agent'     ? 'agent'      : 'tool';
      const subType = cap.type === 'connector' ? 'connector' : cap.type === 'action' ? 'other' : undefined;
      items.push({
        id: `cap-${idx}`,
        name: shortName,
        description: cap.description || '',
        type: itemType,
        subType,
        source,
        isNew: newlyAddedCapNames.has(cap.name),
        reviewState: snapshotNamesEarly && !snapshotNamesEarly.has(cap.name) ? 'added' : undefined,
      });
    });

    const instructions = agentConfig.instructions || '';
    const seen = new Set<string>();
    const capNames = new Set(items.map(i => i.name));
    const bracketRe = /\[\[([^\]]+)\]\]/g;
    let m: RegExpExecArray | null;
    while ((m = bracketRe.exec(instructions)) !== null) {
      const token = m[1];
      if (seen.has(token)) continue;
      seen.add(token);

      if (token.startsWith('Tool: ') || token.startsWith('Tool:')) {
        const toolName = token.startsWith('Tool: ') ? token.substring(6) : token.substring(5);
        const di = toolName.indexOf(' - ');
        const hasPrefix = di !== -1;
        const source = hasPrefix ? toolName.substring(0, di) : 'Others';
        const shortName = hasPrefix ? toolName.substring(di + 3) : toolName;
        if (!capNames.has(shortName)) {
          capNames.add(shortName);
          items.push({ id: `tool-${token}`, name: shortName, description: '', type: 'tool', source });
        }
      } else if (KNOWN_TRIGGERS.includes(token)) {
        const di = token.indexOf(' - ');
        const trigSource = di !== -1 ? token.substring(0, di) : token;
        const rawTrigName = di !== -1 ? token.substring(di + 3) : token;
        const channel = getTriggerChannel(token);
        const trigName = (channel && TRIGGER_PANEL_TITLES[channel]) || getTriggerFriendlyName(token) || rawTrigName;
        if (!capNames.has(trigName)) {
          capNames.add(trigName);
          const isSoftDeleted = (agentConfig.softDeletedTriggers ?? []).includes(token);
          items.push({ id: `trig-${token}`, name: trigName, description: getTriggerTypeLabel(channel), type: 'trigger', source: trigSource, isSoftDeleted });
        }
      } else {
        const di = token.indexOf(' - ');
        const hasPrefix = di !== -1;
        const source = hasPrefix ? token.substring(0, di) : 'Others';
        const shortName = hasPrefix ? token.substring(di + 3) : token;
        if (!capNames.has(shortName)) {
          capNames.add(shortName);
          items.push({ id: `ref-${token}`, name: shortName, description: '', type: 'knowledge', source });
        }
      }
    }

    const hasTrigger = items.some(i => i.type === 'trigger');
    if (!hasTrigger && agentConfig.channel) {
      const token = CHANNEL_TO_TRIGGER[agentConfig.channel.toLowerCase()];
      if (token) {
        const di = token.indexOf(' - ');
        const trigSource = di !== -1 ? token.substring(0, di) : token;
        const rawTrigName = di !== -1 ? token.substring(di + 3) : token;
        const trigName = getTriggerFriendlyName(token) || rawTrigName;
        items.push({
          id: `trig-${token}`,
          name: trigName,
          description: '',
          type: 'trigger',
          source: trigSource,
        });
      }
    }

    if (snapshotCapsEarly.length) {
      const currentNames = new Set((agentConfig.capabilities ?? []).map(c => c.name));
      snapshotCapsEarly.forEach((cap) => {
        if (!currentNames.has(cap.name)) {
          const capName = cap.name.startsWith('Tool: ') ? cap.name.substring(6) : cap.name;
          const dashIdx = capName.indexOf(' - ');
          const hasPrefix = dashIdx !== -1;
          const source = cap.source || (hasPrefix ? capName.substring(0, dashIdx) : 'Others');
          const shortName = hasPrefix ? capName.substring(dashIdx + 3) : capName;
          const itemType: ComponentItem['type'] =
            cap.type === 'knowledge' ? 'knowledge' :
            cap.type === 'trigger'   ? 'trigger'   :
            cap.type === 'agent'     ? 'agent'      : 'tool';
          items.push({
            id: `cap-removed-${cap.name}`,
            name: shortName,
            description: cap.description || '',
            type: itemType,
            source,
            reviewState: 'removed',
          });
        }
      });
    }

    return items;
  }, [agentConfig.capabilities, agentConfig.instructions, agentConfig.channel, newlyAddedCapNames, agentConfig.softDeletedTriggers, isHAReviewUIEnabled, helperAgentReviewSnapshot]);

  const connectedLabels = React.useMemo(
    () => new Set((agentConfig.capabilities || []).filter(c => c.type === 'connector').map(c => c.name)),
    [agentConfig.capabilities],
  );

  // ── Component descriptions (LLM-generated) ────────────────────────────────
  const [componentDescriptions, setComponentDescriptions] = useState<Record<string, string>>({});

  useEffect(() => {
    setComponentDescriptions({});
  }, [agentConfig.id]);

  const componentIdKey = React.useMemo(
    () => derivedComponentItems.filter(i => i.reviewState !== 'removed').map(i => i.id).sort().join(','),
    [derivedComponentItems],
  );

  useEffect(() => {
    if (derivedComponentItems.length === 0) return;
    const needsDesc = derivedComponentItems.filter(
      item => !item.description && !componentDescriptions[item.id] && item.reviewState !== 'removed'
    );
    if (needsDesc.length === 0) return;

    let cancelled = false;
    generateComponentDescriptions(
      { name: agentConfig.name, description: agentConfig.description, purpose: agentConfig.purpose || '' },
      needsDesc.map(i => ({ id: i.id, name: i.name, type: i.type, source: i.source }))
    ).then(result => {
      if (!cancelled) setComponentDescriptions(prev => ({ ...prev, ...result }));
    }).catch(err => {
      console.error('Failed to generate component descriptions:', err);
    });

    return () => { cancelled = true; };
  }, [agentConfig.id, componentIdKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const editor = useBuildPageEditor({
    agentConfig,
    updateAgentConfig,
    updateSpecificAgent,
    clearStreamingInstructions,
    streamingInstructionsData,
    isNarrowPreview,
    capabilities,
    isSlashInsertingRef,
    urlInputActiveRef,
    onBlurResetSlash: () => resetSlashFnRef.current(),
    componentToggles: panel.componentToggles,
    setComponentToggles: panel.setComponentToggles,
    isPillContextMenu,
    derivedComponentItems,
    componentDescriptions,
    registerInstructionsReader,
    unregisterInstructionsReader,
    reviewSnapshotInstructions: helperAgentReviewSnapshot?.instructions ?? undefined,
    onPillConfigure: (editText, label, capType) => {
      if (capType === 'trigger' && isTriggersEnabled) {
        const bracketMatch = editText.match(/\[\[(?:Tool:\s*)?([^\]]+)\]\]/);
        const triggerName = bracketMatch ? bracketMatch[1] : label;
        const di = triggerName.indexOf(' - ');
        const source = di !== -1 ? triggerName.substring(0, di) : label;
        setActiveTriggerDetail({ id: `trigger-${triggerName}`, name: triggerName, description: '', type: 'trigger', source });
        return;
      }
      const bracketMatch = editText.match(/\[\[(?:Tool:\s*)?([^\]]+)\]\]/);
      const fullName = bracketMatch ? bracketMatch[1] : label;
      const channel = getToolChannel(fullName);
      const config = resolvePillConfig(label, capType === 'action' ? 'connector' : capType, channel);
      config.fullName = fullName;
      handlePillClick(config);
    },
    onOpenTrigger: setActiveTriggerDetail,
  });

  const editorRef = useRef(editor);
  editorRef.current = editor;

  // ── Review re-key chain ────────────────────────────────────────────────────
  const prevReviewRenderedRef = useRef<React.ReactNode | null>(null);
  useEffect(() => {
    if (prevReviewRenderedRef.current !== null && reviewRenderedInstructions === null) {
      if (editor.contentEditableRef.current) {
        pendingCursorRestoreRef.current = saveCursorOffset(editor.contentEditableRef.current);
      }
      const draft = editor.draftTextRef.current;
      if (draft !== null && draft !== editor.editableText) {
        editor.setEditableText(draft);
      }
      editor.setContentEditableKey(k => k + 1);
    }
    prevReviewRenderedRef.current = reviewRenderedInstructions;
  }, [reviewRenderedInstructions, editor]);

  useEffect(() => {
    if (pendingCursorRestoreRef.current !== null && editor.contentEditableRef.current) {
      restoreCursorOffset(editor.contentEditableRef.current, pendingCursorRestoreRef.current);
      pendingCursorRestoreRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.contentEditableKey]);

  const slashMenu = useSlashMenu({
    agentConfig,
    updateAgentConfig,
    contentEditableRef: editor.contentEditableRef,
    instructionsBoxRef: editor.instructionsBoxRef,
    editableText: editor.editableText,
    setEditableText: editor.setEditableText,
    setContentEditableKey: editor.setContentEditableKey,
    setIsEditing: editor.setIsEditing,
    readDOMIntoEditableText: editor.readDOMIntoEditableText,
    isSlashInsertingRef,
    urlInputActiveRef,
    draftTextRef: editor.draftTextRef,
  });

  resetSlashFnRef.current = slashMenu.resetSlashState;

  const updateSpecificAgentRef = useRef(updateSpecificAgent);
  updateSpecificAgentRef.current = updateSpecificAgent;

  // ── isEditing stuck-state safety net ──────────────────────────────────────
  useEffect(() => {
    if (!editor.isEditing) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (editor.instructionsBoxRef.current?.contains(target)) return;
      if (slashMenu.slashMenuRef.current?.contains(target)) return;
      editor.setIsEditing(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editor.isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear all pending connecting/connected timers on unmount
  useEffect(() => {
    return () => { connectTimerIdsRef.current.forEach(clearTimeout); };
  }, []);

  // ── Component delete handler ─────────────────────────────────────────────────
  const handleItemDelete = (item: ComponentItem) => {
    if (isToolsDA && item.subType === 'connector') {
      setDisconnectConfirmItem(item);
      return;
    }
    doItemDelete(item);
  };

  const doItemDelete = (item: ComponentItem) => {
    if (item.id.startsWith('cap-')) {
      const idx = parseInt(item.id.slice(4), 10);
      const newCaps = (agentConfig.capabilities || []).filter((_, i) => i !== idx);
      isAgentGlobalUndo
        ? updateWithHistory({ capabilities: newCaps })
        : updateAgentConfig({ capabilities: newCaps });
      setNewlyAddedCapNames(prev => {
        const s = new Set(prev);
        s.delete(item.name);
        if (item.source !== 'Others') s.delete(`${item.source} - ${item.name}`);
        return s;
      });
    } else {
      const prefix = item.id.startsWith('tool-') ? 'tool-'
        : item.id.startsWith('trig-') ? 'trig-'
        : 'ref-';
      const token = item.id.slice(prefix.length);
      const newInstructions = (agentConfig.instructions || '')
        .replace(`[[${token}]]`, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
      updateWithHistory({ instructions: newInstructions });
      editor.setEditableText(newInstructions);
    }
    commitSave();
  };

  // ── Add button handler ─────────────────────────────────────────────────────
  const addDropdownRef = useRef<HTMLDivElement>(null);

  const handleAddButtonClick = (e?: React.MouseEvent, anchorEl?: HTMLElement | null) => {
    const btnEl = anchorEl || (e?.currentTarget as HTMLElement) || addDropdownRef.current;
    const boxEl = editor.instructionsBoxRef.current;
    if (!btnEl) return;
    const btnRect = btnEl.getBoundingClientRect();
    const menuWidth = isInsertComponents ? 380 : 550;
    const menuHeight = isInsertComponents ? 560 : 320;
    const boxLeft = boxEl ? boxEl.getBoundingClientRect().left : 0;
    const boxRight = boxEl ? boxEl.getBoundingClientRect().right : window.innerWidth;
    const naturalLeft = Math.max(boxLeft, btnRect.right - menuWidth);
    const clampedLeft = Math.min(naturalLeft, boxRight - menuWidth);
    const spaceBelow = window.innerHeight - btnRect.bottom;
    const top = spaceBelow >= menuHeight + 4 ? btnRect.bottom + 4 : btnRect.top - menuHeight - 4;

    let localContext = '';
    const savedRange = slashMenu.addInsertionRangeRef.current;
    if (savedRange) {
      const nodeText = savedRange.startContainer?.textContent || '';
      const off = savedRange.startOffset;
      localContext =
        nodeText.slice(Math.max(0, off - 150), off) +
        ' ' +
        nodeText.slice(off, Math.min(nodeText.length, off + 150));
    }

    slashMenu.openedViaAddButtonRef.current = true;
    slashMenu.setAddButtonMenuOpen(true);
    if (!e) editor.setIsEditing(true);
    slashMenu.setSlashState({
      active: true,
      query: '',
      position: { top: Math.max(8, top), left: clampedLeft },
      cursorBottom: 0,
      cursorLeft: 0,
      highlightedIndex: 0,
      tab: 'suggested',
      localContext,
      headerFocusIdx: 0,
    });
  };

  // ── Eval mode helpers ───────────────────────────────────────────────────────
  const caps = agentConfig.capabilities || [];
  const currentTriggers = caps.filter(c => c.type === 'trigger').map(c => c.name).join('|||');
  const currentTools = caps
    .filter(c => c.type === 'action' || c.type === 'connector')
    .map(c => c.name)
    .join('|||');
  const currentKnowledge = caps.filter(c => c.type === 'knowledge').map(c => c.name).join('|||');
  const currentTopics = (agentConfig.topics || []).map(t => t.name).filter(Boolean).join('|||');

  const getOriginal = (key: string) => originalValuesRef.current[key] || '';
  const getSectionStatus = (key: string): FeedbackStatus => sectionStatuses[key] || 'pending';
  const setSectionStatus = (key: string, status: FeedbackStatus) =>
    setSectionStatuses(prev => ({ ...prev, [key]: status }));

  const updateCapabilities = (type: 'knowledge' | 'trigger' | 'action', newValue: string) => {
    const items = newValue ? newValue.split('|||').filter(Boolean) : [];
    const otherCaps = (agentConfig.capabilities || []).filter(c => {
      if (type === 'action') return c.type !== 'action' && c.type !== 'connector';
      return c.type !== type;
    });
    if (isAgentGlobalUndo) {
      updateWithHistory({ capabilities: [...otherCaps, ...items.map(name => ({ name, type }))] });
    } else {
      updateAgentConfig({ capabilities: [...otherCaps, ...items.map(name => ({ name, type }))] });
      markManualDirty();
    }
    commitSave();
  };

  // ── Add Component Modal handlers ────────────────────────────────────────────
  const handleAddComponents = (items: SearchResult[]): number => {
    const categoryToType = (cat: string): AgentCapability['type'] => {
      if (cat === 'knowledge') return 'knowledge';
      if (cat === 'triggers') return 'trigger';
      if (cat === 'agents') return 'agent';
      return 'action';
    };
    const newCapabilities = items.map(item => ({
      name: item.title,
      description: item.description,
      type: categoryToType(item.category),
    }));
    const existingNames = new Set((agentConfig.capabilities || []).map(c => c.name));
    const deduped = newCapabilities.filter(c => !existingNames.has(c.name));
    if (deduped.length === 0) return 0;
    const merged = [...(agentConfig.capabilities || []), ...deduped];
    isAgentGlobalUndo
      ? updateWithHistory({ capabilities: merged })
      : updateAgentConfig({ capabilities: merged });
    commitSave();
    const count = deduped.length;
    addToast({ variant: 'success', title: `${count} component${count > 1 ? 's' : ''} added`, message: `${count} component${count > 1 ? 's have' : ' has'} been added to your agent.` });
    return count;
  };

  // Intercept instructions input: fade out highlights on first keystroke.
  const handleInstructionsInput = () => {
    if (reviewHighlightActive) clearReviewWithFade();
    slashMenu.handleInstructionsInput();
  };

  // ── Components header actions ─────────────────────────────────────────────
  const componentsHeaderActions = (
    <>
      <div className="flex-1" />
      <CopilotButton
        variant="transparent"
        size="sm"
        icon={<ArrowSort24Regular />}
        aria-label="Sort and group components"
        className="hover:!bg-gray-100 active:!bg-gray-200"
        onClick={(e) => {
          if (panel.sortMenuOpen) { panel.setSortMenuOpen(false); return; }
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          panel.setSortMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
          panel.setSortMenuOpen(true);
        }}
      />
      {panel.searchExpanded ? (
        <CopilotInput
          appearance="filled-darker"
          size="sm"
          autoFocus
          value={panel.searchQuery}
          onChange={(e) => panel.setSearchQuery(e.target.value)}
          onBlur={() => { if (!panel.searchQueryRef.current) panel.setSearchExpanded(false); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { panel.setSearchQuery(''); panel.setSearchExpanded(false); } }}
          placeholder="Search..."
          className="w-[200px]"
          contentBefore={<Search24Regular />}
          contentAfter={panel.searchQuery ? (
            <CopilotButton
              variant="transparent"
              size="sm"
              icon={<Dismiss20Regular />}
              tabIndex={-1}
              onMouseDown={(e) => { e.preventDefault(); panel.setSearchQuery(''); }}
              aria-label="Clear search"
            />
          ) : undefined}
        />
      ) : (
        <CopilotButton
          variant="transparent"
          size="sm"
          icon={<Search24Regular />}
          aria-label="Search components"
          className="hover:!bg-gray-100 active:!bg-gray-200"
          onClick={() => panel.setSearchExpanded(true)}
        />
      )}
      <CopilotButton
        variant="secondary"
        size="sm"
        icon={<Add24Regular />}
        data-add-btn="true"
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          if (isToolsDA) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setAddTypeMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
            setToolsBrowserAnchorRect(rect);
            setAddTypeMenuOpen(true);
          } else {
            handleAddButtonClick(e);
          }
        }}
      >
        Add
      </CopilotButton>
    </>
  );

  // ── Slash menu component ───────────────────────────────────────────────────
  const slashMenuComponent = createPortal(
    <SlashCommandMenu
      slashState={slashMenu.slashState}
      filteredSlashItems={slashMenu.filteredSlashItems}
      aiSuggestedItems={slashMenu.aiSuggestedItems}
      urlInputMode={slashMenu.urlInputMode}
      urlInputValue={slashMenu.urlInputValue}
      addButtonMenuOpen={slashMenu.addButtonMenuOpen}
      slashMenuRef={slashMenu.slashMenuRef}
      uploadInputRef={slashMenu.uploadInputRef}
      isSlashInsertingRef={isSlashInsertingRef}
      urlInputActiveRef={urlInputActiveRef}
      openedViaAddButtonRef={slashMenu.openedViaAddButtonRef}
      slashAnchorRef={slashMenu.slashAnchorRef}
      addInsertionRangeRef={slashMenu.addInsertionRangeRef}
      pendingFileRangeRef={slashMenu.pendingFileRangeRef}
      agentConfig={agentConfig}
      contentEditableRef={editor.contentEditableRef}
      editableText={editor.editableText}
      setEditableText={editor.setEditableText}
      setContentEditableKey={editor.setContentEditableKey}
      setUrlInputMode={slashMenu.setUrlInputMode}
      setUrlInputValue={slashMenu.setUrlInputValue}
      setSlashState={slashMenu.setSlashState}
      setAddButtonMenuOpen={slashMenu.setAddButtonMenuOpen}
      pendingCursorEditTextRef={slashMenu.pendingCursorEditTextRef}
      readDOMIntoEditableText={editor.readDOMIntoEditableText}
      onSelectItem={slashMenu.handleSlashSelect}
    />,
    document.body
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className={`flex ${isNarrowPreview ? 'h-full' : ''}`}
      style={isNarrowPreview ? undefined : { minHeight: '100%', overflow: 'visible' }}
    >
      <div
        className={`flex-1 flex flex-col min-h-0 relative ${
          isNarrowPreview
            ? `min-h-0 px-8 pt-6 pb-6 bg-[#FAFBFD] ${activeTriggerDetail ? 'overflow-hidden' : 'overflow-visible'}`
            : `max-w-[1024px] w-full mx-auto px-8 pt-[18px] pb-8 bg-white ${activeTriggerDetail ? 'overflow-hidden' : ''}`
        }`}
        style={activeTriggerDetail ? { height: '100vh' } : undefined}
      >
        {/* Header (name, description, model, icon) */}
        {!isEvalMode && (
          <div data-section="Agent Header" data-section-description="The agent's name, description, and settings. Changes here affect how the agent appears to users.">
          <BuildPageHeader
            agentConfig={agentConfig}
            updateAgentConfig={updateAgentConfig}
            isNarrowPreview={isNarrowPreview}
            editableName={editor.editableName}
            setEditableName={editor.setEditableName}
            isEditingName={editor.isEditingName}
            setIsEditingName={editor.setIsEditingName}
            isEditingNameLarge={editor.isEditingNameLarge}
            nameEditRef={editor.nameEditRef}
            nameEditLargeRef={editor.nameEditLargeRef}
            handleNameLargeClick={editor.handleNameLargeClick}
            handleNameLargeBlur={editor.handleNameLargeBlur}
            handleNameLargeKeyDown={editor.handleNameLargeKeyDown}
            handleNameInput={editor.handleNameInput}
            editableDescription={editor.editableDescription}
            setEditableDescription={editor.setEditableDescription}
            isEditingDescription={editor.isEditingDescription}
            isEditingDescriptionLarge={editor.isEditingDescriptionLarge}
            isTruncated={editor.isTruncated}
            showDescriptionTooltip={editor.showDescriptionTooltip}
            setShowDescriptionTooltip={editor.setShowDescriptionTooltip}
            descriptionEditRef={editor.descriptionEditRef}
            descriptionEditLargeRef={editor.descriptionEditLargeRef}
            descriptionDisplayRef={editor.descriptionDisplayRef}
            handleDescriptionClick={editor.handleDescriptionClick}
            handleDescriptionBlur={editor.handleDescriptionBlur}
            handleDescriptionKeyDown={editor.handleDescriptionKeyDown}
            handleDescriptionLargeClick={editor.handleDescriptionLargeClick}
            handleDescriptionInput={editor.handleDescriptionInput}
            handleDescriptionLargeBlur={editor.handleDescriptionLargeBlur}
            handleDescriptionLargeKeyDown={editor.handleDescriptionLargeKeyDown}
            isModelDropdownOpen={isModelDropdownOpen}
            setIsModelDropdownOpen={setIsModelDropdownOpen}
            handleModelChange={editor.handleModelChange}
            handleModelTileClick={() => setIsModelDropdownOpen(true)}
            isIconPickerOpen={isIconPickerOpen}
            setIsIconPickerOpen={setIsIconPickerOpen}
            handleIconSelect={editor.handleIconSelect}
          />
          </div>
        )}

        {/* Eval feedback sections or normal Instructions editor.
            Show Accept/Modify FeedbackSections in eval mode OR when a helper
            review snapshot is pending (post-analyze proposals). */}
        {((isEvalMode || (isHAReviewUIEnabled && !!helperAgentReviewSnapshot)) && !isNarrowPreview) ? (
          <div className="flex-1 overflow-y-auto px-0 2xl:px-8 py-6 space-y-0">
            <FeedbackSection
              title="Agent Type"
              sectionKey="agentType"
              icon="🎯"
              renderMode="select"
              options={AGENT_TYPE_OPTIONS}
              originalValue={getOriginal('agentType')}
              currentValue={getAgentTypeValue(agentConfig)}
              onChange={(val) => {
                if (val === 'workflow') updateAgentConfig({ type: 'workflow', audience: null });
                else if (val === 'agent-customer') updateAgentConfig({ type: 'agent', audience: 'customers' });
                else updateAgentConfig({ type: 'agent', audience: 'employees' });
                markManualDirty();
              }}
              status={getSectionStatus('agentType')}
              onStatusChange={(s) => setSectionStatus('agentType', s)}
            />
            <FeedbackSection
              title="Name"
              sectionKey="name"
              icon="✏️"
              renderMode="text"
              originalValue={getOriginal('name')}
              currentValue={agentConfig.name || ''}
              onChange={(val) => { if (isAgentGlobalUndo) { updateWithHistory({ name: val }); } else { updateAgentConfig({ name: val }); markManualDirty(); } }}
              status={getSectionStatus('name')}
              onStatusChange={(s) => setSectionStatus('name', s)}
            />
            <FeedbackSection
              title="Description"
              sectionKey="description"
              icon="📝"
              renderMode="text"
              originalValue={getOriginal('description')}
              currentValue={agentConfig.description || ''}
              onChange={(val) => { if (isAgentGlobalUndo) { updateWithHistory({ description: val }); } else { updateAgentConfig({ description: val }); markManualDirty(); } }}
              status={getSectionStatus('description')}
              onStatusChange={(s) => setSectionStatus('description', s)}
            />
            <FeedbackSection
              title="Instructions"
              sectionKey="instructions"
              icon="📋"
              renderMode="textarea"
              originalValue={getOriginal('instructions')}
              currentValue={editor.editableText}
              onChange={(val) => {
                editor.setEditableText(val);
                if (instructionsHistoryTimerRef.current) {
                  clearTimeout(instructionsHistoryTimerRef.current);
                }
                instructionsHistoryTimerRef.current = setTimeout(() => {
                  updateWithHistory({ instructions: val });
                }, INSTRUCTIONS_UNDO_DEBOUNCE_MS);
              }}
              status={getSectionStatus('instructions')}
              onStatusChange={(s) => setSectionStatus('instructions', s)}
              renderContent={(text) => (
                <div className="text-sm text-gray-900">
                  {editor.renderInstructionsWithFormatting(text)}
                </div>
              )}
            />
            <FeedbackSection
              title="Knowledge search terms"
              sectionKey="knowledge"
              icon="📊"
              renderMode="list"
              subtitle="These are search terms the agent will use to find relevant information on the internet and with Copilot. They are NOT specific documents or URLs."
              originalValue={getOriginal('knowledge')}
              currentValue={currentKnowledge}
              onChange={(val) => updateCapabilities('knowledge', val)}
              status={getSectionStatus('knowledge')}
              onStatusChange={(s) => setSectionStatus('knowledge', s)}
            />
            <FeedbackSection
              title="Triggers"
              sectionKey="triggers"
              icon="⚡"
              renderMode="list"
              suggestions={KNOWN_TRIGGERS}
              constrainToSuggestions
              originalValue={getOriginal('triggers')}
              currentValue={currentTriggers}
              onChange={(val) => updateCapabilities('trigger', val)}
              status={getSectionStatus('triggers')}
              onStatusChange={(s) => setSectionStatus('triggers', s)}
            />
            <FeedbackSection
              title="Tools"
              sectionKey="tools"
              icon="🔧"
              renderMode="typed-list"
              suggestions={KNOWN_TOOLS}
              constrainToSuggestions
              originalValue={getOriginal('tools')}
              currentValue={currentTools}
              onChange={(val) => updateCapabilities('action', val)}
              status={getSectionStatus('tools')}
              onStatusChange={(s) => setSectionStatus('tools', s)}
            />
          </div>
        ) : (
          <div data-section="Instructions Panel" data-section-description="Where you write the agent's instructions in natural language. Controls how the agent behaves and responds.">
          <InstructionsEditor
            isEditing={editor.isEditing}
            isStreaming={editor.isStreaming}
            hidePlaceholder={false}
            editableText={editor.editableText}
            contentEditableKey={editor.contentEditableKey}
            showHeaderBorder={editor.showHeaderBorder}
            isNarrowPreview={isNarrowPreview}
            contentEditableRef={editor.contentEditableRef}
            scrollContainerRef={editor.scrollContainerRef}
            instructionsBoxRef={editor.instructionsBoxRef}
            addDropdownRef={addDropdownRef}
            addButtonMenuOpen={slashMenu.addButtonMenuOpen}
            addInsertionRangeRef={slashMenu.addInsertionRangeRef}
            onAddButtonClick={handleAddButtonClick}
            onLineInsertClick={(e, insertionRange) => {
              slashMenu.addInsertionRangeRef.current = insertionRange;
              handleAddButtonClick(e);
            }}
            onBlur={editor.handleBlur}
            onContentClick={editor.handleContentClick}
            onKeyDown={slashMenu.handleInstructionsKeyDown}
            onInput={handleInstructionsInput}
            onScroll={editor.handleScroll}
            renderedInstructions={reviewRenderedInstructions ?? editor.renderInstructionsWithFormatting(editor.editableText)}
            reviewHighlightActive={reviewHighlightActive}
            highlightAllChanges={highlightAllChanges}
            slashMenuComponent={slashMenuComponent}
            activePanel={activePanel}
            onActivePanelChange={setActivePanel}
            activeComponentFilter={COMPONENT_TAB_TO_FILTER_LABEL[panel.activeComponentTab]}
            onComponentFilterChange={(filter) => {
              panel.setActiveComponentTab(FILTER_LABEL_TO_COMPONENT_TAB[filter]);
              panel.setSearchQuery('');
            }}
            onFlushDraft={() => { if (activePanel === 'instructions') editor.flushDraft(); }}
            componentCount={derivedComponentItems.length}
            componentsHeaderActions={componentsHeaderActions}
            isSkillsEnabled={isSkillsEnabled}
            onIsStuckChange={setIsInstructionsHeaderStuck}
            componentsContent={
              <ComponentsPanel
                isNarrowPreview={isNarrowPreview}
                embedded
                hideFilterPills
                items={derivedComponentItems}
                componentDescriptions={componentDescriptions}
                skills={skills.filter(s => s.agentId === currentAgentId)}
                onSkillDelete={deleteSkill}
                onSkillConfigure={(skill) => setSelectedSkillId(skill.id)}
                onCreateSkill={isSkillsEnabled ? () => setCreateSkillModalOpen(true) : undefined}
                isSkillsEnabled={isSkillsEnabled}
                onOpenWorkIQ={isWorkIQEnabled ? () => setShowWorkIQDetail(true) : undefined}
                onOpenTrigger={setActiveTriggerDetail}
                {...panel}
                showDeletedItems={isHAReviewUIEnabled && !!helperAgentReviewSnapshot && highlightAllChanges}
                onAddClick={handleAddButtonClick}
                onItemDelete={handleItemDelete}
                connectingCapNames={connectingCapNames}
                connectedCapNames={connectedCapNames}
                hideTypes={isToolsDA ? ['trigger', 'agent'] : undefined}
                onItemConfigure={(item) => {
                  if (isToolsDA && item.subType === 'connector') {
                    const connectorKey = item.source !== 'Others' ? item.source : item.name;
                    setActiveConnectorDetail({ item, isMcp: isConnectorMcp(connectorKey) });
                    return;
                  }
                  const fullName = item.source !== 'Others' ? `${item.source} - ${item.name}` : item.name;
                  const channel = getToolChannel(fullName);
                  const capType = item.type === 'tool'
                    ? 'connector'
                    : item.type === 'topic'
                      ? 'knowledge'
                      : item.type;
                  const config = resolvePillConfig(item.name, capType, channel);
                  config.fullName = fullName;
                  handlePillClick(config);
                }}
              />
            }
          />
          </div>
        )}
        {editor.pillMenuElement}

        {/* Connector config overlay */}
        <PillConfigPanel
          pill={selectedPill}
          visible={pillPanelVisible}
          inputs={selectedPill ? (pillInputStates[selectedPill.id] || {}) : {}}
          onInputChange={handlePillInputChange}
          onClose={handlePillPanelClose}
          initialDescription={selectedPill ? (
            (() => {
              const names = [selectedPill.label, selectedPill.id, selectedPill.fullName].filter(Boolean);
              const match = derivedComponentItems.find(item => names.includes(item.name));
              if (match) return componentDescriptions[match.id] || match.description || '';
              return componentDescriptions[selectedPill.id] || '';
            })()
          ) : ''}
        />

        {/* Create Skill modal */}
        <CreateSkillModal
          open={createSkillModalOpen}
          onClose={() => setCreateSkillModalOpen(false)}
          onSave={(skillData) => addSkill(skillData)}
          onBrowse={() => { setCreateSkillModalOpen(false); setSkillBrowserOpen(true); }}
          agentId={currentAgentId ?? undefined}
        />

        {/* Skill browser modal */}
        <SkillBrowserModal
          open={skillBrowserOpen}
          onClose={() => setSkillBrowserOpen(false)}
          onImport={(skills) => skills.forEach(s => addSkill(s))}
          agentId={currentAgentId ?? undefined}
        />

        {/* Skill detail panel */}
        <SkillConfigPanel
          skill={selectedSkill}
          visible={selectedSkillId !== null}
          onClose={() => setSelectedSkillId(null)}
          onSave={(id: string, updates: Record<string, unknown>) => updateSkill(id, updates)}
        />

        {/* Work IQ detail overlay */}
        {isWorkIQEnabled && showWorkIQDetail && (
          <WorkIQDetailPanel
            agentConfig={agentConfig}
            onBack={() => setShowWorkIQDetail(false)}
            onClose={() => setShowWorkIQDetail(false)}
            onServersChange={(servers) => {
              updateAgentConfig({ workIq: { enabled: true, enabledServers: servers } });
              markManualDirty();
            }}
          />
        )}

        {/* Disconnect confirmation dialog (isToolsDA) */}
        <Dialog isOpen={!!disconnectConfirmItem} onClose={() => setDisconnectConfirmItem(null)} maxWidth="sm">
          <DialogHeader onClose={() => setDisconnectConfirmItem(null)}>
            <DialogTitle>Disconnect {disconnectConfirmItem?.name}?</DialogTitle>
          </DialogHeader>
          <DialogContent>
            <p className="text-sm text-gray-600">
              Disconnecting <strong>{disconnectConfirmItem?.name}</strong> won't affect your agent right away — it will continue working as-is until you publish. After publishing, the agent will no longer have access to this tool.
            </p>
          </DialogContent>
          <DialogFooter>
            <CopilotButton variant="secondary" onClick={() => setDisconnectConfirmItem(null)}>
              Cancel
            </CopilotButton>
            <CopilotButton
              variant="primary"
              icon={<PlugDisconnected20Regular />}
              className="bg-red-600 hover:bg-red-700 active:bg-red-800"
              onClick={() => {
                if (disconnectConfirmItem) {
                  doItemDelete(disconnectConfirmItem);
                  setDisconnectConfirmItem(null);
                }
              }}
            >
              Disconnect
            </CopilotButton>
          </DialogFooter>
        </Dialog>

        {/* Add Component Modal */}
        <AddComponentModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onAddItems={handleAddComponents}
        />

        {/* Connector detail overlay (isToolsDA) */}
        {isToolsDA && activeConnectorDetail && (
          activeConnectorDetail.isMcp ? (
            <McpDetailPanel
              item={activeConnectorDetail.item}
              onBack={() => setActiveConnectorDetail(null)}
              onClose={() => setActiveConnectorDetail(null)}
            />
          ) : (
            <ActionDetailPanel
              item={activeConnectorDetail.item}
              onBack={() => setActiveConnectorDetail(null)}
            />
          )
        )}

        {/* Add-type dropdown menu (isToolsDA) */}
        {isToolsDA && addTypeMenuOpen && createPortal(
          <CopilotMenu
            position={addTypeMenuPos}
            onClose={() => setAddTypeMenuOpen(false)}
            minWidth={160}
            items={[
              {
                label: 'Skills',
                icon: <BookStar20Regular />,
                onClick: () => {
                  setAddTypeMenuOpen(false);
                  setCreateSkillModalOpen(true);
                },
              },
              {
                label: 'Tools',
                icon: <WrenchRegular />,
                onClick: () => {
                  setAddTypeMenuOpen(false);
                  setToolsBrowserOpen(true);
                },
              },
              {
                label: 'Knowledge',
                icon: <Library20Regular />,
                onClick: () => {
                  setAddTypeMenuOpen(false);
                  panel.setActiveComponentTab('knowledge');
                  handleAddButtonClick();
                },
              },
            ]}
          />,
          document.body
        )}

        {/* Tools browser flyout (isToolsDA) */}
        {isToolsDA && (
          <ToolsBrowserModal
            isOpen={toolsBrowserOpen}
            anchorRect={toolsBrowserAnchorRect}
            onClose={() => setToolsBrowserOpen(false)}
            connectedLabels={connectedLabels}
            onAdd={(tool) => {
              const newCap = { name: tool.label, type: 'connector' as const };
              const newCaps = [newCap, ...(agentConfig.capabilities || [])];
              isAgentGlobalUndo ? updateWithHistory({ capabilities: newCaps }) : updateAgentConfig({ capabilities: newCaps });
              commitSave();
              setNewlyAddedCapNames(prev => { const s = new Set(prev); s.add(tool.label); return s; });
              panel.setActiveComponentTab('tools');
            }}
            onDisconnect={(tool) => {
              const newCaps = (agentConfig.capabilities || []).filter(
                (c) => !(c.type === 'connector' && c.name === tool.label)
              );
              isAgentGlobalUndo ? updateWithHistory({ capabilities: newCaps }) : updateAgentConfig({ capabilities: newCaps });
              commitSave();
            }}
            onManage={(tool) => {
              if (isToolsDA && tool.isMcp) {
                setActiveConnectorDetail({
                  item: {
                    id: `cap-${tool.label}`,
                    name: tool.label,
                    description: '',
                    type: 'tool',
                    subType: 'connector',
                    source: tool.isMicrosoft ? 'Microsoft' : 'Others',
                  },
                  isMcp: true,
                });
                setToolsBrowserOpen(false);
                return;
              }
              const config = resolvePillConfig(tool.label, 'connector', getToolChannel(tool.label));
              config.fullName = tool.label;
              handlePillClick(config);
            }}
            onOpenMcpForm={() => setMcpFormOpen(true)}
            onOpenRestApiForm={() => setRestApiFormOpen(true)}
          />
        )}

        {/* New MCP server panel (isToolsDA) */}
        {isToolsDA && mcpFormOpen && (
          <NewMcpServerPanel
            onBack={() => setMcpFormOpen(false)}
            onAdd={(mcpName) => {
              const newCap = { name: mcpName, type: 'connector' as const };
              const newCaps = [newCap, ...(agentConfig.capabilities || [])];
              isAgentGlobalUndo ? updateWithHistory({ capabilities: newCaps }) : updateAgentConfig({ capabilities: newCaps });
              commitSave();
              setNewlyAddedCapNames(prev => { const s = new Set(prev); s.add(mcpName); return s; });
              panel.setActiveComponentTab('tools');
              setConnectingCapNames(prev => { const s = new Set(prev); s.add(mcpName); return s; });
              const t1 = setTimeout(() => {
                setConnectingCapNames(prev => { const s = new Set(prev); s.delete(mcpName); return s; });
                setConnectedCapNames(prev => { const s = new Set(prev); s.add(mcpName); return s; });
                const t2 = setTimeout(() => {
                  setConnectedCapNames(prev => { const s = new Set(prev); s.delete(mcpName); return s; });
                }, 3000);
                connectTimerIdsRef.current.push(t2);
              }, 10000);
              connectTimerIdsRef.current.push(t1);
            }}
          />
        )}

        {/* New REST API panel (isToolsDA) */}
        {isToolsDA && restApiFormOpen && (
          <NewRestApiPanel
            onBack={() => setRestApiFormOpen(false)}
            onAdd={(apiName) => {
              const newCap = { name: apiName, type: 'connector' as const };
              const newCaps = [newCap, ...(agentConfig.capabilities || [])];
              isAgentGlobalUndo ? updateWithHistory({ capabilities: newCaps }) : updateAgentConfig({ capabilities: newCaps });
              commitSave();
              setNewlyAddedCapNames(prev => { const s = new Set(prev); s.add(apiName); return s; });
              panel.setActiveComponentTab('tools');
              setConnectingCapNames(prev => { const s = new Set(prev); s.add(apiName); return s; });
              const t1 = setTimeout(() => {
                setConnectingCapNames(prev => { const s = new Set(prev); s.delete(apiName); return s; });
                setConnectedCapNames(prev => { const s = new Set(prev); s.add(apiName); return s; });
                const t2 = setTimeout(() => {
                  setConnectedCapNames(prev => { const s = new Set(prev); s.delete(apiName); return s; });
                }, 3000);
                connectTimerIdsRef.current.push(t2);
              }, 10000);
              connectTimerIdsRef.current.push(t1);
            }}
          />
        )}

        {/* Trigger detail overlay */}
        {isTriggersEnabled && activeTriggerDetail && (() => {
          const ch = getTriggerChannel(activeTriggerDetail.name) ?? getTriggerChannel(activeTriggerDetail.source) ?? null;
          const isConversational = (ch !== null && CONVERSATIONAL_CHANNEL_KEYS.has(ch))
            || (ch === 'sharepoint' && activeTriggerDetail.name.toLowerCase().includes('chats'));
          return isConversational ? (
            <ConversationalTriggerDetailPanel
              trigger={activeTriggerDetail}
              agentConfig={agentConfig}
              onBack={() => setActiveTriggerDetail(null)}
              onClose={() => setActiveTriggerDetail(null)}
            />
          ) : (
            <EventTriggerDetailPanel
              trigger={activeTriggerDetail}
              onBack={() => setActiveTriggerDetail(null)}
              onClose={() => setActiveTriggerDetail(null)}
            />
          );
        })()}
      </div>

    </div>
  );
};
