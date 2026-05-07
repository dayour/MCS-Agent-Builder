import React from 'react';
import { AgentConfig } from '../types';
import { getConnectorIcon, connectorIconMap } from './agentIcons';
import { CopilotMenuItem } from '../components/ui/CopilotMenu';
import {
  Flash20Regular,
  ArrowRepeatAll20Regular,
  Globe20Regular,
  ClipboardCheckmark20Regular,
  BracesVariable20Regular,
  BranchFork20Regular,
  Table20Regular,
  DocumentPdf20Regular,
  BrainSparkle20Regular,
  Desktop20Regular,
  Bug20Regular,
  Alert20Regular,
  Feed20Regular,
  Toolbox20Regular,
  Library20Regular,
  FlowSparkle20Regular,
  DocumentText20Regular,
  Image20Regular,
  Delete16Regular,
  Delete16Filled,
  Edit16Regular,
  Edit16Filled,
  Open16Regular,
  Open16Filled,
  Copy20Regular,
  Copy20Filled,
  Settings16Regular,
  Settings16Filled,
} from '@fluentui/react-icons';

export interface Capability {
  id: number;
  type: 'knowledge' | 'action' | 'connector' | 'trigger';
  label: string;
  icon: React.ReactNode;
  color: string;
}

export interface SlashMenuItem {
  id: string;
  label: string;
  category: string;
  /** Displayed as the row subtitle in the slash menu row. Falls back to category if absent. */
  subtitle?: string;
  /** Extra search aliases (e.g. "m365" for "Microsoft 365"). Not displayed. */
  searchKeywords?: string;
  editText: string;
  icon: React.ReactNode;
  /** If present, called instead of text insertion when the item is selected. */
  onSelect?: () => void;
}

export interface ComponentItem {
  id: string;
  name: string;
  description: string;
  type: 'knowledge' | 'tool' | 'topic' | 'trigger' | 'agent';
  /** For tool-type items: 'connector' shows a "Connector" badge; 'other' shows no badge */
  subType?: 'connector' | 'other';
  source: string;
  iconKey?: string;
  hasWarning?: boolean;
  /** True when this item was just added in the current session — pins it to the top with a "New" badge */
  isNew?: boolean;
  isSoftDeleted?: boolean;
  reviewState?: 'added' | 'removed';
}

export const mockComponentItems: ComponentItem[] = [
  { id: 'c1', name: 'Documents by ticket type', description: 'Reference and store customer account and policy information', type: 'knowledge', source: 'Excel' },
  { id: 'c2', name: 'Ticket escalation rules', description: 'A document with criteria how to escalate tickets', type: 'knowledge', source: 'Excel' },
  { id: 'c3', name: 'Create and update helpdesk tickets', description: 'Automatically create a ticket from incoming emails and update status as the conversation progresses.', type: 'tool', source: 'Outlook' },
  { id: 'c4', name: 'IT support mailbox & resolution history', description: 'Use past IT support emails to understand common issues and recommended resolutions.', type: 'trigger', source: 'Outlook', hasWarning: true },
  { id: 'c5', name: 'When an email arrives', description: 'Trigger when new email is received in inbox', type: 'trigger', source: 'Outlook' },
  { id: 'c6', name: 'IT helpdesk FAQ', description: 'SharePoint site', type: 'knowledge', source: 'SharePoint' },
  { id: 'c7', name: 'Search internal IT knowledge', description: 'Find answers from internal IT docs, policies, and troubleshooting guides.', type: 'knowledge', source: 'SharePoint' },
  { id: 'c8', name: 'IT office hours', description: 'Collect addressed IT questions during weekly office hour meetings.', type: 'knowledge', source: 'Teams' },
  { id: 'c9', name: 'IT support channel', description: 'Find questions shared in the IT support Teams channel.', type: 'knowledge', source: 'Teams' },
  { id: 'c10', name: 'Read Teams messages', description: 'Help users get IT answers when they message you in Teams.', type: 'tool', source: 'Teams' },
  { id: 'c11', name: 'Contoso MCP server', description: 'Reference and store customer account and policy information', type: 'tool', source: 'Others', iconKey: 'automation' },
  { id: 'c12', name: 'Intake agent', description: 'Ensure all requirement documentation is provided by the customer', type: 'agent', source: 'Others', iconKey: 'generic' },
];

// Bare Fluent icon for inline pills — no grey circle, always black.
export const pillIconStyle = { width: 16, height: 16, color: '#111827' };
// Size class for SVG connector icons inside pills (matches pillIconStyle dimensions).
export const pillIconClass = 'w-[16px] h-[16px]';
// Shared inline style for custom pill <span> elements.
export const pillSpanStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  border: '1px solid #D1D5DB', borderRadius: '9999px',
  color: '#111827', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 400,
  paddingLeft: '7px', paddingRight: '7px', paddingTop: '0px', paddingBottom: '0px',
  verticalAlign: 'middle', position: 'relative', top: '-0.1em',
  cursor: 'pointer', whiteSpace: 'nowrap',
};

// Wraps a generic Fluent icon in a light grey circle the same outer size as connector SVG icons.
export const menuFluentIcon = (icon: React.ReactNode) => (
  <span className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
    {icon}
  </span>
);
export const fluentIconStyle = { color: '#111827', width: 16, height: 16 };

// Maps service prefixes to Fluent icon components (not pre-rendered nodes).
export const serviceFluentIconComponents: Record<string, React.ComponentType<any>> = {
  'http':              Globe20Regular,
  'variable':          BracesVariable20Regular,
  'control':           BranchFork20Regular,
  'data operation':    Table20Regular,
  'pdf':               DocumentPdf20Regular,
  'azure ai':          BrainSparkle20Regular,
  'approvals':         ClipboardCheckmark20Regular,
  'computer operator': Desktop20Regular,
  'azure devops':      Bug20Regular,
  'notifications':     Alert20Regular,
  'rss':               Feed20Regular,
  'adobe pdf':         DocumentPdf20Regular,
  'work iq':           Toolbox20Regular,
};

export const getPillCapabilityIcon = (type: string): React.ReactNode => {
  switch (type) {
    case 'knowledge': return <Library20Regular style={pillIconStyle} />;
    case 'action':    return <FlowSparkle20Regular style={pillIconStyle} />;
    case 'connector': return <FlowSparkle20Regular style={pillIconStyle} />;
    case 'trigger':   return <Flash20Regular style={pillIconStyle} />;
    default:          return <Library20Regular style={pillIconStyle} />;
  }
};

export const getCapabilityIcon = (type: string): React.ReactNode => {
  switch (type) {
    case 'knowledge': return menuFluentIcon(<Library20Regular style={fluentIconStyle} />);
    case 'action':    return menuFluentIcon(<FlowSparkle20Regular style={fluentIconStyle} />);
    case 'connector': return menuFluentIcon(<FlowSparkle20Regular style={fluentIconStyle} />);
    case 'trigger':   return menuFluentIcon(<Flash20Regular style={fluentIconStyle} />);
    default:          return menuFluentIcon(<Library20Regular style={fluentIconStyle} />);
  }
};

/** Maps normalized trigger short names to sentence-friendly display names. */
const TRIGGER_FRIENDLY_NAMES: Record<string, string> = {
  'on new email':                 'a new email arrives',
  'on flagged email':             'an email is flagged',
  'on new channel message':       'a new channel message is posted',
  'on new chat message':          'a new chat message is received',
  'onnewchatmessage':             'a new chat message is received',
  'at mention':                   '@mentioned',
  'atmention':                    '@mentioned',
  'on new items':                 'a new item is created',
  'on new file':                  'a new file is added',
  'getonfileitems':               'a new file is added',
  'on updated items':             'an item is updated',
  'on updated file':              'a file is updated',
  'on change items':              'an item is changed',
  'on changed items':             'an item is changed',
  'on create new form':           'a form is submitted',
  'on new form submission':       'a form is submitted',
  'subscribe web hook':           'a webhook event fires',
  'on webhook':                   'a webhook event fires',
  'on completed task':            'a task is completed',
  'recurrence trigger':           'on a schedule',
  'recurrence':                   'on a schedule',
};

/** Returns a sentence-friendly display name for a trigger. */
export const getTriggerFriendlyName = (triggerName: string): string => {
  const dashIdx = triggerName.indexOf(' - ');
  const shortPart = dashIdx !== -1 ? triggerName.substring(dashIdx + 3) : triggerName;
  const normalized = shortPart.toLowerCase().replace(/\s+v\d+$/i, '').trim();
  const base = TRIGGER_FRIENDLY_NAMES[normalized] ?? shortPart.replace(/\s+v\d+$/i, '').trim();
  const capitalized = base.charAt(0).toUpperCase() + base.slice(1);
  return capitalized;
};

/** Returns a human-readable knowledge sub-type label for a capability name. */
export const getKnowledgeSubtitle = (name: string): string => {
  const lower = name.toLowerCase();
  if (/\.\w{2,5}$/.test(name.trim())) {
    if (lower.match(/\.(docx?|rtf)$/))                           return 'Word document';
    if (lower.match(/\.(xlsx?|csv)$/))                           return 'Excel spreadsheet';
    if (lower.match(/\.(pptx?)$/))                               return 'PowerPoint presentation';
    if (lower.match(/\.(jpe?g|png|gif|svg|webp|bmp|tiff?)$/))   return 'Image';
    if (lower.endsWith('.pdf'))                                  return 'PDF document';
    return 'File';
  }
  const dashIdx = name.indexOf(' - ');
  if (dashIdx !== -1) {
    const prefix = name.substring(0, dashIdx).toLowerCase();
    const subtitleMap: Record<string, string> = {
      'sharepoint':  'SharePoint site',
      'word':        'Word document',
      'word online': 'Word document',
      'excel':       'Excel spreadsheet',
      'excel online':'Excel spreadsheet',
      'powerpoint':  'PowerPoint presentation',
      'onedrive':    'OneDrive file',
      'dataverse':   'Dataverse table',
      'website':     'Website',
      'web':         'Website',
    };
    if (subtitleMap[prefix]) return subtitleMap[prefix];
  }
  if (lower.match(/\b(doc|document|handbook|manual|guide|report|letter|memo|contract|template)\b/)) return 'Word document';
  if (lower.match(/\b(data|spreadsheet|tracker|budget|forecast|pricing|metrics|kpi)\b/))            return 'Excel spreadsheet';
  if (lower.match(/\b(presentation|slides?|deck)\b/))                                               return 'PowerPoint presentation';
  if (lower.match(/\b(website|web page|url|blog|portal)\b/))                                       return 'Website';
  if (lower.match(/\b(database|record|entity|entities|dataverse)\b/))                              return 'Dataverse table';
  return 'SharePoint site';
};

/** Strips "Service - " prefix and version suffix from an action label. */
export const formatActionDisplayName = (label: string): string => {
  const dashIdx = label.indexOf(' - ');
  if (dashIdx === -1) return label;
  return label.substring(dashIdx + 3).replace(/\s*\([Vv]\d+\)$/, '').trim();
};

/** Returns the connector icon key that best represents a knowledge capability by name keywords. */
export const inferKnowledgeIconKey = (name: string): string => {
  const lower = name.toLowerCase();
  const dashIdx = name.indexOf(' - ');
  if (dashIdx !== -1) {
    const prefix = lower.substring(0, dashIdx);
    if (prefix === 'word' || prefix === 'word online') return 'word file';
    if (prefix === 'excel' || prefix === 'excel online') return 'excel file';
    if (prefix === 'powerpoint') return 'powerpoint file';
    if (prefix === 'onedrive') return 'onedrive';
    if (prefix === 'dataverse') return 'dataverse';
    if (prefix === 'sharepoint') return 'sharepoint site';
    if (prefix === 'website' || prefix === 'web') return 'website';
  }
  if (lower.match(/\b(doc|document|handbook|manual|guide|report|letter|memo|contract|template)\b/)) return 'word file';
  if (lower.match(/\b(data|spreadsheet|tracker|budget|forecast|pricing|metrics|kpi|statistics?|numbers?)\b/)) return 'excel file';
  if (lower.match(/\b(presentation|slides?|deck)\b/)) return 'powerpoint file';
  if (lower.match(/\b(website|web page|url|blog|portal)\b/)) return 'website';
  if (lower.match(/\b(database|record|entity|entities|dataverse)\b/)) return 'dataverse';
  return 'sharepoint site';
};

export const getServiceFluentIcon = (service: string): React.ReactNode => {
  const Icon = serviceFluentIconComponents[service];
  if (!Icon) return null;
  return menuFluentIcon(<Icon style={fluentIconStyle} />);
};

/** Maps a trigger name to its channel identifier. */
export const getTriggerChannel = (n: string): string | null => {
  const l = n.toLowerCase();
  if (l.includes('outlook') || l.includes('email') || l.includes('mail')) return 'outlook';
  if (l.includes('sharepoint')) return 'sharepoint';
  if (l.includes('teams') || l.includes('chat') || l.includes('channel') || l.includes('atmention')) return 'teams';
  if (l.includes('onedrive')) return 'onedrive';
  if (l.includes('dataverse')) return 'dataverse';
  if (l.includes('forms')) return 'forms';
  if (l.includes('planner')) return 'planner';
  if (l.includes('recurrence')) return 'recurrence';
  if (l.includes('slack')) return 'slack';
  if (l.includes('whatsapp')) return 'whatsapp';
  if (l.includes('website') || l.includes('webchat')) return 'website';
  if (l.includes('microsoft 365') || l.includes('m365')) return 'microsoft 365';
  if (l.includes('weather')) return 'weather';
  return null;
};

/** Human-readable panel title for each channel key. */
export const TRIGGER_PANEL_TITLES: Record<string, string> = {
  teams:            'When a user messages in Teams',
  outlook:          'When a new email arrives',
  slack:            'When a user messages in Slack',
  whatsapp:         'When a user messages in WhatsApp',
  website:          'When a user messages on Website',
  'microsoft 365':  'When a user messages in Microsoft 365',
  m365:             'When a user messages in Microsoft 365',
  sharepoint:       'When a file or item changes',
  onedrive:         'When a file changes in OneDrive',
  forms:            'When a form response is submitted',
  dataverse:        'When a Dataverse record changes',
  planner:          'When a Planner task is completed',
  recurrence:       'On a recurring schedule',
};

/** Pill-sized icon path for each channel key. Used in both trigger detail panels. */
export const CHANNEL_ICON_PATHS: Record<string, string> = {
  teams:            '/component-icons/Teams16.svg',
  outlook:          '/component-icons/Outlook16.svg',
  sharepoint:       '/component-icons/SharePoint16.svg',
  onedrive:         '/component-icons/OneDrive16.svg',
  slack:            '/component-icons/Slack16.svg',
  whatsapp:         '/component-icons/WhatsApp16.svg',
  website:          '/component-icons/Website16.svg',
  forms:            '/component-icons/Forms16.svg',
  dataverse:        '/component-icons/Dataverse16.svg',
  planner:          '/component-icons/Microsoft36516.svg',
  'microsoft 365':  '/component-icons/Microsoft36516.svg',
  m365:             '/component-icons/Microsoft36516.svg',
  recurrence:       '/component-icons/Recurrence16.svg',
};

/** Human-readable display name for each channel key. Used in both trigger detail panels. */
export const CHANNEL_DISPLAY_NAMES: Record<string, string> = {
  teams:            'Teams',
  outlook:          'Outlook',
  sharepoint:       'SharePoint',
  onedrive:         'OneDrive',
  slack:            'Slack',
  whatsapp:         'WhatsApp',
  website:          'Website',
  forms:            'Microsoft Forms',
  dataverse:        'Dataverse',
  planner:          'Planner',
  'microsoft 365':  'Microsoft 365',
  m365:             'Microsoft 365',
  recurrence:       'Schedule',
};

export const CONVERSATIONAL_CHANNEL_KEYS = new Set(['teams', 'microsoft 365', 'm365', 'slack', 'whatsapp', 'website']);

/** Maps a channel key (from the create flow) to its default trigger name. */
export const CHANNEL_TO_TRIGGER: Record<string, string> = {
  'teams':         'Teams - When a user messages in Teams',
  'microsoft 365': 'Microsoft 365 - When a user messages in Microsoft 365',
  'm365':          'Microsoft 365 - When a user messages in Microsoft 365',
  'website':       'Website - When a user messages on Website',
  'webchat':       'Website - When a user messages on Website',
  'slack':         'Slack - When a user messages in Slack',
  'whatsapp':      'WhatsApp - When a user messages in WhatsApp',
  'outlook':       'Outlook - On New Email',
  'email':         'Outlook - On New Email',
  'sharepoint':    'SharePoint - On New Items',
  'onedrive':      'OneDrive - On New File',
  'forms':         'Forms - On New Form Submission',
  'dataverse':     'Dataverse - On Webhook',
  'planner':       'Planner - On Completed Task',
  'recurrence':    'Recurrence',
};

const CONVERSATIONAL_CHANNEL_DISPLAY_NAMES: Record<string, string> = {
  teams:           'Teams',
  slack:           'Slack',
  whatsapp:        'WhatsApp',
  website:         'the website',
  'microsoft 365': 'Microsoft 365',
  m365:            'Microsoft 365',
};

const EVENT_TRIGGER_DESCRIPTIONS: Record<string, string> = {
  outlook:    'Triggers when a new email is received in inbox',
  sharepoint: 'Triggers when a file or item changes in SharePoint',
  onedrive:   'Triggers when a file changes in OneDrive',
  forms:      'Triggers when a new form response is submitted',
  dataverse:  'Triggers when a Dataverse record changes',
  planner:    'Triggers when a Planner task is completed',
  recurrence: 'Triggers on a recurring schedule',
};

/** Returns the trigger subtitle shown in the component list and detail panel. */
export const getTriggerTypeLabel = (channel: string | null): string => {
  if (!channel) return 'Trigger';
  if (CONVERSATIONAL_CHANNEL_KEYS.has(channel)) {
    const name = CONVERSATIONAL_CHANNEL_DISPLAY_NAMES[channel] ?? channel;
    return `Agent will be available in ${name}`;
  }
  return EVENT_TRIGGER_DESCRIPTIONS[channel] ?? 'Trigger';
};

/** Returns the correct pill-sized icon for a trigger name. */
export const getTriggerPillIcon = (triggerName: string): React.ReactNode => {
  const ch = getTriggerChannel(triggerName);
  if (ch) return getConnectorIcon(ch, pillIconClass) ?? <Flash20Regular style={pillIconStyle} />;
  if (triggerName.toLowerCase().includes('recurrence')) return <ArrowRepeatAll20Regular style={pillIconStyle} />;
  return <Flash20Regular style={pillIconStyle} />;
};

export const getChannelIcon = (channel: string, sizeClass = 'w-6 h-6'): React.ReactNode => {
  const channelLower = channel.toLowerCase();
  const iconMap: Record<string, string> = {
    'website': '/component-icons/Website16.svg',
    'webchat': '/component-icons/Website16.svg',
    'web': '/component-icons/Website16.svg',
    'teams': '/component-icons/Teams16.svg',
    'm365': '/component-icons/Microsoft36516.svg',
    'microsoft 365': '/component-icons/Microsoft36516.svg',
    'slack': '/component-icons/Slack16.svg',
    'email': '/component-icons/Outlook16.svg',
    'outlook': '/component-icons/Outlook16.svg',
    'servicenow': '/component-icons/ServiceNow16.svg',
    'sharepoint': '/component-icons/SharePoint16.svg',
    'onedrive': '/component-icons/OneDrive16.svg',
    'excel online': '/component-icons/Excel16.svg',
    'excel': '/component-icons/Excel16.svg',
    'word online': '/component-icons/Word16.svg',
    'word': '/component-icons/Word16.svg',
    'powerpoint': '/component-icons/PowerPoint16.svg',
    'dataverse': '/component-icons/Dataverse16.svg',
    'whatsapp': '/component-icons/WhatsApp16.svg',
    'ms forms': '/component-icons/Forms16.svg',
    'forms': '/component-icons/Forms16.svg',
    'planner': '/component-icons/Microsoft36516.svg',
    'recurrence': '/component-icons/Recurrence16.svg',
    'office365': '/component-icons/Office16.svg',
    'office': '/component-icons/Office16.svg',
    'approvals': '/component-icons/Office16.svg',
    'copilot': '/component-icons/Microsoft36516.svg',
    'msn weather': '/component-icons/Weather16.svg',
    'weather': '/component-icons/Weather16.svg',
  };
  const iconPath = iconMap[channelLower];
  if (!iconPath) return null;
  return (
    <img
      src={iconPath}
      alt={channel}
      className={sizeClass}
      style={{ display: 'block' }}
    />
  );
};

/** Returns a service icon for a tool/capability label, or a type-based fallback. */
export const getServiceIconForLabel = (label: string, type?: string): React.ReactNode => {
  // Strip "Source - " prefix if present (e.g., "Source - SharePoint - IT Help Desk Knowledge Base" → "SharePoint - IT Help Desk Knowledge Base")
  const normalized = label.startsWith('Source - ') ? label.substring(9) : label;
  const dashIdx = normalized.indexOf(' - ');
  if (dashIdx !== -1) {
    const prefix = normalized.substring(0, dashIdx).toLowerCase();
    if (type === 'knowledge') {
      if (prefix === 'excel' || prefix === 'excel online') return getConnectorIcon('excel file', pillIconClass) ?? null;
      if (prefix === 'word'  || prefix === 'word online')  return getConnectorIcon('word file',  pillIconClass) ?? null;
      if (prefix === 'sharepoint')                         return getConnectorIcon('sharepoint site', pillIconClass) ?? null;
      if (prefix === 'powerpoint')                         return getConnectorIcon('powerpoint file', pillIconClass) ?? null;
    }
    const icon = getConnectorIcon(prefix, pillIconClass);
    if (icon) return icon;
    const FluentIcon = serviceFluentIconComponents[prefix];
    if (FluentIcon) return <FluentIcon style={pillIconStyle} />;
  }
  const lower = normalized.toLowerCase();
  if (/\.\w{2,5}$/.test(normalized.trim())) {
    if (lower.match(/\.(docx?|rtf)$/))  return getConnectorIcon('word file', pillIconClass)        ?? <DocumentText20Regular style={pillIconStyle} />;
    if (lower.match(/\.(xlsx?|csv)$/))  return getConnectorIcon('excel file', pillIconClass)       ?? <DocumentText20Regular style={pillIconStyle} />;
    if (lower.match(/\.(pptx?)$/))      return getConnectorIcon('powerpoint file', pillIconClass)  ?? <DocumentText20Regular style={pillIconStyle} />;
    if (lower.match(/\.(jpe?g|png|gif|svg|webp|bmp|tiff?)$/)) return <Image20Regular style={pillIconStyle} />;
    if (lower.endsWith('.pdf'))         return <DocumentPdf20Regular style={pillIconStyle} />;
    return <DocumentText20Regular style={pillIconStyle} />;
  }
  const keywords = [
    'sharepoint', 'teams', 'onedrive', 'outlook', 'excel', 'word', 'powerpoint',
    'dataverse', 'slack', 'servicenow', 'whatsapp', 'website', 'webchat', 'web',
    'ms forms', 'forms', 'planner', 'office365', 'office', 'copilot', 'approvals',
    'recurrence', 'msn weather', 'weather',
  ];
  for (const kw of keywords) {
    if (lower.includes(kw)) return getChannelIcon(kw, pillIconClass);
  }
  if (type === 'knowledge') {
    return getConnectorIcon(inferKnowledgeIconKey(normalized), pillIconClass) ?? null;
  }
  for (const kw of Object.keys(connectorIconMap)) {
    const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(lower)) return getConnectorIcon(kw, pillIconClass);
  }
  return type ? getPillCapabilityIcon(type) : null;
};

/** Strips "Service - " prefix from a label when a service icon is available for it. */
export const getServiceShortLabel = (label: string): string => {
  const dashIdx = label.indexOf(' - ');
  if (dashIdx !== -1) {
    const prefix = label.substring(0, dashIdx).toLowerCase();
    if (getConnectorIcon(prefix)) return label.substring(dashIdx + 3);
  }
  return label;
};

/** Aggressively strips all known prefixes (service names, "Source", "Tool") from a label.
 *  e.g. "Source - Word - PTO and Leave Policy Guide" → "PTO and Leave Policy Guide".
 *  Used only behind the isPillContextMenu feature flag. */
export const stripAllPrefixes = (label: string): string => {
  const knownPrefixes = ['source', 'tool'];
  let result = label;
  let changed = true;
  while (changed) {
    changed = false;
    const dashIdx = result.indexOf(' - ');
    if (dashIdx !== -1) {
      const prefix = result.substring(0, dashIdx).toLowerCase();
      if (getConnectorIcon(prefix) || knownPrefixes.includes(prefix)) {
        result = result.substring(dashIdx + 3);
        changed = true;
      }
    }
  }
  return result;
};

/**
 * Single source of truth for component icon resolution.
 * Returns the best SVG connector icon for a capability name + type, or null.
 * Used by the slash menu, instruction pills, and Components tile so all contexts stay in sync.
 */
export const resolveComponentIcon = (name: string, type: string, sizeClass: string, svgOnly = false): React.ReactNode => {
  const n = name.startsWith('Tool: ') ? name.substring(6) : name;

  // 1. File extensions — map to exact document-type icons
  if (/\.\w{2,5}$/.test(n.trim())) {
    const lower = n.toLowerCase();
    if (lower.match(/\.(docx?|rtf)$/)) return getConnectorIcon('word file', sizeClass) ?? null;
    if (lower.match(/\.(xlsx?|csv)$/)) return getConnectorIcon('excel file', sizeClass) ?? null;
    if (lower.match(/\.(pptx?)$/))     return getConnectorIcon('powerpoint file', sizeClass) ?? null;
    return null;
  }

  // 2. "Source - Label" prefix: determines which service icon to show
  //    Knowledge sources → doc/site icons (referencing a specific document or site)
  //    Actions/tools     → app icons (performing operations via the service)
  const dashIdx = n.indexOf(' - ');
  if (dashIdx !== -1) {
    const prefix = n.substring(0, dashIdx).toLowerCase();
    if (type === 'knowledge') {
      if (prefix === 'excel' || prefix === 'excel online') return getConnectorIcon('excel file', sizeClass) ?? null;
      if (prefix === 'word'  || prefix === 'word online')  return getConnectorIcon('word file',  sizeClass) ?? null;
      if (prefix === 'sharepoint')                         return getConnectorIcon('sharepoint site', sizeClass) ?? null;
      if (prefix === 'onedrive')                           return getConnectorIcon('onedrive', sizeClass) ?? null;
      if (prefix === 'powerpoint')                         return getConnectorIcon('powerpoint file', sizeClass) ?? null;
    }
    const GENERIC_M365 = new Set(['microsoft 365', 'office 365', 'office365', 'office', 'm365']);
    if (GENERIC_M365.has(prefix)) {
      const action = n.substring(dashIdx + 3).toLowerCase();
      if (/\b(email|mail|inbox|send.*mail|reply|forward|flag)\b/.test(action)) return getConnectorIcon('outlook', sizeClass) ?? null;
      if (/\b(teams|chat|channel|meeting)\b/.test(action)) return getConnectorIcon('teams', sizeClass) ?? null;
      if (/\b(sharepoint|site)\b/.test(action)) return getConnectorIcon('sharepoint', sizeClass) ?? null;
      if (/\b(onedrive)\b/.test(action)) return getConnectorIcon('onedrive', sizeClass) ?? null;
      if (/\b(calendar|event|appointment)\b/.test(action)) return getConnectorIcon('outlook', sizeClass) ?? null;
      if (/\b(excel|spreadsheet)\b/.test(action)) return getConnectorIcon('excel', sizeClass) ?? null;
      if (/\b(word|document)\b/.test(action)) return getConnectorIcon('word', sizeClass) ?? null;
      if (/\b(planner|task)\b/.test(action)) return getConnectorIcon('planner', sizeClass) ?? null;
      if (/\b(forms|survey)\b/.test(action)) return getConnectorIcon('forms', sizeClass) ?? null;
    }
    const svgIcon = getConnectorIcon(prefix, sizeClass);
    if (svgIcon) return svgIcon;
    if (!svgOnly) {
      const FluentIcon = serviceFluentIconComponents[prefix];
      if (FluentIcon) {
        const pxMatch = sizeClass.match(/w-\[(\d+)px\]/);
        const twMatch = sizeClass.match(/w-(\d+)/);
        const px = pxMatch ? parseInt(pxMatch[1]) : twMatch ? parseInt(twMatch[1]) * 4 : 20;
        return <FluentIcon style={{ width: px, height: px, color: '#374151' }} />;
      }
    }
  }

  // 3. No prefix — type-specific semantic resolution
  if (type === 'knowledge') return getConnectorIcon(inferKnowledgeIconKey(n), sizeClass) ?? null;
  if (type === 'trigger') {
    const ch = getTriggerChannel(n);
    return ch ? (getConnectorIcon(ch, sizeClass) ?? null) : null;
  }

  // 4. Actions/connectors without prefix: try exact name match first (covers Fluent icon connectors)
  const lower = n.toLowerCase();
  const exactIcon = getConnectorIcon(lower, sizeClass);
  if (exactIcon) return exactIcon;

  // 5. Keyword scan across known SVG connector icons
  for (const kw of Object.keys(connectorIconMap)) {
    const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(lower)) return getConnectorIcon(kw, sizeClass);
  }

  return null;
};

export const AGENT_TYPE_OPTIONS = [
  { value: 'agent-customer', label: 'Agent for customers', description: 'Interacts with external customers — emphasizes brand voice, empathy, and clear communication' },
  { value: 'agent-employee', label: 'Agent for employees', description: 'Interacts with internal employees — focuses on productivity, internal tools, and company processes' },
  { value: 'workflow', label: 'Workflow', description: 'An automated multi-step process triggered by events — no direct user interaction' },
];

export function getAgentTypeValue(agentConfig: AgentConfig): string {
  if (agentConfig.type === 'workflow') return 'workflow';
  if (agentConfig.audience === 'customers') return 'agent-customer';
  return 'agent-employee';
}

export interface ComponentMenuCallbacks {
  componentToggles: Record<string, boolean>;
  setComponentToggles: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onOpen?: (item: ComponentItem) => void;
  onConfigure?: (item: ComponentItem) => void;
  onDelete?: (item: ComponentItem) => void;
}

export interface PillMenuCallbacks {
  onConfigure: (editText: string) => void;
  onDelete: (editText: string) => void;
  componentToggles: Record<string, boolean>;
  setComponentToggles: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export const getPillContextMenuItems = (
  editText: string,
  capType: 'knowledge' | 'action' | 'connector' | 'trigger',
  callbacks: PillMenuCallbacks
): CopilotMenuItem[] => {
  const items: CopilotMenuItem[] = [
    { label: 'Configure', icon: <Settings16Regular />, iconFilled: <Settings16Filled />, onClick: () => callbacks.onConfigure(editText) },
    { label: 'Delete', icon: <Delete16Regular />, iconFilled: <Delete16Filled />, destructive: true, onClick: () => callbacks.onDelete(editText) },
  ];
  if (capType === 'knowledge') {
    const toggled = callbacks.componentToggles[editText] ?? true;
    items.push({
      label: 'Official source', dividerAbove: true,
      toggle: { checked: toggled, onChange: (v) => callbacks.setComponentToggles(prev => ({ ...prev, [editText]: v })) },
    });
  } else if (capType !== 'trigger') {
    const toggled = callbacks.componentToggles[editText] ?? true;
    items.push({
      label: 'Enabled', dividerAbove: true,
      toggle: { checked: toggled, onChange: (v) => callbacks.setComponentToggles(prev => ({ ...prev, [editText]: v })) },
    });
  }
  return items;
};

export const getComponentMenuItems = (item: ComponentItem, { componentToggles, setComponentToggles, onOpen, onConfigure, onDelete }: ComponentMenuCallbacks): CopilotMenuItem[] => {
  const toggled = componentToggles[item.id] ?? true;
  const setToggle = (v: boolean) => setComponentToggles(prev => ({ ...prev, [item.id]: v }));
  const openItem: CopilotMenuItem = { label: 'Open', icon: <Open16Regular />, iconFilled: <Open16Filled />, onClick: () => onOpen?.(item) };
  const editItem: CopilotMenuItem = { label: 'Edit', icon: <Edit16Regular />, iconFilled: <Edit16Filled />, onClick: () => onConfigure?.(item) };
  const makeCopyItem: CopilotMenuItem = {
    label: 'Make a copy',
    icon: <Copy20Regular className="w-4 h-4" />,
    iconFilled: <Copy20Filled className="w-4 h-4" />,
    onClick: () => {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        const copyText = `${item.name}${item.description ? `\n${item.description}` : ''}`;
        void navigator.clipboard.writeText(copyText);
      }
    },
  };
  const deleteItem: CopilotMenuItem = { label: 'Delete', icon: <Delete16Regular />, iconFilled: <Delete16Filled />, destructive: true, onClick: () => onDelete?.(item) };
  switch (item.type) {
    case 'knowledge':
      return [openItem, editItem, deleteItem, { label: 'Official source', dividerAbove: true, toggle: { checked: toggled, onChange: setToggle } }];
    case 'tool':
      return [editItem, deleteItem, { label: 'Enabled', dividerAbove: true, toggle: { checked: toggled, onChange: setToggle } }];
    case 'agent':
      return [openItem, editItem, { label: 'Enabled', dividerAbove: true, toggle: { checked: toggled, onChange: setToggle } }];
    case 'trigger':
      return [editItem, deleteItem];
    case 'topic':
      return [editItem, makeCopyItem, deleteItem, { label: 'Enabled', dividerAbove: true, toggle: { checked: toggled, onChange: setToggle } }];
  }

  return [];
};
