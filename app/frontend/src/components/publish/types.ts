import { AgentConfig, Evaluation, Message, MessageEval } from '../../types';
import type { ProvisionalSignalTag } from './provisionalSignals';

// ── Check result returned by each check module ──────────────────────────────

export type CheckStatus = 'pending' | 'in-progress' | 'passed' | 'warning' | 'failed' | 'skipped';

export type EvidenceSource = 'verified' | 'provisional';

export interface ValidationChangeAssessment {
  requiresEvaluation: boolean;
  summary: string;
  changedAreas?: string[];
  verified?: boolean;
}

export interface PublishCheckActionOption {
  id: 'run-eval-now' | 'skip-eval';
  label: string;
}

export interface PublishCheckNextAction {
  type: 'ask-run-eval';
  prompt: string;
  estimatedDuration?: string;
  options: PublishCheckActionOption[];
}

export interface CheckProvenance {
  evidenceSource: EvidenceSource;
  provisionalSignals?: ProvisionalSignalTag[];
  cleanupNote?: string;
}

export interface CheckDetail {
  label: string;
  status: 'passed' | 'warning' | 'failed';
  message?: string;
  provenance?: CheckProvenance;
}

export interface PublishCheckResult {
  status: Extract<CheckStatus, 'passed' | 'warning' | 'failed'>;
  label: string;
  details: CheckDetail[];
  /** Optional message surfaced to the maker in the HA chat */
  summary?: string;
  provenance?: CheckProvenance;
  completionState?: 'publish' | 'submit-for-approval';
  nextAction?: PublishCheckNextAction;
}

export interface PublishCheckContext {
  previewMessages?: Message[];
  evaluations?: Evaluation[];
  messageEvals?: Record<string, MessageEval>;
  now?: Date;
  validationChangeAssessment?: ValidationChangeAssessment;
  validationDecision?: 'skip-eval';
}

// ── Check module interface ──────────────────────────────────────────────────

export interface PublishCheck {
  /** Unique identifier — also used in scenario overrides */
  id: string;
  /** Display label shown in the progress timeline */
  label: string;
  /** Run the check against the current agent config */
  run: (agent: AgentConfig, context?: PublishCheckContext) => Promise<PublishCheckResult>;
}

// ── Scenario system for swapping between happy/failure paths ────────────────

export type ScenarioId = 'happy-path' | 'partial-warnings' | 'blocking-failure' | 'custom';

export interface PublishScenarioOverride {
  /** Which check to override (by id) */
  checkId: string;
  /** The result to force for that check */
  result: PublishCheckResult;
}

export interface PublishScenario {
  id: ScenarioId;
  label: string;
  description: string;
  overrides: PublishScenarioOverride[];
}

// ── Structured block rendered in CopilotMessage metadata ────────────────────

export interface PublishBlock {
  status: 'passed' | 'warning' | 'failed';
  label: string;
  summary?: string;
  issues?: string[];
  /** Inline note rendered below this block's summary — used for acknowledgment messages anchored to a specific check. */
  note?: string;
}

// ── Orchestrator state ──────────────────────────────────────────────────────

export interface PublishStepState {
  id: string;
  label: string;
  status: CheckStatus;
  result?: PublishCheckResult;
}

/**
 * Enough state to resume a paused publish run inside the same HA message.
 * Returned by runPublishChecklist when it pauses (e.g. eval gate).
 * Pass back in as the `resume` argument to continue from where it stopped.
 */
export interface PublishChecklistResumeState {
  /** The existing HA message ID to keep updating (not create a new one). */
  messageId: string;
  /** Blocks already rendered before the pause — pre-populated on resume. */
  publishBlocks: PublishBlock[];
  /** Index of the first check to run on resume (checks before this are already done). */
  fromCheckIndex: number;
  /**
   * Short acknowledgment shown inline in the checklist message before the next
   * check's loader appears. Lets the maker see confirmation before the run continues.
   * e.g. "Skipping eval — continuing with the remaining checks."
   */
  resumeNote?: string;
}

export type PublishPhase = 'idle' | 'checking' | 'publishing' | 'success' | 'failed';
