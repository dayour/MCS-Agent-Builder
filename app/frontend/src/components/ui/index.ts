/**
 * Coworker UI Components
 *
 * M365 Copilot-style components based on the Coworker Design System.
 * Import components from this file for consistent styling across the app.
 */

// Button components — Fluent 2 Button, Toggle, Menu, Split, Compound
export { CopilotButton } from './CopilotButton';
export { ActivitySummaryButton } from './ActivitySummaryButton';
export type { ActivitySummaryButtonProps } from './ActivitySummaryButton';
export type { CopilotButtonProps } from './CopilotButton';

export { CopilotSplitButton } from './CopilotSplitButton';
export type { CopilotSplitButtonProps, SplitButtonAppearance, SplitButtonSize } from './CopilotSplitButton';

export { CopilotCompoundButton } from './CopilotCompoundButton';
export type { CopilotCompoundButtonProps, CompoundButtonAppearance, CompoundButtonSize } from './CopilotCompoundButton';

// Filter pill — interactive toggle chip for filter bars
export { CopilotFilterPill } from './CopilotFilterPill';
export type { CopilotFilterPillProps, FilterPillSize } from './CopilotFilterPill';

// Enhanced input suggestions — unified suggestion/select UI for HelperAgent chat
export { EnhancedInputSuggestion } from './EnhancedInputSuggestion';
export type { EnhancedInputItem, EnhancedInputSuggestionProps } from './EnhancedInputSuggestion';
export { EnhancedInputSuggestionList } from './EnhancedInputSuggestionList';
export type { EnhancedInputSuggestionListProps } from './EnhancedInputSuggestionList';

// Badge component — Fluent 2 Badge (filled / tint / outline / ghost)
export { CopilotBadge } from './CopilotBadge';
export type { CopilotBadgeProps, BadgeAppearance, BadgeColor, BadgeSize, BadgeShape } from './CopilotBadge';

// Context/action menu
export { CopilotMenu } from './CopilotMenu';
export type { CopilotMenuProps, CopilotMenuItem, CopilotMenuPosition } from './CopilotMenu';

// Channel Icons
export { M365Icon, SlackIcon, SharePointIcon, WhatsAppIcon, ChannelIcon, getChannelInfo } from './ChannelIcons';
export type { ChannelInfo } from './ChannelIcons';

// Tooltip
export { CopilotTooltip } from './CopilotTooltip';
export type { CopilotTooltipProps } from './CopilotTooltip';

// Component Pill — inline pill for component references in instructions
export { ComponentPill } from './ComponentPill';
export type { ComponentPillProps } from './ComponentPill';
export { WorkflowsPill } from './WorkflowsPill';
export type { WorkflowsPillProps } from './WorkflowsPill';

// Toggle switch
export { CopilotToggle } from './CopilotToggle';
export type { CopilotToggleProps } from './CopilotToggle';

// Form controls
export { CopilotDropdown } from './CopilotDropdown';
export type { CopilotDropdownProps, DropdownOption } from './CopilotDropdown';

export { CopilotInput } from './CopilotInput';
export type { CopilotInputProps, InputAppearance, InputSize, PillInputHandle } from './CopilotInput';

// PillInput — contentEditable pill input with dynamic-value pill insertion
export { PillInput, createPillElement } from './PillInput';
export type { PillData } from './PillInput';

export { CopilotTextarea } from './CopilotTextarea';
export type { CopilotTextareaProps } from './CopilotTextarea';

export { CopilotCheckbox } from './CopilotCheckbox';
export type { CopilotCheckboxProps } from './CopilotCheckbox';

export { CopilotRadioGroup } from './CopilotRadioGroup';
export type { CopilotRadioGroupProps, CopilotRadioOption } from './CopilotRadioGroup';

export { CopilotTabs } from './CopilotTabs';
export type { CopilotTabsProps, TabOption } from './CopilotTabs';

export { CopilotUnderlineTabs } from './CopilotUnderlineTabs';
export type { CopilotUnderlineTabsProps, UnderlineTabOption } from './CopilotUnderlineTabs';

export { CopilotList } from './CopilotList';
export type { CopilotListProps, ListItem } from './CopilotList';

export { CopilotTable } from './CopilotTable';
export type { CopilotTableProps, TableColumn, SortDirection } from './CopilotTable';

// Status indicators and loading states
export { StatusIcon, LatencyLoader } from './StatusIcon';
export type { StatusType } from './StatusIcon';

// Cards
export { WorkIQCard } from './WorkIQCard';
export type { WorkIQCardProps } from './WorkIQCard';

export { ChangeSummaryCard } from './ChangeSummaryCard';
export type { ChangeSummaryCardProps } from './ChangeSummaryCard';


export { DisambiguationCard } from './DisambiguationCard';
export type { DisambiguationOption } from './DisambiguationCard';

export { PlanCard } from './PlanCard';
export type { PlanTask } from './PlanCard';

export { MetricCard } from './CopilotCard';
export type { MetricCardProps } from './CopilotCard';

export { ContentCard } from './CopilotCard';
export type { ContentCardProps } from './CopilotCard';

// Snapshot card — displays an agent snapshot with lifecycle badge, tags, and load action
export { SnapshotCard } from './SnapshotCard';
export type { SnapshotCardProps } from './SnapshotCard';

// DW (Digital Worker / AI Teammate) action cards — Teams adaptive card style
export { DwInstructionsCard } from './DwInstructionsCard';
export type { DwInstructionsCardProps } from './DwInstructionsCard';

export { DwSkillCard } from './DwSkillCard';
export type { DwSkillCardProps } from './DwSkillCard';

export { DwTaskCard } from './DwTaskCard';
export type { DwTaskCardProps } from './DwTaskCard';

export { DwTaskListCard } from './DwTaskListCard';
export type { DwTaskListCardProps, DwTaskListTask } from './DwTaskListCard';

// Dialog components
export { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter, DialogDescription } from './Dialog';
export { DeleteConfirmDialog } from './DeleteConfirmDialog';
export type { DeleteConfirmDialogProps } from './DeleteConfirmDialog';
export { PublishConfirmDialog } from './PublishConfirmDialog';
export type { PublishConfirmDialogProps } from './PublishConfirmDialog';
export { UpdateConfirmDialog } from './UpdateConfirmDialog';
export type { UpdateConfirmDialogProps } from './UpdateConfirmDialog';
export { UnsavedChangesDialog } from './UnsavedChangesDialog';
export type { UnsavedChangesDialogProps } from './UnsavedChangesDialog';
export { ShareDialog } from './ShareDialog';
export type { ShareDialogProps } from './ShareDialog';
export { PublishSuccessDialog } from './PublishSuccessDialog';
export type { PublishSuccessDialogProps } from './PublishSuccessDialog';
export { PublishAgentDialog } from './PublishAgentDialog';
export type { PublishAgentDialogProps } from './PublishAgentDialog';

// Panels
export { CollapsibleSection } from './CollapsibleSection';

// Instruction pills
export { InstructionPill } from './InstructionPill';
export type { InstructionPillProps } from './InstructionPill';
export { PillConfigPanel } from './PillConfigPanel';
export type { PillConfigPanelProps } from './PillConfigPanel';

// Agent icon
export { AgentIcon } from './AgentIcon';
export { IconPickerDialog } from './IconPickerDialog';

// Chat components
export { CopilotChatInput } from './CopilotChatInput';
export { CopilotMessage, CopilotTypingIndicator } from './CopilotMessage';
export { ChatSuggestions } from './ChatSuggestions';
export { ChainOfThought, ChainOfThoughtItem } from './ChainOfThought';
export type { ChainOfThoughtItemProps } from './ChainOfThought';
export { VersionHistory, VersionHistoryItem } from './VersionHistory';
export type { VersionHistoryProps, VersionHistoryItemProps, VersionHistorySource } from './VersionHistory';
export { ProgressTimeline } from './ProgressTimeline';
export type { ProgressItem } from './ProgressTimeline';

// Toast notifications
export { CopilotToast, ToastContainer, VariantIcon } from './CopilotToast';
export type { CopilotToastProps } from './CopilotToast';
export { ToastProvider, useToast } from '../../context/ToastContext';
export type { ToastItem, ToastVariant, NotificationRecord } from '../../context/ToastContext';

// Notification popover — bell icon dropdown showing notification history
export { NotificationPopover } from './NotificationPopover';
export type { NotificationPopoverProps } from './NotificationPopover';

// Creation tasks panel for conversational create flow
export { CreationTasksPanel } from './CreationTasksPanel';
export type { CreationTask, CreationTaskStatus } from './CreationTasksPanel';

// Sub-header
export { SubHeader, SubHeaderBadge } from './SubHeader';
export type { SubHeaderProps } from './SubHeader';

// DA Activity Chain of Thought
export { DAActivityCoT } from './DAActivityCoT';
export type { DAActivityCoTProps, DANode, DACoTStep, DACoTSource, DANodeType, DANodeStatus } from './DAActivityCoT';

// Save indicator
export { SaveIndicator } from './SaveIndicator';

// Internal / shared icon and tag utilities
export * from './AttachmentTag';
export * from './ClaudeModelIcons';
export * from './CopilotStudioIcon';
export * from './EditableIcon';
export * from './OpenAIModelIcons';
export * from './SquircleIcon';
