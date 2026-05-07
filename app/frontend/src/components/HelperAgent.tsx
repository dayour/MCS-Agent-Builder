import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { applyPatches } from '../utils/specPatchUtils';
import { specToAgentConfig } from '../utils/specTranslation';
import { useAgent } from '../context/AgentContext';
import { useDW, type DwTabKey } from '../domains/dw/context/DWContext';
import { useWorkflow } from '../context/WorkflowContext';
import { getAgentStorage } from '../utils/agentStorage';
import { AgentConfig, AgentSnapshot, ConfigSnapshot, Evaluation, Message, MessageEval, SnapshotLifecycleStage } from '../types';
import InlineMessageRating from './InlineMessageRating';
import { snapshotConfig } from '../utils/configDiff';
import { getHelperResponse } from '../utils/helperAgent';
import { buildSimulatedErrorContext, SIMULATED_ERRORS, SimulatedAgentError } from '../data/simulatedAgentErrors';
import { generateScenarios, prewarmScenarioCache, AgentScenario, TriggerType } from '../utils/scenarioGeneration';
import { getFuzzyAgentResponse, FuzzyGoals } from '../utils/fuzzyCreateAgent';
import { callModel } from '../utils/modelClient';
import { detectAgentDomain, selectIconWithAI } from '../utils/agentIcons';
import { matchSystemColorIcon } from '../utils/systemColorIcons';
import { generateSnapshotSection } from '../utils/snapshotContentGenerator';

import { generateWorkflowNodes, generateTriggerNode } from '../utils/workflowGeneration';
import { classifyIntentLocally } from '../utils/localIntentClassification';
import { generateKnowledgeSuggestions } from '../utils/homeMessageGenerators';
import { checkKnowledgeHealth } from '../utils/knowledgeHealthCheck';
import { useToast } from '../context/ToastContext';
import { WORK_IQ_DEFAULT_SERVERS, shouldAutoEnableWorkIQ } from '../utils/workIqUtils';
import { CopilotMessage, CopilotTypingIndicator, CopilotChatInput, EnhancedInputSuggestionList } from './ui';
import { runPublishChecklist, ScenarioId, PublishCheckContext, PublishChecklistResumeState } from './publish';
import { composePostPublishMessage, PostPublishCopyFields } from './publish/postPublish';
import { submitMessageFeedback } from '../utils/messageFeedback';
import { analyzeActivityError, ErrorAnalysis } from '../utils/errorAnalysis';
import { ErrorAnalysisCard } from './ErrorAnalysisCard';
import { PointToAskOverlay } from './PointToAskOverlay';
import { useDexterChat, DexterChatMessage } from '../domains/dw/hooks/useDexterChat';
import { useDexterRouterToken } from '../auth/useDexterRouterToken';
import { DEXTER_CONFIG } from '../config/dexterConfig';
import { dwHelperStrategy } from '../domains/dw/utils/dwHelperStrategy';
import { agentHelperStrategy } from '../domains/agent/utils/agentHelperStrategy';
import { workflowHelperStrategy } from '../domains/workflow/utils/workflowHelperStrategy';
import { isDWAgent, isWorkflowAgent } from '../utils/agentTypeGuards';

// ── Strategy pattern types (exported so strategy files can import without circular deps) ──

/** Display config returned by strategy.getAgentDisplayConfig() for CopilotMessage rendering */
export interface AgentDisplayConfig {
  agentName: string | undefined;
  systemColorIcon: string | undefined;
}

/** Typed token returned by strategy.getMessageToken() — drives render switch in HelperAgent */
export type HelperMessageToken = 'dw-phase-transition' | 'dexter-live-chat' | 'default';

/**
 * Strategy interface for artifact-type-specific behavior in HelperAgent.
 * Implement this for each artifact domain (DW, CA/DA, Workflow).
 * IMPORTANT: implementations must not import React or any React components.
 */
export interface HelperAgentStrategy {
  /** Returns the Day-0 welcome message string, or null if not applicable */
  getWelcomeMessage(agentConfig: AgentConfig): string | null;
  /** Returns the instructions to stream into the editor on Day-0, or null if not applicable */
  getStreamingInstructions(agentConfig: AgentConfig): string | null;
  /** Returns system-prompt additions (day0Prefix), or null if not applicable */
  getSystemPromptAdditions(agentConfig: AgentConfig): string | null;
  /** Returns true if this strategy wants to intercept the given message text */
  shouldInterceptMessage(text: string, agentConfig: AgentConfig): boolean;
  /** Returns a typed token that drives render-level switches in HelperAgent */
  getMessageToken(agentConfig: AgentConfig): HelperMessageToken;
  /** Returns display config (agentName, systemColorIcon) for CopilotMessage rendering */
  getAgentDisplayConfig(agentConfig: AgentConfig): AgentDisplayConfig;
}

/**
 * Returns the correct strategy for the given agent config.
 * Orchestrator-level: this is the only place that branches on artifact type.
 */
function getStrategy(agentConfig: AgentConfig): HelperAgentStrategy {
  if (isDWAgent(agentConfig)) return dwHelperStrategy;
  if (isWorkflowAgent(agentConfig)) return workflowHelperStrategy;
  return agentHelperStrategy;
}

// Icon + display name config for deployment channels
const CHANNEL_ITEM_CONFIG: Record<string, { icon: string; label: string }> = {
  'teams':                   { icon: '/component-icons/Teams24.svg',         label: 'When a user messages in Teams' },
  'microsoft teams':         { icon: '/component-icons/Teams24.svg',         label: 'When a user messages in Teams' },
  'microsoft 365':           { icon: '/component-icons/Microsoft36524.svg',  label: 'When a user messages in Microsoft 365' },
  'm365':                    { icon: '/component-icons/Microsoft36524.svg',  label: 'When a user messages in Microsoft 365' },
  'website':                 { icon: '/component-icons/Website24.svg',       label: 'When a user messages on Website' },
  'web':                     { icon: '/component-icons/Website24.svg',       label: 'When a user messages on Website' },
  'sharepoint':              { icon: '/component-icons/SharePoint24.svg',    label: 'When a user messages in SharePoint' },
  'email':                   { icon: '/component-icons/Outlook24.svg',       label: 'When a new email arrives' },
  'outlook':                 { icon: '/component-icons/Outlook24.svg',       label: 'When a new email arrives' },
  'office 365 outlook':      { icon: '/component-icons/Outlook24.svg',       label: 'When a new email arrives' },
  'slack':                   { icon: '/component-icons/Slack24.svg',         label: 'When a user messages in Slack' },
  'whatsapp':                { icon: '/component-icons/Whatsapp24.svg',      label: 'When a user messages in WhatsApp' },
  'onedrive':                { icon: '/component-icons/OneDrive24.svg',      label: 'When a file changes in OneDrive' },
  'onedrive for business':   { icon: '/component-icons/OneDrive24.svg',      label: 'When a file changes in OneDrive' },
  'forms':                   { icon: '/component-icons/Forms24.svg',         label: 'When a form response is submitted' },
  'ms forms':                { icon: '/component-icons/Forms24.svg',         label: 'When a form response is submitted' },
  'microsoft forms':         { icon: '/component-icons/Forms24.svg',         label: 'When a form response is submitted' },
  'planner':                 { icon: '/component-icons/Planner24.svg',       label: 'When a Planner task is completed' },
  'dataverse':               { icon: '/component-icons/Dataverse24.svg',     label: 'When a Dataverse record changes' },
  'servicenow':              { icon: '/component-icons/ServiceNow24.svg',    label: 'ServiceNow' },
  'salesforce':              { icon: '/component-icons/Salesforce24.svg',    label: 'Salesforce' },
};

// Icon config for knowledge sources
const KNOWLEDGE_ITEM_CONFIG: Record<string, { icon: string }> = {
  'sharepoint':      { icon: '/component-icons/SharePoint24.svg' },
  'onedrive':        { icon: '/component-icons/OneDrive24.svg' },
  'dataverse':       { icon: '/component-icons/Dataverse24.svg' },
  'microsoft forms': { icon: '/component-icons/Forms24.svg' },
  'forms':           { icon: '/component-icons/Forms24.svg' },
  'website':         { icon: '/component-icons/Website24.svg' },
  'outlook':         { icon: '/component-icons/Outlook24.svg' },
  'excel':           { icon: '/component-icons/Excel24.svg' },
  'word':            { icon: '/component-icons/Word24.svg' },
};

// Card types that show interactive selection UI above the chat input.
// Used in both the visibleSuggestions gate and the placeholder text computation.
const INTERACTIVE_CARD_TYPES = new Set(['channel-selection', 'knowledge-sources', 'trigger-selection']);

function getCurrentPageLabel(): string {
  const path = window.location.pathname;
  if (path.includes('/build')) return 'Build Page (agent configuration)';
  if (path.includes('/preview')) return 'Preview Page (test the agent)';
  if (path.includes('/monitor')) return 'Monitor Page (usage analytics and logs)';
  if (path.includes('/evaluate')) return 'Evaluate Page (test quality with eval sets)';
  if (path.includes('/home') || path === '/') return 'Home Page (agent list and creation)';
  return 'Elevate (Copilot Studio)';
}

let _msgIdCounter = 0;
const nextMsgId = (prefix = '') => `${prefix}${Date.now()}-${++_msgIdCounter}`;

const SIDEBAR_MIN = 330;
const SIDEBAR_MAX = 920;
const SIDEBAR_DEFAULT = 400;
const STORAGE_KEY = 'helperAgentWidth';

const USER_ASKED_FOR_FIXES_RE = /\b(apply|fix|changes|retest)\b/i;
const USER_WANTS_RETEST_RE = /\b(retest|rerun)\b/i;
const RUN_EVAL_NOW_RE = /^(?:run eval now|run eval|run it|yes|yeah|yep|sure|ok(?:ay)?|retry|try again|rerun eval)$/i;
const SKIP_EVAL_RE = /^(?:skip(?: and continue)?|continue|publish anyway|skip eval)$/i;
const PUBLISH_ACTION_RE = /\b(publish|deploy|go live|release|ship it)\b/i;
const PUBLISH_COMMAND_RE = /^(?:publish|deploy|release)\b|\b(?:please|go ahead|start|run|continue|do|perform|lets|let's)\b.*\b(?:publish|deploy|go live|release|ship it)\b|\b(?:can|could|would)\s+you\b.*\b(?:publish|deploy|go live|release|ship it)\b|\b(?:publish|deploy|go live|release)\b.*\b(?:this|it|agent|now)\b|\b(?:ship it|go live)\b/i;
const PUBLISH_INFO_REQUEST_RE = /\?|^(?:how|what|why|when|where|who)\b|\b(?:explain|tell me|show me|walk me through)\b/i;
const normalizeBullets = (text: string) =>
  text.replace(/^[ \t]*[-*][ \t]+/gm, '• ');

function shouldStartPublishChecklist(text: string): boolean {
  const normalized = text.trim();
  if (!normalized || !PUBLISH_ACTION_RE.test(normalized)) return false;
  if (PUBLISH_INFO_REQUEST_RE.test(normalized) && !PUBLISH_COMMAND_RE.test(normalized)) return false;
  return PUBLISH_COMMAND_RE.test(normalized);
}

// DW welcome message — kept here for the module-level localStorage patch below.
// The authoritative copy lives in dwHelperStrategy.ts (strategy.getWelcomeMessage()).
// Both must stay in sync: if you update the welcome text, update both files.
const DW_TEAMMATE_WELCOME = `Hey — I'm ready to get started. Here are a couple of things that would help me hit the ground running:\n\n- **Connect me to knowledge sources** so I can answer questions accurately (SharePoint sites, internal docs, etc.)\n- **Tell me what I should focus on** and I'll sharpen my instructions — e.g. "Help the sales team prep for client calls"\n\nWhat would you like to work on first?`;

// Patch stale DW welcome messages in localStorage before React mounts
try {
  const raw = localStorage.getItem('agentHelperMessages');
  if (raw) {
    const data = JSON.parse(raw);
    let changed = false;
    for (const agentId in data) {
      const correctSuggestions = ['Connect knowledge sources', 'Refine my instructions'];
      data[agentId] = data[agentId].map((m: any) => {
        if (!m.id?.startsWith('teammate-welcome-') && !m.id?.startsWith('dw-welcome-')) return m;
        const suggestions: string[] = m.metadata?.suggestions || [];
        const suggestionsStale = suggestions.includes('Give me a name') || suggestions.includes('Give it a name');
        if (m.content !== DW_TEAMMATE_WELCOME || suggestionsStale) {
          changed = true;
          return { ...m, content: DW_TEAMMATE_WELCOME, metadata: { suggestions: correctSuggestions } };
        }
        return m;
      });
    }
    if (changed) localStorage.setItem('agentHelperMessages', JSON.stringify(data));
  }
} catch {}

interface HelperAgentProps {
  isExpanded?: boolean;
}

export const HelperAgent: React.FC<HelperAgentProps> = ({ isExpanded = false }) => {
  const {
    agentConfig,
    updateSpecificAgent,
    addCapabilityToInstructions,
    removeCapabilityFromInstructions,
    helperMessages,
    addHelperMessage,
    addHelperMessageForAgent,
    updateHelperMessageForAgent,
    removeE2EHelperMessages,
    removeStreamingMessagesForAgent,
    currentPage,
    setStreamingInstructions,
    streamingInstructionsData,
    isPublishHAEnabled,
    publishScenario,
    updateAgentConfig,
    updateWithHistory,
    getLatestInstructions,
    addSkill,
    isSkillsEnabled,
    isEvalMode,
    isEvalsV2,
    previewMessages,
    evaluations,
    addEvaluation,
    messageEvals,
    setMessageEval,
    userName,
    takeSnapshot,
    isAgentGlobalUndo,
    knowledgeErrors,
    setKnowledgeErrors,
    isNewNotifications,
    selectedActivityRun,
    removeHelperMessageForAgent,
    pendingHelperInput,
    setPendingHelperInput,
    pendingHelperAutoSubmit,
    setPendingHelperAutoSubmit,
    pendingHelperQuote,
    setPendingHelperQuote,
    captureAgentSnapshot,
    setHelperAgentReview,
    isHAReviewUIEnabled,
    isWorkIQEnabled,
    skills,
    updateSkill,
    deleteSkill,
    isPointToAsk,
    isAgentErrorSimulation,
    resolvedErrorIds,
    resolveSimulatedError,
    setIsHelperCollapsed,
    undo,
    commitSave,
    setPendingScrollTarget,
  } = useAgent();

  const {
    addDwTask,
    removeDwTask,
    updateDwTask,
    dwTasks,
    dwKnowledge,
    addDwKnowledge,
    removeDwKnowledge,
    updateDwKnowledge,
    isAiTeammateDay100,
    isDexter,
    openDwCreateDialog,
    setDwTab,
  } = useDW();

  const { setGeneratingWorkflowAgentId } = useWorkflow();

  const { addToast, updateToast, dismissToast } = useToast();

  // ── Strategy pattern ─────────────────────────────────────────────────────────
  // Resolves the correct artifact-type strategy for the current agent config.
  // All artifact-type checks should be replaced with strategy method calls.
  const strategy = getStrategy(agentConfig);

  // ── Dexter live chat ─────────────────────────────────────────────────────────
  // Route chat to the real Dexter worker when isDexter is on and a worker is provisioned.
  // Safe when isDexter is off: useDexterRouterToken uses MSAL's default context (empty accounts),
  // and useDexterChat bails on the empty workerId before ever calling getAccessToken.
  const isDexterLive = isDexter && !!agentConfig.dexterWorkerId;
  const getRouterToken = useDexterRouterToken();
  const {
    messages: dexterMessages,
    sendMessage: dexterSendMessage,
    isConnected: dexterIsConnected,
    isStreaming: dexterIsStreaming,
    activeToolName: dexterActiveTool,
    error: dexterError,
  } = useDexterChat({
    routerUrl: DEXTER_CONFIG.routerUrl,
    workerId: isDexterLive ? (agentConfig.dexterWorkerId ?? '') : '',
    userName: userName || 'Elevate User',
    provider: 'claude',
    getAccessToken: getRouterToken,
  });

  const captureReview = useCallback((agentId: string) => {
    if (!isHAReviewUIEnabled) return;
    const s = captureAgentSnapshot(agentId);
    if (s) setHelperAgentReview(s);
  }, [isHAReviewUIEnabled, captureAgentSnapshot, setHelperAgentReview]);

  const agentWasCreatedInPlanMode = agentConfig.createdWithPlanMode ?? false;

  const feedbackContext = { userName: userName || 'Anonymous', agentId: agentConfig?.id || '', agentName: agentConfig?.name || 'Copilot Studio' };

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const stored = parseInt(localStorage.getItem(STORAGE_KEY) || '', 10);
    return isNaN(stored) ? SIDEBAR_DEFAULT : Math.max(SIDEBAR_MIN, stored);
  });
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(0);
  const currentWidthRef = useRef(sidebarWidth);
  const latestAgentConfigRef = useRef(agentConfig);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => { currentWidthRef.current = sidebarWidth; }, [sidebarWidth]);
  useEffect(() => { latestAgentConfigRef.current = agentConfig; }, [agentConfig]);
  // Reset and re-seed fuzzy goals ref on agent switch
  // (intentionally fires only on id change, not on every goals update)
  useEffect(() => {
    lastFuzzyGoalsRef.current = agentConfig.fuzzyGoals ?? null;
  }, [agentConfig.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const getConstraints = () => {
      const availableWidth = rootRef.current?.parentElement?.parentElement?.offsetWidth ?? window.innerWidth;
      const max = Math.min(SIDEBAR_MAX, availableWidth * 0.5);
      const min = Math.min(SIDEBAR_MIN, max);
      return { min, max };
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const { min, max } = getConstraints();
      const delta = e.clientX - dragStartXRef.current;
      setSidebarWidth(Math.max(min, Math.min(dragStartWidthRef.current + delta, max)));
    };
    const onMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      document.body.style.userSelect = '';
      localStorage.setItem(STORAGE_KEY, String(currentWidthRef.current));
    };
    const onResize = () => {
      const { min, max } = getConstraints();
      setSidebarWidth(w => Math.max(min, Math.min(w, max)));
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const navigate = useNavigate();
  const location = useLocation();

  const [input, setInput] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [nodeQuote, setNodeQuote] = useState<{ label: string; type: string; errorTitle?: string; error?: string; context?: string } | null>(null);

  // Populate input when PreviewPage asks to ask about a CoT node (legacy long-form)
  useEffect(() => {
    if (!pendingHelperInput) return;
    setInput(pendingHelperInput);
    setPendingHelperInput(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  // setPendingHelperInput and inputRef are stable refs/setters — safe to omit
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingHelperInput]);

  // Auto-submit a message programmatically (e.g. clicking the role description in the DW header)
  const autoSubmitMountedRef = useRef(true);
  useEffect(() => { return () => { autoSubmitMountedRef.current = false; }; }, []);
  useEffect(() => {
    if (!pendingHelperAutoSubmit) return;
    const msg = pendingHelperAutoSubmit;
    // Small delay so the pane finishes mounting/animating before the message fires.
    // NOTE: setPendingHelperAutoSubmit(null) is called INSIDE the timer (not eagerly) so that
    // React StrictMode's simulated unmount/remount doesn't wipe the pending value before the
    // second-mount's timer has a chance to fire. The cleanup cancels the timer on unmount.
    const timer = setTimeout(() => {
      // No autoSubmitMountedRef guard here — if the component unmounted, clearTimeout
      // in the cleanup already cancelled this timer before it could fire.
      setPendingHelperAutoSubmit(null);
      handleSendMessageRef.current?.(msg, undefined, true);
    }, 300);
    return () => clearTimeout(timer);
  // handleSendMessage and setPendingHelperAutoSubmit are stable — safe to omit
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingHelperAutoSubmit]);

  // Populate quote chip + short question when PreviewPage triggers a node ask
  useEffect(() => {
    if (!pendingHelperQuote) return;
    const { shortQuestion, ...quote } = pendingHelperQuote;
    setNodeQuote(quote);
    setInput(shortQuestion);
    setPendingHelperQuote(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  // setPendingHelperQuote, setNodeQuote, setInput, and inputRef are stable — safe to omit
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingHelperQuote]);


  const [isProcessing, setIsProcessing] = useState(false);
  // Reset processing state when navigating to a new page so stale state from a previous
  // in-flight request doesn't block the auto-submit on the new page.
  const prevCurrentPageRef = useRef(currentPage);
  useEffect(() => {
    if (prevCurrentPageRef.current !== currentPage) {
      prevCurrentPageRef.current = currentPage;
      setIsProcessing(false);
    }
  }, [currentPage]);
  const [isDay0Streaming, setIsDay0Streaming] = useState(false);
  // True while the instruction streaming animation is playing after an error fix
  const [isApplyingErrorFix, setIsApplyingErrorFix] = useState(false);
  // True after the fix animation completes — waiting for user to accept, undo, or describe a change
  const [pendingFixConfirmation, setPendingFixConfirmation] = useState(false);
  // Holds a pending name+description generated from the user's first prompt.
  // Applied when instructions start streaming so they appear together.
  const lastFuzzyGoalsRef = useRef<FuzzyGoals | null>(null);
  const pendingDay0NameRef = useRef<{ agentId: string; name: string; description: string } | null>(null);
  // Holds a Copilot response message that should appear after instruction streaming finishes.
  const pendingDay0ResponseRef = useRef<{ agentId: string; message: Message; messageId: string } | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [animatingInMessageId, setAnimatingInMessageId] = useState<string | null>(null);
  const [scenarioOptions, setScenarioOptions] = useState<AgentScenario[] | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const bottomSectionRef = useRef<HTMLDivElement>(null);
  const [bottomHeight, setBottomHeight] = useState(200);
  const hasStreamedSummaryRef = useRef<Record<string, boolean>>({});
  const hasShownPreviewWelcomeRef = useRef<Record<string, boolean>>({});
  const [errorAnalysis, setErrorAnalysis] = useState<ErrorAnalysis | null>(null);
  const [isAnalyzingError, setIsAnalyzingError] = useState(false);
  const [isPointToAskMode, setIsPointToAskMode] = useState(false);
  const processedErrorRunRef = useRef<string | null>(null);
  const publishInFlightRef = useRef(false);
  const pendingPublishEvalDecisionRef = useRef<{ agentId: string; resumeState?: PublishChecklistResumeState } | null>(null);
  // Snapshot of agentConfig taken just before each user message is sent — used as configBefore in evals
  const configBeforeRef = useRef<ConfigSnapshot | undefined>(undefined);
  // Retains the most recently generated scenario list so the numeric shortcut ("let's do 1")
  // keeps working after scenarioOptions is cleared or after a remount/navigation.
  // Seeded from sessionStorage so it survives component remounts and page navigations.
  const lastScenarioOptionsRef = useRef<AgentScenario[]>((() => {
    try {
      const raw = sessionStorage.getItem('last_autotest_scenario_list');
      return raw ? (JSON.parse(raw) as AgentScenario[]) : [];
    } catch { return []; }
  })());

  // Tracks the previous agentId so the clear-on-switch effect can distinguish
  // an initial mount (no clear needed) from an actual agent change (clear stale scenarios).
  const prevAgentIdRef = useRef<string | null>(null);

  // Tracks the most recently selected E2E scenario so "rerun" requests can skip scenario selection.
  // Seeded from sessionStorage so it survives component remounts and page navigations.
  const lastScenarioRef = useRef<AgentScenario | null>((() => {
    try {
      const raw = sessionStorage.getItem('last_autotest_scenario');
      return raw ? (JSON.parse(raw) as AgentScenario) : null;
    } catch { return null; }
  })());

  // Holds pending instruction updates waiting for user confirmation
  const pendingFixRef = useRef<{ updates: Record<string, any>; rerun: boolean; description: string } | null>(null);
  const isDwConfirmPendingRef = useRef(false);
  const handleSendMessageRef = useRef<(messageText?: string, forcedChannel?: string, isAutoSubmit?: boolean) => Promise<void>>(null as never);
  // Re-sync ref from messages on every render so remounts don't lose the pending state
  const lastAssistantSuggestions = useMemo(() => {
    const lastAssistant = [...helperMessages].reverse().find(m => m.role === 'assistant' && !m.streaming);
    return (lastAssistant?.metadata?.suggestions ?? []) as string[];
  }, [helperMessages]);
  useEffect(() => {
    if (!isDwConfirmPendingRef.current && lastAssistantSuggestions.includes('Yes, create an AI Teammate')) {
      isDwConfirmPendingRef.current = true;
    }
  }, [lastAssistantSuggestions]);

  // ── Work IQ helpers ─────────────────────────────────────────────────────────

  /** Returns the workiq message already in the thread, if any. */
  const workIqMessage = helperMessages.find(m => m.metadata?.type === 'workiq');

  /**
   * Inject (or refresh) the Work IQ card. Always shows the connected/enabled
   * state — the card never asks the user to "enable" manually.
   */
  const upsertWorkIQCard = useCallback((servers: string[]) => {
    const targetId = agentConfig.id;
    if (!targetId) return;
    const msg = {
      id: `workiq-card-${targetId}`,
      role: 'assistant' as const,
      content: 'Work IQ is connected. Your agent will use your Microsoft 365 context — emails, meetings, chats, and documents — to give grounded answers.',
      timestamp: new Date(),
      metadata: { type: 'workiq' as const, workIqServers: servers },
    };
    // Reuse existing message object so position in thread is stable
    addHelperMessageForAgent(targetId, workIqMessage ? { ...workIqMessage, ...msg } : msg);
  }, [agentConfig.id, workIqMessage, addHelperMessageForAgent]);

  /** Called when the user clicks "See added tools" — signals BuildPage to open WorkIQDetailPanel. */
  const handleViewWorkIQTools = useCallback(() => {
    window.dispatchEvent(new CustomEvent('workiq:view-tools'));
  }, []);

  /** Called when the user saves server changes from the card's manage panel. */
  const handleWorkIQManage = useCallback((servers: string[]) => {
    updateSpecificAgent(agentConfig.id, { workIq: { enabled: true, enabledServers: servers } });
    upsertWorkIQCard(servers);
  }, [agentConfig.id, updateSpecificAgent, upsertWorkIQCard]);

  /** Navigate to a section in response to a change-summary bullet click. */
  const handleNavigation = useCallback((target: string) => {
    if (!target) return;
    if (target === 'flows') {
      navigate('/flows');
      return;
    }
    if (target.startsWith('settings:')) {
      navigate('/settings');
      return;
    }
    if (target.startsWith('dw:')) {
      const tab = target.slice(3) as DwTabKey;
      setDwTab(tab);
      return;
    }
    if (target.startsWith('build:')) {
      const section = target.slice(6);
      navigate('/build');
      setPendingScrollTarget(section);
    }
  }, [navigate, setDwTab, setPendingScrollTarget]);

  /**
   * Auto-enable Work IQ when the feature toggle is on and the agent config has
   * enough M365/work signals. Pass `pendingUpdates` to include config changes
   * applied in the same tick that haven't re-rendered yet.
   */
  const maybeAutoEnableWorkIQ = useCallback((pendingUpdates: Partial<typeof agentConfig> = {}) => {
    if (!isWorkIQEnabled) return;
    if (workIqMessage) return; // card already present
    const merged = { ...agentConfig, ...pendingUpdates };
    if (shouldAutoEnableWorkIQ(merged)) {
      const servers = WORK_IQ_DEFAULT_SERVERS;
      updateSpecificAgent(agentConfig.id, { workIq: { enabled: true, enabledServers: servers } });
      upsertWorkIQCard(servers);
    }
  }, [isWorkIQEnabled, agentConfig, workIqMessage, updateSpecificAgent, upsertWorkIQCard]);

  // When the feature toggle is first turned on, auto-enable immediately for
  // the current agent (no "Enable" button click required).
  useEffect(() => {
    if (!isWorkIQEnabled || !agentConfig.id || currentPage !== 'build') return;
    if (workIqMessage) return; // already present
    const servers = agentConfig.workIq?.enabledServers ?? WORK_IQ_DEFAULT_SERVERS;
    updateSpecificAgent(agentConfig.id, { workIq: { enabled: true, enabledServers: servers } });
    upsertWorkIQCard(servers);
  }, [isWorkIQEnabled, agentConfig.id, currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── End Work IQ helpers ──────────────────────────────────────────────────────

  // Seed a welcome message for workflows that land on the build page with no chat history.
  // Differentiates between brand-new workflows (empty canvas) and returning ones (has nodes).
  const workflowWelcomedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (
      currentPage !== 'build' ||
      !isWorkflowAgent(agentConfig) ||
      !agentConfig.id ||
      helperMessages.length > 0 ||
      workflowWelcomedRef.current.has(agentConfig.id)
    ) return;
    workflowWelcomedRef.current.add(agentConfig.id);

    // A workflow is "new" if it has no real steps beyond the default trigger
    const nodes = agentConfig.workflowNodes || [];
    const nonTriggerNodes = nodes.filter(n => n.type !== 'trigger' && !n.placeholder);
    const isNewWorkflow = nonTriggerNodes.length === 0;

    let content: string;
    let suggestions: string[];

    if (isNewWorkflow) {
      content = `Great — I've set up a new workflow for you.\n\nTo get started, **tell me what you'd like this workflow to do**. For example:\n- "When a form is submitted, send an approval email and log the response to SharePoint"\n- "Every Monday, pull a report from Excel and post a summary to Teams"\n- "When a new file is added to OneDrive, extract the key details and save them to a database"\n\nOnce I understand the process, I'll build out the trigger, steps, and actions.`;
      suggestions = ['Automate an approval process', 'Set up a scheduled report', 'Route incoming requests'];
    } else {
      // Returning workflow — build a contextual welcome with a full step recap
      const triggerNode = nodes.find(n => n.type === 'trigger');
      const realNodes = nonTriggerNodes;
      const unconfiguredNode = realNodes.find(n =>
        n.label.startsWith('New ') || (!n.connector && !n.config?.task && n.type === 'action')
      );
      const workflowName = agentConfig.name || 'your workflow';

      // Build a readable step list for the recap
      const triggerLine = triggerNode
        ? `**Trigger:** ${triggerNode.label}${triggerNode.connector ? ` (${triggerNode.connector})` : ''}`
        : null;
      const stepLines = realNodes.map((n, i) => {
        const detail = n.connector ? ` · ${n.connector}` : n.config?.task ? ` · ${n.config.task}` : '';
        const flag = n.label.startsWith('New ') || (!n.connector && !n.config?.task && n.type === 'action') ? ' ⚠ needs setup' : '';
        return `${i + 1}. **${n.label}**${detail}${flag}`;
      });
      const recap = [triggerLine, ...stepLines].filter(Boolean).join('\n');

      if (unconfiguredNode) {
        content = `Welcome back! Here's where **${workflowName}** stands:\n\n${recap}\n\n--\n\nThe **${unconfiguredNode.label}** step still needs to be set up — want to pick up there, or is there something else you'd like to change?`;
        suggestions = [`Configure ${unconfiguredNode.label}`, 'Add a new step', 'Change the trigger'];
      } else {
        content = `Welcome back! Here's where **${workflowName}** stands:\n\n${recap}\n\n--\n\nEverything looks set up. What would you like to work on next?`;
        suggestions = ['Add a new step', 'Refine an existing step', 'Test this workflow'];
      }
    }

    addHelperMessageForAgent(agentConfig.id, {
      id: `workflow-welcome-${agentConfig.id}`,
      role: 'assistant',
      content,
      timestamp: new Date(),
      metadata: { suggestions },
    });
  // Intentionally one-shot: workflowWelcomedRef prevents re-runs for the same agent ID.
  // agentConfig.workflowNodes/name are read at mount time only — exhaustive-deps suppressed deliberately.
  }, [currentPage, agentConfig.type, agentConfig.id, helperMessages.length, addHelperMessageForAgent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Canvas-to-chat: listen for node focus events dispatched from WorkflowNodeCard
  useEffect(() => {
    if (!isWorkflowAgent(agentConfig) || currentPage !== 'build') return;
    const handler = (e: Event) => {
      const { nodeId, nodeType, nodeLabel, nodeConnector, nodeConfig } = (e as CustomEvent).detail;
      // Whitelist safe config fields only — avoid sending credentials or user data to the LLM
      const SAFE_CONFIG_FIELDS = ['task', 'triggerType', 'schedule', 'stepTypeLabel', 'instanceName', 'model'];
      const safeConfig = nodeConfig
        ? Object.fromEntries(Object.entries(nodeConfig).filter(([k]) => SAFE_CONFIG_FIELDS.includes(k)))
        : null;
      const configSummary = safeConfig && Object.keys(safeConfig).length > 0 ? ` Current config: ${JSON.stringify(safeConfig)}.` : '';
      const connectorSummary = nodeConnector ? ` Uses ${nodeConnector} connector.` : '';
      // Auto-send a hidden system message scoped to this node
      handleSendMessageRef.current?.(
        `[SYSTEM: User clicked on the "${nodeLabel}" step (${nodeType}, id: ${nodeId}).${connectorSummary}${configSummary} Greet them about this specific step. Ask one focused question to help them configure it — based on what's already set and what's still missing. Keep it to 2–3 sentences max.]`
      );
    };
    window.addEventListener('elevate:workflow-focus-node', handler);
    return () => window.removeEventListener('elevate:workflow-focus-node', handler);
  }, [agentConfig.type, currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear justCreated flag after the animation has had time to trigger
  useEffect(() => {
    if (currentPage === 'build' && agentConfig.id && agentConfig.justCreated && helperMessages.length > 0) {
      const timer = setTimeout(() => {
        updateSpecificAgent(agentConfig.id!, { justCreated: false });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentPage, agentConfig.id, agentConfig.justCreated, helperMessages.length, updateSpecificAgent]);

  // AI Teammate (DW) day-0 orchestration:
  // 1. Show "Creating your AI Teammate..." typing indicator
  // 2. Stream instructions into the editor
  // 3. When instructions finish, stream in the welcome message
  const dwStreamPhaseRef = useRef<'idle' | 'typing' | 'instructions' | 'welcome'>('idle');

  // Phase 1: Show typing indicator, then kick off instruction streaming after a brief pause
  useEffect(() => {
    if (currentPage !== 'build' || !agentConfig.justCreated || !isDWAgent(agentConfig)) return;
    if (dwStreamPhaseRef.current !== 'idle') return;

    const instructionsToStream = strategy.getStreamingInstructions(agentConfig);
    if (!instructionsToStream) return;

    dwStreamPhaseRef.current = 'typing';
    setIsProcessing(true);

    const timer = setTimeout(() => {
      if (!agentConfig.id) return;
      dwStreamPhaseRef.current = 'instructions';
      setStreamingInstructions(agentConfig.id, instructionsToStream);
    }, 800);

    return () => clearTimeout(timer);
  // strategy is derived from agentConfig so agentConfig.agentType is covered
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, agentConfig.justCreated, agentConfig.agentType, agentConfig.id, setStreamingInstructions]);

  // When the streaming animation completes, switch from loader → accept/undo prompt
  useEffect(() => {
    if (isApplyingErrorFix && streamingInstructionsData === null) {
      setIsApplyingErrorFix(false);
      setPendingFixConfirmation(true);
    }
  }, [streamingInstructionsData, isApplyingErrorFix]);

  // Phase 2 → 3: When instruction streaming finishes, add the welcome message and stream it
  useEffect(() => {
    if (dwStreamPhaseRef.current !== 'instructions') return;
    // streamingInstructionsData goes null when streaming completes
    if (streamingInstructionsData !== null) return;
    if (!agentConfig.id) return;

    const welcomeContent = strategy.getWelcomeMessage(agentConfig);
    if (!welcomeContent) return;

    dwStreamPhaseRef.current = 'welcome';
    setIsProcessing(false);

    const welcomeId = `teammate-welcome-${Date.now()}`;
    addHelperMessageForAgent(agentConfig.id, {
      id: welcomeId,
      role: 'assistant',
      content: welcomeContent,
      timestamp: new Date(),
      metadata: { suggestions: ['Connect knowledge sources', 'Refine my instructions'] },
    });
  // strategy is derived from agentConfig so it doesn't need to be in deps separately
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamingInstructionsData, agentConfig.id, addHelperMessageForAgent]);

  // Reset DW phase when switching agents
  useEffect(() => {
    dwStreamPhaseRef.current = 'idle';
  }, [agentConfig.id]);

  // Greet on mount when DW Day-0 pane opens.
  // Uses a stable ID so addHelperMessageForAgent's dedup guard prevents double-adds
  // (React 18 StrictMode fires this effect twice; the second call is a no-op).
  useEffect(() => {
    if (!isDWAgent(agentConfig) || isAiTeammateDay100 || agentConfig.justCreated) return;
    const welcomeContent = strategy.getWelcomeMessage(agentConfig);
    if (!welcomeContent) return;
    addHelperMessageForAgent(agentConfig.id, {
      id: `dw-welcome-${agentConfig.id}`,
      role: 'assistant',
      content: welcomeContent,
      timestamp: new Date(),
      metadata: { suggestions: ['Connect knowledge sources', 'Refine my instructions'] },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Day-0: apply the pending name+description+icon when instructions start streaming.
  // This syncs the name update with the instructions so they appear together.
  useEffect(() => {
    if (!streamingInstructionsData || !pendingDay0NameRef.current) return;
    if (streamingInstructionsData.agentId !== pendingDay0NameRef.current.agentId) return;
    const { agentId, name, description } = pendingDay0NameRef.current;
    pendingDay0NameRef.current = null;
    // Synchronous icon selection — arrives with name so there's no flash
    const iconKey = matchSystemColorIcon(`${name} ${description}`);
    if (iconKey !== 'agents') {
      updateSpecificAgent(agentId, { name, description, systemColorIcon: iconKey });
    } else {
      const fallbackIconKey = detectAgentDomain({ name, description });
      updateSpecificAgent(agentId, { name, description, iconKey: fallbackIconKey });
    }
  }, [streamingInstructionsData, updateSpecificAgent]);

  // Day-0: release held Copilot response after instruction streaming finishes.
  useEffect(() => {
    if (streamingInstructionsData !== null || !pendingDay0ResponseRef.current) return;
    const { agentId, message, messageId } = pendingDay0ResponseRef.current;
    pendingDay0ResponseRef.current = null;
    setIsDay0Streaming(false);
    setStreamingMessageId(messageId);
    addHelperMessageForAgent(agentId, message);
    const paragraphCount = message.content.split('\n\n').filter(p => p.trim()).length;
    setTimeout(() => setStreamingMessageId(null), paragraphCount * 200 + 100);
    setIsProcessing(false);
  }, [streamingInstructionsData, addHelperMessageForAgent]);

  // When the user navigates to the Preview tab, inject a one-time welcome helper message.
  // Skip if the agent already has preview conversation history — they know what the tab does.
  useEffect(() => {
    if (currentPage !== 'preview') return;
    if (!agentConfig.id) return;
    if (hasShownPreviewWelcomeRef.current[agentConfig.id]) return;
    // Also check persisted messages — avoid duplicate welcome on page refresh
    if (helperMessages.some(m => m.id.startsWith('preview-helper-'))) return;
    // Skip if the agent already has preview chat history — intro would be redundant
    if (previewMessages.length > 0) return;
    hasShownPreviewWelcomeRef.current[agentConfig.id] = true;
    const helperMessage: Message = {
      id: `preview-helper-${Date.now()}`,
      role: 'assistant',
      content: "Use Preview to simulate real user conversations and explore how your agent behaves behind the scenes. Try different prompts, inspect responses, and catch issues early.\n\nWhen something doesn't look right, you can dig into activity and testing tools to understand why—and fix it before you publish.",
      timestamp: new Date(),
      streaming: false,
      metadata: {
        suggestions: [
          "Guide me through testing",
          "Why did it respond this way?",
          "How can I improve this?",
        ],
      },
    };
    addHelperMessage(helperMessage);
    // Scroll helper panel to show the welcome message
    setTimeout(() => {
      const container = messagesContainerRef.current;
      if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }, 200);
  // previewMessages intentionally omitted: read only as a one-time guard on page entry;
  // hasShownPreviewWelcomeRef + helperMessages checks prevent duplicates if it loads async.
  }, [currentPage, agentConfig.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deduplicate preview-helper-* welcome messages persisted in localStorage —
  // keep only the first occurrence and remove any subsequent duplicates.
  useEffect(() => {
    if (!agentConfig.id) return;
    const welcomeMessages = helperMessages.filter(m => m.id.startsWith('preview-helper-'));
    if (welcomeMessages.length <= 1) return;
    // Remove all but the first welcome message
    welcomeMessages.slice(1).forEach(m => removeHelperMessageForAgent(agentConfig.id, m.id));
  }, [agentConfig.id, helperMessages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // When an error activity run is selected, proactively analyze and display it
  useEffect(() => {
    if (!selectedActivityRun) {
      setErrorAnalysis(null);
      processedErrorRunRef.current = null;
      return;
    }
    if (processedErrorRunRef.current === selectedActivityRun.id) return;
    processedErrorRunRef.current = selectedActivityRun.id;
    setIsAnalyzingError(true);
    setErrorAnalysis(null);
    // Scroll to bottom so the error analysis card (rendered after messages) is visible
    requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    });
    analyzeActivityError(selectedActivityRun, agentConfig.name || 'Agent')
      .then(result => { setErrorAnalysis(result); })
      .catch(err => { console.error('[HelperAgent] Error analysis failed:', err); })
      .finally(() => { setIsAnalyzingError(false); });
  }, [selectedActivityRun?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear stale scenario state when switching agents so old scenarios from a
  // previous agent can't match number inputs (e.g. user says "do #2" from
  // next steps and it accidentally selects scenario 2 from the old agent).
  // NOTE: Only clears on an actual agent *change* — not on initial mount —
  // so the sessionStorage-seeded lastScenarioOptionsRef survives remounts.
  useEffect(() => {
    setScenarioOptions(null);
    const isAgentChange = prevAgentIdRef.current !== null && prevAgentIdRef.current !== agentConfig.id;
    prevAgentIdRef.current = agentConfig.id;
    if (isAgentChange) {
      lastScenarioOptionsRef.current = [];
      lastScenarioRef.current = null;
      try { sessionStorage.removeItem('last_autotest_scenario_list'); } catch {}
      try { sessionStorage.removeItem('last_autotest_scenario'); } catch {}
    }
  }, [agentConfig.id]);

  // Speculatively warm the scenario cache whenever the agent config changes so
  // "Run an E2E test" returns instantly instead of waiting for LLM generation.
  useEffect(() => {
    if (agentConfig.id && (agentWasCreatedInPlanMode || agentConfig.isFuzzyComplete)) {
      prewarmScenarioCache(agentConfig);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentConfig.id, agentConfig.instructions]);

  // ── Knowledge source health check ──────────────────────────────────────────
  // Runs once per agent per session when the build page is open.
  // Fires an error toast for each broken connector and stores results in context
  // so the proactive message effect below can inject a helper card.
  const knowledgeCheckRanRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (currentPage !== 'build' || !agentConfig.id) return;
    if (knowledgeCheckRanRef.current[agentConfig.id]) return;
    if (!agentConfig.knowledge.customAPIs.some(a => a.enabled)) return;

    knowledgeCheckRanRef.current[agentConfig.id] = true;

    checkKnowledgeHealth(agentConfig.knowledge).then(errors => {
      if (errors.length === 0) return;
      setKnowledgeErrors(errors);
      if (isNewNotifications) {
        errors.forEach(err => {
          addToast({
            variant: 'error',
            title: 'Knowledge source unavailable',
            message: err.message,
            duration: 0, // persistent — maker needs to act
            agentId: agentConfig.id,
            action: {
              label: 'Get help',
              onClick: () => {
                // The helper agent is already visible on the build page;
                // scrolling to the top of the panel is handled by the
                // proactive message injected below.
              },
            },
          });
        });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentConfig.id, currentPage]);

  // ── Proactive diagnostic message ───────────────────────────────────────────
  // When knowledge errors arrive, inject a single assistant message that
  // explains what broke and offers concrete next steps.
  const knowledgeErrorMsgInjectedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (knowledgeErrors.length === 0 || !agentConfig.id) return;
    if (knowledgeErrorMsgInjectedRef.current[agentConfig.id]) return;
    knowledgeErrorMsgInjectedRef.current[agentConfig.id] = true;

    const errorLines = knowledgeErrors
      .map(e => `- **${e.sourceName}**: ${e.message}`)
      .join('\n');

    addHelperMessageForAgent(agentConfig.id, {
      id: nextMsgId('knowledge-err-'),
      role: 'assistant',
      content: `I spotted a problem with ${knowledgeErrors.length === 1 ? 'a knowledge source' : 'some knowledge sources'} on **${agentConfig.name}**:\n\n${errorLines}\n\nThis is a silent failure — your agent will keep running but won't be able to retrieve this data, so users may get incomplete or incorrect answers without any error message.\n\nHere's what you can do:\n- **Reconnect** — check whether the Dataverse table still exists and update the endpoint\n- **Replace** — swap it for a different source (SharePoint, OneDrive, file upload)\n- **Remove and document** — delete the broken connection and add a note in your agent's instructions that certain data is temporarily unavailable\n\nWant me to help you with any of these?`,
      timestamp: new Date(),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knowledgeErrors, agentConfig.id]);

  // Active (unresolved) simulated errors — drives suggestions, toast, and context.
  // Empty when the feature toggle is off so error state never bleeds into normal sessions.
  const activeErrors = useMemo(
    () => isAgentErrorSimulation ? SIMULATED_ERRORS.filter(e => !resolvedErrorIds.includes(e.id)) : [],
    [isAgentErrorSimulation, resolvedErrorIds]
  );

  // ── Agent error simulation notification ────────────────────────────────────
  // Fires a persistent notification when the error simulation toggle is on.
  // Deduplicated per agent using sessionStorage so toggling pages doesn't re-fire,
  // but the toast re-fires if the page is refreshed or the tab is reopened.
  const errorSimToastIdRef = useRef<Record<string, string>>({});
  const activeErrorsRef = useRef(activeErrors);
  useEffect(() => { activeErrorsRef.current = activeErrors; }, [activeErrors]);

  const buildErrorMessage = useCallback((errors: SimulatedAgentError[]) => {
    const counts = errors.reduce<Record<string, number>>((acc, e) => { acc[e.errorSource] = (acc[e.errorSource] ?? 0) + 1; return acc; }, {});
    return [
      counts['publish'] && `${counts['publish']} can't publish`,
      counts['action'] && `${counts['action']} action not working`,
      counts['knowledge'] && `${counts['knowledge']} broken connection`,
      counts['test_session'] && `${counts['test_session']} test failure${(counts['test_session'] ?? 0) > 1 ? 's' : ''}`,
      counts['instruction'] && `${counts['instruction']} step issue`,
    ].filter(Boolean).join(' · ');
  }, []);

  useEffect(() => {
    if (!isAgentErrorSimulation || !agentConfig.id) return;

    // Inject broken instruction lines whenever the toggle is on and the text isn't already present.
    // Done unconditionally (not gated by session key) so toggling off→on always re-injects.
    const currentInstructions = agentConfig.instructions || '';
    const instructionInjections = SIMULATED_ERRORS
      .filter(e => e.errorSource === 'instruction' && e.fix?.inject && !currentInstructions.includes(e.fix.find))
      .map(e => e.fix!.inject!)
      .join('');
    if (instructionInjections) {
      updateSpecificAgent(agentConfig.id, { instructions: currentInstructions + instructionInjections });
    }

    const sessionKey = `errorSimToastFired_${agentConfig.id}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, 'true');

    const toastId = addToast({
      variant: 'error',
      title: `${agentConfig.name} has ${SIMULATED_ERRORS.length} issues to fix`,
      message: buildErrorMessage(SIMULATED_ERRORS),
      duration: 0,
      agentId: agentConfig.id,
      action: {
        label: 'Fix with Copilot',
        onClick: () => {
          const errors = activeErrorsRef.current;
          const errorLines = errors
            .map(e => `${e.errorSource}: ${e.affectedResource} — ${e.errorMessage}`)
            .join('; ');
          setPendingHelperQuote({
            label: `${errors.length} active error${errors.length !== 1 ? 's' : ''}`,
            type: 'activity-summary',
            shortQuestion: 'Help me fix these issues',
            context: `Active errors: ${errorLines}`,
          });
          setIsHelperCollapsed(false);
        },
      },
    });
    errorSimToastIdRef.current[agentConfig.id] = toastId;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAgentErrorSimulation, agentConfig.id, agentConfig.name]);

  // Clear sessionStorage dedup key + remove injected instruction lines when the toggle is turned off
  useEffect(() => {
    if (!isAgentErrorSimulation && agentConfig.id) {
      sessionStorage.removeItem(`errorSimToastFired_${agentConfig.id}`);
      // Strip any injected broken lines that were never fixed
      const currentInstructions = agentConfig.instructions || '';
      let cleaned = currentInstructions;
      for (const err of SIMULATED_ERRORS) {
        if (err.errorSource === 'instruction' && err.fix?.inject) {
          cleaned = cleaned.replace(err.fix.inject, '');
        }
      }
      if (cleaned !== currentInstructions) {
        updateSpecificAgent(agentConfig.id, { instructions: cleaned.trim() });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAgentErrorSimulation, agentConfig.id]);

  // Keep toast title/message in sync as errors are resolved
  useEffect(() => {
    const toastId = errorSimToastIdRef.current[agentConfig.id];
    if (!toastId || !isAgentErrorSimulation) return;
    if (activeErrors.length === 0) {
      dismissToast(toastId);
      return;
    }
    updateToast(toastId, {
      title: `${agentConfig.name} has ${activeErrors.length} issue${activeErrors.length !== 1 ? 's' : ''} to fix`,
      message: buildErrorMessage(activeErrors),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeErrors, agentConfig.id, agentConfig.name]);

  // Measure the fixed bottom section so we can pad the message list accordingly
  useEffect(() => {
    const el = bottomSectionRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setBottomHeight(entry.contentRect.height + 24); // +24 for a little breathing room
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // When the bottom section grows (e.g. suggestion list appears), scroll to bottom
  // so messages stay visible above it. Only fires if the user is already near the
  // bottom — don't hijack intentional scroll-up reads.
  const prevBottomHeightRef = useRef(bottomHeight);
  useEffect(() => {
    const grew = bottomHeight > prevBottomHeightRef.current;
    prevBottomHeightRef.current = bottomHeight;
    if (!grew) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 120) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [bottomHeight]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // Pending scroll: set this ref before a state update, then the useEffect below
  // fires after React renders the new message to the DOM and performs the scroll.
  const pendingScrollMessageIdRef = useRef<string | null>(null);

  // When helperMessages is empty on initial justCreated render (because the creation summary
  // hasn't arrived yet), we store the agentId here so the animation still fires once it does.
  const pendingAnimationAgentIdRef = useRef<string | null>(null);

  // Set to true when justCreated is detected but helperMessages were empty at that point.
  // The useLayoutEffect on [helperMessages] resolves it once messages arrive.
  const pendingJustCreatedScrollRef = useRef(false);
  // Track message IDs that completed progressive paragraph animation so the outer
  // div doesn't re-trigger animate-slide-up-fade when progressiveParagraphs flips to false.
  const animatedProgressivelyIdsRef = useRef<Set<string>>(new Set());
  // Messages that existed when the agent was first shown should not animate in.
  // Reset when the agent changes so pre-existing messages for the new agent are also skipped.
  const initialMessageIdsRef = useRef<Set<string>>(new Set(helperMessages.map(m => m.id)));
  const prevAgentIdForAnimRef = useRef(agentConfig.id);
  if (agentConfig.id !== prevAgentIdForAnimRef.current) {
    prevAgentIdForAnimRef.current = agentConfig.id;
    initialMessageIdsRef.current = new Set(helperMessages.map(m => m.id));
  }

  // Spacer element at the end of the message list. We inflate it via direct DOM
  // writes (not React state) so it survives re-renders without interfering with
  // the paddingBottom style, which React manages separately.
  const inflationSpacerRef = useRef<HTMLDivElement>(null);

  // Direct ref to the currently-streaming message element, set via JSX ref prop.
  // More reliable than querySelector because React sets refs synchronously
  // during the commit phase, before useEffect fires.
  const streamingElementRef = useRef<HTMLDivElement>(null);

  // Tracks last seen message count so we can detect newly appended messages.
  const prevMsgCountRef = useRef(helperMessages.length);

  // Incremented by onStreamingNewContent (called from StreamingText after each paragraph).
  // Drives the useLayoutEffect below which fires after React commits the new paragraph to the DOM.
  const [streamingTick, setStreamingTick] = useState(0);

  // Stable callback: useCallback with [] so the reference never changes.
  // StreamingText's internal useEffect won't re-run because onNewContent is stable,
  // so its 200ms timer is not disturbed by HelperAgent re-renders.
  const onStreamingNewContent = useCallback(() => {
    setStreamingTick(t => t + 1);
  }, []);

  // Reset scroll position and spacer when navigating to a different agent/workflow.
  // useLayoutEffect fires before paint so there's no flash of the previous scroll position.
  // For newly-created agents, prime the pending-scroll ref so the summary message scrolls to the top.
  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    const spacer = inflationSpacerRef.current;
    if (spacer) spacer.style.height = '0px';
    if (!agentConfig.justCreated) {
      // Normal navigation: reset to bottom and clear any pending justCreated state.
      pendingJustCreatedScrollRef.current = false;
      pendingAnimationAgentIdRef.current = null;
      if (container) container.scrollTop = container.scrollHeight - container.clientHeight;
    }
    // justCreated: the streaming effect below animates the message in and scrolls after.
    // Spacer starts at 0; it will be inflated as needed when the scroll fires.
  }, [agentConfig.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trim excess scroll space when streaming ends so the user can't scroll into empty space.
  // We shrink the spacer by the amount of unused scroll room below the current position,
  // which keeps scrollTop unchanged (no visible jump) but removes the dead zone at the bottom.
  // Guard: don't trim while a scroll-to-top is pending — that would remove the scroll room
  // needed for the target message to reach the top of the viewport.
  useEffect(() => {
    if (streamingMessageId !== null || animatingInMessageId !== null) return;
    if (pendingScrollMessageIdRef.current || pendingJustCreatedScrollRef.current) return;
    const container = messagesContainerRef.current;
    const spacer = inflationSpacerRef.current;
    if (!container || !spacer) return;
    const spacerHeight = parseFloat(spacer.style.height || '0');
    if (spacerHeight === 0) return;
    const excess = container.scrollHeight - container.scrollTop - container.clientHeight;
    spacer.style.height = `${Math.max(0, spacerHeight - excess)}px`;
  }, [streamingMessageId, animatingInMessageId]);

  // Inflate spacer before paint when there's a pending user-message scroll.
  // Mirrors the HomePage pattern: we only ever GROW the spacer here (never reset to 0),
  // so the container's scrollHeight only increases — no clamping, no layout shift.
  // Shrinking happens in the trim-spacer effect when streaming ends.
  useLayoutEffect(() => {
    if (!pendingScrollMessageIdRef.current) return;
    const container = messagesContainerRef.current;
    const spacer = inflationSpacerRef.current;
    if (!container || !spacer) return;
    const currentH = parseFloat(spacer.style.height || '0');
    if (currentH < container.clientHeight) {
      spacer.style.height = `${container.clientHeight}px`;
    }
  }, [helperMessages]);

  // For agents created from the home conversation flow: animate the first assistant message.
  // AI Teammates (DW): show typing indicator briefly, then stream in paragraph-by-paragraph.
  // Plan-mode agents: progressive paragraph fade-in with scroll-to-top.
  useEffect(() => {
    if (!agentWasCreatedInPlanMode) return;
    if (currentPage !== 'build' || !agentConfig.id) return;
    if (hasStreamedSummaryRef.current[agentConfig.id]) return;

    // When justCreated, the creation summary may not have arrived yet. This happens when:
    // (a) helperMessages is empty (was passing [] before), OR
    // (b) helperMessages ends with a user message (now we pass conversation history,
    //     which always ends with the user's last Q&A answer).
    // In either case, mark as pending so the animation fires once the summary arrives.
    const lastHelperMsg = helperMessages.length > 0 ? helperMessages[helperMessages.length - 1] : null;
    if (agentConfig.justCreated && (!lastHelperMsg || lastHelperMsg.role !== 'assistant')) {
      pendingAnimationAgentIdRef.current = agentConfig.id;
      return;
    }

    // Trigger if: still justCreated with messages, OR pending (justCreated was cleared
    // before the summary message arrived, but we noted it above).
    const shouldAnimate = agentConfig.justCreated || pendingAnimationAgentIdRef.current === agentConfig.id;
    if (!shouldAnimate) return;
    if (helperMessages.length === 0) return;

    const lastMsg = helperMessages[helperMessages.length - 1];
    if (lastMsg.role !== 'assistant') return;

    pendingAnimationAgentIdRef.current = null; // clear pending

    hasStreamedSummaryRef.current[agentConfig.id] = true;

    // AI Teammate (DW): stream in the welcome message like a real LLM response.
    // Helper panel starts empty, shows typing indicator, then streams paragraphs.
    if (isDWAgent(agentConfig)) {
      setStreamingMessageId(lastMsg.id);
      animatedProgressivelyIdsRef.current.add(lastMsg.id);

      const paragraphCount = lastMsg.content.split('\n\n').filter(p => p.trim()).length;
      const streamDuration = paragraphCount * 200 + 400;
      setTimeout(() => {
        setStreamingMessageId(null);
      }, streamDuration);
      return;
    }

    // Plan-mode agents: progressive paragraph fade-in with scroll-to-top.
    const paragraphCount = lastMsg.content.split('\n\n').filter(p => p.trim()).length;
    // Header animates at 0ms, paragraphs at 130ms * (i+1). Last paragraph finishes at
    // paragraphCount * 130ms + ~300ms (the animation duration itself).
    const animationDuration = Math.max(paragraphCount * 130 + 400, 600);

    setAnimatingInMessageId(lastMsg.id);

    // Scroll to top immediately — don't wait for the paragraph animation to complete.
    // The message animates its paragraphs in from the already-scrolled position.
    setTimeout(() => {
      const container = messagesContainerRef.current;
      const spacer = inflationSpacerRef.current;
      if (!container) return;
      const el = container.querySelector(`[data-message-id="${lastMsg.id}"]`) as HTMLElement;
      if (!el) return;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const target = container.scrollTop + (elRect.top - containerRect.top) - 16;
      if (target > 0) {
        pendingJustCreatedScrollRef.current = true;
        if (spacer) {
          const maxScroll = container.scrollHeight - container.clientHeight;
          if (target > maxScroll) {
            spacer.style.height = `${parseFloat(spacer.style.height || '0') + (target - maxScroll) + 16}px`;
          }
        }
        container.scrollTo({ top: target, behavior: 'smooth' });
        setTimeout(() => { pendingJustCreatedScrollRef.current = false; }, 600);
      }
    }, 0);

    // Clear animation flag after paragraphs have finished animating in.
    // Record the ID so the outer div doesn't replay animate-slide-up-fade.
    setTimeout(() => {
      animatedProgressivelyIdsRef.current.add(lastMsg.id);
      setAnimatingInMessageId(null);
    }, animationDuration);
  }, [agentWasCreatedInPlanMode, currentPage, agentConfig.id, agentConfig.justCreated, helperMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  // After helperMessages renders and paints, smoothly scroll the user message to the top.
  // Re-inflate the spacer if needed before calling scrollTo — the trim-spacer effect may
  // have reduced it between the layout effect (which inflated it) and now.
  // Offset of 11px aligns user bubble text with the global header agent name baseline.
  useEffect(() => {
    if (!pendingScrollMessageIdRef.current) return;
    const id = pendingScrollMessageIdRef.current;
    pendingScrollMessageIdRef.current = null;
    const container = messagesContainerRef.current;
    const spacer = inflationSpacerRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-message-id="${id}"]`) as HTMLElement;
    if (!el) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const target = container.scrollTop + (elRect.top - containerRect.top) - 11;
    if (target <= 0) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    // Ensure spacer is tall enough for target to be reachable (may have been trimmed).
    if (spacer) {
      const maxScroll = container.scrollHeight - container.clientHeight;
      if (target > maxScroll) {
        spacer.style.height = `${parseFloat(spacer.style.height || '0') + (target - maxScroll) + 16}px`;
      }
    }
    setTimeout(() => {
      container.scrollTo({ top: target, behavior: 'smooth' });
    }, 120);
  }, [helperMessages]);

  // During streaming: after each paragraph is added (streamingTick increments),
  // scroll just enough to keep the bottom of the AI message visible.
  //
  // Why useLayoutEffect: StreamingText calls onNewContent → setStreamingTick in the
  // same synchronous block as setVisibleParagraphs. React batches both, renders once
  // (new paragraph in DOM), then fires useLayoutEffect — all before the browser paints.
  // So we read accurate element dimensions and scroll before the user sees anything.
  //
  // Why not ResizeObserver: the ref was null when the effect ran due to timing
  // between setStreamingMessageId and addHelperMessage. This approach avoids that
  // by triggering through React's own render cycle.
  //
  // overflow-anchor: none on the container disables CSS scroll anchoring, which was
  // the browser auto-increasing scrollTop as content grew — the "pushing up" bug.
  useLayoutEffect(() => {
    if (!streamingMessageId || !streamingElementRef.current) return;
    const container = messagesContainerRef.current;
    const el = streamingElementRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const pb = parseFloat(container.style.paddingBottom) || 0;
    const visibleBottomY = containerRect.bottom - pb;
    if (elRect.bottom > visibleBottomY - 40) {
      container.scrollTop += elRect.bottom - (visibleBottomY - 40);
    }
  }, [streamingTick, streamingMessageId]);

  // Scroll to the top of any new assistant message added programmatically (e.g. autotest
  // summary, grounding gap notice). Skip when streamingMessageId is set — the streaming
  // scroll layout effect handles those. Skip streaming (thinking) messages.
  // Also skip messages that just finished streaming — they were already scrolled into view.
  const lastStreamedMsgRef = useRef<string | null>(null);
  const prevStreamingIdRef = useRef<string | null>(streamingMessageId);
  useEffect(() => {
    const prevStreamId = prevStreamingIdRef.current;
    prevStreamingIdRef.current = streamingMessageId;
    // Track when a streaming message finishes so we can skip re-scrolling it
    if (prevStreamId && !streamingMessageId) {
      lastStreamedMsgRef.current = prevStreamId;
    }
  }, [streamingMessageId]);

  useEffect(() => {
    const count = helperMessages.length;
    const prev = prevMsgCountRef.current;
    prevMsgCountRef.current = count;
    if (count <= prev || streamingMessageId) return;
    const newMsg = helperMessages[count - 1];
    if (!newMsg || newMsg.role !== 'assistant' || newMsg.streaming) return;
    // Skip if this message was just streamed — it's already visible
    if (newMsg.id === lastStreamedMsgRef.current) {
      lastStreamedMsgRef.current = null;
      return;
    }
    requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (!container) return;
      const el = container.querySelector(`[data-message-id="${newMsg.id}"]`) as HTMLElement;
      if (!el) return;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const target = container.scrollTop + (elRect.top - containerRect.top) - 16;
      container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    });
  }, [helperMessages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRunE2ETest = async () => {
    // Clear any leftover streaming messages from a previous hung call before starting.
    removeStreamingMessagesForAgent(agentConfig.id);

    const thinkingId = `e2e-thinking-${Date.now()}`;
    addHelperMessageForAgent(agentConfig.id, {
      id: thinkingId,
      role: 'assistant',
      content: 'Generating scenarios…',
      timestamp: new Date(),
      streaming: true,
    });

    try {
      // Race against a 30-second timeout so the streaming indicator can't hang indefinitely.
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 30_000)
      );
      // Exclude scenarios that recently passed — keeps suggestions fresh
      const instrSlug = (agentConfig.instructions || '').slice(0, 40);
      const recentlyPassed: string[] = (() => {
        try {
          const raw = getAgentStorage(agentConfig.id, 'triggerlab_v7');
          const parsed = raw ? JSON.parse(raw) : null;
          const scenarios: AgentScenario[] | null =
            parsed?.fingerprint === instrSlug && Array.isArray(parsed.scenarios) ? parsed.scenarios : null;
          const oneHourAgo = Date.now() - 60 * 60 * 1000;
          return (scenarios ?? [])
            .filter(s => s.lastRunStatus === 'pass' && s.lastRunAt && s.lastRunAt > oneHourAgo)
            .map(s => s.title);
        } catch { return []; }
      })();
      const scenarios = await Promise.race([
        generateScenarios(agentConfig, recentlyPassed.length > 0 ? recentlyPassed : undefined),
        timeout,
      ]);
      lastScenarioOptionsRef.current = scenarios;
      try { sessionStorage.setItem('last_autotest_scenario_list', JSON.stringify(scenarios)); } catch {}
      setScenarioOptions(scenarios);

      // Post the scenario list as an e2e-* message (gets cleaned up on rerun).
      const list = scenarios.map((s, i) => `${i + 1}. **${s.title}** — ${s.description}`).join('\n');
      // Use a plain timestamp ID (no e2e- prefix) so removeE2EHelperMessages never touches
      // this message — the scenario list is a permanent conversation record.
      const msgId = nextMsgId('scenarios-');
      addHelperMessageForAgent(agentConfig.id, {
        id: msgId,
        role: 'assistant',
        content: `Here are some scenarios to test. Pick one and I'll run it automatically:\n\n${list}`,
        metadata: { suggestions: scenarios.map(s => s.title), scenarios },
        timestamp: new Date(),
      });
      setStreamingMessageId(msgId);
      setTimeout(() => setStreamingMessageId(null), scenarios.length * 120 + 200);
    } catch {
      addHelperMessageForAgent(agentConfig.id, {
        id: `e2e-error-${Date.now()}`,
        role: 'assistant',
        content: "Couldn't generate scenarios right now — try again in a moment.",
        timestamp: new Date(),
      });
    } finally {
      // Always remove the "Generating scenarios…" streaming message, even on failure.
      removeStreamingMessagesForAgent(agentConfig.id);
    }
  };

  const handleScenarioSelect = (scenario: AgentScenario) => {
    try { sessionStorage.setItem('autotest_scenario', JSON.stringify(scenario)); } catch {}
    try { sessionStorage.setItem('last_autotest_scenario', JSON.stringify(scenario)); } catch {}
    setScenarioOptions(null);
    lastScenarioRef.current = scenario;

    // Remove stale e2e artifacts (old confirm, progress, summary) before starting a new
    // test run, but keep the conversation history so the user can scroll up.
    removeStreamingMessagesForAgent(agentConfig.id); // clean up any stuck non-e2e streaming indicator
    removeE2EHelperMessages(agentConfig.id);

    // Check both location.hash (hash-based routing) and currentPage context for robustness.
    const alreadyOnPreview = location.hash.includes('preview') || currentPage === 'preview';
    const confirmId = `e2e-confirm-${agentConfig.id}`;
    const progressId = `e2e-progress-${agentConfig.id}`;
    const confirmContent = alreadyOnPreview
      ? `Running the **${scenario.title}** scenario now.`
      : `Got it — navigating to Preview and running the **${scenario.title}** scenario now.`;
    // Permanent acknowledgment — always visible in the thread (streaming: false).
    // Use a unique ID per run so multiple reruns each get their own message.
    addHelperMessageForAgent(agentConfig.id, {
      id: `${confirmId}-${++_msgIdCounter}`,
      role: 'assistant',
      content: confirmContent,
      timestamp: new Date(),
    });
    // Separate streaming message that drives the CopilotTypingIndicator ("On step X of 5…").
    // Always add fresh — removeE2EHelperMessages above already removed any old progress message
    // via a functional state update. Reading helperMessages here would see stale state (the
    // remove hasn't re-rendered yet), so an update-if-exists check would always find the old
    // message and call updateHelperMessageForAgent, which is a no-op on a removed message.
    addHelperMessageForAgent(agentConfig.id, { id: progressId, role: 'assistant', content: 'Starting…', timestamp: new Date(), streaming: true });
    const ts = Date.now();
    // Write the token BEFORE dispatching the event / navigating so TriggerLab always
    // captures the latest value at the start of its runAutoTest call.
    try { sessionStorage.setItem('active_test_run_token', String(ts)); } catch {}
    if (alreadyOnPreview) {
      // Dispatch directly — bypasses the navigate→searchParams→sessionStorage chain which
      // is unreliable for same-page reruns. TriggerLabPage listens for this event.
      window.dispatchEvent(new CustomEvent('elevate:autotest', {
        detail: { scenario, paramTimestamp: String(ts) },
      }));
    }
    // Always navigate so the URL updates (history, back-button, linkability).
    // The event listener marks the param as handled so the searchParams effect won't double-run.
    navigate(`/preview?autotest=${ts}`);
  };

  const handleSaveEval = useCallback(async (evalData: MessageEval) => {
    const enriched: MessageEval = {
      ...evalData,
      source: 'helper-agent',
      configBefore: configBeforeRef.current,
      configAfter: snapshotConfig(agentConfig),
    };
    try {
      await fetch('/api/evals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enriched),
      });
      setMessageEval(enriched.messageId, enriched);
    } catch (err) {
      console.error('[HelperAgent] Failed to save eval:', err);
    }
  }, [agentConfig, setMessageEval]);

  // Keep ref current so cancel callbacks registered in closures always call the latest version
  const handleSendMessage = async (messageText?: string, forcedChannel?: string, isAutoSubmit?: boolean) => {
    // ── Dexter live mode: bypass Claude, send directly to the real worker ──────
    if (isDexterLive) {
      const text = (messageText ?? input).trim();
      if (!text || dexterIsStreaming) return;
      dexterSendMessage(text);
      setInput('');
      // TODO: Future native CRUD — once Dexter emits structured task/skill/knowledge
      // change events, parse them here and call addDwTask(), addDwKnowledge(), etc.
      return;
    }

    const textToSend = messageText || input;
    // isAutoSubmit (e.g. project page initial prompt) bypasses the isProcessing guard so a
    // stale processing state from a prior page doesn't silently swallow the message.
    if (!textToSend.trim() || (isProcessing && !isAutoSubmit)) return;

    // ── REPAIR / DIAGNOSIS FAST-PATH ─────────────────────────────────────────
    // Detects machine-generated questions from "Repair with Copilot" buttons.
    // Must run FIRST — before fuzzy-create, getHelperResponse, and ALL other
    // intent detection that would misread "test run" as a run-scenario command.
    //
    // Patterns match ONLY the exact templates in askHelperAboutFailure /
    // askHelperAboutKnowledge — no human would type these verbatim:
    //   • 'Why did "…" fail during the "…" test run?'
    //   • 'returned low-relevance results (avg NN%)'
    //   • 'Knowledge retrieval results during this run:'
    const isRepairDiagnosisFast = (
      /Why did ".+" fail during the ".+" test run\?/i.test(textToSend) ||
      /returned low-relevance results \(avg \d+%\)/i.test(textToSend) ||
      /Knowledge retrieval results during this run:/i.test(textToSend)
    );
    if (isRepairDiagnosisFast) {
      const isKnowledgeIssue = /low-relevance results|Knowledge retrieval results during this run:|knowledge source returned/i.test(textToSend);
      const repairUserMsg: Message = {
        id: nextMsgId(),
        role: 'user',
        content: textToSend,
        timestamp: new Date(),
      };
      addHelperMessage(repairUserMsg);
      setInput('');
      setIsProcessing(true);
      const repairAgentId = agentConfig.id;
      const thinkingId = nextMsgId('thinking-');
      addHelperMessageForAgent(repairAgentId, { id: thinkingId, role: 'assistant', content: 'Diagnosing the issue…', timestamp: new Date(), streaming: true });
      try {
        const systemPrompt = isKnowledgeIssue
          ? `You are Copilot Studio, an AI assistant helping agent developers debug knowledge source issues.
The user is reporting that a knowledge source returned low-relevance or empty results during a test scenario.
Respond with:
1. **Most likely cause** — explain in 1-2 sentences why the knowledge source may have returned poor results (e.g. missing documents, wrong scope, query mismatch, stale index).
2. **How to fix it** — give 2-3 specific, actionable steps:
   - What documents or content to add to the knowledge source
   - Whether to update the agent's instructions to be more specific about which source to use
   - Whether to check indexing or connection settings
3. **Quick win** — one immediate thing the developer can try right now.
Keep under 220 words. Reference the specific knowledge source name and scenario from the user's message. Do not rerun tests.`
          : `You are Copilot Studio, an AI assistant helping agent developers debug their agents.
The user is asking about a failed step in a test scenario. Respond with:
1. **Most likely cause** — 1-2 sentences explaining the root cause in plain English.
2. **How to fix it** — 2-3 concrete, actionable steps the developer can take.
3. If relevant, suggest updating the agent's instructions or knowledge sources.
Keep under 200 words. Do not restart or rerun any tests. Do not ask to run a new scenario.`;
        const diagnosisText = await callModel({
          model: 'balanced',
          maxTokens: 600,
          system: systemPrompt,
          messages: [{ role: 'user', content: textToSend }],
        });
        removeStreamingMessagesForAgent(repairAgentId);
        addHelperMessageForAgent(repairAgentId, {
          id: nextMsgId('diagnosis-'),
          role: 'assistant',
          content: diagnosisText,
          metadata: {
            suggestions: isKnowledgeIssue
              ? ['Update instructions', 'Go to Build page', 'Run the test again']
              : ['Update instructions', 'Run the test again', 'Try a different scenario'],
          },
          timestamp: new Date(),
        });
      } catch {
        removeStreamingMessagesForAgent(repairAgentId);
        addHelperMessageForAgent(repairAgentId, { id: nextMsgId('error-'), role: 'assistant', content: 'Unable to diagnose the issue right now. Please try again.', timestamp: new Date() });
      } finally {
        setIsProcessing(false);
      }
      return;
    }
    // ── END REPAIR / DIAGNOSIS FAST-PATH ─────────────────────────────────────

    // ── Fix confirmation: accept / undo / describe-alternative ─────────────────
    if (pendingFixConfirmation) {
      setPendingFixConfirmation(false);
      setInput('');
      const trimmed = textToSend.trim();

      if (trimmed === 'Keep this change') {
        // User keeps the fix — add a brief exchange and stop
        addHelperMessageForAgent(agentConfig.id, { id: nextMsgId(), role: 'user', content: textToSend, timestamp: new Date() });
        addHelperMessageForAgent(agentConfig.id, {
          id: nextMsgId(), role: 'assistant', content: 'Your instructions are updated — looks good!',
          timestamp: new Date(),
          metadata: { suggestions: ['Test it now', 'What else needs fixing?'] },
        });
        commitSave();
        return;
      }

      if (trimmed === 'Undo') {
        undo();
        addHelperMessageForAgent(agentConfig.id, { id: nextMsgId(), role: 'user', content: textToSend, timestamp: new Date() });
        addHelperMessageForAgent(agentConfig.id, {
          id: nextMsgId(), role: 'assistant',
          content: 'No problem — rolled back. Your instructions are back to the original. What would you like to try instead?',
          timestamp: new Date(),
          metadata: { suggestions: ['Try a different approach', 'Show all issues'] },
        });
        return;
      }

      // User typed something else — treat as follow-up to the LLM with the fix context preserved
      // (fall through to normal send so they can describe what they want instead)
    }

    // ── Direct fix application — "Apply fix: <resource>" chip ──────────────────
    // Applies the deterministic instruction replacement without going through the LLM.
    if (textToSend.startsWith('Apply fix: ')) {
      const resourceName = textToSend.slice('Apply fix: '.length).trim();
      const err = SIMULATED_ERRORS.find(e => e.affectedResource === resourceName && e.fix?.type === 'instruction_replace');
      if (err?.fix) {
        const currentInstructions = agentConfig.instructions || '';
        const fixedInstructions = currentInstructions.replace(err.fix.find, err.fix.replace);
        if (fixedInstructions !== currentInstructions) {
          setInput('');
          addHelperMessageForAgent(agentConfig.id, { id: nextMsgId(), role: 'user', content: textToSend, timestamp: new Date() });
          addHelperMessageForAgent(agentConfig.id, {
            id: nextMsgId(), role: 'assistant',
            content: `On it — I'm updating the **${err.affectedResource}** step in your instructions now.`,
            timestamp: new Date(),
          });
          takeSnapshot(agentConfig.id);
          setStreamingInstructions(agentConfig.id, fixedInstructions);
          setIsApplyingErrorFix(true);
          resolveSimulatedError(err.id);
          return;
        }
      }
    }


    // If there's an active node quote, build enriched LLM text (but display just what the user typed)
    let llmTextToSend = textToSend;
    const activeNodeQuote = nodeQuote;
    // Detect activity-summary type before potentially clearing the quote
    const isActivitySummary = !messageText && activeNodeQuote?.type === 'activity-summary';
    if (activeNodeQuote) {
      if (!messageText) {
        // Only enrich LLM text for user-typed messages (not programmatic sends)
        if (activeNodeQuote.type === 'activity-summary') {
          const contextPart = activeNodeQuote.context ? ` Activity data: ${activeNodeQuote.context}` : '';
          llmTextToSend = `[Context: agent activity summary for "${activeNodeQuote.label}".${contextPart}] ${textToSend}`;
        } else {
          const typeLabel = activeNodeQuote.type === 'knowledge' ? 'knowledge source' : activeNodeQuote.type;
          const errorPart = activeNodeQuote.errorTitle
            ? ` with error "${activeNodeQuote.errorTitle}${activeNodeQuote.error ? ': ' + activeNodeQuote.error : ''}"`
            : '';
          // Use rich context if available (Point to Ask), otherwise fall back to basic context
          if (activeNodeQuote.context) {
            llmTextToSend = `${activeNodeQuote.context} ${textToSend}`;
          } else {
            llmTextToSend = `[Context: ${typeLabel} "${activeNodeQuote.label}"${errorPart}] ${textToSend}`;
          }
        }
      }
      // Always dismiss the quote chip when a message is sent, regardless of how send was triggered
      setNodeQuote(null);
    }


    const userMessageId = nextMsgId();
    // Publish eval-gate responses ("Skip and continue", "Run eval now") are UI continuation
    // actions, not conversational turns — suppress the user bubble so the checklist just
    // resumes without a visible chip echo in the chat.
    const isPublishEvalGateResponse = !!pendingPublishEvalDecisionRef.current
      && (SKIP_EVAL_RE.test(textToSend.trim()) || RUN_EVAL_NOW_RE.test(textToSend.trim()));
    const userMessage: Message = {
      id: userMessageId,
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
      ...(isAutoSubmit || isPublishEvalGateResponse ? { hidden: true } : {}),
      // Only persist the chip when the question was auto-sent (not typed by the user),
      // so the chip in history reflects the exact canonical question, not an edited variant.
      ...(activeNodeQuote && !messageText ? { metadata: { nodeQuote: activeNodeQuote } } : {}),
    };

    // Short-circuit: "stop" → cancel the running test immediately
    const trimmedInput = textToSend.trim().toLowerCase();
    if (/^stop$|^stop the test$/i.test(textToSend.trim())) {
      setInput('');
      addHelperMessage(userMessage);
      pendingFixRef.current = null;
      // Supersede any running autotest by writing a new token
      try { sessionStorage.setItem('active_test_run_token', `cancelled-${Date.now()}`); } catch {}
      window.dispatchEvent(new CustomEvent('elevate:stop-test'));
      // Clean up the "Running simulation" streaming message
      removeStreamingMessagesForAgent(agentConfig.id);
      removeE2EHelperMessages(agentConfig.id);
      addHelperMessageForAgent(agentConfig.id, {
        id: nextMsgId('stop-'),
        role: 'assistant',
        content: 'Stopped. What would you like to do next?',
        metadata: { suggestions: ['Run the test again', 'Try a different scenario'] },
        timestamp: new Date(),
      });
      return;
    }

    // Short-circuit: "Run the test again" / "rerun" → go directly to the last scenario
    // without hitting the LLM. Clear any pending fix so it doesn't interfere.
    if (lastScenarioRef.current && /^run the test again$|^rerun$/i.test(textToSend.trim())) {
      setInput('');
      addHelperMessage(userMessage);
      pendingFixRef.current = null;
      handleScenarioSelect(lastScenarioRef.current);
      return;
    }

    // Handle pending fix confirmation
    if (pendingFixRef.current && (trimmedInput.includes('confirm') || trimmedInput.includes('update instructions') || trimmedInput === 'cancel' || trimmedInput === 'skip')) {
      setInput('');
      addHelperMessage(userMessage);

      if (trimmedInput === 'cancel' || trimmedInput === 'skip') {
        pendingFixRef.current = null;
        addHelperMessageForAgent(agentConfig.id, {
          id: nextMsgId(),
          role: 'assistant',
          content: 'No changes made to the instructions.',
          metadata: { suggestions: ['Run the test again', 'Try a different scenario'] },
          timestamp: new Date(),
        });
        return;
      }

      // Apply the pending fix
      const { updates, rerun, description } = pendingFixRef.current;
      const wantsRerun = rerun || trimmedInput.includes('retest') || trimmedInput.includes('rerun');
      console.log('🔧 Confirming pending fix', { instructionLength: updates.instructions?.length, rerun: wantsRerun });

      captureReview(agentConfig.id);
      takeSnapshot(agentConfig.id);
      updateSpecificAgent(agentConfig.id, updates);
      pendingFixRef.current = null;

      // Reuse the LLM's proposal description as the confirmation summary —
      // it's already a clean, human-readable explanation of what changed.
      // Strip any "Here's what I'll update..." framing we added during the proposal step.
      const cleanDesc = description
        .replace(/^here'?s what I'?[lm]l?\s+(update|changing?)\s+(in\s+)?your\s+agent'?s\s+instructions[:\s]*/i, '')
        .replace(/\n\nshould I .*/i, '')
        .trim();
      const suffix = wantsRerun ? '\n\nRerunning the scenario now to verify.' : '';
      const confirmContent = `Updated your agent's instructions. Here's what changed:\n\n${cleanDesc}${suffix}`;

      addHelperMessageForAgent(agentConfig.id, {
        id: nextMsgId(),
        role: 'assistant',
        content: confirmContent,
        metadata: { suggestions: wantsRerun ? undefined : ['Run the test again', 'Try a different scenario'] },
        timestamp: new Date(),
      });

      if (wantsRerun && lastScenarioRef.current) {
        const scenario = lastScenarioRef.current;
        setTimeout(() => handleScenarioSelect(scenario), 500);
      }
      return;
    }

    // If scenario options are showing (or were recently shown), match by exact title OR by number.
    // Falls back to lastScenarioOptionsRef, then to scenarios embedded in message history so the
    // shortcut keeps working even after navigation / session restart clears the ref.
    let activeScenarios: typeof scenarioOptions =
      scenarioOptions ?? (lastScenarioOptionsRef.current.length > 0 ? lastScenarioOptionsRef.current : null);
    if (!activeScenarios) {
      // Recover from the most recent scenario-list message in chat history
      const lastListMsg = [...helperMessages].reverse().find(
        m => m.role === 'assistant' && Array.isArray(m.metadata?.scenarios) && (m.metadata!.scenarios as unknown[]).length > 0
      );
      if (lastListMsg) {
        const recovered = lastListMsg.metadata!.scenarios as typeof scenarioOptions;
        lastScenarioOptionsRef.current = recovered!;
        activeScenarios = recovered;
      }
    }
    if (activeScenarios) {
      const trimmed = textToSend.trim();
      const numMatch = trimmed.match(/\b(\d+)\b/);
      const byNum = numMatch ? activeScenarios[parseInt(numMatch[1]) - 1] : undefined;
      const byTitle = activeScenarios.find(s => s.title.toLowerCase() === trimmed.toLowerCase());
      const match = byTitle ?? byNum;
      if (match) {
        setInput('');
        pendingScrollMessageIdRef.current = userMessageId;
        addHelperMessage(userMessage);
        handleScenarioSelect(match);
        return;
      }
    }

    // Spacer is inflated in the useLayoutEffect below (after state update, before paint),
    // mirroring the HomePage pattern. This avoids the layout shift caused by the old
    // reset-then-inflate approach.
    pendingScrollMessageIdRef.current = userMessageId;
    addHelperMessage(userMessage);
    setInput('');
    setIsProcessing(true);
    // Snapshot config before this turn — captured as configBefore when the user rates the response
    configBeforeRef.current = snapshotConfig(agentConfig);

    // CRITICAL: Capture BOTH agent ID AND instructions at the start to prevent race conditions
    const targetAgentId = agentConfig.id;
    // On the project page, messages are stored under '__project__' — not the current agent id.
    // Use messageKey for all addHelperMessageForAgent / removeStreamingMessagesForAgent calls,
    // but keep targetAgentId for agent config mutations (takeSnapshot, updateSpecificAgent, etc.).
    const messageKey = currentPage === 'project' ? '__project__' : targetAgentId;
    const originalInstructions = getLatestInstructions(targetAgentId) ?? agentConfig.instructions ?? '';

    // Day-0: first user message for a newly created agent — generate a name + description
    // from the user's prompt. Result is held in a ref and applied when instructions arrive
    // so the name and instructions appear together.
    // helperMessages already includes the user message we just added (line 792),
    // so "first user message" means exactly 1 user message in the list.
    const isFirstUserMessage = helperMessages.filter(m => m.role === 'user').length <= 1;
    const isDay0Agent = agentConfig.justCreated || (agentConfig.createdWithPlanMode && !agentConfig.instructions);
    if (isFirstUserMessage && isDay0Agent && !isDWAgent(agentConfig)) {
      callModel({
        model: 'fast',
        maxTokens: 120,
        system: 'Generate a short agent name (2-4 words, no quotes) and a one-sentence description based on the user\'s request. Respond in exactly this JSON format: {"name": "...", "description": "..."}',
        messages: [{ role: 'user', content: textToSend }],
      }).then(raw => {
        try {
          const cleaned = raw.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
          const { name, description } = JSON.parse(cleaned);
          if (name && description) {
            pendingDay0NameRef.current = { agentId: targetAgentId, name, description };
          }
        } catch { /* ignore parse failures */ }
      }).catch(() => { /* ignore */ });

      // If audience hasn't been set yet (e.g. created via the generic "Agent" tile),
      // classify from the user's first message so the system can determine DA vs CA.
      if (!agentConfig.audience && !isWorkflowAgent(agentConfig)) {
        const classification = classifyIntentLocally(textToSend);
        if (classification.audience && classification.audience !== 'customers') {
          updateSpecificAgent(targetAgentId, { audience: classification.audience as 'employees' | 'personal' });
        }
      }
    }

    // Guard: if the message looks like a scenario number command ("do 1", "run 2", bare "3")
    // but slipped past the activeScenarios shortcut above, block the LLM entirely.
    // Without this, the LLM fabricates fake test summaries instead of running the actual test.
    const looksLikeScenarioNumber =
      /^(?:do|run)(?:\s+(?:number|scenario|test))?\s+#?\d+$/i.test(textToSend.trim()) ||
      /^#?\d+$/.test(textToSend.trim());
    if (looksLikeScenarioNumber) {
      const msg = activeScenarios
        ? `That number isn't on the list. Pick a number between 1 and ${activeScenarios.length}.`
        : `The scenario list is no longer available. Try **"Run an E2E test"** to generate a fresh list.`;
      addHelperMessageForAgent(messageKey, {
        id: nextMsgId('assistant-'),
        role: 'assistant',
        content: msg,
        timestamp: new Date(),
        metadata: { suggestions: ['Run an E2E test'] },
      });
      setIsProcessing(false);
      return;
    }

    // ── ACTIVITY SUMMARY FLOW ────────────────────────────────────────────────
    if (isActivitySummary) {
      const thinkingId = nextMsgId('thinking-');
      addHelperMessageForAgent(messageKey, { id: thinkingId, role: 'assistant', content: 'Analyzing activity...', timestamp: new Date(), streaming: true });
      try {
        const summaryText = await callModel({
          model: 'balanced',
          maxTokens: 600,
          system: `You are Copilot Studio, an AI assistant helping agent developers understand their agent's run history.
When given activity data, respond with a brief digest:
1. **Overview** — 1-2 sentences on overall health (total runs, success rate).
2. **Errors** — for each distinct error (if any), explain in plain English and give 1-2 fix steps.
3. End with a "Learn more" link only if errors exist: [Learn more: Troubleshooting agents](https://learn.microsoft.com/en-us/microsoft-copilot-studio/error-codes)
Keep the whole response under 200 words. Do not ask questions. Do not suggest creating new agents.`,
          messages: [{ role: 'user', content: llmTextToSend }],
        });
        removeStreamingMessagesForAgent(messageKey);
        addHelperMessageForAgent(messageKey, { id: nextMsgId('summary-'), role: 'assistant', content: summaryText, timestamp: new Date() });
      } catch (err) {
        console.error('[HelperAgent] Activity summary failed:', err);
        removeStreamingMessagesForAgent(messageKey);
        addHelperMessageForAgent(messageKey, { id: nextMsgId('error-'), role: 'assistant', content: 'Unable to summarize activity right now. Please try again.', timestamp: new Date() });
      } finally {
        setIsProcessing(false);
      }
      return;
    }
    // ── END ACTIVITY SUMMARY FLOW ─────────────────────────────────────────────

    // ── FUZZY CREATE FLOW ────────────────────────────────────────────────────
    // Only enter fuzzy create on build/home pages. Agents on preview/evaluate/monitor
    // are past creation — skip even if isFuzzyComplete was never backfilled.
    // Note: type !== 'workflow' guard was intentionally removed — isFuzzyComplete is set
    // on the same turn that type becomes 'workflow', so the guard was redundant and
    // was causing the flow to exit before all goals were achieved.
    if (!agentWasCreatedInPlanMode && !agentConfig.isFuzzyComplete && (currentPage === 'build' || currentPage === 'home')) {
      // Handle pending DW confirm answer before forwarding to the LLM
      if (isDwConfirmPendingRef.current) {
        isDwConfirmPendingRef.current = false;
        const isYes = textToSend.toLowerCase().includes('yes');
        if (isYes) {
          openDwCreateDialog(() => {
            isDwConfirmPendingRef.current = false;
            handleSendMessageRef.current?.('I changed my mind');
          });
          setIsProcessing(false);
          return;
        }
        // "No" — fall through so the LLM sees the answer in conversation history
      }

      try {
        // Build full history: stored messages + the new user message we just added
        // (helperMessages state hasn't re-rendered yet so we append textToSend manually)
        const conversationHistory = [
          ...helperMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user' as const, content: textToSend },
        ];

        const thinkingId = nextMsgId('thinking-');
        addHelperMessageForAgent(messageKey, {
          id: thinkingId,
          role: 'assistant',
          content: 'Understanding your needs…',
          timestamp: new Date(),
          streaming: true,
        });

        const fuzzyResponse = await getFuzzyAgentResponse(conversationHistory, lastFuzzyGoalsRef.current ?? agentConfig.fuzzyGoals ?? undefined);
        lastFuzzyGoalsRef.current = fuzzyResponse.goals;
        // Persist so the ref can be re-seeded after remounts
        updateSpecificAgent(targetAgentId, { fuzzyGoals: fuzzyResponse.goals });

        // If a trigger was forced (e.g. from trigger card selection), inject it into goals
        // so allGoalsAchieved and downstream logic all see the correct trigger value.
        if (forcedChannel && !fuzzyResponse.goals.trigger) {
          fuzzyResponse.goals.trigger = forcedChannel;
          fuzzyResponse.allGoalsAchieved =
            fuzzyResponse.goals.creationType !== null &&
            fuzzyResponse.goals.name !== null &&
            fuzzyResponse.goals.description !== null &&
            fuzzyResponse.goals.brief !== null &&
            (fuzzyResponse.goals.creationType !== 'workflow' || fuzzyResponse.goals.trigger !== null) &&
            fuzzyResponse.goals.intentIsClear;
        }

        // DW intent detected — show confirming question, set flag, stop processing
        if (fuzzyResponse.isDWIntent && !fuzzyResponse.allGoalsAchieved) {
          isDwConfirmPendingRef.current = true;
          removeStreamingMessagesForAgent(messageKey);
          addHelperMessageForAgent(messageKey, {
            id: nextMsgId('dw-confirm-'),
            role: 'assistant',
            content: fuzzyResponse.content,
            timestamp: new Date(),
            metadata: { suggestions: ["Yes, create an AI Teammate", "No"] },
          });
          setIsProcessing(false);
          return;
        }

        removeStreamingMessagesForAgent(messageKey);
        const { goals } = fuzzyResponse;
        const requiredGoalValues = goals.creationType === 'workflow'
          ? [goals.creationType, goals.trigger, goals.name, goals.description, goals.brief, goals.intentIsClear || null]
          : [goals.creationType, goals.name, goals.description, goals.brief, goals.intentIsClear || null];
        const achieved = requiredGoalValues.filter(g => g !== null).length;
        console.log(`[🍹FuzzyAgent] Goals ${achieved}/${requiredGoalValues.length}:`, goals);

        // Apply all resolved goals to the agent config on every turn
        const configUpdates: Record<string, any> = {};
        if (fuzzyResponse.goals.creationType !== null) {
          const resolvedType = fuzzyResponse.goals.creationType === 'workflow' ? 'workflow' : 'agent';
          if (resolvedType !== agentConfig.type) {
            configUpdates.type = resolvedType;
            if (resolvedType === 'workflow') configUpdates.workflowNodes = [];
          }
        }
        if (fuzzyResponse.goals.name) {
          configUpdates.name = fuzzyResponse.goals.name;
          // Auto-generate email for existing DW agents when name is set
          if (isDWAgent(agentConfig)) {
            const emailName = fuzzyResponse.goals.name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
            configUpdates.email = `${emailName}@contoso.com`;
          }
        }
        if (fuzzyResponse.goals.description) configUpdates.description = fuzzyResponse.goals.description;
        if (fuzzyResponse.goals.audience) configUpdates.audience = fuzzyResponse.goals.audience;
        if (fuzzyResponse.goals.creationType === 'agent') {
          configUpdates.agentType = 'DA';
          configUpdates.channel = 'microsoft 365';
        }
        // Track whether we need to stream instructions separately
        let fuzzyInstructionsToStream: string | null = null;
        if (fuzzyResponse.goals.creationType === 'agent') {
          if (fuzzyResponse.goals.instructions) {
            const normalized = normalizeBullets(fuzzyResponse.goals.instructions);
            // Stream instructions if this is the first time they're set (not already on the agent)
            if (!agentConfig.instructions) {
              fuzzyInstructionsToStream = normalized;
            } else {
              configUpdates.instructions = normalized;
            }
          }
          if (fuzzyResponse.goals.capabilities) {
            // Preserve any file-upload capabilities (ref- prefix) already on the agent
            const existingFileCaps = (agentConfig.capabilities || []).filter(
              (c: any) => c.id && typeof c.id === 'string' && c.id.startsWith('ref-')
            );
            configUpdates.capabilities = [...existingFileCaps, ...fuzzyResponse.goals.capabilities];
          }
        }
        // Synchronous icon selection — include in the same update so it arrives with name
        const agentName = configUpdates.name || agentConfig.name;
        const agentDesc = configUpdates.description || agentConfig.description || '';
        if (agentName && !agentConfig.systemColorIcon) {
          const iconKey = matchSystemColorIcon(`${agentName} ${agentDesc}`);
          if (iconKey !== 'agents') {
            configUpdates.systemColorIcon = iconKey;
          }
        }

        if (Object.keys(configUpdates).length > 0 || fuzzyInstructionsToStream) {
          // Mirror the regular HA path: push an undo snapshot and activate review highlights.
          if (!!configUpdates.instructions || fuzzyInstructionsToStream || isAgentGlobalUndo) {
            captureReview(targetAgentId);
            takeSnapshot(targetAgentId);
          }
          if (Object.keys(configUpdates).length > 0) {
            updateSpecificAgent(targetAgentId, configUpdates);
          }
          // Stream instructions via the build page animation instead of setting directly
          if (fuzzyInstructionsToStream) {
            setStreamingInstructions(targetAgentId, fuzzyInstructionsToStream);
          }
        }

        const currentWorkflowNodes = latestAgentConfigRef.current.workflowNodes;
        const isWorkflow = fuzzyResponse.goals.creationType === 'workflow';
        const resolvedTrigger = forcedChannel ?? fuzzyResponse.goals.trigger;

        // First-time generation: only when nodes are empty
        if (fuzzyResponse.goals.brief && isWorkflow && !currentWorkflowNodes?.length) {
          setGeneratingWorkflowAgentId(targetAgentId);
          generateWorkflowNodes(fuzzyResponse.goals.brief, fuzzyResponse.goals.name || '', resolvedTrigger)
            .then(nodes => {
              updateSpecificAgent(targetAgentId, { workflowNodes: nodes });
              setGeneratingWorkflowAgentId(null);
            })
            .catch(err => {
              console.error('[🍹FuzzyAgent] Workflow generation failed:', err);
              setGeneratingWorkflowAgentId(null);
            });
        }
        // Trigger just became known and first node is still a placeholder — replace trigger only
        else if (
          fuzzyResponse.goals.brief && isWorkflow &&
          resolvedTrigger && resolvedTrigger.trim() &&
          currentWorkflowNodes?.[0]?.placeholder === true
        ) {
          setGeneratingWorkflowAgentId(targetAgentId);
          generateTriggerNode(fuzzyResponse.goals.brief, resolvedTrigger)
            .then(triggerNode => {
              updateSpecificAgent(targetAgentId, {
                workflowNodes: [triggerNode, ...(currentWorkflowNodes.slice(1))],
              });
              setGeneratingWorkflowAgentId(null);
            })
            .catch(err => {
              console.error('[🍹FuzzyAgent] Trigger replacement failed:', err);
              setGeneratingWorkflowAgentId(null);
            });
        }

        if (fuzzyResponse.allGoalsAchieved) {
          // All goals met — display wrap-up directly from the LLM response
          console.log('[🍹FuzzyAgent] ALL GOALS ACHIEVED — generating wrap-up');
          updateSpecificAgent(targetAgentId, { isFuzzyComplete: true });

          const { goals } = fuzzyResponse;

          const wrapUpId = nextMsgId('assistant-wrapup-');
          setStreamingMessageId(wrapUpId);
          addHelperMessageForAgent(messageKey, {
            id: wrapUpId,
            role: 'assistant',
            content: fuzzyResponse.content,
            timestamp: new Date(),
            metadata: fuzzyResponse.suggestions.length > 0 ? { suggestions: fuzzyResponse.suggestions } : undefined,
          });
          setTimeout(() => setStreamingMessageId(null), 600);

          // Auto-enable Work IQ if the completed agent has M365/work signals
          maybeAutoEnableWorkIQ({
            name: goals.name ?? undefined,
            description: goals.description ?? undefined,
            instructions: goals.instructions ?? undefined,
            channel: goals.creationType === 'agent' ? 'microsoft 365' : undefined,
          });
        } else {
          const messageId = nextMsgId('assistant-');
          setStreamingMessageId(messageId);
          addHelperMessageForAgent(messageKey, {
            id: messageId,
            role: 'assistant',
            content: fuzzyResponse.content,
            timestamp: new Date(),
            metadata: fuzzyResponse.suggestions.length > 0
              ? (fuzzyResponse.cardType === 'trigger-card'
                  ? { type: 'trigger-selection' as const, suggestions: fuzzyResponse.suggestions }
                  : { suggestions: fuzzyResponse.suggestions })
              : undefined,
          });
          const paragraphCount = fuzzyResponse.content.split('\n\n').filter(p => p.trim()).length;
          setTimeout(() => setStreamingMessageId(null), Math.max(paragraphCount * 200 + 100, 400));
        }
      } catch (error) {
        console.error('[FuzzyAgent] handleSendMessage error:', error);
        removeStreamingMessagesForAgent(messageKey);
        addHelperMessageForAgent(messageKey, {
          id: nextMsgId('error-'),
          role: 'assistant',
          content: "Something went wrong. Please try again.",
          timestamp: new Date(),
        });
      } finally {
        commitSave();
        setIsProcessing(false);
      }
      return;
    }
    // ── END FUZZY CREATE FLOW ────────────────────────────────────────────────


    const startPublishChecklist = (
      publishAgent: typeof agentConfig,
      contextOverrides: Partial<PublishCheckContext> = {},
      resume?: PublishChecklistResumeState,
    ) => {
      const capturedAgentId = targetAgentId;
      const capturedAgentName = publishAgent.name;
      const capturedChannel = publishAgent.channel;

      publishInFlightRef.current = true;

      return runPublishChecklist(
        publishAgent,
        capturedAgentId,
        publishScenario as ScenarioId,
        {
          addMessage: addHelperMessageForAgent,
          updateMessage: updateHelperMessageForAgent,
          markPublished: () => {
            const publishUpdate = { published: true, lastPublishedAt: new Date() };
            isAgentGlobalUndo ? updateWithHistory(publishUpdate) : updateAgentConfig(publishUpdate);
          },
          markPendingApproval: () => {
            const triggerDistributionEntries = Object.entries(publishAgent.triggerDistribution ?? {});
            if (triggerDistributionEntries.length === 0) return;

            const hasPendingApproval = triggerDistributionEntries.some(([, options]) => options.everyone && !options.approved);
            if (!hasPendingApproval) return;

            const triggerDistribution = Object.fromEntries(
              triggerDistributionEntries.map(([channel, options]) => [
                channel,
                options.everyone && !options.approved ? { ...options, submitted: true } : options,
              ]),
            );

            const approvalUpdate = { triggerDistribution };
            isAgentGlobalUndo ? updateWithHistory(approvalUpdate) : updateAgentConfig(approvalUpdate);
          },
          composeSuccessMessage: () => composePostPublishMessage(
            capturedAgentName,
            capturedChannel,
            { agentId: capturedAgentId, agentName: capturedAgentName },
          ),
        },
        {
          previewMessages,
          evaluations,
          messageEvals,
          ...contextOverrides,
        },
        resume,
      ).then((result) => {
        pendingPublishEvalDecisionRef.current = result.paused && result.pendingAction?.type === 'ask-run-eval'
          ? { agentId: capturedAgentId, resumeState: result.resumeState }
          : null;
        return result;
      }).finally(() => {
        publishInFlightRef.current = false;
      });
    };

    if (pendingPublishEvalDecisionRef.current?.agentId === targetAgentId) {
      if (SKIP_EVAL_RE.test(textToSend.trim())) {
        const baseResume = pendingPublishEvalDecisionRef.current?.resumeState;
        const resume = baseResume ? { ...baseResume, resumeNote: 'Skipping eval — continuing with the remaining checks.' } : undefined;
        pendingPublishEvalDecisionRef.current = null;
        setIsProcessing(false);
        startPublishChecklist(latestAgentConfigRef.current, { validationDecision: 'skip-eval' }, resume).catch((err) => {
          console.error('[PublishChecklist] runner failed after skip:', err);
          addHelperMessageForAgent(messageKey, {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Something went wrong while continuing publish checks. Please try again.',
            timestamp: new Date(),
          });
        });
        return;
      }

      if (RUN_EVAL_NOW_RE.test(textToSend.trim())) {
        const resume = pendingPublishEvalDecisionRef.current?.resumeState;
        pendingPublishEvalDecisionRef.current = null;
        setIsProcessing(false);
        // Arm the in-flight guard immediately so a second "publish" message during the
        // eval generation window (potentially 1-3 min) cannot start a parallel checklist.
        publishInFlightRef.current = true;

        // Show acknowledgment inline inside the existing checklist message
        if (resume?.messageId) {
          updateHelperMessageForAgent(messageKey, resume.messageId, {
            metadata: {
              isThinking: true,
              thinkingText: 'Running a quick eval...',
              publishBlocks: resume.publishBlocks,
              publishOutcome: undefined,
              suggestions: [],
            },
          });
        }

        const snapshotSourceAgent = { ...latestAgentConfigRef.current };
        const lifecycleStage: SnapshotLifecycleStage = snapshotSourceAgent.published ? 'published' : 'in-progress';
        const snapshotAgentConfig = { ...snapshotSourceAgent } as AgentSnapshot['agentConfig'];

        generateSnapshotSection(
          'evaluations',
          'Generate a quick publish-readiness eval focused on the agent\'s current behavior and highest-risk paths.',
          snapshotAgentConfig,
          lifecycleStage,
        ).then((generated) => {
          const freshEvals = (generated as Evaluation[]).map((evaluation) => ({
            ...evaluation,
            id: evaluation.id || crypto.randomUUID(),
            runDate: new Date(),
          }));

          freshEvals.forEach(addEvaluation);

          startPublishChecklist(latestAgentConfigRef.current, {
            evaluations: [...evaluations, ...freshEvals],
          }, resume ? { ...resume, resumeNote: 'Eval done — continuing with the remaining checks.' } : resume).catch((err) => {
            console.error('[PublishChecklist] runner failed after generated eval:', err);
            addHelperMessageForAgent(messageKey, {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: 'Something went wrong while continuing publish checks after the eval. Please try again.',
              timestamp: new Date(),
            });
          });
        }).catch((err) => {
          console.error('[PublishChecklist] generated eval failed:', err);
          publishInFlightRef.current = false;  // Release guard so user can retry
          addHelperMessageForAgent(messageKey, {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'I could not run the quick eval right now. You can say "Skip and continue" to keep publishing, or try again.',
            timestamp: new Date(),
            metadata: { suggestions: ['Run eval now', 'Skip and continue'] },
          });
          pendingPublishEvalDecisionRef.current = { agentId: targetAgentId, resumeState: resume };
        });
        return;
      }
    }

    // ── PUBLISH VIA HA FLOW ──────────────────────────────────────────────────
    if (isPublishHAEnabled && shouldStartPublishChecklist(textToSend)) {
      // Prevent double-publish if the runner is already in flight
      if (publishInFlightRef.current) return;

      // Turn off processing — the runner's inline spinners show progress
      setIsProcessing(false);

      startPublishChecklist(agentConfig).catch((err) => {
        console.error('[PublishChecklist] runner failed:', err);
        addHelperMessageForAgent(messageKey, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Something went wrong while running publish checks. Please try again.',
          timestamp: new Date(),
        });
      });

      return;
    }
    // ── END PUBLISH VIA HA FLOW ──────────────────────────────────────────────


    try {
      // Build conversation history for API (exclude streaming/transient messages
      // like "Thinking…" and "Starting…" which are internal UI state, not real turns)
      const conversationHistory = helperMessages.filter(m => !m.streaming).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const errorContext = isAgentErrorSimulation ? buildSimulatedErrorContext(activeErrors) : undefined;
      // Day-0: prepend a directive so the LLM acts immediately instead of asking
      // follow-up questions. Workflow and agent have separate directives.
      // NOTE: day0Prefix is still built inline here because it depends on runtime state
      // (isFirstUserMessage, isDay0Agent, workflowNodes) that isn't available to strategies.
      // Intentionally left inline — documented as "not yet extracted" in the P5 commit message.
      const isWorkflowDay0 = currentPage !== 'project' && isFirstUserMessage && isDay0Agent && isWorkflowAgent(agentConfig)
        && (!agentConfig.workflowNodes || agentConfig.workflowNodes.length <= 1);
      const day0Prefix = isWorkflowDay0
        ? '[SYSTEM: This is the user\'s first message describing the workflow they want to build. Act immediately — do NOT ask clarifying questions first. Do all of the following in a single response:\n1. Scaffold the complete workflow by emitting one ADD_NODE marker per step (trigger + all major steps). Use realistic placeholder labels. Use "insertAfter" to chain them in order.\n2. In your visible reply, briefly describe what you built in 2–3 plain-language sentences — name the steps. Then ask: "Want me to go through each step to fill in the details, or is there a specific step you\'d like to start with?"\n3. Keep the visible reply short — the canvas does the heavy lifting.]\n\n'
        : currentPage !== 'project' && isFirstUserMessage && isDay0Agent && !isDWAgent(agentConfig)
          ? '[SYSTEM: This is the user\'s first message describing what they want the agent to do. Act immediately — do NOT ask follow-up questions. Do all of the following in a single response:\n1. Write complete instructions using [REPLACE:INSTRUCTIONS]. Use your best judgment to fill in details. Reference any relevant tools/triggers/knowledge inline using [[pill]] syntax.\n2. For each tool, trigger, or knowledge source referenced in the instructions, emit a matching [ADD:CAPABILITY:type:name][/ADD:CAPABILITY] marker so it appears in the components list. Only add capabilities that are directly relevant — do not add generic or placeholder ones.\n3. In your visible response, be warm and conversational — like a helpful colleague, not a technical report. Walk the user through what you built for them in plain language. Highlight 2-3 things you think they\'ll like about how the agent is set up. End with a friendly question about what they\'d like to tweak or do next. Keep it short — 3-4 sentences max.]\n\n'
          : '';
      // Pass DW context (tasks, knowledge, skills) only for DW agents — strategy delegates the check
      const dwContext = isDWAgent(agentConfig) ? { dwTasks, dwKnowledge, skills } : undefined;
      const response = await getHelperResponse(
        day0Prefix + llmTextToSend, currentPage, agentConfig, conversationHistory,
        lastScenarioRef.current?.title,
        isSkillsEnabled,
        isPointToAsk,
        dwContext,
        errorContext
      );

      // Apply any config updates to the SPECIFIC target agent (not the currently viewed agent)
      // Project page: skip all agent config updates — there's no real agent being configured here.
      let snapshotTaken = false;
      if (response.updates && currentPage !== 'project') {
        // Handle instruction replacement or appending correctly
        const updatesToApply = { ...response.updates };

        if (updatesToApply.instructions && updatesToApply.instructions.startsWith('__REPLACE__')) {
          // Remove the prefix marker and use the new instructions directly (complete replacement)
          const newContent = updatesToApply.instructions.substring('__REPLACE__'.length);
          updatesToApply.instructions = normalizeBullets(newContent);
        } else if (updatesToApply.instructions && updatesToApply.instructions.startsWith('__APPEND__')) {
          // Remove the prefix marker and append to the ORIGINAL agent's instructions (captured at start)
          const newContent = updatesToApply.instructions.substring('__APPEND__'.length);
          updatesToApply.instructions = originalInstructions + '\n\n' + normalizeBullets(newContent);
        } else if (updatesToApply.instructions) {
          console.error('⚠️ WARNING: Instructions update has no __REPLACE__ or __APPEND__ prefix!');
        }

        // Check if instructions are being updated
        if (updatesToApply.instructions) {
          const targetInstructions = updatesToApply.instructions;
          const isOnPreview = currentPage === 'preview';
          const userAskedForFixes = USER_ASKED_FOR_FIXES_RE.test(userMessage.content);
          const userWantsRetest = USER_WANTS_RETEST_RE.test(userMessage.content);

          if (isOnPreview && userAskedForFixes && !userWantsRetest) {
            // "Apply changes" (without retest) — hold for confirmation so user can review.
            // Snapshot is taken at confirmation time, not here.
            console.log('🔧 Holding instruction update for confirmation', { instructionLength: targetInstructions.length });
            pendingFixRef.current = { updates: updatesToApply, rerun: false, description: response.content };
            // Don't apply yet — the confirmation handler will do it
          } else if (isOnPreview && userAskedForFixes && userWantsRetest) {
            // "Apply and retest" — intent is unambiguous, skip confirmation and apply immediately.
            console.log('🔧 Auto-applying fix + retest (user intent explicit)', { instructionLength: targetInstructions.length });
            captureReview(targetAgentId);
            takeSnapshot(targetAgentId); snapshotTaken = true;
            updateSpecificAgent(targetAgentId, updatesToApply);
          } else if (isOnPreview) {
            // Direct update on Preview for non-fix requests
            captureReview(targetAgentId);
            takeSnapshot(targetAgentId); snapshotTaken = true;
            updateSpecificAgent(targetAgentId, updatesToApply);
          } else {
            // Trigger streaming animation (Build page will handle persistence).
            // takeSnapshot is called here so the streaming commit (updateAgentConfig)
            // and any non-instruction updates below all land in one undo step.
            captureReview(targetAgentId);
            takeSnapshot(targetAgentId); snapshotTaken = true;
            setStreamingInstructions(targetAgentId, targetInstructions);

            const nonInstructionUpdates = { ...updatesToApply };
            delete nonInstructionUpdates.instructions;
            if (Object.keys(nonInstructionUpdates).length > 0) {
              updateSpecificAgent(targetAgentId, nonInstructionUpdates);
            }
          }
        } else {
          // Always snapshot workflow node changes so they're undoable; other updates
          // only snapshot when the global undo flag is on.
          const hasNodeChanges = !!updatesToApply.workflowNodes;
          if (hasNodeChanges || isAgentGlobalUndo) { captureReview(targetAgentId); takeSnapshot(targetAgentId); snapshotTaken = true; }
          updateSpecificAgent(targetAgentId, updatesToApply);
        }
      }

      // Remove any capabilities
      if (response.removedCapabilities?.length) {
        if (!snapshotTaken) {
          captureReview(targetAgentId);
          if (isAgentGlobalUndo) takeSnapshot(targetAgentId);
          snapshotTaken = true;
        }
        response.removedCapabilities.forEach(cap => {
          // skipHistoryUpdate: a snapshot was already taken above; updateWithHistory would clear the review snapshot
          removeCapabilityFromInstructions(cap.name, cap.type, { skipHistoryUpdate: true, targetAgentId });
        });
      }

      // Add any capabilities
      if (response.capabilities?.length) {
        // If no snapshot was taken above (e.g. capabilities-only response with no updates,
        // or the "hold for confirmation" path), capture review + take snapshot now.
        if (!snapshotTaken) {
          captureReview(targetAgentId);
          if (isAgentGlobalUndo) takeSnapshot(targetAgentId);
          snapshotTaken = true;
        }
        // Use skipHistoryUpdate so updateWithHistory isn't called inside addCapabilityToInstructions
        // (a snapshot was already taken above, and updateWithHistory would clear the review snapshot).
        response.capabilities.forEach(cap => {
          addCapabilityToInstructions(cap.name, cap.type, cap.context, { skipHistoryUpdate: true, targetAgentId });
        });
      }

      // Apply spec patches (for spec-backed agents)
      if (response.specPatches?.length && agentConfig.specData && agentConfig.projectId && agentConfig.specAgentId) {
        const updatedSpec = applyPatches(agentConfig.specData, response.specPatches);
        const derived = specToAgentConfig(updatedSpec, agentConfig.projectId, agentConfig.specAgentId);
        updateSpecificAgent(targetAgentId, { specData: updatedSpec, ...derived });
      }

      // If the helper wants to suggest packaging as a DA skill, show the confirmation prompt
      if (response.cardType === 'da-skill-suggest' && isSkillsEnabled && agentConfig.agentType === 'DA') {
        const suggestId = (Date.now() + 2).toString();
        addHelperMessageForAgent(messageKey, {
          id: suggestId,
          role: 'assistant',
          content: response.content,
          metadata: { type: 'da-skill-suggest', suggestions: response.suggestedReplies },
          timestamp: new Date(),
        });
        setStreamingMessageId(suggestId);
        setTimeout(() => setStreamingMessageId(null), 400);
        setIsProcessing(false);
        return;
      }

      // If the helper created a skill, store it and inject the appropriate preview message
      if (response.skillData && isSkillsEnabled) {
        const newSkill = addSkill({
          ...response.skillData,
          agentId: targetAgentId,
        });
        const skillPreviewId = (Date.now() + 2).toString();
        addHelperMessageForAgent(messageKey, {
          id: skillPreviewId,
          role: 'assistant',
          content: response.content,
          metadata: {
            type: 'skill-preview',
            skill: newSkill,
            suggestions: response.suggestedReplies,
          },
          timestamp: new Date(),
        });
        setStreamingMessageId(skillPreviewId);
        setTimeout(() => setStreamingMessageId(null), 400);
        setIsProcessing(false);
        return;
      }

      // DW CRUD: tasks, skills, knowledge — push one undo snapshot before the batch
      // NOTE: tightly coupled to response shape + DW context state; left inline per P5 plan.
      if (isDWAgent(agentConfig)) {
        const hasDwMutation = response.taskData || response.taskEditData || response.taskRemoveData
          || response.skillEditData || response.skillRemoveData
          || response.knowledgeAddData || response.knowledgeEditData || response.knowledgeRemoveData;
        if (hasDwMutation && isAgentGlobalUndo) {
          takeSnapshot(targetAgentId);
        }

        // Task create
        if (response.taskData) {
          addDwTask(targetAgentId, {
            ...response.taskData,
            id: `chat-task-${Date.now()}`,
            lastUpdated: 'Just now',
          });
        }

        // Task edit/remove — mutually exclusive; edit takes priority
        if (response.taskEditData) {
          updateDwTask(targetAgentId, response.taskEditData.name, response.taskEditData.updates);
        } else if (response.taskRemoveData) {
          removeDwTask(targetAgentId, response.taskRemoveData.name);
        }

        // Skill edit/remove — mutually exclusive; edit takes priority
        if (response.skillEditData) {
          const skill = skills.find(s => s.agentId === targetAgentId && s.name === response.skillEditData!.name);
          if (skill && response.skillEditData.description) updateSkill(skill.id, { description: response.skillEditData.description });
        } else if (response.skillRemoveData) {
          const skill = skills.find(s => s.agentId === targetAgentId && s.name === response.skillRemoveData!.name);
          if (skill) deleteSkill(skill.id);
        }

        // Knowledge add/edit/remove — mutually exclusive; add/edit take priority over remove
        if (response.knowledgeAddData) {
          addDwKnowledge(targetAgentId, { ...response.knowledgeAddData, id: `chat-knowledge-${Date.now()}` });
        } else if (response.knowledgeEditData) {
          updateDwKnowledge(targetAgentId, response.knowledgeEditData.name, response.knowledgeEditData.updates);
        } else if (response.knowledgeRemoveData) {
          removeDwKnowledge(targetAgentId, response.knowledgeRemoveData.name);
        }
      }

      // If the helper signalled a rerun, go directly to the last scenario (no list needed).
      // Set flag so the auto-rerun block below doesn't also fire (preventing double runs).
      let alreadyLaunchedRerun = false;
      if (response.cardType === 'e2e-rerun' && lastScenarioRef.current) {
        alreadyLaunchedRerun = true;
        handleScenarioSelect(lastScenarioRef.current);
      }

      // Custom scenario: user described a specific situation — build a scenario on the fly and run it.
      if (response.cardType === 'custom-scenario' && response.customScenarioData) {
        alreadyLaunchedRerun = true;

        // Infer trigger type from the agent's configured trigger capability
        const triggerCap = (agentConfig.capabilities || []).find(c => c.type === 'trigger');
        const triggerName = triggerCap?.name?.toLowerCase() || '';
        const inferredTriggerType: TriggerType =
          triggerName.includes('form') ? 'form' :
          triggerName.includes('schedul') || triggerName.includes('recur') ? 'recurrence' :
          triggerName.includes('webhook') || triggerName.includes('http') ? 'webhook' :
          triggerName.includes('record') || triggerName.includes('dataverse') ? 'record' :
          'chat';
        const inferredTriggerLabel = triggerCap?.name || 'User sends a message';

        const customScenario: AgentScenario = {
          id: `custom-${Date.now()}`,
          title: response.customScenarioData.title,
          description: response.customScenarioData.title,
          triggerType: inferredTriggerType,
          triggerLabel: inferredTriggerLabel,
          storyFields: [{
            key: 'message',
            label: 'What does the user say?',
            type: 'textarea',
            value: response.customScenarioData.message,
            placeholder: '',
          }],
          expectedActions: (agentConfig.capabilities || [])
            .filter(c => c.type === 'action')
            .map(c => c.name),
        };
        handleScenarioSelect(customScenario);
      }

      // For e2e-test: the scenario card will include its own intro text with the scenario list,
      // so we skip adding the LLM's acknowledgment separately to avoid duplicate messages.

      // Generate the scenario list (e2e-* message, cleaned up on rerun).
      // IMPORTANT: await so isProcessing stays true until scenarios are ready — prevents
      // the user from typing a number before lastScenarioOptionsRef.current is populated.
      if (response.cardType === 'e2e-test') {
        await handleRunE2ETest();
      }

      // If the helper signalled a knowledge card, generate suggestions and build card metadata
      let messageMetadata: Message['metadata'] = {
        suggestions: response.suggestedReplies,
      };
      if (response.cardType === 'knowledge-sources') {
        const existingNames = [
          ...agentConfig.knowledge.files.map(f => f.name),
          ...agentConfig.knowledge.customAPIs.map(a => a.name),
        ].filter(Boolean);
        const context = [
          agentConfig.name,
          agentConfig.description,
          agentConfig.instructions,
          existingNames.length > 0 ? `Already connected: ${existingNames.join(', ')}` : '',
        ].filter(Boolean);
        let rawSuggestions: Array<{ name: string; description: string }> = [];
        try {
          rawSuggestions = await generateKnowledgeSuggestions(context);
        } catch (err) {
          console.error('[HelperAgent] generateKnowledgeSuggestions failed:', err);
          // rawSuggestions stays empty — falls through to normal suggested replies below
        }

        // Filter tier 1: exclude already-connected sources
        const existingLower = new Set(existingNames.map(n => n.toLowerCase()));
        const notAlreadyConnected = rawSuggestions.filter(
          s => !existingLower.has(s.name.toLowerCase())
        );
        // Filter tier 2: also exclude sources already mentioned in instructions
        const instructionsLower = (agentConfig.instructions || '').toLowerCase();
        const fullyFiltered = notAlreadyConnected.filter(
          s => !instructionsLower.includes(s.name.toLowerCase())
        );

        if (fullyFiltered.length > 0) {
          messageMetadata = { type: 'knowledge-sources' as const, suggestions: fullyFiltered.map(s => s.name) };
        } else if (notAlreadyConnected.length > 0) {
          messageMetadata = { type: 'knowledge-sources' as const, suggestions: notAlreadyConnected.map(s => s.name) };
        } else {
          // All suggestions already connected — skip card, show normal replies
          messageMetadata = { suggestions: response.suggestedReplies };
        }
      }

      // Attach change-summary card if the response includes one and no other card type is set.
      if (response.changeSummary && !response.cardType && !messageMetadata.type) {
        messageMetadata = {
          ...messageMetadata,
          type: 'change-summary' as const,
          summary: response.changeSummary,
        };
      }

      // Add the LLM response for all card types except e2e-test (already added above)
      // and e2e-rerun (handleScenarioSelect adds its own confirmation message).
      // knowledge-sources cards may have empty content (marker-only response), so allow them through.
      // TODO: when all knowledge sources are already connected, generateKnowledgeSuggestions resets
      // messageMetadata (losing the 'knowledge-sources' type), causing hasContent to be false and the
      // message to be silently dropped. Fine for now with mock data — revisit when connected to a real backend.
      const hasContent = !!response.content.trim() || messageMetadata.type === 'knowledge-sources';
      if (hasContent && response.cardType !== 'e2e-test' && response.cardType !== 'e2e-rerun' && response.cardType !== 'custom-scenario') {
        const messageId = nextMsgId();
        // Project page: strip any leaked square-bracket markers the LLM emitted despite instructions
        const displayContent = currentPage === 'project'
          ? response.content.replace(/\[[A-Z_:]+\][\s\S]*?\[\/[A-Z_:]+\]/g, '').replace(/\[[A-Z:]+:[^\]]*\]/g, '').trim()
          : response.content;
        const assistantMessage: Message = {
          id: messageId,
          role: 'assistant',
          content: displayContent,
          metadata: messageMetadata,
          timestamp: new Date()
        };

        // If there's a pending fix awaiting confirmation, override suggestions and
        // reframe the LLM's message as a proposal (not a done deal)
        if (pendingFixRef.current) {
          const confirmLabel = pendingFixRef.current.rerun ? 'Update instructions and retest' : 'Update instructions';
          // Rewrite the LLM's message as a clean bulleted proposal with confirmation question
          const body = assistantMessage.content
            .replace(/^applying\s+(both\s+)?fix(es)?\s*(now)?\s*[-—–:]\s*/i, '')
            .replace(/^I'(ll|m going to)\s+/i, '')
            .replace(/^here'?s what I'?m (updating|changing)[:\s—–-]*/i, '')
            .trim();

          // Normalize the body into consistent plain-text bullets
          const stripMarkdown = (s: string) => s
            .replace(/[`'"]/g, '')       // backticks, quotes
            .replace(/\*\*/g, '')        // bold
            .replace(/\*/g, '')          // italic
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
            .replace(/^\d+\.\s*/, '')    // numbered list prefix
            .trim();
          const lines = body.split('\n')
            .map(l => stripMarkdown(l.replace(/^[\s•\-*]+/, '').trim()))
            .filter(l => l.length > 10 && !/^(here'?s|i'?ll|i'?m)/i.test(l));
          const bullets = lines.length > 0
            ? lines.map(l => `- ${l.charAt(0).toUpperCase()}${l.slice(1)}`).join('\n')
            : `- ${stripMarkdown(body)}`;

          const confirmQuestion = pendingFixRef.current.rerun
            ? '\n\nShould I update the instructions and rerun the test?'
            : '\n\nShould I go ahead and update the instructions?';
          assistantMessage.content = `Here's what I'll update in your agent's instructions:\n\n${bullets}${confirmQuestion}`;
          assistantMessage.metadata = {
            ...assistantMessage.metadata,
            suggestions: [confirmLabel, 'Skip'],
          };
        }

        // Day-0: hold the response until instruction streaming finishes so everything appears in sequence.
        // We check day0Prefix (captured earlier) because streamingInstructionsData state won't be
        // updated yet within this same async handler.
        if (day0Prefix) {
          pendingDay0ResponseRef.current = { agentId: targetAgentId, message: assistantMessage, messageId };
          setIsDay0Streaming(true);
        } else {
          setStreamingMessageId(messageId);
          addHelperMessageForAgent(messageKey, assistantMessage);

          const paragraphCount = displayContent.split('\n\n').filter(p => p.trim()).length;
          const streamingDuration = paragraphCount * 200 + 100;
          setTimeout(() => setStreamingMessageId(null), streamingDuration);
        }
      }

      // Auto-rerun only when NOT waiting for confirmation and user asked for it.
      // Skip if e2e-rerun already launched above to prevent double runs.
      const hasPendingFix = pendingFixRef.current !== null;
      const userWantsRerun = !alreadyLaunchedRerun && !hasPendingFix && (
        response.cardType === 'apply-and-rerun' ||
        (response.updates?.instructions && lastScenarioRef.current && currentPage === 'preview' &&
         /retest|rerun|run again/i.test(userMessage.content)));
      if (userWantsRerun && lastScenarioRef.current) {
        const scenario = lastScenarioRef.current;
        setTimeout(() => handleScenarioSelect(scenario), 500);
      }

      // Resolve simulated errors that this fix addressed
      if (response.resolvedErrorIds?.length) {
        response.resolvedErrorIds.forEach(id => {
          resolveSimulatedError(id);
          // For instruction errors with a known text replacement, stream the fix into the editor
          const err = SIMULATED_ERRORS.find(e => e.id === id && e.errorSource === 'instruction' && e.fix?.type === 'instruction_replace');
          if (err?.fix) {
            const currentInstructions = agentConfig.instructions || '';
            const fixedInstructions = currentInstructions.replace(err.fix.find, err.fix.replace);
            if (fixedInstructions !== currentInstructions) {
              takeSnapshot(agentConfig.id);
              setStreamingInstructions(agentConfig.id, fixedInstructions);
              setIsApplyingErrorFix(true);
            }
          }
        });
      }

      // Auto-enable Work IQ if the agent's context signals M365 usage
      maybeAutoEnableWorkIQ(response.updates ?? {});
    } catch (error) {
      console.error('Error getting helper response:', error);
    } finally {
      commitSave();
      setIsProcessing(false);
    }
  };
  handleSendMessageRef.current = handleSendMessage;

  // Convert DexterChatMessage → Message for rendering in the shared message list
  const dexterToMessage = (m: DexterChatMessage): Message => ({
    id: m.id,
    role: m.role,
    content: m.errorDetail ? `⚠️ ${m.content}${m.errorDetail !== m.content ? `\n\n${m.errorDetail}` : ''}` : m.content,
    timestamp: m.timestamp,
  });

  // When Dexter live, display real worker messages; otherwise show the Claude-backed messages
  const displayMessages = isDexterLive
    ? dexterMessages.map(dexterToMessage)
    : helperMessages;

  // ── Suggestion state machine ────────────────────────────────────────────────
  // Follows the debugging flow: Surface → Diagnose → Repair → Define.
  // Each phase returns at most 3 chips so the UI stays clean.
  const visibleSuggestions = useMemo(() => {
    // CONFIRM phase — user just saw a fix stream in; give a clear binary choice
    if (pendingFixConfirmation) {
      return ['Keep this change', 'Undo'];
    }

    // APPLYING phase — loader is already showing, no chips needed
    if (isApplyingErrorFix || isProcessing) return [];

    const lastMessage = helperMessages[helperMessages.length - 1];
    const isStreaming = streamingMessageId !== null || animatingInMessageId !== null || lastMessage?.streaming;
    if (isStreaming) return [];

    // Skip interactive card messages
    if (lastMessage?.metadata?.type && INTERACTIVE_CARD_TYPES.has(lastMessage.metadata.type)) return [];

    const lastIsAssistant = lastMessage?.role === 'assistant' && !lastMessage.streaming;

    // ── Debugging flow: errors are active ─────────────────────────────────────
    if (isAgentErrorSimulation && activeErrors.length > 0) {
      // REPAIR phase — assistant just responded, and we have a deterministic fix ready.
      // Lead with the apply chip so the user can act immediately.
      if (lastIsAssistant) {
        const fixableErrors = activeErrors.filter(e => e.fix);
        const applyChips = fixableErrors.map(e => `Apply fix: ${e.affectedResource}`);
        const llmSuggestions: string[] = lastMessage.metadata?.suggestions || [];
        // Prefer apply chips first, then LLM follow-ups that aren't redundant
        const followUps = llmSuggestions.filter(s => !s.toLowerCase().startsWith('apply'));
        return [...applyChips, ...followUps].slice(0, 3);
      }

      // SURFACE / DIAGNOSE phase — no assistant message yet, or last message is from user.
      // Guide the user to the most critical errors first, in severity order:
      // publish blockers > action failures > test failures > instruction issues > knowledge issues.
      const chips: string[] = [];
      const bySource = (src: string) => activeErrors.find(e => e.errorSource === src);
      const publishErr = bySource('publish');
      const actionErr = bySource('action');
      const testErr = bySource('test_session');
      const instructionErr = bySource('instruction');
      const knowledgeErr = bySource('knowledge');

      if (publishErr) chips.push(`What's blocking publish?`);
      if (actionErr) chips.push(`Why can't ${actionErr.affectedResource} run?`);
      if (testErr) chips.push(`Why did the test fail?`);
      if (instructionErr) chips.push(`What's wrong with the ${instructionErr.affectedResource} step?`);
      if (knowledgeErr) chips.push(`How do I fix the ${knowledgeErr.affectedResource} connection?`);

      // If there are many errors, lead with an overview chip instead of listing all
      if (activeErrors.length >= 4) {
        return ['Walk me through what\'s broken', ...chips.slice(0, 2)];
      }
      return chips.slice(0, 3);
    }

    // ── Standard phase — no active errors ─────────────────────────────────────
    if (!lastIsAssistant) return [];
    return (lastMessage.metadata?.suggestions || []).slice(0, 4);
  }, [
    helperMessages, streamingMessageId, animatingInMessageId,
    isProcessing, isApplyingErrorFix, pendingFixConfirmation,
    isAgentErrorSimulation, activeErrors,
  ]);

  return (
    <div
      ref={rootRef}
      className={`relative flex flex-col h-full bg-[hsl(var(--background))] border-r border-[hsl(var(--border))] ${isExpanded ? 'w-full' : ''}`}
      style={!isExpanded ? { width: sidebarWidth } : undefined}
    >
      {isPointToAsk && isPointToAskMode && (
        <PointToAskOverlay
          onSelect={({ label, elementType, sectionContext, askContext }) => {
            setIsPointToAskMode(false);
            const pagePart = `[Page: ${getCurrentPageLabel()}]`;
            const sectionPart = sectionContext ? ` [Section: ${sectionContext.section}${sectionContext.sectionDesc ? ' — ' + sectionContext.sectionDesc : ''}]` : '';
            const elementPart = ` [Element: ${elementType} "${label}"]`;
            const contextNote = askContext ? ` Note: ${askContext}` : '';
            const fullContext = `${pagePart}${sectionPart}${elementPart}${contextNote}`;

            setNodeQuote({ label, type: elementType || 'element', context: fullContext });
            setInput(`What is "${label}"?`);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          onCancel={() => setIsPointToAskMode(false)}
        />
      )}
      {!isExpanded && (
        <div
          className="absolute top-0 right-0 w-1 h-screen z-50 cursor-col-resize"
          onMouseDown={(e) => {
            isDraggingRef.current = true;
            dragStartXRef.current = e.clientX;
            dragStartWidthRef.current = sidebarWidth;
            document.body.style.userSelect = 'none';
            e.preventDefault();
          }}
          onDoubleClick={(e) => {
            setSidebarWidth(SIDEBAR_DEFAULT);
            localStorage.setItem(STORAGE_KEY, String(SIDEBAR_DEFAULT));
            e.preventDefault();
          }}
        />
      )}
      {/* Messages - bottom padding provides space for the fixed bottom suggestions/input */}
      <div
        ref={messagesContainerRef}
        className={`relative flex-1 overflow-y-auto ${
          isExpanded ? 'py-4 px-8 md:px-12 lg:px-16' : 'pt-6 pb-4 px-8'
        }`}
        style={{ paddingBottom: bottomHeight, overflowAnchor: 'none' }}
      >
        {/* Center content when expanded */}
        <div className={`${isExpanded ? 'space-y-8 max-w-3xl mx-auto w-full' : 'space-y-8'}`}>

        {/* Dexter connection status badge */}
        {isDexterLive && (
          <div className="flex items-center gap-1.5 mb-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dexterIsConnected ? 'bg-green-500' : 'bg-red-400'}`} />
            <span className="text-xs text-neutral-400">
              {dexterIsConnected ? 'Connected' : 'Connecting…'}
            </span>
            {dexterActiveTool && (
              <span className="text-xs text-neutral-400 ml-auto truncate">Using: {dexterActiveTool}</span>
            )}
          </div>
        )}

        {displayMessages.filter(m => !m.streaming && !m.hidden).map((message, index, arr) => (
          <div
            key={message.id}
            data-message-role={message.role}
            data-message-id={message.id}
            ref={message.id === streamingMessageId ? streamingElementRef : undefined}
            className={index > 0 && arr[index - 1].role === 'assistant' && message.role === 'assistant' ? 'mt-4' : undefined}
          >
            {message.role === 'user' && message.metadata?.nodeQuote && (
              <div className="flex justify-end mb-1">
                <div className="inline-flex items-center gap-1 bg-gray-100 rounded-full pl-2.5 pr-2.5 py-0.5 max-w-[220px]">
                  <span className="text-gray-400 leading-none text-sm select-none mr-0.5">{'\u201C'}</span>
                  <span className="truncate text-xs font-medium text-gray-600">{message.metadata.nodeQuote.label}</span>
                </div>
              </div>
            )}
            <CopilotMessage
              role={message.role}
              content={message.content}
              isStreaming={message.role === 'assistant' && message.id === streamingMessageId}
              isThinking={message.metadata?.isThinking}
              thinkingText={message.metadata?.thinkingText}
              skipEntranceAnimation={animatedProgressivelyIdsRef.current.has(message.id) || initialMessageIdsRef.current.has(message.id)}
              size={isExpanded ? "normal" : "compact"}
              metadata={message.metadata}
              agentName={strategy.getAgentDisplayConfig(agentConfig).agentName}
              agentIcon={strategy.getAgentDisplayConfig(agentConfig).agentName ? (
                <div className="w-6 h-6 rounded-full border border-[hsl(var(--border))] flex items-center justify-center bg-gradient-to-br from-[hsl(var(--card))] to-[hsl(var(--muted))] flex-shrink-0">
                  <img
                    src={`${process.env.PUBLIC_URL || ''}/icons/system-color/${strategy.getAgentDisplayConfig(agentConfig).systemColorIcon || 'agents'}.svg`}
                    alt={agentConfig.name}
                    className="w-4 h-4"
                  />
                </div>
              ) : undefined}
              showFeedback={isEvalMode && message.role === 'assistant'}
              onFeedbackSubmit={(rating, comment) => {
                const filteredMessages = displayMessages.filter(m => !m.streaming);
                const lastUserMsg = filteredMessages.slice(0, index).reverse().find(m => m.role === 'user');
                submitMessageFeedback(rating, comment, message.content, lastUserMsg?.content || '', feedbackContext);
              }}
              onNewContent={message.id === streamingMessageId ? onStreamingNewContent : undefined}
              onSendMessage={(msg) => handleSendMessage(msg)}
              onPillClick={(type, name) => {
                navigate('/build', { state: { openPill: { label: name, type } } });
              }}
              onWorkIQManage={handleWorkIQManage}
              onWorkIQViewTools={handleViewWorkIQTools}
              onNavigate={handleNavigation}
            />
            {/* Post-publish copy fields (token endpoint, bot ID, etc.) */}
            {message.metadata?.postPublishCopyFields && (
              <PostPublishCopyFields
                fields={message.metadata.postPublishCopyFields}
                className={isExpanded ? 'pl-8 pr-8' : ''}
              />
            )}
            {/* Evals v2 — inline rating (replaces showFeedback thumbs when isEvalMode + isEvalsV2 are on) */}
            {isEvalMode && isEvalsV2 && message.role === 'assistant' && message.id !== streamingMessageId && (() => {
              const filteredMessages = helperMessages.filter(m => !m.streaming);
              const lastUserMsg = filteredMessages.slice(0, index).reverse().find(m => m.role === 'user');
              return (
                <InlineMessageRating
                  messageId={message.id}
                  messageContent={message.content}
                  userPrompt={lastUserMsg?.content ?? ''}
                  sessionId={agentConfig.id}
                  agentId={agentConfig.id}
                  agentName="Copilot Studio"
                  existingEval={messageEvals[message.id]}
                  onSave={handleSaveEval}
                />
              );
            })()}
          </div>
        ))}

        {/* Error analysis card — shown proactively after conversation history when
            an error activity run is selected, so it appears at the bottom like a new message */}
        {currentPage === 'monitor' && (isAnalyzingError || errorAnalysis) && selectedActivityRun && (
          <div className="animate-slide-up-fade">
            <ErrorAnalysisCard
              run={selectedActivityRun}
              analysis={errorAnalysis}
              isLoading={isAnalyzingError}
              onActionClick={(actionType: string, label: string) => {
                if (actionType === 'navigate' || actionType === 'open') {
                  navigate('/build');
                } else {
                  // 'fix' — treat the button label as a user message to the helper
                  handleSendMessage(label);
                }
              }}
            />
          </div>
        )}

        {/* Dexter live: streaming / tool / error indicators */}
        {isDexterLive && dexterIsStreaming && !dexterActiveTool && (
          <CopilotTypingIndicator size={isExpanded ? "normal" : "compact"} messages={['Thinking…']} />
        )}
        {isDexterLive && dexterActiveTool && (
          <CopilotTypingIndicator size={isExpanded ? "normal" : "compact"} messages={[`Using: ${dexterActiveTool}…`]} />
        )}
        {isDexterLive && dexterError && !dexterIsStreaming && (
          <div className="mx-1 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
            {dexterError}
          </div>
        )}

        {/* Applying-fix loader — shown while instruction streaming animation plays */}
        {isApplyingErrorFix && (
          <CopilotTypingIndicator
            size={isExpanded ? 'normal' : 'compact'}
            messages={['Updating your instructions…', 'Almost done…']}
            interval={2500}
          />
        )}

        {/* Claude-backed processing indicator (non-Dexter) */}
        {!isDexterLive && (isProcessing || isDay0Streaming || helperMessages.some(m => m.streaming)) && (() => {
          // Show specific streaming content (e.g. "Generating scenarios…", "Analyzing activity…")
          // but skip generic "Thinking..." so the smarter cycle messages below can handle it
          const streamingContent = helperMessages.find(m => m.streaming)?.content;
          if (streamingContent && streamingContent !== 'Thinking...' && streamingContent !== 'Thinking…') {
            return <CopilotTypingIndicator size={isExpanded ? "normal" : "compact"} text={streamingContent} />;
          }
          // Cycle through context-aware loading messages based on what's actually happening
          const isWorkflow = isWorkflowAgent(agentConfig);
          const lastUserMsg = [...helperMessages].reverse().find(m => m.role === 'user')?.content?.toLowerCase() ?? '';
          const currentPage = window.location.pathname;
          const isFuzzyCreating = helperMessages.some(m => m.streaming && m.content === 'Thinking...');
          const cycleMessages: string[] =
            currentPage.includes('/project')
              ? ['Designing your system…', 'Thinking through the pieces…']
            : dwStreamPhaseRef.current === 'typing' || dwStreamPhaseRef.current === 'instructions'
              ? ['Creating your AI Teammate…']
            : pendingDay0ResponseRef.current || (streamingInstructionsData && helperMessages.filter(m => m.role === 'user').length <= 1)
              ? ['Writing your agent\'s instructions…']
            : isWorkflow && helperMessages.filter(m => m.role === 'user').length <= 1
              ? ['Mapping out your workflow…', 'Setting up the steps…']
            : isWorkflow && /add|insert|new step|create/i.test(lastUserMsg)
              ? ['Adding to your workflow…']
            : isWorkflow && /delete|remove/i.test(lastUserMsg)
              ? ['Updating your workflow…']
            : isWorkflow
              ? ['Updating your workflow…', 'Working on it…']
            : /why did.*fail|fail.*how do i fix|most likely cause/i.test(lastUserMsg)
              ? ['Diagnosing the issue…', 'Finding the root cause…', 'Preparing fix guidance…']
            : /run.*test|run.*scenario|e2e|test.*agent/i.test(lastUserMsg)
              ? ['Looking over your agent…', 'Setting up test scenarios…']
            : /apply.*retest|rerun|run.*again/i.test(lastUserMsg)
              ? ['Looking at the results…', 'Working on improvements…']
            : /apply|fix|changes/i.test(lastUserMsg)
              ? ['Looking at the results…', 'Working on improvements…']
            : /publish/i.test(lastUserMsg)
              ? ['Getting things ready…', 'Almost there…']
            : /\d+/.test(lastUserMsg) && lastUserMsg.length < 10
              ? ['Setting things up…']
            : isFuzzyCreating
              ? ['Understanding your needs…', 'Figuring out the details…']
            : currentPage.includes('/build')
              ? ['Reviewing your agent…', 'Working on suggestions…']
            : currentPage.includes('/preview')
              ? ['Analyzing your question…', 'Preparing a response…']
            : currentPage.includes('/evaluate')
              ? ['Looking at the results…']
            : ['Thinking…'];
          return <CopilotTypingIndicator size={isExpanded ? "normal" : "compact"} messages={cycleMessages} interval={3000} />;
        })()}

        {/* Inflation spacer — height set via direct DOM writes in the scroll useLayoutEffect.
            JSX height never changes so React leaves our DOM writes alone across re-renders. */}
        <div ref={inflationSpacerRef} style={{ height: 0, flexShrink: 0 }} />
        </div>{/* Close center content wrapper */}
      </div>

      {/* Fixed bottom section for suggestions and input */}
      <div ref={bottomSectionRef} className={`absolute bottom-0 left-0 right-0 bg-[hsl(var(--background))] ${
        isExpanded ? 'px-8 md:px-12 lg:px-16' : ''
      }`}>
        {/* Fade scrim — sits above this section, fading the conversation */}
        <div className="absolute left-0 right-0 h-6 bg-gradient-to-t from-[hsl(var(--surface-secondary))] to-transparent pointer-events-none z-0" style={{ bottom: '100%' }} />

        <div className={`relative z-10 ${isExpanded ? 'max-w-3xl mx-auto w-full' : ''}`}>
        {/* Copilot-style Input */}
        <div className={isExpanded ? 'py-4' : 'px-8 py-4'}>
          {/* Chat suggestions (if visible) */}
          {visibleSuggestions.length > 0 && (
            <div className="mb-3 animate-slide-up-fade">
              <EnhancedInputSuggestionList
                mode="text"
                items={visibleSuggestions.map(s => ({ id: s, label: s }))}
                onSelect={(id) => handleSendMessage(id)}
                disabled={isProcessing}
              />
            </div>
          )}

          {/* Interactive selection cards — shown above the input instead of inside chat messages */}
          {(() => {
            const lastMsg = helperMessages[helperMessages.length - 1];
            const meta = lastMsg?.metadata;
            if (!meta?.type || !meta.suggestions) return null;

            if (meta.type === 'channel-selection') {
              return (
                <div className="mb-3 animate-slide-up-fade">
                  <EnhancedInputSuggestionList
                    key={(meta.suggestions as string[]).join('|')}
                    mode="multi"
                    items={(meta.suggestions as string[]).map((s: string) => {
                      const cfg = CHANNEL_ITEM_CONFIG[s.toLowerCase()];
                      return { id: s, label: cfg?.label ?? s, icon: cfg?.icon };
                    })}
                    onSubmit={(channels) => {
                      const channelMessage = channels.length > 1 ? channels.join(', ') : channels[0];
                      handleSendMessage(channelMessage);
                    }}
                    disabled={isProcessing}
                  />
                </div>
              );
            }

            if (meta.type === 'knowledge-sources') {
              return (
                <div className="mb-3 animate-slide-up-fade">
                  <EnhancedInputSuggestionList
                    key={(meta.suggestions as string[]).join('|')}
                    mode="multi"
                    items={(meta.suggestions as string[]).slice(0, 4).map((s: string) => {
                      const dashIdx = s.indexOf(' - ');
                      const serviceName = dashIdx !== -1 ? s.slice(0, dashIdx) : undefined;
                      const specificName = dashIdx !== -1 ? s.slice(dashIdx + 3) : s;
                      const cfg = serviceName ? KNOWLEDGE_ITEM_CONFIG[serviceName.toLowerCase()] : undefined;
                      return { id: s, label: specificName, description: serviceName, icon: cfg?.icon };
                    })}
                    onSubmit={(sources) => {
                      handleSendMessage(`Add these knowledge sources to the agent: ${sources.join(', ')}`);
                    }}
                    disabled={isProcessing}
                  />
                </div>
              );
            }

            if (meta.type === 'trigger-selection') {
              return (
                <div className="mb-3 animate-slide-up-fade">
                  <EnhancedInputSuggestionList
                    mode="single"
                    items={(meta.suggestions as string[]).slice(0, 5).map((triggerName: string) => {
                      const connectorName = triggerName.includes(' - ') ? triggerName.split(' - ')[0] : triggerName;
                      const cfg = CHANNEL_ITEM_CONFIG[connectorName.toLowerCase()];
                      const eventPart = triggerName.includes(' - ') ? triggerName.split(' - ').slice(1).join(' - ') : triggerName;
                      return {
                        id: triggerName,
                        label: eventPart,
                        description: triggerName.includes(' - ') ? connectorName : undefined,
                        icon: cfg?.icon,
                      };
                    })}
                    onSelect={(triggerId) => handleSendMessage(`I want to use ${triggerId} as the trigger`)}
                    disabled={isProcessing}
                  />
                </div>
              );
            }

            return null;
          })()}

          <CopilotChatInput
            value={input}
            onChange={setInput}
            onSend={() => handleSendMessage()}
            isProcessing={isDexterLive ? (!dexterIsConnected || dexterIsStreaming) : isProcessing}
            placeholder={
              INTERACTIVE_CARD_TYPES.has(helperMessages[helperMessages.length - 1]?.metadata?.type ?? '')
                ? 'Search for another option...'
                : "Describe what you'd like to do..."
            }
            shadow="none"
            autoFocus
            showSuggestions={false}
            maxRows={3}
            quoteChip={nodeQuote ? { label: nodeQuote.label, type: nodeQuote.type, onDismiss: () => setNodeQuote(null) } : undefined}
            onPointToAsk={isPointToAsk ? () => setIsPointToAskMode(v => !v) : undefined}
            isPointToAskMode={isPointToAskMode}
            uploadedFiles={uploadedFiles}
            onFilesAdded={(files) => {
              setUploadedFiles(prev => [...prev, ...files]);
              // Upload to project if spec-backed
              const pid = agentConfig?.projectId;
              if (pid) {
                for (const file of files) {
                  const form = new FormData();
                  form.append('file', file);
                  fetch(`/api/projects/${encodeURIComponent(pid)}/upload`, { method: 'POST', body: form })
                    .catch(err => console.error('[HelperAgent] file upload error:', err));
                }
              }
            }}
            onRemoveFile={(idx) => setUploadedFiles(prev => prev.filter((_, i) => i !== idx))}
          />
        </div>
      </div>{/* Close center wrapper for bottom section */}
      </div>
    </div>
  );
};
