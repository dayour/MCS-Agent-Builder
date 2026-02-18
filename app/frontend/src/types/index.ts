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
}

// ─── Document ───────────────────────────────────────────────────────

export type DocType = "markdown" | "csv" | "image";
export type DocChangeStatus = "new" | "modified" | "processed";

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
}

// ─── Terminal ───────────────────────────────────────────────────────

export type TerminalSessionType = "system" | "research" | "build" | "evaluate";
export type TerminalSessionStatus = "connecting" | "running" | "stopped" | "error";

export interface TerminalSession {
  id: string;
  label: string;
  type: TerminalSessionType;
  projectId: string;
  agentName: string;
  status: TerminalSessionStatus;
  wsUrl: string;
  /** Optional command to send to Claude Code after it's ready. */
  command?: string;
}

// ─── Brief Data Shapes (section payloads) ───────────────────────────

export interface SuccessCriterion {
  metric: string;
  target: string;
  current: string;
}

export interface Stakeholder {
  name: string;
  role: string;
  type: string;
}

export interface BusinessContext {
  problemStatement: string;
  challenges: string[];
  benefits: string[];
  successCriteria: SuccessCriterion[];
  stakeholders: Stakeholder[];
}

export interface AgentIdentity {
  name: string;
  description: string;
  persona: string;
  targetUsers: string[];
}

export interface Capability {
  name: string;
  description: string;
  tag: string;
  enabled: boolean;
}

export interface Integration {
  name: string;
  type: string;
  auth: string;
  notes: string;
}

export interface KnowledgeSource {
  name: string;
  purpose: string;
  location: string;
  phase: string;
  status: string;
}

export interface ConversationTopic {
  name: string;
  type: "generative" | "custom";
  phase: string;
  description: string;
  flowDescription: string;
}

export interface Scenario {
  category: string;
  title: string;
  userMessage: string;
  expectedResponse: string;
}

export interface EvaluationTest {
  name: string;
  input: string;
  expectedOutput: string;
  scoringMethod: string;
  status: string;
}

export interface OpenQuestion {
  question: string;
  assignee: string;
  priority: string;
  status: string;
  resolution?: string;
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

export interface Channel {
  name: string;
  reason: string;
}

export interface ArchitectureScoring {
  factor: string;
  score: number;
  notes: string;
}

export interface Architecture {
  pattern: string;
  patternReasoning: string;
  triggers: ArchitectureTrigger[];
  channels: Channel[];
  childAgents: ChildAgent[];
  scoring: ArchitectureScoring[];
}

/**
 * Complete brief data payload keyed by section ID.
 * Each key maps to the corresponding section shape.
 */
export interface BriefData {
  "business-context": BusinessContext;
  "agent-identity": AgentIdentity;
  instructions: { systemPrompt: string };
  capabilities: { items: Capability[] };
  tools: { items: Integration[] };
  "knowledge-sources": { items: KnowledgeSource[] };
  "conversation-topics": { items: ConversationTopic[] };
  "scope-boundaries": { handles: string[]; politelyDeclines: string[]; hardRefuses: string[] };
  architecture: Architecture;
  scenarios: { items: Scenario[] };
  "evaluation-tests": { items: EvaluationTest[] };
  "open-questions": { items: OpenQuestion[] };
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

export interface EvalResult {
  question: string;
  expected: string;
  actual: string;
  pass: boolean;
  score: number;
  method: string;
}

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
