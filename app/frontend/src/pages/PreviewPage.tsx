import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';

import { useNavigate } from 'react-router-dom';
import { TriggerLabPage } from './TriggerLabPage';
import { useAgent } from '../context/AgentContext';
import { getAgentStorage, setAgentStorage } from '../utils/agentStorage';
import { Message, AgentConfig, LastStepType, MessageEval } from '../types';
import { DA_NODE_TO_LAST_STEP, deriveLastStep, deriveStepsOrTurns, LAST_STEP_ICONS } from '../utils/activityDerivation';
import InlineMessageRating from '../components/InlineMessageRating';
import { snapshotConfig } from '../utils/configDiff';
import { runAgent } from '../utils/agentPreview';
import { generatePreviewPrompts, PreviewPrompt } from '../utils/previewPromptGenerator';
import { CopilotChatInput, CopilotButton, CopilotInput, CopilotCheckbox, DAActivityCoT, CopilotTable, CopilotTooltip, SubHeader, CopilotTypingIndicator, ChainOfThought, ChainOfThoughtItem, ActivitySummaryButton, AgentIcon } from '../components/ui';
import { Switch, Badge, SwitchOnChangeData } from '@fluentui/react-components';
import { SquircleIcon } from '../components/ui/SquircleIcon';
import { detectAgentDomain, getAgentIcon, getUniqueGradientCSS, getGradientByKey, getConnectorIcon } from '../utils/agentIcons';
import { ChannelIcon, M365Icon } from '../components/ui/ChannelIcons';
import { getTriggerFriendlyName } from '../utils/buildPageUtils';
import { KNOWN_TRIGGERS } from '../utils/agentCatalog';
import {
  Compose24Regular, Compose24Filled,
  ChevronDown20Regular, ChevronRight20Regular, ChevronLeft20Regular,
  Chat20Regular, Sparkle20Regular, Chat20Color,
  CheckmarkCircle20Filled, ErrorCircle20Filled, DismissCircle20Filled,
  Clock20Regular, LockClosed20Regular, History20Regular,
  Filter20Regular, ColumnEditRegular, ArrowAutofitWidthRegular,
  CommentMultiple20Regular, Code20Regular, CursorHover20Regular, Flowchart20Regular,
  Prompt20Regular, TaskListLtr20Regular, Flash20Regular, Library20Regular,
  PlugConnected20Regular, BrainCircuit20Regular, Server20Regular,
  AppsList20Regular, WrenchScrewdriver20Regular, PeopleTeam20Regular,
  Circle20Regular,
  ArrowCounterclockwise20Regular,
  Dismiss20Regular,
  Search20Regular,
  ThumbLike20Regular,
  ThumbDislike20Regular,
  Copy20Regular,
} from '@fluentui/react-icons';
import type { DANode } from '../domains/agent/utils/daCoTGenerator';
import { generateDACoTNodes, buildNodesFromLLMTrace, SEVEN_DAYS_MS } from '../domains/agent/utils/daCoTGenerator';

// ─── Activity Session Types ─────────────────────────────────────────────────
type ActivityStatus = 'complete' | 'failed' | 'rejected' | 'cancelled' | 'in-progress' | 'waiting-for-user' | 'auth-required';
type ActivitySessionType = 'chat' | 'autonomous';

interface ActivitySession {
  id: string;
  description: string;
  type: ActivitySessionType;
  date: number;
  error?: string;
  status: ActivityStatus;
  processedBy?: string;
  stepsOrTurns?: number;
  lastStep?: { type: LastStepType; name: string };
  duration?: string;
  messages?: Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: string; metadata?: Record<string, any> }>;
}

const OLD_CONNECTOR_STEP_TITLES = new Set([
  'Authenticating with data source', 'Preparing API request', 'Parsing response',
  'Parsing and validating response',
]);
const isOldConnectorStep = (title: string) =>
  OLD_CONNECTOR_STEP_TITLES.has(title) || title.startsWith('Calling ') || title.startsWith('Authenticating with ');

function migrateConnectorNodes(sessions: ActivitySession[], agentConfig: AgentConfig): ActivitySession[] {
  return sessions.map(session => {
    if (!session.messages) return session;
    const hasOldConnector = session.messages.some(msg =>
      msg.metadata?.cotNodes?.some((node: any) =>
        node.type === 'connector' && node.steps?.some((step: any) => isOldConnectorStep(step.title))
      )
    );
    if (!hasOldConnector) return session;

    const userMsg = session.messages.find(m => m.role === 'user');
    const query = userMsg?.content ?? session.description;
    const generated = generateDACoTNodes(agentConfig, query);

    const updatedMessages = session.messages.map(msg => {
      if (msg.role !== 'assistant' || !msg.metadata?.cotNodes) return msg;
      const oldNodes: any[] = msg.metadata.cotNodes;
      const newNodes = generated.map((n, i) => {
        const oldNode = oldNodes.find((o: any) => o.type === n.type) ?? oldNodes[i];
        return {
          ...n,
          status: 'completed' as const,
          ...(oldNode?.errorTitle ? { errorTitle: oldNode.errorTitle, error: oldNode.error } : {}),
        };
      });
      return { ...msg, metadata: { ...msg.metadata, cotNodes: newNodes } };
    });

    return { ...session, messages: updatedMessages };
  });
}


// ─── Variable Panel ──────────────────────────────────────────────────────────
interface SessionVariable { name: string; type: string; value: string; }
interface VariableGroup { category: string; variables: SessionVariable[]; }

type MsgLike = { role: 'user' | 'assistant'; content: string };

const generateVariableGroups = (
  agentName: string,
  description: string,
  messages: MsgLike[]
): VariableGroup[] => {
  const firstUser = messages.find(m => m.role === 'user');
  const firstAssistant = messages.find(m => m.role === 'assistant');
  // Stable session id based on description text
  const sessionId = `session_${description.split(' ').map(w => w[0]).join('').toLowerCase().slice(0, 6)}_${description.length}`;

  return [
    {
      category: 'Topic',
      variables: [
        { name: 'UserInput', type: 'String', value: firstUser?.content ?? description },
        { name: 'ConversationTitle', type: 'String', value: description },
      ],
    },
    {
      category: 'System',
      variables: [
        { name: 'AgentName', type: 'String', value: agentName },
        { name: 'SessionId', type: 'String', value: sessionId },
        ...(firstAssistant
          ? [{ name: 'LastResponse', type: 'String', value: firstAssistant.content }]
          : []),
      ],
    },
    {
      category: 'Environment',
      variables: [
        { name: 'TenantId', type: 'String', value: 'tenant_contoso_001' },
        { name: 'ApiRegion', type: 'String', value: 'us-east-1' },
        { name: 'MaxOutputTokens', type: 'String', value: '4096' },
      ],
    },
  ];
};

const VALUE_TRUNCATE = 72;

const VariablePanel: React.FC<{ groups: VariableGroup[]; onClose: () => void }> = ({ groups, onClose }) => {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = search.trim()
    ? groups.map(g => ({ ...g, variables: g.variables.filter(v =>
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.value.toLowerCase().includes(search.toLowerCase())
      ) })).filter(g => g.variables.length > 0)
    : groups;

  return (
    <div className="flex flex-col w-[380px] max-h-[520px] bg-white rounded-2xl shadow-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 pt-5 pb-3">
        <h2 className="text-xl font-bold text-text-primary">Variable</h2>
        <CopilotButton variant="icon-subtle" size="sm" icon={<Dismiss20Regular />} onClick={onClose} />
      </div>
      {/* Search row */}
      <div className="flex-shrink-0 flex items-center gap-2 px-5 pb-3">
        <CopilotInput
          size="sm"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search"
          icon={<Search20Regular />}
          className="flex-1"
        />
        <CopilotButton variant="icon-subtle" size="sm" icon={<Filter20Regular />} />
      </div>
      {/* Variable list */}
      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-5">
        {filtered.map(group => (
          <div key={group.category}>
            <h3 className="text-sm font-semibold text-text-primary mb-2.5">
              {group.category} ({group.variables.length})
            </h3>
            <div className="space-y-3">
              {group.variables.map(variable => {
                const key = `${group.category}:${variable.name}`;
                const isExpanded = expanded.has(key);
                const isTruncated = variable.value.length > VALUE_TRUNCATE;
                return (
                  <div key={variable.name}>
                    {/* Variable chip */}
                    <div className="inline-flex items-center border border-border rounded-full px-2.5 py-1 text-xs max-w-full mb-1.5">
                      <span className="font-mono text-[10px] text-text-subtle mr-1.5">{'{x}'}</span>
                      <span className="text-text-primary truncate">{variable.name}</span>
                      <span className="mx-2 text-border leading-none select-none">|</span>
                      <span className="text-text-subtle shrink-0">{variable.type}</span>
                    </div>
                    {/* Value */}
                    <div className="text-sm text-text-primary">
                      {isTruncated && !isExpanded
                        ? `${variable.value.slice(0, VALUE_TRUNCATE)}...`
                        : variable.value}
                    </div>
                    {isTruncated && (
                      <CopilotButton
                        variant="ghost"
                        className="text-xs text-brand hover:underline mt-0.5 block px-0 py-0 h-auto"
                        onClick={() => setExpanded(prev => {
                          const next = new Set(prev);
                          isExpanded ? next.delete(key) : next.add(key);
                          return next;
                        })}
                      >
                        {isExpanded ? 'Show less' : 'Show all'}
                      </CopilotButton>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-text-disabled">No variables found.</p>
        )}
      </div>
    </div>
  );
};

const renderMarkdown = (content: string, condensed = false) => {
  const lines = content.split('\n');
  const elements: React.ReactElement[] = [];
  let currentList: string[] = [];
  let currentListOrdered = false;
  let key = 0;

  const UNORDERED_LIST_RE = /^[-•]\s+/;
  const ORDERED_LIST_RE = /^\d+\.\s+/;

  const renderInlineMarkdown = (text: string) => {
    // Process bold, italic, inline code, and links
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`[^`]+`|\[.*?\]\(.*?\))/g);
    return (
      <>
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <span key={idx} className="font-semibold">{part.slice(2, -2)}</span>;
          }
          if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
            return <em key={idx}>{part.slice(1, -1)}</em>;
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={idx} className="bg-gray-100 text-sm px-1 py-0.5 rounded">{part.slice(1, -1)}</code>;
          }
          const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
          if (linkMatch) {
            return <a key={idx} href={linkMatch[2]} target="_blank" rel="noreferrer" className="text-blue-600 underline hover:text-blue-800">{linkMatch[1]}</a>;
          }
          return <span key={idx}>{part}</span>;
        })}
      </>
    );
  };

  const flushList = () => {
    if (currentList.length > 0) {
      if (currentListOrdered) {
        elements.push(
          <ol key={key++} className={`list-decimal pl-5 space-y-1 ${condensed ? 'my-1.5 text-sm' : 'my-2'}`}>
            {currentList.map((item, idx) => (
              <li key={idx}>{renderInlineMarkdown(item)}</li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={key++} className={`list-disc pl-5 space-y-1 ${condensed ? 'my-1.5 text-sm' : 'my-2'}`}>
            {currentList.map((item, idx) => (
              <li key={idx}>{renderInlineMarkdown(item)}</li>
            ))}
          </ul>
        );
      }
      currentList = [];
      currentListOrdered = false;
    }
  };

  lines.forEach((line) => {
    if (line.trim() === '---') {
      flushList();
      elements.push(<hr key={key++} className={`border-0 border-t border-border ${condensed ? 'my-3' : 'my-4'}`} />);
    } else if (line.startsWith('### ')) {
      flushList();
      elements.push(<div key={key++} className={`font-bold ${condensed ? 'text-sm mt-2 mb-0.5' : 'text-lg mt-3 mb-1'}`}>{renderInlineMarkdown(line.slice(4))}</div>);
    } else if (line.startsWith('## ')) {
      flushList();
      elements.push(<div key={key++} className={`font-bold ${condensed ? 'text-base mt-3 mb-0.5' : 'text-xl mt-4 mb-1'}`}>{renderInlineMarkdown(line.slice(3))}</div>);
    } else if (line.startsWith('# ')) {
      flushList();
      elements.push(<div key={key++} className={`font-bold ${condensed ? 'text-lg mt-3 mb-0.5' : 'text-2xl mt-4 mb-1'}`}>{renderInlineMarkdown(line.slice(2))}</div>);
    } else if (UNORDERED_LIST_RE.test(line)) {
      if (currentListOrdered) flushList();
      currentList.push(line.replace(UNORDERED_LIST_RE, ''));
    } else if (ORDERED_LIST_RE.test(line)) {
      if (!currentListOrdered && currentList.length > 0) flushList();
      currentListOrdered = true;
      currentList.push(line.replace(ORDERED_LIST_RE, ''));
    } else if (line.trim()) {
      flushList();
      elements.push(<div key={key++} className={condensed ? 'my-0.5 text-sm' : 'my-1'}>{renderInlineMarkdown(line)}</div>);
    } else {
      flushList();
      elements.push(<div key={key++} className={condensed ? 'h-1.5' : 'h-2'} />);
    }
  });

  flushList();
  return <div>{elements}</div>;
};

const generateConversationTitle = (message: string): string => {
  let text = message.trim().replace(/[?.!,;:]+$/, '').trim();
  const questionPrefixes: Record<string, string> = {
    'what can you do': 'Capabilities overview',
    'what do you do': 'Capabilities overview',
    'how do you work': 'How it works',
    'how does this work': 'How it works',
    'can you help': 'Help request',
    'tell me about': '', 'explain': '', 'what is': '', 'what are': '',
    'how do i': '', 'how to': '', 'can you': '', 'i need': '',
    'i want': '', 'help me': '', 'show me': '',
  };
  const lower = text.toLowerCase();
  for (const [prefix, replacement] of Object.entries(questionPrefixes)) {
    if (lower.startsWith(prefix)) {
      if (replacement) return replacement;
      text = text.slice(prefix.length).trim();
      break;
    }
  }
  const fillers = ['a', 'an', 'the', 'my', 'your', 'some', 'please', 'just'];
  const remaining = text.split(/\s+/);
  while (remaining.length > 1 && fillers.includes(remaining[0].toLowerCase())) remaining.shift();
  text = remaining.join(' ');
  const result = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  return result.length > 50 ? result.slice(0, 47) + '...' : result;
};


// ─── Module-level sub-components (stable references; safe to use inside useMemo) ─

interface AgentNameRowProps {
  narrow: boolean;
  agentName: string;
  agent: Pick<AgentConfig, 'id' | 'name'> & Partial<Pick<AgentConfig, 'agentType' | 'iconKey' | 'gradientKey' | 'systemColorIcon' | 'iconImageData'>>;
}
const AgentNameRow: React.FC<AgentNameRowProps> = ({ narrow, agentName, agent }) => (
  <div className={`flex items-center gap-2 ${narrow ? 'mb-1.5' : 'mb-2.5'}`}>
    <AgentIcon agent={agent} size={narrow ? 24 : 32} />
    <span className={`text-text-primary ${narrow ? 'text-body-2-strong' : 'text-body-1-strong'}`}>
      {agentName}
    </span>
  </div>
);


interface DevModeViewProps {
  nodes: DANode[]; agentName: string; messageContent: string;
  externalExpandedState?: boolean; iconKey: string; gradientCSS: string; isAllExpanded: boolean;
  showTrigger?: boolean;
  channelName?: string; channelIcon?: React.ReactNode;
  onPillClick?: (pill: { label: string; type: string }) => void;
  onSourceClick?: (source: { name: string }) => void;
  onNodeAsk?: (node: DANode) => void;
  agent?: Pick<AgentConfig, 'id' | 'name'> & Partial<Pick<AgentConfig, 'agentType' | 'iconKey' | 'gradientKey' | 'systemColorIcon' | 'iconImageData'>>;
}
const DevModeView: React.FC<DevModeViewProps> = ({ nodes, agentName, messageContent, externalExpandedState, iconKey, gradientCSS, isAllExpanded, showTrigger, channelName, channelIcon, onPillClick, onSourceClick, onNodeAsk, agent }) => {
  const [responseCollapsed, setResponseCollapsed] = useState(false);
  const agentIcon = agent ? <AgentIcon agent={agent} size={20} /> : <SquircleIcon size={20} cornerRadius={5} gradient={gradientCSS}>{getAgentIcon(iconKey, 11)}</SquircleIcon>;
  return (
    <div>
      <DAActivityCoT
        nodes={nodes} agentName={agentName} agentIcon={agentIcon}
        connectsToResponse={true}
        externalExpandedState={externalExpandedState ?? isAllExpanded}
        showTrigger={showTrigger}
        channelName={channelName}
        channelIcon={channelIcon}
        hideExpandToggle={!!onPillClick}
        onPillClick={onPillClick}
        onSourceClick={onSourceClick}
        onNodeAsk={onNodeAsk}
        className="pb-1"
      />
      <div className="px-4 pb-3">
        <div className="flex">
          <div className="flex flex-col items-center w-5 shrink-0">
            <div className="shrink-0 mt-[3px]">
              {agent ? <AgentIcon agent={agent} size={20} /> : <SquircleIcon size={20} cornerRadius={5} gradient={gradientCSS}>{getAgentIcon(iconKey, 11)}</SquircleIcon>}
            </div>
          </div>
          <div className="flex-1 min-w-0 pl-3">
            <div className="flex items-center gap-1.5 py-1">
              <span className="text-[15px] font-semibold text-text-primary">{agentName}</span>
              <CopilotButton
                variant="icon-subtle" size="sm"
                icon={responseCollapsed ? <ChevronRight20Regular className="w-4 h-4" /> : <ChevronDown20Regular className="w-4 h-4" />}
                onClick={() => setResponseCollapsed(v => !v)}
                className="!h-6 !w-6"
              />
            </div>
            {!responseCollapsed && (
              <div className="text-text-primary text-[13px] leading-relaxed pb-1">
                {renderMarkdown(messageContent, true)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const DEFAULT_VISIBLE_COLS = new Set(['description', 'type', 'date', 'error', 'status']);

const EDIT_COLUMNS_OPTIONS = [
  { key: 'description', label: 'Description' },
  { key: 'type', label: 'Type' },
  { key: 'date', label: 'Date' },
  { key: 'processedBy', label: 'Processed by' },
  { key: 'stepsOrTurns', label: 'Steps/Turns' },
  { key: 'lastStep', label: 'Last step' },
  { key: 'duration', label: 'Duration' },
  { key: 'error', label: 'Error' },
  { key: 'status', label: 'Status' },
];

// ─── Historical session: CoT + agent response as connected final node ────────
// Mirrors DevModeView but sized for the historical/session detail view (icon 24px).
// Defined at module scope so React reconciles rather than remounts on parent render.
interface DevModeViewHistoricalProps {
  nodes: DANode[];
  agentName: string;
  messageContent: string;
  externalExpandedState?: boolean;
  showTrigger?: boolean;
  agentIcon?: React.ReactNode;
  iconKey: string;
  gradientCSS: string;
  channelName: string;
  channelIcon: React.ReactNode;
  agent?: Pick<AgentConfig, 'id' | 'name'> & Partial<Pick<AgentConfig, 'agentType' | 'iconKey' | 'gradientKey' | 'systemColorIcon' | 'iconImageData'>>;
  onPillClick: (pill: { label: string; type: string }) => void;
  onSourceClick: (source: { name: string }) => void;
  onNodeAsk: (node: DANode) => void;
}
const DevModeViewHistorical: React.FC<DevModeViewHistoricalProps> = ({
  nodes, agentName, messageContent, externalExpandedState, showTrigger = true,
  agentIcon: agentIconProp, iconKey, gradientCSS, channelName, channelIcon,
  onPillClick, onSourceClick, onNodeAsk, agent,
}) => {
  const [responseCollapsed, setResponseCollapsed] = useState(false);
  const agentIcon = agent ? <AgentIcon agent={agent} size={24} /> : agentIconProp ?? (
    <SquircleIcon size={24} cornerRadius={6} gradient={gradientCSS}>{getAgentIcon(iconKey, 13)}</SquircleIcon>
  );
  return (
    <div>
      {/* CoT chain — no outer border, connectsToResponse draws line to agent icon */}
      <DAActivityCoT
        nodes={nodes}
        agentName={agentName}
        agentIcon={agentIcon}
        channelName={channelName}
        channelIcon={channelIcon}
        hideExpandToggle
        connectsToResponse={true}
        externalExpandedState={externalExpandedState}
        showTrigger={showTrigger}
        onPillClick={onPillClick}
        onSourceClick={onSourceClick}
        onNodeAsk={onNodeAsk}
        className="pb-1"
      />
      {/* Agent response as connected final node (px-4 matches DAActivityCoT padding) */}
      <div className="px-4 pb-3">
        <div className="flex">
          {/* Left column: agent icon (no line below — last element) */}
          <div className="flex flex-col items-center w-6 shrink-0">
            <div className="shrink-0 mt-1">
              {agent ? <AgentIcon agent={agent} size={24} /> : <SquircleIcon size={24} cornerRadius={6} gradient={gradientCSS}>{getAgentIcon(iconKey, 13)}</SquircleIcon>}
            </div>
          </div>
          {/* Right column: name + chevron + content */}
          <div className="flex-1 min-w-0 pl-3">
            <div className="flex items-center gap-1.5 py-1">
              <span className="text-[15px] font-semibold text-text-primary">{agentName}</span>
              <CopilotButton
                variant="icon-subtle"
                size="sm"
                icon={responseCollapsed
                  ? <ChevronRight20Regular className="w-4 h-4" />
                  : <ChevronDown20Regular className="w-4 h-4" />
                }
                onClick={() => setResponseCollapsed(v => !v)}
                className="!h-6 !w-6"
              />
            </div>
            {!responseCollapsed && (
              <div className="text-text-primary text-[13px] leading-relaxed pb-1">
                {renderMarkdown(messageContent, true)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const PreviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { agentConfig, previewMessages, addPreviewMessage, clearPreviewMessages, isConversationalLayout, setPendingHelperQuote, setIsHelperCollapsed, userName, isEvalMode, isEvalsV2, messageEvals, setMessageEval } = useAgent();
  const isNarrowPreview = isConversationalLayout && agentConfig.type === 'agent';
  // Snapshot of agentConfig taken just before each user message is sent — used as configBefore in evals
  const configBeforeRef = useRef<ReturnType<typeof snapshotConfig> | undefined>(undefined);
  const handleSaveEval = useCallback(async (evalData: MessageEval) => {
    const tagged: MessageEval = {
      ...evalData,
      source: 'preview',
      configBefore: configBeforeRef.current,
      configAfter: snapshotConfig(agentConfig),
    };
    try {
      await fetch('/api/evals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tagged),
      });
      setMessageEval(tagged.messageId, tagged);
    } catch (err) {
      console.error('[PreviewPage] Failed to save eval:', err);
    }
  }, [agentConfig, setMessageEval]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationTitle, setConversationTitle] = useState<string>('');
  const [currentCoTNodes, setCurrentCoTNodes] = useState<DANode[] | null>(null);
  const [isDevMode, setIsDevMode] = useState(() => {
    const stored = localStorage.getItem('previewShowTracing');
    return stored !== null ? stored === 'true' : true;
  });
  const [isAllExpanded, setIsAllExpanded] = useState<boolean | null>(false);
  // Start in full-screen scenario mode if the URL already has ?autotest= when this page mounts
  // (navigation from Build page — the elevate:autotest event is not dispatched in that case).
  const [scenarioActive, setScenarioActive] = useState(
    () => !!new URLSearchParams(window.location.search).get('autotest')
  );
  useEffect(() => {
    const handler = () => setScenarioActive(true);
    window.addEventListener('elevate:autotest', handler);
    return () => window.removeEventListener('elevate:autotest', handler);
  }, []);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previewSpacerRef = useRef<HTMLDivElement>(null);
  const pendingScrollMsgIdRef = useRef<string | null>(null);
  const hasShownFirstMessageRef = useRef(false);
  const prevMessageCountRef = useRef<number>(0);
  const prevIsProcessingRef = useRef<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const outerScrollContainerRef = useRef<HTMLDivElement>(null);

  interface RecentConversation {
    id: string; title: string; preview: string; messages: Message[]; timestamp: number;
  }
  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>(() => {
    try { return JSON.parse(getAgentStorage(agentConfig.id, 'recentConversations') || '[]'); } catch { return []; }
  });

  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showMorePrompts, setShowMorePrompts] = useState(false);
  const [dynamicPrompts, setDynamicPrompts] = useState<PreviewPrompt[] | null>(null);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [activityFilter, setActivityFilter] = useState<'all' | ActivityStatus>('all');
  const [activityFullWidth, setActivityFullWidth] = useState(false);
  const [showEditColumns, setShowEditColumns] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(DEFAULT_VISIBLE_COLS));
  // ─── Filter panel state ──────────────────────────────────────────────────
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [activeFilterSearch, setActiveFilterSearch] = useState('');
  const [activeFilterDateFrom, setActiveFilterDateFrom] = useState(0);
  const [activeFilterErrors, setActiveFilterErrors] = useState<Set<string>>(new Set());
  const [showAllFilterErrors, setShowAllFilterErrors] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ActivitySession | null>(null);
  const [isHistoricalDebugMode, setIsHistoricalDebugMode] = useState(true);
  const [isHistoricalAllExpanded, setIsHistoricalAllExpanded] = useState<boolean | null>(null);
  const [hoveredHistoricalMsgId, setHoveredHistoricalMsgId] = useState<string | null>(null);
  const [historicalInput, setHistoricalInput] = useState('');
  const [isHistoricalProcessing, setIsHistoricalProcessing] = useState(false);
  const historicalScrollRef = useRef<HTMLDivElement>(null);
  const [showVariablePanel, setShowVariablePanel] = useState(false);
  const variablePanelRef = useRef<HTMLDivElement>(null);
  const [activitySessions, setActivitySessions] = useState<ActivitySession[]>(() => {
    try {
      const saved = JSON.parse(getAgentStorage(agentConfig.id, 'activitySessions_v5') || 'null');
      if (saved?.length) return saved;
    } catch {}
    return [];
  });

  // Generate dynamic prompts when the agent config changes (keyed on id + instructions)
  useEffect(() => {
    if (!agentConfig.id || agentConfig.type === 'placeholder') return;
    setPromptsLoading(true);
    generatePreviewPrompts(agentConfig).then(prompts => {
      setDynamicPrompts(prompts);
      setPromptsLoading(false);
    });
  }, [agentConfig.id, agentConfig.instructions, agentConfig.description, agentConfig.skills?.join(','), agentConfig.guidelines?.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save scroll position whenever PreviewPage unmounts (any navigation away, including
  // HelperAgent pill clicks). Outer scrolls when no messages/scenario; inner scrolls otherwise.
  useEffect(() => {
    return () => {
      // inner scrolls when messages are visible; outer scrolls on the landing/no-message view.
      // Prefer inner when non-zero (definitive signal we're in messages view); fall back to outer.
      const outer = outerScrollContainerRef.current?.scrollTop ?? 0;
      const inner = scrollContainerRef.current?.scrollTop ?? 0;
      const pos = inner > 0 ? inner : outer;
      sessionStorage.setItem('previewScrollPosition', String(pos));
    };
  }, []);

  const handlePillClick = useCallback((pill: { label: string; type: string }) => {
    const pos = (outerScrollContainerRef.current?.scrollTop ?? 0) > 0
      ? outerScrollContainerRef.current!.scrollTop
      : (scrollContainerRef.current?.scrollTop ?? 0);
    sessionStorage.setItem('previewScrollPosition', String(pos));
    navigate('/build', { state: { openPill: { label: pill.label, type: pill.type === 'connector' ? 'connector' : 'knowledge' } } });
  }, [navigate, outerScrollContainerRef, scrollContainerRef]);

  const handleSourceClick = useCallback((source: { name: string }) => {
    const pos = (outerScrollContainerRef.current?.scrollTop ?? 0) > 0
      ? outerScrollContainerRef.current!.scrollTop
      : (scrollContainerRef.current?.scrollTop ?? 0);
    sessionStorage.setItem('previewScrollPosition', String(pos));
    navigate('/build', { state: { openPill: { label: source.name, type: 'knowledge' } } });
  }, [navigate, outerScrollContainerRef, scrollContainerRef]);

  const handleNodeAsk = useCallback((node: DANode) => {
    const shortQuestion = (node.errorTitle || node.error) ? `How do I fix this?` : `What does this step do?`;
    setPendingHelperQuote({ label: node.name, type: node.type, errorTitle: node.errorTitle, error: node.error, shortQuestion });
  }, [setPendingHelperQuote]);

  // Restore scroll position on navigate-back.
  // Captured at mount: if messages exist the inner container is already active (conversation path).
  // If not (TriggerLab path), scenarioActive flips after child effects settle — use a 150ms timeout
  // to apply scroll after that flip, targeting the outer container.
  // Applying to exactly one container once eliminates the scroll flash from the previous dual-apply approach.
  useEffect(() => {
    const savedPosition = sessionStorage.getItem('previewScrollPosition');
    if (!savedPosition) return;
    const pos = parseInt(savedPosition, 10);
    if (pos <= 0) return;
    // Remove only after pos is validated — avoids StrictMode double-mount consuming the value early
    sessionStorage.removeItem('previewScrollPosition');
    const hasMessages = previewMessages.length > 0;
    if (hasMessages) {
      // Conversation path: inner scroll container is active at mount.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = pos;
      }));
    } else {
      // TriggerLab path: outer container is active after scenarioActive flips.
      // Delay matches the time needed for scenarioActive to flip and re-render.
      const SCENARIO_ACTIVATE_SETTLE_MS = 150;
      const t = setTimeout(() => {
        if (outerScrollContainerRef.current) outerScrollContainerRef.current.scrollTop = pos;
      }, SCENARIO_ACTIVATE_SETTLE_MS);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!conversationTitle && previewMessages.length > 0) {
      const firstUserMsg = previewMessages.find(m => m.role === 'user');
      if (firstUserMsg) setConversationTitle(generateConversationTitle(firstUserMsg.content));
    }
  }, [previewMessages, conversationTitle]);

  // Close variable panel on outside click
  useEffect(() => {
    if (!showVariablePanel) return;
    const handler = (e: MouseEvent) => {
      if (variablePanelRef.current && !variablePanelRef.current.contains(e.target as Node)) {
        setShowVariablePanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showVariablePanel]);

  useEffect(() => {
    if (!pendingScrollMsgIdRef.current) {
      prevMessageCountRef.current = previewMessages.length;
      return;
    }
    const id = pendingScrollMsgIdRef.current;
    pendingScrollMsgIdRef.current = null;

    // Give React time to commit the new message DOM
    setTimeout(() => {
      const container = scrollContainerRef.current;
      const spacer = previewSpacerRef.current;
      if (!container) return;

      // Inflate spacer so there's room to scroll
      if (spacer) spacer.style.height = `${container.clientHeight}px`;

      const el = container.querySelector(`[data-role="user"][data-msg-id="${id}"]`) as HTMLElement;
      if (!el) return;

      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const target = container.scrollTop + (elRect.top - containerRect.top) - 20;

      // Ensure spacer is tall enough
      if (spacer) {
        const maxScroll = container.scrollHeight - container.clientHeight;
        if (target > maxScroll) {
          spacer.style.height = `${parseFloat(spacer.style.height || '0') + (target - maxScroll) + 16}px`;
        }
      }

      container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }, 150);

    prevMessageCountRef.current = previewMessages.length;
  }, [previewMessages]);

  // Trim spacer as response content fills in
  useEffect(() => {
    const spacer = previewSpacerRef.current;
    const container = scrollContainerRef.current;
    if (!spacer || !container) return;
    const spacerH = parseFloat(spacer.style.height || '0');
    if (spacerH === 0) return;
    const excess = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (excess > 0) {
      spacer.style.height = `${Math.max(0, spacerH - excess)}px`;
    }
  });

  useEffect(() => {
    prevIsProcessingRef.current = isProcessing;
  }, [isProcessing]);

  // Fade in the conversation when messages first appear
  useEffect(() => {
    if (previewMessages.length === 0) {
      hasShownFirstMessageRef.current = false;
      return;
    }
    if (!hasShownFirstMessageRef.current) {
      hasShownFirstMessageRef.current = true;
      const container = scrollContainerRef.current;
      if (container) {
        container.style.animation = 'fadeIn 0.4s ease-out both';
        const onEnd = () => { container.style.animation = ''; container.removeEventListener('animationend', onEnd); };
        container.addEventListener('animationend', onEnd);
      }
    }
  }, [previewMessages.length]);

  useEffect(() => {
    setCurrentCoTNodes(null);
  }, [agentConfig.id]);

  // Reset expand toggle when leaving debug mode
  useEffect(() => {
    if (!isDevMode) setIsAllExpanded(null);
  }, [isDevMode]);



  // Core send logic — accepts explicit content + context history so it can be
  // called both from the live input box and from "re-run from message".
  const triggerSend = async (messageContent: string, contextHistory: Message[]) => {
    const userMessage: Message = {
      id: Date.now().toString(), role: 'user', content: messageContent, timestamp: new Date(),
    };
    // Only scroll-to-top for follow-up messages; first message uses fade-in
    if (contextHistory.length > 0) {
      pendingScrollMsgIdRef.current = userMessage.id;
    }
    addPreviewMessage(userMessage);
    setIsProcessing(true);
    // Snapshot config before this turn — used as configBefore when the user rates the response
    configBeforeRef.current = snapshotConfig(agentConfig);

    const turnId = userMessage.id;
    // Show simulated loading nodes during the LLM call for visual continuity.
    // These are replaced by the real LLM-generated trace once the response arrives.
    const loadingNodes = generateDACoTNodes(agentConfig, messageContent)
      .map((n, i) => ({ ...n, id: `${turnId}-${n.type}-${i}` }));
    if (loadingNodes.length > 0) loadingNodes[0] = { ...loadingNodes[0], status: 'loading' };
    setCurrentCoTNodes(loadingNodes.length > 0 ? [...loadingNodes] : null);

    const llmStartTime = Date.now();
    try {
      const response = await runAgent(messageContent, agentConfig, contextHistory);
      const actualMs = Date.now() - llmStartTime;

      // Build real trace nodes from the LLM's <copilot_trace> output.
      // Fall back to the simulated loading nodes if the trace is missing or malformed.
      const traceNodes: DANode[] = response.trace
        ? buildNodesFromLLMTrace(response.trace, messageContent, turnId)
        : loadingNodes;

      // Patch actual response time into the last data node.
      const finalNodes = traceNodes.map((n, i, arr) => {
        const isLastDataNode = (n.type === 'knowledge' || n.type === 'connector' || n.type === 'skill' || n.type === 'flow') &&
          arr.slice(i + 1).every(next => !['knowledge', 'connector', 'skill', 'flow'].includes(next.type));
        const updatedSteps = isLastDataNode
          ? n.steps.map(s => s.title === 'Execution summary'
              ? { ...s, description: s.description?.replace(/in \d+ms/, `in ${actualMs}ms`) ?? s.description }
              : s)
          : n.steps;
        const updatedDetails = isLastDataNode && n.details
          ? { ...n.details, responseTimeMs: actualMs }
          : n.details;
        return { ...n, status: 'completed' as const, steps: updatedSteps, details: updatedDetails };
      });

      // Animate: briefly show last node as loading, then settle all to completed.
      setCurrentCoTNodes(finalNodes.map((n, i) => ({ ...n, status: i < finalNodes.length - 1 ? 'completed' : 'loading' })) as DANode[]);
      await new Promise(resolve => setTimeout(resolve, 300));
      setCurrentCoTNodes(finalNodes);
      await new Promise(resolve => setTimeout(resolve, 150));
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        streaming: false,
        metadata: { cotNodes: finalNodes },
      };
      addPreviewMessage(assistantMessage);
      const title = conversationTitle || generateConversationTitle(messageContent);
      const allMsgs = [...contextHistory, userMessage, assistantMessage];
      const lastCoTNode = finalNodes[finalNodes.length - 1];
      saveActivitySession({
        id: Date.now().toString(),
        description: title,
        type: 'chat',
        date: Date.now(),
        status: 'complete',
        processedBy: userName || undefined,
        stepsOrTurns: allMsgs.filter(m => m.role === 'user').length,
        lastStep: lastCoTNode ? { type: DA_NODE_TO_LAST_STEP[lastCoTNode.type] ?? 'tool', name: lastCoTNode.name } : undefined,
        messages: allMsgs.map(m => ({ id: m.id, role: m.role, content: m.content, timestamp: m.timestamp.toISOString(), metadata: m.metadata })),
      });
    } catch (error) {
      console.error('Agent response failed:', error);
      setCurrentCoTNodes(null);
      const failedMsgs = [...contextHistory, userMessage];
      saveActivitySession({
        id: Date.now().toString(),
        description: conversationTitle || generateConversationTitle(messageContent),
        type: 'chat',
        date: Date.now(),
        error: 'Agent response failed',
        status: 'failed',
        processedBy: userName || undefined,
        stepsOrTurns: failedMsgs.filter(m => m.role === 'user').length,
        messages: failedMsgs.map(m => ({ id: m.id, role: m.role, content: m.content, timestamp: m.timestamp.toISOString(), metadata: m.metadata })),
      });
    } finally {
      setIsProcessing(false);
      setCurrentCoTNodes(null);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isProcessing) return;
    const content = input;
    setInput('');
    await triggerSend(content, previewMessages);
  };

  const saveCurrentToRecents = () => {
    if (previewMessages.length > 0 && conversationTitle) {
      const lastMsg = previewMessages[previewMessages.length - 1];
      const newEntry: RecentConversation = {
        id: Date.now().toString(),
        title: conversationTitle,
        preview: (lastMsg.role === 'assistant' ? lastMsg.content : previewMessages.find(m => m.role === 'user')?.content || '')
          .replace(/#{1,3}\s*/g, '').replace(/\*\*/g, '').replace(/[-•]\s+/g, '').replace(/\n+/g, ' ').trim().slice(0, 100),
        messages: previewMessages,
        timestamp: Date.now(),
      };
      const updated = [newEntry, ...recentConversations.filter(c => c.title !== conversationTitle)].slice(0, 10);
      setRecentConversations(updated);
      setAgentStorage(agentConfig.id, 'recentConversations', JSON.stringify(updated));
    }
  };

  const handleNewConversation = () => {
    saveCurrentToRecents();
    setConversationTitle('');
    clearPreviewMessages();
    setCurrentCoTNodes(null);
  };


  // ─── Activity session helpers ─────────────────────────────────────────────
  const formatActivityDate = (ts: number): string => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) +
      ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusMeta = (status: ActivityStatus): { icon: React.ReactElement; label: string; iconClass: string } => {
    switch (status) {
      case 'complete':          return { icon: <CheckmarkCircle20Filled />, label: 'Complete',         iconClass: 'text-green-600' };
      case 'failed':            return { icon: <ErrorCircle20Filled />,     label: 'Failed',           iconClass: 'text-red-600' };
      case 'rejected':          return { icon: <ErrorCircle20Filled />,     label: 'Rejected',         iconClass: 'text-red-600' };
      case 'cancelled':         return { icon: <DismissCircle20Filled />,   label: 'Cancelled',        iconClass: 'text-text-disabled' };
      case 'in-progress':       return { icon: <Clock20Regular />,          label: 'In progress',      iconClass: 'text-brand' };
      case 'waiting-for-user':  return { icon: <Clock20Regular />,          label: 'Waiting for user', iconClass: 'text-amber-500' };
      case 'auth-required':     return { icon: <LockClosed20Regular />,     label: 'Auth required',    iconClass: 'text-text-disabled' };
    }
  };

  const getStatusBadge = (status: ActivityStatus) => {
    const configs: Record<ActivityStatus, { color: React.ComponentProps<typeof Badge>['color']; icon: React.ReactElement; label: string }> = {
      'complete':           { color: 'success',     icon: <CheckmarkCircle20Filled />, label: 'Complete' },
      'failed':             { color: 'danger',      icon: <ErrorCircle20Filled />,     label: 'Failed' },
      'rejected':           { color: 'danger',      icon: <ErrorCircle20Filled />,     label: 'Rejected' },
      'cancelled':          { color: 'subtle',      icon: <DismissCircle20Filled />,   label: 'Cancelled' },
      'in-progress':        { color: 'informative', icon: <Clock20Regular />,          label: 'In progress' },
      'waiting-for-user':   { color: 'warning',     icon: <Clock20Regular />,          label: 'Waiting for user' },
      'auth-required':      { color: 'subtle',      icon: <LockClosed20Regular />,     label: 'Auth required' },
    };
    const { color, label } = configs[status];
    return (
      <Badge appearance="tint" color={color} shape="circular" size="medium">
        {label}
      </Badge>
    );
  };

  const saveActivitySession = (session: ActivitySession) => {
    const updated = [session, ...activitySessions].slice(0, 50);
    setActivitySessions(updated);
    setAgentStorage(agentConfig.id, 'activitySessions_v5', JSON.stringify(updated));
  };

  type StoredMsg = ActivitySession['messages'] extends (infer U)[] | undefined ? U : never;

  // Re-run from message: load context before the target message, then auto-send it
  const handleRerunFromMessage = (targetMsg: StoredMsg, allMsgs: StoredMsg[]) => {
    if (!targetMsg) return;
    const targetIdx = allMsgs.findIndex(m => m?.id === targetMsg.id);
    if (targetIdx < 0) return;
    const contextBefore: Message[] = allMsgs.slice(0, targetIdx).map(m => ({
      id: m!.id, role: m!.role, content: m!.content, timestamp: new Date(m!.timestamp), streaming: false, metadata: m!.metadata,
    }));
    setSelectedSession(null);
    setShowAllActivity(false); // always land on live testing view
    clearPreviewMessages();
    contextBefore.forEach(m => addPreviewMessage(m));
    setConversationTitle(generateConversationTitle(targetMsg.content));
    triggerSend(targetMsg.content, contextBefore);
  };

  // Send a new message in the historical session detail view
  const handleHistoricalSend = async () => {
    if (!historicalInput.trim() || isHistoricalProcessing || !selectedSession) return;
    const content = historicalInput;
    setHistoricalInput('');

    const existingMessages = selectedSession.messages || [];
    const userMsg = {
      id: Date.now().toString(),
      role: 'user' as const,
      content,
      timestamp: new Date().toISOString(),
    };

    setSelectedSession(prev => prev ? { ...prev, messages: [...existingMessages, userMsg] } : prev);
    setIsHistoricalProcessing(true);

    const contextHistory: Message[] = existingMessages.map(m => ({
      id: m!.id, role: m!.role, content: m!.content, timestamp: new Date(m!.timestamp), streaming: false, metadata: m!.metadata,
    }));

    try {
      const response = await runAgent(content, agentConfig, contextHistory);
      const cotNodes = generateDACoTNodes(agentConfig, content).map(n => ({ ...n, status: 'completed' as const }));
      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: response.content,
        timestamp: new Date().toISOString(),
        metadata: { cotNodes },
      };
      setSelectedSession(prev => prev ? { ...prev, messages: [...(prev.messages || []), assistantMsg] } : prev);
    } catch (error) {
      console.error('Agent response failed:', error);
    } finally {
      setIsHistoricalProcessing(false);
    }
  };

  // Auto-scroll historical session when messages change
  useEffect(() => {
    if (historicalScrollRef.current) {
      requestAnimationFrame(() => {
        historicalScrollRef.current?.scrollTo({ top: historicalScrollRef.current.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [selectedSession?.messages?.length, isHistoricalProcessing]);

  // Dismiss filter/edit panels on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showFilterPanel) setShowFilterPanel(false);
      if (showEditColumns) setShowEditColumns(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showFilterPanel, showEditColumns]);

  // ─── Helper to get agent icon info ─────────────────────────────────────────
  const getAgentIconInfo = () => ({
    iconKey: agentConfig.iconKey || detectAgentDomain(agentConfig),
    gradientCSS: agentConfig.gradientKey
      ? getGradientByKey(agentConfig.gradientKey)
      : getUniqueGradientCSS(agentConfig.id),
  });

  // Stable string values derived from agentConfig — used as useMemo deps and passed as props
  const { iconKey: _cotIconKey, gradientCSS: _cotGradient } = getAgentIconInfo();
  // Parse first trigger from instructions — tries three formats in order:
  // 1. [[Service - Event]] inline pill (most common, double-bracket)
  // 2. [Service - Event] line-level single-bracket
  // 3. Plain KNOWN_TRIGGERS text at line start
  const firstTriggerName = (() => {
    const instructions = agentConfig.instructions ?? '';
    // 1. Scan for first [[...]] double-bracket pill that is a known trigger
    const inlineRe = /\[\[([^\]]+)\]\]/g;
    let m: RegExpExecArray | null;
    while ((m = inlineRe.exec(instructions)) !== null) {
      const name = m[1];
      if (KNOWN_TRIGGERS.includes(name)) return name;
    }
    // 2 & 3. Line-by-line fallback
    for (const line of instructions.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const bracketMatch = trimmed.match(/^\[(?!\[)([^\]]+)\]/);
      if (bracketMatch && KNOWN_TRIGGERS.includes(bracketMatch[1])) return bracketMatch[1];
      const matched = KNOWN_TRIGGERS.find(t => trimmed.startsWith(t));
      if (matched) return matched;
    }
    // 4. Fall back to capabilities array
    return (agentConfig.capabilities ?? []).find(c => c.type === 'trigger')?.name ?? null;
  })();


  // triggerCoTName: the event label shown in the CoT trigger node ("When a user messages")
  // triggerHeaderLabel: the service name shown in the preview header ("Website")
  let triggerCoTName: string;
  let triggerHeaderLabel: string;
  let triggerHeaderIcon: React.ReactNode;
  let triggerCoTIcon: React.ReactNode;

  // Map deployment channel to preview channel label/icon.
  // Fall back to: agentType → trigger name in instructions → empty (website default).
  const inferredChannel = (() => {
    if (agentConfig.channel) return agentConfig.channel.toLowerCase();
    if (agentConfig.agentType === 'DA' || agentConfig.agentType === 'DW') return 'teams';
    // Infer from trigger in instructions (e.g. "{{icon:teams}} [[Teams - When a message is received]]")
    const instr = agentConfig.instructions ?? '';
    if (/\{\{icon:teams\}\}|\[\[Teams/i.test(instr)) return 'teams';
    if (/\{\{icon:outlook\}\}|\[\[Outlook/i.test(instr)) return 'email';
    if (/\{\{icon:slack\}\}|\[\[Slack/i.test(instr)) return 'slack';
    if (/\{\{icon:whatsapp\}\}|\[\[WhatsApp/i.test(instr)) return 'whatsapp';
    if (/\{\{icon:sharepoint\}\}|\[\[SharePoint/i.test(instr)) return 'sharepoint';
    if (/\{\{icon:m365\}\}|\[\[Microsoft 365/i.test(instr)) return 'microsoft 365';
    return '';
  })();
  const deployChannel = inferredChannel;
  if (deployChannel === 'microsoft 365' || deployChannel === 'm365') {
    triggerHeaderLabel = 'Microsoft 365 Copilot';
    triggerCoTName = firstTriggerName ? getTriggerFriendlyName(firstTriggerName) : 'When a user messages';
    triggerHeaderIcon = <M365Icon size={20} />;
    triggerCoTIcon = <M365Icon size={24} />;
  } else if (deployChannel === 'teams' || deployChannel === 'microsoft teams') {
    triggerHeaderLabel = 'Teams';
    triggerCoTName = firstTriggerName ? getTriggerFriendlyName(firstTriggerName) : 'When a user messages';
    triggerHeaderIcon = getConnectorIcon('teams', 'w-5 h-5') ?? <ChannelIcon channel="copilot" size={20} />;
    triggerCoTIcon = getConnectorIcon('teams', 'w-6 h-6') ?? <ChannelIcon channel="copilot" size={24} />;
  } else if (deployChannel === 'slack') {
    triggerHeaderLabel = 'Slack';
    triggerCoTName = firstTriggerName ? getTriggerFriendlyName(firstTriggerName) : 'When a user messages';
    triggerHeaderIcon = <ChannelIcon channel="slack" size={20} />;
    triggerCoTIcon = <ChannelIcon channel="slack" size={24} />;
  } else if (deployChannel === 'whatsapp') {
    triggerHeaderLabel = 'WhatsApp';
    triggerCoTName = firstTriggerName ? getTriggerFriendlyName(firstTriggerName) : 'When a user messages';
    triggerHeaderIcon = <ChannelIcon channel="whatsapp" size={20} />;
    triggerCoTIcon = <ChannelIcon channel="whatsapp" size={24} />;
  } else if (deployChannel === 'sharepoint') {
    triggerHeaderLabel = 'SharePoint';
    triggerCoTName = firstTriggerName ? getTriggerFriendlyName(firstTriggerName) : 'When a user messages';
    triggerHeaderIcon = <ChannelIcon channel="sharepoint" size={20} />;
    triggerCoTIcon = <ChannelIcon channel="sharepoint" size={24} />;
  } else if (deployChannel === 'email' || deployChannel === 'outlook') {
    triggerHeaderLabel = 'Outlook';
    triggerCoTName = firstTriggerName ? getTriggerFriendlyName(firstTriggerName) : 'When an email is received';
    triggerHeaderIcon = getConnectorIcon('outlook', 'w-5 h-5') ?? <ChannelIcon channel="copilot" size={20} />;
    triggerCoTIcon = getConnectorIcon('outlook', 'w-6 h-6') ?? <ChannelIcon channel="copilot" size={24} />;
  } else {
    // Website or no channel set
    triggerHeaderLabel = 'Custom website';
    triggerCoTName = 'When a user messages';
    triggerHeaderIcon = <ChannelIcon channel="website" size={20} />;
    triggerCoTIcon = <ChannelIcon channel="website" size={24} />;
  }

  // ─── CopilotTable column definitions (Figma: node 145-60959) ───────────────
  const allActivityCols = [
    {
      key: 'description',
      label: 'Description',
      width: '30%',
      sortable: true,
      render: (value: string) => <span className="text-text-primary truncate block">{value}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      width: '16%',
      sortable: true,
      render: (value: string) => (
        <div className="flex items-center gap-1.5 text-text-subtle">
          {value === 'chat'
            ? <Chat20Regular className="w-4 h-4 shrink-0" />
            : <Sparkle20Regular className="w-4 h-4 shrink-0" />}
          <span>{value === 'chat' ? 'Chat' : 'Autonomous'}</span>
        </div>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      width: '22%',
      sortable: true,
      render: (value: number) => <span className="text-text-subtle">{formatActivityDate(value)}</span>,
    },
    {
      key: 'error',
      label: 'Error',
      width: '18%',
      sortable: true,
      render: (value: string) => <span className="text-text-subtle">{value || ''}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '14%',
      sortable: true,
      render: (value: ActivityStatus) => {
        const { icon, label, iconClass } = getStatusMeta(value);
        return (
          <div className="flex items-center gap-1.5 text-text-subtle">
            <span className={`w-4 h-4 shrink-0 flex items-center justify-center ${iconClass}`}>{icon}</span>
            <span>{label}</span>
          </div>
        );
      },
    },
    {
      key: 'processedBy',
      label: 'Processed by',
      width: '16%',
      sortable: true,
      render: (value: string, row: ActivitySession) => {
        const name = value || row.processedBy || userName || undefined;
        return name ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center shrink-0">
              <span className="text-[9px] font-semibold text-white leading-none">{name.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase()}</span>
            </div>
            <span className="text-text-subtle truncate">{name}</span>
          </div>
        ) : <span className="text-text-disabled">—</span>;
      },
    },
    {
      key: 'stepsOrTurns',
      label: 'Steps/Turns',
      width: '10%',
      sortable: true,
      render: (value: number, row: ActivitySession) => {
        const v = value ?? deriveStepsOrTurns(row);
        return <span className="text-text-subtle">{v != null ? v : '—'}</span>;
      },
    },
    {
      key: 'lastStep',
      label: 'Last step',
      width: '18%',
      sortable: true,
      render: (value: { type: LastStepType; name: string } | undefined, row: ActivitySession) => {
        const ls = value ?? deriveLastStep(row);
        if (!ls) return <span className="text-text-disabled">—</span>;
        const LastStepIcon = LAST_STEP_ICONS[ls.type];
        return (
          <div className="flex items-center gap-1.5 text-text-subtle">
            <span className="w-4 h-4 shrink-0 flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4">
              {LastStepIcon ? <LastStepIcon /> : <Circle20Regular />}
            </span>
            <span className="truncate">{ls.name}</span>
          </div>
        );
      },
    },
    {
      key: 'duration',
      label: 'Duration',
      width: '10%',
      sortable: true,
      render: (value: string) => <span className="text-text-subtle">{value ?? '—'}</span>,
    },
  ].filter(col => visibleColumns.has(col.key));





  const statusFilterCounts = activitySessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  const activityFilterChips: Array<{ key: 'all' | ActivityStatus; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'failed', label: statusFilterCounts['failed'] ? `Failed (${statusFilterCounts['failed']})` : 'Failed' },
    { key: 'rejected', label: statusFilterCounts['rejected'] ? `Rejected (${statusFilterCounts['rejected']})` : 'Rejected' },
    { key: 'in-progress', label: statusFilterCounts['in-progress'] ? `In progress (${statusFilterCounts['in-progress']})` : 'In progress' },
    { key: 'waiting-for-user', label: statusFilterCounts['waiting-for-user'] ? `Waiting for user (${statusFilterCounts['waiting-for-user']})` : 'Waiting for user' },
    { key: 'complete', label: statusFilterCounts['complete'] ? `Complete (${statusFilterCounts['complete']})` : 'Complete' },
  ];

  const filteredActivitySessions = [...activitySessions]
    .filter(s => activityFilter === 'all' || s.status === activityFilter)
    .filter(s => !activeFilterSearch || s.description.toLowerCase().includes(activeFilterSearch.toLowerCase()) || s.id.includes(activeFilterSearch))
    .filter(s => activeFilterDateFrom === 0 || s.date >= activeFilterDateFrom)
    .filter(s => activeFilterErrors.size === 0 || (s.error && activeFilterErrors.has(s.error)))
    .sort((a, b) => b.date - a.date);
  const hasActiveFilters = activeFilterSearch || activeFilterDateFrom > 0 || activeFilterErrors.size > 0;
  const hasAnyActiveFilter = !!(hasActiveFilters || activityFilter !== 'all');
  const filterPanelUniqueErrors = Array.from(new Set(activitySessions.map(s => s.error).filter(Boolean) as string[]));
  const filterPanelDisplayedErrors = showAllFilterErrors ? filterPanelUniqueErrors : filterPanelUniqueErrors.slice(0, 3);

  // Memoize the messages list so typing in the input box doesn't re-render it
  const memoizedMessages = useMemo(() => {
    if (previewMessages.length === 0) return null;
    const agentName = agentConfig.name || 'Agent';
    const agentIconForCoT = (
      <AgentIcon agent={agentConfig} size={20} />
    );
    return (
      <div className={isNarrowPreview ? '' : 'max-w-[1024px] mx-auto'}>
        {previewMessages.map((message) => (
          <div key={message.id} data-role={message.role} data-msg-id={message.id} className={`mb-6 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {message.role === 'user' ? (
              <div className={`max-w-2xl bg-[hsl(var(--action-brand))] rounded-2xl px-4 py-2.5 text-text-primary ${isNarrowPreview ? 'text-sm' : 'text-base'}`}>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            ) : (
              <div className="w-full">
                {isDevMode && (message.metadata?.cotNodes as DANode[] | undefined)?.length ? (
                  <DevModeView
                    nodes={message.metadata?.cotNodes as DANode[]}
                    agentName={agentName}
                    messageContent={message.content}
                    iconKey={_cotIconKey}
                    gradientCSS={_cotGradient}
                    isAllExpanded={isAllExpanded ?? false}
                    channelName={triggerCoTName}
                    channelIcon={triggerCoTIcon}
                    onPillClick={handlePillClick}
                    onSourceClick={handleSourceClick}
                    onNodeAsk={handleNodeAsk}
                    agent={agentConfig}
                  />
                ) : (
                  <>
                    <AgentNameRow narrow={isNarrowPreview} agentName={agentName} agent={agentConfig} />
                    <div className={`text-text-primary ${isNarrowPreview ? 'text-sm' : 'text-base pl-10'}`}>
                      {renderMarkdown(message.content, isNarrowPreview)}
                    </div>
                  </>
                )}
              </div>
            )}
            {isEvalMode && isEvalsV2 && !message.streaming && message.role === 'assistant' && (
              <InlineMessageRating
                messageId={message.id}
                messageContent={message.content}
                userPrompt={previewMessages.slice(0, previewMessages.indexOf(message)).reverse().find(m => m.role === 'user')?.content ?? ''}
                sessionId={agentConfig.id}
                agentId={agentConfig.id}
                agentName={agentConfig.name}
                existingEval={messageEvals[message.id]}
                onSave={handleSaveEval}
              />
            )}
          </div>
        ))}

        {/* Active thinking / CoT during processing */}
        {isProcessing && (
          <div className="mb-6 flex justify-start">
            <div className="w-full">
              {isDevMode && currentCoTNodes ? (
                <DAActivityCoT
                  nodes={currentCoTNodes}
                  agentName={agentName}
                  agentIcon={agentIconForCoT}
                  externalExpandedState={isAllExpanded ?? undefined}
                  onNodeAsk={handleNodeAsk}
                />
              ) : (
                <>
                  <AgentNameRow narrow={isNarrowPreview} agentName={agentName} agent={agentConfig} />
                  <div className={isNarrowPreview ? 'pl-8' : 'pl-10'}>
                    <CopilotTypingIndicator
                      agentName={agentName}
                      agentIcon={agentIconForCoT}
                      size="compact"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div ref={previewSpacerRef} style={{ height: 0, flexShrink: 0 }} />
        <div ref={messagesEndRef} />
      </div>
    );
  }, [previewMessages, isDevMode, isProcessing, currentCoTNodes, isAllExpanded, isNarrowPreview, agentConfig.name, agentConfig.id, agentConfig.agentType, agentConfig.iconKey, agentConfig.gradientKey, agentConfig.systemColorIcon, agentConfig.iconImageData, _cotIconKey, _cotGradient, handlePillClick, handleSourceClick, triggerCoTName, triggerCoTIcon, handleNodeAsk, isEvalMode, isEvalsV2, messageEvals, handleSaveEval]);

  return (
    <div className={`h-full flex flex-col ${isNarrowPreview ? 'bg-[hsl(var(--surface-secondary))]' : 'bg-white'}`}>
      {selectedSession ? (
        // ── Historical Session Detail ──────────────────────────────────────────
        (() => {
          const sessionMsgs = selectedSession.messages || [];
          const firstSessionAssistantId = sessionMsgs.find(m => m?.role === 'assistant')?.id;
          return (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-white">
              {/* Header */}
              <div className="flex-shrink-0 flex items-start justify-between px-4 py-2.5 gap-4">
                <div className="flex items-start gap-2 min-w-0">
                  <CopilotButton
                    variant="icon-subtle" size="sm" icon={<ChevronLeft20Regular />}
                    onClick={() => setSelectedSession(null)}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="group flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-[15px] text-text-primary truncate">{selectedSession.description}</h2>
                      {getStatusBadge(selectedSession.status)}
                      <ActivitySummaryButton
                        title="Summarize this session with Copilot"
                        onClick={() => {
                          const msgs = selectedSession.messages || [];
                          const userMsgs = msgs.filter(m => m?.role === 'user').map(m => m!.content);
                          const assistantMsgs = msgs.filter(m => m?.role === 'assistant').map(m => m!.content);
                          const context = [
                            `Session: "${selectedSession.description}"`,
                            `Status: ${selectedSession.status}`,
                            `Date: ${formatActivityDate(selectedSession.date)}`,
                            `Type: ${selectedSession.type}`,
                            selectedSession.error ? `Error: ${selectedSession.error}` : null,
                            userMsgs.length ? `User said: ${userMsgs.slice(0, 2).map(m => String(m).substring(0, 400)).join(' / ')}` : null,
                            assistantMsgs.length ? `Agent responded: ${assistantMsgs[assistantMsgs.length - 1]?.substring(0, 300)}` : null,
                          ].filter(Boolean).join(' | ');
                          setPendingHelperQuote({
                            label: selectedSession.description,
                            type: 'activity-summary',
                            shortQuestion: 'Summarize this session and explain any issues',
                            context,
                          });
                          setIsHelperCollapsed(false);
                        }}
                      />
                    </div>
                    <div className="text-xs text-text-subtle mt-0.5">{formatActivityDate(selectedSession.date)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  <CopilotButton
                    variant="ghost" size="sm"
                    icon={isHistoricalAllExpanded === true
                      ? <ChevronDown20Regular className="w-3.5 h-3.5" />
                      : <ChevronRight20Regular className="w-3.5 h-3.5" />
                    }
                    onClick={() => setIsHistoricalAllExpanded(v => v !== true ? true : false)}
                    className="!text-[14px] !font-normal text-text-primary"
                  >
                    {isHistoricalAllExpanded === true ? 'Collapse all' : 'Expand all'}
                  </CopilotButton>
                  <Switch
                    checked={isHistoricalDebugMode}
                    onChange={(_: any, data: SwitchOnChangeData) => setIsHistoricalDebugMode(data.checked)}
                    label="Debug mode"
                    labelPosition="before"
                  />
                  <div className="relative" ref={variablePanelRef}>
                    <div className="flex items-center border border-border rounded-lg overflow-hidden">
                      <CopilotButton
                        variant="icon-subtle" size="sm"
                        icon={<span className="font-mono text-[11px] leading-none font-normal">{'{x}'}</span>}
                        onClick={() => setShowVariablePanel(v => !v)}
                        className="!rounded-none"
                      />
                    </div>
                    {showVariablePanel && (
                      <div className="absolute right-0 top-full mt-1 z-50">
                        <VariablePanel
                          groups={generateVariableGroups(
                            agentConfig.name || 'Agent',
                            selectedSession.description,
                            (selectedSession.messages || []).map(m => ({ role: m!.role, content: m!.content }))
                          )}
                          onClose={() => setShowVariablePanel(false)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Messages — read only */}
              <div ref={historicalScrollRef} className="flex-1 overflow-y-auto min-h-0 py-8 px-6 md:px-8 lg:px-[30px] xl:px-[30px] 2xl:px-[30px]">
                <div className="max-w-[1024px] mx-auto">
                  {sessionMsgs.map((msg) => (
                    <div key={msg!.id} className={`mb-6 flex ${msg!.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg!.role === 'user' ? (
                        <div
                          className="max-w-2xl"
                          onMouseEnter={() => setHoveredHistoricalMsgId(msg!.id)}
                          onMouseLeave={() => setHoveredHistoricalMsgId(null)}
                        >
                          <div className="bg-[hsl(var(--action-brand))] rounded-2xl px-4 py-2.5 text-text-primary">
                            <p className="whitespace-pre-wrap">{msg!.content}</p>
                          </div>
                          {/* Re-run from this message — appears on hover */}
                          <div className={`flex justify-end mt-1 transition-opacity duration-150 ${hoveredHistoricalMsgId === msg!.id ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                            <CopilotButton
                              variant="ghost" size="sm"
                              icon={<ArrowCounterclockwise20Regular className="w-3.5 h-3.5" />}
                              onClick={() => handleRerunFromMessage(msg!, sessionMsgs)}
                              className="!text-[11px] !text-text-subtle !px-2"
                            >
                              Rerun
                            </CopilotButton>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full">
                          {isHistoricalDebugMode ? (
                            (() => {
                              const existingNodes = msg!.metadata?.cotNodes as DANode[] | undefined;
                              const cotNodes = existingNodes?.length
                                ? existingNodes
                                : (() => {
                                    const msgIdx = sessionMsgs.findIndex(m => m?.id === msg!.id);
                                    const prevUser = sessionMsgs.slice(0, msgIdx).reverse().find(m => m?.role === 'user');
                                    const prompt = prevUser?.content || selectedSession.description;
                                    return generateDACoTNodes(agentConfig, prompt).map(n => ({ ...n, status: 'completed' as const }));
                                  })();
                              return cotNodes.length ? (
                                <DevModeViewHistorical
                                  nodes={cotNodes}
                                  agentName={agentConfig.name || 'Agent'}
                                  messageContent={msg!.content}
                                  externalExpandedState={isHistoricalAllExpanded ?? undefined}
                                  showTrigger={msg!.id === firstSessionAssistantId}
                                  iconKey={_cotIconKey}
                                  gradientCSS={_cotGradient}
                                  channelName={triggerCoTName}
                                  channelIcon={triggerCoTIcon}
                                  onPillClick={handlePillClick}
                                  onSourceClick={handleSourceClick}
                                  onNodeAsk={handleNodeAsk}
                                  agent={agentConfig}
                                />
                              ) : (
                                <>
                                  <AgentNameRow narrow={false} agentName={agentConfig.name || 'Agent'} agent={agentConfig} />

                                  <div className="text-text-primary text-base pl-10">{renderMarkdown(msg!.content)}</div>
                                </>
                              );
                            })()
                          ) : (
                            <>
                              <AgentNameRow narrow={false} agentName={agentConfig.name || 'Agent'} agent={agentConfig} />
                              <div className="text-text-primary text-base pl-10">{renderMarkdown(msg!.content)}</div>
                              {/* Response action icons */}
                              {(() => {
                                const msgIdx = sessionMsgs.findIndex(m => m?.id === msg!.id);
                                const prevUserMsg = sessionMsgs.slice(0, msgIdx).reverse().find(m => m?.role === 'user');
                                return (
                                  <div className="flex items-center gap-0.5 pl-10 mt-1">
                                    <CopilotButton variant="icon-subtle" size="sm" icon={<ThumbLike20Regular />} onClick={() => {}} />
                                    <CopilotButton variant="icon-subtle" size="sm" icon={<ThumbDislike20Regular />} onClick={() => {}} />
                                    <CopilotButton variant="icon-subtle" size="sm" icon={<Copy20Regular />} onClick={() => navigator.clipboard.writeText(msg!.content)} />
                                    {prevUserMsg && (
                                      <CopilotButton variant="icon-subtle" size="sm" icon={<ArrowCounterclockwise20Regular />} onClick={() => handleRerunFromMessage(prevUserMsg, sessionMsgs)} />
                                    )}
                                  </div>
                                );
                              })()}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {/* Chat input — continue the conversation */}
              <div className="flex-shrink-0 relative z-20 bg-white">
                <div className="absolute left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none" style={{ bottom: '100%' }} />
                <div className="py-4 px-6 md:px-8 lg:px-10 xl:px-10 2xl:px-16">
                  <div className="max-w-[1024px] mx-auto">
                    <CopilotChatInput
                      value={historicalInput}
                      onChange={setHistoricalInput}
                      onSend={handleHistoricalSend}
                      isProcessing={isHistoricalProcessing}
                      placeholder="Continue the conversation..."
                      shadow="none"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      ) : showAllActivity ? (
        // ── All Activity View ──────────────────────────────────────────────────
        (() => {
          const portalTarget = document.getElementById('elevate-right-content') || document.getElementById('elevate-right-pane');
          return (
        <>
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-white relative" data-section="Activity Feed" data-section-description="Real-time log of the agent's steps — shows the chain of thought for each response.">
          {/* Header */}
          <div className="flex-shrink-0 px-6 pt-6 pb-4">
            <div className="flex items-center gap-2 max-w-[1024px] mx-auto">
            <CopilotButton
              variant="icon-subtle"
              size="sm"
              icon={<ChevronLeft20Regular />}
              onClick={() => setShowAllActivity(false)}
            />
            <div className="group flex items-center gap-1.5">
              <h1 className="text-2xl font-bold text-text-primary">Test activity</h1>
              <ActivitySummaryButton
                onClick={() => {
                  const sevenDaysAgo = Date.now() - SEVEN_DAYS_MS;
                  const recent = activitySessions.filter(s => s.date >= sevenDaysAgo);
                  const total = recent.length;
                  const failed = recent.filter(s => s.status === 'failed' || s.status === 'rejected').length;
                  const context = total === 0
                    ? 'No test activity in the past 7 days.'
                    : `Past 7 days: ${total} run${total !== 1 ? 's' : ''} total. ${failed} failed or rejected. Statuses: ${recent.map(s => `${s.description} (${s.status}${s.error ? ': ' + s.error : ''})`).join('; ')}.`;
                  setPendingHelperQuote({ label: 'Test activity', type: 'activity-summary', shortQuestion: 'Summarize the past 7 days of activity', context });
                  setIsHelperCollapsed(false);
                }}
              />
            </div>
            </div>
          </div>
          {/* Filter chips + action icons */}
          <div className="flex-shrink-0 px-6 py-3">
            <div className="flex items-center justify-between gap-3 max-w-[1024px] mx-auto">
            <div className="flex items-center gap-2 flex-wrap">
              {activityFilterChips.map(chip => (
                <CopilotButton
                  key={chip.key}
                  variant={activityFilter === chip.key ? 'action' : 'secondary'}
                  size="sm"
                  onClick={() => setActivityFilter(chip.key)}
                  className="!rounded-full"
                >
                  {chip.label}
                </CopilotButton>
              ))}
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <CopilotButton
                variant={hasActiveFilters || showFilterPanel ? 'action' : 'icon-subtle'}
                size="md"
                icon={<Filter20Regular />}
                onClick={() => {
                  setShowAllFilterErrors(false);
                  setShowEditColumns(false);
                  setShowFilterPanel(v => !v);
                }}
              />
              <CopilotButton
                variant={showEditColumns ? 'action' : 'icon-subtle'}
                size="md"
                icon={<ColumnEditRegular />}
                onClick={() => {
                  setShowFilterPanel(false);
                  setShowEditColumns(v => !v);
                }}
              />
              <CopilotButton
                variant={activityFullWidth ? 'action' : 'icon-subtle'}
                size="md"
                icon={<ArrowAutofitWidthRegular />}
                onClick={() => setActivityFullWidth(v => !v)}
              />
            </div>
            </div>
          </div>
          {/* Table */}
          <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
            {filteredActivitySessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                <Chat20Regular className="w-10 h-10 text-text-disabled mb-3" />
                <p className="text-sm font-medium text-text-subtle">
                  {hasAnyActiveFilter ? 'No sessions match the current filters' : 'No test activity yet'}
                </p>
                <p className="text-xs text-text-disabled mt-1">
                  {hasAnyActiveFilter
                    ? 'Try clearing some filters to see more sessions'
                    : 'Start a conversation in the preview to see your test sessions here'}
                </p>
              </div>
            ) : (
              <div className={`border border-border rounded-xl overflow-hidden ${activityFullWidth ? 'w-full' : 'max-w-[1024px] mx-auto'}`}>
                <CopilotTable
                  columns={allActivityCols}
                  data={filteredActivitySessions}
                  onRowClick={(item) => setSelectedSession(item)}
                />
              </div>
            )}
          </div>

          </div>
          {showFilterPanel && portalTarget && createPortal(
            <div className="absolute right-0 top-0 bottom-0 w-[320px] bg-white border-l border-border flex flex-col z-10 shadow-lg">
              <div className="flex-shrink-0 pl-6 pr-4 py-5 flex items-center">
                <span className="flex-1 text-xl font-semibold text-text-primary">Filters</span>
                <CopilotButton variant="icon-subtle" size="sm" icon={<Dismiss20Regular />} onClick={() => setShowFilterPanel(false)} />
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-6">
                <CopilotInput
                  value={activeFilterSearch}
                  onChange={e => setActiveFilterSearch(e.target.value)}
                  placeholder="Search activity by ID"
                  size="md"
                />
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-text-primary">Modified since</span>
                  <CopilotInput
                    type="date"
                    size="md"
                    value={activeFilterDateFrom > 0 ? new Date(activeFilterDateFrom).toISOString().slice(0, 10) : ''}
                    onChange={e => setActiveFilterDateFrom(e.target.value ? new Date(e.target.value).getTime() : 0)}
                  />
                </div>
                {filterPanelUniqueErrors.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-text-primary">Error</span>
                    {filterPanelDisplayedErrors.map(err => (
                      <CopilotCheckbox
                        key={err}
                        label={err}
                        checked={activeFilterErrors.has(err)}
                        onChange={checked => setActiveFilterErrors(prev => {
                          const next = new Set(prev);
                          if (checked) next.add(err); else next.delete(err);
                          return next;
                        })}
                      />
                    ))}
                    {filterPanelUniqueErrors.length > 3 && (
                      <CopilotButton variant="transparent" size="sm" onClick={() => setShowAllFilterErrors(v => !v)}>
                        {showAllFilterErrors ? 'Show less' : 'See all'}
                      </CopilotButton>
                    )}
                  </div>
                )}
              </div>
            </div>,
            portalTarget
          )}
          {showEditColumns && portalTarget && createPortal(
            <div className="absolute right-0 top-0 bottom-0 w-[320px] bg-white border-l border-border flex flex-col z-10 shadow-lg">
              {/* Header */}
              <div className="flex-shrink-0 pl-6 pr-4 pt-5 pb-1 flex items-start">
                <div className="flex-1 pt-1">
                  <div className="text-xl font-semibold text-text-primary">Edit columns</div>
                  <p className="text-xs text-text-subtle mt-1">Select the columns to display in the table.</p>
                </div>
                <CopilotButton
                  variant="icon-subtle"
                  size="sm"
                  icon={<Dismiss20Regular />}
                  onClick={() => setShowEditColumns(false)}
                />
              </div>
              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-3 flex flex-col gap-1">
                {EDIT_COLUMNS_OPTIONS.map(col => (
                  <CopilotCheckbox
                    key={col.key}
                    label={col.label}
                    checked={visibleColumns.has(col.key)}
                    disabled={visibleColumns.size === 1 && visibleColumns.has(col.key)}
                    onChange={(checked) => {
                      setVisibleColumns(prev => {
                        const next = new Set(prev);
                        if (checked) next.add(col.key); else next.delete(col.key);
                        return next;
                      });
                    }}
                  />
                ))}
              </div>
            </div>,
            portalTarget
          )}
        </>
        );
        })()
      ) : (
      // ── Normal Preview ─────────────────────────────────────────────────────
      <div className="flex-1 flex overflow-hidden min-h-0">
        <div ref={outerScrollContainerRef} className={`flex-1 flex flex-col relative ${previewMessages.length === 0 && !scenarioActive ? 'overflow-y-auto' : 'overflow-hidden'}`}>

          {/* Header */}
          {previewMessages.length > 0 && (
            <div className={`flex-shrink-0 ${isNarrowPreview ? 'bg-[hsl(var(--surface-secondary))]' : 'bg-white'}`}>
              {isNarrowPreview ? (
                <div className="flex items-center py-3 px-4 gap-2">
                  <CopilotButton variant="icon-subtle" size="sm" icon={<ChevronLeft20Regular />} onClick={handleNewConversation} />
                  <h2 className="font-semibold text-sm text-text-primary truncate flex-1">
                    {conversationTitle || 'New Conversation'}
                  </h2>
                  <CopilotButton
                    variant="icon-subtle"
                    size="sm"
                    icon={<Compose24Regular />}
                    iconFilled={<Compose24Filled />}
                    onClick={handleNewConversation}
                    title="New conversation"
                  />
                </div>
              ) : (
                <SubHeader
                  title={conversationTitle || 'New Conversation'}
                  onBack={handleNewConversation}
                  className="max-w-[1024px] w-full mx-auto px-4 pt-4 pb-2"
                  icon={<Chat20Regular className="w-5 h-5 text-gray-500" />}
                  actions={<>
                    <Switch
                      checked={isDevMode}
                      onChange={(_: any, data: SwitchOnChangeData) => { setIsDevMode(data.checked); localStorage.setItem('previewShowTracing', String(data.checked)); }}
                      label="Show tracing"
                      labelPosition="before"
                    />
                    <CopilotButton
                      variant="secondary"
                      size="sm"
                      icon={<Compose24Regular />}
                      onClick={handleNewConversation}
                    >
                      New conversation
                    </CopilotButton>
                  </>}
                />
              )}
            </div>
          )}

          {/* Messages — keep mounted, hide with display:none when a scenario is active so the
              scroll position is preserved when the user returns from TriggerLab. The input area
              below uses conditional rendering (unmounts) because it doesn't need scroll state. */}
          <div ref={scrollContainerRef} data-section="Preview Chat" data-section-description="Test the agent by chatting here. Messages here don't affect production." style={{ display: scenarioActive ? 'none' : undefined }} className={`${previewMessages.length > 0 ? 'flex-1 overflow-y-auto min-h-0' : ''} ${isNarrowPreview ? 'py-4 px-8' : 'pt-8 pb-6 px-6 md:px-8 lg:px-[30px] xl:px-[30px] 2xl:px-[30px]'}`}>
            {previewMessages.length === 0 && (
              <div className={`mx-auto ${isNarrowPreview ? 'pt-4' : 'max-w-[1024px]'}`}>

                {/* Removed "Preview your agent" header — history button moved to grey preview header bar */}

                {/* Narrow mode: simple centered layout */}
                {isNarrowPreview && (() => {
                  return (
                    <>
                      <div className="flex flex-col items-center mb-6">
                        <div className="mb-3">
                          <AgentIcon agent={agentConfig} size={48} />
                        </div>
                        <h1 className="font-bold text-text-primary text-center text-xl">
                          Hi, I'm {agentConfig.name || 'Agent'}. How can I help you today?
                        </h1>
                      </div>
                      <div className="mb-6">
                        <CopilotChatInput
                          value={input} onChange={setInput} onSend={handleSendMessage}
                          isProcessing={isProcessing}
                          placeholder={`Message ${agentConfig.name || 'Agent'}`}
                          shadow="md"
                          showSuggestions={false}
                        />
                      </div>
                    </>
                  );
                })()}

                {/* Normal mode: M365 preview card */}
                {!isNarrowPreview && (() => {
                  const allPrompts = dynamicPrompts ?? [];
                  const visiblePrompts = showMorePrompts ? allPrompts : allPrompts.slice(0, 3);
                  return (
                    <>
                    {/* Page-level heading — outside the card */}
                    <div className="mb-4">
                      <h2 className="text-xl font-bold text-foreground leading-tight">Preview your agent</h2>
                      <p className="text-sm text-text-subtle mt-1">Test how your agent responds in real time. This preview simulates the experience users will have after publish, without affecting production.</p>
                    </div>

                    <div className="mb-8 border border-border rounded-2xl overflow-hidden shadow-sm">
                      {/* Channel / trigger preview header bar */}
                      <div className="flex items-center justify-between px-4 py-2 bg-[hsl(var(--surface-tertiary))] border-b border-border">
                        <div className="flex items-center gap-2">
                          {triggerHeaderIcon}
                          <span className="text-sm text-foreground">Try chatting with your agent</span>
                        </div>
                        <CopilotTooltip content="Test history">
                          <CopilotButton variant="icon-subtle" size="md" icon={<History20Regular className="w-5 h-5" />} onClick={() => setShowAllActivity(true)} />
                        </CopilotTooltip>
                      </div>
                      {/* Card body */}
                      <div className="bg-background px-8 pt-10 pb-7">
                        {/* Agent icon + name */}
                        <div className="flex flex-col items-center mb-8">
                          <div className="flex items-center gap-3">
                            <AgentIcon agent={agentConfig} size={40} />
                            <span className="text-xl font-bold text-text-primary">{agentConfig.name || 'Agent'}</span>
                          </div>
                        </div>
                        {/* Chat input */}
                        <div className="mb-6 max-w-2xl mx-auto">
                          <CopilotChatInput
                            value={input} onChange={setInput} onSend={handleSendMessage}
                            isProcessing={isProcessing}
                            placeholder="Type your message"
                            shadow="md"
                            showSuggestions={false}
                          />
                        </div>
                        {/* Suggestion prompt cards */}
                        <div className="max-w-2xl mx-auto">
                          <div className="grid grid-cols-3 gap-3 mb-2">
                            {promptsLoading
                              ? Array.from({ length: 3 }).map((_, i) => (
                                  <div key={i} className="rounded-xl border border-border bg-gray-50 p-3.5 flex flex-col gap-2 animate-pulse">
                                    <div className="h-4 w-20 bg-gray-200 rounded" />
                                    <div className="h-3 w-full bg-gray-100 rounded" />
                                    <div className="h-3 w-3/4 bg-gray-100 rounded" />
                                  </div>
                                ))
                              : visiblePrompts.map((prompt, i) => (
                                  <CopilotButton
                                    key={i}
                                    variant="card"
                                    onClick={() => setInput(prompt.text)}
                                    className="h-full w-full"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <Chat20Color className="w-5 h-5 shrink-0" />
                                      <span className="font-semibold text-sm text-text-primary">{prompt.category}</span>
                                    </div>
                                    <span className="text-[13px] text-text-subtle leading-snug font-normal">{prompt.text}</span>
                                  </CopilotButton>
                                ))
                            }
                          </div>
                          {!promptsLoading && allPrompts.length > 3 && (
                          <div className="flex justify-end">
                            <CopilotButton
                              variant="ghost"
                              size="sm"
                              icon={<ChevronDown20Regular className={showMorePrompts ? 'rotate-180' : ''} />}
                              onClick={() => setShowMorePrompts(v => !v)}
                            >
                              {showMorePrompts ? 'See less' : 'See more'}
                            </CopilotButton>
                          </div>
                          )}
                        </div>
                      </div>
                    </div>
                    </>
                  );
                })()}

                {/* Recent test activity — hidden */}

              </div>
            )}

            {memoizedMessages}
          </div>{/* end scroll container */}

          {/* TriggerLab — single instance, always mounted; hidden during preview conversations */}
          <div
            style={{ display: (previewMessages.length > 0 && !scenarioActive) ? 'none' : undefined }}
            className={scenarioActive ? 'flex-1 flex flex-col overflow-hidden' : `${isNarrowPreview ? 'px-8 pb-6' : 'pb-8'}`}
          >
            <div className={scenarioActive ? 'flex-1 flex flex-col overflow-hidden' : isNarrowPreview ? '' : 'max-w-[1024px] w-full mx-auto px-8'}>
              <TriggerLabPage embedded onRunActiveChange={setScenarioActive} />
            </div>
          </div>


          {/* Input Area */}
          {previewMessages.length > 0 && !scenarioActive && (
            <div className={`flex-shrink-0 relative z-20 ${isNarrowPreview ? 'bg-[hsl(var(--surface-secondary))]' : 'bg-white'}`}>
              <div className={`absolute left-0 right-0 h-12 bg-gradient-to-t ${isNarrowPreview ? 'from-[hsl(var(--surface-secondary))]' : 'from-white'} to-transparent pointer-events-none`} style={{ bottom: '100%' }} />
              <div className={isNarrowPreview ? 'py-4 px-8' : 'py-4'}>
                <div className={isNarrowPreview ? '' : 'max-w-[1024px] w-full mx-auto px-8'}>
                  <CopilotChatInput
                    value={input} onChange={setInput} onSend={handleSendMessage}
                    isProcessing={isProcessing} placeholder="Type a message..."
                    shadow="none"
                    showSuggestions={false}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};
