import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import type { AgentConfig } from '../types';
import { removeAgentStorage } from '../utils/agentStorage';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { HelperAgent } from './HelperAgent';
import { NavigationRail } from './nav/NavigationRail';
import { CopilotButton } from './ui/CopilotButton';
import { CopilotSplitButton } from './ui/CopilotSplitButton';
import { VersionHistorySheet } from './VersionHistorySheet';
import { ClaudeOpusIcon, ClaudeSonnetIcon, ClaudeHaikuIcon } from './ui/ClaudeModelIcons';
import { CopilotInput } from './ui/CopilotInput';
import { CopilotTabs } from './ui/CopilotTabs';
import { CopilotDropdown } from './ui/CopilotDropdown';
import { SquircleIcon } from './ui/SquircleIcon';
import { DeleteConfirmDialog } from './ui/DeleteConfirmDialog';
import { DWCreateDialog } from '../domains/dw/components/DWCreateDialog';
import { DWBuildHeader } from '../domains/dw/components/DWBuildHeader';
import { Dialog, DialogHeader, DialogContent, DialogFooter } from './ui/Dialog';
import type { TriggerSummary } from './ui/PublishConfirmDialog';
import { getTriggerFriendlyName, getTriggerChannel, CONVERSATIONAL_CHANNEL_KEYS } from '../utils/buildPageUtils';
import { getNodeErrors } from './workflow/workflowConstants';
import { UnsavedChangesDialog } from './ui/UnsavedChangesDialog';
import { SaveIndicator } from './ui/SaveIndicator';
import { ShareDialog } from './ui/ShareDialog';
import { StatusIcon } from './ui/StatusIcon';
import { useRelativeTime, formatFullDateTime } from '../utils/relativeTime';
import { IconPickerDialog } from './ui/IconPickerDialog';
import { PublishAgentDialog } from './ui/PublishAgentDialog';
import { CopilotTooltip } from './ui/CopilotTooltip';
import { CopilotBadge } from './ui/CopilotBadge';
import { ChecklistPane } from './ChecklistPane';
import { FlowCaptureOverlay } from './FlowCapture/FlowCaptureOverlay';
import { useAgent } from '../context/AgentContext';
import { useDW } from '../domains/dw/context/DWContext';
import { useWorkflow } from '../context/WorkflowContext';
import { useHAReviewDiff } from '../hooks/useHAReviewDiff';
import { wrapWithGlobalInstructions } from '../domains/dw/utils/dwGlobalInstructions';
import { updateDexterWorker } from '../domains/dw/services/dexterWorkerService';
import { useToast } from '../context/ToastContext';
import { NotificationPopover } from './ui/NotificationPopover';
import { CopilotFilterPill } from './ui/CopilotFilterPill';
import { CopilotMenu, CopilotMenuPosition } from './ui/CopilotMenu';
import { EditableIcon } from './ui/EditableIcon';
import { AgentIcon } from './ui/AgentIcon';
import { detectAgentDomain, getAgentIcon, getUniqueGradientCSS, getGradientByKey, getConnectorIcon } from '../utils/agentIcons';
import { parseSysColorKey } from '../utils/systemColorIcons';
import { useSharedDexterWorkerProfile } from '../context/DexterWorkerProfileContext';
import { svgToPngBlob } from '../utils/svgToBlob';
import { usePublish } from '../hooks/usePublish';
import {
  MoreHorizontal20Regular,
  MoreHorizontal20Filled,
  Settings20Regular,
  Settings20Filled,
  Share20Regular,
  Share20Filled,
  Delete20Regular,
  Delete20Filled,
  PanelLeftContract24Regular,
  PanelLeftContract24Filled,
  PanelLeftExpand24Regular,
  PanelLeftExpand24Filled,
  ArrowUndo20Regular,
  ArrowUndo20Filled,
  ArrowRedo20Regular,
  ArrowRedo20Filled,
  TextStrikethrough20Regular,
  TextStrikethrough20Filled,
  ArrowUpload20Regular,
  ArrowUpload20Filled,
  Alert20Regular,
  Alert20Filled,
  Sparkle16Regular,
  PersonAdd20Regular,
  PersonDelete20Regular,
  Search20Regular,
  Mail16Regular,
  Person16Regular,
  Building16Regular,
  PeopleTeam16Regular,
  ArrowSync16Regular,
  ArrowDownload20Regular,
} from '@fluentui/react-icons';

const CONFETTI_COLORS = ['hsl(var(--primary))', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#EF4444', '#14B8A6', '#6366F1'];


const ConfettiOverlay: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  useEffect(() => {
    const timer = setTimeout(onDone, 2000);
    return () => clearTimeout(timer);
  }, [onDone]);

  const particles = Array.from({ length: 350 }, (_, i) => {
    const size = 6 + Math.random() * 8;
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const left = Math.random() * 25;
    const delay = Math.random() * 0.4;
    const drift = Math.random() * 150;
    const shape = Math.random() < 0.33 ? 'circle' : Math.random() < 0.5 ? 'strip' : 'square';
    return { i, size, color, left, delay, drift, shape };
  });

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(-20px) translateX(0) rotate(0deg); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(110vh) translateX(var(--drift)) rotate(720deg); opacity: 0; }
        }
        @keyframes cardBounce {
          0% { transform: translate(-50%, -50%) scale(0); }
          60% { transform: translate(-50%, -50%) scale(1.1); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
      {particles.map(p => (
        <div
          key={p.i}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: '-20px',
            width: p.shape === 'strip' ? p.size * 0.4 : p.size,
            height: p.shape === 'strip' ? p.size * 2 : p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'strip' ? '2px' : '2px',
            animation: `confettiFall ${1.2 + Math.random() * 0.6}s ease-in ${p.delay}s forwards`,
            ['--drift' as any]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
};

export type BuildOutletContext = {
  buildActivePanel: 'instructions' | 'components';
  setBuildActivePanel: (panel: 'instructions' | 'components') => void;
};

// Fields that constitute a meaningful user edit (mirrors SAVEABLE_FIELDS in AgentContext).
// Used to fingerprint whether the agent has been modified since its last publish.
const DRAFT_FINGERPRINT_FIELDS: (keyof AgentConfig)[] = [
  'name', 'description', 'purpose', 'guidelines', 'skills', 'model',
  'instructions', 'knowledge', 'capabilities', 'workflowNodes',
  'icon', 'iconKey', 'gradientKey', 'iconImageData', 'systemColorIcon', 'dwSkills',
  'email', 'role', 'triggerDistribution', 'softDeletedTriggers',
];

function fingerprintConfig(config: AgentConfig): string {
  const subset: Record<string, unknown> = {};
  for (const f of DRAFT_FINGERPRINT_FIELDS) subset[f] = (config as unknown as Record<string, unknown>)[f];
  return JSON.stringify(subset);
}

export const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { setCurrentPage, agentConfig, agents, switchAgent, currentAgentId, updateAgentConfig, updateWithHistory, takeSnapshot, deleteAgent, isInConversationMode, setIsInConversationMode, isConversationalLayout, setIsConversationalLayout, pendingAgentData, isEvalMode, userName, setUserName, submitFeedback, feedbackSubmitted, setFeedbackSubmitted, showConversationalLayoutFeature, showEvalResults, isPlanMode, navOrder, undo, redo, canUndo, canRedo, undoLabel, redoLabel, helperMessages, isInstructionsHeaderStuck, isBuildTabsEnabled, isFlowCaptureEnabled, isAgentGlobalUndo, isNewNotifications, isHelperCollapsed, setIsHelperCollapsed, setHelperCollapsedDefault, toggleHelperCollapsed, clearHelperMessagesForAgent, skills, deleteSkill, setPendingHelperAutoSubmit, isManualSave, saveNow, isManualSaveDirty, clearManualDirty, markManualDirty, commitSave, isHAReviewUIEnabled, isCreateFlowChecklist, highlightAllChanges, setHighlightAllChanges, commitSoftDeletedTriggers, isDistributeEnabled, savingState, isAutoSave, isShareCoauthoring, isVersionHistory, saveVersionEntry, restoreVersion, agentVersionHistory, showVersionMilestones, showDraftCheckpoints } = useAgent();
  const { workflowVersion, setWorkflowVersion, requestWorkflowSave, requestWorkflowPublishVersion } = useWorkflow();
  const { dwTab, setDwTab, dwAddedToTeam, setDwAddedToTeam, isDexter, provisionDexterWorker, clearDwTasks, clearDwKnowledge, isAiTeammateDay100, setIsAiTeammateDay100, resetDay0Anim, tenantDomain, isDwCreateDialogOpen, openDwCreateDialog, closeDwCreateDialog, isDwConversationalDemo, getDexterAuthFetch } = useDW();
  const { changedFields: reviewChangedFields } = useHAReviewDiff();
  const publish = usePublish();
  const showDeletedToggle = reviewChangedFields.has('instructions') || reviewChangedFields.has('capabilities') || reviewChangedFields.has('knowledge') || reviewChangedFields.has('skills');
  const [isNavExpanded, setIsNavExpanded] = useState(location.pathname === '/');
  const [showConfetti, setShowConfetti] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingName, setPendingName] = useState('');
  const [isExiting, setIsExiting] = useState(false);
  const [shouldAnimateRegularMode, setShouldAnimateRegularMode] = useState(false);
  const [isToggleHovered, setIsToggleHovered] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingSwitchAgentId, setPendingSwitchAgentId] = useState<string | null>(null);
  const [showResetDay0Dialog, setShowResetDay0Dialog] = useState(false);

  // Auto-save status display: shown next to publish status near the publish button
  // 'saving' = spinner + "Saving ...", 'saved' = "Draft saved", 'fading' = exit animation, 'none' = hidden
  type AutoSaveDisplayState = 'none' | 'saving' | 'saved' | 'fading';
  const [autoSaveDisplay, setAutoSaveDisplay] = useState<AutoSaveDisplayState>('none');

  // Effect 1: trigger saving display when savingState changes.
  // Note: localStorage saves are synchronous, so React batches the
  // setSavingState('saving') + setSavingState('saved') calls into one render.
  // The effect only sees 'saved', so we must trigger on both states.
  useEffect(() => {
    if (!isAutoSave) { setAutoSaveDisplay('none'); return; }
    if (savingState === 'saving' || savingState === 'saved') {
      setAutoSaveDisplay('saving');
    }
  }, [savingState, isAutoSave]);

  // Effect 2: state machine — each state auto-advances after its delay
  useEffect(() => {
    if (autoSaveDisplay === 'none') return;
    const next: Record<'saving' | 'saved' | 'fading', AutoSaveDisplayState> = { saving: 'saved', saved: 'fading', fading: 'none' };
    const delays: Record<'saving' | 'saved' | 'fading', number> = { saving: 1000, saved: 3000, fading: 500 };
    const timer = setTimeout(() => setAutoSaveDisplay(next[autoSaveDisplay as 'saving' | 'saved' | 'fading']), delays[autoSaveDisplay as 'saving' | 'saved' | 'fading']);
    return () => clearTimeout(timer);
  }, [autoSaveDisplay]);

  // Shared auto-save status JSX — used in both regular and DW/compact headers
  const autoSaveStatusEl = autoSaveDisplay !== 'none' ? (
    <span
      className={`inline-flex items-center gap-2 select-none transition-[opacity,transform] duration-500 ${
        autoSaveDisplay === 'fading' ? 'opacity-0 translate-x-3' : 'opacity-100 translate-x-0'
      }`}
      aria-live="polite"
    >
      {autoSaveDisplay === 'saving' && <ArrowSync16Regular className="w-4 h-4 animate-spin text-[hsl(var(--primary))]" />}
      {autoSaveDisplay === 'saving' ? 'Saving ...' : 'Draft saved'}
    </span>
  ) : null;

  // Save button click: persist + reset dirty (onBeforeSave sets saving state & clears dirty)
  const handleManualSave = () => {
    saveNow();
  };

  // Warn before browser tab close / refresh when there are unsaved manual-save changes
  useEffect(() => {
    if (!isManualSave || !isManualSaveDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isManualSave, isManualSaveDirty]);

  // Intercept agent switch when dirty — show dialog instead of switching immediately
  const handleSwitchAgent = (agentId: string) => {
    if (isManualSave && isManualSaveDirty) {
      setPendingSwitchAgentId(agentId);
      setShowUnsavedDialog(true);
    } else {
      switchAgent(agentId);
    }
  };

  const handleUnsavedSaveAndLeave = () => {
    saveNow();
    if (pendingSwitchAgentId) {
      switchAgent(pendingSwitchAgentId);
      setPendingSwitchAgentId(null);
    }
    setShowUnsavedDialog(false);
  };

  const handleUnsavedDiscard = () => {
    clearManualDirty();
    if (pendingSwitchAgentId) {
      switchAgent(pendingSwitchAgentId);
      setPendingSwitchAgentId(null);
    }
    setShowUnsavedDialog(false);
  };

  const isDWAgent = agentConfig.agentType === 'DW';
  const helperEffectivelyCollapsed = isHelperCollapsed;

  // Shared Dexter worker profile — single instance via DexterWorkerProfileProvider in App.tsx
  const dwProfile = useSharedDexterWorkerProfile();

  // Show confetti and mark as added when provisioning completes.
  // Also upload the selected system-color icon as the Entra profile photo.
  const prevLifecycleRef = useRef(agentConfig.lifecycleStatus);
  const pendingIconUploadRef = useRef(false);
  // Use refs to avoid stale closures in the upload effect
  const systemColorIconRef = useRef(agentConfig.systemColorIcon);
  systemColorIconRef.current = agentConfig.systemColorIcon;
  const dwProfileRef = useRef(dwProfile);
  dwProfileRef.current = dwProfile;

  useEffect(() => {
    if (prevLifecycleRef.current === 'provisioning' && agentConfig.lifecycleStatus === 'ready') {
      setDwAddedToTeam(true);
      setShowConfetti(true);

      // Flag that we need to upload the icon once dwProfile loads the worker detail
      if (isDexter && agentConfig.dexterWorkerId) {
        pendingIconUploadRef.current = true;
        dwProfile.refresh();
      }
    }
    prevLifecycleRef.current = agentConfig.lifecycleStatus;
    return () => { pendingIconUploadRef.current = false; };
  }, [agentConfig.lifecycleStatus, agentConfig.dexterWorkerId, setDwAddedToTeam, isDexter, dwProfile.refresh]);

  // When the profile loads after provisioning, upload the icon as the Entra photo.
  // Uses a retry counter (ref) in case the profile hasn't loaded the agenticUserId yet.
  const pendingIconTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingIconRetriesRef = useRef(0);
  useEffect(() => {
    if (!pendingIconUploadRef.current || dwProfile.loading) return;
    if (!dwProfile.worker?.agenticUserId) {
      // Profile loaded but no agenticUserId yet — retry after a delay (up to ~10s)
      if (pendingIconRetriesRef.current >= 5) {
        pendingIconUploadRef.current = false;
        pendingIconRetriesRef.current = 0;
        return;
      }
      if (!pendingIconTimerRef.current) {
        pendingIconRetriesRef.current++;
        dwProfileRef.current.refresh();
        pendingIconTimerRef.current = setTimeout(() => { pendingIconTimerRef.current = null; }, 2000);
      }
      return;
    }
    pendingIconRetriesRef.current = 0;
    pendingIconUploadRef.current = false;
    if (pendingIconTimerRef.current) { clearTimeout(pendingIconTimerRef.current); pendingIconTimerRef.current = null; }

    // Read latest values from refs to avoid stale closures
    const icon = systemColorIconRef.current || 'agents';
    const profileUpload = dwProfileRef.current.uploadPhoto;
    (async () => {
      try {
        const svgUrl = `${process.env.PUBLIC_URL || ''}/icons/system-color/${icon}.svg`;
        const pngBlob = await svgToPngBlob(svgUrl);
        await profileUpload(pngBlob, 'image/png');
      } catch {
        /* Entra photo upload — non-fatal */
      }
    })();

    return () => { if (pendingIconTimerRef.current) { clearTimeout(pendingIconTimerRef.current); pendingIconTimerRef.current = null; } };
  }, [dwProfile.worker?.agenticUserId, dwProfile.loading, dwProfile.uploadPhoto]);


  // Agent-level notification bell
  const { notifications, markAgentRead } = useToast();
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [notifAnchorRect, setNotifAnchorRect] = useState<DOMRect | null>(null);
  // Two refs — one per layout variant (full header / compact header); only one is in the DOM at a time.
  const bellBtnRefFull = useRef<HTMLSpanElement>(null);
  const bellBtnRefCompact = useRef<HTMLSpanElement>(null);
  const agentUnreadCount = currentAgentId
    ? notifications.filter(n => n.agentId === currentAgentId && !n.isRead).length
    : 0;

  // Collapse helper pane by default when switching to a DW agent in Day 0 state or a workflow
  // Uses setHelperCollapsedDefault so user's explicit open/close is preserved
  useEffect(() => {
    if ((agentConfig.agentType === 'DW' && !isAiTeammateDay100) || agentConfig.type === 'workflow') {
      setHelperCollapsedDefault(true);
    }
  }, [agentConfig.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync structured output instructions to Dexter when the demo toggle changes
  useEffect(() => {
    if (!isDexter || !agentConfig.dexterWorkerId || agentConfig.agentType !== 'DW') return;
    const authFetch = getDexterAuthFetch();
    if (!authFetch) return;
    const wrapped = wrapWithGlobalInstructions(
      agentConfig.instructions || '', agentConfig.name, agentConfig.role, isDwConversationalDemo
    );
    updateDexterWorker(authFetch, agentConfig.dexterWorkerId, { instructions: wrapped }).then(() => {
      console.log(`[DW] Instructions synced (structured output: ${isDwConversationalDemo ? 'ON' : 'OFF'})`);
    }).catch(err => {
      console.warn('[DW] Instruction sync on toggle change failed:', err);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDwConversationalDemo]);

  // Header compact mode — hides publish button into overflow dropdown, giving tabs more room
  const headerObserverRef = useRef<ResizeObserver | null>(null);
  const [isHeaderCompact, setIsHeaderCompact] = useState(false);
  const [isHeaderSemiCompact, setIsHeaderSemiCompact] = useState(false);
  const [headerWidth, setHeaderWidth] = useState(0);

  // Callback ref so the ResizeObserver attaches whenever the header mounts/unmounts.
  // Two-stage collapse as header narrows:
  //   < 700px: hide status text (Draft / Published date) first
  //   < 550px: also hide the Publish/Update button (moves to overflow dropdown)
  const headerCallbackRef = React.useCallback((node: HTMLElement | null) => {
    if (headerObserverRef.current) {
      headerObserverRef.current.disconnect();
      headerObserverRef.current = null;
    }
    if (node) {
      // Measure synchronously on mount so the first render already has the correct
      // width — avoids a layout "pop" before the ResizeObserver fires.
      const initialWidth = node.getBoundingClientRect().width;
      setHeaderWidth(initialWidth);
      setIsHeaderSemiCompact(initialWidth < 700);
      setIsHeaderCompact(initialWidth < 550);

      const observer = new ResizeObserver((entries) => {
        const width = entries[0].contentRect.width;
        setHeaderWidth(width);
        setIsHeaderSemiCompact(width < 700);
        setIsHeaderCompact(width < 550);
      });
      observer.observe(node);
      headerObserverRef.current = observer;
    }
  }, []);

  // Publish state
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showVersionHistorySheet, setShowVersionHistorySheet] = useState(false);
  const [publishMenuPos, setPublishMenuPos] = useState<CopilotMenuPosition | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  // Fingerprint of the config at last publish time; null when the agent has never been published.
  const [publishedFingerprint, setPublishedFingerprint] = useState<string | null>(
    () => agentConfig.published ? fingerprintConfig(agentConfig) : null
  );
  const publishButtonRef = useRef<HTMLDivElement>(null);
  // Reset the published baseline when the active agent switches. Publish itself updates the
  // baseline synchronously in handlePublishDialogConfirm, so lastPublishedAt is not needed here.
  useEffect(() => {
    setPublishedFingerprint(agentConfig.published ? fingerprintConfig(agentConfig) : null);
  }, [agentConfig.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // fingerprintConfig is a stable module-level function; agentConfig itself is intentionally omitted.
  // true only when saveable fields have diverged from the last-published snapshot.
  const hasDraftChanges = useMemo(() => {
    if (!agentConfig.published || publishedFingerprint === null) return false;
    return fingerprintConfig(agentConfig) !== publishedFingerprint;
  }, [agentConfig, publishedFingerprint]);

  // Share state
  const [showShareDialog, setShowShareDialog] = useState(false);
  const shareButtonRef = useRef<HTMLDivElement>(null);

  // Icon picker state
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Track page transitions from nav-expanded pages to agent pages for entrance animation
  const prevPathRef = useRef(location.pathname);
  const [animatingPageEntry, setAnimatingPageEntry] = useState(false);

  // Synchronous detection during render — prevents flash on first frame
  const navExpandedPaths = ['/', '/mystuff', '/discover', '/components'];
  const justNavigatedFromNavExpanded =
    prevPathRef.current !== location.pathname &&
    navExpandedPaths.includes(prevPathRef.current) &&
    !navExpandedPaths.includes(location.pathname);
  const shouldAnimatePageEntry = justNavigatedFromNavExpanded || animatingPageEntry;

  const handleToggleLayout = () => {
    if (isConversationalLayout) {
      // Exiting conversational mode - fade out and prepare to slide in regular mode
      setIsExiting(true);
      setShouldAnimateRegularMode(true);
      setTimeout(() => {
        setIsConversationalLayout(false);
        setIsExiting(false);
      }, 200); // Wait for fade-out animation
    } else {
      // Entering conversational mode - toggle immediately
      setIsConversationalLayout(true);
      setShouldAnimateRegularMode(false);
    }
  };

  // Track if nav was auto-collapsed due to responsive breakpoint
  const [wasAutoCollapsed, setWasAutoCollapsed] = useState(false);
  // Track user's preference when manually collapsing/expanding
  const [userPreference, setUserPreference] = useState<'expanded' | 'collapsed' | null>(null);

  const isHomePage = location.pathname === '/';
  const isBuildPage = location.pathname === '/build';
  const isPreviewPage = location.pathname === '/preview';
  const isEvaluatePage = location.pathname === '/evaluate';
  const isMonitorPage = location.pathname === '/monitor';
  const isDistributePage = location.pathname === '/distribute';
  const isSettingsPage = location.pathname === '/settings';
  const isComponentsPage = location.pathname === '/components';
  const isMyStuffPage = location.pathname === '/mystuff';
  const isDiscoverPage = location.pathname === '/discover';
  const isSnapshotsPage = location.pathname === '/snapshots';
  const isToolsPage = location.pathname === '/tools';
  const isFlowsPage = location.pathname === '/flows';
  const isProjectPage = location.pathname === '/project';
  const relativePublishTime = useRelativeTime(agentConfig.lastPublishedAt);
  const isAgentType = agentConfig.type === 'agent' || agentConfig.type === 'placeholder';
  const agentWasCreatedInPlanMode = agentConfig.createdWithPlanMode ?? false;
  const isFuzzyLoading = !agentWasCreatedInPlanMode && agentConfig.type === 'placeholder' && !helperMessages.some(m => m.role === 'assistant' && !m.streaming);
  const isNavExpandedPage = isHomePage || isMyStuffPage || isDiscoverPage || isComponentsPage || isSnapshotsPage || isToolsPage || isFlowsPage;

  const [buildPanelState, setBuildPanelState] = useState<{ agentId: string; panel: 'instructions' | 'components' }>({ agentId: agentConfig.id, panel: 'instructions' });
  const buildActivePanel = buildPanelState.agentId === agentConfig.id ? buildPanelState.panel : 'instructions';
  const setBuildActivePanel = useCallback(
    (panel: 'instructions' | 'components') => setBuildPanelState({ agentId: agentConfig.id, panel }),
    [agentConfig.id]
  );

  // Derived publish status label shown in compact overflow dropdown
  const compactPublishStatusLabel = isPublishing
    ? 'Publishing...'
    : agentConfig.published && !hasDraftChanges && agentConfig.lastPublishedAt
    ? `Published ${relativePublishTime}`
    : (agentWasCreatedInPlanMode || !!agentConfig.agentType)
    ? 'Draft'
    : null;

  useEffect(() => {
    const page = location.pathname.substring(1) || 'home';
    setCurrentPage(page);
  }, [location, setCurrentPage]);

  // Reset feedbackSubmitted when switching agents
  useEffect(() => {
    setFeedbackSubmitted(false);
  }, [currentAgentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-collapse nav when entering conversation mode (create UX)
  useEffect(() => {
    if (isInConversationMode && isHomePage) {
      setIsNavExpanded(false);
    }
  }, [isInConversationMode, isHomePage]);

  // Persist the animation flag in state and update the prev path ref
  useEffect(() => {
    if (justNavigatedFromNavExpanded) {
      setAnimatingPageEntry(true);
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname, justNavigatedFromNavExpanded]);

  // 'Spec' lived here historically. The unified canvas at "/" now owns the
  // spec view (chat left, spec doc right), so a separate Spec tab would be
  // a redundant alias of Home and would split focus highlighting.
  const allTabs = [
    { name: 'Build', path: '/build', icon: '🔧' },
    { name: 'Preview', path: '/preview', icon: '👁️' },
    { name: 'Evaluate', path: '/evaluate', icon: '📊' },
    { name: 'Monitor', path: '/monitor', icon: '📈' },
    ...(isDistributeEnabled ? [{ name: 'Distribute', path: '/distribute', icon: '📤' }] : []),
  ];

  const tabs = agentConfig.type === 'workflow'
    ? allTabs.filter(tab => !['Preview', 'Distribute'].includes(tab.name))
    : agentConfig.agentType === 'DW'
    ? allTabs.filter(tab => !['Evaluate', 'Distribute'].includes(tab.name))
    : allTabs;

  const incrementVersion = (currentVersion?: string): string => {
    if (!currentVersion) return '1';
    const num = parseInt(currentVersion, 10);
    return isNaN(num) ? '1' : String(num + 1);
  };

  const handlePublishClick = () => {
    setShowPublishDialog(true);
  };

  const handleExportGuide = () => {
    if (!agentConfig.projectId || !agentConfig.specAgentId) return;
    const url = `/api/projects/${encodeURIComponent(agentConfig.projectId)}/agents/${encodeURIComponent(agentConfig.specAgentId)}/export`;
    window.open(url, '_blank');
  };

  const handlePublishDialogConfirm = async (description: string) => {
    setShowPublishDialog(false);
    setIsPublishing(true);

    // If spec-backed agent, trigger the real MCS build pipeline
    const isSpecBacked = !!(agentConfig.projectId && agentConfig.specAgentId);
    if (isSpecBacked) {
      try {
        await publish.startPublish(agentConfig);
      } catch (err) {
        console.error('[Layout] MCS build failed:', err);
        if (isNewNotifications) addToast({ variant: 'error', title: 'Build failed', message: String((err as Error)?.message || err) });
      }
    } else {
      // Non-spec agent — simulate publishing delay
      await new Promise(resolve => setTimeout(resolve, 4500));
    }

    // Snapshot pre-publish state so the entire publish is undoable via Ctrl+Z.
    // takeSnapshot + plain updateAgentConfig (batch pattern) rather than updateWithHistory,
    // because commitSoftDeletedTriggers also calls updateAgentConfig internally.
    if (isAgentGlobalUndo) takeSnapshot(agentConfig.id);

    // Compute the final published triggers, excluding any that are about to be soft-deleted.
    const softDeletedSet = new Set(agentConfig.softDeletedTriggers ?? []);
    const finalPublishedTriggers = parseTriggersFromInstructions(agentConfig.instructions || '', softDeletedSet);

    if (agentConfig.published) {
      // Update existing published agent
      const newVersion = incrementVersion(agentConfig.version);
      commitSoftDeletedTriggers();
      updateAgentConfig({ version: newVersion, lastPublishedAt: new Date(), publishedTriggers: finalPublishedTriggers });
      // Update baseline synchronously so hasDraftChanges is false in the same render.
      // DRAFT_FINGERPRINT_FIELDS excludes publish metadata, so the fingerprint is stable.
      // Fingerprint the post-commit config: commitSoftDeletedTriggers() will clear
      // softDeletedTriggers, so include that in the baseline to avoid a spurious draft badge.
      setPublishedFingerprint(fingerprintConfig({ ...agentConfig, softDeletedTriggers: undefined }));
      requestWorkflowPublishVersion();
      if (isVersionHistory) {
        saveVersionEntry('published', newVersion, description || undefined, { version: newVersion, lastPublishedAt: new Date(), publishedTriggers: finalPublishedTriggers });
      }
      if (isNewNotifications) addToast({ variant: 'success', title: 'Published', message: `${agentConfig.name} v${newVersion} is now live.` });
    } else {
      // First publish
      commitSoftDeletedTriggers();
      updateAgentConfig({ published: true, version: '1', lastPublishedAt: new Date(), publishedTriggers: finalPublishedTriggers });
      // Update baseline synchronously so hasDraftChanges is false in the same render.
      setPublishedFingerprint(fingerprintConfig({ ...agentConfig, softDeletedTriggers: undefined }));
      requestWorkflowPublishVersion();
      if (isVersionHistory) {
        saveVersionEntry('published', '1', description || undefined, { published: true, version: '1', publishedTriggers: finalPublishedTriggers });
      }
    }

    setIsPublishing(false);
  };

  const handleDeleteAgent = () => {
    setShowDeleteDialog(true);
  };

  const confirmResetToDay0 = () => {
    clearDwTasks(agentConfig.id);
    clearDwKnowledge(agentConfig.id);
    skills.filter(s => s.agentId === agentConfig.id).forEach(s => deleteSkill(s.id));
    clearHelperMessagesForAgent(agentConfig.id);
    removeAgentStorage(agentConfig.id, 'day0AnimDoneKey');
    if (isAiTeammateDay100) setIsAiTeammateDay100(false);
    resetDay0Anim();
    setIsHelperCollapsed(true);
    setShowResetDay0Dialog(false);
  };

  const confirmDeleteAgent = () => {
    const name = agentConfig.name;
    deleteAgent(agentConfig.id);
    navigate('/');
    if (isNewNotifications) addToast({ variant: 'success', title: 'Agent deleted', message: `${name} has been removed.` });
  };

  const handleShare = () => {
    setShowShareDialog(true);
  };

  const handleSettings = () => {
    if (agentConfig.type === 'workflow') {
      if (isNewNotifications) {
        addToast({ variant: 'info', title: 'Coming soon', message: 'Settings for workflows are being built.' });
      } else {
        alert('Settings functionality coming soon!');
      }
    } else {
      navigate('/settings');
    }
  };

  const handleIconSelect = (iconKey: string, gradientKey: string, imageData?: string) => {
    const parsed = parseSysColorKey(iconKey);
    const update: Record<string, any> = {
      iconKey: parsed.iconKey,
      gradientKey,
      iconImageData: imageData || null,
      systemColorIcon: parsed.systemColorIcon,
    };
    if (isAgentGlobalUndo) {
      updateWithHistory(update);
    } else {
      updateAgentConfig(update);
    }

    // For DW agents: upload the icon to Entra as the profile photo
    if (isDexter && isDWAgent && dwProfile.worker?.agenticUserId) {
      (async () => {
        try {
          let blob: Blob;
          if (imageData) {
            const resp = await fetch(imageData);
            blob = await resp.blob();
          } else {
            const svgUrl = `${process.env.PUBLIC_URL || ''}/icons/system-color/${parsed.systemColorIcon || iconKey}.svg`;
            blob = await svgToPngBlob(svgUrl);
          }
          await dwProfile.uploadPhoto(blob, blob.type || 'image/png');
          addToast({ variant: 'success', title: 'Profile photo updated', message: 'Entra profile photo has been synced.' });
        } catch (err) {
          console.error('DW icon upload to Entra failed:', err);
          addToast({ variant: 'error', title: 'Photo sync failed', message: err instanceof Error ? err.message : 'Could not update Entra profile photo.' });
        }
      })();
    }
  };

  const handleAgentMenuAction = (action: string) => {
    switch (action) {
      case 'publish':
        handlePublishClick();
        break;
      case 'settings':
        handleSettings();
        break;
      case 'share':
        handleShare();
        break;
      case 'export-guide':
        handleExportGuide();
        break;
      case 'delete':
        handleDeleteAgent();
        break;
    }
  };

  // Handle manual nav expand/collapse (user clicking button)
  const handleNavExpandChange = (expanded: boolean) => {
    setIsNavExpanded(expanded);
    // Track user's manual preference only on expandable pages
    if (isNavExpandedPage) {
      setUserPreference(expanded ? 'expanded' : 'collapsed');
    }
    // Clear auto-collapsed flag since user is taking manual action
    setWasAutoCollapsed(false);
  };

  // Responsive breakpoint handling
  useEffect(() => {
    const BREAKPOINT = 1220;

    const handleResize = () => {
      const width = window.innerWidth;

      if (width < BREAKPOINT) {
        // Below breakpoint: auto-collapse if currently expanded
        if (isNavExpanded && !userPreference) {
          setIsNavExpanded(false);
          setWasAutoCollapsed(true);
        }
      } else {
        // Above breakpoint: restore if was auto-collapsed
        if (wasAutoCollapsed && !userPreference) {
          // Only restore on pages that normally have expanded nav
          if (isNavExpandedPage) {
            setIsNavExpanded(true);
          }
          setWasAutoCollapsed(false);
        }
      }
    };

    // Check on mount and when relevant dependencies change
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isNavExpanded, wasAutoCollapsed, userPreference, isNavExpandedPage]);

  // (Header compact mode observer is handled by headerCallbackRef above)

  // Collapse nav when leaving home/mystuff/discover pages, expand when on those pages
  const handleSubmitFeedback = () => {
    if (!userName) {
      setShowNameModal(true);
      return;
    }
    doSubmitFeedback();
  };

  const doSubmitFeedback = (nameOverride?: string) => {
    // Build sections from agentConfig
    const caps = agentConfig.capabilities || [];
    const sections: Record<string, { status: string; originalValue: string; currentValue: string }> = {
      name: { status: 'accepted', originalValue: agentConfig.name || '', currentValue: agentConfig.name || '' },
      description: { status: 'accepted', originalValue: agentConfig.description || '', currentValue: agentConfig.description || '' },
      instructions: { status: 'accepted', originalValue: agentConfig.instructions || '', currentValue: agentConfig.instructions || '' },
      triggers: { status: 'accepted', originalValue: caps.filter(c => c.type === 'trigger').map(c => c.name).join('|||'), currentValue: caps.filter(c => c.type === 'trigger').map(c => c.name).join('|||') },
      tools: { status: 'accepted', originalValue: caps.filter(c => c.type === 'action' || c.type === 'connector').map(c => c.name).join('|||'), currentValue: caps.filter(c => c.type === 'action' || c.type === 'connector').map(c => c.name).join('|||') },
      knowledge: { status: 'accepted', originalValue: caps.filter(c => c.type === 'knowledge').map(c => c.name).join('|||'), currentValue: caps.filter(c => c.type === 'knowledge').map(c => c.name).join('|||') },
    };

    submitFeedback(sections, nameOverride);
    setShowConfetti(true);
  };

  const handleNameModalSubmit = () => {
    if (pendingName.trim()) {
      setUserName(pendingName.trim());
      setShowNameModal(false);
      doSubmitFeedback(pendingName.trim());
      setPendingName('');
    }
  };

  useEffect(() => {
    if (!isNavExpandedPage) {
      setIsNavExpanded(false);
      setUserPreference(null); // Reset user preference on page change
    } else {
      // Only auto-expand if user hasn't manually set a preference and wasn't auto-collapsed
      if (!userPreference && !wasAutoCollapsed) {
        setIsNavExpanded(true);
      } else if (userPreference === 'expanded') {
        setIsNavExpanded(true);
      }
    }
  }, [isNavExpandedPage, userPreference, wasAutoCollapsed]);

  const isLanding = isHomePage && !isInConversationMode;

  // Day-0 agents that haven't been set up yet (no instructions generated)
  const isDay0Incomplete = !agentConfig.instructions && !!agentConfig.createdWithPlanMode;

  // Parse triggers from instructions for the Publish dialog
  const makeTriggerLabel = (triggerName: string, iconKey: string): string => {
    const friendly = getTriggerFriendlyName(triggerName);
    const di = triggerName.indexOf(' - ');
    const channelPrefix = di !== -1 ? triggerName.substring(0, di) : (CONVERSATIONAL_CHANNEL_KEYS.has(iconKey) ? iconKey.charAt(0).toUpperCase() + iconKey.slice(1) : iconKey);
    return channelPrefix ? `${channelPrefix} — ${friendly}` : friendly;
  };
  const parseTriggersFromInstructions = (instructions: string, excludeNames?: Set<string>): TriggerSummary[] => {
    const wtaMatch = instructions.match(/^Where this agent works:(.*)$/m);
    if (!wtaMatch) return [];
    const content = wtaMatch[1];
    const triggers: TriggerSummary[] = [];
    const re = /\{\{icon:([\w\s]+?)\}\}\s*\[\[([^\]]+)\]\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const iconKey = m[1].toLowerCase();
      const triggerName = m[2];
      if (excludeNames?.has(triggerName)) continue;
      triggers.push({ iconKey, label: makeTriggerLabel(triggerName, iconKey) });
    }
    const badgeRe = /\[\[([^\]]+)\]\]/g;
    const coveredLabels = new Set(triggers.map(t => t.label));
    while ((m = badgeRe.exec(content)) !== null) {
      const triggerName = m[1];
      if (triggerName === 'Add a trigger') continue;
      if (excludeNames?.has(triggerName)) continue;
      const ch = getTriggerChannel(triggerName) || '';
      const label = makeTriggerLabel(triggerName, ch);
      if (coveredLabels.has(label)) continue;
      triggers.push({ iconKey: ch, label });
    }
    return triggers;
  };
  const publishTriggers = React.useMemo<TriggerSummary[]>(
    () => parseTriggersFromInstructions(agentConfig.instructions || ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentConfig.instructions],
  );

  const workflowHasErrors = agentConfig.type === 'workflow' &&
    (agentConfig.workflowNodes ?? []).some(n => getNodeErrors(n).length > 0);

  const isPublishDisabled = isPublishing || agentConfig.type === 'placeholder' || isDay0Incomplete ||
    (!agentWasCreatedInPlanMode && agentConfig.type !== 'workflow' && !agentConfig.agentType && !agentConfig.instructions) ||
    (agentConfig.type === 'workflow' && !agentConfig.workflowNodes?.some(n => n.type === 'trigger' && !n.placeholder)) ||
    workflowHasErrors;


  return (
    <div className="h-screen flex relative bg-[hsl(var(--background))]" style={{ isolation: 'isolate' }}>
      {/* Gradient overlay — z-index -1 renders above root bg but below all flex children */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom right, hsl(var(--background)), hsl(var(--muted)))',
          opacity: isLanding ? 1 : 0,
          transition: 'opacity 0.5s ease',
          zIndex: -1,
        }}
      />
      <style>{`
        .tabs-disabled button {
          background-color: hsl(var(--muted)) !important;
          color: hsl(var(--text-disabled)) !important;
          border-color: hsl(var(--border)) !important;
        }
        .tabs-disabled button:hover {
          background-color: hsl(var(--muted)) !important;
          color: hsl(var(--text-disabled)) !important;
        }
      `}</style>
      {showConfetti && <ConfettiOverlay onDone={() => setShowConfetti(false)} />}

      {/* Name modal */}
      {showNameModal && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40">
          <div className="bg-[hsl(var(--card))] rounded-2xl shadow-2xl px-8 py-6 w-96">
            <h3 className="text-lg font-semibold text-[hsl(var(--text-primary))] mb-2">What's your name?</h3>
            <p className="text-sm text-[hsl(var(--text-subtle))] mb-4">We'll include it with your feedback.</p>
            <input
              type="text"
              value={pendingName}
              onChange={(e) => setPendingName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNameModalSubmit(); }}
              placeholder="Enter your name..."
              className="w-full px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple mb-4 bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowNameModal(false); setPendingName(''); }}
                className="px-4 py-2 text-sm text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--muted))] rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleNameModalSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-purple hover:bg-purple-700 rounded-lg"
              >
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset to Day 0 confirmation dialog */}
      <Dialog isOpen={showResetDay0Dialog} onClose={() => setShowResetDay0Dialog(false)} maxWidth="sm">
        <DialogHeader onClose={() => setShowResetDay0Dialog(false)}>
          Reset to Day 0
        </DialogHeader>
        <DialogContent>
          <p className="text-sm text-neutral-700">
            This will clear all tasks, skills, and chat history created after {agentConfig.name}'s initial setup. Their name and configuration from the creation prompt will be kept.
          </p>
          <p className="text-sm text-neutral-500 mt-2">This action cannot be undone.</p>
        </DialogContent>
        <DialogFooter>
          <CopilotButton variant="secondary" size="sm" onClick={() => setShowResetDay0Dialog(false)}>Cancel</CopilotButton>
          <CopilotButton variant="primary" size="sm" onClick={confirmResetToDay0} className="!bg-red-600 hover:!bg-red-700">Reset</CopilotButton>
        </DialogFooter>
      </Dialog>

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={confirmDeleteAgent}
        itemName={agentConfig.name}
        itemType={agentConfig.type === 'agent' ? 'agent' : 'workflow'}
      />

      {/* Left Navigation Rail */}
      <NavigationRail
        isNavExpanded={isNavExpanded}
        setIsNavExpanded={handleNavExpandChange}
        isHomePage={isHomePage}
        agents={(() => {
          const pinned = agents.filter(a => a.pinned !== false);
          const sorted = navOrder.length === 0
            ? pinned
            : [...pinned].sort((a, b) => {
                const ai = navOrder.indexOf(a.id);
                const bi = navOrder.indexOf(b.id);
                if (ai === -1 && bi === -1) return 0;
                if (ai === -1) return 1;
                if (bi === -1) return -1;
                return ai - bi;
              });
          // Deduplicate by name — when multiple agents share the same name,
          // keep only one entry. Prefers the current agent (so the active
          // work item is always reachable), then the newest (last in array).
          const seen = new Map<string, number>();
          // First pass: prefer currentAgentId for each name
          for (let i = 0; i < sorted.length; i++) {
            const name = sorted[i].name?.trim();
            if (!name) continue;
            if (sorted[i].id === currentAgentId) {
              seen.set(name, i); // current agent always wins
            }
          }
          // Second pass: for names not yet claimed, keep the last (newest)
          for (let i = sorted.length - 1; i >= 0; i--) {
            const name = sorted[i].name?.trim();
            if (name && !seen.has(name)) seen.set(name, i);
          }
          return sorted.filter((a, i) => {
            const name = a.name?.trim();
            if (!name) return true; // keep unnamed agents (placeholders)
            return seen.get(name) === i;
          });
        })()}
        currentAgentId={currentAgentId}
        switchAgent={handleSwitchAgent}
        isInConversationMode={isInConversationMode}
        setIsInConversationMode={setIsInConversationMode}
        pendingAgentData={pendingAgentData}
        isLanding={isLanding}
      />

      {isHomePage || isMyStuffPage || isDiscoverPage || isComponentsPage || isSnapshotsPage || isToolsPage || isFlowsPage ? (
        <div className={`flex-1 flex flex-col overflow-y-auto ${isMyStuffPage || isDiscoverPage || isComponentsPage ? 'px-6 md:px-8 lg:px-[30px] xl:px-[30px] 2xl:px-[30px]' : ''}`}>
          <Outlet context={{ buildActivePanel, setBuildActivePanel }} />
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Navigation - Spans full width above both panes (only in conversational mode) */}
          {isConversationalLayout && (isBuildPage || isPreviewPage || isEvaluatePage || isMonitorPage || isDistributePage) && isAgentType && !isFuzzyLoading && (
            <header
              className="relative flex items-center justify-between px-6 py-3 z-10 bg-[hsl(var(--background))] border-b border-[hsl(var(--border))]"
              style={isExiting ? {
                animation: 'fade-out 0.2s ease-out forwards',
                opacity: 1
              } : {
                animation: 'slide-up-fade 0.4s ease-out 150ms forwards',
                opacity: 0,
                transform: 'translateY(10px)'
              }}
            >
              {/* Left: Agent Name with Icon */}
              <div className={`min-w-0 flex items-center gap-2 ${
                isConversationalLayout && isBuildPage && isAgentType
                  ? 'max-w-[200px]'
                  : 'max-w-[calc(50%-10rem)] flex-shrink'
              }`}>
                <button
                  onClick={() => setShowIconPicker(true)}
                  className="hover:opacity-80 flex-shrink-0"
                  title="Change icon"
                >
                  <AgentIcon agent={agentConfig} size={24} />
                </button>
                <span className={`font-semibold text-gray-900 truncate block ${
                  isConversationalLayout && isBuildPage && isAgentType ? 'text-xs' : 'text-sm'
                }`}>{agentConfig.type === 'placeholder' ? 'New agent or workflow' : (agentConfig.name || 'New Agent')}</span>
                <SaveIndicator />
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-3">
                {/* Submit Feedback button (eval mode, build page only) */}
                {isEvalMode && isBuildPage && !feedbackSubmitted && (
                  <button
                    onClick={handleSubmitFeedback}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-brand-purple hover:bg-purple-700 rounded-lg transition-colors"
                  >
                    Submit Feedback
                  </button>
                )}
                {isEvalMode && isBuildPage && feedbackSubmitted && (
                  <span className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200">
                    Submitted
                  </span>
                )}
                {/* Auto-save status — shown before publish status */}
                {autoSaveStatusEl && <span className="text-sm text-gray-600">{autoSaveStatusEl}</span>}
                {/* Publishing Status Indicator */}
                {isPublishing && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <StatusIcon status="in-progress" size={16} />
                    <span>Publishing...</span>
                  </div>
                )}
                {!isPublishing && agentConfig.published && !hasDraftChanges && agentConfig.lastPublishedAt && (
                  <CopilotTooltip content={`Published ${formatFullDateTime(agentConfig.lastPublishedAt)}`} placement="bottom">
                    <div className="flex items-center gap-2 text-sm text-gray-600 cursor-default">
                      <span>Published {relativePublishTime}</span>
                    </div>
                  </CopilotTooltip>
                )}
                {!isPublishing && (!agentConfig.published || hasDraftChanges) && (agentWasCreatedInPlanMode || !!agentConfig.agentType) && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>Draft</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  {isManualSave && (
                    <CopilotButton
                      variant="secondary"
                      size="md"
                      onClick={handleManualSave}
                      disabled={!isManualSaveDirty}
                    >
                      Save
                    </CopilotButton>
                  )}
                  {agentConfig.type === 'workflow' && (
                    <CopilotButton
                      variant="secondary"
                      size="md"
                      onClick={() => { commitSave(); requestWorkflowSave(); }}
                    >
                      Save
                    </CopilotButton>
                  )}
                  <CopilotTooltip
                    content={workflowHasErrors ? 'Fix all node errors before publishing' : undefined}
                    placement="bottom"
                  >
                <div ref={publishButtonRef}>
                  {isVersionHistory && agentConfig.type !== 'workflow' ? (
                    <CopilotSplitButton
                      appearance="primary"
                      size="md"
                      onClick={handlePublishClick}
                      onMenuClick={() => {
                        const rect = publishButtonRef.current?.getBoundingClientRect();
                        if (rect) setPublishMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                      }}
                      menuOpen={publishMenuPos !== null}
                      disabled={isPublishDisabled}
                    >
                      {agentConfig.published ? 'Update' : 'Publish'}
                    </CopilotSplitButton>
                  ) : (
                    <CopilotButton
                      variant="primary"
                      size="md"
                      onClick={handlePublishClick}
                      disabled={isPublishDisabled}
                    >
                      {agentConfig.published ? 'Update' : 'Publish'}
                    </CopilotButton>
                  )}
                </div>
                  </CopilotTooltip>
                </div>
                {/* Agent notifications bell */}
                {isNewNotifications && (
                  <span ref={bellBtnRefFull} className="relative inline-flex">
                    <CopilotButton
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (notifPanelOpen) {
                          setNotifPanelOpen(false);
                        } else {
                          setNotifAnchorRect(bellBtnRefFull.current?.getBoundingClientRect() ?? null);
                          if (currentAgentId) markAgentRead(currentAgentId);
                          setNotifPanelOpen(true);
                        }
                      }}
                    >
                      {notifPanelOpen ? (
                        <Alert20Filled className="w-5 h-5 text-brand-purple" />
                      ) : (
                        <Alert20Regular className="w-5 h-5" />
                      )}
                    </CopilotButton>
                    {agentUnreadCount > 0 && !notifPanelOpen && (
                      <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white pointer-events-none" />
                    )}
                  </span>
                )}
                <div className="flex items-center gap-1">
                  <CopilotDropdown
                    options={[
                      ...(agentConfig.projectId && agentConfig.specAgentId ? [{
                        label: 'Export Guide',
                        value: 'export-guide',
                        icon: <ArrowDownload20Regular />,
                      }] : []),
                      {
                        label: 'Settings',
                        value: 'settings',
                        icon: <Settings20Regular />,
                        iconFilled: <Settings20Filled />,
                      },
                      ...(isShareCoauthoring ? [{
                        label: 'Share',
                        value: 'share',
                        icon: <Share20Regular />,
                        iconFilled: <Share20Filled />,
                      }] : []),
                      {
                        label: 'Delete',
                        value: 'delete',
                        icon: <Delete20Regular />,
                        iconFilled: <Delete20Filled />,
                        dividerAbove: true,
                        destructive: true,
                      },
                    ]}
                    onChange={handleAgentMenuAction}
                    iconOnly={true}
                    disabled={isDay0Incomplete}
                    triggerIcon={<MoreHorizontal20Regular />}
                    triggerIconFilled={<MoreHorizontal20Filled />}
                  />
                  {showConversationalLayoutFeature && (isBuildPage || isPreviewPage || isEvaluatePage || isMonitorPage || isDistributePage) && isAgentType && (
                    <button
                      onClick={handleToggleLayout}
                      className="p-2 text-gray-600 rounded-lg transition-colors"
                      title={isConversationalLayout ? 'Switch to canvas view' : 'Switch to conversational view'}
                      onMouseEnter={() => setIsToggleHovered(true)}
                      onMouseLeave={() => setIsToggleHovered(false)}
                    >
                      {isConversationalLayout ? (
                        isToggleHovered
                          ? <PanelLeftContract24Filled className="w-5 h-5 text-brand" />
                          : <PanelLeftContract24Regular className="w-5 h-5" />
                      ) : (
                        isToggleHovered
                          ? <PanelLeftExpand24Filled className="w-5 h-5 text-brand" />
                          : <PanelLeftExpand24Regular className="w-5 h-5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </header>
          )}

          {/* Content Panes - Different layouts for conversational vs regular mode */}
          <div
            className="flex-1 flex overflow-hidden min-h-0"
            style={
              isConversationalLayout && (isBuildPage || isPreviewPage || isEvaluatePage || isMonitorPage || isDistributePage) && isAgentType
                ? isExiting
                  ? { animation: 'fade-out 0.2s ease-out forwards', opacity: 1 }
                  : { animation: 'fadeInText 0.3s ease-out 100ms forwards', opacity: 0 }
                : undefined
            }
          >
            {isConversationalLayout && (isBuildPage || isPreviewPage || isEvaluatePage || isMonitorPage || isDistributePage) && isAgentType ? (
              <>
                {/* Conversational Mode: Helper Agent expanded, Main Content narrow */}
                {!isHelperCollapsed && (
                  <div className="flex-1 min-w-0">
                    <HelperAgent isExpanded={true} />
                  </div>
                )}
                <div
                  id="elevate-conv-right-pane"
                  className={`${isHelperCollapsed ? 'flex-1' : 'w-[400px]'} relative flex-shrink-0 flex flex-col overflow-visible`}
                  style={isExiting ? {
                    animation: 'fade-out 0.2s ease-out forwards',
                    opacity: 1
                  } : {
                    animation: 'slide-up-fade 0.4s ease-out 150ms forwards',
                    opacity: 0,
                    transform: 'translateY(10px)'
                  }}
                >
                  {/* Tabs at top of right pane */}
                  {!isFuzzyLoading && <div className={`flex-shrink-0 pt-8 px-8 bg-[hsl(var(--background))] ${agentConfig.type === 'placeholder' ? 'pointer-events-none tabs-disabled' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <CopilotTabs
                          tabs={tabs.map(tab => {
                            const isWorkflowGated = agentConfig.type === 'workflow' && !agentConfig.published && (tab.name === 'Evaluate' || tab.name === 'Monitor');
                            return {
                              label: tab.name,
                              value: tab.path,
                              disabled: (isDay0Incomplete && tab.name !== 'Build' && tab.name !== 'Spec') || isWorkflowGated,
                              disabledTooltip: isWorkflowGated ? 'Publish your workflow to unlock' : undefined,
                            };
                          })}
                          value={location.pathname}
                          onChange={(path) => navigate(path)}
                          size="md"
                          fullWidth
                        />
                      </div>
                      <CopilotButton
                        variant="icon-subtle"
                        size="sm"
                        icon={isHelperCollapsed
                          ? <PanelLeftExpand24Regular className="w-5 h-5" />
                          : <PanelLeftContract24Regular className="w-5 h-5" />
                        }
                        iconFilled={isHelperCollapsed
                          ? <PanelLeftExpand24Filled className="w-5 h-5 text-brand" />
                          : <PanelLeftContract24Filled className="w-5 h-5 text-brand" />
                        }
                        onClick={toggleHelperCollapsed}
                        title={isHelperCollapsed ? 'Show helper agent' : 'Hide helper agent'}
                      />
                    </div>
                  </div>}
                  <div className="flex-1 overflow-visible flex flex-col min-h-0">
                    <Outlet context={{ buildActivePanel, setBuildActivePanel }} />
                  </div>
                  {!agentWasCreatedInPlanMode && !isFuzzyLoading && isCreateFlowChecklist && helperMessages.some(m => m.role === 'assistant') && <ChecklistPane key={agentConfig.id} />}
                </div>
              </>
            ) : (
              <>
                {/* Regular Mode: Helper Agent narrow, Main Content with header */}
                {/* Always render on project page so pendingHelperAutoSubmit can fire even when helper is collapsed for a different agent */}
                {(!helperEffectivelyCollapsed || isProjectPage) && !(agentConfig.type === 'workflow' && isBuildPage && isHelperCollapsed) && (
                <div
                  className="flex-shrink-0 h-full"
                  style={(shouldAnimatePageEntry || shouldAnimateRegularMode) ? {
                    animation: 'slide-up-fade 0.4s ease-out 100ms forwards',
                    opacity: 0,
                    transform: 'translateY(10px)'
                  } : undefined}
                >
                  <HelperAgent isExpanded={false} />
                </div>
                )}
                {/* position: relative — portal anchor for PillConfigPanel absolute overlay */}
                <div id="elevate-right-pane" className="relative flex-1 flex flex-col overflow-hidden">
                  {!isSettingsPage && !isFuzzyLoading && !isDWAgent && !isProjectPage && <header
                    ref={headerCallbackRef}
                    className="relative grid grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)] items-center px-3 sm:px-6 py-3 z-10 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))]"
                    style={(shouldAnimatePageEntry || shouldAnimateRegularMode) ? {
                      animation: 'slide-up-fade 0.4s ease-out 150ms forwards',
                      opacity: 0,
                      transform: 'translateY(10px)'
                    } : undefined}
                    onAnimationEnd={() => {
                      setShouldAnimateRegularMode(false);
                      setAnimatingPageEntry(false);
                    }}
                  >
                    {/* Left: Agent Icon (when instructions header is stuck) + Agent Name */}
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Agent icon — always visible in global header */}
                      <div className="flex-shrink-0">
                        <button onClick={() => setShowIconPicker(true)} className="hover:opacity-80" title="Change icon">
                          {agentConfig.type === 'workflow' ? (
                            <SquircleIcon size={24} cornerRadius={6} gradient={agentConfig.gradientKey ? getGradientByKey(agentConfig.gradientKey) : getUniqueGradientCSS(agentConfig.id)}>
                              {agentConfig.iconImageData
                                ? <img src={agentConfig.iconImageData} style={{ width: 14, height: 14, objectFit: 'contain' }} alt="" />
                                : getAgentIcon(agentConfig.iconKey || 'tpl:workflow', 14)}
                            </SquircleIcon>
                          ) : (
                            <AgentIcon agent={agentConfig} size={24} />
                          )}
                        </button>
                      </div>
                      <span className="font-semibold text-gray-900 text-sm truncate min-w-0">{agentConfig.type === 'placeholder' ? 'New agent or workflow' : (agentConfig.name || 'New Agent')}</span>
                      <SaveIndicator />
                      {agentConfig.type === 'workflow' && isBuildPage && (
                        <>
                          <div className="w-px h-4 bg-gray-200 mx-1" />
                          <button
                            onClick={toggleHelperCollapsed}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                            title={isHelperCollapsed ? 'Show chat' : 'Hide chat'}
                          >
                            {isHelperCollapsed
                              ? <PanelLeftExpand24Regular className="w-5 h-5" />
                              : <PanelLeftContract24Regular className="w-5 h-5" />
                            }
                          </button>
                        </>
                      )}
                    </div>

                    {/* Center: Tabs — grid col 2 (auto), always anchored to center */}
                    <div className={`flex justify-center px-2 min-w-0 overflow-hidden ${agentConfig.type === 'placeholder' ? 'pointer-events-none tabs-disabled' : ''}`}>
                      <CopilotTabs
                        tabs={tabs.map(tab => {
                          const isWorkflowGated = agentConfig.type === 'workflow' && !agentConfig.published && (tab.name === 'Evaluate' || tab.name === 'Monitor');
                          const isSpecTab = tab.name === 'Spec';
                          return {
                            label: tab.name,
                            value: tab.path,
                            disabled: (isDay0Incomplete && tab.name !== 'Build' && !isSpecTab) || isWorkflowGated,
                            disabledTooltip: isWorkflowGated ? 'Publish your workflow to unlock' : undefined,
                          };
                        })}
                        value={location.pathname}
                        onChange={(path) => navigate(path)}
                        size="md"
                        collapsible
                        availableWidth={headerWidth > 0 ? Math.floor(headerWidth * 0.45) : undefined}
                      />
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-3 justify-end -mr-1.5 sm:mr-0">
                      {/* Strikethrough toggle — show deleted text in HA review, gated behind Review UI toggle */}
                      {isHAReviewUIEnabled && showDeletedToggle && isBuildPage && (
                        <CopilotTooltip content={highlightAllChanges ? 'Hide all changes' : 'Show all changes'} placement="bottom">
                          <CopilotButton
                            variant="icon"
                            size="sm"
                            icon={<TextStrikethrough20Regular />}
                            iconFilled={<TextStrikethrough20Filled />}
                            checked={highlightAllChanges}
                            onClick={() => setHighlightAllChanges(!highlightAllChanges)}
                            className={`!border-transparent ${highlightAllChanges ? '!bg-brand-background hover:!bg-brand-background-hover text-brand-purple' : '!bg-transparent hover:!bg-transparent'}`}
                          />
                        </CopilotTooltip>
                      )}
                      {/* Undo/redo controls — workflows always shown; agents only when isAgentGlobalUndo */}
                      {(isBuildPage || isPreviewPage || isMonitorPage || isDistributePage || isSettingsPage) &&
                       (isAgentGlobalUndo || agentConfig?.type === 'workflow') && (
                        <div className="flex items-center gap-1">
                          <CopilotTooltip content={undoLabel} placement="bottom">
                            <CopilotButton variant="icon" size="sm" icon={<ArrowUndo20Regular />} iconFilled={<ArrowUndo20Filled />} onClick={undo} disabled={!canUndo} className="!bg-transparent !border-transparent hover:!bg-transparent" />
                          </CopilotTooltip>
                          <CopilotTooltip content={redoLabel} placement="bottom">
                            <CopilotButton variant="icon" size="sm" icon={<ArrowRedo20Regular />} iconFilled={<ArrowRedo20Filled />} onClick={redo} disabled={!canRedo} className="!bg-transparent !border-transparent hover:!bg-transparent" />
                          </CopilotTooltip>
                        </div>
                      )}
                      {/* Submit Feedback button (eval mode, build page only) */}
                      {isEvalMode && isBuildPage && !feedbackSubmitted && (
                        <button
                          onClick={handleSubmitFeedback}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-brand-purple hover:bg-purple-700 rounded-lg transition-colors"
                        >
                          Submit Feedback
                        </button>
                      )}
                      {isEvalMode && isBuildPage && feedbackSubmitted && (
                        <span className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200">
                          Submitted
                        </span>
                      )}
                      {/* Auto-save status — shown before publish status */}
                      {autoSaveStatusEl && <span className="text-xs text-gray-500">{autoSaveStatusEl}</span>}
                      {/* Status text — hides first at semi-compact, hidden on evaluate tab */}
                      {!isHeaderSemiCompact && !isEvaluatePage && (
                        <>
                          {isPublishing && (
                            <div className="flex items-center gap-2 text-xs text-gray-500 text-right">
                              <StatusIcon status="in-progress" size={16} />
                              <span>Publishing...</span>
                            </div>
                          )}
                          {!isPublishing && agentConfig.published && !hasDraftChanges && agentConfig.lastPublishedAt && (
                            <CopilotTooltip content={`Published ${formatFullDateTime(agentConfig.lastPublishedAt)}`} placement="bottom">
                              <div className="flex items-center gap-2 text-xs text-gray-500 text-right cursor-default">
                                <span>Published {relativePublishTime}</span>
                              </div>
                            </CopilotTooltip>
                          )}
                          {!isPublishing && (!agentConfig.published || hasDraftChanges) && (agentWasCreatedInPlanMode || !!agentConfig.agentType) && (
                            <div className="flex items-center gap-2 text-xs text-gray-500 text-right">
                              <span>Draft</span>
                            </div>
                          )}
                        </>
                      )}
                      {/* Export Guide moved to ... overflow menu */}
                      {/* Save + Publish buttons — hides at full compact, hidden on evaluate tab */}
                      {!isHeaderCompact && !isEvaluatePage && (
                        <div className="flex items-center gap-1.5">
                          {isManualSave && (
                            <CopilotButton
                              variant="secondary"
                              size="md"
                              onClick={handleManualSave}
                              disabled={!isManualSaveDirty}
                            >
                              Save
                            </CopilotButton>
                          )}
                          {agentConfig.type === 'workflow' && (
                            <CopilotButton
                              variant="secondary"
                              size="md"
                              onClick={() => { commitSave(); requestWorkflowSave(); }}
                            >
                              Save
                            </CopilotButton>
                          )}
                          <CopilotTooltip
                            content={workflowHasErrors ? 'Fix all node errors before publishing' : undefined}
                            placement="bottom"
                          >
                            <div ref={publishButtonRef}>
                              {isVersionHistory && agentConfig.type !== 'workflow' ? (
                                <CopilotSplitButton
                                  appearance="primary"
                                  size="md"
                                  onClick={handlePublishClick}
                                  onMenuClick={() => {
                                    const rect = publishButtonRef.current?.getBoundingClientRect();
                                    if (rect) setPublishMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                  }}
                                  menuOpen={publishMenuPos !== null}
                                  disabled={isPublishDisabled}
                                >
                                  {agentConfig.published ? 'Update' : 'Publish'}
                                </CopilotSplitButton>
                              ) : (
                                <CopilotButton
                                  variant="primary"
                                  size="md"
                                  onClick={handlePublishClick}
                                  disabled={isPublishDisabled}
                                >
                                  {agentConfig.published ? 'Update' : 'Publish'}
                                </CopilotButton>
                              )}
                            </div>
                          </CopilotTooltip>
                        </div>
                      )}
                      {/* Agent notifications bell */}
                      {isNewNotifications && (
                        <span ref={bellBtnRefCompact} className="relative inline-flex">
                          <CopilotButton
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (notifPanelOpen) {
                                setNotifPanelOpen(false);
                              } else {
                                setNotifAnchorRect(bellBtnRefCompact.current?.getBoundingClientRect() ?? null);
                                if (currentAgentId) markAgentRead(currentAgentId);
                                setNotifPanelOpen(true);
                              }
                            }}
                          >
                            {notifPanelOpen ? (
                              <Alert20Filled className="w-5 h-5 text-brand-purple" />
                            ) : (
                              <Alert20Regular className="w-5 h-5" />
                            )}
                          </CopilotButton>
                          {agentUnreadCount > 0 && !notifPanelOpen && (
                            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white pointer-events-none" />
                          )}
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                        <div ref={shareButtonRef}>
                          <CopilotDropdown
                            options={[
                              ...(isHeaderSemiCompact && compactPublishStatusLabel ? [{
                                label: compactPublishStatusLabel,
                                value: '__status__',
                                disabled: true,
                              }] : []),
                              ...(isHeaderCompact ? [{
                                label: agentConfig.published ? 'Update' : 'Publish',
                                value: 'publish',
                                disabled: isPublishDisabled,
                                dividerAbove: isHeaderSemiCompact && !!compactPublishStatusLabel,
                                icon: <ArrowUpload20Regular />,
                                iconFilled: <ArrowUpload20Filled />,
                              }] : []),
                              ...(agentConfig.projectId && agentConfig.specAgentId ? [{
                                label: 'Export Guide',
                                value: 'export-guide',
                                icon: <ArrowDownload20Regular />,
                              }] : []),
                              {
                                label: 'Settings',
                                value: 'settings',
                                icon: <Settings20Regular />,
                                iconFilled: <Settings20Filled />,
                              },
                              ...(isShareCoauthoring ? [{
                                label: 'Share',
                                value: 'share',
                                icon: <Share20Regular />,
                                iconFilled: <Share20Filled />,
                              }] : []),
                              {
                                label: 'Delete',
                                value: 'delete',
                                icon: <Delete20Regular />,
                                iconFilled: <Delete20Filled />,
                                dividerAbove: true,
                                destructive: true,
                              },
                            ]}
                            onChange={handleAgentMenuAction}
                            iconOnly={true}
                            disabled={isDay0Incomplete}
                            triggerIcon={<MoreHorizontal20Regular />}
                            triggerIconFilled={<MoreHorizontal20Filled />}
                          />
                        </div>
                        {showConversationalLayoutFeature && (isBuildPage || isPreviewPage || isEvaluatePage || isMonitorPage || isDistributePage) && isAgentType && (
                          <button
                            onClick={handleToggleLayout}
                            className="p-2 text-gray-600 rounded-lg transition-colors"
                            title={isConversationalLayout ? 'Switch to canvas view' : 'Switch to conversational view'}
                            onMouseEnter={() => setIsToggleHovered(true)}
                            onMouseLeave={() => setIsToggleHovered(false)}
                          >
                            {isConversationalLayout ? (
                              isToggleHovered
                                ? <PanelLeftContract24Filled className="w-5 h-5 text-brand" />
                                : <PanelLeftContract24Regular className="w-5 h-5" />
                            ) : (
                              isToggleHovered
                                ? <PanelLeftExpand24Filled className="w-5 h-5 text-brand" />
                                : <PanelLeftExpand24Regular className="w-5 h-5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </header>}

                  {/* AI Teammate (DW) header — rendered by DWBuildHeader (domain component) */}
                  {isDWAgent && !isSettingsPage && !isFuzzyLoading && !isProjectPage && (
                    <DWBuildHeader
                      onEditIcon={() => setShowIconPicker(true)}
                      onSettings={handleSettings}
                      onDelete={handleDeleteAgent}
                      onResetDay0={() => setShowResetDay0Dialog(true)}
                    />
                  )}

                  <div
                    id="elevate-right-content"
                    className={`relative flex-1 ${isBuildPage && !isDWAgent ? 'overflow-y-auto' : 'overflow-hidden'} flex flex-col min-h-0 ${
                      isSettingsPage ? '' : (agentConfig.type === 'workflow' && location.pathname === '/build') || (agentConfig.type === 'workflow' && isEvaluatePage) || location.pathname === '/preview' || isMonitorPage || isDWAgent ? '' : 'px-6 md:px-8 lg:px-[30px] xl:px-[30px] 2xl:px-[30px]'
                    }`}
                    style={(shouldAnimatePageEntry || shouldAnimateRegularMode) ? {
                      animation: 'slide-up-fade 0.4s ease-out 200ms forwards',
                      opacity: 0,
                      transform: 'translateY(10px)'
                    } : undefined}
                  >
                    <Outlet context={{ buildActivePanel, setBuildActivePanel }} />
                  </div>
                  {!agentWasCreatedInPlanMode && !isFuzzyLoading && isCreateFlowChecklist && helperMessages.some(m => m.role === 'assistant') && (isBuildPage || isPreviewPage || isEvaluatePage || isMonitorPage || isDistributePage) && <ChecklistPane key={agentConfig.id} />}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating Eval Results Button */}
      {showEvalResults && !isDWAgent && (
        <button
          onClick={async () => {
            try {
              const response = await fetch('http://localhost:3005/api/eval-results/latest');

              if (!response.ok) {
                if (response.status === 404) {
                  isNewNotifications ? addToast({ variant: 'warning', title: 'No results found', message: 'Run npm run test:e2e to generate evaluation results.' }) : alert('No evaluation results found. Run npm run test:e2e to generate results.');
                } else {
                  isNewNotifications ? addToast({ variant: 'error', title: 'Error loading results', message: 'Please try again.' }) : alert('Error loading evaluation results. Please try again.');
                }
                return;
              }

              const data = await response.json();
              window.open(`http://localhost:3005/eval-results/${data.filename}`, '_blank');
            } catch (error) {
              console.error('Error opening eval results:', error);
              isNewNotifications ? addToast({ variant: 'error', title: 'Error loading results', message: 'Check that the server is running.' }) : alert('Error loading evaluation results. Please check that the server is running.');
            }
          }}
          className="fixed bottom-6 right-6 px-4 py-3 bg-brand-purple hover:bg-purple-700 text-white rounded-lg shadow-lg hover:scale-105 transition-all flex items-center gap-2 z-50"
          title="View Evaluation Results"
        >
          <span>📊</span>
          <span className="font-medium">View Eval Results</span>
        </button>
      )}

      {/* Version History Sheet */}
      {isVersionHistory && (
        <VersionHistorySheet
          isOpen={showVersionHistorySheet}
          onClose={() => setShowVersionHistorySheet(false)}
          entries={agentVersionHistory.filter(e => {
            if (e.versionType === 'published' || e.versionType === 'draft-restored') return true;
            if (e.versionType === 'milestone') return showVersionMilestones;
            if (e.versionType === 'draft') return showDraftCheckpoints;
            return true;
          })}
          onRestore={(id) => { restoreVersion(id); setShowVersionHistorySheet(false); }}
          onSaveMilestone={showVersionMilestones ? (desc) => saveVersionEntry('milestone', '', desc) : undefined}
        />
      )}

      {/* Publish overflow menu (Version history) */}
      {publishMenuPos && (
        <CopilotMenu
          items={[
            ...(isVersionHistory ? [{
              label: 'Version history',
              onClick: () => { setPublishMenuPos(null); setShowVersionHistorySheet(true); },
            }] : []),
          ]}
          position={publishMenuPos}
          onClose={() => setPublishMenuPos(null)}
          minWidth={160}
        />
      )}

      {/* Publish Agent Dialog */}
      <PublishAgentDialog
        isOpen={showPublishDialog}
        onClose={() => setShowPublishDialog(false)}
        onConfirm={handlePublishDialogConfirm}
        agentName={agentConfig.name}
        version={agentConfig.published ? incrementVersion(agentConfig.version) : '1'}
      />

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        onClose={() => { setShowUnsavedDialog(false); setPendingSwitchAgentId(null); }}
        onDiscard={handleUnsavedDiscard}
        onSaveAndLeave={handleUnsavedSaveAndLeave}
      />


      {/* Share Dialog */}
      {isShareCoauthoring && (
        <ShareDialog
          isOpen={showShareDialog}
          onClose={() => setShowShareDialog(false)}
          agentName={agentConfig.name}
          shareUrl={`${window.location.origin}/agents/${agentConfig.id}`}
          buttonRef={shareButtonRef}
        />
      )}

      {/* AI Teammate create dialog — global, shown from any page */}
      <DWCreateDialog
        isOpen={isDwCreateDialogOpen}
        onCancel={() => closeDwCreateDialog(true)}
      />

      {/* Icon Picker Dialog */}
      <IconPickerDialog
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        currentIconKey={agentConfig.systemColorIcon || agentConfig.iconKey || detectAgentDomain(agentConfig)}
        currentGradientKey={agentConfig.gradientKey || 'blue'}
        onSelect={handleIconSelect}
      />

      {/* Agent notification popover */}
      {isNewNotifications && notifPanelOpen && (
        <NotificationPopover
          anchorRect={notifAnchorRect}
          onClose={() => setNotifPanelOpen(false)}
          agentId={currentAgentId ?? undefined}
        />
      )}
      {/* Figma Transposer — flow capture overlay (feature flag: UI/UX > Figma Transposer) */}
      {isFlowCaptureEnabled && <FlowCaptureOverlay />}
    </div>
  );
};
