/**
 * Publish checklist runner.
 *
 * Runs all publish checks sequentially inside a SINGLE HA message that
 * progressively builds up — no scrolling, feels like one cohesive response.
 *
 * The message starts with an intro line, then each check result is appended
 * as it completes. On success the message ends with a publish confirmation.
 *
 * Flow:
 *   1. Create one message: "I'll run through a few checks..."
 *   2. For each check: append in-progress line → run → replace with result
 *   3. If a check has blockers: append failure summary, stop
 *   4. All pass: append "Publishing now..." → delay → replace with success
 */

import { AgentConfig, Message } from '../../types';
import { callModel } from '../../utils/modelClient';
import { publishChecks } from './checks';
import { getScenario } from './scenarios';
import type { PublishBlock, PublishCheckContext, PublishCheckResult, PublishChecklistResumeState, ScenarioId, PublishStepState } from './types';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Returns a human-friendly delay. */
const naturalDelay = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

/** Simulates the time a stubbed validation would take (1–3s), or 200–400ms in fast mode. */
const stubbedReasoningDelay = (fast: boolean) =>
  new Promise<void>(resolve => setTimeout(resolve, fast ? 200 + Math.random() * 200 : 1000 + Math.random() * 2000));

/** Simulates publish completion time, or 200–400ms in fast mode. */
const publishDelay = (fast: boolean) =>
  new Promise<void>(resolve => setTimeout(resolve, fast ? 200 + Math.random() * 200 : 3000 + Math.random() * 7000));

const REAL_TIME_CHECK_IDS = new Set(['agent-setup']);

// ── LLM-composed failure outcome ─────────────────────────────────────────────

const FAILURE_OUTCOME_SYSTEM = `You are Copilot Studio's Helper Agent. A publish readiness check just blocked publish.
Write 1–2 sentences the maker will see immediately after the check result.

Rules:
- Reference the specific issue(s) by name — do not be vague.
- Use neutral language: say "The instructions need..." not "You need to...".
- Do not imply any blocking issue is optional or minor.
- Close with the single smallest concrete next step that unblocks publish.
- Tone: direct, calm, supportive, matter-of-fact.
- No bullet points, headers, bold, or markdown.
- Do not open with "I found", "I noticed", or "Unfortunately".`;

/**
 * Calls the LLM to compose a specific, actionable failure outcome sentence.
 * Falls back to a static string if the model call fails.
 */
async function composeFailureOutcome(
  checkLabel: string,
  issues: string[],
  summary: string | undefined,
): Promise<string> {
  const issueList = issues.length > 0 ? issues.join('; ') : (summary ?? 'an unspecified issue');
  try {
    const text = (await callModel({
      model: 'fast',
      maxTokens: 120,
      system: FAILURE_OUTCOME_SYSTEM,
      messages: [{ role: 'user', content: `Check: ${checkLabel}\nIssues: ${issueList}` }],
    })).trim();
    return text || 'There are issues that must be resolved before publishing. Would you like help fixing them?';
  } catch {
    return 'There are issues that must be resolved before publishing. Would you like help fixing them?';
  }
}

const SUGGESTION_LABEL_MAP: Record<string, string> = {
  'Show details': 'Explain the issues',
  'Cancel publish': 'Stop publish for now',
  'Review policy details': 'Explain the policy details',
  'Share with team': 'Help me share this',
  'Back to build': 'Take me through the build details',
  'View agent details': 'What should I do next?',
  'Set up monitoring': 'Help me set up monitoring',
};

function normalizeSuggestionLabel(label: string): string {
  return SUGGESTION_LABEL_MAP[label] ?? label;
}

/** Build the summary line shown under the check header. */
function buildSummaryText(result: PublishCheckResult): string {
  if (result.summary) return result.summary;

  const issues = result.details.filter(d => d.status !== 'passed');
  if (issues.length === 0) return '';

  return issues
    .map(d => d.message || d.label)
    .join('. ');
}

/** Build structured block data for a completed check. */
function buildCheckBlock(result: PublishCheckResult, fallbackLabel: string): PublishBlock {
  const label = result.label || fallbackLabel;
  const summary = buildSummaryText(result);
  const issues = result.status === 'failed'
    ? result.details.filter(d => d.status === 'failed').map(d => d.message || d.label)
    : undefined;

  return { status: result.status, label, summary: summary || undefined, issues };
}

// ── Runner parameters ───────────────────────────────────────────────────────

export interface PublishChecklistCallbacks {
  /** Add a new message to the HA chat for this agent. */
  addMessage: (agentId: string, message: Message) => void;
  /** Update an existing message's content. */
  updateMessage: (agentId: string, messageId: string, updates: Partial<Message>) => void;
  /** Mark the agent as published. */
  markPublished: () => void;
  /** Mark the agent as submitted for approval. */
  markPendingApproval?: () => void;
  /** Compose channel-aware success message (LLM-generated celebration + copy fields). */
  composeSuccessMessage?: () => Promise<{ content: string; suggestions: string[]; copyFields: Array<{ label: string; value: string }> }>;
}

export interface PublishChecklistResult {
  success: boolean;
  steps: PublishStepState[];
  paused?: boolean;
  pendingAction?: PublishCheckResult['nextAction'];
  /** Present when paused — pass back to runPublishChecklist to resume the same message. */
  resumeState?: PublishChecklistResumeState;
}

// ── Main runner ─────────────────────────────────────────────────────────────

const INTRO = "I'll run through a few checks before publishing.";

/**
 * Runs the publish checklist inside a single progressively-updated message.
 * Pass `resume` to continue a previously-paused run inside the same HA message
 * instead of creating a new one from scratch.
 */
export async function runPublishChecklist(
  agent: AgentConfig,
  agentId: string,
  scenarioId: ScenarioId,
  callbacks: PublishChecklistCallbacks,
  context: PublishCheckContext = {},
  resume?: PublishChecklistResumeState,
): Promise<PublishChecklistResult> {
  const fast = localStorage.getItem('publishFastMode') === 'true';
  const scenario = getScenario(scenarioId);
  const steps: PublishStepState[] = publishChecks.map(c => ({
    id: c.id,
    label: c.label,
    status: 'pending',
  }));

  // Reuse existing message+blocks when resuming; otherwise start fresh.
  const msgId = resume?.messageId ?? crypto.randomUUID();
  const publishBlocks: PublishBlock[] = resume ? [...resume.publishBlocks] : [];
  const startIndex = resume?.fromCheckIndex ?? 0;

  // If resuming with a note, stamp it onto the last completed block so it stays
  // anchored to that check rather than floating at the bottom of the message.
  if (resume?.resumeNote && publishBlocks.length > 0) {
    publishBlocks[publishBlocks.length - 1] = {
      ...publishBlocks[publishBlocks.length - 1],
      note: resume.resumeNote,
    };
  }

  if (!resume) {
    // Create the message with intro + LatencyLoader for the first check
    callbacks.addMessage(agentId, {
      id: msgId,
      role: 'assistant',
      content: INTRO,
      timestamp: new Date(),
      metadata: { isThinking: true, thinkingText: `${publishChecks[0].label}...`, publishBlocks: [] },
    });
  } else {
    // Resuming: update the existing message to show the next check's loader.
    // Guard against startIndex being out of bounds (should not happen today, but future-safe).
    if (startIndex < publishChecks.length) {
      callbacks.updateMessage(agentId, msgId, {
        content: INTRO,
        metadata: { isThinking: true, thinkingText: `${publishChecks[startIndex].label}...`, publishBlocks: [...publishBlocks] },
      });
    }
  }

  let blocked = false;

  for (let i = startIndex; i < publishChecks.length; i++) {
    const check = publishChecks[i];

    steps[i] = { ...steps[i], status: 'in-progress' };

    // Show LatencyLoader for the current check
    callbacks.updateMessage(agentId, msgId, {
      content: INTRO,
      metadata: { isThinking: true, thinkingText: `${check.label}...`, publishBlocks: [...publishBlocks] },
    });

    const override = scenario.overrides.find(o => o.checkId === check.id);
    const usesMeasuredRuntime = !override && REAL_TIME_CHECK_IDS.has(check.id);

    if (!usesMeasuredRuntime) {
      await stubbedReasoningDelay(fast);
    }

    const result: PublishCheckResult = override
      ? override.result
      : await check.run(agent, context);

    steps[i] = { ...steps[i], status: result.status, result };

    // Append the completed result block
    publishBlocks.push(buildCheckBlock(result, check.label));

    if (result.nextAction?.type === 'ask-run-eval') {
      callbacks.updateMessage(agentId, msgId, {
        content: INTRO,
        metadata: {
          isThinking: false,
          publishBlocks: [...publishBlocks],
          publishOutcome: result.nextAction.prompt,
          suggestions: result.nextAction.options.map(option => option.label),
        },
      });

      return {
        success: false,
        paused: true,
        pendingAction: result.nextAction,
        steps,
        resumeState: {
          messageId: msgId,
          publishBlocks: [...publishBlocks],
          fromCheckIndex: i + 1,
        },
      };
    }

    if (result.status === 'failed') {
      // Mark remaining as skipped
      for (let j = i + 1; j < publishChecks.length; j++) {
        steps[j] = { ...steps[j], status: 'skipped' };
      }

      // Show a brief loader while the LLM composes a specific, actionable failure message
      callbacks.updateMessage(agentId, msgId, {
        content: INTRO,
        metadata: { isThinking: true, thinkingText: 'Writing summary...', publishBlocks: [...publishBlocks] },
      });

      const failedIssues = result.details
        .filter(d => d.status === 'failed')
        .map(d => d.message || d.label);
      const failureOutcome = await composeFailureOutcome(check.label, failedIssues, result.summary);

      callbacks.updateMessage(agentId, msgId, {
        content: INTRO,
        metadata: {
          isThinking: false,
          publishBlocks: [...publishBlocks],
          publishOutcome: failureOutcome,
          suggestions: ['Help me fix these', 'Explain the issues', 'Stop publish for now'],
        },
      });

      blocked = true;
      break;
    }

    // Show completed result + LatencyLoader for next check
    if (i < publishChecks.length - 1) {
      callbacks.updateMessage(agentId, msgId, {
        content: INTRO,
        metadata: { isThinking: true, thinkingText: `${publishChecks[i + 1].label}...`, publishBlocks: [...publishBlocks] },
      });
      await naturalDelay(fast ? 100 : 1000 + Math.random() * 1000);
    }
  }

  if (blocked) {
    return { success: false, steps };
  }

  // All checks passed — show "Publishing now..." with LatencyLoader
  callbacks.updateMessage(agentId, msgId, {
    content: INTRO,
    metadata: { isThinking: true, thinkingText: 'Publishing now...', publishBlocks: [...publishBlocks] },
  });

  // Simulate publish delay (5–15 seconds)
  await publishDelay(fast);

  const policyStep = steps.find(step => step.id === 'policy');
  const requiresApproval = policyStep?.result?.completionState === 'submit-for-approval';

  if (!requiresApproval) {
    callbacks.markPublished();
  } else {
    callbacks.markPendingApproval?.();
  }

  // Compose channel-aware success message if available, otherwise use static fallback
  let successContent: string;
  let successSuggestions: string[];
  let postPublishCopyFields: Array<{ label: string; value: string }> | undefined;

  if (requiresApproval) {
    successContent = `Your agent **${agent.name}** has been submitted for approval. An admin will review it before it goes live.`;
    successSuggestions = ['Explain the policy details', 'Help me share this', 'Take me through the build details'];
  } else if (callbacks.composeSuccessMessage) {
    try {
      const result = await callbacks.composeSuccessMessage();
      successContent = result.content;
      successSuggestions = result.suggestions.map(normalizeSuggestionLabel);
      postPublishCopyFields = result.copyFields.length > 0 ? result.copyFields : undefined;
    } catch {
      successContent = `Your agent **${agent.name}** has been published successfully! \uD83C\uDF89`;
      successSuggestions = ['What should I do next?', 'Help me share this', 'Help me set up monitoring'];
    }
  } else {
    successContent = `Your agent **${agent.name}** has been published successfully! \uD83C\uDF89`;
    successSuggestions = ['What should I do next?', 'Help me share this', 'Help me set up monitoring'];
  }

  // Final success — stop the LatencyLoader
  callbacks.updateMessage(agentId, msgId, {
    content: INTRO,
    metadata: {
      isThinking: false,
      publishBlocks: [...publishBlocks],
      publishOutcome: successContent,
      suggestions: successSuggestions,
      ...(postPublishCopyFields ? { postPublishCopyFields } : {}),
    },
  });

  return { success: true, steps };
}
