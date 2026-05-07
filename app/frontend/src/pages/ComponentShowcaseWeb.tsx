import React, { useState, useRef } from 'react';
import { DigitalWorker20Regular, DigitalWorker20Filled } from '../assets/icons/digital-worker';
import { CopilotTabs } from '../components/ui/CopilotTabs';
import { CopilotUnderlineTabs } from '../components/ui/CopilotUnderlineTabs';
import {
  CopilotButton,
  ActivitySummaryButton,
  CopilotBadge,
  CopilotFilterPill,
  ComponentPill,
  WorkflowsPill,
  CopilotMenu,
  StatusIcon,
  LatencyLoader,
  DisambiguationCard,
  EnhancedInputSuggestionList,
  CollapsibleSection,
  ChatSuggestions,
  CopilotChatInput,
  CopilotMessage,
  CopilotTypingIndicator,
  ChainOfThought,
  ChainOfThoughtItem,
  VersionHistory,
  VersionHistoryItem,
  DAActivityCoT,
  ProgressTimeline,
  CreationTasksPanel,
  WorkIQCard,
  ChangeSummaryCard,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
} from '../components/ui';
import { CopilotDropdown } from '../components/ui/CopilotDropdown';
import { domainIconMap, domainMeta, gradientPalette, templateIconMap, connectorIcons, getConnectorIcon } from '../utils/agentIcons';
import { CopilotList } from '../components/ui/CopilotList';
import { CopilotTable } from '../components/ui/CopilotTable';
import { PlanMessage } from '../components/PlanMessage';
import { LoaderCanvas } from '../components/LoaderCanvas';
import { CopilotInput } from '../components/ui/CopilotInput';
import { CopilotSplitButton } from '../components/ui/CopilotSplitButton';
import { CopilotCompoundButton } from '../components/ui/CopilotCompoundButton';
import { CopilotTextarea } from '../components/ui/CopilotTextarea';
import { CopilotCheckbox } from '../components/ui/CopilotCheckbox';
import { CopilotRadioGroup } from '../components/ui/CopilotRadioGroup';
import { CopilotCard, MetricCard, ContentCard } from '../components/ui/CopilotCard';
import { CopilotTooltip } from '../components/ui/CopilotTooltip';
import { CopilotToast } from '../components/ui/CopilotToast';
import { NotificationPopover } from '../components/ui/NotificationPopover';
import { useToast } from '../context/ToastContext';
import { InstructionPill } from '../components/ui/InstructionPill';
import { PillConfigPanel } from '../components/ui/PillConfigPanel';
import { DeleteConfirmDialog } from '../components/ui/DeleteConfirmDialog';
import { ShareDialog } from '../components/ui/ShareDialog';
import { IconPickerDialog } from '../components/ui/IconPickerDialog';
import { AgentIcon } from '../components/ui/AgentIcon';
import { EditableIcon } from '../components/ui/EditableIcon';
import { SaveIndicator } from '../components/ui/SaveIndicator';
import { SnapshotCard } from '../components/ui/SnapshotCard';
import { SubHeader, SubHeaderBadge } from '../components/ui/SubHeader';
import { DwInstructionsCard } from '../components/ui/DwInstructionsCard';
import { DwSkillCard } from '../components/ui/DwSkillCard';
import { DwTaskCard } from '../components/ui/DwTaskCard';
import { DwTaskListCard } from '../components/ui/DwTaskListCard';
import { UnsavedChangesDialog } from '../components/ui/UnsavedChangesDialog';
import { PublishAgentDialog } from '../components/ui/PublishAgentDialog';
import type { AgentSnapshot } from '../types';
import { CopilotToggle } from '../components/ui/CopilotToggle';
import { SYSTEM_COLOR_ICONS } from '../utils/systemColorIcons';
import { SquircleIcon } from '../components/ui/SquircleIcon';
import { M365Icon, SlackIcon, SharePointIcon, WhatsAppIcon, ChannelIcon, getChannelInfo } from '../components/ui/ChannelIcons';
import { ClaudeSonnetIcon } from '../components/ui/ClaudeModelIcons';
import {
  // Status & Indicators
  CheckmarkCircle20Filled,
  CheckmarkCircle20Regular,
  CheckmarkCircle16Filled,
  Circle20Regular,
  Circle20Filled,
  Sparkle20Filled,
  Sparkle20Regular,
  ArrowSync20Regular,
  ArrowSync16Regular,
  Warning20Regular,
  Warning20Filled,
  Info20Regular,
  Info20Filled,
  ErrorCircle20Regular,
  ErrorCircle20Filled,
  Checkmark20Regular,
  Checkmark20Filled,
  QuestionCircle20Regular,
  QuestionCircle20Filled,
  Prohibited20Regular,
  ShieldCheckmark20Regular,
  ShieldCheckmark20Filled,

  // Navigation & Arrows
  ChevronDown20Regular,
  ChevronRight20Regular,
  ChevronLeft20Regular,
  ChevronUp20Regular,
  ChevronDoubleDown20Regular,
  ChevronDoubleUp20Regular,
  ChevronDoubleLeft20Regular,
  ChevronDoubleRight20Regular,
  ArrowLeft20Regular,
  ArrowRight20Regular,
  ArrowUp20Regular,
  ArrowDown20Regular,
  ArrowCircleDown20Regular,
  ArrowCircleUp20Regular,
  ArrowCircleLeft20Regular,
  ArrowCircleRight20Regular,
  ArrowExpand20Regular,
  ArrowMinimize20Regular,
  ArrowMaximize20Regular,
  ArrowUndo20Regular,
  ArrowRedo20Regular,
  ArrowRepeatAll20Regular,
  ArrowShuffle20Regular,
  ArrowEnter20Regular,
  ArrowExit20Regular,
  ArrowDownload20Regular,
  ArrowUpload20Regular,
  ArrowClockwise20Regular,
  ArrowCounterclockwise20Regular,
  ArrowSortDown20Regular,
  ArrowSortUp20Regular,
  Home20Regular,
  Home20Filled,
  Navigation20Regular,
  PanelLeftExpand20Regular,
  PanelLeftContract20Regular,
  PersonAccounts20Regular,
  PersonAccounts20Filled,
  SignOut20Regular,
  SignOut20Filled,
  GlanceHorizontalSparkles24Regular,

  // Actions & Editing
  Search20Regular,
  Search20Filled,
  Settings20Regular,
  Settings20Filled,
  Add20Regular,
  Add20Filled,
  AddCircle20Regular,
  AddCircle20Filled,
  Dismiss20Regular,
  DismissCircle20Regular,
  DismissCircle20Filled,
  Edit20Regular,
  Edit20Filled,
  Copy20Regular,
  Delete20Regular,
  Delete20Filled,
  Send20Regular,
  Send20Filled,
  Save20Regular,
  Save20Filled,
  Print20Regular,
  Share20Regular,
  Share20Filled,
  Filter20Regular,
  Filter20Filled,
  MoreHorizontal20Regular,
  MoreHorizontal20Filled,
  ArrowSort20Regular,
  MoreVertical20Regular,
  SelectAllOn20Regular,
  Cut20Regular,
  ClipboardPaste20Regular,
  Rename20Regular,
  Pin20Regular,
  Pin20Filled,
  PinOff20Regular,
  Bookmark20Regular,
  Bookmark20Filled,
  BookmarkMultiple20Regular,
  Flag20Regular,
  Flag20Filled,
  Options20Regular,
  Open20Regular,
  OpenOff20Regular,
  ZoomIn20Regular,
  ZoomOut20Regular,
  FullScreenMaximize20Regular,
  FullScreenMinimize20Regular,

  // Media & Playback
  Play20Regular,
  Play20Filled,
  PlayCircle20Regular,
  PlayCircle20Filled,
  Pause20Regular,
  Pause20Filled,
  Stop20Regular,
  Stop20Filled,
  Record20Regular,
  Record20Filled,
  FastForward20Regular,
  Rewind20Regular,
  Previous20Regular,
  Next20Regular,
  Mic20Regular,
  Mic20Filled,
  MicOff20Regular,
  Speaker220Regular,
  Speaker220Filled,
  SpeakerMute20Regular,
  Image20Regular,
  Image20Filled,
  ImageMultiple20Regular,
  ImageAdd20Regular,
  Video20Regular,
  Video20Filled,
  VideoOff20Regular,
  Camera20Regular,
  Camera20Filled,
  CameraAdd20Regular,
  ShareScreenStart20Regular,
  ShareScreenStop20Regular,
  MusicNote120Regular,
  MusicNote220Regular,

  // Files & Documents
  Document20Regular,
  Document20Filled,
  DocumentAdd20Regular,
  DocumentCopy20Regular,
  DocumentMultiple20Regular,
  DocumentPdf20Regular,
  DocumentText20Regular,
  DocumentBulletList20Regular,
  DocumentCheckmark20Regular,
  DocumentDismiss20Regular,
  DocumentSearch20Regular,
  Folder20Regular,
  Folder20Filled,
  FolderAdd20Regular,
  FolderOpen20Regular,
  FolderZip20Regular,
  Archive20Regular,
  Attach20Regular,
  AttachArrowRight20Regular,
  Link20Regular,
  LinkDismiss20Regular,
  LinkSquare20Regular,

  // Communication
  Mail20Regular,
  Mail20Filled,
  MailRead20Regular,
  MailUnread20Regular,
  MailAdd20Regular,
  MailDismiss20Regular,
  MailInbox20Regular,
  Chat20Regular,
  Chat20Filled,
  ChatMultiple20Regular,
  ChatBubblesQuestion20Regular,
  Comment20Regular,
  Comment20Filled,
  CommentAdd20Regular,
  CommentMultiple20Regular,
  Call20Regular,
  Call20Filled,
  CallEnd20Regular,
  CallMissed20Regular,
  CallForward20Regular,
  ContactCard20Regular,
  ContactCard20Filled,
  Mention20Regular,

  // People & Users
  People20Regular,
  People20Filled,
  PeopleAdd20Regular,
  PeopleCommunity20Regular,
  PeopleTeam20Regular,
  Person20Regular,
  Person20Filled,
  PersonAdd20Regular,
  PersonDelete20Regular,
  PersonCircle20Regular,
  Guest20Regular,

  // Feedback & Ratings
  Star20Regular,
  Star20Filled,
  StarAdd20Regular,
  StarHalf20Filled,
  Heart20Regular,
  Heart20Filled,
  HeartBroken20Regular,
  HeartPulse20Regular,
  ThumbLike20Regular,
  ThumbLike20Filled,
  ThumbDislike20Regular,
  ThumbDislike20Filled,
  Emoji20Regular,
  EmojiAdd20Regular,
  EmojiAngry20Regular,
  EmojiHand20Regular,
  EmojiLaugh20Regular,
  EmojiMeh20Regular,
  EmojiSad20Regular,
  EmojiSurprise20Regular,

  // Visibility & Security
  Eye20Regular,
  Eye20Filled,
  EyeOff20Regular,
  LockClosed20Regular,
  LockClosed20Filled,
  LockOpen20Regular,
  Key20Regular,
  Key20Filled,
  Password20Regular,
  Shield20Regular,
  ShieldDismiss20Regular,
  ShieldError20Regular,
  Incognito20Regular,
  Fingerprint20Regular,

  // Calendar & Time
  Calendar20Regular,
  Calendar20Filled,
  CalendarAdd20Regular,
  CalendarCancel20Regular,
  CalendarCheckmark20Regular,
  CalendarClock20Regular,
  CalendarToday20Regular,
  CalendarWeekStart20Regular,
  CalendarMonth20Regular,
  Clock20Regular,
  Clock20Filled,
  ClockAlarm20Regular,
  Timer20Regular,
  Timer20Filled,
  Timer1020Regular,
  History20Regular,

  // Data & Charts
  DataArea20Regular,
  DataBarHorizontal20Regular,
  DataBarVertical20Regular,
  DataLine20Regular,
  DataPie20Regular,
  DataScatter20Regular,
  DataTrending20Regular,
  DataUsage20Regular,
  ChartPerson20Regular,

  // Development & Code
  Code20Regular,
  Code20Filled,
  CodeBlock20Regular,
  Braces20Regular,
  Bug20Regular,
  BranchFork20Regular,
  BranchRequest20Regular,
  BranchCompare20Regular,
  PlugConnected20Regular,
  PlugDisconnected20Regular,
  Database20Regular,
  DatabaseMultiple20Regular,
  Server20Regular,
  ServerMultiple20Regular,
  Cloud20Regular,
  Cloud20Filled,
  CloudAdd20Regular,
  CloudArrowDown20Regular,
  CloudArrowUp20Regular,
  CloudCheckmark20Regular,
  CloudDismiss20Regular,
  CloudOff20Regular,
  CloudSync20Regular,

  // Devices & Hardware
  Desktop20Regular,
  Desktop20Filled,
  Laptop20Regular,
  Tablet20Regular,
  Phone20Regular,
  PhoneLaptop20Regular,
  Headphones20Regular,
  HeadphonesSoundWave20Regular,
  Keyboard20Regular,
  Bluetooth20Regular,
  Wifi120Regular,
  Wifi220Regular,
  WifiOff20Regular,
  UsbPlug20Regular,

  // Location & Travel
  Globe20Regular,
  Globe20Filled,
  GlobeLocation20Regular,
  Location20Regular,
  Location20Filled,
  LocationOff20Regular,
  Map20Regular,
  MapDrive20Regular,
  CompassNorthwest20Regular,
  VehicleCar20Regular,
  Airplane20Regular,
  AirplaneTakeOff20Regular,

  // Text & Formatting
  TextBold20Regular,
  TextItalic20Regular,
  TextUnderline20Regular,
  TextStrikethrough20Regular,
  TextSubscript20Regular,
  TextSuperscript20Regular,
  TextAlignLeft20Regular,
  TextAlignCenter20Regular,
  TextAlignRight20Regular,
  TextAlignJustify20Regular,
  TextIndentIncrease20Regular,
  TextIndentDecrease20Regular,
  TextBulletList20Regular,
  TextNumberListLtr20Regular,
  TextColor20Regular,
  TextFont20Regular,
  TextFontSize20Regular,
  TextHeader120Regular,
  TextHeader220Regular,
  TextHeader320Regular,
  TextParagraph20Regular,
  TextQuote20Regular,

  // Objects & Misc
  Bot20Regular,
  Bot20Filled,
  BotAdd20Regular,
  Lightbulb20Regular,
  Lightbulb20Filled,
  LightbulbFilament20Regular,
  Gift20Regular,
  Gift20Filled,
  Trophy20Regular,
  Trophy20Filled,
  Ribbon20Regular,
  Certificate20Regular,
  Target20Regular,
  TargetArrow20Regular,
  PuzzlePiece20Regular,
  Rocket20Regular,
  Beaker20Regular,
  Briefcase20Regular,
  Briefcase20Filled,
  Building20Regular,
  Building20Filled,
  BuildingMultiple20Regular,
  BuildingShop20Regular,
  Tag20Regular,
  Tag20Filled,
  TagMultiple20Regular,
  Wallet20Regular,
  Money20Regular,
  MoneyHand20Regular,
  CreditCardPerson20Regular,
  Receipt20Regular,
  Cart20Regular,
  ShoppingBag20Regular,
  Box20Regular,
  BoxMultiple20Regular,

  // Weather
  WeatherMoon20Regular,
  WeatherMoon20Filled,
  WeatherSunny20Regular,
  WeatherSunny20Filled,
  WeatherCloudy20Regular,
  WeatherRain20Regular,
  WeatherSnow20Regular,
  WeatherThunderstorm20Regular,

  // Accessibility
  Accessibility20Regular,
  AccessibilityCheckmark20Regular,
  EyeTracking20Regular,
  TextDescription20Regular,

  // Alert & Notification
  Alert20Regular,
  Alert20Filled,
  AlertOff20Regular,
  AlertUrgent20Regular,

  // Apps & Integration
  Apps20Regular,
  AppsAddIn20Regular,
  AppsList20Regular,
  Grid20Regular,
  GridDots20Regular,
  Board20Regular,

  // Table & Layout
  Table20Regular,
  TableAdd20Regular,
  TableDismiss20Regular,
  TableEdit20Regular,
  TableSimple20Regular,
  LayoutCellFour20Regular,
  LayoutColumnTwo20Regular,
  LayoutRowTwo20Regular,
  SlideLayout20Regular,

  // System
  Power20Regular,
  Sleep20Regular,
  Wrench20Regular,
  WrenchScrewdriver20Regular,
  Window20Regular,
  WindowNew20Regular,
  WindowMultiple20Regular,
  ArrowSync20Filled,
  ArrowSyncOff20Regular,

  // User-requested icons
  Stack20Regular,
  Stack20Filled,
  Layer20Regular,
  Layer20Filled,
  LayerDiagonalSparkle20Regular,
  LayerDiagonalSparkle20Filled,
  DocumentOnePageSparkle20Regular,
  DocumentOnePageSparkle20Filled,
  FlowSparkle20Regular,
  Library20Regular,
  FlowSparkle20Filled,
  BotSparkle20Regular,
  BotSparkle20Filled,
  Flash20Regular,
  Flash20Filled,
  ArrowCollapseAll20Regular,
  Toolbox20Regular,
  Toolbox20Filled,
  Brain20Regular,
  Brain20Filled,
  BrainCircuit20Regular,
  BrainCircuit20Filled,
  BookOpen20Regular,
  BookOpen20Filled,
  Agents20Regular,
  Agents20Filled,
  Flow20Regular,
  Flow20Filled,
  Compose24Regular,
  Compose24Filled,
  Send24Regular,
  Send24Filled,
  Settings24Regular,

  // Activity Map Node Icons
  PlugConnected20Filled,
  PlugDisconnected20Filled,
  Library20Filled,
  Prompt20Filled,
  ReceiptSparkles20Filled,
  Cube20Filled,
  SettingsChat20Filled,
  ChatMultiple20Filled,
  ClipboardTask20Filled,
} from '@fluentui/react-icons';

// Tab definitions
const COMPONENT_TABS = [
  { label: 'Components', value: 'components' },
  { label: 'Tokens', value: 'tokens' },
  { label: 'Type', value: 'type' },
  { label: 'Icons', value: 'icons' },
];

// SVG icon wrappers so Product SVGs can appear in the Fluent grid
const PromptIconSvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M17 2.5C17 2.22386 16.7761 2 16.5 2C16.2239 2 16 2.22386 16 2.5V3H15.5C15.2239 3 15 3.22386 15 3.5C15 3.77614 15.2239 4 15.5 4H16V4.5C16 4.77614 16.2239 5 16.5 5C16.7761 5 17 4.77614 17 4.5V4H17.5C17.7761 4 18 3.77614 18 3.5C18 3.22386 17.7761 3 17.5 3H17V2.5ZM4 15.5C4 15.2239 3.77614 15 3.5 15C3.22386 15 3 15.2239 3 15.5V16H2.5C2.22386 16 2 16.2239 2 16.5C2 16.7761 2.22386 17 2.5 17H3V17.5C3 17.7761 3.22386 18 3.5 18C3.77614 18 4 17.7761 4 17.5V17H4.5C4.77614 17 5 16.7761 5 16.5C5 16.2239 4.77614 16 4.5 16H4V15.5ZM7 13.9427V15C7 16.6569 8.34315 18 10 18H15C16.6569 18 18 16.6569 18 15V10C18 8.34315 16.6569 7 15 7H13.9414C13.9794 7.15757 14 7.32468 14 7.50062C14 7.6761 13.9795 7.84279 13.9417 8H15C16.1046 8 17 8.89543 17 10V15C17 16.1046 16.1046 17 15 17H10C8.89543 17 8 16.1046 8 15V13.9428C7.84266 13.9806 7.67582 14.0012 7.50017 14.0012C7.3244 14.0012 7.15744 13.9806 7 13.9427ZM10.5 13C10.2239 13 10 13.2239 10 13.5C10 13.7761 10.2239 14 10.5 14H13.5C13.7761 14 14 13.7761 14 13.5C14 13.2239 13.7761 13 13.5 13H10.5ZM10 11.5C10 11.2239 10.2239 11 10.5 11H15C15.2761 11 15.5 11.2239 15.5 11.5C15.5 11.7761 15.2761 12 15 12H10.5C10.2239 12 10 11.7761 10 11.5ZM7.24109 3.26172C7.27766 3.08573 7.41513 3.00005 7.50099 3.00006C7.58682 3.00007 7.72413 3.08567 7.76063 3.26146C7.89947 3.92995 8.25126 4.95811 9.1463 5.85377C10.0414 6.74947 11.0696 7.10134 11.7383 7.24015C11.9143 7.27669 12 7.41416 12 7.50007C12 7.58598 11.9143 7.72344 11.7383 7.76001C11.0697 7.89897 10.0417 8.25107 9.14633 9.14688C8.25144 10.0423 7.89975 11.0696 7.76097 11.738C7.72439 11.9142 7.58675 12 7.50076 12C7.4148 12 7.27744 11.9143 7.24089 11.7385C7.10189 11.0699 6.74987 10.0414 5.85463 9.14582C4.95912 8.25 3.93093 7.89829 3.26265 7.75963C3.08697 7.72318 3.00135 7.58615 3.00119 7.50044C3.00104 7.41453 3.08674 7.27668 3.26301 7.24008C3.93184 7.1012 4.95941 6.74928 5.85461 5.85385C6.75019 4.95804 7.10218 3.93025 7.24109 3.26172ZM7.50108 2.00006C6.85057 2 6.37524 2.51332 6.262 3.05828C6.1483 3.60551 5.86244 4.43162 5.14741 5.14683C4.43291 5.86152 3.60718 6.14729 3.0597 6.26097C2.514 6.37428 2.00003 6.85076 2.00119 7.50223C2.00235 8.15181 2.51521 8.62585 3.0595 8.73878C3.60652 8.85228 4.43271 9.13787 5.14739 9.85281C5.86196 10.5676 6.14796 11.3944 6.26183 11.9421C6.37513 12.4871 6.85049 13 7.50076 13C8.15149 13 8.6269 12.4864 8.74009 11.9413C8.85368 11.3941 9.13927 10.5685 9.85363 9.8538C10.5682 9.1388 11.3944 8.85286 11.9418 8.73909C12.4868 8.62582 13 8.15051 13 7.50007C13 6.84953 12.4866 6.37418 11.9415 6.26103C11.394 6.14737 10.5679 5.86162 9.85365 5.14691C9.1392 4.43197 8.85344 3.60555 8.73974 3.05811C8.62656 2.51318 8.15135 2.00012 7.50108 2.00006Z" fill="currentColor"/>
  </svg>
);
const PromptFilledIconSvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M20.5 4.75C20.5 5.16421 20.8358 5.5 21.25 5.5C21.6642 5.5 22 5.16421 22 4.75V3.5H23.25C23.6642 3.5 24 3.16421 24 2.75C24 2.33579 23.6642 2 23.25 2H22V0.75C22 0.335786 21.6642 0 21.25 0C20.8358 0 20.5 0.335786 20.5 0.75V2H19.25C18.8358 2 18.5 2.33579 18.5 2.75C18.5 3.16421 18.8358 3.5 19.25 3.5H20.5V4.75ZM6.60558 1.62042C6.77918 0.78495 7.5075 3.57628e-06 8.50167 9.44734e-05C9.49547 0.000185251 10.2236 0.784735 10.3971 1.62015C10.574 2.47172 11.0186 3.7577 12.1305 4.87038C13.242 5.9827 14.5277 6.42728 15.3793 6.60407C16.215 6.77754 17 7.50588 17 8.50011C17 9.49418 16.2152 10.2225 15.3797 10.3961C14.5283 10.5731 13.2426 11.018 12.1304 12.1307C11.0187 13.2431 10.5744 14.5278 10.3977 15.3789C10.2241 16.2146 9.4957 17 8.50117 17C7.50736 17 6.77901 16.2156 6.60531 15.3801C6.42819 14.5282 5.98323 13.2417 4.87114 12.1292C3.75887 11.0165 2.47322 10.5722 1.6223 10.3956C0.787871 10.2225 0.00362456 9.49616 0.00185096 8.50341C7.22408e-05 7.50777 0.786019 6.77769 1.62262 6.60398C2.47424 6.42714 3.75917 5.98255 4.87117 4.87027C5.98397 3.75718 6.42871 2.47165 6.60558 1.62042ZM9.5 20.25V17.8204C9.1961 17.9351 8.86183 18 8.50117 18C8.32789 18 8.16068 17.985 8 17.9567V20.25C8 22.3211 9.67893 24 11.75 24H20.25C22.3211 24 24 22.3211 24 20.25V11.75C24 9.67893 22.3211 8 20.25 8H17.9569C17.9851 8.16035 18 8.3272 18 8.50011C18 8.86117 17.9349 9.19581 17.82 9.5H20.25C21.4926 9.5 22.5 10.5074 22.5 11.75V20.25C22.5 21.4926 21.4926 22.5 20.25 22.5H11.75C10.5074 22.5 9.5 21.4926 9.5 20.25ZM0 21.25C0 20.8358 0.335786 20.5 0.75 20.5H2V19.25C2 18.8358 2.33579 18.5 2.75 18.5C3.16421 18.5 3.5 18.8358 3.5 19.25V20.5H4.75C5.16421 20.5 5.5 20.8358 5.5 21.25C5.5 21.6642 5.16421 22 4.75 22H3.5V23.25C3.5 23.6642 3.16421 24 2.75 24C2.33579 24 2 23.6642 2 23.25V22H0.75C0.335786 22 0 21.6642 0 21.25ZM12 14.25C12 13.8358 12.3358 13.5 12.75 13.5H19.75C20.1642 13.5 20.5 13.8358 20.5 14.25C20.5 14.6642 20.1642 15 19.75 15H12.75C12.3358 15 12 14.6642 12 14.25ZM12.75 17C12.3358 17 12 17.3358 12 17.75C12 18.1642 12.3358 18.5 12.75 18.5H17.25C17.6642 18.5 18 18.1642 18 17.75C18 17.3358 17.6642 17 17.25 17H12.75Z" fill="currentColor"/>
  </svg>
);

// All available icons for the Icons tab - comprehensive list
const allIcons = [
  // Status & Feedback
  { name: 'CheckmarkCircle', component: CheckmarkCircle20Regular, category: 'Status & Feedback' },
  { name: 'CheckmarkCircleFilled', component: CheckmarkCircle20Filled, category: 'Status & Feedback' },
  { name: 'Circle', component: Circle20Regular, category: 'Status & Feedback' },
  { name: 'CircleFilled', component: Circle20Filled, category: 'Status & Feedback' },
  { name: 'Sparkle', component: Sparkle20Regular, category: 'AI & Workflow' },
  { name: 'SparkleFilled', component: Sparkle20Filled, category: 'AI & Workflow' },
  { name: 'ArrowSync', component: ArrowSync20Regular, category: 'Status & Feedback' },
  { name: 'Warning', component: Warning20Regular, category: 'Status & Feedback' },
  { name: 'WarningFilled', component: Warning20Filled, category: 'Status & Feedback' },
  { name: 'Info', component: Info20Regular, category: 'Status & Feedback' },
  { name: 'InfoFilled', component: Info20Filled, category: 'Status & Feedback' },
  { name: 'ErrorCircle', component: ErrorCircle20Regular, category: 'Status & Feedback' },
  { name: 'ErrorCircleFilled', component: ErrorCircle20Filled, category: 'Status & Feedback' },
  { name: 'Checkmark', component: Checkmark20Regular, category: 'Status & Feedback' },
  { name: 'CheckmarkFilled', component: Checkmark20Filled, category: 'Status & Feedback' },
  { name: 'QuestionCircle', component: QuestionCircle20Regular, category: 'Status & Feedback' },
  { name: 'QuestionCircleFilled', component: QuestionCircle20Filled, category: 'Status & Feedback' },
  { name: 'Prohibited', component: Prohibited20Regular, category: 'Status & Feedback' },
  { name: 'ShieldCheckmark', component: ShieldCheckmark20Regular, category: 'Status & Feedback' },
  { name: 'ShieldCheckmarkFilled', component: ShieldCheckmark20Filled, category: 'Status & Feedback' },

  // Navigation & Arrows
  { name: 'ChevronDown', component: ChevronDown20Regular, category: 'Navigation' },
  { name: 'ChevronRight', component: ChevronRight20Regular, category: 'Navigation' },
  { name: 'ChevronLeft', component: ChevronLeft20Regular, category: 'Navigation' },
  { name: 'ChevronUp', component: ChevronUp20Regular, category: 'Navigation' },
  { name: 'ChevronDoubleDown', component: ChevronDoubleDown20Regular, category: 'Navigation' },
  { name: 'ChevronDoubleUp', component: ChevronDoubleUp20Regular, category: 'Navigation' },
  { name: 'ChevronDoubleLeft', component: ChevronDoubleLeft20Regular, category: 'Navigation' },
  { name: 'ChevronDoubleRight', component: ChevronDoubleRight20Regular, category: 'Navigation' },
  { name: 'ArrowLeft', component: ArrowLeft20Regular, category: 'Navigation' },
  { name: 'ArrowRight', component: ArrowRight20Regular, category: 'Navigation' },
  { name: 'ArrowUp', component: ArrowUp20Regular, category: 'Navigation' },
  { name: 'ArrowDown', component: ArrowDown20Regular, category: 'Navigation' },
  { name: 'ArrowCircleDown', component: ArrowCircleDown20Regular, category: 'Navigation' },
  { name: 'ArrowCircleUp', component: ArrowCircleUp20Regular, category: 'Navigation' },
  { name: 'ArrowCircleLeft', component: ArrowCircleLeft20Regular, category: 'Navigation' },
  { name: 'ArrowCircleRight', component: ArrowCircleRight20Regular, category: 'Navigation' },
  { name: 'ArrowExpand', component: ArrowExpand20Regular, category: 'Navigation' },
  { name: 'ArrowMinimize', component: ArrowMinimize20Regular, category: 'Navigation' },
  { name: 'ArrowMaximize', component: ArrowMaximize20Regular, category: 'Navigation' },
  { name: 'ArrowUndo', component: ArrowUndo20Regular, category: 'Navigation' },
  { name: 'ArrowRedo', component: ArrowRedo20Regular, category: 'Navigation' },
  { name: 'ArrowRepeatAll', component: ArrowRepeatAll20Regular, category: 'Navigation' },
  { name: 'ArrowShuffle', component: ArrowShuffle20Regular, category: 'Navigation' },
  { name: 'ArrowEnter', component: ArrowEnter20Regular, category: 'Navigation' },
  { name: 'ArrowExit', component: ArrowExit20Regular, category: 'Navigation' },
  { name: 'ArrowDownload', component: ArrowDownload20Regular, category: 'Navigation' },
  { name: 'ArrowUpload', component: ArrowUpload20Regular, category: 'Navigation' },
  { name: 'ArrowClockwise', component: ArrowClockwise20Regular, category: 'Navigation' },
  { name: 'ArrowCounterclockwise', component: ArrowCounterclockwise20Regular, category: 'Navigation' },
  { name: 'ArrowSortDown', component: ArrowSortDown20Regular, category: 'Navigation' },
  { name: 'ArrowSortUp', component: ArrowSortUp20Regular, category: 'Navigation' },
  { name: 'Home', component: Home20Regular, category: 'Navigation' },
  { name: 'HomeFilled', component: Home20Filled, category: 'Navigation' },
  { name: 'Navigation', component: Navigation20Regular, category: 'Navigation' },
  { name: 'PanelLeftExpand', component: PanelLeftExpand20Regular, category: 'Navigation' },
  { name: 'PanelLeftContract', component: PanelLeftContract20Regular, category: 'Navigation' },
  { name: 'PersonAccounts', component: PersonAccounts20Regular, category: 'Navigation' },
  { name: 'PersonAccountsFilled', component: PersonAccounts20Filled, category: 'Navigation' },
  { name: 'SignOut', component: SignOut20Regular, category: 'Navigation' },
  { name: 'SignOutFilled', component: SignOut20Filled, category: 'Navigation' },
  { name: 'GlanceHorizontalSparkles', component: GlanceHorizontalSparkles24Regular, category: 'Navigation' },

  // Actions & Editing
  { name: 'Search', component: Search20Regular, category: 'Actions' },
  { name: 'SearchFilled', component: Search20Filled, category: 'Actions' },
  { name: 'Settings', component: Settings20Regular, category: 'Actions' },
  { name: 'SettingsFilled', component: Settings20Filled, category: 'Actions' },
  { name: 'Add', component: Add20Regular, category: 'Actions' },
  { name: 'AddFilled', component: Add20Filled, category: 'Actions' },
  { name: 'AddCircle', component: AddCircle20Regular, category: 'Actions' },
  { name: 'AddCircleFilled', component: AddCircle20Filled, category: 'Actions' },
  { name: 'Dismiss', component: Dismiss20Regular, category: 'Actions' },
  { name: 'DismissCircle', component: DismissCircle20Regular, category: 'Actions' },
  { name: 'DismissCircleFilled', component: DismissCircle20Filled, category: 'Actions' },
  { name: 'Edit', component: Edit20Regular, category: 'Actions' },
  { name: 'EditFilled', component: Edit20Filled, category: 'Actions' },
  { name: 'Copy', component: Copy20Regular, category: 'Actions' },
  { name: 'Delete', component: Delete20Regular, category: 'Actions' },
  { name: 'DeleteFilled', component: Delete20Filled, category: 'Actions' },
  { name: 'Send', component: Send20Regular, category: 'Actions' },
  { name: 'SendFilled', component: Send20Filled, category: 'Actions' },
  { name: 'Save', component: Save20Regular, category: 'Actions' },
  { name: 'SaveFilled', component: Save20Filled, category: 'Actions' },
  { name: 'Print', component: Print20Regular, category: 'Actions' },
  { name: 'Share', component: Share20Regular, category: 'Actions' },
  { name: 'ShareFilled', component: Share20Filled, category: 'Actions' },
  { name: 'Filter', component: Filter20Regular, category: 'Actions' },
  { name: 'FilterFilled', component: Filter20Filled, category: 'Actions' },
  { name: 'MoreHorizontal', component: MoreHorizontal20Regular, category: 'Actions' },
  { name: 'MoreHorizontalFilled', component: MoreHorizontal20Filled, category: 'Actions' },
  { name: 'MoreVertical', component: MoreVertical20Regular, category: 'Actions' },
  { name: 'SelectAllOn', component: SelectAllOn20Regular, category: 'Actions' },
  { name: 'Cut', component: Cut20Regular, category: 'Actions' },
  { name: 'ClipboardPaste', component: ClipboardPaste20Regular, category: 'Actions' },
  { name: 'Rename', component: Rename20Regular, category: 'Actions' },
  { name: 'Pin', component: Pin20Regular, category: 'Actions' },
  { name: 'PinFilled', component: Pin20Filled, category: 'Actions' },
  { name: 'PinOff', component: PinOff20Regular, category: 'Actions' },
  { name: 'Bookmark', component: Bookmark20Regular, category: 'Actions' },
  { name: 'BookmarkFilled', component: Bookmark20Filled, category: 'Actions' },
  { name: 'BookmarkMultiple', component: BookmarkMultiple20Regular, category: 'Actions' },
  { name: 'Flag', component: Flag20Regular, category: 'Actions' },
  { name: 'FlagFilled', component: Flag20Filled, category: 'Actions' },
  { name: 'Options', component: Options20Regular, category: 'Actions' },
  { name: 'Open', component: Open20Regular, category: 'Actions' },
  { name: 'OpenOff', component: OpenOff20Regular, category: 'Actions' },
  { name: 'ZoomIn', component: ZoomIn20Regular, category: 'Actions' },
  { name: 'ZoomOut', component: ZoomOut20Regular, category: 'Actions' },
  { name: 'FullScreenMaximize', component: FullScreenMaximize20Regular, category: 'Actions' },
  { name: 'FullScreenMinimize', component: FullScreenMinimize20Regular, category: 'Actions' },

  // Media & Playback
  { name: 'Play', component: Play20Regular, category: 'Media' },
  { name: 'PlayFilled', component: Play20Filled, category: 'Media' },
  { name: 'PlayCircle', component: PlayCircle20Regular, category: 'Media' },
  { name: 'PlayCircleFilled', component: PlayCircle20Filled, category: 'Media' },
  { name: 'Pause', component: Pause20Regular, category: 'Media' },
  { name: 'PauseFilled', component: Pause20Filled, category: 'Media' },
  { name: 'Stop', component: Stop20Regular, category: 'Media' },
  { name: 'StopFilled', component: Stop20Filled, category: 'Media' },
  { name: 'Record', component: Record20Regular, category: 'Media' },
  { name: 'RecordFilled', component: Record20Filled, category: 'Media' },
  { name: 'FastForward', component: FastForward20Regular, category: 'Media' },
  { name: 'Rewind', component: Rewind20Regular, category: 'Media' },
  { name: 'Previous', component: Previous20Regular, category: 'Media' },
  { name: 'Next', component: Next20Regular, category: 'Media' },
  { name: 'Mic', component: Mic20Regular, category: 'Media' },
  { name: 'MicFilled', component: Mic20Filled, category: 'Media' },
  { name: 'MicOff', component: MicOff20Regular, category: 'Media' },
  { name: 'Speaker', component: Speaker220Regular, category: 'Media' },
  { name: 'SpeakerFilled', component: Speaker220Filled, category: 'Media' },
  { name: 'SpeakerMute', component: SpeakerMute20Regular, category: 'Media' },
  { name: 'Image', component: Image20Regular, category: 'Media' },
  { name: 'ImageFilled', component: Image20Filled, category: 'Media' },
  { name: 'ImageMultiple', component: ImageMultiple20Regular, category: 'Media' },
  { name: 'ImageAdd', component: ImageAdd20Regular, category: 'Media' },
  { name: 'Video', component: Video20Regular, category: 'Media' },
  { name: 'VideoFilled', component: Video20Filled, category: 'Media' },
  { name: 'VideoOff', component: VideoOff20Regular, category: 'Media' },
  { name: 'Camera', component: Camera20Regular, category: 'Media' },
  { name: 'CameraFilled', component: Camera20Filled, category: 'Media' },
  { name: 'CameraAdd', component: CameraAdd20Regular, category: 'Media' },
  { name: 'ShareScreenStart', component: ShareScreenStart20Regular, category: 'Media' },
  { name: 'ShareScreenStop', component: ShareScreenStop20Regular, category: 'Media' },
  { name: 'MusicNote1', component: MusicNote120Regular, category: 'Media' },
  { name: 'MusicNote2', component: MusicNote220Regular, category: 'Media' },

  // Files & Text
  { name: 'Document', component: Document20Regular, category: 'Files & Text' },
  { name: 'DocumentFilled', component: Document20Filled, category: 'Files & Text' },
  { name: 'DocumentAdd', component: DocumentAdd20Regular, category: 'Files & Text' },
  { name: 'DocumentCopy', component: DocumentCopy20Regular, category: 'Files & Text' },
  { name: 'DocumentMultiple', component: DocumentMultiple20Regular, category: 'Files & Text' },
  { name: 'DocumentPdf', component: DocumentPdf20Regular, category: 'Files & Text' },
  { name: 'DocumentText', component: DocumentText20Regular, category: 'Files & Text' },
  { name: 'DocumentBulletList', component: DocumentBulletList20Regular, category: 'Files & Text' },
  { name: 'DocumentCheckmark', component: DocumentCheckmark20Regular, category: 'Files & Text' },
  { name: 'DocumentDismiss', component: DocumentDismiss20Regular, category: 'Files & Text' },
  { name: 'DocumentSearch', component: DocumentSearch20Regular, category: 'Files & Text' },
  { name: 'Folder', component: Folder20Regular, category: 'Files & Text' },
  { name: 'FolderFilled', component: Folder20Filled, category: 'Files & Text' },
  { name: 'FolderAdd', component: FolderAdd20Regular, category: 'Files & Text' },
  { name: 'FolderOpen', component: FolderOpen20Regular, category: 'Files & Text' },
  { name: 'FolderZip', component: FolderZip20Regular, category: 'Files & Text' },
  { name: 'Archive', component: Archive20Regular, category: 'Files & Text' },
  { name: 'Attach', component: Attach20Regular, category: 'Files & Text' },
  { name: 'AttachArrowRight', component: AttachArrowRight20Regular, category: 'Files & Text' },
  { name: 'Link', component: Link20Regular, category: 'Files & Text' },
  { name: 'LinkDismiss', component: LinkDismiss20Regular, category: 'Files & Text' },
  { name: 'LinkSquare', component: LinkSquare20Regular, category: 'Files & Text' },

  // Communication & People
  { name: 'Mail', component: Mail20Regular, category: 'Communication & People' },
  { name: 'MailFilled', component: Mail20Filled, category: 'Communication & People' },
  { name: 'MailRead', component: MailRead20Regular, category: 'Communication & People' },
  { name: 'MailUnread', component: MailUnread20Regular, category: 'Communication & People' },
  { name: 'MailAdd', component: MailAdd20Regular, category: 'Communication & People' },
  { name: 'MailDismiss', component: MailDismiss20Regular, category: 'Communication & People' },
  { name: 'MailInbox', component: MailInbox20Regular, category: 'Communication & People' },
  { name: 'Chat', component: Chat20Regular, category: 'Communication & People' },
  { name: 'ChatFilled', component: Chat20Filled, category: 'Communication & People' },
  { name: 'ChatMultiple', component: ChatMultiple20Regular, category: 'Communication & People' },
  { name: 'ChatBubblesQuestion', component: ChatBubblesQuestion20Regular, category: 'Communication & People' },
  { name: 'Comment', component: Comment20Regular, category: 'Communication & People' },
  { name: 'CommentFilled', component: Comment20Filled, category: 'Communication & People' },
  { name: 'CommentAdd', component: CommentAdd20Regular, category: 'Communication & People' },
  { name: 'CommentMultiple', component: CommentMultiple20Regular, category: 'Communication & People' },
  { name: 'Call', component: Call20Regular, category: 'Communication & People' },
  { name: 'CallFilled', component: Call20Filled, category: 'Communication & People' },
  { name: 'CallEnd', component: CallEnd20Regular, category: 'Communication & People' },
  { name: 'CallMissed', component: CallMissed20Regular, category: 'Communication & People' },
  { name: 'CallForward', component: CallForward20Regular, category: 'Communication & People' },
  { name: 'ContactCard', component: ContactCard20Regular, category: 'Communication & People' },
  { name: 'ContactCardFilled', component: ContactCard20Filled, category: 'Communication & People' },
  { name: 'Mention', component: Mention20Regular, category: 'Communication & People' },

  { name: 'People', component: People20Regular, category: 'Communication & People' },
  { name: 'PeopleFilled', component: People20Filled, category: 'Communication & People' },
  { name: 'PeopleAdd', component: PeopleAdd20Regular, category: 'Communication & People' },
  { name: 'PeopleCommunity', component: PeopleCommunity20Regular, category: 'Communication & People' },
  { name: 'PeopleTeam', component: PeopleTeam20Regular, category: 'Communication & People' },
  { name: 'Person', component: Person20Regular, category: 'Communication & People' },
  { name: 'PersonFilled', component: Person20Filled, category: 'Communication & People' },
  { name: 'PersonAdd', component: PersonAdd20Regular, category: 'Communication & People' },
  { name: 'PersonDelete', component: PersonDelete20Regular, category: 'Communication & People' },
  { name: 'PersonCircle', component: PersonCircle20Regular, category: 'Communication & People' },
  { name: 'Guest', component: Guest20Regular, category: 'Communication & People' },

  { name: 'Star', component: Star20Regular, category: 'Status & Feedback' },
  { name: 'StarFilled', component: Star20Filled, category: 'Status & Feedback' },
  { name: 'StarAdd', component: StarAdd20Regular, category: 'Status & Feedback' },
  { name: 'StarHalfFilled', component: StarHalf20Filled, category: 'Status & Feedback' },
  { name: 'Heart', component: Heart20Regular, category: 'Status & Feedback' },
  { name: 'HeartFilled', component: Heart20Filled, category: 'Status & Feedback' },
  { name: 'HeartBroken', component: HeartBroken20Regular, category: 'Status & Feedback' },
  { name: 'HeartPulse', component: HeartPulse20Regular, category: 'Status & Feedback' },
  { name: 'ThumbLike', component: ThumbLike20Regular, category: 'Status & Feedback' },
  { name: 'ThumbLikeFilled', component: ThumbLike20Filled, category: 'Status & Feedback' },
  { name: 'ThumbDislike', component: ThumbDislike20Regular, category: 'Status & Feedback' },
  { name: 'ThumbDislikeFilled', component: ThumbDislike20Filled, category: 'Status & Feedback' },
  { name: 'Emoji', component: Emoji20Regular, category: 'Status & Feedback' },
  { name: 'EmojiAdd', component: EmojiAdd20Regular, category: 'Status & Feedback' },
  { name: 'EmojiAngry', component: EmojiAngry20Regular, category: 'Status & Feedback' },
  { name: 'EmojiHand', component: EmojiHand20Regular, category: 'Status & Feedback' },
  { name: 'EmojiLaugh', component: EmojiLaugh20Regular, category: 'Status & Feedback' },
  { name: 'EmojiMeh', component: EmojiMeh20Regular, category: 'Status & Feedback' },
  { name: 'EmojiSad', component: EmojiSad20Regular, category: 'Status & Feedback' },
  { name: 'EmojiSurprise', component: EmojiSurprise20Regular, category: 'Status & Feedback' },

  // Security & Privacy
  { name: 'Eye', component: Eye20Regular, category: 'Security' },
  { name: 'EyeFilled', component: Eye20Filled, category: 'Security' },
  { name: 'EyeOff', component: EyeOff20Regular, category: 'Security' },
  { name: 'LockClosed', component: LockClosed20Regular, category: 'Security' },
  { name: 'LockClosedFilled', component: LockClosed20Filled, category: 'Security' },
  { name: 'LockOpen', component: LockOpen20Regular, category: 'Security' },
  { name: 'Key', component: Key20Regular, category: 'Security' },
  { name: 'KeyFilled', component: Key20Filled, category: 'Security' },
  { name: 'Password', component: Password20Regular, category: 'Security' },
  { name: 'Shield', component: Shield20Regular, category: 'Security' },
  { name: 'ShieldDismiss', component: ShieldDismiss20Regular, category: 'Security' },
  { name: 'ShieldError', component: ShieldError20Regular, category: 'Security' },
  { name: 'Incognito', component: Incognito20Regular, category: 'Security' },
  { name: 'Fingerprint', component: Fingerprint20Regular, category: 'Security' },

  // Calendar & Time
  { name: 'Calendar', component: Calendar20Regular, category: 'Calendar & Time' },
  { name: 'CalendarFilled', component: Calendar20Filled, category: 'Calendar & Time' },
  { name: 'CalendarAdd', component: CalendarAdd20Regular, category: 'Calendar & Time' },
  { name: 'CalendarCancel', component: CalendarCancel20Regular, category: 'Calendar & Time' },
  { name: 'CalendarCheckmark', component: CalendarCheckmark20Regular, category: 'Calendar & Time' },
  { name: 'CalendarClock', component: CalendarClock20Regular, category: 'Calendar & Time' },
  { name: 'CalendarToday', component: CalendarToday20Regular, category: 'Calendar & Time' },
  { name: 'CalendarWeekStart', component: CalendarWeekStart20Regular, category: 'Calendar & Time' },
  { name: 'CalendarMonth', component: CalendarMonth20Regular, category: 'Calendar & Time' },
  { name: 'Clock', component: Clock20Regular, category: 'Calendar & Time' },
  { name: 'ClockFilled', component: Clock20Filled, category: 'Calendar & Time' },
  { name: 'ClockAlarm', component: ClockAlarm20Regular, category: 'Calendar & Time' },
  { name: 'Timer', component: Timer20Regular, category: 'Calendar & Time' },
  { name: 'TimerFilled', component: Timer20Filled, category: 'Calendar & Time' },
  { name: 'Timer10', component: Timer1020Regular, category: 'Calendar & Time' },
  { name: 'History', component: History20Regular, category: 'Calendar & Time' },

  // Data & Charts
  { name: 'DataArea', component: DataArea20Regular, category: 'Data & Charts' },
  { name: 'DataBarHorizontal', component: DataBarHorizontal20Regular, category: 'Data & Charts' },
  { name: 'DataBarVertical', component: DataBarVertical20Regular, category: 'Data & Charts' },
  { name: 'DataLine', component: DataLine20Regular, category: 'Data & Charts' },
  { name: 'DataPie', component: DataPie20Regular, category: 'Data & Charts' },
  { name: 'DataScatter', component: DataScatter20Regular, category: 'Data & Charts' },
  { name: 'DataTrending', component: DataTrending20Regular, category: 'Data & Charts' },
  { name: 'DataUsage', component: DataUsage20Regular, category: 'Data & Charts' },
  { name: 'ChartPerson', component: ChartPerson20Regular, category: 'Data & Charts' },

  // Development & System
  { name: 'Code', component: Code20Regular, category: 'Development & System' },
  { name: 'CodeFilled', component: Code20Filled, category: 'Development & System' },
  { name: 'CodeBlock', component: CodeBlock20Regular, category: 'Development & System' },
  { name: 'Braces', component: Braces20Regular, category: 'Development & System' },
  { name: 'Bug', component: Bug20Regular, category: 'Development & System' },
  { name: 'BranchFork', component: BranchFork20Regular, category: 'Development & System' },
  { name: 'BranchRequest', component: BranchRequest20Regular, category: 'Development & System' },
  { name: 'BranchCompare', component: BranchCompare20Regular, category: 'Development & System' },
  { name: 'PlugConnected', component: PlugConnected20Regular, category: 'Development & System' },
  { name: 'PlugDisconnected', component: PlugDisconnected20Regular, category: 'Development & System' },
  { name: 'Database', component: Database20Regular, category: 'Development & System' },
  { name: 'DatabaseMultiple', component: DatabaseMultiple20Regular, category: 'Development & System' },
  { name: 'Server', component: Server20Regular, category: 'Development & System' },
  { name: 'ServerMultiple', component: ServerMultiple20Regular, category: 'Development & System' },
  { name: 'Cloud', component: Cloud20Regular, category: 'Development & System' },
  { name: 'CloudFilled', component: Cloud20Filled, category: 'Development & System' },
  { name: 'CloudAdd', component: CloudAdd20Regular, category: 'Development & System' },
  { name: 'CloudArrowDown', component: CloudArrowDown20Regular, category: 'Development & System' },
  { name: 'CloudArrowUp', component: CloudArrowUp20Regular, category: 'Development & System' },
  { name: 'CloudCheckmark', component: CloudCheckmark20Regular, category: 'Development & System' },
  { name: 'CloudDismiss', component: CloudDismiss20Regular, category: 'Development & System' },
  { name: 'CloudOff', component: CloudOff20Regular, category: 'Development & System' },
  { name: 'CloudSync', component: CloudSync20Regular, category: 'Development & System' },

  // Devices & Layout
  { name: 'Desktop', component: Desktop20Regular, category: 'Devices & Layout' },
  { name: 'DesktopFilled', component: Desktop20Filled, category: 'Devices & Layout' },
  { name: 'Laptop', component: Laptop20Regular, category: 'Devices & Layout' },
  { name: 'Tablet', component: Tablet20Regular, category: 'Devices & Layout' },
  { name: 'Phone', component: Phone20Regular, category: 'Devices & Layout' },
  { name: 'PhoneLaptop', component: PhoneLaptop20Regular, category: 'Devices & Layout' },
  { name: 'Headphones', component: Headphones20Regular, category: 'Devices & Layout' },
  { name: 'HeadphonesSoundWave', component: HeadphonesSoundWave20Regular, category: 'Devices & Layout' },
  { name: 'Keyboard', component: Keyboard20Regular, category: 'Devices & Layout' },
  { name: 'Bluetooth', component: Bluetooth20Regular, category: 'Devices & Layout' },
  { name: 'Wifi1', component: Wifi120Regular, category: 'Devices & Layout' },
  { name: 'Wifi2', component: Wifi220Regular, category: 'Devices & Layout' },
  { name: 'WifiOff', component: WifiOff20Regular, category: 'Devices & Layout' },
  { name: 'UsbPlug', component: UsbPlug20Regular, category: 'Devices & Layout' },

  // Location & Weather
  { name: 'Globe', component: Globe20Regular, category: 'Location & Weather' },
  { name: 'GlobeFilled', component: Globe20Filled, category: 'Location & Weather' },
  { name: 'GlobeLocation', component: GlobeLocation20Regular, category: 'Location & Weather' },
  { name: 'Location', component: Location20Regular, category: 'Location & Weather' },
  { name: 'LocationFilled', component: Location20Filled, category: 'Location & Weather' },
  { name: 'LocationOff', component: LocationOff20Regular, category: 'Location & Weather' },
  { name: 'Map', component: Map20Regular, category: 'Location & Weather' },
  { name: 'MapDrive', component: MapDrive20Regular, category: 'Location & Weather' },
  { name: 'CompassNorthwest', component: CompassNorthwest20Regular, category: 'Location & Weather' },
  { name: 'VehicleCar', component: VehicleCar20Regular, category: 'Location & Weather' },
  { name: 'Airplane', component: Airplane20Regular, category: 'Location & Weather' },
  { name: 'AirplaneTakeOff', component: AirplaneTakeOff20Regular, category: 'Location & Weather' },

  { name: 'TextBold', component: TextBold20Regular, category: 'Files & Text' },
  { name: 'TextItalic', component: TextItalic20Regular, category: 'Files & Text' },
  { name: 'TextUnderline', component: TextUnderline20Regular, category: 'Files & Text' },
  { name: 'TextStrikethrough', component: TextStrikethrough20Regular, category: 'Files & Text' },
  { name: 'TextSubscript', component: TextSubscript20Regular, category: 'Files & Text' },
  { name: 'TextSuperscript', component: TextSuperscript20Regular, category: 'Files & Text' },
  { name: 'TextAlignLeft', component: TextAlignLeft20Regular, category: 'Files & Text' },
  { name: 'TextAlignCenter', component: TextAlignCenter20Regular, category: 'Files & Text' },
  { name: 'TextAlignRight', component: TextAlignRight20Regular, category: 'Files & Text' },
  { name: 'TextAlignJustify', component: TextAlignJustify20Regular, category: 'Files & Text' },
  { name: 'TextIndentIncrease', component: TextIndentIncrease20Regular, category: 'Files & Text' },
  { name: 'TextIndentDecrease', component: TextIndentDecrease20Regular, category: 'Files & Text' },
  { name: 'TextBulletList', component: TextBulletList20Regular, category: 'Files & Text' },
  { name: 'TextNumberListLtr', component: TextNumberListLtr20Regular, category: 'Files & Text' },
  { name: 'TextColor', component: TextColor20Regular, category: 'Files & Text' },
  { name: 'TextFont', component: TextFont20Regular, category: 'Files & Text' },
  { name: 'TextFontSize', component: TextFontSize20Regular, category: 'Files & Text' },
  { name: 'TextHeader1', component: TextHeader120Regular, category: 'Files & Text' },
  { name: 'TextHeader2', component: TextHeader220Regular, category: 'Files & Text' },
  { name: 'TextHeader3', component: TextHeader320Regular, category: 'Files & Text' },
  { name: 'TextParagraph', component: TextParagraph20Regular, category: 'Files & Text' },
  { name: 'TextQuote', component: TextQuote20Regular, category: 'Files & Text' },

  { name: 'Bot', component: Bot20Regular, category: 'AI & Workflow' },
  { name: 'BotFilled', component: Bot20Filled, category: 'AI & Workflow' },
  { name: 'BotAdd', component: BotAdd20Regular, category: 'AI & Workflow' },
  { name: 'AI Teammate', component: DigitalWorker20Regular, category: 'AI & Workflow' },
  { name: 'AI Teammate Filled', component: DigitalWorker20Filled, category: 'AI & Workflow' },

  // Objects & Commerce
  { name: 'Lightbulb', component: Lightbulb20Regular, category: 'Objects & Commerce' },
  { name: 'LightbulbFilled', component: Lightbulb20Filled, category: 'Objects & Commerce' },
  { name: 'LightbulbFilament', component: LightbulbFilament20Regular, category: 'Objects & Commerce' },
  { name: 'Gift', component: Gift20Regular, category: 'Objects & Commerce' },
  { name: 'GiftFilled', component: Gift20Filled, category: 'Objects & Commerce' },
  { name: 'Trophy', component: Trophy20Regular, category: 'Objects & Commerce' },
  { name: 'TrophyFilled', component: Trophy20Filled, category: 'Objects & Commerce' },
  { name: 'Ribbon', component: Ribbon20Regular, category: 'Objects & Commerce' },
  { name: 'Certificate', component: Certificate20Regular, category: 'Objects & Commerce' },
  { name: 'Target', component: Target20Regular, category: 'Objects & Commerce' },
  { name: 'TargetArrow', component: TargetArrow20Regular, category: 'Objects & Commerce' },
  { name: 'PuzzlePiece', component: PuzzlePiece20Regular, category: 'Objects & Commerce' },
  { name: 'Rocket', component: Rocket20Regular, category: 'Objects & Commerce' },
  { name: 'Beaker', component: Beaker20Regular, category: 'Objects & Commerce' },
  { name: 'Briefcase', component: Briefcase20Regular, category: 'Objects & Commerce' },
  { name: 'BriefcaseFilled', component: Briefcase20Filled, category: 'Objects & Commerce' },
  { name: 'Building', component: Building20Regular, category: 'Objects & Commerce' },
  { name: 'BuildingFilled', component: Building20Filled, category: 'Objects & Commerce' },
  { name: 'BuildingMultiple', component: BuildingMultiple20Regular, category: 'Objects & Commerce' },
  { name: 'BuildingShop', component: BuildingShop20Regular, category: 'Objects & Commerce' },
  { name: 'Tag', component: Tag20Regular, category: 'Objects & Commerce' },
  { name: 'TagFilled', component: Tag20Filled, category: 'Objects & Commerce' },
  { name: 'TagMultiple', component: TagMultiple20Regular, category: 'Objects & Commerce' },

  { name: 'Wallet', component: Wallet20Regular, category: 'Objects & Commerce' },
  { name: 'Money', component: Money20Regular, category: 'Objects & Commerce' },
  { name: 'MoneyHand', component: MoneyHand20Regular, category: 'Objects & Commerce' },
  { name: 'CreditCardPerson', component: CreditCardPerson20Regular, category: 'Objects & Commerce' },
  { name: 'Receipt', component: Receipt20Regular, category: 'Objects & Commerce' },
  { name: 'Cart', component: Cart20Regular, category: 'Objects & Commerce' },
  { name: 'ShoppingBag', component: ShoppingBag20Regular, category: 'Objects & Commerce' },
  { name: 'Box', component: Box20Regular, category: 'Objects & Commerce' },
  { name: 'BoxMultiple', component: BoxMultiple20Regular, category: 'Objects & Commerce' },

  // Location & Weather
  { name: 'WeatherMoon', component: WeatherMoon20Regular, category: 'Location & Weather' },
  { name: 'WeatherMoonFilled', component: WeatherMoon20Filled, category: 'Location & Weather' },
  { name: 'WeatherSunny', component: WeatherSunny20Regular, category: 'Location & Weather' },
  { name: 'WeatherSunnyFilled', component: WeatherSunny20Filled, category: 'Location & Weather' },
  { name: 'WeatherCloudy', component: WeatherCloudy20Regular, category: 'Location & Weather' },
  { name: 'WeatherRain', component: WeatherRain20Regular, category: 'Location & Weather' },
  { name: 'WeatherSnow', component: WeatherSnow20Regular, category: 'Location & Weather' },
  { name: 'WeatherThunderstorm', component: WeatherThunderstorm20Regular, category: 'Location & Weather' },

  { name: 'Accessibility', component: Accessibility20Regular, category: 'Status & Feedback' },
  { name: 'AccessibilityCheckmark', component: AccessibilityCheckmark20Regular, category: 'Status & Feedback' },
  { name: 'EyeTracking', component: EyeTracking20Regular, category: 'Status & Feedback' },
  { name: 'TextDescription', component: TextDescription20Regular, category: 'Status & Feedback' },

  { name: 'Alert', component: Alert20Regular, category: 'Status & Feedback' },
  { name: 'AlertFilled', component: Alert20Filled, category: 'Status & Feedback' },
  { name: 'AlertOff', component: AlertOff20Regular, category: 'Status & Feedback' },
  { name: 'AlertUrgent', component: AlertUrgent20Regular, category: 'Status & Feedback' },

  { name: 'Apps', component: Apps20Regular, category: 'Devices & Layout' },
  { name: 'AppsAddIn', component: AppsAddIn20Regular, category: 'Devices & Layout' },
  { name: 'AppsList', component: AppsList20Regular, category: 'Devices & Layout' },
  { name: 'Grid', component: Grid20Regular, category: 'Devices & Layout' },
  { name: 'GridDots', component: GridDots20Regular, category: 'Devices & Layout' },
  { name: 'Board', component: Board20Regular, category: 'Devices & Layout' },
  { name: 'Table', component: Table20Regular, category: 'Devices & Layout' },
  { name: 'TableAdd', component: TableAdd20Regular, category: 'Devices & Layout' },
  { name: 'TableDismiss', component: TableDismiss20Regular, category: 'Devices & Layout' },
  { name: 'TableEdit', component: TableEdit20Regular, category: 'Devices & Layout' },
  { name: 'TableSimple', component: TableSimple20Regular, category: 'Devices & Layout' },
  { name: 'LayoutCellFour', component: LayoutCellFour20Regular, category: 'Devices & Layout' },
  { name: 'LayoutColumnTwo', component: LayoutColumnTwo20Regular, category: 'Devices & Layout' },
  { name: 'LayoutRowTwo', component: LayoutRowTwo20Regular, category: 'Devices & Layout' },
  { name: 'SlideLayout', component: SlideLayout20Regular, category: 'Devices & Layout' },

  { name: 'Power', component: Power20Regular, category: 'Development & System' },
  { name: 'Sleep', component: Sleep20Regular, category: 'Development & System' },
  { name: 'Wrench', component: Wrench20Regular, category: 'Development & System' },
  { name: 'WrenchScrewdriver', component: WrenchScrewdriver20Regular, category: 'Development & System' },
  { name: 'Window', component: Window20Regular, category: 'Development & System' },
  { name: 'WindowNew', component: WindowNew20Regular, category: 'Development & System' },
  { name: 'WindowMultiple', component: WindowMultiple20Regular, category: 'Development & System' },
  { name: 'ArrowSyncFilled', component: ArrowSync20Filled, category: 'Development & System' },
  { name: 'ArrowSyncOff', component: ArrowSyncOff20Regular, category: 'Development & System' },

  // AI & Workflow (User-requested)
  { name: 'Stack', component: Stack20Regular, category: 'AI & Workflow' },
  { name: 'StackFilled', component: Stack20Filled, category: 'AI & Workflow' },
  { name: 'Layer', component: Layer20Regular, category: 'AI & Workflow' },
  { name: 'LayerFilled', component: Layer20Filled, category: 'AI & Workflow' },
  { name: 'LayerDiagonalSparkle', component: LayerDiagonalSparkle20Regular, category: 'AI & Workflow' },
  { name: 'LayerDiagonalSparkleFilled', component: LayerDiagonalSparkle20Filled, category: 'AI & Workflow' },
  { name: 'DocumentOnePageSparkle', component: DocumentOnePageSparkle20Regular, category: 'AI & Workflow' },
  { name: 'DocumentOnePageSparkleFilled', component: DocumentOnePageSparkle20Filled, category: 'AI & Workflow' },
  { name: 'FlowSparkle', component: FlowSparkle20Regular, category: 'AI & Workflow' },
  { name: 'FlowSparkleFilled', component: FlowSparkle20Filled, category: 'AI & Workflow' },
  { name: 'BotSparkle', component: BotSparkle20Regular, category: 'AI & Workflow' },
  { name: 'BotSparkleFilled', component: BotSparkle20Filled, category: 'AI & Workflow' },
  { name: 'Flash', component: Flash20Regular, category: 'AI & Workflow' },
  { name: 'FlashFilled', component: Flash20Filled, category: 'AI & Workflow' },
  { name: 'ArrowCollapseAll', component: ArrowCollapseAll20Regular, category: 'AI & Workflow' },
  { name: 'Toolbox', component: Toolbox20Regular, category: 'AI & Workflow' },
  { name: 'ToolboxFilled', component: Toolbox20Filled, category: 'AI & Workflow' },
  { name: 'Brain', component: Brain20Regular, category: 'AI & Workflow' },
  { name: 'BrainFilled', component: Brain20Filled, category: 'AI & Workflow' },
  { name: 'BrainCircuit', component: BrainCircuit20Regular, category: 'AI & Workflow' },
  { name: 'BrainCircuitFilled', component: BrainCircuit20Filled, category: 'AI & Workflow' },
  { name: 'BookOpen', component: BookOpen20Regular, category: 'AI & Workflow' },
  { name: 'BookOpenFilled', component: BookOpen20Filled, category: 'AI & Workflow' },
  { name: 'Agents', component: Agents20Regular, category: 'AI & Workflow' },
  { name: 'AgentsFilled', component: Agents20Filled, category: 'AI & Workflow' },
  { name: 'Flow', component: Flow20Regular, category: 'AI & Workflow' },
  { name: 'FlowFilled', component: Flow20Filled, category: 'AI & Workflow' },
  { name: 'Prompt', component: PromptIconSvg, category: 'AI & Workflow' },
  { name: 'PromptFilled', component: PromptFilledIconSvg, category: 'AI & Workflow' },
];

// Product & custom SVG icons from /public
// Excludes items already covered by connectorIcons (Outlook, Excel, Word, SharePoint, Dataverse)
const productIcons = [
  { name: 'Copilot Studio', src: '/copilot-studio-logo.svg', category: 'Product Icons' },
  { name: 'Copilot', src: '/copilot-icon.svg', category: 'Product Icons' },
  { name: 'OpenAI', src: '/openai-logo.svg', category: 'Product Icons' },
];

// Official MCP (Model Context Protocol) logomark — three-path chain-link design
const McpIcon = ({ className, style }: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="15 20 160 175" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
    <path d="M25 97.8528L92.8823 29.9706C102.255 20.598 117.451 20.598 126.823 29.9706C136.196 39.3431 136.196 54.5391 126.823 63.9117L75.5581 115.177" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
    <path d="M76.2653 114.47L126.823 63.9117C136.196 54.5391 151.392 54.5391 160.765 63.9117L161.118 64.2652C170.491 73.6378 170.491 88.8338 161.118 98.2063L99.7248 159.6C96.6006 162.724 96.6006 167.789 99.7248 170.913L112.331 183.52" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
    <path d="M109.853 46.9411L59.6482 97.1457C50.2757 106.518 50.2757 121.714 59.6482 131.087C69.0208 140.459 84.2168 140.459 93.5894 131.087L143.794 80.8822" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
  </svg>
);

export const ComponentShowcaseWeb: React.FC = () => {
  const [activeTab, setActiveTab] = useState('components');

  const pageRef = useRef<HTMLDivElement>(null);

  const [selectedOption, setSelectedOption] = useState<string | undefined>(undefined);
  const [chatInput, setChatInput] = useState('');
  const [iconSearch, setIconSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory] = useState('all');

  const [dialogSmOpen, setDialogSmOpen] = useState(false);
  const [dialogMdOpen, setDialogMdOpen] = useState(false);
  const [dialogLgOpen, setDialogLgOpen] = useState(false);
  const [dialogXlOpen, setDialogXlOpen] = useState(false);
  const [dialog2xlOpen, setDialog2xlOpen] = useState(false);
  const [dialog4xlOpen, setDialog4xlOpen] = useState(false);
  const [dialog5xlOpen, setDialog5xlOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const [publishAgentDialogOpen, setPublishAgentDialogOpen] = useState(false);
  const [publishAgentDialogVersion, setPublishAgentDialogVersion] = useState('1');
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconPickerKey, setIconPickerKey] = useState('tpl:workflow');
  const [iconPickerGradient, setIconPickerGradient] = useState('cerulean');
  const [pillPanelOpen, setPillPanelOpen] = useState(false);
  const [showcasePillInputs, setShowcasePillInputs] = useState<Record<string, 'adaptive-ai' | 'custom' | null>>({});
  const [cotExternalExpand, setCotExternalExpand] = useState<boolean | undefined>(undefined);
  const shareButtonRef = React.useRef<HTMLDivElement>(null);

  /* ── Component sections metadata ── */
  type SectionCategory = 'Controls' | 'Data Display' | 'Chat & AI' | 'Feedback' | 'Layout' | 'Tokens';


  const componentSections: Array<{ id: string; name: string; category: SectionCategory; description: string }> = [
    // Controls — basic interactive elements
    { id: 'buttons', name: 'CopilotButton', category: 'Controls', description: 'Fluent 2 buttons — Button & Toggle, Split Button, Compound Button. Supports ref forwarding.' },
    { id: 'activity-summary-button', name: 'ActivitySummaryButton', category: 'Controls', description: 'Hover-reveal Copilot icon button for triggering activity summaries — invisible by default, shown via group-hover on the parent' },
    { id: 'editable-icon', name: 'EditableIcon', category: 'Controls', description: 'Hover overlay wrapper for icon editing — reveals an edit button on hover; supports squircle (default), circular (rounded prop), and explicit cornerRadius override' },
    { id: 'badges', name: 'CopilotBadge', category: 'Controls', description: 'Fluent 2 Badge — filled, tint, outline, and ghost appearances with 8 semantic colors' },
    { id: 'filter-pills', name: 'CopilotFilterPill', category: 'Controls', description: 'Interactive filter chips for toolbar filter bars — xs, sm, md, lg sizes with optional icon and count. Supports forwardRef for Tooltip anchoring.' },
    { id: 'component-pill', name: 'ComponentPill', category: 'Controls', description: 'Inline pill for component references in instructions — with icon, label, disabled/selected/error/warning/deleted states, and onMouseDown for context menus' },
    { id: 'workflows-pill', name: 'WorkflowsPill', category: 'Controls', description: 'Inline pill used for referencing Dynamic values and PowerFx expressions in input fields in the workflow designer.' },
    { id: 'form-inputs', name: 'Form Inputs and Search box', category: 'Controls', description: 'Tailwind-native CopilotInput and CopilotTextarea — Fluent 2 spec, animated focus bar, appearances, sizes, and content slots' },
    { id: 'checkbox', name: 'CopilotCheckbox', category: 'Controls', description: 'Fluent v9 Checkbox with optional description — passes through data-testid, aria-*, and other HTML attributes' },
    { id: 'radio', name: 'CopilotRadioGroup', category: 'Controls', description: 'Fluent v9 RadioGroup with per-option labels and descriptions — use for single-select from a list of options' },
    { id: 'toggle', name: 'CopilotToggle', category: 'Controls', description: 'Toggle switch — sm (32x18) and md (36x20) sizes, brand color when on, gray when off, disabled state, optional label' },
    { id: 'dropdowns', name: 'Dropdowns', category: 'Controls', description: 'Dropdown menus with multiple styles' },
    { id: 'menu', name: 'CopilotMenu', category: 'Controls', description: 'Fixed-position context menu anchored to a trigger element — supports icons, toggles, section labels, submenus, and an optional header' },
    // Layout & Navigation
    { id: 'tabs', name: 'CopilotTabs', category: 'Layout', description: 'Tab navigation components' },
    { id: 'underline-tabs', name: 'CopilotUnderlineTabs', category: 'Layout', description: 'Underline-style tab bar using subtle appearance with optional icons and brand-color active indicator' },
    { id: 'pills', name: 'Filter Pills', category: 'Layout', description: 'Pill-style filter buttons' },
    { id: 'instruction-pills', name: 'InstructionPill', category: 'Layout', description: 'Inline canvas pills for connectors, knowledge, agents, and triggers — with warning state' },
    { id: 'pill-config-panel', name: 'PillConfigPanel', category: 'Layout', description: 'Full-screen drill-down modal for configuring a connector action pill — details, inputs, and advanced sections' },
    { id: 'add-component-modal', name: 'AddComponentModal', category: 'Layout', description: 'Full-canvas overlay for searching and adding capabilities (knowledge, actions, triggers, agents) to an agent. Shows top picks on initial view and search results after query entry.' },
    { id: 'sub-header', name: 'SubHeader', category: 'Layout', description: 'Page-level back navigation header — title, optional subtitle, badge, icon (with noIconWrap opt-out), and right-side actions. Padding/width set by caller via className.' },

    { id: 'collapsible', name: 'CollapsibleSection', category: 'Layout', description: 'Expandable content sections' },

    // Data Display — cards, lists, tables
    { id: 'cards', name: 'Cards', category: 'Data Display', description: 'Content cards, metric cards, and card containers' },
    { id: 'lists', name: 'CopilotList', category: 'Data Display', description: 'Configurable list component' },
    { id: 'tables', name: 'CopilotTable', category: 'Data Display', description: 'Data table with sorting and selection' },

    // Feedback & Overlays
    { id: 'dialogs', name: 'Dialog', category: 'Feedback', description: 'Modal dialogs with customizable sizes and content' },
    { id: 'delete-dialog', name: 'DeleteConfirmDialog', category: 'Feedback', description: 'Confirmation dialog for destructive actions' },
    { id: 'publish-agent-dialog', name: 'PublishAgentDialog', category: 'Feedback', description: 'Full-width modal for publishing agents — shows version, available channels, and an optional description field' },
    { id: 'share-dialog', name: 'ShareDialog', category: 'Feedback', description: 'Popover for sharing agents with link and permissions' },
    { id: 'unsaved-changes-dialog', name: 'UnsavedChangesDialog', category: 'Feedback', description: 'Confirmation dialog for unsaved changes — Cancel, Discard, or Save and leave' },
    { id: 'toast', name: 'CopilotToast', category: 'Feedback', description: 'Toast notifications — success, error, warning, info, progress variants with auto-dismiss; progress supports determinate bar or indeterminate spinner' },
    { id: 'notification-popover', name: 'NotificationPopover', category: 'Feedback', description: 'Bell icon dropdown showing notification history with unread badge' },
    { id: 'icon-picker-dialog', name: 'IconPickerDialog', category: 'Feedback', description: 'M365 Copilot-style icon picker with Generate, Browse (Icons + Colored + Colors), and Upload tabs. Defaults to Colored sub-tab, fixed 600px height, container-relative scrolling.' },
    { id: 'tooltip', name: 'CopilotTooltip', category: 'Feedback', description: 'Fluent v9 Tooltip — hover tooltip with built-in positioning engine and 250ms default show delay' },
    { id: 'status', name: 'StatusIcon & LatencyLoader', category: 'Feedback', description: 'Status indicators and loading states' },
    { id: 'loader-canvas', name: 'LoaderCanvas', category: 'Feedback', description: 'Full-canvas loading state with cycling typewriter phrases — shown during fuzzy create flow' },

    // Chat & AI
    { id: 'chat', name: 'Chat Components', category: 'Chat & AI', description: 'Message bubbles and typing indicators' },
    { id: 'skill-preview-card', name: 'SkillPreviewCard', category: 'Chat & AI', description: 'Collapsible skill preview rendered inside a CopilotMessage. Shows a "View/Hide technical details" toggle that reveals the SKILL.md content, tools/knowledge/scripts footer chips, and a download-ZIP button.' },
    { id: 'chat-suggestions', name: 'ChatSuggestions', category: 'Chat & AI', description: 'Left-aligned horizontal list of clickable suggestion pills shown above the chat input — truncates suggestions longer than 60 characters' },
    { id: 'skill-suggest-card', name: 'Skill Suggest Card', category: 'Chat & AI', description: 'Proactive skill packaging prompt — shown when the helper agent detects a skill opportunity and asks the user if they want to package capabilities as a reusable skill.' },
    { id: 'chat-input', name: 'CopilotChatInput', category: 'Chat & AI', description: 'Copilot-style input bar with toolbar' },
    { id: 'disambiguation', name: 'DisambiguationCard', category: 'Chat & AI', description: 'Multi-choice questionnaire for clarification. Step counter appears inline with the question. Options show a hover arrow (ArrowUp20Filled). Supports borderless variant for use inside containers.' },
    { id: 'enhanced-input-suggestion', name: 'EnhancedInputSuggestionList', category: 'Chat & AI', description: 'Vertically-stacked suggestion/selection pills for HelperAgent chat. Three modes: text (suggestions), single (immediate select), multi (multi-select + Confirm).' },
    { id: 'workiq-card', name: 'WorkIQCard', category: 'Chat & AI', description: 'Work IQ context card — shows M365 MCP server connection status, server list with toggles, and enable/manage actions. Rendered inline in the helper agent chat stream.' },
    { id: 'plan-message', name: 'PlanMessage', category: 'Chat & AI', description: 'Plan card with task list, status indicators, and approval actions' },
    { id: 'chain-of-thought', name: 'ChainOfThought', category: 'Chat & AI', description: 'Collapsible reasoning panel showing AI thinking process. ChainOfThoughtItem supports four states via the status prop: in-progress (LatencyLoader), completed (green checkmark), failed (red error circle), pending (empty circle). The active prop overrides status to in-progress for backward compatibility. headerText accepts ReactNode so inline tags/pills can be embedded. ChainOfThought progressState supports loading, finished, and error.' },
    { id: 'da-activity-cot', name: 'DAActivityCoT', category: 'Chat & AI', description: 'Multi-node agent chain-of-thought with progressive step reveal, search cycles, source chips, showTrigger prop to hide the agent header in multi-turn conversations, initialExpanded prop to start nodes collapsed, animated Expand/Collapse toggle on completion, and onNodeAsk for hover-to-ask-Copilot on each node header' },
    { id: 'channel-icons', name: 'ChannelIcons', category: 'Chat & AI', description: 'Channel logo icons for M365 Copilot, Slack, SharePoint, WhatsApp, and website. ChannelIcon dispatcher resolves channel string to the correct icon. All icons accept a size prop (default 20). getChannelInfo() returns display name and preview label for a given channel string. M365Icon uses the refreshed gradient logo (20×20 viewBox).' },
    { id: 'progress-timeline', name: 'ProgressTimeline', category: 'Chat & AI', description: 'Vertical timeline with status indicators' },
    { id: 'version-history', name: 'VersionHistory', category: 'Chat & AI', description: 'Vertical timeline for workflow and agent version history. Each item shows a dot + connector line (always centered), version label, Live/Published/Auto-saved badges, timestamp, user avatar for manual saves, description, and optional Restore action.' },
    { id: 'creation-tasks-panel', name: 'CreationTasksPanel', category: 'Chat & AI', description: 'Step-by-step creation progress panel shown during agent/workflow build flow. Supports four statuses: done, skipped, active, pending.' },
    { id: 'change-summary-card', name: 'ChangeSummaryCard', category: 'Chat & AI', description: 'Structured change log rendered after helper agent config edits. Bullet list with Fluent icons, clickable navigation, and optional next-step CTA.' },

    // Cards
    { id: 'snapshot-card', name: 'SnapshotCard', category: 'Data Display', description: 'Card for displaying an agent snapshot — lifecycle stage badge (day-zero/in-progress/published/bad-agent/custom), description, tags, load action, and delete button for user-created snapshots' },

    // DW (Digital Worker) conversational cards
    { id: 'dw-instructions-card', name: 'DwInstructionsCard', category: 'Chat & AI', description: 'DW conversational card — shows agent instructions with role, responsibilities (check-mark list), goal, and CTA button. Rendered inline in AI Teammate chat when the agent updates its instructions.' },
    { id: 'dw-skill-card', name: 'DwSkillCard', category: 'Chat & AI', description: 'DW conversational card — shows a newly created skill with description, capabilities list, and optional optimization note.' },
    { id: 'dw-task-card', name: 'DwTaskCard', category: 'Chat & AI', description: 'DW conversational card — shows a created task with description, bullet steps, recurrence, and time-saved metadata.' },
    { id: 'dw-task-list-card', name: 'DwTaskListCard', category: 'Chat & AI', description: 'DW conversational card — shows a list of tasks with running/complete/pending/upcoming status indicators and connector icons.' },

    // Tokens
    { id: 'save-indicator', name: 'SaveIndicator', category: 'Feedback', description: 'Progressive save-status indicator for manual/auto-save modes — shows Unsaved changes, Saving…, Saved just now (collapses to checkmark), with last-saved tooltip. Auto-save status rendered in Layout header near publish button.' },
    { id: 'design-tokens', name: 'Design Tokens', category: 'Tokens', description: 'Color palette from the design system' },
  ];

  const filteredSections = componentSections.filter((s) => {
    const matchesCategory = activeCategory === 'all' || s.category === activeCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });
  const visibleSectionIds = new Set(filteredSections.map((s) => s.id));

  // Sample data for components
  const disambiguationOptions = [
    { id: '1', label: 'Option A', description: 'First approach with basic functionality' },
    { id: '2', label: 'Option B', description: 'Enhanced approach with additional features' },
    { id: '3', label: 'Option C', description: 'Advanced approach with full customization' },
    { id: 'other', label: 'Other' },
  ];

  // Filter icons based on search
  const filteredIcons = allIcons.filter(icon =>
    icon.name.toLowerCase().includes(iconSearch.toLowerCase()) ||
    icon.category.toLowerCase().includes(iconSearch.toLowerCase())
  );

  // Filter product icons based on search
  const filteredProductIcons = productIcons.filter(icon =>
    icon.name.toLowerCase().includes(iconSearch.toLowerCase()) ||
    icon.category.toLowerCase().includes(iconSearch.toLowerCase())
  );

  // Group icons by category
  const iconsByCategory = filteredIcons.reduce((acc, icon) => {
    if (!acc[icon.category]) acc[icon.category] = [];
    acc[icon.category].push(icon);
    return acc;
  }, {} as Record<string, typeof allIcons>);

  // Group product icons by category
  const productIconsByCategory = filteredProductIcons.reduce((acc, icon) => {
    if (!acc[icon.category]) acc[icon.category] = [];
    acc[icon.category].push(icon);
    return acc;
  }, {} as Record<string, typeof productIcons>);

  // Type ramp data from the design system
  const typeRamp = [
    { token: 'text-display', size: '68px', lineHeight: '92px', weight: '600', usage: 'Hero headings' },
    { token: 'text-large-title', size: '40px', lineHeight: '52px', weight: '600', usage: 'Page headers' },
    { token: 'text-title-1', size: '28px', lineHeight: '36px', weight: '600', usage: 'Section headers' },
    { token: 'text-title-2', size: '24px', lineHeight: '32px', weight: '600', usage: 'Subsection headers' },
    { token: 'text-title-3', size: '20px', lineHeight: '28px', weight: '600', usage: 'Card headers' },
    { token: 'text-subtitle-1', size: '20px', lineHeight: '28px', weight: '400', usage: 'Large subtitle' },
    { token: 'text-subtitle-2', size: '16px', lineHeight: '22px', weight: '600', usage: 'Small subtitle' },
    { token: 'text-body-1', size: '16.6px', lineHeight: '24px', weight: '400', usage: 'Primary body' },
    { token: 'text-body-1-strong', size: '16.6px', lineHeight: '24px', weight: '600', usage: 'Emphasized body' },
    { token: 'text-body-2', size: '14px', lineHeight: '20px', weight: '400', usage: 'Secondary body' },
    { token: 'text-body-2-strong', size: '14px', lineHeight: '20px', weight: '600', usage: 'Emphasized secondary' },
    { token: 'text-body-3', size: '12px', lineHeight: '16px', weight: '400', usage: 'Tertiary body' },
    { token: 'text-caption-1', size: '12px', lineHeight: '16px', weight: '400', usage: 'Captions' },
    { token: 'text-caption-1-strong', size: '12px', lineHeight: '16px', weight: '600', usage: 'Emphasized captions' },
    { token: 'text-caption-2', size: '10px', lineHeight: '14px', weight: '400', usage: 'Small metadata' },
  ];

  // ── Agent & Workflow icon groups (for icons tab) ──
  const agentIconGroups: Array<{ label: string; items: Array<{ type: string; key: string }> }> = [
    {
      label: 'People & Teams',
      items: [
        { type: 'domain', key: 'digital-worker' },
        { type: 'domain', key: 'hr' },
        { type: 'domain', key: 'recruiting' },
        { type: 'domain', key: 'training' },
        { type: 'template', key: 'team-navigator' },
        { type: 'domain', key: 'customer-success' },
        { type: 'template', key: 'wellness-check' },
        { type: 'template', key: 'inclusivity' },
        { type: 'template', key: 'benefits' },
        { type: 'template', key: 'kudos' },
      ],
    },
    {
      label: 'Business Functions',
      items: [
        { type: 'domain', key: 'sales' },
        { type: 'domain', key: 'marketing' },
        { type: 'domain', key: 'finance' },
        { type: 'domain', key: 'legal' },
        { type: 'domain', key: 'operations' },
        { type: 'domain', key: 'project' },
        { type: 'domain', key: 'approvals' },
        { type: 'domain', key: 'procurement' },
        { type: 'template', key: 'status-tracker' },
        { type: 'template', key: 'decision' },
        { type: 'template', key: 'gong' },
        { type: 'template', key: 'financial-insights' },
        { type: 'template', key: 'salesforce-duplicate' },
        { type: 'template', key: 'supply-chain' },
      ],
    },
    {
      label: 'Technology & Engineering',
      items: [
        { type: 'domain', key: 'it' },
        { type: 'domain', key: 'devops' },
        { type: 'domain', key: 'infrastructure' },
        { type: 'domain', key: 'security' },
        { type: 'domain', key: 'compliance' },
        { type: 'domain', key: 'monitoring' },
        { type: 'domain', key: 'qa' },
        { type: 'template', key: 'window-settings' },
        { type: 'template', key: 'website-qa' },
      ],
    },
    {
      label: 'Customer Experience',
      items: [
        { type: 'domain', key: 'customer-service' },
        { type: 'domain', key: 'ecommerce' },
        { type: 'domain', key: 'communications' },
        { type: 'domain', key: 'email' },
        { type: 'domain', key: 'events' },
        { type: 'template', key: 'citizen-services' },
        { type: 'template', key: 'store-operations' },
        { type: 'template', key: 'self-help' },
        { type: 'template', key: 'case-management' },
        { type: 'template', key: 'voice' },
      ],
    },
    {
      label: 'Industries',
      items: [
        { type: 'domain', key: 'healthcare' },
        { type: 'domain', key: 'insurance' },
        { type: 'domain', key: 'education' },
        { type: 'domain', key: 'real-estate' },
        { type: 'domain', key: 'travel' },
        { type: 'template', key: 'safe-travels' },
        { type: 'domain', key: 'manufacturing' },
        { type: 'template', key: 'manufacturing' },
        { type: 'template', key: 'truck' },
      ],
    },
    {
      label: 'Knowledge & Creative',
      items: [
        { type: 'domain', key: 'data' },
        { type: 'template', key: 'weather' },
        { type: 'domain', key: 'research' },
        { type: 'domain', key: 'content' },
        { type: 'domain', key: 'language' },
        { type: 'domain', key: 'design' },
        { type: 'domain', key: 'product' },
        { type: 'template', key: 'sustainability-insights' },
        { type: 'template', key: 'book' },
      ],
    },
    {
      label: '✨ Phase 1: New Domains',
      items: [
        { type: 'domain', key: 'knowledge' },
        { type: 'domain', key: 'onboarding' },
        { type: 'domain', key: 'feedback' },
        { type: 'domain', key: 'tickets' },
        { type: 'domain', key: 'search' },
        { type: 'domain', key: 'notifications' },
        { type: 'domain', key: 'files' },
        { type: 'domain', key: 'database' },
      ],
    },
    {
      label: 'General',
      items: [
        { type: 'domain', key: 'chatbot' },
        { type: 'domain', key: 'scheduling' },
        { type: 'domain', key: 'documents' },
        { type: 'domain', key: 'automation' },
        { type: 'domain', key: 'generic' },
        { type: 'template', key: 'trophy' },
        { type: 'template', key: 'thumbs-like-dislike' },
        { type: 'template', key: 'filter' },
        { type: 'template', key: 'prioritization' },
        { type: 'template', key: 'comparison' },
        { type: 'template', key: 'question-sources' },
      ],
    },
  ];

  // ── Activity Map Node Icons ──
  const activityNodeIcons: Array<{ type: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; color: string }> = [
    { type: 'Code',               icon: Code20Filled,             color: '#7160E8' },
    { type: 'Custom Connector',   icon: PlugConnected20Filled,    color: '#7160E8' },
    { type: 'Fallback Connector', icon: PlugDisconnected20Filled, color: '#7160E8' },
    { type: 'Deep Reasoning',     icon: BrainCircuit20Filled,     color: '#7160E8' },
    { type: 'Flow',               icon: Flow20Filled,             color: '#7160E8' },
    { type: 'Knowledge',          icon: Library20Filled,          color: '#7160E8' },
    { type: 'Prompt',             icon: Prompt20Filled,           color: '#7160E8' },
    { type: 'Resource',           icon: ReceiptSparkles20Filled,  color: '#7160E8' },
    { type: 'Skill',              icon: Cube20Filled,             color: '#7160E8' },
    { type: 'System Topic',       icon: SettingsChat20Filled,     color: '#7160E8' },
    { type: 'Topic',              icon: ChatMultiple20Filled,     color: '#7160E8' },
    { type: 'Task',               icon: ClipboardTask20Filled,    color: '#7160E8' },
    { type: 'Tool',               icon: Toolbox20Filled,          color: '#7160E8' },
    { type: 'Fallback Trigger',   icon: FlowSparkle20Filled,      color: '#7160E8' },
    { type: 'CUA',                icon: Desktop20Filled,          color: '#7160E8' },
    { type: 'MCP',                icon: McpIcon,                  color: '#7160E8' },
  ];

  const renderAgentIcon = (item: { type: string; key: string }) => {
    if (item.type === 'domain') {
      const meta = domainMeta.find(d => d.domain === item.key);
      if (!meta) return null;
      const iconSet = domainIconMap[item.key] || domainIconMap['generic'];
      const IconComponent = iconSet.regular;
      const domainIndex = domainMeta.findIndex(d => d.domain === item.key);
      const gradient = gradientPalette[domainIndex % gradientPalette.length].css;
      return (
        <div key={`domain-${item.key}`} className="flex flex-col items-center gap-2" title={`${meta.iconName}\nDomain: ${item.key}`}>
          <SquircleIcon size={48} cornerRadius={12} gradient={gradient}>
            <IconComponent style={{ width: 28, height: 28, color: 'white', stroke: 'white', strokeWidth: 0.25 }} />
          </SquircleIcon>
          <span className="text-[10px] text-gray-500 text-center leading-tight w-full">{meta.label}</span>
        </div>
      );
    } else {
      const template = templateIconMap[item.key];
      if (!template) return null;
      const IconComponent = template.icon;
      const templateIndex = Object.keys(templateIconMap).indexOf(item.key);
      const colors = gradientPalette[(domainMeta.length + templateIndex) % gradientPalette.length];
      return (
        <div key={`template-${item.key}`} className="flex flex-col items-center gap-2" title={`${IconComponent.displayName || template.label}\nKey: ${item.key}`}>
          <SquircleIcon size={48} cornerRadius={12} gradient={colors.css}>
            <IconComponent style={{ width: 48, height: 48 }} />
          </SquircleIcon>
          <span className="text-[10px] text-gray-500 text-center leading-tight w-full">{template.label}</span>
        </div>
      );
    }
  };

  return (
    <div ref={pageRef} tabIndex={-1} className="h-full flex flex-col outline-none">

        {/* Header bar: title left, tabs center, search right */}
        <div className="grid grid-cols-3 items-center pt-6 pb-4">
          <div className="justify-self-start">
            <h1 className="text-title-2 text-gray-900">
              Components
            </h1>
          </div>

          <div className="justify-self-center">
            <CopilotTabs
              tabs={COMPONENT_TABS}
              value={activeTab}
              onChange={setActiveTab}
              size="md"
            />
          </div>

          <div className="justify-self-end w-64">
            <CopilotInput
              placeholder={activeTab === 'icons' ? 'Search icons...' : 'Search...'}
              icon={<Search20Regular />}
              value={activeTab === 'icons' ? iconSearch : searchQuery}
              onChange={(e) => activeTab === 'icons' ? setIconSearch(e.target.value) : setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* COMPONENTS TAB */}
        {activeTab === 'components' && (
          <>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto show-scrollbar" style={{ margin: '0 -2rem', padding: '0.5rem 2rem 2rem' }}>
              <div>

            {filteredSections.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Search20Regular className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-body-1-strong text-gray-500">No components found</p>
                <p className="text-body-2 text-gray-400 mt-1">Try adjusting your search or category filter.</p>
              </div>
            )}

            {/* Buttons Section */}
            {visibleSectionIds.has('buttons') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">CopilotButton</h2>
              <p className="text-sm text-gray-500 mb-8">Fluent 2 button components — four types, all appearances and sizes. Supports ref forwarding with a stable DevTools display name.</p>

              {/* ── 1. Button & Toggle Button ─────────────────────────────────── */}
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-1">Button &amp; Toggle Button</h3>
                <p className="text-xs text-gray-500 mb-4">Standard action buttons. Toggle buttons maintain a checked/pressed state.</p>

                <div className="space-y-5">
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Appearances</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <CopilotButton variant="secondary">Secondary</CopilotButton>
                      <CopilotButton variant="primary">Primary</CopilotButton>
                      <CopilotButton variant="outline">Outline</CopilotButton>
                      <CopilotButton variant="transparent">Transparent</CopilotButton>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-2">With icon (hover to see filled variant)</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <CopilotButton variant="secondary" icon={<Compose24Regular />} iconFilled={<Compose24Filled />}>Compose</CopilotButton>
                      <CopilotButton variant="primary" icon={<Send24Regular />} iconFilled={<Send24Filled />}>Send</CopilotButton>
                      <CopilotButton variant="outline" icon={<Add20Regular />} iconFilled={<Add20Filled />}>Add</CopilotButton>
                      <CopilotButton variant="transparent" icon={<Delete20Regular />} iconFilled={<Delete20Filled />}>Delete</CopilotButton>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-2">Sizes — <code className="bg-gray-100 px-1 rounded">xs</code> uses <code className="bg-gray-100 px-1 rounded">!rounded-md</code> to avoid pill shape at small size</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <CopilotButton variant="primary" size="xs">XSmall</CopilotButton>
                      <CopilotButton variant="primary" size="sm">Small</CopilotButton>
                      <CopilotButton variant="primary" size="md">Medium</CopilotButton>
                      <CopilotButton variant="primary" size="lg">Large</CopilotButton>
                      <CopilotButton variant="secondary" size="xs">XSmall</CopilotButton>
                      <CopilotButton variant="secondary" size="sm">Small</CopilotButton>
                      <CopilotButton variant="secondary" size="md">Medium</CopilotButton>
                      <CopilotButton variant="secondary" size="lg">Large</CopilotButton>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-2">Toggle button — click to toggle checked state</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <ToggleButtonExample variant="secondary" label="Secondary" />
                      <ToggleButtonExample variant="primary" label="Primary" />
                      <ToggleButtonExample variant="outline" label="Outline" />
                      <ToggleButtonExample variant="transparent" label="Transparent" />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-2">Tab pill — <code className="bg-gray-100 px-1 rounded">variant="tab-pill"</code> with <code className="bg-gray-100 px-1 rounded">checked</code> for active state. Includes a transparent bottom border baseline to prevent layout shift when toggling. Use for Instructions/Components-style tab switchers.</p>
                    <div className="flex items-center gap-1">
                      <TabPillExample />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-2">Icon only</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <CopilotButton variant="secondary" icon={<Settings24Regular />} />
                      <CopilotButton variant="primary" icon={<Add20Regular />} />
                      <CopilotButton variant="outline" icon={<Compose24Regular />} />
                      <CopilotButton variant="transparent" icon={<Send24Regular />} />
                      <span className="w-px h-5 bg-[#E0E0E0] mx-1" />
                      <CopilotButton variant="secondary" size="sm" icon={<Settings24Regular />} />
                      <CopilotButton variant="secondary" size="md" icon={<Settings24Regular />} />
                      <CopilotButton variant="secondary" size="lg" icon={<Settings24Regular />} />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-2">Disabled</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <CopilotButton variant="primary" disabled>Primary</CopilotButton>
                      <CopilotButton variant="secondary" disabled>Secondary</CopilotButton>
                      <CopilotButton variant="outline" disabled>Outline</CopilotButton>
                    </div>
                  </div>
                </div>
              </div>

              <hr className="my-8 border-[#E0E0E0]" />

              {/* ── 2. Split Button ──────────────────────────────────────────── */}
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-1">Split Button</h3>
                <p className="text-xs text-gray-500 mb-4">Two joined buttons: a primary action and a separate menu trigger separated by a 1px divider.</p>

                <div className="space-y-5">
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Appearances</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <CopilotSplitButton appearance="secondary">Secondary</CopilotSplitButton>
                      <CopilotSplitButton appearance="primary">Primary</CopilotSplitButton>
                      <CopilotSplitButton appearance="outline">Outline</CopilotSplitButton>
                      <CopilotSplitButton appearance="transparent">Transparent</CopilotSplitButton>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-2">With icon</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <CopilotSplitButton appearance="secondary" icon={<Compose24Regular />} iconFilled={<Compose24Filled />}>Compose</CopilotSplitButton>
                      <CopilotSplitButton appearance="primary" icon={<Send24Regular />} iconFilled={<Send24Filled />}>Send</CopilotSplitButton>
                      <CopilotSplitButton appearance="outline" icon={<Add20Regular />} iconFilled={<Add20Filled />}>Add</CopilotSplitButton>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-2">Sizes</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <CopilotSplitButton appearance="secondary" size="sm">Small</CopilotSplitButton>
                      <CopilotSplitButton appearance="secondary" size="md">Medium</CopilotSplitButton>
                      <CopilotSplitButton appearance="secondary" size="lg">Large</CopilotSplitButton>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-2">Menu open state — click the chevron</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <SplitButtonExample appearance="secondary" label="Secondary" />
                      <SplitButtonExample appearance="primary" label="Primary" />
                      <SplitButtonExample appearance="outline" label="Outline" />
                      <SplitButtonExample appearance="transparent" label="Transparent" />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-2">Icon only</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <CopilotSplitButton appearance="secondary" icon={<Settings20Regular />} />
                      <CopilotSplitButton appearance="primary" icon={<Add20Regular />} />
                      <CopilotSplitButton appearance="outline" icon={<Send20Regular />} />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-2">Disabled</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <CopilotSplitButton appearance="secondary" disabled>Secondary</CopilotSplitButton>
                      <CopilotSplitButton appearance="primary" disabled>Primary</CopilotSplitButton>
                    </div>
                  </div>
                </div>
              </div>

              <hr className="my-8 border-[#E0E0E0]" />

              {/* ── 4. Compound Button ───────────────────────────────────────── */}
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-1">Compound Button</h3>
                <p className="text-xs text-gray-500 mb-4">Button with a primary label and a secondary description. Auto-height, large (40px) icon slot.</p>

                <div className="space-y-5">
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Appearances</p>
                    <div className="flex flex-wrap items-start gap-3">
                      <CopilotCompoundButton appearance="secondary" icon={<Compose24Regular />} secondaryContent="Start a new message">Compose</CopilotCompoundButton>
                      <CopilotCompoundButton appearance="primary" icon={<Send24Regular />} secondaryContent="Deliver to recipients">Send</CopilotCompoundButton>
                      <CopilotCompoundButton appearance="outline" icon={<Add20Regular />} secondaryContent="Create something new">New item</CopilotCompoundButton>
                      <CopilotCompoundButton appearance="transparent" icon={<Delete20Regular />} secondaryContent="Remove this item permanently">Delete</CopilotCompoundButton>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-2">Sizes</p>
                    <div className="flex flex-wrap items-start gap-3">
                      <CopilotCompoundButton appearance="secondary" size="sm" icon={<Compose24Regular />} secondaryContent="Small description">Small</CopilotCompoundButton>
                      <CopilotCompoundButton appearance="secondary" size="md" icon={<Compose24Regular />} secondaryContent="Medium description">Medium</CopilotCompoundButton>
                      <CopilotCompoundButton appearance="secondary" size="lg" icon={<Compose24Regular />} secondaryContent="Large description">Large</CopilotCompoundButton>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-2">Toggle (checked state) — click to toggle</p>
                    <div className="flex flex-wrap items-start gap-3">
                      <CompoundToggleExample appearance="secondary" label="Compose" description="Start a new message" />
                      <CompoundToggleExample appearance="primary" label="Send" description="Deliver to recipients" />
                      <CompoundToggleExample appearance="outline" label="Settings" description="Adjust your preferences" />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-2">Icon after</p>
                    <div className="flex flex-wrap items-start gap-3">
                      <CopilotCompoundButton appearance="secondary" icon={<Send24Regular />} iconPosition="after" secondaryContent="Deliver to recipients">Send</CopilotCompoundButton>
                      <CopilotCompoundButton appearance="primary" icon={<Compose24Regular />} iconPosition="after" secondaryContent="Start a new message">Compose</CopilotCompoundButton>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-2">Icon only</p>
                    <div className="flex flex-wrap items-start gap-3">
                      <CopilotCompoundButton appearance="secondary" icon={<Settings24Regular />} />
                      <CopilotCompoundButton appearance="primary" icon={<Add20Regular />} />
                      <CopilotCompoundButton appearance="outline" icon={<Compose24Regular />} />
                      <span className="w-px self-stretch bg-[#E0E0E0] mx-1" />
                      <CopilotCompoundButton appearance="secondary" size="sm" icon={<Settings24Regular />} />
                      <CopilotCompoundButton appearance="secondary" size="md" icon={<Settings24Regular />} />
                      <CopilotCompoundButton appearance="secondary" size="lg" icon={<Settings24Regular />} />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-2">Disabled</p>
                    <div className="flex flex-wrap items-start gap-3">
                      <CopilotCompoundButton appearance="secondary" icon={<Compose24Regular />} secondaryContent="Start a new message" disabled>Compose</CopilotCompoundButton>
                      <CopilotCompoundButton appearance="primary" icon={<Send24Regular />} secondaryContent="Deliver to recipients" disabled>Send</CopilotCompoundButton>
                    </div>
                  </div>
                </div>
              </div>
            </section>}

            {/* ActivitySummaryButton Section */}
            {visibleSectionIds.has('activity-summary-button') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">ActivitySummaryButton</h2>
              <p className="text-sm text-gray-500 mb-6">Hover-reveal Copilot icon button. Invisible by default — the parent must have the <code>group</code> Tailwind class for the <code>group-hover:opacity-100</code> to work. Forwards its ref so <code>CopilotTooltip</code> can anchor correctly. Hover the rows below to reveal.</p>
              <div className="space-y-4">
                <div className="group flex items-center gap-2 p-3 rounded-lg border border-gray-200 w-fit">
                  <span className="text-sm text-gray-700">Default (hover to reveal)</span>
                  <ActivitySummaryButton onClick={() => {}} />
                </div>
                <div className="group flex items-center gap-2 p-3 rounded-lg border border-gray-200 w-fit">
                  <span className="text-sm text-gray-700">Custom title</span>
                  <ActivitySummaryButton title="Summarize 7-day activity" onClick={() => {}} />
                </div>
                <div className="group flex items-center gap-2 p-3 rounded-lg border border-gray-200 w-fit">
                  <span className="text-sm text-gray-700">With CopilotTooltip (hover to see tooltip)</span>
                  <CopilotTooltip content="Repair with Copilot" placement="top">
                    <ActivitySummaryButton title="" onClick={() => {}} />
                  </CopilotTooltip>
                </div>
              </div>
            </section>}

            {/* EditableIcon Section */}
            {visibleSectionIds.has('editable-icon') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">EditableIcon</h2>
              <p className="text-sm text-gray-500 mb-6">Hover overlay wrapper that reveals an edit button over any icon. The default overlay shape is a squircle; pass <code className="bg-gray-100 px-1 rounded text-xs">rounded</code> for a circular overlay used on DW agent avatars.</p>
              <div className="space-y-5">
                <div>
                  <p className="text-xs text-gray-500 mb-3">Default — squircle overlay (regular agents)</p>
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center gap-2">
                      <EditableIcon size={80} onEdit={() => {}}>
                        <AgentIcon agent={{ id: 'editable-demo', name: 'Demo', systemColorIcon: 'agents' }} size={80} withSquircle />
                      </EditableIcon>
                      <span className="text-[10px] text-gray-500">80px</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <EditableIcon size={64} onEdit={() => {}}>
                        <AgentIcon agent={{ id: 'editable-demo2', name: 'Demo', systemColorIcon: 'briefcase' }} size={64} withSquircle />
                      </EditableIcon>
                      <span className="text-[10px] text-gray-500">64px</span>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-3"><code className="bg-gray-100 px-1 rounded">type="workflow"</code> — falls back to <code className="bg-gray-100 px-1 rounded">tpl:workflow</code> icon when no custom iconKey is set</p>
                  <div className="flex items-center gap-6">
                    {([24, 32, 48] as const).map(size => (
                      <div key={size} className="flex flex-col items-center gap-2">
                        <AgentIcon agent={{ id: `workflow-demo-${size}`, name: 'New Workflow', type: 'workflow' }} size={size} />
                        <span className="text-[10px] text-gray-500">{size}px</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-3"><code className="bg-gray-100 px-1 rounded">rounded</code> — circular overlay (DW agent avatars)</p>
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center gap-2">
                      <EditableIcon size={88} rounded onEdit={() => {}}>
                        <AgentIcon agent={{ id: 'editable-dw', name: 'DW Demo', agentType: 'DW', systemColorIcon: 'person' }} size={88} rounded />
                      </EditableIcon>
                      <span className="text-[10px] text-gray-500">88px (DW header)</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <EditableIcon size={64} rounded onEdit={() => {}}>
                        <AgentIcon agent={{ id: 'editable-dw2', name: 'DW Demo', agentType: 'DW', systemColorIcon: 'briefcase' }} size={64} rounded />
                      </EditableIcon>
                      <span className="text-[10px] text-gray-500">64px</span>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-3"><code className="bg-gray-100 px-1 rounded">cornerRadius</code> — explicit px override (e.g. narrow-preview icon at size=20 uses cornerRadius=5)</p>
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center gap-2">
                      <EditableIcon size={88} cornerRadius={28} onEdit={() => {}}>
                        <AgentIcon agent={{ id: 'editable-cr1', name: 'Demo', systemColorIcon: 'agents' }} size={88} withSquircle />
                      </EditableIcon>
                      <span className="text-[10px] text-gray-500">cornerRadius=28</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <EditableIcon size={88} cornerRadius={44} onEdit={() => {}}>
                        <AgentIcon agent={{ id: 'editable-cr2', name: 'Demo', systemColorIcon: 'briefcase' }} size={88} withSquircle />
                      </EditableIcon>
                      <span className="text-[10px] text-gray-500">cornerRadius=44</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <EditableIcon size={20} cornerRadius={5} onEdit={() => {}}>
                        <AgentIcon agent={{ id: 'editable-cr3', name: 'Demo', systemColorIcon: 'agents' }} size={20} withSquircle />
                      </EditableIcon>
                      <span className="text-[10px] text-gray-500">size=20 cornerRadius=5</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>}

            {/* Badge Section */}
            {visibleSectionIds.has('badges') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">CopilotBadge</h2>
              <p className="text-sm text-gray-500 mb-6">Fluent 2 Badge — filled, tint, outline, and ghost appearances with 8 semantic colors</p>

              {/* Appearances × Colors */}
              {(['filled', 'tint', 'outline', 'ghost'] as const).map((appearance) => (
                <div key={appearance} className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3 capitalize">{appearance}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {(['brand', 'subtle', 'success', 'warning', 'danger', 'important', 'informative', 'severe'] as const).map((color) => (
                      <CopilotBadge key={color} appearance={appearance} color={color}>
                        {color.charAt(0).toUpperCase() + color.slice(1)}
                      </CopilotBadge>
                    ))}
                  </div>
                </div>
              ))}

              {/* Sizes */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Sizes</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <CopilotBadge appearance="tint" color="brand" size="small">Small</CopilotBadge>
                  <CopilotBadge appearance="tint" color="brand" size="medium">Medium</CopilotBadge>
                  <CopilotBadge appearance="tint" color="brand" size="large">Large</CopilotBadge>
                </div>
              </div>

              {/* Shapes */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Shapes</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <CopilotBadge appearance="tint" color="brand" shape="circular">Circular</CopilotBadge>
                  <CopilotBadge appearance="tint" color="brand" shape="rounded">Rounded</CopilotBadge>
                  <CopilotBadge appearance="tint" color="brand" shape="square">Square</CopilotBadge>
                </div>
              </div>

              {/* Icon prop — vertically centered */}
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">With icon</h3>
                <p className="text-xs text-gray-500 mb-3">Icons are vertically centered via <code className="bg-gray-100 px-1 rounded">items-center</code> on the outer flex container and rendered in a 16×16 wrapper for consistent alignment across all sizes.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <CopilotBadge appearance="filled" color="brand" icon={<CheckmarkCircle20Regular />}>Done</CopilotBadge>
                  <CopilotBadge appearance="tint" color="success" icon={<CheckmarkCircle20Regular />}>Success</CopilotBadge>
                  <CopilotBadge appearance="tint" color="warning" icon={<Warning20Regular />}>Warning</CopilotBadge>
                  <CopilotBadge appearance="outline" color="informative" icon={<Info20Regular />}>Info</CopilotBadge>
                </div>
                {/* All three sizes with icons to verify vertical centering */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <CopilotBadge appearance="tint" color="brand" size="small" icon={<CheckmarkCircle20Regular />}>Small + icon</CopilotBadge>
                  <CopilotBadge appearance="tint" color="brand" size="medium" icon={<CheckmarkCircle20Regular />}>Medium + icon</CopilotBadge>
                  <CopilotBadge appearance="tint" color="brand" size="large" icon={<CheckmarkCircle20Regular />}>Large + icon</CopilotBadge>
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('filter-pills') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">CopilotFilterPill</h2>
              <p className="text-sm text-gray-500 mb-6">Interactive filter chips for toolbar filter bars — toggleable active/inactive state with optional icon and count</p>

              {/* Sizes */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Sizes</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Extra small (xs) — compact component lists</p>
                    <div className="flex items-center gap-1.5">
                      <FilterPillSizeExample size="xs" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Small (sm)</p>
                    <div className="flex items-center gap-1.5">
                      <FilterPillSizeExample size="sm" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Medium (md) — default, page-level toolbars</p>
                    <div className="flex items-center gap-1.5">
                      <FilterPillSizeExample size="md" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Large (lg)</p>
                    <div className="flex items-center gap-1.5">
                      <FilterPillSizeExample size="lg" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Active vs Inactive */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Active vs Inactive — click to toggle</h3>
                <div className="flex items-center gap-2">
                  <FilterPillToggleExample />
                </div>
              </div>

              {/* With Icon */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">With icon</h3>
                <div className="flex items-center gap-2">
                  <FilterPillIconExample />
                </div>
              </div>

              {/* With Count */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">With count</h3>
                <div className="flex items-center gap-2">
                  <FilterPillCountExample />
                </div>
              </div>

              {/* Status-colored active state via activeClassName */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Status-colored active state (<code className="text-xs bg-gray-100 px-1 rounded">activeClassName</code>)</h3>
                <div className="flex items-center gap-2">
                  <FilterPillStatusExample />
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('workflows-pill') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">WorkflowsPill</h2>
              <p className="text-sm text-gray-500 mb-6">Inline pill used for referencing Dynamic values and PowerFx expressions in input fields in the workflow designer.</p>

              <div className="mb-6">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Without Icon</h3>
                <div className="flex flex-wrap items-baseline gap-3 text-sm">
                  <WorkflowsPill label="customer_name" onDismiss={() => {}} />
                  <WorkflowsPill label="order_total" onDismiss={() => {}} />
                  <WorkflowsPill label="created_at" onDismiss={() => {}} />
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">With Icon</h3>
                <div className="flex flex-wrap items-baseline gap-3 text-sm">
                  <WorkflowsPill label="email" icon={<span style={{ width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#F3E8FF', borderRadius: '9999px', color: '#7C3AED', fontSize: 9 }}>#</span>} onDismiss={() => {}} />
                  <WorkflowsPill label="created_at" icon={<span style={{ width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#EFF6FF', borderRadius: '9999px', color: '#3B82F6', fontSize: 8 }}>📅</span>} onDismiss={() => {}} />
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('component-pill') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">ComponentPill</h2>
              <p className="text-sm text-gray-500 mb-6">Inline pill for rendering component references in instructions — sits inline with text, features an icon, label, disabled state for toggled-off components, and onMouseDown for opening context menus without blur races.</p>

              {/* Default pills with icons */}
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">With Icons</h3>
                <div className="flex flex-wrap items-baseline gap-3 text-sm">
                  <span>Use</span>
                  <ComponentPill editText="Benefits handbook" label="Benefits handbook" icon={<Library20Regular style={{ width: 16, height: 16 }} />} />
                  <span>to answer questions and</span>
                  <ComponentPill editText="Post message" label="Post message in Teams" icon={<FlowSparkle20Regular style={{ width: 16, height: 16 }} />} />
                  <span>when done.</span>
                </div>
              </div>

              {/* Without icons */}
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Without Icons</h3>
                <div className="flex flex-wrap items-baseline gap-3 text-sm">
                  <ComponentPill editText="plain-pill" label="Plain text pill" />
                  <ComponentPill editText="another" label="Another component" />
                </div>
              </div>

              {/* Disabled state */}
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Disabled — grayscale icon, dimmed pill</h3>
                <div className="flex flex-wrap items-baseline gap-3 text-sm">
                  <ComponentPill editText="Benefits handbook" label="Benefits handbook" icon={<Library20Regular style={{ width: 16, height: 16 }} />} disabled />
                  <ComponentPill editText="Send email" label="Send an email in Outlook" icon={<FlowSparkle20Regular style={{ width: 16, height: 16 }} />} disabled />
                  <ComponentPill editText="When a message arrives" label="When a message arrives" icon={<Flash20Regular style={{ width: 16, height: 16 }} />} disabled />
                </div>
              </div>

              {/* Selected state */}
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Selected (Menu Open) — brand stroke + light brand BG</h3>
                <div className="flex flex-wrap items-baseline gap-3 text-sm">
                  <ComponentPill editText="Benefits handbook" label="Benefits handbook" icon={<Library20Regular style={{ width: 16, height: 16 }} />} selected />
                  <ComponentPill editText="Post message" label="Post message in Teams" icon={<FlowSparkle20Regular style={{ width: 16, height: 16 }} />} selected />
                </div>
              </div>

              {/* Deleted state */}
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Deleted — #FBE5E8 background, #D1D5DB stroke, foreground text (review state)</h3>
                <div className="flex flex-wrap items-baseline gap-3 text-sm">
                  <ComponentPill editText="Benefits handbook" label="Benefits handbook" icon={<Library20Regular style={{ width: 16, height: 16 }} />} deleted />
                  <ComponentPill editText="Post message" label="Post message in Teams" icon={<FlowSparkle20Regular style={{ width: 16, height: 16 }} />} deleted />
                  <ComponentPill editText="plain-deleted" label="Plain deleted pill" deleted />
                </div>
              </div>

              {/* Side-by-side comparison */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">All States Comparison</h3>
                <div className="flex flex-wrap items-baseline gap-3 text-sm">
                  <ComponentPill editText="HR Policy" label="HR Policy" icon={<Library20Regular style={{ width: 16, height: 16 }} />} />
                  <span className="text-gray-400">→</span>
                  <ComponentPill editText="HR Policy" label="HR Policy" icon={<Library20Regular style={{ width: 16, height: 16 }} />} selected />
                  <span className="text-gray-400">→</span>
                  <ComponentPill editText="HR Policy" label="HR Policy" icon={<Library20Regular style={{ width: 16, height: 16 }} />} disabled />
                  <span className="text-gray-400">→</span>
                  <ComponentPill editText="HR Policy" label="HR Policy" icon={<Library20Regular style={{ width: 16, height: 16 }} />} deleted />
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('form-inputs') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Form Inputs and Search box</h2>
              <p className="text-sm text-gray-500 mb-6">Tailwind-native implementations following the Fluent 2 Input spec. Supports appearances (outline, underline, filled-lighter, filled-darker), sizes (sm/md/lg), contentBefore/contentAfter slots, and an animated 2px focus bar. Filled-lighter also applies a light gray hover and focus-within surface.</p>

              <div className="space-y-8">
                {/* Input */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">CopilotInput <span className="text-xs font-normal text-gray-400">(Tailwind-native, Fluent 2 spec)</span></h3>

                  <div className="space-y-6">
                    <div>
                      <p className="text-xs text-gray-500 mb-3">Appearances</p>
                      <div className="grid grid-cols-2 gap-4">
                        <CopilotInput label="Outline (default)" appearance="outline" placeholder="Enter text..." />
                        <CopilotInput label="Underline" appearance="underline" placeholder="Enter text..." />
                        <div className="bg-[#F5F5F5] p-4 rounded-lg">
                          <CopilotInput label="Filled lighter" appearance="filled-lighter" placeholder="Enter text..." />
                        </div>
                        <div className="bg-[#E8E8E8] p-3 rounded-lg">
                          <CopilotInput label="Filled darker" appearance="filled-darker" placeholder="Enter text..." />
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-3">Sizes</p>
                      <div className="grid grid-cols-3 gap-4">
                        <CopilotInput label="Small (h-8)" size="sm" placeholder="Small..." />
                        <CopilotInput label="Medium (h-9, default)" size="md" placeholder="Medium..." />
                        <CopilotInput label="Large (h-10)" size="lg" placeholder="Large..." />
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-3">Content slots — contentBefore / contentAfter</p>
                      <div className="grid grid-cols-2 gap-4">
                        <CopilotInput label="Leading icon" contentBefore={<Share20Regular />} placeholder="Search..." />
                        <CopilotInput label="Trailing icon" contentAfter={<Eye20Regular />} placeholder="Password..." />
                        <CopilotInput label="Both slots" contentBefore={<Mail20Regular />} contentAfter={<Person20Regular />} placeholder="Email..." />
                        <CopilotInput label="Prefix text" contentBefore={<span className="text-xs text-[#616161]">https://</span>} placeholder="your-domain.com" />
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-3">States</p>
                      <div className="grid grid-cols-2 gap-4">
                        <CopilotInput label="Required" required placeholder="Required field..." />
                        <CopilotInput label="With error" error="This field is required" placeholder="Error state" />
                        <CopilotInput label="Disabled" disabled defaultValue="Cannot edit" />
                        <CopilotInput label="Disabled with error" disabled error="Disabled error state" placeholder="..." />
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-3">Pill variant — contentEditable input with dynamic-value pill support (click-to-insert, drag-and-drop)</p>
                      <div className="grid grid-cols-2 gap-4">
                        <CopilotInput label="Pill input (single-line)" variant="pill" placeholder="Type or drop dynamic values here..." />
                        <CopilotInput label="Pill input with value" variant="pill" value={'Hello {{Trigger.Event data}}'} placeholder="With a pill token..." />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SearchBox */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">CopilotSearchBox</h3>
                  <p className="text-xs text-gray-500 mb-3">Search input — CopilotInput with a leading search icon and dismiss button. Type to see the clear button appear.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-1.5">Default (outline)</p>
                      <SearchInputExample appearance="outline" />
                    </div>
                    <div className="bg-[#E8E8E8] p-3 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1.5">Filled darker</p>
                      <SearchInputExample appearance="filled-darker" />
                    </div>
                  </div>
                </div>

                {/* Textarea */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">CopilotTextarea <span className="text-xs font-normal text-gray-400">(Tailwind-native)</span></h3>
                  <div className="grid grid-cols-2 gap-4">
                    <CopilotTextarea label="Default" placeholder="Enter instructions..." rows={3} />
                    <CopilotTextarea label="With value" defaultValue="You are an Invoice Validation Agent. Verify that the extracted invoice data is complete and accurate." rows={3} />
                    <CopilotTextarea label="Required" required placeholder="Required field..." rows={3} />
                    <CopilotTextarea label="Disabled" disabled defaultValue="Read only content" rows={3} />
                    <CopilotTextarea label="Pill variant (multi-line)" variant="pill" placeholder="Type or drop dynamic values here..." minHeight={80} />
                    <CopilotTextarea label="Pill with value" variant="pill" value={'Process {{Trigger.Event data}} and notify {{Trigger.User}}'} minHeight={80} />
                  </div>
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('checkbox') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">CopilotCheckbox <span className="text-base font-normal text-gray-400">(Fluent v9)</span></h2>
              <p className="text-sm text-gray-500 mb-6">Fluent v9 Checkbox with optional description text. Passes through data-testid, aria-*, and other HTML attributes via rest props. Use for boolean settings and toggleable options.</p>

              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Default — with description</h3>
                  <CopilotCheckbox
                    label="Allow agent to decide dynamically when to use this tool"
                    description="If unchecked, it can only be used when explicitly referenced by an agent or a topic."
                    defaultChecked
                  />
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Without description</h3>
                  <CopilotCheckbox label="Enable notifications" />
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Disabled</h3>
                  <div className="space-y-2">
                    <CopilotCheckbox label="Disabled unchecked" description="This option is not available." disabled />
                    <CopilotCheckbox label="Disabled checked" disabled defaultChecked />
                  </div>
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('radio') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">CopilotRadioGroup <span className="text-base font-normal text-gray-400">(Fluent v9)</span></h2>
              <p className="text-sm text-gray-500 mb-6">Fluent v9 RadioGroup with per-option labels and descriptions. Use for single-select from a list of options (e.g. phone number selection, plan tiers).</p>

              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Default — with descriptions</h3>
                  <CopilotRadioGroup
                    name="showcase-plan"
                    value="free"
                    onChange={() => {}}
                    options={[
                      { value: 'free', label: 'Free tier', description: 'Up to 100 messages per month' },
                      { value: 'pro', label: 'Pro', description: 'Unlimited messages, priority support' },
                      { value: 'enterprise', label: 'Enterprise', description: 'Custom SLA, dedicated support' },
                    ]}
                  />
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Without descriptions</h3>
                  <CopilotRadioGroup
                    name="showcase-color"
                    value="blue"
                    onChange={() => {}}
                    options={[
                      { value: 'blue', label: 'Blue' },
                      { value: 'green', label: 'Green' },
                      { value: 'red', label: 'Red' },
                    ]}
                  />
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">With disabled options</h3>
                  <CopilotRadioGroup
                    name="showcase-phone"
                    value="+1 877-214-3579"
                    onChange={() => {}}
                    options={[
                      { value: '+1 877-214-3579', label: '+1 877-214-3579' },
                      { value: '+1 833-241-2159', label: '+1 833-241-2159', description: 'In use', disabled: true },
                      { value: '+1 866-232-5058', label: '+1 866-232-5058' },
                    ]}
                  />
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Horizontal layout</h3>
                  <CopilotRadioGroup
                    name="showcase-size"
                    value="md"
                    onChange={() => {}}
                    layout="horizontal"
                    options={[
                      { value: 'sm', label: 'Small' },
                      { value: 'md', label: 'Medium' },
                      { value: 'lg', label: 'Large' },
                    ]}
                  />
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('toggle') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">CopilotToggle</h2>
              <p className="text-sm text-gray-500 mb-6">Toggle switch with sm/md sizes, brand color when on, disabled state, and optional label. Uses role="switch" and aria-checked for accessibility.</p>

              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Default (sm) — on and off</h3>
                  <div className="flex items-center gap-6">
                    <ToggleShowcaseExample />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Medium (md)</h3>
                  <div className="flex items-center gap-6">
                    <ToggleShowcaseExample size="md" />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">With label</h3>
                  <div className="flex flex-col gap-3">
                    <ToggleShowcaseExample label="Enable notifications" />
                    <ToggleShowcaseExample label="Dark mode" defaultChecked />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Disabled</h3>
                  <div className="flex items-center gap-6">
                    <CopilotToggle checked={false} onChange={() => {}} disabled aria-label="Disabled off" />
                    <CopilotToggle checked={true} onChange={() => {}} disabled aria-label="Disabled on" />
                  </div>
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('dropdowns') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Dropdowns</h2>
              <p className="text-sm text-gray-500 mb-6">Dropdown button components with chevron icons</p>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">States</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <CopilotButton variant="dropdown">Dropdown</CopilotButton>
                  <CopilotButton variant="dropdown-selected">Selected</CopilotButton>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Sizes</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <CopilotButton variant="dropdown" size="sm">Small</CopilotButton>
                  <CopilotButton variant="dropdown" size="md">Medium</CopilotButton>
                  <CopilotButton variant="dropdown" size="lg">Large</CopilotButton>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Card Variant</h3>
                <p className="text-xs text-gray-500 mb-3">Flex-col layout for prompt tiles and content cards. Use with <code>h-full w-full</code> inside a grid for equal-height rows.</p>
                <div className="grid grid-cols-3 gap-3 max-w-xl">
                  <CopilotButton variant="card" className="h-full w-full" onClick={() => {}}>
                    <span className="font-semibold text-sm">Summarize</span>
                    <span className="text-xs text-text-subtle font-normal leading-snug">Give me a summary of recent updates</span>
                  </CopilotButton>
                  <CopilotButton variant="card" className="h-full w-full" onClick={() => {}}>
                    <span className="font-semibold text-sm">Ask</span>
                    <span className="text-xs text-text-subtle font-normal leading-snug">What's the current status?</span>
                  </CopilotButton>
                  <CopilotButton variant="card" className="h-full w-full" onClick={() => {}}>
                    <span className="font-semibold text-sm">Create</span>
                    <span className="text-xs text-text-subtle font-normal leading-snug">Help me get started with something new</span>
                  </CopilotButton>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Button States</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <CopilotButton variant="dropdown">All projects</CopilotButton>
                  <CopilotButton variant="dropdown">Last 30 days</CopilotButton>
                  <CopilotButton variant="dropdown-selected">Active</CopilotButton>
                  <CopilotButton variant="dropdown">Sort by</CopilotButton>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Menu Card (Plain)</h3>
                <p className="text-xs text-gray-500 mb-3">Click the dropdown to see the live menu card. The selected item shows a checkmark (strokeWidth 1.5). Menu container uses overflow-hidden to respect rounded corners.</p>
                <CopilotDropdown
                  options={[
                    { label: 'Name (A-Z)', value: 'name' },
                    { label: 'Date created', value: 'created' },
                    { label: 'Date modified', value: 'modified' },
                    { label: 'Size', value: 'size' },
                  ]}
                  value="modified"
                  placeholder="Sort by"
                />
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Menu Card with Icons</h3>
                <p className="text-xs text-gray-500 mb-3">Icons swap to filled variant and turn brand color on hover</p>
                <CopilotDropdown
                  options={[
                    { label: 'Documents', value: 'docs', icon: <Document20Regular />, iconFilled: <Document20Filled /> },
                    { label: 'Folders', value: 'folders', icon: <Folder20Regular />, iconFilled: <Folder20Filled /> },
                    { label: 'People', value: 'people', icon: <People20Regular />, iconFilled: <People20Filled /> },
                    { label: 'Settings', value: 'settings', icon: <Settings20Regular />, iconFilled: <Settings20Filled /> },
                  ]}
                  value="folders"
                  placeholder="Browse"
                />
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Menu Card with Icons & Descriptions</h3>
                <p className="text-xs text-gray-500 mb-3">Label is bolded when a description is present; filled icon on hover</p>
                <CopilotDropdown
                  options={[
                    { label: 'Documents', value: 'docs', icon: <Document20Regular />, iconFilled: <Document20Filled />, description: 'View and edit files' },
                    { label: 'Folders', value: 'folders', icon: <Folder20Regular />, iconFilled: <Folder20Filled />, description: 'Organize your content' },
                    { label: 'People', value: 'people', icon: <People20Regular />, iconFilled: <People20Filled />, description: 'Manage team members' },
                    { label: 'Settings', value: 'settings', icon: <Settings20Regular />, iconFilled: <Settings20Filled />, description: 'Configure preferences' },
                  ]}
                  value="folders"
                  placeholder="Browse"
                />
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">triggerClassName — custom trigger styling</h3>
                <p className="text-xs text-gray-500 mb-3">Pass <code>triggerClassName</code> to apply extra classes to the trigger button — e.g. brand background highlight used during HA review state.</p>
                <div className="flex flex-wrap items-start gap-3">
                  <CopilotDropdown
                    options={[
                      { label: 'GPT-4o', value: 'gpt4o' },
                      { label: 'GPT-4o Mini', value: 'gpt4o-mini' },
                      { label: 'Claude Sonnet', value: 'claude-sonnet' },
                    ]}
                    value="claude-sonnet"
                    placeholder="Model"
                    triggerClassName="!bg-brand-background hover:!bg-brand-background-hover !border-brand-border"
                  />
                  <CopilotDropdown
                    options={[
                      { label: 'GPT-4o', value: 'gpt4o' },
                      { label: 'GPT-4o Mini', value: 'gpt4o-mini' },
                      { label: 'Claude Sonnet', value: 'claude-sonnet' },
                    ]}
                    value="claude-sonnet"
                    placeholder="Model"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Interactive Menus</h3>
                <div className="flex flex-wrap items-start gap-3">
                  <DropdownExample1 />
                  <DropdownExample2 />
                  <DropdownExample3 />
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('menu') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">CopilotMenu</h2>
              <p className="text-sm text-gray-500 mb-6">Fixed-position context/action menu anchored to a trigger element. Handles its own click-outside dismissal.</p>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Text only</h3>
                <p className="text-xs text-gray-500 mb-3">Click the button to open the menu</p>
                <CopilotMenuExample1 />
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">With icons — sm size (default)</h3>
                <p className="text-xs text-gray-500 mb-3">Icons swap Regular→Filled and turn brand color on hover</p>
                <CopilotMenuExample2 />
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">With icons — md size, divider &amp; destructive item</h3>
                <p className="text-xs text-gray-500 mb-3">Used for settings/context menus with mixed action types</p>
                <CopilotMenuExample3 />
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">With toggle item</h3>
                <p className="text-xs text-gray-500 mb-3">Toggle rows stay open on click so the user can see the state change</p>
                <CopilotMenuExample4 />
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">With section labels</h3>
                <p className="text-xs text-gray-500 mb-3">Non-interactive bold section headers for grouping related actions (e.g. Sort by / Group by)</p>
                <CopilotMenuExample5 />
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">With submenu (hasSubMenu)</h3>
                <p className="text-xs text-gray-500 mb-3">Hover the "Send to" row to reveal a submenu. A 200 ms delay prevents flickering when moving between the row and the submenu.</p>
                <CopilotMenuExample6 />
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">With header</h3>
                <p className="text-xs text-gray-500 mb-3">Pass <code className="bg-[#F5F5F5] px-1 rounded text-xs">header</code> to render arbitrary content above the item list, separated by a divider. Used in pill context menus to show component name and source.</p>
                <CopilotMenuExample7 />
              </div>
            </section>}

            {visibleSectionIds.has('tabs') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">CopilotTabs</h2>
              <p className="text-sm text-gray-500 mb-6">Tab navigation component with consistent sizing</p>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Sizes</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <TabsExample1 />
                    <span className="text-xs text-gray-500">Small (h-7)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <TabsExample2 />
                    <span className="text-xs text-gray-500">Medium (h-8) - Default</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <TabsExample3 />
                    <span className="text-xs text-gray-500">Large (h-10)</span>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Navigation Tabs</h3>
                <p className="text-xs text-gray-500 mb-3">Common usage for page navigation</p>
                <TabsExample4 />
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Filter Tabs</h3>
                <p className="text-xs text-gray-500 mb-3">Used for filtering or categorizing content</p>
                <TabsExample5 />
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Collapsible (overflow)</h3>
                <p className="text-xs text-gray-500 mb-3">
                  When <code className="bg-gray-100 px-1 rounded">collapsible</code> is set, tabs progressively collapse in three stages:
                  (1) all tabs visible, (2) active tab + "+N" overflow button, (3) single tab with a down chevron dropdown showing all tabs.
                  Drag the box below to see all three states.
                </p>
                <TabsCollapsibleExample />
              </div>

            </section>}

            {visibleSectionIds.has('underline-tabs') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">CopilotUnderlineTabs (Subtle appearance)</h2>
              <p className="text-sm text-gray-500 mb-6">Underline-style tab bar using Fluent subtle appearance with 8px corners, optional icons, and brand-color active indicator</p>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Sizes</h3>
                <div className="space-y-4">
                  <div>
                    <UnderlineTabsSmExample />
                    <span className="text-xs text-gray-500 mt-1 block">Small</span>
                  </div>
                  <div>
                    <UnderlineTabsMdExample />
                    <span className="text-xs text-gray-500 mt-1 block">Medium (default)</span>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">With trailing content</h3>
                <p className="text-xs text-gray-500 mb-3">Pass a <code className="bg-gray-100 px-1 rounded">trailing</code> prop for right-aligned actions</p>
                <UnderlineTabsTrailingExample />
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">With and without icons</h3>
                <div className="space-y-4">
                  <div>
                    <UnderlineTabsNoIconExample />
                    <span className="text-xs text-gray-500 mt-1 block">Without icons</span>
                  </div>
                  <div>
                    <UnderlineTabsWithIconExample />
                    <span className="text-xs text-gray-500 mt-1 block">With icons</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">With disabled tab</h3>
                <UnderlineTabsDisabledExample />
              </div>

            </section>}

            {visibleSectionIds.has('instruction-pills') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">InstructionPill</h2>
              <p className="text-sm text-gray-500 mb-6">Inline canvas pills for connector actions, knowledge sources, helper agents, and triggers. Shows a warning state when required inputs are not configured.</p>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Pill types — configured</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <InstructionPill
                    config={{ id: 'send-email', type: 'connector', label: 'Send email', channel: 'outlook', inputs: [] }}
                    isConfigured={true}
                    onClick={() => {}}
                  />
                  <InstructionPill
                    config={{ id: 'post-message', type: 'connector', label: 'Post message', channel: 'teams', inputs: [] }}
                    isConfigured={true}
                    onClick={() => {}}
                  />
                  <InstructionPill
                    config={{ id: 'get-items', type: 'connector', label: 'Get items', channel: 'sharepoint', inputs: [] }}
                    isConfigured={true}
                    onClick={() => {}}
                  />
                  <InstructionPill
                    config={{ id: 'claims', type: 'knowledge', label: 'Claims database', inputs: [] }}
                    isConfigured={true}
                    onClick={() => {}}
                  />
                  <InstructionPill
                    config={{ id: 'work-iq', type: 'agent', label: 'Work IQ', inputs: [] }}
                    isConfigured={true}
                    onClick={() => {}}
                  />
                  <InstructionPill
                    config={{ id: 'on-message', type: 'trigger', label: 'When a user messages in Teams', channel: 'teams', inputs: [] }}
                    isConfigured={true}
                    onClick={() => {}}
                  />
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Warning state — unconfigured connector actions</h3>
                <p className="text-xs text-gray-500 mb-3">Hover to see the tooltip. Click to open the config panel.</p>
                <div className="flex flex-wrap items-center gap-3">
                  <InstructionPill
                    config={{ id: 'send-email-warn', type: 'connector', label: 'Send email', channel: 'outlook', inputs: [{ name: 'To', required: true }, { name: 'Subject', required: true }, { name: 'Body', required: true }] }}
                    isConfigured={false}
                    onClick={() => {}}
                  />
                  <InstructionPill
                    config={{ id: 'list-rows-warn', type: 'connector', label: 'List rows', channel: 'dataverse', inputs: [{ name: 'Table name', required: true }] }}
                    isConfigured={false}
                    onClick={() => {}}
                  />
                  <InstructionPill
                    config={{ id: 'add-row-warn', type: 'connector', label: 'Add a row into a table', channel: 'excel', inputs: [{ name: 'File', required: true }, { name: 'Table', required: true }] }}
                    isConfigured={false}
                    onClick={() => {}}
                  />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Narrow preview mode — all four types</h3>
                <p className="text-xs text-gray-500 mb-3">Compact size used in the conversational layout. Icons are hidden; only text is shown.</p>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <InstructionPill
                    config={{ id: 'conn-narrow', type: 'connector', label: 'Get items', channel: 'sharepoint', inputs: [] }}
                    isConfigured={true}
                    onClick={() => {}}
                    isNarrowPreview={true}
                  />
                  <InstructionPill
                    config={{ id: 'kb-narrow', type: 'knowledge', label: 'Policy docs', inputs: [] }}
                    isConfigured={true}
                    onClick={() => {}}
                    isNarrowPreview={true}
                  />
                  <InstructionPill
                    config={{ id: 'agent-narrow', type: 'agent', label: 'Work IQ', inputs: [] }}
                    isConfigured={true}
                    onClick={() => {}}
                    isNarrowPreview={true}
                  />
                  <InstructionPill
                    config={{ id: 'trigger-narrow', type: 'trigger', label: 'New Teams message', channel: 'teams', inputs: [] }}
                    isConfigured={true}
                    onClick={() => {}}
                    isNarrowPreview={true}
                  />
                  <InstructionPill
                    config={{ id: 'warn-narrow', type: 'connector', label: 'Send email', channel: 'outlook', inputs: [{ name: 'To', required: true }] }}
                    isConfigured={false}
                    onClick={() => {}}
                    isNarrowPreview={true}
                  />
                </div>
                <p className="text-xs text-gray-400">connector · knowledge · agent · trigger · connector (warning)</p>
              </div>
            </section>}

            {visibleSectionIds.has('pill-config-panel') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">PillConfigPanel</h2>
              <p className="text-sm text-gray-500 mb-6">Full-screen drill-down overlay for configuring a connector action. Opens over the canvas when a connector pill is clicked. Sections: Details (collapsed), Inputs (open by default, dynamic per pill), Advanced (collapsed).</p>

              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Interactive demo</h3>
                <p className="text-xs text-gray-500 mb-3">Click the pill to open the panel. Toggle inputs between Adaptive AI and Custom. Close with the back arrow.</p>
                <div className="flex items-center gap-3 mb-4">
                  <InstructionPill
                    config={{ id: 'demo-send-email', type: 'connector', label: 'Send an email (V2)', channel: 'outlook', inputs: [{ name: 'To', required: true }, { name: 'Subject', required: true }, { name: 'Body', required: true }] }}
                    isConfigured={Object.keys(showcasePillInputs).length >= 3}
                    onClick={() => setPillPanelOpen(true)}
                  />
                  <span className="text-xs text-gray-400">← click to open panel</span>
                </div>
              </div>

              <div className="relative border border-gray-200 rounded-xl overflow-hidden" style={{ height: 600 }}>
                <div className="flex items-center justify-center h-full text-sm text-gray-400">
                  Canvas area — PillConfigPanel overlays this
                </div>
                {pillPanelOpen && (
                  <PillConfigPanel
                    pill={{ id: 'demo-send-email', type: 'connector', label: 'Send an email (V2)', channel: 'outlook', inputs: [{ name: 'To', required: true }, { name: 'Subject', required: true }, { name: 'Body', required: false, description: 'The email body. Supports HTML.' }] }}
                    visible={pillPanelOpen}
                    inputs={showcasePillInputs}
                    onInputChange={(name, mode) => setShowcasePillInputs(prev => ({ ...prev, [name]: mode }))}
                    onClose={() => setPillPanelOpen(false)}
                  />
                )}
              </div>
            </section>}

            {visibleSectionIds.has('add-component-modal') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">AddComponentModal</h2>
              <p className="text-sm text-gray-500 mb-6">Full-canvas overlay for searching and adding capabilities to an agent. Initial view shows capability category cards and top picks. After entering a search query the results view shows filtered items with filter tabs and a selection toolbar.</p>

              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Interactive demo</h3>
                <p className="text-xs text-gray-500 mb-3">AddComponentModal portals into <code>#elevate-right-pane</code> — open it from the Build page by clicking "Add" on the Components tab to see the full experience.</p>
              </div>

              <div className="relative border border-gray-200 rounded-xl overflow-hidden h-[600px] flex items-center justify-center text-sm text-gray-400">
                Demo available on Build page → Components → Add
              </div>
            </section>}

            {visibleSectionIds.has('sub-header') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">SubHeader</h2>
              <p className="text-sm text-gray-500 mb-6">Page-level back navigation header. Padding and max-width are set by the caller via <code>className</code> to align with the page content area. Supports optional subtitle, badge, icon (with <code>noIconWrap</code> for pre-styled icons), and right-side actions.</p>

              <div className="space-y-6">
                {/* Variant 1 — title only */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Title only</h3>
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <SubHeader title="Page title" onBack={() => {}} className="px-8 pt-4 pb-3" />
                  </div>
                </div>

                {/* Variant 2 — title + subtitle */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Title + Subtitle</h3>
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <SubHeader title="Scenario name" subtitle="Last run Mar 20, 2:45 PM" onBack={() => {}} className="px-8 pt-4 pb-3" />
                  </div>
                </div>

                {/* Variant 3 — title + badge */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Title + Badge</h3>
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <SubHeader
                      title="Scenario name"
                      badge={<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">Passed</span>}
                      onBack={() => {}}
                      className="px-8 pt-4 pb-3"
                    />
                  </div>
                </div>

                {/* Variant 4 — title + badge + subtitle */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Title + Badge + Subtitle</h3>
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <SubHeader
                      title="Scenario name"
                      badge={<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">Failed</span>}
                      subtitle="Last run Mar 20, 2:45 PM"
                      onBack={() => {}}
                      className="px-8 pt-4 pb-3"
                    />
                  </div>
                </div>

                {/* Variant 5 — title + icon (wrapped) */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Title + Icon (default gray box wrap)</h3>
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <SubHeader
                      title="New Conversation"
                      icon={<Chat20Regular className="w-5 h-5 text-gray-500" />}
                      onBack={() => {}}
                      className="px-8 pt-4 pb-3"
                    />
                  </div>
                </div>

                {/* Variant 6 — title + icon (noIconWrap) */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Title + Icon with <code>noIconWrap</code> (pre-styled icon)</h3>
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <SubHeader
                      title="Send an email"
                      subtitle="Skill"
                      noIconWrap
                      icon={
                        <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
                          <Chat20Regular style={{ width: 16, height: 16, color: '#7C3AED' }} />
                        </div>
                      }
                      onBack={() => {}}
                      className="px-8 pt-4 pb-3"
                    />
                  </div>
                </div>

                {/* Variant 7 — title + actions */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Title + Actions</h3>
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <SubHeader
                      title="Page title"
                      subtitle="Section context"
                      onBack={() => {}}
                      className="px-8 pt-4 pb-3"
                      actions={<>
                        <CopilotButton variant="ghost" size="sm">Edit</CopilotButton>
                        <CopilotButton variant="primary" size="sm">Publish</CopilotButton>
                      </>}
                    />
                  </div>
                </div>

                {/* SubHeaderBadge */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">SubHeaderBadge — brand pill</h3>
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <SubHeader
                      title="Configure connector"
                      badge={<SubHeaderBadge label="Preview" />}
                      onBack={() => {}}
                      className="px-8 pt-4 pb-3"
                    />
                  </div>
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('collapsible') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">CollapsibleSection</h2>
              <p className="text-sm text-gray-500 mb-6">Expandable panel for content organization</p>

              <div className="max-w-md space-y-2">
                <CollapsibleSection title="Configuration" defaultOpen>
                  <p className="text-sm text-gray-600">
                    This section contains configuration options for your project.
                  </p>
                </CollapsibleSection>
                <CollapsibleSection title="Advanced Settings">
                  <p className="text-sm text-gray-600">
                    Advanced settings for power users.
                  </p>
                </CollapsibleSection>
              </div>
            </section>}

            {visibleSectionIds.has('cards') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Cards</h2>
              <p className="text-sm text-gray-500 mb-6">Content cards, metric cards, and card containers</p>

              <div className="space-y-8">
                {/* Gallery */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Gallery</h3>
                  <div className="grid grid-cols-3 gap-6">
                    <CopilotCard variant="gallery" title="FAQ Chatbot" description="Answer common customer questions using your knowledge base." icon={<BotSparkle20Filled />} onClick={() => {}} />
                    <CopilotCard variant="gallery" title="Leave Request" description="Automate PTO requests with manager approval." icon={<FlowSparkle20Filled />} onClick={() => {}} />
                    <CopilotCard variant="gallery" title="IT Support Agent" description="Guided troubleshooting for common IT issues." icon={<Sparkle20Filled />} onClick={() => {}} />
                  </div>
                </div>

                {/* Simple */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Simple</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <CopilotCard variant="simple" title="Knowledge Base" icon={<Document20Regular />} />
                    <CopilotCard variant="simple" title="Active" icon={<Flash20Filled />} badge="Live" badgeVariant="success" />
                    <CopilotCard variant="simple" title="Data Sources" icon={<Database20Regular />} badge="3" badgeVariant="neutral" onClick={() => {}} />
                  </div>
                </div>

                {/* Medium */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Medium</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <CopilotCard
                      variant="medium"
                      title="Customer Support Agent"
                      description="Handles product questions, returns, and account inquiries across web and Teams channels."
                      icon={<BotSparkle20Filled />}
                      badge="Active"
                      badgeVariant="success"
                      onClick={() => {}}
                    />
                    <CopilotCard
                      variant="medium"
                      title="Onboarding Workflow"
                      description="Automated employee onboarding with document collection and system provisioning."
                      icon={<FlowSparkle20Filled />}
                      badge="Draft"
                      badgeVariant="warning"
                    />
                    <CopilotCard
                      variant="medium"
                      title="IT Help Desk"
                      description="Resolves common IT tickets and escalates complex issues to the support team."
                      icon={<People20Filled />}
                      selected
                    />
                    <CopilotCard
                      variant="medium"
                      title="Archived Agent"
                      description="This agent has been disabled and is no longer active."
                      icon={<Folder20Filled />}
                      badge="Archived"
                      badgeVariant="neutral"
                      disabled
                    />
                  </div>
                </div>

                {/* Detailed */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Detailed</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <CopilotCard
                      variant="detailed"
                      title="Sales Assistant Agent"
                      description="AI-powered agent that helps your sales team find product information, generate quotes, and track deal progress."
                      icon={<Sparkle20Filled />}
                      badge="Active"
                      badgeVariant="success"
                      metadata={[
                        { label: 'Type', value: 'Agent' },
                        { label: 'Channel', value: 'Teams' },
                        { label: 'Conversations', value: '1,247' },
                        { label: 'Last Active', value: '2 min ago' },
                      ]}
                      actions={[
                        { label: 'Edit', onClick: () => {}, variant: 'secondary' },
                        { label: 'Test', onClick: () => {}, variant: 'primary' },
                        { label: 'View Logs', onClick: () => {}, variant: 'ghost' },
                      ]}
                    />
                    <CopilotCard
                      variant="detailed"
                      title="Invoice Processing"
                      description="Workflow that extracts data from uploaded invoices, validates against PO numbers, and routes for approval."
                      icon={<FlowSparkle20Filled />}
                      badge="Error"
                      badgeVariant="error"
                      metadata={[
                        { label: 'Type', value: 'Workflow' },
                        { label: 'Trigger', value: 'Email' },
                        { label: 'Runs Today', value: '34' },
                        { label: 'Failure Rate', value: '2.1%' },
                      ]}
                      actions={[
                        { label: 'Configure', onClick: () => {}, variant: 'secondary' },
                        { label: 'Run Now', onClick: () => {}, variant: 'primary' },
                      ]}
                      onClick={() => {}}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Metric Cards</h3>
                <p className="text-sm text-gray-500 mb-6">KPI stat cards with label, value, and trend indicators for dashboards. Uses the standard DW tile spec: <code className="text-xs bg-gray-100 px-1 rounded">p-4</code>, <code className="text-xs bg-gray-100 px-1 rounded">border-neutral-200</code>, <code className="text-xs bg-gray-100 px-1 rounded">text-xs uppercase tracking-wide</code> label, <code className="text-xs bg-gray-100 px-1 rounded">text-3xl font-bold text-neutral-900</code> value.</p>

              <div className="space-y-8">
                {/* Default */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Default (5-column grid)</h3>
                  <div className="grid grid-cols-5 gap-4">
                    <MetricCard label="Total runs" value={1706} trend="up" trendValue="5%" />
                    <MetricCard label="Failed runs" value={256} trend="down" trendValue="5%" trendUpIsGood={false} />
                    <MetricCard label="Average duration" value="30 sec" trend="up" trendValue="3%" />
                    <MetricCard label="Total sessions" value={2356} trend="down" trendValue="5%" />
                    <MetricCard label="Engagement" value="95%" trend="up" trendValue="8%" />
                  </div>
                </div>

                {/* Variants */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Trend Variants</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <MetricCard label="Positive up trend" value="1,234" trend="up" trendValue="12%" />
                    <MetricCard label="Negative down trend" value={42} trend="down" trendValue="8%" />
                    <MetricCard label="Inverted (down is good)" value="1.2s" trend="down" trendValue="15%" trendUpIsGood={false} />
                    <MetricCard label="No trend" value="N/A" showInfo={false} />
                  </div>
                </div>
              </div>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Content Cards</h3>
                <p className="text-sm text-gray-500 mb-6">Card container with optional header for wrapping content like tables or lists</p>

              <div className="space-y-8">
                {/* With table */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">With CopilotTable</h3>
                  <ContentCard
                    title="Themes"
                    description={
                      <>
                        Analyze your users' questions by auto-classified themes.{' '}
                        <button className="text-brand-purple hover:text-brand-purple bg-none border-none cursor-pointer p-0">Learn more</button>

                      </>
                    }
                    meta="Last updated 02/12/26"
                    actions={<CopilotButton variant="primary" size="sm" onClick={() => {}}>See all</CopilotButton>}
                    footer={<p className="text-xs text-gray-500">AI-generated content may be incorrect.</p>}
                  >
                    <CopilotTable
                      columns={[
                        { key: 'name', label: 'Name', sortable: true },
                        { key: 'count', label: 'Count', sortable: true },
                        { key: 'status', label: 'Status' },
                      ]}
                      data={[
                        { name: 'Policies', count: 597, status: 'Active' },
                        { name: 'Customer details', count: 1403, status: 'Active' },
                        { name: 'Cost estimation', count: 259, status: 'Review' },
                      ]}
                      size="md"
                      className="border-0 rounded-none"
                    />
                  </ContentCard>
                </div>

                {/* Minimal */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Minimal (title only)</h3>
                  <ContentCard title="Activity Log">
                    <div className="px-6 py-4 text-sm text-gray-500">
                      Any content can go here — tables, lists, charts, or custom layouts.
                    </div>
                  </ContentCard>
                </div>

                {/* No header */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">No Header</h3>
                  <ContentCard>
                    <div className="p-6 text-sm text-gray-600">
                      A plain card wrapper with no header — useful as a content container.
                    </div>
                  </ContentCard>
                </div>
              </div>
              </div>
            </section>}

            {visibleSectionIds.has('lists') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">CopilotList</h2>
              <p className="text-sm text-gray-500 mb-6">Selectable list component with icons and descriptions</p>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Sizes</h3>
                <div className="space-y-4">
                  <div>
                    <span className="text-xs text-gray-500 block mb-2">Small (sm)</span>
                    <CopilotList
                      items={[
                        { id: '1', label: 'Option 1', icon: <CheckmarkCircle20Regular /> },
                        { id: '2', label: 'Option 2', icon: <Circle20Regular /> },
                        { id: '3', label: 'Option 3', icon: <Info20Regular /> },
                      ]}
                      selectedId="1"
                      size="sm"
                      className="max-w-xs"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block mb-2">Medium (md) - Default</span>
                    <CopilotList
                      items={[
                        { id: '1', label: 'Option 1', icon: <CheckmarkCircle20Regular /> },
                        { id: '2', label: 'Option 2', icon: <Circle20Regular /> },
                        { id: '3', label: 'Option 3', icon: <Info20Regular /> },
                      ]}
                      selectedId="1"
                      size="md"
                      className="max-w-xs"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block mb-2">Large (lg)</span>
                    <CopilotList
                      items={[
                        { id: '1', label: 'Option 1', icon: <CheckmarkCircle20Regular />, description: 'First option with description' },
                        { id: '2', label: 'Option 2', icon: <Circle20Regular />, description: 'Second option with description' },
                        { id: '3', label: 'Option 3', icon: <Info20Regular />, description: 'Third option with description' },
                      ]}
                      selectedId="1"
                      size="lg"
                      className="max-w-md"
                    />
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">With Descriptions</h3>
                <p className="text-xs text-gray-500 mb-3">Lists can include descriptive text for each item</p>
                <CopilotList
                  items={[
                    {
                      id: 'react',
                      label: 'React',
                      icon: <Sparkle20Regular />,
                      description: 'A JavaScript library for building user interfaces'
                    },
                    {
                      id: 'vue',
                      label: 'Vue.js',
                      icon: <CheckmarkCircle20Regular />,
                      description: 'The progressive JavaScript framework'
                    },
                    {
                      id: 'angular',
                      label: 'Angular',
                      icon: <Circle20Regular />,
                      description: 'Platform for building mobile and desktop web applications'
                    },
                  ]}
                  selectedId="react"
                  size="md"
                  className="max-w-md"
                />
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">With Dividers</h3>
                <p className="text-xs text-gray-500 mb-3">Use dividers to separate groups of items</p>
                <CopilotList
                  items={[
                    { id: '1', label: 'Workspace Settings', icon: <Settings20Regular /> },
                    { id: '2', label: 'User Preferences', icon: <Person20Regular /> },
                    { id: '3', label: 'Notifications', icon: <Alert20Regular />, dividerAbove: true },
                    { id: '4', label: 'Privacy & Security', icon: <ShieldCheckmark20Regular /> },
                  ]}
                  selectedId="2"
                  size="md"
                  className="max-w-sm"
                />
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">With Disabled Items</h3>
                <p className="text-xs text-gray-500 mb-3">Disabled items are grayed out and non-interactive</p>
                <CopilotList
                  items={[
                    { id: '1', label: 'Available Option', icon: <CheckmarkCircle20Regular /> },
                    { id: '2', label: 'Disabled Option', icon: <Prohibited20Regular />, disabled: true },
                    { id: '3', label: 'Another Available', icon: <Circle20Regular /> },
                  ]}
                  selectedId="1"
                  size="md"
                  className="max-w-sm"
                />
              </div>
            </section>}

            {visibleSectionIds.has('tables') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">CopilotTable</h2>
              <p className="text-sm text-gray-500 mb-6">Data grid with sortable columns and row selection. Cells use <code>whitespace-nowrap</code> — long text is truncated to a single line.</p>

              <TableExample />
            </section>}

            {visibleSectionIds.has('dialogs') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Dialog</h2>
              <p className="text-sm text-gray-500 mb-6">Modal dialogs with customizable sizes and content areas</p>

              <div className="space-y-8">
                {/* Size Variants */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Size Variants</h3>
                  <div className="flex flex-wrap gap-3">
                    <CopilotButton variant="secondary" onClick={() => setDialogSmOpen(true)}>
                      Small Dialog (sm)
                    </CopilotButton>
                    <CopilotButton variant="secondary" onClick={() => setDialogMdOpen(true)}>
                      Medium Dialog (md)
                    </CopilotButton>
                    <CopilotButton variant="secondary" onClick={() => setDialogLgOpen(true)}>
                      Large Dialog (lg)
                    </CopilotButton>
                    <CopilotButton variant="secondary" onClick={() => setDialogXlOpen(true)}>
                      Extra Large Dialog (xl)
                    </CopilotButton>
                    <CopilotButton variant="secondary" onClick={() => setDialog2xlOpen(true)}>
                      2XL Dialog (2xl)
                    </CopilotButton>
                    <CopilotButton variant="secondary" onClick={() => setDialog4xlOpen(true)}>
                      4XL Dialog (4xl)
                    </CopilotButton>
                    <CopilotButton variant="secondary" onClick={() => setDialog5xlOpen(true)}>
                      5XL Dialog (5xl)
                    </CopilotButton>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600">
                    <strong>Usage:</strong> Dialog component with 32px border radius (--radius-4xl). Includes DialogHeader, DialogTitle, DialogContent, and DialogFooter subcomponents. Use <code>containerStyle</code> to override max-width or max-height (e.g. <code>{'{ maxWidth: 1214, maxHeight: 760 }'}</code>).
                  </p>
                </div>
              </div>

              {/* Dialog Examples */}
              <Dialog isOpen={dialogSmOpen} onClose={() => setDialogSmOpen(false)} maxWidth="sm">
                <DialogHeader onClose={() => setDialogSmOpen(false)}>
                  <DialogTitle>Small Dialog</DialogTitle>
                </DialogHeader>
                <DialogContent>
                  <p className="text-sm text-gray-600">
                    This is a small dialog (max-w-sm). Perfect for simple confirmations or brief messages.
                  </p>
                </DialogContent>
                <DialogFooter>
                  <CopilotButton variant="secondary" onClick={() => setDialogSmOpen(false)}>
                    Cancel
                  </CopilotButton>
                  <CopilotButton variant="primary" onClick={() => setDialogSmOpen(false)}>
                    Confirm
                  </CopilotButton>
                </DialogFooter>
              </Dialog>

              <Dialog isOpen={dialogMdOpen} onClose={() => setDialogMdOpen(false)} maxWidth="md">
                <DialogHeader onClose={() => setDialogMdOpen(false)}>
                  <DialogTitle>Medium Dialog</DialogTitle>
                </DialogHeader>
                <DialogContent>
                  <p className="text-sm text-gray-600 mb-4">
                    This is a medium dialog (max-w-md). Good for forms with a few fields or moderate content.
                  </p>
                  <div className="space-y-3">
                    <CopilotInput label="Name" placeholder="Enter your name" />
                    <CopilotInput label="Email" placeholder="Enter your email" />
                  </div>
                </DialogContent>
                <DialogFooter>
                  <CopilotButton variant="secondary" onClick={() => setDialogMdOpen(false)}>
                    Cancel
                  </CopilotButton>
                  <CopilotButton variant="primary" onClick={() => setDialogMdOpen(false)}>
                    Save
                  </CopilotButton>
                </DialogFooter>
              </Dialog>

              <Dialog isOpen={dialogLgOpen} onClose={() => setDialogLgOpen(false)} maxWidth="lg">
                <DialogHeader onClose={() => setDialogLgOpen(false)}>
                  <DialogTitle>Large Dialog</DialogTitle>
                </DialogHeader>
                <DialogContent>
                  <p className="text-sm text-gray-600 mb-4">
                    This is a large dialog (max-w-lg). Suitable for forms with multiple sections or detailed content.
                  </p>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="font-semibold text-sm text-blue-900 mb-1">Information</h4>
                      <p className="text-sm text-blue-700">This dialog can hold more complex layouts and content structures.</p>
                    </div>
                    <CopilotTextarea label="Description" placeholder="Enter a detailed description..." rows={4} />
                  </div>
                </DialogContent>
                <DialogFooter>
                  <CopilotButton variant="secondary" onClick={() => setDialogLgOpen(false)}>
                    Cancel
                  </CopilotButton>
                  <CopilotButton variant="primary" onClick={() => setDialogLgOpen(false)}>
                    Submit
                  </CopilotButton>
                </DialogFooter>
              </Dialog>

              <Dialog isOpen={dialogXlOpen} onClose={() => setDialogXlOpen(false)} maxWidth="xl">
                <DialogHeader onClose={() => setDialogXlOpen(false)}>
                  <DialogTitle>Extra Large Dialog</DialogTitle>
                </DialogHeader>
                <DialogContent>
                  <p className="text-sm text-gray-600 mb-4">
                    This is an extra large dialog (max-w-xl). Ideal for rich content, data visualization, or multi-step forms.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-semibold text-sm mb-2">Section 1</h4>
                      <p className="text-sm text-gray-600">Content area with multiple columns</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-semibold text-sm mb-2">Section 2</h4>
                      <p className="text-sm text-gray-600">More structured content</p>
                    </div>
                  </div>
                </DialogContent>
                <DialogFooter>
                  <CopilotButton variant="secondary" onClick={() => setDialogXlOpen(false)}>
                    Cancel
                  </CopilotButton>
                  <CopilotButton variant="primary" onClick={() => setDialogXlOpen(false)}>
                    Continue
                  </CopilotButton>
                </DialogFooter>
              </Dialog>

              <Dialog isOpen={dialog2xlOpen} onClose={() => setDialog2xlOpen(false)} maxWidth="2xl">
                <DialogHeader onClose={() => setDialog2xlOpen(false)}>
                  <DialogTitle>2XL Dialog (Default)</DialogTitle>
                </DialogHeader>
                <DialogContent>
                  <p className="text-sm text-gray-600 mb-4">
                    This is a 2XL dialog (max-w-2xl) - the default size. Best for complex workflows, settings panels, or detailed forms.
                  </p>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <Sparkle20Filled className="mb-2" style={{ color: '#8B5CF6' }} />
                        <h4 className="font-semibold text-sm mb-1">Feature 1</h4>
                        <p className="text-xs text-gray-600">Description text</p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <Settings20Filled className="mb-2" style={{ color: '#3B82F6' }} />
                        <h4 className="font-semibold text-sm mb-1">Feature 2</h4>
                        <p className="text-xs text-gray-600">Description text</p>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <CheckmarkCircle20Filled className="mb-2" style={{ color: '#10B981' }} />
                        <h4 className="font-semibold text-sm mb-1">Feature 3</h4>
                        <p className="text-xs text-gray-600">Description text</p>
                      </div>
                    </div>
                  </div>
                </DialogContent>
                <DialogFooter>
                  <CopilotButton variant="ghost" onClick={() => setDialog2xlOpen(false)}>
                    Back
                  </CopilotButton>
                  <CopilotButton variant="secondary" onClick={() => setDialog2xlOpen(false)}>
                    Cancel
                  </CopilotButton>
                  <CopilotButton variant="primary" onClick={() => setDialog2xlOpen(false)}>
                    Done
                  </CopilotButton>
                </DialogFooter>
              </Dialog>

              <Dialog isOpen={dialog4xlOpen} onClose={() => setDialog4xlOpen(false)} maxWidth="4xl" maxHeight="90vh">
                <DialogHeader onClose={() => setDialog4xlOpen(false)}>
                  <DialogTitle>4XL Dialog — Large Content</DialogTitle>
                </DialogHeader>
                <DialogContent>
                  <p className="text-sm text-gray-600 mb-4">
                    This is a 4XL dialog (max-w-4xl, max-h-90vh). Best for editors, instruction panes, or other long-form content.
                  </p>
                  <div className="h-64 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 text-sm">
                    Long-form content area
                  </div>
                </DialogContent>
                <DialogFooter>
                  <CopilotButton variant="ghost" onClick={() => setDialog4xlOpen(false)}>Cancel</CopilotButton>
                  <CopilotButton variant="primary" onClick={() => setDialog4xlOpen(false)}>Done</CopilotButton>
                </DialogFooter>
              </Dialog>

              <Dialog isOpen={dialog5xlOpen} onClose={() => setDialog5xlOpen(false)} maxWidth="5xl">
                <DialogHeader onClose={() => setDialog5xlOpen(false)}>
                  <DialogTitle>5XL Dialog — Wide Layout</DialogTitle>
                </DialogHeader>
                <DialogContent>
                  <p className="text-sm text-gray-600 mb-4">
                    This is a 5XL dialog (max-w-5xl, 1024px). Use for wide multi-column layouts.
                  </p>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h4 className="font-semibold text-sm mb-2 text-gray-700">Left column</h4>
                      <p className="text-xs text-gray-500">Contextual content or navigation</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h4 className="font-semibold text-sm mb-2 text-gray-700">Center column</h4>
                      <p className="text-xs text-gray-500">Primary content area</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h4 className="font-semibold text-sm mb-2 text-gray-700">Right column</h4>
                      <p className="text-xs text-gray-500">Secondary content or details</p>
                    </div>
                  </div>
                </DialogContent>
                <DialogFooter>
                  <CopilotButton variant="secondary" onClick={() => setDialog5xlOpen(false)}>
                    Close
                  </CopilotButton>
                </DialogFooter>
              </Dialog>
            </section>}

            {visibleSectionIds.has('delete-dialog') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">DeleteConfirmDialog</h2>
              <p className="text-sm text-gray-500 mb-6">Confirmation dialog for destructive delete actions</p>

              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Variants</h3>
                  <div className="flex flex-wrap gap-3">
                    <CopilotButton variant="secondary" onClick={() => setDeleteDialogOpen(true)}>
                      Delete Agent
                    </CopilotButton>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600">
                    <strong>Props:</strong> isOpen, onClose, onConfirm, itemName?, itemType? ('agent' | 'workflow' | 'all'), title?, message?
                  </p>
                </div>
              </div>

              <DeleteConfirmDialog
                isOpen={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                onConfirm={() => setDeleteDialogOpen(false)}
                itemName="Customer Service Agent"
                itemType="agent"
              />
            </section>}

            {visibleSectionIds.has('publish-agent-dialog') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">PublishAgentDialog</h2>
              <p className="text-sm text-gray-500 mb-6">Full-width modal for publishing agents — shows version, available channels (M365 Copilot + Teams), and an optional description field</p>

              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">First publish (v1)</h3>
                  <CopilotButton variant="secondary" onClick={() => { setPublishAgentDialogVersion('1'); setPublishAgentDialogOpen(true); }}>
                    Open — Publish v1
                  </CopilotButton>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Re-publish (v2)</h3>
                  <CopilotButton variant="secondary" onClick={() => { setPublishAgentDialogVersion('2'); setPublishAgentDialogOpen(true); }}>
                    Open — Publish v2
                  </CopilotButton>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600">
                    <strong>Props:</strong> isOpen, onClose, onConfirm(description: string), agentName, version (integer string — "1", "2", etc.)
                  </p>
                </div>
              </div>

              <PublishAgentDialog
                isOpen={publishAgentDialogOpen}
                onClose={() => setPublishAgentDialogOpen(false)}
                onConfirm={() => setPublishAgentDialogOpen(false)}
                agentName="Customer Service Agent"
                version={publishAgentDialogVersion}
              />
            </section>}

            {visibleSectionIds.has('share-dialog') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">ShareDialog</h2>
              <p className="text-sm text-gray-500 mb-6">Popover for sharing agents with a copy-link field and permission controls</p>

              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Interactive Demo</h3>
                  <div ref={shareButtonRef}>
                    <CopilotButton variant="secondary" onClick={() => setShareDialogOpen(true)}>
                      Share Agent
                    </CopilotButton>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600">
                    <strong>Props:</strong> isOpen, onClose, agentName, agentType, shareUrl, buttonRef
                  </p>
                </div>
              </div>

              <ShareDialog
                isOpen={shareDialogOpen}
                onClose={() => setShareDialogOpen(false)}
                agentName="Customer Service Agent"
                shareUrl="https://copilotstudio.microsoft.com/agents/share/abc123"
                buttonRef={shareButtonRef}
              />
            </section>}

            {visibleSectionIds.has('unsaved-changes-dialog') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">UnsavedChangesDialog</h2>
              <p className="text-sm text-gray-500 mb-6">Confirmation dialog shown when switching agents with unsaved changes. Offers Cancel, Discard, and Save and leave actions.</p>

              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Interactive Demo</h3>
                  <CopilotButton variant="secondary" onClick={() => setUnsavedDialogOpen(true)}>
                    Open Unsaved Changes Dialog
                  </CopilotButton>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600">
                    <strong>Props:</strong> isOpen, onClose, onDiscard, onSaveAndLeave
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    <strong>Actions:</strong> Cancel (close), Discard (discard changes and leave), Save and leave (persist then leave)
                  </p>
                </div>
              </div>

              <UnsavedChangesDialog
                isOpen={unsavedDialogOpen}
                onClose={() => setUnsavedDialogOpen(false)}
                onDiscard={() => setUnsavedDialogOpen(false)}
                onSaveAndLeave={() => setUnsavedDialogOpen(false)}
              />
            </section>}

            {visibleSectionIds.has('toast') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">CopilotToast</h2>
              <p className="text-sm text-gray-500 mb-8">Toast notifications for transient feedback. Five semantic variants (success, error, warning, info, progress) with auto-dismiss (default 4s), optional message body, optional action button, and close button. Progress toasts show an indeterminate spinner or determinate bar, auto-dismiss 2s after reaching 100%. Toasts stack top-right and are capped at 5. Use <code>useToast().addToast()</code> and <code>useToast().updateToast()</code> anywhere in the app. Layout follows Fluent UI Toast anatomy: icon + title + optional action (right-aligned in the title row) + dismiss; message body renders below the title row.</p>

              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-1">Variants</h3>
                <p className="text-xs text-gray-500 mb-4">Click to fire a live toast (top-right of screen)</p>
                <ToastShowcaseDemo />
              </div>

              <hr className="my-8 border-[#E0E0E0]" />

              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-1">Static preview</h3>
                <p className="text-xs text-gray-500 mb-4">Non-interactive previews of each variant</p>
                <div className="flex flex-col gap-2 max-w-xs">
                  <CopilotToast toast={{ id: '1', variant: 'success', title: 'Agent published', message: 'Your agent is now live and accessible.', duration: 0 }} onDismiss={() => {}} />
                  <CopilotToast toast={{ id: '2', variant: 'error', title: 'Something went wrong', message: 'Could not save changes. Please try again.', duration: 0 }} onDismiss={() => {}} />
                  <CopilotToast toast={{ id: '3', variant: 'warning', title: 'Unsaved changes', message: 'You have unsaved changes that will be lost.', duration: 0 }} onDismiss={() => {}} />
                  <CopilotToast toast={{ id: '4', variant: 'info', title: 'New version available', message: 'Refresh to get the latest features.', duration: 0 }} onDismiss={() => {}} />
                  <CopilotToast toast={{ id: '5p', variant: 'progress', title: 'Uploading file…', progressLabel: 'Uploading… 65%', progress: 65, duration: 0 }} onDismiss={() => {}} />
                  <CopilotToast toast={{ id: '6p', variant: 'progress', title: 'Syncing knowledge…', message: 'This may take a moment', duration: 0 }} onDismiss={() => {}} />
                  <CopilotToast toast={{ id: '7p', variant: 'progress', title: 'Upload complete', progress: 100, duration: 0 }} onDismiss={() => {}} />
                </div>
              </div>

              <hr className="my-8 border-[#E0E0E0]" />

              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-1">With action button</h3>
                <p className="text-xs text-gray-500 mb-4">Optional action that dismisses the toast on click</p>
                <div className="max-w-xs">
                  <CopilotToast
                    toast={{ id: '5', variant: 'info', title: 'Update available', message: 'A new version of this agent is ready.', duration: 0, action: { label: 'Refresh', onClick: () => {} } }}
                    onDismiss={() => {}}
                  />
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('notification-popover') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">NotificationPopover</h2>
              <p className="text-sm text-gray-500 mb-8">Bell icon dropdown that shows the notification history from <code>useToast()</code>. Unread count shown as a red badge dot. Opens as a popover anchored to the bell button. Enabled via the "New Notifications" feature flag.</p>
              <NotificationPopoverShowcaseDemo />
            </section>}

            {visibleSectionIds.has('icon-picker-dialog') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">IconPickerDialog</h2>
              <p className="text-sm text-gray-500 mb-6">M365 Copilot-style icon picker with Generate (AI SVG generation), Browse (Colored + Filled sub-tabs with background colors), and Upload (PNG drag/drop) tabs. The dialog defaults to the Colored sub-tab when opened, uses a fixed 600px height to prevent layout jank, and replaces animated scrollIntoView with custom container-relative scrolling.</p>
              <CopilotButton variant="secondary" onClick={() => setIconPickerOpen(true)}>Open Icon Picker</CopilotButton>
              <IconPickerDialog
                isOpen={iconPickerOpen}
                onClose={() => setIconPickerOpen(false)}
                currentIconKey={iconPickerKey}
                currentGradientKey={iconPickerGradient}
                agentName="My Workflow"
                agentDescription="An automation workflow for processing requests"
                onSelect={(iconKey, gradientKey) => { setIconPickerKey(iconKey); setIconPickerGradient(gradientKey); setIconPickerOpen(false); }}
              />
            </section>}

            {visibleSectionIds.has('tooltip') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">CopilotTooltip <span className="text-base font-normal text-gray-400">(Fluent v9)</span></h2>
              <p className="text-sm text-gray-500 mb-6">Fluent v9 Tooltip with built-in positioning engine. Default show delay is 250ms (shorter than Fluent's 500ms default for faster feedback). Supports className passthrough and placement mapping to Fluent positioning shorthands.</p>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Appearance</h3>
                  <div className="flex items-center gap-6 py-4">
                    <CopilotTooltip content="Dark tooltip (default)" placement="top">
                      <CopilotButton variant="secondary" size="sm">Inverted (default)</CopilotButton>
                    </CopilotTooltip>
                    <CopilotTooltip content="Light tooltip with border" placement="top" appearance="normal">
                      <CopilotButton variant="secondary" size="sm">Normal (light)</CopilotButton>
                    </CopilotTooltip>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Placement</h3>
                  <div className="flex items-center gap-6 py-4">
                    <CopilotTooltip content="Tooltip on top" placement="top">
                      <CopilotButton variant="secondary" size="sm">Top</CopilotButton>
                    </CopilotTooltip>
                    <CopilotTooltip content="Tooltip on bottom" placement="bottom">
                      <CopilotButton variant="secondary" size="sm">Bottom</CopilotButton>
                    </CopilotTooltip>
                    <CopilotTooltip content="Tooltip on left" placement="left">
                      <CopilotButton variant="secondary" size="sm">Left</CopilotButton>
                    </CopilotTooltip>
                    <CopilotTooltip content="Tooltip on right" placement="right">
                      <CopilotButton variant="secondary" size="sm">Right</CopilotButton>
                    </CopilotTooltip>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Delay</h3>
                  <div className="flex items-center gap-6">
                    <CopilotTooltip content="Default 250ms delay" placement="top">
                      <CopilotButton variant="secondary" size="sm">Default (250ms)</CopilotButton>
                    </CopilotTooltip>
                    <CopilotTooltip content="Delayed tooltip (500ms)" placement="top" delay={500}>
                      <CopilotButton variant="secondary" size="sm">Custom (500ms)</CopilotButton>
                    </CopilotTooltip>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">JSX content (multi-line)</h3>
                  <CopilotTooltip content={<>File A.docx<br />File B.xlsx<br />File C.pdf</>} placement="top" appearance="normal">
                    <CopilotButton variant="secondary" size="sm">Multi-line (ReactNode)</CopilotButton>
                  </CopilotTooltip>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Disabled</h3>
                  <CopilotTooltip content="You won't see this" placement="top" disabled>
                    <CopilotButton variant="secondary" size="sm">Disabled tooltip</CopilotButton>
                  </CopilotTooltip>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Point to Ask context (<code className="text-xs bg-gray-100 px-1 py-0.5 rounded">askContext</code> prop)</h3>
                  <p className="text-xs text-gray-500 mb-3">
                    The <code className="bg-gray-100 px-1 py-0.5 rounded">askContext</code> prop injects a <code className="bg-gray-100 px-1 py-0.5 rounded">data-ask-context</code> attribute onto the child element. Point to Ask reads this attribute to provide richer explanations to the LLM. Without <code className="bg-gray-100 px-1 py-0.5 rounded">askContext</code>, the tooltip <code className="bg-gray-100 px-1 py-0.5 rounded">content</code> string is used as fallback.
                  </p>
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center gap-1">
                      <CopilotTooltip content="Save" placement="top">
                        <CopilotButton variant="secondary" size="sm">Basic (content only)</CopilotButton>
                      </CopilotTooltip>
                      <span className="text-xs text-gray-400">data-ask-context = &quot;Save&quot;</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <CopilotTooltip content="Save" placement="top" askContext="Save — Persists all unsaved changes for the current agent configuration to local storage. This includes instructions, components, model selection, and metadata.">
                        <CopilotButton variant="secondary" size="sm">Rich (askContext)</CopilotButton>
                      </CopilotTooltip>
                      <span className="text-xs text-gray-400">data-ask-context = &quot;Save — Persists all unsaved...&quot;</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('status') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">StatusIcon & LatencyLoader</h2>
              <p className="text-sm text-gray-500 mb-6">Status indicators for task states</p>

              <div className="flex flex-wrap items-center gap-8 mb-6">
                <div className="flex items-center gap-2">
                  <StatusIcon status="pending" />
                  <span className="text-sm text-gray-600">Pending</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon status="in-progress" />
                  <span className="text-sm text-gray-600">In Progress</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon status="completed" />
                  <span className="text-sm text-gray-600">Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon status="warning" />
                  <span className="text-sm text-gray-600">Warning</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon status="error" />
                  <span className="text-sm text-gray-600">Error</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <LatencyLoader />
                <span className="text-sm text-gray-600">Processing...</span>
              </div>
            </section>}

            {visibleSectionIds.has('loader-canvas') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">LoaderCanvas</h2>
              <p className="text-sm text-gray-500 mb-6">Full-canvas loading state shown while an agent is being created. Displays an animated GIF centered in the canvas and cycles through 14 phrases with a typewriter effect and fade-out between cycles. Activated in <code>BuildPage</code> when plan mode is off and no assistant reply has arrived yet.</p>
              <div className="border border-[#E0E0E0] rounded-lg overflow-hidden" style={{ height: 320 }}>
                <LoaderCanvas />
              </div>
            </section>}

            {visibleSectionIds.has('chat') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Chat Components</h2>
              <p className="text-sm text-gray-500 mb-6">Copilot-style conversation UI components. The message content div (not the outer wrapper) animates in with <code>animate-slide-up-fade</code>; the agent name row stays stable. Content uses <code>mt-4</code> spacing below the header and <code>space-y-4</code> between paragraphs.</p>

              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-700 mb-3">User Message</h3>
                <div className="max-w-2xl">
                  <CopilotMessage
                    role="user"
                    content="Can you help me create a new agent?"
                  />
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-700 mb-3">User Message with Attached Files</h3>
                <div className="max-w-2xl">
                  <CopilotMessage
                    role="user"
                    content="Here's the process doc I mentioned."
                    attachedFiles={[
                      new File([''], 'onboarding-process.pdf', { type: 'application/pdf' }),
                      new File([''], 'team-diagram.png', { type: 'image/png' }),
                    ]}
                  />
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Assistant Message</h3>
                <div className="max-w-2xl">
                  <CopilotMessage
                    role="assistant"
                    content="I'd be happy to help you create an agent! What capabilities would you like it to have?"
                    agentName="Copilot"
                  />
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Bullet and Numbered List Rendering</h3>
                <div className="max-w-2xl">
                  <CopilotMessage
                    role="assistant"
                    content={"Here are some things to consider:\n\n• First bullet point\n• Second bullet point\n• Third bullet point\n\n1. First numbered step\n2. Second numbered step\n3. Third numbered step"}
                    agentName="Copilot"
                    skipEntranceAnimation
                  />
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Skip Entrance Animation</h3>
                <p className="text-xs text-gray-400 mb-3">No entrance animation (e.g. for already-visible messages)</p>
                <div className="max-w-2xl">
                  <CopilotMessage
                    role="assistant"
                    content="This message renders immediately without the slide-up-fade entrance animation."
                    agentName="Copilot"
                    skipEntranceAnimation
                  />
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Thinking State (isThinking)</h3>
                <p className="text-xs text-gray-400 mb-3">Shows a <code>LatencyLoader</code> spinner with text below the message content. Default text is "Thinking..."; override with the <code>thinkingText</code> prop.</p>
                <div className="max-w-2xl space-y-6">
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Default thinking text</p>
                    <CopilotMessage
                      role="assistant"
                      content="Let me look into that for you."
                      agentName="Copilot"
                      skipEntranceAnimation
                      isThinking
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Custom thinkingText</p>
                    <CopilotMessage
                      role="assistant"
                      content="Searching across your knowledge sources..."
                      agentName="Copilot"
                      skipEntranceAnimation
                      isThinking
                      thinkingText="Searching SharePoint..."
                    />
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Publish Checklist Blocks</h3>
                <p className="text-xs text-gray-400 mb-3">Structured check results rendered via <code>metadata.publishBlocks</code>. Each block shows a Fluent status icon, label, and optional summary/issues. An optional <code>block.note</code> string renders anchored to that specific block (muted italic). An optional <code>metadata.publishOutcome</code> string is rendered below all blocks — split on <code>\n\n</code> into paragraphs.</p>
                <div className="max-w-2xl space-y-6">
                  <div>
                    <p className="text-xs text-gray-500 mb-2">All checks passed + success outcome</p>
                    <CopilotMessage
                      role="assistant"
                      content="I'll run through a few checks before publishing."
                      agentName="Copilot"
                      skipEntranceAnimation
                      metadata={{
                        publishBlocks: [
                          { status: 'passed', label: 'Agent Setup', summary: 'Name, description, and instructions are configured.' },
                          { status: 'passed', label: 'Test Results', summary: 'All test scenarios passing.' },
                          { status: 'passed', label: 'Deployment & Apps', summary: 'Deployment channel configured.' },
                          { status: 'passed', label: 'Security & Policy', summary: 'All policies satisfied.' },
                        ],
                        publishOutcome: 'Your agent **Sales Assistant** has been published successfully! 🎉',
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Warning + passed mix</p>
                    <CopilotMessage
                      role="assistant"
                      content="I'll run through a few checks before publishing."
                      agentName="Copilot"
                      skipEntranceAnimation
                      metadata={{
                        publishBlocks: [
                          { status: 'passed', label: 'Agent Setup', summary: 'Name, description, and instructions are configured.' },
                          { status: 'warning', label: 'Test Results', summary: 'No test scenarios have been run yet.' },
                          { status: 'passed', label: 'Deployment & Apps' },
                          { status: 'passed', label: 'Security & Policy' },
                        ],
                        publishOutcome: 'Your agent **Sales Assistant** has been published successfully! 🎉',
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Blocking failure with issues</p>
                    <CopilotMessage
                      role="assistant"
                      content="I'll run through a few checks before publishing."
                      agentName="Copilot"
                      skipEntranceAnimation
                      metadata={{
                        publishBlocks: [
                          { status: 'passed', label: 'Agent Setup', summary: 'Name, description, and instructions are configured.' },
                          { status: 'failed', label: 'Test Results', summary: '2 failing test scenarios.', issues: ['Scenario "Password reset" failed', 'Scenario "Account lockout" timed out'], note: 'Skipping eval — continuing with the remaining checks.' },
                        ],
                        publishOutcome: 'I found issues that need to be resolved before publishing.\n\nWould you like help fixing these?',
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-2">In-progress with LatencyLoader</p>
                    <CopilotMessage
                      role="assistant"
                      content="I'll run through a few checks before publishing."
                      agentName="Copilot"
                      skipEntranceAnimation
                      isThinking
                      thinkingText="Test Results..."
                      metadata={{
                        publishBlocks: [
                          { status: 'passed', label: 'Agent Setup', summary: 'Name, description, and instructions are configured.' },
                        ],
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Typing Indicator</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Default shows "Thinking…". Use <code className="bg-gray-100 px-1 rounded">messages</code> to cycle through
                  multiple status lines (rotates every <code className="bg-gray-100 px-1 rounded">interval</code> ms, default 3000).
                  Cycling stops on the last message.
                </p>
                <div className="max-w-2xl space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Default</p>
                    <CopilotTypingIndicator agentName="Copilot" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Custom text</p>
                    <CopilotTypingIndicator agentName="Copilot" text="Analyzing results…" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Cycling messages (interval=2000)</p>
                    <CopilotTypingIndicator agentName="Copilot" messages={['Checking agent setup…', 'Running validations…', 'Almost done…']} interval={2000} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Compact size</p>
                    <CopilotTypingIndicator agentName="Copilot" size="compact" messages={['Step 1 of 3…', 'Step 2 of 3…', 'Step 3 of 3…']} interval={2000} />
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Eval Mode Feedback</h3>
                <p className="text-xs text-gray-400 mb-3">Thumbs up/down buttons shown below assistant messages when <code>showFeedback</code> is true (gated behind Eval Mode toggle). Clicking a thumb opens an inline comment box; re-clicking the same thumb cancels. Pass <code>onFeedbackSubmit</code> to receive the rating + comment.</p>
                <div className="max-w-2xl space-y-6">
                  <div>
                    <p className="text-xs text-gray-500 mb-2">No rating selected</p>
                    <CopilotMessage
                      role="assistant"
                      content="Here's what I found for you."
                      agentName="Copilot"
                      skipEntranceAnimation
                      showFeedback
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Thumbs up clicked — comment box open</p>
                    <ShowcaseFeedbackUp />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Thumbs down clicked — comment box open</p>
                    <ShowcaseFeedbackDown />
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Component pills [[type:name]] and links [text](url)</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Use <code>[[connector:Name]]</code>, <code>[[topic:Name]]</code>, <code>[[skill:Name]]</code>, <code>[[flow:Name]]</code> to render clickable inline component pills (navigate to Build page detail). Pass <code>onPillClick</code> to handle the click. <code>[[knowledge:Name]]</code> renders as <strong>bold text</strong> only — knowledge sources have no individual detail page.
                </p>
                <div className="max-w-xl">
                  <CopilotMessage
                    role="assistant"
                    agentName="Copilot Studio"
                    skipEntranceAnimation
                    onPillClick={(type, name) => alert(`Navigate to build: ${type} "${name}"`)}
                    content={`The **Knowledge search** step failed because the source is pending approval.\n\nTo fix this:\n1. Expedite sponsor sign-off for the knowledge source\n2. Or add a fallback using [[topic:Fallback Handler]] to catch this error\n3. You can also route via [[connector:Office365 - Send an email (V2)]] to notify the document owner\n\nLearn more: [Configuring knowledge sources](https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-add-existing-copilot)`}
                  />
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Chain of Thought</h3>
                <div className="max-w-2xl">
                  <ChainOfThought progressMessage="Analyzing your request..." progressState="loading">
                    <ChainOfThoughtItem headerText="Understanding the query" status="completed">
                      Parsed user intent
                    </ChainOfThoughtItem>
                    <ChainOfThoughtItem headerText="Generating response" status="in-progress" active>
                      Synthesizing information
                    </ChainOfThoughtItem>
                    <ChainOfThoughtItem headerText="Formatting output" status="pending" />
                  </ChainOfThought>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Progress Timeline</h3>
                <div className="max-w-md">
                  <ProgressTimeline
                    items={[
                      { id: '1', label: 'Initialize project', status: 'completed' },
                      { id: '2', label: 'Install dependencies', status: 'completed' },
                      { id: '3', label: 'Configure settings', status: 'in-progress' },
                      { id: '4', label: 'Run tests', status: 'pending' },
                    ]}
                  />
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('skill-preview-card') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">SkillPreviewCard</h2>
              <p className="text-sm text-gray-500 mb-6">Rendered inside a <code>CopilotMessage</code> when <code>metadata.type === 'skill-preview'</code>. Shows a SKILL.md code preview, a download icon button, and an optional footer with tools, knowledge sources, and scripts chips.</p>

              <div className="mb-8 max-w-2xl">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Basic skill (no footer)</h3>
                <CopilotMessage
                  role="assistant"
                  agentName="Copilot"
                  skipEntranceAnimation
                  content=""
                  metadata={{
                    type: 'skill-preview',
                    skill: {
                      id: 'skill-basic',
                      name: 'send-welcome-email',
                      description: 'Sends a personalised welcome email to new users.',
                      body: '## Steps\n• Retrieve user details\n• Compose email from template\n• Send via email connector',
                    },
                  }}
                />
              </div>

              <div className="mb-8 max-w-2xl">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Skill with tools, knowledge sources, and scripts</h3>
                <CopilotMessage
                  role="assistant"
                  agentName="Copilot"
                  skipEntranceAnimation
                  content=""
                  metadata={{
                    type: 'skill-preview',
                    skill: {
                      id: 'skill-full',
                      name: 'process-lead-scoring',
                      description: 'Scores inbound leads and routes high-value ones to sales.',
                      body: '## Steps\n• Fetch lead from CRM\n• Run scoring script\n• Route based on score',
                      tools: ['Salesforce', 'SendGrid'],
                      knowledgeSources: ['ICP Definition', 'Scoring Rubric'],
                      scripts: [
                        { name: 'scripts/score_lead.py', content: '# Lead scoring logic\ndef score(lead): ...' },
                      ],
                    },
                  }}
                />
              </div>
            </section>}


            {visibleSectionIds.has('chat-suggestions') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">ChatSuggestions</h2>
              <p className="text-sm text-gray-500 mb-6">Left-aligned horizontal list of clickable suggestion pills shown above the chat input. Supports sm/md/lg sizes and disabled state. Suggestions longer than 60 characters are truncated with an ellipsis.</p>
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Default (md)</p>
                  <ChatSuggestions suggestions={['Run an E2E test', 'Why did my agent respond this way?', 'How can I improve this response?']} onSelect={() => {}} />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Size sm</p>
                  <ChatSuggestions suggestions={['Proactively guide me', 'Show details', 'Cancel']} onSelect={() => {}} size="sm" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Disabled (isProcessing)</p>
                  <ChatSuggestions suggestions={['Run an E2E test', 'Show details']} onSelect={() => {}} isProcessing />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Long suggestions (truncated at 60 chars)</p>
                  <ChatSuggestions suggestions={['Short one', 'This is a much longer suggestion that exceeds sixty characters and will be truncated', 'Another really long suggestion text that should also be truncated with an ellipsis']} onSelect={() => {}} />
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('skill-suggest-card') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Skill Suggest Card</h2>
              <p className="text-sm text-gray-500 mb-6"><code>DASkillSuggestCard</code> is shown when the helper agent proactively detects a skill opportunity and asks the user if they want to package capabilities as a reusable skill. The unified <code>SkillPreviewCard</code> is used for all agents — it shows a collapsible "View/Hide technical details" toggle that reveals the full SKILL.md content.</p>

              <div className="mb-8 max-w-2xl">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Skill suggestion prompt (proactive)</h3>
                <CopilotMessage
                  role="assistant"
                  agentName="Copilot"
                  skipEntranceAnimation
                  content="Looks like this agent handles employee onboarding across HR, IT, and Facilities."
                  metadata={{ type: 'da-skill-suggest' }}
                  onSendMessage={() => {}}
                />
              </div>

              <div className="mb-8 max-w-2xl">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Skill preview — collapsible technical details (collapsed by default)</h3>
                <CopilotMessage
                  role="assistant"
                  agentName="Copilot"
                  skipEntranceAnimation
                  content="I've packaged the onboarding steps into a reusable skill. It connects to your HR system, IT ticketing, and the approval flow you already have in place — so any agent using this skill gets all of that automatically."
                  metadata={{
                    type: 'skill-preview',
                    skill: {
                      id: 'da-skill-1',
                      name: 'employee-onboarding',
                      description: 'Handles new hire onboarding across HR, IT, and Facilities.',
                      body: '',
                      m365Capabilities: ['People', 'Code Interpreter'],
                      connectors: [{ name: 'Workday', proposed: false }],
                      powerPlatformConnectors: [{ name: 'ServiceNow IT', proposed: false }],
                      flows: [{ name: 'New hire approval flow', proposed: false }],
                      topics: [{ name: 'get-employee-id', proposed: false }],
                      knowledgeSources: ['https://contoso.sharepoint.com/sites/HR/Onboarding'],
                      createdAt: new Date(),
                    },
                  }}
                />
              </div>

              <div className="mb-8 max-w-2xl">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Skill preview — expand to see technical details</h3>
                <CopilotMessage
                  role="assistant"
                  agentName="Copilot"
                  skipEntranceAnimation
                  content="Done — the vacation policy skill is ready. It handles time-off questions and routes approval requests through the existing flow. A couple of connectors are flagged as proposed since they haven't been added to your environment yet."
                  metadata={{
                    type: 'skill-preview',
                    skill: {
                      id: 'da-skill-2',
                      name: 'vacation-policy-faq',
                      description: 'Answers vacation policy questions and submits time-off requests.',
                      body: '',
                      m365Capabilities: ['People'],
                      connectors: [{ name: 'ADP', proposed: true }],
                      powerPlatformConnectors: [{ name: 'Workday HCM', proposed: false }],
                      flows: [{ name: 'Time-off approval flow', proposed: true }],
                      topics: [{ name: 'get-employee-id', proposed: false }],
                      knowledgeSources: ['https://contoso.sharepoint.com/sites/HR/Policies'],
                      createdAt: new Date(),
                    },
                  }}
                />
              </div>
            </section>}


            {visibleSectionIds.has('chat-input') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">CopilotChatInput</h2>
              <p className="text-sm text-gray-500 mb-6">Copilot-style input bar with toolbar, animated typewriter placeholder, AI-powered autocomplete dropdown, and prompt history. Pass <code>onFilesAdded</code> to enable the <code>+</code> button file-attach menu (opens a <code>CopilotMenu</code> with Attach file / Add image options; closes the suggestion dropdown automatically).</p>

              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Default</h3>
                  <p className="text-xs text-gray-500 mb-3">Basic input with static placeholder and send button.</p>
                  <div className="max-w-2xl rounded-lg overflow-hidden">
                    <CopilotChatInput
                      value={chatInput}
                      onChange={setChatInput}
                      onSend={() => {
                        alert(`You typed: ${chatInput}`);
                        setChatInput('');
                      }}
                      placeholder="Ask me anything..."
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Animated typewriter placeholder (uncontrolled)</h3>
                  <p className="text-xs text-gray-500 mb-3">Pass <code>animatedPlaceholders</code> to cycle through prompts automatically. The caret hides when the animation is running and reappears on focus.</p>
                  <div className="max-w-2xl rounded-lg overflow-hidden">
                    <CopilotChatInput
                      value=""
                      onChange={() => {}}
                      onSend={() => {}}
                      shadow="dropdown"
                      rows={2}
                      sendIcon="right"
                      animatedPlaceholders={[
                        "I want first-line customer questions handled automatically",
                        "I want new hires guided through their first week step by step",
                        "I want my sales team instantly prepped for every customer call",
                      ]}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Featured prompts dropdown (zero-state)</h3>
                  <p className="text-xs text-gray-500 mb-3">When <code>featuredPrompts</code> is provided, focusing the empty input opens a dropdown with 6 shuffled suggestions. The currently-animating placeholder is pinned at position 0. Navigate with ArrowUp/Down, select with Enter, dismiss with Escape.</p>
                  <div className="max-w-2xl rounded-lg overflow-hidden">
                    <CopilotChatInput
                      value=""
                      onChange={() => {}}
                      onSend={() => {}}
                      shadow="dropdown"
                      rows={2}
                      sendIcon="right"
                      animatedPlaceholders={[
                        "I want approvals routed and tracked automatically",
                        "I want meeting notes turned into action items automatically",
                        "I want employees to get instant answers to common questions",
                      ]}
                      featuredPrompts={[
                        "I want first-line customer questions handled automatically without my team doing it manually",
                        "I want new hires guided through their first week with tasks and answers, step by step",
                        "I want my sales team instantly prepped for every customer call with the right context",
                        "I want approvals routed and tracked automatically so nothing sits waiting on someone's desk",
                        "I want meeting notes turned into assigned action items and sent to the team automatically",
                        "I want employees to get instant answers to common questions without waiting on anyone",
                        "I want support tickets routed to the right team without anyone doing it manually",
                        "I want expense reports filed automatically when receipts are submitted",
                      ]}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Focus this input to see the zero-state dropdown with randomised suggestions.</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">AI autocomplete — typing mode</h3>
                  <p className="text-xs text-gray-500 mb-3">When the user types, AI-generated completions replace the featured prompts. Results are debounced (250ms), cached by prefix, and merged without reordering (<code>stableMerge</code>). The typed portion is bolded via <code>highlightMatch</code>. Stale responses for shorter queries are suppressed.</p>
                  <div className="max-w-2xl rounded-lg overflow-hidden">
                    <CopilotChatInput
                      value={chatInput}
                      onChange={setChatInput}
                      onSend={() => setChatInput('')}
                      shadow="dropdown"
                      rows={2}
                      sendIcon="right"
                      featuredPrompts={[
                        "I want first-line customer questions handled automatically without my team doing it manually",
                        "I want new hires guided through their first week with tasks and answers, step by step",
                        "I want my sales team instantly prepped for every customer call with the right context",
                        "I want approvals routed and tracked automatically so nothing sits waiting on someone's desk",
                        "I want meeting notes turned into assigned action items and sent to the team automatically",
                        "I want employees to get instant answers to common questions without waiting on anyone",
                      ]}
                      placeholder="Start typing to see AI completions..."
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Type "I want" to see AI-generated completions with the typed prefix bolded.</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Send icon variants</h3>
                  <p className="text-xs text-gray-500 mb-3"><code>sendIcon="up"</code> (default) and <code>sendIcon="right"</code>.</p>
                  <div className="flex gap-4 max-w-2xl">
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 mb-2">sendIcon="up" (default)</p>
                      <CopilotChatInput value="Hello" onChange={() => {}} onSend={() => {}} sendIcon="up" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 mb-2">sendIcon="right"</p>
                      <CopilotChatInput value="Hello" onChange={() => {}} onSend={() => {}} sendIcon="right" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">With file pills (uploadedFiles + onRemoveFile)</h3>
                  <p className="text-xs text-gray-500 mb-3">File attachments render as removable pills above the textarea.</p>
                  <div className="max-w-2xl rounded-lg overflow-hidden">
                    <CopilotChatInput
                      value=""
                      onChange={() => {}}
                      onSend={() => {}}
                      placeholder="Describe the challenge you're facing..."
                      shadow="dropdown"
                      rows={2}
                      sendIcon="right"
                      uploadedFiles={[
                        new File([''], 'process-doc.pdf', { type: 'application/pdf' }),
                        new File([''], 'diagram.png', { type: 'image/png' }),
                      ]}
                      onRemoveFile={() => {}}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">File attach menu (onFilesAdded + button)</h3>
                  <p className="text-xs text-gray-500 mb-3">Pass <code>onFilesAdded</code> to activate the <code>+</code> toolbar button. Clicking it opens a <code>CopilotMenu</code> with <strong>Attach file</strong> (accepts all types) and <strong>Add image</strong> (accepts <code>image/*</code>). The suggestion dropdown closes automatically when the menu opens.</p>
                  <div className="max-w-2xl rounded-lg overflow-hidden">
                    <CopilotChatInput
                      value=""
                      onChange={() => {}}
                      onSend={() => {}}
                      onFilesAdded={(files) => alert(`${files.length} file(s) selected: ${files.map(f => f.name).join(', ')}`)}
                      placeholder="Click the + button to attach files..."
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Click the + button to open the attach menu and select files.</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Shadow variants</h3>
                  <p className="text-xs text-gray-500 mb-3"><code>shadow</code> accepts <code>"input"</code> (default), <code>"dropdown"</code>, <code>"md"</code>, or <code>"none"</code>.</p>
                  <div className="grid grid-cols-2 gap-4 max-w-2xl">
                    {(['input', 'dropdown', 'md', 'none'] as const).map(s => (
                      <div key={s}>
                        <p className="text-xs text-gray-400 mb-2">shadow="{s}"</p>
                        <CopilotChatInput value="" onChange={() => {}} onSend={() => {}} shadow={s} placeholder={`shadow="${s}"`} />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">No suggestions (<code>showSuggestions={false}</code>)</h3>
                  <p className="text-xs text-gray-500 mb-3">Pass <code>showSuggestions={"{false}"}</code> to disable both the suggestion dropdown and the AI fetch that populates it. Use this in contexts like the helper agent pane where suggestions are not relevant.</p>
                  <div className="max-w-2xl rounded-lg overflow-hidden">
                    <CopilotChatInput
                      value=""
                      onChange={() => {}}
                      onSend={() => {}}
                      showSuggestions={false}
                      placeholder="Ask anything..."
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">maxRows — auto-grow up to N lines</h3>
                  <p className="text-xs text-gray-500 mb-3">Pass <code>maxRows</code> to allow the textarea to grow as the user types, up to the specified number of visible lines, then scroll.</p>
                  <div className="max-w-2xl rounded-lg overflow-hidden">
                    <CopilotChatInput
                      value=""
                      onChange={() => {}}
                      onSend={() => {}}
                      showSuggestions={false}
                      maxRows={3}
                      placeholder="Type multiple lines — grows up to 3 rows..."
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">quoteChip — CoT node context pill</h3>
                  <p className="text-xs text-gray-500 mb-3">Pass <code>quoteChip</code> to show a gray rounded pill above the textarea referencing a CoT node. The pill includes the node label and a dismiss button. Used when the user clicks the "Ask Copilot" icon on a CoT node in the Preview page.</p>
                  <div className="max-w-2xl rounded-lg overflow-hidden">
                    <CopilotChatInput
                      value="How do I fix this?"
                      onChange={() => {}}
                      onSend={() => {}}
                      showSuggestions={false}
                      quoteChip={{ label: 'Policy Documents', type: 'knowledge', onDismiss: () => {} }}
                      placeholder="Ask about this step..."
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Project Mode button</h3>
                  <p className="text-xs text-gray-500 mb-3">Pass <code>onProjectModeEnter</code> to show the Project Mode button. Clicking it navigates to the multi-artifact EAA canvas.</p>
                  <div className="max-w-xl">
                    <CopilotChatInput value="" onChange={() => {}} onSend={() => {}} onProjectModeToggle={() => {}} isProjectModeActive={false} />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Point to Ask button</h3>
                  <p className="text-xs text-gray-500 mb-3">Pass <code>onPointToAsk</code> and <code>isPointToAskMode</code> to show the crosshair picker button (helper agent only). Active state uses a filled icon and brand colour.</p>
                  <div className="flex gap-4 max-w-2xl">
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 mb-2">Inactive</p>
                      <CopilotChatInput value="" onChange={() => {}} onSend={() => {}} onPointToAsk={() => {}} isPointToAskMode={false} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 mb-2">Active</p>
                      <CopilotChatInput value="" onChange={() => {}} onSend={() => {}} onPointToAsk={() => {}} isPointToAskMode={true} />
                    </div>
                  </div>
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('disambiguation') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">DisambiguationCard</h2>
              <p className="text-sm text-gray-500 mb-6">Multi-choice questionnaire for clarification. The question and step counter ("Question X of Y") appear on the same row. On option hover an arrow appears (ArrowUp20Filled). Use the <code>borderless</code> prop to remove the outer card border when rendering inside a container.</p>

              <div className="space-y-8">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">DisambiguationCard Variants</h3>
                </div>

                {/* Radio variant (default) */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Radio (default)</h3>
                  <div className="max-w-md">
                    <DisambiguationCard
                      question="Which approach would you like to use?"
                      options={disambiguationOptions}
                      selected={selectedOption}
                      onSelect={setSelectedOption}
                    />
                  </div>
                </div>

                {/* Simple variant — inline step counter */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Simple with inline step counter (hover to see arrow)</h3>
                  <div className="max-w-md">
                    <DisambiguationCard
                      variant="simple"
                      question="What type of agent do you want to build?"
                      options={[
                        { id: 'support', label: 'Customer support agent' },
                        { id: 'internal', label: 'Internal employee assistant' },
                        { id: 'workflow', label: 'Automated workflow' },
                      ]}
                      onSelect={(id) => console.log('Selected:', id)}
                      current={1}
                      total={3}
                    />
                  </div>
                </div>

                {/* Multi-select variant */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Multi-select (checkboxes with submit)</h3>
                  <div className="max-w-md">
                    <DisambiguationCard
                      variant="multi"
                      question="Which channels should your agent support?"
                      options={[
                        { id: 'teams', label: 'Microsoft Teams', description: 'Chat and messaging within Teams' },
                        { id: 'web', label: 'Web chat', description: 'Embedded widget on your website' },
                        { id: 'email', label: 'Email', description: 'Respond to incoming emails' },
                        { id: 'slack', label: 'Slack', description: 'Integrate with Slack workspaces' },
                      ]}
                      onSubmit={(ids) => console.log('Selected:', ids)}
                    />
                  </div>
                </div>

                {/* Borderless variant — for use inside a container */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Borderless (rendered inside a container)</h3>
                  <div className="max-w-md border border-[#E0E0E0] rounded-xl p-5 bg-white">
                    <DisambiguationCard
                      variant="simple"
                      borderless
                      question="What type of automation do you need?"
                      options={[
                        { id: 'agent', label: 'An agent that responds to questions' },
                        { id: 'workflow', label: 'A workflow that runs on a schedule' },
                        { id: 'both', label: 'Both — connected together' },
                      ]}
                      onSelect={(id) => console.log('Selected:', id)}
                      current={2}
                      total={4}
                      showInput={false}
                    />
                  </div>
                </div>

                {/* Interactive navigation example */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">With prev/next navigation buttons</h3>
                  <div className="max-w-md">
                    <DisambiguationNavigationExample />
                  </div>
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('enhanced-input-suggestion') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">EnhancedInputSuggestionList</h2>
              <p className="text-xs text-gray-400 mb-4">Unified suggestion/selection UI for HelperAgent. Three modes: <code>text</code> (quick replies, no indicator), <code>single</code> (immediate single-select), <code>multi</code> (multi-select with Confirm). Items with a description expand to full width; items without hug their text width.</p>
              <EnhancedInputSuggestionDebugPanel />
            </section>}

            {visibleSectionIds.has('workiq-card') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">WorkIQCard</h2>
              <p className="text-sm text-gray-500 mb-6">Work IQ context card — inline in the helper agent chat stream. Four demo states.</p>

              <div className="grid grid-cols-2 gap-8">
                {/* 1 of 9 (default) */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">1 of 9 enabled (default)</h3>
                  <WorkIQCard
                    enabledServers={['M365Copilot MCP Server']}
                    onServersChange={(s) => console.log('[WorkIQ] Servers changed:', s)}
                  />
                </div>

                {/* 4 of 9 */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">4 of 9 enabled</h3>
                  <WorkIQCard
                    enabledServers={['M365Copilot MCP Server', 'Mail MCP Server', 'Calendar MCP Server', 'Teams MCP Server']}
                    onServersChange={(s) => console.log('[WorkIQ] Servers changed:', s)}
                  />
                </div>

                {/* All 9 — shows +5 overflow */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">All 9 enabled (+5 overflow)</h3>
                  <WorkIQCard
                    enabledServers={['Microsoft Admin Center MCP Server','Mail MCP Server','Calendar MCP Server','Word MCP Server','Teams MCP Server','ODSP MCP Server','User Profile MCP Server','M365Copilot MCP Server','SharePoint Lists MCP Server']}
                    onServersChange={(s) => console.log('[WorkIQ] Servers changed:', s)}
                  />
                </div>

                {/* Empty servers */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">0 of 9 enabled</h3>
                  <WorkIQCard
                    enabledServers={[]}
                    onServersChange={(s) => console.log('[WorkIQ] Servers changed:', s)}
                  />
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('plan-message') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">PlanMessage</h2>
              <p className="text-sm text-gray-500 mb-6">Plan card with task list, status indicators, and approval actions for agents and workflows</p>

              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Agent plan</h3>
                  <div className="max-w-[780px]">
                    <PlanMessage
                      plan={{
                        id: 'showcase-plan-1',
                        title: 'IT Help Desk Agent',
                        summary: 'Resolve common IT issues and route complex problems',
                        steps: [
                          { id: '1', action: 'Identify the type of IT issue from user description', status: 'pending' },
                          { id: '2', action: 'Search knowledge base for known solutions', status: 'pending' },
                          { id: '3', action: 'Walk user through troubleshooting steps', status: 'pending' },
                          { id: '4', action: 'Create a ticket if issue is unresolved', status: 'pending' },
                        ],
                        expectedOutcome: 'Employees get fast IT support with common issues resolved instantly and complex ones properly escalated.',
                        status: 'pending_approval',
                        createdAt: new Date(),
                      }}
                      agentType="agent"
                      agentData={{
                        id: 'it-help-1',
                        name: 'IT Help Desk Agent',
                        description: 'Resolve common IT issues and route complex problems',
                        audience: 'employees',
                        channel: 'Microsoft 365',
                      }}
                      onApprove={() => console.log('Approved')}
                      onReject={() => console.log('Rejected')}
                    />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Workflow plan</h3>
                  <div className="max-w-[780px]">
                    <PlanMessage
                      plan={{
                        id: 'showcase-plan-2',
                        title: 'New Hire Onboarding',
                        summary: 'Automate the onboarding checklist for new employees',
                        steps: [
                          { id: '1', action: 'Send welcome email with first-day instructions', status: 'pending' },
                          { id: '2', action: 'Provision accounts in Active Directory and M365', status: 'pending' },
                          { id: '3', action: 'Assign required training modules in LMS', status: 'pending' },
                          { id: '4', action: 'Schedule intro meetings with team leads', status: 'pending' },
                          { id: '5', action: 'Notify manager when onboarding is complete', status: 'pending' },
                        ],
                        expectedOutcome: 'New hires are fully set up on day one with all accounts, training, and meetings in place.',
                        status: 'pending_approval',
                        createdAt: new Date(),
                      }}
                      agentType="workflow"
                      agentData={{
                        id: 'onboarding-1',
                        name: 'New Hire Onboarding',
                        description: 'Automate the onboarding checklist for new employees',
                        channel: 'Microsoft 365',
                      }}
                      onApprove={() => console.log('Approved')}
                      onReject={() => console.log('Rejected')}
                    />
                  </div>
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('chain-of-thought') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">ChainOfThought</h2>
              <p className="text-sm text-gray-500 mb-6">Collapsible reasoning panel showing AI's thinking process with step-by-step items. Each item renders a four-state indicator: green checkmark (completed), animated dot (in-progress / active), red error circle (failed), or empty circle (pending). headerText accepts ReactNode for inline tags. progressState supports loading, finished, and error.</p>

              <div className="space-y-6 max-w-xl">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Loading state</h3>
                  <ChainOfThought progressMessage="Working on it..." progressState="loading" defaultExpanded>
                    <ChainOfThoughtItem headerText="Searching knowledge base" status="completed" />
                    <ChainOfThoughtItem headerText="Analyzing employee records" status="in-progress" active />
                    <ChainOfThoughtItem headerText="Drafting response" status="pending" />
                  </ChainOfThought>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Finished state</h3>
                  <ChainOfThought progressMessage="Done — 3 steps completed" progressState="finished" defaultExpanded>
                    <ChainOfThoughtItem headerText="Searched knowledge base" status="completed" />
                    <ChainOfThoughtItem headerText="Analyzed employee records" status="completed" />
                    <ChainOfThoughtItem headerText="Drafted response" status="completed" />
                  </ChainOfThought>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Error state (failed steps)</h3>
                  <ChainOfThought progressMessage="Didn't complete" progressState="error" defaultExpanded>
                    <ChainOfThoughtItem headerText="Retrieved project data" status="completed" />
                    <ChainOfThoughtItem headerText="Processed scheduling request" status="completed" />
                    <ChainOfThoughtItem headerText={<>SchedulerConnector GetAvailableSlots <span className="ml-1 text-xs bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded font-normal">Sales</span></>} status="failed" defaultExpanded>
                      Connection to the scheduling service failed after 3 retries. The connector returned a 503 error.
                    </ChainOfThoughtItem>
                  </ChainOfThought>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">ReactNode headerText with inline tags</h3>
                  <ChainOfThought progressMessage="Done — 2 steps completed" progressState="finished" defaultExpanded>
                    <ChainOfThoughtItem headerText={<>Sent campaign brief <span className="ml-1 text-xs bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded font-normal">Campaign goals</span></>} status="completed" />
                    <ChainOfThoughtItem headerText={<>Posted update to channel <span className="ml-1 text-xs bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded font-normal">Designer</span></>} status="completed" />
                  </ChainOfThought>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Collapsed</h3>
                  <ChainOfThought progressMessage="Working on it..." progressState="loading" defaultExpanded={false}>
                    <ChainOfThoughtItem headerText="Searching knowledge base" status="completed" />
                    <ChainOfThoughtItem headerText="Analyzing data" status="in-progress" active />
                  </ChainOfThought>
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('da-activity-cot') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">DAActivityCoT</h2>
              <p className="text-sm text-gray-500 mb-6">Multi-node agent chain-of-thought visualization with progressive step reveal, collapsible search cycles, and knowledge source chips. Used in the Preview tab during agent processing.</p>

              <div className="space-y-8 max-w-xl">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Completed — all nodes done, expandable</h3>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <DAActivityCoT
                      agentName="HR Policy Agent"
                      nodes={[
                        {
                          id: 'topic-1', type: 'topic', name: 'Topic matching', status: 'completed',
                          steps: [
                            { title: 'Analyzing query intent' },
                            { title: 'Matching to registered topics' },
                            { title: 'Topic identified: PTO policy' },
                          ],
                        },
                        {
                          id: 'knowledge-1', type: 'knowledge', name: 'Knowledge search', status: 'completed',
                          steps: [
                            { title: 'Query transformation', description: 'Original: "How many PTO days do I get?"\nRewritten: PTO days allowance policy details and accrual information' },
                            { title: 'Beginning research' },
                            { title: 'Searching knowledge sources', cycle: 1 },
                            { title: 'Filtering results', cycle: 1 },
                            { title: 'Refining search query', cycle: 2 },
                            { title: 'Reading filtered sources', cycle: 2 },
                            { title: 'Summarizing findings' },
                            { title: 'Response details', description: 'Found PTO policy document with full-time employee allowances, accrual schedules, and rollover rules.', isDetail: true },
                            {
                              title: 'Referenced sources', isDetail: true,
                              sources: [
                                { id: 's1', name: 'HR Policy 2024.pdf', type: 'file' },
                                { id: 's2', name: 'Employee Handbook', type: 'sharepoint' },
                                { id: 's3', name: 'Benefits FAQ', type: 'url' },
                              ],
                            },
                          ],
                        },
                        {
                          id: 'agent-1', type: 'agent', name: 'Response generation', status: 'completed',
                          steps: [
                            { title: 'Drafting response' },
                            { title: 'Applying guidelines' },
                            { title: 'Formatting output' },
                          ],
                        },
                      ]}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Loading — node 2 actively revealing steps</h3>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <DAActivityCoT
                      agentName="IT Support Agent"
                      nodes={[
                        {
                          id: 'topic-2', type: 'topic', name: 'Topic matching', status: 'completed',
                          steps: [
                            { title: 'Analyzing query intent' },
                            { title: 'Matching to registered topics' },
                            { title: 'Topic identified: VPN access' },
                          ],
                        },
                        {
                          id: 'knowledge-2', type: 'knowledge', name: 'Knowledge search', status: 'loading',
                          steps: [
                            { title: 'Query transformation' },
                            { title: 'Beginning research' },
                            { title: 'Searching knowledge sources', cycle: 1 },
                          ],
                        },
                        {
                          id: 'agent-2', type: 'agent', name: 'Response generation', status: 'rest',
                          steps: [
                            { title: 'Drafting response' },
                            { title: 'Applying guidelines' },
                            { title: 'Formatting output' },
                          ],
                        },
                      ]}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">connectsToResponse — last node draws a line to an external agent response</h3>
                  <p className="text-xs text-gray-400 mb-3">Use <code>connectsToResponse</code> when the CoT is followed by an agent response rendered outside the component. The last node keeps its connector line so the two elements visually join.</p>
                  <div className="max-w-xl">
                    <DAActivityCoT
                      agentName="Finance Agent"
                      connectsToResponse={true}
                      nodes={[
                        {
                          id: 'topic-cr', type: 'topic', name: 'Topic matching', status: 'completed',
                          steps: [
                            { title: 'Analyzing query intent' },
                            { title: 'Topic identified: budget variance' },
                          ],
                        },
                        {
                          id: 'knowledge-cr', type: 'knowledge', name: 'Knowledge search', status: 'completed',
                          steps: [
                            { title: 'Searching financial records' },
                            { title: 'Response details', description: 'Found Q3 budget reports with variance breakdown.', isDetail: true },
                            {
                              title: 'Referenced sources', isDetail: true,
                              sources: [
                                { id: 'cr-s1', name: 'Q3 Budget Report.xlsx', type: 'file' },
                              ],
                            },
                          ],
                        },
                      ]}
                    />
                    {/* Mock agent response to illustrate visual continuity */}
                    <div className="px-4 pb-3 -mt-1">
                      <div className="flex items-start gap-3 pl-5">
                        <div className="w-5 h-5 rounded-md bg-brand flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[13px] font-medium text-text-primary mb-0.5">Finance Agent</p>
                          <p className="text-[13px] text-text-subtle leading-relaxed">The Q3 budget shows a 12% variance driven by increased contractor spend…</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">externalExpandedState — controlled expand/collapse</h3>
                  <p className="text-xs text-gray-400 mb-3">Pass <code>externalExpandedState</code> to override the built-in toggle. The internal "Expand all" button is hidden when this prop is provided. Useful when a parent (e.g. a Dev mode header) controls all CoT panels at once.</p>
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => setCotExternalExpand(true)}
                      className={`text-xs px-3 py-1 rounded border ${cotExternalExpand === true ? 'bg-brand text-white border-brand' : 'border-gray-300 text-gray-600'}`}
                    >
                      Expand all
                    </button>
                    <button
                      onClick={() => setCotExternalExpand(false)}
                      className={`text-xs px-3 py-1 rounded border ${cotExternalExpand === false ? 'bg-brand text-white border-brand' : 'border-gray-300 text-gray-600'}`}
                    >
                      Collapse all
                    </button>
                    <button
                      onClick={() => setCotExternalExpand(undefined)}
                      className={`text-xs px-3 py-1 rounded border ${cotExternalExpand === undefined ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-300 text-gray-600'}`}
                    >
                      Uncontrolled
                    </button>
                  </div>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <DAActivityCoT
                      agentName="Legal Agent"
                      externalExpandedState={cotExternalExpand}
                      nodes={[
                        {
                          id: 'topic-ext', type: 'topic', name: 'Topic matching', status: 'completed',
                          steps: [
                            { title: 'Query parsed' },
                            { title: 'Topic: contract review' },
                          ],
                        },
                        {
                          id: 'knowledge-ext', type: 'knowledge', name: 'Knowledge search', status: 'completed',
                          steps: [
                            { title: 'Searching legal database' },
                            { title: 'Refining for jurisdiction' },
                            { title: 'Response details', description: 'Relevant clauses from MSA template identified.', isDetail: true },
                            {
                              title: 'Referenced sources', isDetail: true,
                              sources: [
                                { id: 'ext-s1', name: 'MSA Template v3.docx', type: 'file' },
                                { id: 'ext-s2', name: 'Legal Wiki', type: 'url' },
                              ],
                            },
                          ],
                        },
                        {
                          id: 'agent-ext', type: 'agent', name: 'Response generation', status: 'completed',
                          steps: [
                            { title: 'Drafting summary' },
                            { title: 'Applying compliance guidelines' },
                          ],
                        },
                      ]}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">agentIcon — custom trigger icon + greeting topic node</h3>
                  <p className="text-xs text-gray-400 mb-3">Pass a <code>SquircleIcon</code> (size&nbsp;20) via <code>agentIcon</code> to show the agent's identity in the trigger. Greeting inputs now produce a matched <code>topic</code> node instead of an empty chain.</p>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <DAActivityCoT
                      agentName="Project Management Agent"
                      agentIcon={
                        <div className="w-5 h-5 rounded-[5px] shrink-0" style={{ background: 'linear-gradient(135deg, #464FEB 0%, #7B61FF 100%)' }} />
                      }
                      nodes={[
                        {
                          id: 'topic-greeting-demo', type: 'topic', name: 'Acknowledge user greeting', status: 'completed',
                          steps: [
                            { title: 'Analyzing message intent' },
                            { title: 'Matching to registered topics' },
                            { title: 'Topic matched: Acknowledge user greeting' },
                          ],
                        },
                      ]}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Error state — errorTitle on last node shows error icon + bar</h3>
                  <p className="text-xs text-gray-400 mb-3">Set <code>errorTitle</code> (and optionally <code>error</code>) on a node to display a red error icon in the header and an error message bar below. Use <code>errorTitle</code> alone for a short label; add <code>error</code> for a detailed description.</p>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <DAActivityCoT
                      agentName="Approvals Agent"
                      nodes={[
                        {
                          id: 'topic-err', type: 'topic', name: 'Topic matching', status: 'completed',
                          steps: [{ title: 'Topic identified: approval workflow' }],
                        },
                        {
                          id: 'knowledge-err', type: 'knowledge', name: 'Knowledge search', status: 'completed',
                          steps: [{ title: 'Searching approval policies' }],
                          errorTitle: 'Approval required',
                          error: 'Manager sign-off is required before this action can proceed.',
                        },
                      ]}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">showTrigger=false — hide agent header in multi-turn conversations</h3>
                  <p className="text-xs text-gray-400 mb-3">Pass <code>showTrigger=&#123;false&#125;</code> to hide the agent name/icon header. Use this for follow-up messages in a session where the agent identity has already been established in the first message.</p>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <DAActivityCoT
                      agentName="HR Policy Agent"
                      showTrigger={false}
                      nodes={[
                        {
                          id: 'topic-st', type: 'topic', name: 'Topic matching', status: 'completed',
                          steps: [
                            { title: 'Analyzing follow-up query' },
                            { title: 'Topic identified: benefits enrollment' },
                          ],
                        },
                        {
                          id: 'knowledge-st', type: 'knowledge', name: 'Knowledge search', status: 'completed',
                          steps: [
                            { title: 'Searching knowledge sources', cycle: 1 },
                            { title: 'Filtering results', cycle: 1 },
                            { title: 'Summarizing findings' },
                          ],
                        },
                      ]}
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-sm font-medium text-gray-700 mb-2">initialExpanded=false — starts collapsed (use Expand all to open)</p>
                  <DAActivityCoT
                    agentName="Outlook Agent"
                    initialExpanded={false}
                    nodes={[
                      {
                        id: 'init-collapsed', type: 'agent', name: 'Outlook Agent', status: 'completed',
                        steps: [
                          { title: 'Authenticating with Microsoft Outlook' },
                          { title: 'Composing email' },
                          { title: 'Delivery confirmed' },
                        ],
                      },
                    ]}
                  />
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">onNodeAsk — hover to reveal sparkle button</h3>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <DAActivityCoT
                      agentName="IT Support Agent"
                      nodes={[
                        {
                          id: 'connector-ask', type: 'connector', name: 'ServiceNow - Create Ticket', status: 'completed',
                          steps: [{ title: 'Ticket created successfully' }],
                          errorTitle: 'Connection timeout',
                          error: 'Failed to reach ServiceNow API after 3 retries.',
                        },
                      ]}
                      onNodeAsk={(node) => alert(`Ask Copilot: "${node.name}"`)}
                    />
                  </div>
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('channel-icons') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">ChannelIcons</h2>
              <p className="text-sm text-gray-500 mb-6">
                Channel logo icons for M365 Copilot, Slack, SharePoint, WhatsApp, and website. <code>ChannelIcon</code> is a dispatcher that resolves a channel string to the correct icon. All icons accept an optional <code>size</code> prop (default 20) and <code>className</code>. <code>getChannelInfo(channel)</code> returns <code>{"{ name, previewLabel }"}</code>. <strong>M365Icon</strong> was refreshed to the gradient logo (20×20 viewBox, no black badge).
              </p>

              {/* Individual icons */}
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-700 mb-3">Individual icons — default size (20px)</p>
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="flex flex-col items-center gap-1">
                    <M365Icon />
                    <span className="text-xs text-gray-500">M365Icon</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <SlackIcon />
                    <span className="text-xs text-gray-500">SlackIcon</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <SharePointIcon />
                    <span className="text-xs text-gray-500">SharePointIcon</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <WhatsAppIcon />
                    <span className="text-xs text-gray-500">WhatsAppIcon</span>
                  </div>
                </div>
              </div>

              {/* Size variants */}
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-700 mb-3">Size variants via <code>size</code> prop</p>
                <div className="flex items-end gap-6 flex-wrap">
                  {[16, 20, 24, 32, 48].map((size) => (
                    <div key={size} className="flex flex-col items-center gap-1">
                      <SlackIcon size={size} />
                      <span className="text-xs text-gray-500">{size}px</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ChannelIcon dispatcher */}
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-700 mb-3"><code>ChannelIcon</code> dispatcher — all channel values</p>
                <div className="flex items-center gap-6 flex-wrap">
                  {(['m365', 'slack', 'sharepoint', 'whatsapp', 'website'] as const).map((ch) => {
                    const channelValue = ch === 'm365' ? undefined : ch;
                    const info = getChannelInfo(channelValue);
                    return (
                      <div key={ch} className="flex flex-col items-center gap-1">
                        <ChannelIcon channel={channelValue} size={24} />
                        <span className="text-xs text-gray-500">{info.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* getChannelInfo */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3"><code>getChannelInfo()</code> output</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {([undefined, 'slack', 'sharepoint', 'whatsapp', 'website'] as const).map((ch) => {
                    const info = getChannelInfo(ch);
                    return (
                      <div key={ch ?? 'default'} className="border border-gray-200 rounded-lg p-3 text-xs">
                        <p className="font-mono text-gray-400 mb-1">channel: {ch ? `"${ch}"` : 'undefined'}</p>
                        <p><span className="text-gray-500">name:</span> {info.name}</p>
                        <p><span className="text-gray-500">previewLabel:</span> {info.previewLabel}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('progress-timeline') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">ProgressTimeline</h2>
              <p className="text-sm text-gray-500 mb-6">Vertical timeline with connecting line and status indicators</p>

              <div className="max-w-md">
                <ProgressTimeline items={[
                  { id: '1', label: 'Initialize project', status: 'completed' },
                  { id: '2', label: 'Install dependencies', status: 'completed' },
                  { id: '3', label: 'Configure settings', status: 'in-progress' },
                  { id: '4', label: 'Run tests', status: 'pending' },
                  { id: '5', label: 'Deploy to production', status: 'pending' },
                ]} />
              </div>
            </section>}

            {visibleSectionIds.has('version-history') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">VersionHistory</h2>
              <p className="text-sm text-gray-500 mb-6">
                Vertical timeline for displaying workflow or agent version history. Uses a flex-col dot+line column so the connector is always perfectly centered under each circle. Supports three source types: <strong>manual</strong> (user avatar + "Saved manually"), <strong>auto</strong> (Auto-saved badge), <strong>publish</strong> (Published badge). The live (current) item gets a filled dot and Live badge; pass <code>onRestore</code> to show a Restore button on older entries.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Draft + published + older — Live on last publish</h3>
                  <div className="max-w-xs">
                    <VersionHistory>
                      {/* Drafts (newer than last publish) — hollow blue ring, dashed line */}
                      <VersionHistoryItem
                        versionLabel="Mar 31, 2026, 2:14 PM"
                        isCurrent
                        isDraft
                        source="manual"
                        description="Updated email action to include priority flag and CC field."
                        userInitials="TW"
                        userName="Tyler Wain"
                        isLast={false}
                        onRestore={() => {}}
                      />
                      <VersionHistoryItem
                        versionLabel="Mar 31, 2026, 9:00 AM"
                        isDraft
                        source="auto"
                        description="Added Condition step."
                        changeCount={5}
                        isLast={false}
                        onRestore={() => {}}
                      />
                      {/* Live (most recent publish) — filled blue checkmark + Live badge */}
                      <VersionHistoryItem
                        versionLabel="Mar 30, 2026, 10:02 AM"
                        isLive
                        source="publish"
                        description="Published to Teams channel. Trigger condition tightened."
                        userInitials="TW"
                        userName="Tyler Wain"
                        isLast={false}
                      />
                      {/* Older non-publish — solid blue dot */}
                      <VersionHistoryItem
                        versionLabel="Mar 29, 2026, 4:45 PM"
                        source="auto"
                        description="Added Email, Condition, and SharePoint steps. Removed placeholder trigger."
                        changeCount={6}
                        isLast={false}
                        onRestore={() => {}}
                      />
                      {/* Previous publish — gray filled checkmark */}
                      <VersionHistoryItem
                        versionLabel="Mar 28, 2026, 11:00 AM"
                        isPreviousPublish
                        source="publish"
                        description="Initial publish to Teams channel."
                        userInitials="TW"
                        userName="Tyler Wain"
                        isLast
                        onRestore={() => {}}
                      />
                    </VersionHistory>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Empty state</h3>
                  <div className="max-w-xs">
                    <VersionHistory emptyMessage="No saved versions yet. Click Save to create your first version." />
                  </div>
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('creation-tasks-panel') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">CreationTasksPanel</h2>
              <p className="text-sm text-gray-500 mb-6">Step-by-step progress panel shown during agent/workflow creation. Each task has four statuses: <strong>done</strong> (green checkmark), <strong>skipped</strong> (green checkmark + "Skipped" label), <strong>active</strong> (blue "In progress"), <strong>pending</strong> (dashed circle).</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Agent flow — mid-progress */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Agent flow (mid-progress)</p>
                  <div className="border border-gray-200 rounded-xl p-6 max-w-xs">
                    <CreationTasksPanel
                      intentType="agent"
                      tasks={[
                        { id: 'q1', label: 'Clarify the goal', status: 'done' },
                        { id: 'q2', label: 'Define the target audience', status: 'done' },
                        { id: 'knowledge', label: 'Add knowledge sources', status: 'active' },
                        { id: 'q3', label: 'Describe the workflow', status: 'pending' },
                        { id: 'channel', label: 'Choose a deployment channel', status: 'pending' },
                        { id: 'review', label: 'Review the plan', status: 'pending' },
                      ]}
                    />
                  </div>
                </div>

                {/* Workflow flow — near complete */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Workflow flow (near complete)</p>
                  <div className="border border-gray-200 rounded-xl p-6 max-w-xs">
                    <CreationTasksPanel
                      intentType="workflow"
                      tasks={[
                        { id: 'q1', label: 'Clarify the goal', status: 'done' },
                        { id: 'q2', label: 'Map out your process', status: 'done' },
                        { id: 'q3', label: 'Define the workflow', status: 'done' },
                        { id: 'channel', label: 'Choose a deployment channel', status: 'done' },
                        { id: 'review', label: 'Review the plan', status: 'active' },
                      ]}
                    />
                  </div>
                </div>

                {/* All pending */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">All pending (initial state)</p>
                  <div className="border border-gray-200 rounded-xl p-6 max-w-xs">
                    <CreationTasksPanel
                      intentType="agent"
                      tasks={[
                        { id: 'q1', label: 'Clarify the goal', status: 'active' },
                        { id: 'q2', label: 'Define the target audience', status: 'pending' },
                        { id: 'knowledge', label: 'Add knowledge sources', status: 'pending' },
                        { id: 'q3', label: 'Describe the workflow', status: 'pending' },
                        { id: 'channel', label: 'Choose a deployment channel', status: 'pending' },
                        { id: 'review', label: 'Review the plan', status: 'pending' },
                      ]}
                    />
                  </div>
                </div>

                {/* All done */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">All complete</p>
                  <div className="border border-gray-200 rounded-xl p-6 max-w-xs">
                    <CreationTasksPanel
                      intentType="agent"
                      tasks={[
                        { id: 'q1', label: 'Clarify the goal', status: 'done' },
                        { id: 'q2', label: 'Define the target audience', status: 'done' },
                        { id: 'knowledge', label: 'Add knowledge sources', status: 'done' },
                        { id: 'q3', label: 'Describe the workflow', status: 'done' },
                        { id: 'channel', label: 'Choose a deployment channel', status: 'done' },
                        { id: 'review', label: 'Review the plan', status: 'done' },
                      ]}
                    />
                  </div>
                </div>

                {/* With skipped step */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">With skipped step</p>
                  <div className="border border-gray-200 rounded-xl p-6 max-w-xs">
                    <CreationTasksPanel
                      intentType="agent"
                      tasks={[
                        { id: 'q1', label: 'Clarify the goal', status: 'done' },
                        { id: 'q2', label: 'Identify knowledge sources', status: 'skipped' },
                        { id: 'knowledge', label: 'Add knowledge sources', status: 'skipped' },
                        { id: 'q3', label: 'Define capabilities', status: 'active' },
                        { id: 'channel', label: 'Choose the channel', status: 'pending' },
                        { id: 'review', label: 'Review the plan', status: 'pending' },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('snapshot-card') && (() => {
              const builtInExample: AgentSnapshot = {
                id: 'showcase-builtin',
                name: 'Day 20 — Published',
                description: 'Fully configured, published agent with rich instructions, complete guidelines, and multiple capabilities.',
                tags: ['published', 'mature', 'production'],
                lifecycleStage: 'published',
                isBuiltIn: true,
                createdAt: '2026-01-01T00:00:00.000Z',
                agentConfig: { type: 'agent', name: 'Contoso Support', icon: '🛍️', gradientKey: 'cerulean', description: '', purpose: '', guidelines: [], skills: [], model: 'sonnet-4.5', knowledge: { files: [], webSearch: false, specificSources: false, referenceOrgChart: false, customAPIs: [] }, instructions: '', capabilities: [], published: true },
              };
              const userExample: AgentSnapshot = {
                id: 'showcase-user',
                name: 'My Support Agent v1',
                description: 'Saved mid-sprint before testing the new escalation flow.',
                tags: ['draft', 'escalation'],
                lifecycleStage: 'custom',
                isBuiltIn: false,
                createdAt: new Date().toISOString(),
                createdBy: 'jedevrie',
                agentConfig: { type: 'agent', name: 'My Support Agent v1', icon: '💬', gradientKey: 'rose', description: '', purpose: '', guidelines: [], skills: [], model: 'sonnet-4.5', knowledge: { files: [], webSearch: false, specificSources: false, referenceOrgChart: false, customAPIs: [] }, instructions: '', capabilities: [], published: false },
              };
              const badExample: AgentSnapshot = {
                id: 'showcase-bad',
                name: 'Bad Agent',
                description: 'Intentionally misconfigured with contradictory guidelines — use for debugging and education.',
                tags: ['broken', 'debug'],
                lifecycleStage: 'bad-agent',
                isBuiltIn: true,
                createdAt: '2026-01-01T00:00:00.000Z',
                agentConfig: { type: 'agent', name: 'Confused Agent', icon: '😵', gradientKey: 'rose', description: '', purpose: '', guidelines: [], skills: [], model: 'haiku-4.5', knowledge: { files: [], webSearch: false, specificSources: false, referenceOrgChart: false, customAPIs: [] }, instructions: '', capabilities: [], published: false },
              };
              return (
                <section className="bg-white rounded-xl border border-[#E0E0E0] p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-1">SnapshotCard</h2>
                  <p className="text-sm text-gray-500 mb-6">Card for displaying an agent snapshot — lifecycle stage badge, description, tags, load action, and delete button for user-created snapshots.</p>
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Built-in snapshot (Published)</p>
                      <div className="max-w-sm">
                        <SnapshotCard snapshot={builtInExample} onActivate={() => {}} />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">User-created snapshot (Custom) — with delete button</p>
                      <div className="max-w-sm">
                        <SnapshotCard snapshot={userExample} onActivate={() => {}} onDelete={() => {}} />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Bad Agent snapshot</p>
                      <div className="max-w-sm">
                        <SnapshotCard snapshot={badExample} onActivate={() => {}} />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Activating state</p>
                      <div className="max-w-sm">
                        <SnapshotCard snapshot={builtInExample} onActivate={() => {}} isActivating />
                      </div>
                    </div>
                  </div>
                </section>
              );
            })()}

            {visibleSectionIds.has('change-summary-card') && (
              <section id="change-summary-card" className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-1">ChangeSummaryCard</h2>
                <p className="text-sm text-gray-500 mb-6">Structured change log rendered inside a helper agent message after config updates. Shows a bullet list with Fluent icons and optional navigation. Any next-step text is rendered as regular message text outside the card.</p>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Mixed changes + next step</p>
                    <ChangeSummaryCard
                      summary={{
                        bullets: [
                          { text: 'Updated the tone of voice in instructions', icon: 'drafts', navigate: 'build:instructions' },
                          { text: 'Added the Send an email tool', icon: 'puzzle', navigate: 'build:component:Send an email' },
                          { text: 'Deleted the recurrence trigger', icon: 'delete', navigate: null },
                        ],
                      }}
                      onNavigate={(t) => console.log('[Showcase] Navigate:', t)}
                    />
                    <p className="mt-3 text-sm text-gray-700 leading-normal">Would you like to preview your agent now?</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Settings change + next step</p>
                    <ChangeSummaryCard
                      summary={{
                        bullets: [
                          { text: 'Changed the model to GPT-5 Auto', icon: 'settings', navigate: 'build:model' },
                        ],
                      }}
                      onNavigate={(t) => console.log('[Showcase] Navigate:', t)}
                    />
                    <p className="mt-3 text-sm text-gray-700 leading-normal">Run a test to see how it performs.</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">No next step</p>
                    <ChangeSummaryCard
                      summary={{
                        bullets: [
                          { text: 'Rewrote the instructions from scratch', icon: 'drafts', navigate: 'build:instructions' },
                        ],
                      }}
                      onNavigate={(t) => console.log('[Showcase] Navigate:', t)}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">All non-clickable (deletions)</p>
                    <ChangeSummaryCard
                      summary={{
                        bullets: [
                          { text: 'Deleted the SharePoint knowledge source', icon: 'delete', navigate: null },
                          { text: 'Removed the email trigger', icon: 'delete', navigate: null },
                        ],
                      }}
                    />
                  </div>
                </div>
              </section>
            )}

            {visibleSectionIds.has('save-indicator') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1">SaveIndicator</h2>
              <p className="text-sm text-gray-500 mb-6">Progressive save-status indicator. Manual-save mode shows unsaved/saving/saved states with checkmark collapse and last-saved tooltip. Auto-save status is rendered in the Layout header near the publish button.</p>
              <div className="space-y-6">
                {/* Manual save states */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Manual Save States</h3>
                  <div className="flex items-center gap-8">
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-xs text-gray-500 font-medium">Unsaved changes:</span>
                      <span className="inline-flex items-center text-xs font-semibold text-gray-500 select-none">Unsaved changes</span>
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-xs text-gray-500 font-medium">Saving:</span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-500 select-none">Saving…</span>
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-xs text-gray-500 font-medium">Saved (expanded):</span>
                      <span className="inline-flex items-center gap-1 text-xs text-gray-900 select-none">
                        <CheckmarkCircle16Filled className="w-4 h-4" />
                        <span>Saved just now</span>
                      </span>
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-xs text-gray-500 font-medium">Saved (collapsed):</span>
                      <span className="inline-flex items-center gap-1 text-xs text-gray-900 select-none cursor-default" title="Last saved at 2:30:15 PM">
                        <CheckmarkCircle16Filled className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </div>
                {/* Auto-save states (rendered in Layout header, shown here for reference) */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Auto-Save States <span className="font-normal text-gray-400">(rendered in Layout header)</span></h3>
                  <div className="flex items-center gap-8">
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-xs text-gray-500 font-medium">Saving:</span>
                      <span className="inline-flex items-center gap-2 text-sm text-gray-600 select-none">
                        <ArrowSync16Regular className="w-4 h-4 animate-spin text-[#484FE3]" />
                        Saving ...
                      </span>
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-xs text-gray-500 font-medium">Draft saved:</span>
                      <span className="inline-flex items-center gap-2 text-sm text-gray-600 select-none">
                        Draft saved
                      </span>
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-xs text-gray-500 font-medium">Fading out:</span>
                      <span className="inline-flex items-center gap-2 text-sm text-gray-600 select-none opacity-40 translate-x-1.5 transition-[opacity,transform] duration-500">
                        Draft saved
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">Live (toggle Manual Save or Auto-Save to see):</span>
                  <SaveIndicator />
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('dw-instructions-card') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">DwInstructionsCard</h2>
              <p className="text-sm text-gray-500 mb-6">DW conversational card — shows agent instructions inline in chat when the agent updates its own instructions.</p>

              <div className="space-y-8">
                {/* Default */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Default (with CTA)</h3>
                  <DwInstructionsCard
                    role="I am a financial advisor focused on helping Avery manage and optimize their invoice operations."
                    responsibilities={[
                      { text: 'Monitoring invoice status (paid, unpaid, overdue)' },
                      { text: 'Identifying and prioritizing overdue invoices' },
                      { text: 'Highlighting cash flow risks' },
                      { text: 'Providing clear, concise summaries of invoice health' },
                      { text: 'Suggesting follow-ups or actions to improve collections' },
                    ]}
                    goal="I ensure Avery always has a clear, up-to date view of outstanding payments and risks."
                    onViewDetails={() => console.log('[DwInstructionsCard] Open in Copilot Studio')}
                  />
                </div>

                {/* Without CTA */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Without CTA button</h3>
                  <DwInstructionsCard
                    role="I am a marketing assistant that helps the team plan and execute campaigns."
                    responsibilities={[
                      { text: 'Drafting campaign briefs and timelines' },
                      { text: 'Tracking campaign performance metrics' },
                      { text: 'Coordinating content approvals across stakeholders' },
                    ]}
                    goal="Ensure every campaign ships on time with clear metrics and stakeholder alignment."
                  />
                </div>

                {/* Custom title */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Custom title</h3>
                  <DwInstructionsCard
                    title="Updated Instructions"
                    role="I am an HR onboarding specialist that guides new hires through their first 90 days."
                    responsibilities={[
                      { text: 'Scheduling orientation sessions and meet-and-greets' },
                      { text: 'Tracking completion of required training modules' },
                    ]}
                    goal="Every new hire feels welcomed and productive within their first month."
                    onViewDetails={() => console.log('[DwInstructionsCard] Open in Copilot Studio')}
                  />
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('dw-skill-card') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">DwSkillCard</h2>
              <p className="text-sm text-gray-500 mb-6">DW conversational card — shows a newly created skill inline in chat.</p>

              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Default (with CTA)</h3>
                  <DwSkillCard
                    name="Invoice Analysis"
                    description="Analyzes invoice data to identify patterns, overdue payments, and cash flow risks across all accounts."
                    capabilities={[
                      'Parse and categorize invoice line items',
                      'Flag overdue invoices by severity',
                      'Generate weekly aging summaries',
                      'Predict cash flow gaps based on payment trends',
                    ]}
                    optimizedFor="Optimized for high-volume B2B invoice processing"
                    onViewInSkills={() => console.log('[DwSkillCard] Open in Copilot Studio')}
                  />
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Minimal (no optimization note, no CTA)</h3>
                  <DwSkillCard
                    name="Meeting Summarizer"
                    description="Summarizes meeting transcripts into key decisions, action items, and follow-ups."
                    capabilities={[
                      'Extract action items with owners and deadlines',
                      'Highlight key decisions made during the meeting',
                    ]}
                  />
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('dw-task-card') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">DwTaskCard</h2>
              <p className="text-sm text-gray-500 mb-6">DW conversational card — shows a created task with steps and metadata.</p>

              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Full (with bullets, recurrence, time saved)</h3>
                  <DwTaskCard
                    name="Weekly Invoice Audit"
                    description="Automatically review all outstanding invoices every Monday morning and flag items requiring attention."
                    bullets={[
                      'Pull all unpaid invoices from the accounting system',
                      'Cross-reference payment terms with due dates',
                      'Flag invoices overdue by 30+ days as high priority',
                      'Send summary to the finance team Slack channel',
                    ]}
                    recurrence="Every Monday at 8:00 AM"
                    timeSaved="2 hours per week"
                    onManageTask={() => console.log('[DwTaskCard] Open in Copilot Studio')}
                  />
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Simple (no bullets, no metadata)</h3>
                  <DwTaskCard
                    name="Send Welcome Email"
                    description="Send a personalized welcome email to new team members on their first day."
                    onManageTask={() => console.log('[DwTaskCard] Open in Copilot Studio')}
                  />
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('dw-task-list-card') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">DwTaskListCard</h2>
              <p className="text-sm text-gray-500 mb-6">DW conversational card — shows a list of tasks with status indicators and connector icons.</p>

              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Mixed statuses with connectors</h3>
                  <DwTaskListCard
                    tasks={[
                      { name: 'Review overdue invoices', subtitle: 'Finance team', status: 'complete', connectors: ['excel', 'outlook'], time: '2m ago' },
                      { name: 'Send payment reminders', subtitle: 'Accounts receivable', status: 'running', connectors: ['outlook', 'teams'] },
                      { name: 'Update cash flow forecast', subtitle: 'Weekly report', status: 'pending', connectors: ['excel'] },
                      { name: 'Prepare month-end summary', subtitle: 'Due Friday', status: 'upcoming', connectors: ['word', 'sharepoint'] },
                    ]}
                    onOpenInStudio={() => console.log('[DwTaskListCard] Open in Copilot Studio')}
                  />
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">All complete (no CTA)</h3>
                  <DwTaskListCard
                    tasks={[
                      { name: 'Draft agenda', status: 'complete', time: '10m ago' },
                      { name: 'Book conference room', status: 'complete', connectors: ['outlook'], time: '8m ago' },
                      { name: 'Send invites', status: 'complete', connectors: ['outlook', 'teams'], time: '5m ago' },
                    ]}
                  />
                </div>
              </div>
            </section>}

            {visibleSectionIds.has('design-tokens') && <section className="bg-white rounded-xl border border-[#E0E0E0] p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Design Tokens</h2>
              <p className="text-sm text-gray-500 mb-6">Color palette from the Coworker Design System</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Primary</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-[#0F6CBD]"></div>
                      <span className="text-xs text-gray-600">Brand Blue</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-[#115EA3]"></div>
                      <span className="text-xs text-gray-600">Brand Hover</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Status</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-[#0E7A0D]"></div>
                      <span className="text-xs text-gray-600">Success</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-[#D83B01]"></div>
                      <span className="text-xs text-gray-600">Warning</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-[#A4262C]"></div>
                      <span className="text-xs text-gray-600">Error</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Surfaces</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded border border-gray-200 bg-white"></div>
                      <span className="text-xs text-gray-600">Card</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-[#F7F9FB]"></div>
                      <span className="text-xs text-gray-600">Background</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Copilot</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-gradient-to-r from-[#7F7FD5] via-[#86A8E7] to-[#91EAE4]"></div>
                      <span className="text-xs text-gray-600">Gradient</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>}

              </div>
            </div>
          </>
        )}

        {/* TOKENS TAB */}
        {activeTab === 'tokens' && (
          <>
            <div className="flex-1 overflow-y-auto show-scrollbar" style={{ margin: '0 -2rem', padding: '0.5rem 2rem 2rem' }}>
              <div>

            {/* Core Surfaces */}
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Core Surfaces</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg border border-gray-200 bg-white"></div>
                  <div>
                    <div className="text-sm font-medium">--background</div>
                    <div className="text-xs text-gray-500">#FFFFFF</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#242424]"></div>
                  <div>
                    <div className="text-sm font-medium">--foreground</div>
                    <div className="text-xs text-gray-500">#242424</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg border border-gray-200 bg-white"></div>
                  <div>
                    <div className="text-sm font-medium">--surface</div>
                    <div className="text-xs text-gray-500">#FFFFFF</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#F5F5F5]"></div>
                  <div>
                    <div className="text-sm font-medium">--muted</div>
                    <div className="text-xs text-gray-500">#F5F5F5</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Text Colors */}
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Text Colors</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#242424]"></div>
                  <div>
                    <div className="text-sm font-medium">--text-primary</div>
                    <div className="text-xs text-gray-500">#242424</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#525252]"></div>
                  <div>
                    <div className="text-sm font-medium">--text-subtle</div>
                    <div className="text-xs text-gray-500">#525252</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#808080]"></div>
                  <div>
                    <div className="text-sm font-medium">--text-disabled</div>
                    <div className="text-xs text-gray-500">#808080</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#9E9E9E]"></div>
                  <div>
                    <div className="text-sm font-medium">--text-placeholder</div>
                    <div className="text-xs text-gray-500">#9E9E9E</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Primary Brand */}
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Primary Brand (Blue-based)</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#484FE3]"></div>
                  <div>
                    <div className="text-sm font-medium">--primary</div>
                    <div className="text-xs text-gray-500">#484FE3</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#3B3FB2]"></div>
                  <div>
                    <div className="text-sm font-medium">--primary-hover</div>
                    <div className="text-xs text-gray-500">#3B3FB2</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#2E2E78]"></div>
                  <div>
                    <div className="text-sm font-medium">--primary-active</div>
                    <div className="text-xs text-gray-500">#2E2E78</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#484FE3] opacity-50"></div>
                  <div>
                    <div className="text-sm font-medium">--primary-disabled</div>
                    <div className="text-xs text-gray-500">50% opacity</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Brand Background */}
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Brand Background</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-brand-background"></div>
                  <div>
                    <div className="text-sm font-medium">--brand-background</div>
                    <div className="text-xs text-gray-500">#EBEFFF — Rest</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-brand-background-hover"></div>
                  <div>
                    <div className="text-sm font-medium">--brand-background-hover</div>
                    <div className="text-xs text-gray-500">#CCD6FF — Hover</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-brand-background-pressed"></div>
                  <div>
                    <div className="text-sm font-medium">--brand-background-pressed</div>
                    <div className="text-xs text-gray-500">#96A8FF — Pressed</div>
                  </div>
                </div>
              </div>
            </section>

            {/* HA Review palette */}
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">HA Review</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#FBE5E8] border border-gray-200"></div>
                  <div>
                    <div className="text-sm font-medium">--review-deleted-bg</div>
                    <div className="text-xs text-gray-500">#FBE5E8 — Deleted span background</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Brand Flair / Gradients */}
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Brand Flair (Gradients)</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-48 h-12 rounded-lg bg-gradient-to-r from-[#484FE3] to-[#4CC9F0]"></div>
                  <div>
                    <div className="text-sm font-medium">--gradient-copilot</div>
                    <div className="text-xs text-gray-500">Primary → Azure</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-48 h-12 rounded-lg bg-gradient-to-r from-[#484FE3] via-[#4CC9F0] to-[#91EAE4]"></div>
                  <div>
                    <div className="text-sm font-medium">--gradient-copilot-full</div>
                    <div className="text-xs text-gray-500">Primary → Cyan → Azure</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-[#484FE3]"></div>
                    <div>
                      <div className="text-sm font-medium">--brand-flair-1</div>
                      <div className="text-xs text-gray-500">Primary Blue</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-[#4CC9F0]"></div>
                    <div>
                      <div className="text-sm font-medium">--brand-flair-2</div>
                      <div className="text-xs text-gray-500">Cyan</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-[#4CC9F0]"></div>
                    <div>
                      <div className="text-sm font-medium">--brand-flair-3</div>
                      <div className="text-xs text-gray-500">Azure</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Button Colors */}
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Button Colors</h2>

              <h3 className="text-sm font-medium text-gray-700 mb-3">Secondary Button</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg border border-gray-200 bg-white"></div>
                  <div>
                    <div className="text-sm font-medium">--secondary</div>
                    <div className="text-xs text-gray-500">#FFFFFF</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#F5F5F5]"></div>
                  <div>
                    <div className="text-sm font-medium">--secondary-hover</div>
                    <div className="text-xs text-gray-500">#F5F5F5</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#E0E0E0]"></div>
                  <div>
                    <div className="text-sm font-medium">--secondary-active</div>
                    <div className="text-xs text-gray-500">#E0E0E0</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#D1D1D1]"></div>
                  <div>
                    <div className="text-sm font-medium">--secondary-border</div>
                    <div className="text-xs text-gray-500">#D1D1D1</div>
                  </div>
                </div>
              </div>

              <h3 className="text-sm font-medium text-gray-700 mb-3">Action Button (Gray)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#F3F4F6]"></div>
                  <div>
                    <div className="text-sm font-medium">--action</div>
                    <div className="text-xs text-gray-500">#F3F4F6</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#E5E7EB]"></div>
                  <div>
                    <div className="text-sm font-medium">--action-hover</div>
                    <div className="text-xs text-gray-500">#E5E7EB</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#D1D5DB]"></div>
                  <div>
                    <div className="text-sm font-medium">--action-active</div>
                    <div className="text-xs text-gray-500">#D1D5DB</div>
                  </div>
                </div>
              </div>

              <h3 className="text-sm font-medium text-gray-700 mb-3">Action Brand Button (Blue tint)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#EFF6FF]"></div>
                  <div>
                    <div className="text-sm font-medium">--action-brand</div>
                    <div className="text-xs text-gray-500">#EFF6FF</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#DBEAFE]"></div>
                  <div>
                    <div className="text-sm font-medium">--action-brand-hover</div>
                    <div className="text-xs text-gray-500">#DBEAFE</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#BFDBFE]"></div>
                  <div>
                    <div className="text-sm font-medium">--action-brand-active</div>
                    <div className="text-xs text-gray-500">#BFDBFE</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#93C5FD]"></div>
                  <div>
                    <div className="text-sm font-medium">--action-brand-border</div>
                    <div className="text-xs text-gray-500">#93C5FD</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Status Colors */}
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Status Colors</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#22C55E]"></div>
                  <div>
                    <div className="text-sm font-medium">--status-success</div>
                    <div className="text-xs text-gray-500">Green</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#F59E0B]"></div>
                  <div>
                    <div className="text-sm font-medium">--status-warning</div>
                    <div className="text-xs text-gray-500">Amber</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#EF4444]"></div>
                  <div>
                    <div className="text-sm font-medium">--status-error</div>
                    <div className="text-xs text-gray-500">Red</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Product Brand Colors */}
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Product Brand Colors</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#2B579A]"></div>
                  <div>
                    <div className="text-sm font-medium">--product-word</div>
                    <div className="text-xs text-gray-500">Word Blue</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#217346]"></div>
                  <div>
                    <div className="text-sm font-medium">--product-excel</div>
                    <div className="text-xs text-gray-500">Excel Green</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#D24726]"></div>
                  <div>
                    <div className="text-sm font-medium">--product-powerpoint</div>
                    <div className="text-xs text-gray-500">PowerPoint Orange</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#0078D4]"></div>
                  <div>
                    <div className="text-sm font-medium">--product-outlook</div>
                    <div className="text-xs text-gray-500">Outlook Blue</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#6264A7]"></div>
                  <div>
                    <div className="text-sm font-medium">--product-teams</div>
                    <div className="text-xs text-gray-500">Teams Purple</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#038387]"></div>
                  <div>
                    <div className="text-sm font-medium">--product-sharepoint</div>
                    <div className="text-xs text-gray-500">SharePoint Teal</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#0078D4]"></div>
                  <div>
                    <div className="text-sm font-medium">--product-onedrive</div>
                    <div className="text-xs text-gray-500">OneDrive Blue</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#F2C811]"></div>
                  <div>
                    <div className="text-sm font-medium">--product-power-bi</div>
                    <div className="text-xs text-gray-500">Power BI Gold</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Shadows */}
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Shadows</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto bg-white rounded-lg" style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}></div>
                  <div className="mt-3 text-sm font-medium">--shadow-sm</div>
                  <div className="text-xs text-gray-500">Subtle</div>
                </div>
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto bg-white rounded-lg" style={{ boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)' }}></div>
                  <div className="mt-3 text-sm font-medium">--shadow-md</div>
                  <div className="text-xs text-gray-500">Medium</div>
                </div>
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto bg-white rounded-lg" style={{ boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)' }}></div>
                  <div className="mt-3 text-sm font-medium">--shadow-lg</div>
                  <div className="text-xs text-gray-500">Large</div>
                </div>
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto bg-white rounded-lg" style={{ boxShadow: '0 4px 16px -2px rgba(0,0,0,0.12), 0 2px 6px -2px rgba(0,0,0,0.08)' }}></div>
                  <div className="mt-3 text-sm font-medium">--shadow-dropdown</div>
                  <div className="text-xs text-gray-500">Dropdown</div>
                </div>
              </div>
            </section>

            {/* Border Radii */}
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Border Radii</h2>
              <div className="grid grid-cols-2 md:grid-cols-7 gap-6">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto bg-primary/20 border-2 border-primary" style={{ borderRadius: '6px' }}></div>
                  <div className="mt-3 text-sm font-medium">--radius-sm</div>
                  <div className="text-xs text-gray-500">6px</div>
                </div>
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto bg-primary/20 border-2 border-primary" style={{ borderRadius: '8px' }}></div>
                  <div className="mt-3 text-sm font-medium">--radius</div>
                  <div className="text-xs text-gray-500">8px (default)</div>
                </div>
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto bg-primary/20 border-2 border-primary" style={{ borderRadius: '12px' }}></div>
                  <div className="mt-3 text-sm font-medium">--radius-lg</div>
                  <div className="text-xs text-gray-500">12px</div>
                </div>
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto bg-primary/20 border-2 border-primary" style={{ borderRadius: '16px' }}></div>
                  <div className="mt-3 text-sm font-medium">--radius-xl</div>
                  <div className="text-xs text-gray-500">16px</div>
                </div>
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto bg-primary/20 border-2 border-primary" style={{ borderRadius: '24px' }}></div>
                  <div className="mt-3 text-sm font-medium">--radius-3xl</div>
                  <div className="text-xs text-gray-500">24px</div>
                </div>
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto bg-primary/20 border-2 border-primary" style={{ borderRadius: '32px' }}></div>
                  <div className="mt-3 text-sm font-medium">--radius-4xl</div>
                  <div className="text-xs text-gray-500">32px</div>
                </div>
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto bg-primary/20 border-2 border-primary" style={{ borderRadius: '9999px' }}></div>
                  <div className="mt-3 text-sm font-medium">--radius-full</div>
                  <div className="text-xs text-gray-500">Pill</div>
                </div>
              </div>
            </section>

            {/* Animations */}
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Animations</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div
                    className="w-16 h-16 mx-auto bg-primary rounded-lg mb-3"
                    style={{
                      animation: 'slide-up-fade 0.4s ease-out infinite',
                    }}
                  ></div>
                  <div className="text-sm font-medium">slide-up-fade</div>
                  <div className="text-xs text-gray-500">0.4s ease-out</div>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-2 block">.animate-slide-up-fade</code>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div
                    className="w-16 h-16 mx-auto bg-primary rounded-lg mb-3"
                    style={{
                      animation: 'scale-in 0.3s ease-out infinite',
                    }}
                  ></div>
                  <div className="text-sm font-medium">scale-in</div>
                  <div className="text-xs text-gray-500">0.3s ease-out</div>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-2 block">.animate-scale-in</code>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div
                    className="w-16 h-16 mx-auto bg-primary rounded-lg mb-3"
                    style={{
                      animation: 'pulse-subtle 2s ease-in-out infinite',
                    }}
                  ></div>
                  <div className="text-sm font-medium">pulse-subtle</div>
                  <div className="text-xs text-gray-500">2s ease-in-out infinite</div>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-2 block">.animate-pulse-subtle</code>
                </div>
              </div>
            </section>

            {/* Navigation Tokens */}
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Navigation Tokens</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#F5F5F5]"></div>
                  <div>
                    <div className="text-sm font-medium">--nav-background</div>
                    <div className="text-xs text-gray-500">#F5F5F5</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#F0F0F0]"></div>
                  <div>
                    <div className="text-sm font-medium">--nav-background-pressed</div>
                    <div className="text-xs text-gray-500">#F0F0F0</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#2E2E2E]"></div>
                  <div>
                    <div className="text-sm font-medium">--nav-text-primary</div>
                    <div className="text-xs text-gray-500">#2E2E2E</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#707070]"></div>
                  <div>
                    <div className="text-sm font-medium">--nav-text-secondary</div>
                    <div className="text-xs text-gray-500">#707070</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium mb-2">Nav Item Sizing</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-gray-500">Height:</span> 32px</div>
                  <div><span className="text-gray-500">Padding X:</span> 12px</div>
                  <div><span className="text-gray-500">Padding Y:</span> 6px</div>
                  <div><span className="text-gray-500">Icon Size:</span> 20px</div>
                </div>
              </div>
            </section>

            {/* Dark Mode Preview */}
            <section className="bg-[#1a1a2e] rounded-xl border border-gray-700 p-6 text-white">
              <h2 className="text-xl font-semibold mb-4">Dark Mode Preview</h2>
              <p className="text-gray-400 mb-4 text-sm">The design system includes full dark mode support</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#16213e]"></div>
                  <div>
                    <div className="text-sm font-medium">--background</div>
                    <div className="text-xs text-gray-400">Dark surface</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#f8fafc]"></div>
                  <div>
                    <div className="text-sm font-medium">--foreground</div>
                    <div className="text-xs text-gray-400">Light text</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#5865F2]"></div>
                  <div>
                    <div className="text-sm font-medium">--primary</div>
                    <div className="text-xs text-gray-400">Brighter blue</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#2d3748]"></div>
                  <div>
                    <div className="text-sm font-medium">--muted</div>
                    <div className="text-xs text-gray-400">Dark muted</div>
                  </div>
                </div>
              </div>
            </section>
              </div>
            </div>
          </>
        )}

        {/* TYPE TAB */}
        {activeTab === 'type' && (
          <>
            <div className="flex-1 overflow-y-auto show-scrollbar" style={{ margin: '0 -2rem', padding: '0.5rem 2rem 2rem' }}>
              <div>

            {/* Font Stack */}
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Font Stack</h2>
              <code className="text-sm bg-gray-100 px-3 py-2 rounded block">
                font-family: "Segoe Sans", "Segoe UI", -apple-system, BlinkMacSystemFont, "Roboto", "Oxygen", "Ubuntu", sans-serif;
              </code>
            </section>

            {/* Type Scale Preview */}
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Type Scale</h2>
              <div className="divide-y divide-[#F0F0F0]">
                {[
                  { cls: 'text-display',        meta: '68 / 92 · 600',  sample: 'Display',                                       color: 'text-gray-900' },
                  { cls: 'text-large-title',     meta: '40 / 52 · 600',  sample: 'Large Title',                                   color: 'text-gray-900' },
                  { cls: 'text-title-1',         meta: '28 / 36 · 600',  sample: 'Title 1',                                       color: 'text-gray-900' },
                  { cls: 'text-title-2',         meta: '24 / 32 · 600',  sample: 'Title 2',                                       color: 'text-gray-900' },
                  { cls: 'text-title-3',         meta: '20 / 28 · 600',  sample: 'Title 3',                                       color: 'text-gray-900' },
                  { cls: 'text-subtitle-1',      meta: '20 / 28 · 400',  sample: 'Subtitle 1',                                    color: 'text-gray-900' },
                  { cls: 'text-subtitle-2',      meta: '16 / 22 · 600',  sample: 'Subtitle 2',                                    color: 'text-gray-900' },
                  { cls: 'text-body-1',          meta: '16.6 / 24 · 400',sample: 'Body 1 — The quick brown fox jumps over the lazy dog.', color: 'text-gray-900' },
                  { cls: 'text-body-1-strong',   meta: '16.6 / 24 · 600',sample: 'Body 1 Strong — The quick brown fox jumps over the lazy dog.', color: 'text-gray-900' },
                  { cls: 'text-body-2',          meta: '14 / 20 · 400',  sample: 'Body 2 — The quick brown fox jumps over the lazy dog.',       color: 'text-gray-900' },
                  { cls: 'text-body-2-strong',   meta: '14 / 20 · 600',  sample: 'Body 2 Strong — The quick brown fox jumps over the lazy dog.', color: 'text-gray-900' },
                  { cls: 'text-body-3',          meta: '12 / 16 · 400',  sample: 'Body 3 — The quick brown fox jumps over the lazy dog.',       color: 'text-gray-900' },
                  { cls: 'text-caption-1',       meta: '12 / 16 · 400',  sample: 'Caption 1 — The quick brown fox jumps over the lazy dog.',    color: 'text-gray-500' },
                  { cls: 'text-caption-1-strong',meta: '12 / 16 · 600',  sample: 'Caption 1 Strong — The quick brown fox jumps over the lazy dog.', color: 'text-gray-500' },
                  { cls: 'text-caption-2',       meta: '10 / 14 · 400',  sample: 'Caption 2 — The quick brown fox jumps over the lazy dog.',    color: 'text-gray-500' },
                ].map(({ cls, meta, sample, color }) => (
                  <div key={cls} className="flex items-baseline gap-6 py-4">
                    <div className="w-52 flex-shrink-0">
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">.{cls}</code>
                      <span className="block text-[11px] text-gray-400 mt-0.5">{meta}</span>
                    </div>
                    <p className={`${cls} ${color} flex-1 min-w-0`}>{sample}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Type Scale Table */}
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Type Scale</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E0E0E0]">
                      <th className="text-left py-3 pr-4 font-semibold text-gray-700">Token</th>
                      <th className="text-left py-3 pr-4 font-semibold text-gray-700">Size</th>
                      <th className="text-left py-3 pr-4 font-semibold text-gray-700">Line Height</th>
                      <th className="text-left py-3 pr-4 font-semibold text-gray-700">Weight</th>
                      <th className="text-left py-3 font-semibold text-gray-700">Usage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {typeRamp.map((type) => (
                      <tr key={type.token} className="border-b border-[#E0E0E0] last:border-b-0">
                        <td className="py-3 pr-4">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">{type.token}</code>
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{type.size}</td>
                        <td className="py-3 pr-4 text-gray-600">{type.lineHeight}</td>
                        <td className="py-3 pr-4 text-gray-600">{type.weight}</td>
                        <td className="py-3 text-gray-600">{type.usage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

              </div>
            </div>
          </>
        )}

        {/* ICONS TAB */}
        {activeTab === 'icons' && (
          <>
            <div className="flex-1 overflow-y-auto show-scrollbar" style={{ margin: '0 -2rem', padding: '0.5rem 2rem 2rem' }}>
              <div>

            {/* Product Icons */}
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Product Icons</h2>
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
                {/* Platform icons (Copilot Studio, Copilot, OpenAI) */}
                {filteredProductIcons.map((icon) => (
                  <div
                    key={icon.name}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group"
                    title={icon.name}
                  >
                    <img src={icon.src} alt={icon.name} className="w-5 h-5 object-contain" />
                    <span className="text-[10px] text-gray-500 text-center truncate w-full">{icon.name}</span>
                  </div>
                ))}
                {/* Claude (custom component) */}
                {'claude'.includes(iconSearch.toLowerCase()) && (
                  <div className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group" title="Claude">
                    <ClaudeSonnetIcon size={20} className="group-hover:opacity-80" />
                    <span className="text-[10px] text-gray-500 text-center truncate w-full">Claude</span>
                  </div>
                )}
                {/* Connector icons (Teams, Outlook, SharePoint, etc.) */}
                {connectorIcons
                  .filter(icon => icon.label.toLowerCase().includes(iconSearch.toLowerCase()))
                  .map((icon) => (
                    <div
                      key={icon.key}
                      className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group"
                      title={icon.label}
                    >
                      {icon.src
                        ? <img src={icon.src} alt={icon.label} className="w-5 h-5 object-contain" />
                        : <span className="w-5 h-5 flex items-center justify-center">{getConnectorIcon(icon.key, 'w-5 h-5')}</span>
                      }
                      <span className="text-[10px] text-gray-500 text-center truncate w-full">{icon.label}</span>
                    </div>
                  ))}
              </div>
            </section>

            {/* Fluent UI Icons */}
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Fluent UI Icons</h2>

            {/* Fluent Icon Size Variants */}
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Size Variants</h3>
              <div className="flex items-end gap-6">
                {[
                  { size: 48, label: '48px' },
                  { size: 32, label: '32px' },
                  { size: 28, label: '28px' },
                  { size: 24, label: '24px' },
                  { size: 20, label: '20px' },
                  { size: 16, label: '16px' },
                  { size: 12, label: '12px' },
                ].map((v) => (
                  <div key={v.label} className="flex flex-col items-center gap-2">
                    <Settings24Regular style={{ width: v.size, height: v.size }} className="text-gray-700" />
                    <span className="text-[10px] text-gray-500">{v.label}</span>
                  </div>
                ))}
              </div>
            </section>

            {Object.keys(iconsByCategory).length === 0 && Object.keys(productIconsByCategory).length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No icons found matching "{iconSearch}"
              </div>
            ) : (
              Object.entries(iconsByCategory).sort(([a], [b]) => {
                if (a === 'AI & Workflow') return -1;
                if (b === 'AI & Workflow') return 1;
                return 0;
              }).map(([category, icons]) => (
                <section key={category} className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-4">{category}</h3>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
                    {icons.map((icon) => {
                      const IconComponent = icon.component;
                      return (
                        <div
                          key={icon.name}
                          className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group"
                          title={icon.name}
                        >
                          <IconComponent className="w-5 h-5 text-gray-700 group-hover:text-primary" />
                          <span className="text-[10px] text-gray-500 text-center truncate w-full">{icon.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))
            )}

            {/* Agent & Workflow Icons */}
            <h2 className="text-lg font-semibold text-gray-900 mb-3 mt-2">Agent & Workflow Icons</h2>

            {/* Size Variants & Color Palette */}
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Size Variants</h3>
              <div className="flex items-end gap-6">
                {[
                  { size: 80, iconSize: 44, cornerRadius: 20, label: '80px (Build)' },
                  { size: 64, iconSize: 40, cornerRadius: 16, label: '64px (Plan Card)' },
                  { size: 48, iconSize: 28, cornerRadius: 12, label: '48px (Default)' },
                  { size: 32, iconSize: 20, cornerRadius: 8, label: '32px' },
                  { size: 28, iconSize: 18, cornerRadius: 7, label: '28px' },
                  { size: 24, iconSize: 16, cornerRadius: 6, label: '24px' },
                  { size: 20, iconSize: 12, cornerRadius: 5, label: '20px' },
                  { size: 16, iconSize: 10, cornerRadius: 4, label: '16px' },
                ].map((v) => (
                  <div key={v.label} className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2">
                      <SquircleIcon size={v.size} cornerRadius={v.cornerRadius} gradient="linear-gradient(138deg, #5C98ED, #6C6AE1, #764BCE)">
                        <Agents20Regular style={{ width: v.iconSize, height: v.iconSize, color: 'white' }} />
                      </SquircleIcon>
                      <AgentIcon agent={{ id: 'size-demo', name: 'Demo', systemColorIcon: 'agents' }} size={v.size} withSquircle />
                    </div>
                    <span className="text-[10px] text-gray-500">{v.label}</span>
                  </div>
                ))}
              </div>

              <h3 className="text-sm font-medium text-gray-500 mb-3 mt-6 pt-6 border-t border-gray-200"><code className="bg-gray-100 px-1 rounded text-xs">rounded</code> prop — DW agent circular avatar</h3>
              <p className="text-xs text-gray-400 mb-4">Pass <code className="bg-gray-100 px-1 rounded text-xs">rounded</code> to render the system color icon inside a circular container with a border. Used for DW agent headers where a circular avatar is shown instead of a squircle.</p>
              <div className="flex items-end gap-6">
                {[88, 64, 48, 32].map((size) => (
                  <div key={size} className="flex flex-col items-center gap-3">
                    <AgentIcon agent={{ id: `rounded-demo-${size}`, name: 'DW Agent', agentType: 'DW', systemColorIcon: 'person' }} size={size} rounded />
                    <span className="text-[10px] text-gray-500">{size}px</span>
                  </div>
                ))}
              </div>

              <h3 className="text-sm font-medium text-gray-500 mb-4 mt-6 pt-6 border-t border-gray-200">Color Palette</h3>
              <div className="flex gap-4 flex-wrap">
                {gradientPalette.map((g) => (
                  <div key={g.name} className="flex flex-col items-center gap-2">
                    <SquircleIcon size={48} cornerRadius={12} gradient={g.css}>
                      <span />
                    </SquircleIcon>
                    <span className="text-[11px] text-gray-500">{g.name}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* All Agent & Workflow Icons (Filled) */}
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Filled</h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-5">
                {agentIconGroups.flatMap((group) => group.items).map((item) => renderAgentIcon(item))}
              </div>
            </section>

            {/* All Agent Icons (Colored) */}
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Colored ({SYSTEM_COLOR_ICONS.length})</h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
                {SYSTEM_COLOR_ICONS
                  .filter(icon => icon.label.toLowerCase().includes(iconSearch.toLowerCase()) || icon.key.includes(iconSearch.toLowerCase()))
                  .map(icon => (
                  <div
                    key={icon.key}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group"
                    title={icon.label}
                  >
                    <img src={`/icons/system-color/${icon.key}.svg`} alt={icon.label} className="w-8 h-8 object-contain" loading="lazy" />
                    <span className="text-[10px] text-gray-500 text-center truncate w-full">{icon.label}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Activity Map Node Icons */}
            <h2 className="text-lg font-semibold text-gray-900 mb-3 mt-2">Activity Map Node Icons</h2>
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6 mb-6">
              <p className="text-sm text-gray-500 mb-5">Node type icons for activity maps. Each type uses a Fluent filled icon with its designated color.</p>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
                {activityNodeIcons.map(({ type, icon: Icon, color }) => (
                  <div key={type} className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                    <Icon className="w-5 h-5" style={{ color }} />
                    <span className="text-[10px] text-gray-500 text-center truncate w-full">{type}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Usage Info */}
            <section className="bg-white rounded-xl border border-[#E0E0E0] p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage</h2>
              <div className="bg-gray-50 rounded-lg p-4">
                <code className="text-sm text-gray-700">
                  {`import { IconName20Regular } from '@fluentui/react-icons';`}
                </code>
              </div>
              <p className="text-sm text-gray-600 mt-4">
                Icons are available in Regular and Filled variants, and in sizes 12, 16, 20, 24, 28, 32, and 48.
              </p>
            </section>
              </div>
            </div>
          </>
        )}
    </div>
  );
};

// DisambiguationCard navigation example
const DISAMBIGUATION_NAV_QUESTIONS = [
  {
    id: 'q1',
    question: 'What is the primary goal of your agent?',
    options: [
      { id: 'support', label: 'Answer customer questions', description: 'Respond to support and FAQ requests' },
      { id: 'workflow', label: 'Automate a repeating task', description: 'Run a process on a trigger or schedule' },
      { id: 'research', label: 'Gather and summarize information', description: 'Pull data and surface insights' },
    ],
  },
  {
    id: 'q2',
    question: 'Who will interact with this agent most often?',
    options: [
      { id: 'customers', label: 'External customers' },
      { id: 'employees', label: 'Internal employees' },
      { id: 'both', label: 'Both customers and employees' },
    ],
  },
  {
    id: 'q3',
    question: 'Which channel should the agent be available on?',
    options: [
      { id: 'teams', label: 'Microsoft Teams' },
      { id: 'web', label: 'Web chat widget' },
      { id: 'email', label: 'Email' },
      { id: 'slack', label: 'Slack' },
    ],
  },
];

const DisambiguationNavigationExample = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | undefined>(undefined);
  const total = DISAMBIGUATION_NAV_QUESTIONS.length;
  const current = currentIndex + 1;
  const q = DISAMBIGUATION_NAV_QUESTIONS[currentIndex];

  return (
    <DisambiguationCard
      question={q.question}
      options={q.options}
      selected={selectedOption}
      onSelect={(id) => { setSelectedOption(id); if (currentIndex < total - 1) { setCurrentIndex(i => i + 1); setSelectedOption(undefined); } }}
      current={current}
      total={total}
      showInput={false}
    />
  );
};

// CopilotMenu Examples
const CopilotMenuExample1 = () => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  return (
    <>
      <button
        onClick={(e) => {
          if (open) { setOpen(false); setPos(null); return; }
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setPos({ top: rect.bottom + 4, left: rect.left });
          setOpen(true);
        }}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
      >
        Open menu
      </button>
      {open && pos && (
        <CopilotMenu
          items={[
            { label: 'Duplicate', onClick: () => {} },
            { label: 'Export', onClick: () => {} },
            { label: 'Rename', onClick: () => {} },
          ]}
          position={{ top: pos.top, left: pos.left }}
          onClose={() => { setOpen(false); setPos(null); }}
        />
      )}
    </>
  );
};

const CopilotMenuExample2 = () => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  return (
    <>
      <button
        onClick={(e) => {
          if (open) { setOpen(false); setPos(null); return; }
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setPos({ top: rect.bottom + 4, left: rect.left });
          setOpen(true);
        }}
        className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
      >
        <MoreHorizontal20Regular />
      </button>
      {open && pos && (
        <CopilotMenu
          items={[
            { label: 'Pin', icon: <Pin20Regular className="w-4 h-4" />, iconFilled: <Pin20Filled className="w-4 h-4" />, onClick: () => {} },
            { label: 'Share', icon: <Share20Regular className="w-4 h-4" />, iconFilled: <Share20Filled className="w-4 h-4" />, onClick: () => {} },
            { label: 'Settings', icon: <Settings20Regular className="w-4 h-4" />, iconFilled: <Settings20Filled className="w-4 h-4" />, onClick: () => {} },
          ]}
          position={{ top: pos.top, left: pos.left }}
          onClose={() => { setOpen(false); setPos(null); }}
        />
      )}
    </>
  );
};

const CopilotMenuExample3 = () => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  return (
    <>
      <button
        onClick={(e) => {
          if (open) { setOpen(false); setPos(null); return; }
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setPos({ top: rect.bottom + 4, left: rect.left });
          setOpen(true);
        }}
        className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
      >
        <MoreHorizontal20Regular />
      </button>
      {open && pos && (
        <CopilotMenu
          items={[
            { label: 'Settings', icon: <Settings20Regular />, iconFilled: <Settings20Filled />, onClick: () => {} },
            { label: 'Share', icon: <Share20Regular />, iconFilled: <Share20Filled />, onClick: () => {} },
            { label: 'Delete', icon: <Delete20Regular />, iconFilled: <Delete20Filled />, onClick: () => {}, destructive: true, dividerAbove: true },
          ]}
          position={{ top: pos.top, left: pos.left }}
          onClose={() => { setOpen(false); setPos(null); }}
          size="md"
          minWidth={180}
        />
      )}
    </>
  );
};

const CopilotMenuExample4 = () => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [enabled, setEnabled] = useState(true);
  return (
    <>
      <button
        onClick={(e) => {
          if (open) { setOpen(false); setPos(null); return; }
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setPos({ top: rect.bottom + 4, left: rect.left });
          setOpen(true);
        }}
        className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
      >
        <MoreHorizontal20Regular />
      </button>
      {open && pos && (
        <CopilotMenu
          items={[
            { label: 'Edit', icon: <Edit20Regular />, iconFilled: <Edit20Filled />, onClick: () => {} },
            { label: 'Delete', icon: <Delete20Regular />, iconFilled: <Delete20Filled />, onClick: () => {}, destructive: true },
            { label: 'Enabled', dividerAbove: true, onClick: () => {}, toggle: { checked: enabled, onChange: setEnabled } },
          ]}
          position={{ top: pos.top, left: pos.left }}
          onClose={() => { setOpen(false); setPos(null); }}
          size="md"
          minWidth={180}
        />
      )}
    </>
  );
};

const CopilotMenuExample5 = () => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [sortSel, setSortSel] = useState<'name-az' | 'most-recent' | 'type'>('name-az');
  const [groupSel, setGroupSel] = useState<'apps' | 'child-agents' | 'no-grouping'>('apps');
  return (
    <>
      <button
        onClick={(e) => {
          if (open) { setOpen(false); setPos(null); return; }
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setPos({ top: rect.bottom + 4, left: rect.left });
          setOpen(true);
        }}
        className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
      >
        <ArrowSort20Regular />
      </button>
      {open && pos && (
        <CopilotMenu
          items={[
            { label: 'Sort by', sectionLabel: true },
            { label: 'Name A to Z', icon: sortSel === 'name-az' ? <Checkmark20Regular /> : <span className="w-5 h-5 block" />, onClick: () => setSortSel('name-az') },
            { label: 'Most recent', icon: sortSel === 'most-recent' ? <Checkmark20Regular /> : <span className="w-5 h-5 block" />, onClick: () => setSortSel('most-recent') },
            { label: 'Type', icon: sortSel === 'type' ? <Checkmark20Regular /> : <span className="w-5 h-5 block" />, onClick: () => setSortSel('type') },
            { label: 'Group by', sectionLabel: true, dividerAbove: true },
            { label: 'Apps', icon: groupSel === 'apps' ? <Checkmark20Regular /> : <span className="w-5 h-5 block" />, onClick: () => setGroupSel('apps') },
            { label: 'Child agents', icon: groupSel === 'child-agents' ? <Checkmark20Regular /> : <span className="w-5 h-5 block" />, onClick: () => setGroupSel('child-agents') },
            { label: 'No grouping', icon: groupSel === 'no-grouping' ? <Checkmark20Regular /> : <span className="w-5 h-5 block" />, onClick: () => setGroupSel('no-grouping') },
          ]}
          position={{ top: pos.top, left: pos.left }}
          onClose={() => { setOpen(false); setPos(null); }}
          size="md"
          minWidth={180}
        />
      )}
    </>
  );
};

const CopilotMenuExample6 = () => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [subOpen, setSubOpen] = useState(false);
  const [subPos, setSubPos] = useState<{ top: number; left: number } | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => { if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; } };
  const scheduleClose = () => { closeTimerRef.current = setTimeout(() => setSubOpen(false), 200); };
  return (
    <>
      <button
        onClick={(e) => {
          if (open) { setOpen(false); setSubOpen(false); setPos(null); return; }
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setPos({ top: rect.bottom + 4, left: rect.left });
          setOpen(true);
        }}
        className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
      >
        <MoreHorizontal20Regular />
      </button>
      {open && pos && (
        <CopilotMenu
          items={[
            { label: 'Share', icon: <Share20Regular />, iconFilled: <Share20Filled />, onClick: () => {} },
            {
              label: 'Send to',
              icon: <Send20Regular />, iconFilled: <Send20Filled />,
              hasSubMenu: true,
              onMouseEnter: () => { cancelClose(); setSubPos({ top: pos.top + 4 + 36, left: pos.left + 200 }); setSubOpen(true); },
              onMouseLeave: scheduleClose,
            },
            { label: 'Delete', icon: <Delete20Regular />, iconFilled: <Delete20Filled />, onClick: () => {}, destructive: true, dividerAbove: true },
          ]}
          position={{ top: pos.top, left: pos.left }}
          onClose={() => { setOpen(false); setSubOpen(false); setPos(null); }}
          size="md"
          minWidth={200}
        />
      )}
      {subOpen && subPos && (
        <CopilotMenu
          items={[
            { label: 'Teams channel', onClick: () => {} },
            { label: 'Email', onClick: () => {} },
          ]}
          position={{ top: subPos.top, left: subPos.left }}
          onClose={() => setSubOpen(false)}
          size="md"
          minWidth={140}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      )}
    </>
  );
};

const CopilotMenuExample7 = () => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  return (
    <>
      <button
        onClick={(e) => {
          if (open) { setOpen(false); setPos(null); return; }
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setPos({ top: rect.bottom + 4, left: rect.left });
          setOpen(true);
        }}
        className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
      >
        <MoreHorizontal20Regular />
      </button>
      {open && pos && (
        <CopilotMenu
          position={{ top: pos.top, left: pos.left }}
          onClose={() => { setOpen(false); setPos(null); }}
          minWidth={220}
          header={
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">Benefits Handbook</p>
              <p className="text-xs text-gray-500 mt-0.5">SharePoint · Knowledge</p>
            </div>
          }
          items={[
            { label: 'Open', icon: <Open20Regular />, onClick: () => {} },
            { label: 'Edit', icon: <Edit20Regular />, iconFilled: <Edit20Filled />, onClick: () => {} },
            { label: 'Remove', icon: <Delete20Regular />, iconFilled: <Delete20Filled />, onClick: () => {}, destructive: true, dividerAbove: true },
          ]}
        />
      )}
    </>
  );
};

// ── Button type helper components ────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'transparent';

const TabPillExample = () => {
  const [active, setActive] = useState<'instructions' | 'components'>('instructions');
  return (
    <>
      <CopilotButton
        variant="tab-pill"
        size="sm"
        checked={active === 'instructions'}
        icon={<TextAlignLeft20Regular />}
        onClick={() => setActive('instructions')}
        aria-label="Instructions"
      >
        <span className={`whitespace-nowrap text-sm font-semibold ${active === 'instructions' ? 'text-gray-900' : 'text-gray-500'}`}>Instructions</span>
      </CopilotButton>
      <CopilotButton
        variant="tab-pill"
        size="sm"
        checked={active === 'components'}
        icon={<PuzzlePiece20Regular />}
        onClick={() => setActive('components')}
        aria-label="Components"
      >
        <span className={`whitespace-nowrap text-sm font-semibold ${active === 'components' ? 'text-gray-900' : 'text-gray-500'}`}>Components</span>
      </CopilotButton>
    </>
  );
};

const ToggleButtonExample = ({ variant, label }: { variant: ButtonVariant; label: string }) => {
  const [checked, setChecked] = useState(false);
  return (
    <CopilotButton variant={variant} checked={checked} onClick={() => setChecked(c => !c)}>
      {label}{checked ? ' ✓' : ''}
    </CopilotButton>
  );
};

const SplitButtonExample = ({ appearance, label }: { appearance: 'primary' | 'secondary' | 'outline' | 'transparent'; label: string }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <CopilotSplitButton
      appearance={appearance}
      menuOpen={menuOpen}
      onClick={() => {}}
      onMenuClick={() => setMenuOpen(o => !o)}
    >
      {label}
    </CopilotSplitButton>
  );
};

const CompoundToggleExample = ({ appearance, label, description }: { appearance: ButtonVariant; label: string; description: string }) => {
  const [checked, setChecked] = useState(false);
  return (
    <CopilotCompoundButton
      appearance={appearance}
      icon={<Compose24Regular />}
      secondaryContent={description}
      checked={checked}
      onClick={() => setChecked(c => !c)}
    >
      {label}{checked ? ' ✓' : ''}
    </CopilotCompoundButton>
  );
};

const DropdownExample1 = () => {
  const [selected, setSelected] = useState('all');
  return (
    <CopilotDropdown
      value={selected}
      onChange={setSelected}
      placeholder="Filter"
      options={[
        { label: 'All projects', value: 'all' },
        { label: 'Active', value: 'active' },
        { label: 'Archived', value: 'archived' },
        { label: 'Completed', value: 'completed' },
      ]}
    />
  );
};

const DropdownExample2 = () => {
  const [selected, setSelected] = useState('');
  return (
    <CopilotDropdown
      value={selected}
      onChange={setSelected}
      placeholder="Sort by"
      options={[
        { label: 'Name (A-Z)', value: 'name-asc' },
        { label: 'Name (Z-A)', value: 'name-desc' },
        { label: 'Date created', value: 'date-created' },
        { label: 'Date modified', value: 'date-modified' },
        { label: 'Size', value: 'size' },
      ]}
    />
  );
};

const DropdownExample3 = () => {
  const [selected, setSelected] = useState('30');
  return (
    <CopilotDropdown
      value={selected}
      onChange={setSelected}
      size="sm"
      options={[
        { label: 'Last 7 days', value: '7' },
        { label: 'Last 30 days', value: '30' },
        { label: 'Last 90 days', value: '90' },
        { label: 'Last year', value: '365' },
        { label: 'All time', value: 'all' },
      ]}
    />
  );
};

// ── CopilotSearchBox-style examples (CopilotInput + search icon + dismiss) ───
const SearchInputExample = ({ appearance = 'outline' as 'outline' | 'filled-darker' }) => {
  const [val, setVal] = useState('');
  const dismiss = val.length > 0 ? (
    <button
      type="button"
      tabIndex={-1}
      onMouseDown={(e) => { e.preventDefault(); setVal(''); }}
      className="flex items-center justify-center text-[#616161] hover:text-[#242424] transition-colors"
      aria-label="Clear search"
    >
      <Dismiss20Regular />
    </button>
  ) : undefined;
  return (
    <CopilotInput
      appearance={appearance}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      contentBefore={<Search20Regular />}
      contentAfter={dismiss}
      placeholder="Search..."
    />
  );
};

// CopilotTabs examples (original border-box style)
const TabsExample1 = () => {
  const [selected, setSelected] = useState('tab1');
  return (
    <CopilotTabs
      tabs={[{ label: 'Tab 1', value: 'tab1' }, { label: 'Tab 2', value: 'tab2' }, { label: 'Tab 3', value: 'tab3' }]}
      value={selected} onChange={setSelected} size="sm"
    />
  );
};
const TabsExample2 = () => {
  const [selected, setSelected] = useState('tab1');
  return (
    <CopilotTabs
      tabs={[{ label: 'Tab 1', value: 'tab1' }, { label: 'Tab 2', value: 'tab2' }, { label: 'Tab 3', value: 'tab3' }]}
      value={selected} onChange={setSelected} size="md"
    />
  );
};
const TabsExample3 = () => {
  const [selected, setSelected] = useState('tab1');
  return (
    <CopilotTabs
      tabs={[{ label: 'Tab 1', value: 'tab1' }, { label: 'Tab 2', value: 'tab2' }, { label: 'Tab 3', value: 'tab3' }]}
      value={selected} onChange={setSelected} size="lg"
    />
  );
};
const TabsExample4 = () => {
  const [selected, setSelected] = useState('build');
  return (
    <CopilotTabs
      tabs={[{ label: 'Build', value: 'build' }, { label: 'Preview', value: 'preview' }, { label: 'Evaluate', value: 'evaluate' }, { label: 'Monitor', value: 'monitor' }]}
      value={selected} onChange={setSelected} size="md"
    />
  );
};
const TabsExample5 = () => {
  const [selected, setSelected] = useState('all');
  return (
    <CopilotTabs
      tabs={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Completed', value: 'completed' }, { label: 'Archived', value: 'archived' }]}
      value={selected} onChange={setSelected} size="md"
    />
  );
};

// CopilotTabs collapsible example — resize the container to see overflow behaviour
const TabsCollapsibleExample = () => {
  const [selected, setSelected] = useState('/build');
  return (
    <div style={{ width: '100%', maxWidth: 480, resize: 'horizontal', overflow: 'auto', border: '1px dashed #E0E0E0', borderRadius: 8, padding: '12px 16px' }}>
      <p className="text-xs text-gray-400 mb-2 select-none">← drag to resize →</p>
      <CopilotTabs
        tabs={[
          { label: 'Build', value: '/build' },
          { label: 'Preview', value: '/preview' },
          { label: 'Evaluate', value: '/evaluate' },
          { label: 'Monitor', value: '/monitor' },
        ]}
        value={selected}
        onChange={setSelected}
        size="md"
        collapsible
      />
    </div>
  );
};

// CopilotUnderlineTabs examples
const UnderlineTabsSmExample = () => {
  const [selected, setSelected] = useState('overview');
  return (
    <CopilotUnderlineTabs
      tabs={[{ label: 'Overview', value: 'overview' }, { label: 'Tasks', value: 'tasks' }, { label: 'Knowledge', value: 'knowledge' }]}
      value={selected} onChange={setSelected} size="sm"
    />
  );
};
const UnderlineTabsMdExample = () => {
  const [selected, setSelected] = useState('overview');
  return (
    <CopilotUnderlineTabs
      tabs={[{ label: 'Overview', value: 'overview' }, { label: 'Tasks', value: 'tasks' }, { label: 'Knowledge', value: 'knowledge' }]}
      value={selected} onChange={setSelected} size="md"
    />
  );
};
const UnderlineTabsTrailingExample = () => {
  const [selected, setSelected] = useState('overview');
  return (
    <CopilotUnderlineTabs
      tabs={[{ label: 'Overview', value: 'overview' }, { label: 'Tasks', value: 'tasks' }, { label: 'Messages', value: 'messages' }, { label: 'Details', value: 'details' }]}
      value={selected} onChange={setSelected}
      trailing={<span className="text-xs text-gray-400">trailing slot</span>}
    />
  );
};
const UnderlineTabsDisabledExample = () => {
  const [selected, setSelected] = useState('overview');
  return (
    <CopilotUnderlineTabs
      tabs={[{ label: 'Overview', value: 'overview' }, { label: 'Tasks', value: 'tasks' }, { label: 'Archived', value: 'archived', disabled: true }]}
      value={selected} onChange={setSelected}
    />
  );
};

const UnderlineTabsNoIconExample = () => {
  const [selected, setSelected] = useState('overview');
  return (
    <CopilotUnderlineTabs
      tabs={[{ label: 'Overview', value: 'overview' }, { label: 'Tasks', value: 'tasks' }, { label: 'Knowledge', value: 'knowledge' }]}
      value={selected}
      onChange={setSelected}
    />
  );
};

const UnderlineTabsWithIconExample = () => {
  const [selected, setSelected] = useState('overview');
  return (
    <CopilotUnderlineTabs
      tabs={[
        { label: 'Overview', value: 'overview', icon: <Home20Regular /> },
        { label: 'Tasks', value: 'tasks', icon: <CheckmarkCircle20Regular /> },
        { label: 'Knowledge', value: 'knowledge', icon: <BookOpen20Regular /> },
      ]}
      value={selected}
      onChange={setSelected}
    />
  );
};

// CopilotFilterPill examples
const FilterPillSizeExample = ({ size }: { size: 'xs' | 'sm' | 'md' | 'lg' }) => {
  const [active, setActive] = useState('all');
  return (
    <>
      {['All', 'Knowledge', 'Tools', 'Agents'].map(label => (
        <CopilotFilterPill key={label} size={size} active={active === label.toLowerCase()} label={label} onClick={() => setActive(label.toLowerCase())} />
      ))}
    </>
  );
};

const FilterPillToggleExample = () => {
  const [active, setActive] = useState('all');
  return (
    <>
      {['All', 'Active', 'Completed', 'Archived'].map(label => (
        <CopilotFilterPill key={label} active={active === label.toLowerCase()} label={label} onClick={() => setActive(label.toLowerCase())} />
      ))}
    </>
  );
};

const FilterPillIconExample = () => {
  const [active, setActive] = useState('all');
  const items: Array<{ label: string; value: string; icon?: React.ReactNode }> = [
    { label: 'All', value: 'all' },
    { label: 'Agents', value: 'agents', icon: <Agents20Filled /> },
    { label: 'Workflows', value: 'workflows', icon: <Flow20Filled /> },
    { label: 'Knowledge', value: 'knowledge', icon: <BookOpen20Filled /> },
  ];
  return (
    <>
      {items.map(item => (
        <CopilotFilterPill key={item.value} active={active === item.value} label={item.label} icon={item.icon} onClick={() => setActive(item.value)} />
      ))}
    </>
  );
};

const FilterPillCountExample = () => {
  const [active, setActive] = useState('all');
  const items = [
    { label: 'All', value: 'all', count: 24 },
    { label: 'Agents', value: 'agents', count: 12 },
    { label: 'Workflows', value: 'workflows', count: 8 },
    { label: 'Knowledge', value: 'knowledge', count: 4 },
  ];
  return (
    <>
      {items.map(item => (
        <CopilotFilterPill key={item.value} active={active === item.value} label={item.label} count={item.count} onClick={() => setActive(item.value)} />
      ))}
    </>
  );
};

const FilterPillStatusExample = () => {
  const [active, setActive] = useState('all');
  const items = [
    { label: 'All',         value: 'all',         count: 12, activeClassName: undefined },
    { label: 'In Progress', value: 'in-progress',  count: 3,  activeClassName: 'bg-orange-50 text-orange-600 border border-orange-300' },
    { label: 'Upcoming',    value: 'upcoming',     count: 2,  activeClassName: 'bg-blue-50 text-blue-600 border border-blue-300' },
    { label: 'Complete',    value: 'complete',     count: 6,  activeClassName: 'bg-green-50 text-green-700 border border-green-300' },
    { label: 'Incomplete',  value: 'incomplete',   count: 1,  activeClassName: 'bg-red-50 text-red-600 border border-red-300' },
  ];
  return (
    <>
      {items.map(item => (
        <CopilotFilterPill
          key={item.value}
          active={active === item.value}
          label={item.label}
          count={item.count}
          size="sm"
          activeClassName={item.activeClassName}
          onClick={() => setActive(item.value)}
        />
      ))}
    </>
  );
};

const TableExample = () => {
  const [selectedRow, setSelectedRow] = useState<number | undefined>(0);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [sortedData, setSortedData] = useState([
    { id: 1, name: 'Alice Johnson', role: 'Product Manager', department: 'Product', status: 'Active', lastActive: '2 hours ago' },
    { id: 2, name: 'Bob Smith', role: 'Software Engineer', department: 'Engineering', status: 'Active', lastActive: '1 hour ago' },
    { id: 3, name: 'Carol Davis', role: 'UX Designer', department: 'Design', status: 'Away', lastActive: '3 days ago' },
    { id: 4, name: 'David Wilson', role: 'DevOps Engineer', department: 'Engineering', status: 'Active', lastActive: '30 min ago' },
    { id: 5, name: 'Eve Martinez', role: 'Marketing Manager', department: 'Marketing', status: 'Offline', lastActive: '1 week ago' },
    { id: 6, name: 'Frank Okonkwo', role: 'Senior Principal Distinguished Staff Software Engineer (Platform Infrastructure)', department: 'Engineering', status: 'Active', lastActive: '5 min ago' },
  ]);

  const handleSort = (columnKey: string, direction: 'asc' | 'desc' | null) => {
    if (!direction) {
      // Reset to original order
      setSortedData([
        { id: 1, name: 'Alice Johnson', role: 'Product Manager', department: 'Product', status: 'Active', lastActive: '2 hours ago' },
        { id: 2, name: 'Bob Smith', role: 'Software Engineer', department: 'Engineering', status: 'Active', lastActive: '1 hour ago' },
        { id: 3, name: 'Carol Davis', role: 'UX Designer', department: 'Design', status: 'Away', lastActive: '3 days ago' },
        { id: 4, name: 'David Wilson', role: 'DevOps Engineer', department: 'Engineering', status: 'Active', lastActive: '30 min ago' },
        { id: 5, name: 'Eve Martinez', role: 'Marketing Manager', department: 'Marketing', status: 'Offline', lastActive: '1 week ago' },
        { id: 6, name: 'Frank Okonkwo', role: 'Senior Principal Distinguished Staff Software Engineer (Platform Infrastructure)', department: 'Engineering', status: 'Active', lastActive: '5 min ago' },
      ]);
      return;
    }

    const sorted = [...sortedData].sort((a, b) => {
      const aValue = a[columnKey as keyof typeof a];
      const bValue = b[columnKey as keyof typeof b];

      if (direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setSortedData(sorted);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Default Size (Medium)</h3>
        <p className="text-xs text-gray-500 mb-3">Click column headers to sort. Click multiple times to cycle through ascending, descending, and no sort.</p>
        <CopilotTable
          columns={[
            { key: 'name', label: 'Name', sortable: true, width: '200px' },
            { key: 'role', label: 'Role', sortable: true, width: '180px' },
            { key: 'department', label: 'Department', sortable: true, width: '150px' },
            {
              key: 'status',
              label: 'Status',
              sortable: true,
              width: '120px',
              render: (value) => (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  value === 'Active' ? 'bg-green-100 text-green-800' :
                  value === 'Away' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {value}
                </span>
              )
            },
            { key: 'lastActive', label: 'Last Active', sortable: false },
          ]}
          data={sortedData}
          onSort={handleSort}
          onRowClick={(_row, index) => setSelectedRow(index)}
          selectedRowIndex={selectedRow}
          size="md"
        />
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Small Size</h3>
        <CopilotTable
          columns={[
            { key: 'name', label: 'Name', sortable: true },
            { key: 'role', label: 'Role', sortable: true },
            { key: 'status', label: 'Status', sortable: true },
          ]}
          data={sortedData.slice(0, 3)}
          size="sm"
        />
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Large Size</h3>
        <CopilotTable
          columns={[
            { key: 'name', label: 'Name', sortable: true },
            { key: 'role', label: 'Role', sortable: true },
            { key: 'department', label: 'Department', sortable: true },
          ]}
          data={sortedData.slice(0, 3)}
          size="lg"
        />
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Horizontal Scroll (many columns)</h3>
        <p className="text-xs text-gray-500 mb-3">When columns exceed the container width the table scrolls horizontally. Header text does not wrap.</p>
        <CopilotTable
          columns={[
            { key: 'name', label: 'Full Name', sortable: true, width: '160px' },
            { key: 'role', label: 'Job Title / Role', sortable: true, width: '200px' },
            { key: 'department', label: 'Department / Business Unit', sortable: true, width: '200px' },
            { key: 'status', label: 'Employment Status', sortable: true, width: '160px' },
            { key: 'lastActive', label: 'Last Active Timestamp', sortable: false, width: '180px' },
            { key: 'id', label: 'Employee ID', sortable: true, width: '120px' },
          ]}
          data={sortedData}
          size="md"
        />
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Row Hover Detection</h3>
        <p className="text-xs text-gray-500 mb-3">Use <code>onRowHover</code> and <code>onRowLeave</code> to detect which row the user is hovering. Useful for showing contextual actions (e.g. overflow menus).</p>
        <CopilotTable
          columns={[
            { key: 'name', label: 'Name', sortable: true },
            { key: 'role', label: 'Role', sortable: true },
            {
              key: 'actions',
              label: '',
              width: '60px',
              render: (_value, row) => (
                <span className={hoveredRow !== null && sortedData[hoveredRow]?.id === row.id ? 'opacity-100' : 'opacity-0'}>
                  ⋯
                </span>
              ),
            },
          ]}
          data={sortedData.slice(0, 4)}
          onRowHover={(_row, index) => setHoveredRow(index)}
          onRowLeave={() => setHoveredRow(null)}
          size="md"
        />
        {hoveredRow !== null && (
          <p className="text-xs text-gray-500 mt-2">Hovering row {hoveredRow}: {sortedData[hoveredRow]?.name}</p>
        )}
      </div>
    </div>
  );
};

const ShowcaseFeedbackUp: React.FC = () => {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const btn = ref.current?.querySelector<HTMLButtonElement>('button:first-child');
    btn?.click();
  }, []);
  return (
    <div ref={ref}>
      <CopilotMessage role="assistant" content="I can help you with that!" agentName="Copilot" skipEntranceAnimation showFeedback />
    </div>
  );
};

const ShowcaseFeedbackDown: React.FC = () => {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const btn = ref.current?.querySelector<HTMLButtonElement>('button:last-child');
    btn?.click();
  }, []);
  return (
    <div ref={ref}>
      <CopilotMessage role="assistant" content="Sorry, I couldn't find what you were looking for." agentName="Copilot" skipEntranceAnimation showFeedback />
    </div>
  );
};

const ToastShowcaseDemo: React.FC = () => {
  const { addToast, updateToast } = useToast();

  const fireProgressDemo = () => {
    const id = addToast({ variant: 'progress', title: 'Uploading file…', progress: 0, duration: 0 });
    let pct = 0;
    const tick = setInterval(() => {
      pct = Math.min(100, pct + Math.floor(Math.random() * 15) + 5);
      updateToast(id, { progress: pct, progressLabel: `Uploading… ${pct}%` });
      if (pct >= 100) {
        updateToast(id, { title: 'Upload complete', progress: 100, progressLabel: undefined });
        clearInterval(tick);
      }
    }, 400);
  };

  return (
    <div className="flex flex-wrap gap-3">
      <CopilotButton variant="secondary" size="sm" onClick={() => addToast({ variant: 'success', title: 'Agent published', message: 'Your agent is now live and accessible.' })}>
        Success
      </CopilotButton>
      <CopilotButton variant="secondary" size="sm" onClick={() => addToast({ variant: 'error', title: 'Something went wrong', message: 'Could not save changes. Please try again.' })}>
        Error
      </CopilotButton>
      <CopilotButton variant="secondary" size="sm" onClick={() => addToast({ variant: 'warning', title: 'Unsaved changes', message: 'You have unsaved changes that will be lost.' })}>
        Warning
      </CopilotButton>
      <CopilotButton variant="secondary" size="sm" onClick={() => addToast({ variant: 'info', title: 'New version available', message: 'Refresh to get the latest features.' })}>
        Info
      </CopilotButton>
      <CopilotButton variant="secondary" size="sm" onClick={() => addToast({ variant: 'info', title: 'Persistent toast', message: 'This one stays until dismissed.', duration: 0 })}>
        Persistent
      </CopilotButton>
      <CopilotButton variant="secondary" size="sm" onClick={() => addToast({ variant: 'success', title: 'Update available', action: { label: 'Refresh', onClick: () => window.location.reload() } })}>
        With action
      </CopilotButton>
      <CopilotButton variant="secondary" size="sm" onClick={() => addToast({ variant: 'progress', title: 'Syncing…', message: 'Indeterminate spinner', duration: 0 })}>
        Progress (indeterminate)
      </CopilotButton>
      <CopilotButton variant="secondary" size="sm" onClick={fireProgressDemo}>
        Progress (animated bar)
      </CopilotButton>
    </div>
  );
};

const NotificationPopoverShowcaseDemo: React.FC = () => {
  const { addToast, notifications, unreadCount } = useToast();
  const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);

  const openPanel = () => {
    setAnchorRect(btnRef.current?.getBoundingClientRect() ?? null);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <CopilotButton variant="secondary" size="sm" onClick={() => addToast({ variant: 'success', title: 'Agent published' })}>
          Add success notification
        </CopilotButton>
        <CopilotButton variant="secondary" size="sm" onClick={() => addToast({ variant: 'error', title: 'Something went wrong', message: 'Could not save changes.' })}>
          Add error notification
        </CopilotButton>
        <CopilotButton variant="secondary" size="sm" onClick={() => addToast({ variant: 'info', title: 'New feature available', message: 'Check it out in the settings.' })}>
          Add info notification
        </CopilotButton>
        <CopilotButton variant="secondary" size="sm" onClick={() => addToast({ variant: 'error', title: '5 active errors', message: '1 publish blocker, 1 action failure', duration: 0, action: { label: 'Fix with Copilot', onClick: () => alert('Fix with Copilot clicked') } })}>
          Add actionable notification
        </CopilotButton>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative inline-flex">
          <button
            ref={btnRef}
            onClick={open ? () => setOpen(false) : openPanel}
            className="relative p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C15.866 2 19 5.134 19 9v4l1.5 3.25c.077.167.115.347.115.531 0 .69-.56 1.25-1.25 1.25H14.5c0 1.657-1.343 3-3 3s-3-1.343-3-3H2.635a1.25 1.25 0 01-1.135-1.781L3 13V9C3 5.134 6.134 2 10 2h2z" fill="#616161"/>
            </svg>
            {unreadCount > 0 && !open && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white" />
            )}
          </button>
        </div>
        <span className="text-sm text-gray-500">{unreadCount > 0 ? `${unreadCount} unread` : 'No unread notifications'} · {notifications.length} total</span>
      </div>
      {open && (
        <NotificationPopover anchorRect={anchorRect} onClose={() => setOpen(false)} />
      )}
    </div>
  );
};

const ToggleShowcaseExample: React.FC<{ size?: 'sm' | 'md'; label?: string; defaultChecked?: boolean }> = ({ size = 'sm', label, defaultChecked = false }) => {
  const [checked, setChecked] = React.useState(defaultChecked);
  return (
    <CopilotToggle
      checked={checked}
      onChange={setChecked}
      size={size}
      label={label}
      aria-label={label ?? `Toggle ${size}`}
    />
  );
};

const DEMO_TEXT_ITEMS = [
  { id: '1', label: 'Yes, go ahead' },
  { id: '2', label: 'No, let me reconsider' },
  { id: '3', label: 'Tell me more about this option' },
];

const DEMO_SINGLE_ITEMS = [
  { id: 'teams', label: 'When a user messages in Teams', description: 'Microsoft Teams', icon: '/component-icons/Teams24.svg' },
  { id: 'outlook', label: 'When a new email arrives', description: 'Office 365 Outlook', icon: '/component-icons/Outlook24.svg' },
  { id: 'forms', label: 'When a form response is submitted', description: 'Microsoft Forms', icon: '/component-icons/Forms24.svg' },
];

const DEMO_MULTI_ITEMS = [
  { id: 'sp1', label: 'Q4 Sales Report.xlsx', description: 'SharePoint', icon: '/component-icons/SharePoint24.svg' },
  { id: 'od1', label: 'Customer Feedback Summary', description: 'OneDrive', icon: '/component-icons/OneDrive24.svg' },
  { id: 'od2', label: 'Product Roadmap 2025.pptx', description: 'OneDrive', icon: '/component-icons/OneDrive24.svg' },
  { id: 'sp2', label: 'A very long document name that will be truncated — hover to see the full label in a tooltip', description: 'SharePoint', icon: '/component-icons/SharePoint24.svg' },
];

const DEMO_PREVIEW_ITEMS = [
  { id: 'p1', label: 'What\'s my PTO balance?', description: 'Preview', icon: React.createElement(Chat20Regular, { style: { width: 20, height: 20, color: '#616161' } }) },
  { id: 'p2', label: 'Submit a leave request', description: 'Preview', icon: React.createElement(Chat20Regular, { style: { width: 20, height: 20, color: '#616161' } }) },
  { id: 'p3', label: 'Show last month\'s report', description: 'Preview', icon: React.createElement(Chat20Regular, { style: { width: 20, height: 20, color: '#616161' } }) },
];

type DemoMode = 'text' | 'single' | 'multi' | 'preview';

const EnhancedInputSuggestionDebugPanel: React.FC = () => {
  const [activeMode, setActiveMode] = React.useState<DemoMode>('text');
  const [key, setKey] = React.useState(0); // reset component state on mode change

  const switchMode = (mode: DemoMode) => {
    setActiveMode(mode);
    setKey(k => k + 1);
  };

  const itemsMap: Record<DemoMode, typeof DEMO_TEXT_ITEMS> = {
    text: DEMO_TEXT_ITEMS,
    single: DEMO_SINGLE_ITEMS,
    multi: DEMO_MULTI_ITEMS,
    preview: DEMO_PREVIEW_ITEMS,
  };

  const modeLabels: Record<DemoMode, string> = {
    text: 'Text suggestions',
    single: 'Single-select',
    multi: 'Multi-select',
    preview: 'Preview suggestions',
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Mode switcher */}
      <div className="flex gap-2 flex-wrap">
        {(['text', 'preview', 'single', 'multi'] as DemoMode[]).map(mode => (
          <CopilotButton
            key={mode}
            variant={activeMode === mode ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => switchMode(mode)}
          >
            {modeLabels[mode]}
          </CopilotButton>
        ))}
      </div>

      {/* Demo render — 400px container shows full-width expansion when items have descriptions */}
      <div style={{ width: 400 }}>
        <EnhancedInputSuggestionList
          key={key}
          mode={activeMode === 'preview' ? 'text' : activeMode}
          items={itemsMap[activeMode]}
          onSelect={(id) => console.log('selected:', id)}
          onSubmit={(ids) => console.log('submitted:', ids)}
        />
      </div>
    </div>
  );
};
