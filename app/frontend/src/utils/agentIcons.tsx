import React from 'react';
import { callModel } from './modelClient';
import { SYSTEM_COLOR_ICONS } from './systemColorIcons';
import { DigitalWorker20Regular, DigitalWorker20Filled } from '../assets/icons/digital-worker';
import {
  // Existing domain icons - Regular variants
  People20Regular,
  Desktop20Regular,
  ArrowTrendingLines20Regular,
  Money20Regular,
  Gavel20Regular,
  Megaphone20Regular,
  Headset20Regular,
  Stethoscope20Regular,
  ShieldCheckmark20Regular,
  HatGraduation20Regular,
  Building20Regular,
  Airplane20Regular,
  DataBarVertical20Regular,
  ClipboardTask20Regular,
  Box20Regular,
  DocumentText20Regular,
  PaintBrush20Regular,
  DocumentSearch20Regular,
  Flow20Regular,
  Bot20Regular,
  PersonSearch20Regular,
  Cart20Regular,
  ShieldLock20Regular,
  Code20Regular,
  Settings20Regular,
  PersonHeart20Regular,
  CalendarStar20Regular,
  Bug20Regular,
  Lightbulb20Regular,
  BookOpen20Regular,
  Agents20Regular,
  Calendar20Regular,
  Document20Regular,
  DocumentCheckmark20Regular,
  ScanDash20Regular,
  Translate20Regular,
  Toolbox20Regular,
  Cloud20Regular,
  LockClosed20Regular,
  MailInbox20Regular,

  // Existing domain icons - Filled variants
  People20Filled,
  Desktop20Filled,
  ArrowTrendingLines20Filled,
  Money20Filled,
  Gavel20Filled,
  Megaphone20Filled,
  Headset20Filled,
  Stethoscope20Filled,
  ShieldCheckmark20Filled,
  HatGraduation20Filled,
  Building20Filled,
  Airplane20Filled,
  DataBarVertical20Filled,
  ClipboardTask20Filled,
  Box20Filled,
  DocumentText20Filled,
  PaintBrush20Filled,
  DocumentSearch20Filled,
  Flow20Filled,
  Bot20Filled,
  PersonSearch20Filled,
  Cart20Filled,
  ShieldLock20Filled,
  Code20Filled,
  Settings20Filled,
  PersonHeart20Filled,
  CalendarStar20Filled,
  Bug20Filled,
  Lightbulb20Filled,
  BookOpen20Filled,
  Agents20Filled,
  Calendar20Filled,
  Document20Filled,
  DocumentCheckmark20Filled,
  ScanDash20Filled,
  Translate20Filled,
  Toolbox20Filled,
  Cloud20Filled,
  LockClosed20Filled,
  MailInbox20Filled,

  // Phase 1: New domain icons - Regular variants
  BookDatabase20Regular,
  Steps20Regular,
  Star20Regular,
  TicketDiagonal20Regular,
  Search20Regular,
  Alert20Regular,
  FolderOpen20Regular,
  Database20Regular,

  // Phase 1: New domain icons - Filled variants
  BookDatabase20Filled,
  Steps20Filled,
  Star20Filled,
  TicketDiagonal20Filled,
  Search20Filled,
  Alert20Filled,
  FolderOpen20Filled,
  Database20Filled,
} from '@fluentui/react-icons';

// Custom SVG template icons from Figma "Templates.Icons" component
import { ReactComponent as WeatherIcon } from '../assets/template-icons/weather.svg';
import { ReactComponent as TeamNavigatorIcon } from '../assets/template-icons/team-navigator.svg';
import { ReactComponent as SafeTravelsIcon } from '../assets/template-icons/safe-travels.svg';
import { ReactComponent as WellnessCheckIcon } from '../assets/template-icons/wellness-check.svg';
import { ReactComponent as StatusTrackerIcon } from '../assets/template-icons/status-tracker.svg';
import { ReactComponent as EducationIcon } from '../assets/template-icons/education.svg';
import { ReactComponent as StoreOperationsIcon } from '../assets/template-icons/store-operations.svg';
import { ReactComponent as SustainabilityInsightsIcon } from '../assets/template-icons/sustainability-insights.svg';
import { ReactComponent as BookIcon } from '../assets/template-icons/book.svg';
import { ReactComponent as TruckIcon } from '../assets/template-icons/truck.svg';
import { ReactComponent as TrophyIcon } from '../assets/template-icons/trophy.svg';
import { ReactComponent as ThumbsLikeDislikeIcon } from '../assets/template-icons/thumbs-like-dislike.svg';
import { ReactComponent as WindowSettingsIcon } from '../assets/template-icons/window-settings.svg';
import { ReactComponent as SelfHelpIcon } from '../assets/template-icons/self-help.svg';
import { ReactComponent as ManufacturingIcon } from '../assets/template-icons/manufacturing.svg';
import { ReactComponent as WebsiteQaIcon } from '../assets/template-icons/website-qa.svg';
import { ReactComponent as FinancialInsightsIcon } from '../assets/template-icons/financial-insights.svg';
import { ReactComponent as VoiceIcon } from '../assets/template-icons/voice.svg';
import { ReactComponent as InclusivityIcon } from '../assets/template-icons/inclusivity.svg';
import { ReactComponent as BenefitsIcon } from '../assets/template-icons/benefits.svg';
import { ReactComponent as CaseManagementIcon } from '../assets/template-icons/case-management.svg';
import { ReactComponent as SalesforceDuplicateIcon } from '../assets/template-icons/salesforce-duplicate.svg';
import { ReactComponent as SupplyChainIcon } from '../assets/template-icons/supply-chain.svg';
import { ReactComponent as KudosIcon } from '../assets/template-icons/kudos.svg';
import { ReactComponent as FilterIcon } from '../assets/template-icons/filter.svg';
import { ReactComponent as PrioritizationIcon } from '../assets/template-icons/prioritization.svg';
import { ReactComponent as ComparisonIcon } from '../assets/template-icons/comparison.svg';
import { ReactComponent as QuestionSourcesIcon } from '../assets/template-icons/question-sources.svg';
import { ReactComponent as DecisionIcon } from '../assets/template-icons/decision.svg';
import { ReactComponent as CitizenServicesIcon } from '../assets/template-icons/citizen-services.svg';
import { ReactComponent as GongIcon } from '../assets/template-icons/gong.svg';
import { ReactComponent as WorkflowIcon } from '../assets/template-icons/workflow.svg';

// Detect agent domain from name, purpose, or instructions
export const detectAgentDomain = (agentConfig: { name?: string; purpose?: string; instructions?: string; description?: string }): string => {
  const text = `${agentConfig.name || ''} ${agentConfig.purpose || ''} ${agentConfig.instructions || ''} ${agentConfig.description || ''}`.toLowerCase();

  // Prioritize name field for primary classification (most specific)
  const nameText = (agentConfig.name || '').toLowerCase();

  // Knowledge Management
  if (text.match(/\b(knowledge base|knowledge management|wiki|faq|faqs|frequently asked|help center|help documentation|documentation system|docs|knowledge hub)\b/)) {
    return 'knowledge';
  }

  // Onboarding (check before HR to be more specific)
  if (text.match(/\b(onboarding|onboard|getting started|welcome|walkthrough|user activation|new user|new employee|new hire)\b/)) {
    return 'onboarding';
  }

  // Feedback & Reviews
  if (text.match(/\b(feedback|review|rating|survey|poll|nps|net promoter|satisfaction|customer review|product review|performance review)\b/)) {
    return 'feedback';
  }

  // Ticketing Systems
  if (text.match(/\b(ticket|ticketing|incident|issue tracking|helpdesk ticket|support ticket|service ticket|it ticket)\b/)) {
    return 'tickets';
  }

  // Search & Discovery
  if (text.match(/\b(search|find|discover|discovery|lookup|query|filter|search engine)\b/)) {
    return 'search';
  }

  // Notifications & Alerts (check before monitoring for specificity)
  if (text.match(/\b(notification|notify|alert system|push notification|bell|reminder|announcement)\b/)) {
    return 'notifications';
  }

  // File Management
  if (text.match(/\b(file management|file system|document storage|file sharing|attachment|upload|download|file browser)\b/)) {
    return 'files';
  }

  // Database Management
  if (text.match(/\b(database|db|database management|query|sql|nosql|data storage|table)\b/)) {
    return 'database';
  }

  // HR & People (check after onboarding to avoid conflicts)
  if (nameText.match(/\b(hr|human resources|employee|recruitment|hiring|benefits|payroll|people operations|talent)\b/) ||
      text.match(/\b(hr|human resources|employee|recruitment|hiring|benefits|payroll|people operations|talent)\b/)) {
    return 'hr';
  }

  // Data & Analytics
  if (text.match(/\b(data|analytics|analys[ie]s|reporting|dashboard|metric|insight|business intelligence|bi)\b/)) {
    return 'data';
  }

  // Project Management
  if (text.match(/\b(project|task|milestone|planning|scrum|agile|coordination|workflow automation)\b/)) {
    return 'project';
  }

  // IT & Technical Support
  if (text.match(/\b(it|tech|technical|support|hardware|software|computer|laptop|network|helpdesk|infrastructure|troubleshoot)\b/)) {
    return 'it';
  }

  // Sales & CRM
  if (text.match(/\b(sales|crm|lead|prospect|revenue|deal|opportunity|pipeline|outreach)\b/)) {
    return 'sales';
  }

  // Finance & Accounting
  if (text.match(/\b(finance|accounting|invoice|billing|payment|expense|budget|financial|bookkeeping)\b/)) {
    return 'finance';
  }

  // Legal & Compliance
  if (text.match(/\b(legal|compliance|contract|regulation|policy|law|attorney|counsel|governance)\b/)) {
    return 'legal';
  }

  // Marketing
  if (text.match(/\b(marketing|campaign|brand|social media|content|advertising|seo|promotion|engagement)\b/)) {
    return 'marketing';
  }

  // Chat Bot
  if (text.match(/\b(chatbot|chat bot|conversational bot|virtual assistant|chat agent)\b/)) {
    return 'chatbot';
  }

  // Email & Messaging
  if (text.match(/\b(email|e-mail|inbox|mail triage|mail routing|newsletter|mailing list|email campaign|email triage|email automation)\b/)) {
    return 'email';
  }

  // Scheduling & Time Management
  if (text.match(/\b(schedule|scheduler|scheduling|meeting|appointment|calendar|availability|time slot|agenda|planner|reminder|attendance)\b/)) {
    return 'scheduling';
  }

  // Document Management & Processing
  if (text.match(/\b(document approval|document management|document review|contract approval|form filing|pdf|signature|e-signature|notarize|filing|document processing)\b/)) {
    return 'documents';
  }

  // Approvals & Authorization
  if (text.match(/\b(approval|approve|authorize|sign-off|reviewer|escalat|pending review|budget approval|purchase order|requisition|change request)\b/)) {
    return 'approvals';
  }

  // Monitoring & Alerts
  if (text.match(/\b(monitor|monitoring|alert|health check|nps|net promoter|watchlist|threshold|surveillance|real-time track|system health|uptime|status check)\b/)) {
    return 'monitoring';
  }

  // Language & NLP
  if (text.match(/\b(translat|language|grammar|spelling|nlp|multilingual|localization|spell check|grammar check|text processing|linguistic)\b/)) {
    return 'language';
  }

  // Procurement & Supply Chain
  if (text.match(/\b(procurement|vendor|supplier|rfq|request for quote|purchase requisition|sourcing|vendor onboard|supplier evaluat)\b/)) {
    return 'procurement';
  }

  // Infrastructure & Deployment
  if (text.match(/\b(deploy|deployment|infrastructure|provisioning|migration|cloud|kubernetes|docker|ci\/cd|release management|server|staging|production environment)\b/)) {
    return 'infrastructure';
  }

  // Compliance & Governance
  if (text.match(/\b(compliance|regulatory|governance|audit trail|risk assessment|sox|hipaa|gdpr|iso|soc2|vulnerability assessment|penetration test|disaster recovery)\b/)) {
    return 'compliance';
  }

  // Customer Service
  if (text.match(/\b(customer service|customer support|help desk|ticket|inquiry|complaint|satisfaction)\b/)) {
    return 'customer-service';
  }

  // Healthcare
  if (text.match(/\b(health|medical|patient|doctor|nurse|clinic|hospital|healthcare|wellness|diagnosis)\b/)) {
    return 'healthcare';
  }

  // Insurance & Claims
  if (text.match(/\b(insurance|claim|policy|coverage|premium|underwriting|adjuster)\b/)) {
    return 'insurance';
  }

  // Education
  if (text.match(/\b(education|student|teacher|course|learning|tutor|academic|curriculum|quiz|grading|plagiarism)\b/)) {
    return 'education';
  }

  // Real Estate
  if (text.match(/\b(real estate|property|housing|lease|rent|mortgage|realtor)\b/)) {
    return 'real-estate';
  }

  // Travel
  if (text.match(/\b(travel|flight|hotel|booking|reservation|tourism|vacation|itinerary)\b/)) {
    return 'travel';
  }

  // Operations & Logistics
  if (text.match(/\b(operations|logistics|supply chain|inventory|shipping|fulfillment|warehouse|capacity plan|workload|resource allocat)\b/)) {
    return 'operations';
  }

  // Content & Writing
  if (text.match(/\b(writing|content creation|copywriting|blog|article|documentation|technical writing|publish)\b/)) {
    return 'content';
  }

  // Design & Creative
  if (text.match(/\b(design|creative|graphic|visual|ui|ux|branding|illustration)\b/)) {
    return 'design';
  }

  // Research
  if (text.match(/\b(research|investigation|study|findings|literature review|competitive intelligence)\b/)) {
    return 'research';
  }

  // Automation & Computer Use
  if (text.match(/\b(automat|computer-using|browser|application|interface|api|integration)\b/)) {
    return 'automation';
  }

  // Autonomous Agent
  if (text.match(/\b(autonomous|independent|self-directed|ai agent)\b/)) {
    return 'autonomous';
  }

  // Recruiting & Talent
  if (text.match(/\b(recruit|talent|candidate|interview|applicant|ats|hiring pipeline|resume screen)\b/)) {
    return 'recruiting';
  }

  // E-commerce & Retail
  if (text.match(/\b(ecommerce|e-commerce|retail|shop|store|product catalog|cart|checkout|order)\b/)) {
    return 'ecommerce';
  }

  // Security
  if (text.match(/\b(security|cybersecurity|audit|vulnerability|threat|firewall|encryption|incident response)\b/)) {
    return 'security';
  }

  // DevOps & Engineering
  if (text.match(/\b(devops|code review|ci\/cd|pipeline|engineering|version control|git|build)\b/)) {
    return 'devops';
  }

  // Manufacturing & Production
  if (text.match(/\b(manufacturing|production|factory|assembly|quality control|industrial)\b/)) {
    return 'manufacturing';
  }

  // Customer Success
  if (text.match(/\b(customer success|retention|adoption|account management|churn|renewal)\b/)) {
    return 'customer-success';
  }

  // Communications & PR
  if (text.match(/\b(communications|pr|public relations|media|press|spokesperson|feedback|survey)\b/)) {
    return 'communications';
  }

  // Event Management
  if (text.match(/\b(event|conference|venue|registration|attendee|webinar|seminar|workshop|sponsorship)\b/)) {
    return 'events';
  }

  // Quality Assurance
  if (text.match(/\b(qa|quality assurance|testing|test automation|bug|defect|test case|regression|user testing)\b/)) {
    return 'qa';
  }

  // Product Management
  if (text.match(/\b(product management|roadmap|feature|backlog|user story|sprint|product launch|product return|warranty)\b/)) {
    return 'product';
  }

  // Training & Development
  if (text.match(/\b(training|development|learning management|skill|certification|coaching|lms|learning path|professional development)\b/)) {
    return 'training';
  }

  return 'generic';
};

// Map domain to Fluent UI icon component (Regular and Filled variants)
export const domainIconMap: Record<string, {
  regular: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  filled: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}> = {
  // Existing domains with filled variants
  'hr': { regular: People20Regular, filled: People20Filled },
  'it': { regular: Desktop20Regular, filled: Desktop20Filled },
  'sales': { regular: ArrowTrendingLines20Regular, filled: ArrowTrendingLines20Filled },
  'finance': { regular: Money20Regular, filled: Money20Filled },
  'legal': { regular: Gavel20Regular, filled: Gavel20Filled },
  'marketing': { regular: Megaphone20Regular, filled: Megaphone20Filled },
  'customer-service': { regular: Headset20Regular, filled: Headset20Filled },
  'healthcare': { regular: Stethoscope20Regular, filled: Stethoscope20Filled },
  'insurance': { regular: ShieldCheckmark20Regular, filled: ShieldCheckmark20Filled },
  'education': { regular: HatGraduation20Regular, filled: HatGraduation20Filled },
  'real-estate': { regular: Building20Regular, filled: Building20Filled },
  'travel': { regular: Airplane20Regular, filled: Airplane20Filled },
  'data': { regular: DataBarVertical20Regular, filled: DataBarVertical20Filled },
  'project': { regular: ClipboardTask20Regular, filled: ClipboardTask20Filled },
  'operations': { regular: Box20Regular, filled: Box20Filled },
  'content': { regular: DocumentText20Regular, filled: DocumentText20Filled },
  'design': { regular: PaintBrush20Regular, filled: PaintBrush20Filled },
  'research': { regular: DocumentSearch20Regular, filled: DocumentSearch20Filled },
  'automation': { regular: Flow20Regular, filled: Flow20Filled },
  'recruiting': { regular: PersonSearch20Regular, filled: PersonSearch20Filled },
  'ecommerce': { regular: Cart20Regular, filled: Cart20Filled },
  'security': { regular: ShieldLock20Regular, filled: ShieldLock20Filled },
  'devops': { regular: Code20Regular, filled: Code20Filled },
  'manufacturing': { regular: Settings20Regular, filled: Settings20Filled },
  'customer-success': { regular: PersonHeart20Regular, filled: PersonHeart20Filled },
  'communications': { regular: Megaphone20Regular, filled: Megaphone20Filled },
  'events': { regular: CalendarStar20Regular, filled: CalendarStar20Filled },
  'qa': { regular: Bug20Regular, filled: Bug20Filled },
  'product': { regular: Lightbulb20Regular, filled: Lightbulb20Filled },
  'training': { regular: BookOpen20Regular, filled: BookOpen20Filled },
  'chatbot': { regular: Bot20Regular, filled: Bot20Filled },
  'scheduling': { regular: Calendar20Regular, filled: Calendar20Filled },
  'documents': { regular: Document20Regular, filled: Document20Filled },
  'approvals': { regular: DocumentCheckmark20Regular, filled: DocumentCheckmark20Filled },
  'monitoring': { regular: ScanDash20Regular, filled: ScanDash20Filled },
  'language': { regular: Translate20Regular, filled: Translate20Filled },
  'procurement': { regular: Toolbox20Regular, filled: Toolbox20Filled },
  'infrastructure': { regular: Cloud20Regular, filled: Cloud20Filled },
  'compliance': { regular: LockClosed20Regular, filled: LockClosed20Filled },
  'email': { regular: MailInbox20Regular, filled: MailInbox20Filled },
  'digital-worker': { regular: DigitalWorker20Regular, filled: DigitalWorker20Filled },
  'generic': { regular: Agents20Regular, filled: Agents20Filled },

  // Phase 1: New domains
  'knowledge': { regular: BookDatabase20Regular, filled: BookDatabase20Filled },
  'onboarding': { regular: Steps20Regular, filled: Steps20Filled },
  'feedback': { regular: Star20Regular, filled: Star20Filled },
  'tickets': { regular: TicketDiagonal20Regular, filled: TicketDiagonal20Filled },
  'search': { regular: Search20Regular, filled: Search20Filled },
  'notifications': { regular: Alert20Regular, filled: Alert20Filled },
  'files': { regular: FolderOpen20Regular, filled: FolderOpen20Filled },
  'database': { regular: Database20Regular, filled: Database20Filled },
};

// Template icons from Figma "Templates.Icons" component (custom SVGs)
export const templateIconMap: Record<string, { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties; width?: number; height?: number }>; label: string; noScale?: boolean }> = {
  'weather':                { icon: WeatherIcon,                label: 'Weather' },
  'team-navigator':         { icon: TeamNavigatorIcon,          label: 'Team navigator' },
  'safe-travels':           { icon: SafeTravelsIcon,            label: 'Safe travels' },
  'wellness-check':         { icon: WellnessCheckIcon,          label: 'Wellness Check' },
  'status-tracker':         { icon: StatusTrackerIcon,          label: 'Status tracker' },
  'education':              { icon: EducationIcon,              label: 'Education' },
  'store-operations':       { icon: StoreOperationsIcon,        label: 'Store operations' },
  'sustainability-insights':{ icon: SustainabilityInsightsIcon, label: 'Sustainability insights' },
  'book':                   { icon: BookIcon,                   label: 'Library' },
  'truck':                  { icon: TruckIcon,                  label: 'Logistics' },
  'trophy':                 { icon: TrophyIcon,                 label: 'Trophy' },
  'thumbs-like-dislike':    { icon: ThumbsLikeDislikeIcon,      label: 'Sentiment' },
  'window-settings':        { icon: WindowSettingsIcon,         label: 'Configuration' },
  'self-help':              { icon: SelfHelpIcon,               label: 'Self Service' },
  'manufacturing':          { icon: ManufacturingIcon,          label: 'Industrial' },
  'website-qa':             { icon: WebsiteQaIcon,              label: 'Website Q&A' },
  'financial-insights':     { icon: FinancialInsightsIcon,      label: 'Financial insights' },
  'voice':                  { icon: VoiceIcon,                  label: 'Voice' },
  'inclusivity':            { icon: InclusivityIcon,            label: 'Inclusivity' },
  'benefits':               { icon: BenefitsIcon,               label: 'Benefits' },
  'case-management':        { icon: CaseManagementIcon,         label: 'Case Management' },
  'salesforce-duplicate':   { icon: SalesforceDuplicateIcon,    label: 'Deduplication' },
  'supply-chain':           { icon: SupplyChainIcon,            label: 'Supply chain' },
  'kudos':                  { icon: KudosIcon,                  label: 'Kudos' },
  'filter':                 { icon: FilterIcon,                 label: 'Filter' },
  'prioritization':         { icon: PrioritizationIcon,         label: 'Prioritization' },
  'comparison':             { icon: ComparisonIcon,             label: 'Doc Compare' },
  'question-sources':       { icon: QuestionSourcesIcon,        label: 'FAQ' },
  'decision':               { icon: DecisionIcon,               label: 'Decision' },
  'citizen-services':       { icon: CitizenServicesIcon,        label: 'Citizen services' },
  'gong':                   { icon: GongIcon,                   label: 'Sales Intelligence' },
  'workflow':               { icon: WorkflowIcon,               label: 'Workflow', noScale: true },
};

// Get icon based on domain or template key (template keys prefixed with 'tpl:')
// Template SVGs have ~48x48 viewBox but icon content only fills ~56%, so we scale up by 1.65x
const TEMPLATE_SCALE = 1.65;

export const getAgentIcon = (iconKey: string, size: number = 20, variant: 'regular' | 'filled' = 'regular'): React.ReactNode => {
  // Check for template icon prefix
  if (iconKey.startsWith('tpl:')) {
    const templateKey = iconKey.slice(4);
    const template = templateIconMap[templateKey];
    if (template) {
      const TemplateIcon = template.icon as React.ComponentType<any>;
      const scaledSize = template.noScale ? size : Math.round(size * TEMPLATE_SCALE);
      return <TemplateIcon width={scaledSize} height={scaledSize} />;
    }
  }

  // Check template icons by plain key (for backward compat)
  if (!domainIconMap[iconKey] && templateIconMap[iconKey]) {
    const TemplateIcon = templateIconMap[iconKey].icon as React.ComponentType<any>;
    const scaledSize = templateIconMap[iconKey].noScale ? size : Math.round(size * TEMPLATE_SCALE);
    return <TemplateIcon width={scaledSize} height={scaledSize} />;
  }

  // Domain icon (default) - now supports regular and filled variants
  const iconSet = domainIconMap[iconKey] || domainIconMap['generic'];
  const IconComponent = variant === 'filled' ? iconSet.filled : iconSet.regular;
  return <IconComponent style={{ width: size, height: size, color: 'white', stroke: 'white', strokeWidth: 0.25 }} />;
};

// Domain display names and icon names for domain detection
export const domainMeta: { domain: string; label: string; iconName: string }[] = [
  // Existing domains
  { domain: 'digital-worker',   label: 'AI Teammate',         iconName: 'DigitalWorker20Regular' },
  { domain: 'hr',               label: 'HR & People',         iconName: 'People20Regular' },
  { domain: 'it',               label: 'IT & Tech Support',   iconName: 'Desktop20Regular' },
  { domain: 'sales',            label: 'Sales & CRM',         iconName: 'ArrowTrendingLines20Regular' },
  { domain: 'finance',          label: 'Finance',             iconName: 'Money20Regular' },
  { domain: 'legal',            label: 'Legal & Compliance',  iconName: 'Gavel20Regular' },
  { domain: 'marketing',        label: 'Marketing',           iconName: 'Megaphone20Regular' },
  { domain: 'customer-service', label: 'Customer Service',    iconName: 'Headset20Regular' },
  { domain: 'healthcare',       label: 'Healthcare',          iconName: 'Stethoscope20Regular' },
  { domain: 'insurance',        label: 'Insurance',           iconName: 'ShieldCheckmark20Regular' },
  { domain: 'education',        label: 'Education',           iconName: 'HatGraduation20Regular' },
  { domain: 'real-estate',      label: 'Real Estate',         iconName: 'Building20Regular' },
  { domain: 'travel',           label: 'Travel',              iconName: 'Airplane20Regular' },
  { domain: 'data',             label: 'Data & Analytics',    iconName: 'DataBarVertical20Regular' },
  { domain: 'project',          label: 'Project Mgmt',        iconName: 'ClipboardTask20Regular' },
  { domain: 'operations',       label: 'Operations',          iconName: 'Box20Regular' },
  { domain: 'content',          label: 'Content & Writing',   iconName: 'DocumentText20Regular' },
  { domain: 'design',           label: 'Design & Creative',   iconName: 'PaintBrush20Regular' },
  { domain: 'research',         label: 'Research',            iconName: 'DocumentSearch20Regular' },
  { domain: 'automation',       label: 'Workflows',           iconName: 'Flow20Regular' },
  { domain: 'recruiting',       label: 'Recruiting',          iconName: 'PersonSearch20Regular' },
  { domain: 'ecommerce',        label: 'E-commerce',          iconName: 'Cart20Regular' },
  { domain: 'security',         label: 'Security',            iconName: 'ShieldLock20Regular' },
  { domain: 'devops',           label: 'DevOps',              iconName: 'Code20Regular' },
  { domain: 'manufacturing',    label: 'Manufacturing',       iconName: 'Settings20Regular' },
  { domain: 'customer-success', label: 'Customer Success',    iconName: 'PersonHeart20Regular' },
  { domain: 'communications',   label: 'Communications',      iconName: 'Megaphone20Regular' },
  { domain: 'events',           label: 'Events',              iconName: 'CalendarStar20Regular' },
  { domain: 'qa',               label: 'Quality Assurance',   iconName: 'Bug20Regular' },
  { domain: 'product',          label: 'Product Mgmt',        iconName: 'Lightbulb20Regular' },
  { domain: 'training',         label: 'Training',            iconName: 'BookOpen20Regular' },
  { domain: 'chatbot',          label: 'Chat Bot',            iconName: 'Bot20Regular' },
  { domain: 'scheduling',       label: 'Scheduling',          iconName: 'Calendar20Regular' },
  { domain: 'documents',        label: 'Documents',           iconName: 'Document20Regular' },
  { domain: 'approvals',        label: 'Approvals',           iconName: 'DocumentCheckmark20Regular' },
  { domain: 'monitoring',       label: 'Monitoring',          iconName: 'ScanDash20Regular' },
  { domain: 'language',         label: 'Language',            iconName: 'Translate20Regular' },
  { domain: 'procurement',      label: 'Procurement',         iconName: 'Toolbox20Regular' },
  { domain: 'infrastructure',   label: 'Infrastructure',      iconName: 'Cloud20Regular' },
  { domain: 'compliance',       label: 'Compliance',          iconName: 'LockClosed20Regular' },
  { domain: 'email',            label: 'Email',               iconName: 'MailInbox20Regular' },
  { domain: 'generic',          label: 'Agent',               iconName: 'Agents20Regular' },

  // Phase 1: New domains
  { domain: 'knowledge',        label: 'Knowledge Base',      iconName: 'BookDatabase20Regular' },
  { domain: 'onboarding',       label: 'Onboarding',          iconName: 'Steps20Regular' },
  { domain: 'feedback',         label: 'Feedback & Reviews',  iconName: 'Star20Regular' },
  { domain: 'tickets',          label: 'Ticketing',           iconName: 'TicketDiagonal20Regular' },
  { domain: 'search',           label: 'Search & Discovery',  iconName: 'Search20Regular' },
  { domain: 'notifications',    label: 'Notifications',       iconName: 'Alert20Regular' },
  { domain: 'files',            label: 'File Management',     iconName: 'FolderOpen20Regular' },
  { domain: 'database',         label: 'Database',            iconName: 'Database20Regular' },
];

// Gradient palette with CSS values for showcase
// Only includes brand colors - grey is excluded from the palette
export const gradientPalette = [
  { name: 'Rose', css: 'linear-gradient(138deg, #F27883, #E15196, #B036B4)' },
  { name: 'Cerulean', css: 'linear-gradient(138deg, #28B8D2, #1C9DC1, #3963C6)' },
  { name: 'Lavendar', css: 'linear-gradient(138deg, #5C98ED, #6C6AE1, #764BCE)' },
  { name: 'Fuchsia', css: 'linear-gradient(138deg, #D06ED4, #AA56CE, #764BCE)' },
  { name: 'Seafoam', css: 'linear-gradient(138deg, #30C4B1, #1EA2AE, #1481AE)' },
  { name: 'Gold', css: 'linear-gradient(138deg, #F6BC0E, #EC8013, #D34253)' },
  { name: 'Fern', css: 'linear-gradient(138deg, #6FB867, #46A479, #198E8D)' },
];

// Grey gradient - reserved exclusively for "New Project" placeholder states
export const greyGradient = { name: 'Grey', css: 'linear-gradient(138deg, #ABABAB, #7D7D7D)' };

/**
 * Gets the CSS gradient string for a given gradient key name
 * @param gradientKey - The gradient name (e.g., "rose", "cerulean", "gold")
 * @returns The CSS gradient string
 */
export const getGradientByKey = (gradientKey: string): string => {
  const gradient = gradientPalette.find(g => g.name.toLowerCase() === gradientKey.toLowerCase());
  return gradient?.css || gradientPalette[0].css; // Default to first gradient if not found
};

/**
 * Gets the gradient key name based on agent ID hash
 * @param agentId - The agent ID to hash
 * @returns The gradient key name (e.g., "rose", "cerulean", "gold")
 */
// Canonical list of gradient keys — single source of truth for pickRandomGradientKey and getUniqueGradientKey
const GRADIENT_KEYS = ['rose', 'cerulean', 'lavendar', 'fuchsia', 'seafoam', 'gold', 'fern'] as const;

/**
 * Picks a random gradient key, optionally excluding one (e.g. the agent above in the nav).
 * Always truly random — never hash-based.
 */
export const pickRandomGradientKey = (excludeKey?: string): string => {
  const available = excludeKey ? GRADIENT_KEYS.filter(k => k !== excludeKey) : GRADIENT_KEYS;
  return available[Math.floor(Math.random() * available.length)];
};

export const getUniqueGradientKey = (agentId: string): string => {
  // Create a hash from the agent ID to select a consistent gradient
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = ((hash << 5) - hash) + agentId.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }

  const index = Math.abs(hash) % GRADIENT_KEYS.length;
  return GRADIENT_KEYS[index];
};

// Generate a unique gradient based on agent ID
// NOTE: This function NEVER returns grey - grey is reserved for "New Project" placeholder states
export const getUniqueGradient = (agentId: string): string => {
  // Copilot Studio agent icon palette (from Figma, 138° 3-stop gradients)
  // Deliberately excludes Grey to ensure it's never assigned to agents/workflows
  const gradients = [
    'from-[#F27883] via-[#E15196] to-[#B036B4]',   // Rose
    'from-[#28B8D2] via-[#1C9DC1] to-[#3963C6]',   // Cerulean
    'from-[#5C98ED] via-[#6C6AE1] to-[#764BCE]',   // Lavendar
    'from-[#D06ED4] via-[#AA56CE] to-[#764BCE]',   // Fuchsia
    'from-[#30C4B1] via-[#1EA2AE] to-[#1481AE]',   // Seafoam
    'from-[#F6BC0E] via-[#EC8013] to-[#D34253]',   // Gold
    'from-[#6FB867] via-[#46A479] to-[#198E8D]',   // Fern
    // Grey is intentionally NOT included - reserved for "New Project" placeholder only
  ];

  // Create a hash from the agent ID to select a consistent gradient
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = ((hash << 5) - hash) + agentId.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }

  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
};

// Generate a unique CSS gradient string based on agent ID (for use with SquircleIcon)
// NOTE: This function NEVER returns grey - grey is reserved for "New Project" placeholder states
export const getUniqueGradientCSS = (agentId: string): string => {
  // Copilot Studio agent icon palette CSS gradients (excludes Grey)
  const cssGradients = [
    'linear-gradient(138deg, #F27883, #E15196, #B036B4)',   // Rose
    'linear-gradient(138deg, #28B8D2, #1C9DC1, #3963C6)',   // Cerulean
    'linear-gradient(138deg, #5C98ED, #6C6AE1, #764BCE)',   // Lavendar
    'linear-gradient(138deg, #D06ED4, #AA56CE, #764BCE)',   // Fuchsia
    'linear-gradient(138deg, #30C4B1, #1EA2AE, #1481AE)',   // Seafoam
    'linear-gradient(138deg, #F6BC0E, #EC8013, #D34253)',   // Gold
    'linear-gradient(138deg, #6FB867, #46A479, #198E8D)',   // Fern
  ];

  // Create a hash from the agent ID to select a consistent gradient
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = ((hash << 5) - hash) + agentId.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }

  const index = Math.abs(hash) % cssGradients.length;
  return cssGradients[index];
};

// Legacy function - deprecated in favor of getUniqueGradient
// All gradients now use getUniqueGradient for consistency
export const getAgentGradient = (domain: string): string => {
  // Return a generic gradient - use getUniqueGradient(agentId) instead
  return 'from-[#D06ED4] via-[#AA56CE] to-[#764BCE]';
};

// ── Connector / service icons ──────────────────────────────────────────────────
// Single source of truth for all Power Platform / M365 connector branding icons.
// These are the 16px SVG files in /public/component-icons/.

/** Maps a lowercase service key to its 16px connector icon path. */
export const connectorIconMap: Record<string, string> = {
  'website':       '/component-icons/Website16.svg',
  'webchat':       '/component-icons/Website16.svg',
  'web':           '/component-icons/Website16.svg',
  'teams':         '/component-icons/Teams24.svg',
  'm365':          '/component-icons/Microsoft36516.svg',
  'microsoft 365': '/component-icons/Microsoft36516.svg',
  'slack':         '/component-icons/Slack16.svg',
  'email':         '/component-icons/Outlook16.svg',
  'outlook':       '/component-icons/Outlook16.svg',
  'servicenow':    '/component-icons/ServiceNow16.svg',
  'sharepoint':      '/component-icons/SharePoint16.svg',
  'sharepoint site': '/component-icons/SharePointSite16.svg',
  'onedrive':      '/component-icons/OneDrive16.svg',
  'excel online':  '/component-icons/Excel16.svg',
  'excel':         '/component-icons/Excel16.svg',
  'excel file':    '/component-icons/ExcelFile16.svg',
  'word online':   '/component-icons/Word16.svg',
  'word':          '/component-icons/Word16.svg',
  'word file':     '/component-icons/WordFile16.svg',
  'powerpoint':    '/component-icons/PowerPoint16.svg',
  'powerpoint file': '/component-icons/PowerPointFile16.svg',
  'dataverse':     '/component-icons/Dataverse16.svg',
  'whatsapp':      '/component-icons/WhatsApp16.svg',
  'ms forms':      '/component-icons/Forms16.svg',
  'forms':         '/component-icons/Forms16.svg',
  'planner':       '/component-icons/Planner16.svg',
  'salesforce':    '/component-icons/Salesforce16.svg',
  'power bi':      '/component-icons/PowerBI16.svg',
  'office 365':    '/component-icons/Microsoft36516.svg',
  'office365':     '/component-icons/Microsoft36516.svg',
  'office':        '/component-icons/Microsoft36516.svg',
  'copilot':       '/component-icons/Microsoft36516.svg',
  'weather':       '/component-icons/Weather16.svg',
  'msn weather':   '/component-icons/Weather16.svg',
  'recurrence':    '/component-icons/Recurrence16.svg',
  'sap':           '/component-icons/SAP24.svg',
  'jira':          '/component-icons/Jira24.svg',
  'github':        '/component-icons/GitHub24.svg',
  'azure devops':  '/component-icons/AzureDevOps24.svg',
};

/** Deduplicated connector entries for use in showcase/gallery displays. Uses 24px assets. */
export const connectorIcons: { key: string; label: string; src: string }[] = [
  { key: 'teams',       label: 'Teams',         src: '/component-icons/Teams24.svg' },
  { key: 'outlook',     label: 'Outlook',        src: '/component-icons/Outlook24.svg' },
  { key: 'sharepoint',  label: 'SharePoint',     src: '/component-icons/SharePoint24.svg' },
  { key: 'onedrive',    label: 'OneDrive',       src: '/component-icons/OneDrive24.svg' },
  { key: 'excel',          label: 'Excel',                src: '/component-icons/Excel24.svg' },
  { key: 'excel file',     label: 'Excel spreadsheet',    src: '/component-icons/ExcelFile24.svg' },
  { key: 'word',           label: 'Word',                 src: '/component-icons/Word24.svg' },
  { key: 'word file',      label: 'Word document',        src: '/component-icons/WordFile24.svg' },
  { key: 'powerpoint',     label: 'PowerPoint',           src: '/component-icons/PowerPoint24.svg' },
  { key: 'powerpoint file', label: 'PowerPoint presentation', src: '/component-icons/PowerPointFile24.svg' },
  { key: 'dataverse',   label: 'Dataverse',      src: '/component-icons/Dataverse24.svg' },
  { key: 'm365',        label: 'Microsoft 365',  src: '/component-icons/Microsoft36524.svg' },
  { key: 'github',        label: 'GitHub',         src: '/component-icons/GitHub24.svg' },
  { key: 'slack',       label: 'Slack',          src: '/component-icons/Slack24.svg' },
  { key: 'servicenow',  label: 'ServiceNow',     src: '/component-icons/ServiceNow24.svg' },
  { key: 'whatsapp',    label: 'WhatsApp',       src: '/component-icons/Whatsapp24.svg' },
  { key: 'forms',       label: 'Forms',          src: '/component-icons/Forms24.svg' },
  { key: 'planner',     label: 'Planner',        src: '/component-icons/Planner24.svg' },
  { key: 'salesforce',  label: 'Salesforce',     src: '/component-icons/Salesforce24.svg' },
  { key: 'power bi',    label: 'Power BI',       src: '/component-icons/PowerBI24.svg' },
  { key: 'office',      label: 'Microsoft 365',  src: '/component-icons/Microsoft36524.svg' },
  { key: 'website',     label: 'Website',        src: '/component-icons/Website24.svg' },
  { key: 'sap',           label: 'SAP',            src: '/component-icons/SAP24.svg' },
  { key: 'jira',          label: 'Jira',           src: '/component-icons/Jira24.svg' },
  { key: 'azure devops',  label: 'Azure DevOps',   src: '/component-icons/AzureDevOps24.svg' },
  { key: 'work iq',      label: 'Work IQ',        src: '' },  // Fluent icon — rendered via connectorFluentIconMap
];

/** Returns a connector icon React element for a given service key, or null if unknown.
 *  @param sizeClass Tailwind size class. Defaults to 'w-4 h-4' (16px, for inline pills).
 *                   Pass 'w-5 h-5' for 20px (slash menu rows), etc.
 */
export const getConnectorIcon = (channel: string, sizeClass = 'w-4 h-4'): React.ReactNode => {
  const key = channel.toLowerCase();
  const src = connectorIconMap[key];
  if (!src) return null;
  return <img src={src} alt="" aria-hidden="true" className={sizeClass} style={{ display: 'block' }} />;
};

/**
 * Uses AI to select the most appropriate icon from all available options.
 * Falls back to local regex-based detectAgentDomain() on failure.
 * @param agentName - The name of the agent/workflow
 * @param agentDescription - The description of the agent/workflow
 * @returns The domain or template key for the selected icon
 */
export const selectIconWithAI = async (
  agentName: string,
  agentDescription: string,
): Promise<string> => {
  // Build list of all available icons
  const domainIcons = domainMeta.map(d => ({
    key: d.domain,
    label: d.label,
    type: 'domain'
  }));

  const templateIcons = Object.entries(templateIconMap).map(([key, { label }]) => ({
    key,
    label,
    type: 'template'
  }));

  const allIcons = [...domainIcons, ...templateIcons];

  const domainTemplateList = allIcons.map(icon => `- ${icon.key}: ${icon.label}`).join('\n');
  const systemColorList = SYSTEM_COLOR_ICONS.map(icon => `- sys:${icon.key}: ${icon.label}`).join('\n');

  const systemPrompt = `You are an icon selection assistant. Given an agent/workflow name and description, select the MOST APPROPRIATE icon from the available options.

System color icons (PREFERRED — rich, multi-color Fluent icons):
${systemColorList}

Domain/template icons (fallback):
${domainTemplateList}

Rules:
1. PREFER system color icons (sys: prefixed) — they are richer and more visually polished
2. Choose the icon that BEST matches the agent's primary purpose or domain
3. Only fall back to domain/template icons if no system color icon is a good semantic match
4. If nothing matches well, use "sys:bot-sparkle" as fallback
5. Return ONLY the icon key exactly as shown (e.g., "sys:briefcase", "sys:rocket", "hr", "sales")

Respond with ONLY the icon key, nothing else.`;

  try {
    const response = await callModel({
      model: 'fast',
      maxTokens: 50,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Agent name: ${agentName}\nAgent description: ${agentDescription}\n\nWhich icon key should be used?`
      }]
    });

    const selectedKey = response.trim().toLowerCase();

    // Validate system color icon
    if (selectedKey.startsWith('sys:')) {
      const sysKey = selectedKey.slice(4);
      if (SYSTEM_COLOR_ICONS.some(icon => icon.key === sysKey)) {
        return selectedKey; // Return with sys: prefix so callers can distinguish
      }
    }

    // Validate domain/template icon
    const isValid = allIcons.some(icon => icon.key === selectedKey);
    if (isValid) {
      return selectedKey;
    }

    // Fallback to keyword-based detection if AI selection is invalid
    return detectAgentDomain({ name: agentName, description: agentDescription });
  } catch {
    // Fallback to keyword-based detection
    return detectAgentDomain({ name: agentName, description: agentDescription });
  }
};
