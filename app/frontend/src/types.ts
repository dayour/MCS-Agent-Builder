// Core types for the AI Agent Builder application
import type { FuzzyGoals } from './utils/fuzzyCreateAgent';

export type DWTaskStatus = 'incomplete' | 'blocked' | 'in-progress' | 'complete' | 'upcoming';

export interface DWTask {
  id: string;
  name: string;
  subtitle: string;
  status: DWTaskStatus;
  lastUpdated: string;
  knowledge?: string;
  messages?: string;
  content?: string;
  date?: string;         // ISO date string for date formatting
  when?: string;        // e.g. "Today", "Tomorrow", "Mar 25"
  objective?: string;   // goal / objective summary
  steps?: string[];     // LLM-generated execution steps
}
export interface DWKnowledgeItem {
  id: string;
  name: string;
  description: string;
  source: string;           // e.g. "SharePoint", "Work IQ", "Outlook"
  badge: 'Files' | 'Skill';
}

export type LastStepType = 'topic' | 'codeResponse' | 'cua' | 'flow' | 'prompt' | 'task' | 'trigger' | 'knowledgeSource' | 'connector' | 'deepReasoning' | 'mcp' | 'skill' | 'tool' | 'multiAgent';

export interface AgentCapability {
  name: string;
  description?: string; // One-sentence description of what this capability does or provides
  source?: string;      // Service/connector name (e.g., "SharePoint", "Outlook") — overrides name-prefix parsing
  type: 'knowledge' | 'action' | 'connector' | 'trigger' | 'agent';
}

export type BranchType = 'true-false' | 'if-else' | 'yes-no'; // 'yes-no' retained for backwards-compatibility with saved workflows

export const BRANCH_TYPE_OPTIONS: { label: string; value: BranchType; description?: string }[] = [
  { label: 'If / Else', value: 'if-else', description: 'Route based on conditions; supports multiple Else If branches' },
  { label: 'True / False', value: 'true-false', description: 'Simple two-way split: one path when true, another when false' },
];

export function getBranchLabels(branchType?: BranchType): { positive: string; negative: string } {
  switch (branchType) {
    case 'true-false': return { positive: 'True', negative: 'False' };
    case 'yes-no': return { positive: 'Yes', negative: 'No' };
    default: return { positive: 'If', negative: 'Else' };
  }
}

/** Per-channel distribution options — both can be enabled simultaneously. */
export interface TriggerDistributionOptions {
  teammates?: boolean;
  everyone?: boolean;
  submitted?: boolean; // true after admin approval has been submitted
  approved?: boolean;  // true after admin has approved (simulated via Refresh)
  siteSelected?: boolean; // SharePoint: true when a site has been selected for deployment
  selectedSiteValue?: string; // SharePoint: persisted site key for deployment
  whatsappPhoneNumber?: string; // WhatsApp: selected phone number
  whatsappSubscription?: string; // WhatsApp: selected Azure subscription
  whatsappAcsResource?: string; // WhatsApp: selected ACS resource
}

/** Per-channel distribution config, keyed by channel identifier (e.g. 'teams', 'microsoft 365'). */
export interface TriggerDistribution {
  [channel: string]: TriggerDistributionOptions;
}

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'ai-action' | 'agent' | 'condition' | 'action' | 'note';
  label: string;
  noteText?: string; // Text content for note-type nodes
  noteTitle?: string; // Custom title for note-type nodes (defaults to "Note")
  noteColor?: 'yellow' | 'blue' | 'green' | 'purple' | 'red' | 'orange'; // Sticky note color theme
  icon?: string;
  connector?: string; // e.g., 'SharePoint', 'Outlook', 'Dataverse'
  config?: any; // Node-specific configuration
  branchType?: BranchType; // Visual label style for condition nodes
  branch?: string; // For nodes that belong to a conditional branch ('true', 'false', or else-if branch ID)
  parentConditionId?: string; // For nodes that belong to a nested condition's sub-branch
  subbranch?: 'true' | 'false'; // Which sub-branch of the nested condition
  placeholder?: boolean; // True for placeholder trigger nodes awaiting channel resolution
  hitlEnabled?: boolean; // Step-level human-in-the-loop enabled
  hitlMode?: 'inherit' | 'custom'; // Inherit global contacts or use step-specific ones
  hitlContacts?: HitlContact[]; // Step-specific HITL contacts (when hitlMode === 'custom')
  hitlLocked?: boolean; // HITL was pre-configured when the step was originally built — read-only in the workflow canvas
  hitlNotifyFrequency?: 'immediately' | 'daily-recap'; // Per-step notification frequency
}

export interface HitlContact {
  id: string;
  name: string;
  email?: string;
  notifyVia: 'teams' | 'email';
}

export interface WorkflowVersionEntry {
  id: string;
  createdAt: string; // ISO string
  nodes: WorkflowNode[];
  description: string; // AI-generated, '' while pending
  source: 'manual' | 'auto' | 'publish'; // what triggered this version
  userInitials?: string; // set on manual/publish saves — initials derived from userName
  userName?: string;    // full display name for manual/publish saves
  changeCount?: number; // number of scored changes that triggered an auto-save
}

export type AgentVersionType = 'published' | 'draft-restored' | 'milestone' | 'draft';

export interface AgentVersionEntry {
  id: string;
  createdAt: string; // ISO string
  version: string; // e.g. "1.0", "1.1", or "restored" for draft-restored entries
  versionType: AgentVersionType;
  agentConfig: Omit<AgentConfig, 'id' | 'createdAt'>; // full config snapshot at capture time
  helperMessages?: Message[];
  previewMessages?: Message[];
  evaluations?: Evaluation[];
  changeNotes?: string; // user-supplied notes from UpdateConfirmDialog
  createdBy?: string;   // display name of the user who created this entry
}

export interface AgentConfig {
  id: string;
  type: 'agent' | 'workflow' | 'placeholder'; // Distinguishes between agents, workflows, and placeholder state
  name: string;
  icon?: string; // emoji or character icon
  iconKey?: string; // Key for agent icon from domainIconMap or templateIconMap
  iconImageData?: string | null; // Base64-encoded PNG data for custom uploaded icon
  gradientKey?: string; // Key for gradient color (rose, cerulean, lavendar, etc.)
  systemColorIcon?: string; // System color icon key for DW agents (e.g. 'briefcase')
  description: string;
  purpose: string;
  audience?: 'customers' | 'employees' | 'personal' | null; // Who interacts with this agent (external vs internal vs personal)
  channel?: string; // Deployment channel (teams, website, outlook, slack, etc.)
  agentType?: 'CA' | 'DA' | 'DW'; // CA = Custom Agent, DA = Declarative Agent (Teams/Microsoft 365), DW = Digital Worker (AI Teammate)
  email?: string; // Auto-generated email for DW agents (e.g. penny@contoso.com)
  role?: string; // Job title for DW agents (e.g. "Design PM", "Finance Analyst")
  guidelines: string[];
  skills: string[];
  model: 'opus-4.5' | 'sonnet-4.5' | 'haiku-4.5' | 'gpt-5.2-auto' | 'gpt-5.2-instant' | 'gpt-5.2-thinking';
  knowledge: KnowledgeConfig;
  instructions: string;
  capabilities?: AgentCapability[];
  workflowNodes?: WorkflowNode[]; // For workflow type agents
  published: boolean;
  version?: string; // Version number (e.g., "1.0", "1.1")
  lastPublishedAt?: Date; // Timestamp of last publish
  publishedTriggers?: { iconKey: string; label: string }[]; // Trigger snapshot at last publish
  createdAt: Date;
  justCreated?: boolean; // Flag to trigger initial scroll on Build page
  pinned?: boolean; // Whether the agent is pinned in the left nav (undefined/true = pinned, false = unpinned)
  isFuzzyComplete?: boolean; // Fuzzy create flow has achieved all goals; subsequent messages handled by regular helper
  fuzzyGoals?: FuzzyGoals; // Last known goals state — seeds lastFuzzyGoalsRef on HelperAgent mount
  createdWithPlanMode?: boolean; // Whether plan mode was active when this agent/workflow was created
  hitlEnabled?: boolean; // Whether human-in-the-loop escalation is enabled
  hitlContacts?: HitlContact[]; // Human-in-the-loop escalation contacts
  dwSkills?: string[]; // AI Teammate domain-specific skills (generated from user's prompt)
  dexterWorkerId?: string; // Dexter Control Plane worker ID (set when isDexter flag is on)
  teamsChatUrl?: string; // Direct link to this agent's Teams chat
  lifecycleStatus?: 'provisioning' | 'ready' | 'failed' | null; // Dexter provisioning lifecycle
  lifecycleError?: string | null; // Error message if Dexter provisioning failed
  workIq?: WorkIQConfig; // Work IQ context layer configuration
  triggerDistribution?: TriggerDistribution; // Per-channel distribution scope for conversational triggers
  softDeletedTriggers?: string[]; // Trigger names pending permanent removal on next publish
  // ── Eval fields (eval-guide pipeline) ──
  evalSets?: Array<{
    name: string;
    description?: string;
    methods: Array<{ type: string; score?: number; mode?: string }>;
    passThreshold: number;
    tests: Array<{
      question: string;
      expected: string;
      keywords?: string;
      capability?: string;
      scenarioId?: string;
      scenarioCategory?: string;
      source?: string;
      turns?: Array<{ turnIndex: number; question: string; expected: string; critical: boolean }>;
      expectedTools?: string;
      lastResult: null | {
        pass: boolean;
        actual: string;
        score: number;
        timestamp: string;
        methodResults: Array<{ method: string; pass: boolean; score: number }>;
        turnResults?: Array<{ turnIndex: number; pass: boolean; score: number; actual: string; critical: boolean }>;
        toolInvocations?: string[];
      };
    }>;
  }>;
  evalConfig?: {
    verdictModel?: string;
    riskProfile?: string;
    riskTier?: 'demo' | 'internal' | 'production';
    thresholds?: { safety?: number; quality?: number; overall?: number; minPerCategory?: number };
    skipGate?: boolean;
    skipGateApprovedBy?: string;
    skipGateReason?: string;
    skipGateTicketRef?: string;
    lastVerdict?: { verdict: string; reason: string; overallRate: number; perSet: Array<{ name: string; rate: number }> };
    lastVerdictAt?: string;
  };
  // ── Eval-as-publish-gate fields (backend-driven; see publish-state-matrix.md) ──
  buildStatusRaw?: 'not_started' | 'in_progress' | 'published-internal' | 'published-uat' | 'published' | 'failed' | string;
  evalGate?: {
    override?: boolean;
    overrideApprovedBy?: string;
    overrideReason?: string;
    overrideTicketRef?: string;
    overrideAt?: string;
    verdict?: 'SHIP' | 'ITERATE' | 'BLOCK' | string;
    reason?: string;
    overallRate?: number;
    perSet?: Array<{ name: string; rate: number; total?: number }>;
    promotedTo?: 'published-uat' | null;
    migrationFrom?: string;
    migrationReason?: string;
    migratedAt?: string;
  };
  // ── Spec-backed agent fields ──
  projectId?: string;      // Server project ID — presence means agent is backed by agentspec.json on server
  specAgentId?: string;    // Server agent ID within the project folder
  specData?: any;          // Cached full agentspec.json content (not included in undo snapshots)
}

export interface WorkIQConfig {
  enabled: boolean;
  enabledServers: string[]; // subset of WORK_IQ_MCP_SERVERS
}

export type SnapshotLifecycleStage = 'day-zero' | 'in-progress' | 'published' | 'bad-agent' | 'custom';

export interface AgentSnapshot {
  id: string;
  name: string;
  description: string;
  tags: string[];
  lifecycleStage: SnapshotLifecycleStage;
  agentConfig: Omit<AgentConfig, 'id' | 'createdAt'>;
  isBuiltIn: boolean;
  createdAt: string; // ISO string — safe for JSON round-trip
  createdBy?: string;
  /** Feature toggle IDs that must be ON for this snapshot to work correctly */
  requiredToggles?: string[];
  /** Full recommended toggle configuration — used to offer auto-apply on load */
  toggleState?: Record<string, boolean | string>;
  /** Helper (creation) conversation to seed into the new agent on load */
  helperMessages?: Message[];
  /** Test/preview conversation to seed into the new agent on load */
  previewMessages?: Message[];
  /** Evaluation results to seed into the new agent on load */
  evaluations?: Evaluation[];
  /** Analytics/monitoring state to seed into the new agent on load */
  monitoringData?: MonitoringData;
  /** When true (built-in snapshots), generate placeholder content on first load via LLM */
  generateOnLoad?: boolean;
  /** Author notes describing the snapshot's purpose and when to use it — shown in detail view, editable, AI-generatable */
  notes?: string;
  /** Agent variant — placeholder for toggling between Declarative and Custom prototype states */
  agentVariant?: 'declarative' | 'custom';
}

export interface KnowledgeConfig {
  files: FileUpload[];
  webSearch: boolean;
  specificSources: boolean;
  referenceOrgChart: boolean;
  customAPIs: APIConnection[];
}

export interface FileUpload {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
}

export interface APIConnection {
  id: string;
  name: string;
  endpoint: string;
  enabled: boolean;
}

export interface KnowledgeHealthResult {
  sourceId: string;
  sourceName: string;
  type: 'api' | 'file';
  status: 'unreachable' | 'auth_error' | 'not_found';
  message: string;
}

export interface Skill {
  id: string;
  name: string;           // kebab-case, max 64 chars
  description: string;    // max 200 chars; must include WHAT + WHEN trigger phrases
  body: string;           // Markdown instructions body (everything after frontmatter)
  license?: string;       // e.g. 'MIT', 'Apache-2.0'
  allowedTools?: string;  // e.g. 'Bash(python:*) WebFetch'
  dependencies?: string;  // e.g. 'python>=3.8, pandas>=1.5.0'
  metadata?: Record<string, string>; // author, version, mcp-server, etc.
  tools?: string[];           // connector/tool names this skill uses (e.g. ['SharePoint - Get items', 'Teams - Send message'])
  knowledgeSources?: string[]; // knowledge source names this skill references
  scripts?: Array<{ name: string; content: string }>; // bundled helper scripts (e.g. scripts/process_data.py)
  // DA-only fields (only populated when agentType === 'DA')
  m365Capabilities?: string[];  // e.g. ['Code Interpreter', 'People', 'Image Generator']
  connectors?: Array<{ name: string; proposed?: boolean }>;
  powerPlatformConnectors?: Array<{ name: string; proposed?: boolean }>;
  flows?: Array<{ name: string; proposed?: boolean }>;
  topics?: Array<{ name: string; proposed?: boolean }>;
  createdAt: Date;
  agentId?: string;       // Which agent this skill was created for
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  timestamp: Date;
  streaming?: boolean;
  hidden?: boolean;       // auto-submitted prompts — shown to LLM but hidden in the UI
  attachedFiles?: File[];
  metadata?: {
    type?: 'channel-selection' | 'knowledge-sources' | 'confirmation' | 'trigger-selection' | 'skill-preview' | 'da-skill-preview' | 'da-skill-suggest' | 'workiq' | 'change-summary';
    suggestions?: string[];
    skill?: Skill;
    summary?: ChangeSummary;
    nodeQuote?: { label: string; type: string; errorTitle?: string; error?: string };
    publishBlocks?: Array<{ status: 'passed' | 'warning' | 'failed'; label: string; summary?: string; issues?: string[] }>;
    publishOutcome?: string;
    [key: string]: any;
  };
}

export interface EvaluationQuestion {
  id: string;
  question: string;
  expectedResponse?: string;
  result?: 'pass' | 'fail';
  actualResponse?: string;
}

export interface Evaluation {
  id: string;
  name: string;
  questions: EvaluationQuestion[];
  score?: number;
  runDate?: Date;
  duration?: string;
}

export interface MonitoringData {
  totalRuns: number;
  failedRuns: number;
  averageDuration: string;
  totalSessions: number;
  engagement: number;
  themes: ThemeData[];
}

export interface ThemeData {
  name: string;
  totalQuestions: number;
  answeredPercentage: number;
  likes: number;
  dislikes: number;
}

export interface PillInputConfig {
  name: string;
  required: boolean;
  description?: string;
}

export interface PillConfig {
  id: string;
  type: 'connector' | 'knowledge' | 'agent' | 'trigger' | 'action';
  label: string;
  channel?: string; // outlook | teams | sharepoint | onedrive | excel | word | dataverse | etc.
  description?: string;
  fullName?: string; // Full "Service - Action" name for icon resolution (e.g., "ServiceNow - Create Record")
  inputs: PillInputConfig[];
}

export interface ActivityErrorRun {
  id: string;
  description: string;
  status: 'failed' | 'rejected' | 'cancelled' | 'auth-required';
  error?: string;
  channel?: string;
  type?: 'chat' | 'autonomous';
}

// ─── Evals v2 types ──────────────────────────────────────────────────────────

export type EvalRating = 'poor' | 'ok' | 'good';

export interface ConfigSnapshot {
  name: string;
  channel?: string;
  knowledge: {
    webSearch: boolean;
    specificSources: boolean;
    referenceOrgChart: boolean;
    fileCount: number;
    fileNames: string[];
  };
  capabilities: string[];
  guidelines: string[];
  skills: string[];
  hasInstructions: boolean;
  instructionLength: number;
}

export interface ConfigDiffEntry {
  field: string;
  label: string;
  before: string;
  after: string;
}

export interface ChangeSummaryBullet {
  text: string;
  icon: 'drafts' | 'puzzle' | 'delete' | 'settings';
  navigate: string | null; // null = not clickable (deletions)
}

export interface ChangeSummary {
  bullets: ChangeSummaryBullet[];
  nextStep?: string;
}

export interface MessageEval {
  messageId: string;
  messageContent: string;
  userPrompt: string;
  sessionId: string;
  configBefore?: ConfigSnapshot;
  configAfter?: ConfigSnapshot;
  accuracy: boolean | null;
  relevance: EvalRating | null;
  completeness: EvalRating | null;
  clarity: EvalRating | null;
  actionCorrectness: EvalRating | null;
  comment: string;
  evaluatedAt: string;
  agentId?: string;
  agentName?: string;
  source?: 'helper-agent' | 'preview';
}
