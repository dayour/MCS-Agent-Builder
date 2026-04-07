/**
 * Agent domain icons with gradient backgrounds.
 *
 * Ported from Elevate's agentIcons.tsx — uses Lucide icons instead of Fluent UI,
 * same gradient palette and domain detection logic.
 */
import {
  Users, Monitor, TrendingUp, DollarSign, Scale, Megaphone, Headset,
  Stethoscope, ShieldCheck, GraduationCap, Building, Plane,
  BarChart3, ClipboardList, Package, FileText, Paintbrush,
  FileSearch, Workflow, Bot, UserSearch, ShoppingCart, ShieldAlert,
  Code, Settings, Heart, CalendarDays, Bug, Lightbulb, BookOpen,
  Calendar, File, FileCheck, ScanLine, Languages, Wrench, Cloud,
  Lock, Mail, BookMarked, ListChecks, Star, Ticket, Search, Bell,
  FolderOpen, Database, type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Gradient palette (matches Elevate exactly)
// ---------------------------------------------------------------------------

export const gradientPalette = [
  { name: "rose",     css: "linear-gradient(138deg, #F27883, #E15196, #B036B4)" },
  { name: "cerulean", css: "linear-gradient(138deg, #28B8D2, #1C9DC1, #3963C6)" },
  { name: "lavender", css: "linear-gradient(138deg, #5C98ED, #6C6AE1, #764BCE)" },
  { name: "fuchsia",  css: "linear-gradient(138deg, #D06ED4, #AA56CE, #764BCE)" },
  { name: "seafoam",  css: "linear-gradient(138deg, #30C4B1, #1EA2AE, #1481AE)" },
  { name: "gold",     css: "linear-gradient(138deg, #F6BC0E, #EC8013, #D34253)" },
  { name: "fern",     css: "linear-gradient(138deg, #6FB867, #46A479, #198E8D)" },
] as const;

// ---------------------------------------------------------------------------
// Domain → icon mapping (Lucide equivalents)
// ---------------------------------------------------------------------------

export const domainIconMap: Record<string, { icon: LucideIcon; label: string }> = {
  hr:               { icon: Users,         label: "HR & People" },
  it:               { icon: Monitor,       label: "IT & Tech Support" },
  sales:            { icon: TrendingUp,    label: "Sales & CRM" },
  finance:          { icon: DollarSign,    label: "Finance" },
  legal:            { icon: Scale,         label: "Legal & Compliance" },
  marketing:        { icon: Megaphone,     label: "Marketing" },
  "customer-service": { icon: Headset,     label: "Customer Service" },
  healthcare:       { icon: Stethoscope,   label: "Healthcare" },
  insurance:        { icon: ShieldCheck,   label: "Insurance" },
  education:        { icon: GraduationCap, label: "Education" },
  "real-estate":    { icon: Building,      label: "Real Estate" },
  travel:           { icon: Plane,         label: "Travel" },
  data:             { icon: BarChart3,     label: "Data & Analytics" },
  project:          { icon: ClipboardList, label: "Project Mgmt" },
  operations:       { icon: Package,       label: "Operations" },
  content:          { icon: FileText,      label: "Content & Writing" },
  design:           { icon: Paintbrush,    label: "Design & Creative" },
  research:         { icon: FileSearch,    label: "Research" },
  automation:       { icon: Workflow,      label: "Workflows" },
  recruiting:       { icon: UserSearch,    label: "Recruiting" },
  ecommerce:        { icon: ShoppingCart,  label: "E-commerce" },
  security:         { icon: ShieldAlert,   label: "Security" },
  devops:           { icon: Code,          label: "DevOps" },
  manufacturing:    { icon: Settings,      label: "Manufacturing" },
  "customer-success": { icon: Heart,       label: "Customer Success" },
  communications:   { icon: Megaphone,     label: "Communications" },
  events:           { icon: CalendarDays,  label: "Events" },
  qa:               { icon: Bug,           label: "Quality Assurance" },
  product:          { icon: Lightbulb,     label: "Product Mgmt" },
  training:         { icon: BookOpen,      label: "Training" },
  chatbot:          { icon: Bot,           label: "Chat Bot" },
  scheduling:       { icon: Calendar,      label: "Scheduling" },
  documents:        { icon: File,          label: "Documents" },
  approvals:        { icon: FileCheck,     label: "Approvals" },
  monitoring:       { icon: ScanLine,      label: "Monitoring" },
  language:         { icon: Languages,     label: "Language" },
  procurement:      { icon: Wrench,        label: "Procurement" },
  infrastructure:   { icon: Cloud,         label: "Infrastructure" },
  compliance:       { icon: Lock,          label: "Compliance" },
  email:            { icon: Mail,          label: "Email" },
  knowledge:        { icon: BookMarked,    label: "Knowledge Base" },
  onboarding:       { icon: ListChecks,    label: "Onboarding" },
  feedback:         { icon: Star,          label: "Feedback & Reviews" },
  tickets:          { icon: Ticket,        label: "Ticketing" },
  search:           { icon: Search,        label: "Search & Discovery" },
  notifications:    { icon: Bell,          label: "Notifications" },
  files:            { icon: FolderOpen,    label: "File Management" },
  database:         { icon: Database,      label: "Database" },
  generic:          { icon: Bot,           label: "Agent" },
};

// ---------------------------------------------------------------------------
// Domain detection (ported from Elevate)
// ---------------------------------------------------------------------------

const domainPatterns: [string, RegExp][] = [
  ["knowledge",        /\b(knowledge base|knowledge management|wiki|faq|help center|help documentation|docs|knowledge hub)\b/],
  ["onboarding",       /\b(onboarding|onboard|getting started|welcome|new employee|new hire)\b/],
  ["feedback",         /\b(feedback|review|rating|survey|poll|nps|satisfaction)\b/],
  ["tickets",          /\b(ticket|ticketing|incident|issue tracking|helpdesk|support ticket)\b/],
  ["search",           /\b(search|find|discover|discovery|lookup|filter)\b/],
  ["notifications",    /\b(notification|notify|alert system|push notification|reminder)\b/],
  ["files",            /\b(file management|file system|document storage|file sharing|upload|download)\b/],
  ["database",         /\b(database|db|sql|nosql|data storage)\b/],
  ["hr",               /\b(hr|human resources|employee|recruitment|hiring|benefits|payroll|talent)\b/],
  ["data",             /\b(data|analytics|analys[ie]s|reporting|dashboard|metric|insight|bi)\b/],
  ["project",          /\b(project|task|milestone|planning|scrum|agile|workflow automation)\b/],
  ["it",               /\b(it|tech|technical|support|hardware|software|helpdesk|troubleshoot)\b/],
  ["sales",            /\b(sales|crm|lead|prospect|revenue|deal|opportunity|pipeline)\b/],
  ["finance",          /\b(finance|accounting|invoice|billing|payment|expense|budget)\b/],
  ["legal",            /\b(legal|compliance|contract|regulation|policy|law|governance)\b/],
  ["marketing",        /\b(marketing|campaign|brand|social media|content|advertising|seo)\b/],
  ["chatbot",          /\b(chatbot|chat bot|virtual assistant|chat agent)\b/],
  ["email",            /\b(email|e-mail|inbox|mail triage|newsletter|email automation)\b/],
  ["scheduling",       /\b(schedule|scheduling|meeting|appointment|calendar|availability|agenda)\b/],
  ["documents",        /\b(document approval|document management|document review|contract approval|signature)\b/],
  ["approvals",        /\b(approval|approve|authorize|sign-off|pending review|purchase order)\b/],
  ["monitoring",       /\b(monitor|monitoring|alert|health check|watchlist|uptime|status check)\b/],
  ["language",         /\b(translat|language|grammar|nlp|multilingual|localization)\b/],
  ["procurement",      /\b(procurement|vendor|supplier|rfq|sourcing)\b/],
  ["infrastructure",   /\b(deploy|deployment|infrastructure|provisioning|kubernetes|docker|ci\/cd)\b/],
  ["compliance",       /\b(compliance|regulatory|governance|audit|risk assessment|hipaa|gdpr)\b/],
  ["customer-service", /\b(customer service|customer support|help desk|inquiry|complaint)\b/],
  ["healthcare",       /\b(health|medical|patient|doctor|clinic|hospital|wellness)\b/],
  ["insurance",        /\b(insurance|claim|policy|coverage|premium|underwriting)\b/],
  ["education",        /\b(education|student|teacher|course|learning|tutor|academic)\b/],
  ["real-estate",      /\b(real estate|property|housing|lease|rent|mortgage)\b/],
  ["travel",           /\b(travel|flight|hotel|booking|reservation|itinerary)\b/],
  ["operations",       /\b(operations|logistics|supply chain|inventory|shipping|warehouse)\b/],
  ["content",          /\b(writing|content creation|copywriting|blog|article|technical writing)\b/],
  ["design",           /\b(design|creative|graphic|visual|ui|ux|branding)\b/],
  ["research",         /\b(research|investigation|study|findings|competitive intelligence)\b/],
  ["automation",       /\b(automat|browser|api|integration)\b/],
  ["recruiting",       /\b(recruit|talent|candidate|interview|applicant|resume screen)\b/],
  ["ecommerce",        /\b(ecommerce|e-commerce|retail|shop|store|product catalog|order)\b/],
  ["security",         /\b(security|cybersecurity|vulnerability|threat|firewall|encryption)\b/],
  ["devops",           /\b(devops|code review|ci\/cd|pipeline|engineering|version control)\b/],
  ["manufacturing",    /\b(manufacturing|production|factory|assembly|quality control)\b/],
  ["customer-success", /\b(customer success|retention|adoption|account management|churn)\b/],
  ["events",           /\b(event|conference|venue|registration|webinar|workshop)\b/],
  ["qa",               /\b(qa|quality assurance|testing|test automation|bug|defect)\b/],
  ["product",          /\b(product management|roadmap|feature|backlog|user story|sprint)\b/],
  ["training",         /\b(training|development|learning management|skill|certification|lms)\b/],
];

export function detectAgentDomain(agent: { name?: string; purpose?: string; instructions?: string; description?: string }): string {
  const text = `${agent.name || ""} ${agent.purpose || ""} ${agent.instructions || ""} ${agent.description || ""}`.toLowerCase();
  for (const [domain, pattern] of domainPatterns) {
    if (pattern.test(text)) return domain;
  }
  return "generic";
}

// ---------------------------------------------------------------------------
// Gradient assignment (deterministic by agent ID hash)
// ---------------------------------------------------------------------------

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getGradientForAgent(agentId: string): string {
  const idx = hashCode(agentId) % gradientPalette.length;
  return gradientPalette[idx].css;
}

// ---------------------------------------------------------------------------
// Combined helper: get icon + gradient for an agent
// ---------------------------------------------------------------------------

export function getAgentIconInfo(agent: { id: string; name?: string; purpose?: string; instructions?: string; description?: string }) {
  const domain = detectAgentDomain(agent);
  const { icon, label } = domainIconMap[domain] || domainIconMap.generic;
  const gradient = getGradientForAgent(agent.id);
  return { icon, label, gradient, domain };
}
