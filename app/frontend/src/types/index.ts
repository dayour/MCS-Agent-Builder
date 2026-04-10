/**
 * Core domain types for MCS Agent Builder.
 *
 * Import from `@/types` in all components, stores, and utilities.
 * Mock/seed data lives separately in `@/data/mockData`.
 */

// ─── Project ────────────────────────────────────────────────────────

export type ProjectStatus = "draft" | "in-progress" | "ready" | "building";

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  agentCount: number;
  docCount: number;
  updatedAt: string;
  /** Overall readiness percentage (0–100). */
  readiness: number;
}

// ─── Agent ──────────────────────────────────────────────────────────

export type AgentStatus = "draft" | "researched" | "ready" | "built";

export interface Agent {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  /** Brief readiness percentage (0–100). */
  readiness: number;
  /** Map of brief section ID → completion boolean. */
  sectionCompletion: Record<string, boolean>;
  /** Eval pass rate (0–100) or null if evals haven't run. */
  evalPassRate: number | null;
  /** Architecture type from brief (e.g. "multi-agent"). */
  architectureType?: string;
  /** Agent folder IDs of children (for multi-agent orchestrators). */
  childAgentIds?: string[];
  /** Workflow phase from brief (preview | research | decisions | ready_to_build). */
  workflowPhase?: WorkflowPhase | null;
}

// ─── Document ───────────────────────────────────────────────────────

export type DocType = "markdown" | "csv" | "json" | "text" | "image" | "pdf" | "document";
export type DocChangeStatus = "new" | "modified" | "processed" | "processing";

export interface Document {
  id: string;
  name: string;
  type: DocType;
  size: string;
  uploadedAt: string;
  /** Raw content string (text, CSV, markdown, or base64 data-URI for images). */
  content: string;
  /** SHA-256 hex hash for change detection. */
  contentHash: string;
  changeStatus: DocChangeStatus;
}

// ─── Brief ──────────────────────────────────────────────────────────

export interface BriefSection {
  id: string;
  title: string;
  /** Lucide icon name (e.g. "Briefcase", "Bot"). */
  icon: string;
  complete: boolean;
  /** Optional subtitle for section page headers. */
  subtitle?: string;
}

// ─── Workflow ───────────────────────────────────────────────────────

export type WorkflowPhase = "preview" | "research" | "decisions" | "ready_to_build";
export type ItemSource = "from-docs" | "inferred" | "user-added";

export interface Workflow {
  phase: WorkflowPhase;
  previewConfirmed: boolean;
  decisionsConfirmed: boolean;
  previewGeneratedAt: string | null;
  researchCompletedAt: string | null;
  evalStubsGeneratedAt: string | null;
}

// ─── Brief Data Shapes (section payloads) ───────────────────────────

export interface Overview {
  name: string;
  description: string;
  problemStatement: string;
  targetUsers: string[];
  challenges: string[];
  benefits: string[];
  /** Agent persona/tone (e.g. "professional, concise, uses bullet points"). */
  persona: string;
  /** How the agent formats responses (e.g. "bullet points, max 3 items"). */
  responseFormat: string;
}

export interface Capability {
  name: string;
  description: string;
  phase: string;
  implementationType: string;
  source?: ItemSource;
}

export interface Integration {
  name: string;
  type: string;
  auth: string;
  credentialMode: string;
  purpose: string;
  notes: string;
  phase: string;
  status: string;
}

export interface KnowledgeSource {
  name: string;
  type: string;
  purpose: string;
  location: string;
  phase: string;
  status: string;
}

export interface ConversationStarter {
  title: string;
  text: string;
}

export interface ConversationTopic {
  name: string;
  type: "generative" | "custom";
  phase: string;
  description: string;
  flowDescription: string;
  outputFormat: string;
  triggerType: string;
  triggerPhrases: string[];
  implements: string[];
  connectedIntegrations: string[];
}

export interface BoundaryDecline {
  topic: string;
  redirect: string;
  source?: ItemSource;
}

export interface BoundaryRefuse {
  topic: string;
  reason: string;
  source?: ItemSource;
}

export interface OpenQuestion {
  question: string;
  status: string;
  notes: string;
  resolution: string;
  impact: string;
  section: string;
  suggestedDefault: string;
  source?: ItemSource;
}

export type EvalMethodType =
  | "General quality"
  | "Compare meaning"
  | "Keyword match"
  | "Text similarity"
  | "Exact match"
  | "Tool use"
  | "Plan validation";

export interface EvalMethod {
  type: EvalMethodType;
  /** Threshold for scored methods (Compare meaning, Text similarity). 0-100. */
  score?: number;
  /** Mode for Keyword match: "any" or "all". */
  mode?: "any" | "all";
}

export interface EvalTestResult {
  pass: boolean;
  actual?: string;
  score?: number;
  timestamp?: string;
  turnResults?: Array<{
    turnIndex: number;
    question: string;
    critical: boolean;
    pass: boolean | null;
    score: number | null;
    actual?: string;
  }>;
  toolInvocations?: string[];
}

export interface EvalTestTurn {
  question: string;
  expected?: string | null;
  critical?: boolean;
}

export interface EvalTest {
  question: string;
  expected?: string;
  /** Comma-separated keywords for Keyword match method. When set, KeywordMatch uses this instead of expected. */
  keywords?: string | null;
  /** Links to capabilities[].name. Optional — cross-cutting tests omit this. */
  capability?: string;
  /** Per-test method override. When set, these methods are used instead of the set's methods. */
  methods?: EvalMethod[] | null;
  /** Scenario library ID (e.g., "BP-IR-01", "CAP-SB-03"). */
  scenarioId?: string | null;
  /** Scenario category name (e.g., "Safety & Boundary Enforcement"). */
  scenarioCategory?: string | null;
  /** Coverage tag: "core-business" | "variations" | "architecture" | "edge-cases". */
  coverageTag?: "core-business" | "variations" | "architecture" | "edge-cases" | null;
  /** Multi-turn: ordered sequence of messages in one conversation. When set, `question` is the test label. */
  turns?: EvalTestTurn[] | null;
  /** Plan validation: comma-separated tool names the agent should invoke. */
  expectedTools?: string | null;
  /** Plan validation: score threshold for tool matching (default 70). */
  toolThreshold?: number | null;
  /** Tracks test origin for merge protection during deep research. */
  source?: "preview-stub" | "user-edited" | "user-added" | "research-generated" | "research-enriched" | null;
  /** Whether test is ready to run or needs customization. */
  readiness?: "ready" | "template" | null;
  lastResult: EvalTestResult | null;
}

export type EvalSetRunWhen =
  | "every-iteration"
  | "after-knowledge"
  | "per-capability"
  | "after-tools"
  | "after-functional"
  | "final"
  | "custom";

export interface EvalSet {
  name: string;
  description: string;
  methods: EvalMethod[];
  passThreshold: number;
  runWhen: EvalSetRunWhen;
  tests: EvalTest[];
}

export interface EvalConfig {
  targetPassRate: number;
  maxIterationsPerCapability: number;
  maxRegressionRounds: number;
}

// ─── Decisions ─────────────────────────────────────────────────────

export type DecisionCategory = "integration" | "architecture" | "model" | "infrastructure" | "topic-implementation" | "solution-type";
export type DecisionStatus = "pending" | "confirmed" | "overridden";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface DecisionOption {
  id: string;
  label: string;
  summary: string;
  pros: string[];
  cons: string[];
  requirements: string[];
  cost: string;
  effort: string;
  confidence: ConfidenceLevel;
  source: string;
}

export interface Decision {
  id: string;
  category: DecisionCategory;
  title: string;
  context: string;
  targetField: string;
  capability: string;
  status: DecisionStatus;
  selectedOptionId: string | null;
  recommendedOptionId: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  options: DecisionOption[];
}

export interface ArchitectureTrigger {
  type: string;
  description: string;
}

export interface ChildAgent {
  name: string;
  role: string;
  routingRule: string;
  model: string;
  agentFolderId: string;
}

export interface ConnectedAgentDataPipeline {
  source: string;
  ingestion: string;
  destination: string;
  refreshCadence: string;
  authoritative: string;
}

export interface ConnectedAgentFallback {
  trigger: string;
  approach: string;
  soqlFallback: string;
}

export interface ConnectedAgent {
  name: string;
  source: string;
  phase: string;
  status: string;
  role: string;
  routingDescription: string;
  instructions: string;
  description: string;
  dataPipeline: ConnectedAgentDataPipeline;
  prerequisites: string[];
  setupSteps: string[];
  fallback: ConnectedAgentFallback;
}

export interface Channel {
  name: string;
  reason: string;
}

export interface ArchitectureScoring {
  factor: string;
  score: number;
  notes: string;
}

export type SolutionType = "agent" | "flow" | "hybrid" | "not-recommended";

export interface SolutionTypeFactor {
  factor: string;
  score: number;
  notes: string;
}

export type BuildPath = 'custom-agent' | 'hybrid' | 'flow' | 'not-recommended' | 'first-party-only';

export type LicenseStatus = 'yes' | 'no' | 'unknown';
export type DynamicsLicense = 'none' | 'sales' | 'service' | 'finance' | 'other';

export interface Licensing {
  m365Copilot: LicenseStatus;
  copilotStudio: LicenseStatus;
  frontierProgram: LicenseStatus;
  anthropicSubprocessor: LicenseStatus;
  powerPlatformPremium: LicenseStatus;
  dynamicsLicense: DynamicsLicense;
  notes: string;
}

export interface FrontierAgentMatch {
  agentName: string;
  matchedCapabilities: string[];
  coverage: 'full' | 'partial' | 'none';
  recommendation: 'use-as-is' | 'augment-with-ca' | 'not-applicable';
  licenseRequired: string;
  notes: string;
}

export interface Architecture {
  solutionType: SolutionType;
  solutionTypeScore: number;
  solutionTypeFactors: SolutionTypeFactor[];
  solutionTypeReason: string;
  solutionTypeOverride: boolean;
  alternativeRecommendation: string;
  buildPath: BuildPath | null;
  buildPathReason: string;
  frontierAgentMatch: FrontierAgentMatch[];
  pattern: string;
  patternReasoning: string;
  triggers: ArchitectureTrigger[];
  channels: Channel[];
  childAgents: ChildAgent[];
  connectedAgents: ConnectedAgent[];
  scoring: ArchitectureScoring[];
}

/**
 * Complete brief data payload keyed by section ID.
 * Each key maps to the corresponding section shape.
 */
export interface BriefData {
  overview: Overview;
  workflow: Workflow;
  instructions: { systemPrompt: string };
  capabilities: { items: Capability[] };
  tools: { items: Integration[] };
  "knowledge-sources": { items: KnowledgeSource[] };
  "conversation-topics": { items: ConversationTopic[]; starters: ConversationStarter[] };
  "scope-boundaries": { handles: string[]; politelyDeclines: BoundaryDecline[]; hardRefuses: BoundaryRefuse[] };
  architecture: Architecture;
  decisions: { items: Decision[] };
  "eval-sets": { sets: EvalSet[]; config: EvalConfig };
  "open-questions": { items: OpenQuestion[] };
  licensing: Licensing;
}

// ─── Build & Eval Status ─────────────────────────────────────────

export interface BuildStatus {
  status: string;
  lastBuild?: string;
  mcsAgentId?: string;
  environment?: string;
  account?: string;
  publishedAt?: string;
}

/** @deprecated Eval results now live in EvalSet.tests[].lastResult */
export interface EvalResult {
  question: string;
  expected: string;
  actual: string;
  pass: boolean;
  score: number;
  method: string;
}

/** @deprecated Eval results now live in EvalSet.tests[].lastResult */
export interface EvalResults {
  lastRun?: string;
  method?: string;
  summary?: { total: number; passed: number; failed: number; passRate: string };
  results?: EvalResult[];
}

export interface MvpSummary {
  now: string[];
  future: string[];
  blockers: string[];
}
