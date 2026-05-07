import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAgent } from '../../context/AgentContext';
import { useDW } from '../../domains/dw/context/DWContext';
import { useWorkflow } from '../../context/WorkflowContext';
import { useFeatureToggles } from '../../context/FeatureToggleContext';
import { CopilotButton } from '../ui/CopilotButton';
import { CopilotTooltip } from '../ui/CopilotTooltip';
import { DeleteConfirmDialog } from '../ui/DeleteConfirmDialog';
import { SettingsModal } from '../SettingsModal';
import {
  Home24Regular, Home24Filled,
  AddCircle24Regular, AddCircle24Filled,
  Layer24Regular, Layer24Filled,
  PanelLeftExpand20Regular, PanelLeftContract20Regular,
  GlobeSurface20Regular, GlobeSurface20Filled,
  Flag20Regular, Flag20Filled,
  Organization20Regular, Organization20Filled,
  Library20Regular, Library20Filled,
  Delete20Regular,
} from '@fluentui/react-icons';

import { NavigationRailProps, LiveFlag } from './NavTypes';
import { COPILOT_TIER_OPTIONS } from '../../config/endpointConfig';
import type { ModelTier } from '../../config/endpointConfig';
import { CopilotDropdown } from '../ui/CopilotDropdown';
import { CopilotBadge } from '../ui/CopilotBadge';
import {
  navBtnBase, navBtnActive, navBtnInactive,
  iconContainerClass, textFadeIn, textFadeOut,
  AgentsNavIcon, FlowsNavIcon,
} from './NavConstants';
import { NavAgentList } from './NavAgentList';
import { NavAccountRow } from './NavAccountRow';
import { NavEnvPicker } from './NavEnvPicker';
import { NavAppsFlyout } from './NavAppsFlyout';
import { NavFeatureFlagsPanel } from './NavFeatureFlagsPanel';
import { stripFlagParamsFromUrl } from '../../utils/featureFlagQuerySync';

export const NavigationRail: React.FC<NavigationRailProps> = ({
  isNavExpanded,
  setIsNavExpanded,
  isHomePage,
  agents,
  currentAgentId,
  switchAgent,
  isInConversationMode,
  setIsInConversationMode,
  pendingAgentData,
  isLanding = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    clearAllAgents, userName, setUserName,
    setPendingAgentData,
    isCopilotEndpoint,
    isAutoSave, setIsAutoSave,
    isManualSave, setIsManualSave,
    projects, deleteProject,
    updateSpecificAgent, reorderNavAgents, deleteAgent,
  } = useAgent();

  const {
    isEvalMode, setIsEvalMode,
    isInterviewMode, setIsInterviewMode,
    showConversationalLayoutFeature, setShowConversationalLayoutFeature,
    showEvalResults, setShowEvalResults,
    showPersonalAgentOption, setShowPersonalAgentOption,
    isAiAutocomplete, setIsAiAutocomplete,
    isL1NavJuneProposal, setIsL1NavJuneProposal,
    isBuildTabsEnabled, setIsBuildTabsEnabled,
    isInsertComponents, setIsInsertComponents,
    isComponentDrawer, setIsComponentDrawer,
    isAgentTypeBadge, setIsAgentTypeBadge,
    isPillContextMenu, setIsPillContextMenu,
    isPublishHAEnabled, setIsPublishHAEnabled,
    copilotTierModels, setCopilotTierModel,
    isSkillsEnabled, setIsSkillsEnabled,
    isFlowCaptureEnabled, setIsFlowCaptureEnabled,
    isAgentGlobalUndo, setIsAgentGlobalUndo,
    isEvalsV2, setIsEvalsV2,
    isWorkIQEnabled, setIsWorkIQEnabled,
    isNewNotifications, setIsNewNotifications,
    isAgentErrorSimulation, setIsAgentErrorSimulation,
    isHAReviewUIEnabled, setIsHAReviewUIEnabled,
    isCreateFlowChecklist, setIsCreateFlowChecklist,
    isStepTypeVisuals, setIsStepTypeVisuals,
    isWorkflowTestingV2, setIsWorkflowTestingV2,
    isTriggersEnabled, setIsTriggersEnabled,
    isVersionHistory, setIsVersionHistory,
    showVersionMilestones, setShowVersionMilestones,
    showDraftCheckpoints, setShowDraftCheckpoints,
    isToolsDA, setIsToolsDA,
    isToolsCA, setIsToolsCA,
    isDistributeEnabled, setIsDistributeEnabled,
    isMonitorV2, setIsMonitorV2,
    isProjectMode, setIsProjectMode,
    isShareCoauthoring, setIsShareCoauthoring,
  } = useFeatureToggles();

  const { workflowVersion, setWorkflowVersion } = useWorkflow();

  const { isDexter, setIsDexter, isAiTeammateDay100, setIsAiTeammateDay100 } = useDW();

  // ── MCS: Fetch real credentials from backend on mount ──────────────────
  const [credentials, setCredentials] = useState<any>(null);
  const [pacProfiles, setPacProfiles] = useState<any[]>([]);
  const [pacEnvironments, setPacEnvironments] = useState<any[]>([]);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    fetch('/api/readiness/credentials')
      .then(r => r.json())
      .then(data => {
        setCredentials(data);
        setPacProfiles(data.pacProfiles || []);
        setPacEnvironments(data.pacEnvironments || []);
        // Set user name from az account — prefer displayName from Azure AD
        if (!userName && data.azAccount) {
          const name = data.azAccount.displayName       // "Dennis Kim" from az ad signed-in-user
            || data.azAccount.user?.split('@')[0];       // fallback to email prefix
          if (name) {
            // Show first name only
            const firstName = name.split(' ')[0];
            setUserName(firstName.charAt(0).toUpperCase() + firstName.slice(1));
          }
        }
        // Set environment from active PAC environment
        const activeEnv = (data.pacEnvironments || []).find((e: any) => e.active);
        if (activeEnv) {
          setSelectedEnvName(activeEnv.name);
        }
        setAuthLoading(false);
      })
      .catch(() => setAuthLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const navDisplayName = userName || (credentials?.azAccount?.displayName?.split(' ')[0]) || 'User';
  const navInitials = navDisplayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  // Nav expand/collapse
  const [isClickExpanded, setIsClickExpanded] = useState(false);
  const navRootRef = useRef<HTMLDivElement>(null);
  const effectiveExpanded = isNavExpanded || isClickExpanded;

  // Suppress the expand icon flash during the collapse animation.
  // Uses a ref + delayed state so the expand icon doesn't appear until
  // the width transition (500ms) completes.
  const [showExpandIcon, setShowExpandIcon] = useState(!effectiveExpanded);
  const expandTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    clearTimeout(expandTimerRef.current);
    if (effectiveExpanded) {
      setShowExpandIcon(false);
    } else {
      expandTimerRef.current = setTimeout(() => setShowExpandIcon(true), 500);
    }
    return () => clearTimeout(expandTimerRef.current);
  }, [effectiveExpanded]);

  // Flyout state — declared before the outside-click effect so envPickerOpen is in scope
  const [appsOpen, setAppsOpen] = useState(false);
  const [appsPos, setAppsPos] = useState<{ bottom: number; left: number } | null>(null);
  const [envPickerOpen, setEnvPickerOpen] = useState(false);
  const [envPickerPos, setEnvPickerPos] = useState<{ bottom: number; left: number } | null>(null);
  const [selectedEnvName, setSelectedEnvName] = useState(() => localStorage.getItem('mcs-env') || 'Loading...');

  useEffect(() => {
    if (!isClickExpanded || envPickerOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (navRootRef.current && !navRootRef.current.contains(e.target as Node)) setIsClickExpanded(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isClickExpanded, envPickerOpen]);

  // Dialogs
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [featurePanelOpen, setFeaturePanelOpen] = useState(false);

  // Legacy feature toggle button
  const navContainerRef = useRef<HTMLDivElement>(null);
  const bottomSectionRef = useRef<HTMLDivElement>(null);

  // Visible agents count (legacy overflow calculation)
  const [visibleAgentsCount, setVisibleAgentsCount] = useState(agents.length);
  const agentListTopRef = useRef<HTMLDivElement>(null);
  const showPendingAgent = isInConversationMode && isHomePage;

  useEffect(() => {
    const calculateVisibleAgents = () => {
      if (!bottomSectionRef.current || !agentListTopRef.current || agents.length === 0) {
        setVisibleAgentsCount(agents.length);
        return;
      }
      try {
        const agentListTop = agentListTopRef.current.getBoundingClientRect().top;
        const bottomTop = bottomSectionRef.current.getBoundingClientRect().top;
        const availableHeight = bottomTop - agentListTop;
        const agentItemHeight = 52;
        const overflowButtonHeight = 52;
        const pendingItemHeight = showPendingAgent ? agentItemHeight : 0;
        const maxFitAll = Math.floor((availableHeight - pendingItemHeight) / agentItemHeight);
        if (maxFitAll >= agents.length) {
          setVisibleAgentsCount(agents.length);
        } else {
          const maxFitWithOverflow = Math.floor((availableHeight - overflowButtonHeight - pendingItemHeight) / agentItemHeight);
          setVisibleAgentsCount(Math.max(1, maxFitWithOverflow));
        }
      } catch { setVisibleAgentsCount(agents.length); }
    };
    calculateVisibleAgents();
    const timer = setTimeout(calculateVisibleAgents, 100);
    window.addEventListener('resize', calculateVisibleAgents);
    return () => { clearTimeout(timer); window.removeEventListener('resize', calculateVisibleAgents); };
  }, [agents.length, isNavExpanded, showPendingAgent]);

  // Model selection section — shown in flags panel when using Copilot endpoint
  const modelSelectionContent = isCopilotEndpoint ? (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-[hsl(var(--nav-text-primary))]">Model Selection</h3>
          <p className="text-xs text-[hsl(var(--nav-text-secondary))] mt-0.5">GitHub Copilot endpoint — select model per tier</p>
        </div>
        <CopilotBadge appearance="tint" color="brand" size="small">Copilot</CopilotBadge>
      </div>
      <div className="space-y-3">
        {(['fast', 'balanced', 'capable'] as ModelTier[]).map(tier => (
          <div key={tier}>
            <p className="text-xs text-[hsl(var(--nav-text-secondary))] mb-1 capitalize">{tier} tier</p>
            <CopilotDropdown
              variant="dropdown"
              size="sm"
              value={copilotTierModels[tier]}
              onChange={value => setCopilotTierModel(tier, value)}
              options={COPILOT_TIER_OPTIONS[tier].map(opt => ({
                value: opt.id,
                label: opt.label,
              }))}
            />
          </div>
        ))}
      </div>
    </div>
  ) : (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[hsl(var(--nav-text-primary))]">Model Endpoint</h3>
          <p className="text-xs text-[hsl(var(--nav-text-secondary))] mt-0.5">
            Active: <span className="font-medium capitalize">{process.env.REACT_APP_MODEL_ENDPOINT || 'copilot'}</span>
          </p>
        </div>
      </div>
    </div>
  );

  // Feature flags data
   
  const allFlags = useMemo<LiveFlag[]>(() => [
    { id: 'evalMode', queryKey: 'isEvalMode', label: 'Eval Mode', description: 'Enable evaluation-specific UI', category: 'Evaluation', tags: ['eval'], active: isEvalMode, onToggle: () => { if (!isEvalMode && !userName) { const name = window.prompt("What's your name?"); if (!name) return; setUserName(name); } setIsEvalMode(!isEvalMode); } },
    { id: 'evalResults', queryKey: 'showEvalResults', label: 'See Current Eval Results', description: 'Show button to view evaluation reports', category: 'Evaluation', tags: ['eval'], active: showEvalResults, onToggle: () => setShowEvalResults(!showEvalResults) },
    { id: 'evalsV2', queryKey: 'isEvalsV2', label: 'Evals v2', description: 'Enables inline response rating (★ Rate button) in Helper Agent and Preview chats, and adds Eval Results + Helper Agent Evals tabs to the Evaluate page', category: 'Evaluation', tags: ['eval'], active: isEvalsV2, onToggle: () => setIsEvalsV2(!isEvalsV2) },
    { id: 'dexter', queryKey: 'isDexter', label: 'Dexter', description: 'Provision real Dexter Control Plane workers when creating Digital Worker (AI Teammate) agents; requires REACT_APP_DEXTER_* env vars', category: 'Experimental', tags: ['dexter'], active: isDexter, onToggle: () => setIsDexter(!isDexter) },
    { id: 'aiTeammateDay100', queryKey: 'isAiTeammateDay100', label: 'AI Teammate Day 100', description: 'Enables the Day 100 experience for AI Teammates — shows populated tasks, metrics, and activity data', category: 'Experimental', tags: ['dexter', 'dw'], active: isAiTeammateDay100, onToggle: () => setIsAiTeammateDay100(!isAiTeammateDay100) },
    { id: 'agentGlobalUndo', queryKey: 'isAgentGlobalUndo', label: 'Agent Global Undo', description: 'Enable global undo/redo for all agent state changes (beyond instructions)', category: 'Experimental', tags: ['undo'], active: isAgentGlobalUndo, onToggle: () => setIsAgentGlobalUndo(!isAgentGlobalUndo) },
    { id: 'skillsEnabled', queryKey: 'isSkillsEnabled', label: 'Skills', description: 'Enable skills panel for agents', category: 'Experimental', tags: ['skills'], active: isSkillsEnabled, onToggle: () => setIsSkillsEnabled(!isSkillsEnabled) },
    { id: 'workIQ', queryKey: 'isWorkIQEnabled', label: 'Work IQ', description: 'M365 context layer for helper agents using MCP servers', category: 'Experimental', tags: ['mcp', 'm365'], active: isWorkIQEnabled, onToggle: () => setIsWorkIQEnabled(!isWorkIQEnabled) },
    { id: 'newNotifications', queryKey: 'isNewNotifications', label: 'New Notifications', description: 'Toast notification system with bell icon and notification history', category: 'UI/UX', tags: ['notifications'], active: isNewNotifications, onToggle: () => setIsNewNotifications(!isNewNotifications) },
    { id: 'aiAutocomplete', queryKey: 'isAiAutocomplete', label: 'AI Autocomplete', description: 'Homepage prompt suggestions', category: 'Experimental', tags: ['homepage'], active: isAiAutocomplete, onToggle: () => setIsAiAutocomplete(!isAiAutocomplete) },
    { id: 'conversationalLayout', queryKey: 'showConversationalLayoutFeature', label: 'Conversational Layout', description: 'Show layout toggle in header', category: 'UI/UX', tags: ['layout'], active: showConversationalLayoutFeature, onToggle: () => setShowConversationalLayoutFeature(!showConversationalLayoutFeature) },
    { id: 'l1NavJuneProposal', queryKey: 'isL1NavJuneProposal', label: 'L1 Nav June Proposal', description: 'Switches Home→Create and My Projects→Agents nav labels; click-to-expand is now always on', category: 'UI/UX', tags: ['nav'], active: isL1NavJuneProposal, onToggle: () => setIsL1NavJuneProposal(!isL1NavJuneProposal) },
    { id: 'buildTabs', queryKey: 'isBuildTabsEnabled', label: 'Build Tabs', description: 'Show build tabs in agent editor', category: 'UI/UX', tags: ['build'], active: isBuildTabsEnabled, onToggle: () => setIsBuildTabsEnabled(!isBuildTabsEnabled) },
    { id: 'insertComponents', queryKey: 'isInsertComponents', label: 'Insert Components', description: 'Pill-style tab switcher with brand styling for Instructions/Components tabs', category: 'UI/UX', tags: ['build', 'instructions'], active: isInsertComponents, onToggle: () => setIsInsertComponents(!isInsertComponents) },
    { id: 'componentDrawer', queryKey: 'isComponentDrawer', label: 'Component Drawer', description: 'Show components in a bottom drawer overlay on instructions', category: 'UI/UX', tags: ['build'], active: isComponentDrawer, onToggle: () => setIsComponentDrawer(!isComponentDrawer) },
    { id: 'agentTypeBadge', queryKey: 'isAgentTypeBadge', label: 'Agent Type Badge', description: 'Show agent type badge on agent cards', category: 'UI/UX', tags: ['agents'], active: isAgentTypeBadge, onToggle: () => setIsAgentTypeBadge(!isAgentTypeBadge) },
    { id: 'pillContextMenu', queryKey: 'isPillContextMenu', label: 'Pill Context Menu', description: 'Enable right-click context menu on component pills in instructions', category: 'UI/UX', tags: ['instructions'], active: isPillContextMenu, onToggle: () => setIsPillContextMenu(!isPillContextMenu) },
    { id: 'interviewMode', queryKey: 'isInterviewMode', label: 'Interview Mode', description: 'Show interview me tile on homepage', category: 'Homepage', tags: ['homepage'], active: isInterviewMode, onToggle: () => setIsInterviewMode(!isInterviewMode) },
    { id: 'personalAgent', queryKey: 'showPersonalAgentOption', label: 'Personal Agent Option', description: 'Enable "Agent for me" audience type', category: 'Homepage', tags: ['homepage'], active: showPersonalAgentOption, onToggle: () => setShowPersonalAgentOption(!showPersonalAgentOption) },
    { id: 'flowCapture', queryKey: 'isFlowCaptureEnabled', label: 'Flow Capture', description: 'Enable flow capture for converting agent conversations to flows', category: 'Flows', tags: ['flows'], active: isFlowCaptureEnabled, onToggle: () => setIsFlowCaptureEnabled(!isFlowCaptureEnabled) },
    { id: 'publishHA', queryKey: 'isPublishHAEnabled', label: 'Publish Helper Agent', description: 'Enable publishing helper agents to channels', category: 'Preview', tags: ['publish'], active: isPublishHAEnabled, onToggle: () => setIsPublishHAEnabled(!isPublishHAEnabled) },
    { id: 'autoSave', queryKey: 'isAutoSave', label: 'Auto-Save', description: 'Debounced auto-save (2s) — persists agent data after changes settle', category: 'Saving', tags: ['save'], active: isAutoSave, onToggle: () => setIsAutoSave(!isAutoSave) },
    { id: 'manualSave', queryKey: 'isManualSave', label: 'Manual Save (Ctrl+S)', description: 'Save agent data on demand via Ctrl+S or Cmd+S', category: 'Saving', tags: ['save'], active: isManualSave, onToggle: () => setIsManualSave(!isManualSave) },
    { id: 'agentErrorSimulation', queryKey: 'isAgentErrorSimulation', label: 'Agent Error Simulation', description: 'Simulate a broken agent with active errors — for debugging demos', category: 'Experimental', tags: ['debug', 'errors'], active: isAgentErrorSimulation, onToggle: () => setIsAgentErrorSimulation(!isAgentErrorSimulation) },
    { id: 'haReviewUI', queryKey: 'isHAReviewUIEnabled', label: 'Review UI', description: 'Show HA change highlights on build page', category: 'Helper Agent', tags: ['helper agent','review'], active: isHAReviewUIEnabled, onToggle: () => setIsHAReviewUIEnabled(!isHAReviewUIEnabled) },
    { id: 'createFlowChecklist', queryKey: 'isCreateFlowChecklist', label: 'Create flow checklist', description: 'Experimental checklist that shows during creation', category: 'Helper Agent', tags: ['helper agent','create'], active: isCreateFlowChecklist, onToggle: () => setIsCreateFlowChecklist(!isCreateFlowChecklist) },
    { id: 'workflowVersion', queryKey: 'workflowVersion', queryValue: '2', label: 'Canvas + Adding [TW]', description: 'Alternative workflow canvas with different layout and interaction patterns. Personal exploration mode — off by default to keep the main experience aligned with the Figma spec.', category: 'Workflows', tags: ['workflow', 'canvas'], active: workflowVersion === 2, onToggle: () => setWorkflowVersion(workflowVersion === 2 ? 1 : 2) },
    { id: 'stepTypeVisuals', queryKey: 'isStepTypeVisuals', label: 'Distinct Step Type Visuals [TW]', description: 'Different visual styles per step type — trigger, AI capability, control flow, and connector steps each get a unique card treatment instead of sharing a single style.', category: 'Workflows', tags: ['workflow', 'canvas'], active: isStepTypeVisuals, onToggle: () => setIsStepTypeVisuals(!isStepTypeVisuals) },
    { id: 'workflowTestingV2', queryKey: 'isWorkflowTestingV2', label: 'Workflow Testing & Config [TW]', description: 'Experimental testing panel and detailed step config UI. Replaces the V1 testing and configuration experience.', category: 'Workflows', tags: ['workflow', 'testing', 'config'], active: isWorkflowTestingV2, onToggle: () => setIsWorkflowTestingV2(!isWorkflowTestingV2) },
    { id: 'triggersChannels', queryKey: 'isTriggersEnabled', label: 'Triggers & Channels', description: 'Shows trigger component detail panels (Conversational and Event) on the Build page', category: 'Experimental', tags: ['triggers', 'channels'], active: isTriggersEnabled, onToggle: () => setIsTriggersEnabled(!isTriggersEnabled) },
    { id: 'versionHistory', queryKey: 'isVersionHistory', label: 'Version History', description: 'Auto-saves a version snapshot on every publish. Accessible via the Publish button overflow menu on all agent pages.', category: 'Version History', tags: ['build', 'publish'], active: isVersionHistory, onToggle: () => setIsVersionHistory(!isVersionHistory) },
    { id: 'showVersionMilestones', queryKey: 'showVersionMilestones', label: 'Show Milestones', description: 'Show manually saved milestone entries in the version history timeline.', category: 'Version History', tags: ['build', 'publish'], active: showVersionMilestones, onToggle: () => setShowVersionMilestones(!showVersionMilestones) },
    { id: 'showDraftCheckpoints', queryKey: 'showDraftCheckpoints', label: 'Show Draft Checkpoints', description: 'Show automatically created draft checkpoint entries (captured every 5 minutes of editing) in the version history timeline.', category: 'Version History', tags: ['build', 'publish'], active: showDraftCheckpoints, onToggle: () => setShowDraftCheckpoints(!showDraftCheckpoints) },
    {
      id: 'toolsSimplified', queryKey: isToolsCA ? 'isToolsCA' : 'isToolsDA', label: 'Tools Simplified', description: 'Gates all new tools/connector features in this branch', category: 'Experimental', tags: ['tools'],
      active: isToolsDA || isToolsCA,
      onToggle: () => { if (isToolsDA || isToolsCA) { setIsToolsDA(false); setIsToolsCA(false); } else { setIsToolsDA(true); } },
      expandedContent: (
        <div className="flex items-center gap-2 mt-2">
          <CopilotButton
            size="sm"
            variant={isToolsDA ? 'primary' : 'secondary'}
            onClick={() => { setIsToolsDA(true); setIsToolsCA(false); }}
          >DA</CopilotButton>
          <CopilotButton
            size="sm"
            variant={isToolsCA ? 'primary' : 'secondary'}
            onClick={() => { setIsToolsCA(true); setIsToolsDA(false); }}
          >CA</CopilotButton>
        </div>
      ),
    },
    { id: 'distribute', queryKey: 'isDistributeEnabled', label: 'Distribute Tab', description: 'Shows the Distribute tab for managing agent distribution across channels', category: 'Experimental', tags: ['triggers', 'channels', 'distribution'], active: isDistributeEnabled, onToggle: () => setIsDistributeEnabled(!isDistributeEnabled) },
    { id: 'monitorV2', queryKey: 'isMonitorV2', label: 'Monitor V2', description: 'Analytics dashboard for Monitor tab with KPIs, themes, evaluations, and drill-down pages', category: 'Monitor', tags: ['monitor', 'analytics'], active: isMonitorV2, onToggle: () => setIsMonitorV2(!isMonitorV2) },
    { id: 'projectMode', queryKey: 'isProjectMode', label: 'Project Mode', description: 'Shows the Project Mode button in the home page input — lets makers compose multi-artifact AI systems (agents, workflows, connectors, and more) from a single NL + canvas experience.', category: 'Experimental', tags: ['project', 'canvas', 'eaa'], active: isProjectMode, onToggle: () => setIsProjectMode(!isProjectMode) },
    { id: 'shareCoauthoring', queryKey: 'isShareCoauthoring', label: 'Share for Co-authoring', description: 'Enables the Share dialog for co-authoring agents with other makers — invite collaborators, manage permissions, and see real-time co-editing status', category: 'Experimental', tags: ['share', 'coauthoring', 'collaboration'], active: isShareCoauthoring, onToggle: () => setIsShareCoauthoring(!isShareCoauthoring) },
  ], [isEvalMode, showEvalResults, isEvalsV2, copilotTierModels, isDexter, isAiTeammateDay100, isAgentGlobalUndo, isSkillsEnabled, isWorkIQEnabled, isNewNotifications, isHAReviewUIEnabled, isCreateFlowChecklist, isAiAutocomplete, showConversationalLayoutFeature, isL1NavJuneProposal, isBuildTabsEnabled, isInsertComponents, isComponentDrawer, isAgentTypeBadge, isPillContextMenu, isInterviewMode, showPersonalAgentOption, isFlowCaptureEnabled, isPublishHAEnabled, isAutoSave, isManualSave, workflowVersion, isStepTypeVisuals, isWorkflowTestingV2, isTriggersEnabled, isVersionHistory, showVersionMilestones, showDraftCheckpoints, isToolsDA, isToolsCA, isDistributeEnabled, isMonitorV2, isProjectMode, isShareCoauthoring, userName]);

  const activeCount = useMemo(() => allFlags.filter(f => f.active).length, [allFlags]);

  // Strip flag params from the URL after they've been applied so they don't
  // re-apply on every refresh while the URL stays in the address bar.
  useEffect(() => {
    const flagKeys = allFlags.map(f => f.queryKey).filter((k): k is string => !!k);
    stripFlagParamsFromUrl(flagKeys);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isOnAgentPage = !!currentAgentId && !isHomePage
    && location.pathname !== '/components'
    && location.pathname !== '/mystuff'
    && location.pathname !== '/discover'
    && location.pathname !== '/flows'
    && location.pathname !== '/tools';

  return (
    <>
      <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
      <DeleteConfirmDialog
        isOpen={showDeleteAllDialog}
        onClose={() => setShowDeleteAllDialog(false)}
        onConfirm={clearAllAgents}
        itemType="all"
      />

      <div
        className={`group/nav flex flex-col border-r border-[hsl(var(--nav-border))] transition-[width,background-color] duration-500 ${isLanding ? 'bg-transparent' : 'bg-[hsl(var(--nav-background))]'} ${effectiveExpanded ? 'w-64' : 'w-16'}`}
        ref={navRootRef}
      >
        {/* SVG gradient definition for nav icons */}
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <linearGradient id="nav-icon-gradient" x1="25%" y1="65%" x2="70%" y2="0%">
              <stop offset="0%" stopColor="#8B52F4" />
              <stop offset="50%" stopColor="#C944CD" />
              <stop offset="100%" stopColor="#EB4A5C" />
            </linearGradient>
          </defs>
        </svg>

        {/* Header */}
        <div className="relative group px-2 py-4">
          <button
            onClick={!isNavExpanded ? () => setIsNavExpanded(true) : isHomePage ? undefined : () => navigate('/')}
            className="flex items-center w-full relative"
          >
            <div className={iconContainerClass}>
              <div className="relative flex items-center justify-center">
                {!effectiveExpanded && showExpandIcon ? (
                  <>
                    <img src="./copilot-studio-logo.svg" alt="Copilot Studio" className="w-6 h-6 flex-shrink-0 transition-opacity group-hover/nav:opacity-0" />
                    <PanelLeftExpand20Regular className="absolute text-[hsl(var(--nav-text-secondary))] opacity-0 group-hover/nav:opacity-100 transition-opacity" />
                  </>
                ) : (
                  <img src="./copilot-studio-logo.svg" alt="Copilot Studio" className="w-6 h-6 flex-shrink-0" />
                )}
              </div>
            </div>
            <span className={`text-base font-semibold text-[hsl(var(--nav-text-primary))] whitespace-nowrap pointer-events-none pr-3 ${effectiveExpanded ? textFadeIn : textFadeOut}`}>
              Copilot Studio
            </span>
          </button>
          {effectiveExpanded && (
            <button
              onClick={(e) => { e.stopPropagation(); setIsNavExpanded(false); setIsClickExpanded(false); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
            >
              <PanelLeftContract20Regular className="text-[hsl(var(--nav-text-secondary))]" />
            </button>
          )}
        </div>

        {/* Nav Items */}
        <nav ref={navContainerRef} className="flex-1 py-2 overflow-y-auto overflow-x-hidden scrollbar-thin">
          {/* Create / Home */}
          <CopilotTooltip content={isL1NavJuneProposal ? 'Create' : 'Home'} placement="right" disabled={effectiveExpanded}>
            <button
              onClick={() => {
                if (isL1NavJuneProposal) setIsClickExpanded(true);
                if (isHomePage && isInConversationMode) { setIsInConversationMode(false); setPendingAgentData(null); window.location.reload(); }
                else if (!isHomePage) { if (isInConversationMode) { setIsInConversationMode(false); setPendingAgentData(null); } navigate('/'); }
              }}
              className={`${navBtnBase} ${isHomePage && !isInConversationMode ? navBtnActive : navBtnInactive}`}
            >
              <div className={`absolute left-[-5px] top-1/2 -translate-y-1/2 w-1 h-5 bg-[hsl(var(--primary))] rounded-full transition-opacity ${isHomePage && !isInConversationMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
              <div className={iconContainerClass}>
                {isHomePage && !isInConversationMode ? (
                  isL1NavJuneProposal ? <AddCircle24Filled className="w-6 h-6" primaryFill="url(#nav-icon-gradient)" /> : <Home24Filled className="w-6 h-6" primaryFill="url(#nav-icon-gradient)" />
                ) : (
                  <div className="relative flex items-center justify-center">
                    {isL1NavJuneProposal ? (
                      <><AddCircle24Regular className="w-6 h-6 transition-opacity group-hover:opacity-0" /><AddCircle24Filled className="absolute opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6" primaryFill="url(#nav-icon-gradient)" /></>
                    ) : (
                      <><Home24Regular className="w-6 h-6 transition-opacity group-hover:opacity-0" /><Home24Filled className="absolute opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6" primaryFill="url(#nav-icon-gradient)" /></>
                    )}
                  </div>
                )}
              </div>
              <span className={`text-sm whitespace-nowrap pr-3 ${effectiveExpanded ? textFadeIn : textFadeOut}`}>{isL1NavJuneProposal ? 'Create' : 'Home'}</span>
            </button>
          </CopilotTooltip>

          {/* Agents / My Projects */}
          <CopilotTooltip content={isL1NavJuneProposal ? 'Agents' : 'My Projects'} placement="right" disabled={effectiveExpanded}>
            <button
              onClick={() => { if (isInConversationMode) { setIsInConversationMode(false); setPendingAgentData(null); } navigate('/mystuff'); }}
              className={`${navBtnBase} ${location.pathname === '/mystuff' ? navBtnActive : navBtnInactive}`}
            >
              <div className={`absolute left-[-5px] top-1/2 -translate-y-1/2 w-1 h-5 bg-[hsl(var(--primary))] rounded-full transition-opacity ${location.pathname === '/mystuff' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
              <div className={iconContainerClass}>
                {location.pathname === '/mystuff' ? (
                  isL1NavJuneProposal ? <AgentsNavIcon gradient className="w-6 h-6" /> : <Layer24Filled className="w-6 h-6" primaryFill="url(#nav-icon-gradient)" />
                ) : (
                  <div className="relative flex items-center justify-center">
                    {isL1NavJuneProposal ? (
                      <><AgentsNavIcon className="w-6 h-6 transition-opacity group-hover:opacity-0" /><AgentsNavIcon gradient className="absolute opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6" /></>
                    ) : (
                      <><Layer24Regular className="w-6 h-6 transition-opacity group-hover:opacity-0" /><Layer24Filled className="absolute opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6" primaryFill="url(#nav-icon-gradient)" /></>
                    )}
                  </div>
                )}
              </div>
              <span className={`text-sm whitespace-nowrap pr-3 ${effectiveExpanded ? textFadeIn : textFadeOut}`}>{isL1NavJuneProposal ? 'Agents' : 'My Projects'}</span>
            </button>
          </CopilotTooltip>

          {/* Solution Library */}
          <CopilotTooltip content="Solution Library" placement="right" disabled={effectiveExpanded}>
            <button
              onClick={() => { if (isInConversationMode) { setIsInConversationMode(false); setPendingAgentData(null); } navigate('/discover'); }}
              className={`${navBtnBase} ${location.pathname === '/discover' ? navBtnActive : navBtnInactive}`}
            >
              <div className={`absolute left-[-5px] top-1/2 -translate-y-1/2 w-1 h-5 bg-[hsl(var(--primary))] rounded-full transition-opacity ${location.pathname === '/discover' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
              <div className={iconContainerClass}>
                {location.pathname === '/discover' ? (
                  <Library20Filled className="w-6 h-6" primaryFill="url(#nav-icon-gradient)" />
                ) : (
                  <div className="relative flex items-center justify-center">
                    <Library20Regular className="w-6 h-6 transition-opacity group-hover:opacity-0" />
                    <Library20Filled className="absolute opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6" primaryFill="url(#nav-icon-gradient)" />
                  </div>
                )}
              </div>
              <span className={`text-sm whitespace-nowrap pr-3 ${effectiveExpanded ? textFadeIn : textFadeOut}`}>Solution Library</span>
            </button>
          </CopilotTooltip>

          {/* Flows (L1 only) */}
          {isL1NavJuneProposal && (
            <CopilotTooltip content="Flows" placement="right" disabled={effectiveExpanded}>
              <button
                onClick={() => { if (isInConversationMode) { setIsInConversationMode(false); setPendingAgentData(null); } navigate('/flows'); }}
                className={`${navBtnBase} ${location.pathname === '/flows' ? navBtnActive : navBtnInactive}`}
              >
                <div className={`absolute left-[-5px] top-1/2 -translate-y-1/2 w-1 h-5 bg-[hsl(var(--primary))] rounded-full transition-opacity ${location.pathname === '/flows' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                <div className={iconContainerClass}>
                  {location.pathname === '/flows' ? (
                    <FlowsNavIcon gradient className="w-6 h-6" />
                  ) : (
                    <div className="relative flex items-center justify-center">
                      <FlowsNavIcon className="w-6 h-6 transition-opacity group-hover:opacity-0" />
                      <FlowsNavIcon gradient className="absolute opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6" />
                    </div>
                  )}
                </div>
                <span className={`text-sm whitespace-nowrap pr-3 ${effectiveExpanded ? textFadeIn : textFadeOut}`}>Flows</span>
              </button>
            </CopilotTooltip>
          )}

          {/* Agent list ref anchor for overflow calculation */}
          <div ref={agentListTopRef} />

          {/* Agent List */}
          <NavAgentList
            agents={agents}
            currentAgentId={currentAgentId}
            isHomePage={isHomePage}
            isOnAgentPage={isOnAgentPage}
            effectiveExpanded={effectiveExpanded}
            isL1NavJuneProposal={isL1NavJuneProposal}
            isInConversationMode={isInConversationMode}
            pendingAgentData={pendingAgentData}
            showPendingAgent={showPendingAgent}
            visibleAgentsCount={visibleAgentsCount}
            navigate={navigate}
            setIsInConversationMode={setIsInConversationMode}
            setPendingAgentData={setPendingAgentData}
            switchAgent={switchAgent}
            setIsClickExpanded={setIsClickExpanded}
            setIsNavExpanded={setIsNavExpanded}
            reorderNavAgents={reorderNavAgents}
            updateSpecificAgent={updateSpecificAgent}
            deleteAgent={deleteAgent}
            isShareCoauthoring={isShareCoauthoring}
          />

          {/* Projects section (only shown when Project Mode flag is on and there are projects) */}
          {isProjectMode && projects.length > 0 && (
            <div className="mt-1">
              {effectiveExpanded && (
                <div className={`flex items-center justify-between px-4 py-1 ${textFadeIn}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--text-disabled))]">Projects</p>
                  <CopilotButton
                    variant="ghost"
                    size="sm"
                    onClick={() => { projects.forEach(p => deleteProject(p.id)); }}
                    title="Clear all projects"
                    className="!h-5 !px-1.5 text-[10px] text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--nav-text-secondary))]"
                  >
                    Clear all
                  </CopilotButton>
                </div>
              )}
              {[...projects].reverse().slice(0, 8).map(project => {
                const isActive = location.pathname === '/project';
                return (
                  <CopilotTooltip key={project.id} content={project.name} placement="right" disabled={effectiveExpanded}>
                    <div
                      className={`${navBtnBase} ${isActive ? navBtnActive : navBtnInactive} group/proj relative`}
                      onClick={() => navigate('/project', { state: { prompt: project.prompt, projectId: project.id } })}
                    >
                      <div className={`absolute left-[-5px] top-1/2 -translate-y-1/2 w-1 h-5 bg-[hsl(var(--primary))] rounded-full transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                      <div className={iconContainerClass}>
                        <div className="relative flex items-center justify-center">
                          <Organization20Regular className="w-5 h-5 text-[hsl(var(--primary))] transition-opacity group-hover/proj:opacity-0" />
                          <Organization20Filled className="absolute w-5 h-5 text-[hsl(var(--primary))] opacity-0 group-hover/proj:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      <span className={`flex-1 text-sm whitespace-nowrap truncate pr-2 ${effectiveExpanded ? textFadeIn : textFadeOut}`}>
                        {project.name}
                      </span>
                      {effectiveExpanded && (
                        <CopilotButton
                          variant="ghost"
                          size="sm"
                          icon={<Delete20Regular />}
                          onClick={e => { e.stopPropagation(); deleteProject(project.id); }}
                          title="Delete project"
                          className="!h-6 !w-6 !px-0 opacity-0 group-hover/proj:opacity-100 transition-opacity mr-1"
                        />
                      )}
                    </div>
                  </CopilotTooltip>
                );
              })}
            </div>
          )}
        </nav>

        {/* Bottom section */}
        <div ref={bottomSectionRef}>
          {/* Feature flags button */}
          <CopilotTooltip content="Feature flags (Internal only)" placement="right" disabled={effectiveExpanded || featurePanelOpen}>
            <button onClick={() => setFeaturePanelOpen(!featurePanelOpen)} aria-expanded={featurePanelOpen} aria-label="Feature flags" className={`${navBtnBase} ${featurePanelOpen ? navBtnActive : navBtnInactive}`}>
              <div className={iconContainerClass}>
                {featurePanelOpen ? (
                  <Flag20Filled className="w-6 h-6" primaryFill="url(#nav-icon-gradient)" />
                ) : (
                  <div className="relative flex items-center justify-center">
                    <Flag20Regular className="w-6 h-6 transition-opacity group-hover:opacity-0" />
                    <Flag20Filled className="absolute opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6" primaryFill="url(#nav-icon-gradient)" />
                  </div>
                )}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap pr-3 ${effectiveExpanded ? textFadeIn : textFadeOut}`}>Feature flags <span className="text-[hsl(var(--text-disabled))]">(Internal only)</span></span>
            </button>
          </CopilotTooltip>

          {/* Environment button */}
          <CopilotTooltip content={selectedEnvName} placement="right" disabled={effectiveExpanded}>
            <button
              aria-expanded={envPickerOpen}
              aria-label="Environment picker"
              className={`${navBtnBase} ${envPickerOpen ? navBtnActive : navBtnInactive} !py-0 h-[48px]`}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setEnvPickerPos({ bottom: window.innerHeight - rect.bottom, left: rect.right + 8 });
                setEnvPickerOpen(v => !v);
              }}
            >
              <div className={iconContainerClass}>
                {envPickerOpen ? (
                  <GlobeSurface20Filled className="w-6 h-6" primaryFill="url(#nav-icon-gradient)" />
                ) : (
                  <div className="relative flex items-center justify-center">
                    <GlobeSurface20Regular className="w-6 h-6 transition-opacity group-hover:opacity-0" />
                    <GlobeSurface20Filled className="absolute opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6" primaryFill="url(#nav-icon-gradient)" />
                  </div>
                )}
              </div>
              <span className={`text-xs font-medium text-[hsl(var(--nav-text-primary))] whitespace-nowrap truncate pr-3 transition-opacity duration-150 ${effectiveExpanded ? 'opacity-100 delay-150' : 'opacity-0 duration-100'}`}>{selectedEnvName}</span>
            </button>
          </CopilotTooltip>

          {/* Account row */}
          <NavAccountRow
            effectiveExpanded={effectiveExpanded}
            navDisplayName={navDisplayName}
            navInitials={navInitials}
            onOpenApps={(pos) => { setAppsPos(pos); setAppsOpen(true); }}
            appsOpen={appsOpen}
            onClearAllAgents={() => setShowDeleteAllDialog(true)}
            onOpenSettingsModal={() => setShowSettingsModal(true)}
            credentials={credentials}
            onCredentialsChange={(creds: any) => {
              setCredentials(creds);
              if (creds.pacProfiles) setPacProfiles(creds.pacProfiles);
              if (creds.pacEnvironments) setPacEnvironments(creds.pacEnvironments);
              if (!userName && creds.azAccount) {
                const name = creds.azAccount.displayName || creds.azAccount.user?.split('@')[0];
                if (name) {
                  const firstName = name.split(' ')[0];
                  setUserName(firstName.charAt(0).toUpperCase() + firstName.slice(1));
                }
              }
            }}
          />
        </div>
      </div>

      {/* Flyouts (rendered outside nav column so they float freely) */}
      <NavAppsFlyout isOpen={appsOpen} position={appsPos} onClose={() => setAppsOpen(false)} />
      <NavEnvPicker
        isOpen={envPickerOpen}
        position={envPickerPos}
        onClose={() => setEnvPickerOpen(false)}
        selectedEnvName={selectedEnvName}
        onSelectEnv={(name) => { setSelectedEnvName(name); localStorage.setItem('mcs-env', name); }}
        pacEnvironments={pacEnvironments}
        pacProfiles={pacProfiles}
      />
      <NavFeatureFlagsPanel
        isOpen={featurePanelOpen}
        onClose={() => setFeaturePanelOpen(false)}
        allFlags={allFlags}
        activeCount={activeCount}
        headerContent={modelSelectionContent}
      />
    </>
  );
};
