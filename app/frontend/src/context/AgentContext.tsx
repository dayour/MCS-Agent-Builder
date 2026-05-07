import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import { AgentConfig, Message, Evaluation, MonitoringData, WorkflowNode, Skill, KnowledgeHealthResult, ActivityErrorRun, MessageEval, AgentSnapshot, AgentVersionEntry, AgentVersionType } from '../types';
import { MODEL_ENDPOINT } from '../config/endpointConfig';
import { stopPollingWorker } from '../domains/dw/services/dexterWorkerService';
import { type SavePayload } from '../services/saveService';
import { useAutoSave } from '../hooks/useAutoSave';
import { useManualSave } from '../hooks/useManualSave';
import { getAgentStorage, setAgentStorage, clearAgentStorage, clearAllAgentsStorage } from '../utils/agentStorage';
import { initFlag } from '../utils/featureFlagQuerySync';
import { useFeatureToggles } from './FeatureToggleContext';
import { generateSnapshotContent } from '../utils/snapshotContentGenerator';
import { getTriggerChannel } from '../utils/buildPageUtils';
import { specToAgentConfig, agentConfigToSpecPatch } from '../utils/specTranslation';

interface StreamingInstructionsData {
  agentId: string;
  targetInstructions: string;
}

export interface BuildGuideAgent {
  id: string;           // folder name (e.g. "Time-Entry-Agent")
  name: string;         // display name
  description: string;
}

export interface BuildGuideProject {
  id: string;          // server-side folder name (e.g. "BY", "CDW")
  name: string;        // humanized name
  stage: string;       // "research" | "build" | "preview" | etc.
  agentCount: number;
  docCount: number;
  createdAt: string;
  agents: BuildGuideAgent[];
}

interface AgentContextType {
  agents: AgentConfig[];
  currentAgentId: string | null;
  agentConfig: AgentConfig;
  createAgent: (config: Omit<AgentConfig, 'id' | 'createdAt'>, initialHelperMessages?: Message[]) => string;
  loadSpecAgent: (projectId: string, agentId: string) => Promise<string>;
  updateAgentConfig: (updates: Partial<AgentConfig>) => void;
  updateWithHistory: (updates: Partial<AgentConfig>) => void;
  takeSnapshot: (agentId: string) => void;
  updateWorkflowNodes: (nodes: WorkflowNode[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string;
  redoLabel: string;
  updateSpecificAgent: (agentId: string, updates: Partial<AgentConfig>) => void;
  switchAgent: (agentId: string) => void;
  deleteAgent: (agentId: string) => void;
  clearAllAgents: () => void;
  addCapabilityToInstructions: (capabilityName: string, capabilityType: 'knowledge' | 'action' | 'connector' | 'trigger', context: string, options?: { skipHistoryUpdate?: boolean; targetAgentId?: string }) => void;
  removeTriggerFromInstructions: (triggerName: string, options?: { skipHistoryUpdate?: boolean; targetAgentId?: string }) => void;
  removeCapabilityFromInstructions: (capabilityName: string, capabilityType: 'knowledge' | 'action' | 'connector' | 'trigger', options?: { skipHistoryUpdate?: boolean; targetAgentId?: string }) => void;
  softDeleteTrigger: (triggerName: string) => void;
  restoreTrigger: (triggerName: string) => void;
  commitSoftDeletedTriggers: () => void;
  helperMessages: Message[];
  agentHelperMessages: Record<string, Message[]>;
  addHelperMessage: (message: Message) => void;
  addHelperMessageForAgent: (agentId: string, message: Message) => void;
  updateHelperMessageForAgent: (agentId: string, messageId: string, updates: Partial<Message>) => void;
  removeHelperMessageForAgent: (agentId: string, messageId: string) => void;
  removeStreamingMessagesForAgent: (agentId: string) => void;
  removeE2EHelperMessages: (agentId: string) => void;
  clearHelperMessagesForAgent: (agentId: string) => void;
  clearHelperMessages: () => void;
  previewMessages: Message[];
  addPreviewMessage: (message: Message) => void;
  clearPreviewMessages: () => void;
  hasTestedAgent: boolean;
  markAgentTested: () => void;
  evaluations: Evaluation[];
  addEvaluation: (evaluation: Evaluation) => void;
  monitoringData: MonitoringData;
  setMonitoringData: (data: MonitoringData) => void;
  currentPage: string;
  setCurrentPage: (page: string) => void;
  isInConversationMode: boolean;
  setIsInConversationMode: (value: boolean) => void;
  isConversationalLayout: boolean;
  setIsConversationalLayout: (value: boolean) => void;
  pendingAgentData: any | null;
  setPendingAgentData: (data: any | null) => void;
  streamingInstructionsData: StreamingInstructionsData | null;
  setStreamingInstructions: (agentId: string, targetInstructions: string) => void;
  clearStreamingInstructions: () => void;
  userName: string | null;
  setUserName: (name: string | null) => void;
  isEvalMode: boolean;
  setIsEvalMode: (value: boolean) => void;
  isAgentErrorSimulation: boolean;
  setIsAgentErrorSimulation: (value: boolean) => void;
  resolvedErrorIds: string[];
  resolveSimulatedError: (id: string) => void;
  isInterviewMode: boolean;
  setIsInterviewMode: (value: boolean) => void;
  showConversationalLayoutFeature: boolean;
  setShowConversationalLayoutFeature: (value: boolean) => void;
  isPlanMode: boolean;
  setIsPlanMode: (value: boolean) => void;
  isProjectMode: boolean;
  setIsProjectMode: (value: boolean) => void;
  isShareCoauthoring: boolean;
  setIsShareCoauthoring: (value: boolean) => void;
  showEvalResults: boolean;
  setShowEvalResults: (value: boolean) => void;
  showPersonalAgentOption: boolean;
  setShowPersonalAgentOption: (value: boolean) => void;
  leaderboard: { name: string; count: number }[];
  refreshLeaderboard: () => void;
  submitFeedback: (sections: Record<string, { status: string; originalValue: string; currentValue: string }>, nameOverride?: string) => void;
  feedbackSubmitted: boolean;
  setFeedbackSubmitted: (value: boolean) => void;
  navOrder: string[];
  reorderNavAgents: (ids: string[]) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  density: 'comfortable' | 'compact';
  setDensity: (density: 'comfortable' | 'compact') => void;
  environment: string;
  setEnvironment: (env: string) => void;
  isAiAutocomplete: boolean;
  setIsAiAutocomplete: (value: boolean) => void;
  isNewNotifications: boolean;
  setIsNewNotifications: (value: boolean) => void;
  knowledgeErrors: KnowledgeHealthResult[];
  setKnowledgeErrors: (errors: KnowledgeHealthResult[]) => void;
  clearKnowledgeErrors: () => void;
  isPublishHAEnabled: boolean;
  setIsPublishHAEnabled: (value: boolean) => void;
  publishScenario: string;
  setPublishScenario: (value: string) => void;
  isHAReviewUIEnabled: boolean;
  setIsHAReviewUIEnabled: (value: boolean) => void;
  isCreateFlowChecklist: boolean;
  setIsCreateFlowChecklist: (value: boolean) => void;
  helperAgentReviewSnapshot: Partial<AgentConfig> | null;
  setHelperAgentReview: (snapshot: Partial<AgentConfig>) => void;
  clearHelperAgentReview: () => void;
  highlightAllChanges: boolean;
  setHighlightAllChanges: (v: boolean) => void;
  captureAgentSnapshot: (agentId: string) => Partial<AgentConfig> | null;
  isInstructionsHeaderStuck: boolean;
  setIsInstructionsHeaderStuck: (value: boolean) => void;
  isBuildTabsEnabled: boolean;
  setIsBuildTabsEnabled: (value: boolean) => void;
  isInsertComponents: boolean;
  setIsInsertComponents: (value: boolean) => void;
  isComponentDrawer: boolean;
  setIsComponentDrawer: (value: boolean) => void;
  isAgentTypeBadge: boolean;
  setIsAgentTypeBadge: (value: boolean) => void;
  isPillContextMenu: boolean;
  setIsPillContextMenu: (value: boolean) => void;
  isCopilotEndpoint: boolean;
  copilotTierModels: { fast: string; balanced: string; capable: string };
  setCopilotTierModel: (tier: 'fast' | 'balanced' | 'capable', modelId: string) => void;
  isL1NavJuneProposal: boolean;
  setIsL1NavJuneProposal: (value: boolean) => void;
  skills: Skill[];
  addSkill: (skill: Omit<Skill, 'id' | 'createdAt'>) => Skill;
  updateSkill: (id: string, updates: Partial<Skill>) => void;
  deleteSkill: (id: string) => void;
  isSkillsEnabled: boolean;
  setIsSkillsEnabled: (value: boolean) => void;
  isFlowCaptureEnabled: boolean;
  setIsFlowCaptureEnabled: (value: boolean) => void;
  isAgentGlobalUndo: boolean;
  setIsAgentGlobalUndo: (value: boolean) => void;
  savingState: 'idle' | 'saving' | 'saved';
  setSavingState: (state: 'idle' | 'saving' | 'saved') => void;
  lastSavedAt: number | null;
  isAutoSave: boolean;
  setIsAutoSave: (value: boolean) => void;
  isManualSave: boolean;
  setIsManualSave: (value: boolean) => void;
  saveNow: () => void;
  isManualSaveDirty: boolean;
  markManualDirty: () => void;
  clearManualDirty: () => void;
  /** Immediate save — call after commit events (blur, Enter, dropdown, component add/remove, HA complete) */
  commitSave: () => void;
  getLatestInstructions: (agentId: string) => string | null;
  registerInstructionsReader: (agentId: string, reader: () => string) => void;
  unregisterInstructionsReader: (agentId: string) => void;
  selectedActivityRun: ActivityErrorRun | null;
  setSelectedActivityRun: (run: ActivityErrorRun | null) => void;
  pendingScrollTarget: string | null;
  setPendingScrollTarget: (target: string | null) => void;
  pendingHelperInput: string | null;
  setPendingHelperInput: (input: string | null) => void;
  pendingHelperAutoSubmit: string | null;
  setPendingHelperAutoSubmit: (message: string | null) => void;
  pendingHelperQuote: { label: string; type: string; errorTitle?: string; error?: string; shortQuestion: string; context?: string } | null;
  setPendingHelperQuote: (quote: { label: string; type: string; errorTitle?: string; error?: string; shortQuestion: string; context?: string } | null) => void;
  isHelperCollapsed: boolean;
  setIsHelperCollapsed: (value: boolean) => void;
  setHelperCollapsedDefault: (value: boolean) => void;
  toggleHelperCollapsed: () => void;
  // ── Evals v2 ──────────────────────────────────────────────────────────────
  isEvalsV2: boolean;
  setIsEvalsV2: (value: boolean) => void;
  messageEvals: Record<string, MessageEval>;
  setMessageEval: (messageId: string, evalData: MessageEval) => void;
  isWorkIQEnabled: boolean;
  setIsWorkIQEnabled: (value: boolean) => void;
  // ── Agent Snapshots ────────────────────────────────────────────────────────
  userSnapshots: AgentSnapshot[];
  saveAgentSnapshot: (name: string, description: string, tags: string[], agentId?: string) => AgentSnapshot;
  buildAgentSnapshot: (agentId: string) => AgentSnapshot;
  deleteUserSnapshot: (snapshotId: string) => void;
  duplicateSnapshot: (snapshot: AgentSnapshot) => AgentSnapshot;
  updateUserSnapshot: (id: string, updates: Partial<AgentSnapshot>) => void;
  addUserSnapshot: (snapshot: AgentSnapshot) => void;
  activateSnapshot: (snapshot: AgentSnapshot) => string;
  isPointToAsk: boolean;
  setIsPointToAsk: (value: boolean) => void;
  isStepTypeVisuals: boolean;
  setIsStepTypeVisuals: (value: boolean) => void;
  isWorkflowTestingV2: boolean;
  setIsWorkflowTestingV2: (value: boolean) => void;
  isTriggersEnabled: boolean;
  setIsTriggersEnabled: (value: boolean) => void;
  isVersionHistory: boolean;
  setIsVersionHistory: (value: boolean) => void;
  showVersionMilestones: boolean;
  setShowVersionMilestones: (value: boolean) => void;
  showDraftCheckpoints: boolean;
  setShowDraftCheckpoints: (value: boolean) => void;
  agentVersionHistory: AgentVersionEntry[];
  saveVersionEntry: (type: AgentVersionType, version: string, changeNotes?: string, configOverrides?: Partial<AgentConfig>) => void;
  restoreVersion: (entryId: string) => void;
  isToolsDA: boolean;
  setIsToolsDA: (value: boolean) => void;
  isToolsCA: boolean;
  setIsToolsCA: (value: boolean) => void;
  isDistributeEnabled: boolean;
  setIsDistributeEnabled: (value: boolean) => void;
  isMonitorV2: boolean;
  setIsMonitorV2: (value: boolean) => void;
  // ── Projects ───────────────────────────────────────────────────────────────
  projects: { id: string; name: string; prompt: string; createdAt: string }[];
  addProject: (project: { name: string; prompt: string }) => string;
  updateProject: (id: string, updates: { name?: string }) => void;
  deleteProject: (id: string) => void;
  // ── Build-Guides Projects (server-backed, memory-only) ────────────────────
  buildGuideProjects: BuildGuideProject[];
  buildGuideProjectsLoading: boolean;
}

const defaultAgentConfig: AgentConfig = {
  id: 'default-agent',
  type: 'agent',
  name: 'New Agent',
  description: '',
  purpose: '',
  guidelines: [],
  skills: [],
  model: 'sonnet-4.5',
  knowledge: {
    files: [],
    webSearch: true,
    specificSources: true,
    referenceOrgChart: true,
    customAPIs: []
  },
  instructions: '',
  published: false,
  createdAt: new Date()
};

const defaultMonitoringData: MonitoringData = {
  totalRuns: 1706,
  failedRuns: 256,
  averageDuration: '30 sec',
  totalSessions: 2356,
  engagement: 95,
  themes: [
    { name: 'Policies', totalQuestions: 597, answeredPercentage: 93, likes: 5, dislikes: 16 },
    { name: 'Customer details', totalQuestions: 1403, answeredPercentage: 88, likes: 0, dislikes: 0 },
    { name: 'Cost estimation', totalQuestions: 259, answeredPercentage: 86, likes: 5, dislikes: 0 },
    { name: 'Approvals', totalQuestions: 720, answeredPercentage: 64, likes: 0, dislikes: 16 },
    { name: 'Decline a claim', totalQuestions: 1058, answeredPercentage: 93, likes: 5, dislikes: 16 },
    { name: 'Home damage', totalQuestions: 186, answeredPercentage: 82, likes: 0, dislikes: 0 },
    { name: 'Fires', totalQuestions: 230, answeredPercentage: 79, likes: 0, dislikes: 0 }
  ]
};

const AgentContext = createContext<AgentContextType | undefined>(undefined);

// Module-level constant so it is not recreated on every render.
const AUTO_VERSION_INTERVAL_MS = 5 * 60 * 1000;

const describeChanges = (before: Partial<AgentConfig>, after: Partial<AgentConfig>): string => {
  const changed = (f: keyof AgentConfig) =>
    JSON.stringify(before[f]) !== JSON.stringify(after[f]);

  const scalarFields: (keyof AgentConfig)[] = [
    'name', 'description', 'purpose', 'guidelines', 'skills', 'model', 'instructions', 'knowledge',
  ];
  const changedFields: string[] = scalarFields.filter(changed);

  if (JSON.stringify(before.workflowNodes ?? []) !== JSON.stringify(after.workflowNodes ?? []))
    changedFields.push('workflow');

  if (['icon', 'iconKey', 'gradientKey'].some(f => changed(f as keyof AgentConfig)))
    changedFields.push('icon');

  const snapCaps = before.capabilities ?? [];
  const currCaps = after.capabilities ?? [];
  const capsChanged = JSON.stringify(snapCaps) !== JSON.stringify(currCaps);
  let capLabel: string | null = null;
  if (capsChanged) {
    const snapNames = new Set(snapCaps.map(c => c.name));
    const currNames = new Set(currCaps.map(c => c.name));
    const added = currCaps.filter(c => !snapNames.has(c.name));
    const removed = snapCaps.filter(c => !currNames.has(c.name));
    if (added.length === 1 && removed.length === 0) capLabel = `adding ${added[0].name}`;
    else if (removed.length === 1 && added.length === 0) capLabel = `removing ${removed[0].name}`;
    else if (added.length > 1 && removed.length === 0) capLabel = `adding ${added.length} capabilities`;
    else if (removed.length > 1 && added.length === 0) capLabel = `removing ${removed.length} capabilities`;
  }

  if (changedFields.length === 0 && !capsChanged) return 'last change';
  if (changedFields.length === 0 && capLabel !== null) return capLabel;
  if (capsChanged) changedFields.push('capabilities');

  if (changedFields.length === 1) return `${changedFields[0]} change`;
  if (changedFields.length === 2) return `changes to ${changedFields[0]} and ${changedFields[1]}`;
  const last = changedFields[changedFields.length - 1];
  return `changes to ${changedFields.slice(0, -1).join(', ')}, and ${last}`;
};

export const AgentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // ── Feature toggles (sourced from FeatureToggleContext — bridge for backward compat) ──
  const {
    isEvalMode,
    setIsEvalMode,
    showEvalResults,
    setShowEvalResults,
    isAgentErrorSimulation,
    setIsAgentErrorSimulation,
    isEvalsV2: isEvalsV2State,
    setIsEvalsV2,
    isInterviewMode,
    setIsInterviewMode,
    showPersonalAgentOption,
    setShowPersonalAgentOption,
    isPlanMode,
    setIsPlanMode,
    isProjectMode,
    setIsProjectMode,
    isShareCoauthoring,
    setIsShareCoauthoring,
    isAiAutocomplete,
    setIsAiAutocomplete,
    showConversationalLayoutFeature,
    setShowConversationalLayoutFeature,
    isL1NavJuneProposal: isL1NavJuneProposalState,
    setIsL1NavJuneProposal,
    isNewNotifications,
    setIsNewNotifications,
    isBuildTabsEnabled,
    setIsBuildTabsEnabled,
    isInsertComponents,
    setIsInsertComponents,
    isComponentDrawer,
    setIsComponentDrawer,
    isAgentTypeBadge: isAgentTypeBadgeState,
    setIsAgentTypeBadge,
    isPillContextMenu,
    setIsPillContextMenu,
    isPublishHAEnabled,
    setIsPublishHAEnabled,
    isHAReviewUIEnabled,
    setIsHAReviewUIEnabled,
    isCreateFlowChecklist,
    setIsCreateFlowChecklist,
    isWorkIQEnabled,
    setIsWorkIQEnabled,
    isSkillsEnabled,
    setIsSkillsEnabled,
    isFlowCaptureEnabled,
    setIsFlowCaptureEnabled,
    isAgentGlobalUndo,
    setIsAgentGlobalUndo,
    isTriggersEnabled,
    setIsTriggersEnabled,
    isToolsDA,
    setIsToolsDA,
    isToolsCA,
    setIsToolsCA,
    isDistributeEnabled,
    setIsDistributeEnabled,
    isMonitorV2,
    setIsMonitorV2,
    isPointToAsk,
    setIsPointToAsk,
    isStepTypeVisuals,
    setIsStepTypeVisuals,
    isWorkflowTestingV2,
    setIsWorkflowTestingV2,
    isVersionHistory: isVersionHistoryState,
    setIsVersionHistory,
    showVersionMilestones: showVersionMilestonesState,
    setShowVersionMilestones,
    showDraftCheckpoints: showDraftCheckpointsState,
    setShowDraftCheckpoints,
    copilotTierModels,
    setCopilotTierModel,
    publishScenario,
    setPublishScenario,
  } = useFeatureToggles();

  // Initialize agents array from localStorage (with dedup on load)
  const [agents, setAgents] = useState<AgentConfig[]>(() => {
    try {
      const saved = localStorage.getItem('agents');
      if (!saved) return [];
      const parsed: AgentConfig[] = JSON.parse(saved);

      // Deduplicate by normalized name — keep the "richest" agent per name
      const groups = new Map<string, AgentConfig[]>();
      for (const a of parsed) {
        const key = a.name.toLowerCase().trim();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(a);
      }
      const deduped: AgentConfig[] = [];
      let removedCount = 0;
      for (const [, group] of groups) {
        if (group.length === 1) {
          deduped.push(group[0]);
          continue;
        }
        // Score each agent: higher = more data = keep
        const scored = group.map(a => {
          let score = 0;
          if (a.instructions && a.instructions.length > 20) score += 3;
          if (a.capabilities && a.capabilities.length > 0) score += 2;
          if (a.projectId) score += 2;
          if (a.specAgentId) score += 1;
          if (a.published) score += 1;
          if (a.description && a.description.length > 10) score += 1;
          return { agent: a, score };
        });
        scored.sort((a, b) => b.score - a.score);
        deduped.push(scored[0].agent);
        removedCount += scored.length - 1;
      }
      if (removedCount > 0) {
        console.log(`[AgentContext] Dedup: removed ${removedCount} duplicate agent(s) on load`);
        localStorage.setItem('agents', JSON.stringify(deduped));
      }
      return deduped;
    } catch (e) { console.warn('[AgentContext] Failed to parse agents from localStorage', e); return []; }
  });

  // Track current agent ID
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(() => {
    const saved = localStorage.getItem('currentAgentId');
    return saved || null;
  });

  // Get current agent config
  const agentConfig = agents.find(a => a.id === currentAgentId) || defaultAgentConfig;

  // Revive Date fields after JSON.parse (timestamps are serialized as strings)
  const reviveMessages = (record: Record<string, Message[]>): Record<string, Message[]> => {
    const result: Record<string, Message[]> = {};
    for (const key of Object.keys(record)) {
      result[key] = record[key].map(m => ({
        ...m,
        timestamp: m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp),
      }));
    }
    return result;
  };

  // Store messages per agent ID
  const [agentHelperMessages, setAgentHelperMessages] = useState<Record<string, Message[]>>(() => {
    try {
      const saved = localStorage.getItem('agentHelperMessages');
      return saved ? reviveMessages(JSON.parse(saved)) : {};
    } catch (e) { console.warn('[AgentContext] Failed to parse agentHelperMessages from localStorage', e); return {}; }
  });

  const [agentPreviewMessages, setAgentPreviewMessages] = useState<Record<string, Message[]>>(() => {
    try {
      const saved = localStorage.getItem('agentPreviewMessages');
      return saved ? reviveMessages(JSON.parse(saved)) : {};
    } catch (e) { console.warn('[AgentContext] Failed to parse agentPreviewMessages from localStorage', e); return {}; }
  });
  const [agentTestedScenarios, setAgentTestedScenarios] = useState<Record<string, boolean>>({});
  const hasTestedAgent = currentAgentId ? (agentTestedScenarios[currentAgentId] ?? false) : false;
  const markAgentTested = () => {
    if (!currentAgentId) return;
    setAgentTestedScenarios(prev => ({ ...prev, [currentAgentId]: true }));
  };

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [monitoringData, setMonitoringData] = useState<MonitoringData>(defaultMonitoringData);
  const [currentPage, setCurrentPage] = useState<string>('home');

  // Get messages for current context — components and project pages get their own threads
  const helperMessageKey = currentPage === 'components' ? '__components__' : currentPage === 'project' ? '__project__' : currentAgentId;
  const helperMessages = helperMessageKey ? (agentHelperMessages[helperMessageKey] || []) : [];
  const previewMessages = currentAgentId ? (agentPreviewMessages[currentAgentId] || []) : [];
  const [isInConversationMode, setIsInConversationMode] = useState<boolean>(false);
  const [isConversationalLayout, setIsConversationalLayout] = useState<boolean>(false);

  const [pendingAgentData, setPendingAgentData] = useState<any | null>(null);
  const [streamingInstructionsData, setStreamingInstructionsDataState] = useState<StreamingInstructionsData | null>(null);

  const [userName, setUserNameState] = useState<string | null>(() => {
    return localStorage.getItem('userName');
  });

  const [isInstructionsHeaderStuck, setIsInstructionsHeaderStuck] = useState(false);

  // ── Model endpoint (env-var-driven, read-only) ──────────────────────────
  const isCopilotEndpoint = MODEL_ENDPOINT === 'copilot';

  const [knowledgeErrors, setKnowledgeErrors] = useState<KnowledgeHealthResult[]>([]);
  const clearKnowledgeErrors = () => setKnowledgeErrors([]);

  const [helperAgentReviewSnapshot, setHelperAgentReviewSnapshotState] =
    useState<Partial<AgentConfig> | null>(null);
  const [highlightAllChanges, setHighlightAllChanges] = useState(false);
  const setHelperAgentReview = (snapshot: Partial<AgentConfig>) =>
    setHelperAgentReviewSnapshotState(snapshot);
  const clearHelperAgentReview = useCallback(() => {
    setHelperAgentReviewSnapshotState(null);
    setHighlightAllChanges(false);
  }, []);
  const captureAgentSnapshot = useCallback((agentId: string): Partial<AgentConfig> | null => {
    const agent = agentsRef.current.find(a => a.id === agentId);
    return agent ? snapshotSaveableFields(agent) : null;
  }, []);

  const setUserName = (name: string | null) => {
    setUserNameState(name);
    if (name) {
      localStorage.setItem('userName', name);
    } else {
      localStorage.removeItem('userName');
    }
  };

  const [resolvedErrorIds, setResolvedErrorIds] = useState<string[]>([]);
  const resolveSimulatedError = (id: string) => setResolvedErrorIds(prev => prev.includes(id) ? prev : [...prev, id]);

  // Override setIsAgentErrorSimulation to also clear resolvedErrorIds when disabled.
  // The base setter comes from FeatureToggleContext; this wrapper adds the side effect.
  const setIsAgentErrorSimulationWithSideEffect = (value: boolean) => {
    setIsAgentErrorSimulation(value);
    if (!value) setResolvedErrorIds([]);
  };

  const [skills, setSkills] = useState<Skill[]>(() => {
    try {
      const saved = localStorage.getItem('skills');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return parsed.map((s: Skill) => ({ ...s, createdAt: new Date(s.createdAt) }));
    } catch (e) { console.warn('[AgentContext] Failed to parse skills from localStorage', e); return []; }
  });

  useEffect(() => {
    localStorage.setItem('skills', JSON.stringify(skills));
  }, [skills]);

  const addSkill = (skillData: Omit<Skill, 'id' | 'createdAt'>): Skill => {
    const skill: Skill = {
      ...skillData,
      id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: new Date(),
    };
    setSkills(prev => [...prev, skill]);
    return skill;
  };

  const updateSkill = (id: string, updates: Partial<Skill>) => {
    setSkills(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteSkill = (id: string) => {
    setSkills(prev => prev.filter(s => s.id !== id));
  };

  // ── Evals v2 ─────────────────────────────────────────────────────────
  const [messageEvals, setMessageEvalsState] = useState<Record<string, MessageEval>>({});
  const setMessageEval = useCallback((messageId: string, evalData: MessageEval) => {
    setMessageEvalsState(prev => ({ ...prev, [messageId]: evalData }));
  }, []);


  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const [isAutoSaveState, setIsAutoSaveState] = useState(() => initFlag('isAutoSave'));
  const setIsAutoSave = useCallback((value: boolean) => { setIsAutoSaveState(value); localStorage.setItem('isAutoSave', String(value)); }, []);

  const [isManualSaveState, setIsManualSaveState] = useState(() => initFlag('isManualSave'));
  const setIsManualSave = useCallback((value: boolean) => { setIsManualSaveState(value); localStorage.setItem('isManualSave', String(value)); }, []);

  const [userSnapshots, setUserSnapshots] = useState<AgentSnapshot[]>(() => {
    try {
      const saved = localStorage.getItem('userSnapshots');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('userSnapshots', JSON.stringify(userSnapshots));
  }, [userSnapshots]);

  // Manual-save dirty tracking — marks when a qualified change exists
  const [isManualSaveDirty, setIsManualSaveDirty] = useState(false);
  const markManualDirty = useCallback(() => { if (isManualSaveState) setIsManualSaveDirty(true); }, [isManualSaveState]);
  const clearManualDirty = useCallback(() => setIsManualSaveDirty(false), []);

  const [agentVersionHistory, setAgentVersionHistoryState] = useState<AgentVersionEntry[]>([]);

  useEffect(() => {
    if (!currentAgentId) { setAgentVersionHistoryState([]); return; }
    try {
      const stored = getAgentStorage(currentAgentId, 'versionHistory');
      setAgentVersionHistoryState(stored ? JSON.parse(stored) : []);
    } catch { setAgentVersionHistoryState([]); }
  }, [currentAgentId]);

  // ── Projects ──────────────────────────────────────────────────────────────
  const [projects, setProjects] = useState<{ id: string; name: string; prompt: string; createdAt: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('elevate_projects') || '[]'); } catch { return []; }
  });

  const addProject = (project: { name: string; prompt: string }): string => {
    // Deduplicate by prompt — return existing ID if prompt already tracked
    const existing = projects.find(p => p.prompt === project.prompt);
    if (existing) return existing.id;

    const id = `project-${Date.now()}`;
    const entry = { id, ...project, createdAt: new Date().toISOString() };
    setProjects(prev => {
      const updated = [...prev, entry];
      localStorage.setItem('elevate_projects', JSON.stringify(updated));
      return updated;
    });
    return id;
  };

  const updateProject = (id: string, updates: { name?: string }) => {
    setProjects(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, ...updates } : p);
      localStorage.setItem('elevate_projects', JSON.stringify(updated));
      return updated;
    });
  };

  const deleteProject = (id: string) => {
    setProjects(prev => {
      const updated = prev.filter(p => p.id !== id);
      localStorage.setItem('elevate_projects', JSON.stringify(updated));
      return updated;
    });
  };

  // ── Build-Guides Projects (server-backed, memory-only) ──────────────────
  const [buildGuideProjects, setBuildGuideProjects] = useState<BuildGuideProject[]>([]);
  const [buildGuideProjectsLoading, setBuildGuideProjectsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/projects')
      .then(res => { if (!res.ok) throw new Error(`${res.status}`); return res.json(); })
      .then(data => {
        if (cancelled) return;
        const mapped: BuildGuideProject[] = (data.projects || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          stage: p.stage || 'unknown',
          agentCount: (p.agents || []).length,
          docCount: p.doc_count || 0,
          createdAt: p.created_at || '',
          agents: (p.agents || []).map((a: any) => ({ id: a.id || '', name: a.name || '', description: a.description || '' })),
        }));
        setBuildGuideProjects(mapped);
      })
      .catch(() => { /* server may not be running */ })
      .finally(() => { if (!cancelled) setBuildGuideProjectsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const [leaderboard, setLeaderboard] = useState<{ name: string; count: number }[]>([]);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const [navOrder, setNavOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('navOrder');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { console.warn('[AgentContext] Failed to parse navOrder from localStorage', e); return []; }
  });

  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  const [density, setDensityState] = useState<'comfortable' | 'compact'>(() => {
    return (localStorage.getItem('density') as 'comfortable' | 'compact') || 'comfortable';
  });

  const [environment, setEnvironmentState] = useState<string>(() => {
    return localStorage.getItem('environment') || 'Development';
  });

  useEffect(() => {
    localStorage.setItem('navOrder', JSON.stringify(navOrder));
  }, [navOrder]);

  const reorderNavAgents = (ids: string[]) => {
    setNavOrder(ids);
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.remove('density-comfortable', 'density-compact');
    document.documentElement.classList.add(`density-${density}`);
    localStorage.setItem('density', density);
  }, [density]);

  const setTheme = (value: 'light' | 'dark') => setThemeState(value);

  const setDensity = (value: 'comfortable' | 'compact') => setDensityState(value);

  const setEnvironment = (value: string) => {
    setEnvironmentState(value);
    localStorage.setItem('environment', value);
  };

  const [selectedActivityRun, setSelectedActivityRun] = useState<ActivityErrorRun | null>(null);
  const [pendingScrollTarget, setPendingScrollTarget] = useState<string | null>(null);
  const [pendingHelperInput, setPendingHelperInput] = useState<string | null>(null);
  const [pendingHelperAutoSubmit, setPendingHelperAutoSubmit] = useState<string | null>(null);
  const [pendingHelperQuote, setPendingHelperQuote] = useState<{ label: string; type: string; errorTitle?: string; error?: string; shortQuestion: string; context?: string } | null>(null);
  const [helperCollapsedMap, setHelperCollapsedMap] = useState<Record<string, boolean>>({});
  const currentAgentType = agents.find(a => a.id === currentAgentId)?.agentType;
  const isHelperCollapsed = currentAgentId ? (helperCollapsedMap[currentAgentId] ?? (currentAgentType === 'DW')) : false;
  const setIsHelperCollapsed = useCallback((value: boolean) => {
    if (!currentAgentId) return;
    setHelperCollapsedMap(prev => ({ ...prev, [currentAgentId]: value }));
  }, [currentAgentId]);
  const setHelperCollapsedDefault = useCallback((value: boolean) => {
    if (!currentAgentId) return;
    setHelperCollapsedMap(prev => currentAgentId in prev ? prev : { ...prev, [currentAgentId]: value });
  }, [currentAgentId]);
  const toggleHelperCollapsed = useCallback(() => {
    if (!currentAgentId) return;
    setHelperCollapsedMap(prev => ({ ...prev, [currentAgentId]: !(prev[currentAgentId] ?? false) }));
  }, [currentAgentId]);

  const refreshLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/feedback');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      const counts: Record<string, number> = {};
      for (const sub of data) {
        const name = sub.userName || 'Anonymous';
        counts[name] = (counts[name] || 0) + 1;
      }
      const sorted = Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      setLeaderboard(sorted);
    } catch {
      // Fallback to localStorage
      try {
        const saved = localStorage.getItem('feedbackSubmissions');
        if (saved) {
          const data = JSON.parse(saved);
          const counts: Record<string, number> = {};
          for (const sub of data) {
            const name = sub.userName || 'Anonymous';
            counts[name] = (counts[name] || 0) + 1;
          }
          const sorted = Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
          setLeaderboard(sorted);
        }
      } catch { /* ignore */ }
    }
  }, []);

  const submitFeedback = useCallback(async (
    sections: Record<string, { status: string; originalValue: string; currentValue: string }>,
    nameOverride?: string
  ) => {
    const effectiveName = nameOverride || userName || 'Anonymous';
    const submission = {
      id: `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userName: effectiveName,
      agentId: currentAgentId,
      agentName: agents.find(a => a.id === currentAgentId)?.name || '',
      originalPrompt: agents.find(a => a.id === currentAgentId)?.description || '',
      submittedAt: new Date().toISOString(),
      sections,
    };

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
      });
      if (!res.ok) throw new Error('POST failed');
    } catch {
      // Fallback: save to localStorage
      const saved = localStorage.getItem('feedbackSubmissions');
      const data = saved ? JSON.parse(saved) : [];
      data.push(submission);
      localStorage.setItem('feedbackSubmissions', JSON.stringify(data));
    }

    refreshLeaderboard();
    setFeedbackSubmitted(true);
  }, [userName, currentAgentId, agents, refreshLeaderboard]);

  // ── Save system ────────────────────────────────────────────────────────
  const managedSaveActive = isAutoSaveState || isManualSaveState;

  const getSavePayload = useCallback((): SavePayload => ({
    agents,
    currentAgentId,
    helperMessages: agentHelperMessages,
    previewMessages: agentPreviewMessages,
  }), [agents, currentAgentId, agentHelperMessages, agentPreviewMessages]);

  // Safety-net refs — declared early so handleSaveResult can clear them.
  const safetyDirtyRef = useRef(false);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks when the last auto-draft was written per agent; updated synchronously in saveVersionEntry
  // to avoid stale-closure duplicates in the auto-versioning effect.
  const lastAutoDraftTimestampRef = useRef<Record<string, number>>({});
  // Always points to the latest saveVersionEntry so the auto-versioning effect never closes over
  // a stale version that captured old agentHelperMessages / agentPreviewMessages / evaluations.
  const saveVersionEntryRef = useRef<AgentContextType['saveVersionEntry'] | null>(null);
  // Mirror of agentVersionHistory for the auto-versioning effect; avoids adding the array to the
  // dep array (which would re-run the effect on every history write, triggering recursion).
  const agentVersionHistoryRef = useRef<AgentVersionEntry[]>(agentVersionHistory);

  const handleSaveResult = useCallback((result: { ok: boolean; savedAt?: number; error?: string }) => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    // Clear safety-net dirty flag on successful save — the data is persisted,
    // so the backstop timer is no longer needed until the next change.
    if (result.ok) {
      safetyDirtyRef.current = false;
      if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }
      setSavingState('saved');
      setLastSavedAt(Date.now());
      savedTimerRef.current = setTimeout(() => setSavingState('idle'), 4000);
    } else {
      setSavingState('idle');
    }
  }, []);

  // Clean up saved-state timer on unmount
  useEffect(() => () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); }, []);

  const { scheduleSave, flush: flushAutoSave } = useAutoSave(getSavePayload, {
    enabled: isAutoSaveState,
    delay: 2000,
    onSaving: () => setSavingState('saving'),
    onSave: handleSaveResult,
  });

  // Silent save for messages-only changes (HA conversations, Preview/Monitor pages).
  // No onSaving/onSave callbacks — this path never touches the save indicator.
  // Covers every code path that mutates agentHelperMessages or agentPreviewMessages
  // without also changing agents: pure HA conversation turns, the stop-command
  // short-circuit, DW phase-transition welcome messages, Day-0 response release,
  // activity summaries, PreviewPage.addPreviewMessage, and MonitorPage replays.
  const { scheduleSave: scheduleMessagesSave } = useAutoSave(getSavePayload, {
    enabled: isAutoSaveState,
    delay: 2000,
  });

  const { saveNow } = useManualSave(getSavePayload, {
    enabled: isManualSaveState,
    onBeforeSave: () => { setSavingState('saving'); setIsManualSaveDirty(false); },
    onSave: handleSaveResult,
  });

  // commitSave — sets a flag so the next data-change effect flushes immediately
  // instead of debouncing.  This avoids a race condition: calling flush()
  // synchronously after setState would save stale (pre-update) data because
  // React hasn't re-rendered yet.  The flag approach guarantees flush() runs
  // after React applies the state update.
  const commitNextRef = useRef(false);
  const commitSave = useCallback(() => {
    if (isAutoSaveState) {
      commitNextRef.current = true;
    }
  }, [isAutoSaveState]);

  // Canvas auto-save (with indicator): fires when the agent config or currentAgentId
  // changes. agentHelperMessages/agentPreviewMessages are intentionally excluded —
  // those are handled by the silent messages effect below, keeping the save indicator
  // reserved for meaningful canvas edits only.
  // If commitNextRef is set (commit event), flush immediately; otherwise debounce.
  useEffect(() => {
    if (!isAutoSaveState) return;
    if (commitNextRef.current) {
      commitNextRef.current = false;
      flushAutoSave();
    } else {
      scheduleSave();
    }
  }, [agents, currentAgentId, isAutoSaveState, scheduleSave, flushAutoSave]);

  // Silent messages save: debounces a background save whenever HA or Preview messages
  // change, without touching the save indicator. Decouples message persistence from
  // canvas saves so conversations are always persisted regardless of canvas activity.
  useEffect(() => {
    if (!isAutoSaveState) return;
    scheduleMessagesSave();
  }, [agentHelperMessages, agentPreviewMessages, isAutoSaveState, scheduleMessagesSave]);

  // Safety-net: if the 2s canvas debounce keeps getting reset (rapid continuous edits),
  // this guarantees a canvas save within 10s of the FIRST unsaved canvas change.
  // Messages have their own debounce (scheduleMessagesSave) and don't need a
  // safety-net — message writes complete naturally at response boundaries.
  // Unlike the debounce effect, this timer starts once when data becomes dirty
  // and only clears when a save completes.
  useEffect(() => {
    if (!isAutoSaveState) return;
    if (safetyDirtyRef.current) return; // already tracking — don't reset the timer
    safetyDirtyRef.current = true;
    safetyTimerRef.current = setTimeout(() => {
      flushAutoSave();
      safetyDirtyRef.current = false;
      safetyTimerRef.current = null;
    }, 10000);
  }, [agents, isAutoSaveState, flushAutoSave]);

  // Unmount-only cleanup for the safety timer
  useEffect(() => {
    return () => { if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current); };
  }, []);

  // Auto-versioning: create a 'draft' checkpoint at most once every 5 minutes of editing.
  // lastAutoDraftTimestampRef is updated synchronously in saveVersionEntry so the guard is
  // never stale, even when multiple agent mutations fire before the state update is committed.
  // saveVersionEntryRef always holds the latest saveVersionEntry so the effect never captures
  // stale agentHelperMessages / agentPreviewMessages / evaluations from a prior render.
  useEffect(() => {
    if (!isVersionHistoryState) return;
    if (!currentAgentId) return;
    const agent = agents.find(a => a.id === currentAgentId);
    if (!agent) return;
    const lastEntry = agentVersionHistoryRef.current[0];
    if (!lastEntry) return; // require at least one existing entry before auto-drafting
    if (Date.now() - (lastAutoDraftTimestampRef.current[currentAgentId] ?? 0) < AUTO_VERSION_INTERVAL_MS) return;
    saveVersionEntryRef.current?.('draft', '');
  }, [agents, currentAgentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cross-tab sync — reload agent state when the Teams chat tab makes changes
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel('dw-state-sync');
    ch.onmessage = () => {
      // Reload agents from localStorage
      const stored = localStorage.getItem('agents');
      if (stored) {
        try { setAgents(JSON.parse(stored)); } catch { /* ignore */ }
      }
    };
    return () => ch.close();
  }, []);

  // Fallback: direct localStorage writes when no managed save mode is active
  useEffect(() => {
    if (!managedSaveActive) localStorage.setItem('agents', JSON.stringify(agents));
  }, [agents, managedSaveActive]);

  useEffect(() => {
    if (!managedSaveActive && currentAgentId) localStorage.setItem('currentAgentId', currentAgentId);
  }, [currentAgentId, managedSaveActive]);

  useEffect(() => {
    if (!managedSaveActive) localStorage.setItem('agentHelperMessages', JSON.stringify(agentHelperMessages));
  }, [agentHelperMessages, managedSaveActive]);

  useEffect(() => {
    if (!managedSaveActive) localStorage.setItem('agentPreviewMessages', JSON.stringify(agentPreviewMessages));
  }, [agentPreviewMessages, managedSaveActive]);

  // Reload agent-scoped monitoring and evaluation data when the active agent changes
  useEffect(() => {
    if (!currentAgentId) {
      setMonitoringData(defaultMonitoringData);
      setEvaluations([]);
      return;
    }
    const storedMonitoring = getAgentStorage(currentAgentId, 'monitoringData');
    setMonitoringData(storedMonitoring ? JSON.parse(storedMonitoring) : defaultMonitoringData);
    const storedEvals = getAgentStorage(currentAgentId, 'evaluations');
    setEvaluations(storedEvals ? JSON.parse(storedEvals) : []);
  }, [currentAgentId]);  

  const createAgent = (config: Omit<AgentConfig, 'id' | 'createdAt'>, initialHelperMessages?: Message[]): string => {
    // Preserve existing ID if present (from interview mode), otherwise generate new one
    const existingId = (config as any).id;
    const newAgent: AgentConfig = {
      ...config,
      id: existingId || `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date()
    };

    setAgents(prev => {
      // Deduplicate by ID — prevents double-adds from React StrictMode double-effect,
      // stale closure races in loadSpecAgent, or concurrent creation paths.
      if (prev.some(a => a.id === newAgent.id)) return prev;

      // Auto-unpin older agents with the same name to prevent duplicate entries
      // in the nav rail. Only applies when the new agent has a meaningful name
      // (not empty or a generic default).
      const meaningfulName = newAgent.name && newAgent.name.trim() !== '';
      let updated = prev;
      if (meaningfulName) {
        updated = prev.map(a =>
          a.name === newAgent.name && a.pinned !== false
            ? { ...a, pinned: false }
            : a
        );
      }

      // Clean up stale placeholder agents (empty name, type 'placeholder',
      // older than 60 seconds) that were abandoned mid-creation.
      const staleThreshold = Date.now() - 60_000;
      updated = updated.filter(a => {
        if (a.type !== 'placeholder') return true;
        if (a.name && a.name.trim() !== '') return true;
        const created = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        return created > staleThreshold;
      });

      return [...updated, newAgent];
    });
    setCurrentAgentId(newAgent.id);

    // Initialize message arrays for new agent (with optional initial messages)
    setAgentHelperMessages(prev => ({ ...prev, [newAgent.id]: initialHelperMessages || [] }));
    setAgentPreviewMessages(prev => ({ ...prev, [newAgent.id]: [] }));

    return newAgent.id;
  };

  // ── Load a spec-backed agent from the server ──
  const specWriteBackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSpecAgent = useCallback(async (projectId: string, agentId: string): Promise<string> => {
    // Check committed state via ref (not stale closure) to avoid race where two
    // concurrent calls both see "no existing" and create duplicates.
    const existing = agentsRef.current.find(a => a.projectId === projectId && a.specAgentId === agentId);
    if (existing) {
      setCurrentAgentId(existing.id);
      return existing.id;
    }

    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/agents/${encodeURIComponent(agentId)}`);
    if (!res.ok) throw new Error(`Failed to load agent "${agentId}" in project "${projectId}" (${res.status})`);
    const data = await res.json();
    const spec = data.spec || data.brief || {};

    const translated = specToAgentConfig(spec, projectId, agentId);
    const agentName = translated.name || data.name || agentId;

    const newId = createAgent({
      type: translated.type || 'agent',
      name: agentName,
      description: translated.description || '',
      purpose: translated.purpose || '',
      guidelines: translated.guidelines || [],
      skills: translated.skills || [],
      model: translated.model || 'sonnet-4.5',
      knowledge: translated.knowledge || { files: [], webSearch: true, specificSources: true, referenceOrgChart: true, customAPIs: [] },
      instructions: translated.instructions || '',
      capabilities: translated.capabilities,
      channel: translated.channel,
      audience: translated.audience,
      agentType: translated.agentType,
      published: false,
      projectId,
      specAgentId: agentId,
      specData: spec,
      isFuzzyComplete: true, // skip fuzzy create for spec-backed agents
    });

    // If the spec's mode fields came from the analyze inference, seed an empty
    // review baseline so useHAReviewDiff shows AI-proposed values as pending —
    // the user can Accept/Modify each field via the FeedbackSection UI.
    const prov = spec?._provenance || {};
    const fromInference =
      prov.audience?.lastSetBy === 'inference' ||
      prov.agentType?.lastSetBy === 'inference' ||
      prov.type?.lastSetBy === 'inference';
    if (fromInference) {
      setHelperAgentReviewSnapshotState({
        name: '',
        description: '',
        purpose: '',
        instructions: '',
        guidelines: [],
        model: translated.model || 'sonnet-4.5',
        capabilities: [],
        knowledge: { files: [], webSearch: false, specificSources: false, referenceOrgChart: false, customAPIs: [] },
        workflowNodes: [],
        skills: [],
      });
    }

    return newId;
  }, [createAgent]); // agentsRef is stable — no need for agents dep

  // ── Debounced write-back to server for spec-backed agents ──
  useEffect(() => {
    const agent = agents.find(a => a.id === currentAgentId);
    if (!agent?.projectId || !agent?.specAgentId) return;

    if (specWriteBackTimer.current) clearTimeout(specWriteBackTimer.current);
    specWriteBackTimer.current = setTimeout(async () => {
      try {
        const patch = agentConfigToSpecPatch(agent, agent.specData);
        if (Object.keys(patch).length === 0) return;
        await fetch(`/api/projects/${encodeURIComponent(agent.projectId!)}/agents/${encodeURIComponent(agent.specAgentId!)}/state`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
      } catch (err) {
        console.error('[AgentContext] Spec write-back failed:', err);
      }
    }, 800);

    return () => {
      if (specWriteBackTimer.current) clearTimeout(specWriteBackTimer.current);
    };
  }, [currentAgentId, agents]);

  const saveAgentSnapshot = (name: string, description: string, tags: string[], agentId?: string): AgentSnapshot => {
    const sourceId = agentId || currentAgentId || '';
    const sourceAgent = agents.find(a => a.id === sourceId);
    if (!sourceAgent) throw new Error('No agent to snapshot');

    const configPayload: Omit<AgentConfig, 'id' | 'createdAt'> = {
      type: sourceAgent.type,
      name: sourceAgent.name,
      icon: sourceAgent.icon,
      iconKey: sourceAgent.iconKey,
      iconImageData: sourceAgent.iconImageData,
      gradientKey: sourceAgent.gradientKey,
      systemColorIcon: sourceAgent.systemColorIcon,
      description: sourceAgent.description,
      purpose: sourceAgent.purpose,
      audience: sourceAgent.audience,
      channel: sourceAgent.channel,
      agentType: sourceAgent.agentType,
      email: sourceAgent.email,
      role: sourceAgent.role,
      guidelines: sourceAgent.guidelines,
      skills: sourceAgent.skills,
      model: sourceAgent.model,
      knowledge: sourceAgent.knowledge,
      instructions: sourceAgent.instructions,
      capabilities: sourceAgent.capabilities,
      workflowNodes: sourceAgent.workflowNodes,
      published: sourceAgent.published,
      version: sourceAgent.version,
      dwSkills: sourceAgent.dwSkills,
      hitlEnabled: sourceAgent.hitlEnabled,
      hitlContacts: sourceAgent.hitlContacts,
      workIq: sourceAgent.workIq,
    };

    // Capture current toggle environment
    const toggleState: Record<string, boolean | string> = {
      isEvalMode, showEvalResults,
      isAiAutocomplete, isAgentTypeBadge: isAgentTypeBadgeState,
      showConversationalLayoutFeature,
      isInterviewMode, showPersonalAgentOption,
      isComponentDrawer, isPillContextMenu,
      isBuildTabsEnabled,
      isPublishHAEnabled, publishScenario,
      isL1NavJuneProposal: isL1NavJuneProposalState, isSkillsEnabled,
      isFlowCaptureEnabled,
      isAgentGlobalUndo, isAutoSave: isAutoSaveState,
      isManualSave: isManualSaveState,
      isEvalsV2: isEvalsV2State, isWorkIQEnabled,
    };

    const snapshot: AgentSnapshot = {
      id: `snapshot-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      description,
      tags,
      lifecycleStage: sourceAgent.published ? 'published' : 'custom',
      agentConfig: configPayload,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      createdBy: userName || undefined,
      toggleState,
      helperMessages: agentHelperMessages[sourceId] || [],
      previewMessages: agentPreviewMessages[sourceId] || [],
      evaluations: evaluations.length ? evaluations : undefined,
      monitoringData: monitoringData !== defaultMonitoringData ? monitoringData : undefined,
    };

    setUserSnapshots(prev => [...prev, snapshot]);
    return snapshot;
  };

  /** Build a draft AgentSnapshot from an agent without persisting it. */
  const buildAgentSnapshot = (agentId: string): AgentSnapshot => {
    const sourceAgent = agents.find(a => a.id === agentId);
    if (!sourceAgent) throw new Error(`Agent ${agentId} not found`);

    const configPayload: Omit<AgentConfig, 'id' | 'createdAt'> = {
      type: sourceAgent.type,
      name: sourceAgent.name,
      icon: sourceAgent.icon,
      iconKey: sourceAgent.iconKey,
      iconImageData: sourceAgent.iconImageData,
      gradientKey: sourceAgent.gradientKey,
      systemColorIcon: sourceAgent.systemColorIcon,
      description: sourceAgent.description,
      purpose: sourceAgent.purpose,
      audience: sourceAgent.audience,
      channel: sourceAgent.channel,
      agentType: sourceAgent.agentType,
      email: sourceAgent.email,
      role: sourceAgent.role,
      guidelines: sourceAgent.guidelines,
      skills: sourceAgent.skills,
      model: sourceAgent.model,
      knowledge: sourceAgent.knowledge,
      instructions: sourceAgent.instructions,
      capabilities: sourceAgent.capabilities,
      workflowNodes: sourceAgent.workflowNodes,
      published: sourceAgent.published,
      version: sourceAgent.version,
      dwSkills: sourceAgent.dwSkills,
      hitlEnabled: sourceAgent.hitlEnabled,
      hitlContacts: sourceAgent.hitlContacts,
      workIq: sourceAgent.workIq,
    };

    const toggleState: Record<string, boolean | string> = {
      isEvalMode, showEvalResults,
      isAiAutocomplete, isAgentTypeBadge: isAgentTypeBadgeState,
      showConversationalLayoutFeature,
      isInterviewMode, showPersonalAgentOption,
      isComponentDrawer, isPillContextMenu,
      isBuildTabsEnabled,
      isPublishHAEnabled, publishScenario,
      isL1NavJuneProposal: isL1NavJuneProposalState, isSkillsEnabled,
      isFlowCaptureEnabled,
      isAgentGlobalUndo, isAutoSave: isAutoSaveState,
      isManualSave: isManualSaveState,
      isEvalsV2: isEvalsV2State, isWorkIQEnabled,
    };

    return {
      id: `snapshot-draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: sourceAgent.name,
      description: sourceAgent.description || '',
      tags: [],
      lifecycleStage: sourceAgent.published ? 'published' : 'custom',
      agentConfig: configPayload,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      createdBy: userName || undefined,
      toggleState,
      helperMessages: agentHelperMessages[agentId] || [],
      previewMessages: agentPreviewMessages[agentId] || [],
      evaluations: evaluations.length ? evaluations : undefined,
      monitoringData: monitoringData !== defaultMonitoringData ? monitoringData : undefined,
    };
  };

  // ── Version History ──────────────────────────────────────────────────────────

  /** Extract the saveable config fields from an agent (same shape as buildAgentSnapshot). */
  const buildVersionConfigPayload = (agent: AgentConfig): Omit<AgentConfig, 'id' | 'createdAt'> => ({
    type: agent.type,
    name: agent.name,
    icon: agent.icon,
    iconKey: agent.iconKey,
    iconImageData: agent.iconImageData,
    gradientKey: agent.gradientKey,
    systemColorIcon: agent.systemColorIcon,
    description: agent.description,
    purpose: agent.purpose,
    audience: agent.audience,
    channel: agent.channel,
    agentType: agent.agentType,
    email: agent.email,
    role: agent.role,

    guidelines: agent.guidelines,
    skills: agent.skills,
    model: agent.model,
    knowledge: agent.knowledge,
    instructions: agent.instructions,
    capabilities: agent.capabilities,
    workflowNodes: agent.workflowNodes,
    published: agent.published,
    version: agent.version,
    dwSkills: agent.dwSkills,
    hitlEnabled: agent.hitlEnabled,
    hitlContacts: agent.hitlContacts,
    workIq: agent.workIq,
  });

  const saveVersionEntry = (
    type: AgentVersionType,
    version: string,
    changeNotes?: string,
    configOverrides?: Partial<AgentConfig>,
  ) => {
    const agentId = currentAgentId;
    if (!agentId) return;
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    const configPayload = { ...buildVersionConfigPayload(agent), ...configOverrides };

    const entry: AgentVersionEntry = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      version,
      versionType: type,
      agentConfig: configPayload,
      changeNotes,
      createdBy: userName || undefined,
      helperMessages: (agentHelperMessages[agentId] ?? []).length ? agentHelperMessages[agentId] : undefined,
      previewMessages: (agentPreviewMessages[agentId] ?? []).length ? agentPreviewMessages[agentId] : undefined,
      evaluations: evaluations.length ? evaluations : undefined,
    };

    if (type === 'draft') lastAutoDraftTimestampRef.current[agentId] = Date.now();

    setAgentVersionHistoryState(prev => {
      const updated = [entry, ...prev].slice(0, 50);
      setAgentStorage(agentId, 'versionHistory', JSON.stringify(updated));
      return updated;
    });
  };
  // Keep the refs pointing at the latest values so the auto-versioning effect never closes over
  // stale agentHelperMessages / agentPreviewMessages / evaluations or a stale history array.
  saveVersionEntryRef.current = saveVersionEntry;
  agentVersionHistoryRef.current = agentVersionHistory;

  const restoreVersion = (entryId: string) => {
    const entry = agentVersionHistory.find(e => e.id === entryId);
    if (!entry) return;
    // Save current state as a draft-restored entry BEFORE applying the restore
    const restoredFromSource = entry.versionType === 'published' && entry.version
      ? `v${entry.version}`
      : entry.versionType === 'milestone' ? 'a milestone'
      : entry.versionType === 'draft' ? 'a draft checkpoint'
      : 'a previous version';
    const restoredFromTimestamp = new Date(entry.createdAt).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    saveVersionEntry('draft-restored', 'restored', `Restored from ${restoredFromSource} (${restoredFromTimestamp})`);
    // Apply restored config in-place, forcing published: false (becomes a draft pending republish).
    // Use updateWithHistory so the restore is undoable via Ctrl+Z (gated on isAgentGlobalUndo per convention).
    const { published: _published, version: _version, lastPublishedAt: _lpa, ...restorableConfig } = entry.agentConfig;
    const restoredUpdate = { ...restorableConfig, published: false };
    if (isAgentGlobalUndo) {
      updateWithHistory(restoredUpdate);
    } else {
      updateAgentConfig(restoredUpdate);
    }
  };

  const deleteUserSnapshot = (snapshotId: string) => {
    setUserSnapshots(prev => prev.filter(s => s.id !== snapshotId));
  };

  const updateUserSnapshot = (id: string, updates: Partial<AgentSnapshot>) => {
    setUserSnapshots(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const addUserSnapshot = (snapshot: AgentSnapshot) => {
    setUserSnapshots(prev => [snapshot, ...prev]);
  };

  const duplicateSnapshot = (snapshot: AgentSnapshot): AgentSnapshot => {
    const baseName = `${snapshot.name} (Copy)`;
    const existingNames = new Set(userSnapshots.map(s => s.name));
    let resolvedName = baseName;
    if (existingNames.has(baseName)) {
      let counter = 2;
      while (existingNames.has(`${baseName} ${counter}`)) counter++;
      resolvedName = `${baseName} ${counter}`;
    }
    const duplicate: AgentSnapshot = {
      ...snapshot,
      id: `snapshot-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: resolvedName,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      createdBy: userName || undefined,
    };
    setUserSnapshots(prev => [...prev, duplicate]);
    return duplicate;
  };

  const activateSnapshot = (snapshot: AgentSnapshot): string => {
    const baseName = snapshot.agentConfig.name || snapshot.name;
    const existingNames = new Set(agents.map(a => a.name));
    let resolvedName = baseName;
    if (existingNames.has(baseName)) {
      let counter = 2;
      while (existingNames.has(`${baseName} (${counter})`)) counter++;
      resolvedName = `${baseName} (${counter})`;
    }
    const newId = createAgent(
      {
        ...snapshot.agentConfig,
        name: resolvedName,
        justCreated: true,
      },
      snapshot.helperMessages,
    );

    // Seed preview messages
    if (snapshot.previewMessages?.length) {
      setAgentPreviewMessages(prev => ({ ...prev, [newId]: snapshot.previewMessages! }));
    }

    // Seed agent-scoped monitoring data and evaluations via agentStorage
    if (snapshot.monitoringData) {
      setAgentStorage(newId, 'monitoringData', JSON.stringify(snapshot.monitoringData));
    }
    if (snapshot.evaluations?.length) {
      setAgentStorage(newId, 'evaluations', JSON.stringify(snapshot.evaluations));
    }

    // For built-in snapshots flagged for generation — trigger ad-hoc content gen
    if (snapshot.generateOnLoad) {
      const existingStatus = getAgentStorage(newId, 'snapshotContentStatus');
      if (!existingStatus) {
        setAgentStorage(newId, 'snapshotContentStatus', 'pending');
        generateSnapshotContent(newId, snapshot, {
          setAgentHelperMessages,
          setAgentPreviewMessages,
          setMonitoringData,
          setEvaluations,
        });
      }
    }

    return newId;
  };

  const updateAgentConfig = (updates: Partial<AgentConfig>) => {
    if (!currentAgentId) return;

    setAgents(prev => prev.map(agent =>
      agent.id === currentAgentId
        ? { ...agent, ...updates }
        : agent
    ));
  };

  // ─── Unified undo/redo history (per agent) ────────────────────────────────
  // All saveable agent/workflow state is tracked here as per-agent snapshots.
  //
  // FUTURE ENGINEERS: When adding new saveable fields to AgentConfig, add them
  // to SAVEABLE_FIELDS below so undo/redo covers them automatically.
  // Use updateWithHistory() for any change the user should be able to undo.
  // Use updateAgentConfig() only for runtime/non-saveable state (publishing status, etc.).
  const SAVEABLE_FIELDS: (keyof AgentConfig)[] = [
    'name', 'description', 'purpose', 'guidelines', 'skills', 'model',
    'instructions', 'knowledge', 'capabilities', 'workflowNodes',
    'icon', 'iconKey', 'gradientKey', 'iconImageData', 'systemColorIcon', 'dwSkills',
    'email', 'role', 'triggerDistribution', 'softDeletedTriggers',
    'projectId', 'specAgentId', // spec-backed agent identifiers (NOT specData — too large for undo)
  ];

  const MAX_UNDO_HISTORY = 100;

  const [historyPast, setAgentPast] = useState<Record<string, Partial<AgentConfig>[]>>(() => {
    try {
      return JSON.parse(localStorage.getItem('undo_past') ?? '{}');
    } catch { return {}; }
  });
  const [historyFuture, setAgentFuture] = useState<Record<string, Partial<AgentConfig>[]>>(() => {
    try { return JSON.parse(localStorage.getItem('undo_future') ?? '{}'); } catch { return {}; }
  });

  useEffect(() => {
    try { localStorage.setItem('undo_past', JSON.stringify(historyPast)); } catch { /* quota */ }
  }, [historyPast]);

  useEffect(() => {
    try { localStorage.setItem('undo_future', JSON.stringify(historyFuture)); } catch { /* quota */ }
  }, [historyFuture]);

  const canUndo = !!(currentAgentId && (historyPast[currentAgentId]?.length ?? 0) > 0);
  const canRedo = !!(currentAgentId && (historyFuture[currentAgentId]?.length ?? 0) > 0);

  // Always-current refs so undo/redo read the latest state even if a blur-triggered
  // updateWithHistory hasn't re-rendered the context yet when the button click fires.
  const historyPastRef = useRef(historyPast);
  historyPastRef.current = historyPast;
  const historyFutureRef = useRef(historyFuture);
  historyFutureRef.current = historyFuture;
  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  // Saved review snapshot — persists across undo so redo can restore highlights
  // when the user redoes back to the most recent (HA-written) step.
  const savedReviewSnapshotRef = useRef<Partial<AgentConfig> | null>(null);
  // Saved highlightAllChanges value — restored alongside the snapshot on redo.
  const savedHighlightAllChangesRef = useRef(false);

  const snapshotSaveableFields = (agent: AgentConfig): Partial<AgentConfig> => {
    const snapshot: Partial<AgentConfig> = {};
    for (const field of SAVEABLE_FIELDS) {
      // Always snapshot every saveable field, even if the value is undefined,
      // so that undo/redo can accurately restore "unset" states.
      (snapshot as any)[field] = (agent as any)[field];
    }
    return snapshot;
  };

  const updateWithHistory = (updates: Partial<AgentConfig>) => {
    if (!currentAgentId) return;
    const current = agentsRef.current.find(a => a.id === currentAgentId);
    if (!current) return;
    const snapshot = snapshotSaveableFields(current);
    setAgentPast(prev => {
      const stack = [...(prev[currentAgentId] ?? []), snapshot];
      return { ...prev, [currentAgentId]: stack.length > MAX_UNDO_HISTORY ? stack.slice(-MAX_UNDO_HISTORY) : stack };
    });
    setAgentFuture(prev => ({ ...prev, [currentAgentId]: [] }));
    setAgents(prev => prev.map(a => a.id === currentAgentId ? { ...a, ...updates } : a));
    setHelperAgentReviewSnapshotState(null);
    savedReviewSnapshotRef.current = null;
    if (isManualSaveState) setIsManualSaveDirty(true);
  };

  // Captures a snapshot of the specified agent's saveable state as a single undo entry
  // WITHOUT applying any changes. Use this before a series of programmatic changes
  // (e.g. helper agent reply) that should be grouped as one undo step. All subsequent
  // changes should use updateAgentConfig/updateSpecificAgent (no history push).
  const takeSnapshot = (agentId: string) => {
    const agent = agentsRef.current.find(a => a.id === agentId);
    if (!agent) return;
    const snapshot = snapshotSaveableFields(agent);
    setAgentPast(prev => {
      const stack = [...(prev[agentId] ?? []), snapshot];
      const next = stack.length > MAX_UNDO_HISTORY ? stack.slice(-MAX_UNDO_HISTORY) : stack;
      return { ...prev, [agentId]: next };
    });
    if (isManualSaveState) setIsManualSaveDirty(true);
    setAgentFuture(prev => ({ ...prev, [agentId]: [] }));
  };

  const undoLabel = useMemo(() => {
    if (!currentAgentId || !canUndo) return 'Nothing to undo';
    const past = historyPast[currentAgentId] ?? [];
    const snapshot = past[past.length - 1];
    const current = agents.find(a => a.id === currentAgentId);
    if (!current || !snapshot) return 'Undo';
    return 'Undo ' + describeChanges(snapshot, snapshotSaveableFields(current));
  }, [historyPast, currentAgentId, canUndo, agents]); // eslint-disable-line react-hooks/exhaustive-deps

  const redoLabel = useMemo(() => {
    if (!currentAgentId || !canRedo) return 'Nothing to redo';
    const future = historyFuture[currentAgentId] ?? [];
    const snapshot = future[future.length - 1];
    const current = agents.find(a => a.id === currentAgentId);
    if (!current || !snapshot) return 'Redo';
    return 'Redo ' + describeChanges(snapshotSaveableFields(current), snapshot);
  }, [historyFuture, currentAgentId, canRedo, agents]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateWorkflowNodes = (nodes: WorkflowNode[]) => {
    updateWithHistory({ workflowNodes: nodes });
  };

  const undo = () => {
    if (!currentAgentId) return;
    // Read from refs for the early-return guard and to get the current agent snapshot.
    // State mutations use prev inside the updater to avoid stale-ref issues with rapid clicks.
    const past = historyPastRef.current[currentAgentId] ?? [];
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const current = agentsRef.current.find(a => a.id === currentAgentId);
    if (!current) return;
    const currentSnapshot = snapshotSaveableFields(current);
    setAgentPast(prev => {
      const stack = prev[currentAgentId] ?? [];
      return { ...prev, [currentAgentId]: stack.slice(0, -1) };
    });
    setAgentFuture(prev => ({ ...prev, [currentAgentId]: [...(prev[currentAgentId] ?? []), currentSnapshot] }));
    setAgents(prev => prev.map(a => a.id === currentAgentId ? { ...a, ...previous } : a));
    // Undo rejects the HA's changes — exit review mode so highlights don't
    // persist against states that predate the HA's write. Save the snapshot
    // so redo can restore highlights if the user comes back to the latest step.
    if (helperAgentReviewSnapshot) {
      savedReviewSnapshotRef.current = helperAgentReviewSnapshot;
      savedHighlightAllChangesRef.current = highlightAllChanges;
      setHelperAgentReviewSnapshotState(null);
      setHighlightAllChanges(false);
    }
    if (isManualSaveState) setIsManualSaveDirty(true);
  };

  const redo = () => {
    if (!currentAgentId) return;
    const future = historyFutureRef.current[currentAgentId] ?? [];
    if (future.length === 0) return;
    const next = future[future.length - 1];
    const current = agentsRef.current.find(a => a.id === currentAgentId);
    if (!current) return;
    const currentSnapshot = snapshotSaveableFields(current);
    setAgentFuture(prev => {
      const stack = prev[currentAgentId] ?? [];
      return { ...prev, [currentAgentId]: stack.slice(0, -1) };
    });
    setAgentPast(prev => ({ ...prev, [currentAgentId]: [...(prev[currentAgentId] ?? []), currentSnapshot] }));
    setAgents(prev => prev.map(a => a.id === currentAgentId ? { ...a, ...next } : a));
    // If this redo brings us back to the most recent step, restore review highlights.
    if (future.length === 1 && savedReviewSnapshotRef.current) {
      setHelperAgentReviewSnapshotState(savedReviewSnapshotRef.current);
      setHighlightAllChanges(savedHighlightAllChangesRef.current);
      savedReviewSnapshotRef.current = null;
      savedHighlightAllChangesRef.current = false;
    }
    if (isManualSaveState) setIsManualSaveDirty(true);
  };

  const updateSpecificAgent = (
    agentId: string,
    updates: Partial<AgentConfig> | ((current: AgentConfig) => Partial<AgentConfig>)
  ) => {
    setAgents(prev => prev.map(agent => {
      if (agent.id !== agentId) return agent;
      const patch = typeof updates === 'function' ? updates(agent) : updates;
      return { ...agent, ...patch };
    }));
  };

  const switchAgent = (agentId: string) => {
    // Flush pending save before switching context.
    // Uses flushAutoSave() directly (not commitSave) because we need to
    // persist Agent A's current state BEFORE setCurrentAgentId changes context.
    if (isAutoSaveState) flushAutoSave();
    setCurrentAgentId(agentId);
    // Clear pending input/quote so Agent A's chip doesn't appear in Agent B's input
    setPendingHelperInput(null);
    setPendingHelperQuote(null);
    setSelectedActivityRun(null);
    setHelperAgentReviewSnapshotState(null);
    setHighlightAllChanges(false);
    savedReviewSnapshotRef.current = null;
    // Reset save state so new agent doesn't inherit stale saved indicator (I4+M1)
    setLastSavedAt(null);
    setSavingState('idle');
    setIsManualSaveDirty(false);
  };

  const deleteAgent = (agentId: string) => {
    // Stop Dexter polling if this agent has an active worker
    const agent = agents.find(a => a.id === agentId);
    if (agent?.dexterWorkerId) {
      stopPollingWorker(agent.dexterWorkerId);
    }

    setAgents(prev => prev.filter(agent => agent.id !== agentId));
    setAgentHelperMessages(prev => { const next = { ...prev }; delete next[agentId]; return next; });
    setAgentPreviewMessages(prev => { const next = { ...prev }; delete next[agentId]; return next; });
    setAgentPast(prev => { const next = { ...prev }; delete next[agentId]; return next; });
    setAgentFuture(prev => { const next = { ...prev }; delete next[agentId]; return next; });

    clearAgentStorage(agentId);

    // If deleting current agent, switch to another or null
    if (currentAgentId === agentId) {
      const remaining = agents.filter(a => a.id !== agentId);
      setCurrentAgentId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const clearAllAgents = () => {
    clearAllAgentsStorage();
    setAgents([]);
    setCurrentAgentId(null);
    setAgentHelperMessages({});
    setAgentPreviewMessages({});
    setAgentPast({});
    setAgentFuture({});
    localStorage.removeItem('agents');
    localStorage.removeItem('currentAgentId');
    localStorage.removeItem('agentHelperMessages');
    localStorage.removeItem('agentPreviewMessages');
    localStorage.removeItem('undo_past');
    localStorage.removeItem('undo_future');
  };

  const addHelperMessage = (message: Message) => {
    const key = helperMessageKey;
    if (!key) return;
    setAgentHelperMessages(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), message]
    }));
  };

  const addHelperMessageForAgent = (agentId: string, message: Message) => {
    // Fall back to helperMessageKey when agentId is empty or the default placeholder id
    // (e.g. on project/components pages where no real agent is active)
    const effectiveKey = (agentId && agentId !== 'default-agent') ? agentId : helperMessageKey;
    if (!effectiveKey) return;
    setAgentHelperMessages(prev => {
      const existing = prev[effectiveKey] || [];
      // Deduplicate by ID — prevents double-adds from React StrictMode or concurrent effects
      if (existing.some(m => m.id === message.id)) return prev;
      return { ...prev, [effectiveKey]: [...existing, message] };
    });
  };

  const updateHelperMessageForAgent = (agentId: string, messageId: string, updates: Partial<Message>) => {
    const effectiveKey = (agentId && agentId !== 'default-agent') ? agentId : helperMessageKey;
    if (!effectiveKey) return;
    setAgentHelperMessages(prev => ({
      ...prev,
      [effectiveKey]: (prev[effectiveKey] || []).map(m => m.id === messageId ? { ...m, ...updates } : m),
    }));
  };

  const removeHelperMessageForAgent = (agentId: string, messageId: string) => {
    const effectiveKey = (agentId && agentId !== 'default-agent') ? agentId : helperMessageKey;
    if (!effectiveKey) return;
    setAgentHelperMessages(prev => ({
      ...prev,
      [effectiveKey]: (prev[effectiveKey] || []).filter(m => m.id !== messageId),
    }));
  };

  const removeStreamingMessagesForAgent = (agentId: string) => {
    const effectiveKey = (agentId && agentId !== 'default-agent') ? agentId : helperMessageKey;
    if (!effectiveKey) return;
    setAgentHelperMessages(prev => ({
      ...prev,
      [effectiveKey]: (prev[effectiveKey] || []).filter(m => !m.streaming)
    }));
  };

  // Removes the e2e progress indicator before a new run starts.
  // Only 'e2e-progress-*' is truly transient — it's a streaming typing indicator that gets
  // replaced on every run. Everything else (confirm, summary, scenario list) is a permanent
  // conversation record and must NOT be removed.
  const removeE2EHelperMessages = (agentId: string) => {
    setAgentHelperMessages(prev => ({
      ...prev,
      [agentId]: (prev[agentId] || []).filter(m => !m.id.startsWith('e2e-progress-')),
    }));
  };

  const clearHelperMessagesForAgent = (agentId: string) => {
    setAgentHelperMessages(prev => ({ ...prev, [agentId]: [] }));
  };

  const clearHelperMessages = () => {
    const key = currentPage === 'components' ? '__components__' : currentAgentId;
    if (!key) return;
    setAgentHelperMessages(prev => ({
      ...prev,
      [key]: []
    }));
  };

  const addPreviewMessage = (message: Message) => {
    if (!currentAgentId) return;
    setAgentPreviewMessages(prev => ({
      ...prev,
      [currentAgentId]: [...(prev[currentAgentId] || []), message]
    }));
  };

  const clearPreviewMessages = () => {
    if (!currentAgentId) return;
    setAgentPreviewMessages(prev => ({
      ...prev,
      [currentAgentId]: []
    }));
  };

  const addEvaluation = (evaluation: Evaluation) => {
    setEvaluations(prev => {
      const next = [...prev, evaluation];
      if (currentAgentId) setAgentStorage(currentAgentId, 'evaluations', JSON.stringify(next));
      return next;
    });
  };

  const addCapabilityToInstructions = (capabilityName: string, capabilityType: 'knowledge' | 'action' | 'connector' | 'trigger', context: string, options?: { skipHistoryUpdate?: boolean; targetAgentId?: string }) => {
    const tid = options?.targetAgentId ?? currentAgentId;
    if (!tid) return;

    // Pure computation: derive the update from a given agent state.
    // Extracted so the skip path can pass this as a functional updater to setAgents —
    // each iteration of a forEach loop then sees the accumulated state from prior
    // iterations rather than the stale agentsRef.current snapshot.
    const computeUpdate = (currentAgent: AgentConfig): Partial<AgentConfig> => {
      const currentInstructions = currentAgent.instructions || '';
      const currentCapabilities = currentAgent.capabilities || [];

      const capabilityExists = currentCapabilities.some(cap => cap.name === capabilityName);
      const newCapabilities = capabilityExists
        ? currentCapabilities
        : [...currentCapabilities, { name: capabilityName, type: capabilityType }];

      // For triggers, update the "Where this agent works:" line in instructions
      // so the trigger appears in the "Available in" / "Runs when" rendering.
      if (capabilityType === 'trigger') {
        const channel = getTriggerChannel(capabilityName);
        // Icon key matches channel, except 'microsoft 365' uses 'm365' in icon markup
        const iconKey = channel === 'microsoft 365' ? 'm365' : (channel || capabilityName.toLowerCase().replace(/\s+/g, ''));
        const triggerToken = `{{icon:${iconKey}}} [[${capabilityName}]]`;

        // If re-adding a soft-deleted trigger, clear the soft-delete flag
        const existingSoftDeleted = currentAgent.softDeletedTriggers ?? [];
        const cleanedSoftDeleted = existingSoftDeleted.filter(n => n !== capabilityName);
        const softDeletedTriggers = cleanedSoftDeleted.length > 0 ? cleanedSoftDeleted : undefined;

        if (!currentInstructions.includes(`[[${capabilityName}]]`)) {
          const wtaLineRe = /^(Where this agent works:.*)$/m;
          const wtaMatch = currentInstructions.match(wtaLineRe);
          const newInstructions = wtaMatch
            ? currentInstructions.replace(wtaLineRe, `${wtaMatch[1]}, ${triggerToken}`)
            : `Where this agent works: ${triggerToken}\n\n${currentInstructions}`;
          return { instructions: newInstructions, capabilities: newCapabilities, softDeletedTriggers };
        }
        return { capabilities: newCapabilities, softDeletedTriggers };
      }

      if (context) {
        // Append the pill/context text to instructions
        const newInstructions = currentInstructions ? `${currentInstructions}\n\n${context}` : context;
        return { instructions: newInstructions, capabilities: newCapabilities };
      }
      // context is empty — the pill is already embedded in the instruction update;
      // only register the capability, do NOT overwrite instructions.
      return { capabilities: newCapabilities };
    };

    if (options?.skipHistoryUpdate) {
      // Functional update: React applies each queued updater against the result of the
      // previous one, so sequential calls within the same tick accumulate correctly.
      updateSpecificAgent(tid, computeUpdate);
    } else {
      const currentAgent = agentsRef.current.find(a => a.id === tid);
      if (!currentAgent) return;
      updateWithHistory(computeUpdate(currentAgent));
    }
    markManualDirty();
  };

  const removeTriggerFromInstructions = (triggerName: string, options?: { skipHistoryUpdate?: boolean; targetAgentId?: string }) => {
    const tid = options?.targetAgentId ?? currentAgentId;
    if (!tid) return;

    const computeUpdate = (currentAgent: AgentConfig): Partial<AgentConfig> => {
      let instructions = currentAgent.instructions || '';
      const capabilities = (currentAgent.capabilities || []).filter(cap => cap.name !== triggerName);

      // Remove the trigger token from the "Where this agent works:" line
      // Matches: {{icon:key}} [[TriggerName]] or just [[TriggerName]]
      // Also strips leading ", " or trailing ", " to keep the line clean
      const escapedName = triggerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tokenPatterns = [
        new RegExp(`,\\s*\\{\\{icon:[^}]+\\}\\}\\s*\\[\\[${escapedName}\\]\\]`, 'g'),  // ", {{icon:x}} [[Name]]"
        new RegExp(`\\{\\{icon:[^}]+\\}\\}\\s*\\[\\[${escapedName}\\]\\],\\s*`, 'g'),  // "{{icon:x}} [[Name]], "
        new RegExp(`\\{\\{icon:[^}]+\\}\\}\\s*\\[\\[${escapedName}\\]\\]`, 'g'),        // "{{icon:x}} [[Name]]"
        new RegExp(`,\\s*\\[\\[${escapedName}\\]\\]`, 'g'),                              // ", [[Name]]"
        new RegExp(`\\[\\[${escapedName}\\]\\],\\s*`, 'g'),                              // "[[Name]], "
        new RegExp(`\\[\\[${escapedName}\\]\\]`, 'g'),                                   // "[[Name]]"
      ];
      for (const pattern of tokenPatterns) {
        instructions = instructions.replace(pattern, '');
      }

      // If the "Where this agent works:" line has no remaining trigger tokens, remove it entirely
      const wtaLineMatch = instructions.match(/^(Where this agent works:.*)$/m);
      if (wtaLineMatch && !/\[\[/.test(wtaLineMatch[1])) {
        instructions = instructions.replace(/^Where this agent works:.*\n*/m, '');
      }

      // Clean up distribution state for the trigger's channel
      const channel = getTriggerChannel(triggerName);
      let triggerDistribution = currentAgent.triggerDistribution ? { ...currentAgent.triggerDistribution } : undefined;
      if (channel && triggerDistribution?.[channel]) {
        delete triggerDistribution[channel];
        if (Object.keys(triggerDistribution).length === 0) triggerDistribution = undefined;
      }

      return { instructions: instructions.trim(), capabilities, triggerDistribution };
    };

    if (options?.skipHistoryUpdate) {
      updateSpecificAgent(tid, computeUpdate);
    } else {
      const currentAgent = agentsRef.current.find(a => a.id === tid);
      if (!currentAgent) return;
      updateWithHistory(computeUpdate(currentAgent));
    }
    markManualDirty();
  };

  const removeCapabilityFromInstructions = (capabilityName: string, capabilityType: 'knowledge' | 'action' | 'connector' | 'trigger', options?: { skipHistoryUpdate?: boolean; targetAgentId?: string }) => {
    if (capabilityType === 'trigger') {
      removeTriggerFromInstructions(capabilityName, options);
      return;
    }

    const tid = options?.targetAgentId ?? currentAgentId;
    if (!tid) return;

    const computeUpdate = (currentAgent: AgentConfig): Partial<AgentConfig> => {
      const newCapabilities = (currentAgent.capabilities || []).filter(cap => cap.name !== capabilityName);
      let instructions = currentAgent.instructions || '';

      // Remove the pill reference from instructions.
      // Actions are referenced as [[Tool: Name]], knowledge as [[Name]].
      const escapedName = capabilityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pillPattern = capabilityType === 'action'
        ? new RegExp(`\\[\\[Tool: ${escapedName}\\]\\]`, 'g')
        : new RegExp(`\\[\\[${escapedName}\\]\\]`, 'g');
      instructions = instructions.replace(pillPattern, '').replace(/\n{3,}/g, '\n\n').trim();

      return { instructions, capabilities: newCapabilities };
    };

    if (options?.skipHistoryUpdate) {
      updateSpecificAgent(tid, computeUpdate);
    } else {
      const currentAgent = agentsRef.current.find(a => a.id === tid);
      if (!currentAgent) return;
      updateWithHistory(computeUpdate(currentAgent));
    }
    markManualDirty();
  };

  const softDeleteTrigger = (triggerName: string) => {
    if (!currentAgentId) return;
    const currentAgent = agents.find(a => a.id === currentAgentId);
    if (!currentAgent) return;
    const existing = currentAgent.softDeletedTriggers ?? [];
    if (existing.includes(triggerName)) return;
    updateWithHistory({ softDeletedTriggers: [...existing, triggerName] });
  };

  const restoreTrigger = (triggerName: string) => {
    if (!currentAgentId) return;
    const currentAgent = agents.find(a => a.id === currentAgentId);
    if (!currentAgent) return;
    const filtered = (currentAgent.softDeletedTriggers ?? []).filter(n => n !== triggerName);
    updateWithHistory({ softDeletedTriggers: filtered.length > 0 ? filtered : undefined });
  };

  const commitSoftDeletedTriggers = () => {
    if (!currentAgentId) return;
    const currentAgent = agents.find(a => a.id === currentAgentId);
    if (!currentAgent) return;
    const toRemove = currentAgent.softDeletedTriggers ?? [];
    if (toRemove.length === 0) return;

    let instructions = currentAgent.instructions || '';
    let capabilities = [...(currentAgent.capabilities || [])];
    let triggerDistribution = currentAgent.triggerDistribution
      ? { ...currentAgent.triggerDistribution }
      : undefined;

    for (const triggerName of toRemove) {
      capabilities = capabilities.filter(cap => cap.name !== triggerName);
      const escapedName = triggerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tokenPatterns = [
        new RegExp(`,\\s*\\{\\{icon:[^}]+\\}\\}\\s*\\[\\[${escapedName}\\]\\]`, 'g'),
        new RegExp(`\\{\\{icon:[^}]+\\}\\}\\s*\\[\\[${escapedName}\\]\\],\\s*`, 'g'),
        new RegExp(`\\{\\{icon:[^}]+\\}\\}\\s*\\[\\[${escapedName}\\]\\]`, 'g'),
        new RegExp(`,\\s*\\[\\[${escapedName}\\]\\]`, 'g'),
        new RegExp(`\\[\\[${escapedName}\\]\\],\\s*`, 'g'),
        new RegExp(`\\[\\[${escapedName}\\]\\]`, 'g'),
      ];
      for (const pattern of tokenPatterns) {
        instructions = instructions.replace(pattern, '');
      }
      const channel = getTriggerChannel(triggerName);
      if (channel && triggerDistribution?.[channel]) {
        delete triggerDistribution[channel];
        if (Object.keys(triggerDistribution).length === 0) triggerDistribution = undefined;
      }
    }

    const wtaLineMatch = instructions.match(/^(Where this agent works:.*)$/m);
    if (wtaLineMatch && !/\[\[/.test(wtaLineMatch[1])) {
      instructions = instructions.replace(/^Where this agent works:.*\n*/m, '');
    }

    updateAgentConfig({
      instructions: instructions.trim(),
      capabilities,
      triggerDistribution,
      softDeletedTriggers: undefined,
    });
  };

  const setStreamingInstructions = (agentId: string, targetInstructions: string) => {
    setStreamingInstructionsDataState({ agentId, targetInstructions });
  };

  const clearStreamingInstructions = () => {
    setStreamingInstructionsDataState(null);
  };

  // ── Live instructions reader registry ────────────────────────────────────────
  // Allows the helper agent to read the editor's live draft (including un-flushed
  // keystrokes) rather than the last-committed agentConfig.instructions value.
  const instructionsReadersRef = useRef<Map<string, () => string>>(new Map());

  const registerInstructionsReader = useCallback((agentId: string, reader: () => string) => {
    instructionsReadersRef.current.set(agentId, reader);
  }, []);

  const unregisterInstructionsReader = useCallback((agentId: string) => {
    instructionsReadersRef.current.delete(agentId);
  }, []);

  const getLatestInstructions = useCallback((agentId: string): string | null => {
    const reader = instructionsReadersRef.current.get(agentId);
    return reader ? reader() : null;
  }, []);

  // Memoize the context value so consumers only re-render when actual state changes,
  // not on every parent re-render. Deps include all state/derived values; function
  // identities (useState setters, useCallback, FeatureToggle setters) are stable and
  // excluded from deps — they are captured fresh whenever the memo recomputes.
  const value = useMemo(() => ({
    agents,
    currentAgentId,
    agentConfig,
    createAgent,
    loadSpecAgent,
    updateAgentConfig,
    updateWithHistory,
    takeSnapshot,
    updateWorkflowNodes,
    undo,
    redo,
    canUndo,
    canRedo,
    undoLabel,
    redoLabel,
    updateSpecificAgent,
    switchAgent,
    deleteAgent,
    clearAllAgents,
    addCapabilityToInstructions,
    removeTriggerFromInstructions,
    removeCapabilityFromInstructions,
    softDeleteTrigger,
    restoreTrigger,
    commitSoftDeletedTriggers,
    helperMessages,
    agentHelperMessages,
    addHelperMessage,
    addHelperMessageForAgent,
    updateHelperMessageForAgent,
    removeHelperMessageForAgent,
    removeStreamingMessagesForAgent,
    removeE2EHelperMessages,
    clearHelperMessagesForAgent,
    clearHelperMessages,
    previewMessages,
    addPreviewMessage,
    clearPreviewMessages,
    hasTestedAgent,
    markAgentTested,
    evaluations,
    addEvaluation,
    monitoringData,
    setMonitoringData,
    currentPage,
    setCurrentPage,
    isInConversationMode,
    setIsInConversationMode,
    isConversationalLayout,
    setIsConversationalLayout,
    pendingAgentData,
    setPendingAgentData,
    streamingInstructionsData,
    setStreamingInstructions,
    clearStreamingInstructions,
    userName,
    setUserName,
    isEvalMode,
    setIsEvalMode,
    isAgentErrorSimulation,
    setIsAgentErrorSimulation: setIsAgentErrorSimulationWithSideEffect,
    resolvedErrorIds,
    resolveSimulatedError,
    isInterviewMode,
    setIsInterviewMode,
    showConversationalLayoutFeature,
    setShowConversationalLayoutFeature,
    isPlanMode,
    setIsPlanMode,
    isProjectMode,
    setIsProjectMode,
    isShareCoauthoring,
    setIsShareCoauthoring,
    showEvalResults,
    setShowEvalResults,
    showPersonalAgentOption,
    setShowPersonalAgentOption,
    isAiAutocomplete,
    setIsAiAutocomplete,
    isNewNotifications,
    setIsNewNotifications,
    knowledgeErrors,
    setKnowledgeErrors,
    clearKnowledgeErrors,
    isPublishHAEnabled,
    setIsPublishHAEnabled,
    publishScenario,
    setPublishScenario,
    isHAReviewUIEnabled,
    setIsHAReviewUIEnabled,
    isCreateFlowChecklist,
    setIsCreateFlowChecklist,
    helperAgentReviewSnapshot,
    setHelperAgentReview,
    clearHelperAgentReview,
    highlightAllChanges,
    setHighlightAllChanges,
    captureAgentSnapshot,
    isL1NavJuneProposal: isL1NavJuneProposalState,
    setIsL1NavJuneProposal,
    skills,
    addSkill,
    updateSkill,
    deleteSkill,
    isSkillsEnabled,
    setIsSkillsEnabled,
    isFlowCaptureEnabled,
    setIsFlowCaptureEnabled,
    isAgentGlobalUndo,
    setIsAgentGlobalUndo,
    savingState,
    setSavingState,
    lastSavedAt,
    isAutoSave: isAutoSaveState,
    setIsAutoSave,
    isManualSave: isManualSaveState,
    setIsManualSave,
    saveNow,
    isManualSaveDirty,
    markManualDirty,
    clearManualDirty,
    commitSave,
    isWorkIQEnabled,
    setIsWorkIQEnabled,
    isPointToAsk,
    setIsPointToAsk,
    isStepTypeVisuals,
    setIsStepTypeVisuals,
    isWorkflowTestingV2,
    setIsWorkflowTestingV2,
    isTriggersEnabled,
    setIsTriggersEnabled,
    isVersionHistory: isVersionHistoryState,
    setShowVersionMilestones,
    showVersionMilestones: showVersionMilestonesState,
    setShowDraftCheckpoints,
    showDraftCheckpoints: showDraftCheckpointsState,
    setIsVersionHistory,
    agentVersionHistory,
    saveVersionEntry,
    restoreVersion,
    isToolsDA,
    setIsToolsDA,
    isToolsCA,
    setIsToolsCA,
    isDistributeEnabled,
    setIsDistributeEnabled,
    isMonitorV2,
    setIsMonitorV2,
    projects,
    addProject,
    updateProject,
    deleteProject,
    buildGuideProjects,
    buildGuideProjectsLoading,
    leaderboard,
    refreshLeaderboard,
    submitFeedback,
    feedbackSubmitted,
    setFeedbackSubmitted,
    navOrder,
    reorderNavAgents,
    theme,
    setTheme,
    density,
    setDensity,
    environment,
    setEnvironment,
    isInstructionsHeaderStuck,
    setIsInstructionsHeaderStuck,
    isBuildTabsEnabled,
    setIsBuildTabsEnabled,
    isInsertComponents,
    setIsInsertComponents,
    isComponentDrawer,
    setIsComponentDrawer,
    isAgentTypeBadge: isAgentTypeBadgeState,
    setIsAgentTypeBadge,
    isPillContextMenu,
    setIsPillContextMenu,
    isCopilotEndpoint,
    copilotTierModels,
    setCopilotTierModel,
    getLatestInstructions,
    registerInstructionsReader,
    unregisterInstructionsReader,
    selectedActivityRun,
    setSelectedActivityRun,
    pendingScrollTarget,
    setPendingScrollTarget,
    pendingHelperInput,
    setPendingHelperInput,
    pendingHelperAutoSubmit,
    setPendingHelperAutoSubmit,
    pendingHelperQuote,
    setPendingHelperQuote,
    isHelperCollapsed,
    setIsHelperCollapsed,
    setHelperCollapsedDefault,
    toggleHelperCollapsed,
    isEvalsV2: isEvalsV2State,
    setIsEvalsV2,
    messageEvals,
    setMessageEval,
    userSnapshots,
    saveAgentSnapshot,
    buildAgentSnapshot,
    deleteUserSnapshot,
    duplicateSnapshot,
    updateUserSnapshot,
    addUserSnapshot,
    activateSnapshot,
  }), [
    // State & derived values — these are the signals that should trigger consumer re-renders
    agents, currentAgentId, agentConfig, canUndo, canRedo, undoLabel, redoLabel,
    helperMessages, agentHelperMessages, previewMessages, hasTestedAgent,
    evaluations, monitoringData, currentPage, isInConversationMode, isConversationalLayout,
    pendingAgentData, streamingInstructionsData, userName, resolvedErrorIds,
    knowledgeErrors, helperAgentReviewSnapshot, highlightAllChanges, skills,
    savingState, lastSavedAt, isManualSaveDirty, agentVersionHistory, projects, buildGuideProjects, buildGuideProjectsLoading,
    leaderboard, feedbackSubmitted, navOrder, theme, density, environment,
    isInstructionsHeaderStuck, selectedActivityRun, pendingScrollTarget,
    pendingHelperInput, pendingHelperAutoSubmit, pendingHelperQuote, isHelperCollapsed,
    messageEvals, userSnapshots,
    // Feature toggle values (from FeatureToggleContext — change infrequently)
    isEvalMode, isAgentErrorSimulation, isInterviewMode, showConversationalLayoutFeature,
    isPlanMode, isProjectMode, isShareCoauthoring, showEvalResults, showPersonalAgentOption,
    isAiAutocomplete, isNewNotifications, isPublishHAEnabled,
    publishScenario, isHAReviewUIEnabled, isCreateFlowChecklist, isL1NavJuneProposalState,
    isSkillsEnabled, isFlowCaptureEnabled, isAgentGlobalUndo, isWorkIQEnabled,
    isPointToAsk, isStepTypeVisuals, isWorkflowTestingV2, isTriggersEnabled,
    isVersionHistoryState, showVersionMilestonesState, showDraftCheckpointsState,
    isToolsDA, isToolsCA, isDistributeEnabled, isMonitorV2, isBuildTabsEnabled,
    isInsertComponents, isComponentDrawer, isAgentTypeBadgeState, isPillContextMenu,
    copilotTierModels, isEvalsV2State, isAutoSaveState,
    isManualSaveState, isCopilotEndpoint,
    // useCallback functions (stable identities, included for correctness)
    createAgent, loadSpecAgent, clearHelperAgentReview, captureAgentSnapshot,
    getLatestInstructions, registerInstructionsReader, unregisterInstructionsReader,
    saveNow, markManualDirty, clearManualDirty, commitSave,
     
  ]);

  return (
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
  );
};

export const useAgent = () => {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgent must be used within AgentProvider');
  }
  return context;
};
