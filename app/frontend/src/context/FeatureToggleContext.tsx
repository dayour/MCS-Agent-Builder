import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { initFlag } from '../utils/featureFlagQuerySync';
import { setTierOverride, COPILOT_TIER_OPTIONS, MODEL_ENDPOINT } from '../config/endpointConfig';
import type { ModelTier } from '../config/endpointConfig';

export interface FeatureToggleContextType {
  // ── Evaluation ──────────────────────────────────────────────────────────────
  isEvalMode: boolean;
  setIsEvalMode: (value: boolean) => void;
  showEvalResults: boolean;
  setShowEvalResults: (value: boolean) => void;
  isAgentErrorSimulation: boolean;
  setIsAgentErrorSimulation: (value: boolean) => void;
  isEvalsV2: boolean;
  setIsEvalsV2: (value: boolean) => void;

  // ── Homepage / creation flow ─────────────────────────────────────────────────
  isInterviewMode: boolean;
  setIsInterviewMode: (value: boolean) => void;
  showPersonalAgentOption: boolean;
  setShowPersonalAgentOption: (value: boolean) => void;
  isPlanMode: boolean;
  setIsPlanMode: (value: boolean) => void;
  isProjectMode: boolean;
  setIsProjectMode: (value: boolean) => void;
  isShareCoauthoring: boolean;
  setIsShareCoauthoring: (value: boolean) => void;
  isAiAutocomplete: boolean;
  setIsAiAutocomplete: (value: boolean) => void;

  // ── UI/UX ────────────────────────────────────────────────────────────────────
  showConversationalLayoutFeature: boolean;
  setShowConversationalLayoutFeature: (value: boolean) => void;
  isL1NavJuneProposal: boolean;
  setIsL1NavJuneProposal: (value: boolean) => void;
  isNewNotifications: boolean;
  setIsNewNotifications: (value: boolean) => void;
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

  // ── Helper Agent / Build ─────────────────────────────────────────────────────
  isPublishHAEnabled: boolean;
  setIsPublishHAEnabled: (value: boolean) => void;
  isHAReviewUIEnabled: boolean;
  setIsHAReviewUIEnabled: (value: boolean) => void;
  isCreateFlowChecklist: boolean;
  setIsCreateFlowChecklist: (value: boolean) => void;

  // ── Features / capabilities ──────────────────────────────────────────────────
  isWorkIQEnabled: boolean;
  setIsWorkIQEnabled: (value: boolean) => void;
  isSkillsEnabled: boolean;
  setIsSkillsEnabled: (value: boolean) => void;
  isFlowCaptureEnabled: boolean;
  setIsFlowCaptureEnabled: (value: boolean) => void;
  isAgentGlobalUndo: boolean;
  setIsAgentGlobalUndo: (value: boolean) => void;
  isTriggersEnabled: boolean;
  setIsTriggersEnabled: (value: boolean) => void;
  isToolsDA: boolean;
  setIsToolsDA: (value: boolean) => void;
  isToolsCA: boolean;
  setIsToolsCA: (value: boolean) => void;
  isDistributeEnabled: boolean;
  setIsDistributeEnabled: (value: boolean) => void;
  isMonitorV2: boolean;
  setIsMonitorV2: (value: boolean) => void;

  // ── Workflow ─────────────────────────────────────────────────────────────────
  isPointToAsk: boolean;
  setIsPointToAsk: (value: boolean) => void;
  isStepTypeVisuals: boolean;
  setIsStepTypeVisuals: (value: boolean) => void;
  isWorkflowTestingV2: boolean;
  setIsWorkflowTestingV2: (value: boolean) => void;

  // ── Version History ──────────────────────────────────────────────────────────
  isVersionHistory: boolean;
  setIsVersionHistory: (value: boolean) => void;
  showVersionMilestones: boolean;
  setShowVersionMilestones: (value: boolean) => void;
  showDraftCheckpoints: boolean;
  setShowDraftCheckpoints: (value: boolean) => void;

  // ── Model / endpoint config ──────────────────────────────────────────────────
  copilotTierModels: { fast: string; balanced: string; capable: string };
  setCopilotTierModel: (tier: 'fast' | 'balanced' | 'capable', modelId: string) => void;

  // ── Publish scenario preference ──────────────────────────────────────────────
  publishScenario: string;
  setPublishScenario: (value: string) => void;
}

export const FeatureToggleContext = createContext<FeatureToggleContextType | undefined>(undefined);

export const useFeatureToggles = (): FeatureToggleContextType => {
  const ctx = useContext(FeatureToggleContext);
  if (!ctx) throw new Error('useFeatureToggles must be used within FeatureToggleProvider');
  return ctx;
};

export const FeatureToggleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // ── Evaluation ──────────────────────────────────────────────────────────────
  const [isEvalMode, setIsEvalModeState] = useState<boolean>(() => initFlag('isEvalMode'));
  const setIsEvalMode = (value: boolean) => {
    setIsEvalModeState(value);
    localStorage.setItem('isEvalMode', String(value));
  };

  const [showEvalResults, setShowEvalResultsState] = useState<boolean>(() => initFlag('showEvalResults'));
  const setShowEvalResults = (value: boolean) => {
    setShowEvalResultsState(value);
    localStorage.setItem('showEvalResults', String(value));
  };

  const [isAgentErrorSimulation, setIsAgentErrorSimulationState] = useState<boolean>(() =>
    initFlag('isAgentErrorSimulation')
  );
  const setIsAgentErrorSimulation = (value: boolean) => {
    setIsAgentErrorSimulationState(value);
    localStorage.setItem('isAgentErrorSimulation', String(value));
  };

  const [isEvalsV2, setIsEvalsV2State] = useState<boolean>(() => initFlag('isEvalsV2'));
  const setIsEvalsV2 = (value: boolean) => {
    setIsEvalsV2State(value);
    localStorage.setItem('isEvalsV2', String(value));
  };

  // ── Homepage / creation flow ─────────────────────────────────────────────────
  const [isInterviewMode, setIsInterviewModeState] = useState<boolean>(() => initFlag('isInterviewMode'));
  const setIsInterviewMode = (value: boolean) => {
    setIsInterviewModeState(value);
    localStorage.setItem('isInterviewMode', String(value));
  };

  const [showPersonalAgentOption, setShowPersonalAgentOptionState] = useState<boolean>(() =>
    initFlag('showPersonalAgentOption')
  );
  const setShowPersonalAgentOption = (value: boolean) => {
    setShowPersonalAgentOptionState(value);
    localStorage.setItem('showPersonalAgentOption', String(value));
  };

  // Plan mode removed — the home chat now always routes through the unified
  // spec session orchestrator. Kept as an inert constant so any lingering
  // consumer (e.g. tests, old agents with createdWithPlanMode=true) resolves
  // without crashing. Setter is a no-op.
  const isPlanMode = false;
  const setIsPlanMode = (_value: boolean) => { /* removed */ };

  const [isProjectMode, setIsProjectModeState] = useState<boolean>(() => initFlag('isProjectMode'));
  const setIsProjectMode = (value: boolean) => {
    setIsProjectModeState(value);
    localStorage.setItem('isProjectMode', String(value));
  };

  const [isShareCoauthoring, setIsShareCoauthoringState] = useState<boolean>(() => initFlag('isShareCoauthoring'));
  const setIsShareCoauthoring = (value: boolean) => {
    setIsShareCoauthoringState(value);
    localStorage.setItem('isShareCoauthoring', String(value));
  };

  const [isAiAutocomplete, setIsAiAutocompleteState] = useState<boolean>(() =>
    // Default true — disabled only when explicitly set to 'false'
    initFlag('isAiAutocomplete', true)
  );
  const setIsAiAutocomplete = (value: boolean) => {
    setIsAiAutocompleteState(value);
    localStorage.setItem('isAiAutocomplete', String(value));
  };

  // ── UI/UX ────────────────────────────────────────────────────────────────────
  const [showConversationalLayoutFeature, setShowConversationalLayoutFeatureState] = useState<boolean>(() =>
    initFlag('showConversationalLayoutFeature')
  );
  const setShowConversationalLayoutFeature = (value: boolean) => {
    setShowConversationalLayoutFeatureState(value);
    localStorage.setItem('showConversationalLayoutFeature', String(value));
  };

  const [isL1NavJuneProposalState, setIsL1NavJuneProposalState] = useState<boolean>(() =>
    initFlag('isL1NavJuneProposal')
  );
  const setIsL1NavJuneProposal = (value: boolean) => {
    setIsL1NavJuneProposalState(value);
    localStorage.setItem('isL1NavJuneProposal', String(value));
  };

  const [isNewNotifications, setIsNewNotificationsState] = useState<boolean>(() =>
    // Default true — disabled only when explicitly set to 'false'
    initFlag('isNewNotifications', true)
  );
  const setIsNewNotifications = (value: boolean) => {
    setIsNewNotificationsState(value);
    localStorage.setItem('isNewNotifications', String(value));
  };

  const [isBuildTabsEnabled, setIsBuildTabsEnabledState] = useState<boolean>(() =>
    initFlag('isBuildTabsEnabled', true)
  );
  const setIsBuildTabsEnabled = (value: boolean) => {
    setIsBuildTabsEnabledState(value);
    localStorage.setItem('isBuildTabsEnabled', String(value));
  };

  const [isInsertComponents, setIsInsertComponentsState] = useState<boolean>(() =>
    initFlag('isInsertComponents')
  );
  const setIsInsertComponents = (value: boolean) => {
    setIsInsertComponentsState(value);
    localStorage.setItem('isInsertComponents', String(value));
  };

  const [isComponentDrawer, setIsComponentDrawerState] = useState<boolean>(() =>
    initFlag('isComponentDrawer')
  );
  const setIsComponentDrawer = (value: boolean) => {
    setIsComponentDrawerState(value);
    localStorage.setItem('isComponentDrawer', String(value));
  };

  const [isAgentTypeBadgeState, setIsAgentTypeBadgeStateInner] = useState<boolean>(() =>
    initFlag('isAgentTypeBadge')
  );
  const setIsAgentTypeBadge = (value: boolean) => {
    setIsAgentTypeBadgeStateInner(value);
    localStorage.setItem('isAgentTypeBadge', String(value));
  };

  const [isPillContextMenu, setIsPillContextMenuState] = useState<boolean>(() =>
    initFlag('isPillContextMenu', true)
  );
  const setIsPillContextMenu = (value: boolean) => {
    setIsPillContextMenuState(value);
    localStorage.setItem('isPillContextMenu', String(value));
  };

  // ── Helper Agent / Build ─────────────────────────────────────────────────────
  const [isPublishHAEnabled, setIsPublishHAEnabledState] = useState<boolean>(() =>
    initFlag('isPublishHAEnabled', true)
  );
  const setIsPublishHAEnabled = (value: boolean) => {
    setIsPublishHAEnabledState(value);
    localStorage.setItem('isPublishHAEnabled', String(value));
  };

  const [isHAReviewUIEnabled, setIsHAReviewUIEnabledState] = useState<boolean>(() =>
    initFlag('isHAReviewUIEnabled')
  );
  const setIsHAReviewUIEnabled = (value: boolean) => {
    setIsHAReviewUIEnabledState(value);
    localStorage.setItem('isHAReviewUIEnabled', String(value));
  };

  const [isCreateFlowChecklist, setIsCreateFlowChecklistState] = useState<boolean>(() =>
    initFlag('isCreateFlowChecklist')
  );
  const setIsCreateFlowChecklist = (value: boolean) => {
    setIsCreateFlowChecklistState(value);
    localStorage.setItem('isCreateFlowChecklist', String(value));
  };

  // ── Features / capabilities ──────────────────────────────────────────────────
  const [isWorkIQEnabled, setIsWorkIQEnabledState] = useState<boolean>(() => initFlag('isWorkIQEnabled'));
  const setIsWorkIQEnabled = (value: boolean) => {
    setIsWorkIQEnabledState(value);
    localStorage.setItem('isWorkIQEnabled', String(value));
  };

  const [isSkillsEnabled, setIsSkillsEnabledState] = useState<boolean>(() => initFlag('isSkillsEnabled'));
  const setIsSkillsEnabled = (value: boolean) => {
    setIsSkillsEnabledState(value);
    localStorage.setItem('isSkillsEnabled', String(value));
  };

  const [isFlowCaptureEnabled, setIsFlowCaptureEnabledState] = useState<boolean>(() =>
    initFlag('isFlowCaptureEnabled')
  );
  const setIsFlowCaptureEnabled = (value: boolean) => {
    setIsFlowCaptureEnabledState(value);
    localStorage.setItem('isFlowCaptureEnabled', String(value));
  };

  const [isAgentGlobalUndo, setIsAgentGlobalUndoState] = useState<boolean>(() =>
    initFlag('isAgentGlobalUndo')
  );
  const setIsAgentGlobalUndo = (value: boolean) => {
    setIsAgentGlobalUndoState(value);
    localStorage.setItem('isAgentGlobalUndo', String(value));
  };

  const [isTriggersEnabled, setIsTriggersEnabledState] = useState<boolean>(() => initFlag('isTriggersEnabled'));
  const setIsTriggersEnabled = (value: boolean) => {
    setIsTriggersEnabledState(value);
    localStorage.setItem('isTriggersEnabled', String(value));
  };

  const [isToolsDA, setIsToolsDAState] = useState<boolean>(() => initFlag('isToolsDA'));
  const setIsToolsDA = (value: boolean) => {
    setIsToolsDAState(value);
    localStorage.setItem('isToolsDA', String(value));
  };

  // TODO(tools-simplified-CA): isToolsCA is the flag for the CA variant of the tools/connector features.
  const [isToolsCA, setIsToolsCAState] = useState<boolean>(() => initFlag('isToolsCA'));
  const setIsToolsCA = (value: boolean) => {
    setIsToolsCAState(value);
    localStorage.setItem('isToolsCA', String(value));
  };

  const [isDistributeEnabled, setIsDistributeEnabledState] = useState<boolean>(() => initFlag('isDistributeEnabled'));
  const setIsDistributeEnabled = (value: boolean) => {
    setIsDistributeEnabledState(value);
    localStorage.setItem('isDistributeEnabled', String(value));
  };

  const [isMonitorV2, setIsMonitorV2State] = useState<boolean>(() => initFlag('isMonitorV2'));
  const setIsMonitorV2 = (value: boolean) => {
    setIsMonitorV2State(value);
    localStorage.setItem('isMonitorV2', String(value));
  };

  // ── Workflow ─────────────────────────────────────────────────────────────────
  const [isPointToAsk, setIsPointToAskState] = useState<boolean>(() => initFlag('isPointToAsk'));
  const setIsPointToAsk = (value: boolean) => {
    setIsPointToAskState(value);
    localStorage.setItem('isPointToAsk', String(value));
  };

  const [isStepTypeVisuals, setIsStepTypeVisualsState] = useState<boolean>(() => initFlag('isStepTypeVisuals'));
  const setIsStepTypeVisuals = (value: boolean) => {
    setIsStepTypeVisualsState(value);
    localStorage.setItem('isStepTypeVisuals', String(value));
  };

  const [isWorkflowTestingV2, setIsWorkflowTestingV2State] = useState<boolean>(() => initFlag('isWorkflowTestingV2'));
  const setIsWorkflowTestingV2 = (value: boolean) => {
    setIsWorkflowTestingV2State(value);
    localStorage.setItem('isWorkflowTestingV2', String(value));
  };

  // ── Version History ──────────────────────────────────────────────────────────
  const [isVersionHistory, setIsVersionHistoryState] = useState<boolean>(() => initFlag('isVersionHistory'));
  const setIsVersionHistory = (value: boolean) => {
    setIsVersionHistoryState(value);
    localStorage.setItem('isVersionHistory', String(value));
  };

  const [showVersionMilestones, setShowVersionMilestonesState] = useState<boolean>(() =>
    initFlag('showVersionMilestones', true)
  );
  const setShowVersionMilestones = (value: boolean) => {
    setShowVersionMilestonesState(value);
    localStorage.setItem('showVersionMilestones', String(value));
  };

  const [showDraftCheckpoints, setShowDraftCheckpointsState] = useState<boolean>(() =>
    initFlag('showDraftCheckpoints', true)
  );
  const setShowDraftCheckpoints = (value: boolean) => {
    setShowDraftCheckpointsState(value);
    localStorage.setItem('showDraftCheckpoints', String(value));
  };

  // ── Model / endpoint config ──────────────────────────────────────────────────
  const isCopilotEndpoint = MODEL_ENDPOINT === 'copilot';

  const defaultCopilotModels = {
    fast: COPILOT_TIER_OPTIONS.fast[0].id,
    balanced: COPILOT_TIER_OPTIONS.balanced[0].id,
    capable: COPILOT_TIER_OPTIONS.capable[0].id,
  };

  const [copilotTierModels, setCopilotTierModelsState] = useState<{ fast: string; balanced: string; capable: string }>(() => {
    try {
      const saved = localStorage.getItem('copilotTierModels');
      if (!saved) return defaultCopilotModels;
      const parsed = JSON.parse(saved);
      if (!parsed || typeof parsed !== 'object') return defaultCopilotModels;
      // Merge with defaults to fill any missing/invalid tier keys
      return {
        fast: typeof parsed.fast === 'string' ? parsed.fast : defaultCopilotModels.fast,
        balanced: typeof parsed.balanced === 'string' ? parsed.balanced : defaultCopilotModels.balanced,
        capable: typeof parsed.capable === 'string' ? parsed.capable : defaultCopilotModels.capable,
      };
    } catch { return defaultCopilotModels; }
  });

  const setCopilotTierModel = (tier: ModelTier, modelId: string) => {
    const updated = { ...copilotTierModels, [tier]: modelId };
    setCopilotTierModelsState(updated);
    localStorage.setItem('copilotTierModels', JSON.stringify(updated));
    if (isCopilotEndpoint) {
      setTierOverride(tier, modelId);
    }
  };

  // Apply tier overrides on mount when using Copilot endpoint
  useEffect(() => {
    if (isCopilotEndpoint) {
      (Object.entries(copilotTierModels) as [ModelTier, string][]).forEach(([tier, modelId]) => {
        setTierOverride(tier, modelId);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Publish scenario preference ──────────────────────────────────────────────
  const [publishScenario, setPublishScenarioState] = useState<string>(() => {
    return localStorage.getItem('publishScenario') || 'happy-path';
  });
  const setPublishScenario = (value: string) => {
    setPublishScenarioState(value);
    localStorage.setItem('publishScenario', value);
  };

  const value = useMemo(() => ({
    // Evaluation
    isEvalMode,
    setIsEvalMode,
    showEvalResults,
    setShowEvalResults,
    isAgentErrorSimulation,
    setIsAgentErrorSimulation,
    isEvalsV2,
    setIsEvalsV2,
    // Homepage / creation flow
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
    // UI/UX
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
    // Helper Agent / Build
    isPublishHAEnabled,
    setIsPublishHAEnabled,
    isHAReviewUIEnabled,
    setIsHAReviewUIEnabled,
    isCreateFlowChecklist,
    setIsCreateFlowChecklist,
    // Features / capabilities
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
    // Workflow
    isPointToAsk,
    setIsPointToAsk,
    isStepTypeVisuals,
    setIsStepTypeVisuals,
    isWorkflowTestingV2,
    setIsWorkflowTestingV2,
    // Version History
    isVersionHistory,
    setIsVersionHistory,
    showVersionMilestones,
    setShowVersionMilestones,
    showDraftCheckpoints,
    setShowDraftCheckpoints,
    // Model / endpoint config
    copilotTierModels,
    setCopilotTierModel,
    // Publish scenario preference
    publishScenario,
    setPublishScenario,
  }), [
    isEvalMode, showEvalResults, isAgentErrorSimulation, isEvalsV2,
    isInterviewMode, showPersonalAgentOption, isPlanMode, isProjectMode, isShareCoauthoring, isAiAutocomplete,
    showConversationalLayoutFeature, isL1NavJuneProposalState, isNewNotifications,
    isBuildTabsEnabled, isInsertComponents, isComponentDrawer, isAgentTypeBadgeState, isPillContextMenu,
    isPublishHAEnabled, isHAReviewUIEnabled, isCreateFlowChecklist,
    isWorkIQEnabled, isSkillsEnabled, isFlowCaptureEnabled, isAgentGlobalUndo,
    isTriggersEnabled, isToolsDA, isToolsCA, isDistributeEnabled, isMonitorV2,
    isPointToAsk, isStepTypeVisuals, isWorkflowTestingV2,
    isVersionHistory, showVersionMilestones, showDraftCheckpoints,
    copilotTierModels, publishScenario,
    // setters are stable (defined inline) — not needed in deps
     
  ]);

  return <FeatureToggleContext.Provider value={value}>{children}</FeatureToggleContext.Provider>;
};
